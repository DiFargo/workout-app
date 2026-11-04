// REVIEW THIS ENTIRE FILE before an explicitly authorized Production invocation.
// One temporary client, one owned workout/history entry and two owned synthetic cards.
// Never edits an existing client, exercise card, workout or Telegram configuration.
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), PROJECT = "tren-85720", VERSION = "3.0.872";
const BUCKET = `${PROJECT}.firebasestorage.app`, OUTPUT = `output/playwright/workout-experience-${VERSION}`;
const MEDIA = [
  { name: "Сгибание ног в тренажере", clip: "IMG_7786.mp4", time: 2.1,
    poster: "b41b07b775a30700ae0ebef71c059b477471c5abc2e574c797a9ba6f4cddda04", bytes: 48166 },
  { name: "Тяга хаммера по одной руке", clip: "IMG_8116.mp4", time: 9.802,
    poster: "9e78c56bbb1d61981e3e33e9d2a5cc72a4e9eb2dadffd223f9eec5f8eb0d1c84", bytes: 80620 }
].map((item, index) => ({ ...item, index, exerciseId: `smoke-experience-${index + 1}`,
  source: `gs://${BUCKET}/template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/${item.clip}`,
  posterPath: `protected-exercise-previews/v1/${item.poster}.webp` }));
const RATE_SCOPES = ["exercise-video-access", "client-exercise-media", "client-loading-snapshot", "nutrition-storage", "profile-update-login"];
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (condition, code) => { if (!condition) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const safeUid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const stringField = (document, key) => document?.fields?.[key]?.stringValue;
export const safeWorkoutExperienceError = error => ({ code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" });

export function parseWorkoutExperienceArgs(args, env = process.env) {
  const options = { "output-dir": OUTPUT }, seen = new Set();
  for (const arg of args) {
    const match = /^--(project|expected-version|output-dir)=(.+)$/.exec(arg), key = match?.[1] || arg;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) options[key] = match[2];
    else if (arg === "--run") options.run = true;
    else if (arg === "--allow-production") options.allowProduction = true;
    else fail("unknown-argument");
  }
  check(options.run && options.allowProduction && options.project === PROJECT && options["expected-version"] === VERSION, "exact-production-version-and-authorization-required");
  check(options["output-dir"] === OUTPUT, "exact-output-directory-required");
  for (const name of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])
    check(!env[name], "cached-operator-and-explicit-project-only");
  return options;
}

const encode = value => value === null ? { nullValue: null } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : typeof value === "object" ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
    : typeof value === "number" ? { [Number.isInteger(value) ? "integerValue" : "doubleValue"]: Number.isInteger(value) ? String(value) : value } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
async function boundedBytes(response, maximum) {
  const reader = response.body?.getReader(); check(reader, "missing-response-body"); const chunks = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
    if (size > maximum) { await reader.cancel(); fail("response-budget-exceeded"); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function cachedOperatorToken() {
  try {
    const require = createRequire(import.meta.url), cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount(); check(account, "cached-operator-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project: PROJECT }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken(); check(typeof token === "string" && token, "cached-operator-unavailable"); return token;
  } catch { fail("cached-operator-unavailable"); }
}
async function createArtifacts(options, runId) {
  const root = await realpath(ROOT), directory = resolve(root, options["output-dir"]);
  await mkdir(directory, { recursive: true });
  for (const path of [resolve(root, "output"), resolve(root, "output/playwright"), directory]) check(await realpath(path) === path, "symlink-output-forbidden");
  const prefix = `workout-experience-${runId}`, handles = [];
  try { for (const suffix of [".json", ".intent.json", "-leg-curl.png", "-hammer.png"]) handles.push(await open(resolve(directory, prefix + suffix), "wx")); }
  catch (error) { await Promise.all(handles.map(handle => handle.close())); throw error; }
  const save = async (handle, value) => { const text = JSON.stringify(value, null, 2) + "\n"; await handle.write(text, 0, "utf8"); await handle.truncate(Buffer.byteLength(text)); await handle.sync(); };
  return { output: `${OUTPUT}/${prefix}.json`, frames: [`${OUTPUT}/${prefix}-leg-curl.png`, `${OUTPUT}/${prefix}-hammer.png`],
    save: async (report, intent) => { await save(handles[1], intent); await save(handles[0], report); },
    screenshot: async (index, buffer) => { await handles[index + 2].write(buffer, 0, buffer.length, 0); await handles[index + 2].truncate(buffer.length); await handles[index + 2].sync(); },
    close: async () => { await Promise.all(handles.map(handle => handle.close())); } };
}

// Inspect only query shape; never retain raw WebChannel bodies, tokens or records.
export function historyQueryEvidence(raw, uid) {
  if (typeof raw !== "string" || raw.length > 2 * 1024 * 1024) return [];
  const roots = [], found = []; let nodes = 0;
  const parse = value => { try { return JSON.parse(value); } catch { return null; } };
  roots.push(parse(raw));
  for (const [, value] of new URLSearchParams(raw)) roots.push(parse(value));
  const walk = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 15 || ++nodes > 2000) return;
    if (value.structuredQuery?.from?.some(item => item.collectionId === "history")) {
      const query = value.structuredQuery;
      found.push({ own: value.parent === `projects/${PROJECT}/databases/(default)/documents/users/${uid}`,
        limit: Number(query.limit?.value ?? query.limit) || 0,
        dateDescending: query.orderBy?.some(order => order.field?.fieldPath === "date" && order.direction === "DESCENDING") === true });
    }
    for (const child of Object.values(value)) {
      if (typeof child === "string" && /^[\[{]/.test(child)) walk(parse(child), depth + 1);
      else walk(child, depth + 1);
    }
  };
  roots.forEach(value => walk(value)); return found;
}

// Dependencies exist only for offline failure/cleanup tests; CLI has no overrides.
export async function runWorkoutExperienceSmoke(input, dependencies = {}) {
  const options = parseWorkoutExperienceArgs(Object.entries(input || {}).flatMap(([key, value]) => value === true
    ? [key === "allowProduction" ? "--allow-production" : `--${key}`] : [`--${key}=${value}`]));
  const localVersion = await (dependencies.readLocalVersion || (async () => JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version))();
  check(localVersion === VERSION, "local-version-mismatch");
  const manifest = await (dependencies.readManifest || (async () => JSON.parse(await readFile(resolve(ROOT, "output/playwright/exercise-preview-assets-3.0.868/manifest.json"), "utf8"))))();
  const assets = MEDIA.map(item => {
    const asset = manifest.assets.find(candidate => candidate.sourceRef === item.source && candidate.previewTime === item.time);
    check(asset?.objectPath === item.posterPath && asset.bytes === item.bytes && asset.width === 540 && asset.height === 960, "local-media-manifest-mismatch"); return asset;
  });
  const runId = randomUUID(), artifact = await (dependencies.createArtifacts || createArtifacts)(options, runId);
  const identity = { email: `workout-experience-${runId.replaceAll("-", "")}@example.invalid`, password: randomBytes(30).toString("base64url"),
    marker: `workout-experience:${runId}`, absenceVerified: false, attempted: false, ownershipVerified: false };
  const trainer = `synthetic-experience-${runId}`, workoutId = `experience-${runId}`, program = `program-${runId}`;
  const cards = MEDIA.map(item => ({ id: `smoke-experience-${runId}-${item.index}`, absenceVerified: false, attempted: false }));
  const base = `https://${PROJECT}.web.app`, database = `projects/${PROJECT}/databases/(default)`, documents = `https://firestore.googleapis.com/v1/${database}/documents`;
  const authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:`;
  const report = { schemaVersion: 1, version: VERSION, project: PROJECT, runId, startedAt: new Date().toISOString(), cases: [], cleanup: {}, containsRealUserData: false,
    limits: ["Один новый клиент; одна его тренировка и одна запись истории. Два новых random trainerExerciseCards принадлежат synthetic trainer без аккаунта.",
      "Упражнения fixture не содержат videoPosterTime; кадры должны прийти настоящим client-exercise-media ответом из собственных synthetic cards.",
      "Нет записи в реальные карточки/тренировки, завершения тренировки, Telegram, IAM, конфигурацию или backend.",
      "История ограничена собственным UID и 21 документом: 20 видимых +1 для признака более старых записей."] };
  const intent = { project: PROJECT, version: VERSION, runId, marker: identity.marker, trainer, workoutId,
    globalDocuments: cards.map(card => `trainerExerciseCards/${card.id}`), cleanupRequired: true };
  let token, apiKey, browser, page, overallTimer, step = "initialize", cleaning = false, requests = 0, cleanupRequests = 0, domainRequests = 0, cleanupRecords = 0;
  let releaseMedia, notifyMediaHeld;
  const mediaGate = new Promise(resolveGate => { releaseMedia = resolveGate; });
  const mediaHeld = new Promise(resolveHeld => { notifyMediaHeld = resolveHeld; });
  const deadline = Date.now() + 10 * 60 * 1000;
  const persist = async () => { intent.identity = Object.fromEntries(["email", "uid", "absenceVerified", "attempted", "ownershipVerified"].map(key => [key, identity[key]])); intent.cards = cards; await artifact.save(report, intent); };
  const request = async (url, { method = "GET", body, expected = 200, optional = false, json = true } = {}) => {
    const target = new URL(url); check(target.protocol === "https:" && !target.username && !target.password && !target.port
      && [`${PROJECT}.web.app`, "firestore.googleapis.com", "identitytoolkit.googleapis.com"].includes(target.hostname), "unsafe-request-origin");
    if (cleaning) { cleanupRequests++; check(++domainRequests <= 6000, "cleanup-request-budget"); }
    else check(++requests <= 100 && Date.now() < deadline, "main-request-budget");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token && (target.hostname === "firestore.googleapis.com" || url.startsWith(authAdmin)) ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (optional && response.status === 404) { await response.body?.cancel(); return null; }
    if (response.status !== expected) { await response.body?.cancel(); fail(`unexpected-http-${response.status}`); }
    if (!json) { await response.body?.cancel(); return null; }
    try { return JSON.parse((await boundedBytes(response, 2 * 1024 * 1024)).toString("utf8")); } catch (error) { if (error.smokeCode) throw error; fail("invalid-json-response"); }
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = path => request(docUrl(path), { optional: true });
  const lookup = async () => { const result = await request(`${authAdmin}lookup`, { method: "POST", body: { email: [identity.email] } });
    const users = result.users || []; check(Array.isArray(users) && users.length <= 1, "ambiguous-identity"); if (!users.length) return null;
    check(users[0].email === identity.email && safeUid(users[0].localId) && (!identity.uid || users[0].localId === identity.uid), "identity-ownership-mismatch"); return users[0]; };
  const createOwnDoc = (path, value) => { check(safeUid(identity.uid) && (path === `users/${identity.uid}` || path.startsWith(`users/${identity.uid}/`)), "non-owned-document-path");
    return request(`${docUrl(path)}?currentDocument.exists=false`, { method: "PATCH", body: { fields: fields(value) } }); };
  const collectionIds = async path => { const values = []; let pageToken;
    do { const result = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", body: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } });
      check(Array.isArray(result.collectionIds || []), "invalid-collection-list"); values.push(...(result.collectionIds || [])); check(values.length <= 1000, "collection-budget"); pageToken = result.nextPageToken;
    } while (pageToken); return values; };
  const deleteDoc = async (document, path) => { check(document?.name === `${database}/documents/${path}` && document.updateTime, "unsafe-document-delete");
    await request(`${docUrl(path)}?currentDocument.updateTime=${encodeURIComponent(document.updateTime)}`, { method: "DELETE", json: false }); };
  const removeTree = async (path, root, depth = 0) => { check((path === root || path.startsWith(`${root}/`)) && depth <= 12 && ++cleanupRecords <= 1000, "owned-tree-budget");
    for (const collection of await collectionIds(path)) { check(typeof collection === "string" && collection && !collection.includes("/") && ![".", ".."].includes(collection), "unsafe-collection-id"); let pageToken;
      do { const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true"); url.searchParams.set("mask.fieldPaths", "_smokeOnly"); if (pageToken) url.searchParams.set("pageToken", pageToken);
        const result = await request(url); for (const child of result.documents || []) { const prefix = `${database}/documents/${path}/${collection}/`;
          check(child.name?.startsWith(prefix) && !child.name.slice(prefix.length).includes("/"), "unsafe-child-document"); await removeTree(child.name.slice(`${database}/documents/`.length), root, depth + 1); } pageToken = result.nextPageToken;
      } while (pageToken); }
    const document = await getDoc(path); if (document) await deleteDoc(document, path); };
  const pass = async label => { report.cases.push(label); await persist(); };
  try {
    // Durable intent includes the exact two global document IDs before any write.
    await persist(); token = await (dependencies.operatorToken || cachedOperatorToken)();
    step = "hosting-project-version";
    const config = await request(`${base}/__/firebase/init.json`); check(config.projectId === PROJECT && config.storageBucket === BUCKET && typeof config.apiKey === "string", "hosting-project-mismatch"); apiKey = config.apiKey;
    const worker = await (dependencies.fetchImpl || fetch)(`${base}/sw.js?workout-experience=${runId}`, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    check(worker.status === 200 && (await boundedBytes(worker, 512 * 1024)).toString("utf8").includes(`const CACHE_NAME = "workout-app-v${VERSION}";`), "published-version-mismatch");
    await pass("Точный Production project и опубликованная версия подтверждены");
    step = "create-owned-client"; check(identity.email.split("@")[0].length > 32, "email-must-not-create-global-alias");
    check(await lookup() === null, "identity-already-exists"); identity.absenceVerified = true; identity.attempted = true; await persist();
    const operator = token; let signup;
    try { token = undefined; signup = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: "POST", body: { email: identity.email, password: identity.password, returnSecureToken: true } }); }
    finally { token = operator; }
    check(safeUid(signup.localId) && typeof signup.idToken === "string", "signup-response-invalid"); identity.uid = signup.localId;
    const claims = JSON.parse(Buffer.from(signup.idToken.split(".")[1], "base64url").toString("utf8"));
    check(claims.aud === PROJECT && claims.sub === identity.uid && claims.iss === `https://securetoken.google.com/${PROJECT}`, "token-project-mismatch");
    check(await lookup(), "created-identity-not-found"); identity.ownershipVerified = true; await persist();
    const now = new Date().toISOString(), previousDate = new Date(Date.now() - 86400000).toISOString();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk" }).format(new Date());
    step = "create-owned-fixtures";
    await createOwnDoc(`users/${identity.uid}`, { role: "client", active: true, name: "Проверка тренировки 3.0.872", email: identity.email,
      createdByUid: identity.marker, createdAt: now, accountRegistrationType: "open", accountAccessStatus: "active", firstSetupCompleted: true,
      trainerAssignmentState: "assigned", assignedTrainerId: trainer, trainerId: trainer, assignedProgramId: program, assignedProgramName: "Проверка интерфейса",
      assignedProgramAddedAt: now, assignedProgramUpdatedAt: now, workoutModePreference: { mode: "individual", remember: true, updatedAt: now } });
    for (const [index, card] of cards.entries()) {
      const path = `trainerExerciseCards/${card.id}`; check(await getDoc(path) === null, "synthetic-card-already-exists");
      card.absenceVerified = true; card.attempted = true; await persist();
      await request(`${docUrl(path)}?currentDocument.exists=false`, { method: "PATCH", body: { fields: fields({ id: card.id,
        ownerUid: trainer, createdByUid: identity.marker, updatedByUid: identity.marker, createdAt: now, updatedAt: now, revision: 1,
        deletedAt: "", name: MEDIA[index].name, video: MEDIA[index].source, videoPosterTime: MEDIA[index].time, technique: "Тестовая карточка интерфейса.",
        muscleGroup: "", videoPoster: "", videoThumbnail: "", videoCrop: null }) } });
    }
    const exercises = MEDIA.map((item, index) => ({ id: item.exerciseId, name: item.name, video: item.source,
      exerciseCardId: cards[index].id, exerciseCardOwnerUid: trainer, rest: "90 сек", sets: [{ reps: 12, weight: 14 }, { reps: 12, weight: 14 }] }));
    check(exercises.every(item => !Object.hasOwn(item, "videoPosterTime")), "fixture-must-not-have-preview-time");
    await createOwnDoc(`users/${identity.uid}/workouts/${workoutId}`, { name: "Проверка интерфейса 3.0.872", assignedBy: trainer, assignedProgramId: program,
      assignedProgramName: "Проверка интерфейса", assignedProgramAddedAt: now, assignedProgramUpdatedAt: now, assignedAt: now,
      assignedProgramLifecycleStatus: "active", status: "planned", order: 0, plannedDate: today, scheduledDate: today, exercises });
    await createOwnDoc(`users/${identity.uid}/history/experience_history`, { workoutId: `past-${runId}`, workout: "Предыдущая тестовая тренировка",
      clientSaveId: `past-experience-${runId}`, date: previousDate, finishedAt: previousDate, assignedProgramUpdatedAt: now,
      exercises: exercises.map((item, index) => ({ id: item.id, name: item.name, exerciseCardId: cards[index].id, exerciseCardOwnerUid: trainer,
        sets: [{ reps: 11, weight: 19, completed: true }] })) });
    await pass("Созданы один собственный клиент, одна тренировка без кадров, одна история и две synthetic карточки с кадрами");
    step = "actual-client-login";
    const { chromium } = await import("playwright"); browser = await chromium.launch({ timeout: 20000 });
    const context = await browser.newContext({ viewport: { width: 402, height: 760 }, timezoneId: "Europe/Minsk", serviceWorkers: "block" });
    context.setDefaultTimeout(20000); context.setDefaultNavigationTimeout(45000); page = await context.newPage();
    overallTimer = setTimeout(() => { report.deadlineExceeded = true; releaseMedia(); void browser?.close().catch(() => {}); }, Math.max(1, deadline - Date.now()));
    const network = { browserRequests: 0, posters: [0, 0], videoGets: 0, unexpectedStorage: 0, mediaFetched: 0, mediaReleased: 0, historyQueries: [] }, errors = [];
    report.network = network; let historyWindow = false, mediaFailure;
    const storageKind = value => { try { const url = new URL(value); if (!["storage.googleapis.com", `${BUCKET}.storage.googleapis.com`].includes(url.hostname)) return null;
      const path = decodeURIComponent(url.pathname).replace(url.hostname === "storage.googleapis.com" ? `/${BUCKET}/` : /^\//, "");
      const poster = MEDIA.findIndex(item => item.posterPath === path); if (poster >= 0) return { kind: "poster", index: poster };
      return MEDIA.some(item => item.source.slice(`gs://${BUCKET}/`.length) === path) ? { kind: "video" } : { kind: "unexpected" };
    } catch { return { kind: "unexpected" }; } };
    await page.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (++network.browserRequests > 500 || Date.now() >= deadline) { report.deadlineExceeded = true; return route.abort(); }
      const kind = storageKind(req.url());
      if (kind?.kind === "unexpected") { network.unexpectedStorage++; return route.abort(); }
      if (req.method() === "GET" && kind?.kind === "poster") network.posters[kind.index]++;
      if (req.method() === "GET" && kind?.kind === "video") network.videoGets++;
      if (historyWindow && url.hostname === "firestore.googleapis.com") network.historyQueries.push(...historyQueryEvidence(req.postData(), identity.uid));
      if (url.origin === base && url.pathname === "/api/client-exercise-media" && req.method() === "POST") {
        const started = Date.now();
        try {
          check(req.postDataJSON()?.clientId === identity.uid, "media-request-not-own-client");
          const response = await route.fetch({ timeout: 20000 }), data = await response.json();
          check(response.status() === 200 && Array.isArray(data.media) && data.media.length === 2, "actual-media-response-invalid");
          for (const item of MEDIA) {
            const row = data.media.find(value => value.workoutId === workoutId && value.exerciseId === item.exerciseId);
            check(row?.card?.id === cards[item.index].id && row.card.ownerUid === trainer && row.card.video === item.source && row.card.videoPosterTime === item.time, "actual-media-card-mismatch");
          }
          network.mediaFetched++; network.mediaResponseHeldAt = Date.now(); notifyMediaHeld();
          await mediaGate;
          network.mediaHeldMs = Date.now() - started; check(network.mediaHeldMs < 5800, "media-hold-exceeded-client-timeout-budget");
          await route.fulfill({ response }); network.mediaReleased++;
        } catch (error) { mediaFailure = safeWorkoutExperienceError(error); network.mediaFailure = mediaFailure; await route.abort().catch(() => {}); }
        return;
      }
      return route.continue();
    });
    page.on("pageerror", () => errors.push("page-runtime-error"));
    await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("https://apis.google.com/js/api.js*", route => route.abort("failed"));
    await page.route(`https://${PROJECT}.firebaseapp.com/__/auth/**`, route => route.abort("failed"));
    await page.goto(`${base}/?workout-experience=${runId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Email или логин", exact: true }).click({ timeout: 45000 });
    await page.getByLabel("Email или логин", { exact: true }).fill(identity.email); await page.getByLabel("Пароль", { exact: true }).fill(identity.password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await page.getByTestId("client-nav-workouts").waitFor({ state: "visible", timeout: 45000 }); await page.getByTestId("client-nav-workouts").click();
    await page.getByTestId("workout-start-button").click();
    const readiness = page.getByTestId("workout-readiness-dialog"); await readiness.waitFor({ state: "visible" });
    await readiness.locator('[data-workout-readiness-option="good"]').click(); await readiness.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-workout-stage="warmup"], [data-testid="workout-exercise-video-frame"]'));
    if (await page.locator('[data-workout-stage="warmup"]').isVisible()) await page.getByRole("button", { name: "Начать тренировку", exact: true }).click();
    step = "held-media-response-race";
    const frame = page.getByTestId("workout-exercise-video-frame"), video = frame.locator("video");
    await frame.waitFor({ state: "visible" });
    check(await video.getAttribute("data-video-preview-time") === "default" && network.mediaReleased === 0 && network.videoGets === 0, "exercise-not-mounted-before-media-enrichment");
    report.exerciseMountedBeforeMediaRelease = true;
    await new Promise((resolveHeld, rejectHeld) => {
      const timer = setTimeout(() => rejectHeld(Object.assign(new Error("media-response-not-held"), { smokeCode: "media-response-not-held" })), 4500);
      mediaHeld.then(() => { clearTimeout(timer); resolveHeld(); });
    });
    // Release immediately: the actual client transport has a six-second deadline.
    releaseMedia();
    const assertPoster = async index => {
      await page.waitForFunction(({ expected }) => {
        const frame = document.querySelector('[data-testid="workout-exercise-video-frame"]'), image = frame?.querySelector('img[data-video-poster]');
        return frame?.querySelector("video")?.getAttribute("data-video-preview-time") === String(expected) && image?.complete && image.naturalWidth > 0;
      }, { expected: MEDIA[index].time }, { timeout: 45000 });
      const decoded = await frame.locator("img[data-video-poster]").evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
      check(decoded.width === assets[index].width && decoded.height === assets[index].height && !await video.getAttribute("src"), "decoded-preview-or-lazy-video-invalid");
      await artifact.screenshot(index, await frame.screenshot({ type: "png" }));
      return decoded;
    };
    report.legCurlPreview = await assertPoster(0);
    check(network.mediaFetched > 0 && network.mediaReleased > 0 && !mediaFailure, "held-actual-media-response-failed");
    await pass("Первое упражнение открыто до enrichment; настоящий задержанный media-ответ восстановил выбранный кадр");
    const selectExercise = async index => {
      await page.getByTestId("workout-exercise-picker-trigger").click();
      const picker = page.getByRole("dialog", { name: "Упражнения тренировки" }); await picker.waitFor({ state: "visible" });
      await picker.locator(`[data-testid="workout-exercise-picker-item"][data-step-index="${index}"]`).click();
      await picker.waitFor({ state: "detached" });
    };
    step = "exercise-picker-and-second-poster";
    await selectExercise(2); report.hammerPreview = await assertPoster(1); report.frames = artifact.frames;
    check(await page.getByTestId("workout-primary-action").getAttribute("data-action") === "complete" && await page.getByRole("button", { name: "Подход 1 выполнен, действия", exact: true }).count() === 0
      && network.videoGets === 0 && network.posters.every(value => value > 0), "picker-completed-set-or-loaded-video");
    report.beforePlay = { posters: [...network.posters], videoGets: network.videoGets, preload: await video.getAttribute("preload") };
    check(report.beforePlay.preload === "none", "preplay-preload-invalid");
    await pass("Выбор второго упражнения не отметил подход; оба настоящих превью декодированы, до Play нет MP4");
    step = "native-play-from-zero";
    await video.evaluate(element => { window.__workoutExperiencePlaying = []; element.addEventListener("playing", () => window.__workoutExperiencePlaying.push(element.currentTime)); });
    await frame.getByRole("button", { name: "Воспроизвести видео упражнения", exact: true }).click();
    await page.waitForFunction(() => window.__workoutExperiencePlaying?.length > 0, null, { timeout: 45000 });
    const firstTime = await page.evaluate(() => window.__workoutExperiencePlaying[0]);
    check(Number.isFinite(firstTime) && firstTime >= 0 && firstTime < 1, "first-playback-not-from-zero");
    await video.evaluate(element => new Promise((resolvePlay, reject) => { const start = element.currentTime, until = performance.now() + 10000;
      const timer = setInterval(() => { if (!element.paused && element.readyState >= 2 && element.currentTime >= start + .3) { clearInterval(timer); resolvePlay(); }
        else if (performance.now() >= until) { clearInterval(timer); reject(new Error("playback-not-progressing")); } }, 75); }));
    report.firstPlayingTime = firstTime; check(network.videoGets > 0, "native-video-not-requested"); await video.evaluate(element => element.pause());
    await pass("Настоящий ролик второго упражнения начал воспроизведение с нуля и продолжил играть");
    step = "bounded-own-exercise-history"; historyWindow = true;
    await page.getByRole("button", { name: "История упражнения", exact: true }).click();
    const historyModal = page.getByTestId("workout-exercise-progress-modal"); await historyModal.waitFor({ state: "visible" });
    await historyModal.getByText("Записи текущей программы среди последних 1 тренировок.", { exact: true }).waitFor({ state: "visible" });
    check((await historyModal.locator("ol li").allTextContents()).some(value => value.includes("19 кг") && value.includes("11 повт.")), "own-history-result-not-shown");
    check(network.historyQueries.length > 0 && network.historyQueries.every(value => value.own && value.limit === 21 && value.dateDescending), "history-query-not-own-bounded-window");
    historyWindow = false; await historyModal.getByRole("button", { name: "Закрыть прогресс упражнения", exact: true }).click();
    await historyModal.waitFor({ state: "detached" }); await pass("История показала собственный результат; запрос только к своему UID, date desc, limit 21 (20+1)");
    step = "rest-completion-and-next-set";
    await selectExercise(1);
    check(await page.getByTestId("workout-primary-action").getAttribute("data-action") === "complete", "return-marked-set-completed");
    await page.getByTestId("workout-primary-action").click();
    const timer = page.getByTestId("workout-rest-timer-expanded"); await timer.waitFor({ state: "visible" });
    let reductions = 0;
    for (;;) {
      const label = (await timer.locator("strong").first().textContent() || "").trim(), match = /^(\d+):(\d{2})$/.exec(label);
      check(match, "rest-countdown-not-visible"); const seconds = Number(match[1]) * 60 + Number(match[2]);
      if (seconds <= 15) break;
      check(++reductions <= 12, "rest-shortening-budget"); await timer.getByRole("button", { name: "Убавить 15 секунд", exact: true }).click();
    }
    await page.waitForFunction(() => document.querySelector('[data-testid="workout-rest-timer-expanded"]')?.getAttribute("data-rest-completed") === "true", null, { timeout: 25000 });
    check(await timer.isVisible() && await timer.getByRole("button", { name: "Следующий подход", exact: true }).count() === 1
      && await timer.locator("strong").count() === 0, "finished-rest-did-not-become-action");
    await timer.getByRole("button", { name: "Следующий подход", exact: true }).click(); await timer.waitFor({ state: "detached" });
    const selectedSet = page.getByRole("button", { name: "Все подходы, выбран подход 2 из 2", exact: true });
    await selectedSet.waitFor({ state: "visible" });
    check(await page.getByTestId("workout-primary-action").getAttribute("data-action") === "complete" && await page.getByRole("button", { name: "Подход 2 выполнен, действия", exact: true }).count() === 0, "next-set-was-auto-completed");
    check(await selectedSet.getAttribute("aria-description") === "Выполнено 1 из 2", "completed-first-set-not-preserved");
    await pass("По настоящему окончанию отдыха sheet остался и заменил таймер кнопкой; переход открыл второй подход без выполнения");
    check(!errors.length && !network.unexpectedStorage && !report.deadlineExceeded && !mediaFailure, "runtime-network-or-media-failure");
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safeWorkoutExperienceError(error); }
  finally {
    clearTimeout(overallTimer); releaseMedia(); cleaning = true;
    try { await browser?.close(); } catch { report.browserCloseFailed = true; report.failed = true; }
    const clean = async (key, operation) => { domainRequests = 0; try { report.cleanup[key] = await operation(); }
      catch (error) { report.cleanup[key] = false; (report.cleanup.failures ||= {})[key] = safeWorkoutExperienceError(error); } };
    // Global fixtures are independent of Auth/profile cleanup and always audited.
    for (const [index, card] of cards.entries()) await clean(`card${index + 1}Absent`, async () => {
      if (!card.attempted || !card.absenceVerified) return true;
      const path = `trainerExerciseCards/${card.id}`, document = await getDoc(path);
      if (document) { check(stringField(document, "createdByUid") === identity.marker && stringField(document, "ownerUid") === trainer
        && stringField(document, "id") === card.id, "cleanup-card-ownership-mismatch"); await deleteDoc(document, path); }
      return await getDoc(path) === null;
    });
    if (identity.attempted && identity.absenceVerified) {
      await clean("identityResolved", async () => { const user = await lookup(); if (user) { identity.uid ||= user.localId; identity.ownershipVerified = true; } return Boolean(identity.uid) || user === null; });
      if (identity.uid && identity.ownershipVerified) {
        await clean("authAbsent", async () => { if (await lookup()) await request(`${authAdmin}delete`, { method: "POST", body: { localId: identity.uid } }); return await lookup() === null; });
        await clean("profileTreeAbsent", async () => { const root = `users/${identity.uid}`, profile = await getDoc(root);
          if (profile) check(stringField(profile, "createdByUid") === identity.marker && stringField(profile, "email") === identity.email, "cleanup-profile-ownership-mismatch");
          await removeTree(root, root); return await getDoc(root) === null && (await collectionIds(root)).length === 0; });
        await clean("ratesAbsent", async () => { for (const scope of RATE_SCOPES) { const path = `securityRateLimits/${hash(`${identity.uid}:${scope}`)}`, rate = await getDoc(path);
          if (rate) { check(stringField(rate, "uid") === identity.uid && stringField(rate, "action") === scope, "rate-ownership-mismatch"); await deleteDoc(rate, path); }
          check(await getDoc(path) === null, "rate-still-present"); } return true; });
      } else { const absent = !identity.uid && report.cleanup.identityResolved === true; Object.assign(report.cleanup, { authAbsent: absent, profileTreeAbsent: absent, ratesAbsent: absent }); }
    } else Object.assign(report.cleanup, { notCreated: true, authAbsent: true, profileTreeAbsent: true, ratesAbsent: true });
    report.cleanupVerified = ["authAbsent", "profileTreeAbsent", "ratesAbsent", "card1Absent", "card2Absent"].every(key => report.cleanup[key] === true);
    report.failed = report.failed === true || !report.cleanupVerified; intent.cleanupRequired = !report.cleanupVerified;
    report.finishedAt = new Date().toISOString(); report.requestCount = requests; report.cleanupRequestCount = cleanupRequests; report.cleanupRecords = cleanupRecords;
    token = undefined; apiKey = undefined; identity.password = undefined;
    try { await persist(); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const { report, output } = await runWorkoutExperienceSmoke(parseWorkoutExperienceArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ failed: report.failed, failedStep: report.failedStep || null, cases: report.cases.length, cleanupVerified: report.cleanupVerified, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safeWorkoutExperienceError(error))); process.exitCode = 1; }
}
