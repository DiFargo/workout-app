import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../data/basicWorkoutExerciseLibrary.js";

export const BASIC_WORKOUT_TODAY_TARGETS = Object.freeze([
  {
    id: "chest",
    label: "Грудь",
    description: "Жимы и сведения",
    image: "/basic-workout/illustrations/zones-v3-chest.png",
    groups: ["chest_press", "chest_incline", "chest_fly"],
    supportGroups: ["shoulder_press", "side_delts", "triceps", "core"]
  },
  {
    id: "back",
    label: "Спина",
    description: "Тяги и лопатки",
    image: "/basic-workout/illustrations/zones-v3-back.png",
    groups: ["vertical_pull", "horizontal_pull", "rear_delts"],
    supportGroups: ["biceps", "core"]
  },
  {
    id: "shoulders",
    label: "Плечи",
    description: "Дельты и стабильность",
    image: "/basic-workout/illustrations/zones-v3-shoulders.png",
    groups: ["shoulder_press", "side_delts", "rear_delts"],
    supportGroups: ["triceps", "core"]
  },
  {
    id: "legs",
    label: "Ноги",
    description: "Передняя поверхность и икры",
    image: "/basic-workout/illustrations/zones-v3-legs.png",
    groups: ["quads", "calves"],
    supportGroups: ["posterior_chain", "core"]
  },
  {
    id: "glutes",
    label: "Ягодицы",
    description: "Задняя поверхность и таз",
    image: "/basic-workout/illustrations/zones-v3-glutes.png",
    groups: ["posterior_chain"],
    supportGroups: ["calves", "core"]
  },
  {
    id: "biceps",
    label: "Бицепс",
    description: "Сгибания и тяги",
    image: "/basic-workout/illustrations/zones-v3-biceps.png",
    groups: ["biceps"],
    supportGroups: ["vertical_pull", "horizontal_pull", "forearms"]
  },
  {
    id: "triceps",
    label: "Трицепс",
    description: "Разгибания и жимы",
    image: "/basic-workout/illustrations/zones-v3-triceps.png",
    groups: ["triceps"],
    supportGroups: ["chest_press", "shoulder_press", "forearms"]
  },
  {
    id: "core",
    label: "Пресс",
    description: "Кор и стабильность",
    image: "/basic-workout/illustrations/zones-v3-core.png",
    groups: ["core"],
    supportGroups: ["quads", "posterior_chain"]
  },
  {
    id: "full_body",
    label: "Full body",
    description: "Равномерно на всё тело",
    image: "/basic-workout/illustrations/zones-v3-full-body.png",
    groups: [
      "chest_press", "chest_incline", "chest_fly", "vertical_pull", "horizontal_pull",
      "shoulder_press", "side_delts", "rear_delts", "quads", "posterior_chain",
      "calves", "biceps", "triceps", "forearms", "core"
    ],
    supportGroups: []
  }
]);

const TARGET_BY_ID = new Map(BASIC_WORKOUT_TODAY_TARGETS.map((target) => [target.id, target]));
const FULL_BODY_GROUP_ORDER = ["quads", "chest_press", "vertical_pull", "posterior_chain", "shoulder_press", "core"];

export const BASIC_WORKOUT_TODAY_MAX_TARGETS = 3;

function getTodayExerciseCount(duration, readiness) {
  const target = { "30": 3, "45": 5, "60": 6, "90": 7 }[String(duration)] || 5;
  return readiness === "low" ? Math.max(3, target - 1) : target;
}

function getTodaySetCount(duration, level, readiness) {
  if (readiness === "low" || String(duration) === "30") return 2;
  return String(duration) === "45" && String(level) === "beginner" ? 2 : 3;
}

function isRestrictionSafe(exercise, restrictions) {
  if (restrictions === "knees") return !["quads", "posterior_chain", "calves"].includes(exercise.groupId);
  if (restrictions === "shoulders") {
    return ![
      "chest_press", "chest_incline", "chest_fly", "vertical_pull", "horizontal_pull",
      "shoulder_press", "side_delts", "rear_delts", "biceps", "triceps", "forearms"
    ].includes(exercise.groupId);
  }
  if (restrictions === "back") {
    return !["posterior_chain"].includes(exercise.groupId) && ![
      "db_rdl", "romanian_deadlift", "hip_thrust", "back_extension", "cable_crunch",
      "floor_crunch", "hanging_knee_raise", "reverse_crunch"
    ].includes(exercise.id);
  }
  return true;
}

function getFallbackSets(exercise, count) {
  const timed = Number(exercise.durationSeconds) > 0;
  const reps = /(?:quads|posterior_chain|chest_press|chest_incline|vertical_pull|horizontal_pull|shoulder_press)/u.test(exercise.groupId)
    ? 8
    : 10;

  return Array.from({ length: count }, (_, index) => ({
    id: `set_${index + 1}`,
    reps: timed ? 0 : reps,
    weight: "",
    durationSeconds: timed ? Number(exercise.durationSeconds) || 30 : 0
  }));
}

