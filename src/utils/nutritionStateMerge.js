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

export function mergeNutritionStates(localState = {}, cloudState = {}, personalMyFoods = {}) {
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
    favorites: [
      ...new Set([
        ...(primaryState.favorites || defaultNutritionState.favorites),
        ...(secondaryState.favorites || [])
      ])
    ],
    recent: [
      ...new Set([
        ...(primaryState.recent || []),
        ...(secondaryState.recent || [])
      ])
    ].slice(0, 80),
    myFoods: {
      ...(secondaryState.myFoods || {}),
      ...(primaryState.myFoods || {}),
      ...(personalMyFoods || {})
    }
  };
}
