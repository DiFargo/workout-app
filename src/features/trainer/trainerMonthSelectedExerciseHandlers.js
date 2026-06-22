import { doc, getDoc } from "firebase/firestore";

export function createTrainerMonthSelectedExerciseHandlers({
  adminActiveProgramId,
  adminExerciseEditSnapshotRef,
  adminSelectedExerciseId,
  adminSelectedTemplateId,
  db,
  openMonthWorkoutContext,
  removeMonthExercise,
  setAdminExerciseSearch,
  setAdminSelectedExerciseId,
  showAppConfirm,
  showAppError,
  updateMonthExercise
}) {
  async function deleteSelectedMonthExercise() {
    if (!openMonthWorkoutContext || !adminSelectedExerciseId) {
      showAppError("load", "Сначала выберите упражнение.");
      return;
    }

    const exercise = (openMonthWorkoutContext.workout.exercises || [])
      .find((item) => item.id === adminSelectedExerciseId);
    if (!exercise) {
      showAppError("load", "Выбранное упражнение не найдено.");
      return;
    }

    if (!(await showAppConfirm(`Удалить упражнение “${exercise.name || "Без названия"}”?`))) return;

    removeMonthExercise(
      openMonthWorkoutContext.block.id,
      openMonthWorkoutContext.week.id,
      openMonthWorkoutContext.workout.id,
      exercise.id
    );
    adminExerciseEditSnapshotRef.current = null;
    setAdminSelectedExerciseId("");
  }

  async function refreshSelectedMonthExercise() {
    if (!openMonthWorkoutContext || !adminSelectedExerciseId) return;

    const templateId = adminActiveProgramId || adminSelectedTemplateId;
    if (!templateId) {
      showAppError("load", "Сначала сохраните программу.");
      return;
    }

    try {
      const templateSnapshot = await getDoc(doc(db, "trainingTemplates", templateId));
      if (!templateSnapshot.exists()) {
        showAppError("load", "Сохранённая программа не найдена.");
        return;
      }

      const template = templateSnapshot.data();
      const templateMicrocycles = Array.isArray(template.blocks)
        ? template.blocks
        : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
      const savedWorkouts = [
        ...(template.workouts || []),
        ...templateMicrocycles.flatMap((microcycle) =>
          (microcycle.weeks || []).flatMap((week) => week.workouts || [])
        )
      ];
      const savedExercise = savedWorkouts
        .find((workout) => workout.id === openMonthWorkoutContext.workout.id)
        ?.exercises?.find((exercise) => exercise.id === adminSelectedExerciseId);

      if (!savedExercise) {
        showAppError("load", "Упражнение ещё не сохранено.");
        return;
      }

      updateMonthExercise(
        openMonthWorkoutContext.block.id,
        openMonthWorkoutContext.week.id,
        openMonthWorkoutContext.workout.id,
        adminSelectedExerciseId,
        savedExercise
      );
      showAppError("savedLocal", "Данные упражнения обновлены.");
    } catch (error) {
      console.error("Refresh selected exercise error:", error);
      showAppError("firebase", "Не получилось обновить упражнение.");
    }
  }

  return {
    deleteSelectedMonthExercise,
    refreshSelectedMonthExercise
  };
}
