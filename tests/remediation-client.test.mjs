import assert from "node:assert/strict";
import { test, after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let currentRunner;
let photoIo;
let historyIo;
let cloudIo = async () => ({});
let barcodeIo = async () => null;
const auth = { currentUser: { uid: "A" } };
const cleanup = installRuntimeImports({
  react: {
    useRef: initial => currentRunner.ref(initial),
    useEffect: (effect, deps) => currentRunner.effect(effect, deps)
  },
  "/firebase.js": { auth, db: {} },
  "/apiClient.js": { fetchAuthorizedWithTimeout: (...args) => photoIo(...args) },
  "/localNutritionCatalog.js": { findLocalNutritionFoodByBarcode: (...args) => barcodeIo(...args), searchLocalNutritionFoods: async () => [] },
  "/nutritionStateStorage.js": { saveNutritionStateWithMerge: (...args) => cloudIo(...args) },
  "/progressPhotoPersistence.js": { persistProgressPhotos: async () => ({}) },
  "/measurementPersistence.js": { persistMeasurement: async () => ({}) },
  "/firebaseStorage.js": { uploadStorageFile: async () => ({}) },
  "firebase/firestore": {
    collection: (_, ...parts) => parts.join("/"), getDocs: (...args) => historyIo(...args),
    doc: (_, ...parts) => parts.join("/"), writeBatch: () => ({}),
    runTransaction: async () => ({})
  }
});
after(cleanup);
const { createNutritionPhotoAiHandlers } = await import("../src/features/client/nutrition/nutritionPhotoAiHandlers.js");
const { useNutritionRuntimeEffects } = await import("../src/features/client/nutrition/useNutritionRuntimeEffects.js");
const { createProfileProgressHandlers } = await import("../src/features/client/profile/profileProgressHandlers.js");
const { createWorkoutHistoryHandlers } = await import("../src/features/client/workouts/workoutHistoryHandlers.js");
const { createWorkoutOpenHandlers } = await import("../src/features/client/workouts/workoutOpenHandlers.js");
const { useWallClockCountdown, useWorkoutRuntimeEffects } = await import("../src/features/client/workouts/useWorkoutRuntimeEffects.js");
const { createNutritionSelectedFoodDeleteHandlers } = await import("../src/features/client/nutrition/nutritionSelectedFoodDeleteHandlers.js");
const { setFailedHistoryQueue } = await import("../src/utils/offlineSyncStorage.js");
const { measureNutritionDocument, assertNutritionDocumentBudget } = await import("../src/utils/nutritionDocumentBudget.js");
const { mergeNutritionStates } = await import("../src/utils/nutritionStateMerge.js");

function deferred() {
  let resolve, reject;
  return { promise: new Promise((yes, no) => { resolve = yes; reject = no; }), resolve: value => resolve(value), reject: error => reject(error) };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(extra = {}) {
  const state = {};
  const setters = new Map();
  const context = new Proxy(extra, { get(target, key) {
    if (key in target) return target[key];
    if (["captureAuthSession", "captureSession", "isWorkoutSaved", "workoutFinishedAt", "workoutStartedAt", "warmupTimerRunning", "restTimerRunning", "warmupTimerSeconds", "restTimerSeconds", "workoutVideoCacheKey", "nutritionCloudReady"].includes(key)) return undefined;
    if (!setters.has(key)) setters.set(key, value => { state[key] = typeof value === "function" ? value(state[key]) : value; });
    return setters.get(key);
  } });
  return { state, context };
}
function login(user) { auth.currentUser = user; advanceAuthSession(auth); }
function environment() {
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
  globalThis.window = new EventTarget();
  const intervals = new Set();
  window.setInterval = fn => { intervals.add(fn); return fn; };
  window.clearInterval = fn => intervals.delete(fn);
  window.clearTimeout = () => {};
  globalThis.document = new EventTarget();
  document.visibilityState = "visible";
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true, vibrate() {} } });
  return { store, tick: () => [...intervals].forEach(fn => fn()), intervals };
}
class HookRunner {
  slots = [];
  render(fn) {
    this.index = 0; this.pending = []; currentRunner = this; fn();
    this.pending.forEach(run => run()); currentRunner = null;
  }
  ref(initial) { const i = this.index++; return this.slots[i] ||= { current: initial }; }
  effect(fn, deps) {
    const i = this.index++, previous = this.slots[i];
    if (previous && deps?.every((dep, n) => Object.is(dep, previous.deps[n]))) return;
    this.pending.push(() => { previous?.cleanup?.(); this.slots[i] = { deps, cleanup: fn() }; });
  }
  unmount() { this.slots.forEach(slot => slot?.cleanup?.()); this.slots = []; }
}

