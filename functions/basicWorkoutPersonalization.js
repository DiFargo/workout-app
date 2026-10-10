// Shared by the browser and Functions: no Firebase imports or personal identifiers.
export const WORKOUT_PERSONALIZATION_VERSION = 2;
const number = (value, min, max) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};
const choice = (value, options) => options.includes(value) ? value : "";
export const workoutText = (value, limit = 280) => String(value || "")
  .replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ()-]{8,}\d/giu, "[контакт удалён]")
  .replace(/\p{Cc}/gu, " ").trim().slice(0, limit);

export function normalizeWorkoutRegistration(input = {}) {
  return {
    sex: choice(input.sex, ["male", "female"]),
    age: number(input.age, 14, 100), height: number(input.height, 100, 240),
    weight: number(input.weight, 25, 350), targetWeight: number(input.targetWeight, 25, 350),
    activity: choice(input.activity, ["low", "medium", "high", "veryHigh"]),
    goal: choice(input.goal, ["cut", "mass", "recomp", "maintain"]),
    trainingDays: [...new Set((Array.isArray(input.trainingDays) ? input.trainingDays : [])
      .filter((day) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].includes(day)))].slice(0, 7),
    weightMeasuredAt: /^\d{4}-\d{2}-\d{2}$/.test(input.weightMeasuredAt || "") ? input.weightMeasuredAt : ""
  };
}

export function normalizeWorkoutTrainingHistory(input = []) {
  return (Array.isArray(input) ? input : []).slice(0, 20).flatMap((session) => {
    const daysAgo = number(session?.daysAgo, 0, 90);
    if (daysAgo === null) return [];
    const exercises = (Array.isArray(session.exercises) ? session.exercises : []).slice(0, 20).flatMap((exercise) => {
      const completedSets = number(exercise?.completedSets, 1, 20);
      if (completedSets === null) return [];
      return [{ catalogueId: workoutText(exercise.catalogueId, 80), name: workoutText(exercise.name, 100),
        completedSets: Math.floor(completedSets), reps: number(exercise.reps, 1, 100),
        weight: number(exercise.weight, 0, 1000), durationSeconds: number(exercise.durationSeconds, 1, 3600) }];
    });
    return exercises.length ? [{ daysAgo: Math.floor(daysAgo),
      feedback: choice(session.feedback, ["easy", "normal", "hard", "too_hard", "good", "bad", "tired"]), exercises }] : [];
  }).sort((a, b) => a.daysAgo - b.daysAgo);
}

export function getMissingWorkoutProfileFields(input = {}) {
  const profile = normalizeWorkoutRegistration(input);
  return [["sex", "пол"], ["age", "возраст"], ["height", "рост"], ["weight", "вес"]]
    .filter(([key]) => !profile[key]).map(([, label]) => label);
}

export function assertPersonalizedWorkoutAllowed(profile = {}) {
  const registration = normalizeWorkoutRegistration(profile.registration);
  const medicalNote = /беремен|послеродов|после родов|pregnan|postpartum|реабилитац|операци|травм|болит|(?:^|[^\p{L}\p{N}_])боль(?:$|[^\p{L}\p{N}_])|гипертон|диабет|сердц|врач/iu
    .test(String(profile.planPreferences || ""));
  if ((profile.restrictions && profile.restrictions !== "none") || String(profile.restrictionDetails || "").trim()
    || (registration.age && registration.age < 18) || medicalNote
    || ["pregnant", "postpartum", "medical"].includes(profile.specialStatus)) {
    throw Object.assign(new Error("При ограничениях здоровья, беременности, восстановлении после родов или возрасте до 18 лет нужен подбор с тренером. Автоматический план не создан."),
      { code: "basic_workout_review_required", status: 422, noLocalFallback: true });
  }
  const missing = getMissingWorkoutProfileFields(registration);
  if (missing.length) throw Object.assign(new Error(`Заполни в кабинете данные для подбора: ${missing.join(", ")}. Мы не будем угадывать их.`),
    { code: "basic_workout_profile_required", status: 422, noLocalFallback: true });
}

export function getWorkoutPersonalization(profile = {}) {
  const registration = normalizeWorkoutRegistration(profile.registration);
  const trainingHistory = normalizeWorkoutTrainingHistory(profile.trainingHistory);
  const reasons = [];
  if (profile.level === "beginner") reasons.push("beginner");
  if (profile.level === "returning" || (trainingHistory[0]?.daysAgo >= 28)) reasons.push("returning");
  if (registration.activity === "low") reasons.push("low_activity");
  if (registration.age >= 65 && profile.level !== "experienced") reasons.push("older_beginner");
  if (profile.readiness === "low") reasons.push("low_readiness");
  if (trainingHistory[0]?.daysAgo <= 3 && ["hard", "too_hard", "bad", "tired"].includes(trainingHistory[0].feedback)) reasons.push("recent_fatigue");
  return { version: WORKOUT_PERSONALIZATION_VERSION, registration, trainingHistory,
    gentleStart: reasons.length > 0, reasons,
    // Body size/sex are context, never a formula for kilograms or stereotypes.
    loadPolicy: "manual", sexPolicy: "context_not_stereotype" };
}

export function workoutCandidateScore(card, personalization) {
  const familiar = personalization.trainingHistory.some((session) => session.exercises.some((exercise) => exercise.catalogueId === card.id));
  const recent = personalization.trainingHistory.some((session) => session.daysAgo <= 1 && session.exercises.some((exercise) => exercise.catalogueId === card.id));
  let score = familiar ? 4 : 0;
  if (recent) score -= 2;
  if (personalization.gentleStart) {
    if (/тренаж|блок|кроссовер|опор|гравитрон|машин/iu.test(`${card.equipment} ${card.name}`)) score += 3;
    if (/болгар|выпад|висе|подтягивания на перекладине|обратные отжимания/iu.test(card.name)) score -= 3;
  }
  return score;
}
