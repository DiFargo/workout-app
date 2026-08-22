import { APP_PAGES } from "../../app/appPages";

const TRAINER_NEXT_SECTIONS = new Set([
  "dashboard",
  "clients",
  "notifications",
  "analytics",
  "cabinet",
  "more",
  "nutrition",
  "workouts",
  "library",
  "client"
]);

export function normalizeTrainerNextSection(section = "dashboard") {
  const normalized = String(section || "dashboard").trim().toLowerCase();
  return TRAINER_NEXT_SECTIONS.has(normalized) ? normalized : "dashboard";
}

export function isTrainerNextWorkspacePage({ canUseTrainerFeatures, page }) {
  return (
    Boolean(canUseTrainerFeatures) &&
    [APP_PAGES.ADMIN, APP_PAGES.ADMIN_USERS, APP_PAGES.ADMIN_WORKOUTS].includes(page)
  );
}

export function createTrainerNavigationActions({
  canUseAdminFeatures,
  canUseTrainerFeatures,
  page,
  usersList,
  setPage,
  setProfileActiveTab,
  setTrainerNextSection,
  setAdminUsersSelectedTab,
  setAdminSelectedClient,
  setAdminBaseLibraryTab,
  loadAdminClientOverview,
  setTrainerProgramManagerOpen,
  setTrainerWorkoutTab
}) {
  const hasAdminAccess = typeof canUseAdminFeatures === "function"
    ? canUseAdminFeatures
    : () => Boolean(canUseAdminFeatures);

  const openAdminBaseLibrary = (tab) => {
    setTrainerProgramManagerOpen(false);
    setAdminBaseLibraryTab?.(tab === "exercises" ? "exercises" : "programs");
    setPage(APP_PAGES.ADMIN_LIBRARY);
  };

  return {
    isTrainerNextWorkspace() {
      return isTrainerNextWorkspacePage({
        canUseTrainerFeatures: canUseTrainerFeatures(),
        page
      });
    },
    navigateTrainerNext(section = "dashboard") {
      const nextSection = normalizeTrainerNextSection(section);

      setTrainerNextSection(nextSection === "more" ? "cabinet" : nextSection);

      if (nextSection === "workouts") {
        if (hasAdminAccess()) {
          openAdminBaseLibrary("programs");
          return;
        }
        setTrainerProgramManagerOpen(true);
        setTrainerWorkoutTab("plan");
        setPage(APP_PAGES.ADMIN_WORKOUTS);
        return;
      }

      if (nextSection === "library") {
        if (hasAdminAccess()) {
          openAdminBaseLibrary("exercises");
          return;
        }
        setTrainerProgramManagerOpen(false);
        setTrainerWorkoutTab("library");
        setPage(APP_PAGES.ADMIN_WORKOUTS);
        return;
      }

      if (nextSection === "nutrition") {
        setPage(APP_PAGES.ADMIN_WORKOUTS);
        return;
      }

      if (nextSection === "cabinet") {
        setPage(APP_PAGES.ADMIN);
        setProfileActiveTab("cabinet");
        return;
      }

      setPage(APP_PAGES.ADMIN);
    },
    openTrainerNextClient(client, targetTab = "") {
      const targetClient = client?.id
        ? usersList.find((item) => item.id === client.id) || client
        : null;

      if (!targetClient) return;

      if (targetTab && typeof setAdminUsersSelectedTab === "function") {
        setAdminUsersSelectedTab(targetTab);
      }

      const isAdmin = typeof canUseAdminFeatures === "function"
        ? canUseAdminFeatures()
        : Boolean(canUseAdminFeatures);
      const isTrainerAccount = String(targetClient.role || "").trim().toLowerCase() === "trainer";
      const shouldOpenTrainerProfile = isAdmin && isTrainerAccount;

      setAdminSelectedClient(targetClient);
      setTrainerNextSection("client");
      setPage(shouldOpenTrainerProfile ? APP_PAGES.ADMIN_USERS : APP_PAGES.ADMIN);

      if (!shouldOpenTrainerProfile) {
        loadAdminClientOverview(targetClient);
      }
    },
    openTrainerProgramManager() {
      if (hasAdminAccess()) {
        openAdminBaseLibrary("programs");
        return;
      }
      setTrainerProgramManagerOpen(true);
      setPage(APP_PAGES.ADMIN_WORKOUTS);
    },
    openTrainerExerciseLibrary() {
      if (hasAdminAccess()) {
        openAdminBaseLibrary("exercises");
        return;
      }
      setTrainerProgramManagerOpen(false);
      setTrainerWorkoutTab("library");
      setPage(APP_PAGES.ADMIN_WORKOUTS);
    }
  };
}
