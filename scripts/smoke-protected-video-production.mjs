import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import { chromium, expect } from "@playwright/test";

if (!process.argv.includes("--run")) throw new Error("Pass --run only after the authorized Production deployment.");
const project = process.argv.find(value => value.startsWith("--project="))?.slice(10) || "tren-85720";
if (!["tren-85720", "tren-85720-staging"].includes(project)) throw new Error("Only the configured release projects are allowed.");
const base = `https://${project}.web.app`;
const apiKey = project === "tren-85720" ? "AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg" : "AIzaSyCptuLp8K3xOOPYz1VxRUlbWyID8D2894Q"; // Public Firebase web configuration.
const source = "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4";
const require = createRequire(import.meta.url);
const cliRoot = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
const { Client } = require(resolve(cliRoot, "apiv2.js"));
const account = getGlobalDefaultAccount();
if (!account) throw new Error("Firebase CLI sign-in required.");
await requireAuth({ ...account, project }, true);
const firestore = new Client({ urlPrefix: "https://firestore.googleapis.com" });
const documentRoot = `/v1/projects/${project}/databases/(default)/documents`;
const report = { version: JSON.parse(await readFile("package.json", "utf8")).version, startedAt: new Date().toISOString(), cases: [], cleanup: {} };
report.project = project;
const reportId = `${project === "tren-85720" ? "" : "staging-"}${report.version}`;
let uid = "", idToken = "";
const authRequest = (method, body) => fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
});
const request = (path, body, authenticated = true) => fetch(base + path, {
  method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${idToken}` } : {}) },
  body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
});
const pass = (name) => { report.cases.push({ name, passed: true }); console.log(`passed: ${name}`); };
async function removeTemporaryTree(path) {
  const listed = await firestore.post(`${path}:listCollectionIds`, { pageSize: 100 });
  for (const collection of listed.body.collectionIds || []) {
    let pageToken;
    do {
      const children = await firestore.get(`${path}/${collection}`, { queryParams: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } });
      for (const document of children.body.documents || []) await removeTemporaryTree(`/v1/${document.name}`);
      pageToken = children.body.nextPageToken;
    } while (pageToken);
  }
  await firestore.delete(path);
}
try {
  const unauthenticated = await request("/api/exercise-video-access", { source }, false);
  assert.equal(unauthenticated.status, 401);
  pass("Video API rejects unauthenticated requests");
  const random = randomBytes(12).toString("hex");
  const smokeEmail = `release-smoke-${random}@example.invalid`;
  const smokePassword = randomBytes(30).toString("base64url");
  const created = await authRequest("signUp", { email: smokeEmail, password: smokePassword, returnSecureToken: true });
  const identity = await created.json();
  if (!created.ok || !identity.localId || !identity.idToken) throw new Error(`Temporary smoke identity could not be created: HTTP ${created.status}.`);
  uid = identity.localId;
  idToken = identity.idToken;
  await firestore.patch(`${documentRoot}/users/${uid}`, { fields: {
    role: { stringValue: "client" }, active: { booleanValue: true }, name: { stringValue: "Release smoke (temporary)" },
    email: { stringValue: smokeEmail }, accountRegistrationType: { stringValue: "open" },
    accountAccessStatus: { stringValue: "awaiting_trainer" }, createdByUid: { stringValue: "release-smoke" },
    createdAt: { stringValue: new Date().toISOString() }
  } });
  const pending = await request("/api/exercise-video-access", { source });
  assert.equal(pending.status, 403);
  pass("Unassigned registration cannot view protected video");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    const runtimeErrors = [];
    page.on("pageerror", error => runtimeErrors.push(error.name));
    await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.goto(`${base}/?verify=${report.version}-smoke`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.getByRole("button", { name: "У меня есть логин и пароль", exact: true }).or(page.locator("summary").filter({ hasText: "У меня есть логин и пароль" })).click({ timeout: 40000 });
    const form = page.locator("form").filter({ has: page.getByLabel("Логин или email", { exact: true }) });
    await form.getByLabel("Логин или email", { exact: true }).fill(smokeEmail);
    await form.getByLabel("Пароль", { exact: true }).fill(smokePassword);
    await form.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ждём назначения тренера", exact: true })).toBeVisible({ timeout: 40000 });
    await expect(page.getByRole("button", { name: "Проверить доступ", exact: true })).toBeVisible();
    const pendingStyle = await page.getByRole("heading", { name: "Ждём назначения тренера", exact: true }).evaluate(node => {
      const card = node.closest("section"), main = node.closest("main"), button = card.querySelector("button");
      return { layout: getComputedStyle(main).display, radius: Number.parseFloat(getComputedStyle(card).borderRadius), buttonHeight: Number.parseFloat(getComputedStyle(button).minHeight) };
    });
    assert.equal(pendingStyle.layout, "grid");
    assert.ok(pendingStyle.radius >= 20 && pendingStyle.buttonHeight >= 44);
    assert.deepEqual(runtimeErrors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await mkdir("artifacts", { recursive: true });
    await page.screenshot({ path: `artifacts/production-pending-${reportId}.png` });
    pass("Real deployed password login opens the restricted pending screen without runtime errors");
  } finally { await browser.close(); }
  await firestore.patch(`${documentRoot}/users/${uid}`, { fields: {
    role: { stringValue: "client" }, active: { booleanValue: true }, name: { stringValue: "Release smoke (temporary)" },
    accountAccessStatus: { stringValue: "active" }, trainerAssignmentState: { stringValue: "assigned" },
    trainerId: { stringValue: "__release_smoke_trainer__" }, createdByUid: { stringValue: "release-smoke" }
  } });
  const access = await request("/api/exercise-video-access", { source });
  const media = await access.json();
  assert.equal(access.status, 200, `Protected media access failed: ${media.error || access.status}`);
  assert.equal(media.ok, true);
  const signed = new URL(media.url);
  const lifetime = Number(signed.searchParams.get("X-Goog-Expires"));
  assert.ok(lifetime > 840 && lifetime <= 900); // Metadata/signing latency can consume a few seconds.
  assert.ok(signed.searchParams.has("X-Goog-Signature"));
  assert.equal(signed.searchParams.has("token"), false);
  pass("Active membership receives a fifteen-minute signed URL");
  const bytes = await fetch(signed, { headers: { Range: "bytes=0-63" }, signal: AbortSignal.timeout(20000) });
  assert.equal(bytes.status, 206);
  assert.match(bytes.headers.get("content-type") || "", /^video\//);
  assert.equal((await bytes.arrayBuffer()).byteLength, 64);
  pass("Runtime signing and private Storage byte-range playback succeed");
  const forbidden = await request("/api/exercise-video-access", { source: `gs://${project}.firebasestorage.app/users/private/profile/avatar.webp` });
  assert.equal(forbidden.status, 403);
  pass("Video signer refuses private non-video objects");
  const adminOnly = await request("/api/telegram/create-link-code", { targetUid: uid, expectedTelegramUsername: "release_smoke_owner" });
  assert.equal(adminOnly.status, 403);
  pass("Client cannot issue an administrator recovery link");
  const publicMedia = await fetch(base + source, { signal: AbortSignal.timeout(20000) });
  assert.doesNotMatch(publicMedia.headers.get("content-type") || "", /^video\//);
  await publicMedia.body?.cancel();
  pass("Legacy Hosting video path no longer serves public video bytes");
  const plainStorage = new URL(signed);
  plainStorage.search = "";
  const anonymousStorage = await fetch(plainStorage, { method: "HEAD", signal: AbortSignal.timeout(20000) });
  assert.ok([401, 403].includes(anonymousStorage.status));
  pass("Unsigned private Storage access is denied");
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (uid) {
    const rateKeys = ["exercise-video-access", "telegram-create-link-code"].map(action => createHash("sha256").update(`${uid}:${action}`).digest("hex"));
    for (const [label, path] of [["profile", `users/${uid}`], ...rateKeys.map((key, index) => [`rateLimit${index}`, `securityRateLimits/${key}`])]) {
      try {
        if (label === "profile") await removeTemporaryTree(`${documentRoot}/${path}`);
        else await firestore.delete(`${documentRoot}/${path}`);
        report.cleanup[label] = true;
      }
      catch { report.cleanup[label] = false; process.exitCode = 1; }
    }
    try { report.cleanup.authIdentity = (await authRequest("delete", { idToken })).ok; }
    catch { report.cleanup.authIdentity = false; }
    if (!report.cleanup.authIdentity) process.exitCode = 1;
    if (Object.values(report.cleanup).some(value => value === false)) console.error(`Smoke cleanup needs attention for temporary UID ${uid}.`);
  }
  report.finishedAt = new Date().toISOString();
  await mkdir("artifacts", { recursive: true });
  await writeFile(`artifacts/production-video-smoke-${reportId}.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(`Cleanup complete: ${Object.values(report.cleanup).every(Boolean)}.`);
}
