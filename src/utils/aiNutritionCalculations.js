export function calculateAiNutritionMacros(calories, weight, goal = "recomp") {
  const safeCalories = Math.max(1400, Math.round(Number(calories) || 2200));
  const safeWeight = Math.max(45, parseAiNutritionProfileNumber(weight) || 80);
  const proteinMultiplier = goal === "dry" ? 2.35 : goal === "cut" ? 2.15 : goal === "mass" ? 1.9 : goal === "maintain" ? 1.8 : 2.15;
  const fatMultiplier = goal === "dry" ? 0.72 : goal === "cut" ? 0.75 : goal === "mass" ? 0.85 : goal === "maintain" ? 0.85 : 0.78;
  let protein = Math.round(safeWeight * proteinMultiplier);
  let fat = Math.round(safeWeight * fatMultiplier);
  const minimumCarbs = goal === "dry" ? 100 : 80;
  const remainingCalories = safeCalories - minimumCarbs * 4;
  const proteinFatCalories = protein * 4 + fat * 9;
  if (proteinFatCalories > remainingCalories) {
    // Fit the existing proportions into the personal calorie target; don't
    // silently raise that target to satisfy weight-based macro multipliers.
    const scale = remainingCalories / proteinFatCalories;
    protein = Math.floor(protein * scale);
    fat = Math.floor(fat * scale);
  }
  const carbs = Math.max(minimumCarbs, Math.round((safeCalories - protein * 4 - fat * 9) / 4));

  return { calories: safeCalories, protein, fat, carbs };
}

export function getAiNutritionActivityMultiplier(activity = "medium") {
  if (activity === "low") return 1.32;
  if (activity === "high") return 1.62;
  if (activity === "veryHigh") return 1.78;
  return 1.48;
}

export function parseAiNutritionProfileNumber(value, fallback = null) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Keep the plan builder from silently inventing body data. The onboarding has
 * the same fields, but this guard is also used by the optional AI-plan screen.
 */
export function getAiNutritionProfileValidation(profile = {}) {
  const checks = [
    ["weight", "вес", 35, 350],
    ["targetWeight", "целевой вес", 35, 350],
    ["height", "рост", 120, 250],
    ["age", "возраст", 14, 100]
  ];
  const missing = checks
    .filter(([field, , min, max]) => {
      const value = parseAiNutritionProfileNumber(profile?.[field]);
      return value === null || value < min || value > max;
    })
    .map(([, label]) => label);

  if (!["female", "male"].includes(profile?.sex)) missing.push("пол");

  return {
    valid: missing.length === 0,
    missing,
    message: missing.length
      ? `Заполни: ${missing.join(", ")}.`
      : ""
  };
}

export function calculateAiNutritionTargetCalorieAdjustment(profile = {}) {
  const currentWeight = parseAiNutritionProfileNumber(profile?.weight);
  const targetWeight = parseAiNutritionProfileNumber(profile?.targetWeight);
  if (currentWeight === null || targetWeight === null) return 0;

  const deltaKg = targetWeight - currentWeight;
  if (Math.abs(deltaKg) < 0.5) return 0;

  const magnitude = Math.min(320, Math.max(120, Math.round(Math.abs(deltaKg) * 28)));
  return deltaKg > 0 ? magnitude : -magnitude;
}

export function calculateAiNutritionBmr({ weight = 80, height = 180, age = 30, sex = "male" } = {}) {
  const safeWeight = Math.max(35, parseAiNutritionProfileNumber(weight) || 80);
  const safeHeight = Math.max(120, parseAiNutritionProfileNumber(height) || 180);
  const safeAge = Math.max(14, parseAiNutritionProfileNumber(age) || 30);

  return Math.round(10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + (sex === "female" ? -161 : 5));
}

export function calculatePersonalAiNutritionCalories(profile = {}) {
  const weight = parseAiNutritionProfileNumber(profile?.weight) || 80;
  const height = parseAiNutritionProfileNumber(profile?.height) || 180;
  const age = parseAiNutritionProfileNumber(profile?.age) || 30;
  const sex = profile?.sex || "male";
  const activity = profile?.activity || "medium";
  const goal = profile?.goal || "recomp";

  const bmr = calculateAiNutritionBmr({ weight, height, age, sex });
  const maintenance = Math.round(bmr * getAiNutritionActivityMultiplier(activity));
  const personalizedBase = maintenance;

  const targetAdjustment = calculateAiNutritionTargetCalorieAdjustment(profile);
  if (targetAdjustment) return Math.round(personalizedBase + targetAdjustment);

  if (goal === "mass") return Math.round(personalizedBase + 220);
  if (goal === "cut") return Math.round(personalizedBase - 320);
  if (goal === "dry") return Math.round(personalizedBase - 180);
  if (goal === "maintain") return Math.round(personalizedBase);
  return Math.round(personalizedBase - 120);
}
