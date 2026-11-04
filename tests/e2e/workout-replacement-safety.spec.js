import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
  });
});

for (const mode of ["basic", "trainer"]) {
  test(`${mode}: completed results cannot be replaced, but unstarted exercises can`, async ({ page }, testInfo) => {
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.setViewportSize({ width: 402, height: 874 });
    await page.goto(`/?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientWorkoutRunMode=${mode}&clientHarnessTheme=warm-light`);
    const rows = page.getByTestId("workout-exercise-set-row");
    // The workout renders only the selected set; completion lives in the dock.
    await expect(rows).toHaveCount(1, { timeout: 40_000 });
    const primary = page.getByTestId("workout-primary-action");
    await expect(primary).toHaveAccessibleName("Подход выполнен");
    await primary.click();
    await page.getByTestId("workout-rest-timer-minimize").click();
    const snapshot = await rows.allTextContents();
    await page.getByRole("button", { name: "Другие действия с упражнением", exact: true }).click();
    await page.getByRole("menuitem", { name: "Заменить упражнение", exact: true }).click();
    const modal = page.getByTestId("basic-workout-exercise-swap-modal");
    await expect(modal).toContainText("У этого упражнения уже есть выполненные подходы");
    await expect(modal.getByTestId("basic-workout-exercise-alternative")).toHaveCount(0);
    for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 568 }, { width: 874, height: 402 }]) {
      await page.setViewportSize(viewport);
      const back = modal.getByRole("button", { name: "Вернуться к упражнению" });
      await expect(back).toBeVisible();
      const reachable = await back.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
          && element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      expect(reachable).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${mode}-locked-${viewport.width}.png`) });
    }
    await page.setViewportSize({ width: 402, height: 874 });
    await modal.getByRole("button", { name: "Вернуться к упражнению" }).click();
    await expect(modal).toBeHidden();
    expect(await rows.allTextContents()).toEqual(snapshot);
    await expect(rows.first().getByRole("button", { name: "Подход 2 выполнен, действия", exact: true })).toBeVisible();
    const picker = page.getByRole("button", { name: /^Все подходы, выбран подход/ });
    await picker.click();
    for (const index of [1, 2]) {
      await expect(page.getByRole("button", { name: `Перейти к подходу ${index}`, exact: true })
        .getByLabel("Выполнен", { exact: true })).toHaveCount(1);
    }
    await picker.click();

    // Return to an unstarted state using the normal ordered undo controls.
    await rows.first().getByRole("button", { name: "Подход 2 выполнен, действия", exact: true }).click();
    await rows.first().getByRole("button", { name: "Снять отметку выполнения подхода 2", exact: true }).click();
    await picker.click();
    await page.getByRole("button", { name: "Перейти к подходу 1", exact: true }).click();
    await rows.first().getByRole("button", { name: "Подход 1 выполнен, действия", exact: true }).click();
    await rows.first().getByRole("button", { name: "Снять отметку выполнения подхода 1", exact: true }).click();
    await page.getByRole("button", { name: "Другие действия с упражнением", exact: true }).click();
    await page.getByRole("menuitem", { name: "Заменить упражнение", exact: true }).click();
    const alternative = modal.getByTestId("basic-workout-exercise-alternative").first();
    const name = await alternative.locator("strong").textContent();
    await alternative.click();
    await expect(modal).toBeHidden();
    await expect(page.locator('[data-css-module-scope="workout-stage-heading"]').getByText(name, { exact: true })).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).not.toHaveClass(/completed/);
    await expect(primary).toHaveAccessibleName("Подход выполнен");
    await expect(picker).toHaveAccessibleName("Все подходы, выбран подход 1 из 3");
    await picker.click();
    await expect(page.getByRole("button", { name: /^Перейти к подходу/ })).toHaveCount(3);
    await expect(page.getByRole("button", { name: /^Перейти к подходу/ }).getByLabel("Выполнен", { exact: true })).toHaveCount(0);
    await assertNoErrors();
  });
}
