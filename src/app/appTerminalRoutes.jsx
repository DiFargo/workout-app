import { lazy, Suspense } from "react";
import ProfileDashboardRoute from "../features/client/profile/ProfileDashboardRoute";

const TrainerAdminWorkoutsRoute = lazy(() => import("../features/trainer/TrainerAdminWorkoutsRoute"));
const TrainerDashboardRoute = lazy(() => import("../features/trainer/TrainerDashboardRoute"));
const TrainerUsersRoute = lazy(() => import("../features/trainer/TrainerUsersRoute"));
const WorkoutRunRoute = lazy(() => import("../features/client/workouts/WorkoutRunRoute"));

function renderLazyTerminalRoute(route) {
  return <Suspense fallback={null}>{route}</Suspense>;
}

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
    return renderLazyTerminalRoute(<TrainerDashboardRoute {...ctx} />);
  }

  if (page === APP_PAGES.ADMIN_USERS) {
    return renderLazyTerminalRoute(<TrainerUsersRoute {...ctx} />);
  }

  if (page === APP_PAGES.ADMIN_WORKOUTS) {
    return renderLazyTerminalRoute(<TrainerAdminWorkoutsRoute {...ctx} />);
  }

  return renderLazyTerminalRoute(
    <WorkoutRunRoute
      {...ctx}
      setProfileDraft={ctx.setAiNutritionProfileDraft}
      onFirstSetupSubmit={ctx.handleFirstSetupSubmit}
    />
  );
}
