export const loadTrainerAdminWorkoutsRoute = () => import("../features/trainer/TrainerAdminWorkoutsRoute");
export const loadTrainerDashboardRoute = () => import("../features/trainer/TrainerDashboardRoute");
export const loadTrainerUsersRoute = () => import("../features/trainer/TrainerUsersRoute");
export const loadWorkoutStyles = () => import("../styles/client-workout-lazy.css");
export const loadWorkoutRunRoute = () => Promise.all([
  loadWorkoutStyles(),
  import("../features/client/workouts/WorkoutRunRoute")
]).then(([, module]) => module);

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
