import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

const scenarios = [
  { id: "over", text: "на 329 ккал выше цели", short: "На 329 ккал выше цели", width: 402 },
  { id: "over", text: "на 329 ккал выше цели", short: "На 329 ккал выше цели", width: 320 },
  { id: "low-protein-over", text: "белка записано 80 из 199 г", short: "Белок ниже ориентира", width: 402 },
  { id: "target", text: "Цель по калориям достигнута", short: "Цель по калориям достигнута", width: 402 },
  { id: "near", text: "Калории близко к цели", short: "Калории близко к цели", width: 402 },
  { id: "empty", text: "Пока нет записей о еде", short: "Пока нет записей о еде", width: 402 },
  { id: "partial", text: "Если планируешь ещё приём пищи", short: "Записано 800 из 2500 ккал", width: 402 },
  { id: "partial", date: "2026-06-21", text: "Не нужно доедать за прошлый день", short: "За этот день записано", width: 402 },
  { id: "partial", date: "2026-06-23", text: "Это предварительные записи", short: "На выбранную дату записано", width: 402 }
];

for (const scenario of scenarios) {
  test(`nutrition analysis ${scenario.id} ${scenario.date || "today"} at ${scenario.width}`, async ({ page }, testInfo) => {
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.setViewportSize({ width: scenario.width, height: scenario.width === 320 ? 568 : 874 });
    await page.clock.setFixedTime(new Date("2026-06-22T12:00:00+03:00"));
    await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.goto(`/?clientHarness=1&clientHarnessTheme=warm-light&clientNutritionAnalysis=${scenario.id}&clientNutritionDate=${scenario.date || "2026-06-22"}`);
    await page.getByTestId("client-nav-nutrition").click();
    const summary = page.getByTestId("nutrition-summary");
    await expect(summary).toContainText(scenario.short);
    await summary.getByRole("button").click();
    const details = page.getByTestId("nutrition-plan-details");
    await expect(details).toHaveAccessibleName("Анализ питания");
    const conclusion = details.locator('[data-nutrition-plan-text="conclusion"]');
    await expect(conclusion).toContainText(new RegExp(scenario.text, "i"));
    await expect(conclusion).not.toContainText(/На остаток дня|Хороший дефицит|Дальше.*перекусов/);
    if (scenario.id === "over") {
      await expect(details.locator('[data-nutrition-plan-part="calorie-progress"]')).toContainText("113%");
      await expect(details.locator('[data-nutrition-plan-part="calorie-progress"]')).toContainText("Сверх цели");
      await expect(details.locator('[data-nutrition-plan-part="macros"]')).toContainText("139%");
    }
    if (scenario.id === "empty" || scenario.id === "partial" && !scenario.date) {
      await expect(details.getByRole("img", { name: "Недостаточно данных для сравнения с планом" })).toBeVisible();
    }
    await conclusion.scrollIntoViewIfNeeded();
    expect(await details.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`analysis-${scenario.id}-${scenario.width}.png`) });
    await page.getByTestId("nutrition-plan-close").click();
    await expect(details).toHaveCount(0);
    assertNoErrors();
  });
}

test("historical analysis uses the selected plan week and training weekday", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-06-22T12:00:00+03:00"));
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
  const result = await page.evaluate(async () => {
    const { buildNutritionPageModel } = await import("/src/features/client/nutrition/nutritionPageModel.js");
    const totals = { calories: 1000, protein: 80, fat: 30, carbs: 100 };
    const model = buildNutritionPageModel({
      aiNutritionSavedPlan: {
        createdAt: "2026-06-01T12:00:00Z", profile: { goal: "recomp", trainingDays: ["tue"] },
        weeks: [2500, 2600, 2700, 2800].map(calories => ({ calories, protein: 199, fat: 69, carbs: 300 }))
      },
      nutrition: { goals: { calories: 2500, protein: 199, fat: 69, carbs: 300 }, days: {} },
      history: [], nutritionTotals: totals, nutritionDateKey: "2026-06-02", isNutritionToday: false,
      nutritionToday: { foods: [{ ...totals }] }, nutritionMeals: [], expandedNutritionMeals: {},
      nutritionWeekDates: [], nutritionCurrentStreak: 0
    });
    return { goals: model.effectiveNutritionGoals, training: model.isNutritionTrainingDayToday, week: model.aiNutritionCurrentWeek, text: model.aiNutritionDay.summary };
  });
  expect(result.goals.calories).toBe(2630);
  expect(result.goals.carbs).toBe(333);
  expect(Math.abs((result.goals.carbs - 300) * 4 - (result.goals.calories - 2500))).toBeLessThanOrEqual(2);
  expect(result.training).toBe(true);
  expect(result.week).toBe(1);
  expect(result.text).toContain("За этот день");
});
