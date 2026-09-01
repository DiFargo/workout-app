import {
  loadAiCoachPage,
  loadBasicWorkoutQuizPage,
  loadBasicWorkoutTodayPage,
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
  loadBasicWorkoutTodayPage(),
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
