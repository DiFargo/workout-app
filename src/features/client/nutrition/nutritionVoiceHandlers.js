import { getDefaultNutritionMealByTime } from "../../../domain/nutritionPresentation";
import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import { findExactLocalNutritionFoods } from "../../../utils/localNutritionCatalog";
import { normalizeNutritionFood } from "../../../utils/nutritionFoodModel";
import { getVoiceAveragePortionGrams } from "./nutritionVoicePortions";
import { findPersonalVoiceFoodCandidates } from "./nutritionVoicePersonalCatalog";

const NUTRITION_VOICE_MODE_STORAGE_KEY = "nutrition_voice_input_test_v1";
const MAX_VOICE_TRANSCRIPT_LENGTH = 700;
const MAX_VOICE_FOODS = 6;
const MAX_VOICE_AUDIO_BYTES = 4 * 1024 * 1024;
const MIN_VOICE_RECORDING_DURATION_MS = 450;
const MAX_VOICE_RECORDING_DURATION_MS = 60 * 1000;
const VOICE_SILENCE_TIMEOUT_MS = 7 * 1000;
const AI_VOICE_ESTIMATE_SOURCE = "Оценка ИИ";
const MAX_AI_VOICE_ESTIMATE_CALORIES = 900;
const MAX_AI_VOICE_ESTIMATE_MACRO = 100;
const VOICE_MEAL_IDS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const VOICE_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/wav"
];

function getWindow() {
  return typeof window === "undefined" ? null : window;
}

function normalizeVoiceText(value, maxLength = MAX_VOICE_TRANSCRIPT_LENGTH) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeVoiceLookupText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVoiceGrams(value) {
  const numericValue = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return Math.max(1, Math.min(2000, Math.round(numericValue)));
}

function normalizeVoiceEstimatedNutritionValue(value, max) {
  const numericValue = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > max) return null;
  return Math.round(numericValue * 10) / 10;
}

function normalizeVoiceEstimatedNutrition(value) {
  const calories = normalizeVoiceEstimatedNutritionValue(
    value?.calories,
    MAX_AI_VOICE_ESTIMATE_CALORIES
  );
  const protein = normalizeVoiceEstimatedNutritionValue(value?.protein, MAX_AI_VOICE_ESTIMATE_MACRO);
  const fat = normalizeVoiceEstimatedNutritionValue(value?.fat, MAX_AI_VOICE_ESTIMATE_MACRO);
  const carbs = normalizeVoiceEstimatedNutritionValue(value?.carbs, MAX_AI_VOICE_ESTIMATE_MACRO);

  if (calories === null || calories <= 0 || protein === null || fat === null || carbs === null) {
    return null;
  }

  return { calories, protein, fat, carbs };
}

function getVoiceMealId(value) {
  const mealId = String(value || "").trim().toLowerCase();
  return VOICE_MEAL_IDS.has(mealId) ? mealId : getDefaultNutritionMealByTime();
}

function getSpeechRecognitionConstructor() {
  const target = getWindow();
  return target?.SpeechRecognition || target?.webkitSpeechRecognition || null;
}

function getMediaRecorderConstructor() {
  return getWindow()?.MediaRecorder || null;
}

function supportsVoiceAudioRecording() {
  const target = getWindow();
  return Boolean(target?.navigator?.mediaDevices?.getUserMedia && getMediaRecorderConstructor());
}

function getPreferredVoiceMimeType(MediaRecorder) {
  return VOICE_AUDIO_MIME_TYPES.find((mimeType) => (
    typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(mimeType)
  )) || "";
}

function createVoiceMediaRecorder(MediaRecorder, stream) {
  const mimeType = getPreferredVoiceMimeType(MediaRecorder);
  const options = {
    audioBitsPerSecond: 64000,
    ...(mimeType ? { mimeType } : {})
  };

  try {
    return new MediaRecorder(stream, options);
  } catch {
    return new MediaRecorder(stream);
  }
}

function stopVoiceStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch {
      // A track can already be stopped after permission or device changes.
    }
  });
}

