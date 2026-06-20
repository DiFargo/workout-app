import { sumNutritionFoods } from "./nutritionFoodTotals.js";
import { pluralizeRu } from "./trainerAttention.js";
import {
  getTrainerSummaryDayStart,
  getTrainerSummaryDaysSince,
  getTrainerSummaryTimestamp
} from "./trainerSummaryDates.js";

export function getTrainerNutritionSummary(nutritionState = null) {
  const todayStart = getTrainerSummaryDayStart();
  const sevenDayStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const recordedDays = Object.entries(nutritionState?.days || {})
    .map(([date, day]) => {
      const foods = Array.isArray(day?.foods) ? day.foods : [];
      const totals = sumNutritionFoods(foods);
      return {
        date,
        timestamp: getTrainerSummaryTimestamp(date),
        calories: totals.calories,
        hasData: foods.length > 0
      };
    })
    .filter((day) => day.hasData && day.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp);
  const lastSevenDays = recordedDays.filter((day) => (
    day.timestamp >= sevenDayStart && day.timestamp < todayStart
  ));

  return {
    lastNutritionAt: recordedDays[0]?.date || "",
    nutritionDays7: lastSevenDays.length,
    averageCalories7: lastSevenDays.length
      ? Math.round(lastSevenDays.reduce((sum, day) => sum + day.calories, 0) / lastSevenDays.length)
      : null
  };
}

export function getClientActivityStatus(summary = {}) {
  if (!summary.assignedProgramId) {
    return { id: "noProgram", label: "Без программы" };
  }

  const workoutDays = getTrainerSummaryDaysSince(summary.lastWorkoutAt);
  const nutritionDays = getTrainerSummaryDaysSince(summary.lastNutritionAt);
  const measurementDays = getTrainerSummaryDaysSince(summary.lastMeasurementAt);

  if (workoutDays !== null && workoutDays >= 14) {
    return { id: "lost", label: "Пропал" };
  }
  if (
    workoutDays === null ||
    workoutDays >= 7 ||
    nutritionDays === null ||
    nutritionDays >= 5 ||
    measurementDays === null ||
    measurementDays >= 30 ||
    summary.plateau?.isPlateau ||
    ["overdue", "soon"].includes(summary.paymentAttention?.id)
  ) {
    return { id: "attention", label: "Требует внимания" };
  }

  return { id: "active", label: "Активный" };
}

export function getTrainerDayWord(value) {
  return pluralizeRu(value, "день", "дня", "дней");
}

export function getClientAttentionReasons(summary = {}) {
  if (!summary.assignedProgramId) return ["нет программы"];

  const reasons = [];
  const workoutDays = getTrainerSummaryDaysSince(summary.lastWorkoutAt);
  const nutritionDays = getTrainerSummaryDaysSince(summary.lastNutritionAt);
  const measurementDays = getTrainerSummaryDaysSince(summary.lastMeasurementAt);

  if (workoutDays === null) reasons.push("нет данных о тренировках");
  else if (workoutDays >= 7) reasons.push(`нет тренировок ${workoutDays} ${getTrainerDayWord(workoutDays)}`);

  if (nutritionDays === null) reasons.push("нет данных о питании");
  else if (nutritionDays >= 5) reasons.push(`нет питания ${nutritionDays} ${getTrainerDayWord(nutritionDays)}`);

  if (measurementDays === null) reasons.push("нет замеров");
  else if (measurementDays >= 30) reasons.push(`нет замера ${measurementDays} ${getTrainerDayWord(measurementDays)}`);
  if (summary.plateau?.isPlateau) reasons.push(`вес стоит ${summary.plateau.days} ${getTrainerDayWord(summary.plateau.days)}`);
  if (["overdue", "soon"].includes(summary.paymentAttention?.id)) {
    reasons.push(summary.paymentAttention.label.toLowerCase());
  }

  return reasons.length ? reasons : ["активность в норме"];
}
