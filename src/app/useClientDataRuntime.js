import { useNutritionRuntimeEffects } from "../features/client/nutrition/useNutritionRuntimeEffects.js";
import { useClientDataDemand } from "./useClientDataDemand.js";

export function useClientDataRuntime(context) {
  useNutritionRuntimeEffects(context);
  return useClientDataDemand({ ...context,
    nutritionDateKey: context.page === "main" ? context.todayNutritionKey() : context.nutritionDateKey,
    getContext: () => context
  });
}
