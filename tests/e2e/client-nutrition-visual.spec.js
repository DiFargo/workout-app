import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

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

async function expectTapTargets(page, selectors, minSize = 44) {
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

async function expectAboveBottomBar(page, floatingSelector) {
  const metrics = await page.evaluate((selector) => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            y: Math.round(rect.y),
            bottom: Math.round(rect.bottom)
          }
        : null;
    };

    return {
      floating: rectOf(document.querySelector(selector)),
      bottomBar: rectOf(document.querySelector(".fatSearchBottomBar, .clientBottomNav"))
    };
  }, floatingSelector);

  expect(metrics.floating).not.toBeNull();
  expect(metrics.bottomBar).not.toBeNull();
  expect(metrics.floating.bottom).toBeLessThanOrEqual(metrics.bottomBar.y + 1);
}

test("client nutrition visual audit covers dense actions and modal entry points", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1");
  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.locator(".nutritionHeroTitleV4 .clientCorePageTitle")).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await expectTapTargets(page, [
    ".nutritionHeaderIconButton",
    ".nutritionOrbitHitButton",
    ".nutritionZoukHeader",
    ".nutritionAiPlanTopCard",
    ".clientBottomNav button"
  ]);
  await attachScreenshot(page, testInfo, "client-nutrition-main.png");

  await page.locator(".nutritionHeaderIconButton").first().click();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeVisible();
  await expectTapTargets(page, [
    ".fatSearchClosePremium",
    ".fatSearchTitleButtonPremium",
    ".foodSearchRecentCard",
    ".foodSearchFixedPhotoAction",
    ".fatSearchBottomBar button"
  ]);
  await expectAboveBottomBar(page, ".foodSearchFixedPhotoAction");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-food-search.png");
  await page.locator(".fatSearchClosePremium").click();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeHidden();

  await page.locator(".nutritionHeaderIconButton").nth(1).click();
  await expect(page.locator(".nutritionCalendarOverlay")).toBeVisible();
  await expect(page.locator(".nutritionCalendarDay")).toHaveCount(42);
  await expectTapTargets(page, [".nutritionCalendarClose"], 42);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-calendar.png");
  await page.locator(".nutritionCalendarClose").click();
  await expect(page.locator(".nutritionCalendarOverlay")).toBeHidden();

  await page.locator(".nutritionZoukHeader").click();
  await expect(page.locator(".nutritionZoukModalOverlay")).toBeVisible();
  await expectTapTargets(page, [".nutritionZoukModalHeader button", ".nutritionZoukAdd", ".nutritionZoukFood"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-diary-modal.png");
  await page.locator(".nutritionZoukModalHeader button").click();
  await expect(page.locator(".nutritionZoukModalOverlay")).toBeHidden();

  await page.locator(".nutritionAiPlanTopCard").click();
  await expect(page.locator(".nutritionAiPlanModal")).toBeVisible();
  await expectTapTargets(page, [".nutritionAiPlanToggleBtn"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-analysis-modal.png");
  await page.locator(".nutritionAiPlanToggleBtn").click();
  await expect(page.locator(".nutritionAiPlanModal")).toBeHidden();

  assertNoRuntimeErrors();
});
