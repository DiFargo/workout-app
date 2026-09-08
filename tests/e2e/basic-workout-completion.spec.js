import { test, expect } from "@playwright/test";

test("completed basic workout ignores a phone draft and exposes plan management", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const workout = { id: "client_harness_day_1" };
    localStorage.setItem("workout_active_draft_v1:client_harness:client_harness_day_1", JSON.stringify({
      workoutId: workout.id,
      plan: { workouts: [workout] },
      assignmentVersion: "2026-06-18T10:00:00.000Z",
      workoutStartedAt: Date.now() - 60_000
    }));
  });
  await page.goto("/?clientHarness=1&clientWorkoutState=basic-completed&clientWorkoutProgramMode=basic");
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("workout-today-card")).toHaveAttribute("data-state", "program-complete");
  await expect(page.getByTestId("workout-start-button")).toHaveText("Посмотреть результаты");
  await expect(page.getByTestId("workout-program-button")).toContainText("Все тренировки выполнены");
  const management = page.getByTestId("basic-workout-management");
  await expect(management.getByRole("button")).toHaveCount(1);
  await expect(management).toContainText("Создать или изменить план");
  await management.scrollIntoViewIfNeeded();
  const bounds = await management.evaluate((node) => ({
    left: node.getBoundingClientRect().left,
    right: node.getBoundingClientRect().right,
    width: window.innerWidth,
    heights: [...node.querySelectorAll("button")].map((button) => button.getBoundingClientRect().height)
  }));
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.heights.every((height) => height >= 44)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("basic-plan-management.png"), fullPage: true });
  await page.getByTestId("workout-start-button").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeVisible();
  await page.getByTestId("workout-history-dialog-close").click();
  await page.getByTestId("basic-manage-plan").click();
  await expect(page.getByTestId("client-harness-basic-workout-today")).toBeVisible();
  await page.getByTestId("basic-workout-today-header").getByRole("button", { name: "Вернуться к тренировкам", exact: true }).click();
  await expect(page.getByTestId("workout-render-overview")).toBeVisible();
  await expect(page.getByTestId("client-harness-workout-mode")).toHaveCount(0);
  await page.getByTestId("basic-manage-plan").click();
  await page.getByTestId("basic-workout-plan-switcher").getByRole("button").nth(1).click();
  await expect(page.getByTestId("client-harness-basic-quiz")).toBeVisible();
  await page.getByTestId("basic-quiz-header").getByRole("button", { name: "Вернуться к тренировкам", exact: true }).click();
  await expect(page.getByTestId("workout-render-overview")).toBeVisible();
  await expect(page.getByTestId("client-harness-workout-mode")).toHaveCount(0);
});

test("unfinished basic workout still resumes its matching draft", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("workout_active_draft_v1:client_harness:client_harness_day_1", JSON.stringify({
      workoutId: "client_harness_day_1",
      plan: { workouts: [{ id: "client_harness_day_1" }] },
      assignmentVersion: "2026-06-18T10:00:00.000Z"
    }));
  });
  await page.goto("/?clientHarness=1&clientWorkoutProgramMode=basic");
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("workout-today-card")).toHaveAttribute("data-state", "draft");
  await expect(page.getByTestId("workout-start-button")).toHaveText("Продолжить тренировку");
});

test("an overdue basic plan resumes from its first unfinished workout instead of skipping it", async ({ page }) => {
  await page.goto("/?clientHarness=1&clientWorkoutProgramMode=basic");
  await page.getByTestId("client-nav-workouts").click();

  const todayCard = page.getByTestId("workout-today-card");
  await expect(todayCard).toHaveAttribute("data-state", "shifted");
  await expect(todayCard).toContainText("Программа продолжается");
  await expect(todayCard).toContainText("Пропущенные дни не меняют порядок");
  await expect(page.getByTestId("workout-start-button")).toHaveText("Начать тренировку");
});

test("individual programs do not expose basic plan replacement actions", async ({ page }) => {
  await page.goto("/?clientHarness=1&clientWorkoutProgramMode=individual");
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("workout-render-overview")).toBeVisible();
  await expect(page.getByTestId("basic-workout-management")).toHaveCount(0);
});