for (const relogin of [false, true]) test(`photo AI suppresses old success/error after ${relogin ? "same-account re-login" : "account switch"}`, async () => {
  environment(); login({ uid: "A" });
  document.createElement = () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,eA==" });
  globalThis.Image = class { width = 20; height = 20; set src(value) { queueMicrotask(() => this.onload()); } };
  const pending = deferred(); photoIo = () => pending.promise;
  const lastFile = { current: null };
  const { context, state } = harness({ auth, nutrition: { myFoods: {} }, nutritionFoodDatabase: [], fatSecretFoods: [], nutritionPhotoInputRef: { current: null }, nutritionPhotoLastFileRef: lastFile });
  const handlers = createNutritionPhotoAiHandlers(context);
  const task = handlers.handleNutritionPhotoAiSearch({ target: { files: [new Blob(["image"], { type: "image/png" })] } });
  await flush();
  const user = auth.currentUser; login(null); login(relogin ? user : { uid: "B" });
  handlers.resetNutritionPhotoAiState(); state.setNutritionPhotoAiResult = "clean";
  pending.resolve({ ok: false, status: 503, json: async () => ({ message: "private A result" }) });
  await task;
  assert.equal(state.setNutritionPhotoAiResult, "clean");
  assert.equal(state.setNutritionPhotoPreview, "");
  assert.equal(lastFile.current, null);
  assert.equal(state.setNutritionPhotoAnalyzing, false);
});

test("closing scanner while permission is pending stops late tracks exactly once", async () => {
  environment(); login({ uid: "A" });
  const camera = deferred(); let stopped = 0, detector = 0;
  navigator.mediaDevices = { getUserMedia: () => camera.promise };
  window.BarcodeDetector = class { constructor() { detector++; } };
  const h = harness({ auth, user: auth.currentUser, nutrition: {}, barcodeScannerOpen: true, barcodeSearchEnabled: true, barcodeVideoRef: { current: null }, nutritionUndoTimerRef: { current: null } });
  const runner = new HookRunner(); runner.render(() => useNutritionRuntimeEffects(h.context)); runner.unmount();
  camera.resolve({ getTracks: () => [{ stop() { stopped++; } }] }); await flush();
  assert.equal(stopped, 1); assert.equal(detector, 0);
});

for (const branch of ["rejected request", "successful lookup"]) test(`photo AI ${branch} cannot publish after session changes`, async () => {
  environment(); login({ uid: "A" });
  document.createElement = () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,eA==" });
  globalThis.Image = class { width = 20; height = 20; set src(value) { queueMicrotask(() => this.onload()); } };
  const request = deferred(), lookup = deferred(); let lookupStarted = false;
  photoIo = () => request.promise;
  barcodeIo = () => { lookupStarted = true; return lookup.promise; };
  const h = harness({ auth, nutrition: { myFoods: {} }, nutritionFoodDatabase: [], fatSecretFoods: [], nutritionPhotoInputRef: { current: null }, nutritionPhotoLastFileRef: { current: null } });
  const handlers = createNutritionPhotoAiHandlers(h.context);
  const work = handlers.handleNutritionPhotoAiSearch({ target: { files: [new Blob(["photo"], { type: "image/png" })] } });
  await flush();
  if (branch === "successful lookup") {
    request.resolve({ ok: true, json: async () => ({ found: true, product: { name: "A food", barcode: "1234567890123" } }) });
    await flush(); assert.equal(lookupStarted, true);
  }
  login({ uid: "B" }); handlers.resetNutritionPhotoAiState(); h.state.setNutritionPhotoAiResult = "B";
  if (branch === "successful lookup") lookup.resolve({ id: "A", name: "A food", barcode: "1234567890123" });
  else request.reject(new Error("private failure"));
  await work;
  assert.equal(h.state.setNutritionPhotoAiResult, "B"); assert.equal(h.state.addNutritionFoodFromPicker, undefined);
  assert.equal(h.state.openNutritionCreateProductFromPhoto, undefined); assert.equal(h.state.showAppError, undefined);
});

