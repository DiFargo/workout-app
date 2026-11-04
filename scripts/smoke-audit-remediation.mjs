// Opt-in synthetic identities only. Review this complete file before execution.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = ["tren-85720-staging", "tren-85720"];
const ROLES = ["trainer", "client", "admin"];
const WORKOUT_VIDEO = "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4";
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };

export function parseSmokeArgs(args, env = process.env) {
  const options = { ledger: false, templatePurpose: false, adminLibrary: false, workoutUi: false, exercisePreview: false, run: false };
  const seen = new Set();
  for (const arg of args) {
    const match = /^--(project|confirm-project|expected-version)=(.+)$/.exec(arg);
    const key = match ? match[1] : arg;
    if (seen.has(key)) fail("duplicate-argument");
    seen.add(key);
    if (match) options[{ project: "project", "confirm-project": "confirmProject", "expected-version": "version" }[key]] = match[2];
    else if (arg === "--run") options.run = true;
    else if (arg === "--ledger") options.ledger = true;
    else if (arg === "--template-purpose") options.templatePurpose = true;
    else if (arg === "--admin-library") options.adminLibrary = true;
    else if (arg === "--workout-ui") options.workoutUi = true;
    else if (arg === "--exercise-preview") options.exercisePreview = true;
    else fail("unknown-argument");
  }
  if (!options.run || !PROJECTS.includes(options.project)) fail("explicit-run-and-project-required");
  if ((options.project === "tren-85720" && options.confirmProject !== options.project) ||
    (options.confirmProject && options.confirmProject !== options.project)) fail("production-project-confirmation-required");
  if (options.version && !/^\d+\.\d+\.\d+$/.test(options.version)) fail("invalid-expected-version");
  if (options.exercisePreview && (!options.workoutUi || options.project !== "tren-85720-staging")) fail("preview-smoke-staging-workout-only");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"])
    if (env[key]) fail("cached-operator-and-live-project-only");
  return options;
}

export function makeSmokeIdentities(runId) {
  if (!/^[a-f0-9]{24}$/.test(runId)) fail("invalid-run-id");
  return ROLES.map(role => ({ role, email: `audit-remediation-${runId}-${role}@example.invalid`,
    label: `Synthetic audit ${role} ${runId.slice(0, 6)}`, alias: `ar${runId}`,
    marker: `audit-remediation:${runId}`, creationAttempted: false, absenceVerified: false }));
}

export function safeSmokeError(error) {
  return { code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "assertion-or-operation-failed",
    name: ["Error", "AssertionError", "TimeoutError", "AbortError", "FirebaseError"].includes(error?.name) ? error.name : "UnknownError" };
}

export async function verifyTemplatePurposeUi(page, expect) {
  await expect(page.locator(".trainerNextMobileHeader:visible .trainerNextMobileTitle")).toHaveText("Шаблоны программ");
  const purpose = page.getByRole("complementary", { name: "Шаблон — не план клиента", exact: true });
  await expect(purpose).toBeVisible();
  await expect(purpose.locator("p")).toHaveCSS("font-size", "16px");
  await expect(purpose.getByRole("heading", { name: "Шаблон — не план клиента", exact: true })).toHaveCSS("font-size", "18px");
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  const create = page.getByRole("button", { name: "Создать шаблон", exact: true });
  await expect(create).toBeVisible(); await noOverflow();
  await create.click();
  const dialog = page.getByRole("dialog", { name: "Создать общий шаблон", exact: true });
  await expect(dialog).toBeVisible(); await noOverflow();
  // Do not choose a format/import or save anything: only exercise the sheet.
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(create).toBeVisible(); await noOverflow();
}

