import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let get = async () => ({ exists: () => false, data: () => ({}) });
let transact;
const auth = { currentUser: { uid: "u" } };
const cleanup = installRuntimeImports({
  "firebase/firestore": { doc: (_, ...path) => path.join("/"), getDoc: (...args) => get(...args), runTransaction: (_, fn) => transact(fn) },
  "/src/firebase.js": { auth, db: {} }
});
after(cleanup);
const storage = await import("../src/utils/offlineSyncStorage.js");
const { replayFailedHistorySavesWithDeps, replayFailedNutritionSyncWithDeps } = await import("../src/features/client/offline/offlineReplayHandlers.js");
const { createNutritionCloudLoader } = await import("../src/features/client/nutrition/nutritionCloudLoader.js");
beforeEach(() => {
  auth.currentUser = { uid: "u" };
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  transact = async (fn) => fn({ get: (...args) => get(...args), set() {} });
  get = async () => ({ exists: () => false, data: () => ({}) });
});

test("history replay acknowledges only its snapshot, retaining an operation added while A uploads", async () => {
  storage.enqueueFailedHistorySave("u", { clientSaveId: "a" });
  let inserted = false;
  get = async () => {
    if (!inserted) { inserted = true; storage.enqueueFailedHistorySave("u", { clientSaveId: "b" }); }
    return { exists: () => false, data: () => ({}) };
  };
  await replayFailedHistorySavesWithDeps({ auth, db: {}, uid: "u", historyReplayInProgressRef: { current: false }, setWorkoutHistorySyncState() {}, loadHistory: async () => {}, showAppError() {} });
  assert.deepEqual(storage.getFailedHistoryQueue("u").map((item) => item.entry.clientSaveId), ["b"]);
});

test("history queue retains more than 25 pending workouts and quota failure is explicit", () => {
  for (let i = 0; i < 30; i++) storage.enqueueFailedHistorySave("u", { clientSaveId: `w${i}` });
  assert.equal(storage.getFailedHistoryQueue("u").length, 30);
  globalThis.localStorage.setItem = () => { throw new Error("quota"); };
  assert.throws(() => storage.enqueueFailedHistorySave("u", { clientSaveId: "last" }), /local-storage-full/);
  assert.equal(storage.getFailedHistoryQueue("u").length, 30);
});

test("nutrition replay cannot clear a newer pending edit", async () => {
  const a = { days: { today: { foods: [{ id: "a" }] } }, updatedAt: "2026-09-09T10:00:00Z" };
  const b = { days: { today: { foods: [{ id: "a" }, { id: "b" }] } }, updatedAt: "2026-09-09T10:01:00Z" };
  storage.setFailedNutritionSync("u", a);
  get = async () => { storage.setFailedNutritionSync("u", b); return { exists: () => false, data: () => ({}) }; };
  let state = b;
  await replayFailedNutritionSyncWithDeps({ auth, uid: "u", nutritionReplayInProgressRef: { current: false }, setNutrition: (fn) => { state = fn(state); }, showAppError() {} });
  assert.deepEqual(storage.getFailedNutritionSync("u").nutrition, b);
  assert.equal(state.days.today.foods.length, 2);
});

test("nutrition replay from A cannot modify B or its local cache after account switch", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  transact = async (fn) => { await pending; return fn({ get: (...args) => get(...args), set() {} }); };
  storage.setFailedNutritionSync("u", { days: { privateA: { foods: [{ id: "a" }] } } });
  const stateB = { __uid: "b", days: { privateB: { foods: [{ id: "b" }] } } };
  let state = stateB;
  let notices = 0;
  const ref = { current: false };
  localStorage.setItem("nutrition:b", JSON.stringify(stateB));
  const replay = replayFailedNutritionSyncWithDeps({ auth, uid: "u", nutritionReplayInProgressRef: ref,
    setNutrition: (fn) => { state = fn(state); }, showAppError: () => { notices++; } });
  auth.currentUser = { uid: "b" };
  release();
  await replay;
  assert.strictEqual(state, stateB);
  assert.deepEqual(JSON.parse(localStorage.getItem("nutrition:b")), stateB);
  assert.equal(notices, 0);
  assert.equal(ref.current.size, 0);
});

