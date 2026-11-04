// A selected paused-video frame, in seconds. Null keeps the default preview.
export function isValidExerciseVideoPosterTime(value) {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 86400);
}

export function normalizeExerciseVideoPosterTime(value) {
  return typeof value === "number" && isValidExerciseVideoPosterTime(value)
    ? Math.round(value * 1000) / 1000 : null;
}
