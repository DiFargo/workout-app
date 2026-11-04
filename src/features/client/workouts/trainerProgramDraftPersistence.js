import { doc, runTransaction } from "firebase/firestore";
import { programDraftSnapshot } from "../../../utils/trainerProgramDraft.js";
import { mergeWorkoutCalendarScope, syncWorkoutCalendarWithPlan } from "../../../utils/workoutSchedule.js";

export const PROGRAM_CONFLICT_MESSAGE = "Программа изменилась в другой вкладке или у клиента. Правки остаются в редакторе. Закройте его и откройте актуальную программу перед повторным редактированием.";
const conflict = () => Object.assign(new Error(PROGRAM_CONFLICT_MESSAGE), { code: "program/conflict" });
const clean = (value) => JSON.parse(JSON.stringify(value, (key, item) => key.startsWith("_editor") ? undefined : item));

function persistedWorkoutOrder(workout) {
  for (const value of [workout?.order, workout?.sortOrder]) {
    if (value !== null && value !== undefined && String(value).trim() !== "" && Number.isInteger(Number(value)) && Number(value) > 0) return Number(value);
  }
  return null;
}

// Order is a queue-wide scale, while calendar positions are assignment-local.
// Reordering future days must retain the existing scale around locked days.
function workoutOrderAtPosition(before, index, locked) {
  const orders = before.map(persistedWorkoutOrder);
  const increasing = orders.every((value, position) => value !== null && (!position || value > orders[position - 1]));
  if (increasing) return orders[index] ?? Math.max(0, ...orders) + index - before.length + 1;
  const lockedOffsets = before.flatMap((workout, position) => locked.has(workout.id) && orders[position] !== null ? [orders[position] - position - 1] : []);
  if (lockedOffsets.length && lockedOffsets.every(offset => offset === lockedOffsets[0]) && lockedOffsets[0] >= 0) return lockedOffsets[0] + index + 1;
  return index + 1;
}

// Resolve positional legacy slots against the opening order, never the edited
// order. Explicitly different assignments remain outside this draft's scope.
function anchorCalendarBeforeReorder(calendar, before, assignmentVersion) {
  const byId = new Map(before.map(workout => [String(workout.id), workout]));
  const versions = new Set([assignmentVersion, ...before.map(workout => workout.assignedProgramUpdatedAt)].filter(Boolean));
  const assignments = new Set(before.map(workout => workout.assignedProgramAddedAt || workout.programAssignmentId).filter(Boolean));
  const plannedWorkouts = (calendar.plannedWorkouts || []).map(slot => {
    const slotId = String(slot.workoutId || "").trim();
    const version = slot.assignedProgramUpdatedAt || slot.assignmentVersion || "";
    const assignment = slot.assignedProgramAddedAt || slot.programAssignmentId || "";
    if ((version && !versions.has(version)) || (assignment && !assignments.has(assignment))) return slot;
    if (!slotId && !version && !assignment && calendar.assignedProgramUpdatedAt && versions.size && !versions.has(calendar.assignedProgramUpdatedAt)) return slot;
    let workout = byId.get(slotId);
    if (!slotId) {
      const index = slot.index === undefined || slot.index === null ? NaN : Number(slot.index);
      const orderIndex = slot.order === undefined || slot.order === null ? NaN : Number(slot.order) - 1;
      const hasIndex = Number.isInteger(index) && index >= 0;
      const hasOrder = Number.isInteger(orderIndex) && orderIndex >= 0;
      if (hasIndex && hasOrder && index !== orderIndex) throw conflict();
      workout = before[hasOrder ? orderIndex : hasIndex ? index : -1];
      if (!workout) throw conflict();
    }
    if (!workout) return slot;
    const assignmentId = workout.assignedProgramAddedAt || workout.programAssignmentId || "";
    return { ...slot, workoutId: workout.id, ...(assignmentId ? { assignedProgramAddedAt: assignmentId } : {}) };
  });
  return { ...calendar, plannedWorkouts };
}

