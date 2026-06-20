import { sumNutritionFoods } from "./nutritionFoodTotals.js";
import { pluralizeRu } from "./trainerAttention.js";
import { getClientPaymentAttention } from "../domain/clientInsights.js";
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

export function getTrainerClientEmptySummary(client = {}) {
  return {
    clientId: client.id || "",
    lastWorkoutAt: "",
    workouts7: 0,
    workouts30: 0,
    workoutDateKeysCurrentWeek: null,
    lastNutritionAt: "",
    nutritionDays7: 0,
    averageCalories7: null,
    lastMeasurementAt: "",
    assignedProgramId: client.assignedProgramId || "",
    assignedProgramUpdatedAt: client.assignedProgramUpdatedAt || "",
    assignedWorkoutCount: Number(client.assignedWorkoutCount) || 0,
    completedWorkoutCount: 0,
    plateau: { isPlateau: false, days: 0, delta: null },
    payment: null,
    paymentAttention: getClientPaymentAttention(null),
    recentEvents: [],
    programCompletionPercent: null
  };
}

export function getTrainerClientFastSummary(client = {}, previousSummary = {}) {
  const nutritionState = client.nutritionState || client.adminClientNutrition || client.nutrition || null;
  const nutritionSummary = getTrainerNutritionSummary(nutritionState);
  const completedWorkoutCount = Number(
    client.completedWorkoutCount ??
    client.assignedCompletedWorkoutCount ??
    previousSummary.completedWorkoutCount ??
    0
  ) || 0;
  const assignedWorkoutCount = Number(
    client.assignedWorkoutCount ??
    previousSummary.assignedWorkoutCount ??
    0
  ) || 0;
  const explicitCompletion = Number(client.programCompletionPercent ?? previousSummary.programCompletionPercent);

  return {
    clientId: client.id,
    lastWorkoutAt:
      client.lastWorkoutAt ||
      client.lastWorkoutDate ||
      client.latestWorkoutAt ||
      previousSummary.lastWorkoutAt ||
      "",
    workouts7: Number(client.workouts7 ?? client.weeklyWorkouts ?? previousSummary.workouts7 ?? 0) || 0,
    workouts30: Number(client.workouts30 ?? previousSummary.workouts30 ?? 0) || 0,
    workoutDateKeysCurrentWeek: Array.isArray(client.workoutDateKeysCurrentWeek)
      ? client.workoutDateKeysCurrentWeek
      : Array.isArray(previousSummary.workoutDateKeysCurrentWeek)
        ? previousSummary.workoutDateKeysCurrentWeek
        : null,
    lastNutritionAt:
      nutritionSummary.lastNutritionAt ||
      client.lastNutritionAt ||
      client.lastNutritionDate ||
      previousSummary.lastNutritionAt ||
      "",
    nutritionDays7: Number(nutritionSummary.nutritionDays7 ?? client.nutritionDays7 ?? previousSummary.nutritionDays7 ?? 0) || 0,
    averageCalories7: nutritionSummary.averageCalories7 ?? client.averageCalories7 ?? previousSummary.averageCalories7 ?? null,
    lastMeasurementAt:
      client.lastMeasurementAt ||
      client.lastMeasurementDate ||
      client.latestMeasurementAt ||
      previousSummary.lastMeasurementAt ||
      "",
    assignedProgramId: client.assignedProgramId || previousSummary.assignedProgramId || "",
    assignedProgramUpdatedAt: client.assignedProgramUpdatedAt || client.assignedProgramAt || previousSummary.assignedProgramUpdatedAt || "",
    assignedWorkoutCount,
    completedWorkoutCount,
    plateau: previousSummary.plateau || { isPlateau: false, days: 0, delta: null },
    payment: previousSummary.payment || null,
    paymentAttention: previousSummary.paymentAttention || getClientPaymentAttention(null),
    recentEvents: previousSummary.recentEvents || [],
    programCompletionPercent: Number.isFinite(explicitCompletion)
      ? Math.round(explicitCompletion)
      : assignedWorkoutCount > 0
        ? Math.min(100, Math.round(completedWorkoutCount / assignedWorkoutCount * 100))
        : null
  };
}

export function buildTrainerDashboardSummary(clients = [], summaries = {}) {
  const summaryItems = (Array.isArray(clients) ? clients : []).map((client) => {
    const summary = summaries?.[client.id] || getTrainerClientEmptySummary(client);
    return {
      client,
      summary,
      status: getClientActivityStatus(summary),
      reasons: getClientAttentionReasons(summary)
    };
  });

  const statusCounts = summaryItems.reduce(
    (counts, item) => ({
      ...counts,
      [item.status.id]: (counts[item.status.id] || 0) + 1,
      activeToday: counts.activeToday + (getTrainerSummaryDaysSince(item.summary.lastWorkoutAt) === 0 ? 1 : 0),
      plateau: counts.plateau + (item.summary.plateau?.isPlateau ? 1 : 0),
      payment: counts.payment + (["overdue", "soon"].includes(item.summary.paymentAttention?.id) ? 1 : 0)
    }),
    { active: 0, attention: 0, lost: 0, noProgram: 0, activeToday: 0, plateau: 0, payment: 0 }
  );

  const problemClients = summaryItems
    .filter((item) => item.status.id !== "active")
    .sort((first, second) => {
      const priority = { lost: 0, noProgram: 1, attention: 2 };
      return (priority[first.status.id] ?? 3) - (priority[second.status.id] ?? 3);
    })
    .slice(0, 5);

  const focusItems = summaryItems
    .flatMap(({ client, summary, status, reasons }) => {
      const clientName = client.name || client.email || "Клиент";
      const focusReasons = reasons.filter((reason) => reason !== "активность в норме");
      if (focusReasons.length) {
        return focusReasons.slice(0, 2).map((reason, index) => ({
          id: `${client.id}_${status.id}_${index}`,
          client,
          clientName,
          status,
          text: reason
        }));
      }

      return [{
        id: `${client.id}_active`,
        client,
        clientName,
        status,
        text: summary.workouts7
          ? `${summary.workouts7} тренировок за 7 дней · питание ${summary.nutritionDays7}/7`
          : `Питание ${summary.nutritionDays7}/7 · программа ${summary.programCompletionPercent ?? "—"}%`
      }];
    })
    .sort((first, second) => {
      const priority = { lost: 0, noProgram: 1, attention: 2, active: 3 };
      return (priority[first.status.id] ?? 4) - (priority[second.status.id] ?? 4);
    })
    .slice(0, 5);

  const recentEvents = summaryItems
    .flatMap(({ client, summary }) => (summary.recentEvents || []).map((event) => ({
      ...event,
      client,
      clientName: client.name || client.email || "Клиент",
      timestamp: getTrainerSummaryTimestamp(event.date)
    })))
    .filter((event) => event.timestamp)
    .sort((first, second) => second.timestamp - first.timestamp)
    .slice(0, 8);

  return {
    summaryItems,
    statusCounts,
    problemClients,
    focusItems,
    recentEvents
  };
}
