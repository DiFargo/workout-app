import { canUseFullBody331, normalizeWorkoutEmphasis } from "../../functions/basicWorkoutEmphasis.js";

const CHOICES = {
  goal: ["general_fitness", "fat_loss", "muscle", "strength"],
  level: ["beginner", "returning", "experienced"],
  location: ["gym", "home"],
  days: ["1", "2", "3", "4", "5"],
  duration: ["30", "45", "60", "90"],
  restrictions: ["none", "back", "knees", "shoulders", "other"],
  twoDayStructure: ["recovery_split", "balanced_full_body"]
};

// Match each slider's initial visible option with a real, editable answer.
// Health restrictions still require an explicit answer, never an assumed "none".
const SLIDER_DEFAULTS = {
  goal: "general_fitness",
  level: "beginner",
  location: "gym",
  days: "1",
  duration: "30"
};

// Quick-workout preferences are separate; restore only long-plan answers.
export function getBasicWorkoutQuizDraft(source = {}) {
  const answers = source.longPlanAnswers || (source.generatedPlan ? source : {});
  return {
    ...Object.fromEntries(Object.entries(CHOICES).map(([key, options]) => [
      key, options.includes(String(answers[key])) ? String(answers[key]) : SLIDER_DEFAULTS[key] || ""
    ])),
    restrictionDetails: String(answers.restrictionDetails || "").slice(0, 180),
    planPreferences: String(answers.planPreferences || "").slice(0, 280),
    trainingEmphasis: normalizeWorkoutEmphasis(answers.trainingEmphasis),
    trainingEmphasisChosen: answers.trainingEmphasisChosen === true,
    specialStatus: ["none", "pregnant", "postpartum", "medical"].includes(answers.specialStatus) ? answers.specialStatus : ""
  };
}

// A visible suggestion for the exact product scenario requested by the trainer.
// It never rewrites a saved plan, nor overrides a client's deliberate choice.
export function resolveQuizWorkoutEmphasis(quiz, registration = {}) {
  if (quiz.trainingEmphasis === "full_body_331" && !canUseFullBody331(quiz)) return "balanced";
  if (!quiz.trainingEmphasisChosen && quiz.trainingEmphasis === "classic" && registration.sex === "female"
    && quiz.goal === "general_fitness" && quiz.level === "returning" && canUseFullBody331(quiz)) return "full_body_331";
  return quiz.trainingEmphasis;
}

export function getBasicWorkoutQuizStepHint(key, quiz) {
  if (key === "planPreferences") {
    return normalizeWorkoutEmphasis(quiz.trainingEmphasis) === "classic" && quiz.days === "2" && !CHOICES.twoDayStructure.includes(quiz.twoDayStructure)
      ? "Выбери формат двух тренировок. Пожелание можно оставить пустым."
      : "";
  }
  if (!CHOICES[key]?.includes(quiz[key])) return "Выбери один вариант, чтобы продолжить.";
  if (key === "restrictions" && quiz.restrictions === "other" && !quiz.restrictionDetails.trim()) {
    return "Кратко опиши ограничение, чтобы мы могли учесть его в плане.";
  }
  return "";
}
