import { useEffect, useRef, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";
import { defaultNutritionState } from "../../data/nutritionDefaults";
import { todayNutritionKey } from "../../domain/nutritionPresentation";
import { APP_VERSION } from "../../constants/appConfig";
import { POST_WORKOUT_FEEDBACK_OPTIONS } from "../../domain/workoutPresentation";
import { ClientMainBottomBar } from "../../shared/ui/BottomBar";
import FirstSetupOnboarding from "../../features/auth/FirstSetupOnboarding";
import AiCoachPage from "../../features/client/ai/AiCoachPage";
import WorkoutListPage from "../../features/client/workouts/WorkoutListPage";
import {
  PostWorkoutFeedbackDialog,
  WorkoutDraftRestoreDialog,
  WorkoutReadinessDialog
} from "../workout/WorkoutDialogs";
import ProfileAppSettingsSection from "../../features/client/profile/ProfileAppSettingsSection";
import ProfileBodyMetricsSettingsSection from "../../features/client/profile/ProfileBodyMetricsSettingsSection";
import ProfileMeasurementsModal from "../../features/client/profile/ProfileMeasurementsModal";
import ProfileNutritionModal from "../../features/client/profile/ProfileNutritionModal";
import ProfileProgressPhotosModal from "../../features/client/profile/ProfileProgressPhotosModal";
import ProfileSettingsModal from "../../features/client/profile/ProfileSettingsModal";
import ProfileTelegramModal from "../../features/client/profile/ProfileTelegramModal";
import ProfileTrainerNotificationsModal from "../../features/client/profile/ProfileTrainerNotificationsModal";
import ProfileWorkoutCalendarModal from "../../features/client/profile/ProfileWorkoutCalendarModal";
import ProfileWorkoutHistoryModal from "../../features/client/profile/ProfileWorkoutHistoryModal";
import { renderNutritionRoute } from "../../features/client/nutrition/renderNutritionRoute";
import {
  buildNutritionCalendarDays,
  buildNutritionWeekDates,
  formatNutritionCalendarMonthLabel,
  shiftNutritionCalendarMonthKey
} from "../../utils/nutritionCalendar";
import { buildAiNutritionMonthlyPlan } from "../../utils/aiNutritionPlanBuilder";

const HARNESS_DATE = "2026-06-22";

const harnessSearchFoods = [
  {
    id: "harness_greek_yogurt",
    name: "Harness Greek Yogurt",
    source: "AI/FatSecret",
    icon: "GY",
    calories: 95,
    protein: 10,
    fat: 3,
    carbs: 4,
    portion: "100 g",
    portionAmount: 100
  },
  {
    id: "harness_salmon_bowl",
    name: "Harness Salmon Bowl",
    source: "AI/FatSecret",
    icon: "SB",
    calories: 520,
    protein: 36,
    fat: 22,
    carbs: 42,
    portion: "1 bowl",
    portionAmount: 320
  }
];

const harnessMyFoods = {
  harness_oat_bar: {
    id: "harness_oat_bar",
    foodId: "harness_oat_bar",
    name: "Harness Oat Bar",
    source: "Harness My Database",
    icon: "OB",
    calories: 210,
    protein: 8,
    fat: 7,
    carbs: 28,
    portion: "60 g",
    portionAmount: 60,
    amountMode: "grams",
    lastAmount: 60
  }
};

const harnessWorkouts = [
  {
    id: "client_harness_day_1",
    name: "День 1 — Верх тела",
    weekName: "Неделя 1",
    exercises: [
      { id: "bench", name: "Жим гантелей", sets: [{ reps: "10", weight: "20" }] },
      { id: "row", name: "Тяга блока", sets: [{ reps: "12", weight: "35" }] }
    ]
  },
  {
    id: "client_harness_day_2",
    name: "День 2 — Низ тела",
    weekName: "Неделя 1",
    exercises: [
      { id: "leg_press", name: "Жим ногами", sets: [{ reps: "12", weight: "90" }] }
    ]
  }
];

const harnessHistory = [
  {
    id: "client_harness_history_1",
    workoutId: "client_harness_day_1",
    workoutName: "День 1 — Верх тела",
    completedAt: "2026-06-20T18:00:00.000Z",
    date: "2026-06-20T18:00:00.000Z",
    exercises: [
      { name: "Жим гантелей", sets: [{ reps: 10, weight: 20 }] }
    ]
  }
];

const harnessMeasurementFields = [
  { id: "weight", label: "Вес", unit: "кг" },
  { id: "chest", label: "Грудь", unit: "см" },
  { id: "belly", label: "Живот", unit: "см" },
  { id: "thigh", label: "Бедро", unit: "см" }
];

const harnessLatestMeasurement = {
  date: "2026-06-22T12:00:00.000Z",
  weight: 88.8,
  chest: 108,
  belly: 91,
  thigh: 61
};

const harnessNutritionGoals = {
  calories: 2409,
  protein: 172,
  fat: 62,
  carbs: 291
};

const harnessProfileNutritionWeekDays = [
  { key: "2026-06-22", date: "2026-06-22", dayNumber: 22, calories: 1650, protein: 132, hasFood: true, isSelected: true, isToday: true },
  { key: "2026-06-23", date: "2026-06-23", dayNumber: 23, calories: 0, protein: 0, hasFood: false },
  { key: "2026-06-24", date: "2026-06-24", dayNumber: 24, calories: 2480, protein: 158, hasFood: true, isOverGoal: true },
  { key: "2026-06-25", date: "2026-06-25", dayNumber: 25, calories: 0, protein: 0, hasFood: false },
  { key: "2026-06-26", date: "2026-06-26", dayNumber: 26, calories: 2120, protein: 170, hasFood: true },
  { key: "2026-06-27", date: "2026-06-27", dayNumber: 27, calories: 0, protein: 0, hasFood: false },
  { key: "2026-06-28", date: "2026-06-28", dayNumber: 28, calories: 0, protein: 0, hasFood: false }
];

const harnessWorkoutScheduledDates = ["2026-06-02", "2026-06-05", "2026-06-09", "2026-06-12", "2026-06-16", "2026-06-19", "2026-06-23", "2026-06-26"];
const harnessProgressPhotoCompareViews = [
  { id: "front", label: "Спереди", urlKey: "frontUrl" },
  { id: "side", label: "Сбоку", urlKey: "sideUrl" },
  { id: "back", label: "Со спины", urlKey: "backUrl" }
];
const harnessProgressPhotoDataUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 180'%3E%3Crect width='120' height='180' rx='16' fill='%23ede9fe'/%3E%3Ccircle cx='60' cy='44' r='18' fill='%236552e6'/%3E%3Crect x='42' y='68' width='36' height='72' rx='18' fill='%236552e6'/%3E%3C/svg%3E";
const harnessProgressPhotos = [
  {
    id: "photo_after",
    date: "2026-06-22",
    frontUrl: harnessProgressPhotoDataUrl,
    sideUrl: harnessProgressPhotoDataUrl,
    backUrl: harnessProgressPhotoDataUrl
  },
  {
    id: "photo_before",
    date: "2026-05-22",
    frontUrl: harnessProgressPhotoDataUrl,
    sideUrl: harnessProgressPhotoDataUrl,
    backUrl: harnessProgressPhotoDataUrl
  }
];

const harnessTrainerTasks = [
  {
    id: "client_harness_task_1",
    title: "Update measurements",
    dueDate: "2026-06-30",
    target: "measurements",
    status: "progress"
  },
  {
    id: "client_harness_task_2",
    title: "Add progress photos",
    dueDate: "2026-07-02",
    target: "progressPhotos",
    status: "completed"
  }
];

function buildHarnessWorkoutCalendarDays(monthKey, selectedDateKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1, 12);
  const gridStart = new Date(monthStart);
  const startDay = gridStart.getDay() || 7;
  gridStart.setDate(gridStart.getDate() - startDay + 1);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const scheduledIndex = harnessWorkoutScheduledDates.indexOf(key);
    const status = key === "2026-06-05"
      ? "completed"
      : key === "2026-06-12"
        ? "missed"
        : key === "2026-06-19"
          ? "shifted"
          : "planned";

    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: key === HARNESS_DATE,
      isScheduled: scheduledIndex >= 0,
      scheduleEntries: scheduledIndex >= 0 ? [{ order: scheduledIndex + 1, status }] : [],
      workouts: key === selectedDateKey ? [{ id: "client_harness_history_1", workout: "День 1 - Верх тела", date: `${key}T18:30:00.000Z`, durationSeconds: 2700 }] : []
    };
  });
}

