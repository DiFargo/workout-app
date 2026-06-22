import { parseNutritionNumber } from "../../../utils/nutritionNumbers";

export default function DishEditIngredientsBox({
  selectedFood,
  getFoodIcon,
  onOpenIngredientPicker,
  onRemoveIngredient
}) {
  const ingredients = selectedFood?.ingredients || [];

  if (selectedFood?.type !== "dish") {
    return null;
  }

  return (
    <div className="dishEditIngredientsBox">
      <div className="dishEditIngredientsHeader">
        <div>
          <strong>Ингредиенты</strong>
          <span>{ingredients.length} шт</span>
        </div>

        <button type="button" onClick={onOpenIngredientPicker}>
          + ингредиент
        </button>
      </div>

      {ingredients.length === 0 ? (
        <div className="dishEditIngredientsEmpty">
          Добавь продукты, из которых состоит блюдо
        </div>
      ) : (
        <div className="dishEditIngredientsList">
          {ingredients.map((ingredient) => (
            <div className="dishEditIngredientRow" key={ingredient.id}>
              <em>{ingredient.icon || getFoodIcon(ingredient.name)}</em>
              <span>{ingredient.name}</span>
              <strong>
                {ingredient.grams || 0} г
                <small>
                  {Math.round(
                    parseNutritionNumber(ingredient.baseCalories, 0)
                    * (parseNutritionNumber(ingredient.grams, 0) / (parseNutritionNumber(ingredient.baseAmount, 100) || 100))
                  )} ккал
                </small>
              </strong>
              <button type="button" onClick={() => onRemoveIngredient(ingredient.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
