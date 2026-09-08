import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function collectPrimaryLayoutMetric(page, navTestId, pageTestId, titleSelector) {
  if (navTestId) {
    await clickClientNav(page, navTestId);
  }

  await expect(page.getByTestId(pageTestId)).toBeVisible();
  await expect(page.locator(titleSelector)).toBeVisible();
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();

  return page.evaluate((selector) => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();

      return rect
        ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            bottom: Math.round(rect.bottom)
          }
        : null;
    };
    const firstVisible = (targetSelector) => (
      [...document.querySelectorAll(targetSelector)].find((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);

        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }) || null
    );

    return {
      viewportWidth: window.innerWidth,
      version: rectOf(document.querySelector(".clientPageVersionBadge")),
      title: rectOf(firstVisible(selector)),
      bottomNav: rectOf(firstVisible('[data-testid="client-bottom-nav"]'))
    };
  }, titleSelector);
}

async function clickClientNav(page, navTestId) {
  await expect(page.getByTestId(navTestId)).toBeVisible({ timeout: 40_000 });
  await page.getByTestId(navTestId).click();
}

function expectCloseToBaseline(value, baseline, tolerance = 2) {
  expect(
    Math.abs(value - baseline),
    `Expected ${value} to stay within ${tolerance}px of ${baseline}`
  ).toBeLessThanOrEqual(tolerance);
}

