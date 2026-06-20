import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminNutritionDaysList,
  buildAdminNutritionMonthOverview,
  buildAdminNutritionRecommendations
} from "../src/utils/trainerNutritionInsights.js";

test("trainer nutrition days are sorted and include totals with score", () => {
  const days = buildAdminNutritionDaysList({
    days: {
      "2026-06-18": { foods: [{ calories: 120, protein: 12 }] },
      "2026-06-20": { foods: [{ calories: 300, protein: 20 }, { calories: 100, fat: 5 }] }
    }
  }, {
    buildDayModel: (_nutrition, day) => ({ score: day.foods.length + 6 })
  });

  assert.deepEqual(days.map((day) => day.date), ["2026-06-20", "2026-06-18"]);
  assert.equal(days[0].totals.calories, 400);
  assert.equal(days[0].totals.protein, 20);
  assert.equal(days[0].totals.fat, 5);
  assert.equal(days[0].score, 8);
});

test("trainer nutrition month overview builds calendar grid and averages", () => {
  const overview = buildAdminNutritionMonthOverview([
    { date: "2026-06-20", totals: { calories: 2000, protein: 150 }, foods: [{}] },
    { date: "2026-06-18", totals: { calories: 1600, protein: 110 }, foods: [{}] },
    { date: "2026-05-31", totals: { calories: 900, protein: 60 }, foods: [{}] }
  ], {
    todayKey: "2026-06-20"
  });

  assert.equal(overview.days.length, 42);
  assert.equal(overview.days[0].key, "2026-06-01");
  assert.equal(overview.days[19].isToday, true);
  assert.equal(overview.days[19].day.totals.calories, 2000);
  assert.equal(overview.averageCalories, 1800);
  assert.equal(overview.averageProtein, 130);
  assert.equal(overview.trackedDaysCount, 2);
  assert.match(overview.label, /июн/);
});

test("trainer nutrition recommendations highlight actionable issues", () => {
  const recommendations = buildAdminNutritionRecommendations({
    profile: {},
    historyList: [
      { date: "2026-06-10T10:00:00.000Z", postWorkoutFeedback: { id: "bad" } },
      { date: "2026-06-09T10:00:00.000Z", postWorkoutFeedback: { id: "bad" } }
    ],
    nutritionState: { goals: { protein: 150 } },
    days: [{ totals: { protein: 80 } }],
    defaultProteinGoal: 120,
    now: Date.parse("2026-06-20T10:00:00.000Z")
  });

  assert.deepEqual(recommendations, [
    "Снизить нагрузку на 1 неделю: у клиента несколько плохих feedback.",
    "Добавить белок: сегодня заметно меньше цели.",
    "Клиент давно не тренировался — стоит написать и упростить вход в тренировку.",
    "Обновить анкету/AI-план: не заполнена цель клиента."
  ]);
});

test("trainer nutrition recommendations stay positive when no action is needed", () => {
  const recommendations = buildAdminNutritionRecommendations({
    profile: { goal: "recomp" },
    historyList: [{ date: "2026-06-20T10:00:00.000Z" }],
    nutritionState: { goals: { protein: 150 } },
    days: [{ totals: { protein: 140 } }],
    now: Date.parse("2026-06-20T12:00:00.000Z")
  });

  assert.deepEqual(recommendations, ["Клиент выглядит стабильно: можно продолжать текущий план."]);
});
