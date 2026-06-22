import {
  getFoodDisplayPortion,
  getFoodIcon,
  getFoodRskPercent,
  getShortFoodName
} from "../../../utils/nutritionFoodPresentation";
import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel";

export default function FoodSearchResults({
  search,
  searchTab,
  showRecentFoods,
  recentFoods,
  photoAnalyzing,
  fatSecretError,
  fatSecretLoading,
  fallbackSuggestions,
  searchResults,
  visibleResults,
  nutrition,
  onRecentFoodSelect,
  onSuggestionSelect,
  onMyFoodSelect,
  onFoodSelect,
  onShowMore
}) {
  const cleanSearch = search.trim();
  const myFoods = nutrition.myFoods || {};

  return (
    <div className="fatSearchListPremium">
      {searchTab === "recent" && showRecentFoods && recentFoods.length > 0 && (
        <div className="fatRecentFoods">
          <div className="fatRecentFoodsTitle">Недавние продукты</div>
          {recentFoods.map((food) => (
            <button
              type="button"
              key={`${food.name}_${food.calories}_${food.source}`}
              className="fatRecentFoodButton"
              onClick={() => onRecentFoodSelect(food)}
            >
              <span>{food.name}</span>
              <strong>{food.calories} ккал</strong>
            </button>
          ))}
        </div>
      )}

      {!photoAnalyzing && fatSecretError && (
        <div className="fatSearchStatus error">{fatSecretError}</div>
      )}

      {!fatSecretLoading && cleanSearch.length >= 2 && searchResults.length === 0 && (
        <div className="fatSearchStatus">
          <strong>В моей базе нет — ищу через AI/FatSecret</strong>
          {fallbackSuggestions.length > 0 && (
            <div className="fatFallbackSuggestions">
              {fallbackSuggestions
                .filter((suggestion) => !suggestion.includes("штрихкод"))
                .map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => onSuggestionSelect(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {searchTab === "my" && searchResults.length === 0 && (
        <div className="fatSearchStatus myProductsEmptyState">
          <strong>Пока нет своих продуктов</strong>
          <span>Создай продукт или блюдо — они появятся здесь.</span>
        </div>
      )}

      {visibleResults.map((food) => {
        const normalizedFood = normalizeNutritionFood(food);
        const isMyFoodResult = searchTab === "my" || Boolean(myFoods[normalizedFood.id] || myFoods[normalizedFood.foodId]);

        return (
          <button
            type="button"
            className="fatSearchResultCard"
            key={normalizedFood.id}
            onClick={() => {
              if (isMyFoodResult) {
                onMyFoodSelect(normalizedFood);
                return;
              }

              onFoodSelect(normalizedFood);
            }}
          >
            <span className="fatSearchResultIcon" aria-hidden="true">
              {normalizedFood.icon || getFoodIcon(normalizedFood)}
            </span>
            <div className="fatSearchResultInfo">
              <strong>{getShortFoodName(normalizedFood.name)}</strong>
              <span>
                <em>{getFoodDisplayPortion(normalizedFood)}</em>
                <small>
                  {isMyFoodResult ? "Моя база · " : "AI/FatSecret · "}
                  РСК {getFoodRskPercent(normalizedFood, nutrition.goals)}% · {Math.round(Number(normalizedFood.calories) || 0)} ккал
                </small>
              </span>
            </div>
            <span className="fatSearchResultCheck" aria-hidden="true" />
          </button>
        );
      })}

      {searchResults.length > visibleResults.length && (
        <button
          type="button"
          className="fatSearchShowMoreButton"
          onClick={onShowMore}
        >
          Показать ещё
          <span>{searchResults.length - visibleResults.length}</span>
        </button>
      )}

      {fatSecretLoading && cleanSearch.length >= 2 && (
        <div className="fatAiLoadingBelow">
          <span />
          <strong>Ищу ещё варианты через AI/FatSecret…</strong>
        </div>
      )}
    </div>
  );
}
