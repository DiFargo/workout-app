import { defaultNutritionState } from "../data/nutritionDefaults";
import { getAiNutritionHistoryBaseline } from "../data/aiNutritionBaseline";
import { starterPlan } from "../data/starterPlan";
import {
  getAiExerciseMuscles,
  getAiHistoryItems,
  getAiMuscleLoad
} from "../domain/workoutPresentation";
import {
  buildAiNutritionDayModel,
  getAiNutritionTotalsForToday
} from "./aiNutritionAnalysis";

export function buildAiCoachResult(featureId, { history = [], nutrition = defaultNutritionState, plan = starterPlan } = {}) {
  const historyItems = getAiHistoryItems(history);
  const lastWorkout = historyItems[0];
  const load14 = getAiMuscleLoad(historyItems, 14);
  const load7 = getAiMuscleLoad(historyItems, 7);
  const sortedLoad = Object.entries(load14).sort((a, b) => b[1] - a[1]);
  const heavyMuscle = sortedLoad[0]?.[0] || "нет данных";
  const lightMuscle = sortedLoad.at(-1)?.[0] || "нет данных";
  const lastWorkoutDays = lastWorkout
    ? Math.max(0, Math.round((Date.now() - lastWorkout.parsedDate.getTime()) / (24 * 60 * 60 * 1000)))
    : null;
  const todayTotals = getAiNutritionTotalsForToday(nutrition);
  const goals = nutrition.goals || defaultNutritionState.goals;
  const aiNutritionDayModel = buildAiNutritionDayModel(nutrition, null, history);
  const aiNutritionBaseline = getAiNutritionHistoryBaseline();
  const proteinLeft = Math.max(0, Math.round((Number(goals.protein) || 0) - todayTotals.protein));
  const caloriesLeft = Math.max(0, Math.round((Number(goals.calories) || 0) - todayTotals.calories));
  const workoutsCount = historyItems.length;
  const plannedExercises = (plan.workouts || []).flatMap((workout) => workout.exercises || []);
  const swapBase = plannedExercises.find((exercise) => getAiExerciseMuscles(exercise.name).includes(heavyMuscle)) || plannedExercises[0];

  const baseStats = {
    workoutsCount,
    lastWorkoutText: lastWorkoutDays === null ? "нет истории" : `${lastWorkoutDays} дн. назад`,
    heavyMuscle,
    caloriesLeft
  };

  const results = {
    liveCoach: {
      title: "AI-помощник на сегодня",
      status: lastWorkoutDays === null ? "Нужна первая история" : lastWorkoutDays <= 1 ? "Лёгкий контроль" : "Можно работать",
      score: lastWorkoutDays === null ? 45 : lastWorkoutDays <= 1 ? 68 : 86,
      bullets: [
        lastWorkoutDays === null
          ? "После 1–2 сохранённых тренировок подсказки станут точнее."
          : `Последняя тренировка была ${baseStats.lastWorkoutText}.`,
        heavyMuscle !== "нет данных"
          ? `Самая нагруженная зона за 14 дней: ${heavyMuscle}.`
          : "Пока мало данных по мышечным группам.",
        "Во время тренировки держи 1–2 повтора в запасе и не гонись за весом в первом подходе."
      ],
      actions: [
        "Начни с разминочного подхода 50–60% от рабочего веса.",
        "Если техника плывёт — снизь вес на 5–10%.",
        "Фиксируй реальные веса, чтобы AI точнее считал прогресс."
      ]
    },
    recovery: {
      title: "AI-анализ восстановления",
      status: lastWorkoutDays === null ? "Нет данных" : lastWorkoutDays <= 1 ? "Низкое восстановление" : lastWorkoutDays <= 3 ? "Нормально" : "Готов к нагрузке",
      score: lastWorkoutDays === null ? 40 : lastWorkoutDays <= 1 ? 58 : lastWorkoutDays <= 3 ? 78 : 90,
      bullets: [
        lastWorkoutDays === null ? "История тренировок пока пустая." : `Последняя тренировка: ${baseStats.lastWorkoutText}.`,
        Object.keys(load7).length ? `За 7 дней больше всего работали: ${Object.entries(load7).sort((a, b) => b[1] - a[1])[0][0]}.` : "За неделю нагрузка не найдена.",
        proteinLeft > 0 ? `По белку сегодня осталось примерно ${proteinLeft} г.` : "Белок сегодня выглядит закрытым."
      ],
      actions: [
        lastWorkoutDays !== null && lastWorkoutDays <= 1 ? "Сегодня не делай отказные подходы." : "Можно планировать обычную силовую работу.",
        "Добавь 7–10 минут разминки и 1 лёгкий подход на первое упражнение.",
        "Если сон/энергия плохие — оставь RPE около 7/10."
      ]
    },
    muscleProgram: {
      title: "AI-подбор программы под мышцы",
      status: lightMuscle !== "нет данных" ? `Фокус: ${lightMuscle}` : "Нужна история",
      score: workoutsCount ? 82 : 46,
      bullets: [
        lightMuscle !== "нет данных" ? `Меньше всего нагрузки за 14 дней получила зона: ${lightMuscle}.` : "Пока мало сохранённых тренировок для точного выбора.",
        heavyMuscle !== "нет данных" ? `${heavyMuscle} лучше не перегружать в следующей тренировке.` : "После истории AI будет сравнивать мышцы.",
        `В текущем плане найдено упражнений: ${plannedExercises.length}.`
      ],
      actions: [
        lightMuscle !== "нет данных" ? `Следующую тренировку начни с акцента на ${lightMuscle}.` : "Сохрани 2–3 тренировки для персонального подбора.",
        "Оставь 4–6 рабочих упражнений без лишнего объёма.",
        "На отстающую группу дай 1 дополнительный качественный подход."
      ]
    },
    nutritionPlan: {
      title: "AI-план питания",
      status: `${aiNutritionDayModel.score}/10 · база ${aiNutritionBaseline.average.calories} ккал`,
      score: Math.round(aiNutritionDayModel.score * 10),
      bullets: [
        aiNutritionDayModel.summary,
        `Твоя база март–апрель: ${aiNutritionBaseline.average.calories} ккал · Б ${Math.round(aiNutritionBaseline.average.protein)} · Ж ${Math.round(aiNutritionBaseline.average.fat)} · У ${Math.round(aiNutritionBaseline.average.carbs)}.`,
        `Сегодня получено: ${Math.round(todayTotals.calories)} ккал из ${goals.calories}.`
      ],
      actions: [
        aiNutritionDayModel.adaptiveAdvice,
        aiNutritionDayModel.weeklyText,
        proteinLeft > 0 ? `Добери белок: примерно ${proteinLeft} г.` : "Белок закрыт — держи баланс по жирам и углеводам."
      ]
    },
    motivation: {
      title: "AI-мотивация перед тренировкой",
      status: "Готов к залу",
      score: 92,
      bullets: [
        "Сегодня задача не доказать всем, а сделать свою работу чисто.",
        "Три качественных подхода лучше, чем хаотичная гонка за весом.",
        "Запиши каждый рабочий вес — это топливо для прогресса."
      ],
      actions: [
        "Разминка → первый рабочий подход → контроль техники.",
        "Не пропускай последнее упражнение, но не доводи технику до развала.",
        "После тренировки сохрани результат сразу."
      ]
    },
    progress: {
      title: "AI-анализ прогресса",
      status: workoutsCount ? `${workoutsCount} тренировок в истории` : "Нет истории",
      score: Math.min(94, 42 + workoutsCount * 8),
      bullets: [
        workoutsCount ? `Сохранённых тренировок: ${workoutsCount}.` : "История пока пустая.",
        lastWorkout ? `Последняя тренировка: ${lastWorkout.workout || "тренировка"}.` : "Сохрани тренировку, чтобы увидеть динамику.",
        sortedLoad.length ? `Главный объём сейчас идёт в: ${heavyMuscle}.` : "AI пока не видит распределение нагрузки."
      ],
      actions: [
        "Следи за ростом веса только при сохранении техники.",
        "Если 2 тренировки подряд легко — добавь 2,5–5 кг или 1–2 повтора.",
        "Не меняй программу слишком часто: дай ей 3–4 недели данных."
      ]
    },
    overload: {
      title: "AI-оценка перегрузки мышц",
      status: sortedLoad[0]?.[1] >= 18 ? `Риск: ${heavyMuscle}` : "Риск умеренный",
      score: sortedLoad[0]?.[1] >= 18 ? 62 : 84,
      bullets: [
        sortedLoad.length ? `${heavyMuscle}: ${sortedLoad[0][1]} подходов за 14 дней.` : "Нет данных для оценки перегрузки.",
        sortedLoad[1] ? `${sortedLoad[1][0]}: ${sortedLoad[1][1]} подходов.` : "Нужно больше истории для сравнения.",
        "AI считает риск по частоте и объёму, без медицинской диагностики."
      ],
      actions: [
        sortedLoad[0]?.[1] >= 18 ? `На ${heavyMuscle} сегодня убери 1–2 подхода.` : "Текущий объём выглядит адекватно.",
        "Боль в суставе — сигнал заменить упражнение, не терпеть.",
        "Сохраняй веса и подходы, чтобы оценка была точнее."
      ]
    },
    swap: {
      title: "AI-автозамена упражнений",
      status: swapBase ? "Замены готовы" : "Нет упражнений",
      score: swapBase ? 80 : 40,
      bullets: [
        swapBase ? `Базовое упражнение для замены: ${swapBase.name}.` : "В плане не найдены упражнения.",
        heavyMuscle !== "нет данных" ? `Если устала зона ${heavyMuscle}, выбирай более лёгкий аналог.` : "После истории замены будут точнее.",
        "Замена должна сохранять мышечную группу, но снижать риск и дискомфорт."
      ],
      actions: [
        "Жим → тренажёр/гантели с меньшим весом.",
        "Тяга → вариант с опорой грудью или блочный тренажёр.",
        "Ноги → тренажёр вместо свободного веса, если устала поясница."
      ]
    }
  };

  return results[featureId] || results.liveCoach;
}
