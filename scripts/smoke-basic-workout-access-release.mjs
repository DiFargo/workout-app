// Opt-in, reviewed live smoke: exactly two random owned accounts. No history,
// subscriptions, Telegram, IAM, actual hardware enrollment or real user writes.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "tren-85720", BUCKET = `${PROJECT}.firebasestorage.app`;
const VIDEO = "template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/IMG_7786.mp4";
const POSTER = "protected-exercise-previews/v1/b41b07b775a30700ae0ebef71c059b477471c5abc2e574c797a9ba6f4cddda04.webp";
const SOURCE = `gs://${BUCKET}/${VIDEO}`;
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (condition, code) => { if (!condition) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const safeUid = uid => typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
const field = (document, key) => document?.fields?.[key]?.stringValue;
export const safeBasicAccessSmokeError = error => ({ code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" });

export function parseBasicAccessSmokeArgs(args, env = process.env) {
  const options = {}, seen = new Set();
  for (const arg of args) {
    const match = /^--(project|expected-version|output-dir)=(.+)$/.exec(arg), key = match?.[1] || arg;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) options[key] = match[2];
    else if (arg === "--run") options.run = true;
    else if (arg === "--allow-production") options.allowProduction = true;
    else fail("unknown-argument");
  }
  check(options.run === true && options.allowProduction === true && options.project === PROJECT, "explicit-production-authorization-required");
  check(/^\d+\.\d+\.\d+$/.test(options["expected-version"] || ""), "expected-version-required");
  check(options["output-dir"] === `artifacts/remediation-${options["expected-version"]}`, "exact-output-directory-required");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])
    check(!env[key], "cached-operator-and-explicit-project-only");
  return options;
}

export function validateBasicSmokeMediaUrl(value, kind, now = Date.now()) {
  let url; try { url = new URL(value); } catch { fail("invalid-media-url"); }
  const object = kind === "poster" ? POSTER : kind === "video" ? VIDEO : "";
  check(object && url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash, "invalid-media-origin");
  check((url.hostname === "storage.googleapis.com" && decodeURIComponent(url.pathname) === `/${BUCKET}/${object}`) ||
    (url.hostname === `${BUCKET}.storage.googleapis.com` && decodeURIComponent(url.pathname) === `/${object}`), "media-object-mismatch");
  const allowed = new Set(["X-Goog-Algorithm", "X-Goog-Credential", "X-Goog-Date", "X-Goog-Expires", "X-Goog-SignedHeaders", "X-Goog-Signature", "response-content-disposition", "response-content-type"]);
  check([...url.searchParams.keys()].every(key => allowed.has(key) && url.searchParams.getAll(key).length === 1), "unexpected-media-parameter");
  const expires = Number(url.searchParams.get("X-Goog-Expires"));
  check(url.searchParams.get("X-Goog-Algorithm") === "GOOG4-RSA-SHA256" && /^[a-f0-9]{128,1024}$/i.test(url.searchParams.get("X-Goog-Signature") || "") &&
    url.searchParams.get("X-Goog-SignedHeaders") === "host" && Boolean(url.searchParams.get("X-Goog-Credential")) && Number.isInteger(expires) && expires > 0 && expires <= 900, "invalid-media-signature");
  const date = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(url.searchParams.get("X-Goog-Date") || "");
  check(date, "invalid-media-date");
  const issued = Date.UTC(...date.slice(1).map((value, index) => Number(value) - (index === 1 ? 1 : 0)));
  check(Number.isFinite(issued) && issued <= now + 30000 && issued + expires * 1000 > now && issued + expires * 1000 <= now + 930000, "invalid-media-window");
  return url;
}

const encode = value => value === null ? { nullValue: null } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : typeof value === "object" ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
    : typeof value === "number" ? { [Number.isInteger(value) ? "integerValue" : "doubleValue"]: Number.isInteger(value) ? String(value) : value } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
