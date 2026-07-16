import {
  exerciseUsesExternalWeight,
  findExerciseLibraryMatch
} from "../../utils/auditSafety";
import { appendExerciseSets } from "./trainerExerciseSetUtils";

export function createTrainerMonthExerciseHandlers({
  adminExerciseEditSnapshotRef,
  adminExerciseSearch,
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
    const newExerciseId = `exercise_${Date.now()}`;
    const exerciseName = String(sourceExercise?.name || adminExerciseSearch || "Новое упражнение").trim() || "Новое упражнение";
    const libraryExercise = sourceExercise || findExerciseLibraryMatch(adminExerciseLibrary, exerciseName);
    const libraryVideo = libraryExercise?.video || libraryExercise?.videoUrl || libraryExercise?.videoURL || "";
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: [
        ...((monthWorkouts.find((workout) => workout.id === workoutId)?.exercises) || []),
        {
          id: newExerciseId,
          name: exerciseName,
          video: libraryVideo,
          videoAutoFilledFrom: libraryVideo ? libraryExercise.name : "",
          requiresWeight: exerciseUsesExternalWeight(libraryExercise || { name: exerciseName }),
          sets: Array.from({ length: 3 }, () => ({ reps: 8, weight: "" }))
        }
      ]
    });
    if (!openEditor) {
      setAdminExerciseSearch("");
      return;
    }
    adminExerciseEditSnapshotRef.current = {
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
  }

  function openMonthExerciseEditor(blockId, weekId, workoutId, exercise) {
    adminExerciseEditSnapshotRef.current = {
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
    const snapshot = adminExerciseEditSnapshotRef.current;
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

    adminExerciseEditSnapshotRef.current = null;
    setAdminSelectedExerciseId("");
  }

  async function saveMonthExerciseEdit() {
    const saved = await saveMonthProgramToLibrary();
    if (!saved) return;
    adminExerciseEditSnapshotRef.current = null;
    setAdminSelectedExerciseId("");
  }

  function updateMonthExerciseSet(blockId, weekId, workoutId, exerciseId, setIndex, patch) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    updateMonthWorkout(blockId, weekId, workoutId, {
      exercises: (sourceWorkout?.exercises || []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const nextSets = Array.isArray(exercise.sets) && exercise.sets.length
          ? [...exercise.sets]
          : [{ reps: 8, weight: "" }];

        nextSets[setIndex] = {
          ...(nextSets[setIndex] || { reps: 8, weight: "" }),
          ...patch
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
    const libraryVideo = libraryExercise?.video || libraryExercise?.videoUrl || libraryExercise?.videoURL || "";
    const patch = { name };

    if (libraryVideo && (!exercise.video || exercise.videoAutoFilledFrom)) {
      patch.video = libraryVideo;
      patch.videoAutoFilledFrom = libraryExercise.name;
      patch.requiresWeight = exerciseUsesExternalWeight(libraryExercise);
    } else if (exercise.videoAutoFilledFrom && !libraryVideo) {
      patch.video = "";
      patch.videoAutoFilledFrom = "";
    }

    updateMonthExercise(blockId, weekId, workoutId, exercise.id, patch);
  }

  function duplicateMonthExercise(blockId, weekId, workoutId, exerciseId) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    const sourceExercise = sourceWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
    if (!sourceWorkout || !sourceExercise) return;
    const stamp = Date.now();
    const duplicatedExercise = {
      ...sourceExercise,
      id: `exercise_${stamp}`,
      name: `${sourceExercise.name || "Упражнение"} — копия`,
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
