import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function openHarness(page, query = "") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?clientHarness=1&clientHarnessTheme=warm-light${query}`);
}

for (const width of [320, 375, 421, 768]) {
  test(`approved native chrome and all five destinations fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const assertNoErrors = failOnRuntimeErrors(page);
    await openHarness(page, "&clientWorkoutOverviewState=today");
    const tabs = [["main", "Сегодня"], ["workouts", "Тренировки"], ["nutrition", "Питание"], ["progress", "Прогресс"], ["cabinet", "Кабинет"]];
    let baseline;
    for (const [tab, title] of tabs) {
      await page.getByTestId(`client-nav-${tab}`).click();
      const heading = page.getByRole("heading", { name: title, exact: true }).first();
      await expect(heading).toBeVisible();
      await expect(heading).toHaveCSS("font-size", "32px");
      await expect(page.locator('[data-rhythm-mark]')).toHaveCount(0);
      const nav = page.getByTestId("client-bottom-nav");
      await expect(nav).toBeVisible();
      await expect(page.getByTestId(`client-nav-${tab}`)).toHaveAttribute("aria-current", "page");
      const metrics = await page.evaluate(() => {
        const nav = document.querySelector('[data-testid="client-bottom-nav"]').getBoundingClientRect();
        const heading = document.querySelector('[data-client-page-header-primary="true"] h1').getBoundingClientRect();
        return { navX: nav.x, navY: nav.y, navWidth: nav.width, navHeight: nav.height, headingY: heading.y, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(metrics.overflow).toBeLessThanOrEqual(1);
      expect(metrics.navHeight).toBeGreaterThanOrEqual(64);
      expect(metrics.navHeight).toBeLessThanOrEqual(75);
      if (!baseline) baseline = metrics;
      for (const key of ["navX", "navY", "navWidth", "headingY"]) expect(Math.abs(metrics[key] - baseline[key])).toBeLessThanOrEqual(2);
      if (width === 375) await page.screenshot({ path: testInfo.outputPath(`${tab}.png`) });
    }
    assertNoErrors();
  });
}

test("workout schedule and basic program editing stay accessible without duplicate actions", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openHarness(page, "&clientWorkoutOverviewState=today");
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByRole("button", { name: "Дни занятий", exact: true })).toHaveCount(0);
  await page.getByTestId("workout-plan-button").click();
  await expect(page.getByTestId("workout-plan-dialog")).toBeVisible();
  await page.getByTestId("workout-plan-dialog-close").click();
  await page.getByTestId("workout-program-button").click();
  await expect(page.getByTestId("workout-program-dialog")).toBeVisible();
  await page.getByTestId("workout-program-dialog-close").click();
  await openHarness(page, "&clientWorkoutProgramMode=basic");
  await page.getByTestId("client-nav-workouts").click();
  await page.getByTestId("basic-manage-plan").click();
  await expect(page.getByTestId("basic-workout-plan-switcher")).toBeVisible();
  assertNoErrors();
});

test("summary actions open nutrition, progress, workout and notifications", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openHarness(page);
  await page.getByTestId("profile-summary-nutrition").click();
  await expect(page.getByTestId("nutrition-orbit-add")).toBeVisible();
  await page.getByTestId("client-nav-main").click();
  await page.getByTestId("profile-summary-dashboard").getByRole("button", { name: /^Вес/ }).click();
  await expect(page.getByTestId("profile-progress-periods")).toBeVisible();
  await page.getByTestId("client-nav-main").click();
  await page.getByTestId("profile-main-notifications").click();
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeVisible();
  await page.getByTestId("profile-trainer-notifications-close").click();
  await page.locator('[data-task-id="workout"]').click();
  await expect(page.getByTestId("workout-today-card")).toBeVisible();
  assertNoErrors();
});

test("summary task card keeps the workout action relevant and touchable", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [state, workoutTitle] of [
    ["today", "Сегодня тренировка"],
    ["recovery", ""],
    ["missed", "Перенесите тренировку"],
    ["unscheduled", "Продолжите тренировочный план"],
    ["complete", ""],
    ["empty", "Создайте первый план"]
  ]) {
    await openHarness(page, `&clientDashboardWorkoutState=${state}`);
    const taskCard = page.getByTestId("profile-summary-task-card");
    await expect(taskCard).toBeVisible();
    const workoutTask = page.locator('[data-task-id="workout"]');
    if (workoutTitle) {
      await expect(workoutTask).toContainText(workoutTitle);
      await expect(workoutTask).toBeEnabled();
      if (state === "today" || state === "recovery") await page.screenshot({ path: testInfo.outputPath(`${state}-day.png`) });
      await workoutTask.click();
      await expect(page.getByTestId("workout-today-card")).toBeVisible();
    } else {
      await expect(workoutTask).toHaveCount(0);
    }
  }
  assertNoErrors();
});