function getSpeechRecognitionErrorMessage(errorCode) {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "Разрешите доступ к микрофону, чтобы использовать голосовой ввод.";
    case "no-speech":
      return "Речь не распознана. Нажмите кнопку и скажите, что съели.";
    case "network":
      return "Распознавание речи временно недоступно. Попробуйте ещё раз.";
    default:
      return "Не удалось распознать речь. Попробуйте ещё раз или добавьте еду вручную.";
  }
}

function getVoiceRecordingErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Разрешите доступ к микрофону в настройках браузера.";
    case "NotFoundError":
      return "Не найден доступный микрофон.";
    case "NotReadableError":
      return "Микрофон сейчас занят другим приложением. Попробуйте ещё раз.";
    default:
      return "Не удалось включить микрофон. Попробуйте ещё раз или добавьте еду вручную.";
  }
}

function voiceBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("Voice audio encoding is unavailable"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const separatorIndex = result.indexOf(",");
      const base64 = separatorIndex >= 0 ? result.slice(separatorIndex + 1) : "";
      if (!base64) {
        reject(new Error("Voice audio encoding failed"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Voice audio encoding failed"));
    reader.readAsDataURL(blob);
  });
}

function normalizeVoiceItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const grams = normalizeVoiceGrams(item?.grams);
      const amountEstimated = Boolean(item?.amountEstimated) || grams === null;

      return {
        query: normalizeVoiceText(item?.query, 120),
        grams,
        mealId: getVoiceMealId(item?.mealId),
        amountEstimated,
        estimatedNutritionPer100g: normalizeVoiceEstimatedNutrition(item?.estimatedNutritionPer100g)
      };
    })
    .filter((item) => item.query.length >= 2)
    .slice(0, MAX_VOICE_FOODS);
}

export function isExactVoiceFoodMatch(food, query) {
  const normalizedQuery = normalizeVoiceLookupText(query);
  if (!normalizedQuery) return false;

  const name = String(food?.name || "").trim();
  const brand = String(food?.brand || "").trim();
  const searchableNames = [
    brand ? "" : name,
    brand && name ? `${brand} ${name}` : "",
    ...(Array.isArray(food?.aliases) ? food.aliases : [])
  ];

  return searchableNames
    .map(normalizeVoiceLookupText)
    .filter(Boolean)
    .includes(normalizedQuery);
}

async function findVerifiedVoiceFoods(query) {
  const candidates = await findExactLocalNutritionFoods(query);
  return candidates.filter((candidate) => (
    candidate?.sourceType === "local_catalog" &&
    candidate?.id &&
    isExactVoiceFoodMatch(candidate, query)
  )).map((food) => ({
    ...normalizeNutritionFood(food),
    aliases: Array.isArray(food.aliases) ? food.aliases : [],
    category: food.category || "",
    defaultGram: food.defaultGram,
    sourceType: "local_catalog"
  }));
}

function getAiVoiceEstimateId(query) {
  const safeQuery = normalizeVoiceLookupText(query)
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `my_ai_voice_${safeQuery || "food"}`;
}

export function createAiEstimatedVoiceFood(item = {}) {
  const query = normalizeVoiceText(item?.query, 120);
  const estimatedNutrition = normalizeVoiceEstimatedNutrition(item?.estimatedNutritionPer100g);
  if (query.length < 2 || !estimatedNutrition) return null;

  const id = getAiVoiceEstimateId(query);
  return {
    ...normalizeNutritionFood({
      id,
      foodId: id,
      name: query,
      portion: "100 г",
      portionAmount: 100,
      calories: estimatedNutrition.calories,
      protein: estimatedNutrition.protein,
      fat: estimatedNutrition.fat,
      carbs: estimatedNutrition.carbs,
      source: AI_VOICE_ESTIMATE_SOURCE,
      amountMode: "grams",
      icon: "🍽️"
    }),
    aliases: [query],
    category: "",
    defaultGram: 100,
    sourceType: "ai_estimate",
    evidenceType: "estimate",
    requiresReview: true
  };
}

function getAiVoiceEstimateNote(query) {
  return `Оценка ИИ: КБЖУ подобрано по наиболее близкому продукту для «${query}».`;
}

