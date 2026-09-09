// Draft identity excludes view-only metadata and is independent of object key order.
export function programDraftSnapshot(value) {
  if (Array.isArray(value)) return `[${value.map(programDraftSnapshot).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => !key.startsWith("_editor") && value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${programDraftSnapshot(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

export function createProgramDraft(workouts = [], client = {}) {
  const plan = { workouts: structuredClone(workouts), assignedProgramName: client.assignedProgramName || workouts.find((workout) => workout.assignedProgramName)?.assignedProgramName || "" };
  return {
    plan,
    baseline: structuredClone(plan),
    assignmentVersion: workouts[0]?.assignedProgramUpdatedAt || client.assignedProgramUpdatedAt || client.assignedProgramAt || "",
    programId: workouts[0]?.assignedProgramId || client.assignedProgramId || "",
    revision: Number(client.workoutCalendar?.planRevision) || 0
  };
}

export function isProgramDraftDirty(draft) {
  return Boolean(draft && programDraftSnapshot(draft.plan) !== programDraftSnapshot(draft.baseline));
}

export function createKeyedSaveQueue() {
  const pending = new Map();
  return (key, save) => {
    const next = (pending.get(key) || Promise.resolve()).catch(() => {}).then(save);
    pending.set(key, next);
    return next.finally(() => { if (pending.get(key) === next) pending.delete(key); });
  };
}
