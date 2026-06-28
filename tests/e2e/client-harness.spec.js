import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function collectPrimaryLayoutMetric(page, navTestId, pageTestId, titleSelector) {
  if (navTestId) {
    await page.getByTestId(navTestId).click();
  }

  await expect(page.getByTestId(pageTestId)).toBeVisible();
  await expect(page.locator(titleSelector)).toBeVisible();
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();

  return page.evaluate((selector) => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();

      return rect
        ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            bottom: Math.round(rect.bottom)
          }
        : null;
    };

    return {
      viewportWidth: window.innerWidth,
      version: rectOf(document.querySelector(".clientPageVersionBadge")),
      title: rectOf(document.querySelector(selector)),
      bottomNav: rectOf(document.querySelector(".clientBottomNav"))
    };
  }, titleSelector);
}

function expectCloseToBaseline(value, baseline, tolerance = 2) {
  expect(Math.abs(value - baseline)).toBeLessThanOrEqual(tolerance);
}

test("client primary mobile chrome keeps shared alignment", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");

  const main = await collectPrimaryLayoutMetric(
    page,
    null,
    "client-harness-main",
    ".clientCorePageTitle"
  );

  if (main.viewportWidth > 640) {
    assertNoRuntimeErrors();
    return;
  }

  const workouts = await collectPrimaryLayoutMetric(
    page,
    "client-nav-workouts",
    "client-harness-workouts",
    ".workoutSelectTitle"
  );
  const nutrition = await collectPrimaryLayoutMetric(
    page,
    "client-nav-nutrition",
    "client-harness-nutrition",
    ".nutritionHeroTitleV4 .clientCorePageTitle"
  );
  const cabinet = await collectPrimaryLayoutMetric(
    page,
    "client-nav-cabinet",
    "client-harness-cabinet",
    ".clientCorePageTitle"
  );

  for (const metric of [workouts, nutrition, cabinet]) {
    expectCloseToBaseline(metric.version.y, main.version.y);
    expectCloseToBaseline(metric.version.height, main.version.height);
    expectCloseToBaseline(metric.title.y, main.title.y);
    expectCloseToBaseline(metric.title.height, main.title.height);
    expectCloseToBaseline(metric.bottomNav.x, main.bottomNav.x);
    expectCloseToBaseline(metric.bottomNav.y, main.bottomNav.y);
    expectCloseToBaseline(metric.bottomNav.width, main.bottomNav.width);
    expectCloseToBaseline(metric.bottomNav.height, main.bottomNav.height);
  }

  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();

  const workoutCardMetric = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            y: Math.round(rect.y),
            height: Math.round(rect.height),
            bottom: Math.round(rect.bottom)
          }
        : null;
    };
    const deck = document.querySelector(".individualWorkoutDeck");
    const deckStyle = deck ? getComputedStyle(deck) : null;

    return {
      card: rectOf(document.querySelector(".individualWorkoutCardPro")),
      startButton: rectOf(document.querySelector(".individualWorkoutCardStartButton")),
      progress: rectOf(document.querySelector(".individualWorkoutBottomProgress")),
      bottomNav: rectOf(document.querySelector(".clientBottomNav")),
      deckOverflow: deckStyle?.overflow || ""
    };
  });

  expect(workoutCardMetric.deckOverflow).toBe("visible");
  expect(workoutCardMetric.startButton.bottom).toBeLessThanOrEqual(workoutCardMetric.card.bottom);
  expect(workoutCardMetric.card.bottom).toBeLessThan(workoutCardMetric.progress.y);
  expect(workoutCardMetric.progress.bottom).toBeLessThanOrEqual(workoutCardMetric.bottomNav.y);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("client harness smoke: main, workouts, nutrition and cabinet stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");

  await expect(page.getByTestId("client-harness-main")).toBeVisible();
  await expect(page.getByText(/^v(?:\.\d+)+$/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.locator(".workoutSelectTitle")).toBeVisible();
  await expect(page.locator(".workoutSelectTitle")).toHaveText("Мой план");
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
