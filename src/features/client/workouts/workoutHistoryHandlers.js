import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";

import { getFailedHistoryQueue } from "../../../utils/offlineSyncStorage";

const HISTORY_LOAD_LABEL = "Firebase \u00b7 history load";
const STATUS_NO_USER = "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0435\u0449\u0451 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d";
const ERROR_NO_WORKOUT = "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u0434\u043b\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f.";
const ERROR_LOAD_HISTORY = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a.";
const STATUS_WORKOUT_DELETED = "\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430 \u0438\u0437 \u0438\u0441\u0442\u043e\u0440\u0438\u0438.";
const ERROR_DELETE_WORKOUT = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438\u043b\u0438 \u043f\u0440\u0430\u0432\u0430 Firebase.";

function getPendingWorkouts(uid) {
  return getFailedHistoryQueue(uid)
    .filter((item) => item?.entry)
    .map((item) => ({
      id: item.entry.clientSaveId || item.id,
      ...item.entry,
      pendingSync: true
    }));
}

export function createWorkoutHistoryHandlers({
  auth,
  db,
  historyDeleteCandidate,
  historyDeletingId,
  historySwipeId,
  historyTouchStartX,
  startPerformanceCheck,
  endPerformanceCheck,
  showAppError,
  setHistory,
  setHistoryLoading,
  setHistorySwipeId,
  setHistoryTouchStartX,
  setHistoryDeleteCandidate,
  setHistoryDeletingId,
  setOpenHistoryKey
}) {
  async function loadHistory() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.error(STATUS_NO_USER);
      return;
    }

    setHistoryLoading(true);
    startPerformanceCheck(HISTORY_LOAD_LABEL);

    try {
      const snapshot = await getDocs(
        collection(db, "users", currentUser.uid, "history")
      );
      if (auth.currentUser?.uid !== currentUser.uid) return;

      const workouts = [];

      snapshot.forEach((historyDoc) => {
        workouts.push({
          id: historyDoc.id,
          ...historyDoc.data()
        });
      });

      const pendingWorkouts = getPendingWorkouts(currentUser.uid);
      const mergedWorkouts = new Map(
        workouts.map((item) => [item.clientSaveId || item.id, item])
      );

      pendingWorkouts.forEach((item) => {
        const key = item.clientSaveId || item.id;
        if (!mergedWorkouts.has(key)) mergedWorkouts.set(key, item);
      });

      const nextHistory = Array.from(mergedWorkouts.values());
      nextHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

      setHistory(nextHistory);
      endPerformanceCheck(HISTORY_LOAD_LABEL, { records: nextHistory.length });
    } catch (err) {
      if (auth.currentUser?.uid !== currentUser.uid) return;
      console.error("History load failed:", err);
      const pendingWorkouts = getPendingWorkouts(currentUser.uid)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (pendingWorkouts.length) setHistory(pendingWorkouts);
      showAppError("load", ERROR_LOAD_HISTORY);
    } finally {
      if (auth.currentUser?.uid === currentUser.uid) setHistoryLoading(false);
    }
  }

  function requestDeleteOwnHistoryWorkout(workoutItem) {
    if (!workoutItem?.id) {
      showAppError("load", ERROR_NO_WORKOUT);
      return;
    }

    setHistorySwipeId("");
    setHistoryDeleteCandidate(workoutItem);
  }

  function closeHistoryDeleteConfirm() {
    if (historyDeletingId) return;
    setHistoryDeleteCandidate(null);
  }

  async function confirmDeleteOwnHistoryWorkout() {
    const workoutItem = historyDeleteCandidate;
    const currentUser = auth.currentUser;

    if (!currentUser || !workoutItem?.id) {
      showAppError("load", ERROR_NO_WORKOUT);
      setHistoryDeleteCandidate(null);
      return;
    }

    setHistoryDeletingId(workoutItem.id);

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "history", workoutItem.id));
      setHistory((prev) => prev.filter((item) => item.id !== workoutItem.id));
      setOpenHistoryKey((prev) => (prev === workoutItem.id ? null : prev));
      setHistoryDeleteCandidate(null);
      showAppError("savedLocal", STATUS_WORKOUT_DELETED);
    } catch (error) {
      console.error("Workout history delete failed:", error);
      showAppError("firebase", ERROR_DELETE_WORKOUT);
    } finally {
      setHistoryDeletingId("");
    }
  }

  function handleHistoryTouchStart(event, itemId) {
    setHistoryTouchStartX(event.touches?.[0]?.clientX ?? null);

    if (historySwipeId && historySwipeId !== itemId) {
      setHistorySwipeId("");
    }
  }

  function handleHistoryTouchEnd(event, item) {
    if (historyTouchStartX === null) return;

    const endX = event.changedTouches?.[0]?.clientX ?? historyTouchStartX;
    const diffX = endX - historyTouchStartX;

    setHistoryTouchStartX(null);

    if (diffX < -56) {
      setHistorySwipeId(item.id);
      return;
    }

    if (diffX > 38 && historySwipeId === item.id) {
      setHistorySwipeId("");
    }
  }

  return {
    loadHistory,
    requestDeleteOwnHistoryWorkout,
    closeHistoryDeleteConfirm,
    confirmDeleteOwnHistoryWorkout,
    handleHistoryTouchStart,
    handleHistoryTouchEnd
  };
}
