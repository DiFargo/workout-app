import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainerNutritionPlanUpdate } from "../src/utils/trainerNutritionPlan.js";

test("trainer nutrition plan writes identical goals to user and nutrition state", () => {
  const update = buildTrainerNutritionPlanUpdate({
    planDraft: {
      presetId: "recomp",
      name: "Рекомпозиция",
      goal: "Снижение жира и сохранение мышц",
      calories: 2300,
      protein: 180,
      fat: 70,
      carbs: 235
    },
    currentNutrition: {
      goals: { calories: 2595, protein: 191, fat: 69, carbs: 303 }
    },
    updatedAt: "2026-06-18T10:00:00.000Z",
    updatedBy: "trainer_1"
  });

  assert.deepEqual(update.userPatch.nutritionGoals, {
    calories: 2300,
    protein: 180,
    fat: 70,
    carbs: 235
  });
  assert.deepEqual(update.nutritionStatePatch.goals, update.userPatch.nutritionGoals);
  assert.deepEqual(update.nutritionState.goals, update.userPatch.nutritionGoals);
  assert.equal(update.userPatch.nutritionPlan.calories, update.nutritionStatePatch.nutritionPlan.calories);
  assert.equal(update.userPatch.nutritionPlan.presetId, "recomp");
  assert.equal(update.userPatch.nutritionPlan.source, "trainer");
});

test("trainer nutrition plan preserves plan validity dates and normalizes invalid numbers", () => {
  const update = buildTrainerNutritionPlanUpdate({
    planDraft: {
      calories: "2100",
      protein: "170",
      fat: "",
      carbs: "190",
      validFrom: "2026-06-18",
      validTo: "2026-07-18"
    },
    updatedAt: "2026-06-18T10:00:00.000Z"
  });

  assert.equal(update.goals.calories, 2100);
  assert.equal(update.goals.fat, 0);
  assert.equal(update.nutritionPlan.validFrom, "2026-06-18");
  assert.equal(update.nutritionPlan.validTo, "2026-07-18");
});
