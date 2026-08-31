import { useEffect, useRef, useState } from "react";
import { defaultNutritionState } from "../../data/nutritionDefaults";
import { todayNutritionKey } from "../../domain/nutritionPresentation";
import { APP_VERSION } from "../../constants/appConfig";
import { normalizeAppTheme } from "../../app/appTheme";
import { POST_WORKOUT_FEEDBACK_OPTIONS } from "../../domain/workoutPresentation";
import { ClientMainBottomBar } from "../../shared/ui/BottomBar";
import FirstSetupOnboarding from "../../features/auth/FirstSetupOnboarding";
import AiCoachPage from "../../features/client/ai/AiCoachPage";
import MeasurementWizardPage from "../../features/client/measurements/MeasurementWizardPage";
import WorkoutHistoryPage from "../../features/client/workouts/WorkoutHistoryPage";
import BasicWorkoutQuizPage from "../../features/client/workouts/BasicWorkoutQuizPage";
import WorkoutListPage from "../../features/client/workouts/WorkoutListPage";
import WorkoutModePage from "../../features/client/workouts/WorkoutModePage";
import WorkoutPlanPage from "../../features/client/workouts/WorkoutPlanPage";
import { WorkoutModePickerDialog } from "../../features/client/workouts/WorkoutListDialogs";
import BasicWorkoutExerciseExplainer from "../../features/client/workouts/BasicWorkoutExerciseExplainer";
import WorkoutExerciseVideoFrame from "../../features/client/workouts/WorkoutExerciseVideoFrame";
import WorkoutExerciseSets from "../../features/client/workouts/WorkoutExerciseSets";
import WorkoutRunStageView, { WorkoutRunExercisePreview } from "../../features/client/workouts/WorkoutRunStageView";
import WorkoutRunPageShell from "../../features/client/workouts/WorkoutRunPageShell";
import WorkoutExerciseSupport from "../../features/client/workouts/WorkoutExerciseSupport";
import {
  WorkoutFullscreenVideoOverlay,
  WorkoutNotFoundPage,
  WorkoutRunTopControls
} from "../../features/client/workouts/WorkoutRunOverlays";
import {
  PostWorkoutFeedbackDialog,
  WorkoutDraftRestoreDialog,
  WorkoutExitDialog,
  WorkoutIncompleteDialog,
  WorkoutReadinessDialog
} from "../workout/WorkoutDialogs";
import ProfileAccountSettingsSection from "../../features/client/profile/ProfileAccountSettingsSection";
import ProfileAppSettingsSection from "../../features/client/profile/ProfileAppSettingsSection";
import ProfileAvatarCropModal from "../../features/client/profile/ProfileAvatarCropModal";
import ProfileCabinetActionGrid from "../../features/client/profile/ProfileCabinetActionGrid";
import ProfileCabinetTitleRow from "../../features/client/profile/ProfileCabinetTitleRow";
import ProfileEmailModal from "../../features/client/profile/ProfileEmailModal";
import ProfileHeroCard from "../../features/client/profile/ProfileHeroCard";
import ProfileMainMeasurementSnapshot from "../../features/client/profile/ProfileMainMeasurementSnapshot";
import ProfileMainRoleActions from "../../features/client/profile/ProfileMainRoleActions";
import ProfileQuickWeightModal from "../../features/client/profile/ProfileQuickWeightModal";
import ProfileWeightCheckInReminder from "../../features/client/profile/ProfileWeightCheckInReminder";
import { ProfileNextWorkoutCard } from "../../features/client/profile/ProfileMainSummaryCards";
import ProfileMeasurementWizardPanel from "../../features/client/profile/ProfileMeasurementWizardPanel";
import ProfileMeasurementsModal from "../../features/client/profile/ProfileMeasurementsModal";
import ProfileNutritionModal from "../../features/client/profile/ProfileNutritionModal";
import ProfilePasswordModal from "../../features/client/profile/ProfilePasswordModal";
import ProfilePageChrome from "../../features/client/profile/ProfilePageChrome";
import {
  ProfileDashboardContent,
  ProfileDashboardShell,
  ProfileDashboardVersion,
  ProfileHarnessTitle,
  ProfileMainHeroStatsShell
} from "../../features/client/profile/ProfileDashboardShell";
import ProfileProgressInsightCard from "../../features/client/profile/ProfileProgressInsightCard";
import ProfileProgressPhotosModal from "../../features/client/profile/ProfileProgressPhotosModal";
import ProfileSettingsModal from "../../features/client/profile/ProfileSettingsModal";
import ProfileSettingsTab from "../../features/client/profile/ProfileSettingsTab";
import ProfileTelegramModal from "../../features/client/profile/ProfileTelegramModal";
import ProfileTrainerNotificationsModal from "../../features/client/profile/ProfileTrainerNotificationsModal";
import ProfileWorkoutJournalModal from "../../features/client/profile/ProfileWorkoutJournalModal";
import { renderNutritionRoute } from "../../features/client/nutrition/renderNutritionRoute";
import DishEditIngredientsBox from "../../features/client/nutrition/DishEditIngredientsBox";
import NutritionDeleteConfirmModal from "../../features/client/nutrition/NutritionDeleteConfirmModal";
import FoodSearchHistoryNames from "../../features/client/nutrition/FoodSearchHistoryNames";
import { FoodSearchSurface } from "../../features/client/nutrition/FoodSearchOverlay";
import NutritionPhotoAiPreview from "../../features/client/nutrition/NutritionPhotoAiPreview";
import NutritionUndoDeleteToast from "../../features/client/nutrition/NutritionUndoDeleteToast";
import {
  buildNutritionCalendarDays,
  buildNutritionWeekDates,
  formatNutritionCalendarMonthLabel,
  shiftNutritionCalendarMonthKey
} from "../../utils/nutritionCalendar";
import { buildAiNutritionMonthlyPlan } from "../../utils/aiNutritionPlanBuilder";
import { replaceBasicWorkoutExerciseInPlan } from "../../utils/basicWorkoutAlternatives";
import { getProfileMeasurementFields } from "../../utils/profileMeasurements";

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

const harnessRunWorkoutSeed = {
  id: "client_harness_run_day_1",
  name: "День 1 — Верх тела",
  weekName: "Неделя 1",
  exercises: [
    {
      id: "client_harness_run_bench",
      name: "Жим штанги лёжа",
      video: "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4",
      sets: [
        { reps: "10", weight: "60", enteredReps: "10", enteredWeight: "60", aiOriginalWeight: "65", completed: true },
        { reps: "10", weight: "60", enteredReps: "", enteredWeight: "", completed: false },
        { reps: "8", weight: "65", enteredReps: "", enteredWeight: "", completed: false }
      ]
    },
    {
      id: "client_harness_run_row",
      name: "Тяга верхнего блока",
      sets: [
        { reps: "12", weight: "35", enteredReps: "", enteredWeight: "", completed: false },
        { reps: "12", weight: "35", enteredReps: "", enteredWeight: "", completed: false }
      ]
    }
  ]
};

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

const harnessWorkoutHistory = [
  {
    id: "client_harness_history_full_1",
    workoutId: "client_harness_day_1",
    workout: "День 1 — Верх тела",
    completedAt: "2026-06-20T18:00:00.000Z",
    date: "2026-06-20T18:00:00.000Z",
    postWorkoutFeedback: { emoji: "🔥", title: "Хорошо" },
    exercises: [
      {
        name: "Жим гантелей",
        sets: [
          { set: 1, reps: 10, weight: 20 },
          { set: 2, reps: 9, weight: 20 }
        ]
      },
      {
        name: "Тяга верхнего блока",
        sets: [
          { set: 1, reps: 12, weight: 35 },
          { set: 2, reps: 11, weight: 35 }
        ]
      }
    ]
  },
  {
    id: "client_harness_history_full_2",
    workoutId: "client_harness_day_2",
    workout: "День 2 — Низ тела",
    completedAt: "2026-06-17T17:30:00.000Z",
    date: "2026-06-17T17:30:00.000Z",
    exercises: [
      {
        name: "Жим ногами",
        sets: [
          { set: 1, reps: 12, weight: 90 },
          { set: 2, reps: 12, weight: 90 },
          { set: 3, reps: 10, weight: 95 }
        ]
      }
    ]
  }
];

