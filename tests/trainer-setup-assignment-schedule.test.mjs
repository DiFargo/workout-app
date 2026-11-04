import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { buildAppendedAssignmentWorkoutDocumentPlan } from "../src/utils/trainerProgramAssignment.js";
import { buildClientProgramLifecycleMetadata, buildProgramAssignmentMetadata, getTrainerProgramStatusMeta, isTrainerProgramArchived, TRAINER_PROGRAM_STATUSES } from "../src/utils/trainerProgramLifecycle.js";
import { buildWorkoutScheduleDraftWithExistingStatuses } from "../src/utils/workoutSchedule.js";
import { sortWorkoutDays } from "../src/utils/workoutPlanNormalization.js";
import { validateTrainerWorkoutScheduleDates } from "../src/utils/trainerProgramValidation.js";
import { getTrainerSetupScheduleDates, getTrainerSetupScheduleSlots } from "../src/utils/trainerSetupSchedule.js";
import { resolveAgendaScheduleInput } from "../src/utils/trainerScheduleAgenda.js";
import { programDraftSnapshot } from "../src/utils/trainerProgramDraft.js";
import { getTrainerActionErrorStatus } from "../src/utils/trainerActionStatus.js";

const templateSource = readFileSync(new URL("../src/features/trainer/trainerProgramTemplateHandlers.js", import.meta.url), "utf8");
const helpers = templateSource.slice(templateSource.indexOf("function makeResetWorkoutCalendar("), templateSource.indexOf("function attachAssignedProgramToWorkouts("));
const appendStart = templateSource.indexOf("  async function appendClientAssignedWorkouts(");
const appendSource = templateSource.slice(appendStart, templateSource.indexOf("\n  function getProgramClient(", appendStart));
const calendarSource = readFileSync(new URL("../src/features/trainer/trainerClientCalendarHandlers.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\s*/gm, "")
  .replace("export function createTrainerClientCalendarHandlers", "function createTrainerClientCalendarHandlers");
const plain = value => JSON.parse(JSON.stringify(value));
const assignedAt = "2026-10-30T09:00:00.000Z";
const dates = ["2099-01-03", "2099-01-07"];

async function fixture({ extraCalendarEntries = [] } = {}) {
  const oldWorkout = { id: "old-day", name: "Старое занятие", order: 1, status: "completed", completedAt: "2026-10-01", assignedProgramAddedAt: "old-assignment" };
  const client = { id: "setup-client", trainerUid: "setup-trainer", subscription: { purchasedSessions: 8, usedSessions: 1 }, workoutCalendar: { plannedWorkouts: [{ workoutId: oldWorkout.id, date: "2026-10-01", status: "completed", completedDate: "2026-10-01", assignedProgramAddedAt: "old-assignment" }, ...extraCalendarEntries] } };
  const server = new Map([["users/setup-client", plain(client)], ["users/setup-client/workouts/old-day", plain(oldWorkout)]]);
  const calls = { transactions: 0, writes: [], errors: [] };
  const snapshot = path => ({ id: path.split("/").at(-1), exists: () => server.has(path), data: () => plain(server.get(path)) });
  const apply = (path, data) => server.set(path, { ...(server.get(path) || {}), ...plain(data) });
  const context = vm.createContext({
    console: { error: (...args) => calls.errors.push(args) },
    db: {}, auth: { currentUser: { uid: "setup-trainer" } },
    doc: (_db, ...parts) => parts.join("/"), collection: (_db, ...parts) => parts.join("/"),
    getDoc: async path => snapshot(path),
    getDocs: async prefix => ({ docs: [...server.keys()].filter(path => path.startsWith(`${prefix}/`) && path.split("/").length === prefix.split("/").length + 1).map(snapshot) }),
    writeBatch: () => {
      const writes = [];
      return { set: (path, data) => writes.push([path, plain(data)]), commit: async () => writes.forEach(([path, data]) => apply(path, data)) };
    },
    runTransaction: async (_db, callback) => {
      calls.transactions++;
      const writes = [];
      const result = await callback({ get: async path => snapshot(path), set: (path, data) => writes.push([path, plain(data)]) });
      writes.forEach(([path, data]) => apply(path, data));
      calls.writes.push(...writes);
      return result;
    },
    buildAppendedAssignmentWorkoutDocumentPlan, buildClientProgramLifecycleMetadata, buildProgramAssignmentMetadata,
    getTrainerProgramStatusMeta, isTrainerProgramArchived, TRAINER_PROGRAM_STATUSES,
    buildWorkoutScheduleDraftWithExistingStatuses, sortWorkoutDays, validateTrainerWorkoutScheduleDates,
    getTrainerSetupScheduleDates, resolveAgendaScheduleInput, programDraftSnapshot, getTrainerActionErrorStatus
  });
  const append = vm.runInContext(`${helpers}\n(${appendSource.trim()})`, context);
  const template = { id: "setup-template", name: "Программа клиента", lifecycleStatus: "ready" };
  const result = await append(client.id, [{ id: "day-one", name: "Тренировка 1" }, { id: "day-two", name: "Тренировка 2" }], template, assignedAt);
  const updatedClient = { ...client, ...plain(result.clientPatch) };
  const state = { plan: { workouts: plain(result.nextWorkouts) }, client: updatedClient, users: [updatedClient], draft: {}, statuses: [] };
  const setter = key => update => { state[key] = typeof update === "function" ? update(state[key]) : update; };
  const createHandlers = vm.runInContext(`${calendarSource}\ncreateTrainerClientCalendarHandlers`, context);
  const handlers = createHandlers({
    db: {}, auth: { currentUser: { uid: "setup-trainer" } }, plan: state.plan,
    adminSelectedClient: updatedClient, usersList: state.users, selectedUserId: client.id,
    setAdminSelectedClient: setter("client"), setUsersList: setter("users"), setPlan: setter("plan"),
    setAdminCalendarDraft: setter("draft"), setAdminClientStatus: text => state.statuses.push(text), recordTrainerEvent() {}
  });
  return { result, client: updatedClient, server, state, calls, handlers, oldWorkout };
}

test("new assignment returns exactly the committed workout metadata without changing older snapshots", async () => {
  const f = await fixture();
  assert.deepEqual(plain(f.result.nextWorkouts[0]), f.oldWorkout);
  for (const workout of f.result.nextWorkouts.slice(1)) {
    assert.deepEqual(plain(workout), f.server.get(`users/${f.client.id}/workouts/${workout.id}`));
    assert.equal(workout.assignedProgramLifecycleStatus, "active");
    assert.equal(workout.assignedProgramVisibility, "client_active");
    assert.equal(workout.assignedProgramAssignedByUid, "setup-trainer");
    assert.equal(workout.status, "planned");
  }
});

for (const keyed of [false, true]) test(`first schedule save succeeds immediately after assignment (${keyed ? "workout IDs" : "assignment key"}), without reloading`, async () => {
  const f = await fixture();
  const selected = f.result.nextWorkouts.slice(1);
  const input = keyed ? { workoutDates: selected.map((workout, index) => ({ workoutId: workout.id, date: dates[index] })), trainingDays: ["wed", "sat"] } : dates;
  const scope = keyed ? selected : { assignmentKey: assignedAt };
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule(input, f.client, scope), true);
  assert.equal(f.calls.transactions, 1);
  assert.equal(f.calls.errors.length, 0);
  for (let index = 0; index < selected.length; index++) assert.equal(f.server.get(`users/${f.client.id}/workouts/${selected[index].id}`).scheduledDate, dates[index]);
  assert.deepEqual(f.server.get(`users/${f.client.id}/workouts/${f.oldWorkout.id}`), f.oldWorkout);
  assert.deepEqual(f.server.get(`users/${f.client.id}`).subscription, { purchasedSessions: 8, usedSessions: 1 });
  assert.equal(f.server.get(`users/${f.client.id}`).workoutCalendar.plannedWorkouts[0].date, "2026-10-01");
});

test("actual lifecycle change after assignment still rejects the schedule without writing", async () => {
  const f = await fixture();
  const workout = f.result.nextWorkouts[1];
  const path = `users/${f.client.id}/workouts/${workout.id}`;
  f.server.set(path, { ...f.server.get(path), assignedProgramLifecycleStatus: "archived" });
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule(dates, f.client, { assignmentKey: assignedAt }), false);
  assert.equal(f.calls.writes.length, 0);
  assert.match(f.state.statuses.at(-1), /Расписание или тренировка изменились/);
  assert.equal(f.server.get(path).assignedProgramLifecycleStatus, "archived");
  assert.equal(f.server.get(path).scheduledDate, undefined);
});

