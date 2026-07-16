export function createWorkoutRunNavigationHandlers({
  workout,
  workoutStarted,
  currentExerciseIndex,
  deckRef,
  touchStartY,
  exerciseValidationTimerRef,
  partialExerciseWarningKeysRef,
  setOpenVideoId,
  setInlinePlayingVideoId,
  setRestTimerRunning,
  setRestTimerSeconds,
  setIsWorkoutSaved,
  setShowWorkoutSavedCard,
  postWorkoutFeedback,
  setPostWorkoutFeedbackOpen,
  setSwipeDirection,
  setWorkoutStarted,
  setCurrentExerciseIndex,
  setExerciseValidationMessage,
  setSwipeOffset
}) {
  function showExerciseValidation(message) {
    if (exerciseValidationTimerRef?.current) {
      window.clearTimeout(exerciseValidationTimerRef.current);
    }

    setExerciseValidationMessage(message);

    if (exerciseValidationTimerRef) {
      exerciseValidationTimerRef.current = window.setTimeout(() => {
        setExerciseValidationMessage((current) => (
          current === message ? "" : current
        ));
        exerciseValidationTimerRef.current = null;
      }, 2600);
    }
  }

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
      const sets = Array.isArray(currentExercise?.sets) ? currentExercise.sets : [];
      const completedSetsCount = sets.filter((set) => set?.completed).length;
      const hasCompletedSet = completedSetsCount > 0;

      if (sets.length > 0 && !hasCompletedSet) {
        showExerciseValidation("Отметьте хотя бы один подход, чтобы перейти дальше.");
        navigator.vibrate?.(70);
        return;
      }

      if (sets.length > 0 && completedSetsCount > 0 && completedSetsCount < sets.length) {
        const warningKey = `${workout.id || "workout"}:${currentExercise.id || currentExerciseIndex}`;
        const alreadyWarned = partialExerciseWarningKeysRef?.current?.has(warningKey);

        if (!alreadyWarned) {
          partialExerciseWarningKeysRef?.current?.add(warningKey);
          showExerciseValidation("Не все подходы завершены. Нажмите «Далее» еще раз.");
          navigator.vibrate?.(55);
          return;
        }
      }

      if (exerciseValidationTimerRef?.current) {
        window.clearTimeout(exerciseValidationTimerRef.current);
        exerciseValidationTimerRef.current = null;
      }
      setExerciseValidationMessage("");
    }

    if (
      workoutStarted &&
      currentExerciseIndex === workout.exercises.length &&
      !postWorkoutFeedback
    ) {
      setExerciseValidationMessage("");
      setPostWorkoutFeedbackOpen?.(true);
      return;
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
