import { fillMissingDraftExercisePreview } from "./workoutMediaMerge.js";
import { createPersistableWorkoutPlan } from "./workoutPlanStorage.js";

export function canResumeWorkoutDraft(draft, workout, assignmentVersion = "", completed = false) {
  if (completed || !workout?.id || draft?.workoutId !== workout.id || !draft?.plan) return false;
  const currentVersion = workout.assignedProgramUpdatedAt || assignmentVersion || "";
  const draftVersion = draft.assignmentVersion || draft.assignedProgramUpdatedAt || draft.plan.assignedProgramUpdatedAt || "";
  return !currentVersion || draftVersion === currentVersion;
}

export function createWorkoutDraftPlan(plan, workoutId) {
  const workout = plan?.workouts?.find((item) => item.id === workoutId);
  if (!workout) return null;
  const savedWorkout = { ...workout };
  delete savedWorkout._editorSnapshot;
  return { ...createPersistableWorkoutPlan(plan), workouts: [savedWorkout] };
}

export function restoreWorkoutDraftPlan(plan, draft) {
  const currentWorkout = plan?.workouts?.find((item) => item.id === draft?.workoutId);
  if (!canResumeWorkoutDraft(draft, currentWorkout, plan?.assignedProgramUpdatedAt)) return plan;
  const savedWorkout = draft?.plan?.workouts?.find((item) => item.id === draft.workoutId);
  if (!savedWorkout) return plan;
  return {
    ...plan,
    workouts: plan.workouts.map((workout) => workout.id === draft.workoutId
      ? { ...workout, exercises: (savedWorkout.exercises || []).map(exercise => {
        const matches = (workout.exercises || []).filter(item => item.id === exercise.id);
        return fillMissingDraftExercisePreview(exercise, matches.length === 1 ? matches[0] : null);
      }), taskBlocks: savedWorkout.taskBlocks ?? workout.taskBlocks }
      : workout)
  };
}
