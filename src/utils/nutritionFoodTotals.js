export function sumNutritionFoods(foods = [], includeCount = false) {
  return (Array.isArray(foods) ? foods : []).reduce(
    (sum, food) => ({
      calories: sum.calories + (Number(food.calories) || 0),
      protein: sum.protein + (Number(food.protein) || 0),
      fat: sum.fat + (Number(food.fat) || 0),
      carbs: sum.carbs + (Number(food.carbs) || 0),
      ...(includeCount ? { count: sum.count + 1 } : {})
    }),
    includeCount
      ? { calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 }
      : { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}
