import {
  getUserScopedStorageKey,
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "./userScopedStorage";
import { safeReadJsonStorage, safeWriteJsonStorage } from "./storageSafety";
import { canResumeWorkoutDraft } from "./workoutDraftState";
import { clearWorkoutDraftFallback, readWorkoutDraftFallbackResult, writeWorkoutDraftFallback } from "./workoutDraftFallbackStorage.js";

const WORKOUT_DRAFT_STORAGE_KEY = "workout_active_draft_v1";
const WORKOUT_ASSIGNMENT_STORAGE_KEY = "workout_assignment_version_v1";
const DEFAULT_WORKOUT_STORAGE_KEY = "workout_tracker_v1";
const DEFAULT_WORKOUT_PLAN_BACKUP_STORAGE_KEY = "workout_plan_backup_v1";
const pendingFallbacks = new Map();
const lastWriteTimes = new Map();

export function getWorkoutDraftKey(uid, workoutId) {
  return `${WORKOUT_DRAFT_STORAGE_KEY}:${uid || "unknown"}:${workoutId || "unknown"}`;
}

export function getNewestWorkoutDraft(localDraft, fallbackDraft) {
  if (!localDraft) return fallbackDraft;
  if (!fallbackDraft) return localDraft;
  return (Date.parse(fallbackDraft.savedAt) || 0) > (Date.parse(localDraft.savedAt) || 0)
    ? fallbackDraft : localDraft;
}

export async function readWorkoutDraft(uid, workoutId) {
  if (!uid || !workoutId) return null;
  await pendingFallbacks.get(getWorkoutDraftKey(uid, workoutId))?.drained;
  const result = await readWorkoutDraftFallbackResult(uid, workoutId);
  if (!result.available) throw new Error("workout_draft_fallback_unavailable");
  const local = safeReadJsonStorage(getWorkoutDraftKey(uid, workoutId), null);
  const localDraft = local?.workoutId === workoutId && (!local.uid || local.uid === uid) ? local : null;
  const draft = getNewestWorkoutDraft(localDraft, result.draft);
  const key = getWorkoutDraftKey(uid, workoutId);
  lastWriteTimes.set(key, Math.max(lastWriteTimes.get(key) || 0, Date.parse(draft?.savedAt) || 0));
  return draft;
}

function cancelPendingFallback(key) {
  const entry = pendingFallbacks.get(key);
  if (!entry) return;
  entry.latest?.resolve(false);
  entry.latest = null;
  pendingFallbacks.delete(key);
}

function queueFallback(uid, workoutId, draft) {
  const key = getWorkoutDraftKey(uid, workoutId);
  let entry = pendingFallbacks.get(key);
  if (!entry) {
    let finish;
    entry = { latest: null, running: false, drained: new Promise(resolve => { finish = resolve; }), finish: () => finish() };
    pendingFallbacks.set(key, entry);
  }
  const pending = new Promise(resolve => {
    // At most one committed write and one newest waiting snapshot per workout.
    // A ticking timer must not build an unbounded queue behind denied storage.
    entry.latest?.resolve(false);
    entry.latest = { draft, resolve };
  });
  if (!entry.running) {
    entry.running = true;
    void (async () => {
      try {
        while (pendingFallbacks.get(key) === entry && entry.latest) {
          const current = entry.latest;
          entry.latest = null;
          let saved = false;
          try { saved = await writeWorkoutDraftFallback(uid, workoutId, current.draft); } catch { /* Report a real failure. */ }
          current.resolve(saved);
        }
      } finally {
        if (pendingFallbacks.get(key) === entry) pendingFallbacks.delete(key);
        entry.finish();
      }
    })();
  }
  return pending;
}

// Keep the synchronous unload-safe path. Only use the separate browser store
// when Web Storage cannot commit the draft; never replace a good draft with an
// in-memory-only success flag.
export function saveWorkoutDraft(uid, workoutId, draft) {
  if (!uid || !workoutId || draft?.uid !== uid || draft.workoutId !== workoutId) return false;
  const key = getWorkoutDraftKey(uid, workoutId);
  const previous = safeReadJsonStorage(key, null);
  const savedTime = Math.max(Date.now(), Date.parse(draft.savedAt) || 0,
    (Date.parse(previous?.savedAt) || 0) + 1, (lastWriteTimes.get(key) || 0) + 1);
  lastWriteTimes.set(key, savedTime);
  const snapshot = { ...draft, savedAt: new Date(savedTime).toISOString() };
  if (safeWriteJsonStorage(key, snapshot)) {
    cancelPendingFallback(key);
    return true;
  }
  try { if (!globalThis.indexedDB) return false; } catch { return false; }
  try { return queueFallback(uid, workoutId, JSON.parse(JSON.stringify(snapshot))); } catch { return false; }
}

export function clearWorkoutDraft(uid, workoutId) {
  const key = getWorkoutDraftKey(uid, workoutId);
  cancelPendingFallback(key);
  lastWriteTimes.delete(key);
  try {
    localStorage.removeItem(getWorkoutDraftKey(uid, workoutId));
  } catch {
    // ignore localStorage errors
  }
  void clearWorkoutDraftFallback(uid, workoutId);
}

export function clearStaleWorkoutCaches(
  uid,
  assignedProgramUpdatedAt,
  {
    workoutStorageKey = DEFAULT_WORKOUT_STORAGE_KEY,
    workoutPlanBackupStorageKey = DEFAULT_WORKOUT_PLAN_BACKUP_STORAGE_KEY,
    workouts = []
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
    draftKeys.forEach((key) => {
      const draft = safeReadJsonStorage(key, null);
      const savedWorkout = draft?.plan?.workouts?.find((workout) => workout.id === draft.workoutId);
      // Loading an individual assignment must not erase a basic-mode session,
      // or a valid draft just because this device has no assignment marker yet.
      if (draft?.plan?.source === "basic" || savedWorkout?.source === "basic" ||
          String(draft?.assignmentVersion || draft?.assignedProgramUpdatedAt || "").startsWith("basic:")) return;
      const currentWorkout = workouts.find((workout) => workout.id === draft?.workoutId);
      if (canResumeWorkoutDraft(draft, currentWorkout || { id: draft?.workoutId }, assignedProgramUpdatedAt)) return;
      localStorage.removeItem(key);
    });
    localStorage.removeItem(getUserScopedStorageKey(workoutStorageKey, uid));
    localStorage.removeItem(getUserScopedStorageKey(workoutPlanBackupStorageKey, uid));
  } catch {
    // ignore localStorage errors
  }

  safeWriteUserJsonStorage(WORKOUT_ASSIGNMENT_STORAGE_KEY, uid, assignedProgramUpdatedAt);
}
