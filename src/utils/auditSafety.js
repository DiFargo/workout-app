export function exerciseUsesExternalWeight(exercise = {}) {
  if (exercise.requiresWeight === true || exercise.usesWeight === true) return true;
  if (exercise.requiresWeight === false || exercise.usesWeight === false) return false;

  const name = String(exercise.name || "").toLowerCase();
  const bodyweightPattern =
    /пресс|скручив|планк|отжим|подтяг|берпи|гиперэкстенз|подъ[её]м ног|велосипед|альпинист|растяж/;

  return !bodyweightPattern.test(name);
}

export function isWorkoutSetCompleted(set = {}) {
  return Boolean(
    set.completed ||
    Number(set.enteredWeight) > 0 ||
    Number(set.enteredReps) > 0
  );
}

export function getWorkoutCompletion(workout = {}) {
  const sets = (workout.exercises || []).flatMap((exercise) => exercise.sets || []);
  const completedSets = sets.filter(isWorkoutSetCompleted).length;

  return {
    completedSets,
    totalSets: sets.length,
    isPartial: completedSets > 0 && completedSets < sets.length
  };
}

export function getTimestampValue(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();

  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeNutritionDays(
  localDays = {},
  cloudDays = {},
  localStateUpdatedAt = "",
  cloudStateUpdatedAt = ""
) {
  const mergedDays = {};
  const dayKeys = new Set([
    ...Object.keys(cloudDays || {}),
    ...Object.keys(localDays || {})
  ]);
  const localStateTimestamp = getTimestampValue(localStateUpdatedAt);
  const cloudStateTimestamp = getTimestampValue(cloudStateUpdatedAt);

  dayKeys.forEach((key) => {
    const localDay = localDays?.[key];
    const cloudDay = cloudDays?.[key];

    if (!localDay) {
      mergedDays[key] = cloudDay;
      return;
    }

    if (!cloudDay) {
      mergedDays[key] = localDay;
      return;
    }

    const localTimestamp = getTimestampValue(localDay.updatedAt) || localStateTimestamp;
    const cloudTimestamp = getTimestampValue(cloudDay.updatedAt) || cloudStateTimestamp;
    mergedDays[key] = localTimestamp > cloudTimestamp ? localDay : cloudDay;
  });

  return mergedDays;
}

export function getNutritionSearchScore(food = {}, query = "") {
  const normalizedQuery = String(query).trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const name = String(food.name || "").trim().toLowerCase();
  const brand = String(food.brand || "").trim().toLowerCase();
  const text = [name, brand, food.note, food.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (name === normalizedQuery) return 100;
  if (name.startsWith(normalizedQuery)) return 80;
  if (brand === normalizedQuery) return 70;
  if (name.includes(normalizedQuery)) return 60;
  if (brand.includes(normalizedQuery)) return 45;
  return text.includes(normalizedQuery) ? 25 : 0;
}

export function getNutritionResultKey(food = {}) {
  const name = String(food.name || "").trim().toLowerCase();
  const brand = String(food.brand || "").trim().toLowerCase();
  const calories = Math.round(Number(food.calories) || 0);
  const protein = Math.round((Number(food.protein) || 0) * 10) / 10;
  return `${name}|${brand}|${calories}|${protein}`;
}

export function rankAndDedupeNutritionFoods(foods = [], query = "", limit = 30) {
  const unique = new Map();

  foods.forEach((food, index) => {
    const key = getNutritionResultKey(food);
    const score = getNutritionSearchScore(food, query);
    const existing = unique.get(key);
    const candidate = { food, score, index };

    if (!existing || score > existing.score) unique.set(key, candidate);
  });

  return [...unique.values()]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.food);
}

export function limitSimilarNutritionFoods(foods = [], limit = 30, maxPerFamily = 2) {
  const familyCounts = new Map();
  const result = [];

  for (const food of foods) {
    const family = String(food.name || "")
      .toLowerCase()
      .replace(/\d+(?:[.,]\d+)?\s*%/g, " ")
      .replace(/\d+(?:[.,]\d+)?\s*(?:г|гр|мл|л|кг)\b/g, " ")
      .replace(/[()[\],.:;+-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 2)
      .join(" ");
    const count = familyCounts.get(family) || 0;

    if (family && count >= maxPerFamily) continue;

    familyCounts.set(family, count + 1);
    result.push(food);
    if (result.length >= limit) break;
  }

  return result;
}
