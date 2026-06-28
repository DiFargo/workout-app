import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import {
  findExistingPhotoFood,
  isReliablePhotoFood
} from "../../../utils/auditSafety";
import {
  getDefaultNutritionSmartUnit,
  getNutritionSmartUnits,
  normalizeNutritionFood
} from "../../../utils/nutritionFoodModel";
import { getNutritionPhotoAiConfidenceText } from "../../../utils/nutritionPhotoAi";
import {
  loadNutritionPreferredUnit,
  saveRecentNutritionFood
} from "../../../utils/nutritionPreferenceStorage";
import { searchLocalNutritionFoods } from "../../../utils/localNutritionCatalog";

export function createNutritionPhotoAiHandlers({
  fatSecretFoods,
  nutrition,
  nutritionFoodDatabase,
  nutritionPhotoInputRef,
  nutritionPhotoLastFileRef,
  addNutritionFoodFromPicker,
  createCustomNutritionFood,
  endPerformanceCheck,
  openNutritionCreateProductFromPhoto,
  showAppError,
  startPerformanceCheck,
  setEditingNutritionItemId,
  setFatSecretError,
  setNutritionAmount,
  setNutritionAmountMode,
  setNutritionCreateChoiceOpen,
  setNutritionEditDetailsOpen,
  setNutritionEditOriginalFood,
  setNutritionEditOriginalNote,
  setNutritionEditPageOpen,
  setNutritionMealMenuOpen,
  setNutritionPhotoAiCandidates,
  setNutritionPhotoAiConfidence,
  setNutritionPhotoAiResult,
  setNutritionPhotoAnalyzing,
  setNutritionPhotoName,
  setNutritionPhotoNotFoundOpen,
  setNutritionPhotoPreview,
  setNutritionSearch,
  setNutritionSearchTab,
  setSelectedNutritionFood,
  setShowRecentNutritionFoods
}) {
  function resetNutritionPhotoAiSearch() {
    setNutritionPhotoName("");
    setNutritionPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return "";
    });
    setNutritionPhotoAiResult("");
    setNutritionPhotoAiCandidates([]);
    setNutritionPhotoAiConfidence("");
    setNutritionPhotoAnalyzing(false);
    setNutritionPhotoNotFoundOpen(false);
    nutritionPhotoLastFileRef.current = null;
    if (nutritionPhotoInputRef.current) {
      nutritionPhotoInputRef.current.value = "";
    }
  }

  async function findExistingNutritionFoodFromPhoto(product = {}) {
    const query = String(product.query || product.name || "").trim();
    const currentFoods = [
      ...Object.values(nutrition.myFoods || {}),
      ...nutritionFoodDatabase,
      ...fatSecretFoods
    ].map(normalizeNutritionFood);
    let existingFood = findExistingPhotoFood(currentFoods, product);
    if (existingFood || query.length < 2) return existingFood;

    try {
      const localFoods = await searchLocalNutritionFoods(query, 24);
      existingFood = findExistingPhotoFood(localFoods, product);
      if (existingFood) return existingFood;

      const response = await fetchAuthorizedWithTimeout(
        `/api/nutrition/search?q=${encodeURIComponent(query)}`,
        {},
        12000
      );
      if (!response.ok) return null;

      const data = await response.json().catch(() => ({}));
      return findExistingPhotoFood(
        Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [],
        product
      );
    } catch (error) {
      console.warn("[AI PHOTO] existing product lookup failed", error);
      return null;
    }
  }

  function selectNutritionPhotoAiCandidate(food) {
    const normalizedFood = normalizeNutritionFood({
      ...food,
      source: food.source || "ИИ фото"
    });
    const preferredUnitId = loadNutritionPreferredUnit(normalizedFood);
    const defaultUnit =
      getNutritionSmartUnits(normalizedFood).find((unit) => unit.id === preferredUnitId) ||
      getDefaultNutritionSmartUnit(normalizedFood);
    const fallbackAmount = defaultUnit.mode === "portion"
      ? (defaultUnit.portionAmount || normalizedFood.portionAmount || 100)
      : (normalizedFood.lastAmount || normalizedFood.portionAmount || defaultUnit.amount || 100);

    const foodForPicker = {
      ...normalizedFood,
      portion: defaultUnit.mode === "portion" ? (defaultUnit.portion || defaultUnit.label || normalizedFood.portion) : normalizedFood.portion,
      portionAmount: defaultUnit.mode === "portion" ? (defaultUnit.portionAmount || defaultUnit.amount || normalizedFood.portionAmount) : normalizedFood.portionAmount
    };

    setSelectedNutritionFood(foodForPicker);
    setNutritionAmount(String(fallbackAmount));
    setNutritionAmountMode("grams");
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setEditingNutritionItemId(null);
    setNutritionPhotoAiResult(`Выбрано: ${normalizedFood.name}`);
  }

  async function prepareNutritionPhotoForAi(file) {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });

      const maxSide = 1280;
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);

      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  function resetNutritionPhotoAiState() {
    setNutritionPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return "";
    });
    setNutritionPhotoName("");
    setNutritionPhotoAiResult("");
    setNutritionPhotoAiCandidates([]);
    setNutritionPhotoAiConfidence("");
    setNutritionPhotoAnalyzing(false);
    setNutritionPhotoNotFoundOpen(false);
    nutritionPhotoLastFileRef.current = null;

    if (nutritionPhotoInputRef.current) {
      nutritionPhotoInputRef.current.value = "";
    }
  }

  async function runNutritionPhotoAiSearch(file) {
    if (!file) return;

    if (!String(file.type || "").startsWith("image/")) {
      setNutritionPhotoAiResult("Нужна фотография продукта или этикетки в формате изображения.");
      setNutritionPhotoAiCandidates([]);
      setNutritionPhotoAiConfidence("");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setNutritionPhotoAiResult("Фото слишком большое. Сделай снимок ближе или выбери изображение до 25 МБ.");
      setNutritionPhotoAiCandidates([]);
      setNutritionPhotoAiConfidence("");
      return;
    }

    nutritionPhotoLastFileRef.current = file;
    setNutritionPhotoName(file.name || "Фото продукта");
    setNutritionPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return URL.createObjectURL(file);
    });
    setNutritionPhotoAiResult("");
    setNutritionPhotoAiCandidates([]);
    setNutritionPhotoAiConfidence("");
    setNutritionPhotoNotFoundOpen(false);
    setNutritionPhotoAnalyzing(true);
    setFatSecretError("");
    setNutritionSearchTab("food");
    setShowRecentNutritionFoods(false);

    try {
      startPerformanceCheck("AI photo · total", { fileSizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10 });
      startPerformanceCheck("AI photo · prepare image");
      const imageData = await prepareNutritionPhotoForAi(file);
      endPerformanceCheck("AI photo · prepare image", { imageLengthKb: Math.round((imageData.length / 1024) * 10) / 10 });

      startPerformanceCheck("AI photo · function request");
      const response = await fetchAuthorizedWithTimeout("/api/ai-food-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageData,
          mimeType: "image/jpeg",
          fileName: file.name || "food-photo"
        })
      }, 45000);

      const data = await response.json().catch(() => ({}));
      endPerformanceCheck("AI photo · function request", { status: response.status, apiVersion: data.apiVersion || "" });

      if (!response.ok) {
        console.warn("[AI PHOTO] request failed", { status: response.status, apiVersion: data.apiVersion || "", code: data.code || "" });
        setNutritionPhotoAiCandidates([]);
        setNutritionPhotoAiConfidence("");
        setNutritionPhotoAiResult(data.message || "Не удалось распознать продукт на фото. Попробуй другое изображение.");
        return;
      }

      const product = data.product;
      const validProduct = isReliablePhotoFood(product, data);

      if (data.found === false || !validProduct) {
        console.warn("[AI PHOTO] invalid product", { apiVersion: data.apiVersion || "", product });
        setNutritionPhotoAiCandidates([]);
        setNutritionPhotoAiConfidence("");
        setNutritionPhotoAiResult("");
        setNutritionPhotoNotFoundOpen(true);
        return;
      }

      setNutritionPhotoAiConfidence(getNutritionPhotoAiConfidenceText(product.confidence));
      const existingFood = await findExistingNutritionFoodFromPhoto(product);
      if (existingFood) {
        resetNutritionPhotoAiState();
        setNutritionSearch(existingFood.name || product.name);
        setNutritionSearchTab("food");
        setNutritionEditPageOpen(false);
        setNutritionEditDetailsOpen(false);
        setNutritionMealMenuOpen(false);
        setNutritionCreateChoiceOpen(false);
        saveRecentNutritionFood(existingFood);
        addNutritionFoodFromPicker(existingFood);
        return;
      }

      openNutritionCreateProductFromPhoto({ ...product, rawAiResponse: data }, product.name);
    } catch (error) {
      console.error(error);
      showAppError(
        error.name === "AbortError"
          ? "timeout"
          : typeof navigator !== "undefined" && !navigator.onLine
            ? "offline"
            : "api",
        "AI-фото сейчас недоступно. Можно ввести продукт вручную."
      );
      setNutritionPhotoAiCandidates([]);
      setNutritionPhotoAiConfidence("");
      setNutritionPhotoAiResult(
        error.name === "AbortError"
          ? "Анализ фото занял слишком много времени. Попробуй ещё раз."
          : "AI-фото сейчас недоступно. Попробуй ещё раз или создай продукт вручную."
      );
    } finally {
      endPerformanceCheck("AI photo · total");
      setNutritionPhotoAnalyzing(false);
    }
  }

  async function handleNutritionPhotoAiSearch(event) {
    const file = event.target.files?.[0];
    await runNutritionPhotoAiSearch(file);
    if (event.target) {
      event.target.value = "";
    }
  }

  function retryNutritionPhotoAiSearch() {
    if (nutritionPhotoLastFileRef.current) {
      runNutritionPhotoAiSearch(nutritionPhotoLastFileRef.current);
    } else {
      nutritionPhotoInputRef.current?.click();
    }
  }

  function retryNutritionPhotoFromNotFound() {
    setNutritionPhotoNotFoundOpen(false);
    resetNutritionPhotoAiState();
    window.setTimeout(() => nutritionPhotoInputRef.current?.click(), 0);
  }

  function addNutritionProductManuallyFromPhoto() {
    setNutritionPhotoNotFoundOpen(false);
    resetNutritionPhotoAiState();
    createCustomNutritionFood();
  }

  return {
    resetNutritionPhotoAiSearch,
    resetNutritionPhotoAiState,
    selectNutritionPhotoAiCandidate,
    handleNutritionPhotoAiSearch,
    retryNutritionPhotoAiSearch,
    retryNutritionPhotoFromNotFound,
    addNutritionProductManuallyFromPhoto
  };
}
