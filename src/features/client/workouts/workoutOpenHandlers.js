import { getWorkoutReadinessOption } from "../../../domain/workoutPresentation";
import { buildBasicWorkoutPlanFromQuiz } from "../../../utils/basicWorkoutPlanBuilder";
import { syncWorkoutCalendarWithPlan } from "../../../utils/workoutSchedule";
import { safeReadJsonStorage } from "../../../utils/storageSafety";
import { safeWriteUserJsonStorage } from "../../../utils/userScopedStorage";
import { doc, writeBatch } from "firebase/firestore";
import {
  clearWorkoutDraft,
  getWorkoutDraftKey
} from "../../../utils/workoutDraftStorage";

export function createWorkoutOpenHandlers({
  APP_PAGES,
  STORAGE_KEY,
  BASIC_WORKOUT_PLAN_STORAGE_KEY,
  WORKOUT_MODE_STORAGE_KEY,
  auth,
  db,
  user,
  plan,
  history,
  basicWorkoutQuiz,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  workoutDraftRestorePrompt,
  loadHistory,
  loadWorkoutsFromFirebase,
  setPlan,
  setSelectedWorkoutId,
  setIndividualWorkoutIndex,
  setIndividualWorkoutIndexInitialized,
  setPage,
  setWorkoutModePreference,
  setWorkoutModeRemember,
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
  async function applyBasicWorkoutPlan(quizOverride = basicWorkoutQuiz) {
    const currentUser = auth.currentUser || user;
    const nextPlan = buildBasicWorkoutPlanFromQuiz(quizOverride, undefined, {
      profile: aiNutritionProfile || aiNutritionProfileDraft,
      history
    });
    const nextPlanState = {
      ...nextPlan,
      source: "basic",
      basicPlanId: nextPlan.basicPlanId || nextPlan.id,
      basicPlanName: nextPlan.basicPlanName || nextPlan.name
    };
    const nextWorkoutModePreference = {
      mode: "basic",
      remember: true,
      updatedAt: new Date().toISOString()
    };
    const nextWorkoutCalendar = syncWorkoutCalendarWithPlan({
      ...(user?.workoutCalendar || {}),
      scheduledDates: (nextPlanState.workouts || []).map((workout) => workout.scheduledDate || workout.plannedDate || ""),
      monthlyTrainingDates: (nextPlanState.workouts || []).map((workout) => workout.scheduledDate || workout.plannedDate || ""),
      plannedWorkouts: []
    }, nextPlanState.workouts, nextWorkoutModePreference.updatedAt, currentUser?.uid || "");
    if (!currentUser?.uid) {
      return { cloudSaved: false, error: new Error("basic_plan_user_missing") };
    }

    if (!db) {
      return { cloudSaved: false, error: new Error("basic_plan_database_unavailable") };
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { cloudSaved: false, offline: true };
    }

    try {
      const basicPlanBatch = writeBatch(db);
      const userRef = doc(db, "users", currentUser.uid);
      const nextBasicWorkoutIds = new Set((nextPlanState.workouts || []).map((workout) => workout.id));
      const previousBasicWorkouts = plan?.source === "basic" && Array.isArray(plan?.workouts)
        ? plan.workouts
        : [];

      previousBasicWorkouts.forEach((workout) => {
        if (workout?.id && !nextBasicWorkoutIds.has(workout.id)) {
          basicPlanBatch.delete(doc(db, "users", currentUser.uid, "workouts", workout.id));
        }
      });

      for (const [workoutIndex, workout] of (nextPlanState.workouts || []).entries()) {
        basicPlanBatch.set(doc(db, "users", currentUser.uid, "workouts", workout.id), {
            id: workout.id,
            source: "basic",
            name: workout.name || `День ${workoutIndex + 1}`,
            order: workoutIndex + 1,
            sortOrder: workoutIndex + 1,
            status: workout.status || "planned",
            statusUpdatedAt: workout.statusUpdatedAt || "",
            scheduledDate: workout.scheduledDate || "",
            plannedDate: workout.plannedDate || "",
            movedToDate: workout.movedToDate || "",
            assignedBy: currentUser.uid,
            assignedAt: nextWorkoutModePreference.updatedAt,
            assignedProgramId: workout.assignedProgramId || nextPlanState.assignedProgramId || nextPlanState.basicPlanId || "",
            assignedProgramName: workout.assignedProgramName || nextPlanState.assignedProgramName || nextPlanState.basicPlanName || "",
            assignedProgramUpdatedAt: workout.assignedProgramUpdatedAt || nextPlanState.assignedProgramUpdatedAt || "",
            exercises: (workout.exercises || []).map((exercise, exerciseIndex) => ({
              id: exercise.id || `${workout.id}_exercise_${exerciseIndex + 1}`,
              name: exercise.name || "",
              video: exercise.video || exercise.videoUrl || exercise.videoURL || "",
              rest: exercise.rest || "",
              requiresWeight: exercise.requiresWeight ?? true,
              usesWeight: exercise.usesWeight ?? exercise.requiresWeight ?? true,
              note: exercise.note || "",
              description: exercise.description || "",
              technique: exercise.technique || "",
              sets: (exercise.sets || []).map((set) => ({
                ...(set?.id ? { id: set.id } : {}),
                reps: set?.reps ?? "",
                weight: set?.weight ?? "",
                ...(Number(set?.durationSeconds) > 0 ? { durationSeconds: Number(set.durationSeconds) } : {}),
                ...(set?.startingWeightSource ? { startingWeightSource: set.startingWeightSource } : {}),
                ...(set?.startingWeightConfirmed ? { startingWeightConfirmed: true } : {})
              }))
            }))
        }, { merge: true });
      }

      basicPlanBatch.set(userRef, {
        basicWorkoutPlan: nextPlanState,
        workoutCalendar: nextWorkoutCalendar,
        workoutModePreference: nextWorkoutModePreference,
        updatedAt: nextWorkoutModePreference.updatedAt
      }, { merge: true });

      await basicPlanBatch.commit();
    } catch (error) {
      console.warn("Basic workout mode sync error", error);
      return {
        cloudSaved: false,
        offline: typeof navigator !== "undefined" && navigator.onLine === false,
        error
      };
    }

    setPlan(nextPlanState);
    setWorkoutModePreference?.(nextWorkoutModePreference);
    setWorkoutModeRemember?.(true);
    safeWriteUserJsonStorage(BASIC_WORKOUT_PLAN_STORAGE_KEY || STORAGE_KEY, currentUser.uid, nextPlanState);
    if (WORKOUT_MODE_STORAGE_KEY) {
      safeWriteUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, currentUser.uid, nextWorkoutModePreference);
    }
    setSelectedWorkoutId(null);
    setIndividualWorkoutIndex?.(0);
    setIndividualWorkoutIndexInitialized?.(false);
    setPage(APP_PAGES.WORKOUTS);
    return { cloudSaved: true };
  }

  function openWorkoutWithDraftChoice(id, savedDraft, shouldRestoreDraft, freshPlan = null) {
    const restoredReadiness = shouldRestoreDraft && savedDraft?.selectedReadiness?.id
      ? getWorkoutReadinessOption(savedDraft.selectedReadiness.id)
      : getWorkoutReadinessOption("good");
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
