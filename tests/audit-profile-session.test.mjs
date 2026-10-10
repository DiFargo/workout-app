import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let measurementIo;
let photoIo;
let readIo;
let commitIo;
let writtenPaths;
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
const cleanup = installRuntimeImports({
  "/firebase.js": { auth: { currentUser: null }, db: {} },
  "/measurementPersistence.js": { persistMeasurement: (args) => measurementIo(args) },
  "/progressPhotoPersistence.js": { persistProgressPhotos: (args) => photoIo(args) },
  "/firebaseStorage.js": { uploadStorageFile: async () => ({ url: "uploaded" }) },
  "firebase/firestore": {
    collection: (_, ...parts) => parts.join("/"),
    getDocs: (path) => readIo(path),
    getDoc: (path) => readIo(path),
    doc: (_, ...parts) => parts.join("/"),
    writeBatch: () => ({ set: (path, value) => writtenPaths.push([path, value]), commit: () => commitIo() })
  }
});
after(cleanup);
const { createProfileProgressHandlers } = await import("../src/features/client/profile/profileProgressHandlers.js");
const { createAiNutritionPlanHandlers } = await import("../src/features/client/nutrition/aiNutritionPlanHandlers.js");
const { createNutritionCloudLoader } = await import("../src/features/client/nutrition/nutritionCloudLoader.js");
const { getFailedMeasurementQueue, setFailedMeasurementQueue } = await import("../src/utils/offlineSyncStorage.js");

