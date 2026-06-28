import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch
} from "firebase/firestore";

import {
  buildClientWorkoutsFromTemplate,
  makeThreeSets,
  sortWorkoutDays
} from "../../utils/workoutPlanNormalization";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety";

const STATUS_TEMPLATE_CREATED = "\u0428\u0430\u0431\u043b\u043e\u043d \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u0441\u043e\u0437\u0434\u0430\u043d.";
const STATUS_TEMPLATE_CREATE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0448\u0430\u0431\u043b\u043e\u043d.";
const STATUS_SELECT_CLIENT_TEMPLATE = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u0448\u0430\u0431\u043b\u043e\u043d.";
const STATUS_SELECT_CLIENT = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_SELECT_CLIENT_PROGRAM = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0443\u044e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443.";
const STATUS_OWN_PROGRAMS_ONLY = "\u041c\u043e\u0436\u043d\u043e \u043d\u0430\u0437\u043d\u0430\u0447\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0441\u0432\u043e\u0438 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u0441\u0432\u043e\u0438\u043c \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u043c.";
const STATUS_ASSIGN_TEMPLATE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0448\u0430\u0431\u043b\u043e\u043d.";
const STATUS_PROGRAM_RESET = "\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0441\u0431\u0440\u043e\u0448\u0435\u043d\u0430.";
const STATUS_PROGRAM_RESET_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_SAVED_PROGRAM_NOT_FOUND = "\u0421\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.";
const STATUS_ASSIGN_SAVED_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0443\u044e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443.";
const STATUS_SELECT_COPY_CLIENT = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0434\u043b\u044f \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f.";
const STATUS_PROGRAM_COPIED = "\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430 \u0434\u0440\u0443\u0433\u043e\u043c\u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0443.";
const STATUS_PROGRAM_COPY_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443.";
const STATUS_EVENT_PROGRAM_ASSIGNED = "\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0430 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430";

function makeResetWorkoutCalendar(template = {}, assignedProgramUpdatedAt = "") {
  return {
    scheduledDates: [],
    monthlyTrainingDates: [],
    plannedWorkouts: [],
    assignedProgramId: template.id || "",
    assignedProgramName: template.name || "",
    assignedProgramUpdatedAt,
    updatedAt: assignedProgramUpdatedAt
  };
}

function buildAssignedClientPatch(template, nextWorkouts, assignedProgramUpdatedAt) {
  return {
    assignedProgramId: template.id,
    assignedProgramName: template.name,
    assignedProgramAt: assignedProgramUpdatedAt,
    assignedProgramUpdatedAt,
    assignedWorkoutCount: nextWorkouts.length,
    workoutCalendar: makeResetWorkoutCalendar(template, assignedProgramUpdatedAt)
  };
}

function attachAssignedProgramToWorkouts(template, workouts = [], assignedProgramUpdatedAt = "", assignedBy = "") {
  return (Array.isArray(workouts) ? workouts : []).map((workout) => ({
    ...workout,
    assignedProgramId: template.id || "",
    assignedProgramName: template.name || "",
    assignedAt: assignedProgramUpdatedAt,
    assignedProgramUpdatedAt,
    assignedBy
  }));
}

function getBatchLimitError(operationCount) {
  const error = new Error(
    `\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u0430\u044f \u0434\u043b\u044f \u0430\u0442\u043e\u043c\u0430\u0440\u043d\u043e\u0433\u043e \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f: ${operationCount} \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0439 \u0438\u0437 500.`
  );
  error.code = "workout-assignment-batch-limit";
  return error;
}

