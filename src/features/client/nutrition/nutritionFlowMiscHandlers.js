import { findLazyNutritionCatalogByBarcode } from "../../../data/nutrition-catalog/lazyCatalog.js";

export function createNutritionProductFromPhotoWithDeps({
  aiFood = {},
  fallbackName = "",
  getFoodIcon,
  getPositiveNutritionNumber,
  normalizeNutritionFood,
  setEditingNutritionItemId,
  setFatSecretError,
  setNutritionAmount,
  setNutritionAmountMode,
  setNutritionCreateChoiceOpen,
  setNutritionEditDetailsOpen,
  setNutritionEditNote,
  setNutritionEditPageOpen,
  setNutritionFallbackSuggestions,
  setNutritionMealMenuOpen,
  setNutritionPhotoAiCandidates,
  setNutritionPhotoAiConfidence,
  setNutritionPhotoAiResult,
  setNutritionSearch,
  setSelectedNutritionFood
}) {
  const candidate = aiFood.candidates?.[0] || {};
  const rawAiResponse = aiFood.rawAiResponse || {};
  const evidenceType = aiFood.evidenceType === "label" ? "label" : "estimate";
  const sourceLabel = evidenceType === "label" ? "Данные с этикетки" : "Примерная оценка ИИ";
  const brand = String(aiFood.brand || candidate.brand || rawAiResponse.brand || "").trim();
  const productName = String(aiFood.name || candidate.name || fallbackName || "Новый продукт").trim();
  const cleanName = brand && !productName.toLowerCase().includes(brand.toLowerCase())
    ? `${brand} ${productName}`
    : productName;
  const calories = getPositiveNutritionNumber(aiFood.calories, candidate.calories);
  const protein = getPositiveNutritionNumber(aiFood.protein, candidate.protein);
  const fat = getPositiveNutritionNumber(aiFood.fat, candidate.fat);
  const carbs = getPositiveNutritionNumber(aiFood.carbs, candidate.carbs);
  const estimatedGrams = getPositiveNutritionNumber(aiFood.estimatedGrams, candidate.estimatedGrams, 100);
  const labelText = String(
    aiFood.labelText || aiFood.fullText || aiFood.ocrText ||
    rawAiResponse.labelText || rawAiResponse.fullText || rawAiResponse.ocrText || ""
  ).trim();
  const ingredients = aiFood.ingredients || aiFood.detectedIngredients ||
    candidate.ingredients || candidate.detectedIngredients ||
    rawAiResponse.ingredients || rawAiResponse.detectedIngredients || [];
  const ingredientsText = Array.isArray(ingredients) ? ingredients.filter(Boolean).join(", ") : String(ingredients || "").trim();
  const netWeight = String(aiFood.netWeight || aiFood.servingSize || rawAiResponse.netWeight || rawAiResponse.servingSize || "").trim();
  const aiDescription = [
    `Источник: ${sourceLabel}.`,
    evidenceType === "estimate" ? "Проверьте КБЖУ и порцию перед добавлением в дневник." : "Проверьте данные с этикетки перед добавлением в дневник.",
    brand ? `Бренд: ${brand}` : "",
    labelText ? `Текст с этикетки: ${labelText}` : "",
    ingredientsText ? `Состав: ${ingredientsText}` : "",
    netWeight ? `Масса нетто: ${netWeight}` : "",
    `Пищевая ценность на 100 г: ${calories} ккал; белки ${protein} г; жиры ${fat} г; углеводы ${carbs} г.`,
    aiFood.query ? `Данные AI: ${aiFood.query}` : "",
    aiFood.confidence ? `Уверенность AI: ${aiFood.confidence}` : "",
    estimatedGrams ? `Оценочный вес порции: ${estimatedGrams} г.` : ""
  ].filter(Boolean).join("\n");

  const draftFood = normalizeNutritionFood({
    id: `photo_${Date.now()}`,
    foodId: `photo_${Date.now()}`,
    name: cleanName || "Новый продукт",
    brand,
    note: aiDescription,
    description: aiDescription,
    portion: "100 г",
    portionAmount: 100,
    calories,
    protein,
    fat,
    carbs,
    source: sourceLabel,
    sourceType: evidenceType === "label" ? "ai_photo_label" : "ai_estimate",
    evidenceType,
    requiresReview: evidenceType !== "label",
    amountMode: "grams",
    lastAmount: estimatedGrams,
    icon: getFoodIcon({ name: cleanName }) || "🍽️"
  });

  setFatSecretError("");
  setNutritionFallbackSuggestions([]);
  setNutritionPhotoAiCandidates([]);
  setNutritionPhotoAiConfidence("");
  setNutritionPhotoAiResult(
    evidenceType === "label"
      ? `Найдены данные с этикетки: ${draftFood.name}. Проверьте КБЖУ перед добавлением.`
      : `ИИ дал примерную оценку: ${draftFood.name}. Проверьте КБЖУ и порцию перед добавлением.`
  );
  setNutritionSearch(draftFood.name);
  setEditingNutritionItemId(null);
  setNutritionMealMenuOpen(false);
  setNutritionCreateChoiceOpen(false);
  setSelectedNutritionFood(draftFood);
  setNutritionAmount(String(estimatedGrams));
  setNutritionAmountMode("grams");
  setNutritionEditNote(aiDescription);
  setNutritionEditDetailsOpen(true);
  setNutritionEditPageOpen(true);
}

