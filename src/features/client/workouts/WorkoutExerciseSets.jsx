import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Pause, Play } from "lucide";
import MorphingIcon from "../../../shared/ui/MorphingIcon";
import { useModalBackNavigation } from "../../../shared/hooks/useModalBackNavigation";
import {
  createWorkoutCountdownDeadline,
  getWorkoutCountdownRemainingSeconds
} from "./workoutCountdownTimer";
import styles from "./WorkoutExerciseSets.module.css";
import { canToggleWorkoutSetCompleted } from "../../../utils/workoutSetSequence";

const WHEEL_ITEM_HEIGHT = 42;
const REPS_SLIDER_MIN = 1;
const REPS_SLIDER_STEP = 1;
const REPS_SLIDER_FLOOR_MAX = 30;
const REPS_SLIDER_PADDING = 10;
const WEIGHT_SLIDER_MIN = 0;
const WEIGHT_SLIDER_STEP = 0.5;
const WEIGHT_SLIDER_FLOOR_MAX = 120;
const WEIGHT_SLIDER_PADDING = 40;

function getPlannedValue(actualValue, plannedValue) {
  if (actualValue !== undefined && actualValue !== null && String(actualValue).trim() !== "") {
    return String(actualValue);
  }

  if (plannedValue !== undefined && plannedValue !== null && String(plannedValue).trim() !== "") {
    return String(plannedValue);
  }

  return "";
}

function getTimedSetDurationSeconds(exercise, set) {
  const isPlank = String(exercise?.name || "").toLocaleLowerCase("ru").includes("планка");
  const sourceValue = set?.durationSeconds ?? (isPlank ? set?.reps : 0);
  const durationSeconds = Number.parseInt(String(sourceValue || ""), 10);

  return Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.min(600, Math.max(10, durationSeconds))
    : 0;
}

function formatTimedSetDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return minutes ? `${minutes}:${String(remainingSeconds).padStart(2, "0")}` : `${remainingSeconds} сек`;
}

