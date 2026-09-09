import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { mergeNutritionStates } from "./nutritionStateMerge";
import { mergeDeletionTimes, mergeMyFoods } from "./nutritionSyncModel.js";

export async function saveNutritionStateWithMerge(uid, localNutritionState = {}) {
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
    transaction.set(nutritionRef, state);
    if (localNutritionState.myFoods || localNutritionState.deletedMyFoods) transaction.set(personalRef, {
      ...personal, myFoods, deletedMyFoods: deleted, ownerUid: uid, updatedAt: mergedNutrition.updatedAt
    });
    return mergedNutrition;
  });
}
