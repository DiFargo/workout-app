import { captureAuthSession } from "../utils/authSession.js";

export function createInitialWorkoutHandlers(getContext) {
  async function retryInitialWorkouts() {
    const { auth, currentUserRole, workoutRetryRef, setInitialWorkoutLoadState, loadWorkoutsFromFirebase } = getContext();
    const session = captureAuthSession(auth);
    if (!session.uid || currentUserRole !== "client" || workoutRetryRef.current?.session.isCurrent()) return;
    const operation = { uid: session.uid, session };
    workoutRetryRef.current = operation;
    setInitialWorkoutLoadState("loading");
    try {
      await loadWorkoutsFromFirebase(session.uid, { preserveBasicPlanOnEmpty: true });
      // Only the current loader generation publishes ready/error via its callbacks.
    } catch {
      if (session.isCurrent() && workoutRetryRef.current === operation) setInitialWorkoutLoadState("error");
    } finally {
      if (workoutRetryRef.current === operation) workoutRetryRef.current = null;
    }
  }

  async function retryWorkoutSync() {
    const { auth, currentUserRole, replayFailedHistorySaves, loadHistory } = getContext();
    const session = captureAuthSession(auth);
    if (!session.uid || currentUserRole !== "client") return;
    await replayFailedHistorySaves(session.uid);
    if (session.isCurrent()) await loadHistory();
  }

  function retryPendingSync() {
    const { auth, showAppError, replayFailedHistorySaves, replayFailedNutritionSync, replayFailedMeasurementSaves } = getContext();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    showAppError("savedLocal", "Соединение восстановлено. Проверяем несинхронизированные изменения.");
    return Promise.allSettled([replayFailedHistorySaves(uid), replayFailedNutritionSync(uid), replayFailedMeasurementSaves(uid)]);
  }
  return { retryInitialWorkouts, retryWorkoutSync, retryPendingSync };
}
