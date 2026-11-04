import { dedupeWorkoutHistory } from "../../functions/workoutHistoryDedupe.js";
import { buildLatestExerciseResults } from "../../functions/workoutExerciseResults.js";

// A JSON/localStorage flag alone is never confirmation. The loader binds this
// exact object to its current auth/history/plan generation after verification.
const confirmations = new WeakMap();
export function rememberClientWorkoutEvidence(readModel, isCurrent) {
  if (readModel && typeof readModel === "object" && typeof isCurrent === "function") confirmations.set(readModel, isCurrent);
}

export function getClientWorkoutReadModel(plan) {
  const model = plan?.readModel;
  return model?.schemaVersion === 1 && model.coverage === "complete" && typeof model.sourceRevision === "string" &&
    Array.isArray(model.completionHistory) && confirmations.get(model)?.() ? model : null;
}

export function getClientWorkoutCompletionHistory(plan, history = []) {
  const model = getClientWorkoutReadModel(plan);
  if (!model) return Array.isArray(history) ? history : [];
  // Committed global history can be older than this server snapshot (e.g. a
  // deletion on another device). Only unsynced local results overlay authority.
  return dedupeWorkoutHistory([...model.completionHistory, ...(Array.isArray(history) ? history : []).filter(item => item.pendingSync)]);
}

export function getClientWorkoutLatestResults(plan, assignmentVersion, history = []) {
  const model = getClientWorkoutReadModel(plan);
  if (!model || !Object.hasOwn(model.latestExerciseResultsByAssignment || {}, assignmentVersion)) return null;
  const result = { ...model.latestExerciseResultsByAssignment[assignmentVersion] };
  const serverDates = model.latestExerciseResultDatesByAssignment?.[assignmentVersion] || {};
  const pendingDates = {};
  const pending = buildLatestExerciseResults((Array.isArray(history) ? history : []).filter(item => item.pendingSync), assignmentVersion,
    { resultDates: pendingDates });
  for (const [key, value] of Object.entries(pending)) {
    if (!result[key] || (Date.parse(pendingDates[key]) || 0) >= (Date.parse(serverDates[key]) || 0)) result[key] = value;
  }
  return result;
}
