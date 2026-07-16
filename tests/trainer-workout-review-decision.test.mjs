import test from "node:test";
import assert from "node:assert/strict";

import {
  findTrainerWorkoutReviewTarget,
  getTrainerWorkoutReviewReviewedKeys,
  getTrainerWorkoutReviewKey
} from "../src/utils/trainerWorkoutReviewDecision.js";

test("workout review key is stable for the same completed workout", () => {
  const review = {
    assignmentVersion: "assignment-v2",
    historyId: "history-42",
    workoutId: "workout-1",
    workoutName: "Тренировка 1",
    workoutDate: "2026-07-11"
  };

  assert.equal(
    getTrainerWorkoutReviewKey(review),
    getTrainerWorkoutReviewKey({
      assignedProgramUpdatedAt: "assignment-v2",
      clientSaveId: "history-42",
      plannedWorkoutId: "another-workout-id",
      workoutName: "Другое название",
      completedAt: new Date("2026-07-11T12:00:00.000Z")
    })
  );
  assert.notEqual(
    getTrainerWorkoutReviewKey(review),
    getTrainerWorkoutReviewKey({ ...review, workoutDate: "2026-07-12" })
  );
  assert.notEqual(
    getTrainerWorkoutReviewKey(review),
    getTrainerWorkoutReviewKey({ ...review, assignmentVersion: "assignment-v3" })
  );
});

test("reviewed keys include only accepted and adjusted workout decisions", () => {
  const keys = getTrainerWorkoutReviewReviewedKeys([
    {
      type: "workout_review",
      details: JSON.stringify({ reviewKey: "review-accepted", decision: "accepted" })
    },
    {
      type: "workout_review",
      details: { reviewKey: "review-adjusted", decision: "adjusted" }
    },
    {
      type: "workout_review",
      details: JSON.stringify({ reviewKey: "review-pending", decision: "pending" })
    },
    { type: "workout_review", details: "not-json" },
    {
      type: "other_event",
      details: JSON.stringify({ reviewKey: "review-other", decision: "accepted" })
    }
  ]);

  assert.deepEqual([...keys].sort(), ["review-accepted", "review-adjusted"]);
});

test("target finder chooses the nearest future planned workout and skips completed or missed days", () => {
  const workouts = [
    {
      id: "completed",
      name: "Тренировка 1",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-17"
    },
    {
      id: "missed",
      name: "Тренировка 2",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-18",
      status: "missed"
    },
    {
      id: "nearest",
      name: "Тренировка 3",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-19"
    },
    {
      id: "later",
      name: "Тренировка 4",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-22"
    }
  ];

  const target = findTrainerWorkoutReviewTarget({
    workouts,
    calendar: {
      assignedProgramUpdatedAt: "assignment-v2",
      plannedWorkouts: [
        { workoutId: "completed", order: 1, date: "2026-07-17", status: "planned" },
        { workoutId: "missed", order: 2, date: "2026-07-18", status: "missed" },
        { workoutId: "nearest", order: 3, date: "2026-07-19", status: "planned" },
        { workoutId: "later", order: 4, date: "2026-07-22", status: "planned" }
      ]
    },
    history: [{
      workoutId: "completed",
      workoutName: "Тренировка 1",
      assignedProgramUpdatedAt: "assignment-v2",
      date: "2026-07-17"
    }],
    now: new Date("2026-07-16T12:00:00.000Z")
  });

  assert.equal(target, workouts[2]);
});

test("target finder ignores an unfinished planned workout whose date is already in the past", () => {
  const workouts = [
    { id: "past", name: "Прошедшая", scheduledDate: "2026-07-15" },
    { id: "future", name: "Следующая", scheduledDate: "2026-07-20" }
  ];

  const target = findTrainerWorkoutReviewTarget({
    workouts,
    calendar: {
      plannedWorkouts: [
        { workoutId: "past", order: 1, date: "2026-07-15", status: "planned" },
        { workoutId: "future", order: 2, date: "2026-07-20", status: "planned" }
      ]
    },
    now: new Date("2026-07-16T12:00:00.000Z")
  });

  assert.equal(target, workouts[1]);
});
