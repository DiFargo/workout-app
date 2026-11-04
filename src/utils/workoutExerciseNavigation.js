import { isWorkoutSetCompleted } from "./auditSafety.js";

// A grouped exercise has one row, even when its rounds occupy several steps.
// Navigation selects an existing step; it never changes completion or sets.
export function buildWorkoutExercisePickerItems(workout = {}, executionSteps = [], currentStepIndex = 0) {
  const items = [];
  const seen = new Set();
  for (const step of executionSteps) {
    if (seen.has(step.exerciseId)) continue;
    seen.add(step.exerciseId);
    const exercise = workout.exercises?.[step.exerciseIndex];
    if (!exercise) continue;
    const steps = executionSteps.map((item, index) => ({ ...item, stepIndex: index + 1 }))
      .filter(item => item.exerciseId === step.exerciseId);
    const current = steps.find(item => item.stepIndex === currentStepIndex);
    const target = current || steps.find(item => Number.isInteger(item.setIndex)
      ? !isWorkoutSetCompleted(exercise.sets?.[item.setIndex])
      : (exercise.sets || []).some(set => !isWorkoutSetCompleted(set))) || steps.at(-1);
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    const completed = sets.filter(isWorkoutSetCompleted).length;
    items.push({
      key: step.exerciseId, title: exercise.name || "Упражнение", stepIndex: target.stepIndex,
      current: Boolean(current), status: sets.length && completed === sets.length ? "completed" : completed ? "partial" : "pending",
      detail: target.group
        ? `${target.group.groupMode === "triset" ? "Трисет" : "Суперсет"} · круг ${target.setIndex + 1} из ${steps.length}`
        : `${completed} из ${sets.length} подходов`
    });
  }
  return items;
}
