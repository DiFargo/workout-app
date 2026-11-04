export function unpackPersonalCatalogRow([id, name, brand, category, kcal, protein, fat, carbs, basis, aliases, barcodes, market, sourceType, nutritionConflict, sourceUrl, sourceTitle, state]) {
  return {id, name, brand, category, nutrition: {kcal, protein, fat, carbs, basis}, aliases, barcodes, market, sourceType, nutritionConflict, sourceUrl, sourceTitle, state};
}
