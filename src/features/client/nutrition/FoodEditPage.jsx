import DishEditIngredientsBox from "./DishEditIngredientsBox";
import DishIngredientPicker from "./DishIngredientPicker";
import FoodEditBasicFields from "./FoodEditBasicFields";
import styles from "./FoodEditPage.module.css";

export default function FoodEditPage({
  isOpen,
  selectedFood,
  iconPresets,
  productErrors,
  editNote,
  dishIngredientPickerOpen,
  dishIngredientSearch,
  dishIngredientLoading,
  nutrition,
  recentFoods,
  dishIngredientExternalFoods,
  dishIngredientFallbackSuggestions,
  pendingDishIngredient,
  pendingDishIngredientGrams,
  getFoodIcon,
  getFoodPortionAmount,
  onUpdateField,
  onUpdateDishTotalWeight,
  onUpdatePortionUnit,
  onOpenIngredientPicker,
  onRemoveIngredient,
  onCloseIngredientPicker,
  onDishIngredientSearchChange,
  onPendingDishIngredientChange,
  onPendingDishIngredientGramsChange,
  onAddSelectedDishIngredientFromFood,
  onEditNoteChange,
  onCancel,
  onConfirm
}) {
  if (!isOpen) {
    return null;
  }

  const isDish = selectedFood?.type === "dish";

  return (
    <div
      className={styles.overlay}
      data-css-module-scope="food-edit-page"
      data-food-edit-page-part="overlay"
    >
      <div
        className={styles.sheet}
        data-testid="food-edit-page"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-label={isDish ? "Редактирование блюда" : "Редактирование продукта"}
      >
        <div className={styles.header} data-food-edit-page-part="header">
          <span
            className={styles.headerSpacer}
            data-food-edit-page-part="header-spacer"
            aria-hidden="true"
          />

          <strong
            className={styles.title}
            data-food-edit-page-part="title"
            data-css-module-text="food-edit-page"
          >
            {isDish ? "Редактирование блюда" : "Редактирование продукта"}
          </strong>

          <button
            type="button"
            className={styles.closeButton}
            data-food-edit-page-action="close"
            data-css-module-control="food-edit-page"
            onClick={onCancel}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className={styles.content} data-food-edit-page-part="content">
          <FoodEditBasicFields
            selectedFood={selectedFood}
            iconPresets={iconPresets}
            productErrors={productErrors}
            getFoodIcon={getFoodIcon}
            getFoodPortionAmount={getFoodPortionAmount}
            onUpdateField={onUpdateField}
            onUpdateDishTotalWeight={onUpdateDishTotalWeight}
            onUpdatePortionUnit={onUpdatePortionUnit}
          />

          <DishEditIngredientsBox
            selectedFood={selectedFood}
            getFoodIcon={getFoodIcon}
            onOpenIngredientPicker={onOpenIngredientPicker}
            onRemoveIngredient={onRemoveIngredient}
          />

          <DishIngredientPicker
            isOpen={dishIngredientPickerOpen}
            search={dishIngredientSearch}
            loading={dishIngredientLoading}
            nutrition={nutrition}
            recentFoods={recentFoods}
            externalFoods={dishIngredientExternalFoods}
            fallbackSuggestions={dishIngredientFallbackSuggestions}
            pendingIngredient={pendingDishIngredient}
            pendingGrams={pendingDishIngredientGrams}
            getFoodIcon={getFoodIcon}
            getFoodPortionAmount={getFoodPortionAmount}
            onClose={onCloseIngredientPicker}
            onSearchChange={onDishIngredientSearchChange}
            onPendingIngredientChange={onPendingDishIngredientChange}
            onPendingGramsChange={onPendingDishIngredientGramsChange}
            onAddIngredientFromFood={onAddSelectedDishIngredientFromFood}
          />

          <label
            className={styles.noteField}
            data-food-edit-page-part="note-field"
            data-css-module-control="food-edit-page"
          >
            <span
              className={styles.noteLabel}
              data-food-edit-page-part="note-label"
              data-css-module-text="food-edit-page"
            >
              {isDish ? "Заметка" : "Описание продукта"}
            </span>
            <textarea
              className={styles.noteInput}
              data-food-edit-page-part="note-input"
              data-css-module-control="food-edit-page"
              value={editNote}
              onChange={(event) => onEditNoteChange(event.target.value)}
              rows={5}
              placeholder={isDish ? "Например: рецепт, способ приготовления, порции" : "Бренд, текст с этикетки, состав, масса нетто и пищевая ценность"}
            />
          </label>
        </div>

        <nav
          className={styles.actionBar}
          data-food-edit-page-part="actions"
          aria-label="Действия редактора продукта"
        >
          <button
            type="button"
            className={styles.actionButton}
            data-food-edit-page-action="back"
            data-css-module-control="food-edit-page"
            onClick={onCancel}
          >
            <span aria-hidden="true" data-css-module-text="food-edit-page">←</span>
            <strong data-css-module-text="food-edit-page">Назад</strong>
          </button>

          <button
            type="button"
            className={`${styles.actionButton} ${styles.confirmAction}`}
            data-food-edit-page-action="confirm"
            data-css-module-control="food-edit-page"
            disabled={!String(selectedFood?.name || "").trim()}
            onClick={onConfirm}
          >
            <span aria-hidden="true" data-css-module-text="food-edit-page">✓</span>
            <strong data-css-module-text="food-edit-page">Сохранить</strong>
          </button>
        </nav>
      </div>
    </div>
  );
}
