import { defaultNutritionState } from "../data/nutritionDefaults.js";
import { TRAINER_NUTRITION_GOAL_PRESETS } from "../data/nutritionPlanning.js";
import { getAiHistoryItems } from "../domain/workoutPresentation.js";
import {
  collectAiNutritionFoodStats,
  getNutritionPersonalBaseline,
  getAiNutritionWeightTrend
} from "./aiNutritionAnalysis.js";
import {
  calculateAiNutritionBmr,
  calculateAiNutritionMacros,
  calculateAiNutritionTargetCalorieAdjustment,
  calculatePersonalAiNutritionCalories,
  getAiNutritionActivityMultiplier
} from "./aiNutritionCalculations.js";
import {
  getAiNutritionActivityLabel,
  getAiNutritionGoalLabel
} from "./aiNutritionLabels.js";
import {
  getAiNutritionDayMacros,
  getAiNutritionTrainingDays
} from "./aiNutritionSchedule.js";

export function buildAiNutritionMonthlyPlan(nutrition = defaultNutritionState, profile = null, history = [], previousPlan = null) {
  const weight = Number(profile?.weight) || 80;
  const height = Number(profile?.height) || 180;
  const age = Number(profile?.age) || 30;
  const sex = profile?.sex || "male";
  const goal = profile?.goal || "recomp";
  const targetWeight = Number(profile?.targetWeight);
  const targetWeightIsValid = Number.isFinite(targetWeight) && targetWeight >= 35 && targetWeight <= 350;
  const targetDeltaKg = targetWeightIsValid ? Number((targetWeight - weight).toFixed(1)) : null;
  const targetCalorieAdjustment = calculateAiNutritionTargetCalorieAdjustment(profile);
  const trainingDays = getAiNutritionTrainingDays(profile);
  const activity = profile?.activity || "medium";
  const bmr = calculateAiNutritionBmr({ weight, height, age, sex });
  const estimatedMaintenance = Math.round(bmr * getAiNutritionActivityMultiplier(activity));
  const personalStartCalories = calculatePersonalAiNutritionCalories(profile, nutrition);
  const previousStartCalories = Number(previousPlan?.start?.calories || previousPlan?.weeks?.[0]?.calories);
  const sameGoalAsPrevious = previousPlan?.profile?.goal === goal;

  // Personalized plan: body metrics + activity + goal are the source of truth.
  // Old nutrition.goals / old calorieAnchor must not keep all users on the same calories.
  const currentGoal = personalStartCalories;

  let startCalories = personalStartCalories;

  // Only protect against accidental repeated cuts on refresh.
  // If profile data changed, the personal calculation wins.
  const sameBodyProfile =
    String(previousPlan?.profile?.weight || "") === String(profile?.weight || "") &&
    String(previousPlan?.profile?.height || "") === String(profile?.height || "") &&
    String(previousPlan?.profile?.age || "") === String(profile?.age || "") &&
    String(previousPlan?.profile?.targetWeight || "") === String(profile?.targetWeight || "") &&
    String(previousPlan?.profile?.sex || "") === String(sex) &&
    String(previousPlan?.profile?.activity || "medium") === String(activity);

  if (sameGoalAsPrevious && sameBodyProfile && previousStartCalories > 0 && goal !== "mass") {
    startCalories = Math.max(startCalories, previousStartCalories);
  }

  startCalories = Math.max(goal === "dry" ? 1800 : 1600, startCalories);

  // Protection: refresh must not use already AI-reduced calories as a new base.
  // If the goal did not change, do not auto-cut below the previous week-1 plan.
  if (sameGoalAsPrevious && previousStartCalories > 0 && goal !== "mass") {
    startCalories = Math.max(startCalories, previousStartCalories);
  }

  const weekSteps = goal === "mass"
    ? [0, 100, 200, 250]
    : goal === "cut"
      ? [0, -75, -125, -150]
      : goal === "dry"
        ? [0, -50, -75, -100]
        : goal === "maintain"
          ? [0, 0, 0, 0]
          : [0, -25, -50, -50];
  const weeks = weekSteps.map((step, index) => {
    const macros = calculateAiNutritionMacros(startCalories + step, weight, goal);
    const trainingMacros = getAiNutritionDayMacros(macros, { goal, trainingDays }, new Date());
    return {
      week: index + 1,
      label: `${index + 1} неделя`,
      ...macros,
      trainingDay: {
        calories: trainingMacros.calories,
        protein: trainingMacros.protein,
        fat: trainingMacros.fat,
        carbs: trainingMacros.carbs
      },
      focus: index === 0
        ? "закрепить стартовые КБЖУ"
        : index === 1
          ? "сравнить вес и среднюю калорийность"
          : index === 2
            ? "мягко скорректировать калории"
            : "оценить прогресс и обновить план"
    };
  });

  const weightTrend = getAiNutritionWeightTrend(nutrition);
  const frequentFoods = collectAiNutritionFoodStats(nutrition);
  const workoutsCount = getAiHistoryItems(history).length;
  const currentWeek = weeks[0];

  return {
    id: `ai_nutrition_${Date.now()}`,
    version: 1,
    createdAt: new Date().toISOString(),
    calorieAnchor: currentGoal,
    personalMaintenance: estimatedMaintenance,
    personalBmr: bmr,
    activityLabel: getAiNutritionActivityLabel(activity),
    profile: {
      weight: String(profile?.weight || ""),
      targetWeight: targetWeightIsValid ? String(profile?.targetWeight || "") : "",
      height: String(profile?.height || ""),
      age: String(profile?.age || ""),
      sex,
      activity,
      goal,
      trainingDays,
      targetDeltaKg,
      targetCalorieAdjustment
    },
    goalLabel: getAiNutritionGoalLabel(goal),
    start: currentWeek,
    weeks,
    baseline: getNutritionPersonalBaseline(nutrition),
    frequentFoods,
    workoutsCount,
    weightTrend,
    warnings: [
      targetWeightIsValid && Math.abs(targetDeltaKg) >= 0.5
        ? `Цель: ${targetWeight} кг (${targetDeltaKg > 0 ? "+" : ""}${targetDeltaKg} кг от текущего веса). Калории рассчитаны с учётом этой цели.`
        : "Целевой вес близок к текущему — план строится на поддержание и композицию тела.",
      goal === "dry"
        ? "Сушка: дефицит мягкий, белок выше, жиры не режем в ноль, углеводы держим вокруг тренировки."
        : goal === "cut"
          ? "Не режь калории резко: белок держим высоким, жиры не опускаем слишком низко."
          : "Не повышай калории слишком быстро: лучше +100–150 ккал и контроль веса.",
      "Обновление и пересоздание плана не режут калории повторно: снижение только после реального плато веса.",
      "Если тренировки тяжёлые — углеводы лучше держать вокруг тренировки."
    ],
    comment: goal === "mass"
      ? "План построен индивидуально по весу, росту, возрасту, полу, активности и цели: плавный профицит для набора."
      : goal === "dry"
        ? "План построен индивидуально под сушку: умеренный дефицит, высокий белок и энергия для тренировок."
        : goal === "cut"
          ? "План построен индивидуально: аккуратный дефицит без провала и резкого среза калорий."
          : "План построен индивидуально для поддержки/рекомпозиции: калории близко к личной норме и акцент на стабильность."
  };
}

