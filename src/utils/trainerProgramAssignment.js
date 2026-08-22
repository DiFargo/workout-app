function getWorkoutDocData(workoutDoc = {}) {
  if (typeof workoutDoc.data === "function") return workoutDoc.data() || {};
  return workoutDoc.data || workoutDoc || {};
}

function getWorkoutDocId(workoutDoc = {}) {
  return String(workoutDoc.id || workoutDoc.ref?.id || getWorkoutDocData(workoutDoc).id || "").trim();
}

export function isCompletedAssignedWorkoutDoc(data = {}) {
  const status = String(data.status || "").trim().toLowerCase();
  return status === "completed" ||
    status === "completed_off_date" ||
    data.completed === true ||
    Boolean(data.completedAt || data.finishedAt);
}

function getAssignmentDocSuffix(assignedProgramUpdatedAt = "") {
  const safeSuffix = String(assignedProgramUpdatedAt || "")
    .trim()
    .replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safeSuffix || String(Date.now());
}

/**
 * Adds a program after the existing queue instead of replacing it.  We keep
 * every existing workout document because it may carry a scheduled date,
 * completion facts, or a client note.
 */
export function buildAppendedAssignmentWorkoutDocumentPlan(
  currentWorkoutDocs = [],
  nextWorkouts = [],
  assignedProgramUpdatedAt = ""
) {
  const docs = Array.isArray(currentWorkoutDocs) ? currentWorkoutDocs : [];
  const suffix = getAssignmentDocSuffix(assignedProgramUpdatedAt);
  const existingWorkouts = docs
    .map((workoutDoc) => {
      const id = getWorkoutDocId(workoutDoc);
      return id ? { ...getWorkoutDocData(workoutDoc), id } : null;
    })
    .filter(Boolean);
  const usedIds = new Set(existingWorkouts.map((workout) => workout.id));
  const previousCount = existingWorkouts.length;
  const protectedCount = existingWorkouts.filter(isCompletedAssignedWorkoutDoc).length;
  const lastOrder = existingWorkouts.reduce((maxOrder, workout, index) => {
    const value = Number(workout.order ?? workout.sortOrder);
    return Number.isFinite(value) ? Math.max(maxOrder, value) : Math.max(maxOrder, index + 1);
  }, 0);

  const assignedWorkouts = (Array.isArray(nextWorkouts) ? nextWorkouts : []).map((workoutItem, index) => {
    const originalId = String(workoutItem?.id || `workout_${index + 1}`).trim();
    const baseId = originalId || `workout_${index + 1}`;
    // A trainer assignment is an individual copy for this client. Never use
    // a template day id as its Firebase document id: a previous assignment
    // may have history under that id even when its old documents are archived.
    let nextId = `${baseId}_${suffix}`;
    let counter = 0;

    while (usedIds.has(nextId)) {
      counter += 1;
      nextId = `${baseId}_${suffix}_${counter + 1}`;
    }

    usedIds.add(nextId);
    const nextOrder = lastOrder + index + 1;
    const workoutTemplate = { ...(workoutItem || {}) };
    [
      "status",
      "completed",
      "completedAt",
      "finishedAt",
      "statusUpdatedAt",
      "movedToDate",
      "scheduledDate",
      "plannedDate"
    ].forEach((key) => delete workoutTemplate[key]);

    return {
      ...workoutTemplate,
      id: nextId,
      order: nextOrder,
      sortOrder: nextOrder,
      originalWorkoutId: originalId,
      status: "planned",
      completed: false
    };
  });

  return {
    assignedWorkouts,
    existingWorkouts,
    previousCount,
    protectedCount,
    allWorkouts: [...existingWorkouts, ...assignedWorkouts]
  };
}
