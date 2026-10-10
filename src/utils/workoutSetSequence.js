// Keep confirmation and undo ordered without changing any prescribed set data.
export function canToggleWorkoutSetCompleted(sets, index) {
  if (!Array.isArray(sets) || !Number.isInteger(index) || index < 0 || !sets[index]) return false;

  if (sets[index].completed) {
    return !sets.slice(index + 1).some((set) => set?.completed);
  }

  return sets.slice(0, index).every((set) => set?.completed);
}
