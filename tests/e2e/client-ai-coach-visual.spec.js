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

  for (const theme of ["warm-light", "dark-green"]) {
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: width === 320 ? 720 : 844 });
      await page.goto(`/?clientHarness=1&clientHarnessPage=aiCoach&clientHarnessTheme=${theme}`);
      await expect(page.getByTestId("client-harness-ai-coach")).toBeVisible({ timeout: 40_000 });
      await expect(page.getByTestId("ai-coach-page")).toBeVisible();
      await expect(page.getByTestId("ai-coach-hero")).toBeVisible();
      await expect(page.getByTestId("ai-coach-result")).toBeVisible();
      await expect(page.locator("[data-testid^='ai-coach-feature-']")).toHaveCount(8);
      await expect(page.locator("[data-testid^='ai-coach-feature-'][aria-pressed='true']")).toHaveCount(1);
      await expectNoHorizontalOverflow(page);

      const visualContract = await page.getByTestId("ai-coach-page").evaluate((root) => {
        const heading = root.querySelector("h1");
        const rootRect = root.getBoundingClientRect();
        const backRect = root.querySelector("[data-testid='ai-coach-back']")?.getBoundingClientRect();
        return {
          width: Math.round(rootRect.width),
          headingColor: heading ? getComputedStyle(heading).color : "",
          backWidth: Math.round(backRect?.width || 0),
          backHeight: Math.round(backRect?.height || 0)
        };
      });
      expect(visualContract.width).toBeLessThanOrEqual(theme === "warm-light" ? 402 : 560);
      expect(visualContract.headingColor).toBe(theme === "warm-light" ? "rgb(40, 38, 46)" : "rgb(255, 255, 255)");
      expect(visualContract.backWidth).toBe(theme === "warm-light" ? 44 : 46);
      expect(visualContract.backHeight).toBe(theme === "warm-light" ? 44 : 46);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?clientHarness=1&clientHarnessPage=aiCoach&clientHarnessTheme=warm-light");
  await expect(page.getByTestId("client-harness-ai-coach")).toBeVisible({ timeout: 40_000 });
  await expectTapTargets(page, [
    "[data-testid='ai-coach-back']",
    "[data-testid^='ai-coach-feature-']"
  ]);
  await attachScreenshot(page, testInfo, "client-ai-coach-overview.png");

  await page.getByTestId("ai-coach-feature-nutritionPlan").click();
  await expect(page.getByTestId("ai-nutrition-onboarding")).toBeVisible();
  await expect(page.getByTestId("ai-coach-feature-nutritionPlan")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ai-nutrition-training-days").locator("button[aria-pressed='true']")).not.toHaveCount(0);
  await expect(page.getByTestId("ai-nutrition-goals").locator("button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    "[data-testid='ai-nutrition-profile-link']",
    "[data-testid='ai-nutrition-training-days'] button",
    "[data-testid='ai-nutrition-goals'] button",
    "[data-testid='ai-nutrition-create']"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-ai-coach-nutrition-onboarding.png");

  await page.getByTestId("ai-nutrition-create").click();
  await expect(page.getByTestId("ai-nutrition-plan")).toBeVisible();
  await expectTapTargets(page, [
    "[data-testid='ai-nutrition-adapt']",
    "[data-testid='ai-nutrition-plan-actions'] button"
  ]);
  await page.getByTestId("ai-nutrition-adapt").click();
  await expect(page.getByTestId("ai-nutrition-adapt-result")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-ai-coach-nutrition-plan.png");

  assertNoRuntimeErrors();
});
