import assert from "node:assert/strict";
import test from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let io;
const stubAuth = { currentUser: null };
const cleanup = installRuntimeImports({
  "firebase/firestore": {
    collection: (_db, ...parts) => parts.join("/"), doc: (_db, ...parts) => parts.join("/"),
    getDocs: ref => io.getDocs(ref), getDoc: ref => io.getDoc(ref), setDoc: async () => {}
  },
  "/src/firebase.js": { auth: stubAuth, db: {} },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout: (...args) => io.media(...args) },
  "/src/features/client/offline/offlineReplayHandlers.js": { replayFailedHistorySavesWithDeps: async () => {}, replayFailedNutritionSyncWithDeps: async () => {} },
  "/src/features/client/workouts/workoutPlanFirebaseSaveHandlers.js": { saveWorkoutsToFirebaseWithDeps: async () => {} },
  "/src/features/client/workouts/workoutPlanUpdateHandlers.js": { saveTrainerNextPlanWithDeps: async () => {} }
});
const { loadWorkoutsFromFirebaseWithDeps, isConfirmedWorkoutPlan } = await import("../src/features/client/workouts/workoutFirebaseLoadHandlers.js");
const { createWorkoutPersistenceHandlers } = await import("../src/features/client/workouts/workoutPersistenceHandlers.js");
const { createWorkoutEntryNavigation } = await import("../src/features/client/workouts/workoutEntryNavigation.js");
cleanup();

const snapshot = records => {
  const docs = records.map(record => ({ id: record.id, data: () => structuredClone(record) }));
  return { docs, forEach: fn => docs.forEach(fn) };
};
function harness() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
    get length() { return values.size; }, key: index => [...values.keys()][index] };
  const auth = { currentUser: { uid: "client" } };
  advanceAuthSession(auth);
  const profile = { assignedProgramId: "program", assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "2026-10-01T00:00:00Z" };
  const workout = { id: "workout", assignedProgramId: "program", assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: profile.assignedProgramAddedAt,
    name: "Назначенная тренировка", exercises: [{ id: "exercise", name: "Жим", video: "", sets: [{ reps: 10 }] }] };
  const state = { plan: { workouts: [] }, states: [], errors: [], started: false, selectedUserId: null, history: [], workouts: [workout], profile, values };
  io = {
    getDocs: async ref => snapshot(ref.endsWith("/history") ? state.history : state.workouts),
    getDoc: async () => ({ exists: () => true, data: () => structuredClone(state.profile) }),
    media: async () => ({ ok: true, json: async () => ({ media: [] }) })
  };
  const context = () => ({ auth, db: {}, plan: state.plan, selectedUserId: state.selectedUserId, workoutStarted: state.started,
    workoutModePreference: { mode: "individual" }, STORAGE_KEY: "plan", BASIC_WORKOUT_PLAN_STORAGE_KEY: "basic", WORKOUT_MODE_STORAGE_KEY: "mode",
    normalizeExercise: value => value, sortWorkoutDays: value => value, canUseAdminFeatures: () => false,
    startPerformanceCheck() {}, endPerformanceCheck() {}, showAppError: (...args) => state.errors.push(args),
    onOwnPlanLoadState: value => state.states.push(value),
    setPlan: value => { state.plan = typeof value === "function" ? value(state.plan) : value; }
  });
  const load = options => createWorkoutPersistenceHandlers(context).loadWorkoutsFromFirebase("client", options);
  const direct = options => {
    const ctx = context();
    return loadWorkoutsFromFirebaseWithDeps({ ...ctx, storageKey: "plan", basicWorkoutPlanStorageKey: "basic", workoutModeStorageKey: "mode", options,
      userIdFromClick: "client", isCurrentRequest: () => !state.started });
  };
  const media = [{ workoutId: "workout", exerciseId: "exercise", exerciseName: "Жим", assignmentVersion: "v1", video: "/new.mp4", videoPosterTime: 2 }];
  return { auth, state, context, load, direct, media };
}

test("slow optional media never delays ready; its late result enriches only the published snapshot", async () => {
  const h = harness(), request = deferred();
  io.media = () => request.promise;
  const plan = await h.load();
  assert.deepEqual(h.state.states, ["loading", "ready"]);
  assert.equal(plan.workouts[0].exercises[0].video, "");
  request.resolve({ ok: true, json: async () => ({ media: h.media }) });
  await flush();
  assert.equal(h.state.plan.workouts[0].exercises[0].videoPosterTime, 2);
  assert.equal(isConfirmedWorkoutPlan(h.auth, h.state.plan, "individual"), true);
  assert.deepEqual(h.state.states, ["loading", "ready"]);
});

