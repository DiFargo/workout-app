import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { accountToken } from "./exercise-preview-batch.mjs";

const version = "3.0.867", project = "tren-85720";
assert.equal(JSON.parse(await readFile("package.json", "utf8")).version, version);
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const targets = ["src/App.jsx", "src/app/AdminLibraryRoute.jsx", "src/features/client/workouts/BasicWorkoutTodayPage.jsx", "src/features/client/workouts/WorkoutRunRoute.jsx"];
const chunks = targets.map(key => { assert.ok(manifest[key], `Missing ${key}`); return manifest[key]; });
const paths = [...new Set(["index.html", "sw.js", ...chunks.flatMap(chunk => [chunk.file, ...(chunk.css || [])])])];
const hash = bytes => createHash("sha256").update(bytes).digest("hex"), files = [];
for (const path of paths) {
  const response = await fetch(`https://${project}.web.app/${path}?verify=${version}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  const remote = Buffer.from(await response.arrayBuffer()), expected = hash(await readFile(resolve("dist", path)));
  assert.equal(hash(remote), expected);
  files.push({ path, status: 200, sha256: expected, matchingArtifact: true });
}
const token = await accountToken();
const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${project}/releases?pageSize=1&fields=releases(name,releaseTime,version(name,status))`, {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000)
});
assert.equal(response.status, 200);
const latestRelease = (await response.json()).releases[0];
const report = { version, project, targets: ["hosting"], verifiedAt: new Date().toISOString(), latestRelease, files, containsClientData: false };
await mkdir(`artifacts/remediation-${version}`, { recursive: true });
await writeFile(`artifacts/remediation-${version}/production-artifact-verification.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ version, verifiedFiles: files.length, latestRelease, containsClientData: false }));
