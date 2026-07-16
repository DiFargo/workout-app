export function calculateAiNutritionMacros(calories, weight, goal = "recomp") {
  const safeCalories = Math.max(1400, Math.round(Number(calories) || 2200));
  const safeWeight = Math.max(45, Number(weight) || 80);
  const proteinMultiplier = goal === "dry" ? 2.35 : goal === "cut" ? 2.15 : goal === "mass" ? 1.9 : goal === "maintain" ? 1.8 : 2.15;
  const fatMultiplier = goal === "dry" ? 0.72 : goal === "cut" ? 0.75 : goal === "mass" ? 0.85 : goal === "maintain" ? 0.85 : 0.78;
  const protein = Math.round(safeWeight * proteinMultiplier);
  const fat = Math.round(safeWeight * fatMultiplier);
  const carbs = Math.max(goal === "dry" ? 100 : 80, Math.round((safeCalories - protein * 4 - fat * 9) / 4));

  return { calories: safeCalories, protein, fat, carbs };
}

export function getAiNutritionActivityMultiplier(activity = "medium") {
  if (activity === "low") return 1.32;
  if (activity === "high") return 1.62;
  if (activity === "veryHigh") return 1.78;
  return 1.48;
}

export function calculateAiNutritionBmr({ weight = 80, height = 180, age = 30, sex = "male" } = {}) {
  const safeWeight = Math.max(35, Number(weight) || 80);
  const safeHeight = Math.max(120, Number(height) || 180);
  const safeAge = Math.max(14, Number(age) || 30);

  return Math.round(10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + (sex === "female" ? -161 : 5));
}

export function calculatePersonalAiNutritionCalories(profile = {}) {
  const weight = Number(profile?.weight) || 80;
  const height = Number(profile?.height) || 180;
  const age = Number(profile?.age) || 30;
  const sex = profile?.sex || "male";
  const activity = profile?.activity || "medium";
  const goal = profile?.goal || "recomp";

  const bmr = calculateAiNutritionBmr({ weight, height, age, sex });
  const maintenance = Math.round(bmr * getAiNutritionActivityMultiplier(activity));
  const personalizedBase = maintenance;

  if (goal === "mass") return Math.round(personalizedBase + 220);
  if (goal === "cut") return Math.round(personalizedBase - 320);
  if (goal === "dry") return Math.round(personalizedBase - 180);
  if (goal === "maintain") return Math.round(personalizedBase);
  return Math.round(personalizedBase - 120);
}
