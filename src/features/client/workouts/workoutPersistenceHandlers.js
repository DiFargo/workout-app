import {
  replayFailedHistorySavesWithDeps,
  replayFailedNutritionSyncWithDeps
} from "../offline/offlineReplayHandlers";
import { isConfirmedWorkoutPlan, loadWorkoutsFromFirebaseWithDeps } from "./workoutFirebaseLoadHandlers";
import { saveWorkoutsToFirebaseWithDeps } from "./workoutPlanFirebaseSaveHandlers";
import { saveTrainerNextPlanWithDeps } from "./workoutPlanUpdateHandlers";
import { captureAuthSession } from "../../../utils/authSession.js";
import { resolveWorkoutPlanMode } from "../../../utils/workoutPlanMode.js";
import { safeReadUserJsonStorage } from "../../../utils/userScopedStorage";

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

    const session = captureAuthSession(auth);
    const result = await replayFailedHistorySavesWithDeps({
      db,
      auth,
      uid: uid || auth.currentUser?.uid,
      historyReplayInProgressRef,
      setWorkoutHistorySyncState,
      loadHistory,
      showAppError
    });
    if (result?.syncedCount && session.isCurrent() && !getContext().workoutStarted) {
      // The replay invalidated pre-commit plan snapshots. Always give that
      // generation a fresh successor so the section cannot stay loading.
      await loadWorkoutsFromFirebase(session.uid, { force: true, preserveBasicPlanOnEmpty: true });
    }
    return result;
  }

  async function replayFailedNutritionSync(uid) {
    const {
      auth,
      nutritionReplayInProgressRef,
      setNutrition,
      showAppError
    } = getContext();

    return replayFailedNutritionSyncWithDeps({
      auth,
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
      readClientLoadingSnapshot,
      onOwnPlanLoadState,
      plan,
      selectedUserId,
      workoutModePreference,
      setPlan,
      showAppError,
      sortWorkoutDays,
      startPerformanceCheck
    } = getContext();

    const session = captureAuthSession(auth);
    const isOwnPlan = (userIdFromClick || selectedUserId || session.uid) === session.uid;
    const publish = state => { if (isOwnPlan && session.isCurrent()) onOwnPlanLoadState?.(state); };
    const storedPreference = isOwnPlan && WORKOUT_MODE_STORAGE_KEY
      ? safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, session.uid, null) : null;
    const mode = resolveWorkoutPlanMode({ options, workoutModePreference: storedPreference || workoutModePreference });
    if (!isOwnPlan || !isConfirmedWorkoutPlan(auth, plan, mode)) publish("loading");
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
      isCurrentRequest: () => {
        const current = getContext().workoutLoadContextRef?.current || getContext();
        return current.selectedUserId === selectedUserId && !current.workoutStarted;
      },
      isCurrentMediaRequest: () => {
        const current = getContext().workoutLoadContextRef?.current || getContext();
        return current.selectedUserId === selectedUserId;
      },
      options: { ...options, readSnapshot: options.readSnapshot || readClientLoadingSnapshot,
        onLoadReady: () => { publish("ready"); options.onLoadReady?.(); },
        onLoadError: error => { publish("error"); options.onLoadError?.(error); }
      }
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

    const result = await saveWorkoutsToFirebaseWithDeps({
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
    if (result && options.editorDraft && getContext().selectedUserId === selectedUserId) {
      const editedIds = new Set(options.editorDraft.baseline.workouts.map((workout) => workout.id));
      getContext().setPlan((current) => ({ ...current, workouts: [...current.workouts.filter((workout) => !editedIds.has(workout.id)), ...result.plan.workouts] }));
    }
    return result;
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
