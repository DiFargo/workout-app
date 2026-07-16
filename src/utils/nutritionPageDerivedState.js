import { getNutritionDayTotals } from "./aiNutritionAnalysis";
import { buildNutritionSearchResults } from "./nutritionSearchResults";
import {
  buildNutritionCalendarDays,
  buildNutritionCurrentStreak,
  buildNutritionWeekDates,
  formatNutritionCalendarMonthLabel
} from "./nutritionCalendar";
import { makeEmptyNutritionDay, todayNutritionKey } from "../domain/nutritionPresentation";

export function buildNutritionPageDerivedState(params) {
  const {
    nutrition,
    nutritionSearch,
    nutritionSearchTab,
    fatSecretFoods,
    nutritionSearchResultLimit,
    nutritionCalendarMonthKey,
    nutritionDateKey
  } = params;

  const todayKey = todayNutritionKey();
  const monthKey = String(nutritionCalendarMonthKey || todayKey).slice(0, 7);
  const isNutritionToday = nutritionDateKey === todayKey;
  const nutritionToday = nutrition.days?.[nutritionDateKey] || makeEmptyNutritionDay();
  const nutritionTotals = getNutritionDayTotals(nutritionToday);
  const nutritionSearchResults = buildNutritionSearchResults({
    nutritionSearch,
    nutritionSearchTab,
    nutrition,
    nutritionToday,
    fatSecretFoods
  });
  const nutritionSearchResultKey = `${nutritionSearchTab}:${nutritionSearch.trim().toLowerCase()}`;
  const activeNutritionSearchResultLimit =
    nutritionSearchResultLimit.key === nutritionSearchResultKey
      ? nutritionSearchResultLimit.limit
      : 8;

  return {
    isNutritionToday,
    nutritionToday,
    nutritionTotals,
    nutritionSearchResults,
    nutritionSearchResultKey,
    activeNutritionSearchResultLimit,
    nutritionWeekDates: buildNutritionWeekDates(nutritionDateKey),
    nutritionCurrentStreak: buildNutritionCurrentStreak(nutrition.days || {}, nutritionDateKey || todayKey),
    nutritionCalendarDays: buildNutritionCalendarDays({
      monthKey,
      selectedDateKey: nutritionDateKey,
      nutrition,
      todayKey
    }),
    nutritionCalendarMonthLabel: formatNutritionCalendarMonthLabel(monthKey)
  };
}
