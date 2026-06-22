import { makePersonalFoodKey } from "../../../utils/nutritionFoodModel";

export function createNutritionSelectedFoodDeleteHandlers({
  editingNutritionItemId,
  nutrition,
  selectedNutritionFood,
  removeMyNutritionFood,
  removeNutritionFood,
  setEditingNutritionItemId,
  setNutritionAmount,
  setNutritionDeleteConfirmOpen,
  setNutritionEditDetailsOpen,
  setNutritionEditNote,
  setNutritionEditPageOpen,
  setNutritionMealMenuOpen,
  setNutritionPickerOpen,
  setNutritionSearch,
  setNutritionSearchTab,
  setSelectedNutritionFood,
  setShowRecentNutritionFoods
}) {
  function canDeleteSelectedNutritionFood() {
    if (!selectedNutritionFood) return false;

    const editId = String(editingNutritionItemId || "");
    const selectedId = String(selectedNutritionFood.id || selectedNutritionFood.foodId || "");
    const selectedSource = String(selectedNutritionFood.source || "");

    return Boolean(
      editingNutritionItemId ||
      editId.startsWith("my:") ||
      selectedId.startsWith("my_") ||
      selectedSource === "Моя база" ||
      nutrition.myFoods?.[selectedId]
    );
  }

  function deleteSelectedNutritionFood(confirmed = false) {
    if (!selectedNutritionFood) return;

    const editId = String(editingNutritionItemId || "");
    const selectedId = String(selectedNutritionFood.id || selectedNutritionFood.foodId || "");
    const selectedSource = String(selectedNutritionFood.source || "");
    const isMyProduct =
      editId.startsWith("my:") ||
      selectedId.startsWith("my_") ||
      selectedSource === "Моя база" ||
      nutrition.myFoods?.[selectedId];

    if (isMyProduct) {
      if (!confirmed) {
        setNutritionDeleteConfirmOpen(true);
        return;
      }

      const myFoodId = editId.startsWith("my:")
        ? editId.replace("my:", "")
        : (nutrition.myFoods?.[selectedId] ? selectedId : makePersonalFoodKey(selectedNutritionFood));

      removeMyNutritionFood(myFoodId, selectedNutritionFood.name || "");
      setNutritionDeleteConfirmOpen(false);
      setSelectedNutritionFood(null);
      setEditingNutritionItemId(null);
      setNutritionEditDetailsOpen(false);
      setNutritionEditPageOpen(false);
      setNutritionEditNote("");
      setNutritionAmount("100");
      setNutritionSearch("");
      setNutritionSearchTab("my");
      setShowRecentNutritionFoods(false);
      setNutritionMealMenuOpen(false);
      setNutritionPickerOpen(true);
      return;
    }

    if (!editingNutritionItemId) return;

    removeNutritionFood(editingNutritionItemId);
    setSelectedNutritionFood(null);
    setEditingNutritionItemId(null);
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionEditNote("");
    setNutritionPickerOpen(false);
  }

  return {
    canDeleteSelectedNutritionFood,
    deleteSelectedNutritionFood
  };
}
