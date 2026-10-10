import { test, expect } from "./app-test.js";
import { buildLocalHybridWorkoutPlan } from "../../functions/basicWorkoutHybridPlan.js";

test("approved slider flow works by keyboard and supports a one-day plan on iPhone 17 Pro", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("basic-workout-long-plan-access:client-harness", JSON.stringify({ activated: true })));
  await page.goto("/?clientHarness=1&clientHarnessPage=basicQuiz&clientHarnessTheme=warm-light");
  const card = page.getByTestId("basic-quiz-card");
  const labels = ["Хорошая форма", "Я новичок", "В тренажёрном зале", "1 тренировка", "Около 30 минут"];
  for (let step = 0; step < labels.length; step++) {
    const slider = card.getByRole("slider");
    await expect(slider).toBeVisible();
    await slider.focus(); await slider.press("End");
    await page.screenshot({ path: testInfo.outputPath(`step-${step + 1}-last.png`), scale: "css" });
    await slider.press("Home");
    await slider.press("ArrowRight");
    await page.screenshot({ path: testInfo.outputPath(`step-${step + 1}-second.png`), scale: "css" });
    await slider.press("Home");
    await expect(card.getByRole("button", { name: labels[step], exact: true })).toHaveAttribute("aria-pressed", "true");
    const next = card.getByRole("button", { name: "Далее", exact: true });
    const bounds = await next.boundingBox();
    const dock = await page.getByTestId("client-bottom-nav").boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(dock.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`step-${step + 1}.png`), scale: "css" });
    await next.click();
  }
  await card.getByRole("button", { name: "Нет ограничений" }).click();
  await card.getByRole("button", { name: "Далее", exact: true }).click();
  await card.getByRole("button", { name: "Сбалансированно", exact: true }).click();
  await card.getByRole("button", { name: "Проверить ответы", exact: true }).click();
  const review = page.getByTestId("basic-quiz-review");
  await expect(review.locator('[data-answer-key="days"]')).toContainText("1 раз");
  await expect(review.getByText("Учтём данные профиля", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("review-iphone17pro.png"), scale: "css" });
  const plan = buildLocalHybridWorkoutPlan({ mode: "plan", goal: "general_fitness", level: "beginner", location: "gym", days: "1", duration: "30", restrictions: "none", registration: { sex: "female", age: 30, height: 168, weight: 70 } });
  expect(plan.workouts).toHaveLength(4);
  expect(plan.workouts.flatMap(day => day.exercises).every(exercise => exercise.sets.length === 3)).toBe(true);
});
test("returning client sees an editable 3 + 3 + 1 suggestion for two gym sessions", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("basic-workout-long-plan-access:client-harness", JSON.stringify({ activated: true })));
  await page.goto("/?clientHarness=1&clientHarnessPage=basicQuiz&clientHarnessTheme=warm-light");
  const card = page.getByTestId("basic-quiz-card");
  for (const label of ["Хорошая форма", "Возвращаюсь", "В тренажёрном зале", "2 тренировки", "Около 60 минут", "Нет ограничений"]) {
    await card.getByRole("button", { name: label, exact:false }).click();
    await card.getByRole("button", { name:"Далее", exact:true }).click();
  }
  const variant = card.getByRole("button", { name:"Всё тело · 3 + 3 + 1", exact:true });
  await expect(variant).toHaveAttribute("aria-pressed", "true");
  await expect(card.locator("#basic-quiz-emphasis-hint")).toContainText("3 упражнения на ноги, 3 на верх тела и 1 на пресс");
  await page.screenshot({ path:testInfo.outputPath("full-body-331-iphone17pro.png"), scale:"css" });
  await card.getByRole("button", { name:"Верх тела", exact:true }).click();
  await card.getByRole("button", { name:"Проверить ответы", exact:true }).click();
  await expect(page.getByTestId("basic-quiz-review").locator('[data-answer-key="trainingEmphasis"]')).toContainText("Верх тела");
  await page.getByTestId("basic-quiz-review").locator('[data-answer-key="trainingEmphasis"]').click();
  await expect(card.getByRole("button", { name:"Верх тела", exact:true })).toHaveAttribute("aria-pressed", "true");
  await variant.click();
  await card.getByRole("button", { name:"Сохранить ответ", exact:true }).click();
  await expect(page.getByTestId("basic-quiz-review").locator('[data-answer-key="trainingEmphasis"]')).toContainText("3 + 3 + 1");
});
test.beforeEach(() => { test.skip(test.info().project.name !== "mobile-chromium", "Own viewport"); });
