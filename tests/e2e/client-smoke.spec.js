import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.beforeEach(async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
  assertNoRuntimeErrors();
});

test("login form validates fields and stays inside a 320px viewport", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page.getByText("Укажи email.")).toBeVisible();
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
  await expect(page.getByText("Укажи email.")).toBeVisible();

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Забыли пароль?" }).click();
  await expect(page.getByText("Проверь формат email.")).toBeVisible();
  assertNoRuntimeErrors();
});
