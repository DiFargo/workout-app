import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { project, assertStagingConfiguration } from "./smoke-staging-custom-email.mjs";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = `https://${project}.web.app`;
const version = "3.0.840";
const uidPattern = /^staging-email-handoff-[a-f0-9]{24}$/;
const actions = ["profile-update-email", "profile-update-email-daily"];

export function parseArguments(args, env = process.env) {
  assert.deepEqual([...args].sort(), ["--expected-version=3.0.840", "--run"], "Exact --run --expected-version=3.0.840 required; overrides prohibited.");
  for (const key of ["FIREBASE_TOKEN", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS"]) {
    assert.ok(!env[key], "Only cached CLI operator and real staging are permitted.");
  }
  return { version };
}

export function makeIdentity(stamp = randomBytes(12).toString("hex")) {
  assert.match(stamp, /^[a-f0-9]{24}$/);
  return { uid: `staging-email-handoff-${stamp}`, marker: `staging-email-handoff:${stamp}`, alias: `h840${stamp}`,
    initialEmail: `handoff-${stamp}@example.invalid`, nextEmail: `handoff-next-${stamp}@example.invalid`,
    name: "Synthetic email handoff", runId: stamp };
}

export function assertOwnedIdentity(identity, user) {
  assert.match(identity?.uid || "", uidPattern);
  assert.equal(user?.uid, identity.uid, "Owned synthetic UID mismatch.");
  assert.ok([identity.initialEmail, identity.nextEmail].includes(user.email), "Owned synthetic email mismatch.");
}

export function artifactPath(runId, suffix = "json") {
  assert.match(runId, /^[a-f0-9]{24}$/);
  assert.ok(["json", "png"].includes(suffix));
  const output = resolve(workspace, `artifacts/variant-a-${version}/staging-email-handoff-${runId}.${suffix}`);
  const child = relative(resolve(workspace, "artifacts"), output);
  assert.ok(child && !child.startsWith("..") && !isAbsolute(child));
  return output;
}

export function safeErrorName(error) {
  return ["AssertionError", "TimeoutError", "Error", "FirebaseError", "AbortError"].includes(error?.name) ? error.name : "UnknownError";
}

export function safeHttpDiagnostic(status, body) {
  const allowed = new Set(["auth/requires-recent-login", "auth/current-password-required", "email-already-in-use", "invalid-email", "email-update-pending", "identity-operation-conflict"]);
  return { status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0,
    ok: body?.ok === true, hasEmail: typeof body?.email === "string" && !!body.email,
    error: body?.error ? allowed.has(body.error) ? body.error : "UNKNOWN" : null };
}

const encode = value => value === null ? { nullValue: null } : typeof value === "object"
  ? { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } }
  : typeof value === "boolean" ? { booleanValue: value } : { stringValue: String(value) };
const fields = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
const stringField = (document, key) => document.fields?.[key]?.stringValue || "";

