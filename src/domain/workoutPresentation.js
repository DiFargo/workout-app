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

export function getDefaultWorkoutModePreference() {
  return {
    mode: "",
    remember: false
  };
}
