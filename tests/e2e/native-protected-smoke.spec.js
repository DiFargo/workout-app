import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("native client theme leaves admin routes and denied access intact", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto("/?adminHarness=1");
  await expect(page.getByRole("heading", { name: "Админка", exact: true })).toBeVisible({ timeout: 30_000 });
  const nav = page.getByRole("navigation", { name: "Разделы админки" });
  await nav.getByRole("button", { name: "Пользователи и роли", exact: true }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:adminUsers");
  await nav.getByRole("button", { name: "Базовые программы", exact: true }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("programs");
  await page.goto("/?adminHarness=1&adminAccess=denied");
  await expect(page.getByRole("heading", { name: "Доступ закрыт" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Разделы админки" })).toHaveCount(0);
  await page.getByRole("button", { name: "Главное меню" }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:main");
  assertNoErrors();
});

test("native client theme leaves trainer client, workout and nutrition navigation intact", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await page.getByTestId("trainer-nav-clients").click();
  await page.locator(".trainerNextClientTable > button").first().click();
  await expect(page.getByRole("heading", { name: "Germes", exact: true })).toBeVisible();
  const nav = page.locator(".trainerNextClientMobileNav");
  for (const name of ["Тренировки", "Питание", "Фото и замеры", "Сводка"]) {
    await nav.getByRole("button", { name, exact: true }).click();
    if (name === "Питание") {
      await expect(page.getByRole("dialog", { name: "Изменить план", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Закрыть редактор плана", exact: true }).click();
    }
    await expect(nav.getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("button", { name: "Назад к списку клиентов", exact: true }).click();
  await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  assertNoErrors();
});
