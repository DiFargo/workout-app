import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { alltimeHistoryQueryEvidence, createAlltimeHistoryFixtures, parseExerciseHistoryAlltimeArgs,
  runExerciseHistoryAlltimeSmoke } from "../scripts/smoke-exercise-history-alltime-3.0.873.mjs";

const args = { run: true, allowProduction: true, project: "tren-85720", "expected-version": "3.0.873" };
const flags = ["--run", "--allow-production", "--project=tren-85720", "--expected-version=3.0.873"];
const source = "gs://tren-85720.firebasestorage.app/template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/IMG_7786.mp4";
const manifest = { assets: [{ sourceRef: source, previewTime: 2.1,
  objectPath: "protected-exercise-previews/v1/b41b07b775a30700ae0ebef71c059b477471c5abc2e574c797a9ba6f4cddda04.webp",
  bytes: 48166, width: 540, height: 960 }] };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("873 smoke requires explicit exact Production/version, rejects credential overrides and owns only distinct fixtures", () => {
  assert.equal(parseExerciseHistoryAlltimeArgs(flags, {})["expected-version"], "3.0.873");
  for (const candidate of [[], flags.slice(1), flags.map(value => value.replace("tren-85720", "other")), flags.map(value => value.replace("3.0.873", "3.0.872")),
    [...flags, "--run"], [...flags, "--output-dir=../outside"]]) assert.throws(() => parseExerciseHistoryAlltimeArgs(candidate, {}));
  for (const name of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "GCLOUD_PROJECT"])
    assert.throws(() => parseExerciseHistoryAlltimeArgs(flags, { [name]: "not-used" }));
  const fixture = createAlltimeHistoryFixtures("11111111-2222-3333-4444-555555555555", "2026-10-28T10:00:00.000Z");
  assert.equal(fixture.history.length, 22); assert.equal(new Set(fixture.history.map(row => row.id)).size, 22);
  assert.equal(new Set(fixture.history.map(row => row.data.date)).size, 22);
  assert.equal(new Set(fixture.history.map(row => row.data.exercises[0].id)).size, 22);
  assert.equal(fixture.history.every(row => row.data.workoutId !== fixture.workoutId && row.data.workoutName !== fixture.workoutName && row.data.exercises[0].video === source), true);
  assert.equal(fixture.history.slice(-2).every(row => !Object.hasOwn(row.data.exercises[0].sets[0], "completed")), true);
});

test("query evidence detects own bounded two-key ordering and cursor without retaining raw values", () => {
  const shape = { parent: "projects/tren-85720/databases/(default)/documents/users/own", structuredQuery: {
    from: [{ collectionId: "history" }], orderBy: [{ field: { fieldPath: "date" }, direction: "DESCENDING" },
      { field: { fieldPath: "__name__" }, direction: "DESCENDING" }], limit: 21 } };
  const first = alltimeHistoryQueryEvidence(new URLSearchParams({ req0___data__: JSON.stringify({ addTarget: { query: shape } }) }).toString(), "own");
  assert.deepEqual(first, [{ own: true, limit: 21, dateDescending: true, nameDescending: true, exactlyTwoOrders: true, cursorPresent: false, cursorAfter: false }]);
  const next = structuredClone(shape); next.structuredQuery.startAt = { values: [{ stringValue: "secret-date" }, { referenceValue: "secret-cursor" }], before: false };
  const evidence = alltimeHistoryQueryEvidence(JSON.stringify(next), "own");
  assert.equal(evidence[0].cursorPresent, true); assert.equal(evidence[0].cursorAfter, true);
  assert.equal(JSON.stringify(evidence).includes("secret"), false);
  assert.equal(alltimeHistoryQueryEvidence(JSON.stringify(next), "other")[0].own, false);
  delete next.structuredQuery.limit; assert.equal(alltimeHistoryQueryEvidence(JSON.stringify(next), "own")[0].limit, 0);
  assert.deepEqual(alltimeHistoryQueryEvidence("not-json", "own"), []);
});