test("progress image preview follows newest selected file across handler recreation and removal", () => {
  environment(); login({ uid: "A" });
  const readers = [];
  globalThis.FileReader = class { constructor() { readers.push(this); } readAsDataURL() {} };
  const h = harness({ auth });
  const a = {}, b = {};
  createProfileProgressHandlers(h.context).selectClientProgressPhoto("front", a);
  createProfileProgressHandlers(h.context).selectClientProgressPhoto("front", b);
  readers[1].result = "B"; readers[1].onload(); readers[0].result = "A"; readers[0].onload();
  assert.equal(h.state.setProfileProgressPhotoFiles.front, b);
  assert.equal(h.state.setProfileProgressPhotoPreviews.front, "B");
  createProfileProgressHandlers(h.context).selectClientProgressPhoto("front", null);
  readers[1].onload(); assert.equal(h.state.setProfileProgressPhotoPreviews.front, "");
});

test("failed history refresh preserves cloud entries while merging pending completion", async () => {
  environment(); login({ uid: "A" }); historyIo = async () => { throw new Error("offline"); };
  setFailedHistoryQueue("A", [{ id: "pending", entry: { id: "pending", clientSaveId: "pending", date: "2026-10-18" } }]);
  const h = harness({ auth, db: {} }); h.state.setHistory = [{ id: "one", date: "2026-10-17", workoutName: "one" }, { id: "two", date: "2026-10-16", workoutName: "two" }];
  await createWorkoutHistoryHandlers(h.context).loadHistory();
  assert.deepEqual(h.state.setHistory.map(item => item.id), ["pending", "one", "two"]);
  assert.equal(h.state.setHistoryLoading, false); assert.ok(h.state.showAppError);
});

test("workout runtime persists final comment; Resume restores it and Restart clears it", async () => {
  const { store } = environment(); login({ uid: "A" });
  const plan = { workouts: [{ id: "day", exercises: [] }] };
  const h = harness({ auth, user: auth.currentUser, selectedWorkoutId: "day", plan, workout: null, workoutStarted: true, workoutClientComment: "  Точный комментарий\nдля тренера  ", inlineVideoControlsTimerRef: { current: null }, timerTickRef: { current: 0 } });
  const runner = new HookRunner(); runner.render(() => useWorkoutRuntimeEffects(h.context));
  const draft = [...store.values()].map(value => JSON.parse(value)).find(value => value.workoutId === "day");
  assert.equal(draft.workoutClientComment, h.context.workoutClientComment); runner.unmount();
  const args = harness({ auth, user: auth.currentUser, plan, history: [], workoutDraftRestorePrompt: { workoutId: "day", savedDraft: draft }, loadWorkoutsFromFirebase: async () => plan });
  await createWorkoutOpenHandlers(args.context).handleWorkoutDraftChoice(true);
  assert.equal(args.state.setWorkoutClientComment, draft.workoutClientComment);
  await createWorkoutOpenHandlers(args.context).handleWorkoutDraftChoice(false);
  assert.equal(args.state.setWorkoutClientComment, "");
});

