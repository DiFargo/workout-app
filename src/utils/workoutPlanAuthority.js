import { invalidateSessionResource } from "./sessionResource.js";

export const workoutPlanLoadGenerations = new Map();
export const confirmedWorkoutPlans = new WeakMap();

export function invalidateWorkoutPlan(auth) {
  confirmedWorkoutPlans.delete(auth);
  invalidateSessionResource(auth, key => key.startsWith("workout-plan:"));
}

export function getWorkoutPlanReadOrigin(auth, plan, mode) {
  return isConfirmedWorkoutPlan(auth, plan, mode) ? confirmedWorkoutPlans.get(auth).origin : "unknown";
}

export function isServerConfirmedWorkoutPlan(auth, plan, mode) {
  return getWorkoutPlanReadOrigin(auth, plan, mode) === "server";
}

export function isConfirmedWorkoutPlan(auth, plan, mode) {
  const confirmed = confirmedWorkoutPlans.get(auth);
  return Boolean(confirmed?.session.isCurrent() && confirmed.mode === mode && confirmed.plans.has(plan));
}
