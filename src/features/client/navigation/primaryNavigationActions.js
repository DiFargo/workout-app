import { APP_PAGES } from "../../../app/appPages";

export function createPrimaryNavigationActions({
  loadHistory,
  setProfileActiveTab,
  setPage
}) {
  function runAfterNavigation(callback) {
    if (typeof callback !== "function") return;
    if (typeof window === "undefined") {
      callback();
      return;
    }

    window.requestAnimationFrame(() => {
      window.setTimeout(callback, 0);
    });
  }

  return {
    openClientCabinet() {
      setProfileActiveTab("cabinet");
      setPage(APP_PAGES.PROFILE);
      runAfterNavigation(loadHistory);
    }
  };
}
