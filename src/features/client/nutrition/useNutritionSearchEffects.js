import { startTransition, useEffect } from "react";

import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import {
  mergeNutritionFoodResults,
  searchBundledNutritionFallbackFoods
} from "../../../utils/localNutritionCatalog";
import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel";
import { awaitNutritionSearchResult } from "../../../utils/nutritionSearchDeadline";

const REMOTE_SEARCH_DEBOUNCE_MS = 350;
const REMOTE_SEARCH_DEADLINE_MS = 12000;

export function useNutritionSearchEffects({
  dishIngredientPickerOpen,
  dishIngredientSearch,
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
    const bundledFallbackFoods = searchBundledNutritionFallbackFoods(query);
    setFatSecretFoods(bundledFallbackFoods);
    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setFatSecretLoading(true);

    // Do not load the multi-megabyte browser catalog here. Parsing its JSON and
    // building indexes blocks taps and scrolling on mobile devices, and the
    // previous deadline only stopped awaiting that work rather than cancelling
    // it. Compact packaged matches stay actionable while the shared database is
    // queried in the background.
    timer = window.setTimeout(async () => {
      try {
        startPerformanceCheck("Food search · nutrition API", { query, packagedResults: bundledFallbackFoods.length });
        const response = await awaitNutritionSearchResult(
          fetchAuthorizedWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
            signal: controller.signal
          }, REMOTE_SEARCH_DEADLINE_MS),
          REMOTE_SEARCH_DEADLINE_MS
        );

        if (!response.ok) {
          throw new Error(`Nutrition search API error: ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;
        const remoteFoods = Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [];

        startTransition(() => {
          setFatSecretFoods((current) => mergeNutritionFoodResults(current, remoteFoods));
          setNutritionFallbackSuggestions(Array.isArray(data.fallbackSuggestions) ? data.fallbackSuggestions : []);
        });
        endPerformanceCheck("Food search · nutrition API", { query, results: remoteFoods.length });
      } catch (error) {
        if (!cancelled && !controller.signal.aborted && error.name !== "AbortError") {
          console.error(error);
          if (bundledFallbackFoods.length) {
            setFatSecretError("Нет соединения. Показаны доступные продукты на устройстве.");
          } else {
            setNutritionFallbackSuggestions(["Фото продукта", "Уточнить название", "Создать продукт"]);
            setFatSecretError("Общая база временно недоступна.");
            showAppError(
              typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "api",
              "Поиск еды сейчас недоступен."
            );
          }
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setFatSecretLoading(false);
        }
      }
    }, REMOTE_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    endPerformanceCheck,
    nutritionPickerOpen,
    nutritionSearch,
    nutritionSearchTab,
    setFatSecretError,
    setFatSecretFoods,
    setFatSecretLoading,
    setNutritionFallbackSuggestions,
    showAppError,
    startPerformanceCheck
  ]);

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
    const bundledFallbackFoods = searchBundledNutritionFallbackFoods(query, 20);
    setDishIngredientExternalFoods(bundledFallbackFoods);
    setDishIngredientFallbackSuggestions([]);
    setDishIngredientLoading(true);

    timer = window.setTimeout(async () => {
      try {
        startPerformanceCheck("Food search · dish ingredient API", {
          query,
          packagedResults: bundledFallbackFoods.length
        });
        const response = await awaitNutritionSearchResult(
          fetchAuthorizedWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
            signal: controller.signal
          }, REMOTE_SEARCH_DEADLINE_MS),
          REMOTE_SEARCH_DEADLINE_MS
        );

        if (!response.ok) {
          throw new Error(`Dish ingredient search API error: ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;
        const remoteFoods = Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [];
        startTransition(() => {
          setDishIngredientExternalFoods((current) => mergeNutritionFoodResults(current, remoteFoods));
          setDishIngredientFallbackSuggestions(Array.isArray(data.fallbackSuggestions) ? data.fallbackSuggestions : []);
        });
        endPerformanceCheck("Food search · dish ingredient API", { query, results: remoteFoods.length });
      } catch (error) {
        if (!cancelled && !controller.signal.aborted && error.name !== "AbortError") {
          console.error(error);
          if (!bundledFallbackFoods.length) setDishIngredientFallbackSuggestions([]);
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) setDishIngredientLoading(false);
      }
    }, REMOTE_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    dishIngredientPickerOpen,
    dishIngredientSearch,
    endPerformanceCheck,
    setDishIngredientExternalFoods,
    setDishIngredientFallbackSuggestions,
    setDishIngredientLoading,
    startPerformanceCheck
  ]);
}
