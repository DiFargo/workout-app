import { useEffect } from "react";

import { parseTelegramAuthResultFromHash } from "../../../utils/telegramProfile";

export function useProfileTelegramEffects({
  APP_PAGES,
  TELEGRAM_BOT_USERNAME,
  telegramConnectOpen,
  telegramLoginContainerRef,
  handleTelegramLoginAuth,
  refreshTelegramConnection,
  setPage,
  setTelegramConnectOpen,
  setTelegramLoginWidgetReady,
  setTelegramStatus
}) {
  useEffect(() => {
    if (!telegramConnectOpen) return;

    window.onTelegramAuthForWorkoutApp = async (telegramUser) => {
      if (import.meta.env.DEV) console.debug("TELEGRAM CALLBACK WORKS:", telegramUser);
      setTelegramStatus("Telegram подтвердил вход. Проверяю данные...");
      await handleTelegramLoginAuth(telegramUser);
    };

    const container = telegramLoginContainerRef.current;
    if (!container) return;

    container.innerHTML = "";
    setTelegramLoginWidgetReady(false);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "14");
    script.setAttribute("data-userpic", "true");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuthForWorkoutApp(user)");
    script.onload = () => setTelegramLoginWidgetReady(true);

    container.appendChild(script);

    return () => {
      if (window.onTelegramAuthForWorkoutApp) {
        delete window.onTelegramAuthForWorkoutApp;
      }
    };
  }, [telegramConnectOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const telegramAuthResult = parseTelegramAuthResultFromHash();

    if (telegramAuthResult) {
      setPage(APP_PAGES.PROFILE);
      setTelegramConnectOpen(false);
      handleTelegramLoginAuth(telegramAuthResult);

      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    if (params.get("telegramLinked") === "1") {
      setPage(APP_PAGES.PROFILE);
      setTelegramConnectOpen(false);
      refreshTelegramConnection();

      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    if (params.get("telegramError")) {
      setPage(APP_PAGES.PROFILE);
      setTelegramConnectOpen(true);
      setTelegramStatus("Telegram вернул ошибку. Попробуй войти ещё раз.");
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);
}
