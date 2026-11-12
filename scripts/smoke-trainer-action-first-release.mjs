// Opt-in release smoke. Run only after review and authorization for three temporary accounts.
// No screenshots, traces, storageState, real-user actions, media, IAM or App Check changes.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = "3.0.955";
const OUTPUT = `artifacts/remediation-${VERSION}`;
const PROJECTS = ["tren-85720-staging", "tren-85720"];
const ROLES = ["client", "trainer", "admin"];
const RATE_SCOPES = ["client-loading-snapshot", "nutrition-storage", "client-exercise-media", "exercise-cards", "profile-update-login", "admin-security-key-status"];
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (value, code) => { if (!value) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const ownKeys = (value, allowed) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
const field = (document, key) => document?.fields?.[key]?.stringValue;
export const safeTrainerActionSmokeError = error => ({ code: typeof error?.smokeCode === "string" && /^[a-z0-9-]{1,100}$/.test(error.smokeCode) ? error.smokeCode : "operation-failed" });
export const isAllowedTrainerSmokeDraftDiscardDialog = (type, message) =>
  type === "confirm" && message === "Закрыть без сохранения ответа?";
const UI_CHECKPOINT_CODES = new Set([
  "ui-auth-open-failed", "ui-auth-method-failed", "ui-auth-form-failed", "ui-auth-fill-failed", "ui-auth-submit-failed",
  "ui-client-shell-failed", "ui-client-workouts-failed", "ui-client-nutrition-failed", "ui-client-progress-failed", "ui-client-cabinet-failed", "ui-client-main-failed",
  "ui-client-food-search-failed", "ui-client-food-search-close-failed", "ui-client-calendar-failed", "ui-client-calendar-close-failed",
  "ui-client-measurements-failed", "ui-client-measurements-close-failed",
  "ui-trainer-shell-failed", "ui-trainer-dashboard-failed", "ui-trainer-clients-failed", "ui-trainer-workouts-failed", "ui-trainer-library-failed", "ui-trainer-more-failed",
  "ui-trainer-own-client-failed", "ui-trainer-own-summary-failed", "ui-trainer-own-workouts-failed", "ui-trainer-own-nutrition-failed", "ui-trainer-own-measurements-failed",
  "ui-trainer-own-editor-failed", "ui-trainer-own-messages-failed", "ui-trainer-own-message-draft-failed", "ui-trainer-own-message-discard-failed", "ui-trainer-own-reminders-failed",
  "ui-admin-shell-failed", "ui-admin-directory-failed", "ui-admin-return-failed"
]);
export function trainerSmokeUiCheckpointError(error, checkpoint) {
  const original = safeTrainerActionSmokeError(error).code;
  const code = original !== "operation-failed" ? original : UI_CHECKPOINT_CODES.has(checkpoint) ? checkpoint : "ui-checkpoint-invalid";
  return Object.assign(new Error(code), { smokeCode: code });
}

export function parseTrainerActionFirstSmokeArgs(args, env = process.env) {
  const result = {}, seen = new Set();
  for (const arg of args) {
    const match = /^--(project|expected-version|cleanup-intent)=(.+)$/.exec(arg);
    const key = match?.[1] || arg;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) result[key] = match[2];
    else if (arg === "--run") result.run = true;
    else if (arg === "--allow-production") result.allowProduction = true;
    else if (arg === "--allow-admin-catalog-read") result.allowAdminCatalogRead = true;
    else fail("unknown-argument");
  }
  check(result.run === true && PROJECTS.includes(result.project), "explicit-run-and-project-required");
  check(result["expected-version"] === VERSION, "exact-version-required");
  check(result.allowAdminCatalogRead === true, "admin-catalog-read-approval-required");
  check(result.project !== "tren-85720" || result.allowProduction === true, "production-approval-required");
  check(!result.allowProduction || result.project === "tren-85720", "production-flag-project-mismatch");
  if (result["cleanup-intent"]) check(new RegExp(`^${OUTPUT.replaceAll(".", "\\.")}/trainer-action-first-${result.project}-[a-f0-9]{24}\\.intent\\.jsonl$`).test(result["cleanup-intent"]), "unsafe-intent-path");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "FIREBASE_APPCHECK_DEBUG_TOKEN", "VITE_APPCHECK_DEBUG_TOKEN"])
    check(!env[key], "explicit-live-project-and-cached-operator-only");
  return result;
}

