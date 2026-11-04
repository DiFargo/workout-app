// Opt-in, read-only lab baseline. No accounts, forms, screenshots, traces or payload capture.
import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "tren-85720", ORIGIN = "https://tren-85720.web.app";
const fail = code => { throw Object.assign(new Error(code), { measurementCode: code }); };
const check = (value, code) => { if (!value) fail(code); };
const rounded = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;

export function parseEntryMeasurementArgs(args) {
  const options = {}, seen = new Set();
  for (const arg of args) {
    const match = /^--(project|expected-version)=(.+)$/.exec(arg), key = match ? match[1] : arg;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) options[key] = match[2];
    else if (arg === "--run") options.run = true;
    else fail("unknown-argument");
  }
  check(options.run === true && options.project === PROJECT, "explicit-production-readonly-run-required");
  check(/^\d+\.\d+\.\d+$/.test(options["expected-version"] || ""), "expected-version-required");
  return options;
}

export function safeEntryMeasurementError(error) {
  return { code: /^[a-z0-9-]{1,100}$/.test(error?.measurementCode || "") ? error.measurementCode : "measurement-unavailable" };
}

export function permittedEntryRequest({ url, method, headers = {} }) {
  let target;
  try { target = new URL(url); } catch { return false; }
  return target.origin === ORIGIN && !target.username && !target.password && ["GET", "HEAD"].includes(method) &&
    !Object.keys(headers).some(key => /^(authorization|proxy-authorization|cookie|x-firebase-appcheck)$/i.test(key));
}

