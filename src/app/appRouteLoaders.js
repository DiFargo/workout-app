export const loadAdminPanelHub = () => import("../components/admin/AdminPanelHub");
export const loadWorkoutStyles = () => import("../styles/client-workout-lazy.css");
export const loadAiCoachPage = () => import("../features/client/ai/AiCoachPage");
export const loadBasicWorkoutQuizPage = () => Promise.all([
  loadWorkoutStyles(),
  import("../features/client/workouts/BasicWorkoutQuizPage")
]).then(([, module]) => module);
export const loadMeasurementStyles = () => import("../styles/client-measurements-lazy.css");
export const loadMeasurementWizardPage = () => Promise.all([
  loadMeasurementStyles(),
  import("../features/client/measurements/MeasurementWizardPage")
]).then(([, module]) => module);
export const loadWorkoutHistoryPage = () => Promise.all([
  loadWorkoutStyles(),
  import("../features/client/workouts/WorkoutHistoryPage")
]).then(([, module]) => module);
export const loadWorkoutListPage = () => Promise.all([
  loadWorkoutStyles(),
  import("../features/client/workouts/WorkoutListPage")
]).then(([, module]) => module);
export const loadWorkoutModePage = () => Promise.all([
  loadWorkoutStyles(),
  import("../features/client/workouts/WorkoutModePage")
]).then(([, module]) => module);
export const loadWorkoutPlanPage = () => Promise.all([
  loadWorkoutStyles(),
  import("../features/client/workouts/WorkoutPlanPage")
]).then(([, module]) => module);

export function preloadClientRouteChunks() {
  return Promise.allSettled([
    loadWorkoutListPage(),
    loadWorkoutModePage(),
    loadWorkoutHistoryPage(),
    loadWorkoutPlanPage(),
    loadBasicWorkoutQuizPage(),
    loadMeasurementWizardPage(),
    loadAiCoachPage()
  ]);
}
