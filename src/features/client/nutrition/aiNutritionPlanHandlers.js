import { doc, writeBatch } from "firebase/firestore";
import { limitUserDisplayName } from "../../../utils/userDisplayName.js";
import { captureAuthSession as captureActiveAuthSession } from "../../../utils/authSession.js";

import {
  buildAiNutritionMonthlyPlan
} from "../../../utils/aiNutritionPlanBuilder";
import { getAiNutritionProfileValidation, parseAiNutritionProfileNumber } from "../../../utils/aiNutritionCalculations";
import {
  getAiNutritionTrainingDays
} from "../../../utils/aiNutritionSchedule";
import {
  getUserScopedStorageKey,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";

export function createAiNutritionPlanHandlers({
  auth,
  captureAuthSession = () => captureActiveAuthSession(auth),
  db,
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
  function updateForSession(session, setter, value) {
    if (!session.isCurrent()) return;
    setter((current) => session.isCurrent()
      ? (typeof value === "function" ? value(current) : value)
      : current);
  }

  async function saveAiNutritionPlan(profileOverride = aiNutritionProfileDraft, options = {}) {
    const session = captureAuthSession();
    const savingUid = session.uid;
    if (!savingUid) return false;
    const completeFirstSetup = options?.completeFirstSetup !== false;
    const profile = {
      name: limitUserDisplayName(profileOverride.name),
      weight: String(parseAiNutritionProfileNumber(profileOverride.weight, "")),
      targetWeight: String(parseAiNutritionProfileNumber(profileOverride.targetWeight, "")),
      height: String(parseAiNutritionProfileNumber(profileOverride.height, "")),
      age: String(parseAiNutritionProfileNumber(profileOverride.age, "")),
      sex: profileOverride.sex || "male",
      activity: profileOverride.activity || "medium",
      goal: profileOverride.goal || "recomp",
      trainingDays: getAiNutritionTrainingDays(profileOverride)
    };

    if (!getAiNutritionProfileValidation(profile).valid) {
      return false;
    }

    const nextPlan = buildAiNutritionMonthlyPlan(nutrition, profile, history, aiNutritionSavedPlan);
    const weekOne = nextPlan.weeks?.[0];
    const nextGoals = weekOne ? {
      calories: Math.round(Number(weekOne.calories) || defaultNutritionState.goals.calories),
      protein: Math.round(Number(weekOne.protein) || defaultNutritionState.goals.protein),
      fat: Math.round(Number(weekOne.fat) || defaultNutritionState.goals.fat),
      carbs: Math.round(Number(weekOne.carbs) || defaultNutritionState.goals.carbs)
    } : null;

    if (savingUid) {
      try {
        const batch = writeBatch(db);
        profile.updatedAt = new Date().toISOString();
        batch.set(doc(db, "users", savingUid), {
          ...(profile.name ? { name: profile.name } : {}),
          profile,
          aiNutritionProfile: profile,
          measurementWeightUpdatedAt: profile.updatedAt,
          aiNutritionPlan: nextPlan,
          ...(nextGoals ? { nutritionGoals: nextGoals } : {}),
          ...(completeFirstSetup ? {
            firstSetupCompleted: true,
            firstSetupCompletedVersion: FIRST_SETUP_REQUIRED_VERSION,
            firstSetupCompletedAt: new Date().toISOString()
          } : {}),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        if (nextGoals) {
          batch.set(doc(db, "users", savingUid, "nutrition", "state"), {
            goals: {
              ...nutrition.goals,
              ...nextGoals
            },
            aiNutritionPlan: nextPlan,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        await batch.commit();
        if (!session.isCurrent()) return false;

        if (completeFirstSetup) {
          updateForSession(session, setFirstSetupCompletedInCloud, true);
        }

        if (completeFirstSetup) {
          try {
            localStorage.setItem(
              FIRST_SETUP_DONE_USER_STORAGE_KEY,
              `${savingUid}:${FIRST_SETUP_REQUIRED_VERSION}`
            );
            localStorage.setItem(
              `${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${savingUid}`,
              FIRST_SETUP_REQUIRED_VERSION
            );
          } catch {
            // ignore localStorage errors
          }
        }
      } catch (error) {
        console.error("Profile save error", error);
        return false;
      }
    } else {
      return false;
    }

    updateForSession(session, setAiNutritionProfile, profile);
    updateForSession(session, setAiNutritionProfileDraft, profile);
    updateForSession(session, setAiNutritionSavedPlan, nextPlan);

    try {
      if (session.isCurrent()) {
        safeWriteUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, savingUid, profile);
        safeWriteUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, savingUid, nextPlan);
      }
    } catch {
      // ignore localStorage errors
    }


    if (nextGoals) {
      updateForSession(session, setNutrition, (prev) => ({
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
    const session = captureAuthSession();
    if (!session.isCurrent()) return;
    const nextDraft = {
      weight: "",
      targetWeight: "",
      height: "",
      age: "",
      sex: aiNutritionProfile?.sex || "male",
      activity: aiNutritionProfile?.activity || "medium",
      goal: aiNutritionProfile?.goal || "recomp",
      trainingDays: getAiNutritionTrainingDays(aiNutritionProfile)
    };

    updateForSession(session, setAiNutritionProfile, null);
    updateForSession(session, setAiNutritionSavedPlan, null);
    updateForSession(session, setAiNutritionProfileDraft, nextDraft);

    try {
      const uid = session.uid;
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
