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

async function isVisible(locator) {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  });
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

async function openClientTab(page, name) {
  const button = clientTabs(page).getByRole("button", { name, exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function openExerciseSection(page, name) {
  await openClientTab(page, "Тренировки");
  const sectionNav = page.getByRole("navigation", { name: "Разделы упражнений клиента" });
  await expect(sectionNav).toBeVisible();
  const button = sectionNav.getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function openClientMessages(page) {
  await openClientTab(page, "Сообщения");
  const panel = page.getByRole("region", { name: "Сообщения клиента" });
  await expect(panel).toBeVisible();
  return panel;
}

async function openTrainerPrograms(page) {
  const mobileNav = page.locator(".trainerNextMobileNav");
  if (await isVisible(mobileNav)) {
    const moreButton = page.getByTestId("trainer-nav-more");
    await expect(moreButton).toBeVisible({ timeout: 40_000 });
    await moreButton.click();
    await expect(page.locator(".trainerNextMoreDrawer")).toBeVisible();
    await expect(page.getByTestId("trainer-more-workouts")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("trainer-more-workouts").click();
    return;
  }
  await expect(page.getByTestId("trainer-desktop-nav-workouts")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("trainer-desktop-nav-workouts").click();
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

  await page.getByRole("button", { name: /Germes/ }).first().click();
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expect(clientTabs(page).getByRole("button")).toHaveCount(6);
  await expect(clientTabs(page).getByRole("button", { name: "Тренировки", exact: true })).toBeVisible();
  await expect(clientTabs(page).getByRole("button", { name: "Сообщения", exact: true })).toBeVisible();
  await expect(clientTabs(page).getByRole("button", { name: "Заметки", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("trainer-client-progress-dashboard").locator("button[aria-pressed='true']")).toHaveCount(1);
  await openExerciseSection(page, "Прогресс упражнений");
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(page.locator(".trainerExerciseProgressToolbar button[aria-pressed='true']")).toHaveCount(1);

  await openExerciseSection(page, "План тренировок");
  await expect(page.locator(".trainerWorkoutScheduleGrid")).toBeVisible();
  await expect(page.locator(".trainerWorkoutScheduleLegend")).toBeVisible();
  await expect(page.locator(".trainerClientProgramEditButton")).toBeVisible();
  await page.locator(".trainerClientProgramEditButton").click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModalBody")).toBeVisible();
  await expect(page.locator(".trainerWorkoutEditorModal")).toContainText("tren+");
  await page.locator(".trainerWorkoutEditorModal header button").click();
  await expect(page.locator(".trainerWorkoutEditorModal")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  if (await clickIfVisible(page.locator(".trainerNextClientBackRow .trainerNextPrimary"))) {
    const contactDialog = page.getByTestId("trainer-client-contact-dialog");
    await expect(contactDialog).toBeVisible();
    await contactDialog.getByTestId("trainer-client-contact-notification").click();
    const replyDialog = page.getByRole("dialog", { name: "Germes" });
    await expect(replyDialog).toBeVisible();
    await replyDialog.locator("textarea").fill("Smoke message to client");
    await replyDialog.locator("footer button").last().click();
    await expect(replyDialog).toBeHidden();
  }

  const desktopActionsOpened = await clickIfVisible(page.locator(".trainerNextClientBackRow button").nth(2));
  if (!desktopActionsOpened) {
    await page.locator(".trainerNextMobileMore").click();
  }
  await expect(page.locator(".trainerClientActionSheet")).toBeVisible();
  await expect(page.getByRole("button", { name: /Архивировать клиента|Восстановить клиента/ })).toBeVisible();
  await page.locator(".trainerClientActionSheet header button").click();
  await expect(page.locator(".trainerClientActionSheet")).toBeHidden();
  assertNoRuntimeErrors();

  await openClientTab(page, "Питание");
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  await expect(page.locator(".trainerNextClientTabs button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".trainerNutritionPeriodButtons button[aria-pressed='true']")).toHaveCount(1);
  await page.locator(".trainerNutritionDiaryCollapsed").click();
  await expect(page.locator(".trainerNutritionDiary aside button[aria-pressed='true']")).toHaveCount(1);
  await openClientTab(page, "Уведомления");
  await expect(page.locator(".trainerNotificationCalendarGrid")).toBeVisible();
  await expect(page.locator(".trainerNotificationLegend")).toBeVisible();
  await expect(page.locator(".trainerReminderPeriod button[aria-pressed='true']")).toHaveCount(2);
  await expect(page.locator(".trainerNotificationCalendarGrid button[aria-pressed='true']")).not.toHaveCount(0);
  await page.locator(".trainerNotificationOffsets label").first().click();
  await page.locator(".trainerNotificationActions .trainerNextPrimary").click();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await openClientTab(page, "Фото и замеры");
  await expect(page.locator(".trainerClientBodyProgress")).toBeVisible();
  await expect(page.locator(".trainerPhotoViewTabs").first().locator("button[aria-pressed='true']")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

});

test("client messages can be processed without a reply and tasks stay in Overview", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible();
  await clickTrainerNav(page, "clients");
  await page.getByRole("button", { name: /Germes/ }).first().click();

  const tasksDetails = page.locator("details").filter({ hasText: "Задания клиенту" });
  await expect(tasksDetails).toHaveCount(1);
  await expect(tasksDetails.getByText("Заполнить дневник самочувствия", { exact: true })).toBeHidden();
  await tasksDetails.locator("summary").click();
  await expect(tasksDetails.getByText("Заполнить дневник самочувствия", { exact: true })).toBeVisible();

  await expect(clientTabs(page).getByRole("button")).toHaveCount(6);
  await expect(clientTabs(page).getByRole("button", { name: "Заметки", exact: true })).toHaveCount(0);
  const messagesPanel = await openClientMessages(page);
  await expect(messagesPanel.getByRole("heading", { name: "Сообщения клиента", exact: true })).toBeVisible();
  await expect(page.locator(".trainerNextNoteCard")).toHaveCount(0);
  await expect(page.getByText("Тестовая заметка", { exact: true })).toHaveCount(0);
  await expect(messagesPanel.getByText("Задания клиенту", { exact: true })).toHaveCount(0);

  const filters = messagesPanel.getByRole("navigation", { name: "Фильтры сообщений клиента" });
  await expect(filters).toBeVisible();
  await expect(filters.getByRole("button")).toHaveCount(3);
  await expect(filters.getByRole("button", { name: /^Все/ })).toHaveAttribute("aria-pressed", "true");

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
  await expect(messagesPanel.getByText("1 требуют ответа", { exact: true })).toBeVisible();
  await expect(messagesPanel.getByText("1 обработано", { exact: true })).toBeVisible();

  await messagesPanel.getByRole("button", { name: "Отметить все обработанными", exact: true }).click();
  await expect(messagesPanel.getByText("0 требуют ответа", { exact: true })).toBeVisible();
  await expect(messagesPanel.getByText("2 обработано", { exact: true })).toBeVisible();
  await expect(messagesPanel.getByRole("button", { name: "Отметить все обработанными", exact: true })).toHaveCount(0);

  await filters.getByRole("button", { name: /^Обработаны/ }).click();
  await expect(filters.getByRole("button", { name: /^Обработаны/ })).toHaveAttribute("aria-pressed", "true");
  await expect(messagesPanel.getByText("Обработано", { exact: true })).toHaveCount(2);

  await messagesPanel.getByRole("button", { name: "Ответить ещё раз", exact: true }).first().click();
  await expect(replyDialog).toBeVisible();
  await replyDialog.getByRole("textbox").fill("Спасибо за обратную связь. Проверю нагрузку.");
  await replyDialog.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(replyDialog.getByRole("status")).toHaveText("Ответ отправлен");
  await replyDialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(replyDialog).toBeHidden();

  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("exercise progress decision supports confirmation and inline load editing", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  async function openProgressDecision() {
    await page.goto("/?trainerHarness=1");
    await clickTrainerNav(page, "clients");
    await page.getByRole("button", { name: /Germes/ }).first().click();
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
  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible();
  await clickTrainerNav(page, "clients");
  await page.getByRole("button", { name: /Germes/ }).first().click();
  await openExerciseSection(page, "План тренировок");

  await expect(page.getByText("ДИНАМИКА", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Как проходят тренировки", { exact: true })).toHaveCount(0);

  const adjustButton = page.getByRole("button", { name: "Скорректировать следующую тренировку", exact: true });
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
  await expect(adjustButton).toBeVisible();

  await adjustButton.click();
  decisionDialog = page.getByRole("dialog", { name: "Нужна ли корректировка?" });
  await expect(decisionDialog).toBeVisible();
  await decisionDialog.getByRole("button", { name: /Всё в порядке/ }).click();
  await expect(decisionDialog).toBeHidden();
  await expect(adjustButton).toHaveCount(0);
  await expect(page.locator(".trainerClientWorkoutReviewPanel")).toContainText("Проверено тренером");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("trainer mobile overflow menu opens compact extra sections", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile overflow exists only on compact trainer navigation.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");

  await expect(page.getByTestId("trainer-nav-more")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("trainer-nav-more").click();
  await expect(page.locator(".trainerNextMoreDrawer")).toBeVisible();
  await expect(page.locator(".trainerNextMoreDrawer nav button")).toHaveCount(4);
  await expect(page.getByTestId("trainer-more-workouts")).toBeVisible();
  await page.getByTestId("trainer-more-workouts").click();
  await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Готовые программы" })).toBeVisible();
  await expect(page.getByRole("button", { name: /tren\+/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить программу" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Редактировать/ }).click();
  await expect(page.getByRole("textbox", { name: "Название программы" })).toHaveValue("tren+");
  await expect(page.getByRole("heading", { name: "Дни программы" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
