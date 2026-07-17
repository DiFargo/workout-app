export const loadTrainerAdminWorkoutsRoute = () => import("../features/trainer/TrainerAdminWorkoutsRoute");
export const loadTrainerDashboardRoute = () => import("../features/trainer/TrainerDashboardRoute");
export const loadTrainerUsersRoute = () => import("../features/trainer/TrainerUsersRoute");
export const loadWorkoutRunRoute = () => import("../features/client/workouts/WorkoutRunRoute");

export function preloadClientTerminalRouteChunks() {
  return Promise.allSettled([
    loadWorkoutRunRoute()
  ]);
}
