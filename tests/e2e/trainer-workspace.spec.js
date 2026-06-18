import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test("trainer workspace smoke: dashboard, clients, client card and messages stay usable", async ({ page }) => {
  await page.goto("/?trainerHarness=1");
  const main = page.getByRole("main");

  await expect(page.getByRole("heading", { name: "Дашборд" }).or(page.getByRole("heading", { name: "Обзор" })).first()).toBeVisible();
  await expect(page.getByText(/^v\d+$/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /^Клиенты$/ }).click();
  await expect(page.getByRole("heading", { name: "Клиенты" })).toBeVisible();
  await expect(page.getByText("Germes")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Germes/ }).first().click();
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expect(main.getByRole("button", { name: "План тренировок" })).toBeVisible();
  await main.getByRole("button", { name: "Питание" }).click();
  await expect(page.getByText("План питания клиента")).toBeVisible();
  await main.getByRole("button", { name: "Уведомления" }).click();
  await expect(page.getByRole("heading", { name: "Напоминания" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /^Сообщения$/ }).first().click();
  await expect(page.getByRole("heading", { name: "Сообщения" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Нужно ответить" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("trainer mobile overflow menu opens compact extra sections", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile overflow exists only on compact trainer navigation.");

  await page.goto("/?trainerHarness=1");

  await page.getByRole("button", { name: /^Ещё$/ }).click();
  await expect(page.getByRole("dialog", { name: "Дополнительные разделы" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Программы/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Аналитика/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Уведомления/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Кабинет/ })).toBeVisible();
});
