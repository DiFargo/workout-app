export default function FoodSearchHeader({
  selectedFood,
  searchTab,
  mealMenuOpen,
  meals,
  mealId,
  onToggleMealMenu,
  onSelectMeal,
  onCollapseMealMenu,
  onClose
}) {
  const selectedMealName = meals.find((meal) => meal.id === mealId)?.name;

  return (
    <div className="fatSearchTopPremium">
      {!selectedFood && searchTab === "my" && (
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
    </div>
  );
}
