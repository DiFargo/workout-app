const CORE_EXERCISE_PATTERN = /(?:планка|скручив|м[её]ртвый\s+жук|подъ[её]м\s+коленей)/iu;
const KNEE_DOMINANT_COMPOUND_PATTERN = /(?:жим\s+ногами|присед|выпады|зашагивани)/iu;
const HIP_DOMINANT_COMPOUND_PATTERN = /(?:ягодичн(?:ый|ая)\s+мост(?:\s+со\s+штангой)?|наклоны\s+с\s+гантелями|румынская\s+тяга|становая\s+тяга)/iu;
const CHEST_PRESS_PATTERN = /(?:жим\s+(?:от\s+груди|гантел(?:ей|ями)|л[её]жа|в\s+см[ие]т)|наклонн(?:ый|ая)\s+жим|отжимани)/iu;
const CHEST_ACCESSORY_PATTERN = /(?:сведение\s+рук|разведение\s+гантел(?:ей|ями))/iu;
const VERTICAL_PULL_PATTERN = /(?:тяга\s+(?:верхнего|сверху)|подтягив)/iu;
const HORIZONTAL_PULL_PATTERN = /(?:горизонтальн(?:ая|ый)\s+тяга|тяга\s+(?:гантели|с\s+опорой|в\s+(?:рычажном\s+)?тренаж[её]ре|штанги))/iu;
const SHOULDER_PRESS_PATTERN = /(?:вертикальн(?:ый|ая)\s+жим|жим\s+(?:гантел(?:ей|ями)\s+(?:сидя|стоя)|над\s+головой))/iu;
const SHOULDER_ACCESSORY_PATTERN = /(?:отведение\s+рук|разведение\s+рук|тяга\s+каната\s+к\s+лицу)/iu;
const BICEPS_PATTERN = /(?:сгибани[ея]\s+рук|молотков)/iu;
const TRICEPS_PATTERN = /(?:разгибани[ея]\s+(?:рук|гантели)|обратные\s+отжимания)/iu;
const LOWER_ACCESSORY_PATTERN = /(?:разгибани[ея]\s+ног|сгибани[ея]\s+ног|гиперэкстензи|подъ[её]мы\s+на\s+носки)/iu;

function getExerciseName(exercise = {}) {
  return String(exercise?.name || "").trim();
}

export function getBasicWorkoutExerciseCategory(exercise = {}) {
  const savedRole = String(exercise?.basicMovementRole || exercise?.movementRole || "").trim();
  if (savedRole) return savedRole;

  const name = getExerciseName(exercise);

  if (CORE_EXERCISE_PATTERN.test(name)) return "core";
  if (KNEE_DOMINANT_COMPOUND_PATTERN.test(name)) return "kneeDominantCompound";
  if (HIP_DOMINANT_COMPOUND_PATTERN.test(name)) return "hipDominantCompound";
  if (SHOULDER_PRESS_PATTERN.test(name)) return "shoulderPress";
  if (CHEST_PRESS_PATTERN.test(name)) return "chestPress";
  if (CHEST_ACCESSORY_PATTERN.test(name)) return "chestAccessory";
  if (VERTICAL_PULL_PATTERN.test(name)) return "verticalPull";
  if (HORIZONTAL_PULL_PATTERN.test(name)) return "horizontalPull";
  if (SHOULDER_ACCESSORY_PATTERN.test(name)) return "shoulderAccessory";
  if (BICEPS_PATTERN.test(name)) return "biceps";
  if (TRICEPS_PATTERN.test(name)) return "triceps";
  if (LOWER_ACCESSORY_PATTERN.test(name)) return "lowerAccessory";
  return "accessory";
}

function getExerciseKind(exercise = {}) {
  const category = getBasicWorkoutExerciseCategory(exercise);

  if (["kneeDominantCompound", "hipDominantCompound"].includes(category)) return "lowerCompound";
  if (["chestPress", "verticalPull", "horizontalPull", "shoulderPress"].includes(category)) return "upperCompound";
  if (category === "core") return "core";
  if (category === "lowerAccessory") return "lowerAccessory";
  return "accessory";
}

const COMPOSITION_LIMITS = {
  core: 1,
  kneeDominantCompound: 1,
  hipDominantCompound: 1,
  chestPress: 1,
  chestAccessory: 1,
  verticalPull: 1,
  horizontalPull: 1,
  shoulderPress: 1,
  biceps: 1,
  triceps: 1
};

const COMPOSITION_LABELS = {
  core: "двух упражнений на кор",
  kneeDominantCompound: "двух похожих базовых упражнений на квадрицепс",
  hipDominantCompound: "двух похожих базовых упражнений на заднюю цепь",
  chestPress: "двух жимов на грудь",
  chestAccessory: "двух изолирующих упражнений на грудь",
  verticalPull: "двух вертикальных тяг",
  horizontalPull: "двух горизонтальных тяг",
  shoulderPress: "двух жимов на плечи",
  biceps: "двух изолирующих упражнений на бицепс",
  triceps: "двух изолирующих упражнений на трицепс"
};

export function getBasicWorkoutCompositionIssues(exercises = []) {
  const items = Array.isArray(exercises) ? exercises : [];
  const categoryCounts = new Map();
  const normalizedNames = new Set();
  const issues = [];

  for (const exercise of items) {
    const category = getBasicWorkoutExerciseCategory(exercise);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    const normalizedName = getExerciseName(exercise).toLocaleLowerCase("ru");
    if (normalizedName && normalizedNames.has(normalizedName)) issues.push("повторяющегося упражнения");
    normalizedNames.add(normalizedName);
  }

  for (const [category, maximum] of Object.entries(COMPOSITION_LIMITS)) {
    if ((categoryCounts.get(category) || 0) > maximum) {
      issues.push(COMPOSITION_LABELS[category]);
    }
  }

  return [...new Set(issues)];
}

// Keep the order deterministic after AI generation. The first lower-body compound
// movement receives the early slot when one is present; isolated leg work does not.
export function orderBasicWorkoutExercises(exercises = []) {
  const entries = (Array.isArray(exercises) ? exercises : []).map((exercise, index) => ({
    exercise,
    index,
    kind: getExerciseKind(exercise)
  }));
  const primaryMovement = entries.find((entry) => entry.kind === "lowerCompound")
    || entries.find((entry) => entry.kind === "upperCompound");
  const priorityByKind = {
    upperCompound: 10,
    lowerCompound: 20,
    lowerAccessory: 30,
    accessory: 40,
    core: 90
  };

  return entries
    .sort((left, right) => {
      const leftPriority = left === primaryMovement ? 0 : priorityByKind[left.kind];
      const rightPriority = right === primaryMovement ? 0 : priorityByKind[right.kind];
      return leftPriority - rightPriority || left.index - right.index;
    })
    .map((entry) => entry.exercise);
}
