import {
  getAdjustedWorkoutWeight,
  getAiWorkoutBaseWeight,
  getWorkoutReadinessOption
} from "../../../domain/workoutPresentation";

export function createWorkoutReadinessHandlers({
  selectedWorkoutId,
  history,
  timerTickRef,
  centerExerciseDeck,
  setWorkoutReadiness,
  setWorkoutReadinessPending,
  setWorkoutReadinessOpen,
  setPlan,
  setWorkoutStarted,
  setWorkoutStartedAt,
  setTimerTick,
  setWorkoutFinishedAt,
  setCurrentExerciseIndex,
  setSwipeDirection
}) {
  function applyWorkoutReadiness(option) {
    const readiness = option || getWorkoutReadinessOption("good");

    setWorkoutReadiness(readiness);
    setWorkoutReadinessPending(readiness);
    setWorkoutReadinessOpen(false);

    if (!selectedWorkoutId) return;

    setPlan((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workoutItem) => {
        if (workoutItem.id !== selectedWorkoutId) return workoutItem;

        return {
          ...workoutItem,
          exercises: workoutItem.exercises.map((exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set, index) => {
              if (readiness.id === "good") return set;

              const isAssignedProgramWorkout = Boolean(
                workoutItem.assignedProgramId || workoutItem.assignedProgramUpdatedAt
              );
              const baseWeight = getAiWorkoutBaseWeight(
                exercise.name,
                set,
                index,
                history,
                !isAssignedProgramWorkout
              );
              const adjustedWeight = getAdjustedWorkoutWeight(baseWeight, readiness.id);

              if (!adjustedWeight) return set;

              return {
                ...set,
                weight: String(adjustedWeight),
                aiOriginalWeight: baseWeight ? String(baseWeight) : "",
                aiReadinessId: readiness.id,
                aiReadinessTitle: readiness.title
              };
            })
          }))
        };
      })
    }));

    const startedAt = Date.now();
    setWorkoutStarted(true);
    setWorkoutStartedAt(startedAt);
    setTimerTick(startedAt);
    timerTickRef.current = startedAt;
    setWorkoutFinishedAt(null);
    setCurrentExerciseIndex(0);
    setSwipeDirection("up");
    centerExerciseDeck();
    setTimeout(() => setSwipeDirection(""), 560);
  }

  return {
    applyWorkoutReadiness
  };
}
