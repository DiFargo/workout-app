import { canToggleWorkoutSetCompleted } from "./workoutSetSequence.js";

// UI selection never changes prescribed values or completion. Group execution
// steps expose a single set, so their next action remains the next group step.
export function getWorkoutPrimaryAction({ sets = [], visibleSetIndexes = null, selectedSetIndex, isLastExercise = false }) {
  const indexes = (Array.isArray(visibleSetIndexes) ? visibleSetIndexes : sets.map((_, index) => index))
    .filter((index) => Number.isInteger(index) && sets[index]);
  const pendingIndex = indexes.find((index) => !sets[index].completed);
  const currentIndex = pendingIndex ?? indexes.at(-1);
  const selectedIndex = indexes.includes(selectedSetIndex) ? selectedSetIndex : currentIndex;
  const next = { kind: "next-exercise", label: isLastExercise ? "Завершить тренировку" : "К следующему упражнению", selectedIndex, disabled: false };

  if (selectedIndex === undefined) return next;
  if (!sets[selectedIndex].completed) {
    if (canToggleWorkoutSetCompleted(sets, selectedIndex)) {
      return { kind: "complete", label: "Завершить подход", selectedIndex, disabled: false };
    }
    return { kind: "select", label: "К текущему подходу", selectedIndex, targetIndex: currentIndex, disabled: selectedIndex === currentIndex };
  }

  const lastCompletedIndex = indexes.findLast((index) => sets[index].completed);
  if (selectedIndex !== lastCompletedIndex) {
    return { kind: "select", label: "К текущему подходу", selectedIndex, targetIndex: currentIndex, disabled: false };
  }
  if (pendingIndex !== undefined) {
    return { kind: "next-set", label: `Перейти к подходу ${pendingIndex + 1} из ${sets.length}`, selectedIndex, targetIndex: pendingIndex, disabled: false };
  }
  return next;
}
