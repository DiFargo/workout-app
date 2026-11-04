import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { entryMedian, measureProductionEntry, parseEntryMeasurementArgs, permittedEntryRequest, safeEntryMeasurementError } from "../scripts/measure-production-entry.mjs";

const version = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const args = ["--run", "--project=tren-85720", `--expected-version=${version}`];

test("entry measurement is opt-in exact Production/version only, with no arbitrary target/output override", async () => {
  assert.equal(parseEntryMeasurementArgs(args).project, "tren-85720");
  for (const invalid of [[], args.slice(1), [...args, "--run"], [...args, "--url=https://attacker.invalid"], [...args, "--output=../outside.json"],
    args.map(arg => arg === "--project=tren-85720" ? "--project=tren-85720-staging" : arg),
    args.map(arg => arg.startsWith("--expected-version=") ? "--expected-version=invalid" : arg)])
    assert.throws(() => parseEntryMeasurementArgs(invalid));
  let artifactCreated = false;
  await assert.rejects(measureProductionEntry({ ...parseEntryMeasurementArgs(args), run: false }, {
    artifactFor: async () => { artifactCreated = true; }
  }));
  assert.equal(artifactCreated, false);
});

test("request-stage policy permits only exact Hosting GET/HEAD and rejects credentials/mutation/foreign origins", () => {
  for (const method of ["GET", "HEAD"]) assert.equal(permittedEntryRequest({ url: "https://tren-85720.web.app/assets/public.js", method }), true);
  for (const request of [
    { url: "https://tren-85720.web.app/api/mutate", method: "POST" },
    { url: "https://tren-85720-staging.web.app/", method: "GET" },
    { url: "https://tren-85720.web.app.attacker.invalid/", method: "GET" },
    { url: "http://tren-85720.web.app/", method: "GET" },
    { url: "https://user:secret@tren-85720.web.app/", method: "GET" },
    { url: "https://tren-85720.web.app/", method: "GET", headers: { Authorization: "Bearer secret" } },
    { url: "https://tren-85720.web.app/", method: "GET", headers: { COOKIE: "private-session" } },
    { url: "https://tren-85720.web.app/", method: "GET", headers: { "x-firebase-appcheck": "private" } }
  ]) assert.equal(permittedEntryRequest(request), false);
});

test("median never treats unavailable timings as zero and supports the explicit three/four sample summaries", () => {
  assert.equal(entryMedian([null, undefined, NaN]), null);
  assert.equal(entryMedian([null, 30, 10, 20]), 20);
  assert.equal(entryMedian([10, 30, 20, 40]), 25);
});

test("output initialization must complete before any browser or public version request", async () => {
  let network = false, browser = false;
  await assert.rejects(measureProductionEntry(parseEntryMeasurementArgs(args), {
    artifactFor: async () => { throw Error("output-refused"); },
    publishedVersion: async () => { network = true; }, chromium: { launch: async () => { browser = true; } }
  }));
  assert.equal(network, false); assert.equal(browser, false);
});

test("browser is independently closed and safe report persisted after a failed sample", async () => {
  let closed = false, saved, artifactClosed = false;
  const { report } = await measureProductionEntry(parseEntryMeasurementArgs(args), {
    artifactFor: async () => ({ output: "offline-only", save: async report => { saved = JSON.stringify(report); }, close: async () => { artifactClosed = true; } }),
    publishedVersion: async () => {}, chromium: { launch: async () => ({ version: () => "123.0.0.0", newContext: async () => { throw Error("DO-NOT-OUTPUT https://private-provider.invalid/resource"); }, close: async () => { closed = true; } }) }
  });
  assert.equal(report.failed, true); assert.equal(report.browserClosed, true); assert.equal(closed, true); assert.equal(artifactClosed, true);
  assert.equal(saved.includes("DO-NOT-OUTPUT"), false); assert.equal(saved.includes("private-provider.invalid"), false);
  assert.deepEqual(safeEntryMeasurementError(Error("raw secret")), { code: "measurement-unavailable" });
});
