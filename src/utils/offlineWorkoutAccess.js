import { safeReadUserJsonStorage, safeWriteUserJsonStorage } from "./userScopedStorage.js";

const PROFILE_KEY = "workout_offline_member_v1";
const PLAN_KEY = "workout_offline_plan_certificate_v1";
const PROFILE_FIELDS = ["role", "accountAccessStatus", "trainerAssignmentState", "active", "archived",
  "accessDisabled", "membershipStatus", "assignedProgramId", "assignedProgramAt", "assignedProgramAddedAt",
  "assignedProgramUpdatedAt", "assignedProgramLifecycleStatus", "trainerUid", "trainerId", "trainerEmail",
  "workoutModePreference", "accountProfile", "name", "appTheme", "aiNutritionProfile", "aiNutritionPlan",
  "firstSetupCompleted", "firstSetupCompletedVersion", "firstSetupCompletedAt"];
const PRESENTATION_FIELDS = ["accountProfile", "name", "appTheme", "aiNutritionProfile", "aiNutritionPlan",
  "firstSetupCompleted", "firstSetupCompletedVersion", "firstSetupCompletedAt"];

export function isOfflineClientProfile(profile = {}) {
  return profile.role === "client" && profile.active !== false && profile.archived !== true
    && profile.accessDisabled !== true && !["revoked", "suspended"].includes(profile.membershipStatus)
    && profile.accountAccessStatus !== "awaiting_trainer" && profile.trainerAssignmentState !== "unassigned";
}

// This is a local continuity policy, not server authorization. Offline clients
// cannot know about a revocation that has not reached the device yet. Online
// reads and every server write continue to verify current membership.
export function rememberOfflineClientProfile(uid, profile, confirmed = false, { partial = false } = {}) {
  if (!uid || !confirmed) return;
  if (!isOfflineClientProfile(profile)) {
    safeWriteUserJsonStorage(PROFILE_KEY, uid, null);
    for (const mode of ["individual", "basic"]) safeWriteUserJsonStorage(`${PLAN_KEY}:${mode}`, uid, null);
    return;
  }
  const cached = Object.fromEntries(PROFILE_FIELDS.filter(key => Object.hasOwn(profile, key)).map(key => [key, profile[key]]));
  if (partial) {
    const previous = safeReadUserJsonStorage(PROFILE_KEY, uid, null);
    if (previous?.uid === uid && Number(previous.verifiedAt) > 0) {
      for (const key of PRESENTATION_FIELDS) {
        if (!Object.hasOwn(cached, key) && Object.hasOwn(previous.profile || {}, key)) cached[key] = previous.profile[key];
      }
    }
  }
  safeWriteUserJsonStorage(PROFILE_KEY, uid, { uid, profile: cached, verifiedAt: Date.now() });
}

export function readOfflineClientProfile(uid) {
  if (!uid || typeof navigator === "undefined" || navigator.onLine !== false) return null;
  const cached = safeReadUserJsonStorage(PROFILE_KEY, uid, null);
  return cached?.uid === uid && Number(cached.verifiedAt) > 0 && isOfflineClientProfile(cached.profile)
    ? cached.profile : null;
}

function planIdentity(plan = {}) {
  return JSON.stringify({ source: plan.source || "individual", version: plan.assignedProgramUpdatedAt || "",
    workouts: (plan.workouts || []).map(workout => [workout.id, workout.assignedProgramId || "",
      workout.assignedProgramAddedAt || "", workout.assignedProgramUpdatedAt || "",
      (workout.exercises || []).map(exercise => exercise.id || exercise.name || "")]) });
}

export function rememberOfflineWorkoutPlan(uid, mode, plan, profile) {
  if (!uid || !["individual", "basic"].includes(mode) || !Array.isArray(plan?.workouts)) return;
  rememberOfflineClientProfile(uid, profile, true, { partial: true });
  if (!isOfflineClientProfile(profile)) return;
  safeWriteUserJsonStorage(`${PLAN_KEY}:${mode}`, uid, { uid, mode, identity: planIdentity(plan), verifiedAt: Date.now() });
}

export function readOfflineWorkoutPlan(uid, mode, storageKey) {
  if (!readOfflineClientProfile(uid) || !storageKey) return null;
  const certificate = safeReadUserJsonStorage(`${PLAN_KEY}:${mode}`, uid, null);
  const plan = safeReadUserJsonStorage(storageKey, uid, null);
  return certificate?.uid === uid && certificate.mode === mode && Number(certificate.verifiedAt) > 0
    && Array.isArray(plan?.workouts) && plan.workouts.length > 0 && certificate.identity === planIdentity(plan)
    ? plan : null;
}
