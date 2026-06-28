import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";

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
  repsInputRefs,
  sharedExerciseAiWeightAdjustment,
  weightInputRefs
}) {
  const [editingSetDraft, setEditingSetDraft] = useState(null);
  const repsWheelRef = useRef(null);
  const weightWheelRef = useRef(null);
  const editingSetIndex = editingSetDraft?.index ?? null;
  const editingSet = editingSetIndex !== null ? exercise.sets[editingSetIndex] : null;
  const editingSetKey = editingSetIndex !== null ? `${exercise.id}:${editingSetIndex}` : "";
  const repsInputRegistry = repsInputRefs.current;
  const weightInputRegistry = weightInputRefs.current;
  const repsSliderState = editingSetDraft ? getRepsSliderState(editingSetDraft.reps, editingSet?.reps) : null;
  const weightSliderState = editingSetDraft ? getWeightSliderState(editingSetDraft.weight, editingSet?.weight) : null;
  const repsWheelOptions = useMemo(
    () => (repsSliderState ? buildWheelOptions(repsSliderState, (value) => String(Math.round(value))) : []),
    [repsSliderState?.min, repsSliderState?.max, repsSliderState?.step]
  );
  const weightWheelOptions = useMemo(
    () => (weightSliderState ? buildWheelOptions(weightSliderState, formatWeightValue) : []),
    [weightSliderState?.min, weightSliderState?.max, weightSliderState?.step]
  );

  useEffect(() => {
    if (!editingSetKey) {
      return undefined;
    }

    // eslint-disable-next-line react-hooks/immutability
    repsInputRegistry[editingSetKey] = repsWheelRef.current;
    // eslint-disable-next-line react-hooks/immutability
    weightInputRegistry[editingSetKey] = weightWheelRef.current;

    return () => {
      // eslint-disable-next-line react-hooks/immutability
      delete repsInputRegistry[editingSetKey];
      // eslint-disable-next-line react-hooks/immutability
      delete weightInputRegistry[editingSetKey];
    };
  }, [editingSetKey, repsInputRegistry, weightInputRegistry]);

  useEffect(() => {
    if (!editingSetKey || !repsSliderState) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollWheelToValue(repsWheelRef.current, repsWheelOptions, repsSliderState.value);
      if (weightSliderState) {
        scrollWheelToValue(weightWheelRef.current, weightWheelOptions, weightSliderState.value);
      }
    });
  }, [editingSetKey, repsWheelOptions, weightWheelOptions]);

  function closeEditModal() {
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
    onToggleSetCompleted(exercise.id, index);
  }

  function setRepsFromWheel(value) {
    setEditingSetDraft((draft) => (draft ? { ...draft, reps: String(Math.round(Number(value))) } : draft));
  }

  function setWeightFromWheel(value) {
    setEditingSetDraft((draft) => (draft ? { ...draft, weight: formatWeightValue(Number(value)) } : draft));
  }

  function handleWheelScroll(event, options, field) {
    const nextValue = getWheelValueFromScroll(event.currentTarget.scrollTop, options);

    if (nextValue === undefined) {
      return;
    }

    if (field === "reps") {
      setRepsFromWheel(nextValue);
      return;
    }

    setWeightFromWheel(nextValue);
  }

  return (
    <section className="workoutExerciseSets">
      <div className="workoutExerciseSetsTitle">План на сегодня</div>
      <div className="workoutExerciseSetsList workoutExercisePlanList">
        {exercise.sets.map((set, index) => {
          const repsValue = getPlannedValue(set.enteredReps, set.reps);
          const weightValue = getPlannedValue(set.enteredWeight, set.weight);
          const repsText = repsValue ? `${repsValue} повторений` : "Повторы не указаны";
          const weightText = hasExternalWeight
            ? (weightValue ? `${weightValue} кг` : "Вес не указан")
            : "Свой вес";

          return (
            <div
              className={`setRow workoutExercisePlanRow ${hasExternalWeight ? "" : "withoutWeight"} ${set.completed ? "completed" : ""}`}
              key={`${exercise.id}:${index}`}
              role="button"
              tabIndex={0}
              onClick={() => onToggleSetCompleted(exercise.id, index)}
              onKeyDown={(event) => handleSetRowKeyDown(event, index)}
              aria-pressed={set.completed}
            >
              <span
                className="workoutExerciseSetNumber"
                aria-hidden="true"
                aria-label={set.completed ? `Снять отметку с подхода ${index + 1}` : `Отметить подход ${index + 1}`}
              >
                {index + 1}
              </span>

              <div className="workoutExerciseSetPlan">
                <span className="workoutExerciseSetReps">{repsText}</span>
                <strong className="workoutExerciseSetWeight">{weightText}</strong>
              </div>

              <div className="workoutExerciseSetActions">
                <button
                  type="button"
                  className="workoutExerciseSetEdit"
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

                <span
                  className="workoutExerciseCompleteButton"
                  aria-label={set.completed ? `Подход ${index + 1} выполнен` : `Выполнить подход ${index + 1}`}
                  aria-pressed={set.completed}
                >
                  <Check size={20} strokeWidth={3} aria-hidden="true" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {editingSet && (
        <div className="workoutSetEditModalBackdrop" role="presentation" onClick={closeEditModal}>
          <div
            className="workoutSetEditModal"
            role="dialog"
            aria-modal="true"
            aria-label={`Редактировать подход ${editingSetIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workoutSetEditModalHeader">
              <div>
                <span>Подход {editingSetIndex + 1}</span>
                <strong>Редактировать</strong>
              </div>
              <button type="button" onClick={closeEditModal} aria-label="Закрыть">
                ×
              </button>
            </div>

            <div className={`workoutSetEditModalFields ${hasExternalWeight ? "withWeight" : "withoutWeight"}`}>
              <div className="workoutSetWheelField">
                <span>Повторы</span>
                <div
                  ref={repsWheelRef}
                  className="workoutSetWheelPicker"
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
                        className={`workoutSetWheelOption ${active ? "active" : ""}`}
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
                <div className="workoutSetWheelField workoutExerciseWeightField">
                  <span>Вес, кг</span>
                  <div
                    ref={weightWheelRef}
                    className="workoutSetWheelPicker"
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
                          className={`workoutSetWheelOption ${active ? "active" : ""}`}
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

            <button type="button" className="workoutSetEditDoneButton" onClick={saveEditModal}>
              Готово
            </button>
          </div>
        </div>
      )}

      {sharedExerciseAiWeightAdjustment && (
        <small className="workoutAiSharedWeightNote">
          Коррекция готовности: {sharedExerciseAiWeightAdjustment}
        </small>
      )}
    </section>
  );
}
