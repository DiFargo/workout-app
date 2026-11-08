import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("calendar edits only the three remaining workouts without duplicate completed badges", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/?clientHarness=1&clientHarnessPage=workoutSheets&sheet=calendar&calendarRegression=1");
  const calendar = page.getByTestId("profile-workout-calendar");
  await calendar.getByRole("button", { name: "Изменить расписание" }).click();
  await expect(calendar).toContainText("Осталось назначить: 3 даты. Выполнено занятий: 5");
  const completed = calendar.locator('[data-date="2026-11-04"]');
  await expect(completed).toBeDisabled();
  await expect(completed).toContainText("№5");
  await expect(calendar.locator('[data-date="2026-11-16"]')).not.toContainText("№5");
  for (const date of ["2026-11-21", "2026-11-25", "2026-11-11", "2026-11-14"]) {
    await calendar.locator(`[data-date="${date}"]`).click();
  }
  await expect(calendar.locator('[data-date="2026-11-11"]')).toContainText("№6");
  await page.screenshot({ path: testInfo.outputPath("remaining-calendar-320.png") });
  expect(await calendar.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await calendar.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(calendar).toContainText("Расписание сохранено");
  await expect(page.getByTestId("workout-sheets-result")).toHaveText('["2026-11-11","2026-11-14","2026-11-18"]');
  await page.reload();
  for (const [date, number] of [["2026-11-11", 6], ["2026-11-14", 7], ["2026-11-18", 8]]) {
    await expect(calendar.locator(`[data-date="${date}"]`)).toContainText(`№${number}`);
  }
  await expect(calendar.locator('[data-date="2026-11-21"]')).not.toContainText("№7");
  await expect(calendar.locator('[data-date="2026-11-25"]')).not.toContainText("№8");
  await calendar.getByRole("button", { name: "Изменить расписание" }).click();
  await expect(calendar.locator('[data-date="2026-11-11"]')).toContainText("№6");
  assertNoErrors();
});
