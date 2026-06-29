import { lazy, Suspense } from "react";
import ProfileDashboardRoute from "../features/client/profile/ProfileDashboardRoute";
import "../styles/client-profile-lazy.css";
import RouteFallback from "./RouteFallback";

const loadTrainerAdminWorkoutsRoute = () => import("../features/trainer/TrainerAdminWorkoutsRoute");
const loadTrainerDashboardRoute = () => import("../features/trainer/TrainerDashboardRoute");
const loadTrainerUsersRoute = () => import("../features/trainer/TrainerUsersRoute");
const loadWorkoutStyles = () => import("../styles/client-workout-lazy.css");
const loadWorkoutRunRoute = () => Promise.all([
  loadWorkoutStyles(),
  import("../features/client/workouts/WorkoutRunRoute")
]).then(([, module]) => module);

const TrainerAdminWorkoutsRoute = lazy(loadTrainerAdminWorkoutsRoute);
const TrainerDashboardRoute = lazy(loadTrainerDashboardRoute);
const TrainerUsersRoute = lazy(loadTrainerUsersRoute);
const WorkoutRunRoute = lazy(loadWorkoutRunRoute);

export function preloadClientTerminalRouteChunks() {
  return Promise.allSettled([
    loadWorkoutRunRoute()
  ]);
}

export function preloadTrainerRouteChunks() {
  return Promise.allSettled([
    loadTrainerDashboardRoute(),
    loadTrainerUsersRoute(),
    loadTrainerAdminWorkoutsRoute()
  ]);
}

function renderLazyTerminalRoute(route) {
  return <Suspense fallback={<RouteFallback />}>{route}</Suspense>;
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
