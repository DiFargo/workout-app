import { doc, setDoc } from "firebase/firestore";

import { getAiNutritionHistoryBaseline } from "../../../data/aiNutritionBaseline";
import {
  buildAiNutritionMonthlyPlan
} from "../../../utils/aiNutritionPlanBuilder";
import {
  getAiNutritionTrainingDays
} from "../../../utils/aiNutritionSchedule";
import {
  getUserScopedStorageKey,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";

export function createAiNutritionPlanHandlers({
  auth,
  db,
  user,
  nutrition,
  history,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  aiNutritionSavedPlan,
  defaultNutritionState,
  AI_NUTRITION_PROFILE_STORAGE_KEY,
  AI_NUTRITION_PLAN_STORAGE_KEY,
  FIRST_SETUP_DONE_USER_STORAGE_KEY,
  FIRST_SETUP_REQUIRED_VERSION,
  setAiNutritionProfile,
  setAiNutritionProfileDraft,
  setAiNutritionSavedPlan,
  setFirstSetupCompletedInCloud,
  setNutrition
}) {
  async function saveAiNutritionPlan(profileOverride = aiNutritionProfileDraft) {
    const profile = {
      name: String(profileOverride.name || "").trim(),
      weight: String(profileOverride.weight || "").trim(),
      targetWeight: String(profileOverride.targetWeight || "").trim(),
      height: String(profileOverride.height || "").trim(),
      age: String(profileOverride.age || "").trim(),
      sex: profileOverride.sex || "male",
      activity: profileOverride.activity || "medium",
      goal: profileOverride.goal || "recomp",
      trainingDays: getAiNutritionTrainingDays(profileOverride)
    };

    const nextPlan = buildAiNutritionMonthlyPlan(nutrition, profile, history, aiNutritionSavedPlan);
    const weekOne = nextPlan.weeks?.[0];
    const nextGoals = weekOne ? {
      calories: Math.round(Number(weekOne.calories) || defaultNutritionState.goals.calories),
      protein: Math.round(Number(weekOne.protein) || defaultNutritionState.goals.protein),
      fat: Math.round(Number(weekOne.fat) || defaultNutritionState.goals.fat),
      carbs: Math.round(Number(weekOne.carbs) || defaultNutritionState.goals.carbs)
    } : null;

    setAiNutritionProfile(profile);
    setAiNutritionProfileDraft(profile);
    setAiNutritionSavedPlan(nextPlan);

    try {
      if (user?.uid) {
        safeWriteUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, user.uid, profile);
        safeWriteUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, user.uid, nextPlan);
      }
    } catch {
      // ignore localStorage errors
    }

    if (auth.currentUser?.uid) {
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          ...(profile.name ? { name: profile.name } : {}),
          profile,
          aiNutritionProfile: profile,
          aiNutritionPlan: nextPlan,
          ...(nextGoals ? { nutritionGoals: nextGoals } : {}),
          firstSetupCompleted: true,
          firstSetupCompletedVersion: FIRST_SETUP_REQUIRED_VERSION,
          firstSetupCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        if (nextGoals) {
          await setDoc(doc(db, "users", auth.currentUser.uid, "nutrition", "state"), {
            goals: {
              ...nutrition.goals,
              ...nextGoals
            },
            aiNutritionPlan: nextPlan,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        setFirstSetupCompletedInCloud(true);

        try {
          localStorage.setItem(
            FIRST_SETUP_DONE_USER_STORAGE_KEY,
            `${auth.currentUser.uid}:${FIRST_SETUP_REQUIRED_VERSION}`
          );
          localStorage.setItem(
            `${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${auth.currentUser.uid}`,
            FIRST_SETUP_REQUIRED_VERSION
          );
        } catch {
          // ignore localStorage errors
        }
      } catch (error) {
        console.error("Profile save error", error);
        return false;
      }
    } else {
      return false;
    }

    if (nextGoals) {
      setNutrition((prev) => ({
        ...prev,
        goals: {
          ...prev.goals,
          ...nextGoals
        },
        aiNutritionPlan: nextPlan,
        updatedAt: new Date().toISOString()
      }));
    }

    return true;
  }

  function resetAiNutritionPlan() {
    const preservedAnchor = Number(aiNutritionSavedPlan?.calorieAnchor || aiNutritionProfile?.calorieAnchor || getAiNutritionHistoryBaseline().average.calories) || 2374;
    const nextDraft = {
      weight: "",
      height: "",
      age: "",
      sex: aiNutritionProfile?.sex || "male",
      activity: aiNutritionProfile?.activity || "medium",
      goal: aiNutritionProfile?.goal || "recomp",
      trainingDays: getAiNutritionTrainingDays(aiNutritionProfile)
    };

    void preservedAnchor;
    setAiNutritionProfile(null);
    setAiNutritionSavedPlan(null);
    setAiNutritionProfileDraft(nextDraft);

    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        localStorage.removeItem(getUserScopedStorageKey(AI_NUTRITION_PROFILE_STORAGE_KEY, uid));
        localStorage.removeItem(getUserScopedStorageKey(AI_NUTRITION_PLAN_STORAGE_KEY, uid));
      }
    } catch {
      // ignore localStorage errors
    }
  }

  return {
    saveAiNutritionPlan,
    resetAiNutritionPlan
  };
}
