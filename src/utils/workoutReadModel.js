import { buildCompletedWorkoutSet, getWorkoutAssignmentVersion, isWorkoutCompletedWithSet } from "./workoutCompletion.js";
import { buildWorkoutPageDerivedState } from "./workoutPageDerivedState.js";

// Pure shadow projection only: no persisted schema or replacement authority.
// A page of history cannot certify completion or absence of previous results.
export function buildWorkoutReadModel({ plan, history = [], historyComplete = false, historyRevision = "" }) {
  const assignmentVersion = getWorkoutAssignmentVersion(plan);
  const base = { schemaVersion: 1, assignmentVersion, historyRevision,
    coverage: historyComplete ? "complete" : "partial" };
  if (!historyComplete) return { ...base, completion: null, latestResults: null };
  const workouts = plan?.workouts || [];
  const completed = buildCompletedWorkoutSet(history, assignmentVersion, {}, workouts);
  const completion = workouts.map(workout => ({
    workoutId: workout.id,
    completed: isWorkoutCompletedWithSet(workout, completed, assignmentVersion),
    manualStatus: workout.status || "planned",
    // Keep source evidence: deleting history must not erase manual completion.
    historyIds: history.filter(entry => isWorkoutCompletedWithSet({ ...workout, status: "planned" },
      buildCompletedWorkoutSet([entry], assignmentVersion, {}, workouts), assignmentVersion))
      .map(entry => entry.clientSaveId || entry.id)
  }));
  const latestResults = Object.fromEntries(workouts.map(workout => [workout.id,
    buildWorkoutPageDerivedState({ plan, selectedWorkoutId: workout.id, history }).lastExerciseResults]));
  return { ...base, completion, latestResults };
}
