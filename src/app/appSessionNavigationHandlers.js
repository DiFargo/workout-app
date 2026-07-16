import { signOut } from "firebase/auth";

export function performAppLogout({
  auth,
  APP_PAGES,
  defaultNutritionState,
  createEmptyAiNutritionProfileDraft,
  createEmptyTelegramProfile,
  setProfileSettingsModalOpen,
  setProfileSettingsModalSection,
  setProfileAvatarCropOpen,
  setProfileAccountStatus,
  setIsLoggedIn,
  setUser,
  setIsAdminClaim,
  setCurrentUserRole,
  setPage,
  setPlan,
  setSelectedWorkoutId,
  setOpenVideoId,
  setFullscreenVideo,
  setCurrentExerciseIndex,
  setWorkoutStarted,
  setWorkoutStartedAt,
  setWorkoutFinishedAt,
  setIndividualWorkoutIndexInitialized,
  setWorkoutReadinessOpen,
  setWorkoutReadiness,
  setPostWorkoutFeedback,
  setPostWorkoutFeedbackOpen,
  setOpenHistoryKey,
  setSelectedUserId,
  setLogin,
  setPassword,
  setLoginError,
  setHistory,
  setNutrition,
  setRecentNutritionFoods,
  setNutritionCloudReady,
  setAiNutritionProfile,
  setAiNutritionProfileDraft,
  setAiNutritionSavedPlan,
  setTelegramProfile,
  setTelegramDraft,
  setTelegramStatus,
  setTelegramConnectOpen,
  setWorkoutDraftRestorePrompt,
  setWorkoutReadinessPending,
  setWorkoutExitPromptOpen,
  setWorkoutIncompleteConfirmOpen,
  setPendingWorkoutFeedback,
  setWarmupCompletedSteps,
  setWarmupTimerRunning,
  setRestTimerRunning,
  setWorkoutHistorySyncState,
  setFirstSetupCompletedInSession
}) {
  signOut(auth);

  setProfileSettingsModalOpen(false);
  setProfileSettingsModalSection("settings");
  setProfileAvatarCropOpen(false);
  setProfileAccountStatus("");
  setIsLoggedIn(false);
  setUser(null);
  setIsAdminClaim(false);
  setCurrentUserRole("client");
  setPage(APP_PAGES.MAIN);
  setPlan({ workouts: [] });
  setSelectedWorkoutId(null);
  setOpenVideoId(null);
  setFullscreenVideo(null);
  setCurrentExerciseIndex(0);
  setWorkoutStarted(false);
  setWorkoutStartedAt(null);
  setWorkoutFinishedAt(null);
  setIndividualWorkoutIndexInitialized(false);
  setWorkoutReadinessOpen(false);
  setWorkoutReadiness(null);
  setPostWorkoutFeedback(null);
  setPostWorkoutFeedbackOpen(false);
  setOpenHistoryKey(null);
  setSelectedUserId(null);
  setLogin("");
  setPassword("");
  setLoginError("");
  setHistory([]);
  setNutrition(defaultNutritionState);
  setRecentNutritionFoods([]);
  setNutritionCloudReady(false);
  setAiNutritionProfile(null);
  setAiNutritionProfileDraft(createEmptyAiNutritionProfileDraft());
  setAiNutritionSavedPlan(null);
  setTelegramProfile(createEmptyTelegramProfile());
  setTelegramDraft(createEmptyTelegramProfile());
  setTelegramStatus("");
  setTelegramConnectOpen(false);
  setWorkoutDraftRestorePrompt(null);
  setWorkoutReadinessOpen(false);
  setWorkoutReadinessPending(null);
  setWorkoutReadiness(null);
  setWorkoutExitPromptOpen(false);
  setWorkoutIncompleteConfirmOpen(false);
  setPendingWorkoutFeedback(null);
  setWarmupCompletedSteps([]);
  setWarmupTimerRunning(false);
  setRestTimerRunning(false);
  setWorkoutHistorySyncState("idle");
  setPostWorkoutFeedback(null);
  setPostWorkoutFeedbackOpen(false);
  setFirstSetupCompletedInSession(false);
}

