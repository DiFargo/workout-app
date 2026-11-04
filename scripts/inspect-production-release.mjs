import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const base = "https://tren-85720.web.app";
const localIndex = await readFile("dist/index.html", "utf8");
const assets = [...localIndex.matchAll(/(?:src|href)="(\/assets\/[^"\s]+\.js)"/g)].map(match => match[1]);
assert.ok(assets.length);
for (const path of ["/sw.js", "/?verify=" + version]) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  assert.equal(response.status, 200);
  const body = await response.text();
  if (path === "/sw.js") assert.ok(body.includes(`workout-app-v${version}`));
  else for (const asset of assets) assert.ok(body.includes(asset));
  console.log(JSON.stringify({ resource: path.split("?")[0], status: response.status, expectedVersion: version, matchingArtifact: true }));
}
