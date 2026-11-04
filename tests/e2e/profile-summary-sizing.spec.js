import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

test.beforeEach(() => {
  test.skip(test.info().project.name !== "mobile-chromium", "Own viewport matrix");
});

for (const viewport of [
  { width: 402, height: 874 },
  { width: 320, height: 720 },
  { width: 874, height: 402 }
]) {
  test(`summary task list stays readable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const assertNoErrors = failOnRuntimeErrors(page);

    for (const state of ["today", "recovery", "today-long", "recovery-long"]) {
      await page.goto(`/?clientHarness=1&clientHarnessTheme=warm-light&clientDashboardWorkoutState=${state}`);
      const card = page.getByTestId("profile-summary-task-card");
      const heading = page.getByTestId("profile-summary-task-title");
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(heading).toHaveText("Что важно сегодня?");

      const rows = card.locator("button[data-task-id]");
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
      const allRowsFit = await rows.evaluateAll((items) => items.every((item) => {
        const box = item.getBoundingClientRect();
        return box.height >= 54 && box.left >= 0 && box.right <= innerWidth;
      }));
      expect(allRowsFit).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      const workoutTask = card.locator('[data-task-id="workout"]');
      if (["today", "today-long"].includes(state)) {
        await expect(workoutTask).toBeVisible();
        expect((await workoutTask.boundingBox()).height).toBeGreaterThanOrEqual(56);
        if (viewport.width === 402 && state === "today") {
          await page.screenshot({ path: testInfo.outputPath("dynamic-tasks-home.png"), fullPage: true });
        }
        await workoutTask.click();
        await expect(page.getByTestId("workout-today-card")).toBeVisible();
      } else {
        await expect(workoutTask).toHaveCount(0);
      }
    }
    assertNoErrors();
  });
}

test("summary task card grows for enlarged text without clipping actions", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light&clientDashboardWorkoutState=today-long");
  await expect(page.locator('[data-testid^="client-harness-"]').first()).toBeAttached({ timeout: 40_000 });
  const card = page.getByTestId("profile-summary-task-card");
  const workoutTask = card.locator('[data-task-id="workout"]');
  await expect(card).toBeVisible();
  const originalHeight = (await card.boundingBox()).height;
  await card.evaluate((root) => {
    for (const target of root.querySelectorAll("h2, p, button, button strong, button small, .taskCount")) {
      const style = getComputedStyle(target);
      target.style.fontSize = `${Number.parseFloat(style.fontSize) * 1.6}px`;
      target.style.lineHeight = "1.4";
    }
  });
  const enlarged = await card.boundingBox();
  const action = await workoutTask.boundingBox();
  expect(enlarged.height).toBeGreaterThan(originalHeight);
  expect(action.y).toBeGreaterThan(enlarged.y);
  expect(action.y + action.height).toBeLessThanOrEqual(enlarged.y + enlarged.height - 8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await workoutTask.click();
  await expect(page.getByTestId("workout-today-card")).toBeVisible();
});

test("Telegram dashboard compacts the task card without shrinking tap targets", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light&clientDashboardWorkoutState=today");
  await expect(page.locator('[data-testid^="client-harness-"]').first()).toBeAttached({ timeout: 40_000 });
  const card = page.getByTestId("profile-summary-task-card");
  const browserHeight = (await card.boundingBox()).height;

  await page.locator("html").evaluate((html) => html.setAttribute("data-platform", "telegram"));
  await expect.poll(() => card.boundingBox().then((box) => box.height)).toBeLessThan(browserHeight);
  await expect(card).toHaveCSS("padding", "14px");
  const rowHeights = await card.locator("button[data-task-id]").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(rowHeights.length).toBeGreaterThan(0);
  expect(Math.min(...rowHeights)).toBeGreaterThanOrEqual(48);
});
