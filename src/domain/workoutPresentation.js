export function getWorkoutCover(workout) {
  const coverRules = [
    { file: "/workout-covers/legs.webp", patterns: [/жим\s+ног/] },
    { file: "/workout-covers/lunges.webp", patterns: [/выпад/] },
    { file: "/workout-covers/tbar_row.webp", patterns: [/т[-\s]?гриф|t[-\s]?bar/] },
    { file: "/workout-covers/bent.webp", patterns: [/тяг.{0,30}(?:в\s+наклон|наклон)|bent\s*row/] },
    { file: "/workout-covers/incline_smith_press.webp", patterns: [/жим.{0,30}(?:в\s+смит|смит)|наклонн.{0,30}жим|smith\s*press/] },
    { file: "/workout-covers/chest.webp", patterns: [/жим.{0,30}леж/] },
    { file: "/workout-covers/shoulders.webp", patterns: [/вертикальн.{0,30}жим|жим.{0,30}гантел.{0,30}вверх|жим\s+сидя/] },
    { file: "/workout-covers/arms.webp", patterns: [/сгибан.{0,30}рук|разгибан.{0,30}рук|бицепс|трицепс/] }
  ];
  const getRuleScore = (value, rule) => {
    const content = String(value || "").toLowerCase().replace(/ё/g, "е");
    return rule.patterns.some((pattern) => pattern.test(content)) ? 1 : 0;
  };
  const scoredRules = coverRules.map((rule, ruleIndex) => {
    const exerciseScore = (workout?.exercises || []).reduce(
      (score, exercise) => score + getRuleScore(exercise?.name, rule) * 3,
      0
    );
    const workoutScore = getRuleScore(
      [workout?.name, workout?.title, workout?.description].filter(Boolean).join(" "),
      rule
    );

    return { ...rule, ruleIndex, score: exerciseScore + workoutScore };
  });
  const bestMatch = scoredRules
    .filter((rule) => rule.score > 0)
    .sort((first, second) => second.score - first.score || first.ruleIndex - second.ruleIndex)[0];

  return bestMatch?.file || "";
}

const LEGACY_WORKOUT_COVER_PATHS = Object.freeze({
  "/workout-covers/1arms.webp": "/workout-covers/arms.webp",
  "/workout-covers/1bent.webp": "/workout-covers/bent.webp",
  "/workout-covers/1chest.webp": "/workout-covers/chest.webp",
  "/workout-covers/1incline_smith_press.webp": "/workout-covers/incline_smith_press.webp",
  "/workout-covers/1legs.webp": "/workout-covers/legs.webp",
  "/workout-covers/1shoulders.webp": "/workout-covers/shoulders.webp",
  "/workout-covers/1tbar_row.webp": "/workout-covers/tbar_row.webp"
});

function normalizeWorkoutCoverPath(value) {
  const path = typeof value === "string" ? value.trim() : "";
  return LEGACY_WORKOUT_COVER_PATHS[path] || path;
}

export const WORKOUT_MENU_ITEMS = [
  {
    day: "День 1",
    title: "Спина + плечи",
    image: "/workout-covers/bent.webp"
  },
  {
    day: "День 2",
    title: "Грудь + плечи + руки",
    image: "/workout-covers/chest.webp"
  },
  {
    day: "День 3",
    title: "Спина + плечи",
    image: "/workout-covers/shoulders.webp"
  },
  {
    day: "День 4",
    title: "Грудь + руки",
    image: "/workout-covers/arms.webp"
  }
];

export function getWorkoutPresentationImage(workoutItem, workoutTitle, workoutMenuItems = WORKOUT_MENU_ITEMS) {
  const exerciseImage = (workoutItem?.exercises || [])
    .flatMap((exercise) => [exercise?.image, exercise?.thumbnail, exercise?.poster])
    .find((image) => typeof image === "string" && image.trim());
  const directImage =
    workoutItem?.image ||
    workoutItem?.thumbnail ||
    workoutItem?.poster ||
    exerciseImage;

  if (directImage) return normalizeWorkoutCoverPath(directImage);

  const content = `${workoutTitle} ${(workoutItem?.exercises || []).map((exercise) => exercise?.name || "").join(" ")}`.toLowerCase();
  if (/спин|плеч|тяга|подтяг|дельт/.test(content)) return workoutMenuItems[0]?.image || "";
  if (/груд|рук|бицеп|трицеп|жим леж|сведен/.test(content)) return workoutMenuItems[1]?.image || "";
  return "";
}

