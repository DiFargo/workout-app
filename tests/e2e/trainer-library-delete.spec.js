import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function openLibrary(page, query = "") {
  await page.route("**/e2e-media/*.mp4", route => route.fulfill({ status: 200, contentType: "video/mp4", body: "" }));
  await page.goto(`/v2?trainerHarness=1&libraryAudit=1${query}`);
  await page.locator('[data-testid="trainer-nav-workouts"]:visible,[data-testid="trainer-desktop-nav-workouts"]:visible').click();
  await page.locator(".trainerNextPageTabs button").nth(1).click();
  return page.locator(".trainerNextLibrary");
}

test("trainer can cancel, delete and restore one video variant without losing the other", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  const library = await openLibrary(page);
  const name = "Отведение рук с гантелями";
  const card = library.getByRole("button", { name: `Редактировать упражнение ${name}`, exact: true });
  const other = library.getByRole("button", { name: "Редактировать упражнение Разведения гантелей в стороны", exact: true });
  await expect(library.locator("article")).toHaveCount(12);
  await card.click();
  const editor = page.getByRole("dialog", { name: "Редактирование упражнения", exact: true });
  await expect(editor.locator("video")).toHaveAttribute("src", "/e2e-media/side-a.mp4");
  await editor.getByRole("button", { name: "Удалить", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Удалить упражнение", exact: true });
  await expect(confirmation).toContainText("истории клиентов сохранятся");
  await confirmation.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Удалить", exact: true }).click();
  await confirmation.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(card).toHaveCount(0);
  await expect(other).toBeVisible();
  await expect(library.locator("article")).toHaveCount(11);
  await library.getByRole("button", { name: "Удалённые · 1", exact: true }).click();
  await expect(library.locator("article")).toHaveCount(1);
  await card.click();
  await expect(editor.locator("video")).toHaveAttribute("src", "/e2e-media/side-a.mp4");
  await expect(editor.getByRole("button", { name: "Удалить", exact: true })).toHaveCount(0);
  await editor.getByRole("button", { name: "Восстановить", exact: true }).click();
  await expect(editor).toBeHidden();
  await library.getByRole("button", { name: "К библиотеке", exact: true }).click();
  await expect(library.locator("article")).toHaveCount(12);
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  assertNoErrors();
});

test("failed deletion leaves the exercise and exposes a retryable error in the editor", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  const library = await openLibrary(page, "&libraryDeleteFail=1");
  await library.getByRole("button", { name: "Редактировать упражнение Авторское упражнение", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Редактирование упражнения", exact: true });
  await editor.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.getByRole("dialog", { name: "Удалить упражнение", exact: true }).getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("Не удалось");
  await expect(editor.getByRole("button", { name: "Удалить", exact: true })).toBeEnabled();
  await editor.getByRole("button", { name: "Закрыть редактор упражнения", exact: true }).click();
  await expect(library.locator("article")).toHaveCount(12);
  assertNoErrors();
});
