export default function FoodProductHeader({
  showFlowHeader,
  isEditing,
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
        <div className="foodProductFlowHeader">
          <div className="foodProductFlowTitle">
            <span>Питание</span>
            <h2>Продукт</h2>
          </div>

          <div className="foodEditInlineMealHeader">
            <span className="foodEditInlineMealLabel">Добавить в</span>

            <button
              type="button"
              className="foodEditInlineMealButton"
              aria-expanded={mealMenuOpen}
              onClick={onToggleMealMenu}
            >
              {selectedMealName}
            </button>

            {mealMenuOpen && (
              <div className="foodEditMealPickerDropdown foodEditMealPickerDropdownInline">
                {meals.map((meal) => (
                  <button
                    type="button"
                    key={meal.id}
                    className={mealId === meal.id ? "active" : ""}
                    aria-pressed={mealId === meal.id}
                    onClick={() => onSelectMeal(meal.id)}
                  >
                    <span>{meal.icon}</span>
                    <strong>{meal.name}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="foodEditHeroRender foodEditHeroEditable">
        <div className="foodEditIconSourceStack">
          <span className="foodEditIconRender">{selectedFood.icon || getFoodIcon(selectedFood)}</span>
          <small>{selectedFood.source || selectedFood.portion || "Продукт"}</small>
        </div>
        <strong>{selectedFood.name}</strong>
      </div>
    </>
  );
}
