import { mergeDeletionTimes, mergeMyFoods, mergeFavoriteChanges } from "./nutritionSyncModel.js";
import { defaultNutritionState } from "../data/nutritionDefaults";
import { getTimestampValue, mergeNutritionDays } from "./auditSafety";

export function getNutritionUpdatedAt(state = {}) {
  return getTimestampValue(state?.updatedAt);
}

export function pickNutritionGoalNumbers(source = {}) {
  return ["calories", "protein", "fat", "carbs", "water"].reduce((result, key) => {
    const value = Number(source?.[key]);
    if (Number.isFinite(value) && value >= 0) {
      result[key] = value;
    }
    return result;
  }, {});
}

export function mergeNutritionStates(localState = {}, cloudState = {}, personalMyFoods = {}, personalDeletedFoods = {}) {
  const localIsNewer =
    getNutritionUpdatedAt(localState) > getNutritionUpdatedAt(cloudState);
  const primaryState = localIsNewer ? localState : cloudState;
  const secondaryState = localIsNewer ? cloudState : localState;
  const localPlanUpdatedAt = getNutritionUpdatedAt(localState?.nutritionPlan || {});
  const cloudPlanUpdatedAt = getNutritionUpdatedAt(cloudState?.nutritionPlan || {});
  const planPrimaryState =
    cloudPlanUpdatedAt > localPlanUpdatedAt
      ? cloudState
      : localPlanUpdatedAt > cloudPlanUpdatedAt
        ? localState
        : primaryState;
  const planSecondaryState = planPrimaryState === cloudState ? localState : cloudState;
  const preferredNutritionPlan =
    planPrimaryState?.nutritionPlan ||
    planSecondaryState?.nutritionPlan ||
    null;
  const mergedDays = mergeNutritionDays(
    localState.days || {},
    cloudState.days || {},
    localState.updatedAt,
    cloudState.updatedAt
  );

  const deletedMyFoods = mergeDeletionTimes(mergeDeletionTimes(localState.deletedMyFoods, cloudState.deletedMyFoods), personalDeletedFoods);
  const favoriteChanges = mergeFavoriteChanges(localState.favoriteChanges, cloudState.favoriteChanges);
  const favorites = new Set([...(localState.favorites || []), ...(cloudState.favorites || [])]);
  for (const [id, change] of Object.entries(favoriteChanges)) change.present ? favorites.add(id) : favorites.delete(id);
  for (const [id, deletedAt] of Object.entries(deletedMyFoods)) {
    if (getTimestampValue(favoriteChanges[id]?.updatedAt) <= getTimestampValue(deletedAt)) favorites.delete(id);
  }
  return {
    ...defaultNutritionState,
    ...secondaryState,
    ...primaryState,
    goals: {
      ...defaultNutritionState.goals,
      ...(secondaryState.goals || {}),
      ...(primaryState.goals || {}),
      ...pickNutritionGoalNumbers(preferredNutritionPlan)
    },
    nutritionPlan: preferredNutritionPlan,
    days: mergedDays,
    deletedMyFoods,
    favoriteChanges,
    favorites: [...favorites],
    recent: [
      ...new Set([
        ...(primaryState.recent || []),
        ...(secondaryState.recent || [])
      ])
    ].slice(0, 80),
    myFoods: mergeMyFoods(mergeMyFoods(secondaryState.myFoods, primaryState.myFoods, deletedMyFoods), personalMyFoods, deletedMyFoods)
  };
}
