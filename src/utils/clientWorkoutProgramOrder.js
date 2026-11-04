import { resolveTrainerAssignmentWorkoutOrder } from "./trainerAssignmentWorkoutOrder.js";

// The programme sheet has its own presentation order. Keep each item's deck
// index intact: changing that index would select a different executable day.
export function getClientWorkoutProgramItems(items = [], workouts = [], calendar = {}) {
  const byId = new Map(items.map(item => [String(item.id || ""), item]));
  const ordered = resolveTrainerAssignmentWorkoutOrder(workouts, calendar);
  const ids = ordered.map(workout => String(workout?.id || ""));
  const complete = ids.length === items.length && ids.every(id => id && byId.has(id))
    && new Set(ids).size === items.length;
  const presentation = complete ? ids.map(id => byId.get(id)) : items;
  return presentation.map((item, index) => ({ ...item, programOrder: index + 1 }));
}
