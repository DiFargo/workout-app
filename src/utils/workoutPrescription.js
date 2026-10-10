// Capture before readiness adaptation or client input. Empty/zero prescribed
// values are meaningful, so use nullish checks rather than truthiness.
export function captureWorkoutSetPrescription(set = {}) {
  return {
    ...set,
    targetReps: set.targetReps ?? set.reps ?? "",
    targetWeight: set.targetWeight ?? (set.aiOriginalWeight || set.aiSuggestedWeight || (set.weight ?? "")),
    ...(Number(set.durationSeconds) > 0
      ? { targetDurationSeconds: set.targetDurationSeconds ?? Number(set.durationSeconds) }
      : {})
  };
}
