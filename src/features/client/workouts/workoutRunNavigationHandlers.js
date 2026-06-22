import {
  exerciseUsesExternalWeight,
  hasWorkoutSetEntry
} from "../../../utils/auditSafety";

export function createWorkoutRunNavigationHandlers({
  workout,
  workoutStarted,
  currentExerciseIndex,
  deckRef,
  touchStartY,
  setWeightInputRefs,
  setOpenVideoId,
  setInlinePlayingVideoId,
  setRestTimerRunning,
  setRestTimerSeconds,
  setIsWorkoutSaved,
  setShowWorkoutSavedCard,
  setSwipeDirection,
  setWorkoutStarted,
  setCurrentExerciseIndex,
  setExerciseValidationMessage,
  setSwipeOffset
}) {
  function centerExerciseDeck() {
    setTimeout(() => {
      if (deckRef.current) {
        deckRef.current.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    }, 80);
  }

  function resetExerciseMotion(direction) {
    deckRef.current?.querySelector("video")?.pause();
    setOpenVideoId(null);
    setInlinePlayingVideoId("");
    setRestTimerRunning(false);
    setRestTimerSeconds(0);
    setIsWorkoutSaved(false);
    setShowWorkoutSavedCard(false);
    setSwipeDirection(direction);
  }

  function goToPreviousExercise() {
    if (!workout) return;

    resetExerciseMotion("down");

    if (workoutStarted && currentExerciseIndex === 0) {
      setWorkoutStarted(false);
    } else if (workoutStarted) {
      setCurrentExerciseIndex((prev) => Math.max(prev - 1, 0));
    }

    centerExerciseDeck();

    setTimeout(() => {
      setSwipeDirection("");
    }, 560);
  }

  function goToNextExercise() {
    if (!workout) return;

    if (
      workoutStarted &&
      currentExerciseIndex > 0 &&
      currentExerciseIndex <= workout.exercises.length
    ) {
      const currentExercise = workout.exercises[currentExerciseIndex - 1];
      const hasEnteredWeight = currentExercise?.sets?.some((set) =>
        hasWorkoutSetEntry(set.enteredWeight)
      );

      if (exerciseUsesExternalWeight(currentExercise) && !hasEnteredWeight) {
        setExerciseValidationMessage("Введите вес хотя бы в одном подходе. Значение 0 тоже считается введённым.");
        window.requestAnimationFrame(() => {
          setWeightInputRefs.current[`${currentExercise.id}:0`]?.focus();
        });
        navigator.vibrate?.(90);
        return;
      }
    }

    setExerciseValidationMessage("");
    resetExerciseMotion("up");

    if (!workoutStarted) {
      setWorkoutStarted(true);
      setCurrentExerciseIndex(0);
    } else {
      setCurrentExerciseIndex((prev) =>
        Math.min(prev + 1, workout.exercises.length + 1)
      );
    }

    centerExerciseDeck();

    setTimeout(() => {
      setSwipeDirection("");
    }, 560);
  }

  function resetExerciseTouch() {
    touchStartY.current = null;
    setSwipeOffset(0);
  }

  return {
    centerExerciseDeck,
    goToPreviousExercise,
    goToNextExercise,
    handleExerciseTouchStart: resetExerciseTouch,
    handleExerciseTouchMove: resetExerciseTouch,
    handleExerciseTouchEnd: resetExerciseTouch
  };
}
