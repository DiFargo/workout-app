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

async function expectPrimaryChrome(page, pageTestId, mode) {
  await expect(page.getByTestId(pageTestId)).toBeVisible();
  await expect(page.locator(".clientPageVersionBadge")).toBeVisible();
  await expect(page.locator(".clientCorePageTitle")).toBeVisible();
  if (mode === "main") {
    await expect(page.locator(".clientCorePageTitle")).toHaveText("Главное меню");
    await expect(page.locator(".profileMainSummaryGrid article")).toHaveCount(2);
  } else {
    await expect(page.locator(".clientCorePageTitle")).toHaveText("Личный кабинет");
    await expect(page.locator(".profileMainSummaryGrid article")).toHaveCount(0);
  }
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
  await expectTapTargets(page, [".clientBottomNav button"]);
  await expectNoHorizontalOverflow(page);
}

async function expectMainDashboardContent(page) {
  await expect(page.locator(".profileAiHero")).toBeVisible();
  await expect(page.locator(".profileAiSplitCards")).toBeVisible();
  await expect(page.locator(".profileAiCoachInsight")).toBeVisible();
  await expect(page.locator(".mainMeasurementSnapshot")).toBeVisible();
}

async function expectMainMeasurementSnapshotLayout(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (selector) => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            x: rect.x,
            y: rect.y,
            right: rect.right,
            bottom: rect.bottom
          }
        : null;
    };
    const overlaps = (a, b) => Boolean(a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y);

    const card = rectOf(".mainMeasurementSnapshot");
    const header = rectOf(".mainMeasurementSnapshotHeader span");
    const weightLabel = rectOf(".mainMeasurementWeight span");
    const chart = rectOf(".mainMeasurementChart");

    return {
      skipped: window.innerWidth > 640,
      card,
      header,
      weightLabel,
      chart,
      headerOverlapsWeight: overlaps(header, weightLabel),
      chartEscapesCard: Boolean(card && chart && chart.bottom > card.bottom + 1)
    };
  });

  if (metrics.skipped) return;

  expect(metrics.card).not.toBeNull();
  expect(metrics.header).not.toBeNull();
  expect(metrics.weightLabel).not.toBeNull();
  expect(metrics.chart).not.toBeNull();
  expect(metrics.headerOverlapsWeight).toBe(false);
  expect(metrics.chartEscapesCard).toBe(false);
}

async function expectClientCardTextReadable(page, mode) {
  const metrics = await page.evaluate((activeMode) => {
    const rectOf = (selector) => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            x: rect.x,
            right: rect.right
          }
        : null;
    };
    const clippedTexts = [
      ".profileAiStatsRow strong",
      ".profileAiMiniCard strong",
      ".profileProgressInsightBadge small"
    ].flatMap((selector) => (
      [...document.querySelectorAll(selector)].map((node) => ({
        selector,
        text: node.textContent.trim(),
        scrollWidth: Math.ceil(node.scrollWidth),
        clientWidth: Math.ceil(node.clientWidth)
      }))
    )).filter((item) => item.scrollWidth > item.clientWidth + 1);

    return {
      skipped: window.innerWidth > 640,
      avatar: rectOf(".profileAiAvatar"),
      title: rectOf(".profileAiHeroText h1"),
      clippedTexts: activeMode === "main" ? clippedTexts : []
    };
  }, mode);

  if (metrics.skipped) return;

  expect(metrics.avatar).not.toBeNull();
  expect(metrics.title).not.toBeNull();
  expect(metrics.title.x).toBeGreaterThanOrEqual(metrics.avatar.right + 8);
  expect(metrics.clippedTexts).toEqual([]);
}

async function expectCabinetContent(page) {
  await expect(page.locator(".profileAiHero")).toBeVisible();
  await expect(page.locator(".profileCabinetProgressOverview")).toBeVisible();
  await expect(page.locator(".progressHubCard")).toHaveCount(6);
}

