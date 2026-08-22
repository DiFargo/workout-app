import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  findExactLazyNutritionCatalogFoods,
  resolveExactNutritionCatalogFoods
} from "../src/data/nutrition-catalog/lazyCatalog.js";
import { findExactPersonalVoiceFood } from "../src/features/client/nutrition/nutritionVoicePersonalCatalog.js";
import {
  extractVoiceMetricAmounts,
  resolveVoiceFoodMetricAmounts
} from "../functions/voiceFoodAmounts.js";

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);

test("voice nutrition input starts and stops recording with taps", async () => {
  const orbitSource = await readFile(sourceUrl("src/features/client/nutrition/NutritionOrbit.jsx"), "utf8");
  const orbitStylesSource = await readFile(sourceUrl("src/features/client/nutrition/NutritionOrbit.module.css"), "utf8");
  const foodSearchPageSource = await readFile(sourceUrl("src/features/client/nutrition/FoodSearchPage.jsx"), "utf8");
  const foodSearchPageStylesSource = await readFile(sourceUrl("src/features/client/nutrition/FoodSearchPage.module.css"), "utf8");
  const modalSource = await readFile(sourceUrl("src/features/client/nutrition/NutritionVoiceModal.jsx"), "utf8");
  const modalStylesSource = await readFile(sourceUrl("src/features/client/nutrition/NutritionVoiceModal.module.css"), "utf8");

  assert.doesNotMatch(orbitSource, /data-testid="nutrition-voice-toggle"/);
  assert.doesNotMatch(orbitSource, /role="switch"/);
  assert.match(orbitSource, /onClick=\{handleVoiceAction\}/);
  assert.doesNotMatch(orbitSource, /onPointerDown=\{voiceEnabled/);
  assert.match(orbitSource, /voiceState === "recording"/);
  assert.doesNotMatch(orbitSource, /data-testid="nutrition-orbit-voice-hint"/);
  assert.match(orbitSource, /origin=\{voiceButtonOrigin\}/);
  assert.match(orbitSource, /<NutritionVoiceModal/);
  assert.match(orbitSource, /open=\{voiceEnabled && voiceModalOpen\}/);
  assert.match(orbitSource, /onVoiceEnd=\{onVoiceEnd\}/);
  assert.match(orbitSource, /data-testid="nutrition-orbit-add"/);
  assert.match(orbitSource, /data-nutrition-orbit-part=\{voiceEnabled \? "voice-layout" : "stage"\}/);
  assert.match(orbitSource, /data-nutrition-orbit-part="voice-calories"/);
  assert.doesNotMatch(orbitSource, /data-nutrition-orbit-part="voice-consumed"/);
  assert.match(orbitSource, /data-nutrition-orbit-part="voice-quick-actions"/);
  assert.match(orbitSource, /data-testid="nutrition-orbit-audio-search"/);
  assert.match(orbitSource, /data-testid="nutrition-orbit-photo-search"/);
  assert.match(orbitSource, /data-testid="nutrition-orbit-photo-input"/);
  assert.match(orbitSource, /onClick=\{onAdd\}/);
  assert.match(orbitSource, /onChange=\{onPhotoSearch\}/);
  assert.match(orbitSource, /data-nutrition-orbit-part=\{voiceEnabled \? "voice-manual-action" : undefined\}/);
  assert.doesNotMatch(orbitSource, /voiceToggleLabel/);
  assert.doesNotMatch(orbitSource, /Premium test/);
  assert.doesNotMatch(orbitSource, /caloriesLeft/);
  assert.match(orbitStylesSource, /\.voiceStage \.scene,/);
  assert.match(orbitStylesSource, /\.voiceStage \.voiceButton \{/);
  assert.match(orbitStylesSource, /border-radius: 50%/);
  assert.match(orbitStylesSource, /\.voiceCalories/);
  assert.match(foodSearchPageSource, /data-testid=\{modal \? "food-search-scroll" : undefined\}/);
  assert.match(foodSearchPageStylesSource, /\.modalContent \{/);
  assert.match(foodSearchPageStylesSource, /overflow-y: auto/);
  assert.match(foodSearchPageStylesSource, /touch-action: pan-y/);

  assert.match(modalSource, /createPortal/);
  assert.match(modalSource, /origin = null/);
  assert.match(modalSource, /useAnchoredCaptureSurface/);
  assert.match(modalSource, /anchoredRecordVisual/);
  assert.match(modalSource, /className=\{styles\.anchoredSurface\} data-testid="nutrition-voice-sheet" style=\{originStyle\}/);
  assert.match(modalSource, /data-testid="nutrition-voice-modal"/);
  assert.match(modalSource, /data-testid="nutrition-voice-record"/);
  assert.match(modalSource, /data-testid="nutrition-voice-close"/);
  assert.match(modalSource, /data-testid="nutrition-voice-backdrop"/);
  assert.match(modalSource, /data-testid="nutrition-voice-done"/);
  assert.match(modalSource, /onVoiceAddedItemRemove/);
  assert.match(modalSource, /formatVoiceAddedFoodMacros/);
  assert.match(modalSource, /Trash2/);
  assert.match(modalSource, /onClick=\{toggleCapture\}/);
  assert.match(modalSource, /if \(isRecording\) \{\s*onVoiceEnd\?\.\(\);/);
  assert.doesNotMatch(modalSource, /onPointerDown=\{startCapture\}/);
  assert.match(modalSource, /onVoiceEnd\?\.\(\{ cancelled: true \}\)/);
  assert.match(modalSource, /audioLevel = 0/);
  assert.match(modalSource, /styles\.audioWave/);
  assert.match(modalStylesSource, /touch-action: none/);
  assert.match(modalStylesSource, /\.overlay\[data-modal-surface="true"\] \{\s*box-sizing: border-box/);
  assert.match(modalStylesSource, /env\(safe-area-inset-bottom\)/);
  assert.match(modalStylesSource, /--voice-wave-inner-scale/);
  assert.match(modalStylesSource, /\.addedItemsSection/);
  assert.match(modalStylesSource, /\.doneButton/);
});

test("voice parsing records audio when available, protects the API, and uses catalog matches before labelled AI estimates", async () => {
  const voiceSource = await readFile(sourceUrl("src/features/client/nutrition/nutritionVoiceHandlers.js"), "utf8");
  const portionSource = await readFile(sourceUrl("src/features/client/nutrition/nutritionVoicePortions.js"), "utf8");
  const functionsSource = await readFile(sourceUrl("functions/index.js"), "utf8");
  const voiceSafetySource = await readFile(sourceUrl("functions/voiceFoodSafety.js"), "utf8");
  const appCoreSource = await readFile(sourceUrl("src/AppCore.jsx"), "utf8");
  const runtimeSource = await readFile(sourceUrl("src/features/client/nutrition/useNutritionVoiceRuntime.js"), "utf8");
  const nutritionRouteSource = await readFile(sourceUrl("src/features/client/nutrition/renderNutritionPageFromContext.jsx"), "utf8");
  const diarySource = await readFile(sourceUrl("src/features/client/nutrition/NutritionDiary.jsx"), "utf8");
  const mealModalSource = await readFile(sourceUrl("src/features/client/nutrition/NutritionMealModal.jsx"), "utf8");

  assert.match(voiceSource, /MediaRecorder/);
  assert.match(voiceSource, /getUserMedia/);
  assert.match(voiceSource, /audioBase64/);
  assert.match(voiceSource, /audioMimeType/);
  assert.match(voiceSource, /AbortController/);
  assert.match(voiceSource, /SpeechRecognition \|\| target\?\.webkitSpeechRecognition/);
  assert.match(voiceSource, /recognition\.lang = "ru-RU"/);
  assert.match(voiceSource, /fetchAuthorizedWithTimeout\("\/api\/ai-food-voice"/);
  assert.match(voiceSource, /signal: abortController\.signal/);
  assert.match(voiceSource, /findPersonalVoiceFoodCandidates\(nutritionMyFoods, item\.query\)/);
  assert.match(voiceSource, /findExactLocalNutritionFoods\(query\)/);
  assert.match(voiceSource, /isExactVoiceFoodMatch\(candidate, query\)/);
  assert.match(voiceSource, /verifiedCandidates\.length === 1/);
  assert.match(voiceSource, /verifiedCandidates\.length > 1/);
  assert.match(voiceSource, /sourceType === "local_catalog"/);
  assert.match(voiceSource, /createAiEstimatedVoiceFood\(item\)/);
  assert.match(voiceSource, /sourceType: "ai_estimate"/);
  assert.match(voiceSource, /source: AI_VOICE_ESTIMATE_SOURCE/);
  assert.match(voiceSource, /Оценка ИИ: КБЖУ подобрано по наиболее близкому продукту/);
  assert.match(voiceSource, /Оценка ИИ: \$\{reviewItems\.length\}/);
  assert.match(voiceSource, /getVoiceAveragePortionGrams\(food, item\.query\)/);
  assert.match(voiceSource, /amountMode: "grams"/);
  assert.match(voiceSource, /expandMeal: false/);
  assert.match(voiceSource, /onAdded: \(entry\) =>/);
  assert.match(voiceSource, /setNutritionVoiceAddedItems\(\[\.\.\.addedItems, \.\.\.reviewItems, \.\.\.candidateItems\]\)/);
  assert.match(voiceSource, /MIN_VOICE_RECORDING_DURATION_MS/);
  assert.match(voiceSource, /MAX_VOICE_RECORDING_DURATION_MS = 60 \* 1000/);
  assert.match(voiceSource, /VOICE_SILENCE_TIMEOUT_MS = 7 \* 1000/);
  assert.match(voiceSource, /startVoiceRecordingLimit\(sessionId\)/);
  assert.match(voiceSource, /clearVoiceRecordingLimit\(\)/);
  assert.match(voiceSource, /startVoiceSilenceLimit\(sessionId\)/);
  assert.match(voiceSource, /clearVoiceSilenceLimit\(\)/);
  assert.match(voiceSource, /Нет звука 7 секунд\. Завершаем запись/);
  assert.match(voiceSource, /brand \? "" : name/);
  assert.doesNotMatch(voiceSource, /if \(nutritionVoiceReleaseRequestedRef\.current\) \{\s*recorder\.stop\(\);/);
  assert.match(portionSource, /getPieceProductSizeProfile/);
  assert.match(portionSource, /DEFAULT_VOICE_PORTION_GRAMS = 150/);
  assert.doesNotMatch(voiceSource, /использовано 100 г/);

  assert.match(functionsSource, /MAX_AI_VOICE_AUDIO_BYTES = 4 \* 1024 \* 1024/);
  assert.match(functionsSource, /audioBase64/);
  assert.match(functionsSource, /audioMimeType/);
  assert.match(functionsSource, /https:\/\/api\.openai\.com\/v1\/audio\/transcriptions/);
  assert.match(functionsSource, /gpt-4o-mini-transcribe/);
  assert.match(functionsSource, /formData\.set\("language", "ru"\)/);
  assert.match(functionsSource, /estimatedNutritionPer100g/);
  assert.match(functionsSource, /closest ordinary food or dish/);
  assert.match(functionsSource, /apiVersion = "aiFoodVoice-v6"/);
  assert.match(functionsSource, /MAX_AI_VOICE_ESTIMATE_CALORIES = 900/);
  assert.match(functionsSource, /extractVoiceMetricAmounts/);
  assert.match(functionsSource, /resolveVoiceFoodMetricAmounts/);
  assert.match(functionsSource, /hasVoiceExplicitMetricAmount\(transcript\)/);
  assert.match(functionsSource, /Never move an amount to another food or invent\/default to 100 g/);
  assert.match(functionsSource, /'флетуайт', 'флет уйт', and 'флетуйт' as 'флэт уайт'/);
  assert.match(functionsSource, /'сырники с клюквой' must be one query/);
  assert.match(functionsSource, /'омлет с кофе' means exactly two items/);
  assert.match(functionsSource, /'каменная курица' and 'гнилая курица' must produce no chicken item/);
  assert.match(functionsSource, /from "\.\/voiceFoodSafety\.js"/);
  assert.match(voiceSafetySource, /export function getUnsafeVoiceFoodStems/);
  assert.match(voiceSafetySource, /export function isUnsafeVoiceFoodQuery/);
  assert.match(functionsSource, /isUnsafeVoiceFoodQuery\(item\.query, unsafeFoodStems\)/);
  assert.match(functionsSource, /metricAmounts: extractVoiceMetricAmounts\(transcript\)/);
  assert.match(appCoreSource, /useNutritionVoiceRuntime/);
  assert.match(appCoreSource, /nutritionMyFoods: nutrition\.myFoods/);
  assert.match(runtimeSource, /nutritionVoiceRecorderRef/);
  assert.match(runtimeSource, /nutritionVoiceRecordingTimerRef/);
  assert.match(runtimeSource, /nutritionVoiceSilenceTimerRef/);
  assert.match(runtimeSource, /VOICE_ACTIVITY_LEVEL = 0\.06/);
  assert.match(runtimeSource, /nutritionVoiceStarting/);
  assert.match(runtimeSource, /nutritionMyFoods/);
  assert.match(runtimeSource, /nutritionVoiceAbortControllerRef/);
  assert.match(runtimeSource, /getByteTimeDomainData/);
  assert.match(runtimeSource, /nutritionVoiceAudioLevel/);
  assert.match(runtimeSource, /nutritionVoiceAddedItems/);
  assert.match(runtimeSource, /removeNutritionVoiceAddedItem/);
  assert.match(appCoreSource, /nutritionVoiceMode/);
  assert.match(nutritionRouteSource, /nutritionVoiceRecording \|\| nutritionVoiceStarting/);
  assert.match(nutritionRouteSource, /voiceEnabled: true/);
  assert.match(nutritionRouteSource, /voiceAudioLevel: nutritionVoiceAudioLevel \|\| 0/);
  assert.match(nutritionRouteSource, /voiceAddedItems: nutritionVoiceAddedItems \|\| \[\]/);
  assert.match(nutritionRouteSource, /onPhotoSearch: \(event\) => \{\s*const file = event\.target\.files\?\.\[0\];\s*openNutritionPicker\(\);\s*handleNutritionPhotoAiSearch\(\{\s*target: \{ files: file \? \[file\] : \[\], value: "" \}/);
  assert.match(diarySource, /item\.source === "Оценка ИИ"/);
  assert.match(mealModalSource, /item\.source === "Оценка ИИ"/);

  assert.ok(
    voiceSource.indexOf("findPersonalVoiceFoodCandidates(nutritionMyFoods, item.query)") <
      voiceSource.indexOf("await findVerifiedVoiceFoods(item.query)")
  );
});

test("voice entry uses the spoken 500 ml instead of a model-default 100 g", () => {
  const metricAmounts = extractVoiceMetricAmounts("флэт уайт 500 мл");
  const resolved = resolveVoiceFoodMetricAmounts([
    { query: "флэт уайт", grams: 100, amountEstimated: false }
  ], {
    metricAmounts,
    hasSpokenMetricAmount: true
  });

  assert.deepEqual(metricAmounts, [500]);
  assert.deepEqual(resolved, [{ grams: 500, amountEstimated: false }]);
});

test("voice entry chooses an exact personal food before the shared catalog or an AI estimate", () => {
  const personalFoods = {
    "my_syrniki_cranberry": {
      id: "my_syrniki_cranberry",
      foodId: "my_syrniki_cranberry",
      name: "Сырники с клюквой",
      brand: "Домашние",
      portion: "160 г",
      portionAmount: 160,
      calories: 212,
      protein: 13,
      fat: 8,
      carbs: 22,
      source: "Моя база"
    },
    "my_ai_voice_syrniki_cranberry": {
      id: "my_ai_voice_syrniki_cranberry",
      foodId: "my_ai_voice_syrniki_cranberry",
      name: "Сырники с клюквой",
      calories: 400
    }
  };

  const matched = findExactPersonalVoiceFood(personalFoods, "сырники с клюквой");

  assert.equal(matched?.id, "my_syrniki_cranberry");
  assert.equal(matched?.calories, 212);
  assert.equal(matched?.sourceType, "personal_catalog");
  assert.equal(matched?.defaultGram, 160);
  assert.equal(
    findExactPersonalVoiceFood({
      first: personalFoods.my_syrniki_cranberry,
      second: { ...personalFoods.my_syrniki_cranberry, id: "my_syrniki_cranberry_second" }
    }, "сырники с клюквой"),
    null
  );
});

test("voice exact lookup cannot lose a SKU behind broad catalog results", () => {
  const broadFoods = Array.from({ length: 8 }, (_, index) => ({
    id: `ref-broad-${index}`,
    n: `Кофейный напиток ${index}`,
    k1000: 50000,
    p1000: 2000,
    f1000: 1000,
    h1000: 8000
  }));
  const exactSku = {
    id: "sku-flat-white",
    n: "Флетуайт",
    a: ["флет уайт"],
    k1000: 62000,
    p1000: 3200,
    f1000: 3000,
    h1000: 4700
  };

  const matches = resolveExactNutritionCatalogFoods(
    [...broadFoods, exactSku],
    { "флет уайт": [exactSku.id] },
    "Флет уайт"
  );

  assert.deepEqual(matches.map((food) => food.id), ["sku-flat-white"]);
  assert.equal(matches[0].calories, 62);
});

test("voice exact lookup loads the exact SKU index before broad search results", async () => {
  const originalFetch = globalThis.fetch;
  const exactSku = {
    id: "sku-exact-flat-white",
    n: "Флэт уайт",
    k1000: 62000,
    p1000: 3200,
    f1000: 3000,
    h1000: 4700
  };
  const catalogFiles = {
    "/nutrition-catalog/reference/foods.compact.json": Array.from({ length: 8 }, (_, index) => ({
      id: `ref-broad-${index}`,
      n: `Кофейный напиток ${index}`
    })),
    "/nutrition-catalog/reference/alias-exact-index.json": {},
    "/nutrition-catalog/sku/foods.compact.json": [exactSku],
    "/nutrition-catalog/sku/alias-exact-index.json": {
      "флэт уайт": [exactSku.id]
    }
  };
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    const payload = catalogFiles[url];
    if (!payload) return { ok: false, status: 404 };
    return { ok: true, json: async () => payload };
  };

  try {
    const matches = await findExactLazyNutritionCatalogFoods("Флэт уайт");

    assert.deepEqual(matches.map((food) => food.id), [exactSku.id]);
    assert.deepEqual(requestedUrls.sort(), Object.keys(catalogFiles).sort());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("voice AI fallback validates its nutrition bounds before creating a diary food", async () => {
  const voiceSource = await readFile(sourceUrl("src/features/client/nutrition/nutritionVoiceHandlers.js"), "utf8");

  assert.match(voiceSource, /MAX_AI_VOICE_ESTIMATE_CALORIES = 900/);
  assert.match(voiceSource, /MAX_AI_VOICE_ESTIMATE_MACRO = 100/);
  assert.match(voiceSource, /numericValue < 0 \|\| numericValue > max/);
  assert.match(voiceSource, /calories === null \|\| calories <= 0/);
  assert.match(voiceSource, /export function createAiEstimatedVoiceFood/);
  assert.match(voiceSource, /id,\n      foodId: id,/);
  assert.match(voiceSource, /source: AI_VOICE_ESTIMATE_SOURCE/);
});

test("voice additions can force gram-based portions without changing existing picker behavior", async () => {
  const foodCommitSource = await readFile(sourceUrl("src/features/client/nutrition/nutritionFoodCommitHandlers.js"), "utf8");

  assert.match(foodCommitSource, /function addNutritionFood\(food, mealId = nutritionMeal, amount = nutritionAmount, options = \{\}\)/);
  assert.match(foodCommitSource, /function createNutritionEntryId\(foodId\)/);
  assert.match(foodCommitSource, /crypto\?\.randomUUID\?\.\(\)/);
  assert.match(foodCommitSource, /id: createNutritionEntryId\(sourceFood\.id\)/);
  assert.match(foodCommitSource, /const amountMode = options\.amountMode === "grams" \|\| options\.amountMode === "portion"/);
  assert.match(foodCommitSource, /const shouldExpandMeal = options\.expandMeal !== false/);
  assert.match(foodCommitSource, /typeof options\.onAdded === "function"/);
  assert.match(foodCommitSource, /if \(shouldExpandMeal\)/);
});
