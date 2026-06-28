import { AI_NUTRITION_WEEK_DAYS } from "../data/nutritionPlanning";

export function getAiNutritionCurrentWeek(plan) {
  if (!plan?.createdAt) return 1;
  const created = new Date(plan.createdAt);
  if (Number.isNaN(created.getTime())) return 1;
  const diffDays = Math.max(0, Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)));
  return Math.min(4, Math.floor(diffDays / 7) + 1);
}

export function getAiNutritionWeekForDate(plan, date = new Date()) {
  if (!Array.isArray(plan?.weeks) || !plan.weeks.length) return null;

  const created = new Date(plan.createdAt);
  const target = new Date(date);
  if (Number.isNaN(created.getTime()) || Number.isNaN(target.getTime())) return plan.weeks[0];

  created.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.max(0, Math.floor((target.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)));
  const weekIndex = Math.min(plan.weeks.length - 1, Math.floor(diffDays / 7));
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
  const carbsBoost = goal === "dry" ? 25 : goal === "cut" ? 20 : goal === "maintain" ? 18 : 35;

  return {
    ...macros,
    isTrainingDay: true,
    calories: macros.calories + calorieBoost,
    carbs: macros.carbs + carbsBoost
  };
}
