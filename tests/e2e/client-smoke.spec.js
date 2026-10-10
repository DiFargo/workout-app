import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Вход через Telegram" })).toBeVisible({ timeout: 40_000 });
  await page.locator("summary").filter({ hasText: "Есть приглашение от тренера? Войти" }).click();
  await expect(page.getByRole("heading", { name: "Вход по приглашению" })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("Открой ссылку активации и задай пароль. Потом введи ниже логин из сообщения тренера и этот пароль.")).toBeVisible();
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
  await expect(page.getByText("Укажи логин или email.")).toBeVisible();

  await page.getByLabel("Логин или email").fill("not@an-email");
  await page.getByRole("button", { name: "Забыли пароль?" }).click();
  await expect(page.getByText("Проверь формат email.")).toBeVisible();
  assertNoRuntimeErrors();
});
