import test from "node:test";
import assert from "node:assert/strict";
import { getProfileCalendarDraft, saveProfileCalendarDraft, mergeProfileCalendarDraft } from "../src/features/client/profile/profileCalendarDraft.js";
import { buildPlannedWorkoutSlots, getWorkoutScheduleCalendarForWorkouts } from "../src/utils/workoutSchedule.js";

function fixture() {
  const slots = Array.from({ length: 8 }, (_, index) => ({
    workoutId: `day-${index + 1}`, workoutName: `Тренировка ${index + 1}`, order: index + 1,
    plannedDate: `2026-11-${String(index * 2 + 1).padStart(2, "0")}`,
    completedDate: index < 5 ? `2026-10-${21 + index}` : "",
    isCompleted: index < 5, isCompletedOffDate: index < 5,
    status: index < 5 ? "completed_off_date" : "planned"
  }));
  const calendar = { plannedWorkouts: slots.map(slot => ({
    workoutId: slot.workoutId, order: slot.order, date: slot.plannedDate,
    status: "planned", dateOrderPolicy: "workout_identity", assignment: "original"
  })) };
  return { slots, calendar };
}

test("five completed workouts leave three editable dates and unique identity-based badges", () => {
  const { slots } = fixture();
  const draft = getProfileCalendarDraft(slots);
  assert.equal(draft.completedCount, 5);
  assert.equal(draft.requiredCount, 3);
  assert.equal(draft.entries.length, 8);
  assert.equal(new Set(draft.entries.map(entry => entry.workoutId)).size, 8);
  assert.deepEqual(draft.entries.filter(entry => entry.status === "planned").map(entry => entry.order), [6, 7, 8]);
  assert.ok(draft.entries.filter(entry => entry.status === "completed_off_date").every(entry => entry.date.startsWith("2026-10-")));
});

test("moving remaining dates cannot redate completed workouts or unrelated assignments", () => {
  const { slots, calendar } = fixture();
  calendar.plannedWorkouts.push({ workoutId: "foreign", date: "2026-12-25", status: "completed" });
  const before = structuredClone(calendar);
  const next = saveProfileCalendarDraft(calendar, slots, ["2026-11-28", "2026-11-20", "2026-11-24"], new Date("2026-11-08T12:00:00"));
  assert.deepEqual(calendar, before);
  assert.deepEqual(next.plannedWorkouts.slice(0, 5), before.plannedWorkouts.slice(0, 5));
  assert.deepEqual(next.plannedWorkouts.at(-1), before.plannedWorkouts.at(-1));
  assert.deepEqual(next.plannedWorkouts.slice(5, 8).map(entry => [entry.workoutId, entry.date]), [
    ["day-6", "2026-11-20"], ["day-7", "2026-11-24"], ["day-8", "2026-11-28"]
  ]);
});

test("missing/duplicate dates, a stale assignment, and a new past date are rejected", () => {
  const { slots, calendar } = fixture();
  const now = new Date("2026-11-08T12:00:00");
  for (const values of [["2026-11-20"], ["2026-11-20", "2026-11-20", "2026-11-24"]]) {
    assert.throws(() => saveProfileCalendarDraft(calendar, slots, values, now), /date-count/);
  }
  assert.throws(() => saveProfileCalendarDraft(calendar, slots, ["2026-10-01", "2026-11-20", "2026-11-24"], now), /past-date/);
  assert.throws(() => saveProfileCalendarDraft({ plannedWorkouts: calendar.plannedWorkouts.slice(0, 6) }, slots,
    ["2026-11-20", "2026-11-24", "2026-11-28"], now), /stale-assignment/);
});

