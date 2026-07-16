import { buildPlannedWorkoutSlots, toWorkoutDateKey } from "./workoutSchedule.js";

function parseEventDetails(details) {
  if (details && typeof details === "object") return details;
  if (typeof details !== "string" || !details.trim()) return {};

  try {
    return JSON.parse(details);
  } catch {
    return {};
  }
}

function normalizeKeyPart(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

export function getTrainerWorkoutReviewKey(review = {}) {
  const assignmentVersion = normalizeKeyPart(review.assignmentVersion || review.assignedProgramUpdatedAt) || "current";
  const historyId = normalizeKeyPart(review.historyId || review.clientSaveId);
  const sourceWorkoutId = normalizeKeyPart(review.sourceWorkoutId || review.plannedWorkoutId || review.workoutId);
  const workoutName = normalizeKeyPart(review.workoutName) || "workout";
  const workoutDate = toWorkoutDateKey(review.workoutDate || review.completedAt || review.date) || "undated";
  const identity = historyId || sourceWorkoutId || workoutName;

  return `workout-review:${assignmentVersion}:${identity}:${workoutDate}`;
}

export function getTrainerWorkoutReviewReviewedKeys(events = []) {
  return new Set((Array.isArray(events) ? events : [])
    .filter((event) => event?.type === "workout_review")
    .map((event) => parseEventDetails(event.details))
    .filter((details) => ["accepted", "adjusted"].includes(details.decision))
    .map((details) => String(details.reviewKey || "").trim())
    .filter(Boolean));
}

export function findTrainerWorkoutReviewTarget({
  workouts = [],
  calendar = {},
  history = [],
  now = new Date()
} = {}) {
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const todayKey = toWorkoutDateKey(now);
  const slots = buildPlannedWorkoutSlots({ workouts: safeWorkouts, calendar, history, now });
  const candidates = slots
    .filter((slot) => !slot.isCompleted && !slot.isMissed && ["planned", "moved"].includes(slot.status))
    .map((slot) => ({ ...slot, effectiveDate: slot.shiftedDate || slot.plannedDate || "" }))
    .sort((first, second) => {
      const firstDate = first.effectiveDate || "9999-12-31";
      const secondDate = second.effectiveDate || "9999-12-31";
      return firstDate.localeCompare(secondDate) || first.index - second.index;
    });
  const futureSlot = candidates.find((slot) => !slot.effectiveDate || !todayKey || slot.effectiveDate >= todayKey);
  const targetSlot = futureSlot || candidates[0];

  if (targetSlot) return safeWorkouts[targetSlot.index] || null;

  return safeWorkouts.find((workout) => !["completed", "missed", "not_completed"].includes(
    String(workout?.status || "planned").trim().toLowerCase()
  )) || null;
}
