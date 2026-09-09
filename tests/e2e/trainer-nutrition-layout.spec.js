import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("client nutrition fills its content column at phone, tablet and desktop widths", async ({ page }) => {
  test.setTimeout(90_000);
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.setFixedTime(new Date("2026-06-18T12:00:00Z"));
  await page.goto("/v2?trainerHarness=1");
  await page.locator('[data-testid="trainer-nav-clients"]:visible,[data-testid="trainer-desktop-nav-clients"]:visible').click();
  await page.locator(".trainerNextClientTable > button").first().click();
  const closeEditor = page.getByRole("button", { name: "Закрыть редактор плана", exact: true });
  if (await closeEditor.isVisible()) await closeEditor.click();
  await page.locator(".trainerNextClientTabs:visible,.trainerNextClientMobileNav:visible")
    .getByRole("button", { name: "Питание", exact: true }).click();
  if (await closeEditor.isVisible()) await closeEditor.click();
  await expect(page.locator(".trainerNutritionMetricGrid")).toContainText("2250");

  for (const width of [320, 393, 589, 760, 1024, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.locator(".trainerNextNutritionUnified").evaluate((container) => {
      const bounds = container.getBoundingClientRect();
      const selectors = [".trainerNutritionMetricGrid", ".trainerNutritionCaloriesChart", ".trainerNutritionBalance", ".trainerNutritionPlan"];
      return {
        width: bounds.width,
        left: bounds.left,
        documentWidth: document.documentElement.scrollWidth,
        cards: selectors.map((selector) => {
          const el = container.querySelector(selector), rect = el.getBoundingClientRect();
          return { selector, left: rect.left, width: rect.width, overflow: el.scrollWidth - el.clientWidth };
        })
      };
    });
    for (const card of layout.cards) {
      expect(Math.abs(card.left - layout.left), `${width}px: ${card.selector} left edge`).toBeLessThanOrEqual(1);
      expect(Math.abs(card.width - layout.width), `${width}px: ${card.selector} fills the column`).toBeLessThanOrEqual(1);
      expect(card.overflow, `${width}px: ${card.selector} content fits`).toBeLessThanOrEqual(1);
    }
    expect(layout.documentWidth).toBeLessThanOrEqual(width + 1);
    const bars = page.locator(".trainerClientBarChart > div[aria-label]");
    await expect(bars).toHaveCount(2);
    await expect(bars.first().locator("b")).toHaveText("2290");

    if (width <= 760) {
      const editPlan = page.locator(".trainerNutritionPlanEditButton");
      await editPlan.scrollIntoViewIfNeeded();
      const buttonBox = await editPlan.boundingBox();
      const navBox = await page.locator(".trainerNextClientMobileNav").boundingBox();
      expect(buttonBox.y + buttonBox.height, `${width}px: plan action clears bottom navigation`).toBeLessThanOrEqual(navBox.y);
    }
  }
  // Empty periods must keep the same column width too.
  await page.setViewportSize({ width: 589, height: 844 });
  await page.locator(".trainerNutritionPeriodButtons").getByRole("button", { name: "Период", exact: true }).click();
  await page.locator(".trainerNutritionCustomPeriod input").first().fill("2026-06-01");
  await page.locator(".trainerNutritionCustomPeriod input").last().fill("2026-06-07");
  await expect(page.locator(".trainerNutritionCaloriesChart .trainerNextEmpty")).toBeVisible();
  const widths = await page.locator(".trainerNextNutritionUnified,.trainerNutritionMetricGrid,.trainerNutritionCaloriesChart,.trainerNutritionBalance")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  assertNoRuntimeErrors();
});

// This file owns its viewport matrix; avoid repeating it in the second project.
test.beforeEach(() => { test.skip(test.info().project.name !== "mobile-chromium", "Viewport matrix runs once"); });