test("history stays critical: a delayed completion cannot briefly expose the completed assignment", async () => {
  const h = harness(), history = deferred(), original = io.getDocs;
  io.getDocs = ref => ref.endsWith("/history") ? history.promise : original(ref);
  const pending = h.load(); await flush();
  assert.deepEqual(h.state.states, ["loading"]);
  assert.equal(h.state.plan.workouts.length, 0);
  history.resolve(snapshot([{ id: "done", workoutId: "workout", assignedProgramId: "program", assignedProgramAddedAt: h.state.profile.assignedProgramAddedAt, date: "2026-10-02T00:00:00Z" }]));
  const result = await pending;
  assert.equal(result.workouts.length, 0);
  assert.deepEqual(h.state.states, ["loading", "ready"]);
});

test("critical history timeout releases an error/retry state, never ready; a retry can succeed", async () => {
  const h = harness(), history = deferred(), original = io.getDocs;
  io.getDocs = ref => ref.endsWith("/history") ? history.promise : original(ref);
  const oldError = console.error; console.error = () => {};
  try { await h.load({ timeoutMs: 15 }); } finally { console.error = oldError; }
  assert.deepEqual(h.state.states, ["loading", "error"]);
  assert.equal(isConfirmedWorkoutPlan(h.auth, h.state.plan, "individual"), false);
  history.resolve(snapshot([])); await flush();
  assert.deepEqual(h.state.states, ["loading", "error"]);
  io.getDocs = original;
  await h.load();
  assert.deepEqual(h.state.states, ["loading", "error", "loading", "ready"]);
});

test("a failed background refresh revokes confirmation instead of keeping stale access ready", async () => {
  const h = harness(); await h.load();
  const confirmed = h.state.plan, original = io.getDocs;
  io.getDocs = ref => ref.endsWith("/history") ? new Promise(() => {}) : original(ref);
  const oldError = console.error; console.error = () => {};
  try { await h.load({ timeoutMs: 15, preserveCurrentPlanOnError: true }); } finally { console.error = oldError; }
  assert.equal(h.state.plan, confirmed);
  assert.equal(isConfirmedWorkoutPlan(h.auth, confirmed, "individual"), false);
  assert.deepEqual(h.state.states, ["loading", "ready", "error"]);
});

test("the fresh profile still excludes a removed assignment even when the cached plan exists", async () => {
  const h = harness(); await h.load();
  h.state.profile.assignedProgramId = "replacement";
  await h.load();
  assert.equal(h.state.plan.workouts.length, 0);
  assert.deepEqual(h.state.states, ["loading", "ready", "ready"]);
});

test("same-session confirmed refresh stays visible, including a real repeat navigation", async () => {
  const h = harness(); await h.load();
  const confirmed = h.state.plan, history = deferred(), original = io.getDocs;
  h.state.values.set("plan:client", JSON.stringify({ workouts: [{ id: "stale-cache" }] }));
  io.getDocs = ref => ref.endsWith("/history") ? history.promise : original(ref);
  let pending;
  const oldWindow = globalThis.window;
  globalThis.window = { requestAnimationFrame: fn => fn(), scrollTo() {} };
  try {
    const noop = () => {};
    createWorkoutEntryNavigation({ ...h.context(), APP_PAGES: { WORKOUTS: "workouts" },
      setWorkoutModePreference: noop, setWorkoutModeRemember: noop, setSelectedWorkoutId: noop,
      setIndividualWorkoutIndex: noop, setIndividualWorkoutIndexInitialized: noop, setPage: noop,
      loadWorkoutsFromFirebase: (...args) => { pending = createWorkoutPersistenceHandlers(h.context).loadWorkoutsFromFirebase(...args); return pending; }
    }).openIndividualWorkouts();
    await flush();
    assert.equal(h.state.plan, confirmed);
    assert.deepEqual(h.state.states, ["loading", "ready"]);
    history.resolve(snapshot([])); await pending;
    assert.deepEqual(h.state.states, ["loading", "ready", "ready"]);
  } finally { globalThis.window = oldWindow; }
});

