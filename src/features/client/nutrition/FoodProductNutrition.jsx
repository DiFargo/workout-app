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

  return (
    <>
      <label className="foodEditAmountCard">
        <span>{amountMode === "portion" ? `${selectedFood.portion || "Порция"}` : "Граммы"}</span>
        <input
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder={amountMode === "portion" ? "1" : "100"}
          inputMode="decimal"
          aria-invalid={Boolean(amountError)}
          aria-describedby={amountError ? "nutrition-amount-error" : undefined}
        />
        {amountError && (
          <small className="nutritionInlineError" id="nutrition-amount-error">
            {amountError}
          </small>
        )}
      </label>

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
