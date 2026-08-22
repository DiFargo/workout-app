import { BASIC_WORKOUT_AI_CATALOGUE } from "./basicWorkoutAiCatalogue.generated.js";

const MOVEMENT_ROLE_LABELS = {
  kneeDominantCompound: "Базовое движение на квадрицепс",
  hipDominantCompound: "Базовое движение на заднюю цепь",
  lowerAccessory: "Дополнительное упражнение на ноги",
  chestPress: "Жим на грудь",
  chestAccessory: "Изоляция груди",
  verticalPull: "Вертикальная тяга",
  horizontalPull: "Горизонтальная тяга",
  shoulderPress: "Жим на плечи",
  shoulderAccessory: "Дополнительное упражнение на плечи",
  biceps: "Изоляция бицепса",
  triceps: "Изоляция трицепса",
  core: "Кор"
};

const SINGLE_ROLE_PER_WORKOUT = new Set([
  "core",
  "kneeDominantCompound",
  "hipDominantCompound",
  "chestPress",
  "chestAccessory",
  "verticalPull",
  "horizontalPull",
  "shoulderPress",
  "biceps",
  "triceps"
]);

function normalizeCatalogueText(value = "") {
  return String(value || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[\s\-—–.,;:()]+/gu, " ")
    .trim();
}

const CATALOGUE_BY_ID = new Map(BASIC_WORKOUT_AI_CATALOGUE.map((exercise) => [exercise.id, exercise]));
const CATALOGUE_BY_NAME = new Map();

BASIC_WORKOUT_AI_CATALOGUE.forEach((exercise) => {
  [exercise.name, ...(exercise.aliases || [])]
    .map(normalizeCatalogueText)
    .filter(Boolean)
    .forEach((name) => {
      if (!CATALOGUE_BY_NAME.has(name)) CATALOGUE_BY_NAME.set(name, exercise);
    });
});

export function findBasicWorkoutAiCatalogueExercise({ catalogueId = "", name = "" } = {}) {
  const byId = CATALOGUE_BY_ID.get(String(catalogueId || "").trim());
  if (byId) return byId;
  return CATALOGUE_BY_NAME.get(normalizeCatalogueText(name)) || null;
}

export function getBasicWorkoutAiCatalogueGuidance(location = "gym") {
  const targetLocation = String(location || "gym").trim().toLowerCase() === "home" ? "home" : "gym";
  const visibleExercises = BASIC_WORKOUT_AI_CATALOGUE.filter((exercise) => exercise.locations.includes(targetLocation));
  const roles = new Map();

  visibleExercises.forEach((exercise) => {
    const entries = roles.get(exercise.movementRole) || [];
    entries.push(`${exercise.id} — ${exercise.name}`);
    roles.set(exercise.movementRole, entries);
  });

  return [...roles.entries()]
    .map(([movementRole, entries]) => {
      const limit = SINGLE_ROLE_PER_WORKOUT.has(movementRole) ? "; max 1 per workout" : "";
      return `[role: ${movementRole}${limit}] ${MOVEMENT_ROLE_LABELS[movementRole] || movementRole}: ${entries.join("; ")}.`;
    })
    .join("\n");
}

export function getBasicWorkoutAiCatalogueIssues(rawPlan = {}, location = "gym") {
  const targetLocation = String(location || "gym").trim().toLowerCase() === "home" ? "home" : "gym";
  const weeks = Array.isArray(rawPlan?.weeks) ? rawPlan.weeks : [];
  const issues = [];

  weeks.forEach((week, weekIndex) => {
    (Array.isArray(week?.workouts) ? week.workouts : []).forEach((workout, workoutIndex) => {
      (Array.isArray(workout?.exercises) ? workout.exercises : []).forEach((exercise, exerciseIndex) => {
        const matched = findBasicWorkoutAiCatalogueExercise(exercise);
        const prefix = `Неделя ${weekIndex + 1}, день ${workoutIndex + 1}, упражнение ${exerciseIndex + 1}`;
        if (!matched) {
          const requestedName = String(exercise?.name || exercise?.catalogueId || "без названия").trim();
          issues.push(`${prefix}: «${requestedName}» отсутствует в проверенном каталоге`);
        } else if (!matched.locations.includes(targetLocation)) {
          issues.push(`${prefix}: «${matched.name}» недоступно для места «${targetLocation === "home" ? "дома" : "тренажёрный зал"}`);
        }
      });
    });
  });

  return issues;
}

export function resolveBasicWorkoutAiCatalogueExercise(exercise = {}) {
  return findBasicWorkoutAiCatalogueExercise(exercise);
}

export const BASIC_WORKOUT_AI_CATALOGUE_COUNT = BASIC_WORKOUT_AI_CATALOGUE.length;
