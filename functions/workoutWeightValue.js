export function parseWorkoutWeightValue(value) {
  const numeric = Number(String(value || "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}