beforeEach(() => {
  storage.clear();
  writtenPaths = [];
  measurementIo = async () => {};
  photoIo = async () => ({ id: "photo-new" });
  readIo = async () => ({ docs: [] });
  commitIo = async () => {};
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function stateHarness(initial = {}, defer = false) {
  const state = { ...initial };
  const pending = [];
  const setter = (key) => (value) => {
    const apply = () => { state[key] = typeof value === "function" ? value(state[key]) : value; };
    if (defer) pending.push(apply);
    else apply();
  };
  return { state, setter, flush: () => { pending.splice(0).forEach((apply) => apply()); } };
}

function transition(auth, user) {
  auth.currentUser = user;
  advanceAuthSession(auth, user);
}

function progressContext(defer = false) {
  const auth = { currentUser: { uid: "A" } };
  advanceAuthSession(auth);
  const initial = { measurements: [], photos: [], profile: { name: "Current", weight: "70" }, draft: { name: "Current", weight: "70" }, status: "", saving: false, photoStatus: "", uploading: false, files: {}, previews: {} };
  const h = stateHarness(initial, defer);
  const events = [];
  const context = {
    auth, db: {}, MEASUREMENTS_STORAGE_KEY: "measurements", measurementReplayInProgressRef: { current: false },
    aiNutritionProfile: { name: "A", goal: "cut", weight: "80" }, aiNutritionProfileDraft: { name: "A", goal: "cut", weight: "80" },
    profileMeasurements: [], profileMeasurementDraft: { weight: "81" },
    profileProgressPhotoFiles: { front: {}, side: {}, back: {} },
    recordTrainerEvent: async (...args) => { events.push(args); }, showAppError: (...args) => events.push(args),
    setProfileMeasurements: h.setter("measurements"), setClientProgressPhotos: h.setter("photos"),
    setAiNutritionProfile: h.setter("profile"), setAiNutritionProfileDraft: h.setter("draft"),
    setProfileMeasurementStatus: h.setter("status"), setProfileMeasurementSaving: h.setter("saving"),
    setProfileProgressPhotoStatus: h.setter("photoStatus"), setProfileProgressPhotoUploading: h.setter("uploading"),
    setProfileProgressPhotoFiles: h.setter("files"), setProfileProgressPhotoPreviews: h.setter("previews")
  };
  return { auth, h, initial, events, context, handlers: createProfileProgressHandlers(context) };
}

for (const kind of ["other account", "same account after logout"]) {
  test(`late measurement/photo completions cannot publish into ${kind}`, async () => {
    const m = deferred();
    const p = deferred();
    measurementIo = () => m.promise;
    photoIo = () => p.promise;
    const { auth, h, events, handlers } = progressContext();
    const measurement = handlers.saveProfileMeasurement();
    const photo = handlers.saveClientProgressPhotos();
    if (kind === "same account after logout") transition(auth, null);
    transition(auth, { uid: kind === "other account" ? "B" : "A" });
    h.state.measurements = [{ id: "current-record" }];
    h.state.photos = [{ id: "current-photo" }];
    h.state.profile = { name: "Current", weight: "70" };
    h.state.status = "current-status";
    h.state.photoStatus = "current-photo-status";
    m.resolve();
    p.resolve({ id: "A-photo" });
    assert.equal(await measurement, false);
    assert.equal(await photo, false);
    assert.deepEqual(h.state.measurements, [{ id: "current-record" }]);
    assert.deepEqual(h.state.photos, [{ id: "current-photo" }]);
    assert.deepEqual(h.state.profile, { name: "Current", weight: "70" });
    assert.equal(h.state.status, "current-status");
    assert.equal(h.state.photoStatus, "current-photo-status");
    assert.equal(events.length, 0);
    assert.equal(storage.size, 0);
  });
}

test("React updaters queued before an auth transition reject the previous session", async () => {
  const { auth, h, initial, handlers } = progressContext(true);
  assert.equal(await handlers.saveProfileMeasurement(), true);
  await handlers.saveClientProgressPhotos();
  transition(auth, null);
  transition(auth, { uid: "A" });
  h.flush();
  assert.deepEqual(h.state, initial);
  assert.equal(storage.get("measurements:A"), undefined);
});

test("current-session save normalizes weight and merges records added during I/O", async () => {
  const io = deferred();
  measurementIo = ({ uid }) => { assert.equal(uid, "A"); return io.promise; };
  const { h, handlers } = progressContext();
  const save = handlers.saveProfileMeasurement({ weight: "81,5" });
  h.state.measurements = [{ id: "concurrent", date: "2026-01-01", weight: "80" }];
  io.resolve();
  assert.equal(await save, true);
  assert.equal(h.state.measurements.length, 2);
  assert.equal(h.state.measurements[0].weight, "81.5");
  assert.equal(h.state.measurements[1].id, "concurrent");
  assert.equal(h.state.profile.weight, "81.5");
  assert.equal(h.state.saving, false);
  assert.deepEqual(JSON.parse(storage.get("measurements:A")), h.state.measurements);
});

test("stale same-UID measurement/photo loads cannot refill a reset UI", async () => {
  const read = deferred();
  readIo = () => read.promise;
  const { auth, h, handlers } = progressContext();
  const measurements = handlers.loadProfileMeasurements();
  const photos = handlers.loadClientProgressPhotos();
  transition(auth, null);
  transition(auth, { uid: "A" });
  read.resolve({ docs: [{ id: "previous", data: () => ({ weight: "81", date: "2026-01-01" }) }] });
  assert.deepEqual(await measurements, []);
  assert.deepEqual(await photos, []);
  assert.deepEqual(h.state.measurements, []);
  assert.deepEqual(h.state.photos, []);
  assert.equal(storage.size, 0);
});

test("a delayed photo preview cannot repopulate files from an earlier login", () => {
  const originalReader = globalThis.FileReader;
  let reader;
  globalThis.FileReader = class {
    constructor() { reader = this; }
    readAsDataURL() {}
  };
  try {
    const { auth, h, initial, handlers } = progressContext(true);
    handlers.selectClientProgressPhoto("front", { name: "A-photo" });
    transition(auth, null);
    transition(auth, { uid: "A" });
    reader.result = "data:image/png;base64,old";
    reader.onload();
    h.flush();
    assert.deepEqual(h.state.files, initial.files);
    assert.deepEqual(h.state.previews, initial.previews);
  } finally {
    globalThis.FileReader = originalReader;
  }
});

test("photo save in the current session updates the list, clears the draft, and records its captured UID", async () => {
  const { h, events, handlers } = progressContext();
  h.state.photos = [{ id: "existing" }];
  await handlers.saveClientProgressPhotos();
  assert.deepEqual(h.state.photos, [{ id: "photo-new" }, { id: "existing" }]);
  assert.deepEqual(h.state.files, { front: null, side: null, back: null });
  assert.equal(h.state.uploading, false);
  assert.match(h.state.photoStatus, /сохранены/);
  assert.equal(events[0][0], "A");
});

test("stale replay does not acknowledge the new session queue or send completion feedback", async () => {
  const io = deferred();
  measurementIo = () => io.promise;
  const { auth, events, handlers, context } = progressContext();
  const queued = { id: "queued", measurement: { id: "queued", weight: "81" } };
  setFailedMeasurementQueue("A", [queued]);
  const replay = handlers.replayFailedMeasurementSaves();
  transition(auth, null);
  transition(auth, { uid: "A" });
  io.resolve();
  await replay;
  assert.deepEqual(getFailedMeasurementQueue("A"), [queued]);
  assert.equal(events.length, 0);
  assert.equal(context.measurementReplayInProgressRef.current, false);
});

function planContext(defer = false) {
  const auth = { currentUser: { uid: "A" } };
  advanceAuthSession(auth);
  const nutrition = { days: {}, goals: { calories: 2200, protein: 150, fat: 70, carbs: 240 } };
  const initial = { profile: null, draft: { name: "Current" }, plan: null, done: false, nutrition };
  const h = stateHarness(initial, defer);
  const context = {
    auth, db: {}, user: { uid: "WRONG-CLOSURE" }, nutrition, defaultNutritionState: nutrition, history: [],
    aiNutritionProfileDraft: { name: "A", weight: "120,5", targetWeight: "110,5", height: "180", age: "30", sex: "male", goal: "cut", activity: "high", trainingDays: [] },
    AI_NUTRITION_PROFILE_STORAGE_KEY: "profile", AI_NUTRITION_PLAN_STORAGE_KEY: "plan", FIRST_SETUP_DONE_USER_STORAGE_KEY: "done", FIRST_SETUP_REQUIRED_VERSION: "1",
    setAiNutritionProfile: h.setter("profile"), setAiNutritionProfileDraft: h.setter("draft"),
    setAiNutritionSavedPlan: h.setter("plan"), setFirstSetupCompletedInCloud: h.setter("done"), setNutrition: h.setter("nutrition")
  };
  return { auth, h, initial, handlers: createAiNutritionPlanHandlers(context) };
}

test("plan commit after A logout A preserves current UI and does not mark onboarding done", async () => {
  const commit = deferred();
  commitIo = () => commit.promise;
  const { auth, h, initial, handlers } = planContext();
  const save = handlers.saveAiNutritionPlan();
  transition(auth, null);
  transition(auth, { uid: "A" });
  commit.resolve();
  assert.equal(await save, false);
  assert.deepEqual(h.state, initial);
  assert.equal(storage.size, 0);
  assert.deepEqual(writtenPaths.map(([path]) => path), ["users/A", "users/A/nutrition/state"]);
});

test("plan success publishes normalized metrics to captured-UID cache only", async () => {
  const { h, handlers } = planContext();
  assert.equal(await handlers.saveAiNutritionPlan(), true);
  assert.equal(h.state.profile.weight, "120.5");
  assert.equal(h.state.profile.targetWeight, "110.5");
  assert.equal(h.state.done, true);
  assert.equal(JSON.parse(storage.get("profile:A")).weight, "120.5");
  assert.equal(storage.get("profile:WRONG-CLOSURE"), undefined);
  assert.deepEqual(h.state.nutrition.goals, writtenPaths[0][1].nutritionGoals);
});

test("plan's deferred React updates cannot replace state after an auth transition", async () => {
  const { auth, h, initial, handlers } = planContext(true);
  assert.equal(await handlers.saveAiNutritionPlan(), true);
  transition(auth, { uid: "B" });
  h.flush();
  assert.deepEqual(h.state, initial);
});

test("deferred plan reset cannot erase a newly signed-in account", () => {
  const { auth, h, initial, handlers } = planContext(true);
  handlers.resetAiNutritionPlan();
  transition(auth, { uid: "B" });
  h.flush();
  assert.deepEqual(h.state, initial);
});

function nutritionLoaderContext(defer = false) {
  const auth = { currentUser: { uid: "A" } };
  advanceAuthSession(auth);
  const initial = { nutrition: { __uid: "A", days: {} }, ready: false };
  const h = stateHarness(initial, defer);
  const errors = [];
  const handlers = createNutritionCloudLoader({
    auth, db: {}, NUTRITION_STORAGE_KEY: "nutrition", startPerformanceCheck() {}, endPerformanceCheck() {},
    showAppError: (...args) => errors.push(args), setNutrition: h.setter("nutrition"), setNutritionCloudReady: h.setter("ready")
  });
  return { auth, h, initial, errors, handlers };
}

test("old nutrition load cannot merge a private snapshot or mark ready after same-account relogin", async () => {
  const read = deferred();
  readIo = () => read.promise;
  const { auth, h, initial, handlers } = nutritionLoaderContext();
  const loading = handlers.loadNutritionFromFirebase("A");
  transition(auth, null);
  transition(auth, { uid: "A" });
  read.resolve({ exists: () => true, data: () => ({ days: { oldSession: { foods: [{ id: "old" }] } } }) });
  await loading;
  assert.deepEqual(h.state, initial);
  assert.equal(storage.get("nutrition:A"), undefined);
});

test("nutrition load deferred state and ready callbacks reject a later login of the same account", async () => {
  readIo = async () => ({ exists: () => true, data: () => ({ days: { old: { foods: [] } } }) });
  const { auth, h, initial, handlers } = nutritionLoaderContext(true);
  await handlers.loadNutritionFromFirebase("A");
  transition(auth, null);
  transition(auth, { uid: "A" });
  h.flush();
  assert.deepEqual(h.state, initial);
  assert.equal(storage.get("nutrition:A"), undefined);
});

test("old nutrition read failure does not display an error or change readiness in another account", async () => {
  const read = deferred();
  readIo = () => read.promise;
  const { auth, h, initial, errors, handlers } = nutritionLoaderContext();
  const loading = handlers.loadNutritionFromFirebase("A");
  transition(auth, { uid: "B" });
  read.reject(new Error("unavailable"));
  await loading;
  assert.deepEqual(h.state, initial);
  assert.equal(errors.length, 0);
});

test("current nutrition load preserves a concurrent edit and publishes cloud readiness", async () => {
  const read = deferred();
  readIo = () => read.promise;
  const { h, handlers } = nutritionLoaderContext();
  const loading = handlers.loadNutritionFromFirebase("A");
  h.state.nutrition = { __uid: "A", days: { today: { foods: [{ id: "new" }] } } };
  read.resolve({ exists: () => true, data: () => ({ days: { yesterday: { foods: [{ id: "old" }] } } }) });
  await loading;
  assert.equal(h.state.ready, true);
  assert.equal(h.state.nutrition.days.today.foods[0].id, "new");
  assert.equal(h.state.nutrition.days.yesterday.foods[0].id, "old");
  assert.deepEqual(JSON.parse(storage.get("nutrition:A")), h.state.nutrition);
});
