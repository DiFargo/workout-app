export function getAiNutritionGoalLabel(goal) {
  if (goal === "mass") return "Набор массы";
  if (goal === "cut") return "Похудение";
  if (goal === "dry") return "Сушка";
  if (goal === "maintain") return "Поддержка";
  if (goal === "recomp") return "Рекомпозиция";
  return "Рекомпозиция";
}

export function getAiNutritionGoalShort(goal) {
  if (goal === "mass") return "набор";
  if (goal === "cut") return "похудение";
  if (goal === "dry") return "сушка";
  if (goal === "maintain") return "поддержка";
  if (goal === "recomp") return "рекомпозиция";
  return "рекомпозиция";
}

export function getAiNutritionTrainingDayAdvice(isTrainingDay, goal = "recomp") {
  if (!isTrainingDay) {
    return "День без тренировки: держи обычные КБЖУ, не перегружай жиры вечером и оставь питание ровным.";
  }

  if (goal === "dry") {
    return "Тренировочный день на сушке: белок держим высоким, углеводы лучше поставить до/после тренировки, жиры не повышать.";
  }

  if (goal === "cut") {
    return "Тренировочный день в дефиците: добавь часть углеводов до/после зала, чтобы тренировка не просела.";
  }

  if (goal === "mass") {
    return "Тренировочный день на наборе: держи небольшой профицит и добавь углеводы вокруг тренировки.";
  }

  if (goal === "maintain") {
    return "Тренировочный день на поддержке: держи калории ровно, небольшой углеводный акцент до/после зала без общего профицита.";
  }

  return "Тренировочный день на рекомпозиции: белок выше, углеводы вокруг тренировки, лёгкий дефицит в дни отдыха.";
}

export function getAiNutritionActivityLabel(activity = "medium") {
  if (activity === "low") return "низкая активность";
  if (activity === "high") return "высокая активность";
  if (activity === "veryHigh") return "очень высокая активность";
  return "средняя активность";
}
