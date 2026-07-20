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

async function collectPrimaryLayoutMetric(page, navTestId, pageTestId, titleSelector) {
  if (navTestId) {
    await clickClientNav(page, navTestId);
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
    const firstVisible = (targetSelector) => (
      [...document.querySelectorAll(targetSelector)].find((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);

        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }) || null
    );

    return {
      viewportWidth: window.innerWidth,
      version: rectOf(document.querySelector(".clientPageVersionBadge")),
      title: rectOf(firstVisible(selector)),
      bottomNav: rectOf(firstVisible('[data-testid="client-bottom-nav"]'))
    };
  }, titleSelector);
}

async function clickClientNav(page, navTestId) {
  await expect(page.getByTestId(navTestId)).toBeVisible({ timeout: 40_000 });
  await page.getByTestId(navTestId).click();
}

function expectCloseToBaseline(value, baseline, tolerance = 2) {
  expect(
    Math.abs(value - baseline),
    `Expected ${value} to stay within ${tolerance}px of ${baseline}`
  ).toBeLessThanOrEqual(tolerance);
}

test("client primary mobile chrome keeps shared alignment", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");

  const main = await collectPrimaryLayoutMetric(
    page,
    null,
    "client-harness-main",
    '[data-testid="profile-main-title"]'
  );

  if (main.viewportWidth > 640) {
    assertNoRuntimeErrors();
    return;
  }

  const workouts = await collectPrimaryLayoutMetric(
    page,
    "client-nav-workouts",
    "client-harness-workouts",
    '[data-testid="workout-list-title"]'
  );
  const nutrition = await collectPrimaryLayoutMetric(
    page,
    "client-nav-nutrition",
    "client-harness-nutrition",
    '[data-nutrition-header-part="title"]'
  );
  const cabinet = await collectPrimaryLayoutMetric(
    page,
    "client-nav-cabinet",
    "client-harness-cabinet",
    '[data-testid="profile-cabinet-title"]'
  );

  for (const metric of [workouts, nutrition, cabinet]) {
    // Stable primary screens keep page-specific top insets within the shared 36px rhythm.
    const titleYTolerance = 36;
    const titleHeightTolerance = 6;

    if (metric.version && main.version) {
      expectCloseToBaseline(metric.version.y, main.version.y);
      expectCloseToBaseline(metric.version.height, main.version.height);
    }
    expectCloseToBaseline(metric.title.y, main.title.y, titleYTolerance);
    expectCloseToBaseline(metric.title.height, main.title.height, titleHeightTolerance);
    expectCloseToBaseline(metric.bottomNav.x, main.bottomNav.x);
    expectCloseToBaseline(metric.bottomNav.y, main.bottomNav.y);
    expectCloseToBaseline(metric.bottomNav.width, main.bottomNav.width);
    expectCloseToBaseline(metric.bottomNav.height, main.bottomNav.height);
  }

  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();

  const workoutCardMetric = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom)
          }
        : null;
    };
    const deck = document.querySelector('[data-testid="workout-list-deck"]');
    const deckStyle = deck ? getComputedStyle(deck) : null;

    return {
      viewportWidth: window.innerWidth,
      header: rectOf(document.querySelector('[data-testid="workout-list-header"]')),
      card: rectOf(document.querySelector('[data-testid="workout-list-card"]')),
      cardTop: rectOf(document.querySelector('[data-testid="workout-card-top"]')),
      cardInfo: rectOf(document.querySelector('[data-testid="workout-card-info"]')),
      startButton: rectOf(document.querySelector('[data-testid="workout-start-button"]')),
      swipe: rectOf(document.querySelector('[data-testid="workout-swipe-affordance"]')),
      progress: rectOf(document.querySelector('[data-testid="workout-list-progress"]')),
      bottomNav: rectOf(document.querySelector('[data-testid="client-bottom-nav"]')),
      deckOverflow: deckStyle?.overflow || ""
    };
  });

  expect(workoutCardMetric.deckOverflow).toBe("visible");
  expect(workoutCardMetric.header.bottom).toBeLessThanOrEqual(workoutCardMetric.card.y);
  expect(workoutCardMetric.cardTop.y).toBeGreaterThanOrEqual(workoutCardMetric.card.y);
  expect(workoutCardMetric.cardInfo.y).toBeGreaterThan(workoutCardMetric.cardTop.bottom);
  expect(workoutCardMetric.cardInfo.bottom).toBeLessThan(workoutCardMetric.startButton.y);
  expect(workoutCardMetric.startButton.bottom).toBeLessThanOrEqual(workoutCardMetric.card.bottom);
  expect(workoutCardMetric.card.bottom).toBeLessThan(workoutCardMetric.swipe.y);
  expect(workoutCardMetric.swipe.bottom).toBeLessThanOrEqual(workoutCardMetric.progress.y);
  expect(Math.abs(
    workoutCardMetric.swipe.x + workoutCardMetric.swipe.width / 2 - workoutCardMetric.viewportWidth / 2
  )).toBeLessThanOrEqual(1);
  expect(workoutCardMetric.progress.bottom).toBeLessThanOrEqual(workoutCardMetric.bottomNav.y);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("client harness smoke: main, workouts, nutrition and cabinet stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");

  await expect(page.getByTestId("client-harness-main")).toBeVisible();
  await expect(page.getByTestId("profile-dashboard-version")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.getByTestId("workout-list-title")).toBeVisible();
  await expect(page.getByTestId("workout-list-title")).toHaveText("Мой план");
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByTestId("workout-mode-button").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeVisible();
  await page.getByTestId("workout-mode-dialog-close").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeHidden();

  await page.getByTestId("workout-history-button").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeVisible();
  await page.getByTestId("workout-history-dialog-close").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeHidden();

  const workoutCard = page.getByTestId("workout-list-card");
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
  await expect(page.getByTestId("workout-list-progress")).toContainText("2");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickClientNav(page, "client-nav-nutrition");
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.getByTestId("nutrition-orbit-add")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.locator("[data-nutrition-header-action]").first().click();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
  await page.locator('[data-food-search-header-action="close"]').click();
  await expect(page.getByTestId("food-search-screen")).toBeHidden();

  await page.locator("[data-nutrition-header-action]").nth(1).click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeVisible();
  await expect(page.locator("[data-nutrition-calendar-day]")).toHaveCount(42);
  await page.getByTestId("nutrition-calendar-close").click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeHidden();

  await page.locator('[data-nutrition-summary-part="card"]').click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeVisible();
  await page.getByTestId("nutrition-plan-close").click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeHidden();

  await page.getByTestId("nutrition-diary-toggle").click();
  await expect(page.getByTestId("nutrition-diary-modal")).toBeVisible();
  await page.getByTestId("nutrition-diary-close").click();
  await expect(page.getByTestId("nutrition-diary-modal")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickClientNav(page, "client-nav-cabinet");
  await expect(page.getByTestId("client-harness-cabinet")).toBeVisible();
  await expect(page.getByTestId("profile-cabinet-title")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("primary client tabs keep one adaptive shell geometry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser covers the responsive viewport matrix.");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 768, height: 1024, shellWidth: 402, shellHeight: 874 },
    { width: 1440, height: 900, shellWidth: 402, shellHeight: 874 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/?clientHarness=1");

    const shellRects = [];
    const tabs = [
      { nav: null, page: "client-harness-main" },
      { nav: "client-nav-workouts", page: "client-harness-workouts" },
      { nav: "client-nav-nutrition", page: "client-harness-nutrition" },
      { nav: "client-nav-cabinet", page: "client-harness-cabinet" }
    ];

    for (const tab of tabs) {
      if (tab.nav) await clickClientNav(page, tab.nav);
      await expect(page.getByTestId(tab.page)).toBeVisible();

      const shell = page.locator('[data-client-adaptive-shell="true"]');
      await expect(shell).toHaveCount(1);
      const shellRect = await shell.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      });
      shellRects.push(shellRect);

      const dockRect = await page.getByTestId("client-bottom-nav").evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom)
        };
      });
      expect(dockRect.top).toBeGreaterThanOrEqual(shellRect.y);
      expect(dockRect.bottom).toBeLessThanOrEqual(shellRect.y + shellRect.height);
    }

    const [baseline, ...otherShells] = shellRects;
    expect(baseline.width).toBe(viewport.shellWidth);
    expect(baseline.height).toBe(viewport.shellHeight);
    for (const shellRect of otherShells) {
      expect(shellRect).toEqual(baseline);
    }
    await expectNoHorizontalOverflow(page);
  }

  assertNoRuntimeErrors();
});