export function createTrainerProgramTemplateHandlers({
  db,
  auth,
  user,
  ADMIN_EMAIL,
  plan,
  selectedUserId,
  adminSelectedClient,
  usersList,
  adminTrainingTemplates,
  adminSelectedTemplateId,
  adminTemplateName,
  adminCopyTargetUserId,
  getCurrentProgramOwner,
  canUseAdminFeatures,
  canManageTrainingTemplate,
  canManageClientProgram,
  setAdminTrainingTemplates,
  setAdminSelectedTemplateId,
  setAdminTemplateName,
  setAdminClientStatus,
  setAdminSelectedClient,
  setUsersList,
  setPlan,
  showAppConfirm,
  recordTrainerEvent
}) {
  async function loadAdminTrainingTemplates() {
    try {
      const templatesRef = collection(db, "trainingTemplates");
      const currentUid = auth.currentUser?.uid || user?.uid || "";
      const templatesQuery = canUseAdminFeatures()
        ? templatesRef
        : query(templatesRef, where("ownerUid", "==", currentUid));
      const snapshot = await getDocs(templatesQuery);
      const templates = [];
      snapshot.forEach((templateDoc) => {
        templates.push({ id: templateDoc.id, ...templateDoc.data() });
      });
      templates.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));
      setAdminTrainingTemplates(templates);
      setAdminSelectedTemplateId((current) =>
        current && !templates.some((template) => template.id === current) ? "" : current
      );
    } catch (error) {
      console.error("Template load failed:", error);
      setAdminTrainingTemplates([]);
    }
  }

  async function createAdminTemplateFromCurrentPlan() {
    const name = adminTemplateName.trim() || `\u0428\u0430\u0431\u043b\u043e\u043d ${new Date().toLocaleDateString("ru-RU")}`;
    const id = `template_${Date.now()}`;
    const owner = getCurrentProgramOwner();
    const now = new Date().toISOString();

    try {
      await setDoc(doc(db, "trainingTemplates", id), {
        name,
        ownerUid: owner.uid,
        ownerRole: owner.role,
        createdByUid: owner.uid,
        updatedByUid: owner.uid,
        createdAt: now,
        updatedAt: now,
        createdBy: user?.email || ADMIN_EMAIL,
        workouts: plan.workouts || []
      });

      setAdminTemplateName("");
      setAdminSelectedTemplateId(id);
      await loadAdminTrainingTemplates();
      setAdminClientStatus(STATUS_TEMPLATE_CREATED);
    } catch (error) {
      console.error("Template create failed:", error);
      setAdminClientStatus(STATUS_TEMPLATE_CREATE_FAILED);
    }
  }

  async function clearClientAssignedWorkouts(clientId) {
    if (!clientId) return 0;

    let deletedCount = 0;

    for (let pass = 0; pass < 2; pass += 1) {
      const currentWorkoutsSnapshot = await getDocs(collection(db, "users", clientId, "workouts"));

      if (currentWorkoutsSnapshot.empty) break;

      for (const workoutDoc of currentWorkoutsSnapshot.docs) {
        await deleteDoc(doc(db, "users", clientId, "workouts", workoutDoc.id));
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  async function replaceClientAssignedWorkouts(
    clientId,
    nextWorkouts,
    template,
    assignedProgramUpdatedAt
  ) {
    const currentWorkoutsSnapshot = await getDocs(collection(db, "users", clientId, "workouts"));
    const nextWorkoutIds = new Set(nextWorkouts.map((workoutItem) => workoutItem.id));
    const staleWorkoutDocs = currentWorkoutsSnapshot.docs.filter(
      (workoutDoc) => !nextWorkoutIds.has(workoutDoc.id)
    );
    const operationCount = staleWorkoutDocs.length + nextWorkouts.length + 1;

    if (operationCount > 500) {
      throw getBatchLimitError(operationCount);
    }

    const batch = writeBatch(db);

    staleWorkoutDocs.forEach((workoutDoc) => {
      batch.delete(workoutDoc.ref);
    });

    nextWorkouts.forEach((workoutItem) => {
      batch.set(doc(db, "users", clientId, "workouts", workoutItem.id), {
        ...workoutItem,
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt,
        assignedBy: auth.currentUser?.uid || ""
      });
    });

    batch.set(doc(db, "users", clientId), buildAssignedClientPatch(template, nextWorkouts, assignedProgramUpdatedAt), { merge: true });

    await batch.commit();
    return currentWorkoutsSnapshot.size;
  }

  async function assignAdminTemplateToClient(clientId = selectedUserId, templateId = adminSelectedTemplateId) {
    const template = adminTrainingTemplates.find((item) => item.id === templateId);
    const client = adminSelectedClient?.id === clientId
      ? adminSelectedClient
      : usersList.find((item) => item.id === clientId);

    if (!clientId || !template) {
      setAdminClientStatus(STATUS_SELECT_CLIENT_TEMPLATE);
      return;
    }
    if (!canManageTrainingTemplate(template) || !canManageClientProgram(client)) {
      setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
      return;
    }

    try {
      const assignedProgramUpdatedAt = new Date().toISOString();
      const nextWorkouts = attachAssignedProgramToWorkouts(
        template,
        buildClientWorkoutsFromTemplate(template),
        assignedProgramUpdatedAt,
        auth.currentUser?.uid || ""
      );
      const deletedCount = await replaceClientAssignedWorkouts(
        clientId,
        nextWorkouts,
        template,
        assignedProgramUpdatedAt
      );

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }

      const clientPatch = buildAssignedClientPatch(template, nextWorkouts, assignedProgramUpdatedAt);
      setAdminSelectedClient((prev) => prev?.id === clientId ? { ...prev, ...clientPatch } : prev);
      setUsersList((prev) => prev.map((item) => item.id === clientId ? { ...item, ...clientPatch } : item));

      setAdminClientStatus(`\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043e ${nextWorkouts.length} \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a. \u0421\u0442\u0430\u0440\u044b\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u044b: ${deletedCount}.`);
    } catch (error) {
      console.error("Template assign failed:", error);
      setAdminClientStatus(error?.code === "workout-assignment-batch-limit" ? error.message : STATUS_ASSIGN_TEMPLATE_FAILED);
    }
  }

  async function clearClientProgram(clientId = selectedUserId) {
    if (!clientId) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return;
    }

    const confirmed = await showAppConfirm("\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0432\u0441\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430? \u0423 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0431\u0443\u0434\u0435\u0442 \u043f\u0443\u0441\u0442\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430.");
    if (!confirmed) return;

    try {
      const assignedProgramUpdatedAt = new Date().toISOString();
      await clearClientAssignedWorkouts(clientId);
      await setDoc(doc(db, "users", clientId), {
        assignedProgramId: "",
        assignedProgramName: "",
        assignedProgramAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt,
        assignedWorkoutCount: 0,
        workoutCalendar: makeResetWorkoutCalendar({}, assignedProgramUpdatedAt)
      }, { merge: true });

      setPlan({ workouts: [] });
      setAdminClientStatus(STATUS_PROGRAM_RESET);
    } catch (error) {
      console.error("Client program clear failed:", error);
      setAdminClientStatus(STATUS_PROGRAM_RESET_FAILED);
    }
  }

  async function assignSavedProgramToClient(clientId = selectedUserId, templateId = adminSelectedTemplateId) {
    const selectedTemplate = adminTrainingTemplates.find((item) => item.id === templateId);
    const client = adminSelectedClient?.id === clientId
      ? adminSelectedClient
      : usersList.find((item) => item.id === clientId);

    if (!clientId || !selectedTemplate) {
      setAdminClientStatus(STATUS_SELECT_CLIENT_PROGRAM);
      return;
    }
    if (!canManageTrainingTemplate(selectedTemplate) || !canManageClientProgram(client)) {
      setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
      return;
    }

    try {
      const templateSnapshot = await getDoc(doc(db, "trainingTemplates", templateId));
      if (!templateSnapshot.exists()) {
        setAdminClientStatus(STATUS_SAVED_PROGRAM_NOT_FOUND);
        return;
      }

      const template = { id: templateSnapshot.id, ...templateSnapshot.data() };
      if (!canManageTrainingTemplate(template)) {
        setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
        return;
      }

      const templateWorkouts = buildClientWorkoutsFromTemplate(template);
      const confirmed = await showAppConfirm(
        `\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443 \u201c${template.name}\u201d? \u0421\u0442\u0430\u0440\u044b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438 \u0431\u0443\u0434\u0443\u0442 \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e \u0443\u0434\u0430\u043b\u0435\u043d\u044b, \u0431\u0443\u0434\u0435\u0442 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043e ${templateWorkouts.length} \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a.`
      );
      if (!confirmed) return;

      const assignedProgramUpdatedAt = new Date().toISOString();
      const nextWorkouts = attachAssignedProgramToWorkouts(
        template,
        templateWorkouts,
        assignedProgramUpdatedAt,
        auth.currentUser?.uid || ""
      );
      const deletedCount = await replaceClientAssignedWorkouts(
        clientId,
        nextWorkouts,
        template,
        assignedProgramUpdatedAt
      );

      const clientPatch = buildAssignedClientPatch(template, nextWorkouts, assignedProgramUpdatedAt);
      setAdminClientStatus(`\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u201c${template.name}\u201d \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0430: ${nextWorkouts.length} \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a. \u0421\u0442\u0430\u0440\u044b\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u044b: ${deletedCount}.`);

      setAdminSelectedClient((prev) => prev?.id === clientId ? { ...prev, ...clientPatch } : prev);
      setUsersList((prev) => prev.map((clientItem) => (
        clientItem.id === clientId ? { ...clientItem, ...clientPatch } : clientItem
      )));

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }
      await recordTrainerEvent(clientId, "program", STATUS_EVENT_PROGRAM_ASSIGNED, template.name);
    } catch (error) {
      console.error("Saved program assign failed:", error);
      setAdminClientStatus(error?.code === "workout-assignment-batch-limit" ? error.message : STATUS_ASSIGN_SAVED_FAILED);
    }
  }

  async function copyCurrentProgramToClient() {
    if (!adminCopyTargetUserId) {
      setAdminClientStatus(STATUS_SELECT_COPY_CLIENT);
      return;
    }

    try {
      for (const workoutItem of plan.workouts || []) {
        await setDoc(doc(db, "users", adminCopyTargetUserId, "workouts", workoutItem.id), {
          name: workoutItem.name,
          exercises: (workoutItem.exercises || []).map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            video: exercise.video || "",
            requiresWeight: exerciseUsesExternalWeight(exercise),
            sets: makeThreeSets(exercise.sets, exercise.name?.includes("\u041f\u0440\u0435\u0441\u0441") ? 15 : 8)
          }))
        }, { merge: true });
      }

      setAdminClientStatus(STATUS_PROGRAM_COPIED);
    } catch (error) {
      console.error("Program copy failed:", error);
      setAdminClientStatus(STATUS_PROGRAM_COPY_FAILED);
    }
  }

  return {
    loadAdminTrainingTemplates,
    createAdminTemplateFromCurrentPlan,
    assignAdminTemplateToClient,
    clearClientProgram,
    assignSavedProgramToClient,
    copyCurrentProgramToClient
  };
}
