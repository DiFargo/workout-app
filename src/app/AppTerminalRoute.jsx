import { lazy, Suspense } from "react";
import ProfileDashboardRoute from "../features/client/profile/ProfileDashboardRoute";
import "../styles/client-profile-lazy.css";
import {
  loadTrainerAdminWorkoutsRoute,
  loadTrainerDashboardRoute,
  loadTrainerUsersRoute,
  loadWorkoutRunRoute
} from "./appTerminalRouteLoaders";
import RouteFallback from "./RouteFallback";

const TrainerAdminWorkoutsRoute = lazy(loadTrainerAdminWorkoutsRoute);
const TrainerDashboardRoute = lazy(loadTrainerDashboardRoute);
const TrainerUsersRoute = lazy(loadTrainerUsersRoute);
const WorkoutRunRoute = lazy(loadWorkoutRunRoute);

function renderLazyTerminalRoute(route) {
  return <Suspense fallback={<RouteFallback />}>{route}</Suspense>;
}

export default function AppTerminalRoute({ ctx }) {
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
