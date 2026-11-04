import { useEffect, useRef } from "react";

import { parseTelegramAuthResultFromHash } from "../../../utils/telegramProfile";

export function useProfileTelegramEffects({
  APP_PAGES,
  telegramConnectOpen,
  telegramLinkCode,
  handleTelegramLoginAuth,
  refreshTelegramConnection,
  setPage,
  setTelegramConnectOpen,
  setTelegramStatus
}) {
  const refreshRef = useRef(refreshTelegramConnection);
  useEffect(() => {
    refreshRef.current = refreshTelegramConnection;
  }, [refreshTelegramConnection]);

  useEffect(() => {
    if (!telegramConnectOpen || !telegramLinkCode) return;
    let disposed = false;
    let checking = false;
    let webApp;
    const refreshOnReturn = async () => {
      if (disposed || checking || document.visibilityState === "hidden") return;
      checking = true;
      try { await refreshRef.current(); } catch { /* Manual retry remains available. */ }
      finally { checking = false; }
    };
    const bindTelegram = () => {
      try { webApp?.offEvent?.("activated", refreshOnReturn); } catch { /* Optional SDK. */ }
      webApp = window.Telegram?.WebApp;
      try { webApp?.onEvent?.("activated", refreshOnReturn); } catch { /* Browser fallback. */ }
    };
    bindTelegram();
    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("telegram-mini-app-ready", bindTelegram);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      disposed = true;
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("telegram-mini-app-ready", bindTelegram);
      document.removeEventListener("visibilitychange", refreshOnReturn);
      try { webApp?.offEvent?.("activated", refreshOnReturn); } catch { /* Optional SDK. */ }
    };
  }, [telegramConnectOpen, telegramLinkCode]);

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
    // URL callback parameters are consumed exactly once on route mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