async function offlineFailure(mode) {
  let user = null, intent, sequence = 0, historyWrites = 0;
  const docs = new Map(), deleted = [], writes = [];
  const transport = async (target, options = {}) => {
    const url = new URL(target), body = options.body ? JSON.parse(options.body) : {};
    assert.ok(["tren-85720.web.app", "identitytoolkit.googleapis.com", "firestore.googleapis.com"].includes(url.hostname));
    if (url.pathname === "/__/firebase/init.json") return json({ projectId: "tren-85720", storageBucket: "tren-85720.firebasestorage.app", apiKey: "offline-key" });
    if (url.pathname === "/sw.js") return new Response('const CACHE_NAME = "workout-app-v3.0.873";');
    if (url.pathname.endsWith("accounts:lookup")) return json({ users: user ? [user] : [] });
    if (url.pathname.endsWith("accounts:signUp")) {
      assert.equal(options.headers?.Authorization, undefined);
      assert.equal(intent.identity.attempted, true); assert.equal(intent.identity.absenceVerified, true);
      assert.equal(intent.cleanupRequired, true); assert.deepEqual(intent.globalDocuments, []);
      user = { localId: "offline-alltime-client", email: body.email };
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
      assert.ok(path === "users/offline-alltime-client" || path.startsWith("users/offline-alltime-client/"));
      assert.equal(url.searchParams.get("currentDocument.exists"), "false"); assert.equal(docs.has(path), false);
      const document = { name: `projects/tren-85720/databases/(default)/documents/${path}`, fields: body.fields, updateTime: `time-${++sequence}` };
      docs.set(path, document); writes.push(path);
      if (path === "users/offline-alltime-client") {
        const action = "client-loading-snapshot", uid = "offline-alltime-client", id = createHash("sha256").update(`${uid}:${action}`).digest("hex");
        const ratePath = `securityRateLimits/${id}`;
        docs.set(ratePath, { name: `projects/tren-85720/databases/(default)/documents/${ratePath}`,
          fields: { uid: { stringValue: uid }, action: { stringValue: action } }, updateTime: `time-${++sequence}` });
      }
      if (path.includes("/history/") && ++historyWrites === 7) throw new Error("offline-ambiguous-seventh-history-write");
      return json(document);
    }
    if (options.method === "DELETE") {
      assert.equal(url.searchParams.get("currentDocument.updateTime"), docs.get(path)?.updateTime);
      docs.delete(path); deleted.push(path); return json({});
    }
    if (url.searchParams.get("showMissing") === "true") {
      const prefix = path + "/";
      return json({ documents: [...docs].filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
        .map(([, document]) => ({ name: document.name, updateTime: document.updateTime })) });
    }
    return docs.has(path) ? json(docs.get(path)) : json({}, 404);
  };
  const { report } = await runExerciseHistoryAlltimeSmoke(args, {
    readLocalVersion: async () => "3.0.873", readManifest: async () => manifest,
    operatorToken: async () => "offline-operator", fetchImpl: transport,
    createArtifacts: async () => ({ output: "offline-memory-only", frames: [], save: async (_report, value) => { intent = structuredClone(value); }, close: async () => {} })
  });
  assert.equal(report.failed, true);
  assert.equal(report.cleanup.profileTreeAbsent, true); assert.equal(report.cleanup.ratesAbsent, true);
  return { report, intent, docs, user, deleted, writes };
}

test("ambiguous signup is resolved by its preverified random email and fully cleaned", async () => {
  const result = await offlineFailure("ambiguous-signup");
  assert.equal(result.report.cleanupVerified, true); assert.equal(result.user, null); assert.equal(result.docs.size, 0);
  assert.equal(result.writes.length, 0); assert.equal(result.intent.cleanupRequired, false);
});

test("an ambiguous seventh history write is discovered and the complete owned tree and rates are removed", async () => {
  const result = await offlineFailure("ambiguous-history");
  assert.equal(result.report.cleanupVerified, true); assert.equal(result.user, null); assert.equal(result.docs.size, 0);
  assert.equal(result.writes.filter(path => path.includes("/history/")).length, 7);
  assert.equal(result.deleted.filter(path => path.includes("/history/")).length, 7);
  assert.equal(result.deleted.some(path => path.startsWith("securityRateLimits/")), true);
  assert.equal(result.intent.cleanupRequired, false);
});

test("Auth cleanup failure still cleans the owned tree and rate record and leaves durable cleanup intent", async () => {
  const result = await offlineFailure("auth-delete-fails");
  assert.equal(result.report.cleanup.authAbsent, false); assert.equal(result.report.cleanupVerified, false);
  assert.equal(result.docs.size, 0); assert.notEqual(result.user, null); assert.equal(result.intent.cleanupRequired, true);
});
