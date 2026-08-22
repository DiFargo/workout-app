import { useEffect, useRef, useState } from "react";
/* eslint-disable react-hooks/refs -- Event factory captures refs for delayed voice callbacks. */
import {
  createNutritionVoiceHandlers,
  loadNutritionVoiceMode
} from "./nutritionVoiceHandlers";
import { buildUpdatedNutritionVoiceItem } from "./nutritionVoiceItemEditor";

const VOICE_ACTIVITY_LEVEL = 0.06;

function getVoiceAudioContextConstructor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function getVoiceAudioLevel(samples) {
  if (!samples?.length) return 0;

  let squaredTotal = 0;
  for (const sample of samples) {
    const normalizedSample = (sample - 128) / 128;
    squaredTotal += normalizedSample * normalizedSample;
  }

  const rms = Math.sqrt(squaredTotal / samples.length);
  return Math.min(1, Math.max(0, (rms - 0.008) * 18));
}

export function useNutritionVoiceRuntime({
  addNutritionFood,
  endPerformanceCheck,
  nutritionMyFoods,
  saveNutritionFoodToMyDatabase,
  showAppError,
  startPerformanceCheck,
  updateNutritionDay
}) {
  const [nutritionVoiceMode, setNutritionVoiceMode] = useState(loadNutritionVoiceMode);
  const [nutritionVoiceRecording, setNutritionVoiceRecording] = useState(false);
  const [nutritionVoiceStarting, setNutritionVoiceStarting] = useState(false);
  const [nutritionVoiceAnalyzing, setNutritionVoiceAnalyzing] = useState(false);
  const [nutritionVoiceFeedback, setNutritionVoiceFeedback] = useState("");
  const [nutritionVoiceAddedItems, setNutritionVoiceAddedItems] = useState([]);
  const [nutritionVoiceAudioLevel, setNutritionVoiceAudioLevel] = useState(0);
  const nutritionVoiceAddedItemsRef = useRef([]);
  const nutritionVoiceAbortControllerRef = useRef(null);
  const nutritionVoiceChunksRef = useRef([]);
  const nutritionVoiceRecognitionRef = useRef(null);
  const nutritionVoiceRecorderRef = useRef(null);
  const nutritionVoiceRecordingTimerRef = useRef(null);
  const nutritionVoiceSilenceTimerRef = useRef(null);
  const nutritionVoiceLastActivityAtRef = useRef(0);
  const nutritionVoiceReleaseRequestedRef = useRef(false);
  const nutritionVoiceSessionIdRef = useRef(0);
  const nutritionVoiceStartingRef = useRef(false);
  const nutritionVoiceStreamRef = useRef(null);
  const nutritionVoiceTranscriptRef = useRef("");

  function setVoiceAddedItems(nextItems) {
    const resolvedItems = typeof nextItems === "function"
      ? nextItems(nutritionVoiceAddedItemsRef.current)
      : nextItems;
    const safeItems = Array.isArray(resolvedItems) ? resolvedItems : [];
    nutritionVoiceAddedItemsRef.current = safeItems;
    setNutritionVoiceAddedItems(safeItems);
  }

  useEffect(() => {
    const stream = nutritionVoiceStreamRef.current;
    if (!nutritionVoiceRecording || !stream) {
      setNutritionVoiceAudioLevel(0);
      return undefined;
    }

    const AudioContext = getVoiceAudioContextConstructor();
    if (!AudioContext || typeof window.requestAnimationFrame !== "function") {
      return undefined;
    }

    let audioContext = null;
    let animationFrameId = null;
    let disposed = false;
    let previousLevel = 0;
    let lastUpdateAt = 0;

    try {
      audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      const samples = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      audioContext.resume?.().catch(() => {});

      const updateLevel = (timestamp = 0) => {
        if (disposed) return;

        analyser.getByteTimeDomainData(samples);
        const detectedLevel = getVoiceAudioLevel(samples);
        if (detectedLevel >= VOICE_ACTIVITY_LEVEL) {
          nutritionVoiceLastActivityAtRef.current = Date.now();
        }
        const nextLevel = detectedLevel >= previousLevel
          ? detectedLevel
          : Math.max(detectedLevel, previousLevel * 0.78);

        if (timestamp - lastUpdateAt >= 70 || Math.abs(nextLevel - previousLevel) >= 0.12) {
          previousLevel = nextLevel;
          lastUpdateAt = timestamp;
          setNutritionVoiceAudioLevel(Math.round(nextLevel * 100) / 100);
        }
        animationFrameId = window.requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      animationFrameId = window.requestAnimationFrame(() => {
        if (!disposed) setNutritionVoiceAudioLevel(0);
      });
    }

    return () => {
      disposed = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame?.(animationFrameId);
      }
      audioContext?.close?.().catch(() => {});
    };
  }, [nutritionVoiceRecording]);

  useEffect(() => () => {
    nutritionVoiceSessionIdRef.current += 1;
    nutritionVoiceReleaseRequestedRef.current = false;
    if (nutritionVoiceRecordingTimerRef.current !== null) {
      window.clearTimeout(nutritionVoiceRecordingTimerRef.current);
      nutritionVoiceRecordingTimerRef.current = null;
    }
    if (nutritionVoiceSilenceTimerRef.current !== null) {
      window.clearTimeout(nutritionVoiceSilenceTimerRef.current);
      nutritionVoiceSilenceTimerRef.current = null;
    }
    nutritionVoiceAbortControllerRef.current?.abort();
    nutritionVoiceAbortControllerRef.current = null;

    const recognition = nutritionVoiceRecognitionRef.current;
    nutritionVoiceRecognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // A recognizer can already be closed while the app is unmounting.
      }
    }

    const recorder = nutritionVoiceRecorderRef.current;
    nutritionVoiceRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // A recorder can already be stopped while the app is unmounting.
      }
    }

    nutritionVoiceStreamRef.current?.getTracks?.().forEach((track) => {
      try {
        track.stop();
      } catch {
        // A track can already be stopped after device access changes.
      }
    });
    nutritionVoiceStreamRef.current = null;
    nutritionVoiceChunksRef.current = [];
    nutritionVoiceStartingRef.current = false;
  }, []);

  const {
    startNutritionVoiceCapture,
    stopNutritionVoiceCapture,
    toggleNutritionVoiceMode
  } = createNutritionVoiceHandlers({
    addNutritionFood,
    endPerformanceCheck,
    nutritionMyFoods,
    setNutritionVoiceAddedItems: setVoiceAddedItems,
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
    setNutritionVoiceFeedback,
    setNutritionVoiceMode,
    setNutritionVoiceRecording,
    setNutritionVoiceStarting
  });

  function removeNutritionVoiceAddedItem(itemId, selectedCandidateId = "") {
    const normalizedItemId = String(itemId || "");
    if (!normalizedItemId) return;

    const currentItems = nutritionVoiceAddedItemsRef.current;
    const candidateGroup = currentItems.find((item) => item?.id === normalizedItemId && item?.kind === "candidate");

    if (candidateGroup && selectedCandidateId) {
      const selectedCandidate = (candidateGroup.candidates || []).find((candidate) => (
        String(candidate?.id || candidate?.foodId || "") === String(selectedCandidateId)
      ));
      if (!selectedCandidate) return;

      let addedItem = null;
      const added = addNutritionFood(selectedCandidate, candidateGroup.mealId, candidateGroup.amount, {
        amountMode: candidateGroup.amountMode || "grams",
        expandMeal: false,
        onAdded: (entry) => {
          addedItem = entry;
        }
      });

      if (!added || !addedItem) return;
      setVoiceAddedItems((items) => items.map((item) => (
        item?.id === normalizedItemId ? addedItem : item
      )));
      setNutritionVoiceFeedback(`Добавлено из ${candidateGroup.candidateSourceLabel?.includes("вашей") ? "вашей базы" : "проверенной базы"}.`);
      return;
    }

    const reviewOrCandidate = currentItems.find((item) => (
      item?.id === normalizedItemId && (item?.kind === "review" || item?.kind === "candidate")
    ));
    if (reviewOrCandidate) {
      setVoiceAddedItems((items) => items.filter((item) => item?.id !== normalizedItemId));
      return;
    }

    updateNutritionDay?.((day) => ({
      ...day,
      foods: (day.foods || []).filter((item) => item.id !== normalizedItemId)
    }));
    setVoiceAddedItems((items) => items.filter((item) => item?.id !== normalizedItemId));
  }

  function updateNutritionVoiceAddedItem(itemId, draft) {
    const normalizedItemId = String(itemId || "");
    const currentItem = nutritionVoiceAddedItemsRef.current.find((item) => item?.id === normalizedItemId);
    const updatedItem = buildUpdatedNutritionVoiceItem(currentItem, draft);
    if (!currentItem || !updatedItem) return false;

    const savedToMyFoods = draft?.saveToMyFoods === true;
    if (savedToMyFoods && !saveNutritionFoodToMyDatabase?.(updatedItem.food, updatedItem.amount, {
      amountMode: "grams"
    })) {
      return false;
    }

    if (currentItem.kind !== "review") {
      updateNutritionDay?.((day) => ({
        ...day,
        foods: (day.foods || []).map((item) => (
          item.id === normalizedItemId ? updatedItem : item
        ))
      }));
    }

    setVoiceAddedItems((items) => items.map((item) => (
      item?.id === normalizedItemId ? updatedItem : item
    )));
    setNutritionVoiceFeedback(savedToMyFoods
      ? "Позиция обновлена и сохранена в вашей базе."
      : "Позиция обновлена. Проверьте её и добавьте в дневник.");
    return true;
  }

  function finishNutritionVoiceResult({ commit = true } = {}) {
    const pendingReviewItems = nutritionVoiceAddedItemsRef.current.filter((item) => item?.kind === "review");

    if (commit) {
      pendingReviewItems.forEach((item) => {
        addNutritionFood(item.food, item.mealId, item.amount, {
          amountMode: item.amountMode || "grams",
          note: item.note || "",
          expandMeal: false,
          saveToMyFoods: false
        });
      });
    }

    setVoiceAddedItems([]);
    setNutritionVoiceFeedback("");
  }

  return {
    finishNutritionVoiceResult,
    nutritionVoiceAddedItems,
    nutritionVoiceAnalyzing,
    nutritionVoiceAudioLevel,
    nutritionVoiceFeedback,
    nutritionVoiceMode,
    nutritionVoiceRecording,
    nutritionVoiceStarting,
    removeNutritionVoiceAddedItem,
    updateNutritionVoiceAddedItem,
    startNutritionVoiceCapture,
    stopNutritionVoiceCapture,
    toggleNutritionVoiceMode
  };
}
