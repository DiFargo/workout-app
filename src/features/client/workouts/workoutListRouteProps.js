import { APP_PAGES } from "../../../app/appPages";

export function createWorkoutListProps({
  appVersion,
  renderClientMainBottomBar,
  plan,
  history,
  workoutCalendar,
  userId,
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
  openIndividualWorkouts,
  openSavedBasicWorkoutsOrQuiz,
  openBasicWorkoutQuiz,
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
      openSavedBasicWorkoutsOrQuiz();
    },
    onOpenBasicSettings: () => {
      setWorkoutModeModalOpen(false);
      openBasicWorkoutQuiz();
    },
    onOpenIndividualWorkouts: openIndividualWorkouts,
    onToggleWorkoutModeRemember: (remember) => {
      saveWorkoutModePreference(workoutModePreference?.mode || "individual", remember);
    },
    openCabinetWorkoutHistory,
    handleWorkoutDraftChoice
  };
}
