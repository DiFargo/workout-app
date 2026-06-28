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

async function isVisible(locator) {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  });
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

async function clickIfVisible(locator) {
  if (await locator.count() && await locator.first().isVisible()) {
    await locator.first().click();
    return true;
  }
  return false;
}

async function openTrainerPrograms(page) {
  const mobileNav = page.locator(".trainerNextMobileNav");
  if (await isVisible(mobileNav)) {
    const moreButton = page.getByTestId("trainer-nav-more");
    await expect(moreButton).toBeVisible({ timeout: 40_000 });
    await moreButton.click();
    await expect(page.locator(".trainerNextMoreDrawer")).toBeVisible();
    await expect(page.getByTestId("trainer-more-workouts")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("trainer-more-workouts").click();
    return;
  }
  await expect(page.getByTestId("trainer-desktop-nav-workouts")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("trainer-desktop-nav-workouts").click();
}

test("trainer workspace smoke: dashboard, clients, client card and messages stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  const main = page.locator(".trainerNextMain");

  await expect(page.locator(".trainerNextRoot")).toBeVisible();
  await expect(page.getByText(/^v(?:\.\d+)+$/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickTrainerNav(page, "clients");
  await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  await expect(main.locator("h1")).toHaveCount(1);
  await expect(page.getByText("Germes")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByRole("button", { name: /Germes/ }).first().click();
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expect(main.locator(".trainerNextClientTabs button")).toHaveCount(7);

  await main.locator(".trainerNextClientTabs button").nth(1).click();
  await expect(page.locator(".trainerWorkoutScheduleGrid")).toBeVisible();
  await expect(page.locator(".trainerWorkoutScheduleLegend")).toBeVisible();
  await expect(page.locator(".trainerClientProgramEditButton")).toBeVisible();
  await page.locator(".trainerClientProgramEditButton").click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModalBody")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModal")).toContainText("tren+");
  await page.locator(".trainerWorkoutEditorModal header button").click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  if (await clickIfVisible(page.locator(".trainerNextClientBackRow .trainerNextPrimary"))) {
    await expect(page.locator(".trainerClientMessageModal")).toBeVisible();
    await page.locator(".trainerClientMessageModal textarea").fill("Smoke message to client");
    await page.locator(".trainerClientMessageModal .trainerNextPrimary").click();
    await expect(page.locator(".trainerClientMessageModal")).toBeHidden();
  }

  const desktopActionsOpened = await clickIfVisible(page.locator(".trainerNextClientBackRow button").nth(2));
  if (!desktopActionsOpened) {
    await page.locator(".trainerNextMobileMore").click();
  }
  await expect(page.locator(".trainerClientActionSheet")).toBeVisible();
  await expect(page.locator(".trainerClientActionSheet button.danger")).toBeVisible();
  await page.locator(".trainerClientActionSheet header button").click();
  await expect(page.locator(".trainerClientActionSheet")).toBeHidden();
  assertNoRuntimeErrors();

  await main.locator(".trainerNextClientTabs button").nth(2).click();
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  await expect(page.locator(".trainerNextClientTabs button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".trainerNutritionPeriodButtons button[aria-pressed='true']")).toHaveCount(1);
  await main.locator(".trainerNextClientTabs button").nth(5).click();
  await expect(page.locator(".trainerNotificationCalendarGrid")).toBeVisible();
  await expect(page.locator(".trainerNotificationLegend")).toBeVisible();
  await page.locator(".trainerNotificationOffsets label").first().click();
  await page.locator(".trainerNotificationActions .trainerNextPrimary").click();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickTrainerNav(page, "messages");
  await expect(page.locator(".trainerMessageCenter")).toBeVisible();
  await expect(main.locator("h1")).toHaveCount(1);
  await expect(page.locator(".trainerMessageFilters")).toBeVisible();
  await expect(page.locator(".trainerMessageFilters button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".trainerMessageList > button")).toHaveCount(1);
  await page.locator(".trainerMessageList > button").first().click();
  await expect(page.locator(".trainerMessageModal")).toBeVisible();
  await page.locator(".trainerMessageCoachHint button").first().click();
  await expect(page.locator(".trainerMessageModalSend")).toBeEnabled();
  await page.locator(".trainerMessageModalSend").click();
  await expect(page.locator(".trainerMessageStatus")).toBeVisible();
  await page.locator(".trainerMessageModalHead button").click();
  await expect(page.locator(".trainerMessageModal")).toBeHidden();
  await page.locator(".trainerMessageFilters button").nth(1).click();
  await expect(page.locator(".trainerMessageFilters button.active")).toBeVisible();
  await expect(page.locator(".trainerMessageFilters button[aria-pressed='true']")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("trainer mobile overflow menu opens compact extra sections", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile overflow exists only on compact trainer navigation.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");

  await expect(page.getByTestId("trainer-nav-more")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("trainer-nav-more").click();
  await expect(page.locator(".trainerNextMoreDrawer")).toBeVisible();
  await expect(page.locator(".trainerNextMoreDrawer nav button")).toHaveCount(4);
  await expect(page.getByTestId("trainer-more-workouts")).toBeVisible();
  await page.getByTestId("trainer-more-workouts").click();
  await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
  assertNoRuntimeErrors();
});

test("trainer programs page keeps editor, preview and library usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");

  await openTrainerPrograms(page);
  await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
  await expect(page.locator(".trainerNextMain h1")).toHaveCount(1);
  await expect(page.locator(".trainerNextWorkoutLayout")).toBeVisible();
  await expect(page.locator(".trainerNextWorkoutDays .trainerNextWorkoutDayItem")).toHaveCount(2);
  await expect(page.locator(".trainerNextExerciseList article")).toHaveCount(2);
  await expect(page.locator(".trainerNextExerciseName").first()).toBeVisible();
  await page.locator(".trainerNextExerciseName").first().click();
  await expect(page.locator(".trainerNextExerciseEditor")).toBeVisible();
  await page.locator(".trainerNextSetEditor input").first().fill("10");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  const desktopPreviewOpened = await clickIfVisible(page.locator(".trainerNextHeadActions button").first());
  if (!desktopPreviewOpened) {
    await page.locator(".trainerNextMobileHeader button").first().click();
  }
  await expect(page.locator(".trainerNextWorkoutPreview")).toBeVisible();
  await expect(page.locator(".trainerNextWorkoutPreview article")).toHaveCount(2);
  await page.locator(".trainerNextModalClose").click();
  await expect(page.locator(".trainerNextWorkoutPreview")).toBeHidden();

  await page.locator(".trainerNextPageTabs button").nth(1).click();
  await expect(page.locator(".trainerNextLibrary")).toBeVisible();
  await expect(page.locator(".trainerNextLibrary article")).toHaveCount(3);
  const firstExerciseName = await page.locator(".trainerNextLibrary article strong").first().textContent();
  await page.locator(".trainerNextLibrary input").fill((firstExerciseName || "").slice(0, 4));
  await expect(page.locator(".trainerNextLibrary article").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
