import { addDoc, collection, doc, setDoc } from "firebase/firestore";

import { fetchAuthorized } from "../../utils/apiClient";
import { getClientTelegramProfile } from "../../utils/clientTelegramProfile";
import { getTrainerActionErrorStatus } from "../../utils/trainerActionStatus";
import { normalizeTelegramUsername } from "../../utils/telegramProfile";

const STATUS_SELECT_CLIENT = "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_NO_TELEGRAM = "\u0423 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u043d\u0435 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d Telegram.";
const STATUS_WRITE_MESSAGE = "\u041d\u0430\u043f\u0438\u0448\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0434\u043b\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_SELECT_CLIENT_AND_MESSAGE = "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u043d\u0430\u043f\u0438\u0448\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.";
const STATUS_TELEGRAM_SENDING = "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u044e Telegram-\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...";
const STATUS_TELEGRAM_SENT = "Telegram-\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e.";
const STATUS_TELEGRAM_BACKEND_FAILED = "Backend Telegram \u0435\u0449\u0451 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d \u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043d\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c.";
const STATUS_INTERNAL_SAVING = "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...";
const STATUS_INTERNAL_SAVED = "Telegram \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d. \u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e \u0432\u043e \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0435\u0439 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_INTERNAL_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0443.";
const STATUS_NO_USERNAME = "\u0423 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d Telegram username.";
const STATUS_NOTIFICATIONS_SAVING = "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e Telegram-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f...";
const STATUS_NOTIFICATIONS_ON = "Telegram-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u044b.";
const STATUS_NOTIFICATIONS_OFF = "Telegram-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u044b.";
const STATUS_NOTIFICATIONS_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c Telegram-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f.";