export function returnToNutritionMainAfterAddWithDeps({
  APP_PAGES,
  resetNutritionPhotoAiState,
  setBarcodeScannerOpen,
  setEditingNutritionItemId,
  setExpandedNutritionMeals,
  setNutritionCreateChoiceOpen,
  setNutritionEditDetailsOpen,
  setNutritionEditOriginalFood,
  setNutritionEditOriginalNote,
  setNutritionEditPageOpen,
  setNutritionMealMenuOpen,
  setNutritionPickerOpen,
  setNutritionSearch,
  setNutritionSearchTab,
  setPage,
  setSelectedNutritionFood,
  setShowRecentNutritionFoods
}) {
  setNutritionMealMenuOpen(false);
  setSelectedNutritionFood(null);
  setNutritionEditDetailsOpen(false);
  setNutritionEditPageOpen(false);
  setNutritionEditOriginalFood(null);
  setNutritionEditOriginalNote("");
  setEditingNutritionItemId(null);
  setNutritionCreateChoiceOpen(false);
  setNutritionSearch("");
  setNutritionSearchTab("food");
  setShowRecentNutritionFoods(false);
  setBarcodeScannerOpen(false);
  resetNutritionPhotoAiState();
  setNutritionPickerOpen(false);
  setExpandedNutritionMeals({});
  setPage(APP_PAGES.NUTRITION);
}

export async function addFoodByBarcodeFromPickerWithDeps({
  nutritionBarcode,
  nutritionFoodDatabase,
  addNutritionFoodFromPicker,
  findCatalogFoodByBarcode = findLazyNutritionCatalogByBarcode,
  setBarcodeScannerError,
  setBarcodeScannerOpen,
  setNutritionBarcode
}) {
  const code = nutritionBarcode.trim();
  if (!code) return;

  let food = null;
  try {
    food = await findCatalogFoodByBarcode(code);
  } catch (error) {
    console.warn("Nutrition catalog barcode lookup failed:", error);
  }
  if (!food) food = nutritionFoodDatabase.find((item) => item.barcode === code);
  if (food) {
    setBarcodeScannerError("");
    setBarcodeScannerOpen(false);
    addNutritionFoodFromPicker(food);
    setNutritionBarcode("");
    return;
  }

  setBarcodeScannerError("Штрихкод пока не найден. Проверь цифры или найди продукт по названию.");
}

export function createNutritionFlowMiscHandlers(deps) {
  return {
    openNutritionCreateProductFromPhoto: (aiFood = {}, fallbackName = "") => createNutritionProductFromPhotoWithDeps({
      ...deps,
      aiFood,
      fallbackName
    }),
    returnToNutritionMainAfterAdd: () => returnToNutritionMainAfterAddWithDeps(deps),
    addFoodByBarcodeFromPicker: () => addFoodByBarcodeFromPickerWithDeps(deps)
  };
}
