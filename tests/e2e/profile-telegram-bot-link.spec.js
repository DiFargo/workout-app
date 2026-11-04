import { test, expect } from "./app-test.js";

const fixture = "/tests/e2e/fixtures/profile-modal-lifecycle.html";
const state = page => page.getByTestId("profile-telegram-fixture-state");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Map();
    window.__telegramBotLinkOpened = [];
    window.__telegramBotLinkAccepted = false;
    window.__emitTelegramEvent = name => { for (const listener of listeners.get(name) || []) listener(); };
    window.Telegram = { WebApp: {
      openTelegramLink: url => window.__telegramBotLinkOpened.push(url),
      onEvent: (name, listener) => {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(listener);
      },
      offEvent: (name, listener) => listeners.get(name)?.delete(listener)
    } };
  });
  // Every external request is blocked. The bot link is handled only by the SDK mock.
  await page.route("https://t.me/**", route => route.abort());
});

async function openTelegram(page, query = "") {
  await page.goto(`${fixture}${query}`);
  await page.getByRole("button", { name: "Открыть telegram", exact: true }).click();
  await expect(page.getByTestId("profile-telegram-dialog")).toBeVisible();
}

async function createLink(page) {
  await page.getByTestId("profile-telegram-start").click();
  await expect(page.getByTestId("profile-telegram-open-bot")).toHaveAttribute("href", /https:\/\/t\.me\/zmena_teleg_bot\?start=fixture_link_\d+/);
  await expect(page.getByTestId("profile-telegram-open-bot")).not.toHaveAttribute("aria-disabled", "true");
}

async function assertFits(page) {
  const dialog = page.getByTestId("profile-telegram-dialog");
  const viewport = page.viewportSize();
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  for (const control of await dialog.locator("button:visible, a:visible").all()) {
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  }
  await dialog.evaluate(node => { node.scrollTop = 0; });
}

test("bot link is explicit, single-flight and replaces the legacy widget", async ({ page }, testInfo) => {
  if (testInfo.project.name.includes("mobile")) await page.setViewportSize({ width: 402, height: 874 });
  await openTelegram(page);
  await expect(page.getByText("ZMENA в Telegram", { exact: true })).toBeVisible();
  await expect(page.locator("iframe, script[src*='telegram-widget']")).toHaveCount(0);
  await expect(page.getByTestId("profile-telegram-open-bot")).toHaveCount(0);
  await page.getByTestId("profile-telegram-start").evaluate(node => { node.click(); node.click(); });
  await expect(page.getByTestId("profile-telegram-check")).toBeDisabled();
  await expect(state(page)).toHaveAttribute("data-attempts", "1");
  const bot = page.getByTestId("profile-telegram-open-bot");
  await expect(bot).toHaveAttribute("href", "https://t.me/zmena_teleg_bot?start=fixture_link_1");
  await expect(state(page)).toHaveAttribute("data-opens", "0");
  await expect(bot).toHaveAttribute("target", "_blank");
  await expect(bot).toHaveAttribute("rel", "noopener noreferrer");
  await bot.click();
  await expect(state(page)).toHaveAttribute("data-opens", "1");
  expect(await page.evaluate(() => window.__telegramBotLinkOpened)).toEqual(["https://t.me/zmena_teleg_bot?start=fixture_link_1"]);
  await expect(state(page)).toHaveAttribute("data-attempts", "1");
  await expect(page.getByTestId("profile-telegram-instructions")).toContainText("нажми Start");
  await expect(page.getByTestId("profile-telegram-status")).toHaveAttribute("aria-live", "polite");
  await assertFits(page);
  await page.screenshot({ path: testInfo.outputPath("telegram-link-ready.png"), scale: "css" });
});

