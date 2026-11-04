import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

const recipient = "fixture_client";
const botStartUrl = "https://t.me/zmena_teleg_bot?start=invite_fixture";
const fallbackUrl = "https://example.invalid/fixture-invite";

function invitationMessage({ existingAccount = false } = {}) {
  return [
    "Привет! Приглашаю тебя в приложение Zmena.",
    `1. Открой ссылку и нажми Start в Telegram: ${botStartUrl}`,
    "2. В ответном сообщении нажми «Принять приглашение».",
    "3. В открывшемся приложении выбери «Telegram» и нажми «Принять приглашение» — аккаунт подключится к тренеру.",
    ...(!existingAccount ? ["Логин для входа по паролю: fixture.fit"] : []),
    `Если понадобится вход по паролю, сначала создай его по ссылке: ${fallbackUrl}`
  ].join("\n");
}

async function prepare(page, testInfo, query = "") {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 402, height: 874 });
  await page.addInitScript(() => {
    window.__trainerInviteCopies = [];
    window.__trainerInviteClipboardFail = false;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text) => {
        if (window.__trainerInviteClipboardFail) throw new Error("fixture-clipboard-denied");
        window.__trainerInviteCopies.push(text);
      } }
    });
  });
  // Even if the DOM interception regresses, never open Telegram from this fixture.
  await page.route("https://t.me/**", (route) => route.abort());
  await page.goto(`/?trainerHarness=1&inviteFlow=1${query}`);
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  const mobileNavigation = page.getByTestId("trainer-nav-clients");
  const clients = await mobileNavigation.isVisible()
    ? mobileNavigation
    : page.getByTestId("trainer-desktop-nav-clients");
  await clients.click();
  await page.getByRole("button", { name: "Добавить клиента", exact: true }).click();
  const dialog = query.includes("legacyInvite=1")
    ? page.locator('[role="dialog"][aria-labelledby="trainer-create-client-modal-title"]')
    : page.locator(".trainerNextCreateClientModal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Пригласить клиента", exact: true })).toBeVisible();
  return dialog;
}

async function fillInvitation(dialog, legacy = false) {
  await dialog.getByLabel(legacy ? "Имя клиента" : "Имя", { exact: true }).fill("Fixture client");
  await dialog.getByLabel("Ник в Telegram", { exact: true }).fill(`@${recipient}`);
  await dialog.getByLabel(legacy ? "Логин" : "Логин для запасного входа (необязательно)", { exact: true }).fill("fixture.fit");
}

async function expectReady(dialog, page, attempts = "1") {
  await expect(dialog.getByRole("heading", { name: "Приглашение готово", exact: true })).toBeVisible();
  await expect(dialog.locator("input")).toHaveCount(0);
  await expect(dialog.locator("form")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Создать приглашение", exact: true })).toHaveCount(0);
  await expect(page.locator("#trainer-e2e-meta")).toHaveAttribute("data-invite-create-attempts", attempts);
}

test("ready invitation replaces creation, sends only via an intercepted recipient link, and copies with recovery", async ({ page, context }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const dialog = await prepare(page, testInfo);
  await fillInvitation(dialog);
  await page.screenshot({ path: testInfo.outputPath("invite-editing.png"), scale: "css" });

  // Native submits in one browser task exercise the in-flight guard, not a
  // second Playwright click that might wait until the first request is over.
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expectReady(dialog, page);

  const expectedMessage = invitationMessage();
  const expectedHref = `https://t.me/${recipient}?text=${encodeURIComponent(expectedMessage)}`;
  const telegram = dialog.getByRole("link", { name: "Отправить в Telegram", exact: true });
  await expect(telegram).toHaveAttribute("href", expectedHref);
  await expect(telegram).toHaveAttribute("target", "_blank");
  await expect(telegram).toHaveAttribute("rel", /noopener/);
  await telegram.evaluate((anchor) => anchor.addEventListener("click", (event) => {
    event.preventDefault();
    window.__trainerInviteInterceptedHref = anchor.href;
  }, { once: true }));
  const pageCount = context.pages().length;
  const originalLocation = page.url();
  await telegram.click();
  expect(await page.evaluate(() => window.__trainerInviteInterceptedHref)).toBe(expectedHref);
  expect(page.url()).toBe(originalLocation);
  expect(context.pages()).toHaveLength(pageCount);
  await expectReady(dialog, page);

  const copy = dialog.getByRole("button", { name: "Скопировать приглашение", exact: true });
  await copy.click();
  await expect(dialog.getByText(/приглашение скопировано|скопировано.*приглашение/i)).toBeVisible();
  expect(await page.evaluate(() => window.__trainerInviteCopies)).toEqual([expectedMessage]);

  await page.evaluate(() => { window.__trainerInviteClipboardFail = true; });
  await copy.click();
  await expect(dialog.getByText(/не удалось скопировать/i)).toBeVisible();
  await expectReady(dialog, page);
  await page.evaluate(() => { window.__trainerInviteClipboardFail = false; });
  await copy.click();
  expect(await page.evaluate(() => window.__trainerInviteCopies)).toEqual([expectedMessage, expectedMessage]);

  const backup = dialog.locator("summary").filter({ hasText: "Запасной вход" });
  await expect(backup).toBeVisible();
  await backup.click();
  await expect(dialog.getByText(/fixture\.fit/)).toBeVisible();
  await expect(page.locator("#trainer-e2e-meta")).toHaveAttribute("data-invite-create-attempts", "1");
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("invite-ready.png"), scale: "css" });

  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Добавить клиента", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Пригласить клиента", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Имя", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Ник в Telegram", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Логин для запасного входа (необязательно)", { exact: true })).toHaveValue("");
  await expect(dialog.getByRole("link", { name: "Отправить в Telegram", exact: true })).toHaveCount(0);
  // The harness explicitly resets its per-flow counter when a fresh modal opens.
  await expect(page.locator("#trainer-e2e-meta")).toHaveAttribute("data-invite-create-attempts", "0");
  await fillInvitation(dialog);
  await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
  await expectReady(dialog, page);
  assertNoRuntimeErrors();
});

