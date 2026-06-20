import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays as ProgramCalendarIcon,
  Dumbbell as ProgramDumbbellIcon,
  ListChecks as ProgramListIcon,
  Pencil as ProgramEditIcon,
  Plus as ProgramPlusIcon,
  RefreshCw as ProgramRefreshIcon,
  Repeat2 as ProgramCycleIcon,
  Trash2 as ProgramTrashIcon,
  Upload as ProgramUploadIcon
} from "lucide-react";
import "./styles.css";

import { BASIC_WORKOUT_PLANS } from "./data/basicWorkoutPlans";
import { getAiNutritionHistoryBaseline } from "./data/aiNutritionBaseline";
import { starterPlan } from "./data/starterPlan";
import {
  defaultNutritionState,
  NUTRITION_ICON_PRESETS,
  nutritionMeals
} from "./data/nutritionDefaults";
import { nutritionFoodDatabase } from "./data/nutritionFoods";
import {
  AI_NUTRITION_WEEK_DAYS,
  NUTRITION_QUICK_SEARCHES
} from "./data/nutritionPlanning";
import {
  createClientResourceId,
  getClientPaymentAttention,
  getClientPlateauInfo,
  getClientTrainerTaskDestination,
  getTrainerTaskStatus
} from "./domain/clientInsights";
import {
  formatCompactTimer,
  AI_COACH_FEATURES,
  getAiHistoryItems,
  getAiWorkoutBaseWeight,
  getAdjustedWorkoutWeight,
  getDefaultWorkoutModePreference,
  getExerciseMovementHint,
  getExerciseTechniqueHint,
  parseWorkoutWeightValue,
  getProgramHistoryItems,
  getWorkoutReadinessOption,
  getWorkoutCover,
  getWorkoutPresentation,
  getWorkoutWarmupSteps,
  POST_WORKOUT_FEEDBACK_OPTIONS,
  WORKOUT_MENU_ITEMS,
  WORKOUT_READINESS_OPTIONS
} from "./domain/workoutPresentation";
import {
  dateToNutritionKey,
  formatNutritionDateLabel,
  getDefaultNutritionMealByTime,
  getNutritionOrbitSegment,
  makeEmptyNutritionDay,
  nutritionKeyToDate,
  shiftNutritionDateKey,
  todayNutritionKey
} from "./domain/nutritionPresentation";
import { compressProgressPhoto } from "./utils/imageCompression";
import { fetchAuthorized, fetchAuthorizedWithTimeout } from "./utils/apiClient";
import { showAppConfirm, showAppError } from "./utils/appFeedback";
import {
  getFoodDisplayPortion,
  getFoodIcon,
  getFoodRskPercent,
  getNutritionFoodSearchText,
  getSearchHistoryName,
  getShortFoodName
} from "./utils/nutritionFoodPresentation";
import {
  detectNutritionAmountMode,
  enrichNutritionFoodIcon,
  getDefaultNutritionSmartUnit,
  getMyFoodsArray,
  getNutritionBaseMacroFood,
  getNutritionSmartUnitId,
  getNutritionSmartUnits,
  isPortionModeSelected,
  makePersonalFoodKey,
  normalizeMyFoodRecord,
  normalizeNutritionFood,
  searchMyFoods
} from "./utils/nutritionFoodModel";
import { recalcDishFromIngredients, sumDishIngredientWeight } from "./utils/nutritionDish";
import {
  getAiNutritionActivityLabel,
  getAiNutritionGoalLabel,
  getAiNutritionGoalShort,
  getAiNutritionTrainingDayAdvice
} from "./utils/aiNutritionLabels";
import {
  buildNutritionHistoryDays,
  buildAiNutritionDayModel,
  getAiNutritionTotalsForToday,
  getNutritionDayTotals,
  sumNutritionFoods
} from "./utils/aiNutritionAnalysis";
import { getNutritionPhotoAiConfidenceText } from "./utils/nutritionPhotoAi";
import {
  buildAiNutritionMonthlyPlan,
  buildClientNutritionPresetOptions
} from "./utils/aiNutritionPlanBuilder";
import { buildAiCoachResult } from "./utils/aiCoachResult";
import {
  getAiNutritionCurrentWeek,
  getAiNutritionDayMacros,
  getAiNutritionTrainingDays,
  getAiNutritionWeekForDate,
  isAiNutritionTrainingDay
} from "./utils/aiNutritionSchedule";
import {
  getClientEffectiveNutritionGoals,
  getClientNutritionDisplayPlan
} from "./utils/clientNutritionPlan";
import {
  mergeNutritionFoodResults,
  searchLocalNutritionFoods
} from "./utils/localNutritionCatalog";
import { mergeNutritionStates } from "./utils/nutritionStateMerge";
import { saveNutritionStateWithMerge } from "./utils/nutritionStateStorage";
import {
  loadNutritionPreferredUnit,
  loadRecentNutritionFoods,
  saveNutritionPreferredUnit,
  saveRecentNutritionFood,
  saveRecentNutritionFoods
} from "./utils/nutritionPreferenceStorage";
import {
  buildMyNutritionFoods,
  buildNutritionSearchResults
} from "./utils/nutritionSearchResults";
import { getPersonalMyFoodsDocRef } from "./utils/personalMyFoodsStorage";
import {
  createEmptyAiNutritionProfileDraft,
  createEmptyTelegramProfile,
  hasRequiredAiNutritionProfileFields
} from "./utils/profileDefaults";
import {
  createTelegramLinkCode,
  normalizeTelegramUsername,
  parseTelegramAuthResultFromHash
} from "./utils/telegramProfile";
import { getClientTelegramProfile } from "./utils/clientTelegramProfile";
import {
  enqueueFailedHistorySave,
  getFailedHistoryQueue,
  getFailedMeasurementQueue,
  getFailedNutritionSync,
  removePendingHistoryBackups,
  setFailedHistoryQueue,
  setFailedMeasurementQueue,
  setFailedNutritionSync,
  WORKOUT_HISTORY_BACKUP_STORAGE_KEY
} from "./utils/offlineSyncStorage";
import { parseNutritionNumber, roundMacro } from "./utils/nutritionNumbers";
import {
  getFoodPortionAmount,
  getFoodScale,
  getPieceProductSizeProfile
} from "./utils/nutritionPortions";
import { buildProgressInsight } from "./utils/progressInsight";
import {
  addLocalBackup,
  safeReadJsonStorage,
  safeWriteJsonStorage
} from "./utils/storageSafety";
import {
  addUserLocalBackup,
  getUserScopedStorageKey,
  removeUserLocalBackup,
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "./utils/userScopedStorage";
import {
  buildPlannedWorkoutSlots,
  buildWorkoutScheduleCalendarEntries,
  buildWorkoutScheduleDraft,
  syncWorkoutCalendarWithPlan
} from "./utils/workoutSchedule";
import {
  clearStaleWorkoutCaches,
  clearWorkoutDraft,
  getWorkoutDraftKey
} from "./utils/workoutDraftStorage";
import {
  buildCompletedWorkoutSet,
  getCompletedWorkoutKey,
  getNextUncompletedWorkoutIndex as getNextUncompletedWorkoutIndexFromSet,
  isWorkoutCompletedWithSet
} from "./utils/workoutCompletion";
import {
  formatHistoryCardDate,
  formatHistoryTime,
  getHistorySetCount,
  getHistoryTopExercise,
  getHistoryVolume,
  getHistoryWorkoutParts
} from "./utils/workoutHistoryPresentation";
import { buildTrainerNutritionPlanUpdate } from "./utils/trainerNutritionPlan";
import { buildTrainerExerciseLibraryItems } from "./utils/trainerExerciseLibrary";
import { isTrainerE2EHarnessEnabled } from "./utils/trainerHarness";
import {
  formatTrainerSummaryDate,
  getTrainerAssignmentVersionKey,
  getTrainerSummaryDateKey,
  getTrainerSummaryDayStart,
  getTrainerSummaryDaysSince,
  getTrainerSummaryTimestamp,
  getTrainerSummaryWeekStart
} from "./utils/trainerSummaryDates";
import {
  getClientActivityStatus,
  getClientAttentionReasons,
  getTrainerClientFastSummary,
  getTrainerDayWord,
  getTrainerNutritionSummary
} from "./utils/trainerClientSummary";
import {
  buildAdminClientNutritionStateFromRoot,
  getTrainerClientMirrorPayload
} from "./utils/trainerClientMirror";
import {
  getAdminWeightPoints,
  getAdminWorkoutProgressList
} from "./utils/adminClientProgress";
import {
  getAdminClientGoalLabel,
  getAdminClientProfile,
  getAdminClientTrainingDaysText
} from "./utils/adminClientProfile";
import {
  ADMIN_CALENDAR_DAYS,
  getDefaultAdminCalendar
} from "./utils/adminClientCalendar";
import {
  formatProfileWorkoutDate,
  getProfileNextTrainingText
} from "./utils/profileWorkoutSchedule";
import {
  CLIENT_PRIMARY_PAGES,
  mapLoginAuthError,
  normalizeClientPrimaryPage,
  validateLoginFields,
  validateNutritionAmount,
  validateNutritionFoodDraft
} from "./utils/clientUx";
import { useModalFocusTrap } from "./hooks/useModalFocusTrap";
import {
  buildClientWorkoutsFromTemplate,
  makeThreeSets,
  normalizeExercise,
  normalizePlan,
  sortWorkoutDays
} from "./utils/workoutPlanNormalization";
import {
  PostWorkoutFeedbackDialog,
  WorkoutExitDialog,
  WorkoutIncompleteDialog
} from "./components/workout/WorkoutDialogs";
import TrainerWorkspace, { TrainerProgramConstructor, TrainerShell } from "./components/trainer/TrainerWorkspace";
import {
  applyExerciseLibraryDefaults,
  createFourWeekWorkoutProgramBlocks,
  distributeMicrocycleWorkouts,
  exerciseUsesExternalWeight,
  findExerciseLibraryMatch,
  findExistingPhotoFood,
  calculateNutritionFoodStreak,
  getMicrocycleWeekNumbers,
  getWorkoutCompletion,
  getTimestampValue,
  hasWorkoutSetEntry,
  isReliablePhotoFood,
  isWorkoutSetCompleted
} from "./utils/auditSafety";

import { auth, db, storage } from "./firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getIdTokenResult,
  updateEmail,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";

import { collection, getDocs, doc, setDoc, addDoc, getDoc, deleteDoc, query, where, getFirestore, writeBatch, onSnapshot } from "firebase/firestore";

const APP_VERSION = "v692";
const BARCODE_SEARCH_ENABLED = false;
const INLINE_VIDEO_CONTROLS_HIDE_DELAY_MS = 850;
const STORAGE_KEY = "workout_tracker_v1";
const ADMIN_EMAIL = "work.kriptonit.il@gmail.com";

const NUTRITION_STORAGE_KEY = "workout_nutrition_v1";
const NUTRITION_BACKUP_STORAGE_KEY = "workout_nutrition_backup_v1";
const WORKOUT_PLAN_BACKUP_STORAGE_KEY = "workout_plan_backup_v1";
const MEASUREMENTS_STORAGE_KEY = "workout_measurements_v1";
const INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY = "individual_workout_swipe_hint_seen_v1";
const GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY = "workout_global_my_foods_backup_v1";
const APP_THEME_STORAGE_KEY = "workout_app_theme_v1";
const FIRST_SETUP_DONE_USER_STORAGE_KEY = "workout_first_setup_done_user_uid";
const FIRST_SETUP_REQUIRED_VERSION = "v2";
const TELEGRAM_BOT_USERNAME = "tren_ai_coach_bot";
const TELEGRAM_PROFILE_STORAGE_KEY = "workout_telegram_profile_v1";

const WORKOUT_MODE_STORAGE_KEY = "workout_mode_preference_v1";
const WORKOUT_CALENDAR_STORAGE_KEY = "workout_calendar_v1";
const CLIENT_LAST_PAGE_STORAGE_KEY = "workout_client_last_page_v1";

const AI_NUTRITION_PROFILE_STORAGE_KEY = "ai_nutrition_profile_v1";
const AI_NUTRITION_PLAN_STORAGE_KEY = "ai_nutrition_plan_v1";

// HARDER DELETE SWIPE
const NUTRITION_DELETE_THRESHOLD = -135;

function TrainerE2EHarness() {
  const [mode, setMode] = useState("dashboard");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [activeClientTab, setActiveClientTab] = useState("overview");
  const [selectedProgramId, setSelectedProgramId] = useState("program_tren_plus");
  const [selectedClient, setSelectedClient] = useState({
    id: "client_e2e",
    name: "Germes",
    email: "germes@example.com",
    goalDescription: "Рекомпозиция",
    assignedProgramId: "program_tren_plus",
    assignedProgramName: "tren+",
    assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
    assignedWorkoutCount: 4,
    workoutCalendar: {
      enabled: true,
      scheduledDates: ["2026-06-15", "2026-06-18", "2026-06-22", "2026-06-25"],
      reminderEnabled: true,
      reminderOffsetsHours: [24, 3],
      progressReminderSettings: {
        photoEnabled: true,
        measurementsEnabled: true,
        photoIntervalDays: 14,
        measurementsIntervalDays: 14
      }
    },
    telegram: { connected: true, username: "germes" },
    telegramNotificationsEnabled: true
  });
  const clients = [selectedClient];
  const history = [
    {
      id: "history_1",
      workoutId: "e2e_day_1",
      workoutName: "Тренировка 1",
      date: "2026-06-15T18:00:00.000Z",
      completedAt: "2026-06-15T18:00:00.000Z",
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { name: "Жим ногами", sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 90 }] }
      ]
    }
  ];
  const measurements = [
    { id: "m2", date: "2026-06-16", weight: 88.8, values: { weight: 88.8, belly: 88, chest: 104 } },
    { id: "m1", date: "2026-06-01", weight: 89.5, values: { weight: 89.5, belly: 90, chest: 103 } }
  ];
  const nutritionDays = [
    { date: "2026-06-17", totals: { calories: 2210, protein: 172, fat: 66, carbs: 228 }, foods: [] },
    { date: "2026-06-16", totals: { calories: 2290, protein: 181, fat: 69, carbs: 236 }, foods: [] }
  ];
  const workouts = [
    {
      id: "e2e_day_1",
      name: "Тренировка 1",
      scheduledDate: "2026-06-15",
      assignedProgramId: "program_tren_plus",
      assignedProgramName: "tren+",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { id: "e1", name: "Жим ногами", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "90" }, { reps: "12", weight: "90" }] },
        { id: "e2", name: "Тяга нижнего блока", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "35" }] }
      ]
    },
    {
      id: "e2e_day_2",
      name: "Тренировка 2",
      scheduledDate: "2026-06-18",
      assignedProgramId: "program_tren_plus",
      assignedProgramName: "tren+",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      exercises: [
        { id: "e3", name: "Жим лёжа с гантелями", video: "", requiresWeight: true, rest: "90 сек", sets: [{ reps: "12", weight: "20" }] }
      ]
    }
  ];
  const clientSummaries = {
    client_e2e: {
      assignedProgramId: "program_tren_plus",
      assignedProgramUpdatedAt: "2026-06-10T10:00:00.000Z",
      assignedWorkoutCount: 4,
      completedWorkoutCount: 1,
      programCompletionPercent: 25,
      workouts7: 1,
      nutritionDays7: 2,
      lastWorkoutAt: "2026-06-15T18:00:00.000Z",
      lastNutritionAt: "2026-06-17T12:00:00.000Z",
      lastMeasurementAt: "2026-06-16",
      workoutDateKeysCurrentWeek: ["2026-06-15"]
    }
  };
  const programTemplates = [
    { id: "program_tren_plus", name: "tren+", workoutsCount: 4 },
    { id: "program_support", name: "Поддержка", workoutsCount: 3 }
  ];
  const nutritionPlanOptions = [
    { id: "maintain", name: "Поддержка", calories: 2400, protein: 160, fat: 75, carbs: 260 },
    { id: "recomp", name: "Рекомпозиция", calories: 2300, protein: 180, fat: 70, carbs: 235 }
  ];

  function navigate(nextSection) {
    if (nextSection === "more") {
      setMode("cabinet");
      setActiveSection("more");
      return;
    }
    setMode(nextSection);
    setActiveSection(nextSection);
  }

  return (
    <TrainerWorkspace
      appVersion={APP_VERSION}
      mode={mode}
      activeSection={mode === "client" ? "clients" : activeSection}
      onNavigate={navigate}
      onRefresh={() => {}}
      trainerName="Beta"
      clients={clients}
      clientSummaries={clientSummaries}
      counts={{ active: 1, attention: 0 }}
      selectedClient={selectedClient}
      selectedProfile={{ goalLabel: "Рекомпозиция", weight: 88.8, height: 180, age: 28 }}
      selectedSummary={clientSummaries.client_e2e}
      activeClientTab={activeClientTab}
      onClientTabChange={(tab) => {
        setActiveClientTab(tab);
        setMode("client");
      }}
      onOpenClient={(client) => {
        setSelectedClient(client);
        setMode("client");
        setActiveSection("clients");
      }}
      onCloseClient={() => {
        setMode("clients");
        setActiveSection("clients");
      }}
      onCreateClient={() => {}}
      createClientState={{
        open: false,
        name: "",
        email: "",
        password: "",
        status: "",
        credentials: null,
        loading: false,
        onClose: () => {},
        onSubmit: () => {},
        onNameChange: () => {},
        onEmailChange: () => {},
        onPasswordChange: () => {},
        onGeneratePassword: () => {}
      }}
      measurements={measurements}
      history={history}
      nutritionDays={nutritionDays}
      nutritionGoals={{ calories: 2300, protein: 180, fat: 70, carbs: 235 }}
      nutritionPlanOptions={nutritionPlanOptions}
      photos={[{ id: "p1", date: "2026-06-01", frontUrl: "" }]}
      tasks={[]}
      trainerNote="Тестовая заметка"
      onGenerateNutritionPlan={() => {}}
      onSaveNutritionPlan={() => true}
      onSaveNotifications={() => true}
      onTestNotification={() => true}
      onConnectTelegram={() => {}}
      onSendMessage={() => true}
      onClientAction={() => true}
      workouts={workouts}
      exerciseLibrary={workouts.flatMap((workout) => workout.exercises)}
      programTemplates={programTemplates}
      selectedProgramId={selectedProgramId}
      onSelectProgram={setSelectedProgramId}
      onAssignProgram={() => true}
      onSaveWorkoutSchedule={(dates) => {
        setSelectedClient((current) => ({
          ...current,
          workoutCalendar: {
            ...(current.workoutCalendar || {}),
            scheduledDates: dates,
            monthlyTrainingDates: dates,
            updatedAt: new Date().toISOString()
          }
        }));
        return true;
      }}
      programStatus=""
      onUpdateWorkout={() => {}}
      onUpdateExercise={() => {}}
      onUpdateExerciseSet={() => {}}
      onAddExerciseSet={() => {}}
      onRemoveExerciseSet={() => {}}
      onAddExercise={() => {}}
      onRemoveExercise={() => {}}
      onDuplicateExercise={() => {}}
      onMoveExercise={() => {}}
      onUploadExerciseVideo={() => {}}
      onAddDay={() => {}}
      onDuplicateDay={() => {}}
      onRemoveDay={() => {}}
      onSaveWorkouts={() => {}}
      onLogout={() => {}}
    />
  );
}

export default function App() {
  useModalFocusTrap();

  if (isTrainerE2EHarnessEnabled()) {
    return <TrainerE2EHarness />;
  }

  useEffect(() => {
    const preventGestureZoom = (event) => event.preventDefault();
    const preventMultiTouchZoom = (event) => {
      if (event.touches?.length > 1) event.preventDefault();
    };
    const isTouchDevice = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches;
    const lockPortraitOrientation = () => {
      if (!isTouchDevice || !window.screen?.orientation?.lock) return;
      window.screen.orientation.lock("portrait-primary").catch(() => {
        // Mobile browsers allow orientation lock only in some contexts.
        window.screen.orientation.lock("portrait").catch(() => {});
      });
    };

    document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
    document.addEventListener("gestureend", preventGestureZoom, { passive: false });
    document.addEventListener("touchmove", preventMultiTouchZoom, { passive: false });
    document.addEventListener("visibilitychange", lockPortraitOrientation);
    window.addEventListener("orientationchange", lockPortraitOrientation);
    window.addEventListener("resize", lockPortraitOrientation);
    lockPortraitOrientation();

    return () => {
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("gestureend", preventGestureZoom);
      document.removeEventListener("touchmove", preventMultiTouchZoom);
      document.removeEventListener("visibilitychange", lockPortraitOrientation);
      window.removeEventListener("orientationchange", lockPortraitOrientation);
      window.removeEventListener("resize", lockPortraitOrientation);
    };
  }, []);

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
  const [appThemeCloudReady, setAppThemeCloudReady] = useState(false);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [loginNotice, setLoginNotice] = useState("");
  const [profileActiveTab, setProfileActiveTab] = useState("cabinet");

  function canUseAdminFeatures() {
    return Boolean(isAdminClaim);
  }

  function canUseTrainerFeatures() {
    return Boolean(isAdminClaim || currentUserRole === "trainer");
  }

  function getCurrentProgramOwner() {
    return {
      uid: auth.currentUser?.uid || user?.uid || "",
      role: canUseAdminFeatures() ? "admin" : "trainer"
    };
  }

  function canManageTrainingTemplate(template) {
    if (canUseAdminFeatures()) return true;
    const currentUid = auth.currentUser?.uid || user?.uid || "";
    return currentUserRole === "trainer" && Boolean(currentUid) && template?.ownerUid === currentUid;
  }

  function canManageClientProgram(client) {
    if (canUseAdminFeatures()) return true;
    const currentUid = auth.currentUser?.uid || user?.uid || "";
    return currentUserRole === "trainer" && Boolean(currentUid) && [
      client?.trainerId,
      client?.assignedTrainerId,
      client?.coachId,
      client?.createdByUid
    ].includes(currentUid);
  }

  const historyReplayInProgressRef = useRef(false);
  const nutritionReplayInProgressRef = useRef(false);
  const measurementReplayInProgressRef = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      showAppError("offline");
    };

    const handleOnline = () => {
      showAppError("savedLocal", "Соединение восстановлено.");
      replayFailedHistorySaves(auth.currentUser?.uid);
      replayFailedNutritionSync(auth.currentUser?.uid);
      replayFailedMeasurementSaves(auth.currentUser?.uid);
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
  const [workoutModeModalOpen, setWorkoutModeModalOpen] = useState(false);
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = useState(false);
  const [basicWorkoutQuiz, setBasicWorkoutQuiz] = useState({
    goal: "muscle",
    level: "beginner",
    days: "4"
  });

  const [page, setPage] = useState("main");
  useEffect(() => {
    if (page !== "nutrition") return;

    const scrollNutritionToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document
        .querySelector(".fatSecretPage.nutritionFixedHeaderV3.clientCorePageNutrition")
        ?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    };

    scrollNutritionToTop();
    const frame = window.requestAnimationFrame(scrollNutritionToTop);
    const timeout = window.setTimeout(scrollNutritionToTop, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [page]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [individualWorkoutIndex, setIndividualWorkoutIndex] = useState(0);
  const [individualWorkoutIndexInitialized, setIndividualWorkoutIndexInitialized] = useState(false);
  const [individualWorkoutSwipeHintVisible, setIndividualWorkoutSwipeHintVisible] = useState(
    () => safeReadJsonStorage(INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY, true) !== false
  );
  const individualWorkoutSwipeStartRef = useRef(null);
  const individualWorkoutSwipeSuppressClickRef = useRef(false);
  const [openVideoId, setOpenVideoId] = useState(null);
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const [inlinePlayingVideoId, setInlinePlayingVideoId] = useState("");
  const [inlineVideoControlsVisible, setInlineVideoControlsVisible] = useState(true);
  const inlineVideoControlsTimerRef = useRef(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutStartedAt, setWorkoutStartedAt] = useState(null);
  const [workoutFinishedAt, setWorkoutFinishedAt] = useState(null);
  const [workoutDraftRestorePrompt, setWorkoutDraftRestorePrompt] = useState(null);
  const [workoutReadinessOpen, setWorkoutReadinessOpen] = useState(false);
  const [workoutReadiness, setWorkoutReadiness] = useState(null);
  const [workoutReadinessPending, setWorkoutReadinessPending] = useState(null);
  const [workoutExitPromptOpen, setWorkoutExitPromptOpen] = useState(false);
  const [workoutIncompleteConfirmOpen, setWorkoutIncompleteConfirmOpen] = useState(false);
  const [pendingWorkoutFeedback, setPendingWorkoutFeedback] = useState(null);
  const [warmupCompletedSteps, setWarmupCompletedSteps] = useState([]);
  const [warmupTimerDuration, setWarmupTimerDuration] = useState(300);
  const [warmupTimerSeconds, setWarmupTimerSeconds] = useState(300);
  const [warmupTimerRunning, setWarmupTimerRunning] = useState(false);
  const [restTimerDuration, setRestTimerDuration] = useState(90);
  const [restTimerSeconds, setRestTimerSeconds] = useState(0);
  const [restTimerRunning, setRestTimerRunning] = useState(false);
  const [exerciseHistoryOpenId, setExerciseHistoryOpenId] = useState("");
  const [exerciseNoteOpenId, setExerciseNoteOpenId] = useState("");
  const [exerciseTechniqueOpenId, setExerciseTechniqueOpenId] = useState("");
  const [exerciseValidationMessage, setExerciseValidationMessage] = useState("");
  const [videoLoadingId, setVideoLoadingId] = useState("");
  const [videoRetryToken, setVideoRetryToken] = useState(0);
  const [workoutHistorySyncState, setWorkoutHistorySyncState] = useState("idle");
  const [postWorkoutFeedbackOpen, setPostWorkoutFeedbackOpen] = useState(false);
  const [postWorkoutFeedback, setPostWorkoutFeedback] = useState(null);
  const [workoutClientComment, setWorkoutClientComment] = useState("");
  const [timerTick, setTimerTick] = useState(Date.now());
  const setRepsInputRefs = useRef({});
  const setWeightInputRefs = useRef({});

  useEffect(() => {
    if (inlineVideoControlsTimerRef.current) {
      window.clearTimeout(inlineVideoControlsTimerRef.current);
      inlineVideoControlsTimerRef.current = null;
    }
    setInlinePlayingVideoId("");
    setInlineVideoControlsVisible(true);
    setVideoLoadingId("");
    setExerciseHistoryOpenId("");
    setExerciseNoteOpenId("");
    setExerciseTechniqueOpenId("");
    setExerciseValidationMessage("");

    return () => {
      if (inlineVideoControlsTimerRef.current) {
        window.clearTimeout(inlineVideoControlsTimerRef.current);
        inlineVideoControlsTimerRef.current = null;
      }
    };
  }, [selectedWorkoutId, currentExerciseIndex]);

  function showInlineVideoControlsTemporarily() {
    if (inlineVideoControlsTimerRef.current) {
      window.clearTimeout(inlineVideoControlsTimerRef.current);
    }
    setInlineVideoControlsVisible(true);
    inlineVideoControlsTimerRef.current = window.setTimeout(() => {
      setInlineVideoControlsVisible(false);
      inlineVideoControlsTimerRef.current = null;
    }, INLINE_VIDEO_CONTROLS_HIDE_DELAY_MS);
  }

  useEffect(() => {
    if (!warmupTimerRunning) return undefined;

    const timer = window.setInterval(() => {
      setWarmupTimerSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setWarmupTimerRunning(false);
          navigator.vibrate?.(120);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [warmupTimerRunning]);

  useEffect(() => {
    if (!restTimerRunning) return undefined;

    const timer = window.setInterval(() => {
      setRestTimerSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRestTimerRunning(false);
          navigator.vibrate?.([100, 80, 100]);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restTimerRunning]);

  const timerTickRef = useRef(Date.now());
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
  const [trainerNextSection, setTrainerNextSection] = useState("dashboard");
  const [trainerProgramManagerOpen, setTrainerProgramManagerOpen] = useState(false);
  const [trainerWorkoutTab, setTrainerWorkoutTab] = useState("programs");
  const [trainerClientSummaries, setTrainerClientSummaries] = useState({});
  const [trainerClientSummariesLoading, setTrainerClientSummariesLoading] = useState(false);
  const trainerClientSummaryRequestRef = useRef(0);
  const [clientTrainerTasks, setClientTrainerTasks] = useState([]);
  const [adminClientTasks, setAdminClientTasks] = useState([]);
  const [adminClientProgressPhotos, setAdminClientProgressPhotos] = useState([]);
  const [adminClientEvents, setAdminClientEvents] = useState([]);
  const [adminClientPayment, setAdminClientPayment] = useState(null);
  const [adminNewTaskTitle, setAdminNewTaskTitle] = useState("");
  const [adminNewTaskDueDate, setAdminNewTaskDueDate] = useState("");
  const [adminProgressPhotoDate, setAdminProgressPhotoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adminProgressPhotoComment, setAdminProgressPhotoComment] = useState("");
  const [adminProgressPhotoFiles, setAdminProgressPhotoFiles] = useState({ front: null, side: null, back: null });
  const [adminProgressPhotoUploading, setAdminProgressPhotoUploading] = useState(false);
  const [adminPhotoCompareIds, setAdminPhotoCompareIds] = useState(["", ""]);
  const [adminPhotoCompareOpen, setAdminPhotoCompareOpen] = useState(false);
  const [adminTaskComposerOpen, setAdminTaskComposerOpen] = useState(false);
  const [adminProgramControlOpen, setAdminProgramControlOpen] = useState(false);
  const [adminPaymentDraft, setAdminPaymentDraft] = useState({
    assignedFrom: "",
    controlUntil: "",
    format: "",
    status: "active",
    note: ""
  });
  const [adminClientTab, setAdminClientTab] = useState("overview");
  const [adminTrainerNote, setAdminTrainerNote] = useState("");
  const [adminTrainingTemplates, setAdminTrainingTemplates] = useState([]);
  const trainerExerciseLibraryItems = useMemo(
    () => buildTrainerExerciseLibraryItems(plan, adminTrainingTemplates),
    [plan, adminTrainingTemplates]
  );
  const [adminTemplateName, setAdminTemplateName] = useState("");
  const [adminSelectedTemplateId, setAdminSelectedTemplateId] = useState("");
  const [adminSelectedNutritionPreset, setAdminSelectedNutritionPreset] = useState("maintenance");
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
    reminderOffsetsHours: [24],
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
  const [adminExerciseVideoUploadingId, setAdminExerciseVideoUploadingId] = useState("");
  const [adminVideoPreview, setAdminVideoPreview] = useState(null);
  const adminProgramImportInputRef = useRef(null);
  const [adminOpenWorkoutId, setAdminOpenWorkoutId] = useState("");
  const [adminOpenProgramBlocks, setAdminOpenProgramBlocks] = useState({});
  const [adminOpenProgramWeeks, setAdminOpenProgramWeeks] = useState({});
  const [adminProgramCopyTarget, setAdminProgramCopyTarget] = useState(null);
  const [adminProgramSwipeOpenKey, setAdminProgramSwipeOpenKey] = useState("");
  const [adminExerciseSearch, setAdminExerciseSearch] = useState("");
  const adminExerciseEditSnapshotRef = useRef(null);
  const adminProgramSwipeStartRef = useRef(null);
  const adminProgramSwipeSuppressClickRef = useRef(false);
  const [adminProgramEditorMode, setAdminProgramEditorMode] = useState("create");
  const [adminProgramLibraryTab, setAdminProgramLibraryTab] = useState("overview");
  const [adminProgramCreateChoiceOpen, setAdminProgramCreateChoiceOpen] = useState(false);
  const [adminInspectorTab, setAdminInspectorTab] = useState("main");
  const [adminProgramGroups, setAdminProgramGroups] = useState([]);
  const [adminActiveProgramId, setAdminActiveProgramId] = useState("");
  const [adminActiveDayId, setAdminActiveDayId] = useState("");

  useEffect(() => {
    if (!adminSelectedExerciseId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [adminSelectedExerciseId]);

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
  const cabinetWorkoutHistoryItemRefs = useRef(new Map());
  const [selectedAiFeatureId, setSelectedAiFeatureId] = useState("nutritionPlan");
  const [showFirstSetupOnboarding, setShowFirstSetupOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [firstSetupSaveStatus, setFirstSetupSaveStatus] = useState("");
  const [firstSetupCompletedInSession, setFirstSetupCompletedInSession] = useState(false);
  const [firstSetupProfileHydrated, setFirstSetupProfileHydrated] = useState(false);
  const [firstSetupCompletedInCloud, setFirstSetupCompletedInCloud] = useState(false);

  const [aiNutritionProfileDraft, setAiNutritionProfileDraft] = useState(createEmptyAiNutritionProfileDraft);
  const [aiNutritionProfile, setAiNutritionProfile] = useState(null);
  const [aiNutritionSavedPlan, setAiNutritionSavedPlan] = useState(null);
  const [aiNutritionAdaptedToday, setAiNutritionAdaptedToday] = useState(false);
  const [isAiNutritionPlanExpanded, setIsAiNutritionPlanExpanded] = useState(false);
  const [profileBodyMetricsOpen, setProfileBodyMetricsOpen] = useState(false);
  const [profileNutritionModalOpen, setProfileNutritionModalOpen] = useState(false);
  const [profileNutritionSaveStatus, setProfileNutritionSaveStatus] = useState("");
  const [profileProgressModalOpen, setProfileProgressModalOpen] = useState(false);
  const [profileWorkoutHistoryModalOpen, setProfileWorkoutHistoryModalOpen] = useState(false);
  const [profileWorkoutHistoryProgramScope, setProfileWorkoutHistoryProgramScope] = useState(null);
  useEffect(() => {
    if (!profileWorkoutHistoryModalOpen || !openHistoryKey || historyLoading) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      cabinetWorkoutHistoryItemRefs.current.get(openHistoryKey)?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [profileWorkoutHistoryModalOpen, openHistoryKey, historyLoading, history.length]);
  const [profileWorkoutCalendarMonth, setProfileWorkoutCalendarMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const [profileWorkoutCalendarDate, setProfileWorkoutCalendarDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const [profileWorkoutCalendarData, setProfileWorkoutCalendarData] = useState({});
  const [profileWorkoutScheduledDates, setProfileWorkoutScheduledDates] = useState([]);
  const [profileWorkoutCalendarDraftDates, setProfileWorkoutCalendarDraftDates] = useState([]);
  const [profileWorkoutCalendarEditing, setProfileWorkoutCalendarEditing] = useState(false);
  const [profileWorkoutCalendarSaving, setProfileWorkoutCalendarSaving] = useState(false);
  const [profileWorkoutCalendarStatus, setProfileWorkoutCalendarStatus] = useState("");
  const [profileSettingsModalOpen, setProfileSettingsModalOpen] = useState(false);
  const [profileTrainerNotificationsOpen, setProfileTrainerNotificationsOpen] = useState(false);
  const [profileSettingsModalSection, setProfileSettingsModalSection] = useState("settings");
  const [profileAccount, setProfileAccount] = useState({ displayName: "", avatarUrl: "", email: "" });
  const [profileAccountDraft, setProfileAccountDraft] = useState({ displayName: "", email: "" });
  const [profileAccountAvatarFile, setProfileAccountAvatarFile] = useState(null);
  const [profileAccountAvatarPreview, setProfileAccountAvatarPreview] = useState("");
  const [profileAvatarCropOpen, setProfileAvatarCropOpen] = useState(false);
  const [profileAvatarCropSource, setProfileAvatarCropSource] = useState("");
  const [profileAvatarCropZoom, setProfileAvatarCropZoom] = useState(1);
  const [profileAvatarCropOffset, setProfileAvatarCropOffset] = useState({ x: 0, y: 0 });
  const [profileAvatarCropSize, setProfileAvatarCropSize] = useState({ width: 0, height: 0 });
  const profileAvatarCropImageRef = useRef(null);
  const profileAvatarCropDragRef = useRef(null);
  const [profileAccountSaving, setProfileAccountSaving] = useState(false);
  const [profileAccountStatus, setProfileAccountStatus] = useState("");
  const profileSettingsModalBodyRef = useRef(null);
  const [profileProgressAnalysisOpen, setProfileProgressAnalysisOpen] = useState(false);
  const [profileMeasurementOpen, setProfileMeasurementOpen] = useState(false);
  const [profileMeasurementsModalOpen, setProfileMeasurementsModalOpen] = useState(false);
  const [profileMeasurementReturnTab, setProfileMeasurementReturnTab] = useState("measurements");
  const [profileMeasurementSaving, setProfileMeasurementSaving] = useState(false);
  const [profileMeasurementStatus, setProfileMeasurementStatus] = useState("");
  const [profileMeasurements, setProfileMeasurements] = useState([]);
  const [clientProgressPhotos, setClientProgressPhotos] = useState([]);
  const [profileProgressPhotosModalOpen, setProfileProgressPhotosModalOpen] = useState(false);
  const [profileProgressPhotoCompareIds, setProfileProgressPhotoCompareIds] = useState(["", ""]);
  const [profileProgressPhotoCompareView, setProfileProgressPhotoCompareView] = useState("front");
  const [profileProgressPhotoFiles, setProfileProgressPhotoFiles] = useState({
    front: null,
    side: null,
    back: null
  });
  const [profileProgressPhotoPreviews, setProfileProgressPhotoPreviews] = useState({
    front: "",
    side: "",
    back: ""
  });
  const [profileProgressPhotoUploading, setProfileProgressPhotoUploading] = useState(false);
  const [profileProgressPhotoStatus, setProfileProgressPhotoStatus] = useState("");

  useEffect(() => {
    if (!profileSettingsModalOpen && !profileAvatarCropOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [profileSettingsModalOpen, profileAvatarCropOpen]);

  useEffect(() => {
    if (!profileProgressPhotosModalOpen || clientProgressPhotos.length < 2) return;

    setProfileProgressPhotoCompareIds((current) => {
      const availableIds = new Set(clientProgressPhotos.map((photo) => photo.id));
      const firstId = availableIds.has(current[0]) ? current[0] : clientProgressPhotos[1]?.id || "";
      let secondId = availableIds.has(current[1]) ? current[1] : clientProgressPhotos[0]?.id || "";

      if (firstId === secondId) {
        secondId = clientProgressPhotos.find((photo) => photo.id !== firstId)?.id || "";
      }

      return [firstId, secondId];
    });
  }, [profileProgressPhotosModalOpen, clientProgressPhotos]);
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

  const [telegramProfile, setTelegramProfile] = useState(createEmptyTelegramProfile);
  const [telegramDraft, setTelegramDraft] = useState(createEmptyTelegramProfile);
  const [telegramConnectOpen, setTelegramConnectOpen] = useState(false);
  const [telegramLinkCode, setTelegramLinkCode] = useState("");
  const [telegramLinking, setTelegramLinking] = useState(false);
  const telegramLoginContainerRef = useRef(null);
  const telegramAvatarRefreshRef = useRef(false);
  const [telegramLoginWidgetReady, setTelegramLoginWidgetReady] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState("");

  const [nutrition, setNutrition] = useState(defaultNutritionState);
  const [nutritionSearch, setNutritionSearch] = useState("");
  const [nutritionMeal, setNutritionMeal] = useState("breakfast");
  const [nutritionMealMenuOpen, setNutritionMealMenuOpen] = useState(false);
  const [nutritionProductUnitMenuOpen, setNutritionProductUnitMenuOpen] = useState(false);
  const [nutritionAmount, setNutritionAmount] = useState("100");
  const [nutritionAmountMode, setNutritionAmountMode] = useState("grams");
  const [nutritionAmountError, setNutritionAmountError] = useState("");
  const [nutritionProductErrors, setNutritionProductErrors] = useState({});
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
  const [nutritionUndoDelete, setNutritionUndoDelete] = useState(null);
  const nutritionUndoTimerRef = useRef(null);
  const [nutritionDeleteConfirmOpen, setNutritionDeleteConfirmOpen] = useState(false);
  const [nutritionBarcode, setNutritionBarcode] = useState("");
  const [nutritionPhotoName, setNutritionPhotoName] = useState("");
  const [nutritionPhotoPreview, setNutritionPhotoPreview] = useState("");
  const [nutritionPhotoAnalyzing, setNutritionPhotoAnalyzing] = useState(false);
  const [nutritionPhotoAiResult, setNutritionPhotoAiResult] = useState("");
  const [nutritionPhotoAiCandidates, setNutritionPhotoAiCandidates] = useState([]);
  const [nutritionPhotoAiConfidence, setNutritionPhotoAiConfidence] = useState("");
  const [nutritionPhotoNotFoundOpen, setNutritionPhotoNotFoundOpen] = useState(false);
  const [nutritionAnalysisOpen, setNutritionAnalysisOpen] = useState(true);
  const [nutritionPickerOpen, setNutritionPickerOpen] = useState(false);
  const [nutritionSearchTab, setNutritionSearchTab] = useState("food");
  const [nutritionSearchResultLimit, setNutritionSearchResultLimit] = useState({
    key: "",
    limit: 8
  });
  const [selectedNutritionDateKey, setSelectedNutritionDateKey] = useState(todayNutritionKey());
  const [nutritionCalendarOpen, setNutritionCalendarOpen] = useState(false);
  const [nutritionCalendarMonthKey, setNutritionCalendarMonthKey] = useState(() => todayNutritionKey().slice(0, 7));
  const [nutritionZoukExpanded, setNutritionZoukExpanded] = useState(false);
  const [expandedNutritionMeals, setExpandedNutritionMeals] = useState({});
  const [fatSecretFoods, setFatSecretFoods] = useState([]);
  const [fatSecretLoading, setFatSecretLoading] = useState(false);
  const [fatSecretError, setFatSecretError] = useState("");
  const [nutritionFallbackSuggestions, setNutritionFallbackSuggestions] = useState([]);
  const [recentNutritionFoods, setRecentNutritionFoods] = useState([]);
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
    if (import.meta.env.DEV) console.debug(`⏱️ PERF START · ${label}`, meta);
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

    if (import.meta.env.DEV) console.debug(`⏱️ PERF · ${label}: ${ms} ms`, payload);

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

      setFirstSetupProfileHydrated(false);
      setFirstSetupCompletedInCloud(false);
      setFirstSetupCompletedInSession(false);
      setShowFirstSetupOnboarding(false);
      setOnboardingStep(0);
      setAppThemeCloudReady(false);
      setAiNutritionProfile(null);
      setAiNutritionProfileDraft(createEmptyAiNutritionProfileDraft());
      setAiNutritionSavedPlan(null);
      setTelegramProfile(createEmptyTelegramProfile());
      setTelegramDraft(createEmptyTelegramProfile());
      setTelegramStatus("");
      setTelegramConnectOpen(false);
      setProfileAccount({
        displayName: u?.displayName || "",
        avatarUrl: u?.photoURL || "",
        email: u?.email || ""
      });
      setProfileAccountDraft({
        displayName: u?.displayName || "",
        email: u?.email || ""
      });
      setProfileAccountAvatarFile(null);
      setProfileAccountAvatarPreview("");
      setProfileAccountStatus("");
      setNutritionCloudReady(false);
      setNutrition(defaultNutritionState);
      setRecentNutritionFoods([]);
      setUser(u);
      setIsLoggedIn(!!u);
      if (u?.uid) {
        const cachedWorkoutPlan = safeReadUserJsonStorage(STORAGE_KEY, u.uid, null);
        if (Array.isArray(cachedWorkoutPlan?.workouts) && cachedWorkoutPlan.workouts.length > 0) {
          setPlan(cachedWorkoutPlan);
        }
        const cachedNutrition = safeReadUserJsonStorage(NUTRITION_STORAGE_KEY, u.uid, null);
        if (cachedNutrition?.__uid === u.uid) {
          setNutrition({
            ...defaultNutritionState,
            ...cachedNutrition,
            goals: { ...defaultNutritionState.goals, ...(cachedNutrition.goals || {}) },
            days: cachedNutrition.days || {},
            favorites: cachedNutrition.favorites || defaultNutritionState.favorites,
            recent: cachedNutrition.recent || [],
            myFoods: cachedNutrition.myFoods || {}
          });
        }
        setRecentNutritionFoods(loadRecentNutritionFoods(u.uid));
        const cachedProfile = safeReadUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, u.uid, null);
        const cachedPlan = safeReadUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, u.uid, null);
        const cachedTelegram = safeReadUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, u.uid, null);
        const cachedWorkoutCalendar = safeReadUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, u.uid, null);

        if (hasRequiredAiNutritionProfileFields(cachedProfile)) {
          setAiNutritionProfile(cachedProfile);
          setAiNutritionProfileDraft((current) => ({ ...current, ...cachedProfile }));
        }
        if (cachedPlan) setAiNutritionSavedPlan(cachedPlan);
        if (cachedTelegram) {
          setTelegramProfile({ ...createEmptyTelegramProfile(), ...cachedTelegram });
          setTelegramDraft({ ...createEmptyTelegramProfile(), ...cachedTelegram });
        }
        if (Array.isArray(cachedWorkoutCalendar?.scheduledDates)) {
          setProfileWorkoutCalendarData(cachedWorkoutCalendar);
          setProfileWorkoutScheduledDates(cachedWorkoutCalendar.scheduledDates);
          setProfileWorkoutCalendarDraftDates(cachedWorkoutCalendar.scheduledDates);
        }

        const savedWorkoutModePreference = safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, u.uid, getDefaultWorkoutModePreference());
        setWorkoutModePreference(savedWorkoutModePreference || getDefaultWorkoutModePreference());
        setWorkoutModeRemember(Boolean(savedWorkoutModePreference?.remember));
      } else {
        setWorkoutModePreference(getDefaultWorkoutModePreference());
        setWorkoutModeRemember(false);
        setProfileWorkoutCalendarData({});
        setProfileWorkoutScheduledDates([]);
        setProfileWorkoutCalendarDraftDates([]);
        setProfileWorkoutCalendarEditing(false);
        setProfileWorkoutCalendarStatus("");
        setRecentNutritionFoods([]);
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
          const remoteProfile = roleData.aiNutritionProfile || roleData.profile || null;
          const remotePlan = roleData.aiNutritionPlan || null;
          const remoteProfileCompleted = hasRequiredAiNutritionProfileFields(remoteProfile);
          const remoteTheme = roleData.appTheme;
          const remoteScheduledDates = Array.isArray(roleData.workoutCalendar?.scheduledDates)
            ? roleData.workoutCalendar.scheduledDates
            : Array.isArray(roleData.workoutCalendar?.monthlyTrainingDates)
              ? roleData.workoutCalendar.monthlyTrainingDates
              : [];
          const remoteAccount = {
            displayName: roleData.accountProfile?.displayName || roleData.name || u.displayName || "",
            avatarUrl: roleData.accountProfile?.avatarUrl || roleData.avatarUrl || u.photoURL || "",
            email: u.email || roleData.email || ""
          };

          const resolvedRole = nextIsAdmin ? "admin" : (roleData.role || "client");
          setCurrentUserRole(resolvedRole);
          if (resolvedRole === "client") {
            setPage(normalizeClientPrimaryPage(
              safeReadUserJsonStorage(CLIENT_LAST_PAGE_STORAGE_KEY, u.uid, "main")
            ));
          }
          setProfileAccount(remoteAccount);
          setProfileAccountDraft({
            displayName: remoteAccount.displayName,
            email: remoteAccount.email
          });

          if (remoteTheme === "warm-light" || remoteTheme === "dark-green") {
            setAppTheme(remoteTheme);
          }

          if (remoteProfileCompleted) {
            setAiNutritionProfile(remoteProfile);
            setAiNutritionProfileDraft((prev) => ({ ...prev, ...remoteProfile }));

            try {
              safeWriteUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, u.uid, remoteProfile);
            } catch (_) {
              // ignore localStorage errors
            }
          }
          if (remotePlan) {
            setAiNutritionSavedPlan(remotePlan);
            safeWriteUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, u.uid, remotePlan);
          }
          setProfileWorkoutCalendarData(roleData.workoutCalendar || {});
          setProfileWorkoutScheduledDates(remoteScheduledDates);
          setProfileWorkoutCalendarDraftDates(remoteScheduledDates);
          safeWriteUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, u.uid, {
            ...(roleData.workoutCalendar || {}),
            scheduledDates: remoteScheduledDates
          });

          setFirstSetupCompletedInCloud(
            roleData.firstSetupCompleted === true ||
            roleData.firstSetupCompletedVersion === FIRST_SETUP_REQUIRED_VERSION ||
            remoteProfileCompleted
          );
          setAppThemeCloudReady(true);
        } catch (error) {
          console.error("User role check error", error);
          setCurrentUserRole(nextIsAdmin ? "admin" : "client");
        } finally {
          setFirstSetupProfileHydrated(true);
        }

        await Promise.allSettled([
          loadWorkoutsFromFirebase(u.uid),
          loadHistory(),
          loadNutritionFromFirebase(u.uid),
          loadProfileMeasurements(u.uid),
          loadClientProgressPhotos(u.uid),
          loadClientTrainerTasks(u.uid)
        ]);
        await Promise.allSettled([
          replayFailedHistorySaves(u.uid),
          replayFailedNutritionSync(u.uid),
          replayFailedMeasurementSaves(u.uid)
        ]);

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
            safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, u.uid, nextTelegram);
            if (
              nextTelegram.connected &&
              nextTelegram.telegramUserId &&
              (
                !nextTelegram.avatarUrl ||
                String(nextTelegram.avatarUrl).includes("api.telegram.org/file/bot")
              )
            ) {
              refreshTelegramAvatar();
            }
          }
        } catch (_) {
          // ignore Telegram profile loading errors
        }
      } else {
        setCurrentUserRole("client");
        setFirstSetupProfileHydrated(true);
        setAppThemeCloudReady(true);
        setNutritionCloudReady(false);
        setProfileMeasurements([]);
        setClientProgressPhotos([]);
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
    if (!user?.uid || !appThemeCloudReady) return;

    const safeTheme = appTheme === "warm-light" ? "warm-light" : "dark-green";
    setDoc(doc(db, "users", user.uid), {
      appTheme: safeTheme,
      appThemeUpdatedAt: new Date().toISOString()
    }, { merge: true }).catch((error) => console.warn("Theme sync error", error));
  }, [appTheme, appThemeCloudReady, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const remoteTheme = snapshot.data()?.appTheme;
        if (remoteTheme === "warm-light" || remoteTheme === "dark-green") {
          setAppTheme((currentTheme) => remoteTheme !== currentTheme ? remoteTheme : currentTheme);
        }
        setAppThemeCloudReady(true);
      },
      (error) => console.warn("Theme subscription error", error)
    );
  }, [user?.uid]);

  useEffect(() => {
    const hasTrainerDashboard = Boolean(
      isAdminClaim || currentUserRole === "admin" || currentUserRole === "trainer"
    );

    if (isLoggedIn && !appLoading && hasTrainerDashboard && page === "main") {
      setSelectedUserId(null);
      setPage("admin");
    }
  }, [appLoading, currentUserRole, isAdminClaim, isLoggedIn, page]);

  useEffect(() => {
    if (
      !isLoggedIn ||
      appLoading ||
      !user?.uid ||
      currentUserRole !== "client" ||
      !CLIENT_PRIMARY_PAGES.includes(page)
    ) return;

    safeWriteUserJsonStorage(CLIENT_LAST_PAGE_STORAGE_KEY, user.uid, page);

    const currentHistoryPage = window.history.state?.workoutAppPage;
    if (!currentHistoryPage) {
      window.history.replaceState(
        { ...(window.history.state || {}), workoutAppPage: page },
        ""
      );
    } else if (currentHistoryPage !== page) {
      window.history.pushState(
        { ...(window.history.state || {}), workoutAppPage: page },
        ""
      );
    }
  }, [appLoading, currentUserRole, isLoggedIn, page, user?.uid]);

  useEffect(() => () => {
    if (nutritionUndoTimerRef.current) {
      window.clearTimeout(nutritionUndoTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    safeWriteUserJsonStorage(STORAGE_KEY, user.uid, plan);
    addUserLocalBackup(WORKOUT_PLAN_BACKUP_STORAGE_KEY, user.uid, { plan }, 10);
  }, [plan, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !nutritionCloudReady) return;

    const localNutrition = {
      ...nutrition,
      __uid: user.uid,
      updatedAt: new Date().toISOString()
    };

    safeWriteUserJsonStorage(NUTRITION_STORAGE_KEY, user.uid, localNutrition);
    addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, user.uid, { nutrition: localNutrition }, 12);
  }, [nutrition, nutritionCloudReady, user?.uid]);

  useEffect(() => {
    const currentUser = auth.currentUser || user;

    if (!currentUser?.uid || !selectedWorkoutId || !workoutStarted) return;

    const draftAssignmentVersion =
      plan.workouts.find((workoutItem) => workoutItem.id === selectedWorkoutId)
        ?.assignedProgramUpdatedAt ||
      plan.assignedProgramUpdatedAt ||
      "";
    const draft = {
      uid: currentUser.uid,
      workoutId: selectedWorkoutId,
      selectedWorkoutId,
      currentExerciseIndex,
      workoutStartedAt,
      workoutFinishedAt,
      assignedProgramUpdatedAt: draftAssignmentVersion,
      assignmentVersion: draftAssignmentVersion,
      selectedReadiness: workoutReadiness,
      warmupCompletedSteps,
      warmupTimerDuration,
      warmupTimerSeconds,
      restTimerDuration,
      restTimerSeconds,
      plan,
      savedAt: new Date().toISOString()
    };

    const writeDraft = () => {
      safeWriteJsonStorage(getWorkoutDraftKey(currentUser.uid, selectedWorkoutId), {
        ...draft,
        savedAt: new Date().toISOString()
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") writeDraft();
    };

    writeDraft();
    window.addEventListener("pagehide", writeDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", writeDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    user?.uid,
    selectedWorkoutId,
    currentExerciseIndex,
    workoutStarted,
    workoutStartedAt,
    workoutFinishedAt,
    workoutReadiness,
    warmupCompletedSteps,
    warmupTimerDuration,
    warmupTimerSeconds,
    restTimerDuration,
    restTimerSeconds,
    plan
  ]);

  useEffect(() => {
    if (
      !isLoggedIn ||
      appLoading ||
      !user?.uid ||
      !firstSetupProfileHydrated ||
      firstSetupCompletedInSession ||
      currentUserRole !== "client"
    ) return;

    let completedForThisUser = false;

    try {
      completedForThisUser =
        localStorage.getItem(FIRST_SETUP_DONE_USER_STORAGE_KEY) === `${user.uid}:${FIRST_SETUP_REQUIRED_VERSION}` ||
        localStorage.getItem(`${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${user.uid}`) === FIRST_SETUP_REQUIRED_VERSION;
    } catch (_) {
      completedForThisUser = false;
    }

    const profileHasRequiredFields = hasRequiredAiNutritionProfileFields(aiNutritionProfile);

    if (firstSetupCompletedInCloud || profileHasRequiredFields) {
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
    firstSetupCompletedInSession,
    firstSetupProfileHydrated,
    firstSetupCompletedInCloud,
    currentUserRole
  ]);

  useEffect(() => {
    if (!isLoggedIn || appLoading) return;

    const hasTransientScreen =
      Boolean(selectedWorkoutId) ||
      Boolean(fullscreenVideo) ||
      workoutIncompleteConfirmOpen ||
      nutritionPickerOpen ||
      nutritionEditPageOpen ||
      dishIngredientPickerOpen ||
      nutritionCreateChoiceOpen ||
      nutritionDeleteConfirmOpen ||
      barcodeScannerOpen ||
      Object.values(expandedNutritionMeals || {}).some(Boolean);
    const shouldTrapAndroidBack =
      page !== "main" ||
      hasTransientScreen;

    if (!shouldTrapAndroidBack) return;

    const needsSyntheticBackEntry =
      hasTransientScreen ||
      !CLIENT_PRIMARY_PAGES.includes(page);

    if (needsSyntheticBackEntry && !window.history.state?.workoutAppBackTrap) {
      window.history.pushState({
        ...(window.history.state || {}),
        workoutAppBackTrap: true,
        workoutAppPage: CLIENT_PRIMARY_PAGES.includes(page) ? page : undefined
      }, "");
    }

    const onAndroidBack = (event) => {
      const targetPage = event.state?.workoutAppPage;
      if (
        !hasTransientScreen &&
        CLIENT_PRIMARY_PAGES.includes(targetPage) &&
        targetPage !== page
      ) {
        setPage(targetPage);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
        return;
      }

      const handled = handleAppBackNavigation();

      if (handled && hasTransientScreen) {
        setTimeout(() => {
          if (!window.history.state?.workoutAppBackTrap) {
            window.history.pushState({
              ...(window.history.state || {}),
              workoutAppBackTrap: true,
              workoutAppPage: CLIENT_PRIMARY_PAGES.includes(page) ? page : undefined
            }, "");
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
    workoutStarted,
    currentExerciseIndex,
    workoutReadinessOpen,
    workoutExitPromptOpen,
    workoutIncompleteConfirmOpen,
    workoutDraftRestorePrompt,
    isWorkoutSaved,
    fullscreenVideo,
    nutritionPickerOpen,
    nutritionEditPageOpen,
    dishIngredientPickerOpen,
    nutritionCreateChoiceOpen,
    nutritionDeleteConfirmOpen,
    barcodeScannerOpen,
    expandedNutritionMeals
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

    const controller = new AbortController();
    let timer;
    let cancelled = false;
    setFatSecretLoading(true);

    const runSearch = async () => {
      try {
        startPerformanceCheck("Local catalog search", { query });
        const localResults = await searchLocalNutritionFoods(query);
        if (cancelled) return;

        setFatSecretFoods(localResults);
        setFatSecretError("");
        setNutritionFallbackSuggestions([]);
        endPerformanceCheck("Local catalog search", { query, results: localResults.length });

        if (localResults.length >= 8) {
          setFatSecretLoading(false);
          return;
        }

        setFatSecretLoading(false);
        timer = window.setTimeout(async () => {
          try {
            setFatSecretLoading(true);
            startPerformanceCheck("Food search · nutrition API", { query, localResults: localResults.length });

            const response = await fetchAuthorizedWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
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
      } catch (error) {
        if (!cancelled && error.name !== "AbortError") {
          console.error(error);
          setFatSecretLoading(false);
          setFatSecretError("Локальный каталог временно недоступен.");
        }
      }
    };

    runSearch();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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

    const controller = new AbortController();
    let timer;
    let cancelled = false;
    setDishIngredientLoading(true);

    const runSearch = async () => {
      try {
        startPerformanceCheck("Local dish ingredient search", { query });
        const localResults = await searchLocalNutritionFoods(query, 20);
        if (cancelled) return;

        setDishIngredientExternalFoods(localResults);
        setDishIngredientFallbackSuggestions([]);
        endPerformanceCheck("Local dish ingredient search", { query, results: localResults.length });

        if (localResults.length >= 8) {
          setDishIngredientLoading(false);
          return;
        }

        setDishIngredientLoading(false);
        timer = window.setTimeout(async () => {
          try {
            setDishIngredientLoading(true);
            startPerformanceCheck("Food search · dish ingredient API", { query, localResults: localResults.length });

            const response = await fetchAuthorizedWithTimeout(`/api/nutrition/search?q=${encodeURIComponent(query)}`, {
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
      } catch (error) {
        if (!cancelled && error.name !== "AbortError") {
          console.error(error);
          setDishIngredientLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [dishIngredientPickerOpen, dishIngredientSearch]);

  useEffect(() => {
    if (!barcodeScannerOpen || !BARCODE_SEARCH_ENABLED) return undefined;

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
      const nutritionPayload = {
        ...userNutritionState,
        __uid: currentUser.uid,
        updatedAt: new Date().toISOString()
      };

      addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUser.uid, {
        id: backupId,
        nutrition,
        reason: "before_cloud_save"
      });

      saveNutritionStateWithMerge(currentUser.uid, nutritionPayload)
        .then(() => {
          removeUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUser.uid, backupId);
          setFailedNutritionSync(currentUser.uid, null);
        })
        .catch((error) => {
          console.error("Nutrition save error", error);
          showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase");
          setFailedNutritionSync(currentUser.uid, nutritionPayload);
          addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUser.uid, {
            nutrition: nutritionPayload,
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
      const now = Date.now();
      timerTickRef.current = now;
      setTimerTick(now);
    }, 1000);

    return () => clearInterval(timer);
  }, [workoutStartedAt, workoutFinishedAt]);

  const workout = useMemo(() => {
    return plan.workouts.find((w) => w.id === selectedWorkoutId);
  }, [selectedWorkoutId, plan]);

  const workoutVideoUrls = useMemo(() => [...new Set(
    (workout?.exercises || [])
      .map((exercise) => exercise?.video || exercise?.videoUrl || exercise?.videoURL || "")
      .filter(Boolean)
  )], [workout]);
  const workoutVideoCacheKey = workoutVideoUrls.join("|");

  useEffect(() => {
    if (!workoutVideoCacheKey || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready
      .then((registration) => {
        const worker = navigator.serviceWorker.controller || registration.active;
        worker?.postMessage({
          type: "PREFETCH_WORKOUT_VIDEOS",
          urls: workoutVideoCacheKey.split("|")
        });
      })
      .catch((error) => {
        console.warn("Workout video prefetch unavailable:", error);
      });
  }, [workout?.id, workoutVideoCacheKey]);

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
  }, [workoutStartedAt, workoutFinishedAt, timerTick]);

  const workoutMenuItems = WORKOUT_MENU_ITEMS;

  useEffect(() => {
    if (!workout) return;

    if (currentExerciseIndex > workout.exercises.length + 1) {
      setCurrentExerciseIndex(0);
    }
  }, [workout, currentExerciseIndex]);

  const lastExerciseResults = useMemo(() => {
    const result = {};
    const currentAssignmentVersion = String(
      workout?.assignedProgramUpdatedAt || plan.assignedProgramUpdatedAt || ""
    ).trim();
    const sortedHistory = [...history].sort(
      (a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
    );

    sortedHistory.forEach((historyWorkout) => {
      if (
        currentAssignmentVersion &&
        String(historyWorkout?.assignedProgramUpdatedAt || "").trim() !== currentAssignmentVersion
      ) {
        return;
      }
      if (!historyWorkout.exercises) return;

      historyWorkout.exercises.forEach((exercise) => {
        const exerciseKey = exercise?.id
          ? `id:${exercise.id}`
          : exercise?.name
            ? `name:${getCompletedWorkoutKey(exercise.name)}`
            : "";
        if (!exerciseKey || result[exerciseKey]) return;

        const completedSets = (exercise.sets || []).filter((set) => (
          Number(set?.reps) > 0 || parseWorkoutWeightValue(set?.weight) > 0
        ));
        if (!completedSets.length) return;

        const lastSet = completedSets[completedSets.length - 1];
        const reps = Number(lastSet?.reps) || 0;
        const weight = parseWorkoutWeightValue(lastSet?.weight);
        const sameReps = reps > 0 && completedSets.every((set) => Number(set?.reps) === reps);
        const sameWeight = weight > 0 && completedSets.every(
          (set) => parseWorkoutWeightValue(set?.weight) === weight
        );

        if (weight > 0) {
          result[exerciseKey] = sameReps && sameWeight
            ? `${completedSets.length}×${reps} · ${weight} кг`
            : `${completedSets.length} подх. · ${reps || "—"} повт. · ${weight} кг`;
          return;
        }

        const totalReps = completedSets.reduce((sum, set) => sum + (Number(set?.reps) || 0), 0);
        result[exerciseKey] = sameReps
          ? `${completedSets.length}×${reps}`
          : `${completedSets.length} подх. · ${totalReps} повторов`;
      });
    });

    return result;
  }, [history, workout?.assignedProgramUpdatedAt, plan.assignedProgramUpdatedAt]);

  function getLastExerciseText(exerciseItem) {
    const exerciseKey = exerciseItem?.id
      ? `id:${exerciseItem.id}`
      : exerciseItem?.name
        ? `name:${getCompletedWorkoutKey(exerciseItem.name)}`
        : "";
    const last = lastExerciseResults[exerciseKey];

    if (!last) {
      return "Прошлый раз: нет данных";
    }

    return `Прошлый раз: ${last}`;
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (loginSubmitting) return;

    const validation = validateLoginFields(login, password);
    setLoginFieldErrors(validation.errors);
    setLoginError("");
    setLoginNotice("");
    if (!validation.valid) return;

    setLoginSubmitting(true);
    try {
      const result = await signInWithEmailAndPassword(
        auth,
        validation.email,
        validation.password
      );

      setPage("main");
      setLoginError("");
      setLoginFieldErrors({});
      setSelectedUserId(null);

      loadHistory();
      loadWorkoutsFromFirebase(result.user.uid);
    } catch (error) {
      setLoginError(mapLoginAuthError(error));
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleLoginPasswordReset() {
    if (passwordResetSending) return;

    const validation = validateLoginFields(login, "", { passwordRequired: false });
    setLoginFieldErrors(validation.errors);
    setLoginError("");
    setLoginNotice("");
    if (!validation.valid) return;

    setPasswordResetSending(true);
    try {
      await sendPasswordResetEmail(auth, validation.email);
      setLoginNotice("Если аккаунт существует, ссылка для смены пароля отправлена на почту.");
    } catch (error) {
      setLoginError(
        error?.code === "auth/too-many-requests"
          ? "Слишком много запросов. Попробуй немного позже."
          : error?.code === "auth/network-request-failed"
            ? "Нет связи с сервером. Проверь интернет."
            : "Не удалось отправить ссылку. Попробуй ещё раз."
      );
    } finally {
      setPasswordResetSending(false);
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
      console.error(err);

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
    return getNutritionDayTotals(nutritionToday);
  }, [nutritionToday]);

  const nutritionHistoryDays = useMemo(() => {
    return buildNutritionHistoryDays(nutrition.days, 7);
  }, [nutrition.days]);

  const myNutritionFoods = useMemo(() => {
    return buildMyNutritionFoods(nutrition.myFoods);
  }, [nutrition.myFoods]);

  const nutritionSearchResults = useMemo(() => {
    return buildNutritionSearchResults({
      nutritionSearch,
      nutritionSearchTab,
      nutrition,
      nutritionToday,
      fatSecretFoods
    });
  }, [nutritionSearch, nutritionSearchTab, nutrition.favorites, nutrition.recent, nutrition.myFoods, nutritionToday.foods, fatSecretFoods]);

  const nutritionSearchResultKey = `${nutritionSearchTab}:${nutritionSearch.trim().toLowerCase()}`;
  const activeNutritionSearchResultLimit =
    nutritionSearchResultLimit.key === nutritionSearchResultKey
      ? nutritionSearchResultLimit.limit
      : 8;
  const visibleNutritionSearchResults = useMemo(
    () => nutritionSearchResults.slice(0, activeNutritionSearchResultLimit),
    [nutritionSearchResults, activeNutritionSearchResultLimit]
  );

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
    return calculateNutritionFoodStreak(nutrition.days || {}, nutritionDateKey || todayNutritionKey());
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
      const totals = getNutritionDayTotals(day);

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
        protein: Math.round(totals.protein || 0),
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
      const nextDay = updater(currentDay);
      return {
        ...prev,
        days: {
          ...prev.days,
          [nutritionDateKey]: {
            ...nextDay,
            updatedAt: new Date().toISOString()
          }
        }
      };
    });
  }

  function addNutritionFood(food, mealId = nutritionMeal, amount = nutritionAmount) {
    const amountValidation = validateNutritionAmount(amount);
    if (!amountValidation.valid) {
      setNutritionAmountError(amountValidation.error);
      return false;
    }

    const sourceFood = normalizeNutritionFood(food);
    const numericAmount = amountValidation.amount;
    const scale = getFoodScale(numericAmount, sourceFood, nutritionAmountMode);
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
          note: nutritionEditNote.trim(),
          description: nutritionEditNote.trim(),
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
    setNutritionAmountError("");
    return true;
  }

  function openNutritionCreateProductFromPhoto(aiFood = {}, fallbackName = "") {
    const getPositiveNumber = (primary, fallback, defaultValue = 0) => {
      const primaryNumber = Number(primary);
      if (Number.isFinite(primaryNumber) && primaryNumber > 0) return primaryNumber;
      const fallbackNumber = Number(fallback);
      return Number.isFinite(fallbackNumber) && fallbackNumber > 0 ? fallbackNumber : defaultValue;
    };
    const candidate = aiFood.candidates?.[0] || {};
    const rawAiResponse = aiFood.rawAiResponse || {};
    const brand = String(aiFood.brand || candidate.brand || rawAiResponse.brand || "").trim();
    const productName = String(aiFood.name || candidate.name || fallbackName || "Новый продукт").trim();
    const cleanName = brand && !productName.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName;
    const calories = getPositiveNumber(aiFood.calories, candidate.calories);
    const protein = getPositiveNumber(aiFood.protein, candidate.protein);
    const fat = getPositiveNumber(aiFood.fat, candidate.fat);
    const carbs = getPositiveNumber(aiFood.carbs, candidate.carbs);
    const estimatedGrams = getPositiveNumber(aiFood.estimatedGrams, candidate.estimatedGrams, 100);
    const labelText = String(
      aiFood.labelText || aiFood.fullText || aiFood.ocrText ||
      rawAiResponse.labelText || rawAiResponse.fullText || rawAiResponse.ocrText || ""
    ).trim();
    const ingredients = aiFood.ingredients || aiFood.detectedIngredients ||
      candidate.ingredients || candidate.detectedIngredients ||
      rawAiResponse.ingredients || rawAiResponse.detectedIngredients || [];
    const ingredientsText = Array.isArray(ingredients) ? ingredients.filter(Boolean).join(", ") : String(ingredients || "").trim();
    const netWeight = String(aiFood.netWeight || aiFood.servingSize || rawAiResponse.netWeight || rawAiResponse.servingSize || "").trim();
    const aiDescription = [
      brand ? `Бренд: ${brand}` : "",
      labelText ? `Текст с этикетки: ${labelText}` : "",
      ingredientsText ? `Состав: ${ingredientsText}` : "",
      netWeight ? `Масса нетто: ${netWeight}` : "",
      `Пищевая ценность на 100 г: ${calories} ккал; белки ${protein} г; жиры ${fat} г; углеводы ${carbs} г.`,
      aiFood.query ? `Данные AI: ${aiFood.query}` : "",
      aiFood.confidence ? `Уверенность AI: ${aiFood.confidence}` : "",
      estimatedGrams ? `Оценочный вес порции: ${estimatedGrams} г.` : ""
    ].filter(Boolean).join("\n");

    const draftFood = normalizeNutritionFood({
      id: `photo_${Date.now()}`,
      foodId: `photo_${Date.now()}`,
      name: cleanName || "Новый продукт",
      brand,
      note: aiDescription,
      description: aiDescription,
      portion: "100 г",
      portionAmount: 100,
      calories,
      protein,
      fat,
      carbs,
      source: "AI фото",
      amountMode: "grams",
      lastAmount: estimatedGrams,
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
    setNutritionAmount(String(estimatedGrams));
    setNutritionAmountMode("grams");
    setNutritionEditNote(aiDescription);
    setNutritionEditDetailsOpen(true);
    setNutritionEditPageOpen(true);
  }

  function createCustomNutritionFood() {
    const draftFood = {
      ...normalizeNutritionFood({
      id: `custom_${Date.now()}`,
      foodId: `custom_${Date.now()}`,
      name: "",
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
      }),
      name: ""
    };

    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setEditingNutritionItemId(null);
    setNutritionMealMenuOpen(false);
    setNutritionCreateChoiceOpen(false);
    setSelectedNutritionFood(draftFood);
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setNutritionEditNote("");
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(true);
  }

  function createCustomNutritionDish() {
    const draftDish = {
      ...normalizeNutritionFood({
      id: `dish_${Date.now()}`,
      foodId: `dish_${Date.now()}`,
      name: "",
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
      }),
      name: ""
    };

    setFatSecretError("");
    setNutritionFallbackSuggestions([]);
    setEditingNutritionItemId(null);
    setNutritionMealMenuOpen(false);
    setNutritionCreateChoiceOpen(false);
    setSelectedNutritionFood(draftDish);
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionAmountError("");
    setNutritionProductErrors({});
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
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setNutritionEditNote(foodForPicker.description || foodForPicker.note || "");
  }

  function updateNutritionFood(itemId, food, amount = nutritionAmount) {
    const amountValidation = validateNutritionAmount(amount);
    if (!amountValidation.valid) {
      setNutritionAmountError(amountValidation.error);
      return false;
    }

    const sourceFood = normalizeNutritionFood(food);
    const numericAmount = amountValidation.amount;
    const scale = getFoodScale(numericAmount, sourceFood, nutritionAmountMode);

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
          note: nutritionEditNote.trim(),
          description: nutritionEditNote.trim(),
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
    setNutritionAmountError("");
    return true;
  }

  function updateSelectedNutritionFoodField(field, value) {
    setNutritionProductErrors((current) => ({ ...current, [field]: "" }));
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
    setNutritionProductErrors((current) => ({ ...current, portionAmount: "" }));

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
      const totalWeight = sumDishIngredientWeight(nextIngredients);

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
      const totalWeight = sumDishIngredientWeight(nextIngredients);

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
    setNutritionProductErrors({});
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
    setNutritionProductErrors({});
    setNutritionEditPageOpen(false);
  }

  function confirmNutritionEditPage() {
    const validation = validateNutritionFoodDraft(selectedNutritionFood);
    setNutritionProductErrors(validation.errors);
    if (!validation.valid) {
      showAppError(
        "validation",
        Object.values(validation.errors)[0] || "Проверь данные продукта."
      );
      return;
    }

    setSelectedNutritionFood((current) => current ? {
      ...current,
      name: validation.values.name,
      calories: validation.values.calories,
      protein: validation.values.protein,
      fat: validation.values.fat,
      carbs: validation.values.carbs,
      portionAmount: validation.values.portionAmount,
      ...(current.type === "dish" ? { totalWeight: validation.values.portionAmount } : {})
    } : current);
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setNutritionProductErrors({});
    setNutritionEditPageOpen(false);
  }

  function closeSelectedNutritionFood() {
    setNutritionMealMenuOpen(false);
    setNutritionEditNote("");
    setSelectedNutritionFood(null);
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setNutritionAmountError("");
    setNutritionProductErrors({});
    setEditingNutritionItemId(null);
    setNutritionSearchTab("food");
    setShowRecentNutritionFoods(false);
    setNutritionPickerOpen(true);
  }

  function returnToNutritionMainAfterAdd() {
    setNutritionMealMenuOpen(false);
    setSelectedNutritionFood(null);
    setNutritionEditDetailsOpen(false);
    setNutritionEditPageOpen(false);
    setNutritionEditOriginalFood(null);
    setNutritionEditOriginalNote("");
    setEditingNutritionItemId(null);
    setNutritionCreateChoiceOpen(false);
    setNutritionSearch("");
    setNutritionSearchTab("food");
    setShowRecentNutritionFoods(false);
    setBarcodeScannerOpen(false);
    resetNutritionPhotoAiState();
    setNutritionPickerOpen(false);
    setExpandedNutritionMeals({});
    setPage("nutrition");
  }

  function canDeleteSelectedNutritionFood() {
    if (!selectedNutritionFood) return false;

    const editId = String(editingNutritionItemId || "");
    const selectedId = String(selectedNutritionFood.id || selectedNutritionFood.foodId || "");
    const selectedSource = String(selectedNutritionFood.source || "");

    return Boolean(
      editingNutritionItemId ||
      editId.startsWith("my:") ||
      selectedId.startsWith("my_") ||
      selectedSource === "Моя база" ||
      nutrition.myFoods?.[selectedId]
    );
  }

  function deleteSelectedNutritionFood(confirmed = false) {
    if (!selectedNutritionFood) return;

    const editId = String(editingNutritionItemId || "");
    const selectedId = String(selectedNutritionFood.id || selectedNutritionFood.foodId || "");
    const selectedSource = String(selectedNutritionFood.source || "");
    const isMyProduct =
      editId.startsWith("my:") ||
      selectedId.startsWith("my_") ||
      selectedSource === "Моя база" ||
      nutrition.myFoods?.[selectedId];

    if (isMyProduct) {
      if (!confirmed) {
        setNutritionDeleteConfirmOpen(true);
        return;
      }

      const myFoodId = editId.startsWith("my:")
        ? editId.replace("my:", "")
        : (nutrition.myFoods?.[selectedId] ? selectedId : makePersonalFoodKey(selectedNutritionFood));

      removeMyNutritionFood(myFoodId, selectedNutritionFood.name || "");
      setNutritionDeleteConfirmOpen(false);
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
  }

  function confirmNutritionFoodFromPicker() {
    if (!selectedNutritionFood) return;

    const amountValidation = validateNutritionAmount(nutritionAmount);
    setNutritionAmountError(amountValidation.error);
    if (!amountValidation.valid) {
      showAppError("validation", amountValidation.error);
      return;
    }

    if (editingNutritionItemId && String(editingNutritionItemId).startsWith("my:")) {
      const myFoodId = String(editingNutritionItemId).replace("my:", "");
      const numericAmount = amountValidation.amount;

      const foodToAdd = normalizeNutritionFood({
        ...selectedNutritionFood,
        id: myFoodId,
        foodId: myFoodId,
        source: "Моя база",
        note: nutritionEditNote.trim(),
        description: nutritionEditNote.trim(),
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

      if (!addNutritionFood(foodToAdd, nutritionMeal, numericAmount)) return;

      setRecentNutritionFoods(loadRecentNutritionFoods());
      setNutritionEditNote("");
      returnToNutritionMainAfterAdd();
      return;
    }

    if (editingNutritionItemId) {
      if (!updateNutritionFood(editingNutritionItemId, selectedNutritionFood, amountValidation.amount)) return;
      setEditingNutritionItemId(null);
    } else {
      if (!addNutritionFood(selectedNutritionFood, nutritionMeal, amountValidation.amount)) return;
    }

    setNutritionEditNote("");
    returnToNutritionMainAfterAdd();
  }

  function openNutritionPicker(mealId) {
    const targetMealId = mealId || getDefaultNutritionMealByTime();
    resetNutritionPhotoAiState();
    setNutritionMeal(targetMealId);
    setNutritionSearch("");
    setNutritionSearchTab("food");
    setNutritionAmount("100");
    setNutritionAmountMode("grams");
    setNutritionAmountError("");
    setNutritionProductErrors({});
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
    setNutritionPhotoNotFoundOpen(false);
    nutritionPhotoLastFileRef.current = null;
    if (nutritionPhotoInputRef.current) {
      nutritionPhotoInputRef.current.value = "";
    }
  }

  async function findExistingNutritionFoodFromPhoto(product = {}) {
    const query = String(product.query || product.name || "").trim();
    const currentFoods = [
      ...Object.values(nutrition.myFoods || {}),
      ...nutritionFoodDatabase,
      ...fatSecretFoods
    ].map(normalizeNutritionFood);
    let existingFood = findExistingPhotoFood(currentFoods, product);
    if (existingFood || query.length < 2) return existingFood;

    try {
      const localFoods = await searchLocalNutritionFoods(query, 24);
      existingFood = findExistingPhotoFood(localFoods, product);
      if (existingFood) return existingFood;

      const response = await fetchAuthorizedWithTimeout(
        `/api/nutrition/search?q=${encodeURIComponent(query)}`,
        {},
        12000
      );
      if (!response.ok) return null;

      const data = await response.json().catch(() => ({}));
      return findExistingPhotoFood(
        Array.isArray(data.foods) ? data.foods.map(normalizeNutritionFood) : [],
        product
      );
    } catch (error) {
      console.warn("[AI PHOTO] existing product lookup failed", error);
      return null;
    }
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
    setNutritionPhotoNotFoundOpen(false);
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

    if (file.size > 25 * 1024 * 1024) {
      setNutritionPhotoAiResult("Фото слишком большое. Сделай снимок ближе или выбери изображение до 25 МБ.");
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
    setNutritionPhotoNotFoundOpen(false);
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
      const response = await fetchAuthorizedWithTimeout("/api/ai-food-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageData,
          mimeType: "image/jpeg",
          fileName: file.name || "food-photo"
        })
      }, 45000);

      const data = await response.json().catch(() => ({}));
      endPerformanceCheck("AI photo · function request", { status: response.status, apiVersion: data.apiVersion || "" });

      if (!response.ok) {
        console.warn("[AI PHOTO] request failed", { status: response.status, apiVersion: data.apiVersion || "", code: data.code || "" });
        setNutritionPhotoAiCandidates([]);
        setNutritionPhotoAiConfidence("");
        setNutritionPhotoAiResult(data.message || "Не удалось распознать продукт на фото. Попробуй другое изображение.");
        return;
      }

      const product = data.product;
      const validProduct = isReliablePhotoFood(product, data);

      if (data.found === false || !validProduct) {
        console.warn("[AI PHOTO] invalid product", { apiVersion: data.apiVersion || "", product });
        setNutritionPhotoAiCandidates([]);
        setNutritionPhotoAiConfidence("");
        setNutritionPhotoAiResult("");
        setNutritionPhotoNotFoundOpen(true);
        return;
      }

      setNutritionPhotoAiConfidence(getNutritionPhotoAiConfidenceText(product.confidence));
      const existingFood = await findExistingNutritionFoodFromPhoto(product);
      if (existingFood) {
        resetNutritionPhotoAiState();
        setNutritionSearch(existingFood.name || product.name);
        setNutritionSearchTab("food");
        setNutritionEditPageOpen(false);
        setNutritionEditDetailsOpen(false);
        setNutritionMealMenuOpen(false);
        setNutritionCreateChoiceOpen(false);
        saveRecentNutritionFood(existingFood);
        addNutritionFoodFromPicker(existingFood);
        return;
      }

      openNutritionCreateProductFromPhoto({ ...product, rawAiResponse: data }, product.name);
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
      setNutritionPhotoAiCandidates([]);
      setNutritionPhotoAiConfidence("");
      setNutritionPhotoAiResult(
        error.name === "AbortError"
          ? "Анализ фото занял слишком много времени. Попробуй ещё раз."
          : "AI-фото сейчас недоступно. Попробуй ещё раз или создай продукт вручную."
      );
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

  function retryNutritionPhotoFromNotFound() {
    setNutritionPhotoNotFoundOpen(false);
    resetNutritionPhotoAiState();
    window.setTimeout(() => nutritionPhotoInputRef.current?.click(), 0);
  }

  function addNutritionProductManuallyFromPhoto() {
    setNutritionPhotoNotFoundOpen(false);
    resetNutritionPhotoAiState();
    createCustomNutritionFood();
  }

  function addFoodByBarcodeFromPicker() {
    const code = nutritionBarcode.trim();
    if (!code) return;

    const food = nutritionFoodDatabase.find((item) => item.barcode === code);
    if (food) {
      setBarcodeScannerError("");
      setBarcodeScannerOpen(false);
      addNutritionFoodFromPicker(food);
      setNutritionBarcode("");
      return;
    }

    setBarcodeScannerError("Штрихкод пока не найден. Проверь цифры или найди продукт по названию.");
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

  function removeNutritionFood(itemId, options = {}) {
    const { offerUndo = true } = options;
    const dateKey = nutritionDateKey;
    const currentFoods = nutrition.days?.[dateKey]?.foods || [];
    const removedIndex = currentFoods.findIndex((item) => item.id === itemId);
    const removedItem = removedIndex >= 0 ? currentFoods[removedIndex] : null;
    if (!removedItem) return false;

    const currentUid = auth.currentUser?.uid || user?.uid;
    if (currentUid) {
      addUserLocalBackup(NUTRITION_BACKUP_STORAGE_KEY, currentUid, {
        nutrition,
        reason: "before_remove_food",
        itemId
      });
    }

    updateNutritionDay((day) => ({
      ...day,
      foods: (day.foods || []).filter((item) => item.id !== itemId)
    }));

    if (offerUndo) {
      if (nutritionUndoTimerRef.current) {
        window.clearTimeout(nutritionUndoTimerRef.current);
      }

      setNutritionUndoDelete({
        dateKey,
        item: removedItem,
        index: removedIndex
      });
      nutritionUndoTimerRef.current = window.setTimeout(() => {
        setNutritionUndoDelete(null);
        nutritionUndoTimerRef.current = null;
      }, 6000);
    }

    return true;
  }

  function restoreNutritionFood() {
    if (!nutritionUndoDelete?.item || !nutritionUndoDelete.dateKey) return;

    const { dateKey, item, index } = nutritionUndoDelete;
    setNutrition((prev) => {
      const currentDay = prev.days?.[dateKey] || makeEmptyNutritionDay();
      const currentFoods = currentDay.foods || [];
      if (currentFoods.some((food) => food.id === item.id)) return prev;

      const nextFoods = [...currentFoods];
      nextFoods.splice(Math.min(Math.max(index, 0), nextFoods.length), 0, item);

      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...currentDay,
            foods: nextFoods,
            updatedAt: new Date().toISOString()
          }
        }
      };
    });

    if (nutritionUndoTimerRef.current) {
      window.clearTimeout(nutritionUndoTimerRef.current);
      nutritionUndoTimerRef.current = null;
    }
    setNutritionUndoDelete(null);
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

        saveNutritionStateWithMerge(currentUser.uid, {
          ...userNutritionState,
          updatedAt: new Date().toISOString()
        }).catch((error) => {
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
      const currentUid = auth.currentUser?.uid || user?.uid;
      const current = loadRecentNutritionFoods(currentUid);
      const next = current.filter((food) => {
        const id = String(food?.id || "");
        const foodIdValue = String(food?.foodId || "");
        const name = String(food?.name || "").trim().toLowerCase();

        return id !== cleanFoodId && foodIdValue !== cleanFoodId && (!cleanFoodName || name !== cleanFoodName);
      });
      if (currentUid) {
        saveRecentNutritionFoods(next, currentUid);
      }
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

    const cachedMeasurements = safeReadUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, []);
    const normalizedCachedMeasurements = (Array.isArray(cachedMeasurements) ? cachedMeasurements : [])
      .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

    if (normalizedCachedMeasurements.length) {
      setProfileMeasurements(normalizedCachedMeasurements);
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "measurements"));
      const remoteMeasurements = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      const measurements = Array.from(
        new Map(
          [...normalizedCachedMeasurements, ...remoteMeasurements]
            .filter((item) => item?.id)
            .map((item) => [item.id, item])
        ).values()
      )
        .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

      safeWriteUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, measurements);
      setProfileMeasurements(measurements);
      return measurements;
    } catch (error) {
      console.error("Ошибка загрузки замеров:", error);
      setProfileMeasurements(normalizedCachedMeasurements);
      return normalizedCachedMeasurements;
    }
  }

  async function loadClientProgressPhotos(uid = auth.currentUser?.uid) {
    if (!uid) {
      setClientProgressPhotos([]);
      return [];
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "progressPhotos"));
      const photos = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (
          getTrainerSummaryTimestamp(b.date || b.createdAt) -
          getTrainerSummaryTimestamp(a.date || a.createdAt)
        ));
      setClientProgressPhotos(photos);
      return photos;
    } catch (error) {
      console.warn("Client progress photos load failed:", error);
      setClientProgressPhotos([]);
      return [];
    }
  }

  function selectClientProgressPhoto(view, file) {
    setProfileProgressPhotoFiles((current) => ({ ...current, [view]: file || null }));

    if (!file) {
      setProfileProgressPhotoPreviews((current) => ({ ...current, [view]: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileProgressPhotoPreviews((current) => ({
        ...current,
        [view]: typeof reader.result === "string" ? reader.result : ""
      }));
    };
    reader.readAsDataURL(file);
  }

  async function saveClientProgressPhotos() {
    const uid = auth.currentUser?.uid;
    const requiredViews = ["front", "side", "back"];
    if (!uid) return;

    if (!requiredViews.every((view) => profileProgressPhotoFiles[view])) {
      setProfileProgressPhotoStatus("Добавь фото спереди, сбоку и со спины.");
      return;
    }

    setProfileProgressPhotoUploading(true);
    setProfileProgressPhotoStatus("");
    const photoId = createClientResourceId("progress");

    try {
      const uploadedEntries = await Promise.all(requiredViews.map(async (view) => {
        const compressed = await compressProgressPhoto(profileProgressPhotoFiles[view]);
        const photoRef = ref(storage, `progress-photos/${uid}/${photoId}/${view}.webp`);
        await uploadBytes(photoRef, compressed, {
          contentType: "image/webp",
          cacheControl: "public,max-age=31536000,immutable"
        });
        return [`${view}Url`, await getDownloadURL(photoRef)];
      }));
      const photoUrls = Object.fromEntries(uploadedEntries);
      const now = new Date().toISOString();
      const photo = {
        date: now.slice(0, 10),
        ...photoUrls,
        createdAt: now,
        createdByUid: uid,
        createdByRole: "client",
        source: "client"
      };

      await setDoc(doc(db, "users", uid, "progressPhotos", photoId), photo);
      setClientProgressPhotos((current) => [{ id: photoId, ...photo }, ...current]);
      setProfileProgressPhotoFiles({ front: null, side: null, back: null });
      setProfileProgressPhotoPreviews({ front: "", side: "", back: "" });
      setProfileProgressPhotoStatus("Фото прогресса сохранены.");
      await recordTrainerEvent(uid, "photo", "Клиент добавил фото прогресса");
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setProfileProgressPhotosModalOpen(false);
      setProfileProgressPhotoStatus("");
    } catch (error) {
      console.error("Client progress photos upload failed:", error);
      setProfileProgressPhotoStatus("Не получилось загрузить фото. Проверь соединение и попробуй ещё раз.");
    } finally {
      setProfileProgressPhotoUploading(false);
    }
  }

  async function saveProfileMeasurement() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const activeGoal = aiNutritionProfileDraft.goal || aiNutritionProfile?.goal || "recomp";
    const fields = getProfileMeasurementFields(activeGoal);
    const hasAnyValue = fields.some((field) => String(profileMeasurementDraft[field.id] || "").trim());

    if (!hasAnyValue) {
      setProfileMeasurementStatus("Заполни хотя бы один замер.");
      return;
    }

    setProfileMeasurementSaving(true);
    setProfileMeasurementStatus("");

    const measurementId = `measurement_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const measurement = {
      ...profileMeasurementDraft,
      id: measurementId,
      clientSaveId: measurementId,
      goal: activeGoal,
      goalLabel: getAiNutritionGoalLabel(activeGoal),
      date: now,
      createdAt: now
    };
    const queuedMeasurement = {
      id: measurementId,
      measurement,
      profileWeight: profileMeasurementDraft.weight || "",
      aiNutritionProfile: profileMeasurementDraft.weight
        ? {
            ...(aiNutritionProfile || {}),
            ...(aiNutritionProfileDraft || {}),
            weight: profileMeasurementDraft.weight
          }
        : null,
      queuedAt: now
    };
    const nextMeasurements = [
      measurement,
      ...(Array.isArray(profileMeasurements) ? profileMeasurements : [])
        .filter((item) => item?.id !== measurementId)
    ].sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

    setProfileMeasurements(nextMeasurements);
    safeWriteUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, nextMeasurements);
    setFailedMeasurementQueue(uid, [
      queuedMeasurement,
      ...getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
    ]);

    if (profileMeasurementDraft.weight) {
      setAiNutritionProfileDraft((prev) => ({ ...prev, weight: profileMeasurementDraft.weight }));
      setAiNutritionProfile((prev) => ({
        ...(prev || {}),
        ...(aiNutritionProfileDraft || {}),
        weight: profileMeasurementDraft.weight
      }));
    }

    try {
      await setDoc(doc(db, "users", uid, "measurements", measurementId), measurement);

      if (profileMeasurementDraft.weight) {
        await setDoc(doc(db, "users", uid), {
          aiNutritionProfile: queuedMeasurement.aiNutritionProfile,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      setFailedMeasurementQueue(
        uid,
        getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
      );
      setProfileMeasurementStatus("Замер сохранён. Эти данные можно использовать для коррекции плана.");
    } catch (error) {
      console.error("Ошибка сохранения замера:", error);
      setProfileMeasurementStatus("Замер сохранён на устройстве. Синхронизирую при появлении сети.");
    } finally {
      setProfileMeasurementSaving(false);
    }

    await new Promise((resolve) => setTimeout(resolve, 1400));
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
    setProfileActiveTab(profileMeasurementReturnTab);
    setPage("profile");
  }

  function renderFirstSetupOnboarding(forceVisible = false) {
    if (!showFirstSetupOnboarding && !forceVisible) return null;

    const totalSteps = 9;
    const profileName = String(aiNutritionProfileDraft.name || "").trim();
    const numericAge = Number(aiNutritionProfileDraft.age);
    const numericWeight = Number(String(aiNutritionProfileDraft.weight || "").replace(",", "."));
    const numericHeight = Number(aiNutritionProfileDraft.height);
    const stepCanContinue = [
      true,
      aiNutritionProfileDraft.sex === "male" || aiNutritionProfileDraft.sex === "female",
      profileName.length >= 2,
      Number.isFinite(numericAge) && numericAge >= 14 && numericAge <= 100,
      Number.isFinite(numericWeight) && numericWeight >= 30 && numericWeight <= 350,
      Number.isFinite(numericHeight) && numericHeight >= 120 && numericHeight <= 230,
      ["low", "medium", "high", "veryHigh"].includes(aiNutritionProfileDraft.activity),
      ["cut", "mass", "recomp", "maintain"].includes(aiNutritionProfileDraft.goal),
      hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft)
    ][onboardingStep];
    const handleOnboardingFieldSubmit = (event) => {
      if (event.key !== "Enter") return;

      event.preventDefault();
      if (!stepCanContinue) return;

      event.currentTarget.blur();
      setOnboardingStep((currentStep) => Math.min(currentStep + 1, totalSteps - 1));
    };
    const activityOptions = [
      ["low", "🪑", "Минимальный", "Мало движения"],
      ["medium", "🚶", "Умеренный", "1–3 тренировки в неделю"],
      ["high", "🏃", "Активный", "3–5 тренировок в неделю"],
      ["veryHigh", "🏋️", "Очень активный", "Спорт почти каждый день"]
    ];
    const goalOptions = [
      ["cut", "🔥", "Похудение", "Снизить вес"],
      ["mass", "💪", "Набор массы", "Набрать мышечную массу"],
      ["recomp", "🔄", "Рекомпозиция", "Снизить жир и набрать мышцы"],
      ["maintain", "🌿", "Поддержание формы", "Сохранить текущую форму"]
    ];
    const goalLabel = goalOptions.find(([id]) => id === aiNutritionProfileDraft.goal)?.[2] || "Рекомпозиция";
    const activityLabel = activityOptions.find(([id]) => id === aiNutritionProfileDraft.activity)?.[2] || "Умеренный";
    const onboardingTitles = [
      "Добро пожаловать!",
      "Выберите пол",
      "Как вас зовут?",
      "Сколько вам лет?",
      "Ваш текущий вес",
      "Ваш рост",
      "Уровень активности",
      "Ваша цель",
      "Проверьте ваши данные"
    ];
    const onboardingSubtitles = [
      "Давайте настроим ваш профиль, чтобы тренировки и рекомендации были максимально точными.",
      "Это поможет учитывать ваши особенности.",
      "Введите ваше имя.",
      "Введите ваш возраст.",
      "Введите ваш текущий вес.",
      "Введите ваш рост.",
      "Выберите, насколько вы активны.",
      "Выберите вашу основную цель.",
      "Проверьте и подтвердите данные перед созданием профиля."
    ];

    return (
      <div className="firstSetupOverlay">
        <div className="firstSetupCard">
          <div className="firstSetupProgress">
            <span>{onboardingStep + 1} / {totalSteps}</span>
            <div>
              {Array.from({ length: totalSteps }, (_, index) => (
                <i className={index <= onboardingStep ? "active" : ""} key={index} />
              ))}
            </div>
          </div>

          <header className="firstSetupHeader">
            <h2>{onboardingTitles[onboardingStep]}</h2>
            <p>{onboardingSubtitles[onboardingStep]}</p>
          </header>

          <div className="firstSetupBody">
            {onboardingStep === 0 && (
              <div className="firstSetupWelcomeVisual" aria-hidden="true">
                <span className="firstSetupClipboard">📋</span>
                <span className="firstSetupDumbbell">🏋️</span>
                <span className="firstSetupApple">🍏</span>
                <span className="firstSetupBottle">🧴</span>
              </div>
            )}

            {onboardingStep === 1 && (
              <div className="firstSetupChoiceGrid firstSetupSexGrid">
                <button
                  type="button"
                  className={aiNutritionProfileDraft.sex === "male" ? "active" : ""}
                  onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, sex: "male" }))}
                >
                  <span>👨🏻</span>
                  <strong>Мужчина</strong>
                </button>

                <button
                  type="button"
                  className={aiNutritionProfileDraft.sex === "female" ? "active" : ""}
                  onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, sex: "female" }))}
                >
                  <span>👩🏻</span>
                  <strong>Женщина</strong>
                </button>
              </div>
            )}

            {onboardingStep === 2 && (
              <label className="firstSetupField">
                <span>Ваше имя</span>
                <input
                  className="firstSetupInput"
                  placeholder="Например, Илья"
                  type="text"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={aiNutritionProfileDraft.name || ""}
                  onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, name: event.target.value }))}
                  onKeyDown={handleOnboardingFieldSubmit}
                />
              </label>
            )}

            {onboardingStep === 3 && (
              <label className="firstSetupField">
                <span>Возраст</span>
                <div className="firstSetupInputWithUnit">
                  <input
                    className="firstSetupInput"
                    inputMode="numeric"
                    placeholder="0"
                    type="number"
                    min="14"
                    max="100"
                    enterKeyHint="next"
                    value={aiNutritionProfileDraft.age || ""}
                    onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, age: event.target.value }))}
                    onKeyDown={handleOnboardingFieldSubmit}
                  />
                  <em>лет</em>
                </div>
              </label>
            )}

            {onboardingStep === 4 && (
              <label className="firstSetupField">
                <span>Вес</span>
                <div className="firstSetupInputWithUnit">
                  <input
                    className="firstSetupInput"
                    inputMode="decimal"
                    placeholder="0"
                    type="number"
                    min="30"
                    max="350"
                    step="0.1"
                    enterKeyHint="next"
                    value={aiNutritionProfileDraft.weight || ""}
                    onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, weight: event.target.value }))}
                    onKeyDown={handleOnboardingFieldSubmit}
                  />
                  <em>кг</em>
                </div>
              </label>
            )}

            {onboardingStep === 5 && (
              <label className="firstSetupField">
                <span>Рост</span>
                <div className="firstSetupInputWithUnit">
                  <input
                    className="firstSetupInput"
                    inputMode="numeric"
                    placeholder="0"
                    type="number"
                    min="120"
                    max="230"
                    enterKeyHint="next"
                    value={aiNutritionProfileDraft.height || ""}
                    onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, height: event.target.value }))}
                    onKeyDown={handleOnboardingFieldSubmit}
                  />
                  <em>см</em>
                </div>
              </label>
            )}

            {onboardingStep === 6 && (
              <div className="firstSetupActivityList">
                {activityOptions.map(([id, icon, label, description]) => (
                  <button
                    type="button"
                    key={id}
                    className={aiNutritionProfileDraft.activity === id ? "active" : ""}
                    onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, activity: id }))}
                  >
                    <span>{icon}</span>
                    <span><strong>{label}</strong><small>{description}</small></span>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}

            {onboardingStep === 7 && (
              <div className="firstSetupGoalStep">
                <div className="firstSetupGoalGrid">
                  {goalOptions.map(([id, icon, label, description]) => (
                    <button
                      type="button"
                      key={id}
                      className={aiNutritionProfileDraft.goal === id ? "active" : ""}
                      onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, goal: id }))}
                    >
                      <span>{icon}</span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
                <label className="firstSetupField firstSetupTargetWeight">
                  <span>Желаемый вес <small>(необязательно)</small></span>
                  <div className="firstSetupInputWithUnit">
                    <input
                      className="firstSetupInput"
                      inputMode="decimal"
                      placeholder="Например, 75"
                      type="number"
                      min="30"
                      max="350"
                      step="0.1"
                      enterKeyHint="next"
                      value={aiNutritionProfileDraft.targetWeight || ""}
                      onChange={(event) => setAiNutritionProfileDraft((prev) => ({ ...prev, targetWeight: event.target.value }))}
                      onKeyDown={handleOnboardingFieldSubmit}
                    />
                    <em>кг</em>
                  </div>
                </label>
              </div>
            )}

            {onboardingStep === 8 && (
              <div className="firstSetupReview">
                {[
                  ["⚥", "Пол", aiNutritionProfileDraft.sex === "female" ? "Женщина" : "Мужчина"],
                  ["👤", "Имя", profileName || "—"],
                  ["🎂", "Возраст", `${aiNutritionProfileDraft.age || "—"} лет`],
                  ["⚖️", "Вес", `${aiNutritionProfileDraft.weight || "—"} кг`],
                  ["📏", "Рост", `${aiNutritionProfileDraft.height || "—"} см`],
                  ["🏃", "Уровень активности", activityLabel],
                  ["🎯", "Цель", goalLabel],
                  ["↔", "Желаемый вес", aiNutritionProfileDraft.targetWeight ? `${aiNutritionProfileDraft.targetWeight} кг` : "Не указан"]
                ].map(([icon, label, value]) => (
                  <div key={label}>
                    <span>{icon}</span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
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

            {onboardingStep < totalSteps - 1 ? (
              <button
                type="button"
                className="firstSetupPrimary"
                disabled={!stepCanContinue}
                onClick={() => setOnboardingStep((prev) => prev + 1)}
              >
                {onboardingStep === 0 ? "Начать" : "Далее"}
              </button>
            ) : (
              <button
                type="button"
                className="firstSetupPrimary"
                disabled={
                  !hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft) ||
                  firstSetupSaveStatus === "saving"
                }
                onClick={async () => {
                  if (!hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft)) return;

                  setFirstSetupSaveStatus("saving");
                  const savedToCloud = await saveAiNutritionPlan(aiNutritionProfileDraft);

                  if (!savedToCloud) {
                    setFirstSetupSaveStatus("error");
                    showAppError(
                      "save",
                      "Профиль сохранён на устройстве, но не отправлен в облако. Проверь соединение и повтори."
                    );
                    return;
                  }

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
                  setFirstSetupSaveStatus("");
                  setPage("main");
                }}
              >
                {firstSetupSaveStatus === "saving"
                  ? "Сохраняю..."
                  : firstSetupSaveStatus === "error"
                    ? "Повторить сохранение"
                    : "Создать профиль"}
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
        <div className="workoutReadinessStage">
          <header className="workoutReadinessHeader">
            <span>Готовность к тренировке</span>
            <small>Выбери состояние перед разминкой</small>
          </header>

          <div className="workoutReadinessCard">
            <div className="workoutReadinessIntro">
              <span aria-hidden="true">◷</span>
              <div>
                <strong>Как ты себя чувствуешь?</strong>
                <p>Выбор влияет только на рабочий вес этой тренировки.</p>
              </div>
            </div>

            <div className="workoutReadinessGrid">
              {WORKOUT_READINESS_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={workoutReadinessPending?.id === option.id ? "active" : ""}
                  onClick={() => setWorkoutReadinessPending(option)}
                >
                  <span>{option.emoji}</span>
                  <span>
                    <strong>{option.title}</strong>
                    <small>
                      {option.id === "excellent"
                        ? "Немного увеличить рабочий вес"
                        : option.id === "good"
                          ? "Оставить план тренера без изменений"
                          : "Немного снизить нагрузку"}
                    </small>
                  </span>
                </button>
              ))}
            </div>

            <p className={`workoutReadinessConfirmation ${workoutReadinessPending ? "" : "empty"}`}>
              {workoutReadinessPending
                ? workoutReadinessPending.id === "good"
                  ? "Плановые веса тренера останутся без изменений."
                  : `Будет применена корректировка: ${workoutReadinessPending.volumeText}.`
                : "Выберите вариант самочувствия."}
            </p>
          </div>

          <div className="workoutReadinessActions">
            <button type="button" onClick={leaveWorkoutToPlan}>
              Назад
            </button>
            <button
              type="button"
              disabled={!workoutReadinessPending}
              onClick={() => applyWorkoutReadiness(workoutReadinessPending)}
            >
              Продолжить
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderWorkoutDraftRestoreModal() {
    if (
      !workoutDraftRestorePrompt ||
      workoutReadinessOpen ||
      postWorkoutFeedbackOpen ||
      fullscreenVideo ||
      showFirstSetupOnboarding
    ) {
      return null;
    }

    return (
      <div className="workoutDraftRestoreOverlay">
        <div
          className="workoutDraftRestoreCard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workoutDraftRestoreTitle"
          aria-describedby="workoutDraftRestoreDescription"
        >
          <span className="workoutDraftRestoreIcon" aria-hidden="true">↩</span>
          <h2 id="workoutDraftRestoreTitle">Продолжить тренировку?</h2>
          <p id="workoutDraftRestoreDescription">
            Найден незавершённый черновик. Можно восстановить прогресс или начать заново.
          </p>

          <div className="workoutDraftRestoreActions">
            <button
              type="button"
              className="workoutDraftRestartButton"
              onClick={() => handleWorkoutDraftChoice(false)}
            >
              Начать заново
            </button>
            <button
              type="button"
              className="workoutDraftRestoreButton"
              onClick={() => handleWorkoutDraftChoice(true)}
            >
              Восстановить
            </button>
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

  function openProfileAccount() {
    const currentUser = auth.currentUser;
    setProfileAccountDraft({
      displayName: profileAccount.displayName || currentUser?.displayName || "",
      email: profileAccount.email || currentUser?.email || ""
    });
    setProfileAccountAvatarFile(null);
    setProfileAccountAvatarPreview("");
    setProfileAccountStatus("");
    setProfileSettingsModalSection("account");
    setProfileSettingsModalOpen(true);
  }

  function openProfileAvatarCrop(file) {
    if (!file) return;
    if (profileAvatarCropSource) URL.revokeObjectURL(profileAvatarCropSource);
    setProfileAvatarCropSource(URL.createObjectURL(file));
    setProfileAvatarCropZoom(1);
    setProfileAvatarCropOffset({ x: 0, y: 0 });
    setProfileAvatarCropSize({ width: 0, height: 0 });
    setProfileAvatarCropOpen(true);
  }

  function closeProfileAvatarCrop() {
    setProfileAvatarCropOpen(false);
    profileAvatarCropDragRef.current = null;
  }

  function clampProfileAvatarCropOffset(offset, zoom = profileAvatarCropZoom) {
    const viewportSize = 240;
    const { width, height } = profileAvatarCropSize;
    if (!width || !height) return { x: 0, y: 0 };

    const baseScale = Math.max(viewportSize / width, viewportSize / height);
    const displayWidth = width * baseScale * zoom;
    const displayHeight = height * baseScale * zoom;
    const maxX = Math.max(0, (displayWidth - viewportSize) / 2);
    const maxY = Math.max(0, (displayHeight - viewportSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y))
    };
  }

  function changeProfileAvatarCropZoom(value) {
    const zoom = Math.max(1, Math.min(3, Number(value) || 1));
    setProfileAvatarCropZoom(zoom);
    setProfileAvatarCropOffset((current) => clampProfileAvatarCropOffset(current, zoom));
  }

  function startProfileAvatarCropDrag(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    profileAvatarCropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: profileAvatarCropOffset.x,
      offsetY: profileAvatarCropOffset.y
    };
  }

  function moveProfileAvatarCrop(event) {
    const drag = profileAvatarCropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setProfileAvatarCropOffset(clampProfileAvatarCropOffset({
      x: drag.offsetX + event.clientX - drag.startX,
      y: drag.offsetY + event.clientY - drag.startY
    }));
  }

  function endProfileAvatarCropDrag(event) {
    if (profileAvatarCropDragRef.current?.pointerId === event.pointerId) {
      profileAvatarCropDragRef.current = null;
    }
  }

  async function applyProfileAvatarCrop() {
    const image = profileAvatarCropImageRef.current;
    if (!image || !profileAvatarCropSize.width || !profileAvatarCropSize.height) return;

    const viewportSize = 240;
    const outputSize = 512;
    const baseScale = Math.max(
      viewportSize / profileAvatarCropSize.width,
      viewportSize / profileAvatarCropSize.height
    );
    const displayScale = baseScale * profileAvatarCropZoom;
    const displayWidth = profileAvatarCropSize.width * displayScale;
    const displayHeight = profileAvatarCropSize.height * displayScale;
    const drawX = viewportSize / 2 + profileAvatarCropOffset.x - displayWidth / 2;
    const drawY = viewportSize / 2 + profileAvatarCropOffset.y - displayHeight / 2;
    const outputRatio = outputSize / viewportSize;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      drawX * outputRatio,
      drawY * outputRatio,
      displayWidth * outputRatio,
      displayHeight * outputRatio
    );

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;

    const croppedFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setProfileAccountAvatarFile(croppedFile);
    setProfileAccountAvatarPreview(canvas.toDataURL("image/jpeg", 0.9));
    setProfileAccountStatus("");
    closeProfileAvatarCrop();
  }

  async function saveProfileAccount() {
    const currentUser = auth.currentUser;
    if (!currentUser || profileAccountSaving) return;

    const displayName = profileAccountDraft.displayName.trim();
    const nextEmail = profileAccountDraft.email.trim().toLowerCase();
    if (!displayName) {
      setProfileAccountStatus("Укажи имя.");
      return;
    }
    if (!nextEmail || !nextEmail.includes("@")) {
      setProfileAccountStatus("Укажи корректную почту.");
      return;
    }

    setProfileAccountSaving(true);
    setProfileAccountStatus("");

    try {
      let avatarUrl = profileAccount.avatarUrl || currentUser.photoURL || "";
      if (profileAccountAvatarFile) {
        const extension = profileAccountAvatarFile.name.split(".").pop() || "jpg";
        const avatarRef = ref(storage, `users/${currentUser.uid}/profile/avatar.${extension}`);
        await uploadBytes(avatarRef, profileAccountAvatarFile, {
          contentType: profileAccountAvatarFile.type || "image/jpeg"
        });
        avatarUrl = await getDownloadURL(avatarRef);
      }

      if (nextEmail !== String(currentUser.email || "").toLowerCase()) {
        await updateEmail(currentUser, nextEmail);
      }
      await updateProfile(currentUser, { displayName, photoURL: avatarUrl || null });

      const accountProfile = {
        displayName,
        avatarUrl,
        email: nextEmail,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "users", currentUser.uid), {
        name: displayName,
        email: nextEmail,
        avatarUrl,
        accountProfile,
        updatedAt: accountProfile.updatedAt
      }, { merge: true });

      setProfileAccount(accountProfile);
      setProfileAccountAvatarFile(null);
      setProfileAccountAvatarPreview("");
      setProfileAccountStatus("Данные аккаунта сохранены.");
      document.activeElement?.blur?.();
      profileSettingsModalBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => {
        setProfileSettingsModalOpen(false);
        setProfileAccountStatus("");
      }, 650);
    } catch (error) {
      console.error("Profile account save failed:", error);
      setProfileAccountStatus(
        error?.code === "auth/requires-recent-login"
          ? "Для смены почты нужно выйти и войти в аккаунт заново."
          : error?.code === "auth/email-already-in-use"
            ? "Эта почта уже используется другим аккаунтом."
            : "Не получилось сохранить данные. Проверь соединение."
      );
    } finally {
      setProfileAccountSaving(false);
    }
  }

  async function sendProfilePasswordReset() {
    const email = profileAccountDraft.email.trim() || auth.currentUser?.email || "";
    if (!email) {
      setProfileAccountStatus("Сначала укажи почту аккаунта.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setProfileAccountStatus(`Ссылка для смены пароля отправлена на ${email}.`);
    } catch (error) {
      console.error("Password reset failed:", error);
      setProfileAccountStatus("Не получилось отправить ссылку для смены пароля.");
    }
  }

  function logout() {
    signOut(auth);

    setProfileSettingsModalOpen(false);
    setProfileSettingsModalSection("settings");
    setProfileAvatarCropOpen(false);
    setProfileAccountStatus("");
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
    setRecentNutritionFoods([]);
    setNutritionCloudReady(false);
    setAiNutritionProfile(null);
    setAiNutritionProfileDraft(createEmptyAiNutritionProfileDraft());
    setAiNutritionSavedPlan(null);
    setTelegramProfile(createEmptyTelegramProfile());
    setTelegramDraft(createEmptyTelegramProfile());
    setTelegramStatus("");
    setTelegramConnectOpen(false);
    setWorkoutDraftRestorePrompt(null);
    setWorkoutReadinessOpen(false);
    setWorkoutReadinessPending(null);
    setWorkoutReadiness(null);
    setWorkoutExitPromptOpen(false);
    setWorkoutIncompleteConfirmOpen(false);
    setPendingWorkoutFeedback(null);
    setWarmupCompletedSteps([]);
    setWarmupTimerRunning(false);
    setRestTimerRunning(false);
    setWorkoutHistorySyncState("idle");
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
    setWorkoutDraftRestorePrompt(null);
    setWorkoutReadinessOpen(false);
    setWorkoutReadinessPending(null);
    setWorkoutReadiness(null);
    setWorkoutExitPromptOpen(false);
    setWorkoutIncompleteConfirmOpen(false);
    setPendingWorkoutFeedback(null);
    setWarmupCompletedSteps([]);
    setWarmupTimerRunning(false);
    setRestTimerRunning(false);
    setRestTimerSeconds(0);
    setExerciseHistoryOpenId("");
    setWorkoutHistorySyncState("idle");
    setPostWorkoutFeedback(null);
    setPostWorkoutFeedbackOpen(false);
    setOpenHistoryKey(null);
  }

  function leaveWorkoutToPlan() {
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setInlinePlayingVideoId("");
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setWorkoutReadinessOpen(false);
    setWorkoutReadinessPending(null);
    setWorkoutReadiness(null);
    setWorkoutExitPromptOpen(false);
    setWorkoutIncompleteConfirmOpen(false);
    setPendingWorkoutFeedback(null);
    setWarmupCompletedSteps([]);
    setWarmupTimerRunning(false);
    setRestTimerRunning(false);
    setRestTimerSeconds(0);
    setExerciseHistoryOpenId("");
    setPostWorkoutFeedback(null);
    setPostWorkoutFeedbackOpen(false);
    setIsWorkoutSaved(false);
    setShowWorkoutSavedCard(false);
    setWorkoutHistorySyncState("idle");
    setPage("workouts");
  }

  function requestLeaveWorkout() {
    if (workoutStarted && !isWorkoutSaved) {
      setWorkoutExitPromptOpen(true);
      return;
    }

    leaveWorkoutToPlan();
  }

  function handleAppBackNavigation() {
    if (fullscreenVideo) {
      setFullscreenVideo(null);
      return true;
    }

    if (workoutExitPromptOpen) {
      setWorkoutExitPromptOpen(false);
      return true;
    }

    if (workoutIncompleteConfirmOpen) {
      setWorkoutIncompleteConfirmOpen(false);
      setPendingWorkoutFeedback(null);
      return true;
    }

    if (workoutDraftRestorePrompt) {
      setWorkoutDraftRestorePrompt(null);
      return true;
    }

    if (workoutReadinessOpen && selectedWorkoutId) {
      leaveWorkoutToPlan();
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

    if (nutritionDeleteConfirmOpen) {
      setNutritionDeleteConfirmOpen(false);
      return true;
    }

    if (Object.values(expandedNutritionMeals || {}).some(Boolean)) {
      setExpandedNutritionMeals({});
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

    if (selectedWorkoutId && workoutStarted) {
      if (currentExerciseIndex > 0 && currentExerciseIndex <= (workout?.exercises?.length || 0)) {
        goToPreviousExercise();
      } else if (currentExerciseIndex === 0) {
        requestLeaveWorkout();
      } else if (isWorkoutSaved) {
        goBackToMain();
      } else {
        requestLeaveWorkout();
      }
      return true;
    }

    if (selectedWorkoutId) {
      leaveWorkoutToPlan();
      return true;
    }

    if (page !== "main") {
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
              sets: e.sets.map((s, idx) => {
                if (idx !== i) return s;

                const nextSet = { ...s, [field]: val };
                if (field === "enteredWeight" || field === "enteredReps") {
                  nextSet.completed = Boolean(
                    hasWorkoutSetEntry(nextSet.enteredWeight) ||
                    hasWorkoutSetEntry(nextSet.enteredReps)
                  );
                }

                return nextSet;
              })
            }
          : e
      )
    }));

    if (field === "enteredWeight" && hasWorkoutSetEntry(val)) {
      setExerciseValidationMessage("");
    }
  }

  function updateExerciseNote(exerciseId, note) {
    updateWorkout((currentWorkout) => ({
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((exercise) => (
        exercise.id === exerciseId
          ? { ...exercise, clientNote: note }
          : exercise
      ))
    }));
  }

  function openWorkoutExerciseModal(setModalId, exerciseId, triggerElement) {
    triggerElement?.blur();
    if (deckRef.current) {
      deckRef.current.scrollTop = 0;
    }
    setModalId(exerciseId);
  }

  function closeWorkoutExerciseModal(setModalId) {
    setModalId("");
    const restoreScroll = () => {
      if (deckRef.current) {
        deckRef.current.scrollTop = 0;
      }
    };
    window.requestAnimationFrame(() => {
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
    });
    window.setTimeout(restoreScroll, 100);
  }

  function startRestTimer(duration = restTimerDuration) {
    const nextDuration = Number(duration) || 90;
    setRestTimerDuration(nextDuration);
    setRestTimerSeconds(nextDuration);
    setRestTimerRunning(true);
  }

  function toggleWorkoutSetCompleted(exerciseId, setIndex) {
    const exerciseItem = workout?.exercises?.find((item) => item.id === exerciseId);
    const setItem = exerciseItem?.sets?.[setIndex];
    const nextCompleted = !setItem?.completed;

    updateSet(exerciseId, setIndex, "completed", nextCompleted);
    if (nextCompleted) {
      navigator.vibrate?.(45);
      startRestTimer();
    }
  }

  function toggleWarmupStep(stepIndex) {
    setWarmupCompletedSteps((current) => (
      current.includes(stepIndex)
        ? current.filter((item) => item !== stepIndex)
        : [...current, stepIndex]
    ));
  }

  function setWarmupTimerPreset(seconds) {
    setWarmupTimerDuration(seconds);
    setWarmupTimerSeconds(seconds);
    setWarmupTimerRunning(false);
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
    if (!uid || historyReplayInProgressRef.current) return;

    const queue = getFailedHistoryQueue(uid);
    if (!Array.isArray(queue) || !queue.length) return;

    historyReplayInProgressRef.current = true;
    const remaining = [];
    let syncedCount = 0;

    try {
      for (const item of queue) {
        try {
          if (!item?.entry) continue;
          const saveId = item.entry.clientSaveId || item.id;

          if (saveId) {
            await setDoc(doc(db, "users", uid, "history", saveId), item.entry);
            removePendingHistoryBackups(uid, saveId);
          } else {
            await addDoc(collection(db, "users", uid, "history"), item.entry);
          }
          syncedCount += 1;
        } catch (error) {
          remaining.push(item);
        }
      }

      setFailedHistoryQueue(uid, remaining);

      if (syncedCount > 0) {
        setWorkoutHistorySyncState(remaining.length ? "local" : "synced");
        await loadHistory();
        showAppError("savedLocal", "Локальные тренировки синхронизированы.");
      }
    } finally {
      historyReplayInProgressRef.current = false;
    }
  }

  async function replayFailedNutritionSync(uid = auth.currentUser?.uid) {
    if (!uid || nutritionReplayInProgressRef.current) return;

    const queuedSync = getFailedNutritionSync(uid);
    const queuedNutrition = queuedSync?.nutrition;
    if (!queuedNutrition) return;

    nutritionReplayInProgressRef.current = true;

    try {
      const savedNutrition = await saveNutritionStateWithMerge(uid, queuedNutrition);
      setFailedNutritionSync(uid, null);
      setNutrition((current) => ({
        ...mergeNutritionStates(current, savedNutrition, current.myFoods || {}),
        __uid: uid
      }));
      showAppError("savedLocal", "Локальные данные питания синхронизированы.");
    } catch (error) {
      console.error("Nutrition replay error", error);
    } finally {
      nutritionReplayInProgressRef.current = false;
    }
  }

  async function replayFailedMeasurementSaves(uid = auth.currentUser?.uid) {
    if (!uid || measurementReplayInProgressRef.current) return;

    const queue = getFailedMeasurementQueue(uid);
    if (!queue.length) return;

    measurementReplayInProgressRef.current = true;
    const remaining = [];
    let syncedCount = 0;

    try {
      for (const item of queue) {
        try {
          if (!item?.id || !item?.measurement) continue;

          await setDoc(doc(db, "users", uid, "measurements", item.id), item.measurement);

          if (item.aiNutritionProfile) {
            await setDoc(doc(db, "users", uid), {
              aiNutritionProfile: item.aiNutritionProfile,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }

          syncedCount += 1;
        } catch (error) {
          remaining.push(item);
        }
      }

      setFailedMeasurementQueue(uid, remaining);

      if (syncedCount > 0) {
        await loadProfileMeasurements(uid);
        showAppError(
          "savedLocal",
          remaining.length
            ? "Часть локальных замеров синхронизирована."
            : "Локальные замеры синхронизированы."
        );
      }
    } finally {
      measurementReplayInProgressRef.current = false;
    }
  }

  async function saveWorkoutToFirebase(feedbackOverride = null, allowIncomplete = false) {
    if (!workout || isSaving || isWorkoutSaved) return;

    const currentUser = auth.currentUser;
    const hasFilledSet = workout.exercises.some((exercise) =>
      exercise.sets?.some(isWorkoutSetCompleted)
    );
    const workoutCompletion = getWorkoutCompletion(workout);

    if (!currentUser) {
      showAppError("load", "Пользователь не найден. Перезайди в аккаунт.");
      return;
    }

    if (!hasFilledSet) {
      showAppError("validation", "Заполни вес или повторы хотя бы в одном подходе перед завершением тренировки.");
      return;
    }

    if (workoutCompletion.isPartial && !allowIncomplete) {
      setPendingWorkoutFeedback(feedbackOverride);
      setWorkoutIncompleteConfirmOpen(true);
      return;
    }

    const finishedAt = Date.now();
    const startedAt = workoutStartedAt || finishedAt;
    const durationSeconds = Math.max(0, Math.floor((finishedAt - startedAt) / 1000));
    const historySaveId = `workout_${workout.id}_${finishedAt}`;

    setWorkoutHistorySyncState("saving");
    setWorkoutFinishedAt(finishedAt);
    setTimerTick(finishedAt);
    timerTickRef.current = finishedAt;
    setIsSaving(true);
    setIsWorkoutSaved(false);
                    setShowWorkoutSavedCard(false);

    const historyEntry = {
      clientSaveId: historySaveId,
      date: new Date().toISOString(),
        userEmail: currentUser.email || "",
        workout: workout.name,
        workoutName: workout.name,
        workoutId: workout.id,
        assignedProgramId: workout.assignedProgramId || plan.assignedProgramId || "",
        assignedProgramName: workout.assignedProgramName || plan.assignedProgramName || "",
        assignedProgramUpdatedAt: workout.assignedProgramUpdatedAt || plan.assignedProgramUpdatedAt || "",
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
        clientComment: workoutClientComment.trim(),
        exercises: workout.exercises.map((exercise) => ({
          id: exercise.id || "",
          name: exercise.name,
          video: exercise.video || "",
          clientNote: String(exercise.clientNote || "").trim(),
          sets: exercise.sets.map((set, index) => {
            const completed = isWorkoutSetCompleted(set);
            const weight = set.enteredWeight || (set.completed ? set.weight : "") || "";
            const enteredReps = set.enteredReps || (set.completed ? set.reps : "") || "";

            return {
              set: index + 1,
              reps: completed ? enteredReps || set.reps || 8 : "",
              targetReps: set.reps || "",
              weight,
              completed,
              aiSuggestedWeight: set.weight || "",
              aiOriginalWeight: set.aiOriginalWeight || "",
              aiReadinessId: set.aiReadinessId || ""
            };
          })
        }))
      };

    const backupId = historySaveId;

    addUserLocalBackup(WORKOUT_HISTORY_BACKUP_STORAGE_KEY, currentUser.uid, {
      id: backupId,
      entry: historyEntry,
      reason: "before_history_save"
    });

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("workout_history_offline");
      }

      await setDoc(doc(db, "users", currentUser.uid, "history", historySaveId), historyEntry);
      removePendingHistoryBackups(currentUser.uid, backupId);

      await loadHistory();
      clearWorkoutDraft(currentUser.uid, workout.id);
      setIsWorkoutSaved(true);
      setWorkoutHistorySyncState("synced");
      setShowWorkoutSavedCard(true);
      navigator.vibrate?.([100, 70, 150]);

      setTimeout(() => {
        setShowWorkoutSavedCard(false);
      }, 1800);
    } catch (e) {
      console.error(e);
      enqueueFailedHistorySave(currentUser.uid, historyEntry, "history_save_failed");
      setHistory((prev) => [
        { id: historySaveId, ...historyEntry, pendingSync: true },
        ...prev.filter((item) => (item?.clientSaveId || item?.id) !== historySaveId)
      ]);
      clearWorkoutDraft(currentUser.uid, workout.id);
      setIsWorkoutSaved(true);
      setWorkoutHistorySyncState("local");
      setShowWorkoutSavedCard(true);
      navigator.vibrate?.([100, 70, 150]);
      showAppError("savedLocal", "Тренировка сохранена локально и будет синхронизирована позже.");
    } finally {
      setIsSaving(false);
    }
  }

  function getCompletedWorkoutSet(
    historyItems = [],
    currentAssignmentVersion = plan.assignedProgramUpdatedAt || ""
  ) {
    return buildCompletedWorkoutSet(historyItems, currentAssignmentVersion);
  }

  function isWorkoutCompletedByHistory(
    workoutItem,
    completedSet = getCompletedWorkoutSet(history)
  ) {
    return isWorkoutCompletedWithSet(
      workoutItem,
      completedSet,
      plan.assignedProgramUpdatedAt || ""
    );
  }

  function getNextUncompletedWorkoutIndex(workouts = [], completedSet = getCompletedWorkoutSet(history)) {
    return getNextUncompletedWorkoutIndexFromSet(
      workouts,
      completedSet,
      plan.assignedProgramUpdatedAt || ""
    );
  }

  async function loadWorkoutsFromFirebase(userIdFromClick, options = {}) {
    const preserveCurrentPlanOnError = options.preserveCurrentPlanOnError === true;
    const currentUser = auth.currentUser;
    const targetUserId = userIdFromClick || selectedUserId || currentUser?.uid;
    const isOwnPlan = currentUser?.uid === targetUserId;

    try {
      if (!targetUserId) {
        const emptyPlan = { workouts: [] };
        setPlan(emptyPlan);
        return emptyPlan;
      }

      const isAdminLoadingClient = Boolean(userIdFromClick || selectedUserId) && canUseAdminFeatures();

      startPerformanceCheck("Firebase · workouts load", {
        userId: String(targetUserId).slice(0, 6),
        ownPlan: isOwnPlan,
        admin: isAdminLoadingClient
      });

      // Client must only see workouts that trainer assigned in:
      // users/{uid}/workouts/{workoutId}
      // No starter/default/local fallback here.
      const [querySnapshot, profileSnapshot] = await Promise.all([
        getDocs(collection(db, "users", targetUserId, "workouts")),
        getDoc(doc(db, "users", targetUserId))
      ]);
      const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
      const assignedProgramUpdatedAt = profileData.assignedProgramUpdatedAt || profileData.assignedProgramAt || "";

      const workoutsFromDb = [];

      querySnapshot.forEach((workoutDoc) => {
        const data = workoutDoc.data();

        workoutsFromDb.push({
          id: workoutDoc.id,
          name: data.name || "Без названия",
          order: data.order,
          sortOrder: data.sortOrder,
          status: data.status || "planned",
          statusUpdatedAt: data.statusUpdatedAt || "",
          movedToDate: data.movedToDate || "",
          scheduledDate: data.scheduledDate || "",
          plannedDate: data.plannedDate || "",
          assignedBy: data.assignedBy || "",
          assignedAt: data.assignedAt || "",
          assignedProgramId: data.assignedProgramId || profileData.assignedProgramId || "",
          assignedProgramName: data.assignedProgramName || profileData.assignedProgramName || "",
          assignedProgramUpdatedAt: data.assignedProgramUpdatedAt || assignedProgramUpdatedAt,
          exercises: (data.exercises || []).map(normalizeExercise)
        });
      });

      const nextPlan = {
        assignedProgramId: profileData.assignedProgramId || "",
        assignedProgramName: profileData.assignedProgramName || "",
        assignedProgramUpdatedAt,
        workouts: sortWorkoutDays(workoutsFromDb)
      };

      if (isOwnPlan && currentUser?.uid) {
        clearStaleWorkoutCaches(currentUser.uid, assignedProgramUpdatedAt);
      }
      setPlan(nextPlan);

      if (isOwnPlan && currentUser?.uid) {
        safeWriteUserJsonStorage(STORAGE_KEY, currentUser.uid, nextPlan);
      }

      endPerformanceCheck("Firebase · workouts load", {
        workouts: workoutsFromDb.length
      });
      return nextPlan;
    } catch (err) {
      console.error("Ошибка загрузки тренировок:", err);
      if (preserveCurrentPlanOnError) {
        return plan;
      }

      if (isOwnPlan && currentUser?.uid) {
        const cachedPlan = safeReadUserJsonStorage(STORAGE_KEY, currentUser.uid, null);
        if (Array.isArray(cachedPlan?.workouts) && cachedPlan.workouts.length > 0) {
          setPlan(cachedPlan);
          showAppError("savedLocal", "Нет соединения. Показываю последнюю сохранённую программу.");
          return cachedPlan;
        }
      }

      const emptyPlan = { workouts: [] };
      setPlan(emptyPlan);
      showAppError("firebase", "Не получилось загрузить назначенные тренировки.");
      return emptyPlan;
    }
  }

  async function saveWorkoutsToFirebase(planOverride = null, options = {}) {
    try {
      const userId = selectedUserId || auth.currentUser?.uid;
      const hasPlanOverride = Boolean(planOverride && typeof planOverride === "object" && Array.isArray(planOverride.workouts));
      const planToSave = hasPlanOverride ? planOverride : plan;
      const saveOptions = hasPlanOverride ? options : {};
      const silent = Boolean(saveOptions.silent);

      if (!userId) {
        if (silent) setAdminClientStatus("Пользователь не найден.");
        else showAppError("load", "Пользователь не найден");
        return;
      }

      addLocalBackup(WORKOUT_PLAN_BACKUP_STORAGE_KEY, {
        plan: planToSave,
        reason: "before_workouts_cloud_save",
        userId
      }, 10);

      const workoutsRef = collection(db, "users", userId, "workouts");
      const userRef = doc(db, "users", userId);
      const [existingWorkouts, userSnapshot] = await Promise.all([
        getDocs(workoutsRef),
        getDoc(userRef)
      ]);
      const userData = userSnapshot.exists() ? userSnapshot.data() : {};
      const nowIso = new Date().toISOString();
      const currentWorkoutIds = new Set((planToSave.workouts || []).map((workout) => workout.id));
      const batch = writeBatch(db);
      const nextWorkoutCalendar = syncWorkoutCalendarWithPlan(
        userData.workoutCalendar || {},
        planToSave.workouts || [],
        nowIso,
        auth.currentUser?.uid || ""
      );

      existingWorkouts.forEach((workoutDoc) => {
        if (!currentWorkoutIds.has(workoutDoc.id)) {
          batch.delete(workoutDoc.ref);
        }
      });

      for (const [workoutIndex, workout] of (planToSave.workouts || []).entries()) {
        batch.set(doc(db, "users", userId, "workouts", workout.id), {
          ...workout,
          id: workout.id,
          name: workout.name || `День ${workoutIndex + 1}`,
          order: workoutIndex + 1,
          sortOrder: workoutIndex + 1,
          assignedBy: auth.currentUser?.uid || "",
          assignedAt: workout.assignedAt || nowIso,
          exercises: (workout.exercises || []).map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            video: exercise.video || exercise.videoUrl || exercise.videoURL || "",
            videoAutoFilledFrom: exercise.videoAutoFilledFrom || "",
            rest: exercise.rest || "90 сек",
            requiresWeight: exercise.requiresWeight ?? exerciseUsesExternalWeight(exercise),
            usesWeight: exercise.requiresWeight ?? exerciseUsesExternalWeight(exercise),
            note: exercise.note || "",
            description: exercise.description || "",
            technique: exercise.technique || "",
            sets: makeThreeSets(exercise.sets, exercise.name?.includes("Пресс") ? 15 : 8).map((set) => ({
              ...(set?.id ? { id: set.id } : {}),
              reps: set?.reps ?? "",
              weight: set?.weight ?? ""
            }))
          }))
        }, { merge: true });
      }

      batch.set(userRef, {
        workoutCalendar: nextWorkoutCalendar,
        assignedWorkoutCount: (planToSave.workouts || []).length,
        updatedAt: nowIso
      }, { merge: true });

      await batch.commit();
      setAdminSelectedClient((prev) => prev?.id === userId ? { ...prev, workoutCalendar: nextWorkoutCalendar } : prev);
      setUsersList((prev) => prev.map((item) => item.id === userId ? { ...item, workoutCalendar: nextWorkoutCalendar } : item));
      if (auth.currentUser?.uid === userId) {
        setProfileWorkoutCalendarData(nextWorkoutCalendar);
        setProfileWorkoutScheduledDates(nextWorkoutCalendar.scheduledDates || []);
        setProfileWorkoutCalendarDraftDates(nextWorkoutCalendar.scheduledDates || []);
        safeWriteUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, userId, nextWorkoutCalendar);
      }
      if (silent) setAdminClientStatus(saveOptions.successMessage || "Изменения тренировки сохранены.");
      else showAppError("savedLocal", "Тренировки пользователя сохранены.");
    } catch (err) {
      console.error("Ошибка сохранения тренировок:", err);
      if (options?.silent) setAdminClientStatus("Не получилось сохранить изменения тренировки.");
      else showAppError("firebase", "Не получилось сохранить тренировки.");
    }
  }

  async function sendAdminTelegramMessage(client = adminSelectedClient, messageOverride = "") {
    const telegram = getClientTelegramProfile(client);
    const text = String(messageOverride || adminTelegramMessage || "").trim();

    if (!client?.id) {
      setAdminClientStatus("Сначала выбери клиента.");
      return false;
    }

    if (!telegram.connected || !telegram.username) {
      setAdminClientStatus("У клиента не привязан Telegram.");
      return false;
    }

    if (!text) {
      setAdminClientStatus("Напиши сообщение для клиента.");
      return false;
    }

    setAdminTelegramSending(true);

    try {
      const response = await fetchAuthorized("/api/telegram/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          text
        })
      });

      if (!response.ok) {
        throw new Error("Telegram backend error");
      }

      if (!messageOverride) setAdminTelegramMessage("");
      setAdminClientStatus("Telegram-сообщение отправлено.");
      await recordTrainerEvent(client.id, "message", "Сообщение тренера", text.slice(0, 160));
      return true;
    } catch (error) {
      console.error("Ошибка отправки Telegram:", error);
      setAdminClientStatus("Backend Telegram ещё не подключён или сообщение не отправилось.");
      return false;
    } finally {
      setAdminTelegramSending(false);
    }
  }

  async function sendTrainerClientMessage(text, client = adminSelectedClient) {
    const message = String(text || "").trim();
    if (!client?.id || !message) {
      setAdminClientStatus("Сначала выбери клиента и напиши сообщение.");
      return false;
    }

    const telegram = getClientTelegramProfile(client);
    if (telegram.connected && telegram.username) {
      return sendAdminTelegramMessage(client, message);
    }

    try {
      await addDoc(collection(db, "users", client.id, "trainerMessages"), {
        type: "trainer_message",
        text: message,
        status: "unread",
        createdAt: new Date().toISOString(),
        createdByUid: auth.currentUser?.uid || "",
        createdByEmail: auth.currentUser?.email || user?.email || ""
      });
      await recordTrainerEvent(client.id, "message", "Внутреннее сообщение", message.slice(0, 160));
      setAdminClientStatus("Telegram не подключён. Сообщение сохранено во внутренней истории клиента.");
      return true;
    } catch (error) {
      console.error("Trainer message save failed:", error);
      setAdminClientStatus("Не получилось сохранить сообщение клиенту.");
      return false;
    }
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

  async function loadTrainerClientSummaries(clients = []) {
    const requestId = trainerClientSummaryRequestRef.current + 1;
    trainerClientSummaryRequestRef.current = requestId;
    const safeClients = Array.isArray(clients) ? clients.filter((client) => client?.id) : [];

    if (!safeClients.length) {
      setTrainerClientSummaries({});
      setTrainerClientSummariesLoading(false);
      return;
    }

    setTrainerClientSummaries((previous) => Object.fromEntries(
      safeClients.map((client) => [client.id, getTrainerClientFastSummary(client, previous[client.id])])
    ));
    setTrainerClientSummariesLoading(false);
    const nextSummaries = {};
    let nextClientIndex = 0;
    const todayStart = getTrainerSummaryDayStart();
    const weekStart = getTrainerSummaryWeekStart();
    const sevenDayStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const thirtyDayStart = todayStart - 29 * 24 * 60 * 60 * 1000;

    const loadClientSummary = async (client) => {
      const [historyResult, nutritionResult, measurementsResult, paymentResult] = await Promise.allSettled([
        getDocs(collection(db, "users", client.id, "history")),
        getDoc(doc(db, "users", client.id, "nutrition", "state")),
        getDocs(collection(db, "users", client.id, "measurements")),
        getDoc(doc(db, "users", client.id, "payments", "current"))
      ]);
      const failedReads = [
        historyResult.status === "rejected" ? "history" : "",
        nutritionResult.status === "rejected" ? "nutrition" : "",
        measurementsResult.status === "rejected" ? "measurements" : "",
        paymentResult.status === "rejected" ? "payment" : ""
      ].filter(Boolean);

      if (failedReads.length) {
        console.warn(`Trainer summary partial load failed for ${client.id}: ${failedReads.join(", ")}`, {
          history: historyResult.status === "rejected" ? historyResult.reason : null,
          nutrition: nutritionResult.status === "rejected" ? nutritionResult.reason : null,
          measurements: measurementsResult.status === "rejected" ? measurementsResult.reason : null,
          payment: paymentResult.status === "rejected" ? paymentResult.reason : null
        });
      }

      const clientHistory = [];
      if (historyResult.status === "fulfilled") {
        historyResult.value.forEach((historyDoc) => {
          clientHistory.push({ id: historyDoc.id, ...historyDoc.data() });
        });
      }
      clientHistory.sort((a, b) => (
        getTrainerSummaryTimestamp(b.date || b.completedAt || b.createdAt) -
        getTrainerSummaryTimestamp(a.date || a.completedAt || a.createdAt)
      ));

      const clientMeasurements = [];
      if (measurementsResult.status === "fulfilled") {
        measurementsResult.value.forEach((measurementDoc) => {
          clientMeasurements.push({ id: measurementDoc.id, ...measurementDoc.data() });
        });
      }
      clientMeasurements.sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

      const nutritionState = nutritionResult.status === "fulfilled" && nutritionResult.value.exists()
        ? nutritionResult.value.data()
        : client?.nutritionState || null;
      const nutritionSummary = getTrainerNutritionSummary(nutritionState);
      const assignedProgramUpdatedAt = client.assignedProgramUpdatedAt || client.assignedProgramAt || "";
      const assignmentVersionKey = getTrainerAssignmentVersionKey(assignedProgramUpdatedAt);
      const completedWorkoutIds = new Set();

      if (assignmentVersionKey && historyResult.status === "fulfilled") {
        clientHistory.forEach((entry) => {
          const entryVersionKey = getTrainerAssignmentVersionKey(
            entry.assignedProgramUpdatedAt || entry.assignmentVersion
          );
          if (entry.workoutId && entryVersionKey === assignmentVersionKey) {
            completedWorkoutIds.add(entry.workoutId);
          }
        });
      }

      const assignedWorkoutCount = Number(client.assignedWorkoutCount) || 0;
      const payment = paymentResult.status === "fulfilled" && paymentResult.value.exists()
        ? paymentResult.value.data()
        : null;
      const workoutTimestamps = clientHistory
        .map((entry) => getTrainerSummaryTimestamp(entry.date || entry.completedAt || entry.createdAt))
        .filter(Boolean);
      const workoutDateKeysCurrentWeek = [...new Set(workoutTimestamps
        .filter((timestamp) => timestamp >= weekStart)
        .map((timestamp) => getTrainerSummaryDateKey(timestamp))
        .filter(Boolean)
      )];

      return {
        clientId: client.id,
        lastWorkoutAt: workoutTimestamps[0] || "",
        workouts7: workoutTimestamps.filter((timestamp) => timestamp >= sevenDayStart).length,
        workouts30: workoutTimestamps.filter((timestamp) => timestamp >= thirtyDayStart).length,
        workoutDateKeysCurrentWeek,
        ...nutritionSummary,
        lastMeasurementAt: clientMeasurements[0]
          ? clientMeasurements[0].date || clientMeasurements[0].createdAt || clientMeasurements[0].savedAt || ""
          : "",
        assignedProgramId: client.assignedProgramId || "",
        assignedProgramUpdatedAt,
        assignedWorkoutCount,
        completedWorkoutCount: completedWorkoutIds.size,
        plateau: getClientPlateauInfo(clientMeasurements),
        payment,
        paymentAttention: getClientPaymentAttention(payment),
        recentEvents: [
          ...clientHistory.slice(0, 3).map((entry) => ({
            id: `workout_${entry.id}`,
            type: "workout",
            title: entry.workoutName || entry.name || entry.workout || "Тренировка завершена",
            date: entry.date || entry.completedAt || entry.createdAt || ""
          })),
          ...(nutritionSummary.lastNutritionAt ? [{
            id: `nutrition_${client.id}_${nutritionSummary.lastNutritionAt}`,
            type: "nutrition",
            title: "Обновлено питание",
            date: nutritionSummary.lastNutritionAt
          }] : []),
          ...(clientMeasurements[0] ? [{
            id: `measurement_${clientMeasurements[0].id}`,
            type: "measurement",
            title: "Добавлен контрольный замер",
            date: clientMeasurements[0].date || clientMeasurements[0].createdAt || clientMeasurements[0].savedAt || ""
          }] : [])
        ],
        programCompletionPercent: assignedWorkoutCount > 0 && historyResult.status === "fulfilled"
          ? Math.min(100, Math.round(completedWorkoutIds.size / assignedWorkoutCount * 100))
          : null
      };
    };

    const workers = Array.from(
      { length: Math.min(4, safeClients.length) },
      async () => {
        while (nextClientIndex < safeClients.length) {
          const client = safeClients[nextClientIndex];
          nextClientIndex += 1;

          try {
            nextSummaries[client.id] = await loadClientSummary(client);
          } catch (error) {
            console.warn(`Trainer summary load failed for ${client.id}:`, error);
            nextSummaries[client.id] = {
              clientId: client.id,
              lastWorkoutAt: "",
              workouts7: 0,
              workouts30: 0,
              workoutDateKeysCurrentWeek: [],
              lastNutritionAt: "",
              nutritionDays7: 0,
              averageCalories7: null,
              lastMeasurementAt: "",
              assignedProgramId: client.assignedProgramId || "",
              assignedProgramUpdatedAt: client.assignedProgramUpdatedAt || "",
              assignedWorkoutCount: Number(client.assignedWorkoutCount) || 0,
              completedWorkoutCount: 0,
              plateau: { isPlateau: false, days: 0, delta: null },
              payment: null,
              paymentAttention: getClientPaymentAttention(null),
              recentEvents: [],
              programCompletionPercent: null
            };
          }
        }
      }
    );

    await Promise.all(workers);

    if (trainerClientSummaryRequestRef.current === requestId) {
      setTrainerClientSummaries(nextSummaries);
      setTrainerClientSummariesLoading(false);
    }
  }

  function getAdminNutritionDaysList(nutritionState = null) {
    return Object.entries(nutritionState?.days || {})
      .map(([date, day]) => {
        const totals = getNutritionDayTotals(day);

        return {
          date,
          foods: day.foods || [],
          totals,
          score: buildAiNutritionDayModel({ ...defaultNutritionState, ...(nutritionState || {}) }, day, adminClientHistory).score
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
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
      const templatesRef = collection(db, "trainingTemplates");
      const currentUid = auth.currentUser?.uid || user?.uid || "";
      const templatesQuery = canUseAdminFeatures()
        ? templatesRef
        : query(templatesRef, where("ownerUid", "==", currentUid));
      const snapshot = await getDocs(templatesQuery);
      const templates = [];
      snapshot.forEach((templateDoc) => {
        templates.push({ id: templateDoc.id, ...templateDoc.data() });
      });
      templates.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));
      setAdminTrainingTemplates(templates);
      setAdminSelectedTemplateId((current) =>
        current && !templates.some((template) => template.id === current) ? "" : current
      );
    } catch (error) {
      console.error("Ошибка загрузки шаблонов:", error);
      setAdminTrainingTemplates([]);
    }
  }

  function openAdminProgramsOverview() {
    setAdminOpenWorkoutId("");
    setAdminProgramLibraryTab("overview");
    setPage("adminWorkouts");
  }

  function openAdminClientsWithFilter(filter = "all") {
    setAdminClientFilter(filter);
    setAdminClientPageOpen(false);
    setPage("adminUsers");
  }

  async function createAdminTemplateFromCurrentPlan() {
    const name = adminTemplateName.trim() || `Шаблон ${new Date().toLocaleDateString("ru-RU")}`;
    const id = `template_${Date.now()}`;
    const owner = getCurrentProgramOwner();
    const now = new Date().toISOString();

    try {
      await setDoc(doc(db, "trainingTemplates", id), {
        name,
        ownerUid: owner.uid,
        ownerRole: owner.role,
        createdByUid: owner.uid,
        updatedByUid: owner.uid,
        createdAt: now,
        updatedAt: now,
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

  async function replaceClientAssignedWorkouts(
    clientId,
    nextWorkouts,
    template,
    assignedProgramUpdatedAt
  ) {
    const currentWorkoutsSnapshot = await getDocs(collection(db, "users", clientId, "workouts"));
    const nextWorkoutIds = new Set(nextWorkouts.map((workoutItem) => workoutItem.id));
    const staleWorkoutDocs = currentWorkoutsSnapshot.docs.filter(
      (workoutDoc) => !nextWorkoutIds.has(workoutDoc.id)
    );
    const operationCount = staleWorkoutDocs.length + nextWorkouts.length + 1;

    if (operationCount > 500) {
      const error = new Error(
        `Программа слишком большая для атомарного назначения: ${operationCount} операций из 500.`
      );
      error.code = "workout-assignment-batch-limit";
      throw error;
    }

    const batch = writeBatch(db);

    staleWorkoutDocs.forEach((workoutDoc) => {
      batch.delete(workoutDoc.ref);
    });

    nextWorkouts.forEach((workoutItem) => {
      batch.set(doc(db, "users", clientId, "workouts", workoutItem.id), {
        ...workoutItem,
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt,
        assignedBy: auth.currentUser?.uid || ""
      });
    });

    const resetWorkoutCalendar = {
      scheduledDates: [],
      monthlyTrainingDates: [],
      plannedWorkouts: [],
      assignedProgramId: template.id,
      assignedProgramName: template.name,
      assignedProgramUpdatedAt,
      updatedAt: assignedProgramUpdatedAt
    };

    batch.set(doc(db, "users", clientId), {
      assignedProgramId: template.id,
      assignedProgramName: template.name,
      assignedProgramAt: assignedProgramUpdatedAt,
      assignedProgramUpdatedAt,
      assignedWorkoutCount: nextWorkouts.length,
      workoutCalendar: resetWorkoutCalendar
    }, { merge: true });

    await batch.commit();
    return currentWorkoutsSnapshot.size;
  }

  async function assignAdminTemplateToClient(clientId = selectedUserId, templateId = adminSelectedTemplateId) {
    const template = adminTrainingTemplates.find((item) => item.id === templateId);
    const client = adminSelectedClient?.id === clientId
      ? adminSelectedClient
      : usersList.find((item) => item.id === clientId);

    if (!clientId || !template) {
      setAdminClientStatus("Выбери клиента и шаблон.");
      return;
    }
    if (!canManageTrainingTemplate(template) || !canManageClientProgram(client)) {
      setAdminClientStatus("Можно назначать только свои программы своим клиентам.");
      return;
    }

    try {
      const assignedProgramUpdatedAt = new Date().toISOString();
      const nextWorkouts = buildClientWorkoutsFromTemplate(template);
      const deletedCount = await replaceClientAssignedWorkouts(
        clientId,
        nextWorkouts,
        template,
        assignedProgramUpdatedAt
      );

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }

      const resetWorkoutCalendar = {
        scheduledDates: [],
        monthlyTrainingDates: [],
        plannedWorkouts: [],
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramUpdatedAt,
        updatedAt: assignedProgramUpdatedAt
      };
      setAdminSelectedClient((prev) => prev?.id === clientId ? {
        ...prev,
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt,
        assignedWorkoutCount: nextWorkouts.length,
        workoutCalendar: resetWorkoutCalendar
      } : prev);
      setUsersList((prev) => prev.map((item) => item.id === clientId ? {
        ...item,
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt,
        assignedWorkoutCount: nextWorkouts.length,
        workoutCalendar: resetWorkoutCalendar
      } : item));

      setAdminClientStatus(`Назначено ${nextWorkouts.length} тренировок. Старые удалены: ${deletedCount}.`);
    } catch (error) {
      console.error("Ошибка назначения шаблона:", error);
      setAdminClientStatus(
        error?.code === "workout-assignment-batch-limit"
          ? error.message
          : "Не получилось назначить шаблон."
      );
    }
  }

  async function clearClientProgram(clientId = selectedUserId) {
    if (!clientId) {
      setAdminClientStatus("Выбери клиента.");
      return;
    }

    const confirmed = await showAppConfirm("Сбросить все назначенные тренировки клиента? У клиента будет пустая программа.");

    if (!confirmed) return;

    try {
      const assignedProgramUpdatedAt = new Date().toISOString();
      await clearClientAssignedWorkouts(clientId);
      await setDoc(doc(db, "users", clientId), {
        assignedProgramId: "",
        assignedProgramName: "",
        assignedProgramAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt,
        assignedWorkoutCount: 0,
        workoutCalendar: {
          scheduledDates: [],
          monthlyTrainingDates: [],
          plannedWorkouts: [],
          assignedProgramId: "",
          assignedProgramName: "",
          assignedProgramUpdatedAt,
          updatedAt: assignedProgramUpdatedAt
        }
      }, { merge: true });

      setPlan({ workouts: [] });
      setAdminClientStatus("Программа клиента сброшена.");
    } catch (error) {
      console.error("Ошибка сброса программы клиента:", error);
      setAdminClientStatus("Не получилось сбросить программу клиента.");
    }
  }

  async function assignSavedProgramToClient(clientId = selectedUserId, templateId = adminSelectedTemplateId) {
    const selectedTemplate = adminTrainingTemplates.find((item) => item.id === templateId);
    const client = adminSelectedClient?.id === clientId
      ? adminSelectedClient
      : usersList.find((item) => item.id === clientId);

    if (!clientId || !selectedTemplate) {
      setAdminClientStatus("Выбери клиента и сохранённую программу.");
      return;
    }
    if (!canManageTrainingTemplate(selectedTemplate) || !canManageClientProgram(client)) {
      setAdminClientStatus("Можно назначать только свои программы своим клиентам.");
      return;
    }

    try {
      const templateSnapshot = await getDoc(doc(db, "trainingTemplates", templateId));
      if (!templateSnapshot.exists()) {
        setAdminClientStatus("Сохранённая программа не найдена.");
        return;
      }

      const template = { id: templateSnapshot.id, ...templateSnapshot.data() };
      if (!canManageTrainingTemplate(template)) {
        setAdminClientStatus("Можно назначать только свои программы своим клиентам.");
        return;
      }

      const nextWorkouts = buildClientWorkoutsFromTemplate(template);
      const confirmed = await showAppConfirm(
        `Назначить клиенту программу “${template.name}”? Старые тренировки будут полностью удалены, будет назначено ${nextWorkouts.length} тренировок.`
      );
      if (!confirmed) return;

      const assignedProgramUpdatedAt = new Date().toISOString();
      const deletedCount = await replaceClientAssignedWorkouts(
        clientId,
        nextWorkouts,
        template,
        assignedProgramUpdatedAt
      );

      const resetWorkoutCalendar = {
        scheduledDates: [],
        monthlyTrainingDates: [],
        plannedWorkouts: [],
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramUpdatedAt,
        updatedAt: assignedProgramUpdatedAt
      };

      setAdminClientStatus(`Программа “${template.name}” назначена: ${nextWorkouts.length} тренировок. Старые удалены: ${deletedCount}.`);

      setAdminSelectedClient((prev) => prev?.id === clientId ? {
        ...prev,
        assignedProgramId: template.id,
        assignedProgramName: template.name,
        assignedProgramAt: assignedProgramUpdatedAt,
        assignedProgramUpdatedAt,
        assignedWorkoutCount: nextWorkouts.length,
        workoutCalendar: resetWorkoutCalendar
      } : prev);

      setUsersList((prev) => prev.map((client) => (
        client.id === clientId ? {
          ...client,
          assignedProgramId: template.id,
          assignedProgramName: template.name,
          assignedProgramAt: assignedProgramUpdatedAt,
          assignedProgramUpdatedAt,
          assignedWorkoutCount: nextWorkouts.length,
          workoutCalendar: resetWorkoutCalendar
        } : client
      )));

      if (clientId === selectedUserId || clientId === adminSelectedClient?.id) {
        setPlan({ workouts: sortWorkoutDays(nextWorkouts) });
      }
      await recordTrainerEvent(clientId, "program", "Назначена программа", template.name);
    } catch (error) {
      console.error("Ошибка назначения сохранённой программы:", error);
      setAdminClientStatus(
        error?.code === "workout-assignment-batch-limit"
          ? error.message
          : "Не получилось назначить сохранённую программу."
      );
    }
  }

  async function saveTrainerClientNutritionPlan(planDraft = {}) {
    const clientId = adminSelectedClient?.id || selectedUserId;
    if (!clientId) {
      setAdminClientStatus("Сначала выбери клиента.");
      return false;
    }

    const nextGoals = {
      calories: Math.max(0, Number(planDraft.calories) || 0),
      protein: Math.max(0, Number(planDraft.protein) || 0),
      fat: Math.max(0, Number(planDraft.fat) || 0),
      carbs: Math.max(0, Number(planDraft.carbs) || 0)
    };

    if (!nextGoals.calories || !nextGoals.protein) {
      setAdminClientStatus("Укажи калории и белок для плана питания.");
      return false;
    }

    if (planDraft.validFrom && planDraft.validTo && planDraft.validTo < planDraft.validFrom) {
      setAdminClientStatus("Дата окончания плана не может быть раньше даты начала.");
      return false;
    }

    const updatedAt = new Date().toISOString();
    const {
      goals: syncedGoals,
      nutritionPlan: nextPlan,
      nutritionState: nextNutritionState,
      userPatch,
      nutritionStatePatch
    } = buildTrainerNutritionPlanUpdate({
      planDraft,
      currentNutrition: adminClientNutrition,
      updatedAt,
      updatedBy: auth.currentUser?.uid || ""
    });

    try {
      await Promise.all([
        setDoc(doc(db, "users", clientId), userPatch, { merge: true }),
        setDoc(doc(db, "users", clientId, "nutrition", "state"), nutritionStatePatch, { merge: true })
      ]);

      setAdminSelectedClient((prev) => prev?.id === clientId ? {
        ...prev,
        nutritionGoals: syncedGoals,
        nutritionPlan: nextPlan,
        nutritionState: {
          ...(prev.nutritionState || {}),
          goals: nextNutritionState.goals,
          nutritionPlan: nextPlan,
          updatedAt
        }
      } : prev);
      setUsersList((prev) => prev.map((client) => client.id === clientId ? {
        ...client,
        nutritionGoals: syncedGoals,
        nutritionPlan: nextPlan,
        nutritionState: {
          ...(client.nutritionState || {}),
          goals: nextNutritionState.goals,
          nutritionPlan: nextPlan,
          updatedAt
        }
      } : client));
      setAdminClientNutrition(nextNutritionState);
      if (auth.currentUser?.uid === clientId) {
        setNutrition((prev) => ({
          ...prev,
          goals: {
            ...(prev.goals || {}),
            ...syncedGoals
          },
          nutritionPlan: nextPlan,
          updatedAt
        }));
      }
      await mirrorClientForTrainer({
        ...(adminSelectedClient || usersList.find((client) => client.id === clientId) || {}),
        id: clientId,
        nutritionGoals: nextGoals,
        nutritionPlan: nextPlan,
        nutritionState: nextNutritionState
      }, nextNutritionState);

      await recordTrainerEvent(
        clientId,
        "nutrition",
        "Назначен план питания",
        `${nextPlan.name} · ${syncedGoals.calories} ккал`
      );
      setAdminClientStatus("План питания назначен клиенту.");
      return true;
    } catch (error) {
      console.error("Trainer nutrition plan save error:", error);
      setAdminClientStatus("Не получилось назначить план питания.");
      return false;
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
            requiresWeight: exerciseUsesExternalWeight(exercise),
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
      const noteOwnerUid = auth.currentUser?.uid || "";
      await setDoc(doc(db, "trainerNotes", `${noteOwnerUid}_${adminSelectedClient.id}`), {
        ownerUid: noteOwnerUid,
        clientId: adminSelectedClient.id,
        text: adminTrainerNote,
        updatedAt: new Date().toISOString(),
        updatedByUid: noteOwnerUid
      }, { merge: true });
      await recordTrainerEvent(adminSelectedClient.id, "note", "Обновлена заметка тренера");
      setAdminClientStatus("Заметка тренера сохранена.");
    } catch (error) {
      console.error("Ошибка сохранения заметки:", error);
      setAdminClientStatus("Не получилось сохранить заметку.");
    }
  }

  async function loadClientTrainerTasks(uid = auth.currentUser?.uid) {
    if (!uid) {
      setClientTrainerTasks([]);
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "trainerTasks"));
      const tasks = snapshot.docs
        .map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }))
        .sort((a, b) => {
          const aCompleted = getTrainerTaskStatus(a).id === "completed" ? 1 : 0;
          const bCompleted = getTrainerTaskStatus(b).id === "completed" ? 1 : 0;
          return aCompleted - bCompleted ||
            String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
        });
      setClientTrainerTasks(tasks);
    } catch (error) {
      console.warn("Client trainer tasks load failed:", error);
      setClientTrainerTasks([]);
    }
  }

  async function updateClientTrainerTask(task, completed) {
    const uid = auth.currentUser?.uid;
    if (!uid || !task?.id) return;

    const nextTask = {
      ...task,
      status: completed ? "completed" : "progress",
      completedAt: completed ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString()
    };

    setClientTrainerTasks((current) => current.map((item) => item.id === task.id ? nextTask : item));
    try {
      await setDoc(doc(db, "users", uid, "trainerTasks", task.id), {
        status: nextTask.status,
        completedAt: nextTask.completedAt,
        updatedAt: nextTask.updatedAt
      }, { merge: true });
    } catch (error) {
      console.warn("Client trainer task update failed:", error);
      setClientTrainerTasks((current) => current.map((item) => item.id === task.id ? task : item));
      showAppError("load", "Не получилось обновить задачу.");
    }
  }

  function openClientTrainerTask(task) {
    const destination = getClientTrainerTaskDestination(task);
    if (!destination) return;

    setProfileTrainerNotificationsOpen(false);

    if (destination === "progressPhotos") {
      setProfileProgressPhotoStatus("");
      setProfileProgressPhotosModalOpen(true);
      return;
    }

    if (destination === "measurements") {
      setProfileMeasurementsModalOpen(true);
      return;
    }

    if (destination === "nutrition") {
      setPage("nutrition");
      return;
    }

    if (destination === "workouts") {
      openTrainingEntry();
      return;
    }

    if (destination === "profile") {
      setProfileBodyMetricsOpen(true);
      setProfileSettingsModalSection("profile");
      setProfileSettingsModalOpen(true);
      return;
    }

    if (destination === "progress") {
      setProfileProgressModalOpen(true);
    }
  }

  async function recordTrainerEvent(clientId, type, title, details = "") {
    if (!clientId || !title) return null;

    const eventId = createClientResourceId("event");
    const event = {
      type,
      title,
      details,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdByUid: auth.currentUser?.uid || "",
      createdByRole: currentUserRole || "trainer"
    };

    try {
      await setDoc(doc(db, "users", clientId, "trainerEvents", eventId), event);
      setAdminClientEvents((current) => [{ id: eventId, ...event }, ...current]);
      return { id: eventId, ...event };
    } catch (error) {
      console.warn("Trainer event save failed:", error);
      return null;
    }
  }

  async function createAdminClientTask() {
    const clientId = adminSelectedClient?.id;
    const title = adminNewTaskTitle.trim();
    if (!clientId || !title) {
      setAdminClientStatus("Напиши задачу для клиента.");
      return;
    }

    const taskId = createClientResourceId("task");
    const task = {
      title,
      dueDate: adminNewTaskDueDate || "",
      status: "progress",
      completedAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByUid: auth.currentUser?.uid || ""
    };

    try {
      await setDoc(doc(db, "users", clientId, "trainerTasks", taskId), task);
      setAdminClientTasks((current) => [{ id: taskId, ...task }, ...current]);
      setAdminNewTaskTitle("");
      setAdminNewTaskDueDate("");
      await recordTrainerEvent(clientId, "task", "Добавлена задача", title);
      setAdminClientStatus("Задача добавлена.");
    } catch (error) {
      console.error("Trainer task create failed:", error);
      setAdminClientStatus("Не получилось добавить задачу.");
    }
  }

  async function updateAdminClientTask(task, status) {
    const clientId = adminSelectedClient?.id;
    if (!clientId || !task?.id) return;

    const patch = {
      status,
      completedAt: status === "completed" ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "users", clientId, "trainerTasks", task.id), patch, { merge: true });
      setAdminClientTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...patch } : item));
      await recordTrainerEvent(
        clientId,
        "task",
        status === "completed" ? "Задача выполнена" : "Задача возвращена в работу",
        task.title
      );
    } catch (error) {
      console.error("Trainer task update failed:", error);
      setAdminClientStatus("Не получилось обновить задачу.");
    }
  }

  async function deleteAdminClientTask(task) {
    const clientId = adminSelectedClient?.id;
    if (!clientId || !task?.id) return;

    try {
      await deleteDoc(doc(db, "users", clientId, "trainerTasks", task.id));
      setAdminClientTasks((current) => current.filter((item) => item.id !== task.id));
      await recordTrainerEvent(clientId, "task", "Задача удалена", task.title);
    } catch (error) {
      console.error("Trainer task delete failed:", error);
      setAdminClientStatus("Не получилось удалить задачу.");
    }
  }

  async function saveAdminClientPayment() {
    const clientId = adminSelectedClient?.id;
    if (!clientId) return;

    const payment = {
      ...adminPaymentDraft,
      updatedAt: new Date().toISOString(),
      updatedByUid: auth.currentUser?.uid || ""
    };

    try {
      await setDoc(doc(db, "users", clientId, "payments", "current"), payment, { merge: true });
      setAdminClientPayment(payment);
      await recordTrainerEvent(clientId, "programControl", "Контроль программы обновлён", getClientPaymentAttention(payment).label);
      setAdminClientStatus("Контроль программы сохранён.");
    } catch (error) {
      console.error("Client program control save failed:", error);
      setAdminClientStatus("Не получилось сохранить контроль программы.");
    }
  }

  async function uploadAdminProgressPhotos() {
    const clientId = adminSelectedClient?.id;
    const selectedFiles = Object.entries(adminProgressPhotoFiles).filter(([, file]) => file);
    if (!clientId || !selectedFiles.length) {
      setAdminClientStatus("Выбери хотя бы одно фото прогресса.");
      return;
    }

    setAdminProgressPhotoUploading(true);
    const photoId = createClientResourceId("progress");

    try {
      const photoUrls = {};
      for (const [view, file] of selectedFiles) {
        const compressed = await compressProgressPhoto(file);
        const photoRef = ref(storage, `progress-photos/${clientId}/${photoId}/${view}.webp`);
        await uploadBytes(photoRef, compressed, {
          contentType: "image/webp",
          cacheControl: "public,max-age=31536000,immutable"
        });
        photoUrls[`${view}Url`] = await getDownloadURL(photoRef);
      }

      const photo = {
        date: adminProgressPhotoDate || new Date().toISOString().slice(0, 10),
        comment: adminProgressPhotoComment.trim(),
        ...photoUrls,
        createdAt: new Date().toISOString(),
        createdByUid: auth.currentUser?.uid || ""
      };
      await setDoc(doc(db, "users", clientId, "progressPhotos", photoId), photo);
      const nextPhoto = { id: photoId, ...photo };
      setAdminClientProgressPhotos((current) => [nextPhoto, ...current]);
      setAdminPhotoCompareIds((current) => [photoId, current[0] || ""]);
      setAdminProgressPhotoFiles({ front: null, side: null, back: null });
      setAdminProgressPhotoComment("");
      await recordTrainerEvent(clientId, "photo", "Добавлены фото прогресса", photo.comment);
      setAdminClientStatus("Фото прогресса сохранены.");
    } catch (error) {
      console.error("Progress photos upload failed:", error);
      setAdminClientStatus("Не получилось загрузить фото прогресса.");
    } finally {
      setAdminProgressPhotoUploading(false);
    }
  }

  async function deleteClientEverywhereFromAdminPanel(client) {
    if (!client?.id) return;

    if (!canUseAdminFeatures()) {
      if (!canManageClientProgram(client)) {
        setAdminClientStatus("Можно удалить только своего клиента.");
        return;
      }

      const confirmed = await showAppConfirm(`Удалить клиента ${client.email || client.name || client.id} из базы приложения? Аккаунт Firebase Auth останется активным.`);
      if (!confirmed) return;

      await deleteClientFromAdminPanel(client, { skipConfirm: true });
      return;
    }

    const confirmed = await showAppConfirm(`Полностью удалить клиента ${client.email || client.name || client.id}? Будет попытка удалить Auth через Cloud Function и профиль из Firestore.`);
    if (!confirmed) return;

    try {
      const response = await fetchAuthorized("/api/admin/deleteUser", {
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

    const confirmed = await showAppConfirm(
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
    setTrainerClientSummariesLoading(true);

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
      const clients = users.filter((item) => (
        canUseAdminFeatures()
          ? ["client", "trainer"].includes(item.role || "client") && item.email !== ADMIN_EMAIL
          : (item.role || "client") === "client" && item.email !== ADMIN_EMAIL
      ));

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

        const clients = applyUsers(users);
        void loadTrainerClientSummaries(clients);
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
          linkedClientDocs.push({
            ...linkDoc.data(),
            id: linkDoc.id,
            trainerLinkDocId: linkDoc.id
          });
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
            trainerLinkOnly: true,
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

      const clients = applyUsers(users);
      void loadTrainerClientSummaries(clients);
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
      setAdminClientStatus("Не получилось загрузить клиентов. Проверь права Firestore для роли тренера.");
      setTrainerClientSummariesLoading(false);
    }
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
      setPage("adminUsers");
      setAdminClientPageOpen(true);
      setAdminUsersSelectedTab("overview");
    }
    setAdminClientLoading(true);
    setAdminClientStatus("");
    setAdminClientTasks([]);
    setAdminClientProgressPhotos([]);
    setAdminClientEvents([]);
    setAdminClientPayment(null);
    setAdminPhotoCompareOpen(false);
    setAdminTaskComposerOpen(false);
    setAdminProgramControlOpen(false);

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

      const [tasksResult, photosResult, eventsResult, paymentResult, privateNoteResult] = await Promise.allSettled([
        getDocs(collection(db, "users", client.id, "trainerTasks")),
        getDocs(collection(db, "users", client.id, "progressPhotos")),
        getDocs(collection(db, "users", client.id, "trainerEvents")),
        getDoc(doc(db, "users", client.id, "payments", "current")),
        getDoc(doc(db, "trainerNotes", `${auth.currentUser?.uid || ""}_${client.id}`))
      ]);

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

      const clientTasks = tasksResult.status === "fulfilled"
        ? tasksResult.value.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }))
        : [];
      clientTasks.sort((a, b) => (
        getTrainerSummaryTimestamp(b.createdAt) - getTrainerSummaryTimestamp(a.createdAt)
      ));

      const clientProgressPhotos = photosResult.status === "fulfilled"
        ? photosResult.value.docs.map((photoDoc) => ({ id: photoDoc.id, ...photoDoc.data() }))
        : [];
      clientProgressPhotos.sort((a, b) => (
        getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt)
      ));

      const clientEvents = eventsResult.status === "fulfilled"
        ? eventsResult.value.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }))
        : [];
      clientEvents.sort((a, b) => (
        getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt)
      ));

      const clientPayment = paymentResult.status === "fulfilled" && paymentResult.value.exists()
        ? paymentResult.value.data()
        : null;
      const privateTrainerNote = privateNoteResult.status === "fulfilled" && privateNoteResult.value.exists()
        ? privateNoteResult.value.data()?.text || ""
        : freshClient.trainerNote || "";

      [
        ["tasks", tasksResult],
        ["photos", photosResult],
        ["events", eventsResult],
        ["payment", paymentResult],
        ["private note", privateNoteResult]
      ].forEach(([label, result]) => {
        if (result.status === "rejected") {
          console.warn(`Client ${label} load failed for ${client.id}:`, result.reason);
        }
      });

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
      setAdminClientTasks(clientTasks);
      setAdminClientProgressPhotos(clientProgressPhotos);
      setAdminClientEvents(clientEvents);
      setAdminClientPayment(clientPayment);
      setAdminPaymentDraft({
        assignedFrom: clientPayment?.assignedFrom || "",
        controlUntil: clientPayment?.controlUntil || clientPayment?.nextPaymentAt || clientPayment?.paidUntil || "",
        format: clientPayment?.format || clientPayment?.tariff || "",
        status: ["active", "review", "paused"].includes(clientPayment?.status)
          ? clientPayment.status
          : clientPayment?.status === "overdue"
            ? "paused"
            : clientPayment?.status === "pending"
              ? "review"
              : "active",
        note: clientPayment?.note || ""
      });
      setAdminPhotoCompareIds([
        clientProgressPhotos[0]?.id || "",
        clientProgressPhotos[1]?.id || ""
      ]);
      setAdminTrainerNote(privateTrainerNote);
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

    const confirmed = await showAppConfirm(`Удалить выбранные тренировки: ${adminSelectedHistoryIds.length}? Это действие нельзя отменить.`);
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
    const confirmed = await showAppConfirm(`Удалить "${workoutName}" из истории клиента? Это действие нельзя отменить.`);

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
        reminderOffsetsHours: Array.isArray(adminCalendarDraft.reminderOffsetsHours) && adminCalendarDraft.reminderOffsetsHours.length
          ? adminCalendarDraft.reminderOffsetsHours
          : [24],
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
      const response = await fetchAuthorized("/api/telegram/test-workout-reminder", {
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

  async function saveTrainerClientWorkoutSchedule(dates = [], client = adminSelectedClient) {
    const targetClient = client?.id ? client : (adminSelectedClient?.id ? adminSelectedClient : usersList.find((item) => item.id === selectedUserId));
    const clientId = targetClient?.id || selectedUserId;
    const workouts = sortWorkoutDays(plan.workouts || []);
    const cleanDates = [...new Set((Array.isArray(dates) ? dates : [])
      .map((date) => String(date || "").trim())
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();

    if (!clientId) {
      setAdminClientStatus("Сначала выбери клиента.");
      return false;
    }

    if (!workouts.length) {
      setAdminClientStatus("Сначала назначь клиенту программу тренировок.");
      return false;
    }

    if (cleanDates.length !== workouts.length) {
      setAdminClientStatus(`Нужно выбрать ${workouts.length} дат для ${workouts.length} тренировок.`);
      return false;
    }

    const nowIso = new Date().toISOString();
    const currentCalendar = targetClient?.workoutCalendar || {};
    const plannedWorkouts = buildWorkoutScheduleDraft(cleanDates, workouts);
    const nextCalendar = {
      ...currentCalendar,
      enabled: currentCalendar.enabled !== false,
      scheduledDates: cleanDates,
      monthlyTrainingDates: cleanDates,
      plannedWorkouts,
      assignedProgramId: targetClient?.assignedProgramId || workouts[0]?.assignedProgramId || plan.assignedProgramId || "",
      assignedProgramName: targetClient?.assignedProgramName || workouts[0]?.assignedProgramName || plan.assignedProgramName || "",
      assignedProgramUpdatedAt: targetClient?.assignedProgramUpdatedAt || workouts[0]?.assignedProgramUpdatedAt || plan.assignedProgramUpdatedAt || "",
      updatedAt: nowIso,
      updatedBy: auth.currentUser?.uid || ""
    };
    const nextWorkouts = workouts.map((workout, index) => ({
      ...workout,
      scheduledDate: cleanDates[index],
      plannedDate: cleanDates[index],
      scheduleOrder: index + 1
    }));
    const batch = writeBatch(db);

    nextWorkouts.forEach((workout, index) => {
      if (!workout.id) return;
      batch.set(doc(db, "users", clientId, "workouts", workout.id), {
        scheduledDate: cleanDates[index],
        plannedDate: cleanDates[index],
        scheduleOrder: index + 1
      }, { merge: true });
    });
    batch.set(doc(db, "users", clientId), {
      workoutCalendar: nextCalendar,
      trainingDays: currentCalendar.trainingDays || targetClient?.trainingDays || [],
      workoutTime: currentCalendar.workoutTime || targetClient?.workoutTime || "",
      updatedAt: nowIso
    }, { merge: true });

    try {
      await batch.commit();
      const patch = { workoutCalendar: nextCalendar };
      setPlan((current) => ({
        ...current,
        workouts: sortWorkoutDays(nextWorkouts)
      }));
      setAdminSelectedClient((prev) => prev?.id === clientId ? { ...prev, ...patch } : prev);
      setUsersList((prev) => prev.map((item) => item.id === clientId ? { ...item, ...patch } : item));
      setAdminCalendarDraft((prev) => ({
        ...prev,
        scheduledDates: cleanDates,
        monthlyTrainingDates: cleanDates
      }));
      setAdminClientStatus("Расписание тренировок сохранено.");
      await recordTrainerEvent(clientId, "program", "Сохранено расписание тренировок", `${cleanDates.length} дат`);
      return true;
    } catch (error) {
      console.error("Ошибка сохранения расписания тренировок:", error);
      setAdminClientStatus("Не получилось сохранить расписание тренировок.");
      return false;
    }
  }

  async function saveTrainerClientNotificationSettings(settings = {}, client = adminSelectedClient) {
    if (!client?.id) {
      setAdminClientStatus("Сначала выбери клиента.");
      return false;
    }

    const offsets = [...new Set(
      (Array.isArray(settings.offsets) ? settings.offsets : [])
        .map(Number)
        .filter((hours) => [24, 12, 3, 1].includes(hours))
    )].sort((a, b) => b - a);

    if (!offsets.length) {
      setAdminClientStatus("Выбери хотя бы один интервал напоминания.");
      return false;
    }

    const currentCalendar = client.workoutCalendar || {};
    const currentTelegram = getClientTelegramProfile(client);
    const enabled = settings.enabled !== false;
    const updatedAt = new Date().toISOString();
    const normalizeProgressInterval = (value) => [7, 14, 30].includes(Number(value))
      ? Number(value)
      : 14;
    const photoIntervalDays = normalizeProgressInterval(settings.progressPhotoIntervalDays);
    const measurementsIntervalDays = normalizeProgressInterval(settings.measurementsIntervalDays);
    const progressReminderSettings = {
      ...(currentCalendar.progressReminderSettings || client.progressReminderSettings || {}),
      photoEnabled: settings.progressPhotoEnabled === true,
      measurementsEnabled: settings.measurementsEnabled === true,
      intervalDays: 14,
      photoIntervalDays,
      measurementsIntervalDays,
      updatedAt
    };
    const scheduledDates = Array.isArray(settings.scheduledDates)
      ? [...new Set(settings.scheduledDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date))))].sort()
      : Array.isArray(currentCalendar.scheduledDates)
        ? currentCalendar.scheduledDates
        : Array.isArray(currentCalendar.monthlyTrainingDates)
          ? currentCalendar.monthlyTrainingDates
          : [];
    const nextCalendar = {
      ...currentCalendar,
      enabled: currentCalendar.enabled !== false,
      reminderEnabled: enabled,
      reminderOffsetsHours: offsets,
      progressReminderSettings,
      progressPhotoReminderEnabled: progressReminderSettings.photoEnabled,
      measurementsReminderEnabled: progressReminderSettings.measurementsEnabled,
      progressReminderIntervalDays: progressReminderSettings.intervalDays,
      progressPhotoReminderIntervalDays: photoIntervalDays,
      measurementsReminderIntervalDays: measurementsIntervalDays,
      scheduledDates,
      monthlyTrainingDates: scheduledDates,
      updatedAt
    };
    const nextTelegram = {
      ...currentTelegram,
      notificationsEnabled: enabled
    };

    try {
      await setDoc(doc(db, "users", client.id), {
        workoutCalendar: nextCalendar,
        telegram: nextTelegram,
        telegramNotificationsEnabled: enabled,
        updatedAt
      }, { merge: true });

      const patch = {
        workoutCalendar: nextCalendar,
        telegram: nextTelegram,
        telegramNotificationsEnabled: enabled
      };
      setAdminSelectedClient((prev) => prev?.id === client.id ? { ...prev, ...patch } : prev);
      setUsersList((prev) => prev.map((item) => item.id === client.id ? { ...item, ...patch } : item));
      setAdminCalendarDraft((prev) => ({
        ...prev,
        reminderEnabled: enabled,
        reminderOffsetsHours: offsets,
        progressReminderSettings,
        scheduledDates,
        monthlyTrainingDates: scheduledDates
      }));
      setAdminClientStatus(enabled ? "Настройки уведомлений сохранены." : "Telegram-напоминания выключены.");
      return true;
    } catch (error) {
      console.error("Ошибка сохранения Telegram reminders:", error);
      setAdminClientStatus("Не получилось сохранить настройки уведомлений.");
      return false;
    }
  }

  function openClientTelegramConnection() {
    window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}`, "_blank", "noopener,noreferrer");
    setAdminClientStatus("Открой бота на устройстве клиента и привяжи его аккаунт.");
  }

  async function deleteClientFromAdminPanel(client, options = {}) {
    if (!canUseTrainerFeatures()) {
      setAdminClientStatus("Удалять клиентов может только админ или тренер.");
      return;
    }

    if (!client?.id) return;

    if (!canUseAdminFeatures() && !canManageClientProgram(client)) {
      setAdminClientStatus("Можно удалить только своего клиента.");
      return;
    }

    if (!options.skipConfirm) {
      const confirmed = await showAppConfirm(`Удалить клиента ${client.email || client.name || client.id} из базы приложения? Аккаунт Firebase Auth может остаться активным.`);
      if (!confirmed) return;
    }

    try {
      const batch = writeBatch(db);
      const removeTrainerLinkOnly = !canUseAdminFeatures() && client.trainerLinkOnly;

      if (!removeTrainerLinkOnly) {
        batch.delete(doc(db, "users", client.id));
      }

      if (!canUseAdminFeatures()) {
        const trainerUid = auth.currentUser?.uid || user?.uid || "";
        if (trainerUid) {
          batch.delete(
            doc(db, "users", trainerUid, "trainerClients", client.trainerLinkDocId || client.id)
          );
        }
      }

      await batch.commit();

      if (selectedUserId === client.id) {
        setSelectedUserId(null);
        setAdminSelectedClient(null);
        setAdminClientHistory([]);
        setAdminClientNutrition(null);
        setAdminClientPageOpen(false);
      }

      await loadUsers();
      setAdminClientStatus(
        removeTrainerLinkOnly
          ? "Устаревшая карточка клиента удалена из списка тренера."
          : "Клиент удалён из базы приложения."
      );
    } catch (error) {
      console.error("Ошибка удаления клиента:", error);
      setAdminClientStatus("Не получилось удалить клиента.");
    }
  }

  function downloadTrainerClientExport(client, format = "excel") {
    if (!client?.id) return;
    const nutritionDays = getAdminNutritionDaysList(adminClientNutrition);
    const rows = [
      ["type", "date", "name", "calories", "protein", "fat", "carbs", "duration", "details"]
    ];

    adminClientHistory.forEach((item) => {
      rows.push([
        "workout",
        item.date || item.completedAt || "",
        item.workoutName || item.workout || item.name || "Тренировка",
        "",
        "",
        "",
        "",
        item.durationSeconds || "",
        item.postWorkoutFeedback?.title || item.readiness?.title || ""
      ]);
    });

    adminClientMeasurements.forEach((item) => {
      rows.push([
        "measurement",
        item.date || item.createdAt || "",
        "Замер",
        "",
        "",
        "",
        "",
        "",
        `weight ${item.weight || item.values?.weight || ""}`
      ]);
    });

    nutritionDays.forEach((day) => {
      rows.push([
        "nutrition",
        day.date || "",
        "day totals",
        Math.round(Number(day.totals?.calories) || 0),
        Math.round(Number(day.totals?.protein) || 0),
        Math.round(Number(day.totals?.fat) || 0),
        Math.round(Number(day.totals?.carbs) || 0),
        "",
        `score ${day.score || ""}`
      ]);
    });

    if (format === "pdf") {
      const htmlRows = rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${String(cell).replace(/[<>&]/g, "")}</td>`).join("")}</tr>`).join("");
      const popup = window.open("", "_blank", "noopener,noreferrer");
      if (popup) {
        popup.document.write(`<html><head><title>${client.name || client.email || "client"} report</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;font-size:12px}h1{font-size:22px}</style></head><body><h1>Отчёт клиента: ${client.name || client.email || client.id}</h1><table><thead><tr>${rows[0].map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${htmlRows}</tbody></table><script>window.print()</script></body></html>`);
        popup.document.close();
      }
      setAdminClientStatus("PDF-отчёт открыт в новом окне для сохранения через печать.");
      return;
    }

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${client.email || client.name || "client"}-trainer-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setAdminClientStatus("Excel-экспорт клиента подготовлен в CSV.");
  }

  async function deleteClientSubcollection(clientId, collectionName) {
    const snapshot = await getDocs(collection(db, "users", clientId, collectionName));
    const batch = writeBatch(db);
    snapshot.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }

  async function handleTrainerClientAction(action, client = adminSelectedClient) {
    if (!client?.id) {
      setAdminClientStatus("Сначала выбери клиента.");
      return false;
    }

    if (!canUseTrainerFeatures() || (!canUseAdminFeatures() && !canManageClientProgram(client))) {
      setAdminClientStatus("Нет прав на управление этим клиентом.");
      return false;
    }

    try {
      if (action === "archive" || action === "restore") {
        const archived = action === "archive";
        const patch = {
          archived,
          active: !archived,
          archivedAt: archived ? new Date().toISOString() : "",
          restoredAt: archived ? "" : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, "users", client.id), patch, { merge: true });
        setAdminSelectedClient((prev) => prev?.id === client.id ? { ...prev, ...patch } : prev);
        setUsersList((prev) => prev.map((item) => item.id === client.id ? { ...item, ...patch } : item));
        await recordTrainerEvent(client.id, "client", archived ? "Клиент архивирован" : "Клиент восстановлен");
        setAdminClientStatus(archived ? "Клиент архивирован." : "Клиент восстановлен.");
        return true;
      }

      if (action === "disable_notifications") {
        await saveTrainerClientNotificationSettings({
          enabled: false,
          offsets: client.workoutCalendar?.reminderOffsetsHours || [24],
          scheduledDates: client.workoutCalendar?.scheduledDates || client.workoutCalendar?.monthlyTrainingDates || []
        }, client);
        await recordTrainerEvent(client.id, "notifications", "Уведомления отключены");
        return true;
      }

      if (action === "export_excel" || action === "export_pdf") {
        downloadTrainerClientExport(client, action === "export_pdf" ? "pdf" : "excel");
        await recordTrainerEvent(client.id, "export", action === "export_pdf" ? "Экспорт PDF" : "Экспорт Excel");
        return true;
      }

      if (action === "delete") {
        await deleteClientFromAdminPanel(client);
        return true;
      }

      if (action === "reset_progress") {
        if (!(await showAppConfirm("Сбросить прогресс клиента? Профиль, программа и план питания сохранятся."))) return false;
        await Promise.all([
          deleteClientSubcollection(client.id, "history"),
          deleteClientSubcollection(client.id, "measurements"),
          deleteClientSubcollection(client.id, "progressPhotos"),
          deleteClientSubcollection(client.id, "nutritionDays"),
          setDoc(doc(db, "users", client.id, "nutrition", "state"), {
            days: {},
            updatedAt: new Date().toISOString()
          }, { merge: true }),
          setDoc(doc(db, "users", client.id), {
            nutritionState: {
              ...(client.nutritionState || {}),
              days: {},
              updatedAt: new Date().toISOString()
            }
          }, { merge: true })
        ]);
        const nextWorkouts = (plan.workouts || []).map((workout) => ({
          ...workout,
          status: "planned",
          movedToDate: "",
          statusUpdatedAt: new Date().toISOString()
        }));
        const workoutResetBatch = writeBatch(db);
        let workoutResetWrites = 0;
        nextWorkouts.forEach((workout, index) => {
          if (!workout.id) return;
          workoutResetBatch.set(doc(db, "users", client.id, "workouts", workout.id), {
            ...workout,
            order: index + 1,
            sortOrder: index + 1
          }, { merge: true });
          workoutResetWrites += 1;
        });
        if (workoutResetWrites) await workoutResetBatch.commit();
        setPlan((current) => ({ ...current, workouts: nextWorkouts }));
        setAdminClientHistory([]);
        setAdminClientMeasurements([]);
        setAdminClientProgressPhotos([]);
        setAdminClientNutrition((current) => current ? { ...current, days: {} } : current);
        await recordTrainerEvent(client.id, "reset", "Прогресс клиента сброшен");
        setAdminClientStatus("Прогресс сброшен. Программа и план питания сохранены.");
        return true;
      }

      if (action === "duplicate") {
        const newClientRef = doc(collection(db, "users"));
        const copyId = newClientRef.id;
        const copy = {
          role: "client",
          name: `${client.name || client.email || "Клиент"} копия`,
          email: client.email ? `copy-${Date.now()}-${client.email}` : "",
          profile: client.profile || {},
          aiNutritionProfile: client.aiNutritionProfile || client.profile || {},
          nutritionGoals: client.nutritionGoals || {},
          nutritionPlan: client.nutritionPlan || null,
          workoutCalendar: client.workoutCalendar || {},
          telegramNotificationsEnabled: client.telegramNotificationsEnabled !== false,
          assignedProgramId: client.assignedProgramId || "",
          assignedProgramName: client.assignedProgramName || "",
          assignedWorkoutCount: client.assignedWorkoutCount || (plan.workouts || []).length,
          trainerId: client.trainerId || auth.currentUser?.uid || "",
          assignedTrainerId: client.assignedTrainerId || client.trainerId || auth.currentUser?.uid || "",
          trainerEmail: client.trainerEmail || auth.currentUser?.email || user?.email || "",
          createdAt: new Date().toISOString(),
          createdByUid: auth.currentUser?.uid || ""
        };
        await setDoc(newClientRef, { ...copy, uid: copyId, id: copyId });
        const batch = writeBatch(db);
        (plan.workouts || []).forEach((workout, index) => {
          batch.set(doc(db, "users", copyId, "workouts", workout.id || createClientResourceId("workout")), {
            ...workout,
            order: index + 1,
            status: "planned",
            movedToDate: ""
          });
        });
        await batch.commit();
        setUsersList((prev) => [{ id: copyId, ...copy }, ...prev]);
        await recordTrainerEvent(client.id, "client", "Клиент дублирован", copy.name);
        setAdminClientStatus("Клиент дублирован без истории и прогресса.");
        return true;
      }
    } catch (error) {
      console.error("Trainer client action failed:", error);
      setAdminClientStatus("Не получилось выполнить действие клиента.");
      return false;
    }

    return false;
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
      console.error("Пользователь ещё не загружен");
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

      const pendingWorkouts = getFailedHistoryQueue(currentUser.uid)
        .filter((item) => item?.entry)
        .map((item) => ({
          id: item.entry.clientSaveId || item.id,
          ...item.entry,
          pendingSync: true
        }));
      const mergedWorkouts = new Map(
        workouts.map((item) => [item.clientSaveId || item.id, item])
      );
      pendingWorkouts.forEach((item) => {
        const key = item.clientSaveId || item.id;
        if (!mergedWorkouts.has(key)) mergedWorkouts.set(key, item);
      });
      const nextHistory = Array.from(mergedWorkouts.values());

      nextHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

      setHistory(nextHistory);
      endPerformanceCheck("Firebase · history load", { records: nextHistory.length });
    } catch (err) {
      console.error("Ошибка загрузки истории:", err);
      const pendingWorkouts = getFailedHistoryQueue(currentUser.uid)
        .filter((item) => item?.entry)
        .map((item) => ({
          id: item.entry.clientSaveId || item.id,
          ...item.entry,
          pendingSync: true
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      if (pendingWorkouts.length) setHistory(pendingWorkouts);
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

  function renderHistoryDeleteConfirm() {
    if (!historyDeleteCandidate) return null;

    const workoutDate = getTimestampValue(historyDeleteCandidate.date);
    const dateLabel = workoutDate
      ? new Date(workoutDate).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }).replace(".", "")
      : "без даты";

    return (
      <div className="historyDeleteOverlay" onClick={closeHistoryDeleteConfirm}>
        <div className="historyDeleteModal" onClick={(event) => event.stopPropagation()}>
          <div className="historyDeleteIcon">⌫</div>
          <h3>Удалить тренировку?</h3>
          <p>
            {historyDeleteCandidate.workout || "Тренировка"}
            <span>{dateLabel} · действие нельзя отменить</span>
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
    );
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

    deckRef.current?.querySelector("video")?.pause();
    setOpenVideoId(null);
    setInlinePlayingVideoId("");
    setRestTimerRunning(false);
    setRestTimerSeconds(0);
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
    }, 560);
  }

  function goToNextExercise() {
    if (!workout) return;

    if (
      workoutStarted &&
      currentExerciseIndex > 0 &&
      currentExerciseIndex <= workout.exercises.length
    ) {
      const currentExercise = workout.exercises[currentExerciseIndex - 1];
      const hasEnteredWeight = currentExercise?.sets?.some((set) =>
        hasWorkoutSetEntry(set.enteredWeight)
      );

      if (exerciseUsesExternalWeight(currentExercise) && !hasEnteredWeight) {
        setExerciseValidationMessage("Введите вес хотя бы в одном подходе. Значение 0 тоже считается введённым.");
        window.requestAnimationFrame(() => {
          setWeightInputRefs.current[`${currentExercise.id}:0`]?.focus();
        });
        navigator.vibrate?.(90);
        return;
      }
    }

    setExerciseValidationMessage("");
    deckRef.current?.querySelector("video")?.pause();
    setOpenVideoId(null);
    setInlinePlayingVideoId("");
    setRestTimerRunning(false);
    setRestTimerSeconds(0);
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
    }, 560);
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

  function openIndividualWorkouts() {
    saveWorkoutModePreference("individual", workoutModeRemember);
    setSelectedWorkoutId(null);
    setIndividualWorkoutIndex(0);
    setIndividualWorkoutIndexInitialized(false);
    setPage("workouts");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    const currentUserId = (auth.currentUser || user)?.uid;
    if (currentUserId) {
      loadWorkoutsFromFirebase(currentUserId, { preserveCurrentPlanOnError: true }).catch((error) => {
        console.warn("Background workouts refresh error", error);
      });
    }
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

  function openWorkoutWithDraftChoice(id, savedDraft, shouldRestoreDraft, freshPlan = null) {
    const restoredReadiness = shouldRestoreDraft && savedDraft?.selectedReadiness?.id
      ? getWorkoutReadinessOption(savedDraft.selectedReadiness.id)
      : null;

    if (shouldRestoreDraft) {
      setPlan(savedDraft.plan);
    } else if (freshPlan) {
      setPlan(freshPlan);
    }

    setSelectedWorkoutId(id);
    setOpenVideoId(null);
    setFullscreenVideo(null);
    setCurrentExerciseIndex(shouldRestoreDraft ? Number(savedDraft.currentExerciseIndex) || 0 : 0);
    setWorkoutStarted(Boolean(shouldRestoreDraft));
    setWorkoutStartedAt(shouldRestoreDraft ? savedDraft.workoutStartedAt || Date.now() : null);
    setWorkoutFinishedAt(shouldRestoreDraft ? savedDraft.workoutFinishedAt || null : null);
    setWorkoutReadiness(restoredReadiness);
    setWorkoutReadinessPending(restoredReadiness);
    setWarmupCompletedSteps(
      shouldRestoreDraft && Array.isArray(savedDraft?.warmupCompletedSteps)
        ? savedDraft.warmupCompletedSteps
        : []
    );
    const restoredWarmupDuration = Number(savedDraft?.warmupTimerDuration) || 300;
    setWarmupTimerDuration(restoredWarmupDuration);
    setWarmupTimerSeconds(
      shouldRestoreDraft
        ? Number.isFinite(Number(savedDraft?.warmupTimerSeconds))
          ? Math.max(0, Number(savedDraft.warmupTimerSeconds))
          : restoredWarmupDuration
        : restoredWarmupDuration
    );
    setWarmupTimerRunning(false);
    const restoredRestDuration = Number(savedDraft?.restTimerDuration) || 90;
    setRestTimerDuration(restoredRestDuration);
    setRestTimerSeconds(
      shouldRestoreDraft ? Math.max(0, Number(savedDraft?.restTimerSeconds) || 0) : 0
    );
    setRestTimerRunning(false);
    setExerciseHistoryOpenId("");
    setWorkoutHistorySyncState("idle");
    setWorkoutExitPromptOpen(false);
    setPostWorkoutFeedback(null);
    setPostWorkoutFeedbackOpen(false);
    setWorkoutReadinessOpen(!shouldRestoreDraft);
    setIsWorkoutSaved(false);
    setWorkoutClientComment("");
    setShowWorkoutSavedCard(false);
    loadHistory();
  }

  function openWorkout(id) {
    const currentUser = auth.currentUser || user;
    const savedDraft = currentUser?.uid ? safeReadJsonStorage(getWorkoutDraftKey(currentUser.uid, id), null) : null;
    const selectedPlanWorkout = plan.workouts.find((workoutItem) => workoutItem.id === id);
    const currentAssignmentVersion =
      selectedPlanWorkout?.assignedProgramUpdatedAt ||
      plan.assignedProgramUpdatedAt ||
      "";
    const draftAssignmentVersion =
      savedDraft?.assignmentVersion ||
      savedDraft?.assignedProgramUpdatedAt ||
      savedDraft?.plan?.assignedProgramUpdatedAt ||
      "";
    const draftMatchesCurrentProgram =
      currentAssignmentVersion
        ? draftAssignmentVersion === currentAssignmentVersion
        : true;
    if (savedDraft && !draftMatchesCurrentProgram && currentUser?.uid) {
      clearWorkoutDraft(currentUser.uid, id);
    }
    const canRestoreDraft =
      draftMatchesCurrentProgram &&
      savedDraft?.workoutId === id &&
      savedDraft?.plan;

    if (canRestoreDraft) {
      setWorkoutDraftRestorePrompt({ workoutId: id, savedDraft });
      return;
    }

    openWorkoutWithDraftChoice(id, savedDraft, false);
  }

  async function handleWorkoutDraftChoice(shouldRestoreDraft) {
    const pendingDraft = workoutDraftRestorePrompt;
    if (!pendingDraft) return;

    setWorkoutDraftRestorePrompt(null);
    if (!shouldRestoreDraft) {
      const currentUser = auth.currentUser || user;
      const fallbackPlan = {
        ...plan,
        workouts: plan.workouts.map((workoutItem) => (
          workoutItem.id !== pendingDraft.workoutId
            ? workoutItem
            : {
                ...workoutItem,
                exercises: workoutItem.exercises.map((exercise) => ({
                  ...exercise,
                  sets: exercise.sets.map((set) => {
                    const {
                      aiOriginalWeight,
                      aiReadinessId,
                      aiReadinessTitle,
                      completed,
                      ...cleanSet
                    } = set;

                    return {
                      ...cleanSet,
                      weight: aiOriginalWeight || set.weight || "",
                      enteredReps: "",
                      enteredWeight: ""
                    };
                  })
                }))
              }
        ))
      };
      if (currentUser?.uid) {
        clearWorkoutDraft(currentUser.uid, pendingDraft.workoutId);
      }
      const freshPlan = await loadWorkoutsFromFirebase(currentUser?.uid);
      openWorkoutWithDraftChoice(
        pendingDraft.workoutId,
        null,
        false,
        freshPlan?.workouts?.some((item) => item.id === pendingDraft.workoutId)
          ? freshPlan
          : fallbackPlan
      );
      return;
    }

    openWorkoutWithDraftChoice(
      pendingDraft.workoutId,
      pendingDraft.savedDraft,
      true
    );
  }

  function applyWorkoutReadiness(option) {
    const readiness = option || getWorkoutReadinessOption("good");

    setWorkoutReadiness(readiness);
    setWorkoutReadinessPending(readiness);
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
              if (readiness.id === "good") return set;

              const isAssignedProgramWorkout = Boolean(
                workoutItem.assignedProgramId || workoutItem.assignedProgramUpdatedAt
              );
              const baseWeight = getAiWorkoutBaseWeight(
                exercise.name,
                set,
                index,
                history,
                !isAssignedProgramWorkout
              );
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

    const startedAt = Date.now();
    setWorkoutStarted(true);
    setWorkoutStartedAt(startedAt);
    setTimerTick(startedAt);
    timerTickRef.current = startedAt;
    setWorkoutFinishedAt(null);
    setCurrentExerciseIndex(0);
    setSwipeDirection("up");
    centerExerciseDeck();
    setTimeout(() => setSwipeDirection(""), 560);
  }

  async function saveAiNutritionPlan(profileOverride = aiNutritionProfileDraft) {
    const profile = {
      name: String(profileOverride.name || "").trim(),
      weight: String(profileOverride.weight || "").trim(),
      targetWeight: String(profileOverride.targetWeight || "").trim(),
      height: String(profileOverride.height || "").trim(),
      age: String(profileOverride.age || "").trim(),
      sex: profileOverride.sex || "male",
      activity: profileOverride.activity || "medium",
      goal: profileOverride.goal || "recomp",
      trainingDays: getAiNutritionTrainingDays(profileOverride)
    };

    const nextPlan = buildAiNutritionMonthlyPlan(nutrition, profile, history, aiNutritionSavedPlan);
    const weekOne = nextPlan.weeks?.[0];
    const nextGoals = weekOne ? {
      calories: Math.round(Number(weekOne.calories) || defaultNutritionState.goals.calories),
      protein: Math.round(Number(weekOne.protein) || defaultNutritionState.goals.protein),
      fat: Math.round(Number(weekOne.fat) || defaultNutritionState.goals.fat),
      carbs: Math.round(Number(weekOne.carbs) || defaultNutritionState.goals.carbs)
    } : null;
    setAiNutritionProfile(profile);
    setAiNutritionProfileDraft(profile);
    setAiNutritionSavedPlan(nextPlan);

    try {
      if (user?.uid) {
        safeWriteUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, user.uid, profile);
        safeWriteUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, user.uid, nextPlan);
      }

    } catch (_) {
      // ignore localStorage errors
    }

    if (auth.currentUser?.uid) {
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          ...(profile.name ? { name: profile.name } : {}),
          profile,
          aiNutritionProfile: profile,
          aiNutritionPlan: nextPlan,
          ...(nextGoals ? { nutritionGoals: nextGoals } : {}),
          firstSetupCompleted: true,
          firstSetupCompletedVersion: FIRST_SETUP_REQUIRED_VERSION,
          firstSetupCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        if (nextGoals) {
          await setDoc(doc(db, "users", auth.currentUser.uid, "nutrition", "state"), {
            goals: {
              ...nutrition.goals,
              ...nextGoals
            },
            aiNutritionPlan: nextPlan,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        setFirstSetupCompletedInCloud(true);
        try {
          localStorage.setItem(
            FIRST_SETUP_DONE_USER_STORAGE_KEY,
            `${auth.currentUser.uid}:${FIRST_SETUP_REQUIRED_VERSION}`
          );
          localStorage.setItem(
            `${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${auth.currentUser.uid}`,
            FIRST_SETUP_REQUIRED_VERSION
          );
        } catch (_) {
          // ignore localStorage errors
        }
      } catch (error) {
        console.error("Profile save error", error);
        return false;
      }
    } else {
      return false;
    }

    if (nextGoals) {
      setNutrition((prev) => ({
        ...prev,
        goals: {
          ...prev.goals,
          ...nextGoals
        },
        aiNutritionPlan: nextPlan,
        updatedAt: new Date().toISOString()
      }));
    }

    return true;
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
      const uid = auth.currentUser?.uid;
      if (uid) {
        localStorage.removeItem(getUserScopedStorageKey(AI_NUTRITION_PROFILE_STORAGE_KEY, uid));
        localStorage.removeItem(getUserScopedStorageKey(AI_NUTRITION_PLAN_STORAGE_KEY, uid));
      }
    } catch (_) {
      // ignore localStorage errors
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
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch("/api/telegram/login-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          telegramUser
        })
      });

      const data = await response.json().catch(() => ({}));

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
        safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegram);
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

  async function refreshTelegramAvatar() {
    if (!auth.currentUser || telegramAvatarRefreshRef.current) return;

    telegramAvatarRefreshRef.current = true;

    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch("/api/telegram/refresh-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await response.json();

      if (!response.ok || !data.ok || !data.telegram?.avatarUrl) {
        throw new Error(data.error || "Telegram avatar refresh failed");
      }

      setTelegramProfile((current) => {
        const nextTelegram = {
          ...current,
          ...data.telegram,
          connected: true
        };

        try {
          safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegram);
        } catch (_) {
          // ignore localStorage errors
        }

        return nextTelegram;
      });
      setTelegramDraft((current) => ({ ...current, ...data.telegram, connected: true }));
    } catch (error) {
      console.error("Telegram avatar refresh error:", error);
      setTelegramProfile((current) => ({ ...current, avatarUrl: "" }));
      setTelegramDraft((current) => ({ ...current, avatarUrl: "" }));
    } finally {
      telegramAvatarRefreshRef.current = false;
    }
  }

  function handleTelegramAvatarError() {
    setTelegramProfile((current) => ({ ...current, avatarUrl: "" }));
    setTelegramDraft((current) => ({ ...current, avatarUrl: "" }));
    refreshTelegramAvatar();
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
          safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegram);
        } catch (_) {
          // ignore localStorage errors
        }

        if (
          nextTelegram.telegramUserId &&
          (
            !nextTelegram.avatarUrl ||
            String(nextTelegram.avatarUrl).includes("api.telegram.org/file/bot")
          )
        ) {
          refreshTelegramAvatar();
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
      safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegramProfile);
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
      safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, auth.currentUser?.uid, nextTelegramProfile);
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
      if (import.meta.env.DEV) console.debug("TELEGRAM CALLBACK WORKS:", telegramUser);
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
      const uid = auth.currentUser?.uid;
      if (uid) {
        safeWriteUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, uid, nextProfile);
        safeWriteUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, uid, nextPlan);
      }
    } catch (_) {
      // ignore localStorage errors
    }
  }

  async function saveProfileNutritionPlanAndClose() {
    if (profileNutritionSaveStatus === "saving" || profileNutritionSaveStatus === "saved") return;

    setProfileNutritionSaveStatus("saving");
    const savedToCloud = await saveAiNutritionPlan(aiNutritionProfileDraft);

    if (!savedToCloud) {
      setProfileNutritionSaveStatus("error");
      showAppError(
        "save",
        "План сохранён на устройстве, но не отправлен в облако. Проверь соединение и повтори."
      );
      return;
    }

    setProfileNutritionSaveStatus("saved");

    window.setTimeout(() => {
      setProfileNutritionModalOpen(false);
      setProfileNutritionSaveStatus("");
    }, 900);
  }

  let firstSetupCompletedLocally = false;
  if (isLoggedIn && user?.uid) {
    try {
      firstSetupCompletedLocally =
        localStorage.getItem(FIRST_SETUP_DONE_USER_STORAGE_KEY) === `${user.uid}:${FIRST_SETUP_REQUIRED_VERSION}` ||
        localStorage.getItem(`${FIRST_SETUP_DONE_USER_STORAGE_KEY}:${user.uid}`) === FIRST_SETUP_REQUIRED_VERSION;
    } catch (_) {
      firstSetupCompletedLocally = false;
    }
  }

  const firstSetupStillResolving = Boolean(
    isLoggedIn &&
    !firstSetupProfileHydrated
  );
  const firstSetupRequiredNow = Boolean(
    isLoggedIn &&
    firstSetupProfileHydrated &&
    currentUserRole === "client" &&
    !firstSetupCompletedInSession &&
    !firstSetupCompletedInCloud &&
    !hasRequiredAiNutritionProfileFields(aiNutritionProfile) &&
    !firstSetupCompletedLocally
  );

  if (appLoading || firstSetupStillResolving) {
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

  if ((showFirstSetupOnboarding || firstSetupRequiredNow) && isLoggedIn && !appLoading) {
    return renderFirstSetupOnboarding(firstSetupRequiredNow);
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

          <label className="loginField">
            <span>Email</span>
            <input
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                setLoginFieldErrors((current) => ({ ...current, email: "" }));
                setLoginError("");
                setLoginNotice("");
              }}
              placeholder="name@example.com"
              inputMode="email"
              autoComplete="email"
              aria-invalid={Boolean(loginFieldErrors.email)}
              aria-describedby={loginFieldErrors.email ? "login-email-error" : undefined}
            />
            {loginFieldErrors.email && (
              <small className="loginFieldError" id="login-email-error">{loginFieldErrors.email}</small>
            )}
          </label>

          <label className="loginField">
            <span>Пароль</span>
            <div className="passwordBox">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginFieldErrors((current) => ({ ...current, password: "" }));
                  setLoginError("");
                }}
                placeholder="Пароль"
                autoComplete="current-password"
                aria-invalid={Boolean(loginFieldErrors.password)}
                aria-describedby={loginFieldErrors.password ? "login-password-error" : undefined}
              />

              <button
                type="button"
                className="eyeBtn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>
            {loginFieldErrors.password && (
              <small className="loginFieldError" id="login-password-error">{loginFieldErrors.password}</small>
            )}
          </label>

          {loginError && <div className="loginError" role="alert">{loginError}</div>}
          {loginNotice && <div className="loginNotice" role="status">{loginNotice}</div>}

          <button className="loginBtn" type="submit" disabled={loginSubmitting || passwordResetSending}>
            {loginSubmitting ? "Вхожу..." : "Войти"}
          </button>

          <button
            className="loginResetBtn"
            type="button"
            disabled={loginSubmitting || passwordResetSending}
            onClick={handleLoginPasswordReset}
          >
            {passwordResetSending ? "Отправляю..." : "Забыли пароль?"}
          </button>

          <p className="loginHint">Вход через email и пароль</p>
        </form>
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
            onClick={openAdminProgramsOverview}
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
        <div className="appVersionBadge clientPageVersionBadge">{APP_VERSION}</div>
        <button className="workoutModeBack" onClick={goBackToMain}>←</button>

        <section className="workoutModeHero">
          <span>ТРЕНИРОВКИ</span>
          <h1>Режим запуска</h1>
          <p>Можно тренироваться по базовой программе или по индивидуальному плану от тренера.</p>
        </section>

        <section className="workoutModeCards">
          <button className="workoutModeCard" onClick={openBasicWorkoutQuiz}>
            <span className="workoutModeIcon">Б</span>
            <div>
              <strong>Базовые тренировки</strong>
              <small>Короткий опрос и готовый план из базы приложения.</small>
            </div>
            <i>›</i>
          </button>

          <button className="workoutModeCard premium" onClick={openIndividualWorkouts}>
            <span className="workoutModeIcon">И</span>
            <div>
              <strong>Индивидуальный план</strong>
              <small>Тренировки, которые создал и назначил тренер.</small>
            </div>
            <i>›</i>
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

        {renderClientMainBottomBar("workouts", "mainMenuBottomBar profileBottomTabBar workoutModeBottomBar")}
      </div>
    );
  }

  if (page === "basicWorkoutQuiz") {
    const previewPlan = buildBasicPlanFromQuiz(basicWorkoutQuiz);

    return (
      <div className="basicQuizPage">
        <div className="appVersionBadge clientPageVersionBadge">{APP_VERSION}</div>
        <button className="workoutModeBack" onClick={() => setPage("workoutMode")}>←</button>

        <section className="workoutModeHero">
          <span>БАЗОВЫЕ ТРЕНИРОВКИ</span>
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

        {renderClientMainBottomBar("workouts", "mainMenuBottomBar profileBottomTabBar workoutModeBottomBar")}
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
    const preliminaryAiNutritionPlan = getClientNutritionDisplayPlan(
      {
        aiNutritionPlan: aiNutritionSavedPlan,
        aiNutritionProfile,
        profile: aiNutritionProfile,
        nutritionPlan: nutrition.nutritionPlan
      },
      nutrition,
      nutrition.goals
    ) || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);
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
    const nutritionStreakText = `Серия записи еды — ${nutritionCurrentStreak} ${getTrainerDayWord(nutritionCurrentStreak)} 🔥`;
    const nutritionDateTitle = isNutritionToday
      ? "Сегодня"
      : formatNutritionDateLabel(selectedNutritionDate).replace(/^./, (char) => char.toUpperCase());
    const mealStats = nutritionMeals.reduce((acc, meal) => {
      const foods = (nutritionToday.foods || []).filter((item) => item.mealId === meal.id);
      acc[meal.id] = sumNutritionFoods(foods, true);
      return acc;
    }, {});
    const nutritionZoukFoodsCount = (nutritionToday.foods || []).length;
    const activeNutritionMeal = nutritionMeals.find((meal) => expandedNutritionMeals[meal.id]) || null;
    const activeNutritionMealFoods = activeNutritionMeal
      ? (nutritionToday.foods || []).filter((item) => item.mealId === activeNutritionMeal.id)
      : [];
    const activeNutritionMealStats = activeNutritionMeal
      ? mealStats[activeNutritionMeal.id] || { calories: 0, count: 0 }
      : { calories: 0, count: 0 };
    const aiNutritionDay = buildAiNutritionDayModel({ ...nutrition, goals: effectiveNutritionGoals }, nutritionToday, history);
    const aiNutritionActivePlan = preliminaryAiNutritionPlan || buildAiNutritionMonthlyPlan(nutrition);
    const aiNutritionBaseline = aiNutritionDay.baseline;
    const aiNutritionGoal = aiNutritionActivePlan?.profile?.goal || aiNutritionProfile?.goal || "recomp";
    const aiNutritionGoalText =
      aiNutritionGoal === "recomp"
        ? "Рекомпозиция"
        : getAiNutritionGoalLabel(aiNutritionGoal);
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
    const nutritionSummaryCollapsedText = isCaloriesOverGoal
      ? "Калории выше плана, следующий прием сделай легче."
      : proteinPercent < 55
        ? "Белка пока мало, добавь белковый продукт."
        : caloriePercent < 45
          ? "День пока свободный, можно добавить прием пищи."
          : caloriePercent > 90
            ? "План почти закрыт, дальше без лишних перекусов."
            : "День идет ровно, держим темп.";
    const nutritionOrbitItems = [
      {
        id: "calories",
        label: "КАЛОРИИ",
        amount: String(caloriesConsumed),
        target: `из ${effectiveNutritionGoals.calories} ккал`,
        progress: Math.min(100, Math.max(0, caloriePercent)),
        color: "#22c55e",
        startAngle: 324.3,
        arcDegrees: 74.6
      },
      {
        id: "protein",
        label: "БЕЛКИ",
        amount: `${roundMacro(nutritionTotals.protein)} г`,
        target: `из ${effectiveNutritionGoals.protein} г`,
        progress: Math.min(100, Math.max(0, proteinPercent)),
        color: "#EA5D61",
        startAngle: 63.2,
        arcDegrees: 56
      },
      {
        id: "carbs",
        label: "УГЛЕВОДЫ",
        amount: `${roundMacro(nutritionTotals.carbs)} г`,
        target: `из ${effectiveNutritionGoals.carbs} г`,
        progress: Math.min(100, Math.max(0, carbsPercent)),
        color: "#1f7df2",
        startAngle: 240.7,
        arcDegrees: 56.5
      },
      {
        id: "fat",
        label: "ЖИРЫ",
        amount: `${roundMacro(nutritionTotals.fat)} г`,
        target: `из ${effectiveNutritionGoals.fat} г`,
        progress: Math.min(100, Math.max(0, fatPercent)),
        color: "#ffae27",
        startAngle: 141.6,
        arcDegrees: 74.7
      }
    ].map((item) => ({
      ...item,
      segment: getNutritionOrbitSegment(item.startAngle, item.arcDegrees, item.progress)
    }));

    return (
      <div className="fatSecretPage nutritionFixedHeaderV3 clientCorePage clientCorePageNutrition">
        {!nutritionPickerOpen && (
          <>
            <div className="appVersionBadge clientPageVersionBadge">{APP_VERSION}</div>
            <section className="nutritionHeroV4">
          <div className="nutritionHeroTitleV4">
            <h1 className="clientCorePageTitle">{nutritionDateTitle}</h1>
            <div className="nutritionHeaderIconActions">
              <button
                className="nutritionQuickActionExact nutritionHeaderIconButton"
                type="button"
                onClick={() => openNutritionPicker(nutritionMeal)}
                aria-label="Поиск еды"
                title="Поиск еды"
              >
                <span className="nutritionQuickSearchIcon" aria-hidden="true" />
              </button>
              <button
                className="nutritionQuickActionExact nutritionHeaderIconButton"
                type="button"
                onClick={openNutritionCalendar}
                aria-label="Календарь"
                title="Календарь"
              >
                <span className="nutritionQuickCalendarIcon" aria-hidden="true">🗓️</span>
              </button>
            </div>
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
                  <span aria-hidden="true" />
                  <small>{day.label}</small>
                </button>
              );
            })}
          </div>

          <div className="nutritionStreakV4">
            <span>{nutritionStreakText}</span>
          </div>
        </section>

        {nutritionCalendarOpen && (
          <div className="nutritionCalendarOverlay" role="dialog" aria-modal="true" aria-label="Календарь">
            <button
              type="button"
              className="nutritionCalendarBackdrop"
              onClick={() => setNutritionCalendarOpen(false)}
              aria-label="Закрыть календарь по фону"
            />

            <div className="nutritionCalendarSheet">
              <div className="nutritionCalendarGrabber" aria-hidden="true" />
              <button
                type="button"
                className="nutritionCalendarClose"
                onClick={() => setNutritionCalendarOpen(false)}
                aria-label="Закрыть календарь"
              >
                ×
              </button>

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

        <section className={`nutritionAiPlanDashboard collapsed nutritionAiPlanTopInline ${isCaloriesOverGoal ? "overLimit" : ""}`}>
          <button
            type="button"
            className="nutritionAiPlanTopCard"
            onClick={() => setIsAiNutritionPlanExpanded(true)}
            aria-label="Развернуть анализ питания"
          >
            <span className="nutritionAiPlanCollapsedIcon" aria-hidden="true">📊</span>
            <span className="nutritionAiPlanTopTitle">
              <strong>Анализ питания</strong>
              <small>{nutritionSummaryCollapsedText}</small>
            </span>
            <span className="nutritionAiPlanCollapsedArrow" aria-hidden="true">›</span>
          </button>
        </section>

        <section className="nutritionOrbitPreview" aria-label="Добавить еду">
          <div className="nutritionOrbitPreviewCard">
            <div className="nutritionOrbitStage">
            <svg className="nutritionOrbitScene" viewBox="0 0 540 463" aria-hidden="true">
              <defs>
                <filter id="nutritionOrbitSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="13" stdDeviation="13" floodColor="#2f3a68" floodOpacity="0.13" />
                </filter>
                <filter id="nutritionOrbitAddShadow" x="-35%" y="-35%" width="170%" height="170%">
                  <feDropShadow dx="0" dy="13" stdDeviation="12" floodColor="#4c2be1" floodOpacity="0.25" />
                </filter>
                <radialGradient id="nutritionOrbitProteinFill" cx="50%" cy="50%" r="62%">
                  <stop offset="0%" stopColor="#fff1f2" />
                  <stop offset="100%" stopColor="#ffffff" />
                </radialGradient>
                <radialGradient id="nutritionOrbitFatFill" cx="50%" cy="50%" r="62%">
                  <stop offset="0%" stopColor="#fff8e6" />
                  <stop offset="100%" stopColor="#ffffff" />
                </radialGradient>
                <radialGradient id="nutritionOrbitCarbsFill" cx="50%" cy="50%" r="62%">
                  <stop offset="0%" stopColor="#eef7ff" />
                  <stop offset="100%" stopColor="#ffffff" />
                </radialGradient>
                <radialGradient id="nutritionOrbitCaloriesFill" cx="50%" cy="50%" r="62%">
                  <stop offset="0%" stopColor="#efffeb" />
                  <stop offset="100%" stopColor="#ffffff" />
                </radialGradient>
                <linearGradient id="nutritionOrbitAddFill" x1="196" y1="134" x2="344" y2="274" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#8c67ff" />
                  <stop offset="100%" stopColor="#4c25f1" />
                </linearGradient>
              </defs>

              <circle cx="270" cy="232" r="184" fill="none" stroke="#dfd9ff" strokeWidth="2.4" />
              {nutritionOrbitItems.map((item) => (
                <path
                  key={item.id}
                  className={`nutritionOrbitProgressPath ${item.id}`}
                  d={item.segment.progressPath}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="5.2"
                  strokeLinecap="round"
                />
              ))}

              <circle className="nutritionOrbitAddHalo haloOuter" cx="270" cy="232" r="128" fill="#684cf6" opacity="0.055" />
              <circle className="nutritionOrbitAddHalo haloMiddle" cx="270" cy="232" r="96" fill="#684cf6" opacity="0.075" />
              <circle className="nutritionOrbitAddHalo haloInner" cx="270" cy="232" r="72" fill="#684cf6" opacity="0.09" />
              <circle className="nutritionOrbitAddCore" cx="270" cy="232" r="58" fill="url(#nutritionOrbitAddFill)" filter="url(#nutritionOrbitAddShadow)" />
              <path className="nutritionOrbitAddPlus" d="M270 200v64M238 232h64" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />

              {nutritionOrbitItems.map((item) => (
                <g key={`${item.id}-dots`}>
                  {item.segment.hasProgress && (
                    <circle cx={item.segment.progressDot.x} cy={item.segment.progressDot.y} r="8" fill={item.color} />
                  )}
                </g>
              ))}

              <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(118 101) scale(0.8929) translate(-118 -101)">
                <circle cx="118" cy="101" r="54" fill="url(#nutritionOrbitCaloriesFill)" stroke="#ffffff" strokeWidth="6" />
                <text x="118" y="80" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={nutritionOrbitItems[0].color}>{nutritionOrbitItems[0].label}</text>
                <text x="118" y="112" textAnchor="middle" className="nutritionOrbitSvgAmount">{nutritionOrbitItems[0].amount}</text>
                <text x="118" y="140" textAnchor="middle" className="nutritionOrbitSvgTarget">{nutritionOrbitItems[0].target}</text>
              </g>
              <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(432 101) scale(0.8929) translate(-432 -101)">
                <circle cx="432" cy="101" r="54" fill="url(#nutritionOrbitProteinFill)" stroke="#ffffff" strokeWidth="6" />
                <text x="432" y="80" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={nutritionOrbitItems[1].color}>{nutritionOrbitItems[1].label}</text>
                <text x="432" y="112" textAnchor="middle" className="nutritionOrbitSvgAmount">{nutritionOrbitItems[1].amount}</text>
                <text x="432" y="140" textAnchor="middle" className="nutritionOrbitSvgTarget">{nutritionOrbitItems[1].target}</text>
              </g>
              <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(114 370) scale(0.8929) translate(-114 -370)">
                <circle cx="114" cy="370" r="54" fill="url(#nutritionOrbitCarbsFill)" stroke="#ffffff" strokeWidth="6" />
                <text x="114" y="349" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={nutritionOrbitItems[2].color}>{nutritionOrbitItems[2].label}</text>
                <text x="114" y="381" textAnchor="middle" className="nutritionOrbitSvgAmount">{nutritionOrbitItems[2].amount}</text>
                <text x="114" y="409" textAnchor="middle" className="nutritionOrbitSvgTarget">{nutritionOrbitItems[2].target}</text>
              </g>
              <g filter="url(#nutritionOrbitSoftShadow)" transform="translate(432 370) scale(0.8929) translate(-432 -370)">
                <circle cx="432" cy="370" r="54" fill="url(#nutritionOrbitFatFill)" stroke="#ffffff" strokeWidth="6" />
                <text x="432" y="349" textAnchor="middle" className="nutritionOrbitSvgLabel" fill={nutritionOrbitItems[3].color}>{nutritionOrbitItems[3].label}</text>
                <text x="432" y="381" textAnchor="middle" className="nutritionOrbitSvgAmount">{nutritionOrbitItems[3].amount}</text>
                <text x="432" y="409" textAnchor="middle" className="nutritionOrbitSvgTarget">{nutritionOrbitItems[3].target}</text>
              </g>

              <text x="270" y="334" textAnchor="middle" className="nutritionOrbitSvgTitle">Добавить еду</text>
              <text x="270" y="360" textAnchor="middle" className="nutritionOrbitSvgSubtitle">
                <tspan x="270" dy="0">Нажмите, чтобы добавить</tspan>
                <tspan x="270" dy="18">продукты и записать приём пищи</tspan>
              </text>
            </svg>
            <button
              type="button"
              className="nutritionOrbitHitButton"
              onClick={() => openNutritionPicker()}
              aria-label="Добавить еду"
            />
            </div>
          </div>
        </section>

        <section className="nutritionZoukBlock">
          <button
            type="button"
            className="nutritionZoukHeader"
            onClick={() => setNutritionZoukExpanded(true)}
            aria-expanded={nutritionZoukExpanded}
            aria-haspopup="dialog"
          >
            <span className="nutritionZoukIcon" aria-hidden="true">🍽️</span>
            <span className="nutritionZoukTitle">
              <strong>Дневник питания</strong>
              <small>Список продуктов за день</small>
            </span>
            <span className="nutritionZoukMeta">
              <small>{nutritionZoukFoodsCount ? `${nutritionZoukFoodsCount} шт` : "пусто"}</small>
              <i aria-hidden="true">›</i>
            </span>
          </button>
        </section>

        {nutritionZoukExpanded && (
          <div className="nutritionZoukModalOverlay" role="dialog" aria-modal="true" aria-label="Дневник питания">
            <button
              type="button"
              className="nutritionZoukModalBackdrop"
              onClick={() => setNutritionZoukExpanded(false)}
              aria-label="Закрыть список продуктов"
            />
            <section className="nutritionZoukModalSheet">
              <header className="nutritionZoukModalHeader">
                <span className="nutritionZoukIcon" aria-hidden="true">🍽️</span>
                <div>
                  <small>Продукты за день</small>
                  <h2>Дневник питания</h2>
                  <strong>{nutritionZoukFoodsCount ? `${nutritionZoukFoodsCount} шт` : "пока пусто"}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setNutritionZoukExpanded(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </header>

            <div className="nutritionZoukContent">
              {nutritionMeals.map((meal) => {
                const foods = (nutritionToday.foods || []).filter((item) => item.mealId === meal.id);
                const stats = mealStats[meal.id] || { calories: 0, count: 0 };

                return (
                  <div className="nutritionZoukMeal" key={meal.id}>
                    <div className="nutritionZoukMealHead">
                      <span className="nutritionZoukMealIcon" aria-hidden="true">{meal.icon}</span>
                      <div>
                        <strong>{meal.name}</strong>
                        <small>{foods.length ? `${foods.length} шт · ${Math.round(stats.calories)} ккал` : "продуктов нет"}</small>
                      </div>
                      <button
                        type="button"
                        className="nutritionZoukAdd"
                        onClick={() => {
                          setNutritionZoukExpanded(false);
                          openNutritionPicker(meal.id);
                        }}
                        aria-label={`Добавить продукт: ${meal.name}`}
                      >
                        +
                      </button>
                    </div>

                    {foods.length > 0 ? (
                      <div className="nutritionZoukFoods">
                        {foods.map((item) => (
                          <button
                            type="button"
                            className="nutritionZoukFood"
                            key={item.id}
                            onClick={() => {
                              setNutritionZoukExpanded(false);
                              openNutritionFoodEditor(item);
                              setNutritionSearchTab("food");
                            }}
                          >
                            <span className="nutritionZoukFoodIcon" aria-hidden="true">{item.icon || getFoodIcon(item)}</span>
                            <span className="nutritionZoukFoodText">
                              <strong>{item.name}</strong>
                              <small>{item.amount} г · Б {roundMacro(item.protein)} · Ж {roundMacro(item.fat)} · У {roundMacro(item.carbs)}</small>
                            </span>
                            <span className="nutritionZoukFoodKcal">
                              <strong>{Math.round(Number(item.calories) || 0)}</strong>
                              <small>ккал</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="nutritionZoukEmpty"
                        onClick={() => {
                          setNutritionZoukExpanded(false);
                          openNutritionPicker(meal.id);
                        }}
                      >
                        Добавить продукт
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            </section>
          </div>
        )}

        <section className="fatMealList">
          {nutritionMeals.map((meal) => {
            const stats = mealStats[meal.id] || { calories: 0, count: 0 };
            const hasFoods = stats.count > 0;
            return (
              <div
                className="fatMealCard collapsed"
                key={meal.id}
              >
                <div
                  className="fatMealMain mealRowExact"
                >
                  <button
                    type="button"
                    className="fatMealOpenArea"
                    aria-label={`Открыть приём пищи: ${meal.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasFoods) {
                        setExpandedNutritionMeals({ [meal.id]: true });
                      } else {
                        openNutritionPicker(meal.id);
                      }
                    }}
                  />
                  <div className="fatMealIcon mealIconExact">{meal.icon}</div>
                  <div className="fatMealTitle mealTitleExact">
                    <strong>{meal.name}</strong>
                    {hasFoods && <span>{stats.count} шт</span>}
                  <button
                    type="button"
                    className={`fatMealToggle mealToggleUnderCount ${!hasFoods ? "disabled" : ""}`}
                    aria-label="Открыть список продуктов"
                    aria-expanded={Boolean(expandedNutritionMeals[meal.id])}
                    disabled={!hasFoods}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasFoods) return;
                        setExpandedNutritionMeals({ [meal.id]: true });
                      }}
                    >
                      ›
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
              </div>
            );
          })}
        </section>

        {activeNutritionMeal && (
          <div className="nutritionMealModalOverlay" role="dialog" aria-modal="true" aria-label={activeNutritionMeal.name}>
            <button
              type="button"
              className="nutritionMealModalBackdrop"
              onClick={() => setExpandedNutritionMeals({})}
              aria-label="Закрыть список продуктов"
            />

            <section className="nutritionMealModalSheet">
              <header className="nutritionMealModalHeader">
                <span className="nutritionMealModalIcon" aria-hidden="true">{activeNutritionMeal.icon}</span>
                <div>
                  <small>{activeNutritionMealFoods.length} продуктов</small>
                  <h2>{activeNutritionMeal.name}</h2>
                  <strong>{Math.round(activeNutritionMealStats.calories)} ккал</strong>
                </div>
                <button type="button" onClick={() => setExpandedNutritionMeals({})} aria-label="Закрыть">×</button>
              </header>

              <div className="nutritionMealModalList">
                {activeNutritionMealFoods.map((item) => (
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

              <button
                type="button"
                className="nutritionMealModalAdd"
                onClick={() => {
                  setExpandedNutritionMeals({});
                  openNutritionPicker(activeNutritionMeal.id);
                }}
              >
                <span aria-hidden="true">＋</span>
                Добавить продукт
              </button>
            </section>
          </div>
        )}

        {isAiNutritionPlanExpanded && (
          <button
            type="button"
            className="nutritionAiPlanModalBackdrop"
            onClick={() => setIsAiNutritionPlanExpanded(false)}
            aria-label="Закрыть план питания"
          />
        )}

        <section
          className={`nutritionAiPlanDashboard ${isAiNutritionPlanExpanded ? "expanded nutritionAiPlanModal" : "collapsed nutritionAiPlanInlineHidden"} ${isCaloriesOverGoal ? "overLimit" : ""}`}
          role={isAiNutritionPlanExpanded ? "dialog" : undefined}
          aria-modal={isAiNutritionPlanExpanded ? "true" : undefined}
          aria-label={isAiNutritionPlanExpanded ? "План питания" : undefined}
        >
          {isAiNutritionPlanExpanded && (
            <div className="nutritionAiPlanHeader">
              <div className="nutritionAiPlanTitleBox">
                <span>План питания</span>
                <h2>{aiNutritionGoalText}</h2>
              </div>
              <button
                type="button"
                className="nutritionAiPlanToggleBtn"
                aria-label="Закрыть план питания"
                onClick={() => setIsAiNutritionPlanExpanded(false)}
              >
                ×
              </button>
            </div>
          )}

          {isAiNutritionPlanExpanded && (
            <div className={`nutritionAiTrainingDayPill ${isNutritionTrainingDayToday ? "active" : ""}`}>
              <span>{isNutritionTrainingDayToday ? "Тренировочный день" : "Обычный день"}</span>
              <small>{isNutritionTrainingDayToday ? `Сегодня: ${aiNutritionTodayPlanMacros.calories} ккал · У ${aiNutritionTodayPlanMacros.carbs} г` : "КБЖУ без тренировочной надбавки"}</small>
            </div>
          )}

          {!isAiNutritionPlanExpanded ? (
            <button
              type="button"
              className="nutritionAiPlanCollapsedCard"
              onClick={() => setIsAiNutritionPlanExpanded(true)}
              aria-label="Развернуть сводку питания"
            >
              <div className="nutritionAiPlanCollapsedHeading">
                <strong>Анализ питания</strong>
              </div>

              <div className="nutritionAiPlanCollapsedContent">
                <span className="nutritionAiPlanCollapsedIcon" aria-hidden="true">📊</span>
                <span className="nutritionAiPlanCollapsedInsight">{nutritionSummaryCollapsedText}</span>
                <span className="nutritionAiPlanCollapsedArrow" aria-hidden="true">›</span>
              </div>
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

            </>
          )}
            </section>
          </>
        )}

        {nutritionPickerOpen && (
          <div className="fatFoodSearchOverlay">
            <section
              className="fatFoodSearchScreen fatFoodSearchScreenPremium"
              role="dialog"
              aria-modal="true"
              aria-label="Поиск еды"
            >
              <div className="fatSearchTopPremium">
                {!selectedNutritionFood && nutritionSearchTab === "my" && (
                  <div className="foodFlowTitleGroup">
                    <span>Питание</span>
                    <h2>Мои продукты</h2>
                  </div>
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

                <button
                  type="button"
                  className="fatSearchClosePremium"
                  onClick={(event) => {
                    event.stopPropagation();
                    setNutritionMealMenuOpen(false);
                    setSelectedNutritionFood(null);
                    setEditingNutritionItemId(null);
                    setNutritionPickerOpen(false);
                  }}
                  aria-label="Закрыть поиск еды"
                >
                  ×
                </button>
              </div>

              {selectedNutritionFood ? (
                <div className="fatFoodAmountScreen foodEditRenderScreen">
                  {!nutritionEditPageOpen && (
                    <div className="foodProductFlowHeader">
                      <div className="foodProductFlowTitle">
                        <span>Питание</span>
                        <h2>{editingNutritionItemId ? "Продукт" : "Добавить продукт"}</h2>
                      </div>

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
                    </div>
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
                      onChange={(e) => {
                        setNutritionAmount(e.target.value);
                        setNutritionAmountError("");
                      }}
                      placeholder={nutritionAmountMode === "portion" ? "1" : "100"}
                      inputMode="decimal"
                      aria-invalid={Boolean(nutritionAmountError)}
                      aria-describedby={nutritionAmountError ? "nutrition-amount-error" : undefined}
                    />
                    {nutritionAmountError && (
                      <small className="nutritionInlineError" id="nutrition-amount-error">
                        {nutritionAmountError}
                      </small>
                    )}
                  </label>

                  {(() => {
                    const amountValidation = validateNutritionAmount(nutritionAmount);
                    const scale = amountValidation.valid
                      ? getFoodScale(amountValidation.amount, selectedNutritionFood, nutritionAmountMode)
                      : 0;
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
                            onClick={openNutritionEditPage}
                          >
                            <span className="foodEditRowIcon">▤</span>
                            <span className="foodEditRowLabel">Описание продукта</span>
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
                          <strong className="foodEditPageTitleCenter">{selectedNutritionFood?.type === "dish" ? "Редактирование блюда" : "Редактирование продукта"}</strong>
                        </div>

                        <div className="foodEditPageContent">
                          <label>
                            <span>{selectedNutritionFood?.type === "dish" ? "Название блюда" : "Краткое название продукта"}</span>
                            <input
                              value={selectedNutritionFood.name}
                              onChange={(event) => updateSelectedNutritionFoodField("name", event.target.value)}
                              placeholder="Название"
                              autoFocus
                              required
                              aria-required="true"
                              aria-invalid={!String(selectedNutritionFood.name || "").trim()}
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
                                aria-invalid={Boolean(nutritionProductErrors.calories)}
                              />
                            </label>

                            <label>
                              <span>{selectedNutritionFood?.type === "dish" ? "Белки всего" : "Белки"}</span>
                              <input
                                value={selectedNutritionFood.protein}
                                onChange={(event) => updateSelectedNutritionFoodField("protein", event.target.value)}
                                inputMode="decimal"
                                aria-invalid={Boolean(nutritionProductErrors.protein)}
                              />
                            </label>

                            <label>
                              <span>{selectedNutritionFood?.type === "dish" ? "Жиры всего" : "Жиры"}</span>
                              <input
                                value={selectedNutritionFood.fat}
                                onChange={(event) => updateSelectedNutritionFoodField("fat", event.target.value)}
                                inputMode="decimal"
                                aria-invalid={Boolean(nutritionProductErrors.fat)}
                              />
                            </label>

                            <label>
                              <span>{selectedNutritionFood?.type === "dish" ? "Углеводы всего" : "Углеводы"}</span>
                              <input
                                value={selectedNutritionFood.carbs}
                                onChange={(event) => updateSelectedNutritionFoodField("carbs", event.target.value)}
                                inputMode="decimal"
                                aria-invalid={Boolean(nutritionProductErrors.carbs)}
                              />
                            </label>
                          </div>

                          <label className="foodEditPortionLabel">
                            <span>{selectedNutritionFood?.type === "dish" ? "Итоговый вес блюда" : "Вес порции"}</span>
                            <div className="foodEditPortionUnitRow foodEditPortionInlineUnit">
                              <input
                                value={String(selectedNutritionFood?.type === "dish"
                                  ? (selectedNutritionFood.totalWeight ?? selectedNutritionFood.portionAmount ?? "")
                                  : (selectedNutritionFood.portionAmount ?? getFoodPortionAmount(selectedNutritionFood) ?? "")
                                ).replace(/\s?(г|гр|g|мл|ml)$/iu, "").trim()}
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
                                inputMode="decimal"
                                aria-invalid={Boolean(nutritionProductErrors.portionAmount)}
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

                          {Object.values(nutritionProductErrors).some(Boolean) && (
                            <div className="nutritionProductValidation" role="alert">
                              {Object.values(nutritionProductErrors).filter(Boolean)[0]}
                            </div>
                          )}

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
                                        const foodName = getNutritionFoodSearchText(food);
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
                            <span>{selectedNutritionFood?.type === "dish" ? "Заметка" : "Описание продукта"}</span>
                            <textarea
                              value={nutritionEditNote}
                              onChange={(event) => setNutritionEditNote(event.target.value)}
                              rows={5}
                              placeholder={selectedNutritionFood?.type === "dish" ? "Например: рецепт, способ приготовления, порции" : "Бренд, текст с этикетки, состав, масса нетто и пищевая ценность"}
                            />
                          </label>

                        </div>

                        <nav className="foodEditPageActionBar" aria-label="Действия редактора продукта">
                          <button type="button" onClick={cancelNutritionEditPage}>
                            <span aria-hidden="true">←</span>
                            <strong>Назад</strong>
                          </button>

                          <button
                            type="button"
                            className="foodEditPageConfirmAction"
                            disabled={!String(selectedNutritionFood?.name || "").trim()}
                            onClick={confirmNutritionEditPage}
                          >
                            <span aria-hidden="true">✓</span>
                            <strong>Готово</strong>
                          </button>
                        </nav>
                      </div>
                    </div>
                  )}

                  {!nutritionEditPageOpen && (
                  <nav className="foodProductActionBar" aria-label="Действия с продуктом">
                    <button
                      type="button"
                      onClick={closeSelectedNutritionFood}
                    >
                      <span aria-hidden="true">←</span>
                      <strong>Назад к поиску</strong>
                    </button>

                    <button
                      type="button"
                      className="foodProductDeleteAction"
                      disabled={!canDeleteSelectedNutritionFood()}
                      onClick={() => deleteSelectedNutritionFood()}
                    >
                      <span aria-hidden="true">⌫</span>
                      <strong>Удалить</strong>
                    </button>

                    <button
                      type="button"
                      onClick={openNutritionEditPage}
                    >
                      <span aria-hidden="true">✎</span>
                      <strong>Редактировать</strong>
                    </button>

                    <button
                      type="button"
                      className="foodProductAddAction"
                      onClick={confirmNutritionFoodFromPicker}
                    >
                      <span aria-hidden="true">✓</span>
                      <strong>Добавить</strong>
                    </button>
                  </nav>
                  )}

                  {nutritionDeleteConfirmOpen && createPortal(
                    <div className="nutritionDeleteConfirmOverlay" role="dialog" aria-modal="true" aria-labelledby="nutrition-delete-title">
                      <button
                        type="button"
                        className="nutritionDeleteConfirmBackdrop"
                        onClick={() => setNutritionDeleteConfirmOpen(false)}
                        aria-label="Отменить удаление"
                      />
                      <section className="nutritionDeleteConfirmCard">
                        <button
                          type="button"
                          className="nutritionDeleteConfirmClose"
                          onClick={() => setNutritionDeleteConfirmOpen(false)}
                          aria-label="Закрыть"
                        >
                          ×
                        </button>
                        <span aria-hidden="true">⌫</span>
                        <h2 id="nutrition-delete-title">Удалить из моей базы?</h2>
                        <p>
                          «{selectedNutritionFood?.name || "Продукт"}» будет удалён без возможности восстановления.
                        </p>
                        <div>
                          <button type="button" onClick={() => setNutritionDeleteConfirmOpen(false)}>
                            Отмена
                          </button>
                          <button type="button" className="danger" onClick={() => deleteSelectedNutritionFood(true)}>
                            Удалить
                          </button>
                        </div>
                      </section>
                    </div>,
                    document.body
                  )}
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
                            {nutritionFallbackSuggestions
                              .filter((suggestion) => !suggestion.includes("штрихкод"))
                              .map((suggestion) => (
                              <button
                                type="button"
                                key={suggestion}
                                onClick={() => {
                                  if (suggestion.includes("фото")) {
                                    nutritionPhotoInputRef.current?.click();
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

                    {visibleNutritionSearchResults.map((food) => {
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

                    {nutritionSearchResults.length > visibleNutritionSearchResults.length && (
                      <button
                        type="button"
                        className="fatSearchShowMoreButton"
                        onClick={() => setNutritionSearchResultLimit({
                          key: nutritionSearchResultKey,
                          limit: activeNutritionSearchResultLimit + 8
                        })}
                      >
                        Показать ещё
                        <span>{nutritionSearchResults.length - visibleNutritionSearchResults.length}</span>
                      </button>
                    )}

                    {fatSecretLoading && nutritionSearch.trim().length >= 2 && (
                      <div className="fatAiLoadingBelow">
                        <span />
                        <strong>Ищу ещё варианты через AI/FatSecret…</strong>
                      </div>
                    )}
                  </div>

                  <div className="fatSearchBottomBar fatSearchBottomBarFive">
                    <button
                      type="button"
                      className="fatSearchBackAction"
                      onClick={() => {
                        setNutritionMealMenuOpen(false);
                        setSelectedNutritionFood(null);
                        setEditingNutritionItemId(null);
                        setNutritionEditDetailsOpen(false);
                        setNutritionEditPageOpen(false);
                        setBarcodeScannerOpen(false);
                        setNutritionCreateChoiceOpen(false);
                        setNutritionPickerOpen(false);
                      }}
                      aria-label="Назад к питанию"
                    >
                      <span>←</span>
                      <strong>Назад к питанию</strong>
                    </button>

                    <button
                      type="button"
                      className={`fatSearchSearchAction ${!nutritionCreateChoiceOpen && nutritionSearchTab !== "my" ? "active" : ""}`}
                      onClick={() => {
                        setFatSecretError("");
                        setBarcodeScannerOpen(false);
                        setNutritionCreateChoiceOpen(false);
                        setNutritionSearchTab("food");
                        setShowRecentNutritionFoods(false);
                      }}
                    >
                      <span>⌕</span>
                      <strong>Поиск<br />еды</strong>
                    </button>

                    <button
                      type="button"
                      className="fatSearchPhotoAction"
                      onClick={() => {
                        setBarcodeScannerOpen(false);
                        setNutritionCreateChoiceOpen(false);
                        nutritionPhotoInputRef.current?.click();
                      }}
                      aria-label="Распознать еду по фото"
                    >
                      <span>📷</span>
                      <strong>ИИ поиск</strong>
                    </button>

                    <button
                      type="button"
                      className={`fatSearchCreateAction ${nutritionCreateChoiceOpen ? "active" : ""}`}
                      onClick={() => {
                        setBarcodeScannerOpen(false);
                        setNutritionCreateChoiceOpen(true);
                      }}
                    >
                      <span>＋</span>
                      <strong>Создать<br />продукт</strong>
                    </button>

                    <button
                      type="button"
                      className={`fatSearchMyProductsAction ${!nutritionCreateChoiceOpen && nutritionSearchTab === "my" ? "active" : ""}`}
                      onClick={() => {
                        setBarcodeScannerOpen(false);
                        setNutritionCreateChoiceOpen(false);
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
                    <div className="nutritionCreateChoiceOverlay nutritionCreateChoiceScreen">
                      <div className="nutritionCreateChoiceSheet">
                        <div className="nutritionCreateChoiceHeader">
                          <span>Моя база</span>
                          <h3>Создать</h3>
                          <p>Выбери продукт или блюдо из нескольких ингредиентов.</p>
                        </div>

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

                  {nutritionPhotoNotFoundOpen && (
                    <div className="nutritionPhotoNotFoundOverlay" role="presentation">
                      <section
                        className="nutritionPhotoNotFoundModal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="nutritionPhotoNotFoundTitle"
                      >
                        <button
                          type="button"
                          className="nutritionPhotoNotFoundClose"
                          onClick={resetNutritionPhotoAiState}
                          aria-label="Закрыть"
                        >
                          ×
                        </button>

                        <div className="nutritionPhotoNotFoundIcon" aria-hidden="true">⌕</div>
                        <h3 id="nutritionPhotoNotFoundTitle">Продукт не распознан</h3>
                        <p>Попробуй сделать более чёткое фото или добавь данные продукта самостоятельно.</p>

                        <div className="nutritionPhotoNotFoundActions">
                          <button type="button" onClick={retryNutritionPhotoFromNotFound}>
                            <span aria-hidden="true">📷</span>
                            Сфотографировать ещё раз
                          </button>
                          <button
                            type="button"
                            className="primary"
                            onClick={addNutritionProductManuallyFromPhoto}
                          >
                            <span aria-hidden="true">＋</span>
                            Добавить вручную
                          </button>
                        </div>
                      </section>
                    </div>
                  )}

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
                            ? "Анализирую фото и создаю продукт"
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
                <div className="fatBarcodeOverlay fatBarcodeScreen">
                  <div className="fatBarcodeCard">
                    <div className="fatBarcodeHeader">
                      <span>Скоро</span>
                      <h3>Штрихкод</h3>
                      <p>Мы готовим базу продуктов, чтобы поиск по упаковке был точным и быстрым.</p>
                    </div>
                    <div className="fatBarcodePlaceholder">
                      <span aria-hidden="true">▦</span>
                      <strong>Поиск по штрихкоду появится позже</strong>
                      <p>Сейчас добавь продукт через обычный поиск, ИИ-фото или кнопку «Создать».</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {nutritionUndoDelete && (
          <div className="nutritionUndoToast" role="status">
            <span>Продукт удалён</span>
            <button type="button" onClick={restoreNutritionFood}>Вернуть</button>
          </div>
        )}

        {!nutritionPickerOpen && !nutritionCalendarOpen && !activeNutritionMeal && (
          renderClientMainBottomBar("nutrition", "mainMenuBottomBar profileBottomTabBar nutritionBottomTabBar")
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
    const nextMeasurementField = measurementFields[profileMeasurementWizardStep] || null;
    const progressPercent = Math.max(4, Math.round(((profileMeasurementWizardStep + 1) / totalWizardScreens) * 100));

    const closeMeasurementWizard = () => {
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
      setProfileMeasurementStatus("");
      setProfileMeasurementWizardStep(0);
      setProfileMeasurementOpen(false);
      setProfileActiveTab(profileMeasurementReturnTab);
      setPage("profile");
    };

    return (
      <div className="measurementFullscreenPage">
        <div className="measurementFullscreenHeader">
          <div className="measurementFullscreenProgress">
            <span>Шаг {profileMeasurementWizardStep + 1} из {totalWizardScreens}</span>
            <i><em style={{ width: `${progressPercent}%` }} /></i>
          </div>
          <button
            type="button"
            className="measurementFullscreenClose"
            onClick={closeMeasurementWizard}
            aria-label="Закрыть без сохранения"
          >
            ×
          </button>
        </div>

        <main className="measurementFullscreenBody">
          {nextMeasurementField && (
            <img
              src={`/measurements/${nextMeasurementField.id}.webp`}
              alt=""
              aria-hidden="true"
              className="measurementFullscreenPreload"
              loading="eager"
              decoding="async"
            />
          )}

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
                  src={`/measurements/${activeField.id}.webp`}
                  alt={activeField.label}
                  className="measurementFullscreenImage"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
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
                    placeholder="0"
                    onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, [activeField.id]: event.target.value }))}
                  />
                  <em>{activeField.unit}</em>
                </div>
              </label>

              <small className="measurementFullscreenPrevious">
                Прошлый раз: {getProfileMeasurementValue(latestProfileMeasurement, activeField)} {activeField.unit}
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
                    <strong>{profileMeasurementDraft[field.id] || "0"}</strong>
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

            </section>
          )}
        </main>

        {profileMeasurementStatus && (
          <p className="measurementFullscreenStatus">{profileMeasurementStatus}</p>
        )}

        <div className="measurementFullscreenNav">
          <button
            type="button"
            onClick={() => {
              if (profileMeasurementWizardStep === 0) {
                closeMeasurementWizard();
                return;
              }
              setProfileMeasurementWizardStep((step) => Math.max(0, step - 1));
            }}
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
              {profileMeasurementStatus.startsWith("Замер сохранён") ? "Сохранено ✓" : "Сохранить"}
            </button>
          )}
        </div>
      </div>
    );
  }

  function openCabinetWorkoutHistory(workoutId = null, programScope = null) {
    loadHistory();
    setWorkoutHistoryModalOpen(false);
    setProfileProgressModalOpen(false);
    setProfileWorkoutHistoryProgramScope(programScope);
    setOpenHistoryKey(workoutId);
    setProfileActiveTab("cabinet");
    setPage("profile");
    setProfileWorkoutHistoryModalOpen(true);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
  }

  function toggleCabinetWorkoutHistory(itemId) {
    const shouldOpen = openHistoryKey !== itemId;
    setOpenHistoryKey(shouldOpen ? itemId : null);

    if (shouldOpen) {
      window.requestAnimationFrame(() => {
        cabinetWorkoutHistoryItemRefs.current.get(itemId)?.scrollIntoView({
          block: "start",
          behavior: "smooth"
        });
      });
    }
  }

  function renderClientMainBottomBar(activeTab = "main", className = "mainMenuBottomBar profileBottomTabBar") {
    if (canUseTrainerFeatures()) {
      return renderTrainerMainBottomBar(activeTab, className);
    }

    return (
      <nav className={className} aria-label="Основные разделы">
        <button
          type="button"
          className={activeTab === "main" ? "active" : ""}
          aria-current={activeTab === "main" ? "page" : undefined}
          onClick={goBackToMain}
        >
          <span aria-hidden="true">🏠</span>
          <strong>Главная</strong>
        </button>
        <button
          type="button"
          className={activeTab === "workouts" ? "active" : ""}
          aria-current={activeTab === "workouts" ? "page" : undefined}
          onClick={openTrainingEntry}
        >
          <span aria-hidden="true">🏋️</span>
          <strong>Тренировки</strong>
        </button>
        <button
          type="button"
          className={activeTab === "nutrition" ? "active" : ""}
          aria-current={activeTab === "nutrition" ? "page" : undefined}
          onClick={() => setPage("nutrition")}
        >
          <span aria-hidden="true">🍽️</span>
          <strong>Питание</strong>
        </button>
        <button
          type="button"
          className={activeTab === "cabinet" ? "active" : ""}
          aria-current={activeTab === "cabinet" ? "page" : undefined}
          onClick={() => {
            loadHistory();
            setProfileActiveTab("cabinet");
            setPage("profile");
          }}
        >
          <span aria-hidden="true">👤</span>
          <strong>Кабинет</strong>
        </button>
      </nav>
    );
  }

  function renderTrainerMainBottomBar(activeTab = "main", className = "mainMenuBottomBar profileBottomTabBar") {
    return (
      <nav className={`${className} trainerRoleBottomBar`} aria-label="Разделы тренера">
        <button
          type="button"
          className={activeTab === "main" ? "active" : ""}
          aria-current={activeTab === "main" ? "page" : undefined}
          onClick={() => {
            setSelectedUserId(null);
            setPage("admin");
          }}
        >
          <span aria-hidden="true">🏠</span>
          <strong>Главная</strong>
        </button>
        <button
          type="button"
          className={activeTab === "clients" ? "active" : ""}
          aria-current={activeTab === "clients" ? "page" : undefined}
          onClick={() => openAdminClientsWithFilter("all")}
        >
          <span aria-hidden="true">👥</span>
          <strong>Клиенты</strong>
        </button>
        <button
          type="button"
          className={activeTab === "programs" ? "active" : ""}
          aria-current={activeTab === "programs" ? "page" : undefined}
          onClick={openAdminProgramsOverview}
        >
          <span aria-hidden="true">📋</span>
          <strong>Программы</strong>
        </button>
        <button
          type="button"
          className={activeTab === "cabinet" ? "active" : ""}
          aria-current={activeTab === "cabinet" ? "page" : undefined}
          onClick={() => {
            loadHistory();
            setProfileActiveTab("cabinet");
            setPage("profile");
          }}
        >
          <span aria-hidden="true">👤</span>
          <strong>Кабинет</strong>
        </button>
      </nav>
    );
  }

  function renderTrainerWorkspaceBottomBar(activeTab = "clients") {
    return (
      <nav className="adminV3Nav adminV3BottomBar trainerRoleWorkspaceBar" aria-label="Разделы тренера">
        <button
          className={activeTab === "main" ? "active" : ""}
          type="button"
          onClick={() => {
            setSelectedUserId(null);
            setPage("admin");
          }}
        >
          <span className="adminV3NavIcon">🏠</span>
          <span className="adminV3NavLabel">Главная</span>
        </button>
        <button className={activeTab === "clients" ? "active" : ""} type="button" onClick={() => openAdminClientsWithFilter("all")}>
          <span className="adminV3NavIcon">👥</span>
          <span className="adminV3NavLabel">Клиенты</span>
        </button>
        <button
          className={activeTab === "programs" ? "active" : ""}
          type="button"
          onClick={openAdminProgramsOverview}
        >
          <span className="adminV3NavIcon">📋</span>
          <span className="adminV3NavLabel">Программы</span>
        </button>
        <button
          className={activeTab === "cabinet" ? "active" : ""}
          type="button"
          onClick={() => {
            loadHistory();
            setProfileActiveTab("cabinet");
            setPage("profile");
          }}
        >
          <span className="adminV3NavIcon">👤</span>
          <span className="adminV3NavLabel">Кабинет</span>
        </button>
      </nav>
    );
  }

  function isTrainerNextWorkspace() {
    return currentUserRole === "trainer" && !canUseAdminFeatures();
  }

  async function openTrainerNextClient(client, tab = "overview") {
    if (!client?.id) return;

    setSelectedUserId(client.id);
    setAdminSelectedClient(client);
    setAdminUsersSelectedTab(tab);
    setTrainerNextSection("client");
    setPage("admin");

    await Promise.allSettled([
      loadAdminClientOverview(client, false),
      loadWorkoutsFromFirebase(client.id, { preserveCurrentPlanOnError: true })
    ]);
  }

  async function navigateTrainerNext(section) {
    if (section === "dashboard") {
      setAdminClientPageOpen(false);
      setTrainerNextSection("dashboard");
      setPage("admin");
      return;
    }

    if (section === "clients") {
      setAdminClientFilter("all");
      setAdminClientPageOpen(false);
      setTrainerNextSection("clients");
      setPage("admin");
      return;
    }

    if (section === "workouts") {
      setTrainerWorkoutTab("programs");
      setTrainerProgramManagerOpen(true);
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
      setAdminProgramLibraryTab("overview");
      await loadAdminTrainingTemplates();
      setTrainerNextSection("workouts");
      setPage("adminWorkouts");
      return;
    }

    if (section === "nutrition") {
      const targetClient = adminSelectedClient || usersList.find((client) => client.id === selectedUserId) || usersList[0];
      if (targetClient?.id) {
        await loadAdminClientOverview(targetClient, false);
        setAdminUsersSelectedTab("nutrition");
        setTrainerNextSection("client");
        setPage("admin");
      } else {
        setTrainerNextSection("clients");
        setPage("admin");
      }
      return;
    }

    if (section === "more" || section === "settings") {
      setAdminClientPageOpen(false);
      setTrainerNextSection("cabinet");
      setPage("admin");
      return;
    }

    if (["messages", "analytics", "notifications"].includes(section)) {
      setAdminClientPageOpen(false);
      setTrainerNextSection(section);
      setPage("admin");
      return;
    }

    openAdminClientsWithFilter("all");
  }

  async function openTrainerProgramManager() {
    setTrainerWorkoutTab("programs");
    setTrainerProgramManagerOpen(true);
    setAdminOpenWorkoutId("");
    setAdminSelectedExerciseId("");
    setAdminProgramLibraryTab("overview");
    await loadAdminTrainingTemplates();
    setPage("adminWorkouts");
  }

  async function openTrainerExerciseLibrary() {
    setTrainerWorkoutTab("library");
    setTrainerProgramManagerOpen(false);
    await loadAdminTrainingTemplates();
    setTrainerNextSection("workouts");
    setPage("adminWorkouts");
  }

  function updateTrainerNextWorkout(workoutId, patch = {}) {
    const nextPlan = {
      ...plan,
      workouts: (plan.workouts || []).map((workoutItem) =>
        workoutItem.id === workoutId ? { ...workoutItem, ...patch } : workoutItem
      )
    };
    const shouldAutoSaveStatus = ["status", "statusUpdatedAt", "movedToDate"].some((key) =>
      Object.prototype.hasOwnProperty.call(patch, key)
    );

    setPlan(nextPlan);

    if (shouldAutoSaveStatus) {
      void saveWorkoutsToFirebase(nextPlan, {
        silent: true,
        successMessage: "Статус тренировки сохранён."
      });
    }
  }

  function updateTrainerNextExercise(workoutId, exerciseId, patch = {}) {
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) => {
        if (workoutItem.id !== workoutId) return workoutItem;

        return {
          ...workoutItem,
          exercises: (workoutItem.exercises || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const nextPatch = { ...patch };

            if (Object.prototype.hasOwnProperty.call(patch, "name")) {
              const libraryExercise = findExerciseLibraryMatch(
                trainerExerciseLibraryItems,
                patch.name,
                exerciseId
              );
              const libraryVideo = libraryExercise?.video || libraryExercise?.videoUrl || libraryExercise?.videoURL || "";

              if (libraryVideo && (!exercise.video || exercise.videoAutoFilledFrom)) {
                nextPatch.video = libraryVideo;
                nextPatch.videoAutoFilledFrom = libraryExercise.name;
                nextPatch.requiresWeight = exerciseUsesExternalWeight(libraryExercise);
              } else if (exercise.videoAutoFilledFrom && !libraryVideo) {
                nextPatch.video = "";
                nextPatch.videoAutoFilledFrom = "";
              }
            }

            return { ...exercise, ...nextPatch };
          })
        };
      })
    }));
  }

  function updateTrainerNextExerciseSet(workoutId, exerciseId, setIndex, patch = {}) {
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) => {
        if (workoutItem.id !== workoutId) return workoutItem;

        return {
          ...workoutItem,
          exercises: (workoutItem.exercises || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const sets = Array.isArray(exercise.sets) && exercise.sets.length
              ? exercise.sets.map((set) => ({ ...set }))
              : [{ reps: 8, weight: "" }];
            sets[setIndex] = { ...(sets[setIndex] || {}), ...patch };
            return { ...exercise, sets };
          })
        };
      })
    }));
  }

  function addTrainerNextExerciseSet(workoutId, exerciseId) {
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) => {
        if (workoutItem.id !== workoutId) return workoutItem;
        return {
          ...workoutItem,
          exercises: (workoutItem.exercises || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const sets = Array.isArray(exercise.sets) && exercise.sets.length
              ? exercise.sets
              : [{ reps: 8, weight: "" }];
            const previousSet = sets[sets.length - 1] || {};
            return {
              ...exercise,
              sets: [...sets, { reps: previousSet.reps ?? 8, weight: previousSet.weight ?? "" }]
            };
          })
        };
      })
    }));
  }

  function removeTrainerNextExerciseSet(workoutId, exerciseId, setIndex) {
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) => {
        if (workoutItem.id !== workoutId) return workoutItem;
        return {
          ...workoutItem,
          exercises: (workoutItem.exercises || []).map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const sets = Array.isArray(exercise.sets) && exercise.sets.length
              ? exercise.sets
              : [{ reps: 8, weight: "" }];
            if (sets.length <= 1) return exercise;
            return { ...exercise, sets: sets.filter((_, index) => index !== setIndex) };
          })
        };
      })
    }));
  }

  function addTrainerNextExercise(workoutId, sourceExercise = null) {
    const stamp = Date.now();
    const sourceName = String(sourceExercise?.name || "").trim();
    const libraryExercise = sourceExercise || findExerciseLibraryMatch(
      trainerExerciseLibraryItems,
      sourceName
    );
    const libraryVideo = libraryExercise?.video || libraryExercise?.videoUrl || libraryExercise?.videoURL || "";
    const sourceSets = Array.isArray(libraryExercise?.sets) && libraryExercise.sets.length
      ? libraryExercise.sets
      : [{ reps: "8-12", weight: "" }, { reps: "8-12", weight: "" }, { reps: "8-12", weight: "" }];

    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) => (
        workoutItem.id === workoutId
          ? {
              ...workoutItem,
              exercises: [
                ...(workoutItem.exercises || []),
                {
                  ...libraryExercise,
                  id: `exercise_${stamp}`,
                  name: sourceName || "Новое упражнение",
                  video: libraryVideo,
                  videoAutoFilledFrom: libraryVideo ? libraryExercise?.name || "" : "",
                  requiresWeight: exerciseUsesExternalWeight(libraryExercise || { name: sourceName }),
                  rest: libraryExercise?.rest || "90 сек",
                  sets: sourceSets.map((set, index) => ({
                    ...set,
                    ...(set?.id ? { id: `set_${stamp}_${index}` } : {})
                  }))
                }
              ]
            }
          : workoutItem
      ))
    }));
  }

  function removeTrainerNextExercise(workoutId, exerciseId) {
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) =>
        workoutItem.id !== workoutId
          ? workoutItem
          : {
              ...workoutItem,
              exercises: (workoutItem.exercises || []).filter((exercise) => exercise.id !== exerciseId)
            }
      )
    }));
  }

  function duplicateTrainerNextExercise(workoutId, exerciseId) {
    const stamp = Date.now();
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) => {
        if (workoutItem.id !== workoutId) return workoutItem;
        const sourceIndex = (workoutItem.exercises || []).findIndex((exercise) => exercise.id === exerciseId);
        if (sourceIndex < 0) return workoutItem;
        const source = workoutItem.exercises[sourceIndex];
        const copy = {
          ...source,
          id: `exercise_${stamp}`,
          name: `${source.name || "Упражнение"} — копия`,
          sets: (source.sets || []).map((set, index) => ({
            ...set,
            ...(set?.id ? { id: `set_${stamp}_${index}` } : {})
          }))
        };
        const exercises = [...workoutItem.exercises];
        exercises.splice(sourceIndex + 1, 0, copy);
        return { ...workoutItem, exercises };
      })
    }));
  }

  function moveTrainerNextExercise(workoutId, exerciseId, direction) {
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).map((workoutItem) => {
        if (workoutItem.id !== workoutId) return workoutItem;
        const exercises = [...(workoutItem.exercises || [])];
        const sourceIndex = exercises.findIndex((exercise) => exercise.id === exerciseId);
        const targetIndex = sourceIndex + direction;
        if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= exercises.length) return workoutItem;
        [exercises[sourceIndex], exercises[targetIndex]] = [exercises[targetIndex], exercises[sourceIndex]];
        return { ...workoutItem, exercises };
      })
    }));
  }

  function addTrainerNextWorkoutDay() {
    setPlan((current) => {
      const workouts = current.workouts || [];
      const dayNumber = workouts.length + 1;
      return {
        ...current,
        workouts: [
          ...workouts,
          {
            id: `trainer_day_${Date.now()}`,
            name: `День ${dayNumber}`,
            order: dayNumber,
            sortOrder: dayNumber,
            exercises: []
          }
        ]
      };
    });
  }

  function duplicateTrainerNextWorkoutDay(workoutId) {
    const stamp = Date.now();
    setPlan((current) => {
      const workouts = current.workouts || [];
      const sourceIndex = workouts.findIndex((workout) => workout.id === workoutId);
      if (sourceIndex < 0) return current;
      const source = workouts[sourceIndex];
      const copy = {
        ...source,
        id: `trainer_day_${stamp}`,
        name: `${source.name || `День ${sourceIndex + 1}`} — копия`,
        exercises: (source.exercises || []).map((exercise, exerciseIndex) => ({
          ...exercise,
          id: `exercise_${stamp}_${exerciseIndex}`,
          sets: (exercise.sets || []).map((set, setIndex) => ({
            ...set,
            ...(set?.id ? { id: `set_${stamp}_${exerciseIndex}_${setIndex}` } : {})
          }))
        }))
      };
      const nextWorkouts = [...workouts];
      nextWorkouts.splice(sourceIndex + 1, 0, copy);
      return { ...current, workouts: nextWorkouts };
    });
  }

  function removeTrainerNextWorkoutDay(workoutId) {
    setPlan((current) => ({
      ...current,
      workouts: (current.workouts || []).filter((workout) => workout.id !== workoutId)
    }));
  }

  async function uploadTrainerNextExerciseVideo(workoutId, exerciseId, file) {
    if (!file || !auth.currentUser?.uid) return;

    setAdminExerciseVideoUploadingId(exerciseId);
    try {
      const safeName = String(file.name || "exercise-video").replace(/[^\wа-яА-ЯёЁ.\-]+/g, "_");
      const storageRef = ref(
        storage,
        `exercise-videos/${auth.currentUser.uid}/client-plans/${Date.now()}-${safeName}`
      );
      await uploadBytes(storageRef, file);
      const videoUrl = await getDownloadURL(storageRef);
      updateTrainerNextExercise(workoutId, exerciseId, {
        video: videoUrl,
        videoAutoFilledFrom: ""
      });
    } catch (error) {
      console.error("Trainer exercise video upload error:", error);
      showAppError("firebase", "Не получилось загрузить видео упражнения.");
    } finally {
      setAdminExerciseVideoUploadingId("");
    }
  }

  function getTrainerNextCreateClientState() {
    return {
      open: adminCreateClientModalOpen,
      name: adminNewUserName,
      email: adminNewUserEmail,
      password: adminNewUserPassword,
      loading: adminCreateUserLoading,
      status: adminCreateUserStatus,
      credentials: adminCreatedCredentials,
      onClose: () => setAdminCreateClientModalOpen(false),
      onNameChange: setAdminNewUserName,
      onEmailChange: setAdminNewUserEmail,
      onPasswordChange: setAdminNewUserPassword,
      onGeneratePassword: generateAdminPassword,
      onSubmit: createUserFromAdminPanel
    };
  }

  function renderClientTrainingBottomBar(activeTab = "workouts") {
    return (
      <nav className="individualWorkoutMenuBar" aria-label="Навигация тренировок">
        <button type="button" onClick={goBackToMain}>
          <span aria-hidden="true">🏠</span>
          <strong>Главная</strong>
        </button>
        <button
          type="button"
          className={activeTab === "workouts" ? "active" : ""}
          aria-current={activeTab === "workouts" ? "page" : undefined}
          onClick={() => {
            setSelectedWorkoutId(null);
            setPage("workouts");
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
          }}
        >
          <span aria-hidden="true">🏋️</span>
          <strong>Тренировки</strong>
        </button>
        <button
          type="button"
          className={activeTab === "plan" ? "active" : ""}
          aria-current={activeTab === "plan" ? "page" : undefined}
          onClick={() => {
            setPage("workoutPlan");
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
          }}
        >
          <span aria-hidden="true">📋</span>
          <strong>План</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            loadHistory();
            setPage("history");
          }}
        >
          <span aria-hidden="true">🗓️</span>
          <strong>История</strong>
        </button>
      </nav>
    );
  }

  if (page === "profile" || page === "main") {
    const isMainDashboard = page === "main";
    const visibleProfileTab = isMainDashboard
      ? "cabinet"
      : (profileActiveTab === "nutrition" || profileActiveTab === "progress" ? "cabinet" : profileActiveTab);
    const totalWorkouts = history.length;
    const lastWorkout = history[0];
    const activeProfile = {
      ...(aiNutritionProfile || {}),
      ...aiNutritionProfileDraft
    };
    const latestProfileMeasurement = Array.isArray(profileMeasurements) && profileMeasurements.length
      ? profileMeasurements[0]
      : null;
    const latestClientProgressPhoto = Array.isArray(clientProgressPhotos) && clientProgressPhotos.length
      ? clientProgressPhotos[0]
      : null;
    const previousClientProgressPhoto = Array.isArray(clientProgressPhotos) && clientProgressPhotos.length > 1
      ? clientProgressPhotos[1]
      : null;
    const selectedClientProgressPhotoBefore = clientProgressPhotos.find(
      (photo) => photo.id === profileProgressPhotoCompareIds[0]
    ) || previousClientProgressPhoto;
    const selectedClientProgressPhotoAfter = clientProgressPhotos.find(
      (photo) => photo.id === profileProgressPhotoCompareIds[1]
    ) || latestClientProgressPhoto;
    const progressPhotoCompareViews = [
      { id: "front", label: "Спереди", urlKey: "frontUrl" },
      { id: "side", label: "Сбоку", urlKey: "sideUrl" },
      { id: "back", label: "Со спины", urlKey: "backUrl" }
    ];
    const activeProgressPhotoCompareView = progressPhotoCompareViews.find(
      (view) => view.id === profileProgressPhotoCompareView
    ) || progressPhotoCompareViews[0];
    const formatClientProgressPhotoDate = (photo) => {
      const dateValue = photo?.date || photo?.createdAt?.slice(0, 10);
      if (!dateValue) return "Дата не указана";
      const date = new Date(`${dateValue}T12:00:00`);
      return Number.isNaN(date.getTime()) ? "Дата не указана" : date.toLocaleDateString("ru-RU");
    };
    const profileProgressPhotoSetComplete = ["front", "side", "back"].every(
      (view) => Boolean(profileProgressPhotoFiles[view])
    );
    const activeActivityLabel = getAiNutritionActivityLabel(activeProfile?.activity || "medium");
    const assignedProgramName = user?.assignedProgramName || aiNutritionProfile?.assignedProgramName || "";
    const profileWorkoutHistoryItems = getProgramHistoryItems(history, profileWorkoutHistoryProgramScope);
    const trainingDaysText = getAiNutritionTrainingDays(activeProfile).length
      ? AI_NUTRITION_WEEK_DAYS
          .filter((day) => getAiNutritionTrainingDays(activeProfile).includes(day.id))
          .map((day) => day.short)
          .join(", ")
      : "не выбраны";
    const todayTotals = getAiNutritionTotalsForToday(nutrition);
    const liveNutritionPreviewPlan = buildAiNutritionMonthlyPlan(nutrition, activeProfile, history, null);
    const activePlan = getClientNutritionDisplayPlan(
      {
        aiNutritionPlan: aiNutritionSavedPlan,
        aiNutritionProfile: activeProfile,
        profile: activeProfile,
        nutritionPlan: nutrition.nutritionPlan
      },
      nutrition,
      nutrition.goals
    ) || liveNutritionPreviewPlan || aiNutritionSavedPlan || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);
    const activeWeek = activePlan?.weeks?.[getAiNutritionCurrentWeek(activePlan) - 1] || activePlan?.weeks?.[0];
    const activePlanProfile = activePlan?.profile || activeProfile;
    const activeGoalLabel = activePlan?.goalLabel || getAiNutritionGoalLabel(activePlanProfile?.goal || "recomp");
    const profileMacros = getAiNutritionDayMacros(activeWeek || nutrition.goals, activePlanProfile);
    const profileNutritionDraftProfile = {
      ...activeProfile,
      ...aiNutritionProfileDraft,
      trainingDays: getAiNutritionTrainingDays(aiNutritionProfileDraft)
    };
    const profileNutritionDraftPlan = buildAiNutritionMonthlyPlan(nutrition, profileNutritionDraftProfile, history, null);
    const profileNutritionDraftWeek = profileNutritionDraftPlan?.weeks?.[0] || profileNutritionDraftPlan?.start || nutrition.goals;
    const profileNutritionDraftMacros = getAiNutritionDayMacros(profileNutritionDraftWeek, profileNutritionDraftProfile);
    const trainerNotificationCount = clientTrainerTasks.filter(
      (task) => getTrainerTaskStatus(task).id !== "completed"
    ).length;
    const workoutCalendarDateKey = (date) => (
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    );
    const [workoutCalendarYear, workoutCalendarMonthIndex] = profileWorkoutCalendarMonth
      .split("-")
      .map(Number);
    const workoutCalendarMonthDate = new Date(
      workoutCalendarYear,
      Math.max(0, (workoutCalendarMonthIndex || 1) - 1),
      1
    );
    const workoutCalendarStartOffset = (workoutCalendarMonthDate.getDay() + 6) % 7;
    const workoutCalendarGridStart = new Date(
      workoutCalendarMonthDate.getFullYear(),
      workoutCalendarMonthDate.getMonth(),
      1 - workoutCalendarStartOffset
    );
    const workoutCalendarHistoryByDate = history.reduce((result, item) => {
      const timestamp = getTimestampValue(item?.date);
      if (!timestamp) return result;
      const key = workoutCalendarDateKey(new Date(timestamp));
      result[key] = [...(result[key] || []), item];
      return result;
    }, {});
    const profileCalendarWorkouts = sortWorkoutDays(plan.workouts || []);
    const profileCalendarSource = {
      ...(profileWorkoutCalendarData || {}),
      scheduledDates: profileWorkoutScheduledDates,
      monthlyTrainingDates: profileWorkoutScheduledDates
    };
    const profileWorkoutSlots = buildPlannedWorkoutSlots({
      workouts: profileCalendarWorkouts,
      calendar: profileCalendarSource,
      history
    });
    const profileWorkoutCalendarEntries = buildWorkoutScheduleCalendarEntries(profileWorkoutSlots);
    const profileWorkoutEntriesByDate = profileWorkoutCalendarEntries.reduce((result, entry) => {
      if (!result[entry.date]) result[entry.date] = [];
      result[entry.date].push(entry);
      return result;
    }, {});
    const profileWorkoutDraftEntriesByDate = profileWorkoutCalendarDraftDates.reduce((result, date, index) => {
      result[date] = profileWorkoutEntriesByDate[date]?.length
        ? profileWorkoutEntriesByDate[date]
        : [{ date, order: index + 1, status: "planned", title: `Тренировка №${index + 1}` }];
      return result;
    }, {});
    const profileWorkoutVisibleEntriesByDate = profileWorkoutCalendarEditing
      ? profileWorkoutDraftEntriesByDate
      : profileWorkoutEntriesByDate;
    const workoutCalendarDays = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(
        workoutCalendarGridStart.getFullYear(),
        workoutCalendarGridStart.getMonth(),
        workoutCalendarGridStart.getDate() + index
      );
      const key = workoutCalendarDateKey(date);
      return {
        date,
        key,
        isCurrentMonth: date.getMonth() === workoutCalendarMonthDate.getMonth(),
        isToday: key === workoutCalendarDateKey(new Date()),
        isScheduled: (
          profileWorkoutCalendarEditing
            ? profileWorkoutCalendarDraftDates
            : profileWorkoutScheduledDates
        ).includes(key),
        scheduleEntries: profileWorkoutVisibleEntriesByDate[key] || [],
        workouts: workoutCalendarHistoryByDate[key] || []
      };
    });
    const selectedWorkoutCalendarItems = workoutCalendarHistoryByDate[profileWorkoutCalendarDate] || [];
    const shiftProfileWorkoutCalendarMonth = (direction) => {
      const nextMonth = new Date(
        workoutCalendarMonthDate.getFullYear(),
        workoutCalendarMonthDate.getMonth() + direction,
        1
      );
      setProfileWorkoutCalendarMonth(
        `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`
      );
      setProfileWorkoutCalendarDate(workoutCalendarDateKey(nextMonth));
    };
    const toggleProfileWorkoutScheduledDate = (dateKey) => {
      setProfileWorkoutCalendarDraftDates((current) => (
        current.includes(dateKey)
          ? current.filter((item) => item !== dateKey)
          : [...current, dateKey].sort()
      ));
      setProfileWorkoutCalendarStatus("");
    };
    const saveProfileWorkoutCalendar = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || profileWorkoutCalendarSaving) return;

      setProfileWorkoutCalendarSaving(true);
      setProfileWorkoutCalendarStatus("");

      try {
        const userRef = doc(db, "users", uid);
        const userSnapshot = await getDoc(userRef);
        const currentCalendar = userSnapshot.exists()
          ? userSnapshot.data()?.workoutCalendar || {}
          : {};
        const scheduledDates = [...new Set(profileWorkoutCalendarDraftDates)].sort();
        const plannedWorkouts = buildWorkoutScheduleDraft(scheduledDates, sortWorkoutDays(plan.workouts || []));
        const nextCalendar = {
          ...currentCalendar,
          scheduledDates,
          monthlyTrainingDates: scheduledDates,
          plannedWorkouts,
          updatedAt: new Date().toISOString()
        };

        await setDoc(userRef, {
          workoutCalendar: nextCalendar,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setProfileWorkoutScheduledDates(scheduledDates);
        setProfileWorkoutCalendarDraftDates(scheduledDates);
        setProfileWorkoutCalendarData(nextCalendar);
        safeWriteUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, uid, nextCalendar);
        setProfileWorkoutCalendarEditing(false);
        setProfileWorkoutCalendarStatus("Тренировочные дни сохранены.");
      } catch (error) {
        console.error("Workout calendar save failed:", error);
        setProfileWorkoutCalendarStatus("Не получилось сохранить дни. Проверь соединение.");
      } finally {
        setProfileWorkoutCalendarSaving(false);
      }
    };

    const profileAiNutritionPlan = activePlan;
    const profileAiNutritionDay = buildAiNutritionDayModel(nutrition, nutrition.days?.[nutritionDateKey], history);
    const profileAiNutritionWeekNumber = getAiNutritionCurrentWeek(profileAiNutritionPlan);
    const profileAiNutritionWeek = profileAiNutritionPlan?.weeks?.[profileAiNutritionWeekNumber - 1] || profileAiNutritionPlan?.weeks?.[0];
    const profileAiNutritionActiveProfile = profileAiNutritionPlan?.profile || activeProfile;
    const profileIsAiTrainingDayToday = isAiNutritionTrainingDay(profileAiNutritionActiveProfile);
    const profileNutritionCalendarDays = getNutritionCalendarDays();
    const profileNutritionMonthDays = profileNutritionCalendarDays
      .slice(-7)
      .some((day) => day.isCurrentMonth)
        ? profileNutritionCalendarDays
        : profileNutritionCalendarDays.slice(0, -7);
    const profileNutritionSelectedDate = nutritionKeyToDate(nutritionDateKey);
    const profileNutritionSelectedDayIndex = profileNutritionMonthDays.findIndex(
      (day) => day.key === nutritionDateKey
    );
    const profileNutritionTodayIndex = profileNutritionMonthDays.findIndex((day) => day.isToday);
    const profileNutritionWeekAnchorIndex = profileNutritionSelectedDayIndex >= 0
      ? profileNutritionSelectedDayIndex
      : Math.max(0, profileNutritionTodayIndex);
    const profileNutritionWeekStartIndex = Math.floor(profileNutritionWeekAnchorIndex / 7) * 7;
    const profileNutritionWeekDays = profileNutritionMonthDays.slice(
      profileNutritionWeekStartIndex,
      profileNutritionWeekStartIndex + 7
    );
    const profileNutritionWeekLabel = profileNutritionWeekDays.length
      ? `${profileNutritionWeekDays[0].date.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short"
        })} – ${profileNutritionWeekDays[6].date.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })}`
      : profileNutritionSelectedDate.toLocaleDateString("ru-RU");
    const profileAiNutritionSelectedWeek = getAiNutritionWeekForDate(profileAiNutritionPlan, profileNutritionSelectedDate);
    const profileAiNutritionSelectedMacros = getAiNutritionDayMacros(
      profileAiNutritionSelectedWeek || profileAiNutritionWeek || nutrition.goals,
      profileAiNutritionActiveProfile,
      profileNutritionSelectedDate
    );
    const profileNutritionSelectedDay = nutrition.days?.[nutritionDateKey] || makeEmptyNutritionDay();
    const profileNutritionSelectedTotals = getNutritionDayTotals(profileNutritionSelectedDay);
    const profileAiNutritionTrainingAdvice = getAiNutritionTrainingDayAdvice(profileIsAiTrainingDayToday, profileAiNutritionActiveProfile?.goal);
    const lastWorkoutDate = formatProfileWorkoutDate(lastWorkout?.date);
    const nextTrainingText = getProfileNextTrainingText(
      activeProfile,
      user,
      profileWorkoutScheduledDates
    );
    const currentGoalId = activeProfile?.goal || "recomp";
    const progressTone = currentGoalId === "mass"
      ? "Набираем массу аккуратно"
      : currentGoalId === "cut" || currentGoalId === "dry"
        ? "Снижаем вес без потери мышц"
        : currentGoalId === "maintain"
          ? "Держим форму стабильно"
          : "Рекомпозиция идёт по плану";
    const greetingName = profileAccount.displayName || telegramProfile.displayName || auth.currentUser?.email?.split("@")?.[0] || "спортсмен";
    const profileAvatarUrl = profileAccount.avatarUrl || telegramProfile.avatarUrl || auth.currentUser?.photoURL || "";
    const profileStreak = Math.min(30, Math.max(0, totalWorkouts));
    const mainProfileWeight = Number(activeProfile?.weight);
    const savedMainMeasurementSeries = (Array.isArray(profileMeasurements) ? profileMeasurements : [])
      .slice(0, 7)
      .reverse()
      .map((measurement) => {
        const weight = Number(measurement?.weight);
        const dateLabel = formatProfileMeasurementDate(measurement)
          .split(".")
          .slice(0, 2)
          .join(".");
        return Number.isFinite(weight) && weight > 0 ? { weight, dateLabel } : null;
      })
      .filter(Boolean);
    const mainMeasurementSeries = savedMainMeasurementSeries.length
      ? savedMainMeasurementSeries
      : Number.isFinite(mainProfileWeight) && mainProfileWeight > 0
        ? [{ weight: mainProfileWeight, dateLabel: "Сейчас" }]
        : [];
    const mainMeasurementWeights = mainMeasurementSeries.map((item) => item.weight);
    const mainMeasurementMin = mainMeasurementWeights.length ? Math.min(...mainMeasurementWeights) : 0;
    const mainMeasurementMax = mainMeasurementWeights.length ? Math.max(...mainMeasurementWeights) : 0;
    const mainMeasurementRange = Math.max(1, mainMeasurementMax - mainMeasurementMin);
    const mainMeasurementPoints = mainMeasurementSeries
      .map((item, index) => {
        const x = mainMeasurementSeries.length === 1
          ? 130
          : 10 + (index / (mainMeasurementSeries.length - 1)) * 240;
        const y = mainMeasurementSeries.length === 1
          ? 36
          : 62 - ((item.weight - mainMeasurementMin) / mainMeasurementRange) * 46;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const mainLatestWeight = mainMeasurementSeries.at(-1)?.weight ||
      (Number.isFinite(mainProfileWeight) && mainProfileWeight > 0 ? mainProfileWeight : 0);
    const mainPreviousWeight = mainMeasurementSeries.at(-2)?.weight || 0;
    const mainWeightChange = mainLatestWeight && mainPreviousWeight
      ? mainLatestWeight - mainPreviousWeight
      : 0;
    const progressInsight = buildProgressInsight({
      history,
      measurements: profileMeasurements,
      nutrition,
      calorieGoal: Number(profileMacros.calories || nutrition.goals.calories),
      proteinGoal: Number(profileMacros.protein || nutrition.goals.protein),
      scheduledDates: profileWorkoutScheduledDates,
      goal: currentGoalId
    });
    const aiCoachStatuses = progressInsight.statuses;

    return (
      <div
        className={`${isMainDashboard
          ? "profileDashboardPage profileTabbedPage mainDashboardPage"
          : "profileDashboardPage profileTabbedPage"}${
          isMainDashboard
            ? " clientCorePage clientCorePageMain"
            : visibleProfileTab === "cabinet"
              ? " clientCorePage clientCorePageCabinet"
              : ""
        }${currentUserRole === "trainer" && !canUseAdminFeatures() ? " trainerRolePage" : ""}`}
        data-profile-tab={visibleProfileTab}
      >
        {(isMainDashboard || visibleProfileTab === "cabinet") && (
          <div className="appVersionBadge clientPageVersionBadge">{APP_VERSION}</div>
        )}

        {isMainDashboard && (
          <>
            <button
              type="button"
              className="menuRefreshIconBtn"
              onClick={refreshPage}
              aria-label="Обновить страницу"
              title="Обновить страницу"
            >
              🔄
            </button>
          </>
        )}

        {!isMainDashboard && renderClientMainBottomBar("cabinet")}

        {isMainDashboard && (
          renderClientMainBottomBar("main")
        )}

        {isMainDashboard && <h1 className="mainDashboardTitle clientCorePageTitle">Главное меню</h1>}

        {!isMainDashboard && visibleProfileTab === "cabinet" && (
          <div className="profileCabinetTitleRow">
            <h1 className="profileCabinetPageTitle clientCorePageTitle">Личный кабинет</h1>
            {!canUseTrainerFeatures() && (
              <button
                type="button"
                className="profileTrainerNotificationsButton"
                aria-label={`Уведомления тренера${trainerNotificationCount ? `: ${trainerNotificationCount}` : ""}`}
                title="Уведомления тренера"
                onClick={() => setProfileTrainerNotificationsOpen(true)}
              >
                <span aria-hidden="true">🔔</span>
                {trainerNotificationCount > 0 && (
                  <em>{Math.min(trainerNotificationCount, 99)}</em>
                )}
              </button>
            )}
          </div>
        )}

        <section className="profileUnifiedCard profileAiDashboardCard profileCabinetSection">
          {visibleProfileTab === "cabinet" && (
          <div
            className={`profileAiHero${!isMainDashboard && !canUseTrainerFeatures() ? " profileAiHeroButton" : ""}`}
            role={!isMainDashboard && !canUseTrainerFeatures() ? "button" : undefined}
            tabIndex={!isMainDashboard && !canUseTrainerFeatures() ? 0 : undefined}
            aria-label={!isMainDashboard && !canUseTrainerFeatures() ? "Открыть аккаунт" : undefined}
            onClick={() => {
              if (isMainDashboard || canUseTrainerFeatures()) return;
              setProfileProgressModalOpen(false);
              openProfileAccount();
            }}
            onKeyDown={(event) => {
              if (
                isMainDashboard ||
                canUseTrainerFeatures() ||
                (event.key !== "Enter" && event.key !== " ")
              ) return;
              event.preventDefault();
              setProfileProgressModalOpen(false);
              openProfileAccount();
            }}
          >
            <div className="profileAiAvatarWrap">
              <div className={telegramProfile.connected ? "profileAvatarBig telegram profileUnifiedAvatar profileAiAvatar" : "profileAvatarBig profileUnifiedAvatar profileAiAvatar"}>
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt="" />
                ) : (
                  <span>{telegramProfile.connected ? "✈️" : "👤"}</span>
                )}
              </div>
              <div className="profileAiAvatarRing">
                <strong>{progressInsight.score === null ? "—" : `${progressInsight.score}%`}</strong>
              </div>
            </div>

            <div className="profileAiHeroText">
              {!isMainDashboard && <span>ЛИЧНЫЙ КАБИНЕТ</span>}
              <h1>Добрый день, {greetingName} 👋</h1>

            </div>

          </div>
          )}

          {!isMainDashboard && visibleProfileTab === "cabinet" && (
          <div className={`progressHubOverview profileCabinetProgressOverview${!canUseTrainerFeatures() ? " hasProgressPhotos" : ""}`}>
            {!canUseTrainerFeatures() && (
              <button
                type="button"
                className="progressHubCard photos"
                onClick={() => {
                  setProfileProgressPhotoStatus("");
                  setProfileProgressPhotoCompareIds([
                    clientProgressPhotos[1]?.id || "",
                    clientProgressPhotos[0]?.id || ""
                  ]);
                  setProfileProgressPhotoCompareView("front");
                  setProfileProgressPhotosModalOpen(true);
                }}
              >
                <span className="progressHubCardIcon">📷</span>
                <span className="progressHubCardText">
                  <small>КОНТРОЛЬ ТЕЛА</small>
                  <strong>Фото прогресса</strong>
                  <em>
                    {latestClientProgressPhoto
                      ? `Последние: ${new Date(`${latestClientProgressPhoto.date || latestClientProgressPhoto.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}`
                      : "Добавь первые фото"}
                  </em>
                </span>
                <i>›</i>
              </button>
            )}

            {!canUseTrainerFeatures() && (
              <button
                type="button"
                className="progressHubCard measurements"
                onClick={() => setProfileMeasurementsModalOpen(true)}
              >
                <span className="progressHubCardIcon">📏</span>
                <span className="progressHubCardText">
                  <small>КОНТРОЛЬ ТЕЛА</small>
                  <strong>Замеры</strong>
                  <em>{latestProfileMeasurement ? formatProfileMeasurementDate(latestProfileMeasurement) : "Замеров пока нет"}</em>
                </span>
                <i>›</i>
              </button>
            )}

            {!canUseTrainerFeatures() && (
              <button
                type="button"
                className="progressHubCard nutrition"
                onClick={() => {
                  setProfileNutritionSaveStatus("");
                  setSelectedNutritionDateKey(todayNutritionKey());
                  setProfileNutritionModalOpen(true);
                }}
              >
                <span className="progressHubCardIcon">🍽️</span>
                <span className="progressHubCardText">
                  <small>ПЛАН ПИТАНИЯ</small>
                  <strong>План КБЖУ</strong>
                  <em>{Math.round(profileMacros.calories || nutrition.goals.calories)} ккал · {activeGoalLabel}</em>
                </span>
                <i>›</i>
              </button>
            )}

            {!canUseTrainerFeatures() && (
              <button
                type="button"
                className="progressHubCard progress"
                onClick={() => {
                  setProfileSettingsModalOpen(false);
                  loadHistory();
                  setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
                  setProfileWorkoutCalendarEditing(false);
                  setProfileWorkoutCalendarStatus("");
                  setProfileProgressModalOpen(true);
                }}
              >
                <span className="progressHubCardIcon">🗓️</span>
                <span className="progressHubCardText">
                  <small>ТРЕНИРОВКИ</small>
                  <strong>Календарь</strong>
                  <em>{history.length ? `${history.length} тренировок сохранено` : "История пока пустая"}</em>
                </span>
                <i>›</i>
              </button>
            )}

            {!canUseTrainerFeatures() && (
              <button
                type="button"
                className="progressHubCard history"
                onClick={() => openCabinetWorkoutHistory()}
              >
                <span className="progressHubCardIcon">🕘</span>
                <span className="progressHubCardText">
                  <small>ТРЕНИРОВКИ</small>
                  <strong>История тренировок</strong>
                  <em>{history.length ? `${history.length} тренировок сохранено` : "История пока пустая"}</em>
                </span>
                <i>›</i>
              </button>
            )}

            <button
              type="button"
              className="progressHubCard accountProfile"
              onClick={openProfileAccount}
            >
              <span className="progressHubCardIcon">👤</span>
              <span className="progressHubCardText">
                <small>АККАУНТ</small>
                <strong>Профиль</strong>
                <em>Имя, почта, пароль и выход</em>
              </span>
              <i>›</i>
            </button>

            {!canUseTrainerFeatures() && (
              <button
                type="button"
                className="progressHubCard questionnaire"
                onClick={() => {
                  setProfileBodyMetricsOpen(true);
                  setProfileSettingsModalSection("profile");
                  setProfileSettingsModalOpen(true);
                }}
              >
                <span className="progressHubCardIcon">📋</span>
                <span className="progressHubCardText">
                  <small>ПАРАМЕТРЫ</small>
                  <strong>Анкета</strong>
                  <em>Вес, рост, возраст, цель и активность</em>
                </span>
                <i>›</i>
              </button>
            )}

            <button
              type="button"
              className="progressHubCard settings"
              onClick={() => {
                setProfileProgressModalOpen(false);
                setProfileSettingsModalSection("settings");
                setProfileSettingsModalOpen(true);
              }}
            >
              <span className="progressHubCardIcon">⚙️</span>
              <span className="progressHubCardText">
                <small>ПАРАМЕТРЫ</small>
                <strong>Настройки</strong>
                <em>Оформление и Telegram</em>
              </span>
              <i>›</i>
            </button>
          </div>
          )}

          {isMainDashboard && (
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

          {isMainDashboard && (
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

          {isMainDashboard && (
          <div className={`profileAiCoachInsight ${progressInsight.tone}`}>
            <button
              type="button"
              className="profileAiCoachToggle"
              onClick={isMainDashboard ? undefined : () => setProfileProgressAnalysisOpen((prev) => !prev)}
            >
              <div className="profileAiCoachSummary">
                <div
                  className="profileProgressGauge"
                  style={{
                    "--progress-score": progressInsight.score ?? 0,
                    "--progress-angle": `${-180 + (progressInsight.score ?? 0) * 1.8}deg`
                  }}
                  role="img"
                  aria-label={progressInsight.score === null
                    ? "Недостаточно данных для оценки прогресса"
                    : `Общая оценка прогресса ${progressInsight.score} из 100`}
                >
                  <div className="profileProgressGaugeDial">
                    <i />
                    <strong>{progressInsight.score ?? "—"}</strong>
                  </div>
                  <small>из 100</small>
                </div>

                <div className="profileAiCoachHeadline">
                  <span>Оценка прогресса</span>
                  <h2>{progressInsight.scoreLabel}</h2>
                  <p>{progressInsight.scoreSummary}</p>
                </div>
              </div>

              {!isMainDashboard && <em>{profileProgressAnalysisOpen ? "−" : "+"}</em>}
            </button>

            {(isMainDashboard || !profileProgressAnalysisOpen) && (
              <div className="profileAiCoachPreview">
                {aiCoachStatuses.map((status) => (
                  <span key={status.title}>
                    <b>{status.icon} {status.title}</b>
                    <small>{status.text}</small>
                  </span>
                ))}
              </div>
            )}

            {!isMainDashboard && profileProgressAnalysisOpen && (
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

          {isMainDashboard && (
          <section
            className={`mainMeasurementSnapshot ${mainMeasurementSeries.length === 0 ? "emptyTrend" : ""} ${mainMeasurementSeries.length === 1 ? "singlePointTrend" : ""}`}
            aria-label="Последние замеры веса"
          >
            <div className="mainMeasurementSnapshotHeader">
              <div>
                <span>Последние замеры</span>
                <small>{latestProfileMeasurement ? formatProfileMeasurementDate(latestProfileMeasurement) : "Добавь первый замер"}</small>
              </div>
              <strong>
                {mainLatestWeight ? `${mainLatestWeight} кг` : "— кг"}
                {mainWeightChange !== 0 && (
                  <em>{mainWeightChange > 0 ? "+" : ""}{mainWeightChange.toFixed(1)} кг</em>
                )}
              </strong>
            </div>
            <div className="mainMeasurementChart">
              {mainMeasurementSeries.length >= 2 ? (
                <svg viewBox="0 0 260 72" role="img" aria-label="Изменение веса по последним замерам">
                  <line x1="10" y1="62" x2="250" y2="62" />
                  <polyline points={mainMeasurementPoints} />
                  {mainMeasurementSeries.map((item, index) => {
                    const [x, y] = mainMeasurementPoints.split(" ")[index].split(",");
                    return <circle key={`${item.dateLabel}-${index}`} cx={x} cy={y} r="3.5" />;
                  })}
                </svg>
              ) : mainMeasurementSeries.length === 1 ? (
                <div className="mainMeasurementSingle">
                  <strong>Первая точка сохранена</strong>
                  <span>Добавь ещё один замер, чтобы увидеть динамику.</span>
                </div>
              ) : (
                <div className="mainMeasurementEmpty">
                  Добавь первый замер, чтобы отслеживать динамику веса
                </div>
              )}
              {mainMeasurementSeries.length !== 1 && (
                <div className="mainMeasurementChartDates">
                  <span>{mainMeasurementSeries[0]?.dateLabel || "Старт"}</span>
                  <span>{mainMeasurementSeries.at(-1)?.dateLabel || "Сейчас"}</span>
                </div>
              )}
            </div>
          </section>
          )}

          {visibleProfileTab === "measurements" && (
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
                <small>{profileMeasurementOpen ? `Мастер замеров · ${getProfileMeasurementFields(activeProfile?.goal || "recomp").length + 2} шагов` : "Последний замер и быстрый старт"}</small>
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
                    setProfileMeasurementReturnTab("measurements");
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
                          src={`/measurements/${activeField.id}.webp`}
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
                        Прошлый раз: {getProfileMeasurementValue(latestProfileMeasurement, activeField)} {activeField.unit}
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

        </section>

        {profileMeasurementsModalOpen && !isMainDashboard && visibleProfileTab === "cabinet" && (
          <div
            className="cabinetMeasurementModalOverlay"
            role="presentation"
            onClick={() => setProfileMeasurementsModalOpen(false)}
          >
            <section
              className="cabinetMeasurementModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cabinetMeasurementModalTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="cabinetMeasurementModalHead">
                <div>
                  <span>КОНТРОЛЬ ТЕЛА</span>
                  <h2 id="cabinetMeasurementModalTitle">Последний замер</h2>
                  <small>{latestProfileMeasurement ? formatProfileMeasurementDate(latestProfileMeasurement) : "Замеров пока нет"}</small>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть замеры"
                  onClick={() => setProfileMeasurementsModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="cabinetMeasurementModalSummary">
                <span aria-hidden="true">⚖️</span>
                <p>Быстрый контроль веса и объёмов тела</p>
              </div>

              {latestProfileMeasurement ? (
                <div className="cabinetMeasurementModalGrid">
                  {getProfileMeasurementFields(activeProfile?.goal || "recomp").map((field) => (
                    <div key={field.id}>
                      <span>{field.label}</span>
                      <strong>{getProfileMeasurementValue(latestProfileMeasurement, field)}</strong>
                      <small>{field.unit}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cabinetMeasurementModalEmpty">
                  Сделай первый контрольный замер, чтобы отслеживать изменения тела.
                </p>
              )}

              <button
                type="button"
                className="cabinetMeasurementModalStart"
                onClick={() => {
                  setProfileMeasurementsModalOpen(false);
                  setProfileMeasurementReturnTab("cabinet");
                  setProfileMeasurementOpen(false);
                  setProfileMeasurementWizardStep(0);
                  setProfileMeasurementStatus("");
                  setPage("measurementWizard");
                }}
              >
                📏 Начать замер
              </button>
            </section>
          </div>
        )}

        {profileProgressPhotosModalOpen && !isMainDashboard && visibleProfileTab === "cabinet" && !canUseTrainerFeatures() && (
          <div
            className="cabinetProgressPhotosOverlay"
            role="presentation"
            onClick={() => !profileProgressPhotoUploading && setProfileProgressPhotosModalOpen(false)}
          >
            <section
              className="cabinetProgressPhotosModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cabinetProgressPhotosTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="cabinetProgressPhotosHead">
                <div>
                  <span>КОНТРОЛЬ ТЕЛА</span>
                  <h2 id="cabinetProgressPhotosTitle">Фото прогресса</h2>
                  <small>Спереди · сбоку · со спины</small>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть фото прогресса"
                  disabled={profileProgressPhotoUploading}
                  onClick={() => setProfileProgressPhotosModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="cabinetProgressPhotosBody">
                <div className="cabinetProgressPhotosIntro">
                  <i aria-hidden="true">📷</i>
                  <p>Встань в полный рост, используй одинаковое освещение и держи камеру на одном уровне.</p>
                </div>

                {latestClientProgressPhoto && (
                  <div className="cabinetProgressPhotosLatest">
                    <div>
                      <span>ПОСЛЕДНЯЯ ФОТОСЕССИЯ</span>
                      <strong>
                        {new Date(`${latestClientProgressPhoto.date || latestClientProgressPhoto.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}
                      </strong>
                    </div>
                    <div>
                      {[
                        latestClientProgressPhoto.frontUrl,
                        latestClientProgressPhoto.sideUrl,
                        latestClientProgressPhoto.backUrl
                      ].filter(Boolean).map((url) => (
                        <img key={url} src={url} alt="" loading="lazy" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="cabinetProgressPhotoSteps">
                  {[
                    ["front", "01", "Спереди"],
                    ["side", "02", "Сбоку"],
                    ["back", "03", "Со спины"]
                  ].map(([view, number, label]) => (
                    <label className={profileProgressPhotoFiles[view] ? "selected" : ""} key={view}>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={profileProgressPhotoUploading}
                        onChange={(event) => selectClientProgressPhoto(view, event.target.files?.[0] || null)}
                      />
                      {profileProgressPhotoPreviews[view] ? (
                        <img src={profileProgressPhotoPreviews[view]} alt={`Фото ${label.toLowerCase()}`} />
                      ) : (
                        <i aria-hidden="true">{number}</i>
                      )}
                      <span>
                        <strong>{label}</strong>
                        <small>{profileProgressPhotoFiles[view] ? "Готово · нажми, чтобы заменить" : "Нажми, чтобы сделать фото"}</small>
                      </span>
                      <em>{profileProgressPhotoFiles[view] ? "✓" : "+"}</em>
                    </label>
                  ))}
                </div>

                {profileProgressPhotoStatus && (
                  <p className={profileProgressPhotoStatus.includes("сохранены") ? "cabinetProgressPhotoStatus success" : "cabinetProgressPhotoStatus"}>
                    {profileProgressPhotoStatus}
                  </p>
                )}

                {selectedClientProgressPhotoBefore && selectedClientProgressPhotoAfter && (
                  <details className="cabinetProgressPhotosCompare">
                    <summary className="cabinetProgressPhotosCompareHead">
                      <span>
                        <strong>Сравнить фотосессии</strong>
                        <small>
                          {formatClientProgressPhotoDate(selectedClientProgressPhotoBefore)}
                          {" → "}
                          {formatClientProgressPhotoDate(selectedClientProgressPhotoAfter)}
                        </small>
                      </span>
                      <i aria-hidden="true">⌄</i>
                    </summary>

                    <div className="cabinetProgressPhotosCompareContent">
                      <div className="cabinetProgressPhotosCompareControls">
                        {[
                          ["Раньше", 0],
                          ["Позже", 1]
                        ].map(([label, slot]) => (
                          <label key={slot}>
                            <span>{label}</span>
                            <select
                              value={profileProgressPhotoCompareIds[slot]}
                              onChange={(event) => setProfileProgressPhotoCompareIds((current) => {
                                const next = [...current];
                                next[slot] = event.target.value;
                                return next;
                              })}
                            >
                              {clientProgressPhotos.map((photo) => (
                                <option
                                  key={photo.id}
                                  value={photo.id}
                                  disabled={profileProgressPhotoCompareIds[slot === 0 ? 1 : 0] === photo.id}
                                >
                                  {formatClientProgressPhotoDate(photo)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>

                      <div className="cabinetProgressPhotosCompareTabs" role="tablist" aria-label="Ракурс фотографии">
                        {progressPhotoCompareViews.map((view) => (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={profileProgressPhotoCompareView === view.id}
                            className={profileProgressPhotoCompareView === view.id ? "active" : ""}
                            onClick={() => setProfileProgressPhotoCompareView(view.id)}
                            key={view.id}
                          >
                            {view.label}
                          </button>
                        ))}
                      </div>

                      <div className="cabinetProgressPhotosCompareStage">
                        {[
                          ["Раньше", selectedClientProgressPhotoBefore],
                          ["Позже", selectedClientProgressPhotoAfter]
                        ].map(([label, photo]) => (
                          <figure key={`${label}_${photo?.id || ""}`}>
                            <figcaption>
                              <span>{label}</span>
                              <strong>{formatClientProgressPhotoDate(photo)}</strong>
                            </figcaption>
                            {photo?.[activeProgressPhotoCompareView.urlKey] ? (
                              <img
                                src={photo[activeProgressPhotoCompareView.urlKey]}
                                alt={`${activeProgressPhotoCompareView.label}: ${label.toLowerCase()}`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="cabinetProgressPhotosCompareMissing">Нет фото</div>
                            )}
                          </figure>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>

              <button
                type="button"
                className="cabinetProgressPhotosSave"
                disabled={profileProgressPhotoUploading || !profileProgressPhotoSetComplete}
                onClick={saveClientProgressPhotos}
              >
                {profileProgressPhotoUploading ? "Загружаю фото..." : "Сохранить фото"}
              </button>
            </section>
          </div>
        )}

        {profileProgressModalOpen && !isMainDashboard && visibleProfileTab === "cabinet" && (
          <div
            className="cabinetUtilityModalOverlay"
            role="presentation"
            onClick={() => setProfileProgressModalOpen(false)}
          >
            <section
              className="cabinetUtilityModal cabinetProgressModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cabinetProgressModalTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="cabinetUtilityModalHead">
                <div>
                  <span>ТРЕНИРОВКИ</span>
                  <h2 id="cabinetProgressModalTitle">Календарь</h2>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть календарь тренировок"
                  onClick={() => setProfileProgressModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="cabinetUtilityModalBody" ref={profileSettingsModalBodyRef}>
                <div className="cabinetWorkoutCalendar">
                  <div className="cabinetWorkoutCalendarNav">
                    <button
                      type="button"
                      onClick={() => shiftProfileWorkoutCalendarMonth(-1)}
                      aria-label="Предыдущий месяц"
                    >
                      ‹
                    </button>
                    <strong>
                      {workoutCalendarMonthDate.toLocaleDateString("ru-RU", {
                        month: "long",
                        year: "numeric"
                      })}
                    </strong>
                    <button
                      type="button"
                      onClick={() => shiftProfileWorkoutCalendarMonth(1)}
                      aria-label="Следующий месяц"
                    >
                      ›
                    </button>
                  </div>

                  <div className="cabinetWorkoutCalendarPlanner">
                    <div>
                      <strong>
                        {profileWorkoutCalendarEditing ? "Выбери дни тренировок" : "План на месяц"}
                      </strong>
                      <small>
                        {profileWorkoutCalendarEditing
                          ? "Нажимай на даты текущего месяца"
                          : `${profileWorkoutScheduledDates.filter((dateKey) => dateKey.startsWith(profileWorkoutCalendarMonth)).length} дней запланировано`}
                      </small>
                    </div>
                    {!profileWorkoutCalendarEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
                          setProfileWorkoutCalendarEditing(true);
                          setProfileWorkoutCalendarStatus("");
                        }}
                      >
                        Изменить
                      </button>
                    )}
                  </div>

                  <div className="cabinetWorkoutCalendarWeekdays" aria-hidden="true">
                    {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className="cabinetWorkoutCalendarGrid">
                    {workoutCalendarDays.map((day) => {
                      const statusClass = ["missed", "completed_off_date", "completed", "shifted", "planned"]
                        .find((status) => day.scheduleEntries.some((entry) => entry.status === status));
                      const hasHistoryWorkouts = !profileWorkoutCalendarEditing && day.workouts.length > 0;
                      const visualStatus = statusClass === "completed_off_date"
                        ? "completedOffDate"
                        : statusClass || (hasHistoryWorkouts ? "historyCompleted" : "");
                      const entryLabel = day.scheduleEntries.map((entry) => `№${entry.order}`).join(", ");
                      const historyLabel = day.workouts.length > 1 ? `${day.workouts.length}×` : "✓";

                      return (
                        <button
                          type="button"
                          key={day.key}
                          className={[
                            day.isCurrentMonth ? "" : "outside",
                            day.isToday ? "today" : "",
                            day.scheduleEntries.length ? "hasWorkout" : "",
                            day.isScheduled ? "scheduled" : "",
                            hasHistoryWorkouts ? "hasHistoryWorkout" : "",
                            visualStatus || "",
                            profileWorkoutCalendarEditing ? "editing" : "",
                            day.key === profileWorkoutCalendarDate ? "selected" : ""
                          ].filter(Boolean).join(" ")}
                          disabled={profileWorkoutCalendarEditing && !day.isCurrentMonth}
                          onClick={() => {
                            setProfileWorkoutCalendarDate(day.key);
                            if (profileWorkoutCalendarEditing && day.isCurrentMonth) {
                              toggleProfileWorkoutScheduledDate(day.key);
                            }
                          }}
                          aria-label={[
                            day.date.toLocaleDateString("ru-RU"),
                            entryLabel ? `тренировка ${entryLabel}` : "",
                            day.workouts.length ? `тренировок выполнено: ${day.workouts.length}` : ""
                          ].filter(Boolean).join(", ")}
                        >
                          <span>{day.date.getDate()}</span>
                          {day.scheduleEntries.length > 0 && <i>{entryLabel}</i>}
                          {!day.scheduleEntries.length && hasHistoryWorkouts && <i>{historyLabel}</i>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="cabinetWorkoutCalendarLegend" aria-label="Легенда статусов тренировок">
                    <span><i className="planned" />План</span>
                    <span><i className="completed" />В срок</span>
                    <span><i className="historyCompleted" />Прошлые</span>
                    <span><i className="completedOffDate" />Другой день</span>
                    <span><i className="missed" />Пропущена</span>
                    <span><i className="shifted" />Смещена</span>
                  </div>

                  {profileWorkoutCalendarEditing && (
                    <div className="cabinetWorkoutCalendarEditActions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={profileWorkoutCalendarSaving}
                        onClick={() => {
                          setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
                          setProfileWorkoutCalendarEditing(false);
                          setProfileWorkoutCalendarStatus("");
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        disabled={profileWorkoutCalendarSaving}
                        onClick={saveProfileWorkoutCalendar}
                      >
                        {profileWorkoutCalendarSaving ? "Сохраняю..." : "Сохранить"}
                      </button>
                    </div>
                  )}

                  {profileWorkoutCalendarStatus && (
                    <p className={profileWorkoutCalendarStatus.includes("сохранены") ? "cabinetWorkoutCalendarStatus success" : "cabinetWorkoutCalendarStatus"}>
                      {profileWorkoutCalendarStatus}
                    </p>
                  )}

                  <div className="cabinetWorkoutCalendarDay">
                    <div>
                      <span>Выбранный день</span>
                      <strong>
                        {new Date(`${profileWorkoutCalendarDate}T12:00:00`).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        })}
                      </strong>
                      {(profileWorkoutCalendarEditing
                        ? profileWorkoutCalendarDraftDates
                        : profileWorkoutScheduledDates
                      ).includes(profileWorkoutCalendarDate) && (
                        <em>Тренировка запланирована</em>
                      )}
                    </div>

                    {selectedWorkoutCalendarItems.length ? (
                      selectedWorkoutCalendarItems.map((item) => (
                        <button
                          type="button"
                          key={item.id || `${item.date}_${item.workout}`}
                          onClick={() => openCabinetWorkoutHistory(item.id)}
                        >
                          <span aria-hidden="true">🏋️</span>
                          <div>
                            <strong>{item.workout || "Тренировка"}</strong>
                            <small>
                              {new Date(getTimestampValue(item.date)).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                              {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                            </small>
                          </div>
                          <i>›</i>
                        </button>
                      ))
                    ) : (
                      <p>В этот день тренировок нет.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {profileWorkoutHistoryModalOpen && !isMainDashboard && visibleProfileTab === "cabinet" && (
          <div
            className="workoutModeModalOverlay"
            role="presentation"
            onClick={() => setProfileWorkoutHistoryModalOpen(false)}
          >
            <section
              className="workoutModeModal workoutHistoryModal cabinetWorkoutHistoryModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cabinetWorkoutHistoryModalTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="workoutModeModalHeader">
                <div>
                  <small>{profileWorkoutHistoryProgramScope ? "НАЗНАЧЕННАЯ ПРОГРАММА" : "ЛИЧНЫЙ КАБИНЕТ"}</small>
                  <h2 id="cabinetWorkoutHistoryModalTitle">
                    {profileWorkoutHistoryProgramScope?.assignedProgramName || "История тренировок"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть историю тренировок"
                  onClick={() => setProfileWorkoutHistoryModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="workoutHistoryModalList">
                {historyLoading && <p>Загрузка истории...</p>}

                {!historyLoading && profileWorkoutHistoryItems.map((item) => {
                  const isOpen = openHistoryKey === item.id;
                  const itemDate = getTimestampValue(item.date);

                  return (
                    <div
                      className={`cabinetWorkoutHistoryItem ${isOpen ? "open" : ""}`}
                      key={item.id || `${item.date}_${item.workout}`}
                      ref={(node) => {
                        if (node) cabinetWorkoutHistoryItemRefs.current.set(item.id, node);
                        else cabinetWorkoutHistoryItemRefs.current.delete(item.id);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCabinetWorkoutHistory(item.id)}
                        aria-expanded={isOpen}
                      >
                        <span aria-hidden="true">{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
                        <div>
                          <strong>{item.workout || "Тренировка"}</strong>
                          <small>
                            {itemDate
                              ? new Date(itemDate).toLocaleDateString("ru-RU", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                }).replace(".", "")
                              : "Без даты"}
                            {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                          </small>
                        </div>
                        <i>{isOpen ? "⌃" : "›"}</i>
                      </button>

                      {isOpen && (
                        <div className="cabinetWorkoutHistoryDetails">
                          {(item.exercises || []).map((exercise, index) => (
                            <div className="cabinetWorkoutHistoryExercise" key={`${exercise.name}_${index}`}>
                              <div className="cabinetWorkoutHistoryExerciseHead">
                                <strong>{exercise.name}</strong>
                                <small>{exercise.sets?.length || 0} подходов</small>
                              </div>
                              <div className="cabinetWorkoutHistorySets">
                                {(exercise.sets || []).map((set, setIndex) => (
                                  <span key={setIndex}>
                                    <b>{set.set || setIndex + 1}</b>
                                    {set.reps === "" || set.reps == null ? "—" : set.reps} повт.
                                    <i>
                                      {set.weight === "" || set.weight == null
                                        ? "без веса"
                                        : `${set.weight} кг`}
                                    </i>
                                  </span>
                                ))}
                                {!exercise.sets?.length && <small>Подходы не сохранены</small>}
                              </div>
                            </div>
                          ))}
                          {!item.exercises?.length && <p>Данные упражнений не сохранены.</p>}
                          <button
                            type="button"
                            className="cabinetWorkoutHistoryDelete"
                            onClick={() => requestDeleteOwnHistoryWorkout(item)}
                            disabled={historyDeletingId === item.id}
                          >
                            {historyDeletingId === item.id ? "Удаляю..." : "Удалить тренировку"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!historyLoading && profileWorkoutHistoryItems.length === 0 && (
                  <p>
                    {profileWorkoutHistoryProgramScope
                      ? "В этой программе завершённых тренировок пока нет."
                      : "Завершённые тренировки появятся здесь."}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {renderHistoryDeleteConfirm()}

        {profileSettingsModalOpen && !isMainDashboard && visibleProfileTab === "cabinet" && (
          <div
            className="cabinetUtilityModalOverlay"
            role="presentation"
            onClick={() => setProfileSettingsModalOpen(false)}
          >
            <section
              className={`cabinetUtilityModal cabinetSettingsModal ${profileSettingsModalSection === "settings" ? "compact" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cabinetSettingsModalTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="cabinetUtilityModalHead">
                <div>
                  <span>ЛИЧНЫЙ КАБИНЕТ</span>
                  <h2 id="cabinetSettingsModalTitle">
                    {profileSettingsModalSection === "account"
                      ? "Аккаунт"
                      : profileSettingsModalSection === "profile"
                        ? "Профиль"
                        : "Настройки"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={`Закрыть ${
                    profileSettingsModalSection === "account"
                      ? "аккаунт"
                      : profileSettingsModalSection === "profile"
                        ? "профиль"
                        : "настройки"
                  }`}
                  onClick={() => setProfileSettingsModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="cabinetUtilityModalBody">
                {profileSettingsModalSection === "account" && (
                <section className="profileDashboardCard profileAccountSection">
                  <div className="profileAccountAvatarEditor">
                    <div className="profileAccountAvatarPreview">
                      {profileAccountAvatarPreview || profileAvatarUrl ? (
                        <img src={profileAccountAvatarPreview || profileAvatarUrl} alt="" />
                      ) : (
                        <span>👤</span>
                      )}
                    </div>
                    <label>
                      <strong>Изменить аватар</strong>
                      <small>JPG, PNG или WEBP</small>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          openProfileAvatarCrop(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="profileAccountFields">
                    <label>
                      <span>Имя</span>
                      <input
                        value={profileAccountDraft.displayName}
                        onChange={(event) => {
                          setProfileAccountDraft((current) => ({ ...current, displayName: event.target.value }));
                          setProfileAccountStatus("");
                        }}
                        placeholder="Твоё имя"
                      />
                    </label>
                    <label>
                      <span>Почта</span>
                      <input
                        type="email"
                        value={profileAccountDraft.email}
                        onChange={(event) => {
                          setProfileAccountDraft((current) => ({ ...current, email: event.target.value }));
                          setProfileAccountStatus("");
                        }}
                        placeholder="name@example.com"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="profileAccountPasswordButton"
                    onClick={sendProfilePasswordReset}
                  >
                    <span>🔐</span>
                    <span>
                      <strong>Изменить пароль</strong>
                      <small>Получить безопасную ссылку на почту</small>
                    </span>
                    <i>›</i>
                  </button>

                  {profileAccountStatus && (
                    <p className={profileAccountStatus.includes("сохранены") || profileAccountStatus.includes("отправлена") ? "profileAccountStatus success" : "profileAccountStatus"}>
                      {profileAccountStatus}
                    </p>
                  )}

                  <button
                    type="button"
                    className="profileBodySaveBtn"
                    disabled={profileAccountSaving}
                    onClick={saveProfileAccount}
                  >
                    {profileAccountSaving ? "Сохраняю..." : "Сохранить аккаунт"}
                  </button>

                  <button type="button" className="profileLogoutBtn profileAccountLogout" onClick={logout}>
                    Выйти из аккаунта
                  </button>
                </section>
                )}

                {profileSettingsModalSection === "profile" && (
                <section className="profileDashboardCard profileBodyMetricsSettingsSection">
                  <button
                    type="button"
                    className={profileBodyMetricsOpen ? "profileAccordionHead open" : "profileAccordionHead"}
                    onClick={() => setProfileBodyMetricsOpen((prev) => !prev)}
                  >
                    <div>
                      <span>ПРОФИЛЬ</span>
                      <strong>Параметры тела</strong>
                      <small>Вес, рост, возраст и активность</small>
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
                          <div className="profileGoalReadonlyValue">{activeGoalLabel}</div>
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

                      <button
                        type="button"
                        className="profileBodySaveBtn"
                        onClick={() => {
                          saveAiBodyMetrics();
                          setProfileSettingsModalOpen(false);
                        }}
                      >
                        Сохранить анкету
                      </button>
                    </div>
                  )}
                </section>
                )}

                {profileSettingsModalSection === "settings" && (
                <section className="profileDashboardCard profileAppSettingsSection">
                  <div className="profileSettingsActions">
                    <button type="button" className="profileThemeSwitchBtn" onClick={toggleAppTheme}>
                      <span className="profileThemeIcon">{appTheme === "warm-light" ? "🌙" : "☀️"}</span>
                      <span className="profileThemeText">
                        <strong>Оформление</strong>
                        <small>{appTheme === "warm-light" ? "Переключить на тёмный стиль" : "Переключить на светлый стиль"}</small>
                      </span>
                      <i>›</i>
                    </button>

                    <button
                      type="button"
                      className={telegramProfile.connected ? "profileSettingsTelegramItem connected" : "profileSettingsTelegramItem"}
                      onClick={() => { setTelegramStatus(""); setTelegramConnectOpen(true); }}
                    >
                      <span className="profileSettingsTelegramAvatar">
                        {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={handleTelegramAvatarError} /> : "✈️"}
                      </span>
                      <span className="profileSettingsTelegramText">
                        <strong>Telegram</strong>
                        <small>
                          {telegramProfile.connected
                            ? `@${telegramProfile.username || "telegram"} · подключён`
                            : "Нажми, чтобы подключить"}
                        </small>
                      </span>
                      <em>{telegramProfile.connected ? "Подключён" : "Подключить"}</em>
                      <i>›</i>
                    </button>

                  </div>
                </section>
                )}
              </div>
            </section>
          </div>
        )}

        {profileAvatarCropOpen && (
          <div className="profileAvatarCropOverlay" role="presentation" onClick={closeProfileAvatarCrop}>
            <section
              className="profileAvatarCropModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profileAvatarCropTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <span>АВАТАР</span>
                  <h2 id="profileAvatarCropTitle">Выбери область фото</h2>
                </div>
                <button type="button" aria-label="Закрыть редактор аватара" onClick={closeProfileAvatarCrop}>×</button>
              </header>

              <div
                className="profileAvatarCropViewport"
                onPointerDown={startProfileAvatarCropDrag}
                onPointerMove={moveProfileAvatarCrop}
                onPointerUp={endProfileAvatarCropDrag}
                onPointerCancel={endProfileAvatarCropDrag}
              >
                <img
                  ref={profileAvatarCropImageRef}
                  src={profileAvatarCropSource}
                  alt=""
                  draggable="false"
                  onLoad={(event) => {
                    setProfileAvatarCropSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight
                    });
                  }}
                  style={{
                    width: profileAvatarCropSize.width
                      ? `${profileAvatarCropSize.width * Math.max(240 / profileAvatarCropSize.width, 240 / profileAvatarCropSize.height) * profileAvatarCropZoom}px`
                      : "auto",
                    height: profileAvatarCropSize.height
                      ? `${profileAvatarCropSize.height * Math.max(240 / profileAvatarCropSize.width, 240 / profileAvatarCropSize.height) * profileAvatarCropZoom}px`
                      : "auto",
                    transform: `translate(calc(-50% + ${profileAvatarCropOffset.x}px), calc(-50% + ${profileAvatarCropOffset.y}px))`
                  }}
                />
                <div className="profileAvatarCropMask" aria-hidden="true" />
              </div>

              <label className="profileAvatarCropZoom">
                <span>−</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={profileAvatarCropZoom}
                  onChange={(event) => changeProfileAvatarCropZoom(event.target.value)}
                  aria-label="Масштаб аватара"
                />
                <span>＋</span>
              </label>

              <p>Перемещай фото пальцем, чтобы лицо оказалось внутри круга.</p>

              <div className="profileAvatarCropActions">
                <button type="button" className="secondary" onClick={closeProfileAvatarCrop}>Отмена</button>
                <button type="button" onClick={applyProfileAvatarCrop}>Готово</button>
              </div>
            </section>
          </div>
        )}

        {isMainDashboard && (canUseTrainerFeatures() || canUseAdminFeatures()) && (
          <div className="mainDashboardRoleActions">
            {canUseTrainerFeatures() && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUserId(null);
                  currentUserRole === "trainer" && !canUseAdminFeatures()
                    ? openAdminClientsWithFilter("all")
                    : setPage("admin");
                }}
              >
                ⚙️ Тренерская
              </button>
            )}
            {canUseAdminFeatures() && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUserId(null);
                  setPage("adminPanel");
                }}
              >
                🛠️ Админ-панель
              </button>
            )}
          </div>
        )}

        {profileTrainerNotificationsOpen && !isMainDashboard && !canUseTrainerFeatures() && (
          <div
            className="profileTrainerNotificationsOverlay"
            role="presentation"
            onClick={() => setProfileTrainerNotificationsOpen(false)}
          >
            <section
              className="profileTrainerNotificationsModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profileTrainerNotificationsTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="profileTrainerNotificationsHead">
                <div>
                  <span>ОТ ТРЕНЕРА</span>
                  <h2 id="profileTrainerNotificationsTitle">Уведомления</h2>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть уведомления"
                  onClick={() => setProfileTrainerNotificationsOpen(false)}
                >
                  ×
                </button>
              </header>

              {clientTrainerTasks.length > 0 ? (
                <>
                  <p className="profileTrainerNotificationsSummary">
                    {trainerNotificationCount > 0
                      ? `${trainerNotificationCount} ${trainerNotificationCount === 1 ? "активная задача" : "активных задач"}`
                      : "Все задачи выполнены"}
                  </p>
                  <div className="profileTrainerNotificationsList">
                    {clientTrainerTasks.map((task) => {
                      const taskStatus = getTrainerTaskStatus(task);
                      const taskDestination = getClientTrainerTaskDestination(task);
                      return (
                        <button
                          type="button"
                          key={task.id}
                          className={`profileTrainerNotificationItem ${taskStatus.id}${taskDestination ? " actionable" : ""}`}
                          onClick={() => openClientTrainerTask(task)}
                        >
                          <i aria-hidden="true">{taskStatus.id === "completed" ? "✓" : "!"}</i>
                          <span>
                            <strong>{task.title}</strong>
                            <small>
                              {task.dueDate
                                ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}`
                                : "Без срока"}
                            </small>
                          </span>
                          <em>{taskStatus.label}</em>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="profileTrainerNotificationsEmpty">
                  <i aria-hidden="true">✓</i>
                  <strong>Новых уведомлений нет</strong>
                  <p>Задачи и рекомендации тренера появятся здесь.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {profileNutritionModalOpen && !isMainDashboard && (
        <div
          className="cabinetNutritionModalOverlay"
          role="presentation"
          onClick={() => setProfileNutritionModalOpen(false)}
        >
          <div
            className="cabinetNutritionModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cabinetNutritionModalTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cabinetNutritionModalHead">
              <div>
                <span>ПЛАН ПИТАНИЯ</span>
                <h2 id="cabinetNutritionModalTitle">План КБЖУ</h2>
              </div>
              <button
                type="button"
                aria-label="Закрыть план КБЖУ"
                onClick={() => setProfileNutritionModalOpen(false)}
              >
                ×
              </button>
            </header>

            <section
              className={[
                "profileDashboardGrid",
                "profileNutritionSection",
                "hasPlan",
                "cabinetNutritionCombined"
              ].filter(Boolean).join(" ")}
            >
          <div className="profileDashboardCard profileNutritionGoalCard">
            <div className="profileNutritionInlinePlan">
              <div className="profileNutritionInlinePlanHead">
                <span>ВЫБРАТЬ ПЛАН</span>
                <strong>{getAiNutritionGoalLabel(aiNutritionProfileDraft.goal || activeProfile?.goal || "recomp")}</strong>
              </div>

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
                  ? "Поддержка: калории около нормы, цель — стабильный вес и энергия."
                  : aiNutritionProfileDraft.goal === "recomp"
                    ? "Рекомпозиция: небольшой дефицит и повышенный белок для снижения жира с сохранением мышц."
                    : "КБЖУ будут пересчитаны под выбранную цель."}
              </div>

              <div className="profileMacroGrid">
                <div><span>Ккал</span><strong>{Math.round(profileNutritionDraftMacros.calories || nutrition.goals.calories)}</strong></div>
                <div><span>Белки</span><strong>{Math.round(profileNutritionDraftMacros.protein || nutrition.goals.protein)} г</strong></div>
                <div><span>Жиры</span><strong>{Math.round(profileNutritionDraftMacros.fat || nutrition.goals.fat)} г</strong></div>
                <div><span>Угл.</span><strong>{Math.round(profileNutritionDraftMacros.carbs || nutrition.goals.carbs)} г</strong></div>
              </div>

              <button
                type="button"
                className="profileDashboardButton"
                data-save-state={profileNutritionSaveStatus || "idle"}
                disabled={profileNutritionSaveStatus === "saving" || profileNutritionSaveStatus === "saved"}
                onClick={saveProfileNutritionPlanAndClose}
              >
                {profileNutritionSaveStatus === "saved"
                  ? "План сохранён ✓"
                  : profileNutritionSaveStatus === "saving"
                    ? "Сохраняю…"
                    : profileNutritionSaveStatus === "error"
                      ? "Повторить сохранение"
                    : "Сохранить план питания"}
              </button>
            </div>
          </div>

          <div className="profileDashboardCard profileAiNutritionPlanCard">
            <div className="profileNutritionOverview">
                <div className="profileNutritionCalendarHead">
                  <div>
                    <h2>План питания</h2>
                  </div>
                </div>

                <div className="profileNutritionCalendarMonthTitle">
                  <button
                    type="button"
                    onClick={() => selectNutritionDate(shiftNutritionDateKey(nutritionDateKey, -7))}
                    aria-label="Предыдущая неделя"
                  >
                    ‹
                  </button>
                  <strong>{profileNutritionWeekLabel}</strong>
                  <button
                    type="button"
                    onClick={() => selectNutritionDate(shiftNutritionDateKey(nutritionDateKey, 7))}
                    aria-label="Следующая неделя"
                  >
                    ›
                  </button>
                </div>

                <div className="profileNutritionMonthGrid">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((dayLabel) => (
                    <span key={dayLabel} className="profileNutritionWeekday">{dayLabel}</span>
                  ))}

                  {profileNutritionWeekDays.map((day) => {
                    const plannedWeek = getAiNutritionWeekForDate(profileAiNutritionPlan, day.date);
                    const plannedMacros = getAiNutritionDayMacros(
                      plannedWeek || profileAiNutritionWeek || nutrition.goals,
                      profileAiNutritionActiveProfile,
                      day.date
                    );
                    const calorieGoal = Number(plannedMacros?.calories || nutrition.goals.calories) || 1;
                    const proteinGoal = Number(plannedMacros?.protein || nutrition.goals.protein) || 1;
                    const caloriePercent = Math.min(100, Math.round((day.calories / calorieGoal) * 100));
                    const proteinPercent = Math.min(100, Math.round((day.protein / proteinGoal) * 100));
                    const showPlan = !day.hasFood && day.key >= todayNutritionKey();

                    return (
                      <div
                        key={day.key}
                        className={[
                          "profileNutritionMonthDay",
                          day.hasFood ? "filled" : "",
                          showPlan ? "planned" : "",
                          day.isOverGoal ? "highCalories" : "",
                          day.isToday ? "today" : "",
                          day.isSelected ? "active" : ""
                        ].filter(Boolean).join(" ")}
                      >
                        <i
                          className="profileNutritionCalorieFill"
                          style={{ height: `${day.hasFood ? Math.max(8, caloriePercent) : 0}%` }}
                        />
                        <i
                          className="profileNutritionProteinFill"
                          style={{ height: `${day.hasFood ? Math.max(5, proteinPercent) : 0}%` }}
                        />
                        <span>{day.dayNumber}</span>
                        {day.hasFood ? (
                          <>
                            <strong>{day.calories}</strong>
                            <small>{day.protein}г</small>
                          </>
                        ) : showPlan ? (
                          <>
                            <strong>{plannedMacros.calories}</strong>
                            <small>план</small>
                          </>
                        ) : (
                          <em>—</em>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="profileNutritionCalendarLegend">
                  <span><i className="calorieOk" /> Факт</span>
                  <span><i className="proteinFill" /> Белок</span>
                  <span><i className="caloriePlan" /> План</span>
                </div>

                {profileNutritionSelectedTotals.calories > 0 && (
                  <p className="profileNutritionCalendarLogged">
                    Записано за день: {Math.round(profileNutritionSelectedTotals.calories)} ккал
                  </p>
                )}

              </div>
          </div>
            </section>
          </div>
        </div>
        )}

        {telegramConnectOpen && (
          <div className="profileTelegramModalOverlay">
            <div className="profileTelegramModal profileTelegramManageModal">
              <button type="button" className="profileTelegramModalClose" onClick={() => setTelegramConnectOpen(false)}>×</button>

              <div className="profileTelegramManageHead">
                <div className="profileTelegramManageAvatar">
                  {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={handleTelegramAvatarError} /> : <span>✈️</span>}
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

        {visibleProfileTab === "settings" && (
        <section className="profileDashboardCard profileBodyMetricsSettingsSection">
          <button
            type="button"
            className={profileBodyMetricsOpen ? "profileAccordionHead open" : "profileAccordionHead"}
            onClick={() => setProfileBodyMetricsOpen((prev) => !prev)}
          >
            <div>
              <span>ПРОФИЛЬ</span>
              <strong>Параметры тела</strong>
              <small>Вес, рост, возраст, активность и тренировочные дни</small>
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

        {visibleProfileTab === "settings" && (
        <>
        <h1 className="profileSettingsPageTitle">Настройки</h1>
        <section className="profileDashboardCard profileAppSettingsSection">
          <div className="profileSettingsActions">
            <button
              type="button"
              className="profileThemeSwitchBtn"
              onClick={toggleAppTheme}
            >
              <span className="profileThemeIcon">{appTheme === "warm-light" ? "🌙" : "☀️"}</span>
              <span className="profileThemeText">
                <strong>Оформление</strong>
                <small>{appTheme === "warm-light" ? "Переключить на тёмно-зелёный стиль" : "Переключить на светлый стиль"}</small>
              </span>
              <i>›</i>
            </button>

            <button
              type="button"
              className={telegramProfile.connected ? "profileSettingsTelegramItem connected" : "profileSettingsTelegramItem"}
              onClick={() => { setTelegramStatus(""); setTelegramConnectOpen(true); }}
            >
              <span className="profileSettingsTelegramAvatar">
                {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={handleTelegramAvatarError} /> : "✈️"}
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

          </div>
        </section>
        </>
        )}
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

    return (
      <div className="app historyPagePremium historyPageCompact progressHistoryPage">

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

        {renderHistoryDeleteConfirm()}

        {renderClientMainBottomBar("workouts")}
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

    const getDashboardClientSummary = (client = {}) => trainerClientSummaries[client.id] || {
      clientId: client.id || "",
      lastWorkoutAt: "",
      workouts7: 0,
      workouts30: 0,
      workoutDateKeysCurrentWeek: null,
      lastNutritionAt: "",
      nutritionDays7: 0,
      averageCalories7: null,
      lastMeasurementAt: "",
      assignedProgramId: client.assignedProgramId || "",
      assignedProgramUpdatedAt: client.assignedProgramUpdatedAt || "",
      assignedWorkoutCount: Number(client.assignedWorkoutCount) || 0,
      completedWorkoutCount: 0,
      plateau: { isPlateau: false, days: 0, delta: null },
      payment: null,
      paymentAttention: getClientPaymentAttention(null),
      programCompletionPercent: null
    };
    const trainerSummaryItems = usersList.map((client) => {
      const summary = getDashboardClientSummary(client);
      return {
        client,
        summary,
        status: getClientActivityStatus(summary),
        reasons: getClientAttentionReasons(summary)
      };
    });
    const trainerStatusCounts = trainerSummaryItems.reduce(
      (counts, item) => ({
        ...counts,
        [item.status.id]: (counts[item.status.id] || 0) + 1,
        activeToday: counts.activeToday + (getTrainerSummaryDaysSince(item.summary.lastWorkoutAt) === 0 ? 1 : 0),
        plateau: counts.plateau + (item.summary.plateau?.isPlateau ? 1 : 0),
        payment: counts.payment + (["overdue", "soon"].includes(item.summary.paymentAttention?.id) ? 1 : 0)
      }),
      { active: 0, attention: 0, lost: 0, noProgram: 0, activeToday: 0, plateau: 0, payment: 0 }
    );
    const trainerProblemClients = trainerSummaryItems
      .filter((item) => item.status.id !== "active")
      .sort((first, second) => {
        const priority = { lost: 0, noProgram: 1, attention: 2 };
        return (priority[first.status.id] ?? 3) - (priority[second.status.id] ?? 3);
      })
      .slice(0, 5);
    const trainerAiFocusItems = trainerSummaryItems
      .flatMap(({ client, summary, status, reasons }) => {
        const clientName = client.name || client.email || "Клиент";
        const focusReasons = reasons.filter((reason) => reason !== "активность в норме");
        if (focusReasons.length) {
          return focusReasons.slice(0, 2).map((reason, index) => ({
            id: `${client.id}_${status.id}_${index}`,
            client,
            clientName,
            status,
            text: reason
          }));
        }

        return [{
          id: `${client.id}_active`,
          client,
          clientName,
          status,
          text: summary.workouts7
            ? `${summary.workouts7} тренировок за 7 дней · питание ${summary.nutritionDays7}/7`
            : `Питание ${summary.nutritionDays7}/7 · программа ${summary.programCompletionPercent ?? "—"}%`
        }];
      })
      .sort((first, second) => {
        const priority = { lost: 0, noProgram: 1, attention: 2, active: 3 };
        return (priority[first.status.id] ?? 4) - (priority[second.status.id] ?? 4);
      })
      .slice(0, 5);
    const trainerRecentEvents = trainerSummaryItems
      .flatMap(({ client, summary }) => (summary.recentEvents || []).map((event) => ({
        ...event,
        client,
        clientName: client.name || client.email || "Клиент",
        timestamp: getTrainerSummaryTimestamp(event.date)
      })))
      .filter((event) => event.timestamp)
      .sort((first, second) => second.timestamp - first.timestamp)
      .slice(0, 8);

    const filteredUsers = usersList.filter((client) => {
      const profile = getAdminClientProfile(client);
      const goal = String(profile?.goal || "").toLowerCase();
      const status = getClientActivityStatus(getDashboardClientSummary(client));

      if (adminClientFilter === "all") return true;
      if (adminClientFilter === "active") return status.id === "active";
      if (adminClientFilter === "attention") return ["attention", "noProgram"].includes(status.id);
      if (adminClientFilter === "inactive") return status.id === "lost";
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
    const selectedNutritionFallbackGoals = selectedClient?.nutritionGoals || adminClientNutrition?.goals || {};
    const selectedEffectiveNutritionGoals = getClientEffectiveNutritionGoals(
      selectedClient || {},
      adminClientNutrition,
      selectedNutritionFallbackGoals
    );
    const trainerNutritionPlanOptions = buildClientNutritionPresetOptions(
      selectedClient || {},
      adminClientNutrition,
      adminClientHistory
    );
    const aiPlan = getClientNutritionDisplayPlan(selectedClient || {}, adminClientNutrition, selectedNutritionFallbackGoals);
    const aiWeek = getAiNutritionWeekForDate(aiPlan) || aiPlan?.weeks?.[0] || null;
    const maxCalories = Math.max(1, ...clientNutritionDays.slice(0, 7).map((day) => day.totals.calories));
    const maxProtein = Math.max(1, ...clientNutritionDays.slice(0, 7).map((day) => day.totals.protein));
    const maxWeight = Math.max(1, ...weightPoints.map((point) => point.weight));
    const averageAiScore = clientNutritionDays.length
      ? Math.round(clientNutritionDays.slice(0, 7).reduce((sum, day) => sum + (Number(day.score) || 0), 0) / Math.min(7, clientNutritionDays.length) * 10) / 10
      : "—";
    const attentionCount = trainerStatusCounts.attention + trainerStatusCounts.lost + trainerStatusCounts.noProgram;
    const adminGreetingName = telegramProfile.displayName || auth.currentUser?.displayName || auth.currentUser?.email?.split("@")?.[0] || "тренер";
    const adminDashboardDate = new Date().toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    if (isTrainerNextWorkspace()) {
      const trainerNextSummaries = Object.fromEntries(
        usersList.map((client) => {
          const summary = getDashboardClientSummary(client);
          return [client.id, {
            ...summary,
            status: getClientActivityStatus(summary)
          }];
        })
      );
      const trainerNextSelectedSummary = selectedClient
        ? getDashboardClientSummary(selectedClient)
        : {};
      const trainerNextMode = trainerNextSection === "clients"
        ? "clients"
        : trainerNextSection === "client" && selectedClient
          ? "client"
          : trainerNextSection === "cabinet"
            ? "cabinet"
            : ["messages", "analytics", "notifications"].includes(trainerNextSection)
              ? trainerNextSection
              : "dashboard";
      const trainerNextActiveSection = trainerNextMode === "client" ? "clients" : trainerNextMode === "cabinet" ? "more" : trainerNextMode;

      return (
        <TrainerWorkspace
          appVersion={APP_VERSION}
          mode={trainerNextMode}
          activeSection={trainerNextActiveSection}
          onNavigate={navigateTrainerNext}
          onRefresh={refreshPage}
          trainerName={adminGreetingName}
          trainerAvatar={telegramProfile.avatarUrl}
          clients={usersList}
          clientSummaries={trainerNextSummaries}
          summariesLoading={trainerClientSummariesLoading}
          counts={{
            active: trainerStatusCounts.active,
            attention: attentionCount
          }}
          selectedClient={selectedClient}
          selectedProfile={{
            ...selectedProfile,
            goalLabel: getAdminClientGoalLabel(selectedProfile?.goal)
          }}
          selectedSummary={{
            ...trainerNextSelectedSummary,
            status: getClientActivityStatus(trainerNextSelectedSummary)
          }}
          activeClientTab={adminUsersSelectedTab}
          onClientTabChange={(tab) => {
            setAdminUsersSelectedTab(tab);
            setTrainerNextSection("client");
          }}
          onOpenClient={openTrainerNextClient}
          onCloseClient={() => {
            setAdminClientPageOpen(false);
            setTrainerNextSection("clients");
          }}
          onCreateClient={() => setAdminCreateClientModalOpen(true)}
          createClientState={getTrainerNextCreateClientState()}
          measurements={adminClientMeasurements}
          history={adminClientHistory}
          nutritionDays={clientNutritionDays}
          nutritionGoals={selectedEffectiveNutritionGoals}
          nutritionPlanOptions={trainerNutritionPlanOptions}
          photos={adminClientProgressPhotos}
          tasks={adminClientTasks}
          trainerNote={adminTrainerNote}
          onGenerateNutritionPlan={() => setAdminClientStatus("Параметры AI-плана открыты в разделе питания.")}
          onSaveNutritionPlan={saveTrainerClientNutritionPlan}
          onSaveNotifications={saveTrainerClientNotificationSettings}
          onTestNotification={() => sendAdminTestWorkoutReminder(selectedClient)}
          onConnectTelegram={openClientTelegramConnection}
          onSendMessage={sendTrainerClientMessage}
          onClientAction={handleTrainerClientAction}
          workouts={sortWorkoutDays(plan.workouts || [])}
          exerciseLibrary={trainerExerciseLibraryItems}
          programTemplates={adminTrainingTemplates}
          selectedProgramId={adminSelectedTemplateId}
          onSelectProgram={setAdminSelectedTemplateId}
          onAssignProgram={() => assignSavedProgramToClient(selectedClient?.id, adminSelectedTemplateId)}
          onSaveWorkoutSchedule={(dates) => saveTrainerClientWorkoutSchedule(dates, selectedClient)}
          programStatus={adminClientStatus}
          onUpdateWorkout={updateTrainerNextWorkout}
          onUpdateExercise={updateTrainerNextExercise}
          onUpdateExerciseSet={updateTrainerNextExerciseSet}
          onAddExerciseSet={addTrainerNextExerciseSet}
          onRemoveExerciseSet={removeTrainerNextExerciseSet}
          onAddExercise={addTrainerNextExercise}
          onRemoveExercise={removeTrainerNextExercise}
          onDuplicateExercise={duplicateTrainerNextExercise}
          onMoveExercise={moveTrainerNextExercise}
          onUploadExerciseVideo={uploadTrainerNextExerciseVideo}
          exerciseVideoUploadingId={adminExerciseVideoUploadingId}
          onAddDay={addTrainerNextWorkoutDay}
          onDuplicateDay={duplicateTrainerNextWorkoutDay}
          onRemoveDay={removeTrainerNextWorkoutDay}
          onSaveWorkouts={saveWorkoutsToFirebase}
          onLogout={logout}
        />
      );
    }

    return (
      <div className="adminV3Shell">
        <button
          type="button"
          className="menuRefreshIconBtn trainerRefreshIconBtn"
          onClick={refreshPage}
          aria-label="Обновить страницу"
          title="Обновить страницу"
        >
          🔄
        </button>
        <aside className="adminV3Sidebar">
          <div className="adminV3Brand">
            <span>⚙️</span>
            <strong>Trainer CRM</strong>
            <small>Admin Panel v3</small>
          </div>

          {renderTrainerWorkspaceBottomBar("main")}

          
        </aside>

        <main className="adminV3Main">
          <header className="adminV3Header">
            <div>
              <div className="adminDesktopBrandRow">
                <div className="adminDesktopBrandMark">
                  <span aria-hidden="true">✦</span>
                  <strong>TRAINER CONTROL CENTER</strong>
                </div>
              </div>

              <div className="adminDesktopHeroCopy">
                <h1>Добро пожаловать, {adminGreetingName}! 👋</h1>
                <p>Управляйте клиентами, тренировками и питанием в одном месте с AI-поддержкой.</p>
              </div>

              <div className="adminDesktopDate" aria-label={`Сегодня ${adminDashboardDate}`}>
                <span aria-hidden="true">▣</span>
                <strong>{adminDashboardDate}</strong>
              </div>

<section className="trainerAttentionPanel">
  <div className="trainerAttentionHeader">
    <div>
      <span>Контроль клиентов</span>
      <h2>Центр внимания тренера</h2>
    </div>
    {trainerClientSummariesLoading && <small>Обновляю данные...</small>}
  </div>

  <div className="trainerAttentionGrid">
    <article className="trainerAttentionCard lost">
      <span className="trainerAttentionIcon" aria-hidden="true">●</span>
      <span>Пропали</span>
      <strong>{trainerStatusCounts.lost}</strong>
    </article>
    <article className="trainerAttentionCard attention">
      <span className="trainerAttentionIcon" aria-hidden="true">●</span>
      <span>Требуют внимания</span>
      <strong>{trainerStatusCounts.attention}</strong>
    </article>
    <article className="trainerAttentionCard noProgram">
      <span className="trainerAttentionIcon" aria-hidden="true">●</span>
      <span>Без программы</span>
      <strong>{trainerStatusCounts.noProgram}</strong>
    </article>
    <article className="trainerAttentionCard active">
      <span className="trainerAttentionIcon" aria-hidden="true">●</span>
      <span>Тренировались сегодня</span>
      <strong>{trainerStatusCounts.activeToday}</strong>
    </article>
    <article className="trainerAttentionCard plateau">
      <span className="trainerAttentionIcon" aria-hidden="true">●</span>
      <span>Нет прогресса 14 дней</span>
      <strong>{trainerStatusCounts.plateau}</strong>
    </article>
    <article className="trainerAttentionCard payment">
      <span className="trainerAttentionIcon" aria-hidden="true">●</span>
      <span>Контроль программы</span>
      <strong>{trainerStatusCounts.payment}</strong>
    </article>
  </div>

  <div className="trainerClientReasonList">
    {trainerProblemClients.map(({ client, status, reasons }) => (
      <button type="button" key={client.id} onClick={() => loadAdminClientOverview(client, true)}>
        <span className={`trainerClientStatusBadge ${status.id}`}>{status.label}</span>
        <strong>{client.name || client.email || "Клиент"}</strong>
        <small>{reasons.slice(0, 2).join(" · ")}</small>
      </button>
    ))}
    {!trainerClientSummariesLoading && !trainerProblemClients.length && (
      <div className="trainerClientReasonEmpty">Сейчас все клиенты активны, критичных сигналов нет.</div>
    )}
  </div>
</section>

<div className="adminDashboardSection">
  <div className="adminDashboardSectionTitle"><span aria-hidden="true">✦</span>AI Focus</div>

  <div className="adminDashboardAiList">
    {trainerAiFocusItems.map((item) => (
      <button
        className="adminDashboardMiniItem adminDashboardAiCard"
        type="button"
        key={item.id}
        onClick={() => loadAdminClientOverview(item.client, true)}
      >
        <span className="adminDashboardMiniTop">
          <strong className="adminDashboardMiniName">{item.clientName}</strong>
          <span className={`trainerClientStatusBadge ${item.status.id}`}>{item.status.label}</span>
        </span>
        <span className="adminDashboardMiniDesc">{item.text}</span>
      </button>
    ))}
    {!trainerClientSummariesLoading && !trainerAiFocusItems.length && (
      <div className="adminDashboardTimelineItem">Данных для рекомендаций пока нет.</div>
    )}
  </div>
</div>

<div className="adminDashboardSection">
  <div className="adminDashboardSectionTitle"><span aria-hidden="true">◷</span>Последние события</div>

  <div className="adminDashboardTimeline">
    {trainerRecentEvents.map((event) => (
      <button
        type="button"
        className="adminDashboardTimelineItem adminDashboardTimelineButton"
        key={`${event.client.id}_${event.id}`}
        onClick={() => loadAdminClientOverview(event.client, true)}
      >
        <span aria-hidden="true">{event.type === "workout" ? "✓" : event.type === "nutrition" ? "🍽" : "📏"}</span>
        <strong>{event.clientName}</strong>
        <span>{event.title}</span>
        <time>{formatTrainerSummaryDate(event.date)}</time>
      </button>
    ))}
    {!trainerClientSummariesLoading && !trainerRecentEvents.length && (
      <div className="adminDashboardTimelineItem">
        Событий по клиентам пока нет.
      </div>
    )}
    {trainerClientSummariesLoading && (
      <div className="adminDashboardTimelineItem">Загружаю события клиентов...</div>
    )}
  </div>
</div>

            </div>

            
          </header>

          <section className="adminV3KpiGrid">
            <button className="adminSummaryLink" type="button" onClick={() => openAdminClientsWithFilter("all")}><span>Клиенты</span><strong>{usersList.length}</strong><small>в базе</small></button>
            <button className="adminSummaryLink" type="button" onClick={() => openAdminClientsWithFilter("active")}><span>Активные</span><strong>{filteredUsers.length}</strong><small>по фильтру</small></button>
            <button className="adminSummaryLink" type="button" onClick={() => openAdminClientsWithFilter("attention")}><span>Требуют внимания</span><strong>{attentionCount}</strong><small>по выбранному</small></button>
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
                          {item.clientComment && <p className="adminHistoryClientComment">“{item.clientComment}”</p>}
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
    const getClientCardSummary = (client = {}) => trainerClientSummaries[client.id] || {
      lastWorkoutAt: "",
      nutritionDays7: 0,
      averageCalories7: null,
      lastMeasurementAt: "",
      assignedProgramId: client.assignedProgramId || "",
      assignedProgramUpdatedAt: client.assignedProgramUpdatedAt || "",
      assignedWorkoutCount: Number(client.assignedWorkoutCount) || 0,
      programCompletionPercent: null
    };

    const adminUsersFilteredClients = usersList.filter((client) => {
      const profile = getAdminClientProfile(client);
      const search = adminUsersSearch.trim().toLowerCase();
      const matchesSearch = !search ||
        String(client.name || "").toLowerCase().includes(search) ||
        String(client.email || "").toLowerCase().includes(search);

      if (!matchesSearch) return false;

      const clientHistory = adminSelectedClient?.id === client.id ? adminClientHistory : [];
      const lastWorkoutDate = clientHistory[0]?.date ? new Date(clientHistory[0].date) : null;
      const daysSinceWorkout = lastWorkoutDate ? Math.round((Date.now() - lastWorkoutDate.getTime()) / (24 * 60 * 60 * 1000)) : null;
      const badCount = clientHistory.filter((item) => item.postWorkoutFeedback?.id === "bad").length;

      if (adminClientFilter === "active") return daysSinceWorkout === null || daysSinceWorkout <= 7;
      if (adminClientFilter === "attention") return badCount >= 2 || daysSinceWorkout >= 5;
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
    const selectedNutritionFallbackGoals = selectedClient?.nutritionGoals || adminClientNutrition?.goals || {};
    const selectedEffectiveNutritionGoals = getClientEffectiveNutritionGoals(
      selectedClient || {},
      adminClientNutrition,
      selectedNutritionFallbackGoals
    );
    const trainerNutritionPlanOptions = buildClientNutritionPresetOptions(
      selectedClient || {},
      adminClientNutrition,
      adminClientHistory
    );
    const aiPlan = getClientNutritionDisplayPlan(selectedClient || {}, adminClientNutrition, selectedNutritionFallbackGoals);
    const aiWeek = getAiNutritionWeekForDate(aiPlan) || aiPlan?.weeks?.[0] || null;
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
    const dailyCalorieGoal = Number(selectedEffectiveNutritionGoals.calories) || 2400;
    const dailyProteinGoal = Number(selectedEffectiveNutritionGoals.protein) || 160;
    const dailyFatGoal = Number(selectedEffectiveNutritionGoals.fat) || 75;
    const dailyCarbsGoal = Number(selectedEffectiveNutritionGoals.carbs) || 260;
    const currentMonthTrainingDays = ADMIN_CALENDAR_DAYS.filter((day) => adminCalendarDraft.trainingDays?.includes(day.id)).map((day) => day.title).join(", ") || "не выбраны";
    const trainingDayIdByJsDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const selectedPlateau = getClientPlateauInfo(adminClientMeasurements);
    const selectedPaymentAttention = getClientPaymentAttention(adminClientPayment);
    const selectedSummary = selectedClient ? trainerClientSummaries[selectedClient.id] || {} : {};
    const selectedPhotoCompare = adminPhotoCompareIds.map((photoId) => (
      adminClientProgressPhotos.find((photo) => photo.id === photoId) || null
    ));
    const trainerAiRecommendations = [
      selectedPlateau.isPlateau
        ? `Вес почти не меняется ${selectedPlateau.days} дней. Проверь калории, шаги и прогрессию нагрузки.`
        : "",
      selectedSummary.averageCalories7 && selectedSummary.averageCalories7 < dailyCalorieGoal * 0.85
        ? `Средняя калорийность ниже цели примерно на ${Math.round(dailyCalorieGoal - selectedSummary.averageCalories7)} ккал.`
        : "",
      selectedSummary.averageCalories7 && selectedSummary.averageCalories7 > dailyCalorieGoal * 1.15
        ? `Средняя калорийность выше цели примерно на ${Math.round(selectedSummary.averageCalories7 - dailyCalorieGoal)} ккал.`
        : "",
      !selectedClient?.assignedProgramId
        ? "У клиента нет назначенной программы тренировок."
        : "",
      adminClientHistory[0]?.clientComment
        ? `Комментарий после тренировки: ${adminClientHistory[0].clientComment}`
        : ""
    ].filter(Boolean);
    const selectedTelegramProfile = getClientTelegramProfile(selectedClient);
    const selectedWorkoutDays = getTrainerSummaryDaysSince(selectedSummary.lastWorkoutAt);
    const selectedNutritionDays = getTrainerSummaryDaysSince(selectedSummary.lastNutritionAt);
    const selectedMeasurementDays = selectedLatestMeasurement
      ? getTrainerSummaryDaysSince(selectedSummary.lastMeasurementAt)
      : null;
    const selectedNutritionTodayStart = getTrainerSummaryDayStart();
    const selectedNutritionWeek = clientNutritionDays.filter((day) => {
      const timestamp = getTrainerSummaryTimestamp(day.date);
      return timestamp &&
        timestamp >= selectedNutritionTodayStart - 7 * 24 * 60 * 60 * 1000 &&
        timestamp < selectedNutritionTodayStart;
    });
    const selectedNutritionTrackedDays = selectedNutritionWeek.filter((day) => (
      Number(day.totals?.calories) > 0 ||
      Number(day.totals?.protein) > 0 ||
      Number(day.totals?.fat) > 0 ||
      Number(day.totals?.carbs) > 0
    ));
    const selectedNutritionAverage = selectedNutritionTrackedDays.reduce((totals, day) => ({
      calories: totals.calories + (Number(day.totals?.calories) || 0),
      protein: totals.protein + (Number(day.totals?.protein) || 0),
      fat: totals.fat + (Number(day.totals?.fat) || 0),
      carbs: totals.carbs + (Number(day.totals?.carbs) || 0)
    }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
    const selectedNutritionDivisor = Math.max(1, selectedNutritionTrackedDays.length);
    Object.keys(selectedNutritionAverage).forEach((key) => {
      selectedNutritionAverage[key] = Math.round(selectedNutritionAverage[key] / selectedNutritionDivisor);
    });
    const selectedNutritionDays7Complete = selectedNutritionTrackedDays.length;
    const selectedNutritionCompliance = selectedNutritionAverage.calories
      ? Math.min(100, Math.round(selectedNutritionAverage.calories / dailyCalorieGoal * 100))
      : 0;
    const getSelectedMeasurementValue = (fieldId, source = selectedLatestMeasurement) => {
      const field = adminMeasurementFields.find((item) => item.id === fieldId);
      return field && source ? getProfileMeasurementValue(source, field) : "";
    };
    const selectedWeightValue = getSelectedMeasurementValue("weight") || selectedProfile?.weight || "";
    const selectedPreviousWeightValue = getSelectedMeasurementValue("weight", selectedPreviousMeasurement);
    const selectedWaistValue = getSelectedMeasurementValue("belly") || getSelectedMeasurementValue("waist") || "";
    const selectedPreviousWaistValue = getSelectedMeasurementValue("belly", selectedPreviousMeasurement) || getSelectedMeasurementValue("waist", selectedPreviousMeasurement);
    const getMetricDelta = (currentValue, previousValue) => {
      if (String(currentValue ?? "").trim() === "" || String(previousValue ?? "").trim() === "") return null;
      const currentNumber = Number(String(currentValue || "").replace(",", "."));
      const previousNumber = Number(String(previousValue || "").replace(",", "."));
      if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) return null;
      return Math.round((currentNumber - previousNumber) * 10) / 10;
    };
    const selectedWeightDelta = getMetricDelta(selectedWeightValue, selectedPreviousWeightValue);
    const selectedWaistDelta = getMetricDelta(selectedWaistValue, selectedPreviousWaistValue);
    const selectedProgramCompletion = Number.isFinite(selectedSummary.programCompletionPercent)
      ? selectedSummary.programCompletionPercent
      : null;
    const selectedCompletedWorkouts = Number(selectedSummary.completedWorkoutCount) || 0;
    const selectedAssignedWorkouts = Number(selectedSummary.assignedWorkoutCount || selectedClient?.assignedWorkoutCount) || 0;
    const selectedLatestPhoto = adminClientProgressPhotos[0] || null;
    const selectedTaskPreview = adminClientTasks.slice(0, 4);
    const selectedRecentActivity = [
      ...adminClientEvents,
      ...adminClientHistory.slice(0, 6).map((item) => ({
        id: `workout_${item.id}`,
        type: "workout",
        title: "Завершена тренировка",
        details: item.workoutName || item.name || item.workout || "Тренировка",
        date: item.date || item.completedAt || item.createdAt
      }))
    ]
      .sort((a, b) => getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt))
      .slice(0, 6);
    const selectedAttentionItems = [
      selectedPlateau.isPlateau
        ? {
            id: "danger",
            icon: "↓",
            title: `Вес стоит ${selectedPlateau.days} ${getTrainerDayWord(selectedPlateau.days)}`,
            text: "Проверь калории и нагрузку"
          }
        : selectedWorkoutDays !== null && selectedWorkoutDays >= 7
          ? {
              id: selectedWorkoutDays >= 14 ? "danger" : "warning",
              icon: "!",
              title: `Нет тренировок ${selectedWorkoutDays} ${getTrainerDayWord(selectedWorkoutDays)}`,
              text: "Стоит связаться с клиентом"
            }
          : {
              id: "success",
              icon: "✓",
              title: "Тренировки по плану",
              text: selectedSummary.workouts7 ? `${selectedSummary.workouts7} за последние 7 дней` : "Активность стабильна"
            },
      !selectedNutritionAverage.protein
        ? {
            id: "warning",
            icon: "!",
            title: "Нет данных по белку",
            text: "Проверь записи питания клиента"
          }
        : selectedNutritionAverage.protein < dailyProteinGoal * 0.9
        ? {
            id: "warning",
            icon: "▦",
            title: "Белок ниже цели",
            text: `Среднее: ${selectedNutritionAverage.protein} г / цель: ${dailyProteinGoal} г`
          }
        : {
            id: "success",
            icon: "✓",
            title: "Белок в норме",
            text: selectedNutritionAverage.protein ? `${selectedNutritionAverage.protein} г в среднем` : "Недостаточно данных"
          },
      selectedMeasurementDays === null || selectedMeasurementDays >= 30
        ? {
            id: "warning",
            icon: "◷",
            title: selectedMeasurementDays === null ? "Нет контрольного замера" : `Нет замеров ${selectedMeasurementDays} ${getTrainerDayWord(selectedMeasurementDays)}`,
            text: selectedLatestMeasurement ? `Последний: ${formatProfileMeasurementDate(selectedLatestMeasurement)}` : "Добавь задачу клиенту"
          }
        : {
            id: "success",
            icon: "✓",
            title: "Замеры актуальны",
            text: `Последний: ${formatProfileMeasurementDate(selectedLatestMeasurement)}`
          },
      selectedNutritionDays7Complete >= 5
        ? {
            id: "success",
            icon: "✓",
            title: `Питание ${selectedNutritionDays7Complete}/7 дней`,
            text: "Хорошая дисциплина"
          }
        : {
            id: selectedNutritionDays !== null && selectedNutritionDays >= 5 ? "danger" : "warning",
            icon: "!",
            title: `Питание ${selectedNutritionDays7Complete}/7 дней`,
            text: selectedNutritionDays === null ? "Нет записей" : `Последняя запись ${selectedNutritionDays} ${getTrainerDayWord(selectedNutritionDays)} назад`
          }
    ];
    const selectedTrainerRawName = selectedClient?.assignedTrainerName ||
      selectedClient?.trainerName ||
      telegramProfile.displayName ||
      auth.currentUser?.displayName ||
      auth.currentUser?.email?.split("@")?.[0] ||
      "Тренер";
    const selectedTrainerName = String(selectedTrainerRawName)
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");

    if (isTrainerNextWorkspace()) {
      const trainerNextSummaries = Object.fromEntries(
        usersList.map((client) => {
          const summary = getClientCardSummary(client);
          return [client.id, {
            ...summary,
            status: getClientActivityStatus(summary)
          }];
        })
      );
      const trainerNextTab = {
        training: "workouts",
        calendarNutrition: "nutrition",
        telegram: "notifications"
      }[adminUsersSelectedTab] || adminUsersSelectedTab;

      return (
        <TrainerWorkspace
          appVersion={APP_VERSION}
          mode={adminClientPageOpen && selectedClient ? "client" : "clients"}
          activeSection="clients"
          onNavigate={navigateTrainerNext}
          onRefresh={refreshPage}
          trainerName={selectedTrainerName}
          trainerAvatar={telegramProfile.avatarUrl}
          clients={usersList}
          clientSummaries={trainerNextSummaries}
          summariesLoading={trainerClientSummariesLoading}
          selectedClient={selectedClient}
          selectedProfile={{
            ...selectedProfile,
            goalLabel: getAdminClientGoalLabel(selectedProfile?.goal)
          }}
          selectedSummary={{
            ...selectedSummary,
            status: getClientActivityStatus(selectedSummary)
          }}
          activeClientTab={trainerNextTab}
          onClientTabChange={setAdminUsersSelectedTab}
          onOpenClient={openTrainerNextClient}
          onCloseClient={() => setAdminClientPageOpen(false)}
          onCreateClient={() => setAdminCreateClientModalOpen(true)}
          createClientState={getTrainerNextCreateClientState()}
          measurements={adminClientMeasurements}
          history={adminClientHistory}
          nutritionDays={clientNutritionDays}
          nutritionGoals={selectedEffectiveNutritionGoals}
          nutritionPlanOptions={trainerNutritionPlanOptions}
          photos={adminClientProgressPhotos}
          tasks={adminClientTasks}
          trainerNote={adminTrainerNote}
          onGenerateNutritionPlan={() => setAdminClientStatus("Параметры AI-плана открыты в разделе питания.")}
          onSaveNutritionPlan={saveTrainerClientNutritionPlan}
          onSaveNotifications={saveTrainerClientNotificationSettings}
          onTestNotification={() => sendAdminTestWorkoutReminder(selectedClient)}
          onConnectTelegram={openClientTelegramConnection}
          onSendMessage={sendTrainerClientMessage}
          onClientAction={handleTrainerClientAction}
          workouts={sortWorkoutDays(plan.workouts || [])}
          exerciseLibrary={trainerExerciseLibraryItems}
          programTemplates={adminTrainingTemplates}
          selectedProgramId={adminSelectedTemplateId}
          onSelectProgram={setAdminSelectedTemplateId}
          onAssignProgram={() => assignSavedProgramToClient(selectedClient?.id, adminSelectedTemplateId)}
          onSaveWorkoutSchedule={(dates) => saveTrainerClientWorkoutSchedule(dates, selectedClient)}
          programStatus={adminClientStatus}
          onUpdateWorkout={updateTrainerNextWorkout}
          onUpdateExercise={updateTrainerNextExercise}
          onUpdateExerciseSet={updateTrainerNextExerciseSet}
          onAddExerciseSet={addTrainerNextExerciseSet}
          onRemoveExerciseSet={removeTrainerNextExerciseSet}
          onAddExercise={addTrainerNextExercise}
          onRemoveExercise={removeTrainerNextExercise}
          onDuplicateExercise={duplicateTrainerNextExercise}
          onMoveExercise={moveTrainerNextExercise}
          onUploadExerciseVideo={uploadTrainerNextExerciseVideo}
          exerciseVideoUploadingId={adminExerciseVideoUploadingId}
          onAddDay={addTrainerNextWorkoutDay}
          onDuplicateDay={duplicateTrainerNextWorkoutDay}
          onRemoveDay={removeTrainerNextWorkoutDay}
          onSaveWorkouts={saveWorkoutsToFirebase}
          onLogout={logout}
        />
      );
    }

    return (
      <div className="adminUsersCrmPage">
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
            <section className="adminUsersFilterPills" aria-label="Фильтр клиентов">
              {[
                ["all", "Все"],
                ["active", "Активные"],
                ["attention", "Внимание"]
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={adminClientFilter === id ? "active" : ""}
                  onClick={() => setAdminClientFilter(id)}
                >
                  {label}
                </button>
              ))}
            </section>
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
                  const summary = getClientCardSummary(client);
                  const status = getClientActivityStatus(summary);
                  const completionText = summary.programCompletionPercent === null
                    ? "Программа —"
                    : `Программа ${summary.programCompletionPercent}%`;

                  return (
                    <button
                      key={client.id}
                      className={active ? "adminClientCard adminClientCardRect adminClientCardWide active" : "adminClientCard adminClientCardRect adminClientCardWide"}
                      onClick={() => loadAdminClientOverview(client, true)}
                    >
                      <span className="adminClientAvatar">👤</span>

                      <div className="adminClientCardMain">
                        <span className="trainerClientNameRow">
                          <strong>{client.name || client.email || "Клиент"}</strong>
                          <span className={`trainerClientStatusBadge ${status.id}`}>{status.label}</span>
                        </span>
                        <small>{client.email || client.id}</small>
                      </div>

                      <em>{getAdminClientGoalLabel(profile.goal)}</em>

                      <span className="trainerClientMiniStats adminClientSummaryStats">
                        <span>Тренировка {formatTrainerSummaryDate(summary.lastWorkoutAt)}</span>
                        <span>{completionText}</span>
                        <span>
                          Питание {summary.nutritionDays7}/7
                          {summary.averageCalories7 ? ` · ${summary.averageCalories7} ккал` : ""}
                        </span>
                        <span>Замер {formatTrainerSummaryDate(summary.lastMeasurementAt)}</span>
                      </span>

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
                <button
                  type="button"
                  className="adminClientDesktopDelete"
                  onClick={() => deleteClientEverywhereFromAdminPanel(selectedClient)}
                >
                  Удалить клиента
                </button>
              </div>

              <div className="adminClientWorkspaceHeader adminClientWorkspaceHeaderRender trainerClientHero">
                <div className="trainerClientHeroIdentity">
                  <div className="adminClientInitialsRender trainerClientHeroAvatar">
                    {selectedTelegramProfile.avatarUrl ? (
                      <img src={selectedTelegramProfile.avatarUrl} alt="" />
                    ) : (
                      String(selectedClient.name || selectedClient.email || "К").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
                    )}
                  </div>

                  <div className="trainerClientHeroCopy">
                    <div className="trainerClientHeroNameRow">
                      <h2>{selectedClient.name || selectedClient.email || "Клиент"}</h2>
                      <span className="adminClientStatusRender"><i /> {selectedClient.role === "trainer" ? "Тренер" : "Активен"}</span>
                    </div>
                    <p>
                      {[selectedProfile?.age ? `${selectedProfile.age} лет` : "", selectedProfile?.city || selectedClient?.city || ""].filter(Boolean).join(" · ") || selectedClient.email || selectedClient.id}
                    </p>
                    <strong>Цель: {getAdminClientGoalLabel(selectedProfile?.goal)}</strong>
                    <small>{selectedClient.goalDescription || "Персональный план тренировок и питания"}</small>
                  </div>
                </div>

                <div className="trainerClientHeroMeta">
                  <div>
                    <span>Последняя активность</span>
                    <strong>{selectedWorkoutDays === 0 ? "Сегодня" : formatTrainerSummaryDate(selectedSummary.lastWorkoutAt)}</strong>
                    <small>Тренировка</small>
                  </div>
                  <div>
                    <span>Telegram</span>
                    <strong>{selectedTelegramProfile.connected ? "Подключен" : "Не подключен"}</strong>
                    <small>{selectedTelegramProfile.connected ? `@${selectedTelegramProfile.username || "telegram"}` : "Нет связи"}</small>
                  </div>
                  <div>
                    <span>Тренер</span>
                    <strong>{selectedTrainerName}</strong>
                    <small>{selectedClient.assignedTrainerAt ? `С ${formatTrainerSummaryDate(selectedClient.assignedTrainerAt)}` : "Персональное ведение"}</small>
                  </div>
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
                  <div className="trainerClientDashboardOverview">
                    <section className="trainerClientOverviewSection trainerClientAttentionSection">
                      <div className="trainerClientSectionHead">
                        <div>
                          <span>ЦЕНТР ВНИМАНИЯ</span>
                          <small>Сигналы, которые требуют решения тренера</small>
                        </div>
                      </div>
                      <div className="trainerClientAttentionStrip">
                        {selectedAttentionItems.map((item) => (
                          <article className={item.id} key={item.title}>
                            <i>{item.icon}</i>
                            <div>
                              <strong>{item.title}</strong>
                              <small>{item.text}</small>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="trainerClientKpiGrid">
                      <article>
                        <span>ВЕС</span>
                        <strong>{selectedWeightValue || "—"} <small>кг</small></strong>
                        <em className={selectedWeightDelta === null ? "" : selectedWeightDelta <= 0 ? "positive" : "warning"}>
                          {selectedWeightDelta === null ? "Нет сравнения" : `${selectedWeightDelta > 0 ? "+" : ""}${selectedWeightDelta} кг`}
                        </em>
                        <small>{selectedMeasurementDays === null ? "Нет замеров" : `${selectedMeasurementDays} ${getTrainerDayWord(selectedMeasurementDays)} назад`}</small>
                      </article>
                      <article>
                        <span>ТАЛИЯ</span>
                        <strong>{selectedWaistValue || "—"} <small>см</small></strong>
                        <em className={selectedWaistDelta === null ? "" : selectedWaistDelta <= 0 ? "positive" : "warning"}>
                          {selectedWaistDelta === null ? "Нет сравнения" : `${selectedWaistDelta > 0 ? "+" : ""}${selectedWaistDelta} см`}
                        </em>
                        <small>По контрольным замерам</small>
                      </article>
                      <article>
                        <span>ТРЕНИРОВКИ</span>
                        <strong>{selectedSummary.workouts30 || 0}</strong>
                        <em>{selectedSummary.workouts7 || 0} за неделю</em>
                        <div className="trainerClientMiniBars" aria-hidden="true">
                          {[42, 68, 53, 82, 64, 91, 72, 58].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
                        </div>
                      </article>
                      <article>
                        <span>ПИТАНИЕ · 7 ДНЕЙ</span>
                        <strong>{selectedNutritionAverage.calories || "—"} <small>/ {dailyCalorieGoal}</small></strong>
                        <em>ккал/день в среднем</em>
                        <b>{selectedNutritionCompliance}%</b>
                      </article>
                      <article>
                        <span>ЗАМЕРЫ</span>
                        <strong className="dateValue">{selectedLatestMeasurement ? formatProfileMeasurementDate(selectedLatestMeasurement) : "—"}</strong>
                        <em>{selectedMeasurementDays === null ? "Нет данных" : `${selectedMeasurementDays} ${getTrainerDayWord(selectedMeasurementDays)} назад`}</em>
                        <small>Контроль тела</small>
                      </article>
                    </section>

                    <div className="trainerClientOverviewGrid trainerClientOverviewGridMain">
                      <section className="trainerClientOverviewSection trainerClientPhotosOverview">
                        <div className="trainerClientSectionHead">
                          <div>
                            <span>ФОТО ПРОГРЕССА</span>
                            <small>{selectedLatestPhoto ? `Последняя фотосессия: ${formatTrainerSummaryDate(selectedLatestPhoto.date || selectedLatestPhoto.createdAt)}` : "Фотосессий пока нет"}</small>
                          </div>
                          <div className="trainerClientSectionActions">
                            <button
                              type="button"
                              disabled={!adminClientProgressPhotos.length}
                              onClick={() => setAdminPhotoCompareOpen(true)}
                            >
                              Сравнить
                            </button>
                            <details className="trainerClientInlineEditor">
                              <summary>Добавить фото</summary>
                              <div className="trainerClientInlineEditorPanel">
                              <div className="trainerPhotoUploadGrid">
                                {[["front", "Фронт"], ["side", "Бок"], ["back", "Спина"]].map(([view, label]) => (
                                  <label key={view}>
                                    <span>{label}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(event) => setAdminProgressPhotoFiles((current) => ({
                                        ...current,
                                        [view]: event.target.files?.[0] || null
                                      }))}
                                    />
                                    <em>{adminProgressPhotoFiles[view]?.name || "Выбрать"}</em>
                                  </label>
                                ))}
                              </div>
                              <div className="trainerPhotoMetaRow">
                                <input type="date" value={adminProgressPhotoDate} onChange={(event) => setAdminProgressPhotoDate(event.target.value)} />
                                <input value={adminProgressPhotoComment} onChange={(event) => setAdminProgressPhotoComment(event.target.value)} placeholder="Комментарий тренера" />
                                <button type="button" disabled={adminProgressPhotoUploading} onClick={uploadAdminProgressPhotos}>
                                  {adminProgressPhotoUploading ? "Загружаю..." : "Сохранить"}
                                </button>
                              </div>
                              </div>
                            </details>
                          </div>
                        </div>
                        <div className="trainerClientPhotoRow">
                          {[["frontUrl", "Фронт"], ["sideUrl", "Бок"], ["backUrl", "Спина"]].map(([field, label]) => (
                            <figure key={field}>
                              {selectedLatestPhoto?.[field] ? (
                                <img src={selectedLatestPhoto[field]} alt={label} loading="lazy" />
                              ) : (
                                <div><span>＋</span><small>Нет фото</small></div>
                              )}
                              <figcaption>{label}</figcaption>
                            </figure>
                          ))}
                        </div>
                      </section>

                      <section className="trainerClientOverviewSection trainerClientTasksOverview">
                        <div className="trainerClientSectionHead">
                          <div>
                            <span>ЗАДАЧИ КЛИЕНТУ</span>
                            <small>{adminClientTasks.filter((task) => getTrainerTaskStatus(task).id !== "completed").length} активных</small>
                          </div>
                          <button type="button" onClick={() => setAdminTaskComposerOpen(true)}>＋ Добавить задачу</button>
                        </div>
                        <div className="trainerClientTaskPreview">
                          {selectedTaskPreview.map((task) => {
                            const taskStatus = getTrainerTaskStatus(task);
                            return (
                              <div className={taskStatus.id} key={task.id}>
                                <button
                                  type="button"
                                  onClick={() => updateAdminClientTask(task, taskStatus.id === "completed" ? "progress" : "completed")}
                                  aria-label={taskStatus.id === "completed" ? "Вернуть задачу" : "Завершить задачу"}
                                >
                                  {taskStatus.id === "completed" ? "✓" : ""}
                                </button>
                                <span>
                                  <strong>{task.title}</strong>
                                  <small>{task.dueDate ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}` : "Без срока"}</small>
                                </span>
                                <em>{taskStatus.label}</em>
                              </div>
                            );
                          })}
                          {!selectedTaskPreview.length && <p className="trainerWorkspaceEmpty">Добавь первую задачу клиенту.</p>}
                        </div>
                      </section>
                    </div>

                    <div className="trainerClientOverviewGrid">
                      <section className="trainerClientOverviewSection trainerClientNutritionOverview">
                        <div className="trainerClientSectionHead">
                          <div>
                            <span>ПИТАНИЕ · 7 ДНЕЙ</span>
                            <small>{selectedNutritionDays7Complete}/7 завершённых дней с записями</small>
                          </div>
                          <button type="button" onClick={() => setAdminUsersSelectedTab("calendarNutrition")}>Открыть календарь →</button>
                        </div>
                        <div className="trainerClientMacroGrid">
                          {[
                            ["Калории", selectedNutritionAverage.calories, dailyCalorieGoal, "ккал"],
                            ["Белки", selectedNutritionAverage.protein, dailyProteinGoal, "г"],
                            ["Жиры", selectedNutritionAverage.fat, dailyFatGoal, "г"],
                            ["Углеводы", selectedNutritionAverage.carbs, dailyCarbsGoal, "г"]
                          ].map(([label, value, goal, unit]) => {
                            const percent = value ? Math.min(100, Math.round(value / goal * 100)) : 0;
                            return (
                              <div key={label}>
                                <span>{label}</span>
                                <strong>{value || "—"}<small>{unit}</small></strong>
                                <em>из {goal}{unit}</em>
                                <i style={{ "--macro-progress": `${percent * 3.6}deg` }}><b>{percent}%</b></i>
                              </div>
                            );
                          })}
                        </div>
                        <div className="trainerClientCompliance">
                          <span>Соблюдение плана</span>
                          <i><b style={{ width: `${selectedNutritionCompliance}%` }} /></i>
                          <strong>{selectedNutritionCompliance}%</strong>
                        </div>
                      </section>

                      <section className="trainerClientOverviewSection trainerClientAiOverview">
                        <div className="trainerClientSectionHead">
                          <div>
                            <span>РЕКОМЕНДАЦИИ ТРЕНЕРУ</span>
                            <small>На основе последних данных</small>
                          </div>
                        </div>
                        <div className="trainerClientAiList">
                          {(trainerAiRecommendations.length ? trainerAiRecommendations : ["Критичных сигналов нет. Можно продолжать текущий план."]).slice(0, 3).map((item, index) => (
                            <div key={item}>
                              <i className={index === 0 ? "warning" : "success"}>{index === 0 ? "!" : "✓"}</i>
                              <span>
                                <strong>{index === 0 ? "Обрати внимание" : "Стабильная динамика"}</strong>
                                <small>{item}</small>
                              </span>
                            </div>
                          ))}
                        </div>
                        <details className="trainerClientNoteEditor">
                          <summary>Заметка тренера</summary>
                          <textarea value={adminTrainerNote} onChange={(event) => setAdminTrainerNote(event.target.value)} placeholder="Травмы, ограничения, предпочтения..." />
                          <button type="button" onClick={saveAdminTrainerNote}>Сохранить заметку</button>
                        </details>
                      </section>
                    </div>

                    <div className="trainerClientOverviewGrid trainerClientProgramRow">
                      <section className="trainerClientOverviewSection trainerClientProgramOverview">
                        <div className="trainerClientSectionHead">
                          <div>
                            <span>ПРОГРАММА</span>
                            <small>Текущая программа тренировок</small>
                          </div>
                          <button type="button" onClick={() => setAdminUsersSelectedTab("training")}>Открыть программу →</button>
                        </div>
                        <div className="trainerClientProgramSummary">
                          <i>▥</i>
                          <span>
                            <small>Назначено</small>
                            <strong>{selectedClient.assignedProgramName || "Программа не назначена"}</strong>
                          </span>
                          <b>{selectedProgramCompletion === null ? "—" : `${selectedProgramCompletion}%`}</b>
                        </div>
                        <div className="trainerClientProgramProgress">
                          <i><b style={{ width: `${selectedProgramCompletion || 0}%` }} /></i>
                          <span>Выполнено тренировок <strong>{selectedCompletedWorkouts} из {selectedAssignedWorkouts || "—"}</strong></span>
                          <span>Следующая <strong>{selectedAssignedWorkouts ? "По плану" : "Не назначена"}</strong></span>
                        </div>
                      </section>

                      <section className="trainerClientOverviewSection trainerClientControlOverview">
                        <div className="trainerClientSectionHead">
                          <div>
                            <span>КОНТРОЛЬ ПРОГРАММЫ</span>
                            <small>Сроки сопровождения и следующий контроль</small>
                          </div>
                          <div className="trainerClientSectionActions">
                            <strong className={selectedPaymentAttention.id}>{selectedPaymentAttention.label}</strong>
                            <button type="button" onClick={() => setAdminProgramControlOpen(true)}>Изменить</button>
                          </div>
                        </div>
                        <div className="trainerClientControlRows">
                          <div><span>Формат</span><strong>{adminPaymentDraft.format || "Персональный"}</strong></div>
                          <div><span>Назначена от</span><strong>{adminPaymentDraft.assignedFrom ? formatTrainerSummaryDate(adminPaymentDraft.assignedFrom) : formatTrainerSummaryDate(selectedClient.assignedProgramUpdatedAt)}</strong></div>
                          <div><span>Контроль до</span><strong>{adminPaymentDraft.controlUntil ? formatTrainerSummaryDate(adminPaymentDraft.controlUntil) : "Не указан"}</strong></div>
                        </div>
                      </section>
                    </div>

                    <section className="trainerClientOverviewSection trainerClientActivityOverview">
                      <div className="trainerClientSectionHead">
                        <div>
                          <span>ПОСЛЕДНЯЯ АКТИВНОСТЬ</span>
                          <small>Тренировки, задачи, фото и изменения программы</small>
                        </div>
                      </div>
                      <div className="trainerClientActivityList">
                        {selectedRecentActivity.map((event) => (
                          <div key={event.id}>
                            <i>{event.type === "workout" ? "▥" : event.type === "photo" ? "□" : event.type === "task" ? "✓" : "•"}</i>
                            <strong>{event.title}</strong>
                            <span>{event.details || "Без комментария"}</span>
                            <time>{formatTrainerSummaryDate(event.date || event.createdAt)}</time>
                          </div>
                        ))}
                        {!selectedRecentActivity.length && <p className="trainerWorkspaceEmpty">Активность появится после первой тренировки или действия тренера.</p>}
                      </div>
                    </section>

                    {adminTaskComposerOpen && (
                      <div
                        className="trainerClientDashboardModalOverlay"
                        onMouseDown={(event) => {
                          if (event.target === event.currentTarget) setAdminTaskComposerOpen(false);
                        }}
                      >
                        <section className="trainerClientDashboardModal" role="dialog" aria-modal="true" aria-labelledby="trainerTaskModalTitle">
                          <header>
                            <div>
                              <span>ЗАДАЧА КЛИЕНТУ</span>
                              <h3 id="trainerTaskModalTitle">Назначить новую задачу</h3>
                            </div>
                            <button type="button" onClick={() => setAdminTaskComposerOpen(false)} aria-label="Закрыть">×</button>
                          </header>
                          <div className="trainerClientDashboardModalBody trainerTaskCreate">
                            <label>
                              <span>Что нужно сделать</span>
                              <input value={adminNewTaskTitle} onChange={(event) => setAdminNewTaskTitle(event.target.value)} placeholder="Например: сделать контрольный замер" autoFocus />
                            </label>
                            <label>
                              <span>Срок выполнения</span>
                              <input type="date" value={adminNewTaskDueDate} onChange={(event) => setAdminNewTaskDueDate(event.target.value)} />
                            </label>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!adminNewTaskTitle.trim()) return;
                                await createAdminClientTask();
                                setAdminTaskComposerOpen(false);
                              }}
                            >
                              Назначить задачу
                            </button>
                          </div>
                        </section>
                      </div>
                    )}

                    {adminPhotoCompareOpen && (
                      <div
                        className="trainerClientDashboardModalOverlay"
                        onMouseDown={(event) => {
                          if (event.target === event.currentTarget) setAdminPhotoCompareOpen(false);
                        }}
                      >
                        <section className="trainerClientDashboardModal trainerClientPhotoCompareModal" role="dialog" aria-modal="true" aria-labelledby="trainerPhotoCompareTitle">
                          <header>
                            <div>
                              <span>ФОТО ПРОГРЕССА</span>
                              <h3 id="trainerPhotoCompareTitle">Сравнить фотосессии</h3>
                            </div>
                            <button type="button" onClick={() => setAdminPhotoCompareOpen(false)} aria-label="Закрыть">×</button>
                          </header>
                          <div className="trainerClientDashboardModalBody">
                            <div className="trainerPhotoCompareControls">
                              {[0, 1].map((slot) => (
                                <label key={slot}>
                                  <span>{slot === 0 ? "Предыдущая фотосессия" : "Новая фотосессия"}</span>
                                  <select
                                    value={adminPhotoCompareIds[slot] || ""}
                                    onChange={(event) => setAdminPhotoCompareIds((current) => {
                                      const next = [...current];
                                      next[slot] = event.target.value;
                                      return next;
                                    })}
                                  >
                                    <option value="">Выбрать дату</option>
                                    {adminClientProgressPhotos.map((photo) => (
                                      <option key={photo.id} value={photo.id}>
                                        {formatTrainerSummaryDate(photo.date || photo.createdAt)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ))}
                            </div>
                            <div className="trainerPhotoCompare">
                              {selectedPhotoCompare.map((photo, slot) => (
                                <div key={slot}>
                                  {photo ? (
                                    <>
                                      <strong>{formatTrainerSummaryDate(photo.date || photo.createdAt)}</strong>
                                      <div>
                                        {[photo.frontUrl, photo.sideUrl, photo.backUrl].filter(Boolean).map((url) => (
                                          <img key={url} src={url} alt="" loading="lazy" />
                                        ))}
                                      </div>
                                      {photo.comment && <small>{photo.comment}</small>}
                                    </>
                                  ) : <span>Выбери фотосессию для сравнения</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      </div>
                    )}

                    {adminProgramControlOpen && (
                      <div
                        className="trainerClientDashboardModalOverlay"
                        onMouseDown={(event) => {
                          if (event.target === event.currentTarget) setAdminProgramControlOpen(false);
                        }}
                      >
                        <section className="trainerClientDashboardModal" role="dialog" aria-modal="true" aria-labelledby="trainerProgramControlTitle">
                          <header>
                            <div>
                              <span>КОНТРОЛЬ ПРОГРАММЫ</span>
                              <h3 id="trainerProgramControlTitle">Изменить сопровождение</h3>
                            </div>
                            <button type="button" onClick={() => setAdminProgramControlOpen(false)} aria-label="Закрыть">×</button>
                          </header>
                          <div className="trainerClientDashboardModalBody trainerPaymentGrid">
                            <label><span>Назначена от</span><input type="date" value={adminPaymentDraft.assignedFrom} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, assignedFrom: event.target.value }))} /></label>
                            <label><span>Контроль до</span><input type="date" value={adminPaymentDraft.controlUntil} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, controlUntil: event.target.value }))} /></label>
                            <label><span>Формат</span><input value={adminPaymentDraft.format} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, format: event.target.value }))} placeholder="Например: персональная · 4 недели" /></label>
                            <label><span>Состояние</span><select value={adminPaymentDraft.status} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, status: event.target.value }))}><option value="active">Активна</option><option value="review">Требует проверки</option><option value="paused">Приостановлена</option></select></label>
                            <label className="wide"><span>Комментарий</span><input value={adminPaymentDraft.note} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Этап, ограничения или следующий контроль" /></label>
                            <button
                              type="button"
                              onClick={async () => {
                                await saveAdminClientPayment();
                                setAdminProgramControlOpen(false);
                              }}
                            >
                              Сохранить контроль
                            </button>
                          </div>
                        </section>
                      </div>
                    )}
                  </div>

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

                  <section className="trainerClientManagementGrid">
                    <article className="trainerWorkspaceCard trainerTasksCard">
                      <div className="trainerWorkspaceHead">
                        <div>
                          <span>ЗАДАЧИ НА НЕДЕЛЮ</span>
                          <h3>Задачи клиенту</h3>
                        </div>
                        <strong>{adminClientTasks.filter((task) => getTrainerTaskStatus(task).id !== "completed").length}</strong>
                      </div>

                      <div className="trainerTaskCreate">
                        <input
                          value={adminNewTaskTitle}
                          onChange={(event) => setAdminNewTaskTitle(event.target.value)}
                          placeholder="Например: сделать контрольный замер"
                        />
                        <input
                          type="date"
                          value={adminNewTaskDueDate}
                          onChange={(event) => setAdminNewTaskDueDate(event.target.value)}
                        />
                        <button type="button" onClick={createAdminClientTask}>Добавить</button>
                      </div>

                      <div className="trainerTaskList">
                        {adminClientTasks.map((task) => {
                          const taskStatus = getTrainerTaskStatus(task);
                          return (
                            <div className={`trainerTaskRow ${taskStatus.id}`} key={task.id}>
                              <button
                                type="button"
                                className="trainerTaskCheck"
                                onClick={() => updateAdminClientTask(task, taskStatus.id === "completed" ? "progress" : "completed")}
                                aria-label={taskStatus.id === "completed" ? "Вернуть задачу" : "Отметить выполненной"}
                              >
                                {taskStatus.id === "completed" ? "✓" : ""}
                              </button>
                              <span>
                                <strong>{task.title}</strong>
                                <small>{task.dueDate ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}` : "Без срока"}</small>
                              </span>
                              <em>{taskStatus.label}</em>
                              <button type="button" className="trainerTaskDelete" onClick={() => deleteAdminClientTask(task)}>×</button>
                            </div>
                          );
                        })}
                        {!adminClientTasks.length && <p className="trainerWorkspaceEmpty">Задач пока нет.</p>}
                      </div>
                    </article>

                    <article className="trainerWorkspaceCard trainerAiFocusCard">
                      <div className="trainerWorkspaceHead">
                        <div>
                          <span>AI FOCUS</span>
                          <h3>Рекомендации тренеру</h3>
                        </div>
                        <strong>AI</strong>
                      </div>
                      <div className="trainerAiRecommendationList">
                        {(trainerAiRecommendations.length ? trainerAiRecommendations : ["Критичных сигналов нет. Можно продолжать текущий план."]).map((item) => (
                          <div key={item}><i>✦</i><p>{item}</p></div>
                        ))}
                      </div>
                      {selectedPlateau.isPlateau && (
                        <div className="trainerPlateauBadge">Нет прогресса {selectedPlateau.days} дней</div>
                      )}
                    </article>

                    <article className="trainerWorkspaceCard trainerProgressPhotosCard">
                      <div className="trainerWorkspaceHead">
                        <div>
                          <span>ФОТО ПРОГРЕССА</span>
                          <h3>Фронт · бок · спина</h3>
                        </div>
                        <strong>{adminClientProgressPhotos.length}</strong>
                      </div>

                      <div className="trainerPhotoUploadGrid">
                        {[
                          ["front", "Фронт"],
                          ["side", "Бок"],
                          ["back", "Спина"]
                        ].map(([view, label]) => (
                          <label key={view}>
                            <span>{label}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => setAdminProgressPhotoFiles((current) => ({
                                ...current,
                                [view]: event.target.files?.[0] || null
                              }))}
                            />
                            <em>{adminProgressPhotoFiles[view]?.name || "Выбрать"}</em>
                          </label>
                        ))}
                      </div>
                      <div className="trainerPhotoMetaRow">
                        <input type="date" value={adminProgressPhotoDate} onChange={(event) => setAdminProgressPhotoDate(event.target.value)} />
                        <input value={adminProgressPhotoComment} onChange={(event) => setAdminProgressPhotoComment(event.target.value)} placeholder="Комментарий тренера" />
                        <button type="button" disabled={adminProgressPhotoUploading} onClick={uploadAdminProgressPhotos}>
                          {adminProgressPhotoUploading ? "Загружаю..." : "Сохранить фото"}
                        </button>
                      </div>

                      {adminClientProgressPhotos.length > 0 && (
                        <>
                          <div className="trainerPhotoCompareControls">
                            {[0, 1].map((slot) => (
                              <select
                                key={slot}
                                value={adminPhotoCompareIds[slot] || ""}
                                onChange={(event) => setAdminPhotoCompareIds((current) => {
                                  const next = [...current];
                                  next[slot] = event.target.value;
                                  return next;
                                })}
                              >
                                <option value="">Дата для сравнения</option>
                                {adminClientProgressPhotos.map((photo) => (
                                  <option key={photo.id} value={photo.id}>
                                    {new Date(`${photo.date || photo.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                          <div className="trainerPhotoCompare">
                            {selectedPhotoCompare.map((photo, slot) => (
                              <div key={slot}>
                                {photo ? (
                                  <>
                                    <strong>{new Date(`${photo.date}T12:00:00`).toLocaleDateString("ru-RU")}</strong>
                                    <div>
                                      {[photo.frontUrl, photo.sideUrl, photo.backUrl].filter(Boolean).map((url) => (
                                        <img key={url} src={url} alt="" loading="lazy" />
                                      ))}
                                    </div>
                                    {photo.comment && <small>{photo.comment}</small>}
                                  </>
                                ) : <span>Выбери дату</span>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </article>

                    <article className="trainerWorkspaceCard trainerPaymentCard">
                      <div className="trainerWorkspaceHead">
                        <div>
                          <span>ПРОГРАММА</span>
                          <h3>Контроль программы</h3>
                        </div>
                        <strong className={selectedPaymentAttention.id}>{selectedPaymentAttention.label}</strong>
                      </div>
                      <div className="trainerPaymentGrid">
                        <label><span>Назначена от</span><input type="date" value={adminPaymentDraft.assignedFrom} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, assignedFrom: event.target.value }))} /></label>
                        <label><span>Контроль до</span><input type="date" value={adminPaymentDraft.controlUntil} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, controlUntil: event.target.value }))} /></label>
                        <label><span>Формат</span><input value={adminPaymentDraft.format} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, format: event.target.value }))} placeholder="Например: персональная · 4 недели" /></label>
                        <label><span>Состояние</span><select value={adminPaymentDraft.status} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, status: event.target.value }))}><option value="active">Активна</option><option value="review">Требует проверки</option><option value="paused">Приостановлена</option></select></label>
                        <label className="wide"><span>Комментарий</span><input value={adminPaymentDraft.note} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Этап, ограничения или следующий контроль" /></label>
                        <button type="button" onClick={saveAdminClientPayment}>Сохранить контроль программы</button>
                      </div>
                    </article>

                    <article className="trainerWorkspaceCard trainerEventsCard">
                      <div className="trainerWorkspaceHead">
                        <div>
                          <span>ИСТОРИЯ РАБОТЫ</span>
                          <h3>События клиента</h3>
                        </div>
                        <strong>{adminClientEvents.length + adminClientHistory.filter((item) => item.clientComment).length}</strong>
                      </div>
                      <div className="trainerEventList">
                        {[
                          ...adminClientEvents,
                          ...adminClientHistory.filter((item) => item.clientComment).map((item) => ({
                            id: `comment_${item.id}`,
                            date: item.date,
                            title: "Комментарий после тренировки",
                            details: item.clientComment
                          }))
                        ]
                          .sort((a, b) => getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt))
                          .slice(0, 12)
                          .map((event) => (
                            <div key={event.id}>
                              <i>•</i>
                              <span><strong>{event.title}</strong><small>{event.details || "Без комментария"}</small></span>
                              <time>{formatTrainerSummaryDate(event.date || event.createdAt)}</time>
                            </div>
                          ))}
                        {!adminClientEvents.length && !adminClientHistory.some((item) => item.clientComment) && (
                          <p className="trainerWorkspaceEmpty">События появятся после задач, программ, фото и комментариев.</p>
                        )}
                      </div>
                    </article>
                  </section>

                  <div className="adminNutritionMonthPanel adminOverviewNutritionMonthPanel">
                    <div className="adminNutritionMonthHead">
                      <div>
                        <span>MONTH OVERVIEW</span>
                        <h3>Календарь активности</h3>
                        <p>Месяц по питанию и тренировкам: калории, БЖУ и тренировочные дни клиента.</p>
                      </div>
                    </div>

                    <div className="adminNutritionCalendarLegend">
                      <span><i className="calorieOk" /> Калории в плане</span>
                      <span><i className="calorieHigh" /> Калорий много</span>
                      <span><i className="proteinFill" /> Белок</span>
                      <span><i className="carbsFill" /> Углеводы</span>
                      <span><i className="fatFill" /> Жиры</span>
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
                        const fat = Number(day.totals.fat) || 0;
                        const carbs = Number(day.totals.carbs) || 0;
                        const caloriePercent = Math.min(100, Math.round((calories / dailyCalorieGoal) * 100));
                        const proteinPercent = Math.min(100, Math.round((protein / dailyProteinGoal) * 100));
                        const fatPercent = Math.min(100, Math.round((fat / dailyFatGoal) * 100));
                        const carbsPercent = Math.min(100, Math.round((carbs / dailyCarbsGoal) * 100));
                        const isHighCalories = calories > dailyCalorieGoal;
                        const hasFood = calories > 0 || protein > 0 || fat > 0 || carbs > 0;
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
                            <div
                              className="adminNutritionDayCarbsFill"
                              style={{ height: `${hasFood ? Math.max(5, carbsPercent) : 0}%` }}
                            />
                            <div
                              className="adminNutritionDayFatFill"
                              style={{ height: `${hasFood ? Math.max(5, fatPercent) : 0}%` }}
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
                          <option value="maintenance">Поддержка · 2400 ккал · Б 160</option>
                          <option value="recomposition">Рекомпозиция · 2300 ккал · Б 180</option>
                          <option value="fat_loss">Похудение · 2100 ккал · Б 170</option>
                          <option value="cutting">Сушка · 1900 ккал · Б 185</option>
                          <option value="mass_gain">Набор · 2850 ккал · Б 180</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        className="adminNutritionAssignButton"
                        onClick={async () => {
                          const nutritionPresetMap = {
                            maintenance: { name: "Поддержка", goal: "Поддержание веса и формы", calories: 2400, protein: 160, fat: 75, carbs: 260 },
                            recomposition: { name: "Рекомпозиция", goal: "Снижение жира и сохранение мышц", calories: 2300, protein: 180, fat: 70, carbs: 235 },
                            fat_loss: { name: "Похудение", goal: "Плавное снижение веса", calories: 2100, protein: 170, fat: 65, carbs: 190 },
                            cutting: { name: "Сушка", goal: "Снижение процента жира", calories: 1900, protein: 185, fat: 55, carbs: 160 },
                            mass_gain: { name: "Набор", goal: "Набор мышечной массы", calories: 2850, protein: 180, fat: 85, carbs: 340 }
                          };
                          const selectedNutritionPreset = nutritionPresetMap[adminSelectedNutritionPreset] || nutritionPresetMap.maintenance;
                          await saveTrainerClientNutritionPlan({
                            ...selectedNutritionPreset,
                            presetId: adminSelectedNutritionPreset
                          });
                        }}
                      >
                        Назначить план питания
                      </button>

                      <button
                        type="button"
                        className="adminNutritionAssignButton ghost"
                        onClick={async () => {
                          const confirmed = await showAppConfirm("Сбросить назначенный план питания клиента?");
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

{adminUsersSelectedTab === "overview" && canUseAdminFeatures() && (
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
{!adminClientPageOpen && (
          renderTrainerWorkspaceBottomBar("clients")
)}
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

    if (isTrainerNextWorkspace() && !trainerProgramManagerOpen) {
      const trainerName = telegramProfile.displayName ||
        auth.currentUser?.displayName ||
        auth.currentUser?.email?.split("@")?.[0] ||
        "Тренер";

      return (
        <TrainerWorkspace
          appVersion={APP_VERSION}
          mode="workouts"
          activeSection="workouts"
          onNavigate={navigateTrainerNext}
          trainerName={trainerName}
          trainerAvatar={telegramProfile.avatarUrl}
          clients={usersList}
          selectedClient={adminSelectedClient || selectedUser || usersList[0] || null}
          workouts={sortWorkoutDays(plan.workouts || [])}
          exerciseLibrary={trainerExerciseLibraryItems}
          programTemplates={adminTrainingTemplates}
          selectedProgramId={adminSelectedTemplateId}
          onSelectProgram={setAdminSelectedTemplateId}
          onAssignProgram={() => assignSavedProgramToClient(
            (adminSelectedClient || selectedUser || usersList[0])?.id,
            adminSelectedTemplateId
          )}
          onSaveWorkoutSchedule={(dates) => saveTrainerClientWorkoutSchedule(dates, adminSelectedClient || selectedUser || usersList[0])}
          onOpenProgramManager={openTrainerProgramManager}
          activeWorkoutTab={trainerWorkoutTab}
          onWorkoutTabChange={openTrainerExerciseLibrary}
          programStatus={adminClientStatus}
          onUpdateWorkout={updateTrainerNextWorkout}
          onUpdateExercise={updateTrainerNextExercise}
          onUpdateExerciseSet={updateTrainerNextExerciseSet}
          onAddExerciseSet={addTrainerNextExerciseSet}
          onRemoveExerciseSet={removeTrainerNextExerciseSet}
          onAddExercise={addTrainerNextExercise}
          onRemoveExercise={removeTrainerNextExercise}
          onDuplicateExercise={duplicateTrainerNextExercise}
          onMoveExercise={moveTrainerNextExercise}
          onUploadExerciseVideo={uploadTrainerNextExerciseVideo}
          exerciseVideoUploadingId={adminExerciseVideoUploadingId}
          onAddDay={addTrainerNextWorkoutDay}
          onDuplicateDay={duplicateTrainerNextWorkoutDay}
          onRemoveDay={removeTrainerNextWorkoutDay}
          onSaveWorkouts={saveWorkoutsToFirebase}
          onCreateClient={() => setAdminCreateClientModalOpen(true)}
          createClientState={getTrainerNextCreateClientState()}
        />
      );
    }

    const monthProgram = adminProgramGroups?.[0] || {
      id: `month_${Date.now()}`,
      name: "Программа на месяц",
      blocks: createFourWeekWorkoutProgramBlocks("default")
    };

    const normalizedMonthProgram = normalizeMonthProgram(monthProgram);
    const monthBlocks = normalizedMonthProgram.blocks || [];
    const monthGroups = normalizedMonthProgram.months || [];
    const monthWorkouts = monthBlocks.flatMap((block) =>
      (block.weeks || []).flatMap((week) =>
        (week.workouts || []).map((workout) => ({ ...workout, blockName: block.name, weekName: week.name }))
      )
    );
    const monthExercises = monthWorkouts.reduce((sum, workout) => sum + (workout.exercises?.length || 0), 0);
    const adminExerciseLibrarySources = [
        ...monthWorkouts.flatMap((workout) => workout.exercises || []),
        ...adminTrainingTemplates.flatMap((template) => {
          const templateMicrocycles = Array.isArray(template.blocks)
            ? template.blocks
            : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
          return [
            ...(template.workouts || []),
            ...templateMicrocycles.flatMap((microcycle) =>
              (microcycle.weeks || []).flatMap((week) => week.workouts || [])
            )
          ].flatMap((workout) => workout.exercises || []);
        })
      ].filter((exercise) => String(exercise?.name || "").trim());
    const adminExerciseLibrary = Array.from(adminExerciseLibrarySources.reduce((library, exercise) => {
      const key = String(exercise.name).trim().toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");
      const current = library.get(key);
      const currentVideo = String(current?.video || current?.videoUrl || current?.videoURL || "").trim();
      const exerciseVideo = String(exercise?.video || exercise?.videoUrl || exercise?.videoURL || "").trim();
      if (!current || (!currentVideo && exerciseVideo)) library.set(key, exercise);
      return library;
    }, new Map()).values());
    const openMonthWorkoutContext = monthBlocks.flatMap((block) =>
      (block.weeks || []).flatMap((week) =>
        (week.workouts || []).map((workout) => ({ block, week, workout }))
      )
    ).find(({ workout }) => workout.id === adminOpenWorkoutId);

    function normalizeMonthProgram(program = monthProgram) {
      const sourceMonths = Array.isArray(program.months) ? program.months : [];
      const nestedMicrocycles = sourceMonths.flatMap((month, monthIndex) =>
        (Array.isArray(month.microcycles) ? month.microcycles : (month.blocks || [])).map((microcycle) => ({
          ...microcycle,
          monthId: microcycle.monthId || month.id || `month_${monthIndex + 1}`
        }))
      );
      const sourceBlocks = Array.isArray(program.blocks)
        ? program.blocks
        : nestedMicrocycles;
      const hasStructuredHierarchy = sourceMonths.some((month) =>
        Array.isArray(month.microcycles) || Array.isArray(month.blocks)
      ) || (Array.isArray(program.months) && Array.isArray(program.blocks));
      const blockCount = sourceBlocks.length || (hasStructuredHierarchy ? 0 : 2);
      const blocks = Array.from({ length: blockCount }, (_, blockIndex) => {
        const sourceBlock = sourceBlocks[blockIndex] || {};
        const sourceWeeks = Array.isArray(sourceBlock.weeks)
          ? sourceBlock.weeks
          : [{}, {}];
        const sourceName = String(sourceBlock.name || "").trim();

        return {
          id: sourceBlock.id || `microcycle_${blockIndex + 1}`,
          name: sourceName
            ? sourceName.replace(/^Блок(?=\s*\d)/i, "Микроцикл")
            : `Микроцикл ${blockIndex + 1}`,
          monthId: sourceBlock.monthId || `month_${Math.floor(blockIndex / 2) + 1}`,
          weeks: Array.from({ length: sourceWeeks.length }, (_, weekOffset) => {
            const sourceWeek = sourceWeeks[weekOffset] || {};
            const absoluteWeek = blockIndex * 2 + weekOffset + 1;
            return {
              id: sourceWeek.id || `week_${absoluteWeek}`,
              name: sourceWeek.name || `Неделя ${absoluteWeek}`,
              workouts: sourceWeek.workouts || []
            };
          })
        };
      });
      const sourceMonthIds = sourceMonths.map((month, monthIndex) => month.id || `month_${monthIndex + 1}`);
      const monthIds = [
        ...sourceMonthIds,
        ...blocks.map((block) => block.monthId).filter((monthId) => !sourceMonthIds.includes(monthId))
      ].filter((monthId, index, items) => monthId && items.indexOf(monthId) === index);
      const months = monthIds.map((monthId, monthIndex) => {
        const sourceMonth = sourceMonths.find((month, sourceMonthIndex) =>
          (month.id || `month_${sourceMonthIndex + 1}`) === monthId
        );
        const sourceName = String(sourceMonth?.name || "").trim();

        return {
          id: monthId,
          name: sourceName
            ? sourceName.replace(/^Блок\s+Месяц/i, "Месяц")
            : `Месяц ${monthIndex + 1}`,
          microcycles: blocks.filter((block) => block.monthId === monthId)
        };
      });

      return {
        id: program.id || `month_${Date.now()}`,
        name: program.name || "Программа на месяц",
        description: program.description || "",
        ownerUid: program.ownerUid || "",
        ownerRole: program.ownerRole || "",
        createdByUid: program.createdByUid || "",
        updatedByUid: program.updatedByUid || "",
        createdAt: program.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        blocks,
        months
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

    function updateMonthProgramDescription(description) {
      setMonthProgram((program) => ({ ...program, description }));
    }

    function addProgramMonth() {
      setMonthProgram((program) => {
        const nextMonthNumber = (program.months || []).reduce((maxNumber, month, index) => {
          const monthNumber = Number(String(month.name || "").match(/Месяц\s+(\d+)/i)?.[1]) || index + 1;
          return Math.max(maxNumber, monthNumber);
        }, 0) + 1;
        const monthId = `month_${Date.now()}`;

        return {
          ...program,
          months: [
            ...(program.months || []),
            {
              id: monthId,
              name: `Месяц ${nextMonthNumber}`,
              microcycles: []
            }
          ]
        };
      });
    }

    function updateProgramMonth(monthId, patch = {}) {
      setMonthProgram((program) => ({
        ...program,
        months: (program.months || []).map((month) =>
          month.id === monthId ? { ...month, ...patch } : month
        )
      }));
    }

    async function removeProgramMonth(monthId) {
      const month = monthGroups.find((item) => item.id === monthId);
      if (!month) return;
      if (!(await showAppConfirm(`Удалить «${month.name || "Месяц"}» со всеми микроциклами, неделями и тренировками?`))) {
        return;
      }

      const removedBlockIds = new Set(
        (month.microcycles || month.blocks || []).map((block) => block.id)
      );
      const removedWorkoutIds = new Set(
        (month.microcycles || month.blocks || []).flatMap((block) =>
          (block.weeks || []).flatMap((week) =>
            (week.workouts || []).map((workout) => workout.id)
          )
        )
      );

      setMonthProgram((program) => ({
        ...program,
        months: (program.months || []).filter((item) => item.id !== monthId),
        blocks: (program.blocks || []).filter((block) => !removedBlockIds.has(block.id))
      }));

      if (removedWorkoutIds.has(adminOpenWorkoutId)) {
        setAdminOpenWorkoutId("");
        setAdminSelectedExerciseId("");
      }
    }

    function addMonthBlock(monthId = "month_1") {
      setMonthProgram((program) => {
        const nextBlockNumber = program.blocks.reduce((maxNumber, block) => {
          const blockNumber = Number(String(block.name || "").match(/^(?:Микроцикл|Блок)\s+(\d+)/i)?.[1]) || 0;
          return Math.max(maxNumber, blockNumber);
        }, 0) + 1;

        return {
          ...program,
          blocks: [
            ...program.blocks,
            {
              id: `microcycle_${Date.now()}`,
              name: `Микроцикл ${nextBlockNumber}`,
              monthId,
              weeks: []
            }
          ]
        };
      });
    }

    function addMonthWeek(blockId) {
      setMonthProgram((program) => {
        const nextWeekNumber = program.blocks.reduce((maxNumber, block) =>
          (block.weeks || []).reduce((weekMax, week) => {
            const weekNumber = Number(String(week.name || "").match(/^Неделя\s+(\d+)/i)?.[1]) || 0;
            return Math.max(weekMax, weekNumber);
          }, maxNumber), 0) + 1;
        return {
          ...program,
          blocks: program.blocks.map((block) => block.id !== blockId ? block : {
            ...block,
            weeks: [
              ...(block.weeks || []),
              { id: `week_${Date.now()}`, name: `Неделя ${nextWeekNumber}`, workouts: [] }
            ]
          })
        };
      });
      setAdminOpenProgramBlocks((current) => ({ ...current, [blockId]: true }));
    }

    function openCopyMonthProgramBlock(blockId) {
      const sourceBlock = monthBlocks.find((block) => block.id === blockId);
      if (!sourceBlock) return;

      setAdminProgramCopyTarget({
        blockId
      });
    }

    function copyMonthProgramBlock(blockId, targetMonthId, afterBlockId = "") {
      setMonthProgram((program) => {
        const sourceBlock = program.blocks.find((block) => block.id === blockId);
        if (!sourceBlock) return program;

        const stamp = Date.now();
        const copiedBlock = {
          ...sourceBlock,
          id: `microcycle_${stamp}`,
          name: `${sourceBlock.name || "Микроцикл"} — копия`,
          monthId: targetMonthId,
          weeks: (sourceBlock.weeks || []).map((week, weekIndex) => ({
            ...week,
            id: `week_${stamp}_${weekIndex}`,
            workouts: (week.workouts || []).map((workout, workoutIndex) => ({
              ...workout,
              id: `workout_${stamp}_${weekIndex}_${workoutIndex}`,
              exercises: (workout.exercises || []).map((exercise, exerciseIndex) => ({
                ...exercise,
                id: `exercise_${stamp}_${weekIndex}_${workoutIndex}_${exerciseIndex}`,
                sets: (exercise.sets || []).map((set, setIndex) => ({
                  ...set,
                  ...(set?.id ? { id: `set_${stamp}_${weekIndex}_${workoutIndex}_${exerciseIndex}_${setIndex}` } : {})
                }))
              }))
            }))
          }))
        };
        const nextBlocks = [...program.blocks];
        const targetIndex = afterBlockId
          ? nextBlocks.findIndex((block) => block.id === afterBlockId)
          : nextBlocks.findIndex((block) => block.monthId === targetMonthId) - 1;
        nextBlocks.splice(Math.max(0, targetIndex + 1), 0, copiedBlock);
        return { ...program, blocks: nextBlocks };
      });
      setAdminProgramCopyTarget(null);
    }

    async function removeMonthBlock(blockId) {
      const block = monthBlocks.find((item) => item.id === blockId);
      if (!block) return;
      if (!(await showAppConfirm(`Удалить микроцикл “${block.name || "Без названия"}” со всеми неделями и тренировками?`))) {
        setAdminProgramSwipeOpenKey("");
        return;
      }

      const removedWeekIds = new Set((block.weeks || []).map((week) => week.id));
      const removedWorkoutIds = new Set(
        (block.weeks || []).flatMap((week) => (week.workouts || []).map((workout) => workout.id))
      );
      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.filter((item) => item.id !== blockId)
      }));
      setAdminOpenProgramBlocks((current) => {
        const next = { ...current };
        delete next[blockId];
        return next;
      });
      setAdminOpenProgramWeeks((current) => Object.fromEntries(
        Object.entries(current).filter(([weekId]) => !removedWeekIds.has(weekId))
      ));
      if (removedWorkoutIds.has(adminOpenWorkoutId)) {
        setAdminOpenWorkoutId("");
        setAdminSelectedExerciseId("");
      }
      if (removedWorkoutIds.has(adminActiveDayId)) {
        setAdminActiveDayId("");
      }
      if (adminProgramCopyTarget?.blockId === blockId) {
        setAdminProgramCopyTarget(null);
      }
      setAdminProgramSwipeOpenKey("");
    }

    async function removeMonthWeek(blockId, weekId) {
      const block = monthBlocks.find((item) => item.id === blockId);
      const week = block?.weeks?.find((item) => item.id === weekId);
      if (!week) return;
      if (!(await showAppConfirm(`Удалить “${week.name || "Неделя"}” со всеми днями?`))) {
        setAdminProgramSwipeOpenKey("");
        return;
      }

      const removedWorkoutIds = new Set((week.workouts || []).map((workout) => workout.id));
      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.map((item) => item.id !== blockId ? item : {
          ...item,
          weeks: (item.weeks || []).filter((entry) => entry.id !== weekId)
        })
      }));
      setAdminOpenProgramWeeks((current) => {
        const next = { ...current };
        delete next[weekId];
        return next;
      });
      if (removedWorkoutIds.has(adminOpenWorkoutId)) {
        setAdminOpenWorkoutId("");
        setAdminSelectedExerciseId("");
      }
      if (removedWorkoutIds.has(adminActiveDayId)) {
        setAdminActiveDayId("");
      }
      setAdminProgramSwipeOpenKey("");
    }

    async function confirmRemoveMonthWorkout(blockId, weekId, workoutId) {
      const workout = monthWorkouts.find((item) => item.id === workoutId);
      if (!workout) return;
      if (!(await showAppConfirm(`Удалить тренировку “${workout.name || "Без названия"}”?`))) {
        setAdminProgramSwipeOpenKey("");
        return;
      }

      removeMonthWorkout(blockId, weekId, workoutId);
      setAdminProgramSwipeOpenKey("");
    }

    function handleAdminProgramSwipeStart(key, event) {
      event.stopPropagation();
      if (event.pointerType === "mouse" && event.button !== 0) return;
      adminProgramSwipeStartRef.current = { key, x: event.clientX, y: event.clientY };
    }

    function handleAdminProgramSwipeEnd(key, event) {
      event.stopPropagation();
      const start = adminProgramSwipeStartRef.current;
      adminProgramSwipeStartRef.current = null;
      if (!start || start.key !== key) return;

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

      event.preventDefault();
      adminProgramSwipeSuppressClickRef.current = true;
      window.setTimeout(() => {
        adminProgramSwipeSuppressClickRef.current = false;
      }, 0);
      setAdminProgramSwipeOpenKey(deltaX < 0 ? key : "");
    }

    function handleAdminProgramSwipeCancel(key, event) {
      event.stopPropagation();
      if (adminProgramSwipeStartRef.current?.key === key) {
        adminProgramSwipeStartRef.current = null;
      }
    }

    function handleAdminProgramSwipeClick(event) {
      if (!adminProgramSwipeSuppressClickRef.current) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function updateMonthBlock(blockId, patch) {
      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block)
      }));
    }

    function toggleMonthProgramBlock(blockId) {
      setAdminOpenProgramBlocks((current) => ({
        ...current,
        [blockId]: !current[blockId]
      }));
    }

    function toggleMonthProgramWeek(weekId) {
      setAdminOpenProgramWeeks((current) => ({
        ...current,
        [weekId]: !current[weekId]
      }));
    }

    function addMonthWorkout(blockId, weekId) {
      const newWorkoutId = `workout_${Date.now()}`;

      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          weeks: block.weeks.map((week) => {
            if (week.id !== weekId) return week;
            const nextWorkoutNumber = (week.workouts || []).reduce((maxNumber, workout) => {
              const workoutNumber = Number(String(workout.name || "").match(/Тренировка\s+(\d+)/i)?.[1]) || 0;
              return Math.max(maxNumber, workoutNumber);
            }, 0) + 1;
            return {
              ...week,
              workouts: [
                ...(week.workouts || []),
                {
                  id: newWorkoutId,
                  name: `${week.name} — Тренировка ${nextWorkoutNumber}`,
                  exercises: []
                }
              ]
            };
          })
        })
      }));

      setAdminOpenProgramBlocks((current) => ({ ...current, [blockId]: true }));
      setAdminOpenProgramWeeks((current) => ({ ...current, [weekId]: true }));
      setAdminOpenWorkoutId(newWorkoutId);
      setAdminSelectedExerciseId("");
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
      if (adminOpenWorkoutId === workoutId) {
        setAdminOpenWorkoutId("");
        setAdminSelectedExerciseId("");
      }
      if (adminActiveDayId === workoutId) {
        setAdminActiveDayId("");
      }
    }

    function duplicateMonthWorkout(blockId, weekId, workoutId) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      if (!sourceWorkout) return;
      const stamp = Date.now();
      const duplicatedWorkout = {
        ...sourceWorkout,
        id: `workout_${stamp}`,
        name: `${sourceWorkout.name || "Тренировка"} — копия`,
        exercises: (sourceWorkout.exercises || []).map((exercise, exerciseIndex) => ({
          ...exercise,
          id: `exercise_${stamp}_${exerciseIndex}`,
          sets: (exercise.sets || []).map((set, setIndex) => ({
            ...set,
            ...(set?.id ? { id: `set_${stamp}_${exerciseIndex}_${setIndex}` } : {})
          }))
        }))
      };

      setMonthProgram((program) => ({
        ...program,
        blocks: program.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          weeks: block.weeks.map((week) => week.id !== weekId ? week : {
            ...week,
            workouts: (week.workouts || []).flatMap((workout) =>
              workout.id === workoutId ? [workout, duplicatedWorkout] : [workout]
            )
          })
        })
      }));
      setAdminOpenWorkoutId(duplicatedWorkout.id);
      setAdminSelectedExerciseId("");
    }

    function addMonthExercise(blockId, weekId, workoutId, sourceExercise = null, openEditor = true) {
      const newExerciseId = `exercise_${Date.now()}`;
      const exerciseName = String(sourceExercise?.name || adminExerciseSearch || "Новое упражнение").trim() || "Новое упражнение";
      const libraryExercise = sourceExercise || findExerciseLibraryMatch(adminExerciseLibrary, exerciseName);
      const libraryVideo = libraryExercise?.video || libraryExercise?.videoUrl || libraryExercise?.videoURL || "";
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: [
          ...((monthWorkouts.find((workout) => workout.id === workoutId)?.exercises) || []),
          {
            id: newExerciseId,
            name: exerciseName,
            video: libraryVideo,
            videoAutoFilledFrom: libraryVideo ? libraryExercise.name : "",
            requiresWeight: exerciseUsesExternalWeight(libraryExercise || { name: exerciseName }),
            sets: Array.from({ length: 3 }, () => ({ reps: 8, weight: "" }))
          }
        ]
      });
      if (!openEditor) {
        setAdminExerciseSearch("");
        return;
      }
      adminExerciseEditSnapshotRef.current = {
        isNew: true,
        blockId,
        weekId,
        workoutId,
        exerciseId: newExerciseId,
        exercise: null
      };
      setAdminSelectedExerciseId(newExerciseId);
      setAdminExerciseSearch("");
      window.requestAnimationFrame(() => {
        document.querySelector(`[data-month-exercise-id="${newExerciseId}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      });
    }

    function openMonthExerciseEditor(blockId, weekId, workoutId, exercise) {
      adminExerciseEditSnapshotRef.current = {
        isNew: false,
        blockId,
        weekId,
        workoutId,
        exerciseId: exercise.id,
        exercise: {
          ...exercise,
          sets: (exercise.sets || []).map((set) => ({ ...set }))
        }
      };
      setAdminSelectedExerciseId(exercise.id);
    }

    function cancelMonthExerciseEdit() {
      const snapshot = adminExerciseEditSnapshotRef.current;
      if (!snapshot) {
        setAdminSelectedExerciseId("");
        return;
      }

      if (snapshot.isNew) {
        removeMonthExercise(snapshot.blockId, snapshot.weekId, snapshot.workoutId, snapshot.exerciseId);
      } else {
        updateMonthExercise(
          snapshot.blockId,
          snapshot.weekId,
          snapshot.workoutId,
          snapshot.exerciseId,
          snapshot.exercise
        );
      }

      adminExerciseEditSnapshotRef.current = null;
      setAdminSelectedExerciseId("");
    }

    async function saveMonthExerciseEdit() {
      const saved = await saveMonthProgramToLibrary();
      if (!saved) return;
      adminExerciseEditSnapshotRef.current = null;
      setAdminSelectedExerciseId("");
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

    function updateMonthExerciseName(blockId, weekId, workoutId, exercise, name) {
      const libraryExercise = findExerciseLibraryMatch(adminExerciseLibrary, name, exercise.id);
      const libraryVideo = libraryExercise?.video || libraryExercise?.videoUrl || libraryExercise?.videoURL || "";
      const patch = { name };

      if (libraryVideo && (!exercise.video || exercise.videoAutoFilledFrom)) {
        patch.video = libraryVideo;
        patch.videoAutoFilledFrom = libraryExercise.name;
        patch.requiresWeight = exerciseUsesExternalWeight(libraryExercise);
      } else if (exercise.videoAutoFilledFrom && !libraryVideo) {
        patch.video = "";
        patch.videoAutoFilledFrom = "";
      }

      updateMonthExercise(blockId, weekId, workoutId, exercise.id, patch);
    }

    function removeMonthExercise(blockId, weekId, workoutId, exerciseId) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: (sourceWorkout?.exercises || []).filter((exercise) => exercise.id !== exerciseId)
      });
    }

    function duplicateMonthExercise(blockId, weekId, workoutId, exerciseId) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      const sourceExercise = sourceWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
      if (!sourceWorkout || !sourceExercise) return;
      const stamp = Date.now();
      const duplicatedExercise = {
        ...sourceExercise,
        id: `exercise_${stamp}`,
        name: `${sourceExercise.name || "Упражнение"} — копия`,
        sets: (sourceExercise.sets || []).map((set, setIndex) => ({
          ...set,
          ...(set?.id ? { id: `set_${stamp}_${setIndex}` } : {})
        }))
      };

      updateMonthWorkout(blockId, weekId, workoutId, {
        exercises: (sourceWorkout.exercises || []).flatMap((exercise) =>
          exercise.id === exerciseId ? [exercise, duplicatedExercise] : [exercise]
        )
      });
    }

    function moveMonthExercise(blockId, weekId, workoutId, exerciseId, direction) {
      const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
      const exercises = [...(sourceWorkout?.exercises || [])];
      const currentIndex = exercises.findIndex((exercise) => exercise.id === exerciseId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= exercises.length) return;
      [exercises[currentIndex], exercises[nextIndex]] = [exercises[nextIndex], exercises[currentIndex]];
      updateMonthWorkout(blockId, weekId, workoutId, { exercises });
    }

    async function uploadMonthExerciseVideo(blockId, weekId, workoutId, exerciseId, file) {
      if (!file) return;

      setAdminExerciseVideoUploadingId(exerciseId);
      try {
        const owner = getCurrentProgramOwner();
        const existingTemplate = adminTrainingTemplates.find((template) => template.id === monthProgram.id);
        if (!owner.uid || (existingTemplate && !canManageTrainingTemplate(existingTemplate))) {
          showAppError("load", "У вас нет прав на изменение этой программы.");
          return;
        }
        const safeName = String(file.name || "exercise-video").replace(/[^\wа-яА-ЯёЁ.\-]+/g, "_");
        const storageRef = ref(storage, `exercise-videos/${owner.uid}/${monthProgram.id || "draft"}/${Date.now()}-${safeName}`);

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        const programWithVideo = normalizeMonthProgram({
          ...monthProgram,
          blocks: monthProgram.blocks.map((block) => block.id !== blockId ? block : {
            ...block,
            weeks: block.weeks.map((week) => week.id !== weekId ? week : {
              ...week,
              workouts: (week.workouts || []).map((workout) => workout.id !== workoutId ? workout : {
                ...workout,
                exercises: (workout.exercises || []).map((exercise) =>
                  exercise.id === exerciseId
                    ? { ...exercise, video: url, videoAutoFilledFrom: "" }
                    : exercise
                )
              })
            })
          })
        });

        setMonthProgram(programWithVideo);
        const saved = await saveMonthProgramToLibrary(programWithVideo);
        if (saved) {
          showAppError("savedLocal", "Видео загружено и сохранено в программе.");
        }
      } catch (error) {
        console.error("Month exercise video upload error:", error);
        showAppError("firebase", "Не получилось загрузить видео.");
      } finally {
        setAdminExerciseVideoUploadingId("");
      }
    }

    async function saveMonthProgramToLibrary(programOverride = null) {
      const program = normalizeMonthProgram(programOverride || monthProgram);
      const owner = getCurrentProgramOwner();
      const existingTemplate = adminTrainingTemplates.find((template) => template.id === program.id);
      if (!owner.uid) {
        showAppError("load", "Не удалось определить владельца программы.");
        return false;
      }
      if (!canUseAdminFeatures() && (
        (existingTemplate && !canManageTrainingTemplate(existingTemplate)) ||
        (program.ownerUid && program.ownerUid !== owner.uid)
      )) {
        showAppError("load", "Тренер может изменять только свои программы.");
        return false;
      }
      const ownerUid = canUseAdminFeatures()
        ? (existingTemplate?.ownerUid || program.ownerUid || owner.uid)
        : owner.uid;
      const ownerRole = canUseAdminFeatures()
        ? (existingTemplate?.ownerRole || program.ownerRole || "admin")
        : "trainer";
      const createdByUid = existingTemplate?.createdByUid || program.createdByUid || ownerUid;
      const workoutsToSave = program.blocks.flatMap((block, blockIndex) =>
        block.weeks.flatMap((week, weekIndex) =>
          (week.workouts || []).map((workout, workoutIndex) => ({
            ...workout,
            microcycleId: block.id,
            microcycleName: block.name,
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
          description: program.description || "",
          type: "monthly_program",
          source: "program_library",
          ownerUid,
          ownerRole,
          createdByUid,
          updatedByUid: owner.uid,
          months: program.months,
          blocks: program.blocks,
          workouts: workoutsToSave,
          createdAt: program.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: createdByUid,
          createdByEmail: user?.email || ""
        }, { merge: true });

        setAdminTemplateName(program.name || "");
        setAdminSelectedTemplateId(program.id);
        await loadAdminTrainingTemplates();

        showAppError("savedLocal", "Программа сохранена в библиотеку.");
        return true;
      } catch (error) {
        console.error("Save month program to library error:", error);
        showAppError("firebase", "Не получилось сохранить программу в библиотеку.");
        return false;
      }
    }

    async function saveMonthWorkoutAndReturnToBlock() {
      const saved = await saveMonthProgramToLibrary();
      if (saved) handleMonthProgramBack();
    }

    async function saveMonthProgramAndOpenOverview() {
      const saved = await saveMonthProgramToLibrary();
      if (saved) openAdminProgramsOverview();
    }

    function normalizeImportedMonthlyProgram(rawProgram = {}) {
      if (rawProgram.schema && !["tren-monthly-program-v1", "tren-monthly-program-v2"].includes(rawProgram.schema)) {
        throw new Error("Неверный формат файла программы.");
      }

      const importedMonths = Array.isArray(rawProgram.months) ? rawProgram.months : [];
      const nestedMicrocycles = importedMonths.flatMap((month, monthIndex) =>
        (Array.isArray(month.microcycles) ? month.microcycles : (month.blocks || [])).map((microcycle) => ({
          ...microcycle,
          monthId: microcycle.monthId || month.id || `month_${monthIndex + 1}`
        }))
      );
      let importedMicrocycles = nestedMicrocycles.length
        ? nestedMicrocycles
        : (Array.isArray(rawProgram.blocks) ? rawProgram.blocks : []);

      if (!importedMicrocycles.length && Array.isArray(rawProgram.weeks)) {
        importedMicrocycles = Array.from(
          { length: Math.ceil(rawProgram.weeks.length / 2) },
          (_, microcycleIndex) => ({
            id: `microcycle_${microcycleIndex + 1}`,
            name: `Микроцикл ${microcycleIndex + 1}`,
            weeks: rawProgram.weeks.slice(microcycleIndex * 2, microcycleIndex * 2 + 2)
          })
        );
      }

      if (!importedMicrocycles.length) {
        throw new Error("В файле не найдены микроциклы или недели.");
      }

      const importStamp = Date.now();
      const normalizedBlocks = importedMicrocycles.map((microcycle, microcycleIndex) => {
        const weeks = Array.isArray(microcycle.weeks) ? microcycle.weeks : [];
        return {
          id: microcycle.id || `microcycle_${importStamp}_${microcycleIndex}`,
          name: String(microcycle.name || `Микроцикл ${microcycleIndex + 1}`)
            .replace(/^Блок(?=\s*\d)/i, "Микроцикл"),
          monthId: microcycle.monthId || `month_${Math.floor(microcycleIndex / 2) + 1}`,
          weeks: weeks.map((week, weekIndex) => ({
            id: week.id || `week_${importStamp}_${microcycleIndex}_${weekIndex}`,
            name: week.name || `Неделя ${microcycleIndex * 2 + weekIndex + 1}`,
            workouts: (Array.isArray(week.workouts) ? week.workouts : []).map((workout, workoutIndex) => ({
              id: workout.id || `workout_${importStamp}_${microcycleIndex}_${weekIndex}_${workoutIndex}`,
              name: workout.name || `${week.name || `Неделя ${microcycleIndex * 2 + weekIndex + 1}`} — Тренировка ${workoutIndex + 1}`,
              exercises: (Array.isArray(workout.exercises) ? workout.exercises : []).map((exercise, exerciseIndex) =>
                applyExerciseLibraryDefaults({
                  id: exercise.id || `exercise_${importStamp}_${microcycleIndex}_${weekIndex}_${workoutIndex}_${exerciseIndex}`,
                  name: exercise.name || "Упражнение",
                  video: exercise.video || exercise.videoUrl || exercise.videoURL || "",
                  requiresWeight: exercise.requiresWeight,
                  sets: Array.isArray(exercise.sets) && exercise.sets.length
                    ? exercise.sets.map((set) => ({
                        reps: set.reps ?? 8,
                        weight: String(set.weight ?? "")
                      }))
                    : [{ reps: 8, weight: "" }]
                }, adminExerciseLibrary)
              )
            }))
          }))
        };
      });
      const monthIds = normalizedBlocks
        .map((microcycle) => microcycle.monthId)
        .filter((monthId, index, items) => items.indexOf(monthId) === index);
      const months = monthIds.map((monthId, monthIndex) => {
        const sourceMonth = importedMonths.find((month, sourceMonthIndex) =>
          (month.id || `month_${sourceMonthIndex + 1}`) === monthId
        );

        return {
          id: monthId,
          name: String(sourceMonth?.name || `Месяц ${monthIndex + 1}`)
            .replace(/^Блок\s+Месяц/i, "Месяц"),
          microcycles: normalizedBlocks.filter((microcycle) => microcycle.monthId === monthId)
        };
      });

      return normalizeMonthProgram({
        id: rawProgram.id || `imported_${Date.now()}`,
        name: rawProgram.name || "Импортированная программа",
        description: rawProgram.description || "",
        rules: rawProgram.rules || {},
        months,
        blocks: normalizedBlocks
      });
    }

    function normalizeImportedExcelProgram(sheets = [], fileName = "Программа") {
      const importStamp = Date.now();
      const importedMicrocycles = [];
      const cleanCell = (value) => String(value ?? "").trim();
      const readNumber = (value, fallback) => {
        const match = cleanCell(value).replace(",", ".").match(/\d+(?:\.\d+)?/);
        const parsed = Number(match?.[0]);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      sheets.forEach((sheetEntry, sheetIndex) => {
        const sheetName = cleanCell(sheetEntry.sheet || `Лист ${sheetIndex + 1}`);
        const rows = Array.isArray(sheetEntry.data) ? sheetEntry.data : [];
        const sheetMicrocycleMatch = sheetName.match(/микроцикл\s*(\d+)/i);
        const sheetMonthMatch = sheetName.match(/месяц\s*(\d+)/i);
        const sheetWeekRangeMatch = sheetName.match(/недел(?:я|и)\s*(\d+)\s*[-–—]\s*(\d+)/i);
        const sheetWeekMatch = sheetName.match(/недел(?:я|и)\s*(\d+)/i);
        let microcycleNumber = Number(sheetMicrocycleMatch?.[1]) || 0;
        let monthNumber = Number(sheetMonthMatch?.[1]) || 0;
        let explicitWeekNumber = sheetWeekRangeMatch ? 0 : (Number(sheetWeekMatch?.[1]) || 0);
        let exerciseColumn = 0;
        let setsColumn = 1;
        let repsColumn = 2;
        let weightColumn = 3;
        let currentWorkout = null;
        const sharedWorkouts = [];
        const workoutsByWeek = new Map();

        rows.forEach((row) => {
          const cells = Array.isArray(row) ? row : [];
          const firstValue = cleanCell(cells.find((cell) => cleanCell(cell)));
          if (!firstValue) {
            currentWorkout = null;
            return;
          }

          const headerCells = cells.map((cell) => cleanCell(cell).toLocaleLowerCase("ru"));
          const exerciseHeader = headerCells.findIndex((value) => value.includes("упражнен"));
          if (exerciseHeader >= 0) {
            exerciseColumn = exerciseHeader;
            const nextSetsColumn = headerCells.findIndex((value) => value.includes("подход"));
            const nextRepsColumn = headerCells.findIndex((value) => value.includes("повтор"));
            const nextWeightColumn = headerCells.findIndex((value) => value.includes("вес"));
            if (nextSetsColumn >= 0) setsColumn = nextSetsColumn;
            if (nextRepsColumn >= 0) repsColumn = nextRepsColumn;
            if (nextWeightColumn >= 0) weightColumn = nextWeightColumn;
            return;
          }

          const monthMatch = firstValue.match(/^месяц\s*(\d+)/i);
          if (monthMatch) {
            monthNumber = Number(monthMatch[1]);
            currentWorkout = null;
            return;
          }

          const microcycleMatch = firstValue.match(/^микроцикл\s*(\d+)/i);
          if (microcycleMatch) {
            microcycleNumber = Number(microcycleMatch[1]);
            currentWorkout = null;
            return;
          }

          const weekMatch = firstValue.match(/^недел(?:я|и)\s*(\d+)/i);
          if (weekMatch) {
            explicitWeekNumber = Number(weekMatch[1]);
            currentWorkout = null;
            return;
          }

          const workoutMatch = firstValue.match(/^(?:день|тренировка)\s*(\d+)/i);
          if (workoutMatch) {
            currentWorkout = {
              dayNumber: Number(workoutMatch[1]),
              name: firstValue,
              exercises: []
            };
            if (explicitWeekNumber) {
              const weekWorkouts = workoutsByWeek.get(explicitWeekNumber) || [];
              weekWorkouts.push(currentWorkout);
              workoutsByWeek.set(explicitWeekNumber, weekWorkouts);
            } else {
              sharedWorkouts.push(currentWorkout);
            }
            return;
          }

          if (!currentWorkout) return;
          const exerciseName = cleanCell(cells[exerciseColumn]);
          if (!exerciseName) return;
          const setsCount = Math.max(1, Math.round(readNumber(cells[setsColumn], 3)));
          const reps = cleanCell(cells[repsColumn]) || "8";
          const weight = cleanCell(cells[weightColumn]);
          currentWorkout.exercises.push(applyExerciseLibraryDefaults({
            name: exerciseName,
            sets: Array.from({ length: setsCount }, () => ({ reps, weight }))
          }, adminExerciseLibrary));
        });

        const fallbackWeekStart = Math.max(1, microcycleNumber * 2 - 1 || sheetIndex * 2 + 1);
        const weekNumbers = workoutsByWeek.size
          ? [...workoutsByWeek.keys()].sort((a, b) => a - b)
          : sheetWeekRangeMatch
            ? getMicrocycleWeekNumbers(
                microcycleNumber || sheetIndex + 1,
                sheetWeekRangeMatch[1],
                sheetWeekRangeMatch[2]
              )
            : [explicitWeekNumber || fallbackWeekStart, explicitWeekNumber ? null : fallbackWeekStart + 1].filter(Boolean);

        if (!microcycleNumber) {
          microcycleNumber = Math.ceil((weekNumbers[0] || fallbackWeekStart) / 2);
        }
        if (!monthNumber) {
          monthNumber = Math.ceil(microcycleNumber / 2);
        }

        const sharedWorkoutsByWeek = distributeMicrocycleWorkouts(sharedWorkouts, weekNumbers.length);
        const weeks = weekNumbers.map((weekNumber, weekIndex) => {
          const workoutTemplates = workoutsByWeek.get(weekNumber) || sharedWorkoutsByWeek[weekIndex] || [];
          return {
            id: `week_${importStamp}_${microcycleNumber}_${weekNumber}`,
            name: `Неделя ${weekNumber}`,
            workouts: workoutTemplates.map((workout, workoutIndex) => ({
              id: `workout_${importStamp}_${microcycleNumber}_${weekNumber}_${workoutIndex}`,
              name: `Тренировка ${(weekNumber - 1) * 2 + workoutIndex + 1}`,
              exercises: workout.exercises.map((exercise, exerciseIndex) => ({
                ...exercise,
                id: `exercise_${importStamp}_${microcycleNumber}_${weekNumber}_${workoutIndex}_${exerciseIndex}`,
                sets: exercise.sets.map((set, setIndex) => ({
                  ...set,
                  id: `set_${importStamp}_${microcycleNumber}_${weekNumber}_${workoutIndex}_${exerciseIndex}_${setIndex}`
                }))
              }))
            }))
          };
        });

        if (weeks.some((week) => week.workouts.length)) {
          importedMicrocycles.push({
            id: `microcycle_${importStamp}_${microcycleNumber}`,
            name: `Микроцикл ${microcycleNumber}`,
            monthId: `month_${monthNumber}`,
            weeks
          });
        }
      });

      if (!importedMicrocycles.length) {
        throw new Error("В Excel не найдены тренировки и упражнения.");
      }

      const monthIds = importedMicrocycles
        .map((microcycle) => microcycle.monthId)
        .filter((monthId, index, items) => items.indexOf(monthId) === index);
      const months = monthIds.map((monthId) => {
        const monthNumber = Number(String(monthId).match(/\d+/)?.[0]) || 1;
        return {
          id: monthId,
          name: `Месяц ${monthNumber}`,
          microcycles: importedMicrocycles.filter((microcycle) => microcycle.monthId === monthId)
        };
      });

      return normalizeMonthProgram({
        id: `excel_${importStamp}`,
        name: fileName.replace(/\.xlsx$/i, "") || "Импортированная программа",
        description: "Импортировано из Excel",
        months,
        blocks: importedMicrocycles
      });
    }

    async function importMonthProgramFromFile(file) {
      if (!file) return;

      try {
        const isExcel = /\.xlsx$/i.test(file.name || "");
        let nextProgram;

        if (isExcel) {
          const { default: readExcelFile } = await import("read-excel-file/browser");
          const sheets = await readExcelFile(file);
          nextProgram = normalizeImportedExcelProgram(sheets, file.name);
        } else {
          const text = await file.text();
          const parsed = JSON.parse(text);
          nextProgram = normalizeImportedMonthlyProgram(parsed);
        }
        const owner = getCurrentProgramOwner();
        const importStamp = Date.now();
        nextProgram = normalizeMonthProgram({
          ...nextProgram,
          id: `imported_${importStamp}`,
          ownerUid: owner.uid,
          ownerRole: owner.role,
          createdByUid: owner.uid,
          updatedByUid: owner.uid,
          createdAt: new Date(importStamp).toISOString()
        });

        setAdminProgramEditorMode("create");
        setAdminProgramLibraryTab("editor");
        setAdminOpenWorkoutId("");
        setAdminSelectedExerciseId("");
        setAdminExerciseSearch("");
        adminExerciseEditSnapshotRef.current = null;
        setAdminOpenProgramBlocks({});
        setAdminOpenProgramWeeks({});
        setAdminActiveProgramId(nextProgram.id);
        setAdminSelectedTemplateId(nextProgram.id);
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
        setAdminTrainingTemplates((current) => [
          { ...nextProgram, workouts: flatWorkouts },
          ...current.filter((template) => template.id !== nextProgram.id)
        ]);
        const saved = await saveMonthProgramToLibrary(nextProgram);
        if (saved) {
          showAppError("savedLocal", `${isExcel ? "Excel" : "JSON"} импортирован в ваши программы.`);
        }
      } catch (error) {
        console.error("Program import error:", error);
        showAppError("load", error.message || "Не получилось импортировать программу.");
      }
    }

    function createNewMonthProgramDraft() {
      const owner = getCurrentProgramOwner();
      const nextProgram = normalizeMonthProgram({
        id: `month_${Date.now()}`,
        name: "Новая программа на месяц",
        ownerUid: owner.uid,
        ownerRole: owner.role,
        createdByUid: owner.uid,
        updatedByUid: owner.uid,
        blocks: createFourWeekWorkoutProgramBlocks(Date.now())
      });

      setAdminProgramEditorMode("create");
      setAdminProgramLibraryTab("editor");
      setAdminOpenWorkoutId("");
      setAdminOpenProgramBlocks({});
      setAdminOpenProgramWeeks({});
      setAdminActiveProgramId(nextProgram.id);
      setAdminSelectedTemplateId("");
      setAdminProgramGroups([nextProgram]);
      setPlan({
        workouts: nextProgram.blocks.flatMap((block) =>
          block.weeks.flatMap((week) =>
            week.workouts.map((workout) => ({
              ...workout,
              blockName: block.name,
              weekName: week.name
            }))
          )
        )
      });
    }

    function editExistingMonthProgram(templateId) {
      const template = adminTrainingTemplates.find((item) => item.id === templateId);

      if (!template) return;
      if (!canManageTrainingTemplate(template)) {
        showAppError("load", "У вас нет прав на редактирование этой программы.");
        return;
      }

      const templateMonths = Array.isArray(template.months) ? template.months : [];
      const nestedMicrocycles = templateMonths.flatMap((month, monthIndex) =>
        (Array.isArray(month.microcycles) ? month.microcycles : (month.blocks || [])).map((microcycle) => ({
          ...microcycle,
          monthId: microcycle.monthId || month.id || `month_${monthIndex + 1}`
        }))
      );
      const hasStructuredHierarchy = templateMonths.some((month) =>
        Array.isArray(month.microcycles) || Array.isArray(month.blocks)
      ) || (templateMonths.length > 0 && Array.isArray(template.blocks));
      const templateBlocks = nestedMicrocycles.length
        ? nestedMicrocycles
        : Array.isArray(template.blocks) && (template.blocks.length || hasStructuredHierarchy)
          ? template.blocks
          : hasStructuredHierarchy
            ? []
            : [
            {
              id: "microcycle_1",
              name: "Микроцикл 1",
              weeks: [
                { id: "week_1", name: "Неделя 1", workouts: template.workouts || [] },
                { id: "week_2", name: "Неделя 2", workouts: [] }
              ]
            },
            {
              id: "microcycle_2",
              name: "Микроцикл 2",
              weeks: [
                { id: "week_3", name: "Неделя 3", workouts: [] },
                { id: "week_4", name: "Неделя 4", workouts: [] }
              ]
            }
          ];

      const nextProgram = normalizeMonthProgram({
        id: template.id,
        name: template.name || "Программа на месяц",
        description: template.description || "",
        ownerUid: template.ownerUid || "",
        ownerRole: template.ownerRole || "",
        createdByUid: template.createdByUid || "",
        updatedByUid: template.updatedByUid || "",
        createdAt: template.createdAt,
        months: hasStructuredHierarchy ? templateMonths : undefined,
        blocks: templateBlocks
      });

      setAdminProgramEditorMode("edit");
      setAdminSelectedTemplateId(template.id);
      setAdminActiveProgramId(template.id);
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
      setAdminExerciseSearch("");
      adminExerciseEditSnapshotRef.current = null;
      setAdminOpenProgramBlocks({});
      setAdminOpenProgramWeeks({});
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

    async function refreshCurrentMonthProgram() {
      const templateId = adminActiveProgramId || adminSelectedTemplateId;
      const openWorkoutId = adminOpenWorkoutId;
      const scrollPosition = { x: window.scrollX, y: window.scrollY };
      if (!templateId) {
        showAppError("load", "Сначала сохраните программу.");
        return;
      }

      try {
        const templateSnapshot = await getDoc(doc(db, "trainingTemplates", templateId));
        if (!templateSnapshot.exists()) {
          showAppError("load", "Сохранённая программа не найдена.");
          return;
        }

        const template = { id: templateSnapshot.id, ...templateSnapshot.data() };
        const nextProgram = normalizeMonthProgram({
          id: template.id,
          name: template.name || "Программа на месяц",
          description: template.description || "",
          ownerUid: template.ownerUid || "",
          ownerRole: template.ownerRole || "",
          createdByUid: template.createdByUid || "",
          updatedByUid: template.updatedByUid || "",
          createdAt: template.createdAt,
          months: Array.isArray(template.months) ? template.months : undefined,
          blocks: Array.isArray(template.blocks) ? template.blocks : undefined
        });
        const flatWorkouts = nextProgram.blocks.flatMap((block) =>
          block.weeks.flatMap((week) =>
            (week.workouts || []).map((workout) => ({
              ...workout,
              blockName: block.name,
              weekName: week.name
            }))
          )
        );

        const refreshedOpenWorkout = openWorkoutId
          ? flatWorkouts.find((workout) => workout.id === openWorkoutId)
          : null;
        const selectedExerciseExists = refreshedOpenWorkout?.exercises?.some(
          (exercise) => exercise.id === adminSelectedExerciseId
        );

        setAdminProgramGroups([nextProgram]);
        setPlan({ workouts: flatWorkouts });
        setAdminTrainingTemplates((current) => current.map((item) =>
          item.id === template.id ? template : item
        ));
        setAdminOpenWorkoutId(refreshedOpenWorkout ? openWorkoutId : "");
        if (!refreshedOpenWorkout || (adminSelectedExerciseId && !selectedExerciseExists)) {
          setAdminSelectedExerciseId("");
          setAdminExerciseSearch("");
          adminExerciseEditSnapshotRef.current = null;
        }
        window.requestAnimationFrame(() => {
          window.scrollTo(scrollPosition.x, scrollPosition.y);
        });
        showAppError("savedLocal", "Данные программы обновлены.");
      } catch (error) {
        console.error("Refresh current program error:", error);
        showAppError("firebase", "Не получилось обновить данные программы.");
      }
    }

    function getTemplateStats(template = {}) {
      const workouts = Array.isArray(template.workouts)
        ? template.workouts
        : (
            (template.blocks || []).length
              ? template.blocks
              : (template.months || []).flatMap((month) => month.microcycles || month.blocks || [])
          ).flatMap((block) =>
            (block.weeks || []).flatMap((week) => week.workouts || [])
          );
      const templateMicrocycles = (template.blocks || []).length
        ? template.blocks
        : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);

      const exercisesCount = workouts.reduce((sum, workout) => sum + ((workout.exercises || []).length), 0);
      const weeksCount = templateMicrocycles.reduce((sum, block) => sum + ((block.weeks || []).length), 0);

      return {
        workoutsCount: workouts.length,
        exercisesCount,
        weeksCount: weeksCount || 4,
        blocksCount: templateMicrocycles.length || 1
      };
    }

    function openProgramFromLibrary(templateId) {
      if (!templateId) return;
      const template = adminTrainingTemplates.find((item) => item.id === templateId);
      if (!template || !canManageTrainingTemplate(template)) {
        showAppError("load", "У вас нет прав на редактирование этой программы.");
        return;
      }

      editExistingMonthProgram(templateId);
      setAdminProgramLibraryTab("editor");
      setAdminProgramEditorMode("edit");
    }

    async function deleteProgramFromLibrary(templateId) {
      const template = adminTrainingTemplates.find((item) => item.id === templateId);

      if (!template) return false;
      if (!canManageTrainingTemplate(template)) {
        showAppError("load", "Тренер может удалять только свои программы.");
        return false;
      }

      const confirmed = await showAppConfirm(`Удалить программу “${template.name}” из библиотеки? Это не удалит уже назначенные клиентам тренировки.`);

      if (!confirmed) return false;

      try {
        await deleteDoc(doc(db, "trainingTemplates", templateId));

        if (adminSelectedTemplateId === templateId) {
          setAdminSelectedTemplateId("");
        }

        await loadAdminTrainingTemplates();
        showAppError("savedLocal", "Программа удалена из библиотеки.");
        return true;
      } catch (error) {
        console.error("Delete program from library error:", error);
        showAppError("firebase", "Не получилось удалить программу.");
        return false;
      }
    }

    async function deleteSelectedProgramFromLibrary() {
      if (!adminSelectedTemplateId) {
        showAppError("load", "Сначала выберите программу.");
        return;
      }

      const deleted = await deleteProgramFromLibrary(adminSelectedTemplateId);
      if (deleted) {
        setAdminOpenWorkoutId("");
        setAdminProgramLibraryTab("overview");
      }
    }

    function handleMonthProgramBack() {
      if (adminSelectedExerciseId) {
        cancelMonthExerciseEdit();
        return;
      }

      if (adminOpenWorkoutId) {
        setAdminOpenWorkoutId("");
        setAdminExerciseSearch("");
        return;
      }

      if (Object.values(adminOpenProgramBlocks).some(Boolean)) {
        setAdminOpenProgramBlocks({});
        return;
      }

      openAdminProgramsOverview();
    }

    async function deleteSelectedMonthExercise() {
      if (!openMonthWorkoutContext || !adminSelectedExerciseId) {
        showAppError("load", "Сначала выберите упражнение.");
        return;
      }

      const exercise = (openMonthWorkoutContext.workout.exercises || [])
        .find((item) => item.id === adminSelectedExerciseId);
      if (!exercise) {
        showAppError("load", "Выбранное упражнение не найдено.");
        return;
      }

      if (!(await showAppConfirm(`Удалить упражнение “${exercise.name || "Без названия"}”?`))) return;

      removeMonthExercise(
        openMonthWorkoutContext.block.id,
        openMonthWorkoutContext.week.id,
        openMonthWorkoutContext.workout.id,
        exercise.id
      );
      adminExerciseEditSnapshotRef.current = null;
      setAdminSelectedExerciseId("");
    }

    async function refreshSelectedMonthExercise() {
      if (!openMonthWorkoutContext || !adminSelectedExerciseId) return;

      const templateId = adminActiveProgramId || adminSelectedTemplateId;
      if (!templateId) {
        showAppError("load", "Сначала сохраните программу.");
        return;
      }

      try {
        const templateSnapshot = await getDoc(doc(db, "trainingTemplates", templateId));
        if (!templateSnapshot.exists()) {
          showAppError("load", "Сохранённая программа не найдена.");
          return;
        }

        const template = templateSnapshot.data();
        const templateMicrocycles = Array.isArray(template.blocks)
          ? template.blocks
          : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
        const savedWorkouts = [
          ...(template.workouts || []),
          ...templateMicrocycles.flatMap((microcycle) =>
            (microcycle.weeks || []).flatMap((week) => week.workouts || [])
          )
        ];
        const savedExercise = savedWorkouts
          .find((workout) => workout.id === openMonthWorkoutContext.workout.id)
          ?.exercises?.find((exercise) => exercise.id === adminSelectedExerciseId);

        if (!savedExercise) {
          showAppError("load", "Упражнение ещё не сохранено.");
          return;
        }

        updateMonthExercise(
          openMonthWorkoutContext.block.id,
          openMonthWorkoutContext.week.id,
          openMonthWorkoutContext.workout.id,
          adminSelectedExerciseId,
          savedExercise
        );
        showAppError("savedLocal", "Данные упражнения обновлены.");
      } catch (error) {
        console.error("Refresh selected exercise error:", error);
        showAppError("firebase", "Не получилось обновить упражнение.");
      }
    }

    const programManagerView = (
      <div className={`monthProgramEditorPage monthProgramPremium${adminProgramLibraryTab === "overview" ? " monthProgramOverviewMode" : ""}${adminOpenWorkoutId ? " monthProgramPremiumDayMode" : ""}${isTrainerNextWorkspace() ? " trainerProgramManager" : ""}`}>
        <header className="programsCompactHeader">
          <button
            className="adminFixedMainBack"
            onClick={() => {
              if (adminProgramLibraryTab === "editor") {
                handleMonthProgramBack();
                return;
              }
              if (isTrainerNextWorkspace()) {
                setTrainerProgramManagerOpen(false);
                return;
              }
              setPage("admin");
            }}
            aria-label={
              adminProgramLibraryTab !== "editor"
                ? isTrainerNextWorkspace() ? "К плану клиента" : "Главная"
                : adminOpenWorkoutId
                  ? "Назад к микроциклу"
                  : Object.values(adminOpenProgramBlocks).some(Boolean)
                    ? "К списку микроциклов"
                    : "К программам"
            }
          >
            <span>←</span>
            <b>
              {adminProgramLibraryTab !== "editor"
                ? isTrainerNextWorkspace() ? "К плану клиента" : "Главная"
                : adminOpenWorkoutId
                  ? "К микроциклу"
                  : Object.values(adminOpenProgramBlocks).some(Boolean)
                    ? "К микроциклам"
                    : "К программам"}
            </b>
          </button>
          <h1>{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Программы"}</h1>
        </header>

        {adminProgramLibraryTab === "overview" ? (() => {
          const selectedTemplate = adminTrainingTemplates.find((template) => template.id === adminSelectedTemplateId);

          return (
            <main className="programsOverviewPage">
              <nav className="adminV3Nav programsTopActionBar" aria-label="Действия с программами">
                {!isTrainerNextWorkspace() && (
                  <>
                    <button type="button" onClick={() => setPage("admin")}>
                      <span className="adminV3NavIcon">←</span>
                      <span className="adminV3NavLabel">Главная</span>
                    </button>
                    <button type="button" onClick={createNewMonthProgramDraft}>
                      <span className="adminV3NavIcon">＋</span>
                      <span className="adminV3NavLabel">Создать</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={!selectedTemplate}
                  onClick={() => openProgramFromLibrary(selectedTemplate?.id)}
                >
                  {isTrainerNextWorkspace() ? <ProgramEditIcon size={19} /> : <span className="adminV3NavIcon">✎</span>}
                  <span className="adminV3NavLabel">Редактировать</span>
                </button>
                {!isTrainerNextWorkspace() && (
                  <button type="button" onClick={() => adminProgramImportInputRef.current?.click()}>
                    <span className="adminV3NavIcon">↑</span>
                    <span className="adminV3NavLabel">Загрузить</span>
                  </button>
                )}
                {isTrainerNextWorkspace() && (
                  <button
                    className="danger"
                    type="button"
                    disabled={!selectedTemplate}
                    onClick={deleteSelectedProgramFromLibrary}
                  >
                    <ProgramTrashIcon size={19} />
                    <span className="adminV3NavLabel">Удалить</span>
                  </button>
                )}
              </nav>

              <section className="programsOverviewSection">
                <div className="programsOverviewSectionHead">
                  <div>
                    <span>БИБЛИОТЕКА</span>
                    <h2>Готовые программы</h2>
                    <p>Выберите программу для просмотра и редактирования.</p>
                  </div>
                  <button type="button" onClick={loadAdminTrainingTemplates} aria-label="Обновить программы">
                    <ProgramRefreshIcon size={17} />Обновить
                  </button>
                </div>

                {adminTrainingTemplates.length === 0 ? (
                  <div className="programsOverviewEmpty">
                    <strong>{canUseAdminFeatures() ? "Пока нет готовых программ" : "У вас пока нет программ"}</strong>
                    <p>Создайте первую программу или загрузите Excel/JSON.</p>
                    <div className="programsOverviewConstructorActions">
                      {isTrainerNextWorkspace() ? (
                        <button type="button" onClick={() => setAdminProgramCreateChoiceOpen(true)}>Создать или загрузить новую программу</button>
                      ) : (
                        <>
                          <button type="button" onClick={createNewMonthProgramDraft}>Создать</button>
                          <button type="button" onClick={() => adminProgramImportInputRef.current?.click()}>Загрузить</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="programsOverviewGrid">
                    {adminTrainingTemplates.map((template) => {
                      const stats = getTemplateStats(template);
                      const isSelected = adminSelectedTemplateId === template.id;
                      const createdAt = template.createdAt ? new Date(template.createdAt) : null;
                      const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
                        ? createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
                        : "—";

                      return (
                        <button
                          className={isSelected ? "programsOverviewCard selected" : "programsOverviewCard"}
                          type="button"
                          key={template.id}
                          onClick={() => setAdminSelectedTemplateId(template.id)}
                        >
                          <div className="programsOverviewCardTitle">
                            <i><ProgramDumbbellIcon size={29} /></i>
                            <div>
                              <strong>{template.name || "Без названия"}</strong>
                              <p>{template.description || "Готовая тренировочная программа из библиотеки."}</p>
                            </div>
                            {isSelected && <span><b>✓</b>Выбрана</span>}
                          </div>
                          <div className="programsOverviewCardStats">
                            <span><ProgramCalendarIcon size={16} /><b>{stats.weeksCount}</b><small>недель</small></span>
                            <span><ProgramDumbbellIcon size={16} /><b>{stats.workoutsCount}</b><small>тренировок</small></span>
                            <span><ProgramCycleIcon size={16} /><b>{stats.blocksCount}</b><small>микроцикла</small></span>
                            <span><ProgramListIcon size={16} /><b>{stats.exercisesCount}</b><small>упражнений</small></span>
                          </div>
                          <footer><span>Создана: {createdLabel}</span><span>Автор: Вы</span><b>•••</b></footer>
                        </button>
                      );
                    })}
                    {isTrainerNextWorkspace() && (
                      <button className="programsOverviewCreateCard" type="button" onClick={() => setAdminProgramCreateChoiceOpen(true)}>
                        <ProgramPlusIcon size={21} />
                        <strong>Создать или загрузить новую программу</strong>
                        <span>Выберите: начать с нуля или импортировать готовую программу</span>
                      </button>
                    )}
                  </div>
                )}

              </section>

              {isTrainerNextWorkspace() && adminProgramCreateChoiceOpen && (
                <div className="programCreateChoiceOverlay" role="dialog" aria-modal="true" aria-labelledby="programCreateChoiceTitle" onClick={() => setAdminProgramCreateChoiceOpen(false)}>
                  <section className="programCreateChoiceSheet" onClick={(event) => event.stopPropagation()}>
                    <header>
                      <div>
                        <span>НОВАЯ ПРОГРАММА</span>
                        <h2 id="programCreateChoiceTitle">Создать или загрузить?</h2>
                      </div>
                      <button type="button" onClick={() => setAdminProgramCreateChoiceOpen(false)} aria-label="Закрыть">×</button>
                    </header>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminProgramCreateChoiceOpen(false);
                          createNewMonthProgramDraft();
                        }}
                      >
                        <ProgramPlusIcon size={22} />
                        <span><strong>Создать с нуля</strong><small>Открыть пустой конструктор программы.</small></span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminProgramCreateChoiceOpen(false);
                          adminProgramImportInputRef.current?.click();
                        }}
                      >
                        <ProgramUploadIcon size={22} />
                        <span><strong>Загрузить файл</strong><small>Импортировать готовую программу из Excel или JSON.</small></span>
                      </button>
                    </div>
                  </section>
                </div>
              )}

            </main>
          );
        })() : isTrainerNextWorkspace() ? (
          <TrainerProgramConstructor
            program={normalizedMonthProgram}
            months={monthGroups}
            activeWorkoutId={adminOpenWorkoutId}
            onSelectWorkout={(workoutId) => {
              setAdminSelectedExerciseId("");
              setAdminExerciseSearch("");
              setAdminOpenWorkoutId(workoutId);
            }}
            onProgramNameChange={updateMonthProgramName}
            onSaveProgram={saveMonthProgramToLibrary}
            onDeleteProgram={deleteSelectedProgramFromLibrary}
            onAddMonth={addProgramMonth}
            onUpdateMonth={updateProgramMonth}
            onDeleteMonth={removeProgramMonth}
            onAddCycle={addMonthBlock}
            onCopyCycle={openCopyMonthProgramBlock}
            onDeleteCycle={removeMonthBlock}
            onAddWeek={addMonthWeek}
            onDeleteWeek={removeMonthWeek}
            onAddWorkout={addMonthWorkout}
            onUpdateWorkout={updateMonthWorkout}
            onDeleteWorkout={confirmRemoveMonthWorkout}
            onDuplicateWorkout={duplicateMonthWorkout}
            onAddExercise={(blockId, weekId, workoutId, sourceExercise = null) =>
              addMonthExercise(blockId, weekId, workoutId, sourceExercise, false)
            }
            onUpdateExercise={updateMonthExercise}
            onUpdateExerciseName={updateMonthExerciseName}
            onDeleteExercise={removeMonthExercise}
            onDuplicateExercise={duplicateMonthExercise}
            onMoveExercise={moveMonthExercise}
            onUpdateExerciseSet={updateMonthExerciseSet}
            onAddExerciseSet={addMonthExerciseSet}
            onRemoveExerciseSet={removeMonthExerciseSet}
            onUploadExerciseVideo={uploadMonthExerciseVideo}
            exerciseVideoUploadingId={adminExerciseVideoUploadingId}
          />
        ) : (
          <>
            <label className="monthProgramEditorNameField">
              <span>Название программы</span>
              <input
                value={monthProgram.name || ""}
                onChange={(event) => updateMonthProgramName(event.target.value)}
                placeholder="Название программы"
              />
            </label>

            <div className="monthProgramMonths">
              {monthGroups.map((month, monthIndex) => {
                const monthHasActiveWorkout = (month.microcycles || month.blocks || []).some((block) =>
                  (block.weeks || []).some((week) =>
                    (week.workouts || []).some((workout) => workout.id === adminOpenWorkoutId)
                  )
                );

                return (
                  <section
                    className={`monthProgramMonth${monthHasActiveWorkout ? " active" : ""}`}
                    key={month.id}
                  >
                    <div className="monthProgramMonthHead">
                      <div className="monthProgramMonthTitleEditor">
                        <span>Месяц {monthIndex + 1}</span>
                        <input
                          value={month.name || `Месяц ${monthIndex + 1}`}
                          onChange={(event) => updateProgramMonth(month.id, { name: event.target.value })}
                          aria-label={`Название месяца ${monthIndex + 1}`}
                        />
                      </div>
                      <button
                        className="monthProgramRemoveMonth"
                        type="button"
                        onClick={() => removeProgramMonth(month.id)}
                        aria-label={`Удалить ${month.name || `месяц ${monthIndex + 1}`}`}
                      >
                        ×
                      </button>
                    </div>

                    <div className="monthProgramBlocks monthProgramPremiumBlocks">
              {(month.microcycles || month.blocks || []).map((block) => {
                const blockIndex = monthBlocks.findIndex((item) => item.id === block.id);
                const blockWorkouts = (block.weeks || []).flatMap((week) =>
                  (week.workouts || []).map((workout) => ({ workout, week }))
                );
                const activeWorkoutContext = blockWorkouts.find(({ workout }) => workout.id === adminOpenWorkoutId);
                const isBlockOpen = Boolean(adminOpenProgramBlocks[block.id]);
                return (
                  <div
                    className={`programEditorSwipeRow${activeWorkoutContext ? " active" : ""}${adminProgramSwipeOpenKey === `block:${block.id}` ? " delete-open" : ""}`}
                    key={block.id}
                    onPointerDown={(event) => handleAdminProgramSwipeStart(`block:${block.id}`, event)}
                    onPointerUp={(event) => handleAdminProgramSwipeEnd(`block:${block.id}`, event)}
                    onPointerCancel={(event) => handleAdminProgramSwipeCancel(`block:${block.id}`, event)}
                    onClickCapture={handleAdminProgramSwipeClick}
                  >
                    <button
                      className="programEditorSwipeDelete"
                      type="button"
                      onClick={() => removeMonthBlock(block.id)}
                      aria-label="Удалить микроцикл"
                      title="Удалить микроцикл"
                    >
                      <span aria-hidden="true">🗑</span>
                    </button>
                  <section
                    className={`programEditorSwipeContent monthProgramBlock monthProgramPremiumBlock monthProgramAccordionBlock${isBlockOpen ? " expanded" : ""}${activeWorkoutContext ? " active" : ""}`}
                  >
                    <div className="monthProgramBlockHeaderRow">
                      <button
                        className="monthProgramAccordionHead"
                        type="button"
                        aria-expanded={isBlockOpen}
                        onClick={() => toggleMonthProgramBlock(block.id)}
                      >
                        <div>
                          <strong>{block.name || `Микроцикл ${blockIndex + 1}`}</strong>
                          <span>{(block.weeks || []).length} нед.</span>
                        </div>
                        <small>{blockWorkouts.length} трен.</small>
                      </button>
                      <div className="monthProgramBlockControls">
                        <button
                          className="monthProgramCopyIcon"
                          type="button"
                          onClick={() => openCopyMonthProgramBlock(block.id)}
                          aria-label="Копировать микроцикл"
                          title="Копировать микроцикл"
                        >
                          ⧉
                        </button>
                        {isBlockOpen && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addMonthWeek(block.id);
                            }}
                          >
                            + Неделя
                          </button>
                        )}
                        <button
                          className="monthProgramHeaderToggle"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleMonthProgramBlock(block.id);
                          }}
                        >
                          {isBlockOpen ? "Свернуть" : "Раскрыть"}
                        </button>
                      </div>
                    </div>

                    {isBlockOpen && (
                      <div className="monthProgramPremiumWeeks">
                        {(block.weeks || []).map((week) => {
                          const isWeekOpen = Boolean(adminOpenProgramWeeks[week.id]);

                          return (
                          <div
                            className={`programEditorSwipeRow${adminProgramSwipeOpenKey === `week:${week.id}` ? " delete-open" : ""}`}
                            key={week.id}
                            onPointerDown={(event) => handleAdminProgramSwipeStart(`week:${week.id}`, event)}
                            onPointerUp={(event) => handleAdminProgramSwipeEnd(`week:${week.id}`, event)}
                            onPointerCancel={(event) => handleAdminProgramSwipeCancel(`week:${week.id}`, event)}
                            onClickCapture={handleAdminProgramSwipeClick}
                          >
                            <button
                              className="programEditorSwipeDelete"
                              type="button"
                              onClick={() => removeMonthWeek(block.id, week.id)}
                              aria-label="Удалить неделю"
                              title="Удалить неделю"
                            >
                              <span aria-hidden="true">🗑</span>
                            </button>
                          <article className={`programEditorSwipeContent monthProgramPremiumWeek${isWeekOpen ? " expanded" : ""}`}>
                            <div className="monthProgramPremiumWeekHead">
                              <button
                                className="weekEditorToggle"
                                type="button"
                                aria-expanded={isWeekOpen}
                                onClick={() => toggleMonthProgramWeek(week.id)}
                              >
                                <span>
                                  <strong>{week.name}</strong>
                                  <small>{(week.workouts || []).length} тренировок</small>
                                </span>
                              </button>
                              <div className="weekEditorHeadActions">
                                {isWeekOpen && (
                                  <button
                                    className="weekEditorAddDay"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      addMonthWorkout(block.id, week.id);
                                    }}
                                  >
                                    + Трен
                                  </button>
                                )}
                                <button
                                  className="weekEditorHeaderToggle"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleMonthProgramWeek(week.id);
                                  }}
                                >
                                  {isWeekOpen ? "Свернуть" : "Раскрыть"}
                                </button>
                              </div>
                            </div>
                            {isWeekOpen && (
                              <div className="monthProgramPremiumDays weekEditorDayList">
                                {(week.workouts || []).map((workout, workoutIndex) => (
                                  <div
                                    className={`programEditorSwipeRow${adminProgramSwipeOpenKey === `workout:${workout.id}` ? " delete-open" : ""}`}
                                    key={workout.id}
                                    onPointerDown={(event) => handleAdminProgramSwipeStart(`workout:${workout.id}`, event)}
                                    onPointerUp={(event) => handleAdminProgramSwipeEnd(`workout:${workout.id}`, event)}
                                    onPointerCancel={(event) => handleAdminProgramSwipeCancel(`workout:${workout.id}`, event)}
                                    onClickCapture={handleAdminProgramSwipeClick}
                                  >
                                    <button
                                      className="programEditorSwipeDelete"
                                      type="button"
                                      onClick={() => confirmRemoveMonthWorkout(block.id, week.id, workout.id)}
                                      aria-label="Удалить день"
                                      title="Удалить день"
                                    >
                                      <span aria-hidden="true">🗑</span>
                                    </button>
                                  <article className="programEditorSwipeContent weekEditorDayCard">
                                    <button
                                      className="weekEditorDayOpen"
                                      type="button"
                                      onClick={() => {
                                        setAdminSelectedExerciseId("");
                                        setAdminExerciseSearch("");
                                        setAdminOpenWorkoutId(workout.id);
                                      }}
                                    >
                                      <strong>{workout.name || `День ${workoutIndex + 1}`}</strong>
                                      <span>{(workout.exercises || []).length} упражнений</span>
                                    </button>
                                  </article>
                                  </div>
                                ))}
                                {(week.workouts || []).length === 0 && <span>Добавьте первый день тренировки</span>}
                              </div>
                            )}
                          </article>
                          </div>
                          );
                        })}
                      </div>
                    )}

                    {activeWorkoutContext && (() => {
                      const { workout, week } = activeWorkoutContext;
                      const workoutExercises = workout.exercises || [];
                      const selectedWorkoutExercise = workoutExercises.find(
                        (exercise) => exercise.id === adminSelectedExerciseId
                      );
                      const normalizedExerciseSearch = adminExerciseSearch.trim().toLocaleLowerCase("ru");
                      const exerciseSearchResults = normalizedExerciseSearch
                        ? adminExerciseLibrary
                            .filter((exercise) =>
                              String(exercise.name || "").toLocaleLowerCase("ru").includes(normalizedExerciseSearch)
                            )
                            .slice(0, 8)
                        : [];
                      const workoutDayNumber = Math.max(
                        1,
                        (week.workouts || []).findIndex((item) => item.id === workout.id) + 1
                      );

                      return (
                        <div className={`monthProgramPremiumDayEditor${selectedWorkoutExercise ? " exercise-fullscreen-open" : ""}`}>
                          <button
                            className="monthProgramPremiumBackToOverview"
                            type="button"
                            onClick={handleMonthProgramBack}
                          >
                            ← Назад к микроциклу
                          </button>
                          <div className="monthProgramPremiumDayHead">
                            <label>
                              <span>{week.name} — День {workoutDayNumber}</span>
                              <input
                                value={workout.name || ""}
                                onChange={(event) => updateMonthWorkout(block.id, week.id, workout.id, { name: event.target.value })}
                              />
                            </label>
                          </div>

                          <div className="monthExerciseSearch">
                            <input
                              value={adminExerciseSearch}
                              onChange={(event) => setAdminExerciseSearch(event.target.value)}
                              placeholder="Поиск упражнения"
                              aria-label="Поиск упражнения"
                            />
                            {normalizedExerciseSearch && (
                              <div className="monthExerciseSearchResults">
                                {exerciseSearchResults.map((exercise) => (
                                  <button
                                    type="button"
                                    key={`${exercise.name}-${exercise.video || ""}`}
                                    onClick={() => addMonthExercise(block.id, week.id, workout.id, exercise)}
                                  >
                                    <strong>{exercise.name}</strong>
                                    <span>{exercise.video ? "Видео добавлено" : "Добавить в тренировку"}</span>
                                  </button>
                                ))}
                                {exerciseSearchResults.length === 0 && (
                                  <span>Упражнение не найдено. Добавьте его кнопкой внизу.</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="monthExerciseList compact monthProgramPremiumExerciseList">
                            {workoutExercises.map((exercise, exerciseIndex) => {
                              const exerciseSets = Array.isArray(exercise.sets) && exercise.sets.length
                                ? exercise.sets
                                : [{ reps: 8, weight: "" }];
                              const exerciseRequiresWeight = exerciseUsesExternalWeight(exercise);
                              const isExerciseSelected = adminSelectedExerciseId === exercise.id;

                              const exerciseCard = (
                                <div
                                  className={`monthExerciseCard compact monthProgramPremiumExercise${isExerciseSelected ? " selected" : ""}`}
                                  key={exercise.id}
                                  data-month-exercise-id={exercise.id}
                                >
                                  {!isExerciseSelected ? (
                                    <button
                                      className="monthExerciseListItem"
                                      type="button"
                                      onClick={() => openMonthExerciseEditor(block.id, week.id, workout.id, exercise)}
                                    >
                                      <strong>{exercise.name || "Упражнение"}</strong>
                                      <span>{exerciseSets.length} подхода</span>
                                    </button>
                                  ) : (
                                    <>
                                    <nav className="exerciseEditBar" aria-label="Редактирование упражнения">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          cancelMonthExerciseEdit();
                                        }}
                                      >
                                        <span>←</span>
                                        <small>Назад</small>
                                      </button>
                                      <button className="empty" type="button" disabled aria-hidden="true" />
                                      <button className="empty" type="button" disabled aria-hidden="true" />
                                      <button
                                        className="save"
                                        type="button"
                                        disabled={adminExerciseVideoUploadingId === exercise.id}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          saveMonthExerciseEdit();
                                        }}
                                      >
                                        <span>💾</span>
                                        <small>Сохранить</small>
                                      </button>
                                    </nav>

                                    <h2 className="monthExerciseFullscreenTitle">{exercise.name || "Упражнение"}</h2>

                                    <div className="monthExerciseVideoBlock">
                                      {exercise.video ? (
                                        <video src={exercise.video} controls playsInline preload="metadata" />
                                      ) : (
                                        <span>Видео пока не загружено</span>
                                      )}
                                      <label className={exercise.video ? "monthVideoUploadBtn added" : "monthVideoUploadBtn"}>
                                        <input
                                          type="file"
                                          accept="video/*"
                                          disabled={adminExerciseVideoUploadingId === exercise.id}
                                          onChange={(event) => uploadMonthExerciseVideo(block.id, week.id, workout.id, exercise.id, event.target.files?.[0])}
                                        />
                                        {adminExerciseVideoUploadingId === exercise.id
                                          ? "Загружаю видео..."
                                          : exercise.video
                                            ? "Заменить видео"
                                            : "Загрузить видео"}
                                      </label>
                                    </div>

                                  <div className="monthProgramPremiumExerciseNumber">{exerciseIndex + 1}</div>
                                  <div className="monthExerciseRow compact">
                                    <input
                                      value={exercise.name || ""}
                                      onChange={(event) => updateMonthExerciseName(
                                        block.id,
                                        week.id,
                                        workout.id,
                                        exercise,
                                        event.target.value
                                      )}
                                      placeholder="Название упражнения"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    className={`monthExerciseWeightMode${exerciseRequiresWeight ? " active" : ""}`}
                                    aria-pressed={exerciseRequiresWeight}
                                    onClick={() => updateMonthExercise(
                                      block.id,
                                      week.id,
                                      workout.id,
                                      exercise.id,
                                      { requiresWeight: !exerciseRequiresWeight }
                                    )}
                                  >
                                    <span>⚖</span>
                                    <strong>Вес в упражнении</strong>
                                    <i>{exerciseRequiresWeight ? "Нужен" : "Не нужен"}</i>
                                  </button>

                                  <div className={`monthProgramPremiumSetLegend${exerciseRequiresWeight ? "" : " withoutWeight"}`}>
                                    <span>Подход</span><span>Повторы</span>
                                    {exerciseRequiresWeight && <span>Вес, кг</span>}
                                    <span />
                                  </div>
                                  <div className="monthExerciseSets compact">
                                    {exerciseSets.map((set, setIndex) => (
                                      <div className={`monthExerciseSetRow compact${exerciseRequiresWeight ? "" : " withoutWeight"}`} key={setIndex}>
                                        <span>{setIndex + 1}</span>
                                        <input
                                          value={set.reps || ""}
                                          onChange={(event) => updateMonthExerciseSet(block.id, week.id, workout.id, exercise.id, setIndex, { reps: event.target.value })}
                                          placeholder="8"
                                          inputMode="numeric"
                                          aria-label={`Повторы, подход ${setIndex + 1}`}
                                        />
                                        {exerciseRequiresWeight && (
                                          <input
                                            value={set.weight || ""}
                                            onChange={(event) => updateMonthExerciseSet(block.id, week.id, workout.id, exercise.id, setIndex, { weight: event.target.value })}
                                            placeholder="60"
                                            inputMode="decimal"
                                            aria-label={`Вес, подход ${setIndex + 1}`}
                                          />
                                        )}
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

                                  </>
                                  )}
                                </div>
                              );

                              return isExerciseSelected
                                ? createPortal(
                                    <div className="monthProgramPremium monthProgramPremiumDayEditor exercise-fullscreen-open monthExerciseEditorPortal">
                                      {exerciseCard}
                                    </div>,
                                    document.body,
                                    exercise.id
                                  )
                                : exerciseCard;
                            })}

                            {workoutExercises.length === 0 && (
                              <div className="monthProgramEmpty compact">В этой тренировке пока нет упражнений</div>
                            )}
                          </div>

                          <button className="monthAddExerciseBtn" onClick={() => addMonthExercise(block.id, week.id, workout.id)}>
                            + Добавить упражнение
                          </button>
                        </div>
                      );
                    })()}
                  </section>
                  </div>
                );
              })}
                    </div>
                    <button
                      className="monthProgramMonthAddBlock"
                      type="button"
                      onClick={() => addMonthBlock(month.id)}
                    >
                      + Микроцикл
                    </button>
                  </section>
                );
              })}
              <button className="monthProgramAddMonth" type="button" onClick={addProgramMonth}>
                + Добавить месяц
              </button>
            </div>

          </>
        )}

          {adminProgramCopyTarget && (
            <div className="programCopySheetBackdrop" onClick={() => setAdminProgramCopyTarget(null)}>
              <section
                className="programCopySheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="program-copy-sheet-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="programCopySheetHandle" />
                <h2 id="program-copy-sheet-title">Куда вставить копию микроцикла?</h2>

                <div className="programCopyTargetList">
                  {monthGroups.map((month, monthIndex) => (
                    <section className="programCopyTargetMonth" key={month.id}>
                      <h3>Месяц {monthIndex + 1}</h3>
                      <button
                        type="button"
                        onClick={() => copyMonthProgramBlock(adminProgramCopyTarget.blockId, month.id)}
                      >
                        В начало месяца
                      </button>
                      {(month.microcycles || month.blocks || []).map((block, blockIndex) => (
                        <button
                          type="button"
                          key={block.id}
                          onClick={() => copyMonthProgramBlock(
                            adminProgramCopyTarget.blockId,
                            month.id,
                            block.id
                          )}
                        >
                          После {block.name || `Микроцикла ${blockIndex + 1}`}
                        </button>
                      ))}
                    </section>
                  ))}
                </div>

                <div className="programCopySheetActions">
                  <button type="button" onClick={() => setAdminProgramCopyTarget(null)}>Отмена</button>
                </div>
              </section>
            </div>
          )}

          <input
            ref={adminProgramImportInputRef}
            className="programsBottomBarImportInput"
            type="file"
            accept="application/json,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
            onChange={(event) => {
              importMonthProgramFromFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {isTrainerNextWorkspace() ? null : adminSelectedExerciseId ? null : adminOpenWorkoutId && openMonthWorkoutContext ? (
            <nav className="adminV3Nav adminV3BottomBar workoutEditorBottomBar" aria-label="Редактор тренировки">
              <button type="button" onClick={handleMonthProgramBack}>
                <span className="adminV3NavIcon">←</span>
                <span className="adminV3NavLabel">К микроциклу</span>
              </button>
              <button
                type="button"
                onClick={() => addMonthExercise(
                  openMonthWorkoutContext.block.id,
                  openMonthWorkoutContext.week.id,
                  openMonthWorkoutContext.workout.id
                )}
              >
                <span className="adminV3NavIcon">＋</span>
                <span className="adminV3NavLabel">Упражнение</span>
              </button>
              <button className="workoutEditorBottomBarDelete" type="button" onClick={deleteSelectedMonthExercise}>
                <span className="adminV3NavIcon">×</span>
                <span className="adminV3NavLabel">Удалить</span>
              </button>
              <button type="button" onClick={saveMonthWorkoutAndReturnToBlock}>
                <span className="adminV3NavIcon">💾</span>
                <span className="adminV3NavLabel">Сохранить</span>
              </button>
            </nav>
          ) : adminProgramLibraryTab === "editor" ? (
            <nav className="adminV3Nav adminV3BottomBar programEditorBottomBar" aria-label="Редактор программы">
              <button type="button" onClick={openAdminProgramsOverview}>
                <span className="adminV3NavIcon">←</span>
                <span className="adminV3NavLabel">Назад</span>
              </button>
              <button type="button" onClick={refreshCurrentMonthProgram}>
                <span className="adminV3NavIcon">↻</span>
                <span className="adminV3NavLabel">Обновить</span>
              </button>
              <button className="programEditorBottomBarDelete" type="button" onClick={deleteSelectedProgramFromLibrary}>
                <span className="adminV3NavIcon">×</span>
                <span className="adminV3NavLabel">Удалить</span>
              </button>
              <button className="programEditorBottomBarSave" type="button" onClick={saveMonthProgramAndOpenOverview}>
                <span className="adminV3NavIcon">💾</span>
                <span className="adminV3NavLabel">Сохранить</span>
              </button>
            </nav>
          ) : (
            isTrainerNextWorkspace() ? null : renderTrainerWorkspaceBottomBar("programs")
          )}
      </div>
    );

    if (isTrainerNextWorkspace()) {
      const trainerName = telegramProfile.displayName ||
        auth.currentUser?.displayName ||
        auth.currentUser?.email?.split("@")?.[0] ||
        "Тренер";

      return (
        <TrainerShell
          appVersion={APP_VERSION}
          activeSection="workouts"
          onNavigate={navigateTrainerNext}
          trainerName={trainerName}
          trainerAvatar={telegramProfile.avatarUrl}
        >
          <div className="trainerNextPage trainerNextWorkoutPage trainerNextProgramsTab">
            <div className="trainerNextDesktopPageHead">
              <div>
                <h1>{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Программы тренировок"}</h1>
                <p>Создание программ и назначение клиентам</p>
              </div>
            </div>
            <header className="trainerNextMobileHeader">
              <h1>{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Библиотека программ"}</h1>
            </header>
            <div className="trainerNextPageTabs">
              <button type="button" className="active">Программы</button>
              <button type="button" onClick={openTrainerExerciseLibrary}>Библиотека упражнений</button>
            </div>
            {programManagerView}
          </div>
        </TrainerShell>
      );
    }

    return programManagerView;
  }

  if (page === "workoutPlan") {
    const sortedPlanWorkouts = sortWorkoutDays(plan.workouts || []);
    const completedPlanWorkoutSet = getCompletedWorkoutSet(history);
    const completedPlanWorkoutCount = sortedPlanWorkouts.filter((workoutItem) => (
      isWorkoutCompletedByHistory(workoutItem, completedPlanWorkoutSet)
    )).length;
    const workoutPlanWeeks = sortedPlanWorkouts.reduce((groups, workoutItem, index) => {
      const presentation = getWorkoutPresentation(workoutItem, index);
      const weekName =
        workoutItem.weekName ||
        presentation.day.split("·")[0]?.trim() ||
        "План";
      const currentGroup = groups.find((group) => group.name === weekName);
      const item = { workout: workoutItem, presentation, index };

      if (currentGroup) {
        currentGroup.items.push(item);
      } else {
        groups.push({ name: weekName, items: [item] });
      }

      return groups;
    }, []);

    return (
      <div className="workoutPlanOverviewPage">
        <main className="workoutPlanOverviewShell">
          <header className="workoutPlanOverviewHeader">
            <span>ПРОГРАММА ТРЕНЕРА</span>
            <h1>План тренировок</h1>
            <p>{plan.assignedProgramName || user?.assignedProgramName || "Индивидуальная программа"}</p>
          </header>

          <section className="workoutPlanOverviewStats">
            <div><strong>{workoutPlanWeeks.length}</strong><span>недель</span></div>
            <div><strong>{sortedPlanWorkouts.length}</strong><span>тренировок</span></div>
            <div><strong>{completedPlanWorkoutCount}</strong><span>выполнено</span></div>
          </section>

          <div className="workoutPlanWeekList">
            {workoutPlanWeeks.length ? workoutPlanWeeks.map((week) => (
              <section className="workoutPlanWeek" key={week.name}>
                <h2>{week.name}</h2>
                <div>
                  {week.items.map(({ workout: workoutItem, presentation, index }) => {
                    const completed = isWorkoutCompletedByHistory(workoutItem, completedPlanWorkoutSet);

                    return (
                      <button
                        type="button"
                        className={completed ? "completed" : ""}
                        key={workoutItem.id}
                        onClick={() => {
                          setIndividualWorkoutIndex(index);
                           setIndividualWorkoutIndexInitialized(true);
                           setSelectedWorkoutId(null);
                           setPage("workouts");
                           window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
                         }}
                      >
                        <span>
                          <small>{presentation.day}</small>
                          <strong>{presentation.title}</strong>
                          <em>{presentation.exerciseCount} упр. · {presentation.setCount} подходов</em>
                        </span>
                        <i>{completed ? "✓" : "›"}</i>
                      </button>
                    );
                  })}
                </div>
              </section>
            )) : (
              <div className="workoutPlanOverviewEmpty">
                <strong>План пока не назначен</strong>
                <span>После назначения тренером здесь появятся недели и тренировки.</span>
              </div>
            )}
          </div>
        </main>

        <div className="individualWorkoutBottomPanel workoutPlanOverviewBottomPanel">
          {renderClientTrainingBottomBar("plan")}
        </div>
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
    const completedWorkoutCount = sortedWorkouts.filter((workoutItem) => (
      isWorkoutCompletedByHistory(workoutItem, completedWorkoutSet)
    )).length;
    const activeIndividualWorkoutCompleted = isWorkoutCompletedByHistory(
      activeIndividualWorkout,
      completedWorkoutSet
    );
    const currentWorkoutUserId = (auth.currentUser || user)?.uid || "";
    const activeWorkoutDraft = currentWorkoutUserId && activeIndividualWorkout?.id
      ? safeReadJsonStorage(getWorkoutDraftKey(currentWorkoutUserId, activeIndividualWorkout.id), null)
      : null;
    const activeDraftAssignmentVersion =
      activeWorkoutDraft?.assignmentVersion ||
      activeWorkoutDraft?.assignedProgramUpdatedAt ||
      activeWorkoutDraft?.plan?.assignedProgramUpdatedAt ||
      "";
    const hasActiveWorkoutDraft = Boolean(
      activeWorkoutDraft?.workoutId === activeIndividualWorkout?.id &&
      (
        !plan.assignedProgramUpdatedAt ||
        activeDraftAssignmentVersion === plan.assignedProgramUpdatedAt
      )
    );
    const individualWorkoutProgramScope = {
      assignedProgramId: plan.assignedProgramId || activeIndividualWorkout?.assignedProgramId || "",
      assignedProgramName: plan.assignedProgramName || activeIndividualWorkout?.assignedProgramName || "История программы",
      assignedProgramUpdatedAt: plan.assignedProgramUpdatedAt || activeIndividualWorkout?.assignedProgramUpdatedAt || "",
      workoutIds: sortedWorkouts.map((workoutItem) => workoutItem.id)
    };
    const individualWorkoutHistoryItems = getProgramHistoryItems(history, individualWorkoutProgramScope).slice(0, 12);
    const formatIndividualHistoryDate = (value) => {
      const timestamp = getTimestampValue(value);
      if (!timestamp) return "Без даты";
      return new Date(timestamp).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).replace(".", "");
    };
    const activeWorkoutActionLabel = hasActiveWorkoutDraft
      ? "Продолжить тренировку"
      : activeIndividualWorkoutCompleted
        ? "Повторить тренировку"
        : "Начать тренировку";
    const activeWorkoutPendingSync = history.some((item) => (
      item?.pendingSync &&
      item?.workoutId === activeIndividualWorkout?.id &&
      (
        !plan.assignedProgramUpdatedAt ||
        item?.assignedProgramUpdatedAt === plan.assignedProgramUpdatedAt
      )
    ));

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
        direction === "previous"
          ? (currentIndex - 1 + sortedWorkouts.length) % sortedWorkouts.length
          : (currentIndex + 1) % sortedWorkouts.length;

      setIndividualWorkoutIndex(nextIndex);
      setIndividualWorkoutIndexInitialized(true);
    }

    function dismissIndividualWorkoutSwipeHint() {
      if (!individualWorkoutSwipeHintVisible) return;
      setIndividualWorkoutSwipeHintVisible(false);
      safeWriteJsonStorage(INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY, false);
    }

    function handleIndividualWorkoutSwipeStart(event) {
      if (event.pointerType === "mouse" || sortedWorkouts.length < 2) return;

      individualWorkoutSwipeStartRef.current = {
        x: event.clientX,
        y: event.clientY
      };
    }

    function handleIndividualWorkoutSwipeEnd(event) {
      const start = individualWorkoutSwipeStartRef.current;
      individualWorkoutSwipeStartRef.current = null;
      if (!start) return;

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

      individualWorkoutSwipeSuppressClickRef.current = true;
      dismissIndividualWorkoutSwipeHint();
      moveIndividualWorkout(deltaX < 0 ? "next" : "previous");
      window.setTimeout(() => {
        individualWorkoutSwipeSuppressClickRef.current = false;
      }, 180);
    }

    return (
      <div className={isIndividualWorkoutMode ? "workoutSelectPage individualWorkoutSelectPage clientCorePage clientCorePageWorkout" : "workoutSelectPage basicWorkoutSelectPage clientCorePage clientCorePageWorkout"}>
        <div className="appVersionBadge clientPageVersionBadge">{APP_VERSION}</div>
        <div className="workoutSelectHero">
          <h1 className="workoutSelectTitle clientCorePageTitle">
            <span>{isIndividualWorkoutMode ? "Индивидуальный" : "Базовые"}</span>
            <strong>{isIndividualWorkoutMode ? "план" : "тренировки"}</strong>
          </h1>

          <div className="workoutHeaderActions">
            {isIndividualWorkoutMode && (
              <button
                type="button"
                className="workoutHistoryHeaderButton"
                aria-label="Открыть историю тренировок"
                onClick={() => {
                  loadHistory();
                  setWorkoutHistoryModalOpen(true);
                }}
              >
                🕘
              </button>
            )}
            <button
              type="button"
              className="workoutModeHeaderButton"
              aria-label="Выбрать режим запуска тренировки"
              onClick={() => setWorkoutModeModalOpen(true)}
            >
              📎
            </button>
          </div>

          <p>
            {isIndividualWorkoutMode
              ? "Листай тренировки и выбирай нужную"
              : "Выбери тренировку из подобранного плана"}
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
              const completed = activeIndividualWorkoutCompleted;
              const activeNext = index === nextUncompletedWorkoutIndex;
              const item = getWorkoutPresentation(w, index);
              const fallbackImage =
                item.image ||
                workoutMenuItems[index % workoutMenuItems.length]?.image ||
                workoutMenuItems[0]?.image ||
                "";
              const coverImage = getWorkoutCover(w);
              const adjacentCoverImages = [...new Set(
                [-1, 1]
                  .map((offset) => sortedWorkouts[
                    (index + offset + sortedWorkouts.length) % sortedWorkouts.length
                  ])
                  .map(getWorkoutCover)
                  .filter((image) => image && image !== coverImage)
              )];

              return (
                <>
                <article
                  className={`workoutSelectCard individualWorkoutCardPro ${completed ? "completed" : ""} ${activeNext ? "activeNext" : ""}`}
                  key={w.id}
                  data-workout-card-id={w.id}
                  onPointerDown={handleIndividualWorkoutSwipeStart}
                  onPointerUp={handleIndividualWorkoutSwipeEnd}
                  onPointerCancel={() => {
                    individualWorkoutSwipeStartRef.current = null;
                  }}
                >
                  <span className="individualWorkoutProTop">
                    <span className="individualWorkoutBadges">
                      {completed ? (
                        <span className="individualWorkoutCompletedBadge">✓ Выполнена</span>
                      ) : hasActiveWorkoutDraft ? (
                        <span className="individualWorkoutProgressBadge">В процессе</span>
                      ) : activeNext ? (
                        <span className="individualWorkoutNextBadge">Следующая</span>
                      ) : null}
                      {activeWorkoutPendingSync && (
                        <span className="individualWorkoutSyncBadge">Ожидает синхронизации</span>
                      )}
                    </span>
                    <span className="individualWorkoutWeek">{item.day}</span>
                  </span>

                  <span className="individualWorkoutProBody">
                    <span className="individualWorkoutProInfo">
                      <span className="individualWorkoutTitle">{item.title}</span>
                      <span className="individualWorkoutAccentLine" />

                      <span className="individualWorkoutStats">
                        <span><b>🏋️</b>{item.exerciseCount} упражнений</span>
                        <span><b>▰</b>{item.setCount} подходов</span>
                        <span><b>⏱</b>{item.duration}</span>
                      </span>
                    </span>

                    <span className="individualWorkoutProImage">
                      {coverImage || fallbackImage ? (
                        <img
                          src={coverImage || fallbackImage}
                          alt=""
                          width="512"
                          height="910"
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          onError={(event) => {
                            if (!fallbackImage || event.currentTarget.dataset.fallbackApplied === "true") return;
                            event.currentTarget.dataset.fallbackApplied = "true";
                            event.currentTarget.src = fallbackImage;
                          }}
                        />
                      ) : (
                        <span className="individualWorkoutImageFallback">
                          <b>{item.title}</b>
                          <small>{w.exercises?.[0]?.name || "Персональная тренировка"}</small>
                        </span>
                      )}
                    </span>
                  </span>

                  <button
                    type="button"
                    className="individualWorkoutCardStartButton"
                    onClick={(event) => {
                      if (individualWorkoutSwipeSuppressClickRef.current) {
                        event.preventDefault();
                        return;
                      }
                      openWorkoutByIndex(index);
                    }}
                  >
                    {activeWorkoutActionLabel}
                  </button>

                </article>
                {adjacentCoverImages.map((image) => (
                  <img
                    className="individualWorkoutCoverPreload"
                    src={image}
                    alt=""
                    width="1"
                    height="1"
                    loading="eager"
                    decoding="async"
                    aria-hidden="true"
                    key={image}
                  />
                ))}
                </>
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
          <div className="individualWorkoutNav">
            <button
              type="button"
              aria-label="Предыдущая тренировка"
              onClick={() => {
                dismissIndividualWorkoutSwipeHint();
                moveIndividualWorkout("previous");
              }}
            >
              ←
            </button>

            <div className="individualWorkoutCenterNav">
              {individualWorkoutSwipeHintVisible && (
                <small className="individualWorkoutSwipeHint">
                  Свайпни, чтобы выбрать тренировку
                </small>
              )}
              <span className="individualWorkoutSwipeAffordance" aria-hidden="true">
                ‹&nbsp;&nbsp;&nbsp;›
              </span>
            </div>

            <button
              type="button"
              aria-label="Следующая тренировка"
              onClick={() => {
                dismissIndividualWorkoutSwipeHint();
                moveIndividualWorkout("next");
              }}
            >
              →
            </button>
          </div>
        )}

        <div className="individualWorkoutBottomPanel">
          {isIndividualWorkoutMode && sortedWorkouts.length > 0 && (
            <div className="individualWorkoutBottomProgress">
              <span>{activeWorkoutIndex + 1} из {sortedWorkouts.length}</span>
              <span>Выполнено {completedWorkoutCount} из {sortedWorkouts.length}</span>
            </div>
          )}
          {renderClientMainBottomBar("workouts", "individualWorkoutMenuBar")}
        </div>

        {workoutModeModalOpen && (
          <div
            className="workoutModeModalOverlay"
            role="presentation"
            onClick={() => setWorkoutModeModalOpen(false)}
          >
            <section
              className="workoutModeModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="workoutModeModalTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="workoutModeModalHeader">
                <div>
                  <small>ТРЕНИРОВКИ</small>
                  <h2 id="workoutModeModalTitle">Режим запуска</h2>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть выбор режима"
                  onClick={() => setWorkoutModeModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="workoutModeModalOptions">
                <button
                  type="button"
                  className={workoutModePreference.mode === "basic" ? "active" : ""}
                  onClick={() => {
                    setWorkoutModeModalOpen(false);
                    saveWorkoutModePreference("basic", true);
                    setSelectedWorkoutId(null);
                    setPage("basicWorkoutQuiz");
                  }}
                >
                  <span>Б</span>
                  <div>
                    <strong>Базовые тренировки</strong>
                    <small>Подбор готовой программы по цели и опыту</small>
                  </div>
                  <i>›</i>
                </button>

                <button
                  type="button"
                  className={workoutModePreference.mode === "individual" ? "active" : ""}
                  onClick={() => {
                    setWorkoutModeModalOpen(false);
                    openIndividualWorkouts();
                  }}
                >
                  <span>И</span>
                  <div>
                    <strong>Индивидуальный план</strong>
                    <small>Программа, назначенная вашим тренером</small>
                  </div>
                  <i>✓</i>
                </button>
              </div>
            </section>
          </div>
        )}

        {isIndividualWorkoutMode && workoutHistoryModalOpen && (
          <div
            className="workoutModeModalOverlay"
            role="presentation"
            onClick={() => setWorkoutHistoryModalOpen(false)}
          >
            <section
              className="workoutModeModal workoutHistoryModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="workoutHistoryModalTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="workoutModeModalHeader">
                <div>
                  <small>ИНДИВИДУАЛЬНЫЙ ПЛАН</small>
                  <h2 id="workoutHistoryModalTitle">История тренировок</h2>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть историю тренировок"
                  onClick={() => setWorkoutHistoryModalOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="workoutHistoryModalList">
                {historyLoading && <p>Загрузка истории...</p>}

                {!historyLoading && individualWorkoutHistoryItems.map((item) => (
                  <div
                    className="workoutHistoryModalItem"
                    key={item.id || `${item.date}_${item.workout}`}
                  >
                    <span aria-hidden="true">{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
                    <div>
                      <strong>{item.workout || "Тренировка"}</strong>
                      <small>
                        {formatIndividualHistoryDate(item.date)}
                        {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                      </small>
                    </div>
                  </div>
                ))}

                {!historyLoading && individualWorkoutHistoryItems.length === 0 && (
                  <p>В этой программе завершённых тренировок пока нет.</p>
                )}
              </div>

              {individualWorkoutHistoryItems.length > 0 && (
                <button
                  type="button"
                  className="workoutHistoryModalAll"
                  onClick={() => openCabinetWorkoutHistory(null, individualWorkoutProgramScope)}
                >
                  Открыть историю тренировок
                </button>
              )}
            </section>
          </div>
        )}

        {renderWorkoutDraftRestoreModal()}
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

  const shouldShowTopBackButton = isWorkoutSaved === true && !isFinishSlideActive;

  return (
    <div className={`app workoutRunPage ${workoutStarted && !isWorkoutSaved ? "workoutRunPageNoHeader" : ""}`}>
      <button
        type="button"
        className="workoutCloseButton"
        onClick={requestLeaveWorkout}
        disabled={isSaving}
        aria-label="Выйти из тренировки"
      >
        ×
      </button>

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
        const warmupSteps = getWorkoutWarmupSteps(workout);

        const exercise =
          isStartSlide || isFinishSlide
            ? null
            : currentExerciseIndex === 0
            ? warmupExercise
            : normalizeExercise(workout.exercises[currentExerciseIndex - 1]);

        const isFirstSlide = workoutStarted && currentExerciseIndex === 0;
        const exerciseVideoFailed = exercise?.id && openVideoId === `error:${exercise.id}`;
        const exerciseAiWeightAdjustments = exercise?.id && exercise.id !== "warmup"
          ? exercise.sets
              .filter((set) =>
                set.aiOriginalWeight &&
                String(set.aiOriginalWeight) !== String(set.weight)
              )
              .map((set) => `${set.aiOriginalWeight} → ${set.weight} кг`)
          : [];
        const sharedExerciseAiWeightAdjustment =
          exerciseAiWeightAdjustments.length === exercise?.sets?.length &&
          new Set(exerciseAiWeightAdjustments).size === 1
            ? exerciseAiWeightAdjustments[0]
            : "";

        const currentWorkoutSets = workout.exercises.flatMap((item) =>
          item.sets.map((set) => {
            const completed = isWorkoutSetCompleted(set);
            const weight = Number(set.enteredWeight || (set.completed ? set.weight : "")) || 0;
            const hasEnteredReps = hasWorkoutSetEntry(set.enteredReps);
            const enteredReps = Number(hasEnteredReps ? set.enteredReps : (set.completed ? set.reps : "")) || 0;
            const reps = hasEnteredReps
              ? enteredReps
              : completed
                ? Number(set.reps || 8) || 0
                : 0;

            return {
              reps,
              weight,
              completed
            };
          })
        );

        const totalSetsDone = currentWorkoutSets.filter(
          (set) => set.completed
        ).length;

        const totalVolumeDone = currentWorkoutSets.reduce(
          (sum, set) => sum + (set.weight > 0 ? set.reps * set.weight : 0),
          0
        );

        const previousSameWorkout = history.find(
          (item) => (
            (item.workoutId === workout.id || item.workout === workout.name) &&
            (
              !workout.assignedProgramUpdatedAt ||
              item.assignedProgramUpdatedAt === workout.assignedProgramUpdatedAt
            ) &&
            (
              !workoutFinishedAt ||
              new Date(item.date).getTime() < workoutFinishedAt - 1000
            )
          )
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
          item.sets?.some(isWorkoutSetCompleted)
        ).length;
        const incompleteExerciseNames = workout.exercises
          .filter((item) => !item.sets?.some(isWorkoutSetCompleted))
          .map((item) => item.name)
          .filter(Boolean);

        const sortedPlanWorkouts = sortWorkoutDays(plan.workouts || []);
        const workoutPosition = sortedPlanWorkouts.findIndex((item) => item.id === workout.id);
        const finishPresentation = getWorkoutPresentation(
          workout,
          workoutPosition >= 0 ? workoutPosition : 0
        );
        const finishDurationText =
          workoutDurationText === "0 сек"
            ? "меньше минуты"
            : workoutDurationText === "—"
              ? ""
              : workoutDurationText;
        const finishStats = [
          finishDurationText ? { label: "Время", value: finishDurationText } : null,
          completedExercisesCount > 0
            ? { label: "Упражнения", value: completedExercisesCount }
            : null,
          totalSetsDone > 0 ? { label: "Подходы", value: totalSetsDone } : null,
          totalVolumeDone > 0
            ? { label: "Объём", value: `${Math.round(totalVolumeDone).toLocaleString("ru-RU")} кг` }
            : null
        ].filter(Boolean);
        const finishProgressText =
          totalSetsDone === 0 || volumeProgress === null
            ? isWorkoutSaved
              ? "Первая точка прогресса сохранена."
              : "После сохранения это станет первой точкой прогресса."
            : volumeProgress > 0
              ? `Новый результат: объём +${volumeProgress}% к прошлой тренировке.`
              : volumeProgress === 0
                ? "Объём совпал с прошлой тренировкой."
                : `Объём ${volumeProgress}% к прошлой тренировке.`;
        const finishAdviceText =
          totalSetsDone > 0
            ? "Восстановись и оставь 1–2 повтора в запасе на следующей тренировке."
            : "В следующий раз заполни вес и повторы, чтобы видеть прогресс.";
        const finishSyncText =
          workoutHistorySyncState === "saving"
            ? "Сохранение..."
            : workoutHistorySyncState === "local"
              ? "Сохранено локально · ждёт синхронизации"
              : workoutHistorySyncState === "synced"
                ? "Синхронизировано"
                : "";
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
            className="exerciseDeck workoutStageDeck"
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

            {!isStartSlide && (
              <div className={`workoutStageTitle ${
                !isFinishSlide && exercise?.id !== "warmup" ? "withTechniqueButton" : ""
              }`}>
                <span>
                  {isFinishSlide
                    ? isWorkoutSaved
                      ? "Тренировка завершена"
                      : "Итоги тренировки"
                    : exercise?.name}
                </span>
                {!isFinishSlide && exercise?.id !== "warmup" && (
                  <button
                    type="button"
                    className="workoutTechniqueButton"
                    onClick={(event) => openWorkoutExerciseModal(
                      setExerciseTechniqueOpenId,
                      exercise.id,
                      event.currentTarget
                    )}
                    aria-label="Показать пояснение техники"
                    title="Техника выполнения"
                  >
                    i
                  </button>
                )}
              </div>
            )}

            {isStartSlide ? null : isFinishSlide ? (
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
                className={`finishSlideWrap workoutFinishScreen ${
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
                <div className="exercise exerciseSlideCard finishSummaryCard workoutFinishCard workoutStageCard">
                  <div className="workoutFinishTop">
                    <span>{isWorkoutSaved ? "Выполнена" : "Готова к сохранению"}</span>
                    <span>{finishPresentation.day}</span>
                  </div>

                  <div className="workoutFinishResult">
                    <span className="workoutFinishTrophy" aria-hidden="true">🏆</span>
                    <div>
                      <p>{isWorkoutSaved ? "Отличная работа" : "Проверь результат"}</p>
                    </div>
                  </div>

                  {finishStats.length > 0 && (
                    <div className="workoutFinishStats">
                      {finishStats.map((stat) => (
                        <div key={stat.label}>
                          <span>{stat.label}</span>
                          <strong>{stat.value}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="workoutFinishProgress">
                    <span>Прогресс</span>
                    <strong>
                      Выполнено {completedExercisesCount} из {workout.exercises.length} упражнений
                    </strong>
                    <p>{finishProgressText}</p>
                  </div>

                  {!isWorkoutSaved && incompleteExerciseNames.length > 0 && (
                    <div className="workoutFinishIncomplete">
                      <strong>Остались без данных</strong>
                      <span>{incompleteExerciseNames.slice(0, 3).join(" · ")}</span>
                    </div>
                  )}

                  {!isWorkoutSaved && (
                    <label className="workoutFinishComment">
                      <span>Комментарий тренеру</span>
                      <textarea
                        value={workoutClientComment}
                        onChange={(event) => setWorkoutClientComment(event.target.value)}
                        placeholder="Например: последний подход дался тяжело"
                        maxLength={300}
                      />
                    </label>
                  )}

                  <div className="workoutFinishTip">
                    <span aria-hidden="true">💡</span>
                    <p>{finishAdviceText}</p>
                  </div>

                  {finishSyncText && (
                    <div className={`workoutFinishSyncStatus ${workoutHistorySyncState}`}>
                      <span aria-hidden="true">
                        {workoutHistorySyncState === "local" ? "◷" : workoutHistorySyncState === "synced" ? "✓" : "•"}
                      </span>
                      {finishSyncText}
                    </div>
                  )}
                </div>
              </div>

              <div className="workoutFinishActionPanel workoutStageActionPanel">
                <div className="finishNavigationRow">
                  <button
                    type="button"
                    className="finishBackButton"
                    onClick={goToPreviousExercise}
                    disabled={isSaving}
                    aria-label="Вернуться к последнему упражнению"
                  >
                    <span>Назад</span>
                  </button>
                  <button
                    type="button"
                    className="finishWorkoutButton"
                    onClick={() => {
                      if (isWorkoutSaved) {
                        setIsWorkoutSaved(false);
                        setShowWorkoutSavedCard(false);
                        goBackToMain();
                        return;
                      }

                      saveWorkoutToFirebase(null);
                    }}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Сохраняю..."
                      : isWorkoutSaved
                      ? "Вернуться в меню"
                      : "Сохранить и завершить"}
                  </button>
                </div>
              </div>
              </>
            ) : (
              <>
              <div
                key={exercise.id}
                className={`exercise exerciseSlideCard workoutStageCard ${
                  exercise.id === "warmup" ? "warmupExerciseCard" : ""
                } ${
                  exercise.id !== "warmup" ? "workoutExerciseCard" : ""
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
                {exercise.id === "warmup" ? (
                  <header className="warmupPlanHeader">
                    <div className="warmupPlanMeta">
                      <span className="warmupPlanBadge">Подготовка</span>
                      <span className="warmupPlanWorkout">{finishPresentation.day}</span>
                    </div>
                    <span className="warmupPlanAccent" aria-hidden="true" />
                    <span className="warmupPlanSummary">
                      {warmupCompletedSteps.length} из {warmupSteps.length} шагов · около 5 минут
                    </span>
                  </header>
                ) : (
                  <>
                    <div className="workoutExerciseMeta">
                      <span>{finishPresentation.day} · Упражнение {currentExerciseIndex} из {workout.exercises.length}</span>
                      <b>{String(currentExerciseIndex).padStart(2, "0")}</b>
                    </div>

                    <div
                      className={`workoutExerciseVideoFrame ${!exercise.video || exerciseVideoFailed ? "fallback" : ""}`}
                    >
                      {exercise.video && !exerciseVideoFailed ? (
                        <>
                          <video
                            key={`${exercise.id}:${videoRetryToken}`}
                            className="exerciseVideo"
                            src={exercise.video}
                            playsInline
                            preload="auto"
                            onPointerDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            onTouchMove={(event) => event.stopPropagation()}
                            onTouchEnd={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (event.currentTarget.paused) {
                                event.currentTarget.play().catch(() => {
                                  showAppError("load", "Не получилось запустить видео упражнения.");
                                });
                              } else {
                                event.currentTarget.pause();
                              }
                            }}
                            onPlay={() => {
                              setInlinePlayingVideoId(exercise.id);
                              showInlineVideoControlsTemporarily();
                            }}
                            onPause={() => {
                              setInlinePlayingVideoId("");
                              showInlineVideoControlsTemporarily();
                            }}
                            onEnded={() => {
                              if (inlineVideoControlsTimerRef.current) {
                                window.clearTimeout(inlineVideoControlsTimerRef.current);
                                inlineVideoControlsTimerRef.current = null;
                              }
                              setInlinePlayingVideoId("");
                              setInlineVideoControlsVisible(true);
                            }}
                            onLoadStart={() => {
                              setVideoLoadingId(exercise.id);
                              startPerformanceCheck(`Video · ${exercise.name}`, { src: exercise.video });
                            }}
                            onCanPlay={() => setVideoLoadingId("")}
                            onLoadedMetadata={(event) => {
                              setVideoLoadingId("");
                              endPerformanceCheck(`Video · ${exercise.name}`, {
                                src: exercise.video,
                                duration: Math.round(Number(event.currentTarget.duration) || 0)
                              });
                            }}
                            onError={() => {
                              endPerformanceCheck(`Video · ${exercise.name}`, { src: exercise.video, error: true });
                              if (inlineVideoControlsTimerRef.current) {
                                window.clearTimeout(inlineVideoControlsTimerRef.current);
                                inlineVideoControlsTimerRef.current = null;
                              }
                              setInlinePlayingVideoId("");
                              setInlineVideoControlsVisible(true);
                              setVideoLoadingId("");
                              setOpenVideoId(`error:${exercise.id}`);
                            }}
                          />
                          {videoLoadingId === exercise.id && (
                            <span className="workoutExerciseVideoLoading">Загрузка видео...</span>
                          )}
                          {inlinePlayingVideoId !== exercise.id && (
                            <button
                              type="button"
                              className={`workoutExerciseInlinePlayButton ${inlineVideoControlsVisible ? "" : "is-hidden"}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                const video = event.currentTarget.parentElement?.querySelector("video");
                                video?.play().catch(() => {
                                  showAppError("load", "Не получилось запустить видео упражнения.");
                                });
                              }}
                              aria-label="Воспроизвести видео упражнения"
                            >
                              <span aria-hidden="true">▶</span>
                            </button>
                          )}
                          {inlinePlayingVideoId === exercise.id && (
                            <button
                              type="button"
                              className={`workoutExerciseInlinePauseButton ${inlineVideoControlsVisible ? "" : "is-hidden"}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                event.currentTarget.parentElement?.querySelector("video")?.pause();
                              }}
                              aria-label="Поставить видео на паузу"
                            >
                              <span aria-hidden="true">Ⅱ</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="workoutExerciseFullscreenButton"
                            onClick={(event) => {
                              event.stopPropagation();
                              event.currentTarget.parentElement?.querySelector("video")?.pause();
                              setFullscreenVideo(exercise.video);
                            }}
                            aria-label="Развернуть видео на весь экран"
                            title="На весь экран"
                          >
                            <span aria-hidden="true">⛶</span>
                          </button>
                        </>
                      ) : (
                        <div className="workoutExerciseVideoFallback">
                          <strong>Видео техники недоступно</strong>
                          <small>{getExerciseTechniqueHint(exercise.name)}</small>
                          {exercise.video && exerciseVideoFailed && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenVideoId(null);
                                setVideoRetryToken((current) => current + 1);
                              }}
                            >
                              Повторить загрузку
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {exercise.id === "warmup" ? (
                  <>
                  <div className="warmupExerciseHero">
                    <div className="warmupExerciseIntro">
                      <span aria-hidden="true">i</span>
                      <div>
                        <strong>Подготовь тело к нагрузке</strong>
                        <p>Разогрей суставы и подготовься к рабочим подходам.</p>
                      </div>
                    </div>

                    <div className="warmupExerciseSteps">
                      {warmupSteps.map((step, stepIndex) => {
                        const completed = warmupCompletedSteps.includes(stepIndex);

                        return (
                          <button
                            type="button"
                            className={`warmupExerciseItem ${completed ? "completed" : ""}`}
                            key={step.title}
                            onClick={() => toggleWarmupStep(stepIndex)}
                          >
                            <span aria-hidden="true">
                              {completed ? "✓" : String(stepIndex + 1).padStart(2, "0")}
                            </span>
                            <span>
                              <strong>{step.title}</strong>
                              <small>{step.description}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="warmupTimer">
                      <div>
                        <span>Таймер разминки</span>
                        <strong>{formatCompactTimer(warmupTimerSeconds)}</strong>
                      </div>
                      <div className="warmupTimerControls">
                        {[180, 300].map((seconds) => (
                          <button
                            type="button"
                            className={warmupTimerDuration === seconds ? "active" : ""}
                            key={seconds}
                            onClick={() => setWarmupTimerPreset(seconds)}
                          >
                            {seconds / 60} мин
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            if (warmupTimerSeconds <= 0) {
                              setWarmupTimerSeconds(warmupTimerDuration);
                            }
                            setWarmupTimerRunning((current) => !current);
                          }}
                        >
                          {warmupTimerRunning ? "Пауза" : warmupTimerSeconds < warmupTimerDuration ? "Продолжить" : "Старт"}
                        </button>
                      </div>
                    </div>

                  </div>
                  </>
                ) : (
                  <section className="workoutExerciseSets">
                    <div className="workoutExerciseSetsList">
                      <div
                        className={`workoutExerciseSetsHeader ${exerciseUsesExternalWeight(exercise) ? "" : "withoutWeight"}`}
                        aria-hidden="true"
                      >
                        <span />
                        <span>Повторы</span>
                        {exerciseUsesExternalWeight(exercise) && <span>Вес, кг</span>}
                      </div>
                      {exercise.sets.map((set, index) => (
                        <div
                          className={`setRow ${exerciseUsesExternalWeight(exercise) ? "" : "withoutWeight"} ${set.completed ? "completed" : ""}`}
                          key={index}
                        >
                          <button
                            type="button"
                            className="workoutExerciseSetNumber"
                            onClick={() => toggleWorkoutSetCompleted(exercise.id, index)}
                            aria-label={set.completed ? `Снять отметку с подхода ${index + 1}` : `Отметить подход ${index + 1}`}
                          >
                            {set.completed ? "✓" : String(index + 1).padStart(2, "0")}
                          </button>
                          <label className="workoutExerciseActualField">
                            <input
                              ref={(element) => {
                                setRepsInputRefs.current[`${exercise.id}:${index}`] = element;
                              }}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              aria-label={`Повторы, подход ${index + 1}`}
                              placeholder={set.reps ? `${set.reps}` : "повторы"}
                              value={set.enteredReps ?? ""}
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
                          </label>
                          {exerciseUsesExternalWeight(exercise) && (
                            <label className="workoutExerciseActualField workoutExerciseWeightField">
                              <span className="workoutExerciseWeightControls">
                                <input
                                  ref={(element) => {
                                    setWeightInputRefs.current[`${exercise.id}:${index}`] = element;
                                  }}
                                  type="text"
                                  inputMode="decimal"
                                  enterKeyHint="next"
                                  aria-label={`Вес, подход ${index + 1}`}
                                  placeholder={set.weight ? `${set.weight}` : "вес"}
                                  value={set.enteredWeight ?? ""}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onTouchStart={(event) => event.stopPropagation()}
                                  onTouchMove={(event) => event.stopPropagation()}
                                  onTouchEnd={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      setRepsInputRefs.current[`${exercise.id}:${index + 1}`]?.focus();
                                    }
                                  }}
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
                              </span>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                    {exerciseValidationMessage && (
                      <p className="workoutExerciseValidation" role="alert">
                        <span aria-hidden="true">!</span>
                        {exerciseValidationMessage}
                      </p>
                    )}
                    {sharedExerciseAiWeightAdjustment && (
                      <small className="workoutAiSharedWeightNote">
                        Коррекция готовности: {sharedExerciseAiWeightAdjustment}
                      </small>
                    )}
                  </section>
                )}

                {exercise.id !== "warmup" && (
                  <div className="workoutExerciseSupport">
                    <button
                      type="button"
                      className="previousInfo subtle"
                      onClick={() => setExerciseHistoryOpenId((current) => current === exercise.id ? "" : exercise.id)}
                    >
                      {getLastExerciseText(exercise)}
                      {exerciseHistoryOpenId === exercise.id && (
                        <small>План сейчас: {exercise.sets.length} подхода · нажми ещё раз, чтобы свернуть</small>
                      )}
                    </button>

                    <button
                      type="button"
                      className="workoutExerciseNoteButton"
                      onClick={(event) => openWorkoutExerciseModal(
                        setExerciseNoteOpenId,
                        exercise.id,
                        event.currentTarget
                      )}
                      aria-label="Открыть заметку к упражнению"
                    >
                      <span>Заметка</span>
                      <span aria-hidden="true">✎</span>
                    </button>

                    {exerciseAiWeightAdjustments.length > 0 && (
                      <div className="workoutAiAdjustHint">
                        Коррекция готовности · {workoutReadiness?.volumeText}
                      </div>
                    )}

                  </div>
                )}

                {exercise.id !== "warmup" && exerciseNoteOpenId === exercise.id && createPortal(
                  <div
                    className="workoutExerciseModalOverlay"
                    role="presentation"
                    onClick={() => closeWorkoutExerciseModal(setExerciseNoteOpenId)}
                    onTouchStart={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                    onTouchEnd={(event) => event.stopPropagation()}
                  >
                    <section
                      className="workoutExerciseModal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="workoutExerciseNoteTitle"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <header>
                        <div>
                          <small>{exercise.name}</small>
                          <h2 id="workoutExerciseNoteTitle">Заметка</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => closeWorkoutExerciseModal(setExerciseNoteOpenId)}
                          aria-label="Закрыть заметку"
                        >
                          ×
                        </button>
                      </header>
                      <textarea
                        value={exercise.clientNote || ""}
                        onChange={(event) => updateExerciseNote(exercise.id, event.target.value)}
                        placeholder="Например: уменьшить вес или проверить положение локтей"
                        maxLength={240}
                      />
                      <button
                        type="button"
                        className="workoutExerciseModalDone"
                        onClick={() => closeWorkoutExerciseModal(setExerciseNoteOpenId)}
                      >
                        Готово
                      </button>
                    </section>
                  </div>,
                  document.body
                )}

                {exercise.id !== "warmup" && exerciseTechniqueOpenId === exercise.id && createPortal(
                  <div
                    className="workoutExerciseModalOverlay"
                    role="presentation"
                    onClick={() => closeWorkoutExerciseModal(setExerciseTechniqueOpenId)}
                    onTouchStart={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                    onTouchEnd={(event) => event.stopPropagation()}
                  >
                    <section
                      className="workoutExerciseModal workoutTechniqueModal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="workoutExerciseTechniqueTitle"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <header>
                        <div>
                          <small>Техника выполнения</small>
                          <h2 id="workoutExerciseTechniqueTitle">{exercise.name}</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => closeWorkoutExerciseModal(setExerciseTechniqueOpenId)}
                          aria-label="Закрыть пояснение техники"
                        >
                          ×
                        </button>
                      </header>
                      <div className="workoutTechniqueModalContent">
                        <span aria-hidden="true">i</span>
                        <p>{getExerciseTechniqueHint(exercise.name)}</p>
                      </div>
                    </section>
                  </div>,
                  document.body
                )}

                {exercise.id !== "warmup" && restTimerSeconds > 0 && (
                  <div className="workoutRestTimer">
                    <div>
                      <span>Отдых между подходами</span>
                      <strong>{formatCompactTimer(restTimerSeconds)}</strong>
                    </div>
                    <div>
                      {[60, 90, 120].map((seconds) => (
                        <button
                          type="button"
                          className={restTimerDuration === seconds ? "active" : ""}
                          key={seconds}
                          onClick={() => startRestTimer(seconds)}
                        >
                          {seconds}
                        </button>
                      ))}
                      <button type="button" onClick={() => setRestTimerSeconds((current) => current + 30)}>
                        +30
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRestTimerRunning(false);
                          setRestTimerSeconds(0);
                        }}
                      >
                        Пропустить
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {exercise.id === "warmup" && (
                <div className="warmupBottomPanel workoutStageActionPanel">
                  <div className="warmupNavigationRow">
                    <button
                      type="button"
                      className="warmupPreviousButton"
                      onClick={requestLeaveWorkout}
                    >
                      Назад
                    </button>

                    <button
                      type="button"
                      className="warmupReadyButton"
                      onClick={() => {
                        goToNextExercise();
                      }}
                    >
                      Начать тренировку
                    </button>
                  </div>
                </div>
              )}

              {exercise.id !== "warmup" && (
                <div className="exerciseActionPanel workoutStageActionPanel">
                  <div className="exerciseNavigationRow">
                    <button
                      type="button"
                      className="exercisePrevButton"
                      onClick={() => {
                        goToPreviousExercise();
                      }}
                    >
                      Назад
                    </button>

                    <button
                      type="button"
                      className="exerciseNextButton"
                      onClick={() => {
                        goToNextExercise();
                      }}
                    >
                      {currentExerciseIndex >= workout.exercises.length
                        ? "К итогам"
                        : "Далее"}
                    </button>
                  </div>
                </div>
              )}
              </>
            )}

          </div>
        );
      })()}

      {renderWorkoutReadinessModal()}

      <WorkoutExitDialog
        open={Boolean(workoutExitPromptOpen && !workoutDraftRestorePrompt && !fullscreenVideo)}
        onStay={() => setWorkoutExitPromptOpen(false)}
        onLeave={() => {
          setWorkoutExitPromptOpen(false);
          leaveWorkoutToPlan();
        }}
      />

      <WorkoutIncompleteDialog
        open={Boolean(workoutIncompleteConfirmOpen && !fullscreenVideo)}
        completion={getWorkoutCompletion(workout)}
        onContinue={() => {
          setWorkoutIncompleteConfirmOpen(false);
          setPendingWorkoutFeedback(null);
        }}
        onSave={() => {
          const feedback = pendingWorkoutFeedback;
          setWorkoutIncompleteConfirmOpen(false);
          setPendingWorkoutFeedback(null);
          saveWorkoutToFirebase(feedback, true);
        }}
      />

      <PostWorkoutFeedbackDialog
        open={postWorkoutFeedbackOpen}
        options={POST_WORKOUT_FEEDBACK_OPTIONS}
        isSaving={isSaving}
        onSelect={(option) => {
          setPostWorkoutFeedback(option);
          setPostWorkoutFeedbackOpen(false);
          saveWorkoutToFirebase(option);
        }}
      />

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
            playsInline
            onError={() => {
              setFullscreenVideo(null);
              showAppError("load", "Видео упражнения не поддерживается или временно недоступно.");
            }}
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