async function bytes(response, maximum) {
  const reader = response.body?.getReader(); check(reader, "missing-response-body"); let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
    if (size > maximum) { await reader.cancel(); fail("response-budget-exceeded"); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function operatorToken() {
  try {
    const require = createRequire(import.meta.url), cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount(); check(account, "cached-operator-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project: PROJECT }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken(); check(typeof token === "string" && token, "cached-operator-unavailable"); return token;
  } catch { fail("cached-operator-unavailable"); }
}
async function createArtifacts(options, runId) {
  const root = await realpath(ROOT), parent = resolve(root, "artifacts"), directory = resolve(root, options["output-dir"]);
  await mkdir(directory, { recursive: true });
  check(await realpath(parent) === parent && await realpath(directory) === directory, "symlink-output-forbidden");
  const prefix = `basic-workout-access-${runId}`, report = await open(resolve(directory, `${prefix}.json`), "wx");
  let intent; try { intent = await open(resolve(directory, `${prefix}.intent.json`), "wx"); } catch (error) { await report.close(); throw error; }
  const save = async (file, value) => { const text = JSON.stringify(value, null, 2) + "\n"; await file.write(text, 0, "utf8"); await file.truncate(Buffer.byteLength(text)); await file.sync(); };
  return { output: `${options["output-dir"]}/${prefix}.json`, save: async (result, plan) => { await save(intent, plan); await save(report, result); },
    close: async () => { try { await report.close(); } finally { await intent.close(); } } };
}

// Dependency injection is exclusively for offline unit tests. CLI cannot choose
// identities, object paths, credentials, endpoints, claims or cleanup scope.
export async function runBasicWorkoutAccessSmoke(input, dependencies = {}) {
  const options = parseBasicAccessSmokeArgs(Object.entries(input || {}).flatMap(([key, value]) => value === true
    ? [key === "allowProduction" ? "--allow-production" : `--${key}`] : [`--${key}=${value}`]));
  const version = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  check(version === options["expected-version"], "local-version-mismatch");
  const runId = randomBytes(12).toString("hex"), marker = `basic-access-smoke:${runId}`;
  const artifact = await (dependencies.createArtifacts || createArtifacts)(options, runId);
  const identities = ["client", "admin"].map(role => ({ role, email: `basic-access-${runId}-${role}@example.invalid`,
    password: randomBytes(30).toString("base64url"), absenceVerified: false, attempted: false, ownershipVerified: false }));
  const [client, administrator] = identities, base = `https://${PROJECT}.web.app`, database = `projects/${PROJECT}/databases/(default)`;
  const documents = `https://firestore.googleapis.com/v1/${database}/documents`, authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:`;
  const report = { schemaVersion: 1, project: PROJECT, version, runId, startedAt: new Date().toISOString(), cases: [], cleanup: [], containsRealUserData: false,
    limits: ["Ровно два собственных случайных Auth-аккаунта: клиент и администратор; только их профили и workouts.",
      "Admin key proof — подписанный Firebase Auth claims fixture для проверки правил, не проверка физического USB/NFC-ключа.",
      "History не записывается: после отзыва проверяется чтение пустой собственной коллекции и старого собственного workout. Сохранение результата покрыто эмулятором.",
      "Нет Telegram, subscription/ledger, IAM, глобальных изменений или платных AI-вызовов: AI запрашивается только до выдачи доступа и должен вернуть 403.",
      "Медиа — только существующие leg-curl MP4/WebP через штатный endpoint; endpoint может применить обычную metadata policy. Каждый HTTP Range ограничен 64 байтами.",
      "Очистка подтверждается на момент проверки; поздние внешние события не исключены."] };
  const intent = { project: PROJECT, version, runId, marker, cleanupRequired: true, identities: [] };
  let operator, apiKey, step = "initialize", cleaning = false, requests = 0, cleanupRequests = 0, cleanupRecords = 0, domainRequests = 0;
  const deadline = Date.now() + 8 * 60 * 1000;
  const persist = async () => { intent.identities = identities.map(({ role, email, uid, absenceVerified, attempted, ownershipVerified }) => ({ role, email, uid, absenceVerified, attempted, ownershipVerified })); await artifact.save(report, intent); };
  const request = async (url, { method = "GET", body, bearer, expected = 200, allowMissing = false, raw = false, maximum = 2 * 1024 * 1024, headers = {} } = {}) => {
    const target = new URL(url); check(target.protocol === "https:" && !target.username && !target.password && !target.port && !target.hash, "unsafe-request-origin");
    check([`${PROJECT}.web.app`, "firestore.googleapis.com", "identitytoolkit.googleapis.com"].includes(target.hostname) ||
      (raw && ["storage.googleapis.com", `${BUCKET}.storage.googleapis.com`].includes(target.hostname) && headers.Range === "bytes=0-63" && maximum === 64), "unsafe-request-origin");
    if (cleaning) { cleanupRequests++; check(++domainRequests <= 600, "cleanup-request-budget"); }
    else check(++requests <= 100 && Date.now() < deadline, "main-request-budget");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (allowMissing && response.status === 404) { await response.body?.cancel(); return null; }
    if (response.status !== expected) { await response.body?.cancel(); fail(`unexpected-http-${response.status}`); }
    if (method === "DELETE") { await response.body?.cancel(); return null; }
    const data = await bytes(response, maximum);
    if (raw) return { bytes: data, headers: response.headers };
    try { return JSON.parse(data.toString("utf8")); } catch { fail("invalid-json-response"); }
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const ownPath = (identity, path) => check(safeUid(identity.uid) && (path === `users/${identity.uid}` || path.startsWith(`users/${identity.uid}/`)), "non-owned-document-path");
  const getDoc = path => request(docUrl(path), { bearer: operator, allowMissing: true });
  const createDoc = async (identity, path, value, bearer = operator, expected = 200) => { ownPath(identity, path);
    return request(`${docUrl(path)}?currentDocument.exists=false`, { method: "PATCH", bearer, expected, body: { fields: fields(value) } }); };
  const patchProfile = async (identity, value, bearer = operator, expected = 200) => {
    ownPath(identity, `users/${identity.uid}`); const current = await getDoc(`users/${identity.uid}`);
    check(field(current, "createdByUid") === marker && field(current, "email") === identity.email && current.updateTime, "profile-ownership-mismatch");
    const url = new URL(docUrl(`users/${identity.uid}`)); Object.keys(value).forEach(key => url.searchParams.append("updateMask.fieldPaths", key)); url.searchParams.set("currentDocument.updateTime", current.updateTime);
    return request(url, { method: "PATCH", bearer, expected, body: { fields: fields(value) } });
  };
  const lookup = async identity => { const result = await request(`${authAdmin}lookup`, { method: "POST", bearer: operator, body: { email: [identity.email] } });
    const users = result.users || []; check(Array.isArray(users) && users.length <= 1, "ambiguous-owned-identity"); if (!users.length) return null;
    check(users[0].email === identity.email && safeUid(users[0].localId) && (!identity.uid || users[0].localId === identity.uid), "identity-ownership-mismatch"); return users[0]; };
  const validateToken = (identity, token, extra = {}) => { let claims; try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { fail("invalid-auth-token"); }
    check(claims.aud === PROJECT && claims.sub === identity.uid && claims.iss === `https://securetoken.google.com/${PROJECT}` &&
      Object.entries(extra).every(([key, value]) => claims[key] === value), "auth-claims-mismatch"); return claims; };
  const setAdminClaims = async proof => {
    check(administrator.ownershipVerified && await lookup(administrator), "admin-fixture-not-owned");
    const claims = { admin: true, adminClaimVersion: runId, ...(proof ? { adminSecurityKeyVersion: `key_${runId}`, adminSecurityKeyRoleVersion: runId, adminSecurityKeyUntil: Date.now() + 5 * 60 * 1000 } : {}) };
    await request(`${authAdmin}update`, { method: "POST", bearer: operator, body: { localId: administrator.uid, customAttributes: JSON.stringify(claims) } });
    const session = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, { method: "POST", body: { email: administrator.email, password: administrator.password, returnSecureToken: true } });
    validateToken(administrator, session.idToken, claims); administrator.idToken = session.idToken;
  };
  const pass = async label => { report.cases.push(label); await persist(); };
  const collectionIds = async path => { const result = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", bearer: operator, body: { pageSize: 100 } });
    check(!result.nextPageToken && Array.isArray(result.collectionIds || []), "cleanup-collection-budget"); return result.collectionIds || []; };
  const deleteDoc = async (document, path) => { check(document?.name === `${database}/documents/${path}` && document.updateTime, "unsafe-document-delete");
    await request(`${docUrl(path)}?currentDocument.updateTime=${encodeURIComponent(document.updateTime)}`, { method: "DELETE", bearer: operator }); };
  const removeTree = async (path, root, depth = 0) => { check((path === root || path.startsWith(`${root}/`)) && depth <= 8 && ++cleanupRecords <= 100, "owned-tree-budget");
    for (const collection of await collectionIds(path)) { check(typeof collection === "string" && collection && !collection.includes("/") && ![".", ".."].includes(collection), "unsafe-child-collection");
      const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true"); url.searchParams.set("mask.fieldPaths", "_smokeOnly");
      const result = await request(url, { bearer: operator }); check(!result.nextPageToken && (result.documents || []).length <= 100, "cleanup-document-budget");
      for (const child of result.documents || []) { const prefix = `${database}/documents/${path}/${collection}/`;
        check(child.name?.startsWith(prefix) && !child.name.slice(prefix.length).includes("/"), "unsafe-child-document"); await removeTree(child.name.slice(`${database}/documents/`.length), root, depth + 1); }
    }
    const document = await getDoc(path); if (document) await deleteDoc(document, path);
  };
  try {
    await persist(); operator = await (dependencies.operatorToken || operatorToken)();
    step = "hosting-version"; const config = await request(`${base}/__/firebase/init.json`);
    check(config.projectId === PROJECT && config.storageBucket === BUCKET && typeof config.apiKey === "string" && config.apiKey.length > 20, "hosting-project-mismatch"); apiKey = config.apiKey;
    const worker = await request(`${base}/sw.js?basic-access=${runId}`, { raw: true, maximum: 512 * 1024 });
    check(worker.bytes.toString("utf8").includes(`const CACHE_NAME = "workout-app-v${version}";`), "published-version-mismatch"); await pass("Production project и версия совпадают");
    step = "create-owned-identities";
    for (const identity of identities) {
      check(identity.email.split("@")[0].length > 32 && await lookup(identity) === null, "random-identity-already-exists"); identity.absenceVerified = true; identity.attempted = true; await persist();
      const signup = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: "POST", body: { email: identity.email, password: identity.password, returnSecureToken: true } });
      check(safeUid(signup.localId) && typeof signup.idToken === "string", "signup-response-invalid"); identity.uid = signup.localId; validateToken(identity, signup.idToken); identity.idToken = signup.idToken; await persist();
      check(await lookup(identity), "created-identity-not-found"); identity.ownershipVerified = true; await persist();
      await createDoc(identity, `users/${identity.uid}`, { role: identity.role, active: true, name: `Synthetic basic access ${identity.role}`, email: identity.email, createdByUid: marker, createdAt: new Date().toISOString(),
        ...(identity.role === "client" ? { accountAccessStatus: "active", trainerAssignmentState: "assigned", assignedTrainerId: `synthetic_${runId}`, firstSetupCompleted: true } :
          { adminClaimVersion: runId, adminSecurityKeyRequired: true, adminSecurityKeyVersion: `key_${runId}` }) });
    }
    await pass("Созданы ровно два собственных случайных аккаунта");
    const root = `users/${client.uid}`, legacyPath = `${root}/workouts/legacy_basic`;
    await createDoc(client, legacyPath, { source: "basic", basicPlanId: `legacy_${runId}`, name: "Synthetic existing basic day",
      assignedBy: `synthetic_${runId}`, assignedProgramUpdatedAt: `basic:legacy_${runId}`, status: "planned",
      exercises: [{ id: "owned_leg_curl", name: "Сгибание ног в тренажёре", video: SOURCE, videoPosterTime: 2.1,
        rest: "90 сек", sets: [{ reps: 12, weight: 14 }] }] });
    step = "client-cannot-self-grant"; await patchProfile(client, { basicWorkoutAccess: true }, client.idToken, 403);
    check((await getDoc(root)).fields.basicWorkoutAccess?.booleanValue !== true, "self-grant-persisted"); await pass("Клиент не может выдать себе доступ");
    step = "unproven-admin-denied"; await setAdminClaims(false); await patchProfile(client, { basicWorkoutAccess: true }, administrator.idToken, 403); await pass("Admin token без key proof отклонён действующими Rules");
    step = "denied-ai-before-provider";
    const deniedAi = await request(`${base}/api/ai-basic-workout-plan`, { method: "POST", bearer: client.idToken, body: {}, expected: 403 });
    check(deniedAi.ok === false && /Доступ к базовым тренировкам открывает администратор/.test(deniedAi.message || ""), "ai-denial-not-access-guard"); await pass("AI вернул 403 допуска до вызова платного провайдера");
    step = "denied-basic-write"; await createDoc(client, `${root}/workouts/denied_basic`, { source: "basic", exercises: [] }, client.idToken, 403);
    await pass("Новый basic workout не сохраняется до разрешения");
    step = "proven-admin-grant"; await setAdminClaims(true); await patchProfile(client, { basicWorkoutAccess: true }, administrator.idToken);
    check((await getDoc(root)).fields.basicWorkoutAccess?.booleanValue === true, "grant-not-persisted"); await pass("Admin с подписанным proof fixture выдал доступ через Rules");
    step = "granted-basic-writes";
    const basicPlan = { id: `basic_${runId}`, basicPlanId: `basic_${runId}`, source: "basic", workouts: [{ id: "granted_basic", source: "basic", exercises: [] }] };
    await createDoc(client, `${root}/workouts/granted_basic`, basicPlan.workouts[0], client.idToken);
    await patchProfile(client, { basicWorkoutPlan: basicPlan, workoutModePreference: { mode: "basic", remember: true } }, client.idToken);
    const loading = await request(`${base}/api/client-loading-snapshot`, { method: "POST", bearer: client.idToken, body: { kind: "workouts" } });
    check(loading.uid === client.uid && loading.profile?.basicWorkoutAccess === true, "compact-grant-missing"); await pass("Owner сохраняет basic plan; compact snapshot сохраняет явный grant");
    step = "proven-admin-revoke"; await patchProfile(client, { basicWorkoutAccess: false }, administrator.idToken);
    await createDoc(client, `${root}/workouts/after_revoke`, { source: "basic", exercises: [] }, client.idToken, 403);
    await patchProfile(client, { basicWorkoutPlan: { ...basicPlan, name: "changed" } }, client.idToken, 403);
    await pass("Отзыв через Rules запрещает следующие basic записи");
    step = "historical-reads-preserved";
    const existing = await request(docUrl(legacyPath), { bearer: client.idToken });
    const history = await request(`${docUrl(`${root}/history`)}?pageSize=1`, { bearer: client.idToken });
    check(field(existing, "basicPlanId") === `legacy_${runId}` && (history.documents || []).length === 0, "historical-read-invalid"); await pass("Старый own workout и собственная пустая history доступны после отзыва");
    step = "signed-preview-and-video";
    const media = await request(`${base}/api/exercise-video-access`, { method: "POST", bearer: client.idToken, body: { source: SOURCE, previewTime: 2.1 } });
    check(media.ok === true && Date.parse(media.expiresAt) > Date.now() && Date.parse(media.expiresAt) <= Date.now() + 930000, "media-response-invalid");
    for (const kind of ["poster", "video"]) {
      const url = validateBasicSmokeMediaUrl(kind === "poster" ? media.posterUrl : media.url, kind);
      const result = await request(url, { expected: 206, raw: true, maximum: 64, headers: { Range: "bytes=0-63" } });
      check(result.bytes.length === 64 && /^bytes 0-63\/\d+$/.test(result.headers.get("content-range") || "") &&
        (kind === "poster" ? /^image\/webp/i : /^video\/mp4/i).test(result.headers.get("content-type") || ""), "media-range-invalid");
      if (kind === "poster") check(result.bytes.toString("ascii", 0, 4) === "RIFF" && result.bytes.toString("ascii", 8, 12) === "WEBP", "poster-not-webp");
    }
    await pass("Защищённые leg-curl WebP и MP4 доступны: по 64 байта, без полной загрузки");
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safeBasicAccessSmokeError(error); }
  finally {
    cleaning = true;
    for (const identity of identities) {
      const result = { role: identity.role };
      const clean = async (name, operation) => { domainRequests = 0; try { result[name] = await operation(); } catch (error) { result[name] = false; (result.errors ||= {})[name] = safeBasicAccessSmokeError(error); } };
      if (!identity.attempted || !identity.absenceVerified) Object.assign(result, { authAbsent: true, profileTreeAbsent: true, ratesAbsent: true, notCreated: true });
      else {
        await clean("identityResolved", async () => { const user = await lookup(identity); if (user) { identity.uid ||= user.localId; identity.ownershipVerified = true; } return Boolean(identity.uid) || user === null; });
        if (identity.uid && identity.ownershipVerified) {
          await clean("authAbsent", async () => { if (await lookup(identity)) await request(`${authAdmin}delete`, { method: "POST", bearer: operator, body: { localId: identity.uid } }); return await lookup(identity) === null; });
          await clean("profileTreeAbsent", async () => { const root = `users/${identity.uid}`, profile = await getDoc(root);
            if (profile) check(field(profile, "createdByUid") === marker && field(profile, "email") === identity.email, "cleanup-profile-ownership-mismatch");
            await removeTree(root, root); return await getDoc(root) === null && (await collectionIds(root)).length === 0; });
          await clean("ratesAbsent", async () => { for (const scope of ["exercise-video-access", "client-loading-snapshot"]) {
            const path = `securityRateLimits/${hash(`${identity.uid}:${scope}`)}`, rate = await getDoc(path);
            if (rate) { check(field(rate, "uid") === identity.uid && field(rate, "action") === scope, "rate-ownership-mismatch"); await deleteDoc(rate, path); }
            check(await getDoc(path) === null, "rate-still-present"); } return true; });
        } else {
          const noUid = !identity.uid && result.identityResolved === true;
          Object.assign(result, { authAbsent: noUid, profileTreeAbsent: noUid, ratesAbsent: noUid });
        }
      }
      result.cleaned = result.authAbsent === true && result.profileTreeAbsent === true && result.ratesAbsent === true; report.cleanup.push(result);
      try { await persist(); } catch { report.artifactWriteFailed = true; report.failed = true; }
    }
    report.cleanupVerified = report.cleanup.length === 2 && report.cleanup.every(result => result.cleaned);
    report.failed ||= !report.cleanupVerified; intent.cleanupRequired = !report.cleanupVerified;
    report.finishedAt = new Date().toISOString(); report.requestCount = requests; report.cleanupRequestCount = cleanupRequests; report.cleanupRecords = cleanupRecords;
    operator = undefined; apiKey = undefined; identities.forEach(identity => { identity.password = undefined; identity.idToken = undefined; });
    try { await persist(); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

// Resume only an already recorded run's cleanup. It cannot create identities,
// issue tokens/claims, call app endpoints or choose arbitrary document roots.
export async function recoverBasicWorkoutAccessCleanup(input, runId, dependencies = {}) {
  const options = parseBasicAccessSmokeArgs(Object.entries(input || {}).flatMap(([key, value]) => value === true
    ? [key === "allowProduction" ? "--allow-production" : `--${key}`] : [`--${key}=${value}`]));
  check(/^[a-f0-9]{24}$/.test(runId || ""), "invalid-recovery-run");
  const directory = resolve(ROOT, options["output-dir"]);
  const prefix = resolve(directory, `basic-workout-access-${runId}`), reportPath = `${prefix}.json`, intentPath = `${prefix}.intent.json`;
  const { report, intent } = await (dependencies.readRecoveryArtifacts || (async () => {
    check(await realpath(directory) === directory, "symlink-output-forbidden");
    return { report: JSON.parse(await readFile(reportPath, "utf8")), intent: JSON.parse(await readFile(intentPath, "utf8")) };
  }))();
  check([report, intent].every(item => item.project === PROJECT && item.version === options["expected-version"] && item.runId === runId) &&
    intent.marker === `basic-access-smoke:${runId}` && intent.identities?.length === 2 &&
    intent.identities.every((identity, index) => identity.role === ["client", "admin"][index] && safeUid(identity.uid) &&
      identity.email === `basic-access-${runId}-${identity.role}@example.invalid` && identity.absenceVerified === true && identity.ownershipVerified === true), "recovery-intent-mismatch");
  const operator = await (dependencies.operatorToken || operatorToken)(), database = `projects/${PROJECT}/databases/(default)`;
  const documents = `https://firestore.googleapis.com/v1/${database}/documents`, authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:`;
  let requests = 0, records = 0; const results = [], errors = [];
  const request = async (url, method = "GET", body) => {
    const parsed = new URL(url); check(parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port &&
      ["firestore.googleapis.com", "identitytoolkit.googleapis.com"].includes(parsed.hostname) && ++requests <= 200, "unsafe-recovery-request");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${operator}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (response.status !== 200) { await response.body?.cancel(); fail(`recovery-http-${response.status}`); }
    if (method === "DELETE") { await response.body?.cancel(); return null; }
    try { return JSON.parse((await bytes(response, 2 * 1024 * 1024)).toString("utf8")); } catch { fail("recovery-invalid-json"); }
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const get = path => request(docUrl(path));
  const collections = async path => { const result = await request(`${docUrl(path)}:listCollectionIds`, "POST", { pageSize: 100 });
    check(result && !result.nextPageToken && Array.isArray(result.collectionIds || []), "recovery-collection-budget"); return result.collectionIds || []; };
  const remove = async (document, path) => { check(document?.name === `${database}/documents/${path}` && document.updateTime, "unsafe-recovery-delete");
    await request(`${docUrl(path)}?currentDocument.updateTime=${encodeURIComponent(document.updateTime)}`, "DELETE"); };
  const tree = async (path, root, depth = 0) => {
    check((path === root || path.startsWith(`${root}/`)) && depth <= 8 && ++records <= 100, "recovery-tree-budget");
    for (const collection of await collections(path)) {
      check(typeof collection === "string" && collection && !collection.includes("/") && ![".", ".."].includes(collection), "unsafe-recovery-collection");
      const listed = await request(`${docUrl(`${path}/${collection}`)}?pageSize=100&showMissing=true&mask.fieldPaths=_smokeOnly`);
      check(listed && !listed.nextPageToken && Array.isArray(listed.documents || []), "recovery-document-budget");
      for (const child of listed.documents || []) { const base = `${database}/documents/${path}/${collection}/`;
        check(child.name?.startsWith(base) && !child.name.slice(base.length).includes("/"), "unsafe-recovery-child"); await tree(child.name.slice(`${database}/documents/`.length), root, depth + 1); }
    }
    const current = await get(path); if (current) await remove(current, path);
  };
  for (const identity of intent.identities) {
    const result = { role: identity.role };
    const run = async (key, operation) => { try { result[key] = await operation(); } catch (error) { result[key] = false;
      errors.push({ role: identity.role, domain: key, ...safeBasicAccessSmokeError(error), errorType: String(error?.name || "Error").replace(/[^A-Za-z]/g, "").slice(0, 30) }); } };
    await run("authAbsent", async () => {
      const lookup = async () => { const found = await request(`${authAdmin}lookup`, "POST", { email: [identity.email] }); const users = found?.users || [];
        check(Array.isArray(users) && users.length <= 1 && users.every(item => item.localId === identity.uid && item.email === identity.email), "recovery-identity-mismatch"); return users.length > 0; };
      if (await lookup()) await request(`${authAdmin}delete`, "POST", { localId: identity.uid }); return !(await lookup());
    });
    await run("profileTreeAbsent", async () => { const root = `users/${identity.uid}`, profile = await get(root);
      if (profile) check(field(profile, "createdByUid") === intent.marker && field(profile, "email") === identity.email, "recovery-profile-mismatch");
      await tree(root, root); return await get(root) === null && (await collections(root)).length === 0;
    });
    await run("ratesAbsent", async () => { for (const scope of ["exercise-video-access", "client-loading-snapshot"]) {
      const path = `securityRateLimits/${hash(`${identity.uid}:${scope}`)}`, current = await get(path);
      if (current) { check(field(current, "uid") === identity.uid && field(current, "action") === scope, "recovery-rate-mismatch"); await remove(current, path); }
      check(await get(path) === null, "recovery-rate-still-present"); } return true;
    });
    result.cleaned = result.authAbsent === true && result.profileTreeAbsent === true && result.ratesAbsent === true; results.push(result);
  }
  const verified = results.length === 2 && results.every(item => item.cleaned);
  report.initialCleanup ||= report.cleanup;
  report.cleanupRecovery = { finishedAt: new Date().toISOString(), requests, records, errors, verified };
  report.cleanup = results; report.cleanupVerified = verified; report.failed = Boolean(report.failedStep || !verified);
  intent.cleanupRequired = !verified;
  const save = async (path, value) => { const handle = await open(path, "r+"); try { const text = JSON.stringify(value, null, 2) + "\n";
    await handle.write(text, 0, "utf8"); await handle.truncate(Buffer.byteLength(text)); await handle.sync(); } finally { await handle.close(); } };
  if (dependencies.saveRecoveryArtifacts) await dependencies.saveRecoveryArtifacts(report, intent);
  else { await save(intentPath, intent); await save(reportPath, report); }
  return { verified, results, errors, reportPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const { report, output } = await runBasicWorkoutAccessSmoke(parseBasicAccessSmokeArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ project: report.project, version: report.version, cases: report.cases.length, failed: report.failed === true, failedStep: report.failedStep || null, cleanupVerified: report.cleanupVerified, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safeBasicAccessSmokeError(error))); process.exitCode = 1; }
}