test("creation failure retains editable values and retries once into the ready state", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const dialog = await prepare(page, testInfo, "&inviteFailure=1");
  await fillInvitation(dialog);
  await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
  await expect(page.locator("#trainer-e2e-meta")).toHaveAttribute("data-invite-create-attempts", "1");
  await expect(dialog.getByText(/не удалось|ошибка/i)).toBeVisible();
  await expect(dialog.getByLabel("Имя", { exact: true })).toHaveValue("Fixture client");
  await expect(dialog.getByLabel("Ник в Telegram", { exact: true })).toHaveValue(`@${recipient}`);
  await expect(dialog.getByRole("button", { name: "Создать приглашение", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("invite-create-error.png"), scale: "css" });
  await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
  await expectReady(dialog, page, "2");
  await expect(dialog.getByRole("link", { name: "Отправить в Telegram", exact: true })).toHaveAttribute(
    "href", `https://t.me/${recipient}?text=${encodeURIComponent(invitationMessage())}`
  );
  assertNoRuntimeErrors();
});

test("an existing account invitation is ready without exposing an invented backup login", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const dialog = await prepare(page, testInfo, "&existingInvite=1");
  await fillInvitation(dialog);
  await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
  await expectReady(dialog, page);
  const telegram = dialog.getByRole("link", { name: "Отправить в Telegram", exact: true });
  await expect(telegram).toHaveAttribute("href", `https://t.me/${recipient}?text=${encodeURIComponent(invitationMessage({ existingAccount: true }))}`);
  await expect(dialog.getByText(/fixture\.fit/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Скопировать приглашение", exact: true }).click();
  expect(await page.evaluate(() => window.__trainerInviteCopies)).toEqual([invitationMessage({ existingAccount: true })]);
  await page.screenshot({ path: testInfo.outputPath("invite-existing-account.png"), scale: "css" });
  assertNoRuntimeErrors();
});

test("legacy invitation uses the real create-to-ready flow and reopens a clean form", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const dialog = await prepare(page, testInfo, "&legacyInvite=1");
  await fillInvitation(dialog, true);
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expectReady(dialog, page);
  await expect(dialog.getByRole("link", { name: "Отправить в Telegram", exact: true })).toHaveAttribute(
    "href", `https://t.me/${recipient}?text=${encodeURIComponent(invitationMessage())}`
  );
  await dialog.getByRole("button", { name: "Скопировать приглашение", exact: true }).click();
  await expect(dialog.getByText("Приглашение скопировано", { exact: true })).toBeVisible();
  await expect(page.locator("#trainer-e2e-meta")).toHaveAttribute("data-invite-create-attempts", "1");
  await page.screenshot({ path: testInfo.outputPath("invite-legacy-ready.png"), scale: "css" });
  await dialog.getByRole("button", { name: "Закрыть создание клиента", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Добавить клиента", exact: true }).click();
  await expect(dialog.getByLabel("Имя клиента", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Ник в Telegram", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Логин", { exact: true })).toHaveValue("");
  await expect(dialog.locator("form")).toHaveCount(1);
  await expect(page.locator("#trainer-e2e-meta")).toHaveAttribute("data-invite-create-attempts", "0");
  await fillInvitation(dialog, true);
  await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
  await expectReady(dialog, page);
  assertNoRuntimeErrors();
});

test("ready invitation keeps its send action available at 320px", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Compact representative runs once per browser");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const dialog = await prepare(page, testInfo);
  await page.setViewportSize({ width: 320, height: 720 });
  await fillInvitation(dialog);
  await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
  await expectReady(dialog, page);
  await expect(dialog.getByRole("link", { name: "Отправить в Telegram", exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("invite-ready-320.png"), scale: "css" });
  assertNoRuntimeErrors();
});
