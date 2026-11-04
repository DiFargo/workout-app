import { doc, writeBatch } from "firebase/firestore";

import { buildTrainerNutritionPlanUpdate } from "../../utils/trainerNutritionPlan";
import { isNutritionDayStorageEnabled } from "../../utils/nutritionDayStorageConfig.js";

const STATUS_SELECT_CLIENT = "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";
const STATUS_REQUIRED_MACROS = "\u0423\u043a\u0430\u0436\u0438 \u043a\u0430\u043b\u043e\u0440\u0438\u0438 \u0438 \u0431\u0435\u043b\u043e\u043a \u0434\u043b\u044f \u043f\u043b\u0430\u043d\u0430 \u043f\u0438\u0442\u0430\u043d\u0438\u044f.";
const STATUS_BAD_DATES = "\u0414\u0430\u0442\u0430 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f \u043f\u043b\u0430\u043d\u0430 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0440\u0430\u043d\u044c\u0448\u0435 \u0434\u0430\u0442\u044b \u043d\u0430\u0447\u0430\u043b\u0430.";
const STATUS_SAVED = "\u041f\u043b\u0430\u043d \u043f\u0438\u0442\u0430\u043d\u0438\u044f \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d \u043a\u043b\u0438\u0435\u043d\u0442\u0443.";
const STATUS_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u043f\u043b\u0430\u043d \u043f\u0438\u0442\u0430\u043d\u0438\u044f.";

function getPositiveMacro(value) {
  return Math.max(0, Number(value) || 0);
}

export function createTrainerNutritionPlanHandlers({
  db,
  auth,
  adminSelectedClient,
  selectedUserId,
  usersList,
  adminClientNutrition,
  setAdminClientStatus,
  setAdminSelectedClient,
  setUsersList,
  setAdminClientNutrition,
  setNutrition,
  mirrorClientForTrainer,
  recordTrainerEvent
}) {
  async function saveTrainerClientNutritionPlan(planDraft = {}) {
    const clientId = adminSelectedClient?.id || selectedUserId;
    if (!clientId) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return false;
    }

    const nextGoals = {
      calories: getPositiveMacro(planDraft.calories),
      protein: getPositiveMacro(planDraft.protein),
      fat: getPositiveMacro(planDraft.fat),
      carbs: getPositiveMacro(planDraft.carbs)
    };

    if (!nextGoals.calories || !nextGoals.protein) {
      setAdminClientStatus(STATUS_REQUIRED_MACROS);
      return false;
    }

    if (planDraft.validFrom && planDraft.validTo && planDraft.validTo < planDraft.validFrom) {
      setAdminClientStatus(STATUS_BAD_DATES);
      return false;
    }

    const dayStorage = isNutritionDayStorageEnabled();
    let currentNutrition = adminClientNutrition;
    if (dayStorage) {
      try { currentNutrition = (await (await import("../../utils/nutritionDayClient.js")).readNutritionState(clientId, { mode: "full" })).state; }
      catch (error) { console.error("Nutrition history load error", error); setAdminClientStatus(STATUS_FAILED); return false; }
    }
    const updatedAt = new Date().toISOString();
    const {
      goals: syncedGoals,
      nutritionPlan: nextPlan,
      nutritionState: nextNutritionState,
      userPatch,
      nutritionStatePatch
    } = buildTrainerNutritionPlanUpdate({
      planDraft,
      currentNutrition,
      updatedAt,
      updatedBy: auth.currentUser?.uid || ""
    });

    try {
      if (dayStorage) {
        await (await import("../../utils/nutritionDayClient.js")).saveNutritionDaySnapshot(clientId, nutritionStatePatch, { planOnly: true, userPatch });
      } else {
        const batch = writeBatch(db);
        batch.set(doc(db, "users", clientId), userPatch, { merge: true });
        batch.set(doc(db, "users", clientId, "nutrition", "state"), nutritionStatePatch, { merge: true });
        await batch.commit();
      }

      setAdminSelectedClient((prev) => prev?.id === clientId ? {
        ...prev,
        nutritionGoals: syncedGoals,
        nutritionPlan: nextPlan,
        ...(nextNutritionState.aiNutritionPlan ? { aiNutritionPlan: nextNutritionState.aiNutritionPlan } : {}),
        nutritionState: {
          ...(prev.nutritionState || {}),
          goals: nextNutritionState.goals,
          nutritionPlan: nextPlan,
          ...(nextNutritionState.aiNutritionPlan ? { aiNutritionPlan: nextNutritionState.aiNutritionPlan } : {}),
          updatedAt
        }
      } : prev);
      setUsersList((prev) => prev.map((client) => client.id === clientId ? {
        ...client,
        nutritionGoals: syncedGoals,
        nutritionPlan: nextPlan,
        ...(nextNutritionState.aiNutritionPlan ? { aiNutritionPlan: nextNutritionState.aiNutritionPlan } : {}),
        nutritionState: {
          ...(client.nutritionState || {}),
          goals: nextNutritionState.goals,
          nutritionPlan: nextPlan,
          ...(nextNutritionState.aiNutritionPlan ? { aiNutritionPlan: nextNutritionState.aiNutritionPlan } : {}),
          updatedAt
        }
      } : client));
      setAdminClientNutrition(nextNutritionState);

      if (auth.currentUser?.uid === clientId) {
        setNutrition((prev) => ({
          ...prev,
          goals: {
            ...(prev.goals || {}),
            ...syncedGoals
          },
          nutritionPlan: nextPlan,
          updatedAt
        }));
      }

      await mirrorClientForTrainer({
        ...(adminSelectedClient || usersList.find((client) => client.id === clientId) || {}),
        id: clientId,
        nutritionGoals: nextGoals,
        nutritionPlan: nextPlan,
        nutritionState: nextNutritionState
      }, nextNutritionState);

      await recordTrainerEvent(
        clientId,
        "nutrition",
        "\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d \u043f\u043b\u0430\u043d \u043f\u0438\u0442\u0430\u043d\u0438\u044f",
        `${nextPlan.name} \u00b7 ${syncedGoals.calories} \u043a\u043a\u0430\u043b`
      );
      setAdminClientStatus(STATUS_SAVED);
      return true;
    } catch (error) {
      console.error("Trainer nutrition plan save error:", error);
      setAdminClientStatus(STATUS_FAILED);
      return false;
    }
  }

  return {
    saveTrainerClientNutritionPlan
  };
}
