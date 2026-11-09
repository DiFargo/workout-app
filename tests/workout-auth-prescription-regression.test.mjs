import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { POST_WORKOUT_FEEDBACK_OPTIONS } from "../src/domain/workoutPresentation.js";
import { getWorkoutNoteItems } from "../src/utils/trainerClientMessages.js";

const auth = { currentUser: null };
let transact;
let readHistory;
let readProfile;
let writes;
let values;
let timers;
const originalTimeout = globalThis.setTimeout;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const cleanup = installRuntimeImports({
  "firebase/firestore": {
    doc: (_, ...path) => ({ path: path.join("/"), id: path.at(-1) }),
    collection: (_, ...path) => path.join("/"),
    getDocs: (...args) => readHistory(...args),
    getDoc: (...args) => readProfile(...args),
    runTransaction: (_, callback) => transact(callback)
  },
  "/src/firebase.js": { auth, db: {} },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout: async () => ({ ok: true, json: async () => ({ media: [] }) }) }
});
after(() => {
  cleanup();
  globalThis.setTimeout = originalTimeout;
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
});
const { advanceAuthSession } = await import("../src/utils/authSession.js");
const { saveCompletedWorkoutToFirebase } = await import("../src/features/client/workouts/workoutFirebaseSaveHandlers.js");
const { createWorkoutReadinessHandlers } = await import("../src/features/client/workouts/workoutReadinessHandlers.js");
const { createWorkoutHistoryHandlers } = await import("../src/features/client/workouts/workoutHistoryHandlers.js");
const { loadWorkoutsFromFirebaseWithDeps } = await import("../src/features/client/workouts/workoutFirebaseLoadHandlers.js");
const { replayFailedHistorySavesWithDeps, replayFailedNutritionSyncWithDeps } = await import("../src/features/client/offline/offlineReplayHandlers.js");
const storage = await import("../src/utils/offlineSyncStorage.js");
const { getWorkoutDraftKey } = await import("../src/utils/workoutDraftStorage.js");
const { persistWorkoutCompletion } = await import("../src/features/client/workouts/workoutCompletionPersistence.js");

function login(user) {
  auth.currentUser = user;
  advanceAuthSession(auth, user);
}
function reloginSameObject() {
  const user = auth.currentUser;
  login(null);
  login(user);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function assignedPlan() {
  const workout = {
    id: "day-a", name: "День A", order: 1, assignedProgramId: "program-a", assignedProgramAddedAt: "assignment-a", assignedProgramUpdatedAt: "v1",
    exercises: [{ id: "bench", name: "Жим", video: "/trainer/bench.mp4", sets: [{ reps: "10", weight: "40", enteredReps: "12", enteredWeight: "45", completed: true }] }]
  };
  return { assignedProgramId: "program-a", assignedProgramAddedAt: "assignment-a", assignedProgramUpdatedAt: "v1", workouts: [workout] };
}
function transaction() {
  return {
    get: async ref => {
      if (ref.path === "users/a") return { exists: () => true, data: () => assignedPlan() };
      if (ref.path === "users/a/workouts/day-a") return { id: "day-a", exists: () => true, data: () => assignedPlan().workouts[0] };
      return { exists: () => false, data: () => ({}) };
    },
    set: (ref, data) => writes.push({ path: ref.path, data }),
    delete: ref => writes.push({ path: ref.path, deleted: true })
  };
}
function saveFixture(overrides = {}) {
  const state = { plan: assignedPlan(), history: [], saving: false, saved: false, sync: "", card: false, errors: [], loads: 0 };
  const updates = [];
  const setter = key => value => {
    updates.push({ key, value });
    state[key] = typeof value === "function" ? value(state[key]) : value;
  };
  const args = {
    auth, db: {}, plan: state.plan, workout: state.plan.workouts[0], isSaving: false, workoutSaveInFlightRef: { current: false }, isWorkoutSaved: false,
    workoutStartedAt: 1000, workoutReadiness: null, workoutClientComment: "Комментарий", loadHistory: async () => { state.loads++; },
    showAppError: (...error) => state.errors.push(error), setPendingWorkoutFeedback: setter("feedback"), setWorkoutIncompleteConfirmOpen: setter("confirm"),
    setWorkoutHistorySyncState: setter("sync"), setWorkoutFinishedAt: setter("finished"), setTimerTick: setter("timer"), timerTickRef: { current: 0 },
    setIsSaving: setter("saving"), setIsWorkoutSaved: setter("saved"), setShowWorkoutSavedCard: setter("card"), setHistory: setter("history"), setPlan: setter("plan"),
    ...overrides
  };
  return { args, state, updates };
}
beforeEach(() => {
  login({ uid: "a", email: "a@example.test" });
  values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), key: index => [...values.keys()][index] ?? null, get length() { return values.size; } };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true, vibrate() {} } });
  timers = [];
  globalThis.setTimeout = (callback, ms) => { timers.push({ callback, ms }); return timers.length; };
  writes = [];
  transact = async callback => callback(transaction());
  readHistory = async () => ({ forEach() {} });
  readProfile = async () => ({ exists: () => true, data: () => assignedPlan() });
});

