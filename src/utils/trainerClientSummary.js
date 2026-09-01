import { sumNutritionFoods } from "./nutritionFoodTotals.js";
import {
  getClientCriticalAttentionItems,
  getClientCriticalAttentionStatus,
  pluralizeRu
} from "./trainerAttention.js";
import { getClientPaymentAttention } from "../domain/clientInsights.js";
import { getMeasurementTimestampValue } from "./profileMeasurements.js";
import { getSubscriptionAttentionLabel, getSubscriptionStatus } from "./clientSubscription.js";
import {
  getTrainerAssignmentVersionKey,
  getTrainerSummaryDateKey,
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

function getTrainerCompletionKey(item = {}) {
  const workoutId = String(item?.workoutId || item?.id || "").trim();
  if (workoutId) return `id:${workoutId}`;

  const order = Number(item?.order ?? item?.scheduleOrder);
  if (Number.isFinite(order) && order > 0) return `order:${order}`;

  const index = Number(item?.index);
  if (Number.isFinite(index) && index >= 0) return `index:${index}`;

  return "";
}

export function getTrainerCompletedWorkoutCountForAssignment(
  historyList = [],
  assignedProgramUpdatedAt = "",
  workoutCalendar = {},
  workouts = []
) {
  const assignmentVersionKey = getTrainerAssignmentVersionKey(assignedProgramUpdatedAt);
  if (!assignmentVersionKey) return 0;

  const completedWorkoutIds = new Set();
  (Array.isArray(historyList) ? historyList : []).forEach((entry) => {
    const entryVersionKey = getTrainerAssignmentVersionKey(
      entry?.assignedProgramUpdatedAt || entry?.assignmentVersion
    );
    const completionKey = getTrainerCompletionKey(entry);
    if (completionKey && entryVersionKey === assignmentVersionKey) {
      completedWorkoutIds.add(completionKey);
    }
  });

  const calendarVersionKey = getTrainerAssignmentVersionKey(workoutCalendar?.assignedProgramUpdatedAt);
  if (!calendarVersionKey || calendarVersionKey === assignmentVersionKey) {
    (Array.isArray(workoutCalendar?.plannedWorkouts) ? workoutCalendar.plannedWorkouts : []).forEach((entry) => {
      const status = String(entry?.status || "").trim().toLowerCase();
      const completionKey = getTrainerCompletionKey(entry);
      if (completionKey && ["completed", "completed_off_date"].includes(status)) {
        completedWorkoutIds.add(completionKey);
      }
    });
  }

  (Array.isArray(workouts) ? workouts : []).forEach((workout) => {
    const workoutVersionKey = getTrainerAssignmentVersionKey(
      workout?.assignedProgramUpdatedAt || workout?.assignmentVersion
    );
    const status = String(workout?.status || "").trim().toLowerCase();
    const completionKey = getTrainerCompletionKey(workout);
    if (
      completionKey
      && workoutVersionKey === assignmentVersionKey
      && ["completed", "completed_off_date"].includes(status)
    ) {
      completedWorkoutIds.add(completionKey);
    }
  });

  return completedWorkoutIds.size;
}

export function getTrainerWorkoutActivitySummary(historyList = [], {
  weekStart = 0,
  sevenDayStart = 0,
  thirtyDayStart = 0
} = {}) {
  const workoutTimestamps = (Array.isArray(historyList) ? historyList : [])
    .map((entry) => getTrainerSummaryTimestamp(entry?.date || entry?.completedAt || entry?.createdAt))
    .filter(Boolean)
    .sort((a, b) => b - a);

  const workoutDateKeysCurrentWeek = [...new Set(workoutTimestamps
    .filter((timestamp) => timestamp >= weekStart)
    .map((timestamp) => getTrainerSummaryDateKey(timestamp))
    .filter(Boolean)
  )];

  return {
    lastWorkoutAt: workoutTimestamps[0] || "",
    workouts7: workoutTimestamps.filter((timestamp) => timestamp >= sevenDayStart).length,
    workouts30: workoutTimestamps.filter((timestamp) => timestamp >= thirtyDayStart).length,
    workoutDateKeysCurrentWeek
  };
}

export function getTrainerSortedHistory(historyList = []) {
  return [...(Array.isArray(historyList) ? historyList : [])].sort((a, b) => (
    getTrainerSummaryTimestamp(b?.date || b?.completedAt || b?.createdAt) -
    getTrainerSummaryTimestamp(a?.date || a?.completedAt || a?.createdAt)
  ));
}

export function getTrainerSortedMeasurements(measurements = []) {
  return [...(Array.isArray(measurements) ? measurements : [])]
    .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));
}

