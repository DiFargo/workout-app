// Respect either representation of an explicit opt-out, including legacy accounts.
// Missing preferences retain the existing opt-in behavior for connected users.
export function isTelegramRemindersEnabled(user = {}) {
  return user.telegram?.notificationsEnabled !== false && user.telegramNotificationsEnabled !== false;
}
