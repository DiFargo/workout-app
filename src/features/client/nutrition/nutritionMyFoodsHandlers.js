import { runTransaction } from "firebase/firestore";
import { db } from "../../../firebase";
import { mergeDeletionTimes, mergeMyFoods } from "../../../utils/nutritionSyncModel.js";

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
    const { uid, myFoods, change, deletedMyFoods = {} } = job;
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!uid || activeUid !== uid) return;

    const backupId = `my_foods_${Date.now()}`;
    const backup = change?.id && change.food
      ? {
          id: backupId,
          changes: [{ id: change.id, food: change.food }],
          deletedMyFoods,
          reason: "before_personal_my_foods_save"
        }
      : {
          id: backupId,
          myFoods: myFoods || {},
          deletedMyFoods,
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
          deletedMyFoods,
          updatedAt: new Date().toISOString(),
          ownerUid: uid
        };

    addUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, backup, 12);

    runTransaction(db, async (transaction) => {
      const ref = getPersonalMyFoodsDocRef(uid);
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists() ? snapshot.data() : {};
      const deleted = mergeDeletionTimes(current.deletedMyFoods, deletedMyFoods);
      transaction.set(ref, { ...current, ...payload, deletedMyFoods: deleted, myFoods: mergeMyFoods(current.myFoods, payload.myFoods, deleted) });
    })
      .then(() => removeUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, backupId))
      .catch((error) => {
        console.error("Personal my foods save error", error);
        showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase", "Не удалось синхронизировать мою базу. Повторим при восстановлении соединения.");
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

  function savePersonalMyFoodsToFirebase(myFoods, change = null, deletedMyFoods = {}) {
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
      deletedMyFoods,
      myFoods: myFoods || {},
      change: change?.id && change.food ? change : null
    };

    if (job.change) {
      if (queue.fullSave) {
        queue.fullSave = { ...job, deletedMyFoods: mergeDeletionTimes(queue.fullSave?.deletedMyFoods, job.deletedMyFoods) };
      } else {
        queue.changes.set(job.change.id, job);
      }
    } else {
      queue.fullSave = { ...job, deletedMyFoods: mergeDeletionTimes(queue.fullSave?.deletedMyFoods, job.deletedMyFoods) };
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

      const updatedAt = new Date().toISOString();
      const deletedMyFoods = { ...prev.deletedMyFoods };
      const favoriteChanges = { ...prev.favoriteChanges };
      idsToRemove.forEach((id) => {
        deletedMyFoods[id] = updatedAt;
        favoriteChanges[id] = { present: false, updatedAt };
      });

      const nextState = {
        ...prev,
        myFoods: nextMyFoods,
        recent: nextRecent,
        favorites: nextFavorites,
        deletedMyFoods,
        favoriteChanges,
        updatedAt
      };

      const currentUserForLocal = auth.currentUser || user;
      if (currentUserForLocal?.uid) {
        safeWriteUserJsonStorage(NUTRITION_STORAGE_KEY, currentUserForLocal.uid, nextState);
      }

      savePersonalMyFoodsToFirebase(nextMyFoods, null, deletedMyFoods);

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
