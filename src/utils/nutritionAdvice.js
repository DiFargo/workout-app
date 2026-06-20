export function buildNutritionAdvice({ goals = {}, totals = {}, water = 0 } = {}) {
  const calorieLeft = (Number(goals.calories) || 0) - (Number(totals.calories) || 0);
  const proteinLeft = (Number(goals.protein) || 0) - (Number(totals.protein) || 0);
  const waterGoal = Number(goals.water);
  const waterLeft = (Number.isFinite(waterGoal) ? waterGoal : 0) - (Number(water) || 0);

  if ((Number(totals.calories) || 0) === 0) {
    return "Добавь первый приём пищи — и я покажу, чего не хватает по калориям, белку и воде.";
  }

  if (proteinLeft > 45) {
    return `Белка пока маловато: осталось примерно ${Math.ceil(proteinLeft)} г. Хороший вариант — курица, творог, рыба или протеин.`;
  }

  if (calorieLeft < 250 && proteinLeft > 15) {
    return "Калории почти закрыты, но белок ещё можно добрать чем-то лёгким: творог, йогурт или протеин.";
  }

  if (waterLeft > 700) {
    return "По еде всё неплохо. Воды сегодня маловато — добавь 1–2 стакана в ближайшее время.";
  }

  return "Отличный день по питанию. Держи белок стабильно — это хорошо поддержит прогресс в тренировках.";
}

export function buildNutritionSummaryCollapsedText({
  isCaloriesOverGoal = false,
  proteinPercent = 0,
  caloriePercent = 0
} = {}) {
  if (isCaloriesOverGoal) return "Калории выше плана, следующий прием сделай легче.";
  if (proteinPercent < 55) return "Белка пока мало, добавь белковый продукт.";
  if (caloriePercent < 45) return "День пока свободный, можно добавить прием пищи.";
  if (caloriePercent > 90) return "План почти закрыт, дальше без лишних перекусов.";
  return "День идет ровно, держим темп.";
}
