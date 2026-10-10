// Shared, numeric-only framing metadata. Null preserves the original fit.
export function isValidExerciseVideoCrop(value) {
  return value === null || Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 3 && ["x", "y", "zoom"].every(key => Number.isFinite(value[key]))
    && value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1 && value.zoom >= 1 && value.zoom <= 3);
}

export function normalizeExerciseVideoCrop(value) {
  return value && isValidExerciseVideoCrop(value) ? { x: value.x, y: value.y, zoom: value.zoom } : null;
}
