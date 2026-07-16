import {
  loadAiCoachPage,
  loadBasicWorkoutQuizPage,
  loadMeasurementWizardPage,
  loadWorkoutHistoryPage,
  loadWorkoutListPage,
  loadWorkoutModePage,
  loadWorkoutPlanPage
} from "./appRouteLoaders";
import { preloadClientTerminalRouteChunks } from "./appTerminalRouteLoaders";

export const preloadClientWorkoutEntryRoutes = () => Promise.allSettled([
  loadWorkoutModePage(),
  loadWorkoutListPage(),
  loadBasicWorkoutQuizPage()
]);

export const preloadClientSecondaryRoutes = () => Promise.allSettled([
  loadWorkoutHistoryPage(),
  loadWorkoutPlanPage(),
  loadMeasurementWizardPage(),
  loadAiCoachPage()
]);

export function preloadClientTrainingRoutes() {
  preloadClientWorkoutEntryRoutes();
  preloadClientTerminalRouteChunks();
}

function scheduleIdlePreload(callback, delay = 0) {
  if (typeof window === "undefined") return () => {};

  let idleId = null;
  const timeoutId = window.setTimeout(() => {
    const run = () => callback();
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
      return;
    }
    run();
  }, delay);

  return () => {
    window.clearTimeout(timeoutId);
    if (idleId !== null && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(idleId);
    }
  };
}

export function scheduleClientBackgroundRoutePreloads({
  isClient,
  isTrainerLike,
  loadNutritionRoute,
  preloadTrainerRouteChunks
}) {
  const cleanupPreloads = [];
  const schedule = (callback, delay) => {
    cleanupPreloads.push(scheduleIdlePreload(callback, delay));
  };

  if (isClient) {
    schedule(preloadClientWorkoutEntryRoutes, 900);
    schedule(() => {
      loadNutritionRoute().catch((error) => console.warn("Nutrition preload error", error));
    }, 1700);
    schedule(preloadClientTerminalRouteChunks, 2800);
    schedule(preloadClientSecondaryRoutes, 4200);
  } else if (isTrainerLike) {
    schedule(preloadTrainerRouteChunks, 1200);
  }

  return () => {
    cleanupPreloads.forEach((cleanup) => cleanup());
  };
}
