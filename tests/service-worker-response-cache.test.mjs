import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

test("service worker clones before delayed caches.open, so consuming the original cannot break background caching", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  let openCache, background, cachedRequest, cachedBody;
  const opening = new Promise(resolve => { openCache = resolve; });
  const warnings = [];
  const context = createContext({
    self: { addEventListener() {}, location: { origin: "https://synthetic.test" } },
    caches: { open: () => opening },
    console: { warn: (...values) => warnings.push(values) }, URL
  });
  runInContext(source, context);
  const payload = "synthetic response consumed by the page";
  const original = new Response(payload);
  context.cacheInBackground({ waitUntil: promise => { background = promise; } },
    "synthetic-cache", "/synthetic.js", original, 32);

  // Simulate respondWith handing the network response to the browser before
  // CacheStorage finishes opening. Only its earlier clone may reach cache.put.
  assert.equal(await original.text(), payload);
  assert.equal(original.bodyUsed, true);
  openCache({ put: async (request, response) => {
    cachedRequest = request;
    assert.notEqual(response, original);
    cachedBody = await response.text();
  }, keys: async () => [] });
  await background;
  assert.equal(cachedRequest, "/synthetic.js");
  assert.equal(cachedBody, payload);
  assert.deepEqual(warnings, []);
});
