import { expect, test } from "@playwright/test";

test("rest timer promotes the next exercise after the final set", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage");

  const setRows = page.getByTestId("workout-exercise-set-row");
  await expect(setRows).toHaveCount(3);

  await setRows.nth(1).click();
  const timer = page.getByTestId("workout-rest-timer-expanded");
  await expect(timer).toBeVisible();
  const minimize = page.getByTestId("workout-rest-timer-minimize");
  await expect(minimize).toHaveAttribute("aria-label", "Свернуть таймер отдыха");
  await minimize.click();
  await expect(timer).toBeHidden();

  await setRows.nth(2).click();
  const nextExercise = page.getByTestId("workout-rest-timer-completion-action");
  await expect(nextExercise).toHaveText("К следующему упражнению");
  await expect(nextExercise).toHaveAttribute("data-emphasis", "primary");
  await expect(timer.getByLabel("Остановить таймер отдыха")).toHaveAttribute("data-emphasis", "secondary");

  await nextExercise.click();
  await expect(page.getByText("Тяга верхнего блока").first()).toBeVisible();
  await expect(timer).toBeHidden();
  await expect(page.getByTestId("workout-rest-timer-start")).toHaveAttribute(
    "aria-label",
    "Остановить таймер отдыха"
  );
});
