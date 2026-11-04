// REVIEW THIS ENTIRE FILE before an explicitly authorized Production invocation.
// One random client, one owned workout, existing leg-curl media; never completes a workout.
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "tren-85720", BUCKET = `${PROJECT}.firebasestorage.app`;
const SOURCE = `gs://${BUCKET}/template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/IMG_7786.mp4`;
const POSTER = "protected-exercise-previews/v1/b41b07b775a30700ae0ebef71c059b477471c5abc2e574c797a9ba6f4cddda04.webp";
const VIDEO = SOURCE.slice(`gs://${BUCKET}/`.length);
const RATE_SCOPES = ["exercise-video-access", "client-exercise-media", "client-loading-snapshot", "nutrition-storage", "profile-update-login"];
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (value, code) => { if (!value) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const safeUid = uid => typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
const stringField = (document, key) => document?.fields?.[key]?.stringValue;
export const safePreviewRecoveryError = error => ({ code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" });

export function parsePreviewRecoveryArgs(args, env = process.env) {
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
  check(options["output-dir"] === `output/playwright/exercise-preview-recovery-${options["expected-version"]}`, "exact-output-directory-required");
  for (const name of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])
    check(!env[name], "cached-operator-and-explicit-project-only");
  return options;
}

const encode = value => value === null ? { nullValue: null } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : typeof value === "object" ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
    : typeof value === "number" ? { [Number.isInteger(value) ? "integerValue" : "doubleValue"]: Number.isInteger(value) ? String(value) : value } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
async function bytes(response, maximum) {
  const reader = response.body?.getReader(); check(reader, "missing-response-body"); const chunks = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
    if (size > maximum) { await reader.cancel(); fail("response-budget-exceeded"); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
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
async function artifacts(options, runId) {
  const root = await realpath(ROOT), directory = resolve(root, options["output-dir"]);
  await mkdir(directory, { recursive: true });
  for (const path of [resolve(root, "output"), resolve(root, "output/playwright"), directory]) check(await realpath(path) === path, "symlink-output-forbidden");
  const prefix = `preview-recovery-${runId}`, handles = [];
  try {
    for (const suffix of [".json", ".intent.json", ".png"]) handles.push(await open(resolve(directory, prefix + suffix), "wx"));
  } catch (error) { await Promise.all(handles.map(handle => handle.close())); throw error; }
  const save = async (handle, value) => { const text = JSON.stringify(value, null, 2) + "\n"; await handle.write(text, 0, "utf8"); await handle.truncate(Buffer.byteLength(text)); await handle.sync(); };
  return { output: `${options["output-dir"]}/${prefix}.json`, frame: `${options["output-dir"]}/${prefix}.png`,
    save: async (report, intent) => { await save(handles[1], intent); await save(handles[0], report); },
    screenshot: async buffer => { await handles[2].write(buffer, 0, buffer.length, 0); await handles[2].truncate(buffer.length); await handles[2].sync(); },
    close: async () => { await Promise.all(handles.map(handle => handle.close())); } };
}

// Injection is for offline tests only. No CLI identity/transport/media overrides.
export async function runPreviewRecoverySmoke(input, dependencies = {}) {
  const options = parsePreviewRecoveryArgs(Object.entries(input || {}).flatMap(([key, value]) => value === true
    ? [key === "allowProduction" ? "--allow-production" : `--${key}`] : [`--${key}=${value}`]));
  const version = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  check(version === options["expected-version"], "local-version-mismatch");
  const manifest = JSON.parse(await readFile(resolve(ROOT, "output/playwright/exercise-preview-assets-3.0.868/manifest.json"), "utf8"));
  const asset = manifest.assets.find(item => item.sourceRef === SOURCE && item.previewTime === 2.1);
  check(asset?.objectPath === POSTER && asset.bytes === 48166, "local-media-manifest-mismatch");
  const runId = randomUUID(), artifact = await (dependencies.createArtifacts || artifacts)(options, runId);
  const identity = { email: `preview-recovery-${runId.replaceAll("-", "")}@example.invalid`, password: randomBytes(30).toString("base64url"),
    marker: `preview-recovery:${runId}`, absenceVerified: false, attempted: false, ownershipVerified: false };
  const base = `https://${PROJECT}.web.app`, database = `projects/${PROJECT}/databases/(default)`, documents = `https://firestore.googleapis.com/v1/${database}/documents`;
  const authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:`;
  const report = { schemaVersion: 1, project: PROJECT, version, runId, startedAt: new Date().toISOString(), cases: [], cleanup: {},
    containsRealUserData: false, limits: ["Один случайный клиент и одна собственная тренировка; trainer — только synthetic ID, без профиля/аккаунта.",
      "Нет завершения тренировки, истории, Telegram, admin, изменения ролей других пользователей или глобальной конфигурации.",
      "Только существующие leg-curl MP4/WebP; endpoint может применить обычную политику metadata защиты видео.",
      "Первый GET обложки прерывается; требуется автоматическое восстановление без ручного retry. Очистка подтверждается на момент проверки."] };
  const intent = { project: PROJECT, version, runId, marker: identity.marker, cleanupRequired: true };
  let token, apiKey, browser, page, overallTimer, step = "initialize", cleaning = false, requests = 0, cleanupRequests = 0, domainRequests = 0, cleanupRecords = 0;
  const deadline = Date.now() + 10 * 60 * 1000;
  const persist = async () => { intent.identity = Object.fromEntries(["email", "uid", "absenceVerified", "attempted", "ownershipVerified"].map(key => [key, identity[key]])); await artifact.save(report, intent); };
  const request = async (url, { method = "GET", body, expected = 200, optional = false, json = true } = {}) => {
    const target = new URL(url); check(target.protocol === "https:" && !target.username && !target.password && !target.port
      && [`${PROJECT}.web.app`, "firestore.googleapis.com", "identitytoolkit.googleapis.com"].includes(target.hostname), "unsafe-request-origin");
    if (cleaning) { cleanupRequests++; check(++domainRequests <= 6000, "cleanup-request-budget"); }
    else check(++requests <= 100 && Date.now() < deadline, "main-request-budget");
    const response = await (dependencies.fetchImpl || fetch)(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token && (target.hostname === "firestore.googleapis.com" || url.startsWith(authAdmin)) ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (optional && response.status === 404) { await response.body?.cancel(); return null; }
    if (response.status !== expected) { await response.body?.cancel(); fail(`unexpected-http-${response.status}`); }
    if (!json) { await response.body?.cancel(); return null; }
    try { return JSON.parse((await bytes(response, 2 * 1024 * 1024)).toString("utf8")); } catch (error) { if (error.smokeCode) throw error; fail("invalid-json-response"); }
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = path => request(docUrl(path), { optional: true });
  const lookup = async () => { const result = await request(`${authAdmin}lookup`, { method: "POST", body: { email: [identity.email] } });
    const users = result.users || []; check(Array.isArray(users) && users.length <= 1, "ambiguous-identity"); if (!users.length) return null;
    check(users[0].email === identity.email && safeUid(users[0].localId) && (!identity.uid || users[0].localId === identity.uid), "identity-ownership-mismatch"); return users[0]; };
  const createDoc = (path, value) => { check(safeUid(identity.uid) && (path === `users/${identity.uid}` || path.startsWith(`users/${identity.uid}/`)), "non-owned-document-path");
    return request(`${docUrl(path)}?currentDocument.exists=false`, { method: "PATCH", body: { fields: fields(value) } }); };
  const collectionIds = async path => { const values = []; let pageToken;
    do { const result = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", body: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } });
      check(Array.isArray(result.collectionIds || []), "invalid-collection-list"); values.push(...(result.collectionIds || [])); check(values.length <= 1000, "collection-budget"); pageToken = result.nextPageToken;
    } while (pageToken); return values; };
  const deleteDoc = async (doc, path) => { check(doc?.name === `${database}/documents/${path}` && doc.updateTime, "unsafe-document-delete");
    await request(`${docUrl(path)}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, { method: "DELETE", json: false }); };
  const removeTree = async (path, root, depth = 0) => { check((path === root || path.startsWith(`${root}/`)) && depth <= 12 && ++cleanupRecords <= 1000, "owned-tree-budget");
    for (const collection of await collectionIds(path)) { check(typeof collection === "string" && collection && !collection.includes("/") && ![".", ".."].includes(collection), "unsafe-collection-id"); let pageToken;
      do { const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true"); url.searchParams.set("mask.fieldPaths", "_smokeOnly"); if (pageToken) url.searchParams.set("pageToken", pageToken);
        const result = await request(url); for (const child of result.documents || []) { const prefix = `${database}/documents/${path}/${collection}/`;
          check(child.name?.startsWith(prefix) && !child.name.slice(prefix.length).includes("/"), "unsafe-child-document"); await removeTree(child.name.slice(`${database}/documents/`.length), root, depth + 1); } pageToken = result.nextPageToken;
      } while (pageToken); }
    const document = await getDoc(path); if (document) await deleteDoc(document, path); };
  const pass = async label => { report.cases.push(label); await persist(); };
  try {
    await persist(); token = await (dependencies.operatorToken || operatorToken)();
    step = "hosting-project-version";
    const config = await request(`${base}/__/firebase/init.json`); check(config.projectId === PROJECT && config.storageBucket === BUCKET && typeof config.apiKey === "string", "hosting-project-mismatch"); apiKey = config.apiKey;
    // Public worker is read with the same bounded transport, without parsing JSON.
    const worker = await (dependencies.fetchImpl || fetch)(`${base}/sw.js?preview-recovery=${runId}`, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    check(worker.status === 200 && (await bytes(worker, 512 * 1024)).toString("utf8").includes(`const CACHE_NAME = "workout-app-v${version}";`), "published-version-mismatch");
    await pass("Точный Production project и опубликованная версия подтверждены");
    step = "create-owned-client"; check(identity.email.split("@")[0].length > 32, "email-must-not-create-global-alias");
    check(await lookup() === null, "identity-already-exists"); identity.absenceVerified = true; identity.attempted = true; await persist();
    // Signup has no operator Authorization header; restore it even on failure.
    const operator = token; let signup;
    try { token = undefined; signup = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: "POST", body: { email: identity.email, password: identity.password, returnSecureToken: true } }); }
    finally { token = operator; }
    check(safeUid(signup.localId) && typeof signup.idToken === "string", "signup-response-invalid"); identity.uid = signup.localId;
    const claims = JSON.parse(Buffer.from(signup.idToken.split(".")[1], "base64url").toString("utf8"));
    check(claims.aud === PROJECT && claims.sub === identity.uid && claims.iss === `https://securetoken.google.com/${PROJECT}`, "token-project-mismatch");
    check(await lookup(), "created-identity-not-found"); identity.ownershipVerified = true; await persist();
    const now = new Date().toISOString(), trainer = `synthetic-preview-${runId}`, program = `preview-${runId}`;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk" }).format(new Date());
    await createDoc(`users/${identity.uid}`, { role: "client", active: true, name: "Проверка восстановления превью", email: identity.email,
      createdByUid: identity.marker, createdAt: now, accountRegistrationType: "open", accountAccessStatus: "active", firstSetupCompleted: true,
      trainerAssignmentState: "assigned", assignedTrainerId: trainer, trainerId: trainer, assignedProgramId: program, assignedProgramName: "Проверка обложки",
      assignedProgramAddedAt: now, assignedProgramUpdatedAt: now, workoutModePreference: { mode: "individual", remember: true, updatedAt: now } });
    await createDoc(`users/${identity.uid}/workouts/preview_recovery`, { name: "Проверка обложки", assignedBy: trainer, assignedProgramId: program,
      assignedProgramName: "Проверка обложки", assignedProgramAddedAt: now, assignedProgramUpdatedAt: now, assignedAt: now,
      assignedProgramLifecycleStatus: "active", status: "planned", order: 0, plannedDate: today, scheduledDate: today,
      exercises: [{ id: "preview_leg_curl", name: "Сгибание ног в тренажере", video: SOURCE, videoPosterTime: 2.1, rest: "90 сек", sets: [{ reps: 12, weight: 14 }] }] });
    await pass("Создан только один собственный клиент и одна synthetic тренировка");
    step = "actual-client-login";
    const { chromium } = await import("playwright"); browser = await chromium.launch({ timeout: 20000 });
    const context = await browser.newContext({ viewport: { width: 402, height: 760 }, timezoneId: "Europe/Minsk", serviceWorkers: "block" });
    context.setDefaultTimeout(20000); context.setDefaultNavigationTimeout(45000); page = await context.newPage();
    overallTimer = setTimeout(() => { report.deadlineExceeded = true; void browser?.close().catch(() => {}); }, Math.max(1, deadline - Date.now()));
    const network = { browserRequests: 0, posterGets: 0, posterAborts: 0, videoGets: 0, unexpectedStorage: 0, videoBytes: 0 }, errors = [];
    report.network = network;
    const storageKind = value => { try { const url = new URL(value); if (!["storage.googleapis.com", `${BUCKET}.storage.googleapis.com`].includes(url.hostname)) return "other";
      const path = decodeURIComponent(url.pathname).replace(url.hostname === "storage.googleapis.com" ? `/${BUCKET}/` : /^\//, "");
      return path === POSTER ? "poster" : path === VIDEO ? "video" : "unexpected";
    } catch { return "unexpected"; } };
    await page.route("**/*", async route => { const req = route.request(); if (++network.browserRequests > 500 || Date.now() >= deadline) { report.deadlineExceeded = true; return route.abort(); }
      const kind = storageKind(req.url()); if (kind === "unexpected") { network.unexpectedStorage++; return route.abort(); }
      if (req.method() === "GET" && kind === "poster") { network.posterGets++; if (!network.posterAborts) { network.posterAborts++; return route.abort("failed"); } }
      if (req.method() === "GET" && kind === "video") network.videoGets++;
      return route.continue(); });
    page.on("requestfinished", req => { if (storageKind(req.url()) === "video") void req.sizes().then(size => { network.videoBytes += size.responseBodySize;
      if (network.videoBytes > 60 * 1024 * 1024) { report.mediaBudgetExceeded = true; void browser?.close().catch(() => {}); } }).catch(() => {}); });
    page.on("pageerror", () => errors.push("page-runtime-error"));
    await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("https://apis.google.com/js/api.js*", route => route.abort("failed"));
    await page.route(`https://${PROJECT}.firebaseapp.com/__/auth/**`, route => route.abort("failed"));
    await page.goto(`${base}/?preview-recovery=${runId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Email или логин", exact: true }).click({ timeout: 45000 });
    await page.getByLabel("Email или логин", { exact: true }).fill(identity.email); await page.getByLabel("Пароль", { exact: true }).fill(identity.password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await page.getByTestId("client-nav-workouts").waitFor({ state: "visible", timeout: 45000 }); await page.getByTestId("client-nav-workouts").click();
    await page.getByTestId("workout-start-button").click();
    const readiness = page.getByTestId("workout-readiness-dialog"); await readiness.waitFor({ state: "visible" });
    await readiness.locator('[data-workout-readiness-option="good"]').click(); await readiness.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-workout-stage="warmup"], [data-testid="workout-exercise-video-frame"]'));
    if (await page.locator('[data-workout-stage="warmup"]').isVisible()) await page.getByRole("button", { name: "Начать тренировку", exact: true }).click();
    step = "automatic-poster-recovery";
    const frame = page.getByTestId("workout-exercise-video-frame"), video = frame.locator("video"), poster = frame.locator("img[data-video-poster]");
    // Intentionally NO retry button click: signed-image fallback must recover itself.
    await poster.waitFor({ state: "visible", timeout: 45000 });
    await page.waitForFunction(() => { const image = document.querySelector('[data-testid="workout-exercise-video-frame"] img[data-video-poster]'); return image?.complete && image.naturalWidth > 0; }, null, { timeout: 45000 });
    const decoded = await poster.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
    check(network.posterAborts === 1 && network.posterGets >= 2 && network.videoGets === 0 && await video.getAttribute("preload") === "none", "poster-recovery-or-preplay-network-invalid");
    check(decoded.width === asset.width && decoded.height === asset.height, "decoded-poster-dimensions-mismatch");
    report.beforePlay = { ...network, ...decoded, preload: "none" };
    await artifact.screenshot(await frame.screenshot({ type: "png" })); report.frame = artifact.frame;
    await pass("Первый WebP GET прерван; реальная обложка декодирована автоматически, до Play нет MP4 GET");
    step = "native-play-from-zero";
    await video.evaluate(element => { window.__previewRecoveryPlaying = []; element.addEventListener("playing", () => window.__previewRecoveryPlaying.push(element.currentTime)); });
    await frame.getByRole("button", { name: "Воспроизвести видео упражнения", exact: true }).click();
    await page.waitForFunction(() => window.__previewRecoveryPlaying?.length > 0, null, { timeout: 45000 });
    const firstTime = await page.evaluate(() => window.__previewRecoveryPlaying[0]);
    check(Number.isFinite(firstTime) && firstTime >= 0 && firstTime < 1, "first-playback-not-from-zero");
    await video.evaluate(element => new Promise((resolve, reject) => { const start = element.currentTime, until = performance.now() + 10000;
      const timer = setInterval(() => { if (!element.paused && element.readyState >= 2 && element.currentTime >= start + .3) { clearInterval(timer); resolve(); }
        else if (performance.now() >= until) { clearInterval(timer); reject(new Error("playback-not-progressing")); } }, 75); }));
    report.firstPlayingTime = firstTime; check(network.videoGets > 0 && !errors.length && !network.unexpectedStorage && !report.deadlineExceeded && !report.mediaBudgetExceeded, "native-playback-invalid");
    await video.evaluate(element => element.pause()); await pass("Реальный MP4 начал играть с начала и время воспроизведения увеличивается");
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safePreviewRecoveryError(error); }
  finally {
    clearTimeout(overallTimer); cleaning = true;
    try { await browser?.close(); } catch { report.browserCloseFailed = true; report.failed = true; }
    const clean = async (key, operation) => { domainRequests = 0; try { report.cleanup[key] = await operation(); }
      catch (error) { report.cleanup[key] = false; (report.cleanup.failures ||= {})[key] = safePreviewRecoveryError(error); } };
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
  try { const { report, output } = await runPreviewRecoverySmoke(parsePreviewRecoveryArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ failed: report.failed, failedStep: report.failedStep || null, cases: report.cases.length, cleanupVerified: report.cleanupVerified, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safePreviewRecoveryError(error))); process.exitCode = 1; }
}
