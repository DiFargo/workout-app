import { defaultNutritionState } from "../data/nutritionDefaults";
import { getTimestampValue } from "./auditSafety";

export function getNutritionPlanTimestamp(plan = {}) {
  return getTimestampValue(plan?.updatedAt || plan?.createdAt || plan?.assignedAt || "");
}

export function getNutritionPresetGoalId(plan = {}, fallbackProfile = {}) {
  const value = String(plan?.presetId || plan?.preset || plan?.goalId || fallbackProfile?.goal || "").trim();
  if (value === "maintenance" || value === "maintain") return "maintain";
  if (value === "recomposition" || value === "recomp") return "recomp";
  if (value === "fat_loss" || value === "cut") return "cut";
  if (value === "cutting" || value === "dry") return "dry";
  if (value === "mass_gain" || value === "mass" || value === "muscle_gain") return "mass";
  return fallbackProfile?.goal || "recomp";
}

export function getNutritionPlanMacroNumbers(plan = {}, fallbackGoals = {}) {
  const source = plan?.start || plan?.weeks?.[0] || plan || {};
  return {
    calories: Math.round(Number(source.calories || fallbackGoals.calories) || defaultNutritionState.goals.calories),
    protein: Math.round(Number(source.protein || fallbackGoals.protein) || defaultNutritionState.goals.protein),
    fat: Math.round(Number(source.fat || fallbackGoals.fat) || defaultNutritionState.goals.fat),
    carbs: Math.round(Number(source.carbs || fallbackGoals.carbs) || defaultNutritionState.goals.carbs)
  };
}
