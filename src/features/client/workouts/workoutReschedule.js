import { runTransaction } from "firebase/firestore";
import { captureAuthSession } from "../../../utils/authSession.js";
import { getWorkoutScheduleCalendarForWorkouts, mergeWorkoutCalendarScope, normalizeWorkoutCalendarSchedule, toWorkoutDateKey } from "../../../utils/workoutSchedule.js";

export async function rescheduleClientWorkout({
  auth, db, doc, plan, workoutId, workoutIndex, dateKey,
  setWorkoutCalendar, setScheduledDates, setDraftDates, persistCalendar, showError,
  run = runTransaction, captureSession = () => captureAuthSession(auth)
}) {
  const session = captureSession();
  const uid = session.uid;
  const workouts = Array.isArray(plan?.workouts) ? plan.workouts : [];
  const target = workouts.find(workout => String(workout.id) === String(workoutId)) || (!workoutId ? workouts[workoutIndex] : null);
  if (!uid || !session.isCurrent() || !target || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return false;
  const targetIndex = workouts.indexOf(target);

  try {
    const nextCalendar = await run(db, async transaction => {
      const profileRef = doc(db, "users", uid);
      const profile = await transaction.get(profileRef);
      if (!session.isCurrent() || !profile.exists()) return null;
      const updatedAt = new Date().toISOString();
      // A scoped UI calendar is not the complete server calendar.
      const currentCalendar = profile.data().workoutCalendar || {};
      const scope = getWorkoutScheduleCalendarForWorkouts(currentCalendar, workouts);
      const matchesWorkout = item => {
        const id = String(item?.workoutId || "");
        return id ? id === String(target.id) : Number(item?.order) === targetIndex + 1 || Number(item?.index) === targetIndex;
      };
      const plannedWorkouts = scope.plannedWorkouts.map(item => matchesWorkout(item) ? {
        ...item, date: dateKey, movedToDate: "",
        rescheduledFromDate: toWorkoutDateKey(item?.movedToDate || item?.date || ""),
        status: "planned", statusUpdatedAt: updatedAt
      } : item);
      if (!plannedWorkouts.some(matchesWorkout)) plannedWorkouts.push({
        order: targetIndex + 1, index: targetIndex, workoutId: target.id,
        workoutName: target.name || `Тренировка ${targetIndex + 1}`,
        assignedProgramAddedAt: target.assignedProgramAddedAt || target.programAssignmentId || "",
        assignedProgramUpdatedAt: target.assignedProgramUpdatedAt || "",
        date: dateKey, movedToDate: "", rescheduledFromDate: toWorkoutDateKey(target.scheduledDate || target.plannedDate || ""),
        status: "planned", statusUpdatedAt: updatedAt
      });
      const nextScope = normalizeWorkoutCalendarSchedule({ ...scope, plannedWorkouts, updatedAt, updatedBy: uid }, workouts);
      const merged = { ...mergeWorkoutCalendarScope(currentCalendar, nextScope, workouts),
        planRevision: (Number(currentCalendar.planRevision) || 0) + 1 };
      transaction.set(profileRef, { workoutCalendar: merged, updatedAt }, { merge: true });
      return merged;
    });
    if (!nextCalendar || !session.isCurrent()) return false;
    const apply = (setter, value) => setter(current => session.isCurrent() ? value : current);
    apply(setWorkoutCalendar, nextCalendar);
    apply(setScheduledDates, nextCalendar.scheduledDates);
    apply(setDraftDates, nextCalendar.scheduledDates);
    if (session.isCurrent()) persistCalendar(uid, nextCalendar);
    return true;
  } catch (error) {
    console.error("Workout reschedule failed:", error);
    if (session.isCurrent()) showError("Не получилось перенести тренировку. Проверь соединение.");
    return false;
  }
}
