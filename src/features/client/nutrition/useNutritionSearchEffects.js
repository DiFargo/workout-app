import { useEffect } from "react";

import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import {
  mergeNutritionFoodResults,
  searchBundledNutritionFallbackFoods,
  searchLocalNutritionFoods
} from "../../../utils/localNutritionCatalog";
import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel";
import { awaitNutritionSearchResult } from "../../../utils/nutritionSearchDeadline.js";

const LOCAL_CATALOG_DEADLINE_MS = 1400;
const REMOTE_SEARCH_DEADLINE_MS = 4500;

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
    const bundledFallbackFoods = searchBundledNutritionFallbackFoods(query);
    setFatSecretFoods(bundledFallbackFoods);
    // A packaged result is immediately actionable offline. Keep the network
    // lookup in the background instead of showing a spinner that can appear
    // frozen while the phone is moving between mobile networks.
    setFatSecretLoading(bundledFallbackFoods.length === 0);

    const runSearch = async () => {
      try {
        startPerformanceCheck("Local catalog search", { query });
        let localResults = [];
        try {
          localResults = await awaitNutritionSearchResult(
            searchLocalNutritionFoods(query),
            LOCAL_CATALOG_DEADLINE_MS,
            "Local nutrition catalog timed out"
          );
        } catch (error) {
          if (!controller.signal.aborted) {
            console.warn("Local nutrition catalog search timed out:", error);
          }
        }
        if (cancelled) return;

        const combinedLocalResults = mergeNutritionFoodResults(bundledFallbackFoods, localResults);
        setFatSecretFoods(combinedLocalResults);
        setFatSecretError("");
        setNutritionFallbackSuggestions([]);
        endPerformanceCheck("Local catalog search", { query, results: localResults.length });

        if (combinedLocalResults.length >= 8) {
          setFatSecretLoading(false);
          return;
        }

        setFatSecretLoading(false);
        timer = window.setTimeout(async () => {
          let shouldShowRemoteLoading = false;
          try {
            shouldShowRemoteLoading = combinedLocalResults.length === 0;
            if (shouldShowRemoteLoading) setFatSecretLoading(true);
            startPerformanceCheck("Food search · nutrition API", { query, localResults: combinedLocalResults.length });

            const response = await fetchAuthorizedWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
              signal: controller.signal
            }, REMOTE_SEARCH_DEADLINE_MS);

            if (!response.ok) {
              throw new Error(`Nutrition search API error: ${response.status}`);
            }

            const data = await response.json();
            const remoteFoods = Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [];

            setFatSecretFoods((current) => mergeNutritionFoodResults(current, remoteFoods));
            setNutritionFallbackSuggestions(Array.isArray(data.fallbackSuggestions) ? data.fallbackSuggestions : []);
            endPerformanceCheck("Food search · nutrition API", { query, results: remoteFoods.length });
          } catch (error) {
            if (!controller.signal.aborted) {
              if (error.name !== "AbortError") {
                console.error(error);
              }
              if (combinedLocalResults.length) {
                setFatSecretError("Нет соединения. Показаны доступные продукты на устройстве.");
              } else {
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
              if (shouldShowRemoteLoading) setFatSecretLoading(false);
            }
          }
        }, localResults.length ? 900 : 250);
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          if (error.name !== "AbortError") {
            console.error(error);
          }
          setFatSecretLoading(false);
          if (bundledFallbackFoods.length) {
            setFatSecretFoods(bundledFallbackFoods);
            setFatSecretError("Нет соединения. Показаны доступные продукты на устройстве.");
            return;
          }
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
  }, [
    endPerformanceCheck,
    nutrition.myFoods,
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
            if (!controller.signal.aborted) {
              if (error.name !== "AbortError") {
                console.error(error);
              }
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
        if (!cancelled && !controller.signal.aborted) {
          if (error.name !== "AbortError") {
            console.error(error);
          }
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
