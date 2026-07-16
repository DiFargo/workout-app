export function createWorkoutListProps({
  appVersion,
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
  goBackToMain,
  loadHistory,
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
    onGoMain: goBackToMain,
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
