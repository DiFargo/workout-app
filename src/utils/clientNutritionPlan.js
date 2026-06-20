import { defaultNutritionState } from "../data/nutritionDefaults";
import { getAiNutritionGoalLabel } from "./aiNutritionLabels";
import { getAiNutritionDayMacros, getAiNutritionWeekForDate } from "./aiNutritionSchedule";
import {
  getNutritionPlanMacroNumbers,
  getNutritionPlanTimestamp,
  getNutritionPresetGoalId
} from "./nutritionPlanHelpers";

export function normalizeSimpleNutritionPlanForDisplay(plan = null, fallbackProfile = {}, fallbackGoals = {}) {
  if (!plan) return null;
  if (Array.isArray(plan.weeks) && plan.weeks.length) return plan;

  const macros = getNutritionPlanMacroNumbers(plan, fallbackGoals);
  if (!macros.calories || !macros.protein) return null;

  const goal = getNutritionPresetGoalId(plan, fallbackProfile);
  const updatedAt = plan.updatedAt || plan.createdAt || new Date().toISOString();
  const week = {
    week: 1,
    label: "Текущий план",
    ...macros,
    trainingDay: { ...macros },
    focus: plan.goal || "держать назначенные КБЖУ"
  };

  return {
    id: plan.id || `nutrition_plan_${updatedAt}`,
    version: 1,
    source: plan.source || "trainer",
    createdAt: plan.createdAt || updatedAt,
    updatedAt,
    profile: {
      ...(fallbackProfile || {}),
      goal,
      // Trainer-assigned simple plans are exact daily targets, so the client
      // and trainer must not add an extra training-day boost on top of them.
      trainingDays: Array.isArray(plan.trainingDays) ? plan.trainingDays : []
    },
    goalLabel: plan.name || getAiNutritionGoalLabel(goal),
    start: week,
    weeks: [week, { ...week, week: 2 }, { ...week, week: 3 }, { ...week, week: 4 }],
    comment: plan.goal || "План назначен тренером."
  };
}

export function getClientNutritionDisplayPlan(client = {}, nutritionState = null, fallbackGoals = {}) {
  const assignedPlan = client?.nutritionPlan || nutritionState?.nutritionPlan || null;
  const aiPlan = client?.aiNutritionPlan || nutritionState?.aiNutritionPlan || null;
  const profile = client?.aiNutritionProfile || client?.profile || aiPlan?.profile || {};
  const assignedDisplayPlan = normalizeSimpleNutritionPlanForDisplay(
    assignedPlan,
    profile,
    fallbackGoals
  );

  if (!assignedDisplayPlan) return aiPlan || null;
  if (!aiPlan) return assignedDisplayPlan;

  const assignedTime = getNutritionPlanTimestamp(assignedDisplayPlan);
  const aiTime = getNutritionPlanTimestamp(aiPlan);

  return assignedTime >= aiTime ? assignedDisplayPlan : aiPlan;
}

export function getClientEffectiveNutritionGoals(client = {}, nutritionState = null, fallbackGoals = {}, date = new Date()) {
  const plan = getClientNutritionDisplayPlan(client, nutritionState, fallbackGoals);
  if (!plan) {
    return {
      ...defaultNutritionState.goals,
      ...getNutritionPlanMacroNumbers(fallbackGoals, fallbackGoals)
    };
  }

  const week = getAiNutritionWeekForDate(plan, date) || plan.start || plan.weeks?.[0] || fallbackGoals;
  const profile = plan.profile || client?.aiNutritionProfile || client?.profile || {};
  const macros = getAiNutritionDayMacros(week, profile, date);

  return {
    ...defaultNutritionState.goals,
    calories: Math.round(Number(macros.calories) || defaultNutritionState.goals.calories),
    protein: Math.round(Number(macros.protein) || defaultNutritionState.goals.protein),
    fat: Math.round(Number(macros.fat) || defaultNutritionState.goals.fat),
    carbs: Math.round(Number(macros.carbs) || defaultNutritionState.goals.carbs)
  };
}
