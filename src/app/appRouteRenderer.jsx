import AppRouter from "./AppRouter";
import { createAppRouterProps } from "./appRouterProps";
import { createWorkoutListProps } from "../features/client/workouts/workoutListRouteProps";
import { createWorkoutPlanRouteHandlers } from "../features/client/workouts/workoutPlanRouteHandlers";

export function renderAppRoutePage(ctx) {
  const {
    APP_VERSION,
    auth,
    plan,
    history,
    profileWorkoutCalendarData,
    user,
    workoutModePreference,
    workoutModeRemember,
    individualWorkoutIndex,
    individualWorkoutIndexInitialized,
    setIndividualWorkoutIndex,
    setIndividualWorkoutIndexInitialized,
    workoutModeModalOpen,
    setWorkoutModeModalOpen,
    workoutHistoryModalOpen,
    setWorkoutHistoryModalOpen,
    workoutDraftRestorePrompt,
    workoutReadinessOpen,
    postWorkoutFeedbackOpen,
    fullscreenVideo,
    showFirstSetupOnboarding,
    historyLoading,
    goBackToMain,
    setPage,
    loadHistory,
    openWorkout,
    saveWorkoutModePreference,
    setSelectedWorkoutId,
    openIndividualWorkouts,
    openSavedBasicWorkoutsOrQuiz,
    openBasicWorkoutQuiz,
    openCabinetWorkoutHistory,
    handleWorkoutDraftChoice
  } = ctx;

  const workoutListProps = createWorkoutListProps({
    appVersion: APP_VERSION,
    plan,
    history,
    workoutCalendar: profileWorkoutCalendarData,
    userId: (auth.currentUser || user)?.uid || "",
    workoutModePreference,
    workoutModeRemember,
    individualWorkoutIndex,
    individualWorkoutIndexInitialized,
    setIndividualWorkoutIndex,
    setIndividualWorkoutIndexInitialized,
    workoutModeModalOpen,
    setWorkoutModeModalOpen,
    workoutHistoryModalOpen,
    setWorkoutHistoryModalOpen,
    workoutDraftRestorePrompt,
    workoutReadinessOpen,
    postWorkoutFeedbackOpen,
    fullscreenVideo,
    showFirstSetupOnboarding,
    historyLoading,
    goBackToMain,
    setPage,
    loadHistory,
    openWorkout,
    saveWorkoutModePreference,
    setSelectedWorkoutId,
    openIndividualWorkouts,
    openSavedBasicWorkoutsOrQuiz,
    openBasicWorkoutQuiz,
    openCabinetWorkoutHistory,
    handleWorkoutDraftChoice
  });

  const workoutPlanRouteHandlers = createWorkoutPlanRouteHandlers({
    setIndividualWorkoutIndex,
    setIndividualWorkoutIndexInitialized,
    setSelectedWorkoutId,
    setPage,
    loadHistory
  });

  const appRouterProps = createAppRouterProps({
    ...ctx,
    appVersion: APP_VERSION,
    workoutListProps,
    workoutPlanRouteHandlers
  });

  return <AppRouter {...appRouterProps} />;
}