export function entryMedian(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return rounded(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

async function artifactFor(version) {
  const root = await realpath(ROOT), artifacts = resolve(root, "artifacts");
  await mkdir(artifacts, { recursive: true });
  check(await realpath(artifacts) === artifacts, "symlink-output-forbidden");
  const directory = resolve(artifacts, `remediation-${version}`);
  await mkdir(directory, { recursive: true });
  check(await realpath(directory) === directory, "symlink-output-forbidden");
  const filename = `production-entry-${randomBytes(12).toString("hex")}.json`;
  const file = await open(resolve(directory, filename), "wx");
  return { output: `artifacts/remediation-${version}/${filename}`, save: async report => {
    const text = JSON.stringify(report, null, 2) + "\n";
    await file.write(text, 0, "utf8"); await file.truncate(Buffer.byteLength(text));
  }, close: () => file.close() };
}

async function publishedVersion(version) {
  const response = await fetch(`${ORIGIN}/sw.js?entry-measurement=${randomBytes(6).toString("hex")}`, {
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000)
  });
  if (response.status !== 200) { await response.body?.cancel(); fail("published-version-unavailable"); }
  const reader = response.body.getReader(), chunks = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 512 * 1024) { await reader.cancel(); fail("version-response-too-large"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  check(Buffer.concat(chunks).toString("utf8").includes(`const CACHE_NAME = "workout-app-v${version}";`), "published-version-mismatch");
}

export async function measureProductionEntry(options, dependencies = {}) {
  options = parseEntryMeasurementArgs(Object.entries(options || {}).map(([key, value]) => key === "run" && value === true ? "--run" : `--${key}=${value}`));
  const version = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  check(options["expected-version"] === version, "local-version-mismatch");
  const artifact = await (dependencies.artifactFor || artifactFor)(version);
  const report = { schemaVersion: 1, project: PROJECT, version, startedAt: new Date().toISOString(), samples: [],
    method: { browser: "Chromium headless desktop", network: "unthrottled operator desktop; no network or CPU emulation",
      viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, mobileLayout: true, persistentProfile: false,
      cold: "Three fresh isolated nonpersistent contexts; browser process, OS DNS/TLS and CDN may already be warm",
      warm: "One reload in the third context; native HTTP cache enabled, actual cache counters recorded",
      serviceWorkers: "blocked for all samples to preserve request-stage safety interception",
      requestSafety: "CDP Fetch request-stage allowlist: fixed Hosting origin, GET/HEAD only, no authorization/cookie/AppCheck headers; other origins blocked",
      lcpObservation: "Buffered LargestContentfulPaint observed at >=6000ms after navigation or >=3000ms after auth-entry readiness, whichever is later; not a final user-session LCP" },
    limits: ["Read-only public auth-entry lab baseline, not authenticated member cold boot, field CWV, real iPhone hardware or real Telegram Mini App performance.",
      "External SDKs and service workers are blocked for safety; results describe this explicit environment only.",
      "Resource Timing aggregates include only available browser timing fields; zero transfer size may reflect cache or unavailable accounting.",
      "No navigation to Telegram, form interactions, account operations, auth headers, screenshots, traces, raw resource URLs or payloads are saved."],
    topLevelLoadLimit: 10, topLevelLoads: 0, versionProbeLoads: 0, containsPII: false };
  let browser, currentStep = "initialize";
  try {
    await artifact.save(report);
    currentStep = "published-version"; await (dependencies.publishedVersion || publishedVersion)(version); report.versionProbeLoads = 1;
    currentStep = "browser-launch";
    const chromium = dependencies.chromium || (await import("playwright")).chromium;
    browser = await chromium.launch({ headless: true });
    report.browserVersion = browser.version();
    for (let contextIndex = 0; contextIndex < 3; contextIndex++) {
      const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
        isMobile: true, hasTouch: true, serviceWorkers: "block", acceptDownloads: false });
      try {
        const page = await context.newPage(), cdp = await context.newCDPSession(page);
        let totals = { allowedRequests: 0, blockedRequests: 0, forbiddenMethodOrAuthRequests: 0, fromDiskCache: 0, fromServiceWorker: 0, servedFromCache: 0, pageErrors: 0, guardErrors: 0 };
        const pending = new Set();
        const guard = async event => {
          const request = event.request, allowed = permittedEntryRequest(request);
          if (allowed && event.resourceType === "Document") {
            report.topLevelLoads++;
            if (report.topLevelLoads + report.versionProbeLoads > report.topLevelLoadLimit) {
              totals.guardErrors++; await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }); return;
            }
          }
          if (allowed) { totals.allowedRequests++; await cdp.send("Fetch.continueRequest", { requestId: event.requestId }); }
          else {
            totals.blockedRequests++;
            if (!["GET", "HEAD"].includes(request.method) || Object.keys(request.headers || {}).some(key => /^(authorization|proxy-authorization|cookie|x-firebase-appcheck)$/i.test(key))) totals.forbiddenMethodOrAuthRequests++;
            await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
          }
        };
        cdp.on("Fetch.requestPaused", event => {
          const operation = guard(event).catch(() => { totals.guardErrors++; }).finally(() => pending.delete(operation)); pending.add(operation);
        });
        cdp.on("Network.responseReceived", event => {
          if (event.response.fromDiskCache) totals.fromDiskCache++;
          if (event.response.fromServiceWorker) totals.fromServiceWorker++;
        });
        cdp.on("Network.requestServedFromCache", () => { totals.servedFromCache++; });
        page.on("pageerror", () => { totals.pageErrors++; });
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
        await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
        await page.addInitScript(() => {
          performance.setResourceTimingBufferSize(2000);
          window.__entryMeasurement = { lcpMs: null, lcpAvailable: PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint") };
          if (window.__entryMeasurement.lcpAvailable) new PerformanceObserver(list => {
            for (const entry of list.getEntries()) window.__entryMeasurement.lcpMs = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
        });
        const samples = contextIndex === 2 ? ["cold-3", "warm-reload-1"] : [`cold-${contextIndex + 1}`];
        for (const name of samples) {
          currentStep = name; const before = { ...totals };
          const started = performance.now();
          const response = name.startsWith("warm") ? await page.reload({ waitUntil: "load", timeout: 45000 })
            : await page.goto(`${ORIGIN}/?entry-measurement=${randomBytes(6).toString("hex")}`, { waitUntil: "load", timeout: 45000 });
          check(response?.status() === 200 && page.url().startsWith(`${ORIGIN}/`), "entry-navigation-failed");
          await page.getByRole("heading", { name: "Войти в Zmena", exact: true }).waitFor({ state: "visible", timeout: 30000 });
          check(await page.getByRole("group", { name: "Способ входа" }).getByRole("button", { name: "Telegram", exact: true }).isVisible(), "telegram-entry-unavailable");
          check(await page.getByLabel("Email или логин", { exact: true }).isVisible(), "email-entry-unavailable");
          const readyMs = performance.now() - started;
          const delay = await page.evaluate(() => Math.max(3000, 6000 - performance.now()));
          await page.waitForTimeout(delay);
          const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType("navigation")[0], resources = performance.getEntriesByType("resource");
            const number = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
            const sum = field => resources.reduce((total, entry) => total + (Number.isFinite(entry[field]) ? entry[field] : 0), 0);
            const byType = {};
            for (const resource of resources) {
              const type = ["script", "css", "img", "fetch", "xmlhttprequest", "link", "font"].includes(resource.initiatorType) ? resource.initiatorType : "other";
              const aggregate = byType[type] ||= { count: 0, transferBytes: 0, encodedBodyBytes: 0, durationSumMs: 0, durationMaxMs: 0 };
              aggregate.count++; aggregate.transferBytes += resource.transferSize || 0; aggregate.encodedBodyBytes += resource.encodedBodySize || 0;
              aggregate.durationSumMs += resource.duration || 0; aggregate.durationMaxMs = Math.max(aggregate.durationMaxMs, resource.duration || 0);
            }
            for (const aggregate of Object.values(byType)) { aggregate.durationSumMs = number(aggregate.durationSumMs); aggregate.durationMaxMs = number(aggregate.durationMaxMs); }
            const paints = Object.fromEntries(performance.getEntriesByType("paint").map(entry => [entry.name === "first-contentful-paint" ? "fcpMs" : "firstPaintMs", number(entry.startTime)]));
            return { observationMs: number(performance.now()), navigation: nav ? {
              type: nav.type, durationMs: number(nav.duration), ttfbMs: number(nav.responseStart), dnsMs: number(nav.domainLookupEnd - nav.domainLookupStart),
              connectMs: number(nav.connectEnd - nav.connectStart), tlsMs: nav.secureConnectionStart ? number(nav.connectEnd - nav.secureConnectionStart) : 0,
              responseMs: number(nav.responseEnd - nav.responseStart), domInteractiveMs: number(nav.domInteractive), domContentLoadedMs: number(nav.domContentLoadedEventEnd),
              loadMs: number(nav.loadEventEnd), transferBytes: nav.transferSize, encodedBodyBytes: nav.encodedBodySize, decodedBodyBytes: nav.decodedBodySize
            } : null, paint: { firstPaintMs: null, fcpMs: null, ...paints, lcpMs: number(window.__entryMeasurement.lcpMs), lcpAvailable: window.__entryMeasurement.lcpAvailable },
            resources: { count: resources.length, transferBytes: sum("transferSize"), encodedBodyBytes: sum("encodedBodySize"), decodedBodyBytes: sum("decodedBodySize"),
              durationSumMs: number(sum("duration")), durationMaxMs: number(Math.max(0, ...resources.map(entry => entry.duration))),
              zeroTransferCount: resources.filter(entry => entry.transferSize === 0).length, byType } };
          });
          check(Boolean(metrics.navigation), "navigation-timing-unavailable");
          await Promise.all([...pending]);
          const network = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value - before[key]]));
          report.samples.push({ name, context: contextIndex + 1, authEntryReadyMs: rounded(readyMs), ...metrics, network });
          check(network.guardErrors === 0 && network.forbiddenMethodOrAuthRequests === 0, "request-safety-guard-failed");
          await artifact.save(report);
        }
      } finally { await context.close(); }
    }
    report.p50 = {};
    for (const [group, samples] of [["cold", report.samples.filter(sample => sample.name.startsWith("cold"))], ["allFour", report.samples]]) {
      report.p50[group] = { sampleCount: samples.length, authEntryReadyMs: entryMedian(samples.map(sample => sample.authEntryReadyMs)),
        ttfbMs: entryMedian(samples.map(sample => sample.navigation.ttfbMs)), fcpMs: entryMedian(samples.map(sample => sample.paint.fcpMs)),
        observedLcpMs: entryMedian(samples.map(sample => sample.paint.lcpMs)), resourceTransferBytes: entryMedian(samples.map(sample => sample.resources.transferBytes)),
        resourceDurationMaxMs: entryMedian(samples.map(sample => sample.resources.durationMaxMs)) };
    }
    check(report.samples.length === 4 && report.topLevelLoads === 4, "unexpected-sample-or-load-count");
    report.failed = false;
  } catch (error) { report.failed = true; report.failedStep = currentStep; report.failure = safeEntryMeasurementError(error); }
  finally {
    try { await browser?.close(); report.browserClosed = true; }
    catch { report.browserClosed = false; report.failed = true; }
    report.finishedAt = new Date().toISOString();
    try { await artifact.save(report); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { report, output } = await measureProductionEntry(parseEntryMeasurementArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ project: report.project, version: report.version, failed: report.failed, samples: report.samples.length,
      topLevelLoads: report.topLevelLoads, browserClosed: report.browserClosed, p50: report.p50 || null, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ ok: false, ...safeEntryMeasurementError(error) })); process.exitCode = 1; }
}
