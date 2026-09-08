import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import { useRef } from "react";
import { ChevronDown, X } from "lucide-react";
import styles from "./FoodSearchHeader.module.css";
import mealStyles from "./FoodProductHeader.module.css";

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
  const selectedMeal = meals.find((meal) => meal.id === mealId);
  const mealToggleRef = useRef(null);
  const isMyProductsPage = !selectedFood && searchTab === "my";
  const showCloseButton = !createChoiceOpen;

  if (selectedFood) {
    return null;
  }

  return (
    <ClientPageHeader
      compact
      embedded
      className={`${styles.root} ${isMyProductsPage ? styles.myProducts : styles.search}`}
      extensionClassName={styles.searchExtension}
      title={isMyProductsPage ? "Мои продукты" : "Добавить еду"}
      titleTestId="food-search-header-title"
      scope="food-search-header"
      testId="food-search-header"
      actions={showCloseButton ? (
        <button
          type="button"
          data-css-module-control="food-search-header"
          data-food-search-header-action="close"
          aria-label="Закрыть поиск еды"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
      rootProps={{
        "data-food-search-header-variant": isMyProductsPage ? "my-products" : "search"
      }}
    >
      <div
        className={`${styles.mealWrap} ${mealStyles.mealCard}`}
        data-testid="food-search-meal-selector"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !mealMenuOpen) return;
          event.preventDefault();
          event.stopPropagation();
          onCollapseMealMenu();
          mealToggleRef.current?.focus({ preventScroll: true });
        }}
      >
        <button
          ref={mealToggleRef}
          type="button"
          className={mealStyles.mealButton}
          data-css-module-control="food-search-header"
          data-food-search-header-action="toggle-meal"
          aria-expanded={mealMenuOpen}
          aria-controls="food-search-meal-menu"
          onClick={onToggleMealMenu}
        >
          <span className={mealStyles.mealLabel} data-css-module-text="food-search-header">Добавить в</span>
          <span className={mealStyles.mealSelection}>
            <span className={mealStyles.mealIcon} aria-hidden="true">{selectedMeal?.icon}</span>
            <span className={mealStyles.mealName}>{selectedMeal?.name}</span>
          </span>
          <ChevronDown className={mealStyles.mealChevron} size={16} aria-hidden="true" />
        </button>

        {mealMenuOpen && (
          <div className={`${mealStyles.mealDropdown} ${styles.searchMealDropdown}`} id="food-search-meal-menu" role="group" aria-label="Приём пищи" data-testid="food-search-meal-menu">
            {meals.map((meal) => (
              <button
                type="button"
                key={meal.id}
                className={`${mealStyles.mealOption}${mealId === meal.id ? ` ${mealStyles.selected}` : ""}`}
                data-css-module-control="food-search-header"
                data-food-search-meal={meal.id}
                aria-pressed={mealId === meal.id}
                onClick={() => {
                  onSelectMeal(meal.id);
                  mealToggleRef.current?.focus({ preventScroll: true });
                }}
              >
                <span className={mealStyles.mealIcon} aria-hidden="true" data-css-module-text="food-search-header">
                  {meal.icon}
                </span>
                <strong className={mealStyles.mealName} data-css-module-text="food-search-header">{meal.name}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
    </ClientPageHeader>
  );
}
