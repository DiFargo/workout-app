import styles from "./FoodEditBasicFields.module.css";

function selectNumericValue(event) {
  event.currentTarget.select();
}

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
    <div
      className={styles.root}
      data-css-module-scope="food-edit-basic-fields"
      data-testid="food-edit-basic-fields"
      data-food-type={isDish ? "dish" : "food"}
    >
      <section className={`${styles.section} ${styles.mainSection}`} aria-label="Название и иконка">
        <label
          className={styles.field}
          data-css-module-control="food-edit-basic-fields"
          data-testid="food-edit-basic-name"
        >
          <span className={styles.labelText}>{isDish ? "Название блюда" : "Название продукта"}</span>
          <input
            className={styles.input}
            data-css-module-control="food-edit-basic-fields"
            value={selectedFood.name}
            onChange={(event) => onUpdateField("name", event.target.value)}
            placeholder={isDish ? "Например, сырники" : "Например, греческий йогурт"}
            required
            aria-required="true"
            aria-invalid={!String(selectedFood.name || "").trim()}
          />
        </label>

        <div className={styles.iconBox} data-testid="food-edit-basic-icon">
          <label className={`${styles.field} ${styles.iconField}`} data-css-module-control="food-edit-basic-fields">
            <span className={styles.labelText}>Иконка</span>
            <input
              className={`${styles.input} ${styles.iconInput}`}
              data-css-module-control="food-edit-basic-fields"
              value={selectedFood.icon || ""}
              onChange={(event) => onUpdateField("icon", event.target.value.slice(0, 4))}
              placeholder={getFoodIcon(selectedFood)}
              maxLength={4}
            />
          </label>
        </div>
      </section>

      <div className={styles.presetRow} data-testid="food-edit-basic-presets">
        {iconPresets.map((icon) => (
          <button
            type="button"
            key={icon}
            className={`${styles.presetButton}${selectedFood.icon === icon ? ` ${styles.presetActive}` : ""}`}
            data-css-module-control="food-edit-basic-fields"
            aria-pressed={selectedFood.icon === icon}
            onClick={() => onUpdateField("icon", icon)}
            aria-label={`Выбрать иконку ${icon}`}
          >
            {icon}
          </button>
        ))}
      </div>

      <section className={styles.section} aria-labelledby="food-edit-macros-title">
        <div className={styles.sectionHeader}>
          <strong id="food-edit-macros-title">Пищевая ценность</strong>
          <span>{isDish ? "На всё блюдо" : `На 100 ${portionUnit}`}</span>
        </div>

        <div className={styles.macroGrid} data-testid="food-edit-basic-macros">
        <label className={`${styles.field} ${styles.macroField}`} data-css-module-control="food-edit-basic-fields">
          <span className={`${styles.labelText} ${styles.macroTitle}`}>{isDish ? "Ккал всего" : "Ккал"}</span>
          <input
            className={`${styles.input} ${styles.macroInput}`}
            data-css-module-control="food-edit-basic-fields"
            value={selectedFood.calories}
            onChange={(event) => onUpdateField("calories", event.target.value)}
            onFocus={selectNumericValue}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.calories)}
          />
        </label>

        <label className={`${styles.field} ${styles.macroField}`} data-css-module-control="food-edit-basic-fields">
          <span className={`${styles.labelText} ${styles.macroTitle}`}>{isDish ? "Белки всего" : "Белки"}</span>
          <input
            className={`${styles.input} ${styles.macroInput}`}
            data-css-module-control="food-edit-basic-fields"
            value={selectedFood.protein}
            onChange={(event) => onUpdateField("protein", event.target.value)}
            onFocus={selectNumericValue}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.protein)}
          />
        </label>

        <label className={`${styles.field} ${styles.macroField}`} data-css-module-control="food-edit-basic-fields">
          <span className={`${styles.labelText} ${styles.macroTitle}`}>{isDish ? "Жиры всего" : "Жиры"}</span>
          <input
            className={`${styles.input} ${styles.macroInput}`}
            data-css-module-control="food-edit-basic-fields"
            value={selectedFood.fat}
            onChange={(event) => onUpdateField("fat", event.target.value)}
            onFocus={selectNumericValue}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.fat)}
          />
        </label>

        <label className={`${styles.field} ${styles.macroField}`} data-css-module-control="food-edit-basic-fields">
          <span className={`${styles.labelText} ${styles.macroTitle}`}>{isDish ? "Углеводы всего" : "Углеводы"}</span>
          <input
            className={`${styles.input} ${styles.macroInput}`}
            data-css-module-control="food-edit-basic-fields"
            value={selectedFood.carbs}
            onChange={(event) => onUpdateField("carbs", event.target.value)}
            onFocus={selectNumericValue}
            inputMode="decimal"
            aria-invalid={Boolean(productErrors.carbs)}
          />
        </label>
        </div>
      </section>

      <section className={`${styles.section} ${styles.portionSection}`} aria-label={isDish ? "Вес готового блюда" : "Порция"}>
        <label
          className={`${styles.field} ${styles.portionField}`}
          data-css-module-control="food-edit-basic-fields"
          data-testid="food-edit-basic-portion"
        >
          <span className={styles.labelText}>{isDish ? "Итоговый вес" : "Вес порции"}</span>
          <div className={styles.portionRow} data-testid="food-edit-basic-portion-row">
          <input
            className={styles.portionInput}
            data-css-module-control="food-edit-basic-fields"
            value={portionValue}
            onFocus={selectNumericValue}
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
            className={styles.portionToggle}
            data-css-module-control="food-edit-basic-fields"
            data-food-edit-basic-action="toggle-unit"
            aria-pressed={portionUnit === "мл"}
            onClick={() => onUpdatePortionUnit(portionUnit === "г" ? "мл" : "г")}
            aria-label="Сменить единицу порции"
          >
            {portionUnit}
          </button>
          </div>
        </label>
        {isDish && <small className={styles.portionHint}>Вес после приготовления</small>}
      </section>

      {Object.values(productErrors).some(Boolean) && (
        <div className={styles.validation} data-testid="food-edit-basic-validation" role="alert">
          {Object.values(productErrors).filter(Boolean)[0]}
        </div>
      )}
    </div>
  );
}
