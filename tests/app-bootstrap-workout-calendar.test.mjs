import test from "node:test";
import assert from "node:assert/strict";

import {
  getBootstrapWorkoutCalendarDates,
  resolveBootstrapWorkoutCalendar
} from "../src/app/appBootstrapHelpers.js";

test("bootstrap workout calendar normalizes scheduled and monthly dates", () => {
  assert.deepEqual(
    getBootstrapWorkoutCalendarDates({
      scheduledDates: ["2026-07-08", "bad-date"],
      monthlyTrainingDates: ["2026-07-06", "2026-07-08"]
    }),
    ["2026-07-06", "2026-07-08"]
  );
});

test("bootstrap workout calendar keeps cached dates when remote calendar is empty", () => {
  const calendar = resolveBootstrapWorkoutCalendar(
    {},
    {
      scheduledDates: ["2026-07-06", "2026-07-08"],
      plannedWorkouts: [{ order: 1, date: "2026-07-06" }],
      updatedAt: "2026-07-01T10:00:00.000Z"
    }
  );

  assert.deepEqual(calendar.scheduledDates, ["2026-07-06", "2026-07-08"]);
  assert.deepEqual(calendar.monthlyTrainingDates, ["2026-07-06", "2026-07-08"]);
  assert.equal(calendar.plannedWorkouts.length, 1);
});

test("bootstrap workout calendar respects a newer explicit remote clear", () => {
  const calendar = resolveBootstrapWorkoutCalendar(
    {
      scheduledDates: [],
      monthlyTrainingDates: [],
      updatedAt: "2026-07-02T10:00:00.000Z"
    },
    {
      scheduledDates: ["2026-07-06"],
      updatedAt: "2026-07-01T10:00:00.000Z"
    }
  );

  assert.deepEqual(calendar.scheduledDates, []);
  assert.deepEqual(calendar.monthlyTrainingDates, []);
});