test("new keyed assignment never inherits completed status from index-only legacy calendar rows", async () => {
  const legacyEntries = [
    { index: 0, order: 1, assignedProgramId: "old-template", date: "2026-01-01", status: "completed", completedDate: "2026-01-01" },
    { index: 1, order: 2, date: "2026-01-03", status: "completed", completedDate: "2026-01-03" }
  ];
  const f = await fixture({ extraCalendarEntries: legacyEntries });
  const selected = f.result.nextWorkouts.slice(1);
  const slots = getTrainerSetupScheduleSlots(selected, f.client.workoutCalendar);
  assert.ok(slots.every(slot => slot.status === "planned" && !slot.isCompleted && !slot.plannedDate));
  const workoutDates = selected.map((workout, index) => ({ workoutId: workout.id, date: dates[index] }));
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule({ workoutDates }, f.client, selected), true);
  const saved = f.server.get(`users/${f.client.id}`).workoutCalendar.plannedWorkouts;
  for (const entry of legacyEntries) assert.deepEqual(saved.find(item => item.date === entry.date), entry);
  for (const workout of selected) {
    assert.equal(f.server.get(`users/${f.client.id}/workouts/${workout.id}`).status, "planned");
    assert.equal(saved.find(item => item.workoutId === workout.id).status, "planned");
  }
});

test("wizard schedule error preserves the actual conflict explanation when throwOnError is requested", async () => {
  const f = await fixture();
  const workout = f.result.nextWorkouts[1];
  const path = `users/${f.client.id}/workouts/${workout.id}`;
  f.server.set(path, { ...f.server.get(path), status: "completed", completedAt: "2099-01-03" });
  await assert.rejects(
    f.handlers.saveTrainerClientWorkoutSchedule(dates, f.client, { assignmentKey: assignedAt }, { throwOnError: true }),
    error => error.code === "trainer-schedule-conflict" && error.assignmentMessage === f.state.statuses.at(-1) && /Расписание или тренировка изменились/.test(error.assignmentMessage)
  );
  assert.equal(f.calls.writes.length, 0);
  assert.equal(f.server.get(path).status, "completed");
});
