import ProfileDashboardRoute from "../features/client/profile/ProfileDashboardRoute";
import WorkoutRunRoute from "../features/client/workouts/WorkoutRunRoute";
import TrainerAdminWorkoutsRoute from "../features/trainer/TrainerAdminWorkoutsRoute";
import TrainerDashboardRoute from "../features/trainer/TrainerDashboardRoute";
import TrainerUsersRoute from "../features/trainer/TrainerUsersRoute";

export function renderAppTerminalRoute(ctx) {
  const { APP_PAGES, page } = ctx;

  if (page === APP_PAGES.PROFILE || page === APP_PAGES.MAIN) {
    return (
      <ProfileDashboardRoute
        {...ctx}
        loginContainerRef={ctx.telegramLoginContainerRef}
        onOpenClientTrainerTask={ctx.openClientTrainerTask}
      />
    );
  }

  if (page === APP_PAGES.ADMIN) {
    return <TrainerDashboardRoute {...ctx} />;
  }

  if (page === APP_PAGES.ADMIN_USERS) {
    return <TrainerUsersRoute {...ctx} />;
  }

  if (page === APP_PAGES.ADMIN_WORKOUTS) {
    return <TrainerAdminWorkoutsRoute {...ctx} />;
  }

  return (
    <WorkoutRunRoute
      {...ctx}
      setProfileDraft={ctx.setAiNutritionProfileDraft}
      onFirstSetupSubmit={ctx.handleFirstSetupSubmit}
    />
  );
}
