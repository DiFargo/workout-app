import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("countdown continues after extending, pausing and returning from the background", async ({ page }) => {
  test.setTimeout(60_000);
  const checkErrors = failOnRuntimeErrors(page);
  await page.clock.install();
  await page.goto("/?clientHarness=1&clientHarnessPage=workoutRunStage");
  await expect(page.getByTestId("workout-primary-action")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("workout-primary-action").click();
  const timer = page.getByTestId("workout-rest-timer-expanded");
  await expect(timer).toBeVisible();
  const value = timer.locator("strong").first();
  await expect(value).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  const seconds = async () => { const [m, s] = (await value.textContent()).split(":").map(Number); return m * 60 + s; };
  const before = await seconds();
  await timer.getByLabel("Добавить 15 секунд").click();
  expect(await seconds()).toBe(before + 15);
  await page.clock.runFor(3000);
  expect(await seconds()).toBeGreaterThanOrEqual(before + 11);
  expect(await seconds()).toBeLessThanOrEqual(before + 13);
  await timer.getByLabel("Остановить таймер отдыха").click();
  const paused = await seconds();
  await page.clock.runFor(5000);
  expect(await seconds()).toBe(paused);
  await timer.getByLabel("Продолжить таймер отдыха").click();
  await page.clock.fastForward(20000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(await seconds()).toBeGreaterThanOrEqual(paused - 21);
  expect(await seconds()).toBeLessThanOrEqual(paused - 19);
  checkErrors();
});

test("history controls and meal descriptions fit their actual columns", async ({ page }, testInfo) => {
  const checkErrors = failOnRuntimeErrors(page);
  for (const width of [320, 393, 1366]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/?clientHarness=1&clientHarnessPage=workoutHistory");
    const refresh = page.getByTestId("workout-history-refresh");
    await expect(refresh).toBeVisible();
    const box = await refresh.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`history-${width}.png`) });
    await page.goto("/?clientHarness=1&clientHarnessPage=nutritionMealModal");
    const info = page.locator('[data-nutrition-meal-part="info"]').first();
    await expect(info).toBeVisible();
    expect((await info.boundingBox()).width).toBeGreaterThan(120);
    await page.screenshot({ path: testInfo.outputPath(`meal-${width}.png`) });
  }
  checkErrors();
});

test("profile review can edit one labelled value and return directly", async ({ page }, testInfo) => {
  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=9");
  await page.getByRole("button", { name: "Изменить: Вес", exact: true }).click();
  const weight = page.getByRole("textbox", { name: "Текущий вес, кг", exact: true });
  await weight.fill("88,5");
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(page.getByRole("button", { name: "Изменить: Вес", exact: true })).toContainText("88,5 кг");
  await page.screenshot({ path: testInfo.outputPath("review.png") });
  expect(await page.locator('meta[name="viewport"]').getAttribute("content")).not.toMatch(/user-scalable=no|maximum-scale=1/);
});

test("resume is focused and readiness actions stay attached to the sheet", async ({ page }, testInfo) => {
  await page.goto("/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=draft");
  const resume = page.getByRole("button", { name: "Продолжить тренировку", exact: true });
  await expect(resume).toBeVisible({ timeout: 20000 });
  await expect(resume).toBeFocused();
  for (const width of [320, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    await page.goto("/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=readiness");
    const dialog = page.getByTestId("workout-readiness-dialog");
    const option = dialog.getByRole("button", { name: /Немного снизить нагрузку/ });
    await expect(option).toBeVisible();
    await option.click();
    const action = dialog.getByRole("button", { name: "Продолжить", exact: true });
    const a = await action.boundingBox(), b = await option.boundingBox();
    expect(a.y + a.height).toBeLessThanOrEqual(768);
    expect(a.y - b.y - b.height).toBeLessThan(160);
    await page.screenshot({ path: testInfo.outputPath(`readiness-${width}.png`) });
  }
});

test("failed startup offers an explicit retry without a reload loop", async ({ page }) => {
  await page.route(/\/src\/App\.jsx(?:\?|$)/, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Повторить загрузку" })).toBeVisible();
  await page.unrouteAll();
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.locator("#startup")).toHaveCount(0);
});

test.beforeEach(() => { test.skip(test.info().project.name !== "mobile-chromium", "Viewport matrix runs once"); });
