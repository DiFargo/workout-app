const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value) {
  if (!value) return "";
  if (typeof value?.toDate === "function") value = value.toDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function normalizeSubscription(subscription = {}) {
  const purchasedSessions = Math.max(0, Number(subscription.purchasedSessions ?? subscription.totalSessions) || 0);
  const usedSessions = Math.max(0, Number(subscription.usedSessions) || 0);
  return {
    ...subscription,
    cycleId: String(subscription.cycleId || subscription.lastRenewedAt || subscription.startDate || "legacy").replace(/[^a-zA-Z0-9_-]/g, "_"),
    endDate: dateKey(subscription.endDate),
    purchasedSessions,
    usedSessions,
    remainingSessions: Math.max(0, Number.isFinite(Number(subscription.remainingSessions)) ? Number(subscription.remainingSessions) : purchasedSessions - usedSessions)
  };
}

export function getDueSubscriptionNotifications(subscription = {}, settings = {}, now = new Date()) {
  const value = normalizeSubscription(subscription);
  if (subscription.frozen === true) return [];
  const today = new Date(`${dateKey(now)}T00:00:00Z`);
  const end = value.endDate ? new Date(`${value.endDate}T00:00:00Z`) : null;
  const daysRemaining = end ? Math.ceil((end - today) / DAY_MS) : null;
  const dateThresholds = [...new Set([...(Array.isArray(settings.dayThresholds) ? settings.dayThresholds : [7, 3, 0]), Number(settings.warningDays)])].filter(Number.isFinite);
  const sessionThresholds = [...new Set([...(Array.isArray(settings.sessionThresholds) ? settings.sessionThresholds : [3, 1, 0]), Number(settings.warningSessions)])].filter(Number.isFinite);
  const due = [];
  const expiredByDate = settings.dateEnabled !== false && daysRemaining !== null && daysRemaining < 0;
  const expiredBySessions = settings.sessionsEnabled !== false && value.purchasedSessions > 0 && value.remainingSessions <= 0;
  if (expiredByDate || expiredBySessions) {
    return [{ kind: "expired", threshold: 0, daysRemaining, ...value, key: `${value.cycleId}_expired` }];
  }
  if (settings.dateEnabled !== false && daysRemaining !== null && dateThresholds.includes(daysRemaining)) {
    due.push({ kind: "date", threshold: daysRemaining, daysRemaining, ...value, key: `${value.cycleId}_date_${daysRemaining}` });
  }
  if (settings.sessionsEnabled !== false && value.purchasedSessions > 0 && sessionThresholds.includes(value.remainingSessions)) {
    due.push({ kind: "sessions", threshold: value.remainingSessions, daysRemaining, ...value, key: `${value.cycleId}_sessions_${value.remainingSessions}` });
  }
  return due;
}

export function buildSubscriptionReminderLine(client = {}, reminder = {}) {
  const name = client.name || client.displayName || client.email || "Клиент";
  if (reminder.kind === "expired") return `${name} — абонемент закончился`;
  if (reminder.kind === "sessions") return `${name} — осталось ${reminder.remainingSessions} трен.`;
  if (reminder.daysRemaining === 0) return `${name} — заканчивается сегодня`;
  return `${name} — заканчивается через ${reminder.daysRemaining} дн.`;
}

function isSettingsObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function resolveSubscriptionNotificationSettings(trainer = {}, client = {}) {
  if (
    Object.prototype.hasOwnProperty.call(trainer, "subscriptionNotificationSettings") &&
    isSettingsObject(trainer.subscriptionNotificationSettings)
  ) {
    return trainer.subscriptionNotificationSettings;
  }
  return isSettingsObject(client.subscriptionNotificationSettings)
    ? client.subscriptionNotificationSettings
    : {};
}
