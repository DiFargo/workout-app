export function toPersonalNutritionFood(row) {
  const n = row.nutrition;
  const isManufacturer = row.sourceType === "manufacturer";
  const isReference = row.sourceType === "reference";
  const source = isReference ? "USDA FoodData Central" : isManufacturer ? "Производитель" : row.sourceType === "gemini" ? "Список Gemini" : "Open Food Facts";
  return {
    id: `personal-${row.id}`, name: row.name, brand: row.brand, aliases: row.aliases,
    barcode: row.barcodes[0] || "", category: row.category,
    calories: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs,
    portion: n.basis === "unknown" ? "Уточните единицу КБЖУ" : n.basis === "100ml" ? "100 мл" : "100 г",
    portionAmount: n.basis === "unknown" ? 0 : 100,
    nutritionBasisPending: n.basis === "unknown",
    sourceType: isReference ? "basic_reference" : isManufacturer ? "manufacturer_catalog" : row.sourceType === "gemini" ? "gemini_catalog" : "openfoodfacts_catalog",
    searchFallback: row.searchFallback === true,
    source,
    requiresReview: true,
    note: isReference ? "Базовый продукт без бренда. Справочные КБЖУ; для упакованного продукта точнее данные с его этикетки." : row.nutritionConflict ? "У источников различаются КБЖУ. Показаны значения основной записи." : "",
    sources: row.sourceUrl ? [{title:isManufacturer ? row.sourceTitle || source : source,url:row.sourceUrl}] : [],
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
