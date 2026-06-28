export function createWorkoutCompletionViewHelpers({
  plan,
  history,
  workoutCalendar,
  buildCompletedWorkoutSet,
  getWorkoutAssignmentVersion,
  isWorkoutCompletedWithSet
}) {
  function getCompletedWorkoutSet(
    historyItems = [],
    currentAssignmentVersion = getWorkoutAssignmentVersion(plan)
  ) {
    return buildCompletedWorkoutSet(historyItems, currentAssignmentVersion, workoutCalendar);
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
