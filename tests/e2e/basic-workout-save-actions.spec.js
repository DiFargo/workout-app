import { test, expect } from "@playwright/test";

async function generateLocalWorkout(page, extraQuery = "") {
  await page.goto(`/?clientHarness=1&clientHarnessPage=basicWorkoutToday&clientWorkoutProgramMode=basic${extraQuery}`);
  await page.getByRole("region", { name: "Выбор зон тренировки" }).getByRole("button").first().click();
  await page.getByTestId("basic-workout-today-generate").click();
  await expect(page.getByTestId("basic-workout-save-start")).toBeVisible();
  await expect(page.getByTestId("basic-workout-save-later")).toBeVisible();
}

test("save and start opens readiness directly", async ({ page }, testInfo) => {
  await generateLocalWorkout(page);
  await page.getByTestId("basic-workout-save-start").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("basic-save-actions.png"), fullPage: true });
  await page.getByTestId("basic-workout-save-start").click();
  await expect(page.getByTestId("workout-readiness-dialog")).toBeVisible();
  await expect(page.getByTestId("workout-render-overview")).toHaveCount(0);
});

test("save for later returns to the workout list", async ({ page }) => {
  await generateLocalWorkout(page);
  await page.getByTestId("basic-workout-save-later").click();
  await expect(page.getByTestId("workout-render-overview")).toBeVisible();
  await expect(page.getByTestId("workout-readiness-dialog")).toHaveCount(0);
});

test("save errors preserve the generated workout and both retry actions", async ({ page }) => {
  await generateLocalWorkout(page, "&clientBasicSave=error");
  for (const action of ["basic-workout-save-start", "basic-workout-save-later"]) {
    await page.getByTestId(action).click();
    await expect(page.getByRole("alert")).toContainText("Не удалось сохранить тренировку");
    await expect(page.getByTestId("basic-workout-save-start")).toBeEnabled();
    await expect(page.getByTestId("basic-workout-save-later")).toBeEnabled();
    await expect(page.getByTestId("workout-readiness-dialog")).toHaveCount(0);
  }
});
