import { doc, runTransaction } from "firebase/firestore";
import { auth, db } from "../firebase";
import { mergeNutritionStates } from "./nutritionStateMerge";
import { mergeDeletionTimes, mergeMyFoods } from "./nutritionSyncModel.js";
import { assertNutritionDocumentBudget } from "./nutritionDocumentBudget.js";
import { beginNutritionSaveFeedback, finishNutritionSaveFeedback, sameNutritionState } from "./nutritionSyncRevision.js";
import { isNutritionDayStorageEnabled } from "./nutritionDayStorageConfig.js";

export async function saveNutritionStateWithMerge(uid, localNutritionState = {}) {
  const ticket = beginNutritionSaveFeedback(auth, uid, localNutritionState);
  try {
    const result = await persistNutritionStateWithMerge(uid, localNutritionState);
    finishNutritionSaveFeedback(auth, ticket);
    return result;
  } catch (error) {
    finishNutritionSaveFeedback(auth, ticket, error);
    throw error;
  }
}

async function persistNutritionStateWithMerge(uid, localNutritionState) {
  if (isNutritionDayStorageEnabled()) return (await import("./nutritionDayClient.js")).saveNutritionDaySnapshot(uid, localNutritionState);
  const nutritionRef = doc(db, "users", uid, "nutrition", "state");
  const personalRef = doc(db, "users", uid, "nutrition", "myFoods");

  return runTransaction(db, async (transaction) => {
    const cloudSnapshot = await transaction.get(nutritionRef);
    const cloudNutrition = cloudSnapshot.exists() ? cloudSnapshot.data() : {};
    const personalSnapshot = await transaction.get(personalRef);
    const personal = personalSnapshot.exists() ? personalSnapshot.data() : {};
    const deleted = mergeDeletionTimes(mergeDeletionTimes(localNutritionState.deletedMyFoods, cloudNutrition.deletedMyFoods), personal.deletedMyFoods);
    const myFoods = mergeMyFoods(mergeMyFoods(cloudNutrition.myFoods, personal.myFoods, deleted), localNutritionState.myFoods, deleted);
    const mergedNutrition = {
      ...mergeNutritionStates(localNutritionState, cloudNutrition, myFoods, deleted),
      __uid: uid
    };

    const state = { ...mergedNutrition };
    delete state.myFoods;
    assertNutritionDocumentBudget(state);
    assertNutritionDocumentBudget({ ...personal, myFoods, deletedMyFoods: deleted, ownerUid: uid, updatedAt: mergedNutrition.updatedAt });
    if (!sameNutritionState(cloudNutrition, state)) transaction.set(nutritionRef, state);
    const nextPersonal = { ...personal, myFoods, deletedMyFoods: deleted, ownerUid: uid, updatedAt: mergedNutrition.updatedAt };
    if ((localNutritionState.myFoods || localNutritionState.deletedMyFoods) && !sameNutritionState(personal, nextPersonal)) {
      transaction.set(personalRef, nextPersonal);
    }
    return mergedNutrition;
  });
}
