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

async function expectWorkoutCardSpacing(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            y: Math.round(rect.y),
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height)
          }
        : null;
    };

    const deck = document.querySelector(".individualWorkoutDeck");

    return {
      card: rectOf(document.querySelector(".individualWorkoutCardPro")),
      progress: rectOf(document.querySelector(".individualWorkoutBottomProgress")),
      startButton: rectOf(document.querySelector(".individualWorkoutCardStartButton")),
      bottomNav: rectOf(document.querySelector(".clientBottomNav")),
      deckOverflow: deck ? getComputedStyle(deck).overflow : ""
    };
  });

  expect(metrics.deckOverflow).toBe("visible");
  expect(metrics.card).not.toBeNull();
  expect(metrics.progress).not.toBeNull();
  expect(metrics.startButton).not.toBeNull();
  expect(metrics.bottomNav).not.toBeNull();
  expect(metrics.startButton.bottom).toBeLessThanOrEqual(metrics.card.bottom);
  expect(metrics.card.bottom).toBeLessThan(metrics.progress.y);
  expect(metrics.progress.bottom).toBeLessThanOrEqual(metrics.bottomNav.y);
}

test("client workout visual audit covers plan cards and workout modals", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1");
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.locator(".clientCorePageWorkout")).toBeVisible();
  await expect(page.locator(".individualWorkoutCardPro")).toBeVisible();
  await expectTapTargets(page, [
    ".workoutModeHeaderButton",
    ".workoutHistoryHeaderButton",
    ".individualWorkoutCardStartButton",
    ".individualWorkoutNav button",
    ".clientBottomNav button"
  ]);
  await expectWorkoutCardSpacing(page);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-plan.png");

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
  await expectWorkoutCardSpacing(page);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-next-card.png");

  await page.locator(".workoutModeHeaderButton").click();
  await expect(page.locator(".workoutModeModal")).toBeVisible();
  await expectTapTargets(page, [
    ".workoutModeModalHeader button",
    ".workoutModeOption",
    ".workoutModeModal .workoutModeButton"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-mode-modal.png");
  await page.locator(".workoutModeModalHeader button").click();
  await expect(page.locator(".workoutModeModal")).toBeHidden();

  await page.locator(".workoutHistoryHeaderButton").click();
  await expect(page.locator(".workoutHistoryModal")).toBeVisible();
  await expectTapTargets(page, [
    ".workoutModeModalHeader button",
    ".workoutHistoryModal button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-history-modal.png");

  assertNoRuntimeErrors();
});
