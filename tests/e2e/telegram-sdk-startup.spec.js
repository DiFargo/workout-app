import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";
import { isolateGoogleAuthTransport } from "./app-test.js";

test.setTimeout(60_000);

const telegramSdkUrl = "https://telegram.org/js/telegram-web-app.js*";

test.beforeEach(async ({ page }) => { await isolateGoogleAuthTransport(page); });

async function openInvitationForm(page) {
  await page.getByRole("group", { name: "Способ входа" }).getByRole("button", { name: "Email или логин", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Войти в Zmena" })).toBeVisible();
  await page.getByText("Помощь со входом", { exact: true }).click();
  await expect(page.getByText(/Продолжи через Telegram — пароль для этого не нужен/)).toBeVisible();
  await expect(page.getByText(/Если в приглашении предложено создать пароль, сначала задай его по ссылке/)).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Войти в Zmena" })).toBeVisible({ timeout: 40_000 });
    expect(sdkRequested).toBe(true);
    expect(await page.evaluate(() => Boolean(window.Telegram?.WebApp))).toBe(false);
    await page.getByRole("group", { name: "Способ входа" }).getByRole("button", { name: "Telegram", exact: true }).click();
    await expect(page.getByText("Сейчас приложение открыто в браузере. Перейди в Telegram и открой Zmena кнопкой приложения в чате с ботом.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть бота в Telegram" })).toHaveAttribute("href", "https://t.me/zmena_teleg_bot");
    await openInvitationForm(page);
    assertNoRuntimeErrors();

    releaseSdk();
    await expect(page.getByText("Быстрый вход без пароля.", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__telegramStartupCalls)).toEqual({ ready: 1, expand: 1 });
    await expect(page.locator("html")).toHaveAttribute("data-platform", "telegram");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height").trim())).toBe("720px");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--telegram-content-safe-area-bottom").trim())).toBe("18px");
    await expect(page.getByRole("heading", { name: "Войти в Zmena" })).toBeVisible();
    await expect(page.getByLabel("Email или логин", { exact: true })).toBeEditable();
    await page.getByRole("group", { name: "Способ входа" }).getByRole("button", { name: "Telegram", exact: true }).click();
    await expect(page.getByText("Быстрый вход без пароля.", { exact: true })).toBeVisible();
    assertNoRuntimeErrors();
  } finally {
    releaseSdk();
  }
});
test("a failed Telegram SDK preserves other login methods and links to the bot", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  let releaseSdk;
  const sdkGate = new Promise((resolve) => { releaseSdk = resolve; });
  await page.route(telegramSdkUrl, async (route) => {
    await sdkGate;
    await route.abort("failed");
  });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Войти в Zmena" })).toBeVisible({ timeout: 40_000 });
    const failedRequest = page.waitForEvent("requestfailed", {
      predicate: (request) => request.url().startsWith("https://telegram.org/js/telegram-web-app.js")
    });
    releaseSdk();
    await failedRequest;
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("group", { name: "Способ входа" }).getByRole("button", { name: "Telegram", exact: true }).click();
    await expect(page.getByRole("link", { name: "Открыть бота в Telegram" })).toHaveAttribute("href", "https://t.me/zmena_teleg_bot");
    await openInvitationForm(page);
    await expect(page.getByText("Сейчас приложение открыто в браузере. Перейди в Telegram и открой Zmena кнопкой приложения в чате с ботом.", { exact: true })).toHaveCount(0);
    assertNoRuntimeErrors();
  } finally {
    releaseSdk();
  }
});

test("open email registration explains the pending trainer state on a narrow screen", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.route(telegramSdkUrl, (route) => route.abort("failed"));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Войти в Zmena" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Создать аккаунт" })).toBeVisible();
  await expect(page.getByText("Без назначенного тренера доступно только ознакомление. Тренировки и питание откроются после назначения тренера.", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="new-password"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  assertNoRuntimeErrors();
});
