import { lazy, Suspense } from "react";
import "./AppTerminalProfileInfo.module.css";
import "./AppTerminalProfileWellness.module.css";
import "./AppTerminalCabinetBase.module.css";
import "./AppTerminalCabinetTrainer.module.css";
import "../features/client/measurements/ClientMeasurements.module.css";
import {
  loadTrainerAdminWorkoutsRoute,
  loadTrainerDashboardRoute,
  loadTrainerUsersRoute,
  loadProfileDashboardRoute,
  loadWorkoutRunRoute
} from "./appTerminalRouteLoaders";
import AccessDeniedScreen from "../components/common/AccessDeniedScreen";
import RouteFallback from "./RouteFallback";
import RouteContentReady from "./RouteContentReady.jsx";

const TrainerAdminWorkoutsRoute = lazy(loadTrainerAdminWorkoutsRoute);
const TrainerDashboardRoute = lazy(loadTrainerDashboardRoute);
const TrainerUsersRoute = lazy(loadTrainerUsersRoute);
const WorkoutRunRoute = lazy(loadWorkoutRunRoute);
const ProfileDashboardRoute = lazy(loadProfileDashboardRoute);

function renderLazyTerminalRoute(route, page, title, renderBottomBar, activeTab) {
  return <Suspense fallback={<RouteFallback title={title} renderBottomBar={renderBottomBar} activeTab={activeTab} />}>
    <RouteContentReady route={page}>{route}</RouteContentReady>
  </Suspense>;
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
    return renderLazyTerminalRoute(<TrainerDashboardRoute {...ctx} page={APP_PAGES.ADMIN} />, page, "Кабинет тренера");
  }

  if (page === APP_PAGES.PROFILE || page === APP_PAGES.MAIN) {
    return renderLazyTerminalRoute(
      <ProfileDashboardRoute
        {...ctx}
        loginContainerRef={ctx.telegramLoginContainerRef}
        onOpenClientTrainerTask={ctx.openClientTrainerTask}
      />, page, page === APP_PAGES.MAIN ? "Сегодня" : ctx.profileActiveTab === "progress" ? "Прогресс" : "Кабинет", ctx.renderClientMainBottomBar, page === APP_PAGES.MAIN ? "main" : ctx.profileActiveTab === "progress" ? "progress" : "cabinet"
    );
  }

  if (page === APP_PAGES.ADMIN) {
    return renderLazyTerminalRoute(<TrainerDashboardRoute {...ctx} />, page, "Кабинет тренера");
  }

  if (page === APP_PAGES.ADMIN_USERS) {
    return renderLazyTerminalRoute(<TrainerUsersRoute {...ctx} />, page, "Клиенты");
  }

  if (page === APP_PAGES.ADMIN_WORKOUTS) {
    return renderLazyTerminalRoute(<TrainerAdminWorkoutsRoute {...ctx} />, page, "Шаблоны программ");
  }

  return renderLazyTerminalRoute(
    <WorkoutRunRoute runtime={ctx} />, page, "Тренировка"
  );
}
