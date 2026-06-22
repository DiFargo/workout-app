import { getDefaultNutritionMealByTime } from "../../../domain/nutritionPresentation";
import {
  detectNutritionAmountMode,
  getNutritionBaseMacroFood
} from "../../../utils/nutritionFoodModel";
import { parseNutritionNumber } from "../../../utils/nutritionNumbers";
import { getFoodPortionAmount } from "../../../utils/nutritionPortions";
import { loadRecentNutritionFoods } from "../../../utils/nutritionPreferenceStorage";

export function createNutritionFoodEntryHandlers({
  resetNutritionPhotoAiState,
  setEditingNutritionItemId,
  setNutritionAmount,
  setNutritionAmountError,
  setNutritionAmountMode,
  setNutritionCreateChoiceOpen,
  setNutritionEditDetailsOpen,
  setNutritionEditNote,
  setNutritionFallbackSuggestions,
  setNutritionMeal,
  setNutritionMealMenuOpen,
  setNutritionPickerOpen,
  setNutritionProductErrors,
  setNutritionSearch,
  setNutritionSearchTab,
  setRecentNutritionFoods,
  setSelectedNutritionFood,
  setShowRecentNutritionFoods
}) {
  function openNutritionPicker(mealId) {
    const targetMealId = mealId || getDefaultNutritionMealByTime();
    resetNutritionPhotoAiState();
    setNutritionMeal(targetMealId);
    setNutritionSearch("");
    setNutritionSearchTab("food");
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(false);
    setNutritionCreateChoiceOpen(false);
    setEditingNutritionItemId(null);
    setSelectedNutritionFood(null);
    setNutritionFallbackSuggestions([]);
    setRecentNutritionFoods(loadRecentNutritionFoods());
    setShowRecentNutritionFoods(false);
    setNutritionPickerOpen(true);
  }

  function openNutritionFoodEditor(item) {
    const numericAmount = parseNutritionNumber(item.amount, 100) || 100;
    const foodForEdit = getNutritionBaseMacroFood(
      {
        ...item,
        id: item.foodId || item.id,
        foodId: item.foodId || item.id,
        source: item.source || "Дневник",
        portionAmount: Number(item.portionAmount) || (item.amountMode === "portion" ? numericAmount : getFoodPortionAmount(item)),
        totalWeight: Number(item.totalWeight) || Number(item.portionAmount) || 0,
        amountMode: item.amountMode || ""
      },
      numericAmount,
      item.amountMode || "grams"
    );

    const detectedAmountMode = detectNutritionAmountMode(foodForEdit, numericAmount, item.amountMode);

    setNutritionMeal(item.mealId || "breakfast");
    setNutritionAmount(String(numericAmount));
    setNutritionAmountMode(detectedAmountMode);
    setNutritionEditNote(item.note || "");
    setNutritionEditDetailsOpen(false);
    setEditingNutritionItemId(item.id);
    setSelectedNutritionFood(foodForEdit);
    setNutritionMealMenuOpen(false);
    setNutritionPickerOpen(true);
  }

  return {
    openNutritionPicker,
    openNutritionFoodEditor
  };
}