export async function verifyAdminLibraryUi(page, expect) {
  for (const title of ["Базовые программы", "Базовые упражнения"]) {
    const nav = page.getByRole("navigation", { name: "Разделы админки", exact: true });
    const section = nav.getByRole("button", { name: title, exact: true });
    // Navigation only: never open an editor or trigger catalogue mutations.
    await section.click();
    await expect(page.getByTestId("route-loading")).toBeHidden();
    await expect(section).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
    await expect(page.getByTestId("admin-base-library")).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: title, exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
}

export async function verifyWorkoutUi(page, expect, previewTime = null) {
  let checkpoint = "start";
  const originalViewport = page.viewportSize();
  try {
  await page.getByTestId("workout-start-button").click();
  checkpoint = "readiness";
  const readiness = page.getByTestId("workout-readiness-dialog");
  await expect(readiness).toBeVisible();
  await readiness.locator('[data-workout-readiness-option="good"]').click();
  await readiness.getByRole("button", { name: "Продолжить", exact: true }).click();
  checkpoint = "warmup";
  const stage = page.getByTestId("workout-run-stage");
  await expect(stage).toHaveAttribute("data-workout-stage", "warmup");
  await page.getByRole("button", { name: "Начать тренировку", exact: true }).click();
  await expect(stage).toHaveAttribute("data-workout-stage", "exercise");
  checkpoint = "geometry";
  await page.setViewportSize({ width: 338, height: 640 });

  const frame = page.getByTestId("workout-exercise-video-frame");
  const video = frame.locator("video");
  const rows = page.getByTestId("workout-exercise-set-row");
  await expect(frame).toBeVisible();
  checkpoint = "video-node";
  await expect(video).toHaveCount(1);
  checkpoint = "single-row";
  await expect(rows).toHaveCount(1);
  checkpoint = "primary-action";
  const primary = page.getByTestId("workout-primary-action");
  await expect(primary).toHaveAccessibleName("Подход выполнен");
  checkpoint = "primary-gradient";
  assert.ok(await primary.evaluate(node => getComputedStyle(node).backgroundImage.startsWith("linear-gradient(")), "The main workout action must use the app gradient");
  checkpoint = "first-set";
  const firstPicker = page.getByRole("button", { name: /^Все подходы, выбран подход 1 из \d+$/ });
  await expect(firstPicker).toBeVisible();
  checkpoint = "square";
  const geometry = await frame.boundingBox();
  assert.ok(geometry && geometry.width > 100 && Math.abs(geometry.width - geometry.height) <= 1, "Workout video must have a square frame");
  const plan = await page.getByTestId("workout-plan-card").boundingBox();
  const initialRow = await rows.boundingBox();
  const initialDock = await page.locator('[data-css-module-scope="workout-stage-action-panel"]').boundingBox();
  const deckBox = await stage.boundingBox();
  assert.ok(plan && geometry.width <= plan.width + 1 && geometry.width / plan.width >= 0.72,
    "The square video remains prominent in a short Telegram viewport");
  assert.ok(initialRow && initialDock && deckBox && geometry.y >= deckBox.y - 1 && geometry.y + geometry.height <= initialRow.y &&
    initialRow.y + initialRow.height <= initialDock.y - 8, "The whole video and selected set must be visible together before scrolling");
  assert.equal(await stage.evaluate(node => node.scrollHeight - node.clientHeight <= 1 && node.scrollTop === 0), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);

  // Only decoder/playback booleans cross the browser boundary. Never read or
  // persist the signed source URL, response body, browser state or user data.
  checkpoint = "decode";
  await expect.poll(() => video.evaluate(node => node.readyState >= 2 && node.videoWidth > 0 && node.videoHeight > 0 && !node.error))
    .toBe(true);
  if (previewTime !== null) {
    checkpoint = "preview-frame";
    await expect.poll(() => video.evaluate((node, time) => node.paused && Math.abs(node.currentTime - time) < .12, previewTime)).toBe(true);
  }
  await frame.getByRole("button", { name: "Воспроизвести видео упражнения", exact: true }).click();
  if (previewTime !== null) {
    checkpoint = "preview-start";
    await expect.poll(() => video.evaluate(node => !node.paused && node.currentTime < .9)).toBe(true);
  }
  checkpoint = "playback";
  await expect.poll(() => video.evaluate(node => !node.paused && node.currentTime > 0 && !node.error)).toBe(true);
  const originalVideo = await video.elementHandle();
  assert.ok(originalVideo);
  checkpoint = "selection";
  try {
    await primary.click();
    await expect(page.getByTestId("workout-rest-timer-expanded")).toBeVisible();
    const restNext = page.getByTestId("workout-rest-timer-completion-action");
    await expect(restNext).toHaveAccessibleName("Следующий подход");
    await expect(restNext).toHaveAccessibleDescription("С пропуском отдыха");
    await delay(450);
    await restNext.click();
    await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
    await expect(rows).toHaveCount(1);
    const picker = page.getByRole("button", { name: /^Все подходы, выбран подход 2 из \d+$/ });
    await expect(picker).toBeVisible();
    await expect(primary).toHaveAccessibleName("Подход выполнен");
    await expect(page.getByTestId("workout-rest-timer-start")).toHaveAttribute("aria-label", "Запустить таймер отдыха");
    await picker.click();
    await page.getByRole("button", { name: "Перейти к подходу 1", exact: true }).click();
    await page.getByRole("button", { name: "Подход 1 выполнен, действия", exact: true }).click();
    await expect(firstPicker).toHaveAccessibleDescription(/^Выполнено 1 из \d+$/);
    await page.getByRole("button", { name: "Снять отметку выполнения подхода 1", exact: true }).click();
    await expect(primary).toHaveAccessibleName("Подход выполнен");
    await expect(firstPicker).toHaveAccessibleDescription(/^Выполнено 0 из \d+$/);
    assert.equal(await page.evaluate(node => document.querySelector('[data-testid="workout-exercise-video-frame"] video') === node, originalVideo), true);
    assert.equal(await originalVideo.evaluate(node => !node.paused && node.currentTime > 0 && !node.error), true);
  } finally {
    await originalVideo.dispose();
  }
  checkpoint = "reachable-controls";
  await stage.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const row = await rows.boundingBox();
  const dock = await page.locator('[data-css-module-scope="workout-stage-action-panel"]').boundingBox();
  assert.ok(row && dock && row.y + row.height <= dock.y - 8 && dock.y + dock.height <= 641,
    "The selected set must scroll above the fixed controls");
  checkpoint = "exit";
  await page.getByRole("button", { name: "Выйти из тренировки", exact: true }).click();
  const exit = page.getByRole("dialog", { name: "Выход из тренировки", exact: true });
  await expect(exit).toBeVisible();
  await exit.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
  await expect(stage).toHaveCount(0);
  } catch { fail(`workout-ui-${checkpoint}-failed`); }
  finally { if (originalViewport) await page.setViewportSize(originalViewport); }
}

const encode = value => value === null ? { nullValue: null } : Array.isArray(value)
  ? { arrayValue: { values: value.map(encode) } } : typeof value === "object"
    ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
      : typeof value === "number" ? Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encode(entry)]));
const stringField = (document, name) => document?.fields?.[name]?.stringValue;
const safeUid = uid => typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);

