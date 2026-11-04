import assert from "node:assert/strict";
import test from "node:test";
import { getTrainerSetupScheduleSlots, getTrainerSetupScheduleWorkouts } from "../src/utils/trainerSetupSchedule.js";
import { distributeAgendaWeekdays, getAgendaDateDraft, validateAgendaDateDraft } from "../src/utils/trainerScheduleAgenda.js";

const client = { assignedProgramId: "template", assignedProgramAddedAt: "new-copy", workoutCalendar: {} };
const workouts = [
  { id: "old", assignedProgramId: "template", assignedProgramAddedAt: "old-copy", order: 1 },
  { id: "two", name: "Тренировка 2", assignedProgramId: "template", assignedProgramAddedAt: "new-copy", order: 2 },
  { id: "one", name: "Тренировка 1", assignedProgramId: "template", assignedProgramAddedAt: "new-copy", order: 1 },
  { id: "archived", assignedProgramId: "template", assignedProgramAddedAt: "new-copy", assignedProgramLifecycleStatus: "archived" }
];

test("setup schedules only the exact saved client copy in its program order", () => {
  const before = structuredClone(workouts);
  assert.deepEqual(getTrainerSetupScheduleWorkouts(workouts, client).map(item => item.id), ["one", "two"]);
  assert.deepEqual(getTrainerSetupScheduleWorkouts(workouts, { ...client, assignedProgramAddedAt: "not-loaded" }), []);
  assert.deepEqual(getTrainerSetupScheduleWorkouts(workouts, { assignedProgramId: "template" }), []);
  assert.deepEqual(workouts, before);
});

test("saved dates and status belong to workout IDs, never to a different template copy", () => {
  const selected = getTrainerSetupScheduleWorkouts(workouts, client);
  const slots = getTrainerSetupScheduleSlots(selected, { plannedWorkouts: [
    { order: 1, index: 0, date: "2026-01-01", status: "completed" },
    { workoutId: "old", assignedProgramAddedAt: "old-copy", date: "2026-01-01", status: "completed" },
    { workoutId: "one", assignedProgramAddedAt: "new-copy", date: "2026-10-31", status: "planned" }
  ] });
  assert.deepEqual(getAgendaDateDraft(slots), { one: "2026-10-31", two: "" });
  const result = distributeAgendaWeekdays(slots, getAgendaDateDraft(slots), [3, 6], "2026-10-31", "2026-10-30");
  assert.deepEqual(result.draft, { one: "2026-10-31", two: "2026-11-04" });
  const manual = { ...result.draft, one: "2026-11-05" };
  assert.deepEqual(validateAgendaDateDraft(slots, manual, "2026-10-30").workoutDates, [
    { workoutId: "one", date: "2026-11-05" }, { workoutId: "two", date: "2026-11-04" }
  ]);
});

test("resumed setup preserves completed dates during weekday distribution", () => {
  const selected = getTrainerSetupScheduleWorkouts(workouts, client);
  const slots = getTrainerSetupScheduleSlots(selected, { plannedWorkouts: [
    { workoutId: "one", assignedProgramAddedAt: "new-copy", date: "2026-10-10", status: "completed", completedDate: "2026-10-11" }
  ] });
  const result = distributeAgendaWeekdays(slots, getAgendaDateDraft(slots), [3], "2026-10-30", "2026-10-30");
  assert.deepEqual(result.draft, { one: "2026-10-10", two: "2026-11-04" });
  assert.equal(validateAgendaDateDraft(slots, { ...result.draft, one: "2026-11-11" }, "2026-10-30").ok, false);
});

test("legacy completed flag keeps the day read-only even without completedAt", () => {
  const slots = getTrainerSetupScheduleSlots([{ ...workouts[2], completed: true, plannedDate: "2026-11-04" }]);
  assert.equal(slots[0].isCompleted, true);
  assert.equal(validateAgendaDateDraft(slots, { one: "2026-11-05" }, "2026-10-30").ok, false);
});