function getVoiceItemAmount(item, food) {
  return item.amountEstimated
    ? getVoiceAveragePortionGrams(food, item.query)
    : item.grams;
}

function getVoiceReviewItem({ item, food, sessionId, index }) {
  const amount = getVoiceItemAmount(item, food);
  const scale = amount / 100;

  return {
    id: `voice_review_${sessionId}_${index}`,
    kind: "review",
    requiresReview: true,
    food,
    query: item.query,
    mealId: item.mealId,
    amount,
    amountMode: "grams",
    portion: food.portion || "100 г",
    name: food.name || item.query,
    source: AI_VOICE_ESTIMATE_SOURCE,
    sourceLabel: "Оценка ИИ · проверьте КБЖУ",
    note: getAiVoiceEstimateNote(item.query),
    calories: Math.round((Number(food.calories) || 0) * scale),
    protein: Math.round((Number(food.protein) || 0) * scale * 10) / 10,
    fat: Math.round((Number(food.fat) || 0) * scale * 10) / 10,
    carbs: Math.round((Number(food.carbs) || 0) * scale * 10) / 10,
    amountEstimated: Boolean(item.amountEstimated)
  };
}

function getVoiceCandidateItem({ item, candidates, sessionId, index, sourceLabel }) {
  return {
    id: `voice_choice_${sessionId}_${index}`,
    kind: "candidate",
    query: item.query,
    candidates: candidates.slice(0, 4),
    candidateSourceLabel: sourceLabel,
    mealId: item.mealId,
    amount: getVoiceItemAmount(item, candidates[0]),
    amountMode: "grams",
    amountEstimated: Boolean(item.amountEstimated)
  };
}

export function loadNutritionVoiceMode() {
  try {
    return getWindow()?.localStorage?.getItem(NUTRITION_VOICE_MODE_STORAGE_KEY) === "enabled";
  } catch {
    return false;
  }
}

