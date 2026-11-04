import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { buildWorkoutScheduleDraftWithExistingStatuses } from "../src/utils/workoutSchedule.js";
import { sortWorkoutDays } from "../src/utils/workoutPlanNormalization.js";
import { normalizeClientSubscription, renewClientSubscription } from "../src/utils/clientSubscription.js";
import { getTrainerActionErrorStatus } from "../src/utils/trainerActionStatus.js";
import { validateTrainerWorkoutScheduleDates } from "../src/utils/trainerProgramValidation.js";
import { getTrainerSetupScheduleDates } from "../src/utils/trainerSetupSchedule.js";
import { resolveAgendaScheduleInput } from "../src/utils/trainerScheduleAgenda.js";
import { programDraftSnapshot } from "../src/utils/trainerProgramDraft.js";

const source = readFileSync(new URL("../src/features/trainer/trainerClientCalendarHandlers.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\s*/gm, "")
  .replace("export function createTrainerClientCalendarHandlers", "function createTrainerClientCalendarHandlers");
const plain = value => JSON.parse(JSON.stringify(value));
const assignment = "2026-10-17T10:00:00.000Z";
const dates = ["2099-01-03", "2099-01-07", "2099-01-11"];
const originalSubscription = {
  purchasedSessions: 12, usedSessions: 2, remainingSessions: 10,
  cycleId: "original-cycle", startDate: "2020-01-01", endDate: "2020-01-31",
  history: [{ type: "renewal", previousRemainingSessions: 1, previousEndDate: "2019-12-31" }]
};

function fixture({ subscription = originalSubscription, rejectWrite = false, workoutOverrides = {}, calendarEntries = [] } = {}) {
  const workouts = ["one", "two", "three"].map((id, order) => ({
    id, order, name: id, assignedProgramId: "program-fixture", assignedProgramName: "Fixture program",
    assignedProgramAddedAt: assignment, assignedProgramUpdatedAt: "shared-queue", ...(workoutOverrides[id] || {})
  }));
  const foreignWorkout = { id: "foreign", order: 4, assignedProgramAddedAt: "other-assignment", scheduledDate: "2099-02-01" };
  const client = {
    id: "client-fixture", workoutCalendar: { plannedWorkouts: [{
      workoutId: foreignWorkout.id, assignedProgramAddedAt: "other-assignment", date: "2099-02-01"
    }, ...structuredClone(calendarEntries)] }, ...(subscription === null ? {} : { subscription: structuredClone(subscription) })
  };
  const state = { client: structuredClone(client), users: [structuredClone(client), { id: "unrelated" }], plan: { workouts: [...workouts, foreignWorkout] }, draft: {}, statuses: [] };
  const server = new Map([["users/client-fixture", structuredClone(client)]]);
  [...workouts, foreignWorkout].forEach(workout => server.set(`users/client-fixture/workouts/${workout.id}`, structuredClone(workout)));
  const calls = { direct: [], batches: [], events: [] };
  function applyWrite(write) {
    server.set(write.path, { ...(server.get(write.path) || {}), ...plain(write.data) });
  }
  function setter(key) {
    return update => { state[key] = typeof update === "function" ? update(state[key]) : update; };
  }
  const context = vm.createContext({
    console: { error() {} },
    buildWorkoutScheduleDraftWithExistingStatuses, sortWorkoutDays, normalizeClientSubscription, renewClientSubscription,
    getTrainerActionErrorStatus, validateTrainerWorkoutScheduleDates, getTrainerSetupScheduleDates, resolveAgendaScheduleInput, programDraftSnapshot,
    doc: (_db, ...parts) => parts.join("/"),
    runTransaction: async (_db, callback) => {
      const writes = [];
      const result = await callback({
        get: async path => ({ exists: () => server.has(path), data: () => plain(server.get(path)) }),
        set(path, data, options) { writes.push({ path, data: plain(data), options: plain(options) }); }
      });
      calls.batches.push(writes);
      if (rejectWrite) throw Object.assign(new Error("Synthetic transaction failure"), { code: "permission-denied" });
      writes.forEach(applyWrite);
      return result;
    },
    setDoc: async (path, data, options) => {
      const write = { path, data: plain(data), options: plain(options) };
      calls.direct.push(write);
      if (rejectWrite) throw Object.assign(new Error("Synthetic persistence failure"), { code: "permission-denied" });
      applyWrite(write);
    },
    writeBatch: () => {
      const writes = [];
      return {
        set(path, data, options) { writes.push({ path, data: plain(data), options: plain(options) }); },
        async commit() {
          calls.batches.push(writes);
          if (rejectWrite) throw Object.assign(new Error("Synthetic batch failure"), { code: "permission-denied" });
          writes.forEach(applyWrite);
        }
      };
    }
  });
  const createHandlers = vm.runInContext(`${source}\ncreateTrainerClientCalendarHandlers`, context);
  const handlers = createHandlers({
    db: {}, auth: { currentUser: { uid: "trainer-fixture" } },
    adminSelectedClient: client, usersList: state.users, selectedUserId: client.id, plan: state.plan,
    adminCalendarDraft: state.draft, setAdminSelectedClient: setter("client"), setUsersList: setter("users"),
    setPlan: setter("plan"), setAdminCalendarDraft: setter("draft"), setAdminClientStatus: text => state.statuses.push(text),
    recordTrainerEvent: (...args) => calls.events.push(args)
  });
  return { handlers, state, calls, server, client, workouts };
}

test("real schedule handler writes selected workouts/calendar without changing subscription or another assignment", async () => {
  const f = fixture();
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule(dates, f.client, f.workouts), true);
  assert.equal(f.calls.batches.length, 1);
  assert.equal(f.calls.direct.length, 0);
  const writes = f.calls.batches[0];
  assert.equal(writes.length, 4);
  assert.deepEqual(writes.filter(write => write.path.includes("/workouts/")).map(write => write.data.scheduledDate), dates);
  assert.ok(writes.every(write => !Object.hasOwn(write.data, "subscription")));
  assert.ok(writes.every(write => write.path !== "users/client-fixture/workouts/foreign"));
  const saved = f.server.get("users/client-fixture");
  assert.deepEqual(saved.subscription, originalSubscription);
  assert.deepEqual(plain(f.state.client.subscription), originalSubscription);
  assert.deepEqual(plain(f.state.users[0].subscription), originalSubscription);
  assert.equal(saved.workoutCalendar.plannedWorkouts.find(entry => entry.workoutId === "foreign").date, "2099-02-01");
});

test("real schedule handler does not create a subscription when none exists", async () => {
  const f = fixture({ subscription: null });
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule(dates, f.client, f.workouts), true);
  assert.equal(Object.hasOwn(f.server.get("users/client-fixture"), "subscription"), false);
  assert.equal(Object.hasOwn(f.state.client, "subscription"), false);
  assert.equal(Object.hasOwn(f.state.users[0], "subscription"), false);
});

