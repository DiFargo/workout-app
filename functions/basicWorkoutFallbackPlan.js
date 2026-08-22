import { BASIC_WORKOUT_AI_CATALOGUE } from "./basicWorkoutAiCatalogue.generated.js";

const EXERCISE_TARGETS = {
  "30": 3,
  "45": 5,
  "60": 6,
  "90": 7
};

const SET_COUNTS = {
  "30": 2,
  "45": 3,
  "60": 3,
  "90": 3
};

const DAY_TEMPLATES = {
  twoDayRecovery: [
    {
      name: "Грудь, плечи, трицепс и квадрицепс",
      focus: "Грудь, плечи, трицепс и передняя поверхность ног",
      roles: ["kneeDominantCompound", "chestPress", "shoulderPress", "chestAccessory", "triceps", "shoulderAccessory", "core"]
    },
    {
      name: "Спина, бицепс и задняя цепь",
      focus: "Спина, бицепс и задняя поверхность ног",
      roles: ["hipDominantCompound", "verticalPull", "horizontalPull", "shoulderAccessory", "biceps", "shoulderAccessory", "core"]
    }
  ],
  twoDayBalanced: [
    {
      name: "Всё тело · акцент на грудь и квадрицепс",
      focus: "Квадрицепс, грудь и спина",
      roles: ["kneeDominantCompound", "chestPress", "horizontalPull", "shoulderAccessory", "triceps", "biceps", "core"]
    },
    {
      name: "Всё тело · акцент на спину и заднюю цепь",
      focus: "Задняя цепь, спина и грудь",
      roles: ["hipDominantCompound", "verticalPull", "chestPress", "shoulderAccessory", "biceps", "triceps", "core"]
    }
  ],
  threeDay: [
    {
      name: "Ноги и кор",
      focus: "Ноги, ягодицы и кор",
      roles: ["kneeDominantCompound", "hipDominantCompound", "lowerAccessory", "lowerAccessory", "lowerAccessory", "shoulderAccessory", "core"]
    },
    {
      name: "Жимовой верх",
      focus: "Грудь, плечи и трицепс",
      roles: ["chestPress", "shoulderPress", "chestAccessory", "shoulderAccessory", "shoulderAccessory", "triceps", "core"]
    },
    {
      name: "Тяговой верх",
      focus: "Спина, задняя дельта и бицепс",
      roles: ["verticalPull", "horizontalPull", "shoulderAccessory", "shoulderAccessory", "biceps", "lowerAccessory", "core"]
    }
  ],
  fourDay: [
    {
      name: "Жимовой верх",
      focus: "Грудь, плечи и трицепс",
      roles: ["chestPress", "shoulderPress", "chestAccessory", "shoulderAccessory", "shoulderAccessory", "triceps", "core"]
    },
    {
      name: "Ноги · передняя поверхность",
      focus: "Квадрицепс и икры",
      roles: ["kneeDominantCompound", "lowerAccessory", "lowerAccessory", "lowerAccessory", "shoulderAccessory", "biceps", "core"]
    },
    {
      name: "Тяговой верх",
      focus: "Спина, задняя дельта и бицепс",
      roles: ["verticalPull", "horizontalPull", "shoulderAccessory", "shoulderAccessory", "biceps", "lowerAccessory", "core"]
    },
    {
      name: "Ноги · задняя цепь",
      focus: "Ягодицы, задняя поверхность ног и икры",
      roles: ["hipDominantCompound", "lowerAccessory", "lowerAccessory", "lowerAccessory", "shoulderAccessory", "triceps", "core"]
    }
  ],
  fiveDay: [
    {
      name: "Жимовой верх",
      focus: "Грудь, плечи и трицепс",
      roles: ["chestPress", "shoulderPress", "chestAccessory", "shoulderAccessory", "shoulderAccessory", "triceps", "core"]
    },
    {
      name: "Ноги · передняя поверхность",
      focus: "Квадрицепс и икры",
      roles: ["kneeDominantCompound", "lowerAccessory", "lowerAccessory", "lowerAccessory", "shoulderAccessory", "biceps", "core"]
    },
    {
      name: "Тяговой верх",
      focus: "Спина, задняя дельта и бицепс",
      roles: ["verticalPull", "horizontalPull", "shoulderAccessory", "shoulderAccessory", "biceps", "lowerAccessory", "core"]
    },
    {
      name: "Ноги · задняя цепь",
      focus: "Ягодицы, задняя поверхность ног и икры",
      roles: ["hipDominantCompound", "lowerAccessory", "lowerAccessory", "lowerAccessory", "shoulderAccessory", "triceps", "core"]
    },
    {
      name: "Лёгкое всё тело",
      focus: "Техника, общая подвижность и отстающие группы",
      roles: ["kneeDominantCompound", "chestPress", "horizontalPull", "lowerAccessory", "shoulderAccessory", "biceps", "core"]
    }
  ]
};

