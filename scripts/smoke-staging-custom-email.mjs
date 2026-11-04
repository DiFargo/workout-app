import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Explicit synthetic STAGING exercise. No Telegram proof, messages or registry writes.
export const project = "tren-85720-staging";
const base = `https://${project}.web.app`;
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uidPattern = /^staging-custom-email-[a-f0-9]{24}$/;

export function parseArguments(args, env = process.env) {
  let run = false;
  let version;
  let output;
  for (const argument of args) {
    if (argument === "--run" && !run) run = true;
    else if (/^--expected-version=\d+\.\d+\.\d+$/.test(argument) && !version) version = argument.slice(19);
    else if (argument.startsWith("--output=") && !output) output = argument.slice(9);
    else throw new Error("Use --run --expected-version=x.y.z and optional --output=artifacts/file.json; project overrides are prohibited.");
  }
  if (!run || !version) throw new Error("Explicit --run and --expected-version=x.y.z required after staging deployment.");
  if (env.FIREBASE_TOKEN || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Cached CLI credentials and real staging required; token/emulator overrides are prohibited.");
  }
  const target = resolve(workspace, output || `artifacts/variant-a-${version}/staging-custom-email-smoke.json`);
  const child = relative(resolve(workspace, "artifacts"), target);
  if (!child || child.startsWith("..") || isAbsolute(child) || !target.endsWith(".json")) throw new Error("Output must be a JSON file below artifacts.");
  return { version, output: target };
}

export function assertStagingConfiguration(config, worker, version) {
  assert.equal(config?.projectId, project, "Hosting configuration must be staging.");
  assert.ok(typeof config.apiKey === "string" && config.apiKey, "Staging API key unavailable.");
  assert.ok(worker.includes(`const CACHE_NAME = "workout-app-v${version}";`), "Live staging release does not match expected version.");
}

export function makeIdentity(stamp = randomBytes(12).toString("hex")) {
  assert.match(stamp, /^[a-f0-9]{24}$/, "Synthetic run marker required.");
  return {
    uid: `staging-custom-email-${stamp}`,
    alias: `s840${stamp}`,
    initialEmail: `staging-custom-${stamp}@telegram.tren-85720-staging.app`,
    nextEmail: `staging-custom-${stamp}@example.invalid`,
    uiEmail: `staging-custom-${stamp}-ui@example.invalid`,
    name: `Synthetic custom email ${stamp.slice(0, 8)}`,
    marker: `staging-custom-email:${stamp}`
  };
}

export function assertOwnedIdentity(identity, user) {
  assert.match(identity?.uid || "", uidPattern, "Only this script's isolated synthetic UID is allowed.");
  assert.equal(user?.uid, identity.uid, "Synthetic UID mismatch.");
  assert.ok([identity.initialEmail, identity.nextEmail, identity.uiEmail].includes(user.email), "Synthetic email ownership mismatch.");
}

export async function mintOwnedCustomToken(auth, identity) {
  assertOwnedIdentity(identity, await auth.getUser(identity.uid));
  return auth.createCustomToken(identity.uid); // Never accepts an arbitrary target UID or claims.
}

export async function assertOwnedCustomSession(auth, session, identity, now = Date.now()) {
  assert.match(identity?.uid || "", uidPattern);
  assert.ok(typeof session?.idToken === "string" && session.idToken, "Custom exchange must return an ID token.");
  // The REST custom-token response does not require localId. The signed,
  // revoked-token-checked ID token remains the authoritative identity proof.
  // https://firebase.google.com/docs/reference/rest/auth#section-sign-in-with-custom-token
  if (session.localId !== undefined) assert.equal(session.localId, identity.uid);
  const claims = await auth.verifyIdToken(session.idToken, true);
  assert.equal(claims.uid, identity.uid);
  assert.equal(claims.aud, project);
  assert.equal(claims.firebase?.sign_in_provider, "custom");
  assert.ok(Number.isFinite(claims.auth_time) && claims.auth_time > 0 &&
    claims.auth_time <= now / 1000 + 30 && now / 1000 - claims.auth_time < 60, "Custom session must be fresh.");
  return claims;
}

