import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel.js";

function normalizeVoiceLookupText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExactPersonalVoiceFoodMatch(food, query) {
  const normalizedQuery = normalizeVoiceLookupText(query);
  if (!normalizedQuery) return false;

  const name = String(food?.name || "").trim();
  const brand = String(food?.brand || "").trim();
  const searchableNames = [
    name,
    brand && name ? `${brand} ${name}` : "",
    ...(Array.isArray(food?.aliases) ? food.aliases : [])
  ];

  return searchableNames
    .map(normalizeVoiceLookupText)
    .filter(Boolean)
    .includes(normalizedQuery);
}

function isSavedAiVoiceEstimate(food) {
  return [food?.id, food?.foodId]
    .map((value) => String(value || ""))
    .some((id) => id.startsWith("my_ai_voice_"));
}

export function findPersonalVoiceFoodCandidates(myFoods = {}, query) {
  return Object.values(myFoods || {})
    .filter((food) => food && !isSavedAiVoiceEstimate(food))
    .filter((food) => isExactPersonalVoiceFoodMatch(food, query))
    .map((food) => ({
      ...normalizeNutritionFood(food),
      aliases: Array.isArray(food.aliases) ? food.aliases : [],
      category: food.category || "",
      defaultGram: Number(food.defaultGram || food.defaultAmount || food.portionAmount) || 100,
      sourceType: "personal_catalog"
    }));
}

export function findExactPersonalVoiceFood(myFoods = {}, query) {
  const matchedFoods = findPersonalVoiceFoodCandidates(myFoods, query);
  return matchedFoods.length === 1 ? matchedFoods[0] : null;
}
