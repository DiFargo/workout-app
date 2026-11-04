import { persistWorkoutCompletion } from "../workouts/workoutCompletionPersistence.js";
import {
  getFailedHistoryQueue,
  getFailedNutritionSync,
  acknowledgeHistorySave,
  acknowledgeNutritionSync,
  removePendingHistoryBackups,
} from "../../../utils/offlineSyncStorage";
import { mergeNutritionStates } from "../../../utils/nutritionStateMerge";
import { saveNutritionStateWithMerge } from "../../../utils/nutritionStateStorage";
import { captureAuthSession } from "../../../utils/authSession.js";
import { invalidateWorkoutHistory } from "../../../utils/workoutHistoryRevision.js";
import { invalidateWorkoutPlan } from "../../../utils/workoutPlanAuthority.js";
import { acknowledgeNutritionCloudState, beginNutritionSave, sameNutritionState } from "../../../utils/nutritionSyncRevision.js";

export async function replayFailedHistorySavesWithDeps({
  db,
  auth,
  captureSession = () => captureAuthSession(auth),
  uid,
  historyReplayInProgressRef,
  setWorkoutHistorySyncState,
  loadHistory,
  showAppError
}) {
  const session = captureSession();
  if (!uid || uid !== session.uid || !session.isCurrent()) return;
  if (!(historyReplayInProgressRef.current instanceof Map)) historyReplayInProgressRef.current = new Map();
  const inFlight = historyReplayInProgressRef.current;
  if (inFlight.get(uid)?.isCurrent()) return;

  const queue = getFailedHistoryQueue(uid);
  if (!Array.isArray(queue) || !queue.length) return;

  inFlight.set(uid, session);
  let syncedCount = 0;

  try {
    for (const item of queue) {
      if (!session.isCurrent()) break;
      try {
        if (!item?.entry) continue;
        const saveId = item.entry.clientSaveId || item.id;

        if (!saveId) continue;
        await persistWorkoutCompletion({ db, uid, entry: { ...item.entry, clientSaveId: saveId }, completion: item.completion });
        removePendingHistoryBackups(uid, saveId);
        acknowledgeHistorySave(uid, item);
        syncedCount += 1;
      } catch {
        // Failed and newly enqueued operations remain in the durable queue.
      }
    }

    const remaining = getFailedHistoryQueue(uid);

    if (syncedCount > 0 && session.isCurrent()) {
      invalidateWorkoutHistory(auth);
      invalidateWorkoutPlan(auth);
      setWorkoutHistorySyncState(current => session.isCurrent() ? (remaining.length ? "local" : "synced") : current);
      await loadHistory({ force: true });
      if (session.isCurrent()) showAppError("savedLocal", "Локальные тренировки синхронизированы.");
    }
  } finally {
    if (inFlight.get(uid) === session) inFlight.delete(uid);
  }
  return { syncedCount };
}

export async function replayFailedNutritionSyncWithDeps({
  auth,
  captureSession = () => captureAuthSession(auth),
  uid,
  nutritionReplayInProgressRef,
  setNutrition,
  showAppError
}) {
  const session = captureSession();
  if (!uid || session.uid !== uid || !session.isCurrent()) return;
  // Different accounts/sessions must not block or unlock each other's replay.
  if (!(nutritionReplayInProgressRef.current instanceof Map)) {
    nutritionReplayInProgressRef.current = new Map();
  }
  const inFlight = nutritionReplayInProgressRef.current;
  if (inFlight.get(uid)?.isCurrent()) return;

  const queuedSync = getFailedNutritionSync(uid);
  const queuedNutrition = queuedSync?.nutrition;
  if (!queuedNutrition) return;

  inFlight.set(uid, session);

  try {
    const saveTicket = beginNutritionSave(auth);
    const savedNutrition = await saveNutritionStateWithMerge(uid, queuedNutrition);
    if (!session.isCurrent()) return;
    acknowledgeNutritionCloudState(auth, saveTicket, savedNutrition);
    acknowledgeNutritionSync(uid, queuedSync);
    setNutrition((current) => {
      // React can execute this updater after an auth change as well.
      if (!session.isCurrent() || (current?.__uid && current.__uid !== uid)) return current;
      const next = {
        ...mergeNutritionStates(current, savedNutrition, current?.myFoods || {}),
        __uid: uid
      };
      return sameNutritionState(current, next) ? current : next;
    });
    showAppError("savedLocal", "Локальные данные питания синхронизированы.");
  } catch (error) {
    console.error("Nutrition replay error", error);
    if (session.isCurrent() && error.code === "nutrition/rebase-required") {
      showAppError("savedLocal", "Версия дневника изменилась. Локальные изменения сохранены; для их переноса требуется подтверждение.");
    }
  } finally {
    if (inFlight.get(uid) === session) inFlight.delete(uid);
  }
}
