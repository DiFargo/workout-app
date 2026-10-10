// Shared by the questionnaire, server and offline generator. Missing values keep
// the established split. The generator honors the selected format; the quiz may
// offer an editable product default for a narrowly defined profile scenario.
export const BASIC_WORKOUT_EMPHASIS_OPTIONS = [
  { value: "balanced", label: "Сбалансированно", hint: "Всё тело: распределяем работу на ноги и верх в течение недели." },
  { value: "lower", label: "Ноги и ягодицы", hint: "Больше упражнений на низ тела. Грудь, спина и плечи остаются в программе." },
  { value: "upper", label: "Верх тела", hint: "Больше упражнений на грудь, спину и плечи. Ноги остаются в программе." },
  { value: "classic", label: "По группам мышц", hint: "Прежняя схема. При 3 занятиях: ноги → жимовой верх → тяговой верх." }
];

export const FULL_BODY_331_OPTION = { value: "full_body_331", label: "Всё тело · 3 + 3 + 1", hint: "В каждой тренировке: 3 упражнения на ноги, 3 на верх тела и 1 на пресс. По 3 подхода." };

export function canUseFullBody331(profile = {}) {
  return ["1", "2"].includes(String(profile.days)) && ["60", "90"].includes(String(profile.duration))
    && profile.location === "gym" && profile.restrictions === "none";
}

export function getAvailableWorkoutEmphases(profile = {}) {
  return canUseFullBody331(profile) ? [FULL_BODY_331_OPTION, ...BASIC_WORKOUT_EMPHASIS_OPTIONS] : BASIC_WORKOUT_EMPHASIS_OPTIONS;
}

export function normalizeWorkoutEmphasis(value) {
  return [...BASIC_WORKOUT_EMPHASIS_OPTIONS, FULL_BODY_331_OPTION].some((option) => option.value === value) ? value : "classic";
}

export function getWorkoutEmphasisOption(value) {
  return [...BASIC_WORKOUT_EMPHASIS_OPTIONS, FULL_BODY_331_OPTION].find((option) => option.value === normalizeWorkoutEmphasis(value));
}

const K = "kneeDominantCompound", H = "hipDominantCompound", L = "lowerAccessory";
const P = "chestPress", V = "verticalPull", R = "horizontalPull", S = "shoulderPress";
const A = "shoulderAccessory", B = "biceps", T = "triceps";
const template = (name, roles) => ({ name, focus: name, roles });
const TEMPLATES = {
  fullA: template("Всё тело · вариант А", [K, P, R, H, A, B]),
  fullB: template("Всё тело · вариант Б", [H, V, P, K, A, T]),
  fullC: template("Всё тело · вариант В", [K, S, R, H, "chestAccessory", B]),
  lowerA: template("Ноги и ягодицы · вариант А", [K, H, L, L, P, R]),
  lowerB: template("Ноги и ягодицы · вариант Б", [H, K, L, L, V, P]),
  upperA: template("Верх тела · вариант А", [P, R, S, V, A, T]),
  upperB: template("Верх тела · вариант Б", [V, P, S, R, A, B]),
  lowerMixedA: template("Всё тело · акцент на ноги", [K, H, P, L, L, R]),
  lowerMixedB: template("Всё тело · акцент на ягодицы", [H, K, V, L, L, P]),
  upperMixed: template("Верх тела и ноги", [K, V, P, S, R, T]),
  upperRecovery: template("Ноги и всё тело", [H, P, K, L, A, R])
};

const WEEKS = {
  balanced: { 2: ["fullA", "fullB"], 3: ["fullA", "fullB", "fullC"],
    4: ["lowerA", "upperA", "lowerB", "upperB"], 5: ["lowerA", "upperA", "fullA", "upperB", "lowerB"] },
  lower: { 2: ["lowerMixedA", "lowerMixedB"], 3: ["lowerA", "upperA", "lowerB"],
    4: ["lowerA", "upperA", "lowerB", "fullA"], 5: ["lowerA", "upperA", "lowerB", "upperB", "lowerA"] },
  upper: { 2: ["upperA", "upperMixed"], 3: ["upperA", "upperRecovery", "upperB"],
    4: ["upperA", "upperRecovery", "upperB", "fullA"], 5: ["upperA", "upperRecovery", "upperB", "upperRecovery", "upperA"] }
};

export function getEmphasisWorkoutTemplates(value, days, exerciseTarget) {
  const emphasis = normalizeWorkoutEmphasis(value);
  if (emphasis === "full_body_331") {
    return [template("Всё тело · 3 ноги + 3 верх + пресс · А", [K, H, L, P, R, S, "core"]),
      template("Всё тело · 3 ноги + 3 верх + пресс · Б", [H, K, L, V, P, A, "core"])].slice(0, Number(days) === 1 ? 1 : 2);
  }
  if (Number(days) === 1) {
    const source = emphasis === "lower" ? TEMPLATES.lowerMixedA : emphasis === "upper" ? TEMPLATES.upperMixed : TEMPLATES.fullA;
    return [{ ...source, roles: exerciseTarget <= 3 ? source.roles.slice(0, exerciseTarget) : [...source.roles.slice(0, exerciseTarget - 1), "core"] }];
  }
  if (emphasis === "classic") return null;
  const count = Math.max(2, Math.min(5, Number(days) || 3));
  return WEEKS[emphasis][count].map((key) => {
    const source = TEMPLATES[key];
    // Short sessions keep the main movements; longer sessions finish with core.
    // Unlike the legacy split, a mandatory core slot must not crowd out an entire
    // push/pull pattern when only three exercises fit into the session.
    const roles = exerciseTarget <= 3 ? source.roles.slice(0, exerciseTarget)
      : [...source.roles.slice(0, exerciseTarget - 1), "core"];
    return { ...source, roles };
  });
}

export function summarizeWorkoutEmphasis(workouts = []) {
  const totals = { lower: 0, upper: 0, core: 0 };
  for (const workout of workouts) for (const exercise of workout.exercises || []) {
    const role = exercise.basicMovementRole || exercise.movementRole;
    const region = [K, H, L].includes(role) ? "lower" : role === "core" ? "core" : "upper";
    totals[region] += exercise.sets?.length || 0;
  }
  return totals;
}