export function getEstimatedWorkoutDuration(workout = {}) {
  const explicitMinutes = Number(workout.durationMinutes || workout.estimatedMinutes);
  if (Number.isFinite(explicitMinutes) && explicitMinutes > 0) {
    return `≈ ${Math.round(explicitMinutes)} мин`;
  }

  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const setCount = exercises.reduce(
    (total, exercise) => total + (Array.isArray(exercise?.sets) ? exercise.sets.length : 0),
    0
  );
  const estimatedMinutes = Math.max(20, Math.round((setCount * 2.1 + exercises.length * 1.5 + 5) / 5) * 5);
  const rangeStart = Math.max(15, estimatedMinutes - 5);
  const rangeEnd = estimatedMinutes + 5;

  return `≈ ${rangeStart}–${rangeEnd} мин`;
}

export function getWorkoutPresentationTitle(workoutItem, dayNumber) {
  const rawName = String(workoutItem?.title || workoutItem?.name || "").trim();
  const explicitName = rawName
    .split(/[·—–|]/)
    .map((part) => part.trim())
    .reverse()
    .find((part) => (
      part &&
      !/^(?:неделя|день|тренировка|базовая)(?:\s+\d+)?$/i.test(part)
    ));

  if (explicitName) {
    const cleanName = explicitName
      .replace(/^(?:неделя|день|тренировка)\s*\d+\s*[:/+-]?\s*/i, "")
      .replace(/\s*[+/]\s*/g, " и ")
      .trim();

    if (cleanName && !/^(?:неделя|день|тренировка)(?:\s+\d+)?$/i.test(cleanName)) {
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
  }

  const exerciseNames = (workoutItem?.exercises || []).map((exercise) => (
    String(exercise?.name || "").toLowerCase()
  ));
  const groupRules = [
    { label: "Ноги", patterns: [/ног/, /присед/, /выпад/, /бедр/, /икр/] },
    { label: "Ягодицы", patterns: [/ягод/, /тазобед/, /глют/] },
    { label: "Спина", patterns: [/спин/, /подтяг/, /тяга верх/, /тяга ниж/, /тяга гантел/, /тяга штанг/, /т-гриф/, /гиперэкст/] },
    { label: "Грудь", patterns: [/груд/, /жим леж/, /жим гантел.*л[её]ж/, /сведен/, /развод/, /отжим/] },
    { label: "Плечи", patterns: [/плеч/, /дельт/, /вертикальн.*жим/, /армейск/, /отведен.*рук/, /мах/] },
    { label: "Руки", patterns: [/бицеп/, /трицеп/, /сгибан.*рук/, /разгибан.*рук/, /француз/] },
    { label: "Пресс", patterns: [/пресс/, /скручив/, /планк/] }
  ];
  const detectedGroups = groupRules
    .map((group) => ({
      label: group.label,
      score: exerciseNames.reduce((total, exerciseName) => (
        total + (group.patterns.some((pattern) => pattern.test(exerciseName)) ? 1 : 0)
      ), 0)
    }))
    .filter((group) => group.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 2)
    .map((group) => group.label);

  return detectedGroups.length > 1
    ? `${detectedGroups[0]} и ${detectedGroups[1].toLowerCase()}`
    : detectedGroups[0] || `День ${dayNumber}`;
}

export function getWorkoutPresentation(workoutItem, fallbackIndex = 0) {
  const weekNumber =
    String(workoutItem?.name || "").match(/неделя\s*(\d+)/i)?.[1] ||
    String(workoutItem?.weekName || "").match(/неделя\s*(\d+)/i)?.[1] ||
    String(workoutItem?.id || "").match(/week[_-]?(\d+)/i)?.[1];
  const dayNumber =
    String(workoutItem?.name || "").match(/день\s*(\d+)/i)?.[1] ||
    String(workoutItem?.id || "").match(/day[_-]?(\d+)/i)?.[1] ||
    fallbackIndex + 1;
  const title = getWorkoutPresentationTitle(workoutItem, dayNumber);

  return {
    day: weekNumber ? `Неделя ${weekNumber} · День ${dayNumber}` : `День ${dayNumber}`,
    title,
    image: getWorkoutPresentationImage(workoutItem, title),
    trainerTip:
      String(workoutItem?.trainerNote || workoutItem?.coachNote || workoutItem?.note || workoutItem?.description || "").trim() ||
      "Следи за техникой и оставляй 1–2 повтора в запасе.",
    exerciseCount: (workoutItem?.exercises || []).length,
    setCount: (workoutItem?.exercises || []).flatMap((exercise) => exercise.sets || []).length,
    duration: getEstimatedWorkoutDuration(workoutItem)
  };
}

export function getWorkoutWarmupSteps(workout = {}) {
  const content = [
    workout.name,
    workout.title,
    ...(workout.exercises || []).map((exercise) => exercise?.name)
  ].filter(Boolean).join(" ").toLowerCase();
  const jointText = /ног|присед|выпад|ягод|бедр/.test(content)
    ? "Таз, колени и голеностоп"
    : /спин|груд|плеч|тяг|жим|бицеп|трицеп/.test(content)
      ? "Плечи, локти и лопатки"
      : "Плечи, локти, таз, колени и голеностоп";
  const firstExerciseName = workout.exercises?.[0]?.name || "первого упражнения";

  return [
    {
      title: "Кардио · 2–3 минуты",
      description: "Дорожка, велосипед или быстрая ходьба"
    },
    {
      title: "Суставная разминка",
      description: jointText
    },
    {
      title: "Лёгкий разминочный подход",
      description: `Подготовься к упражнению «${firstExerciseName}» с меньшим весом`
    }
  ];
}

export function getExerciseTechniqueHint(exerciseName = "") {
  const content = String(exerciseName).toLowerCase();

  if (/тяг|спин/.test(content)) return "Сохраняй нейтральную спину и веди движение локтями.";
  if (/жим|груд|плеч/.test(content)) return "Контролируй опускание и не теряй устойчивое положение корпуса.";
  if (/присед|ног|выпад/.test(content)) return "Держи колени по линии стоп и выполняй движение без рывков.";

  return "Двигайся контролируемо и сохраняй устойчивую технику во всём диапазоне.";
}

export function formatCompactTimer(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatWorkoutElapsedDuration(startedAt = 0, endedAt = 0) {
  if (!startedAt) return "—";

  const totalSeconds = Math.max(0, Math.floor(((Number(endedAt) || 0) - Number(startedAt)) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин ${seconds} сек`;
  return `${seconds} сек`;
}

export function buildWorkoutFinishSummary({
  workoutDurationText = "—",
  completedExercisesCount = 0,
  totalSetsDone = 0,
  totalVolumeDone = 0,
  volumeProgress = null,
  isWorkoutSaved = false,
  workoutHistorySyncState = ""
} = {}) {
  const finishDurationText =
    workoutDurationText === "0 сек"
      ? "меньше минуты"
      : workoutDurationText === "—"
        ? ""
        : workoutDurationText;
  const stats = [
    finishDurationText ? { label: "Время", value: finishDurationText } : null,
    completedExercisesCount > 0 ? { label: "Упражнения", value: completedExercisesCount } : null,
    totalSetsDone > 0 ? { label: "Подходы", value: totalSetsDone } : null,
    totalVolumeDone > 0
      ? { label: "Объём", value: `${Math.round(totalVolumeDone).toLocaleString("ru-RU")} кг` }
      : null
  ].filter(Boolean);
  const progressText =
    totalSetsDone === 0 || volumeProgress === null
      ? isWorkoutSaved
        ? "Первая точка прогресса сохранена."
        : "После сохранения это станет первой точкой прогресса."
      : volumeProgress > 0
        ? `Новый результат: объём +${volumeProgress}% к прошлой тренировке.`
        : volumeProgress === 0
          ? "Объём совпал с прошлой тренировкой."
          : `Объём ${volumeProgress}% к прошлой тренировке.`;
  const adviceText =
    totalSetsDone > 0
      ? "Восстановись и оставь 1–2 повтора в запасе на следующей тренировке."
      : "В следующий раз заполни вес и повторы, чтобы видеть прогресс.";
  const syncText =
    workoutHistorySyncState === "saving"
      ? "Сохранение..."
      : workoutHistorySyncState === "local"
        ? "Сохранено локально · ждёт синхронизации"
        : workoutHistorySyncState === "synced"
          ? "Синхронизировано"
          : "";

  return { stats, progressText, adviceText, syncText };
}

export function getDefaultWorkoutModePreference() {
  return {
    mode: "individual",
    remember: false
  };
}

export const WORKOUT_READINESS_OPTIONS = [
  {
    id: "excellent",
    emoji: "😤",
    title: "Отлично",
    subtitle: "Можно добавить вес",
    weightFactor: 1,
    volumeText: "следующий шаг веса вверх"
  },
  {
    id: "good",
    emoji: "🙂",
    title: "Нормально",
    subtitle: "Работаем по плану",
    weightFactor: 1,
    volumeText: "вес без изменений"
  },
  {
    id: "bad",
    emoji: "😵",
    title: "Плохо",
    subtitle: "Снизим нагрузку",
    weightFactor: 0.85,
    volumeText: "минус 15% с шагом веса"
  }
];

const STANDARD_GYM_WEIGHTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
  32, 34, 36, 38, 40,
  42.5, 45, 47.5, 50, 52.5, 55, 57.5, 60,
  62.5, 65, 67.5, 70, 72.5, 75, 77.5, 80,
  82.5, 85, 87.5, 90, 92.5, 95, 97.5, 100,
  105, 110, 115, 120, 125, 130, 135, 140,
  145, 150, 160, 170, 180, 190, 200
];

export function getWorkoutReadinessOption(id) {
  return WORKOUT_READINESS_OPTIONS.find((item) => item.id === id) || WORKOUT_READINESS_OPTIONS[1];
}

export function roundToStandardGymWeight(value, direction = "nearest") {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "";

  const weights = STANDARD_GYM_WEIGHTS;
  if (direction === "up") {
    return weights.find((weight) => weight > numericValue) || weights[weights.length - 1];
  }

  if (direction === "down") {
    return [...weights].reverse().find((weight) => weight <= numericValue) || weights[0];
  }

  return weights.reduce((closest, current) => (
    Math.abs(current - numericValue) < Math.abs(closest - numericValue) ? current : closest
  ), weights[0]);
}

export function getAdjustedWorkoutWeight(weight, readinessId) {
  const numericWeight = Number(String(weight || "").replace(",", "."));
  if (!Number.isFinite(numericWeight) || numericWeight <= 0) return "";

  const readiness = getWorkoutReadinessOption(readinessId);

  if (readiness.id === "excellent") {
    return roundToStandardGymWeight(numericWeight, "up");
  }

  if (readiness.id === "bad") {
    return roundToStandardGymWeight(numericWeight * 0.85, "down");
  }

  return String(weight).trim();
}

export function parseWorkoutWeightValue(value) {
  const numeric = Number(String(value || "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function getBestProgressiveSetWeight(exerciseName, setIndex, history = []) {
  let best = 0;

  getAiHistoryItems(history).forEach((historyWorkout) => {
    const exercise = (historyWorkout.exercises || []).find((item) => item.name === exerciseName);
    if (!exercise?.sets?.length) return;

    const set = exercise.sets[setIndex] || exercise.sets[exercise.sets.length - 1];
    const actualWeight = parseWorkoutWeightValue(set?.weight);
    const originalWeight = parseWorkoutWeightValue(set?.aiOriginalWeight);
    const suggestedWeight = parseWorkoutWeightValue(set?.aiSuggestedWeight);
    const protectedBase = Math.max(originalWeight, suggestedWeight);
    const candidate = Math.max(actualWeight, protectedBase);

    if (candidate > best) best = candidate;
  });

  return best;
}

export function getAiWorkoutBaseWeight(exerciseName, set, setIndex, history = [], useHistoryWeight = true) {
  const programWeight = parseWorkoutWeightValue(set?.aiOriginalWeight || set?.weight);
  if (!useHistoryWeight) return programWeight;

  const bestHistoryWeight = getBestProgressiveSetWeight(exerciseName, setIndex, history);

  return Math.max(programWeight, bestHistoryWeight);
}

export const POST_WORKOUT_FEEDBACK_OPTIONS = [
  {
    id: "good",
    emoji: "🔥",
    title: "Хорошо",
    subtitle: "Можно прогрессировать",
    advice: "Отличная работа. Продолжай в том же духе — AI сможет постепенно повышать нагрузку."
  },
  {
    id: "normal",
    emoji: "🙂",
    title: "Нормально",
    subtitle: "Стабильная тренировка",
    advice: "Хорошая стабильная работа. Не обязательно прогрессировать каждую тренировку."
  },
  {
    id: "bad",
    emoji: "😵",
    title: "Плохо",
    subtitle: "Нужно восстановление",
    advice: "Сделай акцент на сне, воде, углеводах и восстановлении. Следующую тренировку начни легче."
  }
];

export const AI_COACH_FEATURES = [
  {
    id: "liveCoach",
    icon: "⚡",
    title: "AI-помощник тренировки",
    subtitle: "Подсказки перед и во время тренировки"
  },
  {
    id: "recovery",
    icon: "🧘",
    title: "Восстановление",
    subtitle: "Оценка отдыха и готовности"
  },
  {
    id: "muscleProgram",
    icon: "🎯",
    title: "Программа под мышцы",
    subtitle: "Что качать следующим"
  },
  {
    id: "nutritionPlan",
    icon: "🍽️",
    title: "План питания",
    subtitle: "Калории, белки и фокус дня"
  },
  {
    id: "motivation",
    icon: "🔥",
    title: "Мотивация",
    subtitle: "Короткий настрой перед залом"
  },
  {
    id: "progress",
    icon: "📈",
    title: "Прогресс",
    subtitle: "Анализ истории тренировок"
  },
  {
    id: "overload",
    icon: "🛡️",
    title: "Перегрузка мышц",
    subtitle: "Где стоит снизить нагрузку"
  },
  {
    id: "swap",
    icon: "🔁",
    title: "Автозамена упражнений",
    subtitle: "Замены без потери смысла"
  }
];

const AI_MUSCLE_RULES = [
  { muscle: "Ноги", keywords: ["ног", "жим ног", "выпад", "румын", "разгибание ног", "присед", "тяга"] },
  { muscle: "Спина", keywords: ["тяга", "спин", "верхнего блока", "т-грифа", "греб", "поясу"] },
  { muscle: "Грудь", keywords: ["груд", "жим лёжа", "жим лежа", "сведение", "гантелей лёжа", "смит"] },
  { muscle: "Плечи", keywords: ["плеч", "дельт", "отведение", "вертикальный жим", "жим в тренаж"] },
  { muscle: "Руки", keywords: ["сгибание", "разгибание рук", "бицеп", "трицеп", "скотт", "кроссовер"] },
  { muscle: "Пресс", keywords: ["пресс", "скручив"] }
];

export function getAiExerciseMuscles(name = "") {
  const lowerName = String(name).toLowerCase();
  const muscles = AI_MUSCLE_RULES
    .filter((rule) => rule.keywords.some((keyword) => lowerName.includes(keyword)))
    .map((rule) => rule.muscle);

  return muscles.length ? [...new Set(muscles)] : ["Общая нагрузка"];
}

export function getExerciseMovementHint(name = "") {
  const lowerName = String(name).toLowerCase();

  if (/(тяга|греб|подтяг)/.test(lowerName)) return "тяговое движение";
  if (/(жим|отжим)/.test(lowerName)) return "жимовое движение";
  if (/(присед|выпад|разгибание ног|сгибание ног)/.test(lowerName)) return "движение для ног";
  if (/(сгибание|разгибание рук|бицеп|трицеп)/.test(lowerName)) return "изолированное движение";
  if (/(скручив|пресс|планк)/.test(lowerName)) return "упражнение для корпуса";

  return "рабочий подход";
}

export function getAiHistoryItems(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((item) => ({
      ...item,
      parsedDate: new Date(item.date || item.createdAt || Date.now())
    }))
    .filter((item) => !Number.isNaN(item.parsedDate.getTime()))
    .sort((a, b) => b.parsedDate - a.parsedDate);
}

export function getProgramHistoryItems(history = [], scope = null) {
  const items = getAiHistoryItems(history);
  if (!scope) return items;

  const programId = String(scope.assignedProgramId || "").trim();
  const assignmentVersion = String(scope.assignedProgramUpdatedAt || "").trim();
  const workoutIds = new Set((scope.workoutIds || []).map((id) => String(id || "").trim()).filter(Boolean));

  return items.filter((item) => {
    const itemProgramId = String(item?.assignedProgramId || "").trim();
    const itemAssignmentVersion = String(item?.assignedProgramUpdatedAt || "").trim();

    if (assignmentVersion && itemAssignmentVersion) {
      return itemAssignmentVersion === assignmentVersion;
    }
    if (programId && itemProgramId) {
      return itemProgramId === programId;
    }

    return !itemProgramId &&
      !itemAssignmentVersion &&
      workoutIds.has(String(item?.workoutId || "").trim());
  });
}

export function getAiMuscleLoad(history = [], days = 14) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const load = {};

  getAiHistoryItems(history).forEach((workout) => {
    const ageDays = Math.max(0, Math.round((now - workout.parsedDate.getTime()) / dayMs));
    if (ageDays > days) return;

    (workout.exercises || []).forEach((exercise) => {
      const setCount = Array.isArray(exercise.sets) ? exercise.sets.length : 0;
      getAiExerciseMuscles(exercise.name).forEach((muscle) => {
        load[muscle] = (load[muscle] || 0) + Math.max(1, setCount);
      });
    });
  });

  return load;
}
