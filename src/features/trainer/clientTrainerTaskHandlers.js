import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

import { APP_PAGES } from "../../app/appPages";
import {
  createClientResourceId,
  getClientTrainerTaskDestination,
  getTrainerTaskStatus
} from "../../domain/clientInsights";

export function createClientTrainerTaskHandlers({
  auth,
  db,
  setClientTrainerTasks,
  setProfileTrainerNotificationsOpen,
  setProfileProgressPhotoStatus,
  setProfileProgressPhotosModalOpen,
  setProfileMeasurementsModalOpen,
  setPage,
  openTrainingEntry,
  setProfileBodyMetricsOpen,
  setProfileSettingsModalSection,
  setProfileSettingsModalOpen,
  setProfileProgressModalOpen,
  showAppError,
  adminSelectedClient,
  adminNewTaskTitle,
  adminNewTaskDueDate,
  setAdminClientStatus,
  setAdminClientTasks,
  setAdminNewTaskTitle,
  setAdminNewTaskDueDate,
  recordTrainerEvent
}) {
  async function loadClientTrainerTasks(uid = auth.currentUser?.uid) {
    if (!uid) {
      setClientTrainerTasks([]);
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "trainerTasks"));
      const tasks = snapshot.docs
        .map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }))
        .sort((a, b) => {
          const aCompleted = getTrainerTaskStatus(a).id === "completed" ? 1 : 0;
          const bCompleted = getTrainerTaskStatus(b).id === "completed" ? 1 : 0;
          return aCompleted - bCompleted ||
            String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
        });
      setClientTrainerTasks(tasks);
    } catch (error) {
      console.warn("Client trainer tasks load failed:", error);
      setClientTrainerTasks([]);
    }
  }

  async function updateClientTrainerTask(task, completed) {
    const uid = auth.currentUser?.uid;
    if (!uid || !task?.id) return;

    const nextTask = {
      ...task,
      status: completed ? "completed" : "progress",
      completedAt: completed ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString()
    };

    setClientTrainerTasks((current) => current.map((item) => item.id === task.id ? nextTask : item));
    try {
      await setDoc(doc(db, "users", uid, "trainerTasks", task.id), {
        status: nextTask.status,
        completedAt: nextTask.completedAt,
        updatedAt: nextTask.updatedAt
      }, { merge: true });
    } catch (error) {
      console.warn("Client trainer task update failed:", error);
      setClientTrainerTasks((current) => current.map((item) => item.id === task.id ? task : item));
      showAppError("load", "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443.");
    }
  }

  function openClientTrainerTask(task) {
    const destination = getClientTrainerTaskDestination(task);
    if (!destination) return;

    setProfileTrainerNotificationsOpen(false);

    if (destination === "progressPhotos") {
      setProfileProgressPhotoStatus("");
      setProfileProgressPhotosModalOpen(true);
      return;
    }

    if (destination === "measurements") {
      setProfileMeasurementsModalOpen(true);
      return;
    }

    if (destination === "nutrition") {
      setPage(APP_PAGES.NUTRITION);
      return;
    }

    if (destination === "workouts") {
      openTrainingEntry();
      return;
    }

    if (destination === "profile") {
      setProfileBodyMetricsOpen(true);
      setProfileSettingsModalSection("profile");
      setProfileSettingsModalOpen(true);
      return;
    }

    if (destination === "progress") {
      setProfileProgressModalOpen(true);
    }
  }

  async function createAdminClientTask() {
    const clientId = adminSelectedClient?.id;
    const title = adminNewTaskTitle.trim();
    if (!clientId || !title) {
      setAdminClientStatus("\u041d\u0430\u043f\u0438\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0434\u043b\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430.");
      return;
    }

    const taskId = createClientResourceId("task");
    const task = {
      title,
      dueDate: adminNewTaskDueDate || "",
      status: "progress",
      completedAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByUid: auth.currentUser?.uid || ""
    };

    try {
      await setDoc(doc(db, "users", clientId, "trainerTasks", taskId), task);
      setAdminClientTasks((current) => [{ id: taskId, ...task }, ...current]);
      setAdminNewTaskTitle("");
      setAdminNewTaskDueDate("");
      await recordTrainerEvent(clientId, "task", "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0430 \u0437\u0430\u0434\u0430\u0447\u0430", title);
      setAdminClientStatus("\u0417\u0430\u0434\u0430\u0447\u0430 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0430.");
    } catch (error) {
      console.error("Trainer task create failed:", error);
      setAdminClientStatus("\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443.");
    }
  }

  async function updateAdminClientTask(task, status) {
    const clientId = adminSelectedClient?.id;
    if (!clientId || !task?.id) return;

    const patch = {
      status,
      completedAt: status === "completed" ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "users", clientId, "trainerTasks", task.id), patch, { merge: true });
      setAdminClientTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...patch } : item));
      await recordTrainerEvent(
        clientId,
        "task",
        status === "completed" ? "\u0417\u0430\u0434\u0430\u0447\u0430 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0430" : "\u0417\u0430\u0434\u0430\u0447\u0430 \u0432\u0435\u0440\u043d\u0443\u0442\u0430 \u0432 \u0440\u0430\u0431\u043e\u0442\u0443",
        task.title
      );
    } catch (error) {
      console.error("Trainer task update failed:", error);
      setAdminClientStatus("\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443.");
    }
  }

  async function deleteAdminClientTask(task) {
    const clientId = adminSelectedClient?.id;
    if (!clientId || !task?.id) return;

    try {
      await deleteDoc(doc(db, "users", clientId, "trainerTasks", task.id));
      setAdminClientTasks((current) => current.filter((item) => item.id !== task.id));
      await recordTrainerEvent(clientId, "task", "\u0417\u0430\u0434\u0430\u0447\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430", task.title);
    } catch (error) {
      console.error("Trainer task delete failed:", error);
      setAdminClientStatus("\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443.");
    }
  }

  return {
    loadClientTrainerTasks,
    updateClientTrainerTask,
    openClientTrainerTask,
    createAdminClientTask,
    updateAdminClientTask,
    deleteAdminClientTask
  };
}
