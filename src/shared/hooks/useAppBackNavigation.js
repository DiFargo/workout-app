import { useEffect } from "react";

export function useAppBackNavigation({
  isLoggedIn,
  appLoading,
  page,
  hasTransientScreen,
  isPrimaryPage,
  handleTransientBack,
  restorePrimaryPage
}) {
  useEffect(() => {
    const isPrimary = Boolean(isPrimaryPage && isPrimaryPage(page));
    const shouldTrapAndroidBack =
      isLoggedIn &&
      !appLoading &&
      (page !== undefined) &&
      (
        hasTransientScreen ||
        page !== "main"
      );

    if (!shouldTrapAndroidBack) return;

    const pageIsPrimary = isPrimary;
    const shouldPushSyntheticBackEntry =
      hasTransientScreen ||
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
        !hasTransientScreen &&
        pageIsPrimary &&
        targetPage &&
        isPrimaryPage(targetPage) &&
        targetPage !== page
      ) {
        restorePrimaryPage?.(targetPage);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
        return;
      }

      const handled = Boolean(handleTransientBack?.());

      if (handled && hasTransientScreen) {
        setTimeout(() => {
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
    isPrimaryPage,
    handleTransientBack,
    restorePrimaryPage
  ]);
}
