// Local post-release evidence for the edge states absent from the 80-screen inventory.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit, expect } from "@playwright/test";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const output = resolve(`artifacts/variant-a-${version}/additional`);
const release = JSON.parse(await readFile(`artifacts/variant-a-${version}/release-status.json`, "utf8"));
assert.equal(release.production.verified, true);
const base = "http://127.0.0.1:4193";
const entries = [];
await mkdir(output, { recursive: true });
for (const [name, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 402, height: 874 }, locale: "ru-RU", reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.name));
    await context.route("**/*", route => {
      const request = route.request();
      const url = new URL(request.url());
      return url.origin === base && ["GET", "HEAD"].includes(request.method()) && !url.pathname.startsWith("/api/")
        ? route.continue() : route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    });
    const capture = async (key, title) => {
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      const file = `${name}-themed-stable-${key}.png`;
      await page.screenshot({ path: resolve(output, file), animations: "disabled" });
      entries.push({ browser: name, key, title, screenshot: `additional/${file}`, runtimeErrors: [] });
    };
    await page.goto(`${base}/tests/e2e/fixtures/variant-a-details.html?case=email`);
    await expect(page.getByRole("heading", { name: "Добавить личную почту", exact: true })).toBeVisible();
    await expect(page.getByTestId("profile-email-address")).toHaveValue("");
    await expect(page.getByTestId("profile-email-password")).toHaveCount(0);
    await expect(page.getByText("fixture@telegram.tren-85720.app", { exact: true })).toHaveCount(0);
    await capture("recovery-email", "Личная почта вместо служебного адреса");
    await page.goto(`${base}/tests/e2e/fixtures/variant-a-details.html?case=password`);
    await expect(page.getByRole("button", { name: "Добавить личную почту", exact: true })).toBeVisible();
    await expect(page.getByTestId("profile-password-reset")).toHaveCount(0);
    await capture("recovery-password", "Восстановление без фиктивной почты");
    await page.goto(`${base}/tests/e2e/fixtures/variant-a-details.html?case=notifications`);
    await expect(page.getByTestId("profile-trainer-notification-item")).toHaveCount(2);
    await capture("notification-preview", "Длинные заголовки и превью уведомлений");
    await page.getByText("Читать полностью", { exact: true }).click();
    await expect(page.getByText("Свернуть сообщение", { exact: true })).toBeVisible();
    await capture("notification-expanded", "Полное сообщение тренера");
    await page.goto(`${base}/tests/e2e/fixtures/profile-modal-lifecycle.html`);
    await page.getByRole("button", { name: "Открыть voice", exact: true }).click();
    await page.getByTestId("nutrition-voice-close").click();
    await expect(page.getByRole("alertdialog", { name: "Не все продукты добавлены", exact: true })).toBeVisible();
    await expect(page.getByTestId("nutrition-voice-backdrop")).toHaveJSProperty("inert", true);
    await capture("voice-discard", "Явное подтверждение незавершённого ввода");
    await context.close();
  } finally { await browser.close(); }
}
await writeFile(resolve(output, "index.json"), JSON.stringify({ version, source: "local real components, full application theme imports and synthetic edge-state props; no native keyboard or Telegram chrome", entries }, null, 2) + "\n");
console.log(`${entries.length} additional visual states verified and captured.`);
