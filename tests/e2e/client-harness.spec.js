import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test("client harness smoke: main, workouts, nutrition and cabinet stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");

  await expect(page.getByTestId("client-harness-main")).toBeVisible();
  await expect(page.getByText(/^v\d+$/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByRole("button", { name: /Тренировки/ }).click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Индивидуальный/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByRole("button", { name: /Питание/ }).click();
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.getByRole("button", { name: /Добавить еду/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByRole("button", { name: /Кабинет/ }).click();
  await expect(page.getByTestId("client-harness-cabinet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Кабинет" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
