import { exerciseUsesExternalWeight } from "./auditSafety.js";

function parseWeight(value) {
  const match = String(value ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  const numeric = Number(match?.[0]);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatWeight(value) {
  const rounded = Math.round(Number(value) * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function normalizeExerciseName(name = "") {
  return String(name || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function getExerciseKind(exercise = {}) {
  const name = normalizeExerciseName(exercise.name);

  if (!exerciseUsesExternalWeight(exercise)) return "bodyweight";
  if (/жим ногами/.test(name)) return "leg_press";
  if (/разгибани.*ног|сгибани.*ног|икр.*тренаж/.test(name)) return "lower_machine";
  if (/гантел.*в сторон|махи.*гантел/.test(name)) return "dumbbell_isolation";
  if (/гантел/.test(name)) return "dumbbell";
  if (/штанг|станов.*тяг|приседани.*штанг/.test(name)) return "barbell";
  if (/кроссовер|блок|канат|трос/.test(name)) return "cable";
  if (/тяг.*тренаж|гребн|хаммер|рычажн/.test(name)) return "pull_machine";
  if (/жим.*тренаж|бабочк|пек-дек/.test(name)) return "press_machine";
  return "machine";
}

function getProfileFactor(profile = {}, quiz = {}) {
  const levelFactor = {
    beginner: 0.72,
    returning: 0.88,
    experienced: 1
  }[String(quiz.level || "beginner")] || 0.72;
  const activityFactor = {
    low: 0.84,
    medium: 1,
    high: 1.08,
    veryHigh: 1.14
  }[String(profile.activity || "medium")] || 1;
  const goalFactor = {
    strength: 1.05,
    muscle: 1,
    general_fitness: 0.94,
    fat_loss: 0.9
  }[String(quiz.goal || "general_fitness")] || 0.94;
  const age = Number(profile.age) || 0;
  const height = Number(profile.height) || 0;
  const ageFactor = age && (age < 18 || age >= 60) ? 0.84 : age >= 50 ? 0.9 : 1;
  const heightFactor = height && (height < 155 || height > 200) ? 0.95 : 1;
  const restrictionsFactor = String(quiz.restrictions || "none") === "none" ? 1 : 0.75;

  return Math.min(1.08, Math.max(0.55, levelFactor * activityFactor * goalFactor * ageFactor * heightFactor * restrictionsFactor));
}

function getEstimatedWeight(exercise = {}, profile = {}, quiz = {}) {
  const kind = getExerciseKind(exercise);
  if (kind === "bodyweight") return null;

  const bodyWeight = Math.min(180, Math.max(45, Number(profile.weight) || 70));
  const factor = getProfileFactor(profile, quiz);
  const baseMultiplier = {
    leg_press: 0.45,
    lower_machine: 0.2,
    dumbbell_isolation: 0.035,
    dumbbell: 0.075,
    cable: 0.08,
    pull_machine: 0.28,
    press_machine: 0.2,
    machine: 0.18
  }[kind] || 0.18;

  if (kind === "barbell") {
    const name = normalizeExerciseName(exercise.name);
    const barbellBase = /станов.*тяг/.test(name) ? bodyWeight * 0.3 : bodyWeight * 0.18;
    return formatWeight(Math.max(20, barbellBase * factor));
  }

  const rawWeight = bodyWeight * baseMultiplier * factor;
  const minimum = kind === "dumbbell_isolation" ? 1 : kind === "dumbbell" ? 2 : 2.5;
  return formatWeight(Math.max(minimum, rawWeight));
}

function getHistoryWeightMap(history = []) {
  const result = new Map();
  const sortedHistory = [...(Array.isArray(history) ? history : [])].sort((left, right) => (
    new Date(right?.date || right?.finishedAt || 0).getTime()
      - new Date(left?.date || left?.finishedAt || 0).getTime()
  ));

  sortedHistory.forEach((workout) => {
    (Array.isArray(workout?.exercises) ? workout.exercises : []).forEach((exercise) => {
      const key = normalizeExerciseName(exercise?.name);
      if (!key || result.has(key)) return;

      const sets = Array.isArray(exercise?.sets) ? [...exercise.sets].reverse() : [];
      const completedSet = sets.find((set) => set?.completed !== false && parseWeight(set?.weight ?? set?.enteredWeight));
      const weight = parseWeight(completedSet?.weight ?? completedSet?.enteredWeight);
      if (weight !== null) result.set(key, formatWeight(weight));
    });
  });

  return result;
}

function applyExerciseStartingWeight(exercise = {}, context = {}) {
  if (!exerciseUsesExternalWeight(exercise)) return exercise;

  const key = normalizeExerciseName(exercise.name);
  const historyWeight = context.historyWeights.get(key);
  const existingWeight = parseWeight(exercise?.sets?.[0]?.weight);
  const suggestedWeight = historyWeight || (existingWeight ? formatWeight(existingWeight) : getEstimatedWeight(exercise, context.profile, context.quiz));
  if (!suggestedWeight) return exercise;

  const source = historyWeight ? "history" : existingWeight ? "plan" : "estimate";
  const confirmed = source !== "estimate";

  return {
    ...exercise,
    startingWeightSource: source,
    sets: (exercise.sets || []).map((set) => ({
      ...set,
      weight: String(suggestedWeight),
      startingWeightSource: source,
      startingWeightConfirmed: confirmed
    }))
  };
}

export function applyBasicWorkoutStartingWeights(plan = {}, { profile = {}, quiz = {}, history = [] } = {}) {
  const historyWeights = getHistoryWeightMap(history);
  const sourceProfile = profile && typeof profile === "object" ? profile : {};

  return {
    ...plan,
    startingWeightProfile: {
      version: 1,
      source: historyWeights.size ? "profile_and_history" : "profile",
      hasRegistrationProfile: Boolean(Number(sourceProfile.weight) || Number(sourceProfile.height) || sourceProfile.activity),
      hasHistory: historyWeights.size > 0
    },
    workouts: (plan.workouts || []).map((workout) => ({
      ...workout,
      exercises: (workout.exercises || []).map((exercise) => applyExerciseStartingWeight(exercise, {
        profile: sourceProfile,
        quiz,
        historyWeights
      }))
    }))
  };
}

export function applyBasicWorkoutStartingWeightFeedback(
  plan = {},
  workoutId = "",
  exerciseId = "",
  feedback = "just_right"
) {
  const currentWorkout = (plan.workouts || []).find((workout) => workout.id === workoutId);
  const currentExercise = currentWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
  const firstSet = currentExercise?.sets?.[0];
  const initialWeight = parseWeight(firstSet?.enteredWeight || firstSet?.weight);

  if (
    !currentExercise ||
    !firstSet?.completed ||
    firstSet.startingWeightSource !== "estimate" ||
    firstSet.startingWeightConfirmed ||
    initialWeight === null
  ) {
    return { plan, changed: false, weight: "" };
  }

  const multiplier = feedback === "too_easy" ? 1.1 : feedback === "too_hard" ? 0.9 : 1;
  const nextWeight = formatWeight(Math.max(0.5, initialWeight * multiplier));
  const exerciseName = normalizeExerciseName(currentExercise.name);

  const nextPlan = {
    ...plan,
    startingWeightProfile: {
      ...(plan.startingWeightProfile || {}),
      calibrated: true
    },
    workouts: (plan.workouts || []).map((workout) => ({
      ...workout,
      exercises: (workout.exercises || []).map((exercise) => {
        if (normalizeExerciseName(exercise.name) !== exerciseName) return exercise;

        const isCurrentExercise = workout.id === workoutId && exercise.id === exerciseId;
        return {
          ...exercise,
          startingWeightSource: "calibrated",
          sets: (exercise.sets || []).map((set, index) => ({
            ...set,
            weight: isCurrentExercise && index === 0 && set.completed
              ? set.weight
              : nextWeight,
            startingWeightSource: "calibrated",
            startingWeightConfirmed: true,
            startingWeightFeedback: feedback,
            ...(isCurrentExercise && index === 0
              ? { startingWeightInitialValue: formatWeight(initialWeight) }
              : {})
          }))
        };
      })
    }))
  };

  return { plan: nextPlan, changed: true, weight: nextWeight };
}
