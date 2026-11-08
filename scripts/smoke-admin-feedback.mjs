// Explicitly authorized synthetic accounts only. Never modifies real feedback.
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { accountToken } from "./exercise-preview-batch.mjs";
assert.ok(process.argv.includes("--run") && process.argv.includes("--project=tren-85720"), "Explicit production confirmation required");
const project = "tren-85720", bucket = `${project}.firebasestorage.app`, base = `https://${project}.web.app`;
const docs = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:`;
const marker = `feedback-smoke-${randomBytes(12).toString("hex")}`;
const report = { project, marker, checks: [], ownedUids: [], cleanup: [], failed: false };
const directory = "output/playwright/admin-feedback-production";
await mkdir(directory, { recursive: true });
const reportFile = `${directory}/${marker}.json`;
const save = () => writeFile(reportFile, JSON.stringify(report, null, 2));
await save();
const operator = await accountToken();
const accounts = [], files = [];
const fields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === null ? { nullValue: null } :
  typeof item === "boolean" ? { booleanValue: item } : typeof item === "number" ? { integerValue: String(item) } :
    Array.isArray(item) ? { arrayValue: { values: item.map(entry => ({ mapValue: { fields: fields(entry) } })) } } : { stringValue: String(item) }]));
async function call(url, { token = operator, method = "GET", body, expected = 200, headers = {}, raw = false } = {}) {
  const response = await fetch(url, { method, signal: AbortSignal.timeout(25000), redirect: "error",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status !== expected) { await response.body?.cancel(); throw new Error(`Unexpected HTTP ${response.status}; expected ${expected}`); }
  if (raw) { const bytes = Buffer.from(await response.arrayBuffer()); assert.ok(bytes.length < 2 * 1024 * 1024); return bytes; }
  if (expected !== 200) { await response.body?.cancel(); return null; }
  return response.json();
}
const api = (account, body, expected = 200) => call(`${base}/api/admin/feedback`, { method: "POST", token: account?.token || "", body, expected });
try {
  const config = await call(`${base}/__/firebase/init.json`, { token: "" });
  assert.equal(config.projectId, project);
  await api(null, { action: "list" }, 401); report.checks.push("unauthenticated-denied");
  for (const role of ["client", "admin"]) {
    const email = `${marker}-${role}@example.invalid`, password = randomBytes(30).toString("base64url");
    const absence = await call(`${authAdmin}lookup`, { method: "POST", body: { email: [email] } });
    assert.equal((absence.users || []).length, 0);
    const signup = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`, { token: "", method: "POST", body: { email, password, returnSecureToken: true } });
    assert.match(signup.localId, /^[A-Za-z0-9_-]{1,128}$/);
    const account = { uid: signup.localId, token: signup.idToken, role, email };
    accounts.push(account); report.ownedUids.push(account.uid); await save();
    await call(`${docs}/users/${account.uid}?currentDocument.exists=false`, { method: "PATCH", body: { fields: fields({ role, active: true, name: "Synthetic feedback test", email, accountAccessStatus: "active", createdByUid: marker }) } });
    if (role === "admin") {
      await call(`${authAdmin}update`, { method: "POST", body: { localId: account.uid, customAttributes: JSON.stringify({ admin: true }) } });
      const login = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, { token: "", method: "POST", body: { email, password, returnSecureToken: true } });
      account.token = login.idToken;
    }
  }
  const [client, admin] = accounts;
  await api(client, { action: "list" }, 403); report.checks.push("client-denied");
  const id = marker, path = `users/${client.uid}/feedback/${id}`, attachments = [];
  for (const name of ["first.txt", "second.log"]) {
    const path = `feedback/${client.uid}/${id}/${name}`;
    files.push(path);
    const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(path)}`, {
      method: "POST", headers: { Authorization: `Firebase ${client.token}`, "Content-Type": "text/plain", "X-Goog-Upload-Protocol": "raw" },
      body: Buffer.from("synthetic feedback proof"), signal: AbortSignal.timeout(25000) });
    assert.equal(response.status, 200, "Synthetic client attachment upload failed"); await response.body?.cancel();
    attachments.push({ name, path, size: Buffer.byteLength("synthetic feedback proof"), type: "text/plain" });
  }
  await call(`${docs}/${path}?currentDocument.exists=false`, { method: "PATCH", token: client.token, body: { fields: fields({
    type: "bug", message: "Synthetic feedback verification, remove after smoke.", contact: "", userId: client.uid, recipient: "admin",
    status: "new", displayName: "Synthetic feedback test", createdAt: new Date().toISOString(), createdByUid: marker, attachments
  }) } });
  report.checks.push("client-created-feedback-with-two-files");
  const listed = await api(admin, { action: "list" });
  const item = listed.items.find(item => item.path === path);
  assert.equal(item?.attachments?.length, 2); report.checks.push("admin-received-two-attachments");
  for (const file of attachments) {
    const result = await api(admin, { action: "attachment", path, attachmentPath: file.path });
    const url = new URL(result.url);
    assert.equal(url.protocol, "https:"); assert.equal(url.hostname, "storage.googleapis.com");
    assert.equal(decodeURIComponent(url.pathname), `/${bucket}/${file.path}`);
    assert.equal(Number(url.searchParams.get("X-Goog-Expires")) <= 300, true);
    const bytes = await call(url, { token: "", raw: true }); assert.equal(bytes.toString(), "synthetic feedback proof");
  }
  report.checks.push("admin-downloads-two-files");
  await api(client, { action: "attachment", path, attachmentPath: attachments[0].path }, 403);
  await api(admin, { action: "attachment", path, attachmentPath: `feedback/${admin.uid}/other/test.txt` }, 403);
  report.checks.push("client-and-unrelated-file-denied");
  await api(admin, { action: "status", path, status: "processed" });
  const saved = await call(`${docs}/${path}`);
  assert.equal(saved.fields.status.stringValue, "processed");
  report.checks.push("admin-status-persisted");
} catch (error) { report.failed = true; report.error = error.message; }
finally {
  for (const path of files) {
    try { await call(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`, { method: "DELETE", expected: 204 });
      await call(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`, { expected: 404 }); report.cleanup.push("file-absent");
    } catch { report.failed = true; report.cleanup.push("file-cleanup-failed"); }
  }
  for (const account of accounts) {
    try {
      const path = `users/${account.uid}/feedback/${marker}`;
      const response = await fetch(`${docs}/${path}`, { headers: { Authorization: `Bearer ${operator}` }, signal: AbortSignal.timeout(20000) });
      if (response.status === 200) {
        const doc = await response.json(); assert.equal(doc.fields.createdByUid.stringValue, marker);
        await call(`${docs}/${path}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, { method: "DELETE" });
      } else { assert.equal(response.status, 404); await response.body?.cancel(); }
      await call(`${docs}/${path}`, { expected: 404 });
      const profile = await call(`${docs}/users/${account.uid}`); assert.equal(profile.fields.createdByUid.stringValue, marker);
      await call(`${docs}/users/${account.uid}?currentDocument.updateTime=${encodeURIComponent(profile.updateTime)}`, { method: "DELETE" });
      await call(`${docs}/users/${account.uid}`, { expected: 404 });
      const ratePath = `securityRateLimits/${createHash("sha256").update(`${account.uid}:admin-feedback`).digest("hex")}`;
      const rate = await fetch(`${docs}/${ratePath}`, { headers: { Authorization: `Bearer ${operator}` }, signal: AbortSignal.timeout(20000) });
      if (rate.status === 200) { const doc = await rate.json(); assert.equal(doc.fields.uid.stringValue, account.uid); await call(`${docs}/${ratePath}`, { method: "DELETE" }); }
      else { assert.equal(rate.status, 404); await rate.body?.cancel(); }
      await call(`${docs}/${ratePath}`, { expected: 404 });
      report.cleanup.push(`${account.role}-data-absent`);
    } catch { report.failed = true; report.cleanup.push(`${account.role}-data-cleanup-failed`); }
    try {
      await call(`${authAdmin}delete`, { method: "POST", body: { localId: account.uid } });
      const lookup = await call(`${authAdmin}lookup`, { method: "POST", body: { localId: [account.uid] } }); assert.equal((lookup.users || []).length, 0);
      report.cleanup.push(`${account.role}-account-absent`);
    } catch { report.failed = true; report.cleanup.push(`${account.role}-cleanup-failed`); }
  }
  await save();
}
console.log(JSON.stringify({ passed: !report.failed, checks: report.checks, cleanup: report.cleanup, reportFile }));
if (report.failed) process.exitCode = 1;
