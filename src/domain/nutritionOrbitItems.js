export const NUTRITION_ORBIT_BASE_ITEMS = [
  {
    id: "calories",
    label: "\u041a\u0430\u043b\u043e\u0440\u0438\u0438",
    amountBuilder: ({ caloriesConsumed }) => `${String(caloriesConsumed)} \u043a\u043a\u0430\u043b`,
    targetBuilder: ({ effectiveNutritionGoals }) => `\u0438\u0437 ${effectiveNutritionGoals.calories} \u043a\u043a\u0430\u043b`,
    color: "#22c55e",
    startAngle: 324.3,
    arcDegrees: 74.6,
    progressKey: "caloriePercent"
  },
  {
    id: "protein",
    label: "\u0411\u0435\u043b\u043a\u0438",
    amountBuilder: ({ nutritionTotals, roundMacro }) => `${roundMacro(nutritionTotals.protein)} \u0433`,
    targetBuilder: ({ effectiveNutritionGoals }) => `\u0438\u0437 ${effectiveNutritionGoals.protein} \u0433`,
    color: "#EA5D61",
    startAngle: 63.2,
    arcDegrees: 56,
    progressKey: "proteinPercent"
  },
  {
    id: "carbs",
    label: "\u0423\u0433\u043b\u0435\u0432\u043e\u0434\u044b",
    amountBuilder: ({ nutritionTotals, roundMacro }) => `${roundMacro(nutritionTotals.carbs)} \u0433`,
    targetBuilder: ({ effectiveNutritionGoals }) => `\u0438\u0437 ${effectiveNutritionGoals.carbs} \u0433`,
    color: "#1f7df2",
    startAngle: 240.7,
    arcDegrees: 56.5,
    progressKey: "carbsPercent"
  },
  {
    id: "fat",
    label: "\u0416\u0438\u0440\u044b",
    amountBuilder: ({ nutritionTotals, roundMacro }) => `${roundMacro(nutritionTotals.fat)} \u0433`,
    targetBuilder: ({ effectiveNutritionGoals }) => `\u0438\u0437 ${effectiveNutritionGoals.fat} \u0433`,
    color: "#ffae27",
    startAngle: 141.6,
    arcDegrees: 74.7,
    progressKey: "fatPercent"
  }
];

export function buildNutritionOrbitItems(params) {
  const {
    nutritionTotals,
    effectiveNutritionGoals,
    caloriePercent,
    proteinPercent,
    carbsPercent,
    fatPercent,
    roundMacro,
    getNutritionOrbitSegment,
    caloriesConsumed
  } = params;

  const percentById = {
    calories: caloriePercent,
    protein: proteinPercent,
    carbs: carbsPercent,
    fat: fatPercent
  };

  return NUTRITION_ORBIT_BASE_ITEMS.map((item) => {
    const progress = Math.min(100, Math.max(0, percentById[item.id] || 0));

    return {
      ...item,
      amount: item.amountBuilder({
        nutritionTotals,
        effectiveNutritionGoals,
        roundMacro,
        caloriesConsumed
      }),
      target: item.targetBuilder({ effectiveNutritionGoals }),
      progress,
      segment: getNutritionOrbitSegment(item.startAngle, item.arcDegrees, progress)
    };
  });
}
