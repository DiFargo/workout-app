import FoodEditPage from "./FoodEditPage";
import FoodPortionSelector from "./FoodPortionSelector";
import FoodProductActionBar from "./FoodProductActionBar";
import FoodProductHeader from "./FoodProductHeader";
import FoodProductNutrition from "./FoodProductNutrition";
import FoodProductTopActions from "./FoodProductTopActions";
import NutritionDeleteConfirmModal from "./NutritionDeleteConfirmModal";
import styles from "./FoodProductPage.module.css";

export default function FoodProductPage({
  selectedFood,
  editPageOpen,
  meals,
  mealId,
  mealMenuOpen,
  amount,
  amountMode,
  amountError,
  unitMenuOpen,
  editNote,
  iconPresets,
  productErrors,
  dishIngredientPickerOpen,
  dishIngredientSearch,
  dishIngredientLoading,
  nutrition,
  recentFoods,
  dishIngredientExternalFoods,
  dishIngredientFallbackSuggestions,
  pendingDishIngredient,
  pendingDishIngredientGrams,
  deleteConfirmOpen,
  canDelete,
  getFoodIcon,
  getFoodScale,
  getFoodPortionAmount,
  getSmartUnits,
  getSmartUnitId,
  roundMacro,
  validateAmount,
  onToggleMealMenu,
  onSelectMeal,
  onUseGrams,
  onToggleUnitMenu,
  onSelectUnit,
  onAmountChange,
  onOpenEditPage,
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
  onCancelEdit,
  onConfirmEdit,
  onBack,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
  onAdd
}) {
  return (
    <div
      className={styles.root}
      data-css-module-scope="food-product-page"
      data-testid="food-product-page"
    >
      {!editPageOpen && (
        <FoodProductTopActions
          canDelete={canDelete}
          onDelete={onDelete}
          onEdit={onOpenEditPage}
        />
      )}

      <FoodProductHeader
        showFlowHeader={!editPageOpen}
        selectedFood={selectedFood}
        meals={meals}
        mealId={mealId}
        mealMenuOpen={mealMenuOpen}
        getFoodIcon={getFoodIcon}
        onToggleMealMenu={onToggleMealMenu}
        onSelectMeal={onSelectMeal}
      />

      <FoodPortionSelector
        selectedFood={selectedFood}
        amount={amount}
        amountMode={amountMode}
        unitMenuOpen={unitMenuOpen}
        getSmartUnits={getSmartUnits}
        getSmartUnitId={getSmartUnitId}
        onUseGrams={onUseGrams}
        onToggleUnitMenu={onToggleUnitMenu}
        onSelectUnit={onSelectUnit}
      />

      <FoodProductNutrition
        selectedFood={selectedFood}
        amount={amount}
        amountMode={amountMode}
        amountError={amountError}
        editNote={editNote}
        validateAmount={validateAmount}
        getFoodScale={getFoodScale}
        roundMacro={roundMacro}
        onAmountChange={onAmountChange}
        onOpenEditPage={onOpenEditPage}
      />

      <FoodEditPage
        isOpen={editPageOpen}
        selectedFood={selectedFood}
        iconPresets={iconPresets}
        productErrors={productErrors}
        editNote={editNote}
        dishIngredientPickerOpen={dishIngredientPickerOpen}
        dishIngredientSearch={dishIngredientSearch}
        dishIngredientLoading={dishIngredientLoading}
        nutrition={nutrition}
        recentFoods={recentFoods}
        dishIngredientExternalFoods={dishIngredientExternalFoods}
        dishIngredientFallbackSuggestions={dishIngredientFallbackSuggestions}
        pendingDishIngredient={pendingDishIngredient}
        pendingDishIngredientGrams={pendingDishIngredientGrams}
        getFoodIcon={getFoodIcon}
        getFoodPortionAmount={getFoodPortionAmount}
        onUpdateField={onUpdateField}
        onUpdateDishTotalWeight={onUpdateDishTotalWeight}
        onUpdatePortionUnit={onUpdatePortionUnit}
        onOpenIngredientPicker={onOpenIngredientPicker}
        onRemoveIngredient={onRemoveIngredient}
        onCloseIngredientPicker={onCloseIngredientPicker}
        onDishIngredientSearchChange={onDishIngredientSearchChange}
        onPendingDishIngredientChange={onPendingDishIngredientChange}
        onPendingDishIngredientGramsChange={onPendingDishIngredientGramsChange}
        onAddSelectedDishIngredientFromFood={onAddSelectedDishIngredientFromFood}
        onEditNoteChange={onEditNoteChange}
        onCancel={onCancelEdit}
        onConfirm={onConfirmEdit}
      />

      <FoodProductActionBar
        hidden={editPageOpen}
        onBack={onBack}
        onAdd={onAdd}
      />

      <NutritionDeleteConfirmModal
        open={deleteConfirmOpen}
        foodName={selectedFood?.name}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}
