import { renderNutritionRoute } from "./renderNutritionRoute";
import { useNutritionPageData } from "./useNutritionPageData";

export default function NutritionRoute(props) {
  const nutritionPageData = useNutritionPageData(props);

  return renderNutritionRoute({
    ...props,
    buildNutritionPageModel: () => nutritionPageData
  });
}
