import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function openEditor(page) {
  await page.getByRole("button", { name: "Редактировать", exact: true }).first().click();
  return page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
}
async function client(page, query = "") {
  await page.goto(`/v2?trainerHarness=1&draftAudit=1${query}`);
  await page.locator('[data-testid="trainer-nav-clients"]:visible,[data-testid="trainer-desktop-nav-clients"]:visible').click();
  await page.locator(".trainerNextClientTable > button").first().click();
  await page.locator(".trainerNextClientTabs:visible,.trainerNextClientMobileNav:visible").getByRole("button", { name: "Тренировки", exact: true }).click();
}

test("new assignment editor uses its own dates and preserves 3 x 110 prescription", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Editor date and prescription regression");
  const errors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
  await client(page, "&assignmentScheduleAudit=1");
  const editor = await openEditor(page);
  const days = editor.locator(".trainerNextWorkoutDayItem");
  await expect(days).toHaveCount(8);
  await expect(days.filter({ hasText: "Пропущена" })).toHaveCount(0);
  await expect(days.filter({ hasText: "Запланирована" })).toHaveCount(8);
  await expect(editor.getByLabel("Статус тренировки", { exact: true })).toHaveValue("planned");
  await expect(editor.getByLabel(/^Подходы:/)).toHaveValue("3");
  await expect(editor.getByLabel(/^Вес:/)).toHaveValue("110");
  await editor.screenshot({ path: "test-artifacts/assignment-calendar-761.png" });
  errors();
});

for (const width of [320, 393, 760, 1081, 1280, 1600]) test(`client draft fits, cancels and saves at ${width}px`, async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Explicit viewport matrix");
  await page.setViewportSize({ width, height: 960 });
  const errors = failOnRuntimeErrors(page);
  await client(page);
  let editor = await openEditor(page);
  await editor.getByRole("button", { name: "Закрыть редактор", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  editor = await openEditor(page);
  const reps = editor.getByLabel(/^Повторы:/).first();
  const original = await reps.inputValue();
  await reps.fill("15");
  await expect(page.locator("html")).not.toHaveAttribute("data-draft-save-attempts");
  const overlapping = await editor.locator('[class*="clientExerciseRow"]').evaluateAll((rows) => rows.some((row) => {
    const inputs = [...row.querySelectorAll("input")].map((node) => node.getBoundingClientRect());
    const buttons = [...row.querySelectorAll("button")].map((node) => node.getBoundingClientRect()).filter((rect) => rect.width);
    return inputs.some((a) => buttons.some((b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
  }));
  expect(overlapping).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await editor.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Выйти без сохранения", exact: true }).click();
  editor = await openEditor(page);
  await expect(editor.getByLabel(/^Повторы:/).first()).toHaveValue(original);
  await editor.getByLabel(/^Повторы:/).first().fill("16");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-draft-save-attempts", "1");
  editor = await openEditor(page);
  await expect(editor.getByLabel(/^Повторы:/).first()).toHaveValue("16");
  await editor.screenshot({ path: `artifacts/audit-editor-${width}.png` });
  errors();
});

test("failed save retains editor and draft; retry persists and clean close is silent", async ({ page }) => {
  await client(page, "&saveFailure=1");
  const editor = await openEditor(page);
  await editor.getByLabel(/^Повторы:/).first().fill("19");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toContainText("Правки остаются в редакторе");
  await expect(editor.getByLabel(/^Повторы:/).first()).toHaveValue("19");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-draft-save-attempts", "2");
});


test("mixed sets, restored sets, large text and completed days preserve intent", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 });
  await client(page, "&mixedSets=1");
  const editor = await openEditor(page);
  await editor.getByRole("button", { name: /^Вес: разные/ }).click();
  const sheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  await expect(sheet.getByLabel("Вес, подход 2", { exact: true })).toHaveValue("25");
  await expect(sheet.getByLabel("Повторы, подход 3", { exact: true })).toHaveValue("8");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden(); await expect(editor).toBeVisible();
  await editor.getByLabel(/^Подходы:/).fill("1");
  await editor.getByRole("button", { name: "Вернуть удалённые подходы" }).click();
  await expect(editor.getByLabel(/^Подходы:/)).toHaveValue("3");
  await editor.getByRole("button", { name: /^Вес: разные/ }).click();
  await expect(sheet.getByLabel("Вес, подход 3", { exact: true })).toHaveValue("30");
  await page.keyboard.press("Escape");
  await page.addStyleTag({ content: '[class*=clientExerciseRow] label > span {font-size:18px!important} [class*=clientExerciseRow] .trainerNextExerciseName strong {font-size:22px!important}' });
  const controls = await editor.locator('[class*=clientExerciseRow] input,[class*=clientExerciseRow] button').evaluateAll(elements => elements.map(el => ({ rect: el.getBoundingClientRect().toJSON(), visible: el.checkVisibility() }))).then(items => items.filter(item => item.visible).map(item => item.rect));
  await editor.screenshot({ path: "artifacts/audit-editor-320-large-text.png" });
  expect(controls.every(rect => rect.height >= 44 && rect.left >= 0 && rect.right <= 320), JSON.stringify(controls)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await editor.screenshot({ path: "artifacts/audit-editor-320-large-text.png" });
  await editor.getByLabel("День программы", { exact: true }).selectOption("e2e_day_1");
  await expect(editor.getByLabel(/^Повторы:/).first()).toBeDisabled();
  await expect(editor.getByLabel("Статус тренировки", { exact: true })).toBeDisabled();
  await editor.getByRole("button", { name: "Закрыть редактор", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("program rename belongs to the same draft and cancel restores the name", async ({ page }) => {
  await client(page);
  let editor = await openEditor(page);
  await editor.getByRole("button", { name: "Переименовать", exact: true }).click();
  await editor.getByLabel("Название программы клиента", { exact: true }).fill("Локальное название");
  await editor.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(editor.getByRole("heading", { name: "Локальное название" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-draft-save-attempts");
  await editor.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Выйти без сохранения" }).click();
  editor = await openEditor(page); await expect(editor.getByRole("heading", { name: "tren+", exact: true })).toBeVisible();
});

test("partial summary names failed sources and offers a targeted retry", async ({ page }) => {
  await page.goto("/v2?trainerHarness=1&partialSummary=1");
  const status = page.getByRole("complementary", { name: "Состояние данных клиентов" });
  await status.locator("summary").click();
  await expect(status).toContainText("Тренировки: не удалось обновить");
  await expect(status).toContainText("Замеры: не удалось обновить");
  await status.getByRole("button", { name: "Повторить" }).click();
  await expect(status).toHaveCount(0);
});
