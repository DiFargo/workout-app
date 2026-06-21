import {
  getFoodIcon,
  getNutritionFoodSearchText
} from "./nutritionFoodPresentation.js";
import { parseNutritionNumber, roundMacro } from "./nutritionNumbers.js";
import {
  getFoodPortionAmount,
  getFoodScale,
  getPieceProductSizeProfile
} from "./nutritionPortions.js";

export function normalizeNutritionFood(food) {
  const foodId = food.id || food.foodId || food.fatSecretId || `food_${Date.now()}`;
  return {
    id: String(foodId),
    foodId: String(foodId),
    name: food.name || "Продукт",
    portion: food.portion || "100 г",
    calories: parseNutritionNumber(food.calories, 0),
    protein: parseNutritionNumber(food.protein, 0),
    fat: parseNutritionNumber(food.fat, 0),
    carbs: parseNutritionNumber(food.carbs, 0),
    brand: food.brand || "",
    note: food.note || food.description || "",
    description: food.description || food.note || "",
    barcode: food.barcode || "",
    source: food.source || "Локальная база",
    icon: food.icon || getFoodIcon(food),
    portionAmount: parseNutritionNumber(food.portionAmount, 0),
    lastAmount: parseNutritionNumber(food.lastAmount, 0),
    amountMode: food.amountMode || "",
    type: food.type || "",
    ingredients: Array.isArray(food.ingredients) ? food.ingredients : [],
    totalWeight: parseNutritionNumber(food.totalWeight, 0) || parseNutritionNumber(food.portionAmount, 0) || 0
  };
}

export function buildCustomNutritionFoodDraft({
  id = `custom_${Date.now()}`,
  foodId = `custom_${Date.now()}`
} = {}) {
  return {
    ...normalizeNutritionFood({
      id,
      foodId,
      name: "",
      portion: "100 г",
      portionAmount: 100,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      source: "Моя база",
      amountMode: "grams",
      lastAmount: 100,
      icon: "🍽️"
    }),
    name: ""
  };
}

export function buildCustomNutritionDishDraft({
  id = `dish_${Date.now()}`,
  foodId = `dish_${Date.now()}`
} = {}) {
  return {
    ...normalizeNutritionFood({
      id,
      foodId,
      name: "",
      portion: "100 г",
      portionAmount: 100,
      totalWeight: 100,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      source: "Моя база",
      amountMode: "grams",
      lastAmount: 100,
      icon: "🍲",
      type: "dish",
      ingredients: []
    }),
    name: ""
  };
}

export function getNutritionSmartUnits(food = {}) {
  const normalizedFood = normalizeNutritionFood(food);
  const portionText = String(normalizedFood.portion || "").toLowerCase();
  const portionAmount = getFoodPortionAmount(normalizedFood);
  const pieceProfile = getPieceProductSizeProfile(normalizedFood);

  const units = [
    {
      id: "grams",
      label: "Граммы",
      shortLabel: "Граммы",
      hint: "вручную",
      amount: 100,
      mode: "grams"
    }
  ];

  if (pieceProfile?.sizes?.length) {
    pieceProfile.sizes.forEach((size) => {
      units.push({
        id: `${pieceProfile.type}-${size.id}`,
        label: `${size.label} ${size.hint}`,
        shortLabel: `${size.label} ${size.hint}`,
        hint: size.hint,
        amount: size.amount,
        mode: "portion",
        portion: size.portion,
        portionAmount: size.amount,
        default: size.id === pieceProfile.defaultId
      });
    });
  } else if (normalizedFood.type === "dish") {
    const dishBase = Number(normalizedFood.totalWeight) || Number(normalizedFood.portionAmount) || portionAmount || 100;
    units.push({
      id: "dish-portion",
      label: `Порция ≈${Math.round(dishBase)} г`,
      shortLabel: `Порция ≈${Math.round(dishBase)} г`,
      hint: `≈${Math.round(dishBase)} г`,
      amount: dishBase,
      mode: "portion",
      portion: "1 порция блюда",
      portionAmount: dishBase,
      default: true
    });
  } else if (portionText && !portionText.includes("100 г")) {
    units.push({
      id: "portion",
      label: `${normalizedFood.portion || "Порция"} ≈${Math.round(portionAmount)} г`,
      shortLabel: `${normalizedFood.portion || "Порция"}`,
      hint: `≈${Math.round(portionAmount)} г`,
      amount: portionAmount,
      mode: "portion",
      portion: normalizedFood.portion || "1 порция",
      portionAmount,
      default: true
    });
  } else {
    units.push({
      id: "portion",
      label: `Порция ≈${Math.round(portionAmount || 100)} г`,
      shortLabel: `Порция`,
      hint: `≈${Math.round(portionAmount || 100)} г`,
      amount: portionAmount || 100,
      mode: "portion",
      portion: normalizedFood.portion || "1 порция",
      portionAmount: portionAmount || 100
    });
  }

  return units;
}

export function getDefaultNutritionSmartUnit(food = {}) {
  const units = getNutritionSmartUnits(food);
  return units.find((unit) => unit.default) || units[0];
}

export function getNutritionSmartUnitId(food = {}, amount = 100, mode = "grams") {
  const units = getNutritionSmartUnits(food);
  const numericAmount = parseNutritionNumber(amount, 0);

  const matched = units.find((unit) => (
    unit.mode === mode &&
    Math.abs((Number(unit.amount) || 0) - numericAmount) < 0.01
  ));

  if (matched) return matched.id;
  return mode === "portion" ? "custom-portion" : "grams";
}

