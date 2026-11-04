import { WORKOUT_BLOCK_TYPES } from "./universalWorkoutBlocks.js";

const key = value => String(value ?? "").trim();
const isExerciseContainer = block => block.type === WORKOUT_BLOCK_TYPES.EXERCISE
  || block.type === WORKOUT_BLOCK_TYPES.GROUP;

/**
 * Move the visible exercise without letting the flat array disagree with the
 * executable block order. Groups are atomic neighbours, never individual
 * exercise targets. A multi-exercise ordinary block may reorder internally;
 * crossing its boundary is refused rather than moving its peers implicitly.
 */
export function getTrainerProgramExerciseMove(workout, exerciseId, direction) {
  if (!workout || (direction !== -1 && direction !== 1)) return null;
  const targetId = key(exerciseId);
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const byId = new Map();
  for (const exercise of exercises) {
    const id = key(exercise?.id);
    if (!id || exercise.id !== id || byId.has(id)) return null;
    byId.set(id, exercise);
  }
  if (!targetId || !byId.has(targetId)) return null;

  const sourceBlocks = Array.isArray(workout.taskBlocks) ? workout.taskBlocks : [];
  const blockIds = new Set();
  const blocks = [];
  const containers = new Map();
  for (const source of sourceBlocks) {
    const id = key(source?.id);
    if (!id || blockIds.has(id)) return null;
    blockIds.add(id);
    const block = { ...source, exerciseIds: [...(Array.isArray(source.exerciseIds) ? source.exerciseIds : [])] };
    // Some legacy interval/instruction blocks reference real exercises. Their
    // fallback execution order is not an ordinary movable block sequence.
    // Do not implicitly migrate that ambiguous structure during a reorder.
    if (!isExerciseContainer(block) && block.exerciseIds.some(reference => byId.has(key(reference)))) return null;
    if (isExerciseContainer(block)) {
      for (const reference of block.exerciseIds) {
        const referenceId = key(reference);
        // A duplicated/dangling identity has no unambiguous movable source.
        if (reference !== referenceId || !byId.has(referenceId) || containers.has(referenceId)) return null;
        containers.set(referenceId, blocks.length);
      }
    }
    blocks.push(block);
  }

  // Legacy flat rows and unassigned rows become explicit ordinary blocks in
  // their existing order. IDs are deterministic and cannot collide with a
  // preserved group, interval or free-instruction block.
  const workoutId = key(workout.id) || "workout";
  for (const exercise of exercises) {
    const id = key(exercise.id);
    if (containers.has(id)) continue;
    let suffix = blocks.length + 1;
    let blockId = `${workoutId}_exercise_block_${suffix}`;
    while (blockIds.has(blockId)) blockId = `${workoutId}_exercise_block_${++suffix}`;
    blockIds.add(blockId);
    containers.set(id, blocks.length);
    blocks.push({ id: blockId, type: WORKOUT_BLOCK_TYPES.EXERCISE, title: "", instruction: "", exerciseIds: [exercise.id] });
  }

  const blockIndex = containers.get(targetId);
  const block = blocks[blockIndex];
  if (!block || block.type !== WORKOUT_BLOCK_TYPES.EXERCISE) return null;
  const slot = block.exerciseIds.findIndex(id => key(id) === targetId);
  const nextSlot = slot + direction;
  if (nextSlot >= 0 && nextSlot < block.exerciseIds.length) {
    [block.exerciseIds[slot], block.exerciseIds[nextSlot]] = [block.exerciseIds[nextSlot], block.exerciseIds[slot]];
  } else {
    if (block.exerciseIds.length !== 1) return null;
    let neighbour = blockIndex + direction;
    // Empty ordinary containers have no visible/executable row. Retain their
    // metadata, but do not offer a movement that only swaps with an invisible row.
    while (neighbour >= 0 && neighbour < blocks.length
      && blocks[neighbour].type === WORKOUT_BLOCK_TYPES.EXERCISE
      && !blocks[neighbour].exerciseIds.length) neighbour += direction;
    if (neighbour < 0 || neighbour >= blocks.length) return null;
    [blocks[blockIndex], blocks[neighbour]] = [blocks[neighbour], blocks[blockIndex]];
  }

  const ordered = [];
  const used = new Set();
  for (const item of blocks) {
    if (!isExerciseContainer(item)) continue;
    for (const reference of item.exerciseIds) {
      const id = key(reference);
      if (used.has(id)) continue;
      ordered.push(byId.get(id));
      used.add(id);
    }
  }
  return { exercises: ordered, taskBlocks: blocks };
}
