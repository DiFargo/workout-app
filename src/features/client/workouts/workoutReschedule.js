import { normalizeWorkoutCalendarSchedule, toWorkoutDateKey } from "../../../utils/workoutSchedule.js";

export async function rescheduleClientWorkout({
  auth,
  user,
  db,
  doc,
  setDoc,
  plan,
  workoutCalendar,
  workoutId,
  workoutIndex,
  dateKey,
  setWorkoutCalendar,
  setScheduledDates,
  setDraftDates,
  persistCalendar,
  showError
}) {
  const uid = auth.currentUser?.uid || user?.uid;
  if (!uid || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return false;

  try {
    const updatedAt = new Date().toISOString();
    const currentCalendar = workoutCalendar && typeof workoutCalendar === "object" ? workoutCalendar : {};
    const plannedWorkouts = Array.isArray(currentCalendar.plannedWorkouts) ? currentCalendar.plannedWorkouts : [];
    const matchesWorkout = (item) => String(item?.workoutId || "") === String(workoutId || "") ||
      Number(item?.order) === Number(workoutIndex) + 1 || Number(item?.index) === Number(workoutIndex);
    const nextPlannedWorkouts = plannedWorkouts.map((item) => matchesWorkout(item)
      ? {
          ...item,
          date: dateKey,
          movedToDate: "",
          rescheduledFromDate: toWorkoutDateKey(item?.movedToDate || item?.date || ""),
          status: "planned",
          statusUpdatedAt: updatedAt
        }
      : item);

    if (!nextPlannedWorkouts.some(matchesWorkout) && plan?.workouts?.[workoutIndex]) {
      const workout = plan.workouts[workoutIndex];
      nextPlannedWorkouts.push({
        order: Number(workoutIndex) + 1,
        index: Number(workoutIndex),
        workoutId: workoutId || workout.id || "",
        workoutName: workout.name || `Тренировка ${Number(workoutIndex) + 1}`,
        date: dateKey,
        movedToDate: "",
        rescheduledFromDate: toWorkoutDateKey(workout.scheduledDate || workout.plannedDate || ""),
        status: "planned",
        statusUpdatedAt: updatedAt
      });
    }

    const nextCalendar = {
      ...normalizeWorkoutCalendarSchedule({
        ...currentCalendar,
        plannedWorkouts: nextPlannedWorkouts
      }, plan?.workouts || []),
      updatedAt
    };
    const scheduledDates = nextCalendar.scheduledDates;
    await setDoc(doc(db, "users", uid), { workoutCalendar: nextCalendar, updatedAt }, { merge: true });
    setWorkoutCalendar(nextCalendar);
    setScheduledDates(scheduledDates);
    setDraftDates(scheduledDates);
    persistCalendar(uid, nextCalendar);
    return true;
  } catch (error) {
    console.error("Workout reschedule failed:", error);
    showError("Не получилось перенести тренировку. Проверь соединение.");
    return false;
  }
}
