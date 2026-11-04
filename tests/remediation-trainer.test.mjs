import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { buildTrainerClientProgramTimeline } from "../src/utils/trainerClientProgramAssignments.js";
import { canDeleteEmptyProgramHistoryAssignment } from "../src/utils/trainerProgramHistoryPresentation.js";

const noop = () => {};
let store, writes, apiCalls, apiOk, failHistory, csvBlob, failWrite;
const clone = value => structuredClone(value);
const snapshot = (path) => ({ id: path.split("/").at(-1), exists: () => store.has(path), data: () => clone(store.get(path)) });
const put = (path, patch, options) => {
  if (path === failWrite) throw new Error("synthetic copy failure");
  writes.push([path, clone(patch)]);
  const current = store.get(path) || {};
  store.set(path, options?.merge ? { ...current, ...clone(patch), ...(patch.workoutCalendar ? { workoutCalendar: { ...current.workoutCalendar, ...clone(patch.workoutCalendar) } } : {}), ...(patch.subscription ? { subscription: { ...current.subscription, ...clone(patch.subscription) } } : {}) } : clone(patch));
};
const firestore = {
  doc: (_db, ...parts) => parts.join("/"), collection: (_db, ...parts) => parts.join("/"),
  query: (path, ...constraints) => ({ path, constraints }),
  orderBy: key => ({ order: key }), documentId: () => "__name__", limit: value => ({ limit: value }),
  startAfter: value => ({ after: value.id }), where: noop,
  getDoc: async path => snapshot(path),
  getDocs: async value => {
    const path = value.path || value;
    if (failHistory && path.endsWith("/history")) throw new Error("history unavailable");
    let keys = [...store.keys()].filter(key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/")).sort();
    const afterId = value.constraints?.find(item => item.after)?.after;
    if (afterId) keys = keys.filter(key => key.split("/").at(-1) > afterId);
    keys = keys.slice(0, value.constraints?.find(item => item.limit)?.limit);
    const docs = keys.map(snapshot);
    return { docs, forEach: callback => docs.forEach(callback) };
  },
  setDoc: async (...args) => put(...args), addDoc: async (path, data) => { put(`${path}/new`, data); return { id: "new" }; },
  writeBatch: () => { const pending = []; return { set: (...args) => pending.push(args), delete: path => pending.push([path]), commit: async () => pending.forEach(args => args.length === 1 ? (writes.push([args[0], "delete"]), store.delete(args[0])) : put(...args)) }; },
  runTransaction: async (_db, callback) => {
    const pending = [];
    const value = await callback({ get: async path => snapshot(path), set: (...args) => pending.push(args) });
    pending.forEach(args => put(...args));
    return value;
  }
};
const cleanup = installRuntimeImports({
  "firebase/firestore": firestore,
  "/src/utils/apiClient.js": { fetchAuthorized: async () => { apiCalls++; return { ok: apiOk }; }, fetchAuthorizedWithTimeout: noop },
  "/src/utils/firebaseStorage.js": { uploadStorageFile: noop }
});
after(cleanup);
const { createTrainerPlanEditorHandlers } = await import("../src/features/trainer/trainerPlanEditorHandlers.js");
const { createTrainerProgramTemplateHandlers } = await import("../src/features/trainer/trainerProgramTemplateHandlers.js");
const { requestEmptyProgramAssignmentDeletion } = await import("../src/utils/trainerProgramAssignmentDelete.js");
const { createTrainerClientCalendarHandlers } = await import("../src/features/trainer/trainerClientCalendarHandlers.js");
const { createTrainerMessagingHandlers } = await import("../src/features/trainer/trainerMessagingHandlers.js");
const { handleTrainerClientActionWithDeps, downloadTrainerClientExportWithDeps } = await import("../src/features/trainer/trainerClientActionHandlers.js");
const { buildClientWorkoutsFromTemplate, getWorkoutExecutionSteps } = await import("../src/utils/workoutPlanNormalization.js");
const { buildTrainerClientListItems } = await import("../src/utils/trainerActionCenter.js");
const { transferClientDataBetweenAccountsWithDeps } = await import("../src/features/trainer/trainerAccountAdminHandlers.js");
const auth = { currentUser: { uid: "trainer" } };
const stamp = "2026-01-01T00:00:00.000Z";
const date = "2099-01-02";
const workout = () => ({ id: "day", name: "Day", status: "planned", scheduledDate: date, exercises: [{ id: "e", sets: [{ reps: 8, weight: 10 }] }], assignedProgramId: "program", assignedProgramName: "Program", assignedProgramAddedAt: stamp, assignedProgramUpdatedAt: stamp, assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active" });
const client = () => ({ id: "client", assignedProgramId: "program", assignedProgramAddedAt: stamp, assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active", workoutCalendar: { reminderEnabled: true, scheduledDates: [date], monthlyTrainingDates: [date], plannedWorkouts: [{ workoutId: "day", date, status: "moved", movedToDate: "2099-01-03", customMetadata: "keep", assignedProgramAddedAt: stamp }] } });
beforeEach(() => { store = new Map(); writes = []; apiCalls = 0; apiOk = true; failHistory = false; failWrite = ""; });
const seed = (profile = client(), day = workout()) => { store.set("users/client", clone(profile)); store.set(`users/client/workouts/${day.id}`, clone(day)); };
const common = profile => ({ db: {}, auth, adminSelectedClient: profile, usersList: [profile], selectedUserId: profile.id, canManageClientProgram: () => true, setAdminClientStatus: noop, setAdminSelectedClient: noop, setUsersList: noop, setPlan: noop, setAdminCalendarDraft: noop, recordTrainerEvent: noop });

for (const mode of ["superset", "triset"]) test(`TR01 copied ${mode} retains execution and interval structure without stale IDs`, () => {
  const ids = mode === "triset" ? ["a", "b", "c"] : ["a", "b"];
  const [original] = buildClientWorkoutsFromTemplate({ workouts: [{ id: "source", exercises: ids.map(id => ({ id, name: id, sets: [{ reps: 8, weight: 10 }] })), taskBlocks: [
    { id: "group", type: "group", groupMode: mode, rounds: 4, exerciseIds: ids },
    { id: "interval", type: "interval", rounds: 8, workTime: "30 сек", restTime: "10 сек", exerciseIds: [] }
  ] }] });
  const before = clone(original); let plan = { workouts: [original] };
  createTrainerPlanEditorHandlers({ plan, setPlan: value => { plan = value; }, saveWorkoutsToFirebase: async () => true }).duplicateTrainerNextWorkoutDay(original.id);
  const copied = JSON.parse(JSON.stringify(plan.workouts[1]));
  assert.equal(getWorkoutExecutionSteps(copied).length, getWorkoutExecutionSteps(original).length);
  assert.deepEqual(original, before);
  assert.notEqual(copied.taskBlocks[0].id, original.taskBlocks[0].id);
  assert.ok(copied.taskBlocks[0].exerciseIds.every(id => copied.exercises.some(exercise => exercise.id === id)));
  assert.equal(copied.taskBlocks[1].workTime, original.taskBlocks[1].workTime);
});

test("TR02 last assignment archive/restore restores durable identity and exact calendar metadata without template", async () => {
  const profile = client(); seed(profile);
  const handlers = createTrainerProgramTemplateHandlers(common(profile));
  const assignment = { key: `time:${stamp}`, programId: "program", name: "Program", assignedAt: stamp };
  assert.equal(await handlers.archiveClientProgramAssignment(profile.id, assignment), true);
  assert.deepEqual(store.get("users/client").workoutCalendar.plannedWorkouts, []);
  assert.equal(await handlers.restoreClientProgramAssignment(profile.id, assignment), true);
  const restored = store.get("users/client");
  assert.equal(restored.assignedProgramId, "program");
  assert.equal(restored.assignedProgramAddedAt, stamp);
  assert.equal(restored.assignedProgramVisibility, "client_active");
  assert.deepEqual(restored.workoutCalendar.plannedWorkouts, profile.workoutCalendar.plannedWorkouts);
  assert.equal(restored.workoutCalendar.reminderEnabled, true);
});

test("TR02 restoring historical completed copy preserves another active assignment and its slots", async () => {
  const profile = client(); seed(profile);
  const archived = { ...workout(), id: "old", status: "completed", assignedProgramId: "old-program", assignedProgramAddedAt: "2025-01-01", assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived", assignedProgramArchivedCalendarEntries: [{ workoutId: "old", date: "2025-01-02", status: "completed" }] };
  store.set("users/client/workouts/old", archived);
  assert.equal(await createTrainerProgramTemplateHandlers(common(profile)).restoreClientProgramAssignment(profile.id, { key: "time:2025-01-01", programId: "old-program", assignedAt: "2025-01-01" }), true);
  const restored = store.get("users/client");
  assert.equal(restored.assignedProgramAddedAt, stamp);
  assert.deepEqual(restored.workoutCalendar.plannedWorkouts[0], profile.workoutCalendar.plannedWorkouts[0]);
  assert.equal(restored.workoutCalendar.plannedWorkouts[1].status, "completed");
});

for (const legacy of [false, true]) test(`TR02 preparing an empty historical copy preserves another ${legacy ? "legacy" : "active"} durable assignment`, async () => {
  const profile = client();
  if (legacy) { delete profile.assignedProgramLifecycleStatus; delete profile.assignedProgramVisibility; }
  seed(profile);
  const previous = { ...workout(), id: "old", assignedProgramAddedAt: "2025-01-01", assignedProgramUpdatedAt: stamp,
    scheduledDate: "2025-01-02" };
  // Another old unstarted copy must not become the profile's current program.
  store.set("users/client/workouts/earlier", { ...previous, id: "earlier", assignedProgramAddedAt: "2024-01-01" });
  store.set("users/client/workouts/old", previous);
  const subscription = { total: 8, used: 3 }; store.get("users/client").subscription = subscription;
  const currentBefore = clone(store.get("users/client"));
  let status = "";
  const handlers = createTrainerProgramTemplateHandlers({ ...common(profile), setAdminClientStatus: value => { status = value; } });
  assert.equal(await handlers.archiveClientProgramAssignment(profile.id, { key: "time:2025-01-01", status: "archived", archived: true,
    programId: "program", assignedAt: "2025-01-01" }), true);
  assert.equal(store.get("users/client/workouts/old").assignedProgramLifecycleStatus, "archived");
  assert.equal(store.get("users/client/workouts/old").assignedProgramVisibility, "trainer_archived");
  const saved = store.get("users/client");
  for (const key of Object.keys(currentBefore).filter(key => key !== "workoutCalendar")) assert.deepEqual(saved[key], currentBefore[key]);
  assert.deepEqual(saved.workoutCalendar.plannedWorkouts, currentBefore.workoutCalendar.plannedWorkouts);
  assert.deepEqual(saved.workoutCalendar.scheduledDates, currentBefore.workoutCalendar.scheduledDates);
  assert.deepEqual(store.get("users/client/workouts/day"), workout());
  assert.equal(store.get("users/client/workouts/earlier").assignedProgramLifecycleStatus, "active");
  assert.match(status, /Текущая программа клиента не изменена/);
});

for (const duplicateVisible of [false, true]) test(`TR02 archive keeps a read-only historical copy immediately${duplicateVisible ? " and deduplicates visible documents" : ""}`, async () => {
  const profile = client(); seed(profile);
  const oldStamp = "2025-01-01T00:00:00.000Z";
  const old = [1, 2].map(index => ({ ...workout(), id: `old-${index}`, assignedBy: "trainer",
    assignedProgramAddedAt: oldStamp, assignedProgramArchivedCalendarEntries: [] }));
  const unrelated = { ...workout(), id: "other-archive", assignedProgramAddedAt: "2024-01-01T00:00:00.000Z",
    assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived" };
  for (const day of [...old, unrelated]) store.set(`users/client/workouts/${day.id}`, clone(day));
  let localPlan = { workouts: [workout(), ...(duplicateVisible ? [clone(old[0])] : [])], archivedWorkouts: [...clone(old), clone(unrelated)] };
  const handlers = createTrainerProgramTemplateHandlers({ ...common(profile),
    setPlan: update => { localPlan = update(localPlan); } });
  const assignment = { key: `time:${oldStamp}`, status: "archived", archived: true, programId: "program", assignedAt: oldStamp };
  assert.equal(await handlers.archiveClientProgramAssignment(profile.id, assignment), true);
  assert.deepEqual(localPlan.workouts, [workout()]);
  assert.equal(localPlan.archivedWorkouts.length, 3);
  assert.deepEqual(localPlan.archivedWorkouts.find(day => day.id === unrelated.id), unrelated);
  for (const day of old) {
    const saved = localPlan.archivedWorkouts.filter(item => item.id === day.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].assignedProgramLifecycleStatus, "archived");
    assert.equal(saved[0].assignedProgramVisibility, "trainer_archived");
    assert.ok(saved[0].assignedProgramArchivedAt);
    assert.deepEqual(saved[0].exercises, day.exercises);
    assert.deepEqual(saved[0].assignedProgramArchivedCalendarEntries, day.assignedProgramArchivedCalendarEntries);
    assert.equal(day.assignedProgramLifecycleStatus, "active");
  }
  const timeline = buildTrainerClientProgramTimeline({ workouts: localPlan.workouts, archivedWorkouts: localPlan.archivedWorkouts,
    history: [], clientProfile: profile });
  const archived = timeline.find(item => item.key === assignment.key);
  assert.equal(archived.workoutCount, 2);
  assert.equal(canDeleteEmptyProgramHistoryAssignment(archived), true);
  assert.equal(await handlers.restoreClientProgramAssignment(profile.id, assignment), true);
  assert.deepEqual(localPlan.archivedWorkouts, [unrelated]);
  assert.deepEqual(localPlan.workouts.map(day => day.id).sort(), ["day", "old-1", "old-2"]);
  assert.ok(localPlan.workouts.filter(day => day.id.startsWith("old-")).every(day => day.assignedProgramLifecycleStatus === "active"));
});

test("TR02 archive ignores stale login or changed client selection before writing or publishing", async () => {
  const profile = client(); seed(profile);
  let localUpdates = 0;
  try {
    let checks = 0;
    const selectionChanged = createTrainerProgramTemplateHandlers({ ...common(profile),
      isClientSelectionCurrent: () => ++checks === 1,
      setPlan: () => { localUpdates++; } });
    assert.equal(await selectionChanged.archiveClientProgramAssignment(profile.id, { key: `time:${stamp}` }), false);
    assert.equal(writes.length, 0);
    assert.equal(localUpdates, 0);
    const changedLogin = createTrainerProgramTemplateHandlers({ ...common(profile), setPlan: () => { localUpdates++; } });
    const pending = changedLogin.archiveClientProgramAssignment(profile.id, { key: `time:${stamp}` });
    auth.currentUser = { uid: "different" };
    assert.equal(await pending, false);
    assert.equal(writes.length, 0);
    assert.equal(localUpdates, 0);
  } finally { auth.currentUser = { uid: "trainer" }; }
});

test("TR02 a client switch during archive commit cannot publish old client data into the new selection", async () => {
  const profile = client(); seed(profile);
  let checks = 0; let localUpdates = 0; let statusUpdates = 0;
  const handlers = createTrainerProgramTemplateHandlers({ ...common(profile),
    isClientSelectionCurrent: () => ++checks <= 2,
    setPlan: () => { localUpdates++; }, setAdminClientStatus: () => { statusUpdates++; } });
  assert.equal(await handlers.archiveClientProgramAssignment(profile.id, { key: `time:${stamp}` }), false);
  assert.equal(store.get("users/client/workouts/day").assignedProgramLifecycleStatus, "archived");
  assert.ok(writes.length > 0);
  assert.equal(localUpdates, 0);
  assert.equal(statusUpdates, 0);
});

for (const change of [{ status: "completed", completedAt: stamp }, { status: "moved", movedToDate: "2099-01-04" }]) test(`TR03 concurrent ${change.status} conflicts without writes`, async () => {
  const profile = client(); const stale = workout(); seed(profile, { ...stale, ...change });
  const result = await createTrainerClientCalendarHandlers({ ...common(profile), plan: { workouts: [stale] } }).saveTrainerClientWorkoutSchedule(["2099-01-03"], profile, [stale]);
  assert.equal(result, false); assert.equal(writes.length, 0);
  assert.equal(store.get("users/client/workouts/day").status, change.status);
});

test("TR03 load adjustment cannot overwrite concurrent completion", async () => {
  const stale = workout(); seed(client(), { ...stale, status: "completed" });
  const handlers = createTrainerPlanEditorHandlers({ plan: { workouts: [stale] }, auth, selectedUserId: "client", db: {}, doc: firestore.doc, setAdminClientStatus: noop, setPlan: noop });
  assert.equal(await handlers.saveTrainerExerciseProgressAdjustment({ workoutId: "day", exerciseId: "e", patch: { name: "changed" } }), false);
  assert.equal(writes.length, 0);
});

test("TR04 ID-only connected account sends once; failure and username-only do not claim delivery", async () => {
  const profile = { id: "client", telegram: { connected: true, telegramUserId: "123", username: "" } };
  const handlers = createTrainerMessagingHandlers({ ...common(profile), user: {}, setAdminTelegramSending: noop, setAdminTelegramMessage: noop });
  assert.equal(await handlers.sendTrainerClientMessage("message", profile), true); assert.equal(apiCalls, 1); assert.equal(writes.length, 0);
  apiOk = false; assert.equal(await handlers.sendTrainerClientMessage("retry", profile), false);
  assert.equal(await handlers.sendTrainerClientMessage("unlinked", { id: "client", telegramUsername: "name" }), false);
  assert.equal(apiCalls, 2); assert.equal(writes.length, 0);
});

test("TR05 export paginates 281 records and includes explicit scope; read failure blocks download", async () => {
  for (let i = 0; i < 281; i++) store.set(`users/client/history/${String(i).padStart(4, "0")}`, { workoutName: `workout-${i}`, date });
  let clicks = 0; let status = "";
  const originalDocument = globalThis.document; const create = URL.createObjectURL; const revoke = URL.revokeObjectURL;
  globalThis.document = { createElement: () => ({ click: () => { clicks++; } }) };
  URL.createObjectURL = blob => { csvBlob = blob; return "blob:report"; }; URL.revokeObjectURL = noop;
  try {
    const deps = { db: {}, client: client(), adminClientHistory: [], adminClientMeasurements: [], getAdminNutritionDaysList: () => [], setAdminClientStatus: value => { status = value; } };
    assert.equal(await downloadTrainerClientExportWithDeps(deps), true);
    const csv = await csvBlob.text();
    assert.equal(csv.split("\n").filter(line => line.startsWith('"workout"')).length, 281);
    assert.match(csv, /полностью.*281/); assert.match(status, /полнота не подтверждена/);
    failHistory = true; assert.equal(await downloadTrainerClientExportWithDeps(deps), false); assert.equal(clicks, 1); assert.match(status, /отменён/);
  } finally { globalThis.document = originalDocument; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

test("TR09 archive is separate from all/attention/test and remains accessible", () => {
  const clients = [{ id: "active", name: "Active" }, { id: "archived", archived: true }, { id: "archived-test", archived: true, isTest: true }, { id: "test", isTest: true }];
  const ids = filter => buildTrainerClientListItems(clients, {}, { filter }).map(item => item.client.id).sort();
  assert.deepEqual(ids("all"), ["active"]);
  assert.deepEqual(ids("archive"), ["archived", "archived-test"]);
  assert.deepEqual(ids("test"), ["test"]);
  assert.ok(!ids("attention").includes("archived"));
});

test("TR10 failed reminders do not produce a success event", async () => {
  let events = 0;
  const result = await handleTrainerClientActionWithDeps({ ...common(client()), client: client(), action: "disable_notifications", canUseAdminFeatures: () => false, canUseTrainerFeatures: () => true, saveTrainerClientNotificationSettings: async () => false, recordTrainerEvent: () => { events++; } });
  assert.equal(result, false); assert.equal(events, 0);
});

test("TR02 restoring a fully completed assignment does not activate it", async () => {
  const profile = { ...client(), assignedProgramId: "", assignedProgramAddedAt: "", assignedProgramAt: "2026-10-18", assignedProgramLifecycleStatus: "archived" };
  seed(profile, { ...workout(), status: "completed", assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived" });
  assert.equal(await createTrainerProgramTemplateHandlers(common(profile)).restoreClientProgramAssignment(profile.id, { key: `time:${stamp}`, programId: "program", assignedAt: stamp }), true);
  assert.equal(store.get("users/client").assignedProgramId, "");
  assert.equal(store.get("users/client/workouts/day").status, "completed");
});

test("TR02 scoped archive and restore retain foreign slots, orphan dates, and legacy assignment slots", async () => {
  const profile = client();
  const foreign = { workoutId: "foreign", date: "2099-04-02", status: "completed", custom: true, assignedProgramAddedAt: "foreign-assignment" };
  const legacy = { date, status: "moved", assignedProgramAddedAt: stamp, completedDate: "2099-01-04" };
  profile.workoutCalendar.plannedWorkouts = [legacy, foreign];
  profile.workoutCalendar.scheduledDates = [date, foreign.date, "2099-05-01"];
  seed(profile);
  const handlers = createTrainerProgramTemplateHandlers(common(profile));
  const assignment = { key: `time:${stamp}`, programId: "program", assignedAt: stamp };
  assert.equal(await handlers.archiveClientProgramAssignment(profile.id, assignment), true);
  assert.deepEqual(store.get("users/client").workoutCalendar.plannedWorkouts, [foreign]);
  assert.ok(store.get("users/client").workoutCalendar.scheduledDates.includes("2099-05-01"));
  assert.equal(await handlers.restoreClientProgramAssignment(profile.id, assignment), true);
  assert.deepEqual(store.get("users/client").workoutCalendar.plannedWorkouts, [foreign, legacy]);
});

test("TR03 uncontested schedule save preserves foreign assignment slots", async () => {
  const profile = client(); const day = workout();
  profile.workoutCalendar.plannedWorkouts[0].status = "planned";
  const foreign = { workoutId: "foreign", date: "2099-04-02", status: "completed", completedDate: "2099-04-03" };
  profile.workoutCalendar.plannedWorkouts.push(foreign);
  seed(profile, day);
  const handlers = createTrainerClientCalendarHandlers({ ...common(profile), plan: { workouts: [day] } });
  assert.equal(await handlers.saveTrainerClientWorkoutSchedule(["2099-01-03"], profile, [day]), true);
  assert.equal(store.get("users/client/workouts/day").scheduledDate, "2099-01-03");
  assert.deepEqual(store.get("users/client").workoutCalendar.plannedWorkouts[0], foreign);
});

test("TR03 load adjustment only changes targeted exercise prescription and retains fresh metadata", async () => {
  const day = workout(); seed(client(), { ...day, untouched: "fresh", exercises: [...day.exercises, { id: "other", name: "untouched" }] });
  let plan = { workouts: [day] };
  const handlers = createTrainerPlanEditorHandlers({ plan, auth, selectedUserId: "client", db: {}, doc: firestore.doc, setAdminClientStatus: noop, setPlan: update => { plan = update(plan); } });
  assert.equal(await handlers.saveTrainerExerciseProgressAdjustment({ workoutId: "day", exerciseId: "e", patch: { sets: [{ reps: 10, weight: 15 }] } }), true);
  const saved = store.get("users/client/workouts/day");
  assert.equal(saved.untouched, "fresh"); assert.equal(saved.exercises[1].name, "untouched");
  assert.equal(saved.exercises[0].sets[0].weight, 15);
  assert.deepEqual(Object.keys(writes[0][1]).sort(), ["exercises", "updatedAt"]);
});

test("TR05 history export stops at explicit cap and labels the CSV as partial", async () => {
  for (let i = 0; i < 5001; i++) store.set(`users/client/history/${String(i).padStart(5, "0")}`, { workoutName: `workout-${i}`, date });
  const originalDocument = globalThis.document; const create = URL.createObjectURL; const revoke = URL.revokeObjectURL;
  globalThis.document = { createElement: () => ({ click: noop }) };
  URL.createObjectURL = blob => { csvBlob = blob; return "blob:report"; }; URL.revokeObjectURL = noop;
  try {
    assert.equal(await downloadTrainerClientExportWithDeps({ db: {}, client: client(), adminClientMeasurements: [], getAdminNutritionDaysList: () => [], setAdminClientStatus: noop }), true);
    const csv = await csvBlob.text();
    assert.equal(csv.split("\n").filter(line => line.startsWith('"workout"')).length, 5000);
    assert.match(csv, /Неполная история.*максимум 5000/);
  } finally { globalThis.document = originalDocument; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

for (const status of ["missed", "not_completed"]) test(`TR11 dormant trainer delete/clear reject partly ${status} assignment without writes`, async () => {
  const profile = client(); seed(profile, { ...workout(), status });
  store.set("users/client/workouts/second", { ...workout(), id: "second" });
  const handlers = createTrainerProgramTemplateHandlers({ ...common(profile), canUseAdminFeatures: () => false, showAppConfirm: async () => true });
  assert.equal(await handlers.deleteClientProgramAssignment("client", { key: `time:${stamp}`, programId: "program", assignedAt: stamp }), false);
  assert.equal(await handlers.clearClientProgram("client"), false);
  assert.equal(writes.length, 0);
});

test("TR11 administrator policy may explicitly delete a partly missed assignment", async () => {
  for (const status of ["future", "archived"]) {
    const profile = client(); seed(profile, { ...workout(), status: "missed" });
    store.set("users/client/workouts/second", { ...workout(), id: "second" });
    const handlers = createTrainerProgramTemplateHandlers({ ...common(profile), canUseAdminFeatures: () => true });
    assert.equal(await handlers.deleteClientProgramAssignment("client", { key: `time:${stamp}`, programId: "program", assignedAt: stamp, status }), true);
    assert.equal(store.has("users/client/workouts/day"), false);
  }
});

test("archived empty assignment deletion uses server verification and removes only confirmed local IDs", async () => {
  const profile = client(); let localPlan = { workouts: [workout()], archivedWorkouts: [{ ...workout(), id: "old" }, { ...workout(), id: "keep" }] };
  const before = clone(localPlan); let calls = 0;
  const handlers = createTrainerProgramTemplateHandlers({ ...common(profile), canUseAdminFeatures: () => false,
    setPlan: update => { localPlan = update(localPlan); },
    requestDeleteEmptyAssignment: async input => { calls++; assert.deepEqual(input, { clientId: "client", assignmentKey: `time:${stamp}` }); return { deletedWorkoutIds: ["old"], clientPatch: {} }; }
  });
  assert.equal(await handlers.deleteClientProgramAssignment("client", { key: `time:${stamp}`, status: "archived" }), true);
  assert.equal(calls, 1); assert.deepEqual(writes, []);
  assert.deepEqual(localPlan.workouts, before.workouts);
  assert.deepEqual(localPlan.archivedWorkouts, [before.archivedWorkouts[1]]);
});

test("server rejection or changed login cannot optimistically delete an archived assignment", async () => {
  const profile = client(); let localWrites = 0;
  const sessionAuth = { currentUser: { uid: "trainer" } };
  const handlers = createTrainerProgramTemplateHandlers({ ...common(profile), auth: sessionAuth, canUseAdminFeatures: () => false,
    setPlan: () => { localWrites++; },
    requestDeleteEmptyAssignment: async () => { throw new Error("В программе есть результаты."); }
  });
  await assert.rejects(handlers.deleteClientProgramAssignment("client", { key: `time:${stamp}`, status: "archived" }), /есть результаты/);
  const changed = createTrainerProgramTemplateHandlers({ ...common(profile), auth: sessionAuth, canUseAdminFeatures: () => false,
    setPlan: () => { localWrites++; }, requestDeleteEmptyAssignment: async () => { sessionAuth.currentUser = { uid: "other" }; return { deletedWorkoutIds: ["day"] }; }
  });
  assert.equal(await changed.deleteClientProgramAssignment("client", { key: `time:${stamp}`, status: "archived" }), false);
  const selectionChanged = createTrainerProgramTemplateHandlers({ ...common(profile), auth: { currentUser: { uid: "trainer" } }, canUseAdminFeatures: () => false,
    setPlan: () => { localWrites++; }, isClientSelectionCurrent: () => false,
    requestDeleteEmptyAssignment: async () => ({ deletedWorkoutIds: ["day"] })
  });
  assert.equal(await selectionChanged.deleteClientProgramAssignment("client", { key: `time:${stamp}`, status: "archived" }), false);
  const adminHistory = createTrainerProgramTemplateHandlers({ ...common(profile), canUseAdminFeatures: () => true,
    requestDeleteEmptyAssignment: async () => { throw new Error("В программе есть результаты."); }
  });
  await assert.rejects(adminHistory.deleteClientProgramAssignment("client", { key: `time:${stamp}`, status: "archived", deleteEmptyArchive: true }), /есть результаты/);
  assert.equal(localWrites, 0); assert.deepEqual(writes, []);
});

test("empty assignment API requires an exact confirmation and preserves readable rejection", async () => {
  const body = { clientId: "client", assignmentKey: `time:${stamp}` };
  const request = async (url, options) => {
    assert.equal(url, "/api/trainer-program-assignment-delete"); assert.deepEqual(JSON.parse(options.body), body);
    return { ok: true, json: async () => ({ ok: true, assignmentKey: body.assignmentKey, deletedWorkoutIds: ["old"] }) };
  };
  assert.deepEqual((await requestEmptyProgramAssignmentDeletion(body, request)).deletedWorkoutIds, ["old"]);
  await assert.rejects(requestEmptyProgramAssignmentDeletion(body, async () => ({ ok: false, status: 409, json: async () => ({ error: "program/has-activity", message: "В программе есть результаты." }) })), /есть результаты/);
  await assert.rejects(requestEmptyProgramAssignmentDeletion(body, async () => ({ ok: true, json: async () => ({ ok: true, assignmentKey: "other", deletedWorkoutIds: ["old"] }) })), /не подтвердил/);
});

function transferFixture() {
  const source = { id: "source", uid: "source", email: "source@example.test", role: "admin", name: "Source", telegram: { chatId: "source-chat" }, telegramUserId: "source-id", providerData: [{ uid: "source-provider" }], adminOnly: true, trainerId: "source-trainer", subscription: { remainingSessions: 999 }, assignedProgramId: "source-program", workoutCalendar: { plannedWorkouts: [] }, nutritionState: { days: {} }, identityOperation: "do not copy", futureIdentityField: true };
  const target = { id: "target", uid: "target", email: "target@example.test", role: "client", name: "Target", telegram: { chatId: "target-chat" }, telegramUserId: "target-id", providerData: [{ uid: "target-provider" }], trainerId: "target-trainer", subscription: { remainingSessions: 5 } };
  store.set("users/source", clone(source)); store.set("users/target", clone(target));
  for (const type of ["workouts", "history", "nutrition", "measurements", "progressPhotos", "nutritionDays", "trainerTasks"]) store.set(`users/source/${type}/fixture`, { content: type });
  let status = "";
  const deps = { db: {}, adminTransferFromUid: "source", adminTransferToUid: "target", adminAllUsersList: [source], usersList: [target], canUseAdminFeatures: () => true, showAppConfirm: async () => true, loadUsers: async () => {}, loadAdminClientOverview: async () => {}, setAdminTransferLoading: noop, setAdminTransferStatus: value => { status = value; } };
  return { source, target, deps, status: () => status };
}

test("TR12 dormant transfer uses content allowlist and preserves target account identity and omitted collections", async () => {
  const f = transferFixture();
  assert.equal(await transferClientDataBetweenAccountsWithDeps(f.deps), true);
  const target = store.get("users/target");
  for (const [key, value] of Object.entries(f.target)) assert.deepEqual(target[key], value, `target ${key} preserved`);
  assert.equal(target.assignedProgramId, "source-program");
  assert.equal(target.identityOperation, undefined); assert.equal(target.adminOnly, undefined); assert.equal(target.futureIdentityField, undefined);
  assert.deepEqual(store.get("users/source"), f.source);
  for (const type of ["measurements", "progressPhotos", "nutritionDays", "trainerTasks"]) assert.equal(store.has(`users/target/${type}/fixture`), false);
  assert.match(f.status(), /не переносились/);
});

test("TR12 transfer rejects non-admin callers and trainer targets without writes", async () => {
  const f = transferFixture();
  assert.equal(await transferClientDataBetweenAccountsWithDeps({ ...f.deps, canUseAdminFeatures: () => false }), false);
  store.set("users/target", { ...f.target, role: "trainer" });
  assert.equal(await transferClientDataBetweenAccountsWithDeps(f.deps), false);
  assert.equal(writes.length, 0);
});

test("TR12 interrupted transfer reports partial state; same-source retry updates stable IDs and preserves identity", async () => {
  const f = transferFixture(); failWrite = "users/target/history/fixture";
  assert.equal(await transferClientDataBetweenAccountsWithDeps(f.deps), false);
  assert.match(f.status(), /часть документов/);
  assert.deepEqual(store.get("users/target"), f.target);
  assert.equal(store.has("users/target/workouts/fixture"), true);
  failWrite = "";
  assert.equal(await transferClientDataBetweenAccountsWithDeps(f.deps), true);
  assert.equal([...store.keys()].filter(key => key.startsWith("users/target/workouts/")).length, 1);
  assert.equal(store.get("users/target").telegramUserId, f.target.telegramUserId);
});

test("TR14 count save and renewal preserve a frozen subscription unless resume was explicitly chosen", async () => {
  for (const renewSubscription of [false, true]) {
    const profile = { ...client(), subscription: { periodMode: "sessions", cycleId: "original-cycle", purchasedSessions: 10, usedSessions: 2, frozen: true, frozenUntil: "2099-01-01", history: [{ previousRemainingSessions: 3 }] } };
    seed(profile);
    const handlers = createTrainerClientCalendarHandlers(common(profile));
    assert.equal(await handlers.saveTrainerClientNotificationSettings({ subscriptionOnly: true, renewSubscription, subscription: { purchasedSessions: 12, usedSessions: 2 } }, profile), true);
    const saved = store.get("users/client").subscription;
    assert.equal(saved.frozen, true); assert.equal(saved.frozenUntil, "2099-01-01");
    if (!renewSubscription) assert.equal(saved.cycleId, "original-cycle");
  }
});

test("TR14 explicit resume clears both freeze fields without changing current cycle or renewal journal", async () => {
  const profile = { ...client(), subscription: { periodMode: "sessions", cycleId: "original-cycle", purchasedSessions: 10, usedSessions: 2, frozen: true, frozenUntil: "2099-01-01", history: [{ previousRemainingSessions: 3 }], lastRenewedAt: stamp } };
  seed(profile);
  assert.equal(await createTrainerClientCalendarHandlers(common(profile)).saveTrainerClientNotificationSettings({ subscriptionOnly: true, resumeSubscription: true, subscription: { purchasedSessions: 12, usedSessions: 2 } }, profile), true);
  const saved = store.get("users/client").subscription;
  assert.equal(saved.frozen, false); assert.equal(saved.frozenUntil, "");
  assert.equal(saved.cycleId, "original-cycle"); assert.equal(saved.lastRenewedAt, stamp);
  assert.deepEqual(saved.history, profile.subscription.history);
  assert.equal(saved.purchasedSessions, 12); assert.equal(saved.remainingSessions, 10);
});

test("TR14 explicit resume conflicts with concurrent cycle/counter changes and does not overwrite them", async () => {
  const profile = { ...client(), subscription: { cycleId: "original-cycle", purchasedSessions: 10, usedSessions: 2, frozen: true, frozenUntil: "2099-01-01" } };
  seed(profile); store.get("users/client").subscription.usedSessions = 3;
  assert.equal(await createTrainerClientCalendarHandlers(common(profile)).saveTrainerClientNotificationSettings({ subscriptionOnly: true, resumeSubscription: true, subscription: { purchasedSessions: 10, usedSessions: 2 } }, profile), false);
  assert.equal(writes.length, 0); assert.equal(store.get("users/client").subscription.usedSessions, 3);
  assert.equal(store.get("users/client").subscription.frozen, true);
});

test("TR14 failed explicit resume rolls optimistic state back rather than claiming an active subscription", async () => {
  const profile = { ...client(), subscription: { cycleId: "original-cycle", purchasedSessions: 10, usedSessions: 2, frozen: true } };
  seed(profile); failWrite = "users/client"; let current = profile; let users = [profile];
  const handlers = createTrainerClientCalendarHandlers({ ...common(profile), setAdminSelectedClient: update => { current = update(current); }, setUsersList: update => { users = update(users); } });
  assert.equal(await handlers.saveTrainerClientNotificationSettings({ subscriptionOnly: true, resumeSubscription: true }, profile), false);
  assert.equal(current.subscription.frozen, true); assert.equal(users[0].subscription.frozen, true);
});
