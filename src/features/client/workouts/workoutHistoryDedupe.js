function getWorkoutRunKey(item = {}) {
  const workoutId = String(item.workoutId || item.workoutName || item.workout || "").trim();
  const startedAt = String(item.startedAt || "").trim();
  const assignmentId = String(item.assignedProgramUpdatedAt || item.assignedProgramAddedAt || item.assignedProgramId || "").trim();

  return workoutId && startedAt
    ? `run:${assignmentId}:${workoutId}:${startedAt}`
    : `record:${item.clientSaveId || item.id || ""}`;
}

export function dedupeWorkoutHistory(items = []) {
  const uniqueRuns = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = getWorkoutRunKey(item);
    const existing = uniqueRuns.get(key);
    if (!existing || new Date(item.finishedAt || item.date || 0) > new Date(existing.finishedAt || existing.date || 0)) {
      uniqueRuns.set(key, item);
    }
  });

  return Array.from(uniqueRuns.values());
}
