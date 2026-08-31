const NEGATIVE_WEIGHT_PREFIX = /^\s*[-−]/;

export function sanitizeExerciseWeightInput(value) {
  if (value === null || value === undefined) return value;

  const text = String(value);
  return NEGATIVE_WEIGHT_PREFIX.test(text) ? "" : value;
}

export function sanitizeExerciseSetPatch(patch) {
  if (!patch || typeof patch !== "object" || !Object.prototype.hasOwnProperty.call(patch, "weight")) {
    return patch;
  }

  return {
    ...patch,
    weight: sanitizeExerciseWeightInput(patch.weight)
  };
}