test("nutrition replay rechecks auth inside a deferred React updater", async () => {
  storage.setFailedNutritionSync("u", { days: { privateA: { foods: [] } } });
  const updaters = [];
  await replayFailedNutritionSyncWithDeps({ auth, uid: "u", nutritionReplayInProgressRef: { current: false },
    setNutrition: (fn) => updaters.push(fn), showAppError() {} });
  assert.equal(updaters.length, 1);
  const stateB = { __uid: "b", days: {} };
  auth.currentUser = { uid: "b" };
  assert.strictEqual(updaters[0](stateB), stateB);
  auth.currentUser = { uid: "u" };
  const newSessionState = { __uid: "u", days: {} };
  assert.strictEqual(updaters[0](newSessionState), newSessionState);
});

test("a stale nutrition state owner is never merged even before auth state resets it", async () => {
  storage.setFailedNutritionSync("u", { days: { a: { foods: [] } } });
  const previousState = { __uid: "b", days: { b: { foods: [] } } };
  let state = previousState;
  await replayFailedNutritionSyncWithDeps({ auth, uid: "u", nutritionReplayInProgressRef: { current: false },
    setNutrition: (fn) => { state = fn(state); }, showAppError() {} });
  assert.strictEqual(state, previousState);
});

test("nutrition replays isolate in-flight sessions and old completion cannot unlock the new replay", async () => {
  const releases = [];
  transact = (fn) => new Promise((resolve) => releases.push(async () => resolve(await fn({ get: (...args) => get(...args), set() {} }))));
  const ref = { current: false };
  const applied = [];
  const replay = (uid) => replayFailedNutritionSyncWithDeps({ auth, uid, nutritionReplayInProgressRef: ref,
    setNutrition: (fn) => applied.push(fn({ __uid: auth.currentUser.uid, days: {} })), showAppError() {} });
  storage.setFailedNutritionSync("u", { days: { a: { foods: [] } } });
  storage.setFailedNutritionSync("b", { days: { b: { foods: [] } } });
  const oldA = replay("u");
  await replay("u");
  assert.equal(releases.length, 1);
  auth.currentUser = { uid: "b" };
  const b = replay("b");
  auth.currentUser = { uid: "u" };
  const newSession = auth.currentUser;
  const newA = replay("u");
  assert.equal(releases.length, 3);
  await releases[0](); await oldA;
  assert.equal(ref.current.get("u").uid, newSession.uid);
  assert.equal(ref.current.get("u").isCurrent(), true);
  await releases[1](); await b;
  assert.equal(applied.length, 0);
  await releases[2](); await newA;
  assert.equal(applied.length, 1);
  assert.equal(applied[0].__uid, "u");
  assert.equal(applied[0].days.b, undefined);
  assert.equal(ref.current.size, 0);
});

test("initial cloud load merges the current React edit made while both requests were pending", async () => {
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  get = () => delayed;
  let state = { __uid: "u", days: {} };
  let ready = false;
  const loader = createNutritionCloudLoader({ auth, db: {}, NUTRITION_STORAGE_KEY: "nutrition", startPerformanceCheck() {}, endPerformanceCheck() {}, showAppError() {}, setNutrition: (fn) => { state = fn(state); }, setNutritionCloudReady: (value) => { ready = typeof value === "function" ? value(ready) : value; } });
  const loading = loader.loadNutritionFromFirebase("u");
  state = { __uid: "u", days: { today: { foods: [{ id: "new", calories: 123 }] } } };
  release({ exists: () => true, data: () => ({ days: { yesterday: { foods: [{ id: "old" }] } } }) });
  await loading;
  assert.equal(ready, true);
  assert.equal(state.days.today.foods[0].calories, 123);
  assert.equal(state.days.yesterday.foods.length, 1);
  assert.equal(JSON.parse(localStorage.getItem("nutrition:u")).days.today.foods.length, 1);
});
