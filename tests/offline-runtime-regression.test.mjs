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
  await replayFailedHistorySavesWithDeps({ db: {}, uid: "u", historyReplayInProgressRef: { current: false }, setWorkoutHistorySyncState() {}, loadHistory: async () => {}, showAppError() {} });
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
  await replayFailedNutritionSyncWithDeps({ uid: "u", nutritionReplayInProgressRef: { current: false }, setNutrition: (fn) => { state = fn(state); }, showAppError() {} });
  assert.deepEqual(storage.getFailedNutritionSync("u").nutrition, b);
  assert.equal(state.days.today.foods.length, 2);
});

test("initial cloud load merges the current React edit made while both requests were pending", async () => {
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  get = () => delayed;
  let state = { __uid: "u", days: {} };
  let ready = false;
  const loader = createNutritionCloudLoader({ auth, db: {}, NUTRITION_STORAGE_KEY: "nutrition", startPerformanceCheck() {}, endPerformanceCheck() {}, showAppError() {}, setNutrition: (fn) => { state = fn(state); }, setNutritionCloudReady: (value) => { ready = value; } });
  const loading = loader.loadNutritionFromFirebase("u");
  state = { __uid: "u", days: { today: { foods: [{ id: "new", calories: 123 }] } } };
  release({ exists: () => true, data: () => ({ days: { yesterday: { foods: [{ id: "old" }] } } }) });
  await loading;
  assert.equal(ready, true);
  assert.equal(state.days.today.foods[0].calories, 123);
  assert.equal(state.days.yesterday.foods.length, 1);
  assert.equal(JSON.parse(localStorage.getItem("nutrition:u")).days.today.foods.length, 1);
});