export function getTrainerLastMeasurementAt(measurements = []) {
  const latestMeasurement = getTrainerSortedMeasurements(measurements)[0];
  return latestMeasurement
    ? latestMeasurement.date || latestMeasurement.createdAt || latestMeasurement.savedAt || ""
    : "";
}

export function getTrainerWorkoutFeedbackAttention(historyList = [], now = Date.now()) {
  const nowTimestamp = getTrainerSummaryTimestamp(now) || Date.now();
  const recentHistory = getTrainerSortedHistory(historyList)
    .filter((entry) => {
      const timestamp = getTrainerSummaryTimestamp(entry?.date || entry?.completedAt || entry?.createdAt);
      return timestamp && nowTimestamp - timestamp <= 14 * 24 * 60 * 60 * 1000;
    });

  const badEntries = recentHistory.filter((entry) => {
    const feedbackId = String(entry?.postWorkoutFeedback?.id || entry?.readiness?.id || "").toLowerCase();
    return ["bad", "hard", "low", "pain"].includes(feedbackId);
  });

  if (badEntries.length >= 2) {
    return {
      id: "badFeedback",
      reason: `${badEntries.length} тяжелые оценки после тренировок`,
      date: badEntries[0]?.date || badEntries[0]?.completedAt || badEntries[0]?.createdAt || ""
    };
  }

  const painEntry = recentHistory.find((entry) => {
    const text = String(entry?.clientComment || "").toLowerCase();
    return /боль|болит|болел|травм|сустав|головокруж|тошн|резк/.test(text);
  });

  if (painEntry) {
    return {
      id: "pain",
      reason: "Клиент сообщил о боли после тренировки",
      date: painEntry.date || painEntry.completedAt || painEntry.createdAt || "",
      comment: String(painEntry.clientComment || "").trim()
    };
  }

  if (badEntries.length === 1) {
    return {
      id: "badFeedback",
      reason: "Плохое самочувствие после тренировки",
      date: badEntries[0]?.date || badEntries[0]?.completedAt || badEntries[0]?.createdAt || ""
    };
  }

  const commentEntry = recentHistory.find((entry) => String(entry?.clientComment || "").trim());
  if (commentEntry) {
    return {
      id: "comment",
      reason: "Есть комментарий клиента после тренировки",
      date: commentEntry.date || commentEntry.completedAt || commentEntry.createdAt || "",
      comment: String(commentEntry.clientComment || "").trim()
    };
  }

  return null;
}

export function getTrainerProgramCompletionPercent(
  assignedWorkoutCount = 0,
  completedWorkoutCount = 0,
  canCalculate = true
) {
  if (!canCalculate) return null;

  const assignedCount = Number(assignedWorkoutCount) || 0;
  if (assignedCount <= 0) return null;

  const completedCount = Number(completedWorkoutCount) || 0;
  return Math.min(100, Math.round(completedCount / assignedCount * 100));
}