export function isOwnedTrainerActionSmokePath(uid, path) {
  return typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid) && typeof path === "string" &&
    path.split("/").every(part => /^[A-Za-z0-9_-]+$/.test(part)) && (path === `users/${uid}` || path.startsWith(`users/${uid}/`));
}
export function createTrainerActionSmokePlan(runId) {
  check(/^[a-f0-9]{24}$/.test(runId), "invalid-run-id");
  return { marker: `action-first:${runId}`, identities: ROLES.map(role => ({ role, uid: `actionfirst_${runId}_${role}`,
    email: `action-first-${runId}-${role}@example.invalid`, displayName: `Synthetic action-first ${role} ${runId}` })) };
}
export function validateTrainerActionSmokeIntent(intent, options) {
  check(ownKeys(intent, ["schemaVersion", "project", "version", "runId", "marker", "cleanupRequired", "identities"]) && intent.schemaVersion === 1 &&
    intent.project === options.project && intent.version === VERSION && typeof intent.cleanupRequired === "boolean", "invalid-cleanup-intent");
  const plan = createTrainerActionSmokePlan(intent.runId);
  check(intent.marker === plan.marker && Array.isArray(intent.identities) && intent.identities.length === 3, "invalid-cleanup-intent");
  for (let index = 0; index < 3; index++) {
    const identity = intent.identities[index], expected = plan.identities[index];
    check(ownKeys(identity, ["role", "uid", "email", "displayName", "absenceVerified", "attempted", "ownershipVerified"]) &&
      Object.entries(expected).every(([key, value]) => identity[key] === value) &&
      ["absenceVerified", "attempted", "ownershipVerified"].every(key => typeof identity[key] === "boolean") &&
      (!identity.attempted || identity.absenceVerified), "invalid-cleanup-identity");
  }
  if (options["cleanup-intent"]) check(options["cleanup-intent"] === `${OUTPUT}/trainer-action-first-${intent.project}-${intent.runId}.intent.jsonl`, "intent-file-run-mismatch");
  return intent;
}
export function isAllowedTrainerSmokeApi(path, body, ownClientUid) {
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof ownClientUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(ownClientUid)) return false;
  if (path === "/api/client-loading-snapshot") return ownKeys(body, ["kind", "clientId"]) && ["workouts", "measurements"].includes(body.kind) && (!Object.hasOwn(body, "clientId") || body.clientId === ownClientUid);
  if (path === "/api/nutrition/storage") return ownKeys(body, ["action", "uid", "mode", "dayKeys", "cursor"]) && body.action === "read" && (!Object.hasOwn(body, "uid") || body.uid === ownClientUid) &&
    (!Object.hasOwn(body, "mode") || ["full", "days"].includes(body.mode)) && (!Object.hasOwn(body, "dayKeys") || (Array.isArray(body.dayKeys) && body.dayKeys.length <= 31 && body.dayKeys.every(key => /^\d{4}-\d{2}-\d{2}$/.test(key)))) &&
    (!Object.hasOwn(body, "cursor") || (typeof body.cursor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.cursor)));
  if (path === "/api/client-exercise-media") return ownKeys(body, ["clientId"]) && body.clientId === ownClientUid;
  if (path === "/api/trainer-exercise-cards") return ownKeys(body, ["action"]) && body.action === "list";
  return path === "/api/admin/security-key" && ownKeys(body, ["action"]) && body.action === "status";
}
export function isAllowedTrainerSmokePreparation(path, body, identity) {
  return identity?.role === "client" && typeof identity.uid === "string" && /^actionfirst_[a-f0-9]{24}_client$/.test(identity.uid) &&
    path === "/api/nutrition/storage" && ownKeys(body, ["action", "uid"]) && body.action === "prepare" && body.uid === identity.uid;
}
export function isAllowedTrainerSmokeFirestoreEndpoint(method, input, project) {
  if (!PROJECTS.includes(project) || !["GET", "POST"].includes(method)) return false;
  try {
    const url = new URL(input), database = `projects/${project}/databases/(default)`;
    if (url.protocol !== "https:" || url.hostname !== "firestore.googleapis.com" || url.username || url.password || url.port) return false;
    const path = decodeURIComponent(url.pathname);
    if (/^\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel$/.test(path)) return url.searchParams.getAll("database").length === 1 && url.searchParams.get("database") === database;
    return method === "POST" && ["batchGet", "runQuery"].some(rpc => path === `/v1/${database}/documents:${rpc}`);
  } catch { return false; }
}
export function isOwnedTrainerSmokeWrite(write, identity, client, project) {
  const match = /^actionfirst_([a-f0-9]{24})_(client|trainer|admin)$/.exec(identity?.uid || "");
  if (!PROJECTS.includes(project) || !match || identity.role !== match[2] || client?.uid !== `actionfirst_${match[1]}_client`) return false;
  if (!ownKeys(write, ["update", "updateMask", "currentDocument"]) || !write.update?.fields || !Array.isArray(write.updateMask?.fieldPaths) || !write.updateMask.fieldPaths.length) return false;
  const prefix = `projects/${project}/databases/(default)/documents/users/`;
  if (write.update.name === `${prefix}${identity.uid}`) return write.updateMask.fieldPaths.every(key => ["updatedAt", "name"].includes(key)) &&
    Object.keys(write.update.fields).every(key => ["updatedAt", "name"].includes(key));
  // Opening this synthetic client's card performs this existing automatic mirror write.
  const mirrorFields = ["clientId", "uid", "id", "email", "name", "role", "trainerId", "assignedTrainerId", "coachId", "trainerEmail", "assignedTrainerEmail", "coachEmail", "createdBy", "createdByEmail", "createdByUid",
    "profile", "aiNutritionProfile", "aiNutritionPlan", "nutritionPlan", "nutritionGoals", "nutritionState", "assignedProgramId", "assignedProgramName", "assignedProgramUpdatedAt", "assignedWorkoutCount", "workoutCalendar",
    "trainingDays", "workoutTime", "trainerNote", "telegram", "telegramConnected", "telegramUsername", "telegramDisplayName", "telegramNotificationsEnabled", "updatedAt"];
  return identity.role === "trainer" && write.update.name === `${prefix}${identity.uid}/trainerClients/${client.uid}` &&
    Object.keys(write.update.fields).every(key => mirrorFields.includes(key)) && write.updateMask.fieldPaths.every(key => mirrorFields.includes(key.split(".")[0])) &&
    ["clientId", "uid", "id"].every(key => field(write.update, key) === client.uid) &&
    ["trainerId", "assignedTrainerId", "coachId"].every(key => field(write.update, key) === identity.uid) &&
    field(write.update, "email") === client.email && field(write.update, "name") === client.displayName && field(write.update, "role") === "client" &&
    field(write.update, "createdByUid") === `action-first:${identity.uid.split("_")[1]}`;
}

const encode = value => value === null ? { nullValue: null } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : typeof value === "object" ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
    : typeof value === "number" ? { integerValue: String(value) } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
