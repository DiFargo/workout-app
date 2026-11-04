import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
const auth = { currentUser: { uid: "owner" } };
let read;
const cleanup = installRuntimeImports({ "/src/firebase.js": { auth, db: {} },
  "firebase/firestore": { doc: (_, ...parts) => parts.join("/"), getDoc: async () => { throw new Error("legacy fallback forbidden"); } },
  "/src/utils/nutritionDayClient.js": { readNutritionState: (...args) => read(...args), isNutritionManifestCurrent: () => true } });
after(cleanup);
const { createNutritionCloudLoader } = await import("../src/features/client/nutrition/nutritionCloudLoader.js");
const { configureNutritionDayStorage, withNutritionPendingScope } = await import("../src/utils/nutritionDayStorageConfig.js");
const { advanceAuthSession } = await import("../src/utils/authSession.js");
const { mergeNutritionStates } = await import("../src/utils/nutritionStateMerge.js");
const { isNutritionStateDirty } = await import("../src/utils/nutritionSyncRevision.js");
const { getFailedNutritionSync, setFailedNutritionSync } = await import("../src/utils/offlineSyncStorage.js");
const oldScope = { generation: "legacy", writerEpoch: 0 }, newScope = { generation: "gen_1", writerEpoch: 1 };
const makeState = (days, scope = oldScope) => ({ ...mergeNutritionStates({}, { updatedAt: "2026-10-25T10:00:00Z", days }), __uid: "owner", __nutritionStorage: scope });
const resource = (days, scope = newScope, complete = false) => ({ manifest: { ...scope, sourceOfTruth: "days", revision: 1 },
  state: makeState(days, scope), coverage: { complete, loadedDayKeys: Object.keys(days), missingDayKeys: [], nextCursor: null } });
beforeEach(() => {
  auth.currentUser = { uid: "owner" }; advanceAuthSession(auth); configureNutritionDayStorage({ enabled: true });
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
});
function loader(initial) {
  let state = initial;
  const handlers = createNutritionCloudLoader({ auth, db: {}, NUTRITION_STORAGE_KEY: "nutrition", startPerformanceCheck() {}, endPerformanceCheck() {},
    showAppError() {}, setNutrition: update => { state = update(state); }, setNutritionCloudReady() {} });
  return { ...handlers, get state() { return state; }, edit: value => { state = value; } };
}
test("new epoch не подмешивает старые cached дни, но сохраняет legacy pending отдельно", async () => {
  const old = makeState({ "2026-10-24": { water: 1500 } });
  localStorage.setItem("nutrition:owner", JSON.stringify(old)); setFailedNutritionSync("owner", old);
  read = async () => resource({ "2026-10-25": { water: 2000 } });
  const h = loader(old);
  await h.loadNutritionFromFirebase("owner", { mode: "days", dayKeys: ["2026-10-25"] });
  assert.deepEqual(Object.keys(h.state.days), ["2026-10-25"]);
  assert.deepEqual(getFailedNutritionSync("owner").nutrition, old);
  assert.equal(isNutritionStateDirty(auth, h.state), false);
});
test("edit во время epoch switch сохраняется в durable pending до замены экрана", async () => {
  const old = makeState({ "2026-10-24": { water: 1500 } });
  localStorage.setItem("nutrition:owner", JSON.stringify(old));
  let release; read = () => new Promise(resolve => { release = resolve; });
  const h = loader(old), loading = h.loadNutritionFromFirebase("owner", { mode: "days", dayKeys: [] });
  await new Promise(resolve => setImmediate(resolve));
  const edit = { ...old, updatedAt: "2026-10-25T11:00:00Z", days: { "2026-10-24": { water: 2200 } } };
  h.edit(edit); release(resource({})); await loading;
  assert.equal(getFailedNutritionSync("owner").nutrition.days["2026-10-24"].water, 2200);
  assert.deepEqual(getFailedNutritionSync("owner").nutrition.__nutritionStorage, oldScope);
  assert.deepEqual(h.state.days, {});
});
test("same-scope partial hydration сохраняет unloaded дни и не подтверждает concurrent edit", async () => {
  const old = makeState({ "2026-10-24": { water: 1500 } }, newScope);
  localStorage.setItem("nutrition:owner", JSON.stringify(old));
  read = async () => resource({ "2026-10-25": { water: 2000 } });
  const h = loader(old); await h.loadNutritionFromFirebase("owner", { mode: "days", dayKeys: ["2026-10-25"] });
  assert.equal(h.state.days["2026-10-24"].water, 1500); assert.equal(isNutritionStateDirty(auth, h.state), false);
  let release; read = () => new Promise(resolve => { release = resolve; });
  const loading = h.loadNutritionFromFirebase("owner", { mode: "days", dayKeys: ["2026-10-25"] });
  await new Promise(resolve => setImmediate(resolve));
  h.edit({ ...h.state, updatedAt: "2026-10-25T11:00:00Z", days: { ...h.state.days,
    "2026-10-25": { water: 2300, updatedAt: "2026-10-25T11:00:00Z" } } });
  release(resource({ "2026-10-25": { water: 2000 } })); await loading;
  assert.equal(h.state.days["2026-10-25"].water, 2300); assert.equal(isNutritionStateDirty(auth, h.state), true);
});

test("fresh cloud scope при merge не превращает старый unscoped outbox в новый writer", () => {
  const oldPending = { updatedAt: "2026-10-25T11:00:00Z", days: { "2026-10-24": { water: 2200 } } };
  const fresh = makeState({}, newScope);
  const merged = withNutritionPendingScope(mergeNutritionStates(fresh, oldPending), oldPending);
  assert.deepEqual(merged.__nutritionStorage, oldScope);
  assert.equal(merged.days["2026-10-24"].water, 2200);
  assert.deepEqual(withNutritionPendingScope(fresh, { ...oldPending, __nutritionStorage: newScope }).__nutritionStorage, newScope);
});
