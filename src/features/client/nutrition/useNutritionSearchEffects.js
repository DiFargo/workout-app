import { useEffect } from "react";

import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import {
  mergeNutritionFoodResults,
  searchLocalNutritionFoods
} from "../../../utils/localNutritionCatalog";
import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel";

export function useNutritionSearchEffects({
  dishIngredientPickerOpen,
  dishIngredientSearch,
  nutrition,
  nutritionPickerOpen,
  nutritionSearch,
  nutritionSearchTab,
  endPerformanceCheck,
  showAppError,
  startPerformanceCheck,
  setDishIngredientExternalFoods,
  setDishIngredientFallbackSuggestions,
  setDishIngredientLoading,
  setFatSecretError,
  setFatSecretFoods,
  setFatSecretLoading,
  setNutritionFallbackSuggestions
}) {
  useEffect(() => {
    const query = nutritionSearch.trim();

    if (!nutritionPickerOpen || nutritionSearchTab !== "food" || query.length < 2) {
      setFatSecretFoods([]);
      setFatSecretLoading(false);
      setFatSecretError("");
      setNutritionFallbackSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    let timer;
    let cancelled = false;
    setFatSecretLoading(true);

    const runSearch = async () => {
      try {
        startPerformanceCheck("Local catalog search", { query });
        const localResults = await searchLocalNutritionFoods(query);
        if (cancelled) return;

        setFatSecretFoods(localResults);
        setFatSecretError("");
        setNutritionFallbackSuggestions([]);
        endPerformanceCheck("Local catalog search", { query, results: localResults.length });

        if (localResults.length >= 8) {
          setFatSecretLoading(false);
          return;
        }

        setFatSecretLoading(false);
        timer = window.setTimeout(async () => {
          try {
            setFatSecretLoading(true);
            startPerformanceCheck("Food search · nutrition API", { query, localResults: localResults.length });

            const response = await fetchAuthorizedWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
              signal: controller.signal
            }, 12000);

            if (!response.ok) {
              throw new Error(`Nutrition search API error: ${response.status}`);
            }

            const data = await response.json();
            const remoteFoods = Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [];

            setFatSecretFoods((current) => mergeNutritionFoodResults(current, remoteFoods));
            setNutritionFallbackSuggestions(Array.isArray(data.fallbackSuggestions) ? data.fallbackSuggestions : []);
            endPerformanceCheck("Food search · nutrition API", { query, results: remoteFoods.length });
          } catch (error) {
            if (error.name !== "AbortError") {
              console.error(error);

              if (!localResults.length) {
                setNutritionFallbackSuggestions(["Фото продукта", "Попробуй штрихкод", "Создать продукт"]);
                setFatSecretError("Локально не найдено. ИИ-поиск временно недоступен.");
                showAppError(
                  typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "api",
                  "Поиск еды сейчас недоступен."
                );
              }
            }
          } finally {
            if (!controller.signal.aborted) {
              setFatSecretLoading(false);
            }
          }
        }, localResults.length ? 900 : 250);
      } catch (error) {
        if (!cancelled && error.name !== "AbortError") {
          console.error(error);
          setFatSecretLoading(false);
          setFatSecretError("Локальный каталог временно недоступен.");
        }
      }
    };

    runSearch();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [nutritionPickerOpen, nutritionSearchTab, nutritionSearch, nutrition.myFoods]);

  useEffect(() => {
    const query = dishIngredientSearch.trim();

    if (!dishIngredientPickerOpen || query.length < 2) {
      setDishIngredientExternalFoods([]);
      setDishIngredientFallbackSuggestions([]);
      setDishIngredientLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let timer;
    let cancelled = false;
    setDishIngredientLoading(true);

    const runSearch = async () => {
      try {
        startPerformanceCheck("Local dish ingredient search", { query });
        const localResults = await searchLocalNutritionFoods(query, 20);
        if (cancelled) return;

        setDishIngredientExternalFoods(localResults);
        setDishIngredientFallbackSuggestions([]);
        endPerformanceCheck("Local dish ingredient search", { query, results: localResults.length });

        if (localResults.length >= 8) {
          setDishIngredientLoading(false);
          return;
        }

        setDishIngredientLoading(false);
        timer = window.setTimeout(async () => {
          try {
            setDishIngredientLoading(true);
            startPerformanceCheck("Food search · dish ingredient API", { query, localResults: localResults.length });

            const response = await fetchAuthorizedWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
              signal: controller.signal
            }, 12000);

            if (!response.ok) {
              throw new Error(`Dish ingredient search API error: ${response.status}`);
            }

            const data = await response.json();
            const remoteFoods = Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [];
            setDishIngredientExternalFoods((current) => mergeNutritionFoodResults(current, remoteFoods));
            setDishIngredientFallbackSuggestions(Array.isArray(data.fallbackSuggestions) ? data.fallbackSuggestions : []);
            endPerformanceCheck("Food search · dish ingredient API", { query, results: remoteFoods.length });
          } catch (error) {
            if (error.name !== "AbortError") {
              console.error(error);
              if (!localResults.length) {
                setDishIngredientFallbackSuggestions([]);
              }
            }
          } finally {
            if (!controller.signal.aborted) {
              setDishIngredientLoading(false);
            }
          }
        }, localResults.length ? 900 : 250);
      } catch (error) {
        if (!cancelled && error.name !== "AbortError") {
          console.error(error);
          setDishIngredientLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [dishIngredientPickerOpen, dishIngredientSearch]);
}
