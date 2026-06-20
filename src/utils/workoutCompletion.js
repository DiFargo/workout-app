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
