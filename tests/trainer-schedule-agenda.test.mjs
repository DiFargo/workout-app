import assert from "node:assert/strict";
import test from "node:test";
import {
  distributeAgendaWeekdays,
  getAgendaDateDraft,
  getAgendaDisplaySlots,
  getAgendaScheduleSaveHint,
  getAgendaWeekdayDefaults,
  isAgendaSlotEditable,
  resolveAgendaScheduleInput,
  validateAgendaDateDraft
} from "../src/utils/trainerScheduleAgenda.js";
import { getWorkoutScheduleCalendarForWorkouts } from "../src/utils/workoutSchedule.js";

const today = "2026-10-29";

test("schedule save hints explain waiting, unavailable actions and required fields", () => {
  const ready = { days: [1, 4], startDate: today, today, dateDirty: true };
  assert.equal(getAgendaScheduleSaveHint(ready), "");
  assert.match(getAgendaScheduleSaveHint({ ...ready, saving: true }), /Сохраняю даты.*Дождитесь/);
  assert.match(getAgendaScheduleSaveHint({ ...ready, canSave: false }), /недоступно.*заново/);
  assert.match(getAgendaScheduleSaveHint({ ...ready, days: [] }), /Выберите хотя бы один день недели/);
  assert.match(getAgendaScheduleSaveHint({ ...ready, startDate: "" }), /Укажите дату начала/);
  assert.match(getAgendaScheduleSaveHint({ ...ready, startDate: "2026-10-28" }), /сегодняшнюю или будущую/);
  assert.match(getAgendaScheduleSaveHint({ ...ready, dateDirty: false }), /Даты не изменены.*Измените дату/);
  assert.deepEqual(ready, { days: [1, 4], startDate: today, today, dateDirty: true });
});

test("display and save guards respect an exact saved missed state without hiding immutable completions", () => {
  const workouts = [{ id: "one" }, { id: "two" }];
  const saved = [{ workoutId: "one", date: "2026-11-01", status: "missed" }, { workoutId: "two", date: "2026-10-20", status: "missed" }];
  const result = getAgendaDisplaySlots([{ workoutId: "one", plannedDate: "2026-11-01", status: "planned" }, { workoutId: "two", plannedDate: "2026-10-20", completedDate: "2026-10-21", isCompleted: true, status: "completed_off_date" }], workouts, saved);
  assert.equal(result[0].status, "missed");
  assert.equal(isAgendaSlotEditable(result[0], today), false);
  assert.equal(result[1].status, "completed_off_date");
  assert.equal(result[1].completedDate, "2026-10-21");
});
const slots = [
  { workoutId: "one", plannedDate: "2026-10-17", completedDate: "2026-10-21", isCompleted: true, status: "completed_off_date" },
  { workoutId: "two", plannedDate: "2026-10-31", status: "planned" },
  { workoutId: "three", plannedDate: "2026-11-04", status: "planned" }
];

test("draft retains planned dates, not actual completion dates, and is independent from input", () => {
  const draft = getAgendaDateDraft(slots);
  assert.deepEqual(draft, { one: "2026-10-17", two: "2026-10-31", three: "2026-11-04" });
  draft.two = "2026-11-05";
  assert.equal(slots[1].plannedDate, "2026-10-31");
});

test("only upcoming planned or unscheduled days are editable", () => {
  assert.equal(isAgendaSlotEditable(slots[1], today), true);
  assert.equal(isAgendaSlotEditable({ workoutId: "new", status: "planned" }, today), true);
  for (const slot of [slots[0], { ...slots[1], isCompleted: true }, { ...slots[1], status: "missed" },
    { ...slots[1], isMissed: true }, { ...slots[1], status: "moved" }, { ...slots[1], shiftedDate: "2026-11-05" },
    { ...slots[1], plannedDate: "2026-10-28" }]) assert.equal(isAgendaSlotEditable(slot, today), false);
});

test("validation preserves all IDs and permits nonchronological future dates without remapping", () => {
  const draft = { one: "2026-10-17", two: "2026-11-05", three: "2026-10-30" };
  const before = structuredClone({ slots, draft });
  assert.deepEqual(validateAgendaDateDraft(slots, draft, today), { ok: true, message: "", workoutDates: [
    { workoutId: "one", date: "2026-10-17" }, { workoutId: "two", date: "2026-11-05" }, { workoutId: "three", date: "2026-10-30" }
  ] });
  assert.deepEqual({ slots, draft }, before);
});

test("validation rejects missing/foreign/duplicate/invalid/past and immutable day changes", () => {
  for (const draft of [
    { two: "2026-10-31", three: "2026-11-04" },
    { ...getAgendaDateDraft(slots), other: "2026-11-06" },
    { ...getAgendaDateDraft(slots), three: "2026-10-31" },
    { ...getAgendaDateDraft(slots), three: "2026-02-31" },
    { ...getAgendaDateDraft(slots), three: "2026-10-28" },
    { ...getAgendaDateDraft(slots), one: "2026-10-21" }
  ]) assert.equal(validateAgendaDateDraft(slots, draft, today).ok, false);
  assert.equal(validateAgendaDateDraft([{ ...slots[0], plannedDate: "" }], { one: "2026-10-21" }, today).ok, false);
});

