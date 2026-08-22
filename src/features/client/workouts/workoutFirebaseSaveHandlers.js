import { doc, setDoc } from "firebase/firestore";
import {
  enqueueFailedHistorySave,
  removePendingHistoryBackups,
  WORKOUT_HISTORY_BACKUP_STORAGE_KEY
} from "../../../utils/offlineSyncStorage";
import { addUserLocalBackup } from "../../../utils/userScopedStorage";
import { clearWorkoutDraft } from "../../../utils/workoutDraftStorage";
import {
  getWorkoutCompletion,
  isWorkoutSetCompleted
} from "../../../utils/auditSafety";
import { applyWorkoutProgressionToFuturePlan } from "./workoutPlanUpdateHandlers";

export async function saveCompletedWorkoutToFirebase({
  db,
  auth,
  plan,
  workout,
  isSaving,
  isWorkoutSaved,
  workoutStartedAt,
  workoutReadiness,
  workoutClientComment,
  loadHistory,
  showAppError,
  setPendingWorkoutFeedback,
  setWorkoutIncompleteConfirmOpen,
  setWorkoutHistorySyncState,
  setWorkoutFinishedAt,
  setTimerTick,
  timerTickRef,
  setIsSaving,
  setIsWorkoutSaved,
  setShowWorkoutSavedCard,
  setHistory,
  setPlan,
  saveWorkoutsToFirebase,
  feedbackOverride = null,
  allowIncomplete = false
}) {
  if (!workout || isSaving || isWorkoutSaved) return;

  const currentUser = auth.currentUser;
  const hasFilledSet = workout.exercises.some((exercise) =>
    exercise.sets?.some(isWorkoutSetCompleted)
  );
  const workoutCompletion = getWorkoutCompletion(workout);

  if (!currentUser) {
    showAppError("load", "Пользователь не найден. Перезайди в аккаунт.");
    return;
  }

  if (!hasFilledSet) {
    showAppError("validation", "Отметь выполненным хотя бы один подход перед завершением тренировки.");
    return;
  }

  if (workoutCompletion.isPartial && !allowIncomplete) {
    setPendingWorkoutFeedback(feedbackOverride);
    setWorkoutIncompleteConfirmOpen(true);
    return;
  }

  const finishedAt = Date.now();
  const startedAt = workoutStartedAt || finishedAt;
  const durationSeconds = Math.max(0, Math.floor((finishedAt - startedAt) / 1000));
  const historySaveId = `workout_${workout.id}_${finishedAt}`;

  setWorkoutHistorySyncState("saving");
  setWorkoutFinishedAt(finishedAt);
  setTimerTick(finishedAt);
  timerTickRef.current = finishedAt;
  setIsSaving(true);
  setIsWorkoutSaved(false);
  setShowWorkoutSavedCard(false);

  const historyEntry = {
    clientSaveId: historySaveId,
    date: new Date().toISOString(),
    userEmail: currentUser.email || "",
    workout: workout.name,
    workoutName: workout.name,
    workoutId: workout.id,
    assignedProgramId: workout.assignedProgramId || plan.assignedProgramId || "",
    assignedProgramName: workout.assignedProgramName || plan.assignedProgramName || "",
    assignedProgramAddedAt: workout.assignedProgramAddedAt || plan.assignedProgramAddedAt || workout.assignedAt || "",
    assignedProgramUpdatedAt: workout.assignedProgramUpdatedAt || plan.assignedProgramUpdatedAt || "",
    durationSeconds,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    readiness: workoutReadiness ? {
      id: workoutReadiness.id,
      title: workoutReadiness.title,
      emoji: workoutReadiness.emoji,
      weightFactor: workoutReadiness.weightFactor
    } : null,
    postWorkoutFeedback: feedbackOverride ? {
      id: feedbackOverride.id,
      title: feedbackOverride.title,
      emoji: feedbackOverride.emoji,
      advice: feedbackOverride.advice
    } : null,
    ...(workout.source === "basic" || plan.source === "basic"
      ? { personalNote: workoutClientComment.trim() }
      : { clientComment: workoutClientComment.trim() }),
    // Keep the trainer's prescription immutable even when the client changes a set in the run UI.
    plannedSnapshot: {
      workoutId: workout.id,
      workoutName: workout.name,
      exercises: workout.exercises.map((exercise) => ({
        id: exercise.id || "",
        name: exercise.name,
        video: exercise.video || "",
        sets: (exercise.sets || []).map((set, index) => ({
          set: index + 1,
          reps: set.targetReps || set.reps || "",
          weight: set.targetWeight || set.aiOriginalWeight || set.aiSuggestedWeight || "",
          ...(Number(set.durationSeconds) > 0 ? { durationSeconds: Number(set.durationSeconds) } : {})
        }))
      }))
    },
    exercises: workout.exercises.map((exercise) => ({
      id: exercise.id || "",
      name: exercise.name,
      video: exercise.video || "",
      clientNote: String(exercise.clientNote || "").trim(),
      sets: exercise.sets.map((set, index) => {
        const completed = isWorkoutSetCompleted(set);
        const weight = set.enteredWeight || (set.completed ? set.weight : "") || "";
        const enteredReps = set.enteredReps || (set.completed ? set.reps : "") || "";
        const durationSeconds = Number(set.durationSeconds) > 0 ? Number(set.durationSeconds) : 0;

        return {
          set: index + 1,
          reps: durationSeconds ? "" : completed ? enteredReps || set.reps || 8 : "",
          targetReps: durationSeconds ? "" : set.reps || "",
          weight,
          completed,
          ...(durationSeconds ? { durationSeconds, targetDurationSeconds: durationSeconds } : {}),
          aiSuggestedWeight: set.weight || "",
          aiOriginalWeight: set.aiOriginalWeight || "",
          aiReadinessId: set.aiReadinessId || ""
        };
      })
    }))
  };

  const backupId = historySaveId;

  addUserLocalBackup(WORKOUT_HISTORY_BACKUP_STORAGE_KEY, currentUser.uid, {
    id: backupId,
    entry: historyEntry,
    reason: "before_history_save"
  });

  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("workout_history_offline");
    }

    await setDoc(doc(db, "users", currentUser.uid, "history", historySaveId), historyEntry);
    removePendingHistoryBackups(currentUser.uid, backupId);

    await loadHistory();
    clearWorkoutDraft(currentUser.uid, workout.id);
    setIsWorkoutSaved(true);
    setWorkoutHistorySyncState("synced");
    setShowWorkoutSavedCard(true);
    navigator.vibrate?.([100, 70, 150]);

    const progression = applyWorkoutProgressionToFuturePlan(plan, workout, {
      updatedAt: historyEntry.finishedAt
    });
    const planToPersist = progression.changed ? progression.plan : plan;
    const shouldPersistFullBasicPlan = plan?.source === "basic" || workout?.source === "basic";

    if (progression.changed && typeof setPlan === "function") {
      setPlan(planToPersist);
    }

    if ((progression.changed || shouldPersistFullBasicPlan) && typeof saveWorkoutsToFirebase === "function") {
      try {
        const saveResult = await saveWorkoutsToFirebase(planToPersist, { silent: true });
        if (shouldPersistFullBasicPlan && saveResult?.plan?.source === "basic" && typeof setPlan === "function") {
          setPlan(saveResult.plan);
        }
      } catch (progressionError) {
        console.warn("Failed to save workout progression update", progressionError);
      }
    }

    setTimeout(() => {
      setShowWorkoutSavedCard(false);
    }, 1800);
  } catch (e) {
    console.error(e);
    enqueueFailedHistorySave(currentUser.uid, historyEntry, "history_save_failed");
    setHistory((prev) => [
      { id: historySaveId, ...historyEntry, pendingSync: true },
      ...prev.filter((item) => (item?.clientSaveId || item?.id) !== historySaveId)
    ]);
    clearWorkoutDraft(currentUser.uid, workout.id);
    setIsWorkoutSaved(true);
    setWorkoutHistorySyncState("local");
    setShowWorkoutSavedCard(true);
    navigator.vibrate?.([100, 70, 150]);
    showAppError("savedLocal", "Тренировка сохранена локально и будет синхронизирована позже.");
  } finally {
    setIsSaving(false);
  }
}
