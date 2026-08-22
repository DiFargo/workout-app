import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pause, Pencil, Play } from "lucide-react";
import {
  createWorkoutCountdownDeadline,
  getWorkoutCountdownRemainingSeconds
} from "./workoutCountdownTimer";
import styles from "./WorkoutExerciseSets.module.css";

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
  const maxValue = Math.max(
    config.floorMax,
    Math.ceil((currentValue + config.padding) / config.step) * config.step
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

function scrollWheelToValue(element, options, value, behavior = "auto") {
  if (!element) {
    return;
  }

  const selectedIndex = options.findIndex((option) => isSameWheelValue(option.value, value));
  if (selectedIndex < 0) {
    return;
  }

  element.scrollTo({
    top: selectedIndex * WHEEL_ITEM_HEIGHT,
    behavior
  });
}

function getWheelValueFromScroll(scrollTop, options) {
  const index = clampNumericValue(Math.round(scrollTop / WHEEL_ITEM_HEIGHT), 0, options.length - 1);
  return options[index]?.value;
}

export default function WorkoutExerciseSets({
  exercise,
  hasExternalWeight,
  onToggleSetCompleted,
  onUpdateSet,
  sharedExerciseAiWeightAdjustment,
  showTitle = true,
  visibleSetIndexes = null
}) {
  const [editingSetDraft, setEditingSetDraft] = useState(null);
  const [activeTimedSet, setActiveTimedSet] = useState(null);
  const [pausedTimedSet, setPausedTimedSet] = useState(null);
  const [timedSetSeconds, setTimedSetSeconds] = useState(0);
  const repsWheelRef = useRef(null);
  const weightWheelRef = useRef(null);
  const wheelScrollFrameRef = useRef({ reps: null, weight: null });
  const wheelSnapTimeoutRef = useRef({ reps: null, weight: null });
  const initializedWheelKeyRef = useRef("");
  const editingSetIndex = editingSetDraft?.index ?? null;
  const editingSet = editingSetIndex !== null ? exercise.sets[editingSetIndex] : null;
  const editingSetKey = editingSetIndex !== null ? `${exercise.id}:${editingSetIndex}` : "";
  const repsSliderState = useMemo(
    () => (editingSetDraft ? getRepsSliderState(editingSetDraft.reps, editingSet?.reps) : null),
    [editingSetDraft, editingSet?.reps]
  );
  const weightSliderState = useMemo(
    () => (editingSetDraft ? getWeightSliderState(editingSetDraft.weight, editingSet?.weight) : null),
    [editingSetDraft, editingSet?.weight]
  );
  const repsWheelOptions = useMemo(
    () => (repsSliderState ? buildWheelOptions(repsSliderState, (value) => String(Math.round(value))) : []),
    [repsSliderState]
  );
  const weightWheelOptions = useMemo(
    () => (weightSliderState ? buildWheelOptions(weightSliderState, formatWeightValue) : []),
    [weightSliderState]
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
      const remainingSeconds = getWorkoutCountdownRemainingSeconds(deadline);
      setTimedSetSeconds((current) => (current === remainingSeconds ? current : remainingSeconds));

      if (remainingSeconds > 0 || completed) return;

      completed = true;
      setActiveTimedSet(null);
      setPausedTimedSet(null);
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
  }, [activeTimedSet?.deadline, activeTimedSet?.index, exercise.id, onToggleSetCompleted]);

  function closeEditModal() {
    clearWheelSettleWork();
    initializedWheelKeyRef.current = "";
    setEditingSetDraft(null);
  }

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

  function handleSetRowKeyDown(event, index) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleSetCompleted(index);
  }

  function toggleSetCompleted(index) {
    if (activeTimedSet?.index === index) {
      setActiveTimedSet(null);
      setTimedSetSeconds(0);
    }
    if (pausedTimedSet?.index === index) {
      setPausedTimedSet(null);
      setTimedSetSeconds(0);
    }
    onToggleSetCompleted(exercise.id, index);
  }

  function toggleTimedSetTimer(index, durationSeconds) {
    if (activeTimedSet?.index === index) {
      const remainingSeconds = getWorkoutCountdownRemainingSeconds(activeTimedSet.deadline);
      setActiveTimedSet(null);
      if (!remainingSeconds) {
        setPausedTimedSet(null);
        setTimedSetSeconds(0);
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

  function setRepsFromWheel(value) {
    setEditingSetDraft((draft) => (draft ? { ...draft, reps: String(Math.round(Number(value))) } : draft));
  }

  function setWeightFromWheel(value) {
    setEditingSetDraft((draft) => (draft ? { ...draft, weight: formatWeightValue(Number(value)) } : draft));
  }

  function handleWheelScroll(event, options, field) {
    const element = event.currentTarget;
    const nextValue = getWheelValueFromScroll(element.scrollTop, options);

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
      const settledValue = getWheelValueFromScroll(element.scrollTop, options);

      if (settledValue === undefined) {
        return;
      }

      if (field === "reps") {
        setRepsFromWheel(settledValue);
      } else {
        setWeightFromWheel(settledValue);
      }

      const settledIndex = options.findIndex((option) => isSameWheelValue(option.value, settledValue));
      const settledScrollTop = settledIndex * WHEEL_ITEM_HEIGHT;

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
      className={styles.root}
      data-testid="workout-exercise-sets"
      data-css-module-scope="workout-exercise-sets"
    >
      {showTitle && <div className={styles.title}>План на сегодня</div>}
      <div className={styles.list}>
        {visibleSets.map(({ set, index }) => {
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
          const repsText = isTimedSet
            ? `${formatTimedSetDuration(shownTimedSetSeconds)} · на время`
            : repsValue ? `${repsValue} повторений` : "Повторы не указаны";
          const isStartingWeightEstimate = hasExternalWeight
            && set.startingWeightSource === "estimate"
            && !set.startingWeightConfirmed;
          const weightText = isTimedSet
            ? isTimedSetRunning ? "Таймер идёт" : "Упражнение на время"
            : hasExternalWeight
            ? (weightValue ? `${weightValue} кг` : "Вес не указан")
            : "Свой вес";

          return (
            <div
              data-testid="workout-exercise-set-row"
              className={`${styles.row} ${set.completed ? styles.completed : ""} ${isTimedSet ? styles.timedRow : ""}`}
              key={`${exercise.id}:${index}`}
              role="button"
              tabIndex={0}
              onClick={() => toggleSetCompleted(index)}
              onKeyDown={(event) => handleSetRowKeyDown(event, index)}
              aria-pressed={set.completed}
            >
              <span
                className={styles.number}
                aria-hidden="true"
                aria-label={set.completed ? `Снять отметку с подхода ${index + 1}` : `Отметить подход ${index + 1}`}
              >
                {index + 1}
              </span>

              <div className={styles.plan}>
                <span className={styles.reps}>
                  {repsText}{isStartingWeightEstimate ? <em className={styles.startingWeightLabel}>ориентир</em> : null}
                </span>
                <strong className={styles.weight}>{weightText}</strong>
              </div>

              <div className={styles.actions}>
                {isTimedSet ? (
                  <button
                    type="button"
                    className={`${styles.timerButton}${isTimedSetRunning ? ` ${styles.timerButtonActive}` : ""}`}
                    data-css-module-control="workout-exercise-sets"
                    data-testid="workout-timed-set-timer"
                    data-running={isTimedSetRunning}
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
                    {isTimedSetRunning ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
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
                    <Pencil size={15} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  className={styles.completeButton}
                  aria-label={set.completed ? `Подход ${index + 1} выполнен` : `Выполнить подход ${index + 1}`}
                  aria-pressed={set.completed}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSetCompleted(index);
                  }}
                >
                  <Check size={20} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingSet && (
        <div className={styles.modalBackdrop} role="presentation" onClick={closeEditModal}>
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
