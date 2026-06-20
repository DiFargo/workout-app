import { auth } from "../firebase";
import { getUserScopedStorageKey } from "./userScopedStorage";

const RECENT_NUTRITION_SEARCHES_KEY = "nutrition_recent_foods_v1";

export function loadRecentNutritionFoods(uid = auth.currentUser?.uid) {
  try {
    if (!uid) return [];
    const raw = localStorage.getItem(getUserScopedStorageKey(RECENT_NUTRITION_SEARCHES_KEY, uid));
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value.slice(0, 8) : [];
  } catch (_) {
    return [];
  }
}

export function saveRecentNutritionFoods(foods = [], uid = auth.currentUser?.uid) {
  try {
    if (!uid) return;
    localStorage.setItem(
      getUserScopedStorageKey(RECENT_NUTRITION_SEARCHES_KEY, uid),
      JSON.stringify((Array.isArray(foods) ? foods : []).slice(0, 8))
    );
  } catch (_) {
    // ignore localStorage errors
  }
}

export function saveRecentNutritionFood(food, uid = auth.currentUser?.uid) {
  if (!food?.name || !uid) return;

  const current = loadRecentNutritionFoods(uid);
  const next = [
    food,
    ...current.filter((item) => item?.name !== food.name)
  ].slice(0, 8);

  saveRecentNutritionFoods(next, uid);
}

export function getNutritionUnitStorageKey(food = {}) {
  const baseKey = `nutrition_unit_${String(food?.name || "").trim().toLowerCase()}`;
  return getUserScopedStorageKey(baseKey, auth.currentUser?.uid);
}

export function saveNutritionPreferredUnit(food = {}, unitId = "") {
  try {
    if (!food?.name || !unitId) return;
    localStorage.setItem(getNutritionUnitStorageKey(food), unitId);
  } catch (_) {
    // ignore storage errors
  }
}

export function loadNutritionPreferredUnit(food = {}) {
  try {
    if (!food?.name) return "";
    return localStorage.getItem(getNutritionUnitStorageKey(food)) || "";
  } catch (_) {
    return "";
  }
}
