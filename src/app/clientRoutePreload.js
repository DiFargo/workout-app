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
