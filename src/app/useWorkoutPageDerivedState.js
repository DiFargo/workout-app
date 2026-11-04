import { useMemo } from "react";
import { buildWorkoutPageDerivedState } from "../utils/workoutPageDerivedState.js";
import { formatWorkoutElapsedDuration } from "../domain/workoutPresentation.js";

// The clock must not sort/traverse unchanged exercise history every second.
export function useWorkoutPageDerivedState({ plan, selectedWorkoutId, history, workoutStartedAt, workoutFinishedAt, timerTick }) {
  const derived = useMemo(() => buildWorkoutPageDerivedState({ plan, selectedWorkoutId, history }),
    [plan, selectedWorkoutId, history]);
  return { ...derived, workoutDurationText: formatWorkoutElapsedDuration(workoutStartedAt, workoutFinishedAt || timerTick) };
}
