const amount = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const rounded = value => Math.round(amount(value));
const localDateKey = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};

// One decision tree for the card, detailed analysis and legacy tips.
// Observations about the diary are not a diagnosis of dietary quality.
export function buildNutritionDayFeedback({ goals = {}, totals = {}, dateKey = "", todayKey = localDateKey() } = {}) {
  const calories = amount(totals.calories);
  const target = amount(goals.calories);
  const hasData = ["calories", "protein", "fat", "carbs"].some(key => amount(totals[key]) > 0);
  const period = dateKey && dateKey < todayKey ? "past" : dateKey && dateKey > todayKey ? "future" : "today";
  const difference = Math.round(calories - target);
  const calorieRatio = target > 0 ? calories / target : 0;
  const macro = key => {
    const goal = amount(goals[key]);
    const value = amount(totals[key]);
    return { goal, value, ratio: goal > 0 ? value / goal : null, delta: Math.round(value - goal) };
  };
  const protein = macro("protein");
  const fat = macro("fat");
  const carbs = macro("carbs");
  const proteinLow = protein.ratio !== null && protein.ratio < 0.9;
  const fatHigh = fat.ratio !== null && fat.ratio > 1.1;
  const carbsLow = carbs.ratio !== null && carbs.ratio < 0.9;
  const feedback = (state, summary, advice, badges = [], collapsed = summary) => ({
    state, period, summary, adaptiveAdvice: advice, collapsedText: collapsed, badges,
    hasEnoughDataForScore: hasData && target > 0 && period !== "future" && (period === "past" || calorieRatio >= 0.9)
  });

  if (!hasData) return feedback("empty",
    period === "past" ? "За этот день нет записей о еде." : period === "future" ? "На эту дату пока нет записей." : "Пока нет записей о еде.",
    period === "past" ? "Если помнишь, что ел, добавь продукты. Отсутствие записей не означает, что ты не ел."
      : "Добавь первый приём пищи — появится сравнение с твоими целями. По пустому дневнику нельзя оценить питание.",
    [{ type: "info", text: "Нет данных" }]);
  if (!target) return feedback("no-target", "В дневнике " + rounded(calories) + " ккал.",
    "Задай дневной ориентир в плане питания, чтобы сравнивать записи с целью.", [{ type: "info", text: "Цель не задана" }]);
  if (period === "future") return feedback("future", "На выбранную дату записано " + rounded(calories) + " из " + rounded(target) + " ккал.",
    "Это предварительные записи, а не итог дня. После еды уточни фактические продукты и порции.", [{ type: "info", text: "Будущая дата" }]);

  const macroFacts = [];
  const badges = [];
  if (protein.goal) {
    if (proteinLow) {
      macroFacts.push("белка записано " + rounded(protein.value) + " из " + rounded(protein.goal) + " г");
      badges.push({ type: "info", text: "Белок ниже ориентира" });
    } else if (protein.ratio <= 1.1) {
      macroFacts.push("белок близко к цели");
      badges.push({ type: "good", text: "Белок близко к цели" });
    } else {
      macroFacts.push("белок выше ориентира на " + protein.delta + " г");
      badges.push({ type: "info", text: "Белок выше ориентира" });
    }
  }
  if (fatHigh) {
    macroFacts.push("жиры выше ориентира на " + fat.delta + " г");
    badges.push({ type: "info", text: "Жиры выше ориентира" });
  }
  const facts = macroFacts.length ? " " + macroFacts.join("; ").replace(/^./, char => char.toUpperCase()) + "." : "";
  const nextDays = proteinLow
    ? "В следующие дни распределяй белковые продукты между основными приёмами пищи."
    : fatHigh
      ? "При следующем планировании обрати внимание на порции масла, соусов и других жирных добавок."
      : "Продолжай обычный план: по одному дню нельзя судить о результате.";

  if (difference > 0) return feedback("over-target",
    "По записям — на " + difference + " ккал выше цели." + facts,
    "Не нужно есть дополнительно только ради цифр БЖУ или компенсировать этот день голоданием. " + nextDays,
    [{ type: "info", text: "Калории выше цели" }, ...badges],
    "На " + difference + " ккал выше цели. " + (proteinLow ? "Белок ниже ориентира — учтём при планировании следующих дней." : "Добирать БЖУ ради цифр не нужно."));
  if (difference === 0) return feedback("at-target",
    "Цель по калориям достигнута: " + rounded(calories) + " ккал." + facts,
    "Необязательно доводить каждый показатель БЖУ до точного числа. " + nextDays,
    [{ type: "good", text: "Цель по калориям достигнута" }, ...badges],
    "Цель по калориям достигнута. " + (proteinLow ? "Белок ниже ориентира — это подсказка для следующих дней." : "Необязательно добирать каждый грамм БЖУ."));
  if (calorieRatio >= 0.95) return feedback("near-target",
    "Калории близко к цели: " + rounded(calories) + " из " + rounded(target) + " ккал." + facts,
    "Разница — около " + Math.abs(difference) + " ккал. Не нужно стремиться к точному совпадению; учитывай также голод и самочувствие.",
    [{ type: "good", text: "Калории близко к цели" }, ...badges],
    "Калории близко к цели. Точное совпадение по каждому показателю не требуется.");

  if (period === "past") return feedback("past-below-target",
    "За этот день записано " + rounded(calories) + " из " + rounded(target) + " ккал — на " + Math.abs(difference) + " ккал ниже цели." + facts,
    "Сначала проверь, внесены ли все приёмы пищи. Если дневник полный, " + (proteinLow ? "при планировании следующих дней удели внимание белковым продуктам." : "сравни несколько дней, прежде чем менять план.") + " Не нужно доедать за прошлый день.",
    [{ type: "info", text: "Итог по записям" }, ...badges],
    "За этот день записано на " + Math.abs(difference) + " ккал меньше цели. Проверь полноту дневника.");

  let advice = "Если ещё будешь есть, запиши обычный приём пищи. Итог имеет смысл оценивать после всех записей за день.";
  if (proteinLow) advice = "Если планируешь ещё приём пищи, включи источник белка — например, рыбу, птицу, творог или бобовые." + (fatHigh ? " Жиры уже выше ориентира: можно обойтись без дополнительных жирных соусов и масла." : "");
  else if (fatHigh) advice = "Если ещё будешь есть, выбирай обычный приём пищи с меньшим количеством жирных добавок. Не нужно пропускать еду для компенсации.";
  else if (carbsLow) advice = "Если планируешь ещё приём пищи, источником углеводов могут быть крупы, картофель или фрукты. Необязательно закрывать каждый грамм цели.";
  return feedback("in-progress", "В дневнике " + rounded(calories) + " из " + rounded(target) + " ккал." + facts,
    advice, [{ type: "info", text: "По текущим записям" }, ...badges],
    "Записано " + rounded(calories) + " из " + rounded(target) + " ккал. " + (proteinLow ? "Если ещё будешь есть, включи источник белка." : "Это промежуточный итог, не оценка всего дня."));
}

export function buildNutritionAdvice(options = {}) {
  const result = buildNutritionDayFeedback(options);
  return result.summary + " " + result.adaptiveAdvice;
}

export function buildNutritionSummaryCollapsedText(options = {}) {
  return buildNutritionDayFeedback(options).collapsedText;
}
