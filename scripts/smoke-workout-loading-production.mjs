import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { accountToken } from "./exercise-preview-batch.mjs";
import { encodeLegacyPreviewValue } from "./plan-legacy-exercise-preview-selection.mjs";

assert.ok(process.argv.includes("--run") && process.argv.includes("--project=tren-85720"), "Explicit authorized production run required");
const version = JSON.parse(await readFile("package.json", "utf8")).version;
assert.ok(["3.0.868", "3.0.869"].includes(version));
const project = "tren-85720", base = `https://${project}.web.app`, database = `projects/${project}/databases/(default)/documents`;
const apiKey = "AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg"; // Public web config, not a credential.
const operatorToken = await accountToken();
const report = { version, project, startedAt: new Date().toISOString(), cases: [], cleanup: {}, containsRealClientData: false };
const directory = `output/playwright/workout-loading-${version}`;
await mkdir(directory, { recursive: true });
let uid = "", idToken = "", browser, page, step = "initialization";
let mp4Requests = 0, posterRequests = 0;
const authRequest = (action, body) => fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
});
const dbRequest = (path, options = {}) => fetch(`https://firestore.googleapis.com/v1/${database}/${path}`, {
  ...options, headers: { Authorization: `Bearer ${operatorToken}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000)
});
const writeOwn = async (path, value) => {
  assert.ok(uid && path.startsWith(`users/${uid}`), "Synthetic owner only");
  const response = await dbRequest(path, { method: "PATCH", body: JSON.stringify({ fields: encodeLegacyPreviewValue(value).mapValue.fields }) });
  assert.equal(response.status, 200);
};
let deletedSyntheticDocuments = 0;
async function removeOwnTree(path) {
  assert.ok(uid && (path === `users/${uid}` || path.startsWith(`users/${uid}/`)) && path.split("/").length <= 16);
  const response = await dbRequest(path + ":listCollectionIds", { method: "POST", body: JSON.stringify({ pageSize: 100 }) });
  assert.equal(response.status, 200);
  const collections = await response.json(); assert.ok(!collections.nextPageToken);
  for (const collection of collections.collectionIds || []) {
    const listed = await dbRequest(`${path}/${collection}?pageSize=100`); assert.equal(listed.status, 200);
    const children = await listed.json(); assert.ok(!children.nextPageToken);
    for (const child of children.documents || []) await removeOwnTree(child.name.slice(database.length + 1));
  }
  assert.ok(++deletedSyntheticDocuments <= 200, "Bounded synthetic cleanup");
  assert.ok([200, 404].includes((await dbRequest(path, { method: "DELETE" })).status));
}
const api = (body, authenticated = true) => fetch(`${base}/api/exercise-video-access`, {
  method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${idToken}` } : {}) },
  body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
});
const pass = name => { report.cases.push({ name, passed: true }); console.log(JSON.stringify({ passed: name })); };
const wait = async (condition, message, timeout = 30000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await condition()) return; await new Promise(resolve => setTimeout(resolve, 75)); }
  throw new Error(message);
};
try {
  const manifest = JSON.parse(await readFile("output/playwright/exercise-preview-assets-3.0.868/manifest.json", "utf8"));
  const exerciseName = version === "3.0.869" ? "Сгибание ног в тренажере" : "Выпады с гантелями";
  const asset = manifest.assets.find(item => item.names.includes(exerciseName));
  assert.ok(asset);
  step = "deny-anonymous";
  assert.equal((await api({ source: asset.sourceRef, previewTime: asset.previewTime }, false)).status, 401);
  pass("Без авторизации защищённые обложки недоступны");
  step = "create-authorized-synthetic-identity";
  const email = `preview-smoke-${randomBytes(12).toString("hex")}@example.invalid`, password = randomBytes(30).toString("base64url");
  const signup = await authRequest("signUp", { email, password, returnSecureToken: true }), identity = await signup.json();
  assert.equal(signup.status, 200); assert.ok(identity.localId && identity.idToken);
  uid = identity.localId; idToken = identity.idToken;
  await writeFile(`${directory}/synthetic-identity-intent.json`, JSON.stringify({ version, uid, cleanupRequired: true }) + "\n");
  const profile = { role: "client", active: true, name: "Проверка превью", email, createdByUid: `preview-smoke-${version}`,
    accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer", firstSetupCompleted: true, createdAt: new Date().toISOString() };
  await writeOwn(`users/${uid}`, profile);
  step = "deny-pending";
  assert.equal((await api({ source: asset.sourceRef, previewTime: asset.previewTime })).status, 403);
  pass("Ожидающий назначения клиент не получает обложку");
  step = "activate-synthetic-fixture";
  const assignedAt = new Date().toISOString();
  await writeOwn(`users/${uid}`, { ...profile, accountAccessStatus: "active", trainerAssignmentState: "assigned", trainerId: "__preview_smoke_trainer__",
    assignedTrainerId: "__preview_smoke_trainer__", assignedProgramId: "preview_smoke_program", assignedProgramName: "Проверка обложки",
    assignedProgramAddedAt: assignedAt, assignedProgramUpdatedAt: assignedAt, assignedProgramAt: assignedAt,
    workoutModePreference: { mode: "individual", remember: true, updatedAt: assignedAt } });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk" }).format(new Date());
  await writeOwn(`users/${uid}/workouts/preview_smoke_workout`, { name: "Проверка обложки", assignedBy: "__preview_smoke_trainer__",
    assignedProgramId: "preview_smoke_program", assignedProgramName: "Проверка обложки", assignedProgramAddedAt: assignedAt,
    assignedProgramUpdatedAt: assignedAt, assignedAt, assignedProgramLifecycleStatus: "active", status: "planned", order: 0,
    plannedDate: today, scheduledDate: today, exercises: [{ id: "preview_smoke_exercise", name: exerciseName, video: asset.sourceRef,
      videoPosterTime: asset.previewTime, rest: "90 сек", sets: [{ reps: 12, weight: 14 }] }] });
  step = "signed-poster-access";
  const accessed = await api({ source: asset.sourceRef, previewTime: asset.previewTime }), access = await accessed.json();
  assert.equal(accessed.status, 200); assert.ok(access.posterUrl && access.url);
  const image = await fetch(access.posterUrl, { headers: { Origin: base }, signal: AbortSignal.timeout(20000) });
  report.posterCors = { status: image.status, allowOrigin: image.headers.get("access-control-allow-origin") };
  assert.equal(image.status, 200); assert.match(image.headers.get("content-type") || "", /^image\/webp/);
  assert.equal(createHash("md5").update(Buffer.from(await image.arrayBuffer())).digest("base64"), asset.md5Hash);
  const unsigned = new URL(access.posterUrl); unsigned.search = "";
  assert.ok([401, 403].includes((await fetch(unsigned, { method: "HEAD", signal: AbortSignal.timeout(20000) })).status));
  pass("Обложка подписана, совпадает с выбранным кадром и закрыта без подписи");
  step = "production-password-login";
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 402, height: 760 }, timezoneId: "Europe/Minsk", serviceWorkers: "block" });
  page = await context.newPage(); const errors = [];
  let posterResponseFinished = false;
  report.posterRequestFailures = [];
  page.on("requestfailed", request => {
    if (request.url().startsWith("https://storage.googleapis.com/") && request.url().includes("protected-exercise-previews")) {
      report.posterRequestFailures.push({ error: request.failure()?.errorText, type: request.resourceType() });
    }
  });
  page.on("response", response => {
    if (response.url().startsWith("https://storage.googleapis.com/") && response.url().includes("protected-exercise-previews")) {
      posterResponseFinished = response.ok();
    }
  });
  page.on("pageerror", error => errors.push(error.name));
  page.on("request", request => {
    const url = request.url();
    if (url.startsWith("https://storage.googleapis.com/") && url.includes("X-Goog-Signature=")) {
      if (url.includes("protected-exercise-previews")) posterRequests++; else mp4Requests++;
    }
  });
  await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  // This synthetic check uses only password auth, never popup/redirect login.
  // Isolate optional Google resolver transport just as the local UI fixtures do.
  await page.route("https://apis.google.com/js/api.js*", route => route.abort("failed"));
  await page.route("https://tren-85720.firebaseapp.com/__/auth/**", route => route.abort("failed"));
  await page.goto(`${base}/?verify=${version}-loading-smoke`, { waitUntil: "domcontentloaded", timeout: 45000 });
  step = "password-fields";
  await page.getByLabel("Email или логин", { exact: true }).fill(email, { timeout: 30000 });
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  step = "password-submit";
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  step = "password-workspace-ready";
  await page.getByTestId("client-nav-workouts").waitFor({ state: "visible", timeout: 40000 });
  step = "fresh-workout-plan";
  const started = Date.now();
  await page.getByTestId("client-nav-workouts").click();
  await page.getByTestId("workout-start-button").waitFor({ state: "visible", timeout: 15000 });
  report.firstWorkoutOpenMs = Date.now() - started;
  pass("Реальный клиент открывает проверенный актуальный план");
  step = "same-session-workout-reentry";
  await page.getByTestId("client-nav-main").click();
  await page.evaluate(() => { window.__blankWorkoutStates = 0; window.__loaderObserver = new MutationObserver(() => {
    if (document.querySelector('[data-testid="workout-plan-load-state"]')) window.__blankWorkoutStates++;
  }); window.__loaderObserver.observe(document.body, { subtree: true, childList: true }); });
  const reopened = Date.now(); await page.getByTestId("client-nav-workouts").click();
  await page.getByTestId("workout-start-button").waitFor({ state: "visible" });
  report.repeatWorkoutOpenMs = Date.now() - reopened;
  await page.waitForTimeout(1200);
  report.blankStatesOnReentry = await page.evaluate(() => { window.__loaderObserver.disconnect(); return window.__blankWorkoutStates; });
  assert.equal(report.blankStatesOnReentry, 0);
  pass("Повторный вход не скрывает подтверждённый план заглушкой");
  step = "real-poster-without-video-download";
  await page.getByTestId("workout-start-button").click();
  const readiness = page.getByTestId("workout-readiness-dialog");
  await readiness.waitFor({ state: "visible", timeout: 30000 });
  await readiness.locator('[data-workout-readiness-option="good"]').click();
  await readiness.getByRole("button", { name: "Продолжить", exact: true }).click();
  const warmup = page.locator('[data-workout-stage="warmup"]');
  const frame = page.getByTestId("workout-exercise-video-frame");
  await wait(async () => await warmup.isVisible().catch(() => false) || await frame.isVisible().catch(() => false), "Workout stage did not open");
  let exerciseOpenedAt;
  if (await warmup.isVisible()) {
    if (version === "3.0.869") await wait(() => posterResponseFinished, "Poster did not prefetch during warmup");
    exerciseOpenedAt = Date.now();
    await page.getByRole("button", { name: "Начать тренировку", exact: true }).click();
  }
  const video = frame.locator("video"), poster = frame.locator("img[data-video-poster]");
  await poster.waitFor({ state: "visible", timeout: 30000 });
  await wait(() => poster.evaluate(image => image.complete && image.naturalWidth > 0), "Poster did not decode");
  if (exerciseOpenedAt) report.posterRevealAfterWarmupMs = Date.now() - exerciseOpenedAt;
  if (version === "3.0.869") {
    assert.match(await poster.getAttribute("src"), /^blob:/);
    pass("Обложка подготовлена на разминке и показана из памяти сеанса");
  }
  await page.waitForTimeout(300);
  report.beforePlay = { mp4Requests, posterRequests, preload: await video.getAttribute("preload") };
  assert.equal(mp4Requests, 0); assert.equal(posterRequests, 1); assert.equal(await video.getAttribute("preload"), "none");
  await frame.screenshot({ path: `${directory}/production-poster-before-play.png` });
  pass("До Play загружена одна обложка и нет запросов MP4");
  step = "real-play-from-zero";
  await video.evaluate(element => { window.__firstPlayingTimes = []; element.addEventListener("playing", () => window.__firstPlayingTimes.push(element.currentTime)); });
  await frame.getByRole("button", { name: "Воспроизвести видео упражнения", exact: true }).click();
  await wait(() => page.evaluate(() => window.__firstPlayingTimes.length > 0), "Video did not start");
  report.firstPlayingTime = await page.evaluate(() => window.__firstPlayingTimes[0]);
  assert.ok(report.firstPlayingTime < .5); assert.ok(mp4Requests > 0);
  await video.evaluate(element => element.pause());
  assert.deepEqual(errors, []);
  pass("Play начинает реальный ролик с начала без ошибок интерфейса");
  report.failed = false;
} catch (error) {
  report.failed = true; report.failedStep = step; report.errorName = error.name;
  if (["Poster did not prefetch during warmup", "Poster did not decode", "Video did not start", "Workout stage did not open"].includes(error.message)) report.safeReason = error.message;
  report.beforePlay = { mp4Requests, posterRequests };
  if (page) report.uiState = await page.evaluate(() => ({
    headings: [...document.querySelectorAll("h1,h2")].map(node => node.textContent.trim()).slice(0, 10),
    alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent.trim()).slice(0, 5),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.getAttribute("data-testid") || node.getAttribute("aria-labelledby")).slice(0, 5),
    stages: [...document.querySelectorAll('[data-workout-stage]')].map(node => node.getAttribute("data-workout-stage")).slice(0, 5),
    buttons: [...document.querySelectorAll("button")].filter(node => node.getClientRects().length).map(node => node.textContent.trim()).slice(0, 20),
    splash: Boolean(document.querySelector('[aria-label="Загрузка приложения"]'))
  })).catch(() => null);
  console.error(JSON.stringify({ failedStep: step, errorName: error.name })); process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (uid) {
    try {
      await removeOwnTree(`users/${uid}`);
      const rate = createHash("sha256").update(`${uid}:exercise-video-access`).digest("hex");
      await dbRequest(`securityRateLimits/${rate}`, { method: "DELETE" });
      report.cleanup.firestore = (await dbRequest(`users/${uid}`)).status === 404 && (await dbRequest(`users/${uid}/workouts/preview_smoke_workout`)).status === 404
        && (await dbRequest(`securityRateLimits/${rate}`)).status === 404;
      const remaining = await dbRequest(`users/${uid}:listCollectionIds`, { method: "POST", body: JSON.stringify({ pageSize: 100 }) });
      report.cleanup.subcollectionsEmpty = remaining.status === 200 && !(await remaining.json()).collectionIds?.length;
    } catch { report.cleanup.firestore = false; }
    try {
      report.cleanup.authIdentity = (await authRequest("delete", { idToken })).status === 200;
      const lookup = await fetch("https://identitytoolkit.googleapis.com/v1/projects/tren-85720/accounts:lookup", {
        method: "POST", headers: { Authorization: `Bearer ${operatorToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ localId: [uid] }), signal: AbortSignal.timeout(20000)
      });
      report.cleanup.authIdentityVerified = lookup.status === 200 && !(await lookup.json()).users?.length;
    } catch { report.cleanup.authIdentity = false; }
    if (!Object.values(report.cleanup).every(Boolean)) { report.cleanup.needsAttention = true; report.temporaryUidForCleanup = uid; process.exitCode = 1; }
    else await writeFile(`${directory}/synthetic-identity-intent.json`, JSON.stringify({ version, cleanupRequired: false, verifiedAt: new Date().toISOString() }) + "\n");
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(`${directory}/production-smoke.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ failed: report.failed, failedStep: report.failedStep, cleanup: report.cleanup,
    firstWorkoutOpenMs: report.firstWorkoutOpenMs, repeatWorkoutOpenMs: report.repeatWorkoutOpenMs, beforePlay: report.beforePlay }));
}
