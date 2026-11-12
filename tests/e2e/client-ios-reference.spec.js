import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function expectRect(locator, expected) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect({
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height)
  }).toEqual(expected);
}

async function expectWorkoutTimerReachable(page) {
  // The timer belongs to the fixed panel. Shorter phones may fit all sets after
  // adaptive compaction; overflow, when needed, must still reveal the last set.
  await page.setViewportSize({ width: 402, height: 600 });
  const metrics = await page.getByTestId("workout-run-stage").evaluate(async (deck) => {
    const timer = document.querySelector('[data-testid="workout-rest-timer"]');
    const panel = document.querySelector('[data-css-module-scope="workout-stage-action-panel"]');
    const lastSet = [...deck.querySelectorAll('[data-testid="workout-exercise-set-row"]')].at(-1);

    deck.scrollTo({ top: deck.scrollHeight });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    return {
      clientHeight: deck.clientHeight,
      scrollHeight: deck.scrollHeight,
      scrollTop: deck.scrollTop,
      lastSetBottom: Math.round(lastSet?.getBoundingClientRect().bottom || 0),
      timerTop: Math.round(timer.getBoundingClientRect().top),
      timerBottom: Math.round(timer.getBoundingClientRect().bottom),
      panelTop: Math.round(panel.getBoundingClientRect().top),
      panelBottom: Math.round(panel.getBoundingClientRect().bottom)
    };
  });

  expect(metrics.scrollHeight).toBeGreaterThanOrEqual(metrics.clientHeight);
  if (metrics.scrollHeight > metrics.clientHeight) expect(metrics.scrollTop).toBeGreaterThan(0);
  expect(metrics.lastSetBottom).toBeLessThanOrEqual(metrics.panelTop);
  expect(metrics.timerTop).toBeGreaterThanOrEqual(metrics.panelTop);
  expect(metrics.timerBottom).toBeLessThanOrEqual(metrics.panelBottom);
  expect(metrics.panelBottom).toBe(600);
  await expect(page.getByTestId("workout-rest-timer").getByRole("button", { name: "Открыть таймер отдыха", exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 402, height: 874 });
}

async function expectStickyHeaderWhileScrolling(header) {
  const metrics = await header.evaluate(async (node) => {
    const shell = node.closest('[data-client-adaptive-shell="true"]');
    if (!shell) return null;

    const initialY = node.getBoundingClientRect().y;
    shell.scrollTo({ top: 80 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const result = {
      initialY,
      scrolledY: node.getBoundingClientRect().y,
      scrollTop: shell.scrollTop,
      scrollHeight: shell.scrollHeight,
      clientHeight: shell.clientHeight
    };
    shell.scrollTo({ top: 0 });
    return result;
  });

  expect(metrics).not.toBeNull();
  if (metrics.scrollHeight > metrics.clientHeight) {
    expect(metrics.scrollTop).toBeGreaterThan(0);
    expect(Math.round(metrics.scrolledY)).toBe(Math.round(metrics.initialY));
  }
}

async function expectCabinetLogoutReachable(page) {
  const metrics = await page.evaluate(async () => {
    const shell = document.querySelector('[data-css-module-scope="profile-dashboard-shell"]');
    const logout = document.querySelector('[data-testid="profile-cabinet-logout"]');
    const header = document.querySelector('[data-css-module-scope="profile-cabinet-title-row"]');
    const bottomNav = document.querySelector('[data-testid="client-bottom-nav"]');
    if (!shell || !logout || !header || !bottomNav) return null;

    shell.scrollTo({ top: shell.scrollHeight });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const logoutRect = logout.getBoundingClientRect();
    const navRect = bottomNav.getBoundingClientRect();
    const result = {
      clientHeight: shell.clientHeight,
      logoutBottom: logoutRect.bottom,
      inHeader: header.contains(logout),
      navTop: navRect.top,
      scrollHeight: shell.scrollHeight,
      scrollTop: shell.scrollTop
    };
    shell.scrollTo({ top: 0 });
    return result;
  });

  expect(metrics).not.toBeNull();
  expect(metrics.inHeader).toBe(true);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollTop).toBeGreaterThan(0);
  expect(metrics.logoutBottom).toBeLessThanOrEqual(metrics.navTop - 8);
}

async function expectAlignedLeft(...locators) {
  const leftEdges = await Promise.all(locators.map(async (locator) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return Math.round(box.x);
  }));

  expect(new Set(leftEdges).size).toBe(1);
}

async function expectHorizontalGap(left, right, minimumGap = 0) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(rightBox.x - (leftBox.x + leftBox.width)).toBeGreaterThanOrEqual(minimumGap);
}

