import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";

const BASIC_WORKOUT_AI_TIMEOUT_MS = 90000;

function getRegistrationProfile(profile = {}) {
  const asText = (value, maxLength = 24) => String(value || "").trim().slice(0, maxLength);
  const number = (value, min, max) => {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
  };

  return {
    weight: number(profile.weight, 35, 300),
    height: number(profile.height, 120, 240),
    age: number(profile.age, 14, 100),
    sex: ["male", "female"].includes(asText(profile.sex)) ? asText(profile.sex) : "",
    activity: ["low", "medium", "high", "veryHigh"].includes(asText(profile.activity))
      ? asText(profile.activity)
      : "",
    goal: ["cut", "mass", "recomp", "maintain"].includes(asText(profile.goal))
      ? asText(profile.goal)
      : ""
  };
}

function getPlanRequestError(response, data) {
  if (response.status === 429) {
    return new Error("Несколько попыток уже были отправлены. Подождите немного и попробуйте снова — либо выберите готовый базовый план.");
  }

  return new Error(data.message || data.error || "Не удалось составить план. Попробуйте ещё раз.");
}

export async function requestBasicWorkoutAiPlan(quiz = {}, startingWeightProfile = {}) {
  const response = await fetchAuthorizedWithTimeout("/api/ai-basic-workout-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      profile: {
        goal: String(quiz.goal || "general_fitness"),
        level: String(quiz.level || "beginner"),
        location: String(quiz.location || "gym"),
        days: String(quiz.days || "3"),
        duration: String(quiz.duration || "45"),
        restrictions: String(quiz.restrictions || "none"),
        restrictionDetails: String(quiz.restrictionDetails || "").trim().slice(0, 180),
        twoDayStructure: String(quiz.twoDayStructure || "recovery_split"),
        planPreferences: String(quiz.planPreferences || "").trim().slice(0, 280),
        registration: getRegistrationProfile(startingWeightProfile)
      }
    })
  }, BASIC_WORKOUT_AI_TIMEOUT_MS);

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw getPlanRequestError(response, data);
  }
  if (!Array.isArray(data.plan?.workouts) || data.plan.workouts.length === 0) {
    throw new Error("ИИ не вернул готовый план тренировок. Попробуйте ещё раз.");
  }

  return data.plan;
}

export async function requestBasicWorkoutTodayPlan(preferences = {}, startingWeightProfile = {}) {
  const todayTargets = Array.isArray(preferences.todayTargets)
    ? [...new Set(preferences.todayTargets.map((target) => String(target || "").trim()).filter(Boolean))].slice(0, 3)
    : [String(preferences.todayTarget || "chest")];
  const response = await fetchAuthorizedWithTimeout("/api/ai-basic-workout-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      profile: {
        mode: "today",
        goal: String(preferences.goal || "general_fitness"),
        level: String(preferences.level || "beginner"),
        location: String(preferences.location || "gym"),
        duration: String(preferences.duration || "45"),
        restrictions: String(preferences.restrictions || "none"),
        restrictionDetails: String(preferences.restrictionDetails || "").trim().slice(0, 180),
        planPreferences: String(preferences.planPreferences || "").trim().slice(0, 280),
        todayTarget: String(todayTargets[0] || "chest"),
        todayTargets,
        readiness: String(preferences.readiness || "normal"),
        registration: getRegistrationProfile(startingWeightProfile)
      }
    })
  }, BASIC_WORKOUT_AI_TIMEOUT_MS);

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw getPlanRequestError(response, data);
  }
  if (!Array.isArray(data.plan?.workouts) || data.plan.workouts.length !== 1) {
    throw new Error("ИИ не вернул готовую тренировку. Попробуйте ещё раз.");
  }

  return data.plan;
}
