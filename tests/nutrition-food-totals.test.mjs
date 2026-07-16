import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNutritionMealStats,
  sumNutritionFoods
} from "../src/utils/nutritionFoodTotals.js";

test("nutrition food totals sum macros and optional count", () => {
  assert.deepEqual(
    sumNutritionFoods([
      { calories: 100, protein: 10, fat: 3, carbs: 12 },
      { calories: "55", protein: "4", fat: 1, carbs: 8 }
    ], true),
    { calories: 155, protein: 14, fat: 4, carbs: 20, count: 2 }
  );
});

test("nutrition meal stats groups foods by meal id", () => {
  const stats = buildNutritionMealStats([
    { mealId: "breakfast", calories: 120, protein: 10 },
    { mealId: "dinner", calories: 300, protein: 22 },
    { mealId: "breakfast", calories: 80, protein: 4 }
  ], [
    { id: "breakfast" },
    { id: "lunch" },
    { id: "dinner" }
  ]);

  assert.equal(stats.breakfast.calories, 200);
  assert.equal(stats.breakfast.protein, 14);
  assert.equal(stats.breakfast.count, 2);
  assert.equal(stats.lunch.count, 0);
  assert.equal(stats.dinner.calories, 300);
});
