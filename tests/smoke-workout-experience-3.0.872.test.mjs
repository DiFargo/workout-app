import assert from "node:assert/strict";
import test from "node:test";
import { historyQueryEvidence, parseWorkoutExperienceArgs, runWorkoutExperienceSmoke } from "../scripts/smoke-workout-experience-3.0.872.mjs";

const args = { run: true, allowProduction: true, project: "tren-85720", "expected-version": "3.0.872" };
const flags = ["--run", "--allow-production", "--project=tren-85720", "--expected-version=3.0.872"];
const manifest = { assets: [
  { sourceRef: "gs://tren-85720.firebasestorage.app/template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/IMG_7786.mp4",
    previewTime: 2.1, objectPath: "protected-exercise-previews/v1/b41b07b775a30700ae0ebef71c059b477471c5abc2e574c797a9ba6f4cddda04.webp", bytes: 48166, width: 540, height: 960 },
  { sourceRef: "gs://tren-85720.firebasestorage.app/template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/IMG_8116.mp4",
    previewTime: 9.802, objectPath: "protected-exercise-previews/v1/9e78c56bbb1d61981e3e33e9d2a5cc72a4e9eb2dadffd223f9eec5f8eb0d1c84.webp", bytes: 80620, width: 540, height: 960 }
] };

test("872 smoke requires explicit exact Production/version and refuses environment credential or emulator overrides", () => {
  assert.equal(parseWorkoutExperienceArgs(flags, {})["expected-version"], "3.0.872");
  for (const candidate of [[], flags.slice(1), flags.map(value => value.replace("tren-85720", "other")),
    flags.map(value => value.replace("3.0.872", "3.0.871")), [...flags, "--run"], [...flags, "--output-dir=../outside"]]) {
    assert.throws(() => parseWorkoutExperienceArgs(candidate, {}));
  }
  for (const name of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "GCLOUD_PROJECT"])
    assert.throws(() => parseWorkoutExperienceArgs(flags, { [name]: "not-used" }));
});

