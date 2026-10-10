import test from "node:test";
import assert from "node:assert/strict";
import {
  getDueProgressReminderTypes,
  getDueReminderOffsets,
  getNextScheduledWorkout,
  getActivePlanWorkouts,
  getPlannedWorkoutForReminder,
  normalizeReminderOffsets
} from "../functions/reminderSchedule.js";

test("reminder offsets are validated, deduplicated and ordered", () => {
  assert.deepEqual(normalizeReminderOffsets([1, 24, 3, 3, 99]), [24, 3, 1]);
  assert.deepEqual(normalizeReminderOffsets([]), [24]);
});

test("an explicit calendar date overrides the weekly pattern", () => {
  const event = getNextScheduledWorkout({
    scheduledDates: ["2026-06-18"],
    trainingDays: ["tue"],
    workoutTime: "18:30"
  }, new Date("2026-06-15T09:00:00+03:00"));

  assert.equal(event.key, "2026-06-18");
  assert.equal(event.workoutTime, "18:30");
});

test("moving an explicit workout date changes the next reminder event", () => {
  const before = getNextScheduledWorkout({
    scheduledDates: ["2026-06-18"],
    workoutTime: "18:30"
  }, new Date("2026-06-15T09:00:00+03:00"));
  const after = getNextScheduledWorkout({
    scheduledDates: ["2026-06-20"],
    workoutTime: "18:30"
  }, new Date("2026-06-15T09:00:00+03:00"));

  assert.equal(before.key, "2026-06-18");
  assert.equal(after.key, "2026-06-20");
});

test("workout reminder requires a non-completed workout in the explicit plan slot", () => {
  const event = { key: "2026-06-18" };
  const calendar = { plannedWorkouts: [
    { workoutId: "workout-1", date: "2026-06-18", status: "planned" },
    { workoutId: "workout-2", date: "2026-06-20", status: "planned" }
  ] };

  assert.equal(getPlannedWorkoutForReminder(calendar, event)?.workoutId, "workout-1");
  assert.equal(getPlannedWorkoutForReminder(calendar, { key: "2026-06-19" }), null);
  assert.equal(getPlannedWorkoutForReminder({ plannedWorkouts: [
    { workoutId: "workout-1", date: event.key, status: "completed" }
  ] }, event), null);
});

test("legacy calendars without explicit workout slots keep their weekly reminder behavior", () => {
  assert.equal(getPlannedWorkoutForReminder({ scheduledDates: ["2026-06-18"] }, { key: "2026-06-18" }), undefined);
});

test("reminders only see workouts from the active plan, not archived assignments", () => {
  const workouts = [
    { id: "old-1", assignedProgramUpdatedAt: "assignment-old" },
    { id: "new-1", assignedProgramUpdatedAt: "assignment-current" }
  ];
  assert.deepEqual(
    getActivePlanWorkouts(workouts, { assignedProgramUpdatedAt: "assignment-current" }, {}),
    [workouts[1]]
  );
  assert.deepEqual(getActivePlanWorkouts(workouts, { assignedWorkoutCount: 0 }, {}), []);
  assert.deepEqual(
    getActivePlanWorkouts(workouts, { basicWorkoutPlan: { workouts: [{ id: "new-1" }] } }, {}),
    [workouts[1]]
  );
});

test("only the currently due reminder offset is returned", () => {
  const event = { startsAt: new Date("2026-06-16T18:00:00+03:00") };
  const due = getDueReminderOffsets(
    { reminderOffsetsHours: [24, 12, 3, 1] },
    event,
    new Date("2026-06-16T15:00:00+03:00")
  );

  assert.deepEqual(due, [3]);
});

test("progress reminders are due every two weeks at the configured time", () => {
  const due = getDueProgressReminderTypes(
    {
      progressReminderSettings: {
        photoEnabled: true,
        measurementsEnabled: true,
        intervalDays: 14,
        reminderTime: "10:00",
        updatedAt: "2026-06-01T09:00:00.000Z"
      }
    },
    {
      photoDateKey: "2026-06-10",
      measurementDateKey: "2026-06-01"
    },
    new Date("2026-06-15T10:02:00+03:00")
  );

  assert.deepEqual(due.map((item) => item.type), ["measurements"]);
  assert.equal(due[0].dueDateKey, "2026-06-15");
});

test("progress reminders wait for the reminder time window", () => {
  const due = getDueProgressReminderTypes(
    {
      progressReminderSettings: {
        photoEnabled: true,
        intervalDays: 14,
        reminderTime: "10:00",
        updatedAt: "2026-06-01T09:00:00.000Z"
      }
    },
    { photoDateKey: "2026-06-01" },
    new Date("2026-06-15T09:55:00+03:00")
  );

  assert.deepEqual(due, []);
});

test("progress reminders can use separate photo and measurement intervals", () => {
  const due = getDueProgressReminderTypes(
    {
      progressReminderSettings: {
        photoEnabled: true,
        measurementsEnabled: true,
        photoIntervalDays: 7,
        measurementsIntervalDays: 30,
        reminderTime: "10:00",
        updatedAt: "2026-06-01T09:00:00.000Z"
      }
    },
    {
      photoDateKey: "2026-06-08",
      measurementDateKey: "2026-06-01"
    },
    new Date("2026-06-15T10:01:00+03:00")
  );

  assert.deepEqual(due.map((item) => item.type), ["photo"]);
  assert.equal(due[0].intervalDays, 7);
});
