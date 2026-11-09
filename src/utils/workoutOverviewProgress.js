import { canResumeWorkoutDraft } from "./workoutDraftState.js";

// Read completion flags from the same resumable snapshot as the workout runner.
// Entered reps/weight and the current exercise index are not proof of completion.
export function getWorkoutOverviewProgress(workout, draft, assignmentVersion = "") {
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  const savedWorkout = canResumeWorkoutDraft(draft, workout, assignmentVersion)
    ? draft.plan.workouts?.find(item => item?.id === workout.id)
    : null;
  const savedExercises = Array.isArray(savedWorkout?.exercises) ? savedWorkout.exercises : null;
  return exercises.map((exercise, index) => {
    const matches = exercise?.id && savedExercises
      ? savedExercises.filter(item => item?.id === exercise.id) : [];
    // Old snapshots can lack exercise IDs. Only use their stable slot when both
    // snapshots lack an ID and still describe the same exercise.
    const positional = savedExercises?.[index];
    const savedExercise = matches.length === 1 ? matches[0]
      : !exercise?.id && !positional?.id && positional?.name === exercise?.name ? positional : null;
    const source = savedExercises ? savedExercise : exercise;
    const sets = Array.isArray(source?.sets) ? source.sets : [];
    const completedSets = sets.filter(set => set?.completed === true).length;
    const totalSets = sets.length;
    return { completedSets, totalSets, completed: totalSets > 0 && completedSets === totalSets,
      fraction: totalSets > 0 ? completedSets / totalSets : 0 };
  });
}
