import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
}

async function expectTapTargets(page, selectors, minSize = 40) {
  const failures = await page.evaluate(({ targetSelectors, minimumSize }) => {
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    return targetSelectors.flatMap((selector) => (
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          return {
            selector,
            index,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })
        .filter((item) => item.width < minimumSize || item.height < minimumSize)
    ));
  }, { targetSelectors: selectors, minimumSize: minSize });

  expect(failures).toEqual([]);
}

test("client AI coach visual audit covers insights and nutrition plan states", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=aiCoach");
  await expect(page.getByTestId("client-harness-ai-coach")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".aiCoachPage")).toBeVisible();
  await expect(page.locator(".aiCoachHero")).toBeVisible();
  await expect(page.locator(".aiCoachResultCard")).toBeVisible();
  await expect(page.locator(".aiCoachFeatureCard")).toHaveCount(8);
  await expectTapTargets(page, [
    ".aiCoachBackBtn",
    ".aiCoachFeatureCard"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-ai-coach-overview.png");

  await page.getByTestId("ai-coach-feature-nutritionPlan").click();
  await expect(page.locator(".aiNutritionOnboardingCard")).toBeVisible();
  await expectTapTargets(page, [
    ".aiNutritionProfileLinkBtn",
    ".aiNutritionTrainingDaysGrid button",
    ".aiNutritionGoalPicker button",
    ".aiNutritionPrimaryBtn"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-ai-coach-nutrition-onboarding.png");

  await page.locator(".aiNutritionPrimaryBtn").click();
  await expect(page.locator(".aiNutritionPlanCardFull")).toBeVisible();
  await expectTapTargets(page, [
    ".aiNutritionAdaptBtn",
    ".aiNutritionPlanActions button"
  ]);
  await page.locator(".aiNutritionAdaptBtn").click();
  await expect(page.locator(".aiNutritionAdaptResult")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-ai-coach-nutrition-plan.png");

  assertNoRuntimeErrors();
});
