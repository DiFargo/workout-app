export const BASIC_WORKOUT_LONG_PLAN_ACCESS_STORAGE_KEY = "basic-workout-long-plan-access";

const BASIC_WORKOUT_LONG_PLAN_ACCESS_CODE = "1111";

export function isBasicWorkoutLongPlanAccessCode(value) {
  return String(value || "").trim() === BASIC_WORKOUT_LONG_PLAN_ACCESS_CODE;
}

export function getBasicWorkoutLongPlanAccessStorageKey(userId = "") {
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId
    ? `${BASIC_WORKOUT_LONG_PLAN_ACCESS_STORAGE_KEY}:${normalizedUserId}`
    : BASIC_WORKOUT_LONG_PLAN_ACCESS_STORAGE_KEY;
}

export function hasBasicWorkoutLongPlanAccess(record) {
  return Boolean(record && typeof record === "object" && record.activated === true);
}

export function createBasicWorkoutLongPlanAccessRecord(activatedAt = new Date().toISOString()) {
  return {
    activated: true,
    activatedAt
  };
}
