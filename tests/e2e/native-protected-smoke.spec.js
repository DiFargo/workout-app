import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("native client theme leaves admin routes and denied access intact", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto("/?adminHarness=1");
  await expect(page.getByRole("heading", { name: "Обзор", exact: true })).toBeVisible({ timeout: 30_000 });
  const sidebar = page.getByRole("complementary", { name: "Навигация администратора" });
  const nav = await sidebar.isVisible() ? sidebar.getByRole("navigation") : page.getByRole("navigation", { name: "Разделы админки" });
  await nav.getByRole("button", { name: "Пользователи и роли", exact: true }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:adminUsers");
  await nav.getByRole("button", { name: "Базовые программы", exact: true }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("programs");
  await page.goto("/?adminHarness=1&adminAccess=denied");
  await expect(page.getByRole("heading", { name: "Доступ закрыт" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Разделы админки" })).toHaveCount(0);
  await expect(sidebar).toHaveCount(0);
  await page.getByRole("button", { name: "Главное меню" }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:main");
  assertNoErrors();
});

test("native client theme leaves trainer client, workout and nutrition navigation intact", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  await page.locator('[data-testid="trainer-nav-clients"]:visible,[data-testid="trainer-desktop-nav-clients"]:visible').click();
  await page.locator(".trainerNextClientTable > button").first().click();
  await expect(page.getByRole("heading", { name: "Germes", exact: true })).toBeVisible();
  const closeNutrition = page.getByRole("button", { name: "Закрыть редактор плана", exact: true });
  if (await closeNutrition.isVisible()) await closeNutrition.click();
  const compact = await page.locator(".trainerNextClientMobileNav").isVisible();
  const nav = page.locator(compact ? ".trainerNextClientMobileNav" : ".trainerNextClientTabs");
  for (const name of ["Тренировки", "Питание", "Фото и замеры", "Сводка"]) {
    await nav.getByRole("button", { name, exact: true }).click();
    if (name === "Питание") {
      await expect(page.getByRole("dialog", { name: "Изменить план", exact: true })).toHaveCount(0);
      await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
      await page.getByRole("button", { name: "Создать план питания", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Изменить план", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Закрыть редактор плана", exact: true }).click();
    }
    await expect(nav.getByRole("button", { name, exact: true })).toHaveAttribute(compact ? "aria-current" : "aria-pressed", compact ? "page" : "true");
  }
  await page.getByRole("button", { name: "Назад к списку клиентов", exact: true }).click();
  await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  assertNoErrors();
});