export function authResponseDiagnostic(method, status, data, identity) {
  const allowedErrors = new Set(["INVALID_CUSTOM_TOKEN", "CREDENTIAL_MISMATCH", "TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND",
    "INVALID_ID_TOKEN", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND", "OPERATION_NOT_ALLOWED",
    "TOO_MANY_ATTEMPTS_TRY_LATER", "INVALID_OOB_CODE", "EXPIRED_OOB_CODE", "WEAK_PASSWORD"]);
  const candidate = String(data?.error?.message || "").split(":")[0].trim();
  return { method: ["signInWithCustomToken", "signInWithPassword", "resetPassword"].includes(method) ? method : "unknown",
    status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0,
    error: allowedErrors.has(candidate) ? candidate : data?.error ? "UNKNOWN" : null,
    hasIdToken: typeof data?.idToken === "string" && !!data.idToken,
    hasLocalId: typeof data?.localId === "string" && !!data.localId,
    ...(data?.localId === undefined ? {} : { localIdMatches: data.localId === identity.uid }) };
}

export function assertStagingSigner(signer, projectNumber = "") {
  assert.ok(signer.endsWith(`@${project}.iam.gserviceaccount.com`) || signer === `${project}@appspot.gserviceaccount.com` ||
    (/^\d+$/.test(String(projectNumber)) && signer === `${projectNumber}-compute@developer.gserviceaccount.com`), "Runtime signer must belong to staging.");
}

const fields = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
const encode = value => value === null ? { nullValue: null } : Array.isArray(value)
  ? { arrayValue: { values: value.map(encode) } } : typeof value === "object"
    ? { mapValue: { fields: fields(value) } } : typeof value === "boolean" ? { booleanValue: value }
      : typeof value === "number" ? { doubleValue: value } : { stringValue: String(value) };
const decode = value => value?.stringValue ?? value?.booleanValue ?? null;

