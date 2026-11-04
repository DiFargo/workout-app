import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(90_000);

const actionGradient = "linear-gradient(115deg, rgb(70, 123, 114) 0%, rgb(62, 116, 139) 54%, rgb(53, 101, 163) 100%)";
const modalCanvas = "rgb(245, 247, 248)";

async function openClientHarness(page, url) {
  // Wait for lazy harness compilation separately from the 5s behavioral checks.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator('[data-testid^="client-harness-"]').first()).toBeVisible({ timeout: 40_000 });
}

async function seedWorkoutDraft(page) {
  await page.addInitScript(() => {
    localStorage.setItem("workout_active_draft_v1:client_harness:client_harness_day_1", JSON.stringify({
      workoutId: "client_harness_day_1",
      assignmentVersion: "2026-06-18T10:00:00.000Z",
      plan: { id: "client_harness_day_1", exercises: [] }
    }));
  });
}

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

test("client primary chrome keeps shared alignment and draft progress inside its card", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await seedWorkoutDraft(page);
  await openClientHarness(page, "/?clientHarness=1");

  const main = await collectPrimaryLayoutMetric(
    page,
    null,
    "client-harness-main",
    '[data-testid="profile-main-title"]'
  );
  await expect(page.getByTestId("profile-main-title")).toHaveCSS("font-size", "32px");

  const workouts = await collectPrimaryLayoutMetric(
    page,
    "client-nav-workouts",
    "client-harness-workouts",
    '[data-testid="workout-list-title"]'
  );
  await expect(page.getByTestId("workout-list-title")).toHaveCSS("font-size", "32px");
  const nutrition = await collectPrimaryLayoutMetric(
    page,
    "client-nav-nutrition",
    "client-harness-nutrition",
    '[data-nutrition-header-part="title"]'
  );
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveCSS("font-size", "32px");
  const progress = await collectPrimaryLayoutMetric(
    page,
    "client-nav-progress",
    "client-harness-progress",
    '[data-testid="profile-progress-title"]'
  );
  await expect(page.getByTestId("profile-progress-title")).toHaveCSS("font-size", "32px");
  const cabinet = await collectPrimaryLayoutMetric(
    page,
    "client-nav-cabinet",
    "client-harness-cabinet",
    '[data-testid="profile-cabinet-title"]'
  );
  await expect(page.getByTestId("profile-cabinet-title")).toHaveCSS("font-size", "32px");

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
  await expect(page.getByTestId("workout-today-card")).toHaveAttribute("data-state", "draft");
  await expect(page.getByTestId("workout-start-button")).toHaveText("Продолжить тренировку");
  await expect(page.getByTestId("workout-list-progress").locator("span")).toHaveCount(2);

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
      card: rectOf(document.querySelector('[data-testid="workout-today-card"]')),
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
  await page.clock.setFixedTime(new Date("2026-06-22T12:00:00Z"));
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await openClientHarness(page, "/?clientHarness=1");

  await expect(page.getByTestId("client-harness-main")).toBeVisible();
  await expect(page.getByTestId("profile-dashboard-version")).toHaveCount(0);
  await expect(page.getByText("Твой день", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("profile-summary-workout-log")).toContainText("12");
  await expect(page.getByTestId("profile-summary-workout-log")).toContainText("завершено");
  await expect(page.getByTestId("profile-summary-nutrition")).toContainText("1 840");
  await expect(page.getByTestId("profile-summary-nutrition")).toContainText("из 2 500 ккал");
  await expect(page.getByTestId("profile-summary-trainer-status")).toHaveText("1 сообщение от тренера");
  await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveAttribute("aria-label", "1 новых уведомлений");
  await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveCSS("background-image", actionGradient);
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
  await expect(page.getByTestId("workout-list-progress")).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Прогресс программы" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();

  await clickClientNav(page, "client-nav-nutrition");
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.getByTestId("nutrition-orbit-add")).toBeVisible();
  await expect(page.locator("[data-nutrition-header-day]")).toHaveCount(7);
  await expect(page.locator('[data-nutrition-header-day][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByTestId("nutrition-progress-status")).toHaveText("Осталось на сегодня");
  await expect(page.getByTestId("nutrition-progress-status")).toHaveAttribute("aria-label", "Хороший темп");
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
  const version = page.getByTestId("profile-dashboard-version");
  await version.scrollIntoViewIfNeeded();
  await expect(version).toBeVisible();
  await expect(version).toHaveText(/^v\.?3\.0\.\d+$/);
  await expect(version).toHaveCSS("position", "static");
  const versionRect = await version.boundingBox();
  const dockRect = await page.getByTestId("client-bottom-nav").boundingBox();
  expect(versionRect.y + versionRect.height).toBeLessThanOrEqual(dockRect.y);
  await page.getByTestId("profile-cabinet-action-workout-mode").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeVisible();
  await page.getByTestId("workout-mode-dialog-dismiss").click();
  await expect(page.getByTestId("client-harness-cabinet")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("workout header stays focused on the destination", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openClientHarness(page, "/?clientHarness=1");
  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("workout-list-header").getByText("Индивидуальная программа", { exact: true })).toHaveCount(0);

  await openClientHarness(page, "/?clientHarness=1&clientWorkoutProgramMode=basic");
  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("workout-list-header").getByText("Базовая программа", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("workout and nutrition week calendars share geometry and typography", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  // Keep today's workout and the second scheduled workout in the same week.
  await page.clock.setFixedTime(new Date("2026-10-12T12:00:00Z"));
  await page.setViewportSize({ width: 390, height: 844 });
  await openClientHarness(page, "/?clientHarness=1&clientWorkoutOverviewState=today");

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
  const activeWorkoutNumber = page.getByTestId("workout-week-calendar").locator('[data-active="true"] [data-week-calendar-number]');
  await expect(activeWorkoutNumber).toHaveCSS("background-image", actionGradient);
  await expect(activeWorkoutNumber).toHaveCSS("color", "rgb(255, 255, 255)");
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
  await expect(page.locator('[data-selected="true"] [data-week-calendar-number]')).toHaveCSS("background-image", actionGradient);
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});

test("trainer card distinguishes messages, tasks and combined notifications", async ({ page }) => {
  const cases = [
    ["message", "1 сообщение от тренера", "1"],
    ["task", "1 задача от тренера", "1"],
    ["both", "Сообщение и задача от тренера", "2"],
    ["empty", "Новых сообщений нет", null],
  ];

  for (const [state, label, badge] of cases) {
    await openClientHarness(page, `/?clientHarness=1&clientCoachNotificationState=${state}`);
    await expect(page.getByTestId("profile-summary-trainer-status")).toHaveText(label);
    if (badge) {
      await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveAttribute("aria-label", `${badge} новых уведомлений`);
      await expect(page.getByTestId("profile-summary-trainer-badge")).toBeVisible();
    } else {
      await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveCount(0);
    }
  }
});

test("dashboard tasks show only actions relevant to the workout day", async ({ page }) => {
  const cases = [
    ["today", "Сегодня тренировка", "Ноги и ягодицы", true],
    ["recovery", "", "", false],
    ["missed", "Перенесите тренировку", "31 августа", true],
    ["unscheduled", "Продолжите тренировочный план", "не запланировано", true],
    ["complete", "", "", false],
    ["empty", "Создайте первый план", "стартовую программу", true],
  ];

  for (const [state, title, note, hasWorkoutTask] of cases) {
    await openClientHarness(page, `/?clientHarness=1&clientDashboardWorkoutState=${state}`);
    const summary = page.getByTestId("profile-summary-dashboard");
    await expect(page.getByTestId("profile-summary-task-card")).toBeVisible();
    await expect(page.getByTestId("profile-summary-task-title")).toHaveText("Что важно сегодня?");
    const workoutTask = page.locator('[data-task-id="workout"]');
    await expect(workoutTask).toHaveCount(hasWorkoutTask ? 1 : 0);
    if (hasWorkoutTask) {
      await expect(workoutTask).toContainText(title);
      await expect(workoutTask).toContainText(note);
    }
    await expect(summary.getByTestId("profile-summary-task-count")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("nutrition streak stays below the energy heading without overflow", async ({ page }) => {
  await openClientHarness(page, "/?clientHarness=1&clientNutritionStreak=114");
  await clickClientNav(page, "client-nav-nutrition");
  await expect(page.getByTestId("nutrition-streak")).toHaveText("114 дней подряд");
  await expect(page.getByRole("heading", { name: "Добавить еду", exact: true })).toBeVisible();
  await expect(page.getByTestId("nutrition-orbit-add")).toHaveText("Продукт");
  await expect(page.getByTestId("nutrition-orbit-add")).toHaveAccessibleName("Добавить еду: продукт");
  await expect(page.getByTestId("nutrition-orbit-add").locator("svg")).toHaveClass(/lucide-plus/);

  const layout = await page.getByTestId("nutrition-energy-heading-row").evaluate((row) => {
    const title = row.querySelector('[data-testid="nutrition-progress-status"]');
    const streak = row.parentElement.querySelector('[data-testid="nutrition-streak"]');
    const copyRect = row.parentElement.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const streakRect = streak?.getBoundingClientRect();
    return {
      copyLeft: copyRect.left,
      copyRight: copyRect.right,
      titleRight: titleRect?.right,
      streakLeft: streakRect?.left,
      streakRight: streakRect?.right,
      streakWidth: streak?.scrollWidth,
      availableWidth: copyRect.width,
      gap: streakRect ? streakRect.top - rowRect.bottom : -1,
    };
  });

  expect(layout.titleRight).toBeLessThanOrEqual(layout.copyRight + 0.5);
  expect(layout.streakLeft).toBeGreaterThanOrEqual(layout.copyLeft);
  expect(layout.streakRight).toBeLessThanOrEqual(layout.copyRight + 0.5);
  expect(layout.streakWidth).toBeLessThanOrEqual(layout.availableWidth + 0.5);
  expect(layout.gap).toBeGreaterThanOrEqual(0);
  await expectNoHorizontalOverflow(page);
});

test("workout overview uses schedule data and opens plan and history", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await openClientHarness(page, "/?clientHarness=1");
  await clickClientNav(page, "client-nav-workouts");

  await expect(page.getByTestId("workout-program-button")).toHaveText("Открыть программу");
  const program = page.locator("section").filter({ has: page.getByTestId("workout-program-button") });
  await expect(program).toContainText("Тестовая программа");
  const progress = page.getByRole("progressbar", { name: "Прогресс программы" });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(progress).toHaveAttribute("aria-valuemax", "2");
  const progressLabels = program.locator('[class*="programProgress"] span');
  await expect(progressLabels).toHaveCount(2);
  await expect(progressLabels).toHaveText(["0 из 2 тренировок", "2 осталось"]);
  const progressRows = await progressLabels.evaluateAll((items) => (
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
      backgroundImage: getComputedStyle(item).backgroundImage,
    }))
  ));
  expect(scheduledDayDots).toHaveLength(2);
  expect(scheduledDayDots.every((dot) => dot.width === 3 && dot.height === 3 && dot.backgroundImage === actionGradient)).toBe(true);

  const todayCard = page.getByTestId("workout-today-card");
  await expect(todayCard).toHaveAttribute("data-state", "missed");
  await expect(todayCard).toContainText("День 1 — Верх тела");
  await expect(todayCard).toContainText("Перенос");
  await expect(todayCard).toContainText("Можно выполнить тренировку сейчас или выбрать новую дату");
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
  await expect(page.getByTestId("workout-plan-dialog")).toHaveCSS("background-color", modalCanvas);
  await expect(page.getByTestId("workout-plan-dialog")).toHaveCSS("backdrop-filter", "none");
  await expect(page.getByTestId("workout-plan-dialog")).toContainText("Тестовая программа");
  await expect(page.getByTestId("workout-plan-dialog-close")).toBeVisible();
  await expect(page.getByRole("button", { name: "Все" })).toHaveCount(0);
  const availableWorkout = page.locator('[data-testid="workout-plan-dialog-item"]:not([disabled])').last();
  await expect(availableWorkout).toContainText("День 2 — Низ тела");
  await availableWorkout.click();
  await expect(page.getByTestId("workout-plan-dialog")).toBeHidden();
  await expect(page.getByTestId("workout-today-card")).toContainText("День 2 — Низ тела");

  await page.getByTestId("workout-program-button").click();
  await expect(page.getByTestId("workout-program-dialog")).toBeVisible();
  await expect(page.getByTestId("workout-program-dialog")).toHaveAttribute("data-modal-surface", "true");
  await expect(page.getByTestId("workout-program-dialog")).toHaveCSS("background-color", modalCanvas);
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
  // Recovery is scheduled tomorrow; on Sunday its week excludes today's cell.
  await page.clock.setFixedTime(new Date("2026-10-12T12:00:00Z"));

  await openClientHarness(page, "/?clientHarness=1&clientWorkoutOverviewState=today");
  await clickClientNav(page, "client-nav-workouts");
  await expect(page.getByTestId("workout-today-card")).toHaveAttribute("data-state", "today");
  await expect(page.getByTestId("workout-today-card")).toContainText("День 1 — Верх тела");
  await expect(page.getByTestId("workout-today-card").getByRole("button", { name: "Начать тренировку" })).toBeVisible();
  const plannedToday = page.locator('[aria-label="Неделя ближайшей тренировки"] [aria-current="date"]');
  await expect(plannedToday).toHaveAttribute("data-planned", "true");
  await expect(plannedToday.locator("i")).toHaveCount(0);
  await expect(plannedToday.locator("[data-week-calendar-number]")).toHaveCSS("background-image", actionGradient);

  await openClientHarness(page, "/?clientHarness=1&clientWorkoutOverviewState=recovery");
  await clickClientNav(page, "client-nav-workouts");
  const recoveryCard = page.getByTestId("workout-today-card");
  await expect(recoveryCard).toHaveAttribute("data-state", "recovery");
  await expect(page.getByRole("heading", { name: "Следующая тренировка", exact: true })).toBeVisible();
  await expect(recoveryCard).toContainText("День 1 — Верх тела");
  await expect(recoveryCard).toContainText("Отдохните, соблюдайте питание и добавьте лёгкую активность");
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

  await openClientHarness(page, "/?clientHarness=1&clientWorkoutOverviewState=unscheduled");
  await clickClientNav(page, "client-nav-workouts");
  const unscheduledCard = page.getByTestId("workout-today-card");
  await expect(unscheduledCard).toHaveAttribute("data-state", "unscheduled");
  await unscheduledCard.getByRole("button", { name: "Выбрать тренировку" }).click();
  await expect(page.getByTestId("workout-plan-dialog")).toBeVisible();
  assertNoRuntimeErrors();
});

test("primary client tabs keep a shared adaptive width and an on-screen dock", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 768, height: 1024, shellWidth: 720 },
    { width: 1440, height: 900, shellWidth: 1040 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openClientHarness(page, "/?clientHarness=1");

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
  await page.clock.setFixedTime(new Date("2026-06-22T12:00:00Z"));
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await openClientHarness(page, "/?clientHarness=1");
  await clickClientNav(page, "client-nav-progress");

  await expect(page.getByLabel("Настроить период")).toHaveCount(0);
  await expect(page.getByText("12 замеров")).toHaveCount(0);
  await expect(page.getByTestId("profile-progress-weight-delta")).toContainText("−1,3 кг");
  await expect(page.getByTestId("profile-progress-weight-card")).toContainText("88,8");
  // May 22 is outside the last 30 days; the wider range retains both saved values.
  await expect(page.getByTestId("profile-progress-weight-point-label")).toHaveText(["88,8"]);
  await page.getByRole("tab", { name: "6 месяцев", exact: true }).click();
  await expect(page.getByRole("img", { name: "Динамика веса: от 90,1 до 88,8 килограмма" })).toBeVisible();
  await expect(page.getByTestId("profile-progress-weight-point-label")).toHaveText(["90,1", "88,8"]);
  await expect(page.getByTestId("profile-progress-achievement")).toContainText("12 тренировок завершено");
  await expect(page.getByTestId("profile-progress-periods").getByRole("tab")).toHaveCount(3);
  await page.getByTestId("profile-progress-periods").getByRole("tab", { name: "Год", exact: true }).click();
  await expect(page.getByTestId("profile-progress-periods").getByRole("tab", { name: "Год", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("profile-measurement-start")).toContainText("Замеры тела");
  await page.getByTestId("profile-measurement-start").click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeVisible();
  await expect(page.getByTestId("profile-measurements-dialog")).toContainText("Замеры тела и фото");
  await expect(page.getByTestId("profile-measurements-section-tabs").getByRole("tab")).toHaveCount(2);
  const measurements = page.getByTestId("profile-measurements-cell");
  await expect(measurements).toHaveCount(12);
  await expect(measurements.filter({ hasText: "Шея" })).toContainText("39");
  await expect(measurements.filter({ hasText: "Вес" })).toContainText("88.8");
  await page.getByTestId("profile-measurements-close").click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  assertNoRuntimeErrors();
});
