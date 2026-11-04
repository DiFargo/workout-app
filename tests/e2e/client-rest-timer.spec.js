import { expect, test } from "./app-test.js";

test("expanded rest advances an unfinished set, the next exercise and finish without completing pending sets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage");
  await expect(page.getByTestId("client-harness-workout-run-stage")).toBeVisible({ timeout: 40_000 });

  const setRows = page.getByTestId("workout-exercise-set-row");
  await expect(setRows).toHaveCount(1);

  const primary = page.getByTestId("workout-primary-action");
  await expect(primary).toHaveAccessibleName("Завершить подход");
  await primary.click();
  const timer = page.getByTestId("workout-rest-timer-expanded");
  await expect(timer).toBeVisible();
  const next = page.getByTestId("workout-rest-timer-completion-action");
  await expect(next).toHaveAccessibleName(/^Перейти к подходу \d+ из \d+$/);
  await expect(next).toHaveAccessibleDescription("Пропустить остаток отдыха");
  await expect(next).toContainText("Пропустить остаток отдыха");
  await expect(next).toHaveAttribute("data-emphasis", "primary");
  await expect(timer.getByLabel("Остановить таймер отдыха")).toHaveAttribute("data-emphasis", "secondary");
  await timer.getByLabel("Остановить таймер отдыха").click();
  await expect(timer.getByLabel("Продолжить таймер отдыха")).toBeVisible();
  await page.screenshot({ path: "output/playwright/rest-next-action-860/next-set-paused.png" });
  await page.waitForTimeout(420);
  await next.click();
  await expect(timer).toBeHidden();
  await expect(page.getByRole("button", { name: "Все подходы, выбран подход 3 из 3", exact: true })).toHaveAccessibleDescription("Выполнено 2 из 3");
  await expect(primary).toHaveAccessibleName("Завершить подход");
  await expect(page.getByTestId("workout-rest-timer-start")).toHaveAttribute("aria-label", "Запустить таймер отдыха");
  await page.waitForTimeout(420);
  await primary.click();
  // The modal correctly hides background controls from the accessibility tree.
  await expect(primary).toHaveAttribute("data-action", "next-exercise");
  await expect(timer).toBeVisible();
  await expect(next).toHaveAccessibleName("К следующему упражнению");
  await expect(next).toHaveAccessibleDescription("Пропустить остаток отдыха");
  await page.screenshot({ path: "output/playwright/rest-next-action-860/next-exercise.png" });
  await page.waitForTimeout(420);
  await next.click();
  await expect(page.getByText("Тяга верхнего блока").first()).toBeVisible();
  await expect(timer).toBeHidden();
  await expect(page.getByTestId("workout-rest-timer-start")).toHaveAttribute(
    "aria-label",
    "Запустить таймер отдыха"
  );
  await expect(page.getByRole("button", { name: "Все подходы, выбран подход 1 из 2", exact: true })).toHaveAccessibleDescription("Выполнено 0 из 2");
  for (const index of [1, 2]) {
    await page.waitForTimeout(420);
    await primary.click();
    await expect(timer).toBeVisible();
    await expect(next).toHaveAccessibleName(index === 1 ? /^Перейти к подходу \d+ из \d+$/ : "Завершить тренировку");
    await expect(next).toHaveAccessibleDescription("Пропустить остаток отдыха");
    if (index === 2) await page.screenshot({ path: "output/playwright/rest-next-action-860/finish-action.png" });
    await page.waitForTimeout(420);
    await next.click();
    await expect(timer).toBeHidden();
    if (index === 1) {
      await expect(primary).toHaveAccessibleName("Завершить подход");
      await expect(page.getByRole("button", { name: "Все подходы, выбран подход 2 из 2", exact: true })).toHaveAccessibleDescription("Выполнено 1 из 2");
    }
  }
  await expect(page.getByTestId("workout-finish-screen")).toBeVisible();
});

test("manual rest before completion only collapses and the top icon keeps the countdown running", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage");
  await expect(page.getByTestId("client-harness-workout-run-stage")).toBeVisible({ timeout: 40_000 });
  const timer = page.getByTestId("workout-rest-timer-expanded");
  const primary = page.getByTestId("workout-primary-action");
  const dock = page.getByTestId("workout-rest-timer");
  for (const topIcon of [false, true]) {
    await page.getByRole("button", { name: "Открыть таймер отдыха", exact: true }).click();
    await expect(timer).toBeVisible();
    await expect(page.getByTestId("workout-rest-timer-completion-action")).toHaveCount(0);
    await expect(timer.getByRole("button", { name: "Свернуть таймер", exact: true })).toBeVisible();
    const before = await dock.locator("b").textContent();
    if (topIcon) {
      await page.screenshot({ path: "output/playwright/rest-next-action-860/manual-rest-safe.png" });
      await page.getByTestId("workout-rest-timer-minimize").click();
    } else {
      await timer.getByRole("button", { name: "Свернуть таймер", exact: true }).click();
    }
    await expect(timer).toBeHidden();
    await expect(dock.getByRole("button", { name: "Открыть таймер отдыха", exact: true })).toBeVisible();
    await expect(page.getByTestId("workout-rest-timer-start")).toHaveCount(0);
    await expect.poll(() => dock.locator("b").textContent()).not.toBe(before);
    await expect(primary).toHaveAccessibleName("Завершить подход");
    await expect(page.getByRole("button", { name: "Все подходы, выбран подход 2 из 3", exact: true })).toHaveAccessibleDescription("Выполнено 1 из 3");
  }
});

// This file owns its viewport matrix; avoid repeating it in the second project.
test.beforeEach(() => { test.skip(test.info().project.name !== "mobile-chromium", "Viewport matrix runs once"); });