export async function runSmoke({ version, output }) {
  await access(output).then(() => { throw new Error("Output already exists; preserve prior evidence."); }, error => { if (error.code !== "ENOENT") throw error; });
  const report = { project, version, startedAt: new Date().toISOString(), cases: [], cleanup: {},
    coverage: "Real Firebase custom-token REST session, member email API, old-session revocation and fresh same-UID custom re-login; then real staging password-login, email-change UI and explicit re-login handoff. The custom-session frontend handler itself is covered by focused synthetic tests, not native Telegram transport.",
    limits: ["One owned synthetic client only; no real users, production, Telegram proof/messages/registry, IAM grants or email delivery.",
      "Generated password-reset code and all credentials remain in memory. Mail delivery and native Telegram UI are not covered."] };
  const identity = makeIdentity();
  let step = "cached staging operator authentication";
  let token;
  let app;
  let auth;
  let deleteAdminApp;
  let browser;
  let authCreated = false;
  let apiKey;
  const pass = name => { report.cases.push({ name, passed: true }); console.log(`passed: ${name}`); };
  const fail = (message) => { throw new Error(message); };
  const privileged = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) { await response.body?.cancel(); fail(`Privileged staging request failed (HTTP ${response.status}).`); }
    return response.status === 204 ? {} : response.json();
  };
  const documents = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const documentUrl = path => `${documents}/${path}`;
  const readDocument = path => privileged(documentUrl(path));
  const createDocument = (path, data) => privileged(`${documentUrl(path)}?currentDocument.exists=false`, { method: "PATCH", body: JSON.stringify({ fields: fields(data) }) });
  const authRequest = async (method, body) => {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
    });
    const data = await response.json();
    const diagnostic = authResponseDiagnostic(method, response.status, data, identity);
    (report.authRequests ||= []).push(diagnostic);
    if (response.status !== 200) throw Object.assign(new Error("Synthetic Auth request failed."), { code: `auth/${diagnostic.error || "request-failed"}` });
    return data;
  };
  try {
    const require = createRequire(import.meta.url);
    const cli = resolve(workspace, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
    assert.ok(account, "Cached CLI operator unavailable.");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
    token = await require(resolve(cli, "apiv2.js")).getAccessToken();
    assert.ok(typeof token === "string" && token, "Cached CLI access token unavailable.");
    step = "exact staging configuration and release";
    const configResponse = await fetch(`${base}/__/firebase/init.json`, { signal: AbortSignal.timeout(20000) });
    assert.equal(configResponse.status, 200);
    const config = await configResponse.json();
    const workerResponse = await fetch(`${base}/sw.js?custom-email-smoke=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    assert.equal(workerResponse.status, 200);
    assertStagingConfiguration(config, await workerResponse.text(), version);
    apiKey = config.apiKey;
    const runtime = await privileged(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/europe-west1/functions/profileUpdateEmail`);
    const signer = runtime.serviceConfig?.serviceAccountEmail || "";
    const projectMetadata = await privileged(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`);
    assert.equal(projectMetadata.projectId, project, "Signer project metadata must be staging.");
    assertStagingSigner(signer, projectMetadata.projectNumber);
    pass("Exact staging release and explicit staging runtime signer");
    const serverRequire = createRequire(resolve(workspace, "functions/package.json"));
    const adminApp = serverRequire("firebase-admin/app");
    const adminAuth = serverRequire("firebase-admin/auth");
    deleteAdminApp = adminApp.deleteApp;
    app = adminApp.initializeApp({ projectId: project, serviceAccountId: signer,
      credential: { getAccessToken: async () => ({ access_token: token, expires_in: 3600 }) } }, `staging-custom-email-${Date.now()}`);
    auth = adminAuth.getAuth(app);
    step = "one isolated synthetic client creation";
    const existing = await auth.getUser(identity.uid).catch(error => { if (error.code === "auth/user-not-found") return null; throw error; });
    assert.equal(existing, null, "Synthetic UID already exists; no mutations allowed.");
    // Explicit random UID is known before creation, so ambiguous responses are recoverable.
    await auth.createUser({ uid: identity.uid, email: identity.initialEmail, emailVerified: false, displayName: identity.name });
    authCreated = true;
    assertOwnedIdentity(identity, await auth.getUser(identity.uid));
    const now = new Date().toISOString();
    await createDocument(`users/${identity.uid}`, { role: "client", active: true, accountAccessStatus: "active", firstSetupCompleted: true,
      name: identity.name, email: identity.initialEmail, emailIsInternal: true, loginLower: identity.alias,
      accountProfile: { displayName: identity.name, email: identity.initialEmail, login: identity.alias }, createdByUid: identity.marker, createdAt: now });
    await createDocument(`loginAliases/${identity.alias}`, { uid: identity.uid, email: identity.initialEmail, createdAt: now });
    step = "existing IAM custom-token signer permission";
    let customToken = await mintOwnedCustomToken(auth, identity);
    step = "fresh custom session REST exchange";
    const session = await authRequest("signInWithCustomToken", { token: customToken, returnSecureToken: true });
    customToken = undefined;
    step = "fresh custom session verified identity";
    await assertOwnedCustomSession(auth, session, identity);
    pass("Fresh signed custom session belongs to the isolated client");
    step = "actual member email update API";
    const response = await fetch(`${base}/api/profile/update-email`, { method: "POST",
      headers: { Authorization: `Bearer ${session.idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: identity.nextEmail }), signal: AbortSignal.timeout(20000) });
    const changed = await response.json();
    assert.equal(response.status, 200, "Actual member email API rejected the fresh custom session.");
    assert.equal(changed.ok, true);
    assert.equal(changed.email, identity.nextEmail);
    const user = await auth.getUser(identity.uid);
    assertOwnedIdentity(identity, user);
    assert.equal(user.email, identity.nextEmail);
    assert.equal(user.emailVerified, false);
    const [profile, alias] = await Promise.all([readDocument(`users/${identity.uid}`), readDocument(`loginAliases/${identity.alias}`)]);
    assert.equal(decode(profile.fields.email), identity.nextEmail);
    assert.equal(decode(profile.fields.role), "client");
    assert.equal(decode(alias.fields.uid), identity.uid);
    assert.equal(decode(alias.fields.email), identity.nextEmail);
    pass("Email changed on the same UID, unverified, with matching profile and alias");
    step = "previous custom session revoked after email update";
    await assert.rejects(auth.verifyIdToken(session.idToken, true), error => error?.code === "auth/id-token-revoked");
    pass("Previous custom ID token is revoked after the security-sensitive email change");
    step = "fresh custom re-login after email update";
    let nextCustomToken = await mintOwnedCustomToken(auth, identity);
    const nextSession = await authRequest("signInWithCustomToken", { token: nextCustomToken, returnSecureToken: true });
    nextCustomToken = undefined;
    await assertOwnedCustomSession(auth, nextSession, identity);
    pass("Fresh custom re-login restores a server-valid session for the same UID");
    step = "password creation through an in-memory reset code";
    const resetLink = new URL(await auth.generatePasswordResetLink(identity.nextEmail, { url: base }));
    assert.ok([`${project}.firebaseapp.com`, `${project}.web.app`].includes(resetLink.hostname), "Reset link must belong to staging.");
    const code = resetLink.searchParams.get("oobCode");
    assert.ok(code, "Generated reset code unavailable.");
    const checked = await authRequest("resetPassword", { oobCode: code });
    assert.equal(checked.email, identity.nextEmail);
    const password = randomBytes(24).toString("base64url");
    await authRequest("resetPassword", { oobCode: code, newPassword: password });
    const passwordSession = await authRequest("signInWithPassword", { email: identity.nextEmail, password, returnSecureToken: true });
    assert.equal(passwordSession.localId, identity.uid);
    pass("One-time reset code creates a password for the same UID without sending email");
    step = "real staging email-password login UI";
    const { chromium, expect } = await import("@playwright/test");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.name));
    await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.goto(`${base}/?custom-email-smoke=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "У меня есть логин и пароль", exact: true }).or(page.locator("summary").filter({ hasText: "У меня есть логин и пароль" })).click();
    const form = page.locator("form").filter({ has: page.getByLabel("Логин или email", { exact: true }) });
    await form.getByLabel("Логин или email", { exact: true }).fill(identity.nextEmail);
    await form.getByLabel("Пароль", { exact: true }).fill(password);
    await form.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByTestId("client-bottom-nav")).toBeVisible({ timeout: 40000 });
    assert.deepEqual(pageErrors, [], "Real staging login has runtime errors.");
    pass("Real deployed staging password-login UI opens the original client membership");
    step = "real deployed email-change and explicit re-login UI";
    await page.getByTestId("client-nav-cabinet").click();
    await page.getByTestId("profile-cabinet-action-account").click();
    await page.getByTestId("profile-settings-email").click();
    await page.getByTestId("profile-email-address").fill(identity.uiEmail);
    await page.getByTestId("profile-email-password").fill(password);
    await page.getByTestId("profile-email-submit").click();
    const reauthenticate = page.getByTestId("profile-email-reauthenticate");
    await expect(reauthenticate).toBeVisible({ timeout: 40000 });
    assert.equal((await auth.getUser(identity.uid)).email, identity.uiEmail);
    await expect(page.getByTestId("profile-email-dialog")).toContainText("повторный вход");
    await reauthenticate.click();
    await page.getByRole("button", { name: "У меня есть логин и пароль", exact: true }).or(page.locator("summary").filter({ hasText: "У меня есть логин и пароль" })).click({ timeout: 40000 });
    const nextForm = page.locator("form").filter({ has: page.getByLabel("Логин или email", { exact: true }) });
    await nextForm.getByLabel("Логин или email", { exact: true }).fill(identity.uiEmail);
    await nextForm.getByLabel("Пароль", { exact: true }).fill(password);
    await nextForm.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByTestId("client-bottom-nav")).toBeVisible({ timeout: 40000 });
    assert.deepEqual(pageErrors, [], "Email-change handoff has runtime errors.");
    pass("Real email-change UI saves the same UID and explicitly returns to a working re-login");
    await context.close();
  } catch (error) {
    report.failure = { step, code: /^[a-z0-9_/-]{1,80}$/i.test(error?.code || "") ? error.code : "smoke-assertion-or-transport-failure" };
    console.error(`Staging custom-email smoke failed at: ${step}. No credentials or response bodies logged.`);
  } finally {
    try { await browser?.close(); } catch { report.cleanup.browserClosed = false; }
    if (auth) {
      // Recover an ambiguous create only when the exact random UID still has one
      // of this run's unique emails. Never enumerate or delete another account.
      try {
        const user = await auth.getUser(identity.uid).catch(error => { if (error.code === "auth/user-not-found") return null; throw error; });
        if (user) { assertOwnedIdentity(identity, user); authCreated = true; }
        if (authCreated) {
          const remove = async path => {
            const response = await fetch(documentUrl(path), { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
            assert.ok([200, 204, 404].includes(response.status), "Synthetic cleanup failed.");
            await response.body?.cancel();
          };
          // Only known documents are written by this script/endpoint. Browser
          // bootstrap descendants are removed recursively under its exact UID.
          const removeTree = async path => {
            const listed = await privileged(`${documentUrl(path)}:listCollectionIds`, { method: "POST", body: JSON.stringify({ pageSize: 100 }) });
            assert.ok(!listed.nextPageToken, "Synthetic subtree exceeds bounded cleanup.");
            for (const collection of listed.collectionIds || []) {
              const rows = await privileged(`${documentUrl(path)}/${encodeURIComponent(collection)}?pageSize=100`);
              assert.ok(!rows.nextPageToken, "Synthetic collection exceeds bounded cleanup.");
              for (const document of rows.documents || []) {
                const prefix = `${documents.replace("https://firestore.googleapis.com/v1/", "")}/${path}/`;
                assert.ok(document.name.startsWith(prefix), "Cleanup document escaped owned subtree.");
                await removeTree(document.name.slice(documents.replace("https://firestore.googleapis.com/v1/", "").length + 1));
              }
            }
            await remove(path);
          };
          const attempt = async operation => { try { await operation(); } catch { report.cleanup.failed = true; } };
          // Verify server-side markers even after an ambiguous create response.
          await attempt(async () => {
            const response = await fetch(documentUrl(`users/${identity.uid}`), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
            if (response.status === 404) return;
            assert.equal(response.status, 200);
            const document = await response.json();
            assert.equal(decode(document.fields?.createdByUid), identity.marker, "Cleanup profile ownership mismatch.");
            await removeTree(`users/${identity.uid}`);
          });
          await attempt(async () => {
            const response = await fetch(documentUrl(`loginAliases/${identity.alias}`), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
            if (response.status === 404) return;
            assert.equal(response.status, 200);
            const document = await response.json();
            assert.equal(decode(document.fields?.uid), identity.uid, "Cleanup alias ownership mismatch.");
            await remove(`loginAliases/${identity.alias}`);
          });
          for (const action of ["profile-update-email", "profile-update-email-daily"]) {
            await attempt(() => remove(`securityRateLimits/${createHash("sha256").update(`${identity.uid}:${action}`).digest("hex")}`));
          }
          await attempt(() => auth.deleteUser(identity.uid));
          report.cleanup.authAbsent = !(await auth.getUser(identity.uid).catch(error => { if (error.code === "auth/user-not-found") return null; throw error; }));
          const absent = async path => {
            const response = await fetch(documentUrl(path), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
            await response.body?.cancel();
            return response.status === 404;
          };
          report.cleanup.profileAbsent = await absent(`users/${identity.uid}`);
          report.cleanup.aliasAbsent = await absent(`loginAliases/${identity.alias}`);
          report.cleanup.rateRecordsAbsent = (await Promise.all(["profile-update-email", "profile-update-email-daily"].map(action =>
            absent(`securityRateLimits/${createHash("sha256").update(`${identity.uid}:${action}`).digest("hex")}`)))).every(Boolean);
          const identities = await privileged(`${documents}:runQuery`, { method: "POST", body: JSON.stringify({ structuredQuery: {
            from: [{ collectionId: "telegramIdentities" }], where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: identity.uid } } }, limit: 1
          } }) });
          report.cleanup.noTelegramIdentityCreated = !identities.some(row => row.document);
        } else report.cleanup.noSyntheticAccountCreated = true;
      } catch { report.cleanup.failed = true; }
    } else report.cleanup.noSyntheticAccountCreated = true;
    if (app) { try { await deleteAdminApp(app); } catch { /* no persistent app process */ } }
    token = undefined;
    report.finishedAt = new Date().toISOString();
    report.cleanup.complete = !report.cleanup.failed && Object.values(report.cleanup).every(value => value === true);
    report.passed = !report.failure && report.cleanup.complete;
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify(report, null, 2));
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await runSmoke(parseArguments(process.argv.slice(2)));
    if (!report.passed) process.exitCode = 1;
  } catch {
    console.error("Staging custom-email smoke did not complete. No credentials or raw responses printed.");
    process.exitCode = 1;
  }
}
