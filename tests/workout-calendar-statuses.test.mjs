import test from "node:test";
import assert from "node:assert/strict";
import { buildPlannedWorkoutSlots, buildWorkoutScheduleCalendarEntries } from "../src/utils/workoutSchedule.js";
import { getWorkoutCalendarDayStatuses, WORKOUT_CALENDAR_STATUSES } from "../src/features/client/profile/workoutCalendarPresentation.js";

test("saved calendar completion overrides a workout's default planned status", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts: [{ id: "w1", name: "День 1", status: "planned" }],
    calendar: { plannedWorkouts: [{ workoutId: "w1", date: "2026-09-12", status: "completed" }] },
    now: new Date("2026-09-19T12:00:00")
  });
  assert.equal(slots[0].status, "completed");
  assert.deepEqual(buildWorkoutScheduleCalendarEntries(slots).map(entry => entry.status), ["completed"]);
});

test("saved completion date identifies a workout completed on another day", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts: [{ id: "w1", status: "planned" }],
    calendar: { plannedWorkouts: [{ workoutId: "w1", date: "2026-09-12", completedDate: "2026-09-13", status: "completed" }] },
    now: new Date("2026-09-19T12:00:00")
  });
  const entries = buildWorkoutScheduleCalendarEntries(slots);
  assert.equal(entries[0].date, "2026-09-13");
  assert.equal(entries[0].status, "completed_off_date");
});

test("a completion on the workout itself still overrides a stale planned calendar entry", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts: [{ id: "w1", status: "completed", completedAt: "2026-09-13T12:00:00" }],
    calendar: { plannedWorkouts: [{ workoutId: "w1", date: "2026-09-12", status: "planned" }] },
    now: new Date("2026-09-19T12:00:00")
  });
  assert.equal(slots[0].status, "completed_off_date");
});

test("uncompleted past dates and future plans use their real statuses", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts: [{ id: "past", scheduledDate: "2026-09-12" }, { id: "next", scheduledDate: "2026-09-26" }],
    now: new Date("2026-09-19T12:00:00")
  });
  assert.deepEqual(slots.map(slot => slot.status), ["missed", "planned"]);
  const entries = buildWorkoutScheduleCalendarEntries(slots);
  assert.ok(entries.some(entry => entry.status === "shifted"));
  for (const entry of entries) assert.ok(WORKOUT_CALENDAR_STATUSES[entry.status]);
});

test("history on a planned date stays visible without falsely completing another workout", () => {
  const day = { isScheduled: true, scheduleEntries: [{ status: "planned" }], workouts: [{ id: "old" }] };
  assert.deepEqual(getWorkoutCalendarDayStatuses(day), ["historyCompleted", "planned"]);
  assert.deepEqual(getWorkoutCalendarDayStatuses(day, true), ["planned"]);
});

test("original off-date completion dates do not retain a false planned state", () => {
  assert.deepEqual(getWorkoutCalendarDayStatuses({ isScheduled: true, scheduleEntries: [], workouts: [] }), []);
  assert.deepEqual(getWorkoutCalendarDayStatuses({ scheduleEntries: [{ status: "completed" }], workouts: [{ id: "w1" }] }), ["completed"]);
});