// These templates are deliberately conservative fallbacks, not treatment plans.
// They keep a user from being blocked when the model response cannot pass the
// catalogue validator, while avoiding the most obvious aggravating patterns for
// the selected area. The in-app safety note remains visible on the resulting plan.
const RESTRICTION_DAY_TEMPLATES = {
  back: [
    {
      name: "Ноги, грудь и руки",
      focus: "Ноги, грудь, руки и кор",
      roles: ["kneeDominantCompound", "chestPress", "shoulderPress", "chestAccessory", "triceps", "shoulderAccessory", "core"]
    },
    {
      name: "Спина и руки",
      focus: "Спина, руки и кор",
      roles: ["hipDominantCompound", "verticalPull", "horizontalPull", "shoulderAccessory", "biceps", "triceps", "core"]
    },
    {
      name: "Ноги и кор",
      focus: "Ноги, руки и кор",
      roles: ["kneeDominantCompound", "lowerAccessory", "lowerAccessory", "biceps", "triceps", "shoulderAccessory", "core"]
    },
    {
      name: "Верх тела",
      focus: "Грудь, спина и руки",
      roles: ["chestPress", "verticalPull", "chestAccessory", "shoulderAccessory", "biceps", "triceps", "core"]
    },
    {
      name: "Лёгкий смешанный день",
      focus: "Ноги, верх тела и кор",
      roles: ["kneeDominantCompound", "horizontalPull", "chestPress", "biceps", "triceps", "shoulderAccessory", "core"]
    }
  ],
  knees: [
    {
      name: "Жимовой верх",
      focus: "Грудь, плечи, руки и кор",
      roles: ["chestPress", "shoulderPress", "chestAccessory", "shoulderAccessory", "triceps", "biceps", "core"]
    },
    {
      name: "Тяговой верх",
      focus: "Спина, руки и кор",
      roles: ["verticalPull", "horizontalPull", "shoulderAccessory", "biceps", "triceps", "chestAccessory", "core"]
    },
    {
      name: "Верх тела и руки",
      focus: "Грудь, спина, руки и кор",
      roles: ["biceps", "triceps", "shoulderAccessory", "chestAccessory", "chestPress", "verticalPull", "core"]
    },
    {
      name: "Жимовой верх",
      focus: "Грудь, плечи, руки и кор",
      roles: ["chestPress", "shoulderPress", "chestAccessory", "shoulderAccessory", "triceps", "biceps", "core"]
    },
    {
      name: "Тяговой верх",
      focus: "Спина, руки и кор",
      roles: ["verticalPull", "horizontalPull", "shoulderAccessory", "biceps", "triceps", "chestAccessory", "core"]
    }
  ],
  shoulders: [
    {
      name: "Ноги, руки и кор",
      focus: "Ноги, руки и кор без прямой работы на плечевой пояс",
      roles: ["kneeDominantCompound", "hipDominantCompound", "biceps", "triceps", "lowerAccessory", "lowerAccessory", "core"]
    },
    {
      name: "Ноги и руки",
      focus: "Ноги, руки и кор без прямой работы на плечевой пояс",
      roles: ["hipDominantCompound", "kneeDominantCompound", "triceps", "biceps", "lowerAccessory", "lowerAccessory", "core"]
    },
    {
      name: "Ноги с лёгкой работой на руки",
      focus: "Ноги, руки и кор без прямой работы на плечевой пояс",
      roles: ["kneeDominantCompound", "hipDominantCompound", "biceps", "triceps", "lowerAccessory", "lowerAccessory", "core"]
    },
    {
      name: "Ноги и кор",
      focus: "Ноги, руки и кор без прямой работы на плечевой пояс",
      roles: ["hipDominantCompound", "kneeDominantCompound", "triceps", "biceps", "lowerAccessory", "lowerAccessory", "core"]
    },
    {
      name: "Лёгкий день для ног",
      focus: "Ноги, руки и кор без прямой работы на плечевой пояс",
      roles: ["kneeDominantCompound", "hipDominantCompound", "biceps", "triceps", "lowerAccessory", "lowerAccessory", "core"]
    }
  ]
};

const RESTRICTION_EXCLUDED_IDS = {
  back: new Set([
    "db_rdl",
    "romanian_deadlift",
    "hip_thrust",
    "back_extension",
    "cable_crunch",
    "floor_crunch",
    "hanging_knee_raise",
    "reverse_crunch"
  ]),
  knees: new Set(["hanging_knee_raise"])
};

const RESTRICTION_EXCLUDED_ROLES = {
  knees: new Set(["kneeDominantCompound", "hipDominantCompound", "lowerAccessory"]),
  shoulders: new Set([
    "chestPress",
    "chestAccessory",
    "verticalPull",
    "horizontalPull",
    "shoulderPress",
    "shoulderAccessory"
  ])
};

function getExerciseTarget(duration) {
  return EXERCISE_TARGETS[String(duration)] || EXERCISE_TARGETS["45"];
}

