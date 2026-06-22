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

  return (
    <div className="foodEditSegmentRow">
      <button
        type="button"
        className={amountMode === "grams" ? "active weightModeButton" : "weightModeButton"}
        onClick={onUseGrams}
      >
        <span className="weightModeIcon">⚖</span>
      </button>

      <div className="foodEditPortionDropdown">
        <button
          type="button"
          className="foodEditPortionDropdownButton"
          onClick={onToggleUnitMenu}
        >
          <strong>{selectedUnit?.shortLabel || selectedUnit?.label || "Порция"}</strong>
          <em>{unitMenuOpen ? "⌃" : "⌄"}</em>
        </button>

        {unitMenuOpen && (
          <div className="foodEditPortionDropdownMenu">
            {unitOptions.map((unit) => (
              <button
                type="button"
                key={unit.id}
                className={selectedUnitId === unit.id ? "active" : ""}
                onClick={() => onSelectUnit(unit)}
              >
                <span>{unit.shortLabel || unit.label}</span>
                {unit.hint && <small>{unit.hint}</small>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