export function resetClientToMain({
  APP_PAGES,
  setPage,
  setSelectedWorkoutId,
  setOpenVideoId,
  setFullscreenVideo,
  setCurrentExerciseIndex,
  setWorkoutStarted,
  setWorkoutStartedAt,
  setWorkoutFinishedAt,
  setWorkoutDraftRestorePrompt,
  setWorkoutReadinessOpen,
  setWorkoutReadinessPending,
  setWorkoutReadiness,
  setWorkoutExitPromptOpen,
  setWorkoutIncompleteConfirmOpen,
  setPendingWorkoutFeedback,
  setWarmupCompletedSteps,
  setWarmupTimerRunning,
  setRestTimerRunning,
  setRestTimerSeconds,
  setExerciseHistoryOpenId,
  setWorkoutHistorySyncState,
  setPostWorkoutFeedback,
  setPostWorkoutFeedbackOpen,
  setOpenHistoryKey
}) {
  setPage(APP_PAGES.MAIN);
  setSelectedWorkoutId(null);
  setOpenVideoId(null);
  setFullscreenVideo(null);
  setCurrentExerciseIndex(0);
  setWorkoutStarted(false);
  setWorkoutStartedAt(null);
  setWorkoutFinishedAt(null);
  setWorkoutDraftRestorePrompt(null);
  setWorkoutReadinessOpen(false);
  setWorkoutReadinessPending(null);
  setWorkoutReadiness(null);
  setWorkoutExitPromptOpen(false);
  setWorkoutIncompleteConfirmOpen(false);
  setPendingWorkoutFeedback(null);
  setWarmupCompletedSteps([]);
  setWarmupTimerRunning(false);
  setRestTimerRunning(false);
  setRestTimerSeconds(0);
  setExerciseHistoryOpenId("");
  setWorkoutHistorySyncState("idle");
  setPostWorkoutFeedback(null);
  setPostWorkoutFeedbackOpen(false);
  setOpenHistoryKey(null);
}

export function leaveClientWorkoutToPlan({
  APP_PAGES,
  setSelectedWorkoutId,
  setOpenVideoId,
  setFullscreenVideo,
  setInlinePlayingVideoId,
  setCurrentExerciseIndex,
  setWorkoutStarted,
  setWorkoutStartedAt,
  setWorkoutFinishedAt,
  setWorkoutReadinessOpen,
  setWorkoutReadinessPending,
  setWorkoutReadiness,
  setWorkoutExitPromptOpen,
  setWorkoutIncompleteConfirmOpen,
  setPendingWorkoutFeedback,
  setWarmupCompletedSteps,
  setWarmupTimerRunning,
  setRestTimerRunning,
  setRestTimerSeconds,
  setExerciseHistoryOpenId,
  setPostWorkoutFeedback,
  setPostWorkoutFeedbackOpen,
  setIsWorkoutSaved,
  setShowWorkoutSavedCard,
  setWorkoutHistorySyncState,
  setPage
}) {
  setSelectedWorkoutId(null);
  setOpenVideoId(null);
  setFullscreenVideo(null);
  setInlinePlayingVideoId("");
  setCurrentExerciseIndex(0);
  setWorkoutStarted(false);
  setWorkoutStartedAt(null);
  setWorkoutFinishedAt(null);
  setWorkoutReadinessOpen(false);
  setWorkoutReadinessPending(null);
  setWorkoutReadiness(null);
  setWorkoutExitPromptOpen(false);
  setWorkoutIncompleteConfirmOpen(false);
  setPendingWorkoutFeedback(null);
  setWarmupCompletedSteps([]);
  setWarmupTimerRunning(false);
  setRestTimerRunning(false);
  setRestTimerSeconds(0);
  setExerciseHistoryOpenId("");
  setPostWorkoutFeedback(null);
  setPostWorkoutFeedbackOpen(false);
  setIsWorkoutSaved(false);
  setShowWorkoutSavedCard(false);
  setWorkoutHistorySyncState("idle");
  setPage(APP_PAGES.WORKOUTS);
}

