import { createPortal } from "react-dom";

import TrainerProgramExerciseCard from "./TrainerProgramExerciseCard";

export default function TrainerProgramWorkoutDayEditor({
  adminExerciseLibrary,
  adminExerciseSearch,
  adminExerciseVideoUploadingId,
  adminSelectedExerciseId,
  addMonthExercise,
  addMonthExerciseSet,
  block,
  cancelMonthExerciseEdit,
  handleMonthProgramBack,
  openMonthExerciseEditor,
  removeMonthExerciseSet,
  saveMonthExerciseEdit,
  setAdminExerciseSearch,
  updateMonthExercise,
  updateMonthExerciseName,
  updateMonthExerciseSet,
  updateMonthWorkout,
  uploadMonthExerciseVideo,
  week,
  workout
}) {
  const workoutExercises = workout.exercises || [];
  const selectedWorkoutExercise = workoutExercises.find(
    (exercise) => exercise.id === adminSelectedExerciseId
  );
  const normalizedExerciseSearch = adminExerciseSearch.trim().toLocaleLowerCase("ru");
  const exerciseSearchResults = normalizedExerciseSearch
    ? adminExerciseLibrary
        .filter((exercise) =>
          String(exercise.name || "").toLocaleLowerCase("ru").includes(normalizedExerciseSearch)
        )
        .slice(0, 8)
    : [];
  const workoutDayNumber = Math.max(
    1,
    (week.workouts || []).findIndex((item) => item.id === workout.id) + 1
  );

  return (
    <div className={`monthProgramPremiumDayEditor${selectedWorkoutExercise ? " exercise-fullscreen-open" : ""}`}>
      <button
        className="monthProgramPremiumBackToOverview"
        type="button"
        onClick={handleMonthProgramBack}
      >
        ← Назад к микроциклу
      </button>
      <div className="monthProgramPremiumDayHead">
        <label>
          <span>
            {week.name} — День {workoutDayNumber}
          </span>
          <input
            value={workout.name || ""}
            onChange={(event) => updateMonthWorkout(block.id, week.id, workout.id, { name: event.target.value })}
          />
        </label>
      </div>

      <div className="monthExerciseSearch">
        <input
          value={adminExerciseSearch}
          onChange={(event) => setAdminExerciseSearch(event.target.value)}
          placeholder="Поиск упражнения"
          aria-label="Поиск упражнения"
        />
        {normalizedExerciseSearch && (
          <div className="monthExerciseSearchResults">
            {exerciseSearchResults.map((exercise) => (
              <button
                type="button"
                key={`${exercise.name}-${exercise.video || ""}`}
                onClick={() => addMonthExercise(block.id, week.id, workout.id, exercise)}
              >
                <strong>{exercise.name}</strong>
                <span>{exercise.video ? "Видео добавлено" : "Добавить в тренировку"}</span>
              </button>
            ))}
            {exerciseSearchResults.length === 0 && (
              <span>Упражнение не найдено. Добавьте его кнопкой внизу.</span>
            )}
          </div>
        )}
      </div>

      <div className="monthExerciseList compact monthProgramPremiumExerciseList">
        {workoutExercises.map((exercise, exerciseIndex) => {
          const isExerciseSelected = adminSelectedExerciseId === exercise.id;

          const exerciseCard = (
            <TrainerProgramExerciseCard
              adminExerciseVideoUploadingId={adminExerciseVideoUploadingId}
              blockId={block.id}
              cancelMonthExerciseEdit={cancelMonthExerciseEdit}
              exercise={exercise}
              exerciseIndex={exerciseIndex}
              isExerciseSelected={isExerciseSelected}
              openMonthExerciseEditor={openMonthExerciseEditor}
              removeMonthExerciseSet={removeMonthExerciseSet}
              saveMonthExerciseEdit={saveMonthExerciseEdit}
              updateMonthExercise={updateMonthExercise}
              updateMonthExerciseName={updateMonthExerciseName}
              updateMonthExerciseSet={updateMonthExerciseSet}
              uploadMonthExerciseVideo={uploadMonthExerciseVideo}
              weekId={week.id}
              workoutId={workout.id}
              addMonthExerciseSet={addMonthExerciseSet}
            />
          );
          return isExerciseSelected
            ? createPortal(
                <div className="monthProgramPremium monthProgramPremiumDayEditor exercise-fullscreen-open monthExerciseEditorPortal">
                  {exerciseCard}
                </div>,
                document.body,
                exercise.id
              )
            : exerciseCard;
        })}

        {workoutExercises.length === 0 && (
          <div className="monthProgramEmpty compact">В этой тренировке пока нет упражнений</div>
        )}
      </div>

      <button className="monthAddExerciseBtn" type="button" onClick={() => addMonthExercise(block.id, week.id, workout.id)}>
        + Добавить упражнение
      </button>
    </div>
  );
}
