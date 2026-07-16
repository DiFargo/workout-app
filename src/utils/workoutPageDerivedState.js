import { formatWorkoutElapsedDuration } from "../domain/workoutPresentation";
import { parseWorkoutWeightValue } from "../domain/workoutPresentation";
import { getCompletedWorkoutKey } from "../utils/workoutCompletion";

export function buildWorkoutPageDerivedState({
  plan,
  selectedWorkoutId,
  history,
  workoutStartedAt,
  workoutFinishedAt,
  timerTick
}) {
  const workouts = Array.isArray(plan?.workouts) ? plan.workouts : [];
  const workout = workouts.find((w) => w.id === selectedWorkoutId);

  const workoutVideoUrls = [...new Set(
    (workout?.exercises || [])
      .map((exercise) => exercise?.video || exercise?.videoUrl || exercise?.videoURL || "")
      .filter(Boolean)
  )];
  const workoutVideoCacheKey = workoutVideoUrls.join("|");

  const workoutDurationText = formatWorkoutElapsedDuration(workoutStartedAt, workoutFinishedAt || timerTick);

  const lastExerciseResults = (() => {
    const result = {};
    const currentAssignmentVersion = String(
      workout?.assignedProgramUpdatedAt || plan.assignedProgramUpdatedAt || ""
    ).trim();
    const sortedHistory = [...(Array.isArray(history) ? history : [])].sort(
      (a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
    );

    sortedHistory.forEach((historyWorkout) => {
      if (
        currentAssignmentVersion &&
        String(historyWorkout?.assignedProgramUpdatedAt || "").trim() !== currentAssignmentVersion
      ) {
        return;
      }
      if (!historyWorkout.exercises) return;

      historyWorkout.exercises.forEach((exercise) => {
        const exerciseKey = exercise?.id
          ? `id:${exercise.id}`
          : exercise?.name
            ? `name:${getCompletedWorkoutKey(exercise.name)}`
            : "";
        if (!exerciseKey || result[exerciseKey]) return;

        const completedSets = (exercise.sets || []).filter((set) => (
          Number(set?.reps) > 0 || parseWorkoutWeightValue(set?.weight) > 0
        ));
        if (!completedSets.length) return;

        const lastSet = completedSets[completedSets.length - 1];
        const reps = Number(lastSet?.reps) || 0;
        const weight = parseWorkoutWeightValue(lastSet?.weight);
        const sameReps = reps > 0 && completedSets.every((set) => Number(set?.reps) === reps);
        const sameWeight = weight > 0 && completedSets.every(
          (set) => parseWorkoutWeightValue(set?.weight) === weight
        );

        if (weight > 0) {
          result[exerciseKey] = sameReps && sameWeight
            ? `${completedSets.length}×${reps} · ${weight} кг`
            : `${completedSets.length} подхода · ${reps || "—"} повт. · ${weight} кг`;
          return;
        }

        const totalReps = completedSets.reduce((sum, set) => sum + (Number(set?.reps) || 0), 0);
        result[exerciseKey] = sameReps
          ? `${completedSets.length}×${reps}`
          : `${completedSets.length} подхода · ${totalReps} повторов`;
      });
    });

    return result;
  })();

  return {
    workout,
    workoutVideoUrls,
    workoutVideoCacheKey,
    workoutDurationText,
    lastExerciseResults
  };
}
