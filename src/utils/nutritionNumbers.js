export function roundMacro(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

export function parseNutritionNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPositiveNutritionNumber(primary, fallback, defaultValue = 0) {
  const primaryNumber = Number(primary);
  if (Number.isFinite(primaryNumber) && primaryNumber > 0) return primaryNumber;

  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber > 0 ? fallbackNumber : defaultValue;
}
