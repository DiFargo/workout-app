import { nutritionFoodDatabase } from "../../../data/nutritionFoods";
import {
  getNutritionFoodSearchText,
  getSearchHistoryName
} from "../../../utils/nutritionFoodPresentation";
import {
  getMyFoodsArray,
  normalizeNutritionFood
} from "../../../utils/nutritionFoodModel";
import styles from "./DishIngredientPicker.module.css";

function getIngredientSourceLabel(food = {}) {
  const source = String(food.source || "").trim();
  const sourceType = String(food.sourceType || "").trim().toLowerCase();

  if (/^моя база$/i.test(source) || sourceType === "personal_catalog") return "Моя база";
  if (sourceType === "ai_estimate" || food.evidenceType === "estimate" || /(?:оценка\s*ии|openai|ai\s*(?:фото|estimate))/i.test(source)) {
    return "Примерная оценка ИИ";
  }
  if (sourceType === "local_catalog") return source ? `Проверенная база · ${source}` : "Проверенная база";
  return source || "Общая база";
}

function buildDishIngredientResults({
  search,
  nutrition,
  recentFoods,
  externalFoods,
  fallbackSuggestions,
  getFoodIcon
}) {
  const cleanQuery = search.trim().toLowerCase();
  const myFoodsList = getMyFoodsArray(nutrition);
  const recentFoodsList = (recentFoods || []).map(normalizeNutritionFood);
  const externalFoodsList = (externalFoods || []).map(normalizeNutritionFood);

  const allFoods = [
    ...myFoodsList,
    ...recentFoodsList,
    ...externalFoodsList,
    ...nutritionFoodDatabase.map(normalizeNutritionFood),
    ...(fallbackSuggestions || []).map((name) => normalizeNutritionFood({
      id: `suggestion_${name}`,
      foodId: `suggestion_${name}`,
      name,
      portion: "100 г",
      portionAmount: 100,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      source: "Примерная оценка ИИ",
      sourceType: "ai_estimate",
      evidenceType: "estimate",
      icon: getFoodIcon(name)
    }))
  ];

  const uniqueFoods = [];
  const seenFoodIds = new Set();

  allFoods.forEach((food) => {
    const normalizedFood = normalizeNutritionFood(food);
    const barcode = String(normalizedFood.barcode || "").trim();
    const key = barcode
      ? `barcode:${barcode}`
      : `name:${String(normalizedFood.name || "").normalize("NFKC").toLowerCase().trim()}`;
    if (seenFoodIds.has(key)) return;
    seenFoodIds.add(key);
    uniqueFoods.push(normalizedFood);
  });

  return uniqueFoods
    .filter((food) => {
      if (!cleanQuery) return true;
      const foodName = getNutritionFoodSearchText(food);
      const shortName = getSearchHistoryName(food).toLowerCase();
      return foodName.includes(cleanQuery) || shortName.includes(cleanQuery);
    })
    .slice(0, 18);
}

