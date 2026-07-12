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

export function buildAssignmentWorkoutDocumentPlan(
  currentWorkoutDocs = [],
  nextWorkouts = [],
  assignedProgramUpdatedAt = ""
) {
  const docs = Array.isArray(currentWorkoutDocs) ? currentWorkoutDocs : [];
  const usedIds = new Set();
  const protectedWorkoutIds = new Set();
  const suffix = getAssignmentDocSuffix(assignedProgramUpdatedAt);

  docs.forEach((workoutDoc) => {
    const id = getWorkoutDocId(workoutDoc);
    if (!id) return;
    usedIds.add(id);
    if (isCompletedAssignedWorkoutDoc(getWorkoutDocData(workoutDoc))) {
      protectedWorkoutIds.add(id);
    }
  });

  const assignedWorkouts = (Array.isArray(nextWorkouts) ? nextWorkouts : []).map((workoutItem, index) => {
    const originalId = String(workoutItem?.id || `workout_${index + 1}`).trim();
    let nextId = originalId;

    if (protectedWorkoutIds.has(originalId)) {
      const baseId = originalId || `workout_${index + 1}`;
      let counter = 1;
      nextId = `${baseId}_${suffix}`;
      while (usedIds.has(nextId)) {
        counter += 1;
        nextId = `${baseId}_${suffix}_${counter}`;
      }
    }

    usedIds.add(nextId);
    return nextId === originalId
      ? workoutItem
      : { ...workoutItem, id: nextId, originalWorkoutId: originalId };
  });
  const nextWorkoutIds = new Set(assignedWorkouts.map((workoutItem) => workoutItem.id));
  const staleWorkoutDocs = docs.filter((workoutDoc) => {
    const id = getWorkoutDocId(workoutDoc);
    return id && !nextWorkoutIds.has(id) && !protectedWorkoutIds.has(id);
  });

  return {
    assignedWorkouts,
    protectedCount: protectedWorkoutIds.size,
    protectedWorkoutIds: [...protectedWorkoutIds],
    staleWorkoutDocs
  };
}
