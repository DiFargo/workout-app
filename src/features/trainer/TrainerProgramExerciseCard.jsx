import ProtectedExerciseVideo from "../../components/media/ProtectedExerciseVideo.jsx";
import TrainerExerciseLibrarySearch from "../../components/trainer/TrainerExerciseLibrarySearch";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety";
import { sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput";
import { getTrainerExerciseSelectionPatch } from "./trainerWorkoutEditHelpers";

export default function TrainerProgramExerciseCard({
  adminExerciseVideoUploadingId,
  adminExerciseLibrary = [],
  blockId,
  cancelMonthExerciseEdit,
  exercise,
  exerciseIndex,
  isExerciseSelected,
  openMonthExerciseEditor,
  onOpenExerciseLibrary,
  removeMonthExerciseSet,
  saveMonthExerciseEdit,
  updateMonthExercise,
  updateMonthExerciseSet,
  weekId,
  workoutId,
  addMonthExerciseSet
}) {
  const exerciseSets = Array.isArray(exercise.sets) && exercise.sets.length
    ? exercise.sets
    : [{ reps: 8, weight: "" }];
  const exerciseRequiresWeight = exerciseUsesExternalWeight(exercise);

  return (
    <div
      className={`monthExerciseCard compact monthProgramPremiumExercise${isExerciseSelected ? " selected" : ""}`}
      key={exercise.id}
      data-month-exercise-id={exercise.id}
    >
      {!isExerciseSelected ? (
        <button
          className="monthExerciseListItem"
          type="button"
          onClick={() => openMonthExerciseEditor(blockId, weekId, workoutId, exercise)}
        >
          <strong>{exercise.name || "Упражнение"}</strong>
          <span>{exerciseSets.length} подхода</span>
        </button>
      ) : (
        <>
          <nav className="exerciseEditBar" aria-label="Редактирование упражнения">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                cancelMonthExerciseEdit();
              }}
            >
              <span>←</span>
              <small>Назад</small>
            </button>
            <button className="empty" type="button" disabled aria-hidden="true" />
            <button className="empty" type="button" disabled aria-hidden="true" />
            <button
              className="save"
              type="button"
              disabled={adminExerciseVideoUploadingId === exercise.id}
              onClick={(event) => {
                event.stopPropagation();
                saveMonthExerciseEdit();
              }}
            >
              <span>💾</span>
              <small>Сохранить</small>
            </button>
          </nav>

          <h2 className="monthExerciseFullscreenTitle">{exercise.name || "Упражнение"}</h2>

          <div className="monthExerciseVideoBlock">
            {exercise.video ? (
              <ProtectedExerciseVideo src={exercise.video} controls playsInline preload="metadata" />
            ) : (
              <span>Видео пока не загружено</span>
            )}
            <small>Видео и само упражнение изменяются в библиотеке.</small>
            <button className="monthVideoUploadBtn" type="button" disabled={typeof onOpenExerciseLibrary !== "function"} onClick={onOpenExerciseLibrary}>
              Перейти в «Упражнения»
            </button>
          </div>

          <div className="monthProgramPremiumExerciseNumber">{exerciseIndex + 1}</div>
          <div className="monthExerciseRow compact">
            <TrainerExerciseLibrarySearch
              key={`${exercise.id}:${exercise.name || ""}`}
              exercise={exercise}
              items={adminExerciseLibrary}
              disabled={adminExerciseVideoUploadingId === exercise.id}
              onSelect={(source) => updateMonthExercise(
                blockId,
                weekId,
                workoutId,
                exercise.id,
                getTrainerExerciseSelectionPatch(source, exercise)
              )}
              onOpenLibrary={onOpenExerciseLibrary}
            />
          </div>

          <button
            type="button"
            className={`monthExerciseWeightMode${exerciseRequiresWeight ? " active" : ""}`}
            aria-pressed={exerciseRequiresWeight}
            onClick={() => updateMonthExercise(
              blockId,
              weekId,
              workoutId,
              exercise.id,
              { requiresWeight: !exerciseRequiresWeight }
            )}
          >
            <span>⚖</span>
            <strong>Вес в упражнении</strong>
            <i>{exerciseRequiresWeight ? "Нужен" : "Не нужен"}</i>
          </button>

          <div className={`monthProgramPremiumSetLegend${exerciseRequiresWeight ? "" : " withoutWeight"}`}>
            <span>Подход</span><span>Повторы</span>
            {exerciseRequiresWeight && <span>Вес, кг</span>}
            <span />
          </div>
          <div className="monthExerciseSets compact">
            {exerciseSets.map((set, setIndex) => (
              <div className={`monthExerciseSetRow compact${exerciseRequiresWeight ? "" : " withoutWeight"}`} key={setIndex}>
                <span>{setIndex + 1}</span>
                <input
                  value={set.reps || ""}
                  onChange={(event) => updateMonthExerciseSet(blockId, weekId, workoutId, exercise.id, setIndex, { reps: event.target.value })}
                  placeholder="8"
                  inputMode="numeric"
                  aria-label={`Повторы, подход ${setIndex + 1}`}
                />
                {exerciseRequiresWeight && (
                  <input
                    value={sanitizeExerciseWeightInput(set.weight) || ""}
                    onChange={(event) => updateMonthExerciseSet(blockId, weekId, workoutId, exercise.id, setIndex, { weight: sanitizeExerciseWeightInput(event.target.value) })}
                    placeholder="60"
                    inputMode="decimal"
                    aria-label={`Вес, подход ${setIndex + 1}`}
                  />
                )}
                <button
                  type="button"
                  disabled={exerciseSets.length <= 1}
                  onClick={() => removeMonthExerciseSet(blockId, weekId, workoutId, exercise.id, setIndex)}
                >
                  −
                </button>
              </div>
            ))}
          </div>

          <button
            className="monthAddSetBtn compact"
            type="button"
            onClick={() => addMonthExerciseSet(blockId, weekId, workoutId, exercise.id)}
          >
            + подход
          </button>
        </>
      )}
    </div>
  );
}
