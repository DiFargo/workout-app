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

async function isVisible(locator) {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  });
}

async function openTrainerPrograms(page) {
  const mobileNav = page.locator(".trainerNextMobileNav");
  if (await isVisible(mobileNav)) {
    await expect(page.getByTestId("trainer-nav-more")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("trainer-nav-more").click();
    await expect(page.locator(".trainerNextMoreDrawer")).toBeVisible();
    await expect(page.getByTestId("trainer-more-workouts")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("trainer-more-workouts").click();
    return;
  }

  await expect(page.getByTestId("trainer-desktop-nav-workouts")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("trainer-desktop-nav-workouts").click();
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

  await page.getByRole("button", { name: /Germes/ }).first().click();
  await expect(page.getByRole("heading", { name: "Germes" })).toBeVisible();
  await expect(clientTabs(page).getByRole("button")).toHaveCount(6);
  await expect(clientTabs(page).getByRole("button", { name: "Тренировки", exact: true })).toBeVisible();
  await expect(clientTabs(page).getByRole("button", { name: "Сообщения", exact: true })).toBeVisible();
  await expect(clientTabs(page).getByRole("button", { name: "Заметки", exact: true })).toHaveCount(0);
  await expect(page.locator(".trainerNextClientTabs button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.getByTestId("trainer-client-progress-dashboard").locator("button[aria-pressed='true']")).toHaveCount(1);
  const overviewTasks = page.locator("details").filter({ hasText: "Задания клиенту" });
  await expect(overviewTasks).toHaveCount(1);
  await expect(overviewTasks.getByText("Задания клиенту", { exact: true })).toBeVisible();
  await openExerciseSection(page, "Прогресс упражнений");
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(page.locator(".trainerExerciseProgressToolbar button[aria-pressed='true']")).toHaveCount(1);
  await openClientTab(page, "Фото и замеры");
  await expect(page.locator(".trainerClientBodyProgress")).toBeVisible();
  await expect(page.locator(".trainerPhotoViewTabs").first().locator("button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".trainerNextClientTabs button",
    ".trainerNextClientBackRow button",
    ".trainerNextMobileMore"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-client-card.png");

  await openClientTab(page, "Питание");
  await expect(page.locator(".trainerNutritionAnalytics")).toBeVisible();
  await page.locator(".trainerNutritionDiaryCollapsed").click();
  await expect(page.locator(".trainerNutritionDiary aside button[aria-pressed='true']")).toHaveCount(1);
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

  await openClientTab(page, "Сообщения");
  const messagesPanel = page.getByRole("region", { name: "Сообщения клиента" });
  const messageFilters = messagesPanel.getByRole("navigation", { name: "Фильтры сообщений клиента" });
  const messageReplies = messagesPanel.getByRole("button", { name: "Ответить", exact: true });
  await expect(messagesPanel.getByRole("heading", { name: "Сообщения клиента", exact: true })).toBeVisible();
  await expect(messageFilters.getByRole("button")).toHaveCount(3);
  await expect(messageFilters.getByRole("button", { name: /^Все/ })).toHaveAttribute("aria-pressed", "true");
  await expect(messageReplies).toHaveCount(2);
  await expect(page.locator(".trainerNextNoteCard")).toHaveCount(0);
  await expect(page.getByText("Тестовая заметка", { exact: true })).toHaveCount(0);
  await expect(messagesPanel.getByText("Задания клиенту", { exact: true })).toHaveCount(0);
  await expect(messagesPanel.getByRole("button", { name: "Отметить все обработанными", exact: true })).toBeVisible();
  await expectTapTargets(page, [
    "[aria-label='Фильтры сообщений клиента'] button",
    "[aria-labelledby='trainer-client-messages-title'] article button",
    "[aria-labelledby='trainer-client-messages-title'] > header button"
  ], 32);
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

  await page.locator(".trainerNextPageTabs button").first().click();
  await expect(page.getByRole("heading", { name: "Готовые программы" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить программу" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-library-v2.png");

  await page.getByRole("button", { name: "Добавить программу" }).click();
  await expect(page.getByRole("dialog", { name: "Создать или загрузить?" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-create-sheet-v2.png");
  await page.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: /Редактировать/ }).click();
  await expect(page.getByRole("textbox", { name: "Название программы" })).toHaveValue("tren+");
  await expect(page.getByRole("heading", { name: "Дни программы" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "trainer-program-constructor-v2.png");

  assertNoRuntimeErrors();
});
