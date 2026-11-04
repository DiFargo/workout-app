import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const origin = "http://127.0.0.1:4195";
const file = resolve(`artifacts/telegram-visual-audit-${version}/report.html`);
const html = await readFile(file, "utf8");
const review = JSON.parse(await readFile(resolve(dirname(file), "review.json"), "utf8"));
for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (/^(?:https?:|#)/.test(match[1])) continue;
  const path = resolve(dirname(file), match[1]);
  assert.ok(path.startsWith(resolve("artifacts") + "/") || path.startsWith(resolve("artifacts") + "\\"));
  await access(path);
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/artifacts/telegram-visual-audit-${version}/report.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".screen")).toHaveCount(80);
  await expect(page.locator(".finding")).toHaveCount(22);
  if (review.release.postReleaseHealth) {
    await expect(page.getByRole("heading", { name: "Послерелизный контроль" })).toBeVisible();
    await expect(page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Послерелизный контроль" }) })).toContainText(review.release.postReleaseHealth.summaryRU);
  }
  await page.locator(".toolbar").getByRole("button", { name: "Тренер", exact: true }).click();
  await expect(page.locator(".screen:visible")).toHaveCount(16);
  await page.locator(".toolbar").getByRole("button", { name: "Все", exact: true }).click();
  await page.getByRole("searchbox", { name: "Найти экран" }).fill("workout-set-editor");
  await expect(page.locator(".screen:visible")).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Найти экран" }).fill("");
  await expect.poll(() => page.locator(".screen img").first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: `artifacts/telegram-visual-audit-${version}/report-gallery-preview.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `artifacts/telegram-visual-audit-${version}/report-desktop-preview.png` });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto(`${origin}/artifacts/telegram-visual-audit-${version}/report.html`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.screenshot({ path: `artifacts/telegram-visual-audit-${version}/report-mobile-preview.png` });
  assert.deepEqual(errors, []);
  console.log("Report verified: 80 cards, 22 findings, all local links, filters, mobile width and no runtime errors.");
} finally { await browser.close(); }
