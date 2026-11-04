import assert from "node:assert/strict";
import test from "node:test";
import { getSubscriptionScheduleRange } from "../src/utils/subscriptionScheduleRange.js";

const assignment = "2026-10-17T10:00:00Z";
const workouts = ["a", "b"].map(id => ({ id, assignedProgramAddedAt: assignment, assignedProgramUpdatedAt: "queue-v2" }));
const slot = (id, date, extra = {}) => ({ workoutId: id, assignedProgramAddedAt: assignment, assignedProgramUpdatedAt: "queue-v2", date, ...extra });

test("range is sorted, unique and scoped to the selected assignment, not the shared queue version", () => {
  const calendar = { assignedProgramUpdatedAt: "queue-v2", scheduledDates: ["2025-01-01", "2027-12-31"], plannedWorkouts: [
    slot("a", "2026-10-19"), slot("b", "2026-10-23"),
    slot("foreign", "2027-12-31"), slot("a", "2025-01-01", { assignedProgramAddedAt: "other-assignment" })
  ] };
  assert.deepEqual(getSubscriptionScheduleRange({ workouts, calendar }), {
    startDate: "2026-10-19", endDate: "2026-10-23", dates: ["2026-10-19", "2026-10-23"]
  });
});

test("an explicit move replaces the old endpoint and ignores history and stale subscription dates", () => {
  const input = { workouts, calendar: { plannedWorkouts: [slot("a", "2026-10-19"), slot("b", "2026-10-23", { movedToDate: "2026-10-29" })] },
    subscription: { startDate: "2020-01-01", endDate: "2030-01-01" }, history: [{ date: "2035-01-01" }] };
  const before = structuredClone(input);
  assert.deepEqual(getSubscriptionScheduleRange(input), {
    startDate: "2026-10-19", endDate: "2026-10-29", dates: ["2026-10-19", "2026-10-29"]
  });
  assert.deepEqual(input, before);
});

test("841 workout-identity date pins survive nonchronological workout order", () => {
  assert.deepEqual(getSubscriptionScheduleRange({ workouts, calendar: { plannedWorkouts: [
    slot("a", "2026-10-25", { dateOrderPolicy: "workout_identity" }),
    slot("b", "2026-10-19", { dateOrderPolicy: "workout_identity" })
  ] } }), { startDate: "2026-10-19", endDate: "2026-10-25", dates: ["2026-10-19", "2026-10-25"] });
});

test("workout dates supply real dates when there are no calendar slots", () => {
  assert.deepEqual(getSubscriptionScheduleRange({ workouts: [
    { ...workouts[0], scheduledDate: "2026-10-19" }, { ...workouts[1], plannedDate: "2026-10-23" }
  ] }), { startDate: "2026-10-19", endDate: "2026-10-23", dates: ["2026-10-19", "2026-10-23"] });
});

test("real nonchronological workout dates are not replaced by normalization proposals", () => {
  assert.deepEqual(getSubscriptionScheduleRange({ workouts: [
    { ...workouts[0], scheduledDate: "2026-10-25" }, { ...workouts[1], plannedDate: "2026-10-19" }
  ] }), { startDate: "2026-10-19", endDate: "2026-10-25", dates: ["2026-10-19", "2026-10-25"] });
});

test("archived calendar entries cannot hide a selected workout's real saved date", () => {
  assert.deepEqual(getSubscriptionScheduleRange({
    workouts: [{ ...workouts[0], scheduledDate: "2026-10-19" }],
    calendar: { plannedWorkouts: [slot("a", "2030-01-01", { assignedProgramVisibility: "client_archived" })] }
  }), { startDate: "2026-10-19", endDate: "2026-10-19", dates: ["2026-10-19"] });
});

test("missed workouts do not invent a future range endpoint", () => {
  assert.deepEqual(getSubscriptionScheduleRange({ workouts: [{ id: "a", scheduledDate: "2020-01-01", status: "missed" }] }), {
    startDate: "2020-01-01", endDate: "2020-01-01", dates: ["2020-01-01"]
  });
});

test("date normalization cannot add synthetic dates when saved dates collide", () => {
  assert.deepEqual(getSubscriptionScheduleRange({ workouts, calendar: { plannedWorkouts: [slot("a", "2026-10-19"), slot("b", "2026-10-19")] } }), {
    startDate: "2026-10-19", endDate: "2026-10-19", dates: ["2026-10-19"]
  });
});

for (const archive of [{ archived: true }, { assignedProgramLifecycleStatus: "archived" }, { assignedProgramVisibility: "client_archived" }, { assignedProgramVisibility: "trainer_archived" }]) {
  test(`archived workouts cannot extend the range: ${JSON.stringify(archive)}`, () => {
    assert.deepEqual(getSubscriptionScheduleRange({ workouts: [
      { ...workouts[0], scheduledDate: "2026-10-19" }, { ...workouts[1], scheduledDate: "2030-01-01", ...archive }
    ] }), { startDate: "2026-10-19", endDate: "2026-10-19", dates: ["2026-10-19"] });
  });
}

test("empty, unrelated or unscheduled scope has no range or subscription fallback", () => {
  for (const input of [undefined, {}, { workouts, calendar: {} }, { workouts: [], calendar: { scheduledDates: ["2026-10-19"] } },
    { workouts, calendar: { assignedProgramUpdatedAt: "foreign", scheduledDates: ["2026-10-19"] } },
    { workouts, calendar: { plannedWorkouts: [slot("foreign", "2026-10-19")] } }]) {
    assert.deepEqual(getSubscriptionScheduleRange(input), { startDate: "", endDate: "", dates: [] });
  }
});

test("root-only legacy dates are used only inside the matching scope", () => {
  assert.deepEqual(getSubscriptionScheduleRange({ workouts, calendar: { assignedProgramUpdatedAt: "queue-v2", scheduledDates: ["2026-10-19", "2026-10-23"] } }), {
    startDate: "2026-10-19", endDate: "2026-10-23", dates: ["2026-10-19", "2026-10-23"]
  });
});