export async function runSmoke() {
  const identity = makeIdentity();
  const output = artifactPath(identity.runId);
  const failureImage = artifactPath(identity.runId, "png");
  await access(output).then(() => { throw new Error("Output exists; preserve evidence."); }, error => { if (error.code !== "ENOENT") throw error; });
  const report = { project, version, startedAt: new Date().toISOString(), steps: [], cases: [], http: [], cleanup: {},
    limits: ["One owned staging password client only. No IAM/custom-token/signBlob/Telegram/production operations or email delivery.",
      "Real deployed UI, not a fixture. Native Telegram and password reset are not covered here."] };
  let currentStep = "initialize";
  const step = async (name, operation) => { currentStep = name; report.steps.push({ name, startedAt: new Date().toISOString() }); return operation(); };
  const pass = name => { report.cases.push({ name, passed: true }); console.log(`passed: ${name}`); };
  let token, auth, app, deleteApp, browser, page;
  let creationAttempted = false;
  const documents = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const ownedRoot = `users/${identity.uid}`;
  const request = async (path, { method = "GET", body, allowMissing = false } = {}) => {
    const response = await fetch(`${documents}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    if (allowMissing && response.status === 404) { await response.body?.cancel(); return null; }
    assert.ok(response.ok, "Owned staging document request failed.");
    if (response.status === 204 || method === "DELETE") { await response.body?.cancel(); return null; }
    return response.json();
  };
  const getAuthUser = () => auth.getUser(identity.uid).catch(error => { if (error.code === "auth/user-not-found") return null; throw error; });
  try {
    const require = createRequire(import.meta.url);
    const cli = resolve(workspace, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
    assert.ok(account?.user?.email, "Cached human CLI operator required.");
    await step("cached staging operator authorization", () => require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true));
    token = await step("cached operator access token", () => require(resolve(cli, "apiv2.js")).getAccessToken());
    assert.ok(typeof token === "string" && token);
    const configResponse = await step("fetch exact staging Firebase configuration", () => fetch(`${base}/__/firebase/init.json`, { signal: AbortSignal.timeout(20000) }));
    assert.equal(configResponse.status, 200);
    const config = await step("read staging configuration", () => configResponse.json());
    const worker = await step("fetch expected live 840 service worker", () => fetch(`${base}/sw.js?email-handoff=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(20000) }));
    assert.equal(worker.status, 200);
    assertStagingConfiguration(config, await step("read live worker version", () => worker.text()), version);
    pass("Exact staging project and published 3.0.840 verified");
    const serverRequire = createRequire(resolve(workspace, "functions/package.json"));
    const adminApp = serverRequire("firebase-admin/app");
    deleteApp = adminApp.deleteApp;
    app = adminApp.initializeApp({ projectId: project, credential: { getAccessToken: async () => ({ access_token: token, expires_in: 3600 }) } }, `email-handoff-${identity.runId}`);
    auth = serverRequire("firebase-admin/auth").getAuth(app);
    assert.equal(await step("assert new isolated UID absent", getAuthUser), null);
    const password = randomBytes(24).toString("base64url");
    creationAttempted = true;
    await step("create one owned password client", () => auth.createUser({ uid: identity.uid, email: identity.initialEmail, password, displayName: identity.name, emailVerified: false }));
    assertOwnedIdentity(identity, await step("verify owned Auth account", getAuthUser));
    const now = new Date().toISOString();
    await step("create marked active client profile only if absent", () => request(`${ownedRoot}?currentDocument.exists=false`, { method: "PATCH", body: { fields: fields({
      role: "client", active: true, accountAccessStatus: "active", firstSetupCompleted: true, name: identity.name, email: identity.initialEmail,
      aiNutritionProfile: { weight: "72", height: "174", age: "30", sex: "male", activity: "medium", goal: "recomp" },
      loginLower: identity.alias, accountProfile: { displayName: identity.name, email: identity.initialEmail, login: identity.alias }, createdByUid: identity.marker, createdAt: now
    }) } }));
    await step("create owned alias only if absent", () => request(`loginAliases/${identity.alias}?currentDocument.exists=false`, { method: "PATCH", body: { fields: fields({ uid: identity.uid, email: identity.initialEmail }) } }));
    const { chromium, expect } = await step("load browser runtime", () => import("@playwright/test"));
    browser = await step("launch isolated Chromium", () => chromium.launch({ headless: true }));
    const context = await step("create isolated 402x874 context", () => browser.newContext({ viewport: { width: 402, height: 874 } }));
    context.setDefaultTimeout(30000);
    page = await step("create real staging page", () => context.newPage());
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(safeErrorName(error)));
    await step("omit external Telegram SDK only", () => page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" })));
    await step("open real deployed staging application", () => page.goto(`${base}/?email-handoff=${Date.now()}`, { waitUntil: "domcontentloaded" }));
    const login = async (email, prefix) => {
      const chooser = page.getByRole("button", { name: "У меня есть логин и пароль", exact: true });
      await step(`${prefix}: choose password method`, () => chooser.click());
      const form = page.locator("form").filter({ has: page.getByLabel("Логин или email", { exact: true }) });
      await step(`${prefix}: fill owned email`, () => form.getByLabel("Логин или email", { exact: true }).fill(email));
      await step(`${prefix}: fill known password`, () => form.getByLabel("Пароль", { exact: true }).fill(password));
      await step(`${prefix}: submit login`, () => form.getByRole("button", { name: "Войти", exact: true }).click());
      await step(`${prefix}: await active client navigation`, () => expect(page.getByTestId("client-bottom-nav")).toBeVisible({ timeout: 40000 }));
    };
    await login(identity.initialEmail, "initial login");
    pass("Real initial password login opens the owned active client");
    await step("open cabinet tab", () => page.getByTestId("client-nav-cabinet").click());
    await step("open account connections", () => page.getByTestId("profile-cabinet-action-account").click());
    await step("open email editor", () => page.getByTestId("profile-settings-email").click());
    await step("await email editor dialog", () => expect(page.getByTestId("profile-email-dialog")).toBeVisible());
    await step("fill new owned email", () => page.getByTestId("profile-email-address").fill(identity.nextEmail));
    await step("await password confirmation input", () => expect(page.getByTestId("profile-email-password")).toBeVisible());
    await step("fill known current password for email confirmation", () => page.getByTestId("profile-email-password").fill(password));
    const responsePromise = page.waitForResponse(response => response.url() === `${base}/api/profile/update-email` && response.request().method() === "POST", { timeout: 40000 })
      .then(response => ({ response }), error => ({ error }));
    await step("submit real email-change form", () => page.getByTestId("profile-email-submit").click());
    const responseResult = await step("await email-change API response", () => responsePromise);
    if (responseResult.error) throw responseResult.error;
    const response = responseResult.response;
    const body = await step("read email-change response in memory", () => response.json());
    report.http.push(safeHttpDiagnostic(response.status(), body));
    assert.equal(response.status(), 200);
    assert.equal(body.ok, true);
    assert.equal(body.email, identity.nextEmail);
    await step("await explicit re-login handoff button", () => expect(page.getByTestId("profile-email-reauthenticate")).toBeVisible({ timeout: 40000 }));
    const changed = await step("verify changed Auth identity", getAuthUser);
    assertOwnedIdentity(identity, changed);
    assert.equal(changed.email, identity.nextEmail);
    assert.equal(changed.emailVerified, false);
    const profile = await step("verify same owned profile after email write", () => request(ownedRoot));
    const alias = await step("verify same owned alias after email write", () => request(`loginAliases/${identity.alias}`));
    assert.equal(stringField(profile, "email"), identity.nextEmail);
    assert.equal(stringField(profile, "role"), "client");
    assert.equal(stringField(alias, "uid"), identity.uid);
    assert.equal(stringField(alias, "email"), identity.nextEmail);
    pass("Real email form updates the same UID and offers explicit re-login");
    await step("click explicit re-login and existing logout", () => page.getByTestId("profile-email-reauthenticate").click());
    await login(identity.nextEmail, "new-email re-login");
    // Verify authenticated identity without exposing persisted browser credentials.
    const signedIn = await step("confirm new-email same-UID Auth identity", () => auth.getUserByEmail(identity.nextEmail));
    assertOwnedIdentity(identity, signedIn);
    assert.deepEqual(pageErrors, [], "Runtime page errors observed.");
    pass("Explicit logout and new-email login preserve the original UID and password");
  } catch (error) {
    report.failure = { step: currentStep, name: safeErrorName(error) };
    if (page) {
      try {
        report.failure.onboardingVisible = await page.getByTestId("first-setup-onboarding").isVisible();
        report.failure.authPendingHintVisible = await page.locator("#pending-access-title").isVisible();
        report.failure.clientNavigationVisible = await page.getByTestId("client-bottom-nav").isVisible();
        report.failure.emailDialogVisible = await page.getByTestId("profile-email-dialog").isVisible();
        assert.equal(new URL(page.url()).hostname, `${project}.web.app`, "Screenshot must stay inside staging.");
        await mkdir(dirname(output), { recursive: true });
        await access(failureImage).then(() => { throw new Error("Failure image exists."); }, error => { if (error.code !== "ENOENT") throw error; });
        await page.screenshot({ path: failureImage, fullPage: false, mask: [page.locator("input,textarea,[contenteditable=true]")], maskColor: "#636366" });
        report.failure.maskedScreenshot = relative(workspace, failureImage).replaceAll("\\", "/");
      } catch { report.failure.screenshotUnavailable = true; }
    }
    console.error(`Staging email handoff failed at: ${currentStep}. No raw errors or credentials logged.`);
  } finally {
    const originalStep = currentStep;
    const attempt = async (name, operation) => { try { await step(name, operation); } catch { report.cleanup.failed = true; } };
    await attempt("cleanup: close isolated browser", async () => { await browser?.close(); });
    if (auth && creationAttempted) {
      const remove = path => request(path, { method: "DELETE", allowMissing: true });
      let cleanupDocuments = 0;
      const removeTree = async (path, depth = 0) => {
        assert.ok(path === ownedRoot || path.startsWith(`${ownedRoot}/`));
        assert.ok(depth < 10, "Owned subtree cleanup bound exceeded.");
        assert.ok(++cleanupDocuments <= 100, "Owned subtree cleanup count exceeded.");
        const listed = await request(`${path}:listCollectionIds`, { method: "POST", body: { pageSize: 100 } });
        assert.ok(!listed.nextPageToken);
        let count = 0;
        for (const collection of listed.collectionIds || []) {
          const rows = await request(`${path}/${encodeURIComponent(collection)}?pageSize=100`);
          assert.ok(!rows.nextPageToken);
          for (const document of rows.documents || []) {
            assert.ok(++count <= 100);
            const prefix = documents.replace("https://firestore.googleapis.com/v1/", "");
            assert.ok(document.name.startsWith(`${prefix}/${ownedRoot}/`));
            await removeTree(document.name.slice(prefix.length + 1), depth + 1);
          }
        }
        await remove(path);
      };
      await attempt("cleanup: verify owned Auth before deletion", async () => { const user = await getAuthUser(); if (user) assertOwnedIdentity(identity, user); });
      await attempt("cleanup: remove marked owned profile subtree", async () => { const profile = await request(ownedRoot, { allowMissing: true }); if (profile) { assert.equal(stringField(profile, "createdByUid"), identity.marker); await removeTree(ownedRoot); } });
      await attempt("cleanup: remove exact owned alias", async () => { const alias = await request(`loginAliases/${identity.alias}`, { allowMissing: true }); if (alias) { assert.equal(stringField(alias, "uid"), identity.uid); await remove(`loginAliases/${identity.alias}`); } });
      for (const action of actions) await attempt("cleanup: remove known owned email rate key", () => remove(`securityRateLimits/${createHash("sha256").update(`${identity.uid}:${action}`).digest("hex")}`));
      await attempt("cleanup: delete exact owned Auth account", async () => { const user = await getAuthUser(); if (user) { assertOwnedIdentity(identity, user); await auth.deleteUser(identity.uid); } });
      await attempt("cleanup: prove Auth absent", async () => { report.cleanup.authAbsent = await getAuthUser() === null; });
      await attempt("cleanup: prove profile absent", async () => { report.cleanup.profileAbsent = await request(ownedRoot, { allowMissing: true }) === null; });
      await attempt("cleanup: prove alias absent", async () => { report.cleanup.aliasAbsent = await request(`loginAliases/${identity.alias}`, { allowMissing: true }) === null; });
      await attempt("cleanup: prove profile descendants absent", async () => { const rows = await request(`${ownedRoot}:listCollectionIds`, { method: "POST", body: { pageSize: 100 } }); report.cleanup.descendantsAbsent = !(rows.collectionIds || []).length && !rows.nextPageToken; });
      await attempt("cleanup: prove both known rate records absent", async () => { const results = []; for (const action of actions) results.push(await request(`securityRateLimits/${createHash("sha256").update(`${identity.uid}:${action}`).digest("hex")}`, { allowMissing: true }) === null); report.cleanup.rateRecordsAbsent = results.every(Boolean); });
    } else report.cleanup.noAccountCreationAttempted = true;
    if (app) await attempt("cleanup: release Admin SDK app", () => deleteApp(app));
    token = undefined;
    currentStep = originalStep;
    report.cleanup.complete = !report.cleanup.failed && (report.cleanup.noAccountCreationAttempted === true ||
      ["authAbsent", "profileAbsent", "aliasAbsent", "descendantsAbsent", "rateRecordsAbsent"].every(key => report.cleanup[key] === true));
    report.passed = !report.failure && report.cases.length === 4 && report.cleanup.complete;
    report.finishedAt = new Date().toISOString();
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ project, version, passed: report.passed, cases: report.cases.length, failure: report.failure, cleanup: report.cleanup, output: relative(workspace, output).replaceAll("\\", "/") }));
    return report;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { parseArguments(process.argv.slice(2)); if (!(await runSmoke()).passed) process.exitCode = 1; }
  catch { console.error("Staging email handoff did not complete; no credentials or raw responses printed."); process.exitCode = 1; }
}
