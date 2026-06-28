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
    await page.getByTestId("trainer-nav-more").click();
    await expect(page.locator(".trainerNextMoreDrawer")).toBeVisible();
    await page.getByTestId("trainer-more-workouts").click();
    return;
  }

  await page.getByTestId("trainer-desktop-nav-workouts").click();
}

async function trainerNavButton(page, section) {
  const mobileButton = page.getByTestId(`trainer-nav-${section}`);
  if (await mobileButton.count() && await mobileButton.isVisible()) return mobileButton;
  return page.getByTestId(`trainer-desktop-nav-${section}`);
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

  await (await trainerNavButton(page, "clients")).click();
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
  await expectTapTargets(page, [
    ".trainerNextClientTabs button",
    ".trainerNextClientBackRow button",
    ".trainerNextMobileMore"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-card.png");

  await (await trainerNavButton(page, "messages")).click();
  await expect(page.locator(".trainerMessageCenter")).toBeVisible();
  await expectTapTargets(page, [
    ".trainerMessageFilters button",
    ".trainerMessageList > button",
    ".trainerNextMobileNav button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-messages.png");

  await openTrainerPrograms(page);
  await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
  await expectTapTargets(page, [
    ".trainerNextPageTabs button",
    ".trainerNextWorkoutDayItem",
    ".trainerNextExerciseName",
    ".trainerNextHeadActions button",
    ".trainerNextMobileHeader button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-programs.png");

  assertNoRuntimeErrors();
});
