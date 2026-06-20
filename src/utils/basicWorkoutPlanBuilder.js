import { BASIC_WORKOUT_PLANS } from "../data/basicWorkoutPlans.js";
import { sortWorkoutDays } from "./workoutPlanNormalization.js";

export function buildBasicWorkoutPlanFromQuiz(quiz = {}, plans = BASIC_WORKOUT_PLANS) {
  const planKey = quiz.goal === "muscle" || quiz.days === "4" ? "muscle" : "beginner";
  const basePlan = plans[planKey] || plans.beginner;
  const daysLimit = Number(quiz.days) || basePlan.workouts.length;

  return {
    id: basePlan.id,
    name: basePlan.name,
    description: basePlan.description,
    workouts: sortWorkoutDays(basePlan.workouts.slice(0, Math.min(daysLimit, basePlan.workouts.length)))
  };
}
