export const AI_NUTRITION_HISTORY_BASELINE = {
  source: "FatSecret · март–апрель 2026",
  months: [
    {
      id: "2026-03",
      label: "Март 2026",
      days: 31,
      average: { calories: 2419, fat: 67.42, carbs: 244.52, protein: 212.15 },
      meals: {
        breakfast: { calories: 926, fat: 32.31, carbs: 88.08, protein: 73.98 },
        lunch: { calories: 675, fat: 16.61, carbs: 75.43, protein: 56.74 },
        dinner: { calories: 528, fat: 14.26, carbs: 51.44, protein: 47.24 },
        snack: { calories: 290, fat: 4.24, carbs: 29.57, protein: 34.2 }
      }
    },
    {
      id: "2026-04",
      label: "Апрель 2026",
      days: 30,
      average: { calories: 2329, fat: 65.27, carbs: 234.86, protein: 208.26 },
      meals: {
        breakfast: { calories: 951, fat: 31.74, carbs: 87.94, protein: 81.41 },
        lunch: { calories: 777, fat: 20.94, carbs: 81.72, protein: 68.38 },
        dinner: { calories: 442, fat: 9.74, carbs: 47.52, protein: 42.52 },
        snack: { calories: 159, fat: 2.84, carbs: 17.68, protein: 15.96 }
      }
    }
  ],
  average: { calories: 2374, fat: 66.35, carbs: 239.69, protein: 210.21 },
  meals: {
    breakfast: { calories: 939, fat: 32.03, carbs: 88.01, protein: 77.7 },
    lunch: { calories: 726, fat: 18.78, carbs: 78.58, protein: 62.56 },
    dinner: { calories: 485, fat: 12.0, carbs: 49.48, protein: 44.88 },
    snack: { calories: 225, fat: 3.54, carbs: 23.63, protein: 25.08 }
  },
  patterns: [
    "Белок исторически высокий: около 210 г/день.",
    "Калории в среднем держались около 2370 ккал/день.",
    "Самый плотный приём пищи — завтрак, дальше идёт обед.",
    "Ужин обычно легче завтрака и обеда.",
    "Частые продукты: творог, яйца, Флэт Уайт, Exponenta/High-Pro, бананы, хлеб fitness, лёгкий сыр, индейка/вырезка, овощи."
  ]
};

export function getAiNutritionHistoryBaseline() {
  return AI_NUTRITION_HISTORY_BASELINE;
}
