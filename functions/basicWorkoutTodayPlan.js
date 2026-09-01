import { BASIC_WORKOUT_AI_CATALOGUE } from "./basicWorkoutAiCatalogue.generated.js";

export const BASIC_WORKOUT_TODAY_TARGETS = Object.freeze({
  chest: {
    label: "Грудь",
    focus: "Грудь, плечи и трицепс",
    groups: ["chest_press", "chest_incline", "chest_fly"],
    supportGroups: ["shoulder_press", "side_delts", "triceps", "core"]
  },
  back: {
    label: "Спина",
    focus: "Спина, задняя дельта и бицепс",
    groups: ["vertical_pull", "horizontal_pull", "rear_delts"],
    supportGroups: ["biceps", "core"]
  },
  shoulders: {
    label: "Плечи",
    focus: "Плечи и стабильность верха тела",
    groups: ["shoulder_press", "side_delts", "rear_delts"],
    supportGroups: ["triceps", "core"]
  },
  legs: {
    label: "Ноги",
    focus: "Ноги и икры",
    groups: ["quads", "calves"],
    supportGroups: ["posterior_chain", "core"]
  },
  glutes: {
    label: "Ягодицы",
    focus: "Ягодицы и задняя поверхность ног",
    groups: ["posterior_chain"],
    supportGroups: ["calves", "core"]
  },
  biceps: {
    label: "Бицепс",
    focus: "Бицепс, тяги и хват",
    groups: ["biceps"],
    supportGroups: ["vertical_pull", "horizontal_pull", "forearms"]
  },
  triceps: {
    label: "Трицепс",
    focus: "Трицепс и жимовые движения",
    groups: ["triceps"],
    supportGroups: ["chest_press", "shoulder_press", "forearms"]
  },
  core: {
    label: "Пресс",
    focus: "Кор и стабильность",
    groups: ["core"],
    supportGroups: ["quads", "posterior_chain"]
  },
  full_body: {
    label: "Full body",
    focus: "Равномерная тренировка всего тела",
    groups: [
      "chest_press", "chest_incline", "chest_fly", "vertical_pull", "horizontal_pull",
      "shoulder_press", "side_delts", "rear_delts", "quads", "posterior_chain",
      "calves", "biceps", "triceps", "forearms", "core"
    ],
    supportGroups: []
  }
});

const FULL_BODY_GROUP_ORDER = ["quads", "chest_press", "vertical_pull", "posterior_chain", "shoulder_press", "core"];
const MAX_TODAY_TARGETS = 3;

const BACK_RESTRICTED_IDS = new Set([
  "db_rdl",
  "romanian_deadlift",
  "hip_thrust",
  "back_extension",
  "cable_crunch",
  "floor_crunch",
  "hanging_knee_raise",
  "reverse_crunch"
]);

const ROLE_BY_GROUP = {
  quads: "kneeDominantCompound",
  posterior_chain: "hipDominantCompound",
  calves: "lowerAccessory",
  vertical_pull: "verticalPull",
  horizontal_pull: "horizontalPull",
  chest_press: "chestPress",
  chest_incline: "chestPress",
  chest_fly: "chestAccessory",
  shoulder_press: "shoulderPress",
  side_delts: "shoulderAccessory",
  rear_delts: "shoulderAccessory",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  core: "core"
};

function getSetCount(profile = {}) {
  if (profile.readiness === "low" || String(profile.duration) === "30") return 2;
  return String(profile.duration) === "45" && String(profile.level) === "beginner" ? 2 : 3;
}

export function getBasicWorkoutTodayExerciseTarget(profile = {}) {
  const defaultTarget = { "30": 3, "45": 5, "60": 6, "90": 7 }[String(profile.duration)] || 5;
  return profile.readiness === "low" ? Math.max(3, defaultTarget - 1) : defaultTarget;
}

export function getBasicWorkoutTodayTargets(targetIds = []) {
  const rawTargetIds = Array.isArray(targetIds) ? targetIds : [targetIds];
  const targets = [...new Set(rawTargetIds.map((targetId) => String(targetId || "").trim()))]
    .map((targetId) => BASIC_WORKOUT_TODAY_TARGETS[targetId])
    .filter(Boolean);

  if (targets.some((target) => target === BASIC_WORKOUT_TODAY_TARGETS.full_body)) {
    return [BASIC_WORKOUT_TODAY_TARGETS.full_body];
  }

  return targets.slice(0, MAX_TODAY_TARGETS);
}

