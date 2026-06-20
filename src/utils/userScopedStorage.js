import { auth } from "../firebase";
import {
  addLocalBackup,
  DATA_SAFETY_MAX_BACKUPS,
  removeLocalBackup,
  safeReadJsonStorage,
  safeWriteJsonStorage
} from "./storageSafety";

export function getUserScopedStorageKey(baseKey, uid = auth.currentUser?.uid) {
  return uid ? `${baseKey}:${uid}` : baseKey;
}

export function safeReadUserJsonStorage(baseKey, uid, fallback = null) {
  return safeReadJsonStorage(getUserScopedStorageKey(baseKey, uid), fallback);
}

export function safeWriteUserJsonStorage(baseKey, uid, value) {
  return safeWriteJsonStorage(getUserScopedStorageKey(baseKey, uid), value);
}

export function addUserLocalBackup(baseKey, uid, item, limit = DATA_SAFETY_MAX_BACKUPS) {
  return addLocalBackup(getUserScopedStorageKey(baseKey, uid), item, limit);
}

export function removeUserLocalBackup(baseKey, uid, backupId) {
  return removeLocalBackup(getUserScopedStorageKey(baseKey, uid), backupId);
}