test("reordered Firestore keys, array order and queue metadata do not block three remaining dates", () => {
  const { slots, calendar } = fixture();
  const current = { ...calendar, assignedProgramUpdatedAt: "queue-new", reminderSettings: { enabled: true },
    plannedWorkouts: calendar.plannedWorkouts.map(entry => ({ ...Object.fromEntries(Object.entries(entry).reverse()), statusUpdatedAt: "background-refresh" })).reverse() };
  assert.notEqual(JSON.stringify(current.plannedWorkouts), JSON.stringify(calendar.plannedWorkouts));
  const next = mergeProfileCalendarDraft(current, calendar, slots, ["2026-11-11", "2026-11-14", "2026-11-18"], new Date("2026-11-08"));
  assert.deepEqual(slots.filter(slot => !slot.isCompleted).map(slot => next.plannedWorkouts.find(entry => entry.workoutId === slot.workoutId).date),
    ["2026-11-11", "2026-11-14", "2026-11-18"]);
  assert.equal(next.assignedProgramUpdatedAt, "queue-new");
  assert.deepEqual(next.reminderSettings, { enabled: true });
  assert.deepEqual(next.plannedWorkouts.filter(entry => Number(entry.order) <= 5), current.plannedWorkouts.filter(entry => Number(entry.order) <= 5));
});

test("a genuine trainer date change or new completion is never overwritten and input stays intact", () => {
  const { slots, calendar } = fixture();
  const chosen = ["2026-11-20", "2026-11-24", "2026-11-28"];
  for (const patch of [{ date: "2026-11-22" }, { status: "completed" }, { completedDate: "2026-11-09" },
    { assignedProgramAddedAt: "new-assignment" }, { order: 8 }]) {
    const current = structuredClone(calendar);
    Object.assign(current.plannedWorkouts[5], patch);
    const before = JSON.stringify({ current, calendar, chosen });
    assert.throws(() => mergeProfileCalendarDraft(current, calendar, slots, chosen, new Date("2026-11-08")), /stale-assignment/);
    assert.equal(JSON.stringify({ current, calendar, chosen }), before);
  }
});

test("an already committed identical date change can be retried without a false conflict", () => {
  const { slots, calendar } = fixture();
  const chosen = ["2026-11-20", "2026-11-24", "2026-11-28"];
  const committed = saveProfileCalendarDraft(calendar, slots, chosen, new Date("2026-11-08"));
  assert.deepEqual(mergeProfileCalendarDraft(committed, calendar, slots, chosen, new Date("2026-11-08")), committed);
});

test("11/14/18 survive save, repeated normalization and full reload with obsolete completed plan dates", () => {
  const previousDates = ["2026-11-04", "2026-11-07", "2026-11-11", "2026-10-31", "2026-11-14", "2026-11-18", "2026-11-21", "2026-11-25"];
  const completedDates = ["2026-10-21", "2026-10-24", "2026-10-28", "2026-10-31", "2026-11-04"];
  const workouts = previousDates.map((scheduledDate, index) => ({ id: `day-${index + 1}`, name: `Тренировка ${index + 1}`, scheduledDate, order: index + 1 }));
  const calendar = { plannedWorkouts: workouts.map((workout, index) => ({ workoutId: workout.id,
    workoutName: workout.name, order: index + 1, date: previousDates[index], status: "planned", dateOrderPolicy: "workout_identity" })) };
  const history = completedDates.map((date, index) => ({ workoutId: workouts[index].id, workoutName: workouts[index].name, date }));
  const now = new Date("2026-11-08T12:00:00");
  const slots = buildPlannedWorkoutSlots({ workouts, calendar, history, now });
  const saved = mergeProfileCalendarDraft(calendar, calendar, slots, ["2026-11-11", "2026-11-14", "2026-11-18"], now);
  let loaded = JSON.parse(JSON.stringify(saved));
  for (let reload = 0; reload < 4; reload++) {
    loaded = getWorkoutScheduleCalendarForWorkouts(loaded, workouts);
    const rendered = buildPlannedWorkoutSlots({ workouts, calendar: loaded, history, now });
    assert.deepEqual(rendered.slice(5).map(slot => slot.plannedDate), ["2026-11-11", "2026-11-14", "2026-11-18"]);
    assert.deepEqual(rendered.slice(0, 5).map(slot => slot.completedDate), completedDates);
    assert.equal(getProfileCalendarDraft(rendered).requiredCount, 3);
    assert.equal(new Set(loaded.scheduledDates).size, loaded.scheduledDates.length);
  }
  assert.deepEqual(saved.plannedWorkouts.slice(0, 5), calendar.plannedWorkouts.slice(0, 5));
});
