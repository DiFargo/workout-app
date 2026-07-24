export function createTrainerWorkspaceHandlers({
  updateTrainerNextWorkout,
  updateTrainerNextExercise,
  saveTrainerExerciseProgressAdjustment,
  updateTrainerLibraryExercise,
  removeTrainerLibraryExercise,
  createTrainerLibraryExercise,
  updateTrainerNextExerciseSet,
  addTrainerNextExerciseSet,
  removeTrainerNextExerciseSet,
  addTrainerNextExercise,
  removeTrainerNextExercise,
  duplicateTrainerNextExercise,
  moveTrainerNextExercise,
  uploadTrainerNextExerciseVideo,
  uploadTrainerLibraryExerciseVideo,
  addTrainerNextWorkoutDay,
  duplicateTrainerNextWorkoutDay,
  removeTrainerNextWorkoutDay,
  setAdminClientStatus
}) {
  return {
    onUpdateWorkout: (...args) => {
      if (typeof updateTrainerNextWorkout === "function") {
        updateTrainerNextWorkout(...args);
        return;
      }
      setAdminClientStatus("Не удалось сохранить изменение тренировки.");
    },
    onUpdateExercise: (...args) => {
      if (typeof updateTrainerNextExercise === "function") {
        updateTrainerNextExercise(...args);
        return;
      }
      setAdminClientStatus("Не удалось сохранить изменение упражнения.");
    },
    onSaveExerciseProgressAdjustment: async (...args) => {
      if (typeof saveTrainerExerciseProgressAdjustment === "function") {
        return saveTrainerExerciseProgressAdjustment(...args);
      }
      setAdminClientStatus("Не удалось сохранить изменение нагрузки.");
      return false;
    },
    onUpdateLibraryExercise: async (...args) => {
      if (typeof updateTrainerLibraryExercise === "function") {
        return updateTrainerLibraryExercise(...args);
      }
      return false;
    },
    onRemoveLibraryExercise: async (...args) => {
      if (typeof removeTrainerLibraryExercise === "function") {
        return removeTrainerLibraryExercise(...args);
      }
      return false;
    },
    onCreateLibraryExercise: async (...args) => {
      if (typeof createTrainerLibraryExercise === "function") {
        return createTrainerLibraryExercise(...args);
      }
      return false;
    },
    onUpdateExerciseSet: (...args) => {
      if (typeof updateTrainerNextExerciseSet === "function") {
        updateTrainerNextExerciseSet(...args);
        return;
      }
      setAdminClientStatus("Не удалось сохранить изменение подхода.");
    },
    onAddExerciseSet: (...args) => {
      if (typeof addTrainerNextExerciseSet === "function") {
        addTrainerNextExerciseSet(...args);
      }
    },
    onRemoveExerciseSet: (...args) => {
      if (typeof removeTrainerNextExerciseSet === "function") {
        removeTrainerNextExerciseSet(...args);
      }
    },
    onAddExercise: (...args) => {
      if (typeof addTrainerNextExercise === "function") {
        return addTrainerNextExercise(...args);
      }
      return false;
    },
    onRemoveExercise: (...args) => {
      if (typeof removeTrainerNextExercise === "function") {
        removeTrainerNextExercise(...args);
      }
    },
    onDuplicateExercise: (...args) => {
      if (typeof duplicateTrainerNextExercise === "function") {
        duplicateTrainerNextExercise(...args);
      }
    },
    onMoveExercise: (...args) => {
      if (typeof moveTrainerNextExercise === "function") {
        moveTrainerNextExercise(...args);
      }
    },
    onUploadExerciseVideo: (...args) => {
      if (typeof uploadTrainerNextExerciseVideo === "function") {
        return uploadTrainerNextExerciseVideo(...args);
      }
      return false;
    },
    onUploadLibraryExerciseVideo: (...args) => {
      if (typeof uploadTrainerLibraryExerciseVideo === "function") {
        return uploadTrainerLibraryExerciseVideo(...args);
      }
      return false;
    },
    onAddDay: (...args) => {
      if (typeof addTrainerNextWorkoutDay === "function") {
        addTrainerNextWorkoutDay(...args);
      }
    },
    onDuplicateDay: (...args) => {
      if (typeof duplicateTrainerNextWorkoutDay === "function") {
        duplicateTrainerNextWorkoutDay(...args);
      }
    },
    onRemoveDay: (...args) => {
      if (typeof removeTrainerNextWorkoutDay === "function") {
        removeTrainerNextWorkoutDay(...args);
      }
    }
  };
}