test("schedule save accepts identical calendar data with reordered object keys", async () => {
  const f = fixture();
  const calendar = { ...f.client.workoutCalendar, enabled: true, reminderEnabled: true, planRevision: 7 };
  f.client.workoutCalendar = calendar;
  f.server.set("users/client-fixture", {
    ...f.server.get("users/client-fixture"),
    workoutCalendar: Object.fromEntries(Object.entries(calendar).reverse())
  });
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule(dates, f.client, f.workouts), true);
  assert.equal(f.calls.batches.length, 1);
  const saved = f.server.get("users/client-fixture");
  assert.equal(saved.workoutCalendar.planRevision, 7);
  assert.equal(saved.workoutCalendar.reminderEnabled, true);
  assert.deepEqual(saved.subscription, originalSubscription);
});

test("schedule save treats an absent stored status as the default planned status", async () => {
  const f = fixture({ workoutOverrides: { one: { status: "planned" } } });
  const storedWorkout = { ...f.server.get("users/client-fixture/workouts/one") };
  delete storedWorkout.status;
  f.server.set("users/client-fixture/workouts/one", storedWorkout);
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule(dates, f.client, f.workouts), true);
  assert.equal(f.server.get("users/client-fixture/workouts/one").status, "planned");
  assert.equal(f.server.get("users/client-fixture/workouts/one").scheduledDate, dates[0]);
  assert.deepEqual(f.server.get("users/client-fixture").subscription, originalSubscription);
});

