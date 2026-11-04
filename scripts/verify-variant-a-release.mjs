import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const previewPort = Number(process.env.AUDIT_PREVIEW_PORT || 4195);
assert.ok(Number.isInteger(previewPort) && previewPort >= 1024 && previewPort <= 65535);
const directory = resolve(`artifacts/variant-a-${version}`);
const file = resolve(directory, "report.html");
const html = await readFile(file, "utf8");
for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (/^(?:https?:|#)/.test(match[1])) continue;
  const path = resolve(dirname(file), match[1].split("#")[0]);
  const inside = relative(resolve("artifacts"), path);
  assert.ok(!inside.startsWith("..") && !isAbsolute(inside));
  await access(path);
}
const inventories = [];
for (const name of ["index.json", "chromium/index.json"]) {
  const inventory = JSON.parse(await readFile(`artifacts/telegram-visual-audit-${version}/${name}`, "utf8"));
  assert.equal(inventory.version, version);
  assert.equal(inventory.productionDeploymentVerifiedByOperator, true);
  assert.equal(inventory.summary.captured, 80);
  assert.equal(inventory.summary.failed, 0);
  assert.deepEqual(inventory.summary.unattempted, []);
  assert.equal(inventory.screens.filter(item => item.status === "captured" && item.screenshot).length, 80);
  assert.equal(new Set(inventory.screens.map(item => item.key)).size, 80);
  assert.ok(inventory.screens.every(item => !item.runtimeErrors?.length));
  inventories.push(inventory);
}
assert.deepEqual(inventories.map(item => item.browser).sort(), ["chromium", "webkit"]);
assert.deepEqual(inventories[0].screens.map(item => item.key).sort(), inventories[1].screens.map(item => item.key).sort());
await access(`artifacts/telegram-visual-audit-${version}/capture-run-notes.json`);
const release = JSON.parse(await readFile(resolve(directory, "release-status.json"), "utf8"));
assert.equal(release.version, version);
assert.equal(release.production.project, "tren-85720");
assert.deepEqual(release.production.targets, ["hosting"]);
assert.equal(release.production.verified, true);
assert.ok(Number.isFinite(Date.parse(release.production.verifiedAt)));
const acceptance = JSON.parse(await readFile(resolve(directory, "acceptance.json"), "utf8"));
const prior = JSON.parse(await readFile("artifacts/telegram-visual-audit-3.0.838/review.json", "utf8"));
assert.equal(acceptance.version, version);
assert.equal(acceptance.items.length, 22);
assert.deepEqual(acceptance.items.map(item => item.id).sort(), prior.findings.map(item => item.id).sort());
assert.ok(acceptance.items.every(item => item.status === "implemented" && !item.followUp));
const final = JSON.parse(await readFile(resolve(directory, "final-logout-summary.json"), "utf8"));
assert.equal(final.version, version);
assert.equal(final.core.exitCode, 0);
assert.equal(final.focusedE2e.exitCode, 0);
assert.equal(final.focusedE2e.passed, 22);
assert.equal(final.focusedE2e.failed, 0);
assert.ok(html.includes('href="final-logout-summary.json"'));
const live = JSON.parse(await readFile(resolve(directory, release.evidence.liveEmailHandoff), "utf8"));
assert.equal(live.project, "tren-85720-staging");
assert.equal(live.version, version);
assert.equal(live.passed, true);
assert.equal(live.cases.length, 4);
assert.ok(live.cases.every(item => item.passed));
assert.equal(live.cleanup.complete, true);
assert.ok(["authAbsent", "profileAbsent", "aliasAbsent", "descendantsAbsent", "rateRecordsAbsent"].every(key => live.cleanup[key] === true));
const productionSmoke = JSON.parse(await readFile(resolve(directory, release.evidence.productionSmoke), "utf8"));
assert.equal(productionSmoke.project, "tren-85720");
assert.equal(productionSmoke.version, version);
assert.equal(productionSmoke.cases.length, 9);
assert.ok(productionSmoke.cases.every(item => item.passed));
assert.ok(Object.values(productionSmoke.cleanup).every(value => value === true));
assert.equal(release.evidence.temporaryPermissionJournals.length, 3);
for (const name of release.evidence.temporaryPermissionJournals) {
  const journal = JSON.parse(await readFile(resolve(directory, name), "utf8"));
  assert.equal(journal.ownership.project, "tren-85720-staging");
  const result = journal.events.at(-1).result;
  assert.equal(result.cleanupVerified, true);
  assert.equal(result.grantOutcomeUnresolved, false);
}
if (release.observation.complete) {
  const health = JSON.parse(await readFile(resolve(directory, "post-release-health.json"), "utf8"));
  assert.equal(health.project, "tren-85720");
  assert.equal(health.window.since, release.observation.since);
  assert.ok(health.window.durationSeconds >= 1800);
  assert.ok(Date.parse(health.window.until) >= Date.parse(release.observation.minimumUntil));
  assert.ok(Date.parse(health.window.until) <= Date.now());
  assert.equal(health.readOnly, true);
  assert.equal(health.containsRawLogPayloads, false);
  assert.ok(html.includes('href="post-release-health.json"'));
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.name));
  for (const path of [
    `/artifacts/variant-a-${version}/%2e%2e%2fproduction-video-smoke-staging-${version}.json`,
    `/artifacts/variant-a-${version}/%2e%2e%2f%2e%2e%2fpackage.json`
  ]) {
    const response = await page.request.get(`http://127.0.0.1:${previewPort}${path}`);
    assert.equal(response.status(), 404, "Report preview must deny canonical paths outside its allowlist.");
  }
  await page.goto(`http://127.0.0.1:${previewPort}/artifacts/variant-a-${version}/report.html`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Опубликовано в Production", { exact: true })).toBeVisible();
  await expect(page.locator(".change")).toHaveCount(22);
  await expect(page.locator("#gallery ~ .gallery").first().locator(".screen")).toHaveCount(80);
  await page.locator(".change summary").first().click();
  await expect(page.locator(".change").first().locator("p").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(directory, "report-desktop-preview.png") });
  await page.setViewportSize({ width: 402, height: 874 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(directory, "report-mobile-preview.png") });
  await page.locator("#gallery").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".screen img").first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  assert.deepEqual(errors, []);
  console.log("Variant A report verified: published version, 22 changes, 80 dual-browser states, local links and mobile width.");
} finally { await browser.close(); }
