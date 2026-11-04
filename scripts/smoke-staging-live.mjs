// Explicitly invoked, synthetic-account live smoke. Never imports application fixtures.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, expect as baseExpect } from "@playwright/test";

const project = "tren-85720-staging";
const base = `https://${project}.web.app`;
if (!process.argv.includes("--run") || process.argv.some(arg => arg.startsWith("--project"))) {
  throw new Error("Explicit --run required after staging deploy; project override is prohibited.");
}
assert.equal(new URL(base).hostname, "tren-85720-staging.web.app");
const require = createRequire(import.meta.url);
const cliRoot = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
const { Client } = require(resolve(cliRoot, "apiv2.js"));
const account = getGlobalDefaultAccount();
if (!account) throw new Error("Firebase CLI operator sign-in required; no IAM changes are attempted.");
await requireAuth({ ...account, project }, true);
const firestore = new Client({ urlPrefix: "https://firestore.googleapis.com" });
const identityAdmin = new Client({ urlPrefix: "https://identitytoolkit.googleapis.com" });
const root = `/v1/projects/${project}/databases/(default)/documents`;
const report = { project, startedAt: new Date().toISOString(), cases: [], cleanup: [], limits: [
  "No Telegram messages, AI calls, real-user changes or production requests.",
  "This bounded navigation smoke does not replace manual workout completion, photo upload, reminders, collector/backup checks or the full checklist."
] };
const identities = [];
const expect = baseExpect.configure({ timeout: 40000 });
let apiKey;
let browser;
let currentCase = "staging preflight";
const safe = { skipLog: { reqBody: true, resBody: true } };
const pass = name => { report.cases.push({ name, passed: true }); console.log(`passed: ${name}`); };
const getJson = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, "Staging preflight fetch failed");
  return response.json();
};
const authRequest = async (method, body) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  assert.equal(response.status, 200, `Synthetic Auth ${method} failed (HTTP ${response.status})`);
  return data;
};
const encode = value => value === null ? { nullValue: null } : Array.isArray(value)
  ? { arrayValue: { values: value.map(encode) } } : typeof value === "object"
    ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
      : typeof value === "number" ? { doubleValue: value } : { stringValue: String(value) };
