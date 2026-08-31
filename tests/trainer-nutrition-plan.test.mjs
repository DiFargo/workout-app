import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrainerAiNutritionPlanDraft,
  buildTrainerNutritionPlanUpdate
} from "../src/utils/trainerNutritionPlan.js";

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

test("trainer prepares an AI nutrition draft from client data without saving it", () => {
  const result = buildTrainerAiNutritionPlanDraft({
    client: { id: "client_1" },
    profile: {
      weight: 82,
      targetWeight: 78,
      height: 181,
      age: 31,
      sex: "male",
      activity: "medium",
      goal: "dry",
      trainingDays: ["mon", "wed", "fri"]
    },
    history: [{ date: "2026-08-20", workoutName: "Силовая" }],
    nutritionDays: [{
      date: "2026-08-21",
      foods: [{ name: "Творог", calories: 160, protein: 25, fat: 5, carbs: 3 }],
      totals: { calories: 2100, protein: 165, fat: 68, carbs: 205 }
    }],
    nutritionGoals: { calories: 2300, protein: 175, fat: 65, carbs: 230 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.planDraft.presetId, "ai");
  assert.equal(result.aiNutritionPlan.weeks.length, 4);
  assert.equal(result.aiNutritionPlan.profile.weight, "82");
  assert.equal(result.aiNutritionPlan.workoutsCount, 1);
  assert.match(result.message, /сохраните изменения/i);
});

test("trainer AI plan asks for missing client metrics and persists only after save", () => {
  const missing = buildTrainerAiNutritionPlanDraft({
    profile: { weight: 80, sex: "male" }
  });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /целевой вес/);

  const aiNutritionPlan = { id: "ai_nutrition_test", weeks: [{ calories: 2200 }] };
  const update = buildTrainerNutritionPlanUpdate({
    planDraft: {
      name: "AI-план",
      calories: 2200,
      protein: 170,
      fat: 65,
      carbs: 225,
      aiNutritionPlan
    }
  });
  assert.equal(update.userPatch.aiNutritionPlan, aiNutritionPlan);
  assert.equal(update.nutritionStatePatch.aiNutritionPlan, aiNutritionPlan);
});