test("local cache, mode switches and same-UID new auth sessions cannot reuse confirmation", async () => {
  const h = harness(); await h.load();
  const confirmed = h.state.plan;
  assert.equal(isConfirmedWorkoutPlan(h.auth, JSON.parse(JSON.stringify(confirmed)), "individual"), false);
  assert.equal(isConfirmedWorkoutPlan(h.auth, confirmed, "basic"), false);
  advanceAuthSession(h.auth);
  assert.equal(isConfirmedWorkoutPlan(h.auth, confirmed, "individual"), false);
  const request = deferred(), original = io.getDocs;
  io.getDocs = ref => ref.endsWith("/history") ? request.promise : original(ref);
  const pending = h.load(); await flush();
  assert.deepEqual(h.state.states, ["loading", "ready", "loading"]);
  request.resolve(snapshot([])); await pending;
});

test("late media fills every active exercise preview while preserving performed sets, notes and confirmation boundaries", async () => {
  const h = harness(), request = deferred(), source = "gs://synthetic.test/exercise-videos/demo.mp4";
  h.state.workouts[0].exercises = Array.from({ length: 3 }, (_, index) => ({ id: `e${index}`, name: `Упражнение ${index}`,
    video: source, rest: "90 сек", sets: [{ reps: 12, weight: 20, completed: false }] }));
  const media = h.state.workouts[0].exercises.map(exercise => ({ workoutId: "workout", exerciseId: exercise.id,
    exerciseName: exercise.name, assignmentVersion: "v1", card: { id: `card-${exercise.id}`, ownerUid: "trainer",
      name: "Новое название из библиотеки", video: source, videoPosterTime: 2.1, technique: "Другая инструкция" } }));
  io.media = () => request.promise;
  await h.load();
  assert.equal(h.state.plan.workouts[0].exercises.every(exercise => exercise.videoPosterTime === undefined), true);
  h.state.started = true;
  h.state.plan = { ...h.state.plan, workoutClientComment: "Текущий комментарий", workouts: h.state.plan.workouts.map(workout => ({ ...workout,
    exercises: workout.exercises.map((exercise, index) => index ? exercise : { ...exercise, clientNote: "Моя заметка", note: "Локальное описание",
      sets: [{ reps: 12, weight: 20, enteredReps: "12", enteredWeight: "25", completed: true }] }) })) };
  const current = h.state.plan, exercise = current.workouts[0].exercises[0];
  assert.equal(isConfirmedWorkoutPlan(h.auth, current, "individual"), false);
  request.resolve({ ok: true, json: async () => ({ media }) }); await flush();
  assert.equal(h.state.plan.workouts[0].exercises.every(item => item.videoPosterTime === 2.1), true);
  assert.equal(h.state.plan.workouts[0].exercises[0].sets, exercise.sets);
  assert.equal(h.state.plan.workouts[0].exercises[0].clientNote, "Моя заметка");
  assert.equal(h.state.plan.workouts[0].exercises[0].note, "Локальное описание");
  assert.equal(h.state.plan.workouts[0].exercises[0].name, exercise.name);
  assert.equal(h.state.plan.workoutClientComment, "Текущий комментарий");
  assert.equal(isConfirmedWorkoutPlan(h.auth, h.state.plan, "individual"), false);
  assert.deepEqual(h.state.states, ["loading", "ready"]);
});

test("late media cannot cross a new assignment, generation, selection, mode or auth session", async () => {
  for (const scenario of ["assignment", "generation", "selection", "mode", "auth"]) {
    const h = harness(), request = deferred();
    io.media = () => request.promise;
    await h.load();
    h.state.started = true;
    if (scenario === "auth") advanceAuthSession(h.auth);
    if (scenario === "selection") h.state.selectedUserId = "another-client";
    if (scenario === "mode") h.state.values.set("mode:client", JSON.stringify({ mode: "basic" }));
    if (scenario === "assignment") {
      h.state.plan = { ...h.state.plan, assignedProgramId: "replacement", workouts: h.state.plan.workouts.map(workout => ({ ...workout,
        assignedProgramId: "replacement", assignedProgramUpdatedAt: "v2" })) };
    }
    if (scenario === "generation") {
      h.state.started = false;
      io.media = async () => ({ ok: true, json: async () => ({ media: [] }) });
      await h.load({ force: true });
    }
    const expected = h.state.plan;
    request.resolve({ ok: true, json: async () => ({ media: h.media }) }); await flush();
    assert.equal(h.state.plan, expected, scenario);
  }
});