export function createTrainerMessagingHandlers({
  db,
  auth,
  user,
  adminSelectedClient,
  adminTelegramMessage,
  setAdminTelegramMessage,
  setAdminTelegramSending,
  setAdminClientStatus,
  setAdminSelectedClient,
  setUsersList,
  recordTrainerEvent
}) {
  async function sendAdminTelegramMessage(client = adminSelectedClient, messageOverride = "") {
    const telegram = getClientTelegramProfile(client);
    const text = String(messageOverride || adminTelegramMessage || "").trim();

    if (!client?.id) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return false;
    }

    if (!telegram.connected || !telegram.username) {
      setAdminClientStatus(STATUS_NO_TELEGRAM);
      return false;
    }

    if (!text) {
      setAdminClientStatus(STATUS_WRITE_MESSAGE);
      return false;
    }

    setAdminTelegramSending(true);
    setAdminClientStatus(STATUS_TELEGRAM_SENDING);

    try {
      const response = await fetchAuthorized("/api/telegram/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          text
        })
      });

      if (!response.ok) {
        throw new Error("Telegram backend error");
      }

      if (!messageOverride) setAdminTelegramMessage("");
      setAdminClientStatus(STATUS_TELEGRAM_SENT);
      recordTrainerEvent(client.id, "message", "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0442\u0440\u0435\u043d\u0435\u0440\u0430", text.slice(0, 160));
      return true;
    } catch (error) {
      console.error("Telegram send failed:", error);
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_TELEGRAM_BACKEND_FAILED));
      return false;
    } finally {
      setAdminTelegramSending(false);
    }
  }

  async function sendTrainerClientMessage(text, client = adminSelectedClient, replyContext = null) {
    const message = String(text || "").trim();
    if (!client?.id || !message) {
      setAdminClientStatus(STATUS_SELECT_CLIENT_AND_MESSAGE);
      return false;
    }

    const telegram = getClientTelegramProfile(client);
    const hasReplyContext = Boolean(replyContext?.sourceCommentId);
    const replyDocumentId = hasReplyContext
      ? String(replyContext.replyId || `feedback_reply_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_")
      : "";
    const replyDocumentRef = replyDocumentId
      ? doc(db, "users", client.id, "telegramMessages", replyDocumentId)
      : null;
    const sentAt = new Date().toISOString();
    const linkedMessage = hasReplyContext ? {
      type: "manual",
      direction: "out",
      text: message,
      status: "sending",
      sentAt,
      sentByUid: auth.currentUser?.uid || "",
      sentByEmail: auth.currentUser?.email || user?.email || "",
      sourceCommentId: replyContext.sourceCommentId,
      workoutId: replyContext.workoutId || "",
      exerciseId: replyContext.exerciseId || "",
      replyContext: {
        ...replyContext,
        clientId: client.id,
        sourceStatus: "processed",
        processedAt: sentAt
      }
    } : null;

    if (replyDocumentRef && linkedMessage) {
      try {
        await setDoc(replyDocumentRef, linkedMessage, { merge: true });
      } catch (error) {
        console.error("Unable to create linked trainer reply:", error);
        setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_INTERNAL_FAILED));
        return false;
      }
    }

    if (telegram.connected && telegram.username) {
      const sent = await sendAdminTelegramMessage(client, message);
      if (replyDocumentRef) {
        await setDoc(replyDocumentRef, {
          status: sent ? "sent" : "error",
          channel: "telegram",
          ...(sent ? { deliveredAt: new Date().toISOString() } : {})
        }, { merge: true }).catch((error) => console.warn("Unable to update linked reply status:", error));
      }
      return sent;
    }

    setAdminClientStatus(STATUS_INTERNAL_SAVING);

    try {
      if (replyDocumentRef) {
        await setDoc(replyDocumentRef, {
          status: "sent",
          channel: "internal",
          deliveredAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await addDoc(collection(db, "users", client.id, "telegramMessages"), {
          type: "manual",
          direction: "out",
          text: message,
          status: "saved",
          sentAt: new Date().toISOString(),
          sentByUid: auth.currentUser?.uid || "",
          sentByEmail: auth.currentUser?.email || user?.email || ""
        });
      }
      setAdminClientStatus(STATUS_INTERNAL_SAVED);
      recordTrainerEvent(client.id, "message", "\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435", message.slice(0, 160));
      return true;
    } catch (error) {
      console.error("Trainer message save failed:", error);
      if (replyDocumentRef) {
        await setDoc(replyDocumentRef, { status: "error" }, { merge: true }).catch(() => {});
      }
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_INTERNAL_FAILED));
      return false;
    }
  }

  function openTelegramChat(username = "") {
    const cleanUsername = normalizeTelegramUsername(username);
    if (!cleanUsername) {
      setAdminClientStatus(STATUS_NO_USERNAME);
      return;
    }

    window.open(`https://t.me/${cleanUsername}`, "_blank", "noopener,noreferrer");
  }

  async function toggleClientTelegramNotifications(client, enabled) {
    if (!client?.id) return;

    const currentTelegram = getClientTelegramProfile(client);
    const nextTelegram = {
      ...currentTelegram,
      notificationsEnabled: enabled
    };

    setAdminSelectedClient((prev) => prev?.id === client.id ? { ...prev, telegram: nextTelegram, telegramNotificationsEnabled: enabled } : prev);
    setUsersList((prev) => prev.map((item) => (
      item.id === client.id ? { ...item, telegram: nextTelegram, telegramNotificationsEnabled: enabled } : item
    )));
    setAdminClientStatus(STATUS_NOTIFICATIONS_SAVING);

    try {
      await setDoc(doc(db, "users", client.id), {
        telegram: nextTelegram,
        telegramNotificationsEnabled: enabled
      }, { merge: true });
      setAdminClientStatus(enabled ? STATUS_NOTIFICATIONS_ON : STATUS_NOTIFICATIONS_OFF);
    } catch (error) {
      console.error("Telegram notifications update failed:", error);
      setAdminSelectedClient((prev) => prev?.id === client.id ? { ...prev, telegram: currentTelegram, telegramNotificationsEnabled: currentTelegram.notificationsEnabled } : prev);
      setUsersList((prev) => prev.map((item) => (
        item.id === client.id ? { ...item, telegram: currentTelegram, telegramNotificationsEnabled: currentTelegram.notificationsEnabled } : item
      )));
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_NOTIFICATIONS_FAILED));
    }
  }

  return {
    sendAdminTelegramMessage,
    sendTrainerClientMessage,
    openTelegramChat,
    toggleClientTelegramNotifications
  };
}