async function boundedBody(response, json = true, maximum = 2 * 1024 * 1024) {
  const reader = response.body?.getReader(); check(reader, "missing-response-body"); let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
    if (size > maximum) { await reader.cancel(); fail("response-budget-exceeded"); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!json) return text;
  try { return JSON.parse(text); } catch { fail("invalid-json-response"); }
}
async function operatorToken(project) {
  const require = createRequire(import.meta.url);
  const candidates = [ROOT, ...(basename(dirname(ROOT)) === ".tmp" ? [resolve(ROOT, "../..")] : [])];
  for (const root of candidates) {
    try {
      const cli = resolve(root, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
      require(resolve(cli, "logger.js")).logger.silent = true;
      const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount(); check(account, "cached-operator-unavailable");
      await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
      const token = await require(resolve(cli, "apiv2.js")).getAccessToken(); check(typeof token === "string" && token, "cached-operator-unavailable"); return token;
    } catch { /* Only fixed local cache locations, never ambient credentials or IAM changes. */ }
  }
  fail("cached-operator-unavailable");
}
async function loadIntent(options) {
  const path = resolve(ROOT, options["cleanup-intent"]); check(await realpath(path) === path, "symlink-intent-forbidden");
  const text = await readFile(path, "utf8"); check(Buffer.byteLength(text) <= 2 * 1024 * 1024, "intent-budget-exceeded");
  const complete = text.slice(0, text.lastIndexOf("\n")).split("\n").filter(Boolean); check(complete.length > 0, "empty-intent");
  let intent; try { intent = JSON.parse(complete.at(-1)); } catch { fail("invalid-cleanup-intent"); }
  return validateTrainerActionSmokeIntent(intent, options);
}
async function createArtifacts(options, runId) {
  const root = await realpath(ROOT), parent = resolve(root, "artifacts"), directory = resolve(root, OUTPUT);
  await mkdir(parent, { recursive: true }); check(await realpath(parent) === parent, "symlink-output-forbidden");
  await mkdir(directory, { recursive: true }); check(await realpath(directory) === directory, "symlink-output-forbidden");
  const prefix = `trainer-action-first-${options.project}-${runId}`;
  const reportPath = `${OUTPUT}/${prefix}${options["cleanup-intent"] ? `-cleanup-${randomBytes(4).toString("hex")}` : ""}.json`;
  const reportFile = await open(resolve(root, reportPath), "wx"); let intentFile;
  try { intentFile = await open(resolve(directory, `${prefix}.intent.jsonl`), options["cleanup-intent"] ? "a" : "wx"); }
  catch (error) { await reportFile.close(); throw error; }
  return { output: reportPath, save: async (report, intent) => {
    // An append-only fsynced record remains recoverable after an interrupted later write.
    const record = JSON.stringify(intent) + "\n", appended = await intentFile.write(record);
    check(appended.bytesWritten === Buffer.byteLength(record), "intent-write-incomplete"); await intentFile.sync();
    const text = JSON.stringify(report, null, 2) + "\n", written = await reportFile.write(text, 0, "utf8");
    check(written.bytesWritten === Buffer.byteLength(text), "report-write-incomplete"); await reportFile.truncate(Buffer.byteLength(text)); await reportFile.sync();
  }, close: async () => { try { await reportFile.close(); } finally { await intentFile.close(); } } };
}

// Dependency injection is test-only; the CLI exposes no identity, credential or transport override.
export async function runTrainerActionFirstSmoke(options, dependencies = {}) {
  check(process.versions.node.split(".")[0] === "22", "node22-required");
  options = parseTrainerActionFirstSmokeArgs(Object.entries(options).flatMap(([key, value]) => value === true
    ? [key === "allowProduction" ? "--allow-production" : key === "allowAdminCatalogRead" ? "--allow-admin-catalog-read" : `--${key}`]
    : value === false || value === undefined ? [] : [`--${key}=${value}`]));
  if (!options["cleanup-intent"]) check(JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version === VERSION, "local-version-mismatch");
  const recovered = options["cleanup-intent"] ? await loadIntent(options) : null;
  const runId = recovered?.runId || randomBytes(12).toString("hex"), plan = createTrainerActionSmokePlan(runId);
  const identities = (recovered?.identities || plan.identities.map(identity => ({ ...identity, absenceVerified: false, attempted: false, ownershipVerified: false })))
    .map(identity => ({ ...identity, password: recovered ? undefined : randomBytes(30).toString("base64url") }));
  const [client, trainer, administrator] = identities, project = options.project;
  const base = `https://${project}.web.app`, database = `projects/${project}/databases/(default)`;
  const documents = `https://firestore.googleapis.com/v1/${database}/documents`, authRoot = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts`;
  const artifact = await (dependencies.createArtifacts || createArtifacts)(options, runId);
  const intent = { schemaVersion: 1, project, version: VERSION, runId, marker: plan.marker, cleanupRequired: true, identities: [] };
  const report = { schemaVersion: 1, project, version: VERSION, runId, startedAt: new Date().toISOString(), cases: [], cleanup: [],
    adminCatalogReadAuthorized: true, persistsRealUserData: false, limits: [
      "Админский каталог и сводки читаются только штатным UI в памяти; пользовательские карточки, переписка и реальные фото не открываются.",
      "Навигация, поиск еды/календарь/пустые замеры, редактор собственной программы и напоминания открываются без сохранения. Черновик сообщения собственному клиенту только вводится и отменяется; отправки, старта тренировки и медиа нет.",
      "Штатный вход обновляет только собственные name/updatedAt; открытие собственной карточки может записать только synthetic trainerClients mirror. Эти документы очищаются.",
      "Штатное чтение питания может подготовить только собственный синтетический дневник; commits/clear и подготовка чужих дневников запрещены.",
      "Нет скриншотов, traces, storageState, IAM/App Check обходов и изменений политики ключей администратора.",
      "Новый временный admin проверяет штатную незарегистрированную политику ключей, не существующий физический ключ.",
      "Администратор открывает только обзор и каталог пользователей. Общая библиотека и обращения не открываются: они могут загружать реальные материалы и тексты вне согласованной области.",
      "Реальный Telegram WebView, доставка Telegram и USB/NFC-ключ этим браузерным smoke не проверяются.",
      "Платформенные audit logs и агрегированные метрики Firebase не удаляются; локальный intent хранит только синтетические идентификаторы для восстановления очистки.",
      "Очистка проверяет только собственные Auth UID, users subtrees и точные rate keys; поздние внешние события не исключены." ] };
  let token, apiKey, browser, step = recovered ? "cleanup-only" : "initialize", cleaning = false, requests = 0, cleanupRequests = 0, domainRequests = 0, cleanupRecords = 0;
  const deadline = Date.now() + 10 * 60 * 1000;
  const persist = async () => { intent.identities = identities.map(({ role, uid, email, displayName, absenceVerified, attempted, ownershipVerified }) => ({ role, uid, email, displayName, absenceVerified, attempted, ownershipVerified })); await artifact.save(report, intent); };
  const request = async (url, { method = "GET", body, bearer = token, json = true, missing = false } = {}) => {
    const parsed = new URL(url);
    check(parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port &&
      (parsed.origin === base || (parsed.hostname === "firestore.googleapis.com" && parsed.pathname.startsWith(`/v1/${database}/documents`)) ||
        (parsed.hostname === "identitytoolkit.googleapis.com" && (parsed.pathname.startsWith(`/v1/projects/${project}/accounts`) || parsed.pathname === "/v1/accounts:signInWithPassword"))), "unsafe-request-origin");
    if (cleaning) { cleanupRequests++; check(++domainRequests <= 3000, "cleanup-request-budget-exceeded"); }
    else check(++requests <= 150 && Date.now() <= deadline, "main-request-budget-exceeded");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (missing && response.status === 404) { await response.body?.cancel(); return null; }
    if (response.status !== 200) { await response.body?.cancel(); fail(`unexpected-http-${response.status}`); }
    if (method === "DELETE") { await response.body?.cancel(); return null; }
    return boundedBody(response, json);
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = path => request(docUrl(path), { missing: true });
  const lookup = async identity => {
    const byEmail = await request(`${authRoot}:lookup`, { method: "POST", body: { email: [identity.email] } });
    const byUid = await request(`${authRoot}:lookup`, { method: "POST", body: { localId: [identity.uid] } });
    const emailRows = byEmail.users || [], uidRows = byUid.users || [];
    check(Array.isArray(emailRows) && Array.isArray(uidRows) && emailRows.length <= 1 && uidRows.length <= 1, "ambiguous-owned-identity");
    if (!emailRows.length && !uidRows.length) return null;
    check(emailRows.length === 1 && uidRows.length === 1 && [...emailRows, ...uidRows].every(user => user.localId === identity.uid && user.email === identity.email && user.displayName === identity.displayName), "identity-ownership-mismatch");
    return uidRows[0];
  };
  const createDoc = (identity, path, value) => { check(isOwnedTrainerActionSmokePath(identity.uid, path), "non-owned-document-path");
    return request(`${docUrl(path)}?currentDocument.exists=false`, { method: "PATCH", body: { fields: fields(value) } }); };
  const deleteDoc = async (document, path) => { check(document?.name === `${database}/documents/${path}` && document.updateTime, "unsafe-document-delete");
    await request(`${docUrl(path)}?currentDocument.updateTime=${encodeURIComponent(document.updateTime)}`, { method: "DELETE" }); };
  const collectionIds = async path => {
    const result = []; let pageToken;
    do { const data = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", body: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } });
      check(Array.isArray(data.collectionIds || []), "invalid-collection-list"); result.push(...(data.collectionIds || [])); check(result.length <= 100, "collection-budget-exceeded"); pageToken = data.nextPageToken;
    } while (pageToken); return result;
  };
  const removeTree = async (path, uid, depth = 0) => {
    check(isOwnedTrainerActionSmokePath(uid, path) && depth <= 8 && ++cleanupRecords <= 500, "owned-tree-cleanup-budget");
    for (const collection of await collectionIds(path)) {
      check(/^[A-Za-z0-9_-]+$/.test(collection), "unsafe-collection-id"); let pageToken;
      do { const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true"); url.searchParams.set("mask.fieldPaths", "_smokeOnly"); if (pageToken) url.searchParams.set("pageToken", pageToken);
        const data = await request(url); check(Array.isArray(data.documents || []), "invalid-child-list");
        for (const child of data.documents || []) { const prefix = `${database}/documents/${path}/${collection}/`;
          check(child.name?.startsWith(prefix) && !child.name.slice(prefix.length).includes("/"), "unsafe-child-document"); await removeTree(child.name.slice(`${database}/documents/`.length), uid, depth + 1); }
        pageToken = data.nextPageToken;
      } while (pageToken);
    }
    const document = await getDoc(path); if (document) await deleteDoc(document, path);
  };
  const pass = async label => { report.cases.push(label); await persist(); };
  try {
    await persist(); token = await (dependencies.operatorToken || operatorToken)(project);
    if (!recovered) {
      step = "hosting-version";
      const config = await request(`${base}/__/firebase/init.json`, { bearer: null });
      check(config.projectId === project && config.storageBucket === `${project}.firebasestorage.app` && typeof config.apiKey === "string", "hosting-project-mismatch"); apiKey = config.apiKey;
      const worker = await request(`${base}/sw.js?action-first=${runId}`, { bearer: null, json: false });
      check(worker.includes(`const CACHE_NAME = "workout-app-v${VERSION}";`), "published-version-mismatch"); await pass("Точный проект и версия Hosting подтверждены");
      step = "create-owned-identities";
      for (const identity of identities) {
        check(await lookup(identity) === null, "random-identity-already-exists");
        identity.absenceVerified = true; identity.attempted = true; await persist();
        // This is the create-only endpoint used by Admin SDK createUser, not import/update.
        const created = await request(authRoot, { method: "POST", body: { localId: identity.uid, email: identity.email, password: identity.password, displayName: identity.displayName, emailVerified: true } });
        check(created.localId === identity.uid && Boolean(await lookup(identity)), "created-identity-not-found"); identity.ownershipVerified = true; await persist();
        const now = new Date().toISOString();
        await createDoc(identity, `users/${identity.uid}`, { role: identity.role, active: true, name: identity.displayName, email: identity.email,
          createdByUid: plan.marker, createdAt: now, isTest: true, firstSetupCompleted: true,
          aiNutritionProfile: { weight: "72", height: "174", age: "30", sex: "male", activity: "medium", goal: "recomp" },
          ...(identity.role === "client" ? { accountAccessStatus: "active", trainerAssignmentState: "assigned", trainerId: trainer.uid, assignedTrainerId: trainer.uid,
            assignedProgramId: `smoke_${runId}`, assignedProgramAddedAt: now, assignedProgramUpdatedAt: now, assignedProgramName: "Synthetic action-first program",
            workoutModePreference: { mode: "individual", remember: true, updatedAt: now },
            trainerSetupChecklist: { version: 2, status: "completed", currentStep: null, completedSteps: { program: true, schedule: true, nutrition: true, notifications: true } } } : {}),
          ...(identity.role === "admin" ? { adminClaimVersion: runId } : {}) });
      }
      step = "matching-admin-claim";
      check(Boolean(await lookup(administrator)), "admin-ownership-unverified");
      await request(`${authRoot}:update`, { method: "POST", body: { localId: administrator.uid, customAttributes: JSON.stringify({ admin: true, adminClaimVersion: runId }) } });
      const adminSession = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, { method: "POST", bearer: null,
        body: { email: administrator.email, password: administrator.password, returnSecureToken: true } });
      const claims = JSON.parse(Buffer.from(adminSession.idToken.split(".")[1], "base64url").toString("utf8"));
      check(claims.aud === project && claims.sub === administrator.uid && claims.admin === true && claims.adminClaimVersion === runId, "admin-claim-invalid");
      await pass("Временный admin имеет matching server claim");
      step = "create-owned-workout";
      const profile = await getDoc(`users/${client.uid}`), assignedAt = field(profile, "assignedProgramAddedAt");
      await createDoc(client, `users/${client.uid}/workouts/smoke_day`, { name: "Synthetic action-first workout", source: "trainer", order: 0, status: "planned", assignedBy: trainer.uid,
        assignedProgramId: `smoke_${runId}`, assignedProgramName: "Synthetic action-first program", assignedProgramAddedAt: assignedAt, assignedProgramUpdatedAt: assignedAt,
        assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active", assignedProgramAssignedByUid: trainer.uid,
        exercises: [{ id: "smoke_exercise", name: "Synthetic action-first exercise", sets: 2, reps: "10", weight: "0", rest: 30 }], _smokeOnly: plan.marker });
      const before = (await getDoc(`users/${client.uid}/workouts/smoke_day`)).fields;
      const { chromium } = dependencies.chromium ? { chromium: dependencies.chromium } : await import("playwright");
      browser = await chromium.launch({ headless: true });
      for (const identity of identities) {
        step = `${identity.role}-navigation`;
        await runOwnedUi({ browser, identity, client, project, base, deadline, pass });
      }
      await browser.close(); browser = null;
      check(JSON.stringify((await getDoc(`users/${client.uid}/workouts/smoke_day`)).fields) === JSON.stringify(before), "workout-mutated-during-navigation");
      const history = await request(`${docUrl(`users/${client.uid}/history`)}?pageSize=1&mask.fieldPaths=_smokeOnly`);
      check(!(history.documents || []).length, "workout-history-created"); await pass("Синтетическая тренировка не изменилась, история не создана");
    }
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safeTrainerActionSmokeError(error); }
  finally {
    cleaning = true; try { await browser?.close(); } catch { report.failed = true; report.browserCloseFailed = true; }
    for (const identity of identities) {
      const result = { role: identity.role };
      const clean = async (key, operation) => { domainRequests = 0; try { result[key] = await operation(); } catch (error) { result[key] = false; (result.errors ||= {})[key] = safeTrainerActionSmokeError(error); } };
      if (!identity.attempted || !identity.absenceVerified) Object.assign(result, { authAbsent: true, treeAbsent: true, ratesAbsent: true, notCreated: true });
      else {
        await clean("identityResolved", async () => { const user = await lookup(identity); if (user) identity.ownershipVerified = true; return user === null || identity.ownershipVerified; });
        if (result.identityResolved) {
          await clean("authAbsent", async () => { if (await lookup(identity)) await request(`${authRoot}:delete`, { method: "POST", body: { localId: identity.uid } }); return await lookup(identity) === null; });
          await clean("treeAbsent", async () => { const root = `users/${identity.uid}`, profile = await getDoc(root);
            if (profile) check(field(profile, "createdByUid") === plan.marker && field(profile, "email") === identity.email, "cleanup-profile-ownership-mismatch");
            await removeTree(root, identity.uid); return await getDoc(root) === null && (await collectionIds(root)).length === 0; });
          await clean("ratesAbsent", async () => { for (const scope of RATE_SCOPES) { const path = `securityRateLimits/${hash(`${identity.uid}:${scope}`)}`, rate = await getDoc(path);
            if (rate) { check(field(rate, "uid") === identity.uid && field(rate, "action") === scope, "rate-ownership-mismatch"); await deleteDoc(rate, path); }
            check(await getDoc(path) === null, "rate-still-present"); } return true; });
        }
      }
      result.cleaned = result.authAbsent === true && result.treeAbsent === true && result.ratesAbsent === true; report.cleanup.push(result);
      try { await persist(); } catch { report.failed = true; report.artifactWriteFailed = true; }
    }
    report.cleanupVerified = report.cleanup.length === 3 && report.cleanup.every(result => result.cleaned);
    report.failed ||= !report.cleanupVerified; intent.cleanupRequired = !report.cleanupVerified;
    report.finishedAt = new Date().toISOString(); report.requestCount = requests; report.cleanupRequestCount = cleanupRequests;
    token = undefined; apiKey = undefined; identities.forEach(identity => { identity.password = undefined; });
    try { await persist(); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

async function runOwnedUi({ browser, identity, client, project, base, deadline, pass }) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: "block" });
  context.setDefaultTimeout(40000); context.setDefaultNavigationTimeout(45000);
  let runtimeErrors = 0, violation = false, requestCount = 0, checkpoint = "ui-auth-open-failed";
  const owned = createTrainerActionSmokePlan(identity.uid.split("_")[1]).identities.map(item => item.uid);
  try {
    await context.route("**/*", async route => {
      try {
        const request = route.request(), url = new URL(request.url());
        if (["image", "media"].includes(request.resourceType()) || url.hostname === "telegram.org") return await route.abort();
        check(++requestCount <= 2000 && Date.now() < deadline, "ui-request-budget-exceeded");
        const allowed = [new URL(base).hostname, "firestore.googleapis.com", "identitytoolkit.googleapis.com", "securetoken.googleapis.com", "firebaseinstallations.googleapis.com", "firebaseappcheck.googleapis.com", "www.google.com", "www.gstatic.com", "recaptcha.google.com", "fonts.googleapis.com", "fonts.gstatic.com"];
        check(url.protocol === "https:" && allowed.includes(url.hostname), "ui-origin-forbidden");
        if (url.origin === base && url.pathname.startsWith("/api/")) {
          check(request.method() === "POST", "ui-api-method-forbidden");
          let body; try { body = JSON.parse(request.postData() || "{}"); } catch { fail("ui-api-body-invalid"); }
          const summaryRead = identity.role === "admin" && url.pathname === "/api/nutrition/storage" &&
            typeof body.uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(body.uid) && isAllowedTrainerSmokeApi(url.pathname, body, body.uid);
          const ownPreparation = isAllowedTrainerSmokePreparation(url.pathname, body, identity);
          check(isAllowedTrainerSmokeApi(url.pathname, body, client.uid) || summaryRead || ownPreparation, "ui-api-outside-read-scope");
        }
        if (url.hostname === "identitytoolkit.googleapis.com") {
          check(["/v1/accounts:signInWithPassword", "/v1/accounts:lookup"].includes(url.pathname), "ui-auth-mutation-forbidden");
          if (url.pathname.endsWith(":signInWithPassword")) check(JSON.parse(request.postData() || "{}").email === identity.email, "ui-foreign-auth-forbidden");
        }
        if (url.hostname === "firestore.googleapis.com") {
          check(isAllowedTrainerSmokeFirestoreEndpoint(request.method(), url.href, project), "ui-firestore-endpoint-forbidden");
          const raw = request.postData() || "", payloads = [];
          if (raw) { try { payloads.push(JSON.parse(raw)); } catch { for (const [key, value] of new URLSearchParams(raw)) if (/^req\d+___data__$/.test(key)) payloads.push(JSON.parse(value)); } }
          const references = [], collections = [];
          const walk = value => {
            if (!value || typeof value !== "object") return;
            if (typeof value.collectionId === "string") collections.push(value.collectionId);
            if (Array.isArray(value.writes)) for (const write of value.writes) {
              check(isOwnedTrainerSmokeWrite(write, identity, client, project), "ui-write-outside-owned-login-or-mirror");
            }
            for (const item of Object.values(value)) {
              if (typeof item === "string" && item.includes("/documents/users/")) references.push(item.split("/documents/users/")[1].split("/"));
              else if (item && typeof item === "object") walk(item);
            }
          };
          payloads.forEach(walk);
          const foreign = references.filter(parts => !owned.includes(parts[0]));
          const summaryCollections = ["history", "nutrition", "nutritionGenerations", "measurements", "payments", "workouts", "trainerTasks"];
          check(!foreign.length || (identity.role === "admin" && foreign.every(parts => parts.length === 1 || summaryCollections.includes(parts[1]))), "ui-non-owned-user-subtree");
          check(!collections.some(name => /^(telegramMessages|messages|progressPhotos|clientProgressPhotos|photos|feedback)$/i.test(name)) ||
            (references.length > 0 && !foreign.length), "ui-private-messages-or-photos-forbidden");
          if (/\/Write\/|:commit$/.test(url.pathname) && request.method() === "POST") check(payloads.length > 0, "unverifiable-ui-write");
        }
        await route.continue();
      } catch { violation = true; await route.abort().catch(() => {}); }
    });
    const page = await context.newPage(); page.on("pageerror", () => { runtimeErrors++; });
    const checkUi = async label => { check(runtimeErrors === 0 && !violation, "ui-runtime-or-scope-error"); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile-overflow"); await pass(label); };
    await page.goto(`${base}/?action-first-smoke=1`, { waitUntil: "domcontentloaded" });
    checkpoint = "ui-auth-method-failed";
    const method = page.getByRole("button", { name: "Email или логин", exact: true });
    const form = page.locator("form").filter({ has: page.getByLabel("Email или логин", { exact: true }) });
    // DOMContentLoaded precedes React's auth screen: do not branch on an immediate isVisible().
    await method.or(form).first().waitFor({ state: "visible" });
    if (await method.isVisible()) await method.click();
    checkpoint = "ui-auth-form-failed";
    await form.waitFor({ state: "visible" });
    checkpoint = "ui-auth-fill-failed";
    await form.getByLabel("Email или логин", { exact: true }).fill(identity.email); await form.getByLabel("Пароль", { exact: true }).fill(identity.password);
    checkpoint = "ui-auth-submit-failed";
    await form.getByRole("button", { name: "Войти", exact: true }).click();
    if (identity.role === "client") {
      checkpoint = "ui-client-shell-failed";
      await page.getByTestId("client-nav-workouts").waitFor({ state: "visible" });
      const tabCheckpoints = { workouts: "ui-client-workouts-failed", nutrition: "ui-client-nutrition-failed", progress: "ui-client-progress-failed", cabinet: "ui-client-cabinet-failed", main: "ui-client-main-failed" };
      for (const tab of ["workouts", "nutrition", "progress", "cabinet", "main"]) {
        checkpoint = tabCheckpoints[tab];
        const button = page.getByTestId(`client-nav-${tab}`); await button.waitFor({ state: "visible" }); await button.click();
        await button.and(page.locator('[aria-current="page"]')).waitFor({ state: "visible" });
        if (tab === "workouts") await page.getByText("Synthetic action-first workout", { exact: true }).first().waitFor({ state: "visible" });
        await checkUi(`Клиент: вкладка ${tab}`);
        if (tab === "nutrition") {
          checkpoint = "ui-client-food-search-failed";
          await page.getByTestId("nutrition-orbit-add").click();
          const search = page.getByTestId("food-search-screen");
          await search.waitFor({ state: "visible" });
          await page.getByTestId("food-search-input").locator("input").waitFor({ state: "visible" });
          await checkUi("Клиент: поиск еды открыт без выбора или добавления продукта");
          checkpoint = "ui-client-food-search-close-failed";
          await page.locator('[data-food-search-header-action="close"]').click();
          await search.waitFor({ state: "hidden" });
          checkpoint = "ui-client-calendar-failed";
          await page.getByRole("button", { name: "Календарь питания", exact: true }).click();
          const calendar = page.getByTestId("nutrition-calendar-modal");
          await calendar.waitFor({ state: "visible" });
          check(await calendar.locator("[data-nutrition-calendar-day]").count() === 42, "nutrition-month-grid-incomplete");
          await checkUi("Клиент: календарь питания содержит полную сетку месяца");
          checkpoint = "ui-client-calendar-close-failed";
          await page.getByTestId("nutrition-calendar-close").click();
          await calendar.waitFor({ state: "hidden" });
        }
        if (tab === "progress") {
          checkpoint = "ui-client-measurements-failed";
          await page.getByTestId("profile-measurement-start").click();
          const measurements = page.getByTestId("profile-measurements-dialog");
          await measurements.waitFor({ state: "visible" });
          await page.getByTestId("profile-measurements-empty").waitFor({ state: "visible" });
          await checkUi("Клиент: пустые замеры собственного тестового профиля открыты без записи");
          checkpoint = "ui-client-measurements-close-failed";
          await page.getByTestId("profile-measurements-close").click();
          await measurements.waitFor({ state: "hidden" });
        }
      }
    } else if (identity.role === "trainer") {
      checkpoint = "ui-trainer-shell-failed";
      await page.getByTestId("trainer-priority-panel").waitFor({ state: "visible" });
      const tabCheckpoints = { dashboard: "ui-trainer-dashboard-failed", clients: "ui-trainer-clients-failed", workouts: "ui-trainer-workouts-failed", library: "ui-trainer-library-failed", more: "ui-trainer-more-failed" };
      for (const tab of ["dashboard", "clients", "workouts", "library", "more"]) {
        checkpoint = tabCheckpoints[tab];
        const button = page.locator(`[data-testid="trainer-nav-${tab}"]:visible,[data-testid="trainer-desktop-nav-${tab}"]:visible`);
        await button.click(); await button.and(page.locator('[aria-current="page"]')).waitFor({ state: "visible" }); await checkUi(`Тренер: вкладка ${tab}`);
      }
      checkpoint = "ui-trainer-own-client-failed";
      await page.locator('[data-testid="trainer-nav-clients"]:visible,[data-testid="trainer-desktop-nav-clients"]:visible').click();
      await page.locator(".trainerClientFilterDisclosure > summary").click();
      await page.getByRole("group", { name: "Дополнительные фильтры клиентов", exact: true }).getByRole("button", { name: "Тестовые", exact: true }).click();
      await page.locator(".trainerNextClientTable > button").filter({ hasText: client.displayName }).click();
      const tabs = page.getByRole("navigation", { name: "Разделы клиента", exact: true });
      const ownTabCheckpoints = { "Сводка": "ui-trainer-own-summary-failed", "Тренировки": "ui-trainer-own-workouts-failed", "Питание": "ui-trainer-own-nutrition-failed", "Фото и замеры": "ui-trainer-own-measurements-failed" };
      for (const tab of ["Сводка", "Тренировки", "Питание", "Фото и замеры"]) {
        checkpoint = ownTabCheckpoints[tab];
        const button = tabs.getByRole("button", { name: tab, exact: true }); await button.click();
        await button.and(page.locator('[aria-current="page"]')).waitFor({ state: "visible" }); await checkUi(`Тренер: собственный клиент, ${tab}`);
      }
      checkpoint = "ui-trainer-own-editor-failed";
      await tabs.getByRole("button", { name: "Тренировки", exact: true }).click();
      await page.locator(".trainerClientProgramCurrentEditButton").click();
      const editor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true }); await editor.waitFor({ state: "visible" });
      await editor.getByRole("button", { name: "Закрыть редактор", exact: true }).click(); await editor.waitFor({ state: "hidden" });
      await checkUi("Тренер: редактор собственной программы открыт и закрыт без изменений");
      checkpoint = "ui-trainer-own-messages-failed";
      await tabs.getByRole("button", { name: "Сводка", exact: true }).click();
      await page.getByRole("button", { name: /^Сообщения Переписка с клиентом$/ }).click();
      const messages = page.getByRole("dialog", { name: "Сообщения", exact: true });
      await messages.waitFor({ state: "visible" });
      await messages.getByRole("button", { name: "Написать клиенту", exact: true }).click();
      await messages.waitFor({ state: "hidden" });
      checkpoint = "ui-trainer-own-message-draft-failed";
      const compose = page.locator('[role="dialog"][aria-labelledby="trainer-feedback-reply-title"]');
      await compose.getByRole("heading", { name: client.displayName, exact: true }).waitFor({ state: "visible" });
      await compose.getByRole("textbox").fill("Synthetic release smoke draft — do not send.");
      check(await compose.getByRole("button", { name: "Отправить в приложение", exact: true }).isEnabled(), "own-message-draft-not-editable");
      let discarded = false;
      const confirmDiscard = async dialog => {
        if (isAllowedTrainerSmokeDraftDiscardDialog(dialog.type(), dialog.message())) {
          discarded = true;
          await dialog.accept();
        } else {
          violation = true;
          await dialog.dismiss();
        }
      };
      page.once("dialog", confirmDiscard);
      try {
        checkpoint = "ui-trainer-own-message-discard-failed";
        await compose.getByRole("button", { name: "Закрыть", exact: true }).click();
        check(discarded, "owned-draft-discard-confirmation-missing");
        await compose.waitFor({ state: "hidden" });
      } finally { page.off("dialog", confirmDiscard); }
      await checkUi("Тренер: локальный черновик сообщения собственному клиенту отменён без отправки");
      checkpoint = "ui-trainer-own-reminders-failed";
      await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
      const actions = page.getByRole("dialog", { name: "Управление клиентом", exact: true });
      await actions.getByRole("button", { name: /^Напоминания/ }).click();
      await actions.waitFor({ state: "hidden" });
      const reminders = page.getByRole("dialog", { name: "Уведомления", exact: true });
      await reminders.waitFor({ state: "visible" });
      check(await reminders.getByRole("checkbox").count() >= 3, "own-reminder-controls-missing");
      check(await reminders.getByTestId("trainer-notification-save-status").getAttribute("data-save-state") === "idle", "own-reminder-settings-changed");
      check(await reminders.getByRole("button", { name: "Отправить тестовое уведомление", exact: true }).isDisabled(), "synthetic-telegram-unexpectedly-connected");
      await checkUi("Тренер: настройки напоминаний собственного клиента доступны без изменения и тестовой отправки");
      await reminders.getByRole("button", { name: "Закрыть: Уведомления", exact: true }).click();
      await reminders.waitFor({ state: "hidden" });
    } else {
      checkpoint = "ui-admin-shell-failed";
      await page.getByTestId("admin-panel-hub").waitFor({ state: "visible" });
      await page.getByTestId("admin-overview-sections").waitFor({ state: "visible" });
      const nav = page.getByRole("navigation", { name: "Разделы админки", exact: true });
      for (const name of ["Обзор", "Пользователи и роли", "Базовые программы", "Базовые упражнения", "Обратная связь"])
        check(await nav.getByRole("button", { name, exact: true }).count() === 1, "admin-nav-metadata-missing");
      check(await nav.getByRole("button", { name: "Обзор", exact: true }).getAttribute("aria-current") === "page", "admin-hub-not-current");
      await checkUi("Администратор: matching-claim hub и метаданные навигации без открытия реальных пользователей");
      // Other overview cards demand-load trainer materials or feedback texts, outside this read scope.
      checkpoint = "ui-admin-directory-failed";
      await page.getByTestId("admin-overview-sections").getByRole("button", { name: /^Пользователи и роли/ }).click();
      const directory = page.getByTestId("admin-users-workspace");
      await directory.locator('[aria-label="Список пользователей"][aria-busy="false"]').waitFor({ state: "visible" });
      check(await directory.getByRole("alert").count() === 0, "admin-directory-load-error");
      await checkUi("Администратор: карточка каталога открыта только для согласованного чтения, без открытия пользователей");
      checkpoint = "ui-admin-return-failed";
      await page.getByRole("navigation", { name: "Разделы админки", exact: true }).getByRole("button", { name: "Обзор", exact: true }).click();
      await page.getByTestId("admin-panel-hub").waitFor({ state: "visible" });
      await checkUi("Администратор: возврат из каталога в обзор");
    }
  } catch (error) { throw trainerSmokeUiCheckpointError(error, checkpoint);
  } finally { await context.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const { report, output } = await runTrainerActionFirstSmoke(parseTrainerActionFirstSmokeArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ project: report.project, version: report.version, cases: report.cases.length, failed: report.failed === true,
      failedStep: report.failedStep || null, cleanupVerified: report.cleanupVerified, output })); if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safeTrainerActionSmokeError(error))); process.exitCode = 1; }
}