async function operatorToken(project) {
  try {
    const require = createRequire(import.meta.url);
    const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
    if (!account) fail("cached-operator-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
    if (typeof token !== "string" || !token) fail("cached-operator-unavailable");
    return token;
  } catch { fail("cached-operator-unavailable"); }
}

export async function runAuditSmoke(options) {
  if (options?.run !== true || !PROJECTS.includes(options.project) ||
    (options.project === "tren-85720" && options.confirmProject !== options.project)) fail("explicit-run-and-project-required");
  if (options.exercisePreview && (!options.workoutUi || options.project !== "tren-85720-staging")) fail("preview-smoke-staging-workout-only");
  const packageVersion = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  const version = options.version || packageVersion;
  assert.equal(version, packageVersion, "Expected local release version mismatch");
  const project = options.project, base = `https://${project}.web.app`;
  const runId = randomBytes(12).toString("hex");
  const identities = makeSmokeIdentities(runId); // Registered before any signup/ambiguous response.
  const [trainer, client, admin] = identities;
  const unknownAlias = `az${runId}`;
  const database = `projects/${project}/databases/(default)`;
  const documents = `https://firestore.googleapis.com/v1/${database}/documents`;
  const authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:`;
  const output = resolve(ROOT, `artifacts/remediation-${version}/live-smoke-${project}-${runId}.json`);
  await mkdir(dirname(output), { recursive: true });
  const artifact = await open(output, "wx");
  const report = { schemaVersion: 1, project, version, runId, startedAt: new Date().toISOString(), steps: [], cases: [], cleanup: [],
    ledgerRequested: options.ledger, templatePurposeRequested: options.templatePurpose === true,
    adminLibraryRequested: options.adminLibrary === true, workoutUiRequested: options.workoutUi === true,
    exercisePreviewRequested: options.exercisePreview === true, containsPII: false, limits: [
      "Only three random owned synthetic accounts are modified; no real-user operations, AI calls, Telegram messages, reset-email delivery or IAM/API changes are attempted.",
      "The deployed app and Firebase are real. Only external Telegram SDK download is blocked. Native Telegram host behavior is not covered.",
      "Administrator navigation may read the existing directory in memory. No screenshots, traces, storageState, record bodies, credentials or raw provider errors are saved.",
      "Shared public peer/global alias rate-limit buckets are retained; only owned UID and unique synthetic-alias principal buckets are removed.",
      "Cleanup absence is bounded evidence at the recorded time, not a guarantee against a much later duplicate event. Optional ledger smoke requires the completed migration.",
      "Private photo upload/token revocation, paid-provider calls and a complete product checklist are not covered by this script.",
      "При --workout-ui проверяются только собственная тестовая тренировка, квадратное видео с реальным декодированием, отметка первого подхода, отдельный переход ко второму и отмена первой отметки. История и занятия не сохраняются; локальный черновик удаляется вместе с изолированным BrowserContext.",
      "--exercise-preview разрешён только на staging вместе с --workout-ui: создаётся одна заранее зарегистрированная собственная карточка, проверяются API и выбранный кадр; карточка удаляется с проверкой ownerUid и отсутствия."
    ] };
  let currentStep = "initialize", token, apiKey, browser, clientPage;
  const previewCardId = `preview-${runId}`;
  let previewCardAbsenceVerified = false, previewCard = null;
  const runtimeDiagnostics = [];
  let requestCount = 0, cleanupMode = false, cleanupDocs = 0;
  const mainDeadline = Date.now() + 12 * 60 * 1000;
  const save = async () => {
    const text = `${JSON.stringify(report, null, 2)}\n`;
    await artifact.write(text, 0, "utf8"); await artifact.truncate(Buffer.byteLength(text));
  };
  const step = async (name, operation) => {
    if (!cleanupMode && Date.now() > mainDeadline) fail("main-budget-exceeded");
    currentStep = name; report.steps.push({ name, startedAt: new Date().toISOString() });
    return operation();
  };
  const pass = name => { report.cases.push({ name, passed: true }); console.log(`passed: ${name}`); };
  async function request(url, { method = "GET", body, bearer, allowMissing = false } = {}) {
    if (++requestCount > (cleanupMode ? 800 : 400)) fail("request-budget-exceeded");
    let response;
    try {
      response = await fetch(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
        headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (allowMissing && response.status === 404) { await response.body?.cancel(); return { status: 404, data: null }; }
      if (!response.ok) { await response.body?.cancel(); fail(`http-${response.status}`); }
      if (method === "DELETE" || response.status === 204) { await response.body?.cancel(); return { status: response.status, data: null }; }
      const text = await response.text();
      if (Buffer.byteLength(text) > 3 * 1024 * 1024) fail("response-too-large");
      return { status: response.status, data: JSON.parse(text) };
    } catch (error) { if (error?.smokeCode) throw error; fail("transport-or-response-error"); }
  }
  const authCall = (method, body) => request(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`, { method: "POST", body });
  const adminCall = (method, body) => request(`${authAdmin}${method}`, { method: "POST", bearer: token, body });
  async function lookup(identity) {
    const { data } = await adminCall("lookup", { email: [identity.email] });
    const users = data.users || [];
    assert.ok(users.length <= 1, "Ambiguous owned account lookup");
    if (!users.length) return null;
    const user = users[0];
    assert.equal(user.email, identity.email, "Owned email mismatch");
    assert.ok(safeUid(user.localId), "Invalid synthetic UID");
    if (identity.uid) assert.equal(user.localId, identity.uid, "Owned UID mismatch");
    return user;
  }
  const documentUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = path => request(documentUrl(path), { bearer: token, allowMissing: true }).then(result => result.data);
  const put = (path, data, exists = false) => request(`${documentUrl(path)}?currentDocument.exists=${exists}`, {
    method: "PATCH", bearer: token, body: { fields: fields(data) }
  });
  async function patch(path, data, updateTime) {
    const url = new URL(documentUrl(path));
    Object.keys(data).forEach(key => url.searchParams.append("updateMask.fieldPaths", key));
    url.searchParams.set("currentDocument.updateTime", updateTime);
    return request(url, { method: "PATCH", bearer: token, body: { fields: fields(data) } });
  }
  async function ownQuery(collection, principal) {
    const { data } = await request(`${documents}:runQuery`, { method: "POST", bearer: token, body: { structuredQuery: {
      from: [{ collectionId: collection }], select: { fields: [{ fieldPath: "uid" }] },
      where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: principal } } }, limit: 101
    } } });
    const matches = data.filter(row => row.document).map(row => row.document);
    assert.ok(matches.length <= 100, "Owned cleanup query exceeded bound");
    for (const doc of matches) {
      assert.equal(stringField(doc, "uid"), principal);
      assert.ok(doc.name.startsWith(`${database}/documents/${collection}/`));
      assert.equal(doc.name.slice(`${database}/documents/${collection}/`.length).includes("/"), false);
    }
    return matches;
  }
  async function deleteDoc(document) {
    const url = new URL(`https://firestore.googleapis.com/v1/${document.name.split("/").map(encodeURIComponent).join("/")}`);
    if (document.updateTime) url.searchParams.set("currentDocument.updateTime", document.updateTime);
    return request(url, { method: "DELETE", bearer: token, allowMissing: true });
  }
  async function removeTree(path, rootPath, depth = 0) {
    assert.ok(path === rootPath || path.startsWith(rootPath + "/"));
    if (depth > 12 || ++cleanupDocs > 500) fail("owned-subtree-cleanup-limit");
    const { data: collections } = await request(`${documentUrl(path)}:listCollectionIds`, { method: "POST", bearer: token, body: { pageSize: 100 } });
    assert.ok(!collections.nextPageToken, "Owned subtree collection limit");
    for (const collection of collections.collectionIds || []) {
      assert.ok(typeof collection === "string" && collection && !collection.includes("/") && ![".", ".."].includes(collection));
      let pageToken;
      do {
        const url = new URL(documentUrl(`${path}/${collection}`));
        url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true");
        url.searchParams.set("mask.fieldPaths", "_smokeProjectionOnly");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const { data } = await request(url, { bearer: token });
        for (const child of data.documents || []) {
          const prefix = `${database}/documents/`;
          assert.ok(child.name.startsWith(prefix));
          await removeTree(child.name.slice(prefix.length), rootPath, depth + 1);
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
    }
    const existing = await getDoc(path);
    if (existing) await deleteDoc(existing);
  }
  async function loginPage(identity) {
    const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
    context.setDefaultTimeout(40000); context.setDefaultNavigationTimeout(45000);
    const page = await context.newPage(), pageErrors = [];
    if (options.workoutUi) {
      page.on("response", response => {
        const path = new URL(response.url()).pathname;
        if (["/api/client-exercise-media", "/api/exercise-video-access"].includes(path)) {
          (report.previewMediaRequests ||= []).push({ role: identity.role, kind: path.split("/").at(-1), status: response.status() });
        }
      });
      page.on("requestfailed", request => {
        const path = new URL(request.url()).pathname;
        if (["/api/client-exercise-media", "/api/exercise-video-access"].includes(path)) {
          (report.previewMediaRequests ||= []).push({ role: identity.role, kind: path.split("/").at(-1), transportFailed: true });
        }
      });
    }
    let mainNavigations = 0;
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) mainNavigations++; });
    page.on("pageerror", error => pageErrors.push(safeSmokeError(error).name));
    page.on("console", async message => {
      if (!message.text().startsWith("App runtime error:") || runtimeDiagnostics.length >= 5) return;
      try {
        const error = await message.args()[1]?.evaluate(value => ({ name: value?.name, message: value?.message }));
        const code = /^([A-Za-z_$][\w$.]{0,80}) is (not defined|not a function)$/.exec(error?.message || "");
        runtimeDiagnostics.push({ role: identity.role, name: ["TypeError", "ReferenceError", "Error"].includes(error?.name) ? error.name : "UnknownError",
          ...(code ? { expression: code[1], condition: code[2] } : {}) });
      } catch { runtimeDiagnostics.push({ role: identity.role, unavailable: true }); }
    });
    await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await step(`${identity.role}: open deployed app`, () => page.goto(`${base}/?audit-smoke=${runId}`, { waitUntil: "domcontentloaded" }));
    await step(`${identity.role}: select password method`, () => page.getByRole("button", { name: "У меня есть логин и пароль", exact: true })
      .or(page.locator("summary").filter({ hasText: "У меня есть логин и пароль" })).click());
    const form = page.locator("form").filter({ has: page.getByLabel("Логин или email", { exact: true }) });
    return { context, page, form, pageErrors, navigationCount: () => mainNavigations };
  }
  const assertMobile = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  async function passwordLogin(identity) {
    const view = await loginPage(identity);
    await step(`${identity.role}: fill password credentials`, async () => {
      await view.form.getByLabel("Логин или email", { exact: true }).fill(identity.email);
      await view.form.getByLabel("Пароль", { exact: true }).fill(identity.password);
      await view.form.getByRole("button", { name: "Войти", exact: true }).click();
    });
    return view;
  }
  async function waitUsage(expected) {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const profile = await getDoc(`users/${client.uid}`);
      const value = profile?.fields?.subscription?.mapValue?.fields?.usedSessions;
      if (Number(value?.integerValue ?? value?.doubleValue) === expected) return;
      await delay(2500);
    }
    fail("ledger-observation-timeout");
  }
  try {
    await save();
    token = await step("cached operator authentication", () => operatorToken(project));
    const config = (await step("exact Hosting Firebase config", () => request(`${base}/__/firebase/init.json`))).data;
    assert.equal(config.projectId, project);
    assert.ok(typeof config.apiKey === "string" && config.apiKey);
    apiKey = config.apiKey;
    const worker = await step("exact live service worker version", () => fetch(`${base}/sw.js?audit=${runId}`, { cache: "no-store", signal: AbortSignal.timeout(20000) }));
    assert.equal(worker.status, 200);
    assert.ok((await worker.text()).includes(`const CACHE_NAME = "workout-app-v${version}";`));
    pass("Exact project and published service-worker version");
    for (const identity of identities) {
      assert.equal(await step(`${identity.role}: exact random account absence`, () => lookup(identity)), null);
      identity.absenceVerified = true;
      identity.password = randomBytes(30).toString("base64url");
      identity.creationAttempted = true;
      const { data } = await step(`${identity.role}: signup one synthetic identity`, () => authCall("signUp", {
        email: identity.email, password: identity.password, returnSecureToken: true
      }));
      assert.ok(safeUid(data.localId)); identity.uid = data.localId; identity.idToken = data.idToken;
      assert.ok(await step(`${identity.role}: verify synthetic ownership`, () => lookup(identity)));
    }
    const now = new Date().toISOString();
    for (const identity of identities) await step(`${identity.role}: create marked profile`, () => put(`users/${identity.uid}`, {
      role: identity.role, active: true, name: identity.label, email: identity.email, firstSetupCompleted: true,
      aiNutritionProfile: { weight: "72", height: "174", age: "30", sex: "male", activity: "medium", goal: "recomp" },
      createdByUid: identity.marker, createdAt: now,
      ...(identity.role === "client" ? { loginLower: client.alias, accountProfile: { login: client.alias, email: client.email },
        accountRegistrationType: "open", accountAccessStatus: "active", trainerAssignmentState: "assigned",
        trainerId: trainer.uid, assignedTrainerId: trainer.uid, coachId: trainer.uid,
        assignedProgramId: `audit-${runId}`, assignedProgramUpdatedAt: now, assignedProgramName: "Synthetic audit program",
        workoutModePreference: { mode: "individual", remember: true, updatedAt: now } } : {}),
      ...(identity.role === "admin" ? { adminClaimVersion: runId } : {})
    }));
    await step("client: create exact owned alias", () => put(`loginAliases/${client.alias}`, { uid: client.uid, email: client.email }));
    await step("admin: set claims on owned synthetic identity only", () => adminCall("update", { localId: admin.uid,
      customAttributes: JSON.stringify({ admin: true, adminClaimVersion: runId }) }));
    const refreshed = (await step("admin: verify refreshed matching claim", () => authCall("signInWithPassword", {
      email: admin.email, password: admin.password, returnSecureToken: true
    }))).data;
    const claims = JSON.parse(Buffer.from(refreshed.idToken.split(".")[1], "base64url"));
    assert.equal(claims.aud, project); assert.equal(claims.sub, admin.uid);
    assert.equal(claims.admin, true); assert.equal(claims.adminClaimVersion, runId);
    pass("Owned administrator receives matching current claim version");
    if (options.exercisePreview === true) {
      await step("Превью: исходное отсутствие собственной тестовой карточки", async () => {
        assert.equal(await getDoc(`trainerExerciseCards/${previewCardId}`), null);
        previewCardAbsenceVerified = true;
      });
      await step("Превью: реальное API сохраняет выбранный кадр только своей карточки", async () => {
        const { data } = await request(`${base}/api/trainer-exercise-cards`, { method: "POST", bearer: trainer.idToken,
          body: { action: "create", creationId: previewCardId, patch: { name: "Synthetic squat", video: WORKOUT_VIDEO, videoPosterTime: 1.2 } } });
        assert.equal(data.card.id, previewCardId); assert.equal(data.card.ownerUid, trainer.uid);
        assert.equal(data.card.videoPosterTime, 1.2); previewCard = data.card;
        const saved = await getDoc(`trainerExerciseCards/${previewCardId}`);
        assert.equal(stringField(saved, "ownerUid"), trainer.uid);
        assert.equal(Number(saved.fields.videoPosterTime.doubleValue ?? saved.fields.videoPosterTime.integerValue), 1.2);
      });
    }
    const workoutDay = new Date(now);
    const workoutDayKey = `${workoutDay.getFullYear()}-${String(workoutDay.getMonth() + 1).padStart(2, "0")}-${String(workoutDay.getDate()).padStart(2, "0")}`;
    await step("client: seed one owned workout day", () => put(`users/${client.uid}/workouts/audit-day`, {
      name: "Synthetic audit workout", source: "trainer", order: 0, status: "planned", assignedBy: trainer.uid,
      assignedProgramId: `audit-${runId}`, assignedProgramUpdatedAt: now, assignedProgramLifecycleStatus: "active",
      ...(options.workoutUi === true ? { scheduledDate: workoutDayKey, plannedDate: workoutDayKey } : {}),
      exercises: [{ id: "synthetic-exercise", name: "Synthetic squat", sets: 2, reps: "10", weight: "0", rest: 30,
        ...(previewCard ? { exerciseCardId: previewCardId, exerciseCardOwnerUid: trainer.uid } : {}),
        ...(options.workoutUi === true ? { video: WORKOUT_VIDEO } : {}) }]
    }));
    if (previewCard) {
      await step("Превью: клиент получает кадр через действующее API назначенного тренера", async () => {
        const { data } = await request(`${base}/api/client-exercise-media`, { method: "POST", bearer: client.idToken, body: { clientId: client.uid } });
        const media = data.media.find(item => item.workoutId === "audit-day" && item.exerciseId === "synthetic-exercise");
        assert.equal(media?.card?.id, previewCardId); assert.equal(media.card.videoPosterTime, 1.2);
      });
      pass("Превью: реальная запись API и выдача выбранного кадра назначенному клиенту");
    }
    const { chromium, expect: baseExpect } = await step("load browser runtime", () => import("@playwright/test"));
    const expect = baseExpect.configure({ timeout: 40000 });
    browser = await step("launch isolated Chromium", () => chromium.launch({ headless: true }));
    const view = await loginPage(client); clientPage = view.page;
    for (const [kind, alias] of [["known-alias", client.alias], ["unknown-alias", unknownAlias]]) {
      await step(`client: ${kind} wrong-password uniform error`, async () => {
        await view.form.getByLabel("Логин или email", { exact: true }).fill(alias);
        await view.form.getByLabel("Пароль", { exact: true }).fill("synthetic-wrong-password-not-the-secret");
        const pending = view.page.waitForResponse(response => response.url() === `${base}/api/auth/resolve-login` && response.request().method() === "POST")
          .then(response => ({ response }), () => ({ failed: true }));
        await view.form.getByRole("button", { name: "Войти", exact: true }).click();
        const result = await pending; assert.ok(result.response);
        const body = await result.response.json();
        assert.equal(result.response.status(), 401);
        assert.deepEqual(body, { ok: false, error: "auth/invalid-credential" });
      });
    }
    pass("Known and unknown aliases return the same non-disclosing credential error");
    await step("client: real alias custom-token login and exchange", async () => {
      await view.form.getByLabel("Логин или email", { exact: true }).fill(client.alias);
      await view.form.getByLabel("Пароль", { exact: true }).fill(client.password);
      const aliasResponse = view.page.waitForResponse(response => response.url() === `${base}/api/auth/resolve-login` && response.request().method() === "POST")
        .then(response => ({ response }), () => ({ failed: true }));
      const tokenResponse = view.page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.hostname === "identitytoolkit.googleapis.com" && url.pathname.endsWith("accounts:signInWithCustomToken");
      }).then(response => ({ response }), () => ({ failed: true }));
      await view.form.getByRole("button", { name: "Войти", exact: true }).click();
      const aliasResult = await aliasResponse; assert.ok(aliasResult.response);
      const body = await aliasResult.response.json();
      assert.equal(aliasResult.response.status(), 200); assert.equal(body.ok, true);
      assert.deepEqual(Object.keys(body).sort(), ["customToken", "ok"]);
      assert.ok(typeof body.customToken === "string" && body.customToken);
      const exchange = await tokenResponse; assert.ok(exchange.response);
      assert.equal(exchange.response.status(), 200);
      const session = await exchange.response.json();
      const decoded = JSON.parse(Buffer.from(session.idToken.split(".")[1], "base64url"));
      assert.equal(decoded.sub, client.uid); assert.equal(decoded.aud, project);
      assert.equal(decoded.firebase?.sign_in_provider, "custom");
      client.idToken = session.idToken;
      await expect(view.page.getByTestId("client-bottom-nav")).toBeVisible();
    });
    pass("Actual alias UI receives only customToken and authenticates the same owned UID");
    for (const tab of ["workouts", "nutrition", "progress", "cabinet", "main"]) await step(`client: ${tab} navigation`, async () => {
      const navigation = view.page.locator(`[data-testid="client-nav-${tab}"]:visible`);
      await step(`client: ${tab} click`, () => navigation.click());
      await step(`client: ${tab} active navigation`, () => expect(navigation).toHaveAttribute("aria-current", "page"));
      // Suspense can retain the previous route hidden while its named loading
      // shell is visible. Sign off actual content, not that temporary dock.
      await step(`client: ${tab} content ready`, () => expect(view.page.getByTestId("route-loading")).toBeHidden());
      if (tab === "workouts") {
        await step("client: current owned workout loaded", () => expect(view.page.getByText("Synthetic audit workout", { exact: true }).first()).toBeVisible());
        if (options.workoutUi === true) {
          await step("Клиент: собственная тренировка, квадратное видео, отметка, отдельный переход и отмена подхода", () => verifyWorkoutUi(view.page, expect, previewCard ? 1.2 : null));
          assert.deepEqual(view.pageErrors, []);
          pass("Реальный вход в собственную тренировку: квадратное видео продолжает воспроизведение при отметке, отдельном переходе и отмене подхода; история и занятия не сохранялись");
        }
      }
      if (tab === "cabinet") await step("client: current release visible", () => expect(view.page.getByText(`v.${version}`, { exact: true }).first()).toBeVisible());
      await step(`client: ${tab} mobile bounds`, () => assertMobile(view.page));
    });
    assert.deepEqual(view.pageErrors, []); pass("Real mobile client navigation without app mocks or runtime errors");
    {
      const staff = await passwordLogin(trainer);
      try {
        const nav = staff.page.getByRole("navigation", { name: "Разделы тренера", exact: true });
        await step("trainer: assigned synthetic client navigation", async () => {
          await expect(nav).toBeVisible(); await nav.getByRole("button", { name: "Клиенты", exact: true }).click();
          await expect(staff.page.getByText(client.label, { exact: true }).first()).toBeVisible();
        });
        for (const section of ["workouts", "more", "dashboard"]) await step(`trainer: ${section} navigation`, async () => {
          const button = staff.page.locator(`[data-testid="trainer-nav-${section}"]:visible,[data-testid="trainer-desktop-nav-${section}"]:visible`);
          await button.click(); await expect(button).toHaveAttribute("aria-current", "page");
          if (section === "workouts" && options.templatePurpose === true) {
            await step("trainer: template purpose and creation-dialog open/close without creating", () => verifyTemplatePurposeUi(staff.page, expect));
            pass("Trainer template purpose, readable typography and creation-dialog open/close without creating a template");
          }
        });
        assert.deepEqual(staff.pageErrors, []); await assertMobile(staff.page);
        pass("Real mobile trainer navigation sees only the asserted owned assignment");
      } finally { await staff.context.close(); }
    }
    {
      const staff = await passwordLogin(admin);
      try {
        await step("admin: overview and users navigation", async () => {
          await expect(staff.page.getByTestId("admin-overview-sections")).toBeVisible();
          const nav = staff.page.getByRole("navigation", { name: "Разделы админки", exact: true });
          await expect(nav).toBeVisible(); await nav.getByRole("button", { name: "Пользователи и роли", exact: true }).click();
          await expect(staff.page.getByTestId("admin-users-workspace")).toBeVisible();
          await staff.page.getByTestId("admin-users-workspace").locator('input[type="search"]').fill(client.label);
          await expect(staff.page.getByText(client.label, { exact: true }).first()).toBeVisible();
        });
        assert.deepEqual(staff.pageErrors, []); await assertMobile(staff.page);
        pass("Real matching-claim administrator navigation and owned-client search");
        if (options.adminLibrary === true) {
          await step("admin: read-only lazy programs and exercises library navigation", () => verifyAdminLibraryUi(staff.page, expect));
          assert.deepEqual(staff.pageErrors, []);
          assert.deepEqual(runtimeDiagnostics, []);
          pass("Real matching-claim administrator opens both lazy library screens without editing or runtime errors");
        }
      } finally { await staff.context.close(); }
    }
    if (options.ledger) {
      const accounting = await step("ledger: require migrated active config", () => getDoc("serverConfig/subscriptionAccounting"));
      assert.equal(accounting?.fields?.schemaVersion?.integerValue, "1");
      assert.equal(accounting?.fields?.baselineReady?.booleanValue, true);
      assert.equal(accounting?.fields?.paused?.booleanValue, false);
      assert.ok(accounting?.fields?.cutoverTimestamp?.timestampValue || accounting?.fields?.cutoverTimestamp?.stringValue);
      const profile = await getDoc(`users/${client.uid}`), cycle = Date.now();
      await step("ledger: seed own subscription only", () => patch(`users/${client.uid}`, { subscription: {
        periodMode: "sessions", cycleId: `cycle_${cycle}`, cycleStartedAt: new Date(cycle).toISOString(),
        purchasedSessions: 5, usedSessions: 0, remainingSessions: 5
      } }, profile.updateTime));
      await step("ledger: create one owned immutable history generation", () => put(`users/${client.uid}/history/audit-ledger`, {
        date: new Date().toISOString().slice(0, 10), name: "Synthetic ledger smoke"
      }));
      await step("ledger: observe exactly one used session", () => waitUsage(1));
      const history = await getDoc(`users/${client.uid}/history/audit-ledger`);
      await step("ledger: delete own history generation", () => deleteDoc(history));
      await step("ledger: observe reversal to zero", () => waitUsage(0));
      pass("Live migrated ledger creates one charge and reverses its owned deletion");
    }
    await step("unassignment: revoke own synthetic membership without reload", async () => {
      const profile = await getDoc(`users/${client.uid}`);
      const navigationCount = view.navigationCount();
      await patch(`users/${client.uid}`, { trainerAssignmentState: "unassigned", accountAccessStatus: "awaiting_trainer",
        trainerId: "", assignedTrainerId: "", coachId: "" }, profile.updateTime);
      const pageUrl = clientPage.url();
      await expect(clientPage.getByRole("heading", { name: "Ждём назначения тренера", exact: true })).toBeVisible();
      await expect(clientPage.getByTestId("client-bottom-nav")).toHaveCount(0);
      assert.equal(clientPage.url(), pageUrl);
      assert.equal(view.navigationCount(), navigationCount, "Membership revocation must not reload the page");
      const own = await request(documentUrl(`users/${client.uid}`), { bearer: client.idToken });
      assert.equal(own.status, 200);
      for (const collection of ["history", "nutrition"]) {
        const url = new URL(documentUrl(`users/${client.uid}/${collection}`)); url.searchParams.set("pageSize", "1");
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${client.idToken}` }, signal: AbortSignal.timeout(20000)
        });
        assert.equal(response.status, 403); await response.body?.cancel();
      }
    });
    assert.deepEqual(view.pageErrors, []);
    pass("Same live session becomes pending; own root remains readable and private history/nutrition are denied");
  } catch (error) {
    report.failed = true; report.failedStep = currentStep; report.failure = safeSmokeError(error); process.exitCode = 1;
    report.runtimeDiagnostics = runtimeDiagnostics;
    if (clientPage && !clientPage.isClosed()) {
      // Boolean/test-id diagnostics only: never persist user text, documents,
      // provider errors, tokens, screenshots or browser storage.
      try { report.clientUiDiagnostics = await clientPage.evaluate(() => ({
        navigation: ["main", "workouts", "nutrition", "progress", "cabinet"].map(tab => ({ tab,
          count: document.querySelectorAll(`[data-testid="client-nav-${tab}"]`).length,
          active: [...document.querySelectorAll(`[data-testid="client-nav-${tab}"]`)].some(element => element.getAttribute("aria-current") === "page") })),
        planLoadStatePresent: Boolean(document.querySelector('[data-testid="workout-plan-load-state"]')),
        routeLoadingPresent: Boolean(document.querySelector('[data-testid="route-loading"]')),
        workoutListPresent: Boolean(document.querySelector('[data-testid="workout-list-header"]')),
        workoutStartPresent: Boolean(document.querySelector('[data-testid="workout-start-button"]')),
        syntheticWorkoutPresent: document.body.innerText.includes("Synthetic audit workout"),
        planLoadError: document.body.innerText.includes("Не удалось загрузить план"),
        startupError: document.body.innerText.includes("Не удалось запустить приложение"),
        interfaceError: document.body.innerText.includes("Экран не загрузился"),
        workoutStage: document.querySelector('[data-testid="workout-run-stage"]')?.getAttribute("data-workout-stage") || null,
        setRows: document.querySelectorAll('[data-testid="workout-exercise-set-row"]').length,
        videoNodes: document.querySelectorAll('[data-testid="workout-exercise-video-frame"] video').length,
        videoAccessError: Boolean(document.querySelector('[data-protected-video-error="true"]')),
        videoPlayback: (() => {
          const node = document.querySelector('[data-testid="workout-exercise-video-frame"] video');
          return node ? { hasSource: Boolean(node.getAttribute("src")), readyState: node.readyState, paused: node.paused, seeking: node.seeking,
            previewSelected: node.dataset.videoPreviewTime === "1.2", accessState: node.dataset.protectedVideoState || null,
            session: Number(node.dataset.videoSession),
            time: Number.isFinite(node.currentTime) ? node.currentTime : null,
            duration: Number.isFinite(node.duration) ? node.duration : null, errorCode: node.error?.code || null } : null;
        })(),
        videoFrameSize: (() => { const box = document.querySelector('[data-testid="workout-exercise-video-frame"]')?.getBoundingClientRect(); return box ? { width: box.width, height: box.height } : null; })()
      })); } catch { report.clientUiDiagnostics = { unavailable: true }; }
    }
  } finally {
    cleanupMode = true;
    try { await browser?.close(); } catch { report.browserCloseFailed = true; process.exitCode = 1; }
    clientPage = null;
    if (previewCardAbsenceVerified) {
      try {
        const card = await getDoc(`trainerExerciseCards/${previewCardId}`);
        if (card) { assert.equal(stringField(card, "ownerUid"), trainer.uid); await deleteDoc(card); }
        report.previewCardCleanupVerified = await getDoc(`trainerExerciseCards/${previewCardId}`) === null;
      } catch (error) { report.previewCardCleanupVerified = false; report.previewCardCleanupFailure = safeSmokeError(error); }
      if (!report.previewCardCleanupVerified) process.exitCode = 1;
    }
    for (const identity of identities) {
      const result = { role: identity.role, attempted: identity.creationAttempted, authAbsent: false, profileAbsent: false,
        ownedRatesAbsent: false, ledgerAbsent: false, aliasAbsent: identity.role !== "client" };
      try {
        if (!identity.creationAttempted || !identity.absenceVerified) { result.notCreated = true; result.cleaned = true; report.cleanup.push(result); continue; }
        const user = await lookup(identity);
        if (!identity.uid && user) identity.uid = user.localId;
        if (identity.uid) {
          const cleanup = async (key, operation) => {
            try { result[key] = await operation(); }
            catch (error) { result[key] = false; (result.failures ||= {})[key] = safeSmokeError(error); }
          };
          // Attempt each independently; Auth failure must not skip marked data
          // cleanup, and a profile/Storage-style failure must not skip Auth.
          await cleanup("authAbsent", async () => {
            if (user) await adminCall("delete", { localId: identity.uid });
            return await lookup(identity) === null;
          });
          await cleanup("profileAbsent", async () => {
            const ownRoot = `users/${identity.uid}`, profile = await getDoc(ownRoot);
            if (profile) assert.equal(stringField(profile, "createdByUid"), identity.marker, "Profile marker mismatch");
            await removeTree(ownRoot, ownRoot);
            const { data } = await request(`${documentUrl(ownRoot)}:listCollectionIds`, { method: "POST", bearer: token, body: { pageSize: 100 } });
            return await getDoc(ownRoot) === null && !data.nextPageToken && !(data.collectionIds || []).length;
          });
          await cleanup("ownedRatesAbsent", async () => {
            const principals = [identity.uid, ...(identity.role === "client" ? [`alias:${hash(client.alias)}`, `alias:${hash(unknownAlias)}`] : [])];
            for (const principal of principals) for (const doc of await ownQuery("securityRateLimits", principal)) await deleteDoc(doc);
            return (await Promise.all(principals.map(principal => ownQuery("securityRateLimits", principal)))).every(rows => rows.length === 0);
          });
          await cleanup("ledgerAbsent", async () => {
            for (const doc of await ownQuery("subscriptionUsageLedger", identity.uid)) await deleteDoc(doc);
            await delay(1500);
            return (await ownQuery("subscriptionUsageLedger", identity.uid)).length === 0;
          });
          if (identity.role === "client") await cleanup("aliasAbsent", async () => {
            const alias = await getDoc(`loginAliases/${identity.alias}`);
            if (alias) { assert.equal(stringField(alias, "uid"), identity.uid); await deleteDoc(alias); }
            return await getDoc(`loginAliases/${identity.alias}`) === null;
          });
        } else {
          result.authAbsent = user === null; result.profileAbsent = user === null;
          result.ownedRatesAbsent = user === null; result.ledgerAbsent = user === null; result.aliasAbsent = user === null;
        }
        result.cleaned = result.authAbsent && result.profileAbsent && result.ownedRatesAbsent && result.ledgerAbsent && result.aliasAbsent;
      } catch (error) { result.cleaned = false; result.failure = safeSmokeError(error); }
      if (!result.cleaned) process.exitCode = 1;
      report.cleanup.push(result);
    }
    report.cleanupVerified = report.cleanup.length === 3 && report.cleanup.every(result => result.cleaned) &&
      (!previewCardAbsenceVerified || report.previewCardCleanupVerified === true);
    report.finishedAt = new Date().toISOString(); report.requestCount = requestCount;
    await save(); await artifact.close(); token = undefined;
    console.log(JSON.stringify({ project, version, passedCases: report.cases.length, failed: report.failed === true,
      failedStep: report.failedStep || null, cleanupVerified: report.cleanupVerified, output: output.slice(ROOT.length + 1) }));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runAuditSmoke(parseSmokeArgs(process.argv.slice(2))); }
  catch (error) { console.error(JSON.stringify({ ok: false, ...safeSmokeError(error) })); process.exitCode = 1; }
}