function parseNumericValue(value, fallbackValue) {
  const parsedValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function clampNumericValue(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function formatWeightValue(value) {
  const roundedValue = Math.round(value * 2) / 2;
  return Number.isInteger(roundedValue) ? String(roundedValue) : roundedValue.toFixed(1);
}

function buildSetSliderState(value, plannedValue, config) {
  const fallbackValue = parseNumericValue(plannedValue, config.defaultValue);
  const currentValue = parseNumericValue(value, fallbackValue);
  const maxGrowthStep = config.rangeStep || config.step;
  const maxValue = Math.max(
    config.floorMax,
    Math.ceil((currentValue + config.padding) / maxGrowthStep) * maxGrowthStep
  );
  const clampedValue = clampNumericValue(currentValue, config.min, maxValue);

  return {
    min: config.min,
    max: maxValue,
    step: config.step,
    value: clampedValue
  };
}

function getRepsSliderState(value, plannedValue) {
  return buildSetSliderState(value, plannedValue, {
    min: REPS_SLIDER_MIN,
    step: REPS_SLIDER_STEP,
    floorMax: REPS_SLIDER_FLOOR_MAX,
    padding: REPS_SLIDER_PADDING,
    defaultValue: 10
  });
}

function getWeightSliderState(value, plannedValue) {
  return buildSetSliderState(value, plannedValue, {
    min: WEIGHT_SLIDER_MIN,
    step: WEIGHT_SLIDER_STEP,
    floorMax: WEIGHT_SLIDER_FLOOR_MAX,
    padding: WEIGHT_SLIDER_PADDING,
    rangeStep: 40,
    defaultValue: 0
  });
}

function buildWheelOptions({ min, max, step }, formatter = String) {
  const optionCount = Math.round((max - min) / step);

  return Array.from({ length: optionCount + 1 }, (_, index) => {
    const value = Math.round((min + index * step) * 10) / 10;
    return {
      value,
      label: formatter(value)
    };
  });
}

function isSameWheelValue(leftValue, rightValue) {
  return Math.abs(Number(leftValue) - Number(rightValue)) < 0.001;
}

function getWheelItemHeight(element) {
  return element?.querySelector('[role="option"]')?.getBoundingClientRect().height || WHEEL_ITEM_HEIGHT;
}

function scrollWheelToValue(element, options, value, behavior = "auto") {
  if (!element) {
    return;
  }

  const selectedIndex = options.findIndex((option) => isSameWheelValue(option.value, value));
  if (selectedIndex < 0) {
    return;
  }

  element.scrollTo({
    top: selectedIndex * getWheelItemHeight(element),
    behavior
  });
}

function getWheelValueFromScroll(scrollTop, options, itemHeight) {
  const index = clampNumericValue(Math.round(scrollTop / itemHeight), 0, options.length - 1);
  return options[index]?.value;
}

export default function WorkoutExerciseSets({
  exercise,
  hasExternalWeight,
  onToggleSetCompleted,
  onUpdateSet,
  sharedExerciseAiWeightAdjustment,
  showTitle = true,
  visibleSetIndexes = null,
  singleSet = false,
  primaryAction = false,
  selectedSetIndex: controlledSetIndex = null,
  onSelectSet,
  completionControlRef,
  headerAccessory = null,
  planLabel = "План подхода"
}) {
  const metricsDescriptionId = useId();
  const [selectedSet, setSelectedSet] = useState(() => {
    const indexes = Array.isArray(visibleSetIndexes) ? visibleSetIndexes : exercise.sets.map((_, index) => index);
    return { exerciseId: exercise.id, index: indexes.find((index) => !exercise.sets[index]?.completed) ?? indexes.at(-1) ?? 0 };
  });
  const setGestureRef = useRef(null);
  const suppressSetClickRef = useRef(0);
  const setPickerRef = useRef(null);
  const completionMenuRef = useRef(null);
  const [editingSetDraft, setEditingSetDraft] = useState(null);
  const [activeTimedSet, setActiveTimedSet] = useState(null);
  const [pausedTimedSet, setPausedTimedSet] = useState(null);
  const [timedSetSeconds, setTimedSetSeconds] = useState(0);
  const completedTimedSetRef = useRef("");
  const repsWheelRef = useRef(null);
  const weightWheelRef = useRef(null);
  const wheelScrollFrameRef = useRef({ reps: null, weight: null });
  const wheelSnapTimeoutRef = useRef({ reps: null, weight: null });
  const initializedWheelKeyRef = useRef("");
  useEffect(() => {
    if (!singleSet) return undefined;
    const closeOutsidePicker = (event) => {
      [setPickerRef.current, completionMenuRef.current].forEach((picker) => {
        if (picker?.open && !picker.contains(event.target)) picker.open = false;
      });
    };
    document.addEventListener("pointerdown", closeOutsidePicker, true);
    return () => document.removeEventListener("pointerdown", closeOutsidePicker, true);
  }, [singleSet]);
  const editingSetIndex = editingSetDraft?.index ?? null;
  const editingSet = editingSetIndex !== null ? exercise.sets[editingSetIndex] : null;
  const editingSetKey = editingSetIndex !== null ? `${exercise.id}:${editingSetIndex}` : "";
  const editingDraftReps = editingSetDraft?.reps;
  const editingDraftWeight = editingSetDraft?.weight;
  const repsSliderState = useMemo(
    () => (editingSetIndex !== null ? getRepsSliderState(editingDraftReps, editingSet?.reps) : null),
    [editingSetIndex, editingDraftReps, editingSet?.reps]
  );
  const weightSliderState = useMemo(
    () => (editingSetIndex !== null ? getWeightSliderState(editingDraftWeight, editingSet?.weight) : null),
    [editingSetIndex, editingDraftWeight, editingSet?.weight]
  );
  const repsWheelMin = repsSliderState?.min;
  const repsWheelMax = repsSliderState?.max;
  const repsWheelStep = repsSliderState?.step;
  const repsWheelOptions = useMemo(
    () => (repsWheelMin !== undefined
      ? buildWheelOptions({ min: repsWheelMin, max: repsWheelMax, step: repsWheelStep }, (value) => String(Math.round(value)))
      : []),
    [repsWheelMin, repsWheelMax, repsWheelStep]
  );
  const weightWheelMin = weightSliderState?.min;
  const weightWheelMax = weightSliderState?.max;
  const weightWheelStep = weightSliderState?.step;
  const weightWheelOptions = useMemo(
    () => (weightWheelMin !== undefined
      ? buildWheelOptions({ min: weightWheelMin, max: weightWheelMax, step: weightWheelStep }, formatWeightValue)
      : []),
    [weightWheelMin, weightWheelMax, weightWheelStep]
  );

  const clearWheelSettleWork = useCallback(() => {
    Object.values(wheelScrollFrameRef.current).forEach((frameId) => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    });

    Object.values(wheelSnapTimeoutRef.current).forEach((timeoutId) => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    });

    wheelScrollFrameRef.current = { reps: null, weight: null };
    wheelSnapTimeoutRef.current = { reps: null, weight: null };
  }, []);

  useEffect(() => {
    if (!editingSetKey || !repsSliderState || initializedWheelKeyRef.current === editingSetKey) {
      return;
    }

    initializedWheelKeyRef.current = editingSetKey;
    window.requestAnimationFrame(() => {
      scrollWheelToValue(repsWheelRef.current, repsWheelOptions, repsSliderState.value);
      if (weightSliderState) {
        scrollWheelToValue(weightWheelRef.current, weightWheelOptions, weightSliderState.value);
      }
    });
  }, [editingSetKey, repsSliderState, repsWheelOptions, weightSliderState, weightWheelOptions]);

  useEffect(() => () => {
    clearWheelSettleWork();
  }, [clearWheelSettleWork]);

  useEffect(() => {
    const deadline = Number(activeTimedSet?.deadline);
    const hasActiveTimedSet = Number.isInteger(activeTimedSet?.index);
    if (!hasActiveTimedSet || !Number.isFinite(deadline) || deadline <= 0) {
      return undefined;
    }

    const timedSetIndex = activeTimedSet.index;
    let completed = false;
    const syncTimedSetTimer = () => {
      if (exercise.sets[timedSetIndex]?.completed || !canToggleWorkoutSetCompleted(exercise.sets, timedSetIndex)) {
        completed = true;
        setActiveTimedSet(null);
        setPausedTimedSet(null);
        setTimedSetSeconds(0);
        return;
      }
      const remainingSeconds = getWorkoutCountdownRemainingSeconds(deadline);
      setTimedSetSeconds((current) => (current === remainingSeconds ? current : remainingSeconds));

      if (remainingSeconds > 0 || completed) return;

      completed = true;
      setActiveTimedSet(null);
      setPausedTimedSet(null);
      // Parent updates can restart this effect before the completion state
      // commits. The same timer must never toggle a completed set back off.
      const completionKey = `${exercise.id}:${timedSetIndex}:${deadline}`;
      if (completedTimedSetRef.current === completionKey) return;
      completedTimedSetRef.current = completionKey;
      onToggleSetCompleted(exercise.id, timedSetIndex);
      navigator.vibrate?.([80, 50, 80]);
    };

    syncTimedSetTimer();
    const timer = window.setInterval(syncTimedSetTimer, 1000);
    document.addEventListener("visibilitychange", syncTimedSetTimer);
    window.addEventListener("focus", syncTimedSetTimer);
    window.addEventListener("pageshow", syncTimedSetTimer);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncTimedSetTimer);
      window.removeEventListener("focus", syncTimedSetTimer);
      window.removeEventListener("pageshow", syncTimedSetTimer);
    };
  }, [activeTimedSet?.deadline, activeTimedSet?.index, exercise.id, exercise.sets, onToggleSetCompleted]);

  function closeEditModal() {
    clearWheelSettleWork();
    initializedWheelKeyRef.current = "";
    setEditingSetDraft(null);
  }

  useModalBackNavigation({ open: Boolean(editingSet), onBack: closeEditModal });

  function saveEditModal() {
    if (!editingSetDraft) {
      return;
    }

    onUpdateSet(exercise.id, editingSetDraft.index, "enteredReps", editingSetDraft.reps.replace(/[^0-9]/g, ""));

    if (hasExternalWeight) {
      onUpdateSet(
        exercise.id,
        editingSetDraft.index,
        "enteredWeight",
        editingSetDraft.weight
          .replace(/[^0-9.,]/g, "")
          .replace(",", ".")
      );
    }

    closeEditModal();
  }

  const toggleSetCompleted = useCallback((index) => {
    if (!canToggleWorkoutSetCompleted(exercise.sets, index)) return;
    if (activeTimedSet?.index === index) {
      const completionKey = `${exercise.id}:${index}:${activeTimedSet.deadline}`;
      if (completedTimedSetRef.current === completionKey) return;
      completedTimedSetRef.current = completionKey;
      setActiveTimedSet(null);
      setTimedSetSeconds(0);
    }
    if (pausedTimedSet?.index === index) {
      setPausedTimedSet(null);
      setTimedSetSeconds(0);
    }
    onToggleSetCompleted(exercise.id, index);
  }, [activeTimedSet, exercise.id, exercise.sets, onToggleSetCompleted, pausedTimedSet]);

  // The dock uses the same completion path as the row, including cancellation
  // of running/paused timed sets and its late-timer duplicate guard.
  useImperativeHandle(completionControlRef, () => ({ toggleSetCompleted }), [toggleSetCompleted]);

  function toggleTimedSetTimer(index, durationSeconds) {
    if (exercise.sets[index]?.completed || !canToggleWorkoutSetCompleted(exercise.sets, index)) return;
    if (activeTimedSet?.index === index) {
      const remainingSeconds = getWorkoutCountdownRemainingSeconds(activeTimedSet.deadline);
      setActiveTimedSet(null);
      if (!remainingSeconds) {
        setPausedTimedSet(null);
        setTimedSetSeconds(0);
        const completionKey = `${exercise.id}:${index}:${activeTimedSet.deadline}`;
        if (completedTimedSetRef.current === completionKey) return;
        completedTimedSetRef.current = completionKey;
        onToggleSetCompleted(exercise.id, index);
        navigator.vibrate?.([80, 50, 80]);
        return;
      }
      setPausedTimedSet({ index, seconds: remainingSeconds });
      setTimedSetSeconds(remainingSeconds);
      return;
    }

    const resumeSeconds = pausedTimedSet?.index === index
      ? pausedTimedSet.seconds
      : durationSeconds;
    const nextSeconds = Math.max(0, Number(resumeSeconds) || 0);

    if (!nextSeconds) {
      setPausedTimedSet(null);
      return;
    }

    setTimedSetSeconds(nextSeconds);
    setPausedTimedSet(null);
    completedTimedSetRef.current = "";
    setActiveTimedSet({
      index,
      deadline: createWorkoutCountdownDeadline(nextSeconds)
    });
  }

  const visibleSets = (Array.isArray(visibleSetIndexes)
    ? visibleSetIndexes
    : exercise.sets.map((_, index) => index)
  )
    .map((index) => ({ index, set: exercise.sets[index] }))
    .filter(({ set }) => Boolean(set));
  const selectedSetIndex = Number.isInteger(controlledSetIndex) && visibleSets.some(({ index }) => index === controlledSetIndex)
    ? controlledSetIndex
    : selectedSet.exerciseId === exercise.id && visibleSets.some(({ index }) => index === selectedSet.index)
    ? selectedSet.index
    : (visibleSets.find(({ set }) => !set.completed) || visibleSets.at(-1))?.index;
  const selectedPosition = visibleSets.findIndex(({ index }) => index === selectedSetIndex);
  const displayedSets = singleSet ? visibleSets.filter(({ index }) => index === selectedSetIndex) : visibleSets;
  const setSelectionCaption = displayedSets.some(({ index }) => !canToggleWorkoutSetCompleted(exercise.sets, index))
    ? exercise.sets[selectedSetIndex]?.completed
      ? primaryAction ? "Просмотр выполненного подхода" : "Отмените последний подход"
      : `Сначала подход ${exercise.sets.findIndex((set) => !set.completed) + 1}`
    : `Выполнено ${exercise.sets.filter((set) => set.completed).length} из ${exercise.sets.length}`;
  const selectedSetCompleted = Boolean(exercise.sets[selectedSetIndex]?.completed);
  const selectedSetStatus = selectedSetCompleted
    ? "Выполнен"
    : canToggleWorkoutSetCompleted(exercise.sets, selectedSetIndex)
      ? "Нужно выполнить"
      : setSelectionCaption;

  function selectSet(index) {
    if (!visibleSets.some((item) => item.index === index)) return;
    const firstPendingIndex = exercise.sets.findIndex((set) => !set.completed);
    if (primaryAction && firstPendingIndex >= 0 && index > firstPendingIndex) return;
    setSelectedSet({ exerciseId: exercise.id, index });
    onSelectSet?.(index);
  }

  function moveSelectedSet(direction) {
    const next = visibleSets[selectedPosition + direction];
    if (next) selectSet(next.index);
  }

  function closeSetPicker() {
    if (!setPickerRef.current) return;
    setPickerRef.current.open = false;
    setPickerRef.current.querySelector("summary")?.focus({ preventScroll: true });
  }

  function closeCompletionMenu(restoreFocus = false) {
    const menu = completionMenuRef.current;
    if (!menu) return;
    menu.open = false;
    if (restoreFocus) menu.querySelector("summary")?.focus({ preventScroll: true });
  }

  function startSetGesture(event) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      setGestureRef.current = null;
      suppressSetClickRef.current = event.timeStamp + 500;
      return;
    }
    suppressSetClickRef.current = 0;
    setGestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }

  function moveSetGesture(event) {
    const gesture = setGestureRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
    gesture.moved = true;
    if (Math.abs(dy) > Math.abs(dx) * 1.25) {
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  }

  function endSetGesture(event) {
    const gesture = setGestureRef.current;
    setGestureRef.current = null;
    if (!gesture || gesture.id !== event.pointerId || !gesture.moved) return;
    suppressSetClickRef.current = event.timeStamp + 500;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dy) >= 32 && Math.abs(dy) > Math.abs(dx) * 1.25) moveSelectedSet(dy < 0 ? 1 : -1);
  }

  function setRepsFromWheel(value) {
    const nextReps = String(Math.round(Number(value)));
    setEditingSetDraft((draft) => (
      draft && draft.reps !== nextReps ? { ...draft, reps: nextReps } : draft
    ));
  }

  function setWeightFromWheel(value) {
    const nextWeight = formatWeightValue(Number(value));
    setEditingSetDraft((draft) => (
      draft && draft.weight !== nextWeight ? { ...draft, weight: nextWeight } : draft
    ));
  }

  function handleWheelScroll(event, options, field) {
    const element = event.currentTarget;
    const nextValue = getWheelValueFromScroll(element.scrollTop, options, getWheelItemHeight(element));

    if (nextValue === undefined) {
      return;
    }

    if (wheelScrollFrameRef.current[field] !== null) {
      window.cancelAnimationFrame(wheelScrollFrameRef.current[field]);
    }

    wheelScrollFrameRef.current[field] = window.requestAnimationFrame(() => {
      if (field === "reps") {
        setRepsFromWheel(nextValue);
      } else {
        setWeightFromWheel(nextValue);
      }

      wheelScrollFrameRef.current[field] = null;
    });

    if (wheelSnapTimeoutRef.current[field] !== null) {
      window.clearTimeout(wheelSnapTimeoutRef.current[field]);
    }

    wheelSnapTimeoutRef.current[field] = window.setTimeout(() => {
      const settledValue = getWheelValueFromScroll(element.scrollTop, options, getWheelItemHeight(element));

      if (settledValue === undefined) {
        return;
      }

      if (field === "reps") {
        setRepsFromWheel(settledValue);
      } else {
        setWeightFromWheel(settledValue);
      }

      const settledIndex = options.findIndex((option) => isSameWheelValue(option.value, settledValue));
      const settledScrollTop = settledIndex * getWheelItemHeight(element);

      // A hard swipe can stop between snap points on mobile. Align once after it settles,
      // without starting a second smooth scroll that would fight the user's gesture.
      if (Math.abs(element.scrollTop - settledScrollTop) > 1) {
        scrollWheelToValue(element, options, settledValue);
      }

      wheelSnapTimeoutRef.current[field] = null;
    }, 140);
  }

  return (
    <section
      className={`${styles.root} ${singleSet ? styles.singleSet : ""} ${primaryAction ? styles.primaryActionSets : ""}`}
      data-testid="workout-exercise-sets"
      data-css-module-scope="workout-exercise-sets"
      onKeyDown={singleSet ? (event) => {
        if (event.target.closest('[data-modal-surface], details[open], [data-workout-set-accessory]')) return;
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          moveSelectedSet(event.key === "ArrowDown" ? 1 : -1);
          setPickerRef.current?.querySelector("summary")?.focus({ preventScroll: true });
        }
      } : undefined}
    >
      {showTitle && <div className={styles.title}>План на сегодня</div>}
      {singleSet && visibleSets.length > 0 ? (
        <nav className={`${styles.setNavigation} ${headerAccessory ? styles.withAccessory : ""}`} aria-label="Выбор подхода">
          {!primaryAction && <button type="button" className={styles.setArrow} aria-label="Предыдущий подход" disabled={selectedPosition <= 0} onClick={() => moveSelectedSet(-1)}><ChevronUp size={20} aria-hidden="true" /></button>}
          <details ref={setPickerRef} className={styles.setPicker} onBlur={(event) => {
            // WebKit may not focus a tapped option. A null relatedTarget must
            // not remove it before its click; outside pointerdown closes it.
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }} onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); closeSetPicker(); }
          }}>
            <summary role="button" aria-label={`Все подходы, выбран подход ${selectedSetIndex + 1} из ${exercise.sets.length}`} aria-description={setSelectionCaption}>
              <span className={styles.setPickerCopy}>
                <span className={styles.setPickerLabel}>
                  <span aria-live="polite" aria-atomic="true">Подход {selectedSetIndex + 1} из {exercise.sets.length}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
                {primaryAction ? <span
                  className={`${styles.setCaption} ${styles.setStatus} ${selectedSetCompleted ? styles.setStatusCompleted : ""}`}
                  data-testid="workout-set-status"
                  role="status"
                  aria-label={`Подход ${selectedSetIndex + 1}: ${selectedSetStatus.toLocaleLowerCase("ru-RU")}`}
                >
                  {selectedSetCompleted && <Check size={12} aria-hidden="true" />}
                  {selectedSetStatus}
                </span> : <span className={setSelectionCaption.startsWith("Выполнено ") ? styles.srOnly : styles.setCaption} role="status">{setSelectionCaption}</span>}
              </span>
            </summary>
            <div className={styles.setOptions}>
              {visibleSets.map(({ set, index }) => <button type="button" key={index} disabled={primaryAction && !set.completed && !canToggleWorkoutSetCompleted(exercise.sets, index)} aria-label={`Перейти к подходу ${index + 1}`} aria-current={index === selectedSetIndex ? "true" : undefined} onClick={() => { selectSet(index); closeSetPicker(); }}><span>Подход {index + 1}</span><span>{set.completed ? <Check size={18} aria-label="Выполнен" /> : "Не выполнен"}</span></button>)}
            </div>
          </details>
          {!primaryAction && <button type="button" className={styles.setArrow} aria-label="Следующий подход" disabled={selectedPosition >= visibleSets.length - 1} onClick={() => moveSelectedSet(1)}><ChevronDown size={20} aria-hidden="true" /></button>}
          {headerAccessory}
        </nav>
      ) : <div className={styles.columnLabels} aria-hidden="true"><span>№</span><span>{hasExternalWeight ? "Вес / повторы" : "Повторы / время"}</span></div>}
      <div className={styles.list}>
        {displayedSets.map(({ set, index }) => {
          const durationSeconds = getTimedSetDurationSeconds(exercise, set);
          const isTimedSet = durationSeconds > 0;
          const isTimedSetRunning = activeTimedSet?.index === index;
          const isTimedSetPaused = pausedTimedSet?.index === index;
          const shownTimedSetSeconds = isTimedSetRunning
            ? timedSetSeconds
            : isTimedSetPaused
              ? pausedTimedSet.seconds
              : durationSeconds;
          const repsValue = getPlannedValue(set.enteredReps, set.reps);
          const weightValue = getPlannedValue(set.enteredWeight, set.weight);
          const unifiedMetrics = singleSet && primaryAction && !isTimedSet;
          const hasEnteredValues = [set.enteredReps, set.enteredWeight]
            .some((value) => value != null && String(value).trim() !== "");
          const isStartingWeightEstimate = hasExternalWeight
            && set.startingWeightSource === "estimate"
            && !set.startingWeightConfirmed;
          const canToggleCompleted = canToggleWorkoutSetCompleted(exercise.sets, index);
          const completionHint = canToggleCompleted
            ? set.completed ? "Снять отметку о выполнении" : "Подтвердить выполнение подхода"
            : set.completed
              ? "Сначала снимите отметку с последнего выполненного подхода"
              : `Сначала выполните подход ${exercise.sets.findIndex((item) => !item.completed) + 1}`;
          const planContent = <>
            {isTimedSet ? (
              <strong className={styles.weight}>{formatTimedSetDuration(shownTimedSetSeconds)} <small>на время</small></strong>
            ) : <>
              {hasExternalWeight && <strong className={styles.weight}>{weightValue ? String(weightValue).replace(".", ",") : "—"} <small>кг</small></strong>}
              {hasExternalWeight && <span className={styles.times}>×</span>}
              <strong className={styles.weight}>{repsValue || "—"}{!hasExternalWeight && <small> повт.</small>}</strong>
            </>}
            {isStartingWeightEstimate && <span className={styles.srOnly}>Стартовый вес — ориентир</span>}
            {isTimedSetRunning && <span className={styles.srOnly}>Таймер идёт</span>}
          </>;

          return (
            <div
              data-testid="workout-exercise-set-row"
              className={`${styles.row} ${set.completed ? styles.completed : ""} ${!canToggleCompleted ? styles.locked : ""} ${isTimedSet ? styles.timedRow : ""} ${unifiedMetrics ? styles.unifiedMetricsRow : ""}`}
              key={`${exercise.id}:${index}`}
              onClick={singleSet ? undefined : () => toggleSetCompleted(index)}
              onPointerDown={singleSet ? startSetGesture : undefined}
              onPointerMove={singleSet ? moveSetGesture : undefined}
              onPointerUp={singleSet ? endSetGesture : undefined}
              onPointerCancel={singleSet ? (event) => { setGestureRef.current = null; suppressSetClickRef.current = event.timeStamp + 500; } : undefined}
              onClickCapture={singleSet ? (event) => {
                if (event.timeStamp < suppressSetClickRef.current) { event.preventDefault(); event.stopPropagation(); }
              } : undefined}
            >
              <span
                className={styles.number}
                aria-hidden="true"
                aria-label={set.completed ? `Снять отметку с подхода ${index + 1}` : `Отметить подход ${index + 1}`}
              >
                {index + 1}
              </span>

              {unifiedMetrics ? (
                <button
                  type="button"
                  className={styles.metricsButton}
                  data-css-module-control="workout-exercise-sets"
                  aria-label={`Изменить подход ${index + 1}`}
                  aria-describedby={`${metricsDescriptionId}-${index}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingSetDraft({ index, reps: repsValue || "10", weight: weightValue || "0" });
                  }}
                >
                  <span id={`${metricsDescriptionId}-${index}`} className={styles.metricsCopy}>
                    <span className={styles.metricsLabel}>{set.completed ? "Результат подхода" : hasEnteredValues ? "Твои значения" : planLabel}</span>
                    <span className={styles.plan}>{planContent}</span>
                  </span>
                  {!set.completed && <Pencil size={20} strokeWidth={1.65} aria-hidden="true" />}
                </button>
              ) : <>
              <div className={styles.actions}>
                {isTimedSet ? (
                  <button
                    type="button"
                    className={`${styles.timerButton}${isTimedSetRunning ? ` ${styles.timerButtonActive}` : ""}`}
                    data-css-module-control="workout-exercise-sets"
                    data-testid="workout-timed-set-timer"
                    data-running={isTimedSetRunning}
                    disabled={Boolean(set.completed) || !canToggleCompleted}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleTimedSetTimer(index, durationSeconds);
                    }}
                    aria-label={isTimedSetRunning
                      ? `Поставить таймер подхода ${index + 1} на паузу`
                      : isTimedSetPaused
                        ? `Продолжить таймер подхода ${index + 1}`
                        : `Запустить таймер подхода ${index + 1} на ${formatTimedSetDuration(durationSeconds)}`}
                  >
                    <MorphingIcon
                      icon={isTimedSetRunning ? Pause : Play}
                      size={16}
                      data-icon-state={isTimedSetRunning ? "pause" : "play"}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.editButton}
                    data-css-module-control="workout-exercise-sets"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingSetDraft({
                        index,
                        reps: repsValue || "10",
                        weight: weightValue || "0"
                      });
                    }}
                    aria-label={`Изменить подход ${index + 1}`}
                  >
                    <Pencil size={18} strokeWidth={1.65} aria-hidden="true" />
                  </button>
                )}

              </div>

              <div className={styles.plan}>
                {planContent}
              </div>
              </>}

                {singleSet && primaryAction && set.completed ? (
                  <details
                    ref={completionMenuRef}
                    className={styles.completionMenu}
                    onPointerDown={(event) => event.stopPropagation()}
                    onBlur={(event) => {
                      // As in the set picker, a WebKit null relatedTarget must
                      // not remove a tapped action before its click arrives.
                      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeCompletionMenu();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        closeCompletionMenu(true);
                      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.open = true;
                        event.currentTarget.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
                      }
                    }}
                  >
                    <summary
                      role="button"
                      className={styles.completeButton}
                      aria-label={`Подход ${index + 1} выполнен, действия`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Check size={18} strokeWidth={2.1} aria-hidden="true" />
                      <span>Выполнен</span>
                      <ChevronDown size={14} aria-hidden="true" />
                    </summary>
                    <div className={styles.completionOptions}>
                      <button
                        type="button"
                        disabled={!canToggleCompleted}
                        aria-label={`Снять отметку выполнения подхода ${index + 1}`}
                        aria-description={completionHint}
                        onClick={(event) => {
                          event.stopPropagation();
                          closeCompletionMenu();
                          setPickerRef.current?.querySelector("summary")?.focus({ preventScroll: true });
                          toggleSetCompleted(index);
                        }}
                      >
                        Снять отметку выполнения
                      </button>
                      {!canToggleCompleted && <small>{completionHint}</small>}
                    </div>
                  </details>
                ) : (!primaryAction || set.completed) ? <button
                  type="button"
                  className={styles.completeButton}
                  aria-label={primaryAction ? `Отменить выполнение подхода ${index + 1}` : set.completed ? `Подход ${index + 1} выполнен` : `Выполнить подход ${index + 1}`}
                  aria-pressed={Boolean(set.completed)}
                  disabled={!canToggleCompleted}
                  title={completionHint}
                  aria-description={completionHint}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (singleSet) selectSet(index);
                    toggleSetCompleted(index);
                  }}
                >
                  <Check size={24} strokeWidth={2.1} aria-hidden="true" />
                  {singleSet && <span>{primaryAction ? "Отменить" : set.completed ? "Выполнен" : "Готово"}</span>}
                </button> : !unifiedMetrics && <span className={styles.pendingState}>План</span>}
            </div>
          );
        })}
      </div>
      {editingSet && (
        <div className={styles.modalBackdrop} data-modal-backdrop="true" role="presentation" onClick={closeEditModal}>
          <div
            data-testid="workout-set-edit-modal"
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            data-modal-surface="true"
            aria-label={`Редактировать подход ${editingSetIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <span>Подход {editingSetIndex + 1}</span>
                <strong>Редактировать</strong>
              </div>
              <button
                className={styles.closeButton}
                data-css-module-control="workout-exercise-sets"
                type="button"
                onClick={closeEditModal}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className={`${styles.modalFields} ${hasExternalWeight ? "" : styles.withoutWeight}`}>
              {hasExternalWeight && (
                <div className={styles.wheelField}>
                  <span>Вес, кг</span>
                  <div
                    data-testid="workout-set-wheel-picker"
                    ref={weightWheelRef}
                    className={styles.wheelPicker}
                    role="listbox"
                    tabIndex={0}
                    aria-label={`Вес, подход ${editingSetIndex + 1}`}
                    onScroll={(event) => handleWheelScroll(event, weightWheelOptions, "weight")}
                  >
                    {weightWheelOptions.map((option) => {
                      const active = isSameWheelValue(option.value, weightSliderState.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`${styles.wheelOption} ${active ? styles.active : ""}`}
                          data-css-module-control="workout-exercise-sets"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setWeightFromWheel(option.value);
                            scrollWheelToValue(weightWheelRef.current, weightWheelOptions, option.value, "smooth");
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className={styles.wheelField}>
                <span>Повторы</span>
                <div
                  data-testid="workout-set-wheel-picker"
                  ref={repsWheelRef}
                  className={styles.wheelPicker}
                  role="listbox"
                  tabIndex={0}
                  aria-label={`Повторы, подход ${editingSetIndex + 1}`}
                  onScroll={(event) => handleWheelScroll(event, repsWheelOptions, "reps")}
                >
                  {repsWheelOptions.map((option) => {
                    const active = isSameWheelValue(option.value, repsSliderState.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.wheelOption} ${active ? styles.active : ""}`}
                        data-css-module-control="workout-exercise-sets"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setRepsFromWheel(option.value);
                          scrollWheelToValue(repsWheelRef.current, repsWheelOptions, option.value, "smooth");
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            <button
              type="button"
              className={styles.doneButton}
              data-css-module-control="workout-exercise-sets"
              onClick={saveEditModal}
            >
              Готово
            </button>
          </div>
        </div>
      )}

      {sharedExerciseAiWeightAdjustment && (
        <small className={styles.sharedWeightNote}>
          Коррекция готовности: {sharedExerciseAiWeightAdjustment}
        </small>
      )}
    </section>
  );
}
