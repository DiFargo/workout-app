import { buildNutritionOrbitItems } from "../../../domain/nutritionOrbitItems";
import {
  formatNutritionDateLabel,
  getNutritionOrbitSegment,
  nutritionKeyToDate
} from "../../../domain/nutritionPresentation";
import { buildAiNutritionDayModel } from "../../../utils/aiNutritionAnalysis";
import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import {
  buildAiNutritionMonthlyPlan
} from "../../../utils/aiNutritionPlanBuilder";
import {
  getAiNutritionCurrentWeek,
  getAiNutritionDayMacros,
  isAiNutritionTrainingDay
} from "../../../utils/aiNutritionSchedule";
import { getClientNutritionDisplayPlan } from "../../../utils/clientNutritionPlan";
import { buildNutritionSummaryCollapsedText } from "../../../utils/nutritionAdvice";
import { buildNutritionMealStats } from "../../../utils/nutritionFoodTotals";
import { roundMacro } from "../../../utils/nutritionNumbers";
import { getTrainerDayWord } from "../../../utils/trainerClientSummary";

export function buildNutritionPageModel({
  aiNutritionSavedPlan,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  nutrition,
  history,
  nutritionTotals,
  nutritionDateKey,
  isNutritionToday,
  nutritionToday,
  nutritionMeals,
  expandedNutritionMeals,
  nutritionWeekDates,
  nutritionCurrentStreak
}) {
  const preliminaryAiNutritionPlan = getClientNutritionDisplayPlan(
    {
      aiNutritionPlan: aiNutritionSavedPlan,
      aiNutritionProfile,
      profile: aiNutritionProfile,
      nutritionPlan: nutrition.nutritionPlan
    },
    nutrition,
    nutrition.goals
  ) || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);

  const preliminaryAiNutritionWeekNumber = getAiNutritionCurrentWeek(preliminaryAiNutritionPlan);
  const preliminaryAiNutritionProfile = preliminaryAiNutritionPlan?.profile || aiNutritionProfile || aiNutritionProfileDraft;
  const preliminaryAiNutritionWeek = preliminaryAiNutritionPlan?.weeks?.[preliminaryAiNutritionWeekNumber - 1] || preliminaryAiNutritionPlan?.weeks?.[0];
  const preliminaryAiNutritionTodayMacros = getAiNutritionDayMacros(preliminaryAiNutritionWeek || nutrition.goals, preliminaryAiNutritionProfile);
  const effectiveNutritionGoals = {
    ...nutrition.goals,
    calories: Math.round(Number(preliminaryAiNutritionTodayMacros?.calories) || nutrition.goals.calories),
    protein: Math.round(Number(preliminaryAiNutritionTodayMacros?.protein) || nutrition.goals.protein),
    fat: Math.round(Number(preliminaryAiNutritionTodayMacros?.fat) || nutrition.goals.fat),
    carbs: Math.round(Number(preliminaryAiNutritionTodayMacros?.carbs) || nutrition.goals.carbs)
  };

  const caloriePercentRaw = Math.round((nutritionTotals.calories / Math.max(1, effectiveNutritionGoals.calories)) * 100);
  const caloriePercent = Math.min(100, caloriePercentRaw);
  const isCaloriesOverGoal = nutritionTotals.calories > effectiveNutritionGoals.calories;
  const caloriesLeft = Math.max(0, Math.round(effectiveNutritionGoals.calories - nutritionTotals.calories));
  const caloriesConsumed = Math.round(nutritionTotals.calories);
  const proteinPercent = Math.min(100, Math.round((nutritionTotals.protein / effectiveNutritionGoals.protein) * 100));
  const fatPercent = Math.min(100, Math.round((nutritionTotals.fat / effectiveNutritionGoals.fat) * 100));
  const carbsPercent = Math.min(100, Math.round((nutritionTotals.carbs / effectiveNutritionGoals.carbs) * 100));
  const weekDates = nutritionWeekDates;
  const selectedNutritionDate = nutritionKeyToDate(nutritionDateKey);
  const nutritionStreakText = `Серия записи еды — ${nutritionCurrentStreak} ${getTrainerDayWord(nutritionCurrentStreak)} 🔥`;
  const nutritionDateTitle = isNutritionToday
    ? "Сегодня"
    : formatNutritionDateLabel(selectedNutritionDate).replace(/^./, (char) => char.toUpperCase());
  const mealStats = buildNutritionMealStats(nutritionToday.foods || [], nutritionMeals);
  const nutritionZoukFoodsCount = (nutritionToday.foods || []).length;
  const activeNutritionMeal = nutritionMeals.find((meal) => expandedNutritionMeals[meal.id]) || null;
  const activeNutritionMealFoods = activeNutritionMeal
    ? (nutritionToday.foods || []).filter((item) => item.mealId === activeNutritionMeal.id)
    : [];
  const activeNutritionMealStats = activeNutritionMeal
    ? mealStats[activeNutritionMeal.id] || { calories: 0, count: 0 }
    : { calories: 0, count: 0 };
  const aiNutritionDay = buildAiNutritionDayModel({ ...nutrition, goals: effectiveNutritionGoals }, nutritionToday, history);
  const aiNutritionActivePlan = preliminaryAiNutritionPlan || buildAiNutritionMonthlyPlan(nutrition);
  const aiNutritionGoal = aiNutritionActivePlan?.profile?.goal || aiNutritionProfile?.goal || "recomp";
  const aiNutritionGoalText =
    aiNutritionGoal === "recomp"
      ? "Рекомпозиция"
      : getAiNutritionGoalLabel(aiNutritionGoal);
  const aiNutritionCurrentWeek = preliminaryAiNutritionWeekNumber;
  const aiNutritionPageProfile = preliminaryAiNutritionProfile;
  const isNutritionTrainingDayToday = isAiNutritionTrainingDay(aiNutritionPageProfile);
  const aiNutritionTodayPlanMacros = preliminaryAiNutritionTodayMacros;
  const macroCaloriesProtein = Math.max(0, Number(nutritionTotals.protein) || 0) * 4;
  const macroCaloriesFat = Math.max(0, Number(nutritionTotals.fat) || 0) * 9;
  const macroCaloriesCarbs = Math.max(0, Number(nutritionTotals.carbs) || 0) * 4;
  const macroCaloriesTotal = Math.max(1, macroCaloriesProtein + macroCaloriesFat + macroCaloriesCarbs);
  const proteinScoreSegment = Math.round((macroCaloriesProtein / macroCaloriesTotal) * 100);
  const fatScoreSegment = Math.round((macroCaloriesFat / macroCaloriesTotal) * 100);
  const carbsScoreSegment = Math.max(0, 100 - proteinScoreSegment - fatScoreSegment);
  const nutritionScoreSegments = [
    { id: "protein", offset: 0, value: proteinScoreSegment },
    { id: "fat", offset: proteinScoreSegment, value: fatScoreSegment },
    { id: "carbs", offset: proteinScoreSegment + fatScoreSegment, value: carbsScoreSegment }
  ];
  const nutritionSummaryCollapsedText = buildNutritionSummaryCollapsedText({
    isCaloriesOverGoal,
    proteinPercent,
    caloriePercent
  });
  const nutritionOrbitItems = buildNutritionOrbitItems({
    nutritionTotals,
    effectiveNutritionGoals,
    caloriesConsumed,
    caloriePercent,
    proteinPercent,
    carbsPercent,
    fatPercent,
    roundMacro,
    getNutritionOrbitSegment
  });

  return {
    effectiveNutritionGoals,
    caloriePercent,
    isCaloriesOverGoal,
    caloriesLeft,
    caloriesConsumed,
    proteinPercent,
    fatPercent,
    carbsPercent,
    weekDates,
    nutritionStreakText,
    nutritionDateTitle,
    mealStats,
    nutritionZoukFoodsCount,
    activeNutritionMeal,
    activeNutritionMealFoods,
    activeNutritionMealStats,
    aiNutritionDay,
    aiNutritionGoalText,
    aiNutritionCurrentWeek,
    isNutritionTrainingDayToday,
    aiNutritionTodayPlanMacros,
    nutritionScoreSegments,
    nutritionSummaryCollapsedText,
    nutritionOrbitItems
  };
}
