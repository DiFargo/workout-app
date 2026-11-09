import test from "node:test";
import assert from "node:assert/strict";
import { getWorkoutOverviewProgress } from "../src/utils/workoutOverviewProgress.js";

const workout = { id: "day-6", assignedProgramUpdatedAt: "assignment-2", exercises: [
  { id: "one", name: "Первое", sets: [{}, {}] },
  { id: "two", name: "Второе", sets: [{}, {}] },
  { id: "three", name: "Третье", sets: [{}] }
] };
const draft = { workoutId: workout.id, assignmentVersion: "assignment-2", currentExerciseIndex: 2,
  plan: { workouts: [{ ...workout, exercises: [
    { ...workout.exercises[0], sets: [{ completed: true }, { completed: true }] },
    { ...workout.exercises[1], sets: [{ completed: true }, { enteredWeight: 50, enteredReps: 12 }] },
    workout.exercises[2]
  ] }] } };

test("overview shows completed and partial exercises from the persisted runner draft", () => {
  assert.deepEqual(getWorkoutOverviewProgress(workout, draft).map(item => [item.completed, item.fraction]),
    [[true, 1], [false, .5], [false, 0]]);
});
test("a stale assignment or another workout cannot fill progress segments", () => {
  for (const invalid of [{ ...draft, assignmentVersion: "old" }, { ...draft, workoutId: "other" }]) {
    assert.deepEqual(getWorkoutOverviewProgress(workout, invalid).map(item => item.fraction), [0, 0, 0]);
  }
});
test("draft exercise IDs win over array order and ambiguous IDs do not borrow progress", () => {
  const saved = draft.plan.workouts[0];
  const reordered = { ...draft, plan: { workouts: [{ ...saved, exercises: [...saved.exercises].reverse() }] } };
  assert.deepEqual(getWorkoutOverviewProgress(workout, reordered).map(item => item.fraction), [1, .5, 0]);
  const duplicated = { ...draft, plan: { workouts: [{ ...saved, exercises: [saved.exercises[0], saved.exercises[0]] }] } };
  assert.equal(getWorkoutOverviewProgress(workout, duplicated)[0].fraction, 0);
});
test("empty sets and entered values alone are never completed", () => {
  assert.deepEqual(getWorkoutOverviewProgress({ id: "day", exercises: [{ sets: [] }, { sets: [{ enteredReps: 12 }] }] }).map(item => item.completed), [false, false]);
});
