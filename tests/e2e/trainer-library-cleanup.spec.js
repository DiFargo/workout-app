import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("library keeps filmed variants, groups known movements and saves a manual group", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.route("**/e2e-media/*.mp4", (route) => route.fulfill({ status: 200, contentType: "video/mp4", body: "" }));
  await page.goto("/v2?trainerHarness=1&libraryAudit=1");
  await page.locator('[data-testid="trainer-nav-workouts"]:visible,[data-testid="trainer-desktop-nav-workouts"]:visible').click();
  await page.locator(".trainerNextPageTabs button").nth(1).click();
  const library = page.locator(".trainerNextLibrary");
  await expect(library.locator("article")).toHaveCount(12);
  await expect(library.getByRole("button", { name: "Редактировать упражнение Жим гантелей лёжа", exact: true })).toContainText(/с видео/i);
  await expect(library.getByRole("button", { name: "Редактировать упражнение Жим лёжа с гантелями", exact: true })).toHaveCount(0);
  await library.getByPlaceholder("Найти упражнение...").fill("Жим лёжа с гантелями");
  await expect(library.locator("article")).toHaveCount(1);
  await library.getByPlaceholder("Найти упражнение...").fill("");
  const group = library.getByLabel("Группа мышц", { exact: true });
  await group.selectOption("shoulders");
  await expect(library.locator("article")).toHaveCount(3);
  for (const [name, src] of [["Отведение рук с гантелями", "/e2e-media/side-a.mp4"], ["Разведения гантелей в стороны", "/e2e-media/side-b.mp4"]]) {
    await library.getByRole("button", { name: `Редактировать упражнение ${name}`, exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Редактирование упражнения", exact: true });
    await expect(editor.locator("video")).toHaveAttribute("src", src);
    await editor.getByRole("button", { name: "Закрыть редактор упражнения" }).click();
  }
  await group.selectOption("other");
  await expect(library.locator("article")).toHaveCount(1);
  await library.getByRole("button", { name: "Редактировать упражнение Авторское упражнение" }).click();
  let editor = page.getByRole("dialog", { name: "Редактирование упражнения", exact: true });
  await editor.getByLabel("Группа мышц", { exact: true }).selectOption("back");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(library.locator("article")).toHaveCount(0);
  await expect(group.locator('option[value="other"]')).toHaveText("Без группы · 0");
  await group.selectOption("back");
  await expect(library.locator("article")).toHaveCount(2);
  await library.getByRole("button", { name: "Редактировать упражнение Авторское упражнение" }).click();
  editor = page.getByRole("dialog", { name: "Редактирование упражнения", exact: true });
  await expect(editor.getByLabel("Группа мышц", { exact: true })).toHaveValue("back");
  expect(await editor.getByLabel("Группа мышц", { exact: true }).evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await editor.screenshot({ path: `artifacts/library-cleanup-${info.project.name}.png` });
  assertNoErrors();
});