function getSetCount(duration, level) {
  if (String(duration) === "45" && String(level) === "beginner") return 2;
  return SET_COUNTS[String(duration)] || SET_COUNTS["45"];
}

function getTemplates(days, twoDayStructure, restrictions = "none") {
  const dayCount = Math.max(2, Math.min(5, Number(days) || 3));
  const restrictedTemplates = RESTRICTION_DAY_TEMPLATES[restrictions];
  if (restrictedTemplates) return restrictedTemplates.slice(0, dayCount);
  if (dayCount === 2) {
    return twoDayStructure === "balanced_full_body"
      ? DAY_TEMPLATES.twoDayBalanced
      : DAY_TEMPLATES.twoDayRecovery;
  }
  if (dayCount === 3) return DAY_TEMPLATES.threeDay;
  if (dayCount === 4) return DAY_TEMPLATES.fourDay;
  return DAY_TEMPLATES.fiveDay;
}

function getRoleSequence(roles, target) {
  const withoutCore = roles.filter((role) => role !== "core");
  return [...withoutCore.slice(0, Math.max(0, target - 1)), "core"];
}

function buildRolePools(location, restrictions = "none") {
  const excludedIds = RESTRICTION_EXCLUDED_IDS[restrictions] || new Set();
  const excludedRoles = RESTRICTION_EXCLUDED_ROLES[restrictions] || new Set();
  const pools = new Map();
  BASIC_WORKOUT_AI_CATALOGUE
    .filter((exercise) => (
      exercise.locations.includes(location)
      && !excludedIds.has(exercise.id)
      && !excludedRoles.has(exercise.movementRole)
    ))
    .forEach((exercise) => {
      const pool = pools.get(exercise.movementRole) || [];
      pool.push(exercise);
      pools.set(exercise.movementRole, pool);
    });
  return pools;
}

function chooseExercise(role, pools, roleOffsets, usedIds) {
  const pool = pools.get(role) || [];
  if (!pool.length) throw new Error(`No reviewed fallback exercise for role ${role}`);

  const start = Number(roleOffsets.get(role) || 0) % pool.length;
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(start + offset) % pool.length];
    if (usedIds.has(candidate.id)) continue;
    roleOffsets.set(role, start + offset + 1);
    usedIds.add(candidate.id);
    return candidate;
  }

  throw new Error(`No distinct reviewed fallback exercise for role ${role}`);
}

function buildExercise(exercise, setCount) {
  const isTimed = Number(exercise.durationSeconds) > 0;
  const reps = /Compound$/u.test(exercise.movementRole) ? 8 : 10;
  const set = isTimed
    ? { reps: 0, weight: "", durationSeconds: Math.max(20, Number(exercise.durationSeconds) || 30) }
    : { reps, weight: "", durationSeconds: 0 };

  return {
    catalogueId: exercise.id,
    name: exercise.name,
    note: exercise.note,
    restSeconds: exercise.restSeconds,
    sets: Array.from({ length: setCount }, () => ({ ...set }))
  };
}

function getSafetyNote(restrictions = "none") {
  if (restrictions === "none") {
    return "Останавливайте упражнение при боли и соблюдайте комфортную технику.";
  }

  return "Вы выбрали ограничение. Этот план не является медицинской реабилитацией: выполняйте только движения без боли и согласуйте нагрузку со специалистом, если боль сохраняется или была травма.";
}

/**
 * Produces two valid basic weeks entirely from the reviewed server catalogue.
 * It is used only as a non-medical fallback after the model fails validation.
 */
export function buildBasicWorkoutFallbackDraft({
  location = "gym",
  days = 3,
  duration = "45",
  level = "beginner",
  twoDayStructure = "recovery_split",
  restrictions = "none"
} = {}) {
  const targetLocation = String(location || "gym") === "home" ? "home" : "gym";
  const targetRestrictions = ["back", "knees", "shoulders", "other"].includes(String(restrictions))
    ? String(restrictions)
    : "none";
  const templates = getTemplates(days, twoDayStructure, targetRestrictions);
  const target = getExerciseTarget(duration);
  const setCount = getSetCount(duration, level);
  const pools = buildRolePools(targetLocation, targetRestrictions);
  const roleOffsets = new Map();

  const weeks = Array.from({ length: 2 }, () => ({
    workouts: templates.map((template) => {
      const usedIds = new Set();
      const exercises = getRoleSequence(template.roles, target).map((role) => (
        buildExercise(chooseExercise(role, pools, roleOffsets, usedIds), setCount)
      ));

      return {
        name: template.name,
        focus: template.focus,
        exercises
      };
    })
  }));

  return {
    name: "Базовый план на 4 недели",
    description: "План построен из проверенных упражнений с двумя вариантами недель и спокойной прогрессией.",
    safetyNote: getSafetyNote(targetRestrictions),
    progressionNote: "Во второй неделе используются безопасные альтернативы там, где они доступны; затем варианты повторяются с небольшой прогрессией.",
    generatedBy: "safe_fallback",
    generationFallback: true,
    weeks
  };
}
