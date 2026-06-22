import { APP_PAGES } from "../../app/appPages";

const TRAINER_NEXT_SECTIONS = new Set([
  "dashboard",
  "clients",
  "notifications",
  "messages",
  "analytics",
  "cabinet",
  "more",
  "nutrition",
  "workouts",
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
  canUseTrainerFeatures,
  page,
  usersList,
  setPage,
  setProfileActiveTab,
  setTrainerNextSection,
  setAdminSelectedClient,
  loadAdminClientOverview,
  setTrainerProgramManagerOpen,
  setTrainerWorkoutTab
}) {
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

      if (nextSection === "workouts" || nextSection === "nutrition") {
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
    openTrainerNextClient(client) {
      const targetClient = client?.id
        ? usersList.find((item) => item.id === client.id) || client
        : null;

      if (!targetClient) return;

      setAdminSelectedClient(targetClient);
      setTrainerNextSection("client");
      setPage(APP_PAGES.ADMIN);
      loadAdminClientOverview(targetClient);
    },
    openTrainerProgramManager() {
      setTrainerProgramManagerOpen(true);
      setPage(APP_PAGES.ADMIN_WORKOUTS);
    },
    openTrainerExerciseLibrary() {
      setTrainerWorkoutTab("programs");
      setPage(APP_PAGES.ADMIN_WORKOUTS);
    }
  };
}
