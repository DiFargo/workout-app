import { defaultNutritionState } from "../data/nutritionDefaults";
import { getAiNutritionHistoryBaseline } from "../data/aiNutritionBaseline";
import { makeEmptyNutritionDay, todayNutritionKey } from "../domain/nutritionPresentation";
import { getShortFoodName } from "./nutritionFoodPresentation";
import { sumNutritionFoods } from "./nutritionFoodTotals";

export { sumNutritionFoods } from "./nutritionFoodTotals";

export function getNutritionDayTotals(day = {}, includeCount = false) {
  return sumNutritionFoods(day.foods || [], includeCount);
}

export function buildNutritionHistoryDays(days = {}, limit = 7) {
  return Object.entries(days || {})
    .map(([date, day]) => ({
      date,
      day,
      totals: getNutritionDayTotals(day, true)
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function getAiNutritionTotalsForToday(nutrition = {}) {
  const today = nutrition.days?.[todayNutritionKey()] || {};
  return getNutritionDayTotals(today);
}

export function getAiNutritionTargetFromHistory(nutrition = defaultNutritionState) {
  const goals = nutrition.goals || defaultNutritionState.goals;
  const historyAverage = getAiNutritionHistoryBaseline().average;

  return {
    calories: Number(goals.calories) || historyAverage.calories,
    protein: Math.max(Number(goals.protein) || 0, Math.round(historyAverage.protein * 0.82)),
    fat: Number(goals.fat) || Math.round(historyAverage.fat),
    carbs: Number(goals.carbs) || Math.round(historyAverage.carbs)
  };
}

export function buildAiNutritionDayModel(nutrition = defaultNutritionState, selectedDay = null, history = []) {
  const day = selectedDay || nutrition.days?.[todayNutritionKey()] || makeEmptyNutritionDay();
  const goals = nutrition.goals || defaultNutritionState.goals;
  const baseline = getAiNutritionHistoryBaseline();
  const totals = getNutritionDayTotals(day);

  const left = {
    calories: Math.round((Number(goals.calories) || baseline.average.calories) - totals.calories),
    protein: Math.round((Number(goals.protein) || baseline.average.protein) - totals.protein),
    fat: Math.round((Number(goals.fat) || baseline.average.fat) - totals.fat),
    carbs: Math.round((Number(goals.carbs) || baseline.average.carbs) - totals.carbs)
  };

  const calorieProgress = (totals.calories / Math.max(1, Number(goals.calories) || baseline.average.calories)) * 100;
  const proteinProgress = (totals.protein / Math.max(1, Number(goals.protein) || baseline.average.protein)) * 100;
  const fatProgress = (totals.fat / Math.max(1, Number(goals.fat) || baseline.average.fat)) * 100;
  const carbsProgress = (totals.carbs / Math.max(1, Number(goals.carbs) || baseline.average.carbs)) * 100;

  let score = 10;
  if (totals.calories === 0) score = 6.2;
  if (calorieProgress > 110) score -= 1.4;
  if (calorieProgress < 65 && totals.calories > 0) score -= 1.0;
  if (proteinProgress < 70) score -= 1.2;
  if (fatProgress > 115) score -= 1.0;
  if (carbsProgress < 55 && totals.calories > 0) score -= 0.7;
  score = Math.max(4.8, Math.min(9.6, Math.round(score * 10) / 10));

  const badges = [];
  if (proteinProgress < 75) badges.push({ type: "warning", icon: "⚠️", text: "Мало" });
  else badges.push({ type: "good", icon: "💪", text: "Белок хорошо" });

  if (fatProgress > 110) badges.push({ type: "warning", icon: "🧈", text: "Перебор жиров" });
  if (calorieProgress >= 78 && calorieProgress <= 98) badges.push({ type: "good", icon: "🔥", text: "Хороший дефицит" });
  if (carbsProgress < 58) badges.push({ type: "info", icon: "🍚", text: "Мало еды до тренировки" });
  if (totals.calories === 0) badges.push({ type: "info", icon: "📊", text: "Жду первый приём" });

  const baselineDelta = Math.round(totals.calories - baseline.average.calories);
  const weeklyText = baselineDelta < -250
    ? "Ты заметно ниже своей базы марта–апреля. Если вес падает слишком быстро — добавь 100–150 ккал."
    : baselineDelta > 250
      ? "Сегодня выше твоей базы марта–апреля. Если цель похудение — остаток дня лучше сделать легче."
      : "Сегодня близко к твоей реальной базе марта–апреля. Коррекцию калорий можно делать плавно.";

  const adaptiveAdvice = fatProgress > 110
    ? "На остаток дня меньше сыра, орехов, масла и жирного мяса. Лучше белок + углеводы: творог/курица + рис/картофель/овощи."
    : proteinProgress < 75
      ? "На остаток дня добери белок: творог, Exponenta/High-Pro, курица, рыба или индейка."
      : carbsProgress < 58
        ? "Перед тренировкой добавь лёгкие углеводы: банан, рис, овсянка или хлеб fitness."
        : "День идёт ровно. Дальше держи простую еду и не перегружай жиры вечером.";

  return {
    score,
    badges: badges.slice(0, 4),
    totals,
    left,
    baseline,
    baselineDelta,
    weeklyText,
    adaptiveAdvice,
    summary: `${score}/10 — ${proteinProgress >= 75 ? "белок хорошо" : "белка мало"}, ${fatProgress > 110 ? "жиров много" : carbsProgress < 58 ? "углеводов мало" : "баланс нормальный"}.`,
    target: getAiNutritionTargetFromHistory(nutrition),
    hasHistoryData: true
  };
}

export function collectAiNutritionFoodStats(nutrition = defaultNutritionState) {
  const counts = {};
  Object.values(nutrition.days || {}).forEach((day) => {
    (day.foods || []).forEach((food) => {
      const name = getShortFoodName(food.name || "");
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
  });

  Object.values(nutrition.myFoods || {}).forEach((food) => {
    const name = getShortFoodName(food.name || "");
    if (!name) return;
    counts[name] = Math.max(counts[name] || 0, Number(food.useCount) || 1);
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
}

export function getAiNutritionWeightTrend(nutrition = defaultNutritionState) {
  const weights = Object.entries(nutrition.days || {})
    .map(([key, day]) => ({ key, weight: Number(String(day?.weight || "").replace(",", ".")) }))
    .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => a.key.localeCompare(b.key));

  if (weights.length < 2) {
    return { status: "нет данных", delta: 0, text: "Добавь 2–3 замера веса, и AI начнёт делать недельную коррекцию." };
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const delta = Math.round((last.weight - first.weight) * 10) / 10;
  const status = delta > 0.4 ? "растёт" : delta < -0.4 ? "падает" : "стоит";

  return {
    status,
    delta,
    text: `Вес ${status}: ${delta > 0 ? "+" : ""}${delta} кг за период записей.`
  };
}
