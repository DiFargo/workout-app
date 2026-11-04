import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(90_000);

async function clickTrainerClients(page) {
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  const mobile = page.getByTestId("trainer-nav-clients");
  const navigation = await mobile.isVisible() ? mobile : page.getByTestId("trainer-desktop-nav-clients");
  await navigation.click();
  await page.locator(".trainerNextClientTable > button").first().click();
  await expect(page.locator(".trainerNextClientPage")).toBeVisible();
}

async function openClientTab(page, name) {
  const desktop = page.locator(".trainerNextClientTabs").getByRole("button", { name, exact: true });
  const button = await desktop.isVisible()
    ? desktop
    : page.locator(".trainerNextClientMobileNav").getByRole("button", { name, exact: true });
  await button.click();
}

async function openSubscription(page, surface) {
  if (surface === "overview") {
    await openClientTab(page, "Сводка");
    await page.getByRole("button", { name: "Открыть абонемент", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Календарь тренировок", exact: true });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  await openClientTab(page, "Тренировки");
  const entry = page.getByText("Расписание и абонемент", { exact: true }).locator("..");
  await entry.getByRole("button", { name: "Редактировать", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Расписание и абонемент", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function startCounterEditing(dialog) {
  await dialog.getByRole("tab", { name: "Абонемент", exact: true }).click();
  await dialog.getByRole("button", { name: "Изменить баланс", exact: true }).click();
  const fields = dialog.getByRole("region", { name: "Параметры абонемента", exact: true });
  await expect(fields).toBeVisible();
  await expect(fields.getByLabel("Продано занятий", { exact: true })).toBeEditable();
  await expect(fields.getByLabel("Выполнено занятий", { exact: true })).toBeEditable();
  await expect(fields.locator("input")).toHaveCount(2);
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  await expect(fields.getByRole("checkbox")).toHaveCount(0);
  return fields;
}

async function expectReadOnlyRange(dialog, page, testInfo, surface) {
  const calendar = dialog.getByTestId("trainer-subscription-calendar");
  await expect(calendar).toBeVisible();
  await calendar.getByRole("tab", { name: "Абонемент", exact: true }).click();
  await expect(calendar.getByRole("region", { name: "Календарь занятий", exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "Сегодня", exact: true }).click();
  const dateButtons = calendar.locator("button[data-date]");
  await expect(dateButtons.first()).toBeVisible();
  // Calendar selection inspects dates; it must not open the editor or write data.
  await calendar.locator('button[data-date="2026-06-16"]').click();
  await expect(calendar.getByRole("region", { name: "Настройка дней тренировок", exact: true })).toHaveCount(0);
  const start = calendar.locator('button[data-date="2026-06-15"]');
  await expect(start).toHaveAttribute("data-subscription-range", "true");
  await expect(start).toHaveAttribute("data-range-start", "true");
  await expect(calendar.locator('button[data-date="2026-06-14"]')).not.toHaveAttribute("data-subscription-range", "true");

  await calendar.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  const end = calendar.locator('button[data-date="2026-07-20"]');
  await expect(end).toHaveAttribute("data-subscription-range", "true");
  await expect(end).toHaveAttribute("data-range-end", "true");
  await expect(calendar.locator('button[data-date="2026-07-21"]')).not.toHaveAttribute("data-subscription-range", "true");
  await calendar.getByRole("button", { name: "Предыдущий месяц", exact: true }).click();
  await expect(start).toHaveAttribute("data-range-start", "true");
  await start.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`subscription-range-${surface}.png`), scale: "css" });
}

for (const surface of ["overview", "workouts"]) {
  test(`subscription sessions preserve counters and automatic read-only dates in ${surface}`, async ({ page }, testInfo) => {
    if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 402, height: 874 });
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await page.clock.install({ time: new Date("2026-06-01T12:00:00.000Z") });
    // Existing fixtures include an archived June programme and a future August
    // assignment: neither may expand the current June 15–July 20 range.
    await page.goto("/?trainerHarness=1&scheduleReady=1&programAssignments=1");
    await clickTrainerClients(page);
    const dialog = await openSubscription(page, surface);
    await expectReadOnlyRange(dialog, page, testInfo, surface);
    const fields = await startCounterEditing(dialog);
    await expect(fields.getByLabel("Продано занятий", { exact: true })).toHaveValue("3");
    await expect(fields.getByLabel("Выполнено занятий", { exact: true })).toHaveValue("0");

    await fields.getByLabel("Продано занятий", { exact: true }).fill("12");
    await fields.getByLabel("Выполнено занятий", { exact: true }).fill("2");
    await fields.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`subscription-fields-${surface}.png`), scale: "css" });
    await fields.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(fields).toBeHidden();

    const savedFields = await startCounterEditing(dialog);
    await expect(savedFields.getByLabel("Продано занятий", { exact: true })).toHaveValue("12");
    await expect(savedFields.getByLabel("Выполнено занятий", { exact: true })).toHaveValue("2");
    await savedFields.getByLabel("Продано занятий", { exact: true }).fill("99");
    await savedFields.getByLabel("Выполнено занятий", { exact: true }).fill("9");
    await savedFields.getByRole("button", { name: "Отмена", exact: true }).click();
    const revertedFields = await startCounterEditing(dialog);
    await expect(revertedFields.getByLabel("Продано занятий", { exact: true })).toHaveValue("12");
    await expect(revertedFields.getByLabel("Выполнено занятий", { exact: true })).toHaveValue("2");
    await revertedFields.getByRole("button", { name: "Отмена", exact: true }).click();

    if (surface === "workouts") {
      const schedule = dialog.locator(".trainerWorkoutSchedulePlanner");
      await schedule.getByRole("tab", { name: "Расписание", exact: true }).click();
      await schedule.getByRole("button", { name: "Настроить дни", exact: true }).click();
      await schedule.getByRole("button", { name: "Сохранить даты", exact: true }).click();
      const afterScheduleSave = await startCounterEditing(dialog);
      // The programme has three dates; that is not the sold-session count.
      await expect(afterScheduleSave.getByLabel("Продано занятий", { exact: true })).toHaveValue("12");
      await expect(afterScheduleSave.getByLabel("Выполнено занятий", { exact: true })).toHaveValue("2");
      await afterScheduleSave.getByRole("button", { name: "Отмена", exact: true }).click();
    }

    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`subscription-sessions-${surface}.png`), scale: "css" });
    assertNoRuntimeErrors();
  });
}

for (const viewport of [{ width: 320, height: 720 }, { width: 844, height: 390 }]) {
  test(`subscription counters and calendar fit ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "Representative compact checks run once per browser in its mobile project");
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date("2026-06-01T12:00:00.000Z") });
    await page.goto("/?trainerHarness=1&scheduleReady=1&programAssignments=1");
    await clickTrainerClients(page);
    const dialog = await openSubscription(page, "overview");
    await expectReadOnlyRange(dialog, page, testInfo, `compact-${viewport.width}`);
    const fields = await startCounterEditing(dialog);
    await fields.scrollIntoViewIfNeeded();
    await expect(fields.getByRole("button", { name: "Сохранить", exact: true })).toBeVisible();
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`subscription-fields-${viewport.width}.png`), scale: "css" });
    assertNoRuntimeErrors();
  });
}