test("weekly distribution changes only editable days, respects ISO weekdays, and skips reserved dates", () => {
  const draft = getAgendaDateDraft(slots);
  const before = structuredClone({ slots, draft });
  const result = distributeAgendaWeekdays(slots, draft, [1, 4], today, today);
  assert.equal(result.ok, true);
  assert.deepEqual(result.draft, { one: "2026-10-17", two: "2026-10-29", three: "2026-11-02" });
  assert.deepEqual({ slots, draft }, before);
  const reserved = [{ workoutId: "locked", plannedDate: "2026-10-29", status: "completed", isCompleted: true }, { workoutId: "open", plannedDate: "", status: "planned" }];
  assert.equal(distributeAgendaWeekdays(reserved, getAgendaDateDraft(reserved), [4], today, today).draft.open, "2026-11-05");
});

test("weekly distribution rejects absent days, invalid starts and fully completed programmes", () => {
  for (const [days, start] of [[[], today], [[1], "2026-10-28"], [[1], "2026-02-31"]]) {
    assert.equal(distributeAgendaWeekdays(slots, getAgendaDateDraft(slots), days, start, today).ok, false);
  }
  assert.equal(distributeAgendaWeekdays([slots[0]], getAgendaDateDraft([slots[0]]), [1], today, today).ok, false);
});

test("weekday defaults reuse only upcoming dates and leave the saved schedule untouched", () => {
  const source = [...slots, { workoutId: "new", status: "planned", plannedDate: "" }];
  const before = structuredClone(source);
  assert.deepEqual(getAgendaWeekdayDefaults(source, today), { days: [3, 6], startDate: "2026-10-31" });
  assert.deepEqual(source, before);
  assert.deepEqual(getAgendaWeekdayDefaults([{ workoutId: "new", status: "planned" }], today), { days: [], startDate: today });
  assert.deepEqual(getAgendaWeekdayDefaults([{ workoutId: "manual", status: "planned", plannedDate: "2026-11-01" }], today, ["wed", "sat"]), { days: [3, 6], startDate: "2026-11-01" });
});

const assignment = "assignment-one";
const workouts = ["one", "two", "three"].map((id, index) => ({ id, name: id, order: index + 1, assignedProgramAddedAt: assignment, assignedProgramId: "program" }));
const savedEntries = [{ workoutId: "one", date: "2026-10-17", status: "completed", completedDate: "2026-10-21", statusUpdatedAt: "old", assignedProgramAddedAt: assignment }];
const input = { workoutDates: [
  { workoutId: "one", date: "2026-10-17" }, { workoutId: "two", date: "2026-11-05" }, { workoutId: "three", date: "2026-10-30" }
] };

test("keyed adapter preserves status metadata and pins nonchronological dates through calendar normalization", () => {
  const before = structuredClone({ input, workouts, savedEntries });
  const result = resolveAgendaScheduleInput(input, workouts, savedEntries, { todayDate: today });
  assert.equal(result.ok, true);
  assert.deepEqual(result.cleanDates, ["2026-10-17", "2026-11-05", "2026-10-30"]);
  assert.deepEqual(result.plannedWorkouts[0], { ...savedEntries[0], order: 1, index: 0, workoutName: "one", movedToDate: "", dateOrderPolicy: "workout_identity", assignedProgramUpdatedAt: "", assignedProgramId: "program", assignedProgramName: "" });
  const normalized = getWorkoutScheduleCalendarForWorkouts({ plannedWorkouts: result.plannedWorkouts }, workouts);
  assert.deepEqual(normalized.plannedWorkouts.map(entry => [entry.workoutId, entry.date]), input.workoutDates.map(entry => [entry.workoutId, entry.date]));
  assert.deepEqual({ input, workouts, savedEntries }, before);
});

test("keyed adapter rejects missing, foreign, duplicated IDs and mixed assignments", () => {
  for (const trainingDays of [[], ["bad"], ["wed", "wed"], "wed"]) assert.equal(resolveAgendaScheduleInput({ ...input, trainingDays }, workouts, savedEntries, { todayDate: today }).ok, false);
  for (const rows of [input.workoutDates.slice(1), [...input.workoutDates.slice(0, 2), { workoutId: "foreign", date: "2026-11-06" }],
    [...input.workoutDates.slice(0, 2), { workoutId: "two", date: "2026-11-06" }]]) {
    assert.equal(resolveAgendaScheduleInput({ workoutDates: rows }, workouts, savedEntries, { todayDate: today }).ok, false);
  }
  assert.equal(resolveAgendaScheduleInput(input, [workouts[0], { ...workouts[1], assignedProgramAddedAt: "other" }, workouts[2]], savedEntries, { todayDate: today }).ok, false);
});

test("keyed adapter never substitutes actual completion for a missing saved plan date", () => {
  const result = resolveAgendaScheduleInput(input, workouts, [{ ...savedEntries[0], date: "" }], { todayDate: today });
  assert.equal(result.ok, false);
});
