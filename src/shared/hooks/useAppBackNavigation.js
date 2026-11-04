import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { consumeModalBackLayer, getModalBackLayerCount, subscribeModalBackLayers } from "./modalBackNavigation.js";

export function useAppBackNavigation({
  isLoggedIn,
  appLoading,
  page,
  hasTransientScreen,
  isPrimaryPage,
  handleTransientBack,
  restorePrimaryPage
}) {
  const modalLayerCount = useSyncExternalStore(subscribeModalBackLayers, getModalBackLayerCount, () => 0);
  const hasAnyTransientScreen = hasTransientScreen || modalLayerCount > 0;
  const telegramBackStateRef = useRef({ hasAnyTransientScreen, handleTransientBack });
  useLayoutEffect(() => {
    telegramBackStateRef.current = { hasAnyTransientScreen, handleTransientBack };
  }, [hasAnyTransientScreen, handleTransientBack]);
  const shouldShowTelegramBackButton = Boolean(
    isLoggedIn &&
    !appLoading &&
    page !== undefined &&
    (hasAnyTransientScreen || page !== "main")
  );
  useEffect(() => {
    if (!modalLayerCount) return undefined;
    const onEscape = event => {
      if (event.key !== "Escape" || !getModalBackLayerCount()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      consumeModalBackLayer();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [modalLayerCount]);
  useEffect(() => {
    let boundBackButton = null;
    let removeBackButtonHandler = () => {};
    const syncTelegramBackButton = () => {
      const backButton = window.Telegram?.WebApp?.BackButton || null;
      if (backButton === boundBackButton) return;
      removeBackButtonHandler();
      removeBackButtonHandler = () => {};
      boundBackButton = backButton;
      if (!backButton) return;

      if (!shouldShowTelegramBackButton) {
        backButton.hide?.();
        return;
      }

      const onTelegramBack = () => {
        const current = telegramBackStateRef.current;
        if (current.hasAnyTransientScreen && window.history.state?.workoutAppBackTrap) {
          window.history.back();
          return;
        }
        if (!consumeModalBackLayer()) current.handleTransientBack?.();
      };

      backButton.onClick?.(onTelegramBack);
      backButton.show?.();
      removeBackButtonHandler = () => {
        backButton.offClick?.(onTelegramBack);
        backButton.hide?.();
      };
    };

    syncTelegramBackButton();
    window.addEventListener("telegram-mini-app-ready", syncTelegramBackButton);
    return () => {
      window.removeEventListener("telegram-mini-app-ready", syncTelegramBackButton);
      removeBackButtonHandler();
    };
  }, [shouldShowTelegramBackButton]);

  useEffect(() => {
    const isPrimary = Boolean(isPrimaryPage && isPrimaryPage(page));
    const shouldTrapAndroidBack =
      isLoggedIn &&
      !appLoading &&
      (page !== undefined) &&
      (
        hasAnyTransientScreen ||
        page !== "main"
      );

    if (!shouldTrapAndroidBack) return;

    const pageIsPrimary = isPrimary;
    const shouldPushSyntheticBackEntry =
      hasAnyTransientScreen ||
      !pageIsPrimary;

    if (shouldPushSyntheticBackEntry && !window.history.state?.workoutAppBackTrap) {
      window.history.pushState({
        ...(window.history.state || {}),
        workoutAppBackTrap: true,
        workoutAppPage: pageIsPrimary ? page : undefined
      }, "");
    }

    const onAndroidBack = (event) => {
      const targetPage = event.state?.workoutAppPage;
      if (
        !hasAnyTransientScreen &&
        pageIsPrimary &&
        targetPage &&
        isPrimaryPage(targetPage) &&
        targetPage !== page
      ) {
        restorePrimaryPage?.(targetPage);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
        return;
      }

      const handled = consumeModalBackLayer() || Boolean(handleTransientBack?.());

      if (handled && hasAnyTransientScreen) {
        setTimeout(() => {
          if (!hasTransientScreen && getModalBackLayerCount() === 0) return;
          if (!window.history.state?.workoutAppBackTrap) {
            window.history.pushState({
              ...(window.history.state || {}),
              workoutAppBackTrap: true,
              workoutAppPage: pageIsPrimary ? page : undefined
            }, "");
          }
        }, 0);
      }
    };

    window.addEventListener("popstate", onAndroidBack);

    return () => {
      window.removeEventListener("popstate", onAndroidBack);
    };
  }, [
    isLoggedIn,
    appLoading,
    page,
    hasTransientScreen,
    hasAnyTransientScreen,
    isPrimaryPage,
    handleTransientBack,
    restorePrimaryPage
  ]);
}
