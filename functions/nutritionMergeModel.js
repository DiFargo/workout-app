// Pure, shared by browser and server. Keep diary identity and tombstones intact.
const time = value => Number(new Date(value || 0)) || 0;
const timestamp = value => typeof value?.toMillis === "function" ? value.toMillis() : time(value);
const latest = (a, b) => time(a) > time(b) ? a : b;
export const nutritionDefaults = { goals: { calories: 2400, protein: 160, fat: 75, carbs: 260, water: 2500 }, days: {},
  favorites: ["food_chicken", "food_rice", "food_curd", "food_protein"], recent: [], myFoods: {} };

export function mergeDeletionTimes(a = {}, b = {}) {
  return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map(id => [id, latest(a[id], b[id])]));
}
export function stampNutritionDayChange(previous = {}, next = {}, at = new Date().toISOString()) {
  const updatedAt = new Date(Math.max(time(at), time(previous.updatedAt) + 1)).toISOString();
  const deletedFoods = { ...previous.deletedFoods, ...next.deletedFoods };
  const before = new Map((previous.foods || []).map(food => [String(food.id), food]));
  const ids = new Set((next.foods || []).map(food => String(food.id)));
  for (const id of before.keys()) if (!ids.has(id)) deletedFoods[id] = updatedAt;
  const foods = (next.foods || []).map(food => {
    const prior = before.get(String(food.id));
    return prior && JSON.stringify(prior) === JSON.stringify(food) ? food : { ...food, updatedAt };
  });
  const fieldUpdatedAt = { ...previous.fieldUpdatedAt, ...next.fieldUpdatedAt };
  for (const field of Object.keys(next)) {
    if (!["foods", "deletedFoods", "fieldUpdatedAt", "updatedAt"].includes(field)
      && JSON.stringify(next[field]) !== JSON.stringify(previous[field])) fieldUpdatedAt[field] = updatedAt;
  }
  return { ...next, foods, deletedFoods, fieldUpdatedAt, updatedAt };
}
export function mergeNutritionDay(a = {}, b = {}, aFallback = "", bFallback = "") {
  const primary = time(a.updatedAt || aFallback) > time(b.updatedAt || bFallback) ? a : b;
  const secondary = primary === a ? b : a;
  const result = { ...secondary, ...primary };
  const deletedFoods = mergeDeletionTimes(a.deletedFoods, b.deletedFoods);
  const entries = new Map();
  for (const day of [secondary, primary]) for (const [index, item] of (day.foods || []).entries()) {
    const id = String(item.id || `legacy:${item.addedAt || ""}:${item.foodId || item.name}:${item.mealId || ""}:${index}`);
    const entryTime = time(item.updatedAt || item.addedAt);
    const current = entries.get(id);
    if (deletedFoods[id] && entryTime <= time(deletedFoods[id])) continue;
    if (!current || entryTime >= time(current.updatedAt || current.addedAt)) entries.set(id, { ...item, id });
  }
  const fieldUpdatedAt = mergeDeletionTimes(a.fieldUpdatedAt, b.fieldUpdatedAt);
  for (const field of Object.keys(fieldUpdatedAt)) {
    const aFieldTime = Object.hasOwn(a, "fieldUpdatedAt") ? a.fieldUpdatedAt?.[field] : a.updatedAt || aFallback;
    const bFieldTime = Object.hasOwn(b, "fieldUpdatedAt") ? b.fieldUpdatedAt?.[field] : b.updatedAt || bFallback;
    const source = time(aFieldTime) > time(bFieldTime) ? a : b;
    if (Object.hasOwn(source, field)) { result[field] = source[field]; fieldUpdatedAt[field] = source === a ? aFieldTime : bFieldTime; }
  }
  return { ...result, foods: [...entries.values()], deletedFoods, fieldUpdatedAt };
}
export function mergeNutritionDays(a = {}, b = {}, aAt = "", bAt = "") {
  return Object.fromEntries([...new Set([...Object.keys(b || {}), ...Object.keys(a || {})])].map(key =>
    [key, !a?.[key] ? b[key] : !b?.[key] ? a[key] : mergeNutritionDay(a[key], b[key], aAt, bAt)]));
}
export function mergeMyFoods(a = {}, b = {}, deleted = {}) {
  const result = {};
  for (const source of [a, b]) for (const [id, food] of Object.entries(source)) {
    if (!food || (deleted[id] && time(food.updatedAt) <= time(deleted[id]))) continue;
    if (!result[id] || time(food.updatedAt) >= time(result[id].updatedAt)) result[id] = food;
  }
  return result;
}
export function mergeFavoriteChanges(a = {}, b = {}) {
  const result = { ...a };
  for (const [id, change] of Object.entries(b)) if (!result[id] || time(change.updatedAt) >= time(result[id].updatedAt)) result[id] = change;
  return result;
}
export function getNutritionUpdatedAt(state = {}) {
  const value = state?.updatedAt;
  return typeof value?.toMillis === "function" ? value.toMillis() : time(value);
}
export function pickNutritionGoalNumbers(source = {}) {
  return ["calories", "protein", "fat", "carbs", "water"].reduce((result, key) => {
    const value = Number(source?.[key]);
    if (Number.isFinite(value) && value >= 0) result[key] = value;
    return result;
  }, {});
}
export function mergeNutritionStates(local = {}, cloud = {}, personalFoods = {}, personalDeleted = {}) {
  const primary = getNutritionUpdatedAt(local) > getNutritionUpdatedAt(cloud) ? local : cloud;
  const secondary = primary === local ? cloud : local;
  const localPlanAt = getNutritionUpdatedAt(local.nutritionPlan || {}), cloudPlanAt = getNutritionUpdatedAt(cloud.nutritionPlan || {});
  const planPrimary = cloudPlanAt > localPlanAt ? cloud : localPlanAt > cloudPlanAt ? local : primary;
  const planSecondary = planPrimary === cloud ? local : cloud;
  const nutritionPlan = planPrimary.nutritionPlan || planSecondary.nutritionPlan || null;
  const deletedMyFoods = mergeDeletionTimes(mergeDeletionTimes(local.deletedMyFoods, cloud.deletedMyFoods), personalDeleted);
  const myFoods = mergeMyFoods(mergeMyFoods(secondary.myFoods, primary.myFoods, deletedMyFoods), personalFoods, deletedMyFoods);
  const favoriteChanges = mergeFavoriteChanges(local.favoriteChanges, cloud.favoriteChanges);
  const favorites = new Set([...(local.favorites || []), ...(cloud.favorites || [])]);
  for (const [id, change] of Object.entries(favoriteChanges)) change.present ? favorites.add(id) : favorites.delete(id);
  for (const [id, at] of Object.entries(deletedMyFoods)) if (timestamp(favoriteChanges[id]?.updatedAt) <= timestamp(at)) favorites.delete(id);
  return { ...nutritionDefaults, ...secondary, ...primary,
    goals: { ...nutritionDefaults.goals, ...(secondary.goals || {}), ...(primary.goals || {}), ...pickNutritionGoalNumbers(nutritionPlan) },
    nutritionPlan, days: mergeNutritionDays(local.days, cloud.days, local.updatedAt, cloud.updatedAt), deletedMyFoods, favoriteChanges,
    favorites: [...favorites], recent: [...new Set([...(primary.recent || []), ...(secondary.recent || [])])]
      .filter(id => !deletedMyFoods[id] || myFoods[id]).slice(0, 80), myFoods };
}
