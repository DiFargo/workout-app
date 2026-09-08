// Keep the save flow independent of Firebase initialization so failures and rollback can be tested.
export function createTelegramNotificationHandler({ auth, telegramDraft, setTelegramProfile, setTelegramDraft, setTelegramStatus, request, writeCache }) {
  return async function toggleTelegramNotifications(enabled) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setTelegramStatus("Войдите в аккаунт, чтобы сохранить настройку уведомлений.");
      return false;
    }
    const notificationsEnabled = enabled !== false;
    const previousNotificationsEnabled = telegramDraft.notificationsEnabled !== false;
    function cache(profile) {
      try { writeCache(uid, profile); } catch { /* Storage may be unavailable in private browsing. */ }
    }
    function updateEnabled(value) {
      setTelegramProfile(current => {
        const next = { ...current, notificationsEnabled: value };
        cache(next);
        return next;
      });
      setTelegramDraft(current => ({ ...current, notificationsEnabled: value }));
    }

    setTelegramStatus("");
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
      if (auth.currentUser?.uid !== uid) return false;
      const serverTelegram = { ...telegramDraft, ...(data.telegram || {}), notificationsEnabled };
      setTelegramProfile(serverTelegram);
      setTelegramDraft(serverTelegram);
      cache(serverTelegram);
      return true;
    } catch {
      if (auth.currentUser?.uid !== uid) return false;
      updateEnabled(previousNotificationsEnabled);
      setTelegramStatus("Не получилось сохранить настройку уведомлений.");
      return false;
    }
  };
}
