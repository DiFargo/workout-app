export const WORKOUT_BLOCK_SCHEMA_VERSION = 1;

export const WORKOUT_BLOCK_TYPES = Object.freeze({
  EXERCISE: "exercise",
  GROUP: "group",
  INTERVAL: "interval",
  FREE: "free"
});

export const WORKOUT_GROUP_MODES = Object.freeze({
  SUPERSET: "superset",
  TRISET: "triset",
  CIRCUIT: "circuit",
  SEQUENCE: "sequence"
});

const BLOCK_TYPE_VALUES = new Set(Object.values(WORKOUT_BLOCK_TYPES));
const GROUP_MODE_VALUES = new Set(Object.values(WORKOUT_GROUP_MODES));

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

export function createWorkoutTaskBlock(type = WORKOUT_BLOCK_TYPES.EXERCISE, options = {}) {
  const safeType = BLOCK_TYPE_VALUES.has(type) ? type : WORKOUT_BLOCK_TYPES.FREE;
  const id = options.id || `task_block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const common = {
    id,
    type: safeType,
    title: String(options.title || "").trim(),
    instruction: String(options.instruction || "").trim(),
    exerciseIds: uniqueStrings(options.exerciseIds)
  };

  if (safeType === WORKOUT_BLOCK_TYPES.GROUP) {
    return {
      ...common,
      groupMode: GROUP_MODE_VALUES.has(options.groupMode) ? options.groupMode : WORKOUT_GROUP_MODES.SUPERSET,
      rounds: Math.max(1, Number(options.rounds) || 3),
      restAfterRound: String(options.restAfterRound || "90 сек")
    };
  }

  if (safeType === WORKOUT_BLOCK_TYPES.INTERVAL) {
    return {
      ...common,
      rounds: Math.max(1, Number(options.rounds) || 8),
      workTime: String(options.workTime || "30 сек"),
      restTime: String(options.restTime || "30 сек"),
      distance: String(options.distance || ""),
      pace: String(options.pace || ""),
      heartRateZone: String(options.heartRateZone || "")
    };
  }

  return common;
}

export function normalizeWorkoutTaskBlocks(workout = {}) {
  const workoutId = String(workout.id || "workout");
  const sourceBlocks = Array.isArray(workout.taskBlocks) ? workout.taskBlocks : [];
  const sourceExercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  if (!sourceBlocks.length && !sourceExercises.length) return workout;
  const exercises = sourceExercises.map((exercise, index) => ({
    ...exercise,
    id: exercise.id || `${workoutId}_exercise_${index + 1}`
  }));
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
  const normalizedBlocks = sourceBlocks.map((block, index) => createWorkoutTaskBlock(block.type, {
    ...block,
    id: block.id || `${workoutId}_block_${index + 1}`,
    exerciseIds: uniqueStrings(block.exerciseIds).filter((exerciseId) => exerciseIds.has(exerciseId))
  })).filter((block) => block.type !== WORKOUT_BLOCK_TYPES.EXERCISE || block.exerciseIds.length);
  const assignedIds = new Set(normalizedBlocks.flatMap((block) => block.exerciseIds));
  const missingExerciseBlocks = exercises
    .filter((exercise) => !assignedIds.has(exercise.id))
    .map((exercise, index) => createWorkoutTaskBlock(WORKOUT_BLOCK_TYPES.EXERCISE, {
      id: `${workoutId}_exercise_block_${normalizedBlocks.length + index + 1}`,
      exerciseIds: [exercise.id]
    }));

  return {
    ...workout,
    workoutBlockSchemaVersion: WORKOUT_BLOCK_SCHEMA_VERSION,
    exercises,
    taskBlocks: [...normalizedBlocks, ...missingExerciseBlocks]
  };
}

export function moveExerciseToTaskBlock(taskBlocks = [], exerciseId, targetBlockId) {
  const cleanExerciseId = String(exerciseId || "").trim();
  if (!cleanExerciseId) return taskBlocks;
  return taskBlocks.map((block) => ({
    ...block,
    exerciseIds: block.id === targetBlockId
      ? uniqueStrings([...(block.exerciseIds || []), cleanExerciseId])
      : (block.exerciseIds || []).filter((id) => id !== cleanExerciseId)
  })).filter((block) => block.type !== WORKOUT_BLOCK_TYPES.EXERCISE || block.exerciseIds.length);
}

export function buildExecutableWorkout(workout = {}) {
  const normalized = normalizeWorkoutTaskBlocks(workout);
  if (!normalized.taskBlocks?.length) return normalized;
  const exercisesById = new Map((normalized.exercises || []).map((exercise) => [exercise.id, exercise]));
  const orderedExercises = [];
  const usedIds = new Set();

  normalized.taskBlocks.forEach((block) => {
    if ([WORKOUT_BLOCK_TYPES.EXERCISE, WORKOUT_BLOCK_TYPES.GROUP].includes(block.type)) {
      (block.exerciseIds || []).forEach((exerciseId, exerciseIndex) => {
        const exercise = exercisesById.get(exerciseId);
        if (!exercise || usedIds.has(exerciseId)) return;
        orderedExercises.push({
          ...exercise,
          taskBlockId: block.id,
          taskBlockType: block.type,
          ...(block.type === WORKOUT_BLOCK_TYPES.GROUP ? {
            taskBlockConfig: { ...block },
            taskBlockExerciseIndex: exerciseIndex,
            taskBlockExerciseCount: (block.exerciseIds || []).length
          } : {})
        });
        usedIds.add(exerciseId);
      });
      return;
    }

    const syntheticId = `${normalized.id || "workout"}_${block.id}`;
    orderedExercises.push({
      id: syntheticId,
      name: block.title || (block.type === WORKOUT_BLOCK_TYPES.INTERVAL ? "Интервальный блок" : "Задание тренера"),
      taskBlockId: block.id,
      taskBlockType: block.type,
      taskBlockConfig: { ...block },
      instruction: block.instruction || "",
      requiresWeight: false,
      usesWeight: false,
      sets: [{ reps: "", weight: "", completed: false, completedRounds: 0 }]
    });
  });

  (normalized.exercises || []).forEach((exercise) => {
    if (!usedIds.has(exercise.id)) orderedExercises.push(exercise);
  });

  return { ...normalized, exercises: orderedExercises };
}
