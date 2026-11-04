import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProfileDashboardTasks,
  getProfileBodyMeasurementCheckInState
} from "../src/features/client/profile/profileDashboardTasks.js";
import { getProfileOverviewMeasurements } from "../src/utils/profileOverviewMeasurements.js";

const now = new Date(2026, 9, 30, 18, 30);
const body = (id, date, extra = {}) => ({ id, date, measurementType: "body_measurement", weight: "93", neck: "39", ...extra });
const dayAgo = days => new Date(2026, 9, 30 - days, 12);
const state = (measurements, intervalDays = 14) => getProfileBodyMeasurementCheckInState(measurements, { now, intervalDays });

for (const intervalDays of [7, 14, 30]) {
  test(`body reminder follows the configured ${intervalDays}-day local-calendar boundary`, () => {
    const fresh = state([body("fresh", dayAgo(intervalDays - 1))], intervalDays);
    const due = state([body("due", dayAgo(intervalDays))], intervalDays);
    const overdue = state([body("overdue", dayAgo(intervalDays + 1))], intervalDays);
    assert.equal(fresh.isDue, false);
    assert.equal(fresh.daysSinceLastMeasurement, intervalDays - 1);
    assert.equal(due.isDue, true);
    assert.equal(due.isOverdue, false);
    assert.equal(due.daysSinceLastMeasurement, intervalDays);
    assert.equal(overdue.isDue, true);
    assert.equal(overdue.isOverdue, true);
    assert.equal(overdue.daysSinceLastMeasurement, intervalDays + 1);
  });
}

test("fresh quick weight and legacy weight-only entries do not reset body measurements", () => {
  const actualBody = body("body", dayAgo(59));
  const measurements = [
    { id: "quick", date: dayAgo(0), weight: "93", neck: "39", measurementType: "weight_checkin" },
    { id: "legacy-weight", date: dayAgo(1), weight: "93" },
    { id: "nested-weight", date: dayAgo(2), values: { weight: "93" } },
    actualBody
  ];
  const result = state(measurements);
  assert.equal(result.latestMeasurement, actualBody);
  assert.equal(result.daysSinceLastMeasurement, 59);
  assert.equal(result.isDue, true);
  assert.equal(result.isFirst, false);
  assert.equal(state(measurements.slice(0, 3)).isFirst, true);
});

test("legacy circumferences count as body records, including nested comma-decimal values", () => {
  const legacy = { id: "legacy-body", date: dayAgo(14), values: { waist: "88,5", weight: "93" } };
  const result = state([legacy]);
  assert.equal(result.latestMeasurement, legacy);
  assert.equal(result.daysSinceLastMeasurement, 14);
  assert.equal(result.isDue, true);
  assert.equal(result.isFirst, false);
});

test("body check-in supports ISO, date-only, Firestore and toDate timestamps", () => {
  const date = dayAgo(14);
  const localDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  for (const [name, value] of [
    ["Date", date],
    ["ISO", date.toISOString()],
    ["date-only", localDateKey],
    ["seconds", { seconds: date.getTime() / 1000, nanoseconds: 0 }],
    ["private seconds", { _seconds: date.getTime() / 1000, _nanoseconds: 0 }],
    ["toMillis", { toMillis: () => date.getTime() }],
    ["toDate", { toDate: () => date }]
  ]) {
    const result = state([body(name, value)]);
    assert.equal(result.daysSinceLastMeasurement, 14, name);
    assert.equal(result.isDue, true, name);
    assert.equal(result.isFirst, false, name);
  }
  assert.equal(state([body("created", undefined, { createdAt: date.toISOString() })]).daysSinceLastMeasurement, 14);
  assert.equal(state([body("saved", undefined, { savedAt: date.toISOString() })]).daysSinceLastMeasurement, 14);
});