test("personal library deletion confirms and never removes diary portions", () => {
  const removals = [];
  const h = harness({ editingNutritionItemId: "my:food", selectedNutritionFood: { id: "food", name: "Продукт" }, nutrition: { myFoods: { food: {} } }, removeMyNutritionFood: id => removals.push(id), removeNutritionFood: () => assert.fail("must not delete diary") });
  const handlers = createNutritionSelectedFoodDeleteHandlers(h.context);
  handlers.deleteSelectedNutritionFood(); assert.deepEqual(removals, []); assert.equal(h.state.setNutritionDeleteConfirmOpen, true);
  h.context.setNutritionDeleteConfirmOpen(false); assert.deepEqual(removals, []);
  handlers.deleteSelectedNutritionFood(true); assert.deepEqual(removals, ["food"]);
});

test("nutrition sync refresh is visible-only, bounded, non-overlapping and auth-generation safe", async () => {
  const env = environment(); login({ uid: "A" });
  const pending = deferred(); let loads = 0;
  const h = harness({ auth, user: auth.currentUser, nutrition: {}, nutritionCloudReady: true, barcodeScannerOpen: false,
    page: "nutrition",
    nutritionUndoTimerRef: { current: null }, loadNutritionFromFirebase: async uid => { assert.equal(uid, "A"); loads++; await pending.promise; } });
  const runner = new HookRunner(); runner.render(() => useNutritionRuntimeEffects(h.context));
  document.visibilityState = "hidden"; env.tick(); assert.equal(loads, 0);
  document.visibilityState = "visible"; window.dispatchEvent(new Event("focus")); env.tick(); assert.equal(loads, 1);
  pending.resolve(); await flush(); window.dispatchEvent(new Event("focus")); assert.equal(loads, 1);
  const sameUser = auth.currentUser; login(null); login(sameUser); env.tick(); assert.equal(loads, 1);
  runner.unmount(); assert.equal(env.intervals.size, 0);
});

test("nutrition autosave merges cloud reply with edits made during I/O and rejects an old generation", async () => {
  environment(); login({ uid: "A" });
  const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const callbacks = []; globalThis.setTimeout = fn => { callbacks.push(fn); return fn; }; globalThis.clearTimeout = () => {};
  const at = "2026-10-18T12:00:00.000Z", newer = "2026-10-18T12:01:00.000Z";
  const food = id => ({ id, name: id, updatedAt: at });
  const local = { __uid: "A", updatedAt: at, days: { today: { updatedAt: at, foods: [food("local")] } } };
  const first = deferred(); cloudIo = () => first.promise;
  const h = harness({ auth, user: auth.currentUser, nutrition: local, nutritionCloudReady: true, barcodeScannerOpen: false,
    nutritionStorageKey: "n", nutritionBackupStorageKey: "backup", nutritionUndoTimerRef: { current: null }, loadNutritionFromFirebase: undefined });
  h.state.setNutrition = local;
  try {
    const runner = new HookRunner(); runner.render(() => useNutritionRuntimeEffects(h.context)); callbacks.at(-1)();
    h.state.setNutrition = { ...local, updatedAt: newer, days: { today: { updatedAt: newer, foods: [food("local"), { ...food("concurrent"), updatedAt: newer }] } } };
    first.resolve({ ...local, days: { today: { updatedAt: at, foods: [food("local"), food("remote")] } } }); await flush();
    assert.deepEqual(new Set(h.state.setNutrition.days.today.foods.map(item => item.id)), new Set(["local", "remote", "concurrent"]));
    runner.unmount();
    const second = deferred(); cloudIo = () => second.promise;
    const next = new HookRunner(); next.render(() => useNutritionRuntimeEffects(h.context)); callbacks.at(-1)();
    const user = auth.currentUser; login(null); login(user); h.state.setNutrition = { __uid: "A", marker: "new session" };
    second.resolve(local); await flush(); assert.equal(h.state.setNutrition.marker, "new session"); next.unmount();
  } finally { globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; }
});

