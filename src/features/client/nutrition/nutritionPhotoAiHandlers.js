import { createLatestAsyncRequest } from "../../../utils/latestAsyncRequest.js";
import { captureAuthSession as captureActiveAuthSession } from "../../../utils/authSession.js";
import { auth as defaultAuth } from "../../../firebase";
import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import {
  findExistingPhotoFood,
  hasVerifiedPhotoBarcode,
  isVerifiedPhotoLabelFood
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
import {
  findLocalNutritionFoodByBarcode,
  searchLocalNutritionFoods
} from "../../../utils/localNutritionCatalog";

const photoRequestScopes = new WeakMap();

function getPhotoRequestScope(fileRef) {
  if (!photoRequestScopes.has(fileRef)) photoRequestScopes.set(fileRef, createLatestAsyncRequest());
  return photoRequestScopes.get(fileRef);
}

function updateForSession(session, setter, value) {
  const isCurrent = session.isUnchanged || session.isCurrent;
  if (!isCurrent()) return;
  setter((current) => isCurrent()
    ? (typeof value === "function" ? value(current) : value) : current);
}

// This reset depends only on auth identity, retained-file refs and stable React
// setters, so bootstrap/access revocation can create it before picker handlers.
export function createNutritionPhotoAiResetHandler({
  auth = defaultAuth,
  captureAuthSession = () => captureActiveAuthSession(auth),
  nutritionPhotoInputRef,
  nutritionPhotoLastFileRef,
  setNutritionPhotoAiCandidates,
  setNutritionPhotoAiConfidence,
  setNutritionPhotoAiResult,
  setNutritionPhotoAnalyzing,
  setNutritionPhotoName,
  setNutritionPhotoNotFoundOpen,
  setNutritionPhotoPreview
}) {
  const requests = getPhotoRequestScope(nutritionPhotoLastFileRef);
  return function resetNutritionPhotoAiState() {
    const session = captureAuthSession();
    requests.cancel();
    updateForSession(session, setNutritionPhotoPreview, (currentPreview) => {
      if (currentPreview?.startsWith("blob:")) URL.revokeObjectURL(currentPreview);
      return "";
    });
    updateForSession(session, setNutritionPhotoName, "");
    updateForSession(session, setNutritionPhotoAiResult, "");
    updateForSession(session, setNutritionPhotoAiCandidates, []);
    updateForSession(session, setNutritionPhotoAiConfidence, "");
    updateForSession(session, setNutritionPhotoAnalyzing, false);
    updateForSession(session, setNutritionPhotoNotFoundOpen, false);
    nutritionPhotoLastFileRef.current = null;
    if (nutritionPhotoInputRef.current) nutritionPhotoInputRef.current.value = "";
  };
}

export function createNutritionPhotoAiHandlers({
  auth = defaultAuth,
  captureAuthSession = () => captureActiveAuthSession(auth),
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
  const requests = getPhotoRequestScope(nutritionPhotoLastFileRef);
  const resetNutritionPhotoAiState = createNutritionPhotoAiResetHandler({
    auth, captureAuthSession, nutritionPhotoInputRef, nutritionPhotoLastFileRef,
    setNutritionPhotoAiCandidates, setNutritionPhotoAiConfidence, setNutritionPhotoAiResult,
    setNutritionPhotoAnalyzing, setNutritionPhotoName, setNutritionPhotoNotFoundOpen, setNutritionPhotoPreview
  });

  function resetNutritionPhotoAiSearch() {
    resetNutritionPhotoAiState();
  }

  async function findExistingNutritionFoodFromPhoto(product = {}) {
    const query = String(product.query || product.name || "").trim();
    const barcode = String(product.barcode || "").replace(/\D/g, "");
    const hasVerifiedBarcode = hasVerifiedPhotoBarcode(product);
    const currentFoods = [
      ...Object.values(nutrition.myFoods || {}),
      ...nutritionFoodDatabase,
      ...fatSecretFoods
    ].map(normalizeNutritionFood);
    let existingFood = findExistingPhotoFood(currentFoods, product);
    if (existingFood) return existingFood;

    // A fully readable code is the only product identifier that can safely
    // bypass confirmation. It is more reliable than a visually similar name.
    if (hasVerifiedBarcode) {
      try {
        existingFood = await findLocalNutritionFoodByBarcode(barcode);
        if (existingFood) return existingFood;
      } catch (error) {
        console.warn("[AI PHOTO] barcode catalog lookup failed", error);
      }

      // Do not fall back to a model-generated name when a barcode has no
      // catalog entry: it could silently replace the scanned product.
      return null;
    }

    if (query.length < 2) return null;

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
      source: food.source || "Примерная оценка ИИ",
      sourceType: food.sourceType || "ai_estimate",
      evidenceType: food.evidenceType || "estimate",
      requiresReview: food.requiresReview !== false
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

      // Product labels and barcodes contain small text. Preserve enough detail
      // for high-fidelity OCR while keeping mobile uploads comfortably bounded.
      const maxSide = 1600;
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);

      return canvas.toDataURL("image/jpeg", 0.86);
    } finally {
      URL.revokeObjectURL(imageUrl);
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

    const session = captureAuthSession();
    if (!session.isCurrent()) return;
    const latestRequest = requests.start();
    const request = {
      signal: latestRequest.signal,
      isCurrent: () => latestRequest.isCurrent() && session.isCurrent()
    };
    const publish = (setter, value) => {
      if (request.isCurrent()) setter((current) => request.isCurrent()
        ? (typeof value === "function" ? value(current) : value) : current);
    };
    nutritionPhotoLastFileRef.current = file;
    publish(setNutritionPhotoName, file.name || "Фото продукта");
    setNutritionPhotoPreview((currentPreview) => {
      if (!request.isCurrent()) return currentPreview;
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return URL.createObjectURL(file);
    });
    publish(setNutritionPhotoAiResult, "");
    publish(setNutritionPhotoAiCandidates, []);
    publish(setNutritionPhotoAiConfidence, "");
    publish(setNutritionPhotoNotFoundOpen, false);
    publish(setNutritionPhotoAnalyzing, true);
    publish(setFatSecretError, "");
    publish(setNutritionSearchTab, "food");
    publish(setShowRecentNutritionFoods, false);

    try {
      startPerformanceCheck("AI photo · total", { fileSizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10 });
      startPerformanceCheck("AI photo · prepare image");
      const imageData = await prepareNutritionPhotoForAi(file);
      if (!request.isCurrent()) return;
      endPerformanceCheck("AI photo · prepare image", { imageLengthKb: Math.round((imageData.length / 1024) * 10) / 10 });

      startPerformanceCheck("AI photo · function request");
      const response = await fetchAuthorizedWithTimeout("/api/ai-food-photo", {
        signal: request.signal,
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
      if (!request.isCurrent()) return;
      endPerformanceCheck("AI photo · function request", { status: response.status, apiVersion: data.apiVersion || "" });

      if (!response.ok) {
        console.warn("[AI PHOTO] request failed", { status: response.status, apiVersion: data.apiVersion || "", code: data.code || "" });
        publish(setNutritionPhotoAiCandidates, []);
        publish(setNutritionPhotoAiConfidence, "");
        publish(setNutritionPhotoAiResult, data.message || "Не удалось распознать продукт на фото. Попробуй другое изображение.");
        return;
      }

      const product = data.product || {};
      const hasVerifiedBarcode = hasVerifiedPhotoBarcode(product);
      const hasVerifiedLabel = isVerifiedPhotoLabelFood(product, data);

      if (data.found === false || (!hasVerifiedBarcode && !hasVerifiedLabel)) {
        console.warn("[AI PHOTO] unverified product", { apiVersion: data.apiVersion || "", product });
        publish(setNutritionPhotoAiCandidates, []);
        publish(setNutritionPhotoAiConfidence, "");
        publish(setNutritionPhotoAiResult, "");
        publish(setNutritionPhotoNotFoundOpen, true);
        return;
      }

      // A barcode is only an identifier: its nutrition must come from the
      // catalog, never from a photo-model guess. A readable label can open a
      // reviewable draft only after the strict verification above.
      publish(setNutritionPhotoAiConfidence, getNutritionPhotoAiConfidenceText(product.confidence));
      const existingFood = await findExistingNutritionFoodFromPhoto(product);
      if (!request.isCurrent()) return;
      if (existingFood) {
        resetNutritionPhotoAiState();
        updateForSession(session, setNutritionSearch, existingFood.name || product.name);
        updateForSession(session, setNutritionSearchTab, "food");
        updateForSession(session, setNutritionEditPageOpen, false);
        updateForSession(session, setNutritionEditDetailsOpen, false);
        updateForSession(session, setNutritionMealMenuOpen, false);
        updateForSession(session, setNutritionCreateChoiceOpen, false);
        saveRecentNutritionFood(existingFood);
        addNutritionFoodFromPicker(existingFood);
        return;
      }

      if (!hasVerifiedLabel) {
        publish(setNutritionPhotoAiCandidates, []);
        publish(setNutritionPhotoAiConfidence, "");
        publish(setNutritionPhotoAiResult, "");
        publish(setNutritionPhotoNotFoundOpen, true);
        return;
      }

      openNutritionCreateProductFromPhoto({ ...product, rawAiResponse: data }, product.name);
    } catch (error) {
      if (!request.isCurrent()) return;
      console.error(error);
      showAppError(
        error.name === "AbortError"
          ? "timeout"
          : typeof navigator !== "undefined" && !navigator.onLine
            ? "offline"
            : "api",
        "AI-фото сейчас недоступно. Можно ввести продукт вручную."
      );
      publish(setNutritionPhotoAiCandidates, []);
      publish(setNutritionPhotoAiConfidence, "");
      publish(setNutritionPhotoAiResult,
        error.name === "AbortError"
          ? "Анализ фото занял слишком много времени. Попробуй ещё раз."
          : "AI-фото сейчас недоступно. Попробуй ещё раз или создай продукт вручную."
      );
    } finally {
      endPerformanceCheck("AI photo · total");
      publish(setNutritionPhotoAnalyzing, false);
    }
  }

  async function handleNutritionPhotoAiSearch(event) {
    const session = captureAuthSession();
    const file = event.target.files?.[0];
    await runNutritionPhotoAiSearch(file);
    if (session.isCurrent() && event.target) {
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
    const session = captureAuthSession();
    setNutritionPhotoNotFoundOpen(false);
    resetNutritionPhotoAiState();
    window.setTimeout(() => { if (session.isCurrent()) nutritionPhotoInputRef.current?.click(); }, 0);
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