test("real count-save handler opts into sessions mode and preserves cycle, history and legacy accounting dates", async () => {
  const f = fixture();
  assert.equal(await f.handlers.saveTrainerClientNotificationSettings({
    subscriptionOnly: true, subscription: { purchasedSessions: 15, usedSessions: 3 }
  }), true);
  assert.equal(f.calls.direct.length, 1);
  assert.equal(f.calls.batches.length, 0);
  const saved = f.server.get("users/client-fixture").subscription;
  assert.equal(saved.periodMode, "sessions");
  assert.equal(saved.purchasedSessions, 15);
  assert.equal(saved.usedSessions, 3);
  assert.equal(saved.remainingSessions, 12);
  for (const key of ["cycleId", "history", "startDate", "endDate"]) assert.deepEqual(saved[key], originalSubscription[key]);
  assert.deepEqual(plain(f.state.client.subscription), saved);
  assert.deepEqual(plain(f.state.users[0].subscription), saved);
});

test("failed count save returns false and rolls back optimistic client/list state without writing server data", async () => {
  const f = fixture({ rejectWrite: true });
  const result = f.handlers.saveTrainerClientNotificationSettings({
    subscriptionOnly: true, subscription: { purchasedSessions: 30, usedSessions: 4 }
  });
  assert.equal(f.state.client.subscription.periodMode, "sessions", "the real optimistic update occurs before persistence");
  assert.equal(f.state.client.subscription.purchasedSessions, 30);
  assert.equal(await result, false);
  assert.deepEqual(plain(f.state.client), f.client);
  assert.deepEqual(plain(f.state.users[0]), f.client);
  assert.deepEqual(f.server.get("users/client-fixture"), f.client);
  assert.ok(f.state.statuses.at(-1), "failure remains visible");
});

test("failed schedule batch returns false and leaves subscription, plan and calendar unchanged", async () => {
  const f = fixture({ rejectWrite: true });
  const before = plain({ client: f.state.client, plan: f.state.plan, users: f.state.users });
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule(dates, f.client, f.workouts), false);
  assert.deepEqual(plain({ client: f.state.client, plan: f.state.plan, users: f.state.users }), before);
  assert.deepEqual(f.server.get("users/client-fixture"), f.client);
  assert.equal(f.calls.events.length, 0);
});

test("real renewal keeps sessions mode, starts a new balance and appends rather than replaces history", async () => {
  const f = fixture();
  assert.equal(await f.handlers.saveTrainerClientNotificationSettings({
    subscriptionOnly: true, renewSubscription: true, subscription: { purchasedSessions: 20 }
  }), true);
  const saved = f.server.get("users/client-fixture").subscription;
  assert.equal(saved.periodMode, "sessions");
  assert.notEqual(saved.cycleId, originalSubscription.cycleId);
  assert.equal(saved.purchasedSessions, 20);
  assert.equal(saved.usedSessions, 0);
  assert.equal(saved.remainingSessions, 20);
  assert.deepEqual(saved.history.slice(0, -1), originalSubscription.history);
  assert.equal(saved.history.at(-1).previousEndDate, originalSubscription.endDate);
});

test("keyed schedule handler keeps explicit dates attached to their workout IDs and preserves unrelated data", async () => {
  const f = fixture({ workoutOverrides: { one: { order: 33 }, two: { order: 34 }, three: { order: 4 } } });
  const workoutDates = [
    { workoutId: "one", date: "2099-01-11" }, { workoutId: "two", date: "2099-01-03" }, { workoutId: "three", date: "2099-01-07" }
  ];
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule({ workoutDates }, f.client, f.workouts), true);
  for (const row of workoutDates) assert.equal(f.server.get(`users/client-fixture/workouts/${row.workoutId}`).scheduledDate, row.date);
  const saved = f.server.get("users/client-fixture");
  assert.deepEqual(saved.subscription, originalSubscription);
  assert.deepEqual(saved.workoutCalendar.plannedWorkouts.filter(entry => entry.workoutId !== "foreign").map(entry => [entry.workoutId, entry.date, entry.dateOrderPolicy]), workoutDates.map(row => [row.workoutId, row.date, "workout_identity"]));
  assert.equal(saved.workoutCalendar.plannedWorkouts.find(entry => entry.workoutId === "foreign").date, "2099-02-01");
  assert.equal(f.calls.direct.length, 0);
});

