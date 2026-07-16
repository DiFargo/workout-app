import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { mergeNutritionStates } from "./nutritionStateMerge";

export async function saveNutritionStateWithMerge(uid, localNutritionState = {}) {
  const nutritionRef = doc(db, "users", uid, "nutrition", "state");

  return runTransaction(db, async (transaction) => {
    const cloudSnapshot = await transaction.get(nutritionRef);
    const cloudNutrition = cloudSnapshot.exists() ? cloudSnapshot.data() : {};
    const mergedNutrition = {
      ...mergeNutritionStates(localNutritionState, cloudNutrition),
      __uid: uid,
      updatedAt: new Date().toISOString()
    };

    transaction.set(nutritionRef, mergedNutrition, { merge: true });
    return mergedNutrition;
  });
}
