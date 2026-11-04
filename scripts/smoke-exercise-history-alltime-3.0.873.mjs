// REVIEW THIS ENTIRE FILE before an explicitly approved Production invocation.
// One temporary client; only its own profile, workout, 22 history documents and
// normal per-UID rate records. No shared exercise cards or real-user writes.
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), PROJECT = "tren-85720", VERSION = "3.0.873";
const BUCKET = `${PROJECT}.firebasestorage.app`, OUTPUT = `output/playwright/exercise-history-alltime-${VERSION}`;
const NAME = "Сгибание ног в тренажере", SOURCE = `gs://${BUCKET}/template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/IMG_7786.mp4`;
const POSTER = "protected-exercise-previews/v1/b41b07b775a30700ae0ebef71c059b477471c5abc2e574c797a9ba6f4cddda04.webp";
const RATE_SCOPES = ["exercise-video-access", "client-exercise-media", "client-loading-snapshot", "nutrition-storage", "profile-update-login"];
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (condition, code) => { if (!condition) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const safeUid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const stringField = (document, key) => document?.fields?.[key]?.stringValue;
export const safeExerciseHistoryAlltimeError = error => ({ code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" });

export function parseExerciseHistoryAlltimeArgs(args, env = process.env) {
  const options = { "output-dir": OUTPUT }, seen = new Set();
  for (const argument of args) {
    const match = /^--(project|expected-version|output-dir)=(.+)$/.exec(argument), key = match?.[1] || argument;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) options[key] = match[2];
    else if (argument === "--run") options.run = true;
    else if (argument === "--allow-production") options.allowProduction = true;
    else fail("unknown-argument");
  }
  check(options.run === true && options.allowProduction === true && options.project === PROJECT && options["expected-version"] === VERSION,
    "exact-production-version-and-authorization-required");
  check(options["output-dir"] === OUTPUT, "exact-output-directory-required");
  for (const name of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])
    check(!env[name], "cached-operator-and-explicit-project-only");
  return options;
}

// Inspect query shape only; never persist raw WebChannel bodies, cursor values,
// credentials, document contents or arbitrary request URLs.
export function alltimeHistoryQueryEvidence(raw, uid) {
  if (typeof raw !== "string" || raw.length > 2 * 1024 * 1024) return [];
  const parse = value => { try { return JSON.parse(value); } catch { return null; } };
  const roots = [parse(raw)], found = []; let nodes = 0;
  for (const [, value] of new URLSearchParams(raw)) roots.push(parse(value));
  const walk = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 15 || ++nodes > 2000) return;
    if (value.structuredQuery?.from?.some(item => item.collectionId === "history")) {
      const query = value.structuredQuery, orders = query.orderBy || [];
      found.push({ own: value.parent === `projects/${PROJECT}/databases/(default)/documents/users/${uid}` &&
        query.from.every(item => item.collectionId === "history" && item.allDescendants !== true),
      limit: Number(query.limit?.value ?? query.limit) || 0,
      dateDescending: orders[0]?.field?.fieldPath === "date" && orders[0].direction === "DESCENDING",
      nameDescending: orders[1]?.field?.fieldPath === "__name__" && orders[1].direction === "DESCENDING",
      exactlyTwoOrders: orders.length === 2,
      cursorPresent: Array.isArray(query.startAt?.values) && query.startAt.values.length === 2,
      cursorAfter: query.startAt?.before === false });
    }
    for (const child of Object.values(value)) {
      if (typeof child === "string" && /^[\[{]/.test(child)) walk(parse(child), depth + 1);
      else walk(child, depth + 1);
    }
  };
  roots.forEach(value => walk(value)); return found;
}

export function createAlltimeHistoryFixtures(runId, now = new Date().toISOString()) {
  check(/^[a-f0-9-]{36}$/.test(runId) && Number.isFinite(Date.parse(now)), "invalid-fixture-identity");
  const workoutId = `alltime-current-${runId}`, program = `alltime-program-${runId}`;
  const workoutName = `Текущая проверка истории ${runId}`;
  const history = Array.from({ length: 22 }, (_, index) => {
    const date = new Date(Date.parse(now) - (index + 1) * 86400000).toISOString(), legacy = index >= 20;
    return { id: `alltime-history-${String(index + 1).padStart(2, "0")}`, data: {
      clientSaveId: `alltime-past-save-${runId}-${index}`, workoutId: `alltime-past-workout-${runId}-${index}`,
      workout: `Архивная проверка ${index + 1} ${runId}`, workoutName: `Архивная проверка ${index + 1} ${runId}`,
      date, startedAt: date, finishedAt: date, assignedProgramId: `alltime-old-program-${index % 3}-${runId}`,
      assignedProgramUpdatedAt: `alltime-old-version-${index % 3}-${runId}`,
      exercises: [{ id: `alltime-old-exercise-${index}`, name: NAME, video: SOURCE,
        sets: [{ reps: legacy ? index === 20 ? 7 : 8 : 12, weight: legacy ? index === 20 ? 77 : 88 : 20 + index,
          ...(legacy ? {} : { completed: true }) }] }]
    } };
  });
  check(history.every(row => row.data.workoutId !== workoutId && row.data.workoutName !== workoutName), "history-must-not-complete-current-workout");
  return { workoutId, workoutName, program, history };
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
  const prefix = `exercise-history-alltime-${runId}`, handles = [];
  try { for (const suffix of [".json", ".intent.json", "-partial.png", "-complete.png"]) handles.push(await open(resolve(directory, prefix + suffix), "wx")); }
  catch (error) { await Promise.all(handles.map(handle => handle.close())); throw error; }
  const save = async (handle, value) => { const text = JSON.stringify(value, null, 2) + "\n"; await handle.write(text, 0, "utf8"); await handle.truncate(Buffer.byteLength(text)); await handle.sync(); };
  return { output: `${options["output-dir"]}/${prefix}.json`, frames: ["-partial.png", "-complete.png"].map(suffix => `${options["output-dir"]}/${prefix}${suffix}`),
    save: async (report, intent) => { await save(handles[1], intent); await save(handles[0], report); },
    screenshot: async (index, buffer) => { await handles[index + 2].write(buffer, 0, buffer.length, 0); await handles[index + 2].truncate(buffer.length); await handles[index + 2].sync(); },
    close: async () => { await Promise.all(handles.map(handle => handle.close())); } };
}

// Injection is reserved for offline safety tests. CLI exposes no transport,
// credential, identity, fixture, browser or cleanup-scope override.
export async function runExerciseHistoryAlltimeSmoke(input, dependencies = {}) {
  const options = parseExerciseHistoryAlltimeArgs(Object.entries(input || {}).flatMap(([key, value]) => value === true
    ? [key === "allowProduction" ? "--allow-production" : `--${key}`] : [`--${key}=${value}`]));
  const localVersion = await (dependencies.readLocalVersion || (async () => JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version))();
  check(localVersion === VERSION, "local-version-mismatch");
  const manifest = await (dependencies.readManifest || (async () => JSON.parse(await readFile(resolve(ROOT, "output/playwright/exercise-preview-assets-3.0.868/manifest.json"), "utf8"))))();
  const asset = manifest.assets.find(item => item.sourceRef === SOURCE && item.previewTime === 2.1);
  check(asset?.objectPath === POSTER && asset.bytes === 48166 && asset.width === 540 && asset.height === 960, "local-media-manifest-mismatch");
  const runId = randomUUID(), now = new Date().toISOString(), fixture = createAlltimeHistoryFixtures(runId, now);
  const artifact = await (dependencies.createArtifacts || createArtifacts)(options, runId);
  const identity = { email: `exercise-history-alltime-${runId.replaceAll("-", "")}@example.invalid`, password: randomBytes(30).toString("base64url"),
    marker: `exercise-history-alltime:${runId}`, absenceVerified: false, attempted: false, ownershipVerified: false };
  const trainer = `synthetic-alltime-${runId}`, base = `https://${PROJECT}.web.app`, database = `projects/${PROJECT}/databases/(default)`;
  const documents = `https://firestore.googleapis.com/v1/${database}/documents`, authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:`;
  const report = { schemaVersion: 1, project: PROJECT, version: VERSION, runId, startedAt: now, cases: [], cleanup: {}, containsRealUserData: false,
    limits: ["Один временный клиент, одна его тренировка и 22 его записи истории; trainer — только synthetic ID без аккаунта.",
      "Нет общих trainerExerciseCards, реальных клиентов, завершения подходов/тренировки, Telegram, IAM или конфигурации.",
      "Проверяется настоящий Production UI и два SDK-запроса истории: свой UID, date DESC + __name__ DESC, limit 21, cursor второй страницы.",
      "Текущая загрузка client-loading-snapshot может читать историю на сервере; этот smoke проверяет отсутствие НЕограниченных браузерных history-запросов.",
      "Проверка Chromium не подменяет проверку настоящего Telegram WebView. Очистка подтверждается на момент выполнения."] };
  const intent = { project: PROJECT, version: VERSION, runId, marker: identity.marker, workoutId: fixture.workoutId,
    historyIds: fixture.history.map(row => row.id), globalDocuments: [], cleanupRequired: true };
  let token, apiKey, browser, page, overallTimer, step = "initialize", cleaning = false, requests = 0, cleanupRequests = 0, domainRequests = 0, cleanupRecords = 0;
  const deadline = Date.now() + 10 * 60 * 1000;
  const persist = async () => { intent.identity = Object.fromEntries(["email", "uid", "absenceVerified", "attempted", "ownershipVerified"].map(key => [key, identity[key]])); await artifact.save(report, intent); };
  const request = async (url, { method = "GET", body, expected = 200, optional = false, json = true } = {}) => {
    const target = new URL(url); check(target.protocol === "https:" && !target.username && !target.password && !target.port &&
      [`${PROJECT}.web.app`, "firestore.googleapis.com", "identitytoolkit.googleapis.com"].includes(target.hostname), "unsafe-request-origin");
    if (cleaning) { cleanupRequests++; check(++domainRequests <= 6000, "cleanup-request-budget"); }
    else check(++requests <= 100 && Date.now() < deadline, "main-request-budget");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token && (target.hostname === "firestore.googleapis.com" || url.startsWith(authAdmin)) ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
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
    await persist(); token = await (dependencies.operatorToken || cachedOperatorToken)();
    step = "hosting-project-version";
    const config = await request(`${base}/__/firebase/init.json`); check(config.projectId === PROJECT && config.storageBucket === BUCKET && typeof config.apiKey === "string", "hosting-project-mismatch"); apiKey = config.apiKey;
    const worker = await (dependencies.fetchImpl || fetch)(`${base}/sw.js?exercise-history-alltime=${runId}`, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    check(worker.status === 200 && (await boundedBytes(worker, 512 * 1024)).toString("utf8").includes(`const CACHE_NAME = "workout-app-v${VERSION}";`), "published-version-mismatch");
    await pass("Точный Production project и опубликованная версия 3.0.873 подтверждены");
    step = "create-owned-client"; check(identity.email.split("@")[0].length > 32, "email-must-not-create-global-alias");
    check(await lookup() === null, "identity-already-exists"); identity.absenceVerified = true; identity.attempted = true; await persist();
    const operator = token; let signup;
    try { token = undefined; signup = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: "POST", body: { email: identity.email, password: identity.password, returnSecureToken: true } }); }
    finally { token = operator; }
    check(safeUid(signup.localId) && typeof signup.idToken === "string", "signup-response-invalid"); identity.uid = signup.localId;
    const claims = JSON.parse(Buffer.from(signup.idToken.split(".")[1], "base64url").toString("utf8"));
    check(claims.aud === PROJECT && claims.sub === identity.uid && claims.iss === `https://securetoken.google.com/${PROJECT}`, "token-project-mismatch");
    check(await lookup(), "created-identity-not-found"); identity.ownershipVerified = true; await persist();
    step = "create-owned-fixtures";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk" }).format(new Date());
    await createOwnDoc(`users/${identity.uid}`, { role: "client", active: true, name: "Проверка истории за весь период", email: identity.email,
      createdByUid: identity.marker, createdAt: now, accountRegistrationType: "open", accountAccessStatus: "active", firstSetupCompleted: true,
      trainerAssignmentState: "assigned", assignedTrainerId: trainer, trainerId: trainer, assignedProgramId: fixture.program,
      assignedProgramName: "Текущая проверка", assignedProgramAddedAt: now, assignedProgramUpdatedAt: now,
      workoutModePreference: { mode: "individual", remember: true, updatedAt: now } });
    await createOwnDoc(`users/${identity.uid}/workouts/${fixture.workoutId}`, { name: fixture.workoutName, assignedBy: trainer, assignedProgramId: fixture.program,
      assignedProgramName: "Текущая проверка", assignedProgramAddedAt: now, assignedProgramUpdatedAt: now, assignedAt: now,
      assignedProgramLifecycleStatus: "active", status: "planned", order: 0, plannedDate: today, scheduledDate: today,
      exercises: [{ id: "alltime-current-exercise", name: NAME, video: SOURCE, videoPosterTime: 2.1, rest: "90 сек", sets: [{ reps: 12, weight: 14 }, { reps: 12, weight: 14 }] }] });
    for (const row of fixture.history) await createOwnDoc(`users/${identity.uid}/history/${row.id}`, row.data);
    await pass("Созданы только один клиент, одна собственная тренировка и 22 собственные записи разных программ; два старых результата без completed");
    step = "actual-client-login";
    const { chromium } = await import("playwright"); browser = await chromium.launch({ timeout: 20000 });
    const context = await browser.newContext({ viewport: { width: 402, height: 760 }, timezoneId: "Europe/Minsk", serviceWorkers: "block" });
    context.setDefaultTimeout(20000); context.setDefaultNavigationTimeout(45000); page = await context.newPage();
    overallTimer = setTimeout(() => { report.deadlineExceeded = true; void browser?.close().catch(() => {}); }, Math.max(1, deadline - Date.now()));
    const network = { browserRequests: 0, posterGets: 0, videoGets: 0, unexpectedStorage: 0, unsafeHistoryQuery: false, historyQueries: [] }, errors = [];
    report.network = network; let phase = "before-history";
    await page.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (++network.browserRequests > 600 || Date.now() >= deadline) { report.deadlineExceeded = true; return route.abort(); }
      if (["storage.googleapis.com", `${BUCKET}.storage.googleapis.com`].includes(url.hostname)) {
        const path = decodeURIComponent(url.pathname).replace(url.hostname === "storage.googleapis.com" ? `/${BUCKET}/` : /^\//, "");
        if (path !== POSTER) { network.unexpectedStorage++; if (path.endsWith(".mp4")) network.videoGets++; return route.abort(); }
        if (req.method() === "GET") network.posterGets++;
      }
      if (url.hostname === "firestore.googleapis.com") {
        const evidence = alltimeHistoryQueryEvidence(req.postData(), identity.uid);
        network.historyQueries.push(...evidence.map(item => ({ ...item, phase })));
        if (evidence.some(item => !item.own || item.limit !== 21 || !item.dateDescending || !item.nameDescending || !item.exactlyTwoOrders)) {
          network.unsafeHistoryQuery = true; return route.abort();
        }
      }
      return route.continue();
    });
    page.on("pageerror", () => errors.push("page-runtime-error"));
    await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("https://apis.google.com/js/api.js*", route => route.abort("failed"));
    await page.route(`https://${PROJECT}.firebaseapp.com/__/auth/**`, route => route.abort("failed"));
    await page.goto(`${base}/?exercise-history-alltime=${runId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Email или логин", exact: true }).click({ timeout: 45000 });
    await page.getByLabel("Email или логин", { exact: true }).fill(identity.email); await page.getByLabel("Пароль", { exact: true }).fill(identity.password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await page.getByTestId("client-nav-workouts").waitFor({ state: "visible", timeout: 45000 }); await page.getByTestId("client-nav-workouts").click();
    await page.getByTestId("workout-start-button").click();
    const readiness = page.getByTestId("workout-readiness-dialog"); await readiness.waitFor({ state: "visible" });
    await readiness.locator('[data-workout-readiness-option="good"]').click(); await readiness.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-workout-stage="warmup"], [data-testid="workout-exercise-video-frame"]'));
    if (await page.locator('[data-workout-stage="warmup"]').isVisible()) await page.getByRole("button", { name: "Начать тренировку", exact: true }).click();
    const frame = page.getByTestId("workout-exercise-video-frame"); await frame.waitFor({ state: "visible" });
    await page.waitForFunction(() => { const image = document.querySelector('[data-testid="workout-exercise-video-frame"] img[data-video-poster]'); return image?.complete && image.naturalWidth > 0; }, null, { timeout: 45000 });
    step = "icon-and-centred-set-title";
    await page.evaluate(() => document.fonts.ready);
    const historyButton = page.getByRole("button", { name: "История упражнения", exact: true });
    report.controlGeometry = await historyButton.evaluate(button => {
      const rect = button.getBoundingClientRect(), nav = button.closest('nav[aria-label="Выбор подхода"]');
      const label = nav?.querySelector('summary span[aria-live="polite"]');
      if (!nav || !label) return null;
      const range = document.createRange(); range.selectNodeContents(label);
      const text = range.getBoundingClientRect(), container = nav.getBoundingClientRect();
      return { iconWidth: rect.width, iconHeight: rect.height, visibleButtonText: button.innerText.trim(),
        centreDelta: Math.abs(text.x + text.width / 2 - container.x - container.width / 2) };
    });
    check(report.controlGeometry?.iconWidth >= 44 && report.controlGeometry.iconHeight >= 44 &&
      report.controlGeometry.visibleButtonText === "" && report.controlGeometry.centreDelta <= 1, "history-icon-or-set-title-geometry-invalid");
    check(network.historyQueries.length === 0 && network.videoGets === 0, "history-loaded-before-demand-or-video-requested");
    await pass("История — только иконка не меньше 44×44; текст подхода центрирован с точностью 1 px; история ещё не запрашивалась");
    step = "first-page-all-programmes"; phase = "page-one";
    await historyButton.click();
    const modal = page.getByTestId("workout-exercise-progress-modal"), chart = modal.getByTestId("workout-exercise-progress-chart");
    await modal.waitFor({ state: "visible" }); await chart.getByText("По загруженным записям", { exact: true }).waitFor({ state: "visible" });
    check(await modal.locator("ol li").count() === 20 && await chart.locator("svg circle").count() === 20, "first-page-not-twenty-history-facts");
    check(network.historyQueries.some(item => item.phase === "page-one" && !item.cursorPresent && !item.cursorAfter), "first-page-query-not-observed");
    await artifact.screenshot(0, await modal.screenshot({ type: "png" }));
    await pass("Первая страница показывает 20 результатов разных программ и график с честной подписью частичной загрузки; запрос limit 21");
    step = "second-cursor-page-and-legacy-results"; phase = "page-two";
    await modal.getByRole("button", { name: "Загрузить более ранние записи упражнения", exact: true }).click();
    await chart.getByText("За всё время", { exact: true }).waitFor({ state: "visible" });
    check(await modal.locator("ol li").count() === 22 && await chart.locator("svg circle").count() === 22, "second-page-did-not-append-two-old-results");
    const texts = await modal.locator("ol li").allTextContents();
    check(texts.some(value => value.includes("77 кг") && value.includes("7 повт.")) && texts.some(value => value.includes("88 кг") && value.includes("8 повт.")), "legacy-plain-sets-not-shown");
    check(network.historyQueries.some(item => item.phase === "page-two" && item.cursorPresent && item.cursorAfter), "second-page-cursor-query-not-observed");
    check(await modal.getByRole("button", { name: "Загрузить более ранние записи упражнения", exact: true }).count() === 0, "complete-history-still-offers-more");
    check((await chart.getByText("Максимум", { exact: true }).locator("..").locator("strong").textContent()).includes("88"), "alltime-maximum-does-not-include-legacy-record");
    await artifact.screenshot(1, await modal.screenshot({ type: "png" })); report.frames = artifact.frames;
    await pass("Вторая страница с курсором добавила две старые legacy-записи; всего 22, полный охват «За всё время», максимум включает старую программу");
    check(!errors.length && !network.unsafeHistoryQuery && !network.unexpectedStorage && !network.videoGets && !report.deadlineExceeded, "runtime-or-request-boundary-failure");
    await modal.getByRole("button", { name: "Закрыть прогресс упражнения", exact: true }).click(); await modal.waitFor({ state: "detached" });
    check(await page.getByTestId("workout-primary-action").getAttribute("data-action") === "complete" &&
      await page.getByRole("button", { name: "Подход 1 выполнен, действия", exact: true }).count() === 0, "history-view-marked-current-set-completed");
    await pass("Просмотр истории не отметил текущий подход выполненным и не запускал видео");
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safeExerciseHistoryAlltimeError(error); }
  finally {
    clearTimeout(overallTimer); cleaning = true;
    try { await browser?.close(); } catch { report.browserCloseFailed = true; report.failed = true; }
    const clean = async (key, operation) => { domainRequests = 0; try { report.cleanup[key] = await operation(); }
      catch (error) { report.cleanup[key] = false; (report.cleanup.failures ||= {})[key] = safeExerciseHistoryAlltimeError(error); } };
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
    report.cleanupVerified = ["authAbsent", "profileTreeAbsent", "ratesAbsent"].every(key => report.cleanup[key] === true);
    report.failed = report.failed === true || !report.cleanupVerified; intent.cleanupRequired = !report.cleanupVerified;
    report.finishedAt = new Date().toISOString(); report.requestCount = requests; report.cleanupRequestCount = cleanupRequests; report.cleanupRecords = cleanupRecords;
    token = undefined; apiKey = undefined; identity.password = undefined;
    try { await persist(); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const { report, output } = await runExerciseHistoryAlltimeSmoke(parseExerciseHistoryAlltimeArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ failed: report.failed, failedStep: report.failedStep || null, cases: report.cases.length, cleanupVerified: report.cleanupVerified, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safeExerciseHistoryAlltimeError(error))); process.exitCode = 1; }
}