export function buildClientNutritionPresetOptions(client = {}, nutritionState = null, history = []) {
  const sourceProfile = client?.aiNutritionProfile || client?.profile || {};
  const nutritionForCalculation = {
    ...defaultNutritionState,
    ...(nutritionState || {}),
    goals: {
      ...defaultNutritionState.goals,
      ...(nutritionState?.goals || {}),
      ...(client?.nutritionGoals || {})
    }
  };

  return TRAINER_NUTRITION_GOAL_PRESETS.map((preset) => {
    const profile = {
      ...sourceProfile,
      goal: preset.id,
      trainingDays: getAiNutritionTrainingDays(sourceProfile)
    };
    const plan = buildAiNutritionMonthlyPlan(nutritionForCalculation, profile, history, null);
    const week = plan?.weeks?.[0] || plan?.start || nutritionForCalculation.goals;
    const macros = getAiNutritionDayMacros(week, profile);

    return {
      id: preset.id,
      name: preset.name,
      goal: preset.goal,
      calories: Math.round(Number(macros.calories || week.calories) || defaultNutritionState.goals.calories),
      protein: Math.round(Number(macros.protein || week.protein) || defaultNutritionState.goals.protein),
      fat: Math.round(Number(macros.fat || week.fat) || defaultNutritionState.goals.fat),
      carbs: Math.round(Number(macros.carbs || week.carbs) || defaultNutritionState.goals.carbs)
    };
  });
}
