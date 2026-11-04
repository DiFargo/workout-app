import assert from "node:assert/strict";
import test, { after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { getProfileOverviewMeasurements } from "../src/utils/profileOverviewMeasurements.js";

const cleanup = installRuntimeImports({
  "/firebase.js": { auth: { currentUser: null }, db: {} },
  "/measurementPersistence.js": { persistMeasurement: async () => {} },
  "/progressPhotoPersistence.js": { persistProgressPhotos: async () => {} },
  "/firebaseStorage.js": { uploadStorageFile: async () => ({}) },
  "firebase/firestore": { collection: () => {}, getDocs: async () => { throw new Error("No full read expected"); } }
});
after(cleanup);
const { createProfileProgressHandlers } = await import("../src/features/client/profile/profileProgressHandlers.js");
const dto = (uid = "client") => ({ schemaVersion: 1, kind: "measurements", uid, sourceRevision: "a".repeat(64),
  coverage: { profile: "complete", measurements: "complete" }, sourceCounts: { measurements: 1 },
  measurements: { recent7: [{ id: "recent", date: "2026-10-25", weight: "70" }], latestWeight: null, latestBody: null } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test("measurement metadata has a separate destination and rejects another owner and partial data", async () => {
  const auth = { currentUser: { uid: "client" } }; advanceAuthSession(auth);
  let snapshot = null, fullWrites = 0, requestedKind;
  const context = { auth, setProfileMeasurements: () => { fullWrites++; },
    setProfileMeasurementSnapshot: value => { snapshot = typeof value === "function" ? value(snapshot) : value; },
    readClientLoadingSnapshot: async ({ kind }) => { requestedKind = kind; return dto(); } };
  const handlers = createProfileProgressHandlers(context);
  assert.equal(await handlers.loadProfileMeasurementSnapshot("another"), null);
  assert.equal(await handlers.loadProfileMeasurementSnapshot(), snapshot);
  assert.equal(requestedKind, "measurements"); assert.equal(fullWrites, 0);
  const broken = createProfileProgressHandlers({ ...context, readClientLoadingSnapshot: async () => ({ ...dto(), coverage: {} }) });
  const originalWarn = console.warn; console.warn = () => {};
  try { assert.equal(await broken.loadProfileMeasurementSnapshot(), null); }
  finally { console.warn = originalWarn; }
  assert.equal(snapshot.coverage.measurements, "complete");
});

test("late snapshot cannot publish across same-UID auth epochs or newer requests, including deferred state updates", async () => {
  const auth = { currentUser: { uid: "client" } }; advanceAuthSession(auth);
  let state = null; const pending = [], requests = [deferred(), deferred(), deferred()]; let index = 0;
  const context = { auth, readClientLoadingSnapshot: () => requests[index++].promise,
    setProfileMeasurementSnapshot: value => pending.push(() => { state = value(state); }) };
  const handlers = createProfileProgressHandlers(context);
  const old = handlers.loadProfileMeasurementSnapshot();
  const fresh = handlers.loadProfileMeasurementSnapshot();
  requests[1].resolve(dto()); await fresh; requests[0].resolve(dto()); assert.equal(await old, null);
  pending.splice(0).forEach(apply => apply()); assert.equal(state.uid, "client");
  const changed = handlers.loadProfileMeasurementSnapshot();
  requests[2].resolve(dto()); await changed;
  advanceAuthSession(auth); state = null;
  pending.splice(0).forEach(apply => apply()); assert.equal(state, null);
});

test("overview combines actual recent, latest body and latest weight records without duplicate IDs or mutating full history", () => {
  const full = [{ id: "local", date: "2026-10-26", weight: "69" }];
  const snapshot = dto(); snapshot.measurements.latestBody = { id: "body", date: { seconds: 1 }, neck: "35" };
  snapshot.measurements.latestWeight = snapshot.measurements.recent7[0];
  const result = getProfileOverviewMeasurements(snapshot, full);
  assert.deepEqual(result.map(record => record.id), ["local", "recent", "body"]);
  assert.equal(result[2], snapshot.measurements.latestBody); assert.equal(full.length, 1);
  assert.deepEqual(getProfileOverviewMeasurements({ ...snapshot, coverage: {} }, full), full);
});