test("calm iOS client screens match the 402 by 874 reference geometry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The reference uses one deterministic mobile browser.");
  await page.clock.setFixedTime(new Date("2026-06-22T12:00:00Z"));
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("zmena-client-appearance-v1", "light"));
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
  await expect(page.getByTestId("profile-summary-dashboard")).toBeVisible({ timeout: 40_000 });

  const mainHeader = page.getByTestId("profile-main-header");
  await expect(mainHeader).toHaveCSS("position", "fixed");
  await expect(mainHeader).toHaveCSS("background-color", "rgb(237, 244, 247)");
  await expect(mainHeader).toHaveCSS("backdrop-filter", "blur(24px) saturate(1.35)");
  expect(await mainHeader.evaluate((node) => getComputedStyle(node, "::after").content)).toBe("none");
  await expect(page.locator("html")).toHaveCSS("overscroll-behavior-y", "none");
  await expect(page.locator("body")).toHaveCSS("overscroll-behavior-y", "none");
  await expectRect(mainHeader, { x: 0, y: 0, width: 402, height: 56 });
  await expectRect(page.getByTestId("profile-main-title"), { x: 20, y: 16, width: 95, height: 27 });
  await expect(page.getByTestId("profile-main-title")).toHaveCSS("font-size", "24px");
  await expectRect(page.getByTestId("profile-main-notifications"), { x: 338, y: 8, width: 44, height: 44 });
  const dashboard = page.getByTestId("profile-summary-dashboard");
  const taskCard = dashboard.getByTestId("profile-summary-task-card");
  await expectRect(page.getByTestId("profile-summary-greeting"), { x: 22, y: 77, width: 358, height: 24 });
  await expect(page.getByTestId("profile-summary-greeting")).toContainText("Илья");
  await expectRect(taskCard, { x: 20, y: 123, width: 362, height: await taskCard.evaluate((node) => Math.round(node.getBoundingClientRect().height)) });
  await expect(page.getByTestId("profile-summary-task-title")).toHaveCSS("font-size", "21px");
  const taskCardBox = await taskCard.boundingBox();
  const workoutTask = page.locator('[data-task-id="workout"]');
  const workoutTaskBox = await workoutTask.boundingBox();
  const workoutTaskStyle = await workoutTask.evaluate((node) => getComputedStyle(node));
  expect(workoutTaskBox.x).toBeGreaterThan(taskCardBox.x);
  expect(workoutTaskBox.width).toBeLessThan(taskCardBox.width);
  expect(workoutTaskBox.height).toBeGreaterThanOrEqual(56);
  expect(workoutTaskStyle.gridTemplateColumns).toContain("32px");
  await expectAlignedLeft(page.getByTestId("profile-summary-task-title"), workoutTask);
  const workoutMetrics = await page.getByTestId("profile-summary-workout-log").boundingBox();
  const nutritionMetrics = await page.getByTestId("profile-summary-nutrition").boundingBox();
  expect(workoutMetrics.y).toBeGreaterThanOrEqual(taskCardBox.y + taskCardBox.height + 16);
  expect(Math.round(workoutMetrics.x)).toBe(20);
  expect(Math.round(workoutMetrics.width)).toBe(121);
  expect(Math.round(nutritionMetrics.x)).toBe(141);
  expect(Math.round(nutritionMetrics.width)).toBe(121);
  // Metrics now share one grouped card: a separator replaces the old gap.
  await expectHorizontalGap(page.getByTestId("profile-summary-workout-log"), page.getByTestId("profile-summary-nutrition"));
  await expect(page.getByTestId("profile-summary-nutrition")).toHaveCSS("border-left-width", "1px");
  const notificationBox = await page.getByTestId("profile-summary-notifications-button").boundingBox();
  expect(notificationBox.x).toBe(20);
  expect(notificationBox.width).toBe(362);
  expect(notificationBox.y).toBeGreaterThan(workoutMetrics.y);
  await expect(page.getByTestId("profile-summary-workout-log")).toContainText("12");
  await expect(page.getByTestId("profile-summary-nutrition")).toContainText("1 840");
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 12, y: 796, width: 378, height: 70 });
  await expectStickyHeaderWhileScrolling(mainHeader);

  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.getByTestId("profile-cabinet-title")).toHaveText("Кабинет");
  await expect(page.getByTestId("profile-cabinet-title")).toHaveCSS("font-size", "24px");
  await expectRect(page.locator('[data-css-module-scope="profile-cabinet-title-row"]'), { x: 0, y: 0, width: 402, height: 56 });
  await expectRect(page.locator('[data-client-page-header] > [data-testid="profile-cabinet-title-row"]'), { x: 20, y: 8, width: 362, height: 44 });
  await page.getByRole("button", { name: "Редактировать профиль", exact: true }).click();
  const personalSheet = page.getByRole("dialog", { name: "Личные данные и цели", exact: true });
  await expect(personalSheet).toBeVisible();
  await expectRect(page.getByTestId("profile-cabinet-action-questionnaire"), { x: 36, y: 662, width: 330, height: 64 });
  await expectRect(page.getByTestId("profile-cabinet-action-nutrition"), { x: 36, y: 726, width: 330, height: 64 });
  await personalSheet.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(personalSheet).toBeHidden();
  await expectRect(page.getByTestId("profile-cabinet-action-workout-journal"), { x: 20, y: 312, width: 362, height: 67 });
  await expectRect(page.getByTestId("profile-cabinet-action-account"), { x: 20, y: 497, width: 362, height: 67 });
  await expectRect(page.getByTestId("profile-cabinet-action-feedback"), { x: 20, y: 682, width: 362, height: 86 });
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 12, y: 796, width: 378, height: 70 });
  await expectStickyHeaderWhileScrolling(page.locator('[data-css-module-scope="profile-cabinet-title-row"]'));
  await expectCabinetLogoutReachable(page);

  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveText("Питание");
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveCSS("font-size", "24px");
  await expectRect(page.locator('[data-nutrition-header-part="title-row"]'), { x: 20, y: 8, width: 362, height: 44 });
  await expect(page.getByTestId("nutrition-header-calendar")).toHaveCount(0);
  await expect(page.locator('[data-nutrition-header-part="week"]')).toBeHidden();
  const nutritionCalendar = page.getByRole("button", { name: "Календарь питания", exact: true });
  await expectRect(nutritionCalendar, { x: 338, y: 8, width: 44, height: 44 });
  await nutritionCalendar.click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeVisible();
  await expect(page.locator('[data-nutrition-calendar-day="2026-06-22"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("nutrition-calendar-close").click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeHidden();
  let previousNutritionBottom = 56;
  for (const [locator, height] of [
    [page.getByTestId("nutrition-orbit"), 243],
    [page.locator('[data-css-module-scope="nutrition-diary"]'), 44],
    [page.getByTestId("nutrition-diary-list"), 228],
    [page.getByTestId("nutrition-summary"), 90]
  ]) {
    const box = await locator.boundingBox();
    expect(Math.round(box.x)).toBe(20);
    expect(Math.round(box.width)).toBe(362);
    expect(Math.round(box.height)).toBe(height);
    expect(box.y).toBeGreaterThanOrEqual(previousNutritionBottom);
    previousNutritionBottom = box.y + box.height;
  }
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 12, y: 796, width: 378, height: 70 });

  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("workout-list-title")).toHaveCSS("font-size", "24px");
  await expectRect(page.getByTestId("workout-week-calendar"), { x: 20, y: 56, width: 362, height: 83 });
  await expectRect(page.getByTestId("workout-today-card"), { x: 20, y: 219, width: 362, height: 371 });
  await expectRect(page.getByTestId("workout-start-button"), { x: 40, y: 464, width: 322, height: 52 });
  await expectStickyHeaderWhileScrolling(page.getByTestId("workout-list-header"));

  await page.getByTestId("client-nav-progress").click();
  await expect(page.getByTestId("profile-progress-title")).toHaveText("Прогресс");
  await expect(page.getByTestId("profile-progress-title")).toHaveCSS("font-size", "24px");
  await expectRect(page.getByTestId("profile-progress-header"), { x: 0, y: 0, width: 402, height: 56 });
  await expect(page.getByTestId("profile-measurement-panel")).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Период графика веса" }).getByRole("tab")).toHaveCount(3);
  await expect(page.getByRole("tab", { name: "Месяц", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "3 месяца", exact: true }).click();
  await expect(page.getByRole("tab", { name: "3 месяца", exact: true })).toHaveAttribute("aria-selected", "true");
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 12, y: 796, width: 378, height: 70 });

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light");
  await expect(page.getByRole("button", { name: "Вернуться к предыдущему экрану" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Выйти из тренировки" })).toBeInViewport();
  await expectRect(page.locator('[data-css-module-scope="workout-stage-heading"]'), { x: 0, y: 0, width: 402, height: 72 });
  await expect(page.locator('[data-css-module-scope="workout-stage-heading"]')).toContainText("Жим штанги лёжа");
  await expectRect(page.getByTestId("workout-exercise-progress"), { x: 136, y: 38, width: 130, height: 18 });
  await expect(page.getByTestId("workout-exercise-progress")).toHaveText("Упражнение 1 из 2");
  await expectRect(page.getByTestId("workout-exercise-video-frame"), { x: 16, y: 72, width: 370, height: 370 });
  await expectRect(page.getByTestId("workout-plan-section"), { x: 16, y: 497, width: 370, height: 122 });
  await expectRect(page.getByTestId("workout-plan-card"), { x: 16, y: 497, width: 370, height: 122 });
  await expect(page.getByTestId("workout-exercise-set-row")).toHaveCount(1);
  await expectRect(page.getByTestId("workout-rest-timer"), { x: 20, y: 746, width: 362, height: 48 });
  await expectRect(page.locator('[data-css-module-scope="workout-stage-action-panel"]'), { x: 0, y: 734, width: 402, height: 140 });
  await expectWorkoutTimerReachable(page);

  assertNoRuntimeErrors();
});

test("cabinet scroll keeps logout reachable in the fixed header", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The cabinet interaction is mobile-specific.");

  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
  await page.getByTestId("client-nav-cabinet").click();

  await expect(page.getByTestId("profile-cabinet-logout")).toBeVisible();
  await expectCabinetLogoutReachable(page);
  await page.setViewportSize({ width: 402, height: 600 });
  const header = page.locator('[data-css-module-scope="profile-cabinet-title-row"]');
  await expectStickyHeaderWhileScrolling(header);
  await expectCabinetLogoutReachable(page);
  await expect(page.getByTestId("client-bottom-nav")).toBeInViewport();
});
