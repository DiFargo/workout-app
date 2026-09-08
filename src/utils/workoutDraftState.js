export function canResumeWorkoutDraft(draft, workout, assignmentVersion = "", completed = false) {
  if (completed || !workout?.id || draft?.workoutId !== workout.id || !draft?.plan) return false;
  const currentVersion = workout.assignedProgramUpdatedAt || assignmentVersion || "";
  const draftVersion = draft.assignmentVersion || draft.assignedProgramUpdatedAt || draft.plan.assignedProgramUpdatedAt || "";
  return !currentVersion || draftVersion === currentVersion;
}
