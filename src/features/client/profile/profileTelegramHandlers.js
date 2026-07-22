import { doc, getDoc, setDoc } from "firebase/firestore";

import {
  createTelegramLinkCode,
  normalizeTelegramUsername
} from "../../../utils/telegramProfile";
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
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch("/api/telegram/login-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
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
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch("/api/telegram/refresh-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
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

    const code = createTelegramLinkCode();
    setTelegramLinkCode(code);
    setTelegramLinking(true);
    setTelegramStatus("Код создан. Открой бота и нажми START.");

    try {
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        telegramLinkCode: code,
        telegramLinkCodeCreatedAt: new Date().toISOString(),
        telegramConnected: false
      }, { merge: true });

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
    const username = normalizeTelegramUsername(telegramDraft.username);

    if (!username) {
      setTelegramStatus("Введи Telegram username.");
      return;
    }

    const nextTelegramProfile = {
      connected: true,
      username,
      displayName: telegramDraft.displayName || username,
      avatarUrl: telegramDraft.avatarUrl || "",
      chatId: telegramDraft.chatId || "",
      notificationsEnabled: telegramDraft.notificationsEnabled !== false,
      connectedAt: new Date().toISOString(),
      reminderMode: "day_before_workout"
    };

    setTelegramProfile(nextTelegramProfile);
    setTelegramDraft(nextTelegramProfile);
    setTelegramConnectOpen(false);
    setTelegramStatus("Telegram подключён ✅");

    try {
      safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegramProfile);
    } catch {
      // ignore localStorage errors
    }

    try {
      if (auth.currentUser?.uid) {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          telegram: nextTelegramProfile,
          telegramConnected: true,
          telegramUsername: username,
          telegramNotificationsEnabled: nextTelegramProfile.notificationsEnabled
        }, { merge: true });
      }
    } catch (error) {
      console.error("Telegram save failed:", error);
      setTelegramStatus("Telegram сохранён локально, но не записался в Firebase.");
    }
  }

  async function disconnectTelegram() {
    const nextTelegramProfile = {
      connected: false,
      username: "",
      displayName: "",
      avatarUrl: "",
      chatId: "",
      notificationsEnabled: telegramDraft.notificationsEnabled !== false
    };

    setTelegramProfile(nextTelegramProfile);
    setTelegramDraft(nextTelegramProfile);
    setTelegramStatus("Telegram отключён.");

    try {
      safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegramProfile);
    } catch {
      // ignore localStorage errors
    }

    try {
      if (auth.currentUser?.uid) {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          telegram: nextTelegramProfile,
          telegramConnected: false,
          telegramUsername: "",
          telegramNotificationsEnabled: false
        }, { merge: true });
      }
    } catch (error) {
      console.error("Telegram disconnect failed:", error);
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
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        telegram: nextTelegramProfile,
        telegramNotificationsEnabled: notificationsEnabled
      }, { merge: true });
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
