export function toPersonalNutritionFood(row) {
  const n = row.nutrition;
  return {
    id: `personal-${row.id}`, name: row.name, brand: row.brand, aliases: row.aliases,
    barcode: row.barcodes[0] || "", category: row.category,
    calories: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs,
    portion: n.basis === "unknown" ? "Уточните единицу КБЖУ" : "100 г",
    portionAmount: n.basis === "unknown" ? 0 : 100,
    nutritionBasisPending: n.basis === "unknown",
    sourceType: row.sourceType === "gemini" ? "gemini_catalog" : "openfoodfacts_catalog",
    source: row.sourceType === "gemini" ? "Список Gemini" : "Open Food Facts",
    requiresReview: true,
    note: row.nutritionConflict ? "У источников различаются КБЖУ. Показаны значения основной записи." : "",
    sources: row.sourceUrl ? [{title:"Open Food Facts",url:row.sourceUrl}] : [],
  };
}

export function confirmPersonalNutritionBasis(food, amount, unit = "g") {
  const base = Number(String(amount).replace(",", "."));
  if (!Number.isFinite(base) || base <= 0 || !["g", "ml"].includes(unit)) return null;
  return {
    ...food,
    ...Object.fromEntries(["calories", "protein", "fat", "carbs"].map(key => [key, Number(food[key]) * 100 / base])),
    portion: unit === "ml" ? "100 мл" : "100 г", portionAmount: 100,
    nutritionBasisPending: false,
    note: `${food.note || ""} КБЖУ в исходном списке: на ${base} ${unit === "ml" ? "мл" : "г"}, указано пользователем.`.trim(),
  };
}
