import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";

export function createWorkoutEntryNavigation({
  APP_PAGES,
  WORKOUT_MODE_STORAGE_KEY,
  auth,
  user,
  workoutModePreference,
  workoutModeRemember,
  setWorkoutModePreference,
  setWorkoutModeRemember,
  setSelectedWorkoutId,
  setIndividualWorkoutIndex,
  setIndividualWorkoutIndexInitialized,
  setPage,
  loadWorkoutsFromFirebase
}) {
  function saveWorkoutModePreference(mode, remember = workoutModeRemember) {
    const currentUser = auth.currentUser || user;
    const nextPreference = {
      mode,
      remember: Boolean(remember)
    };

    setWorkoutModePreference(nextPreference);
    setWorkoutModeRemember(Boolean(remember));

    if (currentUser?.uid) {
      safeWriteUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, currentUser.uid, nextPreference);
    }
  }

  function openIndividualWorkouts() {
    saveWorkoutModePreference("individual", workoutModeRemember);
    setSelectedWorkoutId(null);
    setIndividualWorkoutIndex(0);
    setIndividualWorkoutIndexInitialized(false);
    setPage(APP_PAGES.WORKOUTS);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    const currentUserId = (auth.currentUser || user)?.uid;
    if (currentUserId) {
      loadWorkoutsFromFirebase(currentUserId, { preserveCurrentPlanOnError: true }).catch((error) => {
        console.warn("Background workouts refresh error", error);
      });
    }
  }

  function openBasicWorkoutQuiz() {
    saveWorkoutModePreference("basic", workoutModeRemember);
    setSelectedWorkoutId(null);
    setPage(APP_PAGES.BASIC_WORKOUT_QUIZ);
  }

  function openTrainingEntry() {
    const currentUser = auth.currentUser || user;
    const savedPreference = currentUser?.uid
      ? safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, currentUser.uid, workoutModePreference)
      : workoutModePreference;

    if (savedPreference?.remember && savedPreference?.mode === "basic") {
      openBasicWorkoutQuiz();
      return;
    }

    if (savedPreference?.remember && savedPreference?.mode === "individual") {
      openIndividualWorkouts();
      return;
    }

    setSelectedWorkoutId(null);
    setPage(APP_PAGES.WORKOUT_MODE);
  }

  return {
    saveWorkoutModePreference,
    openTrainingEntry,
    openIndividualWorkouts,
    openBasicWorkoutQuiz
  };
}
