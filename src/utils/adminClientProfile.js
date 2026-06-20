import { AI_NUTRITION_WEEK_DAYS } from "../data/nutritionPlanning.js";
import { getAiNutritionGoalLabel } from "./aiNutritionLabels.js";

export function getAdminClientProfile(client = {}) {
  return client.profile || client.aiNutritionProfile || client.bodyMetrics || client;
}

export function getAdminClientGoalLabel(goal = "") {
  return getAiNutritionGoalLabel(goal || "recomp");
}

export function getAdminClientTrainingDaysText(profile = {}) {
  const selected = Array.isArray(profile?.trainingDays) ? profile.trainingDays : [];
  if (!selected.length) return "—";

  return AI_NUTRITION_WEEK_DAYS
    .filter((day) => selected.includes(day.id))
    .map((day) => day.short)
    .join(", ");
}
