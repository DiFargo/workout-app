import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import { assertBasicWorkoutGenerationAllowed, HYBRID_WORKOUT_STRATEGY } from "../../../utils/basicWorkoutGeneration.js";
import { normalizeWorkoutRegistration, normalizeWorkoutTrainingHistory } from "../../../../functions/basicWorkoutPersonalization.js";
import { normalizeWorkoutEmphasis } from "../../../../functions/basicWorkoutEmphasis.js";

const BASIC_WORKOUT_AI_TIMEOUT_MS = 90000;

function getPlanRequestError(response, data) {
  if (response.status === 429) {
    return new Error("Несколько попыток уже были отправлены. Подождите немного и попробуйте снова — либо выберите готовый базовый план.");
  }

  return Object.assign(new Error(data.message || data.error || "Не удалось составить план. Попробуйте ещё раз."), {
    code: data.error,
    noLocalFallback: [401, 403, 422].includes(response.status)
  });
}

function requireHybridResponse(data) {
  if (data.plan?.generationStrategy !== HYBRID_WORKOUT_STRATEGY) {
    throw Object.assign(new Error("Сервер ещё не поддерживает подбор Gemini. Сначала нужно опубликовать обновление сервера."), { noLocalFallback: true });
  }
}

export async function requestBasicWorkoutAiPlan(quiz = {}, startingWeightProfile = {}, trainingHistory = []) {
  assertBasicWorkoutGenerationAllowed(quiz, startingWeightProfile);
  const response = await fetchAuthorizedWithTimeout("/api/ai-basic-workout-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "gemini",
      profile: {
        goal: String(quiz.goal || "general_fitness"),
        level: String(quiz.level || "beginner"),
        location: String(quiz.location || "gym"),
        days: String(quiz.days || "3"),
        duration: String(quiz.duration || "45"),
        restrictions: String(quiz.restrictions || "none"),
        restrictionDetails: String(quiz.restrictionDetails || "").trim().slice(0, 180),
        twoDayStructure: String(quiz.twoDayStructure || "recovery_split"),
        trainingEmphasis: normalizeWorkoutEmphasis(quiz.trainingEmphasis),
        planPreferences: String(quiz.planPreferences || "").trim().slice(0, 280),
        registration: normalizeWorkoutRegistration(startingWeightProfile),
        trainingHistory: normalizeWorkoutTrainingHistory(trainingHistory),
        specialStatus: quiz.specialStatus || ""
      }
    })
  }, BASIC_WORKOUT_AI_TIMEOUT_MS);

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw getPlanRequestError(response, data);
  }
  requireHybridResponse(data);
  if (normalizeWorkoutEmphasis(data.plan?.trainingEmphasis) !== normalizeWorkoutEmphasis(quiz.trainingEmphasis)) {
    throw Object.assign(new Error("Сервер не применил выбранный акцент. План не сохранён. Обнови приложение или выбери готовый базовый план."), { noLocalFallback: true });
  }
  if (!Array.isArray(data.plan?.workouts) || data.plan.workouts.length === 0) {
    throw new Error("ИИ не вернул готовый план тренировок. Попробуйте ещё раз.");
  }

  return data.plan;
}

export async function requestBasicWorkoutTodayPlan(preferences = {}, startingWeightProfile = {}, trainingHistory = []) {
  assertBasicWorkoutGenerationAllowed(preferences, startingWeightProfile);
  const todayTargets = Array.isArray(preferences.todayTargets)
    ? [...new Set(preferences.todayTargets.map((target) => String(target || "").trim()).filter(Boolean))].slice(0, 3)
    : [String(preferences.todayTarget || "chest")];
  const response = await fetchAuthorizedWithTimeout("/api/ai-basic-workout-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "gemini",
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
        registration: normalizeWorkoutRegistration(startingWeightProfile),
        trainingHistory: normalizeWorkoutTrainingHistory(trainingHistory),
        specialStatus: preferences.specialStatus || ""
      }
    })
  }, BASIC_WORKOUT_AI_TIMEOUT_MS);

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw getPlanRequestError(response, data);
  }
  requireHybridResponse(data);
  if (!Array.isArray(data.plan?.workouts) || data.plan.workouts.length !== 1) {
    throw new Error("ИИ не вернул готовую тренировку. Попробуйте ещё раз.");
  }

  return data.plan;
}
