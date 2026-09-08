import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompletedWorkoutSet,
  getCurrentAssignmentHistoryItems,
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

test("completion from the same durable assignment survives a changed queue version", () => {
  const workouts = [
    { id: "day-1", assignedProgramId: "program-1", assignedProgramAddedAt: "assignment-1" },
    { id: "day-2", assignedProgramId: "program-1", assignedProgramAddedAt: "assignment-1" },
    { id: "day-3", assignedProgramId: "program-1", assignedProgramAddedAt: "assignment-1" }
  ];
  const completed = buildCompletedWorkoutSet([
    {
      workoutId: "day-1",
      assignedProgramId: "program-1",
      assignedProgramAddedAt: "assignment-1",
      assignedProgramUpdatedAt: "older-queue-version"
    },
    {
      workoutId: "day-2",
      assignedProgramId: "program-1",
      assignedProgramAddedAt: "assignment-1",
      assignmentVersion: "older-queue-version"
    }
  ], "current-queue-version", {}, workouts);

  assert.equal(getNextUncompletedWorkoutIndex(workouts, completed, "current-queue-version"), 2);
});

test("history modal keeps completions from the same durable assignment", () => {
  const workouts = [
    { id: "day-1", assignedProgramId: "program-1", assignedProgramAddedAt: "assignment-1" },
    { id: "day-2", assignedProgramId: "program-1", assignedProgramAddedAt: "assignment-1" }
  ];
  const currentHistory = getCurrentAssignmentHistoryItems([
    {
      workoutId: "day-1",
      assignedProgramId: "program-1",
      assignedProgramAddedAt: "assignment-1",
      assignedProgramUpdatedAt: "older-queue-version"
    },
    {
      workoutId: "day-2",
      assignedProgramId: "program-1",
      assignedProgramAddedAt: "old-assignment",
      assignedProgramUpdatedAt: "older-queue-version"
    }
  ], "current-queue-version", workouts);

  assert.deepEqual(currentHistory.map((item) => item.workoutId), ["day-1"]);
});

test("completion from an older assignment with the same workout id is ignored", () => {
  const workouts = [
    { id: "day-1", assignedProgramId: "program-1", assignedProgramAddedAt: "new-assignment" }
  ];
  const completed = buildCompletedWorkoutSet([
    {
      workoutId: "day-1",
      assignedProgramId: "program-1",
      assignedProgramAddedAt: "old-assignment",
      assignedProgramUpdatedAt: "old-version"
    }
  ], "new-version", {}, workouts);

  assert.equal(isWorkoutCompletedWithSet(workouts[0], completed, "new-version"), false);
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