test("bounded history query inspection records only own-parent, date order and limit, including WebChannel encoding", () => {
  const shape = { parent: "projects/tren-85720/databases/(default)/documents/users/own",
    structuredQuery: { from: [{ collectionId: "history" }], orderBy: [{ field: { fieldPath: "date" }, direction: "DESCENDING" }], limit: 21 } };
  const raw = new URLSearchParams({ req0___data__: JSON.stringify({ addTarget: { query: shape } }) }).toString();
  assert.deepEqual(historyQueryEvidence(raw, "own"), [{ own: true, limit: 21, dateDescending: true }]);
  assert.equal(historyQueryEvidence(raw, "other")[0].own, false);
  const unbounded = structuredClone(shape); delete unbounded.structuredQuery.limit;
  assert.equal(historyQueryEvidence(JSON.stringify(unbounded), "own")[0].limit, 0);
  assert.deepEqual(historyQueryEvidence("not-json", "own"), []);
});

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
async function offlineFailure(mode) {
  let user = null, lastIntent, sequence = 0;
  const docs = new Map(), deleted = [];
  const transport = async (target, options = {}) => {
    const url = new URL(target), body = options.body ? JSON.parse(options.body) : {};
    assert.ok(["tren-85720.web.app", "identitytoolkit.googleapis.com", "firestore.googleapis.com"].includes(url.hostname));
    if (url.pathname === "/__/firebase/init.json") return json({ projectId: "tren-85720", storageBucket: "tren-85720.firebasestorage.app", apiKey: "offline-key" });
    if (url.pathname === "/sw.js") return new Response('const CACHE_NAME = "workout-app-v3.0.872";');
    if (url.pathname.endsWith("accounts:lookup")) return json({ users: user ? [user] : [] });
    if (url.pathname.endsWith("accounts:signUp")) {
      assert.equal(options.headers?.Authorization, undefined, "Signup never receives the operator credential");
      user = { localId: "offline-client", email: body.email };
      if (mode === "ambiguous-signup") throw new Error("offline-ambiguous-signup");
      const claims = Buffer.from(JSON.stringify({ aud: "tren-85720", sub: user.localId, iss: "https://securetoken.google.com/tren-85720" })).toString("base64url");
      return json({ localId: user.localId, idToken: `x.${claims}.x` });
    }
    if (url.pathname.endsWith("accounts:delete")) { if (mode === "auth-delete-fails") return json({}, 500); user = null; return json({}); }
    const start = url.pathname.indexOf("/documents/"); assert.notEqual(start, -1);
    let path = decodeURIComponent(url.pathname.slice(start + 11));
    if (path.endsWith(":listCollectionIds")) {
      path = path.slice(0, -18); const prefix = path + "/";
      return json({ collectionIds: [...new Set([...docs.keys()].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length).split("/")[0]))] });
    }
    if (options.method === "PATCH") {
      if (path.includes("/workouts/")) throw new Error("offline-stop-before-browser");
      assert.equal(url.searchParams.get("currentDocument.exists"), "false");
      assert.equal(docs.has(path), false);
      if (mode === "second-card-create-fails" && path.startsWith("trainerExerciseCards/") && path.endsWith("-1")) return json({}, 500);
      const document = { name: `projects/tren-85720/databases/(default)/documents/${path}`, fields: body.fields, updateTime: `time-${++sequence}` };
      docs.set(path, document);
      if (mode === "ambiguous-second-card" && path.startsWith("trainerExerciseCards/") && path.endsWith("-1")) throw new Error("offline-ambiguous-card-write");
      return json(document);
    }
    if (options.method === "DELETE") {
      assert.equal(url.searchParams.get("currentDocument.updateTime"), docs.get(path)?.updateTime);
      if (mode === "first-card-delete-fails" && path.startsWith("trainerExerciseCards/") && path.endsWith("-0")) return json({}, 500);
      docs.delete(path); deleted.push(path); return json({});
    }
    return docs.has(path) ? json(docs.get(path)) : json({}, 404);
  };
  const { report } = await runWorkoutExperienceSmoke(args, {
    readLocalVersion: async () => "3.0.872", readManifest: async () => manifest,
    operatorToken: async () => "offline-operator", fetchImpl: transport,
    createArtifacts: async () => ({ output: "offline-memory-only", frames: [],
      save: async (_report, intent) => { lastIntent = structuredClone(intent); }, close: async () => {} })
  });
  assert.equal(report.failed, true, "The original operation failure is not masked by cleanup");
  assert.equal(report.cleanup.profileTreeAbsent, true);
  assert.equal(report.cleanup.ratesAbsent, true);
  assert.equal(report.cleanup.card2Absent, true);
  return { report, user, docs, deleted, intent: lastIntent };
}

test("ambiguous signup is resolved by its preverified random email and fully cleaned", async () => {
  const result = await offlineFailure("ambiguous-signup");
  assert.equal(result.report.cleanupVerified, true); assert.equal(result.user, null); assert.equal(result.docs.size, 0);
  assert.equal(result.intent.cleanupRequired, false);
});

test("failed second card creation still removes the first card and the client/profile independently", async () => {
  const result = await offlineFailure("second-card-create-fails");
  assert.equal(result.report.cleanupVerified, true); assert.equal(result.user, null); assert.equal(result.docs.size, 0);
  assert.equal(result.deleted.filter(path => path.startsWith("trainerExerciseCards/")).length, 1);
  assert.equal(result.intent.cleanupRequired, false);
});

test("ambiguous second card write is discovered and both own cards are conditionally deleted", async () => {
  const result = await offlineFailure("ambiguous-second-card");
  assert.equal(result.report.cleanupVerified, true); assert.equal(result.docs.size, 0);
  assert.equal(result.deleted.filter(path => path.startsWith("trainerExerciseCards/")).length, 2);
});

test("Auth deletion failure does not skip cards, profile tree or rate cleanup and leaves durable cleanup intent", async () => {
  const result = await offlineFailure("auth-delete-fails");
  assert.equal(result.report.cleanup.authAbsent, false); assert.equal(result.report.cleanup.card1Absent, true);
  assert.equal(result.report.cleanupVerified, false); assert.equal(result.docs.size, 0); assert.equal(result.intent.cleanupRequired, true);
});

test("one card cleanup failure does not skip the other card or client cleanup", async () => {
  const result = await offlineFailure("first-card-delete-fails");
  assert.equal(result.report.cleanup.card1Absent, false); assert.equal(result.report.cleanup.authAbsent, true);
  assert.equal(result.report.cleanupVerified, false); assert.equal(result.docs.size, 1); assert.equal(result.intent.cleanupRequired, true);
});
