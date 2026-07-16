import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import {
  getFailedHistoryQueue,
  getFailedNutritionSync,
  removePendingHistoryBackups,
  setFailedHistoryQueue,
  setFailedNutritionSync
} from "../../../utils/offlineSyncStorage";
import { mergeNutritionStates } from "../../../utils/nutritionStateMerge";
import { saveNutritionStateWithMerge } from "../../../utils/nutritionStateStorage";

export async function replayFailedHistorySavesWithDeps({
  db,
  uid,
  historyReplayInProgressRef,
  setWorkoutHistorySyncState,
  loadHistory,
  showAppError
}) {
  if (!uid || historyReplayInProgressRef.current) return;

  const queue = getFailedHistoryQueue(uid);
  if (!Array.isArray(queue) || !queue.length) return;

  historyReplayInProgressRef.current = true;
  const remaining = [];
  let syncedCount = 0;

  try {
    for (const item of queue) {
      try {
        if (!item?.entry) continue;
        const saveId = item.entry.clientSaveId || item.id;

        if (saveId) {
          await setDoc(doc(db, "users", uid, "history", saveId), item.entry);
          removePendingHistoryBackups(uid, saveId);
        } else {
          await addDoc(collection(db, "users", uid, "history"), item.entry);
        }
        syncedCount += 1;
      } catch {
        remaining.push(item);
      }
    }

    setFailedHistoryQueue(uid, remaining);

    if (syncedCount > 0) {
      setWorkoutHistorySyncState(remaining.length ? "local" : "synced");
      await loadHistory();
      showAppError("savedLocal", "Локальные тренировки синхронизированы.");
    }
  } finally {
    historyReplayInProgressRef.current = false;
  }
}

export async function replayFailedNutritionSyncWithDeps({
  uid,
  nutritionReplayInProgressRef,
  setNutrition,
  showAppError
}) {
  if (!uid || nutritionReplayInProgressRef.current) return;

  const queuedSync = getFailedNutritionSync(uid);
  const queuedNutrition = queuedSync?.nutrition;
  if (!queuedNutrition) return;

  nutritionReplayInProgressRef.current = true;

  try {
    const savedNutrition = await saveNutritionStateWithMerge(uid, queuedNutrition);
    setFailedNutritionSync(uid, null);
    setNutrition((current) => ({
      ...mergeNutritionStates(current, savedNutrition, current.myFoods || {}),
      __uid: uid
    }));
    showAppError("savedLocal", "Локальные данные питания синхронизированы.");
  } catch (error) {
    console.error("Nutrition replay error", error);
  } finally {
    nutritionReplayInProgressRef.current = false;
  }
}
