import { parseNutritionNumber } from "../../../utils/nutritionNumbers";
import styles from "./DishEditIngredientsBox.module.css";

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
    <div
      className={styles.root}
      data-css-module-scope="dish-edit-ingredients"
      data-testid="dish-edit-ingredients"
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <strong data-css-module-text>Ингредиенты</strong>
          <span data-css-module-text>{ingredients.length} шт</span>
        </div>

        <button
          type="button"
          className={styles.addButton}
          data-css-module-control
          data-dish-ingredients-action="add"
          onClick={onOpenIngredientPicker}
        >
          + ингредиент
        </button>
      </div>

      {ingredients.length === 0 ? (
        <div className={styles.empty} data-testid="dish-edit-ingredients-empty">
          Добавь продукты, из которых состоит блюдо
        </div>
      ) : (
        <div className={styles.list}>
          {ingredients.map((ingredient) => (
            <div className={styles.row} key={ingredient.id}>
              <em className={styles.icon} aria-hidden="true">
                {ingredient.icon || getFoodIcon(ingredient.name)}
              </em>
              <span className={styles.name} data-css-module-text>{ingredient.name}</span>
              <strong className={styles.nutrition} data-css-module-text>
                {ingredient.grams || 0} г
                <small data-css-module-text>
                  {Math.round(
                    parseNutritionNumber(ingredient.baseCalories, 0)
                    * (parseNutritionNumber(ingredient.grams, 0) / (parseNutritionNumber(ingredient.baseAmount, 100) || 100))
                  )} ккал
                </small>
              </strong>
              <button
                type="button"
                className={styles.removeButton}
                data-css-module-control
                data-dish-ingredients-action="remove"
                onClick={() => onRemoveIngredient(ingredient.id)}
                aria-label={`Удалить ${ingredient.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
