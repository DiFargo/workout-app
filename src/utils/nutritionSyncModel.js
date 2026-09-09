const time = (value) => Number(new Date(value || 0)) || 0;
const latest = (a, b) => time(a) > time(b) ? a : b;
export function mergeDeletionTimes(a = {}, b = {}) {
  return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((id) => [id, latest(a[id], b[id])]));
}

// Diary entries have their own identity. Changing or deleting a library food
// must never rewrite a portion that was already recorded in a diary.
export function stampNutritionDayChange(previous = {}, next = {}, at = new Date().toISOString()) {
  const updatedAt = new Date(Math.max(time(at), time(previous.updatedAt) + 1)).toISOString();
  const deletedFoods = { ...previous.deletedFoods, ...next.deletedFoods };
  const before = new Map((previous.foods || []).map((food) => [String(food.id), food]));
  const ids = new Set((next.foods || []).map((food) => String(food.id)));
  for (const id of before.keys()) if (!ids.has(id)) deletedFoods[id] = updatedAt;
  const foods = (next.foods || []).map((food) => {
    const prior = before.get(String(food.id));
    return prior && JSON.stringify(prior) === JSON.stringify(food) ? food : { ...food, updatedAt };
  });
  const fieldUpdatedAt = { ...previous.fieldUpdatedAt, ...next.fieldUpdatedAt };
  for (const field of Object.keys(next)) {
    if (!["foods", "deletedFoods", "fieldUpdatedAt", "updatedAt"].includes(field) && JSON.stringify(next[field]) !== JSON.stringify(previous[field])) fieldUpdatedAt[field] = updatedAt;
  }
  return { ...next, foods, deletedFoods, fieldUpdatedAt, updatedAt };
}

export function mergeNutritionDay(a = {}, b = {}, aFallback = "", bFallback = "") {
  const aTime = time(a.updatedAt || aFallback);
  const bTime = time(b.updatedAt || bFallback);
  const primary = aTime > bTime ? a : b;
  const secondary = primary === a ? b : a;
  const result = { ...secondary, ...primary };
  const deletedFoods = mergeDeletionTimes(a.deletedFoods, b.deletedFoods);
  const entries = new Map();
  for (const day of [secondary, primary]) {
    for (const [index, item] of (day.foods || []).entries()) {
      // Legacy entries without IDs get a deterministic identity until edited.
      const id = String(item.id || `legacy:${item.addedAt || ""}:${item.foodId || item.name}:${item.mealId || ""}:${index}`);
      const entryTime = time(item.updatedAt || item.addedAt);
      const current = entries.get(id);
      if (deletedFoods[id] && entryTime <= time(deletedFoods[id])) continue;
      if (!current || entryTime >= time(current.updatedAt || current.addedAt)) entries.set(id, { ...item, id });
    }
  }
  const fieldUpdatedAt = mergeDeletionTimes(a.fieldUpdatedAt, b.fieldUpdatedAt);
  for (const field of Object.keys(fieldUpdatedAt)) {
    const source = time(a.fieldUpdatedAt?.[field] || a.updatedAt || aFallback) > time(b.fieldUpdatedAt?.[field] || b.updatedAt || bFallback) ? a : b;
    if (Object.hasOwn(source, field)) result[field] = source[field];
  }
  return { ...result, foods: [...entries.values()], deletedFoods, fieldUpdatedAt };
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
