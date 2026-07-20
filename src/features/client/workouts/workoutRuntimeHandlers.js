import { hasWorkoutSetEntry } from "../../../utils/auditSafety";
import { makeThreeSets } from "../../../utils/workoutPlanNormalization";

export function createWorkoutRuntimeHandlers({
  workout,
  restTimerDuration,
  deckRef,
  setPlan,
  setExerciseValidationMessage,
  setRestTimerDuration,
  setRestTimerSeconds,
  setRestTimerRunning,
  setWarmupCompletedSteps,
  setWarmupTimerDuration,
  setWarmupTimerSeconds,
  setWarmupTimerRunning
}) {
  function updateWorkout(cb) {
    if (!workout) return;

    setPlan((planState) => ({
      ...planState,
      workouts: planState.workouts.map((workoutItem) => (
        workoutItem.id === workout.id ? cb(workoutItem) : workoutItem
      ))
    }));
  }

  function addSet(id) {
    updateWorkout((workoutItem) => ({
      ...workoutItem,
      exercises: workoutItem.exercises.map((exercise) =>
        exercise.id === id
          ? {
              ...exercise,
              sets: [
                ...exercise.sets,
                {
                  reps: exercise.name?.includes("Пресс") ? 15 : 8,
                  weight: "",
                  enteredReps: "",
                  enteredWeight: ""
                }
              ]
            }
          : exercise
      )
    }));
  }

  function updateSet(id, index, field, value) {
    updateWorkout((workoutItem) => ({
      ...workoutItem,
      exercises: workoutItem.exercises.map((exercise) =>
        exercise.id === id
          ? {
              ...exercise,
              sets: exercise.sets.map((set, setIndex) => {
                if (setIndex !== index) return set;

                return { ...set, [field]: value };
              })
            }
          : exercise
      )
    }));

    if (field === "enteredWeight" && hasWorkoutSetEntry(value)) {
      setExerciseValidationMessage("");
    }
  }

  function updateExerciseNote(exerciseId, note) {
    updateWorkout((currentWorkout) => ({
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((exercise) => (
        exercise.id === exerciseId
          ? { ...exercise, clientNote: note }
          : exercise
      ))
    }));
  }

  function openWorkoutExerciseModal(setModalId, exerciseId, triggerElement) {
    triggerElement?.blur();
    if (deckRef.current) {
      deckRef.current.scrollTop = 0;
    }
    setModalId(exerciseId);
  }

  function closeWorkoutExerciseModal(setModalId) {
    setModalId("");
    const restoreScroll = () => {
      if (deckRef.current) {
        deckRef.current.scrollTop = 0;
      }
    };
    window.requestAnimationFrame(() => {
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
    });
    window.setTimeout(restoreScroll, 100);
  }

  function startRestTimer(duration = restTimerDuration) {
    const nextDuration = Number(duration) || 90;
    setRestTimerDuration(nextDuration);
    setRestTimerSeconds(nextDuration);
    setRestTimerRunning(true);
  }

  function toggleWorkoutSetCompleted(exerciseId, setIndex) {
    const exerciseItem = workout?.exercises?.find((item) => item.id === exerciseId);
    const setItem = exerciseItem?.sets?.[setIndex];
    const nextCompleted = !setItem?.completed;

    updateSet(exerciseId, setIndex, "completed", nextCompleted);
    if (nextCompleted) {
      setExerciseValidationMessage("");
      startRestTimer();
      navigator.vibrate?.(45);
    }
  }

  function toggleWarmupStep(stepIndex) {
    setWarmupCompletedSteps((current) => (
      current.includes(stepIndex)
        ? current.filter((item) => item !== stepIndex)
        : [...current, stepIndex]
    ));
  }

  function setWarmupTimerPreset(seconds) {
    setWarmupTimerDuration(seconds);
    setWarmupTimerSeconds(seconds);
    setWarmupTimerRunning(false);
  }

  function resetWorkout() {
    if (!workout) return;

    setPlan((planState) => ({
      ...planState,
      workouts: planState.workouts.map((workoutItem) =>
        workoutItem.id === workout.id
          ? {
              ...workoutItem,
              exercises: workoutItem.exercises.map((exercise) => ({
                ...exercise,
                sets: makeThreeSets([], exercise.name.includes("Пресс") ? 15 : 8)
              }))
            }
          : workoutItem
      )
    }));
  }

  return {
    addSet,
    updateSet,
    updateExerciseNote,
    openWorkoutExerciseModal,
    closeWorkoutExerciseModal,
    startRestTimer,
    toggleWorkoutSetCompleted,
    toggleWarmupStep,
    setWarmupTimerPreset,
    resetWorkout
  };
}
