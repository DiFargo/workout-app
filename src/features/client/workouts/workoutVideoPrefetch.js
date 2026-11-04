import { normalizeExerciseVideoPosterTime } from "../../../../functions/exerciseVideoPoster.js";
import { getWorkoutExecutionSteps } from "../../../utils/workoutPlanNormalization.js";

// Only the next two distinct images, never the MP4 or the whole library.
// At readiness/warmup the first exercise is upcoming; during a set its own
// player owns the current image request, leaving this list to prepare next.
export function upcomingWorkoutVideoPreviews({
  workout, currentExerciseIndex = 0, workoutStarted = false, isWorkoutSaved = false,
  resolveExercise = exercise => exercise
}) {
  if (!workout || isWorkoutSaved) return [];
  const steps = getWorkoutExecutionSteps(workout);
  const start = workoutStarted ? Math.max(0, currentExerciseIndex) : 0;
  const currentStep = workoutStarted && currentExerciseIndex > 0 ? steps[currentExerciseIndex - 1] : null;
  const current = currentStep ? resolveExercise(workout.exercises[currentStep.exerciseIndex]) : null;
  const keyOf = exercise => JSON.stringify([
    exercise?.video || exercise?.videoUrl || exercise?.videoURL,
    normalizeExerciseVideoPosterTime(exercise?.videoPosterTime)
  ]);
  const seen = new Set(current ? [keyOf(current)] : []);
  const previews = [];
  for (const step of steps.slice(start)) {
    const exercise = resolveExercise(workout.exercises[step.exerciseIndex]);
    const previewTime = normalizeExerciseVideoPosterTime(exercise?.videoPosterTime);
    const source = exercise?.video || exercise?.videoUrl || exercise?.videoURL;
    const key = JSON.stringify([source, previewTime]);
    if (!source || previewTime === null || seen.has(key)) continue;
    seen.add(key);
    previews.push({ source, previewTime });
    if (previews.length === 2) break;
  }
  return previews;
}
