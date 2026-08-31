import { defaultNutritionState } from "../data/nutritionDefaults.js";
import { buildAiNutritionMonthlyPlan } from "./aiNutritionPlanBuilder.js";
import { getAiNutritionProfileValidation } from "./aiNutritionCalculations.js";

function toNonNegativeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

function getNutritionDayKey(day = {}) {
  const rawDate = day.date || day.createdAt || day.updatedAt || "";
  if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
  const date = typeof rawDate?.toDate === "function" ? rawDate.toDate() : new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildTrainerAiNutritionPlanDraft({
  client = {},
  profile = {},
  history = [],
  nutritionDays = [],
  nutritionGoals = {}
} = {}) {
  const sourceProfile = {
    ...(client?.profile || {}),
    ...(client?.aiNutritionProfile || {}),
    ...(profile || {})
  };
  const validation = getAiNutritionProfileValidation(sourceProfile);
  if (!validation.valid) {
    return {
      ok: false,
      message: `Для AI-плана у клиента нужно заполнить: ${validation.missing.join(", ")}.`
    };
  }

  const days = (Array.isArray(nutritionDays) ? nutritionDays : []).reduce((result, day) => {
    const key = getNutritionDayKey(day);
    if (key) result[key] = day;
    return result;
  }, {});
  const nutrition = {
    ...defaultNutritionState,
    goals: {
      ...defaultNutritionState.goals,
      ...(nutritionGoals || {})
    },
    days
  };
  const aiNutritionPlan = buildAiNutritionMonthlyPlan(
    nutrition,
    sourceProfile,
    Array.isArray(history) ? history : [],
    client?.aiNutritionPlan || null
  );
  const start = aiNutritionPlan?.weeks?.[0] || aiNutritionPlan?.start;
  if (!start) {
    return { ok: false, message: "Не удалось подготовить AI-план. Попробуйте ещё раз." };
  }

  return {
    ok: true,
    message: "AI-план подготовлен по профилю клиента, тренировкам и дневнику. Проверьте КБЖУ и сохраните изменения.",
    aiNutritionPlan,
    planDraft: {
      name: `AI-план · ${aiNutritionPlan.goalLabel || "Индивидуальный"}`,
      goal: aiNutritionPlan.goalLabel || "Индивидуальная цель",
      calories: Math.round(Number(start.calories) || 0),
      protein: Math.round(Number(start.protein) || 0),
      fat: Math.round(Number(start.fat) || 0),
      carbs: Math.round(Number(start.carbs) || 0),
      presetId: "ai"
    }
  };
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
  const aiNutritionPlan = planDraft.aiNutritionPlan && typeof planDraft.aiNutritionPlan === "object"
    ? planDraft.aiNutritionPlan
    : null;
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
    ...(aiNutritionPlan ? { aiNutritionPlan } : {}),
    updatedAt
  };

  return {
    goals,
    nutritionPlan,
    nutritionState,
    userPatch: {
      nutritionGoals: goals,
      nutritionPlan,
      ...(aiNutritionPlan ? { aiNutritionPlan } : {}),
      nutritionPlanUpdatedAt: updatedAt,
      updatedAt
    },
    nutritionStatePatch: {
      goals: nutritionState.goals,
      nutritionPlan,
      ...(aiNutritionPlan ? { aiNutritionPlan } : {}),
      updatedAt
    }
  };
}
