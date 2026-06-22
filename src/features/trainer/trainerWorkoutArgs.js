export function getTrainerNextWorkoutId(args, constructorMode = false) {
  if (constructorMode && args.length >= 3) return args[2];
  return args[0];
}

export function getTrainerNextExerciseId(args, constructorMode = false) {
  if (constructorMode && args.length >= 4) return args[3];
  return args[1];
}

export function getTrainerNextExerciseSetIndex(args, constructorMode = false) {
  if (constructorMode && args.length >= 5) return args[4];
  return args[2];
}

export function getTrainerNextPatch(args) {
  return args[args.length - 1];
}

export function getTrainerNextWorkoutSourceExercise(args, constructorMode = false) {
  const candidate = constructorMode ? args[3] : args[1];
  return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : null;
}
