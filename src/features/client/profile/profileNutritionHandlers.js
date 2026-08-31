import { safeWriteUserJsonStorage } from "../../../utils/userScopedStorage.js";
import { getAiNutritionProfileValidation } from "../../../utils/aiNutritionCalculations.js";

export function saveAiBodyMetricsWithDeps({
  auth,
  nutrition,
  history,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  defaultNutritionState,
  aiNutritionProfileStorageKey,
  aiNutritionPlanStorageKey,
  buildAiNutritionMonthlyPlan,
  getAiNutritionDayMacros,
  setAiNutritionProfileDraft,
  setAiNutritionProfile,
  setAiNutritionSavedPlan,
  setNutrition
}) {
  const nextProfile = {
    ...(aiNutritionProfile || {}),
    ...aiNutritionProfileDraft,
    weight: String(aiNutritionProfileDraft.weight || "").trim(),
    targetWeight: String(aiNutritionProfileDraft.targetWeight || "").trim(),
    height: String(aiNutritionProfileDraft.height || "").trim(),
    age: String(aiNutritionProfileDraft.age || "").trim(),
    sex: aiNutritionProfileDraft.sex || "male",
    activity: aiNutritionProfileDraft.activity || "medium",
    goal: aiNutritionProfileDraft.goal || "recomp",
    trainingDays: Array.isArray(aiNutritionProfileDraft.trainingDays) ? aiNutritionProfileDraft.trainingDays : []
  };

  if (!getAiNutritionProfileValidation(nextProfile).valid) return false;

  const nextPlan = buildAiNutritionMonthlyPlan(nutrition, nextProfile, history, null);
  const nextWeek = nextPlan?.weeks?.[0] || nextPlan?.start || nutrition.goals;
  const nextMacros = getAiNutritionDayMacros(nextWeek, nextProfile);

  setAiNutritionProfileDraft(nextProfile);
  setAiNutritionProfile(nextProfile);
  setAiNutritionSavedPlan(nextPlan);
  setNutrition((prev) => ({
    ...prev,
    goals: {
      ...(prev.goals || defaultNutritionState.goals),
      calories: Math.round(nextMacros.calories || nextWeek.calories || prev.goals?.calories || 0),
      protein: Math.round(nextMacros.protein || nextWeek.protein || prev.goals?.protein || 0),
      fat: Math.round(nextMacros.fat || nextWeek.fat || prev.goals?.fat || 0),
      carbs: Math.round(nextMacros.carbs || nextWeek.carbs || prev.goals?.carbs || 0)
    }
  }));

  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      safeWriteUserJsonStorage(aiNutritionProfileStorageKey, uid, nextProfile);
      safeWriteUserJsonStorage(aiNutritionPlanStorageKey, uid, nextPlan);
    }
  } catch {
    // Local persistence is best effort only.
  }

  return true;
}

export async function saveProfileNutritionPlanAndCloseWithDeps({
  aiNutritionProfileDraft,
  profileNutritionSaveStatus,
  saveAiNutritionPlan,
  showAppError,
  setProfileNutritionSaveStatus
}) {
  if (profileNutritionSaveStatus === "saving" || profileNutritionSaveStatus === "saved") return;

  setProfileNutritionSaveStatus("saving");
  const savedToCloud = await saveAiNutritionPlan(aiNutritionProfileDraft);

  if (!savedToCloud) {
    setProfileNutritionSaveStatus("error");
    showAppError(
      "save",
      "План сохранён на устройстве, но не отправлен в облако. Проверь соединение и повтори."
    );
    return;
  }

  setProfileNutritionSaveStatus("saved");
}

export function createProfileNutritionHandlers(getContext) {
  async function saveAiBodyMetrics() {
    const {
      aiNutritionProfileDraft,
      saveAiNutritionPlan
    } = getContext();

    return saveAiNutritionPlan(aiNutritionProfileDraft, { completeFirstSetup: false });
  }

  async function saveProfileNutritionPlanAndClose() {
    const {
      aiNutritionProfileDraft,
      profileNutritionSaveStatus,
      saveAiNutritionPlan,
      setProfileNutritionSaveStatus,
      showAppError
    } = getContext();

    return saveProfileNutritionPlanAndCloseWithDeps({
      aiNutritionProfileDraft,
      profileNutritionSaveStatus,
      saveAiNutritionPlan,
      showAppError,
      setProfileNutritionSaveStatus
    });
  }

  return {
    saveAiBodyMetrics,
    saveProfileNutritionPlanAndClose
  };
}
