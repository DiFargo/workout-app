import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import { auth, db, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import { collection, getDocs, doc, setDoc, addDoc, getDoc } from "firebase/firestore";

const STORAGE_KEY = "workout_tracker_v1";
const ADMIN_EMAIL = "work.kriptonit.il@gmail.com";

const NUTRITION_STORAGE_KEY = "workout_nutrition_v1";

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
  recent: []
};

const nutritionMeals = [
  { id: "breakfast", name: "Завтрак", icon: "🌅" },
  { id: "lunch", name: "Обед", icon: "☀️" },
  { id: "dinner", name: "Ужин", icon: "🌇" },
  { id: "snack", name: "Перекус/Другое", icon: "🌙" }
];

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
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    fat: Number(food.fat) || 0,
    carbs: Number(food.carbs) || 0,
    barcode: food.barcode || "",
    source: food.source || "Локальная база"
  };
}

function getFoodScale(amount) {
  const parsedAmount = Number(String(amount).replace(",", "."));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return 1;
  return parsedAmount / 100;
}

function roundMacro(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
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
  const [appLoading, setAppLoading] = useState(true);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [plan, setPlan] = useState(() => normalizePlan(starterPlan));
  const [page, setPage] = useState("main");
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [openVideoId, setOpenVideoId] = useState(null);
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutStartedAt, setWorkoutStartedAt] = useState(null);
  const [workoutFinishedAt, setWorkoutFinishedAt] = useState(null);
  const [timerTick, setTimerTick] = useState(Date.now());
  const touchStartY = useRef(null);
  const deckRef = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState("");

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [usersList, setUsersList] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isWorkoutSaved, setIsWorkoutSaved] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openHistoryKey, setOpenHistoryKey] = useState(null);


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
        recent: parsed.recent || []
      };
    } catch {
      return defaultNutritionState;
    }
  });
  const [nutritionSearch, setNutritionSearch] = useState("");
  const [nutritionMeal, setNutritionMeal] = useState("breakfast");
  const [nutritionMealMenuOpen, setNutritionMealMenuOpen] = useState(false);
  const [nutritionAmount, setNutritionAmount] = useState("100");
  const [nutritionBarcode, setNutritionBarcode] = useState("");
  const [nutritionPhotoName, setNutritionPhotoName] = useState("");
  const [nutritionAnalysisOpen, setNutritionAnalysisOpen] = useState(true);
  const [nutritionPickerOpen, setNutritionPickerOpen] = useState(false);
  const [nutritionSearchTab, setNutritionSearchTab] = useState("food");
  const [selectedNutritionDateKey, setSelectedNutritionDateKey] = useState(todayNutritionKey());
  const [expandedNutritionMeals, setExpandedNutritionMeals] = useState({});
  const [fatSecretFoods, setFatSecretFoods] = useState([]);
  const [fatSecretLoading, setFatSecretLoading] = useState(false);
  const [fatSecretError, setFatSecretError] = useState("");
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [barcodeScannerError, setBarcodeScannerError] = useState("");
  const [nutritionCloudReady, setNutritionCloudReady] = useState(false);
  const barcodeVideoRef = useRef(null);
  const nutritionDateInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      const startedAt = Date.now();

      setUser(u);
      setIsLoggedIn(!!u);

      if (u) {
        await loadWorkoutsFromFirebase(u.uid);
        await loadHistory();
        await loadNutritionFromFirebase(u.uid);
      } else {
        setNutritionCloudReady(false);
      }

      const elapsed = Date.now() - startedAt;
      const minimumSplashTime = 900;

      setTimeout(() => {
        setAppLoading(false);
      }, Math.max(0, minimumSplashTime - elapsed));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);


  useEffect(() => {
    localStorage.setItem(NUTRITION_STORAGE_KEY, JSON.stringify(nutrition));
  }, [nutrition]);

  useEffect(() => {
    const query = nutritionSearch.trim();

    if (!nutritionPickerOpen || nutritionSearchTab !== "food" || query.length < 2) {
      setFatSecretFoods([]);
      setFatSecretLoading(false);
      setFatSecretError("");
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setFatSecretLoading(true);
        setFatSecretError("");

        const response = await fetch(`/api/fatsecret/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`FatSecret API error: ${response.status}`);
        }

        const data = await response.json();
        setFatSecretFoods(Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);
          setFatSecretFoods([]);
          setFatSecretError("Не удалось загрузить продукты из FatSecret. Показана локальная база.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setFatSecretLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [nutritionPickerOpen, nutritionSearchTab, nutritionSearch]);

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
      setDoc(doc(db, "users", currentUser.uid, "nutrition", "state"), {
        ...nutrition,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch((error) => console.error("Nutrition save error", error));
    }, 500);

    return () => clearTimeout(timer);
  }, [nutrition, nutritionCloudReady]);

  useEffect(() => {
    if (page === "admin") {
      loadUsers();
    }
  }, [page]);

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
        if (!exercise.name || result[exercise.name]) return;

        const lastSet = exercise.sets?.[exercise.sets.length - 1];

        result[exercise.name] = {
          reps: lastSet?.reps || "",
          weight: lastSet?.weight || "",
          date: historyWorkout.date
        };
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
        role: login === ADMIN_EMAIL ? "admin" : "client"
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

  const nutritionSearchResults = useMemo(() => {
    const query = nutritionSearch.trim().toLowerCase();
    const recentIds = nutrition.recent || [];
    const favoriteIds = nutrition.favorites || [];
    const localFoods = nutritionFoodDatabase.map(normalizeNutritionFood);

    if (nutritionSearchTab === "recent") {
      return recentIds
        .map((id) => localFoods.find((food) => food.id === id) || (nutritionToday.foods || []).find((food) => food.foodId === id || food.id === id))
        .filter(Boolean)
        .map(normalizeNutritionFood)
        .slice(0, 20);
    }

    if (nutritionSearchTab === "favorites") {
      return favoriteIds
        .map((id) => localFoods.find((food) => food.id === id) || (nutritionToday.foods || []).find((food) => food.foodId === id || food.id === id))
        .filter(Boolean)
        .map(normalizeNutritionFood)
        .slice(0, 20);
    }

    if (query.length >= 2 && fatSecretFoods.length > 0) {
      return fatSecretFoods.slice(0, 30);
    }

    const list = query
      ? localFoods.filter((food) => food.name.toLowerCase().includes(query))
      : localFoods.filter((food) => favoriteIds.includes(food.id));

    return list.slice(0, 20);
  }, [nutritionSearch, nutritionSearchTab, nutrition.favorites, nutrition.recent, nutritionToday.foods, fatSecretFoods]);

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
    setExpandedNutritionMeals({});
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
    const scale = getFoodScale(amount);
    const numericAmount = Number(String(amount).replace(",", ".")) || 100;
    const item = {
      id: `${sourceFood.id}_${Date.now()}`,
      foodId: sourceFood.id,
      fatSecretId: food.fatSecretId || "",
      name: sourceFood.name,
      mealId,
      amount: numericAmount,
      portion: sourceFood.portion,
      calories: Math.round(sourceFood.calories * scale),
      protein: roundMacro(sourceFood.protein * scale),
      fat: roundMacro(sourceFood.fat * scale),
      carbs: roundMacro(sourceFood.carbs * scale),
      source: sourceFood.source,
      addedAt: new Date().toISOString()
    };

    updateNutritionDay((day) => ({
      ...day,
      foods: [item, ...(day.foods || [])]
    }));

    setNutrition((prev) => ({
      ...prev,
      recent: [sourceFood.id, ...(prev.recent || []).filter((id) => id !== sourceFood.id)].slice(0, 20)
    }));

    setExpandedNutritionMeals((prev) => ({
      ...prev,
      [mealId]: true
    }));
  }

  function addNutritionFoodFromPicker(food) {
    addNutritionFood(food);
    setNutritionPickerOpen(false);
  }

  function openNutritionPicker(mealId) {
    setNutritionMeal(mealId);
    setNutritionSearch("");
    setNutritionSearchTab("food");
    setNutritionPickerOpen(true);
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

  function removeNutritionFood(itemId) {
    updateNutritionDay((day) => ({
      ...day,
      foods: (day.foods || []).filter((item) => item.id !== itemId)
    }));
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

  function refreshPage() {
    window.location.reload();
  }

  function logout() {
    signOut(auth);

    setIsLoggedIn(false);
    setUser(null);
    setPage("main");
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setOpenHistoryKey(null);
    setSelectedUserId(null);
    setLogin("");
    setPassword("");
    setLoginError("");
    setHistory([]);
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
    setOpenHistoryKey(null);
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

  async function saveWorkoutToFirebase() {
    if (!workout || isSaving || isWorkoutSaved) return;

    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Пользователь не найден");
      return;
    }

    const finishedAt = Date.now();
    const startedAt = workoutStartedAt || finishedAt;
    const durationSeconds = Math.max(0, Math.floor((finishedAt - startedAt) / 1000));

    setWorkoutFinishedAt(finishedAt);
    setTimerTick(finishedAt);
    setIsSaving(true);
    setIsWorkoutSaved(false);

    try {
      await addDoc(collection(db, "users", currentUser.uid, "history"), {
        date: new Date().toISOString(),
        userEmail: currentUser.email || "",
        workout: workout.name,
        durationSeconds,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        exercises: workout.exercises.map((exercise) => ({
          name: exercise.name,
          video: exercise.video || "",
          sets: exercise.sets.map((set, index) => {
            const weight = set.enteredWeight || "";

            return {
              set: index + 1,
              reps: weight ? set.enteredReps || set.reps || 8 : "",
              weight
            };
          })
        }))
      });

      await loadHistory();
      setIsWorkoutSaved(true);
    } catch (e) {
      console.log(e);
      alert("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadWorkoutsFromFirebase(userIdFromClick) {
    try {
      const userId = userIdFromClick || selectedUserId || auth.currentUser?.uid;

      if (!userId) return;

      const querySnapshot = await getDocs(
        collection(db, "users", userId, "workouts")
      );

      const workoutsFromDb = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        workoutsFromDb.push({
          id: doc.id,
          name: data.name || "Без названия",
          exercises: (data.exercises || []).map(normalizeExercise)
        });
      });

      if (workoutsFromDb.length > 0) {
        setPlan({ workouts: workoutsFromDb });
      } else {
        setPlan(normalizePlan(starterPlan));
      }
    } catch (err) {
      console.log("Ошибка загрузки тренировок:", err);
    }
  }

  async function saveWorkoutsToFirebase() {
    try {
      const userId = selectedUserId || auth.currentUser?.uid;

      if (!userId) {
        alert("Пользователь не найден");
        return;
      }

      for (const workout of plan.workouts) {
        await setDoc(doc(db, "users", userId, "workouts", workout.id), {
          name: workout.name,
          exercises: workout.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            video: exercise.video || "",
            sets: makeThreeSets(
              exercise.sets,
              exercise.name?.includes("Пресс") ? 15 : 8
            )
          }))
        });
      }

      alert("Тренировки пользователя сохранены в Firebase ✅");
    } catch (err) {
      console.log("Ошибка сохранения тренировок:", err);
      alert("Не получилось сохранить тренировки");
    }
  }

  async function loadUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));

      const users = [];

      snapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setUsersList(users);
    } catch (err) {
      console.log("Ошибка загрузки пользователей:", err);
    }
  }

  async function loadHistory() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.log("Пользователь ещё не загружен");
      return;
    }

    setHistoryLoading(true);

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
    } catch (err) {
      console.log("Ошибка загрузки истории:", err);
      alert("Не получилось загрузить историю");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadNutritionFromFirebase(uid) {
    try {
      const snap = await getDoc(doc(db, "users", uid, "nutrition", "state"));

      if (snap.exists()) {
        const data = snap.data();
        setNutrition({
          ...defaultNutritionState,
          ...data,
          goals: { ...defaultNutritionState.goals, ...(data.goals || {}) },
          days: data.days || {},
          favorites: data.favorites || defaultNutritionState.favorites,
          recent: data.recent || []
        });
      }
    } catch (error) {
      console.error("Nutrition load error", error);
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

  function openWorkout(id) {
    setSelectedWorkoutId(id);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setIsWorkoutSaved(false);
    loadHistory();
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
        <h1 className="menuTitle">Главное меню</h1>

        <div className="menuButtons">
          <button className="bigButton" onClick={() => setPage("workouts")}>
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

          {user?.email === ADMIN_EMAIL && (
            <button
              className="bigButton"
              onClick={() => {
                setSelectedUserId(null);
                setPage("admin");
              }}
            >
              ⚙️ Админ-панель
            </button>
          )}
        </div>

        <button type="button" className="logoutSmall" onClick={refreshPage}>
          🔄 Обновить страницу
        </button>

        <button type="button" className="logoutSmall" onClick={logout}>
          ⬅ Выйти
        </button>
      </div>
    );
  }

  if (page === "nutrition") {
    const caloriePercent = Math.min(100, Math.round((nutritionTotals.calories / nutrition.goals.calories) * 100));
    const waterPercent = Math.min(100, Math.round(((nutritionToday.water || 0) / nutrition.goals.water) * 100));
    const caloriesLeft = Math.max(0, Math.round(nutrition.goals.calories - nutritionTotals.calories));
    const caloriesConsumed = Math.round(nutritionTotals.calories);
    const proteinPercent = Math.min(100, Math.round((nutritionTotals.protein / nutrition.goals.protein) * 100));
    const fatPercent = Math.min(100, Math.round((nutritionTotals.fat / nutrition.goals.fat) * 100));
    const carbsPercent = Math.min(100, Math.round((nutritionTotals.carbs / nutrition.goals.carbs) * 100));
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

    return (
      <div className="fatSecretPage">
        <button className="backBtn universalFixedBackPointer" onClick={goBackToMain}>←</button>

        <section className="fatTodayPanel">
          <div className="fatStreakLine fatStreakLineTop">
            <span>{nutritionStreakText}</span>
          </div>

          <div className="fatDateHeader fatDateHeaderNoArrows">
            <div className="fatDateTitle">
              <h1>{nutritionDateTitle}</h1>
              {!isNutritionToday && (
                <button type="button" onClick={() => selectNutritionDate(todayNutritionKey())}>Сегодня</button>
              )}
            </div>
          </div>

          <div className="fatWeekRow">
            {weekDates.map((day) => {
              const dayHasFood = Boolean(nutrition.days?.[day.key]?.foods?.length);
              const isSelectedDay = day.key === nutritionDateKey;
              const isTodayDay = day.key === todayNutritionKey();
              return (
                <button
                  type="button"
                  className={`fatDayCell ${isSelectedDay ? "selected" : ""} ${dayHasFood ? "hasFood" : ""}`}
                  key={day.key}
                  onClick={() => selectNutritionDate(day.key)}
                >
                  <span className={dayHasFood ? "done" : ""}>{dayHasFood ? "✓" : ""}</span>
                  <small>{day.label}</small>
                </button>
              );
            })}
          </div>

          <div className="fatQuickActions">
            <button type="button" onClick={() => openNutritionPicker(nutritionMeal)}>🔎 Поиск еды</button>
            <button type="button" onClick={() => nutritionDateInputRef.current?.showPicker?.() || nutritionDateInputRef.current?.click()}>📅 Календарь</button>
            <input
              ref={nutritionDateInputRef}
              type="date"
              value={nutritionDateKey}
              onChange={(e) => e.target.value && selectNutritionDate(e.target.value)}
              aria-label="Выбрать дату питания"
            />
          </div>
        </section>

        <section className="fatCaloriesCard">
          <div className="fatPixelMeter" aria-hidden="true">
            {Array.from({ length: 56 }).map((_, index) => (
              <span key={index} className={index < Math.round((caloriePercent / 100) * 56) ? "on" : ""} />
            ))}
          </div>

          <div className="fatCalorieRows">
            <div><span>Осталось Калорий</span><strong>{caloriesLeft}</strong></div>
            <div><span>Употреблено Калорий</span><strong>{caloriesConsumed}</strong></div>
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
                  className="fatMealMain"
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
                  <div className="fatMealIcon">{meal.icon}</div>
                  <div className="fatMealTitle">
                    <strong>{meal.name}</strong>
                    {hasFoods && <span>{stats.count} шт</span>}
                  </div>
                  {hasFoods && (
                    <div className="fatMealKcal">
                      <strong>{Math.round(stats.calories)}</strong>
                      <span>Калории</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="fatPlusBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openNutritionPicker(meal.id);
                    }}
                  >
                    +
                  </button>
                  {hasFoods && (
                    <button
                      type="button"
                      className="fatMealToggle"
                      aria-label={isExpanded ? "Свернуть список" : "Раскрыть список"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedNutritionMeals((prev) => ({
                          ...prev,
                          [meal.id]: !prev[meal.id]
                        }));
                      }}
                    >
                      {isExpanded ? "⌃" : "⌄"}
                    </button>
                  )}
                </div>

                {hasFoods && isExpanded && (
                  <div className="fatMealItems">
                    {(nutritionToday.foods || [])
                      .filter((item) => item.mealId === meal.id)
                      .map((item) => (
                        <div className="fatFoodItem" key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.amount} г · Б {item.protein} / Ж {item.fat} / У {item.carbs}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNutritionFood(item.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {nutritionPickerOpen && (
          <div className="fatFoodSearchOverlay">
            <section className="fatFoodSearchScreen">
              <div className="fatSearchTop fatSearchTopCloseRight">
                <div className="fatSearchTopSpacer" aria-hidden="true" />

                <div className="fatSearchTitleWrap">
                  <button
                    type="button"
                    className="fatSearchTitleButton"
                    onClick={() => setNutritionMealMenuOpen((open) => !open)}
                  >
                    <strong>{nutritionMeals.find((meal) => meal.id === nutritionMeal)?.name}</strong>
                    <span>⌄</span>
                  </button>
                  <small>{formatNutritionDateLabel(selectedNutritionDate)}</small>

                  {nutritionMealMenuOpen && (
                    <div className="fatMealDropdown">
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

                <button
                  type="button"
                  className="fatSearchClose"
                  onClick={() => {
                    setNutritionMealMenuOpen(false);
                    setNutritionPickerOpen(false);
                  }}
                  aria-label="Закрыть поиск еды"
                >
                  ×
                </button>
              </div>

              <div className="fatSearchTabs">
                <button type="button" className={nutritionSearchTab === "favorites" ? "active" : ""} onClick={() => setNutritionSearchTab("favorites")}>ИЗБРАННОЕ</button>
                <button type="button" className={nutritionSearchTab === "food" ? "active" : ""} onClick={() => setNutritionSearchTab("food")}>ЕДА</button>
                <button type="button" className={nutritionSearchTab === "recent" ? "active" : ""} onClick={() => setNutritionSearchTab("recent")}>НЕДАВНО</button>
              </div>

              <div className="fatSearchInputWrap">
                <span>⌕</span>
                <input
                  autoFocus
                  value={nutritionSearch}
                  onChange={(e) => setNutritionSearch(e.target.value)}
                  placeholder="Поиск Еды"
                />
              </div>

              <div className="fatSearchAmountRow">
                <input
                  value={nutritionAmount}
                  onChange={(e) => setNutritionAmount(e.target.value)}
                  placeholder="100 г"
                  inputMode="decimal"
                />
                <input
                  value={nutritionBarcode}
                  onChange={(e) => setNutritionBarcode(e.target.value)}
                  placeholder="Штрихкод"
                  inputMode="numeric"
                />
                <button type="button" className="fatBarcodeAddMini" onClick={addFoodByBarcodeFromPicker} title="Добавить по штрихкоду">+</button>
                <button type="button" className="fatBarcodeScanMini" onClick={() => setBarcodeScannerOpen(true)} title="Сканер штрихкода">📷</button>
              </div>

              <div className="fatSearchList">
                {fatSecretLoading && (
                  <div className="fatSearchStatus">Ищу продукты в FatSecret...</div>
                )}

                {fatSecretError && (
                  <div className="fatSearchStatus error">{fatSecretError}</div>
                )}

                {!fatSecretLoading && nutritionSearch.trim().length >= 2 && nutritionSearchResults.length === 0 && (
                  <div className="fatSearchStatus">Ничего не найдено</div>
                )}

                {nutritionSearchResults.map((food) => {
                  const normalizedFood = normalizeNutritionFood(food);
                  const isFavorite = nutrition.favorites.includes(normalizedFood.id);
                  return (
                    <div className="fatSearchItem" key={normalizedFood.id}>
                      <button
                        type="button"
                        className="fatSearchFavorite"
                        onClick={() => toggleNutritionFavorite(normalizedFood.id)}
                      >
                        {isFavorite ? "★" : "☆"}
                      </button>
                      <button
                        type="button"
                        className="fatSearchFoodName"
                        onClick={() => addNutritionFoodFromPicker(normalizedFood)}
                      >
                        <strong>{normalizedFood.name}</strong>
                        <span>{normalizedFood.portion} · {normalizedFood.calories} ккал · Б {normalizedFood.protein} / Ж {normalizedFood.fat} / У {normalizedFood.carbs}</span>
                      </button>
                      <button
                        type="button"
                        className="fatSearchAdd"
                        onClick={() => addNutritionFoodFromPicker(normalizedFood)}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="fatSearchBottomTools">
                <button type="button" onClick={() => setNutritionSearchTab("food")}>🔎</button>
                <button type="button" onClick={() => setNutritionSearchTab("favorites")}>★</button>
                <button type="button" onClick={() => setNutritionSearchTab("recent")}>↺</button>
              </div>

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

        <section className="fatMacroPanel">
          <div className="fatMacroTop">
            <div>
              <h2>Сегодня</h2>
              <span>{caloriePercent}% от РСК</span>
            </div>
            <strong>{nutrition.goals.calories}</strong>
            <div className="fatPixelMeter small" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, index) => (
                <span key={index} className={index < Math.round((caloriePercent / 100) * 24) ? "on" : ""} />
              ))}
            </div>
          </div>

          <div className="fatMacroContent">
            <div className="fatMacroLegend">
              <span><i className="carbs" />Углеводы: {carbsPercent}%</span>
              <span><i className="fat" />Жир: {fatPercent}%</span>
              <span><i className="protein" />Белок: {proteinPercent}%</span>
            </div>
            <div className="fatDonut" style={macroDonutStyle}><span /></div>
          </div>

          <div className="fatNutrients">
            <p>Всего Жиров: <strong>{roundMacro(nutritionTotals.fat)}г</strong></p>
            <p>Холестерин: <strong>0мг</strong></p>
            <p>Натрий: <strong>0мг</strong></p>
            <p>Всего Углеводов: <strong>{roundMacro(nutritionTotals.carbs)}г</strong></p>
            <p>Диетическая Клетчатка: <strong>0,0г</strong></p>
            <p>Сахар: <strong>0,00г</strong></p>
            <p>Белок: <strong>{roundMacro(nutritionTotals.protein)}г</strong></p>
            <p>Вода: <strong>{nutritionToday.water || 0} мл</strong></p>
          </div>

          <div className="fatWaterBox">
            <div><span>💧 Вода</span><strong>{waterPercent}%</strong></div>
            <div className="fatWaterActions">
              <button type="button" onClick={() => addWater(250)}>+250 мл</button>
              <button type="button" onClick={() => addWater(-250)}>−250 мл</button>
            </div>
          </div>
        </section>

        <section className="fatNutritionHistory">
          <div className="fatPanelHead">
            <div>
              <span>История питания</span>
              <h2>Последние дни</h2>
            </div>
            <strong>{nutritionHistoryDays.length}</strong>
          </div>

          {nutritionHistoryDays.length === 0 && (
            <p className="fatHistoryEmpty">Добавь еду — и здесь появится история питания.</p>
          )}

          {nutritionHistoryDays.map(({ date, totals }) => (
            <div className="fatHistoryDay" key={date}>
              <div>
                <strong>{new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</strong>
                <span>{totals.count} продуктов · Б {roundMacro(totals.protein)} / Ж {roundMacro(totals.fat)} / У {roundMacro(totals.carbs)}</span>
              </div>
              <b>{Math.round(totals.calories)} ккал</b>
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (page === "profile") {
    const totalWorkouts = history.length;
    const lastWorkout = history[0];
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
          <button className="backBtn universalFixedBackPointer" onClick={goBackToMain}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Личный кабинет</h1>
        </div>

        <div className="exercise">
          <h3>Профиль</h3>

          <p style={{ textAlign: "center", color: "#aaa" }}>
            {auth.currentUser?.email}
          </p>

          <div className="historySets">
            <div className="historySet">
              <span>Всего тренировок</span>
              <strong>{totalWorkouts}</strong>
            </div>

            <div className="historySet">
              <span>Последняя тренировка</span>
              <strong>
                {lastWorkout
                  ? new Date(lastWorkout.date).toLocaleDateString("ru-RU")
                  : "нет данных"}
              </strong>
            </div>
          </div>

          <button
            className="bigButton"
            style={{ marginTop: "16px" }}
            onClick={() => {
              loadHistory();
              setPage("history");
            }}
          >
            📊 История тренировок
          </button>
        </div>

        <div className="exercise">
          <button className="bigButton" onClick={() => setPage("progress")}>
            📈 Прогресс по упражнениям
          </button>
        </div>
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
            ← Назад
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
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn universalFixedBackPointer" onClick={() => setPage("profile")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">История</h1>
        </div>

        <button className="finishBtn fixed" onClick={loadHistory}>
          🔄 Обновить историю
        </button>

        {historyLoading && (
          <div className="exercise">
            <h3>Загрузка...</h3>
          </div>
        )}

        {!historyLoading && history.length === 0 && (
          <div className="exercise">
            <h3>История пустая</h3>
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Заверши тренировку, и она появится здесь.
            </p>
          </div>
        )}

        {!historyLoading &&
          history.map((item) => {
            const isOpen = openHistoryKey === item.id;
            const date = new Date(item.date).toLocaleDateString("ru-RU");

            return (
              <div className="historyCard" key={item.id}>
                <button
                  className="historyCardHeader"
                  onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                >
                  <span>
                    {date} — {item.workout}
                  </span>
                  <strong>{isOpen ? "−" : "+"}</strong>
                </button>

                {isOpen && (
                  <div className="historyCardBody">
                    {item.exercises?.map((exercise, index) => (
                      <div className="historyExercise" key={index}>
                        <h4>{exercise.name}</h4>

                        <div className="historySets">
                          {exercise.sets?.map((set, setIndex) => (
                            <div className="historySet" key={setIndex}>
                              <span>Подход {set.set || setIndex + 1}</span>
                              <strong>
                                {set.reps} × {set.weight || "без веса"}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  }

  if (page === "admin") {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn universalFixedBackPointer" onClick={() => setPage("main")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Админ-панель</h1>
        </div>

        <div className="exercise">
          <h3>Управление</h3>

          <p style={{ textAlign: "center", color: "#aaa" }}>
            Здесь ты управляешь клиентами и тренировками
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              className="bigButton"
              onClick={() => {
                loadUsers();
                setPage("adminUsers");
              }}
            >
              👥 Пользователи
            </button>

            <button
              className="bigButton"
              onClick={() => {
                setSelectedUserId(auth.currentUser?.uid || null);
                loadWorkoutsFromFirebase(auth.currentUser?.uid);
                setPage("adminWorkouts");
              }}
            >
              🏋️ Мои тренировки
            </button>

            <button className="bigButton">📊 Статистика</button>
          </div>
        </div>
      </div>
    );
  }

  if (page === "adminUsers") {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn universalFixedBackPointer" onClick={() => setPage("admin")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Пользователи</h1>
        </div>

        <div className="exercise">
          <h3>Список пользователей</h3>

          {usersList.length === 0 && (
            <p style={{ textAlign: "center", color: "#aaa" }}>
              Пользователей пока нет
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {usersList.map((u) => (
              <button
                key={u.id}
                className="bigButton"
                onClick={() => {
                  setSelectedUserId(u.id);
                  loadWorkoutsFromFirebase(u.id);
                  setPage("adminWorkouts");
                }}
              >
                👤 {u.email || u.id}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (page === "adminWorkouts") {
    const selectedUser = usersList.find((u) => u.id === selectedUserId);

    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn universalFixedBackPointer" onClick={() => setPage("admin")}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Управление тренировками</h1>
        </div>

        {selectedUserId && (
          <p style={{ textAlign: "center", color: "#aaa" }}>
            Клиент: {selectedUser?.email || selectedUserId}
          </p>
        )}

        {plan.workouts.map((workout) => (
          <div className="exercise" key={workout.id}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px",
                  borderRadius: "8px"
                }}
                value={workout.name}
                placeholder="Название тренировки"
                onChange={(e) => {
                  const newName = e.target.value;

                  setPlan((prev) => ({
                    ...prev,
                    workouts: prev.workouts.map((w) =>
                      w.id === workout.id ? { ...w, name: newName } : w
                    )
                  }));
                }}
              />

              <button
                style={{
                  width: "40px",
                  height: "40px",
                  minWidth: "40px",
                  padding: 0,
                  borderRadius: "8px",
                  background: "#ff4d4f",
                  color: "white",
                  border: "none"
                }}
                onClick={() => {
                  setPlan((prev) => ({
                    ...prev,
                    workouts: prev.workouts.filter((w) => w.id !== workout.id)
                  }));
                }}
              >
                ✕
              </button>
            </div>

            {workout.exercises.map((exercise) => (
<div
  key={exercise.id}
  className={`exercise exerciseSlideCard ${
    swipeDirection === "up"
      ? "slideFromBottom"
      : swipeDirection === "down"
      ? "slideFromTop"
      : ""
  }`}
>
                <div
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  <input
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "10px",
                      borderRadius: "8px"
                    }}
                    value={exercise.name}
                    placeholder="Название упражнения"
                    onChange={(e) => {
                      const newName = e.target.value;

                      setPlan((prev) => ({
                        ...prev,
                        workouts: prev.workouts.map((w) =>
                          w.id === workout.id
                            ? {
                                ...w,
                                exercises: w.exercises.map((ex) =>
                                  ex.id === exercise.id
                                    ? { ...ex, name: newName }
                                    : ex
                                )
                              }
                            : w
                        )
                      }));
                    }}
                  />

                  <button
                    style={{
                      width: "40px",
                      height: "40px",
                      minWidth: "40px",
                      padding: 0,
                      borderRadius: "8px",
                      background: "#ff4d4f",
                      color: "white",
                      border: "none"
                    }}
                    onClick={() => {
                      setPlan((prev) => ({
                        ...prev,
                        workouts: prev.workouts.map((w) =>
                          w.id === workout.id
                            ? {
                                ...w,
                                exercises: w.exercises.filter(
                                  (ex) => ex.id !== exercise.id
                                )
                              }
                            : w
                        )
                      }));
                    }}
                  >
                    ✕
                  </button>
                </div>

                <input
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    opacity: 0.85
                  }}
                  value={exercise.video || ""}
                  placeholder="Путь к видео или Firebase URL"
                  onChange={(e) => {
                    const newVideo = e.target.value;

                    setPlan((prev) => ({
                      ...prev,
                      workouts: prev.workouts.map((w) =>
                        w.id === workout.id
                          ? {
                              ...w,
                              exercises: w.exercises.map((ex) =>
                                ex.id === exercise.id
                                  ? { ...ex, video: newVideo }
                                  : ex
                              )
                            }
                          : w
                      )
                    }));
                  }}
                />

                <input
                  type="file"
                  accept="video/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const storageRef = ref(
                      storage,
                      "videos/" + Date.now() + "-" + file.name
                    );

                    await uploadBytes(storageRef, file);

                    const url = await getDownloadURL(storageRef);

                    setPlan((prev) => ({
                      ...prev,
                      workouts: prev.workouts.map((w) =>
                        w.id === workout.id
                          ? {
                              ...w,
                              exercises: w.exercises.map((ex) =>
                                ex.id === exercise.id
                                  ? { ...ex, video: url }
                                  : ex
                              )
                            }
                          : w
                      )
                    }));

                    alert("Видео загружено ✅");
                  }}
                />

                {exercise.video && (
                  <video
                    src={exercise.video}
                    controls
                    style={{
                      width: "100%",
                      maxHeight: "220px",
                      borderRadius: "10px",
                      marginTop: "8px",
                      background: "#000"
                    }}
                  />
                )}
              </div>
            ))}

            <button
              onClick={() => {
                const newExercise = {
                  id: "e" + Date.now(),
                  name: "Новое упражнение",
                  video: "",
                  sets: makeThreeSets([], 8)
                };

                setPlan((prev) => ({
                  ...prev,
                  workouts: prev.workouts.map((w) =>
                    w.id === workout.id
                      ? { ...w, exercises: [...w.exercises, newExercise] }
                      : w
                  )
                }));
              }}
            >
              ➕ Добавить упражнение
            </button>
          </div>
        ))}

        <button
          className="bigButton"
          onClick={() => {
            const newWorkout = {
              id: "w" + Date.now(),
              name: "Новая тренировка",
              exercises: []
            };

            setPlan((prev) => ({
              ...prev,
              workouts: [...prev.workouts, newWorkout]
            }));
          }}
        >
          ➕ Добавить тренировку
        </button>

        <button className="bigButton" onClick={saveWorkoutsToFirebase}>
          💾 Сохранить изменения
        </button>
      </div>
    );
  }

  if (page === "workouts" && !selectedWorkoutId) {
    return (
      <div className="workoutSelectPage">
        <div className="workoutSelectHero">
          <h1 className="workoutSelectTitle">
            <span>Выбери</span>
            <strong>свою тренировку</strong>
          </h1>

          <p>Подбери план на сегодня и двигайся к цели</p>
          <div className="workoutSelectLine" />
        </div>

        <div className="workoutSelectList">
          {plan.workouts.map((w, index) => {
            const item = workoutMenuItems[index] || {
              day: `День ${index + 1}`,
              title: w.name.replace(/^День\s*\d+\s*[—-]\s*/i, ""),
              image: workoutMenuItems[0].image
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
          })}
        </div>

        <button className="workoutSelectBack universalFixedBackPointer" onClick={goBackToMain}>
          ← Назад
        </button>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="app">
        <div className="workoutHeader">
          <button className="backBtn universalFixedBackPointer" onClick={() => setSelectedWorkoutId(null)}>
            ← Назад
          </button>

          <h1 className="workoutTitle">Тренировка не найдена</h1>
        </div>
      </div>
    );
  }

  const isFinishSlideActive =
    workoutStarted && currentExerciseIndex === workout.exercises.length + 1;

  const shouldShowTopBackButton = !isFinishSlideActive || isWorkoutSaved;

  return (
    <div className="app workoutRunPage">
      <div className="workoutHeader workoutHeaderCompact">
        {shouldShowTopBackButton && (
          <button
            className="backIconBtn universalFixedBackPointer"
            onClick={() => {
              setSelectedWorkoutId(null);
              setOpenVideoId(null);
              setCurrentExerciseIndex(0);
              setWorkoutStarted(false);
              setWorkoutStartedAt(null);
              setWorkoutFinishedAt(null);
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
                    setWorkoutStarted(true);
                    setWorkoutStartedAt(startedAt);
                    setTimerTick(startedAt);
                    setWorkoutFinishedAt(null);
                    setIsWorkoutSaved(false);
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
                  {!isWorkoutSaved && (
                    <button
                      type="button"
                      className="finishBackButton"
                      onClick={() => {
                        setCurrentExerciseIndex(workout.exercises.length);
                        setWorkoutFinishedAt(null);
                        setSwipeDirection("down");
                        centerExerciseDeck();

                        setTimeout(() => {
                          setSwipeDirection("");
                        }, 360);
                      }}
                      aria-label="Вернуться к упражнениям"
                    >
                      ←
                    </button>
                  )}

                  <button
                    type="button"
                    className="finishWorkoutButton"
                    onClick={saveWorkoutToFirebase}
                    disabled={isSaving || isWorkoutSaved}
                  >
                    {isSaving
                      ? "Сохраняю..."
                      : isWorkoutSaved
                      ? "Сохранено ✅"
                      : "Завершить тренировку"}
                  </button>
                </div>
              </div>
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
                        <video className="exerciseVideo" src={exercise.video} controls />
                      </div>
                    )}
                  </>
                )}

                {exercise.id === "warmup" ? (
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
                ) : (
                  <>
                {exercise.sets.map((set, index) => (
                  <div className="setRow" key={index}>
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
                ))}
                  </>
                )}

                {exercise.id !== "warmup" && (
                  <>
                    <div className="previousInfo subtle">
                  {getLastExerciseText(exercise.name)}
                </div>

                    <div className="exerciseNavigationRow">
                      {currentExerciseIndex > 1 && (
                        <button
                          type="button"
                          className="exerciseBackButton"
                          onClick={() => {
                            goToPreviousExercise();
                          }}
                        >
                          ←
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

      {fullscreenVideo && (
        <div
          onClick={() => setFullscreenVideo(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
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
