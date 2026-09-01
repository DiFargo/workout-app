import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";
import { doc, setDoc } from "firebase/firestore";
import { isWorkoutPlanForMode } from "../../../utils/workoutPlanMode";

export function createWorkoutEntryNavigation({
  APP_PAGES,
  STORAGE_KEY,
  WORKOUT_MODE_STORAGE_KEY,
  auth,
  db,
  user,
  plan,
  workoutModePreference,
  workoutModeRemember,
  setWorkoutModePreference,
  setWorkoutModeRemember,
  setSelectedWorkoutId,
  setIndividualWorkoutIndex,
  setIndividualWorkoutIndexInitialized,
  setPlan,
  setPage,
  loadWorkoutsFromFirebase
}) {
  function saveWorkoutModePreference(mode, remember = workoutModeRemember) {
    const currentUser = auth.currentUser || user;
    const nextPreference = {
      mode,
      remember: Boolean(remember),
      updatedAt: new Date().toISOString()
    };

    setWorkoutModePreference(nextPreference);
    setWorkoutModeRemember(Boolean(remember));

    if (currentUser?.uid) {
      safeWriteUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, currentUser.uid, nextPreference);
      setDoc(doc(db, "users", currentUser.uid), {
        workoutModePreference: nextPreference,
        updatedAt: nextPreference.updatedAt
      }, { merge: true }).catch((error) => {
        console.warn("Workout mode preference sync error", error);
      });
    }
  }

  function openIndividualWorkouts() {
    saveWorkoutModePreference("individual", workoutModeRemember);
    const currentUserId = (auth.currentUser || user)?.uid;
    const cachedIndividualPlan = currentUserId
      ? safeReadUserJsonStorage(STORAGE_KEY, currentUserId, null)
      : null;

    if (
      isWorkoutPlanForMode(cachedIndividualPlan, "individual") &&
      cachedIndividualPlan?.workouts?.length > 0
    ) {
      setPlan(cachedIndividualPlan);
    } else if (!isWorkoutPlanForMode(plan, "individual")) {
      setPlan({ workouts: [] });
    }

    setSelectedWorkoutId(null);
    setIndividualWorkoutIndex(0);
    setIndividualWorkoutIndexInitialized(false);
    setPage(APP_PAGES.WORKOUTS);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    if (currentUserId) {
      loadWorkoutsFromFirebase(currentUserId, {
        mode: "individual",
        preserveCurrentPlanOnError: true
      }).catch((error) => {
        console.warn("Background workouts refresh error", error);
      });
    }
  }

  function openSavedBasicWorkoutsOrQuiz() {
    saveWorkoutModePreference("basic", workoutModeRemember);
    setSelectedWorkoutId(null);
    setPage(APP_PAGES.BASIC_WORKOUT_TODAY);
  }

  function openBasicWorkoutQuiz() {
    saveWorkoutModePreference("basic", workoutModeRemember);
    setSelectedWorkoutId(null);
    setPage(APP_PAGES.BASIC_WORKOUT_TODAY);
  }

  function openTrainingEntry() {
    const currentUser = auth.currentUser || user;
    const savedPreference = currentUser?.uid
      ? safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, currentUser.uid, workoutModePreference)
      : workoutModePreference;

    if (savedPreference?.mode === "basic") {
      openSavedBasicWorkoutsOrQuiz();
      return;
    }

    // A trainer invitation starts the client in the individual mode. The mode
    // can still be changed deliberately from the Cabinet settings.
    openIndividualWorkouts();
  }

  return {
    saveWorkoutModePreference,
    openTrainingEntry,
    openIndividualWorkouts,
    openSavedBasicWorkoutsOrQuiz,
    openBasicWorkoutQuiz
  };
}
