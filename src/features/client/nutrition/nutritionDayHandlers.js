import {
  makeEmptyNutritionDay,
  todayNutritionKey
} from "../../../domain/nutritionPresentation.js";
import { findLazyNutritionCatalogByBarcode } from "../../../data/nutrition-catalog/lazyCatalog.js";
import { shiftNutritionCalendarMonthKey } from "../../../utils/nutritionCalendar.js";

export function createNutritionDayHandlers({
  nutritionBarcode,
  nutritionDateKey,
  nutritionFoodDatabase,
  nutritionPhotoName,
  addNutritionFood,
  findCatalogFoodByBarcode = findLazyNutritionCatalogByBarcode,
  setExpandedNutritionMeals,
  setNutrition,
  setNutritionBarcode,
  setNutritionCalendarMonthKey,
  setNutritionCalendarOpen,
  setNutritionSearch,
  setSelectedNutritionDateKey
}) {
  function selectNutritionDate(key) {
    setSelectedNutritionDateKey(key);
    setNutritionCalendarMonthKey(String(key || todayNutritionKey()).slice(0, 7));
    setNutritionCalendarOpen(false);
    setExpandedNutritionMeals({});
  }

  function openNutritionCalendar() {
    setNutritionCalendarMonthKey(String(nutritionDateKey || todayNutritionKey()).slice(0, 7));
    setNutritionCalendarOpen(true);
  }

  function shiftNutritionCalendarMonth(offset) {
    setNutritionCalendarMonthKey((current) => shiftNutritionCalendarMonthKey(current, offset));
  }

  function updateNutritionDay(updater) {
    setNutrition((prev) => {
      const currentDay = prev.days?.[nutritionDateKey] || makeEmptyNutritionDay();
      const nextDay = updater(currentDay);
      return {
        ...prev,
        days: {
          ...prev.days,
          [nutritionDateKey]: {
            ...nextDay,
            updatedAt: new Date().toISOString()
          }
        }
      };
    });
  }

  function toggleNutritionFavorite(foodId) {
    setNutrition((prev) => {
      const isFavorite = prev.favorites.includes(foodId);
      return {
        ...prev,
        favorites: isFavorite
          ? prev.favorites.filter((id) => id !== foodId)
          : [foodId, ...prev.favorites]
      };
    });
  }

  function addWater(amount) {
    updateNutritionDay((day) => ({
      ...day,
      water: Math.max(0, (Number(day.water) || 0) + amount)
    }));
  }

  function updateBodyWeight(value) {
    updateNutritionDay((day) => ({
      ...day,
      weight: value
    }));
  }

  async function findFoodByBarcode(value = nutritionBarcode) {
    const barcode = String(value || "").trim();
    if (!barcode) return null;

    let food = null;
    try {
      food = await findCatalogFoodByBarcode(barcode);
    } catch (error) {
      console.warn("Nutrition catalog barcode lookup failed:", error);
    }
    if (!food) food = nutritionFoodDatabase.find((item) => item.barcode === barcode);

    if (food) {
      setNutritionSearch(food.name);
      setNutritionBarcode("");
    }
    return food || null;
  }

  function recognizePhotoFood() {
    const lowerName = nutritionPhotoName.toLowerCase();
    const food = nutritionFoodDatabase.find((item) => lowerName.includes(item.name.toLowerCase().split(" ")[0]));
    if (food) {
      addNutritionFood(food);
      setNutritionSearch(food.name);
      return;
    }

    const fallback = nutritionFoodDatabase.find((item) => item.id === "food_chicken");
    if (fallback) addNutritionFood(fallback);
  }

  return {
    selectNutritionDate,
    openNutritionCalendar,
    shiftNutritionCalendarMonth,
    updateNutritionDay,
    toggleNutritionFavorite,
    addWater,
    updateBodyWeight,
    findFoodByBarcode,
    recognizePhotoFood
  };
}
