export const NUTRITION_ORBIT_BASE_ITEMS = [
  {
    id: "calories",
    label: "???????",
    amountBuilder: ({ caloriesConsumed, effectiveNutritionGoals }) => String(caloriesConsumed),
    targetBuilder: ({ effectiveNutritionGoals }) => `?? ${effectiveNutritionGoals.calories} ????`,
    color: "#22c55e",
    startAngle: 324.3,
    arcDegrees: 74.6,
    progressKey: "caloriePercent"
  },
  {
    id: "protein",
    label: "?????",
    amountBuilder: ({ nutritionTotals, roundMacro }) => `${roundMacro(nutritionTotals.protein)} ?`,
    targetBuilder: ({ effectiveNutritionGoals }) => `?? ${effectiveNutritionGoals.protein} ?`,
    color: "#EA5D61",
    startAngle: 63.2,
    arcDegrees: 56,
    progressKey: "proteinPercent"
  },
  {
    id: "carbs",
    label: "????????",
    amountBuilder: ({ nutritionTotals, roundMacro }) => `${roundMacro(nutritionTotals.carbs)} ?`,
    targetBuilder: ({ effectiveNutritionGoals }) => `?? ${effectiveNutritionGoals.carbs} ?`,
    color: "#1f7df2",
    startAngle: 240.7,
    arcDegrees: 56.5,
    progressKey: "carbsPercent"
  },
  {
    id: "fat",
    label: "????",
    amountBuilder: ({ nutritionTotals, roundMacro }) => `${roundMacro(nutritionTotals.fat)} ?`,
    targetBuilder: ({ effectiveNutritionGoals }) => `?? ${effectiveNutritionGoals.fat} ?`,
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
