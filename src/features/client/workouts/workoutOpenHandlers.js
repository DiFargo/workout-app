import { getWorkoutReadinessOption } from "../../../domain/workoutPresentation";
import { buildBasicWorkoutPlanFromQuiz } from "../../../utils/basicWorkoutPlanBuilder";
import { safeReadJsonStorage } from "../../../utils/storageSafety";
import {
  clearWorkoutDraft,
  getWorkoutDraftKey
} from "../../../utils/workoutDraftStorage";

export function createWorkoutOpenHandlers({
  APP_PAGES,
  auth,
  user,
  plan,
  basicWorkoutQuiz,
  workoutDraftRestorePrompt,
  loadHistory,
  loadWorkoutsFromFirebase,
  setPlan,
  setSelectedWorkoutId,
  setPage,
  setOpenVideoId,
  setFullscreenVideo,
  setCurrentExerciseIndex,
  setWorkoutStarted,
  setWorkoutStartedAt,
  setWorkoutFinishedAt,
  setWorkoutReadiness,
  setWorkoutReadinessPending,
  setWarmupCompletedSteps,
  setWarmupTimerDuration,
  setWarmupTimerSeconds,
  setWarmupTimerRunning,
  setRestTimerDuration,
  setRestTimerSeconds,
  setRestTimerRunning,
  setExerciseHistoryOpenId,
  setWorkoutHistorySyncState,
  setWorkoutExitPromptOpen,
  setPostWorkoutFeedback,
  setPostWorkoutFeedbackOpen,
  setWorkoutReadinessOpen,
  setIsWorkoutSaved,
  setWorkoutClientComment,
  setShowWorkoutSavedCard,
  setWorkoutDraftRestorePrompt
}) {
  function applyBasicWorkoutPlan() {
    const nextPlan = buildBasicWorkoutPlanFromQuiz(basicWorkoutQuiz);
    setPlan({ workouts: nextPlan.workouts });
    setSelectedWorkoutId(null);
    setPage(APP_PAGES.WORKOUTS);
  }

  function openWorkoutWithDraftChoice(id, savedDraft, shouldRestoreDraft, freshPlan = null) {
    const restoredReadiness = shouldRestoreDraft && savedDraft?.selectedReadiness?.id
      ? getWorkoutReadinessOption(savedDraft.selectedReadiness.id)
      : null;
    const restoredPostWorkoutFeedback =
      shouldRestoreDraft && savedDraft?.selectedPostWorkoutFeedback?.id
        ? savedDraft.selectedPostWorkoutFeedback
        : null;

    if (shouldRestoreDraft) {
      setPlan(savedDraft.plan);
    } else if (freshPlan) {
      setPlan(freshPlan);
    }

    setSelectedWorkoutId(id);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(shouldRestoreDraft ? Number(savedDraft.currentExerciseIndex) || 0 : 0);
    setWorkoutStarted(Boolean(shouldRestoreDraft));
    setWorkoutStartedAt(shouldRestoreDraft ? savedDraft.workoutStartedAt || Date.now() : null);
    setWorkoutFinishedAt(shouldRestoreDraft ? savedDraft.workoutFinishedAt || null : null);
    setWorkoutReadiness(restoredReadiness);
    setWorkoutReadinessPending(restoredReadiness);
    setWarmupCompletedSteps(
      shouldRestoreDraft && Array.isArray(savedDraft?.warmupCompletedSteps)
        ? savedDraft.warmupCompletedSteps
        : []
    );
    const restoredWarmupDuration = Number(savedDraft?.warmupTimerDuration) || 300;
    setWarmupTimerDuration(restoredWarmupDuration);
    setWarmupTimerSeconds(
      shouldRestoreDraft
        ? Number.isFinite(Number(savedDraft?.warmupTimerSeconds))
          ? Math.max(0, Number(savedDraft.warmupTimerSeconds))
          : restoredWarmupDuration
        : restoredWarmupDuration
    );
    setWarmupTimerRunning(false);
    const restoredRestDuration = Number(savedDraft?.restTimerDuration) || 90;
    setRestTimerDuration(restoredRestDuration);
    setRestTimerSeconds(
      shouldRestoreDraft ? Math.max(0, Number(savedDraft?.restTimerSeconds) || 0) : 0
    );
    setRestTimerRunning(false);
    setExerciseHistoryOpenId("");
    setWorkoutHistorySyncState("idle");
    setWorkoutExitPromptOpen(false);
    setPostWorkoutFeedback(restoredPostWorkoutFeedback);
    setPostWorkoutFeedbackOpen(false);
    setWorkoutReadinessOpen(!shouldRestoreDraft);
    setIsWorkoutSaved(false);
    setWorkoutClientComment("");
    setShowWorkoutSavedCard(false);
    loadHistory();
  }

  function openWorkout(id) {
    const currentUser = auth.currentUser || user;
    const savedDraft = currentUser?.uid ? safeReadJsonStorage(getWorkoutDraftKey(currentUser.uid, id), null) : null;
    const selectedPlanWorkout = plan.workouts.find((workoutItem) => workoutItem.id === id);
    const currentAssignmentVersion =
      selectedPlanWorkout?.assignedProgramUpdatedAt ||
      plan.assignedProgramUpdatedAt ||
      "";
    const draftAssignmentVersion =
      savedDraft?.assignmentVersion ||
      savedDraft?.assignedProgramUpdatedAt ||
      savedDraft?.plan?.assignedProgramUpdatedAt ||
      "";
    const draftMatchesCurrentProgram =
      currentAssignmentVersion
        ? draftAssignmentVersion === currentAssignmentVersion
        : true;

    if (savedDraft && !draftMatchesCurrentProgram && currentUser?.uid) {
      clearWorkoutDraft(currentUser.uid, id);
    }

    const canRestoreDraft =
      draftMatchesCurrentProgram &&
      savedDraft?.workoutId === id &&
      savedDraft?.plan;

    if (canRestoreDraft) {
      setWorkoutDraftRestorePrompt({ workoutId: id, savedDraft });
      return;
    }

    openWorkoutWithDraftChoice(id, savedDraft, false);
  }

  async function handleWorkoutDraftChoice(shouldRestoreDraft) {
    const pendingDraft = workoutDraftRestorePrompt;
    if (!pendingDraft) return;

    setWorkoutDraftRestorePrompt(null);
    if (!shouldRestoreDraft) {
      const currentUser = auth.currentUser || user;
      const fallbackPlan = {
        ...plan,
        workouts: plan.workouts.map((workoutItem) => (
          workoutItem.id !== pendingDraft.workoutId
            ? workoutItem
            : {
                ...workoutItem,
                exercises: workoutItem.exercises.map((exercise) => ({
                  ...exercise,
                  sets: exercise.sets.map((set) => {
                    const {
                      aiOriginalWeight,
                      aiReadinessId,
                      aiReadinessTitle,
                      completed,
                      ...cleanSet
                    } = set;

                    return {
                      ...cleanSet,
                      weight: aiOriginalWeight || set.weight || "",
                      enteredReps: "",
                      enteredWeight: ""
                    };
                  })
                }))
              }
        ))
      };

      if (currentUser?.uid) {
        clearWorkoutDraft(currentUser.uid, pendingDraft.workoutId);
      }

      const freshPlan = await loadWorkoutsFromFirebase(currentUser?.uid);
      openWorkoutWithDraftChoice(
        pendingDraft.workoutId,
        null,
        false,
        freshPlan?.workouts?.some((item) => item.id === pendingDraft.workoutId)
          ? freshPlan
          : fallbackPlan
      );
      return;
    }

    openWorkoutWithDraftChoice(
      pendingDraft.workoutId,
      pendingDraft.savedDraft,
      true
    );
  }

  return {
    applyBasicWorkoutPlan,
    openWorkout,
    handleWorkoutDraftChoice
  };
}
