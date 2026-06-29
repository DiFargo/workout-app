import { nutritionFoodDatabase } from "../../../data/nutritionFoods";
import {
  getNutritionFoodSearchText,
  getSearchHistoryName
} from "../../../utils/nutritionFoodPresentation";
import {
  getMyFoodsArray,
  normalizeNutritionFood
} from "../../../utils/nutritionFoodModel";

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
      source: "AI/FatSecret",
      icon: getFoodIcon(name)
    }))
  ];

  const uniqueFoods = [];
  const seenFoodIds = new Set();

  allFoods.forEach((food) => {
    const normalizedFood = normalizeNutritionFood(food);
    const key = normalizedFood.foodId || normalizedFood.id || normalizedFood.name;
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
        <div className="dishIngredientPickerOverlay" onClick={onClose}>
          <div className="dishIngredientPickerSheet" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
            <div className="dishIngredientPickerHeader">
              <button type="button" onClick={onClose} aria-label="Закрыть выбор ингредиента">×</button>
              <strong>Добавить ингредиент</strong>
            </div>

            <div className="dishIngredientSearchBox">
              <span>⌕</span>
              <input
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

            <div className="dishIngredientResults">
              {results.length === 0 ? (
                <>
                  {loading ? (
                    <div className="dishIngredientEmpty">
                      Ищу через AI/FatSecret...
                    </div>
                  ) : cleanQuery.length >= 2 ? (
                    <button
                      type="button"
                      className="dishIngredientResultCard dishIngredientManualCard"
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
                      <span>{getFoodIcon(search)}</span>
                      <div>
                        <strong>{search.trim()}</strong>
                        <small>Добавить вручную · КБЖУ можно уточнить позже</small>
                      </div>
                      <em>＋</em>
                    </button>
                  ) : (
                    <div className="dishIngredientEmpty">
                      Ничего не найдено
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loading && (
                    <div className="dishIngredientSearchLoading">
                      Ищу ещё варианты через AI/FatSecret…
                    </div>
                  )}

                  {results.map((food) => (
                    <button
                      type="button"
                      key={`dish_ing_${food.id}_${food.name}`}
                      className="dishIngredientResultCard"
                      onClick={() => {
                        onPendingIngredientChange(food);
                        onPendingGramsChange(String(getFoodPortionAmount(food) || 100));
                      }}
                    >
                      <span>{food.icon || getFoodIcon(food)}</span>
                      <div>
                        <strong>{food.name}</strong>
                        <small>{food.source || "Продукт"} · {Math.round(Number(food.calories) || 0)} ккал</small>
                      </div>
                      <em>＋</em>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingIngredient && (
        <div className="dishIngredientConfirmOverlay">
          <div className="dishIngredientConfirmCard">
            <div className="dishIngredientConfirmTop">
              <div className="dishIngredientConfirmIcon">
                {pendingIngredient.icon || getFoodIcon(pendingIngredient)}
              </div>

              <div className="dishIngredientConfirmInfo">
                <strong>{pendingIngredient.name}</strong>
                <span>
                  {pendingIngredient.source || "Продукт"} · {Math.round(Number(pendingIngredient.calories) || 0)} ккал
                </span>
              </div>
            </div>

            <label className="dishIngredientConfirmInput">
              <span>Сколько грамм добавить?</span>

              <div>
                <input
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

                <em>г</em>
              </div>
            </label>

            <div className="dishIngredientConfirmActions">
              <button
                type="button"
                className="dishIngredientConfirmCancel"
                onClick={clearPendingIngredient}
              >
                Отмена
              </button>

              <button
                type="button"
                className="dishIngredientConfirmAdd"
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
