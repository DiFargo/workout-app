export function getDefaultNutritionMealByTime(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 21) return "dinner";
  return "snack";
}

export function getNutritionOrbitPoint(angleDeg, radius = 184, centerX = 270, centerY = 232) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Number((centerX + radius * Math.cos(angleRad)).toFixed(2)),
    y: Number((centerY + radius * Math.sin(angleRad)).toFixed(2))
  };
}

export function getNutritionOrbitArcPath(startAngle, endAngle, radius = 184) {
  const start = getNutritionOrbitPoint(startAngle, radius);
  const end = getNutritionOrbitPoint(endAngle, radius);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function getNutritionOrbitSegment(startAngle, arcDegrees, progress) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const endAngle = startAngle + arcDegrees * (safeProgress / 100);
  return {
    hasProgress: safeProgress > 0,
    progressPath: safeProgress > 0 ? getNutritionOrbitArcPath(startAngle, endAngle) : "",
    startDot: getNutritionOrbitPoint(startAngle),
    progressDot: getNutritionOrbitPoint(endAngle)
  };
}

export function todayNutritionKey() {
  return dateToNutritionKey(new Date());
}

export function dateToNutritionKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nutritionKeyToDate(key) {
  const [year, month, day] = String(key || todayNutritionKey()).split("-").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
}

export function shiftNutritionDateKey(key, days) {
  const date = nutritionKeyToDate(key);
  date.setDate(date.getDate() + days);
  return dateToNutritionKey(date);
}

export function makeEmptyNutritionDay() {
  return {
    foods: [],
    water: 0,
    weight: "",
    note: ""
  };
}