test("invalid and future records do not conceal the latest real body measurement", () => {
  const actualBody = body("real", dayAgo(20));
  const source = Object.freeze([
    Object.freeze(body("future", dayAgo(-1))),
    Object.freeze(body("invalid", "not-a-date")),
    Object.freeze(body("invalid-calendar-day", "2026-02-31")),
    Object.freeze(body("missing", "")),
    Object.freeze(actualBody)
  ]);
  const result = state(source);
  assert.equal(result.latestMeasurement, actualBody);
  assert.equal(result.daysSinceLastMeasurement, 20);
  assert.equal(result.isDue, true);
  assert.equal(state(source.slice(0, 4)).isFirst, true);
  assert.equal(getProfileBodyMeasurementCheckInState(source, { now: new Date("invalid") }).isDue, false);
  assert.equal(state(null).isFirst, true);
});

test("lightweight overview preserves an older latestBody outside the seven most recent weights", () => {
  const latestBody = body("body-old", dayAgo(59));
  const recent7 = Array.from({ length: 7 }, (_, index) => ({
    id: `weight-${index}`, date: dayAgo(index), measurementType: "weight_checkin", weight: "93"
  }));
  const snapshot = { kind: "measurements", coverage: { measurements: "complete" },
    measurements: { latestBody, latestWeight: recent7[0], recent7 } };
  const overview = getProfileOverviewMeasurements(snapshot, []);
  assert.equal(overview.length, 8);
  assert.equal(state(overview).latestMeasurement, latestBody);
  assert.equal(state(overview).daysSinceLastMeasurement, 59);

  const newBody = body("body-new", dayAgo(0));
  const afterLocalSave = getProfileOverviewMeasurements(snapshot, [newBody]);
  assert.equal(state(afterLocalSave).latestMeasurement, newBody);
  assert.equal(state(afterLocalSave).isDue, false);
  assert.equal(snapshot.measurements.latestBody, latestBody);
});

test("body reminder appears only when enabled, ready and due", () => {
  const due = { ...state([body("old", dayAgo(20))]), enabled: true, ready: true };
  const tasks = buildProfileDashboardTasks({ measurementsCheckIn: due });
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks.map(item => item.id), ["measurements"]);
  assert.equal(tasks[0].title, "Обновить замеры тела");
  assert.match(tasks[0].note, /20 дней назад/);
  assert.equal(tasks[0].actionLabel, "Открыть замеры тела");
  for (const patch of [{ enabled: false }, { ready: false }, { isDue: false }]) {
    assert.deepEqual(buildProfileDashboardTasks({ measurementsCheckIn: { ...due, ...patch } }), []);
  }
  const first = buildProfileDashboardTasks({ measurementsCheckIn: { ...state([]), enabled: true, ready: true } });
  assert.equal(first[0].title, "Добавьте первые замеры");
  assert.match(first[0].note, /объёмы тела/);
  assert.deepEqual(buildProfileDashboardTasks({ measurementsCheckIn: { ...state([]), enabled: true, ready: false } }), []);
});

test("body reminders stay separate from weight and photos in the existing task priority", () => {
  const tasks = buildProfileDashboardTasks({
    workoutState: "ready", workoutScheduleStatus: "today", workoutTitle: "Тренировка 1",
    weightCheckIn: { enabled: true, isDue: true, isFirst: false },
    measurementsCheckIn: { ...state([body("old", dayAgo(14))]), enabled: true, ready: true },
    progressPhotoCheckIn: { enabled: true, isDue: true, isFirst: false, daysSinceLastPhoto: 14 }
  });
  assert.deepEqual(tasks.map(item => item.id), ["workout", "weight", "measurements", "photos"]);
  assert.equal(tasks[2].kind, "measurements");
  const afterWeight = buildProfileDashboardTasks({
    workoutState: "ready", workoutScheduleStatus: "upcoming",
    weightCheckIn: { enabled: true, isDue: false },
    measurementsCheckIn: { ...state([body("old", dayAgo(14))]), enabled: true, ready: true },
    progressPhotoCheckIn: { enabled: true, isDue: false }
  });
  assert.deepEqual(afterWeight.map(item => item.id), ["measurements"]);
});