export function getTrainerProgramEndingAttention(
  assignedWorkoutCount = 0,
  completedWorkoutCount = 0
) {
  const assignedCount = Number(assignedWorkoutCount) || 0;
  const completedCount = Math.max(0, Number(completedWorkoutCount) || 0);
  if (assignedCount <= 0) return null;

  const remainingCount = Math.max(0, assignedCount - completedCount);
  if (remainingCount === 0) {
    return {
      id: "completed",
      reason: "Программа завершена, назначьте следующий блок",
      remainingWorkouts: 0,
      completedWorkoutCount: completedCount,
      assignedWorkoutCount: assignedCount
    };
  }

  const completionPercent = completedCount / assignedCount * 100;
  if (assignedCount >= 4 && (remainingCount <= 2 || completionPercent >= 75)) {
    return {
      id: "endingSoon",
      reason: `До конца программы: ${remainingCount} ${pluralizeRu(remainingCount, "тренировка", "тренировки", "тренировок")}`,
      remainingWorkouts: remainingCount,
      completedWorkoutCount: completedCount,
      assignedWorkoutCount: assignedCount
    };
  }

  return null;
}

export function getTrainerAssignedWorkoutCount(client = {}, workouts = []) {
  const rootCount = Number(client.assignedWorkoutCount) || 0;
  const workoutCount = Array.isArray(workouts) ? workouts.length : 0;
  const calendarPlannedCount = Array.isArray(client.workoutCalendar?.plannedWorkouts)
    ? client.workoutCalendar.plannedWorkouts.length
    : 0;

  return Math.max(rootCount, workoutCount, calendarPlannedCount);
}

export function getTrainerSummaryReadFailures(readResults = {}) {
  const entries = Object.entries(readResults || {});
  return {
    names: entries
      .filter(([, result]) => result?.status === "rejected")
      .map(([name]) => name),
    reasons: Object.fromEntries(entries.map(([name, result]) => [
      name,
      result?.status === "rejected" ? result.reason : null
    ]))
  };
}

export function getTrainerSettledCollectionItems(result = null) {
  if (result?.status !== "fulfilled" || typeof result.value?.forEach !== "function") {
    return [];
  }

  const items = [];
  result.value.forEach((itemDoc) => {
    items.push({ id: itemDoc.id, ...itemDoc.data() });
  });
  return items;
}

export function getTrainerSettledDocumentData(result = null, fallback = null) {
  if (result?.status === "fulfilled" && typeof result.value?.exists === "function" && result.value.exists()) {
    return result.value.data();
  }

  return fallback;
}

export function buildTrainerClientRecentEvents({
  clientId = "",
  historyList = [],
  nutritionSummary = null,
  measurements = []
} = {}) {
  const latestMeasurement = getTrainerSortedMeasurements(measurements)[0];

  return [
    ...getTrainerSortedHistory(historyList).slice(0, 3).map((entry) => ({
      id: `workout_${entry.id}`,
      type: "workout",
      title: entry.workoutName || entry.name || entry.workout || "\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430",
      date: entry.date || entry.completedAt || entry.createdAt || ""
    })),
    ...(nutritionSummary?.lastNutritionAt ? [{
      id: `nutrition_${clientId}_${nutritionSummary.lastNutritionAt}`,
      type: "nutrition",
      title: "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e \u043f\u0438\u0442\u0430\u043d\u0438\u0435",
      date: nutritionSummary.lastNutritionAt
    }] : []),
    ...(latestMeasurement ? [{
      id: `measurement_${latestMeasurement.id}`,
      type: "measurement",
      title: "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c\u043d\u044b\u0439 \u0437\u0430\u043c\u0435\u0440",
      date: latestMeasurement.date || latestMeasurement.createdAt || latestMeasurement.savedAt || ""
    }] : [])
  ];
}

