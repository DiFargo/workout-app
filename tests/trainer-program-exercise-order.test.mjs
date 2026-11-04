import assert from "node:assert/strict";
import test from "node:test";
import { getTrainerProgramExerciseMove } from "../src/utils/trainerProgramExerciseOrder.js";
import { buildExecutableWorkout, normalizeWorkoutTaskBlocks } from "../src/utils/universalWorkoutBlocks.js";

const movement = id => ({ id, name: id, video: `/${id}.mp4`, exerciseCardId: `card-${id}`,
  rest: "90 сек", requiresWeight: true, note: `note-${id}`,
  sets: [{ id: `${id}-1`, reps: 12, weight: 20, rpe: 8 }, { id: `${id}-2`, reps: 10, weight: 25, metadata: { side: "left" } }] });
const single = id => ({ id: `block-${id}`, type: "exercise", exerciseIds: [id], instruction: `instruction-${id}`, custom: { preserved: id } });
const execution = workout => buildExecutableWorkout(workout).exercises.map(item => item.id);
const apply = (workout, patch) => ({ ...workout, ...patch });
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function assertPrescriptions(before, patch) {
  assert.deepEqual([...patch.exercises].sort((a, b) => a.id.localeCompare(b.id)),
    [...before.exercises].sort((a, b) => a.id.localeCompare(b.id)));
}

test("legacy flat movement gains matching explicit blocks without changing identities or prescriptions", () => {
  const workout = freeze({ id: "day", exercises: [movement("a"), movement("b"), movement("c")] });
  const before = structuredClone(workout);
  const patch = getTrainerProgramExerciseMove(workout, "a", 1);
  assert.deepEqual(patch.exercises.map(item => item.id), ["b", "a", "c"]);
  assert.deepEqual(execution(apply(workout, patch)), ["b", "a", "c"]);
  assert.equal(new Set(patch.taskBlocks.map(item => item.id)).size, 3);
  assert.deepEqual(getTrainerProgramExerciseMove(workout, "a", 1), patch, "generated IDs are deterministic");
  assertPrescriptions(before, patch);
  assert.deepEqual(workout, before);
});

test("legacy interval references never gain ordinary blocks or change unrelated fallback order", () => {
  for (const type of ["interval", "free"]) {
    const workout = freeze({ id: "day", exercises: [movement("a"), movement("b"), movement("c")],
      taskBlocks: [{ id: "run", type, exerciseIds: ["a"], instruction: "Сохранить" }, single("b")] });
    const before = structuredClone(workout);
    const order = execution(workout);
    assert.equal(getTrainerProgramExerciseMove(workout, "b", -1), null);
    assert.deepEqual(execution(workout), order);
    assert.deepEqual(workout, before);
  }
});

test("normalised block order is authoritative even when the flat array differs", () => {
  const workout = freeze({ id: "day", exercises: [movement("c"), movement("a"), movement("b")],
    taskBlocks: [single("a"), single("b"), single("c")] });
  const patch = getTrainerProgramExerciseMove(workout, "b", 1);
  assert.deepEqual(patch.taskBlocks.map(item => item.id), ["block-a", "block-c", "block-b"]);
  assert.deepEqual(patch.exercises.map(item => item.id), ["a", "c", "b"]);
  assert.deepEqual(execution(apply(workout, patch)), ["a", "c", "b"]);
  assertPrescriptions(workout, patch);
});

test("an ordinary exercise crosses a whole superset without splitting or changing it", () => {
  const group = { id: "pair", type: "group", groupMode: "superset", rounds: 4, restAfterRound: "110 сек",
    exerciseIds: ["b", "c"], instruction: "Без отдыха между упражнениями", custom: { equipment: "cable" } };
  const workout = freeze({ id: "day", exercises: [movement("a"), movement("b"), movement("c"), movement("d")],
    taskBlocks: [single("a"), group, single("d")] });
  const patch = getTrainerProgramExerciseMove(workout, "a", 1);
  assert.deepEqual(patch.taskBlocks.map(item => item.id), ["pair", "block-a", "block-d"]);
  assert.deepEqual(patch.taskBlocks[0], group);
  assert.deepEqual(execution(apply(workout, patch)), ["b", "c", "a", "d"]);
  assert.equal(getTrainerProgramExerciseMove(workout, "b", -1), null, "a group member cannot leave its group");
  assert.equal(getTrainerProgramExerciseMove(workout, "c", 1), null);
  assertPrescriptions(workout, patch);
});

test("a triset is likewise an atomic neighbour in the opposite direction", () => {
  const group = { id: "triple", type: "group", groupMode: "triset", rounds: 3, exerciseIds: ["a", "b", "c"] };
  const workout = freeze({ id: "day", exercises: ["a", "b", "c", "d"].map(movement), taskBlocks: [group, single("d")] });
  const patch = getTrainerProgramExerciseMove(workout, "d", -1);
  assert.deepEqual(execution(apply(workout, patch)), ["d", "a", "b", "c"]);
  assert.deepEqual(patch.taskBlocks[1], group);
  assertPrescriptions(workout, patch);
});