export function getBasicWorkoutTodayTargets(targetIds = []) {
  const rawTargetIds = Array.isArray(targetIds) ? targetIds : [targetIds];
  const targets = [...new Set(rawTargetIds.map((targetId) => String(targetId || "").trim()))]
    .map((targetId) => TARGET_BY_ID.get(targetId))
    .filter(Boolean);

  if (targets.some((target) => target.id === "full_body")) {
    return [TARGET_BY_ID.get("full_body")];
  }

  return targets.slice(0, BASIC_WORKOUT_TODAY_MAX_TARGETS);
}

export function getBasicWorkoutTodayTarget(targetId) {
  return getBasicWorkoutTodayTargets([targetId])[0] || BASIC_WORKOUT_TODAY_TARGETS[0];
}

export function buildBasicWorkoutTodayLocalFallback({
  targetId = "",
  todayTarget = "",
  todayTargets = [],
  duration = "45",
  level = "beginner",
  location = "gym",
  readiness = "normal",
  restrictions = "none"
} = {}) {
  const targets = getBasicWorkoutTodayTargets(
    Array.isArray(todayTargets) && todayTargets.length ? todayTargets : [targetId || todayTarget || "chest"]
  );
  const resolvedTargets = targets.length ? targets : [getBasicWorkoutTodayTarget("chest")];
  const targetLabel = resolvedTargets.map((target) => target.label).join(" + ");
  const exerciseCount = getTodayExerciseCount(duration, readiness);
  const setCount = getTodaySetCount(duration, level, readiness);
  const allowedLocations = String(location) === "home" ? "home" : "gym";
  const candidates = BASIC_WORKOUT_EXERCISE_LIBRARY.filter((exercise) => (
    exercise.planEligible !== false &&
    exercise.locations?.includes(allowedLocations) &&
    isRestrictionSafe(exercise, restrictions)
  ));
  const primaryGroups = new Set(resolvedTargets.flatMap((target) => target.groups));
  const supportGroups = new Set(resolvedTargets.flatMap((target) => target.supportGroups));
  const targetExercises = candidates.filter((exercise) => primaryGroups.has(exercise.groupId));
  const supportExercises = candidates.filter((exercise) => supportGroups.has(exercise.groupId));
  const selected = [];
  const addUnique = (exercise) => {
    if (exercise && !selected.some((item) => item.id === exercise.id)) selected.push(exercise);
  };

  if (resolvedTargets[0]?.id === "full_body") {
    FULL_BODY_GROUP_ORDER.forEach((groupId) => {
      addUnique(candidates.find((exercise) => exercise.groupId === groupId));
    });
  } else {
    resolvedTargets.forEach((target) => {
      addUnique(candidates.find((exercise) => target.groups.includes(exercise.groupId)));
    });
  }
  targetExercises.forEach(addUnique);
  supportExercises.forEach(addUnique);
  candidates.forEach(addUnique);

  const todayKey = new Date().toISOString().slice(0, 10);
  const planId = `basic_today_local_${Date.now().toString(36)}`;
  const workoutId = `${planId}_workout`;
  const exercises = selected.slice(0, exerciseCount).map((exercise, index) => ({
    id: `${workoutId}_exercise_${index + 1}`,
    basicExerciseId: exercise.id,
    basicExerciseLibraryId: exercise.id,
    basicExerciseGroupId: exercise.groupId,
    name: exercise.name,
    video: "",
    rest: exercise.rest || "60 сек",
    equipment: exercise.equipment || "",
    requiresWeight: Boolean(exercise.requiresWeight),
    usesWeight: Boolean(exercise.requiresWeight),
    note: exercise.note || "Работайте в комфортной амплитуде и остановитесь при боли.",
    description: exercise.note || "Работайте в комфортной амплитуде и остановитесь при боли.",
    sets: getFallbackSets(exercise, setCount)
  }));

  return {
    id: planId,
    name: `Тренировка на сегодня · ${targetLabel}`,
    basicPlanId: planId,
    basicPlanName: `Тренировка на сегодня · ${targetLabel}`,
    description: `Короткая тренировка с акцентом: ${targetLabel.toLocaleLowerCase("ru")}.`,
    safetyNote: restrictions === "none"
      ? "Останавливайте упражнение при боли и сохраняйте комфортную технику."
      : "При ограничениях выполняйте только движения без боли и согласуйте нагрузку со специалистом.",
    durationWeeks: 1,
    structure: "on_demand",
    generatedAt: new Date().toISOString(),
    generatedBy: "local_fallback",
    generationFallback: true,
    profile: { days: "1", duration: String(duration), location: allowedLocations, level: String(level), restrictions },
    todayTarget: resolvedTargets[0].id,
    todayTargets: resolvedTargets.map((target) => target.id),
    workouts: [{
      id: workoutId,
      name: targetLabel,
      focus: targetLabel,
      order: 1,
      sortOrder: 1,
      weekNumber: 1,
      dayNumber: 1,
      scheduledDate: todayKey,
      plannedDate: todayKey,
      exercises
    }]
  };
}
