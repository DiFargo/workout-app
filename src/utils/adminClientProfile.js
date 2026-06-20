import { AI_NUTRITION_WEEK_DAYS } from "../data/nutritionPlanning.js";
import { getAiNutritionGoalLabel } from "./aiNutritionLabels.js";

const ADMIN_MEASUREMENT_PREVIEW_FIELD_IDS = [
  "weight",
  "neck",
  "shoulders",
  "chest",
  "biceps",
  "forearm",
  "belly",
  "pelvis",
  "thigh",
  "calf",
  "ankle"
];

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

export function getAdminMeasurementPreviewFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .filter((field) => ADMIN_MEASUREMENT_PREVIEW_FIELD_IDS.includes(field.id));
}
