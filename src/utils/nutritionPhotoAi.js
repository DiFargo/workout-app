export function getNutritionPhotoAiConfidenceText(confidence) {
  const numericConfidence = Number(confidence);
  if (Number.isFinite(numericConfidence) && numericConfidence > 0) {
    const percent = numericConfidence <= 1 ? Math.round(numericConfidence * 100) : Math.round(numericConfidence);
    return `${Math.min(100, percent)}% уверенности`;
  }

  const textConfidence = String(confidence || "").trim();
  return textConfidence ? textConfidence : "";
}
