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
