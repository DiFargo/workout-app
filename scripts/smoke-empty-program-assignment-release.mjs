// Opt-in live smoke. The root agent must review and explicitly run after deployment.
// Only two random synthetic identities, their user trees and their owned rate/ledger rows.
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "tren-85720", VERSION = "3.0.900", OUTPUT = `artifacts/remediation-${VERSION}`;
const RATE_SCOPE = "empty-program-delete";
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (value, code) => { if (!value) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const safeUid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const stringField = (doc, key) => doc?.fields?.[key]?.stringValue;
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const safeEmptyProgramSmokeError = error => ({ code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" });

export function parseEmptyProgramSmokeArgs(args, env = process.env) {
  const options = {}, seen = new Set();
  for (const arg of args) {
    const match = /^--(project|expected-version|output-dir)=(.+)$/.exec(arg), key = match?.[1] || arg;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) options[key] = match[2];
    else if (arg === "--run") options.run = true;
    else if (arg === "--allow-production") options.allowProduction = true;
    else fail("unknown-argument");
  }
  check(options.run === true && options.allowProduction === true && options.project === PROJECT, "explicit-production-approval-required");
  check(options["expected-version"] === VERSION, "exact-version-required");
  check(!options["output-dir"] || options["output-dir"] === OUTPUT, "exact-output-directory-required");
  options["output-dir"] = OUTPUT;
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])
    check(!env[key], "cached-operator-and-explicit-project-only");
  return options;
}

export function isOwnedEmptyProgramSmokePath(uid, path) {
  return safeUid(uid) && typeof path === "string" && !path.split("/").some(segment => !segment || [".", ".."].includes(segment)) &&
    (path === `users/${uid}` || path.startsWith(`users/${uid}/`));
}

export function createEmptyProgramSmokeFixtures(runId, trainerUid, now = new Date().toISOString()) {
  check(/^[a-f0-9]{24}$/.test(runId) && safeUid(trainerUid) && Number.isFinite(Date.parse(now)), "unsafe-fixture-identity");
  const stamp = offset => new Date(Date.parse(now) - offset * 86400000).toISOString();
  const assignment = (key, offset, archived = true) => ({ assignedProgramId: `smoke_${runId}_${key}`, assignedProgramName: `Synthetic ${key}`,
    assignedProgramAddedAt: stamp(offset), assignedProgramUpdatedAt: stamp(offset), assignedBy: trainerUid,
    assignedProgramAssignedByUid: trainerUid, assignedProgramLifecycleStatus: archived ? "archived" : "active",
    assignedProgramVisibility: archived ? "trainer_archived" : "client_active" });
  const active = assignment("active", 0, false), empty = assignment("empty", 4, false), historical = assignment("historical", 3), started = assignment("started", 2), basic = assignment("basic", 1);
  const prescribed = [{ id: "synthetic_exercise", name: "Synthetic exercise", sets: [{ reps: "12", weight: "20" }], rest: "90 сек" }];
  const workouts = [
    { id: "active_day", data: { ...active, name: "Synthetic current workout", status: "planned", exercises: prescribed } },
    { id: "empty_a", data: { ...empty, name: "Synthetic empty A", status: "planned", exercises: prescribed } },
    { id: "empty_b", data: { ...empty, name: "Synthetic empty B", status: "scheduled", exercises: prescribed } },
    { id: "historical_day", data: { ...historical, name: "Synthetic historical workout", status: "planned", exercises: prescribed } },
    { id: "started_day", data: { ...started, name: "Synthetic started workout", status: "planned", startedAt: now, exercises: prescribed } },
    { id: "basic_day", data: { ...basic, assignedProgramId: `basic_${runId}`, name: "Synthetic basic workout", source: "basic", status: "planned", exercises: prescribed } }
  ];
  const history = { id: "smoke_history", data: { workoutId: "historical_day", workoutName: "Synthetic historical workout", date: "2020-01-01T10:00:00.000Z",
    assignedProgramId: historical.assignedProgramId, assignedProgramAddedAt: historical.assignedProgramAddedAt,
    exercises: [{ id: "synthetic_exercise", name: "Synthetic exercise", sets: [{ reps: 12, weight: 20, completed: true }] }], isTest: true } };
  return { workouts, history, keys: { active: `time:${active.assignedProgramAddedAt}`, empty: `time:${empty.assignedProgramAddedAt}`,
    historical: `time:${historical.assignedProgramAddedAt}`, started: `time:${started.assignedProgramAddedAt}`, basic: `time:${basic.assignedProgramAddedAt}` },
  clientPatch: { ...active, assignedProgramAt: active.assignedProgramAddedAt, assignedWorkoutCount: 1,
    workoutCalendar: { plannedWorkouts: [{ workoutId: "active_day", date: "2099-01-10", assignedProgramAddedAt: active.assignedProgramAddedAt }],
      scheduledDates: ["2099-01-10"], monthlyTrainingDates: ["2099-01-10"], customSmokeValue: runId },
    // A 2020 history date is outside this future date-based period, so the usage trigger must not alter balances.
    subscription: { periodMode: "dates", startDate: "2099-01-01", cycleId: `smoke_${runId}`, cycleStartedAt: now,
      purchasedSessions: 8, totalSessions: 8, usedSessions: 0, remainingSessions: 8, status: "active" } } };
}

