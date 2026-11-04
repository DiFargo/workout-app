import assert from "node:assert/strict";
import test from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let io;
const noop = () => {};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const cleanup = installRuntimeImports({
  "/src/firebase.js": { auth: { currentUser: null }, db: {} },
  "firebase/firestore": { collection: (_db, ...parts) => parts.join("/"), doc: (_db, ...parts) => parts.join("/"),
    getDocs: path => io.getDocs(path), getDoc: path => io.getDoc(path), setDoc: (...args) => io.setDoc(...args), writeBatch: noop },
  "/src/features/client/workouts/workoutCompletionPersistence.js": { deleteOwnWorkoutHistory: (...args) => io.delete(...args) },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout: (...args) => io.media(...args) }
});
const { loadWorkoutsFromFirebaseWithDeps, isServerConfirmedWorkoutPlan, getWorkoutPlanReadOrigin, invalidateWorkoutPlan } = await import("../src/features/client/workouts/workoutFirebaseLoadHandlers.js");
const { createWorkoutHistoryHandlers } = await import("../src/features/client/workouts/workoutHistoryHandlers.js");
const { createWorkoutEntryNavigation } = await import("../src/features/client/workouts/workoutEntryNavigation.js");
const { createWorkoutOpenHandlers } = await import("../src/features/client/workouts/workoutOpenHandlers.js");
const { invalidateWorkoutHistory } = await import("../src/utils/workoutHistoryResource.js");
const { buildWorkoutReadModel } = await import("../src/utils/workoutReadModel.js");
cleanup();

function snapshot(records, fromCache = false) {
  const docs = records.map(row => ({ id: row.id, data: () => structuredClone(row), metadata: { fromCache } }));
  return { docs, metadata: { fromCache }, forEach: fn => docs.forEach(fn) };
}
function harness() {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
    get length() { return storage.size; }, key: index => [...storage.keys()][index] };
  const auth = { currentUser: { uid: "synthetic" } }; advanceAuthSession(auth);
  const workout = { id: "day", assignedProgramId: "p", assignedProgramUpdatedAt: "v1", exercises: [{ id: "e", name: "Жим", sets: [] }] };
  const state = { plan: { workouts: [] }, history: [], calls: [], states: [], writes: 0, fromCache: false };
  const setter = key => update => { state[key] = typeof update === "function" ? update(state[key]) : update; };
  io = {
    getDocs: async path => { state.calls.push(path); return snapshot(path.endsWith("history") ? [] : [workout], state.fromCache); },
    getDoc: async path => { state.calls.push(path); return { exists: () => true, data: () => ({ assignedProgramId: "p", assignedProgramUpdatedAt: "v1" }), metadata: { fromCache: state.fromCache } }; },
    setDoc: async () => { state.writes++; }, delete: async () => {},
    media: async () => ({ ok: true, json: async () => ({ media: [] }) })
  };
  const context = () => ({ auth, db: {}, plan: state.plan, storageKey: "plan", basicWorkoutPlanStorageKey: "basic", workoutModeStorageKey: "mode", workoutModePreference: { mode: "individual", remember: false },
    normalizeExercise: value => value, sortWorkoutDays: value => value, canUseAdminFeatures: () => false,
    startPerformanceCheck: noop, endPerformanceCheck: noop, showAppError: noop, setPlan: setter("plan") });
  const load = options => loadWorkoutsFromFirebaseWithDeps({ ...context(), options: { ...options, onLoadReady: () => state.states.push("ready") } });
  const history = extra => createWorkoutHistoryHandlers(new Proxy({ ...context(), setHistory: setter("history"), ...extra }, { get: (target, key) => key === "captureSession" ? undefined : key in target ? target[key] : noop }));
  return { auth, state, setter, load, context, history, workout };
}

test("same plan and full history overlap share logical reads; all history and previous results stay available", async () => {
  const h = harness(), gate = deferred(), original = io.getDocs;
  io.getDocs = path => path.endsWith("history") ? (h.state.calls.push(path), gate.promise) : original(path);
  const first = h.load(), second = h.load(), history = h.history().loadHistory(); await flush();
  assert.equal(h.state.calls.length, 3);
  const rows = Array.from({ length: 100 }, (_, index) => ({ id: `h${index}`, date: `2026-10-${String(index % 20 + 1).padStart(2, "0")}`, exercises: [] }));
  gate.resolve(snapshot(rows)); await Promise.all([first, second, history]);
  assert.equal(h.state.history.length, 100);
  assert.equal(h.state.plan.workouts[0].id, "day");
});