async function expectContentAboveBottomNav(page) {
  const initialScrollTop = await page.evaluate(() => {
    const scroller = document.querySelector(".clientCorePage");
    return scroller?.scrollTop || 0;
  });

  await page.evaluate(() => {
    const scroller = document.querySelector(".clientCorePage");
    scroller?.scrollTo(0, scroller.scrollHeight);
  });

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

  await page.evaluate((scrollTop) => {
    const scroller = document.querySelector(".clientCorePage");
    scroller?.scrollTo(0, scrollTop);
  }, initialScrollTop);

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
  await expectPrimaryChrome(page, "client-harness-main", "main");
  await expectMainDashboardContent(page);
  await expectMainMeasurementSnapshotLayout(page);
  await expectClientCardTextReadable(page, "main");
  await expectContentAboveBottomNav(page);
  await attachScreenshot(page, testInfo, "client-main-dashboard.png");
  assertNoRuntimeErrors();

  await clickClientCabinetNav(page);
  await expectPrimaryChrome(page, "client-harness-cabinet", "cabinet");
  await expectCabinetContent(page);
  await expectClientCardTextReadable(page, "cabinet");
  await expectContentAboveBottomNav(page);
  await attachScreenshot(page, testInfo, "client-cabinet.png");

  await page.locator(".cabinetWorkoutHistoryHarnessButton").click();
  await expect(page.locator(".cabinetWorkoutHistoryModal")).toBeVisible();
  await expect(page.locator(".cabinetWorkoutHistoryItem > button").first()).toHaveAttribute("aria-label", /тренировку:/);
  await expect(page.locator(".cabinetWorkoutHistoryDelete").first()).toHaveAttribute("aria-label", /Удалить тренировку:/);
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
  await expect(page.locator(".cabinetMeasurementModalStart")).toHaveAttribute("aria-label", "Начать новый замер тела");
  await expect(page.locator(".cabinetMeasurementModalGrid div[aria-label]")).not.toHaveCount(0);
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
  await expect(page.locator(".profileNutritionMonthDay[aria-label]")).toHaveCount(7);
  await expect(page.locator(".profileNutritionMonthDay.today[aria-current='date']")).toHaveCount(1);
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
  await expect(page.locator(".cabinetWorkoutCalendarGrid button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".cabinetWorkoutCalendarGrid button[aria-current='date']")).toHaveCount(1);
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
  await expect(page.locator(".cabinetProgressPhotosCompareTabs button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".cabinetProgressPhotosCompareControls select[aria-label]")).toHaveCount(2);
  await expect(page.locator(".cabinetProgressPhotoSteps input").first()).toHaveAttribute("aria-label", /Добавить фото:/);
  await expectTapTargets(page, [
    ".cabinetProgressPhotosHead button",
    ".cabinetProgressPhotoSteps label",
    ".cabinetProgressPhotosCompareTabs button",
    ".cabinetProgressPhotosSave"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-progress-photos-modal.png");
  await page.locator(".cabinetProgressPhotosHead button").click();
  await expect(page.locator(".cabinetProgressPhotosModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=settings");
  await clickClientCabinetNav(page);
  await expect(page.locator(".cabinetSettingsModal")).toBeVisible();
  await expect(page.locator(".profileThemeSwitchBtn")).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expect(page.locator(".profileSexPicker button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".profileBodyMetricsGridTwo select[aria-label]")).toHaveCount(2);
  await expect(page.locator(".profileSettingsTelegramItem")).toHaveAttribute("aria-label", /Telegram/);
  await expectTapTargets(page, [
    ".cabinetUtilityModalHead button",
    ".cabinetSettingsModal .profileDashboardButton",
    ".profileThemeSwitchBtn",
    ".profileSexPicker button",
    ".profileBodySaveBtn",
    ".profileSettingsTelegramItem"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-settings-modal.png");
  await page.locator(".cabinetUtilityModalHead button").click();
  await expect(page.locator(".cabinetSettingsModal")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=notifications");
  await clickClientCabinetNav(page);
  await expect(page.locator(".profileTrainerNotificationsModal")).toBeVisible();
  await expect(page.locator(".profileTrainerNotificationItem").first()).toHaveAttribute("aria-label", /Задача тренера:/);
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
  await expect(page.locator(".profileTelegramModalOverlay")).toHaveAttribute("role", "presentation");
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

test("client first setup visual audit covers selected choices", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=1");
  await expect(page.getByTestId("client-harness-first-setup")).toBeAttached();
  await expect(page.locator(".firstSetupOverlay")).toBeVisible();
  await expect(page.locator(".firstSetupSexGrid button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [".firstSetupSexGrid button", ".firstSetupPrimary", ".firstSetupSecondary"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-first-setup-sex.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=6");
  await expect(page.getByTestId("client-harness-first-setup")).toBeAttached();
  await expect(page.locator(".firstSetupOverlay")).toBeVisible();
  await expect(page.locator(".firstSetupActivityList button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [".firstSetupActivityList button", ".firstSetupPrimary", ".firstSetupSecondary"]);
  await expectNoHorizontalOverflow(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=7");
  await expect(page.getByTestId("client-harness-first-setup")).toBeAttached();
  await expect(page.locator(".firstSetupOverlay")).toBeVisible();
  await expect(page.locator(".firstSetupGoalGrid button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [".firstSetupGoalGrid button", ".firstSetupPrimary", ".firstSetupSecondary"]);
  await expectNoHorizontalOverflow(page);

  await page.locator(".firstSetupGoalGrid button").first().click();
  await expect(page.locator(".firstSetupGoalGrid button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".firstSetupGoalGrid button").first()).toHaveAttribute("aria-pressed", "true");
  assertNoRuntimeErrors();
});
