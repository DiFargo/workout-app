import { nutritionFoodDatabase } from "../data/nutritionFoods";
import {
  limitSimilarNutritionFoods,
  rankAndDedupeNutritionFoods
} from "./auditSafety";
import { getNutritionFoodSearchText } from "./nutritionFoodPresentation";
import { normalizeNutritionFood } from "./nutritionFoodModel";

export function buildMyNutritionFoods(myFoods = {}) {
  return Object.values(myFoods || {})
    .sort((a, b) => (Number(b.useCount) || 0) - (Number(a.useCount) || 0))
    .map(normalizeNutritionFood);
}

export function buildNutritionSearchResults({
  nutritionSearch = "",
  nutritionSearchTab = "all",
  nutrition = {},
  nutritionToday = {},
  fatSecretFoods = []
} = {}) {
  const query = String(nutritionSearch || "").trim().toLowerCase();
  const recentIds = nutrition.recent || [];
  const favoriteIds = nutrition.favorites || [];

  // The picker is normally closed with an empty query. Avoid sorting and
  // normalizing the whole personal catalog during every diary update.
  if (!query && !["my", "recent", "favorites"].includes(nutritionSearchTab)) {
    return [];
  }

  const myFoods = buildMyNutritionFoods(nutrition.myFoods || {});

  if (nutritionSearchTab === "my") {
    if (query.length >= 2) {
      return myFoods
        .filter((food) => getNutritionFoodSearchText(food).includes(query))
        .slice(0, 30);
    }

    return myFoods.slice(0, 30);
  }

  if (nutritionSearchTab === "recent") {
    const localFoods = nutritionFoodDatabase.map(normalizeNutritionFood);
    return recentIds
      .map((id) =>
        myFoods.find((food) => food.id === id || food.foodId === id) ||
        localFoods.find((food) => food.id === id) ||
        (nutritionToday.foods || []).find((food) => food.foodId === id || food.id === id)
      )
      .filter(Boolean)
      .map(normalizeNutritionFood)
      .slice(0, 20);
  }

  if (nutritionSearchTab === "favorites") {
    const localFoods = nutritionFoodDatabase.map(normalizeNutritionFood);
    return favoriteIds
      .map((id) =>
        myFoods.find((food) => food.id === id || food.foodId === id) ||
        localFoods.find((food) => food.id === id) ||
        (nutritionToday.foods || []).find((food) => food.foodId === id || food.id === id)
      )
      .filter(Boolean)
      .map(normalizeNutritionFood)
      .slice(0, 20);
  }

  if (query.length >= 1) {
    const personalMatches = rankAndDedupeNutritionFoods(
      myFoods.filter((food) => getNutritionFoodSearchText(food).includes(query)),
      query,
      20
    );

    if (query.length >= 2 && fatSecretFoods.length > 0) {
      return limitSimilarNutritionFoods(
        rankAndDedupeNutritionFoods(
          [...personalMatches, ...fatSecretFoods.map(normalizeNutritionFood)],
          query,
          30
        ),
        30,
        2
      );
    }

    return personalMatches;
  }

  return [];
}
