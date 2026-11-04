import { toWorkoutDateKey } from "./workoutSchedule.js";
import { sortWorkoutDays } from "./workoutPlanNormalization.js";
import { resolveTrainerAssignmentWorkoutOrder } from "./trainerAssignmentWorkoutOrder.js";
import { getAgendaDisplaySlots } from "./trainerScheduleAgenda.js";

const text = value => String(value ?? "").trim();
const assignmentId = workout => text(workout?.assignedProgramAddedAt || workout?.programAssignmentId);

/** The wizard edits the saved client copy, never the currently selected template. */
export function getTrainerSetupScheduleWorkouts(workouts = [], client = {}, assignmentKey = "") {
  const key = text(assignmentKey || client.assignedProgramAddedAt || client.assignedProgramAt);
  const programId = text(client.assignedProgramId);
  if (!key && !programId) return [];
  const selected = (Array.isArray(workouts) ? workouts : []).filter(workout => (
    text(workout.assignedProgramLifecycleStatus).toLowerCase() !== "archived" &&
    (key ? assignmentId(workout) === key : text(workout.assignedProgramId) === programId)
  ));
  // Legacy copies sharing one template ID are not interchangeable.
  if (new Set(selected.map(assignmentId).filter(Boolean)).size > 1) return [];
  return resolveTrainerAssignmentWorkoutOrder(sortWorkoutDays(selected), client.workoutCalendar || {});
}

export function getTrainerSetupScheduleSlots(workouts = [], calendar = {}) {
  const slots = workouts.map((workout, index) => ({
    workoutId: text(workout.id),
    workoutName: text(workout.name) || `Тренировка ${index + 1}`,
    plannedDate: text(workout.scheduledDate || workout.plannedDate),
    completedDate: text(workout.completedAt),
    isCompleted: workout.completed === true,
    status: workout.completed === true ? "completed" : text(workout.status) || "planned"
  }));
  const ids = new Set(workouts.map(workout => text(workout.id)));
  const assignments = new Set(workouts.map(assignmentId).filter(Boolean));
  const savedEntries = (Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : []).filter(entry => (
    ids.has(text(entry.workoutId)) || assignments.has(assignmentId(entry))
  ));
  return getAgendaDisplaySlots(slots, workouts, savedEntries);
}

export function getTrainerSetupScheduleDates(dates = []) {
  return [...new Set((Array.isArray(dates) ? dates : [])
    .map(toWorkoutDateKey)
    .filter(Boolean))].sort();
}

export function buildSubscriptionFromTrainerSetupSchedule(subscription = {}) {
  // A schedule is not a sale or a renewal. In particular, moving the first
  // workout must not replace the cycle used by history and reminder records.
  return { ...subscription };
}