export function detectNutritionAmountMode(food, amount, savedMode = "") {
  if (savedMode === "portion" || savedMode === "grams") return savedMode;

  const currentAmount = Number(String(amount).replace(",", "."));
  const portionAmount = getFoodPortionAmount(food);

  if (
    Number.isFinite(currentAmount) &&
    Number.isFinite(portionAmount) &&
    portionAmount > 0 &&
    Math.abs(currentAmount - portionAmount) < 0.001
  ) {
    const portionText = String(food?.portion || "").trim().toLowerCase();
    if (portionText && !portionText.startsWith("100 г")) return "portion";
  }

  return "grams";
}

export function isPortionModeSelected(food, amount, mode = "") {
  return mode === "portion";
}

export function getNutritionBaseMacroFood(food, amount = 100, mode = "grams") {
  const normalizedFood = normalizeNutritionFood(food);
  const safeAmount = parseNutritionNumber(amount, 100) || 100;
  const savedMode = mode || normalizedFood.amountMode || "grams";
  const savedScale = getFoodScale(safeAmount, normalizedFood, savedMode) || 1;
  const safeScale = savedScale > 0 ? savedScale : 1;

  return {
    ...normalizedFood,
    calories: roundMacro((Number(food?.calories) || 0) / safeScale),
    protein: roundMacro((Number(food?.protein) || 0) / safeScale),
    fat: roundMacro((Number(food?.fat) || 0) / safeScale),
    carbs: roundMacro((Number(food?.carbs) || 0) / safeScale),
    amountMode: savedMode,
    lastAmount: safeAmount,
    portionAmount: Number(food?.portionAmount) || normalizedFood.portionAmount || getFoodPortionAmount(normalizedFood),
    totalWeight: Number(food?.totalWeight) || normalizedFood.totalWeight || Number(food?.portionAmount) || 0,
    type: food?.type || normalizedFood.type || "",
    ingredients: Array.isArray(food?.ingredients) ? food.ingredients : normalizedFood.ingredients
  };
}

export function enrichNutritionFoodIcon(food) {
  const normalizedFood = normalizeNutritionFood(food);
  return {
    ...normalizedFood,
    icon: food?.icon || normalizedFood.icon || getFoodIcon(normalizedFood)
  };
}

export function makePersonalFoodKey(food) {
  const raw = String(food?.name || food?.id || "food")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .slice(0, 80);

  return `my_${raw || Date.now()}`;
}

export function normalizeMyFoodRecord(food, amount = 100, previous = null) {
  const sourceFood = normalizeNutritionFood(food);
  const numericAmount = parseNutritionNumber(amount, 100) || 100;
  const key = previous?.id || sourceFood.foodId || sourceFood.id || makePersonalFoodKey(sourceFood);

  return {
    id: String(key).startsWith("my_") ? String(key) : makePersonalFoodKey(sourceFood),
    foodId: String(key).startsWith("my_") ? String(key) : makePersonalFoodKey(sourceFood),
    name: sourceFood.name,
    portion: sourceFood.portion || "100 г",
    calories: Number(sourceFood.calories) || 0,
    protein: Number(sourceFood.protein) || 0,
    fat: Number(sourceFood.fat) || 0,
    carbs: Number(sourceFood.carbs) || 0,
    brand: food.brand ?? previous?.brand ?? "",
    note: food.note ?? food.description ?? previous?.note ?? previous?.description ?? "",
    description: food.description ?? food.note ?? previous?.description ?? previous?.note ?? "",
    barcode: sourceFood.barcode || "",
    source: "Моя база",
    icon: sourceFood.icon || getFoodIcon(sourceFood),
    lastAmount: numericAmount,
    portionAmount: Number(sourceFood.portionAmount) || Number(previous?.portionAmount) || numericAmount,
    amountMode: sourceFood.amountMode || previous?.amountMode || "grams",
    type: sourceFood.type || previous?.type || "",
    ingredients: Array.isArray(sourceFood.ingredients) ? sourceFood.ingredients : (previous?.ingredients || []),
    totalWeight: Number(sourceFood.totalWeight) || Number(sourceFood.portionAmount) || Number(previous?.totalWeight) || numericAmount,
    useCount: (Number(previous?.useCount) || 0) + 1,
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function getMyFoodsArray(nutritionState) {
  return Object.values(nutritionState?.myFoods || {})
    .map(normalizeNutritionFood)
    .sort((a, b) => {
      const aRaw = nutritionState?.myFoods?.[a.id] || {};
      const bRaw = nutritionState?.myFoods?.[b.id] || {};
      return (Number(bRaw.useCount) || 0) - (Number(aRaw.useCount) || 0);
    });
}

export function searchMyFoods(nutritionState, query) {
  const cleanQuery = String(query || "").trim().toLowerCase();
  if (cleanQuery.length < 1) return [];

  return Object.values(nutritionState?.myFoods || {})
    .map(normalizeNutritionFood)
    .filter((food) => getNutritionFoodSearchText(food).includes(cleanQuery))
    .sort((a, b) => {
      const aRaw = nutritionState?.myFoods?.[a.id] || {};
      const bRaw = nutritionState?.myFoods?.[b.id] || {};
      return (Number(bRaw.useCount) || 0) - (Number(aRaw.useCount) || 0);
    });
}
