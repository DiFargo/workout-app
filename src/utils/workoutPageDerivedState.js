import { formatWorkoutElapsedDuration } from "../domain/workoutPresentation";
import { buildLatestExerciseResults } from "../../functions/workoutExerciseResults.js";
import { getClientWorkoutLatestResults } from "./clientWorkoutEvidence.js";

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

  const assignmentVersion = String(workout?.assignedProgramUpdatedAt || plan?.assignedProgramUpdatedAt || "").trim();
  const lastExerciseResults = getClientWorkoutLatestResults(plan, assignmentVersion, history)
    || buildLatestExerciseResults(history, assignmentVersion);

  return {
    workout,
    workoutVideoUrls,
    workoutVideoCacheKey,
    workoutDurationText,
    lastExerciseResults
  };
}
