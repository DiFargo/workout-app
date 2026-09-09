export const TRAINER_SUMMARY_SOURCE_TIMEOUT_MS = 4000;
export const TRAINER_SUMMARY_BATCH_TIMEOUT_MS = 12000;
export const TRAINER_SUMMARY_CACHE_MS = 60000;
export const TRAINER_SUMMARY_LIMITS = Object.freeze({ history: 64, measurements: 8, workouts: 100, tasks: 64 });
export const TRAINER_SUMMARY_SOURCES = ["history", "nutrition", "measurements", "payment", "workouts", "tasks"];

export function withSummaryDeadline(read, timeoutMs = TRAINER_SUMMARY_SOURCE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("Истекло время ожидания"), { code: "summary/timeout" })), Math.max(1, timeoutMs));
    Promise.resolve().then(read).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

const FIELD_SOURCES = {
  lastWorkoutAt: ["history"], workouts7: ["history"], workouts30: ["history"], workoutDateKeysCurrentWeek: ["history"],
  lastNutritionAt: ["nutrition"], nutritionDays7: ["nutrition"], averageCalories7: ["nutrition"],
  lastMeasurementAt: ["measurements"], plateau: ["measurements"], payment: ["payment"], paymentAttention: ["payment"],
  activeTrainerTasksCount: ["tasks"], workoutFeedbackAttention: ["history"],
  completedWorkoutCount: ["workouts", "history"], programCompletionPercent: ["workouts", "history"], programEndingAttention: ["workouts", "history"],
  weeklyProgressScore: ["history", "nutrition", "measurements", "workouts"], recentEvents: ["history", "nutrition", "measurements"]
};

export function reconcileTrainerSummary(computed, previous = {}, sources, now = Date.now()) {
  const result = { ...computed };
  for (const [field, required] of Object.entries(FIELD_SOURCES)) {
    if (required.some((source) => sources[source]?.state !== "fresh")) result[field] = previous[field] ?? null;
  }
  if (computed.assignmentHistoryComplete === false) {
    for (const field of ["completedWorkoutCount", "programCompletionPercent", "programEndingAttention"]) result[field] = null;
  }
  const failedSources = TRAINER_SUMMARY_SOURCES.filter((source) => sources[source]?.state !== "fresh");
  return { ...result, sources, failedSources, trainerSummaryState: failedSources.length ? "partial" : "fresh", trainerSummarySettled: true,
    trainerSummaryReady: !failedSources.length, lastUpdatedAt: failedSources.length ? previous.lastUpdatedAt || null : now, lastAttemptAt: now };
}

export function isTrainerSummarySourceFresh(summary, source) {
  // Legacy synthetic summaries and already loaded client pages have no read state.
  return !summary?.sources || summary.sources[source]?.state === "fresh";
}
