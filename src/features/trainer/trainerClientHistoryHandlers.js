import { deleteDoc, doc } from "firebase/firestore";

const STATUS_SELECT_HISTORY = "\u0412\u044b\u0431\u0435\u0440\u0438 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438 \u0434\u043b\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f.";
const STATUS_DELETE_SELECTED_SUCCESS = "\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438 \u0443\u0434\u0430\u043b\u0435\u043d\u044b.";
const STATUS_DELETE_SELECTED_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043f\u0440\u0430\u0432\u0430 Firestore.";
const STATUS_SELECT_WORKOUT = "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u0434\u043b\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f.";
const STATUS_DELETE_WORKOUT_SUCCESS = "\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430 \u0438\u0437 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_DELETE_WORKOUT_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043f\u0440\u0430\u0432\u0430 Firestore.";
const DEFAULT_WORKOUT_NAME = "\u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443";

export function createTrainerClientHistoryHandlers({
  db,
  adminSelectedClient,
  adminClientHistory,
  adminSelectedHistoryIds,
  selectedUserId,
  showAppConfirm,
  setAdminSelectedHistoryIds,
  setAdminClientStatus,
  setAdminDeletingWorkoutId,
  setAdminClientHistory,
  setHistory
}) {
  function toggleAdminSelectedHistoryId(workoutId) {
    setAdminSelectedHistoryIds((prev) => (
      prev.includes(workoutId)
        ? prev.filter((id) => id !== workoutId)
        : [...prev, workoutId]
    ));
  }

  function toggleAdminSelectAllHistory() {
    const visibleIds = adminClientHistory.slice(0, 20).map((item) => item.id).filter(Boolean);

    setAdminSelectedHistoryIds((prev) => (
      visibleIds.every((id) => prev.includes(id))
        ? prev.filter((id) => !visibleIds.includes(id))
        : [...new Set([...prev, ...visibleIds])]
    ));
  }

  async function deleteSelectedAdminClientHistory(client = adminSelectedClient) {
    if (!client?.id || !adminSelectedHistoryIds.length) {
      setAdminClientStatus(STATUS_SELECT_HISTORY);
      return;
    }

    const confirmed = await showAppConfirm(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438: ${adminSelectedHistoryIds.length}? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.`);
    if (!confirmed) return;

    setAdminDeletingWorkoutId("bulk");
    setAdminClientStatus("");

    try {
      await Promise.all(
        adminSelectedHistoryIds.map((workoutId) => deleteDoc(doc(db, "users", client.id, "history", workoutId)))
      );

      setAdminClientHistory((prev) => prev.filter((item) => !adminSelectedHistoryIds.includes(item.id)));

      if (selectedUserId === client.id) {
        setHistory((prev) => prev.filter((item) => !adminSelectedHistoryIds.includes(item.id)));
      }

      setAdminSelectedHistoryIds([]);
      setAdminClientStatus(STATUS_DELETE_SELECTED_SUCCESS);
    } catch (error) {
      console.error("Admin selected workout history delete failed:", error);
      setAdminClientStatus(STATUS_DELETE_SELECTED_FAILED);
    } finally {
      setAdminDeletingWorkoutId("");
    }
  }

  async function deleteAdminClientWorkoutHistory(workoutItem, client = adminSelectedClient) {
    if (!client?.id || !workoutItem?.id) {
      setAdminClientStatus(STATUS_SELECT_WORKOUT);
      return;
    }

    const workoutName = workoutItem.workout || DEFAULT_WORKOUT_NAME;
    const confirmed = await showAppConfirm(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c "${workoutName}" \u0438\u0437 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.`);

    if (!confirmed) return;

    setAdminDeletingWorkoutId(workoutItem.id);
    setAdminClientStatus("");

    try {
      await deleteDoc(doc(db, "users", client.id, "history", workoutItem.id));

      setAdminClientHistory((prev) => prev.filter((item) => item.id !== workoutItem.id));

      if (selectedUserId === client.id) {
        setHistory((prev) => prev.filter((item) => item.id !== workoutItem.id));
      }

      setAdminClientStatus(STATUS_DELETE_WORKOUT_SUCCESS);
    } catch (error) {
      console.error("Admin workout history delete failed:", error);
      setAdminClientStatus(STATUS_DELETE_WORKOUT_FAILED);
    } finally {
      setAdminDeletingWorkoutId("");
    }
  }

  return {
    toggleAdminSelectedHistoryId,
    toggleAdminSelectAllHistory,
    deleteSelectedAdminClientHistory,
    deleteAdminClientWorkoutHistory
  };
}
