export function resolveAssignedTrainerId(data = {}) {
  const state = String(data.trainerAssignmentState || "").trim().toLowerCase();
  const assigned = String(data.assignedTrainerId || data.trainerId || data.coachId || "").trim();
  // An explicit lifecycle state is authoritative, including unknown future
  // states. Historical creators authorize access only for legacy documents.
  if (state) return state === "assigned" ? assigned : "";
  return assigned || String(data.createdByUid || "").trim();
}
