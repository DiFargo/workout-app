import {
  makePersonalFoodKey,
  normalizeMyFoodRecord,
  normalizeNutritionFood
} from "../../../utils/nutritionFoodModel";
import { getFoodIcon } from "../../../utils/nutritionFoodPresentation";
import { parseNutritionNumber, roundMacro } from "../../../utils/nutritionNumbers";
import { getFoodPortionAmount, getFoodScale } from "../../../utils/nutritionPortions";
import {
  loadRecentNutritionFoods,
  saveRecentNutritionFood
} from "../../../utils/nutritionPreferenceStorage";
import { validateNutritionAmount } from "../../../utils/clientUx";

function createNutritionEntryId(foodId) {
  const uniquePart = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${foodId}_${uniquePart}`;
}

function isAiNutritionEstimate(food = {}) {
  const source = String(food.source || "").trim();
  const sourceType = String(food.sourceType || "").trim().toLowerCase();
  const evidenceType = String(food.evidenceType || "").trim().toLowerCase();

  return food.requiresReview === true ||
    sourceType === "ai_estimate" ||
    evidenceType === "estimate" ||
    /(?:оценка\s*ии|ai\s*(?:фото|voice|estimate)|openai)/i.test(source);
}

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
  function getPersonalFoodId(food) {
    const explicitId = String(food?.foodId || food?.id || "");
    return explicitId.startsWith("my_") ? explicitId : makePersonalFoodKey(food);
  }

  function saveNutritionFoodToMyDatabase(food, amount = 100, options = {}) {
    const amountValidation = validateNutritionAmount(amount);
    if (!amountValidation.valid) {
      setNutritionAmountError(amountValidation.error);
      return false;
    }

    const sourceFood = normalizeNutritionFood(food);
    const amountMode = options.amountMode === "portion" ? "portion" : "grams";
    const note = typeof options.note === "string" ? options.note.trim() : "";
    const numericAmount = amountValidation.amount;
    const myFoodId = getPersonalFoodId(sourceFood);

    setNutrition((prev) => {
      const existing = prev.myFoods?.[myFoodId];
      const personalFood = normalizeMyFoodRecord(
        {
          ...sourceFood,
          id: myFoodId,
          foodId: myFoodId,
          note,
          description: note,
          amountMode,
          portionAmount: amountMode === "portion"
            ? numericAmount
            : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood))
        },
        numericAmount,
        existing
      );
      const nextMyFoods = {
        ...(prev.myFoods || {}),
        [myFoodId]: personalFood
      };

      savePersonalMyFoodsToFirebase(nextMyFoods, {
        id: myFoodId,
        food: personalFood
      });

      return {
        ...prev,
        myFoods: nextMyFoods,
        recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId && id !== sourceFood.id)].slice(0, 20)
      };
    });

    setNutritionAmountError("");
    return true;
  }

  function addNutritionFood(food, mealId = nutritionMeal, amount = nutritionAmount, options = {}) {
    const amountValidation = validateNutritionAmount(amount);
    if (!amountValidation.valid) {
      setNutritionAmountError(amountValidation.error);
      return false;
    }

    const amountMode = options.amountMode === "grams" || options.amountMode === "portion"
      ? options.amountMode
      : nutritionAmountMode;
    const note = typeof options.note === "string" ? options.note.trim() : nutritionEditNote.trim();
    const shouldExpandMeal = options.expandMeal !== false;
    const sourceFood = normalizeNutritionFood(food);
    const shouldSaveToMyFoods = typeof options.saveToMyFoods === "boolean"
      ? options.saveToMyFoods
      : !isAiNutritionEstimate(sourceFood);
    const numericAmount = amountValidation.amount;
    const scale = getFoodScale(numericAmount, sourceFood, amountMode);
    const item = {
      id: createNutritionEntryId(sourceFood.id),
      foodId: sourceFood.id,
      fatSecretId: food.fatSecretId || "",
      name: sourceFood.name,
      mealId,
      amount: numericAmount,
      amountMode,
      portion: sourceFood.portion,
      portionAmount: amountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood)),
      calories: Math.round(sourceFood.calories * scale),
      protein: roundMacro(sourceFood.protein * scale),
      fat: roundMacro(sourceFood.fat * scale),
      carbs: roundMacro(sourceFood.carbs * scale),
      source: sourceFood.source,
      icon: sourceFood.icon || getFoodIcon(sourceFood),
      type: sourceFood.type || "",
      totalWeight: parseNutritionNumber(sourceFood.totalWeight, 0) || parseNutritionNumber(sourceFood.portionAmount, 0) || 0,
      ingredients: Array.isArray(sourceFood.ingredients) ? sourceFood.ingredients : [],
      note,
      addedAt: new Date().toISOString()
    };

    addNutritionFoodToDay(item);
    saveRecentNutritionFood(sourceFood);

    setNutrition((prev) => {
      if (!shouldSaveToMyFoods) {
        return {
          ...prev,
          recent: [sourceFood.id, ...(prev.recent || []).filter((id) => id !== sourceFood.id)].slice(0, 20)
        };
      }

      const myFoodId = getPersonalFoodId(sourceFood);
      const existing = prev.myFoods?.[myFoodId];
      const personalFood = normalizeMyFoodRecord(
        {
          ...sourceFood,
          id: myFoodId,
          foodId: myFoodId,
          note,
          description: note,
          amountMode,
          portionAmount: amountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood))
        },
        numericAmount,
        existing
      );

      const nextMyFoods = {
        ...(prev.myFoods || {}),
        [myFoodId]: personalFood
      };

      savePersonalMyFoodsToFirebase(nextMyFoods, {
        id: myFoodId,
        food: personalFood
      });

      return {
        ...prev,
        myFoods: nextMyFoods,
        recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId && id !== sourceFood.id)].slice(0, 20)
      };
    });

    if (shouldExpandMeal) {
      setExpandedNutritionMeals((prev) => ({
        ...prev,
        [mealId]: true
      }));
    }
    setNutritionAmountError("");
    if (typeof options.onAdded === "function") options.onAdded(item);
    return true;
  }

  function updateNutritionFood(itemId, food, amount = nutritionAmount) {
    const amountValidation = validateNutritionAmount(amount);
    if (!amountValidation.valid) {
      setNutritionAmountError(amountValidation.error);
      return false;
    }

    const sourceFood = normalizeNutritionFood(food);
    const shouldSaveToMyFoods = !isAiNutritionEstimate(sourceFood);
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
      if (!shouldSaveToMyFoods) {
        return prev;
      }

      const myFoodId = getPersonalFoodId(sourceFood);
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

      savePersonalMyFoodsToFirebase(nextMyFoods, {
        id: myFoodId,
        food: personalFood
      });

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
    saveNutritionFoodToMyDatabase,
    updateNutritionFood,
    confirmNutritionFoodFromPicker
  };
}
