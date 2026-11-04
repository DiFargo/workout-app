import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Войти в Zmena" })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("group", { name: "Способ входа" }).getByRole("button", { name: "Email или логин", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Войти через Google", exact: true })).toHaveCount(0);
  await page.getByText("Помощь со входом", { exact: true }).click();
  await expect(page.getByText(/Приглашение через Telegram\?.*пароль для этого не нужен/)).toBeVisible();
  await expect(page.getByText(/Если в приглашении предложено создать пароль, сначала задай его по ссылке/)).toBeVisible();
  assertNoRuntimeErrors();
});

test("login form validates fields and stays inside a 320px viewport", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.getByRole("button", { name: "Войти", exact: true }).click();

  await expect(page.getByText("Укажи логин или email.")).toBeVisible();
  await expect(page.getByText("Укажи пароль.")).toBeVisible();

  const viewportMetrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(viewportMetrics.documentWidth).toBeLessThanOrEqual(viewportMetrics.viewportWidth);
  assertNoRuntimeErrors();
});

test("password reset validates email before calling Firebase", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.getByRole("button", { name: "Забыли пароль?" }).click();
  await expect(page.getByRole("heading", { name: "Восстановить пароль", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Отправить ссылку", exact: true }).click();
  await expect(page.getByText("Укажи логин или email.")).toBeVisible();

  await page.getByLabel("Email или логин", { exact: true }).fill("not@an-email");
  await page.getByRole("button", { name: "Отправить ссылку", exact: true }).click();
  await expect(page.getByText("Проверь формат email.")).toBeVisible();
  assertNoRuntimeErrors();
});

test("an invitation opened outside Telegram keeps its token in the bot deep link", async ({ page }) => {
  await page.goto("/?telegramInvite=telegram-invite-token_1234567890", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Приглашение от тренера" })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("link", { name: "Открыть приглашение в Telegram" }))
    .toHaveAttribute("href", "https://t.me/zmena_teleg_bot?start=invite_telegram-invite-token_1234567890");
  await expect(page.getByText("Это приглашение нужно подтвердить в Telegram. Открой чат с ботом и нажми Start.", { exact: true })).toBeVisible();
});