test("link creation failure can retry and replace a prepared link", async ({ page }) => {
  await openTelegram(page, "?telegramFailFirst=1");
  await page.getByTestId("profile-telegram-start").click();
  await expect(page.getByRole("status")).toContainText("Не удалось создать ссылку");
  await expect(page.getByTestId("profile-telegram-start")).toBeEnabled();
  await createLink(page);
  await expect(state(page)).toHaveAttribute("data-attempts", "2");
  await page.getByTestId("profile-telegram-renew").click();
  await expect(page.getByTestId("profile-telegram-open-bot")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("profile-telegram-open-bot")).not.toHaveAttribute("href");
  await expect(page.getByTestId("profile-telegram-check")).toBeDisabled();
  await expect(page.getByTestId("profile-telegram-open-bot")).toHaveAttribute("href", "https://t.me/zmena_teleg_bot?start=fixture_link_3");
  await expect(state(page)).toHaveAttribute("data-opens", "0");
});

test("manual check preserves pending feedback and connected change/disconnect actions", async ({ page }) => {
  await openTelegram(page);
  await createLink(page);
  await page.getByTestId("profile-telegram-check").click();
  await expect(page.getByRole("status")).toContainText("Подключение пока не подтверждено");
  await expect(page.getByTestId("profile-telegram-open-bot")).toBeVisible();
  await page.evaluate(() => { window.__telegramBotLinkAccepted = true; });
  await page.getByTestId("profile-telegram-check").click();
  await expect(page.getByRole("heading", { name: "Telegram подключён", exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-telegram-open-bot")).toHaveCount(0);
  await page.getByTestId("profile-telegram-change").click();
  await expect(page.getByTestId("profile-telegram-start")).toBeVisible();
  await createLink(page);
  await page.getByTestId("profile-telegram-check").click();
  await expect(page.getByTestId("profile-telegram-disconnect")).toBeVisible();
  await page.getByTestId("profile-telegram-disconnect").click();
  await expect(page.getByRole("alertdialog")).toContainText("Вход через этот Telegram и уведомления бота перестанут работать");
  await page.getByRole("button", { name: "Подтвердить отключение", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Telegram отключён.");
  await expect(page.getByTestId("profile-telegram-start")).toBeVisible();
  await expect(state(page)).toHaveAttribute("data-attempts", "2");
});

for (const returnEvent of ["focus", "visibilitychange", "activated"]) {
  test(`pending link refreshes once on ${returnEvent}, not before creation or after close`, async ({ page }) => {
    await openTelegram(page);
    const emit = () => page.evaluate(event => {
      if (event === "activated") window.__emitTelegramEvent("activated");
      else if (event === "focus") window.dispatchEvent(new Event("focus"));
      else document.dispatchEvent(new Event("visibilitychange"));
    }, returnEvent);
    await emit();
    await expect(state(page)).toHaveAttribute("data-checks", "0");
    await createLink(page);
    await page.evaluate(() => { window.__telegramBotLinkAccepted = true; });
    await emit();
    await emit();
    await emit();
    await expect(page.getByRole("heading", { name: "Telegram подключён", exact: true })).toBeVisible();
    await expect(state(page)).toHaveAttribute("data-checks", "1");
    await page.getByTestId("profile-telegram-change").click();
    await createLink(page);
    await page.getByTestId("profile-telegram-close").click();
    await emit();
    await expect(state(page)).toHaveAttribute("data-checks", "1");
  });
}

test("late Telegram SDK activation can refresh an already pending bot link", async ({ page }) => {
  await openTelegram(page);
  await page.evaluate(() => { window.__lateTelegramSdk = window.Telegram; delete window.Telegram; });
  await createLink(page);
  await page.evaluate(() => {
    window.Telegram = window.__lateTelegramSdk;
    window.__telegramBotLinkAccepted = true;
    window.dispatchEvent(new Event("telegram-mini-app-ready"));
    window.__emitTelegramEvent("activated");
  });
  await expect(page.getByRole("heading", { name: "Telegram подключён", exact: true })).toBeVisible();
  await expect(state(page)).toHaveAttribute("data-checks", "1");
  await expect(state(page)).toHaveAttribute("data-opens", "0");
});

test("ready sheet remains readable and operable at 320px and in landscape", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await openTelegram(page);
    await createLink(page);
    await assertFits(page);
    await page.screenshot({ path: testInfo.outputPath(`telegram-ready-${viewport.width}.png`), scale: "css" });
    await page.getByTestId("profile-telegram-dismiss").click();
    await expect(page.getByTestId("profile-telegram-dialog")).toHaveCount(0);
  }
});
