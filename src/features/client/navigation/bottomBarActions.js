import { APP_PAGES } from "../../../app/appPages";

export function createBottomBarActions({
  loadHistory,
  setProfileActiveTab,
  setPage,
  openAdminClientsWithFilter,
  openAdminProgramsOverview
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
    openTrainerCabinetFromBottomBar() {
      setProfileActiveTab("cabinet");
      setPage(APP_PAGES.PROFILE);
      runAfterNavigation(loadHistory);
    },
    openTrainerClientsList() {
      return openAdminClientsWithFilter("all");
    },
    openTrainerProgramsList() {
      return openAdminProgramsOverview();
    }
  };
}