test("ordinary trainer prescription remains separate from actual entered weight and reps", async () => {
  const { args, state } = saveFixture();
  await saveCompletedWorkoutToFirebase(args);
  const entry = writes.find(item => item.path.includes("/history/")).data;
  assert.deepEqual(entry.plannedSnapshot.exercises[0].sets[0], { set: 1, reps: "10", weight: "40" });
  assert.equal(entry.exercises[0].sets[0].weight, "45");
  assert.equal(entry.exercises[0].sets[0].reps, "12");
  assert.equal(entry.exercises[0].video, "/trainer/bench.mp4");
  assert.equal(state.saved, true);
});

test("сохранение тренировки не подставляет системный совет в комментарий и сохраняет оценку отдельно", async () => {
  for (const feedback of POST_WORKOUT_FEEDBACK_OPTIONS) {
    for (const basic of [false, true]) {
      for (const comment of ["", "  Последний подход был тяжёлым.  "]) {
        writes = [];
        const plan = assignedPlan();
        if (basic) { plan.source = "basic"; plan.workouts[0].source = "basic"; }
        const readiness = { id: "good", title: "Нормально", emoji: "🙂", weightFactor: 1 };
        const { args, state } = saveFixture({ plan, workout: plan.workouts[0], workoutClientComment: comment,
          workoutReadiness: readiness, feedbackOverride: feedback });
        await saveCompletedWorkoutToFirebase(args);
        const entry = writes.find(item => item.path.includes("/history/")).data;
        assert.equal(state.saved, true);
        assert.deepEqual(entry.postWorkoutFeedback, { id: feedback.id, title: feedback.title, emoji: feedback.emoji, advice: feedback.advice });
        assert.deepEqual(entry.readiness, readiness);
        assert.equal(entry[basic ? "personalNote" : "clientComment"], comment.trim());
        assert.equal(Object.hasOwn(entry, basic ? "clientComment" : "personalNote"), false);
        assert.deepEqual(getWorkoutNoteItems([entry]).map(note => note.text), !basic && comment.trim() ? [comment.trim()] : []);
        assert.ok(writes.every(item => !/\/(telegramMessages|trainerTasks|trainerEvents)\//.test(item.path)), "finish не отправляет сообщения и уведомления");
      }
    }
  }
});

test("readiness captures prescription before adaptation and repeated readiness cannot change it", async () => {
  let plan = assignedPlan();
  const noOp = () => {};
  const handlers = createWorkoutReadinessHandlers({
    selectedWorkoutId: "day-a", history: [], timerTickRef: { current: 0 }, centerExerciseDeck: noOp,
    setWorkoutReadiness: noOp, setWorkoutReadinessPending: noOp, setWorkoutReadinessOpen: noOp, setPlan: update => { plan = update(plan); },
    setWorkoutStarted: noOp, setWorkoutStartedAt: noOp, setTimerTick: noOp, setWorkoutFinishedAt: noOp, setCurrentExerciseIndex: noOp, setSwipeDirection: noOp
  });
  handlers.applyWorkoutReadiness({ id: "bad", title: "Плохо" });
  assert.equal(plan.workouts[0].exercises[0].sets[0].weight, "34");
  assert.equal(plan.workouts[0].exercises[0].sets[0].targetWeight, "40");
  handlers.applyWorkoutReadiness({ id: "excellent", title: "Отлично" });
  assert.equal(plan.workouts[0].exercises[0].sets[0].weight, "42.5");
  const { args } = saveFixture({ plan, workout: plan.workouts[0] });
  await saveCompletedWorkoutToFirebase(args);
  const entry = writes.find(item => item.path.includes("/history/")).data;
  assert.equal(entry.plannedSnapshot.exercises[0].sets[0].weight, "40");
});

test("explicit empty/zero targets and timed prescriptions are retained", async () => {
  const plan = assignedPlan();
  plan.workouts[0].exercises[0].sets = [
    { reps: "8", weight: "5", targetWeight: 0, targetReps: "6", enteredWeight: "7", completed: true },
    { reps: "8", weight: "5", targetWeight: "", targetReps: "", completed: true },
    { durationSeconds: 60, targetDurationSeconds: 45, targetWeight: "", completed: true }
  ];
  await saveCompletedWorkoutToFirebase(saveFixture({ plan, workout: plan.workouts[0] }).args);
  const snapshot = writes.find(item => item.path.includes("/history/")).data.plannedSnapshot.exercises[0].sets;
  assert.deepEqual(snapshot, [{ set: 1, reps: "6", weight: 0 }, { set: 2, reps: "", weight: "" }, { set: 3, reps: "", weight: "", durationSeconds: 45 }]);
});

for (const finish of ["success", "failure"]) {
  for (const change of ["other-account", "same-object-relogin"]) {
    test(`delayed save ${finish} cannot change ${change} state or remove a newer draft`, async () => {
      const delay = deferred();
      transact = async callback => { const result = await callback(transaction()); await delay.promise; return result; };
      const { args, state, updates } = saveFixture();
      const saving = saveCompletedWorkoutToFirebase(args);
      await new Promise(resolve => setImmediate(resolve));
      if (change === "other-account") login({ uid: "b" }); else reloginSameObject();
      state.plan = { privateNew: true }; state.history = [{ id: "new-history" }]; state.saved = false; state.sync = "new-sync";
      values.set(getWorkoutDraftKey("a", "day-a"), "new-draft");
      const priorUpdates = updates.length;
      if (finish === "failure") delay.reject(new Error("connection-lost")); else delay.resolve();
      await saving;
      assert.equal(updates.length, priorUpdates);
      assert.deepEqual(state.plan, { privateNew: true });
      assert.deepEqual(state.history, [{ id: "new-history" }]);
      assert.equal(state.saved, false);
      assert.equal(state.sync, "new-sync");
      assert.equal(state.loads, 0);
      assert.equal(state.errors.length, 0);
      assert.equal(values.get(getWorkoutDraftKey("a", "day-a")), "new-draft");
      assert.equal(storage.getFailedHistoryQueue("b").length, 0);
      assert.equal(storage.getFailedHistoryQueue("a").length, finish === "failure" ? 1 : 0);
      assert.equal(args.workoutSaveInFlightRef.current, false);
    });
  }
}

test("a late loadHistory and a saved-card timer cannot publish into another auth session", async () => {
  const delay = deferred();
  const fixture = saveFixture({ loadHistory: () => delay.promise });
  const saving = saveCompletedWorkoutToFirebase(fixture.args);
  await new Promise(resolve => setImmediate(resolve));
  login({ uid: "b" });
  fixture.state.saved = false; fixture.state.sync = "b";
  delay.resolve(); await saving;
  assert.equal(fixture.state.saved, false);
  assert.equal(fixture.state.sync, "b");
  login({ uid: "a" });
  const second = saveFixture();
  await saveCompletedWorkoutToFirebase(second.args);
  const hide = timers.find(item => item.ms === 1800).callback;
  reloginSameObject(); second.state.card = "new-card";
  hide();
  assert.equal(second.state.card, "new-card");
});

test("save rechecks auth inside every deferred React updater", async () => {
  const queued = [];
  const setter = update => queued.push(update);
  const fixture = saveFixture(Object.fromEntries(["setPendingWorkoutFeedback", "setWorkoutIncompleteConfirmOpen", "setWorkoutHistorySyncState", "setWorkoutFinishedAt", "setTimerTick", "setIsSaving", "setIsWorkoutSaved", "setShowWorkoutSavedCard", "setHistory", "setPlan"].map(key => [key, setter])));
  await saveCompletedWorkoutToFirebase(fixture.args);
  assert.ok(queued.length > 8);
  reloginSameObject();
  const current = { onlyNewSession: true };
  for (const update of queued) assert.strictEqual(update(current), current);
});

test("older save completion never unlocks the new session's in-flight save", async () => {
  const releases = [];
  transact = callback => new Promise((resolve, reject) => releases.push(async () => { try { resolve(await callback(transaction())); } catch (error) { reject(error); } }));
  const ref = { current: false };
  const first = saveCompletedWorkoutToFirebase(saveFixture({ workoutSaveInFlightRef: ref }).args);
  reloginSameObject();
  const second = saveCompletedWorkoutToFirebase(saveFixture({ workoutSaveInFlightRef: ref, workoutStartedAt: 2000, isSaving: true }).args);
  const currentOperation = ref.current;
  assert.equal(releases.length, 2);
  await releases[0](); await first;
  assert.strictEqual(ref.current, currentOperation);
  await releases[1](); await second;
  assert.equal(ref.current, false);
});

test("full local storage does not block a cloud save or leave the save locked", async () => {
  localStorage.setItem = () => { throw new Error("quota"); };
  const { args, state } = saveFixture();
  await saveCompletedWorkoutToFirebase(args);
  assert.equal(writes.some(item => item.path.includes("/history/")), true);
  assert.equal(state.saved, true);
  assert.equal(state.saving, false);
  assert.equal(args.workoutSaveInFlightRef.current, false);
});

function historyFixture(overrides = {}) {
  const state = { history: [], loading: false, candidate: null, errors: [] };
  const setter = key => value => { state[key] = typeof value === "function" ? value(state[key]) : value; };
  const args = { auth, db: {}, historyDeleteCandidate: null, historyDeletingId: "", historySwipeId: "", historyTouchStartX: null,
    startPerformanceCheck() {}, endPerformanceCheck() {}, showAppError: (...error) => state.errors.push(error),
    setHistory: setter("history"), setHistoryLoading: setter("loading"), setHistorySwipeId: setter("swipe"), setHistoryTouchStartX: setter("touch"),
    setHistoryDeleteCandidate: setter("candidate"), setHistoryDeletingId: setter("deleting"), setOpenHistoryKey: setter("open"), ...overrides };
  return { state, args, handlers: createWorkoutHistoryHandlers(args) };
}

test("history load result/error from a prior generation cannot publish even for the same user object", async () => {
  for (const fail of [false, true]) {
    const delay = deferred(); readHistory = () => delay.promise;
    const fixture = historyFixture();
    const loading = fixture.handlers.loadHistory();
    await new Promise(resolve => setImmediate(resolve));
    reloginSameObject(); fixture.state.history = [{ id: "new" }]; fixture.state.loading = "new";
    if (fail) delay.reject(new Error("offline")); else delay.resolve({ forEach: fn => fn({ id: "old", data: () => ({ date: "2026-10-08" }) }) });
    await loading;
    assert.deepEqual(fixture.state.history, [{ id: "new" }]);
    assert.equal(fixture.state.loading, "new");
    assert.equal(fixture.state.errors.length, 0);
  }
});

test("history load guards deferred state callbacks and a delete confirmation from another session", async () => {
  const queued = [];
  const fixture = historyFixture({ setHistory: fn => queued.push(fn), setHistoryLoading: fn => queued.push(fn) });
  await fixture.handlers.loadHistory();
  fixture.handlers.requestDeleteOwnHistoryWorkout({ id: "old" });
  const candidate = fixture.state.candidate;
  reloginSameObject();
  const current = { newSession: true };
  for (const fn of queued) assert.strictEqual(fn(current), current);
  const next = historyFixture({ historyDeleteCandidate: candidate });
  await next.handlers.confirmDeleteOwnHistoryWorkout();
  assert.equal(writes.length, 0);
});

function planLoadFixture(overrides = {}) {
  const state = { plan: { newSession: true }, errors: [] };
  const args = { db: {}, auth, plan: assignedPlan(), storageKey: "plan", basicWorkoutPlanStorageKey: "basic", workoutModeStorageKey: "mode", workoutModePreference: { mode: "individual" },
    normalizeExercise: exercise => exercise, sortWorkoutDays: days => days, canUseAdminFeatures: () => false,
    startPerformanceCheck() {}, endPerformanceCheck() {}, showAppError: (...args) => state.errors.push(args), setPlan: update => { state.plan = update(state.plan); }, ...overrides };
  return { args, state };
}

test("workout plan loader rejects late result/error after same-object relogin, preserving new drafts/cache", async () => {
  for (const fail of [false, true]) {
    const delay = deferred();
    readHistory = () => delay.promise;
    const fixture = planLoadFixture();
    const loading = loadWorkoutsFromFirebaseWithDeps(fixture.args);
    await new Promise(resolve => setImmediate(resolve));
    reloginSameObject();
    values.set("plan:a", "new-plan-cache");
    values.set(getWorkoutDraftKey("a", "day-a"), "new-draft");
    if (fail) delay.reject(new Error("offline")); else delay.resolve({ docs: [], forEach() {} });
    assert.deepEqual(await loading, { workouts: [] });
    assert.deepEqual(fixture.state.plan, { newSession: true });
    assert.equal(values.get("plan:a"), "new-plan-cache");
    assert.equal(values.get(getWorkoutDraftKey("a", "day-a")), "new-draft");
    assert.deepEqual(fixture.state.errors, []);
  }
});

test("workout loader guards deferred successful and offline-cache plan setters", async () => {
  for (const fail of [false, true]) {
    const queued = [];
    readHistory = async path => {
      if (fail) throw new Error("offline");
      const docs = path.endsWith("/workouts") ? [{ id: "day-a", data: () => assignedPlan().workouts[0] }] : [];
      return { docs, forEach: callback => docs.forEach(callback) };
    };
    values.set("plan:a", JSON.stringify(assignedPlan()));
    const fixture = planLoadFixture({ setPlan: fn => queued.push(fn) });
    const result = await loadWorkoutsFromFirebaseWithDeps(fixture.args);
    assert.equal(result.workouts.length, 1);
    assert.equal(queued.length, 1);
    assert.equal(result.workouts[0].exercises[0].video, "/trainer/bench.mp4");
    reloginSameObject();
    const current = { privateNewSession: true };
    assert.strictEqual(queued[0](current), current);
  }
});

test("history replay acknowledges its old UID entry but neither loads nor unlocks a newer session", async () => {
  storage.enqueueFailedHistorySave("a", { clientSaveId: "old" });
  const delays = [];
  transact = callback => new Promise(resolve => delays.push(async () => resolve(await callback(transaction()))));
  const ref = { current: false };
  const events = [];
  const replay = () => replayFailedHistorySavesWithDeps({ auth, db: {}, uid: "a", historyReplayInProgressRef: ref,
    setWorkoutHistorySyncState: fn => events.push(fn), loadHistory: async () => events.push("load"), showAppError: () => events.push("notice") });
  const first = replay();
  reloginSameObject();
  const second = replay();
  const newSession = ref.current.get("a");
  await delays[0](); await first;
  assert.strictEqual(ref.current.get("a"), newSession);
  assert.deepEqual(events, []);
  await delays[1](); await second;
  assert.equal(ref.current.size, 0);
  assert.equal(events.filter(item => item === "load").length, 1);
  const updater = events.find(item => typeof item === "function");
  reloginSameObject();
  assert.equal(updater("new-sync"), "new-sync");
});

test("nutrition replay also rejects same-object logout/login and its deferred updater", async () => {
  storage.setFailedNutritionSync("a", { days: { privateOld: { foods: [] } } });
  const delay = deferred();
  transact = async callback => { const result = await callback(transaction()); await delay.promise; return result; };
  const updates = [], notices = [];
  const replay = replayFailedNutritionSyncWithDeps({ auth, uid: "a", nutritionReplayInProgressRef: { current: false }, setNutrition: fn => updates.push(fn), showAppError: (...args) => notices.push(args) });
  reloginSameObject(); delay.resolve(); await replay;
  assert.equal(updates.length, 0); assert.equal(notices.length, 0);
  transact = async callback => callback(transaction());
  storage.setFailedNutritionSync("a", { days: { privateOld: { foods: [] } } });
  await replayFailedNutritionSyncWithDeps({ auth, uid: "a", nutritionReplayInProgressRef: { current: false }, setNutrition: fn => updates.push(fn), showAppError() {} });
  reloginSameObject();
  const current = { __uid: "a", days: { privateNew: { foods: [] } } };
  assert.strictEqual(updates[0](current), current);
});

test("basic completion preserves the independently assigned trainer calendar", async () => {
  const basic = { id: "basic-1", basicPlanId: "basic-1", source: "basic", workouts: [{ ...assignedPlan().workouts[0], source: "basic", assignedProgramId: "", scheduledDate: "2026-10-10" }] };
  const otherSlot = { workoutId: "trainer-other", assignedProgramId: "program-b", assignedProgramAddedAt: "assignment-b", date: "2026-10-22", order: 1, status: "planned", coachNote: "keep" };
  const calendar = { planRevision: 7, scheduledDates: ["2026-10-10", "2026-10-22"], plannedWorkouts: [{ workoutId: "day-a", date: "2026-10-10", order: 1, status: "planned" }, otherSlot] };
  transact = async callback => callback({ ...transaction(), get: async ref => ref.path === "users/a" ? { exists: () => true, data: () => ({ basicWorkoutAccess: true, basicWorkoutPlan: basic, workoutCalendar: calendar }) } : { exists: () => false, data: () => ({}) } });
  await persistWorkoutCompletion({ db: {}, uid: "a", entry: { clientSaveId: "basic-save", finishedAt: "2026-10-10T12:00:00Z" }, completion: { plan: basic, workout: basic.workouts[0] } });
  const saved = writes.find(item => item.path === "users/a").data.workoutCalendar;
  assert.deepEqual(saved.plannedWorkouts.find(slot => slot.workoutId === "trainer-other"), otherSlot);
  assert.ok(saved.scheduledDates.includes("2026-10-22"));
  assert.equal(saved.planRevision, 8);
});

test("revoked basic access preserves an in-flight result without advancing its plan or calendar", async () => {
  const basic = { id: "basic-1", basicPlanId: "basic-1", source: "basic", workouts: [{ ...assignedPlan().workouts[0], source: "basic", assignedProgramId: "" }] };
  transact = async callback => callback({ ...transaction(), get: async ref => ref.path === "users/a"
    ? { exists: () => true, data: () => ({ basicWorkoutAccess: false, basicWorkoutPlan: basic }) }
    : { exists: () => false, data: () => ({}) } });
  const result = await persistWorkoutCompletion({ db: {}, uid: "a", entry: { clientSaveId: "revoked-basic-save", finishedAt: "2026-10-10T12:00:00Z" }, completion: { plan: basic, workout: basic.workouts[0] } });
  assert.equal(result.saved, true);
  assert.equal(result.plan, null);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "users/a/history/revoked-basic-save");
  assert.equal(writes[0].data.completionApplied, true);
});
