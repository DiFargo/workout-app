export function roundMacro(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

export function parseNutritionNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
