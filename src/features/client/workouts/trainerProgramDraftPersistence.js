import { doc, runTransaction } from "firebase/firestore";
import { programDraftSnapshot } from "../../../utils/trainerProgramDraft.js";
import { mergeWorkoutCalendarScope, syncWorkoutCalendarWithPlan } from "../../../utils/workoutSchedule.js";

export const PROGRAM_CONFLICT_MESSAGE = "Программа изменилась в другой вкладке или у клиента. Правки остаются в редакторе. Закройте его и откройте актуальную программу перед повторным редактированием.";
const conflict = () => Object.assign(new Error(PROGRAM_CONFLICT_MESSAGE), { code: "program/conflict" });
const clean = (value) => JSON.parse(JSON.stringify(value, (key, item) => key.startsWith("_editor") ? undefined : item));

// Only this assignment's changed documents are written. Transaction reads also
// protect against client completion and older app versions without a revision counter.
export async function saveTrainerProgramDraft({ db, userId, authorId, draft, run = runTransaction }) {
  const before = draft.baseline.workouts;
  const after = draft.plan.workouts;
  if (before.length + after.length > 450) throw new Error("В программе слишком много тренировок для одного сохранения.");
  const base = new Map(before.map((workout) => [workout.id, workout]));
  const ids = [...new Set([...base.keys(), ...after.map((workout) => workout.id)])];
  const userRef = doc(db, "users", userId);
  const refs = ids.map((id) => doc(db, "users", userId, "workouts", id));
  return run(db, async (transaction) => {
    const [profile, ...snapshots] = await Promise.all([transaction.get(userRef), ...refs.map((ref) => transaction.get(ref))]);
    const user = profile.data() || {};
    if (String(user.assignedProgramUpdatedAt || user.assignedProgramAt || "") !== draft.assignmentVersion || String(user.assignedProgramId || "") !== draft.programId || (Number(user.workoutCalendar?.planRevision) || 0) !== draft.revision) throw conflict();
    const locked = new Set(draft.completedWorkoutIds || []);
    for (const [index, snapshot] of snapshots.entries()) {
      const previous = base.get(ids[index]);
      if (!previous) { if (snapshot.exists()) throw conflict(); continue; }
      if (!snapshot.exists()) throw conflict();
      const persisted = snapshot.data();
      if (persisted.completed === true || persisted.completedAt || ["completed", "completed_off_date", "missed"].includes(persisted.status)) locked.add(ids[index]);
      if (locked.has(ids[index]) && programDraftSnapshot(after.find((workout) => workout.id === ids[index])) !== programDraftSnapshot(previous)) throw conflict();
      // Raw read identity is captured before UI normalization in the plan loader.
      if (previous._editorSnapshot && previous._editorSnapshot !== programDraftSnapshot(snapshot.data())) throw conflict();
      if (!previous._editorSnapshot) {
        const saved = snapshot.data();
        if (saved.updatedAt !== previous.updatedAt || saved.status !== previous.status || saved.completedAt !== previous.completedAt) throw conflict();
      }
    }
    const now = new Date().toISOString();
    const assignment = {
      assignedProgramId: user.assignedProgramId || "",
      assignedProgramName: draft.plan.assignedProgramName ?? user.assignedProgramName ?? "",
      assignedProgramUpdatedAt: draft.assignmentVersion
    };
    const renamed = assignment.assignedProgramName !== (draft.baseline.assignedProgramName ?? user.assignedProgramName ?? "");
    const workouts = after.map((workout, index) => locked.has(workout.id) ? clean(workout) : ({ ...clean(workout), ...assignment, order: index + 1, sortOrder: index + 1, scheduleOrder: index + 1 }));
    const nextIds = new Set(after.map((workout) => workout.id));
    for (const workout of before) if (!nextIds.has(workout.id)) transaction.delete(doc(db, "users", userId, "workouts", workout.id));
    const savedWorkouts = [];
    for (const [index, workout] of workouts.entries()) {
      const previous = base.get(workout.id);
      const moved = previous && before.indexOf(previous) !== index;
      const saved = snapshots[ids.indexOf(workout.id)].data() || {};
      if (!locked.has(workout.id) && (!previous || renamed || moved || programDraftSnapshot(previous) !== programDraftSnapshot(after[index]))) {
        Object.assign(saved, workout, { updatedAt: now });
        if (!previous) Object.assign(saved, { assignedBy: authorId, assignedAt: now, status: workout.status || "planned", assignedProgramLifecycleStatus: user.assignedProgramLifecycleStatus || "active", assignedProgramVisibility: user.assignedProgramVisibility || "client_active" });
        transaction.set(doc(db, "users", userId, "workouts", workout.id), saved, { merge: true });
      }
      savedWorkouts.push({ ...workout, ...saved, _editorSnapshot: programDraftSnapshot(saved) });
    }
    const calendarScope = syncWorkoutCalendarWithPlan(user.workoutCalendar || {}, workouts, now, authorId);
    const workoutCalendar = { ...mergeWorkoutCalendarScope(user.workoutCalendar || {}, calendarScope, workouts, before), planRevision: draft.revision + 1 };
    const clientPatch = { workoutCalendar, assignedWorkoutCount: workouts.length, updatedAt: now, ...(renamed ? { assignedProgramName: assignment.assignedProgramName } : {}) };
    transaction.set(userRef, clientPatch, { merge: true });
    return { plan: { workouts: savedWorkouts, assignedProgramName: assignment.assignedProgramName }, workoutCalendar, clientPatch };
  });
}
