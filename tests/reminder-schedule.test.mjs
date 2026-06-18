import test from "node:test";
import assert from "node:assert/strict";
import {
  getDueProgressReminderTypes,
  getDueReminderOffsets,
  getNextScheduledWorkout,
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
