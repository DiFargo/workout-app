// Keep the save flow independent of Firebase initialization so failures and rollback can be tested.
import { captureAuthSession } from "../../../utils/authSession.js";

export function createTelegramNotificationHandler({ auth, telegramDraft, setTelegramProfile, setTelegramDraft, setTelegramStatus, request, writeCache }) {
  return async function toggleTelegramNotifications(enabled) {
    const session = captureAuthSession(auth);
    const uid = session.uid;
    if (!uid) {
      setTelegramStatus("Войдите в аккаунт, чтобы сохранить настройку уведомлений.");
      return false;
    }
    const notificationsEnabled = enabled !== false;
    const previousNotificationsEnabled = telegramDraft.notificationsEnabled !== false;
    function update(setter, value) {
      if (!session.isCurrent()) return;
      setter(current => session.isCurrent() ? (typeof value === "function" ? value(current) : value) : current);
    }
    function cache(profile) {
      if (!session.isCurrent()) return;
      try { writeCache(uid, profile); } catch { /* Storage may be unavailable in private browsing. */ }
    }
    function updateEnabled(value) {
      update(setTelegramProfile, current => {
        const next = { ...current, notificationsEnabled: value };
        cache(next);
        return next;
      });
      update(setTelegramDraft, current => ({ ...current, notificationsEnabled: value }));
    }

    update(setTelegramStatus, "");
    updateEnabled(notificationsEnabled);
    try {
      const response = await request("/api/telegram/update-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: notificationsEnabled })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error("Notification preferences were not saved");
      // Never apply a response to another account after signing out or switching users.
      if (!session.isCurrent()) return false;
      const serverTelegram = { ...telegramDraft, ...(data.telegram || {}), notificationsEnabled };
      update(setTelegramProfile, serverTelegram);
      update(setTelegramDraft, serverTelegram);
      cache(serverTelegram);
      return true;
    } catch {
      if (!session.isCurrent()) return false;
      updateEnabled(previousNotificationsEnabled);
      update(setTelegramStatus, "Не получилось сохранить настройку уведомлений.");
      return false;
    }
  };
}

export function createClientReminderHandlers({ auth, request, onCalendarSaved }) {
  async function post(url, body) {
    const session = captureAuthSession(auth);
    const uid = session.uid;
    if (!uid) return null;
    try {
      const response = await request(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true || !session.isCurrent()) return null;
      return { data, uid, session };
    } catch { return null; }
  }
  return {
    async saveReminderSettings(reminderSettings) {
      const result = await post("/api/telegram/update-notifications", { reminderSettings });
      if (!result?.data.workoutCalendar || !result.session.isCurrent()) return false;
      onCalendarSaved(result.data.workoutCalendar, result.uid);
      return true;
    },
    async sendTestReminder() {
      return Boolean(await post("/api/telegram/test-workout-reminder", {}));
    }
  };
}
