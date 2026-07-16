import styles from "./FoodSearchHeader.module.css";

export default function FoodSearchHeader({
  selectedFood,
  searchTab,
  createChoiceOpen = false,
  mealMenuOpen,
  meals,
  mealId,
  onToggleMealMenu,
  onSelectMeal,
  onCollapseMealMenu,
  onClose
}) {
  const selectedMealName = meals.find((meal) => meal.id === mealId)?.name;
  const isMyProductsPage = !selectedFood && searchTab === "my";
  const isSearchPage = !selectedFood && searchTab !== "my";
  const showCloseButton = !createChoiceOpen;

  if (selectedFood) {
    return null;
  }

  return (
    <header
      className={`${styles.root} ${isMyProductsPage ? styles.myProducts : styles.search}`}
      data-css-module-scope="food-search-header"
      data-food-search-header-variant={isMyProductsPage ? "my-products" : "search"}
      data-testid="food-search-header"
    >
      {isSearchPage && (
        <div className={styles.titleGroup}>
          <h2 className={styles.heading} data-css-module-text="food-search-header">Добавить еду</h2>
        </div>
      )}

      {isMyProductsPage && (
        <div className={styles.titleGroup}>
          <span className={styles.eyebrow} data-css-module-text="food-search-header">Питание</span>
          <h2 className={styles.heading} data-css-module-text="food-search-header">Мои продукты</h2>
        </div>
      )}

      <div className={styles.mealWrap} data-testid="food-search-meal-selector">
        <button
          type="button"
          className={styles.mealButton}
          data-css-module-control="food-search-header"
          data-food-search-header-action="toggle-meal"
          aria-expanded={mealMenuOpen}
          aria-controls="food-search-meal-menu"
          onClick={onToggleMealMenu}
        >
          <span className={styles.mealLabel} data-css-module-text="food-search-header">Добавить в</span>
          <strong className={styles.mealName} data-css-module-text="food-search-header">{selectedMealName}</strong>
        </button>

        {mealMenuOpen && (
          <div className={styles.mealDropdown} id="food-search-meal-menu" data-testid="food-search-meal-menu">
            {meals.map((meal) => (
              <button
                type="button"
                key={meal.id}
                className={`${styles.mealOption}${mealId === meal.id ? ` ${styles.selected}` : ""}`}
                data-css-module-control="food-search-header"
                data-food-search-meal={meal.id}
                aria-pressed={mealId === meal.id}
                onClick={() => onSelectMeal(meal.id)}
              >
                <span className={styles.mealIcon} aria-hidden="true" data-css-module-text="food-search-header">
                  {meal.icon}
                </span>
                <strong className={styles.optionName} data-css-module-text="food-search-header">{meal.name}</strong>
              </button>
            ))}
            <button
              type="button"
              className={styles.collapseButton}
              data-css-module-control="food-search-header"
              data-food-search-header-action="collapse-meal"
              onClick={onCollapseMealMenu}
              aria-label="Свернуть выбор приёма пищи"
            >
              ↑
            </button>
          </div>
        )}
      </div>

      {showCloseButton && (
        <button
          type="button"
          className={styles.closeButton}
          data-css-module-control="food-search-header"
          data-food-search-header-action="close"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Закрыть поиск еды"
        >
          ×
        </button>
      )}
    </header>
  );
}
