import { APP_PAGES } from "../../../app/appPages";

export function createWorkoutListProps({
  appVersion,
  renderClientMainBottomBar,
  plan,
  history,
  workoutCalendar,
  userId,
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
  isTrainerMode,
  goBackToMain,
  openTrainingEntry,
  setPage,
  loadHistory,
  setProfileActiveTab,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  openWorkout,
  openSavedBasicWorkoutsOrQuiz,
  openBasicWorkoutQuiz,
  openCabinetWorkoutHistory,
  rescheduleWorkout,
  handleWorkoutDraftChoice
}) {
  return {
    appVersion,
    renderClientMainBottomBar,
    plan,
    history,
    workoutCalendar: workoutCalendar || {},
    currentUserId: userId || "",
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
    isTrainerMode,
    onGoMain: goBackToMain,
    onOpenTraining: openTrainingEntry,
    onOpenNutrition: () => setPage(APP_PAGES.NUTRITION),
    onOpenCabinet: () => {
      loadHistory();
      setProfileActiveTab("cabinet");
      setPage(APP_PAGES.PROFILE);
    },
    onOpenTrainerClients: () => openAdminClientsWithFilter("all"),
    onOpenTrainerPrograms: openAdminProgramsOverview,
    loadHistory,
    openWorkout,
    onOpenBasicMode: openSavedBasicWorkoutsOrQuiz,
    onOpenBasicSettings: openBasicWorkoutQuiz,
    onOpenBasicToday: () => setPage(APP_PAGES.BASIC_WORKOUT_TODAY),
    onOpenPlan: () => setPage(APP_PAGES.WORKOUT_PLAN),
    onOpenHistory: () => {
      loadHistory();
      setPage(APP_PAGES.HISTORY);
    },
    openCabinetWorkoutHistory,
    onRescheduleWorkout: rescheduleWorkout,
    handleWorkoutDraftChoice
  };
}
