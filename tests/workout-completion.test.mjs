import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompletedWorkoutSet,
  getNextUncompletedWorkoutIndex,
  getWorkoutAssignmentVersion,
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

test("workout assignment version reads the current program update marker", () => {
  assert.equal(getWorkoutAssignmentVersion({ assignedProgramUpdatedAt: " v1 " }), "v1");
  assert.equal(getWorkoutAssignmentVersion({ assignedProgramAt: "legacy" }), "");
  assert.equal(getWorkoutAssignmentVersion(null), "");
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

test("client completion count includes trainer calendar completed statuses", () => {
  const completed = buildCompletedWorkoutSet([
    { workoutId: "day-1", assignedProgramUpdatedAt: "v1" },
    { workoutId: "day-2", assignedProgramUpdatedAt: "v1" }
  ], "v1", {
    assignedProgramUpdatedAt: "v1",
    plannedWorkouts: [
      { workoutId: "day-3", order: 3, status: "completed" },
      { workoutId: "day-4", order: 4, status: "completed" },
      { workoutId: "day-5", order: 5, status: "missed" }
    ]
  });
  const workouts = [
    { id: "day-1", order: 1 },
    { id: "day-2", order: 2 },
    { id: "day-3", order: 3 },
    { id: "day-4", order: 4 },
    { id: "day-5", order: 5 }
  ];

  assert.equal(
    workouts.filter((workout) => isWorkoutCompletedWithSet(workout, completed, "v1")).length,
    4
  );
  assert.equal(getNextUncompletedWorkoutIndex(workouts, completed, "v1"), 4);
});

test("old workout calendar completion statuses do not affect current assignment", () => {
  const completed = buildCompletedWorkoutSet([], "new-assignment", {
    assignedProgramUpdatedAt: "old-assignment",
    plannedWorkouts: [
      { workoutId: "day-1", order: 1, status: "completed" }
    ]
  });

  assert.equal(isWorkoutCompletedWithSet({ id: "day-1", order: 1 }, completed, "new-assignment"), false);
});

test("next uncompleted workout index returns first item when everything is complete", () => {
  assert.equal(
    getNextUncompletedWorkoutIndex([{ id: "day-1", status: "completed" }]),
    0
  );
});
