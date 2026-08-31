import styles from "./FoodProductNutrition.module.css";

export default function FoodProductNutrition({
  selectedFood,
  amount,
  amountMode,
  amountError,
  editNote,
  validateAmount,
  getFoodScale,
  roundMacro,
  onAmountChange,
  onOpenEditPage,
  onAdd
}) {
  const amountValidation = validateAmount(amount);
  const scale = amountValidation.valid
    ? getFoodScale(amountValidation.amount, selectedFood, amountMode)
    : 0;
  const isPortionMode = amountMode === "portion";
  const unitLabel = String(selectedFood.portion || "").toLowerCase().includes("мл") ? "мл" : "г";
  const portionStep = Number(String(selectedFood.portionAmount || "").replace(",", ".")) || 1;
  const step = isPortionMode ? portionStep : 10;
  const numericAmount = Number(String(amount || "").replace(",", ".")) || 0;
  const updateSteppedAmount = (delta) => {
    const nextAmount = Math.max(0, numericAmount + delta);
    const roundedAmount = Math.round(nextAmount * 10) / 10;
    onAmountChange(String(roundedAmount || ""));
  };
  const clearDefaultAmountOnFocus = () => {
    if (isPortionMode || String(amount).trim() !== "100") {
      return;
    }

    onAmountChange("");
  };
  const confirmAmountFromKeyboard = (event) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    onAdd();
  };

  return (
    <>
      <div
        className={styles.amountCard}
        data-css-module-scope="food-product-nutrition"
        data-testid="food-product-amount"
        data-amount-mode={isPortionMode ? "portion" : "weight"}
      >
        <span className={styles.amountLabel} data-css-module-text>
          {isPortionMode ? `${selectedFood.portion || "Порция"}` : "Граммы"}
        </span>
        <div className={`${styles.amountControls} ${isPortionMode ? styles.portionMode : styles.weightMode}`}>
          {isPortionMode && (
            <button
              type="button"
              className={styles.stepButton}
              data-css-module-control
              data-food-amount-action="decrease"
              onClick={() => updateSteppedAmount(-step)}
              aria-label="Уменьшить количество"
            >
              −
            </button>
          )}
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              data-css-module-control
              data-food-amount-input
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              onFocus={clearDefaultAmountOnFocus}
              placeholder={isPortionMode ? "1" : "0"}
              inputMode="decimal"
              enterKeyHint="done"
              onKeyDown={confirmAmountFromKeyboard}
              aria-label="Количество продукта"
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? "nutrition-amount-error" : undefined}
            />
            <em>{unitLabel}</em>
          </div>
          {isPortionMode && (
            <button
              type="button"
              className={styles.stepButton}
              data-css-module-control
              data-food-amount-action="increase"
              onClick={() => updateSteppedAmount(step)}
              aria-label="Увеличить количество"
            >
              +
            </button>
          )}
        </div>
        {amountError && (
          <small className={styles.error} id="nutrition-amount-error" role="alert">
            {amountError}
          </small>
        )}
      </div>

      <div className={styles.macros} data-testid="food-product-macros">
        <div className={styles.macroCard}>
          <span data-css-module-text>Калории</span>
          <strong data-css-module-text>{Math.round(selectedFood.calories * scale)}</strong>
          <small data-css-module-text>ккал</small>
        </div>
        <div className={styles.macroCard}>
          <span data-css-module-text>Белки</span>
          <strong data-css-module-text>{roundMacro(selectedFood.protein * scale)}</strong>
          <small data-css-module-text>г</small>
        </div>
        <div className={styles.macroCard}>
          <span data-css-module-text>Жиры</span>
          <strong data-css-module-text>{roundMacro(selectedFood.fat * scale)}</strong>
          <small data-css-module-text>г</small>
        </div>
        <div className={styles.macroCard}>
          <span data-css-module-text>Углеводы</span>
          <strong data-css-module-text>{roundMacro(selectedFood.carbs * scale)}</strong>
          <small data-css-module-text>г</small>
        </div>
      </div>

      <div className={styles.noteCard} data-testid="food-product-note-card">
        <button
          type="button"
          className={`${styles.noteButton} ${editNote ? "" : styles.muted}`}
          data-css-module-control
          data-food-product-action="edit-note"
          onClick={onOpenEditPage}
        >
          <span className={styles.noteIcon} aria-hidden="true" data-food-product-note-part="icon">▤</span>
          <span className={styles.noteLabel} data-css-module-text data-food-product-note-part="label">Редактировать продукт</span>
          <strong className={styles.noteValue} data-css-module-text>{editNote.trim() || "Не добавлено"}</strong>
          <em className={styles.chevron} aria-hidden="true">›</em>
        </button>
      </div>
    </>
  );
}
