export default function WorkoutExerciseSets({
  exercise,
  exerciseValidationMessage,
  hasExternalWeight,
  onToggleSetCompleted,
  onUpdateSet,
  repsInputRefs,
  sharedExerciseAiWeightAdjustment,
  weightInputRefs
}) {
  return (
    <section className="workoutExerciseSets">
      <div className="workoutExerciseSetsList">
        <div
          className={`workoutExerciseSetsHeader ${hasExternalWeight ? "" : "withoutWeight"}`}
          aria-hidden="true"
        >
          <span />
          <span>Повторы</span>
          {hasExternalWeight && <span>Вес, кг</span>}
        </div>
        {exercise.sets.map((set, index) => (
          <div
            className={`setRow ${hasExternalWeight ? "" : "withoutWeight"} ${set.completed ? "completed" : ""}`}
            key={index}
          >
            <button
              type="button"
              className="workoutExerciseSetNumber"
              onClick={() => onToggleSetCompleted(exercise.id, index)}
              aria-label={set.completed ? `Снять отметку с подхода ${index + 1}` : `Отметить подход ${index + 1}`}
            >
              {set.completed ? "✓" : String(index + 1).padStart(2, "0")}
            </button>
            <label className="workoutExerciseActualField">
              <input
                ref={(element) => {
                  repsInputRefs.current[`${exercise.id}:${index}`] = element;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`Повторы, подход ${index + 1}`}
                placeholder={set.reps ? `${set.reps}` : "повторы"}
                value={set.enteredReps ?? ""}
                onPointerDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
                onTouchEnd={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onUpdateSet(
                    exercise.id,
                    index,
                    "enteredReps",
                    event.target.value.replace(/[^0-9]/g, "")
                  )
                }
              />
            </label>
            {hasExternalWeight && (
              <label className="workoutExerciseActualField workoutExerciseWeightField">
                <span className="workoutExerciseWeightControls">
                  <input
                    ref={(element) => {
                      weightInputRefs.current[`${exercise.id}:${index}`] = element;
                    }}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    aria-label={`Вес, подход ${index + 1}`}
                    placeholder={set.weight ? `${set.weight}` : "вес"}
                    value={set.enteredWeight ?? ""}
                    onPointerDown={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                    onTouchEnd={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        repsInputRefs.current[`${exercise.id}:${index + 1}`]?.focus();
                      }
                    }}
                    onChange={(event) =>
                      onUpdateSet(
                        exercise.id,
                        index,
                        "enteredWeight",
                        event.target.value
                          .replace(/[^0-9.,]/g, "")
                          .replace(",", ".")
                      )
                    }
                  />
                </span>
              </label>
            )}
          </div>
        ))}
      </div>
      {exerciseValidationMessage && (
        <p className="workoutExerciseValidation" role="alert">
          <span aria-hidden="true">!</span>
          {exerciseValidationMessage}
        </p>
      )}
      {sharedExerciseAiWeightAdjustment && (
        <small className="workoutAiSharedWeightNote">
          Коррекция готовности: {sharedExerciseAiWeightAdjustment}
        </small>
      )}
    </section>
  );
}
