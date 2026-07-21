import styles from "./FoodPortionSelector.module.css";

export default function FoodPortionSelector({
  selectedFood,
  amount,
  amountMode,
  unitMenuOpen,
  getSmartUnits,
  getSmartUnitId,
  onUseGrams,
  onToggleUnitMenu,
  onSelectUnit
}) {
  const unitOptions = getSmartUnits(selectedFood).filter((unit) => unit.id !== "grams");
  const selectedUnitId = getSmartUnitId(selectedFood, amount, amountMode);
  const selectedUnit = unitOptions.find((unit) => unit.id === selectedUnitId) || unitOptions[0];
  const isPortionMode = amountMode === "portion";

  return (
    <div
      className={styles.root}
      data-css-module-scope="food-portion-selector"
      data-testid="food-portion-selector"
    >
      <button
        type="button"
        className={`${styles.modeButton} ${amountMode === "grams" ? styles.active : ""}`}
        data-css-module-control
        data-food-portion-action="grams"
        aria-pressed={amountMode === "grams"}
        onClick={onUseGrams}
      >
        <span className={styles.modeIcon} aria-hidden="true">⚖</span>
        <strong data-css-module-text>Вес</strong>
      </button>

      <div className={styles.dropdown}>
        <button
          type="button"
          className={`${styles.dropdownButton} ${isPortionMode ? styles.active : ""}`}
          data-css-module-control
          data-food-portion-action="toggle-menu"
          aria-pressed={isPortionMode}
          aria-expanded={unitMenuOpen}
          onClick={onToggleUnitMenu}
        >
          <strong data-css-module-text>{selectedUnit?.shortLabel || selectedUnit?.label || "Порция"}</strong>
          <em aria-hidden="true">{unitMenuOpen ? "⌃" : "⌄"}</em>
        </button>

        {unitMenuOpen && (
          <div className={styles.menu} data-testid="food-portion-menu">
            {unitOptions.map((unit) => (
              <button
                type="button"
                key={unit.id}
                className={`${styles.menuItem} ${selectedUnitId === unit.id ? styles.selected : ""}`}
                data-css-module-control
                data-food-portion-unit={unit.id}
                aria-pressed={selectedUnitId === unit.id}
                onClick={() => onSelectUnit(unit)}
              >
                <span data-css-module-text>{unit.shortLabel || unit.label}</span>
                {unit.hint && <small data-css-module-text>{unit.hint}</small>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
