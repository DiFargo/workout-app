import { expect, test } from "./app-test.js";
import { BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS } from "../../src/data/basicWorkoutTrainerVideoAdditions.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("all 18 video variants are searchable as separate base library cards on iPhone", async ({ page }) => {
  test.setTimeout(90000);
  const noErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  // This is a read-only, isolated E2E catalogue; no Firebase credentials or writes.
  await page.route("https://firestore.googleapis.com/**", route => route.abort());
  await page.goto("/?adminHarness=1&adminSurface=base-library");
  const catalog = page.getByTestId("admin-base-library");
  await expect(catalog).toBeVisible({ timeout: 60000 });
  await expect(catalog.getByRole("heading", { level: 3 })).toHaveCount(131);
  const search = catalog.getByPlaceholder("Найти упражнение");
  for (const item of BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS) {
    await search.fill(item.name);
    await expect(catalog.getByRole("heading", { name: item.name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await search.fill("Выпады с гантелями — вариант тренера");
  await catalog.getByRole("button", { name: "Редактировать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Редактировать упражнение", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Редактировать упражнение", exact: true })).toHaveCount(0);
  noErrors();
});