export function handleClientAppBackNavigation({
  APP_PAGES,
  page,
  fullscreenVideo,
  workoutExitPromptOpen,
  workoutIncompleteConfirmOpen,
  workoutDraftRestorePrompt,
  workoutReadinessOpen,
  selectedWorkoutId,
  barcodeScannerOpen,
  nutritionEditPageOpen,
  dishIngredientPickerOpen,
  nutritionCreateChoiceOpen,
  nutritionDeleteConfirmOpen,
  expandedNutritionMeals,
  nutritionPickerOpen,
  workoutStarted,
  currentExerciseIndex,
  workout,
  isWorkoutSaved,
  setFullscreenVideo,
  setWorkoutExitPromptOpen,
  setWorkoutIncompleteConfirmOpen,
  setPendingWorkoutFeedback,
  setWorkoutDraftRestorePrompt,
  leaveWorkoutToPlan,
  setBarcodeScannerOpen,
  cancelNutritionEditPage,
  setDishIngredientPickerOpen,
  setNutritionCreateChoiceOpen,
  setNutritionDeleteConfirmOpen,
  setExpandedNutritionMeals,
  setNutritionPickerOpen,
  setSelectedNutritionFood,
  setEditingNutritionItemId,
  setNutritionEditDetailsOpen,
  setNutritionEditPageOpen,
  setNutritionMealMenuOpen,
  goToPreviousExercise,
  requestLeaveWorkout,
  goBackToMain
}) {
  if (fullscreenVideo) {
    setFullscreenVideo(null);
    return true;
  }

  if (workoutExitPromptOpen) {
    setWorkoutExitPromptOpen(false);
    return true;
  }

  if (workoutIncompleteConfirmOpen) {
    setWorkoutIncompleteConfirmOpen(false);
    setPendingWorkoutFeedback(null);
    return true;
  }

  if (workoutDraftRestorePrompt) {
    setWorkoutDraftRestorePrompt(null);
    return true;
  }

  if (workoutReadinessOpen && selectedWorkoutId) {
    leaveWorkoutToPlan();
    return true;
  }

  if (barcodeScannerOpen) {
    setBarcodeScannerOpen(false);
    return true;
  }

  if (nutritionEditPageOpen) {
    cancelNutritionEditPage();
    return true;
  }

  if (dishIngredientPickerOpen) {
    setDishIngredientPickerOpen(false);
    return true;
  }

  if (nutritionCreateChoiceOpen) {
    setNutritionCreateChoiceOpen(false);
    return true;
  }

  if (nutritionDeleteConfirmOpen) {
    setNutritionDeleteConfirmOpen(false);
    return true;
  }

  if (Object.values(expandedNutritionMeals || {}).some(Boolean)) {
    setExpandedNutritionMeals({});
    return true;
  }

  if (nutritionPickerOpen) {
    setNutritionPickerOpen(false);
    setSelectedNutritionFood(null);
    setEditingNutritionItemId(null);
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionMealMenuOpen(false);
    setBarcodeScannerOpen(false);
    return true;
  }

  if (selectedWorkoutId && workoutStarted) {
    if (currentExerciseIndex > 0 && currentExerciseIndex <= (workout?.exercises?.length || 0)) {
      goToPreviousExercise();
    } else if (currentExerciseIndex === 0) {
      requestLeaveWorkout();
    } else if (isWorkoutSaved) {
      goBackToMain();
    } else {
      requestLeaveWorkout();
    }
    return true;
  }

  if (selectedWorkoutId) {
    leaveWorkoutToPlan();
    return true;
  }

  if (page !== APP_PAGES.MAIN) {
    goBackToMain();
    return true;
  }

  return false;
}

export function createAppSessionNavigationHandlers(deps) {
  function goBackToMain() {
    resetClientToMain(deps);
  }

  function leaveWorkoutToPlan() {
    leaveClientWorkoutToPlan(deps);
  }

  function requestLeaveWorkout() {
    if (deps.workoutStarted && !deps.isWorkoutSaved) {
      deps.setWorkoutExitPromptOpen(true);
      return;
    }

    leaveWorkoutToPlan();
  }

  function handleAppBackNavigation() {
    return handleClientAppBackNavigation({
      ...deps,
      leaveWorkoutToPlan,
      requestLeaveWorkout,
      goBackToMain
    });
  }

  return {
    logout: () => performAppLogout(deps),
    goBackToMain,
    leaveWorkoutToPlan,
    requestLeaveWorkout,
    handleAppBackNavigation
  };
}
