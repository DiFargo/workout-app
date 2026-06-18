function toNonNegativeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

export function buildTrainerNutritionPlanUpdate({
  planDraft = {},
  currentNutrition = {},
  updatedAt = new Date().toISOString(),
  updatedBy = ""
} = {}) {
  const goals = {
    calories: toNonNegativeNumber(planDraft.calories),
    protein: toNonNegativeNumber(planDraft.protein),
    fat: toNonNegativeNumber(planDraft.fat),
    carbs: toNonNegativeNumber(planDraft.carbs)
  };
  const presetId = String(planDraft.presetId || planDraft.preset || "custom").trim() || "custom";
  const nutritionPlan = {
    name: String(planDraft.name || "Индивидуальный план").trim() || "Индивидуальный план",
    ...goals,
    presetId,
    preset: presetId,
    goal: String(planDraft.goal || "").trim(),
    validFrom: String(planDraft.validFrom || "").trim(),
    validTo: String(planDraft.validTo || "").trim(),
    source: "trainer",
    updatedAt,
    updatedBy
  };
  const nutritionState = {
    ...(currentNutrition || {}),
    goals: {
      ...((currentNutrition || {}).goals || {}),
      ...goals
    },
    nutritionPlan,
    updatedAt
  };

  return {
    goals,
    nutritionPlan,
    nutritionState,
    userPatch: {
      nutritionGoals: goals,
      nutritionPlan,
      nutritionPlanUpdatedAt: updatedAt,
      updatedAt
    },
    nutritionStatePatch: {
      goals: nutritionState.goals,
      nutritionPlan,
      updatedAt
    }
  };
}