const harnessMeasurementFields = [
  { id: "weight", label: "Вес", unit: "кг" },
  { id: "chest", label: "Грудь", unit: "см" },
  { id: "belly", label: "Живот", unit: "см" },
  { id: "thigh", label: "Бедро", unit: "см" }
];

const harnessFullMeasurementFields = [
  { id: "weight", label: "Вес", unit: "кг" },
  { id: "neck", label: "Шея", unit: "см" },
  { id: "shoulders", label: "Плечевой пояс", unit: "см" },
  { id: "chest", label: "Грудь", unit: "см" },
  { id: "biceps", label: "Бицепс", unit: "см" },
  { id: "forearm", label: "Предплечье", unit: "см" },
  { id: "wrist", label: "Запястье", unit: "см" },
  { id: "belly", label: "Живот", unit: "см" },
  { id: "pelvis", label: "Таз", unit: "см" },
  { id: "thigh", label: "Бедро", unit: "см" },
  { id: "calf", label: "Икра", unit: "см" },
  { id: "ankle", label: "Щиколотка", unit: "см" }
];

const harnessLatestMeasurement = {
  date: "2026-06-22T12:00:00.000Z",
  weight: 88.8,
  neck: 39,
  shoulders: 121,
  chest: 108,
  biceps: 39,
  forearm: 31,
  wrist: 18,
  belly: 91,
  pelvis: 102,
  thigh: 61,
  calf: 39,
  ankle: 24
};

const harnessWizardMeasurementFields = getProfileMeasurementFields("recomp");
const harnessMeasurementDraftSeed = harnessWizardMeasurementFields.reduce((draft, field) => ({
  ...draft,
  [field.id]: String(harnessLatestMeasurement[field.id] ?? "")
}), {
  note: "Утром, до завтрака"
});