const encode = value => value === null ? { nullValue: null } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : typeof value === "object" ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
    : typeof value === "number" ? { [Number.isInteger(value) ? "integerValue" : "doubleValue"]: Number.isInteger(value) ? String(value) : value } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
async function boundedJson(response) {
  const reader = response.body?.getReader(); check(reader, "missing-response-body");
  const chunks = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 2 * 1024 * 1024) { await reader.cancel(); fail("response-budget-exceeded"); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { fail("invalid-json-response"); }
}
async function operatorToken(project) {
  try {
    const require = createRequire(import.meta.url);
    const paths = [".firebase-npm-cache", ".npm-cache"].map(cache => resolve(ROOT, `${cache}/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib`));
    const cli = paths.find(path => existsSync(resolve(path, "auth.js"))); check(cli, "cached-cli-unavailable");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount(); check(account, "cached-operator-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken(); check(typeof token === "string" && token, "cached-operator-unavailable"); return token;
  } catch { fail("cached-operator-unavailable"); }
}
async function createArtifacts(options, runId) {
  const root = await realpath(ROOT), directory = resolve(root, options["output-dir"]);
  await mkdir(directory, { recursive: true });
  check(await realpath(directory) === directory && await realpath(resolve(root, "artifacts")) === resolve(root, "artifacts"), "symlink-output-forbidden");
  const prefix = `empty-program-${runId}`, report = await open(resolve(directory, `${prefix}.json`), "wx");
  let intent; try { intent = await open(resolve(directory, `${prefix}.intent.json`), "wx"); } catch (error) { await report.close(); throw error; }
  const save = async (file, value) => { const text = JSON.stringify(value, null, 2) + "\n"; await file.write(text, 0, "utf8"); await file.truncate(Buffer.byteLength(text)); await file.sync(); };
  return { output: `${options["output-dir"]}/${prefix}.json`, save: async (result, plan) => { await save(intent, plan); await save(report, result); },
    close: async () => { try { await report.close(); } finally { await intent.close(); } } };
}

// Dependency injection is for offline guard tests only. The CLI accepts no identity/transport overrides.
export async function runEmptyProgramAssignmentSmoke(options, dependencies = {}) {
  options = parseEmptyProgramSmokeArgs(Object.entries(options).flatMap(([key, value]) => value === true ? [key === "allowProduction" ? "--allow-production" : `--${key}`]
    : [`--${key}=${value}`]));
  const version = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  check(version === VERSION, "local-version-mismatch");
  const runId = randomBytes(12).toString("hex"), marker = `empty-program:${runId}`, base = `https://${PROJECT}.web.app`;
  const database = `projects/${PROJECT}/databases/(default)`, documents = `https://firestore.googleapis.com/v1/${database}/documents`;
  const authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:`;
  const identities = ["trainer", "client"].map(role => ({ role, email: `empty-program-assignment-${runId}-${role}@example.invalid`,
    password: randomBytes(30).toString("base64url"), absenceVerified: false, attempted: false }));
  const [trainer, client] = identities, artifact = await (dependencies.createArtifacts || createArtifacts)(options, runId);
  const report = { schemaVersion: 1, project: PROJECT, version, runId, startedAt: new Date().toISOString(), cases: [], cleanup: [], containsRealUserData: false,
    limits: ["Только два собственных случайных аккаунта, их документы и точные owned rate/ledger записи; без реальных клиентов и Telegram.",
      "App Check не обходится. Если требуется настоящий токен, проверка завершается ошибкой с очисткой.",
      "Очистка подтверждает отсутствие при повторной проверке; будущие повторы внешних Cloud Events нельзя исключить навсегда."] };
  const intent = { project: PROJECT, version, runId, marker, cleanupRequired: true, identities: [], historyIds: ["smoke_history"] };
  let token, apiKey, step = "initialize", cleaning = false, requests = 0, cleanupRequests = 0, cleanupRecords = 0;
  const deadline = Date.now() + 8 * 60 * 1000;
  const persist = async () => { intent.identities = identities.map(({ role, email, uid, absenceVerified, attempted, ownershipVerified }) => ({ role, email, uid, absenceVerified, attempted, ownershipVerified })); await artifact.save(report, intent); };
  const request = async (target, { method = "GET", body, bearer, expected = 200, json = true, allowMissing = false } = {}) => {
    const url = new URL(target); check(url.protocol === "https:" && !url.username && !url.password && !url.port &&
      [`${PROJECT}.web.app`, "identitytoolkit.googleapis.com", "firestore.googleapis.com"].includes(url.hostname), "unsafe-request-origin");
    if (cleaning) check(++cleanupRequests <= 1200, "cleanup-request-budget-exceeded");
    else check(++requests <= 160 && Date.now() <= deadline, "main-request-budget-exceeded");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (allowMissing && response.status === 404) { await response.body?.cancel(); return { status: 404, data: null }; }
    if (response.status !== expected) { await response.body?.cancel(); fail(`unexpected-http-${response.status}`); }
    if (!json || method === "DELETE") { await response.body?.cancel(); return { status: response.status }; }
    return { status: response.status, data: await boundedJson(response) };
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = path => request(docUrl(path), { bearer: token, allowMissing: true }).then(result => result.data);
  const own = (identity, path) => check(isOwnedEmptyProgramSmokePath(identity.uid, path), "non-owned-document-path");
  const createDoc = async (identity, path, data) => { own(identity, path); return request(`${docUrl(path)}?currentDocument.exists=false`, { method: "PATCH", bearer: token, body: { fields: fields({ ...data, _smokeOnly: marker }) } }).then(result => result.data); };
  const patchProfile = async (identity, patch) => {
    const path = `users/${identity.uid}`, current = await getDoc(path); own(identity, path);
    check(stringField(current, "createdByUid") === marker && stringField(current, "email") === identity.email && current.updateTime, "profile-ownership-mismatch");
    const url = new URL(docUrl(path)); Object.keys(patch).forEach(key => url.searchParams.append("updateMask.fieldPaths", key)); url.searchParams.set("currentDocument.updateTime", current.updateTime);
    return request(url, { method: "PATCH", bearer: token, body: { fields: fields(patch) } });
  };
  const lookup = async identity => {
    const { data } = await request(`${authAdmin}lookup`, { method: "POST", bearer: token, body: { email: [identity.email] } });
    const users = data.users || []; check(Array.isArray(users) && users.length <= 1, "ambiguous-owned-identity"); if (!users.length) return null;
    check(users[0].email === identity.email && safeUid(users[0].localId) && (!identity.uid || users[0].localId === identity.uid), "identity-ownership-mismatch"); return users[0];
  };
  const api = (identity, assignmentKey, expected = 200) => request(`${base}/api/trainer-program-assignment-delete`, { method: "POST", bearer: identity?.idToken,
    body: { clientId: client.uid || "anonymous-placeholder", assignmentKey }, expected }).then(result => result.data);
  const pass = async label => { report.cases.push(label); await persist(); };
  const deleteDoc = async (doc, path) => { check(doc?.name === `${database}/documents/${path}` && doc.updateTime, "unsafe-document-delete");
    await request(`${docUrl(path)}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, { method: "DELETE", bearer: token, json: false }); };
  const collectionIds = async path => { const ids = []; let pageToken; do { const { data } = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", bearer: token,
    body: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } }); ids.push(...(data.collectionIds || [])); check(ids.length <= 100, "collection-budget-exceeded"); pageToken = data.nextPageToken; } while (pageToken); return ids; };
  const removeTree = async (path, root, depth = 0) => {
    check((path === root || path.startsWith(`${root}/`)) && depth <= 8 && ++cleanupRecords <= 300, "owned-tree-cleanup-budget");
    for (const collection of await collectionIds(path)) {
      check(typeof collection === "string" && /^[A-Za-z0-9_-]+$/.test(collection), "unsafe-collection-id"); let pageToken;
      do { const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true"); if (pageToken) url.searchParams.set("pageToken", pageToken);
        const { data } = await request(url, { bearer: token }); for (const child of data.documents || []) { const prefix = `${database}/documents/${path}/${collection}/`;
          check(child.name?.startsWith(prefix) && !child.name.slice(prefix.length).includes("/"), "unsafe-child-document"); await removeTree(child.name.slice(`${database}/documents/`.length), root, depth + 1); } pageToken = data.nextPageToken;
      } while (pageToken);
    }
    const doc = await getDoc(path); if (doc) await deleteDoc(doc, path);
  };
  const ownLedger = async identity => {
    const { data } = await request(`${documents}:runQuery`, { method: "POST", bearer: token, body: { structuredQuery: { from: [{ collectionId: "subscriptionUsageLedger" }],
      where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: identity.uid } } }, limit: 20 } } });
    check(Array.isArray(data), "invalid-ledger-query"); const docs = data.filter(row => row.document).map(row => row.document); check(docs.length < 20, "ledger-budget-exceeded");
    for (const doc of docs) check(stringField(doc, "uid") === identity.uid && intent.historyIds.includes(stringField(doc, "historyId")) &&
      new RegExp(`^${database.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/documents/subscriptionUsageLedger/[a-f0-9]{64}$`).test(doc.name), "ledger-ownership-mismatch");
    return docs;
  };
  const sleep = milliseconds => dependencies.sleep ? dependencies.sleep(milliseconds) : new Promise(resolve => setTimeout(resolve, milliseconds));
  try {
    await persist(); token = await (dependencies.operatorToken || operatorToken)(PROJECT);
    step = "hosting-version"; const { data: config } = await request(`${base}/__/firebase/init.json`);
    check(config.projectId === PROJECT && config.storageBucket === `${PROJECT}.firebasestorage.app` && typeof config.apiKey === "string", "hosting-project-mismatch"); apiKey = config.apiKey;
    const workerResponse = await (dependencies.fetchImpl || fetch)(`${base}/sw.js?empty-program-version=${runId}`, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    const workerText = await workerResponse.text(); check(workerResponse.status === 200 && Buffer.byteLength(workerText) <= 512 * 1024 && workerText.includes(`const CACHE_NAME = "workout-app-v${VERSION}";`), "published-version-mismatch");
    await pass("Точный проект и версия Hosting подтверждены");
    step = "anonymous-denied"; await api(null, "time:2026-01-01T00:00:00.000Z", 401); await pass("Анонимный запрос закрыт");
    step = "create-identities";
    for (const identity of identities) {
      check(identity.email.split("@")[0].length > 32 && await lookup(identity) === null, "random-identity-already-exists");
      identity.absenceVerified = true; identity.attempted = true; await persist();
      const { data } = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: "POST", body: { email: identity.email, password: identity.password, returnSecureToken: true } });
      check(safeUid(data.localId) && typeof data.idToken === "string", "signup-response-invalid"); identity.uid = data.localId; identity.idToken = data.idToken;
      const claims = JSON.parse(Buffer.from(data.idToken.split(".")[1], "base64url").toString("utf8")); check(claims.aud === PROJECT && claims.sub === identity.uid, "token-project-mismatch");
      await persist(); check(Boolean(await lookup(identity)), "created-identity-not-found"); identity.ownershipVerified = true; await persist();
      await createDoc(identity, `users/${identity.uid}`, { role: identity.role, active: true, name: `Synthetic empty program ${identity.role}`, email: identity.email,
        createdByUid: marker, createdAt: new Date().toISOString(), firstSetupCompleted: true, isTest: true });
    }
    const fixture = createEmptyProgramSmokeFixtures(runId, trainer.uid); step = "create-owned-fixtures";
    await patchProfile(client, { ...fixture.clientPatch, accountAccessStatus: "active", trainerAssignmentState: "assigned", assignedTrainerId: trainer.uid, trainerId: trainer.uid });
    for (const workout of fixture.workouts) await createDoc(client, `users/${client.uid}/workouts/${workout.id}`, workout.data);
    await createDoc(client, `users/${client.uid}/history/${fixture.history.id}`, fixture.history.data);
    await createDoc(client, `users/${client.uid}/nutrition/smoke_state`, { foods: [], water: 1200 });
    const originalProfile = await getDoc(`users/${client.uid}`);
    const emptyPaths = ["empty_a", "empty_b"].map(id => `users/${client.uid}/workouts/${id}`);
    const originalCurrent = await getDoc(`users/${client.uid}/workouts/active_day`);
    const archiveCalendar = { ...fixture.clientPatch.workoutCalendar, updatedAt: new Date().toISOString() };
    const datedEntries = emptyPaths.map((_, index) => ({ workoutId: index ? "empty_b" : "empty_a", date: `2099-01-${12 + index}`,
      assignedProgramAddedAt: fixture.keys.empty.slice(5), status: "planned" }));
    const datedCalendar = { ...archiveCalendar, plannedWorkouts: [...archiveCalendar.plannedWorkouts, ...datedEntries],
      scheduledDates: [...archiveCalendar.scheduledDates, ...datedEntries.map(entry => entry.date)],
      monthlyTrainingDates: [...archiveCalendar.monthlyTrainingDates, ...datedEntries.map(entry => entry.date)] };
    const clientCommit = async (updates, expected = 200) => {
      const writes = [];
      for (const [path, patch] of updates) {
        own(client, path); const before = await getDoc(path);
        check(before?.updateTime && stringField(before, "_smokeOnly") === marker, "archive-write-ownership-mismatch");
        writes.push({ update: { name: `${database}/documents/${path}`, fields: fields(patch) },
          updateMask: { fieldPaths: Object.keys(patch) }, currentDocument: { updateTime: before.updateTime } });
      }
      // The operator is deliberately NOT used: these writes exercise the real
      // Firestore rules with the temporary trainer's Firebase ID token.
      return request(`${documents}:commit`, { method: "POST", bearer: trainer.idToken, body: { writes }, expected });
    };
    const archiveWrites = backup => emptyPaths.map((path, index) => [path, {
      assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived", assignedProgramArchivedAt: new Date().toISOString(),
      ...(index === 0 ? { assignedProgramArchivedCalendarEntries: backup } : {})
    }]).concat([[`users/${client.uid}`, { workoutCalendar: archiveCalendar }]]);
    const restoreWrites = calendar => emptyPaths.map(path => [path, {
      assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active", assignedProgramArchivedAt: ""
    }]).concat([[`users/${client.uid}`, { workoutCalendar: calendar }]]);
    step = "archive-empty-backup";
    await clientCommit(archiveWrites([]));
    const emptyBackup = (await getDoc(emptyPaths[0])).fields.assignedProgramArchivedCalendarEntries;
    check(emptyBackup?.arrayValue && (emptyBackup.arrayValue.values || []).length === 0, "empty-backup-not-saved");
    await pass("Архивирование старой копии без дат прошло с настоящим токеном тренера");
    step = "restore-and-archive-dates";
    await clientCommit(restoreWrites(datedCalendar));
    check(canonical((await getDoc(`users/${client.uid}`)).fields.workoutCalendar) === canonical(encode(datedCalendar)), "restored-calendar-mismatch");
    await clientCommit(archiveWrites(datedEntries));
    check(canonical((await getDoc(emptyPaths[0])).fields.assignedProgramArchivedCalendarEntries) === canonical(encode(datedEntries)), "dated-backup-not-saved");
    await clientCommit(restoreWrites(datedCalendar));
    await clientCommit(archiveWrites(datedEntries));
    await pass("Архивирование и возврат конкретных дат прошли атомарно; повторная архивация работает");
    const withoutCalendarClock = doc => {
      const result = structuredClone(doc.fields);
      if (result.workoutCalendar?.mapValue?.fields) delete result.workoutCalendar.mapValue.fields.updatedAt;
      return result;
    };
    check(canonical(withoutCalendarClock(await getDoc(`users/${client.uid}`))) === canonical(withoutCalendarClock(originalProfile)), "archive-changed-current-profile");
    check(canonical((await getDoc(`users/${client.uid}/workouts/active_day`)).fields) === canonical(originalCurrent.fields), "archive-changed-current-workout");
    await pass("Архивирование не изменило текущее назначение, его тренировку, календарь и абонемент");
    const stablePaths = [`users/${client.uid}`, ...fixture.workouts.filter(workout => !["empty_a", "empty_b"].includes(workout.id)).map(workout => `users/${client.uid}/workouts/${workout.id}`),
      `users/${client.uid}/history/${fixture.history.id}`, `users/${client.uid}/nutrition/smoke_state`];
    const stableBefore = await Promise.all(stablePaths.map(getDoc));
    step = "client-denied"; await api(client, fixture.keys.empty, 403); await pass("Клиент не может удалить назначение");
    step = "foreign-trainer-denied"; await patchProfile(client, { assignedTrainerId: `not_created_${runId}`, trainerId: `not_created_${runId}` });
    await api(trainer, fixture.keys.empty, 403); await patchProfile(client, { assignedTrainerId: trainer.uid, trainerId: trainer.uid }); await pass("Тренер без назначения к клиенту получает отказ");
    step = "activity-denied";
    for (const key of ["active", "historical", "started", "basic"]) await api(trainer, fixture.keys[key], 409);
    await pass("Текущая, базовая, начатая программа и программа с историей защищены");
    step = "delete-empty-archive"; const deleted = await api(trainer, fixture.keys.empty);
    check(deleted.ok === true && deleted.assignmentKey === fixture.keys.empty && canonical([...deleted.deletedWorkoutIds].sort()) === canonical(["empty_a", "empty_b"]), "delete-result-mismatch");
    check(await getDoc(`users/${client.uid}/workouts/empty_a`) === null && await getDoc(`users/${client.uid}/workouts/empty_b`) === null, "empty-workouts-still-present");
    await api(trainer, fixture.keys.empty, 404); await pass("Удалена только пустая архивная программа; повтор не затрагивает другие назначения");
    step = "preserve-unrelated-data"; const stableAfter = await Promise.all(stablePaths.map(getDoc));
    // updateTime changes while temporarily unassigning the same synthetic trainer; compare document fields only.
    check(canonical(stableBefore.map(doc => doc?.fields)) === canonical(stableAfter.map(doc => doc?.fields)), "unrelated-data-changed");
    await pass("Текущая программа, календарь, абонемент, история и питание сохранены точно");
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safeEmptyProgramSmokeError(error); }
  finally {
    cleaning = true;
    for (const identity of identities) {
      const result = { role: identity.role, ...(identity.uid ? { uidHash: hash(identity.uid) } : {}) };
      const clean = async (name, operation) => { try { result[name] = await operation(); } catch (error) { result[name] = false; (result.errors ||= {})[name] = safeEmptyProgramSmokeError(error); } };
      if (!identity.attempted || !identity.absenceVerified) Object.assign(result, { authAbsent: true, treeAbsent: true, rateAbsent: true, ledgerAbsent: true, notCreated: true });
      else {
        await clean("identityResolved", async () => { const user = await lookup(identity); if (user) { identity.uid ||= user.localId; identity.ownershipVerified = true; } return Boolean(identity.uid) || user === null; });
        if (identity.uid && identity.ownershipVerified) {
          await clean("authAbsent", async () => { if (await lookup(identity)) await request(`${authAdmin}delete`, { method: "POST", bearer: token, body: { localId: identity.uid } }); return await lookup(identity) === null; });
          await clean("treeAbsent", async () => { const root = `users/${identity.uid}`, profile = await getDoc(root);
            if (profile) check(stringField(profile, "createdByUid") === marker && stringField(profile, "email") === identity.email, "cleanup-profile-ownership-mismatch");
            await removeTree(root, root); return await getDoc(root) === null && (await collectionIds(root)).length === 0; });
          await clean("rateAbsent", async () => { const path = `securityRateLimits/${hash(`${identity.uid}:${RATE_SCOPE}`)}`, rate = await getDoc(path);
            if (rate) { check(stringField(rate, "uid") === identity.uid && stringField(rate, "action") === RATE_SCOPE, "rate-ownership-mismatch"); await deleteDoc(rate, path); }
            return await getDoc(path) === null; });
          await clean("ledgerAbsent", async () => { let absentPasses = 0;
            for (let attempt = 0; attempt < 8; attempt++) { await sleep(1500); const docs = await ownLedger(identity);
              for (const doc of docs) await deleteDoc(doc, doc.name.slice(`${database}/documents/`.length));
              absentPasses = docs.length ? 0 : absentPasses + 1; if (absentPasses >= 3) return (await ownLedger(identity)).length === 0;
            } return false; });
        } else Object.assign(result, { authAbsent: !identity.uid && result.identityResolved === true, treeAbsent: false, rateAbsent: false, ledgerAbsent: false });
      }
      result.cleaned = ["authAbsent", "treeAbsent", "rateAbsent", "ledgerAbsent"].every(key => result[key] === true); report.cleanup.push(result);
      try { await persist(); } catch { report.failed = true; report.artifactWriteFailed = true; }
    }
    report.cleanupVerified = report.cleanup.length === 2 && report.cleanup.every(row => row.cleaned); report.failed ||= !report.cleanupVerified;
    intent.cleanupRequired = !report.cleanupVerified; report.finishedAt = new Date().toISOString(); report.requestCount = requests; report.cleanupRequestCount = cleanupRequests;
    token = undefined; apiKey = undefined; identities.forEach(identity => { identity.password = undefined; identity.idToken = undefined; });
    try { await persist(); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const { report, output } = await runEmptyProgramAssignmentSmoke(parseEmptyProgramSmokeArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ project: report.project, version: report.version, cases: report.cases.length, failed: report.failed === true,
      failedStep: report.failedStep || null, cleanupVerified: report.cleanupVerified, output })); if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safeEmptyProgramSmokeError(error))); process.exitCode = 1; }
}
