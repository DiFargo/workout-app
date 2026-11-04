import { createPortal } from "react-dom";
import { useState } from "react";

import TrainerExerciseLibraryPicker from "../../components/trainer/TrainerExerciseLibraryPicker";
import TrainerProgramExerciseCard from "./TrainerProgramExerciseCard";

export default function TrainerProgramWorkoutDayEditor({
  adminExerciseLibrary = [],
  adminExerciseSearch,
  adminExerciseVideoUploadingId,
  adminSelectedExerciseId,
  addMonthExercise,
  addMonthExerciseSet,
  block,
  cancelMonthExerciseEdit,
  handleMonthProgramBack,
  onOpenExerciseLibrary,
  openMonthExerciseEditor,
  removeMonthExerciseSet,
  saveMonthExerciseEdit,
  setAdminExerciseSearch,
  updateMonthExercise,
  updateMonthExerciseSet,
  updateMonthWorkout,
  week,
  workout
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const workoutExercises = workout.exercises || [];
  const selectedWorkoutExercise = workoutExercises.find(
    (exercise) => exercise.id === adminSelectedExerciseId
  );
  const normalizedExerciseSearch = String(adminExerciseSearch || "").trim().toLocaleLowerCase("ru");
  const exerciseSearchResults = normalizedExerciseSearch
    ? adminExerciseLibrary
        .filter((exercise) =>
          !exercise.libraryDeletedAt && String(exercise.name || "").toLocaleLowerCase("ru").includes(normalizedExerciseSearch)
        )
        .slice(0, 8)
    : [];
  const workoutDayNumber = Math.max(
    1,
    (week.workouts || []).findIndex((item) => item.id === workout.id) + 1
  );
  const openLibrary = () => {
    setLibraryOpen(false);
    onOpenExerciseLibrary?.();
  };

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
              <div>
                <span>Упражнение не найдено в библиотеке.</span>
                <button type="button" disabled={typeof onOpenExerciseLibrary !== "function"} onClick={openLibrary}>
                  Перейти в «Упражнения» и создать
                </button>
              </div>
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
              adminExerciseLibrary={adminExerciseLibrary}
              blockId={block.id}
              cancelMonthExerciseEdit={cancelMonthExerciseEdit}
              exercise={exercise}
              exerciseIndex={exerciseIndex}
              isExerciseSelected={isExerciseSelected}
              openMonthExerciseEditor={openMonthExerciseEditor}
              onOpenExerciseLibrary={openLibrary}
              removeMonthExerciseSet={removeMonthExerciseSet}
              saveMonthExerciseEdit={saveMonthExerciseEdit}
              updateMonthExercise={updateMonthExercise}
              updateMonthExerciseSet={updateMonthExerciseSet}
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

      <button className="monthAddExerciseBtn" type="button" onClick={() => setLibraryOpen(true)}>
        + Добавить упражнение
      </button>
      <TrainerExerciseLibraryPicker
        open={libraryOpen}
        items={adminExerciseLibrary}
        onClose={() => setLibraryOpen(false)}
        onSelect={(exercise) => {
          const added = addMonthExercise(block.id, week.id, workout.id, exercise);
          if (added !== false) setLibraryOpen(false);
          return added;
        }}
        onOpenLibrary={openLibrary}
      />
    </div>
  );
}