// Only this assignment's changed documents are written. Transaction reads also
// protect against client completion and older app versions without a revision counter.
export async function saveTrainerProgramDraft({ db, userId, authorId, draft, run = runTransaction }) {
  const before = draft.baseline.workouts;
  const after = draft.plan.workouts;
  if (before.length + after.length > 450) throw new Error("В программе слишком много тренировок для одного сохранения.");
  const base = new Map(before.map((workout) => [workout.id, workout]));
  const reordered = after.some((workout, index) => base.has(workout.id) && before.indexOf(base.get(workout.id)) !== index);
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
      if (locked.has(ids[index]) && (
        after.findIndex((workout) => workout.id === ids[index]) !== before.indexOf(previous) ||
        programDraftSnapshot(after.find((workout) => workout.id === ids[index])) !== programDraftSnapshot(previous)
      )) throw conflict();
      // Raw read identity is captured before UI normalization in the plan loader.
      if (previous._editorSnapshot && previous._editorSnapshot !== programDraftSnapshot(snapshot.data())) throw conflict();
      if (!previous._editorSnapshot) {
        const saved = snapshot.data();
        if (saved.updatedAt !== previous.updatedAt || saved.status !== previous.status || saved.completedAt !== previous.completedAt) throw conflict();
      }
    }
    const calendar = reordered ? anchorCalendarBeforeReorder(user.workoutCalendar || {}, before, draft.assignmentVersion) : user.workoutCalendar || {};
    const calendarBeforeReorder = reordered ? syncWorkoutCalendarWithPlan(calendar, before) : calendar;
    const now = new Date().toISOString();
    const assignment = {
      assignedProgramId: user.assignedProgramId || "",
      assignedProgramName: draft.plan.assignedProgramName ?? user.assignedProgramName ?? "",
      assignedProgramUpdatedAt: draft.assignmentVersion
    };
    const renamed = assignment.assignedProgramName !== (draft.baseline.assignedProgramName ?? user.assignedProgramName ?? "");
    const workouts = after.map((workout, index) => {
      if (locked.has(workout.id)) return clean(workout);
      const order = reordered || !base.has(workout.id) ? workoutOrderAtPosition(before, index, locked) : null;
      return { ...clean(workout), ...assignment,
        ...(reordered || !base.has(workout.id) ? { order, sortOrder: order, scheduleOrder: index + 1 } : {}) };
    });
    const nextIds = new Set(after.map((workout) => workout.id));
    for (const workout of before) if (!nextIds.has(workout.id)) transaction.delete(doc(db, "users", userId, "workouts", workout.id));
    const savedWorkouts = [];
    for (const [index, workout] of workouts.entries()) {
      const previous = base.get(workout.id);
      const moved = previous && before.indexOf(previous) !== index;
      const saved = snapshots[ids.indexOf(workout.id)].data() || {};
      const orderOnly = moved && !renamed && programDraftSnapshot(previous) === programDraftSnapshot(after[index]);
      const orderPatch = { order: workout.order, sortOrder: workout.sortOrder, scheduleOrder: index + 1, updatedAt: now };
      if (!locked.has(workout.id) && (!previous || renamed || moved || programDraftSnapshot(previous) !== programDraftSnapshot(after[index]))) {
        Object.assign(saved, orderOnly ? orderPatch : { ...workout, updatedAt: now });
        if (!previous) Object.assign(saved, { assignedBy: authorId, assignedAt: now, status: workout.status || "planned", assignedProgramLifecycleStatus: user.assignedProgramLifecycleStatus || "active", assignedProgramVisibility: user.assignedProgramVisibility || "client_active" });
        transaction.set(doc(db, "users", userId, "workouts", workout.id), orderOnly ? orderPatch : saved, { merge: true });
      }
      savedWorkouts.push({ ...workout, ...saved, ...(orderOnly ? { ...after[index], ...orderPatch } : {}), _editorSnapshot: programDraftSnapshot(saved) });
    }
    const calendarScope = syncWorkoutCalendarWithPlan(calendarBeforeReorder, workouts, now, authorId);
    if (reordered) {
      // Sync normally canonicalizes moved dates/statuses. An order edit must
      // retain their existing representation unless those fields were edited.
      calendarScope.plannedWorkouts = calendarScope.plannedWorkouts.map(slot => {
        const original = calendar.plannedWorkouts.find(item => item.workoutId === slot.workoutId &&
          (!(item.assignedProgramAddedAt || item.programAssignmentId) || (item.assignedProgramAddedAt || item.programAssignmentId) === slot.assignedProgramAddedAt) &&
          (!(item.assignedProgramUpdatedAt || item.assignmentVersion) || (item.assignedProgramUpdatedAt || item.assignmentVersion) === slot.assignedProgramUpdatedAt));
        const previous = base.get(slot.workoutId);
        const next = after.find(workout => workout.id === slot.workoutId);
        if (!original || !previous || !next) return slot;
        const retained = { ...slot };
        for (const [workoutFields, calendarFields] of [
          [["scheduledDate", "plannedDate", "movedToDate"], ["date", "movedToDate"]],
          [["status", "statusUpdatedAt", "completedAt"], ["status", "statusUpdatedAt", "completedDate"]]
        ]) {
          if (workoutFields.every(key => programDraftSnapshot(previous[key]) === programDraftSnapshot(next[key]))) {
            for (const key of calendarFields) if (key in original) retained[key] = original[key];
          }
        }
        return retained;
      });
      // Date-only legacy calendars have no original keyed slot to retain above.
      calendarScope.plannedWorkouts = calendarScope.plannedWorkouts.map(slot => ({ ...slot, dateOrderPolicy: "workout_identity" }));
    }
    const workoutCalendar = { ...mergeWorkoutCalendarScope(calendar, calendarScope, workouts, before), planRevision: draft.revision + 1 };
    const clientPatch = { workoutCalendar, assignedWorkoutCount: workouts.length, updatedAt: now, ...(renamed ? { assignedProgramName: assignment.assignedProgramName } : {}) };
    transaction.set(userRef, clientPatch, { merge: true });
    return { plan: { workouts: savedWorkouts, assignedProgramName: assignment.assignedProgramName }, workoutCalendar, clientPatch };
  });
}