export function getClientActivityStatus(summary = {}) {
  if (!summary.assignedProgramId) {
    return { id: "noProgram", label: "Без программы" };
  }

  const workoutDays = getTrainerSummaryDaysSince(summary.lastWorkoutAt);
  const nutritionDays = getTrainerSummaryDaysSince(summary.lastNutritionAt);
  const measurementDays = getTrainerSummaryDaysSince(summary.lastMeasurementAt);
  const currentSubscription = summary.subscriptionStatus || {};
  const hasCurrentSubscriptionPeriod = ["active", "renewed"].includes(currentSubscription.id) && Boolean(
    currentSubscription.startDate ||
    currentSubscription.endDate ||
    Number(currentSubscription.purchasedSessions) > 0
  );
  const paymentNeedsAttention = !hasCurrentSubscriptionPeriod && ["overdue", "soon"].includes(summary.paymentAttention?.id);

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
    summary.workoutFeedbackAttention?.id ||
    summary.programEndingAttention?.id ||
    ["ending", "expired"].includes(summary.subscriptionStatus?.id) ||
    summary.plateau?.isPlateau ||
    paymentNeedsAttention
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
  const currentSubscription = summary.subscriptionStatus || {};
  const hasCurrentSubscriptionPeriod = ["active", "renewed"].includes(currentSubscription.id) && Boolean(
    currentSubscription.startDate ||
    currentSubscription.endDate ||
    Number(currentSubscription.purchasedSessions) > 0
  );

  if (workoutDays === null) reasons.push("нет данных о тренировках");
  else if (workoutDays >= 7) reasons.push(`нет тренировок ${workoutDays} ${getTrainerDayWord(workoutDays)}`);

  if (nutritionDays === null) reasons.push("нет данных о питании");
  else if (nutritionDays >= 5) reasons.push(`нет питания ${nutritionDays} ${getTrainerDayWord(nutritionDays)}`);

  if (measurementDays === null) reasons.push("нет замеров");
  else if (measurementDays >= 30) reasons.push(`нет замера ${measurementDays} ${getTrainerDayWord(measurementDays)}`);
  if (summary.workoutFeedbackAttention?.reason) {
    reasons.push(summary.workoutFeedbackAttention.reason.toLowerCase());
  }
  if (summary.programEndingAttention?.reason) {
    reasons.push(summary.programEndingAttention.reason.toLowerCase());
  }
  if (["ending", "expired"].includes(summary.subscriptionStatus?.id)) {
    reasons.push(summary.subscriptionAttentionLabel || summary.subscriptionStatus.label.toLowerCase());
  }
  if (summary.plateau?.isPlateau) reasons.push(`вес стоит ${summary.plateau.days} ${getTrainerDayWord(summary.plateau.days)}`);
  if (!hasCurrentSubscriptionPeriod && ["overdue", "soon"].includes(summary.paymentAttention?.id)) {
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
    assignedWorkoutCount: getTrainerAssignedWorkoutCount(client),
    completedWorkoutCount: 0,
    plateau: { isPlateau: false, days: 0, delta: null },
    payment: null,
    paymentAttention: getClientPaymentAttention(null),
    activeTrainerTasksCount: Number(client.activeTrainerTasksCount) || 0,
    workoutFeedbackAttention: client.workoutFeedbackAttention || null,
    programEndingAttention: client.programEndingAttention || null,
    subscriptionStatus: getSubscriptionStatus(client.subscription || {}),
    subscriptionAttentionLabel: client.subscription ? getSubscriptionAttentionLabel(client.subscription) : "",
    recentEvents: [],
    programCompletionPercent: null,
    weeklyProgressScore: null
  };
}

export function getTrainerClientSummaryFromMap(client = {}, summaries = {}) {
  return summaries?.[client.id] || getTrainerClientEmptySummary(client);
}

export function canLoadTrainerClientDeepSummary(client = {}) {
  return !client.trainerLinkOnly;
}

