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
  onOpenEditPage
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

  return (
    <>
      <div className="foodEditAmountCard foodProductAmountStepper">
        <span>{isPortionMode ? `${selectedFood.portion || "Порция"}` : "Граммы"}</span>
        <div className={`foodProductAmountControls ${isPortionMode ? "isPortionMode" : "isWeightMode"}`}>
          {isPortionMode && (
            <button
              type="button"
              className="foodProductAmountStep"
              onClick={() => updateSteppedAmount(-step)}
              aria-label="Уменьшить количество"
            >
              −
            </button>
          )}
          <div className="foodProductAmountInputWrap">
            <input
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder={isPortionMode ? "1" : "100"}
              inputMode="decimal"
              aria-label="Количество продукта"
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? "nutrition-amount-error" : undefined}
            />
            <em>{unitLabel}</em>
          </div>
          {isPortionMode && (
            <button
              type="button"
              className="foodProductAmountStep"
              onClick={() => updateSteppedAmount(step)}
              aria-label="Увеличить количество"
            >
              +
            </button>
          )}
        </div>
        {amountError && (
          <small className="nutritionInlineError" id="nutrition-amount-error">
            {amountError}
          </small>
        )}
      </div>

      <div className="foodEditMacrosCards">
        <div className="foodEditCaloriesMacroCard">
          <span>Калории</span>
          <strong>{Math.round(selectedFood.calories * scale)}</strong>
          <small>ккал</small>
        </div>
        <div>
          <span>Белки</span>
          <strong>{roundMacro(selectedFood.protein * scale)}</strong>
          <small>г</small>
        </div>
        <div>
          <span>Жиры</span>
          <strong>{roundMacro(selectedFood.fat * scale)}</strong>
          <small>г</small>
        </div>
        <div>
          <span>Углеводы</span>
          <strong>{roundMacro(selectedFood.carbs * scale)}</strong>
          <small>г</small>
        </div>
      </div>

      <div className="foodEditRowsCard">
        <button
          type="button"
          className={`foodEditRow ${editNote ? "" : "muted"}`}
          onClick={onOpenEditPage}
        >
          <span className="foodEditRowIcon">▤</span>
          <span className="foodEditRowLabel">Описание продукта</span>
          <strong>{editNote.trim() || "Не добавлено"}</strong>
          <em>›</em>
        </button>
      </div>
    </>
  );
}
