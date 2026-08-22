const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value) {
  if (!value) return "";
  if (typeof value?.toDate === "function") value = value.toDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function startOfUtcDay(value = new Date()) {
  const key = dateKey(value);
  return key ? new Date(`${key}T00:00:00.000Z`) : null;
}

export function normalizeClientSubscription(subscription = {}) {
  const purchasedSessions = Math.max(0, Number(subscription.purchasedSessions ?? subscription.totalSessions) || 0);
  const usedSessions = Math.max(0, Number(subscription.usedSessions) || 0);
  const hasSessionCounters = subscription.purchasedSessions !== undefined ||
    subscription.totalSessions !== undefined || subscription.usedSessions !== undefined;
  // `remainingSessions` was written by older saves and can retain the balance
  // of the previous cycle. Counters are the source of truth for an active plan.
  const remainingSessions = Math.max(0, hasSessionCounters
    ? purchasedSessions - usedSessions
    : (Number(subscription.remainingSessions) || 0));
  const cycleId = String(subscription.cycleId || subscription.renewedAt || subscription.startDate || "legacy")
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  return {
    ...subscription,
    cycleId,
    startDate: dateKey(subscription.startDate),
    endDate: dateKey(subscription.endDate),
    purchasedSessions,
    usedSessions,
    remainingSessions,
    frozenUntil: dateKey(subscription.frozenUntil),
    history: Array.isArray(subscription.history) ? subscription.history : []
  };
}

export function getSubscriptionStatus(subscription = {}, now = new Date(), settings = {}) {
  const normalized = normalizeClientSubscription(subscription);
  const today = startOfUtcDay(now);
  const end = startOfUtcDay(normalized.endDate);
  const frozenUntil = startOfUtcDay(normalized.frozenUntil);
  const frozen = subscription.frozen === true || (frozenUntil && today && frozenUntil >= today);
  const daysRemaining = end && today ? Math.ceil((end - today) / DAY_MS) : null;
  const expiredByDate = daysRemaining !== null && daysRemaining < 0;
  const expiredBySessions = normalized.purchasedSessions > 0 && normalized.remainingSessions <= 0;
  const warningDays = Math.max(0, Number(settings.warningDays) || 7);
  const warningSessions = Math.max(0, Number(settings.warningSessions) || 3);

  if (frozen) return { id: "frozen", label: "Заморожен", tone: "neutral", daysRemaining, ...normalized };
  if (expiredByDate || expiredBySessions) return { id: "expired", label: "Закончился", tone: "negative", daysRemaining, ...normalized };
  if ((daysRemaining !== null && daysRemaining <= warningDays) || (normalized.purchasedSessions > 0 && normalized.remainingSessions <= warningSessions)) {
    return { id: "ending", label: "Абонемент скоро закончится", tone: "warning", daysRemaining, ...normalized };
  }
  if (subscription.lastRenewedAt || subscription.status === "renewed") {
    return { id: "renewed", label: "Продлён", tone: "positive", daysRemaining, ...normalized };
  }
  return { id: "active", label: "Активен", tone: "positive", daysRemaining, ...normalized };
}

export function getSubscriptionAttentionLabel(subscription = {}, now = new Date()) {
  const status = getSubscriptionStatus(subscription, now);
  if (status.id === "frozen") return "Абонемент заморожен";
  if (status.id === "expired") return "Абонемент закончился";
  if (status.remainingSessions === 1) return "Осталась 1 тренировка";
  if (status.remainingSessions > 1 && status.remainingSessions <= 3) return `Осталось ${status.remainingSessions} тренировки`;
  if (status.daysRemaining === 0) return "Абонемент заканчивается сегодня";
  if (status.daysRemaining !== null && status.daysRemaining <= 7) return `Заканчивается через ${status.daysRemaining} дн.`;
  return status.label;
}

export function getDueSubscriptionReminders(subscription = {}, settings = {}, now = new Date()) {
  const status = getSubscriptionStatus(subscription, now, settings);
  if (status.id === "frozen" || (!status.endDate && !status.purchasedSessions)) return [];
  const dateEnabled = settings.dateEnabled !== false;
  const sessionsEnabled = settings.sessionsEnabled !== false;
  const dayThresholds = [...new Set([...(Array.isArray(settings.dayThresholds) ? settings.dayThresholds : [7, 3, 0]), Number(settings.warningDays)])].filter(Number.isFinite);
  const sessionThresholds = [...new Set([...(Array.isArray(settings.sessionThresholds) ? settings.sessionThresholds : [3, 1, 0]), Number(settings.warningSessions)])].filter(Number.isFinite);
  const reminders = [];

  if (status.id === "expired") {
    return [{ kind: "expired", threshold: 0, key: `${status.cycleId}_expired` }];
  }

  if (dateEnabled && status.daysRemaining !== null && dayThresholds.includes(status.daysRemaining)) {
    reminders.push({ kind: "date", threshold: status.daysRemaining, key: `${status.cycleId}_date_${status.daysRemaining}` });
  }
  if (sessionsEnabled && status.purchasedSessions > 0 && sessionThresholds.includes(status.remainingSessions)) {
    reminders.push({ kind: "sessions", threshold: status.remainingSessions, key: `${status.cycleId}_sessions_${status.remainingSessions}` });
  }
  return reminders;
}

export function renewClientSubscription(subscription = {}, renewal = {}, now = new Date()) {
  const current = normalizeClientSubscription(subscription);
  const renewedAt = new Date(now).toISOString();
  const next = normalizeClientSubscription({
    ...current,
    ...renewal,
    cycleId: `cycle_${Date.now()}`,
    usedSessions: 0,
    remainingSessions: Number(renewal.purchasedSessions ?? renewal.totalSessions) || 0,
    frozen: false,
    frozenUntil: "",
    status: "renewed",
    lastRenewedAt: renewedAt,
    history: [
      ...current.history,
      {
        type: "renewal",
        date: renewedAt,
        previousEndDate: current.endDate,
        previousRemainingSessions: current.remainingSessions,
        purchasedSessions: Number(renewal.purchasedSessions ?? renewal.totalSessions) || 0,
        endDate: dateKey(renewal.endDate),
        amount: Number(renewal.amount) || 0,
        paymentNote: String(renewal.paymentNote || "").trim()
      }
    ]
  });
  return next;
}