export default function DishIngredientPicker({
  isOpen,
  search,
  loading,
  nutrition,
  recentFoods,
  externalFoods,
  fallbackSuggestions,
  pendingIngredient,
  pendingGrams,
  getFoodIcon,
  getFoodPortionAmount,
  onClose,
  onSearchChange,
  onPendingIngredientChange,
  onPendingGramsChange,
  onAddIngredientFromFood
}) {
  const cleanQuery = search.trim().toLowerCase();
  const results = buildDishIngredientResults({
    search,
    nutrition,
    recentFoods,
    externalFoods,
    fallbackSuggestions,
    getFoodIcon
  });

  const clearPendingIngredient = () => {
    onPendingIngredientChange(null);
    onPendingGramsChange("100");
  };

  return (
    <>
      {isOpen && (
        <div
          className={styles.pickerOverlay}
          data-css-module-scope="dish-ingredient-picker"
          data-testid="dish-ingredient-picker"
          onClick={onClose}
        >
          <div
            className={styles.pickerSheet}
            data-testid="dish-ingredient-picker-sheet"
            role="dialog"
            aria-modal="true"
            data-modal-surface="true"
            aria-labelledby="dish-ingredient-picker-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.pickerHeader} data-testid="dish-ingredient-picker-header">
              <button
                type="button"
                className={styles.closeButton}
                data-css-module-control="dish-ingredient-picker"
                data-dish-ingredient-action="close"
                onClick={onClose}
                aria-label="Закрыть выбор ингредиента"
              >
                ×
              </button>
              <strong id="dish-ingredient-picker-title" className={styles.pickerTitle} data-css-module-text="dish-ingredient-picker">
                Добавить ингредиент
              </strong>
            </div>

            <div className={styles.searchBox} data-testid="dish-ingredient-search">
              <span className={styles.searchIcon} aria-hidden="true" data-css-module-text="dish-ingredient-picker">⌕</span>
              <input
                className={styles.searchInput}
                data-css-module-control="dish-ingredient-picker"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Поиск продукта..."
                enterKeyHint="done"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>

            <div className={styles.results} data-testid="dish-ingredient-results">
              {results.length === 0 ? (
                <>
                  {loading ? (
                    <div className={styles.empty} data-testid="dish-ingredient-empty" data-css-module-text="dish-ingredient-picker">
                      Ищу в общей базе...
                    </div>
                  ) : cleanQuery.length >= 2 ? (
                    <button
                      type="button"
                      className={`${styles.resultCard} ${styles.manualCard}`}
                      data-css-module-control="dish-ingredient-picker"
                      data-dish-ingredient-result="manual"
                      data-dish-ingredient-result-kind="manual"
                      onClick={() => {
                        onPendingIngredientChange(normalizeNutritionFood({
                          id: `manual_${cleanQuery}`,
                          foodId: `manual_${cleanQuery}`,
                          name: search.trim(),
                          portion: "100 г",
                          portionAmount: 100,
                          calories: 0,
                          protein: 0,
                          fat: 0,
                          carbs: 0,
                          source: "Вручную",
                          icon: getFoodIcon(search)
                        }));
                        onPendingGramsChange("100");
                      }}
                    >
                      <span className={styles.resultIcon} data-css-module-text="dish-ingredient-picker">{getFoodIcon(search)}</span>
                      <div className={styles.resultContent}>
                        <strong className={styles.resultTitle} data-css-module-text="dish-ingredient-picker">{search.trim()}</strong>
                        <small className={styles.resultMeta} data-css-module-text="dish-ingredient-picker">Добавить вручную · КБЖУ можно уточнить позже</small>
                      </div>
                      <em className={styles.resultAction} aria-hidden="true" data-css-module-text="dish-ingredient-picker">＋</em>
                    </button>
                  ) : (
                    <div className={styles.empty} data-testid="dish-ingredient-empty" data-css-module-text="dish-ingredient-picker">
                      Ничего не найдено
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loading && (
                    <div className={styles.loading} data-testid="dish-ingredient-loading" data-css-module-text="dish-ingredient-picker">
                      Ищу ещё варианты в общей базе…
                    </div>
                  )}

                  {results.map((food) => (
                    <button
                      type="button"
                      key={`dish_ing_${food.id}_${food.name}`}
                      className={styles.resultCard}
                      data-css-module-control="dish-ingredient-picker"
                      data-dish-ingredient-result={food.foodId || food.id || food.name}
                      data-dish-ingredient-result-kind="catalog"
                      onClick={() => {
                        onPendingIngredientChange(food);
                        onPendingGramsChange(String(getFoodPortionAmount(food) || 100));
                      }}
                    >
                      <span className={styles.resultIcon} data-css-module-text="dish-ingredient-picker">{food.icon || getFoodIcon(food)}</span>
                      <div className={styles.resultContent}>
                        <strong className={styles.resultTitle} data-css-module-text="dish-ingredient-picker">{food.name}</strong>
                        <small className={styles.resultMeta} data-css-module-text="dish-ingredient-picker">{getIngredientSourceLabel(food)} · {Math.round(Number(food.calories) || 0)} ккал</small>
                      </div>
                      <em className={styles.resultAction} aria-hidden="true" data-css-module-text="dish-ingredient-picker">＋</em>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingIngredient && (
        <div
          className={styles.confirmOverlay}
          data-css-module-scope="dish-ingredient-picker"
          data-testid="dish-ingredient-confirm"
        >
          <div
            className={styles.confirmCard}
            data-testid="dish-ingredient-confirm-card"
            role="dialog"
            aria-modal="true"
            data-modal-surface="true"
            aria-labelledby="dish-ingredient-confirm-title"
          >
            <div className={styles.confirmTop} data-testid="dish-ingredient-confirm-top">
              <div className={styles.confirmIcon} data-testid="dish-ingredient-confirm-icon" data-css-module-text="dish-ingredient-picker">
                {pendingIngredient.icon || getFoodIcon(pendingIngredient)}
              </div>

              <div className={styles.confirmInfo} data-testid="dish-ingredient-confirm-info">
                <strong id="dish-ingredient-confirm-title" className={styles.confirmTitle} data-css-module-text="dish-ingredient-picker">{pendingIngredient.name}</strong>
                <span className={styles.confirmMeta} data-css-module-text="dish-ingredient-picker">
                  {pendingIngredient.source || "Продукт"} · {Math.round(Number(pendingIngredient.calories) || 0)} ккал
                </span>
              </div>
            </div>

            <label className={styles.confirmInputLabel} data-testid="dish-ingredient-confirm-input" data-css-module-control="dish-ingredient-picker">
              <span className={styles.confirmInputTitle} data-css-module-text="dish-ingredient-picker">Сколько грамм добавить?</span>

              <div className={styles.confirmInputWrap}>
                <input
                  className={styles.confirmInput}
                  data-css-module-control="dish-ingredient-picker"
                  value={pendingGrams}
                  onChange={(event) => onPendingGramsChange(event.target.value)}
                  placeholder="100"
                  inputMode="decimal"
                  enterKeyHint="done"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />

                <em className={styles.confirmUnit} aria-hidden="true" data-css-module-text="dish-ingredient-picker">г</em>
              </div>
            </label>

            <div className={styles.confirmActions} data-testid="dish-ingredient-confirm-actions">
              <button
                type="button"
                className={`${styles.confirmButton} ${styles.confirmCancel}`}
                data-css-module-control="dish-ingredient-picker"
                data-dish-ingredient-action="cancel"
                onClick={clearPendingIngredient}
              >
                Отмена
              </button>

              <button
                type="button"
                className={`${styles.confirmButton} ${styles.confirmAdd}`}
                data-css-module-control="dish-ingredient-picker"
                data-dish-ingredient-action="add"
                onClick={() => {
                  onAddIngredientFromFood(pendingIngredient, pendingGrams);
                  clearPendingIngredient();
                }}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