test("client primary mobile chrome keeps shared alignment", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");

  const main = await collectPrimaryLayoutMetric(
    page,
    null,
    "client-harness-main",
    '[data-testid="profile-main-title"]'
  );
  await expect(page.getByTestId("profile-main-title")).toHaveCSS("font-size", "28px");

  if (main.viewportWidth > 640) {
    assertNoRuntimeErrors();
    return;
  }

  const workouts = await collectPrimaryLayoutMetric(
    page,
    "client-nav-workouts",
    "client-harness-workouts",
    '[data-testid="workout-list-title"]'
  );
  await expect(page.getByTestId("workout-list-title")).toHaveCSS("font-size", "28px");
  const nutrition = await collectPrimaryLayoutMetric(
    page,
    "client-nav-nutrition",
    "client-harness-nutrition",
    '[data-nutrition-header-part="title"]'
  );
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveCSS("font-size", "28px");
  const progress = await collectPrimaryLayoutMetric(
    page,
    "client-nav-progress",
    "client-harness-progress",
    '[data-testid="profile-progress-title"]'
  );
  await expect(page.getByTestId("profile-progress-title")).toHaveCSS("font-size", "28px");
  const cabinet = await collectPrimaryLayoutMetric(
    page,
    "client-nav-cabinet",
    "client-harness-cabinet",
    '[data-testid="profile-cabinet-title"]'
  );
  await expect(page.getByTestId("profile-cabinet-title")).toHaveCSS("font-size", "28px");

  for (const metric of [workouts, nutrition, progress, cabinet]) {
    // Stable primary screens keep page-specific top insets within the shared 36px rhythm.
    const titleYTolerance = 36;
    const titleHeightTolerance = 6;

    if (metric.version && main.version) {
      expectCloseToBaseline(metric.version.y, main.version.y);
      expectCloseToBaseline(metric.version.height, main.version.height);
    }
    expectCloseToBaseline(metric.title.y, main.title.y, titleYTolerance);
    expectCloseToBaseline(metric.title.height, main.title.height, titleHeightTolerance);
    expectCloseToBaseline(metric.bottomNav.x, main.bottomNav.x);
    expectCloseToBaseline(metric.bottomNav.y, main.bottomNav.y);
    expectCloseToBaseline(metric.bottomNav.width, main.bottomNav.width);
    expectCloseToBaseline(metric.bottomNav.height, main.bottomNav.height);
  }

  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();

  const workoutCardMetric = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom)
          }
        : null;
    };
    return {
      viewportWidth: window.innerWidth,
      header: rectOf(document.querySelector('[data-testid="workout-list-header"]')),
      card: rectOf(document.querySelector('[data-testid="workout-list-card"]')),
      startButton: rectOf(document.querySelector('[data-testid="workout-start-button"]')),
      progress: rectOf(document.querySelector('[data-testid="workout-list-progress"]')),
      bottomNav: rectOf(document.querySelector('[data-testid="client-bottom-nav"]')),
      progressPosition: getComputedStyle(document.querySelector('[data-testid="workout-list-progress"]')).position
    };
  });

  expect(workoutCardMetric.header.bottom).toBeLessThanOrEqual(workoutCardMetric.card.y);
  expect(workoutCardMetric.card.height).toBeGreaterThanOrEqual(140);
  expect(workoutCardMetric.startButton.bottom).toBeLessThanOrEqual(workoutCardMetric.card.bottom);
  // Progress belongs to the workout card, while the shared dock remains fixed.
  expect(workoutCardMetric.progressPosition).toBe("static");
  expect(workoutCardMetric.progress.y).toBeGreaterThanOrEqual(workoutCardMetric.card.y);
  expect(workoutCardMetric.progress.bottom).toBeLessThanOrEqual(workoutCardMetric.card.bottom + 1);
  expect(workoutCardMetric.progress.bottom).toBeLessThanOrEqual(workoutCardMetric.bottomNav.y);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("client harness smoke: main, workouts, nutrition and cabinet stay usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");

  await expect(page.getByTestId("client-harness-main")).toBeVisible();
  const version = page.getByTestId("profile-dashboard-version");
  await expect(version).toBeVisible();
  await expect(version).toHaveText(/^v\.?3\.0\.\d+$/);
  await expect(version).toHaveCSS("position", "fixed");
  await expect(page.getByText("Твой день", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("profile-summary-workout-log")).toContainText("12");
  await expect(page.getByTestId("profile-summary-workout-log")).toContainText("тренировок всего");
  await expect(page.getByTestId("profile-summary-nutrition")).toContainText("1 840");
  await expect(page.getByTestId("profile-summary-nutrition")).toContainText("осталось 660 ккал");
  await expect(page.getByTestId("profile-summary-trainer-status")).toHaveText("1 сообщение от тренера");
  await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveText("1");
  await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveCSS("background-color", "rgb(217, 54, 79)");
  const versionPlacement = await page.evaluate(() => {
    const versionNode = document.querySelector('[data-testid="profile-dashboard-version"]');
    const dockNode = document.querySelector('[data-testid="client-bottom-nav"]');
    const versionRect = versionNode?.getBoundingClientRect();
    const dockRect = dockNode?.getBoundingClientRect();

    return versionRect && dockRect
      ? {
          versionBottom: Math.round(versionRect.bottom),
          dockTop: Math.round(dockRect.top)
        }
      : null;
  });
  expect(versionPlacement).not.toBeNull();
  expect(versionPlacement.versionBottom).toBeLessThanOrEqual(versionPlacement.dockTop);
  expect(versionPlacement.dockTop - versionPlacement.versionBottom).toBeLessThanOrEqual(12);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.getByTestId("workout-list-title")).toBeVisible();
  await expect(page.getByTestId("workout-list-title")).toHaveText("Тренировки");
  await expect(page.getByTestId("workout-list-header").getByText("Индивидуальная программа", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await expect(page.getByTestId("workout-history-button")).toHaveCount(0);
  await page.getByTestId("workout-records-button").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeVisible();
  await page.getByTestId("workout-history-dialog-close").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeHidden();

  await expect(page.getByTestId("workout-list-card")).toBeVisible();
  await expect(page.getByTestId("workout-list-progress")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickClientNav(page, "client-nav-nutrition");
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.getByTestId("nutrition-orbit-add")).toBeVisible();
  await expect(page.locator("[data-nutrition-header-day]")).toHaveCount(7);
  await expect(page.locator('[data-nutrition-header-day][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByTestId("nutrition-progress-status")).toHaveText("Хороший темп");
  await expect(page.getByTestId("nutrition-streak")).toHaveText("4 дня подряд");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await page.getByTestId("nutrition-orbit-add").click();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
  await page.locator('[data-food-search-header-action="close"]').click();
  await expect(page.getByTestId("food-search-screen")).toBeHidden();

  await page.getByTestId("nutrition-orbit-calendar").click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeVisible();
  await expect(page.locator("[data-nutrition-calendar-day]")).toHaveCount(42);
  await page.getByTestId("nutrition-calendar-close").click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeHidden();

  await page.locator('[data-nutrition-summary-part="card"]').click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeVisible();
  await page.getByTestId("nutrition-plan-close").click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeHidden();

  await page.getByTestId("nutrition-diary-toggle").click();
  await expect(page.getByTestId("nutrition-diary-modal")).toBeVisible();
  await page.getByTestId("nutrition-diary-close").click();
  await expect(page.getByTestId("nutrition-diary-modal")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickClientNav(page, "client-nav-cabinet");
  await expect(page.getByTestId("client-harness-cabinet")).toBeVisible();
  await expect(page.getByTestId("profile-cabinet-title")).toBeVisible();
  await page.getByTestId("profile-cabinet-action-workout-mode").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeVisible();
  await page.getByTestId("workout-mode-dialog-dismiss").click();
  await expect(page.getByTestId("client-harness-cabinet")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("workout header stays focused on the destination", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1");
  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("workout-list-header").getByText("Индивидуальная программа", { exact: true })).toHaveCount(0);

  await page.goto("/?clientHarness=1&clientWorkoutProgramMode=basic");
  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("workout-list-header").getByText("Базовая программа", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("workout and nutrition week calendars share geometry and typography", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?clientHarness=1&clientWorkoutOverviewState=today");

  await clickClientNav(page, "client-nav-workouts");
  const workoutMetrics = await page.getByTestId("workout-week-calendar").evaluate((calendar) => {
    const day = calendar.querySelector("[data-week-calendar-day]");
    const label = day?.querySelector("[data-week-calendar-label]");
    const number = day?.querySelector("[data-week-calendar-number]");
    const rect = calendar.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      dayHeight: Math.round(day?.getBoundingClientRect().height || 0),
      labelSize: getComputedStyle(label).fontSize,
      numberSize: getComputedStyle(number).fontSize
    };
  });
  await expect(page.getByTestId("workout-week-calendar").locator('[data-active="true"]')).toHaveCSS("background-color", "rgb(238, 233, 248)");
  await expect(page.getByTestId("workout-week-calendar").locator('[data-active="true"] [data-week-calendar-dot]')).toHaveCount(0);
  expect(await page.getByTestId("workout-week-calendar").locator("[data-week-calendar-dot]").count()).toBeGreaterThan(0);

  await clickClientNav(page, "client-nav-nutrition");
  const nutritionMetrics = await page.locator('[data-nutrition-header-part="week"]').evaluate((calendar) => {
    const day = calendar.querySelector("[data-week-calendar-day]");
    const label = day?.querySelector("[data-week-calendar-label]");
    const number = day?.querySelector("[data-week-calendar-number]");
    const rect = calendar.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      dayHeight: Math.round(day?.getBoundingClientRect().height || 0),
      labelSize: getComputedStyle(label).fontSize,
      numberSize: getComputedStyle(number).fontSize
    };
  });

  expect(nutritionMetrics).toEqual(workoutMetrics);
  await expect(page.locator('[data-nutrition-header-day] [data-week-calendar-number]').first()).toHaveCSS("border-radius", "50%");
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("trainer card distinguishes messages, tasks and combined notifications", async ({ page }) => {
  const cases = [
    ["message", "1 сообщение от тренера", "1"],
    ["task", "1 задача от тренера", "1"],
    ["both", "Сообщение и задача от тренера", "2"],
    ["empty", "План для Илья под контролем", null],
  ];

  for (const [state, label, badge] of cases) {
    await page.goto(`/?clientHarness=1&clientCoachNotificationState=${state}`);
    await expect(page.getByTestId("profile-summary-trainer-status")).toHaveText(label);
    if (badge) {
      await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveText(badge);
    } else {
      await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveCount(0);
    }
  }
});

test("dashboard hero reflects today's workout state", async ({ page }) => {
  const cases = [
    ["today", "Тренировка сегодня", "Ноги и ягодицы", "Тренировка по плану"],
    ["recovery", "День отдыха", "Отдых и восстановление", "Восстановление и лёгкая активность"],
    ["missed", "Нужен перенос", "Пропущенная тренировка", "Перенесите тренировку"],
    ["unscheduled", "Свободный день", "Сегодня без тренировки", "Отдых без нагрузки"],
    ["complete", "Выполнено", "Тренировка завершена", "Тренировка выполнена"],
  ];

  for (const [state, status, title, plan] of cases) {
    await page.goto(`/?clientHarness=1&clientDashboardWorkoutState=${state}`);
    await expect(page.getByTestId("profile-summary-hero-status")).toHaveText(status);
    await expect(page.getByTestId("profile-summary-hero-title")).toHaveText(title);
    await expect(page.getByTestId("profile-summary-hero-plan")).toHaveText(plan);
    await expectNoHorizontalOverflow(page);
  }
});

test("nutrition streak stays aligned with the progress status", async ({ page }) => {
  await page.goto("/?clientHarness=1&clientNutritionStreak=114");
  await clickClientNav(page, "client-nav-nutrition");
  await expect(page.getByTestId("nutrition-streak")).toHaveText("114 дней подряд");
  await expect(page.getByRole("heading", { name: "Поиск", exact: true })).toBeVisible();
  await expect(page.getByTestId("nutrition-orbit-add")).toHaveText("Добавить еду");
  await expect(page.getByTestId("nutrition-orbit-add").locator("svg")).toHaveClass(/lucide-plus/);

  const layout = await page.getByTestId("nutrition-energy-heading-row").evaluate((row) => {
    const title = row.querySelector('[data-testid="nutrition-progress-status"]');
    const streak = row.querySelector('[data-testid="nutrition-streak"]');
    const rowRect = row.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const streakRect = streak?.getBoundingClientRect();
    return {
      rowWidth: rowRect.width,
      contentWidth: titleRect && streakRect ? streakRect.right - titleRect.left : 0,
      gap: titleRect && streakRect ? streakRect.left - titleRect.right : 0,
      centerDelta: titleRect && streakRect
        ? Math.abs((titleRect.top + titleRect.bottom) / 2 - (streakRect.top + streakRect.bottom) / 2)
        : 999,
    };
  });

  expect(layout.contentWidth).toBeLessThanOrEqual(layout.rowWidth + 0.5);
  expect(layout.gap).toBeGreaterThanOrEqual(4);
  expect(layout.centerDelta).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
});

test("workout overview uses schedule data and opens plan and history", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");
  await clickClientNav(page, "client-nav-workouts");

  await expect(page.getByTestId("workout-program-button")).toContainText("Тестовая программа");
  const progressRows = await page.getByTestId("workout-list-progress").locator("span").evaluateAll((items) => (
    [...new Set(items.map((item) => Math.round(item.getBoundingClientRect().top)))].length
  ));
  expect(progressRows).toBe(1);

  const scheduledDayBackgrounds = await page.locator('[aria-label*="запланирована тренировка"]').evaluateAll((items) => (
    [...new Set(items.map((item) => getComputedStyle(item).backgroundColor))]
  ));
  expect(scheduledDayBackgrounds).toHaveLength(1);
  const scheduledDayDots = await page.locator('[aria-label*="запланирована тренировка"]').evaluateAll((items) => (
    items.map((item) => ({
      width: item.getBoundingClientRect().width,
      height: item.getBoundingClientRect().height,
      backgroundColor: getComputedStyle(item).backgroundColor,
    }))
  ));
  expect(scheduledDayDots).toHaveLength(2);
  expect(scheduledDayDots.every((dot) => dot.width === 4 && dot.height === 4 && dot.backgroundColor === "rgb(143, 122, 200)")).toBe(true);

  const todayCard = page.getByTestId("workout-today-card");
  await expect(todayCard).toHaveAttribute("data-state", "missed");
  await expect(todayCard).toContainText("Тренировка пропущена");
  await expect(todayCard.getByRole("button", { name: "Начать сейчас" })).toBeVisible();
  await todayCard.getByRole("button", { name: "Перенести" }).click();
  const rescheduleDialog = page.getByRole("dialog", { name: "Перенести тренировку" });
  const rescheduleDate = rescheduleDialog.getByLabel("Новая дата");
  await expect(rescheduleDialog).toBeVisible();
  await expect(rescheduleDate).toBeVisible();
  const rescheduleLayout = await rescheduleDialog.evaluate((dialog) => {
    const input = dialog.querySelector('input[type="date"]');
    const dialogRect = dialog.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    return {
      dialogLeft: dialogRect.left,
      dialogRight: dialogRect.right,
      inputLeft: inputRect?.left || 0,
      inputRight: inputRect?.right || 0,
      inputHeight: inputRect?.height || 0
    };
  });
  expect(rescheduleLayout.inputLeft).toBeGreaterThanOrEqual(rescheduleLayout.dialogLeft + 19);
  expect(rescheduleLayout.inputRight).toBeLessThanOrEqual(rescheduleLayout.dialogRight - 19);
  expect(rescheduleLayout.inputHeight).toBeGreaterThanOrEqual(48);
  await expect(page.getByRole("button", { name: "Закрыть" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();

  await page.getByTestId("workout-plan-button").click();
  await expect(page.getByTestId("workout-plan-dialog")).toBeVisible();
  await expect(page.getByTestId("workout-plan-dialog")).toHaveAttribute("data-modal-surface", "true");
  await expect(page.getByTestId("workout-plan-dialog")).toHaveCSS("background-color", "rgb(247, 246, 248)");
  await expect(page.getByTestId("workout-plan-dialog")).toHaveCSS("backdrop-filter", "none");
  await expect(page.getByTestId("workout-plan-dialog")).toContainText("Тестовая программа");
  await expect(page.getByTestId("workout-plan-dialog-close")).toBeVisible();
  await expect(page.getByRole("button", { name: "Все" })).toHaveCount(0);
  const availableWorkout = page.locator('[data-testid="workout-plan-dialog-item"]:not([disabled])').last();
  await availableWorkout.click();
  await expect(page.getByTestId("workout-plan-dialog")).toBeHidden();

  await page.getByTestId("workout-program-button").click();
  await expect(page.getByTestId("workout-program-dialog")).toBeVisible();
  await expect(page.getByTestId("workout-program-dialog")).toHaveAttribute("data-modal-surface", "true");
  await expect(page.getByTestId("workout-program-dialog")).toHaveCSS("background-color", "rgb(247, 246, 248)");
  await expect(page.getByTestId("workout-program-dialog")).toContainText("Тестовая программа");
  await expect(page.getByTestId("workout-program-exercise-list")).toBeVisible();
  await page.getByTestId("workout-program-dialog-close").click();
  await expect(page.getByTestId("workout-program-dialog")).toBeHidden();

  await page.getByTestId("workout-records-button").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeVisible();
  await expect(page.getByTestId("workout-history-dialog-stats")).toBeVisible();
  await expect(page.getByTestId("workout-history-dialog-close")).toBeVisible();
  assertNoRuntimeErrors();
});

test("workout today card switches between planned, recovery, and unscheduled states", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientWorkoutOverviewState=today");
  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("workout-today-card")).toHaveAttribute("data-state", "today");
  await expect(page.getByTestId("workout-today-card")).toContainText("Тренировка сегодня");
  const plannedToday = page.locator('[aria-label="Неделя ближайшей тренировки"] [aria-current="date"]');
  await expect(plannedToday).toHaveAttribute("data-planned", "true");
  await expect(plannedToday.locator("i")).toHaveCount(0);
  await expect(plannedToday).toHaveCSS("background-color", "rgb(238, 233, 248)");

  await page.goto("/?clientHarness=1&clientWorkoutOverviewState=recovery");
  await clickClientNav(page, "client-nav-workouts");
  const recoveryCard = page.getByTestId("workout-today-card");
  await expect(recoveryCard).toHaveAttribute("data-state", "recovery");
  await expect(recoveryCard).toContainText("Ближайшая тренировка");
  const todayDay = page.locator('[aria-label="Неделя ближайшей тренировки"] [aria-current="date"]');
  await expect(todayDay).toHaveCount(1);
  const plannedFutureDay = page.locator('[aria-label="Неделя ближайшей тренировки"] [data-planned="true"]').first();
  await expect(plannedFutureDay).not.toHaveAttribute("aria-current", "date");
  const recoverySpacing = await recoveryCard.evaluate((card) => {
    const summary = card.querySelector('[class*="workoutSummary"]');
    const button = card.querySelector('button');
    if (!summary || !button) return 0;
    return button.getBoundingClientRect().top - summary.getBoundingClientRect().bottom;
  });
  expect(recoverySpacing).toBeGreaterThanOrEqual(11);
  await recoveryCard.getByRole("button", { name: "Начать раньше" }).click();
  await expect(page.getByRole("dialog", { name: "Начать тренировку раньше?" })).toContainText("Плановая дата сохранится");
  await page.getByRole("button", { name: "Закрыть" }).click();

  await page.goto("/?clientHarness=1&clientWorkoutOverviewState=unscheduled");
  await clickClientNav(page, "client-nav-workouts");
  const unscheduledCard = page.getByTestId("workout-today-card");
  await expect(unscheduledCard).toHaveAttribute("data-state", "unscheduled");
  await unscheduledCard.getByRole("button", { name: "Выбрать тренировку" }).click();
  await expect(page.getByTestId("workout-plan-dialog")).toBeVisible();
  assertNoRuntimeErrors();
});

test("primary client tabs keep a shared adaptive width and an on-screen dock", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser covers the responsive viewport matrix.");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 768, height: 1024, shellWidth: 720 },
    { width: 1440, height: 900, shellWidth: 1040 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/?clientHarness=1");

    const shellRects = [];
    const tabs = [
      { nav: null, page: "client-harness-main" },
      { nav: "client-nav-workouts", page: "client-harness-workouts" },
      { nav: "client-nav-nutrition", page: "client-harness-nutrition" },
      { nav: "client-nav-progress", page: "client-harness-progress" },
      { nav: "client-nav-cabinet", page: "client-harness-cabinet" }
    ];

    for (const tab of tabs) {
      if (tab.nav) await clickClientNav(page, tab.nav);
      await expect(page.getByTestId(tab.page)).toBeVisible();

      const shell = page.locator('[data-client-adaptive-shell="true"]');
      await expect(shell).toHaveCount(1);
      const shellRect = await shell.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      });
      shellRects.push(shellRect);

      const dockRect = await page.getByTestId("client-bottom-nav").evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom)
        };
      });
      expect(dockRect.top).toBeGreaterThanOrEqual(shellRect.y);
      expect(dockRect.bottom).toBeLessThanOrEqual(shellRect.y + shellRect.height);
    }

    const [baseline, ...otherShells] = shellRects;
    expect(baseline.width).toBe(viewport.shellWidth);
    expect(baseline.height).toBeGreaterThanOrEqual(Math.min(874, viewport.height));
    expect(baseline.height).toBeLessThanOrEqual(viewport.height);
    expect(baseline.y).toBeGreaterThanOrEqual(0);
    expect(baseline.y + baseline.height).toBeLessThanOrEqual(viewport.height);
    for (const shellRect of otherShells) {
      expect(shellRect.x).toBe(baseline.x);
      expect(shellRect.width).toBe(baseline.width);
      // Every primary tab follows the shared adaptive shell and remains wholly
      // on screen at tablet and desktop widths.
      expect(shellRect.height).toBeGreaterThanOrEqual(Math.min(874, viewport.height));
      expect(shellRect.height).toBeLessThanOrEqual(viewport.height);
      expect(shellRect.y).toBeGreaterThanOrEqual(0);
      expect(shellRect.y + shellRect.height).toBeLessThanOrEqual(viewport.height);
    }
    await expectNoHorizontalOverflow(page);
  }

  assertNoRuntimeErrors();
});

test("progress uses real measurement deltas and opens body control modal", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1");
  await clickClientNav(page, "client-nav-progress");

  await expect(page.getByLabel("Настроить период")).toHaveCount(0);
  await expect(page.getByText("12 замеров")).toHaveCount(0);
  await expect(page.getByTestId("profile-progress-weight-delta")).toContainText("−1,3 кг");
  await expect(page.getByTestId("profile-progress-measurement-card")).toHaveCount(4);
  await expect(page.getByTestId("profile-progress-measurement-card").first()).toContainText("−0,5 см");
  await expect(page.getByTestId("profile-measurement-start")).toContainText("Замеры тела и фото");
  await page.getByTestId("profile-measurement-start").click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeVisible();
  await expect(page.getByTestId("profile-measurements-dialog")).toContainText("Замеры тела и фото");
  await expect(page.getByTestId("profile-measurements-section-tabs").getByRole("tab")).toHaveCount(2);
  await page.getByTestId("profile-measurements-close").click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
