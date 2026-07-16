import styles from "./FoodProductHeader.module.css";

export default function FoodProductHeader({
  showFlowHeader,
  selectedFood,
  meals,
  mealId,
  mealMenuOpen,
  getFoodIcon,
  onToggleMealMenu,
  onSelectMeal
}) {
  const selectedMealName = meals.find((meal) => meal.id === mealId)?.name;

  return (
    <>
      {showFlowHeader && (
        <div
          className={styles.flowHeader}
          data-css-module-scope="food-product-header"
          data-testid="food-product-flow-header"
        >
          <div className={styles.flowTitle}>
            <span className={styles.eyebrow} data-css-module-text="food-product-header">Питание</span>
            <h2
              className={styles.heading}
              data-css-module-text="food-product-header"
              data-food-product-header-title
            >
              Продукт
            </h2>
          </div>

          <div className={styles.mealCard} data-testid="food-product-meal-selector">
            <span className={styles.mealLabel} data-css-module-text="food-product-header">Добавить в</span>

            <button
              type="button"
              className={styles.mealButton}
              data-css-module-control="food-product-header"
              data-food-product-header-action="toggle-meal"
              aria-expanded={mealMenuOpen}
              onClick={onToggleMealMenu}
            >
              {selectedMealName}
            </button>

            {mealMenuOpen && (
              <div className={styles.mealDropdown} data-testid="food-product-meal-menu">
                {meals.map((meal) => (
                  <button
                    type="button"
                    key={meal.id}
                    className={`${styles.mealOption}${mealId === meal.id ? ` ${styles.selected}` : ""}`}
                    data-css-module-control="food-product-header"
                    data-food-product-meal={meal.id}
                    aria-pressed={mealId === meal.id}
                    onClick={() => onSelectMeal(meal.id)}
                  >
                    <span className={styles.mealIcon} aria-hidden="true" data-css-module-text="food-product-header">
                      {meal.icon}
                    </span>
                    <strong className={styles.mealName} data-css-module-text="food-product-header">
                      {meal.name}
                    </strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={styles.hero}
        data-css-module-scope="food-product-header"
        data-testid="food-product-hero"
      >
        <div className={styles.iconStack}>
          <span className={styles.icon} aria-hidden="true" data-css-module-text="food-product-header">
            {selectedFood.icon || getFoodIcon(selectedFood)}
          </span>
          <small className={styles.source} data-css-module-text="food-product-header">
            {selectedFood.source || selectedFood.portion || "Продукт"}
          </small>
        </div>
        <strong className={styles.productName} data-css-module-text="food-product-header">
          {selectedFood.name}
        </strong>
      </div>
    </>
  );
}