export function getBasicWorkoutTodayTarget(targetId = "") {
  return getBasicWorkoutTodayTargets([targetId])[0] || BASIC_WORKOUT_TODAY_TARGETS.chest;
}

function getSelectedTodayTargets(profile = {}) {
  const targets = getBasicWorkoutTodayTargets(
    Array.isArray(profile.todayTargets) && profile.todayTargets.length
      ? profile.todayTargets
      : [profile.todayTarget]
  );
  return targets.length ? targets : [BASIC_WORKOUT_TODAY_TARGETS.chest];
}

function getTodayTargetLabel(targets = []) {
  return targets.map((target) => target.label).join(" + ");
}

function getTodayTargetFocus(targets = []) {
  return targets.map((target) => target.focus).join(" · ");
}

function isExerciseAllowedForRestriction(exercise, restriction) {
  if (restriction === "knees") return !["quads", "posterior_chain", "calves"].includes(exercise.groupId);
  if (restriction === "shoulders") {
    return ![
      "chest_press", "chest_incline", "chest_fly", "vertical_pull", "horizontal_pull",
      "shoulder_press", "side_delts", "rear_delts", "biceps", "triceps", "forearms"
    ].includes(exercise.groupId);
  }
  if (restriction === "back") {
    return exercise.groupId !== "posterior_chain" && !BACK_RESTRICTED_IDS.has(exercise.id);
  }
  return true;
}

function getFallbackExerciseSets(exercise, count) {
  const timed = Number(exercise.durationSeconds) > 0;
  const role = exercise.movementRole || ROLE_BY_GROUP[exercise.groupId] || "accessory";
  const reps = /Compound$/u.test(role) ? 8 : 10;

  return Array.from({ length: count }, () => ({
    reps: timed ? 0 : reps,
    weight: "",
    durationSeconds: timed ? Number(exercise.durationSeconds) || 30 : 0
  }));
}

export function buildBasicWorkoutTodayFallbackDraft(profile = {}) {
  const targets = getSelectedTodayTargets(profile);
  const targetLabel = getTodayTargetLabel(targets);
  const location = profile.location === "home" ? "home" : "gym";
  const targetExerciseCount = getBasicWorkoutTodayExerciseTarget(profile);
  const candidates = BASIC_WORKOUT_AI_CATALOGUE.filter((exercise) => (
    exercise.locations.includes(location) && isExerciseAllowedForRestriction(exercise, profile.restrictions)
  ));
  const primaryGroups = new Set(targets.flatMap((target) => target.groups));
  const supportGroups = new Set(targets.flatMap((target) => target.supportGroups));
  const targetCandidates = candidates.filter((exercise) => primaryGroups.has(exercise.groupId));
  const supportCandidates = candidates.filter((exercise) => supportGroups.has(exercise.groupId));
  const selected = [];
  const addUnique = (exercise) => {
    if (exercise && !selected.some((item) => item.id === exercise.id)) selected.push(exercise);
  };

  if (targets[0]?.label === "Full body") {
    FULL_BODY_GROUP_ORDER.forEach((groupId) => {
      addUnique(candidates.find((exercise) => exercise.groupId === groupId));
    });
  } else {
    targets.forEach((target) => {
      addUnique(candidates.find((exercise) => target.groups.includes(exercise.groupId)));
    });
  }
  targetCandidates.forEach(addUnique);
  supportCandidates.forEach(addUnique);
  candidates.forEach(addUnique);

  const exercises = selected.slice(0, targetExerciseCount).map((exercise) => ({
    catalogueId: exercise.id,
    name: exercise.name,
    note: exercise.note,
    restSeconds: exercise.restSeconds,
    sets: getFallbackExerciseSets(exercise, getSetCount(profile))
  }));

  if (exercises.length < targetExerciseCount) {
    throw new Error("Not enough reviewed exercises for the selected workout context");
  }

  return {
    name: `Тренировка на сегодня · ${targetLabel}`,
    description: `Тренировка с акцентом на ${targetLabel.toLocaleLowerCase("ru")}.`,
    safetyNote: profile.restrictions === "none"
      ? "Останавливайте упражнение при боли и сохраняйте комфортную технику."
      : "При ограничениях выполняйте только движения без боли и согласуйте нагрузку со специалистом.",
    workout: {
      name: targetLabel,
      focus: getTodayTargetFocus(targets),
      exercises
    }
  };
}

