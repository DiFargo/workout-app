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

async function expectPrimaryChrome(page, pageTestId) {
  await expect(page.getByTestId(pageTestId)).toBeVisible();
  await expect(page.locator(".clientPageVersionBadge")).toBeVisible();
  await expect(page.locator(".clientCorePageTitle")).toBeVisible();
  await expect(page.locator(".profileMainSummaryGrid article")).toHaveCount(2);
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
  await expectTapTargets(page, [".clientBottomNav button"]);
  await expectNoHorizontalOverflow(page);
}

async function expectContentAboveBottomNav(page) {
  const metrics = await page.evaluate(() => {
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
      card: rectOf(document.querySelector(".profileCabinetSection")),
      bottomNav: rectOf(document.querySelector(".clientBottomNav"))
    };
  });

  expect(metrics.card).not.toBeNull();
  expect(metrics.bottomNav).not.toBeNull();
  expect(metrics.card.bottom).toBeLessThanOrEqual(metrics.bottomNav.y + 1);
}

test("client primary visual audit covers main dashboard and cabinet", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1");
  await expectPrimaryChrome(page, "client-harness-main");
  await expectContentAboveBottomNav(page);
  await attachScreenshot(page, testInfo, "client-main-dashboard.png");
  assertNoRuntimeErrors();

  await page.getByTestId("client-nav-cabinet").click();
  await expectPrimaryChrome(page, "client-harness-cabinet");
  await expectContentAboveBottomNav(page);
  await attachScreenshot(page, testInfo, "client-cabinet.png");

  await page.locator(".cabinetWorkoutHistoryHarnessButton").click();
  await expect(page.locator(".cabinetWorkoutHistoryModal")).toBeVisible();
  await expectTapTargets(page, [
    ".workoutModeModalHeader button",
    ".cabinetWorkoutHistoryItem > button",
    ".cabinetWorkoutHistoryDelete"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-workout-history-modal.png");
  await page.locator(".workoutModeModalHeader button").click();
  await expect(page.locator(".cabinetWorkoutHistoryModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=measurements");
  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.locator(".cabinetMeasurementModal")).toBeVisible();
  await expectTapTargets(page, [
    ".cabinetMeasurementModalHead button",
    ".cabinetMeasurementModalStart"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-measurements-modal.png");
  await page.locator(".cabinetMeasurementModalHead button").click();
  await expect(page.locator(".cabinetMeasurementModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=nutrition");
  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.locator(".cabinetNutritionModal")).toBeVisible();
  await expectTapTargets(page, [
    ".cabinetNutritionModalHead button",
    ".profileGoalPicker button",
    ".profileDashboardButton",
    ".profileNutritionCalendarMonthTitle button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-nutrition-modal.png");
  await page.locator(".cabinetNutritionModalHead button").click();
  await expect(page.locator(".cabinetNutritionModal")).toBeHidden();

  assertNoRuntimeErrors();
});
