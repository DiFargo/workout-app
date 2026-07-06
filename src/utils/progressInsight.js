const DAY_MS = 24 * 60 * 60 * 1000;

function timestampOf(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function daysSince(value, now) {
  const timestamp = timestampOf(value);
  if (!timestamp) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
}

function maxExerciseWeight(exercise = {}) {
  return Math.max(
    0,
    ...(Array.isArray(exercise.sets) ? exercise.sets : [])
      .filter((set) => set?.completed !== false)
      .map((set) => Number(String(set?.weight ?? set?.enteredWeight ?? "").replace(",", ".")))
      .filter((weight) => Number.isFinite(weight) && weight > 0)
  );
}

function normalizeExerciseName(name = "") {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

function findWorkoutProgress(history = []) {
  const sortedHistory = [...(Array.isArray(history) ? history : [])]
    .filter((item) => timestampOf(item?.date || item?.completedAt || item?.createdAt))
    .sort((a, b) => (
      timestampOf(b?.date || b?.completedAt || b?.createdAt) -
      timestampOf(a?.date || a?.completedAt || a?.createdAt)
    ));
  const latest = sortedHistory[0];
  if (!latest) return null;

  let bestProgress = null;
  (latest.exercises || []).forEach((exercise) => {
    const nameKey = normalizeExerciseName(exercise?.name);
    const latestWeight = maxExerciseWeight(exercise);
    if (!nameKey || !latestWeight) return;

    const previousExercise = sortedHistory
      .slice(1)
      .flatMap((workout) => workout.exercises || [])
      .find((item) => normalizeExerciseName(item?.name) === nameKey && maxExerciseWeight(item) > 0);
    if (!previousExercise) return;

    const increase = latestWeight - maxExerciseWeight(previousExercise);
    if (increase > 0 && (!bestProgress || increase > bestProgress.increase)) {
      bestProgress = {
        exercise: exercise.name || "упражнении",
        increase,
        latestWeight
      };
    }
  });

  return bestProgress;
}

function formatIncrease(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function getTodayNutrition(nutrition = {}, now = new Date()) {
  const key = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  const day = nutrition.days?.[key] || {};
  return (day.foods || []).reduce(
    (totals, food) => ({
      calories: totals.calories + (Number(food?.calories) || 0),
      protein: totals.protein + (Number(food?.protein) || 0),
      count: totals.count + 1
    }),
    { calories: 0, protein: 0, count: 0 }
  );
}

function dateKey(value) {
  const timestamp = timestampOf(value);
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getNutritionTotals(day = {}) {
  return (day.foods || []).reduce(
    (totals, food) => ({
      calories: totals.calories + (Number(food?.calories) || 0),
      protein: totals.protein + (Number(food?.protein) || 0)
    }),
    { calories: 0, protein: 0 }
  );
}

function getMeasurementValue(measurement, keys) {
  for (const key of keys) {
    const value = Number(String(measurement?.[key] ?? "").replace(",", "."));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function scoreWorkoutProgress(history, now, scheduledDates = []) {
  const recent = history.filter((item) => {
    const days = daysSince(item?.date || item?.completedAt || item?.createdAt, now);
    return days !== null && days <= 28;
  });
  if (!recent.length) return null;

  const lastDays = daysSince(
    recent[0]?.date || recent[0]?.completedAt || recent[0]?.createdAt,
    now
  );
  const recency = lastDays <= 3 ? 100 : lastDays <= 7 ? 82 : lastDays <= 14 ? 58 : 32;
  const pastScheduled = new Set(
    scheduledDates
      .filter((key) => {
        const timestamp = timestampOf(key);
        const days = daysSince(key, now);
        return timestamp && timestamp <= now.getTime() && days !== null && days <= 28;
      })
  );
  const completedKeys = new Set(recent.map((item) => dateKey(
    item?.date || item?.completedAt || item?.createdAt
  )));
  const frequency = pastScheduled.size
    ? [...pastScheduled].filter((key) => completedKeys.has(key)).length / pastScheduled.size * 100
    : Math.min(100, 35 + recent.length / 8 * 65);
  const strengthBonus = findWorkoutProgress(history) ? 8 : 0;

  return {
    id: "workouts",
    label: "Тренировки",
    weight: 40,
    score: clampScore(recency * 0.55 + frequency * 0.45 + strengthBonus),
    detail: findWorkoutProgress(history)
      ? "нагрузка растёт"
      : recent.length >= 2
        ? "ритм сохраняется"
        : "нужна регулярность"
  };
}

function scoreNutritionProgress(nutrition, calorieGoal, proteinGoal, now) {
  if (!(calorieGoal > 0) && !(proteinGoal > 0)) return null;

  const days = Object.entries(nutrition.days || {})
    .map(([key, day]) => ({ key, day, age: daysSince(key, now) }))
    .filter((item) => item.age !== null && item.age >= 0 && item.age <= 13 && item.day?.foods?.length);
  if (!days.length) return null;

  const qualityScores = days.map(({ day }) => {
    const totals = getNutritionTotals(day);
    const calorieRatio = calorieGoal > 0 ? totals.calories / calorieGoal : 1;
    const proteinRatio = proteinGoal > 0 ? totals.protein / proteinGoal : 1;
    const calorieScore = calorieRatio >= 0.85 && calorieRatio <= 1.1
      ? 100
      : calorieRatio >= 0.7 && calorieRatio <= 1.2
        ? 72
        : calorieRatio >= 0.5 && calorieRatio <= 1.35
          ? 48
          : 25;
    const proteinScore = proteinRatio >= 0.9 ? 100 : proteinRatio >= 0.7 ? 78 : proteinRatio >= 0.5 ? 52 : 28;
    return calorieScore * 0.58 + proteinScore * 0.42;
  });
  const quality = qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length;
  const coverage = Math.min(100, days.length / 7 * 100);

  return {
    id: "nutrition",
    label: "Питание",
    weight: 25,
    score: clampScore(quality * 0.82 + coverage * 0.18),
    detail: quality >= 82 ? "близко к плану" : quality >= 62 ? "есть отклонения" : "нужна корректировка"
  };
}

function scoreMeasurementProgress(measurements, goal, now) {
  const sorted = [...measurements]
    .filter((item) => timestampOf(item?.date || item?.createdAt || item?.savedAt))
    .sort((a, b) => (
      timestampOf(b?.date || b?.createdAt || b?.savedAt) -
      timestampOf(a?.date || a?.createdAt || a?.savedAt)
    ));
  if (!sorted.length) return null;

  const latest = sorted[0];
  const previous = sorted.find((item, index) => {
    if (index === 0) return false;
    const latestTime = timestampOf(latest?.date || latest?.createdAt || latest?.savedAt);
    const itemTime = timestampOf(item?.date || item?.createdAt || item?.savedAt);
    return latestTime - itemTime >= 5 * DAY_MS;
  }) || sorted[1];
  const latestDays = daysSince(latest?.date || latest?.createdAt || latest?.savedAt, now);
  const freshness = latestDays <= 7 ? 100 : latestDays <= 14 ? 80 : latestDays <= 28 ? 55 : 30;
  if (!previous) {
    return {
      id: "measurements",
      label: "Замеры",
      weight: 25,
      score: clampScore(freshness * 0.8 + 14),
      detail: "нужен второй замер"
    };
  }

  const latestWeight = getMeasurementValue(latest, ["weight"]);
  const previousWeight = getMeasurementValue(previous, ["weight"]);
  const latestWaist = getMeasurementValue(latest, ["belly", "waist"]);
  const previousWaist = getMeasurementValue(previous, ["belly", "waist"]);
  const weightDelta = latestWeight && previousWeight ? latestWeight - previousWeight : 0;
  const waistDelta = latestWaist && previousWaist ? latestWaist - previousWaist : 0;
  let trend;

  if (goal === "mass") trend = weightDelta > 0 && weightDelta <= 2 ? 100 : weightDelta > 2 ? 62 : 70;
  else if (goal === "cut" || goal === "dry") {
    trend = waistDelta < 0 || weightDelta < 0 ? 100 : waistDelta > 1 || weightDelta > 1 ? 45 : 76;
  } else if (goal === "maintain") {
    trend = Math.abs(weightDelta) <= 1 && Math.abs(waistDelta) <= 1 ? 100 : 62;
  } else {
    trend = waistDelta < 0
      ? 100
      : Math.abs(weightDelta) <= 1 && waistDelta <= 0.5
        ? 88
        : waistDelta > 1
          ? 48
          : 72;
  }

  return {
    id: "measurements",
    label: "Замеры",
    weight: 25,
    score: clampScore(freshness * 0.45 + trend * 0.55),
    detail: trend >= 86 ? "динамика по цели" : trend >= 65 ? "динамика стабильна" : "проверь тенденцию"
  };
}

function scoreDataConsistency(history, nutrition, measurements, now) {
  const activeDays = new Set();
  history.forEach((item) => {
    const value = item?.date || item?.completedAt || item?.createdAt;
    const age = daysSince(value, now);
    if (age !== null && age <= 13) activeDays.add(dateKey(value));
  });
  Object.entries(nutrition.days || {}).forEach(([key, day]) => {
    const age = daysSince(key, now);
    if (age !== null && age <= 13 && day?.foods?.length) activeDays.add(key);
  });
  measurements.forEach((item) => {
    const value = item?.date || item?.createdAt || item?.savedAt;
    const age = daysSince(value, now);
    if (age !== null && age <= 13) activeDays.add(dateKey(value));
  });
  if (!activeDays.size) return null;

  return {
    id: "consistency",
    label: "Регулярность",
    weight: 10,
    score: clampScore(45 + Math.min(55, activeDays.size / 7 * 55)),
    detail: activeDays.size >= 7 ? "данные ведутся стабильно" : "добавляй записи чаще"
  };
}

export function buildProgressScore({
  history = [],
  measurements = [],
  nutrition = {},
  calorieGoal = 0,
  proteinGoal = 0,
  scheduledDates = [],
  goal = "recomp",
  now = new Date()
} = {}) {
  const sortedHistory = [...(Array.isArray(history) ? history : [])]
    .sort((a, b) => (
      timestampOf(b?.date || b?.completedAt || b?.createdAt) -
      timestampOf(a?.date || a?.completedAt || a?.createdAt)
    ));
  const safeMeasurements = Array.isArray(measurements) ? measurements : [];
  const components = [
    scoreWorkoutProgress(sortedHistory, now, Array.isArray(scheduledDates) ? scheduledDates : []),
    scoreNutritionProgress(nutrition, calorieGoal, proteinGoal, now),
    scoreMeasurementProgress(safeMeasurements, goal, now),
    scoreDataConsistency(sortedHistory, nutrition, safeMeasurements, now)
  ].filter(Boolean);
  const availableWeight = components.reduce((sum, component) => sum + component.weight, 0);

  if (!availableWeight) {
    return {
      score: null,
      label: "Нет оценки",
      summary: "Добавь тренировку, питание или замер.",
      confidence: 0,
      components: []
    };
  }

  const score = clampScore(
    components.reduce((sum, component) => sum + component.score * component.weight, 0) /
    availableWeight
  );
  const weakest = [...components].sort((a, b) => a.score - b.score)[0];
  const strongest = [...components].sort((a, b) => b.score - a.score)[0];
  const label = score >= 85 ? "Отличный темп" : score >= 70 ? "Хороший прогресс" : score >= 55 ? "Стабильный старт" : "Нужно выровнять режим";
  const summary = weakest.score < 65
    ? `${strongest.label}: ${strongest.detail}. Фокус: ${weakest.label.toLowerCase()}.`
    : `${strongest.label}: ${strongest.detail}. Продолжай в том же ритме.`;

  return {
    score,
    label,
    summary,
    confidence: Math.round(availableWeight),
    components
  };
}

export function buildProgressInsight({
  history = [],
  measurements = [],
  nutrition = {},
  calorieGoal = 0,
  proteinGoal = 0,
  scheduledDates = [],
  goal = "recomp",
  now = new Date()
} = {}) {
  const sortedHistory = [...(Array.isArray(history) ? history : [])]
    .sort((a, b) => (
      timestampOf(b?.date || b?.completedAt || b?.createdAt) -
      timestampOf(a?.date || a?.completedAt || a?.createdAt)
    ));
  const lastWorkout = sortedHistory[0];
  const lastWorkoutDays = daysSince(
    lastWorkout?.date || lastWorkout?.completedAt || lastWorkout?.createdAt,
    now
  );
  const workoutProgress = findWorkoutProgress(sortedHistory);

  const latestMeasurement = [...(Array.isArray(measurements) ? measurements : [])]
    .sort((a, b) => (
      timestampOf(b?.date || b?.createdAt || b?.savedAt) -
      timestampOf(a?.date || a?.createdAt || a?.savedAt)
    ))[0];
  const measurementDays = daysSince(
    latestMeasurement?.date || latestMeasurement?.createdAt || latestMeasurement?.savedAt,
    now
  );

  const todayNutrition = getTodayNutrition(nutrition, now);
  const calorieRatio = calorieGoal > 0 ? todayNutrition.calories / calorieGoal : 0;
  const proteinRatio = proteinGoal > 0 ? todayNutrition.protein / proteinGoal : 0;
  const caloriesOver = calorieGoal > 0
    ? Math.max(0, Math.round(todayNutrition.calories - calorieGoal))
    : 0;
  const progressScore = buildProgressScore({
    history: sortedHistory,
    measurements,
    nutrition,
    calorieGoal,
    proteinGoal,
    scheduledDates,
    goal,
    now
  });
  const withScore = (insight) => ({
    ...insight,
    score: progressScore.score,
    scoreLabel: progressScore.label,
    scoreSummary: progressScore.summary,
    scoreConfidence: progressScore.confidence,
    scoreComponents: progressScore.components
  });

  const statuses = [
    workoutProgress && lastWorkoutDays !== null && lastWorkoutDays <= 2
      ? { icon: "📈", title: "Сила", text: `+${formatIncrease(workoutProgress.increase)} кг` }
      : lastWorkoutDays === null
        ? { icon: "🏁", title: "Тренировка", text: "нет данных" }
        : { icon: "⚡", title: "Тренировка", text: lastWorkoutDays === 0 ? "сегодня" : `${lastWorkoutDays} дн. назад` },
    measurementDays === null
      ? { icon: "📏", title: "Замер", text: "нет данных" }
      : { icon: "📏", title: "Замер", text: measurementDays === 0 ? "сегодня" : measurementDays <= 7 ? `${measurementDays} дн. назад` : "пора обновить" },
    todayNutrition.count === 0
      ? { icon: "🍽️", title: "Питание", text: "нет записей" }
      : calorieRatio > 1.1
        ? { icon: "🍽️", title: "Питание", text: `+${caloriesOver} ккал` }
        : calorieRatio >= 0.8 && calorieRatio <= 1.1
          ? { icon: "🍽️", title: "Питание", text: proteinRatio >= 0.7 ? "по плану" : "добрать белок" }
          : { icon: "🍽️", title: "Питание", text: "день в процессе" }
  ];

  if (workoutProgress && lastWorkoutDays !== null && lastWorkoutDays <= 2) {
    return withScore({
      tone: "positive",
      title: "Рабочий вес вырос 💪",
      description: `+${formatIncrease(workoutProgress.increase)} кг в упражнении «${workoutProgress.exercise}». Отличная работа.`,
      statuses
    });
  }

  if (measurementDays === 0) {
    return withScore({
      tone: "positive",
      title: "Новый замер добавлен 📏",
      description: "Динамика обновлена. Следующий замер лучше сделать через неделю.",
      statuses
    });
  }

  if (todayNutrition.count > 0 && calorieRatio > 1.1) {
    return withScore({
      tone: "supportive",
      title: "Сегодня выше плана",
      description: `Примерно +${caloriesOver} ккал. Ничего страшного — завтра вернись к обычному рациону.`,
      statuses
    });
  }

  if (todayNutrition.count > 0 && calorieRatio >= 0.8 && calorieRatio <= 1.1 && proteinRatio >= 0.7) {
    return withScore({
      tone: "positive",
      title: "Питание по плану 🍽️",
      description: "Калории и белок в хорошем диапазоне. Продолжай так же.",
      statuses
    });
  }

  if (lastWorkoutDays !== null && lastWorkoutDays <= 2) {
    return withScore({
      tone: "positive",
      title: "Тренировка выполнена ⚡",
      description: "Хороший ритм. Восстановись и продолжай по плану.",
      statuses
    });
  }

  if (measurementDays !== null && measurementDays > 10) {
    return withScore({
      tone: "neutral",
      title: "Пора сделать замер",
      description: "Измерь показатели утром — так динамика будет точнее.",
      statuses
    });
  }

  if (lastWorkoutDays === null) {
    return withScore({
      tone: "neutral",
      title: "Начни отслеживать прогресс",
      description: "Добавь тренировку, замер или питание — здесь появится оценка.",
      statuses
    });
  }

  return withScore({
    tone: "neutral",
    title: "Продолжай по плану",
    description: "Регулярно отмечай тренировки, питание и замеры.",
    statuses
  });
}
