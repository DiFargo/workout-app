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

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
}

async function expectTapTargets(page, selectors, minSize = 40) {
  const failures = await page.evaluate(({ targetSelectors, minimumSize }) => {
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    return targetSelectors.flatMap((selector) => (
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          return {
            selector,
            index,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })
        .filter((item) => item.width < minimumSize || item.height < minimumSize)
    ));
  }, { targetSelectors: selectors, minimumSize: minSize });

  expect(failures).toEqual([]);
}

async function expectMinHeights(page, selectors, minHeight = 40) {
  const failures = await page.evaluate(({ targetSelectors, minimumHeight }) => {
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    return targetSelectors.flatMap((selector) => (
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          return {
            selector,
            index,
            height: Math.round(rect.height)
          };
        })
        .filter((item) => item.height < minimumHeight)
    ));
  }, { targetSelectors: selectors, minimumHeight: minHeight });

  expect(failures).toEqual([]);
}

async function openTrainerPrograms(page) {
  const isCompactViewport = await page.evaluate(() => window.matchMedia("(max-width: 699px)").matches);
  if (isCompactViewport && await page.locator(".trainerNextClientPage").isVisible()) {
    const backToClients = page.getByRole("button", { name: "Назад к списку клиентов" });
    await expect(backToClients).toBeVisible();
    await backToClients.click();
    await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  }
  await clickTrainerNav(page, "workouts");
}

async function trainerNavButton(page, section) {
  const mobileButton = page.getByTestId(`trainer-nav-${section}`);
  if (await mobileButton.count() && await mobileButton.isVisible()) return mobileButton;
  return page.getByTestId(`trainer-desktop-nav-${section}`);
}

