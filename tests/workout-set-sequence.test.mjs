import assert from "node:assert/strict";
import test from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { canToggleWorkoutSetCompleted } from "../src/utils/workoutSetSequence.js";

const cleanup = installRuntimeImports({
  "firebase/firestore": { doc() {}, setDoc() {} },
  "/src/firebase.js": { auth: { currentUser: null }, db: {} }
});
const { createWorkoutRuntimeHandlers } = await import("../src/features/client/workouts/workoutRuntimeHandlers.js");
test.after(cleanup);

function fixture(exercises) {
  let plan = { workouts: [{ id: "workout", exercises }] };
  const timerStarts = [];
  let writes = 0;
  return {
    get exercises() { return plan.workouts[0].exercises; },
    get writes() { return writes; },
    timerStarts,
    toggle(exerciseId, index) {
      return createWorkoutRuntimeHandlers({
        workout: plan.workouts[0], restTimerDuration: 90,
        setPlan(update) { plan = update(plan); writes += 1; },
        setExerciseValidationMessage() {}, setRestTimerDuration() {},
        setRestTimerSeconds(seconds) { timerStarts.push(seconds); }, setRestTimerRunning() {}
      }).toggleWorkoutSetCompleted(exerciseId, index);
    }
  };
}

test("only the next set can be confirmed; only the last completed set can be undone", () => {
  const sets = Array.from({ length: 3 }, (_, index) => ({ reps: 12, weight: "110", enteredWeight: index ? "" : "115", completed: false }));
  const original = structuredClone(sets);
  const f = fixture([{ id: "leg-press", sets }]);
  for (const invalid of [-1, 1.5, 1, 2, 3]) assert.equal(f.toggle("leg-press", invalid), false);
  assert.equal(f.toggle("missing", 0), false);
  assert.equal(f.writes, 0);
  assert.deepEqual(f.timerStarts, []);

  for (let index = 0; index < 3; index += 1) {
    assert.equal(f.toggle("leg-press", index), true);
    assert.deepEqual(f.exercises[0].sets.map((set) => set.completed), [0, 1, 2].map((i) => i <= index));
  }
  assert.deepEqual(f.timerStarts, [90, 90, 90]);
  const beforeUndo = f.writes;
  assert.equal(f.toggle("leg-press", 0), false);
  assert.equal(f.toggle("leg-press", 1), false);
  assert.equal(f.writes, beforeUndo);
  assert.equal(f.toggle("leg-press", 2), false, "Undo does not start rest");
  assert.deepEqual(f.exercises[0].sets.map((set) => set.completed), [true, true, false]);
  assert.deepEqual(f.timerStarts, [90, 90, 90]);
  assert.equal(f.toggle("leg-press", 2), true);
  assert.deepEqual(f.exercises[0].sets.map(({ completed: _completed, ...set }) => set), original.map(({ completed: _completed, ...set }) => set));
  assert.deepEqual(sets, original, "No mutation of the original prescription");
});

test("grouped rounds keep per-exercise order and rest only after the final exercise", () => {
  const group = { id: "superset", type: "group", groupMode: "superset", rounds: 2, restAfterRound: "75 сек", exerciseIds: ["a", "b"] };
  const f = fixture(group.exerciseIds.map((id, index) => ({
    id, taskBlockId: group.id, taskBlockType: "group", taskBlockConfig: group,
    taskBlockExerciseIndex: index, taskBlockExerciseCount: 2,
    sets: [{ durationSeconds: 30, completed: false }, { durationSeconds: 45, completed: false }]
  })));
  assert.equal(f.toggle("a", 1), false);
  assert.equal(f.writes, 0);
  for (let round = 0; round < 2; round += 1) {
    assert.equal(f.toggle("a", round), false);
    assert.equal(f.toggle("b", round), true);
  }
  assert.deepEqual(f.timerStarts, [75, 75]);
  assert.ok(f.exercises.every((exercise) => exercise.sets.every((set) => set.completed)));
});

test("legacy gaps stay intact and the next missing set remains confirmable", () => {
  const sets = [{ completed: false }, { completed: true }, { completed: false }];
  assert.equal(canToggleWorkoutSetCompleted(sets, 0), true);
  assert.equal(canToggleWorkoutSetCompleted(sets, 2), false);
  assert.equal(canToggleWorkoutSetCompleted(undefined, 0), false);
  assert.deepEqual(sets, [{ completed: false }, { completed: true }, { completed: false }]);
});