test("deleted library item stays absent from library/favorites/recent on reload while diary is immutable", () => {
  const at = "2026-10-18T12:00:00Z";
  const diary = { foods: [{ id: "portion", foodId: "food", name: "Historical food", amount: 120 }] };
  const cloud = { myFoods: { food: { id: "food", updatedAt: "2026-10-17" } }, favorites: ["food"], recent: ["food"], days: { today: diary } };
  const merged = mergeNutritionStates({ deletedMyFoods: { food: at }, favoriteChanges: { food: { present: false, updatedAt: at } } }, cloud);
  assert.equal(merged.myFoods.food, undefined); assert.deepEqual(merged.recent, []); assert.deepEqual(merged.favorites, []);
  assert.deepEqual(merged.days.today.foods[0], { ...diary.foods[0] });
});

test("actual countdown hook handles pause/resume, running-duration change, background catchup and reopening", () => {
  const env = environment(); let now = 100000; const originalNow = Date.now; Date.now = () => now;
  try {
    const state = { seconds: 90, running: true };
    const args = { completionVibration: "rest", get seconds() { return state.seconds; }, get running() { return state.running; }, setSeconds: update => { state.seconds = typeof update === "function" ? update(state.seconds) : update; }, setRunning: value => { state.running = value; } };
    const runner = new HookRunner(), render = () => runner.render(() => useWallClockCountdown(args));
    render(); now += 10000; env.tick(); render(); assert.equal(state.seconds, 80);
    state.running = false; render(); now += 20000; env.tick(); assert.equal(state.seconds, 80);
    state.running = true; render(); now += 10000; env.tick(); render(); assert.equal(state.seconds, 70);
    state.seconds = 120; render(); now += 5000; env.tick(); render(); assert.equal(state.seconds, 115);
    document.visibilityState = "hidden"; now += 100000; document.dispatchEvent(new Event("visibilitychange")); render(); assert.equal(state.seconds, 15);
    runner.unmount(); assert.equal(env.intervals.size, 0);
    const reopened = new HookRunner(); reopened.render(() => useWallClockCountdown(args)); now += 15000; env.tick(); assert.equal(state.seconds, 0); assert.equal(state.running, false); reopened.unmount();
  } finally { Date.now = originalNow; }
});

test("90-day realistic diary and deletion tombstones are measured, not truncated", () => {
  const days = {}, deletedMyFoods = {}, favoriteChanges = {};
  for (let day = 0; day < 90; day++) {
    days[`2026-${day}`] = { updatedAt: "2026-10-18T12:00:00.000Z", foods: Array.from({ length: 12 }, (_, index) => ({ id: `entry-${day}-${index}`, name: "Куриная грудка с овощами", calories: 165, protein: 31, fat: 3.6, carbs: 0, amount: 150, meal: "lunch", updatedAt: "2026-10-18T12:00:00.000Z" })), deletedFoods: Object.fromEntries(Array.from({ length: 3 }, (_, index) => [`deleted-${index}`, "2026-10-18T12:00:00.000Z"])) };
    deletedMyFoods[`food-${day}`] = "2026-10-18T12:00:00.000Z";
    favoriteChanges[`food-${day}`] = { present: false, updatedAt: "2026-10-18T12:00:00.000Z" };
  }
  const state = { days, deletedMyFoods, favoriteChanges };
  const before = JSON.stringify(state); const result = assertNutritionDocumentBudget(state);
  assert.ok(result.bytes > 200000 && result.bytes < 750 * 1024);
  assert.equal(measureNutritionDocument(state).bytes, Buffer.byteLength(before));
  assert.throws(() => assertNutritionDocumentBudget({ ...state, padding: "я".repeat(400000) }), { code: "nutrition/archive-required" });
  assert.equal(JSON.stringify(state), before);
  console.log(`90-day synthetic nutrition document: ${result.bytes} UTF-8 bytes; 1080 diary portions, 270 entry tombstones, 90 library tombstones`);
});
