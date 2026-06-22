import { makeEmptyNutritionDay } from "../../../domain/nutritionPresentation";
import { addUserLocalBackup } from "../../../utils/userScopedStorage";

export function createNutritionDiaryFoodHandlers({
  NUTRITION_BACKUP_STORAGE_KEY,
  auth,
  user,
  nutrition,
  nutritionDateKey,
  deletingNutritionFoodId,
  nutritionFoodSwipeMoved,
  nutritionFoodSwipeStartX,
  nutritionUndoDelete,
  nutritionUndoTimerRef,
  updateNutritionDay,
  setDeletingNutritionFoodId,
  setNutrition,
  setNutritionFoodSwipeOffsets,
  setNutritionUndoDelete
}) {
  function removeNutritionFood(itemId, options = {}) {
    const { offerUndo = true } = options;
    const dateKey = nutritionDateKey;
    const currentFoods = nutrition.days?.[dateKey]?.foods || [];
    const removedIndex = currentFoods.findIndex((item) => item.id === itemId);
    const removedItem = removedIndex >= 0 ? currentFoods[removedIndex] : null;
    if (!removedItem) return false;

    const currentUid = auth.currentUser?.uid || user?.uid;
    if (currentUid) {
      addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUid, {
        nutrition,
        reason: "before_remove_food",
        itemId
      });
    }

    updateNutritionDay((day) => ({
      ...day,
      foods: (day.foods || []).filter((item) => item.id !== itemId)
    }));

    if (offerUndo) {
      if (nutritionUndoTimerRef.current) {
        window.clearTimeout(nutritionUndoTimerRef.current);
      }

      setNutritionUndoDelete({
        dateKey,
        item: removedItem,
        index: removedIndex
      });
      nutritionUndoTimerRef.current = window.setTimeout(() => {
        setNutritionUndoDelete(null);
        nutritionUndoTimerRef.current = null;
      }, 6000);
    }

    return true;
  }

  function restoreNutritionFood() {
    if (!nutritionUndoDelete?.item || !nutritionUndoDelete.dateKey) return;

    const { dateKey, item, index } = nutritionUndoDelete;
    setNutrition((prev) => {
      const currentDay = prev.days?.[dateKey] || makeEmptyNutritionDay();
      const currentFoods = currentDay.foods || [];
      if (currentFoods.some((food) => food.id === item.id)) return prev;

      const nextFoods = [...currentFoods];
      nextFoods.splice(Math.min(Math.max(index, 0), nextFoods.length), 0, item);

      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...currentDay,
            foods: nextFoods,
            updatedAt: new Date().toISOString()
          }
        }
      };
    });

    if (nutritionUndoTimerRef.current) {
      window.clearTimeout(nutritionUndoTimerRef.current);
      nutritionUndoTimerRef.current = null;
    }
    setNutritionUndoDelete(null);
  }

  function handleNutritionFoodSwipeStart(itemId, event) {
    const touch = event.touches?.[0];
    nutritionFoodSwipeStartX.current[itemId] = {
      x: touch?.clientX || 0,
      y: touch?.clientY || 0,
      time: Date.now()
    };
    nutritionFoodSwipeMoved.current[itemId] = false;
  }

  function handleNutritionFoodSwipeMove(itemId, event) {
    const start = nutritionFoodSwipeStartX.current[itemId];
    const touch = event.touches?.[0];
    if (!start || !touch || deletingNutritionFoodId === itemId) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.15) return;

    if (deltaX < -8) {
      event.preventDefault();
      const nextOffset = Math.max(-135, Math.min(0, deltaX));
      nutritionFoodSwipeMoved.current[itemId] = Math.abs(nextOffset) > 14;
      setNutritionFoodSwipeOffsets((prev) => ({ ...prev, [itemId]: nextOffset }));
    }
  }

  function handleNutritionFoodSwipeEnd(itemId, event) {
    const start = nutritionFoodSwipeStartX.current[itemId];
    const touch = event.changedTouches?.[0];
    delete nutritionFoodSwipeStartX.current[itemId];

    if (!start || !touch) {
      setNutritionFoodSwipeOffsets((prev) => ({ ...prev, [itemId]: 0 }));
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Math.max(1, Date.now() - start.time);
    const velocity = Math.abs(deltaX) / elapsed;
    const isIntentionalDelete =
      deltaX < -135 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.35 &&
      (velocity > 0.16 || Math.abs(deltaX) > 170);

    if (isIntentionalDelete) {
      nutritionFoodSwipeMoved.current[itemId] = true;
      setDeletingNutritionFoodId(itemId);
      setNutritionFoodSwipeOffsets((prev) => ({ ...prev, [itemId]: -420 }));

      window.setTimeout(() => {
        removeNutritionFood(itemId);
        setDeletingNutritionFoodId(null);
        setNutritionFoodSwipeOffsets((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        delete nutritionFoodSwipeMoved.current[itemId];
      }, 240);
    } else {
      setNutritionFoodSwipeOffsets((prev) => ({ ...prev, [itemId]: 0 }));
      window.setTimeout(() => {
        delete nutritionFoodSwipeMoved.current[itemId];
      }, 180);
    }
  }

  function handleNutritionFoodSwipeCancel(itemId) {
    delete nutritionFoodSwipeStartX.current[itemId];
    setNutritionFoodSwipeOffsets((prev) => ({ ...prev, [itemId]: 0 }));
    window.setTimeout(() => {
      delete nutritionFoodSwipeMoved.current[itemId];
    }, 180);
  }

  return {
    removeNutritionFood,
    restoreNutritionFood,
    handleNutritionFoodSwipeStart,
    handleNutritionFoodSwipeMove,
    handleNutritionFoodSwipeEnd,
    handleNutritionFoodSwipeCancel
  };
}
