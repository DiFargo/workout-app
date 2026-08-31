import { LOCAL_NUTRITION_SEARCH_LIMIT } from "../data/nutritionDefaults.js";
import { nutritionFoodDatabase } from "../data/nutritionFoods.js";
import {
  findLazyNutritionCatalogByBarcode,
  findExactLazyNutritionCatalogFoods,
  searchLazyNutritionCatalog
} from "../data/nutrition-catalog/lazyCatalog.js";
import { normalizeNutritionQuery } from "../data/nutrition-catalog/catalogSearch.js";
import { normalizeNutritionFood } from "./nutritionFoodModel.js";

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

// This compact set ships in the application bundle, unlike the larger lazy
// catalog. It keeps common searches usable when the connection changes before
// the catalog chunks can be fetched.
export function searchBundledNutritionFallbackFoods(query, limit = LOCAL_NUTRITION_SEARCH_LIMIT) {
  const normalizedQuery = normalizeNutritionQuery(query);
  if (normalizedQuery.length < 2) return [];

  const normalizedLimit = Math.max(1, Number.parseInt(limit, 10) || LOCAL_NUTRITION_SEARCH_LIMIT);
  return nutritionFoodDatabase
    .filter((food) => [food.name, ...(food.aliases || [])]
      .some((value) => normalizeNutritionQuery(value).includes(normalizedQuery)))
    .slice(0, normalizedLimit)
    .map(normalizeLocalCatalogFood);
}

export async function findExactLocalNutritionFoods(query) {
  const foods = await findExactLazyNutritionCatalogFoods(query);
  return foods.map(normalizeLocalCatalogFood);
}

export async function findLocalNutritionFoodByBarcode(barcode) {
  const food = await findLazyNutritionCatalogByBarcode(barcode);
  return food ? normalizeLocalCatalogFood(food) : null;
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
