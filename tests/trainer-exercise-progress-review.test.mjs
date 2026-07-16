import test from "node:test";
import assert from "node:assert/strict";

import {
  findTrainerExerciseProgressTarget,
  getTrainerExerciseProgressReviewedKeys,
  getTrainerExerciseProgressReviewKey,
  patchTrainerExerciseProgressTarget
} from "../src/utils/trainerExerciseProgressReview.js";

function makeProgressItem(overrides = {}) {
  return {
    name: "Жим ногами",
    status: "regression",
    previous: {
      date: new Date("2026-06-16T08:00:00.000Z"),
      programId: "program-1",
      e1rm: 110,
      volume: 3300,
      totalReps: 36,
      bestWeight: 90,
      sets: 3
    },
    current: {
      date: new Date("2026-07-07T08:00:00.000Z"),
      programId: "program-1",
      e1rm: 98,
      volume: 2880,
      totalReps: 36,
      bestWeight: 80,
      sets: 3
    },
    ...overrides
  };
}

test("exercise progress review key is stable and reopens for a new comparison", () => {
  const item = makeProgressItem();
  const sameItem = makeProgressItem({
    previous: { ...item.previous, date: "2026-06-16" },
    current: { ...item.current, date: "2026-07-07" }
  });

  assert.equal(
    getTrainerExerciseProgressReviewKey(item),
    getTrainerExerciseProgressReviewKey(sameItem)
  );
  assert.notEqual(
    getTrainerExerciseProgressReviewKey(item),
    getTrainerExerciseProgressReviewKey(makeProgressItem({
      current: { ...item.current, date: "2026-07-14" }
    }))
  );
  assert.notEqual(
    getTrainerExerciseProgressReviewKey(item),
    getTrainerExerciseProgressReviewKey(makeProgressItem({
      current: { ...item.current, volume: 3000 }
    }))
  );
});

test("reviewed keys include only accepted or adjusted trainer decisions", () => {
  const keys = getTrainerExerciseProgressReviewedKeys([
    {
      type: "exercise_progress_review",
      details: JSON.stringify({ reviewKey: "review-accepted", resolution: "accepted" })
    },
    {
      type: "exerciseProgressReview",
      reviewKey: "review-adjusted",
      resolution: "adjusted"
    },
    {
      type: "exercise_progress_review",
      details: JSON.stringify({ reviewKey: "review-production", decision: "accepted" })
    },
    {
      type: "exerciseProgressReview",
      details: { reviewKey: "review-pending", resolution: "pending" }
    },
    { type: "exerciseProgressReview", details: "not-json" },
    { type: "other_event", reviewKey: "review-other", resolution: "accepted" }
  ]);

  assert.deepEqual([...keys].sort(), ["review-accepted", "review-adjusted", "review-production"]);
});

test("target finder skips completed, missed and old assignments and prefers nearest moved workout", () => {
  const workouts = [
    {
      id: "old",
      name: "Old assignment",
      assignedProgramUpdatedAt: "assignment-v1",
      scheduledDate: "2026-07-17",
      exercises: [{ id: "old-leg-press", name: "Жим ногами", sets: [] }]
    },
    {
      id: "completed",
      name: "Completed",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-18",
      exercises: [{ id: "completed-leg-press", name: "Жим ногами", sets: [] }]
    },
    {
      id: "missed",
      name: "Missed",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-19",
      status: "missed",
      exercises: [{ id: "missed-leg-press", name: "Жим ногами", sets: [] }]
    },
    {
      id: "planned",
      name: "Planned",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-21",
      exercises: [{ id: "planned-leg-press", name: "Жим ногами", sets: [] }]
    },
    {
      id: "moved",
      name: "Moved",
      assignedProgramUpdatedAt: "assignment-v2",
      scheduledDate: "2026-07-15",
      movedToDate: "2026-07-20",
      status: "moved",
      exercises: [{ id: "moved-leg-press", name: " ЖИМ   ногами ", sets: [] }]
    },
    {
      id: "undated",
      name: "Undated",
      assignedProgramUpdatedAt: "assignment-v2",
      exercises: [{ id: "undated-leg-press", name: "Жим ногами", sets: [] }]
    }
  ];
  const target = findTrainerExerciseProgressTarget({
    workouts,
    history: [{
      workoutId: "completed",
      workoutName: "Completed",
      assignedProgramUpdatedAt: "assignment-v2",
      date: "2026-07-18"
    }],
    workoutCalendar: {
      assignedProgramUpdatedAt: "assignment-v2",
      plannedWorkouts: [
        { workoutId: "completed", order: 2, date: "2026-07-18", status: "completed" },
        { workoutId: "missed", order: 3, date: "2026-07-19", status: "missed" },
        { workoutId: "planned", order: 4, date: "2026-07-21", status: "planned" },
        { workoutId: "moved", order: 5, date: "2026-07-15", status: "moved", movedToDate: "2026-07-20" }
      ]
    },
    item: makeProgressItem(),
    now: new Date("2026-07-16T12:00:00.000Z")
  });

  assert.equal(target?.workoutId, "moved");
  assert.equal(target?.exerciseId, "moved-leg-press");
  assert.equal(target?.date, "2026-07-20");
});

test("target finder uses an undated unfinished workout only after dated candidates", () => {
  const target = findTrainerExerciseProgressTarget({
    workouts: [
      {
        id: "past",
        assignedProgramUpdatedAt: "assignment-v2",
        scheduledDate: "2026-07-10",
        exercises: [{ id: "past-row", name: "Тяга", sets: [] }]
      },
      {
        id: "undated",
        assignedProgramUpdatedAt: "assignment-v2",
        exercises: [{ id: "undated-row", name: "Тяга", sets: [] }]
      }
    ],
    workoutCalendar: { assignedProgramUpdatedAt: "assignment-v2" },
    item: { name: "Тяга", current: {}, previous: {} },
    now: new Date("2026-07-16T12:00:00.000Z")
  });

  assert.equal(target?.workoutId, "undated");
  assert.equal(target?.date, "");
});

test("exercise progress patch changes only the selected exercise sets and rest", () => {
  const workouts = [
    {
      id: "day-1",
      exercises: [
        { id: "leg-press", name: "Жим ногами", rest: "90 сек", notes: "keep", sets: [{ reps: 12, weight: 80 }] },
        { id: "row", name: "Тяга", rest: "60 сек", sets: [{ reps: 10, weight: 40 }] }
      ]
    },
    {
      id: "day-2",
      exercises: [{ id: "curl", name: "Сгибание", sets: [{ reps: 12, weight: 12 }] }]
    }
  ];
  const original = structuredClone(workouts);
  const next = patchTrainerExerciseProgressTarget(workouts, {
    workoutId: "day-1",
    exerciseId: "leg-press",
    workoutIndex: 0,
    exerciseIndex: 0
  }, {
    sets: [{ reps: 10, weight: 75 }],
    rest: "120 сек",
    name: "must not replace the exercise"
  });

  assert.deepEqual(workouts, original);
  assert.notEqual(next, workouts);
  assert.notEqual(next[0], workouts[0]);
  assert.notEqual(next[0].exercises[0], workouts[0].exercises[0]);
  assert.equal(next[0].exercises[1], workouts[0].exercises[1]);
  assert.equal(next[1], workouts[1]);
  assert.deepEqual(next[0].exercises[0].sets, [{ reps: 10, weight: 75 }]);
  assert.equal(next[0].exercises[0].rest, "120 сек");
  assert.equal(next[0].exercises[0].name, "Жим ногами");
  assert.equal(next[0].exercises[0].notes, "keep");
});
