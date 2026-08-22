import {
  replayFailedHistorySavesWithDeps,
  replayFailedNutritionSyncWithDeps
} from "../offline/offlineReplayHandlers";
import { loadWorkoutsFromFirebaseWithDeps } from "./workoutFirebaseLoadHandlers";
import { saveWorkoutsToFirebaseWithDeps } from "./workoutPlanFirebaseSaveHandlers";
import { saveTrainerNextPlanWithDeps } from "./workoutPlanUpdateHandlers";

export function createWorkoutPersistenceHandlers(getContext) {
  async function replayFailedHistorySaves(uid) {
    const {
      auth,
      db,
      historyReplayInProgressRef,
      loadHistory,
      setWorkoutHistorySyncState,
      showAppError
    } = getContext();

    return replayFailedHistorySavesWithDeps({
      db,
      uid: uid || auth.currentUser?.uid,
      historyReplayInProgressRef,
      setWorkoutHistorySyncState,
      loadHistory,
      showAppError
    });
  }

  async function replayFailedNutritionSync(uid) {
    const {
      auth,
      nutritionReplayInProgressRef,
      setNutrition,
      showAppError
    } = getContext();

    return replayFailedNutritionSyncWithDeps({
      uid: uid || auth.currentUser?.uid,
      nutritionReplayInProgressRef,
      setNutrition,
      showAppError
    });
  }

  async function loadWorkoutsFromFirebase(userIdFromClick, options = {}) {
    const {
      BASIC_WORKOUT_PLAN_STORAGE_KEY,
      STORAGE_KEY,
      WORKOUT_MODE_STORAGE_KEY,
      auth,
      canUseAdminFeatures,
      db,
      endPerformanceCheck,
      normalizeExercise,
      plan,
      selectedUserId,
      workoutModePreference,
      setPlan,
      showAppError,
      sortWorkoutDays,
      startPerformanceCheck
    } = getContext();

    return loadWorkoutsFromFirebaseWithDeps({
      db,
      auth,
      selectedUserId,
      plan,
      workoutModePreference,
      storageKey: STORAGE_KEY,
      basicWorkoutPlanStorageKey: BASIC_WORKOUT_PLAN_STORAGE_KEY,
      workoutModeStorageKey: WORKOUT_MODE_STORAGE_KEY,
      normalizeExercise,
      sortWorkoutDays,
      canUseAdminFeatures,
      startPerformanceCheck,
      endPerformanceCheck,
      showAppError,
      setPlan,
      userIdFromClick,
      options
    });
  }

  async function saveWorkoutsToFirebase(planOverride = null, options = {}) {
    const {
      WORKOUT_CALENDAR_STORAGE_KEY,
      WORKOUT_PLAN_BACKUP_STORAGE_KEY,
      auth,
      db,
      plan,
      selectedUserId,
      setAdminClientStatus,
      setAdminSelectedClient,
      setProfileWorkoutCalendarData,
      setProfileWorkoutCalendarDraftDates,
      setProfileWorkoutScheduledDates,
      setUsersList,
      showAppError
    } = getContext();

    return saveWorkoutsToFirebaseWithDeps({
      db,
      auth,
      selectedUserId,
      plan,
      workoutPlanBackupStorageKey: WORKOUT_PLAN_BACKUP_STORAGE_KEY,
      workoutCalendarStorageKey: WORKOUT_CALENDAR_STORAGE_KEY,
      showAppError,
      setAdminClientStatus,
      setAdminSelectedClient,
      setUsersList,
      setProfileWorkoutCalendarData,
      setProfileWorkoutScheduledDates,
      setProfileWorkoutCalendarDraftDates,
      planOverride,
      options
    });
  }

  async function saveTrainerNextPlan(nextWorkouts, options = {}) {
    const { plan, setPlan } = getContext();

    return saveTrainerNextPlanWithDeps({
      plan,
      nextWorkouts,
      options,
      saveWorkoutsToFirebase,
      setPlan
    });
  }

  return {
    loadWorkoutsFromFirebase,
    replayFailedHistorySaves,
    replayFailedNutritionSync,
    saveTrainerNextPlan,
    saveWorkoutsToFirebase
  };
}
