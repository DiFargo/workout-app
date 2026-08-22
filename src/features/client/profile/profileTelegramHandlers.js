import { doc, getDoc } from "firebase/firestore";

import { fetchAuthorized } from "../../../utils/apiClient";
import { safeWriteUserJsonStorage } from "../../../utils/userScopedStorage";

export function createProfileTelegramHandlers({
  auth,
  db,
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_PROFILE_STORAGE_KEY,
  telegramDraft,
  telegramAvatarRefreshRef,
  setTelegramProfile,
  setTelegramDraft,
  setTelegramStatus,
  setTelegramConnectOpen,
  setTelegramLinkCode,
  setTelegramLinking
}) {
  async function handleTelegramLoginAuth(telegramUser) {
    if (!auth.currentUser?.uid) {
      setTelegramStatus("Сначала войди в аккаунт.");
      return;
    }

    setTelegramLinking(true);
    setTelegramStatus("Проверяю данные Telegram...");

    try {
      const response = await fetchAuthorized("/api/telegram/login-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          telegramUser
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Telegram authorization failed");
      }

      const nextTelegram = {
        connected: true,
        ...(data.telegram || {}),
        notificationsEnabled: data.telegram?.notificationsEnabled !== false
      };

      setTelegramProfile(nextTelegram);
      setTelegramDraft(nextTelegram);
      setTelegramStatus("Telegram успешно привязан ✅");
      setTelegramConnectOpen(false);

      try {
        safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegram);
      } catch {
        // ignore localStorage errors
      }
    } catch (error) {
      console.error("Telegram login auth error:", error);
      setTelegramStatus("Не получилось авторизоваться через Telegram.");
    } finally {
      setTelegramLinking(false);
    }
  }

  async function refreshTelegramAvatar() {
    if (!auth.currentUser || telegramAvatarRefreshRef.current) return;

    telegramAvatarRefreshRef.current = true;

    try {
      const response = await fetchAuthorized("/api/telegram/refresh-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();

      if (!response.ok || !data.ok || !data.telegram?.avatarUrl) {
        throw new Error(data.error || "Telegram avatar refresh failed");
      }

      setTelegramProfile((current) => {
        const nextTelegram = {
          ...current,
          ...data.telegram,
          connected: true
        };

        try {
          safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegram);
        } catch {
          // ignore localStorage errors
        }

        return nextTelegram;
      });
      setTelegramDraft((current) => ({ ...current, ...data.telegram, connected: true }));
    } catch (error) {
      console.error("Telegram avatar refresh error:", error);
      setTelegramProfile((current) => ({ ...current, avatarUrl: "" }));
      setTelegramDraft((current) => ({ ...current, avatarUrl: "" }));
    } finally {
      telegramAvatarRefreshRef.current = false;
    }
  }

  function handleTelegramAvatarError() {
    setTelegramProfile((current) => ({ ...current, avatarUrl: "" }));
    setTelegramDraft((current) => ({ ...current, avatarUrl: "" }));
    refreshTelegramAvatar();
  }

  async function startTelegramBotLink() {
    if (!auth.currentUser?.uid) {
      setTelegramStatus("Сначала войди в аккаунт.");
      return;
    }

    setTelegramLinking(true);
    setTelegramStatus("Создаю безопасный код привязки...");

    try {
      const response = await fetchAuthorized("/api/telegram/create-link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.code) {
        throw new Error(data.error || "Telegram link code creation failed");
      }

      const code = String(data.code);
      setTelegramLinkCode(code);
      setTelegramStatus("Код создан. Открой бота и нажми START.");

      window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Telegram link code create failed:", error);
      setTelegramStatus("Не получилось создать код привязки.");
    } finally {
      setTelegramLinking(false);
    }
  }

  async function checkTelegramLoginResult() {
    setTelegramStatus("Проверяю, сохранился ли Telegram в профиле...");
    await refreshTelegramConnection();
  }

  async function refreshTelegramConnection() {
    if (!auth.currentUser?.uid) return;

    try {
      const profileDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const profileData = profileDoc.data() || {};
      const savedTelegram = profileDoc.exists() ? profileData.telegram : null;

      if (savedTelegram?.connected || profileData.telegramConnected) {
        const nextTelegram = {
          connected: true,
          username: savedTelegram?.username || profileData.telegramUsername || telegramDraft.username || "",
          displayName: savedTelegram?.displayName || profileData.telegramDisplayName || savedTelegram?.firstName || savedTelegram?.username || telegramDraft.displayName || "",
          firstName: savedTelegram?.firstName || "",
          lastName: savedTelegram?.lastName || "",
          avatarUrl: savedTelegram?.avatarUrl || profileData.telegramAvatarUrl || "",
          chatId: savedTelegram?.chatId || "",
          telegramUserId: savedTelegram?.telegramUserId || profileData.telegramUserId || "",
          notificationsEnabled: savedTelegram?.notificationsEnabled !== false,
          connectedAt: savedTelegram?.connectedAt || new Date().toISOString()
        };

        setTelegramProfile(nextTelegram);
        setTelegramDraft(nextTelegram);
        setTelegramStatus("Telegram успешно привязан ✅");

        try {
          safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegram);
        } catch {
          // ignore localStorage errors
        }

        if (
          nextTelegram.telegramUserId &&
          (
            !nextTelegram.avatarUrl ||
            String(nextTelegram.avatarUrl).includes("api.telegram.org/file/bot")
          )
        ) {
          refreshTelegramAvatar();
        }
      } else {
        setTelegramStatus("Пока не привязан. Открой бота и нажми START.");
      }
    } catch (error) {
      console.error("Telegram connection refresh failed:", error);
      setTelegramStatus("Не получилось проверить привязку Telegram.");
    }
  }

  async function saveTelegramConnection() {
    await startTelegramBotLink();
  }

  async function disconnectTelegram() {
    try {
      const response = await fetchAuthorized("/api/telegram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Telegram disconnect failed");
      }

      const nextTelegramProfile = {
        connected: false,
        notificationsEnabled: false,
        ...(data.telegram || {})
      };
      setTelegramProfile(nextTelegramProfile);
      setTelegramDraft(nextTelegramProfile);
      setTelegramStatus("Telegram отключён.");

      try {
        safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegramProfile);
      } catch {
        // ignore localStorage errors
      }
    } catch (error) {
      console.error("Telegram disconnect failed:", error);
      setTelegramStatus("Не получилось отключить Telegram. Попробуй ещё раз.");
    }
  }

  async function toggleTelegramNotifications(enabled) {
    const notificationsEnabled = enabled !== false;
    const previousNotificationsEnabled = telegramDraft.notificationsEnabled !== false;
    const nextTelegramProfile = {
      ...telegramDraft,
      notificationsEnabled
    };

    setTelegramProfile((current) => {
      const nextTelegram = {
        ...current,
        notificationsEnabled
      };

      try {
        safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegram);
      } catch {
        // ignore localStorage errors
      }

      return nextTelegram;
    });
    setTelegramDraft((current) => ({ ...current, notificationsEnabled }));

    if (!auth.currentUser?.uid) return;

    try {
      const response = await fetchAuthorized("/api/telegram/update-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: notificationsEnabled })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Telegram notifications update failed");
      }

      const serverTelegram = {
        ...nextTelegramProfile,
        ...(data.telegram || {}),
        notificationsEnabled
      };
      setTelegramProfile(serverTelegram);
      setTelegramDraft(serverTelegram);
    } catch (error) {
      console.error("Telegram notifications update failed:", error);
      setTelegramProfile((current) => {
        const previousTelegram = {
          ...current,
          notificationsEnabled: previousNotificationsEnabled
        };

        try {
          safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, previousTelegram);
        } catch {
          // ignore localStorage errors
        }

        return previousTelegram;
      });
      setTelegramDraft((current) => ({ ...current, notificationsEnabled: previousNotificationsEnabled }));
      setTelegramStatus("Не получилось сохранить настройку уведомлений.");
    }
  }

  return {
    handleTelegramLoginAuth,
    refreshTelegramAvatar,
    handleTelegramAvatarError,
    startTelegramBotLink,
    checkTelegramLoginResult,
    refreshTelegramConnection,
    saveTelegramConnection,
    disconnectTelegram,
    toggleTelegramNotifications
  };
}
