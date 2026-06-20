import { sumNutritionFoods } from "./nutritionFoodTotals.js";

export function buildAdminNutritionDaysList(
  nutritionState = null,
  { history = [], defaultNutritionState = {}, buildDayModel = null } = {}
) {
  return Object.entries(nutritionState?.days || {})
    .map(([date, day]) => {
      const totals = sumNutritionFoods(day.foods || []);
      const model = typeof buildDayModel === "function"
        ? buildDayModel({ ...defaultNutritionState, ...(nutritionState || {}) }, day, history)
        : null;

      return {
        date,
        foods: day.foods || [],
        totals,
        score: Number(model?.score) || 0
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function buildAdminNutritionRecommendations({
  profile = {},
  historyList = [],
  nutritionState = null,
  days = [],
  defaultProteinGoal = 0,
  now = Date.now()
} = {}) {
  const today = days[0];
  const badFeedback = (Array.isArray(historyList) ? historyList : [])
    .filter((item) => item.postWorkoutFeedback?.id === "bad").length;
  const lastWorkoutDate = historyList[0]?.date ? new Date(historyList[0].date) : null;
  const daysSinceWorkout = lastWorkoutDate
    ? Math.round((now - lastWorkoutDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const proteinGoal = Number(nutritionState?.goals?.protein || defaultProteinGoal);
  const proteinToday = Number(today?.totals?.protein || 0);

  const recommendations = [];

  if (badFeedback >= 2) {
    recommendations.push("Снизить нагрузку на 1 неделю: у клиента несколько плохих feedback.");
  }

  if (proteinToday > 0 && proteinToday < proteinGoal * 0.7) {
    recommendations.push("Добавить белок: сегодня заметно меньше цели.");
  }

  if (daysSinceWorkout !== null && daysSinceWorkout >= 5) {
    recommendations.push("Клиент давно не тренировался — стоит написать и упростить вход в тренировку.");
  }

  if (!profile?.goal) {
    recommendations.push("Обновить анкету/AI-план: не заполнена цель клиента.");
  }

  if (!recommendations.length) {
    recommendations.push("Клиент выглядит стабильно: можно продолжать текущий план.");
  }

  return recommendations;
}
