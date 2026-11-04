import { Fragment, useState } from "react";
import FoodNutritionBasisDialog from "./FoodNutritionBasisDialog";
import { GEMINI_ONLY_FOOD_SEARCH } from "../../../utils/nutritionSearchMode";
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
  onClearSearch,
  onMyFoodSelect,
  onFoodSelect,
  onShowMore
}) {
  const cleanSearch = search.trim();
  const [basisFood, setBasisFood] = useState(null);
  const myFoods = nutrition.myFoods || {};

  return (
    <div
      className={styles.list}
      data-testid="food-search-results"
      data-css-module-scope="food-search-results"
    >
      {basisFood && <FoodNutritionBasisDialog key={basisFood.id} food={basisFood} onClose={()=>setBasisFood(null)} onConfirm={(food)=>{setBasisFood(null);onFoodSelect(food);}} />}
      {!photoAnalyzing && fatSecretError && (
        <div className={`${styles.status} ${styles.error}`} data-food-search-status="error">
          {fatSecretError}
        </div>
      )}

      {!fatSecretLoading && visibleResults.some(food => food.searchFallback) && (
        <div className={styles.status} role="status">В общей базе нет точного товара этого бренда. Ниже — базовые продукты без бренда; их КБЖУ могут отличаться от упаковки.</div>
      )}

      {searchTab !== "my" && !fatSecretLoading && !fatSecretError && cleanSearch.length >= 2 && searchResults.length === 0 && (
        <div className={styles.status} data-food-search-status="empty-search">
          <strong className={styles.statusTitle}>Точного совпадения пока нет</strong>
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
          <strong className={styles.emptyTitle}>{cleanSearch && Object.keys(myFoods).length ? "По запросу ничего не найдено" : "Пока нет своих продуктов"}</strong>
          <span className={styles.emptyCopy}>{cleanSearch && Object.keys(myFoods).length ? "Ваши продукты сохранены. Попробуйте другой запрос." : "Создайте продукт или блюдо — они появятся здесь."}</span>
          {cleanSearch && Object.keys(myFoods).length > 0 && <button type="button" className={styles.suggestionButton} onClick={onClearSearch || (() => onSuggestionSelect(""))}>Очистить поиск</button>}
        </div>
      )}

      {visibleResults.map((food) => {
        const normalizedFood = normalizeNutritionFood(food);
        const isMyFoodResult = searchTab === "my" || (normalizedFood.sourceType !== "gemini_search" && Boolean(myFoods[normalizedFood.id] || myFoods[normalizedFood.foodId]));

        return (
          <Fragment key={normalizedFood.id}>
          <button
            type="button"
            className={styles.item}
            key={normalizedFood.id}
            data-food-search-result-card
            data-css-module-control="food-search-result-card"
            onClick={() => {
              if (normalizedFood.nutritionBasisPending) {setBasisFood(normalizedFood);return;}
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
              <strong className={`${styles.itemTitle} ${normalizedFood.sourceType === "basic_reference" ? styles.basicTitle : ""}`}>{getShortFoodName(normalizedFood.name)}</strong>
              {(normalizedFood.sourceType === "basic_reference" || normalizedFood.brand) && (
                <small className={styles.itemOrigin}>{normalizedFood.sourceType === "basic_reference" ? "Базовый продукт · USDA" : normalizedFood.brand}</small>
              )}
              <span className={styles.itemMeta}>
                <em className={styles.itemPortion}>{normalizedFood.nutritionBasisPending ? "Нужно уточнить массу или объём КБЖУ" : getFoodDisplayPortion(normalizedFood)}</em>
                <small className={styles.itemDetails}>
                  {!normalizedFood.nutritionBasisPending && <>РСК {getFoodRskPercent(normalizedFood, nutrition.goals)}% · </>}{Math.round(Number(normalizedFood.calories) || 0)} ккал
                </small>
              </span>
            </div>
            <span className={styles.itemAction} data-food-search-result-action aria-hidden="true" />
          </button>
          {normalizedFood.sourceType === "gemini_search" && normalizedFood.sources.length > 0 && (
            <div className={styles.sourceLinks}>
              {normalizedFood.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">Источник: {source.title}</a>)}
            </div>
          )}
          </Fragment>
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
        <div className={styles.loading} data-testid="food-search-loading" role="status">
          <span className={styles.loadingSpinner} />
          <strong className={styles.loadingText}>{GEMINI_ONLY_FOOD_SEARCH && searchTab === "food" ? "Gemini ищет продукты через Google…" : "Ищу ещё варианты в общей базе…"}</strong>
        </div>
      )}
    </div>
  );
}
