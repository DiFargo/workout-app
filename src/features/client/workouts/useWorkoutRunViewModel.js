import { useCallback, useMemo } from "react";
import { getWorkoutCompletion } from "../../../utils/auditSafety";

/**
 * The terminal route supplies one runtime boundary instead of a growing prop
 * list. This hook owns route-only commands, leaving stage rendering focused on
 * the selected workout state.
 */
export function useWorkoutRunViewModel(runtime) {
  const {
    workout,
    currentExerciseIndex,
    isWorkoutSaved,
    setCurrentExerciseIndex,
    setFullscreenVideo,
    setIsWorkoutSaved,
    setOpenVideoId,
    setPendingWorkoutFeedback,
    setPostWorkoutFeedback,
    setPostWorkoutFeedbackOpen,
    setSelectedWorkoutId,
    setShowWorkoutSavedCard,
    setWorkoutExitPromptOpen,
    setWorkoutFinishedAt,
    setWorkoutIncompleteConfirmOpen,
    setWorkoutStarted,
    setWorkoutStartedAt,
    saveWorkoutToFirebase,
    pendingWorkoutFeedback,
    leaveWorkoutToPlan,
    showAppError
  } = runtime;
  const isFinishSlideActive = Boolean(
    workout &&
    runtime.workoutStarted &&
    currentExerciseIndex === workout.exercises.length + 1
  );
  const shouldShowTopBackButton = isWorkoutSaved === true && !isFinishSlideActive;

  const closeMissingWorkout = useCallback(() => {
    setSelectedWorkoutId(null);
  }, [setSelectedWorkoutId]);

  const returnFromSavedWorkout = useCallback(() => {
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setIsWorkoutSaved(false);
    setShowWorkoutSavedCard(false);
  }, [
    setCurrentExerciseIndex,
    setIsWorkoutSaved,
    setOpenVideoId,
    setSelectedWorkoutId,
    setShowWorkoutSavedCard,
    setWorkoutFinishedAt,
    setWorkoutStarted,
    setWorkoutStartedAt
  ]);

  const closeExitDialog = useCallback(() => {
    setWorkoutExitPromptOpen(false);
  }, [setWorkoutExitPromptOpen]);

  const leaveFromExitDialog = useCallback(() => {
    setWorkoutExitPromptOpen(false);
    leaveWorkoutToPlan();
  }, [leaveWorkoutToPlan, setWorkoutExitPromptOpen]);

  const continueIncompleteWorkout = useCallback(() => {
    setWorkoutIncompleteConfirmOpen(false);
    setPendingWorkoutFeedback(null);
  }, [setPendingWorkoutFeedback, setWorkoutIncompleteConfirmOpen]);

  const saveIncompleteWorkout = useCallback(() => {
    setWorkoutIncompleteConfirmOpen(false);
    setPendingWorkoutFeedback(null);
    saveWorkoutToFirebase(pendingWorkoutFeedback, true);
  }, [
    pendingWorkoutFeedback,
    saveWorkoutToFirebase,
    setPendingWorkoutFeedback,
    setWorkoutIncompleteConfirmOpen
  ]);

  const selectPostWorkoutFeedback = useCallback((option) => {
    setPostWorkoutFeedback(option);
    setPostWorkoutFeedbackOpen(false);
    setCurrentExerciseIndex(workout.exercises.length + 1);
  }, [
    setCurrentExerciseIndex,
    setPostWorkoutFeedback,
    setPostWorkoutFeedbackOpen,
    workout
  ]);

  const closeFullscreenVideo = useCallback(() => {
    setFullscreenVideo(null);
  }, [setFullscreenVideo]);

  const handleFullscreenVideoError = useCallback(() => {
    setFullscreenVideo(null);
    showAppError("load", "Видео упражнения не поддерживается или временно недоступно.");
  }, [setFullscreenVideo, showAppError]);

  const incompleteCompletion = useMemo(
    () => (workout ? getWorkoutCompletion(workout) : null),
    [workout]
  );

  return {
    workout,
    stageProps: runtime,
    noHeader: runtime.workoutStarted && !runtime.isWorkoutSaved,
    topControls: {
      isSaving: runtime.isSaving,
      showBackButton: shouldShowTopBackButton,
      onExit: runtime.requestLeaveWorkout,
      onBack: returnFromSavedWorkout
    },
    closeMissingWorkout,
    dialogs: {
      readiness: {
        open: runtime.workoutReadinessOpen,
        selectedWorkoutId: runtime.selectedWorkoutId,
        workoutStarted: runtime.workoutStarted,
        pendingOption: runtime.workoutReadinessPending,
        onSelectOption: runtime.setWorkoutReadinessPending,
        onBack: runtime.leaveWorkoutToPlan,
        onApply: runtime.applyWorkoutReadiness
      },
      exit: {
        open: Boolean(runtime.workoutExitPromptOpen && !runtime.workoutDraftRestorePrompt && !runtime.fullscreenVideo),
        onStay: closeExitDialog,
        onLeave: leaveFromExitDialog
      },
      incomplete: {
        open: Boolean(runtime.workoutIncompleteConfirmOpen && !runtime.fullscreenVideo),
        completion: incompleteCompletion,
        onContinue: continueIncompleteWorkout,
        onSave: saveIncompleteWorkout
      },
      feedback: {
        open: runtime.postWorkoutFeedbackOpen,
        isSaving: runtime.isSaving,
        onSelect: selectPostWorkoutFeedback
      }
    },
    onboarding: {
      open: runtime.showFirstSetupOnboarding,
      onboardingStep: runtime.onboardingStep,
      profileDraft: runtime.aiNutritionProfileDraft,
      saveStatus: runtime.firstSetupSaveStatus,
      setOnboardingStep: runtime.setOnboardingStep,
      setProfileDraft: runtime.setAiNutritionProfileDraft,
      onSubmit: runtime.handleFirstSetupSubmit,
      onExit: runtime.logout
    },
    fullscreenVideo: {
      videoSrc: runtime.fullscreenVideo,
      onClose: closeFullscreenVideo,
      onVideoError: handleFullscreenVideoError
    }
  };
}
