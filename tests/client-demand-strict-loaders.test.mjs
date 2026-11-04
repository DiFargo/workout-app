import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

const auth = { currentUser: { uid: "client" } };
let readDocs, readDoc;
const cleanup = installRuntimeImports({
  "/firebase.js": { auth, db: {} },
  "/measurementPersistence.js": { persistMeasurement: async () => {} },
  "/progressPhotoPersistence.js": { persistProgressPhotos: async () => {} },
  "/firebaseStorage.js": { uploadStorageFile: async () => ({}) },
  "firebase/firestore": { collection: (_, ...path) => path.join("/"), doc: (_, ...path) => path.join("/"),
    getDocs: (...args) => readDocs(...args), getDoc: (...args) => readDoc(...args), setDoc: async () => {}, deleteDoc: async () => {} }
});
after(cleanup);
const { createProfileProgressHandlers } = await import("../src/features/client/profile/profileProgressHandlers.js");
const { createClientTrainerTaskHandlers } = await import("../src/features/trainer/clientTrainerTaskHandlers.js");
const { createNutritionCloudLoader } = await import("../src/features/client/nutrition/nutritionCloudLoader.js");
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const state = initial => { let value = initial; return { get value() { return value; }, set: update => { value = typeof update === "function" ? update(value) : update; } }; };
beforeEach(() => { auth.currentUser = { uid: "client" }; advanceAuthSession(auth); });

test("strict snapshot/photo failure пробрасывается и не стирает доступные данные; default сохраняет совместимость", async () => {
  const photos = state([{ id: "kept-photo" }]), overview = state({ uid: "client", saved: true });
  const failure = new Error("synthetic unavailable"); readDocs = async () => { throw failure; };
  const handlers = createProfileProgressHandlers({ auth, setClientProgressPhotos: photos.set,
    setProfileMeasurementSnapshot: overview.set, readClientLoadingSnapshot: async () => { throw failure; } });
  const warn = console.warn; console.warn = () => {};
  try {
    await assert.rejects(handlers.loadProfileMeasurementSnapshot("client", { throwOnError: true }), failure);
    assert.deepEqual(overview.value, { uid: "client", saved: true });
    await assert.rejects(handlers.loadClientProgressPhotos("client", { throwOnError: true }), failure);
    assert.deepEqual(photos.value, [{ id: "kept-photo" }]);
    assert.equal(await handlers.loadProfileMeasurementSnapshot("client"), null);
    assert.deepEqual(await handlers.loadClientProgressPhotos("client"), []);
    assert.deepEqual(photos.value, []);
  } finally { console.warn = warn; }
});

test("strict tasks load удерживает данные при ошибке, same-UID epoch запрещает позднюю запись и deferred updater", async () => {
  const tasks = state([{ id: "kept-task" }]); const failure = new Error("synthetic task failure");
  readDocs = async () => { throw failure; };
  const handlers = createClientTrainerTaskHandlers({ auth, setClientTrainerTasks: tasks.set });
  const warn = console.warn; console.warn = () => {};
  try {
    await assert.rejects(handlers.loadClientTrainerTasks("client", { throwOnError: true }), failure);
    assert.deepEqual(tasks.value, [{ id: "kept-task" }]);
    const slow = deferred(); readDocs = () => slow.promise;
    const pending = handlers.loadClientTrainerTasks("client", { throwOnError: true });
    advanceAuthSession(auth);
    slow.resolve({ docs: [{ id: "old-task", data: () => ({ title: "old" }) }] });
    await pending;
    assert.deepEqual(tasks.value, [{ id: "kept-task" }]);
    const updates = [];
    readDocs = async () => ({ docs: [{ id: "deferred-task", data: () => ({}) }] });
    const delayed = createClientTrainerTaskHandlers({ auth, setClientTrainerTasks: update => updates.push(update) });
    await delayed.loadClientTrainerTasks("client", { throwOnError: true });
    advanceAuthSession(auth);
    updates.forEach(tasks.set);
    assert.deepEqual(tasks.value, [{ id: "kept-task" }]);
  } finally { console.warn = warn; }
});

test("nutrition strict caller видит общий in-flight отказ после coverage update, nonstrict caller получает прежний fallback", async () => {
  const data = state({ __uid: "client", days: { today: { water: 300 } } }), cloudReady = state(false), coverage = [];
  const failure = new Error("synthetic nutrition failure"); let reads = 0;
  const slow = deferred();
  readDoc = async () => { reads++; await slow.promise; throw failure; };
  const noop = () => {};
  const loader = createNutritionCloudLoader({ auth, db: {}, NUTRITION_STORAGE_KEY: "synthetic", startPerformanceCheck: noop,
    endPerformanceCheck: noop, showAppError: noop, setNutrition: data.set, setNutritionCloudReady: cloudReady.set,
    onNutritionCoverageChange: value => coverage.push(value) });
  const error = console.error; console.error = () => {};
  try {
    const compatible = loader.loadNutritionFromFirebase("client", { mode: "days", dayKeys: ["today"] });
    const strict = loader.loadNutritionFromFirebase("client", { mode: "days", dayKeys: ["today"], throwOnError: true });
    const rejected = assert.rejects(strict, failure);
    slow.resolve(); await rejected;
    assert.equal(await compatible, undefined);
    assert.equal(reads, 2, "оба callers делят ту же пару state/myFoods чтений");
    assert.equal(coverage.at(-1).loading, false);
    assert.equal(coverage.at(-1).error, "nutrition/load-failed");
    assert.equal(data.value.days.today.water, 300);
    assert.equal(cloudReady.value, true, "compatibility ready flag не заменяет отдельный error status");
  } finally { console.error = error; }
});
