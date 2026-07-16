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

export function buildAdminNutritionMonthOverview(days = [], { todayKey = new Date().toISOString().slice(0, 10) } = {}) {
  const safeDays = Array.isArray(days) ? days : [];
  const baseDate = safeDays[0]?.date ? new Date(`${safeDays[0].date}T12:00:00`) : new Date(`${todayKey}T12:00:00`);
  const monthStart = Number.isNaN(baseDate.getTime())
    ? new Date()
    : new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const startOffset = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - startOffset);

  const nutritionByDate = new Map(safeDays.map((day) => [day.date, day]));
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const day = nutritionByDate.get(key) || { date: key, totals: { calories: 0, protein: 0, fat: 0, carbs: 0 }, foods: [] };

    return {
      key,
      date,
      day,
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: key === todayKey
    };
  });

  const daysInPlan = monthDays.filter((item) => item.inMonth && nutritionByDate.has(item.key));
  const calories = daysInPlan.reduce((sum, item) => sum + (Number(item.day.totals?.calories) || 0), 0);
  const protein = daysInPlan.reduce((sum, item) => sum + (Number(item.day.totals?.protein) || 0), 0);
  const averageDivisor = Math.max(1, daysInPlan.length);

  return {
    days: monthDays,
    label: monthStart.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    averageCalories: calories / averageDivisor,
    averageProtein: protein / averageDivisor,
    trackedDaysCount: daysInPlan.length
  };
}

export function getAdminNutritionDayMetrics(day = {}, goals = {}) {
  const totals = day?.totals || {};
  const calories = Number(totals.calories) || 0;
  const protein = Number(totals.protein) || 0;
  const fat = Number(totals.fat) || 0;
  const carbs = Number(totals.carbs) || 0;
  const calorieGoal = Number(goals.calories) || 2400;
  const proteinGoal = Number(goals.protein) || 160;
  const fatGoal = Number(goals.fat) || 75;
  const carbsGoal = Number(goals.carbs) || 260;

  return {
    calories,
    protein,
    fat,
    carbs,
    caloriePercent: Math.min(100, Math.round((calories / calorieGoal) * 100)),
    proteinPercent: Math.min(100, Math.round((protein / proteinGoal) * 100)),
    fatPercent: Math.min(100, Math.round((fat / fatGoal) * 100)),
    carbsPercent: Math.min(100, Math.round((carbs / carbsGoal) * 100)),
    isHighCalories: calories > calorieGoal,
    hasFood: calories > 0 || protein > 0 || fat > 0 || carbs > 0
  };
}

export function hasAdminWorkoutOnDate(historyList = [], dateKey = "") {
  return (Array.isArray(historyList) ? historyList : []).some((workout) => {
    if (!workout?.date) return false;
    const parsed = new Date(workout.date);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.toISOString().slice(0, 10) === dateKey;
  });
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
