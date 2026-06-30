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

async function expectMinHeights(page, selectors, minHeight = 40) {
  const failures = await page.evaluate(({ targetSelectors, minimumHeight }) => {
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
            height: Math.round(rect.height)
          };
        })
        .filter((item) => item.height < minimumHeight)
    ));
  }, { targetSelectors: selectors, minimumHeight: minHeight });

  expect(failures).toEqual([]);
}

async function isVisible(locator) {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  });
}

async function openTrainerPrograms(page) {
  const mobileNav = page.locator(".trainerNextMobileNav");
  if (await isVisible(mobileNav)) {
    await expect(page.getByTestId("trainer-nav-more")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("trainer-nav-more").click();
    await expect(page.locator(".trainerNextMoreDrawer")).toBeVisible();
    await expect(page.getByTestId("trainer-more-workouts")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("trainer-more-workouts").click();
    return;
  }

  await expect(page.getByTestId("trainer-desktop-nav-workouts")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("trainer-desktop-nav-workouts").click();
}

async function trainerNavButton(page, section) {
  const mobileButton = page.getByTestId(`trainer-nav-${section}`);
  if (await mobileButton.count() && await mobileButton.isVisible()) return mobileButton;
  return page.getByTestId(`trainer-desktop-nav-${section}`);
}

async function clickTrainerNav(page, section) {
  const button = await trainerNavButton(page, section);
  await expect(button).toBeVisible({ timeout: 40_000 });
  await button.click();
}

test("trainer visual audit covers dashboard, clients, messages and programs", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible();
  await expect(page.locator(".trainerNextDashboard")).toBeVisible();
  await expectTapTargets(page, [
    ".trainerNextMobileNav button",
    ".trainerNextDesktopNav button",
    ".trainerNextPrimary",
    ".trainerNextSecondary"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-dashboard.png");

  await clickTrainerNav(page, "clients");
  await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  await expectTapTargets(page, [
    ".trainerNextMobileNav button",
    ".trainerClientList button",
    ".trainerNextClientCard"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-clients.png");

  await page.getByRole("button", { name: /Germes/ }).first().click();
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expect(page.locator(".trainerNextClientTabs button")).toHaveCount(7);
  await expect(page.locator(".trainerNextClientTabs button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".trainerNextChartHead button[aria-pressed='true']")).toHaveCount(1);
  await page.locator(".trainerNextClientTabs button").nth(4).click();
  await expect(page.locator(".trainerExerciseProgressToolbar button[aria-pressed='true']")).toHaveCount(1);
  await page.locator(".trainerNextClientTabs button").nth(3).click();
  await expect(page.locator(".trainerClientBodyProgress")).toBeVisible();
  await expect(page.locator(".trainerPhotoViewTabs").first().locator("button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".trainerNextClientTabs button",
    ".trainerNextClientBackRow button",
    ".trainerNextMobileMore"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-card.png");

  await page.locator(".trainerNextClientTabs button").nth(2).click();
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  await page.locator(".trainerNutritionDiaryCollapsed").click();
  await expect(page.locator(".trainerNutritionDiary aside button[aria-pressed='true']")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await page.locator(".trainerNextClientTabs button").nth(5).click();
  await expect(page.locator(".trainerNotificationCalendarGrid")).toBeVisible();
  await expect(page.locator(".trainerNotificationLegend")).toBeVisible();
  await expect(page.locator(".trainerReminderPeriod button[aria-pressed='true']")).toHaveCount(2);
  await expect(page.locator(".trainerNotificationCalendarGrid button[aria-pressed='true']")).not.toHaveCount(0);
  await expectTapTargets(page, [
    ".trainerReminderPeriod button",
    ".trainerNotificationOffsets label",
    ".trainerNotificationActions button"
  ]);
  await expectMinHeights(page, [".trainerNotificationCalendarGrid button"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-notifications.png");

  await clickTrainerNav(page, "messages");
  await expect(page.locator(".trainerMessageCenter")).toBeVisible();
  await expect(page.locator(".trainerMessageFilters button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".trainerMessageList > button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".trainerMessageFilters button",
    ".trainerMessageList > button",
    ".trainerNextMobileNav button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-messages.png");

  await page.locator(".trainerMessageList > button").first().click();
  await expect(page.locator(".trainerMessageModal")).toBeVisible();
  await expect(page.locator(".trainerMessageModalSend")).toBeDisabled();
  await page.locator(".trainerMessageCoachHint button").first().click();
  await expect(page.locator(".trainerMessageModalSend")).toBeEnabled();
  await expectTapTargets(page, [
    ".trainerMessageCoachHint button",
    ".trainerMessageModalSend",
    ".trainerMessageModalHead button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-message-modal.png");
  await page.locator(".trainerMessageModalHead button").click();
  await expect(page.locator(".trainerMessageModal")).toBeHidden();

  await openTrainerPrograms(page);
  await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
  await expect(page.locator(".trainerNextPageTabs button").nth(1)).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expect(page.locator(".trainerNextWorkoutDaySelect[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".trainerNextPageTabs button",
    ".trainerNextWorkoutDayItem",
    ".trainerNextExerciseName",
    ".trainerNextHeadActions button",
    ".trainerNextMobileHeader button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-programs.png");

  await page.locator(".trainerNextExerciseName").first().click();
  await expect(page.locator(".trainerNextExerciseEditor")).toBeVisible();
  await expect(page.locator(".trainerNextSetEditor input").first()).toBeVisible();
  await page.locator(".trainerNextSetEditor input").first().fill("10");
  await expectTapTargets(page, [
    ".trainerNextAddSet",
    ".trainerNextVideoUpload"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-editor.png");

  assertNoRuntimeErrors();
});
