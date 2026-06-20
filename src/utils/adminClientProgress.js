import { parseWorkoutWeightValue } from "../domain/workoutPresentation.js";

export function getAdminWorkoutProgressList(historyList = []) {
  const map = {};

  historyList.forEach((item) => {
    (item.exercises || []).forEach((exercise) => {
      const bestWeight = (exercise.sets || []).reduce((best, set) => {
        const weight = parseWorkoutWeightValue(set.weight || set.aiSuggestedWeight);
        return Math.max(best, weight);
      }, 0);

      if (!bestWeight) return;

      if (!map[exercise.name]) {
        map[exercise.name] = [];
      }

      map[exercise.name].push({
        date: item.date,
        weight: bestWeight
      });
    });
  });

  return Object.entries(map)
    .map(([name, points]) => ({
      name,
      points: points.slice(0, 8).reverse(),
      max: Math.max(...points.map((point) => point.weight))
    }))
    .sort((a, b) => b.max - a.max)
    .slice(0, 6);
}

export function getAdminWeightPoints(client = {}) {
  const profile = client.profile || client.aiNutritionProfile || client.bodyMetrics || client;
  const currentWeight = Number(profile?.weight || client?.weight || 0);
  const historyPoints = Array.isArray(client?.weightHistory) ? client.weightHistory : [];

  if (historyPoints.length) {
    return historyPoints
      .map((item) => ({ date: item.date || "", weight: Number(item.weight) || 0 }))
      .filter((item) => item.weight > 0)
      .slice(-8);
  }

  return currentWeight > 0 ? [{ date: "сейчас", weight: currentWeight }] : [];
}

export function getAdminClientChartScales(nutritionDays = [], weightPoints = []) {
  const recentNutritionDays = (Array.isArray(nutritionDays) ? nutritionDays : []).slice(0, 7);
  return {
    maxCalories: Math.max(1, ...recentNutritionDays.map((day) => Number(day?.totals?.calories) || 0)),
    maxProtein: Math.max(1, ...recentNutritionDays.map((day) => Number(day?.totals?.protein) || 0)),
    maxWeight: Math.max(1, ...(Array.isArray(weightPoints) ? weightPoints : []).map((point) => Number(point?.weight) || 0))
  };
}
