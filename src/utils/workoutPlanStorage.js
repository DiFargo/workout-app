// The authenticated read model and editor conflict snapshots are reproducible.
// Keep one complete primary plan for offline use, not duplicate history and
// original workout strings in every backup and active draft.
export function createPersistableWorkoutPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return plan;
  let savedWorkouts;
  if (Array.isArray(plan.workouts)) {
    plan.workouts.forEach((workout, index) => {
      if (!workout || typeof workout !== "object" || Array.isArray(workout) || !Object.hasOwn(workout, "_editorSnapshot")) return;
      savedWorkouts ??= plan.workouts.slice();
      const savedWorkout = { ...workout };
      delete savedWorkout._editorSnapshot;
      savedWorkouts[index] = savedWorkout;
    });
  }
  if (!savedWorkouts && !Object.hasOwn(plan, "readModel")) return plan;
  const savedPlan = { ...plan };
  delete savedPlan.readModel;
  if (savedWorkouts) savedPlan.workouts = savedWorkouts;
  return savedPlan;
}

const compactedStorage = new WeakMap();

export function compactStoredWorkoutPlans(uid, {
  workoutPlanBackupStorageKey = "workout_plan_backup_v1",
  storage
} = {}) {
  if (!uid) return;
  try {
    storage ??= localStorage;
    const scope = JSON.stringify([uid, workoutPlanBackupStorageKey]);
    if (compactedStorage.get(storage)?.has(scope)) return;
    let complete = true;
    const compact = (key, transform) => {
      try {
        const raw = storage.getItem(key);
        if (!raw) return;
        const value = JSON.parse(raw);
        const next = transform(value);
        if (next === value) return;
        const serialized = JSON.stringify(next);
        // Replace in place, never delete a backup or an unsent user entry.
        if (serialized.length < raw.length) storage.setItem(key, serialized);
      } catch {
        complete = false;
      }
    };

    compact(`${workoutPlanBackupStorageKey}:${uid}`, (backups) => {
      if (!Array.isArray(backups)) return backups;
      let changed = false;
      const next = backups.map((backup) => {
        const plan = createPersistableWorkoutPlan(backup?.plan);
        if (plan === backup?.plan) return backup;
        changed = true;
        return { ...backup, plan };
      });
      return changed ? next : backups;
    });

    const prefix = `workout_active_draft_v1:${uid}:`;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      compact(key, (draft) => {
        if (draft?.uid !== uid) return draft;
        const plan = createPersistableWorkoutPlan(draft.plan);
        return plan === draft.plan ? draft : { ...draft, plan };
      });
    }

    if (complete) {
      const scopes = compactedStorage.get(storage) || new Set();
      scopes.add(scope);
      compactedStorage.set(storage, scopes);
    }
  } catch {
    // Storage may be unavailable in a webview. Keep the original snapshots;
    // the actual draft write reports whether this session can be restored.
  }
}