test("missed summary explains the original date instead of a future proposed move", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    await openHarness(page, "&clientDashboardWorkoutState=missed-move");
    const summary = page.getByTestId("profile-summary-dashboard");
    const workoutTask = page.locator('[data-task-id="workout"]');
    await expect(workoutTask).toContainText("Тренировка 1 была запланирована на 26 августа");
    await expect(summary).not.toContainText("21 сентября");
    await expect(workoutTask).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`missed-date-${viewport.width}.png`) });
  }
  assertNoErrors();
});

test("progress periods, weight validation and body controls remain functional", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openHarness(page);
  await page.getByTestId("client-nav-progress").click();
  for (const period of ["Месяц", "6 месяцев", "Год"]) {
    await page.getByRole("tab", { name: period, exact: true }).click();
    await expect(page.getByRole("tab", { name: period, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByTestId("profile-progress-weight-delta")).toContainText("−1,3 кг");
  await expect(page.getByTestId("profile-progress-achievement")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByTestId("profile-progress-add-weight").click();
  const input = page.getByTestId("profile-quick-weight-input");
  await input.fill("10");
  await page.getByTestId("profile-quick-weight-submit").click();
  await expect(page.getByTestId("profile-quick-weight-status")).toContainText("от 25 до 350");
  await input.fill("82,5");
  await page.getByTestId("profile-quick-weight-submit").click();
  await expect(page.getByTestId("profile-quick-weight-submit")).toHaveText("Вес сохранён");
  await expect(page.getByTestId("profile-quick-weight-dialog")).toBeHidden();
  await page.getByTestId("profile-measurement-start").click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeVisible();
  await page.getByTestId("profile-measurements-close").click();
  await page.getByTestId("profile-progress-photos-open").click();
  await expect(page.getByTestId("profile-progress-photos-dialog")).toBeVisible();
  assertNoErrors();
});

test("food shortcuts add a portion and retain calendar and analysis entry points", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openHarness(page);
  await page.getByTestId("client-nav-nutrition").click();
  await page.getByRole("button", { name: "Добавить еду: Завтрак", exact: true }).click();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
  await page.locator("[data-food-search-recent-card]").first().click();
  await page.locator("[data-food-amount-input]").fill("120");
  await page.locator('[data-food-product-action="add"]').click();
  await expect(page.getByTestId("food-product-page")).toBeHidden();
  await page.locator('[data-food-search-header-action="close"]').click();
  await page.getByTestId("nutrition-orbit-calendar").click();
  await expect(page.locator("[data-nutrition-calendar-day]")).toHaveCount(42);
  await page.getByTestId("nutrition-calendar-close").click();
  await page.locator('[data-nutrition-summary-part="card"]').click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeVisible();
  await page.getByTestId("nutrition-plan-close").click();
  assertNoErrors();
});

test("missed and recovery workouts require the correct decision and preserve result actions", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openHarness(page, "&clientWorkoutOverviewState=missed");
  await page.getByTestId("client-nav-workouts").click();
  await page.getByRole("button", { name: "Перенести", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Перенести тренировку" });
  await expect(dialog.getByRole("button", { name: "Сохранить дату" })).toBeDisabled();
  await dialog.locator('input[type="date"]').fill("2099-01-02");
  await dialog.getByRole("button", { name: "Сохранить дату" }).click();
  await expect(dialog).toBeHidden();
  await openHarness(page, "&clientWorkoutOverviewState=recovery");
  await page.getByTestId("client-nav-workouts").click();
  await page.getByTestId("workout-start-button").click();
  await expect(page.getByRole("dialog", { name: "Начать тренировку раньше?" })).toContainText("Плановая дата сохранится");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await openHarness(page, "&clientWorkoutState=basic-completed&clientWorkoutProgramMode=basic");
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("workout-today-card")).toHaveAttribute("data-state", "program-complete");
  await expect(page.getByTestId("workout-start-button")).toContainText("Посмотреть результаты");
  await page.getByTestId("workout-start-button").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeVisible();
  assertNoErrors();
});

// This file owns its viewport matrix; avoid repeating it in the second project.
test.beforeEach(() => { test.skip(test.info().project.name !== "mobile-chromium", "Viewport matrix runs once"); });