test("keyed schedule keeps chosen weekdays when a manual date is a Sunday exception", async () => {
  const f = fixture();
  const trainingDays = ["wed", "sat"];
  const workoutDates = [
    { workoutId: "one", date: "2099-01-04" }, { workoutId: "two", date: "2099-01-07" }, { workoutId: "three", date: "2099-01-10" }
  ];
  const foreignWorkout = structuredClone(f.server.get("users/client-fixture/workouts/foreign"));
  const foreignEntry = structuredClone(f.client.workoutCalendar.plannedWorkouts[0]);
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule({ workoutDates, trainingDays }, f.client, f.workouts), true);
  const saved = f.server.get("users/client-fixture");
  assert.deepEqual(saved.trainingDays, trainingDays);
  assert.deepEqual(saved.workoutCalendar.trainingDays, trainingDays);
  assert.equal(f.server.get("users/client-fixture/workouts/one").scheduledDate, "2099-01-04");
  for (const profile of [f.state.client, f.state.users[0]]) {
    assert.deepEqual(plain(profile.trainingDays), trainingDays);
    assert.deepEqual(plain(profile.workoutCalendar.trainingDays), trainingDays);
    assert.deepEqual(plain(profile.subscription), originalSubscription);
  }
  assert.deepEqual(saved.subscription, originalSubscription);
  assert.deepEqual(saved.workoutCalendar.plannedWorkouts.find(entry => entry.workoutId === "foreign"), foreignEntry);
  assert.deepEqual(f.server.get("users/client-fixture/workouts/foreign"), foreignWorkout);
});

test("keyed save preserves completed plan date, completion metadata and old statuses by ID", async () => {
  const completed = { workoutId: "one", date: "2020-01-05", status: "completed", completedDate: "2020-01-07", statusUpdatedAt: "2020-01-07T12:00:00Z", assignedProgramAddedAt: assignment };
  const f = fixture({ workoutOverrides: { one: { status: "completed", scheduledDate: completed.date, completedAt: completed.completedDate } }, calendarEntries: [completed] });
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule({ workoutDates: [
    { workoutId: "one", date: completed.date }, { workoutId: "two", date: "2099-01-07" }, { workoutId: "three", date: "2099-01-03" }
  ] }, f.client, f.workouts), true);
  const savedEntry = f.server.get("users/client-fixture").workoutCalendar.plannedWorkouts.find(entry => entry.workoutId === "one");
  for (const key of ["date", "status", "completedDate", "statusUpdatedAt"]) assert.equal(savedEntry[key], completed[key]);
  assert.equal(f.server.get("users/client-fixture/workouts/one").completedAt, completed.completedDate);
  assert.deepEqual(f.server.get("users/client-fixture").subscription, originalSubscription);
});

test("keyed save rejects completed date changes, foreign IDs, duplicates and invalid dates before writing", async () => {
  const f = fixture({ workoutOverrides: { one: { status: "completed", scheduledDate: "2020-01-05", completedAt: "2020-01-07" } } });
  const rows = [{ workoutId: "one", date: "2020-01-05" }, { workoutId: "two", date: "2099-01-07" }, { workoutId: "three", date: "2099-01-11" }];
  for (const workoutDates of [
    [{ ...rows[0], date: "2099-01-03" }, rows[1], rows[2]],
    [rows[0], rows[1], { workoutId: "foreign", date: "2099-01-11" }],
    [rows[0], rows[1], { ...rows[2], date: "2099-01-07" }],
    [rows[0], rows[1], { ...rows[2], date: "2099-02-31" }], rows.slice(1)
  ]) assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule({ workoutDates }, f.client, f.workouts), false);
  assert.equal(f.calls.batches.length, 0);
  assert.equal(f.calls.direct.length, 0);
});

test("keyed save rejects a concurrent completion and preserves the editor source state", async () => {
  const f = fixture();
  const before = plain(f.state);
  f.server.set("users/client-fixture/workouts/two", { ...f.server.get("users/client-fixture/workouts/two"), status: "completed", completedAt: "2099-01-07" });
  assert.equal(await f.handlers.saveTrainerClientWorkoutSchedule({ workoutDates: f.workouts.map((workout, index) => ({ workoutId: workout.id, date: dates[index] })) }, f.client, f.workouts), false);
  assert.deepEqual(plain(f.state.client), before.client);
  assert.deepEqual(plain(f.state.plan), before.plan);
  assert.equal(f.calls.events.length, 0);
  assert.equal(f.server.get("users/client-fixture/workouts/two").status, "completed");
});
