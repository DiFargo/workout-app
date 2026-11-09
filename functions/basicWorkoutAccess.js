// A plan, invitation, local code or remembered mode is not an access grant.
// Only the administrator-controlled profile flag enables basic training.
export function hasBasicWorkoutAccess(profile = {}) {
  return profile?.basicWorkoutAccess === true && profile?.active !== false &&
    profile?.archived !== true && profile?.accessDisabled !== true &&
    !["revoked", "suspended"].includes(profile?.membershipStatus);
}

export function assertBasicWorkoutAccess(profile = {}) {
  if (hasBasicWorkoutAccess(profile)) return;
  const error = new Error("Доступ к базовым тренировкам открывает администратор. Обратитесь к нему, чтобы включить этот режим.");
  error.code = "basic_workout_access_required";
  error.status = 403;
  throw error;
}