test("force supersedes old history response and stale errors; deletion prevents late resurrection", async () => {
  for (const rejectOld of [false, true]) {
    const h = harness(), old = deferred(); let reads = 0;
    io.getDocs = () => ++reads === 1 ? old.promise : Promise.resolve(snapshot([{ id: "new", date: "2026-10-25" }]));
    const pending = h.history().loadHistory(); await flush();
    await h.history().loadHistory({ force: true });
    if (rejectOld) old.reject(new Error("obsolete")); else old.resolve(snapshot([{ id: "old" }]));
    await pending; assert.equal(h.state.history[0].id, "new");
  }
  const h = harness(), old = deferred(); io.getDocs = () => old.promise;
  const pending = h.history().loadHistory(); await flush();
  await h.history({ historyDeleteCandidate: { id: "deleted" } }).confirmDeleteOwnHistoryWorkout();
  old.resolve(snapshot([{ id: "deleted" }])); await pending;
  assert.deepEqual(h.state.history, []);
});

test("server origin is distinct from cache without changing existing offline readiness", async () => {
  const h = harness(); await h.load();
  assert.equal(isServerConfirmedWorkoutPlan(h.auth, h.state.plan, "individual"), true);
  const count = h.state.calls.length, original = h.state.plan;
  await h.load({ maxAgeMs: 3000 });
  assert.equal(h.state.calls.length, count); assert.equal(h.state.plan, original);
  invalidateWorkoutHistory(h.auth); await h.load({ maxAgeMs: 3000 });
  assert.ok(h.state.calls.length > count);
  h.state.fromCache = true; await h.load({ force: true });
  assert.equal(getWorkoutPlanReadOrigin(h.auth, h.state.plan, "individual"), "cache");
  assert.equal(isServerConfirmedWorkoutPlan(h.auth, h.state.plan, "individual"), false);
  assert.equal(h.state.states.at(-1), "ready");
  invalidateWorkoutPlan(h.auth); assert.equal(getWorkoutPlanReadOrigin(h.auth, h.state.plan, "individual"), "unknown");
  await h.load(); advanceAuthSession(h.auth);
  assert.equal(isServerConfirmedWorkoutPlan(h.auth, h.state.plan, "individual"), false);
});

test("unchanged entry mode does not write profile again", () => {
  const h = harness();
  createWorkoutEntryNavigation({ ...h.context(), WORKOUT_MODE_STORAGE_KEY: "mode", workoutModeRemember: false }).saveWorkoutModePreference("individual", false);
  assert.equal(h.state.writes, 0);
});

test("TTL entry does not cancel optional late media or replace the published plan", async () => {
  const h = harness(), media = deferred(); io.media = () => media.promise;
  await h.load(); const original = h.state.plan;
  await h.load({ maxAgeMs: 3000 }); assert.equal(h.state.plan, original);
  media.resolve({ ok: true, json: async () => ({ media: [{ workoutId: "day", exerciseId: "e", exerciseName: "Жим", assignmentVersion: "v1", video: "/synthetic.mp4" }] }) });
  await flush(); assert.equal(h.state.plan.workouts[0].exercises[0].video, "/synthetic.mp4");
});

test("restart cannot reopen missing fresh workout and preserves the original draft", async () => {
  const h = harness(); h.state.plan = { assignedProgramUpdatedAt: "v1", workouts: [h.workout] };
  let selected = null, readiness = false;
  const settings = new Proxy({ ...h.context(), user: h.auth.currentUser, history: [], APP_PAGES: {},
    workoutDraftRestorePrompt: { workoutId: "day", savedDraft: {} },
    setSelectedWorkoutId: value => { selected = value; }, setWorkoutReadinessOpen: value => { readiness = value; },
    loadWorkoutsFromFirebase: async (_uid, options) => { assert.equal(options.force, true); return { workouts: [] }; }
  }, { get: (target, key) => key in target ? target[key] : noop });
  await createWorkoutOpenHandlers(settings).handleWorkoutDraftChoice(false);
  assert.equal(selected, null); assert.equal(readiness, false);
});

test("shadow projection preserves UI completion/manual provenance, full previous results and refuses partial history", () => {
  const plan = { assignedProgramUpdatedAt: "v1", workouts: [{ id: "day", status: "missed", exercises: [{ id: "e" }] }, { id: "manual", status: "completed" }] };
  const history = [{ id: "done", workoutId: "day", assignedProgramUpdatedAt: "v1", date: "2026-10-25", exercises: [{ id: "e", sets: [{ reps: 10, weight: 20 }] }] }];
  assert.equal(buildWorkoutReadModel({ plan, history }).completion, null);
  const model = buildWorkoutReadModel({ plan, history, historyComplete: true });
  assert.equal(model.completion[0].completed, true); assert.deepEqual(model.completion[0].historyIds, ["done"]);
  assert.equal(model.completion[1].completed, true); assert.deepEqual(model.completion[1].historyIds, []);
  assert.ok(model.latestResults.day["id:e"]);
  const deleted = buildWorkoutReadModel({ plan, history: [], historyComplete: true });
  assert.equal(deleted.completion[0].completed, false); assert.equal(deleted.completion[1].completed, true);
});
