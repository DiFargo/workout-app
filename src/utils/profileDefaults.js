export function hasRequiredAiNutritionProfileFields(profile = {}) {
  const weight = Number(String(profile?.weight || "").replace(",", "."));
  const height = Number(String(profile?.height || "").replace(",", "."));
  const age = Number(String(profile?.age || "").replace(",", "."));
  const sex = String(profile?.sex || "").trim();

  return (
    Number.isFinite(weight) &&
    weight > 0 &&
    Number.isFinite(height) &&
    height > 0 &&
    Number.isFinite(age) &&
    age > 0 &&
    (sex === "male" || sex === "female")
  );
}

export function createEmptyAiNutritionProfileDraft() {
  return {
    name: "",
    weight: "",
    targetWeight: "",
    height: "",
    age: "",
    sex: "male",
    activity: "medium",
    goal: "recomp",
    trainingDays: []
  };
}

export function createEmptyTelegramProfile() {
  return {
    connected: false,
    username: "",
    displayName: "",
    avatarUrl: "",
    chatId: "",
    notificationsEnabled: true
  };
}
