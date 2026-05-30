// Local Belarus/CIS nutrition catalog helpers

export function normalizeNutritionQuery(input = "") {
  return String(input || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s%.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandCompactFood(food) {
  return {
    id: food.id,
    name: food.n,
    aliases: food.a || [],
    brand: food.b || "",
    category: food.c || "",
    basisUnit: food.u || "g",
    calories: food.k || 0,
    protein: (food.p10 || 0) / 10,
    fat: (food.f10 || 0) / 10,
    carbs: (food.h10 || 0) / 10,
    defaultGram: food.dg || 100,
    emoji: food.e || "🍽️",
    portionTypes: (food.pt || []).map(([id, label, amount]) => ({
      id,
      label,
      grams: food.u === "ml" ? undefined : amount,
      ml: food.u === "ml" ? amount : undefined
    })),
    local: true
  };
}

export function searchLocalNutritionCatalog(query, compactFoods, prefixIndex, exactIndex = {}, limit = 20) {
  const q = normalizeNutritionQuery(query);
  if (!q || q.length < 2) return [];

  const byId = new Map(compactFoods.map((food) => [food.id, food]));
  const exactId = exactIndex[q];
  const scores = new Map();

  if (exactId) scores.set(exactId, 10000);

  const tokens = q.split(" ").filter(Boolean);
  tokens.forEach((token) => {
    const key = token.slice(0, Math.min(7, token.length));
    const ids = prefixIndex[key] || prefixIndex[token.slice(0, 6)] || prefixIndex[token.slice(0, 5)] || [];
    ids.forEach((id, index) => {
      scores.set(id, (scores.get(id) || 0) + Math.max(1, 120 - index));
    });
  });

  // lightweight contains boost
  compactFoods.forEach((food) => {
    const hay = normalizeNutritionQuery([food.n, food.b, ...(food.a || [])].join(" "));
    if (hay.includes(q)) scores.set(food.id, (scores.get(food.id) || 0) + 250);
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => byId.get(id))
    .filter(Boolean)
    .map(expandCompactFood);
}

export function mapAiFoodToLocalCatalog(aiFood, compactFoods, prefixIndex, exactIndex = {}) {
  const query = [
    aiFood?.name,
    aiFood?.brand,
    aiFood?.detectedName,
    ...(aiFood?.aliases || []),
    ...(aiFood?.detectedIngredients || [])
  ].filter(Boolean).join(" ");

  return searchLocalNutritionCatalog(query, compactFoods, prefixIndex, exactIndex, 8);
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
