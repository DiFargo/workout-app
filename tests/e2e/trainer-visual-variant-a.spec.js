import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function openClient(page, extra = "") {
  await page.goto(`/v2?trainerHarness=1${extra}`);
  await page.getByTestId("trainer-nav-clients").click();
  await page.locator(".trainerNextClientTable > button").first().click();
  await expect(page.locator(".trainerNextClientPage")).toBeVisible();
}

async function tab(page, name) {
  const control = page.locator(".trainerNextClientTabs").getByRole("button", { name, exact: true });
  await control.click();
  await expect(control).toHaveAttribute("aria-pressed", "true");
}

async function openExerciseSettings(page, editor) {
  await editor.getByRole("button", { name: /^Действия:/ }).first().click();
  const actions = page.getByRole("dialog", { name: "Действия с упражнением", exact: true });
  await expect(actions).toBeVisible();
  await actions.getByRole("button", { name: "По подходам и параметры", exact: true }).click();
  await expect(actions).toBeHidden();
}

test("invite header gives its complete title and explanation room beside close", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  await page.goto("/v2?trainerHarness=1");
  await page.getByTestId("trainer-nav-clients").click();
  await page.getByRole("button", { name: "Добавить клиента", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Пригласить клиента", exact: true });
  await expect(dialog).toBeVisible();
  const layout = await dialog.evaluate(node => {
    const title = node.querySelector("h2"), copy = node.querySelector(".trainerInviteHeaderCopy"), close = node.querySelector(".trainerNextModalClose");
    const t = title.getBoundingClientRect(), p = copy.getBoundingClientRect(), c = close.getBoundingClientRect(), d = node.getBoundingClientRect();
    return { titleWidth: t.width, titleHeight: t.height, line: parseFloat(getComputedStyle(title).lineHeight), copyRight: p.right, closeLeft: c.left, dialogRight: d.right, document: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  expect(layout.titleWidth).toBeGreaterThan(180);
  expect(layout.titleHeight).toBeLessThanOrEqual(layout.line * 2 + 1);
  expect(layout.copyRight).toBeLessThanOrEqual(layout.closeLeft + 1);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  await expect(dialog.getByLabel("Ник в Telegram")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Создать приглашение", exact: true })).toBeEnabled();
  noErrors();
});

test("exercise history stays within one modal and Back preserves progress list", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  await openClient(page);
  await page.getByRole("button", { name: /^Прогресс упражнений Нагрузка, история и решения тренера$/ }).click();
  const sheet = page.getByRole("dialog", { name: "Прогресс упражнений", exact: true });
  await sheet.getByRole("button", { name: "Открыть историю", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const history = sheet.locator(".trainerExerciseProgressHistoryInline");
  await expect(history.locator("#trainer-exercise-history-title")).toBeVisible();
  await expect(history.locator(".trainerExerciseProgressHistorySessions article")).not.toHaveCount(0);
  const [heading, header] = await Promise.all([history.locator("h2").boundingBox(), sheet.locator("[data-trainer-modal-header]").boundingBox()]);
  expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height);
  await sheet.getByRole("button", { name: "К прогрессу упражнений", exact: true }).click();
  await expect(sheet.locator(".trainerClientExerciseProgress")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  noErrors();
});

test("exercise settings keep Delete reachable and the return action fixed on 320x720 with many sets", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await openClient(page);
  await tab(page, "Тренировки");
  await page.locator(".trainerClientProgramEditButton").click();
  const editor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await editor.getByRole("combobox", { name: "День программы", exact: true }).selectOption({ index: 2 });
  await openExerciseSettings(page, editor);
  const sheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  const rows = sheet.getByRole("textbox", { name: /^Повторы, подход \d+$/ });
  const addSet = sheet.getByRole("button", { name: "Добавить подход", exact: true });
  const deleteExercise = sheet.getByRole("button", { name: "Удалить из тренировки", exact: true });
  const returnToProgram = sheet.getByRole("button", { name: "К программе", exact: true });
  const body = sheet.locator(":scope > div");
  while (await rows.count() < 3) await addSet.click();
  await expect(rows).toHaveCount(3);
  const threeSetScrollHeight = await body.evaluate(node => node.scrollHeight);
  // The current grouped sheet scrolls its body; the return action is not part
  // of that scroll area, and destructive actions must remain reachable.
  await deleteExercise.scrollIntoViewIfNeeded();
  await expect(deleteExercise).toBeInViewport();
  await expect(returnToProgram).toBeInViewport();
  for (const action of [addSet, deleteExercise, returnToProgram]) {
    expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  while (await rows.count() < 10) await addSet.click();
  await expect(rows).toHaveCount(10);
  const expanded = await body.evaluate(node => ({ height: node.clientHeight, scroll: node.scrollHeight }));
  expect(expanded.scroll).toBeGreaterThan(expanded.height);
  expect(expanded.scroll).toBeGreaterThan(threeSetScrollHeight);
  await deleteExercise.scrollIntoViewIfNeeded();
  await expect(deleteExercise).toBeInViewport();
  await expect(returnToProgram).toBeInViewport();
  expect(await sheet.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await sheet.getByRole("button", { name: "Удалить подход 10", exact: true }).click();
  await expect(rows).toHaveCount(9);
  await returnToProgram.click();
  await expect(sheet).toBeHidden();
  await expect(editor).toBeVisible();
  await openExerciseSettings(page, editor);
  await expect(rows).toHaveCount(9);
  noErrors();
});

test("nutrition opens analytics without editing and Create remains explicit", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  await openClient(page);
  await tab(page, "Питание");
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("План ещё не назначен", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Создать план питания", exact: true }).click();
  const editor = page.locator("[data-trainer-modal-surface]").filter({ has: page.locator("#trainer-nutrition-plan-modal-title") });
  await expect(editor).toBeVisible();
  await editor.locator(".trainerNextModalClose").click();
  await expect(editor).toBeHidden();
  await expect(page.getByText("План ещё не назначен", { exact: true })).toBeVisible();
  noErrors();
});

test("notification autosave feedback and real retry stay visible while scrolling", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  await openClient(page, "&notificationSaveFailure=1");
  await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
  const clientActions = page.getByRole("dialog", { name: "Управление клиентом", exact: true });
  await expect(clientActions).toBeVisible();
  await clientActions.getByRole("button", { name: /^Напоминания/ }).click();
  const sheet = page.getByRole("dialog", { name: "Уведомления", exact: true });
  const status = sheet.getByTestId("trainer-notification-save-status");
  await expect(status).toBeInViewport();
  await expect(status).toContainText("сохраняются автоматически");
  await sheet.locator(".trainerNotificationSwitch").first().click();
  await expect(status).toHaveAttribute("data-save-state", "pending");
  await expect(status).toHaveAttribute("data-save-state", "error");
  await sheet.locator("[data-trainer-modal-content]").evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(status).toBeInViewport();
  await status.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(status).toHaveAttribute("data-save-state", "saved");
  await expect(page.locator("html")).toHaveAttribute("data-notification-save-attempts", "2");
  noErrors();
});

test("library keeps complete long exercise names and all mobile filters stay selectable", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  await page.goto("/v2?trainerHarness=1&libraryAudit=1");
  await page.getByTestId("trainer-nav-library").click();
  const longName = page.locator(".trainerNextLibrary article strong").filter({ hasText: /рук с гантелями на наклонной скамье/ }).first();
  await expect(longName).toBeVisible();
  const text = await longName.evaluate(node => ({ whiteSpace: getComputedStyle(node).whiteSpace, width: node.clientWidth, scroll: node.scrollWidth }));
  expect(text.whiteSpace).toBe("normal");
  expect(text.scroll).toBeLessThanOrEqual(text.width + 1);
  await page.getByTestId("trainer-nav-clients").click();
  const filters = page.locator(".trainerClientFilters");
  await expect(filters.locator(":scope > button:visible")).toHaveCount(2);
  for (const name of ["Без программы", "Без тренировок 14+ дней", "Архив", "Тестовые"]) {
    await filters.locator("summary").click();
    await filters.getByRole("button", { name, exact: true }).filter({ visible: true }).click();
    await expect(filters.locator("summary")).toContainText(name);
    await expect(filters.locator("details")).not.toHaveAttribute("open");
    if (name === "Архив") await expect(page.locator(".trainerNextClientTable > button")).toHaveCount(0);
  }
  await filters.getByRole("button", { name: "Все", exact: true }).click();
  await expect(page.locator(".trainerNextClientTable > button")).toHaveCount(1);
  noErrors();
});

test("desktop retains six directly reachable client filters including a separate archive", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/v2?trainerHarness=1");
  await page.getByTestId("trainer-desktop-nav-clients").click();
  const filters = page.locator(".trainerClientFilters > button:visible");
  await expect(filters).toHaveCount(6);
  await expect(filters).toHaveText(["Все", "Внимание", "Без программы", "Без тренировок 14+ дней", "Архив", "Тестовые"]);
  const archive = filters.filter({ hasText: /^Архив$/ });
  await archive.click();
  await expect(archive).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".trainerNextClientTable > button")).toHaveCount(0);
  await filters.filter({ hasText: /^Все$/ }).click();
  await expect(page.locator(".trainerNextClientTable > button")).toHaveCount(1);
  await expect(page.locator(".trainerClientFilterDisclosure")).toBeHidden();
});
