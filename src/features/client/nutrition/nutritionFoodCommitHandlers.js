import {
  makePersonalFoodKey,
  normalizeMyFoodRecord,
  normalizeNutritionFood
} from "../../../utils/nutritionFoodModel";
import { getFoodIcon } from "../../../utils/nutritionFoodPresentation";
import { parseNutritionNumber, roundMacro } from "../../../utils/nutritionNumbers";
import { getFoodPortionAmount, getFoodScale } from "../../../utils/nutritionPortions";
import { loadRecentNutritionFoods } from "../../../utils/nutritionPreferenceStorage";
import { validateNutritionAmount } from "../../../utils/clientUx";

export function createNutritionFoodCommitHandlers({
  editingNutritionItemId,
  nutritionAmount,
  nutritionAmountMode,
  nutritionEditNote,
  nutritionMeal,
  selectedNutritionFood,
  addNutritionFoodToDay,
  returnToNutritionMainAfterAdd,
  savePersonalMyFoodsToFirebase,
  showAppError,
  updateNutritionDay,
  setEditingNutritionItemId,
  setExpandedNutritionMeals,
  setNutrition,
  setNutritionAmountError,
  setNutritionEditNote,
  setRecentNutritionFoods
}) {
  function addNutritionFood(food, mealId = nutritionMeal, amount = nutritionAmount) {
    const amountValidation = validateNutritionAmount(amount);
    if (!amountValidation.valid) {
      setNutritionAmountError(amountValidation.error);
      return false;
    }

    const sourceFood = normalizeNutritionFood(food);
    const numericAmount = amountValidation.amount;
    const scale = getFoodScale(numericAmount, sourceFood, nutritionAmountMode);
    const item = {
      id: `${sourceFood.id}_${Date.now()}`,
      foodId: sourceFood.id,
      fatSecretId: food.fatSecretId || "",
      name: sourceFood.name,
      mealId,
      amount: numericAmount,
      amountMode: nutritionAmountMode,
      portion: sourceFood.portion,
      portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood)),
      calories: Math.round(sourceFood.calories * scale),
      protein: roundMacro(sourceFood.protein * scale),
      fat: roundMacro(sourceFood.fat * scale),
      carbs: roundMacro(sourceFood.carbs * scale),
      source: sourceFood.source,
      icon: sourceFood.icon || getFoodIcon(sourceFood),
      type: sourceFood.type || "",
      totalWeight: parseNutritionNumber(sourceFood.totalWeight, 0) || parseNutritionNumber(sourceFood.portionAmount, 0) || 0,
      ingredients: Array.isArray(sourceFood.ingredients) ? sourceFood.ingredients : [],
      note: nutritionEditNote.trim(),
      addedAt: new Date().toISOString()
    };

    addNutritionFoodToDay(item);

    setNutrition((prev) => {
      const myFoodId = makePersonalFoodKey(sourceFood);
      const existing = prev.myFoods?.[myFoodId];
      const personalFood = normalizeMyFoodRecord(
        {
          ...sourceFood,
          id: myFoodId,
          foodId: myFoodId,
          note: nutritionEditNote.trim(),
          description: nutritionEditNote.trim(),
          amountMode: nutritionAmountMode,
          portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood))
        },
        numericAmount,
        existing
      );

      const nextMyFoods = {
        ...(prev.myFoods || {}),
        [myFoodId]: personalFood
      };

      savePersonalMyFoodsToFirebase(nextMyFoods);

      return {
        ...prev,
        myFoods: nextMyFoods,
        recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId && id !== sourceFood.id)].slice(0, 20)
      };
    });

    setExpandedNutritionMeals((prev) => ({
      ...prev,
      [mealId]: true
    }));
    setNutritionAmountError("");
    return true;
  }

  function updateNutritionFood(itemId, food, amount = nutritionAmount) {
    const amountValidation = validateNutritionAmount(amount);
    if (!amountValidation.valid) {
      setNutritionAmountError(amountValidation.error);
      return false;
    }

    const sourceFood = normalizeNutritionFood(food);
    const numericAmount = amountValidation.amount;
    const scale = getFoodScale(numericAmount, sourceFood, nutritionAmountMode);

    updateNutritionDay((day) => ({
      ...day,
      foods: (day.foods || []).map((item) => (
        item.id === itemId
          ? {
              ...item,
              foodId: sourceFood.id,
              fatSecretId: sourceFood.fatSecretId || item.fatSecretId || "",
              name: sourceFood.name,
              mealId: nutritionMeal || item.mealId,
              amount: numericAmount,
              amountMode: nutritionAmountMode,
              portion: sourceFood.portion,
              portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood)),
              calories: Math.round(sourceFood.calories * scale),
              protein: roundMacro(sourceFood.protein * scale),
              fat: roundMacro(sourceFood.fat * scale),
              carbs: roundMacro(sourceFood.carbs * scale),
              source: sourceFood.source,
              icon: sourceFood.icon || getFoodIcon(sourceFood),
              type: sourceFood.type || "",
              totalWeight: parseNutritionNumber(sourceFood.totalWeight, 0) || parseNutritionNumber(sourceFood.portionAmount, 0) || 0,
              ingredients: Array.isArray(sourceFood.ingredients) ? sourceFood.ingredients : [],
              note: nutritionEditNote.trim(),
              updatedAt: new Date().toISOString()
            }
          : item
      ))
    }));

    setNutrition((prev) => {
      const myFoodId = makePersonalFoodKey(sourceFood);
      const existing = prev.myFoods?.[myFoodId];
      const personalFood = normalizeMyFoodRecord(
        {
          ...sourceFood,
          id: myFoodId,
          foodId: myFoodId,
          note: nutritionEditNote.trim(),
          description: nutritionEditNote.trim(),
          amountMode: nutritionAmountMode,
          portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood))
        },
        numericAmount,
        existing
      );

      const nextMyFoods = {
        ...(prev.myFoods || {}),
        [myFoodId]: personalFood
      };

      savePersonalMyFoodsToFirebase(nextMyFoods);

      return {
        ...prev,
        myFoods: nextMyFoods,
        recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId && id !== sourceFood.id)].slice(0, 20)
      };
    });
    setNutritionAmountError("");
    return true;
  }

  function confirmNutritionFoodFromPicker() {
    if (!selectedNutritionFood) return;

    const amountValidation = validateNutritionAmount(nutritionAmount);
    setNutritionAmountError(amountValidation.error);
    if (!amountValidation.valid) {
      showAppError("validation", amountValidation.error);
      return;
    }

    if (editingNutritionItemId && String(editingNutritionItemId).startsWith("my:")) {
      const myFoodId = String(editingNutritionItemId).replace("my:", "");
      const numericAmount = amountValidation.amount;

      const foodToAdd = normalizeNutritionFood({
        ...selectedNutritionFood,
        id: myFoodId,
        foodId: myFoodId,
        source: "Моя база",
        note: nutritionEditNote.trim(),
        description: nutritionEditNote.trim(),
        lastAmount: numericAmount,
        amountMode: nutritionAmountMode,
        portionAmount: nutritionAmountMode === "portion"
          ? numericAmount
          : (Number(selectedNutritionFood.portionAmount) || getFoodPortionAmount(selectedNutritionFood))
      });

      setNutrition((prev) => {
        const current = prev.myFoods?.[myFoodId] || {};
        const updatedFood = normalizeMyFoodRecord(foodToAdd, numericAmount, current);

        const nextMyFoods = {
          ...(prev.myFoods || {}),
          [myFoodId]: updatedFood
        };

        savePersonalMyFoodsToFirebase(nextMyFoods);

        return {
          ...prev,
          myFoods: nextMyFoods,
          recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId)].slice(0, 20)
        };
      });

      if (!addNutritionFood(foodToAdd, nutritionMeal, numericAmount)) return;

      setRecentNutritionFoods(loadRecentNutritionFoods());
      setNutritionEditNote("");
      returnToNutritionMainAfterAdd();
      return;
    }

    if (editingNutritionItemId) {
      if (!updateNutritionFood(editingNutritionItemId, selectedNutritionFood, amountValidation.amount)) return;
      setEditingNutritionItemId(null);
    } else {
      if (!addNutritionFood(selectedNutritionFood, nutritionMeal, amountValidation.amount)) return;
    }

    setNutritionEditNote("");
    returnToNutritionMainAfterAdd();
  }

  return {
    addNutritionFood,
    updateNutritionFood,
    confirmNutritionFoodFromPicker
  };
}
