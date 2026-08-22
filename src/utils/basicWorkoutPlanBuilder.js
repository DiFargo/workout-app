import { BASIC_WORKOUT_PLANS } from "../data/basicWorkoutPlans.js";
import { applyBasicWorkoutStartingWeights } from "./basicWorkoutStartingWeights.js";
import { sortWorkoutDays } from "./workoutPlanNormalization.js";

function getFallbackWorkoutDays(basePlan = {}, plans = {}, requestedDays = 0) {
  const primaryWorkouts = sortWorkoutDays(basePlan.workouts || []);
  const additionalWorkouts = Object.values(plans)
    .filter((plan) => plan && plan !== basePlan)
    .flatMap((plan) => sortWorkoutDays(plan.workouts || []));
  const seenIds = new Set();
  const availableWorkouts = [...primaryWorkouts, ...additionalWorkouts]
    .filter((workout) => {
      const id = String(workout?.id || "").trim();
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
  const requestedCount = [2, 3, 4, 5].includes(Number(requestedDays))
    ? Number(requestedDays)
    : primaryWorkouts.length;

  if (!availableWorkouts.length || !requestedCount) return [];

  return Array.from({ length: requestedCount }, (_, index) => {
    const source = availableWorkouts[index % availableWorkouts.length];
    const cycle = Math.floor(index / availableWorkouts.length);

    return {
      ...source,
      id: cycle > 0 ? `${source.id}_fallback_${cycle + 1}` : source.id,
      order: index + 1,
      sortOrder: index + 1
    };
  });
}

export function buildBasicWorkoutPlanFromQuiz(quiz = {}, plans = BASIC_WORKOUT_PLANS, options = {}) {
  const generatedPlan = quiz?.generatedPlan;

  if (Array.isArray(generatedPlan?.workouts) && generatedPlan.workouts.length > 0) {
    return applyBasicWorkoutStartingWeights(normalizeBasicWorkoutPlanState({
      ...generatedPlan,
      source: "basic",
      generatedBy: generatedPlan.generatedBy || "ai",
      quizProfile: {
        goal: String(quiz.goal || "general_fitness"),
        level: String(quiz.level || "beginner"),
        location: String(quiz.location || "gym"),
        days: String(quiz.days || "3"),
        duration: String(quiz.duration || "45"),
        restrictions: String(quiz.restrictions || "none"),
        restrictionDetails: String(quiz.restrictionDetails || "").trim().slice(0, 180),
        twoDayStructure: String(quiz.twoDayStructure || "recovery_split"),
        planPreferences: String(quiz.planPreferences || "").trim().slice(0, 280)
      }
    }), { profile: options.profile, quiz, history: options.history });
  }

  const planKey = quiz.goal === "muscle" || Number(quiz.days) >= 4 ? "muscle" : "beginner";
  const basePlan = plans[planKey] || plans.beginner;

  return applyBasicWorkoutStartingWeights(normalizeBasicWorkoutPlanState({
    id: basePlan.id,
    name: basePlan.name,
    description: basePlan.description,
    workouts: getFallbackWorkoutDays(basePlan, plans, quiz.days)
  }), { profile: options.profile, quiz, history: options.history });
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

// A generated basic plan describes a fixed number of training days per week.
// Expose it to the UI so a temporarily partial local snapshot is never shown
// as a completed four-week plan.
export function getBasicWorkoutExpectedWorkoutCount(plan = {}) {
  const weeks = Number(plan?.durationWeeks);
  const days = Number(plan?.profile?.days || plan?.quizProfile?.days);

  if (!Number.isInteger(weeks) || weeks < 1 || !Number.isInteger(days) || days < 1) {
    return 0;
  }

  return weeks * days;
}

// The profile keeps the full basic plan as the canonical program snapshot.
// Individual workout documents can temporarily arrive only in part (for
// example while Firestore finishes syncing a completed workout). Preserve all
// planned days and overlay the document-level progress onto their matching
// workout ids instead of replacing a four-week plan with the partial result.
export function mergeBasicWorkoutPlanWithSavedWorkouts(plan = {}, savedWorkouts = []) {
  const basePlan = normalizeBasicWorkoutPlanState(plan);
  const savedById = new Map(
    (Array.isArray(savedWorkouts) ? savedWorkouts : [])
      .filter((workout) => String(workout?.id || "").trim())
      .map((workout) => [String(workout.id).trim(), workout])
  );

  if (!basePlan.workouts.length) {
    return normalizeBasicWorkoutPlanState({
      ...basePlan,
      workouts: Array.from(savedById.values())
    });
  }

  return normalizeBasicWorkoutPlanState({
    ...basePlan,
    workouts: basePlan.workouts.map((workout) => {
      const savedWorkout = savedById.get(String(workout.id || "").trim());
      if (!savedWorkout) return workout;

      return {
        ...workout,
        ...savedWorkout,
        exercises: Array.isArray(savedWorkout.exercises) && savedWorkout.exercises.length
          ? savedWorkout.exercises
          : workout.exercises
      };
    })
  });
}
