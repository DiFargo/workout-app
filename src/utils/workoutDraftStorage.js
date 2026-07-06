import {
  getUserScopedStorageKey,
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "./userScopedStorage";

const WORKOUT_DRAFT_STORAGE_KEY = "workout_active_draft_v1";
const WORKOUT_ASSIGNMENT_STORAGE_KEY = "workout_assignment_version_v1";
const DEFAULT_WORKOUT_STORAGE_KEY = "workout_tracker_v1";
const DEFAULT_WORKOUT_PLAN_BACKUP_STORAGE_KEY = "workout_plan_backup_v1";

export function getWorkoutDraftKey(uid, workoutId) {
  return `${WORKOUT_DRAFT_STORAGE_KEY}:${uid || "unknown"}:${workoutId || "unknown"}`;
}

export function clearWorkoutDraft(uid, workoutId) {
  try {
    localStorage.removeItem(getWorkoutDraftKey(uid, workoutId));
  } catch {
    // ignore localStorage errors
  }
}

export function clearStaleWorkoutCaches(
  uid,
  assignedProgramUpdatedAt,
  {
    workoutStorageKey = DEFAULT_WORKOUT_STORAGE_KEY,
    workoutPlanBackupStorageKey = DEFAULT_WORKOUT_PLAN_BACKUP_STORAGE_KEY
  } = {}
) {
  if (!uid || !assignedProgramUpdatedAt) return;

  const savedAssignmentVersion = safeReadUserJsonStorage(WORKOUT_ASSIGNMENT_STORAGE_KEY, uid, "");
  if (savedAssignmentVersion === assignedProgramUpdatedAt) return;

  try {
    const draftPrefix = `${WORKOUT_DRAFT_STORAGE_KEY}:${uid}:`;
    const draftKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(draftPrefix)) draftKeys.push(key);
    }
    draftKeys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(getUserScopedStorageKey(workoutStorageKey, uid));
    localStorage.removeItem(getUserScopedStorageKey(workoutPlanBackupStorageKey, uid));
  } catch {
    // ignore localStorage errors
  }

  safeWriteUserJsonStorage(WORKOUT_ASSIGNMENT_STORAGE_KEY, uid, assignedProgramUpdatedAt);
}
