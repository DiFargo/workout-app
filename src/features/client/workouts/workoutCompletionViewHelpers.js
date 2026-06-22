export function createWorkoutCompletionViewHelpers({
  plan,
  history,
  buildCompletedWorkoutSet,
  getWorkoutAssignmentVersion,
  isWorkoutCompletedWithSet
}) {
  function getCompletedWorkoutSet(
    historyItems = [],
    currentAssignmentVersion = getWorkoutAssignmentVersion(plan)
  ) {
    return buildCompletedWorkoutSet(historyItems, currentAssignmentVersion);
  }

  function isWorkoutCompletedByHistory(
    workoutItem,
    completedSet = getCompletedWorkoutSet(history)
  ) {
    return isWorkoutCompletedWithSet(
      workoutItem,
      completedSet,
      getWorkoutAssignmentVersion(plan)
    );
  }

  return {
    getCompletedWorkoutSet,
    isWorkoutCompletedByHistory
  };
}
