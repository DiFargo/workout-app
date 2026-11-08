import { buildWorkoutScheduleCalendarEntries, toWorkoutDateKey } from "../../../utils/workoutSchedule.js";

const dates = values => [...new Set(values.map(toWorkoutDateKey).filter(Boolean))].sort();

// A draft contains only unfinished workout dates. Completed facts are an
// independent read-only layer, never placeholders in a newly numbered array.
export function getProfileCalendarDraft(slots = [], selectedDates = null) {
  const unfinished = slots.filter(slot => !slot.isCompleted);
  const selected = dates(selectedDates ?? unfinished.map(slot => slot.plannedDate));
  const completedEntries = buildWorkoutScheduleCalendarEntries(slots.filter(slot => slot.isCompleted));
  const plannedEntries = unfinished.flatMap((slot, index) => selected[index] ? [{
    id: `${slot.workoutId}-draft`, workoutId: slot.workoutId,
    date: selected[index], order: slot.order, status: "planned",
    title: slot.workoutName
  }] : []);
  return {
    dates: selected,
    requiredCount: unfinished.length,
    completedCount: slots.length - unfinished.length,
    entries: [...completedEntries, ...plannedEntries]
  };
}

export function saveProfileCalendarDraft(calendar, slots, selectedDates, now = new Date()) {
  const draft = getProfileCalendarDraft(slots, selectedDates);
  const today = toWorkoutDateKey(now);
  if (draft.dates.length !== draft.requiredCount) throw new Error("calendar/date-count");
  const remaining = slots.filter(slot => !slot.isCompleted);
  // Existing overdue dates can remain; a newly selected date cannot be past.
  if (draft.dates.some(date => date < today && !remaining.some(slot => slot.plannedDate === date))) {
    throw new Error("calendar/past-date");
  }
  const replacements = new Map(remaining.map((slot, index) => [String(slot.workoutId), draft.dates[index]]));
  const stored = Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : [];
  const existing = stored.length ? stored : slots.map(slot => ({
    workoutId: slot.workoutId, workoutName: slot.workoutName, order: slot.order,
    date: slot.plannedDate || "", status: slot.isCompleted ? slot.status : "planned",
    ...(slot.completedDate ? { completedDate: slot.completedDate } : {})
  }));
  if ([...replacements.keys()].some(id => !id || existing.filter(slot => String(slot.workoutId) === id).length !== 1)) {
    throw new Error("calendar/stale-assignment");
  }
  const plannedWorkouts = existing.map(slot => replacements.has(String(slot.workoutId)) ? {
    ...slot, date: replacements.get(String(slot.workoutId)), movedToDate: "",
    dateOrderPolicy: "workout_identity"
  } : slot);
  const scheduledDates = dates(plannedWorkouts.map(slot => slot.movedToDate || slot.date));
  return { ...calendar, plannedWorkouts, scheduledDates, monthlyTrainingDates: scheduledDates };
}

const text = value => String(value ?? "").trim();
const slotDate = slot => toWorkoutDateKey(slot?.movedToDate || slot?.date);
const completed = slot => Boolean(slot?.completedDate) || ["completed", "completed_off_date"].includes(text(slot?.status).toLowerCase());

// Three-way merge: compare only the identities and schedule fields being edited.
// Firestore key order, queue versions and unrelated metadata are not conflicts.
export function mergeProfileCalendarDraft(current, baseline, slots, selectedDates, now = new Date()) {
  const draft = getProfileCalendarDraft(slots, selectedDates);
  const remaining = slots.filter(slot => !slot.isCompleted);
  const currentEntries = current?.plannedWorkouts || [];
  const baselineEntries = baseline?.plannedWorkouts || [];
  const conflict = () => { throw new Error("calendar/stale-assignment"); };
  for (const key of ["assignedProgramId", "assignedProgramAddedAt", "programAssignmentId"]) {
    if (text(current?.[key]) !== text(baseline?.[key])) conflict();
  }
  remaining.forEach((slot, index) => {
    const id = text(slot.workoutId);
    const before = baselineEntries.filter(entry => text(entry.workoutId) === id);
    const fresh = currentEntries.filter(entry => text(entry.workoutId) === id);
    if (!baselineEntries.length && !currentEntries.length) return; // Legacy basic plan.
    if (before.length !== 1 || fresh.length !== 1 || completed(fresh[0])) conflict();
    for (const key of ["assignedProgramId", "assignedProgramAddedAt", "programAssignmentId", "order", "index"]) {
      if (text(before[0][key]) !== text(fresh[0][key])) conflict();
    }
    if (slotDate(before[0]) !== slotDate(fresh[0]) && slotDate(fresh[0]) !== draft.dates[index]) conflict();
  });
  return saveProfileCalendarDraft(current, slots, selectedDates, now);
}
