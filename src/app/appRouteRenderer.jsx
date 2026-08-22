import AppRouter from "./AppRouter";
import { createAppRouterProps } from "./appRouterProps";
import { createWorkoutListProps } from "../features/client/workouts/workoutListRouteProps";
import { createWorkoutPlanRouteHandlers } from "../features/client/workouts/workoutPlanRouteHandlers";

export function renderAppRoutePage(ctx) {
  const {
    APP_VERSION,
    auth,
    renderClientMainBottomBar,
    canUseTrainerFeatures,
    plan,
    history,
    profileWorkoutCalendarData,
    user,
    workoutModePreference,
    individualWorkoutIndex,
    individualWorkoutIndexInitialized,
    setIndividualWorkoutIndex,
    setIndividualWorkoutIndexInitialized,
    workoutHistoryModalOpen,
    setWorkoutHistoryModalOpen,
    workoutDraftRestorePrompt,
    workoutReadinessOpen,
    postWorkoutFeedbackOpen,
    fullscreenVideo,
    showFirstSetupOnboarding,
    historyLoading,
    goBackToMain,
    openTrainingEntry,
    setPage,
    loadHistory,
    setProfileActiveTab,
    openAdminClientsWithFilter,
    openAdminProgramsOverview,
    openWorkout,
    setSelectedWorkoutId,
    openSavedBasicWorkoutsOrQuiz,
    openBasicWorkoutQuiz,
    openCabinetWorkoutHistory,
    handleWorkoutDraftChoice
  } = ctx;

  const workoutListProps = createWorkoutListProps({
    appVersion: APP_VERSION,
    renderClientMainBottomBar,
    plan,
    history,
    workoutCalendar: profileWorkoutCalendarData,
    userId: (auth.currentUser || user)?.uid || "",
    workoutModePreference,
    individualWorkoutIndex,
    individualWorkoutIndexInitialized,
    setIndividualWorkoutIndex,
    setIndividualWorkoutIndexInitialized,
    workoutHistoryModalOpen,
    setWorkoutHistoryModalOpen,
    workoutDraftRestorePrompt,
    workoutReadinessOpen,
    postWorkoutFeedbackOpen,
    fullscreenVideo,
    showFirstSetupOnboarding,
    historyLoading,
    isTrainerMode: canUseTrainerFeatures(),
    goBackToMain,
    openTrainingEntry,
    setPage,
    loadHistory,
    setProfileActiveTab,
    openAdminClientsWithFilter,
    openAdminProgramsOverview,
    openWorkout,
    setSelectedWorkoutId,
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
