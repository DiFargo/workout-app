export function exerciseUsesExternalWeight(exercise) {
  if (!exercise || typeof exercise !== "object") return false;

  if (exercise.requiresWeight === true || exercise.usesWeight === true) return true;
  if (exercise.requiresWeight === false || exercise.usesWeight === false) return false;

  const name = String(exercise.name || "").toLowerCase();
  const bodyweightPattern =
    /пресс|скручив|планк|отжим|подтяг|берпи|гиперэкстенз|подъ[её]м ног|велосипед|альпинист|растяж/;

  return !bodyweightPattern.test(name);
}

export function normalizeExerciseLibraryName(value = "") {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

export function findExerciseLibraryMatch(exercises = [], name = "", excludeId = "") {
  const normalizedName = normalizeExerciseLibraryName(name);
  if (!normalizedName) return null;

  const matches = (Array.isArray(exercises) ? exercises : []).filter((exercise) => (
    String(exercise?.id || "") !== String(excludeId || "") &&
    normalizeExerciseLibraryName(exercise?.name) === normalizedName
  ));

  return matches.find((exercise) => String(exercise?.video || exercise?.videoUrl || exercise?.videoURL || "").trim())
    || matches[0]
    || null;
}

export function applyExerciseLibraryDefaults(exercise = {}, library = []) {
  const currentVideo = String(exercise.video || exercise.videoUrl || exercise.videoURL || "").trim();
  const libraryExercise = findExerciseLibraryMatch(library, exercise.name, exercise.id);
  const libraryVideo = String(
    libraryExercise?.video || libraryExercise?.videoUrl || libraryExercise?.videoURL || ""
  ).trim();

  return {
    ...exercise,
    video: currentVideo || libraryVideo,
    videoAutoFilledFrom: currentVideo
      ? exercise.videoAutoFilledFrom || ""
      : libraryVideo
        ? libraryExercise.name
        : "",
    requiresWeight: typeof exercise.requiresWeight === "boolean"
      ? exercise.requiresWeight
      : exerciseUsesExternalWeight(libraryExercise || exercise)
  };
}

export function createFourWeekWorkoutProgramBlocks(seed = "draft") {
  return Array.from({ length: 2 }, (_, microcycleIndex) => ({
    id: `microcycle_${seed}_${microcycleIndex + 1}`,
    name: `Микроцикл ${microcycleIndex + 1}`,
    monthId: "month_1",
    weeks: Array.from({ length: 2 }, (_, weekOffset) => {
      const weekNumber = microcycleIndex * 2 + weekOffset + 1;

      return {
        id: `week_${seed}_${weekNumber}`,
        name: `Неделя ${weekNumber}`,
        workouts: Array.from({ length: 2 }, (_, workoutOffset) => {
          const workoutNumber = (weekNumber - 1) * 2 + workoutOffset + 1;

          return {
            id: `workout_${seed}_${workoutNumber}`,
            name: `Тренировка ${workoutNumber}`,
            order: workoutNumber,
            sortOrder: workoutNumber,
            exercises: []
          };
        })
      };
    })
  }));
}

export function createSingleDayWorkoutProgramBlocks(seed = "draft") {
  return [{
    id: `microcycle_${seed}_1`,
    name: "Микроцикл 1",
    monthId: "month_1",
    weeks: [{
      id: `week_${seed}_1`,
      name: "Неделя 1",
      workouts: [{
        id: `workout_${seed}_1`,
        name: "Тренировка 1",
        order: 1,
        sortOrder: 1,
        exercises: []
      }]
    }]
  }];
}

export function getMicrocycleWeekNumbers(microcycleNumber, rangeStart, rangeEnd) {
  const normalizedMicrocycle = Math.max(1, Number(microcycleNumber) || 1);
  const fallbackStart = normalizedMicrocycle * 2 - 1;
  const start = Number(rangeStart);
  const end = Number(rangeEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return [fallbackStart, fallbackStart + 1];
  }

  const usesLocalWeekNumbers = normalizedMicrocycle > 1 && start >= 1 && end <= 2;
  const absoluteStart = usesLocalWeekNumbers ? fallbackStart + start - 1 : start;
  const absoluteEnd = usesLocalWeekNumbers ? fallbackStart + end - 1 : end;

  return Array.from(
    { length: absoluteEnd - absoluteStart + 1 },
    (_, offset) => absoluteStart + offset
  );
}

export function distributeMicrocycleWorkouts(workouts = [], weekCount = 2) {
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const safeWeekCount = Math.max(1, Number(weekCount) || 1);
  const workoutsPerWeek = Math.max(1, Math.ceil(safeWorkouts.length / safeWeekCount));

  return Array.from(
    { length: safeWeekCount },
    (_, weekIndex) => safeWorkouts.slice(
      weekIndex * workoutsPerWeek,
      (weekIndex + 1) * workoutsPerWeek
    )
  );
}

export function hasWorkoutSetEntry(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function isWorkoutSetCompleted(set = {}) {
  return Boolean(set.completed);
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

function shiftDateKey(dateKey = "", days = 0) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";

  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function calculateNutritionFoodStreak(days = {}, endDateKey = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDateKey || ""))) return 0;

  let cursor = String(endDateKey);
  let streak = 0;

  while (cursor) {
    const day = days?.[cursor];
    const hasFood = Array.isArray(day?.foods) && day.foods.length > 0;
    if (!hasFood) break;

    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
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

export function isReliablePhotoFood(product = {}, response = {}) {
  const name = String(product?.name || "").trim().toLowerCase();
  const confidence = String(product?.confidence || response?.confidence || "").trim().toLowerCase();
  const rejectedNames = [
    "продукт не найден",
    "неизвестный продукт",
    "продукт по фото",
    "food not found",
    "unknown product",
    "stool",
    "chair"
  ];
  const hasNutrition = Number(product?.calories) > 0
    && [product?.protein, product?.fat, product?.carbs].some((value) => Number(value) > 0);

  return response?.found !== false
    && response?.isFood !== false
    && product?.isFood !== false
    && confidence !== "low"
    && Boolean(name)
    && name !== "новый продукт"
    && !rejectedNames.some((rejected) => name.includes(rejected))
    && hasNutrition;
}

function normalizePhotoFoodIdentity(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[()[\],.:;+\-—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findExistingPhotoFood(foods = [], product = {}) {
  const productName = normalizePhotoFoodIdentity(product.name);
  const productBrand = normalizePhotoFoodIdentity(product.brand);
  const productFullName = normalizePhotoFoodIdentity([product.brand, product.name].filter(Boolean).join(" "));
  const productBarcode = String(product.barcode || "").replace(/\D/g, "");
  const identities = new Set([productName, productFullName].filter(Boolean));

  return (Array.isArray(foods) ? foods : []).find((food) => {
    const foodBarcode = String(food?.barcode || "").replace(/\D/g, "");
    if (productBarcode && foodBarcode && productBarcode === foodBarcode) return true;

    const foodName = normalizePhotoFoodIdentity(food?.name);
    const foodFullName = normalizePhotoFoodIdentity([food?.brand, food?.name].filter(Boolean).join(" "));
    const foodIdentities = [foodName, foodFullName].filter(Boolean);
    if (foodIdentities.some((identity) => identities.has(identity))) return true;

    const foodBrand = normalizePhotoFoodIdentity(food?.brand);
    return Boolean(
      productBrand &&
      foodBrand &&
      productBrand === foodBrand &&
      productName &&
      foodName &&
      (productName.includes(foodName) || foodName.includes(productName))
    );
  }) || null;
}
