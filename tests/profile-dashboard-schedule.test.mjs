import test from "node:test";
import assert from "node:assert/strict";

import {
  getProfileDashboardScheduleDates,
  getProfileMeasurementTrendPeriodLabel,
  getProfileWeightCheckInState
} from "../src/features/client/profile/profileDashboardModel.js";

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
