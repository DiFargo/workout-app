import { parseNutritionNumber } from "./nutritionNumbers";

export function recalcDishFromIngredients(ingredients = []) {
  return (Array.isArray(ingredients) ? ingredients : []).reduce((sum, ingredient) => {
    const scale = parseNutritionNumber(ingredient.grams, 0) / (parseNutritionNumber(ingredient.baseAmount, 100) || 100);

    return {
      calories: sum.calories + (Number(ingredient.baseCalories) || 0) * scale,
      protein: sum.protein + (Number(ingredient.baseProtein) || 0) * scale,
      fat: sum.fat + (Number(ingredient.baseFat) || 0) * scale,
      carbs: sum.carbs + (Number(ingredient.baseCarbs) || 0) * scale
    };
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
}

export function sumDishIngredientWeight(ingredients = []) {
  return (Array.isArray(ingredients) ? ingredients : []).reduce(
    (sum, item) => sum + parseNutritionNumber(item.grams, 0),
    0
  );
}
