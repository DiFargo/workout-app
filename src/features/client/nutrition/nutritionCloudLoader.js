import { doc, getDoc } from "firebase/firestore";

import { mergeNutritionStates } from "../../../utils/nutritionStateMerge";
import { getPersonalMyFoodsDocRef } from "../../../utils/personalMyFoodsStorage";
import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";

const NUTRITION_LOAD_LABEL = "Firebase \u00b7 nutrition load";
const ERROR_LOAD_NUTRITION = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0438\u0442\u0430\u043d\u0438\u0435 \u0438\u0437 Firebase. \u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435.";

export function createNutritionCloudLoader({
  db,
  NUTRITION_STORAGE_KEY,
  startPerformanceCheck,
  endPerformanceCheck,
  showAppError,
  setNutrition,
  setNutritionCloudReady
}) {
  async function loadNutritionFromFirebase(uid) {
    startPerformanceCheck(NUTRITION_LOAD_LABEL, { userId: String(uid || "").slice(0, 6) });

    try {
      const [userSnap, personalMyFoodsSnap] = await Promise.all([
        getDoc(doc(db, "users", uid, "nutrition", "state")),
        getDoc(getPersonalMyFoodsDocRef(uid))
      ]);

      const userData = userSnap.exists() ? userSnap.data() : {};
      const personalMyFoodsData = personalMyFoodsSnap.exists() ? personalMyFoodsSnap.data() : {};
      const localNutrition = safeReadUserJsonStorage(NUTRITION_STORAGE_KEY, uid, {});
      const localUid = localNutrition?.__uid;

      const safeLocalNutrition =
        !localUid || localUid === uid
          ? localNutrition
          : {};

      const mergedNutrition = mergeNutritionStates(
        safeLocalNutrition,
        userData,
        personalMyFoodsData.myFoods || {}
      );

      const scopedNutrition = {
        ...mergedNutrition,
        __uid: uid
      };

      setNutrition(scopedNutrition);
      safeWriteUserJsonStorage(NUTRITION_STORAGE_KEY, uid, scopedNutrition);

      endPerformanceCheck(NUTRITION_LOAD_LABEL, {
        days: Object.keys(mergedNutrition.days || {}).length,
        myFoods: Object.keys(mergedNutrition.myFoods || {}).length
      });
    } catch (error) {
      console.error("Nutrition load error", error);
      showAppError(
        typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase",
        ERROR_LOAD_NUTRITION
      );
    } finally {
      setNutritionCloudReady(true);
    }
  }

  return {
    loadNutritionFromFirebase
  };
}
