import test from "node:test";
import assert from "node:assert/strict";

import {
  getProfileDashboardScheduleDates,
  getProfileMeasurementTrendPeriodLabel,
  getTimeOfDayGreeting,
  getProfileWeightCheckInState,
  getProfileWorkoutStatusDateKey
} from "../src/features/client/profile/profileDashboardModel.js";
import { buildPlannedWorkoutSlots } from "../src/utils/workoutSchedule.js";

test("missed workout message uses the missed date, not its suggested future move", () => {
  const dates = ["2026-08-26", "2026-08-29", "2026-09-02", "2026-09-05", "2026-09-09", "2026-09-12", "2026-09-16", "2026-09-19"];
  const slots = buildPlannedWorkoutSlots({
    workouts: dates.map((scheduledDate, index) => ({ id: `day-${index}`, scheduledDate })),
    now: new Date("2026-09-10T12:00:00")
  });
  assert.equal(slots.filter(slot => slot.isMissed).length, 5);
  assert.equal(slots[0].shiftedDate, "2026-09-21");
  assert.equal(getProfileWorkoutStatusDateKey(slots[0]), "2026-08-26");
  assert.equal(getProfileWorkoutStatusDateKey(slots[5]), "2026-09-12");
  assert.equal(getProfileWorkoutStatusDateKey({ isMissed: false, shiftedDate: "2026-09-22", plannedDate: "2026-09-10" }), "2026-09-22");
  assert.equal(getProfileWorkoutStatusDateKey(null), "");
});

test("profile dashboard greeting follows the user's local time", () => {
  const atHour = (hour) => new Date(2026, 8, 1, hour, 0, 0);

  assert.equal(getTimeOfDayGreeting(atHour(4)), "Доброй ночи");
  assert.equal(getTimeOfDayGreeting(atHour(5)), "Доброе утро");
  assert.equal(getTimeOfDayGreeting(atHour(11)), "Доброе утро");
  assert.equal(getTimeOfDayGreeting(atHour(12)), "Добрый день");
  assert.equal(getTimeOfDayGreeting(atHour(18)), "Добрый вечер");
  assert.equal(getTimeOfDayGreeting(atHour(23)), "Доброй ночи");
});

test("profile dashboard schedule prefers saved calendar dates", () => {
  assert.deepEqual(
    getProfileDashboardScheduleDates(
      ["2026-07-08"],
      [{ scheduledDate: "2026-07-06" }]
    ),
    ["2026-07-08"]
  );
});

test("profile dashboard schedule falls back to assigned workout dates", () => {
  assert.deepEqual(
    getProfileDashboardScheduleDates(
      [],
      [
        { scheduledDate: "2026-07-08" },
        { plannedDate: "2026-07-06" },
        { scheduledDate: "bad-date" }
      ]
    ),
    ["2026-07-06", "2026-07-08"]
  );
});

test("profile dashboard weight trend uses the actual interval instead of assuming a week", () => {
  const day = 24 * 60 * 60 * 1000;

  assert.equal(getProfileMeasurementTrendPeriodLabel(10 * day, 3 * day), "за 7 дней");
  assert.equal(getProfileMeasurementTrendPeriodLabel(12 * day, 11 * day), "за 1 день");
  assert.equal(getProfileMeasurementTrendPeriodLabel(0, 0), "с прошлого замера");
  assert.equal(getProfileMeasurementTrendPeriodLabel(Number.NaN, 0), "с прошлого замера");
});

test("weight check-in is due weekly and full body measurements reset the same schedule", () => {
  const day = 24 * 60 * 60 * 1000;
  const latestMeasurement = { weight: "83.2", date: new Date(10 * day).toISOString() };

  assert.equal(getProfileWeightCheckInState([], { now: new Date(10 * day) }).isDue, true);
  assert.equal(getProfileWeightCheckInState([latestMeasurement], { now: new Date(16 * day) }).isDue, false);
  assert.equal(getProfileWeightCheckInState([latestMeasurement], { now: new Date(17 * day) }).isDue, true);
  assert.equal(getProfileWeightCheckInState([latestMeasurement], { now: new Date(18 * day) }).isOverdue, true);
});
