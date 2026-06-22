import { APP_PAGES } from "../../../app/appPages";

export function createBottomBarActions({
  loadHistory,
  setProfileActiveTab,
  setPage,
  openAdminClientsWithFilter,
  openAdminProgramsOverview
}) {
  return {
    openTrainerCabinetFromBottomBar() {
      loadHistory();
      setProfileActiveTab("cabinet");
      setPage(APP_PAGES.PROFILE);
    },
    openTrainerClientsList() {
      return openAdminClientsWithFilter("all");
    },
    openTrainerProgramsList() {
      return openAdminProgramsOverview();
    }
  };
}
