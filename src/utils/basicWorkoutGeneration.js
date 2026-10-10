import { assertPersonalizedWorkoutAllowed } from "../../functions/basicWorkoutPersonalization.js";
export const HYBRID_WORKOUT_STRATEGY = "personalized_template_slots_v3";

export function getBasicWorkoutGenerationNotice(plan = {}) {
  if (plan.generationStrategy !== HYBRID_WORKOUT_STRATEGY) return "";
  return plan.generationProvider === "gemini" && !plan.generationFallback
    ? "Gemini подобрал упражнения с учётом профиля, анкеты и доступной истории. Параметры проверило приложение. Сохранение — отдельно."
    : `Gemini не использовался: план адаптирован по профилю и истории правилами приложения.${plan.profile?.planPreferences ? " Свободные пожелания без Gemini не интерпретированы." : ""} Сохранение — отдельно.`;
}

export function assertBasicWorkoutGenerationAllowed(quiz = {}, profile = {}) {
  assertPersonalizedWorkoutAllowed({ ...quiz, registration: profile });
}
