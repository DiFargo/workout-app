import { NUTRITION_ICON_PRESETS, nutritionMeals } from "../../../data/nutritionDefaults";
import {
  getFoodPortionAmount,
  getFoodScale
} from "../../../utils/nutritionPortions";
import {
  getNutritionSmartUnitId,
  getNutritionSmartUnits
} from "../../../utils/nutritionFoodModel";
import { getFoodIcon } from "../../../utils/nutritionFoodPresentation";
import { roundMacro } from "../../../utils/nutritionNumbers";
import {
  saveNutritionPreferredUnit,
  saveRecentNutritionFood
} from "../../../utils/nutritionPreferenceStorage";
import { validateNutritionAmount } from "../../../utils/clientUx";
import NutritionPageView from "./NutritionPageView";
import { buildNutritionPageModel } from "./nutritionPageModel";
import { renderNutritionPageFromContext } from "./renderNutritionPageFromContext";

export function renderNutritionRoute(ctx) {
  return renderNutritionPageFromContext({
    NUTRITION_ICON_PRESETS,
    NutritionPageView,
    buildNutritionPageModel,
    getFoodIcon,
    getFoodPortionAmount,
    getFoodScale,
    getNutritionSmartUnitId,
    getNutritionSmartUnits,
    nutritionMeals,
    roundMacro,
    saveNutritionPreferredUnit,
    saveRecentNutritionFood,
    validateNutritionAmount,
    ...ctx
  });
}