function getHarnessMeasurementStep(state) {
  if (state === "review") return harnessWizardMeasurementFields.length + 1;
  if (state === "measurement") return 1;
  return 0;
}

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
    title: "Загрузить фото прогресса",
    dueDate: "2026-06-30",
    target: "progressPhotos",
    status: "progress"
  },
  {
    id: "client_harness_task_2",
    title: "Выполнить ближайшую тренировку",
    dueDate: "",
    target: "workouts",
    status: "progress"
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

function HarnessCabinetActions({
  onOpenPhotos,
  onOpenWeight,
  onOpenNutrition,
  onOpenJournal,
  onOpenSettings,
  onOpenWorkoutMode
}) {
  return (
    <ProfileCabinetActionGrid
      showClientOnlyActions
      latestPhotoText="Последние: 22.06.2026"
      latestMeasurementText="22.06.2026"
      weightText="Пора взвеситься"
      nutritionText="2409 ккал · Рекомпозиция"
      historyText="4 тренировки сохранено"
      onOpenBodyControl={onOpenPhotos}
      onOpenWeight={onOpenWeight}
      onOpenNutrition={onOpenNutrition}
      onOpenCalendar={onOpenJournal}
      onOpenAccount={onOpenSettings}
      onOpenQuestionnaire={() => {}}
      onOpenWorkoutMode={onOpenWorkoutMode}
      onOpenNotifications={() => {}}
      onOpenFeedback={() => {}}
      onLogout={() => {}}
    />
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
  const workoutHistoryHarnessState = harnessParams?.get("clientHistoryState") || "";
  const harnessPageParam = harnessParams?.get("clientHarnessPage") || "";
  const harnessRunStageParam = harnessParams?.get("clientWorkoutRunStage") || "exercise";
  const harnessRunIsBasicWorkout = harnessParams?.get("clientWorkoutRunMode") === "basic";
  // The harness must reproduce production's migration behavior for old
  // deep links instead of rendering the retired theme directly.
  const harnessThemeParam = normalizeAppTheme(harnessParams?.get("clientHarnessTheme"));
  const telegramHarnessConnected = harnessParams?.get("clientTelegramState") !== "disconnected";
  const workoutDialogParam = harnessParams?.get("clientWorkoutDialog") || "draft";
  const firstSetupStepValue = Number(harnessParams?.get("clientFirstSetupStep") || 1);
  const firstSetupStepParam = Number.isFinite(firstSetupStepValue)
    ? Math.min(9, Math.max(0, firstSetupStepValue))
    : 1;
  const nutritionPhotoNotFoundParam = harnessParams?.get("clientNutritionPhotoNotFound") === "1";
  const nutritionPhotoAnalyzingParam = harnessParams?.get("clientNutritionPhotoAnalyzing") === "1";
  const nutritionPhotoPreviewAnalyzing = harnessParams?.get("clientPhotoPreviewState") === "analyzing";
  const nutritionBarcodeParam = harnessParams?.get("clientNutritionBarcode") === "1";
  const progressPhotosTabbed = harnessParams?.get("clientPhotosTabbed") === "1";
  const progressPhotosState = harnessParams?.get("clientPhotosState") || "default";
  const measurementsTabbed = harnessParams?.get("clientMeasurementsTabbed") === "1";
  const measurementsState = harnessParams?.get("clientMeasurementsState") || "default";
  const measurementSnapshotState = harnessParams?.get("clientMeasurementSnapshotState") || "trend";
  const weightCheckInDue = harnessParams?.get("clientWeightCheckInDue") === "1";
  const measurementWizardState = harnessParams?.get("clientMeasurementStep") || "intro";
  const visibleHarnessWorkouts = workoutHarnessState === "empty" ? [] : harnessWorkouts;
  const visibleHarnessWorkoutHistory = workoutHarnessState === "completed"
    ? harnessHistory.map((item) => ({
        ...item,
        assignedProgramUpdatedAt: "2026-06-18T10:00:00.000Z"
      }))
    : harnessHistory;
  const visibleHarnessTrainerTasks = harnessParams?.get("clientNotificationState") === "empty"
    ? []
    : harnessTrainerTasks;

  useEffect(() => {
    const previousHtmlTheme = document.documentElement.dataset.appTheme;
    const previousBodyTheme = document.body.dataset.appTheme;

    document.documentElement.dataset.appTheme = harnessThemeParam;
    document.body.dataset.appTheme = harnessThemeParam;

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
  }, [harnessThemeParam]);

  const [page, setPage] = useState(
    nutritionPhotoNotFoundParam || nutritionPhotoAnalyzingParam || nutritionBarcodeParam || harnessPageParam === "nutritionMealModal"
      ? "nutrition"
      : harnessPageParam === "aiCoach"
        ? "aiCoach"
        : harnessPageParam === "firstSetup"
          ? "firstSetup"
        : harnessPageParam === "workoutDialogs"
          ? "workoutDialogs"
        : harnessPageParam === "workoutPlan"
          ? "workoutPlan"
        : harnessPageParam === "workoutHistory"
          ? "workoutHistory"
        : harnessPageParam === "workoutMode"
          ? "workoutMode"
        : harnessPageParam === "basicQuiz"
          ? "basicQuiz"
        : harnessPageParam === "exerciseVideo"
          ? "exerciseVideo"
        : harnessPageParam === "basicExerciseExplainer"
          ? "basicExerciseExplainer"
        : harnessPageParam === "exerciseSets"
          ? "exerciseSets"
        : harnessPageParam === "workoutRunOverlays"
          ? "workoutRunOverlays"
        : harnessPageParam === "workoutRunStage"
          ? "workoutRunStage"
        : "main"
  );
  const [firstSetupStep, setFirstSetupStep] = useState(firstSetupStepParam);
  const [harnessDeleteConfirmOpen, setHarnessDeleteConfirmOpen] = useState(
    harnessPageParam === "nutritionDeleteConfirm"
  );
  const [harnessUndoToastOpen, setHarnessUndoToastOpen] = useState(
    harnessPageParam === "nutritionUndoToast"
  );
  const [harnessSearchHistorySelection, setHarnessSearchHistorySelection] = useState("");
  const [harnessPhotoPreviewVisible, setHarnessPhotoPreviewVisible] = useState(
    harnessPageParam === "nutritionPhotoPreview"
  );
  const [harnessPhotoCandidateId, setHarnessPhotoCandidateId] = useState("");
  const [harnessAvatarCropOpen, setHarnessAvatarCropOpen] = useState(
    harnessPageParam === "avatarCrop"
  );
  const [harnessAvatarCropZoom, setHarnessAvatarCropZoom] = useState(1);
  const harnessAvatarCropImageRef = useRef(null);
  const [harnessMeasurementWizardStep, setHarnessMeasurementWizardStep] = useState(
    () => getHarnessMeasurementStep(measurementWizardState)
  );
  const [harnessMeasurementDraft, setHarnessMeasurementDraft] = useState(
    () => ({ ...harnessMeasurementDraftSeed })
  );
  const [harnessMeasurementStatus, setHarnessMeasurementStatus] = useState("");
  const [harnessQuickWeightOpen, setHarnessQuickWeightOpen] = useState(false);
  const [harnessQuickWeightSaving, setHarnessQuickWeightSaving] = useState(false);
  const [workoutHistoryOpenId, setWorkoutHistoryOpenId] = useState(
    workoutHistoryHarnessState === "expanded" ? harnessWorkoutHistory[0].id : null
  );
  const [workoutHistoryDeleteCandidate, setWorkoutHistoryDeleteCandidate] = useState(
    workoutHistoryHarnessState === "delete" ? harnessWorkoutHistory[0] : null
  );
  const [harnessBasicWorkoutQuiz, setHarnessBasicWorkoutQuiz] = useState({
    goal: "muscle",
    level: "middle",
    days: "4",
    twoDayStructure: "recovery_split"
  });
  const harnessRunDeckRef = useRef(null);
  const harnessRunInlineVideoTimerRef = useRef(null);
  const [harnessRunWorkout, setHarnessRunWorkout] = useState(() => structuredClone(harnessRunWorkoutSeed));
  const [harnessRunExerciseIndex, setHarnessRunExerciseIndex] = useState(() => (
    harnessRunStageParam === "warmup"
      ? 0
      : harnessRunStageParam === "finish" || harnessRunStageParam === "saved"
        ? harnessRunWorkoutSeed.exercises.length + 1
        : 1
  ));
  const [harnessRunExerciseHistoryOpenId, setHarnessRunExerciseHistoryOpenId] = useState(
    harnessParams?.get("clientWorkoutRunHistory") === "1" ? harnessRunWorkoutSeed.exercises[0].id : ""
  );
  const [harnessRunExerciseNoteOpenId, setHarnessRunExerciseNoteOpenId] = useState(
    harnessParams?.get("clientWorkoutRunModal") === "note" ? harnessRunWorkoutSeed.exercises[0].id : ""
  );
  const [harnessRunExerciseTechniqueOpenId, setHarnessRunExerciseTechniqueOpenId] = useState(
    harnessParams?.get("clientWorkoutRunModal") === "technique" ? harnessRunWorkoutSeed.exercises[0].id : ""
  );
  const [harnessRunWarmupCompletedSteps, setHarnessRunWarmupCompletedSteps] = useState([0]);
  const [harnessRunWarmupTimerDuration, setHarnessRunWarmupTimerDuration] = useState(180);
  const [harnessRunWarmupTimerRunning, setHarnessRunWarmupTimerRunning] = useState(false);
  const [harnessRunWarmupTimerSeconds, setHarnessRunWarmupTimerSeconds] = useState(180);
  const [harnessRunRestTimerRunning, setHarnessRunRestTimerRunning] = useState(true);
  const [harnessRunRestTimerSeconds, setHarnessRunRestTimerSeconds] = useState(119);
  const [harnessRunClientComment, setHarnessRunClientComment] = useState("");
  const [harnessRunSaved, setHarnessRunSaved] = useState(harnessRunStageParam === "saved");
  const [harnessRunSavedCard, setHarnessRunSavedCard] = useState(harnessRunStageParam === "saved");
  const [harnessExerciseSets, setHarnessExerciseSets] = useState(() => [
    ...(harnessParams?.get("clientExerciseSetsState") === "timed"
      ? Array.from({ length: 3 }, () => ({
          reps: "",
          weight: "",
          durationSeconds: 30,
          enteredReps: "",
          enteredWeight: "",
          completed: false
        }))
      : [
          { reps: "10", weight: "60", enteredReps: "", enteredWeight: "", completed: harnessParams?.get("clientExerciseSetsState") === "completed" },
          { reps: "10", weight: "62.5", enteredReps: "", enteredWeight: "", completed: false },
          { reps: "8", weight: "65", enteredReps: "", enteredWeight: "", completed: false }
        ])
  ]);
  const [harnessDishIngredients, setHarnessDishIngredients] = useState([
    {
      id: "harness_dish_chicken",
      name: "Куриная грудка",
      icon: "🍗",
      grams: 180,
      baseCalories: 165,
      baseAmount: 100
    },
    {
      id: "harness_dish_rice",
      name: "Рис басмати",
      icon: "🍚",
      grams: 120,
      baseCalories: 130,
      baseAmount: 100
    }
  ]);
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
  const [nutritionPickerOpen, setNutritionPickerOpen] = useState(
    nutritionPhotoNotFoundParam || nutritionPhotoAnalyzingParam || nutritionBarcodeParam
  );
  const [nutritionCalendarOpen, setNutritionCalendarOpen] = useState(false);
  const [nutritionCalendarMonthKey, setNutritionCalendarMonthKey] = useState(HARNESS_DATE.slice(0, 7));
  const [expandedNutritionMeals, setExpandedNutritionMeals] = useState(
    harnessPageParam === "nutritionMealModal" ? { breakfast: true } : {}
  );
  const [nutritionZoukExpanded, setNutritionZoukExpanded] = useState(false);
  const [nutritionVoiceMode, setNutritionVoiceMode] = useState(false);
  const [nutritionVoiceRecording, setNutritionVoiceRecording] = useState(false);
  const [nutritionVoiceFeedback, setNutritionVoiceFeedback] = useState("");
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
  const [individualWorkoutIndexInitialized, setIndividualWorkoutIndexInitialized] = useState(
    () => workoutHarnessState === "completed"
  );
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = useState(false);
  const [cabinetWorkoutModeOpen, setCabinetWorkoutModeOpen] = useState(false);
  const [workoutReadinessPending, setWorkoutReadinessPending] = useState(null);
  const [cabinetWorkoutJournalOpen, setCabinetWorkoutJournalOpen] = useState(
    () => cabinetModalParam === "calendar" || cabinetModalParam === "history"
  );
  const [cabinetWorkoutJournalTab, setCabinetWorkoutJournalTab] = useState(
    () => cabinetModalParam === "history" ? "history" : "calendar"
  );
  const [cabinetWorkoutHistoryItemOpen, setCabinetWorkoutHistoryItemOpen] = useState("client_harness_history_1");
  const [cabinetMeasurementsOpen, setCabinetMeasurementsOpen] = useState(
    () => cabinetModalParam === "measurements"
  );
  const [cabinetNutritionOpen, setCabinetNutritionOpen] = useState(
    () => cabinetModalParam === "nutrition"
  );
  const [cabinetNutritionGoal, setCabinetNutritionGoal] = useState("recomp");
  const [cabinetPhotosOpen, setCabinetPhotosOpen] = useState(
    () => cabinetModalParam === "photos"
  );
  const [cabinetSettingsOpen, setCabinetSettingsOpen] = useState(
    () => cabinetModalParam === "settings"
  );
  const [profilePasswordModalOpen, setProfilePasswordModalOpen] = useState(false);
  const [profileEmailModalOpen, setProfileEmailModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(
    () => cabinetModalParam === "telegram"
  );
  const [harnessWarmLightTheme, setHarnessWarmLightTheme] = useState(true);
  const [trainerNotificationsOpen, setTrainerNotificationsOpen] = useState(
    () => cabinetModalParam === "notifications"
  );
  const [cabinetCalendarEditing, setCabinetCalendarEditing] = useState(false);
  const [cabinetCalendarSelectedDate, setCabinetCalendarSelectedDate] = useState("2026-06-05");
  const nutritionPhotoInputRef = useRef(null);
  const telegramLoginContainerRef = useRef(null);
  const nutritionFoodSwipeMoved = useRef(false);
  const cabinetWorkoutHistoryItemRefs = useRef(new Map());
  const dishIdCounterRef = useRef(0);

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
    dishIdCounterRef.current += 1;
    const dishId = `harness_dish_${dishIdCounterRef.current}`;
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

  function renderHarnessChrome(activeTab, title, children, afterSection = null) {
    return (
      <ProfileDashboardShell mode={activeTab} testId={`client-harness-${activeTab}`}>
        {(activeTab === "main" || activeTab === "cabinet") && (
          <ProfilePageChrome
            isMainDashboard={activeTab === "main"}
            renderBottomBar={renderBottomBar}
            showTrainerNotifications
            trainerNotificationCount={0}
            onOpenTrainerNotifications={() => {}}
          />
        )}
        {activeTab === "cabinet" ? (
          <ProfileCabinetTitleRow onRefresh={() => {}} />
        ) : activeTab !== "main" ? (
          <ProfileHarnessTitle>{title}</ProfileHarnessTitle>
        ) : null}
        <ProfileDashboardContent mode={activeTab}>
          {children}
          {activeTab === "main" && APP_VERSION ? (
            <ProfileDashboardVersion>{APP_VERSION}</ProfileDashboardVersion>
          ) : null}
        </ProfileDashboardContent>
        {afterSection}
        {activeTab !== "main" && activeTab !== "cabinet"
          ? renderBottomBar(activeTab)
          : null}
      </ProfileDashboardShell>
    );
  }

  if (harnessPageParam === "measurementWizard") {
    return (
      <main data-testid="client-harness-measurement-wizard">
        <MeasurementWizardPage
          aiNutritionProfile={{ goal: "recomp" }}
          aiNutritionProfileDraft={{}}
          profileMeasurements={[harnessLatestMeasurement]}
          profileMeasurementWizardStep={harnessMeasurementWizardStep}
          profileMeasurementDraft={harnessMeasurementDraft}
          profileMeasurementStatus={harnessMeasurementStatus}
          profileMeasurementSaving={false}
          setProfileMeasurementDraft={setHarnessMeasurementDraft}
          setProfileMeasurementStatus={setHarnessMeasurementStatus}
          setProfileMeasurementWizardStep={setHarnessMeasurementWizardStep}
          setProfileMeasurementOpen={() => {}}
          setProfileActiveTab={() => {}}
          profileMeasurementReturnTab="measurements"
          saveProfileMeasurement={() => setHarnessMeasurementStatus("Замер сохранён")}
          onNavigateProfilePage={() => {}}
        />
      </main>
    );
  }

  if (harnessPageParam === "measurementPanel") {
    return (
      <main data-testid="client-harness-measurement-panel">
        <ProfileDashboardShell mode="measurements">
          <ProfileDashboardContent mode="measurements">
            <ProfileMeasurementWizardPanel
              visible
              latestMeasurement={harnessLatestMeasurement}
              measurementFields={harnessWizardMeasurementFields}
              formatMeasurementDate={(measurement) => new Date(measurement.date).toLocaleDateString("ru-RU")}
              getMeasurementValue={(measurement, field) => String(measurement?.[field.id] ?? "—")}
              onStart={() => {}}
            />
          </ProfileDashboardContent>
          {renderBottomBar("cabinet")}
        </ProfileDashboardShell>
      </main>
    );
  }

  if (harnessPageParam === "profileRoleActions") {
    return (
      <main data-testid="client-harness-profile-role-actions">
        {renderHarnessChrome("main", "Главное меню", (
          <p>Проверка переходов для расширенных ролей.</p>
        ), (
          <ProfileMainRoleActions
            showTrainer
            showAdmin
            onOpenTrainer={() => {}}
            onOpenAdmin={() => {}}
          />
        ))}
      </main>
    );
  }

  if (harnessPageParam === "profileSettingsTab") {
    return (
      <main data-testid="client-harness-profile-settings-tab">
        <ProfileDashboardShell mode="settings">
          <ProfileSettingsTab
            visible
            bodyMetricsOpen={false}
            draft={aiNutritionProfileDraft}
            isWarmLightTheme={harnessThemeParam === "warm-light"}
            email="ilya@example.com"
            telegramProfile={{
              connected: true,
              username: "harness_coach",
              displayName: "Harness Athlete",
              avatarUrl: ""
            }}
            onToggleBodyMetrics={() => {}}
            onDraftChange={() => {}}
            onSaveBodyMetrics={() => {}}
            onToggleTheme={() => {}}
            onOpenEmail={() => {}}
            onOpenTelegram={() => {}}
            onTelegramAvatarError={() => {}}
          />
          {renderBottomBar("cabinet")}
        </ProfileDashboardShell>
      </main>
    );
  }

  if (harnessPageParam === "nutritionDeleteConfirm") {
    return (
      <main data-testid="client-harness-nutrition-delete-confirm">
        {renderHarnessChrome("nutrition", "Питание", (
          <p>Проверка подтверждения удаления продукта из моей базы.</p>
        ))}
        <NutritionDeleteConfirmModal
          open={harnessDeleteConfirmOpen}
          foodName="Harness Oat Bar"
          onCancel={() => setHarnessDeleteConfirmOpen(false)}
          onConfirm={() => setHarnessDeleteConfirmOpen(false)}
        />
      </main>
    );
  }

  if (harnessPageParam === "avatarCrop") {
    return (
      <main data-testid="client-harness-avatar-crop">
        <ProfileAvatarCropModal
          open={harnessAvatarCropOpen}
          imageRef={harnessAvatarCropImageRef}
          source="/workout-covers/chest.webp"
          size={{ width: 1200, height: 800 }}
          zoom={harnessAvatarCropZoom}
          offset={{ x: 0, y: 0 }}
          onClose={() => setHarnessAvatarCropOpen(false)}
          onImageLoad={() => {}}
          onPointerDown={() => {}}
          onPointerMove={() => {}}
          onPointerUp={() => {}}
          onPointerCancel={() => {}}
          onZoomChange={(value) => setHarnessAvatarCropZoom(Number(value))}
          onApply={() => setHarnessAvatarCropOpen(false)}
        />
      </main>
    );
  }

  if (harnessPageParam === "nutritionSearchHistory") {
    return (
      <main data-testid="client-harness-nutrition-search-history">
        <FoodSearchSurface>
          <FoodSearchHistoryNames
            visible
            foods={[
              ...harnessSearchFoods,
              ...Object.values(harnessMyFoods)
            ]}
            onSelect={setHarnessSearchHistorySelection}
          />
        </FoodSearchSurface>
        <output hidden data-testid="food-search-history-selection">
          {harnessSearchHistorySelection}
        </output>
      </main>
    );
  }

  if (harnessPageParam === "nutritionDishIngredients") {
    return (
      <main data-testid="client-harness-nutrition-dish-ingredients">
        <section data-testid="client-harness-dish-ingredients-module">
          <DishEditIngredientsBox
                selectedFood={{
                  id: "harness_dish",
                  type: "dish",
                  name: "Боул с курицей",
                  ingredients: harnessDishIngredients
                }}
                getFoodIcon={() => "🍽️"}
                onOpenIngredientPicker={() => {
                  setHarnessDishIngredients((current) => (
                    current.some((ingredient) => ingredient.id === "harness_dish_avocado")
                      ? current
                      : [
                        ...current,
                        {
                          id: "harness_dish_avocado",
                          name: "Авокадо",
                          icon: "🥑",
                          grams: 70,
                          baseCalories: 160,
                          baseAmount: 100
                        }
                      ]
                  ));
                }}
                onRemoveIngredient={(ingredientId) => {
                  setHarnessDishIngredients((current) => (
                    current.filter((ingredient) => ingredient.id !== ingredientId)
                  ));
                }}
          />
        </section>
      </main>
    );
  }

  if (harnessPageParam === "nutritionPhotoPreview") {
    return (
      <main data-testid="client-harness-nutrition-photo-preview">
        <FoodSearchSurface>
          {harnessPhotoPreviewVisible && (
            <NutritionPhotoAiPreview
              preview="/workout-covers/chest.webp"
              analyzing={nutritionPhotoPreviewAnalyzing}
              confidence={nutritionPhotoPreviewAnalyzing ? "" : "92%"}
              result="ИИ распознал: Куриная грудка"
              selectedFood={null}
              candidates={[
                { id: "harness_chicken", name: "Куриная грудка", icon: "🍗" },
                { id: "harness_turkey", name: "Филе индейки", icon: "🥩" },
                { id: "harness_fish", name: "Белая рыба", icon: "🐟" }
              ]}
              onSelectCandidate={(candidate) => setHarnessPhotoCandidateId(candidate.id)}
              onReset={() => setHarnessPhotoPreviewVisible(false)}
            />
          )}
        </FoodSearchSurface>
        <output hidden data-testid="nutrition-photo-candidate-selection">
          {harnessPhotoCandidateId}
        </output>
      </main>
    );
  }

  if (harnessPageParam === "nutritionUndoToast") {
    return (
      <main data-testid="client-harness-nutrition-undo-toast">
        {renderHarnessChrome("nutrition", "Питание", (
          <p>Проверка восстановления удалённого продукта.</p>
        ))}
        <NutritionUndoDeleteToast
          open={harnessUndoToastOpen}
          onRestore={() => setHarnessUndoToastOpen(false)}
        />
      </main>
    );
  }

  if (page === "workoutPlan") {
    return (
      <main data-testid="client-harness-workout-plan">
        <WorkoutPlanPage
          plan={{
            workouts: visibleHarnessWorkouts,
            assignedProgramId: "client_harness_program",
            assignedProgramName: "Тестовая программа",
            assignedProgramUpdatedAt: "2026-06-18T10:00:00.000Z"
          }}
          history={visibleHarnessWorkoutHistory}
          user={{ assignedProgramName: "Тестовая программа" }}
          onGoBackToMain={() => setPage("main")}
          onOpenWorkoutIndex={() => setPage("workouts")}
          onOpenWorkouts={() => setPage("workouts")}
          onOpenPlan={() => setPage("workoutPlan")}
          onOpenHistory={() => setPage("cabinet")}
          getCompletedWorkoutSet={(items) => new Set(items.map((item) => item.workoutId))}
          isWorkoutCompletedByHistory={(workout, completedSet) => completedSet.has(workout.id)}
        />
      </main>
    );
  }

  if (page === "workoutHistory") {
    const visibleHistory = workoutHistoryHarnessState === "empty" ? [] : harnessWorkoutHistory;

    return (
      <main data-testid="client-harness-workout-history">
        <WorkoutHistoryPage
          canUseTrainerFeatures={false}
          renderClientMainBottomBar={renderBottomBar}
          history={visibleHistory}
          historyLoading={workoutHistoryHarnessState === "loading"}
          openHistoryKey={workoutHistoryOpenId}
          historySwipeId={workoutHistoryHarnessState === "swiped" ? harnessWorkoutHistory[0].id : ""}
          historyDeletingId={workoutHistoryHarnessState === "deleting" ? harnessWorkoutHistory[0].id : ""}
          historyDeleteCandidate={workoutHistoryDeleteCandidate}
          goBackToMain={() => setPage("main")}
          openTrainingEntry={() => setPage("workouts")}
          onOpenNutrition={() => setPage("nutrition")}
          openProfileCabinet={() => setPage("cabinet")}
          onOpenTrainerClients={() => {}}
          onOpenTrainerPrograms={() => {}}
          loadHistory={() => {}}
          handleHistoryTouchStart={() => {}}
          handleHistoryTouchEnd={() => {}}
          requestDeleteOwnHistoryWorkout={setWorkoutHistoryDeleteCandidate}
          setOpenHistoryKey={setWorkoutHistoryOpenId}
          closeHistoryDeleteConfirm={() => setWorkoutHistoryDeleteCandidate(null)}
          confirmDeleteOwnHistoryWorkout={() => setWorkoutHistoryDeleteCandidate(null)}
        />
      </main>
    );
  }

  if (page === "basicQuiz") {
    return (
      <main data-testid="client-harness-basic-quiz">
        <BasicWorkoutQuizPage
          renderClientMainBottomBar={renderBottomBar}
          basicWorkoutQuiz={harnessBasicWorkoutQuiz}
          startingWeightProfile={{ weight: "80", height: "178", age: "30", activity: "medium", goal: "recomp" }}
          workoutHistory={harnessWorkoutHistory}
          onBasicWorkoutQuizChange={setHarnessBasicWorkoutQuiz}
          onApplyBasicWorkoutPlan={() => setPage("workouts")}
          canUseTrainerFeatures={false}
          onGoMain={() => setPage("main")}
          onOpenTraining={() => setPage("workouts")}
          onOpenNutrition={() => setPage("nutrition")}
          onOpenCabinet={() => setPage("cabinet")}
          onOpenTrainerClients={() => {}}
          onOpenTrainerPrograms={() => {}}
          onLoadTrainerCabinet={() => setPage("cabinet")}
        />
      </main>
    );
  }

  if (page === "workoutMode") {
    return (
      <main data-testid="client-harness-workout-mode">
        <WorkoutModePage
          renderClientMainBottomBar={renderBottomBar}
          canUseTrainerFeatures={false}
          onBackToMain={() => setPage("main")}
          onOpenBasicWorkouts={() => setPage("workouts")}
          onOpenIndividualWorkouts={() => setPage("workouts")}
          onOpenTraining={() => setPage("workouts")}
          onOpenNutrition={() => setPage("nutrition")}
          onOpenCabinet={() => setPage("cabinet")}
          onOpenTrainerClients={() => {}}
          onOpenTrainerPrograms={() => {}}
          onLoadTrainerCabinet={() => setPage("cabinet")}
        />
      </main>
    );
  }

  if (page === "workoutRunStage") {
    const updateHarnessRunSet = (exerciseId, setIndex, field, value) => {
      setHarnessRunWorkout((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) => (
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set, index) => (
                  index === setIndex ? { ...set, [field]: value } : set
                ))
              }
            : exercise
        ))
      }));
    };
    const toggleHarnessRunSet = (exerciseId, setIndex) => {
      setHarnessRunWorkout((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) => (
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set, index) => (
                  index === setIndex ? { ...set, completed: !set.completed } : set
                ))
              }
            : exercise
        ))
      }));
      setHarnessRunRestTimerSeconds(119);
      setHarnessRunRestTimerRunning(true);
      return true;
    };
    const updateHarnessRunNote = (exerciseId, value) => {
      setHarnessRunWorkout((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) => (
          exercise.id === exerciseId ? { ...exercise, clientNote: value } : exercise
        ))
      }));
    };
    const replaceHarnessRunExercise = (exerciseId, alternative) => {
      const { plan: nextPlan, replacement } = replaceBasicWorkoutExerciseInPlan(
        { source: "basic", workouts: [harnessRunWorkout] },
        harnessRunWorkout.id,
        exerciseId,
        alternative
      );

      if (!replacement) return false;

      setHarnessRunWorkout(nextPlan.workouts[0]);
      return true;
    };
    const noHeader = !harnessRunSaved;

    return (
      <main data-testid="client-harness-workout-run-stage">
        <WorkoutRunPageShell noHeader={noHeader}>
          <WorkoutRunTopControls
            isSaving={false}
            showBackButton={harnessRunSaved}
            onExit={() => setPage("main")}
            onBack={() => setPage("main")}
          />
          <WorkoutRunStageView
            closeWorkoutExerciseModal={(setter) => setter("")}
            currentExerciseIndex={harnessRunExerciseIndex}
            deckRef={harnessRunDeckRef}
            exerciseHistoryOpenId={harnessRunExerciseHistoryOpenId}
            exerciseNoteOpenId={harnessRunExerciseNoteOpenId}
            exerciseTechniqueOpenId={harnessRunExerciseTechniqueOpenId}
            endPerformanceCheck={() => {}}
            getLastExerciseText={() => "Предыдущий результат: 10 × 60 кг"}
            goBackToMain={() => setPage("main")}
            goToNextExercise={() => setHarnessRunExerciseIndex((current) => Math.min(harnessRunWorkout.exercises.length + 1, current + 1))}
            goToPreviousExercise={() => setHarnessRunExerciseIndex((current) => Math.max(0, current - 1))}
            handleExerciseTouchEnd={() => {}}
            handleExerciseTouchMove={() => {}}
            handleExerciseTouchStart={() => {}}
            history={harnessWorkoutHistory}
            inlinePlayingVideoId=""
            inlineVideoControlsTimerRef={harnessRunInlineVideoTimerRef}
            inlineVideoControlsVisible
            isSaving={false}
            isWorkoutSaved={harnessRunSaved}
            lastExerciseResults={[]}
            normalizeExercise={(exercise) => exercise}
            openVideoId={null}
            openWorkoutExerciseModal={(setter, exerciseId) => setter(exerciseId)}
            plan={{
              source: harnessRunIsBasicWorkout ? "basic" : undefined,
              workouts: [harnessRunWorkout]
            }}
            postWorkoutFeedback={{ advice: "Отличная работа" }}
            requestLeaveWorkout={() => setPage("main")}
            replaceBasicWorkoutExercise={
              harnessRunIsBasicWorkout ? replaceHarnessRunExercise : undefined
            }
            restTimerDuration={119}
            restTimerRunning={harnessRunRestTimerRunning}
            restTimerSeconds={harnessRunRestTimerSeconds}
            saveWorkoutToFirebase={() => {
              setHarnessRunSaved(true);
              setHarnessRunSavedCard(true);
            }}
            setExerciseHistoryOpenId={setHarnessRunExerciseHistoryOpenId}
            setExerciseNoteOpenId={setHarnessRunExerciseNoteOpenId}
            setExerciseTechniqueOpenId={setHarnessRunExerciseTechniqueOpenId}
            setFullscreenVideo={() => {}}
            setInlinePlayingVideoId={() => {}}
            setInlineVideoControlsVisible={() => {}}
            setIsWorkoutSaved={setHarnessRunSaved}
            setOpenVideoId={() => {}}
            setPostWorkoutFeedbackOpen={() => {}}
            setRestTimerRunning={setHarnessRunRestTimerRunning}
            setRestTimerSeconds={setHarnessRunRestTimerSeconds}
            setShowWorkoutSavedCard={setHarnessRunSavedCard}
            setVideoLoadingId={() => {}}
            setVideoRetryToken={() => {}}
            setWarmupTimerRunning={setHarnessRunWarmupTimerRunning}
            setWarmupTimerSeconds={setHarnessRunWarmupTimerSeconds}
            setWarmupTimerPreset={(seconds) => {
              setHarnessRunWarmupTimerDuration(seconds);
              setHarnessRunWarmupTimerSeconds(seconds);
              setHarnessRunWarmupTimerRunning(false);
            }}
            setWorkoutClientComment={setHarnessRunClientComment}
            showAppError={() => {}}
            showInlineVideoControlsTemporarily={() => {}}
            showWorkoutSavedCard={harnessRunSavedCard}
            startPerformanceCheck={() => {}}
            startRestTimer={(seconds = 119) => {
              setHarnessRunRestTimerSeconds(seconds);
              setHarnessRunRestTimerRunning(true);
            }}
            swipeDirection=""
            swipeOffset={0}
            toggleWarmupStep={(stepIndex) => {
              setHarnessRunWarmupCompletedSteps((current) => (
                current.includes(stepIndex)
                  ? current.filter((index) => index !== stepIndex)
                  : [...current, stepIndex]
              ));
            }}
            toggleWorkoutSetCompleted={toggleHarnessRunSet}
            updateExerciseNote={updateHarnessRunNote}
            updateSet={updateHarnessRunSet}
            videoLoadingId=""
            videoRetryToken={0}
            warmupCompletedSteps={harnessRunWarmupCompletedSteps}
            warmupTimerDuration={harnessRunWarmupTimerDuration}
            warmupTimerRunning={harnessRunWarmupTimerRunning}
            warmupTimerSeconds={harnessRunWarmupTimerSeconds}
            workout={
              harnessRunIsBasicWorkout
                ? { ...harnessRunWorkout, source: "basic" }
                : harnessRunWorkout
            }
            workoutClientComment={harnessRunClientComment}
            workoutDurationText="42 мин"
            workoutFinishedAt={Date.parse("2026-06-22T18:42:00.000Z")}
            workoutHistorySyncState={harnessRunSaved ? "synced" : "local"}
            workoutReadiness={{ volumeText: "−10% объёма" }}
            workoutStarted
          />
        </WorkoutRunPageShell>
      </main>
    );
  }

  if (page === "workoutRunOverlays") {
    const overlayState = harnessParams?.get("clientWorkoutRunOverlayState") || "default";

    if (overlayState === "notFound") {
      return (
        <main data-testid="client-harness-workout-run-overlays">
          <WorkoutNotFoundPage onBackToMenu={() => setPage("main")} />
        </main>
      );
    }

    return (
      <main data-testid="client-harness-workout-run-overlays">
        <WorkoutRunPageShell noHeader={overlayState !== "saved"}>
          <WorkoutRunTopControls
            isSaving={false}
            showBackButton={overlayState === "saved"}
            onExit={() => setPage("main")}
            onBack={() => setPage("main")}
          />
          <WorkoutRunExercisePreview
            exercise={{ id: "harness_overlay_exercise", name: "Жим штанги лёжа" }}
            isFinishSlide={overlayState === "finish"}
            isWorkoutSaved={overlayState === "saved"}
          />
          <WorkoutFullscreenVideoOverlay
            videoSrc={overlayState === "fullscreen" ? "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4" : ""}
            onClose={() => setPage("main")}
            onVideoError={() => {}}
          />
        </WorkoutRunPageShell>
      </main>
    );
  }

  if (page === "exerciseVideo") {
    const videoState = harnessParams?.get("clientExerciseVideoState") || "paused";
    const exercise = {
      id: "client_harness_exercise_video",
      name: "Жим штанги лёжа",
      video: "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4",
      sets: []
    };

    return (
      <main data-testid="client-harness-exercise-video">
        <WorkoutRunPageShell noHeader>
          <WorkoutRunExercisePreview exercise={exercise} hasVideo videoOpen>
            <WorkoutExerciseVideoFrame
              exercise={exercise}
              exerciseVideoFailed={videoState === "fallback"}
              fallbackHint="Держите лопатки сведёнными и контролируйте амплитуду."
              inlinePlayingVideoId={videoState === "playing" ? exercise.id : ""}
              inlineVideoControlsVisible={videoState !== "hidden"}
              onFullscreenVideo={() => {}}
              onInlineVideoPlayFailed={() => {}}
              onRetryVideo={() => {}}
              onVideoCanPlay={() => {}}
              onVideoEnded={() => {}}
              onVideoError={() => {}}
              onVideoLoadedMetadata={() => {}}
              onVideoLoadStart={() => {}}
              onVideoPause={() => {}}
              onVideoPlay={() => {}}
              videoLoadingId={videoState === "loading" ? exercise.id : ""}
              videoRetryToken={0}
            />
            <WorkoutExerciseSupport
              exercise={exercise}
              exerciseAiWeightAdjustments={[]}
              exerciseHistoryOpenId=""
              lastExerciseText="Предыдущий результат: 10 × 60 кг"
              onOpenNote={() => {}}
              onToggleHistory={() => {}}
              readinessVolumeText=""
              showNoteButton={false}
            />
          </WorkoutRunExercisePreview>
        </WorkoutRunPageShell>
      </main>
    );
  }

  if (page === "basicExerciseExplainer") {
    const exercise = {
      id: "client_harness_basic_exercise_explainer",
      name: "Жим штанги лёжа",
      equipment: "Штанга",
      video: "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4",
      sets: []
    };

    return (
      <main data-testid="client-harness-basic-exercise-explainer">
        <WorkoutRunPageShell noHeader>
          <WorkoutRunExercisePreview exercise={exercise} hasVideo videoOpen>
            <BasicWorkoutExerciseExplainer exercise={exercise}>
              <WorkoutExerciseVideoFrame
                exercise={exercise}
                exerciseVideoFailed={false}
                fallbackHint="Держите лопатки сведёнными и контролируйте амплитуду."
                inlinePlayingVideoId=""
                inlineVideoControlsVisible
                onFullscreenVideo={() => {}}
                onInlineVideoPlayFailed={() => {}}
                onRetryVideo={() => {}}
                onVideoCanPlay={() => {}}
                onVideoEnded={() => {}}
                onVideoError={() => {}}
                onVideoLoadedMetadata={() => {}}
                onVideoLoadStart={() => {}}
                onVideoPause={() => {}}
                onVideoPlay={() => {}}
                videoLoadingId=""
                videoRetryToken={0}
              />
            </BasicWorkoutExerciseExplainer>
          </WorkoutRunExercisePreview>
        </WorkoutRunPageShell>
      </main>
    );
  }

  if (page === "exerciseSets") {
    const isTimedExercise = harnessParams?.get("clientExerciseSetsState") === "timed";
    const hasExternalWeight = harnessParams?.get("clientExerciseSetsState") !== "bodyweight" && !isTimedExercise;
    const exercise = {
      id: "client_harness_exercise_sets",
      name: isTimedExercise ? "Планка" : hasExternalWeight ? "Жим штанги лёжа" : "Отжимания",
      video: "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4",
      sets: harnessExerciseSets
    };

    return (
      <main data-testid="client-harness-exercise-sets">
        <WorkoutRunPageShell noHeader>
          <WorkoutRunExercisePreview exercise={exercise} hasVideo videoOpen>
            <WorkoutExerciseVideoFrame
              exercise={exercise}
              exerciseVideoFailed={false}
              fallbackHint="Держите лопатки сведёнными и контролируйте амплитуду."
              inlinePlayingVideoId=""
              inlineVideoControlsVisible
              onFullscreenVideo={() => {}}
              onInlineVideoPlayFailed={() => {}}
              onRetryVideo={() => {}}
              onVideoCanPlay={() => {}}
              onVideoEnded={() => {}}
              onVideoError={() => {}}
              onVideoLoadedMetadata={() => {}}
              onVideoLoadStart={() => {}}
              onVideoPause={() => {}}
              onVideoPlay={() => {}}
              videoLoadingId=""
              videoRetryToken={0}
            />
            <WorkoutExerciseSets
              exercise={exercise}
              hasExternalWeight={hasExternalWeight}
              onToggleSetCompleted={(_exerciseId, index) => {
                setHarnessExerciseSets((current) => current.map((set, setIndex) => (
                  setIndex === index ? { ...set, completed: !set.completed } : set
                )));
              }}
              onUpdateSet={(_exerciseId, index, field, value) => {
                setHarnessExerciseSets((current) => current.map((set, setIndex) => (
                  setIndex === index ? { ...set, [field]: value } : set
                )));
              }}
              sharedExerciseAiWeightAdjustment={harnessParams?.get("clientExerciseSetsAdjustment") === "1" ? "−5% от рабочего веса" : ""}
            />
          </WorkoutRunExercisePreview>
        </WorkoutRunPageShell>
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
          history={visibleHarnessWorkoutHistory}
          currentUserId="client_harness"
          workoutModePreference={{ mode: "individual" }}
          individualWorkoutIndex={individualWorkoutIndex}
          individualWorkoutIndexInitialized={individualWorkoutIndexInitialized}
          setIndividualWorkoutIndex={setIndividualWorkoutIndex}
          setIndividualWorkoutIndexInitialized={setIndividualWorkoutIndexInitialized}
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
        <WorkoutExitDialog
          open={workoutDialogParam === "exit"}
          onStay={() => {}}
          onLeave={() => {}}
        />
        <WorkoutIncompleteDialog
          open={workoutDialogParam === "incomplete"}
          completion={{ completedSets: 2, totalSets: 5 }}
          onContinue={() => {}}
          onSave={() => {}}
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
          barcodeScannerOpen: nutritionBarcodeParam,
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
          nutritionPhotoAnalyzing: nutritionPhotoAnalyzingParam,
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
          nutritionVoiceAnalyzing: false,
          nutritionVoiceAudioLevel: nutritionVoiceRecording ? 0.58 : 0,
          nutritionVoiceFeedback,
          nutritionVoiceMode,
          nutritionVoiceRecording,
          nutritionWeekDates,
          nutritionZoukExpanded,
          openDishIngredientPicker: () => setDishIngredientPickerOpen(true),
          openNutritionCalendar: () => setNutritionCalendarOpen(true),
          openNutritionEditPage: () => setNutritionEditPageOpen(true),
          openNutritionFoodEditor: (item) => {
            setExpandedNutritionMeals({});
            setSelectedNutritionFood(item);
            setEditingNutritionItemId(item.id);
            setNutritionAmount(String(item.amount || 100));
            setNutritionEditPageOpen(true);
            setNutritionPickerOpen(true);
          },
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
          startNutritionVoiceCapture: () => {
            setNutritionVoiceRecording(true);
            setNutritionVoiceFeedback("Говорите…");
          },
          stopNutritionVoiceCapture: ({ cancelled = false } = {}) => {
            setNutritionVoiceRecording(false);
            setNutritionVoiceFeedback(cancelled ? "" : "Тестовая запись завершена.");
          },
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
          toggleNutritionVoiceMode: () => {
            setNutritionVoiceMode((current) => !current);
            setNutritionVoiceRecording(false);
            setNutritionVoiceFeedback("");
          },
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
        <HarnessCabinetActions
          onOpenPhotos={() => setCabinetPhotosOpen(true)}
          onOpenWeight={() => setHarnessQuickWeightOpen(true)}
          onOpenNutrition={() => setCabinetNutritionOpen(true)}
          onOpenJournal={() => {
            setCabinetWorkoutJournalTab("calendar");
            setCabinetWorkoutJournalOpen(true);
          }}
          onOpenSettings={() => setCabinetSettingsOpen(true)}
          onOpenWorkoutMode={() => setCabinetWorkoutModeOpen(true)}
        />
        <WorkoutModePickerDialog
          open={cabinetWorkoutModeOpen}
          workoutModePreference={{ mode: "individual", remember: false }}
          onClose={() => setCabinetWorkoutModeOpen(false)}
          onOpenBasic={() => {
            setCabinetWorkoutModeOpen(false);
            setPage("basicQuiz");
          }}
          onOpenIndividual={() => {
            setCabinetWorkoutModeOpen(false);
            setPage("workouts");
          }}
        />
        {harnessQuickWeightOpen && (
          <ProfileQuickWeightModal
            open
            initialWeight=""
            saving={harnessQuickWeightSaving}
            onClose={() => setHarnessQuickWeightOpen(false)}
            onSuccessAcknowledged={() => setHarnessQuickWeightOpen(false)}
            onSave={async () => {
              setHarnessQuickWeightSaving(true);
              await Promise.resolve();
              setHarnessQuickWeightSaving(false);
              return true;
            }}
          />
        )}
        <ProfileMeasurementsModal
          open={cabinetMeasurementsOpen}
          latestMeasurement={measurementsState === "empty" ? null : harnessLatestMeasurement}
          measurementFields={measurementsState === "full" ? harnessFullMeasurementFields : harnessMeasurementFields}
          formatMeasurementDate={(measurement) => new Date(measurement.date).toLocaleDateString("ru-RU")}
          getMeasurementValue={(measurement, field) => `${measurement[field.id]} ${field.unit}`}
          onClose={() => setCabinetMeasurementsOpen(false)}
          onStart={() => {}}
          onOpenPhotos={measurementsTabbed ? () => {} : undefined}
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
        <ProfileWorkoutJournalModal
          open={cabinetWorkoutJournalOpen}
          activeTab={cabinetWorkoutJournalTab}
          modalBodyRef={null}
          onClose={() => setCabinetWorkoutJournalOpen(false)}
          onTabChange={setCabinetWorkoutJournalTab}
          calendarProps={{
            monthDate: new Date("2026-06-01T12:00:00"),
            monthKey: cabinetCalendarMonthKey,
            calendarDays: cabinetCalendarDays,
            selectedDate: cabinetCalendarSelectedDate,
            selectedItems: cabinetCalendarSelectedItems,
            scheduledDates: harnessWorkoutScheduledDates,
            draftDates: harnessWorkoutScheduledDates,
            editing: cabinetCalendarEditing,
            saving: false,
            status: "",
            getTimestampValue: (value) => value,
            onShiftMonth: () => {},
            onStartEdit: () => setCabinetCalendarEditing(true),
            onCancelEdit: () => setCabinetCalendarEditing(false),
            onSave: () => setCabinetCalendarEditing(false),
            onDayClick: (day) => setCabinetCalendarSelectedDate(day.key),
            onOpenHistory: (itemId) => {
              setCabinetWorkoutHistoryItemOpen(itemId || "client_harness_history_1");
              setCabinetWorkoutJournalTab("history");
            }
          }}
          historyProps={{
            programScope: {
              assignedProgramName: "Тестовая программа"
            },
            loading: false,
            items: cabinetHistoryItems,
            openItemId: cabinetWorkoutHistoryItemOpen,
            itemRefs: cabinetWorkoutHistoryItemRefs,
            deletingId: "",
            getTimestampValue: (value) => value,
            onToggleItem: (itemId) => setCabinetWorkoutHistoryItemOpen((current) => current === itemId ? "" : itemId),
            onRequestDelete: () => {}
          }}
        />
        <ProfileProgressPhotosModal
          open={cabinetPhotosOpen}
          uploading={progressPhotosState === "uploading"}
          latestPhoto={harnessProgressPhotos[0]}
          photos={harnessProgressPhotos}
          files={progressPhotosState === "selected" ? { front: { name: "front.jpg" } } : {}}
          previews={progressPhotosState === "selected" ? { front: harnessProgressPhotos[0].frontUrl } : {}}
          status={progressPhotosState === "selected" ? "Фотографии сохранены" : ""}
          compareIds={[harnessProgressPhotos[1].id, harnessProgressPhotos[0].id]}
          compareViews={harnessProgressPhotoCompareViews}
          compareView="front"
          activeCompareView={harnessProgressPhotoCompareViews[0]}
          selectedBefore={harnessProgressPhotos[1]}
          selectedAfter={harnessProgressPhotos[0]}
          canSave={progressPhotosState === "selected"}
          formatPhotoDate={(photo) => photo?.date || ""}
          onClose={() => setCabinetPhotosOpen(false)}
          onOpenMeasurements={progressPhotosTabbed ? () => {} : undefined}
          onSelectPhoto={() => {}}
          onCompareIdsChange={() => {}}
          onCompareViewChange={() => {}}
          onSave={() => {}}
        />
        <ProfileSettingsModal
          open={cabinetSettingsOpen}
          section="account"
          onClose={() => setCabinetSettingsOpen(false)}
        >
          <ProfileAccountSettingsSection
            avatarPreview=""
            avatarUrl=""
            draft={{
              displayName: "ILYA",
              email: "ilya@gmail.com"
            }}
            status=""
            onAvatarFile={() => {}}
            onDraftChange={() => {}}
            onOpenPassword={() => setProfilePasswordModalOpen(true)}
            onSave={() => {}}
          />
          <ProfileAppSettingsSection
            variant="account"
            heading="Приложение"
            isWarmLightTheme={harnessWarmLightTheme}
            email="ilya@example.com"
            telegramProfile={{
              connected: telegramHarnessConnected,
              username: "harness_coach",
              displayName: "Harness Athlete",
              avatarUrl: ""
            }}
            onToggleTheme={() => setHarnessWarmLightTheme((current) => !current)}
            onOpenEmail={() => setProfileEmailModalOpen(true)}
            onOpenTelegram={() => setTelegramModalOpen(true)}
            onTelegramAvatarError={() => {}}
          />
        </ProfileSettingsModal>
        <ProfilePasswordModal
          open={profilePasswordModalOpen}
          hasPasswordProvider
          hasGoogleProvider={false}
          saving={false}
          status=""
          onClose={() => setProfilePasswordModalOpen(false)}
          onChangePassword={async () => false}
          onSendPasswordReset={() => {}}
        />
        <ProfileEmailModal
          open={profileEmailModalOpen}
          email="ilya@example.com"
          saving={false}
          status=""
          onClose={() => setProfileEmailModalOpen(false)}
          onRequestEmailChange={async () => false}
        />
        <ProfileTrainerNotificationsModal
          open={trainerNotificationsOpen}
          tasks={visibleHarnessTrainerTasks}
          activeCount={visibleHarnessTrainerTasks.length > 0 ? 1 : 0}
          getTaskDestination={(task) => task.target || ""}
          onClose={() => setTrainerNotificationsOpen(false)}
          onOpenTask={(_, destination) => {
            setTrainerNotificationsOpen(false);

            if (destination === "progressPhotos") {
              setPage("cabinet");
              setCabinetPhotosOpen(true);
              return;
            }

            if (destination === "measurements") {
              setPage("cabinet");
              setCabinetMeasurementsOpen(true);
              return;
            }

            if (destination === "nutrition") {
              setPage("nutrition");
              return;
            }

            if (destination === "workouts") {
              setPage("workouts");
            }
          }}
        />
        <ProfileTelegramModal
          open={telegramModalOpen}
          telegramProfile={{
            connected: telegramHarnessConnected,
            username: "harness_coach",
            displayName: "Harness Athlete",
            avatarUrl: "",
            notificationsEnabled: true
          }}
          loginContainerRef={telegramLoginContainerRef}
          loginWidgetReady={telegramHarnessConnected}
          linking={false}
          status={telegramHarnessConnected ? "Notifications enabled" : ""}
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
      <ProfileMainHeroStatsShell>
        <ProfileHeroCard
          telegramProfile={{ connected: false }}
          avatarUrl=""
          greetingName="ILYA"
          activeGoalLabel="Сушка"
          totalWorkouts={12}
          targetWeight="78"
          currentWeight="88"
          goalId="cut"
        />
      </ProfileMainHeroStatsShell>

      <ProfileNextWorkoutCard
        title="Ноги и ягодицы"
        dateText="22 июля"
        exerciseCount={7}
        onOpen={() => setPage("workouts")}
      />

      <ProfileProgressInsightCard
        progressInsight={{
          score: 90,
          tone: "positive",
          scoreLabel: "Отличный темп",
          scoreSummary: "Регулярность: данные ведутся стабильно. Продолжай в том же ритме."
        }}
      />

      {weightCheckInDue && (
        <ProfileWeightCheckInReminder
          checkIn={{
            isDue: true,
            isFirst: measurementSnapshotState === "empty",
            isOverdue: measurementSnapshotState !== "empty",
            latestDateText: "16.06.2026"
          }}
          onOpen={() => setHarnessQuickWeightOpen(true)}
        />
      )}

      <ProfileMainMeasurementSnapshot
        measurementSeries={measurementSnapshotState === "empty"
          ? []
          : measurementSnapshotState === "single"
            ? [{ dateLabel: "16.06", weight: 89 }]
            : [
                { dateLabel: "09.06", weight: 88.5 },
                { dateLabel: "10.06", weight: 89.5 },
                { dateLabel: "10.06", weight: 89.5 },
                { dateLabel: "16.06", weight: 89 }
              ]}
        latestWeight={measurementSnapshotState === "empty" ? 0 : 89}
        weightChange={measurementSnapshotState === "trend" ? -0.5 : 0}
      />

      {harnessQuickWeightOpen && (
        <ProfileQuickWeightModal
          open
          initialWeight=""
          saving={harnessQuickWeightSaving}
          onClose={() => setHarnessQuickWeightOpen(false)}
          onSuccessAcknowledged={() => setHarnessQuickWeightOpen(false)}
          onSave={async () => {
            setHarnessQuickWeightSaving(true);
            await Promise.resolve();
            setHarnessQuickWeightSaving(false);
            return true;
          }}
        />
      )}

    </>
  ));
}
