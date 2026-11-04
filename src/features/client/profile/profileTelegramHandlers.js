import { doc, getDoc } from "firebase/firestore";

import { fetchAuthorized, fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import { safeWriteUserJsonStorage } from "../../../utils/userScopedStorage";
import { createTelegramNotificationHandler } from "./profileNotificationHandlers";
import { captureAuthSession } from "../../../utils/authSession.js";
import { buildTelegramBotLinkUrl } from "../../../utils/telegramBotLink.js";

export function createProfileTelegramHandlers({
  auth,
  db,
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_PROFILE_STORAGE_KEY,
  telegramDraft,
  telegramAvatarRefreshRef,
  telegramBotLinkRequestRef = { current: null },
  setTelegramProfile,
  setTelegramDraft,
  setTelegramStatus,
  setTelegramConnectOpen,
  setTelegramLinkCode,
  setTelegramLinking
}) {
  function update(session, setter, value) {
    if (!session.isCurrent()) return;
    setter((current) => session.isCurrent()
      ? (typeof value === "function" ? value(current) : value)
      : current);
  }

  function cache(session, profile) {
    if (session.isCurrent()) safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, session.uid, profile);
  }

  async function handleTelegramLoginAuth(telegramUser) {
    const session = captureAuthSession(auth);
    if (!session.uid) {
      setTelegramStatus("Сначала войди в аккаунт.");
      return;
    }

    update(session, setTelegramLinking, true);
    update(session, setTelegramStatus, "Проверяю данные Telegram...");

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
      if (!session.isCurrent()) return;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Telegram authorization failed");
      }

      const nextTelegram = {
        connected: true,
        ...(data.telegram || {}),
        notificationsEnabled: data.telegram?.notificationsEnabled !== false
      };

      update(session, setTelegramProfile, nextTelegram);
      update(session, setTelegramDraft, nextTelegram);
      update(session, setTelegramStatus, "Telegram успешно привязан ✅");
      update(session, setTelegramConnectOpen, false);

      try {
        cache(session, nextTelegram);
      } catch {
        // ignore localStorage errors
      }
    } catch (error) {
      console.error("Telegram login auth error:", error);
      update(session, setTelegramStatus, "Не получилось авторизоваться через Telegram.");
    } finally {
      update(session, setTelegramLinking, false);
    }
  }

  async function refreshTelegramAvatar() {
    const session = captureAuthSession(auth);
    if (!session.uid || telegramAvatarRefreshRef.current?.isCurrent?.()) return;

    telegramAvatarRefreshRef.current = session;

    try {
      const response = await fetchAuthorized("/api/telegram/refresh-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!session.isCurrent()) return;

      if (!response.ok || !data.ok || !data.telegram?.avatarUrl) {
        throw new Error(data.error || "Telegram avatar refresh failed");
      }

      update(session, setTelegramProfile, (current) => {
        const nextTelegram = {
          ...current,
          ...data.telegram,
          connected: true
        };

        try {
          cache(session, nextTelegram);
        } catch {
          // ignore localStorage errors
        }

        return nextTelegram;
      });
      update(session, setTelegramDraft, (current) => ({ ...current, ...data.telegram, connected: true }));
    } catch (error) {
      console.error("Telegram avatar refresh error:", error);
      update(session, setTelegramProfile, (current) => ({ ...current, avatarUrl: "" }));
      update(session, setTelegramDraft, (current) => ({ ...current, avatarUrl: "" }));
    } finally {
      if (telegramAvatarRefreshRef.current === session) telegramAvatarRefreshRef.current = false;
    }
  }

  function handleTelegramAvatarError() {
    const session = captureAuthSession(auth);
    update(session, setTelegramProfile, (current) => ({ ...current, avatarUrl: "" }));
    update(session, setTelegramDraft, (current) => ({ ...current, avatarUrl: "" }));
    refreshTelegramAvatar();
  }

  async function startTelegramBotLink() {
    const session = captureAuthSession(auth);
    if (!session.uid) {
      setTelegramStatus("Сначала войди в аккаунт.");
      return false;
    }
    if (telegramBotLinkRequestRef.current?.session.isCurrent()) return false;
    const operation = { session };
    telegramBotLinkRequestRef.current = operation;

    update(session, setTelegramLinkCode, "");
    update(session, setTelegramLinking, true);
    update(session, setTelegramStatus, "Создаю безопасный код привязки...");

    let deadline;
    try {
      const creation = (async () => {
        const response = await fetchAuthorizedWithTimeout("/api/telegram/create-link-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        }, 16000);
        return { response, data: await response.json().catch(() => ({})) };
      })();
      const { response, data } = await Promise.race([creation, new Promise((_, reject) => {
        deadline = setTimeout(() => reject(Object.assign(new Error("Telegram link deadline exceeded"), { name: "AbortError" })), 16000);
      })]);
      if (!session.isCurrent()) return false;
      if (!response.ok || !data.ok || !data.code) {
        throw new Error(data.error || "Telegram link code creation failed");
      }

      const code = String(data.code);
      const botStartUrl = buildTelegramBotLinkUrl(TELEGRAM_BOT_USERNAME, code);
      const expiresAt = String(data.expiresAt || "");
      if (!botStartUrl || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
        throw new Error("Invalid Telegram bot link");
      }
      if (data.botStartUrl) {
        const returnedUrl = new URL(String(data.botStartUrl));
        const expectedUrl = new URL(botStartUrl);
        if (returnedUrl.origin !== expectedUrl.origin || returnedUrl.pathname.toLowerCase() !== expectedUrl.pathname ||
            returnedUrl.search !== expectedUrl.search || returnedUrl.hash || returnedUrl.username || returnedUrl.password) {
          throw new Error("Unexpected Telegram bot link target");
        }
      }
      update(session, setTelegramLinkCode, code);
      update(session, setTelegramStatus, "Ссылка готова. Открой бота и нажми Start.");
      return { code, botStartUrl, expiresAt };
    } catch (error) {
      console.error("Telegram link code create failed:", error?.name || "unknown");
      update(session, setTelegramStatus, "Не получилось создать код привязки.");
      return false;
    } finally {
      clearTimeout(deadline);
      if (telegramBotLinkRequestRef.current === operation) {
        telegramBotLinkRequestRef.current = null;
        update(session, setTelegramLinking, false);
      }
    }
  }

  async function checkTelegramLoginResult() {
    const session = captureAuthSession(auth);
    if (!session.uid || telegramBotLinkRequestRef.current?.session.isCurrent()) return false;
    const operation = { session };
    telegramBotLinkRequestRef.current = operation;
    update(session, setTelegramLinking, true);
    update(session, setTelegramStatus, "Проверяю, сохранился ли Telegram в профиле...");
    try {
      return await refreshTelegramConnection();
    } finally {
      if (telegramBotLinkRequestRef.current === operation) {
        telegramBotLinkRequestRef.current = null;
        update(session, setTelegramLinking, false);
      }
    }
  }

  async function refreshTelegramConnection() {
    const session = captureAuthSession(auth);
    if (!session.uid) return false;

    let deadline;
    try {
      const profileDoc = await Promise.race([
        getDoc(doc(db, "users", session.uid)),
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(Object.assign(new Error("Telegram profile deadline exceeded"), { name: "AbortError" })), 16000);
        })
      ]);
      if (!session.isCurrent()) return false;
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

        update(session, setTelegramProfile, nextTelegram);
        update(session, setTelegramDraft, nextTelegram);
        update(session, setTelegramStatus, "Telegram подключён в профиле.");

        try {
          cache(session, nextTelegram);
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
        return true;
      } else {
        update(session, setTelegramStatus, "Пока не привязан. Открой бота и нажми START.");
        return false;
      }
    } catch (error) {
      console.error("Telegram connection refresh failed:", error);
      update(session, setTelegramStatus, "Не получилось проверить привязку Telegram.");
      return false;
    } finally {
      clearTimeout(deadline);
    }
  }

  async function saveTelegramConnection() {
    return startTelegramBotLink();
  }

  async function disconnectTelegram() {
    const session = captureAuthSession(auth);
    if (!session.uid || telegramBotLinkRequestRef.current?.session.isCurrent()) return false;
    const operation = { session };
    telegramBotLinkRequestRef.current = operation;
    update(session, setTelegramLinking, true);
    update(session, setTelegramStatus, "Отключаю Telegram…");
    let deadline;
    try {
      const removal = (async () => {
        const response = await fetchAuthorizedWithTimeout("/api/telegram/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        }, 16000);
        return { response, data: await response.json().catch(() => ({})) };
      })();
      const { response, data } = await Promise.race([removal, new Promise((_, reject) => {
        deadline = setTimeout(() => reject(Object.assign(new Error("Telegram disconnect deadline exceeded"), { name: "AbortError" })), 16000);
      })]);
      if (!session.isCurrent()) return false;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Telegram disconnect failed");
      }

      const nextTelegramProfile = {
        connected: false,
        notificationsEnabled: false,
        ...(data.telegram || {})
      };
      update(session, setTelegramProfile, nextTelegramProfile);
      update(session, setTelegramDraft, nextTelegramProfile);
      update(session, setTelegramStatus, "Telegram отключён.");

      try {
        cache(session, nextTelegramProfile);
      } catch {
        // ignore localStorage errors
      }
      update(session, setTelegramLinkCode, "");
      return true;
    } catch (error) {
      console.error("Telegram disconnect failed:", error?.name || "unknown");
      update(session, setTelegramStatus, "Не удалось подтвердить отключение. Проверь подключение Telegram перед повтором.");
      return false;
    } finally {
      clearTimeout(deadline);
      if (telegramBotLinkRequestRef.current === operation) {
        telegramBotLinkRequestRef.current = null;
        update(session, setTelegramLinking, false);
      }
    }
  }

  const toggleTelegramNotifications = createTelegramNotificationHandler({
    auth, telegramDraft, setTelegramProfile, setTelegramDraft, setTelegramStatus,
    request: fetchAuthorized,
    writeCache: (uid, profile) => safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, uid, profile)
  });

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
