import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMacro(value) {
  return Math.round(Math.max(0, toNumber(value)) * 10) / 10;
}

function roundCalories(value) {
  return Math.round(Math.max(0, toNumber(value)));
}

export function getNutritionVoiceItemEditDraft(item = {}) {
  const amount = Math.max(1, toNumber(item.amount, 100));
  const scale = amount / 100;
  const food = item.food || {};

  return {
    name: String(food.name || item.name || "").trim(),
    amount,
    calories: roundMacro(food.calories ?? (toNumber(item.calories) / scale)),
    protein: roundMacro(food.protein ?? (toNumber(item.protein) / scale)),
    fat: roundMacro(food.fat ?? (toNumber(item.fat) / scale)),
    carbs: roundMacro(food.carbs ?? (toNumber(item.carbs) / scale)),
    saveToMyFoods: item.saveToMyFoods === true
  };
}

export function buildUpdatedNutritionVoiceItem(item = {}, draft = {}) {
  const nextDraft = getNutritionVoiceItemEditDraft({ ...item, food: { ...item.food, ...draft } });
  const name = String(draft.name ?? nextDraft.name).trim();
  const amount = toNumber(draft.amount, nextDraft.amount);

  if (!name || amount <= 0 || amount > 2000) return null;

  const sourceFood = normalizeNutritionFood({
    ...(item.food || {}),
    id: item.foodId || item.food?.id || item.id,
    foodId: item.foodId || item.food?.foodId || item.food?.id || item.id,
    name,
    portion: item.portion || item.food?.portion || "100 г",
    portionAmount: 100,
    amountMode: "grams",
    calories: roundMacro(draft.calories),
    protein: roundMacro(draft.protein),
    fat: roundMacro(draft.fat),
    carbs: roundMacro(draft.carbs),
    source: item.source || item.food?.source || "Оценка ИИ",
    requiresReview: item.requiresReview === true || item.food?.requiresReview === true
  });
  const scale = amount / 100;

  return {
    ...item,
    food: sourceFood,
    foodId: sourceFood.id,
    name: sourceFood.name,
    amount,
    amountMode: "grams",
    portion: sourceFood.portion,
    portionAmount: 100,
    calories: roundCalories(sourceFood.calories * scale),
    protein: roundMacro(sourceFood.protein * scale),
    fat: roundMacro(sourceFood.fat * scale),
    carbs: roundMacro(sourceFood.carbs * scale)
  };
}
