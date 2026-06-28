import DishEditIngredientsBox from "./DishEditIngredientsBox";
import DishIngredientPicker from "./DishIngredientPicker";
import FoodEditBasicFields from "./FoodEditBasicFields";

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
    <div className="foodEditPageOverlay">
      <div className="foodEditPageSheet">
        <div className="foodEditPageHeader">
          <span className="foodEditPageHeaderSpacer" aria-hidden="true" />

          <strong className="foodEditPageTitleCenter">
            {isDish ? "Редактирование блюда" : "Редактирование продукта"}
          </strong>

          <button
            type="button"
            className="foodEditPageHeaderClose"
            onClick={onCancel}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="foodEditPageContent">
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

          <label>
            <span>{isDish ? "Заметка" : "Описание продукта"}</span>
            <textarea
              value={editNote}
              onChange={(event) => onEditNoteChange(event.target.value)}
              rows={5}
              placeholder={isDish ? "Например: рецепт, способ приготовления, порции" : "Бренд, текст с этикетки, состав, масса нетто и пищевая ценность"}
            />
          </label>
        </div>

        <nav className="foodEditPageActionBar" aria-label="Действия редактора продукта">
          <button type="button" onClick={onCancel}>
            <span aria-hidden="true">←</span>
            <strong>Назад</strong>
          </button>

          <button
            type="button"
            className="foodEditPageConfirmAction"
            disabled={!String(selectedFood?.name || "").trim()}
            onClick={onConfirm}
          >
            <span aria-hidden="true">✓</span>
            <strong>Сохранить</strong>
          </button>
        </nav>
      </div>
    </div>
  );
}
