import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import localNutritionFoods from "./data/nutrition-catalog/foods.compact.json";
import localNutritionPrefixIndex from "./data/nutrition-catalog/alias-prefix-index.json";
import localNutritionExactIndex from "./data/nutrition-catalog/alias-exact-index.json";
import {
  searchLocalNutritionCatalog,
  mapAiFoodToLocalCatalog
} from "./data/nutrition-catalog/catalogSearch";

import { auth, db, storage } from "./firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getIdTokenResult
} from "firebase/auth";

import { collection, getDocs, doc, setDoc, addDoc, getDoc, deleteDoc, query, where, getFirestore } from "firebase/firestore";

const APP_VERSION = "v129";
const STORAGE_KEY = "workout_tracker_v1";
const ADMIN_EMAIL = "work.kriptonit.il@gmail.com";

const NUTRITION_STORAGE_KEY = "workout_nutrition_v1";
const NUTRITION_BACKUP_STORAGE_KEY = "workout_nutrition_backup_v1";
const WORKOUT_HISTORY_BACKUP_STORAGE_KEY = "workout_history_pending_backup_v1";
const WORKOUT_FAILED_HISTORY_QUEUE_KEY = "workout_history_failed_queue_v1";
const WORKOUT_DRAFT_STORAGE_KEY = "workout_active_draft_v1";
const WORKOUT_PLAN_BACKUP_STORAGE_KEY = "workout_plan_backup_v1";
const GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY = "workout_global_my_foods_backup_v1";
const DATA_SAFETY_MAX_BACKUPS = 25;
const APP_THEME_STORAGE_KEY = "workout_app_theme_v1";
const GLOBAL_MY_FOODS_DOC_ID = "shared";
const FIRST_SETUP_DONE_USER_STORAGE_KEY = "workout_first_setup_done_user_uid";
const FIRST_SETUP_REQUIRED_VERSION = "v2";
const TELEGRAM_BOT_USERNAME = "tren_ai_coach_bot";

const WORKOUT_MODE_STORAGE_KEY = "workout_mode_preference_v1";

const BASIC_WORKOUT_PLANS = {
  beginner: {
    id: "basic_beginner_3days",
    name: "Базовый план · Старт",
    description: "Лёгкий вход в тренировки: техника, умеренный объём, 3 тренировки.",
    workouts: [
      {
        id: "basic_beginner_day1",
        name: "Базовая — День 1 · Всё тело",
        order: 1,
        sortOrder: 1,
        exercises: [
          { id: "bb1_leg_press", name: "Жим ногами", video: "/videos/1. Жим ногами.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb1_row", name: "Тяга верхнего блока", video: "/videos/Тяга верхнего блока.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb1_db_press", name: "Жим гантелей лёжа", video: "/videos/Жим лежа с гантелями.mp4", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb1_side_raise", name: "Отведение рук с гантелями", video: "/videos/Отведение рук в сторону с гантелями.MP4", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] },
          { id: "bb1_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_beginner_day2",
        name: "Базовая — День 2 · Верх",
        order: 2,
        sortOrder: 2,
        exercises: [
          { id: "bb2_bench", name: "Жим лёжа со штангой", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bb2_db_row", name: "Тяга гантели к поясу", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb2_machine_press", name: "Вертикальный жим в тренажёре", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb2_curl", name: "Сгибание рук в кроссовере", video: "/videos/Сгибание рук с гантелями.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb2_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_beginner_day3",
        name: "Базовая — День 3 · Ноги / спина",
        order: 3,
        sortOrder: 3,
        exercises: [
          { id: "bb3_extension", name: "Разгибание ног", video: "", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] },
          { id: "bb3_rdl", name: "Румынская тяга", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bb3_hammer", name: "Тяга верхнего блока (хаммер)", video: "/videos/Тяга верхнего блока.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb3_triceps", name: "Разгибание рук в кроссовере", video: "/videos/Разгибание рук в кроссовере.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb3_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      }
    ]
  },
  muscle: {
    id: "basic_muscle_4days",
    name: "Базовый план · Масса",
    description: "4 тренировки: больше объёма, базовые движения и изоляция.",
    workouts: [
      {
        id: "basic_muscle_day1",
        name: "Базовая — День 1 · Спина / плечи",
        order: 1,
        sortOrder: 1,
        exercises: [
          { id: "bm1_leg_press", name: "Жим ногами", video: "/videos/1. Жим ногами.MOV", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_row", name: "Тяга в наклоне", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_tbar", name: "Тяга Т-грифа", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_press", name: "Вертикальный жим с гантелями", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_muscle_day2",
        name: "Базовая — День 2 · Грудь / руки",
        order: 2,
        sortOrder: 2,
        exercises: [
          { id: "bm2_bench", name: "Жим лёжа со штангой", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm2_smith", name: "Жим в Смите (наклон)", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm2_raise", name: "Отведение рук с гантелями (с опорой)", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm2_curl", name: "Сгибание рук в кроссовере", video: "/videos/Сгибание рук с гантелями.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm2_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_muscle_day3",
        name: "Базовая — День 3 · Спина / плечи",
        order: 3,
        sortOrder: 3,
        exercises: [
          { id: "bm3_rdl", name: "Румынская тяга", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm3_db_row", name: "Тяга гантели к поясу", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm3_hammer", name: "Тяга верхнего блока (хаммер)", video: "/videos/Тяга верхнего блока.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm3_machine_press", name: "Вертикальный жим в тренажёре", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm3_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_muscle_day4",
        name: "Базовая — День 4 · Грудь / руки",
        order: 4,
        sortOrder: 4,
        exercises: [
          { id: "bm4_lunge", name: "Выпады с гантелями", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm4_db_bench", name: "Жим гантелей лёжа", video: "/videos/Жим лежа с гантелями.mp4", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm4_fly", name: "Сведение гантелей (наклон)", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm4_rear", name: "Задняя дельта в кроссовере", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm4_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      }
    ]
  }
};

function getDefaultWorkoutModePreference() {
  return {
    mode: "",
    remember: false
  };
}

function safeReadJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeWriteJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Local backup write failed: ${key}`, error);
    return false;
  }
}

function addLocalBackup(key, item, limit = DATA_SAFETY_MAX_BACKUPS) {
  const current = safeReadJsonStorage(key, []);
  const next = [
    {
      id: item?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      savedAt: new Date().toISOString(),
      ...item
    },
    ...(Array.isArray(current) ? current : [])
  ].slice(0, limit);

  safeWriteJsonStorage(key, next);
  return next;
}

function removeLocalBackup(key, backupId) {
  const current = safeReadJsonStorage(key, []);
  if (!Array.isArray(current)) return;
  safeWriteJsonStorage(key, current.filter((item) => item.id !== backupId));
}

function getUserScopedStorageKey(baseKey, uid = auth.currentUser?.uid) {
  return uid ? `${baseKey}:${uid}` : baseKey;
}

function safeReadUserJsonStorage(baseKey, uid, fallback = null) {
  return safeReadJsonStorage(getUserScopedStorageKey(baseKey, uid), fallback);
}

function safeWriteUserJsonStorage(baseKey, uid, value) {
  return safeWriteJsonStorage(getUserScopedStorageKey(baseKey, uid), value);
}

function addUserLocalBackup(baseKey, uid, item, limit = DATA_SAFETY_MAX_BACKUPS) {
  return addLocalBackup(getUserScopedStorageKey(baseKey, uid), item, limit);
}

function removeUserLocalBackup(baseKey, uid, backupId) {
  return removeLocalBackup(getUserScopedStorageKey(baseKey, uid), backupId);
}

function getFailedHistoryQueue(uid = auth.currentUser?.uid) {
  return safeReadUserJsonStorage(WORKOUT_FAILED_HISTORY_QUEUE_KEY, uid, []);
}

function setFailedHistoryQueue(uid, queue = []) {
  return safeWriteUserJsonStorage(WORKOUT_FAILED_HISTORY_QUEUE_KEY, uid, Array.isArray(queue) ? queue : []);
}

function getPersonalMyFoodsDocRef(uid) {
  return doc(db, "users", uid, "nutrition", "myFoods");
}

function getPersonalMyFoodsFromState(nutritionState = {}) {
  return nutritionState?.myFoods || {};
}

function enqueueFailedHistorySave(uid, entry, reason = "failed_save") {
  const queue = getFailedHistoryQueue(uid);
  const nextItem = {
    id: entry?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    entry,
    reason,
    createdAt: new Date().toISOString()
  };

  setFailedHistoryQueue(uid, [nextItem, ...queue].slice(0, 25));
}

function getWorkoutDraftKey(uid, workoutId) {
  return `${WORKOUT_DRAFT_STORAGE_KEY}:${uid || "unknown"}:${workoutId || "unknown"}`;
}

function clearWorkoutDraft(uid, workoutId) {
  try {
    localStorage.removeItem(getWorkoutDraftKey(uid, workoutId));
  } catch (_) {
    // ignore localStorage errors
  }
}

function makeTimeoutSignal(timeoutMs = 16000, externalSignal = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId)
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 16000) {
  const timeout = makeTimeoutSignal(timeoutMs, options.signal);

  try {
    return await fetch(url, {
      ...options,
      signal: timeout.signal
    });
  } finally {
    timeout.clear();
  }
}

function getAppErrorPreset(type = "api") {
  const presets = {
    offline: {
      title: "Нет интернета",
      text: "Проверь подключение. Данные останутся локально."
    },
    firebase: {
      title: "Firebase временно недоступен",
      text: "Изменения сохранены локально и не потеряются."
    },
    api: {
      title: "Сервер временно недоступен",
      text: "Попробуй ещё раз через несколько секунд."
    },
    timeout: {
      title: "Слишком долго",
      text: "Сервер отвечает дольше обычного. Попробуй позже."
    },
    savedLocal: {
      title: "Сохранено локально",
      text: "Данные не потеряются и синхронизируются позже."
    },
    load: {
      title: "Не удалось загрузить данные",
      text: "Проверь интернет или попробуй обновить страницу."
    }
  };

  return presets[type] || presets.api;
}

function showAppError(type = "api", customText = "") {
  if (typeof document === "undefined") return;

  const preset = getAppErrorPreset(type);
  const existing = document.querySelector(".appErrorToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `appErrorToast appErrorToast--${type}`;
  toast.innerHTML = `
    <div class="appErrorToastTitle">${preset.title}</div>
    <div class="appErrorToastText">${customText || preset.text}</div>
  `;

  document.body.appendChild(toast);

  window.clearTimeout(window.__workoutAppErrorToastTimer);
  window.__workoutAppErrorToastTimer = window.setTimeout(() => {
    toast.classList.add("appErrorToastOut");
    window.setTimeout(() => toast.remove(), 220);
  }, 4200);
}

function mergeNutritionStates(localState = {}, cloudState = {}, personalMyFoods = {}) {
  const mergedDays = {
    ...(cloudState.days || {}),
    ...(localState.days || {})
  };

  return {
    ...defaultNutritionState,
    ...cloudState,
    ...localState,
    goals: {
      ...defaultNutritionState.goals,
      ...(cloudState.goals || {}),
      ...(localState.goals || {})
    },
    days: mergedDays,
    favorites: [
      ...new Set([
        ...(cloudState.favorites || []),
        ...(localState.favorites || defaultNutritionState.favorites)
      ])
    ],
    recent: [
      ...new Set([
        ...(localState.recent || []),
        ...(cloudState.recent || [])
      ])
    ].slice(0, 80),
    myFoods: {
      ...(personalMyFoods || {}),
      ...(cloudState.myFoods || {}),
      ...(localState.myFoods || {})
    }
  };
}

const nutritionFoodDatabase = [
  { id: "food_chicken", name: "Куриная грудка", portion: "100 г", calories: 165, protein: 31, fat: 3.6, carbs: 0, barcode: "4810000000011" },
  { id: "food_rice", name: "Рис варёный", portion: "100 г", calories: 130, protein: 2.7, fat: 0.3, carbs: 28, barcode: "4810000000028" },
  { id: "food_buckwheat", name: "Гречка варёная", portion: "100 г", calories: 110, protein: 3.6, fat: 1.1, carbs: 21, barcode: "4810000000035" },
  { id: "food_egg", name: "Яйцо куриное", portion: "1 шт", calories: 78, protein: 6.3, fat: 5.3, carbs: 0.6, barcode: "4810000000042" },
  { id: "food_curd", name: "Творог 5%", portion: "100 г", calories: 121, protein: 17, fat: 5, carbs: 1.8, barcode: "4810000000059" },
  { id: "food_oatmeal", name: "Овсянка", portion: "100 г", calories: 68, protein: 2.4, fat: 1.4, carbs: 12, barcode: "4810000000066" },
  { id: "food_banana", name: "Банан", portion: "1 шт", calories: 105, protein: 1.3, fat: 0.3, carbs: 27, barcode: "4810000000073" },
  { id: "food_salmon", name: "Лосось", portion: "100 г", calories: 208, protein: 20, fat: 13, carbs: 0, barcode: "4810000000080" },
  { id: "food_yogurt", name: "Греческий йогурт", portion: "100 г", calories: 73, protein: 10, fat: 2, carbs: 3.6, barcode: "4810000000097" },
  { id: "food_protein", name: "Протеин", portion: "1 порция", calories: 120, protein: 24, fat: 1.5, carbs: 3, barcode: "4810000000103" },
  { id: "food_apple", name: "Яблоко", portion: "1 шт", calories: 95, protein: 0.5, fat: 0.3, carbs: 25, barcode: "4810000000110" },
  { id: "food_potato", name: "Картофель варёный", portion: "100 г", calories: 87, protein: 1.9, fat: 0.1, carbs: 20, barcode: "4810000000127" }
];

const defaultNutritionState = {
  goals: { calories: 2400, protein: 160, fat: 75, carbs: 260, water: 2500 },
  days: {},
  favorites: ["food_chicken", "food_rice", "food_curd", "food_protein"],
  recent: [],
  myFoods: {}
};

const nutritionMeals = [
  { id: "breakfast", name: "Завтрак", icon: "🌅" },
  { id: "lunch", name: "Обед", icon: "☀️" },
  { id: "dinner", name: "Ужин", icon: "🌇" },
  { id: "snack", name: "Перекус/Другое", icon: "🌙" }
];

const NUTRITION_ICON_PRESETS = ["🍗", "🥩", "🐟", "🥚", "🥛", "🧀", "🍚", "🥔", "🍞", "🥣", "🍌", "🍎", "🍓", "🥦", "🥗", "🍲", "☕", "🥤", "🍫", "🍽️"];

const LOCAL_NUTRITION_SEARCH_LIMIT = 24;

function normalizeLocalCatalogFood(food = {}) {
  const portionAmount = Number(food.defaultGram || food.defaultAmount || 100) || 100;
  const basisUnit = food.basisUnit || "g";

  return {
    id: food.id || `local_${String(food.name || "").toLowerCase().replace(/\s+/g, "_")}`,
    foodId: food.id || "",
    name: food.name || "Продукт",
    aliases: food.aliases || [],
    brand: food.brand || "",
    category: food.category || "",
    source: food.source || "Локальная база",
    sourceType: "local_catalog",
    basisUnit,
    portion: basisUnit === "ml" ? `${portionAmount} мл` : `${portionAmount} г`,
    portionAmount,
    defaultGram: portionAmount,
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    fat: Number(food.fat) || 0,
    carbs: Number(food.carbs) || 0,
    icon: food.emoji || food.icon || "🍽️",
    emoji: food.emoji || food.icon || "🍽️",
    portionTypes: food.portionTypes || []
  };
}

function searchLocalNutritionFoods(query, limit = LOCAL_NUTRITION_SEARCH_LIMIT) {
  return searchLocalNutritionCatalog(
    query,
    localNutritionFoods,
    localNutritionPrefixIndex,
    localNutritionExactIndex,
    limit
  ).map(normalizeLocalCatalogFood);
}

function mapNutritionAiResultToLocalFoods(aiFood, limit = 8) {
  return mapAiFoodToLocalCatalog(
    aiFood,
    localNutritionFoods,
    localNutritionPrefixIndex,
    localNutritionExactIndex
  ).slice(0, limit).map(normalizeLocalCatalogFood);
}

function mergeNutritionFoodResults(primary = [], secondary = [], limit = 40) {
  const map = new Map();

  [...primary, ...secondary].forEach((food) => {
    const normalizedFood = normalizeNutritionFood(food);
    const key = normalizedFood.id || normalizedFood.foodId || normalizedFood.name;
    if (key && !map.has(key)) {
      map.set(key, normalizedFood);
    }
  });

  return Array.from(map.values()).slice(0, limit);
}

const WORKOUT_READINESS_OPTIONS = [
  {
    id: "excellent",
    emoji: "😤",
    title: "Отлично",
    subtitle: "Можно добавить вес",
    weightFactor: 1,
    volumeText: "следующий шаг веса вверх"
  },
  {
    id: "good",
    emoji: "🙂",
    title: "Нормально",
    subtitle: "Работаем по плану",
    weightFactor: 1,
    volumeText: "вес без изменений"
  },
  {
    id: "bad",
    emoji: "😵",
    title: "Плохо",
    subtitle: "Снизим нагрузку",
    weightFactor: 0.85,
    volumeText: "минус 15% с шагом веса"
  }
];

const STANDARD_GYM_WEIGHTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
  32, 34, 36, 38, 40,
  42.5, 45, 47.5, 50, 52.5, 55, 57.5, 60,
  62.5, 65, 67.5, 70, 72.5, 75, 77.5, 80,
  82.5, 85, 87.5, 90, 92.5, 95, 97.5, 100,
  105, 110, 115, 120, 125, 130, 135, 140,
  145, 150, 160, 170, 180, 190, 200
];

function getWorkoutReadinessOption(id) {
  return WORKOUT_READINESS_OPTIONS.find((item) => item.id === id) || WORKOUT_READINESS_OPTIONS[1];
}

function roundToStandardGymWeight(value, direction = "nearest") {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "";

  const weights = STANDARD_GYM_WEIGHTS;
  if (direction === "up") {
    return weights.find((weight) => weight > numericValue) || weights[weights.length - 1];
  }

  if (direction === "down") {
    return [...weights].reverse().find((weight) => weight <= numericValue) || weights[0];
  }

  return weights.reduce((closest, current) => (
    Math.abs(current - numericValue) < Math.abs(closest - numericValue) ? current : closest
  ), weights[0]);
}

function getAdjustedWorkoutWeight(weight, readinessId) {
  const numericWeight = Number(String(weight || "").replace(",", "."));
  if (!Number.isFinite(numericWeight) || numericWeight <= 0) return "";

  const readiness = getWorkoutReadinessOption(readinessId);

  if (readiness.id === "excellent") {
    // Отлично: не проценты, а ровно следующий доступный шаг веса.
    return roundToStandardGymWeight(numericWeight, "up");
  }

  if (readiness.id === "bad") {
    // Плохо: минус 15% и округление вниз под доступный шаг веса.
    return roundToStandardGymWeight(numericWeight * 0.85, "down");
  }

  // Нормально: вес без изменений, но нормализуем под ближайший шаг.
  return roundToStandardGymWeight(numericWeight, "nearest");
}

function parseWorkoutWeightValue(value) {
  const numeric = Number(String(value || "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function getBestProgressiveSetWeight(exerciseName, setIndex, history = []) {
  let best = 0;

  getAiHistoryItems(history).forEach((historyWorkout) => {
    const exercise = (historyWorkout.exercises || []).find((item) => item.name === exerciseName);
    if (!exercise?.sets?.length) return;

    const set = exercise.sets[setIndex] || exercise.sets[exercise.sets.length - 1];
    const actualWeight = parseWorkoutWeightValue(set?.weight);
    const originalWeight = parseWorkoutWeightValue(set?.aiOriginalWeight);
    const suggestedWeight = parseWorkoutWeightValue(set?.aiSuggestedWeight);
    const protectedBase = Math.max(originalWeight, suggestedWeight);

    // Only saved/completed workouts are in history. If workout was adapted down and actual weight is lower, do not let it reduce future suggestions.
    const candidate = Math.max(actualWeight, protectedBase);

    if (candidate > best) best = candidate;
  });

  return best;
}

function getAiWorkoutBaseWeight(exerciseName, set, setIndex, history = []) {
  const programWeight = parseWorkoutWeightValue(set?.aiOriginalWeight || set?.weight);
  const bestHistoryWeight = getBestProgressiveSetWeight(exerciseName, setIndex, history);

  return Math.max(programWeight, bestHistoryWeight);
}

const POST_WORKOUT_FEEDBACK_OPTIONS = [
  {
    id: "good",
    emoji: "🔥",
    title: "Хорошо",
    subtitle: "Можно прогрессировать",
    advice: "Отличная работа. Продолжай в том же духе — AI сможет постепенно повышать нагрузку."
  },
  {
    id: "normal",
    emoji: "🙂",
    title: "Нормально",
    subtitle: "Стабильная тренировка",
    advice: "Хорошая стабильная работа. Не обязательно прогрессировать каждую тренировку."
  },
  {
    id: "bad",
    emoji: "😵",
    title: "Плохо",
    subtitle: "Нужно восстановление",
    advice: "Сделай акцент на сне, воде, углеводах и восстановлении. Следующую тренировку начни легче."
  }
];

const AI_COACH_FEATURES = [
  {
    id: "liveCoach",
    icon: "⚡",
    title: "AI-помощник тренировки",
    subtitle: "Подсказки перед и во время тренировки"
  },
  {
    id: "recovery",
    icon: "🧘",
    title: "Восстановление",
    subtitle: "Оценка отдыха и готовности"
  },
  {
    id: "muscleProgram",
    icon: "🎯",
    title: "Программа под мышцы",
    subtitle: "Что качать следующим"
  },
  {
    id: "nutritionPlan",
    icon: "🍽️",
    title: "План питания",
    subtitle: "Калории, белки и фокус дня"
  },
  {
    id: "motivation",
    icon: "🔥",
    title: "Мотивация",
    subtitle: "Короткий настрой перед залом"
  },
  {
    id: "progress",
    icon: "📈",
    title: "Прогресс",
    subtitle: "Анализ истории тренировок"
  },
  {
    id: "overload",
    icon: "🛡️",
    title: "Перегрузка мышц",
    subtitle: "Где стоит снизить нагрузку"
  },
  {
    id: "swap",
    icon: "🔁",
    title: "Автозамена упражнений",
    subtitle: "Замены без потери смысла"
  }
];

const AI_MUSCLE_RULES = [
  { muscle: "Ноги", keywords: ["ног", "жим ног", "выпад", "румын", "разгибание ног", "присед", "тяга"] },
  { muscle: "Спина", keywords: ["тяга", "спин", "верхнего блока", "т-грифа", "греб", "поясу"] },
  { muscle: "Грудь", keywords: ["груд", "жим лёжа", "жим лежа", "сведение", "гантелей лёжа", "смит"] },
  { muscle: "Плечи", keywords: ["плеч", "дельт", "отведение", "вертикальный жим", "жим в тренаж"] },
  { muscle: "Руки", keywords: ["сгибание", "разгибание рук", "бицеп", "трицеп", "скотт", "кроссовер"] },
  { muscle: "Пресс", keywords: ["пресс", "скручив"] }
];

function getAiExerciseMuscles(name = "") {
  const lowerName = String(name).toLowerCase();
  const muscles = AI_MUSCLE_RULES
    .filter((rule) => rule.keywords.some((keyword) => lowerName.includes(keyword)))
    .map((rule) => rule.muscle);

  return muscles.length ? [...new Set(muscles)] : ["Общая нагрузка"];
}

function getAiHistoryItems(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((item) => ({
      ...item,
      parsedDate: new Date(item.date || item.createdAt || Date.now())
    }))
    .filter((item) => !Number.isNaN(item.parsedDate.getTime()))
    .sort((a, b) => b.parsedDate - a.parsedDate);
}

function getAiMuscleLoad(history = [], days = 14) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const load = {};

  getAiHistoryItems(history).forEach((workout) => {
    const ageDays = Math.max(0, Math.round((now - workout.parsedDate.getTime()) / dayMs));
    if (ageDays > days) return;

    (workout.exercises || []).forEach((exercise) => {
      const setCount = Array.isArray(exercise.sets) ? exercise.sets.length : 0;
      getAiExerciseMuscles(exercise.name).forEach((muscle) => {
        load[muscle] = (load[muscle] || 0) + Math.max(1, setCount);
      });
    });
  });

  return load;
}

function getAiNutritionTotalsForToday(nutrition = {}) {
  const day = nutrition.days?.[todayNutritionKey()] || makeEmptyNutritionDay();
  return (day.foods || []).reduce(
    (sum, item) => ({
      calories: sum.calories + (Number(item.calories) || 0),
      protein: sum.protein + (Number(item.protein) || 0),
      fat: sum.fat + (Number(item.fat) || 0),
      carbs: sum.carbs + (Number(item.carbs) || 0)
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

function buildAiCoachResult(featureId, { history = [], nutrition = defaultNutritionState, plan = starterPlan } = {}) {
  const historyItems = getAiHistoryItems(history);
  const lastWorkout = historyItems[0];
  const load14 = getAiMuscleLoad(historyItems, 14);
  const load7 = getAiMuscleLoad(historyItems, 7);
  const sortedLoad = Object.entries(load14).sort((a, b) => b[1] - a[1]);
  const heavyMuscle = sortedLoad[0]?.[0] || "нет данных";
  const lightMuscle = sortedLoad.at(-1)?.[0] || "нет данных";
  const lastWorkoutDays = lastWorkout
    ? Math.max(0, Math.round((Date.now() - lastWorkout.parsedDate.getTime()) / (24 * 60 * 60 * 1000)))
    : null;
  const todayTotals = getAiNutritionTotalsForToday(nutrition);
  const goals = nutrition.goals || defaultNutritionState.goals;
  const aiNutritionDayModel = buildAiNutritionDayModel(nutrition, null, history);
  const aiNutritionBaseline = getAiNutritionHistoryBaseline();
  const proteinLeft = Math.max(0, Math.round((Number(goals.protein) || 0) - todayTotals.protein));
  const caloriesLeft = Math.max(0, Math.round((Number(goals.calories) || 0) - todayTotals.calories));
  const workoutsCount = historyItems.length;
  const plannedExercises = (plan.workouts || []).flatMap((workout) => workout.exercises || []);
  const swapBase = plannedExercises.find((exercise) => getAiExerciseMuscles(exercise.name).includes(heavyMuscle)) || plannedExercises[0];

  const baseStats = {
    workoutsCount,
    lastWorkoutText: lastWorkoutDays === null ? "нет истории" : `${lastWorkoutDays} дн. назад`,
    heavyMuscle,
    caloriesLeft
  };

  const results = {
    liveCoach: {
      title: "AI-помощник на сегодня",
      status: lastWorkoutDays === null ? "Нужна первая история" : lastWorkoutDays <= 1 ? "Лёгкий контроль" : "Можно работать",
      score: lastWorkoutDays === null ? 45 : lastWorkoutDays <= 1 ? 68 : 86,
      bullets: [
        lastWorkoutDays === null
          ? "После 1–2 сохранённых тренировок подсказки станут точнее."
          : `Последняя тренировка была ${baseStats.lastWorkoutText}.`,
        heavyMuscle !== "нет данных"
          ? `Самая нагруженная зона за 14 дней: ${heavyMuscle}.`
          : "Пока мало данных по мышечным группам.",
        "Во время тренировки держи 1–2 повтора в запасе и не гонись за весом в первом подходе."
      ],
      actions: [
        "Начни с разминочного подхода 50–60% от рабочего веса.",
        "Если техника плывёт — снизь вес на 5–10%.",
        "Фиксируй реальные веса, чтобы AI точнее считал прогресс."
      ]
    },
    recovery: {
      title: "AI-анализ восстановления",
      status: lastWorkoutDays === null ? "Нет данных" : lastWorkoutDays <= 1 ? "Низкое восстановление" : lastWorkoutDays <= 3 ? "Нормально" : "Готов к нагрузке",
      score: lastWorkoutDays === null ? 40 : lastWorkoutDays <= 1 ? 58 : lastWorkoutDays <= 3 ? 78 : 90,
      bullets: [
        lastWorkoutDays === null ? "История тренировок пока пустая." : `Последняя тренировка: ${baseStats.lastWorkoutText}.`,
        Object.keys(load7).length ? `За 7 дней больше всего работали: ${Object.entries(load7).sort((a, b) => b[1] - a[1])[0][0]}.` : "За неделю нагрузка не найдена.",
        proteinLeft > 0 ? `По белку сегодня осталось примерно ${proteinLeft} г.` : "Белок сегодня выглядит закрытым."
      ],
      actions: [
        lastWorkoutDays !== null && lastWorkoutDays <= 1 ? "Сегодня не делай отказные подходы." : "Можно планировать обычную силовую работу.",
        "Добавь 7–10 минут разминки и 1 лёгкий подход на первое упражнение.",
        "Если сон/энергия плохие — оставь RPE около 7/10."
      ]
    },
    muscleProgram: {
      title: "AI-подбор программы под мышцы",
      status: lightMuscle !== "нет данных" ? `Фокус: ${lightMuscle}` : "Нужна история",
      score: workoutsCount ? 82 : 46,
      bullets: [
        lightMuscle !== "нет данных" ? `Меньше всего нагрузки за 14 дней получила зона: ${lightMuscle}.` : "Пока мало сохранённых тренировок для точного выбора.",
        heavyMuscle !== "нет данных" ? `${heavyMuscle} лучше не перегружать в следующей тренировке.` : "После истории AI будет сравнивать мышцы.",
        `В текущем плане найдено упражнений: ${plannedExercises.length}.`
      ],
      actions: [
        lightMuscle !== "нет данных" ? `Следующую тренировку начни с акцента на ${lightMuscle}.` : "Сохрани 2–3 тренировки для персонального подбора.",
        "Оставь 4–6 рабочих упражнений без лишнего объёма.",
        "На отстающую группу дай 1 дополнительный качественный подход."
      ]
    },
    nutritionPlan: {
      title: "AI-план питания",
      status: `${aiNutritionDayModel.score}/10 · база ${aiNutritionBaseline.average.calories} ккал`,
      score: Math.round(aiNutritionDayModel.score * 10),
      bullets: [
        aiNutritionDayModel.summary,
        `Твоя база март–апрель: ${aiNutritionBaseline.average.calories} ккал · Б ${Math.round(aiNutritionBaseline.average.protein)} · Ж ${Math.round(aiNutritionBaseline.average.fat)} · У ${Math.round(aiNutritionBaseline.average.carbs)}.`,
        `Сегодня получено: ${Math.round(todayTotals.calories)} ккал из ${goals.calories}.`
      ],
      actions: [
        aiNutritionDayModel.adaptiveAdvice,
        aiNutritionDayModel.weeklyText,
        proteinLeft > 0 ? `Добери белок: примерно ${proteinLeft} г.` : "Белок закрыт — держи баланс по жирам и углеводам."
      ]
    },
    motivation: {
      title: "AI-мотивация перед тренировкой",
      status: "Готов к залу",
      score: 92,
      bullets: [
        "Сегодня задача не доказать всем, а сделать свою работу чисто.",
        "Три качественных подхода лучше, чем хаотичная гонка за весом.",
        "Запиши каждый рабочий вес — это топливо для прогресса."
      ],
      actions: [
        "Разминка → первый рабочий подход → контроль техники.",
        "Не пропускай последнее упражнение, но не доводи технику до развала.",
        "После тренировки сохрани результат сразу."
      ]
    },
    progress: {
      title: "AI-анализ прогресса",
      status: workoutsCount ? `${workoutsCount} тренировок в истории` : "Нет истории",
      score: Math.min(94, 42 + workoutsCount * 8),
      bullets: [
        workoutsCount ? `Сохранённых тренировок: ${workoutsCount}.` : "История пока пустая.",
        lastWorkout ? `Последняя тренировка: ${lastWorkout.workout || "тренировка"}.` : "Сохрани тренировку, чтобы увидеть динамику.",
        sortedLoad.length ? `Главный объём сейчас идёт в: ${heavyMuscle}.` : "AI пока не видит распределение нагрузки."
      ],
      actions: [
        "Следи за ростом веса только при сохранении техники.",
        "Если 2 тренировки подряд легко — добавь 2,5–5 кг или 1–2 повтора.",
        "Не меняй программу слишком часто: дай ей 3–4 недели данных."
      ]
    },
    overload: {
      title: "AI-оценка перегрузки мышц",
      status: sortedLoad[0]?.[1] >= 18 ? `Риск: ${heavyMuscle}` : "Риск умеренный",
      score: sortedLoad[0]?.[1] >= 18 ? 62 : 84,
      bullets: [
        sortedLoad.length ? `${heavyMuscle}: ${sortedLoad[0][1]} подходов за 14 дней.` : "Нет данных для оценки перегрузки.",
        sortedLoad[1] ? `${sortedLoad[1][0]}: ${sortedLoad[1][1]} подходов.` : "Нужно больше истории для сравнения.",
        "AI считает риск по частоте и объёму, без медицинской диагностики."
      ],
      actions: [
        sortedLoad[0]?.[1] >= 18 ? `На ${heavyMuscle} сегодня убери 1–2 подхода.` : "Текущий объём выглядит адекватно.",
        "Боль в суставе — сигнал заменить упражнение, не терпеть.",
        "Сохраняй веса и подходы, чтобы оценка была точнее."
      ]
    },
    swap: {
      title: "AI-автозамена упражнений",
      status: swapBase ? "Замены готовы" : "Нет упражнений",
      score: swapBase ? 80 : 40,
      bullets: [
        swapBase ? `Базовое упражнение для замены: ${swapBase.name}.` : "В плане не найдены упражнения.",
        heavyMuscle !== "нет данных" ? `Если устала зона ${heavyMuscle}, выбирай более лёгкий аналог.` : "После истории замены будут точнее.",
        "Замена должна сохранять мышечную группу, но снижать риск и дискомфорт."
      ],
      actions: [
        "Жим → тренажёр/гантели с меньшим весом.",
        "Тяга → вариант с опорой грудью или блочный тренажёр.",
        "Ноги → тренажёр вместо свободного веса, если устала поясница."
      ]
    }
  };

  return results[featureId] || results.liveCoach;
}

const AI_NUTRITION_HISTORY_BASELINE = {
  source: "FatSecret · март–апрель 2026",
  months: [
    {
      id: "2026-03",
      label: "Март 2026",
      days: 31,
      average: { calories: 2419, fat: 67.42, carbs: 244.52, protein: 212.15 },
      meals: {
        breakfast: { calories: 926, fat: 32.31, carbs: 88.08, protein: 73.98 },
        lunch: { calories: 675, fat: 16.61, carbs: 75.43, protein: 56.74 },
        dinner: { calories: 528, fat: 14.26, carbs: 51.44, protein: 47.24 },
        snack: { calories: 290, fat: 4.24, carbs: 29.57, protein: 34.2 }
      }
    },
    {
      id: "2026-04",
      label: "Апрель 2026",
      days: 30,
      average: { calories: 2329, fat: 65.27, carbs: 234.86, protein: 208.26 },
      meals: {
        breakfast: { calories: 951, fat: 31.74, carbs: 87.94, protein: 81.41 },
        lunch: { calories: 777, fat: 20.94, carbs: 81.72, protein: 68.38 },
        dinner: { calories: 442, fat: 9.74, carbs: 47.52, protein: 42.52 },
        snack: { calories: 159, fat: 2.84, carbs: 17.68, protein: 15.96 }
      }
    }
  ],
  average: { calories: 2374, fat: 66.35, carbs: 239.69, protein: 210.21 },
  meals: {
    breakfast: { calories: 939, fat: 32.03, carbs: 88.01, protein: 77.7 },
    lunch: { calories: 726, fat: 18.78, carbs: 78.58, protein: 62.56 },
    dinner: { calories: 485, fat: 12.0, carbs: 49.48, protein: 44.88 },
    snack: { calories: 225, fat: 3.54, carbs: 23.63, protein: 25.08 }
  },
  patterns: [
    "Белок исторически высокий: около 210 г/день.",
    "Калории в среднем держались около 2370 ккал/день.",
    "Самый плотный приём пищи — завтрак, дальше идёт обед.",
    "Ужин обычно легче завтрака и обеда.",
    "Частые продукты: творог, яйца, Флэт Уайт, Exponenta/High-Pro, бананы, хлеб fitness, лёгкий сыр, индейка/вырезка, овощи."
  ]
};

function getAiNutritionHistoryBaseline() {
  return AI_NUTRITION_HISTORY_BASELINE;
}

function getAiNutritionTargetFromHistory(nutrition = defaultNutritionState) {
  const goals = nutrition.goals || defaultNutritionState.goals;
  const historyAverage = getAiNutritionHistoryBaseline().average;

  return {
    calories: Number(goals.calories) || historyAverage.calories,
    protein: Math.max(Number(goals.protein) || 0, Math.round(historyAverage.protein * 0.82)),
    fat: Number(goals.fat) || Math.round(historyAverage.fat),
    carbs: Number(goals.carbs) || Math.round(historyAverage.carbs)
  };
}

function buildAiNutritionDayModel(nutrition = defaultNutritionState, selectedDay = null, history = []) {
  const day = selectedDay || nutrition.days?.[todayNutritionKey()] || makeEmptyNutritionDay();
  const goals = nutrition.goals || defaultNutritionState.goals;
  const baseline = getAiNutritionHistoryBaseline();
  const totals = (day.foods || []).reduce(
    (sum, item) => ({
      calories: sum.calories + (Number(item.calories) || 0),
      protein: sum.protein + (Number(item.protein) || 0),
      fat: sum.fat + (Number(item.fat) || 0),
      carbs: sum.carbs + (Number(item.carbs) || 0)
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const left = {
    calories: Math.round((Number(goals.calories) || baseline.average.calories) - totals.calories),
    protein: Math.round((Number(goals.protein) || baseline.average.protein) - totals.protein),
    fat: Math.round((Number(goals.fat) || baseline.average.fat) - totals.fat),
    carbs: Math.round((Number(goals.carbs) || baseline.average.carbs) - totals.carbs)
  };

  const calorieProgress = (totals.calories / Math.max(1, Number(goals.calories) || baseline.average.calories)) * 100;
  const proteinProgress = (totals.protein / Math.max(1, Number(goals.protein) || baseline.average.protein)) * 100;
  const fatProgress = (totals.fat / Math.max(1, Number(goals.fat) || baseline.average.fat)) * 100;
  const carbsProgress = (totals.carbs / Math.max(1, Number(goals.carbs) || baseline.average.carbs)) * 100;

  let score = 10;
  if (totals.calories === 0) score = 6.2;
  if (calorieProgress > 110) score -= 1.4;
  if (calorieProgress < 65 && totals.calories > 0) score -= 1.0;
  if (proteinProgress < 70) score -= 1.2;
  if (fatProgress > 115) score -= 1.0;
  if (carbsProgress < 55 && totals.calories > 0) score -= 0.7;
  score = Math.max(4.8, Math.min(9.6, Math.round(score * 10) / 10));

  const badges = [];
  if (proteinProgress < 75) badges.push({ type: "warning", icon: "⚠️", text: "Мало" });
  else badges.push({ type: "good", icon: "💪", text: "Белок хорошо" });

  if (fatProgress > 110) badges.push({ type: "warning", icon: "🧈", text: "Перебор жиров" });
  if (calorieProgress >= 78 && calorieProgress <= 98) badges.push({ type: "good", icon: "🔥", text: "Хороший дефицит" });
  if (carbsProgress < 58) badges.push({ type: "info", icon: "🍚", text: "Мало еды до тренировки" });
  if (totals.calories === 0) badges.push({ type: "info", icon: "📊", text: "Жду первый приём" });

  const baselineDelta = Math.round(totals.calories - baseline.average.calories);
  const weeklyText = baselineDelta < -250
    ? "Ты заметно ниже своей базы марта–апреля. Если вес падает слишком быстро — добавь 100–150 ккал."
    : baselineDelta > 250
      ? "Сегодня выше твоей базы марта–апреля. Если цель похудение — остаток дня лучше сделать легче."
      : "Сегодня близко к твоей реальной базе марта–апреля. Коррекцию калорий можно делать плавно.";

  const adaptiveAdvice = fatProgress > 110
    ? "На остаток дня меньше сыра, орехов, масла и жирного мяса. Лучше белок + углеводы: творог/курица + рис/картофель/овощи."
    : proteinProgress < 75
      ? "На остаток дня добери белок: творог, Exponenta/High-Pro, курица, рыба или индейка."
      : carbsProgress < 58
        ? "Перед тренировкой добавь лёгкие углеводы: банан, рис, овсянка или хлеб fitness."
        : "День идёт ровно. Дальше держи простую еду и не перегружай жиры вечером.";

  return {
    score,
    badges: badges.slice(0, 4),
    totals,
    left,
    baseline,
    baselineDelta,
    weeklyText,
    adaptiveAdvice,
    summary: `${score}/10 — ${proteinProgress >= 75 ? "белок хорошо" : "белка мало"}, ${fatProgress > 110 ? "жиров много" : carbsProgress < 58 ? "углеводов мало" : "баланс нормальный"}.`,
    target: getAiNutritionTargetFromHistory(nutrition),
    hasHistoryData: true
  };
}

function hasRequiredAiNutritionProfileFields(profile = {}) {
  const weight = Number(String(profile?.weight || "").replace(",", "."));
  const height = Number(String(profile?.height || "").replace(",", "."));
  const age = Number(String(profile?.age || "").replace(",", "."));
  const sex = String(profile?.sex || "").trim();

  return (
    Number.isFinite(weight) &&
    weight > 0 &&
    Number.isFinite(height) &&
    height > 0 &&
    Number.isFinite(age) &&
    age > 0 &&
    (sex === "male" || sex === "female")
  );
}

function getAiNutritionGoalLabel(goal) {
  if (goal === "mass") return "Набор массы";
  if (goal === "cut") return "Похудение";
  if (goal === "dry") return "Сушка";
  if (goal === "maintain") return "Поддержка";
  if (goal === "recomp") return "Рекомп.";
  return "Рекомпозиция";
}

function getAiNutritionGoalShort(goal) {
  if (goal === "mass") return "набор";
  if (goal === "cut") return "похудение";
  if (goal === "dry") return "сушка";
  if (goal === "maintain") return "поддержка";
  if (goal === "recomp") return "рекомпозиция";
  return "рекомпозиция";
}

function collectAiNutritionFoodStats(nutrition = defaultNutritionState) {
  const counts = {};
  Object.values(nutrition.days || {}).forEach((day) => {
    (day.foods || []).forEach((food) => {
      const name = getShortFoodName(food.name || "");
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
  });

  Object.values(nutrition.myFoods || {}).forEach((food) => {
    const name = getShortFoodName(food.name || "");
    if (!name) return;
    counts[name] = Math.max(counts[name] || 0, Number(food.useCount) || 1);
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
}

function getAiNutritionWeightTrend(nutrition = defaultNutritionState) {
  const weights = Object.entries(nutrition.days || {})
    .map(([key, day]) => ({ key, weight: Number(String(day?.weight || "").replace(",", ".")) }))
    .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => a.key.localeCompare(b.key));

  if (weights.length < 2) {
    return { status: "нет данных", delta: 0, text: "Добавь 2–3 замера веса, и AI начнёт делать недельную коррекцию." };
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const delta = Math.round((last.weight - first.weight) * 10) / 10;
  const status = delta > 0.4 ? "растёт" : delta < -0.4 ? "падает" : "стоит";

  return {
    status,
    delta,
    text: `Вес ${status}: ${delta > 0 ? "+" : ""}${delta} кг за период записей.`
  };
}

function getAiNutritionCurrentWeek(plan) {
  if (!plan?.createdAt) return 1;
  const created = new Date(plan.createdAt);
  if (Number.isNaN(created.getTime())) return 1;
  const diffDays = Math.max(0, Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)));
  return Math.min(4, Math.floor(diffDays / 7) + 1);
}

const AI_NUTRITION_WEEK_DAYS = [
  { id: "mon", short: "Пн", label: "Понедельник" },
  { id: "tue", short: "Вт", label: "Вторник" },
  { id: "wed", short: "Ср", label: "Среда" },
  { id: "thu", short: "Чт", label: "Четверг" },
  { id: "fri", short: "Пт", label: "Пятница" },
  { id: "sat", short: "Сб", label: "Суббота" },
  { id: "sun", short: "Вс", label: "Воскресенье" }
];

function getTodayAiNutritionWeekDayId(date = new Date()) {
  const jsDay = date.getDay();
  return AI_NUTRITION_WEEK_DAYS[jsDay === 0 ? 6 : jsDay - 1]?.id || "mon";
}

function getAiNutritionTrainingDays(profile = {}) {
  return Array.isArray(profile?.trainingDays) ? profile.trainingDays : [];
}

function isAiNutritionTrainingDay(profile = {}, date = new Date()) {
  return getAiNutritionTrainingDays(profile).includes(getTodayAiNutritionWeekDayId(date));
}

function getAiNutritionDayMacros(baseMacros, profile = {}, date = new Date()) {
  const macros = {
    calories: Math.round(Number(baseMacros?.calories) || 0),
    protein: Math.round(Number(baseMacros?.protein) || 0),
    fat: Math.round(Number(baseMacros?.fat) || 0),
    carbs: Math.round(Number(baseMacros?.carbs) || 0)
  };

  if (!isAiNutritionTrainingDay(profile, date)) {
    return { ...macros, isTrainingDay: false };
  }

  const goal = profile?.goal || "recomp";
  const calorieBoost = goal === "mass" ? 180 : goal === "dry" ? 90 : goal === "cut" ? 80 : goal === "maintain" ? 70 : 130;
  const carbsBoost = goal === "dry" ? 25 : goal === "cut" ? 20 : goal === "maintain" ? 18 : 35;

  return {
    ...macros,
    isTrainingDay: true,
    calories: macros.calories + calorieBoost,
    carbs: macros.carbs + carbsBoost
  };
}

function getAiNutritionTrainingDayAdvice(isTrainingDay, goal = "recomp") {
  if (!isTrainingDay) {
    return "День без тренировки: держи обычные КБЖУ, не перегружай жиры вечером и оставь питание ровным.";
  }

  if (goal === "dry") {
    return "Тренировочный день на сушке: белок держим высоким, углеводы лучше поставить до/после тренировки, жиры не повышать.";
  }

  if (goal === "cut") {
    return "Тренировочный день в дефиците: добавь часть углеводов до/после зала, чтобы тренировка не просела.";
  }

  if (goal === "mass") {
    return "Тренировочный день на наборе: держи небольшой профицит и добавь углеводы вокруг тренировки.";
  }

  if (goal === "maintain") {
    return "Тренировочный день на поддержке: держи калории ровно, небольшой углеводный акцент до/после зала без общего профицита.";
  }

  return "Тренировочный день на рекомпозиции: белок выше, углеводы вокруг тренировки, лёгкий дефицит в дни отдыха.";
}

function calculateAiNutritionMacros(calories, weight, goal = "recomp") {
  const safeCalories = Math.max(1400, Math.round(Number(calories) || 2200));
  const safeWeight = Math.max(45, Number(weight) || 80);
  const proteinMultiplier = goal === "dry" ? 2.35 : goal === "cut" ? 2.15 : goal === "mass" ? 1.9 : goal === "maintain" ? 1.8 : 2.15;
  const fatMultiplier = goal === "dry" ? 0.72 : goal === "cut" ? 0.75 : goal === "mass" ? 0.85 : goal === "maintain" ? 0.85 : 0.78;
  const protein = Math.round(safeWeight * proteinMultiplier);
  const fat = Math.round(safeWeight * fatMultiplier);
  const carbs = Math.max(goal === "dry" ? 100 : 80, Math.round((safeCalories - protein * 4 - fat * 9) / 4));

  return { calories: safeCalories, protein, fat, carbs };
}

function getAiNutritionActivityMultiplier(activity = "medium") {
  if (activity === "low") return 1.32;
  if (activity === "high") return 1.62;
  return 1.48;
}

function calculateAiNutritionBmr({ weight = 80, height = 180, age = 30, sex = "male" } = {}) {
  const safeWeight = Math.max(35, Number(weight) || 80);
  const safeHeight = Math.max(120, Number(height) || 180);
  const safeAge = Math.max(14, Number(age) || 30);

  return Math.round(10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + (sex === "female" ? -161 : 5));
}

function calculatePersonalAiNutritionCalories(profile = {}, nutrition = defaultNutritionState) {
  const baseline = getAiNutritionHistoryBaseline();
  const weight = Number(profile?.weight) || 80;
  const height = Number(profile?.height) || 180;
  const age = Number(profile?.age) || 30;
  const sex = profile?.sex || "male";
  const activity = profile?.activity || "medium";
  const goal = profile?.goal || "recomp";

  const bmr = calculateAiNutritionBmr({ weight, height, age, sex });
  const maintenance = Math.round(bmr * getAiNutritionActivityMultiplier(activity));
  const historyAverage = Number(baseline.average.calories) || maintenance;

  // History is useful, but personal body data should be the main base for new users.
  const personalizedBase = Math.round(maintenance * 0.72 + historyAverage * 0.28);

  if (goal === "mass") return Math.round(personalizedBase + 220);
  if (goal === "cut") return Math.round(personalizedBase - 320);
  if (goal === "dry") return Math.round(personalizedBase - 180);
  if (goal === "maintain") return Math.round(personalizedBase);
  return Math.round(personalizedBase - 120);
}

function getAiNutritionActivityLabel(activity = "medium") {
  if (activity === "low") return "низкая активность";
  if (activity === "high") return "высокая активность";
  return "средняя активность";
}

function buildAiNutritionMonthlyPlan(nutrition = defaultNutritionState, profile = null, history = [], previousPlan = null) {
  const baseline = getAiNutritionHistoryBaseline();
  const goals = nutrition.goals || defaultNutritionState.goals;
  const weight = Number(profile?.weight) || 80;
  const height = Number(profile?.height) || 180;
  const age = Number(profile?.age) || 30;
  const sex = profile?.sex || "male";
  const goal = profile?.goal || "recomp";
  const trainingDays = getAiNutritionTrainingDays(profile);
  const activity = profile?.activity || "medium";
  const baseFromHistory = Number(baseline.average.calories) || 2374;
  const bmr = calculateAiNutritionBmr({ weight, height, age, sex });
  const estimatedMaintenance = Math.round(bmr * getAiNutritionActivityMultiplier(activity));
  const personalStartCalories = calculatePersonalAiNutritionCalories(profile, nutrition);
  const previousStartCalories = Number(previousPlan?.start?.calories || previousPlan?.weeks?.[0]?.calories);
  const sameGoalAsPrevious = previousPlan?.profile?.goal === goal;

  // Personalized plan: body metrics + activity + goal are the source of truth.
  // Old nutrition.goals / old calorieAnchor must not keep all users on the same calories.
  const currentGoal = personalStartCalories;

  let startCalories = personalStartCalories;

  // Only protect against accidental repeated cuts on refresh.
  // If profile data changed, the personal calculation wins.
  const sameBodyProfile =
    String(previousPlan?.profile?.weight || "") === String(profile?.weight || "") &&
    String(previousPlan?.profile?.height || "") === String(profile?.height || "") &&
    String(previousPlan?.profile?.age || "") === String(profile?.age || "") &&
    String(previousPlan?.profile?.sex || "") === String(sex) &&
    String(previousPlan?.profile?.activity || "medium") === String(activity);

  if (sameGoalAsPrevious && sameBodyProfile && previousStartCalories > 0 && goal !== "mass") {
    startCalories = Math.max(startCalories, previousStartCalories);
  }

  startCalories = Math.max(goal === "dry" ? 1800 : 1600, startCalories);

  // Protection: refresh must not use already AI-reduced calories as a new base.
  // If the goal did not change, do not auto-cut below the previous week-1 plan.
  if (sameGoalAsPrevious && previousStartCalories > 0 && goal !== "mass") {
    startCalories = Math.max(startCalories, previousStartCalories);
  }

  const weekSteps = goal === "mass"
    ? [0, 100, 200, 250]
    : goal === "cut"
      ? [0, -75, -125, -150]
      : goal === "dry"
        ? [0, -50, -75, -100]
        : goal === "maintain"
          ? [0, 0, 0, 0]
          : [0, -25, -50, -50];
  const weeks = weekSteps.map((step, index) => {
    const macros = calculateAiNutritionMacros(startCalories + step, weight, goal);
    const trainingMacros = getAiNutritionDayMacros(macros, { goal, trainingDays }, new Date());
    return {
      week: index + 1,
      label: `${index + 1} неделя`,
      ...macros,
      trainingDay: {
        calories: trainingMacros.calories,
        protein: trainingMacros.protein,
        fat: trainingMacros.fat,
        carbs: trainingMacros.carbs
      },
      focus: index === 0
        ? "закрепить стартовые КБЖУ"
        : index === 1
          ? "сравнить вес и среднюю калорийность"
          : index === 2
            ? "мягко скорректировать калории"
            : "оценить прогресс и обновить план"
    };
  });

  const weightTrend = getAiNutritionWeightTrend(nutrition);
  const frequentFoods = collectAiNutritionFoodStats(nutrition);
  const workoutsCount = getAiHistoryItems(history).length;
  const currentWeek = weeks[0];

  return {
    id: `ai_nutrition_${Date.now()}`,
    version: 1,
    createdAt: new Date().toISOString(),
    calorieAnchor: currentGoal,
    personalMaintenance: estimatedMaintenance,
    personalBmr: bmr,
    activityLabel: getAiNutritionActivityLabel(activity),
    profile: {
      weight: String(profile?.weight || ""),
      height: String(profile?.height || ""),
      age: String(profile?.age || ""),
      sex,
      activity,
      goal,
      trainingDays
    },
    goalLabel: getAiNutritionGoalLabel(goal),
    start: currentWeek,
    weeks,
    baseline,
    frequentFoods,
    workoutsCount,
    weightTrend,
    warnings: [
      goal === "dry"
        ? "Сушка: дефицит мягкий, белок выше, жиры не режем в ноль, углеводы держим вокруг тренировки."
        : goal === "cut"
          ? "Не режь калории резко: белок держим высоким, жиры не опускаем слишком низко."
          : "Не повышай калории слишком быстро: лучше +100–150 ккал и контроль веса.",
      "Обновление и пересоздание плана не режут калории повторно: снижение только после реального плато веса.",
      "Если тренировки тяжёлые — углеводы лучше держать вокруг тренировки."
    ],
    comment: goal === "mass"
      ? "План построен индивидуально по весу, росту, возрасту, полу, активности и цели: плавный профицит для набора."
      : goal === "dry"
        ? "План построен индивидуально под сушку: умеренный дефицит, высокий белок и энергия для тренировок."
        : goal === "cut"
          ? "План построен индивидуально: аккуратный дефицит без провала и резкого среза калорий."
          : "План построен индивидуально для поддержки/рекомпозиции: калории близко к личной норме и акцент на стабильность."
  };
}

const NUTRITION_QUICK_SEARCHES = [
  "молоко",
  "творог",
  "куриная грудка",
  "овсянка",
  "гречка",
  "яйца",
  "банан",
  "кефир"
];

const RECENT_NUTRITION_SEARCHES_KEY = "nutrition_recent_foods_v1";
const AI_NUTRITION_PROFILE_STORAGE_KEY = "ai_nutrition_profile_v1";
const AI_NUTRITION_PLAN_STORAGE_KEY = "ai_nutrition_plan_v1";

// HARDER DELETE SWIPE
const NUTRITION_DELETE_THRESHOLD = -135;

function loadRecentNutritionFoods() {
  try {
    const raw = localStorage.getItem(RECENT_NUTRITION_SEARCHES_KEY);
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value.slice(0, 8) : [];
  } catch (_) {
    return [];
  }
}

function saveRecentNutritionFood(food) {
  try {
    if (!food?.name) return;

    const current = loadRecentNutritionFoods();
    const next = [
      food,
      ...current.filter((item) => item?.name !== food.name)
    ].slice(0, 8);

    localStorage.setItem(RECENT_NUTRITION_SEARCHES_KEY, JSON.stringify(next));
  } catch (_) {
    // ignore localStorage errors
  }
}

function getSearchHistoryName(food) {
  const rawName = String(food?.name || "").trim();

  return rawName
    .replace(/\s+[—–-]\s+.*$/u, "")
    .replace(/\s*\(.*?\)\s*$/u, "")
    .replace(/[,;:]\s*.*$/u, "")
    .replace(/\s+\d+[,.]?\d*\s*(г|гр|g|мл|ml|ккал|кал|шт)\b.*$/iu, "")
    .trim();
}

function todayNutritionKey() {
  return dateToNutritionKey(new Date());
}

function dateToNutritionKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nutritionKeyToDate(key) {
  const [year, month, day] = String(key || todayNutritionKey()).split("-").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
}

function shiftNutritionDateKey(key, days) {
  const date = nutritionKeyToDate(key);
  date.setDate(date.getDate() + days);
  return dateToNutritionKey(date);
}

function makeEmptyNutritionDay() {
  return {
    foods: [],
    water: 0,
    weight: "",
    note: ""
  };
}

function formatNutritionDateLabel(date = new Date()) {
  return date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

function normalizeNutritionFood(food) {
  const foodId = food.id || food.foodId || food.fatSecretId || `food_${Date.now()}`;
  return {
    id: String(foodId),
    foodId: String(foodId),
    name: food.name || "Продукт",
    portion: food.portion || "100 г",
    calories: parseNutritionNumber(food.calories, 0),
    protein: parseNutritionNumber(food.protein, 0),
    fat: parseNutritionNumber(food.fat, 0),
    carbs: parseNutritionNumber(food.carbs, 0),
    barcode: food.barcode || "",
    source: food.source || "Локальная база",
    icon: food.icon || getFoodIcon(food),
    portionAmount: parseNutritionNumber(food.portionAmount, 0),
    lastAmount: parseNutritionNumber(food.lastAmount, 0),
    amountMode: food.amountMode || "",
    type: food.type || "",
    ingredients: Array.isArray(food.ingredients) ? food.ingredients : [],
    totalWeight: parseNutritionNumber(food.totalWeight, 0) || parseNutritionNumber(food.portionAmount, 0) || 0
  };
}

function getFoodScale(amount, food = null, mode = "grams") {
  const parsedAmount = Number(String(amount).replace(",", "."));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return 1;

  if (food?.type === "dish") {
    const dishBase = Number(food.totalWeight) || Number(food.portionAmount) || getFoodPortionAmount(food) || 100;
    return parsedAmount / (dishBase > 0 ? dishBase : 100);
  }

  if (mode === "portion") {
    const portionText = String(food?.portion || "").toLowerCase();
    const isPieceBased = portionText.includes("шт") || String(food?.name || "").toLowerCase().includes("яйц");
    const portionBase = Number(food?.portionAmount) || getFoodPortionAmount(food) || (isPieceBased ? parsedAmount : 100);

    if (isPieceBased) {
      return parsedAmount / (portionBase > 0 ? portionBase : parsedAmount);
    }

    return parsedAmount / (portionBase > 0 ? portionBase : 100);
  }

  return parsedAmount / 100;
}

function getFoodPortionAmount(food) {
  const explicitAmount = Number(String(food?.portionAmount || "").replace(",", "."));
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) return explicitAmount;

  const portion = String(food?.portion || "").toLowerCase();
  const match = portion.match(/(\d+[,.]?\d*)\s*(г|гр|g|мл|ml)/i);

  if (match) {
    const parsed = Number(String(match[1]).replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const savedAmount = Number(String(food?.lastAmount || "").replace(",", "."));
  if (Number.isFinite(savedAmount) && savedAmount > 0) return savedAmount;

  return 100;
}

function getPieceProductSizeProfile(food = {}) {
  const name = String(food?.name || "").toLowerCase();
  const portionText = String(food?.portion || "").toLowerCase();

  const isEgg = name.includes("яйц");
  if (isEgg) {
    return {
      type: "egg",
      defaultId: "medium",
      sizes: [
        { id: "small", label: "Мал.", hint: "≈45 г", amount: 45, portion: "1 маленькое яйцо" },
        { id: "medium", label: "Сред.", hint: "≈55 г", amount: 55, portion: "1 среднее яйцо" },
        { id: "large", label: "Бол.", hint: "≈65 г", amount: 65, portion: "1 большое яйцо" }
      ]
    };
  }

  const pieceKeywords = [
    "банан", "яблок", "апельсин", "мандарин", "груш",
    "персик", "киви", "помидор", "томат", "огурец",
    "картоф", "авокад", "лимон", "лайм", "лук",
    "морков", "сырник", "драник", "котлет", "блин",
    "булоч", "круассан", "сосиск", "колбаск",
    "бургер", "наггетс", "крылыш", "печень", "конфет"
  ];

  const fruitProfiles = [
    { keys: ["банан"], sizes: [["small", "Мал.", "60–90 г", 75, "1 маленький банан"], ["medium", "Сред.", "90–130 г", 110, "1 средний банан"], ["large", "Бол.", "160–200 г", 180, "1 большой банан"]] },
    { keys: ["яблок"], sizes: [["small", "Мал.", "90–130 г", 110, "1 маленькое яблоко"], ["medium", "Сред.", "130–180 г", 155, "1 среднее яблоко"], ["large", "Бол.", "180–240 г", 210, "1 большое яблоко"]] },
    { keys: ["апельсин"], sizes: [["small", "Мал.", "100–140 г", 120, "1 маленький апельсин"], ["medium", "Сред.", "140–190 г", 165, "1 средний апельсин"], ["large", "Бол.", "190–260 г", 220, "1 большой апельсин"]] },
    { keys: ["мандарин"], sizes: [["small", "Мал.", "40–60 г", 50, "1 маленький мандарин"], ["medium", "Сред.", "60–90 г", 75, "1 средний мандарин"], ["large", "Бол.", "90–120 г", 105, "1 большой мандарин"]] },
    { keys: ["груш"], sizes: [["small", "Мал.", "100–140 г", 120, "1 маленькая груша"], ["medium", "Сред.", "140–190 г", 165, "1 средняя груша"], ["large", "Бол.", "190–260 г", 220, "1 большая груша"]] },
    { keys: ["персик"], sizes: [["small", "Мал.", "90–130 г", 110, "1 маленький персик"], ["medium", "Сред.", "130–180 г", 155, "1 средний персик"], ["large", "Бол.", "180–230 г", 205, "1 большой персик"]] },
    { keys: ["киви"], sizes: [["small", "Мал.", "50–70 г", 60, "1 маленький киви"], ["medium", "Сред.", "70–100 г", 85, "1 средний киви"], ["large", "Бол.", "100–130 г", 115, "1 большой киви"]] },
    { keys: ["помидор", "томат"], sizes: [["small", "Мал.", "60–90 г", 75, "1 маленький помидор"], ["medium", "Сред.", "90–130 г", 110, "1 средний помидор"], ["large", "Бол.", "130–180 г", 155, "1 большой помидор"]] },
    { keys: ["огурец"], sizes: [["small", "Мал.", "80–120 г", 100, "1 маленький огурец"], ["medium", "Сред.", "120–180 г", 150, "1 средний огурец"], ["large", "Бол.", "180–250 г", 215, "1 большой огурец"]] },
    { keys: ["картоф"], sizes: [["small", "Мал.", "60–90 г", 75, "1 маленькая картофелина"], ["medium", "Сред.", "90–150 г", 120, "1 средняя картофелина"], ["large", "Бол.", "150–220 г", 185, "1 большая картофелина"]] }
  ];

  const profile = fruitProfiles.find((item) => item.keys.some((key) => name.includes(key)));
  if (profile) {
    return {
      type: "piece",
      defaultId: "medium",
      sizes: profile.sizes.map(([id, label, hint, amount, portion]) => ({ id, label, hint, amount, portion }))
    };
  }

  if (portionText.includes("шт")) {
    const amount = getFoodPortionAmount(food) || 100;
    return {
      type: "piece",
      defaultId: "medium",
      sizes: [
        { id: "piece", label: "1 шт.", hint: `≈${Math.round(amount)} г`, amount, portion: "1 шт" }
      ]
    };
  }

  // AI-like heuristic for unknown CIS piece products
  const looksLikePieceProduct =
    pieceKeywords.some((keyword) => name.includes(keyword)) ||
    /(шт|шт\.|piece|pieces)/i.test(portionText);

  if (looksLikePieceProduct) {
    return {
      type: "piece",
      defaultId: "medium",
      sizes: [
        { id: "small", label: "Мал.", hint: "≈70 г", amount: 70, portion: "1 маленькая порция" },
        { id: "medium", label: "Сред.", hint: "≈120 г", amount: 120, portion: "1 средняя порция" },
        { id: "large", label: "Бол.", hint: "≈180 г", amount: 180, portion: "1 большая порция" }
      ]
    };
  }

  return null;
}

function getNutritionSmartUnits(food = {}) {
  const normalizedFood = normalizeNutritionFood(food);
  const portionText = String(normalizedFood.portion || "").toLowerCase();
  const portionAmount = getFoodPortionAmount(normalizedFood);
  const pieceProfile = getPieceProductSizeProfile(normalizedFood);

  const units = [
    {
      id: "grams",
      label: "Граммы",
      shortLabel: "Граммы",
      hint: "вручную",
      amount: 100,
      mode: "grams"
    }
  ];

  if (pieceProfile?.sizes?.length) {
    pieceProfile.sizes.forEach((size) => {
      units.push({
        id: `${pieceProfile.type}-${size.id}`,
        label: `${size.label} ${size.hint}`,
        shortLabel: `${size.label} ${size.hint}`,
        hint: size.hint,
        amount: size.amount,
        mode: "portion",
        portion: size.portion,
        portionAmount: size.amount,
        default: size.id === pieceProfile.defaultId
      });
    });
  } else if (normalizedFood.type === "dish") {
    const dishBase = Number(normalizedFood.totalWeight) || Number(normalizedFood.portionAmount) || portionAmount || 100;
    units.push({
      id: "dish-portion",
      label: `Порция ≈${Math.round(dishBase)} г`,
      shortLabel: `Порция ≈${Math.round(dishBase)} г`,
      hint: `≈${Math.round(dishBase)} г`,
      amount: dishBase,
      mode: "portion",
      portion: "1 порция блюда",
      portionAmount: dishBase,
      default: true
    });
  } else if (portionText && !portionText.includes("100 г")) {
    units.push({
      id: "portion",
      label: `${normalizedFood.portion || "Порция"} ≈${Math.round(portionAmount)} г`,
      shortLabel: `${normalizedFood.portion || "Порция"}`,
      hint: `≈${Math.round(portionAmount)} г`,
      amount: portionAmount,
      mode: "portion",
      portion: normalizedFood.portion || "1 порция",
      portionAmount,
      default: true
    });
  } else {
    units.push({
      id: "portion",
      label: `Порция ≈${Math.round(portionAmount || 100)} г`,
      shortLabel: `Порция`,
      hint: `≈${Math.round(portionAmount || 100)} г`,
      amount: portionAmount || 100,
      mode: "portion",
      portion: normalizedFood.portion || "1 порция",
      portionAmount: portionAmount || 100
    });
  }

  return units;
}

function getDefaultNutritionSmartUnit(food = {}) {
  const units = getNutritionSmartUnits(food);
  return units.find((unit) => unit.default) || units[0];
}

function getNutritionUnitStorageKey(food = {}) {
  return `nutrition_unit_${String(food?.name || "").trim().toLowerCase()}`;
}

function saveNutritionPreferredUnit(food = {}, unitId = "") {
  try {
    if (!food?.name || !unitId) return;
    localStorage.setItem(getNutritionUnitStorageKey(food), unitId);
  } catch (_) {
    // ignore storage errors
  }
}

function loadNutritionPreferredUnit(food = {}) {
  try {
    if (!food?.name) return "";
    return localStorage.getItem(getNutritionUnitStorageKey(food)) || "";
  } catch (_) {
    return "";
  }
}

function getNutritionSmartUnitId(food = {}, amount = 100, mode = "grams") {
  const units = getNutritionSmartUnits(food);
  const numericAmount = parseNutritionNumber(amount, 0);

  const matched = units.find((unit) => (
    unit.mode === mode &&
    Math.abs((Number(unit.amount) || 0) - numericAmount) < 0.01
  ));

  if (matched) return matched.id;
  return mode === "portion" ? "custom-portion" : "grams";
}

function detectNutritionAmountMode(food, amount, savedMode = "") {
  if (savedMode === "portion" || savedMode === "grams") return savedMode;

  const currentAmount = Number(String(amount).replace(",", "."));
  const portionAmount = getFoodPortionAmount(food);

  if (
    Number.isFinite(currentAmount) &&
    Number.isFinite(portionAmount) &&
    portionAmount > 0 &&
    Math.abs(currentAmount - portionAmount) < 0.001
  ) {
    const portionText = String(food?.portion || "").trim().toLowerCase();
    if (portionText && !portionText.startsWith("100 г")) return "portion";
  }

  return "grams";
}

function isPortionModeSelected(food, amount, mode = "") {
  return mode === "portion";
}

function roundMacro(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function parseNutritionNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getNutritionBaseMacroFood(food, amount = 100, mode = "grams") {
  const normalizedFood = normalizeNutritionFood(food);
  const safeAmount = parseNutritionNumber(amount, 100) || 100;
  const savedMode = mode || normalizedFood.amountMode || "grams";
  const savedScale = getFoodScale(safeAmount, normalizedFood, savedMode) || 1;
  const safeScale = savedScale > 0 ? savedScale : 1;

  return {
    ...normalizedFood,
    calories: roundMacro((Number(food?.calories) || 0) / safeScale),
    protein: roundMacro((Number(food?.protein) || 0) / safeScale),
    fat: roundMacro((Number(food?.fat) || 0) / safeScale),
    carbs: roundMacro((Number(food?.carbs) || 0) / safeScale),
    amountMode: savedMode,
    lastAmount: safeAmount,
    portionAmount: Number(food?.portionAmount) || normalizedFood.portionAmount || getFoodPortionAmount(normalizedFood),
    totalWeight: Number(food?.totalWeight) || normalizedFood.totalWeight || Number(food?.portionAmount) || 0,
    type: food?.type || normalizedFood.type || "",
    ingredients: Array.isArray(food?.ingredients) ? food.ingredients : normalizedFood.ingredients
  };
}

function getFoodIcon(foodOrName = "") {
  const raw = typeof foodOrName === "string"
    ? foodOrName
    : `${foodOrName?.name || ""} ${foodOrName?.brand || ""} ${foodOrName?.source || ""} ${foodOrName?.portion || ""}`;

  const name = raw.toLowerCase().trim();

  const iconRules = [
    { icon: "🍌", keywords: ["банан", "banana"] },
    { icon: "🍎", keywords: ["яблок", "apple", "груш", "pear", "персик", "peach", "мандар", "апельс", "orange", "киви", "виноград", "ананас", "melon", "дын", "арбуз"] },
    { icon: "🍓", keywords: ["клубник", "малина", "ежев", "berry", "черник", "голубик"] },
    { icon: "🥑", keywords: ["авокад"] },
    { icon: "🥦", keywords: ["брокк", "овощ", "салат", "огур", "томат", "помид", "капуст", "морков", "зелень", "шпинат"] },
    { icon: "🥔", keywords: ["карто", "potato", "пюре"] },
    { icon: "🌽", keywords: ["кукуруз"] },
    { icon: "🍗", keywords: ["кур", "chicken", "индей", "наггет", "крыл", "грудк"] },
    { icon: "🥩", keywords: ["стейк", "говяд", "говя", "beef", "свин", "мяс", "котлет", "шашл"] },
    { icon: "🐟", keywords: ["рыб", "лосос", "семг", "тунец", "форел", "селед", "икра"] },
    { icon: "🍤", keywords: ["кревет", "shrimp", "морепр", "кальмар", "мидии"] },
    { icon: "🥚", keywords: ["яйц", "egg", "омлет"] },
    { icon: "🧀", keywords: ["сыр", "cheese", "моцар", "пармез", "гауда"] },
    { icon: "🥛", keywords: ["молок", "milk", "кефир", "йогур", "творог", "сырок", "сметан"] },
    { icon: "🧈", keywords: ["масло", "butter"] },
    { icon: "🍚", keywords: ["рис", "rice", "греч", "булгур", "перлов", "круп"] },
    { icon: "🥣", keywords: ["овся", "каша", "мюсли", "хлоп"] },
    { icon: "🍝", keywords: ["макарон", "паста", "спагет", "лапша", "noodle"] },
    { icon: "🍞", keywords: ["хлеб", "батон", "тост", "лаваш", "булоч"] },
    { icon: "🥐", keywords: ["круас", "croissant"] },
    { icon: "🍕", keywords: ["пицц", "pizza"] },
    { icon: "🍔", keywords: ["бургер", "burger", "шаур", "донер", "хот дог", "fast"] },
    { icon: "🌮", keywords: ["тако", "taco", "буррито"] },
    { icon: "🍣", keywords: ["суш", "ролл", "sushi"] },
    { icon: "🍲", keywords: ["суп", "борщ", "щи", "рагу"] },
    { icon: "🥗", keywords: ["цезарь", "салат"] },
    { icon: "🍰", keywords: ["торт", "cake", "пирож", "десерт"] },
    { icon: "🍪", keywords: ["печень", "cookie"] },
    { icon: "🍫", keywords: ["шокол", "snickers", "twix", "bounty"] },
    { icon: "🍦", keywords: ["морож", "ice cream"] },
    { icon: "🥜", keywords: ["орех", "арахис", "миндаль", "фисташ"] },
    { icon: "☕", keywords: ["кофе", "coffee", "латте", "капуч", "эспрессо"] },
    { icon: "🍵", keywords: ["чай", "tea", "matcha"] },
    { icon: "🥤", keywords: ["cola", "кола", "лимонад", "напит", "сок", "juice"] },
    { icon: "💧", keywords: ["вода", "water"] },
    { icon: "🍺", keywords: ["пиво", "beer"] },
    { icon: "🍷", keywords: ["вино", "wine"] },
    { icon: "💪", keywords: ["протеин", "protein", "гейнер", "bcaa"] }
  ];

  let bestMatch = null;
  let bestScore = 0;

  iconRules.forEach((rule) => {
    let score = 0;

    rule.keywords.forEach((keyword) => {
      if (name.includes(keyword)) {
        score += keyword.length;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule.icon;
    }
  });

  return bestMatch || "🍽️";
}

function enrichNutritionFoodIcon(food) {
  const normalizedFood = normalizeNutritionFood(food);
  return {
    ...normalizedFood,
    icon: food?.icon || normalizedFood.icon || getFoodIcon(normalizedFood)
  };
}

function getFoodDisplayPortion(food) {
  const portion = String(food?.portion || "100 г").trim();
  const lower = portion.toLowerCase();

  if (lower.includes("250") && lower.includes("мл")) return "250 мл (1 порция)";
  if (lower.includes("1 порц")) return "1 порция";
  if (lower.includes("100") && lower.includes("мл")) return "100 мл";
  if (lower.includes("мл")) return "100 мл";
  if (lower.includes("шт")) return "1 шт";
  return "100 г";
}

function getFoodRskPercent(food, goals = {}) {
  const calories = Number(food?.calories) || 0;
  const goalCalories = Number(goals?.calories) || 2400;
  if (!goalCalories) return 0;
  return Math.max(1, Math.round((calories / goalCalories) * 100));
}

function getShortFoodName(name) {
  return String(name || "Продукт")
    .replace(/\s+—\s+.*$/u, "")
    .replace(/\s+-\s+.*$/u, "")
    .replace(/\s*\(на\s+основе.*?\)\s*/iu, "")
    .replace(/\s*\(безлактозный.*?\)\s*/iu, "")
    .replace(/\s*\(упаковка.*?\)\s*/iu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function makePersonalFoodKey(food) {
  const raw = String(food?.name || food?.id || "food")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .slice(0, 80);

  return `my_${raw || Date.now()}`;
}

function normalizeMyFoodRecord(food, amount = 100, previous = null) {
  const sourceFood = normalizeNutritionFood(food);
  const numericAmount = parseNutritionNumber(amount, 100) || 100;
  const key = previous?.id || sourceFood.foodId || sourceFood.id || makePersonalFoodKey(sourceFood);

  return {
    id: String(key).startsWith("my_") ? String(key) : makePersonalFoodKey(sourceFood),
    foodId: String(key).startsWith("my_") ? String(key) : makePersonalFoodKey(sourceFood),
    name: sourceFood.name,
    portion: sourceFood.portion || "100 г",
    calories: Number(sourceFood.calories) || 0,
    protein: Number(sourceFood.protein) || 0,
    fat: Number(sourceFood.fat) || 0,
    carbs: Number(sourceFood.carbs) || 0,
    barcode: sourceFood.barcode || "",
    source: "Моя база",
    icon: sourceFood.icon || getFoodIcon(sourceFood),
    lastAmount: numericAmount,
    portionAmount: Number(sourceFood.portionAmount) || Number(previous?.portionAmount) || numericAmount,
    amountMode: sourceFood.amountMode || previous?.amountMode || "grams",
    type: sourceFood.type || previous?.type || "",
    ingredients: Array.isArray(sourceFood.ingredients) ? sourceFood.ingredients : (previous?.ingredients || []),
    totalWeight: Number(sourceFood.totalWeight) || Number(sourceFood.portionAmount) || Number(previous?.totalWeight) || numericAmount,
    useCount: (Number(previous?.useCount) || 0) + 1,
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function getMyFoodsArray(nutritionState) {
  return Object.values(nutritionState?.myFoods || {})
    .map(normalizeNutritionFood)
    .sort((a, b) => {
      const aRaw = nutritionState?.myFoods?.[a.id] || {};
      const bRaw = nutritionState?.myFoods?.[b.id] || {};
      return (Number(bRaw.useCount) || 0) - (Number(aRaw.useCount) || 0);
    });
}

function searchMyFoods(nutritionState, query) {
  const cleanQuery = String(query || "").trim().toLowerCase();
  if (cleanQuery.length < 1) return [];

  return Object.values(nutritionState?.myFoods || {})
    .map(normalizeNutritionFood)
    .filter((food) => food.name.toLowerCase().includes(cleanQuery))
    .sort((a, b) => {
      const aRaw = nutritionState?.myFoods?.[a.id] || {};
      const bRaw = nutritionState?.myFoods?.[b.id] || {};
      return (Number(bRaw.useCount) || 0) - (Number(aRaw.useCount) || 0);
    });
}

function makeThreeSets(sets = [], defaultReps = 8) {
  const cleanSets = Array.isArray(sets) ? sets : [];

  const buildSet = (set) => ({
    ...set,
    reps: set?.reps || defaultReps,
    weight: set?.weight || "",
    enteredReps: set?.enteredReps || "",
    enteredWeight: set?.enteredWeight || ""
  });

  return [
    buildSet(cleanSets[0]),
    buildSet(cleanSets[1]),
    buildSet(cleanSets[2])
  ];
}

function normalizeExercise(exercise) {
  const defaultReps = exercise?.name?.includes("Пресс") ? 15 : 8;

  return {
    ...exercise,
    sets: makeThreeSets(exercise?.sets, defaultReps)
  };
}

function normalizePlan(plan) {
  return {
    workouts: (plan.workouts || []).map((workout) => ({
      ...workout,
      exercises: (workout.exercises || []).map(normalizeExercise)
    }))
  };
}

const starterPlan = {
  workouts: [
    {
      id: "day1",
      name: "День 1 — спина/плечи",
      exercises: [
        {
          id: "d1e1",
          name: "Жим ногами",
          video: "/videos/1. Жим ногами.MOV",
          sets: [{ reps: 8, weight: "120" }]
        },
        {
          id: "d1e2",
          name: "Тяга в наклоне",
          video: "",
          sets: [{ reps: 8, weight: "70" }]
        },
        {
          id: "d1e3",
          name: "Тяга Т-грифа",
          video: "",
          sets: [{ reps: 8, weight: "30" }]
        },
        {
          id: "d1e4",
          name: "Вертикальный жим с гантелями",
          video: "",
          sets: [{ reps: 8, weight: "18" }]
        },
        {
          id: "d1e5",
          name: "Отведение рук с гантелями",
          video: "/videos/Отведение рук в сторону с гантелями.MP4",
          sets: [{ reps: 8, weight: "8" }]
        },
        {
          id: "d1e6",
          name: "Разгибание рук в кроссовере",
          video: "/videos/Разгибание рук в кроссовере.MOV",
          sets: [{ reps: 8, weight: "22.5" }]
        },
        {
          id: "d1e7",
          name: "Пресс",
          video: "/videos/Пресс (скручивания обычные).MOV",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    },
    {
      id: "day2",
      name: "День 2 — грудь/плечи/руки",
      exercises: [
        {
          id: "d2e1",
          name: "Выпады с гантелями",
          video: "",
          sets: [{ reps: 8, weight: "12" }]
        },
        {
          id: "d2e2",
          name: "Жим лёжа со штангой",
          video: "",
          sets: [{ reps: 8, weight: "60" }]
        },
        {
          id: "d2e3",
          name: "Жим в Смите (наклон)",
          video: "",
          sets: [{ reps: 8, weight: "10" }]
        },
        {
          id: "d2e4",
          name: "Отведение рук с гантелями (с опорой)",
          video: "",
          sets: [{ reps: 8, weight: "10" }]
        },
        {
          id: "d2e5",
          name: "Отведение рук сидя в наклоне",
          video: "",
          sets: [{ reps: 8, weight: "4" }]
        },
        {
          id: "d2e6",
          name: "Сгибание рук в кроссовере",
          video: "/videos/Сгибание рук с гантелями.MOV",
          sets: [{ reps: 8, weight: "20" }]
        },
        {
          id: "d2e7",
          name: "Пресс",
          video: "",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    },
    {
      id: "day3",
      name: "День 3 — грудь + руки",
      exercises: [
        {
          id: "d3e1",
          name: "Разгибание ног",
          video: "",
          sets: [{ reps: 8, weight: "45" }]
        },
        {
          id: "d3e2",
          name: "Жим гантелей лёжа",
          video: "/videos/Жим лежа с гантелями.mp4",
          sets: [{ reps: 8, weight: "24" }]
        },
        {
          id: "d3e3",
          name: "Сведение гантелей (наклон)",
          video: "",
          sets: [{ reps: 8, weight: "14" }]
        },
        {
          id: "d3e4",
          name: "Задняя дельта в кроссовере",
          video: "",
          sets: [{ reps: 8, weight: "5" }]
        },
        {
          id: "d3e5",
          name: "Разгибание рук (Скотт)",
          video: "",
          sets: [{ reps: 8, weight: "16" }]
        },
        {
          id: "d3e6",
          name: "Сгибание рук (Скотт)",
          video: "",
          sets: makeThreeSets([], 8)
        },
        {
          id: "d3e7",
          name: "Пресс",
          video: "",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    },
    {
      id: "day4",
      name: "День 4 — спина + плечи",
      exercises: [
        {
          id: "d4e1",
          name: "Румынская тяга",
          video: "",
          sets: [{ reps: 8, weight: "80" }]
        },
        {
          id: "d4e2",
          name: "Тяга гантели к поясу",
          video: "",
          sets: [{ reps: 8, weight: "24" }]
        },
        {
          id: "d4e3",
          name: "Тяга верхнего блока (хаммер)",
          video: "/videos/Тяга верхнего блока.MOV",
          sets: [{ reps: 8, weight: "75" }]
        },
        {
          id: "d4e4",
          name: "Вертикальный жим в тренажёре",
          video: "",
          sets: [{ reps: 8, weight: "45" }]
        },
        {
          id: "d4e5",
          name: "Отведение рук в сторону",
          video: "",
          sets: [{ reps: 8, weight: "4" }]
        },
        {
          id: "d4e6",
          name: "Разгибание рук в тренажёре",
          video: "",
          sets: makeThreeSets([], 8)
        },
        {
          id: "d4e7",
          name: "Пресс",
          video: "",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    }
  ]
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdminClaim, setIsAdminClaim] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("client");
  const [appLoading, setAppLoading] = useState(true);
  const [appTheme, setAppTheme] = useState(() => {
    try {
      return localStorage.getItem(APP_THEME_STORAGE_KEY) || "dark-green";
    } catch {
      return "dark-green";
    }
  });

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [profileActiveTab, setProfileActiveTab] = useState("cabinet");

  function canUseAdminFeatures() {
    return Boolean(isAdminClaim);
  }

  function canUseTrainerFeatures() {
    return Boolean(isAdminClaim || currentUserRole === "trainer");
  }

  useEffect(() => {
    const handleOffline = () => {
      showAppError("offline");
    };

    const handleOnline = () => {
      showAppError("savedLocal", "Соединение восстановлено.");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const [plan, setPlan] = useState(() => ({ workouts: [] }));
  const [workoutModePreference, setWorkoutModePreference] = useState(() => getDefaultWorkoutModePreference());
  const [workoutModeRemember, setWorkoutModeRemember] = useState(false);
  const [basicWorkoutQuiz, setBasicWorkoutQuiz] = useState({
    goal: "muscle",
    level: "beginner",
    days: "4"
  });

  const [page, setPage] = useState("main");
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [individualWorkoutIndex, setIndividualWorkoutIndex] = useState(0);
  const [individualWorkoutIndexInitialized, setIndividualWorkoutIndexInitialized] = useState(false);
  const [openVideoId, setOpenVideoId] = useState(null);
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutStartedAt, setWorkoutStartedAt] = useState(null);
  const [workoutFinishedAt, setWorkoutFinishedAt] = useState(null);
  const [workoutReadinessOpen, setWorkoutReadinessOpen] = useState(false);
  const [workoutReadiness, setWorkoutReadiness] = useState(null);
  const [postWorkoutFeedbackOpen, setPostWorkoutFeedbackOpen] = useState(false);
  const [postWorkoutFeedback, setPostWorkoutFeedback] = useState(null);
  const [timerTick, setTimerTick] = useState(Date.now());
  const touchStartY = useRef(null);
  const deckRef = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState("");

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [adminAllUsersList, setAdminAllUsersList] = useState([]);
  const [adminNewUserName, setAdminNewUserName] = useState("");
  const [adminNewUserEmail, setAdminNewUserEmail] = useState("");
  const [adminNewUserPassword, setAdminNewUserPassword] = useState("");
  const [adminCreateUserLoading, setAdminCreateUserLoading] = useState(false);
  const [adminCreateUserStatus, setAdminCreateUserStatus] = useState("");
  const [adminCreatedCredentials, setAdminCreatedCredentials] = useState(null);
  const [adminSelectedClient, setAdminSelectedClient] = useState(null);
  const [adminClientPageOpen, setAdminClientPageOpen] = useState(false);
  const [adminClientHistory, setAdminClientHistory] = useState([]);
  const [adminClientNutrition, setAdminClientNutrition] = useState(null);
  const [adminClientMeasurements, setAdminClientMeasurements] = useState([]);
  const [adminClientLoading, setAdminClientLoading] = useState(false);
  const [adminClientStatus, setAdminClientStatus] = useState("");
  const [adminClientFilter, setAdminClientFilter] = useState("all");
  const [adminClientTab, setAdminClientTab] = useState("overview");
  const [adminTrainerNote, setAdminTrainerNote] = useState("");
  const [adminTrainingTemplates, setAdminTrainingTemplates] = useState([]);
  const [adminTemplateName, setAdminTemplateName] = useState("");
  const [adminSelectedTemplateId, setAdminSelectedTemplateId] = useState("");
  const [adminSelectedNutritionPreset, setAdminSelectedNutritionPreset] = useState("balanced");
  const [adminCopyTargetUserId, setAdminCopyTargetUserId] = useState("");
  const [adminTransferFromUid, setAdminTransferFromUid] = useState("");
  const [adminTransferToUid, setAdminTransferToUid] = useState("");
  const [adminTransferStatus, setAdminTransferStatus] = useState("");
  const [adminTransferLoading, setAdminTransferLoading] = useState(false);
  const [adminUsersSearch, setAdminUsersSearch] = useState("");
  const [adminUsersFilter, setAdminUsersFilter] = useState("all");
  const [adminUsersSelectedTab, setAdminUsersSelectedTab] = useState("overview");
  const [adminTelegramMessage, setAdminTelegramMessage] = useState("");
  const [adminTelegramSending, setAdminTelegramSending] = useState(false);
  const [adminCalendarDraft, setAdminCalendarDraft] = useState({
    enabled: true,
    reminderEnabled: true,
    reminderTime: "19:00",
    workoutTime: "13:00",
    hourReminderEnabled: false,
    trainingDays: [],
    daySettings: {}
  });
  const [adminCalendarSaving, setAdminCalendarSaving] = useState(false);
  const [adminCalendarTesting, setAdminCalendarTesting] = useState(false);
  const [adminDeletingWorkoutId, setAdminDeletingWorkoutId] = useState("");
  const [adminSelectedHistoryIds, setAdminSelectedHistoryIds] = useState([]);

  const [adminCreateClientModalOpen, setAdminCreateClientModalOpen] = useState(false);
  const [adminActiveWorkoutId, setAdminActiveWorkoutId] = useState("");
  const [adminSelectedExerciseId, setAdminSelectedExerciseId] = useState("");
  const [adminVideoPreview, setAdminVideoPreview] = useState(null);
  const [adminOpenWorkoutId, setAdminOpenWorkoutId] = useState("");
  const [adminProgramEditorMode, setAdminProgramEditorMode] = useState("create");
  const [adminProgramLibraryTab, setAdminProgramLibraryTab] = useState("editor");
  const [adminInspectorTab, setAdminInspectorTab] = useState("main");
  const [adminProgramGroups, setAdminProgramGroups] = useState([]);
  const [adminActiveProgramId, setAdminActiveProgramId] = useState("");
  const [adminActiveDayId, setAdminActiveDayId] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isWorkoutSaved, setIsWorkoutSaved] = useState(false);
  const [showWorkoutSavedCard, setShowWorkoutSavedCard] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeletingId, setHistoryDeletingId] = useState("");
  const [historySwipeId, setHistorySwipeId] = useState("");
  const [historyTouchStartX, setHistoryTouchStartX] = useState(null);
  const [historyDeleteCandidate, setHistoryDeleteCandidate] = useState(null);
  const [openHistoryKey, setOpenHistoryKey] = useState(null);
  const [selectedAiFeatureId, setSelectedAiFeatureId] = useState("nutritionPlan");
  const [showFirstSetupOnboarding, setShowFirstSetupOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [firstSetupCompletedInSession, setFirstSetupCompletedInSession] = useState(false);

  const [aiNutritionProfileDraft, setAiNutritionProfileDraft] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AI_NUTRITION_PROFILE_STORAGE_KEY) || "null");
      return { weight: "", height: "", age: "", sex: "male", activity: "medium", goal: "recomp", trainingDays: [], ...(saved || {}) };
    } catch (_) {
      return { weight: "", height: "", age: "", sex: "male", activity: "medium", goal: "recomp", trainingDays: [] };
    }
  });
  const [aiNutritionProfile, setAiNutritionProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AI_NUTRITION_PROFILE_STORAGE_KEY) || "null");
    } catch (_) {
      return null;
    }
  });
  const [aiNutritionSavedPlan, setAiNutritionSavedPlan] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AI_NUTRITION_PLAN_STORAGE_KEY) || "null");
    } catch (_) {
      return null;
    }
  });
  const [aiNutritionAdaptedToday, setAiNutritionAdaptedToday] = useState(false);
  const [isAiNutritionPlanExpanded, setIsAiNutritionPlanExpanded] = useState(false);
  const [profileBodyMetricsOpen, setProfileBodyMetricsOpen] = useState(false);
  const [profileNutritionGoalOpen, setProfileNutritionGoalOpen] = useState(false);
  const [profileProgressAnalysisOpen, setProfileProgressAnalysisOpen] = useState(false);
const [profileWorkoutModeOpen, setProfileWorkoutModeOpen] = useState(false);
  const [profileMeasurementOpen, setProfileMeasurementOpen] = useState(false);
  const [profileMeasurementSaving, setProfileMeasurementSaving] = useState(false);
  const [profileMeasurementStatus, setProfileMeasurementStatus] = useState("");
  const [profileMeasurements, setProfileMeasurements] = useState([]);
  const [profileMeasurementWizardStep, setProfileMeasurementWizardStep] = useState(0);
  const [profileMeasurementDraft, setProfileMeasurementDraft] = useState({
    weight: "",
    neck: "",
    shoulders: "",
    chest: "",
    biceps: "",
    forearm: "",
    wrist: "",
    belly: "",
    pelvis: "",
    thigh: "",
    calf: "",
    ankle: "",
    note: ""
  });

  const [telegramProfile, setTelegramProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("workout_telegram_profile_v1") || "null") || {
        connected: false,
        username: "",
        displayName: "",
        avatarUrl: "",
        chatId: "",
        notificationsEnabled: true
      };
    } catch (_) {
      return {
        connected: false,
        username: "",
        displayName: "",
        avatarUrl: "",
        chatId: "",
        notificationsEnabled: true
      };
    }
  });
  const [telegramDraft, setTelegramDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("workout_telegram_profile_v1") || "null") || {
        username: "",
        displayName: "",
        notificationsEnabled: true
      };
    } catch (_) {
      return {
        username: "",
        displayName: "",
        notificationsEnabled: true
      };
    }
  });
  const [telegramConnectOpen, setTelegramConnectOpen] = useState(false);
  const [telegramLinkCode, setTelegramLinkCode] = useState("");
  const [telegramLinking, setTelegramLinking] = useState(false);
  const telegramLoginContainerRef = useRef(null);
  const [telegramLoginWidgetReady, setTelegramLoginWidgetReady] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState("");

  const [nutrition, setNutrition] = useState(() => {
    try {
      const saved = localStorage.getItem(NUTRITION_STORAGE_KEY);
      if (!saved) return defaultNutritionState;

      const parsed = JSON.parse(saved);
      return {
        ...defaultNutritionState,
        ...parsed,
        goals: { ...defaultNutritionState.goals, ...(parsed.goals || {}) },
        days: parsed.days || {},
        favorites: parsed.favorites || defaultNutritionState.favorites,
        recent: parsed.recent || [],
        myFoods: parsed.myFoods || {}
      };
    } catch {
      return defaultNutritionState;
    }
  });
  const [nutritionSearch, setNutritionSearch] = useState("");
  const [nutritionMeal, setNutritionMeal] = useState("breakfast");
  const [nutritionMealMenuOpen, setNutritionMealMenuOpen] = useState(false);
  const [nutritionProductUnitMenuOpen, setNutritionProductUnitMenuOpen] = useState(false);
  const [nutritionAmount, setNutritionAmount] = useState("100");
  const [nutritionAmountMode, setNutritionAmountMode] = useState("grams");
  const [nutritionEditNote, setNutritionEditNote] = useState("");
  const [nutritionEditDetailsOpen, setNutritionEditDetailsOpen] = useState(false);
  const [nutritionEditPageOpen, setNutritionEditPageOpen] = useState(false);
  const [nutritionEditOriginalFood, setNutritionEditOriginalFood] = useState(null);
  const [nutritionEditOriginalNote, setNutritionEditOriginalNote] = useState("");
  const [nutritionCreateChoiceOpen, setNutritionCreateChoiceOpen] = useState(false);
  const [selectedNutritionFood, setSelectedNutritionFood] = useState(null);
  const [dishIngredientPickerOpen, setDishIngredientPickerOpen] = useState(false);
  const [dishIngredientSearch, setDishIngredientSearch] = useState("");
  const [pendingDishIngredient, setPendingDishIngredient] = useState(null);
  const [pendingDishIngredientGrams, setPendingDishIngredientGrams] = useState("100");
  const [dishIngredientExternalFoods, setDishIngredientExternalFoods] = useState([]);
  const [dishIngredientLoading, setDishIngredientLoading] = useState(false);
  const [dishIngredientFallbackSuggestions, setDishIngredientFallbackSuggestions] = useState([]);
  const [editingNutritionItemId, setEditingNutritionItemId] = useState(null);
  const nutritionFoodSwipeStartX = useRef({});
  const nutritionFoodSwipeMoved = useRef({});
  const [nutritionFoodSwipeOffsets, setNutritionFoodSwipeOffsets] = useState({});
  const [deletingNutritionFoodId, setDeletingNutritionFoodId] = useState(null);
  const [nutritionBarcode, setNutritionBarcode] = useState("");
  const [nutritionPhotoName, setNutritionPhotoName] = useState("");
  const [nutritionPhotoPreview, setNutritionPhotoPreview] = useState("");
  const [nutritionPhotoAnalyzing, setNutritionPhotoAnalyzing] = useState(false);
  const [nutritionPhotoAiResult, setNutritionPhotoAiResult] = useState("");
  const [nutritionPhotoAiCandidates, setNutritionPhotoAiCandidates] = useState([]);
  const [nutritionPhotoAiConfidence, setNutritionPhotoAiConfidence] = useState("");
  const [nutritionAnalysisOpen, setNutritionAnalysisOpen] = useState(true);
  const [nutritionPickerOpen, setNutritionPickerOpen] = useState(false);
  const [nutritionSearchTab, setNutritionSearchTab] = useState("food");
  const [selectedNutritionDateKey, setSelectedNutritionDateKey] = useState(todayNutritionKey());
  const [nutritionCalendarOpen, setNutritionCalendarOpen] = useState(false);
  const [nutritionCalendarMonthKey, setNutritionCalendarMonthKey] = useState(() => todayNutritionKey().slice(0, 7));
  const [expandedNutritionMeals, setExpandedNutritionMeals] = useState({});
  const [fatSecretFoods, setFatSecretFoods] = useState([]);
  const [fatSecretLoading, setFatSecretLoading] = useState(false);
  const [fatSecretError, setFatSecretError] = useState("");
  const [nutritionFallbackSuggestions, setNutritionFallbackSuggestions] = useState([]);
  const [recentNutritionFoods, setRecentNutritionFoods] = useState(() => loadRecentNutritionFoods());
  const [showRecentNutritionFoods, setShowRecentNutritionFoods] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [barcodeScannerError, setBarcodeScannerError] = useState("");
  const [nutritionCloudReady, setNutritionCloudReady] = useState(false);
  const barcodeVideoRef = useRef(null);
  const nutritionPhotoInputRef = useRef(null);
  const nutritionPhotoLastFileRef = useRef(null);
  const performanceMarksRef = useRef({});

  function perfNow() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function startPerformanceCheck(label, meta = {}) {
    performanceMarksRef.current[label] = perfNow();
    console.log(`⏱️ PERF START · ${label}`, meta);
  }

  function endPerformanceCheck(label, meta = {}) {
    const startedAt = performanceMarksRef.current[label];

    if (!startedAt) return 0;

    const ms = Math.round(perfNow() - startedAt);
    delete performanceMarksRef.current[label];

    const payload = {
      label,
      ms,
      seconds: Math.round((ms / 1000) * 10) / 10,
      at: new Date().toISOString(),
      ...meta
    };

    console.log(`⏱️ PERF · ${label}: ${ms} ms`, payload);

    try {
      const key = "workout_app_perf_logs_v1";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([payload, ...current].slice(0, 50)));
    } catch (_) {
      // ignore localStorage errors
    }

    return ms;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      const startedAt = Date.now();
      startPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });

      setUser(u);
      setIsLoggedIn(!!u);
      if (u?.uid) {
        const savedWorkoutModePreference = safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, u.uid, getDefaultWorkoutModePreference());
        setWorkoutModePreference(savedWorkoutModePreference || getDefaultWorkoutModePreference());
        setWorkoutModeRemember(Boolean(savedWorkoutModePreference?.remember));
      } else {
        setWorkoutModePreference(getDefaultWorkoutModePreference());
        setWorkoutModeRemember(false);
      }

      if (u) {
        let nextIsAdmin = false;

        try {
          const token = await getIdTokenResult(u, true);
          nextIsAdmin = Boolean(token.claims?.admin);
          setIsAdminClaim(nextIsAdmin);
        } catch (error) {
          console.error("Admin claim check error", error);
          setIsAdminClaim(false);
        }

        try {
          const roleDoc = await getDoc(doc(db, "users", u.uid));
          const roleData = roleDoc.exists() ? roleDoc.data() : {};
          setCurrentUserRole(nextIsAdmin ? "admin" : (roleData.role || "client"));
        } catch (error) {
          console.error("User role check error", error);
          setCurrentUserRole(nextIsAdmin ? "admin" : "client");
        }

        await loadWorkoutsFromFirebase(u.uid);
        await loadHistory();
        await replayFailedHistorySaves(u.uid);
        await loadNutritionFromFirebase(u.uid);
        await loadProfileMeasurements(u.uid);

        try {
          const profileDoc = await getDoc(doc(db, "users", u.uid));
          const savedTelegram = profileDoc.exists() ? profileDoc.data()?.telegram : null;
          if (savedTelegram) {
            const nextTelegram = {
              ...savedTelegram,
              connected: savedTelegram.connected !== false,
              username: savedTelegram.username || profileDoc.data()?.telegramUsername || "",
              displayName: savedTelegram.displayName || profileDoc.data()?.telegramDisplayName || savedTelegram.username || "",
              avatarUrl: savedTelegram.avatarUrl || profileDoc.data()?.telegramAvatarUrl || ""
            };
            setTelegramProfile(nextTelegram);
            setTelegramDraft(nextTelegram);
            localStorage.setItem("workout_telegram_profile_v1", JSON.stringify(nextTelegram));
          }
        } catch (_) {
          // ignore Telegram profile loading errors
        }
      } else {
        setCurrentUserRole("client");
        setNutritionCloudReady(false);
        setProfileMeasurements([]);
        setPlan({ workouts: [] });
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ workouts: [] }));
        } catch (_) {
          // ignore localStorage errors
        }
      }

      endPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });

      const elapsed = Date.now() - startedAt;
      const minimumSplashTime = 900;

      setTimeout(() => {
        setAppLoading(false);
      }, Math.max(0, minimumSplashTime - elapsed));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const safeTheme = appTheme === "warm-light" ? "warm-light" : "dark-green";
    document.documentElement.dataset.appTheme = safeTheme;
    document.body.dataset.appTheme = safeTheme;

    try {
      localStorage.setItem(APP_THEME_STORAGE_KEY, safeTheme);
    } catch (_) {
      // ignore localStorage errors
    }
  }, [appTheme]);

  useEffect(() => {
    if (!user?.uid) return;

    safeWriteUserJsonStorage(STORAGE_KEY, user.uid, plan);
    addUserLocalBackup(WORKOUT_PLAN_BACKUP_STORAGE_KEY, user.uid, { plan }, 10);
  }, [plan, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    safeWriteUserJsonStorage(NUTRITION_STORAGE_KEY, user.uid, nutrition);
    addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, user.uid, { nutrition }, 12);
  }, [nutrition, user?.uid]);

  useEffect(() => {
    const currentUser = auth.currentUser || user;

    if (!currentUser?.uid || !selectedWorkoutId || !workoutStarted) return;

    const draft = {
      uid: currentUser.uid,
      workoutId: selectedWorkoutId,
      selectedWorkoutId,
      currentExerciseIndex,
      workoutStartedAt,
      workoutFinishedAt,
      plan,
      savedAt: new Date().toISOString()
    };

    safeWriteJsonStorage(getWorkoutDraftKey(currentUser.uid, selectedWorkoutId), draft);
  }, [user?.uid, selectedWorkoutId, currentExerciseIndex, workoutStarted, workoutStartedAt, workoutFinishedAt, plan]);

  useEffect(() => {
    if (!isLoggedIn || appLoading || !user?.uid || firstSetupCompletedInSession) return;

    let completedForThisUser = false;

    try {
      completedForThisUser =
        localStorage.getItem(FIRST_SETUP_DONE_USER_STORAGE_KEY) === `${user.uid}:${FIRST_SETUP_REQUIRED_VERSION}` ||
        localStorage.getItem(`${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${user.uid}`) === FIRST_SETUP_REQUIRED_VERSION;
    } catch (_) {
      completedForThisUser = false;
    }

    const profileHasRequiredFields =
      hasRequiredAiNutritionProfileFields(aiNutritionProfile) ||
      hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft);

    if (profileHasRequiredFields) {
      try {
        localStorage.setItem(FIRST_SETUP_DONE_USER_STORAGE_KEY, `${user.uid}:${FIRST_SETUP_REQUIRED_VERSION}`);
        localStorage.setItem(`${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${user.uid}`, FIRST_SETUP_REQUIRED_VERSION);
      } catch (_) {
        // ignore localStorage errors
      }

      setShowFirstSetupOnboarding(false);
      return;
    }

    if (!completedForThisUser) {
      setShowFirstSetupOnboarding(true);
      setTimeout(() => setShowFirstSetupOnboarding(true), 120);
      setTimeout(() => setShowFirstSetupOnboarding(true), 600);
    }
  }, [
    isLoggedIn,
    appLoading,
    user?.uid,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    firstSetupCompletedInSession
  ]);

  useEffect(() => {
    if (!isLoggedIn || appLoading) return;

    const shouldTrapAndroidBack =
      page !== "main" ||
      Boolean(selectedWorkoutId) ||
      Boolean(fullscreenVideo) ||
      nutritionPickerOpen ||
      nutritionEditPageOpen ||
      dishIngredientPickerOpen ||
      nutritionCreateChoiceOpen ||
      barcodeScannerOpen;

    if (!shouldTrapAndroidBack) return;

    if (!window.history.state?.workoutAppBackTrap) {
      window.history.pushState({ workoutAppBackTrap: true }, "");
    }

    const onAndroidBack = () => {
      const handled = handleAppBackNavigation();

      if (handled) {
        setTimeout(() => {
          if (!window.history.state?.workoutAppBackTrap) {
            window.history.pushState({ workoutAppBackTrap: true }, "");
          }
        }, 0);
      }
    };

    window.addEventListener("popstate", onAndroidBack);

    return () => {
      window.removeEventListener("popstate", onAndroidBack);
    };
  }, [
    isLoggedIn,
    appLoading,
    page,
    selectedWorkoutId,
    fullscreenVideo,
    nutritionPickerOpen,
    nutritionEditPageOpen,
    dishIngredientPickerOpen,
    nutritionCreateChoiceOpen,
    barcodeScannerOpen
  ]);

  useEffect(() => {
    const query = nutritionSearch.trim();

    if (!nutritionPickerOpen || nutritionSearchTab !== "food" || query.length < 2) {
      setFatSecretFoods([]);
      setFatSecretLoading(false);
      setFatSecretError("");
      setNutritionFallbackSuggestions([]);
      return undefined;
    }

    startPerformanceCheck("Local catalog search", { query });
    const localResults = searchLocalNutritionFoods(query);
    setFatSecretFoods(localResults);
    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    endPerformanceCheck("Local catalog search", { query, results: localResults.length });

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        if (localResults.length >= 8) {
          setFatSecretLoading(false);
          return;
        }

        setFatSecretLoading(true);
        startPerformanceCheck("Food search · nutrition API", { query, localResults: localResults.length });

        const response = await fetchWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        }, 12000);

        if (!response.ok) {
          throw new Error(`Nutrition search API error: ${response.status}`);
        }

        const data = await response.json();
        const remoteFoods = Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [];

        setFatSecretFoods((current) => mergeNutritionFoodResults(current, remoteFoods));
        setNutritionFallbackSuggestions(Array.isArray(data.fallbackSuggestions) ? data.fallbackSuggestions : []);
        endPerformanceCheck("Food search · nutrition API", { query, results: remoteFoods.length });
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);

          if (!localResults.length) {
            setNutritionFallbackSuggestions(["Фото продукта", "Попробуй штрихкод", "Создать продукт"]);
            setFatSecretError("Локально не найдено. ИИ-поиск временно недоступен.");
            showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "api", "Поиск еды сейчас недоступен.");
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setFatSecretLoading(false);
        }
      }
    }, localResults.length ? 900 : 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [nutritionPickerOpen, nutritionSearchTab, nutritionSearch, nutrition.myFoods]);

  useEffect(() => {
    const query = dishIngredientSearch.trim();

    if (!dishIngredientPickerOpen || query.length < 2) {
      setDishIngredientExternalFoods([]);
      setDishIngredientFallbackSuggestions([]);
      setDishIngredientLoading(false);
      return undefined;
    }

    startPerformanceCheck("Local dish ingredient search", { query });
    const localResults = searchLocalNutritionFoods(query, 20);
    setDishIngredientExternalFoods(localResults);
    setDishIngredientFallbackSuggestions([]);
    endPerformanceCheck("Local dish ingredient search", { query, results: localResults.length });

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        if (localResults.length >= 8) {
          setDishIngredientLoading(false);
          return;
        }

        setDishIngredientLoading(true);
        startPerformanceCheck("Food search · dish ingredient API", { query, localResults: localResults.length });

        const response = await fetchWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        }, 12000);

        if (!response.ok) {
          throw new Error(`Dish ingredient search API error: ${response.status}`);
        }

        const data = await response.json();
        const remoteFoods = Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [];
        setDishIngredientExternalFoods((current) => mergeNutritionFoodResults(current, remoteFoods));
        setDishIngredientFallbackSuggestions(Array.isArray(data.fallbackSuggestions) ? data.fallbackSuggestions : []);
        endPerformanceCheck("Food search · dish ingredient API", { query, results: remoteFoods.length });
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);
          if (!localResults.length) {
            setDishIngredientFallbackSuggestions([]);
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setDishIngredientLoading(false);
        }
      }
    }, localResults.length ? 900 : 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dishIngredientPickerOpen, dishIngredientSearch]);

  useEffect(() => {
    if (!barcodeScannerOpen) return undefined;

    let stream;
    let stopped = false;
    let frameId;

    async function startScanner() {
      try {
        setBarcodeScannerError("");

        if (!("BarcodeDetector" in window)) {
          setBarcodeScannerError("Сканер штрихкодов не поддерживается этим браузером. Введи код вручную.");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });

        if (barcodeVideoRef.current) {
          barcodeVideoRef.current.srcObject = stream;
          await barcodeVideoRef.current.play();
        }

        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });

        const scan = async () => {
          if (stopped || !barcodeVideoRef.current) return;

          try {
            const codes = await detector.detect(barcodeVideoRef.current);
            if (codes.length > 0) {
              const value = codes[0].rawValue || "";
              setNutritionBarcode(value);
              setBarcodeScannerOpen(false);

              const food = nutritionFoodDatabase.find((item) => item.barcode === value);
              if (food) addNutritionFoodFromPicker(food);
              return;
            }
          } catch (error) {
            console.error(error);
          }

          frameId = requestAnimationFrame(scan);
        };

        scan();
      } catch (error) {
        console.error(error);
        setBarcodeScannerError("Не удалось открыть камеру. Проверь разрешение камеры или введи штрихкод вручную.");
      }
    }

    startScanner();

    return () => {
      stopped = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [barcodeScannerOpen]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !nutritionCloudReady) return undefined;

    const timer = setTimeout(() => {
      const { myFoods, ...userNutritionState } = nutrition;
      const backupId = `nutrition_${Date.now()}`;

      addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUser.uid, {
        id: backupId,
        nutrition,
        reason: "before_cloud_save"
      });

      setDoc(doc(db, "users", currentUser.uid, "nutrition", "state"), {
        ...userNutritionState,
        updatedAt: new Date().toISOString()
      }, { merge: true })
        .then(() => removeUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUser.uid, backupId))
        .catch((error) => {
          console.error("Nutrition save error", error);
          showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase");
          addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUser.uid, {
            nutrition,
            reason: "cloud_save_failed",
            error: error.message || String(error)
          });
        });
    }, 650);

    return () => clearTimeout(timer);
  }, [nutrition, nutritionCloudReady]);

  useEffect(() => {
    if (["admin", "adminUsers", "adminWorkouts"].includes(page) && canUseTrainerFeatures()) {
      loadUsers();
      loadAdminTrainingTemplates();
    }
  }, [page, isAdminClaim, currentUserRole, user?.uid, user?.email]);

  useEffect(() => {
    if (!workoutStartedAt || workoutFinishedAt) return undefined;

    const timer = setInterval(() => {
      setTimerTick(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [workoutStartedAt, workoutFinishedAt, timerTick]);

  const workout = useMemo(() => {
    return plan.workouts.find((w) => w.id === selectedWorkoutId);
  }, [selectedWorkoutId, plan]);

  const workoutDurationText = useMemo(() => {
    if (!workoutStartedAt) return "—";

    const endTime = workoutFinishedAt || timerTick;
    const totalSeconds = Math.max(0, Math.floor((endTime - workoutStartedAt) / 1000));

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} ч ${minutes} мин`;
    }

    if (minutes > 0) {
      return `${minutes} мин ${seconds} сек`;
    }

    return `${seconds} сек`;
  }, [workoutStartedAt, workoutFinishedAt]);

  const workoutMenuItems = [
    {
      day: "День 1",
      title: "Спина + плечи",
      image: "data:image/png;base64,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"
    },
    {
      day: "День 2",
      title: "Грудь + плечи + руки",
      image: "data:image/png;base64,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"
    },
    {
      day: "День 3",
      title: "Спина + плечи",
      image: "data:image/png;base64,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"
    },
    {
      day: "День 4",
      title: "Грудь + руки",
      image: "data:image/png;base64,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"
    }
  ];

  useEffect(() => {
    if (!workout) return;

    if (currentExerciseIndex > workout.exercises.length + 1) {
      setCurrentExerciseIndex(0);
    }
  }, [workout, currentExerciseIndex]);

  const lastExerciseResults = useMemo(() => {
    const result = {};

    history.forEach((historyWorkout) => {
      if (!historyWorkout.exercises) return;

      historyWorkout.exercises.forEach((exercise) => {
        if (!exercise.name) return;

        const bestSet = (exercise.sets || []).reduce((best, set) => {
          const actualWeight = parseWorkoutWeightValue(set?.weight);
          const originalWeight = parseWorkoutWeightValue(set?.aiOriginalWeight);
          const suggestedWeight = parseWorkoutWeightValue(set?.aiSuggestedWeight);
          const protectedWeight = Math.max(actualWeight, originalWeight, suggestedWeight);

          if (protectedWeight > parseWorkoutWeightValue(best?.weight)) {
            return {
              reps: set?.reps || "",
              weight: protectedWeight || "",
              date: historyWorkout.date
            };
          }

          return best;
        }, result[exercise.name] || null);

        if (bestSet) result[exercise.name] = bestSet;
      });
    });

    return result;
  }, [history]);

  function getLastExerciseText(exerciseName) {
    const last = lastExerciseResults[exerciseName];

    if (!last) {
      return "Прошлый раз: нет данных";
    }

    return `Прошлый раз: ${last.reps} × ${last.weight || "без веса"}`;
  }

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const result = await signInWithEmailAndPassword(auth, login, password);

      setPage("main");
      setLoginError("");
      setSelectedUserId(null);

      loadHistory();
      loadWorkoutsFromFirebase(result.user.uid);
    } catch {
      setLoginError("Неверный email или пароль");
    }
  }

  async function handleRegister() {
    try {
      const result = await createUserWithEmailAndPassword(auth, login, password);

      await setDoc(doc(db, "users", result.user.uid), {
        email: login,
        role: false ? "admin" : "client"
      });

      setLoginError("");
      setPage("main");
      setSelectedUserId(null);

      loadHistory();
      loadWorkoutsFromFirebase(result.user.uid);
    } catch (err) {
      console.log(err);

      if (err.code === "auth/email-already-in-use") {
        setLoginError("Этот email уже зарегистрирован");
      } else if (err.code === "auth/invalid-email") {
        setLoginError("Неверный формат email");
      } else if (err.code === "auth/weak-password") {
        setLoginError("Пароль должен быть минимум 6 символов");
      } else {
        setLoginError("Ошибка регистрации");
      }
    }
  }

  const nutritionDateKey = selectedNutritionDateKey;
  const isNutritionToday = nutritionDateKey === todayNutritionKey();

  const nutritionToday = useMemo(() => {
    return nutrition.days?.[nutritionDateKey] || makeEmptyNutritionDay();
  }, [nutrition, nutritionDateKey]);

  const nutritionTotals = useMemo(() => {
    return (nutritionToday.foods || []).reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        fat: acc.fat + (Number(item.fat) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0)
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
  }, [nutritionToday]);

  const nutritionHistoryDays = useMemo(() => {
    return Object.entries(nutrition.days || {})
      .map(([date, day]) => {
        const totals = (day.foods || []).reduce(
          (acc, item) => ({
            calories: acc.calories + (Number(item.calories) || 0),
            protein: acc.protein + (Number(item.protein) || 0),
            fat: acc.fat + (Number(item.fat) || 0),
            carbs: acc.carbs + (Number(item.carbs) || 0),
            count: acc.count + 1
          }),
          { calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 }
        );
        return { date, day, totals };
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  }, [nutrition.days]);

  const myNutritionFoods = useMemo(() => {
    return Object.values(nutrition.myFoods || {})
      .sort((a, b) => (Number(b.useCount) || 0) - (Number(a.useCount) || 0))
      .map(normalizeNutritionFood);
  }, [nutrition.myFoods]);

  const nutritionSearchResults = useMemo(() => {
    const query = nutritionSearch.trim().toLowerCase();
    const recentIds = nutrition.recent || [];
    const favoriteIds = nutrition.favorites || [];
    const localFoods = nutritionFoodDatabase.map(normalizeNutritionFood);
    const myFoods = Object.values(nutrition.myFoods || {})
      .sort((a, b) => (Number(b.useCount) || 0) - (Number(a.useCount) || 0))
      .map(normalizeNutritionFood);

    if (nutritionSearchTab === "my") {
      if (query.length >= 2) {
        return myFoods
          .filter((food) => food.name.toLowerCase().includes(query))
          .slice(0, 30);
      }

      return myFoods.slice(0, 30);
    }

    if (nutritionSearchTab === "recent") {
      return recentIds
        .map((id) =>
          myFoods.find((food) => food.id === id || food.foodId === id) ||
          localFoods.find((food) => food.id === id) ||
          (nutritionToday.foods || []).find((food) => food.foodId === id || food.id === id)
        )
        .filter(Boolean)
        .map(normalizeNutritionFood)
        .slice(0, 20);
    }

    if (nutritionSearchTab === "favorites") {
      return favoriteIds
        .map((id) =>
          myFoods.find((food) => food.id === id || food.foodId === id) ||
          localFoods.find((food) => food.id === id) ||
          (nutritionToday.foods || []).find((food) => food.foodId === id || food.id === id)
        )
        .filter(Boolean)
        .map(normalizeNutritionFood)
        .slice(0, 20);
    }

    if (query.length >= 1) {
      const personalMatches = myFoods
        .filter((food) => food.name.toLowerCase().includes(query))
        .slice(0, 20);

      if (query.length >= 2 && fatSecretFoods.length > 0) {
        const personalKeys = new Set(
          personalMatches.map((food) => String(food.name || "").trim().toLowerCase())
        );

        const externalMatches = fatSecretFoods
          .map(normalizeNutritionFood)
          .filter((food) => !personalKeys.has(String(food.name || "").trim().toLowerCase()))
          .slice(0, 30);

        return [...personalMatches, ...externalMatches];
      }

      return personalMatches;
    }

    return [];
  }, [nutritionSearch, nutritionSearchTab, nutrition.favorites, nutrition.recent, nutrition.myFoods, nutritionToday.foods, fatSecretFoods]);

  const nutritionAdvice = useMemo(() => {
    const calorieLeft = nutrition.goals.calories - nutritionTotals.calories;
    const proteinLeft = nutrition.goals.protein - nutritionTotals.protein;
    const waterLeft = nutrition.goals.water - (nutritionToday.water || 0);

    if (nutritionTotals.calories === 0) {
      return "Добавь первый приём пищи — и я покажу, чего не хватает по калориям, белку и воде.";
    }

    if (proteinLeft > 45) {
      return `Белка пока маловато: осталось примерно ${Math.ceil(proteinLeft)} г. Хороший вариант — курица, творог, рыба или протеин.`;
    }

    if (calorieLeft < 250 && proteinLeft > 15) {
      return "Калории почти закрыты, но белок ещё можно добрать чем-то лёгким: творог, йогурт или протеин.";
    }

    if (waterLeft > 700) {
      return "По еде всё неплохо. Воды сегодня маловато — добавь 1–2 стакана в ближайшее время.";
    }

    return "Отличный день по питанию. Держи белок стабильно — это хорошо поддержит прогресс в тренировках.";
  }, [nutrition.goals, nutritionTotals, nutritionToday.water]);

  function getNutritionWeekDates(centerKey = nutritionDateKey) {
    const centerDate = nutritionKeyToDate(centerKey);
    const monday = new Date(centerDate);
    const dayIndex = monday.getDay() === 0 ? 6 : monday.getDay() - 1;
    monday.setDate(monday.getDate() - dayIndex);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        key: dateToNutritionKey(date),
        label: ["П", "В", "С", "Ч", "П", "С", "В"][index],
        date
      };
    });
  }

  function getNutritionCurrentStreak() {
    const days = nutrition.days || {};
    let streak = 0;
    const cursor = nutritionKeyToDate(todayNutritionKey());

    while (true) {
      const key = dateToNutritionKey(cursor);
      const hasFood = Boolean(days?.[key]?.foods?.length);
      if (!hasFood) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  function openSelectedNutritionDate() {
    setExpandedNutritionMeals({});
  }

  function selectNutritionDate(key) {
    setSelectedNutritionDateKey(key);
    setNutritionCalendarMonthKey(String(key || todayNutritionKey()).slice(0, 7));
    setNutritionCalendarOpen(false);
    setExpandedNutritionMeals({});
  }

  function openNutritionCalendar() {
    setNutritionCalendarMonthKey(String(nutritionDateKey || todayNutritionKey()).slice(0, 7));
    setNutritionCalendarOpen(true);
  }

  function shiftNutritionCalendarMonth(offset) {
    setNutritionCalendarMonthKey((current) => {
      const [year, month] = String(current || todayNutritionKey().slice(0, 7)).split("-").map(Number);
      const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1);
      return dateToNutritionKey(date).slice(0, 7);
    });
  }

  function getNutritionCalendarDays() {
    const [year, month] = String(nutritionCalendarMonthKey || todayNutritionKey().slice(0, 7)).split("-").map(Number);
    const firstDay = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
    const start = new Date(firstDay);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    start.setDate(firstDay.getDate() - mondayOffset);

    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateToNutritionKey(date);
      const day = nutrition.days?.[key] || makeEmptyNutritionDay();
      const totals = (day.foods || []).reduce(
        (sum, item) => ({
          calories: sum.calories + (Number(item.calories) || 0),
          protein: sum.protein + (Number(item.protein) || 0),
          fat: sum.fat + (Number(item.fat) || 0),
          carbs: sum.carbs + (Number(item.carbs) || 0)
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      return {
        key,
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === firstDay.getMonth(),
        isToday: key === todayNutritionKey(),
        isSelected: key === nutritionDateKey,
        hasFood: Boolean(day.foods?.length),
        foodCount: day.foods?.length || 0,
        calories: Math.round(totals.calories || 0),
        isOverGoal: totals.calories > (Number(nutrition.goals?.calories) || 0)
      };
    });
  }

  function getNutritionCalendarMonthLabel() {
    const [year, month] = String(nutritionCalendarMonthKey || todayNutritionKey().slice(0, 7)).split("-").map(Number);
    return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric"
    });
  }

  function updateNutritionDay(updater) {
    setNutrition((prev) => {
      const currentDay = prev.days?.[nutritionDateKey] || makeEmptyNutritionDay();
      return {
        ...prev,
        days: {
          ...prev.days,
          [nutritionDateKey]: updater(currentDay)
        }
      };
    });
  }

  function addNutritionFood(food, mealId = nutritionMeal, amount = nutritionAmount) {
    const sourceFood = normalizeNutritionFood(food);
    const scale = getFoodScale(amount, sourceFood, nutritionAmountMode);
    const numericAmount = parseNutritionNumber(amount, 100) || 100;
    const item = {
      id: `${sourceFood.id}_${Date.now()}`,
      foodId: sourceFood.id,
      fatSecretId: food.fatSecretId || "",
      name: sourceFood.name,
      mealId,
      amount: numericAmount,
      amountMode: nutritionAmountMode,
      portion: sourceFood.portion,
      portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood)),
      calories: Math.round(sourceFood.calories * scale),
      protein: roundMacro(sourceFood.protein * scale),
      fat: roundMacro(sourceFood.fat * scale),
      carbs: roundMacro(sourceFood.carbs * scale),
      source: sourceFood.source,
      icon: sourceFood.icon || getFoodIcon(sourceFood),
      type: sourceFood.type || "",
      totalWeight: parseNutritionNumber(sourceFood.totalWeight, 0) || parseNutritionNumber(sourceFood.portionAmount, 0) || 0,
      ingredients: Array.isArray(sourceFood.ingredients) ? sourceFood.ingredients : [],
      note: nutritionEditNote.trim(),
      addedAt: new Date().toISOString()
    };

    updateNutritionDay((day) => ({
      ...day,
      foods: [item, ...(day.foods || [])]
    }));

    setNutrition((prev) => {
      const myFoodId = makePersonalFoodKey(sourceFood);
      const existing = prev.myFoods?.[myFoodId];
      const personalFood = normalizeMyFoodRecord(
        {
          ...sourceFood,
          id: myFoodId,
          foodId: myFoodId,
          amountMode: nutritionAmountMode,
          portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood))
        },
        numericAmount,
        existing
      );

      const nextMyFoods = {
        ...(prev.myFoods || {}),
        [myFoodId]: personalFood
      };

      savePersonalMyFoodsToFirebase(nextMyFoods);

      return {
        ...prev,
        myFoods: nextMyFoods,
        recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId && id !== sourceFood.id)].slice(0, 20)
      };
    });

    setExpandedNutritionMeals((prev) => ({
      ...prev,
      [mealId]: true
    }));
  }

  function openNutritionCreateProductFromPhoto(aiFood = {}, fallbackName = "") {
    const cleanName = String(aiFood.name || aiFood.food_name || fallbackName || nutritionSearch || "Новый продукт").trim();
    const calories = Number(aiFood.calories ?? aiFood.kcal ?? aiFood.energy ?? 0) || 0;
    const protein = Number(aiFood.protein ?? aiFood.proteins ?? 0) || 0;
    const fat = Number(aiFood.fat ?? aiFood.fats ?? 0) || 0;
    const carbs = Number(aiFood.carbs ?? aiFood.carbohydrate ?? aiFood.carbohydrates ?? 0) || 0;

    const draftFood = normalizeNutritionFood({
      id: `photo_${Date.now()}`,
      foodId: `photo_${Date.now()}`,
      name: cleanName || "Новый продукт",
      brand: aiFood.brand || "",
      portion: "100 г",
      portionAmount: 100,
      calories,
      protein,
      fat,
      carbs,
      source: "AI фото",
      amountMode: "grams",
      lastAmount: 100,
      icon: getFoodIcon({ name: cleanName }) || "🍽️"
    });

    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setNutritionPhotoAiCandidates([]);
    setNutritionPhotoAiConfidence("");
    setNutritionPhotoAiResult(`ИИ распознал этикетку: ${draftFood.name}. Проверь КБЖУ и сохрани продукт.`);
    setNutritionSearch(draftFood.name);
    setEditingNutritionItemId(null);
    setNutritionMealMenuOpen(false);
    setNutritionCreateChoiceOpen(false);
    setSelectedNutritionFood(draftFood);
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(true);
    setNutritionEditPageOpen(true);
  }

  function createCustomNutritionFood() {
    const cleanName = nutritionSearch.trim();
    const draftFood = normalizeNutritionFood({
      id: `custom_${Date.now()}`,
      foodId: `custom_${Date.now()}`,
      name: cleanName || "Новый продукт",
      portion: "100 г",
      portionAmount: 100,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      source: "Моя база",
      amountMode: "grams",
      lastAmount: 100,
      icon: "🍽️"
    });

    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setEditingNutritionItemId(null);
    setNutritionMealMenuOpen(false);
    setNutritionCreateChoiceOpen(false);
    setSelectedNutritionFood(draftFood);
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(true);
  }

  function createCustomNutritionDish() {
    const cleanName = nutritionSearch.trim();
    const draftDish = normalizeNutritionFood({
      id: `dish_${Date.now()}`,
      foodId: `dish_${Date.now()}`,
      name: cleanName || "Новое блюдо",
      portion: "100 г",
      portionAmount: 100,
      totalWeight: 100,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      source: "Моя база",
      amountMode: "grams",
      lastAmount: 100,
      icon: "🍲",
      type: "dish",
      ingredients: []
    });

    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setEditingNutritionItemId(null);
    setNutritionMealMenuOpen(false);
    setNutritionCreateChoiceOpen(false);
    setSelectedNutritionFood(draftDish);
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(true);
  }

  function addNutritionFoodFromPicker(food) {
    const normalizedFood = normalizeNutritionFood(food);
    const storedFood = nutrition.myFoods?.[normalizedFood.id] || nutrition.myFoods?.[normalizedFood.foodId];

    const foodForPicker = {
      ...normalizedFood,
      portionAmount: storedFood?.portionAmount || normalizedFood.portionAmount || 0,
      amountMode: storedFood?.amountMode || normalizedFood.amountMode || "",
      icon: storedFood?.icon || normalizedFood.icon || getFoodIcon(normalizedFood)
    };

    const savedMode = storedFood?.amountMode || normalizedFood.amountMode || "";
    const savedAmount = storedFood?.lastAmount || normalizedFood.lastAmount;
    const preferredUnitId = loadNutritionPreferredUnit(foodForPicker);
    const defaultUnit =
      getNutritionSmartUnits(foodForPicker).find((unit) => unit.id === preferredUnitId) ||
      getDefaultNutritionSmartUnit(foodForPicker);
    const nextAmount = savedAmount || defaultUnit.amount || 100;
    const nextMode = savedMode || defaultUnit.mode || detectNutritionAmountMode(foodForPicker, nextAmount, savedMode);

    if (!savedAmount && defaultUnit.mode === "portion") {
      foodForPicker.portion = defaultUnit.portion || defaultUnit.label || foodForPicker.portion;
      foodForPicker.portionAmount = defaultUnit.portionAmount || defaultUnit.amount || foodForPicker.portionAmount;
    }

    setEditingNutritionItemId(null);
    setSelectedNutritionFood(foodForPicker);
    setNutritionAmount(String(nextAmount));
    setNutritionAmountMode(nextMode);
  }

  function updateNutritionFood(itemId, food, amount = nutritionAmount) {
    const sourceFood = normalizeNutritionFood(food);
    const scale = getFoodScale(amount, sourceFood, nutritionAmountMode);
    const numericAmount = parseNutritionNumber(amount, 100) || 100;

    updateNutritionDay((day) => ({
      ...day,
      foods: (day.foods || []).map((item) => (
        item.id === itemId
          ? {
              ...item,
              foodId: sourceFood.id,
              fatSecretId: sourceFood.fatSecretId || item.fatSecretId || "",
              name: sourceFood.name,
              amount: numericAmount,
              amountMode: nutritionAmountMode,
              portion: sourceFood.portion,
              portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood)),
              calories: Math.round(sourceFood.calories * scale),
              protein: roundMacro(sourceFood.protein * scale),
              fat: roundMacro(sourceFood.fat * scale),
              carbs: roundMacro(sourceFood.carbs * scale),
              source: sourceFood.source,
              icon: sourceFood.icon || getFoodIcon(sourceFood),
              type: sourceFood.type || "",
              totalWeight: parseNutritionNumber(sourceFood.totalWeight, 0) || parseNutritionNumber(sourceFood.portionAmount, 0) || 0,
              ingredients: Array.isArray(sourceFood.ingredients) ? sourceFood.ingredients : [],
              note: nutritionEditNote.trim(),
              updatedAt: new Date().toISOString()
            }
          : item
      ))
    }));

    setNutrition((prev) => {
      const myFoodId = makePersonalFoodKey(sourceFood);
      const existing = prev.myFoods?.[myFoodId];
      const personalFood = normalizeMyFoodRecord(
        {
          ...sourceFood,
          id: myFoodId,
          foodId: myFoodId,
          amountMode: nutritionAmountMode,
          portionAmount: nutritionAmountMode === "portion" ? numericAmount : (Number(sourceFood.portionAmount) || getFoodPortionAmount(sourceFood))
        },
        numericAmount,
        existing
      );

      const nextMyFoods = {
        ...(prev.myFoods || {}),
        [myFoodId]: personalFood
      };

      savePersonalMyFoodsToFirebase(nextMyFoods);

      return {
        ...prev,
        myFoods: nextMyFoods,
        recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId && id !== sourceFood.id)].slice(0, 20)
      };
    });
  }

  function updateSelectedNutritionFoodField(field, value) {
    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const numericFields = ["calories", "protein", "fat", "carbs", "portionAmount", "lastAmount"];
      if (numericFields.includes(field)) {
        return {
          ...prev,
          // Keep the raw input while editing so deleting digits or using comma does not cause visual lag.
          [field]: value
        };
      }

      return {
        ...prev,
        [field]: value
      };
    });
  }

  function updateSelectedNutritionPortionUnit(unit) {
    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const currentPortion = String(prev.portion || "").trim();
      const match = currentPortion.match(/(\d+[,.]?\d*)/);
      const amount = match?.[1] || String(prev.portionAmount || prev.lastAmount || "100");

      return {
        ...prev,
        portion: `${amount} ${unit}`,
        portionAmount: parseNutritionNumber(amount, 0) || prev.portionAmount || 100
      };
    });
  }

  function updateSelectedDishTotalWeight(value) {
    const numericWeight = parseNutritionNumber(value, 0);
    const cleanValue = String(value ?? "");

    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        totalWeight: cleanValue,
        portionAmount: cleanValue,
        portion: `${numericWeight > 0 ? cleanValue : ""} г`
      };
    });
  }

  function recalcDishFromIngredients(ingredients) {
    return (ingredients || []).reduce((sum, ingredient) => {
      const scale = parseNutritionNumber(ingredient.grams, 0) / (parseNutritionNumber(ingredient.baseAmount, 100) || 100);

      return {
        calories: sum.calories + (Number(ingredient.baseCalories) || 0) * scale,
        protein: sum.protein + (Number(ingredient.baseProtein) || 0) * scale,
        fat: sum.fat + (Number(ingredient.baseFat) || 0) * scale,
        carbs: sum.carbs + (Number(ingredient.baseCarbs) || 0) * scale
      };
    }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
  }

  function openDishIngredientPicker() {
    setDishIngredientSearch("");
    setDishIngredientPickerOpen(true);
  }

  function addSelectedDishIngredientFromFood(food, gramsValue = 100) {
    const normalizedFood = normalizeNutritionFood(food);
    const grams = parseNutritionNumber(gramsValue, 100) || 100;
    const baseAmount = normalizedFood.type === "dish"
      ? (Number(normalizedFood.totalWeight) || Number(normalizedFood.portionAmount) || getFoodPortionAmount(normalizedFood) || 100)
      : 100;

    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const ingredients = Array.isArray(prev.ingredients) ? prev.ingredients : [];

      const nextIngredients = [
        ...ingredients,
        {
          id: `ingredient_${Date.now()}`,
          foodId: normalizedFood.foodId || normalizedFood.id,
          name: normalizedFood.name,
          grams,
          icon: normalizedFood.icon || getFoodIcon(normalizedFood),
          baseAmount,
          baseCalories: Number(normalizedFood.calories) || 0,
          baseProtein: Number(normalizedFood.protein) || 0,
          baseFat: Number(normalizedFood.fat) || 0,
          baseCarbs: Number(normalizedFood.carbs) || 0
        }
      ];

      const totals = recalcDishFromIngredients(nextIngredients);
      const totalWeight = nextIngredients.reduce((sum, item) => sum + parseNutritionNumber(item.grams, 0), 0);

      return {
        ...prev,
        ingredients: nextIngredients,
        totalWeight: totalWeight || prev.totalWeight || prev.portionAmount || 100,
        portionAmount: totalWeight || prev.portionAmount || 100,
        portion: `${totalWeight || prev.portionAmount || 100} г`,
        calories: Math.round(totals.calories),
        protein: roundMacro(totals.protein),
        fat: roundMacro(totals.fat),
        carbs: roundMacro(totals.carbs)
      };
    });

    setDishIngredientPickerOpen(false);
    setDishIngredientSearch("");
  }

  function removeSelectedDishIngredient(ingredientId) {
    setSelectedNutritionFood((prev) => {
      if (!prev) return prev;

      const nextIngredients = (prev.ingredients || []).filter((item) => item.id !== ingredientId);
      const totals = recalcDishFromIngredients(nextIngredients);
      const totalWeight = nextIngredients.reduce((sum, item) => sum + parseNutritionNumber(item.grams, 0), 0);

      return {
        ...prev,
        ingredients: nextIngredients,
        totalWeight: totalWeight || 0,
        portionAmount: totalWeight || 0,
        portion: `${totalWeight || ""} г`,
        calories: Math.round(totals.calories),
        protein: roundMacro(totals.protein),
        fat: roundMacro(totals.fat),
        carbs: roundMacro(totals.carbs)
      };
    });
  }

  function cloneNutritionFoodForEdit(food) {
    if (!food) return null;

    try {
      return JSON.parse(JSON.stringify(food));
    } catch (_) {
      return { ...food };
    }
  }

  function openNutritionEditPage() {
    setNutritionEditOriginalFood(cloneNutritionFoodForEdit(selectedNutritionFood));
    setNutritionEditOriginalNote(nutritionEditNote);
    setNutritionEditPageOpen(true);
  }

  function cancelNutritionEditPage() {
    const originalFood = cloneNutritionFoodForEdit(nutritionEditOriginalFood);

    if (originalFood) {
      setSelectedNutritionFood(originalFood);
    }

    setNutritionEditNote(nutritionEditOriginalNote || "");
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setNutritionEditPageOpen(false);
  }

  function confirmNutritionEditPage() {
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setNutritionEditPageOpen(false);
  }

  function confirmNutritionFoodFromPicker() {
    if (!selectedNutritionFood) return;

    if (editingNutritionItemId && String(editingNutritionItemId).startsWith("my:")) {
      const myFoodId = String(editingNutritionItemId).replace("my:", "");
      const numericAmount = parseNutritionNumber(nutritionAmount, 100) || 100;

      const foodToAdd = normalizeNutritionFood({
        ...selectedNutritionFood,
        id: myFoodId,
        foodId: myFoodId,
        source: "Моя база",
        lastAmount: numericAmount,
        amountMode: nutritionAmountMode,
        portionAmount: nutritionAmountMode === "portion"
          ? numericAmount
          : (Number(selectedNutritionFood.portionAmount) || getFoodPortionAmount(selectedNutritionFood))
      });

      setNutrition((prev) => {
        const current = prev.myFoods?.[myFoodId] || {};
        const updatedFood = normalizeMyFoodRecord(foodToAdd, numericAmount, current);

        const nextMyFoods = {
          ...(prev.myFoods || {}),
          [myFoodId]: updatedFood
        };

        savePersonalMyFoodsToFirebase(nextMyFoods);

        return {
          ...prev,
          myFoods: nextMyFoods,
          recent: [myFoodId, ...(prev.recent || []).filter((id) => id !== myFoodId)].slice(0, 20)
        };
      });

      addNutritionFood(foodToAdd, nutritionMeal, numericAmount);

      setRecentNutritionFoods(loadRecentNutritionFoods());
      setEditingNutritionItemId(null);
      setSelectedNutritionFood(null);
      setNutritionEditDetailsOpen(false);
      setNutritionEditPageOpen(false);
      setNutritionEditNote("");
      setNutritionSearch("");
      setNutritionSearchTab("food");
      resetNutritionPhotoAiState();
      setNutritionPickerOpen(false);
      return;
    }

    if (editingNutritionItemId) {
      updateNutritionFood(editingNutritionItemId, selectedNutritionFood);
      setEditingNutritionItemId(null);
    } else {
      addNutritionFood(selectedNutritionFood);
    }

    setSelectedNutritionFood(null);
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionEditNote("");
    resetNutritionPhotoAiState();
    setNutritionPickerOpen(false);
  }

  function openNutritionPicker(mealId) {
    resetNutritionPhotoAiState();
    setNutritionMeal(mealId);
    setNutritionSearch("");
    setNutritionSearchTab("food");
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(false);
    setNutritionCreateChoiceOpen(false);
    setEditingNutritionItemId(null);
    setSelectedNutritionFood(null);
    setNutritionFallbackSuggestions([]);
    setRecentNutritionFoods(loadRecentNutritionFoods());
    setShowRecentNutritionFoods(false);
    setNutritionPickerOpen(true);
  }

  function openNutritionFoodEditor(item) {
    const numericAmount = parseNutritionNumber(item.amount, 100) || 100;
    const foodForEdit = getNutritionBaseMacroFood(
      {
        ...item,
        id: item.foodId || item.id,
        foodId: item.foodId || item.id,
        source: item.source || "Дневник",
        portionAmount: Number(item.portionAmount) || (item.amountMode === "portion" ? numericAmount : getFoodPortionAmount(item)),
        totalWeight: Number(item.totalWeight) || Number(item.portionAmount) || 0,
        amountMode: item.amountMode || ""
      },
      numericAmount,
      item.amountMode || "grams"
    );

    const detectedAmountMode = detectNutritionAmountMode(foodForEdit, numericAmount, item.amountMode);

    setNutritionMeal(item.mealId || "breakfast");
    setNutritionAmount(String(numericAmount));
    setNutritionAmountMode(detectedAmountMode);
    setNutritionEditNote(item.note || "");
    setNutritionEditDetailsOpen(false);
    setEditingNutritionItemId(item.id);
    setSelectedNutritionFood(foodForEdit);
    setNutritionMealMenuOpen(false);
    setNutritionPickerOpen(true);
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

  function resetNutritionPhotoAiSearch() {
    setNutritionPhotoName("");
    setNutritionPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return "";
    });
    setNutritionPhotoAiResult("");
    setNutritionPhotoAiCandidates([]);
    setNutritionPhotoAiConfidence("");
    setNutritionPhotoAnalyzing(false);
    nutritionPhotoLastFileRef.current = null;
    if (nutritionPhotoInputRef.current) {
      nutritionPhotoInputRef.current.value = "";
    }
  }

  function getNutritionPhotoAiConfidenceText(confidence) {
    const numericConfidence = Number(confidence);
    if (Number.isFinite(numericConfidence) && numericConfidence > 0) {
      const percent = numericConfidence <= 1 ? Math.round(numericConfidence * 100) : Math.round(numericConfidence);
      return `${Math.min(100, percent)}% уверенности`;
    }

    const textConfidence = String(confidence || "").trim();
    return textConfidence ? textConfidence : "";
  }

  function getNutritionPhotoAiCandidateFoods(data = {}) {
    const rawCandidates = [
      data.food,
      ...(Array.isArray(data.candidates) ? data.candidates : []),
      ...(Array.isArray(data.foods) ? data.foods : []),
      ...(Array.isArray(data.results) ? data.results : [])
    ].filter(Boolean);

    const uniqueCandidates = new Map();
    rawCandidates.forEach((candidate) => {
      const normalized = normalizeNutritionFood({
        ...candidate,
        source: candidate.source || "ИИ фото",
        icon: candidate.icon || getFoodIcon(candidate)
      });
      const key = String(normalized.name || "").toLowerCase().trim();
      if (key && !uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, normalized);
      }
    });

    return Array.from(uniqueCandidates.values()).slice(0, 4);
  }

  function selectNutritionPhotoAiCandidate(food) {
    const normalizedFood = normalizeNutritionFood({
      ...food,
      source: food.source || "ИИ фото"
    });
    const preferredUnitId = loadNutritionPreferredUnit(normalizedFood);
    const defaultUnit =
      getNutritionSmartUnits(normalizedFood).find((unit) => unit.id === preferredUnitId) ||
      getDefaultNutritionSmartUnit(normalizedFood);
    const fallbackAmount = normalizedFood.lastAmount || defaultUnit.amount || 100;

    const foodForPicker = {
      ...normalizedFood,
      portion: defaultUnit.mode === "portion" ? (defaultUnit.portion || defaultUnit.label || normalizedFood.portion) : normalizedFood.portion,
      portionAmount: defaultUnit.mode === "portion" ? (defaultUnit.portionAmount || defaultUnit.amount || normalizedFood.portionAmount) : normalizedFood.portionAmount
    };

    setSelectedNutritionFood(foodForPicker);
    setNutritionAmount(String(fallbackAmount));
    setNutritionAmountMode(defaultUnit.mode || "grams");
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setEditingNutritionItemId(null);
    setNutritionPhotoAiResult(`Выбрано: ${normalizedFood.name}`);
  }

  function inferNutritionQueryFromPhotoName(fileName = "") {
    const name = fileName.toLowerCase();
    const hints = [
      { keys: ["chicken", "кур", "grud", "груд"], query: "Куриная грудка" },
      { keys: ["rice", "рис"], query: "Рис" },
      { keys: ["buckwheat", "греч", "grech"], query: "Гречка" },
      { keys: ["egg", "яйц"], query: "Яйцо" },
      { keys: ["curd", "твор"], query: "Творог" },
      { keys: ["oat", "овся"], query: "Овсянка" },
      { keys: ["banana", "банан"], query: "Банан" },
      { keys: ["salmon", "лосос", "рыб"], query: "Лосось" },
      { keys: ["yogurt", "йогурт"], query: "Греческий йогурт" },
      { keys: ["protein", "протеин"], query: "Протеин" },
      { keys: ["apple", "яблок"], query: "Яблоко" },
      { keys: ["potato", "карто"], query: "Картофель" }
    ];

    return hints.find((item) => item.keys.some((key) => name.includes(key)))?.query || "";
  }

  async function prepareNutritionPhotoForAi(file) {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });

      const maxSide = 1280;
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);

      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  function resetNutritionPhotoAiState() {
    setNutritionPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return "";
    });
    setNutritionPhotoName("");
    setNutritionPhotoAiResult("");
    setNutritionPhotoAiCandidates([]);
    setNutritionPhotoAiConfidence("");
    setNutritionPhotoAnalyzing(false);
    nutritionPhotoLastFileRef.current = null;

    if (nutritionPhotoInputRef.current) {
      nutritionPhotoInputRef.current.value = "";
    }
  }

  async function runNutritionPhotoAiSearch(file) {
    if (!file) return;

    if (!String(file.type || "").startsWith("image/")) {
      setNutritionPhotoAiResult("Нужна фотография продукта или этикетки в формате изображения.");
      setNutritionPhotoAiCandidates([]);
      setNutritionPhotoAiConfidence("");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setNutritionPhotoAiResult("Фото слишком большое. Сделай снимок ближе или выбери изображение до 12 МБ.");
      setNutritionPhotoAiCandidates([]);
      setNutritionPhotoAiConfidence("");
      return;
    }

    nutritionPhotoLastFileRef.current = file;
    setNutritionPhotoName(file.name || "Фото продукта");
    setNutritionPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return URL.createObjectURL(file);
    });
    setNutritionPhotoAiResult("");
    setNutritionPhotoAiCandidates([]);
    setNutritionPhotoAiConfidence("");
    setNutritionPhotoAnalyzing(true);
    setFatSecretError("");
    setNutritionSearchTab("food");
    setShowRecentNutritionFoods(false);

    try {
      startPerformanceCheck("AI photo · total", { fileSizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10 });
      startPerformanceCheck("AI photo · prepare image");
      const imageData = await prepareNutritionPhotoForAi(file);
      endPerformanceCheck("AI photo · prepare image", { imageLengthKb: Math.round((imageData.length / 1024) * 10) / 10 });

      startPerformanceCheck("AI photo · function request");
      const response = await fetchWithTimeout("/api/ai-food-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageData,
          mimeType: file.type || "image/jpeg",
          fileName: file.name || "food-photo"
        })
      }, 26000);

      if (response.ok) {
        const data = await response.json();
        endPerformanceCheck("AI photo · function request", { status: response.status });
        const candidates = getNutritionPhotoAiCandidateFoods(data);
        const detectedQuery = String(data.query || data.name || candidates[0]?.name || "").trim();
        const detectedIngredients = data.detectedIngredients || data.ingredients || candidates[0]?.detectedIngredients || candidates[0]?.ingredients || [];
        const hasLabelMacros = [data.calories, data.protein, data.fat, data.carbs, candidates[0]?.calories, candidates[0]?.protein, candidates[0]?.fat, candidates[0]?.carbs]
          .some((value) => Number(value) > 0);
        const hasPackageIdentity = Boolean(
          String(data.brand || candidates[0]?.brand || "").trim()
          || (Array.isArray(detectedIngredients) && detectedIngredients.length)
          || String(data.name || detectedQuery || "").toLowerCase().includes("teos")
        );

        const exactPhotoName = [
          data.brand || candidates[0]?.brand,
          detectedQuery || data.name || candidates[0]?.name,
          ...(Array.isArray(detectedIngredients) ? detectedIngredients : [])
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        const confidenceText = getNutritionPhotoAiConfidenceText(data.confidence || data.score || candidates[0]?.confidence);
        setNutritionPhotoAiConfidence(confidenceText);

        if (hasLabelMacros || hasPackageIdentity) {
          openNutritionCreateProductFromPhoto({
            ...(candidates[0] || {}),
            name: exactPhotoName || detectedQuery || data.name || candidates[0]?.name || "Новый продукт",
            brand: data.brand || candidates[0]?.brand || "",
            calories: Number(data.calories ?? candidates[0]?.calories ?? 0) || 0,
            protein: Number(data.protein ?? candidates[0]?.protein ?? 0) || 0,
            fat: Number(data.fat ?? candidates[0]?.fat ?? 0) || 0,
            carbs: Number(data.carbs ?? candidates[0]?.carbs ?? 0) || 0,
            portion: data.portion || candidates[0]?.portion || "100 г",
            source: "AI этикетка"
          }, exactPhotoName || detectedQuery);
          return;
        }

        const localCandidates = mapNutritionAiResultToLocalFoods({
          name: detectedQuery || data.name || candidates[0]?.name,
          brand: data.brand || candidates[0]?.brand,
          aliases: candidates.map((item) => item.name).filter(Boolean),
          detectedIngredients
        });
        const mergedCandidates = mergeNutritionFoodResults(candidates, localCandidates, 12);

        if (mergedCandidates.length) {
          openNutritionCreateProductFromPhoto(mergedCandidates[0], detectedQuery);
          return;
        }

        if (detectedQuery) {
          openNutritionCreateProductFromPhoto({
            name: detectedQuery,
            brand: data.brand || "",
            calories: data.calories,
            protein: data.protein,
            fat: data.fat,
            carbs: data.carbs
          }, detectedQuery);
          return;
        }
      }

      const fallbackQuery = inferNutritionQueryFromPhotoName(file.name);
      if (fallbackQuery) {
        openNutritionCreateProductFromPhoto({ name: fallbackQuery }, fallbackQuery);
      } else {
        openNutritionCreateProductFromPhoto({ name: "Новый продукт" }, "Новый продукт");
      }
    } catch (error) {
      console.error(error);
      showAppError(
        error.name === "AbortError"
          ? "timeout"
          : typeof navigator !== "undefined" && !navigator.onLine
            ? "offline"
            : "api",
        "AI-фото сейчас недоступно. Можно ввести продукт вручную."
      );
      const fallbackQuery = inferNutritionQueryFromPhotoName(file.name);
      if (fallbackQuery) {
        openNutritionCreateProductFromPhoto({ name: fallbackQuery }, fallbackQuery);
      } else {
        setNutritionPhotoAiResult("ИИ-поиск временно недоступен. Проверь Firebase Function /api/ai-food-photo и OPENAI_API_KEY.");
      }
    } finally {
      endPerformanceCheck("AI photo · total");
      setNutritionPhotoAnalyzing(false);
    }
  }

  async function handleNutritionPhotoAiSearch(event) {
    const file = event.target.files?.[0];
    await runNutritionPhotoAiSearch(file);
    if (event.target) {
      event.target.value = "";
    }
  }

  function retryNutritionPhotoAiSearch() {
    if (nutritionPhotoLastFileRef.current) {
      runNutritionPhotoAiSearch(nutritionPhotoLastFileRef.current);
    } else {
      nutritionPhotoInputRef.current?.click();
    }
  }

  function addFoodByBarcodeFromPicker() {
    const code = nutritionBarcode.trim();
    if (!code) return;

    const food = nutritionFoodDatabase.find((item) => item.barcode === code);
    if (food) {
      addNutritionFoodFromPicker(food);
      setNutritionBarcode("");
      return;
    }

    setFatSecretError("Штрихкод пока не найден. Попробуй найти продукт по названию.");
  }

  function savePersonalMyFoodsToFirebase(myFoods) {
    const currentUser = auth.currentUser || user;
    const uid = currentUser?.uid;

    if (!uid) {
      showAppError("savedLocal", "Моя база сохранена локально. Войди в аккаунт для синхронизации.");
      return;
    }

    const backupId = `my_foods_${Date.now()}`;
    addUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, {
      id: backupId,
      myFoods: myFoods || {},
      reason: "before_personal_my_foods_save"
    }, 12);

    setDoc(getPersonalMyFoodsDocRef(uid), {
      myFoods: myFoods || {},
      updatedAt: new Date().toISOString(),
      ownerUid: uid
    }, { merge: true })
      .then(() => removeUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, backupId))
      .catch((error) => {
        console.error("Personal my foods save error", error);
        showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase", "Моя база сохранена локально.");
        addUserLocalBackup(GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY, uid, {
          myFoods: myFoods || {},
          reason: "personal_my_foods_save_failed",
          error: error.message || String(error)
        }, 12);
      });
  }

  function removeNutritionFood(itemId) {
    addLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, {
      nutrition,
      reason: "before_remove_food",
      itemId
    });

    updateNutritionDay((day) => ({
      ...day,
      foods: (day.foods || []).filter((item) => item.id !== itemId)
    }));
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
        const { myFoods, ...userNutritionState } = nextState;

        setDoc(doc(db, "users", currentUser.uid, "nutrition", "state"), {
          ...userNutritionState,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch((error) => {
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
      const current = loadRecentNutritionFoods();
      const next = current.filter((food) => {
        const id = String(food?.id || "");
        const foodIdValue = String(food?.foodId || "");
        const name = String(food?.name || "").trim().toLowerCase();

        return id !== cleanFoodId && foodIdValue !== cleanFoodId && (!cleanFoodName || name !== cleanFoodName);
      });
      localStorage.setItem(RECENT_NUTRITION_SEARCHES_KEY, JSON.stringify(next));
    } catch (_) {
      // ignore localStorage errors
    }
  }

  function toggleNutritionFavorite(foodId) {
    setNutrition((prev) => {
      const isFavorite = prev.favorites.includes(foodId);
      return {
        ...prev,
        favorites: isFavorite
          ? prev.favorites.filter((id) => id !== foodId)
          : [foodId, ...prev.favorites]
      };
    });
  }

  function addWater(amount) {
    updateNutritionDay((day) => ({
      ...day,
      water: Math.max(0, (Number(day.water) || 0) + amount)
    }));
  }

  function updateBodyWeight(value) {
    updateNutritionDay((day) => ({
      ...day,
      weight: value
    }));
  }

  function findFoodByBarcode() {
    const food = nutritionFoodDatabase.find((item) => item.barcode === nutritionBarcode.trim());
    if (food) {
      addNutritionFood(food);
      setNutritionSearch(food.name);
      setNutritionBarcode("");
    }
  }

  function recognizePhotoFood() {
    const lowerName = nutritionPhotoName.toLowerCase();
    const food = nutritionFoodDatabase.find((item) => lowerName.includes(item.name.toLowerCase().split(" ")[0]));
    if (food) {
      addNutritionFood(food);
      setNutritionSearch(food.name);
      return;
    }

    const fallback = nutritionFoodDatabase.find((item) => item.id === "food_chicken");
    if (fallback) addNutritionFood(fallback);
  }

  function getProfileMeasurementFields(goal = "recomp") {
    return [
      {
        id: "weight",
        label: "Вес",
        unit: "кг",
        placeholder: "82.5",
        icon: "⚖️",
        zone: "Вес",
        hint: "Взвешивайся утром, после туалета, до еды и воды."
      },
      {
        id: "neck",
        label: "Шея",
        unit: "см",
        placeholder: "40",
        icon: "🧍",
        zone: "ШЕЯ",
        hint: "Лента проходит вокруг шеи по середине, без сильного натяжения."
      },
      {
        id: "shoulders",
        label: "Плечевой пояс",
        unit: "см",
        placeholder: "122",
        icon: "↔️",
        zone: "ПЛЕЧИ",
        hint: "Мерь по самой широкой линии плечевого пояса, ровно вокруг тела."
      },
      {
        id: "chest",
        label: "Грудь",
        unit: "см",
        placeholder: "105",
        icon: "📏",
        zone: "ГРУДЬ",
        hint: "Лента проходит по самой широкой части груди, дыхание спокойное."
      },
      {
        id: "biceps",
        label: "Бицепс",
        unit: "см",
        placeholder: "38",
        icon: "💪",
        zone: "БИЦЕПС",
        hint: "Мерь середину плеча. Всегда одинаково: расслабленно или напряжённо."
      },
      {
        id: "forearm",
        label: "Предплечье",
        unit: "см",
        placeholder: "31",
        icon: "🦾",
        zone: "ПРЕДПЛЕЧЬЕ",
        hint: "Лента по самой широкой части предплечья."
      },
      {
        id: "wrist",
        label: "Запястье",
        unit: "см",
        placeholder: "18",
        icon: "⌚",
        zone: "ЗАПЯСТЬЕ",
        hint: "Мерь над косточкой запястья, лента прилегает мягко."
      },
      {
        id: "belly",
        label: "Живот",
        unit: "см",
        placeholder: "88",
        icon: "⭕",
        zone: "ЖИВОТ",
        hint: "Мерь на уровне пупка, живот не втягивать."
      },
      {
        id: "pelvis",
        label: "Таз",
        unit: "см",
        placeholder: "98",
        icon: "⬭",
        zone: "ТАЗ",
        hint: "Лента проходит по самой широкой части таза/ягодиц."
      },
      {
        id: "thigh",
        label: "Бедро",
        unit: "см",
        placeholder: "58",
        icon: "🦵",
        zone: "БЕДРО",
        hint: "Мерь самую широкую часть бедра, нога расслаблена."
      },
      {
        id: "calf",
        label: "Голень",
        unit: "см",
        placeholder: "39",
        icon: "🦶",
        zone: "ГОЛЕНЬ",
        hint: "Мерь самую широкую часть икры."
      },
      {
        id: "ankle",
        label: "Лодыжка",
        unit: "см",
        placeholder: "23",
        icon: "🦶",
        zone: "ЛОДЫЖКА",
        hint: "Мерь самую узкую часть над стопой, лента прилегает мягко."
      }
    ];
  }

  function getProfileMeasurementGoalText(goal = "recomp") {
    if (goal === "mass") return "Для набора важно видеть рост веса и объёмов без резкого набора талии.";
    if (goal === "cut" || goal === "dry") return "Для похудения и сушки важны вес, талия и объёмы — так видно, уходит ли жир.";
    if (goal === "maintain") return "Для поддержки важно, чтобы вес и талия оставались стабильными.";
    return "Для рекомпозиции важны вес, талия и объёмы: вес может стоять, но форма должна меняться.";
  }

  function getMeasurementTimestampValue(measurement = {}) {
    const rawDate = measurement.date || measurement.createdAt || measurement.savedAt || "";
    const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function formatProfileMeasurementDate(measurement = null) {
    if (!measurement) return "Замеров пока нет";
    const rawDate = measurement.date || measurement.createdAt || "";
    if (!rawDate) return "Дата не указана";

    const parsedDate = new Date(rawDate);
    if (Number.isNaN(parsedDate.getTime())) return "Дата не указана";

    return parsedDate.toLocaleDateString("ru-RU");
  }

  function getProfileMeasurementValue(measurement = null, field = {}) {
    if (!field?.id) return "—";
    const value = measurement?.[field.id];

    if (value === 0 || value === "0") return "0";
    if (value === null || value === undefined || String(value).trim() === "") return "—";

    return String(value).trim();
  }

  async function loadProfileMeasurements(uid = auth.currentUser?.uid) {
    if (!uid) {
      setProfileMeasurements([]);
      return [];
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "measurements"));
      const measurements = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

      setProfileMeasurements(measurements);
      return measurements;
    } catch (error) {
      console.error("Ошибка загрузки замеров:", error);
      setProfileMeasurements([]);
      return [];
    }
  }

  async function saveProfileMeasurement() {
    if (!auth.currentUser?.uid) return;

    const activeGoal = aiNutritionProfileDraft.goal || aiNutritionProfile?.goal || "recomp";
    const fields = getProfileMeasurementFields(activeGoal);
    const hasAnyValue = fields.some((field) => String(profileMeasurementDraft[field.id] || "").trim());

    if (!hasAnyValue) {
      setProfileMeasurementStatus("Заполни хотя бы один замер.");
      return;
    }

    setProfileMeasurementSaving(true);
    setProfileMeasurementStatus("");

    try {
      const measurement = {
        ...profileMeasurementDraft,
        goal: activeGoal,
        goalLabel: getAiNutritionGoalLabel(activeGoal),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const savedMeasurementRef = await addDoc(collection(db, "users", auth.currentUser.uid, "measurements"), measurement);
      setProfileMeasurements((prev) => [
        { id: savedMeasurementRef.id, ...measurement },
        ...(Array.isArray(prev) ? prev : [])
      ].sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a)));

      if (profileMeasurementDraft.weight) {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          aiNutritionProfile: {
            ...(aiNutritionProfile || {}),
            ...(aiNutritionProfileDraft || {}),
            weight: profileMeasurementDraft.weight
          },
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setAiNutritionProfileDraft((prev) => ({ ...prev, weight: profileMeasurementDraft.weight }));
        setAiNutritionProfile((prev) => ({ ...(prev || {}), ...(aiNutritionProfileDraft || {}), weight: profileMeasurementDraft.weight }));
      }

      setProfileMeasurementStatus("Замер сохранён. Эти данные можно использовать для коррекции плана.");
      setProfileMeasurementDraft({
        weight: "",
        neck: "",
        shoulders: "",
        chest: "",
        biceps: "",
        forearm: "",
        wrist: "",
        belly: "",
        pelvis: "",
        thigh: "",
        calf: "",
        ankle: "",
        note: ""
      });
      setProfileMeasurementWizardStep(0);
      setProfileMeasurementOpen(false);
      setProfileActiveTab("measurements");
      setPage("profile");
    } catch (error) {
      console.error("Ошибка сохранения замера:", error);
      setProfileMeasurementStatus("Не получилось сохранить замер.");
    } finally {
      setProfileMeasurementSaving(false);
    }
  }

  function renderFirstSetupOnboarding() {
    if (!showFirstSetupOnboarding) return null;

    return (
      <div className="firstSetupOverlay">
        <div className="firstSetupCard">
          <div className="firstSetupStep">
            Шаг {onboardingStep + 1}/7
          </div>

          <h2>
            {["Пол", "Возраст", "Рост", "Вес", "Цель", "Тренировки", "Активность"][onboardingStep]}
          </h2>

          <p>
            AI построит персональный план питания и КБЖУ.
          </p>

          <div className="firstSetupBody">
            {onboardingStep === 0 && (
              <div className="firstSetupChoiceGrid">
                <button
                  type="button"
                  className={aiNutritionProfileDraft.sex === "male" ? "active" : ""}
                  onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, sex: "male" }))}
                >
                  👨 Мужчина
                </button>

                <button
                  type="button"
                  className={aiNutritionProfileDraft.sex === "female" ? "active" : ""}
                  onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, sex: "female" }))}
                >
                  👩 Женщина
                </button>
              </div>
            )}

            {onboardingStep === 1 && (
              <input
                className="firstSetupInput"
                placeholder="Возраст"
                type="number"
                value={aiNutritionProfileDraft.age || ""}
                onChange={(e) => setAiNutritionProfileDraft((prev) => ({ ...prev, age: e.target.value }))}
              />
            )}

            {onboardingStep === 2 && (
              <input
                className="firstSetupInput"
                placeholder="Рост"
                type="number"
                value={aiNutritionProfileDraft.height || ""}
                onChange={(e) => setAiNutritionProfileDraft((prev) => ({ ...prev, height: e.target.value }))}
              />
            )}

            {onboardingStep === 3 && (
              <input
                className="firstSetupInput"
                placeholder="Вес"
                type="number"
                value={aiNutritionProfileDraft.weight || ""}
                onChange={(e) => setAiNutritionProfileDraft((prev) => ({ ...prev, weight: e.target.value }))}
              />
            )}

            {onboardingStep === 4 && (
              <div className="firstSetupGoalGrid">
                {[
                  ["maintain", "Поддержка"],
                  ["recomp", "Рекомпозиция"],
                  ["mass", "Набор"],
                  ["cut", "Похудение"],
                  ["dry", "Сушка"]
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={aiNutritionProfileDraft.goal === id ? "active" : ""}
                    onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, goal: id }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {onboardingStep === 5 && (
              <div className="firstSetupDays">
                {AI_NUTRITION_WEEK_DAYS.map((day) => {
                  const active = (aiNutritionProfileDraft.trainingDays || []).includes(day.id);

                  return (
                    <button
                      type="button"
                      key={day.id}
                      className={active ? "active" : ""}
                      onClick={() => {
                        const current = aiNutritionProfileDraft.trainingDays || [];
                        const next = active
                          ? current.filter((item) => item !== day.id)
                          : [...current, day.id];

                        setAiNutritionProfileDraft((prev) => ({
                          ...prev,
                          trainingDays: next
                        }));
                      }}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            )}

            {onboardingStep === 6 && (
              <div className="firstSetupGoalGrid">
                {[
                  ["low", "Низкая"],
                  ["medium", "Средняя"],
                  ["high", "Высокая"]
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={aiNutritionProfileDraft.activity === id ? "active" : ""}
                    onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, activity: id }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="firstSetupBottom">
            {onboardingStep > 0 && (
              <button
                type="button"
                className="firstSetupSecondary"
                onClick={() => setOnboardingStep((prev) => prev - 1)}
              >
                Назад
              </button>
            )}

            {onboardingStep < 6 ? (
              <button
                type="button"
                className="firstSetupPrimary"
                onClick={() => setOnboardingStep((prev) => prev + 1)}
              >
                Далее
              </button>
            ) : (
              <button
                type="button"
                className="firstSetupPrimary"
                disabled={!hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft)}
                onClick={async () => {
                  if (!hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft)) return;

                  await saveAiNutritionPlan(aiNutritionProfileDraft);

                  try {
                    if (user?.uid && hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft)) {
                      localStorage.setItem(FIRST_SETUP_DONE_USER_STORAGE_KEY, `${user.uid}:${FIRST_SETUP_REQUIRED_VERSION}`);
                      localStorage.setItem(`${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${user.uid}`, FIRST_SETUP_REQUIRED_VERSION);
                    }
                  } catch (_) {
                    // ignore localStorage errors
                  }

                  setFirstSetupCompletedInSession(true);
                  setShowFirstSetupOnboarding(false);
                  setOnboardingStep(0);
                  setPage("main");
                }}
              >
                Создать AI-план
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderWorkoutReadinessModal() {
    if (!workoutReadinessOpen || !selectedWorkoutId || workoutStarted) return null;

    return (
      <div className="workoutReadinessOverlay">
        <div className="workoutReadinessCard">
          <span className="workoutReadinessBadge">AI readiness check</span>
          <h2>Как ты себя чувствуешь?</h2>
          <p>AI адаптирует тренировку под твоё состояние и предлагает вес из стандартных шагов зала.</p>

          <div className="workoutReadinessGrid">
            {WORKOUT_READINESS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={workoutReadiness?.id === option.id ? "active" : ""}
                onClick={() => {
                  applyWorkoutReadiness(option);
                }}
              >
                <span>{option.emoji}</span>
                <strong>{option.title}</strong>
                <small>{option.volumeText}</small>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="workoutReadinessSkip"
            onClick={() => {
              applyWorkoutReadiness(getWorkoutReadinessOption("good"));
            }}
          >
            Пропустить и начать обычно
          </button>
        </div>
      </div>
    );
  }

  function renderPostWorkoutFeedbackModal() {
    if (!postWorkoutFeedbackOpen) return null;

    return (
      <div className="postWorkoutOverlay">
        <div className="postWorkoutCard">
          <span className="postWorkoutBadge">AI feedback</span>

          <h2>Как прошла тренировка?</h2>

          <p>
            AI учтёт это для восстановления и следующих рекомендаций.
          </p>

          <div className="postWorkoutGrid">
            {POST_WORKOUT_FEEDBACK_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                disabled={isSaving}
                onClick={async () => {
                  setPostWorkoutFeedback(option);
                  setPostWorkoutFeedbackOpen(false);
                  await saveWorkoutToFirebase(option);
                }}
              >
                <span>{option.emoji}</span>
                <strong>{option.title}</strong>
                <small>{option.subtitle}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function refreshPage() {
    window.location.reload();
  }

  function toggleAppTheme() {
    setAppTheme((currentTheme) => currentTheme === "warm-light" ? "dark-green" : "warm-light");
  }

  function logout() {
    signOut(auth);

    setIsLoggedIn(false);
    setUser(null);
    setIsAdminClaim(false);
    setCurrentUserRole("client");
    setPage("main");
    setPlan({ workouts: [] });
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setIndividualWorkoutIndexInitialized(false);
    setWorkoutReadinessOpen(false);
    setWorkoutReadiness(null);
                  setPostWorkoutFeedback(null);
                  setPostWorkoutFeedbackOpen(false);
    setOpenHistoryKey(null);
    setSelectedUserId(null);
    setLogin("");
    setPassword("");
    setLoginError("");
    setHistory([]);
    setNutrition(defaultNutritionState);
    setNutritionCloudReady(false);
    setWorkoutReadiness(null);
    setPostWorkoutFeedback(null);
    setPostWorkoutFeedbackOpen(false);
    setFirstSetupCompletedInSession(false);
  }

  function goBackToMain() {
    setPage("main");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setWorkoutReadinessOpen(false);
    setWorkoutReadiness(null);
                  setPostWorkoutFeedback(null);
                  setPostWorkoutFeedbackOpen(false);
    setOpenHistoryKey(null);
  }

  function handleAppBackNavigation() {
    if (fullscreenVideo) {
      setFullscreenVideo(null);
      return true;
    }

    if (barcodeScannerOpen) {
      setBarcodeScannerOpen(false);
      return true;
    }

    if (nutritionEditPageOpen) {
      cancelNutritionEditPage();
      return true;
    }

    if (dishIngredientPickerOpen) {
      setDishIngredientPickerOpen(false);
      return true;
    }

    if (nutritionCreateChoiceOpen) {
      setNutritionCreateChoiceOpen(false);
      return true;
    }

    if (nutritionPickerOpen) {
      setNutritionPickerOpen(false);
      setSelectedNutritionFood(null);
      setEditingNutritionItemId(null);
      setNutritionEditDetailsOpen(false);
      setNutritionEditPageOpen(false);
      setNutritionMealMenuOpen(false);
      setBarcodeScannerOpen(false);
      return true;
    }

    if (page !== "main" || selectedWorkoutId) {
      goBackToMain();
      return true;
    }

    return false;
  }

  function updateWorkout(cb) {
    if (!workout) return;

    setPlan((p) => ({
      ...p,
      workouts: p.workouts.map((w) => (w.id === workout.id ? cb(w) : w))
    }));
  }

  function addSet(id) {
    updateWorkout((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.id === id
          ? {
              ...e,
              sets: [
                ...e.sets,
                {
                  reps: e.name?.includes("Пресс") ? 15 : 8,
                  weight: "",
                  enteredReps: "",
                  enteredWeight: ""
                }
              ]
            }
          : e
      )
    }));
  }

  function updateSet(id, i, field, val) {
    updateWorkout((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.id === id
          ? {
              ...e,
              sets: e.sets.map((s, idx) =>
                idx === i ? { ...s, [field]: val } : s
              )
            }
          : e
      )
    }));
  }

  function resetWorkout() {
    if (!workout) return;

    setPlan((p) => ({
      ...p,
      workouts: p.workouts.map((w) =>
        w.id === workout.id
          ? {
              ...w,
              exercises: w.exercises.map((exercise) => ({
                ...exercise,
                sets: makeThreeSets([], exercise.name.includes("Пресс") ? 15 : 8)
              }))
            }
          : w
      )
    }));
  }

  async function replayFailedHistorySaves(uid = auth.currentUser?.uid) {
    if (!uid) return;

    const queue = getFailedHistoryQueue(uid);
    if (!Array.isArray(queue) || !queue.length) return;

    const remaining = [];

    for (const item of queue) {
      try {
        if (!item?.entry) continue;
        await addDoc(collection(db, "users", uid, "history"), item.entry);
      } catch (error) {
        remaining.push(item);
      }
    }

    setFailedHistoryQueue(uid, remaining);

    if (queue.length && remaining.length < queue.length) {
      await loadHistory();
      showAppError("savedLocal", "Локальные тренировки синхронизированы.");
    }
  }

  async function saveWorkoutToFirebase(feedbackOverride = null) {
    if (!workout || isSaving || isWorkoutSaved) return;

    const currentUser = auth.currentUser;

    if (!currentUser) {
      showAppError("load", "Пользователь не найден. Перезайди в аккаунт.");
      return;
    }

    const finishedAt = Date.now();
    const startedAt = workoutStartedAt || finishedAt;
    const durationSeconds = Math.max(0, Math.floor((finishedAt - startedAt) / 1000));

    setWorkoutFinishedAt(finishedAt);
    setTimerTick(finishedAt);
    setIsSaving(true);
    setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);

    const historyEntry = {
      date: new Date().toISOString(),
        userEmail: currentUser.email || "",
        workout: workout.name,
        workoutId: workout.id,
        durationSeconds,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        readiness: workoutReadiness ? {
          id: workoutReadiness.id,
          title: workoutReadiness.title,
          emoji: workoutReadiness.emoji,
          weightFactor: workoutReadiness.weightFactor
        } : null,
        postWorkoutFeedback: feedbackOverride ? {
          id: feedbackOverride.id,
          title: feedbackOverride.title,
          emoji: feedbackOverride.emoji,
          advice: feedbackOverride.advice
        } : null,
        exercises: workout.exercises.map((exercise) => ({
          name: exercise.name,
          video: exercise.video || "",
          sets: exercise.sets.map((set, index) => {
            const weight = set.enteredWeight || "";

            return {
              set: index + 1,
              reps: weight ? set.enteredReps || set.reps || 8 : "",
              weight,
              aiSuggestedWeight: set.weight || "",
              aiOriginalWeight: set.aiOriginalWeight || "",
              aiReadinessId: set.aiReadinessId || ""
            };
          })
        }))
      };

    const backupId = `history_${Date.now()}`;

    addUserLocalBackup(WORKOUT_HISTORY_BACKUP_STORAGE_KEY, currentUser.uid, {
      id: backupId,
      entry: historyEntry,
      reason: "before_history_save"
    });

    try {
      await addDoc(collection(db, "users", currentUser.uid, "history"), historyEntry);
      removeUserLocalBackup(WORKOUT_HISTORY_BACKUP_STORAGE_KEY, currentUser.uid, backupId);

      await loadHistory();
      clearWorkoutDraft(currentUser.uid, workout.id);
      setIsWorkoutSaved(true);
      setShowWorkoutSavedCard(true);

      setTimeout(() => {
        setShowWorkoutSavedCard(false);
      }, 1800);
    } catch (e) {
      console.log(e);
      addUserLocalBackup(WORKOUT_HISTORY_BACKUP_STORAGE_KEY, currentUser.uid, {
        entry: historyEntry,
        reason: "history_save_failed",
        error: e.message || String(e)
      });
      enqueueFailedHistorySave(currentUser.uid, historyEntry, "history_save_failed");
      showAppError("savedLocal", "Тренировка сохранена локально и будет синхронизирована позже.");
    } finally {
      setIsSaving(false);
    }
  }

  function getWorkoutOrderIndex(workoutItem = {}, fallbackIndex = 0) {
    // For monthly programs order/sortOrder is the source of truth:
    // Week 1 Day 1, Week 1 Day 2... Week 4 Day 4.
    // Do not sort by "День 1" first, otherwise all Day 1 workouts from different weeks group together.
    if (Number.isFinite(Number(workoutItem.order))) return Number(workoutItem.order);
    if (Number.isFinite(Number(workoutItem.sortOrder))) return Number(workoutItem.sortOrder);

    const idMatch = String(workoutItem.id || "").match(/week[_-]?(\d+).*day[_-]?(\d+)|w[_-]?(\d+).*d[_-]?(\d+)/i);
    const weekFromId = Number(idMatch?.[1] || idMatch?.[3]);
    const dayFromId = Number(idMatch?.[2] || idMatch?.[4]);

    if (Number.isFinite(weekFromId) && weekFromId > 0 && Number.isFinite(dayFromId) && dayFromId > 0) {
      return weekFromId * 100 + dayFromId;
    }

    const nameMatch = String(workoutItem.name || "").match(/неделя\s*(\d+).*день\s*(\d+)|день\s*(\d+)/i);
    const weekFromName = Number(nameMatch?.[1]);
    const dayFromName = Number(nameMatch?.[2] || nameMatch?.[3]);

    if (Number.isFinite(weekFromName) && weekFromName > 0 && Number.isFinite(dayFromName) && dayFromName > 0) {
      return weekFromName * 100 + dayFromName;
    }

    if (Number.isFinite(dayFromName) && dayFromName > 0) return dayFromName;

    return fallbackIndex + 1;
  }

  function getCompletedWorkoutKey(value = "") {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function getCompletedWorkoutSet(historyItems = []) {
    const completed = new Set();

    (Array.isArray(historyItems) ? historyItems : []).forEach((item) => {
      if (item?.workout) completed.add(getCompletedWorkoutKey(item.workout));
      if (item?.workoutId) completed.add(getCompletedWorkoutKey(item.workoutId));
    });

    return completed;
  }

  function isWorkoutCompletedByHistory(workoutItem, completedSet = getCompletedWorkoutSet(history)) {
    if (!workoutItem) return false;

    return (
      completedSet.has(getCompletedWorkoutKey(workoutItem.name)) ||
      completedSet.has(getCompletedWorkoutKey(workoutItem.id))
    );
  }

  function getNextUncompletedWorkoutIndex(workouts = [], completedSet = getCompletedWorkoutSet(history)) {
    const index = workouts.findIndex((workoutItem) => !isWorkoutCompletedByHistory(workoutItem, completedSet));
    return index >= 0 ? index : 0;
  }

  function sortWorkoutDays(workouts = []) {
    return [...workouts].sort((a, b) => {
      const orderA = getWorkoutOrderIndex(a);
      const orderB = getWorkoutOrderIndex(b);

      if (orderA !== orderB) return orderA - orderB;

      return String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""), "ru");
    });
  }

  async function loadWorkoutsFromFirebase(userIdFromClick) {
    try {
      const currentUser = auth.currentUser;
      const targetUserId = userIdFromClick || selectedUserId || currentUser?.uid;

      if (!targetUserId) {
        setPlan({ workouts: [] });
        return;
      }

      const isOwnPlan = currentUser?.uid === targetUserId;
      const isAdminLoadingClient = Boolean(userIdFromClick || selectedUserId) && canUseAdminFeatures();

      startPerformanceCheck("Firebase · workouts load", {
        userId: String(targetUserId).slice(0, 6),
        ownPlan: isOwnPlan,
        admin: isAdminLoadingClient
      });

      // Client must only see workouts that trainer assigned in:
      // users/{uid}/workouts/{workoutId}
      // No starter/default/local fallback here.
      const querySnapshot = await getDocs(
        collection(db, "users", targetUserId, "workouts")
      );

      const workoutsFromDb = [];

      querySnapshot.forEach((workoutDoc) => {
        const data = workoutDoc.data();

        workoutsFromDb.push({
          id: workoutDoc.id,
          name: data.name || "Без названия",
          order: data.order,
          sortOrder: data.sortOrder,
          assignedBy: data.assignedBy || "",
          assignedAt: data.assignedAt || "",
          exercises: (data.exercises || []).map(normalizeExercise)
        });
      });

      const nextPlan = {
        workouts: sortWorkoutDays(workoutsFromDb)
      };

      setPlan(nextPlan);

      if (isOwnPlan && currentUser?.uid) {
        safeWriteUserJsonStorage(STORAGE_KEY, currentUser.uid, nextPlan);
      }

      endPerformanceCheck("Firebase · workouts load", {
        workouts: workoutsFromDb.length
      });
    } catch (err) {
      console.log("Ошибка загрузки тренировок:", err);
      setPlan({ workouts: [] });
      showAppError("firebase", "Не получилось загрузить назначенные тренировки.");
    }
  }

  async function saveWorkoutsToFirebase() {
    try {
      const userId = selectedUserId || auth.currentUser?.uid;

      if (!userId) {
        alert("Пользователь не найден");
        return;
      }

      addLocalBackup(WORKOUT_PLAN_BACKUP_STORAGE_KEY, {
        plan,
        reason: "before_workouts_cloud_save",
        userId
      }, 10);

      for (const [workoutIndex, workout] of plan.workouts.entries()) {
        await setDoc(doc(db, "users", userId, "workouts", workout.id), {
          name: workout.name,
          order: workoutIndex + 1,
          sortOrder: workoutIndex + 1,
          assignedBy: auth.currentUser?.uid || "",
          assignedAt: new Date().toISOString(),
          exercises: workout.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            video: exercise.video || "",
            sets: makeThreeSets(
              exercise.sets,
              exercise.name?.includes("Пресс") ? 15 : 8
            )
          }))
        }, { merge: true });
      }

      alert("Тренировки пользователя сохранены в Firebase ✅");
    } catch (err) {
      console.log("Ошибка сохранения тренировок:", err);
      alert("Не получилось сохранить тренировки");
    }
  }

  async function sendAdminTelegramMessage(client = adminSelectedClient) {
    const telegram = getClientTelegramProfile(client);
    const text = String(adminTelegramMessage || "").trim();

    if (!client?.id) {
      setAdminClientStatus("Сначала выбери клиента.");
      return;
    }

    if (!telegram.connected || !telegram.username) {
      setAdminClientStatus("У клиента не привязан Telegram.");
      return;
    }

    if (!text) {
      setAdminClientStatus("Напиши сообщение для клиента.");
      return;
    }

    setAdminTelegramSending(true);

    try {
      const response = await fetch("/api/telegram/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          username: telegram.username,
          chatId: telegram.chatId || "",
          text
        })
      });

      if (!response.ok) {
        throw new Error("Telegram backend error");
      }

      setAdminTelegramMessage("");
      setAdminClientStatus("Telegram-сообщение отправлено.");
    } catch (error) {
      console.error("Ошибка отправки Telegram:", error);
      setAdminClientStatus("Backend Telegram ещё не подключён или сообщение не отправилось.");
    } finally {
      setAdminTelegramSending(false);
    }
  }

  function getClientTelegramProfile(client = {}) {
    return client.telegram || {
      connected: Boolean(client.telegramConnected || client.telegramUsername),
      username: client.telegramUsername || "",
      displayName: client.telegramDisplayName || client.telegramUsername || "",
      notificationsEnabled: client.telegramNotificationsEnabled !== false
    };
  }

  function openTelegramChat(username = "") {
    const cleanUsername = normalizeTelegramUsername(username);
    if (!cleanUsername) {
      setAdminClientStatus("У клиента не указан Telegram username.");
      return;
    }

    window.open(`https://t.me/${cleanUsername}`, "_blank", "noopener,noreferrer");
  }

  async function toggleClientTelegramNotifications(client, enabled) {
    if (!client?.id) return;

    const currentTelegram = getClientTelegramProfile(client);
    const nextTelegram = {
      ...currentTelegram,
      notificationsEnabled: enabled
    };

    try {
      await setDoc(doc(db, "users", client.id), {
        telegram: nextTelegram,
        telegramNotificationsEnabled: enabled
      }, { merge: true });

      setAdminSelectedClient((prev) => prev?.id === client.id ? { ...prev, telegram: nextTelegram, telegramNotificationsEnabled: enabled } : prev);
      setUsersList((prev) => prev.map((item) => (
        item.id === client.id ? { ...item, telegram: nextTelegram, telegramNotificationsEnabled: enabled } : item
      )));
      setAdminClientStatus(enabled ? "Telegram-уведомления включены." : "Telegram-уведомления выключены.");
    } catch (error) {
      console.error("Ошибка Telegram notifications:", error);
      setAdminClientStatus("Не получилось обновить Telegram-уведомления.");
    }
  }

  function getAdminClientProfile(client = {}) {
    return client.profile || client.aiNutritionProfile || client.bodyMetrics || client;
  }

  function getAdminClientGoalLabel(goal = "") {
    return getAiNutritionGoalLabel(goal || "recomp");
  }

  function getAdminClientTrainingDaysText(profile = {}) {
    const selected = getAiNutritionTrainingDays(profile);
    if (!selected.length) return "—";

    return AI_NUTRITION_WEEK_DAYS
      .filter((day) => selected.includes(day.id))
      .map((day) => day.short)
      .join(", ");
  }

  function getAdminNutritionDaysList(nutritionState = null) {
    return Object.entries(nutritionState?.days || {})
      .map(([date, day]) => {
        const totals = (day.foods || []).reduce(
          (sum, item) => ({
            calories: sum.calories + (Number(item.calories) || 0),
            protein: sum.protein + (Number(item.protein) || 0),
            fat: sum.fat + (Number(item.fat) || 0),
            carbs: sum.carbs + (Number(item.carbs) || 0)
          }),
          { calories: 0, protein: 0, fat: 0, carbs: 0 }
        );

        return {
          date,
          foods: day.foods || [],
          totals,
          score: buildAiNutritionDayModel({ ...defaultNutritionState, ...(nutritionState || {}) }, day, adminClientHistory).score
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function getAdminWorkoutProgressList(historyList = []) {
    const map = {};

    historyList.forEach((item) => {
      (item.exercises || []).forEach((exercise) => {
        const bestWeight = (exercise.sets || []).reduce((best, set) => {
          const weight = parseWorkoutWeightValue(set.weight || set.aiSuggestedWeight);
          return Math.max(best, weight);
        }, 0);

        if (!bestWeight) return;

        if (!map[exercise.name]) {
          map[exercise.name] = [];
        }

        map[exercise.name].push({
          date: item.date,
          weight: bestWeight
        });
      });
    });

    return Object.entries(map)
      .map(([name, points]) => ({
        name,
        points: points.slice(0, 8).reverse(),
        max: Math.max(...points.map((point) => point.weight))
      }))
      .sort((a, b) => b.max - a.max)
      .slice(0, 6);
  }

  function getAdminWeightPoints(client = {}) {
    const profile = getAdminClientProfile(client);
    const currentWeight = Number(profile?.weight || client?.weight || 0);
    const historyPoints = Array.isArray(client?.weightHistory) ? client.weightHistory : [];

    if (historyPoints.length) {
      return historyPoints
        .map((item) => ({ date: item.date || "", weight: Number(item.weight) || 0 }))
        .filter((item) => item.weight > 0)
        .slice(-8);
    }

    return currentWeight > 0 ? [{ date: "сейчас", weight: currentWeight }] : [];
  }

  function getAdminRecommendations(client, historyList, nutritionState) {
    const profile = getAdminClientProfile(client);
    const days = getAdminNutritionDaysList(nutritionState);
    const today = days[0];
    const badFeedback = historyList.filter((item) => item.postWorkoutFeedback?.id === "bad").length;
    const lastWorkoutDate = historyList[0]?.date ? new Date(historyList[0].date) : null;
    const daysSinceWorkout = lastWorkoutDate ? Math.round((Date.now() - lastWorkoutDate.getTime()) / (24 * 60 * 60 * 1000)) : null;
    const proteinGoal = Number(nutritionState?.goals?.protein || defaultNutritionState.goals.protein);
    const proteinToday = Number(today?.totals?.protein || 0);

    const recommendations = [];

    if (badFeedback >= 2) {
      recommendations.push("Снизить нагрузку на 1 неделю: у клиента несколько плохих feedback.");
    }

    if (proteinToday > 0 && proteinToday < proteinGoal * 0.7) {
      recommendations.push("Добавить белок: сегодня заметно меньше цели.");
    }

    if (daysSinceWorkout !== null && daysSinceWorkout >= 5) {
      recommendations.push("Клиент давно не тренировался — стоит написать и упростить вход в тренировку.");
    }

    if (!profile?.goal) {
      recommendations.push("Обновить анкету/AI-план: не заполнена цель клиента.");
    }

    if (!recommendations.length) {
      recommendations.push("Клиент выглядит стабильно: можно продолжать текущий план.");
    }

    return recommendations;
  }

  function exportAdminClientCsv() {
    if (!adminSelectedClient) {
      setAdminClientStatus("Сначала выбери клиента.");
      return;
    }

    const nutritionDays = getAdminNutritionDaysList(adminClientNutrition);
    const rows = [
      ["type", "date", "name", "calories", "protein", "fat", "carbs", "duration", "feedback"].join(",")
    ];

    adminClientHistory.forEach((item) => {
      rows.push([
        "workout",
        item.date || "",
        `"${String(item.workout || "Тренировка").replaceAll('"', '""')}"`,
        "",
        "",
        "",
        "",
        item.durationSeconds || "",
        item.postWorkoutFeedback?.title || item.readiness?.title || ""
      ].join(","));
    });

    nutritionDays.forEach((day) => {
      rows.push([
        "nutrition",
        day.date,
        '"day totals"',
        Math.round(day.totals.calories),
        Math.round(day.totals.protein),
        Math.round(day.totals.fat),
        Math.round(day.totals.carbs),
        "",
        `score ${day.score}`
      ].join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${adminSelectedClient.email || adminSelectedClient.name || "client"}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadAdminTrainingTemplates() {
    try {
      const snapshot = await getDocs(collection(db, "trainingTemplates"));
      const templates = [];
      snapshot.forEach((templateDoc) => {
        templates.push({ id: templateDoc.id, ...templateDoc.data() });
      });
      templates.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));
      setAdminTrainingTemplates(templates);
    } catch (error) {
      console.error("Ошибка загрузки шаблонов:", error);
    }
  }

  async function createAdminTemplateFromCurrentPlan() {
    const name = adminTemplateName.trim() || `Шаблон ${new Date().toLocaleDateString("ru-RU")}`;
    const id = `template_${Date.now()}`;

    try {
      await setDoc(doc(db, "trainingTemplates", id), {
        name,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || ADMIN_EMAIL,
        workouts: plan.workouts || []
      });

      setAdminTemplateName("");
      setAdminSelectedTemplateId(id);
      await loadAdminTrainingTemplates();
      setAdminClientStatus("Шаблон программы создан.");
    } catch (error) {
      console.error("Ошибка создания шаблона:", error);
      setAdminClientStatus("Не получилось создать шаблон.");
    }
  }

  async function clearClientAssignedWorkouts(clientId) {
    if (!clientId) return 0;

    let deletedCount = 0;

    // Hard replace: remove every old workout document before assigning a new program.
    // We intentionally do this in two passes to avoid stale leftovers after previous editor versions.
    for (let pass = 0; pass < 2; pass += 1) {
      const currentWorkoutsSnapshot = await getDocs(collection(db, "users", clientId, "workouts"));

      if (currentWorkoutsSnapshot.empty) break;

      for (const workoutDoc of currentWorkoutsSnapshot.docs) {
        await deleteDoc(doc(db, "users", clientId, "workouts", workoutDoc.id));
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  function buildClientWorkoutsFromTemplate(template = {}) {
    return (template.workouts || []).map((workoutItem, workoutIndex) => ({
      id: workoutItem.id || `assigned_workout_${workoutIndex + 1}_${Date.now()}`,
      name: workoutItem.name || `Тренировка ${workoutIndex + 1}`,
      blockId: workoutItem.blockId || "",
      blockName: workoutItem.blockName || "",
      weekId: workoutItem.weekId || "",
      weekName: workoutItem.weekName || "",
      order: Number(workoutItem.order || workoutItem.sortOrder || workoutIndex + 1),
      sortOrder: Number(workoutItem.sortOrder || workoutItem.order || workoutIndex + 1),
      exercises: (workoutItem.exercises || []).map((exercise, exerciseIndex) => ({
        id: exercise.id || `exercise_${workoutIndex + 1}_${exerciseIndex + 1}`,
        name: exercise.name || "Упражнение",
        video: exercise.video || "",
        sets: Array.isArray(exercise.sets) && exercise.sets.length
          ? exercise.sets.map((set) => ({
              reps: Number(set.reps) || 8,
              weight: String(set.weight ?? "")
            }))
          : [{ reps: exercise.name?.includes("Пресс") ? 15 : 8, weight: "" }]
      }))
    }));
  }

  async function assignAdminTemplateToClient(clientId = selectedUserId, templateId = adminSelectedTemplateId) {
    const template = adminTrainingTemplates.find((item) => item.id === templateId);

    if (!clientId || !template) {
      setAdminClientStatus("Выбери клиента и шаблон.");
      return;
    }

    try {
      const deletedCount = await clearClientAssignedWorkouts(clientId);
      const nextWorkouts = buildClientWorkoutsFromTemplate(template);

      for (const workoutItem of nextWorkouts) {
        await setDoc(doc(db, "users", clientId, "workouts", workoutItem.id), {
          ...workoutItem,
          assignedProgramId: template.id,
          assignedProgramName: template.name,
          assignedAt: new Date().toISOString(),
          assignedBy: auth.currentUser?.uid || ""
        });
      }

      await setDoc(doc(db, "users", clientId), {
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramAt: new Date().toISOString(),
        assignedWorkoutCount: nextWorkouts.length
      }, { merge: true });

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }

      setAdminClientStatus(`Назначено ${nextWorkouts.length} тренировок. Старые удалены: ${deletedCount}.`);
    } catch (error) {
      console.error("Ошибка назначения шаблона:", error);
      setAdminClientStatus("Не получилось назначить шаблон.");
    }
  }

  async function clearClientProgram(clientId = selectedUserId) {
    if (!clientId) {
      setAdminClientStatus("Выбери клиента.");
      return;
    }

    const confirmed = window.confirm("Сбросить все назначенные тренировки клиента? У клиента будет пустая программа.");

    if (!confirmed) return;

    try {
      await clearClientAssignedWorkouts(clientId);
      await setDoc(doc(db, "users", clientId), {
        assignedProgramId: "",
        assignedProgramName: "",
        assignedProgramAt: new Date().toISOString(),
        assignedWorkoutCount: 0
      }, { merge: true });

      setPlan({ workouts: [] });
      setAdminClientStatus("Программа клиента сброшена.");
    } catch (error) {
      console.error("Ошибка сброса программы клиента:", error);
      setAdminClientStatus("Не получилось сбросить программу клиента.");
    }
  }

  async function assignSavedProgramToClient(clientId = selectedUserId, templateId = adminSelectedTemplateId) {
    const template = adminTrainingTemplates.find((item) => item.id === templateId);

    if (!clientId || !template) {
      setAdminClientStatus("Выбери клиента и сохранённую программу.");
      return;
    }

    const nextWorkouts = buildClientWorkoutsFromTemplate(template);
    const confirmed = window.confirm(
      `Назначить клиенту программу “${template.name}”? Старые тренировки будут полностью удалены, будет назначено ${nextWorkouts.length} тренировок.`
    );

    if (!confirmed) return;

    try {
      const deletedCount = await clearClientAssignedWorkouts(clientId);

      for (const workoutItem of nextWorkouts) {
        await setDoc(doc(db, "users", clientId, "workouts", workoutItem.id), {
          ...workoutItem,
          assignedProgramId: template.id,
          assignedProgramName: template.name,
          assignedAt: new Date().toISOString(),
          assignedBy: auth.currentUser?.uid || ""
        });
      }

      await setDoc(doc(db, "users", clientId), {
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramAt: new Date().toISOString(),
        assignedWorkoutCount: nextWorkouts.length
      }, { merge: true });

      setAdminClientStatus(`Программа “${template.name}” назначена: ${nextWorkouts.length} тренировок. Старые удалены: ${deletedCount}.`);

      setAdminSelectedClient((prev) => prev?.id === clientId ? {
        ...prev,
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramAt: new Date().toISOString(),
        assignedWorkoutCount: nextWorkouts.length
      } : prev);

      setUsersList((prev) => prev.map((client) => (
        client.id === clientId ? {
          ...client,
          assignedProgramId: template.id,
          assignedProgramName: template.name,
          assignedProgramAt: new Date().toISOString(),
          assignedWorkoutCount: nextWorkouts.length
        } : client
      )));

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }
    } catch (error) {
      console.error("Ошибка назначения сохранённой программы:", error);
      setAdminClientStatus("Не получилось назначить сохранённую программу.");
    }
  }

  async function copyCurrentProgramToClient() {
    if (!adminCopyTargetUserId) {
      setAdminClientStatus("Выбери клиента для копирования.");
      return;
    }

    try {
      for (const workoutItem of plan.workouts || []) {
        await setDoc(doc(db, "users", adminCopyTargetUserId, "workouts", workoutItem.id), {
          name: workoutItem.name,
          exercises: (workoutItem.exercises || []).map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            video: exercise.video || "",
            sets: makeThreeSets(exercise.sets, exercise.name?.includes("Пресс") ? 15 : 8)
          }))
        }, { merge: true });
      }

      setAdminClientStatus("Программа скопирована другому клиенту.");
    } catch (error) {
      console.error("Ошибка копирования программы:", error);
      setAdminClientStatus("Не получилось скопировать программу.");
    }
  }

  async function saveAdminTrainerNote() {
    if (!adminSelectedClient?.id) {
      setAdminClientStatus("Сначала выбери клиента.");
      return;
    }

    try {
      await setDoc(doc(db, "users", adminSelectedClient.id), {
        trainerNote: adminTrainerNote,
        trainerNoteUpdatedAt: new Date().toISOString()
      }, { merge: true });

      setAdminSelectedClient((prev) => prev ? { ...prev, trainerNote: adminTrainerNote } : prev);
      setUsersList((prev) => prev.map((client) => (
        client.id === adminSelectedClient.id ? { ...client, trainerNote: adminTrainerNote } : client
      )));
      setAdminClientStatus("Заметка тренера сохранена.");
    } catch (error) {
      console.error("Ошибка сохранения заметки:", error);
      setAdminClientStatus("Не получилось сохранить заметку.");
    }
  }

  async function deleteClientEverywhereFromAdminPanel(client) {
    if (!client?.id) return;

    const confirmed = window.confirm(`Полностью удалить клиента ${client.email || client.name || client.id}? Будет попытка удалить Auth через Cloud Function и профиль из Firestore.`);
    if (!confirmed) return;

    try {
      const response = await fetch("/api/admin/deleteUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: client.id })
      });

      if (!response.ok) {
        throw new Error("Cloud Function deleteUser недоступна");
      }

      await deleteDoc(doc(db, "users", client.id));
      setAdminClientStatus("Клиент удалён из Firebase Auth и Firestore.");
      await loadUsers();
    } catch (error) {
      console.error("Полное удаление Auth недоступно:", error);
      await deleteClientFromAdminPanel(client);
      setAdminClientStatus("Auth-удаление требует Cloud Function. Профиль Firestore удалён, Auth мог остаться.");
    }
  }

  async function copyAdminSubcollection(sourceUid, targetUid, collectionName) {
    const snapshot = await getDocs(collection(db, "users", sourceUid, collectionName));

    for (const sourceDoc of snapshot.docs) {
      await setDoc(
        doc(db, "users", targetUid, collectionName, sourceDoc.id),
        {
          ...sourceDoc.data(),
          migratedFrom: sourceUid,
          migratedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    return snapshot.size;
  }

  async function transferClientDataBetweenAccounts(fromUidOverride = null, toUidOverride = null) {
    if (!canUseTrainerFeatures()) {
      setAdminTransferStatus("Перенос может делать только админ.");
      return;
    }

    const transferFromUid = fromUidOverride || adminTransferFromUid;
    const transferToUid = toUidOverride || adminTransferToUid;

    if (!transferFromUid || !transferToUid) {
      setAdminTransferStatus("Выбери источник и клиента-получателя.");
      return;
    }

    if (transferFromUid === transferToUid) {
      setAdminTransferStatus("Источник и получатель не должны совпадать.");
      return;
    }

    const sourceUser = adminAllUsersList.find((item) => item.id === transferFromUid);
    const targetUser = usersList.find((item) => item.id === transferToUid);

    const confirmed = window.confirm(
      `Перенести данные с ${sourceUser?.email || transferFromUid} на ${targetUser?.email || adminTransferToUid}? Данные получателя будут дополнены/обновлены.`
    );

    if (!confirmed) return;

    setAdminTransferLoading(true);
    setAdminTransferStatus("Переношу данные...");

    try {
      const [sourceSnap, targetSnap] = await Promise.all([
        getDoc(doc(db, "users", transferFromUid)),
        getDoc(doc(db, "users", transferToUid))
      ]);

      if (!sourceSnap.exists()) {
        setAdminTransferStatus("Источник не найден в Firestore.");
        setAdminTransferLoading(false);
        return;
      }

      const sourceData = sourceSnap.data() || {};
      const targetData = targetSnap.exists() ? targetSnap.data() || {} : {};
      const {
        role: _sourceRole,
        createdBy: _sourceCreatedBy,
        createdAt: _sourceCreatedAt,
        email: _sourceEmail,
        ...safeSourceData
      } = sourceData;

      await setDoc(doc(db, "users", transferToUid), {
        ...safeSourceData,
        email: targetData.email || targetUser?.email || "",
        name: targetData.name || targetUser?.name || safeSourceData.name || "",
        role: "client",
        migratedFromUid: transferFromUid,
        migratedFromEmail: sourceData.email || sourceUser?.email || "",
        migratedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const copied = {
        workouts: await copyAdminSubcollection(transferFromUid, transferToUid, "workouts"),
        history: await copyAdminSubcollection(transferFromUid, transferToUid, "history"),
        nutrition: await copyAdminSubcollection(transferFromUid, transferToUid, "nutrition")
      };

      if (transferFromUid === auth.currentUser?.uid) {
        await setDoc(doc(db, "users", transferFromUid), {
          role: "admin",
          email: auth.currentUser?.email || ADMIN_EMAIL,
          adminOnly: true,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      await loadUsers();

      const freshTarget = {
        ...(targetUser || {}),
        id: transferToUid,
        email: targetData.email || targetUser?.email || ""
      };

      await loadAdminClientOverview(freshTarget);

      setAdminTransferStatus(
        `Готово: тренировки ${copied.workouts}, история ${copied.history}, питание ${copied.nutrition}. Получатель остался client.`
      );
    } catch (error) {
      console.error("Ошибка переноса данных:", error);
      setAdminTransferStatus("Не получилось перенести данные. Проверь Firestore rules и выбранные аккаунты.");
    } finally {
      setAdminTransferLoading(false);
    }
  }

  
  async function updateUserTrainerRole(targetUser, makeTrainer = true) {
    if (!canUseAdminFeatures() || !targetUser?.id) {
      setAdminClientStatus("Только админ может назначать роль тренера.");
      return;
    }

    const nextRole = makeTrainer ? "trainer" : "client";

    try {
      await setDoc(doc(db, "users", targetUser.id), {
        role: nextRole,
        trainerRoleUpdatedAt: new Date().toISOString()
      }, { merge: true });

      setUsersList((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, role: nextRole } : item));
      setAdminAllUsersList((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, role: nextRole } : item));
      setAdminSelectedClient((prev) => prev?.id === targetUser.id ? { ...prev, role: nextRole } : prev);
      setAdminClientStatus(makeTrainer ? "Роль тренера назначена." : "Роль тренера снята.");
    } catch (error) {
      console.error("Trainer role update error:", error);
      setAdminClientStatus("Не удалось изменить роль тренера. Проверь права Firestore.");
    }
  }

async function loadUsers() {
    if (!canUseTrainerFeatures()) return;

    const sortUsers = (items = []) => [...items].sort((a, b) =>
      String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "ru")
    );

    const normalizeTrainerClient = (item = {}) => ({
      ...item,
      role: item.role || "client"
    });

    const applyUsers = (items = []) => {
      const uniqueUsers = new Map();
      items.forEach((item) => {
        if (!item?.id) return;
        uniqueUsers.set(item.id, normalizeTrainerClient(item));
      });

      const users = sortUsers(Array.from(uniqueUsers.values()));
      const clients = users.filter((item) => (item.role || "client") === "client" && item.email !== ADMIN_EMAIL);

      setAdminAllUsersList(users);
      setUsersList(clients);

      if (!adminSelectedClient && clients.length) {
        setSelectedUserId(clients[0].id);
        setAdminSelectedClient(clients[0]);
      }

      return clients;
    };

    try {
      if (canUseAdminFeatures()) {
        const snapshot = await getDocs(collection(db, "users"));
        const users = [];

        snapshot.forEach((userDoc) => {
          users.push({
            id: userDoc.id,
            ...userDoc.data()
          });
        });

        applyUsers(users);
        return;
      }

      const trainerUid = auth.currentUser?.uid || user?.uid || "";
      const trainerEmail = String(auth.currentUser?.email || user?.email || "").toLowerCase();
      const users = [];

      const trainerQueries = [
        trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("trainerId", "==", trainerUid)) : null,
        trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("assignedTrainerId", "==", trainerUid)) : null,
        trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("coachId", "==", trainerUid)) : null,
        trainerUid ? query(collection(db, "users"), where("role", "==", "client"), where("createdByUid", "==", trainerUid)) : null,
        trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("trainerEmail", "==", trainerEmail)) : null,
        trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("assignedTrainerEmail", "==", trainerEmail)) : null,
        trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("coachEmail", "==", trainerEmail)) : null,
        trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("createdByEmail", "==", trainerEmail)) : null,
        trainerEmail ? query(collection(db, "users"), where("role", "==", "client"), where("createdBy", "==", trainerEmail)) : null
      ].filter(Boolean);

      const queryResults = await Promise.allSettled(trainerQueries.map((trainerQuery) => getDocs(trainerQuery)));
      queryResults.forEach((result) => {
        if (result.status !== "fulfilled") return;
        result.value.forEach((userDoc) => {
          users.push({
            id: userDoc.id,
            ...userDoc.data()
          });
        });
      });

      // Надёжный fallback: если Firestore rules не разрешают trainer-запросы по общей коллекции users,
      // читаем личный индекс тренера users/{trainerUid}/trainerClients и показываем клиентов оттуда.
      if (trainerUid) {
        const linkedClientsSnap = await getDocs(collection(db, "users", trainerUid, "trainerClients"));
        const linkedClientDocs = [];

        linkedClientsSnap.forEach((linkDoc) => {
          linkedClientDocs.push({ id: linkDoc.id, ...linkDoc.data() });
        });

        const linkedProfiles = await Promise.allSettled(linkedClientDocs.map(async (linkedClient) => {
          const clientId = linkedClient.clientId || linkedClient.uid || linkedClient.id;
          if (!clientId) return null;

          try {
            const clientDoc = await getDoc(doc(db, "users", clientId));
            if (clientDoc.exists()) {
              return { id: clientDoc.id, ...clientDoc.data() };
            }
          } catch (profileReadError) {
            console.warn("Trainer linked client profile read failed:", profileReadError);
          }

          return {
            ...linkedClient,
            id: clientId,
            uid: clientId,
            clientId,
            role: linkedClient.role || "client",
            name: linkedClient.name || linkedClient.email || "Клиент",
            email: linkedClient.email || "",
            trainerId: linkedClient.trainerId || trainerUid,
            trainerEmail: linkedClient.trainerEmail || trainerEmail
          };
        }));

        linkedProfiles.forEach((result) => {
          if (result.status === "fulfilled" && result.value?.id) {
            users.push(result.value);
          }
        });
      }

      applyUsers(users);
    } catch (err) {
      console.log("Ошибка загрузки пользователей:", err);
      setAdminClientStatus("Не получилось загрузить клиентов. Проверь права Firestore для роли тренера.");
    }
  }

  function buildAdminClientNutritionStateFromRoot(clientData = {}, nutritionState = null) {
    const rootGoals = clientData?.nutritionGoals || clientData?.nutritionPlan || {};
    const aiPlan = clientData?.aiNutritionPlan || nutritionState?.aiNutritionPlan || null;
    const aiStart = aiPlan?.start || aiPlan?.trainingDay || aiPlan?.weeks?.[0] || {};
    const mirroredNutrition = clientData?.nutritionState || clientData?.adminClientNutrition || null;
    const nutritionDays = nutritionState?.days || mirroredNutrition?.days || clientData?.nutrition?.days || clientData?.nutritionDays || {};

    return {
      ...(mirroredNutrition || {}),
      ...(nutritionState || {}),
      goals: {
        ...defaultNutritionState.goals,
        ...(mirroredNutrition?.goals || {}),
        ...(nutritionState?.goals || {}),
        ...rootGoals,
        calories: Number(rootGoals.calories || nutritionState?.goals?.calories || mirroredNutrition?.goals?.calories || aiStart.calories || defaultNutritionState.goals.calories) || defaultNutritionState.goals.calories,
        protein: Number(rootGoals.protein || nutritionState?.goals?.protein || mirroredNutrition?.goals?.protein || aiStart.protein || defaultNutritionState.goals.protein) || defaultNutritionState.goals.protein,
        fat: Number(rootGoals.fat || nutritionState?.goals?.fat || mirroredNutrition?.goals?.fat || aiStart.fat || defaultNutritionState.goals.fat) || defaultNutritionState.goals.fat,
        carbs: Number(rootGoals.carbs || nutritionState?.goals?.carbs || mirroredNutrition?.goals?.carbs || aiStart.carbs || defaultNutritionState.goals.carbs) || defaultNutritionState.goals.carbs
      },
      days: nutritionDays,
      aiNutritionPlan: aiPlan || null,
      nutritionPlan: clientData?.nutritionPlan || nutritionState?.nutritionPlan || mirroredNutrition?.nutritionPlan || null
    };
  }

  function getTrainerClientMirrorPayload(clientData = {}, nutritionState = null) {
    const clientId = clientData?.id || clientData?.uid || clientData?.clientId || "";
    const trainerId = clientData?.trainerId || clientData?.assignedTrainerId || clientData?.coachId || "";
    const trainerEmail = String(clientData?.trainerEmail || clientData?.assignedTrainerEmail || clientData?.coachEmail || "").toLowerCase();
    const mirroredNutrition = buildAdminClientNutritionStateFromRoot(clientData, nutritionState);

    return {
      clientId,
      uid: clientId,
      id: clientId,
      email: clientData?.email || "",
      name: clientData?.name || clientData?.email || "Клиент",
      role: "client",
      trainerId,
      assignedTrainerId: clientData?.assignedTrainerId || trainerId,
      coachId: clientData?.coachId || trainerId,
      trainerEmail,
      assignedTrainerEmail: String(clientData?.assignedTrainerEmail || trainerEmail || "").toLowerCase(),
      coachEmail: String(clientData?.coachEmail || trainerEmail || "").toLowerCase(),
      createdBy: clientData?.createdBy || clientData?.createdByEmail || "",
      createdByEmail: clientData?.createdByEmail || clientData?.createdBy || "",
      createdByUid: clientData?.createdByUid || "",
      profile: clientData?.profile || {},
      aiNutritionProfile: clientData?.aiNutritionProfile || clientData?.profile || {},
      aiNutritionPlan: clientData?.aiNutritionPlan || null,
      nutritionPlan: clientData?.nutritionPlan || null,
      nutritionGoals: clientData?.nutritionGoals || mirroredNutrition?.goals || null,
      nutritionState: mirroredNutrition,
      assignedProgramId: clientData?.assignedProgramId || "",
      assignedProgramName: clientData?.assignedProgramName || "",
      assignedWorkoutCount: clientData?.assignedWorkoutCount || 0,
      workoutCalendar: clientData?.workoutCalendar || null,
      trainingDays: clientData?.trainingDays || clientData?.workoutCalendar?.trainingDays || [],
      workoutTime: clientData?.workoutTime || clientData?.workoutCalendar?.workoutTime || "",
      trainerNote: clientData?.trainerNote || "",
      telegram: clientData?.telegram || null,
      telegramConnected: clientData?.telegramConnected || false,
      telegramUsername: clientData?.telegramUsername || "",
      telegramDisplayName: clientData?.telegramDisplayName || "",
      telegramNotificationsEnabled: clientData?.telegramNotificationsEnabled || false,
      updatedAt: new Date().toISOString()
    };
  }

  async function mirrorClientForTrainer(clientData = {}, nutritionState = null) {
    const clientId = clientData?.id || clientData?.uid || "";
    const trainerId = clientData?.trainerId || clientData?.assignedTrainerId || clientData?.coachId || "";
    if (!clientId || !trainerId) return;

    try {
      await setDoc(
        doc(db, "users", trainerId, "trainerClients", clientId),
        getTrainerClientMirrorPayload({ ...clientData, id: clientId }, nutritionState),
        { merge: true }
      );
    } catch (mirrorError) {
      console.warn("Trainer client mirror write failed:", mirrorError);
    }
  }

  async function loadAdminClientOverview(client, openClientPage = false) {
    if (!client?.id) return;

    setSelectedUserId(client.id);
    setAdminSelectedClient(client);
    setAdminClientTab("overview");
    if (openClientPage) {
      setAdminClientPageOpen(true);
      setAdminUsersSelectedTab("overview");
    }
    setAdminClientLoading(true);
    setAdminClientStatus("");

    try {
      let freshClient = { ...client };
      const currentTrainerUid = auth.currentUser?.uid || user?.uid || "";

      try {
        const clientDocSnap = await getDoc(doc(db, "users", client.id));
        if (clientDocSnap.exists()) {
          freshClient = { id: clientDocSnap.id, ...client, ...clientDocSnap.data() };
        }
      } catch (clientDocError) {
        console.warn("Полный документ клиента недоступен, пробую trainerClients mirror:", clientDocError);

        if (currentTrainerUid) {
          try {
            const linkedClientSnap = await getDoc(doc(db, "users", currentTrainerUid, "trainerClients", client.id));
            if (linkedClientSnap.exists()) {
              freshClient = {
                ...client,
                ...linkedClientSnap.data(),
                id: client.id,
                uid: client.id,
                clientId: client.id,
                role: "client"
              };
            }
          } catch (linkedClientReadError) {
            console.warn("Trainer client mirror read failed:", linkedClientReadError);
          }
        }
      }

      setAdminSelectedClient(freshClient);
      setUsersList((prev) => prev.map((item) => item.id === freshClient.id ? { ...item, ...freshClient } : item));
      setAdminAllUsersList((prev) => prev.map((item) => item.id === freshClient.id ? { ...item, ...freshClient } : item));

      let historySnap = null;
      let nutritionSnap = null;
      let measurementsSnap = null;

      try {
        historySnap = await getDocs(collection(db, "users", client.id, "history"));
      } catch (historyError) {
        console.error("Ошибка загрузки истории клиента:", historyError);
        historySnap = null;
      }

      try {
        nutritionSnap = await getDoc(doc(db, "users", client.id, "nutrition", "state"));
      } catch (nutritionError) {
        console.error("Ошибка загрузки питания клиента:", nutritionError);
        nutritionSnap = null;
      }

      try {
        measurementsSnap = await getDocs(collection(db, "users", client.id, "measurements"));
      } catch (measurementError) {
        console.error("Ошибка загрузки замеров клиента:", measurementError);
        measurementsSnap = null;
      }

      const clientHistory = [];
      if (historySnap?.forEach) {
        historySnap.forEach((historyDoc) => {
          clientHistory.push({ id: historyDoc.id, ...historyDoc.data() });
        });
      }

      clientHistory.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const clientMeasurements = [];
      if (measurementsSnap?.forEach) {
        measurementsSnap.forEach((measurementDoc) => {
          clientMeasurements.push({ id: measurementDoc.id, ...measurementDoc.data() });
        });
      }
      clientMeasurements.sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

      const nutritionState = nutritionSnap?.exists?.() ? nutritionSnap.data() : null;
      const mergedNutritionState = buildAdminClientNutritionStateFromRoot(freshClient, nutritionState);
      const fullClientForView = {
        ...freshClient,
        nutritionGoals: freshClient.nutritionGoals || mergedNutritionState.goals,
        nutritionPlan: freshClient.nutritionPlan || mergedNutritionState.nutritionPlan,
        aiNutritionPlan: freshClient.aiNutritionPlan || mergedNutritionState.aiNutritionPlan
      };

      setAdminSelectedClient(fullClientForView);
      setUsersList((prev) => prev.map((item) => item.id === fullClientForView.id ? { ...item, ...fullClientForView } : item));
      setAdminAllUsersList((prev) => prev.map((item) => item.id === fullClientForView.id ? { ...item, ...fullClientForView } : item));
      await mirrorClientForTrainer(fullClientForView, mergedNutritionState);

      setAdminClientHistory(clientHistory);
      setAdminSelectedHistoryIds([]);
      setAdminClientNutrition(mergedNutritionState);
      setAdminClientMeasurements(clientMeasurements);
      setAdminTrainerNote(freshClient.trainerNote || "");
      setAdminCalendarDraft(getDefaultAdminCalendar(freshClient));
      await loadAdminTrainingTemplates();
    } catch (error) {
      console.error("Ошибка загрузки данных клиента:", error);
      setAdminClientStatus("Не получилось загрузить данные клиента.");
    } finally {
      setAdminClientLoading(false);
    }
  }

  function toggleAdminSelectedHistoryId(workoutId) {
    setAdminSelectedHistoryIds((prev) => (
      prev.includes(workoutId)
        ? prev.filter((id) => id !== workoutId)
        : [...prev, workoutId]
    ));
  }

  function toggleAdminSelectAllHistory() {
    const visibleIds = adminClientHistory.slice(0, 20).map((item) => item.id).filter(Boolean);

    setAdminSelectedHistoryIds((prev) => (
      visibleIds.every((id) => prev.includes(id))
        ? prev.filter((id) => !visibleIds.includes(id))
        : [...new Set([...prev, ...visibleIds])]
    ));
  }

  async function deleteSelectedAdminClientHistory(client = adminSelectedClient) {
    if (!client?.id || !adminSelectedHistoryIds.length) {
      setAdminClientStatus("Выбери тренировки для удаления.");
      return;
    }

    const confirmed = window.confirm(`Удалить выбранные тренировки: ${adminSelectedHistoryIds.length}? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setAdminDeletingWorkoutId("bulk");
    setAdminClientStatus("");

    try {
      await Promise.all(
        adminSelectedHistoryIds.map((workoutId) => deleteDoc(doc(db, "users", client.id, "history", workoutId)))
      );

      setAdminClientHistory((prev) => prev.filter((item) => !adminSelectedHistoryIds.includes(item.id)));

      if (selectedUserId === client.id) {
        setHistory((prev) => prev.filter((item) => !adminSelectedHistoryIds.includes(item.id)));
      }

      setAdminSelectedHistoryIds([]);
      setAdminClientStatus("Выбранные тренировки удалены.");
    } catch (error) {
      console.error("Ошибка удаления выбранных тренировок:", error);
      setAdminClientStatus("Не получилось удалить выбранные тренировки. Проверь права Firestore.");
    } finally {
      setAdminDeletingWorkoutId("");
    }
  }

  async function deleteAdminClientWorkoutHistory(workoutItem, client = adminSelectedClient) {
    if (!client?.id || !workoutItem?.id) {
      setAdminClientStatus("Не выбрана тренировка для удаления.");
      return;
    }

    const workoutName = workoutItem.workout || "тренировку";
    const confirmed = window.confirm(`Удалить "${workoutName}" из истории клиента? Это действие нельзя отменить.`);

    if (!confirmed) return;

    setAdminDeletingWorkoutId(workoutItem.id);
    setAdminClientStatus("");

    try {
      await deleteDoc(doc(db, "users", client.id, "history", workoutItem.id));

      setAdminClientHistory((prev) => prev.filter((item) => item.id !== workoutItem.id));

      if (selectedUserId === client.id) {
        setHistory((prev) => prev.filter((item) => item.id !== workoutItem.id));
      }

      setAdminClientStatus("Тренировка удалена из истории клиента.");
    } catch (error) {
      console.error("Ошибка удаления тренировки:", error);
      setAdminClientStatus("Не получилось удалить тренировку. Проверь права Firestore.");
    } finally {
      setAdminDeletingWorkoutId("");
    }
  }

  const ADMIN_CALENDAR_DAYS = [
    { id: "mon", title: "Пн", full: "Понедельник" },
    { id: "tue", title: "Вт", full: "Вторник" },
    { id: "wed", title: "Ср", full: "Среда" },
    { id: "thu", title: "Чт", full: "Четверг" },
    { id: "fri", title: "Пт", full: "Пятница" },
    { id: "sat", title: "Сб", full: "Суббота" },
    { id: "sun", title: "Вс", full: "Воскресенье" }
  ];

  function formatProfileWorkoutDate(dateValue) {
    if (!dateValue) return "Нет данных";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Нет данных";

    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long"
    });
  }

  function getProfileNextTrainingText(profile = {}, userData = {}) {
    const sourceCalendar = userData?.workoutCalendar || userData?.calendar || {};
    const trainingDays = Array.isArray(sourceCalendar.trainingDays) && sourceCalendar.trainingDays.length
      ? sourceCalendar.trainingDays
      : getAiNutritionTrainingDays(profile);

    const workoutTime = sourceCalendar.workoutTime || userData?.workoutTime || profile?.workoutTime || "13:00";

    if (!trainingDays.length) return `Не выбрано`;

    const dayOrder = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const todayIndex = new Date().getDay();

    let bestOffset = 8;
    let bestDayId = trainingDays[0];

    trainingDays.forEach((dayId) => {
      const targetIndex = dayOrder.indexOf(dayId);
      if (targetIndex === -1) return;

      let offset = targetIndex - todayIndex;
      if (offset <= 0) offset += 7;

      if (offset < bestOffset) {
        bestOffset = offset;
        bestDayId = dayId;
      }
    });

    const day = ADMIN_CALENDAR_DAYS.find((item) => item.id === bestDayId);
    return `${day?.title || bestDayId} · ${workoutTime}`;
  }

  function getDefaultAdminCalendar(client = {}) {
    const source = client.workoutCalendar || client.calendar || {};
    const profile = getAdminClientProfile(client);

    return {
      enabled: source.enabled !== false,
      reminderEnabled: source.reminderEnabled !== false,
      reminderTime: source.reminderTime || "19:00",
      workoutTime: source.workoutTime || client.workoutTime || profile?.workoutTime || "13:00",
      hourReminderEnabled: source.hourReminderEnabled === true,
      trainingDays: Array.isArray(source.trainingDays) && source.trainingDays.length
        ? source.trainingDays
        : Array.isArray(profile?.trainingDays) ? profile.trainingDays : [],
      daySettings: source.daySettings || source.scheduleByDay || {}
    };
  }

  function toggleAdminCalendarDay(dayId) {
    setAdminCalendarDraft((prev) => {
      const current = Array.isArray(prev.trainingDays) ? prev.trainingDays : [];
      const exists = current.includes(dayId);
      const nextTrainingDays = exists ? current.filter((item) => item !== dayId) : [...current, dayId];
      const nextDaySettings = { ...(prev.daySettings || {}) };

      if (!exists && !nextDaySettings[dayId]) {
        nextDaySettings[dayId] = {
          workoutTime: prev.workoutTime || "13:00",
          reminderTime: "19:00",
          hourReminderEnabled: prev.hourReminderEnabled === true
        };
      }

      return {
        ...prev,
        trainingDays: nextTrainingDays,
        daySettings: nextDaySettings
      };
    });
  }

  function updateAdminCalendarDaySetting(dayId, field, value) {
    setAdminCalendarDraft((prev) => ({
      ...prev,
      daySettings: {
        ...(prev.daySettings || {}),
        [dayId]: {
          workoutTime: prev.workoutTime || "13:00",
          reminderTime: "19:00",
          hourReminderEnabled: prev.hourReminderEnabled === true,
          ...((prev.daySettings || {})[dayId] || {}),
          [field]: value
        }
      }
    }));
  }

  async function saveAdminClientCalendar(client = adminSelectedClient) {
    if (!client?.id) return;

    setAdminCalendarSaving(true);
    setAdminClientStatus("");

    try {
      const nextCalendar = {
        enabled: adminCalendarDraft.enabled !== false,
        reminderEnabled: adminCalendarDraft.reminderEnabled !== false,
        reminderTime: adminCalendarDraft.reminderTime || "19:00",
        workoutTime: adminCalendarDraft.workoutTime || "13:00",
        hourReminderEnabled: adminCalendarDraft.hourReminderEnabled === true,
        trainingDays: Array.isArray(adminCalendarDraft.trainingDays) ? adminCalendarDraft.trainingDays : [],
        daySettings: Object.fromEntries(
          (Array.isArray(adminCalendarDraft.trainingDays) ? adminCalendarDraft.trainingDays : []).map((dayId) => [
            dayId,
            {
              workoutTime: adminCalendarDraft.daySettings?.[dayId]?.workoutTime || adminCalendarDraft.workoutTime || "13:00",
              reminderTime: "19:00",
              reminderBefore: adminCalendarDraft.daySettings?.[dayId]?.reminderBefore || adminCalendarDraft.daySettings?.[dayId]?.reminderTime || "1 день",
              hourReminderEnabled: adminCalendarDraft.daySettings?.[dayId]?.hourReminderEnabled === true
            }
          ])
        ),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", client.id), {
        workoutCalendar: nextCalendar,
        trainingDays: nextCalendar.trainingDays,
        workoutTime: nextCalendar.workoutTime,
        telegramNotificationsEnabled: nextCalendar.reminderEnabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setAdminSelectedClient((prev) => prev?.id === client.id ? {
        ...prev,
        workoutCalendar: nextCalendar,
        trainingDays: nextCalendar.trainingDays,
        workoutTime: nextCalendar.workoutTime,
        telegramNotificationsEnabled: nextCalendar.reminderEnabled
      } : prev);

      setUsersList((prev) => prev.map((item) => (
        item.id === client.id ? {
          ...item,
          workoutCalendar: nextCalendar,
          trainingDays: nextCalendar.trainingDays,
          workoutTime: nextCalendar.workoutTime,
          telegramNotificationsEnabled: nextCalendar.reminderEnabled
        } : item
      )));

      setAdminClientStatus("Календарь и Telegram-напоминания сохранены.");
    } catch (error) {
      console.error("Ошибка сохранения календаря:", error);
      setAdminClientStatus("Не получилось сохранить календарь.");
    } finally {
      setAdminCalendarSaving(false);
    }
  }

  async function sendAdminTestWorkoutReminder(client = adminSelectedClient) {
    if (!client?.id) {
      setAdminClientStatus("Сначала выбери клиента.");
      return;
    }

    setAdminCalendarTesting(true);
    setAdminClientStatus("Отправляю тестовое Telegram-напоминание...");

    try {
      const response = await fetch("/api/telegram/test-workout-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId: client.id
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Test reminder failed");
      }

      setAdminClientStatus("Тестовое Telegram-напоминание отправлено.");
    } catch (error) {
      console.error("Ошибка тестового Telegram-напоминания:", error);
      setAdminClientStatus("Не получилось отправить тестовое напоминание.");
    } finally {
      setAdminCalendarTesting(false);
    }
  }

  async function deleteClientFromAdminPanel(client) {
    if (!canUseTrainerFeatures()) {
      setAdminClientStatus("Удалять клиентов может только админ.");
      return;
    }

    if (!client?.id) return;

    const confirmed = window.confirm(`Удалить клиента ${client.email || client.name || client.id} из базы приложения? Аккаунт Firebase Auth может остаться активным.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "users", client.id));

      if (selectedUserId === client.id) {
        setSelectedUserId(null);
        setAdminSelectedClient(null);
        setAdminClientHistory([]);
        setAdminClientNutrition(null);
      }

      await loadUsers();
      setAdminClientStatus("Клиент удалён из базы приложения.");
    } catch (error) {
      console.error("Ошибка удаления клиента:", error);
      setAdminClientStatus("Не получилось удалить клиента.");
    }
  }

  function generateAdminPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const chars = Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
    const password = `${chars.join("")}!7`;
    setAdminNewUserPassword(password);
    return password;
  }

  async function createUserFromAdminPanel(event) {
    event?.preventDefault?.();

    if (!canUseTrainerFeatures()) {
      setAdminCreateUserStatus("Создавать клиентов может только админ или тренер.");
      return;
    }

    const email = adminNewUserEmail.trim().toLowerCase();
    const password = adminNewUserPassword.trim();
    const displayName = adminNewUserName.trim();

    if (!email || !email.includes("@")) {
      setAdminCreateUserStatus("Введи корректный email пользователя.");
      return;
    }

    if (!password || password.length < 6) {
      setAdminCreateUserStatus("Пароль должен быть минимум 6 символов.");
      return;
    }

    setAdminCreateUserLoading(true);
    setAdminCreateUserStatus("");
    setAdminCreatedCredentials(null);

    let secondaryApp = null;

    try {
      secondaryApp = initializeApp(auth.app.options, `admin-create-user-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const secondaryDb = getFirestore(secondaryApp);
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const createdUser = credential.user;

      const currentTrainerEmail = String(auth.currentUser?.email || user?.email || "").toLowerCase();
      const currentTrainerId = auth.currentUser?.uid || user?.uid || "";
      const createdAt = new Date().toISOString();
      const isTrainerCreator = currentUserRole === "trainer" && !canUseAdminFeatures();

      const clientPayload = {
        email,
        name: displayName || email.split("@")[0],
        role: "client",
        assignedProgramId: "",
        assignedProgramName: "",
        createdAt,
        updatedAt: createdAt,
        createdBy: currentTrainerEmail || ADMIN_EMAIL,
        createdByEmail: currentTrainerEmail || ADMIN_EMAIL,
        createdByUid: currentTrainerId || "",
        ...(isTrainerCreator ? {
          trainerId: currentTrainerId,
          assignedTrainerId: currentTrainerId,
          coachId: currentTrainerId,
          trainerEmail: currentTrainerEmail,
          assignedTrainerEmail: currentTrainerEmail,
          coachEmail: currentTrainerEmail
        } : {})
      };

      let savedClientProfile = false;

      try {
        await setDoc(doc(db, "users", createdUser.uid), clientPayload, { merge: true });
        savedClientProfile = true;
      } catch (primaryWriteError) {
        console.warn("Primary user profile write failed, trying secondary user context:", primaryWriteError);
      }

      if (!savedClientProfile) {
        await setDoc(doc(secondaryDb, "users", createdUser.uid), clientPayload, { merge: true });
      }

      if (currentTrainerId) {
        const trainerClientLink = {
          clientId: createdUser.uid,
          uid: createdUser.uid,
          email,
          name: displayName || email.split("@")[0],
          role: "client",
          trainerId: currentTrainerId,
          trainerEmail: currentTrainerEmail,
          assignedTrainerId: currentTrainerId,
          assignedTrainerEmail: currentTrainerEmail,
          createdAt,
          updatedAt: createdAt
        };

        try {
          await setDoc(doc(db, "users", currentTrainerId, "trainerClients", createdUser.uid), trainerClientLink, { merge: true });
        } catch (trainerLinkError) {
          console.warn("Trainer client link write failed:", trainerLinkError);
        }
      }

      await signOut(secondaryAuth);

      const createdClient = {
        id: createdUser.uid,
        ...clientPayload
      };

      setAdminCreatedCredentials({
        email,
        password,
        name: displayName || email.split("@")[0]
      });

      setAdminNewUserName("");
      setAdminNewUserEmail("");
      setAdminNewUserPassword("");
      setAdminCreateUserStatus(isTrainerCreator ? "Клиент создан и привязан к тренеру ✅" : "Клиент создан ✅");
      setAdminCreateClientModalOpen(false);
      setUsersList((prev) => [createdClient, ...prev.filter((item) => item.id !== createdClient.id)]);
      setAdminAllUsersList((prev) => [createdClient, ...prev.filter((item) => item.id !== createdClient.id)]);
      setSelectedUserId(createdClient.id);
      setAdminSelectedClient(createdClient);

      if (canUseAdminFeatures()) {
        await loadUsers();
      }
    } catch (error) {
      console.error("Ошибка создания пользователя:", error);

      const message = error?.code === "auth/email-already-in-use"
        ? "Пользователь с таким email уже существует."
        : error?.code === "auth/weak-password"
          ? "Пароль слишком слабый. Нужно минимум 6 символов."
          : error?.code === "permission-denied"
            ? "Клиент создан в Auth, но профиль не записался в Firestore. Нужно разрешить тренеру запись users/{clientId}."
            : "Не получилось создать пользователя. Проверь email/пароль и Firebase Auth.";

      setAdminCreateUserStatus(message);
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (_) {
          // ignore secondary app cleanup
        }
      }

      setAdminCreateUserLoading(false);
    }
  }

  async function loadHistory() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.log("Пользователь ещё не загружен");
      return;
    }

    setHistoryLoading(true);
    startPerformanceCheck("Firebase · history load");

    try {
      const snapshot = await getDocs(
        collection(db, "users", currentUser.uid, "history")
      );

      const workouts = [];

      snapshot.forEach((doc) => {
        workouts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

      setHistory(workouts);
      endPerformanceCheck("Firebase · history load", { records: workouts.length });
    } catch (err) {
      console.log("Ошибка загрузки истории:", err);
      showAppError("load", "Не получилось загрузить историю тренировок.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function requestDeleteOwnHistoryWorkout(workoutItem) {
    if (!workoutItem?.id) {
      showAppError("load", "Не выбрана тренировка для удаления.");
      return;
    }

    setHistorySwipeId("");
    setHistoryDeleteCandidate(workoutItem);
  }

  function closeHistoryDeleteConfirm() {
    if (historyDeletingId) return;
    setHistoryDeleteCandidate(null);
  }

  async function confirmDeleteOwnHistoryWorkout() {
    const workoutItem = historyDeleteCandidate;
    const currentUser = auth.currentUser;

    if (!currentUser || !workoutItem?.id) {
      showAppError("load", "Не выбрана тренировка для удаления.");
      setHistoryDeleteCandidate(null);
      return;
    }

    setHistoryDeletingId(workoutItem.id);

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "history", workoutItem.id));
      setHistory((prev) => prev.filter((item) => item.id !== workoutItem.id));
      setOpenHistoryKey((prev) => (prev === workoutItem.id ? null : prev));
      setHistoryDeleteCandidate(null);
      showAppError("savedLocal", "Тренировка удалена из истории.");
    } catch (error) {
      console.error("Ошибка удаления тренировки из истории:", error);
      showAppError("firebase", "Не получилось удалить тренировку. Проверь интернет или права Firebase.");
    } finally {
      setHistoryDeletingId("");
    }
  }

  function handleHistoryTouchStart(event, itemId) {
    setHistoryTouchStartX(event.touches?.[0]?.clientX ?? null);

    if (historySwipeId && historySwipeId !== itemId) {
      setHistorySwipeId("");
    }
  }

  function handleHistoryTouchEnd(event, item) {
    if (historyTouchStartX === null) return;

    const endX = event.changedTouches?.[0]?.clientX ?? historyTouchStartX;
    const diffX = endX - historyTouchStartX;

    setHistoryTouchStartX(null);

    if (diffX < -56) {
      setHistorySwipeId(item.id);
      return;
    }

    if (diffX > 38 && historySwipeId === item.id) {
      setHistorySwipeId("");
    }
  }

  async function loadNutritionFromFirebase(uid) {
    startPerformanceCheck("Firebase · nutrition load", { userId: String(uid || "").slice(0, 6) });

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

      endPerformanceCheck("Firebase · nutrition load", {
        days: Object.keys(mergedNutrition.days || {}).length,
        myFoods: Object.keys(mergedNutrition.myFoods || {}).length
      });
    } catch (error) {
      console.error("Nutrition load error", error);
      showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase", "Не получилось загрузить питание из Firebase. Показываю локальные данные.");
    } finally {
      setNutritionCloudReady(true);
    }
  }

  function centerExerciseDeck() {
    setTimeout(() => {
      if (deckRef.current) {
        deckRef.current.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    }, 80);
  }

  function goToPreviousExercise() {
    if (!workout) return;

    setOpenVideoId(null);
    setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
    setSwipeDirection("down");

    if (workoutStarted && currentExerciseIndex === 0) {
      setWorkoutStarted(false);
    } else if (workoutStarted) {
      setCurrentExerciseIndex((prev) => Math.max(prev - 1, 0));
    }

    centerExerciseDeck();

    setTimeout(() => {
      setSwipeDirection("");
    }, 360);
  }

  function goToNextExercise() {
    if (!workout) return;

    setOpenVideoId(null);
    setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
    setSwipeDirection("up");

    if (!workoutStarted) {
      setWorkoutStarted(true);
      setCurrentExerciseIndex(0);
    } else {
      setCurrentExerciseIndex((prev) =>
        Math.min(prev + 1, workout.exercises.length + 1)
      );
    }

    centerExerciseDeck();

    setTimeout(() => {
      setSwipeDirection("");
    }, 360);
  }

  function isInteractiveTarget(target) {
    return Boolean(
      target?.closest?.("input, textarea, select, button, video")
    );
  }

  function handleExerciseTouchStart() {
    touchStartY.current = null;
    setSwipeOffset(0);
  }

  function handleExerciseTouchMove() {
    touchStartY.current = null;
    setSwipeOffset(0);
  }

  function handleExerciseTouchEnd() {
    touchStartY.current = null;
    setSwipeOffset(0);
  }

  function openHistory() {
    setPage("history");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setOpenHistoryKey(null);
    loadHistory();
  }

  function saveWorkoutModePreference(mode, remember = workoutModeRemember) {
    const currentUser = auth.currentUser || user;
    const nextPreference = {
      mode,
      remember: Boolean(remember)
    };

    setWorkoutModePreference(nextPreference);
    setWorkoutModeRemember(Boolean(remember));

    if (currentUser?.uid) {
      safeWriteUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, currentUser.uid, nextPreference);
    }
  }

  function openTrainingEntry() {
    const currentUser = auth.currentUser || user;
    const savedPreference = currentUser?.uid
      ? safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, currentUser.uid, workoutModePreference)
      : workoutModePreference;

    if (savedPreference?.remember && savedPreference?.mode === "basic") {
      openBasicWorkoutQuiz();
      return;
    }

    if (savedPreference?.remember && savedPreference?.mode === "individual") {
      openIndividualWorkouts();
      return;
    }

    setSelectedWorkoutId(null);
    setPage("workoutMode");
  }

  async function openIndividualWorkouts() {
    saveWorkoutModePreference("individual", workoutModeRemember);
    setSelectedWorkoutId(null);
    setIndividualWorkoutIndex(0);
    setIndividualWorkoutIndexInitialized(false);
    await loadWorkoutsFromFirebase((auth.currentUser || user)?.uid);
    setPage("workouts");
  }

  function buildBasicPlanFromQuiz(quiz = basicWorkoutQuiz) {
    const planKey = quiz.goal === "muscle" || quiz.days === "4" ? "muscle" : "beginner";
    const basePlan = BASIC_WORKOUT_PLANS[planKey] || BASIC_WORKOUT_PLANS.beginner;
    const daysLimit = Number(quiz.days) || basePlan.workouts.length;

    return {
      id: basePlan.id,
      name: basePlan.name,
      description: basePlan.description,
      workouts: sortWorkoutDays(basePlan.workouts.slice(0, Math.min(daysLimit, basePlan.workouts.length)))
    };
  }

  function openBasicWorkoutQuiz() {
    saveWorkoutModePreference("basic", workoutModeRemember);
    setSelectedWorkoutId(null);
    setPage("basicWorkoutQuiz");
  }

  function applyBasicWorkoutPlan() {
    const nextPlan = buildBasicPlanFromQuiz(basicWorkoutQuiz);
    setPlan({ workouts: nextPlan.workouts });
    setSelectedWorkoutId(null);
    setPage("workouts");
  }

  function openWorkout(id) {
    const currentUser = auth.currentUser || user;
    const savedDraft = currentUser?.uid ? safeReadJsonStorage(getWorkoutDraftKey(currentUser.uid, id), null) : null;
    const shouldRestoreDraft =
      savedDraft?.workoutId === id &&
      savedDraft?.plan &&
      window.confirm("Найден незавершённый черновик тренировки. Восстановить?");

    if (shouldRestoreDraft) {
      setPlan(savedDraft.plan);
    }

    setSelectedWorkoutId(id);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(shouldRestoreDraft ? Number(savedDraft.currentExerciseIndex) || 0 : 0);
    setWorkoutStarted(Boolean(shouldRestoreDraft));
    setWorkoutStartedAt(shouldRestoreDraft ? savedDraft.workoutStartedAt || Date.now() : null);
    setWorkoutFinishedAt(shouldRestoreDraft ? savedDraft.workoutFinishedAt || null : null);
    setWorkoutReadiness(null);
                  setPostWorkoutFeedback(null);
                  setPostWorkoutFeedbackOpen(false);
    setWorkoutReadinessOpen(true);
    setIsWorkoutSaved(false);
    setShowWorkoutSavedCard(false);
    loadHistory();
  }

  function applyWorkoutReadiness(option) {
    const readiness = option || getWorkoutReadinessOption("good");

    setWorkoutReadiness(readiness);
    setWorkoutReadinessOpen(false);

    if (!selectedWorkoutId) return;

    setPlan((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workoutItem) => {
        if (workoutItem.id !== selectedWorkoutId) return workoutItem;

        return {
          ...workoutItem,
          exercises: workoutItem.exercises.map((exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set, index) => {
              const baseWeight = getAiWorkoutBaseWeight(exercise.name, set, index, history);
              const adjustedWeight = getAdjustedWorkoutWeight(baseWeight, readiness.id);

              if (!adjustedWeight) return set;

              return {
                ...set,
                weight: String(adjustedWeight),
                aiOriginalWeight: baseWeight ? String(baseWeight) : "",
                aiReadinessId: readiness.id,
                aiReadinessTitle: readiness.title
              };
            })
          }))
        };
      })
    }));
  }

  function saveAiNutritionPlan(profileOverride = aiNutritionProfileDraft) {
    const profile = {
      weight: String(profileOverride.weight || "").trim(),
      height: String(profileOverride.height || "").trim(),
      age: String(profileOverride.age || "").trim(),
      sex: profileOverride.sex || "male",
      activity: profileOverride.activity || "medium",
      goal: profileOverride.goal || "recomp",
      trainingDays: getAiNutritionTrainingDays(profileOverride)
    };

    const nextPlan = buildAiNutritionMonthlyPlan(nutrition, profile, history, aiNutritionSavedPlan);
    setAiNutritionProfile(profile);
    setAiNutritionProfileDraft(profile);
    setAiNutritionSavedPlan(nextPlan);

    try {
      localStorage.setItem(AI_NUTRITION_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      localStorage.setItem(AI_NUTRITION_PLAN_STORAGE_KEY, JSON.stringify(nextPlan));

      if (auth.currentUser?.uid) {
        setDoc(doc(db, "users", auth.currentUser.uid), {
          profile,
          aiNutritionProfile: profile,
          aiNutritionPlan: nextPlan,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch((error) => console.error("Profile save error", error));
      }

      if (user?.uid && hasRequiredAiNutritionProfileFields(profile)) {
        localStorage.setItem(FIRST_SETUP_DONE_USER_STORAGE_KEY, `${user.uid}:${FIRST_SETUP_REQUIRED_VERSION}`);
      }
    } catch (_) {
      // ignore localStorage errors
    }

    const weekOne = nextPlan.weeks?.[0];
    if (weekOne) {
      setNutrition((prev) => ({
        ...prev,
        goals: {
          ...prev.goals,
          calories: weekOne.calories,
          protein: weekOne.protein,
          fat: weekOne.fat,
          carbs: weekOne.carbs
        }
      }));
    }
  }

  function resetAiNutritionPlan() {
    const preservedAnchor = Number(aiNutritionSavedPlan?.calorieAnchor || aiNutritionProfile?.calorieAnchor || getAiNutritionHistoryBaseline().average.calories) || 2374;
    const nextDraft = {
      weight: "",
      height: "",
      age: "",
      sex: aiNutritionProfile?.sex || "male",
      activity: aiNutritionProfile?.activity || "medium",
      goal: aiNutritionProfile?.goal || "recomp",
      trainingDays: getAiNutritionTrainingDays(aiNutritionProfile)
    };

    setAiNutritionProfile(null);
    setAiNutritionSavedPlan(null);
    setAiNutritionProfileDraft(nextDraft);

    try {
      localStorage.removeItem(AI_NUTRITION_PROFILE_STORAGE_KEY);
      localStorage.removeItem(AI_NUTRITION_PLAN_STORAGE_KEY);
    } catch (_) {
      // ignore localStorage errors
    }
  }

  
function normalizeTelegramUsername(value = "") {
    return String(value || "").trim().replace(/^@+/, "");
  }

  function createTelegramLinkCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function parseTelegramAuthResultFromHash() {
    try {
      const hash = window.location.hash || "";
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const rawResult = params.get("tgAuthResult");

      if (!rawResult) return null;

      const base64 = rawResult.replace(/-/g, "+").replace(/_/g, "/");
      const paddedBase64 = base64 + "=".repeat((4 - base64.length % 4) % 4);
      const decoded = decodeURIComponent(escape(window.atob(paddedBase64)));

      return JSON.parse(decoded);
    } catch (error) {
      console.error("Telegram tgAuthResult parse error:", error);
      return null;
    }
  }

  async function handleTelegramLoginAuth(telegramUser) {
    if (!auth.currentUser?.uid) {
      setTelegramStatus("Сначала войди в аккаунт.");
      return;
    }

    setTelegramLinking(true);
    setTelegramStatus("Проверяю данные Telegram...");

    try {
      const response = await fetch("/api/telegram/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: auth.currentUser.uid,
          telegramUser
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Telegram authorization failed");
      }

      const nextTelegram = {
        connected: true,
        ...(data.telegram || {}),
        notificationsEnabled: data.telegram?.notificationsEnabled !== false
      };

      setTelegramProfile(nextTelegram);
      setTelegramDraft(nextTelegram);
      setTelegramStatus("Telegram успешно привязан ✅");
      setTelegramConnectOpen(false);

      try {
        localStorage.setItem("workout_telegram_profile_v1", JSON.stringify(nextTelegram));
      } catch (_) {
        // ignore localStorage errors
      }
    } catch (error) {
      console.error("Telegram login auth error:", error);
      setTelegramStatus("Не получилось авторизоваться через Telegram.");
    } finally {
      setTelegramLinking(false);
    }
  }

  async function startTelegramBotLink() {
    if (!auth.currentUser?.uid) {
      setTelegramStatus("Сначала войди в аккаунт.");
      return;
    }

    const code = createTelegramLinkCode();
    setTelegramLinkCode(code);
    setTelegramLinking(true);
    setTelegramStatus("Код создан. Открой бота и нажми START.");

    try {
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        telegramLinkCode: code,
        telegramLinkCodeCreatedAt: new Date().toISOString(),
        telegramConnected: false
      }, { merge: true });

      window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Ошибка создания Telegram link code:", error);
      setTelegramStatus("Не получилось создать код привязки.");
    } finally {
      setTelegramLinking(false);
    }
  }

  async function checkTelegramLoginResult() {
    setTelegramStatus("Проверяю, сохранился ли Telegram в профиле...");
    await refreshTelegramConnection();
  }

  async function refreshTelegramConnection() {
    if (!auth.currentUser?.uid) return;

    try {
      const profileDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const savedTelegram = profileDoc.exists() ? profileDoc.data()?.telegram : null;

      if (savedTelegram?.connected || profileDoc.data()?.telegramConnected) {
        const nextTelegram = {
          connected: true,
          username: savedTelegram?.username || profileDoc.data()?.telegramUsername || telegramDraft.username || "",
          displayName: savedTelegram?.displayName || profileDoc.data()?.telegramDisplayName || savedTelegram?.firstName || savedTelegram?.username || telegramDraft.displayName || "",
          firstName: savedTelegram?.firstName || "",
          lastName: savedTelegram?.lastName || "",
          avatarUrl: savedTelegram?.avatarUrl || profileDoc.data()?.telegramAvatarUrl || "",
          chatId: savedTelegram?.chatId || "",
          telegramUserId: savedTelegram?.telegramUserId || profileDoc.data()?.telegramUserId || "",
          notificationsEnabled: savedTelegram?.notificationsEnabled !== false,
          connectedAt: savedTelegram?.connectedAt || new Date().toISOString()
        };

        setTelegramProfile(nextTelegram);
        setTelegramDraft(nextTelegram);
        setTelegramStatus("Telegram успешно привязан ✅");

        try {
          localStorage.setItem("workout_telegram_profile_v1", JSON.stringify(nextTelegram));
        } catch (_) {
          // ignore localStorage errors
        }
      } else {
        setTelegramStatus("Пока не привязан. Открой бота и нажми START.");
      }
    } catch (error) {
      console.error("Ошибка проверки Telegram:", error);
      setTelegramStatus("Не получилось проверить привязку Telegram.");
    }
  }

  async function saveTelegramConnection() {
    const username = normalizeTelegramUsername(telegramDraft.username);

    if (!username) {
      setTelegramStatus("Введи Telegram username.");
      return;
    }

    const nextTelegramProfile = {
      connected: true,
      username,
      displayName: telegramDraft.displayName || username,
      avatarUrl: telegramDraft.avatarUrl || "",
      chatId: telegramDraft.chatId || "",
      notificationsEnabled: telegramDraft.notificationsEnabled !== false,
      connectedAt: new Date().toISOString(),
      reminderMode: "day_before_workout"
    };

    setTelegramProfile(nextTelegramProfile);
    setTelegramDraft(nextTelegramProfile);
    setTelegramConnectOpen(false);
    setTelegramStatus("Telegram подключён ✅");

    try {
      localStorage.setItem("workout_telegram_profile_v1", JSON.stringify(nextTelegramProfile));
    } catch (_) {
      // ignore localStorage errors
    }

    try {
      if (auth.currentUser?.uid) {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          telegram: nextTelegramProfile,
          telegramConnected: true,
          telegramUsername: username,
          telegramNotificationsEnabled: nextTelegramProfile.notificationsEnabled
        }, { merge: true });
      }
    } catch (error) {
      console.error("Ошибка сохранения Telegram:", error);
      setTelegramStatus("Telegram сохранён локально, но не записался в Firebase.");
    }
  }

  async function disconnectTelegram() {
    const nextTelegramProfile = {
      connected: false,
      username: "",
      displayName: "",
      avatarUrl: "",
      chatId: "",
      notificationsEnabled: true
    };

    setTelegramProfile(nextTelegramProfile);
    setTelegramDraft(nextTelegramProfile);
    setTelegramStatus("Telegram отключён.");

    try {
      localStorage.setItem("workout_telegram_profile_v1", JSON.stringify(nextTelegramProfile));
    } catch (_) {
      // ignore localStorage errors
    }

    try {
      if (auth.currentUser?.uid) {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          telegram: nextTelegramProfile,
          telegramConnected: false,
          telegramUsername: "",
          telegramNotificationsEnabled: false
        }, { merge: true });
      }
    } catch (error) {
      console.error("Ошибка отключения Telegram:", error);
    }
  }

  useEffect(() => {
    if (!telegramConnectOpen) return;

    window.onTelegramAuthForWorkoutApp = async (telegramUser) => {
      console.log("TELEGRAM CALLBACK WORKS:", telegramUser);
      setTelegramStatus("Telegram подтвердил вход. Проверяю данные...");
      await handleTelegramLoginAuth(telegramUser);
    };

    const container = telegramLoginContainerRef.current;
    if (!container) return;

    container.innerHTML = "";
    setTelegramLoginWidgetReady(false);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "14");
    script.setAttribute("data-userpic", "true");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuthForWorkoutApp(user)");
    script.onload = () => setTelegramLoginWidgetReady(true);

    container.appendChild(script);

    return () => {
      if (window.onTelegramAuthForWorkoutApp) {
        delete window.onTelegramAuthForWorkoutApp;
      }
    };
  }, [telegramConnectOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const telegramAuthResult = parseTelegramAuthResultFromHash();

    if (telegramAuthResult) {
      setPage("profile");
      setTelegramConnectOpen(false);
      handleTelegramLoginAuth(telegramAuthResult);

      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    if (params.get("telegramLinked") === "1") {
      setPage("profile");
      setTelegramConnectOpen(false);
      refreshTelegramConnection();

      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    if (params.get("telegramError")) {
      setPage("profile");
      setTelegramConnectOpen(true);
      setTelegramStatus("Telegram вернул ошибку. Попробуй войти ещё раз.");
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  function saveAiBodyMetrics() {
    const nextProfile = {
      ...(aiNutritionProfile || {}),
      ...aiNutritionProfileDraft,
      weight: String(aiNutritionProfileDraft.weight || "").trim(),
      height: String(aiNutritionProfileDraft.height || "").trim(),
      age: String(aiNutritionProfileDraft.age || "").trim(),
      sex: aiNutritionProfileDraft.sex || "male",
      activity: aiNutritionProfileDraft.activity || "medium",
      goal: aiNutritionProfileDraft.goal || "recomp",
      trainingDays: Array.isArray(aiNutritionProfileDraft.trainingDays) ? aiNutritionProfileDraft.trainingDays : []
    };

    const nextPlan = buildAiNutritionMonthlyPlan(nutrition, nextProfile, history, null);
    const nextWeek = nextPlan?.weeks?.[0] || nextPlan?.start || nutrition.goals;
    const nextMacros = getAiNutritionDayMacros(nextWeek, nextProfile);

    setAiNutritionProfileDraft(nextProfile);
    setAiNutritionProfile(nextProfile);
    setAiNutritionSavedPlan(nextPlan);
    setNutrition((prev) => ({
      ...prev,
      goals: {
        ...(prev.goals || defaultNutritionState.goals),
        calories: Math.round(nextMacros.calories || nextWeek.calories || prev.goals?.calories || 0),
        protein: Math.round(nextMacros.protein || nextWeek.protein || prev.goals?.protein || 0),
        fat: Math.round(nextMacros.fat || nextWeek.fat || prev.goals?.fat || 0),
        carbs: Math.round(nextMacros.carbs || nextWeek.carbs || prev.goals?.carbs || 0)
      }
    }));

    try {
      localStorage.setItem(AI_NUTRITION_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
      localStorage.setItem(AI_NUTRITION_PLAN_STORAGE_KEY, JSON.stringify(nextPlan));
    } catch (_) {
      // ignore localStorage errors
    }
  }

  if (appLoading) {
    return (
      <div className="appSplash">
        <div className="splashInner">
          <div className="splashMark">🏋️</div>
          <div className="splashLogo">GYM</div>
          <div className="splashText">Загрузка тренировки</div>
          <div className="splashProgress">
            <span />
          </div>
          <div className="splashDots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    );
  }

  if (showFirstSetupOnboarding && isLoggedIn && !appLoading) {
    return renderFirstSetupOnboarding();
  }

  if (!isLoggedIn) {
    return (
      <div className="loginPage">
        <div className="loginHero">
          <div className="appLogo">W</div>
          <h1>Workout</h1>
          <p>Твой дневник тренировок</p>
        </div>

        <form className="loginCard" onSubmit={handleLogin}>
          <h2>Вход</h2>

          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Email"
          />

          <div className="passwordBox">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
            />

            <button
              type="button"
              className="eyeBtn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "👁️" : "🙈"}
            </button>

    
          </div>

          {loginError && <div className="loginError">{loginError}</div>}

          <button className="loginBtn" type="submit">
            Войти
          </button>

          <p className="loginHint">Вход через email и пароль</p>
        </form>
      </div>
    );
  }

  if (page === "main") {
    return (
      <div className="menuPage">
      <div className="appVersionBadge">{APP_VERSION}</div>
        <button
          type="button"
          className="menuRefreshIconBtn"
          onClick={refreshPage}
          aria-label="Обновить страницу"
          title="Обновить страницу"
        >
          🔄
        </button>

        <h1 className="menuTitle">Главное меню</h1>

        <div className="menuButtons">
          <button className="bigButton" onClick={openTrainingEntry}>
            🏋️ Тренировки
          </button>

          <button className="bigButton" onClick={() => setPage("nutrition")}>
            🍽️ Питание
          </button>

          <button
            className="bigButton"
            onClick={() => {
              loadHistory();
              setPage("profile");
            }}
          >
            👤 Личный кабинет
          </button>

          {canUseTrainerFeatures() && (
            <button
              className="bigButton"
              onClick={() => {
                setSelectedUserId(null);
                setPage("admin");
              }}
            >
              ⚙️ Тренерская
            </button>
          )}

          {canUseAdminFeatures() && (
            <button
              className="bigButton adminPanelMenuButton"
              onClick={() => {
                setSelectedUserId(null);
                setPage("adminPanel");
              }}
            >
              🛠️ Админ-панель
            </button>
          )}
        </div>
      </div>
    );
  }

  if (page === "adminPanel") {
    if (!canUseAdminFeatures()) {
      return (
        <div className="app">
          <button className="backBtn" onClick={() => setPage("main")}>← Главное меню</button>
          <div className="historyEmptyCard">
            <h3>Доступ закрыт</h3>
            <p>Админ-панель доступна только главному администратору.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="adminPanelHubPage">
        <button
          className="adminFixedMainBack"
          onClick={() => setPage("main")}
          aria-label="Главное меню"
        >
          <span>←</span>
          <b>Главное меню</b>
        </button>

        <section className="adminPanelHubHero">
          <span>ADMIN CONTROL</span>
          <h1>Админ-панель</h1>
          <p>Отдельный раздел для управления ролями, клиентами и системными настройками.</p>
        </section>

        <section className="adminPanelHubGrid">
          <button
            type="button"
            className="adminPanelHubCard"
            onClick={() => setPage("adminUsers")}
          >
            <i>👥</i>
            <strong>Клиенты и роли</strong>
            <small>Назначение тренеров, карточки клиентов, доступы.</small>
          </button>

          <button
            type="button"
            className="adminPanelHubCard"
            onClick={() => setPage("adminWorkouts")}
          >
            <i>🏋️</i>
            <strong>Программы</strong>
            <small>Библиотека программ и назначение тренировок.</small>
          </button>

          <button
            type="button"
            className="adminPanelHubCard"
            onClick={() => setPage("admin")}
          >
            <i>📊</i>
            <strong>Тренерская CRM</strong>
            <small>Обзор, статистика, управление тренировочным процессом.</small>
          </button>
        </section>
      </div>
    );
  }

  if (page === "workoutMode") {
    return (
      <div className="workoutModePage">
        <button className="workoutModeBack" onClick={goBackToMain}>←</button>

        <section className="workoutModeHero">
          <span>TRAINING MODE</span>
          <h1>Выбери формат</h1>
          <p>Можно тренироваться по базовой программе или по индивидуальному плану от тренера.</p>
        </section>

        <section className="workoutModeCards">
          <button className="workoutModeCard" onClick={openBasicWorkoutQuiz}>
            <span className="workoutModeIcon">🧭</span>
            <strong>Базовые тренировки</strong>
            <small>Короткий опрос и готовый план из базы приложения.</small>
          </button>

          <button className="workoutModeCard premium" onClick={openIndividualWorkouts}>
            <span className="workoutModeIcon">🎯</span>
            <strong>Индивидуальный план</strong>
            <small>Тренировки, которые создал и назначил тренер.</small>
          </button>
        </section>

        <label className="workoutModeRemember">
          <input
            type="checkbox"
            checked={workoutModeRemember}
            onChange={(event) => setWorkoutModeRemember(event.target.checked)}
          />
          <span>Запомнить выбор и больше не спрашивать</span>
        </label>
      </div>
    );
  }

  if (page === "basicWorkoutQuiz") {
    const previewPlan = buildBasicPlanFromQuiz(basicWorkoutQuiz);

    return (
      <div className="basicQuizPage">
        <button className="workoutModeBack" onClick={() => setPage("workoutMode")}>←</button>

        <section className="workoutModeHero">
          <span>BASIC PLAN</span>
          <h1>Базовый подбор</h1>
          <p>Ответь на 3 вопроса — приложение предложит стартовый план тренировок.</p>
        </section>

        <section className="basicQuizCard">
          <label>
            <span>Цель</span>
            <select
              value={basicWorkoutQuiz.goal}
              onChange={(event) => setBasicWorkoutQuiz((prev) => ({ ...prev, goal: event.target.value }))}
            >
              <option value="muscle">Набрать мышцы</option>
              <option value="beginner">Начать тренироваться</option>
            </select>
          </label>

          <label>
            <span>Опыт</span>
            <select
              value={basicWorkoutQuiz.level}
              onChange={(event) => setBasicWorkoutQuiz((prev) => ({ ...prev, level: event.target.value }))}
            >
              <option value="beginner">Новичок</option>
              <option value="middle">Уже тренировался</option>
            </select>
          </label>

          <label>
            <span>Сколько тренировок в неделю</span>
            <select
              value={basicWorkoutQuiz.days}
              onChange={(event) => setBasicWorkoutQuiz((prev) => ({ ...prev, days: event.target.value }))}
            >
              <option value="3">3 тренировки</option>
              <option value="4">4 тренировки</option>
            </select>
          </label>
        </section>

        <section className="basicQuizPreview">
          <span>Рекомендуемый план</span>
          <strong>{previewPlan.name}</strong>
          <p>{previewPlan.description}</p>
          <div>
            <b>{previewPlan.workouts.length}</b>
            <small>тренировки</small>
            <b>{previewPlan.workouts.reduce((sum, workout) => sum + (workout.exercises?.length || 0), 0)}</b>
            <small>упражнений</small>
          </div>
        </section>

        <button className="basicQuizStartBtn" onClick={applyBasicWorkoutPlan}>
          Подобрать план
        </button>
      </div>
    );
  }

  if (page === "aiCoach") {
    const activeAiFeature = AI_COACH_FEATURES.find((feature) => feature.id === selectedAiFeatureId) || AI_COACH_FEATURES[0];
    const aiResult = buildAiCoachResult(activeAiFeature.id, { history, nutrition, plan });
    const isNutritionPlanFeature = activeAiFeature.id === "nutritionPlan";
    const aiNutritionDay = buildAiNutritionDayModel(nutrition, nutrition.days?.[nutritionDateKey], history);
    const activeAiNutritionPlan = aiNutritionSavedPlan || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);
    const activeAiNutritionWeekNumber = getAiNutritionCurrentWeek(activeAiNutritionPlan);
    const activeAiNutritionWeek = activeAiNutritionPlan?.weeks?.[activeAiNutritionWeekNumber - 1] || activeAiNutritionPlan?.weeks?.[0];
    const activeAiNutritionProfile = activeAiNutritionPlan?.profile || aiNutritionProfile || aiNutritionProfileDraft;
    const isAiTrainingDayToday = isAiNutritionTrainingDay(activeAiNutritionProfile);
    const activeAiNutritionTodayMacros = getAiNutritionDayMacros(activeAiNutritionWeek || nutrition.goals, activeAiNutritionProfile);
    const aiNutritionTrainingAdvice = getAiNutritionTrainingDayAdvice(isAiTrainingDayToday, activeAiNutritionProfile?.goal);

    return (
      <div className="aiCoachPage">
        <button className="backBtn universalFixedBackPointer aiCoachBackBtn" onClick={goBackToMain}>←</button>

        <section className="aiCoachHero">
          <div className="aiCoachBadge">AI ASSISTANT CORE</div>
          <h1>AI-помощник</h1>
          <p>Умные подсказки по питанию, тренировкам, восстановлению и прогрессу на основе твоей истории.</p>
        </section>

        {isNutritionPlanFeature ? (
          <section className="aiNutritionPlanShell">
            {!activeAiNutritionPlan ? (
              <div className="aiNutritionOnboardingCard">
                <div className="aiNutritionOnboardingHead">
                  <span>AI-план питания v1</span>
                  <h2>Создадим месячный план КБЖУ</h2>
                  <p>AI возьмёт твой вес, рост, возраст, цель, текущие КБЖУ, питание за всё время, частые продукты и историю тренировок.</p>
                </div>

                <div className="aiNutritionBodyReadOnlyCard">
                  <div className="aiNutritionBodyReadOnlyHead">
                    <strong>Данные из личного кабинета</strong>
                    <small>Редактируются только в профиле</small>
                  </div>
                  <div className="aiNutritionBodyReadOnlyGrid">
                    <span><i>Вес</i><b>{aiNutritionProfileDraft.weight || "—"}</b></span>
                    <span><i>Рост</i><b>{aiNutritionProfileDraft.height || "—"}</b></span>
                    <span><i>Возраст</i><b>{aiNutritionProfileDraft.age || "—"}</b></span>
                    <span><i>Пол</i><b>{aiNutritionProfileDraft.sex === "female" ? "Ж" : "М"}</b></span>
                  </div>
                  <button
                    type="button"
                    className="aiNutritionProfileLinkBtn"
                    onClick={() => setPage("profile")}
                  >
                    Изменить в личном кабинете
                  </button>
                </div>

                <div className="aiNutritionTrainingDaysPicker">
                  <div className="aiNutritionTrainingDaysHead">
                    <strong>Дни тренировок</strong>
                    <small>Можно выбрать несколько дней</small>
                  </div>
                  <div className="aiNutritionTrainingDaysGrid">
                    {AI_NUTRITION_WEEK_DAYS.map((day) => {
                      const selected = getAiNutritionTrainingDays(aiNutritionProfileDraft).includes(day.id);
                      return (
                        <button
                          type="button"
                          key={day.id}
                          className={selected ? "active" : ""}
                          title={day.label}
                          onClick={() => setAiNutritionProfileDraft((prev) => {
                            const current = getAiNutritionTrainingDays(prev);
                            const next = current.includes(day.id)
                              ? current.filter((item) => item !== day.id)
                              : [...current, day.id];
                            return { ...prev, trainingDays: next };
                          })}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="aiNutritionGoalPicker">
                  {[
                    { id: "maintain", title: "Поддержка", text: "ровный вес и стабильная энергия" },
                    { id: "recomp", title: "Рекомпозиция", text: "больше и лёгкий дефицит" },
                    { id: "mass", title: "Набор массы", text: "плавно + калории" },
                    { id: "cut", title: "Похудение", text: "комфортный дефицит" },
                    { id: "dry", title: "Сушка", text: "дефицит + сохранить мышцы" }
                  ].map((goal) => (
                    <button
                      type="button"
                      key={goal.id}
                      className={aiNutritionProfileDraft.goal === goal.id ? "active" : ""}
                      onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, goal: goal.id }))}
                    >
                      <strong>{goal.title}</strong>
                      <small>{goal.text}</small>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="aiNutritionPrimaryBtn"
                  onClick={() => saveAiNutritionPlan()}
                >
                  Создать AI-план
                </button>
              </div>
            ) : (
              <div className="aiNutritionPlanCardFull">
                <div className="aiNutritionPlanHero">
                  <div>
                    <span>Твой AI-план питания</span>
                    <h2>{activeAiNutritionPlan.goalLabel}</h2>
                    <p>{activeAiNutritionPlan.comment}</p>
                  </div>
                  <strong>{aiNutritionDay.score}/10</strong>
                </div>

                <div className="aiNutritionTodayMacros">
                  <div>
                    <span>Сегодня</span>
                    <strong>{activeAiNutritionTodayMacros?.calories || nutrition.goals.calories}</strong>
                    <small>ккал</small>
                  </div>
                  <div>
                    <span>Белки</span>
                    <strong>{activeAiNutritionTodayMacros?.protein || nutrition.goals.protein}</strong>
                    <small>г</small>
                  </div>
                  <div>
                    <span>Жиры</span>
                    <strong>{activeAiNutritionTodayMacros?.fat || nutrition.goals.fat}</strong>
                    <small>г</small>
                  </div>
                  <div>
                    <span>Углеводы</span>
                    <strong>{activeAiNutritionTodayMacros?.carbs || nutrition.goals.carbs}</strong>
                    <small>г</small>
                  </div>
                </div>

                <div className="aiNutritionPlanInsight">
                  <span>Краткий AI-комментарий</span>
                  <p>{aiNutritionDay.summary} {aiNutritionTrainingAdvice}</p>
                </div>

                <div className="aiNutritionBadgesRow">
                  {aiNutritionDay.badges.map((badge) => (
                    <span key={badge.text} className={badge.type}>
                      <i>{badge.icon}</i>{badge.text}
                    </span>
                  ))}
                </div>

                <div className={`aiNutritionTrainingDayInfo ${isAiTrainingDayToday ? "active" : ""}`}>
                  <span>{isAiTrainingDayToday ? "Сегодня тренировка" : "Сегодня без тренировки"}</span>
                  <p>{aiNutritionTrainingAdvice}</p>
                </div>

                <button
                  type="button"
                  className="aiNutritionAdaptBtn"
                  onClick={() => setAiNutritionAdaptedToday((value) => !value)}
                >
                  Адаптировать под сегодня
                </button>

                {aiNutritionAdaptedToday && (
                  <div className="aiNutritionPlanInsight aiNutritionAdaptResult">
                    <span>Совет на остаток дня</span>
                    <p>{aiNutritionDay.adaptiveAdvice}</p>
                  </div>
                )}

                <div className="aiNutritionWeeksGrid">
                  {activeAiNutritionPlan.weeks.map((week) => (
                    <div key={week.week} className={week.week === activeAiNutritionWeekNumber ? "active" : ""}>
                      <span>{week.label}</span>
                      <strong>{week.calories} ккал</strong>
                      <small>Б {week.protein} · Ж {week.fat} · У {week.carbs}</small>
                      <p>{week.focus}</p>
                    </div>
                  ))}
                </div>

                <div className="aiNutritionTwoCol">
                  <div>
                    <span>Прогресс недели</span>
                    <p>Сейчас активна {activeAiNutritionWeekNumber} неделя. {activeAiNutritionPlan.weightTrend?.text}</p>
                  </div>
                  <div>
                    <span>Частые продукты</span>
                    <p>{activeAiNutritionPlan.frequentFoods?.length ? activeAiNutritionPlan.frequentFoods.join(", ") : "AI будет собирать список по истории питания."}</p>
                  </div>
                </div>

                <div className="aiNutritionImproveBox">
                  <span>Что улучшить сегодня</span>
                  <p>{aiNutritionDay.left.protein > 20 ? "1. Добрать белок простыми продуктами." : "1. Белок держится хорошо."}</p>
                  <p>{aiNutritionDay.left.carbs > 80 ? "2. Добавить углеводы вокруг тренировки." : "2. Углеводы близко к цели."}</p>
                  <p>{aiNutritionDay.left.fat < 0 ? "3. Остаток дня сделать менее жирным." : "3. Не перегружать жиры вечером."}</p>
                </div>

                <div className="aiNutritionPlanActions">
                  <button type="button" onClick={() => saveAiNutritionPlan(aiNutritionProfile)}>Обновить план</button>
                  <button type="button" className="ghost" onClick={resetAiNutritionPlan}>Пересоздать анкету</button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="aiCoachResultCard">
            <div className="aiCoachResultTop">
              <div>
                <span>{activeAiFeature.icon}</span>
                <h2>{aiResult.title}</h2>
                <p>{aiResult.status}</p>
              </div>
              <strong>{aiResult.score}%</strong>
            </div>

            <div className="aiCoachMeter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.max(4, aiResult.score))}%` }} />
            </div>

            <div className="aiCoachBlocks">
              <div className="aiCoachMiniBlock">
                <h3>Анализ</h3>
                {aiResult.bullets.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>

              <div className="aiCoachMiniBlock accent">
                <h3>Что сделать</h3>
                {aiResult.actions.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="aiCoachGrid">
          {AI_COACH_FEATURES.map((feature) => (
            <button
              type="button"
              key={feature.id}
              className={`aiCoachFeatureCard ${feature.id === activeAiFeature.id ? "active" : ""}`}
              onClick={() => setSelectedAiFeatureId(feature.id)}
            >
              <span>{feature.icon}</span>
              <strong>{feature.title}</strong>
              <small>{feature.subtitle}</small>
            </button>
          ))}
        </section>
      </div>
    );
  }

  if (page === "nutrition") {
    const preliminaryAiNutritionPlan = aiNutritionSavedPlan || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);
    const preliminaryAiNutritionWeekNumber = getAiNutritionCurrentWeek(preliminaryAiNutritionPlan);
    const preliminaryAiNutritionProfile = preliminaryAiNutritionPlan?.profile || aiNutritionProfile || aiNutritionProfileDraft;
    const preliminaryAiNutritionWeek = preliminaryAiNutritionPlan?.weeks?.[preliminaryAiNutritionWeekNumber - 1] || preliminaryAiNutritionPlan?.weeks?.[0];
    const preliminaryAiNutritionTodayMacros = getAiNutritionDayMacros(preliminaryAiNutritionWeek || nutrition.goals, preliminaryAiNutritionProfile);
    const effectiveNutritionGoals = {
      ...nutrition.goals,
      calories: Math.round(Number(preliminaryAiNutritionTodayMacros?.calories) || nutrition.goals.calories),
      protein: Math.round(Number(preliminaryAiNutritionTodayMacros?.protein) || nutrition.goals.protein),
      fat: Math.round(Number(preliminaryAiNutritionTodayMacros?.fat) || nutrition.goals.fat),
      carbs: Math.round(Number(preliminaryAiNutritionTodayMacros?.carbs) || nutrition.goals.carbs)
    };

    const caloriePercentRaw = Math.round((nutritionTotals.calories / Math.max(1, effectiveNutritionGoals.calories)) * 100);
    const caloriePercent = Math.min(100, caloriePercentRaw);
    const isCaloriesOverGoal = nutritionTotals.calories > effectiveNutritionGoals.calories;
    const waterPercent = Math.min(100, Math.round(((nutritionToday.water || 0) / nutrition.goals.water) * 100));
    const caloriesLeft = Math.max(0, Math.round(effectiveNutritionGoals.calories - nutritionTotals.calories));
    const caloriesConsumed = Math.round(nutritionTotals.calories);
    const proteinPercent = Math.min(100, Math.round((nutritionTotals.protein / effectiveNutritionGoals.protein) * 100));
    const fatPercent = Math.min(100, Math.round((nutritionTotals.fat / effectiveNutritionGoals.fat) * 100));
    const carbsPercent = Math.min(100, Math.round((nutritionTotals.carbs / effectiveNutritionGoals.carbs) * 100));
    const macroTotal = Math.max(1, nutritionTotals.protein + nutritionTotals.fat + nutritionTotals.carbs);
    const carbsAngle = (nutritionTotals.carbs / macroTotal) * 360;
    const fatAngle = (nutritionTotals.fat / macroTotal) * 360;
    const macroDonutStyle = {
      background: `conic-gradient(#70cde3 0deg ${carbsAngle}deg, #ffd15a ${carbsAngle}deg ${carbsAngle + fatAngle}deg, #ff7d7d ${carbsAngle + fatAngle}deg 360deg)`
    };
    const weekDates = getNutritionWeekDates(nutritionDateKey);
    const selectedNutritionDate = nutritionKeyToDate(nutritionDateKey);
    const nutritionCurrentStreak = getNutritionCurrentStreak();
    const nutritionStreakText = `Серия записи еды — ${nutritionCurrentStreak} 🔥`;
    const nutritionDateTitle = isNutritionToday
      ? "Сегодня"
      : formatNutritionDateLabel(selectedNutritionDate).replace(/^./, (char) => char.toUpperCase());
    const mealStats = nutritionMeals.reduce((acc, meal) => {
      const foods = (nutritionToday.foods || []).filter((item) => item.mealId === meal.id);
      acc[meal.id] = foods.reduce(
        (sum, item) => ({
          calories: sum.calories + (Number(item.calories) || 0),
          protein: sum.protein + (Number(item.protein) || 0),
          fat: sum.fat + (Number(item.fat) || 0),
          carbs: sum.carbs + (Number(item.carbs) || 0),
          count: sum.count + 1
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 }
      );
      return acc;
    }, {});
    const aiNutritionDay = buildAiNutritionDayModel({ ...nutrition, goals: effectiveNutritionGoals }, nutritionToday, history);
    const aiNutritionActivePlan = preliminaryAiNutritionPlan || buildAiNutritionMonthlyPlan(nutrition);
    const aiNutritionBaseline = aiNutritionDay.baseline;
    const aiNutritionGoalText = getAiNutritionGoalLabel(aiNutritionActivePlan?.profile?.goal || aiNutritionProfile?.goal || "recomp");
    const aiNutritionCurrentWeek = preliminaryAiNutritionWeekNumber;
    const aiNutritionPageProfile = preliminaryAiNutritionProfile;
    const isNutritionTrainingDayToday = isAiNutritionTrainingDay(aiNutritionPageProfile);
    const aiNutritionPageWeek = preliminaryAiNutritionWeek;
    const aiNutritionTodayPlanMacros = preliminaryAiNutritionTodayMacros;
    const aiNutritionPageTrainingAdvice = getAiNutritionTrainingDayAdvice(isNutritionTrainingDayToday, aiNutritionPageProfile?.goal);
    const aiNutritionScorePercent = Math.min(96, Math.max(8, Math.round((aiNutritionDay.score || 0) * 10)));
    const macroCaloriesProtein = Math.max(0, Number(nutritionTotals.protein) || 0) * 4;
    const macroCaloriesFat = Math.max(0, Number(nutritionTotals.fat) || 0) * 9;
    const macroCaloriesCarbs = Math.max(0, Number(nutritionTotals.carbs) || 0) * 4;
    const macroCaloriesTotal = Math.max(1, macroCaloriesProtein + macroCaloriesFat + macroCaloriesCarbs);
    const proteinCircleEnd = Math.round((macroCaloriesProtein / macroCaloriesTotal) * 100);
    const fatCircleEnd = Math.round(((macroCaloriesProtein + macroCaloriesFat) / macroCaloriesTotal) * 100);
    const aiNutritionScoreStyle = {
      background: `conic-gradient(#ff7d7d 0% ${proteinCircleEnd}%, #ffd15a ${proteinCircleEnd}% ${fatCircleEnd}%, #70cde3 ${fatCircleEnd}% 100%)`
    };

    return (
      <div className="fatSecretPage nutritionFixedHeaderV3">
        <button className="backBtn universalFixedBackPointer nutritionBackTopLeftV3" onClick={goBackToMain}>←</button>

        <section className="nutritionHeroV4">
          <div className="nutritionHeroTitleV4">
            <h1>{nutritionDateTitle}</h1>

          </div>

          <div className="nutritionWeekV4">
            {weekDates.map((day) => {
              const dayHasFood = Boolean(nutrition.days?.[day.key]?.foods?.length);
              const isSelectedDay = day.key === nutritionDateKey;
              const isTodayDay = day.key === todayNutritionKey();
              return (
                <button
                  type="button"
                  className={`nutritionDayV4 ${isSelectedDay ? "selected" : ""} ${dayHasFood ? "hasFood" : ""} ${isTodayDay ? "today" : ""}`}
                  key={day.key}
                  onClick={() => selectNutritionDate(day.key)}
                >
                  <span aria-hidden="true">{dayHasFood || isSelectedDay ? "✓" : ""}</span>
                  <small>{day.label}</small>
                </button>
              );
            })}
          </div>

          <div className="nutritionStreakV4">
            <span>{nutritionStreakText}</span>
          </div>
          <div className="nutritionQuickActionsExact">
            <button
              className="nutritionQuickActionExact"
              type="button"
              onClick={() => openNutritionPicker(nutritionMeal)}
            >
              <span className="nutritionQuickSearchIcon" aria-hidden="true" />
              <span>Поиск еды</span>
            </button>

            <div className="nutritionQuickActionsDivider" aria-hidden="true" />

            <button
              className="nutritionQuickActionExact"
              type="button"
              onClick={openNutritionCalendar}
            >
              <span className="nutritionQuickCalendarIcon" aria-hidden="true">🗓️</span>
              <span>Календарь</span>
            </button>
          </div>
        </section>

        {nutritionCalendarOpen && (
          <div className="nutritionCalendarOverlay" role="dialog" aria-modal="true" aria-label="Календарь">
            <button
              type="button"
              className="nutritionCalendarBackdrop"
              onClick={() => setNutritionCalendarOpen(false)}
              aria-label="Закрыть календарь"
            />

            <div className="nutritionCalendarSheet">
              <div className="nutritionCalendarGrabber" aria-hidden="true" />

              <div className="nutritionCalendarHeader">
                <button type="button" onClick={() => shiftNutritionCalendarMonth(-1)} aria-label="Предыдущий месяц">‹</button>
                <div>
                  <span>Календарь питания</span>
                  <strong>{getNutritionCalendarMonthLabel()}</strong>
                </div>
                <button type="button" onClick={() => shiftNutritionCalendarMonth(1)} aria-label="Следующий месяц">›</button>
              </div>

              <div className="nutritionCalendarWeekdays" aria-hidden="true">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="nutritionCalendarGrid">
                {getNutritionCalendarDays().map((day) => (
                  <button
                    type="button"
                    key={day.key}
                    className={[
                      "nutritionCalendarDay",
                      day.isCurrentMonth ? "" : "muted",
                      day.isToday ? "today" : "",
                      day.isSelected ? "selected" : "",
                      day.hasFood ? "hasFood" : "",
                      day.isOverGoal ? "overGoal" : ""
                    ].filter(Boolean).join(" ")}
                    onClick={() => selectNutritionDate(day.key)}
                  >
                    <strong>{day.dayNumber}</strong>
                    {day.hasFood && (
                      <small>{day.calories} ккал</small>
                    )}
                  </button>
                ))}
              </div>

              <div className="nutritionCalendarFooter">
                <button type="button" onClick={() => selectNutritionDate(todayNutritionKey())}>Сегодня</button>
                <button type="button" onClick={() => setNutritionCalendarOpen(false)}>Готово</button>
              </div>
            </div>
          </div>
        )}

        <section className={`nutritionCaloriesRenderCard ${isCaloriesOverGoal ? "overLimit" : ""} ${isNutritionTrainingDayToday ? "trainingDay" : ""}`}>
          <div className="nutritionCaloriesRenderGrid" aria-hidden="true">
            {Array.from({ length: 25 }).map((_, index) => (
              <span
                key={index}
                className={
                  index < Math.round((caloriePercent / 100) * 25)
                    ? "isActive"
                    : ""
                }
              />
            ))}
          </div>

          <div className="nutritionCaloriesRenderDivider" aria-hidden="true" />

          <div className="nutritionCaloriesRenderCol nutritionCaloriesRenderLeft">
            <span>Осталось Калорий</span>
            <strong>{caloriesLeft}</strong>
          </div>

          <div className="nutritionCaloriesRenderDivider" aria-hidden="true" />

          <div className="nutritionCaloriesRenderCol nutritionCaloriesRenderRight">
            <span>Получено</span>
            <strong>{caloriesConsumed}</strong>
          </div>
        </section>

        <section className="fatMealList">
          {nutritionMeals.map((meal) => {
            const stats = mealStats[meal.id] || { calories: 0, count: 0 };
            const hasFoods = stats.count > 0;
            const isExpanded = Boolean(expandedNutritionMeals[meal.id]);
            return (
              <div
                className={`fatMealCard ${isExpanded ? "open" : "collapsed"}`}
                key={meal.id}
              >
                <div
                  className="fatMealMain mealRowExact"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasFoods) {
                      setExpandedNutritionMeals((prev) => ({
                        ...prev,
                        [meal.id]: !prev[meal.id]
                      }));
                    } else {
                      openNutritionPicker(meal.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (hasFoods) {
                        setExpandedNutritionMeals((prev) => ({
                          ...prev,
                          [meal.id]: !prev[meal.id]
                        }));
                      } else {
                        openNutritionPicker(meal.id);
                      }
                    }
                  }}
                >
                  <div className="fatMealIcon mealIconExact">{meal.icon}</div>
                  <div className="fatMealTitle mealTitleExact">
                    <strong>{meal.name}</strong>
                    {hasFoods && <span>{stats.count} шт</span>}
                    <button
                      type="button"
                      className={`fatMealToggle mealToggleUnderCount ${!hasFoods ? "disabled" : ""}`}
                      aria-label={isExpanded ? "Свернуть список" : "Раскрыть список"}
                      disabled={!hasFoods}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasFoods) return;
                        setExpandedNutritionMeals((prev) => ({
                          ...prev,
                          [meal.id]: !prev[meal.id]
                        }));
                      }}
                    >
                      {isExpanded ? "⌃" : "⌄"}
                    </button>
                  </div>
                  <div className="fatMealKcal">
                    <strong>{Math.round(stats.calories)}</strong>
                    <span>Калории</span>

                  </div>

                  <div className="fatMealActions mealActionsExact">
                    <button
                      type="button"
                      className="fatPlusBtn mealPlusExact"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNutritionPicker(meal.id);
                      }}
                      aria-label={`Добавить еду: ${meal.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {hasFoods && isExpanded && (
                  <div className="fatMealItems productListExact productListWideFinal">
                    {(nutritionToday.foods || [])
                      .filter((item) => item.mealId === meal.id)
                      .map((item) => (
                        <div
                          className={`productSwipeShell ${deletingNutritionFoodId === item.id ? "deleting" : ""}`}
                          key={item.id}
                        >
                          <div className="productDeleteBg">
                            <span>🗑️</span>
                          </div>

                          <div
                            className={`productRowExact ${deletingNutritionFoodId === item.id ? "deleting" : ""}`}
                            style={{
                              width: "100%",
                              paddingLeft: "24px",
                              paddingRight: "24px",
                              transform: `translateX(${nutritionFoodSwipeOffsets[item.id] || 0}px)`,
                              opacity: deletingNutritionFoodId === item.id ? 0 : 1
                            }}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (nutritionFoodSwipeMoved.current[item.id]) return;
                              openNutritionFoodEditor(item);
                              setNutritionSearchTab("food");
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              openNutritionFoodEditor(item);
                              setNutritionSearchTab("food");
                            }}
                            onTouchStart={(event) => handleNutritionFoodSwipeStart(item.id, event)}
                            onTouchMove={(event) => handleNutritionFoodSwipeMove(item.id, event)}
                            onTouchEnd={(event) => handleNutritionFoodSwipeEnd(item.id, event)}
                            onTouchCancel={() => handleNutritionFoodSwipeCancel(item.id)}
                          >
                            <div className="productFoodIconWrap">
                              <span className="productFoodIcon" aria-hidden="true">
                                {item.icon || getFoodIcon(item)}
                              </span>

                              <span className="productFoodCaloriesUnder">
                                {Math.round(Number(item.calories) || 0)}
                                <small>ккал</small>
                              </span>
                            </div>

                            <div className="productInfoExact">
                              <strong>{item.name}</strong>
                              <span>{item.amount} г</span>
                            </div>

                            <div className="productArrowExact">›</div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className={`nutritionAiPlanDashboard ${isAiNutritionPlanExpanded ? "expanded" : "collapsed"} ${isCaloriesOverGoal ? "overLimit" : ""}`}>
          <div className="nutritionAiPlanHeader">
            <div className="nutritionAiPlanTitleBox">
              <span>AI-План питания</span>
              <h2>{aiNutritionGoalText}</h2>
            </div>
            <button
              type="button"
              className="nutritionAiPlanToggleBtn"
              aria-label={isAiNutritionPlanExpanded ? "Свернуть AI-план питания" : "Развернуть AI-план питания"}
              onClick={() => setIsAiNutritionPlanExpanded((expanded) => !expanded)}
            >
              {isAiNutritionPlanExpanded ? "⌃" : "⌄"}
            </button>
          </div>

          <div className={`nutritionAiTrainingDayPill ${isNutritionTrainingDayToday ? "active" : ""}`}>
            <span>{isNutritionTrainingDayToday ? "Тренировочный день" : "Обычный день"}</span>
            <small>{isNutritionTrainingDayToday ? `Сегодня: ${aiNutritionTodayPlanMacros.calories} ккал · У ${aiNutritionTodayPlanMacros.carbs} г` : "КБЖУ без тренировочной надбавки"}</small>
          </div>

          {!isAiNutritionPlanExpanded ? (
            <button
              type="button"
              className="nutritionAiPlanCollapsedCard"
              onClick={() => setIsAiNutritionPlanExpanded(true)}
              aria-label="Развернуть AI-план питания"
            >
              <div className="nutritionAiPlanCollapsedTop">
                <div>
                  <span>Осталось</span>
                  <strong>{caloriesLeft}</strong>
                </div>
                <div>
                  <span>Получено</span>
                  <strong>{caloriesConsumed}</strong>
                </div>
                <div className="score">
                  <span>Score</span>
                  <strong>{aiNutritionDay.score}</strong>
                </div>
              </div>

              <div className="nutritionAiPlanCollapsedMacros">
                <span>Б {roundMacro(nutritionTotals.protein)} / {effectiveNutritionGoals.protein} г</span>
                <span>Ж {roundMacro(nutritionTotals.fat)} / {effectiveNutritionGoals.fat} г</span>
                <span>У {roundMacro(nutritionTotals.carbs)} / {effectiveNutritionGoals.carbs} г</span>
              </div>

              <p>{isNutritionTrainingDayToday ? aiNutritionPageTrainingAdvice : aiNutritionDay.summary}</p>
            </button>
          ) : (
            <>
              <div className="nutritionAiPlanBody">
                <div className="nutritionAiPlanRsk">
                  <div className="nutritionAiPlanGrid" aria-hidden="true">
                    {Array.from({ length: 25 }).map((_, index) => (
                      <span
                        key={index}
                        className={index < Math.round((caloriePercent / 100) * 25) ? "active" : ""}
                      />
                    ))}
                  </div>

                  <div className="nutritionAiPlanRskRight">
                    <div className="nutritionAiPlanRskInfo">
                      <div>
                        <span>Осталось</span>
                        <strong>{caloriesLeft}</strong>
                      </div>
                      <i aria-hidden="true" />
                      <div>
                        <span>Получено</span>
                        <strong>{caloriesConsumed}</strong>
                      </div>
                    </div>

                    <div className="nutritionAiPlanRskFoot">
                      <span>{caloriePercent}% от РСК</span>
                      <strong>{effectiveNutritionGoals.calories} ккал</strong>
                    </div>
                  </div>
                </div>

                <div className="nutritionAiPlanScoreBlock">
                  <span>Score питания</span>
                  <div className="nutritionAiPlanScore" style={aiNutritionScoreStyle}>
                    <div>
                      <strong>{aiNutritionDay.score}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="nutritionAiPlanMacroPercent">
                <span><i className="protein" />Б {proteinPercent}%</span>
                <span><i className="fat" />Ж {fatPercent}%</span>
                <span><i className="carbs" />У {carbsPercent}%</span>
              </div>

              <div className="nutritionAiPlanMacros">
                <div>
                  <span>Белки</span>
                  <strong>{roundMacro(nutritionTotals.protein)} г</strong>
                  <small>/ {effectiveNutritionGoals.protein} г</small>
                </div>
                <div>
                  <span>Жиры</span>
                  <strong>{roundMacro(nutritionTotals.fat)} г</strong>
                  <small>/ {effectiveNutritionGoals.fat} г</small>
                </div>
                <div>
                  <span>Углеводы</span>
                  <strong>{roundMacro(nutritionTotals.carbs)} г</strong>
                  <small>/ {effectiveNutritionGoals.carbs} г</small>
                </div>
              </div>

              <div className="nutritionAiPlanConclusion">
                <span>Короткий вывод</span>
                <p>{aiNutritionDay.summary} {aiNutritionDay.adaptiveAdvice}</p>
              </div>

              <div className="nutritionAiPlanBadges">
                {aiNutritionDay.badges.map((badge) => (
                  <span className={badge.type} key={badge.text}>
                    <i>{badge.icon}</i>{badge.text}
                  </span>
                ))}
                <span className="info"><i>📅</i>Неделя {aiNutritionCurrentWeek}/4</span>
              </div>

              <div className="nutritionAiPlanWater">
                <div>
                  <span>Вода</span>
                  <strong>{waterPercent}%</strong>
                </div>
                <div>
                  <button type="button" onClick={() => addWater(250)}>+250 мл</button>
                  <button type="button" onClick={() => addWater(-250)}>−250 мл</button>
                </div>
              </div>
            </>
          )}
        </section>

        {nutritionPickerOpen && (
          <div className="fatFoodSearchOverlay">
            <section className="fatFoodSearchScreen fatFoodSearchScreenPremium">
              <div className="fatSearchTopPremium">
                {!selectedNutritionFood && (
                  <button
                    type="button"
                    className="fatSearchBackMini addFoodBackOnly"
                    onClick={() => {
                      setNutritionMealMenuOpen(false);
                      setSelectedNutritionFood(null);
                      setEditingNutritionItemId(null);
                      setNutritionPickerOpen(false);
                    }}
                    aria-label="Назад к питанию"
                  >
                    ←
                  </button>
                )}

                <div className="fatSearchTitleWrap">
                  <button
                    type="button"
                    className="fatSearchTitleButtonPremium"
                    onClick={() => setNutritionMealMenuOpen((open) => !open)}
                  >
                    <span>Добавить в</span>
                    <strong>{nutritionMeals.find((meal) => meal.id === nutritionMeal)?.name}</strong>
                  </button>

                  {nutritionMealMenuOpen && (
                    <div className="fatMealDropdown fatMealDropdownCentered">
                      {nutritionMeals.map((meal) => (
                        <button
                          type="button"
                          key={meal.id}
                          className={nutritionMeal === meal.id ? "active" : ""}
                          onClick={() => {
                            setNutritionMeal(meal.id);
                            setNutritionMealMenuOpen(false);
                          }}
                        >
                          <span>{meal.icon}</span>
                          <strong>{meal.name}</strong>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="fatMealDropdownCollapse"
                        onClick={() => setNutritionMealMenuOpen(false)}
                        aria-label="Свернуть выбор приёма пищи"
                      >
                        ↑
                      </button>
                    </div>
                  )}
                </div>

                {selectedNutritionFood && (
                  <button
                    type="button"
                    className="fatSearchClosePremium"
                    onClick={() => {
                      setNutritionMealMenuOpen(false);
                      setSelectedNutritionFood(null);
                      setEditingNutritionItemId(null);
                      setNutritionPickerOpen(false);
                    }}
                    aria-label="Закрыть поиск еды"
                  >
                    ×
                  </button>
                )}
              </div>

              {selectedNutritionFood ? (
                <div className="fatFoodAmountScreen foodEditRenderScreen">
                  {!nutritionEditPageOpen && (
                    <button
                      type="button"
                      className="foodEditBackOnly"
                      onClick={() => {
                        setNutritionMealMenuOpen(false);
                        setNutritionEditNote("");

                        if (editingNutritionItemId) {
                          setSelectedNutritionFood(null);
                          setEditingNutritionItemId(null);
                          setNutritionPickerOpen(false);
                          return;
                        }

                        setSelectedNutritionFood(null);
                        setNutritionEditDetailsOpen(false);
                        setNutritionEditOriginalFood(null);
                        setNutritionEditOriginalNote("");
                        setEditingNutritionItemId(null);
                        setNutritionSearchTab("food");
                      }}
                      aria-label={editingNutritionItemId ? "Назад к питанию" : "Назад к поиску еды"}
                    >
                      ←
                    </button>
                  )}

                  {!nutritionEditPageOpen && (
                    <div className="foodEditInlineMealHeader">
                      <span className="foodEditInlineMealLabel">Добавить в</span>

                      <button
                        type="button"
                        className="foodEditInlineMealButton"
                        onClick={() => setNutritionMealMenuOpen((open) => !open)}
                      >
                        {nutritionMeals.find((meal) => meal.id === nutritionMeal)?.name}
                      </button>

                      {nutritionMealMenuOpen && (
                        <div className="foodEditMealPickerDropdown foodEditMealPickerDropdownInline">
                          {nutritionMeals.map((meal) => (
                            <button
                              type="button"
                              key={meal.id}
                              className={nutritionMeal === meal.id ? "active" : ""}
                              onClick={() => {
                                setNutritionMeal(meal.id);
                                setNutritionMealMenuOpen(false);
                              }}
                            >
                              <span>{meal.icon}</span>
                              <strong>{meal.name}</strong>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!nutritionEditPageOpen && (
                    <button
                      type="button"
                      className="foodEditPencilButton foodEditPencilTopRight"
                      onClick={openNutritionEditPage}
                      aria-label="Редактировать продукт"
                    >
                      ✎
                    </button>
                  )}

                  <div className="foodEditHeroRender foodEditHeroEditable">
                    <div className="foodEditIconSourceStack">
                      <span className="foodEditIconRender">{selectedNutritionFood.icon || getFoodIcon(selectedNutritionFood)}</span>
                      <small>{selectedNutritionFood.source || selectedNutritionFood.portion || "Продукт"}</small>
                    </div>
                    <strong>{selectedNutritionFood.name}</strong>
                  </div>

                  <div className="foodEditSegmentRow">
                    <button
                      type="button"
                      className={nutritionAmountMode === "grams" ? "active weightModeButton" : "weightModeButton"}
                      onClick={() => {
                        saveNutritionPreferredUnit(selectedNutritionFood, "grams");
                        setNutritionProductUnitMenuOpen(false);
                        setNutritionAmountMode("grams");
                        setNutritionAmount("100");
                      }}
                    >
                      <span className="weightModeIcon">⚖</span>
                    </button>

                    <div className="foodEditPortionDropdown">
                      {(() => {
                        const unitOptions = getNutritionSmartUnits(selectedNutritionFood).filter((unit) => unit.id !== "grams");
                        const selectedUnitId = getNutritionSmartUnitId(selectedNutritionFood, nutritionAmount, nutritionAmountMode);
                        const selectedUnit = unitOptions.find((unit) => unit.id === selectedUnitId) || unitOptions[0];

                        return (
                          <>
                            <button
                              type="button"
                              className="foodEditPortionDropdownButton"
                              onClick={() => setNutritionProductUnitMenuOpen((open) => !open)}
                            >
                              <strong>{selectedUnit?.shortLabel || selectedUnit?.label || "Порция"}</strong>
                              <em>{nutritionProductUnitMenuOpen ? "⌃" : "⌄"}</em>
                            </button>

                            {nutritionProductUnitMenuOpen && (
                              <div className="foodEditPortionDropdownMenu">
                                {unitOptions.map((unit) => (
                                  <button
                                    type="button"
                                    key={unit.id}
                                    className={selectedUnitId === unit.id ? "active" : ""}
                                    onClick={() => {
                                      setNutritionAmountMode(unit.mode || "portion");
                                      setNutritionAmount(String(unit.amount || 100));
                                      saveNutritionPreferredUnit(selectedNutritionFood, unit.id);
                                      setNutritionProductUnitMenuOpen(false);

                                      if (unit.mode === "portion") {
                                        updateSelectedNutritionFoodField("portion", unit.portion || unit.label || "1 порция");
                                        updateSelectedNutritionFoodField("portionAmount", unit.portionAmount || unit.amount || 100);
                                      }
                                    }}
                                  >
                                    <span>{unit.shortLabel || unit.label}</span>
                                    {unit.hint && <small>{unit.hint}</small>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <label className="foodEditAmountCard">
                    <span>{nutritionAmountMode === "portion" ? `${selectedNutritionFood.portion || "Порция"}` : "Граммы"}</span>
                    <input
                      value={nutritionAmount}
                      onChange={(e) => setNutritionAmount(e.target.value)}
                      placeholder={nutritionAmountMode === "portion" ? "1" : "100"}
                      inputMode="decimal"
                    />
                  </label>

                  {(() => {
                    const scale = getFoodScale(nutritionAmount, selectedNutritionFood, nutritionAmountMode);
                    return (
                      <>
                        <div className="foodEditMacrosCards">
                          <div className="foodEditCaloriesMacroCard">
                            <span>Калории</span>
                            <strong>{Math.round(selectedNutritionFood.calories * scale)}</strong>
                            <small>ккал</small>
                          </div>
                          <div>
                            <span>Белки</span>
                            <strong>{roundMacro(selectedNutritionFood.protein * scale)}</strong>
                            <small>г</small>
                          </div>
                          <div>
                            <span>Жиры</span>
                            <strong>{roundMacro(selectedNutritionFood.fat * scale)}</strong>
                            <small>г</small>
                          </div>
                          <div>
                            <span>Углеводы</span>
                            <strong>{roundMacro(selectedNutritionFood.carbs * scale)}</strong>
                            <small>г</small>
                          </div>
                        </div>

                        <div className="foodEditRowsCard">
                          <button
                            type="button"
                            className={`foodEditRow ${nutritionEditNote ? "" : "muted"}`}
                            onClick={() => {
                              const nextNote = window.prompt("Заметка к продукту", nutritionEditNote || "");
                              if (nextNote === null) return;
                              setNutritionEditNote(nextNote);
                            }}
                          >
                            <span className="foodEditRowIcon">▤</span>
                            <span className="foodEditRowLabel">Заметка</span>
                            <strong>{nutritionEditNote.trim() || "Не добавлено"}</strong>
                            <em>›</em>
                          </button>
</div>
                      </>
                    );
                  })()}

                  {nutritionEditPageOpen && (
                    <div className="foodEditPageOverlay">
                      <div className="foodEditPageSheet">
                        <div className="foodEditPageHeader">
                          <button
                            type="button"
                            className="foodEditPageBack"
                            onClick={cancelNutritionEditPage}
                          >
                            ←
                          </button>

                          <strong className="foodEditPageTitleCenter">{selectedNutritionFood?.type === "dish" ? "Редактирование блюда" : "Редактирование продукта"}</strong>

<div className="foodEditHeaderSpacer" aria-hidden="true" />
                        </div>

                        <div className="foodEditPageContent">
                          <label>
                            <span>{selectedNutritionFood?.type === "dish" ? "Название блюда" : "Название продукта"}</span>
                            <input
                              value={selectedNutritionFood.name}
                              onChange={(event) => updateSelectedNutritionFoodField("name", event.target.value)}
                              placeholder="Название"
                            />
                          </label>

                          <div className="foodEditIconManualBox">
                            <div className="foodEditIconPreviewManual">
                              <span>{selectedNutritionFood.icon || getFoodIcon(selectedNutritionFood)}</span>
                            </div>

                            <label>
                              <span>Иконка</span>
                              <input
                                value={selectedNutritionFood.icon || ""}
                                onChange={(event) => updateSelectedNutritionFoodField("icon", event.target.value.slice(0, 4))}
                                placeholder="🍗"
                                maxLength={4}
                              />
                            </label>
                          </div>

                          <div className="foodEditIconPresetRow">
                            {NUTRITION_ICON_PRESETS.map((icon) => (
                              <button
                                type="button"
                                key={icon}
                                className={selectedNutritionFood.icon === icon ? "active" : ""}
                                onClick={() => updateSelectedNutritionFoodField("icon", icon)}
                                aria-label={`Выбрать иконку ${icon}`}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>

                          <div className="foodEditPageGrid">
                            <label>
                              <span>{selectedNutritionFood?.type === "dish" ? "Ккал всего" : "Ккал"}</span>
                              <input
                                value={selectedNutritionFood.calories}
                                onChange={(event) => updateSelectedNutritionFoodField("calories", event.target.value)}
                                inputMode="decimal"
                              />
                            </label>

                            <label>
                              <span>{selectedNutritionFood?.type === "dish" ? "Белки всего" : "Белки"}</span>
                              <input
                                value={selectedNutritionFood.protein}
                                onChange={(event) => updateSelectedNutritionFoodField("protein", event.target.value)}
                                inputMode="decimal"
                              />
                            </label>

                            <label>
                              <span>{selectedNutritionFood?.type === "dish" ? "Жиры всего" : "Жиры"}</span>
                              <input
                                value={selectedNutritionFood.fat}
                                onChange={(event) => updateSelectedNutritionFoodField("fat", event.target.value)}
                                inputMode="decimal"
                              />
                            </label>

                            <label>
                              <span>{selectedNutritionFood?.type === "dish" ? "Углеводы всего" : "Углеводы"}</span>
                              <input
                                value={selectedNutritionFood.carbs}
                                onChange={(event) => updateSelectedNutritionFoodField("carbs", event.target.value)}
                                inputMode="decimal"
                              />
                            </label>
                          </div>

                          <label className="foodEditPortionLabel">
                            <span>{selectedNutritionFood?.type === "dish" ? "Итоговый вес блюда" : "Порция"}</span>
                            <div className="foodEditPortionUnitRow foodEditPortionInlineUnit">
                              <input
                                value={String(selectedNutritionFood?.type === "dish" ? (selectedNutritionFood.totalWeight || selectedNutritionFood.portionAmount || "") : selectedNutritionFood.portion || "").replace(/\s?(г|гр|g|мл|ml)$/iu, "").trim()}
                                onChange={(event) => {
                                  if (selectedNutritionFood?.type === "dish") {
                                    updateSelectedDishTotalWeight(event.target.value);
                                    return;
                                  }

                                  const unit = String(selectedNutritionFood.portion || "").toLowerCase().includes("мл") ? "мл" : "г";
                                  updateSelectedNutritionFoodField("portion", `${event.target.value} ${unit}`);
                                  updateSelectedNutritionFoodField("portionAmount", event.target.value);
                                }}
                                placeholder="100"
                              />
                              <button
                                type="button"
                                className="foodEditPortionUnitToggle"
                                onClick={() => {
                                  const currentUnit = String(selectedNutritionFood.portion || "").toLowerCase().includes("мл") ? "мл" : "г";
                                  updateSelectedNutritionPortionUnit(currentUnit === "г" ? "мл" : "г");
                                }}
                                aria-label="Сменить единицу порции"
                              >
                                {String(selectedNutritionFood.portion || "").toLowerCase().includes("мл") ? "мл" : "г"}
                              </button>
                            </div>
                          </label>

                          {selectedNutritionFood?.type === "dish" && (
                            <div className="dishEditIngredientsBox">
                              <div className="dishEditIngredientsHeader">
                                <div>
                                  <strong>Ингредиенты</strong>
                                  <span>{(selectedNutritionFood.ingredients || []).length} шт</span>
                                </div>

                                <button type="button" onClick={openDishIngredientPicker}>
                                  + ингредиент
                                </button>
                              </div>

                              {(selectedNutritionFood.ingredients || []).length === 0 ? (
                                <div className="dishEditIngredientsEmpty">
                                  Добавь продукты, из которых состоит блюдо
                                </div>
                              ) : (
                                <div className="dishEditIngredientsList">
                                  {(selectedNutritionFood.ingredients || []).map((ingredient) => (
                                    <div className="dishEditIngredientRow" key={ingredient.id}>
                                      <em>{ingredient.icon || getFoodIcon(ingredient.name)}</em>
                                      <span>{ingredient.name}</span>
                                      <strong>
                                        {ingredient.grams || 0} г
                                        <small>{Math.round(parseNutritionNumber(ingredient.baseCalories, 0) * (parseNutritionNumber(ingredient.grams, 0) / (parseNutritionNumber(ingredient.baseAmount, 100) || 100)))} ккал</small>
                                      </strong>
                                      <button type="button" onClick={() => removeSelectedDishIngredient(ingredient.id)}>
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {dishIngredientPickerOpen && (
                            <div className="dishIngredientPickerOverlay" onClick={() => setDishIngredientPickerOpen(false)}>
                              <div className="dishIngredientPickerSheet" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
                                <div className="dishIngredientPickerHeader">
                                  <button type="button" onClick={() => setDishIngredientPickerOpen(false)}>×</button>
                                  <strong>Добавить ингредиент</strong>
                                </div>

                                <div className="dishIngredientSearchBox">
                                  <span>⌕</span>
                                  <input
                                    value={dishIngredientSearch}
                                    onChange={(event) => setDishIngredientSearch(event.target.value)}
                                    placeholder="Поиск продукта..."
                                    enterKeyHint="done"
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        event.currentTarget.blur();
                                      }
                                    }}
                                  />
                                </div>

                                <div className="dishIngredientResults">
                                  {(() => {
                                    const cleanQuery = dishIngredientSearch.trim().toLowerCase();
                                    const myFoodsList = getMyFoodsArray(nutrition);
                                    const recentFoodsList = (recentNutritionFoods || []).map(normalizeNutritionFood);

                                    const externalFoodsList = (dishIngredientExternalFoods || []).map(normalizeNutritionFood);

                                    const allFoods = [
                                      ...myFoodsList,
                                      ...recentFoodsList,
                                      ...externalFoodsList,
                                      ...nutritionFoodDatabase.map(normalizeNutritionFood),
                                      ...dishIngredientFallbackSuggestions.map((name) => normalizeNutritionFood({
                                        id: `suggestion_${name}`,
                                        foodId: `suggestion_${name}`,
                                        name,
                                        portion: "100 г",
                                        portionAmount: 100,
                                        calories: 0,
                                        protein: 0,
                                        fat: 0,
                                        carbs: 0,
                                        source: "AI/FatSecret",
                                        icon: getFoodIcon(name)
                                      }))
                                    ];

                                    const uniqueFoods = [];
                                    const seenFoodIds = new Set();

                                    allFoods.forEach((food) => {
                                      const normalizedFood = normalizeNutritionFood(food);
                                      const key = normalizedFood.foodId || normalizedFood.id || normalizedFood.name;
                                      if (seenFoodIds.has(key)) return;
                                      seenFoodIds.add(key);
                                      uniqueFoods.push(normalizedFood);
                                    });

                                    const results = uniqueFoods
                                      .filter((food) => {
                                        if (!cleanQuery) return true;
                                        const foodName = String(food.name || "").toLowerCase();
                                        const shortName = getSearchHistoryName(food).toLowerCase();
                                        return foodName.includes(cleanQuery) || shortName.includes(cleanQuery);
                                      })
                                      .slice(0, 18);

                                    if (results.length === 0) {
                                      if (dishIngredientLoading) {
                                        return (
                                          <div className="dishIngredientEmpty">
                                            Ищу через AI/FatSecret...
                                          </div>
                                        );
                                      }

                                      if (cleanQuery.length >= 2) {
                                        const manualFood = normalizeNutritionFood({
                                          id: `manual_${cleanQuery}`,
                                          foodId: `manual_${cleanQuery}`,
                                          name: dishIngredientSearch.trim(),
                                          portion: "100 г",
                                          portionAmount: 100,
                                          calories: 0,
                                          protein: 0,
                                          fat: 0,
                                          carbs: 0,
                                          source: "Вручную",
                                          icon: getFoodIcon(dishIngredientSearch)
                                        });

                                        return (
                                          <button
                                            type="button"
                                            className="dishIngredientResultCard dishIngredientManualCard"
                                            onClick={() => {
                                              setPendingDishIngredient(manualFood);
                                              setPendingDishIngredientGrams("100");
                                            }}
                                          >
                                            <span>{manualFood.icon}</span>
                                            <div>
                                              <strong>{manualFood.name}</strong>
                                              <small>Добавить вручную · КБЖУ можно уточнить позже</small>
                                            </div>
                                            <em>＋</em>
                                          </button>
                                        );
                                      }

                                      return (
                                        <div className="dishIngredientEmpty">
                                          Ничего не найдено
                                        </div>
                                      );
                                    }

                                    return (
                                      <>
                                        {dishIngredientLoading && (
                                          <div className="dishIngredientSearchLoading">
                                            Ищу ещё варианты через AI/FatSecret…
                                          </div>
                                        )}

                                        {results.map((food) => (
                                      <button
                                        type="button"
                                        key={`dish_ing_${food.id}_${food.name}`}
                                        className="dishIngredientResultCard"
                                        onClick={() => {
                                          setPendingDishIngredient(food);
                                          setPendingDishIngredientGrams(String(getFoodPortionAmount(food) || 100));
                                        }}
                                      >
                                        <span>{food.icon || getFoodIcon(food)}</span>
                                        <div>
                                          <strong>{food.name}</strong>
                                          <small>{food.source || "Продукт"} · {Math.round(Number(food.calories) || 0)} ккал</small>
                                        </div>
                                        <em>＋</em>
                                      </button>
                                        ))}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}

                          {pendingDishIngredient && (
                            <div className="dishIngredientConfirmOverlay">
                              <div className="dishIngredientConfirmCard">
                                <div className="dishIngredientConfirmTop">
                                  <div className="dishIngredientConfirmIcon">
                                    {pendingDishIngredient.icon || getFoodIcon(pendingDishIngredient)}
                                  </div>

                                  <div className="dishIngredientConfirmInfo">
                                    <strong>{pendingDishIngredient.name}</strong>
                                    <span>
                                      {pendingDishIngredient.source || "Продукт"} · {Math.round(Number(pendingDishIngredient.calories) || 0)} ккал
                                    </span>
                                  </div>
                                </div>

                                <label className="dishIngredientConfirmInput">
                                  <span>Сколько грамм добавить?</span>

                                  <div>
                                    <input
                                      value={pendingDishIngredientGrams}
                                      onChange={(event) => setPendingDishIngredientGrams(event.target.value)}
                                      placeholder="100"
                                      inputMode="decimal"
                                      enterKeyHint="done"
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          event.currentTarget.blur();
                                        }
                                      }}
                                    />

                                    <em>г</em>
                                  </div>
                                </label>

                                <div className="dishIngredientConfirmActions">
                                  <button
                                    type="button"
                                    className="dishIngredientConfirmCancel"
                                    onClick={() => {
                                      setPendingDishIngredient(null);
                                      setPendingDishIngredientGrams("100");
                                    }}
                                  >
                                    Отмена
                                  </button>

                                  <button
                                    type="button"
                                    className="dishIngredientConfirmAdd"
                                    onClick={() => {
                                      addSelectedDishIngredientFromFood(
                                        pendingDishIngredient,
                                        pendingDishIngredientGrams
                                      );

                                      setPendingDishIngredient(null);
                                      setPendingDishIngredientGrams("100");
                                    }}
                                  >
                                    Добавить
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <label>
                            <span>Заметка</span>
                            <textarea
                              value={nutritionEditNote}
                              onChange={(event) => setNutritionEditNote(event.target.value)}
                              rows={5}
                              placeholder={selectedNutritionFood?.type === "dish" ? "Например: рецепт, способ приготовления, порции" : "Добавить заметку"}
                            />
                          </label>

                          <button
                            type="button"
                            className="foodEditPageSave foodEditPageSaveBottom"
                            onClick={confirmNutritionEditPage}
                          >
                            <span className="foodEditSaveIcon">💾</span>
                            <span>Готово</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="foodEditBottomActions">
                    <button
                      type="button"
                      className="foodEditDeleteButton"
                      onClick={() => {
                        const editId = String(editingNutritionItemId || "");
                        const selectedId = String(selectedNutritionFood?.id || selectedNutritionFood?.foodId || "");
                        const selectedSource = String(selectedNutritionFood?.source || "");
                        const isMyProduct =
                          editId.startsWith("my:") ||
                          selectedId.startsWith("my_") ||
                          selectedSource === "Моя база" ||
                          nutrition.myFoods?.[selectedId];

                        if (isMyProduct) {
                          const myFoodId = editId.startsWith("my:")
                            ? editId.replace("my:", "")
                            : (nutrition.myFoods?.[selectedId] ? selectedId : makePersonalFoodKey(selectedNutritionFood));

                          removeMyNutritionFood(myFoodId, selectedNutritionFood?.name || "");
                          setSelectedNutritionFood(null);
                          setEditingNutritionItemId(null);
                          setNutritionEditDetailsOpen(false);
                          setNutritionEditPageOpen(false);
                          setNutritionEditNote("");
                          setNutritionAmount("100");
                          setNutritionSearch("");
                          setNutritionSearchTab("my");
                          setShowRecentNutritionFoods(false);
                          setNutritionMealMenuOpen(false);
                          setNutritionPickerOpen(true);
                          return;
                        }

                        if (!editingNutritionItemId) return;

                        removeNutritionFood(editingNutritionItemId);
                        setSelectedNutritionFood(null);
                        setEditingNutritionItemId(null);
                        setNutritionEditDetailsOpen(false);
                        setNutritionEditPageOpen(false);
                        setNutritionEditNote("");
                        setNutritionPickerOpen(false);
                      }}
                    >
                      <span className="foodEditDeleteIcon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M9 4h6l1 2h4" />
                          <path d="M4 7h16" />
                          <path d="M7 7l1 13h8l1-13" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </span>
                      <span>Удалить</span>
                    </button>

                    <button
                      type="button"
                      className="fatAmountAddButton foodEditSaveRender"
                      onClick={confirmNutritionFoodFromPicker}
                    >
                      {editingNutritionItemId ? "Сохранить" : "Добавить"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="fatSearchInputWrapPremium">
                    <span>⌕</span>
                    <input
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
                      value={nutritionSearch}
                      onChange={(e) => {
                        setNutritionSearch(e.target.value);
                        setNutritionSearchTab("food");
                        setShowRecentNutritionFoods(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Поиск еды, бренда или блюда..."
                    />
                    {nutritionSearch && (
                      <button type="button" onClick={() => {
                        setNutritionSearch("");
                        setNutritionFallbackSuggestions([]);
                      }} aria-label="Сбросить поиск">×</button>
                    )}
                  </div>

{nutritionPhotoAnalyzing && nutritionSearchTab !== "my" && nutritionSearchTab !== "recent" && (
                    <div className="fatPhotoAiSearchProcess">
                      <div className="fatPhotoAiSearchOrbit" aria-hidden="true">
                        <i />
                        <span />
                      </div>
                      <div>
                        <strong>ИИ ищет продукт по фото</strong>
                        <p>Анализирую изображение, название, этикетку и порцию.</p>
                      </div>
                    </div>
                  )}

                  {!nutritionPhotoAnalyzing && nutritionSearchTab !== "my" && nutritionSearchTab !== "recent" && !showRecentNutritionFoods && nutritionSearch.trim().length < 2 && recentNutritionFoods.length > 0 && (
                    <div className="fatSearchHistoryNames">
                      <div className="fatSearchHistoryNamesTitle">История поиска</div>
                      <div className="fatSearchHistoryNamesList">
                        {recentNutritionFoods.slice(0, 8).map((food, index) => {
                          const foodName = getSearchHistoryName(food);
                          if (!foodName) return null;

                          return (
                            <button
                              type="button"
                              key={`search_history_name_only_${foodName}_${index}`}
                              className="fatSearchHistoryNameButton"
                              data-history-name-only="true"
                              title={foodName}
                              onClick={() => {
                                setNutritionSearch(foodName);
                                setNutritionSearchTab("food");
                                setShowRecentNutritionFoods(false);
                              }}
                            >
                              <span>{foodName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="fatSearchListPremium">
                    {nutritionSearchTab === "recent" && showRecentNutritionFoods && recentNutritionFoods.length > 0 && (
                      <div className="fatRecentFoods">
                        <div className="fatRecentFoodsTitle">Недавние продукты</div>
                        {recentNutritionFoods.map((food) => (
                          <button
                            type="button"
                            key={`${food.name}_${food.calories}_${food.source}`}
                            className="fatRecentFoodButton"
                            onClick={() => {
                              setNutritionSearch(food.name.split(" — ")[0]);
                              saveRecentNutritionFood(food);
                              setSelectedNutritionFood(food);
                            }}
                          >
                            <span>{food.name}</span>
                            <strong>{food.calories} ккал</strong>
                          </button>
                        ))}
                      </div>
                    )}

                    {!nutritionPhotoAnalyzing && fatSecretError && <div className="fatSearchStatus error">{fatSecretError}</div>}
                    {!fatSecretLoading && nutritionSearch.trim().length >= 2 && nutritionSearchResults.length === 0 && (
                      <div className="fatSearchStatus">
                        <strong>В моей базе нет — ищу через AI/FatSecret</strong>
                        {nutritionFallbackSuggestions.length > 0 && (
                          <div className="fatFallbackSuggestions">
                            {nutritionFallbackSuggestions.map((suggestion) => (
                              <button
                                type="button"
                                key={suggestion}
                                onClick={() => {
                                  if (suggestion.includes("фото")) {
                                    nutritionPhotoInputRef.current?.click();
                                  } else if (suggestion.includes("штрихкод")) {
                                    setFatSecretError("");
                                    setBarcodeScannerOpen(true);
                                  } else {
                                    setNutritionCreateChoiceOpen(true);
                                  }
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {nutritionSearchTab === "my" && nutritionSearchResults.length === 0 && (
                      <div className="fatSearchStatus myProductsEmptyState">
                        <strong>Пока нет своих продуктов</strong>
                        <span>Создай продукт или блюдо — они появятся здесь.</span>
                      </div>
                    )}

                    {nutritionSearchResults.map((food) => {
                      const normalizedFood = normalizeNutritionFood(food);
                      return (
                        <button
                          type="button"
                          className="fatSearchResultCard"
                          key={normalizedFood.id}
                          onClick={() => {
                            const isMyFoodResult =
                              nutritionSearchTab === "my" ||
                              Boolean(nutrition.myFoods?.[normalizedFood.id] || nutrition.myFoods?.[normalizedFood.foodId]);

                            if (isMyFoodResult) {
                              const myFoodId = normalizedFood.id || normalizedFood.foodId;
                              saveRecentNutritionFood(normalizedFood);
                              setSelectedNutritionFood({
                                ...normalizedFood,
                                id: myFoodId,
                                foodId: myFoodId,
                                source: "Моя база",
                                icon: normalizedFood.icon || getFoodIcon(normalizedFood)
                              });
                              setEditingNutritionItemId(`my:${myFoodId}`);
                              setNutritionAmount(String(normalizedFood.lastAmount || normalizedFood.portionAmount || 100));
                              setNutritionAmountMode(normalizedFood.amountMode || "grams");
                              setNutritionEditNote("");
                              setNutritionEditDetailsOpen(false);
                              setNutritionEditPageOpen(false);
                              setNutritionMealMenuOpen(false);
                              setShowRecentNutritionFoods(false);
                              return;
                            }

                            addNutritionFoodFromPicker(normalizedFood);
                          }}
                        >
                          <span className="fatSearchResultIcon" aria-hidden="true">{normalizedFood.icon || getFoodIcon(normalizedFood)}</span>
                          <div className="fatSearchResultInfo">
                            <strong>{getShortFoodName(normalizedFood.name)}</strong>
                            <span>
                              <em>{getFoodDisplayPortion(normalizedFood)}</em>
                              <small>
                                {(nutrition.myFoods?.[normalizedFood.id] || nutrition.myFoods?.[normalizedFood.foodId]) ? "Моя база · " : "AI/FatSecret · "}
                                РСК {getFoodRskPercent(normalizedFood, nutrition.goals)}% · {Math.round(Number(normalizedFood.calories) || 0)} ккал
                              </small>
                            </span>
                          </div>
                          <span className="fatSearchResultCheck" aria-hidden="true" />
                        </button>
                      );
                    })}

                    {fatSecretLoading && nutritionSearch.trim().length >= 2 && (
                      <div className="fatAiLoadingBelow">
                        <span />
                        <strong>Ищу ещё варианты через AI/FatSecret…</strong>
                      </div>
                    )}
                  </div>

                  <div className="fatSearchBottomBar">
                    <button
                      type="button"
                      onClick={() => nutritionPhotoInputRef.current?.click()}
                    >
                      <span>📷</span>
                      <strong>ИИ фото</strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNutritionCreateChoiceOpen(true)}
                    >
                      <span>＋</span>
                      <strong>Создать</strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFatSecretError("");
                        setBarcodeScannerOpen(true);
                      }}
                    >
                      <span>▦</span>
                      <strong>Штрихкод</strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNutritionSearch("");
                        setNutritionSearchTab("my");
                        setShowRecentNutritionFoods(false);
                      }}
                    >
                      <span>💾</span>
                      <strong>Мои продукты</strong>
                    </button>
                  </div>

                  {nutritionCreateChoiceOpen && (
                    <div className="nutritionCreateChoiceOverlay" onClick={() => setNutritionCreateChoiceOpen(false)}>
                      <div className="nutritionCreateChoiceSheet" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="nutritionCreateChoiceClose"
                          onClick={() => setNutritionCreateChoiceOpen(false)}
                          aria-label="Закрыть выбор создания"
                        >
                          ×
                        </button>

                        <h3>Что создать?</h3>
                        <p>Выбери обычный продукт или блюдо из нескольких продуктов.</p>

                        <div className="nutritionCreateChoiceGrid">
                          <button type="button" onClick={createCustomNutritionFood}>
                            <span>＋</span>
                            <strong>Продукт</strong>
                            <small>КБЖУ на 100 г или порцию</small>
                          </button>

                          <button type="button" onClick={createCustomNutritionDish}>
                            <span>🍲</span>
                            <strong>Блюдо</strong>
                            <small>Итоговый вес и КБЖУ блюда</small>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <input
                    ref={nutritionPhotoInputRef}
                    className="fatPhotoAiInput"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleNutritionPhotoAiSearch}
                  />

                  {nutritionPhotoPreview && (
                    <div className={`fatPhotoAiFloatingPreview ${nutritionPhotoAnalyzing ? "isAnalyzing" : ""}`}>
                      <div className="fatPhotoAiPreviewImage">
                        <img src={nutritionPhotoPreview} alt="Фото продукта" />
                        {nutritionPhotoAnalyzing && <span className="fatPhotoAiScanLine" aria-hidden="true" />}
                      </div>

                      <div className="fatPhotoAiPreviewText">
                        <div className="fatPhotoAiPreviewTop">
                          <strong>{nutritionPhotoAnalyzing ? "Анализирую фото" : "Распознано"}</strong>
                          {nutritionPhotoAiConfidence && <em>{nutritionPhotoAiConfidence}</em>}
                        </div>

                        <span>
                          {nutritionPhotoAnalyzing
                            ? "Ищу продукт в базе"
                            : selectedNutritionFood?.name || nutritionPhotoAiResult?.replace(/^ИИ распознал:\s*/i, "").replace(/^Ниже показаны варианты из базы\.?$/i, "") || "Выбери вариант из списка"}
                        </span>

                        {nutritionPhotoAiCandidates.length > 1 && !nutritionPhotoAnalyzing && (
                          <div className="fatPhotoAiCandidates">
                            {nutritionPhotoAiCandidates.slice(0, 3).map((candidate) => (
                              <button
                                type="button"
                                key={`${candidate.id}-${candidate.name}`}
                                onClick={() => selectNutritionPhotoAiCandidate(candidate)}
                              >
                                <span>{candidate.icon || getFoodIcon(candidate)}</span>
                                <strong>{getShortFoodName(candidate.name)}</strong>
                              </button>
                            ))}
                          </div>
                        )}

                        {nutritionPhotoAnalyzing && (
                          <div className="fatPhotoAiAnalyzeDots" aria-hidden="true">
                            <i /><i /><i />
                          </div>
                        )}
                      </div>

                      <button type="button" className="fatPhotoAiClear" onClick={resetNutritionPhotoAiSearch} aria-label="Убрать фото">×</button>
                    </div>
                  )}
                </>
              )}

              {barcodeScannerOpen && (
                <div className="fatBarcodeOverlay">
                  <div className="fatBarcodeCard">
                    <button type="button" className="fatBarcodeClose" onClick={() => setBarcodeScannerOpen(false)}>×</button>
                    <h3>Сканер штрихкода</h3>
                    <video ref={barcodeVideoRef} playsInline muted />
                    {barcodeScannerError && <p>{barcodeScannerError}</p>}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

</div>
    );
  }


  if (page === "measurementWizard") {
    const activeProfile = {
      ...(aiNutritionProfile || {}),
      ...aiNutritionProfileDraft
    };
    const latestProfileMeasurement = Array.isArray(profileMeasurements) && profileMeasurements.length
      ? profileMeasurements[0]
      : null;
    const measurementFields = getProfileMeasurementFields(activeProfile?.goal || "recomp");
    const totalWizardScreens = measurementFields.length + 2;
    const isIntroStep = profileMeasurementWizardStep === 0;
    const isReviewStep = profileMeasurementWizardStep === totalWizardScreens - 1;
    const activeField = !isIntroStep && !isReviewStep ? measurementFields[profileMeasurementWizardStep - 1] : null;
    const progressPercent = Math.max(4, Math.round(((profileMeasurementWizardStep + 1) / totalWizardScreens) * 100));

    const closeMeasurementWizard = () => {
      setProfileMeasurementWizardStep(0);
      setProfileMeasurementOpen(false);
      setProfileActiveTab("measurements");
      setPage("profile");
    };

    return (
      <div className="measurementFullscreenPage">
        <div className="measurementFullscreenHeader">
          <button type="button" className="measurementFullscreenBack" onClick={closeMeasurementWizard}>←</button>
          <div className="measurementFullscreenProgress">
            <span>Шаг {profileMeasurementWizardStep + 1} из {totalWizardScreens}</span>
            <i><em style={{ width: `${progressPercent}%` }} /></i>
          </div>
          <button type="button" className="measurementFullscreenClose" onClick={closeMeasurementWizard}>×</button>
        </div>

        <main className="measurementFullscreenBody">
          {isIntroStep && (
            <section className="measurementFullscreenCard intro">
              <div className="profileMeasurementWizardVisual measurementIntroVisual">
                <div className="profileMeasurementMiniHuman">
                  <i />
                  <b />
                  <em />
                </div>
              </div>

              <h2>Как выполнять замеры</h2>
              <p>Мерь утром, одной и той же лентой, в спокойном состоянии. Не втягивай живот и не затягивай ленту слишком сильно.</p>

              <div className="profileMeasurementTips">
                <span>Одинаковое время</span>
                <span>Одна лента</span>
                <span>Без натяжения</span>
                <span>Фото можно делать отдельно</span>
              </div>
            </section>
          )}

          {activeField && (
            <section className="measurementFullscreenCard measurement">
              <div className={`measurementFullscreenImageFrame zone-${activeField.id}`}>
                <img
                  src={`/measurements/${activeField.id}.png`}
                  alt={activeField.label}
                  className="measurementFullscreenImage"
                  loading="eager"
                />
              </div>

              <div className="measurementFullscreenText">
                <h2>{activeField.label}</h2>
                <p>{activeField.hint}</p>
              </div>

              <label className="measurementFullscreenInput">
                <div>
                  <input
                    inputMode="decimal"
                    value={profileMeasurementDraft[activeField.id] || ""}
                    placeholder={activeField.placeholder}
                    onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, [activeField.id]: event.target.value }))}
                  />
                  <em>{activeField.unit}</em>
                </div>
              </label>

              <small className="measurementFullscreenPrevious">
                Прошлый раз: {activeField.id === "weight" ? (activeProfile?.weight || "—") : "—"} {activeField.unit}
              </small>
            </section>
          )}

          {isReviewStep && (
            <section className="measurementFullscreenCard review">
              <h2>Проверь данные</h2>
              <p>Если всё верно — сохрани контрольный замер. Пустые поля можно оставить пустыми.</p>

              <div className="measurementFullscreenReviewGrid">
                {measurementFields.map((field) => (
                  <div key={field.id}>
                    <span>{field.label}</span>
                    <strong>{profileMeasurementDraft[field.id] || "—"}</strong>
                    <small>{field.unit}</small>
                  </div>
                ))}
              </div>

              <label className="profileMeasurementNote wizardNote">
                <span>Заметка</span>
                <textarea
                  value={profileMeasurementDraft.note || ""}
                  placeholder="Например: утром, после тренировки, самочувствие..."
                  onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, note: event.target.value }))}
                />
              </label>

              <button
                type="button"
                className="measurementFullscreenSave"
                disabled={profileMeasurementSaving}
                onClick={saveProfileMeasurement}
              >
                {profileMeasurementSaving ? "Сохраняю..." : "Сохранить замер"}
              </button>
            </section>
          )}
        </main>

        {profileMeasurementStatus && (
          <p className="measurementFullscreenStatus">{profileMeasurementStatus}</p>
        )}

        <div className="measurementFullscreenNav">
          <button
            type="button"
            disabled={profileMeasurementWizardStep === 0}
            onClick={() => setProfileMeasurementWizardStep((step) => Math.max(0, step - 1))}
          >
            ← Назад
          </button>

          {!isReviewStep ? (
            <button
              type="button"
              className="next"
              onClick={() => setProfileMeasurementWizardStep((step) => Math.min(totalWizardScreens - 1, step + 1))}
            >
              Вперёд →
            </button>
          ) : (
            <button
              type="button"
              className="next"
              disabled={profileMeasurementSaving}
              onClick={saveProfileMeasurement}
            >
              Сохранить
            </button>
          )}
        </div>
      </div>
    );
  }

  if (page === "profile") {
    const totalWorkouts = history.length;
    const lastWorkout = history[0];
    const activeProfile = {
      ...(aiNutritionProfile || {}),
      ...aiNutritionProfileDraft
    };
    const latestProfileMeasurement = Array.isArray(profileMeasurements) && profileMeasurements.length
      ? profileMeasurements[0]
      : null;
    const activeGoalLabel = getAiNutritionGoalLabel(activeProfile?.goal || "recomp");
    const activeActivityLabel = getAiNutritionActivityLabel(activeProfile?.activity || "medium");
    const assignedProgramName = user?.assignedProgramName || aiNutritionProfile?.assignedProgramName || "";
    const trainingDaysText = getAiNutritionTrainingDays(activeProfile).length
      ? AI_NUTRITION_WEEK_DAYS
          .filter((day) => getAiNutritionTrainingDays(activeProfile).includes(day.id))
          .map((day) => day.short)
          .join(", ")
      : "не выбраны";
    const todayTotals = getAiNutritionTotalsForToday(nutrition);
    const liveNutritionPreviewPlan = buildAiNutritionMonthlyPlan(nutrition, activeProfile, history, null);
    const activePlan = liveNutritionPreviewPlan || aiNutritionSavedPlan || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);
    const activeWeek = activePlan?.weeks?.[getAiNutritionCurrentWeek(activePlan) - 1] || activePlan?.weeks?.[0];
    const profileMacros = getAiNutritionDayMacros(activeWeek || nutrition.goals, activeProfile);

    const profileAiNutritionPlan = activePlan;
    const profileAiNutritionDay = buildAiNutritionDayModel(nutrition, nutrition.days?.[nutritionDateKey], history);
    const profileAiNutritionWeekNumber = getAiNutritionCurrentWeek(profileAiNutritionPlan);
    const profileAiNutritionWeek = profileAiNutritionPlan?.weeks?.[profileAiNutritionWeekNumber - 1] || profileAiNutritionPlan?.weeks?.[0];
    const profileAiNutritionActiveProfile = profileAiNutritionPlan?.profile || activeProfile;
    const profileIsAiTrainingDayToday = isAiNutritionTrainingDay(profileAiNutritionActiveProfile);
    const profileAiNutritionTodayMacros = getAiNutritionDayMacros(profileAiNutritionWeek || nutrition.goals, profileAiNutritionActiveProfile);
    const profileAiNutritionTrainingAdvice = getAiNutritionTrainingDayAdvice(profileIsAiTrainingDayToday, profileAiNutritionActiveProfile?.goal);
    const lastWorkoutDate = formatProfileWorkoutDate(lastWorkout?.date);
    const nextTrainingText = getProfileNextTrainingText(activeProfile, user);
    const currentGoalId = activeProfile?.goal || "recomp";
    const progressTone = currentGoalId === "mass"
      ? "Набираем массу аккуратно"
      : currentGoalId === "cut" || currentGoalId === "dry"
        ? "Снижаем вес без потери мышц"
        : currentGoalId === "maintain"
          ? "Держим форму стабильно"
          : "Рекомпозиция идёт по плану";
    const greetingName = telegramProfile.displayName || auth.currentUser?.email?.split("@")?.[0] || "спортсмен";
    const profileStreak = Math.min(30, Math.max(0, totalWorkouts));
    const aiProgressScore = Math.min(92, 58 + totalWorkouts * 4);
    const aiCoachSummary = currentGoalId === "maintain"
      ? "Вес и режим держим ровно. Контрольные замеры помогут не пропустить скрытый откат."
      : currentGoalId === "recomp"
        ? "Вес может стоять, но талия и объёмы должны меняться. Следи за замерами раз в неделю."
        : currentGoalId === "mass"
          ? "Рост веса должен идти плавно. Если талия растёт быстрее силы — снизим профицит."
          : "Главный фокус — талия, вес и восстановление. Слишком резкий спад может просадить тренировки.";
    const aiCoachStatuses = [
      {
        icon: totalWorkouts >= 8 ? "⚡" : "🏁",
        title: totalWorkouts >= 8 ? "Ритм" : "Старт",
        text: totalWorkouts >= 8 ? "хороший" : "набираем"
      },
      {
        icon: currentGoalId === "mass" ? "📈" : currentGoalId === "maintain" ? "⚖️" : "🔥",
        title: currentGoalId === "mass" ? "Масса" : currentGoalId === "maintain" ? "Вес" : "Форма",
        text: currentGoalId === "maintain" ? "стабильно" : "контроль"
      },
      {
        icon: "📏",
        title: "Замер",
        text: "раз в неделю"
      }
    ];

    const profileTabs = [
      { id: "cabinet", label: "Кабинет", icon: "👤" },
      { id: "measurements", label: "Замеры", icon: "📏" },
      { id: "nutrition", label: "Питание", icon: "🍽️" },
      { id: "settings", label: "Настройки", icon: "⚙️" }
    ];

    return (
      <div className="profileDashboardPage profileTabbedPage" data-profile-tab={profileActiveTab}>
        <button className="backBtn universalFixedBackPointer profileDashboardBack" onClick={goBackToMain}>
          ←
        </button>

        <nav className="profileBottomTabBar" aria-label="Разделы личного кабинета">
          {profileTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={profileActiveTab === tab.id ? "active" : ""}
              onClick={() => {
                setProfileActiveTab(tab.id);
                window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
              }}
            >
              <span>{tab.icon}</span>
              <strong>{tab.label}</strong>
            </button>
          ))}
        </nav>

        <section className="profileUnifiedCard profileAiDashboardCard profileCabinetSection">
          {profileActiveTab === "cabinet" && (
          <div className="profileAiHero">
            <div className="profileAiAvatarWrap">
              <div className={telegramProfile.connected ? "profileAvatarBig telegram profileUnifiedAvatar profileAiAvatar" : "profileAvatarBig profileUnifiedAvatar profileAiAvatar"}>
                {telegramProfile.avatarUrl ? (
                  <img src={telegramProfile.avatarUrl} alt="" />
                ) : (
                  <span>{telegramProfile.connected ? "✈️" : "👤"}</span>
                )}
              </div>
              <div className="profileAiAvatarRing">
                <strong>{aiProgressScore}%</strong>
              </div>
            </div>

            <div className="profileAiHeroText">
              <span>ЛИЧНЫЙ КАБИНЕТ</span>
              <h1>Добрый день, {greetingName} 👋</h1>

            </div>

          </div>
          )}

          {profileActiveTab === "cabinet" && (
          <div className="profileAiStatsRow">
            <div className="goal">
              <span>Твоя цель</span>
              <strong>{activeGoalLabel}</strong>
              <small>&nbsp;</small>
            </div>

            <div>
              <span>Текущий вес</span>
              <strong>{activeProfile?.weight || "—"} кг</strong>
              <small>&nbsp;</small>
            </div>

            <div>
              <span>Тренировок</span>
              <strong>{totalWorkouts}</strong>
              <small>&nbsp;</small>
            </div>
          </div>
          )}

          {profileActiveTab === "cabinet" && (
          <div className="profileAiSplitCards">
            <div className="profileAiMiniCard">
              <span>📅 Последняя тренировка</span>
              <strong>{lastWorkoutDate || "Нет данных"}</strong>
            </div>

            <div className="profileAiMiniCard">
              <span>⚡ Следующая тренировка</span>
              <strong>{nextTrainingText}</strong>
            </div>
          </div>
          )}

          {profileActiveTab === "cabinet" && (
          <div className={profileProgressAnalysisOpen ? "profileAiCoachInsight open" : "profileAiCoachInsight"}>
            <button
              type="button"
              className="profileAiCoachToggle"
              onClick={() => setProfileProgressAnalysisOpen((prev) => !prev)}
            >
              <div>
                <span>Анализ прогресса</span>
                <h2>{totalWorkouts ? "Ты на правильном пути 💪" : "Пора создать историю прогресса"}</h2>
                <p>{profileProgressAnalysisOpen ? aiCoachSummary : "Краткая AI-оценка прогресса, замеров и регулярности."}</p>
              </div>

              <em>{profileProgressAnalysisOpen ? "−" : "+"}</em>
            </button>

            {!profileProgressAnalysisOpen && (
              <div className="profileAiCoachPreview">
                {aiCoachStatuses.slice(0, 2).map((status) => (
                  <span key={status.title}>{status.icon} {status.title}: {status.text}</span>
                ))}
              </div>
            )}

            {profileProgressAnalysisOpen && (
              <div className="profileAiCoachExpanded">
                <div className="profileAiCoachStatusRow insideProgress">
                  {aiCoachStatuses.map((status) => (
                    <div key={status.title}>
                      <span>{status.icon}</span>
                      <strong>{status.title}</strong>
                      <small>{status.text}</small>
                    </div>
                  ))}
                </div>

                <div className="profileAiCoachMetrics">
                  <div><span>Жир</span><strong>{currentGoalId === "mass" ? "контроль" : "↓"}</strong></div>
                  <div><span>Мышцы</span><strong>{currentGoalId === "cut" || currentGoalId === "dry" ? "сохранить" : "↑"}</strong></div>
                  <div><span>Сила</span><strong>{totalWorkouts ? "+": "—"}</strong></div>
                </div>
              </div>
            )}
          </div>
          )}

          {profileActiveTab === "measurements" && (
          <div className="profileMeasurementPanel profileAiMeasurementPanel profileMeasurementWizardPanel">
            <button
              type="button"
              className={profileMeasurementOpen ? "profileMeasurementToggle open" : "profileMeasurementToggle"}
              onClick={() => {
                setProfileMeasurementOpen((prev) => !prev);
                setProfileMeasurementWizardStep(0);
              }}
            >
              <span>
                <strong>Контрольный замер</strong>
                <small>{profileMeasurementOpen ? "Мастер замеров · 14 экранов" : "Последний замер и быстрый старт"}</small>
              </span>
              <em>{profileMeasurementOpen ? "−" : "+"}</em>
            </button>

            {!profileMeasurementOpen && (
              <div className="profileMeasurementPreview">
                <div className="profileMeasurementDashboardCard">
                  <div className="profileMeasurementDashboardTop">
                    <span>Контрольный замер</span>
                    <strong>Последний замер</strong>
                    <small>{formatProfileMeasurementDate(latestProfileMeasurement)}</small>
                  </div>

                  <div className="profileMeasurementDashboardIconWrap">
                    <div className="profileMeasurementDashboardIcon">⚖️</div>
                    <p>Быстрый контроль веса и объёмов тела</p>
                  </div>
                </div>

                <div className="profileMeasurementLastGrid">
                  {getProfileMeasurementFields(activeProfile?.goal || "recomp").slice(0, 6).map((field) => (
                    <div key={field.id}>
                      <span>{field.label}</span>
                      <strong>{getProfileMeasurementValue(latestProfileMeasurement, field)}</strong>
                      <small>{field.unit}</small>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="profileMeasurementStartBtn"
                  onClick={() => {
                    setProfileMeasurementOpen(false);
                    setProfileMeasurementWizardStep(0);
                    setProfileMeasurementStatus("");
                    setPage("measurementWizard");
                  }}
                >
                  📏 Начать замер
                </button>
              </div>
            )}

            {profileMeasurementOpen && (() => {
              const measurementFields = getProfileMeasurementFields(activeProfile?.goal || "recomp");
              const totalWizardScreens = measurementFields.length + 2;
              const isIntroStep = profileMeasurementWizardStep === 0;
              const isReviewStep = profileMeasurementWizardStep === totalWizardScreens - 1;
              const activeField = !isIntroStep && !isReviewStep ? measurementFields[profileMeasurementWizardStep - 1] : null;
              const progressPercent = Math.max(4, Math.round(((profileMeasurementWizardStep + 1) / totalWizardScreens) * 100));

              return (
                <div className="profileMeasurementWizard">
                  <div className="profileMeasurementWizardProgress">
                    <span>Шаг {profileMeasurementWizardStep + 1} из {totalWizardScreens}</span>
                    <i><em style={{ width: `${progressPercent}%` }} /></i>
                  </div>

                  {isIntroStep && (
                    <div className="profileMeasurementWizardCard intro">
                      <button
                        type="button"
                        className="profileMeasurementWizardClose"
                        aria-label="Закрыть замер"
                        onClick={() => {
                          setProfileMeasurementOpen(false);
                          setProfileMeasurementWizardStep(0);
                        }}
                      >
                        ×
                      </button>
                      <div className="profileMeasurementWizardVisual">
                        <div className="profileMeasurementMiniHuman">
                          <i />
                          <b />
                          <em />
                        </div>
                      </div>

                      <h3>Как выполнять замеры</h3>
                      <p>Мерь утром, одной и той же лентой, в спокойном состоянии. Не втягивай живот и не затягивай ленту слишком сильно.</p>

                      <div className="profileMeasurementTips">
                        <span>Одинаковое время</span>
                        <span>Одна лента</span>
                        <span>Без натяжения</span>
                        <span>Фото можно делать отдельно</span>
                      </div>
                    </div>
                  )}

                  {activeField && (
                    <div className="profileMeasurementWizardCard measurementStepCard">
                      <button
                        type="button"
                        className="profileMeasurementWizardClose"
                        aria-label="Закрыть замер"
                        onClick={() => {
                          setProfileMeasurementOpen(false);
                          setProfileMeasurementWizardStep(0);
                        }}
                      >
                        ×
                      </button>
                      <div className={`profileMeasurementImageFrame zone-${activeField.id}`}>
                        <img
                          src={`/measurements/${activeField.id}.png`}
                          alt={activeField.label}
                          className="profileMeasurementImage"
                          loading="eager"
                        />
                      </div>

                      <h3>{activeField.label}</h3>
                      <p>{activeField.hint}</p>

                      <label className="profileMeasurementWizardInput">
                        <span className="profileMeasurementInputLabelHidden">{activeField.label}</span>
                        <div>
                          <input
                            inputMode="decimal"
                            value={profileMeasurementDraft[activeField.id] || ""}
                            placeholder={activeField.placeholder}
                            onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, [activeField.id]: event.target.value }))}
                          />
                          <em>{activeField.unit}</em>
                        </div>
                      </label>

                      <small className="profileMeasurementPreviousValue">
                        Прошлый раз: {activeField.id === "weight" ? (activeProfile?.weight || "—") : "—"} {activeField.unit}
                      </small>
                    </div>
                  )}

                  {isReviewStep && (
                    <div className="profileMeasurementWizardCard review">
                      <button
                        type="button"
                        className="profileMeasurementWizardClose"
                        aria-label="Закрыть замер"
                        onClick={() => {
                          setProfileMeasurementOpen(false);
                          setProfileMeasurementWizardStep(0);
                        }}
                      >
                        ×
                      </button>
                      <h3>Проверь данные</h3>
                      <p>Если всё верно — сохрани контрольный замер. Пустые поля можно оставить пустыми.</p>

                      <div className="profileMeasurementReviewGrid">
                        {measurementFields.map((field) => (
                          <div key={field.id}>
                            <span>{field.label}</span>
                            <strong>{profileMeasurementDraft[field.id] || "—"}</strong>
                            <small>{field.unit}</small>
                          </div>
                        ))}
                      </div>

                      <label className="profileMeasurementNote wizardNote">
                        <span>Заметка</span>
                        <textarea
                          value={profileMeasurementDraft.note || ""}
                          placeholder="Например: утром, после тренировки, самочувствие..."
                          onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, note: event.target.value }))}
                        />
                      </label>

                      <button
                        type="button"
                        className="profileMeasurementSave"
                        disabled={profileMeasurementSaving}
                        onClick={saveProfileMeasurement}
                      >
                        {profileMeasurementSaving ? "Сохраняю..." : "Сохранить замер"}
                      </button>
                    </div>
                  )}

                  <div className="profileMeasurementWizardNav">
                    <button
                      type="button"
                      disabled={profileMeasurementWizardStep === 0}
                      onClick={() => setProfileMeasurementWizardStep((step) => Math.max(0, step - 1))}
                    >
                      ← Назад
                    </button>

                    {!isReviewStep ? (
                      <button
                        type="button"
                        className="next"
                        onClick={() => setProfileMeasurementWizardStep((step) => Math.min(totalWizardScreens - 1, step + 1))}
                      >
                        Вперёд →
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="next"
                        disabled={profileMeasurementSaving}
                        onClick={saveProfileMeasurement}
                      >
                        Сохранить
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {profileMeasurementStatus && (
              <p className="profileMeasurementStatus">{profileMeasurementStatus}</p>
            )}
          </div>
          )}

          {profileActiveTab === "settings" && (
          <div className={profileWorkoutModeOpen ? "profileWorkoutModeCard profileWorkoutModeSettingsSection open" : "profileWorkoutModeCard profileWorkoutModeSettingsSection"}>
            <button
              type="button"
              className="profileWorkoutModeToggle"
              onClick={() => setProfileWorkoutModeOpen((prev) => !prev)}
            >
              <div>
                <span>Режим тренировок</span>
                <strong>
                  {workoutModePreference.mode === "basic"
                    ? "Базовые тренировки"
                    : workoutModePreference.mode === "individual"
                      ? "Индивидуальный план"
                      : "Выбор при входе"}
                </strong>
                <small>Выбор режима тренировок и поведения приложения.</small>
              </div>

              <em>{profileWorkoutModeOpen ? "−" : "+"}</em>
            </button>

            {profileWorkoutModeOpen && (
              <div className="profileWorkoutModeExpanded">
                <div className="profileWorkoutModeActions">
                  <button
                    type="button"
                    className={workoutModePreference.mode === "basic" ? "active" : ""}
                    onClick={() => saveWorkoutModePreference("basic", true)}
                  >
                    Базовые
                  </button>

                  <button
                    type="button"
                    className={workoutModePreference.mode === "individual" ? "active" : ""}
                    onClick={() => saveWorkoutModePreference("individual", true)}
                  >
                    Индивидуальные
                  </button>

                  <button
                    type="button"
                    onClick={() => saveWorkoutModePreference("", false)}
                  >
                    Спрашивать
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {profileActiveTab === "cabinet" && (
          <button className="profileAiHistoryButton" onClick={() => {
            loadHistory();
            setPage("history");
          }}>
            История тренировок
            <span>›</span>
          </button>
          )}
        </section>

        {profileActiveTab === "nutrition" && (
        <section className="profileDashboardGrid profileNutritionSection">
          <div className="profileDashboardCard profileNutritionGoalCard">
            <button
              type="button"
              className={profileNutritionGoalOpen ? "profileAccordionHead profileNutritionAccordionHead open" : "profileAccordionHead profileNutritionAccordionHead"}
              onClick={() => setProfileNutritionGoalOpen((prev) => !prev)}
            >
              <div>
                <span>NUTRITION GOAL</span>
                <strong>Питание</strong>
                <small>Текущая цель: {activeGoalLabel}</small>
              </div>
              <em>{profileNutritionGoalOpen ? "−" : "+"}</em>
            </button>

            <div className="profileNutritionCollapsedInfo">
              <div>
                <span>Выбрано</span>
                <strong>{activeGoalLabel}</strong>
              </div>
              <div>
                <span>Ккал</span>
                <strong>{Math.round(profileMacros.calories || nutrition.goals.calories)}</strong>
              </div>
            </div>

            {profileNutritionGoalOpen && (
              <div className="profileNutritionGoalExpanded">
                <p className="profileNutritionGoalHint">
                  Выбери цель питания. После сохранения AI-план и КБЖУ будут пересчитаны под новую цель.
                </p>

                <div className="profileGoalPicker">
                  {[
                    { id: "maintain", title: "Поддержка" },
                    { id: "recomp", title: "Рекомпозиция" },
                    { id: "cut", title: "Похудение" },
                    { id: "dry", title: "Сушка" },
                    { id: "mass", title: "Набор" }
                  ].map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      className={aiNutritionProfileDraft.goal === goal.id ? "active" : ""}
                      onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, goal: goal.id }))}
                    >
                      {goal.title}
                    </button>
                  ))}
                </div>

                <div className="profileGoalModeHint">
                  {aiNutritionProfileDraft.goal === "maintain"
                    ? "Поддержка: калории около нормы, белок умеренный, задача — стабильный вес и энергия."
                    : aiNutritionProfileDraft.goal === "recomp"
                      ? "Рекомпозиция: небольшой дефицит, белок выше, цель — постепенно снижать жир и сохранять/растить мышцы."
                      : "AI пересчитает КБЖУ под выбранную цель."}
                </div>

                <div className="profileMacroGrid">
                  <div><span>Ккал</span><strong>{Math.round(profileMacros.calories || nutrition.goals.calories)}</strong></div>
                  <div><span>Белки</span><strong>{Math.round(profileMacros.protein || nutrition.goals.protein)} г</strong></div>
                  <div><span>Жиры</span><strong>{Math.round(profileMacros.fat || nutrition.goals.fat)} г</strong></div>
                  <div><span>Угл.</span><strong>{Math.round(profileMacros.carbs || nutrition.goals.carbs)} г</strong></div>
                </div>

                <button className="profileDashboardButton" onClick={saveAiBodyMetrics}>
                  Сохранить цель питания
                </button>
              </div>
            )}
          </div>

          <div className="profileDashboardCard profileAiNutritionPlanCard">
            {!profileAiNutritionPlan ? (
              <div className="profileAiNutritionEmpty">
                <span>AI-ПЛАН ПИТАНИЯ</span>
                <h3>План ещё не создан</h3>
                <p>Создай персональный AI-план по КБЖУ, цели, весу, росту и тренировочным дням.</p>
                <button
                  type="button"
                  className="profileDashboardButton"
                  disabled={!hasRequiredAiNutritionProfileFields(activeProfile)}
                  onClick={() => saveAiNutritionPlan(activeProfile)}
                >
                  Создать AI-план
                </button>
              </div>
            ) : (
              <div className="aiNutritionPlanCardFull profileAiNutritionPlanFull">
                <div className="aiNutritionPlanHero">
                  <div>
                    <span>Твой AI-план питания</span>
                    <h2>{profileAiNutritionPlan.goalLabel}</h2>
                    <p>{profileAiNutritionPlan.comment}</p>
                  </div>
                  <strong>{profileAiNutritionDay.score}/10</strong>
                </div>

                <div className="aiNutritionTodayMacros">
                  <div>
                    <span>Сегодня</span>
                    <strong>{profileAiNutritionTodayMacros?.calories || nutrition.goals.calories}</strong>
                    <small>ккал</small>
                  </div>
                  <div>
                    <span>Белки</span>
                    <strong>{profileAiNutritionTodayMacros?.protein || nutrition.goals.protein}</strong>
                    <small>г</small>
                  </div>
                  <div>
                    <span>Жиры</span>
                    <strong>{profileAiNutritionTodayMacros?.fat || nutrition.goals.fat}</strong>
                    <small>г</small>
                  </div>
                  <div>
                    <span>Углеводы</span>
                    <strong>{profileAiNutritionTodayMacros?.carbs || nutrition.goals.carbs}</strong>
                    <small>г</small>
                  </div>
                </div>

                <div className="aiNutritionPlanInsight">
                  <span>Краткий AI-комментарий</span>
                  <p>{profileAiNutritionDay.summary} {profileAiNutritionTrainingAdvice}</p>
                </div>

                <div className="aiNutritionBadgesRow">
                  {profileAiNutritionDay.badges.map((badge) => (
                    <span key={badge.text} className={badge.type}>
                      <i>{badge.icon}</i>{badge.text}
                    </span>
                  ))}
                </div>

                <div className={`aiNutritionTrainingDayInfo ${profileIsAiTrainingDayToday ? "active" : ""}`}>
                  <span>{profileIsAiTrainingDayToday ? "Сегодня тренировка" : "Сегодня без тренировки"}</span>
                  <p>{profileAiNutritionTrainingAdvice}</p>
                </div>

                <button
                  type="button"
                  className="aiNutritionAdaptBtn"
                  onClick={() => setAiNutritionAdaptedToday((value) => !value)}
                >
                  Адаптировать под сегодня
                </button>

                {aiNutritionAdaptedToday && (
                  <div className="aiNutritionPlanInsight aiNutritionAdaptResult">
                    <span>Совет на остаток дня</span>
                    <p>{profileAiNutritionDay.adaptiveAdvice}</p>
                  </div>
                )}

                <div className="aiNutritionWeeksGrid">
                  {profileAiNutritionPlan.weeks.map((week) => (
                    <div key={week.week} className={week.week === profileAiNutritionWeekNumber ? "active" : ""}>
                      <span>{week.label}</span>
                      <strong>{week.calories} ккал</strong>
                      <small>Б {week.protein} · Ж {week.fat} · У {week.carbs}</small>
                      <p>{week.focus}</p>
                    </div>
                  ))}
                </div>

                <div className="aiNutritionTwoCol">
                  <div>
                    <span>Прогресс недели</span>
                    <p>Сейчас активна {profileAiNutritionWeekNumber} неделя. {profileAiNutritionPlan.weightTrend?.text}</p>
                  </div>
                  <div>
                    <span>Частые продукты</span>
                    <p>{profileAiNutritionPlan.frequentFoods?.length ? profileAiNutritionPlan.frequentFoods.join(", ") : "AI будет собирать список по истории питания."}</p>
                  </div>
                </div>

                <div className="aiNutritionImproveBox">
                  <span>Что улучшить сегодня</span>
                  <p>{profileAiNutritionDay.left.protein > 20 ? "1. Добрать белок простыми продуктами." : "1. Белок держится хорошо."}</p>
                  <p>{profileAiNutritionDay.left.carbs > 80 ? "2. Добавить углеводы вокруг тренировки." : "2. Углеводы близко к цели."}</p>
                  <p>{profileAiNutritionDay.left.fat < 0 ? "3. Остаток дня сделать менее жирным." : "3. Не перегружать жиры вечером."}</p>
                </div>

                <div className="aiNutritionPlanActions">
                  <button type="button" onClick={() => saveAiNutritionPlan(profileAiNutritionActiveProfile)}>Обновить план</button>
                  <button type="button" className="ghost" onClick={resetAiNutritionPlan}>Пересоздать анкету</button>
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {telegramConnectOpen && (
          <div className="profileTelegramModalOverlay">
            <div className="profileTelegramModal profileTelegramManageModal">
              <button type="button" className="profileTelegramModalClose" onClick={() => setTelegramConnectOpen(false)}>×</button>

              <div className="profileTelegramManageHead">
                <div className="profileTelegramManageAvatar">
                  {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" /> : <span>✈️</span>}
                </div>
                <div>
                  <span>TELEGRAM</span>
                  <h3>{telegramProfile.connected ? "Telegram подключён" : "Привязать Telegram"}</h3>
                  <p>
                    {telegramProfile.connected
                      ? `${telegramProfile.displayName || `@${telegramProfile.username || "telegram"}`} ${telegramProfile.username ? `· @${telegramProfile.username}` : ""}`
                      : "Войди через Telegram, чтобы получать уведомления от тренера."}
                  </p>
                </div>
              </div>

              {!telegramProfile.connected && (
                <>
                  <div className="profileTelegramAuthPreview">
                    <div className="profileTelegramAuthIcon">✈️</div>
                    <div>
                      <strong>Tren AI Coach</strong>
                      <span>Без ручного ввода username. Всё привяжется через Telegram.</span>
                    </div>
                  </div>

                  <div className="profileTelegramLoginWidgetCard">
                    <div ref={telegramLoginContainerRef} className="profileTelegramLoginWidget" />
                    {!telegramLoginWidgetReady && (
                      <div className="profileTelegramWidgetLoading">
                        Загружаю Telegram Login...
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="profileTelegramCheckButton"
                    onClick={checkTelegramLoginResult}
                    disabled={telegramLinking}
                  >
                    {telegramLinking ? "Проверяю..." : "Проверить подключение"}
                  </button>
                </>
              )}

              {telegramProfile.connected && (
                <div className="profileTelegramManageActions">
                  <button type="button" onClick={() => {
                    setTelegramProfile((prev) => ({ ...prev, connected: false }));
                    setTelegramStatus("");
                  }}>
                    Изменить Telegram
                  </button>

                  <button type="button" className="danger" onClick={disconnectTelegram}>
                    Отключить
                  </button>
                </div>
              )}

              {telegramStatus && (
                <div className="profileTelegramAuthStatus">
                  <span>{telegramStatus}</span>
                </div>
              )}

              <button type="button" className="profileTelegramSave ghost" onClick={() => setTelegramConnectOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        )}

        {profileActiveTab === "settings" && (
        <section className="profileDashboardCard profileBodyMetricsSettingsSection">
          <button
            type="button"
            className={profileBodyMetricsOpen ? "profileAccordionHead open" : "profileAccordionHead"}
            onClick={() => setProfileBodyMetricsOpen((prev) => !prev)}
          >
            <div>
              <span>SETTINGS</span>
              <strong>Анкета и параметры тела</strong>
              <small>Возраст, пол, рост, вес, активность, цель и тренировочные дни</small>
            </div>
            <em>{profileBodyMetricsOpen ? "−" : "+"}</em>
          </button>

          {profileBodyMetricsOpen && (
            <div className="profileBodyMetricsAccordion">
              <div className="profileBodyMetricsGrid">
                <label>
                  <span>Текущий вес</span>
                  <input
                    inputMode="decimal"
                    value={aiNutritionProfileDraft.weight}
                    onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, weight: event.target.value }))}
                    placeholder="80 кг"
                  />
                </label>

                <label>
                  <span>Рост</span>
                  <input
                    inputMode="decimal"
                    value={aiNutritionProfileDraft.height}
                    onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, height: event.target.value }))}
                    placeholder="180 см"
                  />
                </label>

                <label>
                  <span>Возраст</span>
                  <input
                    inputMode="numeric"
                                    className="adminReminderTimeInput"
                    value={aiNutritionProfileDraft.age}
                    onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, age: event.target.value }))}
                    placeholder="31"
                  />
                </label>
              </div>

              <div className="profileSexPicker">
                {[
                  { id: "male", title: "Мужчина" },
                  { id: "female", title: "Женщина" }
                ].map((sex) => (
                  <button
                    type="button"
                    key={sex.id}
                    className={aiNutritionProfileDraft.sex === sex.id ? "active" : ""}
                    onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, sex: sex.id }))}
                  >
                    {sex.title}
                  </button>
                ))}
              </div>

              <div className="profileBodyMetricsGrid profileBodyMetricsGridTwo">
                <label className="profileGoalReadonly">
                  <span>Твоя цель</span>
                  <div className="profileGoalReadonlyValue">
                    {activeGoalLabel}
                  </div>
                </label>

                <label>
                  <span>Активность</span>
                  <select
                    value={aiNutritionProfileDraft.activity}
                    onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, activity: event.target.value }))}
                  >
                    <option value="low">Низкая</option>
                    <option value="medium">Средняя</option>
                    <option value="high">Высокая</option>
                  </select>
                </label>
              </div>

              <button type="button" className="profileBodySaveBtn" onClick={saveAiBodyMetrics}>
                Сохранить анкету
              </button>
            </div>
          )}
        </section>
        )}

        {profileActiveTab === "settings" && (
        <section className="profileDashboardCard profileAppSettingsSection">
          <div className="profileCardHead">
            <div>
              <span>APP SETTINGS</span>
              <h2>Настройки</h2>
              <p>Тема приложения и выход из аккаунта</p>
            </div>
          </div>

          <div className="profileSettingsActions">
            <button
              type="button"
              className="profileThemeSwitchBtn"
              onClick={toggleAppTheme}
            >
              <span className="profileThemeIcon">{appTheme === "warm-light" ? "🌙" : "☀️"}</span>
              <span className="profileThemeText">
                {appTheme === "warm-light" ? "Тёмно-зелёный стиль" : "Светло-жёлтый стиль"}
              </span>
            </button>

            <button
              type="button"
              className={telegramProfile.connected ? "profileSettingsTelegramItem connected" : "profileSettingsTelegramItem"}
              onClick={() => { setTelegramStatus(""); setTelegramConnectOpen(true); }}
            >
              <span className="profileSettingsTelegramAvatar">
                {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" /> : "✈️"}
              </span>

              <span className="profileSettingsTelegramText">
                <strong>Telegram</strong>
                <small>
                  {telegramProfile.connected
                    ? `@${telegramProfile.username || "telegram"} · подключён`
                    : "Не подключён · нажми, чтобы привязать"}
                </small>
              </span>

              <em>{telegramProfile.connected ? "Подключен" : "Подключить"}</em>
              <i>›</i>
            </button>

            <button type="button" className="profileLogoutBtn" onClick={logout}>
              Выйти из аккаунта
            </button>
          </div>
        </section>
        )}
      </div>
    );
  }

  if (page === "progress") {
    const exerciseStats = {};

    [...history].reverse().forEach((historyWorkout) => {
      historyWorkout.exercises?.forEach((exercise) => {
        if (!exerciseStats[exercise.name]) {
          exerciseStats[exercise.name] = {
            count: 0,
            bestWeight: 0,
            firstWeight: null,
            lastWeight: 0,
            lastResult: ""
          };
        }

        exercise.sets?.forEach((set) => {
          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;

          exerciseStats[exercise.name].count += 1;

          if (exerciseStats[exercise.name].firstWeight === null && weight > 0) {
            exerciseStats[exercise.name].firstWeight = weight;
          }

          if (weight > exerciseStats[exercise.name].bestWeight) {
            exerciseStats[exercise.name].bestWeight = weight;
          }

          exerciseStats[exercise.name].lastWeight = weight;
          exerciseStats[exercise.name].lastResult = `${reps} × ${
            set.weight || "без веса"
          }`;
        });
      });
    });

    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn universalFixedBackPointer" onClick={() => setPage("profile")}>
            ← Главное меню
          </button>

          <h1 className="workoutTitle">Прогресс</h1>
        </div>

        {Object.keys(exerciseStats).length === 0 && (
          <div className="exercise">
            <h3>Пока нет данных</h3>
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Заверши тренировку, и здесь появится прогресс.
            </p>
          </div>
        )}

        {Object.entries(exerciseStats).map(([name, stat]) => {
          const progress =
            stat.firstWeight && stat.lastWeight
              ? Math.round(
                  ((stat.lastWeight - stat.firstWeight) / stat.firstWeight) *
                    100
                )
              : 0;

          return (
            <div className="exercise" key={name}>
              <h3>{name}</h3>

              <div className="historySets">
                <div className="historySet">
                  <span>Лучший вес</span>
                  <strong>{stat.bestWeight || "нет"} кг</strong>
                </div>

                <div className="historySet">
                  <span>Прогресс</span>
                  <strong>
                    {progress > 0
                      ? `+${progress}%`
                      : progress < 0
                      ? `${progress}%`
                      : "0%"}
                  </strong>
                </div>

                <div className="historySet">
                  <span>Последний результат</span>
                  <strong>{stat.lastResult}</strong>
                </div>

                <div className="historySet">
                  <span>Всего подходов</span>
                  <strong>{stat.count}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (page === "history") {
    const historyItems = getAiHistoryItems(history);
    const totalHistorySets = historyItems.reduce((sum, item) => (
      sum + (item.exercises || []).reduce((exerciseSum, exercise) => exerciseSum + (exercise.sets?.length || 0), 0)
    ), 0);
    const totalHistoryExercises = historyItems.reduce((sum, item) => sum + (item.exercises?.length || 0), 0);
    const latestHistoryWorkout = historyItems[0];

    function formatHistoryCardDate(dateValue, withYear = false) {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return "без даты";

      return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {})
      }).replace(".", "");
    }

    function formatHistoryTime(dateValue) {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return "";

      return date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    function getHistoryWorkoutParts(workoutName = "") {
      const parts = String(workoutName || "Тренировка").split("—").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return {
          day: parts[0],
          title: parts.slice(1).join(" • ")
        };
      }

      return {
        day: "Тренировка",
        title: workoutName || "Без названия"
      };
    }

    function getHistorySetCount(item = {}) {
      return (item.exercises || []).reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0);
    }

    function getHistoryVolume(item = {}) {
      return (item.exercises || []).reduce((sum, exercise) => (
        sum + (exercise.sets || []).reduce((setSum, set) => {
          const reps = Number(set.reps) || 0;
          const weight = Number(String(set.weight || "").replace(",", ".")) || 0;
          return setSum + reps * weight;
        }, 0)
      ), 0);
    }

    function getHistoryTopExercise(item = {}) {
      const exercises = item.exercises || [];
      const first = exercises.find((exercise) => exercise?.name);
      return first?.name || "Без упражнений";
    }

    return (
      <div className="app historyPagePremium historyPageCompact">
        <button className="backIconBtn universalFixedBackPointer historyPremiumBack" onClick={() => setPage("profile")} aria-label="Назад" />

        <section className="historyCompactHero">
          <div>
            <span>История</span>
            <h1>Тренировки</h1>
            <p>{historyItems.length ? `Последняя: ${formatHistoryCardDate(latestHistoryWorkout?.date, true)}` : "Сохраняй тренировки — здесь будет прогресс."}</p>
          </div>

          <button className="historyRefreshBtn historyCompactRefresh" onClick={loadHistory}>
            🔄
          </button>
        </section>

        <section className="historyCompactStats">
          <div>
            <strong>{historyItems.length}</strong>
            <span>трен.</span>
          </div>
          <div>
            <strong>{totalHistorySets}</strong>
            <span>подходов</span>
          </div>
          <div>
            <strong>{totalHistoryExercises}</strong>
            <span>упр.</span>
          </div>
        </section>

        {latestHistoryWorkout && (
          <section className="historyCompactLast">
            <span>Последняя</span>
            <strong>{getHistoryWorkoutParts(latestHistoryWorkout.workout).title}</strong>
            <small>{formatHistoryCardDate(latestHistoryWorkout.date)} · {getHistorySetCount(latestHistoryWorkout)} подходов · {getHistoryTopExercise(latestHistoryWorkout)}</small>
          </section>
        )}

        {historyLoading && (
          <div className="historyEmptyCard historyCompactEmpty">
            <h3>Загрузка истории...</h3>
          </div>
        )}

        {!historyLoading && historyItems.length === 0 && (
          <div className="historyEmptyCard historyCompactEmpty">
            <h3>История пустая</h3>
            <p>Заверши тренировку, и она появится здесь.</p>
          </div>
        )}

        {!historyLoading && historyItems.length > 0 && (
          <div className="historyCompactList">
            {historyItems.map((item) => {
              const isOpen = openHistoryKey === item.id;
              const date = formatHistoryCardDate(item.date);
              const time = formatHistoryTime(item.date);
              const parts = getHistoryWorkoutParts(item.workout);
              const setCount = getHistorySetCount(item);
              const volume = getHistoryVolume(item);
              const exerciseCount = item.exercises?.length || 0;
              const isDeleting = historyDeletingId === item.id;
              const isSwiped = historySwipeId === item.id;

              return (
                <article
                  className={`${isOpen ? "historyCompactCard open" : "historyCompactCard"}${isSwiped ? " swiped" : ""}`}
                  key={item.id}
                  onTouchStart={(event) => handleHistoryTouchStart(event, item.id)}
                  onTouchEnd={(event) => handleHistoryTouchEnd(event, item)}
                >
                  <div className="historySwipeDeleteAction" onClick={() => requestDeleteOwnHistoryWorkout(item)}>
                    {isDeleting ? "Удаляю..." : "Удалить"}
                  </div>

                  <div className="historyCompactCardInner">
                    <div className="historyCompactCardTop">
                    <button
                      type="button"
                      className="historyCompactMain"
                      onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                    >
                      <span>{date}{time ? ` · ${time}` : ""}</span>
                      <strong>{parts.title}</strong>
                      <small>{parts.day} · {exerciseCount} упр. · {setCount} подходов</small>
                    </button>

                    <button
                      type="button"
                      className="historyCompactToggle"
                      onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                      aria-label={isOpen ? "Свернуть" : "Развернуть"}
                    >
                      {isOpen ? "⏫" : "⏬"}
                    </button>
                  </div>

                  <div className="historyCompactMeta">
                    <span>{volume > 0 ? `${Math.round(volume)} кг объём` : "объём —"}</span>
                    {item.postWorkoutFeedback?.title && (
                      <span>{item.postWorkoutFeedback.emoji || "💬"} {item.postWorkoutFeedback.title}</span>
                    )}
                  </div>

                    {isOpen && (
                      <div className="historyCompactBody">
                      {(item.exercises || []).map((exercise, index) => (
                        <div className="historyCompactExercise" key={`${exercise.name}_${index}`}>
                          <div className="historyCompactExerciseHead">
                            <strong>{exercise.name}</strong>
                            <span>{exercise.sets?.length || 0} подх.</span>
                          </div>

                          <div className="historyCompactSets">
                            {(exercise.sets || []).map((set, setIndex) => (
                              <span key={setIndex}>
                                {set.set || setIndex + 1}: {set.reps || "—"}×{set.weight || "без веса"}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {historyDeleteCandidate && (
          <div className="historyDeleteOverlay" onClick={closeHistoryDeleteConfirm}>
            <div className="historyDeleteModal" onClick={(event) => event.stopPropagation()}>
              <div className="historyDeleteIcon">⌫</div>
              <h3>Удалить тренировку?</h3>
              <p>
                {getHistoryWorkoutParts(historyDeleteCandidate.workout).title}
                <span>{formatHistoryCardDate(historyDeleteCandidate.date, true)} · действие нельзя отменить</span>
              </p>

              <div className="historyDeleteActions">
                <button type="button" onClick={closeHistoryDeleteConfirm} disabled={Boolean(historyDeletingId)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={confirmDeleteOwnHistoryWorkout}
                  disabled={Boolean(historyDeletingId)}
                >
                  {historyDeletingId ? "Удаляю..." : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (page === "admin") {
    if (!canUseTrainerFeatures()) {
      return (
        <div className="app">
          <button className="backBtn" onClick={() => setPage("main")}>← Главное меню</button>
          <div className="historyEmptyCard">
            <h3>Доступ закрыт</h3>
            <p>Тренерская доступна админам и пользователям с ролью тренера.</p>
          </div>
        </div>
      );
    }

    const filteredUsers = usersList.filter((client) => {
      const profile = getAdminClientProfile(client);
      const goal = String(profile?.goal || "").toLowerCase();
      const clientHistory = adminSelectedClient?.id === client.id ? adminClientHistory : [];
      const lastWorkoutDate = clientHistory[0]?.date ? new Date(clientHistory[0].date) : null;
      const daysSinceWorkout = lastWorkoutDate ? Math.round((Date.now() - lastWorkoutDate.getTime()) / (24 * 60 * 60 * 1000)) : null;
      const badCount = clientHistory.filter((item) => item.postWorkoutFeedback?.id === "bad").length;

      if (adminClientFilter === "all") return true;
      if (adminClientFilter === "active") return daysSinceWorkout === null || daysSinceWorkout <= 7;
      if (adminClientFilter === "attention") return badCount >= 2 || daysSinceWorkout >= 5;
      if (adminClientFilter === "inactive") return daysSinceWorkout !== null && daysSinceWorkout >= 7;
      return goal === adminClientFilter;
    });

    const selectedClient = adminSelectedClient || usersList.find((client) => client.id === selectedUserId) || filteredUsers[0] || usersList[0] || null;
    const selectedProfile = getAdminClientProfile(selectedClient || {});
    const selectedLatestMeasurement = Array.isArray(adminClientMeasurements) && adminClientMeasurements.length
      ? adminClientMeasurements[0]
      : null;
    const selectedPreviousMeasurement = Array.isArray(adminClientMeasurements) && adminClientMeasurements.length > 1
      ? adminClientMeasurements[1]
      : null;
    const adminMeasurementFields = getProfileMeasurementFields(selectedProfile?.goal || "recomp");
    const adminMeasurementPreviewFields = adminMeasurementFields.filter((field) => ["weight", "neck", "shoulders", "chest", "biceps", "forearm", "belly", "pelvis", "thigh", "calf", "ankle"].includes(field.id));
    const clientNutritionDays = getAdminNutritionDaysList(adminClientNutrition);
    const clientToday = clientNutritionDays[0] || { totals: { calories: 0, protein: 0, fat: 0, carbs: 0 }, foods: [], score: "—" };
    const workoutProgress = getAdminWorkoutProgressList(adminClientHistory);
    const weightPoints = getAdminWeightPoints(selectedClient || {});
    const badFeedbackCount = adminClientHistory.filter((item) => item.postWorkoutFeedback?.id === "bad").length;
    const recommendations = getAdminRecommendations(selectedClient || {}, adminClientHistory, adminClientNutrition);
    const aiPlan = selectedClient?.aiNutritionPlan || selectedClient?.nutritionPlan || null;
    const aiWeek = aiPlan?.weeks?.[0] || null;
    const maxCalories = Math.max(1, ...clientNutritionDays.slice(0, 7).map((day) => day.totals.calories));
    const maxProtein = Math.max(1, ...clientNutritionDays.slice(0, 7).map((day) => day.totals.protein));
    const maxWeight = Math.max(1, ...weightPoints.map((point) => point.weight));
    const averageAiScore = clientNutritionDays.length
      ? Math.round(clientNutritionDays.slice(0, 7).reduce((sum, day) => sum + (Number(day.score) || 0), 0) / Math.min(7, clientNutritionDays.length) * 10) / 10
      : "—";
    const lastWorkoutDate = adminClientHistory[0]?.date ? new Date(adminClientHistory[0].date) : null;
    const daysSinceWorkout = lastWorkoutDate ? Math.round((Date.now() - lastWorkoutDate.getTime()) / (24 * 60 * 60 * 1000)) : null;
    const attentionCount = badFeedbackCount + (daysSinceWorkout !== null && daysSinceWorkout >= 5 ? 1 : 0);

    return (
      <div className="adminV3Shell">
        <aside className="adminV3Sidebar">
          <button className="adminFixedMainBack" onClick={() => setPage("main")} aria-label="Главное меню"><span>←</span><b>Главное меню</b></button>

          <div className="adminV3Brand">
            <span>⚙️</span>
            <strong>Trainer CRM</strong>
            <small>Admin Panel v3</small>
          </div>

          <nav className="adminV3Nav adminV3BottomBar" aria-label="Админ меню">
            <button className={page === "admin" ? "active" : ""} type="button" onClick={() => setPage("admin")}>
              <span className="adminV3NavIcon">📊</span>
              <span className="adminV3NavLabel">Дашборд</span>
            </button>
            <button className={page === "adminUsers" ? "active" : ""} type="button" onClick={() => setPage("adminUsers")}>
              <span className="adminV3NavIcon">👥</span>
              <span className="adminV3NavLabel">Клиенты</span>
            </button>
            <button className={page === "adminWorkouts" ? "active" : ""} type="button" onClick={() => selectedClient && setPage("adminWorkouts")}>
              <span className="adminV3NavIcon">🏋️</span>
              <span className="adminV3NavLabel">Программы</span>
            </button>
            <button className={page === "adminStats" ? "active" : ""} type="button" onClick={exportAdminClientCsv}>
              <span className="adminV3NavIcon">📈</span>
              <span className="adminV3NavLabel">Отчёты</span>
            </button>
          </nav>

          
        </aside>

        <main className="adminV3Main">
          <header className="adminV3Header">
            <div>
              <span>TRAINER CONTROL CENTER</span>
              <h1>Тренерская</h1>
              <p>Клиенты, питание, тренировки и AI-контроль в одном рабочем пространстве.</p>

<div className="adminFocusGrid">
  <div className="adminFocusCard">
    <div className="adminFocusLabel">Клиенты</div>
    <div className="adminFocusValue">{usersList.length}</div>
  </div>

  <div className="adminFocusCard">
    <div className="adminFocusLabel">Активные</div>
    <div className="adminFocusValue">{filteredUsers.length}</div>
  </div>

  <div className="adminFocusCard">
    <div className="adminFocusLabel">Требуют внимания</div>
    <div className="adminFocusValue">{attentionCount}</div>
  </div>

  <div className="adminFocusCard">
    <div className="adminFocusLabel">AI-score</div>
    <div className="adminFocusValue">{averageAiScore}</div>
  </div>
</div>

<div className="adminDashboardSection">
  <div className="adminDashboardSectionTitle">Клиенты тренера</div>

  <div className="adminDashboardMiniList">
    {usersList.length ? usersList.slice(0, 3).map((client) => (
      <div className="adminDashboardMiniItem" key={client.id}>
        <div className="adminDashboardMiniTop">
          <div className="adminDashboardMiniName">{client.name || client.email || "Клиент"}</div>
          <div className="adminDashboardMiniStatus">{client.assignedProgramName || "Без программы"}</div>
        </div>
        <div className="adminDashboardMiniDesc">
          {client.email || "Email не указан"}
        </div>
      </div>
    )) : (
      <div className="adminDashboardMiniItem">
        <div className="adminDashboardMiniTop">
          <div className="adminDashboardMiniName">Нет клиентов</div>
          <div className="adminDashboardMiniStatus">0</div>
        </div>
        <div className="adminDashboardMiniDesc">
          Здесь будут отображаться только клиенты, привязанные к текущему тренеру.
        </div>
      </div>
    )}
  </div>
</div>

<div className="adminDashboardSection">
  <div className="adminDashboardSectionTitle">AI Focus</div>

  <div className="adminDashboardMiniItem">
    <div className="adminDashboardMiniTop">
      <div className="adminDashboardMiniName">{selectedClient?.name || selectedClient?.email || "Выбери клиента"}</div>
      <div className="adminDashboardMiniStatus">AI</div>
    </div>

    <div className="adminDashboardMiniDesc">
      {recommendations[0] || "AI-подсказки появятся после загрузки истории, питания и замеров выбранного клиента."}
    </div>
  </div>
</div>

<div className="adminDashboardSection">
  <div className="adminDashboardSectionTitle">Последние события</div>

  <div className="adminDashboardTimeline">
    {adminClientHistory.length ? adminClientHistory.slice(0, 3).map((entry, index) => (
      <div className="adminDashboardTimelineItem" key={entry.id || entry.date || index}>
        ✅ {selectedClient?.name || selectedClient?.email || "Клиент"}: {entry.workout || "тренировка"}
      </div>
    )) : (
      <div className="adminDashboardTimelineItem">
        Нет событий по выбранному клиенту.
      </div>
    )}
  </div>
</div>

            </div>

            
          </header>

          <section className="adminV3KpiGrid">
            <div><span>Клиенты</span><strong>{usersList.length}</strong><small>в базе</small></div>
            <div><span>Активные</span><strong>{filteredUsers.length}</strong><small>по фильтру</small></div>
            <div><span>Требуют внимания</span><strong>{attentionCount}</strong><small>по выбранному</small></div>
            <div><span>Средний AI-score</span><strong>{averageAiScore}</strong><small>питание</small></div>
          </section>

          <section className="adminV3Filters">
            {[
              ["all", "Все"],
              ["active", "Активные"],
              ["attention", "Внимание"],
              ["inactive", "Давно не тренировались"],
              ["dry", "Сушка"],
              ["mass", "Набор"],
              ["cut", "Похудение"],
              ["maintain", "Поддержка"],
              ["recomp", "Рекомпозиция"]
            ].map(([id, label]) => (
              <button
                key={id}
                className={adminClientFilter === id ? "active" : ""}
                onClick={() => setAdminClientFilter(id)}
              >
                {label}
              </button>
            ))}
          </section>

          <section className="adminV3DashboardGrid">
            <div className="adminV3Panel adminV3ClientsPanel">
              <div className="adminV3PanelHead">
                <div>
                  <h2>Клиенты</h2>
                  <p>Выбери клиента, чтобы открыть workspace.</p>
                </div>
                <button onClick={() => setPage("adminUsers")}>Создать</button>
              </div>

              <div className="adminV3ClientTable">
                <div className="adminV3ClientTableHead">
                  <span>Клиент</span>
                  <span>Твоя цель</span>
                  <span>Анализ прогресса</span>
                  <span>Статус</span>
                </div>

                {filteredUsers.map((client) => {
                  const profile = getAdminClientProfile(client);
                  const isActive = selectedClient?.id === client.id;

                  return (
                    <button
                      key={client.id}
                      className={isActive ? "active" : ""}
                      onClick={() => loadAdminClientOverview(client, true)}
                    >
                      <span>
                        <strong>{client.name || client.email || "Клиент"}</strong>
                        <small>{client.email || client.id}</small>
                      </span>
                      <em>{getAdminClientGoalLabel(profile.goal)}</em>
                      <em>{isActive ? averageAiScore : "—"}</em>
                      <i>{isActive && attentionCount > 0 ? "Внимание" : "OK"}</i>
                    </button>
                  );
                })}

                {!filteredUsers.length && <p className="adminV3Empty">Нет клиентов под этот фильтр.</p>}
              </div>
            </div>

            <div className="adminV3Panel adminV3AlertsPanel">
              <div className="adminV3PanelHead">
                <div>
                  <h2>AI Alerts</h2>
                  <p>Главные сигналы по выбранному клиенту.</p>
                </div>
              </div>

              <div className="adminV3Alerts">
                {recommendations.slice(0, 5).map((item) => (
                  <div key={item}>
                    <span>✨</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {selectedClient && (
            <section className="adminV3Workspace">
              <div className="adminV3WorkspaceHead">
                <div>
                  <span>CLIENT WORKSPACE</span>
                  <h2>{selectedClient.name || selectedClient.email || "Клиент"}</h2>
                  <p>{selectedClient.email || selectedClient.id}</p>
                </div>

                <div className="adminV3WorkspaceActions">
</div>
              </div>

              <div className="adminV3Tabs">
                {[
                  ["overview", "Overview"],
                  ["nutrition", "Питание"],
                  ["training", "Тренировки"],
                  ["calendar", "Календарь"],
                  ["program", "Программа"],
                  ["notes", "Заметки"],
                  ["transfer", "Transfer"]
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={adminClientTab === id ? "active" : ""}
                    onClick={() => setAdminClientTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {adminClientTab === "overview" && (
                <div className="adminV3TabGrid">
                  <div className="adminV3ProfileCard">
                    <h3>Профиль</h3>
                    <div className="adminV3ProfileGrid">
                      <div><span>Текущий вес</span><strong>{selectedProfile?.weight || "—"} кг</strong></div>
                      <div><span>Рост</span><strong>{selectedProfile?.height || "—"} см</strong></div>
                      <div><span>Возраст</span><strong>{selectedProfile?.age || "—"}</strong></div>
                      <div><span>Пол</span><strong>{selectedProfile?.sex === "female" ? "Женщина" : selectedProfile?.sex === "male" ? "Мужчина" : "—"}</strong></div>
                      <div><span>Твоя цель</span><strong>{getAdminClientGoalLabel(selectedProfile?.goal)}</strong></div>
                      <div><span>Активность</span><strong>{getAiNutritionActivityLabel(selectedProfile?.activity || "medium")}</strong></div>
                      <div><span>Дни</span><strong>{getAdminClientTrainingDaysText(selectedProfile)}</strong></div>
                      <div><span>AI-план</span><strong>{aiWeek ? `${aiWeek.calories} ккал` : "—"}</strong></div>
                    </div>
                  </div>

                  <div className="adminV3ProfileCard">
                    <h3>Вес</h3>
                    <div className="adminV3MiniChart">
                      {weightPoints.length ? weightPoints.map((point, index) => (
                        <span key={`${point.date}_${index}`} style={{ height: `${Math.max(12, (point.weight / maxWeight) * 100)}%` }}>
                          <em>{point.weight}</em>
                        </span>
                      )) : <p>нет данных</p>}
                    </div>
                  </div>

                  <div className="adminV3ProfileCard adminV3Wide">
                    <h3>AI-рекомендации</h3>
                    <div className="adminV3Alerts compact">
                      {recommendations.map((item) => (
                        <div key={item}><span>✨</span><p>{item}</p></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {adminClientTab === "nutrition" && (
                <div className="adminV3TabGrid">
                  <div className="adminV3ProfileCard">
                    <h3>Калории</h3>
                    <div className="adminV3MiniChart">
                      {clientNutritionDays.slice(0, 7).reverse().map((day) => (
                        <span key={day.date} style={{ height: `${Math.max(10, (day.totals.calories / maxCalories) * 100)}%` }}>
                          <em>{Math.round(day.totals.calories)}</em>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="adminV3ProfileCard">
                    <h3>Белок</h3>
                    <div className="adminV3MiniChart">
                      {clientNutritionDays.slice(0, 7).reverse().map((day) => (
                        <span key={day.date} style={{ height: `${Math.max(10, (day.totals.protein / maxProtein) * 100)}%` }}>
                          <em>{Math.round(day.totals.protein)}</em>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="adminV3ProfileCard adminV3Wide">
                    <h3>Дни питания</h3>
                    <div className="adminV3NutritionList">
                      {clientNutritionDays.slice(0, 8).map((day) => (
                        <details key={day.date}>
                          <summary>
                            <strong>{new Date(day.date).toLocaleDateString("ru-RU")}</strong>
                            <span>{Math.round(day.totals.calories)} ккал · Б {Math.round(day.totals.protein)} · score {day.score}</span>
                          </summary>
                          <div>
                            {day.foods.map((food, index) => (
                              <p key={`${food.id || food.name}_${index}`}>
                                <span>{food.icon || getFoodIcon(food)} {food.name}</span>
                                <strong>{Math.round(Number(food.calories) || 0)} ккал</strong>
                              </p>
                            ))}
                            {!day.foods.length && <p>Еды нет</p>}
                          </div>
                        </details>
                      ))}
                      {!clientNutritionDays.length && <p className="adminV3Empty">Питания пока нет.</p>}
                    </div>
                  </div>
                </div>
              )}

              {adminClientTab === "training" && (
                <div className="adminV3TabGrid">
                  <div className="adminV3ProfileCard adminV3Wide">
                    <h3>Прогресс упражнений</h3>
                    <div className="adminV3ExerciseProgress">
                      {workoutProgress.map((item) => (
                        <div key={item.name}>
                          <span>{item.name}</span>
                          <strong>{item.max} кг</strong>
                          <i style={{ width: `${Math.min(100, (item.max / 120) * 100)}%` }} />
                        </div>
                      ))}
                      {!workoutProgress.length && <p className="adminV3Empty">Нет данных</p>}
                    </div>
                  </div>
                </div>
              )}

              {adminClientTab === "history" && (
                <div className="adminV3TabGrid">
                  <div className="adminV3ProfileCard adminV3Wide">
                    <h3>История тренировок</h3>

                    <div className="adminHistoryDeleteHint">Отметь нужные тренировки и удали только выбранные.</div>

                    <div className="adminHistorySelectBar">
                      <button type="button" onClick={toggleAdminSelectAllHistory}>
                        {adminClientHistory.slice(0, 20).every((item) => adminSelectedHistoryIds.includes(item.id)) && adminClientHistory.length ? "Снять выбор" : "Выбрать видимые"}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        disabled={!adminSelectedHistoryIds.length || adminDeletingWorkoutId === "bulk"}
                        onClick={() => deleteSelectedAdminClientHistory(selectedClient)}
                      >
                        {adminDeletingWorkoutId === "bulk" ? "Удаляю..." : `Удалить выбранные${adminSelectedHistoryIds.length ? ` (${adminSelectedHistoryIds.length})` : ""}`}
                      </button>
                    </div>

                    <div className="adminV3Timeline">
                      {adminClientHistory.slice(0, 20).map((item) => (
                        <div key={item.id} className={adminSelectedHistoryIds.includes(item.id) ? "adminV3TimelineWorkoutItem selected" : "adminV3TimelineWorkoutItem"}>
                          <label className="adminHistoryCheck">
                            <input
                              type="checkbox"
                              checked={adminSelectedHistoryIds.includes(item.id)}
                              onChange={() => toggleAdminSelectedHistoryId(item.id)}
                            />
                            <i />
                          </label>

                          <span>{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
                          <strong>{item.workout || "Тренировка"}</strong>
                          <small>{item.date ? new Date(item.date).toLocaleDateString("ru-RU") : "без даты"}{item.durationSeconds ? ` · ${Math.round(item.durationSeconds / 60)} мин` : ""}</small>
                          <em>{item.postWorkoutFeedback?.title || item.readiness?.title || "—"}</em>
                        </div>
                      ))}
                      {!adminClientHistory.length && <p className="adminV3Empty">Истории пока нет.</p>}
                    </div>
                  </div>

                </div>
              )}

              {adminClientTab === "program" && (
                <div className="adminV3TabGrid">
                  <div className="adminV3ProfileCard adminV3Wide">
                    <h3>Шаблоны и программа</h3>
                    <div className="adminV3TemplateControls">
                      <input value={adminTemplateName} onChange={(event) => setAdminTemplateName(event.target.value)} placeholder="Название шаблона" />
                      <button onClick={createAdminTemplateFromCurrentPlan}>Создать из текущей программы</button>
                      <select value={adminSelectedTemplateId} onChange={(event) => setAdminSelectedTemplateId(event.target.value)}>
                        <option value="">Выбери шаблон</option>
                        {adminTrainingTemplates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                      <button onClick={() => selectedClient && assignAdminTemplateToClient(selectedClient.id)}>Назначить выбранному</button>
                      <button onClick={() => selectedClient && clearClientProgram(selectedClient.id)}>Сбросить программу клиента</button>
                      <select value={adminCopyTargetUserId} onChange={(event) => setAdminCopyTargetUserId(event.target.value)}>
                        <option value="">Копировать программу клиенту</option>
                        {usersList.filter((client) => client.id !== selectedClient?.id).map((client) => (
                          <option key={client.id} value={client.id}>{client.name || client.email}</option>
                        ))}
                      </select>
                      <button onClick={copyCurrentProgramToClient}>Копировать</button>
                    </div>

                    <button className="adminV3OpenEditor" onClick={() => {
                      setSelectedUserId(selectedClient.id);
                      loadWorkoutsFromFirebase(selectedClient.id);
                      setPage("adminWorkouts");
                    }}>
                      Открыть desktop-редактор программы
                    </button>
                  </div>
                </div>
              )}

              {adminClientTab === "calendar" && (
                <div className="adminClientTabContent">
                  <div className="adminCalendarPanel">
                    <div className="adminCalendarHead">
                      <div>
                        <span>TRAINING CALENDAR</span>
                        <h3>Напоминания</h3>
</div>
                      <div className={getClientTelegramProfile(selectedClient).connected ? "adminCalendarTelegram connected" : "adminCalendarTelegram"}>
                        Telegram
                      </div>
                    </div>

                    <div className="adminCalendarDays">
                      {ADMIN_CALENDAR_DAYS.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          className={adminCalendarDraft.trainingDays?.includes(day.id) ? "active" : ""}
                          onClick={() => toggleAdminCalendarDay(day.id)}
                        >
                          <strong>{day.title}</strong>
                          <span>{day.full}</span>
                        </button>
                      ))}
                    </div>

                    <p className="adminCalendarDaysHintText">
                      Настройте время тренировок и напоминания<br />для выбранных дней
                    </p>

                    <div className="adminCalendarSettingsGrid adminCalendarPerDaySettings">
                      {(adminCalendarDraft.trainingDays || []).length ? (
                        (adminCalendarDraft.trainingDays || []).map((dayId) => {
                          const day = ADMIN_CALENDAR_DAYS.find((item) => item.id === dayId);
                          const daySettings = adminCalendarDraft.daySettings?.[dayId] || {};

                          return (
                            <div className="adminCalendarDaySettingsRow" key={dayId}>
                              <div className="adminCalendarDaySettingsHeader">
                                <div className="adminCalendarDaySettingsTitle">
                                  {day?.title || dayId}
                                </div>
                                <div className="adminCalendarDaySettingsName">
                                  {day?.full || dayId}
                                </div>
                              </div>

                              <div className="adminCalendarDayTimeGrid">
                                <label className="adminCalendarWorkoutTimeField">
                                  <span>Время тренировки</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="13:00"
                                    maxLength={5}
                                    className="adminReminderTimeInput adminReminderTimeManualInput"
                                    value={daySettings.workoutTime || adminCalendarDraft.workoutTime || "13:00"}
                                    onChange={(event) => {
                                      let value = event.target.value.replace(/[^0-9:]/g, "");

                                      if (value.length === 2 && !value.includes(":")) {
                                        value = `${value}:`;
                                      }

                                      updateAdminCalendarDaySetting(dayId, "workoutTime", value);
                                    }}
                                  />
                                </label>

                                <label className="adminCalendarReminderBeforeField">
                                  <span>Напомнить за</span>
                                  <select
                                    className="adminReminderBeforeSelect"
                                    value={daySettings.reminderBefore || daySettings.reminderTime || "1 день"}
                                    onChange={(event) => updateAdminCalendarDaySetting(dayId, "reminderBefore", event.target.value)}
                                  >
                                    <option value="1 день">1 день</option>
                                    <option value="2 дня">2 дня</option>
                                  </select>
                                </label>
                              </div>

                              <button
                                type="button"
                                className={daySettings.hourReminderEnabled === true ? "adminCalendarHourReminder active" : "adminCalendarHourReminder"}
                                onClick={() => updateAdminCalendarDaySetting(dayId, "hourReminderEnabled", daySettings.hourReminderEnabled !== true)}
                              >
                                <span>Напомнить за час</span>
                                <i aria-hidden="true"></i>
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="adminCalendarNoDaysHint">Выбери дни тренировок выше</div>
                      )}
                    </div>

                    <div className="adminCalendarToggles adminCalendarEqualButtonsWrap">
                      <button
                        type="button"
                        className={adminCalendarDraft.enabled !== false ? "adminCalendarEqualButton adminCalendarReminderButton active" : "adminCalendarEqualButton adminCalendarReminderButton"}
                        onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, enabled: prev.enabled === false }))}
                      >
                        {adminCalendarDraft.enabled !== false ? "Напоминания вкл" : "Напоминания выкл"}
                      </button>

                      <button
                        type="button"
                        className={adminCalendarDraft.reminderEnabled !== false ? "active" : ""}
                        onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, reminderEnabled: prev.reminderEnabled === false }))}
                      >
                        {adminCalendarDraft.reminderEnabled !== false ? "" : ""}
                      </button>
                    </div>

                    <div className="adminCalendarPreview">
                      <span></span>
                      <p>Завтра тренировка в {adminCalendarDraft.workoutTime || "13:00"} — следующая тренировка клиента.</p>
                    </div>

                    <button
                      className="adminV3OpenEditor adminCalendarEqualButton adminCalendarSaveButton"
                      disabled={adminCalendarSaving}
                      onClick={() => saveAdminClientCalendar(selectedClient)}
                    >
                      {adminCalendarSaving ? "Сохраняю..." : "Сохранить расписание"}
                    </button>

                    <button
                      type="button"
                      className="adminCalendarTestButton adminCalendarEqualButton"
                      disabled={adminCalendarTesting}
                      onClick={() => sendAdminTestWorkoutReminder(selectedClient)}
                    >
                      {adminCalendarTesting ? "Отправляю..." : "Тестовое сообщение"}
                    </button>
                  </div>
                </div>
              )}

              {adminClientTab === "notes" && (
                <div className="adminV3TabGrid">
                  <div className="adminV3ProfileCard adminV3Wide">
                    <h3>Заметки тренера</h3>
                    <textarea className="adminV3Note" value={adminTrainerNote} onChange={(event) => setAdminTrainerNote(event.target.value)} placeholder="Например: следить за белком, не повышать объём ног..." />
                    <button className="adminV3OpenEditor" onClick={saveAdminTrainerNote}>Сохранить заметку</button>
                  </div>
                </div>
              )}

              {adminClientTab === "transfer" && (
                <div className="adminV3TabGrid">
                  <div className="adminV3ProfileCard adminV3Wide adminTransferCard">
                    <h3>Transfer Client Data</h3>
                    <p className="adminV3TransferText">
                      Переносит данные питания, истории, тренировок и AI-плана с одного UID на другой.
                      Получатель остаётся обычным клиентом, а admin-профиль не становится клиентом.
                    </p>

                    <div className="adminTransferGrid">
                      <label>
                        <span>Источник данных</span>
                        <select value={adminTransferFromUid} onChange={(event) => setAdminTransferFromUid(event.target.value)}>
                          <option value="">Выбери источник: клиент или admin</option>
                          {adminAllUsersList.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.email || client.name || client.id}{client.role === "admin" || client.email === ADMIN_EMAIL ? " · ADMIN" : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Клиент-получатель</span>
                        <select value={adminTransferToUid} onChange={(event) => setAdminTransferToUid(event.target.value)}>
                          <option value="">Выбери клиента-получателя</option>
                          {usersList.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.email || client.name || client.id}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="adminTransferPreview">
                      <div>
                        <span>Источник</span>
                        <strong>{adminAllUsersList.find((item) => item.id === adminTransferFromUid)?.email || "—"}</strong>
                      </div>
                      <div>
                        <span>Получатель</span>
                        <strong>{usersList.find((item) => item.id === adminTransferToUid)?.email || "—"}</strong>
                      </div>
                      <div>
                        <span>Что переносим</span>
                        <strong>workouts · history · nutrition · profile · AI-plan</strong>
                      </div>
                    </div>

                    <button
                      className="adminV3OpenEditor"
                      disabled={adminTransferLoading}
                      onClick={transferClientDataBetweenAccounts}
                    >
                      {adminTransferLoading ? "Переношу..." : "Перенести данные клиенту"}
                    </button>

                    {adminTransferStatus && (
                      <p className="adminV3Status">{adminTransferStatus}</p>
                    )}

                    <p className="adminV3TransferWarning">
                      Важно: перенос копирует Firestore-данные. Firebase Auth аккаунты не объединяются.
                    </p>
                  </div>
                </div>
              )}

              <div className="adminClientDangerZoneBottom">
                <div>
                  <span>DANGER ZONE</span>
                  <strong>Удаление клиента</strong>
                  <p>Кнопка перенесена вниз, чтобы не мешать работе с программой и календарём.</p>
                </div>
                <button className="danger" onClick={() => deleteClientEverywhereFromAdminPanel(selectedClient)}>Удалить клиента</button>
              </div>

              {adminClientStatus && <p className="adminV3Status">{adminClientStatus}</p>}
            </section>
          )}
        </main>
      </div>
    );
  }

  if (page === "adminUsers") {
    if (!canUseTrainerFeatures()) {
      return (
        <div className="app">
          <button className="backBtn" onClick={() => setPage("main")}>← Главное меню</button>
          <div className="historyEmptyCard">
            <h3>Доступ закрыт</h3>
            <p>Тренерская доступна админам и пользователям с ролью тренера.</p>
          </div>
        </div>
      );
    }

    const credentialsText = adminCreatedCredentials
      ? `Логин: ${adminCreatedCredentials.email}\nПароль: ${adminCreatedCredentials.password}`
      : "";

    const adminUsersFilteredClients = usersList.filter((client) => {
      const profile = getAdminClientProfile(client);
      const search = adminUsersSearch.trim().toLowerCase();
      const matchesSearch = !search ||
        String(client.name || "").toLowerCase().includes(search) ||
        String(client.email || "").toLowerCase().includes(search);

      if (!matchesSearch) return false;

return true;
    });

    const selectedClient = adminSelectedClient || usersList.find((client) => client.id === selectedUserId) || adminUsersFilteredClients[0] || null;
    const selectedProfile = getAdminClientProfile(selectedClient || {});
    const selectedLatestMeasurement = Array.isArray(adminClientMeasurements) && adminClientMeasurements.length
      ? adminClientMeasurements[0]
      : null;
    const selectedPreviousMeasurement = Array.isArray(adminClientMeasurements) && adminClientMeasurements.length > 1
      ? adminClientMeasurements[1]
      : null;
    const adminMeasurementFields = getProfileMeasurementFields(selectedProfile?.goal || "recomp");
    const adminMeasurementPreviewFields = adminMeasurementFields.filter((field) => ["weight", "neck", "shoulders", "chest", "biceps", "forearm", "belly", "pelvis", "thigh", "calf", "ankle"].includes(field.id));
    const clientNutritionDays = getAdminNutritionDaysList(adminClientNutrition);
    const clientToday = clientNutritionDays[0] || { totals: { calories: 0, protein: 0, fat: 0, carbs: 0 }, foods: [], score: "—" };
    const workoutProgress = getAdminWorkoutProgressList(adminClientHistory);
    const recommendations = getAdminRecommendations(selectedClient || {}, adminClientHistory, adminClientNutrition);
    const aiPlan = selectedClient?.aiNutritionPlan || selectedClient?.nutritionPlan || null;
    const aiWeek = aiPlan?.weeks?.[0] || null;
    const lastWorkout = adminClientHistory[0];
    const maxCalories = Math.max(1, ...clientNutritionDays.slice(0, 7).map((day) => day.totals.calories));
    const maxProtein = Math.max(1, ...clientNutritionDays.slice(0, 7).map((day) => day.totals.protein));

    const nutritionMonthBaseDate = clientNutritionDays[0]?.date ? new Date(`${clientNutritionDays[0].date}T12:00:00`) : new Date();
    const nutritionMonthStart = new Date(nutritionMonthBaseDate.getFullYear(), nutritionMonthBaseDate.getMonth(), 1);
    const nutritionMonthGridStart = new Date(nutritionMonthStart);
    const nutritionMonthStartOffset = (nutritionMonthGridStart.getDay() + 6) % 7;
    nutritionMonthGridStart.setDate(nutritionMonthGridStart.getDate() - nutritionMonthStartOffset);
    const nutritionByDate = new Map(clientNutritionDays.map((day) => [day.date, day]));
    const nutritionMonthDays = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(nutritionMonthGridStart);
      date.setDate(nutritionMonthGridStart.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const day = nutritionByDate.get(key) || { date: key, totals: { calories: 0, protein: 0, fat: 0, carbs: 0 }, foods: [] };
      return {
        key,
        date,
        day,
        inMonth: date.getMonth() === nutritionMonthStart.getMonth(),
        isToday: key === new Date().toISOString().slice(0, 10)
      };
    });
    const nutritionMonthLabel = nutritionMonthStart.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    const nutritionMonthDaysInPlan = nutritionMonthDays.filter((item) => item.inMonth && nutritionByDate.has(item.key));
    const nutritionMonthCalories = nutritionMonthDaysInPlan.reduce((sum, item) => sum + (Number(item.day.totals.calories) || 0), 0);
    const nutritionMonthProtein = nutritionMonthDaysInPlan.reduce((sum, item) => sum + (Number(item.day.totals.protein) || 0), 0);
    const nutritionMonthAverageDays = Math.max(1, nutritionMonthDaysInPlan.length);
    const nutritionMonthAverageCalories = nutritionMonthCalories / nutritionMonthAverageDays;
    const nutritionMonthAverageProtein = nutritionMonthProtein / nutritionMonthAverageDays;
    const dailyCalorieGoal = Number(aiWeek?.calories || selectedClient?.nutritionGoals?.calories || adminClientNutrition?.goals?.calories || defaultNutritionState.goals.calories) || 2400;
    const dailyProteinGoal = Number(aiWeek?.protein || selectedClient?.nutritionGoals?.protein || adminClientNutrition?.goals?.protein || defaultNutritionState.goals.protein) || 160;
    const currentMonthTrainingDays = ADMIN_CALENDAR_DAYS.filter((day) => adminCalendarDraft.trainingDays?.includes(day.id)).map((day) => day.title).join(", ") || "не выбраны";
    const trainingDayIdByJsDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    return (
      <div className="adminUsersCrmPage">
        <aside className="adminUsersCrmSidebar">
          <button className="adminFixedMainBack" onClick={() => setPage("main")} aria-label="Главное меню"><span>←</span><b>Главное меню</b></button>
</aside>

        <main className={adminClientPageOpen ? "adminUsersCrmMain adminUsersCrmMainClientPage" : "adminUsersCrmMain"}>
          {!adminClientPageOpen && (
            <header className="adminUsersCrmHeader">
            <div>
              <span>CLIENT MANAGEMENT</span>
              <h1>Клиенты</h1>
              <p>Создание клиентов, карточки, программы, питание, история и заметки.</p>
            </div>

            <div className="adminUsersTopActions">
              </div>
            </header>
          )}

          {!adminClientPageOpen && (
            <section className="adminUsersCrmGrid adminUsersCrmGridCardsOnly">
            <div className="adminUsersClientsPanel adminUsersClientsPanelFull">
              <div className="adminUsersToolbar">
                <div>
                  <h2>Карточки клиентов</h2>
                  <p>{adminUsersFilteredClients.length} клиентов</p>
                </div>

                <div className="adminUsersToolbarActions">
                  <input
                    value={adminUsersSearch}
                    onChange={(event) => setAdminUsersSearch(event.target.value)}
                    placeholder="Поиск клиента..."
                  />
                </div>
              </div>

              <div className="adminClientCardsGrid adminClientCardsGridFive">
                {adminUsersFilteredClients.map((client) => {
                  const profile = getAdminClientProfile(client);
                  const active = selectedClient?.id === client.id;

                  return (
                    <button
                      key={client.id}
                      className={active ? "adminClientCard adminClientCardRect adminClientCardWide active" : "adminClientCard adminClientCardRect adminClientCardWide"}
                      onClick={() => loadAdminClientOverview(client, true)}
                    >
                      <span className="adminClientAvatar">👤</span>

                      <div className="adminClientCardMain">
                        <strong>{client.name || client.email || "Клиент"}</strong>
                        <small>{client.email || client.id}</small>
                      </div>

                      <em>{getAdminClientGoalLabel(profile.goal)}</em>

                      <div className="adminClientCardMeta">
                        <span>{profile?.weight ? `${profile.weight} кг` : "вес —"}</span>
                        <span>{profile?.activity ? getAiNutritionActivityLabel(profile.activity) : "активность —"}</span>
                      </div>

                      <div className="adminClientCardBottom">
                        <i>{active ? "Открыт" : "Открыть"}</i>
                        <b>{client.role === "trainer" ? "🟣 тренер" : active ? "🟢 активен" : "⚪ клиент"}</b>
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="adminClientCard adminClientCardRect adminClientAddCard"
                  onClick={() => setAdminCreateClientModalOpen(true)}
                >
                  <span className="adminClientAddIcon">＋</span>
                  <div>
                    <strong>Добавить клиента</strong>
                    <small>Создать логин и пароль</small>
                  </div>
                  <em>Новый клиент</em>
                  <i>Создать</i>
                </button>

                {!adminUsersFilteredClients.length && <p className="adminV3Empty">Нет клиентов под этот фильтр.</p>}
              </div>
            </div>
            </section>
          )}

          {adminCreateClientModalOpen && (
            <div className="adminCreateClientModalOverlay">
              <div className="adminCreateClientModal">
                <button
                  type="button"
                  className="adminCreateClientModalClose"
                  onClick={() => setAdminCreateClientModalOpen(false)}
                >
                  ×
                </button>

                <h2>Создать клиента</h2>
                <p>Создай логин, пароль и стартовую программу для нового клиента.</p>

                <form className="adminCreateUserForm" onSubmit={createUserFromAdminPanel}>
                  <label>
                    <span>Имя клиента</span>
                    <input
                      value={adminNewUserName}
                      onChange={(event) => setAdminNewUserName(event.target.value)}
                      placeholder="Например: Иван"
                    />
                  </label>

                  <label>
                    <span>Логин / email</span>
                    <input
                      value={adminNewUserEmail}
                      onChange={(event) => setAdminNewUserEmail(event.target.value)}
                      placeholder="client@email.com"
                      type="email"
                      autoComplete="off"
                    />
                  </label>

                  <label>
                    <span>Пароль</span>
                    <div className="adminPasswordRow">
                      <input
                        value={adminNewUserPassword}
                        onChange={(event) => setAdminNewUserPassword(event.target.value)}
                        placeholder="Минимум 6 символов"
                        type="text"
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={generateAdminPassword}>Сген.</button>
                    </div>
                  </label>

                  <button type="submit" className="adminCreateUserSubmit" disabled={adminCreateUserLoading}>
                    {adminCreateUserLoading ? "Создаю..." : "Создать клиента"}
                  </button>
                </form>

                {adminCreateUserStatus && <p className="adminCreateUserStatus">{adminCreateUserStatus}</p>}

                {adminCreatedCredentials && (
                  <div className="adminCredentialsBox">
                    <span>Данные для клиента</span>
                    <pre>{credentialsText}</pre>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(credentialsText)}>
                      Скопировать логин и пароль
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {adminClientPageOpen && selectedClient && (
            <section className="adminClientWorkspaceCrm adminClientWorkspaceCrmPage">
              <div className="adminClientRenderTopbar">
                <button
                  type="button"
                  className="adminClientBackToList"
                  onClick={() => setAdminClientPageOpen(false)}
                >
                  ← К списку клиентов
                </button>
              </div>

              <div className="adminClientWorkspaceHeader adminClientWorkspaceHeaderRender">
                <div className="adminClientIdentityRender">
                  <div className="adminClientInitialsRender">
                    {String(selectedClient.name || selectedClient.email || "К").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </div>

                  <div>
                    <h2>{selectedClient.name || selectedClient.email || "Клиент"}</h2>
                    <p>{selectedClient.email || selectedClient.id}</p>
                  </div>

                  <div className="adminClientStatusRender">
                    <i /> {selectedClient.role === "trainer" ? "Тренер" : "Активен"}
                  </div>

                  {canUseAdminFeatures() && selectedClient.email !== ADMIN_EMAIL && (
                    <button
                      type="button"
                      className={selectedClient.role === "trainer" ? "adminTrainerRoleButton active" : "adminTrainerRoleButton"}
                      onClick={() => updateUserTrainerRole(selectedClient, selectedClient.role !== "trainer")}
                    >
                      {selectedClient.role === "trainer" ? "Убрать тренера" : "Назначить тренером"}
                    </button>
                  )}
                </div>
</div>

              <div className="adminClientTabsCrm adminClientTabsFoodBar" role="tablist" aria-label="Меню клиента">
                {[
                  ["overview", "👤", "Обзор"],
                  ["training", "📋", "Программа"],
                  ["calendarNutrition", "🗓️", "Календарь"],
                  ["telegram", "💬", "Telegram"]
                ].map(([id, icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={adminUsersSelectedTab === id ? "active" : ""}
                    onClick={() => {
                      setAdminUsersSelectedTab(id);
                      window.requestAnimationFrame(() => {
                        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                        document.querySelector(".adminUsersCrmMain")?.scrollTo?.({ top: 0, left: 0, behavior: "smooth" });
                      });
                    }}
                  >
                    <span className="adminClientTabIcon">{icon}</span>
                    <span className="adminClientTabLabel">{label}</span>
                  </button>
                ))}
              </div>

              {adminUsersSelectedTab === "overview" && (
                <div className="adminClientTabContent adminClientTabContentRender">
                  <div className="adminClientMetricGrid adminClientMetricGridRender">
                    <div className="adminClientMetricCardRender"><i>▣</i><span>Вес</span><strong>{selectedProfile?.weight || "—"} кг</strong></div>
                    <div className="adminClientMetricCardRender"><i>↕</i><span>Рост</span><strong>{selectedProfile?.height || "—"} см</strong></div>
                    <div className="adminClientMetricCardRender"><i>♙</i><span>Возраст</span><strong>{selectedProfile?.age || "—"}</strong></div>
                    <div className="adminClientMetricCardRender"><i>◎</i><span>Твоя цель</span><strong>{getAdminClientGoalLabel(selectedProfile?.goal)}</strong></div>
                    <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>🔥</i><span>Активность</span><strong>{String(getAiNutritionActivityLabel(selectedProfile?.activity || "medium")).replace(" активность", "")}</strong></div>
                    <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>⌁</i><span>Тренировочные дни</span><strong>{getAdminClientTrainingDaysText(selectedProfile)}</strong></div>
                    <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>▣</i><span>Последняя тренировка</span><strong>{lastWorkout?.date ? new Date(lastWorkout.date).toLocaleDateString("ru-RU") : "—"}</strong></div>
                    <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>🧠</i><span>AI-план</span><strong>{aiWeek ? `${aiWeek.calories} ккал` : "—"}</strong></div>
                    <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>✈️</i><span>Telegram</span><strong>{getClientTelegramProfile(selectedClient).connected ? `@${getClientTelegramProfile(selectedClient).username}` : "не привязан"}</strong></div>
                  </div>

                  <div className="adminClientMeasurementsBlock">
                    <div className="adminClientMeasurementsHead">
                      <div>
                        <span>BODY MEASUREMENTS</span>
                        <h3>Данные замеров</h3>
                        <p>{selectedLatestMeasurement ? `Последний замер: ${formatProfileMeasurementDate(selectedLatestMeasurement)}` : "Замеров пока нет или доступ к ним закрыт."}</p>
                      </div>
                      <strong>{selectedLatestMeasurement ? `${adminClientMeasurements.length}` : "—"}</strong>
                    </div>

                    {selectedLatestMeasurement ? (
                      <div className="adminClientMeasurementsGrid">
                        {adminMeasurementPreviewFields.map((field) => {
                          const value = getProfileMeasurementValue(selectedLatestMeasurement || {}, field);
                          const previousValue = getProfileMeasurementValue(selectedPreviousMeasurement || {}, field);
                          const numericValue = Number(String(value || "").replace(",", "."));
                          const numericPrevious = Number(String(previousValue || "").replace(",", "."));
                          const delta = Number.isFinite(numericValue) && Number.isFinite(numericPrevious)
                            ? Math.round((numericValue - numericPrevious) * 10) / 10
                            : null;

                          return (
                            <div key={field.id} className="adminClientMeasurementItem">
                              <span>{field.label}</span>
                              <strong>{value}<small>{field.unit}</small></strong>
                              <em className={delta === null ? "" : delta > 0 ? "up" : delta < 0 ? "down" : ""}>
                                {delta === null ? "—" : delta > 0 ? `+${delta}` : String(delta)}
                              </em>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="adminClientMeasurementsEmpty">
                        <span>📏</span>
                        <p>После первого контрольного замера здесь появятся вес, шея, плечевой пояс, грудь, бицепс, предплечье и остальные объёмы.</p>
                      </div>
                    )}
                  </div>

                  <div className="adminNutritionMonthPanel adminOverviewNutritionMonthPanel">
                    <div className="adminNutritionMonthHead">
                      <div>
                        <span>MONTH OVERVIEW</span>
                        <h3>Календарь активности</h3>
                        <p>Месяц по питанию и тренировкам: калории, белок и тренировочные дни клиента.</p>
                      </div>
                    </div>

                    <div className="adminNutritionCalendarLegend">
                      <span><i className="calorieOk" /> Калории в плане</span>
                      <span><i className="calorieHigh" /> Калорий много</span>
                      <span><i className="proteinFill" /> Белок</span>
                      <span><i className="trainingFill" /> Тренировка</span>
                    </div>

                    <div className="adminNutritionCalendarMonthTitle">
                      <strong>{nutritionMonthLabel}</strong>
                      <span>Тренировочные дни: {currentMonthTrainingDays}</span>
                    </div>

                    <div className="adminNutritionMonthGrid">
                      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((dayLabel) => (
                        <div key={dayLabel} className="adminNutritionWeekday">{dayLabel}</div>
                      ))}

                      {nutritionMonthDays.map(({ key, date, day, inMonth, isToday }) => {
                        const calories = Number(day.totals.calories) || 0;
                        const protein = Number(day.totals.protein) || 0;
                        const caloriePercent = Math.min(100, Math.round((calories / dailyCalorieGoal) * 100));
                        const proteinPercent = Math.min(100, Math.round((protein / dailyProteinGoal) * 100));
                        const isHighCalories = calories > dailyCalorieGoal;
                        const hasFood = calories > 0 || protein > 0;
                        const isTrainingDay = adminClientHistory?.some((workout) => {
                          const workoutDateKey = workout?.date ? new Date(workout.date).toISOString().slice(0, 10) : "";
                          return workoutDateKey === key;
                        });

                        return (
                          <div
                            key={key}
                            className={[
                              "adminNutritionDayCell",
                              inMonth ? "" : "muted",
                              hasFood ? "filled" : "",
                              isTrainingDay ? "trainingDay" : "",
                              isHighCalories ? "highCalories" : "",
                              isToday ? "today" : ""
                            ].filter(Boolean).join(" ")}
                          >
                            <div
                              className="adminNutritionDayCalorieFill"
                              style={{ height: `${hasFood ? Math.max(8, caloriePercent) : 0}%` }}
                            />
                            <div
                              className="adminNutritionDayProteinFill"
                              style={{ height: `${hasFood ? Math.max(5, proteinPercent) : 0}%` }}
                            />
                            <div className="adminNutritionDayContent">
                              <span>{date.getDate()}</span>
                              {isTrainingDay && <b className="adminNutritionTrainingMark">⚡️</b>}
                              {hasFood ? (
                                <>
                                  <strong>{Math.round(calories)}</strong>
                                  <small>{Math.round(protein)}г</small>
                                </>
                              ) : (
                                <em>—</em>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="adminNutritionMonthSummary adminNutritionMonthSummaryBelow">
                      <div>
                        <span>План</span>
                        <strong>{dailyCalorieGoal} ккал</strong>
                        <small>{dailyProteinGoal} г</small>
                      </div>
                      <div>
                        <span>Ср. за день</span>
                        <strong>{Math.round(nutritionMonthAverageCalories)} ккал</strong>
                        <small>{Math.round(nutritionMonthAverageProtein)} г</small>
                      </div>
                    </div>
                  </div>

<div className="adminProgressDiagramsPanel">
                    <div className="adminProgressDiagramsHead">
                      <div>
                        <span>PROGRESS DIAGRAMS</span>
                        <h3>Диаграммы прогресса</h3>
                        <p>Тренировки, калории и белок за последние дни.</p>
                      </div>
                    </div>

                    <div className="adminProgressDiagramGrid">
                      <div className="adminProgressDiagramCard">
                        <span>Силовой прогресс</span>
                        <div className="adminProgressBarsChart">
                          {workoutProgress.slice(0, 5).map((item) => (
                            <div key={item.name}>
                              <small>{item.name}</small>
                              <i><b style={{ width: `${Math.min(100, (item.max / 120) * 100)}%` }} /></i>
                              <strong>{item.max} кг</strong>
                            </div>
                          ))}
                          {!workoutProgress.length && <em>Нет данных по упражнениям</em>}
                        </div>
                      </div>

                      <div className="adminProgressDiagramCard">
                        <span>Калории</span>
                        <div className="adminProgressMiniColumns">
                          {clientNutritionDays.slice(0, 7).reverse().map((day) => (
                            <div key={day.date}>
                              <i style={{ height: `${Math.min(100, Math.max(8, ((Number(day.totals.calories) || 0) / dailyCalorieGoal) * 100))}%` }} />
                              <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit" })}</small>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="adminProgressDiagramCard">
                        <span>Белок</span>
                        <div className="adminProgressMiniColumns adminProgressMiniColumnsProtein">
                          {clientNutritionDays.slice(0, 7).reverse().map((day) => (
                            <div key={day.date}>
                              <i style={{ height: `${Math.min(100, Math.max(8, ((Number(day.totals.protein) || 0) / dailyProteinGoal) * 100))}%` }} />
                              <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit" })}</small>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  

                  <div className="adminClientRecommendations adminClientRecommendationsRender">
                    {recommendations.slice(0, 1).map((item) => (
                      <div key={item}>
                        <span>☆</span>
                        <p>{item}</p>
                        <button type="button" onClick={() => document.querySelector(".adminClientNotesBlock textarea")?.focus()}>Добавить заметку</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminUsersSelectedTab === "training" && (
                <div className="adminClientTabContent adminProgramClientTab">
                  <div className="adminProgramAssignGrid">
                    <div className="adminAssignProgramPanel adminProgramAssignCard">
                      <div className="adminAssignProgramHead">
                        <div>
                          <span>TRAINING PROGRAM</span>
                          <h3>Программа тренировок</h3>
                          <p>Выбери готовую программу из библиотеки и назначь её клиенту.</p>
                        </div>

                        <button onClick={() => {
                          setSelectedUserId(selectedClient.id);
                          loadWorkoutsFromFirebase(selectedClient.id);
                          setPage("adminWorkouts");
                        }}>
                          Редактор
                        </button>
                      </div>

                      <div className="adminCurrentProgramBadge">
                        <span>Сейчас назначено</span>
                        <strong>{selectedClient.assignedProgramName || "Не назначено"}</strong>
                      </div>

                      <div className="adminSavedProgramsGrid adminSavedProgramsGridCompact">
                        {adminTrainingTemplates.map((template) => {
                          const isSelected = adminSelectedTemplateId === template.id;
                          const isAssigned = selectedClient.assignedProgramId === template.id;

                          return (
                            <button
                              key={template.id}
                              className={isSelected || isAssigned ? "adminSavedProgramCard active" : "adminSavedProgramCard"}
                              onClick={() => setAdminSelectedTemplateId(template.id)}
                            >
                              <span>{isAssigned ? "Назначена" : "Готовая программа"}</span>
                              <strong>{template.name}</strong>
                              <small>{template.workouts?.length || 0} трен. · {(template.workouts || []).reduce((sum, workout) => sum + (workout.exercises?.length || 0), 0)} упр.</small>
                              <em>{isSelected ? "Выбрана" : "Выбрать"}</em>
                            </button>
                          );
                        })}

                        {!adminTrainingTemplates.length && (
                          <div className="adminNoSavedPrograms">
                            <strong>Сохранённых программ пока нет</strong>
                            <p>Открой редактор программы, создай программу и сохрани её как шаблон.</p>
                          </div>
                        )}
                      </div>

                      <div className="adminAssignProgramActions adminAssignProgramActionsCompact">
                        <select value={adminSelectedTemplateId} onChange={(event) => setAdminSelectedTemplateId(event.target.value)}>
                          <option value="">Выбери сохранённую программу</option>
                          {adminTrainingTemplates.map((template) => (
                            <option key={template.id} value={template.id}>{template.name}</option>
                          ))}
                        </select>

                        <div className="adminVisibleAssignActions">
                          <button onClick={() => assignSavedProgramToClient(selectedClient.id)}>
                            Назначить программу
                          </button>

                          <button
                            type="button"
                            className="adminClearTemplateButtonVisible"
                            onClick={() => clearClientProgram(selectedClient.id)}
                          >
                            Сбросить
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="adminAssignProgramPanel adminNutritionAssignCard">
                      <div className="adminAssignProgramHead">
                        <div>
                          <span>NUTRITION PLAN</span>
                          <h3>План питания</h3>
                          <p>Назначь клиенту целевые калории и белок. Эти данные используются в календаре питания.</p>
                        </div>
                      </div>

                      <label className="adminNutritionPlanSelect">
                        <span>Вариант плана</span>
                        <select
                          value={adminSelectedNutritionPreset}
                          onChange={(event) => setAdminSelectedNutritionPreset(event.target.value)}
                        >
                          <option value="balanced">Баланс · 2400 ккал · Б 160</option>
                          <option value="fat_loss">Снижение веса · 2100 ккал · Б 170</option>
                          <option value="muscle_gain">Набор массы · 2850 ккал · Б 180</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        className="adminNutritionAssignButton"
                        onClick={async () => {
                          try {
                            const nutritionPresetMap = {
                              balanced: { name: "Баланс", calories: 2400, protein: 160, fat: 75, carbs: 260 },
                              fat_loss: { name: "Снижение веса", calories: 2100, protein: 170, fat: 65, carbs: 190 },
                              muscle_gain: { name: "Набор массы", calories: 2850, protein: 180, fat: 85, carbs: 340 }
                            };
                            const selectedNutritionPreset = nutritionPresetMap[adminSelectedNutritionPreset] || nutritionPresetMap.balanced;
                            const nextNutritionGoals = {
                              ...(selectedClient.nutritionGoals || {}),
                              calories: selectedNutritionPreset.calories,
                              protein: selectedNutritionPreset.protein,
                              fat: selectedNutritionPreset.fat,
                              carbs: selectedNutritionPreset.carbs
                            };

                            await setDoc(doc(db, "users", selectedClient.id), {
                              nutritionGoals: nextNutritionGoals,
                              nutritionPlan: {
                                name: selectedNutritionPreset.name,
                                calories: nextNutritionGoals.calories,
                                protein: nextNutritionGoals.protein,
                                updatedAt: new Date().toISOString()
                              }
                            }, { merge: true });

                            setAdminSelectedClient((prev) => prev?.id === selectedClient.id ? {
                              ...prev,
                              nutritionGoals: nextNutritionGoals,
                              nutritionPlan: {
                                ...(prev.nutritionPlan || {}),
                                name: selectedNutritionPreset.name,
                                calories: nextNutritionGoals.calories,
                                protein: nextNutritionGoals.protein,
                                updatedAt: new Date().toISOString()
                              }
                            } : prev);

                            setUsersList((prev) => prev.map((client) => client.id === selectedClient.id ? {
                              ...client,
                              nutritionGoals: nextNutritionGoals,
                              nutritionPlan: {
                                ...(client.nutritionPlan || {}),
                                name: aiPlan?.title || aiPlan?.name || "План питания",
                                calories: nextNutritionGoals.calories,
                                protein: nextNutritionGoals.protein,
                                updatedAt: new Date().toISOString()
                              }
                            } : client));

                            setAdminClientStatus("План питания назначен клиенту.");
                          } catch (error) {
                            console.error("Nutrition plan assign error:", error);
                            setAdminClientStatus("Не получилось назначить план питания.");
                          }
                        }}
                      >
                        Назначить план питания
                      </button>

                      <button
                        type="button"
                        className="adminNutritionAssignButton ghost"
                        onClick={async () => {
                          const confirmed = window.confirm("Сбросить назначенный план питания клиента?");
                          if (!confirmed) return;

                          try {
                            const defaultGoals = {
                              calories: defaultNutritionState.goals.calories,
                              protein: defaultNutritionState.goals.protein,
                              fat: defaultNutritionState.goals.fat,
                              carbs: defaultNutritionState.goals.carbs
                            };

                            await setDoc(doc(db, "users", selectedClient.id), {
                              nutritionGoals: defaultGoals,
                              nutritionPlan: null,
                              aiNutritionPlan: null
                            }, { merge: true });

                            setAdminSelectedClient((prev) => prev?.id === selectedClient.id ? {
                              ...prev,
                              nutritionGoals: defaultGoals,
                              nutritionPlan: null,
                              aiNutritionPlan: null
                            } : prev);

                            setUsersList((prev) => prev.map((client) => client.id === selectedClient.id ? {
                              ...client,
                              nutritionGoals: defaultGoals,
                              nutritionPlan: null,
                              aiNutritionPlan: null
                            } : client));

                            setAdminClientStatus("План питания сброшен.");
                          } catch (error) {
                            console.error("Nutrition plan reset error:", error);
                            setAdminClientStatus("Не получилось сбросить план питания.");
                          }
                        }}
                      >
                        Сбросить
                      </button>
                    </div>
                  </div>

                  

                </div>
              )}

              {(adminUsersSelectedTab === "calendarNutrition" || adminUsersSelectedTab === "nutrition" || adminUsersSelectedTab === "calendar") && (
                <div className="adminClientTabContent adminClientNutritionCalendarContent">
                  <div className="adminTrainingMonthPanel">
                    <div className="adminTrainingMonthHead">
                      <div>
                        <span>TRAINING CALENDAR</span>
                        <h3>Календарь тренировок</h3>
                        <p>Только тренировочные дни без молний, калорий, белка и питания.</p>
                      </div>
                    </div>

                    <div className="adminTrainingMonthTitle">
                      <strong>{nutritionMonthLabel}</strong>
                      <span>Тренировочные дни: {currentMonthTrainingDays}</span>
                    </div>

                    <div className="adminTrainingMonthGrid">
                      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                        <div key={day} className="adminTrainingWeekday">{day}</div>
                      ))}

                      {nutritionMonthDays.map(({ key, date, inMonth, isToday }) => {
                        const isTrainingDay = adminCalendarDraft.trainingDays?.includes(trainingDayIdByJsDay[date.getDay()]);

                        return (
                          <div
                            key={key}
                            className={[
                              "adminTrainingDayCell",
                              inMonth ? "" : "muted",
                              isTrainingDay ? "trainingDay" : "",
                              isToday ? "today" : ""
                            ].filter(Boolean).join(" ")}
                          >
                            <span>{date.getDate()}</span>
                            {isTrainingDay && <i>тренировка</i>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="adminCalendarPanel adminCalendarPanelMerged">
<div className="adminCalendarHead">
                      <div>
                        <span>TRAINING REMINDERS</span>
                        <h3>Напоминания</h3>
                        
                      </div>
                      <div className={getClientTelegramProfile(selectedClient).connected ? "adminCalendarTelegram connected" : "adminCalendarTelegram"}>
                        Telegram
                      </div>
                    </div>

<div className="adminCalendarDays">
                      {ADMIN_CALENDAR_DAYS.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          className={adminCalendarDraft.trainingDays?.includes(day.id) ? "active" : ""}
                          onClick={() => toggleAdminCalendarDay(day.id)}
                        >
                          <strong>{day.title}</strong>
                          <span>{day.full}</span>
                        </button>
                      ))}
                    </div>

                    <div className="adminCalendarSettingsGrid adminCalendarPerDaySettings">
                      {(adminCalendarDraft.trainingDays || []).length ? (
                        (adminCalendarDraft.trainingDays || []).map((dayId) => {
                          const day = ADMIN_CALENDAR_DAYS.find((item) => item.id === dayId);
                          const daySettings = adminCalendarDraft.daySettings?.[dayId] || {};

                          return (
                            <div className="adminCalendarDaySettingsRow" key={dayId}>
                              <div className="adminCalendarDaySettingsTitle">{day?.title || dayId}</div>

                              <div className="adminCalendarDayTimeGrid">
                                <label className="adminCalendarWorkoutTimeField">
                                  <span>Время тренировки</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="13:00"
                                    maxLength={5}
                                    className="adminReminderTimeInput adminReminderTimeManualInput"
                                    value={daySettings.workoutTime || adminCalendarDraft.workoutTime || "13:00"}
                                    onChange={(event) => {
                                      let value = event.target.value.replace(/[^0-9:]/g, "");

                                      if (value.length === 2 && !value.includes(":")) {
                                        value = `${value}:`;
                                      }

                                      updateAdminCalendarDaySetting(dayId, "workoutTime", value);
                                    }}
                                  />
                                </label>

                                <label className="adminCalendarReminderBeforeField">
                                  <span>Напомнить за</span>
                                  <select
                                    className="adminReminderBeforeSelect"
                                    value={daySettings.reminderBefore || daySettings.reminderTime || "1 день"}
                                    onChange={(event) => updateAdminCalendarDaySetting(dayId, "reminderBefore", event.target.value)}
                                  >
                                    <option value="1 день">1 день</option>
                                    <option value="2 дня">2 дня</option>
                                  </select>
                                </label>
                              </div>

                              <button
                                type="button"
                                className={daySettings.hourReminderEnabled === true ? "adminCalendarHourReminder active" : "adminCalendarHourReminder"}
                                onClick={() => updateAdminCalendarDaySetting(dayId, "hourReminderEnabled", daySettings.hourReminderEnabled !== true)}
                              >
                                <span>Напомнить за час</span>
                                <i aria-hidden="true"></i>
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="adminCalendarNoDaysHint">Выбери дни тренировок выше</div>
                      )}
                    </div>



<div className="adminCalendarToggles">
                      <button
                        type="button"
                        className={adminCalendarDraft.enabled !== false ? "active" : ""}
                        onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, enabled: prev.enabled === false }))}
                      >
                        {adminCalendarDraft.enabled !== false ? "Напоминания вкл" : "Напоминания выкл"}
                      </button>

                      <button
                        type="button"
                        className={adminCalendarDraft.reminderEnabled !== false ? "active" : ""}
                        onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, reminderEnabled: prev.reminderEnabled === false }))}
                      >
                        {adminCalendarDraft.reminderEnabled !== false ? "" : ""}
                      </button>
                    </div>
<button
                      className="adminV3OpenEditor"
                      disabled={adminCalendarSaving}
                      onClick={() => saveAdminClientCalendar(selectedClient)}
                    >
                      {adminCalendarSaving ? "Сохраняю..." : "Сохранить расписание"}
                    </button>

                    <button
                      type="button"
                      className="adminCalendarTestButton"
                      disabled={adminCalendarTesting}
                      onClick={() => sendAdminTestWorkoutReminder(selectedClient)}
                    >
                      {adminCalendarTesting ? "Отправляю..." : "Тестовое сообщение"}
                    </button>
                  </div>
                </div>
              )}

              {adminUsersSelectedTab === "telegram" && (
                <div className="adminClientTabContent adminClientTelegramOnlyTab">
<div className="adminClientTelegramPanel adminClientTelegramPanelRender">
                    <div className="adminClientTelegramHead adminClientTelegramHeadRender">
                      <div className="adminClientTelegramTitleRender">
                        <div className="adminClientTelegramLogoRender">✈️</div>
                        <div>
                          <h3>Telegram</h3>
                          <p>Уведомления тренера</p>
                        </div>
                      </div>

                      <div className={getClientTelegramProfile(selectedClient).connected ? "adminClientTelegramBadge connected" : "adminClientTelegramBadge"}>
                        {getClientTelegramProfile(selectedClient).connected ? "Подключен" : "Не подключен"}
                      </div>
                    </div>

                    <p className="adminClientTelegramDescriptionRender">Напоминания за день до тренировки и быстрые сообщения клиенту.</p>

                    <div className="adminClientTelegramBody adminClientTelegramBodyRender">
                      <div className="adminClientTelegramAvatar adminClientTelegramAvatarRender">
                        {getClientTelegramProfile(selectedClient).avatarUrl ? (
                          <img src={getClientTelegramProfile(selectedClient).avatarUrl} alt="" />
                        ) : (
                          <span>
                            {String(selectedClient.name || selectedClient.email || "К").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="adminClientTelegramUserRender">
                        <strong>
                          {getClientTelegramProfile(selectedClient).connected
                            ? (getClientTelegramProfile(selectedClient).displayName || selectedClient.name || `@${getClientTelegramProfile(selectedClient).username}`)
                            : "Telegram не привязан"}
                        </strong>
                        <small>
                          {getClientTelegramProfile(selectedClient).connected
                            ? `@${getClientTelegramProfile(selectedClient).username || "telegram"}`
                            : "Клиент должен привязать Telegram в личном кабинете."}
                        </small>
                      </div>

                      <div className="adminClientTelegramActions adminClientTelegramActionsRender">
                        <button
                          type="button"
                          disabled={!getClientTelegramProfile(selectedClient).connected}
                          onClick={() => openTelegramChat(getClientTelegramProfile(selectedClient).username)}
                        >
                          Открыть чат
                        </button>

                        <button
                          type="button"
                          className="danger"
                          disabled={!getClientTelegramProfile(selectedClient).connected}
                          onClick={() => toggleClientTelegramNotifications(selectedClient, !getClientTelegramProfile(selectedClient).notificationsEnabled)}
                        >
                          {getClientTelegramProfile(selectedClient).notificationsEnabled ? "Отключить" : "Включить"}
                        </button>
                      </div>
                    </div>

                    <div className="adminTelegramComposer adminTelegramComposerRender">
                      <div className="adminTelegramTextareaWrapRender">
                        <textarea
                          value={adminTelegramMessage}
                          onChange={(event) => setAdminTelegramMessage(event.target.value)}
                          placeholder="Сообщение клиенту в Telegram..."
                          disabled={!getClientTelegramProfile(selectedClient).connected}
                        />
                        <span>0/4096</span>
                        <button
                          type="button"
                          className="adminTelegramSendButton"
                          disabled={!getClientTelegramProfile(selectedClient).connected || adminTelegramSending}
                          onClick={() => sendAdminTelegramMessage(selectedClient)}
                        >
                          {adminTelegramSending ? "Отправляю..." : "✈ Отправить"}
                        </button>
                      </div>

                      <div className="adminTelegramQuickMessages adminTelegramQuickMessagesRender">
                        <strong>Быстрые сообщения</strong>
                        <div>
                          {[
                            ["⚡", "Завтра тренировка 💪", "Не забудь выспаться"],
                            ["⚡", "Сегодня держи технику", "И не гонись за весом"],
                            ["⚡", "Отличная работа 👏", "Продолжай в том же духе"]
                          ].map(([icon, title, subtitle]) => {
                            const message = `${title}. ${subtitle}.`;
                            return (
                              <button
                                key={title}
                                type="button"
                                disabled={!getClientTelegramProfile(selectedClient).connected}
                                onClick={() => setAdminTelegramMessage(message)}
                              >
                                <span>{icon}</span>
                                <b>{title}</b>
                                <small>{subtitle}</small>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button type="button" className="adminClientTelegramSavedRender" onClick={() => setAdminUsersSelectedTab("calendarNutrition")}>
                        <span>▣</span>
                        <strong>Календарь и Telegram-напоминания сохранены.</strong>
                        <i>›</i>
                      </button>
                    </div>
                  </div>
                </div>
              )}

{adminUsersSelectedTab === "overview" && (
                <div className="adminClientOverviewOnlyBlocks">
<div className="adminClientBottomTools">
                <div className="adminClientTabContent adminClientNotesBlock">
                  <div className="adminClientBottomBlockHead">
                    <span>NOTES</span>
                    <h3>Заметка тренера</h3>
                  </div>
                  <textarea
                    className="adminV3Note"
                    value={adminTrainerNote}
                    onChange={(event) => setAdminTrainerNote(event.target.value)}
                    placeholder="Заметки тренера по клиенту..."
                  />
                  <button className="adminV3OpenEditor" onClick={saveAdminTrainerNote}>Сохранить заметку</button>
                </div>

                <div className="adminClientTabContent adminClientTransferBlock">
                  <div className="adminClientBottomBlockHead">
                    <span>TRANSFER</span>
                    <h3>Перенос данных</h3>
                  </div>
                  <div className="adminTransferGrid">
                    <label>
                      <span>Источник данных</span>
                      <select value={adminTransferFromUid} onChange={(event) => setAdminTransferFromUid(event.target.value)}>
                        <option value="">Выбери источник</option>
                        {adminAllUsersList.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.email || client.name || client.id}{client.role === "admin" || client.email === ADMIN_EMAIL ? " · ADMIN" : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Клиент-получатель</span>
                      <select value={adminTransferToUid || selectedClient.id} onChange={(event) => setAdminTransferToUid(event.target.value)}>
                        <option value="">Выбери клиента</option>
                        {usersList.map((client) => (
                          <option key={client.id} value={client.id}>{client.email || client.name || client.id}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    className="adminV3OpenEditor"
                    disabled={adminTransferLoading}
                    onClick={() => {
                      transferClientDataBetweenAccounts(adminTransferFromUid, adminTransferToUid || selectedClient.id);
                    }}
                  >
                    {adminTransferLoading ? "Переношу..." : "Перенести данные"}
                  </button>
                  {adminTransferStatus && <p className="adminV3Status">{adminTransferStatus}</p>}
                </div>
              </div>

              <div className="adminClientDangerZoneBottom">
                <div>
                  <span>DANGER ZONE</span>
                  <strong>Удаление клиента</strong>
                  <p>Кнопка перенесена вниз, чтобы не мешать работе с программой и календарём.</p>
                </div>
                <button className="danger" onClick={() => deleteClientEverywhereFromAdminPanel(selectedClient)}>Удалить клиента</button>
              </div>
                </div>
              )}

              {adminClientStatus && <p className="adminV3Status">{adminClientStatus}</p>}
            </section>
          )}
</main>
<nav className="adminV3Nav adminV3BottomBar" aria-label="Админ меню">
            <button className={page === "admin" ? "active" : ""} type="button" onClick={() => setPage("admin")}>
              <span className="adminV3NavIcon">📊</span>
              <span className="adminV3NavLabel">Дашборд</span>
            </button>
            <button className={page === "adminUsers" ? "active" : ""} type="button" onClick={() => setPage("adminUsers")}>
              <span className="adminV3NavIcon">👥</span>
              <span className="adminV3NavLabel">Клиенты</span>
            </button>
            <button className={page === "adminWorkouts" ? "active" : ""} type="button" onClick={() => selectedClient && setPage("adminWorkouts")}>
              <span className="adminV3NavIcon">🏋️</span>
              <span className="adminV3NavLabel">Программы</span>
            </button>
            <button className={page === "adminStats" ? "active" : ""} type="button" onClick={exportAdminClientCsv}>
              <span className="adminV3NavIcon">📈</span>
              <span className="adminV3NavLabel">Отчёты</span>
            </button>
          </nav>
</div>
    );
  }

  if (page === "adminWorkouts") {
    if (!canUseTrainerFeatures()) {
      return (
        <div className="app">
          <button className="backBtn" onClick={() => setPage("main")}>← Главное меню</button>
          <div className="historyEmptyCard">
            <h3>Доступ закрыт</h3>
            <p>Тренерская доступна админам и пользователям с ролью тренера.</p>
          </div>
        </div>
      );
    }

    const selectedUser = usersList.find((u) => u.id === selectedUserId);
    const monthProgram = adminProgramGroups?.[0] || {
      id: `month_${Date.now()}`,
      name: "Программа на месяц",
      blocks: [
        { id: "block_1", name: "Блок 1", weeks: [{ id: "week_1", name: "Неделя 1", workouts: [] }, { id: "week_2", name: "Неделя 2", workouts: [] }] },
        { id: "block_2", name: "Блок 2", weeks: [{ id: "week_3", name: "Неделя 3", workouts: [] }, { id: "week_4", name: "Неделя 4", workouts: [] }] }
      ]
    };

    const monthBlocks = monthProgram.blocks || [];
    const monthWorkouts = monthBlocks.flatMap((block) =>
      (block.weeks || []).flatMap((week) =>
        (week.workouts || []).map((workout) => ({ ...workout, blockName: block.name, weekName: week.name }))
      )
    );
    const monthExercises = monthWorkouts.reduce((sum, workout) => sum + (workout.exercises?.length || 0), 0);

    function normalizeMonthProgram(program = monthProgram) {
      const blocks = [0, 1].map((blockIndex) => {
        const sourceBlock = program.blocks?.[blockIndex] || {};
        return {
          id: sourceBlock.id || `block_${blockIndex + 1}`,
          name: sourceBlock.name || `Блок ${blockIndex + 1}`,
          weeks: [0, 1].map((weekOffset) => {
            const absoluteWeek = blockIndex * 2 + weekOffset + 1;
            const sourceWeek = sourceBlock.weeks?.[weekOffset] || {};
            return {
              id: sourceWeek.id || `week_${absoluteWeek}`,
              name: sourceWeek.name || `Неделя ${absoluteWeek}`,
              workouts: sourceWeek.workouts || []
            };
          })
        };
      });

      return {
        id: program.id || `month_${Date.now()}`,
        name: program.name || "Программа на месяц",
        createdAt: program.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        blocks
      };
    }

    function setMonthProgram(updater) {
      setAdminProgramGroups((prev) => {
        const base = normalizeMonthProgram(prev?.[0] || monthProgram);
        const nextProgram = normalizeMonthProgram(typeof updater === "function" ? updater(base) : updater);
        const flatWorkouts = nextProgram.blocks.flatMap((block) =>
          block.weeks.flatMap((week) =>
            (week.workouts || []).map((workout) => ({
              ...workout,
              name: workout.name || `${week.name} — тренировка`,
              blockName: block.name,
              weekName: week.name
            }))
          )
        );
        setPlan({ workouts: flatWorkouts });
        return [nextProgram];
      });
    }

    function updateMonthProgramName(name) {
      setMonthProgram((program) => ({ ...program, name }));
    }

    function addMonthWorkout(blockId, weekId) {
      const newWorkoutId = `workout_${Date.now()}`;

      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          weeks: block.weeks.map((week) => week.id !== weekId ? week : {
            ...week,
            workouts: [
              ...(week.workouts || []),
              {
                id: newWorkoutId,
                name: `${week.name} — Тренировка ${(week.workouts?.length || 0) + 1}`,
                exercises: []
              }
            ]
          })
        })
      }));

      setAdminOpenWorkoutId(newWorkoutId);
    }

    function updateMonthWorkout(blockId, weekId, workoutId, patch) {
      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          weeks: block.weeks.map((week) => week.id !== weekId ? week : {
            ...week,
            workouts: (week.workouts || []).map((workout) =>
              workout.id === workoutId ? { ...workout, ...patch } : workout
            )
          })
        })
      }));
    }

    function removeMonthWorkout(blockId, weekId, workoutId) {
      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          weeks: block.weeks.map((week) => week.id !== weekId ? week : {
            ...week,
            workouts: (week.workouts || []).filter((workout) => workout.id !== workoutId)
          })
        })
      }));
    }

    function addMonthExercise(blockId, weekId, workoutId) {
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: [
          ...((monthWorkouts.find((workout) => workout.id === workoutId)?.exercises) || []),
          {
            id: `exercise_${Date.now()}`,
            name: "Новое упражнение",
            video: "",
            sets: [{ reps: 8, weight: "" }]
          }
        ]
      });
    }

    function updateMonthExerciseSet(blockId, weekId, workoutId, exerciseId, setIndex, patch) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: (sourceWorkout?.exercises || []).map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;

          const nextSets = Array.isArray(exercise.sets) && exercise.sets.length
            ? [...exercise.sets]
            : [{ reps: 8, weight: "" }];

          nextSets[setIndex] = {
            ...(nextSets[setIndex] || { reps: 8, weight: "" }),
            ...patch
          };

          return {
            ...exercise,
            sets: nextSets
          };
        })
      });
    }

    function addMonthExerciseSet(blockId, weekId, workoutId, exerciseId) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: (sourceWorkout?.exercises || []).map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;

          return {
            ...exercise,
            sets: [
              ...(Array.isArray(exercise.sets) && exercise.sets.length ? exercise.sets : [{ reps: 8, weight: "" }]),
              { reps: 8, weight: "" }
            ]
          };
        })
      });
    }

    function removeMonthExerciseSet(blockId, weekId, workoutId, exerciseId, setIndex) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: (sourceWorkout?.exercises || []).map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;

          const currentSets = Array.isArray(exercise.sets) && exercise.sets.length
            ? exercise.sets
            : [{ reps: 8, weight: "" }];

          if (currentSets.length <= 1) return exercise;

          return {
            ...exercise,
            sets: currentSets.filter((_, index) => index !== setIndex)
          };
        })
      });
    }

    function updateMonthExercise(blockId, weekId, workoutId, exerciseId, patch) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: (sourceWorkout?.exercises || []).map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, ...patch } : exercise
        )
      });
    }

    function removeMonthExercise(blockId, weekId, workoutId, exerciseId) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: (sourceWorkout?.exercises || []).filter((exercise) => exercise.id !== exerciseId)
      });
    }

    async function uploadMonthExerciseVideo(blockId, weekId, workoutId, exerciseId, file) {
      if (!file) return;

      try {
        const safeName = String(file.name || "exercise-video").replace(/[^\wа-яА-ЯёЁ.\-]+/g, "_");
        const storageRef = ref(storage, `program-videos/${monthProgram.id || "draft"}/${Date.now()}-${safeName}`);

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        updateMonthExercise(blockId, weekId, workoutId, exerciseId, { video: url });
        showAppError("savedLocal", "Видео добавлено к упражнению.");
      } catch (error) {
        console.error("Month exercise video upload error:", error);
        showAppError("firebase", "Не получилось загрузить видео.");
      }
    }

    async function saveMonthProgramToLibrary() {
      const program = normalizeMonthProgram(monthProgram);
      const workoutsToSave = program.blocks.flatMap((block, blockIndex) =>
        block.weeks.flatMap((week, weekIndex) =>
          (week.workouts || []).map((workout, workoutIndex) => ({
            ...workout,
            blockId: block.id,
            blockName: block.name,
            weekId: week.id,
            weekName: week.name,
            order: blockIndex * 100 + weekIndex * 20 + workoutIndex + 1
          }))
        )
      );

      try {
        await setDoc(doc(db, "trainingTemplates", program.id), {
          id: program.id,
          name: program.name,
          type: "monthly_program",
          source: "program_library",
          blocks: program.blocks,
          workouts: workoutsToSave,
          createdAt: program.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || "",
          createdByEmail: user?.email || ""
        }, { merge: true });

        setAdminTemplateName(program.name || "");
        setAdminSelectedTemplateId(program.id);
        await loadAdminTrainingTemplates();

        showAppError("savedLocal", "Программа сохранена в библиотеку.");
      } catch (error) {
        console.error("Save month program to library error:", error);
        showAppError("firebase", "Не получилось сохранить программу в библиотеку.");
      }
    }

    function normalizeImportedMonthlyProgram(rawProgram = {}) {
      if (rawProgram.schema !== "tren-monthly-program-v1") {
        throw new Error("Неверный формат файла. Нужен schema: tren-monthly-program-v1");
      }

      const importedBlocks = Array.isArray(rawProgram.blocks) ? rawProgram.blocks : [];

      if (importedBlocks.length !== 2) {
        throw new Error("В файле должно быть 2 блока.");
      }

      const normalizedBlocks = importedBlocks.map((block, blockIndex) => {
        const weeks = Array.isArray(block.weeks) ? block.weeks : [];

        if (weeks.length !== 2) {
          throw new Error(`В блоке ${blockIndex + 1} должно быть 2 недели.`);
        }

        return {
          id: block.id || `block_${blockIndex + 1}`,
          name: block.name || `Блок ${blockIndex + 1}`,
          weeks: weeks.map((week, weekIndex) => ({
            id: week.id || `week_${blockIndex * 2 + weekIndex + 1}`,
            name: week.name || `Неделя ${blockIndex * 2 + weekIndex + 1}`,
            workouts: (Array.isArray(week.workouts) ? week.workouts : []).map((workout, workoutIndex) => ({
              id: workout.id || `week${blockIndex * 2 + weekIndex + 1}_day${workoutIndex + 1}_${Date.now()}`,
              name: workout.name || `${week.name || `Неделя ${blockIndex * 2 + weekIndex + 1}`} — Тренировка ${workoutIndex + 1}`,
              exercises: (Array.isArray(workout.exercises) ? workout.exercises : []).map((exercise, exerciseIndex) => ({
                id: exercise.id || `exercise_${Date.now()}_${exerciseIndex}`,
                name: exercise.name || "Упражнение",
                video: exercise.video || "",
                sets: Array.isArray(exercise.sets) && exercise.sets.length
                  ? exercise.sets.map((set) => ({
                      reps: Number(set.reps) || 8,
                      weight: String(set.weight ?? "")
                    }))
                  : [{ reps: 8, weight: "" }]
              }))
            }))
          }))
        };
      });

      return normalizeMonthProgram({
        id: rawProgram.id || `imported_${Date.now()}`,
        name: rawProgram.name || "Импортированная программа",
        description: rawProgram.description || "",
        rules: rawProgram.rules || {},
        blocks: normalizedBlocks
      });
    }

    async function importMonthProgramFromFile(file) {
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const nextProgram = normalizeImportedMonthlyProgram(parsed);

        setAdminProgramEditorMode("create");
        setAdminOpenWorkoutId("");
        setAdminActiveProgramId(nextProgram.id);
        setAdminSelectedTemplateId("");
        setAdminProgramGroups([nextProgram]);

        const flatWorkouts = nextProgram.blocks.flatMap((block) =>
          block.weeks.flatMap((week) =>
            (week.workouts || []).map((workout) => ({
              ...workout,
              blockName: block.name,
              weekName: week.name
            }))
          )
        );

        setPlan({ workouts: flatWorkouts });
        showAppError("savedLocal", "План загружен. Проверь и нажми «Сохранить программу».");
      } catch (error) {
        console.error("Program import error:", error);
        showAppError("load", error.message || "Не получилось импортировать программу.");
      }
    }

    function createNewMonthProgramDraft() {
      const nextProgram = normalizeMonthProgram({
        id: `month_${Date.now()}`,
        name: "Новая программа на месяц",
        blocks: [
          { id: "block_1", name: "Блок 1", weeks: [{ id: "week_1", name: "Неделя 1", workouts: [] }, { id: "week_2", name: "Неделя 2", workouts: [] }] },
          { id: "block_2", name: "Блок 2", weeks: [{ id: "week_3", name: "Неделя 3", workouts: [] }, { id: "week_4", name: "Неделя 4", workouts: [] }] }
        ]
      });

      setAdminProgramEditorMode("create");
      setAdminOpenWorkoutId("");
      setAdminActiveProgramId(nextProgram.id);
      setAdminSelectedTemplateId("");
      setAdminProgramGroups([nextProgram]);
      setPlan({ workouts: [] });
    }

    function editExistingMonthProgram(templateId) {
      const template = adminTrainingTemplates.find((item) => item.id === templateId);

      if (!template) return;

      const templateBlocks = Array.isArray(template.blocks) && template.blocks.length
        ? template.blocks
        : [
            {
              id: "block_1",
              name: "Блок 1",
              weeks: [
                { id: "week_1", name: "Неделя 1", workouts: template.workouts || [] },
                { id: "week_2", name: "Неделя 2", workouts: [] }
              ]
            },
            {
              id: "block_2",
              name: "Блок 2",
              weeks: [
                { id: "week_3", name: "Неделя 3", workouts: [] },
                { id: "week_4", name: "Неделя 4", workouts: [] }
              ]
            }
          ];

      const nextProgram = normalizeMonthProgram({
        id: template.id,
        name: template.name || "Программа на месяц",
        createdAt: template.createdAt,
        blocks: templateBlocks
      });

      setAdminProgramEditorMode("edit");
      setAdminSelectedTemplateId(template.id);
      setAdminActiveProgramId(template.id);
      setAdminOpenWorkoutId("");
      setAdminProgramGroups([nextProgram]);

      const flatWorkouts = nextProgram.blocks.flatMap((block) =>
        block.weeks.flatMap((week) =>
          (week.workouts || []).map((workout) => ({
            ...workout,
            blockName: block.name,
            weekName: week.name
          }))
        )
      );

      setPlan({ workouts: flatWorkouts });
    }

    function getTemplateStats(template = {}) {
      const workouts = Array.isArray(template.workouts)
        ? template.workouts
        : (template.blocks || []).flatMap((block) =>
            (block.weeks || []).flatMap((week) => week.workouts || [])
          );

      const exercisesCount = workouts.reduce((sum, workout) => sum + ((workout.exercises || []).length), 0);
      const weeksCount = (template.blocks || []).reduce((sum, block) => sum + ((block.weeks || []).length), 0);

      return {
        workoutsCount: workouts.length,
        exercisesCount,
        weeksCount: weeksCount || 4
      };
    }

    function openProgramFromLibrary(templateId) {
      if (!templateId) return;

      editExistingMonthProgram(templateId);
      setAdminProgramLibraryTab("editor");
      setAdminProgramEditorMode("edit");
    }

    async function deleteProgramFromLibrary(templateId) {
      const template = adminTrainingTemplates.find((item) => item.id === templateId);

      if (!template) return;

      const confirmed = window.confirm(`Удалить программу “${template.name}” из библиотеки? Это не удалит уже назначенные клиентам тренировки.`);

      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, "trainingTemplates", templateId));

        if (adminSelectedTemplateId === templateId) {
          setAdminSelectedTemplateId("");
        }

        await loadAdminTrainingTemplates();
        showAppError("savedLocal", "Программа удалена из библиотеки.");
      } catch (error) {
        console.error("Delete program from library error:", error);
        showAppError("firebase", "Не получилось удалить программу.");
      }
    }

    return (
      <div className="monthProgramEditorPage">
        <header className="monthProgramTopbar">
          <button className="adminFixedMainBack" onClick={() => setPage("main")} aria-label="Главное меню"><span>←</span><b>Главное меню</b></button>
          <div>
            <span>MONTH PROGRAM</span>
            <h1>ы</h1>
            <p>Создай месячную программу и сохрани её в библиотеку. Назначение клиенту — отдельным шагом.</p>
          </div>
          <div className="monthProgramTopbarSpacer" />
        </header>

        <section className="monthProgramTabs">
          <button
            type="button"
            className={adminProgramLibraryTab === "editor" ? "active" : ""}
            onClick={() => setAdminProgramLibraryTab("editor")}
          >
            Редактор
          </button>
          <button
            type="button"
            className={adminProgramLibraryTab === "library" ? "active" : ""}
            onClick={() => setAdminProgramLibraryTab("library")}
          >
            Готовые программы
          </button>
        </section>

        {adminProgramLibraryTab === "library" ? (
          <section className="programLibraryPanel">
            <div className="programLibraryHead">
              <div>
                <span>PROGRAM LIBRARY</span>
                <h2>Готовые программы</h2>
                <p>Сохранённые программы можно открыть для редактирования или удалить из библиотеки.</p>
              </div>
              <button type="button" onClick={loadAdminTrainingTemplates}>🔄</button>
            </div>

            {adminTrainingTemplates.length === 0 ? (
              <div className="programLibraryEmpty">
                <strong>Пока нет готовых программ</strong>
                <p>Создай программу в редакторе или загрузи JSON-файл.</p>
              </div>
            ) : (
              <div className="programLibraryGrid">
                {adminTrainingTemplates.map((template) => {
                  const stats = getTemplateStats(template);

                  return (
                    <article className="programLibraryCard" key={template.id}>
                      <div className="programLibraryCardTop">
                        <span>{template.type === "monthly_program" ? "Месячная" : "Шаблон"}</span>
                        <strong>{template.name || "Без названия"}</strong>
                        <p>{stats.weeksCount} нед. · {stats.workoutsCount} трен. · {stats.exercisesCount} упр.</p>
                      </div>

                      <div className="programLibraryActions">
                        <button type="button" onClick={() => openProgramFromLibrary(template.id)}>
                          Редактировать
                        </button>
                        <button type="button" className="danger" onClick={() => deleteProgramFromLibrary(template.id)}>
                          Удалить
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="monthProgramModePanel">
          <div className="monthProgramModeButtons">
            <button
              type="button"
              className={adminProgramEditorMode === "create" ? "active" : ""}
              onClick={createNewMonthProgramDraft}
            >
              + Создать программу
            </button>
            <button
              type="button"
              className={adminProgramEditorMode === "edit" ? "active" : ""}
              onClick={() => {
                setAdminProgramEditorMode("edit");
                if (adminSelectedTemplateId) editExistingMonthProgram(adminSelectedTemplateId);
              }}
            >
              Редактировать программу
            </button>
          </div>

          <select
            value={adminSelectedTemplateId}
            onChange={(event) => editExistingMonthProgram(event.target.value)}
          >
            <option value="">Выбери программу из библиотеки</option>
            {adminTrainingTemplates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>

          <label className="monthProgramImportBtn">
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => importMonthProgramFromFile(event.target.files?.[0])}
            />
            Загрузить план из JSON
          </label>
        </section>

        <section className="monthProgramSummary">
          <label className="monthProgramNameField">
            <span>Название месячной программы</span>
            <input
              value={monthProgram.name || ""}
              onChange={(event) => updateMonthProgramName(event.target.value)}
              placeholder="Например: Май · набор массы"
            />
          </label>
          <div><strong>{monthBlocks.length}</strong><span>блока</span></div>
          <div><strong>4</strong><span>недели</span></div>
          <div><strong>{monthWorkouts.length}</strong><span>трен.</span></div>
          <div><strong>{monthExercises}</strong><span>упр.</span></div>
        </section>

        <div className="monthProgramBlocks">
          {monthBlocks.map((block) => (
            <section className="monthProgramBlock" key={block.id}>
              <div className="monthProgramBlockHead">
                <h2>{block.name}</h2>
                <span>{block.weeks?.[0]?.name}–{block.weeks?.[1]?.name}</span>
              </div>

              <div className="monthProgramWeeks">
                {(block.weeks || []).map((week) => (
                  <article className="monthProgramWeek" key={week.id}>
                    <div className="monthProgramWeekHead">
                      <h3>{week.name}</h3>
                      <button onClick={() => addMonthWorkout(block.id, week.id)}>+ тренировка</button>
                    </div>

                    {(week.workouts || []).length === 0 && (
                      <div className="monthProgramEmpty">В этой неделе пока нет тренировок</div>
                    )}

                    {(week.workouts || []).map((workout) => {
                      const isWorkoutOpen = adminOpenWorkoutId === workout.id;
                      const workoutExercises = workout.exercises || [];
                      const totalSets = workoutExercises.reduce((sum, exercise) => {
                        const sets = Array.isArray(exercise.sets) && exercise.sets.length ? exercise.sets : [{ reps: 8, weight: "" }];
                        return sum + sets.length;
                      }, 0);

                      return (
                        <div className={isWorkoutOpen ? "monthWorkoutCard open" : "monthWorkoutCard"} key={workout.id}>
                          <div className="monthWorkoutCompactHead">
                            <button
                              type="button"
                              className="monthWorkoutToggle"
                              onClick={() => setAdminOpenWorkoutId(isWorkoutOpen ? "" : workout.id)}
                            >
                              <span>{isWorkoutOpen ? "⏫" : "⏬"}</span>
                            </button>

                            <div className="monthWorkoutTitleEdit">
                              <input
                                value={workout.name || ""}
                                onChange={(event) => updateMonthWorkout(block.id, week.id, workout.id, { name: event.target.value })}
                              />
                              <small>{workoutExercises.length} упр. · {totalSets} подх.</small>
                            </div>

                            <button className="monthWorkoutDelete" onClick={() => removeMonthWorkout(block.id, week.id, workout.id)}>
                              Удалить
                            </button>
                          </div>

                          {!isWorkoutOpen && workoutExercises.length > 0 && (
                            <div className="monthWorkoutPreview">
                              {workoutExercises.slice(0, 4).map((exercise) => (
                                <span key={exercise.id}>{exercise.name || "Упражнение"}</span>
                              ))}
                              {workoutExercises.length > 4 && <span>+{workoutExercises.length - 4}</span>}
                            </div>
                          )}

                          {isWorkoutOpen && (
                            <>
                              <div className="monthExerciseList compact">
                                {workoutExercises.map((exercise) => {
                                  const exerciseSets = Array.isArray(exercise.sets) && exercise.sets.length
                                    ? exercise.sets
                                    : [{ reps: 8, weight: "" }];

                                  return (
                                    <div className="monthExerciseCard compact" key={exercise.id}>
                                      <div className="monthExerciseRow compact">
                                        <input
                                          value={exercise.name || ""}
                                          onChange={(event) => updateMonthExercise(block.id, week.id, workout.id, exercise.id, { name: event.target.value })}
                                          placeholder="Упражнение"
                                        />
                                        <label className={exercise.video ? "monthVideoUploadBtn added" : "monthVideoUploadBtn"}>
                                          <input
                                            type="file"
                                            accept="video/*"
                                            onChange={(event) => uploadMonthExerciseVideo(block.id, week.id, workout.id, exercise.id, event.target.files?.[0])}
                                          />
                                          {exercise.video ? "Видео ✓" : "Видео"}
                                        </label>
                                        <button onClick={() => removeMonthExercise(block.id, week.id, workout.id, exercise.id)}>×</button>
                                      </div>

                                      <div className="monthExerciseSets compact">
                                        {exerciseSets.map((set, setIndex) => (
                                          <div className="monthExerciseSetRow compact" key={setIndex}>
                                            <span>{setIndex + 1}</span>
                                            <input
                                              value={set.reps || ""}
                                              onChange={(event) => updateMonthExerciseSet(block.id, week.id, workout.id, exercise.id, setIndex, { reps: event.target.value })}
                                              placeholder="8"
                                              inputMode="numeric"
                                            />
                                            <input
                                              value={set.weight || ""}
                                              onChange={(event) => updateMonthExerciseSet(block.id, week.id, workout.id, exercise.id, setIndex, { weight: event.target.value })}
                                              placeholder="60"
                                              inputMode="decimal"
                                            />
                                            <button
                                              type="button"
                                              disabled={exerciseSets.length <= 1}
                                              onClick={() => removeMonthExerciseSet(block.id, week.id, workout.id, exercise.id, setIndex)}
                                            >
                                              −
                                            </button>
                                          </div>
                                        ))}
                                      </div>

                                      <button
                                        className="monthAddSetBtn compact"
                                        type="button"
                                        onClick={() => addMonthExerciseSet(block.id, week.id, workout.id, exercise.id)}
                                      >
                                        + подход
                                      </button>
                                    </div>
                                  );
                                })}

                                {workoutExercises.length === 0 && (
                                  <div className="monthProgramEmpty compact">В тренировке пока нет упражнений</div>
                                )}
                              </div>

                              <button className="monthAddExerciseBtn sticky" onClick={() => addMonthExercise(block.id, week.id, workout.id)}>
                                + упражнение
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

            <div className="monthProgramBottomSave">
              <button type="button" onClick={saveMonthProgramToLibrary}>
                Сохранить программу
              </button>
            </div>
          </>
        )}

<nav className="adminV3Nav adminV3BottomBar" aria-label="Админ меню">
            <button className={page === "admin" ? "active" : ""} type="button" onClick={() => setPage("admin")}>
              <span className="adminV3NavIcon">📊</span>
              <span className="adminV3NavLabel">Дашборд</span>
            </button>
            <button className={page === "adminUsers" ? "active" : ""} type="button" onClick={() => setPage("adminUsers")}>
              <span className="adminV3NavIcon">👥</span>
              <span className="adminV3NavLabel">Клиенты</span>
            </button>
            <button className={page === "adminWorkouts" ? "active" : ""} type="button" onClick={() => selectedClient && setPage("adminWorkouts")}>
              <span className="adminV3NavIcon">🏋️</span>
              <span className="adminV3NavLabel">Программы</span>
            </button>
            <button className={page === "adminStats" ? "active" : ""} type="button" onClick={exportAdminClientCsv}>
              <span className="adminV3NavIcon">📈</span>
              <span className="adminV3NavLabel">Отчёты</span>
            </button>
          </nav>
      </div>
    );
  }

  if (page === "workouts" && !selectedWorkoutId) {
    const sortedWorkouts = sortWorkoutDays(plan.workouts || []);
    const completedWorkoutSet = getCompletedWorkoutSet(history);
    const isIndividualWorkoutMode = workoutModePreference.mode === "individual";
    const nextUncompletedWorkoutIndex = isIndividualWorkoutMode
      ? getNextUncompletedWorkoutIndex(sortedWorkouts, completedWorkoutSet)
      : 0;
    const activeWorkoutIndex = isIndividualWorkoutMode
      ? Math.min(
          Math.max(
            individualWorkoutIndexInitialized
              ? (Number.isFinite(Number(individualWorkoutIndex)) ? Number(individualWorkoutIndex) : nextUncompletedWorkoutIndex)
              : nextUncompletedWorkoutIndex,
            0
          ),
          Math.max(sortedWorkouts.length - 1, 0)
        )
      : 0;
    const activeIndividualWorkout = sortedWorkouts[activeWorkoutIndex];

    function openWorkoutByIndex(index) {
      const nextWorkout = sortedWorkouts[index];

      if (nextWorkout) {
        openWorkout(nextWorkout.id);
      }
    }

    function moveIndividualWorkout(direction) {
      if (!sortedWorkouts.length) return;

      const currentIndex = Math.max(0, activeWorkoutIndex);
      const nextIndex =
        direction === "up"
          ? (currentIndex - 1 + sortedWorkouts.length) % sortedWorkouts.length
          : (currentIndex + 1) % sortedWorkouts.length;

      setIndividualWorkoutIndex(nextIndex);
      setIndividualWorkoutIndexInitialized(true);
    }

    return (
      <div className={isIndividualWorkoutMode ? "workoutSelectPage individualWorkoutSelectPage" : "workoutSelectPage"}>
        <div className="workoutSelectHero">
          <h1 className="workoutSelectTitle">
            <span>{isIndividualWorkoutMode ? "Индивидуальный" : "Выбери"}</span>
            <strong>{isIndividualWorkoutMode ? "план тренера" : "свою тренировку"}</strong>
          </h1>

          <p>
            {isIndividualWorkoutMode
              ? "Листай тренировки и выбирай нужную"
              : "Подбери план на сегодня и двигайся к цели"}
          </p>
          <div className="workoutSelectLine" />
        </div>

        <div className={isIndividualWorkoutMode ? "workoutSelectList individualWorkoutDeck" : "workoutSelectList"}>
          {sortedWorkouts.length === 0 ? (
            <div className="workoutProgramEmptyState">
              <div className="workoutProgramEmptyIcon">⏳</div>
              <h2>Тренировка ещё не назначена</h2>
              <p>Тренер пока не назначил тебе программу. Как только тренировка появится в твоём профиле, она отобразится здесь.</p>
              <button onClick={goBackToMain}>Вернуться в меню</button>
            </div>
          ) : isIndividualWorkoutMode && activeIndividualWorkout ? (
            (() => {
              const w = activeIndividualWorkout;
              const index = activeWorkoutIndex;
              const weekNumber =
                String(w.name || "").match(/неделя\s*(\d+)/i)?.[1] ||
                String(w.weekName || "").match(/неделя\s*(\d+)/i)?.[1] ||
                String(w.id || "").match(/week[_-]?(\d+)/i)?.[1];

              const workoutDayNumber =
                String(w.name || "").match(/день\s*(\d+)/i)?.[1] ||
                String(w.id || "").match(/day[_-]?(\d+)/i)?.[1] ||
                index + 1;

              const fallbackItem = workoutMenuItems[index % workoutMenuItems.length] || workoutMenuItems[0];
              const completed = isWorkoutCompletedByHistory(w, completedWorkoutSet);
              const activeNext = index === nextUncompletedWorkoutIndex;

              const item = {
                day: weekNumber ? `Неделя ${weekNumber} · День ${workoutDayNumber}` : `День ${workoutDayNumber}`,
                title: String(w.name || `День ${workoutDayNumber}`)
                  .replace(/^Неделя\s*\d+\s*[—-]\s*/i, "")
                  .replace(/^День\s*\d+\s*[—-]\s*/i, ""),
                image: fallbackItem?.image || workoutMenuItems[0].image
              };

              return (
                <button
                  className={`workoutSelectCard individualWorkoutCardPro ${completed ? "completed" : ""} ${activeNext ? "activeNext" : ""}`}
                  key={w.id}
                  data-workout-card-id={w.id}
                  onClick={() => openWorkout(w.id)}
                >
                  <span className="individualWorkoutProTop">
                    <span className="individualWorkoutBadges">
                      {completed && <span className="individualWorkoutCompletedBadge">✓ Выполнена</span>}
                      {activeNext && !completed && <span className="individualWorkoutNextBadge">Следующая</span>}
                    </span>
                    <span className="individualWorkoutWeek">{item.day}</span>
                  </span>

                  <span className="individualWorkoutProBody">
                    <span className="individualWorkoutProInfo">
                      <span className="individualWorkoutTitle">{item.title}</span>
                      <span className="individualWorkoutAccentLine" />

                      <span className="individualWorkoutStats">
                        <span><b>🏋️</b>{(w.exercises || []).length} упражнений</span>
                        <span><b>▰</b>{((w.exercises || []).flatMap((exercise) => exercise.sets || [])).length} подходов</span>
                        <span><b>⏱</b>≈ 60–75 мин</span>
                      </span>
                    </span>

                    <span className="individualWorkoutProImage">
                      <img src={item.image} alt="" />
                    </span>
                  </span>

                  <span className="individualWorkoutTrainerTip">
                    <b>i</b>
                    <span>
                      <strong>Совет тренера</strong>
                      <small>Следи за техникой и оставляй 1–2 повтора в запасе.</small>
                    </span>
                  </span>

                </button>
              );
            })()
          ) : (
            sortedWorkouts.map((w, index) => {
              const weekNumber =
                String(w.name || "").match(/неделя\s*(\d+)/i)?.[1] ||
                String(w.weekName || "").match(/неделя\s*(\d+)/i)?.[1] ||
                String(w.id || "").match(/week[_-]?(\d+)/i)?.[1];

              const workoutDayNumber =
                String(w.name || "").match(/день\s*(\d+)/i)?.[1] ||
                String(w.id || "").match(/day[_-]?(\d+)/i)?.[1] ||
                index + 1;

              const fallbackItem = workoutMenuItems[index % workoutMenuItems.length] || workoutMenuItems[0];

              const item = {
                day: weekNumber ? `Неделя ${weekNumber} · День ${workoutDayNumber}` : `День ${workoutDayNumber}`,
                title: String(w.name || `День ${workoutDayNumber}`)
                  .replace(/^Неделя\s*\d+\s*[—-]\s*/i, "")
                  .replace(/^День\s*\d+\s*[—-]\s*/i, ""),
                image: fallbackItem?.image || workoutMenuItems[0].image
              };

              return (
                <button
                  className="workoutSelectCard"
                  key={w.id}
                  onClick={() => openWorkout(w.id)}
                >
                  <span className="workoutSelectImageWrap">
                    <img src={item.image} alt="" className="workoutSelectImage" />
                  </span>

                  <span className="workoutSelectText">
                    <span className="workoutSelectDay">{item.day}</span>
                    <span className="workoutSelectName">{item.title}</span>
                  </span>

                  <span className="workoutSelectArrow">›</span>
                </button>
              );
            })
          )}
        </div>

        {isIndividualWorkoutMode && sortedWorkouts.length > 1 && (
          <div className="individualWorkoutBottomPanel">
            <div className="individualWorkoutNav">
              <button type="button" onClick={() => moveIndividualWorkout("up")}>↑</button>

              <div className="individualWorkoutCenterNav">
                <div className="individualWorkoutCounter">
                  {activeWorkoutIndex + 1} из {sortedWorkouts.length}
                </div>

                <div className="individualWorkoutDots">
                  {sortedWorkouts.map((_, dotIndex) => (
                    <span
                      key={dotIndex}
                      className={dotIndex === activeWorkoutIndex ? "active" : ""}
                    />
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => moveIndividualWorkout("down")}>↓</button>
            </div>

            <button
              type="button"
              className="individualWorkoutStartButton"
              onClick={() => openWorkoutByIndex(activeWorkoutIndex)}
            >
              Начать тренировку
            </button>
          </div>
        )}

        <button className="workoutSelectBack universalFixedBackPointer" onClick={goBackToMain}>
          ← Главное меню
        </button>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn universalFixedBackPointer" onClick={() => setSelectedWorkoutId(null)}>
            ← Главное меню
          </button>

          <h1 className="workoutTitle">Тренировка не найдена</h1>
        </div>
      </div>
    );
  }

  const isFinishSlideActive =
    workoutStarted && currentExerciseIndex === workout.exercises.length + 1;

  const shouldShowTopBackButton = isWorkoutSaved === true;

  return (
    <div className="app workoutRunPage">
      <div className="workoutHeader workoutHeaderCompact">
        {shouldShowTopBackButton && isWorkoutSaved && (
          <button
            className="backIconBtn universalFixedBackPointer"
            onClick={() => {
              setSelectedWorkoutId(null);
              setOpenVideoId(null);
              setCurrentExerciseIndex(0);
              setWorkoutStarted(false);
              setWorkoutStartedAt(null);
              setWorkoutFinishedAt(null);
              setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
            }}
            aria-label="Вернуться назад"
          >
            ←
          </button>
        )}

        <div aria-hidden="true" />
      </div>

      {(() => {
        const isStartSlide = !workoutStarted;
        const isFinishSlide = workoutStarted && currentExerciseIndex === workout.exercises.length + 1;
        const warmupExercise = {
          id: "warmup",
          name: "Разминка",
          video: "",
          sets: []
        };

        const exercise =
          isStartSlide || isFinishSlide
            ? null
            : currentExerciseIndex === 0
            ? warmupExercise
            : normalizeExercise(workout.exercises[currentExerciseIndex - 1]);

        const isFirstSlide = workoutStarted && currentExerciseIndex === 0;

        const currentWorkoutSets = workout.exercises.flatMap((item) =>
          item.sets.map((set) => {
            const weight = Number(set.enteredWeight) || 0;
            const reps = weight > 0 ? Number(set.enteredReps || set.reps || 8) || 0 : 0;

            return {
              reps,
              weight
            };
          })
        );

        const totalSetsDone = currentWorkoutSets.filter(
          (set) => set.weight > 0
        ).length;

        const totalRepsDone = currentWorkoutSets.reduce(
          (sum, set) => sum + (set.weight > 0 ? set.reps : 0),
          0
        );

        const totalVolumeDone = currentWorkoutSets.reduce(
          (sum, set) => sum + (set.weight > 0 ? set.reps * set.weight : 0),
          0
        );

        const previousSameWorkout = history.find(
          (item) => item.workout === workout.name
        );

        const previousVolume = previousSameWorkout
          ? previousSameWorkout.exercises?.reduce((exerciseSum, item) => {
              const setsVolume = item.sets?.reduce((setSum, set) => {
                const reps = Number(set.reps) || 0;
                const weight = Number(set.weight) || 0;
                return setSum + reps * weight;
              }, 0) || 0;

              return exerciseSum + setsVolume;
            }, 0)
          : 0;

        const volumeProgress =
          previousVolume > 0
            ? Math.round(((totalVolumeDone - previousVolume) / previousVolume) * 100)
            : null;

        const completedExercisesCount = workout.exercises.filter((item) =>
          item.sets?.some(
            (set) => Number(set.enteredWeight) > 0
          )
        ).length;

        const finishPraiseText =
          totalSetsDone > 0
            ? "Красава. Ты не просто открыл тренировку — ты её сделал."
            : "Хороший старт. Даже лёгкая тренировка лучше, чем пропустить.";

        const finishMoodText =
          volumeProgress === null
            ? "Первая точка прогресса зафиксирована."
            : volumeProgress > 0
            ? "Сегодня ты прибавил к прошлому результату."
            : volumeProgress === 0
            ? "Стабильность тоже прогресс."
            : "Сегодня был спокойный день — главное, что работа сделана.";

        const nextWorkoutText =
          totalVolumeDone > 0
            ? "На следующей тренировке попробуй повторить этот объём или добавить 1–2 повтора."
            : "На следующей тренировке заполни вес и повторы, чтобы видеть прогресс.";

        if (!exercise && !isFinishSlide && !isStartSlide) {
          return (
            <div className="exercise">
              <h3>Упражнение не найдено</h3>
            </div>
          );
        }

        return (
          <div
            ref={deckRef}
            className="exerciseDeck"
            onTouchStart={handleExerciseTouchStart}
            onTouchMove={handleExerciseTouchMove}
            onTouchEnd={handleExerciseTouchEnd}
          >
            {!isStartSlide && !isFinishSlide && (
              <div className="exerciseCounter">
                {currentExerciseIndex === 0
                  ? "Разминка"
                  : `Упражнение ${currentExerciseIndex} из ${workout.exercises.length}`}
              </div>
            )}

            {(isStartSlide || (!isFinishSlide && exercise && (exercise.id === "warmup" || currentExerciseIndex === 1))) && (
              <button
                type="button"
                className="workoutCloseFixedScreen"
                onClick={() => {
                  setSelectedWorkoutId(null);
                  setOpenVideoId(null);
                  setCurrentExerciseIndex(0);
                  setWorkoutStarted(false);
                  setWorkoutStartedAt(null);
                  setWorkoutFinishedAt(null);
                  setWorkoutReadinessOpen(false);
                  setWorkoutReadiness(null);
                  setPostWorkoutFeedback(null);
                  setPostWorkoutFeedbackOpen(false);
                  setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
                }}
                aria-label="Закрыть тренировку"
              >
                ×
              </button>
            )}

            {isStartSlide ? (
              <div
                key="start-slide"
                className={`exercise exerciseSlideCard startWorkoutSlide ${
                  swipeDirection === "up"
                    ? "slideFromBottom"
                    : swipeDirection === "down"
                    ? "slideFromTop"
                    : ""
                }`}
                style={{
                  transform: swipeOffset
                    ? `translateY(${swipeOffset}px)`
                    : undefined
                }}
              >
                <button
                  type="button"
                  className="workoutCloseButton workoutCloseButtonTopRight"
                  onClick={() => {
                    setSelectedWorkoutId(null);
                    setOpenVideoId(null);
                    setCurrentExerciseIndex(0);
                    setWorkoutStarted(false);
                    setWorkoutStartedAt(null);
                    setWorkoutFinishedAt(null);
                    setWorkoutReadinessOpen(false);
                    setWorkoutReadiness(null);
                  setPostWorkoutFeedback(null);
                  setPostWorkoutFeedbackOpen(false);
                    setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
                  }}
                  aria-label="Закрыть тренировку"
                >
                  ×
                </button>

                <div className="startWorkoutTop">
                  <div className="workoutIntroBadge">🔥 Тренировка</div>

                  <span className="startWorkoutIcon">🏋️</span>

                  <h2 className="startWorkoutTitle">
                    {workout.name.includes("—") ? (
                      <>
                        <span>{workout.name.split("—")[0].trim()}</span>
                        <span>
                          {workout.name
                            .split("—")[1]
                            .trim()
                            .replace("/", " / ")}
                        </span>
                      </>
                    ) : (
                      <span>{workout.name}</span>
                    )}
                  </h2>

                  <p className="startWorkoutText">
                    {workout.exercises.length} упражнений · заполни подходы по ходу тренировки
                  </p>
                </div>

                <div className="startWorkoutStats">
                  <div className="startWorkoutStat">
                    <span className="startWorkoutStatIcon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 9v6M19 9v6M3 10.5v3M21 10.5v3M7 12h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <strong>{workout.exercises.length}</strong>
                    <span>упражнений</span>
                  </div>

                  <div className="startWorkoutStat">
                    <span className="startWorkoutStatIcon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 8.5L12 5l7 3.5-7 3.5-7-3.5Z" fill="currentColor" opacity="0.95"/>
                        <path d="M6 13l6 3 6-3M6 17l6 3 6-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <strong>3</strong>
                    <span>подхода</span>
                  </div>

                  <div className="startWorkoutStat">
                    <span className="startWorkoutStatIcon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="2.3"/>
                        <path d="M12 7.8v4.6l3.2 1.9" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <strong>~60</strong>
                    <span>мин</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="startWorkoutButton"
                  onClick={() => {
                    const startedAt = Date.now();
                    if (!workoutReadiness) {
                      applyWorkoutReadiness(getWorkoutReadinessOption("good"));
                    } else {
                      setWorkoutReadinessOpen(false);
                    }
                    setWorkoutStarted(true);
                    setWorkoutStartedAt(startedAt);
                    setTimerTick(startedAt);
                    setWorkoutFinishedAt(null);
                    setWorkoutReadinessOpen(false);
                    setWorkoutReadiness(null);
                  setPostWorkoutFeedback(null);
                  setPostWorkoutFeedbackOpen(false);
                    setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
                    setCurrentExerciseIndex(0);
                    setSwipeDirection("up");
                    centerExerciseDeck();

                    setTimeout(() => {
                      setSwipeDirection("");
                    }, 360);
                  }}
                >
                  Начать тренировку
                </button>
              </div>
            ) : isFinishSlide ? (
              <>
                {showWorkoutSavedCard && (
                  <div className="workoutSavedFloatingCard">
                    <div className="workoutSavedCheck">✓</div>
                    <strong>Тренировка сохранена</strong>
                    <span>{postWorkoutFeedback?.advice || "Отличная работа"}</span>
                  </div>
                )}

                <div
                  key="finish-slide"
                className={`finishSlideWrap ${
                  swipeDirection === "up"
                    ? "slideFromBottom"
                    : swipeDirection === "down"
                    ? "slideFromTop"
                    : ""
                }`}
                style={{
                  transform: swipeOffset
                    ? `translateY(${swipeOffset}px)`
                    : undefined
                }}
              >
                <div className="exercise exerciseSlideCard finishSummaryCard finishSummaryCardPremium">
                  <div className="finishHero">
                    <span className="finishWorkoutIcon">🏆</span>

                    <div className="finishHeroText">
                      <span className="finishEyebrow">
                        {isWorkoutSaved ? "Сохранено" : "Тренировка выполнена"}
                      </span>

                      <h3>Отличная работа</h3>

                      <p>{finishPraiseText}</p>
                    </div>
                  </div>

                  <div className="finishBigTime">
                    <span>Время тренировки</span>
                    <strong>{workoutDurationText}</strong>
                  </div>

                  <div className="finishStatsGrid finishStatsGridPremium">
                    <div className="finishStatBox">
                      <span>Объём</span>
                      <strong>
                        {totalVolumeDone > 0 ? `${totalVolumeDone} кг` : "—"}
                      </strong>
                    </div>

                    <div className="finishStatBox">
                      <span>Подходы</span>
                      <strong>{totalSetsDone || "—"}</strong>
                    </div>

                    <div className="finishStatBox">
                      <span>Повторы</span>
                      <strong>{totalRepsDone || "—"}</strong>
                    </div>

                    <div className="finishStatBox">
                      <span>Упражнения</span>
                      <strong>{completedExercisesCount || "—"}</strong>
                    </div>
                  </div>

                  <div className="finishProgressCard">
                    <div>
                      <span>Прогресс</span>
                      <strong>
                        {volumeProgress === null
                          ? "Новая база"
                          : volumeProgress > 0
                          ? `+${volumeProgress}%`
                          : `${volumeProgress}%`}
                      </strong>
                    </div>
                    <p>{finishMoodText}</p>
                  </div>

                  <div className="finishNextTip">
                    <span>💡</span>
                    <p>{nextWorkoutText}</p>
                  </div>
                </div>

                <div className="finishNavigationRow">
                  <button
                    type="button"
                    className="finishWorkoutButton"
                    onClick={() => {
                      if (isWorkoutSaved) {
                        setSelectedWorkoutId(null);
                        setOpenVideoId(null);
                        setCurrentExerciseIndex(0);
                        setWorkoutStarted(false);
                        setWorkoutStartedAt(null);
                        setWorkoutFinishedAt(null);
                        setIsWorkoutSaved(false);
                        setShowWorkoutSavedCard(false);
                        setPage("workouts");
                        return;
                      }

                      setPostWorkoutFeedbackOpen(true);
                    }}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Сохраняю..."
                      : isWorkoutSaved
                      ? "Вернуться в меню"
                      : "Завершить тренировку"}
                  </button>
                </div>
              </div>
              </>
            ) : (
              <div
                key={exercise.id}
                className={`exercise exerciseSlideCard ${
                  exercise.id === "warmup" ? "warmupExerciseCard" : ""
                } ${
                  openVideoId === exercise.id ? "videoOpenCard" : ""
                } ${
                  swipeDirection === "up"
                    ? "slideFromBottom"
                    : swipeDirection === "down"
                    ? "slideFromTop"
                    : ""
                }`}
                style={{
                  transform: swipeOffset
                    ? `translateY(${swipeOffset}px)`
                    : undefined
                }}
              >
                <h3 className={exercise.id === "warmup" ? "warmupExerciseTitle" : ""}>
                  {exercise.name}
                </h3>

                {exercise.id !== "warmup" && currentExerciseIndex === 1 && (
                  <button
                    type="button"
                    className="workoutCloseButton workoutCloseButtonTopRight"
                    onClick={() => {
                      setSelectedWorkoutId(null);
                      setOpenVideoId(null);
                      setCurrentExerciseIndex(0);
                      setWorkoutStarted(false);
                      setWorkoutStartedAt(null);
                      setWorkoutFinishedAt(null);
                      setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
                    }}
                    aria-label="Закрыть тренировку"
                  >
                    ×
                  </button>
                )}

                {exercise.video && (
                  <>
                    <button
                      type="button"
                      className="showVideoBtn"
                      onClick={() =>
                        setOpenVideoId(openVideoId === exercise.id ? null : exercise.id)
                      }
                    >
                      🎥 {openVideoId === exercise.id ? "Скрыть технику" : "Показать технику"}
                    </button>

                    {openVideoId === exercise.id && (
                      <div
                        onClick={() => setFullscreenVideo(exercise.video)}
                        style={{ cursor: "pointer" }}
                      >
                        <video
                          className="exerciseVideo"
                          src={exercise.video}
                          controls
                          preload="metadata"
                          onLoadStart={() => startPerformanceCheck(`Video · ${exercise.name}`, { src: exercise.video })}
                          onLoadedMetadata={(event) => endPerformanceCheck(`Video · ${exercise.name}`, {
                            src: exercise.video,
                            duration: Math.round(Number(event.currentTarget.duration) || 0)
                          })}
                          onError={() => endPerformanceCheck(`Video · ${exercise.name}`, { src: exercise.video, error: true })}
                        />
                      </div>
                    )}
                  </>
                )}

                {exercise.id === "warmup" ? (
                  <>
                    <button
                      type="button"
                      className="workoutCloseButton workoutCloseButtonTopRight"
                      onClick={() => {
                        setSelectedWorkoutId(null);
                        setOpenVideoId(null);
                        setCurrentExerciseIndex(0);
                        setWorkoutStarted(false);
                        setWorkoutStartedAt(null);
                        setWorkoutFinishedAt(null);
                        setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);
                      }}
                      aria-label="Закрыть тренировку"
                    >
                      ×
                    </button>

                  <div className="warmupExerciseHero">
                    <div className="warmupExerciseIntro">
                      <span>🔥</span>
                      <p>
                        Сделай короткую разминку перед рабочими подходами.
                        Это поможет разогреть суставы и лучше почувствовать технику.
                      </p>
                    </div>

                    <div className="warmupExerciseItem">
                      <span>🚶</span>
                      <div>
                        <strong>2–3 минуты лёгкого кардио</strong>
                        <small>Дорожка, велосипед или быстрая ходьба</small>
                      </div>
                    </div>

                    <div className="warmupExerciseItem">
                      <span>🦾</span>
                      <div>
                        <strong>Суставная разминка</strong>
                        <small>Плечи, локти, кисти, таз и поясница</small>
                      </div>
                    </div>

                    <div className="warmupExerciseItem">
                      <span>🏋️</span>
                      <div>
                        <strong>1 лёгкий разминочный подход</strong>
                        <small>Перед первым упражнением, без отказа</small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="warmupReadyButton"
                      onClick={() => {
                        goToNextExercise();
                      }}
                    >
                      ✓ Готово →
                    </button>
                  </div>
                  </>
                ) : (
                  <>
                {exercise.sets.map((set, index) => (
                  <React.Fragment key={index}>
                    <div className="setRow">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label="Повторы"
                        placeholder={set.reps ? `${set.reps}` : "повторы"}
                        value={set.enteredReps ?? "8"}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        onTouchMove={(event) => event.stopPropagation()}
                        onTouchEnd={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateSet(
                            exercise.id,
                            index,
                            "enteredReps",
                            event.target.value.replace(/[^0-9]/g, "")
                          )
                        }
                      />

                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Вес"
                        placeholder={set.weight ? `${set.weight} кг` : "вес"}
                        value={set.enteredWeight ?? ""}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        onTouchMove={(event) => event.stopPropagation()}
                        onTouchEnd={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateSet(
                            exercise.id,
                            index,
                            "enteredWeight",
                            event.target.value
                              .replace(/[^0-9.,]/g, "")
                              .replace(",", ".")
                          )
                        }
                      />
                    </div>

                    {set.aiOriginalWeight && String(set.aiOriginalWeight) !== String(set.weight) && (
                      <div className="workoutAiSetWeightNote">
                        AI: база {set.aiOriginalWeight} кг → сегодня {set.weight} кг
                      </div>
                    )}
                  </React.Fragment>
                ))}
                  </>
                )}

                {exercise.id !== "warmup" && (
                  <>
                    <div className="previousInfo subtle">
                  {getLastExerciseText(exercise.name)}
                </div>

                    {workoutReadiness && workoutReadiness.id !== "excellent" && (
                      <div className="workoutAiAdjustHint">
                        AI адаптация: {workoutReadiness.volumeText}. Вес округлён под стандартные гантели/тренажёры.
                      </div>
                    )}

                    <div className="exerciseNavigationRow">
                      {currentExerciseIndex > 1 && (
                        <button
                          type="button"
                          className="exercisePrevButton"
                          onClick={() => {
                            goToPreviousExercise();
                          }}
                        >
                          ← Главное меню
                        </button>
                      )}

                      <button
                        type="button"
                        className="exerciseNextButton"
                        onClick={() => {
                          goToNextExercise();
                        }}
                      >
                        {currentExerciseIndex >= workout.exercises.length
                          ? "К итогам →"
                          : "Вперёд →"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        );
      })()}

      {renderWorkoutReadinessModal()}

      {renderPostWorkoutFeedbackModal()}

      {renderFirstSetupOnboarding()}

      {fullscreenVideo && (
        <div
          onClick={() => setFullscreenVideo(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100dvh",
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <button
            onClick={() => setFullscreenVideo(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              fontSize: "28px",
              background: "none",
              color: "white",
              border: "none",
              cursor: "pointer"
            }}
          >
            ✕
          </button>

          <video
            src={fullscreenVideo}
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "900px",
              borderRadius: "12px"
            }}
          />
        </div>
      )}
    
</div>
  );
}
