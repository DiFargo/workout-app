import { buildWorkoutCompletionOperation, persistWorkoutCompletion } from "./workoutCompletionPersistence.js";
import {
  enqueueFailedHistorySave,
  forgetPendingHistorySave,
  removePendingHistoryBackups,
  WORKOUT_HISTORY_BACKUP_STORAGE_KEY
} from "../../../utils/offlineSyncStorage";
import { addUserLocalBackup } from "../../../utils/userScopedStorage";
import { clearWorkoutDraft } from "../../../utils/workoutDraftStorage";
import { captureAuthSession } from "../../../utils/authSession.js";
import { captureWorkoutSetPrescription } from "../../../utils/workoutPrescription.js";
import {
  getWorkoutCompletion,
  isWorkoutSetCompleted
} from "../../../utils/auditSafety";

export async function saveCompletedWorkoutToFirebase({
  db,
  auth,
  captureSession = () => captureAuthSession(auth),
  plan,
  workout,
  isSaving,
  workoutSaveInFlightRef,
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
  feedbackOverride = null,
  allowIncomplete = false
}) {
  const session = captureSession();
  const inFlight = workoutSaveInFlightRef?.current;
  const currentSaveInFlight = inFlight && (inFlight === true || inFlight.session?.isCurrent());
  if (!workout || isWorkoutSaved || currentSaveInFlight || (isSaving && !inFlight)) return;
  const applyState = (setter, value) => {
    if (session.isCurrent() && typeof setter === "function") {
      setter(current => session.isCurrent() ? (typeof value === "function" ? value(current) : value) : current);
    }
  };

  const currentUser = auth.currentUser;
  const hasFilledSet = workout.exercises.some((exercise) =>
    exercise.sets?.some(isWorkoutSetCompleted)
  );
  const workoutCompletion = getWorkoutCompletion(workout);

  if (!currentUser || currentUser.uid !== session.uid || !session.isCurrent()) {
    showAppError("load", "Пользователь не найден. Перезайди в аккаунт.");
    return;
  }

  if (!hasFilledSet) {
    showAppError("validation", "Отметь выполненным хотя бы один подход перед завершением тренировки.");
    return;
  }

  if (workoutCompletion.isPartial && !allowIncomplete) {
    applyState(setPendingWorkoutFeedback, feedbackOverride);
    applyState(setWorkoutIncompleteConfirmOpen, true);
    return;
  }

  const finishedAt = Date.now();
  const startedAt = workoutStartedAt || finishedAt;
  const durationSeconds = Math.max(0, Math.floor((finishedAt - startedAt) / 1000));
  const historySaveId = `workout_${workout.id}_${startedAt}`;

  const operation = { session };
  if (workoutSaveInFlightRef) workoutSaveInFlightRef.current = operation;

  applyState(setWorkoutHistorySyncState, "saving");
  applyState(setWorkoutFinishedAt, finishedAt);
  applyState(setTimerTick, finishedAt);
  timerTickRef.current = finishedAt;
  applyState(setIsSaving, true);
  applyState(setIsWorkoutSaved, false);
  applyState(setShowWorkoutSavedCard, false);

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
        sets: (exercise.sets || []).map((set, index) => {
          const prescribed = captureWorkoutSetPrescription(set);
          return { set: index + 1, reps: prescribed.targetReps, weight: prescribed.targetWeight,
            ...(Number(prescribed.targetDurationSeconds) > 0 ? { durationSeconds: Number(prescribed.targetDurationSeconds) } : {}) };
        })
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
  const completion = buildWorkoutCompletionOperation(plan, workout);

  try {
    try {
      addUserLocalBackup(WORKOUT_HISTORY_BACKUP_STORAGE_KEY, currentUser.uid, {
        id: backupId, entry: historyEntry, completion, reason: "before_history_save"
      });
    } catch (error) {
      // A full local store must not prevent an otherwise available cloud save.
      console.warn("Workout history backup failed:", error);
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("workout_history_offline");
    }

    const result = await persistWorkoutCompletion({ db, uid: currentUser.uid, entry: historyEntry, completion });
    forgetPendingHistorySave(currentUser.uid, historySaveId);
    removePendingHistoryBackups(currentUser.uid, backupId);
    if (!session.isCurrent()) return;
    clearWorkoutDraft(currentUser.uid, workout.id);
    if (result.plan) applyState(setPlan, result.plan);

    await loadHistory();
    if (!session.isCurrent()) return;
    applyState(setIsWorkoutSaved, true);
    applyState(setWorkoutHistorySyncState, "synced");
    applyState(setShowWorkoutSavedCard, true);
    navigator.vibrate?.([100, 70, 150]);

    setTimeout(() => {
      applyState(setShowWorkoutSavedCard, false);
    }, 1800);
  } catch (e) {
    console.error(e);
    try {
      enqueueFailedHistorySave(currentUser.uid, historyEntry, "history_save_failed", completion);
    } catch {
      if (session.isCurrent()) {
        applyState(setWorkoutHistorySyncState, "error");
        showAppError("storage", "Не удалось сохранить тренировку ни в облаке, ни на устройстве. Освободите место или восстановите сеть и нажмите сохранение ещё раз.");
      }
      return;
    }
    if (!session.isCurrent()) return;
    clearWorkoutDraft(currentUser.uid, workout.id);
    applyState(setHistory, (prev) => [
      { id: historySaveId, ...historyEntry, pendingSync: true },
      ...prev.filter((item) => (item?.clientSaveId || item?.id) !== historySaveId)
    ]);
    applyState(setIsWorkoutSaved, true);
    applyState(setWorkoutHistorySyncState, "local");
    applyState(setShowWorkoutSavedCard, true);
    navigator.vibrate?.([100, 70, 150]);
    showAppError("savedLocal", "Тренировка сохранена локально и будет синхронизирована позже.");
  } finally {
    if (workoutSaveInFlightRef?.current === operation) workoutSaveInFlightRef.current = false;
    applyState(setIsSaving, false);
  }
}
