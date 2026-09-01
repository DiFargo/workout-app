import { APP_PAGES } from "./appPages";

const APP_ROUTER_PAGES = new Set([
  APP_PAGES.WORKOUT_MODE,
  APP_PAGES.BASIC_WORKOUT_QUIZ,
  APP_PAGES.BASIC_WORKOUT_TODAY,
  APP_PAGES.HISTORY,
  APP_PAGES.WORKOUT_PLAN,
  APP_PAGES.MEASUREMENT_WIZARD,
  APP_PAGES.AI_COACH,
  APP_PAGES.ADMIN_LIBRARY,
  APP_PAGES.ADMIN_PANEL,
  APP_PAGES.NUTRITION
]);

export function isAppRouterPage(page, { selectedWorkoutId } = {}) {
  if (page === APP_PAGES.WORKOUTS) {
    return !selectedWorkoutId;
  }

  return APP_ROUTER_PAGES.has(page);
}
