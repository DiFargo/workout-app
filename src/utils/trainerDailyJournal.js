import { getTrainerActionItemTargetTab } from "./trainerActionCenter.js";
import {
  getTrainerSummaryDateKey,
  getTrainerSummaryTimestamp
} from "./trainerSummaryDates.js";

export const TRAINER_DAILY_JOURNAL_FILTERS = [
  { id: "all", label: "Все события" },
  { id: "reviewed", label: "Проверенные" },
  { id: "recorded", label: "Записи" }
];

export function filterTrainerDailyJournalItems(items = [], filterId = "all", reviewedIds = new Set()) {
  const source = Array.isArray(items) ? items : [];
  const reviewed = reviewedIds instanceof Set ? reviewedIds : new Set(reviewedIds);
  if (filterId === "action") return source.filter((item) => item.requiresAction && !reviewed.has(item.id));
  if (filterId === "reviewed") return source.filter((item) => item.requiresAction && reviewed.has(item.id));
  if (filterId === "recorded") return source.filter((item) => !item.requiresAction);
  return source;
}

function getClientName(item = {}) {
  return item.clientName || item.client?.name || item.client?.displayName || item.client?.email || "Клиент";
}

function getEventTimeLabel(timestamp, now = Date.now()) {
  if (!timestamp) return "Сегодня";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Сегодня";

  const sameDay = getTrainerSummaryDateKey(date) === getTrainerSummaryDateKey(now);
  if (!sameDay) return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function getRoutineEventCopy(event = {}) {
  if (event.type === "workout") {
    return {
      icon: "workout",
      title: `Завершена тренировка «${event.title || "Тренировка"}»`,
      detail: "Данные тренировки сохранены"
    };
  }
  if (event.type === "nutrition") {
    return {
      icon: "nutrition",
      title: "Обновлено питание",
      detail: "Добавлена запись в дневник"
    };
  }
  return {
    icon: "measurement",
    title: "Добавлен контрольный замер",
    detail: "Данные доступны в карточке клиента"
  };
}

function getAttentionCopy(item = {}) {
  const summary = item.summary || {};
  const attention = item.attention || {};
  const type = attention.type || item.type || item.status?.id || "attention";

  if (summary.workoutFeedbackAttention?.id) {
    return {
      icon: "feedback",
      title: "Нужна проверка после тренировки",
      detail: summary.workoutFeedbackAttention.reason || "Клиент оставил обратную связь по тренировке",
      actionLabel: "Проверить",
      target: "messages"
    };
  }
  if (Number(summary.activeTrainerTasksCount) > 0) {
    return {
      icon: "task",
      title: Number(summary.activeTrainerTasksCount) === 1 ? "Есть активная задача" : `Есть активные задачи: ${summary.activeTrainerTasksCount}`,
      detail: "Ожидается выполнение клиентом",
      actionLabel: "Открыть",
      target: "tasks"
    };
  }
  if (type === "noProgram" || !summary.assignedProgramId) {
    return {
      icon: "program",
      title: "Не назначена программа",
      detail: "Клиенту нужно назначить план тренировок",
      actionLabel: "Назначить",
      target: "workouts"
    };
  }
  if (type === "programEnding" || summary.programEndingAttention?.id) {
    return {
      icon: "program",
      title: "Программа подходит к завершению",
      detail: summary.programEndingAttention?.reason || "Проверьте следующий план клиента",
      actionLabel: "Проверить",
      target: "workouts"
    };
  }
  if (type === "workout") {
    return {
      icon: "workout",
      title: "Пропущена тренировка",
      detail: attention.reason || "Проверьте план и самочувствие клиента",
      actionLabel: "Проверить",
      target: "workouts"
    };
  }
  if (type === "nutrition") {
    return {
      icon: "nutrition",
      title: "Нужно проверить питание",
      detail: attention.reason || "Недостаточно свежих записей в дневнике",
      actionLabel: "Открыть",
      target: "nutrition"
    };
  }
  if (type === "measure") {
    return {
      icon: "measurement",
      title: "Нужен контрольный замер",
      detail: attention.reason || "Данные тела давно не обновлялись",
      actionLabel: "Открыть",
      target: "bodyProgress"
    };
  }
  return {
    icon: "attention",
    title: "Требуется внимание",
    detail: attention.reason || item.reason || "Проверьте карточку клиента",
    actionLabel: "Открыть",
    target: getTrainerActionItemTargetTab(item)
  };
}

function isImmediateTrainerAction(item = {}) {
  const summary = item.summary || {};
  const attention = item.attention || {};
  const type = attention.type || item.type || item.status?.id || "";

  // A program assignment is a standing decision, not an event of a specific day.
  // Keep it separate from the day journal so that it cannot be accidentally
  // dismissed as a reviewed daily signal.
  return type === "noProgram" || (!summary.assignedProgramId && item.status?.id === "noProgram");
}

function sortJournalItems(first, second) {
  return first.timestamp - second.timestamp
    || Number(first.requiresAction) - Number(second.requiresAction)
    || String(first.clientName).localeCompare(String(second.clientName), "ru");
}

/**
 * Returns standing trainer decisions that need to remain visible until their
 * underlying condition is actually resolved. They intentionally do not belong
 * to the chronological journal of the current day.
 */
export function buildTrainerImmediateActions(actionCenter = {}) {
  const source = [
    ...(Array.isArray(actionCenter?.priorityItems) ? actionCenter.priorityItems : []),
    ...(Array.isArray(actionCenter?.taskItems) ? actionCenter.taskItems : []),
    ...(Array.isArray(actionCenter?.items) ? actionCenter.items : [])
  ];
  const seen = new Set();

  return source.reduce((actions, item) => {
    if (!isImmediateTrainerAction(item)) return actions;

    const clientId = item.clientId || item.client?.id || "client";
    const copy = getAttentionCopy(item);
    const id = `immediate:${clientId}:${copy.icon}`;
    if (seen.has(id)) return actions;
    seen.add(id);

    actions.push({
      id,
      client: item.client,
      clientName: getClientName(item),
      ...copy
    });
    return actions;
  }, []).sort((first, second) => String(first.clientName).localeCompare(String(second.clientName), "ru"));
}

/**
 * Builds the trainer's day journal only from events and attention signals that
 * are already present in the trainer summary/action center.
 */
export function buildTrainerDailyJournal(actionCenter = {}, now = Date.now()) {
  const todayKey = getTrainerSummaryDateKey(now);
  const journalItems = [];
  const seen = new Set();
  const items = Array.isArray(actionCenter?.items) ? actionCenter.items : [];

  items.forEach((item) => {
    const clientName = getClientName(item);
    const recentEvents = Array.isArray(item.summary?.recentEvents) ? item.summary.recentEvents : [];

    recentEvents.forEach((event) => {
      const timestamp = getTrainerSummaryTimestamp(event.date || event.createdAt);
      if (!timestamp || getTrainerSummaryDateKey(timestamp) !== todayKey) return;
      const id = `event:${item.clientId || item.client?.id || "client"}:${event.id || event.type}:${timestamp}`;
      if (seen.has(id)) return;
      seen.add(id);
      const copy = getRoutineEventCopy(event);
      journalItems.push({
        id,
        client: item.client,
        clientName,
        timestamp,
        timeLabel: getEventTimeLabel(timestamp, now),
        ...copy,
        requiresAction: false,
        target: event.type === "workout" ? "workouts" : event.type === "nutrition" ? "nutrition" : "bodyProgress"
      });
    });
  });

  const actionItems = [
    ...(Array.isArray(actionCenter?.priorityItems) ? actionCenter.priorityItems : []),
    ...(Array.isArray(actionCenter?.taskItems) ? actionCenter.taskItems : [])
  ];

  actionItems.forEach((item) => {
    if (isImmediateTrainerAction(item)) return;
    const clientId = item.clientId || item.client?.id || "client";
    const copy = getAttentionCopy(item);
    const id = `attention:${clientId}:${copy.icon}`;
    if (seen.has(id)) return;
    seen.add(id);
    journalItems.push({
      id,
      client: item.client,
      clientName: getClientName(item),
      timestamp: Number.isFinite(item.lastActivityTimestamp) && item.lastActivityTimestamp > 0 ? item.lastActivityTimestamp : now,
      timeLabel: "Сейчас",
      ...copy,
      requiresAction: true
    });
  });

  const plannedItems = Array.isArray(actionCenter?.todayWorkouts) ? actionCenter.todayWorkouts : [];
  plannedItems.forEach((item) => {
    const clientId = item.clientId || item.client?.id || "client";
    const id = `planned:${clientId}`;
    if (seen.has(id)) return;
    seen.add(id);
    journalItems.push({
      id,
      client: item.client,
      clientName: getClientName(item),
      timestamp: now - 1,
      timeLabel: "Сегодня",
      icon: "plan",
      title: "Запланирована тренировка",
      detail: "Тренировка ожидает выполнения клиентом",
      target: "workouts",
      requiresAction: false
    });
  });

  return {
    dateKey: todayKey,
    attentionCount: journalItems.filter((item) => item.requiresAction).length,
    items: journalItems.sort(sortJournalItems)
  };
}
