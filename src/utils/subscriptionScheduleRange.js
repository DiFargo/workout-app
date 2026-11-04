import { getWorkoutScheduleCalendarForWorkouts, toWorkoutDateKey } from "./workoutSchedule.js";

function isArchived(workout) {
  return workout?.archived === true ||
    String(workout?.assignedProgramLifecycleStatus || "").trim().toLowerCase() === "archived" ||
    ["archived", "client_archived", "trainer_archived"].includes(
      String(workout?.assignedProgramVisibility || "").trim().toLowerCase()
    );
}

export function getSubscriptionScheduleRange({ workouts = [], calendar = {} } = {}) {
  const activeWorkouts = (Array.isArray(workouts) ? workouts : []).filter((workout) => workout && !isArchived(workout));
  if (!activeWorkouts.length) return { startDate: "", endDate: "", dates: [] };
  const rawEntries = Array.isArray(calendar?.plannedWorkouts) ? calendar.plannedWorkouts : [];
  // Keep the saved date attached through the existing identity/scope matcher.
  // Normalization may propose a later date for colliding legacy slots; that
  // proposal is not a saved booking and must not extend this range.
  const savedDate = Symbol("subscriptionScheduleSavedDate");
  const scoped = getWorkoutScheduleCalendarForWorkouts({
    ...calendar,
    plannedWorkouts: rawEntries.filter((entry) => !isArchived(entry)).map((entry) => ({
      ...entry, [savedDate]: toWorkoutDateKey(entry?.movedToDate || entry?.date)
    }))
  }, activeWorkouts);
  const rootDates = new Set([
    ...(Array.isArray(calendar?.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar?.monthlyTrainingDates) ? calendar.monthlyTrainingDates : [])
  ].map(toWorkoutDateKey).filter(Boolean));
  const dates = [...new Set(scoped.plannedWorkouts.map((entry, index) => {
    const workout = activeWorkouts[index];
    return entry[savedDate] || toWorkoutDateKey(workout.movedToDate || workout.scheduledDate || workout.plannedDate) ||
      (!rawEntries.length && rootDates.has(entry.date) ? entry.date : "");
  }).filter(Boolean))].sort();
  return { startDate: dates[0] || "", endDate: dates.at(-1) || "", dates };
}
