import {
  collection,
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
import {
  buildAppendedAssignmentWorkoutDocumentPlan
} from "../../utils/trainerProgramAssignment.js";
import {
  buildTrainerClientProgramTimeline,
  getNextTrainerClientActiveProgramAssignment,
  isTrainerClientBasicWorkout,
  isTrainerClientProgramAssignmentMatch
} from "../../utils/trainerClientProgramAssignments.js";
import {
  buildClientProgramLifecycleMetadata,
  buildDraftProgramMetadata,
  buildProgramAssignmentMetadata,
  getTrainerProgramStatusMeta,
  TRAINER_PROGRAM_STATUSES,
  isTrainerProgramArchived
} from "../../utils/trainerProgramLifecycle.js";
import { getTrainerActionErrorStatus } from "../../utils/trainerActionStatus.js";
import { validateTrainerWorkoutsForAssignment } from "../../utils/trainerProgramValidation.js";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety";
import { applyTrainerProgramAssignmentLoadAdjustments } from "../../utils/trainerProgramAssignmentAdjustment.js";

const STATUS_TEMPLATE_CREATED = "\u0428\u0430\u0431\u043b\u043e\u043d \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u0441\u043e\u0437\u0434\u0430\u043d.";
const STATUS_TEMPLATE_CREATE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0448\u0430\u0431\u043b\u043e\u043d.";
const STATUS_SELECT_CLIENT_TEMPLATE = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u0448\u0430\u0431\u043b\u043e\u043d.";
const STATUS_SELECT_CLIENT = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_SELECT_CLIENT_PROGRAM = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0443\u044e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443.";
const STATUS_OWN_PROGRAMS_ONLY = "\u041c\u043e\u0436\u043d\u043e \u043d\u0430\u0437\u043d\u0430\u0447\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0441\u0432\u043e\u0438 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u0441\u0432\u043e\u0438\u043c \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u043c.";
const STATUS_ASSIGN_TEMPLATE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0448\u0430\u0431\u043b\u043e\u043d.";
const STATUS_PROGRAM_ARCHIVED = "\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u0432 \u0430\u0440\u0445\u0438\u0432\u0435. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0437\u0434\u0430\u0439 \u043d\u043e\u0432\u0443\u044e \u0432\u0435\u0440\u0441\u0438\u044e.";
const STATUS_PROGRAM_RESET = "\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0441\u0431\u0440\u043e\u0448\u0435\u043d\u0430.";
const STATUS_PROGRAM_RESET_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_SAVED_PROGRAM_NOT_FOUND = "\u0421\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.";
const STATUS_ASSIGN_SAVED_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0443\u044e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443.";
const STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND = "\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.";
const STATUS_PROGRAM_ASSIGNMENT_FUTURE_ONLY = "\u0422\u0440\u0435\u043d\u0435\u0440 \u043c\u043e\u0436\u0435\u0442 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443, \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u043a\u043b\u0438\u0435\u043d\u0442 \u0435\u0449\u0451 \u043d\u0435 \u043d\u0430\u0447\u0430\u043b.";
const STATUS_PROGRAM_ASSIGNMENT_ARCHIVED = "\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u0430\u0440\u0445\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u043d\u0430.";
const STATUS_PROGRAM_ASSIGNMENT_RESTORED = "\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d\u0430 \u0438\u0437 \u0430\u0440\u0445\u0438\u0432\u0430.";
const STATUS_PROGRAM_ASSIGNMENT_DELETED = "\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430.";
const STATUS_PROGRAM_ASSIGNMENT_ACTION_FAILED = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b.";
const STATUS_SELECT_COPY_CLIENT = "\u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0434\u043b\u044f \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f.";
const STATUS_PROGRAM_COPIED = "\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430 \u0434\u0440\u0443\u0433\u043e\u043c\u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0443.";
const STATUS_PROGRAM_COPY_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443.";
const STATUS_EVENT_PROGRAM_ASSIGNED = "\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0430 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430";

function buildProgramAssignmentConfirmText(templateName = "", workoutCount = 0) {
  const safeName = String(templateName || "программу").trim();
  const safeCount = Number(workoutCount) || 0;
  return `Добавить программу "${safeName}" к текущему плану? В очередь добавится ${safeCount} тренировок. Предыдущие тренировки и расписание сохранятся.`;
}

function buildProgramAssignmentStatus(templateName, workoutCount, assignmentResult) {
  const prefix = templateName
    ? `Программа "${templateName}" назначена`
    : "Назначено";
  return `${prefix}: добавлено ${workoutCount} тренировок. Сохранено предыдущих: ${assignmentResult.previousCount}. Всего в списке: ${assignmentResult.nextWorkouts.length}.`;
}

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

function buildAssignedClientPatch(
  template,
  nextWorkouts,
  assignedProgramUpdatedAt,
  assignedByUid = "",
  currentClientData = {}
) {
  // Every assignment is a separate client copy. Reusing the previous
  // assignment version made a newly assigned program inherit its calendar
  // status and completion state from the older plan.
  const queueVersion = String(assignedProgramUpdatedAt || "").trim();

  return {
    assignedProgramId: template.id,
    assignedProgramName: template.name,
    assignedProgramAt: assignedProgramUpdatedAt,
    assignedProgramAddedAt: assignedProgramUpdatedAt,
    assignedProgramUpdatedAt: queueVersion,
    assignedWorkoutCount: nextWorkouts.length,
    ...buildClientProgramLifecycleMetadata({
      assignedAt: assignedProgramUpdatedAt,
      assignedByUid
    }),
    workoutCalendar: currentClientData?.workoutCalendar || makeResetWorkoutCalendar(template, queueVersion)
  };
}

function attachAssignedProgramToWorkouts(template, workouts = [], assignedProgramUpdatedAt = "", assignedBy = "") {
  return (Array.isArray(workouts) ? workouts : []).map((workout) => ({
    ...workout,
    assignedProgramId: template.id || "",
    assignedProgramName: template.name || "",
    assignedAt: assignedProgramUpdatedAt,
    assignedProgramAddedAt: assignedProgramUpdatedAt,
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

function getAssignmentTimestamp(item = {}) {
  return String(
    item?.assignedProgramAddedAt || item?.programAssignmentId || item?.assignedAt || ""
  ).trim();
}

function isArchivedClientProgramWorkout(workout = {}) {
  return String(workout?.assignedProgramLifecycleStatus || "").trim().toLowerCase() === "archived" ||
    String(workout?.assignedProgramVisibility || "").trim().toLowerCase() === "trainer_archived";
}

function isClientProgramAssignmentFallbackMatch(workout = {}, assignment = {}) {
  const expectedProgramId = String(assignment?.programId || "").trim();
  const expectedAssignedAt = String(assignment?.assignedAt || "").trim();
  const expectedName = String(assignment?.name || "").trim();
  const workoutProgramId = String(workout?.assignedProgramId || "").trim();
  const workoutAssignedAt = getAssignmentTimestamp(workout);
  const workoutName = String(workout?.assignedProgramName || "").trim();

  if (expectedAssignedAt && workoutAssignedAt === expectedAssignedAt) {
    return !expectedProgramId || !workoutProgramId || workoutProgramId === expectedProgramId;
  }

  // Very old assignments can lack their durable timestamp. In that case the
  // program ID is the most reliable remaining identity; restrict this fallback
  // to archived rows so we never take over a newer active copy of the template.
  if (expectedProgramId && workoutProgramId === expectedProgramId && isArchivedClientProgramWorkout(workout)) {
    return !expectedName || !workoutName || workoutName === expectedName;
  }

  return Boolean(expectedName && !expectedProgramId && !expectedAssignedAt &&
    workoutName === expectedName && isArchivedClientProgramWorkout(workout));
}

function getClientProgramAssignmentSnapshot(workoutDocs = [], assignmentKey = "", assignment = {}) {
  const entries = (Array.isArray(workoutDocs) ? workoutDocs : [])
    .map((workoutDoc) => ({
      id: workoutDoc.id,
      data: typeof workoutDoc.data === "function" ? workoutDoc.data() : (workoutDoc.data || workoutDoc)
    }));
  const keyMatches = entries.filter((workout) => (
    isTrainerClientProgramAssignmentMatch(workout.data, assignmentKey)
  ));

  return keyMatches.length
    ? keyMatches
    : entries.filter((workout) => isClientProgramAssignmentFallbackMatch(workout.data, assignment));
}

function getClientProfileProgramAssignment(client = {}) {
  const assignedAt = String(
    client?.assignedProgramAddedAt || client?.assignedProgramAt || client?.assignedAt || ""
  ).trim();
  if (!assignedAt) return null;

  return {
    key: `time:${assignedAt}`,
    programId: String(client?.assignedProgramId || "").trim(),
    name: String(client?.assignedProgramName || "").trim(),
    assignedAt
  };
}

function getSnapshotEntries(snapshot = null) {
  return (snapshot?.docs || []).map((item) => ({
    id: item.id,
    ...(typeof item.data === "function" ? item.data() : (item.data || {}))
  }));
}

export function getNextActiveClientProgramPatch(
  workoutDocs = [],
  now = "",
  history = [],
  fallbackAssignedByUid = "",
  clientProfile = {}
) {
  const remainingWorkouts = (Array.isArray(workoutDocs) ? workoutDocs : [])
    .map((workoutDoc) => ({
      id: workoutDoc.id,
      ...(typeof workoutDoc.data === "function" ? workoutDoc.data() : (workoutDoc.data || workoutDoc))
    }))
    .filter((workout) => !isTrainerClientBasicWorkout(workout));

  const nextAssignment = getNextTrainerClientActiveProgramAssignment(
    remainingWorkouts,
    history,
    clientProfile
  );

  if (!nextAssignment) {
    return {
      assignedProgramId: "",
      assignedProgramName: "",
      assignedProgramAt: now,
      assignedProgramAddedAt: "",
      assignedProgramUpdatedAt: now,
      assignedWorkoutCount: 0,
      assignedProgramLifecycleStatus: "archived",
      assignedProgramVisibility: "client_archived",
      workoutCalendar: makeResetWorkoutCalendar({}, now)
    };
  }

  const firstWorkout = nextAssignment.workouts[0] || {};
  const assignmentVersion = String(
    firstWorkout.assignedProgramUpdatedAt || firstWorkout.assignedAt || nextAssignment.assignedAt || now
  ).trim();
  const assignedAt = firstWorkout.assignedProgramAddedAt || firstWorkout.assignedAt || nextAssignment.assignedAt || assignmentVersion;

  return {
    assignedProgramId: firstWorkout.assignedProgramId || "",
    assignedProgramName: firstWorkout.assignedProgramName || "",
    assignedProgramAt: assignedAt,
    assignedProgramAddedAt: assignedAt,
    assignedProgramUpdatedAt: assignmentVersion,
    assignedWorkoutCount: nextAssignment.workoutCount,
    ...buildClientProgramLifecycleMetadata({
      assignedAt,
      // Older assignments did not always persist the author on every
      // workout.  A trainer restoring their own archived copy must still be
      // able to return it to the active client plan.
      assignedByUid: firstWorkout.assignedBy || fallbackAssignedByUid
    })
  };
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
        createdAt: now,
        updatedAt: now,
        ...buildDraftProgramMetadata({}, { nowIso: now, ownerUid: owner.uid }),
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

  async function appendClientAssignedWorkouts(
    clientId,
    nextWorkouts,
    template,
    assignedProgramUpdatedAt
  ) {
    if (getTrainerProgramStatusMeta(template).id === TRAINER_PROGRAM_STATUSES.DRAFT) {
      throw Object.assign(new Error("Сначала подготовьте программу к назначению."), {
        code: "workout-assignment-draft"
      });
    }
    if (isTrainerProgramArchived(template)) {
      throw Object.assign(new Error(STATUS_PROGRAM_ARCHIVED), { code: "workout-assignment-archived" });
    }

    const [currentWorkoutsSnapshot, clientSnapshot] = await Promise.all([
      getDocs(collection(db, "users", clientId, "workouts")),
      getDoc(doc(db, "users", clientId))
    ]);
    const currentClientData = clientSnapshot.exists() ? clientSnapshot.data() : {};
    const assignedByUid = auth.currentUser?.uid || "";
    const assignmentMetadata = buildProgramAssignmentMetadata(template, {
      clientId,
      assignedAt: assignedProgramUpdatedAt,
      assignedByUid
    });
    const appendedPlan = buildAppendedAssignmentWorkoutDocumentPlan(
      currentWorkoutsSnapshot.docs,
      nextWorkouts,
      assignedProgramUpdatedAt
    );
    const operationCount = appendedPlan.assignedWorkouts.length + 2;

    if (operationCount > 500) {
      throw getBatchLimitError(operationCount);
    }

    const batch = writeBatch(db);

    const queueVersion = String(assignedProgramUpdatedAt || "").trim();
    const clientPatch = buildAssignedClientPatch(
      template,
      appendedPlan.assignedWorkouts,
      assignedProgramUpdatedAt,
      assignedByUid,
      currentClientData
    );

    appendedPlan.assignedWorkouts.forEach((workoutItem) => {
      batch.set(doc(db, "users", clientId, "workouts", workoutItem.id), {
        ...workoutItem,
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt: queueVersion,
        assignedProgramAddedAt: assignedProgramUpdatedAt,
        assignedBy: assignedByUid,
        ...buildClientProgramLifecycleMetadata({
          assignedAt: assignedProgramUpdatedAt,
          assignedByUid
        })
      });
    });

    batch.set(
      doc(db, "users", clientId),
      clientPatch,
      { merge: true }
    );
    batch.set(doc(db, "trainingTemplates", template.id), assignmentMetadata, { merge: true });

    await batch.commit();
    return {
      protectedCount: appendedPlan.protectedCount,
      previousCount: appendedPlan.previousCount,
      nextWorkouts: appendedPlan.allWorkouts,
      clientPatch
    };
  }

  function getProgramClient(clientId = "") {
    return adminSelectedClient?.id === clientId
      ? adminSelectedClient
      : usersList.find((item) => item.id === clientId);
  }

  function canChangeProgramAssignment(clientId = "") {
    const client = getProgramClient(clientId);
    return Boolean(client && canManageClientProgram(client));
  }

  function updateProgramAssignmentLocally(
    clientId,
    assignmentKey,
    action,
    clientPatch,
    archivedAt = "",
    restoreMetadata = {}
  ) {
    // Restoring an archived assignment is allowed while another client plan is
    // already active. In that case only the workouts move back to the queue;
    // the active profile assignment must remain untouched.
    const safeClientPatch = clientPatch && typeof clientPatch === "object" ? clientPatch : {};
    const matches = (workout = {}) => (
      isTrainerClientProgramAssignmentMatch(workout, assignmentKey) ||
      isClientProgramAssignmentFallbackMatch(workout, restoreMetadata.assignment)
    );

    setAdminSelectedClient((current) => current?.id === clientId
      ? { ...current, ...safeClientPatch }
      : current);
    setUsersList((current) => current.map((item) => item.id === clientId
      ? { ...item, ...safeClientPatch }
      : item));
    setPlan((current) => {
      const visibleWorkouts = Array.isArray(current?.workouts) ? current.workouts : [];
      const archivedWorkouts = Array.isArray(current?.archivedWorkouts) ? current.archivedWorkouts : [];
      const matchedWorkouts = visibleWorkouts.filter(matches);

      if (action === "archive") {
        const movedToArchive = matchedWorkouts.map((workout) => ({
          ...workout,
          assignedProgramLifecycleStatus: "archived",
          assignedProgramVisibility: "trainer_archived",
          assignedProgramArchivedAt: archivedAt
        }));
        return {
          ...current,
          ...safeClientPatch,
          workouts: sortWorkoutDays(visibleWorkouts.filter((workout) => !matches(workout))),
          archivedWorkouts: sortWorkoutDays([
            ...archivedWorkouts.filter((workout) => !matches(workout)),
            ...movedToArchive
          ])
        };
      }

      if (action === "restore") {
        const restoredWorkouts = archivedWorkouts
          .filter(matches)
          .map((workout) => ({
            ...workout,
            assignedProgramId:
              restoreMetadata.assignedProgramId || workout.assignedProgramId || "",
            assignedBy: restoreMetadata.assignedBy || workout.assignedBy || "",
            assignedProgramName:
              restoreMetadata.assignedProgramName || workout.assignedProgramName || "",
            ...buildClientProgramLifecycleMetadata({
              assignedAt: workout.assignedProgramAddedAt || workout.assignedAt || "",
              assignedByUid: restoreMetadata.assignedBy || workout.assignedBy || ""
            }),
            assignedProgramArchivedAt: ""
          }));
        return {
          ...current,
          ...safeClientPatch,
          workouts: sortWorkoutDays([
            ...visibleWorkouts.filter((workout) => !matches(workout)),
            ...restoredWorkouts
          ]),
          archivedWorkouts: sortWorkoutDays(archivedWorkouts.filter((workout) => !matches(workout)))
        };
      }

      return {
        ...current,
        ...safeClientPatch,
        workouts: sortWorkoutDays(visibleWorkouts.filter((workout) => !matches(workout))),
        archivedWorkouts: sortWorkoutDays(archivedWorkouts.filter((workout) => !matches(workout)))
      };
    });
  }

  async function archiveClientProgramAssignment(clientId = selectedUserId, assignment = {}) {
    const assignmentKey = String(assignment?.key || "").trim();
    if (!clientId || !assignmentKey) {
      setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
      return false;
    }
    if (!canChangeProgramAssignment(clientId)) {
      setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
      return false;
    }

    try {
      const [workoutsSnapshot, historySnapshot] = await Promise.all([
        getDocs(collection(db, "users", clientId, "workouts")),
        getDocs(collection(db, "users", clientId, "history"))
      ]);
      const matchedWorkouts = getClientProgramAssignmentSnapshot(workoutsSnapshot.docs, assignmentKey, assignment);
      if (!matchedWorkouts.length) {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
        return false;
      }
      if (matchedWorkouts.length + 1 > 500) throw getBatchLimitError(matchedWorkouts.length + 1);

      const now = new Date().toISOString();
      const matchingIds = new Set(matchedWorkouts.map((workout) => workout.id));
      const remainingWorkouts = workoutsSnapshot.docs.filter((workoutDoc) => !matchingIds.has(workoutDoc.id));
      const clientPatch = getNextActiveClientProgramPatch(
        remainingWorkouts,
        now,
        getSnapshotEntries(historySnapshot)
      );
      const batch = writeBatch(db);

      matchedWorkouts.forEach((workout) => {
        batch.set(doc(db, "users", clientId, "workouts", workout.id), {
          assignedProgramLifecycleStatus: "archived",
          assignedProgramVisibility: "trainer_archived",
          assignedProgramArchivedAt: now
        }, { merge: true });
      });
      batch.set(doc(db, "users", clientId), clientPatch, { merge: true });
      await batch.commit();

      updateProgramAssignmentLocally(clientId, assignmentKey, "archive", clientPatch, now, {
        assignment
      });
      setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_ARCHIVED);
      await recordTrainerEvent(clientId, "program", STATUS_PROGRAM_ASSIGNMENT_ARCHIVED, assignment?.name || "");
      return true;
    } catch (error) {
      console.error("Client program archive failed:", error);
      setAdminClientStatus(error?.code === "workout-assignment-batch-limit"
        ? error.message
        : getTrainerActionErrorStatus(error, STATUS_PROGRAM_ASSIGNMENT_ACTION_FAILED));
      return false;
    }
  }

  async function restoreClientProgramAssignment(clientId = selectedUserId, assignment = {}) {
    const assignmentKey = String(assignment?.key || "").trim();
    if (!clientId || !assignmentKey) {
      setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
      return false;
    }
    if (!canChangeProgramAssignment(clientId)) {
      setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
      return false;
    }

    try {
      const [workoutsSnapshot, historySnapshot, clientSnapshot] = await Promise.all([
        getDocs(collection(db, "users", clientId, "workouts")),
        getDocs(collection(db, "users", clientId, "history")),
        getDoc(doc(db, "users", clientId))
      ]);
      const matchedWorkouts = getClientProgramAssignmentSnapshot(workoutsSnapshot.docs, assignmentKey, assignment);
      const historyEntries = getSnapshotEntries(historySnapshot);
      const clientProfile = clientSnapshot.exists() ? clientSnapshot.data() : {};
      if (!matchedWorkouts.length) {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
        return false;
      }
      if (matchedWorkouts.length + 1 > 500) throw getBatchLimitError(matchedWorkouts.length + 1);

      const now = new Date().toISOString();
      const currentTrainerUid = auth.currentUser?.uid || "";
      const storedProgramId = String(matchedWorkouts[0]?.data?.assignedProgramId || "").trim();
      const storedProgramName = String(
        matchedWorkouts[0]?.data?.assignedProgramName || assignment?.name || ""
      ).trim();
      if (!currentTrainerUid) {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
        return false;
      }

      // An assignment is an individual copy of a trainer program. Restoring
      // it must not depend on the source template still existing: deleting or
      // renaming that template must never make the client's saved plan or its
      // history impossible to restore.
      if (!storedProgramId || !storedProgramName) {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
        return false;
      }

      const matchingIds = new Set(matchedWorkouts.map((workout) => workout.id));
      const restoredWorkouts = workoutsSnapshot.docs.map((workoutDoc) => {
        const workout = {
          id: workoutDoc.id,
          ...(typeof workoutDoc.data === "function" ? workoutDoc.data() : (workoutDoc.data || {}))
        };
        if (!matchingIds.has(workout.id)) return workout;
        return {
          ...workout,
          ...buildClientProgramLifecycleMetadata({
            assignedAt: workout.assignedProgramAddedAt || workout.assignedAt || "",
            assignedByUid:
              workout.assignedProgramAssignedByUid ||
              workout.assignedBy ||
              currentTrainerUid
          }),
          assignedProgramArchivedAt: ""
        };
      });
      const hasAnotherActiveProgram = (
        String(clientProfile?.assignedProgramLifecycleStatus || "").trim().toLowerCase() === "active" &&
        String(clientProfile?.assignedProgramVisibility || "").trim().toLowerCase() === "client_active" &&
        Boolean(String(clientProfile?.assignedProgramId || "").trim())
      );
      const clientPatch = hasAnotherActiveProgram
        ? null
        : getNextActiveClientProgramPatch(
          restoredWorkouts,
          now,
          historyEntries,
          currentTrainerUid,
          clientProfile
        );
      const batch = writeBatch(db);

      matchedWorkouts.forEach((workout) => {
        const restoredAt = workout.data.assignedProgramAddedAt || workout.data.assignedAt || "";
        batch.set(doc(db, "users", clientId, "workouts", workout.id), {
          ...buildClientProgramLifecycleMetadata({
            assignedAt: restoredAt,
            assignedByUid:
              workout.data.assignedProgramAssignedByUid ||
              workout.data.assignedBy ||
              currentTrainerUid
          }),
          assignedProgramArchivedAt: ""
        }, { merge: true });
      });
      if (clientPatch) {
        batch.set(doc(db, "users", clientId), clientPatch, { merge: true });
      }
      await batch.commit();

      updateProgramAssignmentLocally(clientId, assignmentKey, "restore", clientPatch, "", {
        assignment
      });
      setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_RESTORED);
      await recordTrainerEvent(clientId, "program", STATUS_PROGRAM_ASSIGNMENT_RESTORED, assignment?.name || "");
      return true;
    } catch (error) {
      console.error("Client program restore failed:", error);
      setAdminClientStatus(error?.code === "workout-assignment-batch-limit"
        ? error.message
        : getTrainerActionErrorStatus(error, STATUS_PROGRAM_ASSIGNMENT_ACTION_FAILED));
      return false;
    }
  }

  async function deleteClientProgramAssignment(clientId = selectedUserId, assignment = {}) {
    const assignmentKey = String(assignment?.key || "").trim();
    const isAdmin = canUseAdminFeatures();
    if (!clientId || !assignmentKey) {
      setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
      return false;
    }
    if (!canChangeProgramAssignment(clientId)) {
      setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
      return false;
    }

    try {
      const [workoutsSnapshot, historySnapshot] = await Promise.all([
        getDocs(collection(db, "users", clientId, "workouts")),
        getDocs(collection(db, "users", clientId, "history"))
      ]);
      const matchedWorkouts = getClientProgramAssignmentSnapshot(workoutsSnapshot.docs, assignmentKey, assignment);
      if (!matchedWorkouts.length) {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
        return false;
      }
      const assignmentTimeline = buildTrainerClientProgramTimeline({
        workouts: getSnapshotEntries(workoutsSnapshot),
        history: getSnapshotEntries(historySnapshot)
      });
      const matchedAssignment = assignmentTimeline.find((item) => item.key === assignmentKey);
      // A trainer may remove only a program the client has not started. A
      // missed workout is also a started program and therefore stays in the
      // client history just like a completed one.
      if (!isAdmin && matchedAssignment?.status !== "future") {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_FUTURE_ONLY);
        return false;
      }
      if (matchedWorkouts.length + 1 > 500) throw getBatchLimitError(matchedWorkouts.length + 1);

      const now = new Date().toISOString();
      const matchingIds = new Set(matchedWorkouts.map((workout) => workout.id));
      const remainingWorkouts = workoutsSnapshot.docs.filter((workoutDoc) => !matchingIds.has(workoutDoc.id));
      const clientPatch = getNextActiveClientProgramPatch(
        remainingWorkouts,
        now,
        getSnapshotEntries(historySnapshot)
      );
      const batch = writeBatch(db);
      matchedWorkouts.forEach((workout) => batch.delete(doc(db, "users", clientId, "workouts", workout.id)));
      batch.set(doc(db, "users", clientId), clientPatch, { merge: true });
      await batch.commit();

      updateProgramAssignmentLocally(clientId, assignmentKey, "delete", clientPatch, "", {
        assignment
      });
      setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_DELETED);
      await recordTrainerEvent(clientId, "program", STATUS_PROGRAM_ASSIGNMENT_DELETED, assignment?.name || "");
      return true;
    } catch (error) {
      console.error("Client program assignment delete failed:", error);
      setAdminClientStatus(error?.code === "workout-assignment-batch-limit"
        ? error.message
        : getTrainerActionErrorStatus(error, STATUS_PROGRAM_ASSIGNMENT_ACTION_FAILED));
      return false;
    }
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
    if (getTrainerProgramStatusMeta(template).id === TRAINER_PROGRAM_STATUSES.DRAFT) {
      setAdminClientStatus("Сначала подготовьте программу к назначению.");
      return;
    }
    if (isTrainerProgramArchived(template)) {
      setAdminClientStatus(STATUS_PROGRAM_ARCHIVED);
      return;
    }

    try {
      const assignedProgramUpdatedAt = new Date().toISOString();
      const templateWorkouts = buildClientWorkoutsFromTemplate(template);
      const programValidation = validateTrainerWorkoutsForAssignment({
        programName: template.name,
        template,
        workouts: templateWorkouts
      });

      if (!programValidation.ok) {
        setAdminClientStatus(programValidation.message);
        return;
      }

      const confirmed = await showAppConfirm(
        buildProgramAssignmentConfirmText(template.name, templateWorkouts.length)
      );
      if (!confirmed) return;

      const nextWorkoutsDraft = attachAssignedProgramToWorkouts(
        template,
        templateWorkouts,
        assignedProgramUpdatedAt,
        auth.currentUser?.uid || ""
      );
      const assignmentResult = await appendClientAssignedWorkouts(
        clientId,
        nextWorkoutsDraft,
        template,
        assignedProgramUpdatedAt
      );
      const nextWorkouts = assignmentResult.nextWorkouts;

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }

      const clientPatch = assignmentResult.clientPatch;
      setAdminSelectedClient((prev) => prev?.id === clientId ? { ...prev, ...clientPatch } : prev);
      setUsersList((prev) => prev.map((item) => item.id === clientId ? { ...item, ...clientPatch } : item));

      setAdminClientStatus(buildProgramAssignmentStatus(template.name, templateWorkouts.length, assignmentResult));
    } catch (error) {
      console.error("Template assign failed:", error);
      setAdminClientStatus(error?.code === "workout-assignment-batch-limit"
        ? error.message
        : getTrainerActionErrorStatus(error, STATUS_ASSIGN_TEMPLATE_FAILED));
    }
  }

  async function clearClientProgram(clientId = selectedUserId) {
    if (!clientId) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return false;
    }

    const confirmed = await showAppConfirm("\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0432\u0441\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u044b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430? \u0423 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0431\u0443\u0434\u0435\u0442 \u043f\u0443\u0441\u0442\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430.");
    if (!confirmed) return false;

    try {
      const [clientSnapshot, workoutsSnapshot, historySnapshot] = await Promise.all([
        getDoc(doc(db, "users", clientId)),
        getDocs(collection(db, "users", clientId, "workouts")),
        getDocs(collection(db, "users", clientId, "history"))
      ]);
      const clientData = clientSnapshot.exists() ? clientSnapshot.data() : {};
      const assignment = getClientProfileProgramAssignment(clientData);
      if (!assignment) {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
        return false;
      }

      const matchedWorkouts = getClientProgramAssignmentSnapshot(
        workoutsSnapshot.docs,
        assignment.key,
        assignment
      );
      if (!matchedWorkouts.length) {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_NOT_FOUND);
        return false;
      }

      const assignmentTimeline = buildTrainerClientProgramTimeline({
        workouts: getSnapshotEntries(workoutsSnapshot),
        history: getSnapshotEntries(historySnapshot),
        clientProfile: clientData
      });
      const matchedAssignment = assignmentTimeline.find((item) => item.key === assignment.key);
      if (!canUseAdminFeatures() && matchedAssignment?.status !== "future") {
        setAdminClientStatus(STATUS_PROGRAM_ASSIGNMENT_FUTURE_ONLY);
        return false;
      }
      if (matchedWorkouts.length + 1 > 500) throw getBatchLimitError(matchedWorkouts.length + 1);

      const now = new Date().toISOString();
      const matchingIds = new Set(matchedWorkouts.map((workout) => workout.id));
      const remainingWorkouts = workoutsSnapshot.docs.filter((workoutDoc) => !matchingIds.has(workoutDoc.id));
      const clientPatch = getNextActiveClientProgramPatch(
        remainingWorkouts,
        now,
        getSnapshotEntries(historySnapshot)
      );
      const batch = writeBatch(db);
      matchedWorkouts.forEach((workout) => batch.delete(doc(db, "users", clientId, "workouts", workout.id)));
      batch.set(doc(db, "users", clientId), clientPatch, { merge: true });
      await batch.commit();

      updateProgramAssignmentLocally(clientId, assignment.key, "delete", clientPatch, "", {
        assignment
      });
      setAdminClientStatus(STATUS_PROGRAM_RESET);
      return true;
    } catch (error) {
      console.error("Client program clear failed:", error);
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_PROGRAM_RESET_FAILED));
      return false;
    }
  }

  async function assignSavedProgramToClient(clientId = selectedUserId, templateId = adminSelectedTemplateId, options = {}) {
    const assignmentOptions = options && typeof options === "object" ? options : {};
    const selectedTemplate = adminTrainingTemplates.find((item) => item.id === templateId);
    const client = adminSelectedClient?.id === clientId
      ? adminSelectedClient
      : usersList.find((item) => item.id === clientId);

    if (!clientId || !selectedTemplate) {
      setAdminClientStatus(STATUS_SELECT_CLIENT_PROGRAM);
      return false;
    }
    if (!canManageTrainingTemplate(selectedTemplate) || !canManageClientProgram(client)) {
      setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
      return false;
    }
    if (getTrainerProgramStatusMeta(selectedTemplate).id === TRAINER_PROGRAM_STATUSES.DRAFT) {
      setAdminClientStatus("Сначала подготовьте программу к назначению.");
      return false;
    }

    try {
      const templateSnapshot = await getDoc(doc(db, "trainingTemplates", templateId));
      if (!templateSnapshot.exists()) {
        setAdminClientStatus(STATUS_SAVED_PROGRAM_NOT_FOUND);
        return false;
      }

      const template = { id: templateSnapshot.id, ...templateSnapshot.data() };
      if (!canManageTrainingTemplate(template)) {
        setAdminClientStatus(STATUS_OWN_PROGRAMS_ONLY);
        return false;
      }
      if (getTrainerProgramStatusMeta(template).id === TRAINER_PROGRAM_STATUSES.DRAFT) {
        setAdminClientStatus("Сначала подготовьте программу к назначению.");
        return false;
      }
      if (isTrainerProgramArchived(template)) {
        setAdminClientStatus(STATUS_PROGRAM_ARCHIVED);
        return false;
      }

      const templateWorkouts = applyTrainerProgramAssignmentLoadAdjustments(
        buildClientWorkoutsFromTemplate(template),
        assignmentOptions.loadAdjustments
      );
      const programValidation = validateTrainerWorkoutsForAssignment({
        programName: template.name,
        template,
        workouts: templateWorkouts
      });

      if (!programValidation.ok) {
        setAdminClientStatus(programValidation.message);
        return false;
      }

      const confirmed = assignmentOptions.skipConfirmation
        ? true
        : await showAppConfirm(buildProgramAssignmentConfirmText(template.name, templateWorkouts.length));
      if (!confirmed) return false;

      const assignedProgramUpdatedAt = new Date().toISOString();
      const nextWorkoutsDraft = attachAssignedProgramToWorkouts(
        template,
        templateWorkouts,
        assignedProgramUpdatedAt,
        auth.currentUser?.uid || ""
      );
      const assignmentResult = await appendClientAssignedWorkouts(
        clientId,
        nextWorkoutsDraft,
        template,
        assignedProgramUpdatedAt
      );
      const nextWorkouts = assignmentResult.nextWorkouts;

      const clientPatch = assignmentResult.clientPatch;
      setAdminClientStatus(buildProgramAssignmentStatus(template.name, templateWorkouts.length, assignmentResult));

      setAdminSelectedClient((prev) => prev?.id === clientId ? { ...prev, ...clientPatch } : prev);
      setUsersList((prev) => prev.map((clientItem) => (
        clientItem.id === clientId ? { ...clientItem, ...clientPatch } : clientItem
      )));

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }
      await recordTrainerEvent(clientId, "program", STATUS_EVENT_PROGRAM_ASSIGNED, template.name);
      return {
        assignmentKey: `time:${assignedProgramUpdatedAt}`,
        assignedAt: assignedProgramUpdatedAt,
        programId: template.id
      };
    } catch (error) {
      console.error("Saved program assign failed:", error);
      setAdminClientStatus(error?.code === "workout-assignment-batch-limit"
        ? error.message
        : getTrainerActionErrorStatus(error, STATUS_ASSIGN_SAVED_FAILED));
      return false;
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
      setAdminClientStatus(getTrainerActionErrorStatus(error, STATUS_PROGRAM_COPY_FAILED));
    }
  }

  return {
    loadAdminTrainingTemplates,
    createAdminTemplateFromCurrentPlan,
    assignAdminTemplateToClient,
    clearClientProgram,
    assignSavedProgramToClient,
    archiveClientProgramAssignment,
    restoreClientProgramAssignment,
    deleteClientProgramAssignment,
    copyCurrentProgramToClient
  };
}
