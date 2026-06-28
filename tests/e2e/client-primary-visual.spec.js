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

async function clickClientCabinetNav(page) {
  await expect(page.getByTestId("client-nav-cabinet")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-cabinet").click();
}

test("client primary visual audit covers main dashboard and cabinet", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1");
  await expectPrimaryChrome(page, "client-harness-main");
  await expectContentAboveBottomNav(page);
  await attachScreenshot(page, testInfo, "client-main-dashboard.png");
  assertNoRuntimeErrors();

  await clickClientCabinetNav(page);
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
  await clickClientCabinetNav(page);
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
  await clickClientCabinetNav(page);
  await expect(page.locator(".cabinetNutritionModal")).toBeVisible();
  await expect(page.locator(".profileGoalPicker button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".profileGoalPicker button").first()).toHaveAttribute("aria-label", /Выбрать цель питания:/);
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

  await page.goto("/?clientHarness=1&clientCabinetModal=calendar");
  await clickClientCabinetNav(page);
  await expect(page.locator(".cabinetProgressModal")).toBeVisible();
  await expectTapTargets(page, [
    ".cabinetUtilityModalHead button",
    ".cabinetWorkoutCalendarNav button",
    ".cabinetWorkoutCalendarPlanner > button",
    ".cabinetWorkoutCalendarDay > button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-workout-calendar-modal.png");
  await page.locator(".cabinetWorkoutCalendarPlanner > button").click();
  await expect(page.locator(".cabinetWorkoutCalendarEditActions")).toBeVisible();
  await expectTapTargets(page, [".cabinetWorkoutCalendarEditActions button"]);
  await page.locator(".cabinetUtilityModalHead button").click();
  await expect(page.locator(".cabinetProgressModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=photos");
  await clickClientCabinetNav(page);
  await expect(page.locator(".cabinetProgressPhotosModal")).toBeVisible();
  await expectTapTargets(page, [
    ".cabinetProgressPhotosHead button",
    ".cabinetProgressPhotoSteps label",
    ".cabinetProgressPhotosSave"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-progress-photos-modal.png");
  await page.locator(".cabinetProgressPhotosHead button").click();
  await expect(page.locator(".cabinetProgressPhotosModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=settings");
  await clickClientCabinetNav(page);
  await expect(page.locator(".cabinetSettingsModal")).toBeVisible();
  await expectTapTargets(page, [
    ".cabinetUtilityModalHead button",
    ".cabinetSettingsModal .profileDashboardButton"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-settings-modal.png");
  await page.locator(".cabinetUtilityModalHead button").click();
  await expect(page.locator(".cabinetSettingsModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=notifications");
  await clickClientCabinetNav(page);
  await expect(page.locator(".profileTrainerNotificationsModal")).toBeVisible();
  await expectTapTargets(page, [
    ".profileTrainerNotificationsHead button",
    ".profileTrainerNotificationItem"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-trainer-notifications-modal.png");
  await page.locator(".profileTrainerNotificationsHead button").click();
  await expect(page.locator(".profileTrainerNotificationsModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=telegram");
  await clickClientCabinetNav(page);
  await expect(page.locator(".profileTelegramManageModal")).toBeVisible();
  await expect(page.locator(".profileTelegramManageModal")).toHaveAttribute("role", "dialog");
  await expect(page.locator(".profileTelegramManageModal")).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".profileTelegramModalClose")).toHaveAttribute("aria-label", "Закрыть Telegram");
  await expectTapTargets(page, [
    ".profileTelegramModalClose",
    ".profileTelegramManageActions button",
    ".profileTelegramSave"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-telegram-modal.png");
  await page.locator(".profileTelegramSave").click();
  await expect(page.locator(".profileTelegramManageModal")).toBeHidden();

  assertNoRuntimeErrors();
});
