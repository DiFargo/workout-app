import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

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

async function clickIfVisible(locator) {
  if (await locator.count() && await locator.first().isVisible()) {
    await locator.first().click();
    return true;
  }
  return false;
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
    "Уведомления": "🔔 Настроить уведомления"
  };
  if (name === "Сообщения") await openClientTab(page, "Сводка");
  if (name === "Уведомления") await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
  const utilityAction = page.getByRole("button", { name: utilityLabels[name] || name, exact: true });
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

test("trainer workspace smoke: dashboard, clients and client card stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  const main = page.locator(".trainerNextMain");

  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  await expect(main.locator("h1")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickTrainerNav(page, "clients");
  await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  await expect(main.locator("h1")).toHaveCount(1);
  await expect(page.getByText("Germes")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await openHarnessClient(page);
  await openClientTab(page, "Сводка");
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expectClientNavigation(page);
  const subscriptionStatus = page.locator(".trainerNextClientSubscriptionStatus");
  const subscriptionStatusBox = await subscriptionStatus.boundingBox();
  expect(subscriptionStatusBox).not.toBeNull();
  // The current mobile card fills the content width (288px at a 320px viewport).
  // Keep the containment check without pinning the previous pill's width.
  expect(subscriptionStatusBox.x).toBeGreaterThanOrEqual(0);
  expect(subscriptionStatusBox.x + subscriptionStatusBox.width).toBeLessThanOrEqual(page.viewportSize().width);
  await expect(page.getByTestId("trainer-client-progress-dashboard").locator("button[aria-pressed='true']")).toHaveCount(2);

  await page.getByRole("button", { name: "Открыть абонемент клиента" }).click();
  const subscriptionDialog = page.getByRole("dialog", { name: "Календарь тренировок" });
  await expect(subscriptionDialog.getByRole("region", { name: "Параметры абонемента" })).toBeVisible();
  await expect(subscriptionDialog.getByLabel("Куплено тренировок")).toBeEditable();
  await subscriptionDialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(subscriptionDialog).toBeHidden();

  await openExerciseSection(page, "Прогресс упражнений");
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(page.locator(".trainerExerciseProgressToolbar button[aria-pressed='true']")).toHaveCount(1);

  await openExerciseSection(page, "План тренировок");
  await openClientCalendar(page);
  await expect(page.locator(".trainerWorkoutScheduleGrid")).toBeVisible();
  await expect(page.locator('[aria-label="Типы календарных отметок"]')).toBeVisible();
  await closeClientUtilitySheet(page, "Расписание и абонемент");
  const currentProgramCard = page.locator('[class*="currentProgram"]').filter({ hasText: "Назначенная программа" }).first();
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

  await page.getByRole("button", { name: "Действия с клиентом", exact: true }).click();
  await expect(page.locator(".trainerClientActionSheet")).toBeVisible();
  await expect(page.getByRole("button", { name: /Архивировать клиента|Восстановить клиента/ })).toBeVisible();
  await page.locator(".trainerClientActionSheet header button").click();
  await expect(page.locator(".trainerClientActionSheet")).toBeHidden();
  assertNoRuntimeErrors();

  await openClientTab(page, "Питание");
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  const nutritionControl = await clientTabControl(page, "Питание");
  await expect(nutritionControl.button).toHaveAttribute(nutritionControl.activeAttribute, nutritionControl.activeValue);
  await expect(page.locator(".trainerNutritionPeriodButtons button[aria-pressed='true']")).toHaveCount(1);
  await page.getByRole("button", { name: "Дневник", exact: true }).click();
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

test("training calendar makes a finished workout plan primary and subscription secondary", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/?trainerHarness=1&scheduleReady=1", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await page.getByRole("button", { name: "Открыть абонемент клиента" }).click();

  const dialog = page.getByRole("dialog", { name: "Календарь тренировок" });
  await expect(dialog.getByRole("heading", { name: "Программа тренировок завершена" })).toBeVisible();
  await expect(dialog).toContainText("В текущем плане больше нет предстоящих тренировок.");
  await expect(dialog).toContainText("Абонемент также закончился");
  await expect(dialog.locator(".trainerNotificationCalendarUnified > header > strong")).toContainText("План завершён");
  await expect(dialog.locator(".trainerNotificationCalendarUnified > header > strong")).toContainText("абонемент закончился");
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
  await expect(messagesPanel.getByRole("heading", { name: /^(Новые )?Сообщения$/ })).toBeVisible();
  await expect(page.locator(".trainerNextNoteCard")).toHaveCount(0);
  await expect(page.getByText("Тестовая заметка", { exact: true })).toHaveCount(0);
  await expect(messagesPanel.getByText("Задания клиенту", { exact: true })).toHaveCount(0);

  let filters = messagesPanel.getByRole("navigation", { name: "Фильтры сообщений клиента" });
  await expect(filters).toBeVisible();
  await expect(filters.getByRole("button")).toHaveCount(3);
  await expect(filters.getByRole("button", { name: /^Ждут ответа/ })).toHaveAttribute("aria-pressed", "true");

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
  await expect(filters.getByRole("button", { name: /^Ждут ответа/ })).toContainText("1");
  await expect(filters.getByRole("button", { name: /^Обработаны/ })).toContainText("1");

  await messagesPanel.getByRole("button", { name: "Обработать все", exact: true }).click();
  await expect(filters.getByRole("button", { name: /^Ждут ответа/ })).toContainText("0");
  await expect(filters.getByRole("button", { name: /^Обработаны/ })).toContainText("2");
  await expect(messagesPanel.getByRole("button", { name: "Обработать все", exact: true })).toHaveCount(0);

  await filters.getByRole("button", { name: /^Обработаны/ }).click();
  await expect(filters.getByRole("button", { name: /^Обработаны/ })).toHaveAttribute("aria-pressed", "true");
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
  await expect(insightsDialog.locator(".trainerClientWorkoutReviewPanel")).toContainText("Проверено тренером");
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
  const review = history.locator(".trainerClientWorkoutReviewPanel");
  await expect(review).toContainText("Текущий сигнал: снизил вес на жиме.");
  await expect(review).not.toContainText("Устаревший сигнал из архивной программы.");
  await expect(review).not.toContainText("Сигнал из самостоятельного базового плана.");
  // The full history still contains these newer records; only the actionable
  // review is restricted to the current trainer assignment.
  await expect(history).toContainText("Устаревший сигнал из архивной программы.");
  await expect(history).toContainText("Сигнал из самостоятельного базового плана.");
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
  await editor.getByRole("button", { name: "Редактировать упражнение", exact: true }).click();
  const exerciseSheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  await exerciseSheet.getByLabel("Вес, подход 1", { exact: true }).fill("65");
  await expect(exerciseSheet.getByLabel("Вес, подход 1", { exact: true })).toHaveValue("65");
  await expect(exerciseSheet.getByLabel("Вес, подход 2", { exact: true })).toHaveValue("70");
  await exerciseSheet.getByRole("button", { name: "Готово", exact: true }).click();
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();

  history = await openWorkoutInsights(page);
  await expect(history.locator(".trainerClientWorkoutReviewPanel")).toContainText("Проверено тренером");
  await expect(history.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true })).toHaveCount(0);
  await closeClientUtilitySheet(page, "История тренировок");

  await page.locator(".trainerClientProgramEditButton").click();
  const dayPicker = editor.getByRole("combobox", { name: "День программы", exact: true });
  if (await dayPicker.isVisible()) await dayPicker.selectOption({ index: 2 });
  else await editor.getByRole("button", { name: /^День 3 / }).click();
  await expect(editor.getByRole("button", { name: "Вес: разные по подходам. Жим ногами", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Редактировать упражнение", exact: true }).click();
  await expect(exerciseSheet.getByLabel("Вес, подход 1", { exact: true })).toHaveValue("65");
  await expect(exerciseSheet.getByLabel("Вес, подход 2", { exact: true })).toHaveValue("70");
  await exerciseSheet.getByRole("button", { name: "Готово", exact: true }).click();
  if (await dayPicker.isVisible()) await dayPicker.selectOption({ index: 0 });
  else await editor.getByRole("button", { name: /^День 1 Выполнена/ }).click();
  await expect(editor.getByLabel("Вес: Жим ногами", { exact: true })).toHaveValue("90");
  await expect(editor.getByLabel("Вес: Жим ногами", { exact: true })).toBeDisabled();
  await expect(editor.getByLabel("Статус тренировки", { exact: true })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
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
  const scheduleGrid = calendar.locator(".trainerWorkoutScheduleGrid");
  await expect(scheduleGrid).toBeVisible();
  await expect(scheduleGrid).not.toContainText("арх.");
  await expect(scheduleGrid.locator("button.archived")).toHaveCount(0);
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
  await expect(exerciseRows.first().locator(".trainerNextExerciseProgress")).toContainText("1ПМ");
  const editExerciseButton = exerciseRows.first().getByRole("button", { name: "Редактировать упражнение", exact: true });
  const editActionBox = await editExerciseButton.boundingBox();
  expect(editActionBox).not.toBeNull();
  expect(editActionBox.x + editActionBox.width).toBeLessThanOrEqual(page.viewportSize().width);

  const statusSelect = editorDialog.getByLabel("Статус тренировки");
  await statusSelect.selectOption("moved");
  await expect(statusSelect).toHaveValue("moved");
  await expect(editorDialog.getByLabel("Новая дата")).toBeVisible();

  await editExerciseButton.click();
  const exerciseSheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  await expect(exerciseSheet).toBeVisible();
  const expandedExerciseEditor = exerciseSheet.locator(".trainerNextExerciseEditor");
  await expect(expandedExerciseEditor).toBeVisible();
  const setRows = expandedExerciseEditor.locator(".trainerNextSetRow");
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

  const deleteExerciseButton = exerciseSheet.getByRole("button", { name: "Удалить упражнение", exact: true });
  await expect(deleteExerciseButton).toBeEnabled();
  await deleteExerciseButton.click();
  let confirmDialog = page.locator(".trainerConfirmDialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(exerciseRows).toHaveCount(1);
  await editExerciseButton.click();
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
  await expect(page.locator(".trainerWorkoutScheduleFooter")).toContainText("Выполнено: 2");
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
  await page.goto("/?trainerHarness=1&programAssignments=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const assignmentHistory = await openProgramAssignmentHistory(page);
  const pastProgram = assignmentHistory.locator("article").filter({ hasText: "Предыдущая программа" });
  const currentProgram = assignmentHistory.locator("article").filter({ hasText: "tren+" });
  const futureProgram = assignmentHistory.locator("article").filter({ hasText: "Поддержка" });

  await expect(pastProgram).toContainText("Архив");
  await expect(pastProgram.getByRole("button", { name: "Достать из архива" })).toBeVisible();
  await expect(currentProgram.getByRole("button", { name: "Архивировать", exact: true })).toBeVisible();
  await expect(futureProgram.getByRole("button", { name: "Архивировать", exact: true })).toBeVisible();

  await futureProgram.getByRole("button", { name: "Архивировать", exact: true }).click();
  const futureArchiveDialog = page.getByRole("dialog", { name: "Архивировать программу?" });
  await expect(futureArchiveDialog).toBeVisible();
  await futureArchiveDialog.getByRole("button", { name: "Архивировать", exact: true }).click();
  await expect(futureProgram.getByRole("button", { name: "Достать из архива", exact: true })).toBeVisible();

  await currentProgram.getByRole("button", { name: "Архивировать", exact: true }).click();
  const archiveDialog = page.getByRole("dialog", { name: "Архивировать программу?" });
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole("button", { name: "Архивировать", exact: true }).click();
  await expect(assignmentHistory.locator("article").filter({ hasText: "tren+" })).toContainText("Архив");
  await expect(page.locator('[class*="currentProgram"]').filter({ hasText: "Нет активной программы" }).first()).toBeVisible();
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
  await expect(schedule).toContainText("3/3");
  await expect(schedule).not.toContainText("3/4");
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
  await expect(scheduleModal).toContainText("0/3");
  await scheduleModal.locator('button[title="2026-08-17"]').click();
  await scheduleModal.locator('button[title="2026-08-19"]').click();
  await scheduleModal.locator('button[title="2026-08-21"]').click();
  await expect(scheduleModal).toContainText("3/3");
  await scheduleModal.getByRole("button", { name: "Сохранить даты", exact: true }).click();
  await expect(scheduleModal).toBeHidden();

  const assignmentHistory = await openProgramAssignmentHistory(page);
  const futureProgram = assignmentHistory.locator("article").filter({ hasText: "Поддержка" }).last();
  await expect(futureProgram).toContainText("Будущая");
  await expect(futureProgram).toContainText("ещё не начата");
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
  await page.goto("/?trainerHarness=1&basicHistory=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const calendar = await openClientCalendar(page);
  const schedule = calendar.locator(".trainerWorkoutSchedulePlanner");
  await expect(schedule).toContainText("3/3");
  const calendarLegend = calendar.locator('[aria-label="Типы календарных отметок"]');
  await expect(calendarLegend).toBeVisible();
  await expect(calendarLegend).toContainText("В срок");
  await expect(calendarLegend).toContainText("Плановая тренировка");
  await expect(schedule.locator('button[title="2026-06-04"]')).toHaveCount(0);
  await closeClientUtilitySheet(page, "Расписание и абонемент");

  const assignmentHistory = await openProgramAssignmentHistory(page);
  const basicProgram = assignmentHistory.locator("article").filter({ hasText: "Базовый план клиента" });
  const toggle = assignmentHistory.getByRole("checkbox", { name: "Показать историю базовых тренировок" });

  await expect(toggle).not.toBeChecked();
  await expect(basicProgram).toHaveCount(0);
  await toggle.check();
  await expect(basicProgram).toBeVisible();
  await expect(basicProgram).toContainText("Самостоятельно");
  await toggle.uncheck();
  await expect(basicProgram).toHaveCount(0);
  assertNoRuntimeErrors();
});

test("trainer programs page keeps editor, preview and library usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");

  await openTrainerPrograms(page);
  await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
  await expect(page.locator(".trainerNextMain h1")).toHaveCount(1);
  await expect(page.locator(".trainerNextWorkoutLayout")).toBeVisible();
  const dayPicker = page.getByRole("combobox", { name: "День программы", exact: true });
  const compactDays = await dayPicker.isVisible();
  if (compactDays) {
    await expect(dayPicker.locator("option")).toHaveCount(3);
    await expect(dayPicker).toHaveValue(await dayPicker.locator("option").first().getAttribute("value"));
  } else {
    await expect(page.locator(".trainerNextWorkoutDays .trainerNextWorkoutDayItem")).toHaveCount(3);
    await expect(page.locator(".trainerNextWorkoutDaySelect[aria-pressed='true']")).toHaveCount(1);
  }
  await expect(page.locator(".trainerNextExerciseList article")).toHaveCount(2);
  const firstExerciseNameButton = page.getByRole("button", { name: /^Жим ногами Без видео$/ });
  await expect(firstExerciseNameButton).toBeVisible();
  const nameBox = await firstExerciseNameButton.boundingBox();
  expect(nameBox.width).toBeGreaterThan(0);
  if (page.viewportSize().width >= 980) expect(nameBox.width).toBeGreaterThanOrEqual(44);
  if (compactDays) await dayPicker.selectOption({ index: 2 });
  else await page.locator(".trainerNextWorkoutDaySelect").nth(2).click();
  await page.screenshot({ path: test.info().outputPath("program-plan-after.png"), fullPage: true });
  await page.getByRole("button", { name: /^Жим ногами Без видео$/ }).click();
  await expect(page.locator(".trainerNextExerciseEditor")).toBeVisible();
  await page.locator(".trainerNextSetEditor input").first().fill("10");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  const desktopPreviewOpened = await clickIfVisible(page.locator(".trainerNextHeadActions button").first());
  if (!desktopPreviewOpened) {
    await page.locator(".trainerNextMobileHeader button").first().click();
  }
  await expect(page.locator(".trainerNextWorkoutPreview")).toBeVisible();
  await expect(page.locator(".trainerNextWorkoutPreview article")).toHaveCount(3);
  await page.locator(".trainerNextModalClose").click();
  await expect(page.locator(".trainerNextWorkoutPreview")).toBeHidden();

  await page.locator(".trainerNextPageTabs button").nth(1).click();
  await expect(page.locator(".trainerNextLibrary")).toBeVisible();
  await expect(page.locator(".trainerNextPageTabs button").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".trainerNextLibrary article")).toHaveCount(3);
  const firstExerciseName = await page.locator(".trainerNextLibrary article strong").first().textContent();
  await page.locator(".trainerNextLibrary input").fill((firstExerciseName || "").slice(0, 4));
  await expect(page.locator(".trainerNextLibrary article").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.locator(".trainerNextPageTabs button").first().click();
  await expect(page.getByRole("searchbox", { name: "Найти программу" })).toBeVisible();
  await expect(page.getByRole("button", { name: /tren\+/ })).toBeVisible();
  await page.getByRole("checkbox", { name: "Тестовые программы", exact: true }).check();
  await expect(page.getByRole("button", { name: /tren\+/ })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Тестовые программы", exact: true }).uncheck();
  await page.getByRole("button", { name: /tren\+/ }).click();
  await expect(page.getByRole("button", { name: /tren\+/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Редактировать/ }).click();
  const programEditor = page.getByRole("dialog", { name: "РЕДАКТОР ПРОГРАММЫ", exact: true });
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
  await expect(constructor.getByRole("button", { name: "Добавить упражнение", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
