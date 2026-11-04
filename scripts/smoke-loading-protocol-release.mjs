// Opt-in live smoke. Never execute without authorization for synthetic writes.
// Lifecycle follows smoke-protected-video-release.mjs; no global config/media/UI directory reads.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = ["tren-85720-staging", "tren-85720"];
const ROLES = ["client", "trainer", "admin"];
const RATE_SCOPES = ["client-loading-snapshot", "nutrition-storage", "client-exercise-media", "profile-update-login"];
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (value, code) => { if (!value) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const safeUid = uid => typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
const field = (doc, key) => doc?.fields?.[key]?.stringValue;
export const safeLoadingSmokeError = error => ({ code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" });

export function parseLoadingSmokeArgs(args, env = process.env) {
  const result = {}, seen = new Set();
  for (const arg of args) {
    const match = /^--(project|expected-version|output-dir)=(.+)$/.exec(arg);
    const key = match?.[1] || arg;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) result[key] = match[2];
    else if (arg === "--run") result.run = true;
    else if (arg === "--allow-production") result.allowProduction = true;
    else if (arg === "--ui") result.ui = true;
    else if (arg === "--expect-cutover") result.expectCutover = true;
    else fail("unknown-argument");
  }
  check(result.run === true && PROJECTS.includes(result.project), "explicit-run-and-project-required");
  check(result.project !== "tren-85720" || result.allowProduction === true, "production-approval-flag-required");
  check(!result.allowProduction || result.project === "tren-85720", "production-flag-project-mismatch");
  check(/^\d+\.\d+\.\d+$/.test(result["expected-version"] || ""), "expected-version-required");
  check(result["output-dir"] === `artifacts/remediation-${result["expected-version"]}`, "exact-output-directory-required");
  for (const name of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])
    check(!env[name], "explicit-live-project-and-cached-operator-only");
  return result;
}

const encode = value => value === null ? { nullValue: null } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : typeof value === "object" ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
    : typeof value === "number" ? { [Number.isInteger(value) ? "integerValue" : "doubleValue"]: Number.isInteger(value) ? String(value) : value } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
async function boundedJson(response, maximum = 2 * 1024 * 1024) {
  const reader = response.body?.getReader(); check(reader, "missing-response-body");
  let size = 0; const chunks = [];
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > maximum) { await reader.cancel(); fail("response-budget-exceeded"); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { fail("invalid-json-response"); }
}
async function operatorToken(project) {
  try {
    const require = createRequire(import.meta.url), cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount(); check(account, "cached-operator-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken(); check(typeof token === "string" && token, "cached-operator-unavailable"); return token;
  } catch { fail("cached-operator-unavailable"); }
}
async function createArtifacts(options, runId) {
  const root = await realpath(ROOT), parent = resolve(root, "artifacts"), directory = resolve(root, options["output-dir"]);
  await mkdir(directory, { recursive: true });
  check(await realpath(parent) === parent && await realpath(directory) === directory, "symlink-output-forbidden");
  const prefix = `loading-protocol-${options.project}-${runId}`;
  const report = await open(resolve(directory, `${prefix}.json`), "wx");
  let intent;
  try { intent = await open(resolve(directory, `${prefix}.intent.json`), "wx"); } catch (error) { await report.close(); throw error; }
  const saveFile = async (file, value) => { const text = JSON.stringify(value, null, 2) + "\n"; await file.write(text, 0, "utf8"); await file.truncate(Buffer.byteLength(text)); await file.sync(); };
  return { output: `${options["output-dir"]}/${prefix}.json`, save: async (result, plan) => { await saveFile(intent, plan); await saveFile(report, result); },
    close: async () => { try { await report.close(); } finally { await intent.close(); } } };
}

// Test-only dependency injection; CLI accepts no transport/identity overrides.
export async function runLoadingProtocolSmoke(input, dependencies = {}) {
  const args = Object.entries(input || {}).flatMap(([key, value]) => value === true
    ? [key === "run" ? "--run" : key === "allowProduction" ? "--allow-production" : key === "expectCutover" ? "--expect-cutover" : key === "ui" ? "--ui" : `--${key}`]
    : value === false || value === undefined ? [] : [`--${key}=${value}`]);
  const options = parseLoadingSmokeArgs(args), project = options.project;
  const version = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  check(version === options["expected-version"], "local-version-mismatch");
  const runId = randomBytes(12).toString("hex"), marker = `loading-protocol:${runId}`;
  const artifact = await (dependencies.createArtifacts || createArtifacts)(options, runId);
  const identities = ROLES.map(role => ({ role, email: `loading-protocol-${runId}-${role}@example.invalid`, password: randomBytes(30).toString("base64url"), absenceVerified: false, attempted: false }));
  const [client, trainer, administrator] = identities;
  const base = `https://${project}.web.app`, database = `projects/${project}/databases/(default)`;
  const documents = `https://firestore.googleapis.com/v1/${database}/documents`, authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:`;
  const report = { schemaVersion: 1, project, version, runId, startedAt: new Date().toISOString(), cases: [], cleanup: [], containsRealUserData: false,
    limits: ["Только три собственные случайные identities и их документы; глобальная конфигурация, реальные пользователи и медиа не читаются/не меняются.",
      "Owner prepare проверяет собственный legacy дневник; --expect-cutover требует days. Глобальная конфигурация не меняется.",
      "История тренировок не записывается: не создаём subscription usage ledger. Опциональный UI не завершает тренировку и не добавляет питание.",
      "App Check не обходится: если direct API требует настоящий App Check token, smoke завершится ошибкой с очисткой.",
      "Очистка доказывает отсутствие на момент проверки; поздние внешние события не исключены."] };
  const intent = { project, version, runId, marker, cleanupRequired: true, identities: [] };
  let token, apiKey, browser, step = "initialize", cleaning = false, requests = 0, cleanupRequests = 0, domainRequests = 0, cleanupRecords = 0;
  const deadline = Date.now() + 10 * 60 * 1000;
  const persist = async () => { intent.identities = identities.map(({ role, email, uid, absenceVerified, attempted, ownershipVerified }) => ({ role, email, uid, absenceVerified, attempted, ownershipVerified })); await artifact.save(report, intent); };
  const request = async (url, { method = "GET", body, bearer, expected = 200, json = true, allowMissing = false } = {}) => {
    const parsed = new URL(url);
    check(parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port
      && [`${project}.web.app`, "firestore.googleapis.com", "identitytoolkit.googleapis.com"].includes(parsed.hostname), "unsafe-request-origin");
    if (cleaning) { cleanupRequests++; check(++domainRequests <= 6000, "cleanup-request-budget-exceeded"); }
    else check(++requests <= 250 && Date.now() <= deadline, "main-request-budget-exceeded");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (allowMissing && response.status === 404) { await response.body?.cancel(); return { status: 404, data: null }; }
    if (response.status !== expected) { await response.body?.cancel(); fail(`unexpected-http-${response.status}`); }
    if (!json || method === "DELETE") { await response.body?.cancel(); return { status: response.status }; }
    return { status: response.status, data: await boundedJson(response) };
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = path => request(docUrl(path), { bearer: token, allowMissing: true }).then(result => result.data);
  const ownPath = (identity, path) => check(safeUid(identity.uid) && (path === `users/${identity.uid}` || path.startsWith(`users/${identity.uid}/`)), "non-owned-document-path");
  const createDoc = async (identity, path, value) => { ownPath(identity, path); return request(`${docUrl(path)}?currentDocument.exists=false`, { method: "PATCH", bearer: token, body: { fields: fields(value) } }); };
  const patchProfile = async (identity, value) => {
    const path = `users/${identity.uid}`, current = await getDoc(path);
    check(field(current, "createdByUid") === marker && field(current, "email") === identity.email && current.updateTime, "profile-ownership-mismatch");
    const url = new URL(docUrl(path)); Object.keys(value).forEach(key => url.searchParams.append("updateMask.fieldPaths", key)); url.searchParams.set("currentDocument.updateTime", current.updateTime);
    return request(url, { method: "PATCH", bearer: token, body: { fields: fields(value) } });
  };
  const authCall = (action, body) => request(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${apiKey}`, { method: "POST", body });
  const lookup = async identity => {
    const { data } = await request(`${authAdmin}lookup`, { method: "POST", bearer: token, body: { email: [identity.email] } });
    const rows = data.users || []; check(Array.isArray(rows) && rows.length <= 1, "ambiguous-owned-identity");
    if (!rows.length) return null;
    const user = rows[0]; check(user.email === identity.email && safeUid(user.localId) && (!identity.uid || identity.uid === user.localId), "identity-ownership-mismatch"); return user;
  };
  const api = (path, identity, body, expected = 200) => request(`${base}/api/${path}`, { method: "POST", body, bearer: identity?.idToken, expected, json: expected === 200 }).then(result => result.data);
  const nutrition = (identity, body, expected = 200) => api("nutrition/storage", identity, body, expected);
  const pass = async label => { report.cases.push(label); await persist(); };
  const deleteDocument = async (document, path) => {
    check(document?.name === `${database}/documents/${path}` && document.updateTime, "unsafe-document-delete");
    await request(`${docUrl(path)}?currentDocument.updateTime=${encodeURIComponent(document.updateTime)}`, { method: "DELETE", bearer: token, json: false });
  };
  const collectionIds = async path => {
    const result = []; let pageToken;
    do { const { data } = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", bearer: token, body: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } });
      check(Array.isArray(data.collectionIds || []), "invalid-collection-list"); result.push(...(data.collectionIds || [])); check(result.length <= 1000, "collection-budget-exceeded"); pageToken = data.nextPageToken;
    } while (pageToken);
    return result;
  };
  const removeTree = async (path, root, depth = 0) => {
    check((path === root || path.startsWith(`${root}/`)) && depth <= 12 && ++cleanupRecords <= 1000, "owned-tree-cleanup-budget");
    for (const collection of await collectionIds(path)) {
      check(typeof collection === "string" && collection && !collection.includes("/") && ![".", ".."].includes(collection), "unsafe-collection-id");
      let pageToken;
      do {
        const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true"); url.searchParams.set("mask.fieldPaths", "_smokeOnly"); if (pageToken) url.searchParams.set("pageToken", pageToken);
        const { data } = await request(url, { bearer: token });
        for (const child of data.documents || []) { const prefix = `${database}/documents/${path}/${collection}/`;
          check(child.name?.startsWith(prefix) && !child.name.slice(prefix.length).includes("/"), "unsafe-child-document"); await removeTree(child.name.slice(`${database}/documents/`.length), root, depth + 1); }
        pageToken = data.nextPageToken;
      } while (pageToken);
    }
    const document = await getDoc(path); if (document) await deleteDocument(document, path);
  };
  try {
    await persist(); token = await (dependencies.operatorToken || operatorToken)(project);
    step = "hosting-version";
    const { data: config } = await request(`${base}/__/firebase/init.json`);
    check(config.projectId === project && config.storageBucket === `${project}.firebasestorage.app` && typeof config.apiKey === "string", "hosting-project-mismatch"); apiKey = config.apiKey;
    const workerResponse = await (dependencies.fetchImpl || fetch)(`${base}/sw.js?loading-smoke=${runId}`, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    check(workerResponse.status === 200, "published-version-unavailable");
    const workerText = await workerResponse.text(); check(Buffer.byteLength(workerText) <= 512 * 1024 && workerText.includes(`const CACHE_NAME = "workout-app-v${version}";`), "published-version-mismatch");
    await pass("Точный Hosting project и версия подтверждены");
    step = "anonymous-denied"; await api("client-loading-snapshot", null, { kind: "workouts" }, 401); await nutrition(null, { action: "read" }, 401); await pass("Оба API закрыты без Auth");
    step = "create-owned-identities";
    for (const identity of identities) {
      // finishAuth's default alias accepts at most 32 characters. Deliberately
      // longer local parts keep optional password UI from creating global aliases.
      check(identity.email.split("@")[0].length > 32, "synthetic-email-must-not-create-alias");
      check(await lookup(identity) === null, "random-identity-already-exists"); identity.absenceVerified = true; identity.attempted = true; await persist();
      const { data } = await authCall("signUp", { email: identity.email, password: identity.password, returnSecureToken: true });
      check(safeUid(data.localId) && typeof data.idToken === "string", "signup-response-invalid"); identity.uid = data.localId; identity.idToken = data.idToken;
      const claims = JSON.parse(Buffer.from(data.idToken.split(".")[1], "base64url").toString("utf8")); check(claims.aud === project && claims.sub === identity.uid, "token-project-mismatch"); await persist();
      check(Boolean(await lookup(identity)), "created-identity-not-found"); identity.ownershipVerified = true; await persist();
      await createDoc(identity, `users/${identity.uid}`, { role: identity.role, active: true, name: `Synthetic loading ${identity.role}`, email: identity.email,
        createdByUid: marker, createdAt: new Date().toISOString(), firstSetupCompleted: true,
        ...(identity.role === "client" ? { accountAccessStatus: "awaiting_trainer", trainerAssignmentState: "unassigned" } : {}),
        ...(identity.role === "admin" ? { adminClaimVersion: runId } : {}) });
    }
    step = "pending-member-denied"; await api("client-loading-snapshot", client, { kind: "workouts" }, 403); await nutrition(client, { action: "read" }, 403);
    const now = new Date().toISOString(), generation = `smoke_${runId}`, versionId = `assignment_${runId}`;
    step = "activate-owned-client";
    await patchProfile(client, { accountAccessStatus: "active", trainerAssignmentState: "assigned", assignedTrainerId: trainer.uid, trainerId: trainer.uid,
      assignedProgramId: versionId, assignedProgramUpdatedAt: now, assignedProgramAddedAt: now, assignedProgramName: "Synthetic protocol workout", workoutModePreference: { mode: "individual", remember: true, updatedAt: now } });
    step = "owner-legacy-prepare";
    const dayA = "2026-10-24", dayB = "2026-10-25", removedAt = new Date(Date.now() + 500).toISOString();
    const legacy = { updatedAt: now, goals: { calories: 2000 }, days: {
      [dayA]: { updatedAt: now, water: 1250, foods: [{ id: "legacy_portion_a", name: "Synthetic oats", calories: 215, protein: 7, fat: 5, carbs: 35, updatedAt: now }], deletedFoods: { removed_portion: removedAt } },
      [dayB]: { updatedAt: now, water: 1750, foods: [{ id: "legacy_portion_b", name: "Synthetic rice", calories: 180, protein: 4, fat: 2, carbs: 36, updatedAt: now }] }
    } };
    await createDoc(client, `users/${client.uid}/nutrition/state`, legacy);
    await createDoc(client, `users/${client.uid}/nutrition/myFoods`, { myFoods: { smoke_food: { name: "Synthetic food", calories: 100, updatedAt: now },
      removed_food: { name: "Removed synthetic food", calories: 50, updatedAt: now } }, deletedMyFoods: { removed_food: removedAt }, ownerUid: client.uid });
    const beforePrepare = await nutrition(client, { action: "read", mode: "full" });
    check(beforePrepare.manifest.sourceOfTruth === "legacy" && beforePrepare.coverage.complete
      && canonical(beforePrepare.state.days) === canonical(legacy.days)
      && beforePrepare.state.days[dayA].foods.map(food => food.id).join() === "legacy_portion_a"
      && beforePrepare.state.myFoods.smoke_food?.calories === 100 && beforePrepare.state.deletedMyFoods.removed_food === removedAt
      && !beforePrepare.state.myFoods.removed_food, "legacy-fixture-normalization-invalid");
    const prepared = await nutrition(client, { action: "prepare" });
    check(!options.expectCutover || prepared.prepared === true && prepared.manifest.sourceOfTruth === "days", "expected-cutover-not-prepared");
    check(prepared.prepared === true || prepared.reason === "compatibility", "prepare-incomplete");
    const afterPrepare = await nutrition(client, { action: "read", mode: "full" });
    check(afterPrepare.coverage.complete && canonical(afterPrepare.state) === canonical(beforePrepare.state), "prepare-data-not-exact");
    check(afterPrepare.manifest.sourceOfTruth === prepared.manifest.sourceOfTruth, "prepare-authority-mismatch");
    await pass(`Owner legacy → prepare: foods/macros/water/removals/My Foods сохранены точно; source=${afterPrepare.manifest.sourceOfTruth}`);
    step = "seed-owned-workout-measurement";
    await createDoc(client, `users/${client.uid}/workouts/smoke_day`, { name: "Synthetic protocol workout", status: "planned", assignedBy: trainer.uid,
      assignedProgramId: versionId, assignedProgramUpdatedAt: now, assignedProgramAddedAt: now, assignedProgramLifecycleStatus: "active", order: 1,
      exercises: [{ id: "smoke_exercise", name: "Synthetic protocol exercise", video: "", sets: [{ reps: 10, weight: 5 }] }] });
    await createDoc(client, `users/${client.uid}/measurements/smoke_measurement`, { date: now, weight: "72", kind: "weight_checkin" });
    step = "owner-snapshots";
    const snapshot = await api("client-loading-snapshot", client, { kind: "workouts", clientId: trainer.uid });
    check(snapshot.uid === client.uid && snapshot.kind === "workouts" && snapshot.coverage.history === "complete" && snapshot.coverage.workouts === "complete"
      && snapshot.sourceCounts.workouts === 1 && snapshot.sourceCounts.history === 0 && snapshot.workouts[0].id === "smoke_day" && /^[a-f0-9]{64}$/.test(snapshot.sourceRevision), "workout-snapshot-invalid");
    const measurements = await api("client-loading-snapshot", client, { kind: "measurements" });
    check(measurements.uid === client.uid && measurements.coverage.measurements === "complete" && measurements.measurements.latestWeight.id === "smoke_measurement", "measurement-snapshot-invalid");
    await pass("Owner snapshots: полная coverage, только собственный UID и synthetic fixtures");
    step = "seed-owned-day-generation";
    // Isolated later protocol fixture replaces only our own manifest; retain every
    // prepare-created generation for bounded recursive cleanup in finally.
    const manifestPath = `users/${client.uid}/nutrition/manifest`, oldManifest = await getDoc(manifestPath);
    ownPath(client, manifestPath);
    await request(`${docUrl(manifestPath)}?${oldManifest ? `currentDocument.updateTime=${encodeURIComponent(oldManifest.updateTime)}` : "currentDocument.exists=false"}`,
      { method: "PATCH", bearer: token, body: { fields: fields({ schemaVersion: 2, sourceOfTruth: "days", generation, writerEpoch: 1, revision: 1 }) } });
    await createDoc(client, `users/${client.uid}/nutritionGenerations/${generation}`, { metadata: { goals: { calories: 2000 }, updatedAt: now } });
    for (const [dayKey, water] of [[dayA, 1000], [dayB, 1500]]) await createDoc(client, `users/${client.uid}/nutritionGenerations/${generation}/days/${dayKey}`, { dayKey, revision: 1, day: { water, foods: [], updatedAt: now } });
    step = "nutrition-coverage";
    const selected = await nutrition(client, { action: "read", mode: "days", dayKeys: [dayA, "2026-10-23"] });
    check(!selected.coverage.complete && Object.keys(selected.state.days).join() === dayA && selected.coverage.missingDayKeys.includes("2026-10-23"), "selected-coverage-invalid");
    const first = await nutrition(client, { action: "read", mode: "full", limit: 1 });
    const second = await nutrition(client, { action: "read", mode: "full", limit: 1, cursor: first.coverage.nextCursor });
    check(!first.coverage.complete && first.coverage.nextCursor === dayA && !second.coverage.nextCursor && !second.coverage.complete
      && Object.keys(second.state.days).join() === dayB && first.manifest.revision === second.manifest.revision, "full-pagination-invalid");
    await pass("Selected-day и cursor full-page coverage не выдаются за полный дневник");
    step = "receipt-idempotency";
    const commit = { action: "commit", protocolVersion: 2, mutationId: `owner_${runId}`, generation, writerEpoch: 1, dayKeys: [dayA],
      snapshot: { updatedAt: new Date(Date.now() + 1000).toISOString(), days: { [dayA]: { water: 2100, foods: [], updatedAt: new Date(Date.now() + 1000).toISOString(), fieldUpdatedAt: { water: new Date(Date.now() + 1000).toISOString() } } } } };
    const saved = await nutrition(client, commit), repeated = await nutrition(client, commit);
    check(saved.duplicate === false && repeated.duplicate === true && repeated.manifest.revision === saved.manifest.revision && repeated.state.days[dayA].water === 2100, "receipt-not-idempotent");
    await pass("Повтор одного mutation receipt не применяет правку повторно");
    step = "trainer-authority";
    const trainerPatch = { action: "commit", uid: client.uid, protocolVersion: 2, mutationId: `trainer_${runId}`, generation, writerEpoch: 1, dayKeys: [], snapshot: { goals: { calories: 1800 }, updatedAt: new Date(Date.now() + 2000).toISOString() }, userPatch: { nutritionGoals: { calories: 1800 } } };
    await nutrition(trainer, trainerPatch);
    await patchProfile(client, { assignedTrainerId: administrator.uid, trainerId: administrator.uid });
    await nutrition(trainer, { action: "read", uid: client.uid }, 403);
    await nutrition(trainer, { ...trainerPatch, mutationId: `revoked_${runId}` }, 403);
    await pass("Назначенный trainer пишет только plan; переназначенный trainer закрыт");
    step = "current-admin-claim";
    await request(`${authAdmin}update`, { method: "POST", bearer: token, body: { localId: administrator.uid, customAttributes: JSON.stringify({ admin: true, adminClaimVersion: runId }) } });
    const adminSession = await authCall("signInWithPassword", { email: administrator.email, password: administrator.password, returnSecureToken: true }); administrator.idToken = adminSession.data.idToken;
    const adminClaims = JSON.parse(Buffer.from(administrator.idToken.split(".")[1], "base64url").toString("utf8")); check(adminClaims.aud === project && adminClaims.admin === true && adminClaims.adminClaimVersion === runId, "admin-claim-invalid");
    await nutrition(administrator, { action: "read", uid: client.uid });
    await patchProfile(administrator, { adminClaimVersion: `${runId}_revoked` });
    await nutrition(administrator, { action: "read", uid: client.uid }, 403);
    await patchProfile(administrator, { adminClaimVersion: runId }); await pass("Действующий matching admin claim разрешён, устаревший claim закрыт");
    step = "reset-and-old-epoch";
    const clear = { action: "clear", protocolVersion: 2, mutationId: `clear_${runId}`, generation, writerEpoch: 1 };
    const cleared = await nutrition(client, clear), clearRetry = await nutrition(client, clear);
    check(cleared.manifest.writerEpoch === 2 && clearRetry.duplicate === true, "clear-receipt-invalid");
    await nutrition(client, { ...commit, mutationId: `old_epoch_${runId}` }, 409);
    const afterClear = await nutrition(client, { action: "read", mode: "full" });
    check(Object.keys(afterClear.state.days).length === 0 && afterClear.state.myFoods.smoke_food?.name === "Synthetic food", "reset-lost-library-or-restored-days");
    await pass("Reset идемпотентен, старый epoch закрыт, личная My Foods сохранена");
    if (options.ui) {
      step = "owned-client-ui";
      await patchProfile(client, { assignedTrainerId: trainer.uid, trainerId: trainer.uid });
      const { chromium } = await import("playwright"); browser = await chromium.launch();
      const context = await browser.newContext({ viewport: { width: 402, height: 760 }, serviceWorkers: "block" }); const page = await context.newPage();
      const pageErrors = []; page.on("pageerror", error => pageErrors.push(error.name));
      await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
      await page.goto(`${base}/?loading-protocol=${runId}`, { waitUntil: "domcontentloaded" });
      const method = page.getByRole("button", { name: "Email или логин", exact: true }); if (await method.isVisible()) await method.click();
      await page.getByLabel("Email или логин", { exact: true }).fill(client.email); await page.getByLabel("Пароль", { exact: true }).fill(client.password);
      await page.getByRole("button", { name: "Войти", exact: true }).click();
      await page.getByTestId("client-nav-workouts").waitFor({ state: "visible", timeout: 45000 }); await page.getByTestId("client-nav-workouts").click();
      await page.getByText("Synthetic protocol workout", { exact: true }).first().waitFor({ state: "visible", timeout: 20000 });
      await page.getByTestId("client-nav-nutrition").click(); await page.getByTestId("nutrition-page").waitFor({ state: "visible", timeout: 20000 });
      check(pageErrors.length === 0, "client-ui-runtime-error"); await context.close(); await browser.close(); browser = null;
      await pass("Реальный password login: собственные тренировки и питание открываются без runtime errors");
    }
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safeLoadingSmokeError(error); }
  finally {
    cleaning = true; try { await browser?.close(); } catch { report.browserCloseFailed = true; report.failed = true; }
    for (const identity of identities) {
      const result = { role: identity.role };
      const clean = async (name, operation) => { domainRequests = 0; try { result[name] = await operation(); } catch (error) { result[name] = false; (result.errors ||= {})[name] = safeLoadingSmokeError(error); } };
      if (!identity.attempted || !identity.absenceVerified) Object.assign(result, { authAbsent: true, profileTreeAbsent: true, ratesAbsent: true, notCreated: true });
      else {
        await clean("identityResolved", async () => { const user = await lookup(identity); if (user) { identity.uid ||= user.localId; identity.ownershipVerified = true; } return Boolean(identity.uid) || user === null; });
        if (identity.uid && identity.ownershipVerified) {
          await clean("authAbsent", async () => { if (await lookup(identity)) await request(`${authAdmin}delete`, { method: "POST", bearer: token, body: { localId: identity.uid } }); return await lookup(identity) === null; });
          await clean("profileTreeAbsent", async () => { const root = `users/${identity.uid}`, profile = await getDoc(root);
            if (profile) check(field(profile, "createdByUid") === marker && field(profile, "email") === identity.email, "cleanup-profile-ownership-mismatch");
            await removeTree(root, root); return await getDoc(root) === null && (await collectionIds(root)).length === 0; });
          await clean("ratesAbsent", async () => { for (const scope of RATE_SCOPES) { const path = `securityRateLimits/${hash(`${identity.uid}:${scope}`)}`, rate = await getDoc(path);
            if (rate) { check(field(rate, "uid") === identity.uid && field(rate, "action") === scope, "rate-ownership-mismatch"); await deleteDocument(rate, path); }
            check(await getDoc(path) === null, "rate-still-present"); } return true; });
        } else {
          // A response UID without verified ownership must not certify an uninspected tree.
          const absentWithoutUid = !identity.uid && result.identityResolved === true;
          Object.assign(result, { authAbsent: absentWithoutUid, profileTreeAbsent: absentWithoutUid, ratesAbsent: absentWithoutUid });
        }
      }
      result.cleaned = result.authAbsent === true && result.profileTreeAbsent === true && result.ratesAbsent === true; report.cleanup.push(result);
      // Artifact I/O failure must never skip cleanup of the remaining identities.
      try { await persist(); } catch { report.artifactWriteFailed = true; report.failed = true; }
    }
    report.cleanupVerified = report.cleanup.length === 3 && report.cleanup.every(result => result.cleaned);
    report.failed ||= !report.cleanupVerified; intent.cleanupRequired = !report.cleanupVerified;
    report.finishedAt = new Date().toISOString(); report.requestCount = requests; report.cleanupRequestCount = cleanupRequests; report.cleanupRecords = cleanupRecords;
    token = undefined; apiKey = undefined; identities.forEach(identity => { identity.idToken = undefined; identity.password = undefined; });
    try { await persist(); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const { report, output } = await runLoadingProtocolSmoke(parseLoadingSmokeArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ project: report.project, version: report.version, cases: report.cases.length, failed: report.failed === true, failedStep: report.failedStep || null, cleanupVerified: report.cleanupVerified, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safeLoadingSmokeError(error))); process.exitCode = 1; }
}
