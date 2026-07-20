import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./FoodProductHeader.module.css";

export default function FoodProductHeader({
  showFlowHeader,
  selectedFood,
  meals,
  mealId,
  mealMenuOpen,
  getFoodIcon,
  onToggleMealMenu,
  onSelectMeal,
  topActions
}) {
  const selectedMealName = meals.find((meal) => meal.id === mealId)?.name;

  return (
    <>
      {showFlowHeader && (
        <ClientPageHeader
          compact
          controlsVariant="workout"
          className={styles.flowHeader}
          title="Продукт"
          titleTestId="food-product-header-title"
          titleProps={{ "data-food-product-header-title": "" }}
          scope="food-product-header"
          testId="food-product-flow-header"
          actions={topActions}
        >
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
        </ClientPageHeader>
      )}

      <div
        className={styles.hero}
        data-css-module-scope="food-product-header"
        data-testid="food-product-hero"
      >
        <div className={styles.iconStack} data-food-product-hero-part="icon-stack">
          <span
            className={styles.icon}
            aria-hidden="true"
            data-css-module-text="food-product-header"
            data-food-product-hero-part="icon"
          >
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
