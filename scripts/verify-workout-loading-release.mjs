import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { accountToken } from "./exercise-preview-batch.mjs";

const version = JSON.parse(await readFile("package.json", "utf8")).version, project = "tren-85720";
assert.ok(["3.0.868", "3.0.869"].includes(version));
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const keys = ["src/App.jsx", "src/features/client/workouts/WorkoutListPage.jsx", "src/features/client/workouts/WorkoutRunRoute.jsx"];
const chunks = keys.map(key => { assert.ok(manifest[key]); return manifest[key]; });
const protectedChunk = Object.values(manifest).find(chunk => /\/ProtectedExerciseVideo-[^/]+\.js$/.test(chunk.file));
assert.ok(protectedChunk); chunks.push(protectedChunk);
const paths = [...new Set(["index.html", "sw.js", ...chunks.flatMap(chunk => [chunk.file, ...(chunk.css || [])])])];
const hash = bytes => createHash("sha256").update(bytes).digest("hex"), files = [];
for (const path of paths) {
  const response = await fetch(`https://${project}.web.app/${path}?verify=${version}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  const remote = Buffer.from(await response.arrayBuffer()), expected = hash(await readFile(resolve("dist", path)));
  assert.equal(hash(remote), expected); files.push({ path, status: 200, sha256: expected, matchingArtifact: true });
}
const token = await accountToken();
const get = async url => {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200); return response.json();
};
const latestRelease = (await get(`https://firebasehosting.googleapis.com/v1beta1/sites/${project}/releases?pageSize=1&fields=releases(name,releaseTime,version(name,status))`)).releases[0];
const videoAccessFunction = await get(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/europe-west1/functions/exerciseVideoAccess?fields=name,state,updateTime,serviceConfig(revision)`);
assert.equal(videoAccessFunction.state, "ACTIVE");
const report = { version, project, targets: version === "3.0.869" ? ["hosting"] : ["hosting", "functions:exerciseVideoAccess"], verifiedAt: new Date().toISOString(), latestRelease, videoAccessFunction, files, containsClientData: false };
await mkdir(`artifacts/remediation-${version}`, { recursive: true });
await writeFile(`artifacts/remediation-${version}/production-artifact-verification.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ version, verifiedFiles: files.length, latestRelease, videoAccessFunction, containsClientData: false }));
