import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

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
    "Сообщения": "Сообщения клиента",
    "Уведомления": "Уведомления клиента"
  };
  const utilityAction = page.getByRole("button", { name: utilityLabels[name], exact: true });
  return { button: utilityAction, utility: true };
}

async function expectClientNavigation(page) {
  if (await clientTabs(page).isVisible()) {
    await expect(clientTabs(page).getByRole("button")).toHaveCount(4);
    await expect(clientTabs(page).getByRole("button", { name: "Тренировки", exact: true })).toBeVisible();
    await expect(clientTabs(page).getByRole("button", { name: "Сообщения", exact: true })).toHaveCount(0);
    await expect(clientTabs(page).getByRole("button", { name: "Заметки", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Сообщения клиента", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Уведомления клиента", exact: true })).toBeVisible();
    await expect(page.locator(".trainerNextClientTabs button[aria-pressed='true']")).toHaveCount(1);
    return;
  }

  const mobileNav = page.locator(".trainerNextClientMobileNav");
  await expect(mobileNav.getByRole("button")).toHaveCount(4);
  await expect(mobileNav.getByRole("button", { name: "Тренировки", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сообщения клиента", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Уведомления клиента", exact: true })).toBeVisible();
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
  await openClientTab(page, "Тренировки");
  if (name === "Прогресс упражнений") {
    const button = page.getByRole("button", { name: "Открыть прогресс упражнений", exact: true });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole("dialog", { name: "Прогресс упражнений", exact: true })).toBeVisible();
    return;
  }

  await closeClientUtilitySheet(page, "Прогресс упражнений");
  await expect(page.locator(".trainerClientWorkoutPlan")).toBeVisible();
}

