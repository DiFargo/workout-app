// Local nutrition catalog search helpers. Runtime records remain compact; the
// provenance document stays separate from search data.

import { expandRussianNutritionQuery } from "./russianSearchLexicon.js";

const compactFoodLookupCache = new WeakMap();

export function normalizeNutritionQuery(input = "") {
  return String(input || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s%.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numericValue(food, scaledField, legacyField, scale = 1) {
  const scaled = Number(food?.[scaledField]);
  if (Number.isFinite(scaled)) return scaled / scale;

  const legacy = Number(food?.[legacyField]);
  return Number.isFinite(legacy) ? legacy : 0;
}

export function expandNutritionCatalogFood(food = {}) {
  return {
    id: food.id,
    name: food.n || food.name || "",
    aliases: food.a || food.aliases || [],
    brand: food.b || food.brand || "",
    barcode: food.bc || food.barcode || "",
    recordType: food.rt || food.recordType || "sku",
    category: food.c || food.category || "",
    basisUnit: food.u || food.basisUnit || "g",
    calories: numericValue(food, "k1000", "k", 1000),
    protein: Number.isFinite(Number(food.p1000))
      ? Number(food.p1000) / 1000
      : numericValue(food, "p10", "protein", 10),
    fat: Number.isFinite(Number(food.f1000))
      ? Number(food.f1000) / 1000
      : numericValue(food, "f10", "fat", 10),
    carbs: Number.isFinite(Number(food.h1000))
      ? Number(food.h1000) / 1000
      : numericValue(food, "h10", "carbs", 10),
    defaultGram: Number(food.dg || food.defaultGram || 100) || 100,
    emoji: food.e || food.emoji || "🍽️",
    portionTypes: (food.pt || food.portionTypes || []).map(([id, label, amount]) => ({
      id,
      label,
      grams: food.u === "ml" ? undefined : amount,
      ml: food.u === "ml" ? amount : undefined
    })),
    local: true
  };
}

function asIdArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function addScore(scores, ids, value) {
  asIdArray(ids).forEach((id) => {
    if (typeof id === "string" && id) {
      scores.set(id, (scores.get(id) || 0) + value);
    }
  });
}

function getCompactFoodLookup(compactFoods) {
  if (!Array.isArray(compactFoods)) {
    return { byId: new Map(), searchTextById: new Map(), categoryTokenIndex: new Map() };
  }

  const cached = compactFoodLookupCache.get(compactFoods);
  if (cached) return cached;

  const byId = new Map();
  const searchTextById = new Map();
  const categoryTokenIndex = new Map();
  compactFoods.forEach((food) => {
    if (!food?.id) return;
    byId.set(food.id, food);
    searchTextById.set(
      food.id,
      normalizeNutritionQuery(food.x || [food.n, food.b, ...(food.a || [])].join(" "))
    );
    normalizeNutritionQuery(food.c || food.category)
      .split(/[\s-]+/u)
      .filter((token) => token.length >= 3)
      .forEach((token) => {
        const ids = categoryTokenIndex.get(token) || [];
        if (!ids.includes(food.id)) ids.push(food.id);
        categoryTokenIndex.set(token, ids);
      });
  });

  const lookup = { byId, searchTextById, categoryTokenIndex };
  compactFoodLookupCache.set(compactFoods, lookup);
  return lookup;
}

function getPrefixMatches(token, prefixIndex) {
  if (token.length < 2) return [];
  return prefixIndex[token.slice(0, Math.min(7, token.length))] || [];
}

function collectSearchScores(q, lookup, prefixIndex, exactIndex, tokenIndex) {
  const { searchTextById, categoryTokenIndex } = lookup;
  const scores = new Map();

  addScore(scores, exactIndex[q], 10_000);

  q.split(" ").filter(Boolean).forEach((token) => {
    addScore(scores, tokenIndex[token], 800);
    addScore(scores, getPrefixMatches(token, prefixIndex), 120);
    addScore(scores, categoryTokenIndex.get(token), 70);
  });

  // Only inspect index candidates. A full catalog scan becomes noticeably slow
  // once the source-backed catalog contains thousands of records.
  scores.forEach((score, id) => {
    const searchText = searchTextById.get(id);
    if (!searchText) return;
    if (searchText === q) scores.set(id, score + 1_500);
    else if (searchText.startsWith(q)) scores.set(id, score + 700);
    else if (searchText.includes(q)) scores.set(id, score + 250);
  });

  return scores;
}

function rankSearchScores(scores, lookup, limit) {
  const { byId } = lookup;

  const resultLimit = Math.max(1, Number.parseInt(limit, 10) || 20);
  return [...scores.entries()]
    .filter(([id]) => byId.has(id))
    .sort((left, right) => (
      right[1] - left[1]
      || String(byId.get(left[0])?.n || left[0]).localeCompare(String(byId.get(right[0])?.n || right[0]), "ru")
      || left[0].localeCompare(right[0])
    ))
    .slice(0, resultLimit)
    .map(([id]) => expandNutritionCatalogFood(byId.get(id)));
}

export function searchLocalNutritionCatalog(
  query,
  compactFoods,
  prefixIndex = {},
  exactIndex = {},
  limit = 20,
  tokenIndex = {}
) {
  const q = normalizeNutritionQuery(query);
  if (!q || q.length < 2 || !Array.isArray(compactFoods)) return [];

  const lookup = getCompactFoodLookup(compactFoods);
  return rankSearchScores(collectSearchScores(q, lookup, prefixIndex, exactIndex, tokenIndex), lookup, limit);
}

export function searchLocalizedNutritionCatalog(
  query,
  compactFoods,
  prefixIndex = {},
  exactIndex = {},
  limit = 20,
  tokenIndex = {}
) {
  const q = normalizeNutritionQuery(query);
  if (!q || q.length < 2 || !Array.isArray(compactFoods)) return [];

  const lookup = getCompactFoodLookup(compactFoods);
  const scores = collectSearchScores(q, lookup, prefixIndex, exactIndex, tokenIndex);
  const translatedQuery = expandRussianNutritionQuery(q).join(" ");

  if (translatedQuery) {
    collectSearchScores(translatedQuery, lookup, prefixIndex, exactIndex, tokenIndex)
      .forEach((score, id) => {
        const localizedScore = Math.max(1, Math.round(score * 0.45));
        scores.set(id, (scores.get(id) || 0) + localizedScore);
      });
  }

  return rankSearchScores(scores, lookup, limit);
}

export function mapAiFoodToLocalCatalog(aiFood, compactFoods, prefixIndex, exactIndex = {}, tokenIndex = {}) {
  const query = [
    aiFood?.name,
    aiFood?.brand,
    aiFood?.detectedName,
    ...(aiFood?.aliases || []),
    ...(aiFood?.detectedIngredients || [])
  ].filter(Boolean).join(" ");

  return searchLocalizedNutritionCatalog(query, compactFoods, prefixIndex, exactIndex, 8, tokenIndex);
}

export function macrosForAmount(food, amount = 100) {
  const value = Number(amount) || 100;
  const factor = value / 100;
  return {
    calories: Math.round((Number(food.calories) || 0) * factor),
    protein: Math.round((Number(food.protein) || 0) * factor * 10) / 10,
    fat: Math.round((Number(food.fat) || 0) * factor * 10) / 10,
    carbs: Math.round((Number(food.carbs) || 0) * factor * 10) / 10
  };
}
