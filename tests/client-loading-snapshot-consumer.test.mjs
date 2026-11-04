import assert from "node:assert/strict";
import test, { after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { compactWorkoutLoadingData } from "../functions/clientLoadingSnapshot.js";

const noop = () => {};
let directReads = 0;
const cleanup = installRuntimeImports({
  "/src/firebase.js": { auth: { currentUser: null }, db: {} },
  "firebase/firestore": { collection: noop, doc: noop, writeBatch: noop, setDoc: noop,
    getDocs: async () => { directReads++; throw new Error("Unexpected full collection read"); },
    getDoc: async () => { directReads++; throw new Error("Unexpected profile read"); } },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout: async () => ({ ok: true, json: async () => ({ media: [] }) }) }
});
after(cleanup);
const { loadWorkoutsFromFirebaseWithDeps, isServerConfirmedWorkoutPlan, invalidateWorkoutPlan } = await import("../src/features/client/workouts/workoutFirebaseLoadHandlers.js");
const { getClientWorkoutCompletionHistory, getClientWorkoutReadModel } = await import("../src/utils/clientWorkoutEvidence.js");
const { buildCompletedWorkoutSet, isWorkoutCompletedWithSet } = await import("../src/utils/workoutCompletion.js");
const { buildWorkoutPageDerivedState } = await import("../src/utils/workoutPageDerivedState.js");
const { invalidateWorkoutHistory } = await import("../src/utils/workoutHistoryRevision.js");
const { readClientLoadingSnapshot } = await import("../src/utils/clientLoadingSnapshot.js");
const { createWorkoutOpenHandlers } = await import("../src/features/client/workouts/workoutOpenHandlers.js");

function harness() {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key), get length() { return storage.size; }, key: index => [...storage.keys()][index] };
  const auth = { currentUser: { uid: "client" } }; advanceAuthSession(auth);
  const profile = { role: "client", assignedProgramId: "program", assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "2026-10-01" };
  const days = ["day1", "day2"].map(id => ({ id, assignedProgramId: "program", assignedProgramUpdatedAt: "v1",
    assignedProgramAddedAt: profile.assignedProgramAddedAt, exercises: [{ id: "press", name: "Жим", sets: [] }] }));
  const history = [{ id: "completed", workoutId: "day1", assignedProgramId: "program", assignedProgramUpdatedAt: "v1",
    assignedProgramAddedAt: profile.assignedProgramAddedAt, date: "2026-10-20", exercises: [{ id: "press", sets: [{ reps: 8, weight: 30 }] }] }];
  const snap = rows => ({ docs: rows.map(row => ({ id: row.id, data: () => row })) });
  const dto = { schemaVersion: 1, kind: "workouts", uid: "client", sourceRevision: "a".repeat(64), verifiedAt: "2026-10-25T12:00:00Z",
    coverage: { profile: "complete", workouts: "complete", history: "complete" }, sourceCounts: { workouts: 2, history: 1 },
    ...compactWorkoutLoadingData(profile, snap(days), snap(history)) };
  const state = { plan: { workouts: [] }, ready: 0, errors: [] };
  const deps = { auth, db: {}, storageKey: "plan", basicWorkoutPlanStorageKey: "basic", workoutModeStorageKey: "mode",
    workoutModePreference: { mode: "individual" }, normalizeExercise: value => value, sortWorkoutDays: value => value,
    canUseAdminFeatures: () => false, startPerformanceCheck: noop, endPerformanceCheck: noop,
    showAppError: (...args) => state.errors.push(args), setPlan: value => { state.plan = typeof value === "function" ? value(state.plan) : value; } };
  const load = options => loadWorkoutsFromFirebaseWithDeps({ ...deps, plan: state.plan,
    options: { readSnapshot: async () => dto, onLoadReady: () => { state.ready++; }, ...options } });
  return { auth, dto, state, deps, load, history };
}

test("verified compact bootstrap keeps completion and previous exercise results without reading or filling global full history", async () => {
  const h = harness(); directReads = 0;
  const plan = await h.load();
  assert.equal(directReads, 0);
  assert.equal(h.state.ready, 1);
  assert.equal(isServerConfirmedWorkoutPlan(h.auth, plan, "individual"), true);
  const completed = buildCompletedWorkoutSet(getClientWorkoutCompletionHistory(plan, []), "v1", {}, plan.workouts);
  assert.equal(isWorkoutCompletedWithSet(plan.workouts[0], completed, "v1"), true);
  assert.equal(isWorkoutCompletedWithSet(plan.workouts[1], completed, "v1"), false);
  assert.equal(buildWorkoutPageDerivedState({ plan, selectedWorkoutId: "day2", history: [] }).lastExerciseResults["id:press"], "1×8 · 30 кг");
  assert.equal(getClientWorkoutCompletionHistory(plan, [])[0].exercises, undefined);
  let historyLoads = 0;
  const handlers = createWorkoutOpenHandlers(new Proxy({ ...h.deps, user: h.auth.currentUser, plan, history: [], APP_PAGES: {},
    loadHistory: () => { historyLoads++; } }, { get: (target, key) => key in target ? target[key] : noop }));
  await handlers.openWorkout("day2"); assert.equal(historyLoads, 0);
  await handlers.openWorkout("day1"); assert.equal(historyLoads, 1, "opening completed-workout history still loads the full source on demand");
});

test("persisted JSON is not authority; auth/history/plan invalidation immediately revokes compact evidence", async () => {
  const h = harness(); const plan = await h.load();
  assert.equal(getClientWorkoutReadModel(JSON.parse(JSON.stringify(plan))), null);
  invalidateWorkoutHistory(h.auth); assert.equal(getClientWorkoutReadModel(plan), null);
  const next = await h.load(); assert.ok(getClientWorkoutReadModel(next));
  invalidateWorkoutPlan(h.auth); assert.equal(getClientWorkoutReadModel(next), null);
  const after = await h.load(); advanceAuthSession(h.auth, h.auth.currentUser); assert.equal(getClientWorkoutReadModel(after), null);
});

test("partial snapshot and access errors never become ready or silently fall back to saved online data", async () => {
  const h = harness(); await h.load(); const ready = h.state.ready;
  const oldError = console.error; console.error = noop;
  try {
    const result = await h.load({ requireFresh: true, readSnapshot: async () => ({ ...h.dto, coverage: { ...h.dto.coverage, history: "partial" } }) });
    assert.equal(result, null); assert.equal(h.state.ready, ready);
    assert.equal(await h.load({ readSnapshot: async () => { throw Object.assign(new Error("Forbidden"), { status: 403 }); } }), null);
    assert.equal(h.state.ready, ready);
  } finally { console.error = oldError; }
});

test("snapshot adapter uses one own-user request and rejects late results after same-UID login changes", async () => {
  const h = harness(); let requestOptions;
  const dto = await readClientLoadingSnapshot({ auth: h.auth, request: async (url, options) => {
    assert.equal(url, "/api/client-loading-snapshot"); requestOptions = options;
    return { ok: true, json: async () => ({ snapshot: h.dto }) };
  } });
  assert.equal(dto.uid, "client"); assert.deepEqual(JSON.parse(requestOptions.body), { kind: "workouts" });
  let resolve;
  const pending = readClientLoadingSnapshot({ auth: h.auth, request: () => new Promise(yes => { resolve = yes; }) });
  advanceAuthSession(h.auth, h.auth.currentUser);
  resolve({ ok: true, json: async () => ({ snapshot: h.dto }) });
  await assert.rejects(pending, { code: "loading/session-changed" });
});
