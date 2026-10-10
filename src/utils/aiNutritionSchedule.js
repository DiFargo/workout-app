import { AI_NUTRITION_WEEK_DAYS } from "../data/nutritionPlanning.js";

function getNutritionPlanWeekIndex(plan, date, weekCount) {
  const created = new Date(plan?.createdAt || "");
  const target = new Date(date);
  if (Number.isNaN(created.getTime()) || Number.isNaN(target.getTime())) return 0;

  // Compare calendar days, including across DST; both dashboard and diary
  // start a new plan week at local midnight rather than the creation hour.
  const createdDay = Date.UTC(created.getFullYear(), created.getMonth(), created.getDate());
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.max(0, Math.round((targetDay - createdDay) / 86400000));
  return Math.min(weekCount - 1, Math.floor(diffDays / 7));
}

export function getAiNutritionCurrentWeek(plan, date = new Date()) {
  return getNutritionPlanWeekIndex(plan, date, plan?.weeks?.length || 4) + 1;
}

export function getAiNutritionWeekForDate(plan, date = new Date()) {
  if (!Array.isArray(plan?.weeks) || !plan.weeks.length) return null;

  const weekIndex = getNutritionPlanWeekIndex(plan, date, plan.weeks.length);
  return plan.weeks[weekIndex] || plan.weeks[0];
}

export function getTodayAiNutritionWeekDayId(date = new Date()) {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  const jsDay = Number.isNaN(normalizedDate.getTime()) ? new Date().getDay() : normalizedDate.getDay();
  return AI_NUTRITION_WEEK_DAYS[jsDay === 0 ? 6 : jsDay - 1]?.id || "mon";
}

export function getAiNutritionTrainingDays(profile = {}) {
  return Array.isArray(profile?.trainingDays) ? profile.trainingDays : [];
}

export function isAiNutritionTrainingDay(profile = {}, date = new Date()) {
  return getAiNutritionTrainingDays(profile).includes(getTodayAiNutritionWeekDayId(date));
}

export function getAiNutritionDayMacros(baseMacros, profile = {}, date = new Date()) {
  const macros = {
    calories: Math.round(Number(baseMacros?.calories) || 0),
    protein: Math.round(Number(baseMacros?.protein) || 0),
    fat: Math.round(Number(baseMacros?.fat) || 0),
    carbs: Math.round(Number(baseMacros?.carbs) || 0)
  };

  if (!isAiNutritionTrainingDay(profile, date)) {
    return { ...macros, isTrainingDay: false };
  }

  const goal = profile?.goal || "recomp";
  const calorieBoost = goal === "mass" ? 180 : goal === "dry" ? 90 : goal === "cut" ? 80 : goal === "maintain" ? 70 : 130;
  const carbsBoost = Math.round(calorieBoost / 4);

  return {
    ...macros,
    isTrainingDay: true,
    calories: macros.calories + calorieBoost,
    carbs: macros.carbs + carbsBoost
  };
}
