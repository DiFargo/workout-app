import { BASIC_WORKOUT_PLANS } from "../data/basicWorkoutPlans.js";
import { sortWorkoutDays } from "./workoutPlanNormalization.js";

export function buildBasicWorkoutPlanFromQuiz(quiz = {}, plans = BASIC_WORKOUT_PLANS) {
  const planKey = quiz.goal === "muscle" || quiz.days === "4" ? "muscle" : "beginner";
  const basePlan = plans[planKey] || plans.beginner;
  const daysLimit = Number(quiz.days) || basePlan.workouts.length;

  return normalizeBasicWorkoutPlanState({
    id: basePlan.id,
    name: basePlan.name,
    description: basePlan.description,
    workouts: sortWorkoutDays(basePlan.workouts.slice(0, Math.min(daysLimit, basePlan.workouts.length)))
  });
}

export function normalizeBasicWorkoutPlanState(plan = {}) {
  const basicPlanId = String(plan.basicPlanId || plan.id || "basic_custom");
  const basicPlanName = String(plan.basicPlanName || plan.name || "");
  const assignedProgramId = String(plan.assignedProgramId || basicPlanId);
  const assignedProgramName = String(plan.assignedProgramName || basicPlanName);
  const assignedProgramUpdatedAt = String(
    plan.assignedProgramUpdatedAt || `basic:${basicPlanId}`
  );

  const workouts = sortWorkoutDays(
    (Array.isArray(plan.workouts) ? plan.workouts : []).map((workout, index) => {
      const order = Number(workout.order || workout.sortOrder || index + 1);

      return {
        ...workout,
        source: "basic",
        assignedProgramId,
        assignedProgramName,
        assignedProgramUpdatedAt,
        order,
        sortOrder: Number(workout.sortOrder || order)
      };
    })
  );

  return {
    ...plan,
    source: "basic",
    basicPlanId,
    basicPlanName,
    assignedProgramId,
    assignedProgramName,
    assignedProgramUpdatedAt,
    workouts
  };
}
