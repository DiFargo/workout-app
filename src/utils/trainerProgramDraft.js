// Draft identity excludes view-only metadata and is independent of object key order.
export function programDraftSnapshot(value) {
  if (Array.isArray(value)) return `[${value.map(programDraftSnapshot).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => !key.startsWith("_editor") && value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${programDraftSnapshot(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

export function createProgramDraft(workouts = [], client = {}) {
  const plan = { workouts: structuredClone(workouts), assignedProgramName: client.assignedProgramName || workouts.find((workout) => workout.assignedProgramName)?.assignedProgramName || "" };
  // Legacy assignments can lack exercise ids. Give their draft rows stable,
  // unique identities so the same handlers can edit them without touching the
  // source or making an untouched draft dirty. The raw conflict snapshot stays
  // intact; an id is persisted only with an actual change to that workout.
  plan.workouts.forEach((workout, workoutIndex) => {
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    const usedIds = new Set(exercises.map((exercise) => String(exercise.id ?? "")));
    exercises.forEach((exercise, exerciseIndex) => {
      if (exercise.id && String(exercise.id).trim()) return;
      const baseId = `legacy_${encodeURIComponent(workout.id || workoutIndex)}_${exerciseIndex}`;
      let id = baseId;
      for (let suffix = 1; usedIds.has(id); suffix += 1) id = `${baseId}_${suffix}`;
      exercise.id = id;
      usedIds.add(id);
    });
  });
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
