function cloneExerciseSet(source = {}) {
  if (typeof structuredClone === "function") return structuredClone(source);
  return JSON.parse(JSON.stringify(source));
}

export function appendExerciseSets(sets, { count = 1, empty = false, defaults = {} } = {}) {
  const currentSets = Array.isArray(sets) && sets.length ? sets : [{}];
  const amount = Math.max(1, Number(count) || 1);
  const sourceSet = { ...defaults, ...(currentSets[0] || {}) };
  const additions = Array.from({ length: amount }, () => empty ? {} : cloneExerciseSet(sourceSet));
  return [...currentSets, ...additions];
}
