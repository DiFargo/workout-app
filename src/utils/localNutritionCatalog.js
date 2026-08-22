import { LOCAL_NUTRITION_SEARCH_LIMIT } from "../data/nutritionDefaults";
import {
  findExactLazyNutritionCatalogFoods,
  searchLazyNutritionCatalog
} from "../data/nutrition-catalog/lazyCatalog";
import { normalizeNutritionFood } from "./nutritionFoodModel";

export function normalizeLocalCatalogFood(food = {}) {
  const portionAmount = Number(food.defaultGram || food.defaultAmount || 100) || 100;
  const basisUnit = food.basisUnit || "g";

  return {
    id: food.id || `local_${String(food.name || "").toLowerCase().replace(/\s+/g, "_")}`,
    foodId: food.id || "",
    name: food.name || "Продукт",
    aliases: food.aliases || [],
    brand: food.brand || "",
    barcode: food.barcode || "",
    recordType: food.recordType || "sku",
    category: food.category || "",
    source: food.source || (food.recordType === "reference_food"
      ? "USDA FoodData Central"
      : "Open Food Facts"),
    sourceType: "local_catalog",
    basisUnit,
    portion: basisUnit === "ml" ? `${portionAmount} мл` : `${portionAmount} г`,
    portionAmount,
    defaultGram: portionAmount,
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    fat: Number(food.fat) || 0,
    carbs: Number(food.carbs) || 0,
    icon: food.emoji || food.icon || "🍽️",
    emoji: food.emoji || food.icon || "🍽️",
    portionTypes: food.portionTypes || []
  };
}

export async function searchLocalNutritionFoods(query, limit = LOCAL_NUTRITION_SEARCH_LIMIT) {
  const foods = await searchLazyNutritionCatalog(query, limit);
  return foods.map(normalizeLocalCatalogFood);
}

export async function findExactLocalNutritionFoods(query) {
  const foods = await findExactLazyNutritionCatalogFoods(query);
  return foods.map(normalizeLocalCatalogFood);
}

export function mergeNutritionFoodResults(primary = [], secondary = [], limit = 40) {
  const map = new Map();

  [...primary, ...secondary].forEach((food) => {
    const normalizedFood = normalizeNutritionFood(food);
    const key = normalizedFood.id || normalizedFood.foodId || normalizedFood.name;
    if (key && !map.has(key)) {
      map.set(key, normalizedFood);
    }
  });

  return Array.from(map.values()).slice(0, limit);
}
