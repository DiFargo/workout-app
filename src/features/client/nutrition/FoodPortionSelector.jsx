import { useId, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "./FoodPortionSelector.module.css";

function getOptionCopy(unit) {
  const label = String(unit.shortLabel || unit.label || "Порция").trim();
  const hint = String(unit.hint || "").trim();
  const normalize = value => value.replace(/[≈~\s]/gu, "").replace(",", ".").toLowerCase();

  if (hint && normalize(label) === normalize(hint)) {
    return { label: "", hint: label };
  }
  if (hint && label.endsWith(hint)) {
    const name = label.slice(0, -hint.length).trim();
    return { label: name === "Порция" ? "" : name, hint };
  }
  return { label: hint && label === "Порция" ? "" : label, hint };
}

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
  const menuId = useId();
  const toggleRef = useRef(null);
  const unitOptions = getSmartUnits(selectedFood).filter((unit) => unit.id !== "grams");
  const selectedUnitId = getSmartUnitId(selectedFood, amount, amountMode);
  const isPortionMode = amountMode === "portion";

  return (
    <div
      className={styles.root}
      data-css-module-scope="food-portion-selector"
      data-testid="food-portion-selector"
      onKeyDown={(event) => {
        if (event.key === "Escape" && unitMenuOpen) {
          event.preventDefault();
          event.stopPropagation();
          onToggleUnitMenu();
          toggleRef.current?.focus({ preventScroll: true });
        }
      }}
    >
      <button
        type="button"
        className={`${styles.modeButton} ${amountMode === "grams" ? styles.active : ""}`}
        data-css-module-control
        data-food-portion-action="grams"
        aria-pressed={amountMode === "grams"}
        onClick={onUseGrams}
      >
        <strong data-css-module-text>Вес</strong>
      </button>

      <div className={styles.dropdown}>
        <button
          type="button"
          ref={toggleRef}
          className={`${styles.dropdownButton} ${isPortionMode ? styles.active : ""}`}
          data-css-module-control
          data-food-portion-action="toggle-menu"
          aria-pressed={isPortionMode}
          aria-expanded={unitMenuOpen}
          aria-controls={menuId}
          onClick={onToggleUnitMenu}
        >
          <strong data-css-module-text>Порция</strong>
          <ChevronDown className={`${styles.caret} ${unitMenuOpen ? styles.caretOpen : ""}`} size={16} aria-hidden="true" />
        </button>
      </div>

        {unitMenuOpen && (
          <div id={menuId} className={styles.menu} data-testid="food-portion-menu" role="group" aria-label="Размер порции">
            {unitOptions.map((unit) => {
              const copy = getOptionCopy(unit);
              const isSelected = isPortionMode && selectedUnitId === unit.id;
              return (
              <button
                type="button"
                key={unit.id}
                className={`${styles.menuItem} ${isSelected ? styles.selected : ""}`}
                data-css-module-control
                data-food-portion-unit={unit.id}
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectUnit(unit);
                  toggleRef.current?.focus({ preventScroll: true });
                }}
              >
                {copy.label && <span data-css-module-text>{copy.label}</span>}
                {copy.hint && <small data-css-module-text>{copy.hint}</small>}
                <Check className={styles.check} aria-hidden="true" style={{ visibility: isSelected ? "visible" : "hidden" }} />
              </button>
              );
            })}
          </div>
        )}
    </div>
  );
}
