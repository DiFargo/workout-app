// Recover ONLY the three synthetic accounts from the exact recorded staging smoke run.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const project = "tren-85720-staging";
const report = JSON.parse(await readFile("artifacts/staging-live-smoke.json", "utf8"));
assert.equal(report.project, project);
const start = Date.parse(report.startedAt) - 1000;
const finish = Date.parse(report.finishedAt) + 1000;
assert.ok(Number.isFinite(start) && finish > start && finish - start < 600000);
const require = createRequire(import.meta.url);
const cliRoot = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
const { Client } = require(resolve(cliRoot, "apiv2.js"));
const account = getGlobalDefaultAccount();
assert.ok(account, "Firebase CLI operator sign-in required");
await requireAuth({ ...account, project }, true);
const auth = new Client({ urlPrefix: "https://identitytoolkit.googleapis.com" });
const db = new Client({ urlPrefix: "https://firestore.googleapis.com" });
// Firebase CLI Client mutates options; every invocation MUST receive a fresh object.
const safe = extra => ({ skipLog: { reqBody: true, resBody: true }, ...extra });
const root = `/v1/projects/${project}/databases/(default)/documents`;
let offset = 0;
const candidates = [];
for (;;) {
  const res = await auth.post(`/v1/projects/${project}/accounts:query`, { offset: String(offset), limit: "500" }, safe());
  const users = res.body.userInfo || [];
  for (const user of users) {
    const match = String(user.email || "").match(/^staging-smoke-([a-f0-9]{24})-(client|trainer|admin)@example\.invalid$/);
    if (match && Number(user.createdAt) >= start && Number(user.createdAt) <= finish) candidates.push({ uid: user.localId, tag: match[1], role: match[2] });
  }
  offset += users.length;
  if (users.length < 500) break;
}
if (!candidates.length) {
  // Auth deletion may already have succeeded while the earlier Firestore cleanup failed.
  const response = await db.post(`${root}:runQuery`, { structuredQuery: {
    from: [{ collectionId: "users" }],
    where: { fieldFilter: { field: { fieldPath: "createdByUid" }, op: "EQUAL", value: { stringValue: "staging-live-smoke" } } }
  } }, safe());
  for (const row of response.body) {
    const doc = row.document;
    if (!doc) continue;
    const email = doc.fields?.email?.stringValue || "";
    const match = email.match(/^staging-smoke-([a-f0-9]{24})-(client|trainer|admin)@example\.invalid$/);
    if (!match) continue;
    assert.equal(doc.fields?.name?.stringValue, `Synthetic smoke ${match[2]}`);
    assert.equal(doc.fields?.role?.stringValue, match[2]);
    assert.ok(Date.parse(doc.createTime) >= start && Date.parse(doc.createTime) <= finish);
    candidates.push({ uid: doc.name.split("/").at(-1), tag: match[1], role: match[2] });
  }
}
assert.equal(candidates.length, 3, "Refusing cleanup: exact recorded run must contain three synthetic identities/profiles");
assert.equal(new Set(candidates.map(user => user.tag)).size, 1);
assert.deepEqual(candidates.map(user => user.role).sort(), ["admin", "client", "trainer"]);
assert.ok(candidates.every(user => typeof user.uid === "string" && /^[a-zA-Z0-9_-]+$/.test(user.uid)));
console.log("Exact recorded synthetic run matched: client/trainer/admin (3), staging only.");
async function remove(path) {
  const collections = await db.post(`${path}:listCollectionIds`, { pageSize: 100 }, safe());
  for (const collection of collections.body.collectionIds || []) {
    let token;
    do {
      const result = await db.get(`${path}/${collection}`, safe({ queryParams: { pageSize: 100, ...(token ? { pageToken: token } : {}) } }));
      for (const doc of result.body.documents || []) await remove(`/v1/${doc.name}`);
      token = result.body.nextPageToken;
    } while (token);
  }
  const deleted = await db.delete(path, safe({ resolveOnHTTPError: true }));
  assert.ok([200, 204, 404].includes(deleted.status), "Document cleanup failed");
}
const results = [];
for (const candidate of candidates) {
  const path = `${root}/users/${candidate.uid}`;
  const before = await db.get(path, safe({ resolveOnHTTPError: true }));
  const collections = await db.post(`${path}:listCollectionIds`, { pageSize: 100 }, safe());
  console.log(`${candidate.role}: profile HTTP ${before.status}, child collections ${(collections.body.collectionIds || []).length}.`);
  if (!process.argv.includes("--cleanup")) continue;
  let documentRemoved = false, authRemoved = false, ratesRemoved = false;
  try { await remove(path); documentRemoved = true; } catch { /* Continue other scoped cleanup steps. */ }
  try {
    for (const action of ["exercise-video-access", "client-exercise-media", "telegram-create-link-code"]) {
      const key = createHash("sha256").update(`${candidate.uid}:${action}`).digest("hex");
      const deleted = await db.delete(`${root}/securityRateLimits/${key}`, safe({ resolveOnHTTPError: true }));
      assert.ok([200, 204, 404].includes(deleted.status));
    }
    ratesRemoved = true;
  } catch { /* Independent Auth deletion still follows. */ }
  try {
    const existing = await auth.post(`/v1/projects/${project}/accounts:lookup`, { localId: [candidate.uid] }, safe());
    if ((existing.body.users || []).length) await auth.post(`/v1/projects/${project}/accounts:delete`, { localId: candidate.uid }, safe());
    authRemoved = true;
  } catch { /* Verification below remains authoritative. */ }
  const profile = await db.get(path, safe({ resolveOnHTTPError: true }));
  const descendants = await db.post(`${path}:listCollectionIds`, { pageSize: 100 }, safe());
  const identity = await auth.post(`/v1/projects/${project}/accounts:lookup`, { localId: [candidate.uid] }, safe());
  const result = { label: candidate.role, cleaned: documentRemoved && authRemoved && ratesRemoved && profile.status === 404 && !(descendants.body.collectionIds || []).length && !(identity.body.users || []).length };
  results.push(result);
  console.log(`${candidate.role}: Auth absent ${!(identity.body.users || []).length}, profile absent ${profile.status === 404}, subcollections absent ${!(descendants.body.collectionIds || []).length}, rate records deleted ${ratesRemoved}.`);
}
if (process.argv.includes("--cleanup")) {
  report.cleanup = results;
  report.cleanupVerifiedAt = new Date().toISOString();
  await writeFile("artifacts/staging-live-smoke.json", JSON.stringify(report, null, 2) + "\n");
  assert.ok(results.every(result => result.cleaned), "Synthetic cleanup incomplete");
}