export function createNutritionVoiceHandlers({
  addNutritionFood,
  endPerformanceCheck,
  nutritionMyFoods = {},
  nutritionVoiceAnalyzing,
  nutritionVoiceMode,
  nutritionVoiceAbortControllerRef,
  nutritionVoiceChunksRef,
  nutritionVoiceRecognitionRef,
  nutritionVoiceRecorderRef,
  nutritionVoiceRecordingTimerRef,
  nutritionVoiceSilenceTimerRef,
  nutritionVoiceLastActivityAtRef,
  nutritionVoiceReleaseRequestedRef,
  nutritionVoiceSessionIdRef,
  nutritionVoiceStartingRef,
  nutritionVoiceStreamRef,
  nutritionVoiceTranscriptRef,
  showAppError,
  startPerformanceCheck,
  setNutritionVoiceAnalyzing,
  setNutritionVoiceAddedItems,
  setNutritionVoiceFeedback,
  setNutritionVoiceMode,
  setNutritionVoiceRecording,
  setNutritionVoiceStarting
}) {
  const isCurrentSession = (sessionId) => nutritionVoiceSessionIdRef.current === sessionId;

  function clearVoiceRecordingLimit() {
    const timerId = nutritionVoiceRecordingTimerRef.current;
    if (timerId !== null) {
      getWindow()?.clearTimeout?.(timerId);
      nutritionVoiceRecordingTimerRef.current = null;
    }
  }

  function startVoiceRecordingLimit(sessionId) {
    clearVoiceRecordingLimit();
    const target = getWindow();
    if (!target?.setTimeout) return;

    nutritionVoiceRecordingTimerRef.current = target.setTimeout(() => {
      nutritionVoiceRecordingTimerRef.current = null;
      if (!isCurrentSession(sessionId)) return;
      setNutritionVoiceFeedback("Лимит записи — 1 минута. Завершаем запись…");
      stopNutritionVoiceCapture();
    }, MAX_VOICE_RECORDING_DURATION_MS);
  }

  function clearVoiceSilenceLimit() {
    const timerId = nutritionVoiceSilenceTimerRef.current;
    if (timerId !== null) {
      getWindow()?.clearTimeout?.(timerId);
      nutritionVoiceSilenceTimerRef.current = null;
    }
  }

  function startVoiceSilenceLimit(sessionId) {
    clearVoiceSilenceLimit();
    const target = getWindow();
    if (!target?.setTimeout) return;

    nutritionVoiceLastActivityAtRef.current = Date.now();
    const checkForSilence = () => {
      if (!isCurrentSession(sessionId)) return;

      const silenceDurationMs = Date.now() - Number(nutritionVoiceLastActivityAtRef.current || 0);
      if (silenceDurationMs < VOICE_SILENCE_TIMEOUT_MS) {
        nutritionVoiceSilenceTimerRef.current = target.setTimeout(
          checkForSilence,
          Math.max(1, VOICE_SILENCE_TIMEOUT_MS - silenceDurationMs)
        );
        return;
      }

      nutritionVoiceSilenceTimerRef.current = null;
      setNutritionVoiceFeedback("Нет звука 7 секунд. Завершаем запись…");
      stopNutritionVoiceCapture();
    };

    nutritionVoiceSilenceTimerRef.current = target.setTimeout(checkForSilence, VOICE_SILENCE_TIMEOUT_MS);
  }

  function noteVoiceActivity(sessionId) {
    if (isCurrentSession(sessionId)) {
      nutritionVoiceLastActivityAtRef.current = Date.now();
    }
  }

  async function analyzeNutritionVoicePayload(payload, sessionId) {
    const transcript = normalizeVoiceText(payload?.transcript);
    const audioBase64 = String(payload?.audioBase64 || "").trim();
    if (transcript.length < 2 && !audioBase64) {
      setNutritionVoiceFeedback("Не удалось разобрать фразу. Попробуйте ещё раз.");
      return;
    }
    if (!isCurrentSession(sessionId)) return;

    const source = transcript.length >= 2 ? "transcript" : "audio";
    const performancePayload = source === "audio"
      ? { source, audioLength: audioBase64.length }
      : { source, transcriptLength: transcript.length };
    const abortController = new AbortController();
    nutritionVoiceAbortControllerRef.current = abortController;
    setNutritionVoiceAnalyzing(true);
    setNutritionVoiceFeedback(source === "audio" ? "ИИ расшифровывает запись…" : "ИИ анализирует…");
    startPerformanceCheck?.("AI voice · total", performancePayload);

    try {
      const response = await fetchAuthorizedWithTimeout("/api/ai-food-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: abortController.signal,
        body: JSON.stringify(
          transcript.length >= 2
            ? { transcript }
            : {
                audioBase64,
                audioMimeType: String(payload?.audioMimeType || "audio/webm")
              }
        )
      }, 75000);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "ИИ не смог разобрать запись.");
      }
      if (!isCurrentSession(sessionId)) return;

      const voiceItems = normalizeVoiceItems(data.items);
      if (!voiceItems.length) {
        setNutritionVoiceFeedback("Не нашли продукты в записи. Добавьте их вручную.");
        return;
      }

      const resolvedItems = await Promise.all(
        voiceItems.map(async (item, index) => {
          const personalCandidates = findPersonalVoiceFoodCandidates(nutritionMyFoods, item.query);
          if (personalCandidates.length === 1) {
            return { ...item, food: personalCandidates[0], kind: "matched" };
          }
          if (personalCandidates.length > 1) {
            return {
              ...item,
              kind: "candidate",
              candidateItem: getVoiceCandidateItem({
                item,
                candidates: personalCandidates,
                sessionId,
                index,
                sourceLabel: "Выберите вариант из вашей базы"
              })
            };
          }

          try {
            const verifiedCandidates = await findVerifiedVoiceFoods(item.query);
            if (verifiedCandidates.length === 1) {
              return { ...item, food: verifiedCandidates[0], kind: "matched" };
            }
            if (verifiedCandidates.length > 1) {
              return {
                ...item,
                kind: "candidate",
                candidateItem: getVoiceCandidateItem({
                  item,
                  candidates: verifiedCandidates,
                  sessionId,
                  index,
                  sourceLabel: "Выберите точный вариант из проверенной базы"
                })
              };
            }
          } catch (error) {
            // A transient catalog request must not turn a finished voice entry
            // into a dead end. The fallback remains explicitly labelled below.
            console.warn("Nutrition voice exact catalog lookup failed", error?.name || "unknown");
          }

          const aiEstimate = createAiEstimatedVoiceFood(item);
          return aiEstimate
            ? {
                ...item,
                kind: "review",
                reviewItem: getVoiceReviewItem({ item, food: aiEstimate, sessionId, index })
              }
            : { ...item, kind: "unresolved" };
        })
      );
      if (!isCurrentSession(sessionId)) return;

      let addedCount = 0;
      let catalogAddedCount = 0;
      let personalCatalogAddedCount = 0;
      let skippedCount = 0;
      let hasEstimatedAmount = false;
      const addedItems = [];
      const reviewItems = [];
      const candidateItems = [];

      resolvedItems.forEach((item) => {
        if (item.kind === "candidate" && item.candidateItem) {
          candidateItems.push(item.candidateItem);
          hasEstimatedAmount ||= item.amountEstimated;
          return;
        }
        if (item.kind === "review" && item.reviewItem) {
          reviewItems.push(item.reviewItem);
          hasEstimatedAmount ||= item.amountEstimated;
          return;
        }
        if (!item.food) {
          skippedCount += 1;
          return;
        }

        const grams = getVoiceItemAmount(item, item.food);
        let addedItem = null;
        const added = addNutritionFood(item.food, item.mealId, grams, {
          amountMode: "grams",
          expandMeal: false,
          onAdded: (entry) => {
            addedItem = entry;
          }
        });
        if (added) {
          addedCount += 1;
          if (addedItem) addedItems.push(addedItem);
          if (item.food.sourceType === "personal_catalog") {
            personalCatalogAddedCount += 1;
          } else {
            catalogAddedCount += 1;
          }
          hasEstimatedAmount ||= item.amountEstimated;
        } else {
          skippedCount += 1;
        }
      });

      const pendingCount = reviewItems.length + candidateItems.length;
      if (!addedCount && !pendingCount) {
        setNutritionVoiceAddedItems([]);
        setNutritionVoiceFeedback("Не удалось подобрать КБЖУ для этой записи. Уточните название продукта или добавьте его вручную.");
        return;
      }

      const sourceText = [
        personalCatalogAddedCount ? `Из вашей базы: ${personalCatalogAddedCount}.` : "",
        catalogAddedCount ? `Из базы: ${catalogAddedCount}.` : "",
        reviewItems.length ? `Оценка ИИ: ${reviewItems.length} — проверьте перед добавлением.` : "",
        candidateItems.length ? `Нужно выбрать точный вариант: ${candidateItems.length}.` : ""
      ].filter(Boolean).join(" ");
      const skippedText = skippedCount ? ` Не добавлено: ${skippedCount}.` : "";
      const estimateText = hasEstimatedAmount ? " Для неназванного веса использована средняя порция продукта." : "";
      setNutritionVoiceAddedItems([...addedItems, ...reviewItems, ...candidateItems]);
      const completedText = addedCount ? `Добавлено позиций: ${addedCount}.` : "";
      setNutritionVoiceFeedback(`${completedText} ${sourceText}${skippedText}${estimateText}`.trim());
    } catch (error) {
      if (!isCurrentSession(sessionId)) return;

      console.warn("Nutrition voice analysis failed", error?.name || "unknown");
      const message = error?.name === "AbortError"
        ? "Анализ занял слишком много времени. Попробуйте ещё раз."
        : typeof navigator !== "undefined" && !navigator.onLine
          ? "Нет подключения к интернету. Добавьте еду вручную."
          : error?.message || "ИИ сейчас недоступен. Попробуйте ещё раз или добавьте еду вручную.";
      setNutritionVoiceFeedback(message);
      showAppError?.(error?.name === "AbortError" ? "timeout" : "api", message);
    } finally {
      endPerformanceCheck?.("AI voice · total");
      if (nutritionVoiceAbortControllerRef.current === abortController) {
        nutritionVoiceAbortControllerRef.current = null;
      }
      if (isCurrentSession(sessionId)) {
        setNutritionVoiceAnalyzing(false);
      }
    }
  }

  async function analyzeNutritionVoiceAudio(blob, audioMimeType, sessionId, recordingDurationMs = 0) {
    if (!isCurrentSession(sessionId)) return;
    if (recordingDurationMs > 0 && recordingDurationMs < MIN_VOICE_RECORDING_DURATION_MS) {
      setNutritionVoiceFeedback("Запись получилась слишком короткой. Нажмите кнопку, скажите продукты и завершите запись повторным нажатием.");
      return;
    }
    if (!blob?.size) {
      setNutritionVoiceFeedback("Запись получилась слишком короткой. Нажмите кнопку, скажите продукты и завершите запись повторным нажатием.");
      return;
    }
    if (blob.size > MAX_VOICE_AUDIO_BYTES) {
      setNutritionVoiceFeedback("Запись слишком длинная. Скажите продукты короче и попробуйте ещё раз.");
      return;
    }

    setNutritionVoiceAnalyzing(true);
    setNutritionVoiceFeedback("Готовим запись…");
    try {
      const audioBase64 = await voiceBlobToBase64(blob);
      if (!isCurrentSession(sessionId)) return;
      await analyzeNutritionVoicePayload({ audioBase64, audioMimeType }, sessionId);
    } catch (error) {
      if (!isCurrentSession(sessionId)) return;
      console.warn("Nutrition voice audio preparation failed", error?.name || "unknown");
      const message = "Не удалось подготовить голосовую запись. Попробуйте ещё раз.";
      setNutritionVoiceFeedback(message);
      showAppError?.("validation", message);
      setNutritionVoiceAnalyzing(false);
    }
  }

  function startSpeechRecognitionCapture(sessionId) {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setNutritionVoiceRecording(false);
      setNutritionVoiceStarting(false);
      setNutritionVoiceFeedback("Голосовой ввод не поддерживается этим браузером. Откройте приложение в современном браузере и разрешите доступ к микрофону.");
      return;
    }

    const recognition = new SpeechRecognition();
    let recognitionFailed = false;
    nutritionVoiceTranscriptRef.current = "";
    nutritionVoiceRecognitionRef.current = recognition;

    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (nutritionVoiceRecognitionRef.current !== recognition || !isCurrentSession(sessionId)) return;
      setNutritionVoiceRecording(true);
      setNutritionVoiceStarting(false);
      setNutritionVoiceFeedback("Говорите…");
    };

    recognition.onresult = (event) => {
      if (nutritionVoiceRecognitionRef.current !== recognition || !isCurrentSession(sessionId)) return;
      noteVoiceActivity(sessionId);
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || "")
        .join(" ");
      nutritionVoiceTranscriptRef.current = normalizeVoiceText(transcript);
    };

    recognition.onerror = (event) => {
      if (nutritionVoiceRecognitionRef.current !== recognition || !isCurrentSession(sessionId)) return;
      recognitionFailed = true;
      clearVoiceRecordingLimit();
      clearVoiceSilenceLimit();
      nutritionVoiceReleaseRequestedRef.current = false;
      setNutritionVoiceRecording(false);
      setNutritionVoiceStarting(false);
      setNutritionVoiceFeedback(getSpeechRecognitionErrorMessage(event?.error));
    };

    recognition.onend = () => {
      if (nutritionVoiceRecognitionRef.current !== recognition) return;

      clearVoiceRecordingLimit();
      clearVoiceSilenceLimit();
      const shouldAnalyze = nutritionVoiceReleaseRequestedRef.current && isCurrentSession(sessionId);
      const transcript = nutritionVoiceTranscriptRef.current;
      nutritionVoiceRecognitionRef.current = null;
      nutritionVoiceReleaseRequestedRef.current = false;
      setNutritionVoiceRecording(false);
      setNutritionVoiceStarting(false);

      if (shouldAnalyze) {
        analyzeNutritionVoicePayload({ transcript }, sessionId);
      } else if (isCurrentSession(sessionId) && !nutritionVoiceAnalyzing && !recognitionFailed) {
        setNutritionVoiceFeedback("Нажмите кнопку и скажите, что съели.");
      }
    };

    try {
      recognition.start();
      startVoiceRecordingLimit(sessionId);
      startVoiceSilenceLimit(sessionId);
      setNutritionVoiceRecording(true);
      setNutritionVoiceFeedback("Говорите…");
    } catch {
      nutritionVoiceRecognitionRef.current = null;
      setNutritionVoiceRecording(false);
      setNutritionVoiceStarting(false);
      setNutritionVoiceFeedback("Не удалось включить микрофон. Попробуйте ещё раз.");
    }
  }

  async function startRecordedVoiceCapture(sessionId) {
    const target = getWindow();
    const MediaRecorder = getMediaRecorderConstructor();
    let stream = null;
    nutritionVoiceStartingRef.current = true;
    setNutritionVoiceFeedback("Подключаем микрофон…");

    try {
      stream = await target?.navigator?.mediaDevices?.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
          }
      });
      if (!stream || !MediaRecorder || !isCurrentSession(sessionId)) {
        stopVoiceStream(stream);
        setNutritionVoiceStarting(false);
        return;
      }

      if (nutritionVoiceReleaseRequestedRef.current) {
        nutritionVoiceReleaseRequestedRef.current = false;
        stopVoiceStream(stream);
        setNutritionVoiceRecording(false);
        setNutritionVoiceStarting(false);
        setNutritionVoiceFeedback("Запись отменена. Нажмите кнопку, когда будете готовы говорить.");
        return;
      }

      const recorder = createVoiceMediaRecorder(MediaRecorder, stream);
      const chunks = [];
      const configuredMimeType = recorder.mimeType || getPreferredVoiceMimeType(MediaRecorder) || "audio/webm";
      const recorderStartedAt = Date.now();
      let recorderFailed = false;

      nutritionVoiceStreamRef.current = stream;
      nutritionVoiceChunksRef.current = chunks;
      nutritionVoiceRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event?.data?.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recorderFailed = true;
        clearVoiceRecordingLimit();
        clearVoiceSilenceLimit();
        nutritionVoiceReleaseRequestedRef.current = false;
        if (isCurrentSession(sessionId)) {
          setNutritionVoiceRecording(false);
          setNutritionVoiceStarting(false);
          setNutritionVoiceFeedback("Не удалось записать голос. Попробуйте ещё раз.");
        }
      };
      recorder.onstop = () => {
        clearVoiceRecordingLimit();
        clearVoiceSilenceLimit();
        const shouldAnalyze = !recorderFailed && nutritionVoiceReleaseRequestedRef.current && isCurrentSession(sessionId);
        nutritionVoiceReleaseRequestedRef.current = false;
        if (nutritionVoiceRecorderRef.current === recorder) nutritionVoiceRecorderRef.current = null;
        if (nutritionVoiceStreamRef.current === stream) nutritionVoiceStreamRef.current = null;
        if (nutritionVoiceChunksRef.current === chunks) nutritionVoiceChunksRef.current = [];
        stopVoiceStream(stream);
        setNutritionVoiceRecording(false);
        setNutritionVoiceStarting(false);

        if (!shouldAnalyze) {
          if (isCurrentSession(sessionId) && !nutritionVoiceAnalyzing && !recorderFailed) {
            setNutritionVoiceFeedback("Нажмите кнопку и скажите, что съели.");
          }
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || configuredMimeType });
        const recordingDurationMs = Math.max(0, Date.now() - recorderStartedAt);
        analyzeNutritionVoiceAudio(blob, recorder.mimeType || configuredMimeType, sessionId, recordingDurationMs);
      };

      recorder.start();
      startVoiceRecordingLimit(sessionId);
      startVoiceSilenceLimit(sessionId);
      setNutritionVoiceRecording(true);
      setNutritionVoiceStarting(false);
      setNutritionVoiceFeedback("Говорите…");

    } catch (error) {
      stopVoiceStream(stream);
      if (!isCurrentSession(sessionId)) return;

      const SpeechRecognition = getSpeechRecognitionConstructor();
      if (SpeechRecognition) {
        setNutritionVoiceStarting(false);
        startSpeechRecognitionCapture(sessionId);
        return;
      }
      setNutritionVoiceRecording(false);
      setNutritionVoiceStarting(false);
      setNutritionVoiceFeedback(getVoiceRecordingErrorMessage(error));
    } finally {
      nutritionVoiceStartingRef.current = false;
    }
  }

  function stopNutritionVoiceCapture({ cancelled = false } = {}) {
    clearVoiceRecordingLimit();
    clearVoiceSilenceLimit();
    const recorder = nutritionVoiceRecorderRef.current;
    const recognition = nutritionVoiceRecognitionRef.current;

    if (!cancelled && nutritionVoiceStartingRef.current && !recorder && !recognition) {
      nutritionVoiceSessionIdRef.current += 1;
      nutritionVoiceReleaseRequestedRef.current = false;
      nutritionVoiceStartingRef.current = false;
      setNutritionVoiceRecording(false);
      setNutritionVoiceStarting(false);
      setNutritionVoiceFeedback("Запись отменена. Нажмите кнопку, когда будете готовы говорить.");
      return;
    }

    if (cancelled) {
      nutritionVoiceSessionIdRef.current += 1;
      nutritionVoiceReleaseRequestedRef.current = false;
      nutritionVoiceTranscriptRef.current = "";
      nutritionVoiceChunksRef.current = [];

      const abortController = nutritionVoiceAbortControllerRef.current;
      nutritionVoiceAbortControllerRef.current = null;
      abortController?.abort();

      nutritionVoiceRecognitionRef.current = null;
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        try {
          recognition.abort();
        } catch {
          // A recognizer can already be closed while the sheet is closing.
        }
      }

      nutritionVoiceRecorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // The recorder can already have stopped after a browser interruption.
        }
      }
      stopVoiceStream(nutritionVoiceStreamRef.current);
      nutritionVoiceStreamRef.current = null;
      setNutritionVoiceRecording(false);
      setNutritionVoiceStarting(false);
      setNutritionVoiceAnalyzing(false);
      return;
    }

    nutritionVoiceReleaseRequestedRef.current = true;
    if (recorder) {
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          setNutritionVoiceRecording(false);
        }
      }
      return;
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        nutritionVoiceRecognitionRef.current = null;
        nutritionVoiceReleaseRequestedRef.current = false;
        setNutritionVoiceRecording(false);
        setNutritionVoiceStarting(false);
      }
    }
  }

  function toggleNutritionVoiceMode() {
    const nextMode = !nutritionVoiceMode;
    if (!nextMode) {
      stopNutritionVoiceCapture({ cancelled: true });
    }
    setNutritionVoiceMode(nextMode);
    setNutritionVoiceFeedback(nextMode ? "Голосовой ввод включён." : "Голосовой ввод выключен.");

    try {
      getWindow()?.localStorage?.setItem(
        NUTRITION_VOICE_MODE_STORAGE_KEY,
        nextMode ? "enabled" : "disabled"
      );
    } catch {
      // The test mode remains available for the current session if storage is unavailable.
    }
  }

  function startNutritionVoiceCapture() {
    if (
      nutritionVoiceAnalyzing ||
      nutritionVoiceRecognitionRef.current ||
      nutritionVoiceRecorderRef.current ||
      nutritionVoiceStartingRef.current
    ) return;

    const sessionId = nutritionVoiceSessionIdRef.current + 1;
    clearVoiceRecordingLimit();
    clearVoiceSilenceLimit();
    nutritionVoiceSessionIdRef.current = sessionId;
    nutritionVoiceTranscriptRef.current = "";
    nutritionVoiceChunksRef.current = [];
    nutritionVoiceReleaseRequestedRef.current = false;
    setNutritionVoiceAddedItems([]);
    setNutritionVoiceStarting(true);

    if (supportsVoiceAudioRecording()) {
      startRecordedVoiceCapture(sessionId);
      return;
    }

    startSpeechRecognitionCapture(sessionId);
  }

  return {
    startNutritionVoiceCapture,
    stopNutritionVoiceCapture,
    toggleNutritionVoiceMode
  };
}
