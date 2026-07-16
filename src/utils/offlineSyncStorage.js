import { auth } from "../firebase";
import { safeReadJsonStorage, safeWriteJsonStorage } from "./storageSafety";
import {
  getUserScopedStorageKey,
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "./userScopedStorage";

export const NUTRITION_FAILED_SYNC_QUEUE_KEY = "workout_nutrition_failed_sync_v1";
export const WORKOUT_HISTORY_BACKUP_STORAGE_KEY = "workout_history_pending_backup_v1";
export const WORKOUT_FAILED_HISTORY_QUEUE_KEY = "workout_history_failed_queue_v1";
export const MEASUREMENTS_FAILED_SYNC_QUEUE_KEY = "workout_measurements_failed_sync_v1";

export function getFailedMeasurementQueue(uid = auth.currentUser?.uid) {
  const queue = safeReadUserJsonStorage(MEASUREMENTS_FAILED_SYNC_QUEUE_KEY, uid, []);
  return Array.isArray(queue) ? queue : [];
}

export function setFailedMeasurementQueue(uid, queue = []) {
  return safeWriteUserJsonStorage(
    MEASUREMENTS_FAILED_SYNC_QUEUE_KEY,
    uid,
    Array.isArray(queue) ? queue : []
  );
}

export function getFailedNutritionSync(uid = auth.currentUser?.uid) {
  return safeReadUserJsonStorage(NUTRITION_FAILED_SYNC_QUEUE_KEY, uid, null);
}

export function setFailedNutritionSync(uid, nutritionState = null) {
  return safeWriteUserJsonStorage(
    NUTRITION_FAILED_SYNC_QUEUE_KEY,
    uid,
    nutritionState
      ? {
          nutrition: nutritionState,
          queuedAt: new Date().toISOString()
        }
      : null
  );
}

export function removePendingHistoryBackups(uid, clientSaveId) {
  if (!uid || !clientSaveId) return;

  const storageKey = getUserScopedStorageKey(WORKOUT_HISTORY_BACKUP_STORAGE_KEY, uid);
  const current = safeReadJsonStorage(storageKey, []);
  if (!Array.isArray(current)) return;

  safeWriteJsonStorage(
    storageKey,
    current.filter((item) => (
      item?.id !== clientSaveId &&
      item?.entry?.clientSaveId !== clientSaveId
    ))
  );
}

export function getFailedHistoryQueue(uid = auth.currentUser?.uid) {
  return safeReadUserJsonStorage(WORKOUT_FAILED_HISTORY_QUEUE_KEY, uid, []);
}

export function setFailedHistoryQueue(uid, queue = []) {
  return safeWriteUserJsonStorage(WORKOUT_FAILED_HISTORY_QUEUE_KEY, uid, Array.isArray(queue) ? queue : []);
}

export function enqueueFailedHistorySave(uid, entry, reason = "failed_save") {
  const queue = getFailedHistoryQueue(uid);
  const saveId = entry?.clientSaveId || "";

  if (saveId && queue.some((item) => item?.entry?.clientSaveId === saveId)) {
    return queue;
  }

  const nextItem = {
    id: saveId || entry?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    entry,
    reason,
    createdAt: new Date().toISOString()
  };

  setFailedHistoryQueue(uid, [nextItem, ...queue].slice(0, 25));
  return [nextItem, ...queue].slice(0, 25);
}
