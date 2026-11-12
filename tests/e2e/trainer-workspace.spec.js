import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";
import { serveExerciseVideo } from "./fixtures/serve-exercise-video.js";
import { mkdir } from "node:fs/promises";

test.setTimeout(60_000);
test.beforeEach(async ({ page }) => page.setDefaultTimeout(10000));

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: `${element.tagName.toLowerCase()}.${String(element.className || "").trim().replace(/\s+/g, ".")}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 12);

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders
    };
  });

  expect(metrics.documentWidth, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function trainerNavButton(page, section) {
  const mobileButton = page.getByTestId(`trainer-nav-${section}`);
  if (await mobileButton.count() && await mobileButton.isVisible()) return mobileButton;
  return page.getByTestId(`trainer-desktop-nav-${section}`);
}

async function clickTrainerNav(page, section) {
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  const button = await trainerNavButton(page, section);
  await expect(button).toBeVisible({ timeout: 40_000 });
  await button.click();
}

function clientTabs(page) {
  return page.locator(".trainerNextClientTabs");
}

async function clientTabControl(page, name) {
  const desktop = clientTabs(page).getByRole("button", { name, exact: true });
  if (await desktop.count() && await desktop.isVisible()) {
    return { button: desktop, activeAttribute: "aria-pressed", activeValue: "true" };
  }

  const mobile = page.locator(".trainerNextClientMobileNav").getByRole("button", { name, exact: true });
  if (await mobile.count() && await mobile.isVisible()) {
    return { button: mobile, activeAttribute: "aria-current", activeValue: "page" };
  }

  const utilityLabels = {
    "Сообщения": /^Сообщения Переписка с клиентом$/,
    "Уведомления": /^Напоминания/
  };
  if (name === "Сообщения") await openClientTab(page, "Сводка");
  if (name === "Уведомления") await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
  const utilityRoot = name === "Уведомления" ? page.getByRole("dialog", { name: "Управление клиентом", exact: true }) : page;
  const utilityAction = utilityRoot.getByRole("button", { name: utilityLabels[name] || name, exact: true });
  return { button: utilityAction, utility: true };
}

async function expectClientNavigation(page) {
  if (await clientTabs(page).isVisible()) {
    await expect(clientTabs(page).getByRole("button")).toHaveCount(4);
    await expect(clientTabs(page).getByRole("button", { name: "Тренировки", exact: true })).toBeVisible();
    await expect(clientTabs(page).getByRole("button", { name: "Сообщения", exact: true })).toHaveCount(0);
    await expect(clientTabs(page).getByRole("button", { name: "Заметки", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Сообщения Переписка с клиентом$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Действия с клиентом", exact: true })).toBeVisible();
    await expect(page.locator(".trainerNextClientTabs button[aria-pressed='true']")).toHaveCount(1);
    return;
  }

  const mobileNav = page.locator(".trainerNextClientMobileNav");
  await expect(mobileNav.getByRole("button")).toHaveCount(4);
  await expect(mobileNav.getByRole("button", { name: "Тренировки", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Сообщения Переписка с клиентом$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Действия с клиентом", exact: true })).toBeVisible();
  await expect(mobileNav.locator("button[aria-current='page']")).toHaveCount(1);
}

async function dismissNutritionPlanEditor(page) {
  const nutritionPlanEditor = page.locator("[data-trainer-modal-surface='true']").filter({
    has: page.locator("#trainer-nutrition-plan-modal-title")
  });
  if (await nutritionPlanEditor.count() && await nutritionPlanEditor.isVisible()) {
    await nutritionPlanEditor.locator(".trainerNextModalClose").click();
    await expect(nutritionPlanEditor).toBeHidden();
  }
}

async function openClientTab(page, name) {
  const control = await clientTabControl(page, name);
  await expect(control.button).toBeVisible();
  await control.button.click();
  if (control.utility) {
    await expect(page.getByRole("dialog", { name, exact: true })).toBeVisible();
    return;
  }
  await dismissNutritionPlanEditor(page);
  const activeControl = await clientTabControl(page, name);
  await expect(activeControl.button).toHaveAttribute(activeControl.activeAttribute, activeControl.activeValue);
}

async function closeClientUtilitySheet(page, name) {
  const dialog = page.getByRole("dialog", { name, exact: true });
  if (!await dialog.isVisible()) return;
  await dialog.getByRole("button", { name: `Закрыть: ${name}`, exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function openHarnessClient(page) {
  const clientRow = page.locator(".trainerNextClientTable > button").first();
  await expect(clientRow).toBeVisible();
  await clientRow.click();
  await expect(page.locator(".trainerNextClientPage")).toBeVisible();

  // The harness routes the "Проверить питание" attention action directly to
  // the nutrition-plan editor.  Close that intentional sheet before a test
  // continues with a different client tab.
  await dismissNutritionPlanEditor(page);
}

async function openExerciseSection(page, name) {
  await closeClientUtilitySheet(page, "Прогресс упражнений");
  await openClientTab(page, name === "Прогресс упражнений" ? "Сводка" : "Тренировки");
  if (name === "Прогресс упражнений") {
    const button = page.getByRole("button", { name: /^(Открыть )?прогресс упражнений/i });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole("dialog", { name: "Прогресс упражнений", exact: true })).toBeVisible();
    return;
  }

  await closeClientUtilitySheet(page, "Прогресс упражнений");
  await expect(page.locator(".trainerClientWorkoutPlan")).toBeVisible();
}

async function openWorkoutInsights(page) {
  await openClientTab(page, "Тренировки");
  const button = page.getByRole("button", { name: /^История тренировок Завершённые занятия и результаты$/ });
  await expect(button).toBeVisible();
  await button.click();

  const dialog = page.getByRole("dialog", { name: "История тренировок", exact: true });
  await expect(dialog).toBeVisible();
  const currentReview = dialog.locator('button[data-workout-history-review="current"]');
  if (await currentReview.count()) await currentReview.click();
  return dialog;
}

async function openProgramAssignmentHistory(page) {
  await openClientTab(page, "Тренировки");
  const button = page.getByRole("button", { name: /^История программ Назначенные программы и изменения$/ });
  await expect(button).toBeVisible();
  await button.click();

  const dialog = page.getByRole("dialog", { name: "История программ", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openClientMessages(page) {
  await openClientTab(page, "Сообщения");
  const utilitySheet = page.getByRole("dialog", { name: "Сообщения", exact: true });
  if (await utilitySheet.isVisible()) return utilitySheet;

  const panel = page.locator("section[aria-labelledby='trainer-client-messages-title']");
  await expect(panel).toBeVisible();
  return panel;
}

async function openTrainerPrograms(page) {
  await clickTrainerNav(page, "workouts");
}

async function openClientCalendar(page) {
  await openClientTab(page, "Тренировки");
  await page.getByText("Расписание и абонемент", { exact: true }).locator("..").getByRole("button", { name: "Редактировать", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Расписание и абонемент", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openClientManagementCalendar(page) {
  await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
  const actions = page.getByRole("dialog", { name: "Управление клиентом", exact: true });
  await expect(actions).toBeVisible();
  await actions.getByRole("button", { name: /^Расписание и абонемент/ }).click();
  await expect(actions).toBeHidden();
  const calendar = page.getByRole("dialog", { name: "Календарь тренировок", exact: true });
  await expect(calendar).toBeVisible();
  return calendar;
}

async function selectClientProgramDay(editor, index) {
  const picker = editor.getByRole("combobox", { name: "День программы", exact: true });
  if (await picker.isVisible()) await picker.selectOption({ index });
  else await editor.locator(".trainerNextWorkoutDaySelect").nth(index).click();
}

async function openClientExerciseSettings(page, editor) {
  await editor.getByRole("button", { name: /^Действия:/ }).first().click();
  const actions = page.getByRole("dialog", { name: "Действия с упражнением", exact: true });
  await expect(actions).toBeVisible();
  await actions.getByRole("button", { name: "По подходам и параметры", exact: true }).click();
  await expect(actions).toBeHidden();
}

async function expectClientManagementMenu(page) {
  await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
  const clientActions = page.getByRole("dialog", { name: "Управление клиентом", exact: true });
  await expect(clientActions).toBeVisible();
  const mainActions = clientActions.locator('[aria-label="Основные действия"]');
  await expect(mainActions.getByRole("button")).toHaveCount(3);
  for (const action of [/^Расписание и абонемент/, /^Напоминания/, /^Данные для входа и связи/]) {
    await expect(mainActions.getByRole("button", { name: action })).toBeVisible();
  }
  const extraActions = [/^Скачать таблицу CSV/, /^Отчёт для печати \/ PDF/, /^Отметить как тестового/];
  for (const action of extraActions) {
    await expect(clientActions.getByRole("button", { name: action, includeHidden: true })).toBeHidden();
  }
  await expect(clientActions.getByRole("button", { name: /^Удалить клиента/, includeHidden: true })).toHaveCount(0);
  await expect(clientActions.getByRole("button", { name: /Архивировать клиента|Восстановить клиента/ })).toBeVisible();
  await clientActions.locator("summary").filter({ hasText: "Дополнительно" }).click();
  for (const action of extraActions) {
    await expect(clientActions.getByRole("button", { name: action })).toBeVisible();
  }
  await expect(clientActions.getByRole("button", { name: /^Удалить клиента/, includeHidden: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await clientActions.getByRole("button", { name: "Закрыть: Управление клиентом", exact: true }).click();
  await expect(clientActions).toBeHidden();

  for (const [action, destination] of [
    [/^Напоминания/, "Уведомления"],
    [/^Данные для входа и связи/, "Данные для входа и связи"],
    [/^Расписание и абонемент/, "Календарь тренировок"]
  ]) {
    await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
    await expect(clientActions).toBeVisible();
    await clientActions.getByRole("button", { name: action }).click();
    await expect(clientActions).toBeHidden();
    const destinationDialog = page.getByRole("dialog", { name: destination, exact: true });
    await expect(destinationDialog).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    if (destination === "Уведомления") await expect(destinationDialog.locator(".trainerNotificationCalendarGrid")).toBeVisible();
    if (destination === "Календарь тренировок") {
      await expect(destinationDialog.getByRole("tab", { name: "Расписание", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(destinationDialog.getByRole("tabpanel", { name: "Расписание", exact: true })).toBeVisible();
      await expect(destinationDialog.getByRole("tab", { name: "Абонемент", exact: true })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await closeClientUtilitySheet(page, destination);
  }
}

test("trainer client management menu keeps secondary actions collapsed and opens matching utility sheets", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openClientTab(page, "Сводка");
  await expectClientManagementMenu(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Germes", exact: true })).toBeVisible();
  assertNoRuntimeErrors();
});

test("trainer client management menu preserves repeated failures and treats cancellation without success", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const errorText = "Не удалось выполнить действие клиента. Проверьте подключение и повторите попытку.";
  const successText = "Клиент отмечен как тестовый и не учитывается в общей статистике.";

  async function openActions(scenario) {
    await page.goto(`/?trainerHarness=1&clientActionsAudit=${scenario}`);
    await clickTrainerNav(page, "clients");
    await openHarnessClient(page);
    await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Управление клиентом", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.locator("summary").filter({ hasText: "Дополнительно" }).click();
    return dialog;
  }

  await test.step("две одинаковые ошибки остаются видимыми после завершения каждой попытки, pending не допускает повторных вызовов", async () => {
    const dialog = await openActions("failure");
    const action = dialog.getByRole("button", { name: /^Отметить как тестового/ });
    const rows = dialog.getByTestId("trainer-client-actions").locator("button");
    const serverError = dialog.getByText(errorText, { exact: true });

    for (const attempt of [1, 2]) {
      await action.click();
      await expect(page.locator("html")).toHaveAttribute("data-client-action-attempts", String(attempt));
      await expect.poll(() => rows.evaluateAll(buttons => buttons.length > 0 && buttons.every(button => button.disabled))).toBe(true);
      // Native programmatic clicks and Enter cannot re-enter any disabled row.
      await rows.evaluateAll(buttons => buttons.forEach(button => { button.click(); button.click(); }));
      await page.keyboard.press("Enter");
      await expect(page.locator("html")).toHaveAttribute("data-client-action-attempts", String(attempt));
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(successText, { exact: true })).toHaveCount(0);
      await expect(action).toBeEnabled();
      await expect(serverError).toBeVisible();
      await expect.poll(() => rows.evaluateAll(buttons => buttons.every(button => !button.disabled))).toBe(true);
    }
    await expect(page.locator("html")).toHaveAttribute("data-client-action-attempts", "2");
    await expect(serverError).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  await test.step("первая отменённая операция не создаёт ни ошибку, ни подтверждение успеха", async () => {
    const dialog = await openActions("cancel");
    const action = dialog.getByRole("button", { name: /^Отметить как тестового/ });
    await action.click();
    await expect(page.locator("html")).toHaveAttribute("data-client-action-attempts", "1");
    await expect(action).toBeEnabled();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByRole("status")).toHaveCount(0);
    await expect(dialog.getByText(errorText, { exact: true })).toHaveCount(0);
    await expect(dialog.getByText(successText, { exact: true })).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });
  assertNoRuntimeErrors();
});

test("trainer workspace smoke: dashboard, clients and client card stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  const main = page.locator(".trainerNextMain");

  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickTrainerNav(page, "clients");
  await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Germes")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await openHarnessClient(page);
  await openClientTab(page, "Сводка");
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expectClientNavigation(page);
  const clientActionsButton = page.getByRole("button", { name: "Действия с клиентом", exact: true });
  const clientActionsBox = await clientActionsButton.boundingBox();
  expect(clientActionsBox).not.toBeNull();
  expect(clientActionsBox.x).toBeGreaterThanOrEqual(0);
  expect(clientActionsBox.x + clientActionsBox.width).toBeLessThanOrEqual(page.viewportSize().width);
  await expect(page.getByTestId("trainer-client-progress-dashboard").locator("button[aria-pressed='true']")).toHaveCount(2);

  const subscriptionDialog = await openClientManagementCalendar(page);
  await subscriptionDialog.getByRole("tab", { name: "Абонемент", exact: true }).click();
  await subscriptionDialog.getByRole("button", { name: "Настроить абонемент", exact: true }).click();
  await expect(subscriptionDialog.getByRole("region", { name: "Параметры абонемента" })).toBeVisible();
  await expect(subscriptionDialog.getByLabel("Продано занятий")).toBeEditable();
  await subscriptionDialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(subscriptionDialog).toBeHidden();

  await openExerciseSection(page, "Прогресс упражнений");
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(page.locator(".trainerExerciseProgressToolbar button[aria-pressed='true']")).toHaveCount(1);

  await openExerciseSection(page, "План тренировок");
  await openClientCalendar(page);
  await expect(page.getByRole("tabpanel", { name: "Расписание", exact: true }).locator("button[aria-pressed]")).toHaveCount(3);
  await page.getByRole("tab", { name: "Абонемент", exact: true }).click();
  await expect(page.getByRole("region", { name: "Календарь занятий", exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Обозначения календаря"]')).toBeVisible();
  await closeClientUtilitySheet(page, "Расписание и абонемент");
  const currentProgramCard = page.locator('[class*="currentProgram"]').filter({ hasText: "Персональный план клиента" }).first();
  await expect(currentProgramCard.locator(".trainerClientProgramEditButton")).toBeVisible();
  await expect(page.locator('[class*="assignment"] .trainerClientProgramEditButton')).toHaveCount(0);
  await page.locator(".trainerClientProgramEditButton").click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModalBody")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModal")).toContainText("tren+");
  await page.getByRole("button", { name: "Закрыть редактор", exact: true }).click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await openClientTab(page, "Сообщения");
  const messagesUtilitySheet = page.getByRole("dialog", { name: "Сообщения" });
  await expect(messagesUtilitySheet).toBeVisible();
  const composeMessage = messagesUtilitySheet.getByRole("button", { name: "Написать клиенту", exact: true });
  await expect(composeMessage).toBeVisible();
  await composeMessage.click();
  await expect(messagesUtilitySheet).toBeHidden();
  const composeDialog = page.locator("[aria-labelledby='trainer-feedback-reply-title']");
  await expect(composeDialog).toBeVisible();
  await expect(composeDialog).toContainText("СООБЩЕНИЕ В ПРИЛОЖЕНИИ");
  await composeDialog.getByRole("textbox").fill("Проверьте, пожалуйста, самочувствие после тренировки.");
  const composeSendButton = composeDialog.locator("[data-trainer-modal-footer='true'] button").filter({ hasText: /^Отправить в приложение$/ });
  await expect(composeSendButton).toBeEnabled();
  await composeSendButton.click();
  await expect(composeDialog).toBeHidden();
  await expect(messagesUtilitySheet).toBeHidden();

  await expectClientManagementMenu(page);
  assertNoRuntimeErrors();

  await openClientTab(page, "Питание");
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  const nutritionControl = await clientTabControl(page, "Питание");
  await expect(nutritionControl.button).toHaveAttribute(nutritionControl.activeAttribute, nutritionControl.activeValue);
  await expect(page.locator(".trainerNutritionPeriodButtons button[aria-pressed='true']")).toHaveCount(1);
  await page.getByRole("button", { name: "Открыть дневник", exact: true }).click();
  const diaryModal = page.getByRole("dialog", { name: "Дневник питания" });
  await expect(diaryModal).toBeVisible();
  await expect(diaryModal.locator("button[aria-pressed='true']")).toHaveCount(1);
  await diaryModal.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(diaryModal).toBeHidden();
  await openClientTab(page, "Уведомления");
  await expect(page.locator(".trainerNotificationCalendarGrid")).toBeVisible();
  await expect(page.locator(".trainerNotificationLegend")).toBeVisible();
  await expect(page.locator(".trainerReminderPeriod button[aria-pressed='true']")).toHaveCount(2);
  await expect(page.locator(".trainerNotificationCalendarGrid button")).toHaveCount(42);
  await page.locator(".trainerNotificationOffsets label").first().click();
  await page.locator(".trainerNotificationActions .trainerNextPrimary").click();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
  await closeClientUtilitySheet(page, "Уведомления");

  await openClientTab(page, "Фото и замеры");
  await expect(page.locator(".trainerClientBodyProgress")).toBeVisible();
  await expect(page.locator(".trainerPhotoViewTabs").first().locator("button[aria-pressed='true']")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

});

test("trainer client invite supports a Telegram nickname without requiring a separate login", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await clickTrainerNav(page, "clients");
  await page.getByRole("button", { name: "Добавить клиента", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Пригласить клиента", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ник в Telegram", { exact: true })).toBeVisible();
  await dialog.getByLabel("Ник в Telegram").fill("@ilya_fit");
  await expect(dialog.getByLabel("Логин для запасного входа (необязательно)")).toBeVisible();
  await expect(dialog.getByText("Если оставить пустым, логин создастся автоматически.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("training calendar keeps actual workout outcomes primary and subscription secondary", async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00.000Z"));
  await page.goto("/?trainerHarness=1&scheduleReady=1", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  const dialog = await openClientManagementCalendar(page);
  await expect(dialog.getByRole("tab", { name: "Расписание", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog).toContainText("1 из 3 выполнено · по датам");
  const sessions = dialog.getByRole("tabpanel", { name: "Расписание", exact: true }).locator("button[aria-pressed]");
  await expect(sessions).toHaveCount(3);
  await expect(sessions).toContainText(["Тренировка 1", "Тренировка 2", "Тренировка 3"]);
  await expect(sessions.first()).toContainText("Выполнена");
  await expect(sessions.nth(1)).toContainText("Пропущена");
  await expect(dialog.getByRole("button", { name: "Настроить дни", exact: true })).toBeDisabled();
  await dialog.getByRole("tab", { name: "Абонемент", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Баланс абонемента", exact: true }).getByText("Закончился", { exact: true })).toBeVisible();
});

test("trainer prepares an AI nutrition draft before confirmation", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });

  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openClientTab(page, "Питание");
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();

  await page.locator(".trainerNutritionPlanEditButton").click();
  const nutritionPlanEditor = page.locator("[data-trainer-modal-surface='true']").filter({
    has: page.locator("#trainer-nutrition-plan-modal-title")
  });
  await expect(nutritionPlanEditor).toBeVisible();
  const presetSelect = nutritionPlanEditor.getByLabel("Готовый вариант плана питания");
  await presetSelect.selectOption({ index: 1 });
  await expect(nutritionPlanEditor.getByLabel("Название плана")).toBeDisabled();
  await expect(nutritionPlanEditor.getByLabel("Калории")).toBeDisabled();
  await presetSelect.selectOption("custom");
  await expect(nutritionPlanEditor.getByLabel("Название плана")).toBeEnabled();
  await expect(nutritionPlanEditor.getByLabel("Калории")).toBeEnabled();
  await nutritionPlanEditor.getByRole("button", { name: "Сформировать индивидуальный AI-план", exact: true }).click();

  await expect(nutritionPlanEditor).toContainText("AI-план подготовлен по профилю клиента, тренировкам и дневнику");
  await expect(nutritionPlanEditor.getByLabel("Название плана")).toHaveValue(/AI-план/);
  await expect(nutritionPlanEditor.getByRole("button", { name: "Сохранить", exact: true })).toBeVisible();
  await nutritionPlanEditor.locator(".trainerNextModalClose").click();
  await expect(nutritionPlanEditor).toBeHidden();
  assertNoRuntimeErrors();
});

test("client messages can be processed without a reply and assignments open from one entry point", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible();
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openClientTab(page, "Сводка");

  const tasksButton = page.getByRole("button", { name: /^Задания клиенту Текущие задания и результаты$/ });
  await expect(tasksButton).toBeVisible();
  await tasksButton.click();
  const tasksSheet = page.getByRole("dialog", { name: "Задания клиенту", exact: true });
  await expect(tasksSheet).toBeVisible();
  await expect(tasksSheet.getByText("Назначения клиента", { exact: true })).toBeVisible();
  await expect(tasksSheet.getByText("Заполнить дневник самочувствия", { exact: true })).toBeVisible();
  const createTaskButton = tasksSheet.getByRole("button", { name: "Назначить задание", exact: true });
  await expect(createTaskButton).toBeVisible();
  await expect(createTaskButton).toBeEnabled();
  await expect(createTaskButton).toHaveCSS("color", "rgb(255, 255, 255)");
  await closeClientUtilitySheet(page, "Задания клиенту");

  await expectClientNavigation(page);
  let messagesPanel = await openClientMessages(page);
  await expect(messagesPanel.getByRole("heading", { name: "Комментарии клиента" })).toBeVisible();
  await expect(page.locator(".trainerNextNoteCard")).toHaveCount(0);
  await expect(page.getByText("Тестовая заметка", { exact: true })).toHaveCount(0);
  await expect(messagesPanel.getByText("Задания клиенту", { exact: true })).toHaveCount(0);

  let filters = messagesPanel.getByRole("navigation", { name: "Фильтры сообщений клиента" });
  await expect(filters).toBeVisible();
  await expect(filters.getByRole("button")).toHaveCount(3);
  await expect(filters.getByRole("button", { name: /^Требуют внимания/ })).toHaveAttribute("aria-pressed", "true");

  const replyButtons = messagesPanel.getByRole("button", { name: "Ответить", exact: true });
  await expect(replyButtons).toHaveCount(2);
  await replyButtons.first().click();
  const replyDialog = page.getByRole("dialog", { name: "Ответ клиенту" });
  await expect(replyDialog).toBeVisible();
  await expect(replyDialog).toContainText("Комментарий клиента");
  const markProcessed = replyDialog.getByRole("button", { name: "Отметить обработанным", exact: true });
  await expect(markProcessed).toBeEnabled();
  await markProcessed.click();
  await expect(replyDialog).toBeHidden();
  messagesPanel = await openClientMessages(page);
  filters = messagesPanel.getByRole("navigation", { name: "Фильтры сообщений клиента" });
  await expect(filters.getByRole("button", { name: /^Требуют внимания/ })).toContainText("1");
  await expect(filters.getByRole("button", { name: /^Обработанные/ })).toContainText("1");

  await messagesPanel.getByRole("button", { name: "Обработать все", exact: true }).click();
  await expect(filters.getByRole("button", { name: /^Требуют внимания/ })).toContainText("1");
  await messagesPanel.getByRole("button", { name: "Отметить все обработанными", exact: true }).click();
  await expect(filters.getByRole("button", { name: /^Требуют внимания/ })).toContainText("0");
  await expect(filters.getByRole("button", { name: /^Обработанные/ })).toContainText("2");
  await expect(messagesPanel.getByRole("button", { name: "Обработать все", exact: true })).toHaveCount(0);

  await filters.getByRole("button", { name: /^Обработанные/ }).click();
  await expect(filters.getByRole("button", { name: /^Обработанные/ })).toHaveAttribute("aria-pressed", "true");
  await expect(messagesPanel.getByText("Обработано", { exact: true })).toHaveCount(2);

  await messagesPanel.getByRole("button", { name: "Ответить ещё раз", exact: true }).first().click();
  await expect(replyDialog).toBeVisible();
  await replyDialog.getByRole("textbox").fill("Спасибо за обратную связь. Проверю нагрузку.");
  const replySendButton = replyDialog.locator("[data-trainer-modal-footer='true'] button").filter({ hasText: /^Отправить в приложение$/ });
  await expect(replySendButton).toBeEnabled();
  await replySendButton.click();
  await expect(replyDialog.getByRole("status")).toHaveText("Ответ отправлен");
  await replyDialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(replyDialog).toBeHidden();

  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("exercise progress history shows newest sessions first while the chart stays chronological", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-07-10T12:00:00.000Z") });
  await page.goto("/?trainerHarness=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "Прогресс упражнений");
  await page.getByRole("button", { name: "Открыть историю", exact: true }).first().click();
  const sessions = page.locator(".trainerExerciseProgressHistorySessions > article");
  await expect(sessions).toHaveCount(2);
  await expect(sessions.first().locator(":scope > strong")).toContainText("7 июл.");
  await expect(sessions.last().locator(":scope > strong")).toContainText("15 июн.");
  const chart = page.getByTestId("trainer-exercise-history-chart");
  const picker = chart.getByLabel("Запись", { exact: true });
  await expect(picker.locator("option").first()).toContainText("7 июл.");
  await expect(picker.locator("option").last()).toContainText("15 июн.");
  await chart.locator("summary").click();
  await expect(chart.locator("tbody tr").first()).toContainText("7 июл.");
  const graph = chart.getByRole("slider");
  await graph.focus();
  await page.keyboard.press("Home");
  await expect(chart.getByTestId("trainer-history-chart-value")).toContainText("15 июн.");
  await page.keyboard.press("End");
  await expect(chart.getByTestId("trainer-history-chart-value")).toContainText("7 июл.");
  await expect(page.locator(".trainerExerciseProgressHistorySummary")).toContainText("Предыдущая тренировка90 кг");
  await expect(page.locator(".trainerExerciseProgressHistorySummary")).toContainText("Последняя тренировка70 кг");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("exercise progress decision supports confirmation and inline load editing", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-07-10T12:00:00.000Z") });

  async function openProgressDecision() {
    await page.goto("/?trainerHarness=1");
    await clickTrainerNav(page, "clients");
    await openHarnessClient(page);
    await openExerciseSection(page, "Прогресс упражнений");
    const adjustButton = page.getByRole("button", { name: "Скорректировать нагрузку" }).first();
    await expect(adjustButton).toBeVisible();
    await adjustButton.click();
    const dialog = page.getByRole("dialog", { name: "Корректировка нагрузки" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Жим ногами");
    await expect(dialog).toContainText("Тренировка 3");
    return dialog;
  }

  let dialog = await openProgressDecision();
  await dialog.getByLabel("Вес, подход 1").fill("65");
  await dialog.getByLabel("Повторы, подход 1").fill("10");
  await dialog.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Скорректировать нагрузку" })).toHaveCount(0);

  await page.getByRole("button", { name: /Фильтры/ }).click();
  await page.getByRole("button", { name: /Все/ }).click();
  await expect(page.getByText("Проверено тренером")).toBeVisible();
  assertNoRuntimeErrors();

  dialog = await openProgressDecision();
  await dialog.getByRole("button", { name: "Всё в порядке" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Скорректировать нагрузку" })).toHaveCount(0);
  assertNoRuntimeErrors();
});

test("workout review decision opens the next workout and can be confirmed without changes", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-07-10T12:00:00.000Z") });
  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible();
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  await expect(page.getByText("ДИНАМИКА", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Как проходят тренировки", { exact: true })).toHaveCount(0);

  let insightsDialog = await openWorkoutInsights(page);
  let adjustButton = insightsDialog.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true });
  await expect(adjustButton).toBeVisible();
  await adjustButton.click();

  let decisionDialog = page.getByRole("dialog", { name: "Нужна ли корректировка?" });
  await expect(decisionDialog).toBeVisible();
  await expect(decisionDialog.getByRole("button", { name: /Всё в порядке/ })).toBeVisible();
  await expect(decisionDialog.getByRole("button", { name: /Редактировать тренировку/ })).toBeVisible();
  await expect(decisionDialog).toContainText("Тренировка 3");
  await expectNoHorizontalOverflow(page);

  await decisionDialog.getByRole("button", { name: /Редактировать тренировку/ }).click();
  await expect(decisionDialog).toBeHidden();

  const editorDialog = page.getByRole("dialog", { name: "Редактор программы клиента" });
  await expect(editorDialog).toBeVisible();
  const selectedWorkout = editorDialog.locator(".trainerNextWorkoutDaySelect[aria-pressed='true']");
  await expect(selectedWorkout).toContainText("Тренировка 3");
  await expectNoHorizontalOverflow(page);

  await editorDialog.getByRole("button", { name: "Закрыть редактор" }).click();
  await expect(editorDialog).toBeHidden();
  insightsDialog = await openWorkoutInsights(page);
  adjustButton = insightsDialog.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true });
  await expect(adjustButton).toBeVisible();

  await adjustButton.click();
  decisionDialog = page.getByRole("dialog", { name: "Нужна ли корректировка?" });
  await expect(decisionDialog).toBeVisible();
  await decisionDialog.getByRole("button", { name: /Всё в порядке/ }).click();
  await expect(decisionDialog).toBeHidden();
  insightsDialog = await openWorkoutInsights(page);
  await expect(insightsDialog.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true })).toHaveCount(0);
  await expect(insightsDialog.locator("[data-workout-history-detail]")).toContainText("Проверено тренером");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("workout review stays within the current assignment and saves only the next workout", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-07-10T12:00:00.000Z") });
  await page.goto("/?trainerHarness=1&staleReview=1&basicHistory=1&programAssignments=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);

  let history = await openWorkoutInsights(page);
  const review = history.locator("[data-workout-history-detail]");
  await expect(review).toContainText("Текущий сигнал: снизил вес на жиме.");
  await expect(review).not.toContainText("Устаревший сигнал из архивной программы.");
  await expect(review).not.toContainText("Сигнал из самостоятельного базового плана.");
  // The full history still contains these newer records; only the actionable
  // review is restricted to the current trainer assignment.
  const historyRows = history.locator('button[aria-controls*="-session-"]');
  await historyRows.nth(1).click();
  await expect(history).toContainText("Устаревший сигнал из архивной программы.");
  await expect(history.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true })).toHaveCount(0);
  await historyRows.first().click();
  await expect(history).toContainText("Сигнал из самостоятельного базового плана.");
  await history.locator('button[data-workout-history-review="current"]').click();
  const [reviewBox, statusBox] = await Promise.all([
    review.boundingBox(),
    review.locator("header > strong").boundingBox()
  ]);
  expect(statusBox.x).toBeGreaterThanOrEqual(reviewBox.x);
  expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(reviewBox.x + reviewBox.width);
  await history.screenshot({ path: test.info().outputPath("current-workout-review.png") });
  await review.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true }).click();

  const decision = page.getByRole("dialog", { name: "Нужна ли корректировка?" });
  await expect(decision).toContainText("Тренировка 3");
  await expect(decision).not.toContainText("Будущая тренировка");
  await decision.getByRole("button", { name: /Редактировать тренировку/ }).click();
  const editor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.locator(".trainerNextWorkoutDayItem")).toHaveCount(3);
  await editor.getByRole("button", { name: "По подходам и параметры", exact: true }).click();
  const exerciseSheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  await exerciseSheet.getByLabel("Вес, подход 1", { exact: true }).fill("65");
  await expect(exerciseSheet.getByLabel("Вес, подход 1", { exact: true })).toHaveValue("65");
  await expect(exerciseSheet.getByLabel("Вес, подход 2", { exact: true })).toHaveValue("70");
  await exerciseSheet.getByRole("button", { name: "К программе", exact: true }).click();
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();

  history = await openWorkoutInsights(page);
  await expect(history.locator("[data-workout-history-detail]")).toContainText("Проверено тренером");
  await expect(history.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true })).toHaveCount(0);
  await closeClientUtilitySheet(page, "История тренировок");

  await page.locator(".trainerClientProgramEditButton").click();
  const dayPicker = editor.getByRole("combobox", { name: "День программы", exact: true });
  if (await dayPicker.isVisible()) await dayPicker.selectOption({ index: 2 });
  else await editor.locator(".trainerNextWorkoutDaySelect").nth(2).click();
  await expect(editor.getByRole("button", { name: "Вес: разные по подходам. Жим ногами", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "По подходам и параметры", exact: true }).click();
  await expect(exerciseSheet.getByLabel("Вес, подход 1", { exact: true })).toHaveValue("65");
  await expect(exerciseSheet.getByLabel("Вес, подход 2", { exact: true })).toHaveValue("70");
  await exerciseSheet.getByRole("button", { name: "К программе", exact: true }).click();
  if (await dayPicker.isVisible()) await dayPicker.selectOption({ index: 0 });
  else await editor.locator(".trainerNextWorkoutDaySelect").first().click();
  await expect(editor.getByLabel("Вес: Жим ногами", { exact: true })).toHaveValue("90");
  await expect(editor.getByLabel("Вес: Жим ногами", { exact: true })).toBeDisabled();
  await expect(editor.getByLabel("Статус тренировки", { exact: true })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

async function expectReadOnlyProgramVideo(sheet, { client = false } = {}) {
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('input[type="file"]')).toHaveCount(0);
  await expect(sheet.getByText("Заменить видео", { exact: true })).toHaveCount(0);
  if (client) await sheet.locator("summary").filter({ hasText: "Видео упражнения" }).click();
  await expect(sheet.getByText(client ? "Видео и превью меняются в библиотеке упражнений." : "Видео можно изменить в библиотеке упражнений.", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Удалить из тренировки", exact: true })).toBeEnabled();
  const video = sheet.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toBeVisible();
  const media = await video.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, controls: node.controls, playsInline: node.playsInline,
      fullscreenDisabled: node.controlsList.contains("nofullscreen") };
  });
  expect(media.width).toBeGreaterThan(100);
  expect(Math.abs(media.width - media.height)).toBeLessThanOrEqual(1);
  expect(media.controls).toBe(true);
  expect(media.playsInline).toBe(true);
  expect(media.fullscreenDisabled).toBe(false);
  await video.evaluate(async node => { node.muted = true; await node.play(); });
  await expect.poll(() => video.evaluate(node => node.currentTime)).toBeGreaterThan(0);
  await video.evaluate(node => new Promise(resolve => node.requestVideoFrameCallback(() => resolve())));
  expect(await video.evaluate(node => node.paused)).toBe(false);
  await video.evaluate(node => node.pause());
  expect(await video.evaluate(node => node.paused)).toBe(true);
}

async function expectClientExerciseSettingsReachable(page, sheet, setRows) {
  const footer = sheet.locator(":scope > footer");
  const body = sheet.locator(":scope > div");
  const returnButton = footer.getByRole("button", { name: "К программе", exact: true });
  await expect(returnButton).toBeInViewport();
  for (const row of await setRows.all()) {
    for (const field of await row.getByRole("textbox").all()) {
      await field.focus();
      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeInViewport();
      const [fieldBox, bodyBox, footerBox] = await Promise.all([
        field.boundingBox(), body.boundingBox(), footer.boundingBox()
      ]);
      expect(fieldBox.y).toBeGreaterThanOrEqual(bodyBox.y - 1);
      expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(Math.min(bodyBox.y + bodyBox.height, footerBox.y) + 1);
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
    }
  }
  const deleteButton = sheet.getByRole("button", { name: "Удалить из тренировки", exact: true });
  await deleteButton.scrollIntoViewIfNeeded();
  await expect(deleteButton).toBeInViewport();
  await expect(returnButton).toBeInViewport();
  const [deleteBox, footerBox] = await Promise.all([deleteButton.boundingBox(), footer.boundingBox()]);
  expect(deleteBox.y + deleteBox.height).toBeLessThanOrEqual(footerBox.y + 1);
}

test("client program exercise settings show square playback and library-only video editing", async ({ page }, info) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await serveExerciseVideo(page);
  await page.goto("/?trainerHarness=1&programVideoAudit=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");
  await page.locator(".trainerClientProgramEditButton").click();
  const editor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await expect(editor).toBeVisible();
  await selectClientProgramDay(editor, 2);
  await openClientExerciseSettings(page, editor);
  await expectReadOnlyProgramVideo(page.getByRole("dialog", { name: "Настройки упражнения", exact: true }), { client: true });
  await page.getByTestId("trainer-program-exercise-video").scrollIntoViewIfNeeded();
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: `output/playwright/program-settings-865-client-${info.project.name}.png` });
  assertNoRuntimeErrors();
});

test("shared template exercise settings show square playback and library-only video editing", async ({ page }, info) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await serveExerciseVideo(page);
  await page.goto("/?trainerHarness=1&programVideoAudit=1");
  await openTrainerPrograms(page);
  await expect(page.getByRole("searchbox", { name: "Найти программу" })).toBeVisible();
  await page.getByRole("button", { name: /Редактировать/ }).click();
  const editor = page.getByRole("dialog", { name: "Общий шаблон", exact: true });
  await expect(editor).toBeVisible();
  const constructor = editor.locator('[data-trainer-constructor="true"]');
  await constructor.getByRole("button", { name: /^Действия:/ }).first().click();
  await page.getByRole("dialog", { name: "Действия с упражнением", exact: true }).getByRole("button", { name: "Дополнительные параметры", exact: true }).click();
  await expectReadOnlyProgramVideo(page.getByRole("dialog", { name: "Настройки упражнения", exact: true }));
  await page.getByTestId("trainer-program-exercise-video").scrollIntoViewIfNeeded();
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: `output/playwright/program-settings-865-template-${info.project.name}.png` });
  assertNoRuntimeErrors();
});

test("trainer exercise settings keep three sets reachable with a persistent program return button", async ({ page }) => {
  test.setTimeout(120_000);
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?trainerHarness=1", { waitUntil: "domcontentloaded" });
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");
  await page.locator(".trainerClientProgramEditButton").click();

  const editorDialog = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await expect(editorDialog).toBeVisible();
  await selectClientProgramDay(editorDialog, 2);
  await openClientExerciseSettings(page, editorDialog);
  const exerciseSheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  await expect(exerciseSheet).toBeVisible();
  const expandedExerciseEditor = exerciseSheet.getByRole("region", { name: "Нагрузка по подходам", exact: true });
  const setRows = expandedExerciseEditor.locator('[class*="setRow"]');
  await expect(setRows).toHaveCount(2);
  for (let setCount = await setRows.count(); setCount < 3; setCount += 1) {
    await expandedExerciseEditor.getByRole("button", { name: "Добавить подход", exact: true }).click();
    await expect(setRows).toHaveCount(setCount + 1);
  }
  await expect(setRows).toHaveCount(3);

  const deleteExerciseButton = exerciseSheet.getByRole("button", { name: "Удалить из тренировки", exact: true });
  await expect(deleteExerciseButton).toBeEnabled();
  await expectClientExerciseSettingsReachable(page, exerciseSheet, setRows);
  assertNoRuntimeErrors();
});

test("trainer program editor applies confirmed exercise and day deletion", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-07-10T12:00:00.000Z") });
  await page.goto("/?trainerHarness=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const calendar = await openClientCalendar(page);
  const scheduleSessions = calendar.getByRole("tabpanel", { name: "Расписание", exact: true }).locator("button[aria-pressed]");
  await expect(scheduleSessions).toHaveCount(3);
  await expect(scheduleSessions.filter({ hasText: "арх." })).toHaveCount(0);
  await expect(scheduleSessions.filter({ hasText: "Прошлая программа" })).toHaveCount(0);
  await closeClientUtilitySheet(page, "Расписание и абонемент");

  const insightsDialog = await openWorkoutInsights(page);
  await insightsDialog.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true }).click();
  const reviewDialog = page.getByRole("dialog", { name: "Нужна ли корректировка?" });
  await expect(reviewDialog).toBeVisible();
  await reviewDialog.locator("[data-trainer-modal-footer] button").last().click();

  const editorDialog = page.getByRole("dialog", { name: "Редактор программы клиента" });
  await expect(editorDialog).toBeVisible();
  const exerciseRows = editorDialog.locator(".trainerNextExerciseList article");
  await expect(exerciseRows).toHaveCount(1);
  const loadToggle = exerciseRows.first().getByRole("button", { name: /^(Настроить|Свернуть) нагрузку:/ });
  if (await loadToggle.getAttribute("aria-expanded") !== "true") await loadToggle.click();
  await exerciseRows.first().locator("summary").filter({ hasText: "История выполнения" }).click();
  await expect(exerciseRows.first()).toContainText("1ПМ");
  const editExerciseButton = exerciseRows.first().getByRole("button", { name: /^Действия:/ });
  const editActionBox = await editExerciseButton.boundingBox();
  expect(editActionBox).not.toBeNull();
  expect(editActionBox.x + editActionBox.width).toBeLessThanOrEqual(page.viewportSize().width);

  await editorDialog.locator("summary").filter({ hasText: "Параметры дня" }).click();
  const statusSelect = editorDialog.getByLabel("Статус тренировки");
  await statusSelect.selectOption("moved");
  await expect(statusSelect).toHaveValue("moved");
  await expect(editorDialog.getByLabel("Новая дата")).toBeVisible();

  await openClientExerciseSettings(page, editorDialog);
  const exerciseSheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  await expect(exerciseSheet).toBeVisible();
  const expandedExerciseEditor = exerciseSheet.getByRole("region", { name: "Нагрузка по подходам", exact: true });
  await expect(expandedExerciseEditor).toBeVisible();
  const setRows = expandedExerciseEditor.locator('[class*="setRow"]');
  await expect(setRows).toHaveCount(2);
  const [firstSetBox, secondSetBox] = await Promise.all([
    setRows.first().boundingBox(),
    setRows.nth(1).boundingBox()
  ]);
  expect(firstSetBox).not.toBeNull();
  expect(secondSetBox).not.toBeNull();
  expect(secondSetBox.y).toBeGreaterThan(firstSetBox.y);
  expect(Math.abs(secondSetBox.x - firstSetBox.x)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);

  const deleteExerciseButton = exerciseSheet.getByRole("button", { name: "Удалить из тренировки", exact: true });
  await expect(deleteExerciseButton).toBeEnabled();
  await expectClientExerciseSettingsReachable(page, exerciseSheet, setRows);
  await deleteExerciseButton.click();
  let confirmDialog = page.locator(".trainerConfirmDialog");
  await expect(confirmDialog).toBeVisible();
  const confirmClose = confirmDialog.getByRole("button", { name: "Закрыть", exact: true });
  const closeHitTargets = await confirmClose.evaluate(button => {
    const rect = button.getBoundingClientRect();
    return {
      width: rect.width, height: rect.height,
      hits: [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([x, y]) =>
        button.contains(document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y)))
    };
  });
  expect(closeHitTargets.width).toBeGreaterThanOrEqual(44);
  expect(closeHitTargets.height).toBeGreaterThanOrEqual(44);
  expect(closeHitTargets.hits).toEqual([true, true, true, true, true]);
  const closeBox = await confirmClose.boundingBox();
  await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
  await expect(confirmDialog).toBeHidden();
  await expect(exerciseRows).toHaveCount(1);
  await openClientExerciseSettings(page, editorDialog);
  await deleteExerciseButton.click();
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.locator("button.danger").click();
  await expect(confirmDialog).toBeHidden();
  await expect(exerciseRows).toHaveCount(0);

  const deleteDayButton = editorDialog.getByRole("button", { name: "Удалить тренировку", exact: true });
  await deleteDayButton.click();
  confirmDialog = page.locator(".trainerConfirmDialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(editorDialog.locator(".trainerNextWorkoutDayItem")).toHaveCount(3);
  await deleteDayButton.click();
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.locator("button.danger").click();
  await expect(confirmDialog).toBeHidden();
  await expect(editorDialog.locator(".trainerNextWorkoutDayItem")).toHaveCount(2);
  assertNoRuntimeErrors();
});

test("trainer editor shows an exact completed workout id as completed after an assignment marker refresh", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1&completedHistoryVersionMismatch=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");
  await openClientCalendar(page);
  await expect(page.getByRole("dialog", { name: "Расписание и абонемент", exact: true })).toContainText("2 из 3 выполнено · по датам");
  await closeClientUtilitySheet(page, "Расписание и абонемент");
  await page.locator(".trainerClientProgramEditButton").click();

  const editorDialog = page.getByRole("dialog", { name: "Редактор программы клиента" });
  await expect(editorDialog).toBeVisible();
  const completedDay = editorDialog.locator(".trainerNextWorkoutDayItem").filter({ hasText: "Тренировка 3" });
  await expect(completedDay).toHaveClass(/completed/);
  await expect(completedDay).toContainText("Выполнена");
  await expect(completedDay).not.toContainText("Запланирована");
  assertNoRuntimeErrors();
});

test("trainer mobile primary navigation opens Cabinet directly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "This assertion covers the compact four-item primary navigation.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");

  await expect(page.getByTestId("trainer-nav-more")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("trainer-nav-more").click();
  await expect(page.locator(".trainerNextCabinetPage")).toBeVisible();
  await expect(page.locator(".trainerNextMoreDrawer")).toHaveCount(0);
  assertNoRuntimeErrors();
});

test("trainer archives and restores assignments without deleting client programs", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1&programAssignments=1&emptyHistoricalProgram=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const assignmentHistory = await openProgramAssignmentHistory(page);
  const pastProgram = assignmentHistory.locator("article").filter({ hasText: "Предыдущая программа" });
  const currentProgram = assignmentHistory.locator("article").filter({ hasText: "tren+" });
  const futureProgram = assignmentHistory.locator("article").filter({ hasText: "Поддержка" });
  const oldEmptyProgram = assignmentHistory.locator("article").filter({ hasText: "Старая пустая программа" });
  const programsTab = assignmentHistory.getByRole("tab", { name: /^Программы/ });
  const archiveTab = assignmentHistory.getByRole("tab", { name: /^Архив/ });

  await expect(programsTab).toHaveAttribute("aria-selected", "true");
  await expect(archiveTab).toContainText("0");
  await oldEmptyProgram.locator('button[aria-expanded]').click();
  await oldEmptyProgram.getByRole("button", { name: "Убрать в архив", exact: true }).click();
  await page.getByRole("dialog", { name: "Убрать программу в архив?" }).getByRole("button", { name: "Убрать в архив", exact: true }).click();
  await expect(oldEmptyProgram).toHaveCount(0);
  await archiveTab.click();
  await expect(archiveTab).toContainText("1");
  await oldEmptyProgram.locator('button[aria-expanded]').click();
  await expect(oldEmptyProgram.getByRole("button", { name: "Удалить пустую программу" })).toBeVisible();
  await expect(oldEmptyProgram.getByRole("button", { name: "Вернуть из архива" })).toBeVisible();
  await programsTab.click();

  await pastProgram.locator('button[aria-expanded]').click();
  await expect(pastProgram.getByRole("button", { name: "Вернуть программу в план" })).toBeVisible();
  await expect(pastProgram.getByRole("button", { name: "Удалить пустую программу" })).toHaveCount(0);
  await futureProgram.locator('button[aria-expanded]').click();
  await expect(pastProgram.locator('button[aria-expanded]')).toHaveAttribute("aria-expanded", "false");
  await futureProgram.getByRole("button", { name: "Убрать в архив", exact: true }).click();
  const futureArchiveDialog = page.getByRole("dialog", { name: "Убрать программу в архив?" });
  await expect(futureArchiveDialog).toBeVisible();
  await futureArchiveDialog.getByRole("button", { name: "Убрать в архив", exact: true }).click();
  await archiveTab.click();
  await futureProgram.locator('button[aria-expanded]').click();
  await expect(futureProgram.getByRole("button", { name: "Вернуть из архива", exact: true })).toBeVisible();
  await futureProgram.getByRole("button", { name: "Вернуть из архива", exact: true }).click();
  const restoreDialog = page.getByRole("dialog", { name: "Вернуть программу из архива?" });
  await expect(restoreDialog).toContainText("отметками выполнения");
  await restoreDialog.getByRole("button", { name: "Вернуть программу", exact: true }).click();
  await expect(futureProgram).toHaveCount(0);
  await programsTab.click();
  await futureProgram.locator('button[aria-expanded]').click();
  await expect(futureProgram.getByRole("button", { name: "Убрать в архив", exact: true })).toBeVisible();

  await currentProgram.getByRole("button", { name: "Посмотреть программу", exact: true }).click();
  await currentProgram.getByRole("button", { name: "Убрать в архив", exact: true }).click();
  const archiveDialog = page.getByRole("dialog", { name: "Убрать программу в архив?" });
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole("button", { name: "Убрать в архив", exact: true }).click();
  await archiveTab.click();
  await expect(assignmentHistory.locator("article").filter({ hasText: "tren+" })).toContainText("В архиве");
  await expect(oldEmptyProgram).toBeVisible();
  assertNoRuntimeErrors();
});

test("trainer can save without a program while preserving assignments and workout history", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1&programAssignments=1&basicHistory=1&withoutProgramAudit=1", { waitUntil: "domcontentloaded", timeout: 40_000 });
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");
  const readSnapshot = async () => JSON.parse(await page.getByTestId("without-program-snapshot").textContent());
  const original = await readSnapshot();
  const assignmentDisclosure = page.locator(".trainerClientAssignmentDisclosure");
  await assignmentDisclosure.locator("summary").click();
  const programSelect = page.getByLabel("Назначить программу клиенту");
  await expect(programSelect.locator("option:not([disabled])").first()).toHaveText("Без программы");

  await programSelect.selectOption("__without_program__");
  await assignmentDisclosure.getByRole("button", { name: "Сохранить", exact: true }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Без программы?", exact: true });
  await expect(confirmDialog).toContainText("история и абонемент сохранятся");
  await expectNoHorizontalOverflow(page);
  expect(await confirmDialog.getByRole("button", { name: "Сохранить", exact: true }).evaluate(button => getComputedStyle(button).backgroundImage)).toContain("linear-gradient");
  await mkdir("output/without-program-3.0.949", { recursive: true });
  await confirmDialog.screenshot({ path: `output/without-program-3.0.949/confirm-${testInfo.project.name}.png` });
  await confirmDialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(confirmDialog).toBeHidden();
  expect(await readSnapshot()).toEqual(original);
  await expect(programSelect).toHaveValue("__without_program__");

  // Choosing an ordinary template still opens the existing adjustment flow.
  await programSelect.selectOption("program_support");
  await assignmentDisclosure.getByRole("button", { name: "Назначить", exact: true }).click();
  const adjustmentModal = page.getByRole("dialog", { name: "Корректировка под клиента", exact: true });
  await expect(adjustmentModal).toBeVisible();
  await adjustmentModal.getByRole("button", { name: "Закрыть окно корректировки", exact: true }).click();
  expect(await readSnapshot()).toEqual(original);

  await programSelect.selectOption("__without_program__");
  await assignmentDisclosure.getByRole("button", { name: "Сохранить", exact: true }).click();
  await confirmDialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Нет активной программы", exact: true })).toBeVisible();
  await expect(assignmentDisclosure.getByRole("button", { name: "Сохранить", exact: true })).toBeDisabled();

  const saved = await readSnapshot();
  expect(saved.client).toMatchObject({ assignedProgramId: "", assignedProgramName: "", assignedWorkoutCount: 0 });
  expect(saved.history).toEqual(original.history);
  expect(saved.client.subscription).toEqual(original.client.subscription);
  const originalWorkouts = [...original.workouts, ...original.archivedWorkouts];
  const savedWorkouts = [...saved.workouts, ...saved.archivedWorkouts];
  expect(savedWorkouts.map(workout => workout.id).sort()).toEqual(originalWorkouts.map(workout => workout.id).sort());
  for (const workout of originalWorkouts) {
    const savedWorkout = savedWorkouts.find(item => item.id === workout.id);
    if (workout.source === "basic") expect(savedWorkout).toEqual(workout);
    else {
      expect(savedWorkout).toMatchObject(workout);
      expect(savedWorkout.assignedProgramLifecycleStatus).toBe("archived");
    }
  }

  const assignmentHistory = await openProgramAssignmentHistory(page);
  await expect(assignmentHistory.getByRole("heading", { name: "Нет текущей программы", exact: true })).toBeVisible();
  await assignmentHistory.getByRole("tab", { name: /^Архив/ }).click();
  for (const name of ["tren+", "Поддержка", "Предыдущая программа"]) {
    await expect(assignmentHistory.locator("article").filter({ hasText: name })).toBeVisible();
  }
  await closeClientUtilitySheet(page, "История программ");
  const workoutHistory = await openWorkoutInsights(page);
  await expect(workoutHistory.locator("article")).toHaveCount(original.history.length);
  assertNoRuntimeErrors();
});

test("trainer can retry saving without a program after a failed save without losing data", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1&programAssignments=1&withoutProgramAudit=1&withoutProgramFailure=1", { waitUntil: "domcontentloaded", timeout: 40_000 });
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");
  const snapshot = page.getByTestId("without-program-snapshot");
  const original = JSON.parse(await snapshot.textContent());
  const assignmentDisclosure = page.locator(".trainerClientAssignmentDisclosure");
  await assignmentDisclosure.locator("summary").click();
  await page.getByLabel("Назначить программу клиенту").selectOption("__without_program__");
  await assignmentDisclosure.getByRole("button", { name: "Сохранить", exact: true }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Без программы?", exact: true });
  await confirmDialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(confirmDialog.getByRole("alert")).toContainText("Не удалось сохранить вариант «Без программы»");
  expect(JSON.parse(await snapshot.textContent())).toEqual(original);
  await expect(page.getByRole("heading", { name: "Нет активной программы", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Назначить программу клиенту")).toHaveValue("__without_program__");
  await confirmDialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Нет активной программы", exact: true })).toBeVisible();
  assertNoRuntimeErrors();
});

test("trainer calendar is isolated to the current assignment", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1&programAssignments=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");
  await openClientCalendar(page);

  const schedule = page.locator(".trainerWorkoutSchedulePlanner");
  await expect(schedule).toContainText("1 из 3 выполнено · по датам");
  const sessions = schedule.getByRole("tabpanel", { name: "Расписание", exact: true }).locator("button[aria-pressed]");
  await expect(sessions).toHaveCount(3);
  await expect(sessions.filter({ hasText: "Будущая тренировка" })).toHaveCount(0);
  assertNoRuntimeErrors();
});

test("trainer schedules a newly assigned program in a modal and it stays future until completion", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-08-01T12:00:00.000Z") });
  await page.goto("/?trainerHarness=1&scheduleReady=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const assignmentDisclosure = page.locator(".trainerClientAssignmentDisclosure");
  await assignmentDisclosure.locator("summary").filter({ hasText: /^Назначить другую программу/ }).click();
  await expect(assignmentDisclosure).toHaveAttribute("open", "");
  await page.getByLabel("Назначить программу клиенту").selectOption("program_support");
  await page.getByRole("button", { name: "Назначить", exact: true }).click();

  const adjustmentModal = page.getByRole("dialog", { name: "Корректировка под клиента" });
  await expect(adjustmentModal).toBeVisible();
  await adjustmentModal.getByRole("button", { name: "Назначить программу", exact: true }).click();

  const scheduleModal = page.getByRole("dialog", { name: "Поддержка — Germes", exact: true });
  await expect(scheduleModal).toBeVisible();
  await expect(scheduleModal).toContainText("РАСПИСАНИЕ ПРОГРАММЫ");
  const saveDates = scheduleModal.getByRole("button", { name: "Сохранить даты", exact: true });
  await expect(saveDates).toBeDisabled();
  await scheduleModal.getByLabel("Начиная с", { exact: true }).fill("2026-08-17");
  for (const day of ["Пн", "Ср", "Пт"]) await scheduleModal.getByRole("checkbox", { name: day, exact: true }).check();
  await expect(scheduleModal.getByLabel("Новая дата — Тренировка 1", { exact: true })).toHaveValue("2026-08-17");
  await expect(scheduleModal.getByLabel("Новая дата — Тренировка 2", { exact: true })).toHaveValue("2026-08-19");
  await expect(scheduleModal.getByLabel("Новая дата — Тренировка 3", { exact: true })).toHaveValue("2026-08-21");
  await expect(saveDates).toBeEnabled();
  await saveDates.click();
  await expect(scheduleModal).toBeHidden();

  const assignmentHistory = await openProgramAssignmentHistory(page);
  const futureProgram = assignmentHistory.locator("article").filter({ hasText: "Поддержка" }).last();
  await expect(futureProgram).toContainText("Ещё не начата · выполнено 0 из 3");
  assertNoRuntimeErrors();
});

test("trainer program editor contains only the current assignment", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1&programAssignments=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  await page.locator(".trainerClientProgramEditButton").click();
  const editor = page.getByRole("dialog", { name: "Редактор программы клиента" });
  await expect(editor).toBeVisible();
  await expect(editor.locator(".trainerNextWorkoutDayItem")).toHaveCount(3);
  assertNoRuntimeErrors();
});

test("trainer calendar and assignment history hide client basic plans until explicitly requested", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00.000Z"));
  await page.goto("/?trainerHarness=1&basicHistory=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const calendar = await openClientCalendar(page);
  const schedule = calendar.locator(".trainerWorkoutSchedulePlanner");
  await expect(schedule).toContainText("1 из 3 выполнено · по датам");
  await expect(schedule.getByRole("tabpanel", { name: "Расписание", exact: true }).locator("button[aria-pressed]")).toHaveCount(3);
  await expect(schedule).not.toContainText("Базовая тренировка");
  await calendar.getByRole("tab", { name: "Абонемент", exact: true }).click();
  const calendarLegend = calendar.locator('[aria-label="Обозначения календаря"]');
  await expect(calendarLegend).toBeVisible();
  await expect(calendarLegend).toContainText("Выполнено");
  await expect(calendarLegend).toContainText("Запланировано");
  await calendar.getByRole("button", { name: "Предыдущий месяц", exact: true }).click();
  const basicDay = calendar.locator('[data-date="2026-06-04"]');
  await expect(basicDay).toBeVisible();
  await expect(basicDay).toHaveAttribute("aria-label", /нет занятий$/);
  await expect(basicDay.locator("[data-event-status]")).toHaveCount(0);
  await closeClientUtilitySheet(page, "Расписание и абонемент");

  const assignmentHistory = await openProgramAssignmentHistory(page);
  const basicProgram = assignmentHistory.locator("article").filter({ hasText: "Базовый план клиента" });
  const toggle = assignmentHistory.getByRole("checkbox", { name: "Показывать самостоятельные планы" });

  await expect(toggle).not.toBeChecked();
  await expect(basicProgram).toHaveCount(0);
  await toggle.check();
  await expect(basicProgram).toBeVisible();
  await expect(basicProgram).toContainText("Самостоятельный план");
  await toggle.uncheck();
  await expect(basicProgram).toHaveCount(0);
  assertNoRuntimeErrors();
});

test("trainer program editing, read-only assignment view and libraries stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");

  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  const history = await openProgramAssignmentHistory(page);
  const current = history.getByRole("region", { name: "Текущая программа клиента", exact: true });
  await current.getByRole("button", { name: "Посмотреть программу", exact: true }).click();
  const viewedWorkouts = current.getByRole("list", { name: "Тренировки программы: tren+", exact: true }).locator(":scope > li");
  await expect(viewedWorkouts).toHaveCount(3);
  await expect(current.getByText("Только просмотр", { exact: true })).toBeVisible();
  await viewedWorkouts.first().locator("summary").click();
  await expect(viewedWorkouts.first().locator("ol > li")).toHaveCount(2);
  await expect(viewedWorkouts.first()).toContainText("Жим ногами");
  await expect(viewedWorkouts.first()).toContainText("12 повт.");
  await expect(viewedWorkouts.first()).toContainText("90 кг");
  await closeClientUtilitySheet(page, "История программ");

  await openExerciseSection(page, "План тренировок");
  await page.locator(".trainerClientProgramEditButton").click();
  const clientEditor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await expect(clientEditor.locator(".trainerNextWorkoutLayout")).toBeVisible();
  await expect(clientEditor.locator(".trainerNextWorkoutDayItem")).toHaveCount(3);
  await selectClientProgramDay(clientEditor, 0);
  await expect(clientEditor.locator(".trainerNextWorkoutDaySelect[aria-pressed='true']")).toHaveCount(1);
  await expect(clientEditor.locator(".trainerNextExerciseList article")).toHaveCount(2);
  const firstExerciseNameButton = clientEditor.getByRole("button", { name: /^(Посмотреть|Свернуть) нагрузку: Жим ногами$/ });
  await expect(firstExerciseNameButton).toBeVisible();
  const nameBox = await firstExerciseNameButton.boundingBox();
  expect(nameBox.width).toBeGreaterThan(0);
  if (page.viewportSize().width >= 980) expect(nameBox.width).toBeGreaterThanOrEqual(44);
  if (await firstExerciseNameButton.getAttribute("aria-expanded") !== "true") await firstExerciseNameButton.click();
  await expect(clientEditor.getByLabel("Повторы: Жим ногами", { exact: true })).toBeDisabled();
  await selectClientProgramDay(clientEditor, 2);
  await page.screenshot({ path: test.info().outputPath("program-plan-after.png"), fullPage: true });
  const editableReps = clientEditor.getByLabel("Повторы: Жим ногами", { exact: true });
  await expect(editableReps).toBeEditable();
  await editableReps.fill("10");
  await expect(editableReps).toHaveValue("10");
  await editableReps.fill("12");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
  await clientEditor.getByRole("button", { name: "Закрыть редактор", exact: true }).click();
  await expect(clientEditor).toBeHidden();

  await page.getByRole("button", { name: "Назад к списку клиентов", exact: true }).click();
  await clickTrainerNav(page, "library");
  await expect(page.locator(".trainerNextLibrary")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Упражнения", exact: true })).toBeVisible();
  await expect(page.locator(".trainerNextLibrary article")).toHaveCount(3);
  const firstExerciseName = await page.locator(".trainerNextLibrary article strong").first().textContent();
  await page.getByRole("searchbox", { name: "Поиск упражнений", exact: true }).fill((firstExerciseName || "").slice(0, 4));
  await expect(page.locator(".trainerNextLibrary article").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await openTrainerPrograms(page);
  await expect(page.getByRole("searchbox", { name: "Найти программу" })).toBeVisible();
  await expect(page.getByRole("button", { name: /tren\+/ })).toBeVisible();
  await page.getByRole("checkbox", { name: "Тестовые программы", exact: true }).check();
  await expect(page.getByRole("button", { name: /tren\+/ })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Тестовые программы", exact: true }).uncheck();
  await page.getByRole("button", { name: /tren\+/ }).click();
  await expect(page.getByRole("button", { name: /tren\+/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать шаблон", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Редактировать/ }).click();
  const programEditor = page.getByRole("dialog", { name: "Общий шаблон", exact: true });
  await expect(programEditor).toBeVisible();
  await expect(programEditor.getByRole("textbox").first()).toHaveValue("tren+");
  const constructor = programEditor.locator('[data-trainer-constructor="true"]');
  await expect(constructor).toBeVisible();
  const constructorDayPicker = constructor.getByRole("combobox", { name: "День программы", exact: true });
  if (await constructorDayPicker.isVisible()) {
    await expect(constructorDayPicker.locator("option")).toHaveCount(3);
    await constructorDayPicker.selectOption({ index: 2 });
  } else {
    await expect(constructor.getByRole("heading", { name: /^Дни программы/ })).toBeVisible();
    await constructor.getByRole("button", { name: /^Тренировка 3 1 упр\./ }).click();
  }
  await expect(constructor.getByRole("textbox", { name: "Название тренировки", exact: true })).toHaveValue("Тренировка 3");
  await expect(constructor.getByRole("button", { name: "Добавить из библиотеки", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
