import { exerciseUsesExternalWeight } from "../../utils/auditSafety";

export default function TrainerProgramExerciseCard({
  adminExerciseVideoUploadingId,
  blockId,
  cancelMonthExerciseEdit,
  exercise,
  exerciseIndex,
  isExerciseSelected,
  openMonthExerciseEditor,
  removeMonthExerciseSet,
  saveMonthExerciseEdit,
  updateMonthExercise,
  updateMonthExerciseName,
  updateMonthExerciseSet,
  uploadMonthExerciseVideo,
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
              <video src={exercise.video} controls playsInline preload="metadata" />
            ) : (
              <span>Видео пока не загружено</span>
            )}
            <label className={exercise.video ? "monthVideoUploadBtn added" : "monthVideoUploadBtn"}>
              <input
                type="file"
                accept="video/*"
                disabled={adminExerciseVideoUploadingId === exercise.id}
                onChange={(event) => uploadMonthExerciseVideo(blockId, weekId, workoutId, exercise.id, event.target.files?.[0])}
              />
              {adminExerciseVideoUploadingId === exercise.id
                ? "Загружаю видео..."
                : exercise.video
                  ? "Заменить видео"
                  : "Загрузить видео"}
            </label>
          </div>

          <div className="monthProgramPremiumExerciseNumber">{exerciseIndex + 1}</div>
          <div className="monthExerciseRow compact">
            <input
              value={exercise.name || ""}
              onChange={(event) => updateMonthExerciseName(
                blockId,
                weekId,
                workoutId,
                exercise,
                event.target.value
              )}
              placeholder="Название упражнения"
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
                    value={set.weight || ""}
                    onChange={(event) => updateMonthExerciseSet(blockId, weekId, workoutId, exercise.id, setIndex, { weight: event.target.value })}
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
