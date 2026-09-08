const CHOICES = {
  goal: ["general_fitness", "fat_loss", "muscle", "strength"],
  level: ["beginner", "returning", "experienced"],
  location: ["gym", "home"],
  days: ["2", "3", "4", "5"],
  duration: ["30", "45", "60", "90"],
  restrictions: ["none", "back", "knees", "shoulders", "other"],
  twoDayStructure: ["recovery_split", "balanced_full_body"]
};

// The quick workout has defaults of its own. They are not answers to this quiz.
export function getBasicWorkoutQuizDraft(source = {}) {
  const answers = source.longPlanAnswers || (source.generatedPlan ? source : {});
  return {
    ...Object.fromEntries(Object.entries(CHOICES).map(([key, options]) => [
      key, options.includes(String(answers[key])) ? String(answers[key]) : ""
    ])),
    restrictionDetails: String(answers.restrictionDetails || "").slice(0, 180),
    planPreferences: String(answers.planPreferences || "").slice(0, 280)
  };
}

export function getBasicWorkoutQuizStepHint(key, quiz) {
  if (key === "planPreferences") {
    return quiz.days === "2" && !CHOICES.twoDayStructure.includes(quiz.twoDayStructure)
      ? "Выбери формат двух тренировок. Пожелание можно оставить пустым."
      : "";
  }
  if (!CHOICES[key]?.includes(quiz[key])) return "Выбери один вариант, чтобы продолжить.";
  if (key === "restrictions" && quiz.restrictions === "other" && !quiz.restrictionDetails.trim()) {
    return "Кратко опиши ограничение, чтобы мы могли учесть его в плане.";
  }
  return "";
}