async function clickTrainerNav(page, section) {
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

async function getClientMessagesPanel(page) {
  const utilitySheet = page.getByRole("dialog", { name: "Сообщения", exact: true });
  if (await utilitySheet.isVisible()) return utilitySheet;

  return page.locator("section[aria-labelledby='trainer-client-messages-title']");
}

async function openHarnessClient(page) {
  const clientRow = page.locator(".trainerNextClientTable > button").first();
  await expect(clientRow).toBeVisible();
  await clientRow.click();
  await expect(page.locator(".trainerNextClientPage")).toBeVisible();

  await dismissNutritionPlanEditor(page);
}

async function openExerciseSection(page, name) {
  await openClientTab(page, "Тренировки");
  const sectionNav = page.getByRole("navigation", { name: "Разделы упражнений клиента" });
  await expect(sectionNav).toBeVisible();
  const button = sectionNav.getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

test("trainer visual audit covers dashboard, clients and programs", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible();
  await expect(page.locator(".trainerNextDashboard")).toBeVisible();
  await expectTapTargets(page, [
    ".trainerNextMobileNav button",
    ".trainerNextDesktopNav button",
    ".trainerNextPrimary",
    ".trainerNextSecondary"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-dashboard.png");

  await clickTrainerNav(page, "clients");
  await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
  await expectTapTargets(page, [
    ".trainerNextMobileNav button",
    ".trainerClientList button",
    ".trainerNextClientCard"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-clients.png");

  await openHarnessClient(page);
  await openClientTab(page, "Обзор");
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expectClientNavigation(page);
  await expect(page.getByTestId("trainer-client-progress-dashboard").locator("button[aria-pressed='true']")).toHaveCount(1);
  const overviewTasks = page.getByRole("button", { name: "Задания клиенту", exact: true });
  await expect(overviewTasks).toBeVisible();
  await openExerciseSection(page, "Прогресс упражнений");
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(page.locator(".trainerExerciseProgressToolbar button[aria-pressed='true']")).toHaveCount(1);
  await openClientTab(page, "Фото и замеры");
  await expect(page.locator(".trainerClientBodyProgress")).toBeVisible();
  await expect(page.locator(".trainerPhotoViewTabs").first().locator("button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".trainerNextClientTabs button",
    ".trainerNextClientMobileNav button",
    ".trainerNextClientBackRow button",
    ".trainerNextMobileMore"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-card.png");

  await openClientTab(page, "Питание");
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  await page.locator(".trainerNutritionDiaryCollapsed").click();
  const diaryModal = page.getByRole("dialog", { name: "Записи клиента" });
  await expect(diaryModal).toBeVisible();
  await expect(diaryModal.locator(".trainerNutritionDiary aside button[aria-pressed='true']")).toHaveCount(1);
  await diaryModal.getByRole("button", { name: "Закрыть дневник" }).click();
  await expect(diaryModal).toBeHidden();
  await expectNoHorizontalOverflow(page);

  await openClientTab(page, "Уведомления");
  await expect(page.locator(".trainerNotificationCalendarGrid")).toBeVisible();
  await expect(page.locator(".trainerNotificationLegend")).toBeVisible();
  await expect(page.locator(".trainerReminderPeriod button[aria-pressed='true']")).toHaveCount(2);
  await expect(page.locator(".trainerNotificationCalendarGrid button[aria-pressed='true']")).not.toHaveCount(0);
  await expectTapTargets(page, [
    ".trainerReminderPeriod button",
    ".trainerNotificationOffsets label",
    ".trainerNotificationActions button"
  ]);
  await expectMinHeights(page, [".trainerNotificationCalendarGrid button"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-notifications.png");
  await closeClientUtilitySheet(page, "Уведомления");

  await openClientTab(page, "Сообщения");
  const messagesPanel = await getClientMessagesPanel(page);
  const messageFilters = messagesPanel.getByRole("navigation", { name: "Фильтры сообщений клиента" });
  const messageReplies = messagesPanel.getByRole("button", { name: "Ответить", exact: true });
  await expect(messagesPanel.getByRole("heading", { name: /^(Новые )?Сообщения$/ })).toBeVisible();
  await expect(messageFilters.getByRole("button")).toHaveCount(3);
  await expect(messageFilters.getByRole("button", { name: /^Ждут ответа/ })).toHaveAttribute("aria-pressed", "true");
  await expect(messageReplies).toHaveCount(2);
  await expect(page.locator(".trainerNextNoteCard")).toHaveCount(0);
  await expect(page.getByText("Тестовая заметка", { exact: true })).toHaveCount(0);
  await expect(messagesPanel.getByText("Задания клиенту", { exact: true })).toHaveCount(0);
  await expect(messagesPanel.getByRole("button", { name: "Обработать все", exact: true })).toBeVisible();
  await expectTapTargets(page, [
    "[aria-label='Фильтры сообщений клиента'] button",
    "[aria-labelledby='trainer-client-messages-title'] article button",
    "[aria-labelledby='trainer-client-messages-title'] > header button"
  ], 32);
  if (await page.evaluate(() => window.matchMedia("(max-width: 699px)").matches)) {
    await expectTapTargets(page, ["[aria-label='Фильтры сообщений клиента'] button"], 44);
  }
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-messages.png");

  await messageReplies.first().click();
  const messageReplyDialog = page.getByRole("dialog", { name: "Ответ клиенту" });
  await expect(messageReplyDialog).toBeVisible();
  await expect(messageReplyDialog).toContainText("Комментарий клиента");
  await expect(messageReplyDialog.getByRole("button", { name: "Отметить обработанным", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-message-reply.png");
  await messageReplyDialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(messageReplyDialog).toBeHidden();

  await openTrainerPrograms(page);
  await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
  await expect(page.locator(".trainerNextPageTabs button").nth(1)).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expect(page.locator(".trainerNextWorkoutDaySelect[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".trainerNextPageTabs button",
    ".trainerNextWorkoutDayItem",
    ".trainerNextExerciseName",
    ".trainerNextHeadActions button",
    ".trainerNextMobileHeader button"
  ]);
  if (await page.evaluate(() => window.matchMedia("(max-width: 699px)").matches)) {
    await expectTapTargets(page, [
      ".trainerNextExerciseMove button",
      ".trainerNextExerciseActions button",
      ".trainerNextMobileHeader button"
    ], 44);
  }
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-programs.png");

  await page.locator(".trainerNextExerciseName").first().click();
  await expect(page.locator(".trainerNextExerciseEditor")).toBeVisible();
  await expect(page.locator(".trainerNextSetEditor input").first()).toBeVisible();
  await page.locator(".trainerNextSetEditor input").first().fill("10");
  await expectTapTargets(page, [
    ".trainerNextAddSet",
    ".trainerNextVideoUpload"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-editor.png");

  await page.locator(".trainerNextPageTabs button").nth(1).click();
  await expect(page.locator(".trainerNextLibrary")).toBeVisible();
  await page.locator(".trainerNextLibrary article").first().click();
  const libraryEditor = page.getByRole("dialog", { name: "Редактирование упражнения" });
  const libraryEditorClose = libraryEditor.getByRole("button", { name: "Закрыть редактор упражнения" });
  await expect(libraryEditor).toBeVisible();
  await expect(libraryEditorClose).toBeVisible();
  const closeMetrics = await libraryEditorClose.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      width: rect.width,
      height: rect.height,
      receivesPointer: Boolean(hit && button.contains(hit))
    };
  });
  expect(closeMetrics).toMatchObject({ width: 44, height: 44, receivesPointer: true });
  await libraryEditorClose.click();
  await expect(libraryEditor).toBeHidden();

  await page.locator(".trainerNextPageTabs button").first().click();
  await expect(page.getByRole("searchbox", { name: "Найти программу" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-library-v2.png");

  await page.getByRole("button", { name: "Добавить" }).click();
  const createProgramChoice = page.getByRole("dialog", { name: "Выберите формат программы", exact: true });
  await expect(createProgramChoice).toBeVisible();
  await expect(createProgramChoice.getByRole("heading", { name: "Выберите формат программы", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-create-sheet-v2.png");
  await createProgramChoice.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: /Редактировать/ }).click();
  const programEditor = page.getByRole("dialog", { name: "tren+", exact: true });
  await expect(programEditor).toBeVisible();
  await expect(programEditor.getByRole("heading", { name: "tren+", exact: true })).toBeVisible();
  await expect(programEditor.getByRole("heading", { name: "Дни программы" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-constructor-v2.png");

  assertNoRuntimeErrors();
});
