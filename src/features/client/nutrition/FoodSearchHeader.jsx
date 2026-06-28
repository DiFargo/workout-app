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

  return (
    <div className={`fatSearchTopPremium ${isSearchPage ? "fatSearchTopPremiumHome foodSearchHeaderExactMainAlign" : ""} ${isMyProductsPage ? "fatSearchTopPremiumMy" : ""}`}>
      {isSearchPage && (
        <div className="foodFlowTitleGroup foodFlowSearchTitle">
          <h2>Добавить еду</h2>
        </div>
      )}

      {isMyProductsPage && (
        <div className="foodFlowTitleGroup">
          <span>Питание</span>
          <h2>Мои продукты</h2>
        </div>
      )}

      <div className="fatSearchTitleWrap">
        <button
          type="button"
          className="fatSearchTitleButtonPremium"
          onClick={onToggleMealMenu}
        >
          <span>Добавить в</span>
          <strong>{selectedMealName}</strong>
        </button>

        {mealMenuOpen && (
          <div className="fatMealDropdown fatMealDropdownCentered">
            {meals.map((meal) => (
              <button
                type="button"
                key={meal.id}
                className={mealId === meal.id ? "active" : ""}
                onClick={() => onSelectMeal(meal.id)}
              >
                <span>{meal.icon}</span>
                <strong>{meal.name}</strong>
              </button>
            ))}
            <button
              type="button"
              className="fatMealDropdownCollapse"
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
        className="fatSearchClosePremium"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть поиск еды"
      >
        ×
      </button>
      )}
    </div>
  );
}
