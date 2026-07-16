import { recalcDishFromIngredients, sumDishIngredientWeight } from "../../../utils/nutritionDish";
import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel";
import { getFoodPortionAmount } from "../../../utils/nutritionPortions";
import { getFoodIcon } from "../../../utils/nutritionFoodPresentation";
import { parseNutritionNumber, roundMacro } from "../../../utils/nutritionNumbers";

export function createNutritionDishIngredientHandlers({
  setDishIngredientPickerOpen,
  setDishIngredientSearch,
  setNutritionProductErrors,
  setSelectedNutritionFood
}) {
  function updateSelectedDishTotalWeight(value) {
    const numericWeight = parseNutritionNumber(value, 0);
    const cleanValue = String(value ?? "");
    setNutritionProductErrors((current) => ({ ...current, portionAmount: "" }));

    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        totalWeight: cleanValue,
        portionAmount: cleanValue,
        portion: `${numericWeight > 0 ? cleanValue : ""} г`
      };
    });
  }

  function openDishIngredientPicker() {
    setDishIngredientSearch("");
    setDishIngredientPickerOpen(true);
  }

  function addSelectedDishIngredientFromFood(food, gramsValue = 100) {
    const normalizedFood = normalizeNutritionFood(food);
    const grams = parseNutritionNumber(gramsValue, 100) || 100;
    const baseAmount = normalizedFood.type === "dish"
      ? (Number(normalizedFood.totalWeight) || Number(normalizedFood.portionAmount) || getFoodPortionAmount(normalizedFood) || 100)
      : 100;

    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const ingredients = Array.isArray(prev.ingredients) ? prev.ingredients : [];

      const nextIngredients = [
        ...ingredients,
        {
          id: `ingredient_${Date.now()}`,
          foodId: normalizedFood.foodId || normalizedFood.id,
          name: normalizedFood.name,
          grams,
          icon: normalizedFood.icon || getFoodIcon(normalizedFood),
          baseAmount,
          baseCalories: Number(normalizedFood.calories) || 0,
          baseProtein: Number(normalizedFood.protein) || 0,
          baseFat: Number(normalizedFood.fat) || 0,
          baseCarbs: Number(normalizedFood.carbs) || 0
        }
      ];

      const totals = recalcDishFromIngredients(nextIngredients);
      const totalWeight = sumDishIngredientWeight(nextIngredients);

      return {
        ...prev,
        ingredients: nextIngredients,
        totalWeight: totalWeight || prev.totalWeight || prev.portionAmount || 100,
        portionAmount: totalWeight || prev.portionAmount || 100,
        portion: `${totalWeight || prev.portionAmount || 100} г`,
        calories: Math.round(totals.calories),
        protein: roundMacro(totals.protein),
        fat: roundMacro(totals.fat),
        carbs: roundMacro(totals.carbs)
      };
    });

    setDishIngredientPickerOpen(false);
    setDishIngredientSearch("");
  }

  function removeSelectedDishIngredient(ingredientId) {
    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const nextIngredients = (prev.ingredients || []).filter((item) => item.id !== ingredientId);
      const totals = recalcDishFromIngredients(nextIngredients);
      const totalWeight = sumDishIngredientWeight(nextIngredients);

      return {
        ...prev,
        ingredients: nextIngredients,
        totalWeight: totalWeight || 0,
        portionAmount: totalWeight || 0,
        portion: `${totalWeight || ""} г`,
        calories: Math.round(totals.calories),
        protein: roundMacro(totals.protein),
        fat: roundMacro(totals.fat),
        carbs: roundMacro(totals.carbs)
      };
    });
  }

  return {
    updateSelectedDishTotalWeight,
    openDishIngredientPicker,
    addSelectedDishIngredientFromFood,
    removeSelectedDishIngredient
  };
}
