const TRAINING_DAY_BY_JS_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function pluralizeRu(count, one, few, many) {
  const value = Math.abs(Number(count)) || 0;
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function getTrainerAttentionDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const normalized = value.includes("T") ? value : `${value}T00:00:00`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function getTrainerAttentionLocalDateKey(date = new Date()) {
  const value = getTrainerAttentionDate(date) || new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTrainerAttentionDayStart(value = new Date()) {
  const date = getTrainerAttentionDate(value) || new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getTrainerAttentionDaysSince(value, now = new Date()) {
  const date = getTrainerAttentionDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((getTrainerAttentionDayStart(now) - getTrainerAttentionDayStart(date)) / 86400000));
}

export function getTrainerAttentionWeekStart(now = new Date()) {
  const date = getTrainerAttentionDayStart(now);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

export function getClientScheduleForAttention(client = {}) {
  const calendar = client.workoutCalendar || {};
  const rawScheduledDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(calendar.monthlyTrainingDates)
      ? calendar.monthlyTrainingDates
      : [];
  const scheduledDates = [...new Set(rawScheduledDates
    .map((date) => String(date || "").slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  )].sort();
  const trainingDays = [...new Set((
    Array.isArray(calendar.trainingDays) && calendar.trainingDays.length
      ? calendar.trainingDays
      : Array.isArray(client.trainingDays)
        ? client.trainingDays
        : []
  ).map((day) => String(day || "").trim()).filter(Boolean))];
  return { scheduledDates, trainingDays };
}

export function getWorkoutScheduleAttentionState(client = {}, summary = {}, now = new Date()) {
  const { scheduledDates, trainingDays } = getClientScheduleForAttention(client);
  const todayKey = getTrainerAttentionLocalDateKey(now);
  const weekStart = getTrainerAttentionWeekStart(now);
  const weekStartKey = getTrainerAttentionLocalDateKey(weekStart);
  const completedDateKeys = Array.isArray(summary.workoutDateKeysCurrentWeek)
    ? [...new Set(summary.workoutDateKeysCurrentWeek
        .map((date) => String(date || "").slice(0, 10))
        .filter((date) => date >= weekStartKey && date <= todayKey)
      )]
    : null;
  const completedThisWeek = completedDateKeys
    ? completedDateKeys.length
    : Number(summary.workouts7) || 0;

  const dueExplicitDates = scheduledDates.filter((date) => date >= weekStartKey && date < todayKey);
  const futureExplicitDates = scheduledDates.filter((date) => date >= todayKey);
  let dueCount = dueExplicitDates.length;

  if (!scheduledDates.length && trainingDays.length) {
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = getTrainerAttentionLocalDateKey(date);
      if (key >= todayKey) continue;
      if (trainingDays.includes(TRAINING_DAY_BY_JS_DAY[date.getDay()])) dueCount += 1;
    }
  }

  return {
    hasSchedule: scheduledDates.length > 0 || trainingDays.length > 0,
    dueCount,
    completedThisWeek,
    missedCount: Math.max(0, dueCount - completedThisWeek),
    hasFutureWorkout: futureExplicitDates.length > 0 || trainingDays.some((day) => {
      const todayIndex = (getTrainerAttentionDayStart(now).getDay() + 6) % 7;
      const dayIndex = (TRAINING_DAY_BY_JS_DAY.indexOf(day) + 6) % 7;
      return dayIndex >= todayIndex;
    })
  };
}

export function getNutritionAttentionReason(summary = {}, now = new Date()) {
  const nutritionDays = Number(summary.nutritionDays7) || 0;
  const elapsedWeekDays = (getTrainerAttentionDayStart(now).getDay() + 6) % 7;
  const daysSinceNutrition = getTrainerAttentionDaysSince(summary.lastNutritionAt, now);

  if (daysSinceNutrition !== null && daysSinceNutrition >= 5) {
    return `Нет питания ${daysSinceNutrition} ${pluralizeRu(daysSinceNutrition, "день", "дня", "дней")}`;
  }
  if (elapsedWeekDays >= 3 && nutritionDays === 0) return "Нет записей питания за прошедшие дни недели";
  if (elapsedWeekDays >= 5 && nutritionDays < 3) return "Мало записей питания за неделю";
  return "";
}

export function getClientAttentionItems(client = {}, summary = {}, now = new Date()) {
  const hasProgram = Boolean(client.assignedProgramId || client.programId || summary.assignedProgramId);
  if (!hasProgram) {
    return [{ type: "program", reason: "Не назначена программа тренировок" }];
  }

  const items = [];
  const scheduleState = getWorkoutScheduleAttentionState(client, summary, now);
  if (scheduleState.missedCount > 0) {
    items.push({
      type: "workout",
      reason: scheduleState.missedCount === 1
        ? "Не закрыта плановая тренировка"
        : `Не закрыто ${scheduleState.missedCount} плановых тренировок`
    });
  } else {
    const workoutDays = getTrainerAttentionDaysSince(summary.lastWorkoutAt, now);
    const assignedDays = getTrainerAttentionDaysSince(summary.assignedProgramUpdatedAt || client.assignedProgramUpdatedAt || client.assignedProgramAt, now);
    if (!scheduleState.hasSchedule && workoutDays !== null && workoutDays >= 7) {
      items.push({ type: "workout", reason: `Нет тренировок ${workoutDays} ${pluralizeRu(workoutDays, "день", "дня", "дней")}` });
    } else if (!scheduleState.hasSchedule && workoutDays === null && assignedDays !== null && assignedDays >= 7) {
      items.push({ type: "workout", reason: "Нет тренировок после назначения программы" });
    }
  }

  if (summary.workoutFeedbackAttention?.reason) {
    items.push({ type: "feedback", reason: summary.workoutFeedbackAttention.reason });
  }

  if (summary.programEndingAttention?.reason) {
    items.push({ type: "programEnding", reason: summary.programEndingAttention.reason });
  }

  const nutritionReason = getNutritionAttentionReason(summary, now);
  if (nutritionReason) items.push({ type: "nutrition", reason: nutritionReason });

  const measurementDays = getTrainerAttentionDaysSince(summary.lastMeasurementAt, now);
  if (measurementDays !== null && measurementDays >= 14) {
    items.push({
      type: "measure",
      reason: `Не взвешивался ${measurementDays} ${pluralizeRu(measurementDays, "день", "дня", "дней")}`
    });
  } else if (summary.plateau?.isPlateau) {
    items.push({ type: "measure", reason: `Вес стоит ${summary.plateau.days} ${pluralizeRu(summary.plateau.days, "день", "дня", "дней")}` });
  }
  if (["overdue", "soon"].includes(summary.paymentAttention?.id)) {
    items.push({ type: "payment", reason: summary.paymentAttention.label || "Проверь оплату клиента" });
  }
  const assignedDays = getTrainerAttentionDaysSince(summary.assignedProgramUpdatedAt || client.assignedProgramUpdatedAt || client.assignedProgramAt, now);
  if (!items.length && !summary.lastWorkoutAt && !summary.lastNutritionAt && assignedDays !== null && assignedDays >= 7) {
    items.push({ type: "activity", reason: "Нет недавней активности" });
  }

  return items;
}

export function getClientAttentionState(client = {}, summary = {}, now = new Date()) {
  return getClientAttentionItems(client, summary, now)[0] || null;
}
