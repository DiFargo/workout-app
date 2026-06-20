import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompletedWorkoutSet,
  getNextUncompletedWorkoutIndex,
  isWorkoutCompletedWithSet
} from "../src/utils/workoutCompletion.js";

test("workout completion set respects current assignment version", () => {
  const completed = buildCompletedWorkoutSet([
    { workoutId: "day-1", workoutName: "Old name", assignedProgramUpdatedAt: "v1" },
    { workoutId: "day-2", workoutName: "Other", assignedProgramUpdatedAt: "old" }
  ], "v1");

  assert.equal(isWorkoutCompletedWithSet({ id: "day-1" }, completed, "v1"), true);
  assert.equal(isWorkoutCompletedWithSet({ id: "day-2" }, completed, "v1"), false);
});

test("next uncompleted workout index skips completed and manual completed days", () => {
  const completed = buildCompletedWorkoutSet([
    { workoutId: "day-1", assignedProgramUpdatedAt: "v1" }
  ], "v1");
  const workouts = [
    { id: "day-1" },
    { id: "day-2", status: "completed" },
    { id: "day-3" }
  ];

  assert.equal(getNextUncompletedWorkoutIndex(workouts, completed, "v1"), 2);
});

test("next uncompleted workout index returns first item when everything is complete", () => {
  assert.equal(
    getNextUncompletedWorkoutIndex([{ id: "day-1", status: "completed" }]),
    0
  );
});