const fields = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
const put = (path, body) => firestore.patch(`${root}/${path}`, { fields: fields(body) }, { ...safe });
async function removeDocument(path) {
  // Enumerate only this run's known synthetic UID subtree, never a project-wide collection.
  const listed = await firestore.post(`${path}:listCollectionIds`, { pageSize: 100 }, { ...safe });
  for (const collection of listed.body.collectionIds || []) {
    let token;
    do {
      const docs = await firestore.get(`${path}/${collection}`, { ...safe, queryParams: { pageSize: 100, ...(token ? { pageToken: token } : {}) } });
      for (const doc of docs.body.documents || []) await removeDocument(`/v1/${doc.name}`);
      token = docs.body.nextPageToken;
    } while (token);
  }
  const deleted = await firestore.delete(path, { ...safe, resolveOnHTTPError: true });
  assert.ok([200, 204, 404].includes(deleted.status), "Synthetic document cleanup failed");
}
async function login(identity) {
  currentCase = `${identity.role} password login`;
  const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
  context.setDefaultTimeout(40000);
  context.setDefaultNavigationTimeout(45000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.name));
  // Do not load third-party Telegram JS; all application APIs remain real/unmocked.
  await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto(`${base}/?verify=${report.version}-live-${Date.now()}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "У меня есть логин и пароль", exact: true }).or(page.locator("summary").filter({ hasText: "У меня есть логин и пароль" })).click();
  const form = page.locator("form").filter({ has: page.getByLabel("Логин или email", { exact: true }) });
  await form.getByLabel("Логин или email", { exact: true }).fill(identity.email);
  await form.getByLabel("Пароль", { exact: true }).fill(identity.password);
  await form.getByRole("button", { name: "Войти", exact: true }).click();
  return { context, page, check: async label => {
    assert.deepEqual(errors, [], `${label}: runtime errors`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${label}: mobile overflow`);
    pass(label);
  } };
}
try {
  const [config, marker] = await Promise.all([getJson(`${base}/__/firebase/init.json`), readFile("dist/.workout-release.json", "utf8").then(JSON.parse)]);
  assert.equal(config.projectId, project, "Hosting Firebase config must be staging");
  assert.equal(marker.firebaseProjectId, project, "Release marker must be staging");
  assert.equal(marker.environment, "staging");
  report.version = JSON.parse(await readFile("package.json", "utf8")).version;
  assert.equal(marker.version, report.version);
  const worker = await fetch(`${base}/sw.js?verify=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  assert.equal(worker.status, 200);
  assert.ok((await worker.text()).includes(`const CACHE_NAME = "workout-app-v${report.version}";`), "Live service-worker release version must match");
  apiKey = config.apiKey;
  assert.ok(apiKey);
  pass("Live staging configuration and exact release version");
  const stamp = randomBytes(12).toString("hex");
  for (const role of ["trainer", "client", "admin"]) {
    const identity = { role, label: `Synthetic smoke ${role}`, email: `staging-smoke-${stamp}-${role}@example.invalid`, password: randomBytes(32).toString("base64url") };
    identities.push(identity); // Before request, so an ambiguous response can be recovered by exact synthetic email.
    const data = await authRequest("signUp", { email: identity.email, password: identity.password, returnSecureToken: true });
    identity.uid = data.localId;
    identity.idToken = data.idToken;
    assert.ok(identity.uid);
  }
  const [trainer, client, admin] = identities;
  const now = new Date().toISOString();
  const profile = { weight: "72", height: "174", age: "30", sex: "male", activity: "medium", goal: "recomp" };
  for (const identity of identities) await put(`users/${identity.uid}`, {
    role: identity.role, active: true, name: identity.label, email: identity.email,
    firstSetupCompleted: true, aiNutritionProfile: profile, createdByUid: "staging-live-smoke",
    ...(identity.role === "client" ? { accountAccessStatus: "active", trainerId: trainer.uid, assignedTrainerId: trainer.uid,
      assignedProgramId: `smoke-${stamp}`, assignedProgramUpdatedAt: now, assignedProgramName: "Synthetic smoke program",
      workoutModePreference: { mode: "individual", remember: true, updatedAt: now } } : {}),
    ...(identity.role === "admin" ? { adminClaimVersion: stamp } : {})
  });
  // Same privileged Identity Toolkit endpoint used by cached Firebase CLI setCustomClaim.
  // Requires existing operator IAM; fails closed if unavailable, without attempting an IAM grant.
  await identityAdmin.post("/v1/accounts:update", { targetProjectId: project, localId: admin.uid,
    customAttributes: JSON.stringify({ admin: true, adminClaimVersion: stamp }) }, { ...safe });
  const refreshed = await authRequest("signInWithPassword", { email: admin.email, password: admin.password, returnSecureToken: true });
  const claims = JSON.parse(Buffer.from(refreshed.idToken.split(".")[1], "base64url").toString());
  assert.equal(claims.aud, project); assert.equal(claims.admin, true); assert.equal(claims.adminClaimVersion, stamp);
  pass("Synthetic administrator has a server-verified matching admin claim");
  await put(`users/${client.uid}/workouts/smoke-day`, {
    name: "Synthetic smoke workout", source: "trainer", order: 0, status: "planned", assignedBy: trainer.uid,
    assignedProgramId: `smoke-${stamp}`, assignedProgramUpdatedAt: now, assignedProgramLifecycleStatus: "active",
    exercises: [{ id: "smoke-exercise", name: "Synthetic smoke squat", sets: 2, reps: "10", weight: "0", rest: 30 }]
  });
  browser = await chromium.launch({ headless: true });
  {
    const { context, page, check } = await login(client);
    try {
      await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
      for (const tab of ["workouts", "nutrition", "progress", "cabinet", "main"]) {
        currentCase = `client ${tab} navigation`;
        await page.getByTestId(`client-nav-${tab}`).click();
        await expect(page.getByTestId(`client-nav-${tab}`)).toHaveAttribute("aria-current", "page");
        if (tab === "workouts") await expect(page.getByText("Synthetic smoke workout", { exact: true }).first()).toBeVisible();
        if (tab === "cabinet") await expect(page.getByText(`v.${report.version}`, { exact: true }).first()).toBeVisible();
        await check(`Live client ${tab} navigation`);
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
      await check("Live client survives authenticated refresh");
    } finally { await context.close(); }
  }
  {
    const { context, page, check } = await login(trainer);
    try {
      const nav = page.getByRole("navigation", { name: "Разделы тренера", exact: true });
      await expect(nav).toBeVisible();
      await nav.getByRole("button", { name: "Клиенты", exact: true }).click();
      currentCase = "trainer assigned synthetic client";
      await expect(page.getByText(client.label, { exact: true }).first()).toBeVisible();
      await check("Live trainer sees its assigned synthetic client");
      for (const section of ["workouts", "more", "dashboard"]) {
        currentCase = `trainer ${section} navigation`;
        const button = page.locator(`[data-testid="trainer-nav-${section}"]:visible,[data-testid="trainer-desktop-nav-${section}"]:visible`);
        await button.click();
        await expect(button).toHaveAttribute("aria-current", "page");
        await check(`Live trainer ${section} navigation`);
      }
    } finally { await context.close(); }
  }
  {
    const { context, page, check } = await login(admin);
    try {
      await expect(page.getByTestId("admin-overview-sections")).toBeVisible();
      const mobile = page.getByRole("navigation", { name: "Разделы админки", exact: true });
      await expect(mobile).toBeVisible();
      currentCase = "admin users navigation";
      await mobile.getByRole("button", { name: "Пользователи и роли", exact: true }).click();
      await expect(page.getByText(client.label, { exact: true }).first()).toBeVisible();
      await check("Live claim-verified admin users navigation");
    } finally { await context.close(); }
  }
} catch {
  // Provider errors may contain synthetic credentials or token material. Do not serialize them.
  report.failed = true; process.exitCode = 1;
  report.failedCase = currentCase;
  // No screenshots of admin/user lists: an existing staging account could be displayed.
  // Named cases provide safe diagnostics without persisting PII, passwords or provider bodies.
  console.error(`Live staging smoke failed at: ${currentCase}. No credentials or provider body logged.`);
} finally {
  try { await browser?.close(); } catch { process.exitCode = 1; }
  for (const identity of identities) {
    let cleaned = true;
    try {
      if (!identity.uid) {
        const result = await identityAdmin.post(`/v1/projects/${project}/accounts:query`, { expression: [{ email: identity.email }], limit: "1" }, { ...safe });
        identity.uid = result.body.userInfo?.[0]?.localId;
      }
      if (identity.uid) {
        try { await removeDocument(`${root}/users/${identity.uid}`); } catch { cleaned = false; }
        for (const action of ["exercise-video-access", "client-exercise-media", "telegram-create-link-code"]) {
          const key = createHash("sha256").update(`${identity.uid}:${action}`).digest("hex");
          try {
            const removed = await firestore.delete(`${root}/securityRateLimits/${key}`, { ...safe, resolveOnHTTPError: true });
            assert.ok([200, 204, 404].includes(removed.status));
          } catch { cleaned = false; }
        }
        // Auth deletion is attempted even if Firestore cleanup above failed.
        await identityAdmin.post(`/v1/projects/${project}/accounts:delete`, { localId: identity.uid }, { ...safe });
      }
    } catch { cleaned = false; process.exitCode = 1; }
    if (!cleaned) process.exitCode = 1;
    report.cleanup.push({ label: identity.role, cleaned });
  }
  report.finishedAt = new Date().toISOString();
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/staging-live-smoke.json", JSON.stringify(report, null, 2) + "\n");
  console.log(`Synthetic cleanup complete: ${report.cleanup.every(item => item.cleaned)}.`);
}
