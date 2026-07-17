import { useMemo } from "react";
import { buildNutritionPageModel } from "./nutritionPageModel";

/**
 * Keeps expensive nutrition-derived values out of AppCore render cycles.
 * Firebase mutations remain owned by the existing nutrition handlers; this hook
 * only derives the immutable view model consumed by the Nutrition route.
 */
export function useNutritionPageData({
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
  return useMemo(
    () => buildNutritionPageModel({
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
    }),
    [
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
    ]
  );
}
