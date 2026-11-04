const withTrainerStyles = loader => Promise.all([
  import("../components/trainer/TrainerWorkspaceV2.module.css"),
  loader()
]).then(([, route]) => route);

export const loadTrainerAdminWorkoutsRoute = () => withTrainerStyles(() => import("../features/trainer/TrainerAdminWorkoutsRoute"));
export const loadTrainerDashboardRoute = () => withTrainerStyles(() => import("../features/trainer/TrainerDashboardRoute"));
export const loadTrainerUsersRoute = () => withTrainerStyles(() => import("../features/trainer/TrainerUsersRoute"));
export const loadProfileDashboardRoute = () => import("../features/client/profile/ProfileDashboardRoute");
export const loadWorkoutRunRoute = () => import("../features/client/workouts/WorkoutRunRoute");

export function preloadClientTerminalRouteChunks() {
  return Promise.allSettled([
    loadWorkoutRunRoute()
  ]);
}
