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

  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.locator(".workoutSelectTitle")).toBeVisible();
  await expect(page.locator(".workoutSelectTitle")).toHaveText("Индивидуальный план");
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.locator(".workoutModeHeaderButton").click();
  await expect(page.locator(".workoutModeModal")).toBeVisible();
  await page.locator(".workoutModeModalHeader button").click();
  await expect(page.locator(".workoutModeModal")).toBeHidden();

  await page.locator(".workoutHistoryHeaderButton").click();
  await expect(page.locator(".workoutHistoryModal")).toBeVisible();
  await page.locator(".workoutModeModalHeader button").click();
  await expect(page.locator(".workoutHistoryModal")).toBeHidden();

  const workoutCard = page.locator(".individualWorkoutCardPro");
  await workoutCard.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 300,
    clientY: 240
  });
  await workoutCard.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 120,
    clientY: 240
  });
  await expect(page.locator(".individualWorkoutBottomProgress")).toContainText("2");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.locator(".nutritionOrbitHitButton")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.locator(".nutritionHeaderIconButton").first().click();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeVisible();
  await page.locator(".fatSearchClosePremium").click();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeHidden();

  await page.locator(".nutritionHeaderIconButton").nth(1).click();
  await expect(page.locator(".nutritionCalendarOverlay")).toBeVisible();
  await expect(page.locator(".nutritionCalendarDay")).toHaveCount(42);
  await page.locator(".nutritionCalendarClose").click();
  await expect(page.locator(".nutritionCalendarOverlay")).toBeHidden();

  await page.locator(".nutritionAiPlanTopCard").click();
  await expect(page.locator(".nutritionAiPlanModal")).toBeVisible();
  await page.locator(".nutritionAiPlanToggleBtn").click();
  await expect(page.locator(".nutritionAiPlanModal")).toBeHidden();

  await page.locator(".nutritionZoukHeader").click();
  await expect(page.locator(".nutritionZoukModalOverlay")).toBeVisible();
  await page.locator(".nutritionZoukModalHeader button").click();
  await expect(page.locator(".nutritionZoukModalOverlay")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.getByTestId("client-harness-cabinet")).toBeVisible();
  await expect(page.locator(".clientCorePageTitle")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