export function getBasicWorkoutTodayPromptGuidance(profile = {}) {
  const targets = getSelectedTodayTargets(profile);
  const targetLabel = getTodayTargetLabel(targets);
  const targetGroups = [...new Set(targets.flatMap((target) => target.groups))].join(", ");
  const supportGroups = [...new Set(targets.flatMap((target) => target.supportGroups))].join(", ");
  const isFullBody = targets[0] === BASIC_WORKOUT_TODAY_TARGETS.full_body;
  return [
    isFullBody
      ? "Build a balanced full-body session. Spread the work across lower body, push, pull, and core as the available exercise count allows."
      : `The selected targets are ${targetLabel}. Include at least one exercise for each selected target when it is safe for the stated restriction. Primary group ids: ${targetGroups}.`,
    supportGroups
      ? `The remaining exercises may only use the primary group ids or these compatible support group ids: ${supportGroups}.`
      : "Use only the listed primary group ids.",
    isFullBody
      ? "Do not repeat one body area while leaving the session unbalanced."
      : "Keep a clear single-session focus. Do not add unrelated muscle groups.",
    "Use different approved exercises. Do not repeat an exercise in one workout.",
    targets.length === 1 && targets[0].label === "Пресс"
      ? "For a core session, several distinct core exercises are allowed. Put them at the end after any optional supporting movement."
      : "Put the main compound or primary movement first and any core exercise last."
  ].join("\n");
}

export function getBasicWorkoutTodayCompositionIssues(workout = {}, profile = {}) {
  const targets = getSelectedTodayTargets(profile);
  const selected = Array.isArray(workout.exercises) ? workout.exercises : [];
  const expectedCount = getBasicWorkoutTodayExerciseTarget(profile);
  const names = new Set();
  const allowedGroups = new Set(targets.flatMap((target) => [...target.groups, ...target.supportGroups]));
  const issues = [];
  const selectedGroups = new Set();

  if (selected.length !== expectedCount) issues.push("неверного количества упражнений");

  selected.forEach((exercise) => {
    const catalogue = BASIC_WORKOUT_AI_CATALOGUE.find((item) => item.id === exercise?.catalogueId);
    if (!catalogue) return;
    const key = catalogue.id;
    if (names.has(key)) issues.push("повторяющегося упражнения");
    names.add(key);
    selectedGroups.add(catalogue.groupId);
    if (!allowedGroups.has(catalogue.groupId)) issues.push("упражнения вне выбранного фокуса");
  });

  const availableExercises = BASIC_WORKOUT_AI_CATALOGUE.filter((exercise) => (
    exercise.locations.includes(profile.location === "home" ? "home" : "gym") &&
    isExerciseAllowedForRestriction(exercise, profile.restrictions)
  ));

  targets.forEach((target) => {
    if (target === BASIC_WORKOUT_TODAY_TARGETS.full_body) return;
    const hasAvailablePrimary = availableExercises.some((exercise) => target.groups.includes(exercise.groupId));
    const hasSelectedPrimary = target.groups.some((groupId) => selectedGroups.has(groupId));
    if (hasAvailablePrimary && !hasSelectedPrimary) issues.push("нет упражнения для выбранной зоны");
  });

  if (targets[0] === BASIC_WORKOUT_TODAY_TARGETS.full_body) {
    const areaForGroup = (groupId) => {
      if (["quads", "posterior_chain", "calves"].includes(groupId)) return "lower";
      if (["chest_press", "chest_incline", "chest_fly", "shoulder_press", "side_delts", "rear_delts", "triceps"].includes(groupId)) return "push";
      if (["vertical_pull", "horizontal_pull", "biceps", "forearms"].includes(groupId)) return "pull";
      return groupId === "core" ? "core" : "";
    };
    const availableAreas = new Set(availableExercises.map((exercise) => areaForGroup(exercise.groupId)).filter(Boolean));
    const selectedAreas = new Set([...selectedGroups].map(areaForGroup).filter(Boolean));
    if (selectedAreas.size < Math.min(3, expectedCount, availableAreas.size)) {
      issues.push("несбалансированной тренировки full body");
    }
  }

  return [...new Set(issues)];
}
