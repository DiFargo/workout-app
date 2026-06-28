import { useEffect, useRef, useState } from "react";
import { defaultNutritionState } from "../../data/nutritionDefaults";
import { todayNutritionKey } from "../../domain/nutritionPresentation";
import { APP_VERSION } from "../../constants/appConfig";
import { ClientMainBottomBar } from "../../shared/ui/BottomBar";
import WorkoutListPage from "../../features/client/workouts/WorkoutListPage";
import { renderNutritionRoute } from "../../features/client/nutrition/renderNutritionRoute";
import {
  buildNutritionCalendarDays,
  formatNutritionCalendarMonthLabel,
  shiftNutritionCalendarMonthKey
} from "../../utils/nutritionCalendar";

const HARNESS_DATE = "2026-06-22";

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

function buildHarnessNutrition() {
  return {
    ...defaultNutritionState,
    goals: {
      calories: 2300,
      protein: 180,
      fat: 70,
      carbs: 235
    },
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
  const labels = ["П", "В", "С", "Ч", "П", "С", "В"];
  const selectedDate = new Date(`${selectedKey}T12:00:00`);
  const monday = new Date(selectedDate);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);

  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label
    };
  });
}

export default function ClientE2EHarness() {
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

  const [page, setPage] = useState("main");
  const [nutritionDateKey, setNutritionDateKey] = useState(HARNESS_DATE);
  const [nutrition] = useState(buildHarnessNutrition);
  const [nutritionPickerOpen, setNutritionPickerOpen] = useState(false);
  const [nutritionCalendarOpen, setNutritionCalendarOpen] = useState(false);
  const [nutritionCalendarMonthKey, setNutritionCalendarMonthKey] = useState(HARNESS_DATE.slice(0, 7));
  const [expandedNutritionMeals, setExpandedNutritionMeals] = useState({});
  const [nutritionZoukExpanded, setNutritionZoukExpanded] = useState(false);
  const [isAiNutritionPlanExpanded, setIsAiNutritionPlanExpanded] = useState(false);
  const [individualWorkoutIndex, setIndividualWorkoutIndex] = useState(0);
  const [individualWorkoutIndexInitialized, setIndividualWorkoutIndexInitialized] = useState(false);
  const [workoutModeModalOpen, setWorkoutModeModalOpen] = useState(false);
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = useState(false);
  const nutritionPhotoInputRef = useRef(null);
  const nutritionFoodSwipeMoved = useRef(false);

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

    return (
      <main
        className={`profileDashboardPage profileTabbedPage clientCorePage${pageClass}`}
        data-profile-tab={activeTab === "cabinet" ? "cabinet" : undefined}
        data-testid={`client-harness-${activeTab}`}
      >
        <div className="appVersionBadge clientPageVersionBadge">{APP_VERSION}</div>
        <section className="profileUnifiedCard profileAiDashboardCard profileCabinetSection">
          <h1 className="clientCorePageTitle">{title}</h1>
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
            workouts: harnessWorkouts,
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

  if (page === "nutrition") {
    return (
      <main data-testid="client-harness-nutrition">
        {renderNutritionRoute({
          activeNutritionSearchResultLimit: 8,
          addNutritionFoodFromPicker: () => {},
          addNutritionProductManuallyFromPhoto: () => {},
          addSelectedDishIngredientFromFood: () => {},
          aiNutritionProfile: { goal: "recomp", activity: "moderate", trainingDays: 3 },
          aiNutritionProfileDraft: { goal: "recomp", activity: "moderate", trainingDays: 3 },
          aiNutritionSavedPlan: null,
          barcodeScannerOpen: false,
          canDeleteSelectedNutritionFood: () => false,
          cancelNutritionEditPage: () => {},
          closeSelectedNutritionFood: () => {},
          confirmNutritionEditPage: () => {},
          confirmNutritionFoodFromPicker: () => {},
          createCustomNutritionDish: () => {},
          createCustomNutritionFood: () => {},
          deleteSelectedNutritionFood: () => {},
          deletingNutritionFoodId: "",
          dishIngredientExternalFoods: [],
          dishIngredientFallbackSuggestions: [],
          dishIngredientLoading: false,
          dishIngredientPickerOpen: false,
          dishIngredientSearch: "",
          editingNutritionItemId: "",
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
          nutritionAmount: "100",
          nutritionAmountError: "",
          nutritionAmountMode: "grams",
          nutritionCalendarDays,
          nutritionCalendarMonthLabel,
          nutritionCalendarOpen,
          nutritionCreateChoiceOpen: false,
          nutritionCurrentStreak: 4,
          nutritionDateKey,
          nutritionDeleteConfirmOpen: false,
          nutritionEditNote: "",
          nutritionEditPageOpen: false,
          nutritionFallbackSuggestions: [],
          nutritionFoodSwipeMoved,
          nutritionFoodSwipeOffsets: {},
          nutritionMeal: "breakfast",
          nutritionMealMenuOpen: false,
          nutritionPhotoAiCandidates: [],
          nutritionPhotoAiConfidence: 0,
          nutritionPhotoAiResult: null,
          nutritionPhotoAnalyzing: false,
          nutritionPhotoInputRef,
          nutritionPhotoNotFoundOpen: false,
          nutritionPhotoPreview: "",
          nutritionPickerOpen,
          nutritionProductErrors: {},
          nutritionProductUnitMenuOpen: false,
          nutritionSearch: "",
          nutritionSearchResultKey: "",
          nutritionSearchResults: [],
          nutritionSearchTab: "food",
          nutritionToday,
          nutritionTotals,
          nutritionUndoDelete: null,
          nutritionWeekDates,
          nutritionZoukExpanded,
          openDishIngredientPicker: () => {},
          openNutritionCalendar: () => setNutritionCalendarOpen(true),
          openNutritionEditPage: () => {},
          openNutritionFoodEditor: () => {},
          openNutritionPicker: () => setNutritionPickerOpen(true),
          pendingDishIngredient: null,
          pendingDishIngredientGrams: "100",
          recentNutritionFoods: [],
          removeSelectedDishIngredient: () => {},
          renderTrainerMainBottomBar: renderBottomBar,
          resetNutritionPhotoAiSearch: () => {},
          resetNutritionPhotoAiState: () => {},
          restoreNutritionFood: () => {},
          retryNutritionPhotoFromNotFound: () => {},
          selectNutritionDate: setNutritionDateKey,
          selectNutritionPhotoAiCandidate: () => {},
          selectedNutritionFood: null,
          setBarcodeScannerOpen: () => {},
          setDishIngredientPickerOpen: () => {},
          setDishIngredientSearch: () => {},
          setEditingNutritionItemId: () => {},
          setExpandedNutritionMeals,
          setFatSecretError: () => {},
          setIsAiNutritionPlanExpanded,
          setNutritionAmount: () => {},
          setNutritionAmountError: () => {},
          setNutritionAmountMode: () => {},
          setNutritionCalendarOpen,
          setNutritionCreateChoiceOpen: () => {},
          setNutritionDeleteConfirmOpen: () => {},
          setNutritionEditDetailsOpen: () => {},
          setNutritionEditNote: () => {},
          setNutritionEditPageOpen: () => {},
          setNutritionFallbackSuggestions: () => {},
          setNutritionMeal: () => {},
          setNutritionMealMenuOpen: () => {},
          setNutritionPickerOpen,
          setNutritionProductUnitMenuOpen: () => {},
          setNutritionSearch: () => {},
          setNutritionSearchResultLimit: () => {},
          setNutritionSearchTab: () => {},
          setNutritionZoukExpanded,
          setPendingDishIngredient: () => {},
          setPendingDishIngredientGrams: () => {},
          setSelectedNutritionFood: () => {},
          setShowRecentNutritionFoods: () => {},
          shiftNutritionCalendarMonth: (offset) => {
            setNutritionCalendarMonthKey((currentMonthKey) => shiftNutritionCalendarMonthKey(currentMonthKey, offset));
          },
          showRecentNutritionFoods: false,
          todayNutritionKey,
          updateSelectedDishTotalWeight: () => {},
          updateSelectedNutritionFoodField: () => {},
          updateSelectedNutritionPortionUnit: () => {},
          visibleNutritionSearchResults: []
        })}
      </main>
    );
  }

  if (page === "cabinet") {
    return renderHarnessChrome("cabinet", "Кабинет", (
      <>
        <p>Профиль, замеры, календарь и история тренировок.</p>
        <div className="profileMainSummaryGrid">
          <article><strong>88.8 кг</strong><span>Текущий вес</span></article>
          <article><strong>4</strong><span>Тренировки</span></article>
        </div>
      </>
    ));
  }

  return renderHarnessChrome("main", "Главная", (
    <>
      <p>Сегодня в фокусе питание, тренировка и прогресс.</p>
      <div className="profileMainSummaryGrid">
        <article><strong>Рекомпозиция</strong><span>Твоя цель</span></article>
        <article><strong>Завтра</strong><span>Следующая тренировка</span></article>
      </div>
    </>
  ));
}
