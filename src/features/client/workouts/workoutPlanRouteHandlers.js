import { APP_PAGES } from "../../../app/appPages";

export function createWorkoutPlanRouteHandlers({
  setIndividualWorkoutIndex,
  setIndividualWorkoutIndexInitialized,
  setSelectedWorkoutId,
  setPage,
  loadHistory
}) {
  const scrollToTop = () => {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
  };

  return {
    onOpenWorkoutPlanWorkout(index) {
      setIndividualWorkoutIndex(index);
      setIndividualWorkoutIndexInitialized(true);
      setSelectedWorkoutId(null);
      setPage(APP_PAGES.WORKOUTS);
      scrollToTop();
    },
    onOpenWorkoutPlanWorkouts() {
      setSelectedWorkoutId(null);
      setPage(APP_PAGES.WORKOUTS);
      scrollToTop();
    },
    onOpenWorkoutPlan() {
      setPage(APP_PAGES.WORKOUT_PLAN);
      scrollToTop();
    },
    onOpenWorkoutPlanHistory() {
      loadHistory();
      setPage(APP_PAGES.HISTORY);
    }
  };
}
