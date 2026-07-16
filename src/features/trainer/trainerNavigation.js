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
  "client"
]);

export function normalizeTrainerNextSection(section = "dashboard") {
  const normalized = String(section || "dashboard").trim().toLowerCase();
  return TRAINER_NEXT_SECTIONS.has(normalized) ? normalized : "dashboard";
}

export function createTrainerNavigationActions({
  usersList,
  setPage,
  setProfileActiveTab,
  setTrainerNextSection,
  setAdminUsersSelectedTab,
  setAdminSelectedClient,
  loadAdminClientOverview,
  setTrainerProgramManagerOpen,
  setTrainerWorkoutTab
}) {
  return {
    navigateTrainerNext(section = "dashboard") {
      const nextSection = normalizeTrainerNextSection(section);

      setTrainerNextSection(nextSection === "more" ? "cabinet" : nextSection);

      if (nextSection === "workouts") {
        setTrainerProgramManagerOpen(true);
        setTrainerWorkoutTab("plan");
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
      setTrainerProgramManagerOpen(false);
      setTrainerWorkoutTab("library");
      setPage(APP_PAGES.ADMIN_WORKOUTS);
    }
  };
}
