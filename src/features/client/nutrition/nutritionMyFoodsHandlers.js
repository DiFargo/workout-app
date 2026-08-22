import { setDoc } from "firebase/firestore";

import { makePersonalFoodKey } from "../../../utils/nutritionFoodModel";
import {
  loadRecentNutritionFoods,
  saveRecentNutritionFoods
} from "../../../utils/nutritionPreferenceStorage";
import { getPersonalMyFoodsDocRef } from "../../../utils/personalMyFoodsStorage";
import { saveNutritionStateWithMerge } from "../../../utils/nutritionStateStorage";
import {
  addUserLocalBackup,
  removeUserLocalBackup,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";

const MY_FOODS_SAVE_DELAY_MS = 180;

function createFallbackSaveQueue() {
  return {
    timer: null,
    uid: "",
    fullSave: null,
    changes: new Map()
  };
}

export function createNutritionMyFoodsHandlers({
  GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY,
  NUTRITION_BACKUP_STORAGE_KEY,
  NUTRITION_STORAGE_KEY,
  auth,
  myFoodsSaveQueueRef,
  user,
  showAppError,
  setNutrition,
  setRecentNutritionFoods
}) {
  const fallbackSaveQueue = createFallbackSaveQueue();

  function getSaveQueue() {
    return myFoodsSaveQueueRef?.current || fallbackSaveQueue;
  }

  function persistPersonalMyFoods(job) {
    const { uid, myFoods, change } = job;
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!uid || activeUid !== uid) return;

    const backupId = `my_foods_${Date.now()}`;
    const backup = change?.id && change.food
      ? {
          id: backupId,
          changes: [{ id: change.id, food: change.food }],
          reason: "before_personal_my_foods_save"
        }
      : {
          id: backupId,
          myFoods: myFoods || {},
          reason: "before_personal_my_foods_save"
        };
    const payload = change?.id && change.food
      ? {
          myFoods: { [change.id]: change.food },
          updatedAt: new Date().toISOString(),
          ownerUid: uid
        }
      : {
          myFoods: myFoods || {},
          updatedAt: new Date().toISOString(),
          ownerUid: uid
        };

    addUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, backup, 12);

    setDoc(getPersonalMyFoodsDocRef(uid), payload, { merge: true })
      .then(() => removeUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, backupId))
      .catch((error) => {
        console.error("Personal my foods save error", error);
        showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase", "Моя база сохранена локально.");
        addUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, {
          ...backup,
          id: `my_foods_failed_${Date.now()}`,
          reason: "personal_my_foods_save_failed",
          error: error.message || String(error)
        }, 12);
      });
  }

  function flushPersonalMyFoodsSaveQueue() {
    const queue = getSaveQueue();
    queue.timer = null;

    const fullSave = queue.fullSave;
    const changes = fullSave ? [] : Array.from(queue.changes.values());
    queue.fullSave = null;
    queue.changes.clear();

    if (fullSave) {
      persistPersonalMyFoods(fullSave);
      return;
    }

    changes.forEach(persistPersonalMyFoods);
  }

  function savePersonalMyFoodsToFirebase(myFoods, change = null) {
    const currentUser = auth.currentUser || user;
    const uid = currentUser?.uid;

    if (!uid) {
      showAppError("savedLocal", "Моя база сохранена локально. Войди в аккаунт для синхронизации.");
      return;
    }

    const queue = getSaveQueue();
    if (queue.uid && queue.uid !== uid) {
      if (queue.timer) clearTimeout(queue.timer);
      queue.fullSave = null;
      queue.changes.clear();
    }
    queue.uid = uid;

    const job = {
      uid,
      myFoods: myFoods || {},
      change: change?.id && change.food ? change : null
    };

    if (job.change) {
      if (queue.fullSave) {
        queue.fullSave = job;
      } else {
        queue.changes.set(job.change.id, job);
      }
    } else {
      queue.fullSave = job;
      queue.changes.clear();
    }

    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = setTimeout(flushPersonalMyFoodsSaveQueue, MY_FOODS_SAVE_DELAY_MS);
  }

  function removeMyNutritionFood(foodId, foodName = "") {
    const cleanFoodId = String(foodId || "").replace(/^my:/, "");
    const cleanFoodName = String(foodName || "").trim().toLowerCase();

    setNutrition((prev) => {
      const currentMyFoods = prev.myFoods || {};
      const idsToRemove = new Set();

      Object.entries(currentMyFoods).forEach(([key, value]) => {
        const valueId = String(value?.id || "");
        const valueFoodId = String(value?.foodId || "");
        const valueName = String(value?.name || "").trim().toLowerCase();

        if (
          key === cleanFoodId ||
          valueId === cleanFoodId ||
          valueFoodId === cleanFoodId ||
          (cleanFoodName && valueName === cleanFoodName)
        ) {
          idsToRemove.add(key);
          if (valueId) idsToRemove.add(valueId);
          if (valueFoodId) idsToRemove.add(valueFoodId);
        }
      });

      if (cleanFoodId) idsToRemove.add(cleanFoodId);

      if (cleanFoodName) {
        idsToRemove.add(makePersonalFoodKey({ name: cleanFoodName }));
      }

      const nextMyFoods = { ...currentMyFoods };
      idsToRemove.forEach((id) => {
        delete nextMyFoods[id];
      });

      const nextRecent = (prev.recent || []).filter((id) => !idsToRemove.has(id));
      const nextFavorites = (prev.favorites || []).filter((id) => !idsToRemove.has(id));

      const nextDays = Object.fromEntries(
        Object.entries(prev.days || {}).map(([dayKey, day]) => [
          dayKey,
          {
            ...day,
            foods: (day.foods || []).filter((item) => {
              const itemFoodId = String(item?.foodId || "");
              const itemId = String(item?.id || "");
              const itemName = String(item?.name || "").trim().toLowerCase();

              return !(
                idsToRemove.has(itemFoodId) ||
                idsToRemove.has(itemId) ||
                (cleanFoodName && itemName === cleanFoodName && item?.source === "Моя база")
              );
            })
          }
        ])
      );

      const nextState = {
        ...prev,
        myFoods: nextMyFoods,
        recent: nextRecent,
        favorites: nextFavorites,
        days: nextDays
      };

      const currentUserForLocal = auth.currentUser || user;
      if (currentUserForLocal?.uid) {
        safeWriteUserJsonStorage(NUTRITION_STORAGE_KEY, currentUserForLocal.uid, nextState);
      }

      savePersonalMyFoodsToFirebase(nextMyFoods);

      const currentUser = auth.currentUser;
      if (currentUser) {
        const userNutritionState = { ...nextState };
        delete userNutritionState.myFoods;

        saveNutritionStateWithMerge(currentUser.uid, {
          ...userNutritionState,
          updatedAt: new Date().toISOString()
        }).catch((error) => {
          console.error("Nutrition delete save error", error);
          addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUser.uid, {
            nutrition: nextState,
            reason: "delete_save_failed",
            error: error.message || String(error)
          });
        });
      }

      return nextState;
    });

    setRecentNutritionFoods((prev) => (
      (prev || []).filter((food) => {
        const id = String(food?.id || "");
        const foodIdValue = String(food?.foodId || "");
        const name = String(food?.name || "").trim().toLowerCase();

        return id !== cleanFoodId && foodIdValue !== cleanFoodId && (!cleanFoodName || name !== cleanFoodName);
      })
    ));

    try {
      const currentUid = auth.currentUser?.uid || user?.uid;
      const current = loadRecentNutritionFoods(currentUid);
      const next = current.filter((food) => {
        const id = String(food?.id || "");
        const foodIdValue = String(food?.foodId || "");
        const name = String(food?.name || "").trim().toLowerCase();

        return id !== cleanFoodId && foodIdValue !== cleanFoodId && (!cleanFoodName || name !== cleanFoodName);
      });
      if (currentUid) {
        saveRecentNutritionFoods(next, currentUid);
      }
    } catch {
      // ignore localStorage errors
    }
  }

  return {
    savePersonalMyFoodsToFirebase,
    removeMyNutritionFood
  };
}
