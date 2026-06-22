export default function FoodEditBasicFields({
  selectedFood,
  iconPresets,
  productErrors,
  getFoodIcon,
  getFoodPortionAmount,
  onUpdateField,
  onUpdateDishTotalWeight,
  onUpdatePortionUnit
}) {
  const isDish = selectedFood?.type === "dish";
  const portionValue = String(isDish
    ? (selectedFood.totalWeight ?? selectedFood.portionAmount ?? "")
    : (selectedFood.portionAmount ?? getFoodPortionAmount(selectedFood) ?? "")
  ).replace(/\s?(г|гр|g|мл|ml)$/iu, "").trim();
  const portionUnit = String(selectedFood.portion || "").toLowerCase().includes("мл") ? "мл" : "г";

  return (
    <>
      <label>
        <span>{isDish ? "Название блюда" : "Краткое название продукта"}</span>
        <input
          value={selectedFood.name}
          onChange={(event) => onUpdateField("name", event.target.value)}
          placeholder="Название"
          autoFocus
          required
          aria-required="true"
          aria-invalid={!String(selectedFood.name || "").trim()}
        />
      </label>

      <div className="foodEditIconManualBox">
        <div className="foodEditIconPreviewManual">
          <span>{selectedFood.icon || getFoodIcon(selectedFood)}</span>
        </div>

        <label>
          <span>Иконка</span>
          <input
            value={selectedFood.icon || ""}
            onChange={(event) => onUpdateField("icon", event.target.value.slice(0, 4))}
            placeholder="🍗"
            maxLength={4}
          />
        </label>
      </div>

      <div className="foodEditIconPresetRow">
        {iconPresets.map((icon) => (
          <button
            type="button"
            key={icon}
            className={selectedFood.icon === icon ? "active" : ""}
            onClick={() => onUpdateField("icon", icon)}
            aria-label={`Выбрать иконку ${icon}`}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="foodEditPageGrid">
        <label>
          <span>{isDish ? "Ккал всего" : "Ккал"}</span>
          <input
            value={selectedFood.calories}
            onChange={(event) => onUpdateField("calories", event.target.value)}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.calories)}
          />
        </label>

        <label>
          <span>{isDish ? "Белки всего" : "Белки"}</span>
          <input
            value={selectedFood.protein}
            onChange={(event) => onUpdateField("protein", event.target.value)}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.protein)}
          />
        </label>

        <label>
          <span>{isDish ? "Жиры всего" : "Жиры"}</span>
          <input
            value={selectedFood.fat}
            onChange={(event) => onUpdateField("fat", event.target.value)}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.fat)}
          />
        </label>

        <label>
          <span>{isDish ? "Углеводы всего" : "Углеводы"}</span>
          <input
            value={selectedFood.carbs}
            onChange={(event) => onUpdateField("carbs", event.target.value)}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.carbs)}
          />
        </label>
      </div>

      <label className="foodEditPortionLabel">
        <span>{isDish ? "Итоговый вес блюда" : "Вес порции"}</span>
        <div className="foodEditPortionUnitRow foodEditPortionInlineUnit">
          <input
            value={portionValue}
            onChange={(event) => {
              if (isDish) {
                onUpdateDishTotalWeight(event.target.value);
                return;
              }

              onUpdateField("portion", `${event.target.value} ${portionUnit}`);
              onUpdateField("portionAmount", event.target.value);
            }}
            placeholder="100"
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.portionAmount)}
          />
          <button
            type="button"
            className="foodEditPortionUnitToggle"
            onClick={() => onUpdatePortionUnit(portionUnit === "г" ? "мл" : "г")}
            aria-label="Сменить единицу порции"
          >
            {portionUnit}
          </button>
        </div>
      </label>

      {Object.values(productErrors).some(Boolean) && (
        <div className="nutritionProductValidation" role="alert">
          {Object.values(productErrors).filter(Boolean)[0]}
        </div>
      )}
    </>
  );
}
