import { doc, runTransaction } from "firebase/firestore";
import { applyWorkoutProgressionToFuturePlan } from "./workoutPlanUpdateHandlers.js";
import { shiftBasicWorkoutScheduleAfterCompletion } from "../../../utils/basicWorkoutSchedule.js";
import { syncWorkoutCalendarWithPlan } from "../../../utils/workoutSchedule.js";

export function buildWorkoutCompletionOperation(plan, workout) {
  return { plan, workout };
}

function prescription(day) {
  return JSON.stringify((day.exercises || []).map((exercise) => ({
    id: String(exercise.id || ""), name: exercise.name,
    sets: (exercise.sets || []).map((set) => ({ weight: String(set.weight ?? ""), reps: String(set.reps ?? ""), duration: Number(set.durationSeconds) || 0 }))
  })));
}

// The history record is also the idempotency marker: a retried completion never
// applies progression twice. Read every affected document before writing any.
export async function persistWorkoutCompletion({ db, uid, entry, completion = null }) {
  const saveId = entry.clientSaveId || entry.id;
  if (!saveId) throw new Error("workout-save-id-required");
  const historyRef = doc(db, "users", uid, "history", saveId);
  const deletedRef = doc(db, "users", uid, "historyTombstones", saveId);
  const userRef = doc(db, "users", uid);
  const original = completion?.plan;
  const refs = (original?.workouts || []).map((day) => doc(db, "users", uid, "workouts", day.id));
  return runTransaction(db, async (transaction) => {
    const deleted = await transaction.get(deletedRef);
    const history = await transaction.get(historyRef);
    if (deleted.exists()) return { deleted: true };
    if (history.exists()) return { saved: true, alreadySaved: true };
    const user = completion ? (await transaction.get(userRef)).data() || {} : {};
    const snapshots = [];
    for (const ref of refs) snapshots.push(await transaction.get(ref));
    let savedPlan = null;
    if (completion) {
      const basic = original.source === "basic";
      const sameAssignment = basic
        ? Boolean(user.basicWorkoutPlan && String(user.basicWorkoutPlan.basicPlanId || user.basicWorkoutPlan.id) === String(original.basicPlanId || original.id))
        : Boolean(entry.assignedProgramId && entry.assignedProgramId === user.assignedProgramId && (!entry.assignedProgramUpdatedAt || entry.assignedProgramUpdatedAt === user.assignedProgramUpdatedAt));
      if (sameAssignment) {
        const freshBasic = user.basicWorkoutPlan;
        const freshDays = basic ? freshBasic.workouts || [] : snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => ({ ...snapshot.data(), id: snapshot.id }));
        const fresh = { ...original, ...(basic ? freshBasic : {}), workouts: freshDays };
        const progressed = applyWorkoutProgressionToFuturePlan(fresh, completion.workout, { updatedAt: entry.finishedAt }).plan;
        const shifted = basic ? shiftBasicWorkoutScheduleAfterCompletion(progressed, completion.workout.id, entry.finishedAt) : progressed;
        const priorById = new Map((original.workouts || []).map((day) => [day.id, day]));
        const freshById = new Map(freshDays.map((day) => [day.id, day]));
        // A coach or another device may have edited the plan since the workout
        // started. Apply only unchanged prescriptions; always keep the result.
        const workouts = shifted.workouts.map((day) => {
          const before = priorById.get(day.id);
          const current = freshById.get(day.id);
          if (!before || !current || ["completed", "done", "archived"].includes(current.status)) return current || day;
          const unchanged = prescription(before) === prescription(current)
            && String(before.scheduledDate || before.plannedDate || "") === String(current.scheduledDate || current.plannedDate || "");
          return unchanged ? day : current;
        });
        savedPlan = { ...fresh, workouts };
        for (const day of workouts) {
          const current = freshById.get(day.id);
          if (current && JSON.stringify(day) !== JSON.stringify(current)) {
            transaction.set(doc(db, "users", uid, "workouts", day.id), day, { merge: true });
          }
        }
        if (basic) {
          const workoutCalendar = syncWorkoutCalendarWithPlan(user.workoutCalendar || {}, workouts, entry.finishedAt, uid);
          workoutCalendar.planRevision = (Number(user.workoutCalendar?.planRevision) || 0) + 1;
          transaction.set(userRef, { basicWorkoutPlan: savedPlan, workoutCalendar }, { merge: true });
        }
      }
    }
    transaction.set(historyRef, { ...entry, completionApplied: true });
    return { saved: true, plan: savedPlan };
  });
}

export function deleteOwnWorkoutHistory({ db, uid, id, clientSaveId = id }) {
  return runTransaction(db, async (transaction) => {
    const ids = [...new Set([id, clientSaveId].filter(Boolean))];
    for (const saveId of ids) {
      transaction.set(doc(db, "users", uid, "historyTombstones", saveId), { deletedAt: new Date().toISOString() });
      transaction.delete(doc(db, "users", uid, "history", saveId));
    }
  });
}
