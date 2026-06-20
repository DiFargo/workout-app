export function getCompletedWorkoutKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCompletedWorkoutSet(historyItems = [], currentAssignmentVersion = "") {
  const completed = new Set();
  const assignmentVersion = String(currentAssignmentVersion || "").trim();

  (Array.isArray(historyItems) ? historyItems : []).forEach((item) => {
    if (assignmentVersion) {
      if (
        String(item?.assignedProgramUpdatedAt || "").trim() === assignmentVersion &&
        item?.workoutId
      ) {
        completed.add(`id:${getCompletedWorkoutKey(item.workoutId)}`);
      }
      return;
    }

    const workoutName = item?.workoutName || item?.workout;
    if (workoutName) completed.add(`name:${getCompletedWorkoutKey(workoutName)}`);
    if (item?.workoutId) completed.add(`id:${getCompletedWorkoutKey(item.workoutId)}`);
  });

  return completed;
}

export function isWorkoutCompletedWithSet(workoutItem, completedSet = new Set(), currentAssignmentVersion = "") {
  if (!workoutItem) return false;

  const manualStatus = String(workoutItem.status || "").trim().toLowerCase();
  if (manualStatus === "completed") return true;
  if (["not_completed", "missed"].includes(manualStatus)) return false;

  const assignmentVersion = String(
    workoutItem.assignedProgramUpdatedAt || currentAssignmentVersion || ""
  ).trim();
  const workoutIdKey = `id:${getCompletedWorkoutKey(workoutItem.id)}`;

  if (assignmentVersion) {
    return completedSet.has(workoutIdKey);
  }

  return completedSet.has(workoutIdKey) ||
    completedSet.has(`name:${getCompletedWorkoutKey(workoutItem.name)}`);
}

export function getNextUncompletedWorkoutIndex(
  workouts = [],
  completedSet = new Set(),
  currentAssignmentVersion = ""
) {
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const index = safeWorkouts.findIndex((workoutItem) => (
    !isWorkoutCompletedWithSet(workoutItem, completedSet, currentAssignmentVersion)
  ));

  return index >= 0 ? index : 0;
}