function buildHarnessNutrition() {
  return {
    ...defaultNutritionState,
    goals: {
      calories: 2300,
      protein: 180,
      fat: 70,
      carbs: 235
    },
    myFoods: harnessMyFoods,
    recent: harnessSearchFoods,
    days: {
      [HARNESS_DATE]: {
        foods: [
          { id: "breakfast_eggs", name: "Омлет", mealId: "breakfast", calories: 360, protein: 28, fat: 22, carbs: 8 },
          { id: "lunch_chicken", name: "Курица с рисом", mealId: "lunch", calories: 620, protein: 48, fat: 14, carbs: 75 }
        ]
      }
    }
  };
}

function getHarnessNutritionTotals(day) {
  return (day.foods || []).reduce(
    (totals, food) => ({
      calories: totals.calories + (Number(food.calories) || 0),
      protein: totals.protein + (Number(food.protein) || 0),
      fat: totals.fat + (Number(food.fat) || 0),
      carbs: totals.carbs + (Number(food.carbs) || 0)
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

function getHarnessWeekDates(selectedKey) {
  return buildNutritionWeekDates(selectedKey);
}

function HarnessHero() {
  return (
    <div className="profileAiHero">
      <div className="profileAiAvatarWrap">
        <div className="profileAvatarBig profileUnifiedAvatar profileAiAvatar harnessLegacyPortrait">
          <span aria-hidden="true" />
        </div>
        <div className="profileAiAvatarRing">
          <strong>79%</strong>
        </div>
      </div>

      <div className="profileAiHeroText">
        <h1>Добрый день, ILYA 👋</h1>
      </div>
    </div>
  );
}

function HarnessMainSummary({ compact = false }) {
  return (
    <>
      {!compact && (
        <div className="profileAiStatsRow">
          <div className="goal">
            <span className="profileAiStatLabel">Цель</span>
            <strong>Рекомпозиция</strong>
            <small>&nbsp;</small>
          </div>
          <div>
            <span className="profileAiStatLabel">Вес</span>
            <strong>88.8 кг</strong>
            <small>&nbsp;</small>
          </div>
          <div>
            <span className="profileAiStatLabel">Тренировки</span>
            <strong>4</strong>
            <small>&nbsp;</small>
          </div>
        </div>
      )}

      <div className="profileMainSummaryGrid profileAiSplitCards">
        <article className="profileAiMiniCard">
          <span><i aria-hidden="true">📅</i>Последняя тренировка</span>
          <strong>27 июня</strong>
        </article>
        <article className="profileAiMiniCard">
          <span><i aria-hidden="true">⚡</i>Следующая тренировка</span>
          <strong>4 июля</strong>
        </article>
      </div>
    </>
  );
}

function HarnessProgressInsight() {
  return (
    <div className="profileAiCoachInsight profileProgressInsightCard positive">
      <button type="button" className="profileAiCoachToggle">
        <div className="profileAiCoachSummary">
          <div
            className="profileProgressGauge"
            style={{
              "--progress-score": 79,
              "--progress-fill": "284deg",
              "--progress-color": "rgba(123, 111, 232, 1)",
              "--progress-glow": "rgba(123, 111, 232, 0.24)"
            }}
            role="img"
            aria-label="Оценка прогресса 79 из 100"
          >
            <div className="profileProgressGaugeDial">
              <i />
              <strong>79</strong>
            </div>
            <small>из 100</small>
          </div>

          <div className="profileAiCoachHeadline">
            <span>Оценка прогресса</span>
            <h2>Хороший прогресс</h2>
            <p>Регулярность: данные ведутся стабильно. Продолжай в том же ритме.</p>
          </div>
        </div>
      </button>

      <div className="profileAiCoachPreview profileProgressInsightBadges">
        <span className="profileProgressInsightBadge">
          <b>⚡ Тренировка</b>
          <small>5 дн. назад</small>
        </span>
        <span className="profileProgressInsightBadge">
          <b>📏 Замер</b>
          <small>Пора обновить</small>
        </span>
        <span className="profileProgressInsightBadge">
          <b>🍽 Питание</b>
          <small>Нет записей</small>
        </span>
      </div>
    </div>
  );
}

function HarnessMeasurementSnapshot() {
  return (
    <section className="mainMeasurementSnapshot harnessLegacyMeasurementSnapshot" aria-label="Последние замеры веса">
      <div className="mainMeasurementWeight">
        <span>Текущий вес</span>
        <strong>89 кг</strong>
        <em>-0.5 кг</em>
        <small>к прошлому замеру</small>
      </div>
      <div className="harnessLegacyMeasurementChartPanel">
        <div className="mainMeasurementSnapshotHeader">
          <span>Последние замеры</span>
          <i aria-hidden="true">›</i>
        </div>
        <div className="mainMeasurementChart">
          <svg
            className="mainMeasurementChartTrend"
            viewBox="0 0 280 118"
            role="img"
            aria-label="Динамика веса по последним замерам"
          >
            <defs>
              <linearGradient id="harnessMeasurementLineGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#6354f4" />
                <stop offset="100%" stopColor="#7a4cff" />
              </linearGradient>
            </defs>
            <line className="mainMeasurementCurrentGuide" x1="238" y1="47" x2="238" y2="96" />
            <polyline
              className="mainMeasurementTrendLine"
              points="28,78 98,48 168,48 238,60"
            />
            <text className="mainMeasurementPointLabel" x="28" y="61">88.5 кг</text>
            <text className="mainMeasurementPointLabel" x="98" y="31">89.5 кг</text>
            <text className="mainMeasurementPointLabel" x="168" y="31">89.5 кг</text>
            <text className="mainMeasurementPointLabel" x="238" y="42">89 кг</text>
            <circle className="mainMeasurementTrendPoint" cx="28" cy="78" r="4.8" />
            <circle className="mainMeasurementTrendPoint" cx="98" cy="48" r="4.8" />
            <circle className="mainMeasurementTrendPoint" cx="168" cy="48" r="4.8" />
            <circle className="mainMeasurementTrendPoint current" cx="238" cy="60" r="7" />
            <g className="mainMeasurementCurrentBubble">
              <rect x="209" y="18" width="58" height="25" rx="7" />
              <path d="M 231 42 L 245 42 L 238 53 Z" />
              <text x="238" y="35">89 кг</text>
            </g>
            <text className="mainMeasurementDateLabel" x="28" y="110">09.06</text>
            <text className="mainMeasurementDateLabel" x="98" y="110">10.06</text>
            <text className="mainMeasurementDateLabel" x="168" y="110">10.06</text>
            <text className="mainMeasurementDateLabel" x="238" y="110">16.06</text>
          </svg>
        </div>
      </div>
    </section>
  );
}

function HarnessCabinetActions({
  onOpenPhotos,
  onOpenMeasurements,
  onOpenNutrition,
  onOpenCalendar,
  onOpenHistory,
  onOpenSettings
}) {
  const actions = [
    ["photos", "📷", "Контроль тела", "Фото прогресса", "Последние: 22.06.2026", onOpenPhotos],
    ["measurements", "📏", "Контроль тела", "Замеры", "22.06.2026", onOpenMeasurements],
    ["nutrition", "🍽", "План питания", "КБЖУ", "2409 ккал · Рекомпозиция", onOpenNutrition],
    ["progress", "📅", "Тренировки", "Календарь", "4 тренировки сохранено", onOpenCalendar],
    ["history cabinetWorkoutHistoryHarnessButton", "◷", "Тренировки", "История", "Открыть журнал", onOpenHistory],
    ["settings", "⚙", "Параметры", "Настройки", "Тема и Telegram", onOpenSettings]
  ];

  return (
    <div className="progressHubOverview profileCabinetProgressOverview hasProgressPhotos">
      {actions.map(([className, icon, eyebrow, title, note, onClick]) => (
        <button
          key={title}
          type="button"
          className={`progressHubCard ${className}`}
          onClick={onClick}
          aria-label={`${eyebrow}: ${title}`}
        >
          <span className="progressHubCardIcon">{icon}</span>
          <span className="progressHubCardText">
            <small>{eyebrow}</small>
            <strong>{title}</strong>
            <em>{note}</em>
          </span>
          <i aria-hidden="true">›</i>
        </button>
      ))}
    </div>
  );
}

export default function ClientE2EHarness() {
  const harnessParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const cabinetModalParam = typeof window !== "undefined"
    ? harnessParams.get("clientCabinetModal")
    : "";
  const workoutHarnessState = typeof window !== "undefined"
    ? harnessParams.get("clientWorkoutState")
    : "";
  const harnessPageParam = harnessParams?.get("clientHarnessPage") || "";
  const workoutDialogParam = harnessParams?.get("clientWorkoutDialog") || "draft";
  const firstSetupStepValue = Number(harnessParams?.get("clientFirstSetupStep") || 1);
  const firstSetupStepParam = Number.isFinite(firstSetupStepValue)
    ? Math.min(9, Math.max(0, firstSetupStepValue))
    : 1;
  const nutritionPhotoNotFoundParam = harnessParams?.get("clientNutritionPhotoNotFound") === "1";
  const visibleHarnessWorkouts = workoutHarnessState === "empty" ? [] : harnessWorkouts;

  useEffect(() => {
    const previousHtmlTheme = document.documentElement.dataset.appTheme;
    const previousBodyTheme = document.body.dataset.appTheme;

    document.documentElement.dataset.appTheme = "warm-light";
    document.body.dataset.appTheme = "warm-light";

    return () => {
      if (previousHtmlTheme) {
        document.documentElement.dataset.appTheme = previousHtmlTheme;
      } else {
        delete document.documentElement.dataset.appTheme;
      }

      if (previousBodyTheme) {
        document.body.dataset.appTheme = previousBodyTheme;
      } else {
        delete document.body.dataset.appTheme;
      }
    };
  }, []);

  const [page, setPage] = useState(
    nutritionPhotoNotFoundParam
      ? "nutrition"
      : harnessPageParam === "aiCoach"
        ? "aiCoach"
        : harnessPageParam === "firstSetup"
          ? "firstSetup"
        : harnessPageParam === "workoutDialogs"
          ? "workoutDialogs"
        : "main"
  );
  const [firstSetupStep, setFirstSetupStep] = useState(firstSetupStepParam);
  const [firstSetupProfileDraft, setFirstSetupProfileDraft] = useState({
    sex: "male",
    name: "Harness Athlete",
    age: "32",
    weight: "88",
    height: "181",
    activity: "medium",
    goal: "recomp",
    targetWeight: "84"
  });
  const [nutritionDateKey, setNutritionDateKey] = useState(HARNESS_DATE);
  const [nutrition] = useState(buildHarnessNutrition);
  const [selectedAiFeatureId, setSelectedAiFeatureId] = useState("recovery");
  const [aiNutritionProfileDraft, setAiNutritionProfileDraft] = useState({
    weight: "88",
    height: "181",
    age: "32",
    sex: "male",
    goal: "recomp",
    activity: "moderate",
    trainingDays: ["mon", "wed", "fri"]
  });
  const [aiNutritionSavedPlan, setAiNutritionSavedPlan] = useState(null);
  const [aiNutritionAdaptedToday, setAiNutritionAdaptedToday] = useState(false);
  const [nutritionPickerOpen, setNutritionPickerOpen] = useState(nutritionPhotoNotFoundParam);
  const [nutritionCalendarOpen, setNutritionCalendarOpen] = useState(false);
  const [nutritionCalendarMonthKey, setNutritionCalendarMonthKey] = useState(HARNESS_DATE.slice(0, 7));
  const [expandedNutritionMeals, setExpandedNutritionMeals] = useState({});
  const [nutritionZoukExpanded, setNutritionZoukExpanded] = useState(false);
  const [isAiNutritionPlanExpanded, setIsAiNutritionPlanExpanded] = useState(false);
  const [nutritionCreateChoiceOpen, setNutritionCreateChoiceOpen] = useState(false);
  const [nutritionSearch, setNutritionSearch] = useState("");
  const [nutritionSearchTab, setNutritionSearchTab] = useState("food");
  const [nutritionSearchResultLimit, setNutritionSearchResultLimit] = useState(8);
  const [showRecentNutritionFoods, setShowRecentNutritionFoods] = useState(false);
  const [selectedNutritionFood, setSelectedNutritionFood] = useState(null);
  const [editingNutritionItemId, setEditingNutritionItemId] = useState("");
  const [nutritionEditPageOpen, setNutritionEditPageOpen] = useState(false);
  const [nutritionMealMenuOpen, setNutritionMealMenuOpen] = useState(false);
  const [nutritionAmount, setNutritionAmount] = useState("100");
  const [nutritionAmountMode, setNutritionAmountMode] = useState("grams");
  const [nutritionProductUnitMenuOpen, setNutritionProductUnitMenuOpen] = useState(false);
  const [dishIngredientPickerOpen, setDishIngredientPickerOpen] = useState(false);
  const [dishIngredientSearch, setDishIngredientSearch] = useState("");
  const [pendingDishIngredient, setPendingDishIngredient] = useState(null);
  const [pendingDishIngredientGrams, setPendingDishIngredientGrams] = useState("100");
  const [nutritionPhotoNotFoundOpen, setNutritionPhotoNotFoundOpen] = useState(nutritionPhotoNotFoundParam);
  const [nutritionEditNote, setNutritionEditNote] = useState("");
  const [individualWorkoutIndex, setIndividualWorkoutIndex] = useState(0);
  const [individualWorkoutIndexInitialized, setIndividualWorkoutIndexInitialized] = useState(false);
  const [workoutModeModalOpen, setWorkoutModeModalOpen] = useState(false);
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = useState(false);
  const [workoutReadinessPending, setWorkoutReadinessPending] = useState(null);
  const [cabinetWorkoutHistoryOpen, setCabinetWorkoutHistoryOpen] = useState(false);
  const [cabinetWorkoutHistoryItemOpen, setCabinetWorkoutHistoryItemOpen] = useState("client_harness_history_1");
  const [cabinetMeasurementsOpen, setCabinetMeasurementsOpen] = useState(
    () => cabinetModalParam === "measurements"
  );
  const [cabinetNutritionOpen, setCabinetNutritionOpen] = useState(
    () => cabinetModalParam === "nutrition"
  );
  const [cabinetNutritionGoal, setCabinetNutritionGoal] = useState("recomp");
  const [cabinetCalendarOpen, setCabinetCalendarOpen] = useState(
    () => cabinetModalParam === "calendar"
  );
  const [cabinetPhotosOpen, setCabinetPhotosOpen] = useState(
    () => cabinetModalParam === "photos"
  );
  const [cabinetSettingsOpen, setCabinetSettingsOpen] = useState(
    () => cabinetModalParam === "settings"
  );
  const [telegramModalOpen, setTelegramModalOpen] = useState(
    () => cabinetModalParam === "telegram"
  );
  const [harnessWarmLightTheme, setHarnessWarmLightTheme] = useState(true);
  const [trainerNotificationsOpen, setTrainerNotificationsOpen] = useState(
    () => cabinetModalParam === "notifications"
  );
  const [bodyMetricsDraft, setBodyMetricsDraft] = useState({
    sex: "male",
    weight: "88",
    targetWeight: "84",
    height: "181",
    age: "32",
    goal: "recomp",
    activity: "medium"
  });
  const [cabinetCalendarEditing, setCabinetCalendarEditing] = useState(false);
  const [cabinetCalendarSelectedDate, setCabinetCalendarSelectedDate] = useState("2026-06-05");
  const nutritionPhotoInputRef = useRef(null);
  const telegramLoginContainerRef = useRef(null);
  const nutritionFoodSwipeMoved = useRef(false);
  const cabinetWorkoutHistoryItemRefs = useRef(new Map());

  const nutritionToday = nutrition.days[nutritionDateKey] || { foods: [] };
  const nutritionTotals = getHarnessNutritionTotals(nutritionToday);
  const nutritionWeekDates = getHarnessWeekDates(nutritionDateKey);
  const nutritionCalendarDays = buildNutritionCalendarDays({
    monthKey: nutritionCalendarMonthKey,
    selectedDateKey: nutritionDateKey,
    nutrition,
    todayKey: HARNESS_DATE
  });
  const nutritionCalendarMonthLabel = formatNutritionCalendarMonthLabel(nutritionCalendarMonthKey);
  const nutritionSearchResults = nutritionSearchTab === "my"
    ? Object.values(nutrition.myFoods || {})
    : nutritionSearch.trim().length >= 2
      ? harnessSearchFoods
      : [];
  const visibleNutritionSearchResults = nutritionSearchResults.slice(0, nutritionSearchResultLimit);
  const cabinetCalendarMonthKey = "2026-06";
  const cabinetCalendarDays = buildHarnessWorkoutCalendarDays(cabinetCalendarMonthKey, cabinetCalendarSelectedDate);
  const cabinetCalendarSelectedItems = cabinetCalendarDays
    .find((day) => day.key === cabinetCalendarSelectedDate)
    ?.workouts || [];

  function openHarnessSelectedFood(food) {
    setSelectedNutritionFood({
      ...food,
      icon: food.icon || "HF",
      source: food.source || "Harness"
    });
    setNutritionAmount(String(food.lastAmount || food.portionAmount || 100));
    setNutritionAmountMode(food.amountMode || "grams");
    setNutritionEditNote("");
    setNutritionEditPageOpen(false);
    setNutritionMealMenuOpen(false);
    setShowRecentNutritionFoods(false);
  }

  function updateHarnessSelectedFoodField(field, value) {
    setSelectedNutritionFood((current) => current ? { ...current, [field]: value } : current);
  }

  function closeHarnessSelectedFood() {
    setSelectedNutritionFood(null);
    setEditingNutritionItemId("");
    setNutritionEditPageOpen(false);
    setNutritionMealMenuOpen(false);
    setNutritionProductUnitMenuOpen(false);
    setDishIngredientPickerOpen(false);
    setPendingDishIngredient(null);
  }

  function openHarnessCustomDish() {
    const dishId = `harness_dish_${Date.now()}`;
    setSelectedNutritionFood({
      id: dishId,
      foodId: dishId,
      type: "dish",
      name: "Harness custom dish",
      source: "Harness My Database",
      icon: "🍲",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      portion: "100 g",
      portionAmount: 100,
      totalWeight: 100,
      ingredients: []
    });
    setNutritionCreateChoiceOpen(false);
    setNutritionEditPageOpen(true);
    setDishIngredientPickerOpen(false);
    setPendingDishIngredient(null);
    setPendingDishIngredientGrams("100");
  }

  function addHarnessDishIngredient(food, grams) {
    setSelectedNutritionFood((current) => {
      if (!current) return current;

      return {
        ...current,
        ingredients: [
          ...(current.ingredients || []),
          {
            id: `harness_ing_${Date.now()}`,
            name: food.name,
            icon: food.icon,
            grams,
            baseAmount: food.portionAmount || 100,
            baseCalories: food.calories || 0
          }
        ]
      };
    });
    setDishIngredientPickerOpen(false);
  }

  function updateBodyMetricsDraft(field, value) {
    setBodyMetricsDraft((current) => ({ ...current, [field]: value }));
  }

  function renderBottomBar(firstArg, secondArg = {}) {
    const props = typeof firstArg === "object"
      ? firstArg
      : { activeTab: firstArg, ...secondArg };

    return (
      <ClientMainBottomBar
        {...props}
        onGoMain={() => setPage("main")}
        onOpenTraining={() => setPage("workouts")}
        onOpenNutrition={() => setPage("nutrition")}
        onOpenCabinet={() => setPage("cabinet")}
      />
    );
  }

  function renderHarnessChrome(activeTab, title, children) {
    const pageClass = activeTab === "main"
      ? " clientCorePageMain mainDashboardPage"
      : activeTab === "cabinet"
        ? " clientCorePageCabinet"
        : "";
    const titleClass = activeTab === "main"
      ? "mainDashboardTitle clientCorePageTitle"
      : activeTab === "cabinet"
        ? "profileCabinetPageTitle clientCorePageTitle"
        : "clientCorePageTitle";

    return (
      <main
        className={`profileDashboardPage profileTabbedPage clientCorePage${pageClass}`}
        data-profile-tab={activeTab === "cabinet" ? "cabinet" : undefined}
        data-testid={`client-harness-${activeTab}`}
      >
        <div className="appVersionBadge clientPageVersionBadge">{APP_VERSION}</div>
        {activeTab === "main" && (
          <button
            type="button"
            className="menuRefreshIconBtn"
            aria-label="Обновить страницу"
            title="Обновить страницу"
          >
            <RefreshCw aria-hidden="true" />
          </button>
        )}
        {activeTab === "cabinet" ? (
          <div className="profileCabinetTitleRow">
            <h1 className={titleClass}>{title}</h1>
            <button
              type="button"
              className="profileTrainerNotificationsButton"
              aria-label="Уведомления тренера"
              title="Уведомления тренера"
            >
              <Bell aria-hidden="true" />
            </button>
          </div>
        ) : (
          <h1 className={titleClass}>{title}</h1>
        )}
        <section className="profileUnifiedCard profileAiDashboardCard profileCabinetSection">
          {children}
        </section>
        {renderBottomBar(activeTab, { className: "mainMenuBottomBar profileBottomTabBar" })}
      </main>
    );
  }

  if (page === "workouts") {
    return (
      <main data-testid="client-harness-workouts">
        <WorkoutListPage
          appVersion={APP_VERSION}
          renderClientMainBottomBar={renderBottomBar}
          plan={{
            workouts: visibleHarnessWorkouts,
            assignedProgramId: "client_harness_program",
            assignedProgramName: "Тестовая программа",
            assignedProgramUpdatedAt: "2026-06-18T10:00:00.000Z"
          }}
          history={harnessHistory}
          currentUserId="client_harness"
          workoutModePreference={{ mode: "individual" }}
          individualWorkoutIndex={individualWorkoutIndex}
          individualWorkoutIndexInitialized={individualWorkoutIndexInitialized}
          setIndividualWorkoutIndex={setIndividualWorkoutIndex}
          setIndividualWorkoutIndexInitialized={setIndividualWorkoutIndexInitialized}
          workoutModeModalOpen={workoutModeModalOpen}
          setWorkoutModeModalOpen={setWorkoutModeModalOpen}
          workoutHistoryModalOpen={workoutHistoryModalOpen}
          setWorkoutHistoryModalOpen={setWorkoutHistoryModalOpen}
          workoutDraftRestorePrompt={null}
          workoutReadinessOpen={false}
          postWorkoutFeedbackOpen={false}
          fullscreenVideo={false}
          showFirstSetupOnboarding={false}
          historyLoading={false}
          isTrainerMode={false}
          onGoMain={() => setPage("main")}
          onOpenTraining={() => setPage("workouts")}
          onOpenNutrition={() => setPage("nutrition")}
          onOpenCabinet={() => setPage("cabinet")}
          loadHistory={() => {}}
          openWorkout={() => {}}
          onOpenBasicMode={() => {}}
          onOpenIndividualWorkouts={() => {}}
          openCabinetWorkoutHistory={() => setPage("cabinet")}
          handleWorkoutDraftChoice={() => {}}
        />
      </main>
    );
  }

  if (page === "workoutDialogs") {
    return (
      <main data-testid="client-harness-workout-dialogs">
        <WorkoutDraftRestoreDialog
          open={workoutDialogParam === "draft"}
          blocked={false}
          onRestart={() => {}}
          onRestore={() => {}}
        />
        <WorkoutReadinessDialog
          open={workoutDialogParam === "readiness"}
          selectedWorkoutId="client_harness_day_1"
          workoutStarted={false}
          pendingOption={workoutReadinessPending}
          onSelectOption={setWorkoutReadinessPending}
          onBack={() => {}}
          onApply={() => {}}
        />
        <PostWorkoutFeedbackDialog
          open={workoutDialogParam === "post"}
          options={POST_WORKOUT_FEEDBACK_OPTIONS}
          isSaving={false}
          onSelect={() => {}}
        />
      </main>
    );
  }

  if (page === "firstSetup") {
    return (
      <main data-testid="client-harness-first-setup">
        <FirstSetupOnboarding
          open
          onboardingStep={firstSetupStep}
          profileDraft={firstSetupProfileDraft}
          saveStatus=""
          setOnboardingStep={setFirstSetupStep}
          setProfileDraft={setFirstSetupProfileDraft}
          onSubmit={() => {}}
          onExit={() => {}}
        />
      </main>
    );
  }

  if (page === "aiCoach") {
    return (
      <main data-testid="client-harness-ai-coach">
        <AiCoachPage
          onGoBack={() => setPage("main")}
          onOpenProfile={() => setPage("cabinet")}
          selectedAiFeatureId={selectedAiFeatureId}
          setSelectedAiFeatureId={setSelectedAiFeatureId}
          setAiNutritionProfileDraft={setAiNutritionProfileDraft}
          saveAiNutritionPlan={(profile = aiNutritionProfileDraft) => {
            setAiNutritionSavedPlan(buildAiNutritionMonthlyPlan(nutrition, profile, harnessHistory));
          }}
          resetAiNutritionPlan={() => setAiNutritionSavedPlan(null)}
          aiNutritionAdaptedToday={aiNutritionAdaptedToday}
          setAiNutritionAdaptedToday={setAiNutritionAdaptedToday}
          aiNutritionSavedPlan={aiNutritionSavedPlan}
          aiNutritionProfile={aiNutritionSavedPlan ? aiNutritionProfileDraft : null}
          aiNutritionProfileDraft={aiNutritionProfileDraft}
          nutrition={nutrition}
          nutritionDateKey={nutritionDateKey}
          history={harnessHistory}
          plan={{ workouts: visibleHarnessWorkouts }}
        />
      </main>
    );
  }

  if (page === "nutrition") {
    return (
      <main data-testid="client-harness-nutrition">
        {renderNutritionRoute({
          activeNutritionSearchResultLimit: 8,
          addNutritionFoodFromPicker: openHarnessSelectedFood,
          addNutritionProductManuallyFromPhoto: () => {},
          addSelectedDishIngredientFromFood: addHarnessDishIngredient,
          aiNutritionProfile: { goal: "recomp", activity: "moderate", trainingDays: 3 },
          aiNutritionProfileDraft: { goal: "recomp", activity: "moderate", trainingDays: 3 },
          aiNutritionSavedPlan: null,
          barcodeScannerOpen: false,
          canDeleteSelectedNutritionFood: () => false,
          cancelNutritionEditPage: () => setNutritionEditPageOpen(false),
          closeSelectedNutritionFood: closeHarnessSelectedFood,
          confirmNutritionEditPage: () => setNutritionEditPageOpen(false),
          confirmNutritionFoodFromPicker: closeHarnessSelectedFood,
          createCustomNutritionDish: openHarnessCustomDish,
          createCustomNutritionFood: () => {},
          deleteSelectedNutritionFood: () => {},
          deletingNutritionFoodId: "",
          dishIngredientExternalFoods: harnessSearchFoods,
          dishIngredientFallbackSuggestions: [],
          dishIngredientLoading: false,
          dishIngredientPickerOpen,
          dishIngredientSearch,
          editingNutritionItemId,
          expandedNutritionMeals,
          fatSecretError: "",
          fatSecretLoading: false,
          handleNutritionFoodSwipeCancel: () => {},
          handleNutritionFoodSwipeEnd: () => {},
          handleNutritionFoodSwipeMove: () => {},
          handleNutritionFoodSwipeStart: () => {},
          handleNutritionPhotoAiSearch: () => {},
          history: harnessHistory,
          isAiNutritionPlanExpanded,
          isNutritionToday: nutritionDateKey === HARNESS_DATE,
          nutrition,
          nutritionAmount,
          nutritionAmountError: "",
          nutritionAmountMode,
          nutritionCalendarDays,
          nutritionCalendarMonthLabel,
          nutritionCalendarOpen,
          nutritionCreateChoiceOpen,
          nutritionCurrentStreak: 4,
          nutritionDateKey,
          nutritionDeleteConfirmOpen: false,
          nutritionEditNote,
          nutritionEditPageOpen,
          nutritionFallbackSuggestions: [],
          nutritionFoodSwipeMoved,
          nutritionFoodSwipeOffsets: {},
          nutritionMeal: "breakfast",
          nutritionMealMenuOpen,
          nutritionPhotoAiCandidates: [],
          nutritionPhotoAiConfidence: 0,
          nutritionPhotoAiResult: null,
          nutritionPhotoAnalyzing: false,
          nutritionPhotoInputRef,
          nutritionPhotoNotFoundOpen,
          nutritionPhotoPreview: "",
          nutritionPickerOpen,
          nutritionProductErrors: {},
          nutritionProductUnitMenuOpen,
          nutritionSearch,
          nutritionSearchResultKey: "",
          nutritionSearchResults,
          nutritionSearchTab,
          nutritionToday,
          nutritionTotals,
          nutritionUndoDelete: null,
          nutritionWeekDates,
          nutritionZoukExpanded,
          openDishIngredientPicker: () => setDishIngredientPickerOpen(true),
          openNutritionCalendar: () => setNutritionCalendarOpen(true),
          openNutritionEditPage: () => setNutritionEditPageOpen(true),
          openNutritionFoodEditor: () => {},
          openNutritionPicker: () => setNutritionPickerOpen(true),
          pendingDishIngredient,
          pendingDishIngredientGrams,
          recentNutritionFoods: harnessSearchFoods,
          removeSelectedDishIngredient: () => {},
          renderTrainerMainBottomBar: renderBottomBar,
          resetNutritionPhotoAiSearch: () => {},
          resetNutritionPhotoAiState: () => setNutritionPhotoNotFoundOpen(false),
          restoreNutritionFood: () => {},
          retryNutritionPhotoFromNotFound: () => setNutritionPhotoNotFoundOpen(false),
          selectNutritionDate: setNutritionDateKey,
          selectNutritionPhotoAiCandidate: () => {},
          selectedNutritionFood,
          setBarcodeScannerOpen: () => {},
          setDishIngredientPickerOpen,
          setDishIngredientSearch,
          setEditingNutritionItemId,
          setExpandedNutritionMeals,
          setFatSecretError: () => {},
          setIsAiNutritionPlanExpanded,
          setNutritionAmount,
          setNutritionAmountError: () => {},
          setNutritionAmountMode,
          setNutritionCalendarOpen,
          setNutritionCreateChoiceOpen,
          setNutritionDeleteConfirmOpen: () => {},
          setNutritionEditDetailsOpen: () => {},
          setNutritionEditNote,
          setNutritionEditPageOpen,
          setNutritionFallbackSuggestions: () => {},
          setNutritionMeal: () => {},
          setNutritionMealMenuOpen,
          setNutritionPickerOpen,
          setNutritionProductUnitMenuOpen,
          setNutritionSearch,
          setNutritionSearchResultLimit: ({ limit }) => setNutritionSearchResultLimit(limit),
          setNutritionSearchTab,
          setNutritionZoukExpanded,
          setPendingDishIngredient,
          setPendingDishIngredientGrams,
          setSelectedNutritionFood,
          setShowRecentNutritionFoods,
          shiftNutritionCalendarMonth: (offset) => {
            setNutritionCalendarMonthKey((currentMonthKey) => shiftNutritionCalendarMonthKey(currentMonthKey, offset));
          },
          showRecentNutritionFoods,
          todayNutritionKey,
          updateSelectedDishTotalWeight: () => {},
          updateSelectedNutritionFoodField: updateHarnessSelectedFoodField,
          updateSelectedNutritionPortionUnit: (unit) => updateHarnessSelectedFoodField("portion", `100 ${unit}`),
          visibleNutritionSearchResults
        })}
      </main>
    );
  }

  if (page === "cabinet") {
    const cabinetHistoryItems = harnessHistory.map((item) => ({
      ...item,
      workout: item.workoutName,
      durationSeconds: 2700
    }));

    return renderHarnessChrome("cabinet", "Личный кабинет", (
      <>
        <HarnessHero />
        <HarnessCabinetActions
          onOpenPhotos={() => setCabinetPhotosOpen(true)}
          onOpenMeasurements={() => setCabinetMeasurementsOpen(true)}
          onOpenNutrition={() => setCabinetNutritionOpen(true)}
          onOpenCalendar={() => setCabinetCalendarOpen(true)}
          onOpenHistory={() => setCabinetWorkoutHistoryOpen(true)}
          onOpenSettings={() => setCabinetSettingsOpen(true)}
        />
        <ProfileWorkoutHistoryModal
          open={cabinetWorkoutHistoryOpen}
          programScope={{
            assignedProgramName: "Тестовая программа"
          }}
          loading={false}
          items={cabinetHistoryItems}
          openItemId={cabinetWorkoutHistoryItemOpen}
          itemRefs={cabinetWorkoutHistoryItemRefs}
          deletingId=""
          getTimestampValue={(value) => value}
          onClose={() => setCabinetWorkoutHistoryOpen(false)}
          onToggleItem={(itemId) => setCabinetWorkoutHistoryItemOpen((current) => current === itemId ? "" : itemId)}
          onRequestDelete={() => {}}
        />
        <ProfileMeasurementsModal
          open={cabinetMeasurementsOpen}
          latestMeasurement={harnessLatestMeasurement}
          measurementFields={harnessMeasurementFields}
          formatMeasurementDate={(measurement) => new Date(measurement.date).toLocaleDateString("ru-RU")}
          getMeasurementValue={(measurement, field) => `${measurement[field.id]} ${field.unit}`}
          onClose={() => setCabinetMeasurementsOpen(false)}
          onStart={() => {}}
        />
        <ProfileNutritionModal
          open={cabinetNutritionOpen}
          profileDraft={{ goal: cabinetNutritionGoal }}
          activeProfile={{ goal: "recomp" }}
          draftMacros={harnessNutritionGoals}
          nutritionGoals={harnessNutritionGoals}
          saveStatus=""
          weekLabel="22-28 июня"
          weekDays={harnessProfileNutritionWeekDays}
          aiPlan={null}
          aiWeek={harnessNutritionGoals}
          aiActiveProfile={{ goal: cabinetNutritionGoal }}
          selectedTotals={{ calories: 1650, protein: 132, fat: 48, carbs: 154 }}
          onClose={() => setCabinetNutritionOpen(false)}
          onGoalChange={setCabinetNutritionGoal}
          onSave={() => {}}
          onShiftWeek={() => {}}
        />
        <ProfileWorkoutCalendarModal
          open={cabinetCalendarOpen}
          modalBodyRef={null}
          monthDate={new Date("2026-06-01T12:00:00")}
          monthKey={cabinetCalendarMonthKey}
          calendarDays={cabinetCalendarDays}
          selectedDate={cabinetCalendarSelectedDate}
          selectedItems={cabinetCalendarSelectedItems}
          scheduledDates={harnessWorkoutScheduledDates}
          draftDates={harnessWorkoutScheduledDates}
          editing={cabinetCalendarEditing}
          saving={false}
          status=""
          getTimestampValue={(value) => value}
          onClose={() => setCabinetCalendarOpen(false)}
          onShiftMonth={() => {}}
          onStartEdit={() => setCabinetCalendarEditing(true)}
          onCancelEdit={() => setCabinetCalendarEditing(false)}
          onSave={() => setCabinetCalendarEditing(false)}
          onDayClick={(day) => setCabinetCalendarSelectedDate(day.key)}
          onOpenHistory={() => setCabinetWorkoutHistoryOpen(true)}
        />
        <ProfileProgressPhotosModal
          open={cabinetPhotosOpen}
          uploading={false}
          latestPhoto={harnessProgressPhotos[0]}
          photos={harnessProgressPhotos}
          files={{}}
          previews={{}}
          status=""
          compareIds={[harnessProgressPhotos[1].id, harnessProgressPhotos[0].id]}
          compareViews={harnessProgressPhotoCompareViews}
          compareView="front"
          activeCompareView={harnessProgressPhotoCompareViews[0]}
          selectedBefore={harnessProgressPhotos[1]}
          selectedAfter={harnessProgressPhotos[0]}
          canSave={false}
          formatPhotoDate={(photo) => photo?.date || ""}
          onClose={() => setCabinetPhotosOpen(false)}
          onSelectPhoto={() => {}}
          onCompareIdsChange={() => {}}
          onCompareViewChange={() => {}}
          onSave={() => {}}
        />
        <ProfileSettingsModal
          open={cabinetSettingsOpen}
          section="settings"
          onClose={() => setCabinetSettingsOpen(false)}
        >
          <ProfileAppSettingsSection
            isWarmLightTheme={harnessWarmLightTheme}
            telegramProfile={{
              connected: true,
              username: "harness_coach",
              displayName: "Harness Athlete",
              avatarUrl: ""
            }}
            onToggleTheme={() => setHarnessWarmLightTheme((current) => !current)}
            onOpenTelegram={() => setTelegramModalOpen(true)}
            onTelegramAvatarError={() => {}}
          />
          <button type="button" className="profileDashboardButton" onClick={() => setTelegramModalOpen(true)}>
            Open Telegram
          </button>
          <ProfileBodyMetricsSettingsSection
            open
            draft={bodyMetricsDraft}
            onToggle={() => {}}
            onDraftChange={updateBodyMetricsDraft}
            onSave={() => {}}
          />
        </ProfileSettingsModal>
        <ProfileTrainerNotificationsModal
          open={trainerNotificationsOpen}
          tasks={harnessTrainerTasks}
          activeCount={1}
          getTaskDestination={(task) => task.target || ""}
          onClose={() => setTrainerNotificationsOpen(false)}
          onOpenTask={() => {}}
        />
        <ProfileTelegramModal
          open={telegramModalOpen}
          telegramProfile={{
            connected: true,
            username: "harness_coach",
            displayName: "Harness Athlete",
            avatarUrl: "",
            notificationsEnabled: true
          }}
          loginContainerRef={telegramLoginContainerRef}
          loginWidgetReady={true}
          linking={false}
          status="Notifications enabled"
          onAvatarError={() => {}}
          onClose={() => setTelegramModalOpen(false)}
          onCheckLogin={() => {}}
          onChangeTelegram={() => {}}
          onDisconnect={() => {}}
        />
      </>
    ));
  }

  return renderHarnessChrome("main", "Главное меню", (
    <>
      <HarnessHero />
      <HarnessMainSummary compact />
      <HarnessProgressInsight />
      <HarnessMeasurementSnapshot />
    </>
  ));
}
