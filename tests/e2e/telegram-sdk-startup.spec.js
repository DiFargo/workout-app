import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

const telegramSdkUrl = "https://telegram.org/js/telegram-web-app.js*";

async function openInvitationForm(page) {
  await page.locator("summary").filter({ hasText: "Есть приглашение от тренера? Войти" }).click();
  await expect(page.getByRole("heading", { name: "Вход по приглашению" })).toBeVisible();
  await expect(page.getByText(/логин из сообщения тренера и этот пароль/)).toBeVisible();
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByText("Укажи логин или email.", { exact: true })).toBeVisible();
  await expect(page.getByText("Укажи пароль.", { exact: true })).toBeVisible();
}

test("a pending Telegram SDK does not block login and a late SDK initializes the Mini App", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  let releaseSdk;
  let sdkRequested = false;
  const sdkGate = new Promise((resolve) => { releaseSdk = resolve; });
  await page.route(telegramSdkUrl, async (route) => {
    sdkRequested = true;
    await sdkGate;
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.__telegramStartupCalls = { ready: 0, expand: 0 };
        window.Telegram = { WebApp: {
          initData: "query_id=controlled-startup-fixture",
          viewportHeight: 760,
          viewportStableHeight: 720,
          safeAreaInset: { top: 24, right: 0, bottom: 30, left: 0 },
          contentSafeAreaInset: { top: 0, right: 0, bottom: 18, left: 0 },
          colorScheme: "light",
          onEvent() {},
          offEvent() {},
          ready() { window.__telegramStartupCalls.ready += 1; },
          expand() { window.__telegramStartupCalls.expand += 1; },
          setHeaderColor() {},
          setBackgroundColor() {},
          setBottomBarColor() {}
        } };
      `
    });
  });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Вход через Telegram" })).toBeVisible({ timeout: 40_000 });
    expect(sdkRequested).toBe(true);
    expect(await page.evaluate(() => Boolean(window.Telegram?.WebApp))).toBe(false);
    await expect(page.getByText("Открой приложение через кнопку меню своего бота в Telegram.", { exact: true })).toBeVisible();
    await openInvitationForm(page);
    assertNoRuntimeErrors();

    releaseSdk();
    await expect(page.getByText("Подтверди вход своим Telegram-аккаунтом.", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__telegramStartupCalls)).toEqual({ ready: 1, expand: 1 });
    await expect(page.locator("html")).toHaveAttribute("data-platform", "telegram");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height").trim())).toBe("720px");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--telegram-content-safe-area-bottom").trim())).toBe("18px");
    await expect(page.getByRole("heading", { name: "Вход по приглашению" })).toBeVisible();
    await expect(page.getByLabel("Логин или email")).toBeEditable();
    assertNoRuntimeErrors();
  } finally {
    releaseSdk();
  }
});

test("a failed Telegram SDK preserves invitation login and gives a Telegram entry instruction", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  let releaseSdk;
  const sdkGate = new Promise((resolve) => { releaseSdk = resolve; });
  await page.route(telegramSdkUrl, async (route) => {
    await sdkGate;
    await route.abort("failed");
  });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Вход через Telegram" })).toBeVisible({ timeout: 40_000 });
    const failedRequest = page.waitForEvent("requestfailed", {
      predicate: (request) => request.url().startsWith("https://telegram.org/js/telegram-web-app.js")
    });
    releaseSdk();
    await failedRequest;
    await page.getByRole("button", { name: "Продолжить через Telegram", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Открой приложение из меню бота в Telegram, чтобы войти этим способом.");
    await openInvitationForm(page);
    await expect(page.getByText("Открой приложение через кнопку меню своего бота в Telegram.", { exact: true })).toBeVisible();
    assertNoRuntimeErrors();
  } finally {
    releaseSdk();
  }
});
