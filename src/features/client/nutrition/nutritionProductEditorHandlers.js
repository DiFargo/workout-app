import {
  buildCustomNutritionDishDraft,
  buildCustomNutritionFoodDraft,
  getDefaultNutritionSmartUnit,
  getNutritionSmartUnits,
  normalizeNutritionFood
} from "../../../utils/nutritionFoodModel";
import { getFoodIcon } from "../../../utils/nutritionFoodPresentation";
import { parseNutritionNumber } from "../../../utils/nutritionNumbers";
import { loadNutritionPreferredUnit } from "../../../utils/nutritionPreferenceStorage";
import { validateNutritionFoodDraft } from "../../../utils/clientUx";

export function createNutritionProductEditorHandlers({
  nutrition,
  nutritionEditNote,
  nutritionEditOriginalFood,
  nutritionEditOriginalNote,
  selectedNutritionFood,
  showAppError,
  setEditingNutritionItemId,
  setFatSecretError,
  setNutritionAmount,
  setNutritionAmountError,
  setNutritionAmountMode,
  setNutritionCreateChoiceOpen,
  setNutritionEditDetailsOpen,
  setNutritionEditNote,
  setNutritionEditOriginalFood,
  setNutritionEditOriginalNote,
  setNutritionEditPageOpen,
  setNutritionFallbackSuggestions,
  setNutritionMealMenuOpen,
  setNutritionPickerOpen,
  setNutritionProductErrors,
  setNutritionSearchTab,
  setSelectedNutritionFood,
  setShowRecentNutritionFoods
}) {
  function createCustomNutritionFood() {
    const draftFood = buildCustomNutritionFoodDraft();

    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setEditingNutritionItemId(null);
    setNutritionMealMenuOpen(false);
    setNutritionCreateChoiceOpen(false);
    setSelectedNutritionFood(draftFood);
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(true);
  }

  function createCustomNutritionDish() {
    const draftDish = buildCustomNutritionDishDraft();

    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setEditingNutritionItemId(null);
    setNutritionMealMenuOpen(false);
    setNutritionCreateChoiceOpen(false);
    setSelectedNutritionFood(draftDish);
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(true);
  }

  function addNutritionFoodFromPicker(food) {
    const normalizedFood = normalizeNutritionFood(food);
    const storedFood = nutrition.myFoods?.[normalizedFood.id] || nutrition.myFoods?.[normalizedFood.foodId];

    const foodForPicker = {
      ...normalizedFood,
      portionAmount: storedFood?.portionAmount || normalizedFood.portionAmount || 0,
      amountMode: storedFood?.amountMode || normalizedFood.amountMode || "",
      icon: storedFood?.icon || normalizedFood.icon || getFoodIcon(normalizedFood)
    };

    const savedAmount = storedFood?.lastAmount || normalizedFood.lastAmount;
    const preferredUnitId = loadNutritionPreferredUnit(foodForPicker);
    const defaultUnit =
      getNutritionSmartUnits(foodForPicker).find((unit) => unit.id === preferredUnitId) ||
      getDefaultNutritionSmartUnit(foodForPicker);
    const nextAmount = savedAmount || foodForPicker.portionAmount || defaultUnit.portionAmount || defaultUnit.amount || 100;
    const nextMode = "grams";

    if (!savedAmount && defaultUnit.mode === "portion") {
      foodForPicker.portion = defaultUnit.portion || defaultUnit.label || foodForPicker.portion;
      foodForPicker.portionAmount = defaultUnit.portionAmount || defaultUnit.amount || foodForPicker.portionAmount;
    }

    setEditingNutritionItemId(null);
    setSelectedNutritionFood(foodForPicker);
    setNutritionAmount(String(nextAmount));
    setNutritionAmountMode(nextMode);
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setNutritionEditNote(foodForPicker.description || foodForPicker.note || "");
  }

  function updateSelectedNutritionFoodField(field, value) {
    setNutritionProductErrors((current) => ({ ...current, [field]: "" }));
    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const numericFields = ["calories", "protein", "fat", "carbs", "portionAmount", "lastAmount"];
      if (numericFields.includes(field)) {
        return {
          ...prev,
          [field]: value
        };
      }

      return {
        ...prev,
        [field]: value
      };
    });
  }

  function updateSelectedNutritionPortionUnit(unit) {
    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const currentPortion = String(prev.portion || "").trim();
      const match = currentPortion.match(/(\d+[,.]?\d*)/);
      const amount = match?.[1] || String(prev.portionAmount || prev.lastAmount || "100");

      return {
        ...prev,
        portion: `${amount} ${unit}`,
        portionAmount: parseNutritionNumber(amount, 0) || prev.portionAmount || 100
      };
    });
  }

  function cloneNutritionFoodForEdit(food) {
    if (!food) return null;

    try {
      return JSON.parse(JSON.stringify(food));
    } catch {
      return { ...food };
    }
  }

  function openNutritionEditPage() {
    setNutritionEditOriginalFood(cloneNutritionFoodForEdit(selectedNutritionFood));
    setNutritionEditOriginalNote(nutritionEditNote);
    setNutritionProductErrors({});
    setNutritionEditPageOpen(true);
  }

  function cancelNutritionEditPage() {
    const originalFood = cloneNutritionFoodForEdit(nutritionEditOriginalFood);

    if (originalFood) {
      setSelectedNutritionFood(originalFood);
    }

    setNutritionEditNote(nutritionEditOriginalNote || "");
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setNutritionProductErrors({});
    setNutritionEditPageOpen(false);
  }

  function confirmNutritionEditPage() {
    const validation = validateNutritionFoodDraft(selectedNutritionFood);
    setNutritionProductErrors(validation.errors);
    if (!validation.valid) {
      showAppError(
        "validation",
        Object.values(validation.errors)[0] || "Проверь данные продукта."
      );
      return;
    }

    setSelectedNutritionFood((current) => current ? {
      ...current,
      name: validation.values.name,
      calories: validation.values.calories,
      protein: validation.values.protein,
      fat: validation.values.fat,
      carbs: validation.values.carbs,
      portionAmount: validation.values.portionAmount,
      ...(current.type === "dish" ? { totalWeight: validation.values.portionAmount } : {})
    } : current);
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setNutritionProductErrors({});
    setNutritionEditPageOpen(false);
  }

  function closeSelectedNutritionFood() {
    setNutritionMealMenuOpen(false);
    setNutritionEditNote("");
    setSelectedNutritionFood(null);
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setEditingNutritionItemId(null);
    setNutritionSearchTab("food");
    setShowRecentNutritionFoods(false);
    setNutritionPickerOpen(true);
  }

  return {
    createCustomNutritionFood,
    createCustomNutritionDish,
    addNutritionFoodFromPicker,
    updateSelectedNutritionFoodField,
    updateSelectedNutritionPortionUnit,
    openNutritionEditPage,
    cancelNutritionEditPage,
    confirmNutritionEditPage,
    closeSelectedNutritionFood
  };
}