export function getTrainerClientFastSummary(client = {}, previousSummary = {}) {
  const nutritionState = client.nutritionState || client.adminClientNutrition || client.nutrition || null;
  const nutritionSummary = getTrainerNutritionSummary(nutritionState);
  const assignedProgramUpdatedAt = client.assignedProgramUpdatedAt || client.assignedProgramAt || previousSummary.assignedProgramUpdatedAt || "";
  const hasWorkoutCalendar = Boolean(client.workoutCalendar);
  const calendarCompletedWorkoutCount = getTrainerCompletedWorkoutCountForAssignment(
    [],
    assignedProgramUpdatedAt,
    client.workoutCalendar || {}
  );
  const completedWorkoutCount = Number(
    client.completedWorkoutCount ??
    client.assignedCompletedWorkoutCount ??
    (hasWorkoutCalendar ? calendarCompletedWorkoutCount : null) ??
    previousSummary.completedWorkoutCount ??
    0
  ) || 0;
  const assignedWorkoutCount = Math.max(
    getTrainerAssignedWorkoutCount(client),
    Number(previousSummary.assignedWorkoutCount) || 0
  );
  const explicitCompletion = Number(client.programCompletionPercent ?? previousSummary.programCompletionPercent);
  const savedWeeklyProgressScore = Number(client.weeklyProgressScore ?? previousSummary.weeklyProgressScore);
  const programEndingAttention = client.programEndingAttention ||
    previousSummary.programEndingAttention ||
    getTrainerProgramEndingAttention(assignedWorkoutCount, completedWorkoutCount);

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
    assignedProgramUpdatedAt,
    assignedWorkoutCount,
    completedWorkoutCount,
    plateau: previousSummary.plateau || { isPlateau: false, days: 0, delta: null },
    payment: previousSummary.payment || null,
    paymentAttention: previousSummary.paymentAttention || getClientPaymentAttention(null),
    activeTrainerTasksCount: Number(
      client.activeTrainerTasksCount ??
      client.trainerTasksActiveCount ??
      previousSummary.activeTrainerTasksCount ??
      0
    ) || 0,
    workoutFeedbackAttention: client.workoutFeedbackAttention || previousSummary.workoutFeedbackAttention || null,
    programEndingAttention,
    subscriptionStatus: client.subscription
      ? getSubscriptionStatus(client.subscription)
      : previousSummary.subscriptionStatus || getSubscriptionStatus({}),
    subscriptionAttentionLabel: client.subscription
      ? getSubscriptionAttentionLabel(client.subscription)
      : previousSummary.subscriptionAttentionLabel || "",
    recentEvents: previousSummary.recentEvents || [],
    weeklyProgressScore: Number.isFinite(savedWeeklyProgressScore)
      ? Math.max(0, Math.min(100, Math.round(savedWeeklyProgressScore)))
      : null,
    programCompletionPercent: Number.isFinite(explicitCompletion)
      ? Math.round(explicitCompletion)
      : getTrainerProgramCompletionPercent(assignedWorkoutCount, completedWorkoutCount)
  };
}

export function buildTrainerDashboardSummary(clients = [], summaries = {}) {
  const summaryItems = (Array.isArray(clients) ? clients : []).map((client) => {
    const summary = getTrainerClientSummaryFromMap(client, summaries);
    return {
      client,
      summary,
      activityStatus: getClientActivityStatus(summary),
      criticalAttentionItems: getClientCriticalAttentionItems(client, summary),
      status: getClientCriticalAttentionStatus(client, summary),
      reasons: getClientAttentionReasons(summary)
    };
  });

  const statusCounts = summaryItems.reduce(
    (counts, item) => ({
      ...counts,
        active: counts.active + (item.status.id === "active" && item.activityStatus.id === "active" ? 1 : 0),
        attention: counts.attention + (item.status.id === "attention" ? 1 : 0),
        noProgram: counts.noProgram + (item.status.id === "noProgram" ? 1 : 0),
        lost: counts.lost + (item.activityStatus.id === "lost" ? 1 : 0),
        activeToday: counts.activeToday + (getTrainerSummaryDaysSince(item.summary.lastWorkoutAt) === 0 ? 1 : 0),
        plateau: counts.plateau + (item.summary.plateau?.isPlateau ? 1 : 0),
        payment: counts.payment + (item.criticalAttentionItems.some((attention) => attention.type === "subscription") ? 1 : 0),
        critical: counts.critical + (item.criticalAttentionItems.length ? 1 : 0)
      }),
    { active: 0, attention: 0, lost: 0, noProgram: 0, activeToday: 0, plateau: 0, payment: 0, critical: 0 }
  );

  const problemClients = summaryItems
    .filter((item) => item.criticalAttentionItems.length > 0)
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
