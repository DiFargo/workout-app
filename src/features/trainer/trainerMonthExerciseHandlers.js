import { findExerciseLibraryMatch } from "../../utils/auditSafety";
import { appendExerciseSets } from "./trainerExerciseSetUtils";
import { getTrainerExerciseSelectionPatch, resolveTrainerLibraryExercise } from "./trainerWorkoutEditHelpers";
import { sanitizeExerciseSetPatch } from "../../utils/exerciseWeightInput";

export function createTrainerMonthExerciseHandlers({
  adminExerciseEditSnapshotRef,
  getAdminExerciseEditSnapshotRef = () => adminExerciseEditSnapshotRef,
  adminExerciseLibrary,
  monthWorkouts,
  saveMonthProgramToLibrary,
  setAdminExerciseSearch,
  setAdminSelectedExerciseId,
  updateMonthWorkout
}) {
  function updateMonthExercise(blockId, weekId, workoutId, exerciseId, patch) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: (sourceWorkout?.exercises || []).map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...patch } : exercise
      )
    });
  }

  function removeMonthExercise(blockId, weekId, workoutId, exerciseId) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: (sourceWorkout?.exercises || []).filter((exercise) => exercise.id !== exerciseId)
    });
  }

  function addMonthExercise(blockId, weekId, workoutId, sourceExercise = null, openEditor = true) {
    const libraryExercise = resolveTrainerLibraryExercise(sourceExercise, adminExerciseLibrary);
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    if (!libraryExercise || !sourceWorkout) return false;
    const newExerciseId = `exercise_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newExercise = {
      id: newExerciseId,
      ...getTrainerExerciseSelectionPatch(libraryExercise),
      sets: [{ reps: 8, weight: "" }]
    };
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: [
        ...(sourceWorkout.exercises || []), newExercise
      ]
    });
    if (!openEditor) {
      setAdminExerciseSearch("");
      return newExercise;
    }
    getAdminExerciseEditSnapshotRef().current = {
      isNew: true,
      blockId,
      weekId,
      workoutId,
      exerciseId: newExerciseId,
      exercise: null
    };
    setAdminSelectedExerciseId(newExerciseId);
    setAdminExerciseSearch("");
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-month-exercise-id="${newExerciseId}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
    return newExercise;
  }

  function openMonthExerciseEditor(blockId, weekId, workoutId, exercise) {
    getAdminExerciseEditSnapshotRef().current = {
      isNew: false,
      blockId,
      weekId,
      workoutId,
      exerciseId: exercise.id,
      exercise: {
        ...exercise,
        sets: (exercise.sets || []).map((set) => ({ ...set }))
      }
    };
    setAdminSelectedExerciseId(exercise.id);
  }

  function cancelMonthExerciseEdit() {
    const snapshot = getAdminExerciseEditSnapshotRef().current;
    if (!snapshot) {
      setAdminSelectedExerciseId("");
      return;
    }

    if (snapshot.isNew) {
      removeMonthExercise(snapshot.blockId, snapshot.weekId, snapshot.workoutId, snapshot.exerciseId);
    } else {
      updateMonthExercise(
        snapshot.blockId,
        snapshot.weekId,
        snapshot.workoutId,
        snapshot.exerciseId,
        snapshot.exercise
      );
    }

    getAdminExerciseEditSnapshotRef().current = null;
    setAdminSelectedExerciseId("");
  }

  async function saveMonthExerciseEdit() {
    const saved = await saveMonthProgramToLibrary();
    if (!saved) return;
    getAdminExerciseEditSnapshotRef().current = null;
    setAdminSelectedExerciseId("");
  }

  function updateMonthExerciseSet(blockId, weekId, workoutId, exerciseId, setIndex, patch) {
    const safePatch = sanitizeExerciseSetPatch(patch);
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: (sourceWorkout?.exercises || []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const nextSets = Array.isArray(exercise.sets) && exercise.sets.length
          ? [...exercise.sets]
          : [{ reps: 8, weight: "" }];

        nextSets[setIndex] = {
          ...(nextSets[setIndex] || { reps: 8, weight: "" }),
          ...safePatch
        };

        return {
          ...exercise,
          sets: nextSets
        };
      })
    });
  }

  function addMonthExerciseSet(blockId, weekId, workoutId, exerciseId, options = {}) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: (sourceWorkout?.exercises || []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        return {
          ...exercise,
          sets: appendExerciseSets(exercise.sets, {
            ...options,
            defaults: {
              rest: exercise.rest ?? "",
              tempo: exercise.tempo ?? "",
              rpe: exercise.rpe ?? "",
              rir: exercise.rir ?? ""
            }
          })
        };
      })
    });
  }

  function removeMonthExerciseSet(blockId, weekId, workoutId, exerciseId, setIndex) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: (sourceWorkout?.exercises || []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const currentSets = Array.isArray(exercise.sets) && exercise.sets.length
          ? exercise.sets
          : [{ reps: 8, weight: "" }];

        if (currentSets.length <= 1) return exercise;

        return {
          ...exercise,
          sets: currentSets.filter((_, index) => index !== setIndex)
        };
      })
    });
  }

  function updateMonthExerciseName(blockId, weekId, workoutId, exercise, name) {
    const libraryExercise = findExerciseLibraryMatch(adminExerciseLibrary, name, exercise.id);
    if (!libraryExercise || !resolveTrainerLibraryExercise(libraryExercise, adminExerciseLibrary)) return false;
    updateMonthExercise(blockId, weekId, workoutId, exercise.id, getTrainerExerciseSelectionPatch(libraryExercise, exercise));
    return true;
  }

  function duplicateMonthExercise(blockId, weekId, workoutId, exerciseId) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    const sourceExercise = sourceWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
    if (!sourceWorkout || !sourceExercise) return;
    const stamp = Date.now();
    const duplicatedExercise = {
      ...sourceExercise,
      id: `exercise_${stamp}`,
      name: sourceExercise.name || "Упражнение",
      sets: (sourceExercise.sets || []).map((set, setIndex) => ({
        ...set,
        ...(set?.id ? { id: `set_${stamp}_${setIndex}` } : {})
      }))
    };

    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: (sourceWorkout.exercises || []).flatMap((exercise) =>
        exercise.id === exerciseId ? [exercise, duplicatedExercise] : [exercise]
      )
    });
  }

  function moveMonthExercise(blockId, weekId, workoutId, exerciseId, direction) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    const exercises = [...(sourceWorkout?.exercises || [])];
    const currentIndex = exercises.findIndex((exercise) => exercise.id === exerciseId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= exercises.length) return;
    [exercises[currentIndex], exercises[nextIndex]] = [exercises[nextIndex], exercises[currentIndex]];
    updateMonthWorkout(blockId, weekId, workoutId, { exercises });
  }

  return {
    addMonthExercise,
    addMonthExerciseSet,
    cancelMonthExerciseEdit,
    duplicateMonthExercise,
    moveMonthExercise,
    openMonthExerciseEditor,
    removeMonthExercise,
    removeMonthExerciseSet,
    saveMonthExerciseEdit,
    updateMonthExercise,
    updateMonthExerciseName,
    updateMonthExerciseSet
  };
}
