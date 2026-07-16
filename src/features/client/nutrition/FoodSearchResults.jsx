import {
  getFoodDisplayPortion,
  getFoodIcon,
  getFoodRskPercent,
  getShortFoodName
} from "../../../utils/nutritionFoodPresentation";
import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel";
import styles from "./FoodSearchResults.module.css";

export default function FoodSearchResults({
  search,
  searchTab,
  photoAnalyzing,
  fatSecretError,
  fatSecretLoading,
  fallbackSuggestions,
  searchResults,
  visibleResults,
  nutrition,
  onSuggestionSelect,
  onMyFoodSelect,
  onFoodSelect,
  onShowMore
}) {
  const cleanSearch = search.trim();
  const myFoods = nutrition.myFoods || {};

  return (
    <div
      className={styles.list}
      data-testid="food-search-results"
      data-css-module-scope="food-search-results"
    >
      {!photoAnalyzing && fatSecretError && (
        <div className={`${styles.status} ${styles.error}`} data-food-search-status="error">
          {fatSecretError}
        </div>
      )}

      {!fatSecretLoading && cleanSearch.length >= 2 && searchResults.length === 0 && (
        <div className={styles.status} data-food-search-status="empty-search">
          <strong className={styles.statusTitle}>В моей базе нет — ищу через AI/FatSecret</strong>
          {fallbackSuggestions.length > 0 && (
            <div className={styles.suggestions}>
              {fallbackSuggestions
                .filter((suggestion) => !suggestion.includes("штрихкод"))
                .map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    className={styles.suggestionButton}
                    data-css-module-control="food-search-suggestion"
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
        <div className={`${styles.status} ${styles.emptyState}`} data-food-search-status="empty-products">
          <strong className={styles.emptyTitle}>Пока нет своих продуктов</strong>
          <span className={styles.emptyCopy}>Создай продукт или блюдо — они появятся здесь.</span>
        </div>
      )}

      {visibleResults.map((food) => {
        const normalizedFood = normalizeNutritionFood(food);
        const isMyFoodResult = searchTab === "my" || Boolean(myFoods[normalizedFood.id] || myFoods[normalizedFood.foodId]);

        return (
          <button
            type="button"
            className={styles.item}
            key={normalizedFood.id}
            data-food-search-result-card
            data-css-module-control="food-search-result-card"
            onClick={() => {
              if (isMyFoodResult) {
                onMyFoodSelect(normalizedFood);
                return;
              }

              onFoodSelect(normalizedFood);
            }}
          >
            <span className={styles.itemIcon} aria-hidden="true">
              {normalizedFood.icon || getFoodIcon(normalizedFood)}
            </span>
            <div className={styles.itemInfo}>
              <strong className={styles.itemTitle}>{getShortFoodName(normalizedFood.name)}</strong>
              <span className={styles.itemMeta}>
                <em className={styles.itemPortion}>{getFoodDisplayPortion(normalizedFood)}</em>
                <small className={styles.itemDetails}>
                  {isMyFoodResult ? "Моя база · " : "AI/FatSecret · "}
                  РСК {getFoodRskPercent(normalizedFood, nutrition.goals)}% · {Math.round(Number(normalizedFood.calories) || 0)} ккал
                </small>
              </span>
            </div>
            <span className={styles.itemAction} data-food-search-result-action aria-hidden="true" />
          </button>
        );
      })}

      {searchResults.length > visibleResults.length && (
        <button
          type="button"
          className={styles.showMore}
          data-testid="food-search-show-more"
          data-css-module-control="food-search-show-more"
          onClick={onShowMore}
        >
          Показать ещё
          <span className={styles.showMoreCount}>{searchResults.length - visibleResults.length}</span>
        </button>
      )}

      {fatSecretLoading && cleanSearch.length >= 2 && (
        <div className={styles.loading} data-testid="food-search-loading">
          <span className={styles.loadingSpinner} />
          <strong className={styles.loadingText}>Ищу ещё варианты через AI/FatSecret…</strong>
        </div>
      )}
    </div>
  );
}
