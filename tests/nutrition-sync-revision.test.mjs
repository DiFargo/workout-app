import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const auth = { currentUser: null };
const documents = new Map();
const writes = [];
let storageWrites = 0;
const cleanup = installRuntimeImports({
  "/src/firebase.js": { auth, db: {} },
  "firebase/firestore": {
    doc: (_, ...parts) => parts.join("/"),
    runTransaction: async (_, callback) => callback({
      get: async path => ({ exists: () => documents.has(path), data: () => structuredClone(documents.get(path)) }),
      set: (path, value) => { writes.push(path); documents.set(path, structuredClone(value)); }
    })
  }
});
after(cleanup);
const { advanceAuthSession } = await import("../src/utils/authSession.js");
const { mergeNutritionStates } = await import("../src/utils/nutritionStateMerge.js");
const { saveNutritionStateWithMerge } = await import("../src/utils/nutritionStateStorage.js");
const { rememberNutritionCloudState, isNutritionStateDirty, beginNutritionSave, acknowledgeNutritionCloudState,
  sameNutritionState, persistNutritionLocalSnapshot, backupNutritionLocalSnapshot } = await import("../src/utils/nutritionSyncRevision.js");

beforeEach(() => {
  auth.currentUser = { uid: "synthetic" };
  advanceAuthSession(auth);
  documents.clear(); writes.length = 0; storageWrites = 0;
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { storageWrites++; storage.set(key, String(value)); }, removeItem: key => storage.delete(key) };
});
const state = () => ({ ...mergeNutritionStates({}, { updatedAt: "2026-10-25T09:00:00Z", days: {} }), __uid: "synthetic" });

test("cloud baseline не делает новый объект dirty, но локальная правка остаётся dirty после старого ack", () => {
  const a = state(), b = { ...a, updatedAt: "2026-10-25T09:01:00Z", days: { today: { water: 2000 } } };
  rememberNutritionCloudState(auth, a);
  assert.equal(isNutritionStateDirty(auth, structuredClone(a)), false);
  const old = beginNutritionSave(auth);
  assert.equal(isNutritionStateDirty(auth, b), true);
  const latest = beginNutritionSave(auth);
  acknowledgeNutritionCloudState(auth, latest, b);
  acknowledgeNutritionCloudState(auth, old, a);
  assert.equal(isNutritionStateDirty(auth, b), false);
  assert.equal(isNutritionStateDirty(auth, { ...b, days: { today: { water: 2100 } } }), true);
  advanceAuthSession(auth, null);
  advanceAuthSession(auth, auth.currentUser);
  acknowledgeNutritionCloudState(auth, latest, b);
  assert.equal(isNutritionStateDirty(auth, b), true, "старый ack не подтверждает новый сеанс того же UID");
});

test("локальный snapshot и полный backup не дублируются при изменении порядка ключей", () => {
  const a = state(), reordered = Object.fromEntries(Object.entries(a).reverse());
  assert.equal(sameNutritionState(a, reordered), true);
  assert.equal(persistNutritionLocalSnapshot("nutrition", "synthetic", a), true);
  assert.equal(persistNutritionLocalSnapshot("nutrition", "synthetic", reordered), true);
  assert.equal(backupNutritionLocalSnapshot("backup", "synthetic", a), true);
  assert.equal(backupNutritionLocalSnapshot("backup", "synthetic", reordered), true);
  assert.equal(storageWrites, 2);
  const backup = JSON.parse(localStorage.getItem("backup:synthetic"));
  assert.deepEqual(backup[0].nutrition.myFoods, a.myFoods);
});

test("partial cloud baseline дополняет прочитанные дни и не подтверждает новый локальный edit", () => {
  const a = mergeNutritionStates(state(), { updatedAt: "2026-10-25T10:00:00Z", days: { "2026-10-24": { water: 1000 } } });
  const b = mergeNutritionStates({}, { updatedAt: "2026-10-25T10:01:00Z", days: { "2026-10-25": { water: 2000 } } });
  rememberNutritionCloudState(auth, a);
  rememberNutritionCloudState(auth, b, { partial: true });
  const both = mergeNutritionStates(a, b);
  assert.equal(isNutritionStateDirty(auth, both), false);
  const local = mergeNutritionStates(both, { updatedAt: "2026-10-25T11:00:00Z", days: { "2026-10-25": { water: 2200, updatedAt: "2026-10-25T11:00:00Z" } } });
  rememberNutritionCloudState(auth, a, { partial: true });
  assert.equal(isNutritionStateDirty(auth, local), true);
});

test("транзакция не пишет одинаковые документы, но сохраняет реальную правку с tombstones", async () => {
  const a = state(), personal = { myFoods: {}, deletedMyFoods: {}, ownerUid: "synthetic", updatedAt: a.updatedAt };
  documents.set("users/synthetic/nutrition/state", Object.fromEntries(Object.entries(a).filter(([key]) => key !== "myFoods")));
  documents.set("users/synthetic/nutrition/myFoods", personal);
  await saveNutritionStateWithMerge("synthetic", a);
  assert.deepEqual(writes, []);
  const b = { ...a, updatedAt: "2026-10-25T09:01:00Z", days: { today: {
    foods: [], deletedFoods: { removed: "2026-10-25T09:01:00Z" }, water: 2000
  } } };
  await saveNutritionStateWithMerge("synthetic", b);
  assert.ok(writes.includes("users/synthetic/nutrition/state"));
  assert.deepEqual(documents.get("users/synthetic/nutrition/state").days.today.deletedFoods, b.days.today.deletedFoods);
});
