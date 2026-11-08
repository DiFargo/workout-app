import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(90_000);

async function openAgenda(page, extra = "") {
  await page.clock.install({ time: new Date("2026-06-01T12:00:00.000Z") });
  await page.goto(`/?trainerHarness=1&scheduleReady=1&programAssignments=1${extra}`);
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  const mobile = page.getByTestId("trainer-nav-clients");
  await (await mobile.isVisible() ? mobile : page.getByTestId("trainer-desktop-nav-clients")).click();
  await page.locator(".trainerNextClientTable > button").first().click();
  const desktopTab = page.locator(".trainerNextClientTabs").getByRole("button", { name: "Тренировки", exact: true });
  await (await desktopTab.isVisible() ? desktopTab : page.locator(".trainerNextClientMobileNav").getByRole("button", { name: "Тренировки", exact: true })).click();
  await page.getByText("Расписание и абонемент", { exact: true }).locator("..").getByRole("button", { name: "Редактировать", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Расписание и абонемент", exact: true });
  await expect(dialog.getByRole("tab", { name: "Расписание", exact: true })).toBeVisible();
  return dialog;
}

test("schedule sheet stays above client tabs while its content scrolls", async ({ page }, testInfo) => {
  const noErrors = failOnRuntimeErrors(page);
  const dialog = await openAgenda(page);
  const backdrop = page.locator('[data-trainer-modal-backdrop="true"]').filter({ has: dialog });
  await expect.poll(async () => backdrop.evaluate(el => {
    const tabs = document.querySelector('.trainerNextClientTabs');
    const rect = tabs?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return true;
    const x = Math.max(1, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(1, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    return el.contains(document.elementFromPoint(x, y));
  })).toBe(true);
  await dialog.locator('[data-trainer-modal-content="true"]').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(dialog.getByRole('button', { name: 'Закрыть: Расписание и абонемент', exact: true })).toBeVisible();
  await dialog.screenshot({ path: testInfo.outputPath('schedule-above-client-tabs.png') });
  await dialog.getByRole('button', { name: 'Закрыть: Расписание и абонемент', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Тренировки', exact: true })).toBeVisible();
  noErrors();
});

test("single schedule editor preserves completed dates, manual adjustments and cancellation", async ({ page }, testInfo) => {
  const noErrors = failOnRuntimeErrors(page);
  const dialog = await openAgenda(page);
  await dialog.screenshot({ path: testInfo.outputPath("schedule-agenda-initial.png") });
  await expect(dialog.getByText("Выполнена", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Настроить дни", exact: true }).click();
  const editor = dialog.getByRole("region", { name: "Настройка дней тренировок", exact: true });
  const inputs = editor.getByLabel("Новая дата — Тренировка 3", { exact: true });
  await expect(editor.locator('input[type="date"]')).toHaveCount(2);
  await expect(dialog.getByRole("heading", { name: "Занятия программы", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Даты вручную", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("checkbox")).toHaveCount(7);
  await expect(inputs).toHaveValue("2026-07-20");
  const saveDates = dialog.getByRole("button", { name: "Сохранить даты", exact: true });
  await expect(saveDates).toBeDisabled();
  await expect(saveDates).toHaveAccessibleDescription("Даты не изменены. Измените дату занятия или выберите другие дни недели.");
  await inputs.fill("2026-07-22");
  await expect(saveDates).toBeEnabled();
  await expect(saveDates).not.toHaveAttribute("aria-describedby");
  await dialog.getByRole("button", { name: "Закрыть: Расписание и абонемент", exact: true }).click();
  await expect(dialog.getByRole("alert", { name: "Несохранённые изменения", exact: true })).toBeVisible();
  await expect(inputs).toHaveValue("2026-07-22");
  await dialog.getByRole("button", { name: "Продолжить редактирование", exact: true }).click();
  await dialog.getByRole("button", { name: "Сохранить даты", exact: true }).click();
  await expect(editor).toBeHidden();
  await dialog.getByRole("button", { name: "Настроить дни", exact: true }).click();
  await expect(editor.getByLabel("Новая дата — Тренировка 3", { exact: true })).toHaveValue("2026-07-22");
  await editor.getByLabel("Новая дата — Тренировка 3", { exact: true }).fill("2026-07-24");
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await dialog.getByRole("button", { name: "Настроить дни", exact: true }).click();
  await expect(editor.getByLabel("Новая дата — Тренировка 3", { exact: true })).toHaveValue("2026-07-22");
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Календарь занятий", exact: true })).toHaveCount(0);
  await dialog.getByRole("tab", { name: "Абонемент", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Календарь занятий", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Сегодня", exact: true }).click();
  await expect(dialog.locator('button[data-date="2026-06-15"]')).toHaveAttribute("data-range-start", "true");
  await dialog.screenshot({ path: testInfo.outputPath("schedule-agenda.png") });
  noErrors();
});

test("weekday distribution previews dates and failure keeps the draft for retry", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  const dialog = await openAgenda(page, "&scheduleSaveFailure=1");
  await dialog.getByRole("button", { name: "Настроить дни", exact: true }).click();
  const editor = dialog.getByRole("region", { name: "Настройка дней тренировок", exact: true });
  await editor.getByRole("checkbox", { name: "Ср", exact: true }).check();
  await editor.getByRole("checkbox", { name: "Пн", exact: true }).uncheck();
  await editor.getByLabel("Начиная с", { exact: true }).fill("2026-07-20");
  await expect(editor.getByLabel("Новая дата — Тренировка 3", { exact: true })).toHaveValue("2026-07-22");
  await editor.getByLabel("Новая дата — Тренировка 3", { exact: true }).fill("2026-07-24");
  await expect(editor.getByText("Изменено вручную", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Сохранить даты", exact: true }).click();
  await expect(dialog.getByText(/Не удалось сохранить даты/)).toBeVisible();
  await expect(editor.getByLabel("Новая дата — Тренировка 3", { exact: true })).toHaveValue("2026-07-24");
  await expect(dialog.getByRole("alert")).toHaveCount(1);
  await expect(dialog.getByText(/Даты распределены в черновике/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Сохранить даты", exact: true }).click();
  await expect(editor).toBeHidden();
  await dialog.getByRole("button", { name: "Настроить дни", exact: true }).click();
  await expect(editor.getByRole("checkbox", { name: "Ср", exact: true })).toBeChecked();
  await expect(editor.getByRole("checkbox", { name: "Пт", exact: true })).not.toBeChecked();
  await expect(editor.getByLabel("Новая дата — Тренировка 3", { exact: true })).toHaveValue("2026-07-24");
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  noErrors();
});

test("subscription error, counter correction and renewal keep separate meanings", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  const dialog = await openAgenda(page, "&notificationSaveFailure=1");
  await dialog.getByRole("tab", { name: "Абонемент", exact: true }).click();
  await dialog.getByRole("button", { name: "Изменить баланс", exact: true }).click();
  const editor = dialog.getByRole("region", { name: "Параметры абонемента", exact: true });
  await editor.getByLabel("Продано занятий", { exact: true }).fill("12");
  await editor.getByLabel("Выполнено занятий", { exact: true }).fill("2");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog.getByText(/Не удалось сохранить абонемент/)).toBeVisible();
  await expect(editor.getByLabel("Продано занятий", { exact: true })).toHaveValue("12");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();
  await dialog.getByRole("button", { name: "Продлить", exact: true }).click();
  await expect(editor.getByText(/История прежнего абонемента сохранится/)).toBeVisible();
  await editor.getByLabel("Занятий в новом абонементе", { exact: true }).fill("8");
  await editor.getByRole("button", { name: "Продлить абонемент", exact: true }).click();
  await expect(editor).toBeHidden();
  await dialog.getByRole("button", { name: "Изменить баланс", exact: true }).click();
  await expect(editor.getByLabel("Продано занятий", { exact: true })).toHaveValue("8");
  await expect(editor.getByLabel("Выполнено занятий", { exact: true })).toHaveValue("0");
  noErrors();
});

test("agenda, inline dates and subscription fit phone, narrow, landscape and desktop", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Representative responsive checks run once");
  const noErrors = failOnRuntimeErrors(page);
  const dialog = await openAgenda(page);
  for (const [width, height] of [[402, 874], [320, 720], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await dialog.getByRole("button", { name: "Настроить дни", exact: true }).click();
    const save = dialog.getByRole("button", { name: "Сохранить даты", exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeVisible();
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`schedule-${width}.png`), scale: "css" });
    await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  }
  noErrors();
});
