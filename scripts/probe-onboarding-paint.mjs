import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { webkit, expect } from "@playwright/test";

const output = resolve("artifacts/telegram-visual-audit-3.0.838/diagnostics");
const source = await readFile("scripts/capture-telegram-visual-audit.mjs", "utf8");
const mock = source.slice(source.indexOf("function telegramMock"), source.indexOf("async function geometry"));
const mockScript = `${mock};telegramMock({height:874});`;
const base = "http://127.0.0.1:4186";
await mkdir(output, { recursive: true });
const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Europe/Minsk", colorScheme: "light",
    reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addInitScript(mockScript);
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === "telegram.org" && url.pathname.endsWith("telegram-web-app.js")) return route.fulfill({ contentType: "application/javascript", body: mockScript });
    if (url.origin !== base || url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"visual-audit-network-blocked"}' });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  await page.clock.setFixedTime(new Date("2026-10-17T12:00:00.000Z"));
  await page.goto(`${base}/?clientHarness=1&clientHarnessTheme=warm-light&clientHarnessPage=firstSetup&clientFirstSetupStep=3`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await expect(page.getByTestId("first-setup-onboarding")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("first-setup-card")).toHaveAttribute("data-step", "3");
  await page.evaluate(async () => { await document.fonts.ready; document.querySelectorAll("video").forEach(video => video.pause()); });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const inspect = () => page.evaluate(() => {
    const info = node => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { name: node.textContent?.trim().slice(0, 35), className: node.className, y: rect.y, bottom: rect.bottom,
        height: rect.height, display: style.display, visibility: style.visibility, opacity: style.opacity,
        color: style.color, background: style.backgroundColor, transform: style.transform };
    };
    return { innerHeight, scrollY, activeElement: document.activeElement?.tagName,
      telegramHeight: window.Telegram?.WebApp.viewportHeight,
      rootHeight: getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height"),
      card: info(document.querySelector('[data-testid="first-setup-card"]')),
      navigation: info(document.querySelector('[data-testid="first-setup-navigation"]')),
      buttons: [...document.querySelectorAll('[data-testid="first-setup-navigation"] button')].map(info) };
  });
  const initial = await inspect();
  await page.screenshot({ path: resolve(output, "onboarding-age-immediate-disabled.png"), fullPage: false, animations: "disabled", scale: "css" });
  await page.waitForTimeout(200);
  const settled = await inspect();
  await page.screenshot({ path: resolve(output, "onboarding-age-settled-allow.png"), fullPage: false, animations: "allow", scale: "css" });
  await writeFile(resolve(output, "onboarding-age-paint.json"), JSON.stringify({ browser: "webkit", fixtureOnly: true, initial, settled }, null, 2) + "\n");
  console.log(JSON.stringify({ initial, settled }, null, 2));
} finally { await browser.close(); }
