import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { accountToken } from "./exercise-preview-batch.mjs";

assert.ok(process.argv.includes("--run") && process.argv.includes("--project=tren-85720"));
const project = "tren-85720", root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const token = await accountToken();
const request = async (url, method = "GET", body) => fetch(url, {
  method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000)
});
const response = await request(`${root}:runQuery`, "POST", { structuredQuery: {
  from: [{ collectionId: "users" }], limit: 2,
  where: { fieldFilter: { field: { fieldPath: "createdByUid" }, op: "EQUAL", value: { stringValue: "preview-smoke-3.0.869" } } }
} });
assert.equal(response.status, 200);
const candidates = (await response.json()).filter(item => item.document).map(item => item.document);
assert.ok(candidates.length <= 1, "Only one explicitly authorized temporary identity expected");
const report = { version: "3.0.869", cleanupOnly: true, candidates: candidates.length, results: [] };
for (const candidate of candidates) {
  const uid = candidate.name.split("/").at(-1), fields = candidate.fields;
  assert.equal(fields.role?.stringValue, "client");
  assert.match(fields.email?.stringValue || "", /^preview-smoke-[a-f0-9]{24}@example\.invalid$/);
  const userPath = `${root}/users/${uid}`;
  let deleted = 0;
  async function removeTree(path, depth = 0) {
    assert.ok(path === userPath || path.startsWith(userPath + "/"));
    assert.ok(depth <= 6 && ++deleted <= 100);
    const ids = await request(path + ":listCollectionIds", "POST", { pageSize: 100 });
    assert.equal(ids.status, 200); const collections = await ids.json(); assert.ok(!collections.nextPageToken);
    for (const collection of collections.collectionIds || []) {
      const listed = await request(`${path}/${collection}?pageSize=100`); assert.equal(listed.status, 200);
      const children = await listed.json(); assert.ok(!children.nextPageToken);
      for (const child of children.documents || []) await removeTree(`https://firestore.googleapis.com/v1/${child.name}`, depth + 1);
    }
    assert.ok([200, 404].includes((await request(path, "DELETE")).status));
  }
  await removeTree(userPath);
  const rate = createHash("sha256").update(`${uid}:exercise-video-access`).digest("hex");
  await request(`${root}/securityRateLimits/${rate}`, "DELETE");
  assert.equal((await request(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`, "POST", { localId: uid })).status, 200);
  const lookup = await request(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, "POST", { localId: [uid] });
  assert.equal(lookup.status, 200); assert.ok(!(await lookup.json()).users?.length);
  assert.equal((await request(userPath)).status, 404);
  assert.equal((await request(`${userPath}/workouts/preview_smoke_workout`)).status, 404);
  assert.equal((await request(`${root}/securityRateLimits/${rate}`)).status, 404);
  const remaining = await request(userPath + ":listCollectionIds", "POST", { pageSize: 100 });
  assert.equal(remaining.status, 200); assert.ok(!(await remaining.json()).collectionIds?.length);
  report.results.push({ firestore: true, authIdentity: true, subcollectionsEmpty: true, rateLimit: true });
}
report.finishedAt = new Date().toISOString();
await mkdir("output/playwright/workout-loading-3.0.869", { recursive: true });
await writeFile("output/playwright/workout-loading-3.0.869/recovery-cleanup.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
