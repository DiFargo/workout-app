export const DEFAULT_TRAINER_SUBSCRIPTION_NOTIFICATION_SETTINGS = Object.freeze({
  dateEnabled: true,
  sessionsEnabled: true,
  digestMode: "daily",
  sendTime: "10:00",
  warningDays: 7,
  warningSessions: 3,
  dayThresholds: [7, 3, 0],
  sessionThresholds: [3, 1, 0]
});

function toNonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function normalizeTrainerSubscriptionNotificationSettings(settings = {}) {
  const value = settings && typeof settings === "object" ? settings : {};
  const sendTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value.sendTime || ""))
    ? String(value.sendTime)
    : DEFAULT_TRAINER_SUBSCRIPTION_NOTIFICATION_SETTINGS.sendTime;

  return {
    dateEnabled: value.dateEnabled !== false,
    sessionsEnabled: value.sessionsEnabled !== false,
    digestMode: value.digestMode === "separate" ? "separate" : "daily",
    sendTime,
    warningDays: toNonNegativeNumber(value.warningDays, DEFAULT_TRAINER_SUBSCRIPTION_NOTIFICATION_SETTINGS.warningDays),
    warningSessions: toNonNegativeNumber(value.warningSessions, DEFAULT_TRAINER_SUBSCRIPTION_NOTIFICATION_SETTINGS.warningSessions),
    dayThresholds: [...DEFAULT_TRAINER_SUBSCRIPTION_NOTIFICATION_SETTINGS.dayThresholds],
    sessionThresholds: [...DEFAULT_TRAINER_SUBSCRIPTION_NOTIFICATION_SETTINGS.sessionThresholds],
    ...(value.updatedAt ? { updatedAt: value.updatedAt } : {})
  };
}
