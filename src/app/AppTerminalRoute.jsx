import { lazy, Suspense } from "react";
import ProfileDashboardRoute from "../features/client/profile/ProfileDashboardRoute";
import "./AppTerminalProfileInfo.module.css";
import "./AppTerminalProfileWellness.module.css";
import "./AppTerminalCabinetBase.module.css";
import "./AppTerminalCabinetTrainer.module.css";
import "../features/client/measurements/ClientMeasurements.module.css";
import {
  loadTrainerAdminWorkoutsRoute,
  loadTrainerDashboardRoute,
  loadTrainerUsersRoute,
  loadWorkoutRunRoute
} from "./appTerminalRouteLoaders";
import AccessDeniedScreen from "../components/common/AccessDeniedScreen";
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
  const canUseTrainerFeatures = typeof ctx.canUseTrainerFeatures === "function"
    ? ctx.canUseTrainerFeatures()
    : Boolean(ctx.canUseTrainerFeatures);
  const isTrainerPage = [
    APP_PAGES.ADMIN,
    APP_PAGES.ADMIN_USERS,
    APP_PAGES.ADMIN_WORKOUTS
  ].includes(page);

  if (isTrainerPage && !canUseTrainerFeatures) {
    return (
      <AccessDeniedScreen
        message="Тренерская доступна админам и пользователям с ролью тренера."
        onBack={() => ctx.setPage(APP_PAGES.MAIN)}
      />
    );
  }

  if (canUseTrainerFeatures && (page === APP_PAGES.PROFILE || page === APP_PAGES.MAIN)) {
    return renderLazyTerminalRoute(<TrainerDashboardRoute {...ctx} page={APP_PAGES.ADMIN} />);
  }

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
    <WorkoutRunRoute runtime={ctx} />
  );
}
