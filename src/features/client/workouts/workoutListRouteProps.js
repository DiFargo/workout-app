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
  isTrainerMode,
  goBackToMain,
  openTrainingEntry,
  setPage,
  loadHistory,
  setProfileActiveTab,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  openWorkout,
  saveWorkoutModePreference,
  setSelectedWorkoutId,
  openIndividualWorkouts,
  openCabinetWorkoutHistory,
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
    onOpenBasicMode: () => {
      setWorkoutModeModalOpen(false);
      saveWorkoutModePreference("basic", true);
      setSelectedWorkoutId(null);
      setPage(APP_PAGES.BASIC_WORKOUT_QUIZ);
    },
    onOpenIndividualWorkouts: openIndividualWorkouts,
    openCabinetWorkoutHistory,
    handleWorkoutDraftChoice
  };
}