async function openWorkoutInsights(page) {
  const button = page.getByRole("button", { name: "Открыть разбор и историю тренировок", exact: false });
  await expect(button).toBeVisible();
  await button.click();

  const dialog = page.getByRole("dialog", { name: "Разбор и история тренировок", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openProgramAssignmentHistory(page) {
  const button = page.getByRole("button", { name: /^История программ/ });
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

test("trainer workspace smoke: dashboard, clients and client card stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  const main = page.locator(".trainerNextMain");

  await expect(page.locator(".trainerNextRoot")).toBeVisible();
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
  await openClientTab(page, "Обзор");
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expectClientNavigation(page);
  const subscriptionStatus = page.locator(".trainerNextClientSubscriptionStatus");
  const subscriptionStatusBox = await subscriptionStatus.boundingBox();
  expect(subscriptionStatusBox).not.toBeNull();
  expect(subscriptionStatusBox.width).toBeLessThanOrEqual(280);
  await expect(page.getByTestId("trainer-client-progress-dashboard").locator("button[aria-pressed='true']")).toHaveCount(1);

  await page.getByRole("button", { name: "Открыть редактирование абонемента" }).click();
  const subscriptionDialog = page.getByRole("dialog", { name: "Редактирование абонемента" });
  await expect(subscriptionDialog).toBeVisible();
  await subscriptionDialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(subscriptionDialog).toBeHidden();

  await openExerciseSection(page, "Прогресс упражнений");
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(page.locator(".trainerExerciseProgressToolbar button[aria-pressed='true']")).toHaveCount(1);

  await openExerciseSection(page, "План тренировок");
  await expect(page.locator(".trainerWorkoutScheduleGrid")).toBeVisible();
  await expect(page.locator(".trainerWorkoutScheduleLegend")).toBeVisible();
  const currentProgramCard = page.locator('[class*="currentProgram"]').filter({ hasText: "Назначенная программа" }).first();
  await expect(currentProgramCard.locator(".trainerClientProgramEditButton")).toBeVisible();
  await expect(page.locator('[class*="assignment"] .trainerClientProgramEditButton')).toHaveCount(0);
  await page.locator(".trainerClientProgramEditButton").click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModalBody")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModal")).toContainText("tren+");
  await page.locator(".trainerWorkoutEditorModal header button").click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByRole("button", { name: "Сообщения клиента", exact: true }).click();
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

  await page.getByRole("button", { name: "Действия", exact: true }).click();
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
  await page.locator(".trainerNutritionDiaryCollapsed").click();
  const diaryModal = page.getByRole("dialog", { name: "Записи клиента" });
  await expect(diaryModal).toBeVisible();
  await expect(diaryModal.locator(".trainerNutritionDiary aside button[aria-pressed='true']")).toHaveCount(1);
  await diaryModal.getByRole("button", { name: "Закрыть дневник" }).click();
  await expect(diaryModal).toBeHidden();
  await openClientTab(page, "Уведомления");
  await expect(page.locator(".trainerNotificationCalendarGrid")).toBeVisible();
  await expect(page.locator(".trainerNotificationLegend")).toBeVisible();
  await expect(page.locator(".trainerReminderPeriod button[aria-pressed='true']")).toHaveCount(2);
  await expect(page.locator(".trainerNotificationCalendarGrid button[aria-pressed='true']")).not.toHaveCount(0);
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
  await openClientTab(page, "Обзор");

  const tasksButton = page.getByRole("button", { name: "Задания клиенту", exact: true });
  await expect(tasksButton).toBeVisible();
  await tasksButton.click();
  const tasksSheet = page.getByRole("dialog", { name: "Задания клиенту", exact: true });
  await expect(tasksSheet).toBeVisible();
  await expect(tasksSheet.getByText("Назначения клиента", { exact: true })).toBeVisible();
  await expect(tasksSheet.getByText("Заполнить дневник самочувствия", { exact: true })).toBeVisible();
  const createTaskButton = tasksSheet.getByRole("button", { name: "Назначить задание", exact: true });
  await expect(createTaskButton).toBeVisible();
  await expect(createTaskButton).toHaveCSS("background-color", "rgb(143, 122, 200)");
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

test("trainer program editor applies confirmed exercise and day deletion", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.clock.install({ time: new Date("2026-07-10T12:00:00.000Z") });
  await page.goto("/?trainerHarness=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const insightsDialog = await openWorkoutInsights(page);
  await insightsDialog.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true }).click();
  const reviewDialog = page.getByRole("dialog", { name: "Нужна ли корректировка?" });
  await expect(reviewDialog).toBeVisible();
  await reviewDialog.locator("[data-trainer-modal-footer] button").last().click();

  const editorDialog = page.getByRole("dialog", { name: "Редактор программы клиента" });
  await expect(editorDialog).toBeVisible();
  await expect(page.locator(".trainerWorkoutScheduleGrid")).not.toContainText("арх.");
  await expect(page.locator(".trainerWorkoutScheduleGrid button.archived")).toHaveCount(0);
  const exerciseRows = editorDialog.locator(".trainerNextExerciseList article");
  await expect(exerciseRows).toHaveCount(1);
  await expect(exerciseRows.first().locator(".trainerNextExerciseProgress")).toContainText("1ПМ");
  const exerciseActionButtons = exerciseRows.first().locator(".trainerNextExerciseActions button");
  const [editActionBox, deleteActionBox] = await Promise.all([
    exerciseActionButtons.first().boundingBox(),
    exerciseActionButtons.last().boundingBox()
  ]);
  expect(editActionBox).not.toBeNull();
  expect(deleteActionBox).not.toBeNull();
  expect(Math.abs((editActionBox.y + editActionBox.height / 2) - (deleteActionBox.y + deleteActionBox.height / 2))).toBeLessThanOrEqual(1);

  await exerciseActionButtons.first().click();
  const expandedExerciseEditor = exerciseRows.first().locator(".trainerNextExerciseEditor");
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

  const statusSelect = editorDialog.getByLabel("Статус тренировки");
  await statusSelect.selectOption("moved");
  await expect(statusSelect).toHaveValue("moved");
  await expect(editorDialog.getByLabel("Новая дата")).toBeVisible();
  await expect(exerciseActionButtons.last()).toBeEnabled();

  await exerciseActionButtons.last().click();
  let confirmDialog = page.locator(".trainerConfirmDialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.locator("button.danger").click();
  await expect(confirmDialog).toBeHidden();
  await expect(exerciseRows).toHaveCount(0);

  await editorDialog.locator(".trainerNextWorkoutDayItem.active .trainerNextWorkoutDayActions button").last().click();
  confirmDialog = page.locator(".trainerConfirmDialog");
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
  await expect(page.locator(".trainerWorkoutScheduleFooter")).toContainText("Выполнено: 2");
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

  await expect(pastProgram).toContainText("Программа сохранена в истории клиента");
  await expect(pastProgram.getByRole("button")).toHaveCount(0);
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
  await expect(assignmentHistory.locator("article").filter({ hasText: "tren+" })).toHaveCount(0);
  await expect(page.locator('[class*="currentProgram"]').filter({ hasText: "Нет активной программы" }).first()).toBeVisible();
  assertNoRuntimeErrors();
});

test("trainer calendar is isolated to the current assignment", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1&programAssignments=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  const schedule = page.locator(".trainerWorkoutSchedulePlanner");
  await expect(schedule).toContainText("3/3");
  await expect(schedule).not.toContainText("3/4");
  assertNoRuntimeErrors();
});

test("trainer schedules a newly assigned program in a modal and it stays future until completion", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await clickTrainerNav(page, "clients");
  await openHarnessClient(page);
  await openExerciseSection(page, "План тренировок");

  await page.getByLabel("Назначить программу клиенту").selectOption("program_support");
  await page.getByRole("button", { name: "Назначить", exact: true }).click();

  const adjustmentModal = page.getByRole("dialog", { name: "Корректировка под клиента" });
  await expect(adjustmentModal).toBeVisible();
  await adjustmentModal.getByRole("button", { name: "Назначить программу", exact: true }).click();

  const scheduleModal = page.getByRole("dialog", { name: "Поддержка" });
  await expect(scheduleModal).toBeVisible();
  await expect(scheduleModal).toContainText("РАСПИСАНИЕ ПРОГРАММЫ");
  await expect(scheduleModal).toContainText("0/3");
  await scheduleModal.locator('button[title="2026-08-17"]').click();
  await scheduleModal.locator('button[title="2026-08-19"]').click();
  await scheduleModal.locator('button[title="2026-08-21"]').click();
  await expect(scheduleModal).toContainText("3/3");
  await scheduleModal.getByRole("button", { name: "Сохранить расписание", exact: true }).click();
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

  await page.getByRole("button", { name: "Редактировать" }).click();
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

  const assignmentHistory = await openProgramAssignmentHistory(page);
  const basicProgram = assignmentHistory.locator("article").filter({ hasText: "Базовый план клиента" });
  const toggle = assignmentHistory.getByRole("checkbox", { name: "Показать историю базовых тренировок" });

  await expect(toggle).not.toBeChecked();
  await expect(basicProgram).toHaveCount(0);
  const schedule = page.locator(".trainerWorkoutSchedulePlanner");
  await expect(schedule).toContainText("3/3");
  await expect(schedule).toContainText("Фиолетовый — плановая дата");
  await expect(schedule.locator(".trainerWorkoutScheduleLegend")).toContainText("Плановая дата");
  await expect(schedule.locator('button[title="2026-06-04"]')).toBeVisible();
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
  await expect(page.locator(".trainerNextWorkoutDays .trainerNextWorkoutDayItem")).toHaveCount(3);
  await expect(page.locator(".trainerNextWorkoutDaySelect[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".trainerNextExerciseList article")).toHaveCount(2);
  await expect(page.locator(".trainerNextExerciseName").first()).toBeVisible();
  await page.locator(".trainerNextExerciseName").first().click();
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
  await expect(page.getByRole("button", { name: "Добавить" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Редактировать/ }).click();
  const programEditor = page.getByRole("dialog", { name: "tren+", exact: true });
  await expect(programEditor).toBeVisible();
  await expect(programEditor.getByRole("heading", { name: "tren+", exact: true })).toBeVisible();
  await expect(programEditor.getByRole("heading", { name: "Дни программы" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