test("a multi-ID ordinary block reorders internally but refuses to move peers across its boundary", () => {
  const block = { id: "multi", type: "exercise", exerciseIds: ["a", "b", "c"], custom: { untouched: true } };
  const workout = freeze({ id: "day", exercises: ["a", "b", "c", "d"].map(movement), taskBlocks: [block, single("d")] });
  const patch = getTrainerProgramExerciseMove(workout, "b", -1);
  assert.deepEqual(patch.taskBlocks[0].exerciseIds, ["b", "a", "c"]);
  assert.deepEqual(patch.taskBlocks[0].custom, block.custom);
  assert.deepEqual(execution(apply(workout, patch)), ["b", "a", "c", "d"]);
  assert.equal(getTrainerProgramExerciseMove(workout, "a", -1), null);
  assert.equal(getTrainerProgramExerciseMove(workout, "c", 1), null);
  assertPrescriptions(workout, patch);
});

test("interval/free steps retain their complete metadata and their executable identities", () => {
  const interval = { id: "run", type: "interval", rounds: 5, workTime: "40 сек", restTime: "20 сек", pace: "6:00",
    exerciseIds: [], custom: { zone: 2 }, instruction: "Спокойный темп" };
  const free = { id: "coach", type: "free", exerciseIds: [], title: "Проверка техники", instruction: "Остановиться при боли", custom: { keep: true } };
  const workout = freeze({ id: "day", exercises: [movement("a"), movement("b")], taskBlocks: [single("a"), interval, free, single("b")] });
  const patch = getTrainerProgramExerciseMove(workout, "a", 1);
  assert.deepEqual(execution(apply(workout, patch)), ["day_run", "a", "day_coach", "b"]);
  assert.deepEqual(patch.taskBlocks.find(item => item.id === "run"), interval);
  assert.deepEqual(patch.taskBlocks.find(item => item.id === "coach"), free);
  assertPrescriptions(workout, patch);
});

test("unassigned rows become explicit in their previous tail order and IDs avoid existing blocks", () => {
  const free = { id: "day_exercise_block_3", type: "free", exerciseIds: [], instruction: "Keep" };
  const workout = freeze({ id: "day", exercises: ["a", "b", "c"].map(movement), taskBlocks: [single("a"), free] });
  const patch = getTrainerProgramExerciseMove(workout, "b", -1);
  assert.deepEqual(execution(apply(workout, patch)), ["a", "b", "day_day_exercise_block_3", "c"]);
  assert.equal(new Set(patch.taskBlocks.map(item => item.id)).size, 4);
  assert.deepEqual(patch.taskBlocks.find(item => item.type === "free"), free);
  assertPrescriptions(workout, patch);
});

test("empty ordinary containers are preserved but cannot consume a visible movement", () => {
  const empty = { id: "empty", type: "exercise", exerciseIds: [], custom: "untouched" };
  const workout = freeze({ id: "day", exercises: [movement("a"), movement("b")], taskBlocks: [single("a"), empty, single("b")] });
  const patch = getTrainerProgramExerciseMove(workout, "a", 1);
  assert.deepEqual(execution(apply(workout, patch)), ["b", "a"]);
  assert.deepEqual(patch.taskBlocks.find(item => item.id === "empty"), empty);
});

test("boundaries, invalid directions and ambiguous identities return null without writes", () => {
  const base = normalizeWorkoutTaskBlocks({ id: "day", exercises: [movement("a"), movement("b")] });
  assert.equal(getTrainerProgramExerciseMove(base, "a", -1), null);
  assert.equal(getTrainerProgramExerciseMove(base, "b", 1), null);
  for (const direction of [0, 2, -2, "1", NaN, undefined]) assert.equal(getTrainerProgramExerciseMove(base, "a", direction), null);
  assert.equal(getTrainerProgramExerciseMove(base, "missing", 1), null);
  assert.equal(getTrainerProgramExerciseMove(null, "a", 1), null);
  assert.equal(getTrainerProgramExerciseMove({ exercises: [{ id: "a" }, { id: "a" }] }, "a", 1), null);
  assert.equal(getTrainerProgramExerciseMove({ exercises: [{ name: "No ID" }] }, "a", 1), null);
  assert.equal(getTrainerProgramExerciseMove({ exercises: [{ id: 1 }, { id: 2 }] }, 1, 1), null);
  assert.equal(getTrainerProgramExerciseMove({ exercises: [{ id: " a" }, { id: "b" }] }, "a", 1), null);
  assert.equal(getTrainerProgramExerciseMove({ ...base, taskBlocks: [single("a"), { ...single("b"), id: "block-a" }] }, "a", 1), null);
  assert.equal(getTrainerProgramExerciseMove({ ...base, taskBlocks: [single("a"), { ...single("b"), exerciseIds: ["a", "b"] }] }, "a", 1), null);
  assert.equal(getTrainerProgramExerciseMove({ ...base, taskBlocks: [{ ...single("a"), exerciseIds: ["unknown"] }] }, "a", 1), null);
  assert.equal(getTrainerProgramExerciseMove({ ...base, taskBlocks: [{ ...single("a"), exerciseIds: [" a"] }] }, "a", 1), null);
});

test("moving down then up restores the actual executable order and unchanged prescriptions", () => {
  const workout = freeze(normalizeWorkoutTaskBlocks({ id: "day", exercises: ["a", "b", "c"].map(movement) }));
  const after = apply(workout, getTrainerProgramExerciseMove(workout, "a", 1));
  const restored = getTrainerProgramExerciseMove(after, "a", -1);
  assert.deepEqual(execution(apply(after, restored)), execution(workout));
  assert.deepEqual(restored.taskBlocks, workout.taskBlocks);
  assertPrescriptions(workout, restored);
});
