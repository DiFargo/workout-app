import { auth } from "../firebase.js";
import {
  addLocalBackup,
  DATA_SAFETY_MAX_BACKUPS,
  removeLocalBackup,
  safeReadJsonStorage,
  safeWriteJsonStorage
} from "./storageSafety.js";

export function getUserScopedStorageKey(baseKey, uid = auth.currentUser?.uid) {
  return uid ? `${baseKey}:${uid}` : baseKey;
}

export function safeReadUserJsonStorage(baseKey, uid, fallback = null) {
  return safeReadJsonStorage(getUserScopedStorageKey(baseKey, uid), fallback);
}

export function safeWriteUserJsonStorage(baseKey, uid, value) {
  return safeWriteJsonStorage(getUserScopedStorageKey(baseKey, uid), value);
}

function legacyValueBelongsToUser(value, uid) {
  return Boolean(uid && value && typeof value === "object" && [
    value.__uid,
    value.uid,
    value.userId,
    value.ownerUid
  ].some((ownerUid) => ownerUid === uid));
}

// Old global cache entries have no reliable owner in shared browsers. Move only
// explicitly tagged entries; discard ambiguous ones instead of leaking them.
export function migrateLegacyUserStorage(baseKeys = [], uid = auth.currentUser?.uid) {
  if (!uid || !Array.isArray(baseKeys)) return [];

  const migratedKeys = [];
  baseKeys.forEach((baseKey) => {
    const scopedKey = getUserScopedStorageKey(baseKey, uid);
    if (!baseKey || localStorage.getItem(scopedKey) !== null) return;

    const legacyValue = safeReadJsonStorage(baseKey, null);
    if (legacyValue === null) return;

    if (legacyValueBelongsToUser(legacyValue, uid)) {
      if (safeWriteJsonStorage(scopedKey, legacyValue)) migratedKeys.push(baseKey);
    }

    try {
      localStorage.removeItem(baseKey);
    } catch {
      // ignore localStorage errors
    }
  });

  return migratedKeys;
}

export function addUserLocalBackup(baseKey, uid, item, limit = DATA_SAFETY_MAX_BACKUPS) {
  return addLocalBackup(getUserScopedStorageKey(baseKey, uid), item, limit);
}

export function removeUserLocalBackup(baseKey, uid, backupId) {
  return removeLocalBackup(getUserScopedStorageKey(baseKey, uid), backupId);
}
