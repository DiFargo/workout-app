import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultNutritionState
} from "./data/nutritionDefaults";
import { nutritionFoodDatabase } from "./data/nutritionFoods";
import {
  AI_NUTRITION_WEEK_DAYS
} from "./data/nutritionPlanning";
import {
  getActiveTrainerTasksCount,
  getClientPaymentAttention,
  getClientPlateauInfo,
  getClientTrainerTaskDestination,
  getTrainerTaskStatus
} from "./domain/clientInsights";
import {
  getAiHistoryItems,
  getDefaultWorkoutModePreference,
  getProgramHistoryItems
} from "./domain/workoutPresentation";
import {
  makeEmptyNutritionDay,
  nutritionKeyToDate,
  shiftNutritionDateKey,
  todayNutritionKey
} from "./domain/nutritionPresentation";
import { createAiNutritionPlanHandlers } from "./features/client/nutrition/aiNutritionPlanHandlers";
import { createNutritionDayHandlers } from "./features/client/nutrition/nutritionDayHandlers";
import { createNutritionDiaryFoodHandlers } from "./features/client/nutrition/nutritionDiaryFoodHandlers";
import { createNutritionDishIngredientHandlers } from "./features/client/nutrition/nutritionDishIngredientHandlers";
import { createNutritionFoodCommitHandlers } from "./features/client/nutrition/nutritionFoodCommitHandlers";
import { createNutritionFoodEntryHandlers } from "./features/client/nutrition/nutritionFoodEntryHandlers";
import { createNutritionMyFoodsHandlers } from "./features/client/nutrition/nutritionMyFoodsHandlers";
import { createNutritionPhotoAiHandlers } from "./features/client/nutrition/nutritionPhotoAiHandlers";
import { createNutritionProductEditorHandlers } from "./features/client/nutrition/nutritionProductEditorHandlers";
import { createNutritionSelectedFoodDeleteHandlers } from "./features/client/nutrition/nutritionSelectedFoodDeleteHandlers";
import { createNutritionCloudLoader } from "./features/client/nutrition/nutritionCloudLoader";
import { useNutritionSearchEffects } from "./features/client/nutrition/useNutritionSearchEffects";
import { useNutritionRuntimeEffects } from "./features/client/nutrition/useNutritionRuntimeEffects";
import { useNutritionDayRolloverEffect } from "./features/client/nutrition/useNutritionDayRolloverEffect";
import { useNutritionPageScrollEffect } from "./features/client/nutrition/useNutritionPageScrollEffect";
import { createProfileAccountHandlers } from "./features/client/profile/profileAccountHandlers";
import { createProfileProgressHandlers } from "./features/client/profile/profileProgressHandlers";
import { createProfileTelegramHandlers } from "./features/client/profile/profileTelegramHandlers";
import { useProfileTelegramEffects } from "./features/client/profile/useProfileTelegramEffects";
import { useProfileUiEffects } from "./features/client/profile/useProfileUiEffects";
import { showAppConfirm, showAppError } from "./utils/appFeedback";
import { createPerformanceCheckHandlers } from "./utils/performanceChecks";
import { usePreventMobileZoom } from "./shared/hooks/usePreventMobileZoom";
import {
  getFoodIcon
} from "./utils/nutritionFoodPresentation";
import {
  getMyFoodsArray,
  normalizeNutritionFood
} from "./utils/nutritionFoodModel";
import {
  getAiNutritionActivityLabel,
  getAiNutritionGoalLabel
} from "./utils/aiNutritionLabels";
import {
  buildAiNutritionDayModel,
  getNutritionDayTotals
} from "./utils/aiNutritionAnalysis";
import { buildNutritionPageDerivedState } from "./utils/nutritionPageDerivedState";
import {
  buildAiNutritionMonthlyPlan,
  buildClientNutritionPresetOptions
} from "./utils/aiNutritionPlanBuilder";
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
  loadRecentNutritionFoods,
  saveRecentNutritionFood
} from "./utils/nutritionPreferenceStorage";
import {
  createEmptyAiNutritionProfileDraft,
  createEmptyTelegramProfile,
  hasRequiredAiNutritionProfileFields
} from "./utils/profileDefaults";
import { getClientTelegramProfile } from "./utils/clientTelegramProfile";
import { getPositiveNutritionNumber } from "./utils/nutritionNumbers";
import { buildProgressInsight } from "./utils/progressInsight";
import {
  formatProfileMeasurementDate,
  formatProfileProgressPhotoDate,
  getMeasurementTimestampValue,
  getProfileMeasurementDelta,
  getProfileMeasurementFields,
  getProfileMeasurementValue,
  getProfileMeasurementValueById
} from "./utils/profileMeasurements";
import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "./utils/userScopedStorage";
import {
  getCanUseAdminFeatures,
  getCanUseTrainerFeatures
} from "./utils/roleAccess";
import {
  buildPlannedWorkoutSlots,
  buildWorkoutScheduleCalendarEntries,
  buildWorkoutScheduleDraft
} from "./utils/workoutSchedule";
import {
  clearStaleWorkoutCaches
} from "./utils/workoutDraftStorage";
import {
  buildCompletedWorkoutSet,
  getWorkoutAssignmentVersion,
  isWorkoutCompletedWithSet
} from "./utils/workoutCompletion";
import { buildWorkoutPageDerivedState } from "./utils/workoutPageDerivedState";
import {
  formatHistoryCardDate,
  formatHistoryTime,
  getLastExerciseText,
  getHistorySetCount,
  getHistoryTopExercise,
  getHistoryVolume,
  getHistoryWorkoutParts
} from "./utils/workoutHistoryPresentation";
import { buildTrainerExerciseLibraryItems } from "./utils/trainerExerciseLibrary";
import { isClientE2EHarnessEnabled } from "./utils/clientHarness";
import { isTrainerE2EHarnessEnabled } from "./utils/trainerHarness";
import {
  formatTrainerSummaryDate,
  getTrainerSummaryDayStart,
  getTrainerSummaryDaysSince,
  getTrainerSummaryPeriodBounds,
  getTrainerSummaryTimestamp
} from "./utils/trainerSummaryDates";
import {
  buildTrainerClientRecentEvents,
  getClientActivityStatus,
  buildTrainerDashboardSummary,
  getTrainerClientEmptySummary,
  getTrainerClientFastSummary,
  getTrainerClientSummaryFromMap,
  getTrainerCompletedWorkoutCountForAssignment,
  getTrainerDayWord,
  getTrainerLastMeasurementAt,
  getTrainerNutritionSummary,
  getTrainerProgramCompletionPercent,
  getTrainerSettledCollectionItems,
  getTrainerSettledDocumentData,
  getTrainerSummaryReadFailures,
  getTrainerSortedHistory,
  getTrainerSortedMeasurements,
  getTrainerWorkoutActivitySummary
} from "./utils/trainerClientSummary";
import {
  buildAdminNutritionMonthOverview,
  getAdminNutritionDayMetrics,
  hasAdminWorkoutOnDate
} from "./utils/trainerNutritionInsights";
import {
  buildAdminClientNutritionStateFromRoot
} from "./utils/trainerClientMirror";
import {
  buildTrainerProgramAccessContext,
  canManageTrainerClientProgram,
  canManageTrainerTemplate,
  getTrainerProgramOwner
} from "./utils/trainerProgramAccess";
import { createAppAccessHandlers } from "./app/appAccessHandlers";
import {
  getAdminAverageNutritionScore,
  getAdminWeightPoints,
  getAdminClientChartScales,
  getAdminWorkoutProgressList
} from "./utils/adminClientProgress";
import {
  getAdminClientGoalLabel,
  getAdminClientInitials,
  getAdminMeasurementPreviewFields,
  getAdminClientProfile,
  getAdminClientTrainingDaysText
} from "./utils/adminClientProfile";
import {
  ADMIN_CALENDAR_DAYS,
  getAdminCalendarDayIdFromDate,
  getAdminCalendarTrainingDaysLabel,
  getDefaultAdminCalendar
} from "./utils/adminClientCalendar";
import {
  formatProfileWorkoutDateKey,
  formatProfileWorkoutDate,
  formatProfileWorkoutMonthKey,
  getProfileNextTrainingText,
  shiftProfileWorkoutMonthKey
} from "./utils/profileWorkoutSchedule";
import {
  normalizeClientPrimaryPage
} from "./utils/clientUx";
import { useModalFocusTrap } from "./shared/hooks/useModalFocusTrap";
import { createAuthHandlers } from "./features/auth/authHandlers";
import { createFirstSetupHandlers } from "./features/auth/firstSetupHandlers";
import {
  buildClientWorkoutsFromTemplate,
  normalizeExercise,
  sortWorkoutDays
} from "./utils/workoutPlanNormalization";
import { createWorkoutEntryNavigation } from "./features/client/workouts/workoutEntryNavigation";
import { createWorkoutHistoryHandlers } from "./features/client/workouts/workoutHistoryHandlers";
import { createWorkoutHistoryNavigation } from "./features/client/workouts/workoutHistoryNavigation";
import { createWorkoutOpenHandlers } from "./features/client/workouts/workoutOpenHandlers";
import { createWorkoutCompletionViewHelpers } from "./features/client/workouts/workoutCompletionViewHelpers";
import { createWorkoutReadinessHandlers } from "./features/client/workouts/workoutReadinessHandlers";
import { createWorkoutRunNavigationHandlers } from "./features/client/workouts/workoutRunNavigationHandlers";
import { createWorkoutRuntimeHandlers } from "./features/client/workouts/workoutRuntimeHandlers";
import { createWorkoutPersistenceHandlers } from "./features/client/workouts/workoutPersistenceHandlers";
import { useWorkoutRuntimeEffects } from "./features/client/workouts/useWorkoutRuntimeEffects";
import { saveCompletedWorkoutToFirebase } from "./features/client/workouts/workoutFirebaseSaveHandlers";
import { createTrainerClientCalendarHandlers } from "./features/trainer/trainerClientCalendarHandlers";
import { createTrainerClientHistoryHandlers } from "./features/trainer/trainerClientHistoryHandlers";
import { createTrainerClientOverviewLoader } from "./features/trainer/trainerClientOverviewLoader";
import { createTrainerClientSummaryLoader } from "./features/trainer/trainerClientSummaryLoader";
import { createTrainerCreateClientHandlers } from "./features/trainer/trainerCreateClientHandlers";
import { createClientTrainerTaskHandlers } from "./features/trainer/clientTrainerTaskHandlers";
import { createTrainerClientControlHandlers } from "./features/trainer/trainerClientControlHandlers";
import { createTrainerMessagingHandlers } from "./features/trainer/trainerMessagingHandlers";
import { createTrainerNavigationActions } from "./features/trainer/trainerNavigation";
import { createTrainerNutritionInsightHandlers } from "./features/trainer/trainerNutritionInsightHandlers";
import { createTrainerNutritionPlanHandlers } from "./features/trainer/trainerNutritionPlanHandlers";
import { createTrainerPlanEditorHandlers } from "./features/trainer/trainerPlanEditorHandlers";
import { createTrainerProgramTemplateHandlers } from "./features/trainer/trainerProgramTemplateHandlers";
import { createTrainerMonthProgramSwipeHandlers } from "./features/trainer/trainerMonthProgramSwipeHandlers";
import { useTrainerAutoLoadEffect } from "./features/trainer/useTrainerAutoLoadEffect";
import { createTrainerWorkspaceHandlers } from "./features/trainer/trainerWorkspaceHandlers";
import { createTrainerBridgeHandlers } from "./features/trainer/trainerBridgeHandlers";
import { createBottomBarActions } from "./features/client/navigation/bottomBarActions";
import { createBottomBarRenderers } from "./features/client/navigation/useBottomBarRenderers";
import { createProfileNutritionHandlers } from "./features/client/profile/profileNutritionHandlers";
import {
  createNutritionFlowMiscHandlers
} from "./features/client/nutrition/nutritionFlowMiscHandlers";
import {
  getTimestampValue
} from "./utils/auditSafety";

import { auth, db, storage } from "./firebase";

import { doc, setDoc, getDoc } from "firebase/firestore";

import * as appConfig from "./constants/appConfig";
import { APP_PAGES } from "./app/appPages";
import { preloadClientRouteChunks } from "./app/AppRouter";
import { renderAppRoutePage } from "./app/appRouteRenderer";
import {
  preloadClientTerminalRouteChunks,
  preloadTrainerRouteChunks,
  renderAppTerminalRoute
} from "./app/appTerminalRoutes";
import {
  getFirstSetupGateState,
  renderAppStartupGate
} from "./app/appStartupGate";
import { isAppRouterPage } from "./app/appRouterPages";
import RouteFallback from "./app/RouteFallback";
import { normalizeAppTheme, APP_THEMES } from "./app/appTheme";
import { isClientPrimaryPage, normalizeAppPage } from "./app/appNavigation";
import {
  createAppSessionNavigationHandlers
} from "./app/appSessionNavigationHandlers";
import { useAppBackNavigation } from "./shared/hooks/useAppBackNavigation";
import { useFirebaseSyncStatus } from "./shared/hooks/useFirebaseSyncStatus";
import { useBodyScrollLock } from "./shared/hooks/useBodyScrollLock";
import { useAppRuntimeEffects } from "./app/useAppRuntimeEffects";
import { useAuthBootstrapEffect } from "./app/useAuthBootstrapEffect";
import {
  ClientTrainingBottomBar,
} from "./shared/ui/BottomBar";

const loadWorkoutStyles = () => import("./styles/client-workout-lazy.css");
const loadClientE2EHarness = () => Promise.all([
  loadWorkoutStyles(),
  import("./components/client/ClientE2EHarness")
]).then(([, module]) => module);
const loadNutritionRoute = () => import("./features/client/nutrition/NutritionRoute");
const loadTrainerE2EHarness = () => import("./components/trainer/TrainerE2EHarness");

const ClientE2EHarness = lazy(loadClientE2EHarness);
const NutritionRoute = lazy(loadNutritionRoute);
const TrainerE2EHarness = lazy(loadTrainerE2EHarness);

const {
  ADMIN_EMAIL,
  AI_NUTRITION_PLAN_STORAGE_KEY,
  AI_NUTRITION_PROFILE_STORAGE_KEY,
  APP_THEME_STORAGE_KEY,
  APP_VERSION,
  BARCODE_SEARCH_ENABLED,
  CLIENT_LAST_PAGE_STORAGE_KEY,
  FIRST_SETUP_DONE_USER_STORAGE_KEY,
  FIRST_SETUP_REQUIRED_VERSION,
  GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY,
  INLINE_VIDEO_CONTROLS_HIDE_DELAY_MS,
  MEASUREMENTS_STORAGE_KEY,
  NUTRITION_BACKUP_STORAGE_KEY,
  NUTRITION_STORAGE_KEY,
  STORAGE_KEY,
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_PROFILE_STORAGE_KEY,
  WORKOUT_CALENDAR_STORAGE_KEY,
  WORKOUT_MODE_STORAGE_KEY,
  WORKOUT_PLAN_BACKUP_STORAGE_KEY
} = appConfig || {};

export default function App() {
  useModalFocusTrap();

  const showClientHarness = isClientE2EHarnessEnabled();
  const showTrainerHarness = isTrainerE2EHarnessEnabled();

  usePreventMobileZoom();

  if (showClientHarness) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <ClientE2EHarness />
      </Suspense>
    );
  }

  if (showTrainerHarness) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <TrainerE2EHarness />
      </Suspense>
    );
  }

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdminClaim, setIsAdminClaim] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("client");
  const [appLoading, setAppLoading] = useState(true);
  const [appTheme, setAppTheme] = useState(() => {
    try {
      return normalizeAppTheme(localStorage.getItem(APP_THEME_STORAGE_KEY));
    } catch {
      return APP_THEMES.DARK_GREEN;
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

  const {
    canUseAdminFeatures,
    canUseTrainerFeatures,
    getCurrentProgramOwner,
    getCurrentProgramAccessContext,
    canManageTrainingTemplate,
    canManageClientProgram
  } = createAppAccessHandlers({
    auth,
    user,
    isAdminClaim,
    currentUserRole,
    getCanUseAdminFeatures,
    getCanUseTrainerFeatures,
    getTrainerProgramOwner,
    buildTrainerProgramAccessContext,
    canManageTrainerTemplate,
    canManageTrainerClientProgram
  });

  const historyReplayInProgressRef = useRef(false);
  const nutritionReplayInProgressRef = useRef(false);
  const measurementReplayInProgressRef = useRef(false);

  useFirebaseSyncStatus({
    onOffline: () => {
      showAppError("offline");
    },
    onOnline: () => {
      showAppError("savedLocal", "?????????? ?????????????.");
      replayFailedHistorySaves(auth.currentUser?.uid);
      replayFailedNutritionSync(auth.currentUser?.uid);
      replayFailedMeasurementSaves(auth.currentUser?.uid);
    }
  });

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

  const [page, setPage] = useState(APP_PAGES.MAIN);
  useNutritionPageScrollEffect({ active: page === APP_PAGES.NUTRITION });
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [individualWorkoutIndex, setIndividualWorkoutIndex] = useState(0);
  const [individualWorkoutIndexInitialized, setIndividualWorkoutIndexInitialized] = useState(false);
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
  const exerciseValidationTimerRef = useRef(null);
  const partialExerciseWarningKeysRef = useRef(new Set());
  const [videoLoadingId, setVideoLoadingId] = useState("");
  const [videoRetryToken, setVideoRetryToken] = useState(0);
  const [workoutHistorySyncState, setWorkoutHistorySyncState] = useState("idle");
  const [postWorkoutFeedbackOpen, setPostWorkoutFeedbackOpen] = useState(false);
  const [postWorkoutFeedback, setPostWorkoutFeedback] = useState(null);
  const [workoutClientComment, setWorkoutClientComment] = useState("");
  const [timerTick, setTimerTick] = useState(Date.now());
  const setRepsInputRefs = useRef({});
  const setWeightInputRefs = useRef({});

  useEffect(() => () => {
    if (exerciseValidationTimerRef.current) {
      window.clearTimeout(exerciseValidationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    partialExerciseWarningKeysRef.current.clear();
  }, [selectedWorkoutId, workoutStartedAt]);

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
  const [, setAdminClientLoading] = useState(false);
  const [adminClientStatus, setAdminClientStatus] = useState("");
  const [adminClientFilter, setAdminClientFilter] = useState("all");
  const [trainerNextSection, setTrainerNextSection] = useState("dashboard");
  const [trainerProgramManagerOpen, setTrainerProgramManagerOpen] = useState(false);
  const [trainerWorkoutTab, setTrainerWorkoutTab] = useState("programs");
  const loadAdminClientOverviewRef = useRef(null);
  const loadAdminClientOverview = (...args) => {
    if (!loadAdminClientOverviewRef.current) {
      return;
    }
    return loadAdminClientOverviewRef.current(...args);
  };
  const {
    isTrainerNextWorkspace,
    navigateTrainerNext,
    openTrainerNextClient,
    openTrainerProgramManager,
    openTrainerExerciseLibrary
  } = createTrainerNavigationActions({
    canUseTrainerFeatures,
    page,
    usersList,
    setPage,
    setProfileActiveTab,
    setTrainerNextSection,
    setAdminSelectedClient,
    loadAdminClientOverview,
    setTrainerProgramManagerOpen,
    setTrainerWorkoutTab
  });
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
  const adminExerciseLibrary = trainerExerciseLibraryItems;
  const [adminTemplateName, setAdminTemplateName] = useState("");
  const [adminSelectedTemplateId, setAdminSelectedTemplateId] = useState("");
  const [adminSelectedNutritionPreset, setAdminSelectedNutritionPreset] = useState("maintenance");
  const [adminCopyTargetUserId, setAdminCopyTargetUserId] = useState("");
  const [adminTransferFromUid, setAdminTransferFromUid] = useState("");
  const [adminTransferToUid, setAdminTransferToUid] = useState("");
  const [adminTransferStatus, setAdminTransferStatus] = useState("");
  const [adminTransferLoading, setAdminTransferLoading] = useState(false);
  const [adminUsersSearch, setAdminUsersSearch] = useState("");
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
  const [adminSelectedExerciseId, setAdminSelectedExerciseId] = useState("");
  const [adminExerciseVideoUploadingId, setAdminExerciseVideoUploadingId] = useState("");
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
  const {
    handleAdminProgramSwipeCancel,
    handleAdminProgramSwipeClick,
    handleAdminProgramSwipeEnd,
    handleAdminProgramSwipeStart
  } = createTrainerMonthProgramSwipeHandlers({
    adminProgramSwipeStartRef,
    adminProgramSwipeSuppressClickRef,
    setAdminProgramSwipeOpenKey
  });
  const [, setAdminProgramEditorMode] = useState("create");
  const [adminProgramLibraryTab, setAdminProgramLibraryTab] = useState("overview");
  const [adminProgramCreateChoiceOpen, setAdminProgramCreateChoiceOpen] = useState(false);
  const [adminProgramGroups, setAdminProgramGroups] = useState([]);
  const [adminActiveProgramId, setAdminActiveProgramId] = useState("");
  const [adminActiveDayId, setAdminActiveDayId] = useState("");

  useBodyScrollLock(Boolean(adminSelectedExerciseId));

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
  const [profileWorkoutCalendarMonth, setProfileWorkoutCalendarMonth] = useState(() => formatProfileWorkoutMonthKey());
  const [profileWorkoutCalendarDate, setProfileWorkoutCalendarDate] = useState(() => formatProfileWorkoutDateKey());
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

  useBodyScrollLock(profileSettingsModalOpen || profileAvatarCropOpen, { lockHtml: true });
  useProfileUiEffects({
    cabinetWorkoutHistoryItemRefs,
    clientProgressPhotos,
    historyLength: history.length,
    historyLoading,
    openHistoryKey,
    profileProgressPhotosModalOpen,
    profileWorkoutHistoryModalOpen,
    setProfileProgressPhotoCompareIds
  });
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
  const [, setTelegramLinkCode] = useState("");
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
  const [, setNutritionEditDetailsOpen] = useState(false);
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
  const [, setBarcodeScannerError] = useState("");
  const [nutritionCloudReady, setNutritionCloudReady] = useState(false);
  const barcodeVideoRef = useRef(null);
  const nutritionPhotoInputRef = useRef(null);
  const nutritionPhotoLastFileRef = useRef(null);
  const performanceMarksRef = useRef({});
  const { startPerformanceCheck, endPerformanceCheck } = createPerformanceCheckHandlers(performanceMarksRef);

  const {
    loadHistory,
    requestDeleteOwnHistoryWorkout,
    closeHistoryDeleteConfirm,
    confirmDeleteOwnHistoryWorkout,
    handleHistoryTouchStart,
    handleHistoryTouchEnd
  } = createWorkoutHistoryHandlers({
    auth,
    db,
    historyDeleteCandidate,
    historyDeletingId,
    historySwipeId,
    historyTouchStartX,
    startPerformanceCheck,
    endPerformanceCheck,
    showAppError,
    setHistory,
    setHistoryLoading,
    setHistorySwipeId,
    setHistoryTouchStartX,
    setHistoryDeleteCandidate,
    setHistoryDeletingId,
    setOpenHistoryKey
  });

  const {
    loadNutritionFromFirebase
  } = createNutritionCloudLoader({
    db,
    NUTRITION_STORAGE_KEY,
    startPerformanceCheck,
    endPerformanceCheck,
    showAppError,
    setNutrition,
    setNutritionCloudReady
  });

  const {
    openHistory,
    openCabinetWorkoutHistory,
    toggleCabinetWorkoutHistory
  } = createWorkoutHistoryNavigation({
    APP_PAGES,
    loadHistory,
    setPage,
    setSelectedWorkoutId,
    setOpenVideoId,
    setFullscreenVideo,
    setCurrentExerciseIndex,
    setWorkoutStarted,
    setWorkoutStartedAt,
    setWorkoutFinishedAt,
    setOpenHistoryKey,
    setProfileWorkoutHistoryProgramScope,
    setProfileWorkoutHistoryModalOpen
  });

  const {
    loadWorkoutsFromFirebase,
    replayFailedHistorySaves,
    replayFailedNutritionSync,
    saveTrainerNextPlan,
    saveWorkoutsToFirebase
  } = createWorkoutPersistenceHandlers(() => ({
    STORAGE_KEY,
    WORKOUT_CALENDAR_STORAGE_KEY,
    WORKOUT_PLAN_BACKUP_STORAGE_KEY,
    auth,
    canUseAdminFeatures,
    db,
    endPerformanceCheck,
    historyReplayInProgressRef,
    loadHistory,
    normalizeExercise,
    nutritionReplayInProgressRef,
    plan,
    selectedUserId,
    setAdminClientStatus,
    setAdminSelectedClient,
    setNutrition,
    setPlan,
    setProfileWorkoutCalendarData,
    setProfileWorkoutCalendarDraftDates,
    setProfileWorkoutScheduledDates,
    setUsersList,
    setWorkoutHistorySyncState,
    showAppError,
    sortWorkoutDays,
    startPerformanceCheck
  }));



  const {
    deleteClientEverywhereFromAdminPanel,
    deleteClientFromAdminPanel,
    downloadTrainerClientExport,
    getTrainerNextCreateClientState,
    handleTrainerClientAction,
    loadUsers,
    mirrorClientForTrainer,
    recordTrainerEvent,
    saveAdminTrainerNote,
    transferClientDataBetweenAccounts,
    updateUserTrainerRole
  } = createTrainerBridgeHandlers(() => ({
    ADMIN_EMAIL,
    adminAllUsersList,
    adminClientHistory,
    adminClientMeasurements,
    adminClientNutrition,
    adminCreateClientModalOpen,
    adminCreateUserLoading,
    adminCreateUserStatus,
    adminCreatedCredentials,
    adminNewUserEmail,
    adminNewUserName,
    adminNewUserPassword,
    adminSelectedClient,
    adminTrainerNote,
    adminTransferFromUid,
    adminTransferToUid,
    auth,
    canManageClientProgram,
    canUseAdminFeatures,
    canUseTrainerFeatures,
    createUserFromAdminPanel,
    currentUserRole,
    db,
    deleteClientFromAdminPanel,
    generateAdminPassword,
    getAdminNutritionDaysList,
    loadTrainerClientSummaries,
    loadUsers,
    plan,
    recordTrainerEvent,
    saveTrainerClientNotificationSettings,
    selectedUserId,
    setAdminAllUsersList,
    setAdminClientEvents,
    setAdminCreateClientModalOpen,
    setAdminClientHistory,
    setAdminClientMeasurements,
    setAdminClientNutrition,
    setAdminClientPageOpen,
    setAdminClientProgressPhotos,
    setAdminClientStatus,
    setAdminSelectedClient,
    setAdminNewUserEmail,
    setAdminNewUserName,
    setAdminNewUserPassword,
    setAdminTransferLoading,
    setAdminTransferStatus,
    setPlan,
    setSelectedUserId,
    setTrainerClientSummariesLoading,
    setUsersList,
    showAppConfirm,
    user,
    usersList
  }));

  const {
    loadProfileMeasurements,
    loadClientProgressPhotos,
    replayFailedMeasurementSaves,
    selectClientProgressPhoto,
    saveClientProgressPhotos,
    saveProfileMeasurement
  } = createProfileProgressHandlers({
    APP_PAGES,
    MEASUREMENTS_STORAGE_KEY,
    auth,
    db,
    storage,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    measurementReplayInProgressRef,
    profileMeasurements,
    profileMeasurementDraft,
    profileMeasurementReturnTab,
    profileProgressPhotoFiles,
    recordTrainerEvent,
    showAppError,
    setAiNutritionProfile,
    setAiNutritionProfileDraft,
    setClientProgressPhotos,
    setPage,
    setProfileActiveTab,
    setProfileMeasurementDraft,
    setProfileMeasurementOpen,
    setProfileMeasurementSaving,
    setProfileMeasurements,
    setProfileMeasurementStatus,
    setProfileMeasurementWizardStep,
    setProfileProgressPhotoFiles,
    setProfileProgressPhotoPreviews,
    setProfileProgressPhotosModalOpen,
    setProfileProgressPhotoStatus,
    setProfileProgressPhotoUploading
  });

  useAuthBootstrapEffect(() => ({
    AI_NUTRITION_PLAN_STORAGE_KEY,
    AI_NUTRITION_PROFILE_STORAGE_KEY,
    APP_PAGES,
    APP_THEMES,
    CLIENT_LAST_PAGE_STORAGE_KEY,
    FIRST_SETUP_REQUIRED_VERSION,
    NUTRITION_STORAGE_KEY,
    STORAGE_KEY,
    TELEGRAM_PROFILE_STORAGE_KEY,
    WORKOUT_CALENDAR_STORAGE_KEY,
    WORKOUT_MODE_STORAGE_KEY,
    auth,
    createEmptyAiNutritionProfileDraft,
    createEmptyTelegramProfile,
    db,
    defaultNutritionState,
    endPerformanceCheck,
    getDefaultWorkoutModePreference,
    hasRequiredAiNutritionProfileFields,
    loadClientProgressPhotos,
    loadClientTrainerTasks,
    loadHistory,
    loadNutritionFromFirebase,
    loadProfileMeasurements,
    loadRecentNutritionFoods,
    loadWorkoutsFromFirebase,
    normalizeAppPage,
    normalizeClientPrimaryPage,
    refreshTelegramAvatar,
    replayFailedHistorySaves,
    replayFailedMeasurementSaves,
    replayFailedNutritionSync,
    safeReadUserJsonStorage,
    safeWriteUserJsonStorage,
    setAiNutritionProfile,
    setAiNutritionProfileDraft,
    setAiNutritionSavedPlan,
    setAppLoading,
    setAppTheme,
    setAppThemeCloudReady,
    setClientProgressPhotos,
    setCurrentUserRole,
    setFirstSetupCompletedInCloud,
    setFirstSetupCompletedInSession,
    setFirstSetupProfileHydrated,
    setIsAdminClaim,
    setIsLoggedIn,
    setNutrition,
    setNutritionCloudReady,
    setOnboardingStep,
    setPage,
    setPlan,
    setProfileAccount,
    setProfileAccountAvatarFile,
    setProfileAccountAvatarPreview,
    setProfileAccountDraft,
    setProfileAccountStatus,
    setProfileMeasurements,
    setProfileWorkoutCalendarData,
    setProfileWorkoutCalendarDraftDates,
    setProfileWorkoutCalendarEditing,
    setProfileWorkoutCalendarStatus,
    setProfileWorkoutScheduledDates,
    setRecentNutritionFoods,
    setShowFirstSetupOnboarding,
    setTelegramConnectOpen,
    setTelegramDraft,
    setTelegramProfile,
    setTelegramStatus,
    setUser,
    setWorkoutModePreference,
    setWorkoutModeRemember,
    startPerformanceCheck
  }));

  useAppRuntimeEffects({
    APP_PAGES,
    appLoading,
    appTheme,
    appThemeCloudReady,
    currentUserRole,
    db,
    firstSetupCompletedInCloud,
    firstSetupCompletedInSession,
    firstSetupDoneUserStorageKey: FIRST_SETUP_DONE_USER_STORAGE_KEY,
    firstSetupProfileHydrated,
    firstSetupRequiredVersion: FIRST_SETUP_REQUIRED_VERSION,
    isAdminClaim,
    isClientPrimaryPage,
    isLoggedIn,
    page,
    plan,
    user,
    appThemeStorageKey: APP_THEME_STORAGE_KEY,
    clientLastPageStorageKey: CLIENT_LAST_PAGE_STORAGE_KEY,
    workoutPlanBackupStorageKey: WORKOUT_PLAN_BACKUP_STORAGE_KEY,
    workoutStorageKey: STORAGE_KEY,
    aiNutritionProfile,
    hasRequiredAiNutritionProfileFields,
    normalizeAppPage,
    setAppTheme,
    setAppThemeCloudReady,
    setPage,
    setSelectedUserId,
    setShowFirstSetupOnboarding
  });

  useEffect(() => {
    if (!isLoggedIn || appLoading) return undefined;

    const preloadClientScreens = () => {
      if (currentUserRole === "client") {
        preloadClientRouteChunks();
        preloadClientTerminalRouteChunks();
        loadNutritionRoute().catch((error) => console.warn("Nutrition preload error", error));
        return;
      }

      if (isAdminClaim || currentUserRole === "admin" || currentUserRole === "trainer") {
        preloadTrainerRouteChunks();
      }
    };

    const preloadTimerId = window.setTimeout(preloadClientScreens, 0);
    return () => window.clearTimeout(preloadTimerId);
  }, [appLoading, currentUserRole, isAdminClaim, isLoggedIn]);

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

  useAppBackNavigation({
    isLoggedIn,
    appLoading,
    page,
    hasTransientScreen,
    isPrimaryPage: isClientPrimaryPage,
    handleTransientBack: () => handleAppBackNavigation(),
    restorePrimaryPage: (targetPage) => {
      setPage(normalizeAppPage(targetPage));
    }
  });

  useNutritionSearchEffects({
    dishIngredientPickerOpen,
    dishIngredientSearch,
    nutrition,
    nutritionPickerOpen,
    nutritionSearch,
    nutritionSearchTab,
    endPerformanceCheck,
    showAppError,
    startPerformanceCheck,
    setDishIngredientExternalFoods,
    setDishIngredientFallbackSuggestions,
    setDishIngredientLoading,
    setFatSecretError,
    setFatSecretFoods,
    setFatSecretLoading,
    setNutritionFallbackSuggestions
  });

  useNutritionRuntimeEffects({
    auth,
    barcodeScannerOpen,
    barcodeSearchEnabled: BARCODE_SEARCH_ENABLED,
    barcodeVideoRef,
    nutrition,
    nutritionCloudReady,
    nutritionStorageKey: NUTRITION_STORAGE_KEY,
    nutritionBackupStorageKey: NUTRITION_BACKUP_STORAGE_KEY,
    nutritionUndoTimerRef,
    user,
    addNutritionFoodFromPicker: (...args) => addNutritionFoodFromPicker(...args),
    findFoodByBarcode: (...args) => findFoodByBarcode(...args),
    showAppError,
    setBarcodeScannerError,
    setBarcodeScannerOpen,
    setNutritionBarcode
  });

  useTrainerAutoLoadEffect({
    currentUserRole,
    isAdminClaim,
    page,
    user,
    canUseTrainerFeatures,
    loadAdminTrainingTemplates: () => loadAdminTrainingTemplates(),
    loadUsers: () => loadUsers()
  });

  const {
    workout,
    workoutVideoUrls,
    workoutVideoCacheKey,
    workoutDurationText,
    lastExerciseResults
  } = useMemo(
    () => buildWorkoutPageDerivedState({
      plan,
      selectedWorkoutId,
      history,
      workoutStartedAt,
      workoutFinishedAt,
      timerTick
    }),
    [plan, selectedWorkoutId, history, workoutStartedAt, workoutFinishedAt, timerTick]
  );

  const {
    getCompletedWorkoutSet,
    isWorkoutCompletedByHistory
  } = createWorkoutCompletionViewHelpers({
    plan,
    history,
    workoutCalendar: profileWorkoutCalendarData,
    buildCompletedWorkoutSet,
    getWorkoutAssignmentVersion,
    isWorkoutCompletedWithSet
  });

  useWorkoutRuntimeEffects({
    auth,
    currentExerciseIndex,
    inlineVideoControlsTimerRef,
    plan,
    postWorkoutFeedback,
    restTimerDuration,
    restTimerRunning,
    restTimerSeconds,
    selectedWorkoutId,
    timerTickRef,
    user,
    warmupCompletedSteps,
    warmupTimerDuration,
    warmupTimerRunning,
    warmupTimerSeconds,
    workout,
    workoutFinishedAt,
    workoutReadiness,
    workoutStarted,
    workoutStartedAt,
    workoutVideoCacheKey,
    setExerciseHistoryOpenId,
    setExerciseNoteOpenId,
    setExerciseTechniqueOpenId,
    setExerciseValidationMessage,
    setCurrentExerciseIndex,
    setInlinePlayingVideoId,
    setInlineVideoControlsVisible,
    setRestTimerRunning,
    setRestTimerSeconds,
    setTimerTick,
    setVideoLoadingId,
    setWarmupTimerRunning,
    setWarmupTimerSeconds
  });

  const {
    handleLogin,
    handleLoginPasswordReset,
    handleRegister
  } = createAuthHandlers({
    APP_PAGES,
    auth,
    db,
    login,
    password,
    loginSubmitting,
    passwordResetSending,
    setLoginFieldErrors,
    setLoginError,
    setLoginNotice,
    setLoginSubmitting,
    setPasswordResetSending,
    setPage,
    setSelectedUserId,
    loadHistory,
    loadWorkoutsFromFirebase
  });

  const nutritionDateKey = selectedNutritionDateKey;

  useNutritionDayRolloverEffect({
    nutritionDateKey,
    setExpandedNutritionMeals,
    setNutritionCalendarMonthKey,
    setSelectedNutritionDateKey
  });

  const {
    isNutritionToday,
    nutritionToday,
    nutritionTotals,
    nutritionSearchResults,
    nutritionSearchResultKey,
    activeNutritionSearchResultLimit,
    nutritionWeekDates,
    nutritionCurrentStreak,
    nutritionCalendarDays,
    nutritionCalendarMonthLabel
  } = useMemo(() => {
    return buildNutritionPageDerivedState({
      nutrition,
      nutritionSearch,
      nutritionSearchTab,
      fatSecretFoods,
      nutritionSearchResultLimit,
      nutritionCalendarMonthKey,
      nutritionDateKey
    });
  }, [
    nutrition,
    nutritionSearch,
    nutritionSearchTab,
    fatSecretFoods,
    nutritionSearchResultLimit,
    nutritionCalendarMonthKey,
    nutritionDateKey
  ]);
  const visibleNutritionSearchResults = useMemo(
    () => nutritionSearchResults.slice(0, activeNutritionSearchResultLimit),
    [nutritionSearchResults, activeNutritionSearchResultLimit]
  );

  const {
    selectNutritionDate,
    openNutritionCalendar,
    shiftNutritionCalendarMonth,
    updateNutritionDay,
    toggleNutritionFavorite,
    addWater,
    updateBodyWeight,
    findFoodByBarcode,
    recognizePhotoFood
  } = createNutritionDayHandlers({
    nutritionBarcode,
    nutritionDateKey,
    nutritionFoodDatabase,
    nutritionPhotoName,
    addNutritionFood: (...args) => addNutritionFood(...args),
    setExpandedNutritionMeals,
    setNutrition,
    setNutritionBarcode,
    setNutritionCalendarMonthKey,
    setNutritionCalendarOpen,
    setNutritionSearch,
    setSelectedNutritionDateKey
  });

  const {
    savePersonalMyFoodsToFirebase,
    removeMyNutritionFood
  } = createNutritionMyFoodsHandlers({
    GLOBAL_MY_FOODS_BACKUP_STORAGE_KEY,
    NUTRITION_BACKUP_STORAGE_KEY,
    NUTRITION_STORAGE_KEY,
    auth,
    user,
    nutrition,
    showAppError,
    setNutrition,
    setRecentNutritionFoods
  });

  const {
    openNutritionCreateProductFromPhoto,
    returnToNutritionMainAfterAdd,
    addFoodByBarcodeFromPicker
  } = createNutritionFlowMiscHandlers({
    APP_PAGES,
    nutritionBarcode,
    nutritionFoodDatabase,
    addNutritionFoodFromPicker: (...args) => addNutritionFoodFromPicker(...args),
    getFoodIcon,
    getPositiveNutritionNumber,
    normalizeNutritionFood,
    resetNutritionPhotoAiState: () => resetNutritionPhotoAiState(),
    setBarcodeScannerError,
    setBarcodeScannerOpen,
    setEditingNutritionItemId,
    setExpandedNutritionMeals,
    setFatSecretError,
    setNutritionAmount,
    setNutritionAmountMode,
    setNutritionBarcode,
    setNutritionCreateChoiceOpen,
    setNutritionEditDetailsOpen,
    setNutritionEditNote,
    setNutritionEditOriginalFood,
    setNutritionEditOriginalNote,
    setNutritionEditPageOpen,
    setNutritionFallbackSuggestions,
    setNutritionMealMenuOpen,
    setNutritionPhotoAiCandidates,
    setNutritionPhotoAiConfidence,
    setNutritionPhotoAiResult,
    setNutritionPickerOpen,
    setNutritionSearch,
    setNutritionSearchTab,
    setPage,
    setSelectedNutritionFood,
    setShowRecentNutritionFoods
  });

  const {
    addNutritionFood,
    updateNutritionFood,
    confirmNutritionFoodFromPicker
  } = createNutritionFoodCommitHandlers({
    editingNutritionItemId,
    nutritionAmount,
    nutritionAmountMode,
    nutritionEditNote,
    nutritionMeal,
    selectedNutritionFood,
    addNutritionFoodToDay: (item) => updateNutritionDay((day) => ({
      ...day,
      foods: [item, ...(day.foods || [])]
    })),
    returnToNutritionMainAfterAdd,
    savePersonalMyFoodsToFirebase,
    showAppError,
    updateNutritionDay,
    setEditingNutritionItemId,
    setExpandedNutritionMeals,
    setNutrition,
    setNutritionAmountError,
    setNutritionEditNote,
    setRecentNutritionFoods
  });

  const {
    createCustomNutritionFood,
    createCustomNutritionDish,
    addNutritionFoodFromPicker,
    updateSelectedNutritionFoodField,
    updateSelectedNutritionPortionUnit,
    openNutritionEditPage,
    cancelNutritionEditPage,
    confirmNutritionEditPage,
    closeSelectedNutritionFood
  } = createNutritionProductEditorHandlers({
    nutrition,
    nutritionEditNote,
    nutritionEditOriginalFood,
    nutritionEditOriginalNote,
    selectedNutritionFood,
    showAppError,
    setEditingNutritionItemId,
    setFatSecretError,
    setNutritionAmount,
    setNutritionAmountError,
    setNutritionAmountMode,
    setNutritionCreateChoiceOpen,
    setNutritionEditDetailsOpen,
    setNutritionEditNote,
    setNutritionEditOriginalFood,
    setNutritionEditOriginalNote,
    setNutritionEditPageOpen,
    setNutritionFallbackSuggestions,
    setNutritionMealMenuOpen,
    setNutritionPickerOpen,
    setNutritionProductErrors,
    setNutritionSearchTab,
    setSelectedNutritionFood,
    setShowRecentNutritionFoods
  });

  const {
    updateSelectedDishTotalWeight,
    openDishIngredientPicker,
    addSelectedDishIngredientFromFood,
    removeSelectedDishIngredient
  } = createNutritionDishIngredientHandlers({
    setDishIngredientPickerOpen,
    setDishIngredientSearch,
    setNutritionProductErrors,
    setSelectedNutritionFood
  });

  const {
    canDeleteSelectedNutritionFood,
    deleteSelectedNutritionFood
  } = createNutritionSelectedFoodDeleteHandlers({
    editingNutritionItemId,
    nutrition,
    selectedNutritionFood,
    removeMyNutritionFood,
    removeNutritionFood: (...args) => removeNutritionFood(...args),
    setEditingNutritionItemId,
    setNutritionAmount,
    setNutritionDeleteConfirmOpen,
    setNutritionEditDetailsOpen,
    setNutritionEditNote,
    setNutritionEditPageOpen,
    setNutritionMealMenuOpen,
    setNutritionPickerOpen,
    setNutritionSearch,
    setNutritionSearchTab,
    setSelectedNutritionFood,
    setShowRecentNutritionFoods
  });

  const {
    openNutritionPicker,
    openNutritionFoodEditor
  } = createNutritionFoodEntryHandlers({
    resetNutritionPhotoAiState: () => resetNutritionPhotoAiState(),
    setEditingNutritionItemId,
    setNutritionAmount,
    setNutritionAmountError,
    setNutritionAmountMode,
    setNutritionCreateChoiceOpen,
    setNutritionEditDetailsOpen,
    setNutritionEditNote,
    setNutritionFallbackSuggestions,
    setNutritionMeal,
    setNutritionMealMenuOpen,
    setNutritionPickerOpen,
    setNutritionProductErrors,
    setNutritionSearch,
    setNutritionSearchTab,
    setRecentNutritionFoods,
    setSelectedNutritionFood,
    setShowRecentNutritionFoods
  });

  const {
    removeNutritionFood,
    restoreNutritionFood,
    handleNutritionFoodSwipeStart,
    handleNutritionFoodSwipeMove,
    handleNutritionFoodSwipeEnd,
    handleNutritionFoodSwipeCancel
  } = createNutritionDiaryFoodHandlers({
    NUTRITION_BACKUP_STORAGE_KEY,
    auth,
    user,
    nutrition,
    nutritionDateKey,
    deletingNutritionFoodId,
    nutritionFoodSwipeMoved,
    nutritionFoodSwipeStartX,
    nutritionUndoDelete,
    nutritionUndoTimerRef,
    updateNutritionDay,
    setDeletingNutritionFoodId,
    setNutrition,
    setNutritionFoodSwipeOffsets,
    setNutritionUndoDelete
  });

  const {
    resetNutritionPhotoAiSearch,
    resetNutritionPhotoAiState,
    selectNutritionPhotoAiCandidate,
    handleNutritionPhotoAiSearch,
    retryNutritionPhotoAiSearch,
    retryNutritionPhotoFromNotFound,
    addNutritionProductManuallyFromPhoto
  } = createNutritionPhotoAiHandlers({
    fatSecretFoods,
    nutrition,
    nutritionFoodDatabase,
    nutritionPhotoInputRef,
    nutritionPhotoLastFileRef,
    addNutritionFoodFromPicker,
    createCustomNutritionFood,
    endPerformanceCheck,
    openNutritionCreateProductFromPhoto,
    showAppError,
    startPerformanceCheck,
    setEditingNutritionItemId,
    setFatSecretError,
    setNutritionAmount,
    setNutritionAmountMode,
    setNutritionCreateChoiceOpen,
    setNutritionEditDetailsOpen,
    setNutritionEditOriginalFood,
    setNutritionEditOriginalNote,
    setNutritionEditPageOpen,
    setNutritionMealMenuOpen,
    setNutritionPhotoAiCandidates,
    setNutritionPhotoAiConfidence,
    setNutritionPhotoAiResult,
    setNutritionPhotoAnalyzing,
    setNutritionPhotoName,
    setNutritionPhotoNotFoundOpen,
    setNutritionPhotoPreview,
    setNutritionSearch,
    setNutritionSearchTab,
    setSelectedNutritionFood,
    setShowRecentNutritionFoods
  });

  const {
    handleFirstSetupSubmit
  } = createFirstSetupHandlers(() => ({
    APP_PAGES,
    FIRST_SETUP_DONE_USER_STORAGE_KEY,
    FIRST_SETUP_REQUIRED_VERSION,
    aiNutritionProfileDraft,
    hasRequiredAiNutritionProfileFields,
    saveAiNutritionPlan,
    setFirstSetupCompletedInSession,
    setFirstSetupSaveStatus,
    setOnboardingStep,
    setPage,
    setShowFirstSetupOnboarding,
    showAppError,
    user
  }));

  const {
    refreshPage,
    toggleAppTheme,
    openProfileAccount,
    openProfileAvatarCrop,
    closeProfileAvatarCrop,
    changeProfileAvatarCropZoom,
    startProfileAvatarCropDrag,
    moveProfileAvatarCrop,
    endProfileAvatarCropDrag,
    applyProfileAvatarCrop,
    saveProfileAccount,
    sendProfilePasswordReset
  } = createProfileAccountHandlers({
    APP_THEMES,
    auth,
    db,
    storage,
    profileAccount,
    profileAccountDraft,
    profileAccountAvatarFile,
    profileAccountSaving,
    profileAvatarCropSource,
    profileAvatarCropZoom,
    profileAvatarCropOffset,
    profileAvatarCropSize,
    profileAvatarCropImageRef,
    profileAvatarCropDragRef,
    profileSettingsModalBodyRef,
    setAppTheme,
    setProfileAccount,
    setProfileAccountDraft,
    setProfileAccountAvatarFile,
    setProfileAccountAvatarPreview,
    setProfileAccountStatus,
    setProfileAccountSaving,
    setProfileSettingsModalSection,
    setProfileSettingsModalOpen,
    setProfileAvatarCropSource,
    setProfileAvatarCropZoom,
    setProfileAvatarCropOffset,
    setProfileAvatarCropSize,
    setProfileAvatarCropOpen
  });

  const {
    logout,
    goBackToMain,
    leaveWorkoutToPlan,
    requestLeaveWorkout,
    handleAppBackNavigation
  } = createAppSessionNavigationHandlers({
    auth,
    APP_PAGES,
    defaultNutritionState,
    createEmptyAiNutritionProfileDraft,
    createEmptyTelegramProfile,
    page,
    fullscreenVideo,
    workoutExitPromptOpen,
    workoutIncompleteConfirmOpen,
    workoutDraftRestorePrompt,
    workoutReadinessOpen,
    selectedWorkoutId,
    barcodeScannerOpen,
    nutritionEditPageOpen,
    dishIngredientPickerOpen,
    nutritionCreateChoiceOpen,
    nutritionDeleteConfirmOpen,
    expandedNutritionMeals,
    nutritionPickerOpen,
    workoutStarted,
    currentExerciseIndex,
    workout,
    isWorkoutSaved,
    cancelNutritionEditPage,
    goToPreviousExercise: (...args) => goToPreviousExercise(...args),
    setProfileSettingsModalOpen,
    setProfileSettingsModalSection,
    setProfileAvatarCropOpen,
    setProfileAccountStatus,
    setIsLoggedIn,
    setUser,
    setIsAdminClaim,
    setCurrentUserRole,
    setPage,
    setPlan,
    setSelectedWorkoutId,
    setOpenVideoId,
    setFullscreenVideo,
    setInlinePlayingVideoId,
    setCurrentExerciseIndex,
    setWorkoutStarted,
    setWorkoutStartedAt,
    setWorkoutFinishedAt,
    setIndividualWorkoutIndexInitialized,
    setWorkoutReadinessOpen,
    setWorkoutReadiness,
    setPostWorkoutFeedback,
    setPostWorkoutFeedbackOpen,
    setOpenHistoryKey,
    setSelectedUserId,
    setLogin,
    setPassword,
    setLoginError,
    setHistory,
    setNutrition,
    setRecentNutritionFoods,
    setNutritionCloudReady,
    setAiNutritionProfile,
    setAiNutritionProfileDraft,
    setAiNutritionSavedPlan,
    setTelegramProfile,
    setTelegramDraft,
    setTelegramStatus,
    setTelegramConnectOpen,
    setWorkoutDraftRestorePrompt,
    setWorkoutReadinessPending,
    setWorkoutExitPromptOpen,
    setWorkoutIncompleteConfirmOpen,
    setPendingWorkoutFeedback,
    setWarmupCompletedSteps,
    setWarmupTimerRunning,
    setRestTimerRunning,
    setRestTimerSeconds,
    setExerciseHistoryOpenId,
    setWorkoutHistorySyncState,
    setFirstSetupCompletedInSession,
    setIsWorkoutSaved,
    setShowWorkoutSavedCard,
    setBarcodeScannerOpen,
    setDishIngredientPickerOpen,
    setNutritionCreateChoiceOpen,
    setNutritionDeleteConfirmOpen,
    setExpandedNutritionMeals,
    setNutritionPickerOpen,
    setSelectedNutritionFood,
    setEditingNutritionItemId,
    setNutritionEditDetailsOpen,
    setNutritionEditPageOpen,
    setNutritionMealMenuOpen
  });

  const {
    addSet,
    updateSet,
    updateExerciseNote,
    openWorkoutExerciseModal,
    closeWorkoutExerciseModal,
    startRestTimer,
    toggleWorkoutSetCompleted,
    toggleWarmupStep,
    setWarmupTimerPreset,
    resetWorkout
  } = createWorkoutRuntimeHandlers({
    workout,
    restTimerDuration,
    deckRef,
    setPlan,
    setExerciseValidationMessage,
    setRestTimerDuration,
    setRestTimerSeconds,
    setRestTimerRunning,
    setWarmupCompletedSteps,
    setWarmupTimerDuration,
    setWarmupTimerSeconds,
    setWarmupTimerRunning
  });

  const trainerPlanEditorHandlers = createTrainerPlanEditorHandlers({
    plan,
    setPlan,
    saveWorkoutsToFirebase,
    adminExerciseSearch,
    trainerExerciseLibraryItems,
    selectedUserId,
    auth,
    storage,
    setAdminExerciseVideoUploadingId,
    setAdminClientStatus
  });

  const trainerNextWorkspaceHandlers = createTrainerWorkspaceHandlers({
    ...trainerPlanEditorHandlers,
    setAdminClientStatus
  });

  const {
    sendAdminTelegramMessage,
    sendTrainerClientMessage,
    openTelegramChat,
    toggleClientTelegramNotifications
  } = createTrainerMessagingHandlers({
    db,
    auth,
    user,
    adminSelectedClient,
    adminTelegramMessage,
    setAdminTelegramMessage,
    setAdminTelegramSending,
    setAdminClientStatus,
    setAdminSelectedClient,
    setUsersList,
    recordTrainerEvent
  });

  const {
    loadTrainerClientSummaries
  } = createTrainerClientSummaryLoader({
    db,
    trainerClientSummaryRequestRef,
    setTrainerClientSummaries,
    setTrainerClientSummariesLoading
  });

  const {
    getAdminNutritionDaysList,
    getAdminRecommendations,
    exportAdminClientCsv
  } = createTrainerNutritionInsightHandlers({
    adminClientHistory,
    adminSelectedClient,
    adminClientNutrition,
    defaultNutritionState,
    buildDayModel: buildAiNutritionDayModel,
    setAdminClientStatus
  });

  const {
    loadAdminTrainingTemplates,
    createAdminTemplateFromCurrentPlan,
    assignAdminTemplateToClient,
    clearClientProgram,
    assignSavedProgramToClient,
    copyCurrentProgramToClient
  } = createTrainerProgramTemplateHandlers({
    db,
    auth,
    user,
    ADMIN_EMAIL,
    plan,
    selectedUserId,
    adminSelectedClient,
    usersList,
    adminTrainingTemplates,
    adminSelectedTemplateId,
    adminTemplateName,
    adminCopyTargetUserId,
    getCurrentProgramOwner,
    canUseAdminFeatures,
    canManageTrainingTemplate,
    canManageClientProgram,
    setAdminTrainingTemplates,
    setAdminSelectedTemplateId,
    setAdminTemplateName,
    setAdminClientStatus,
    setAdminSelectedClient,
    setUsersList,
    setPlan,
    showAppConfirm,
    recordTrainerEvent
  });

  function openAdminProgramsOverview() {
    setAdminOpenWorkoutId("");
    setAdminProgramLibraryTab("overview");
    setPage(APP_PAGES.ADMIN_WORKOUTS);
  }

  function openAdminClientsWithFilter(filter = "all") {
    setAdminClientFilter(filter);
    setAdminClientPageOpen(false);
    setPage(APP_PAGES.ADMIN_USERS);
  }

  const {
    saveWorkoutModePreference,
    openTrainingEntry,
    openIndividualWorkouts,
    openBasicWorkoutQuiz
  } = createWorkoutEntryNavigation({
    APP_PAGES,
    WORKOUT_MODE_STORAGE_KEY,
    auth,
    user,
    workoutModePreference,
    workoutModeRemember,
    setWorkoutModePreference,
    setWorkoutModeRemember,
    setSelectedWorkoutId,
    setIndividualWorkoutIndex,
    setIndividualWorkoutIndexInitialized,
    setPage,
    loadWorkoutsFromFirebase
  });

  const {
    openTrainerCabinetFromBottomBar,
    openTrainerClientsList,
    openTrainerProgramsList
  } = createBottomBarActions({
    loadHistory,
    setProfileActiveTab,
    setPage,
    openAdminClientsWithFilter,
    openAdminProgramsOverview
  });

  const {
    renderClientMainBottomBar,
    renderTrainerMainBottomBar,
    renderTrainerWorkspaceBottomBar
  } = createBottomBarRenderers({
    isTrainerMode: canUseTrainerFeatures(),
    onGoMain: goBackToMain,
    onOpenTraining: openTrainingEntry,
    onOpenNutrition: () => setPage(APP_PAGES.NUTRITION),
    onOpenCabinet: openTrainerCabinetFromBottomBar,
    onOpenTrainerClients: openTrainerClientsList,
    onOpenTrainerPrograms: openTrainerProgramsList,
    onLoadTrainerCabinet: openTrainerCabinetFromBottomBar
  });

  const {
    saveTrainerClientNutritionPlan
  } = createTrainerNutritionPlanHandlers({
    db,
    auth,
    adminSelectedClient,
    selectedUserId,
    usersList,
    adminClientNutrition,
    setAdminClientStatus,
    setAdminSelectedClient,
    setUsersList,
    setAdminClientNutrition,
    setNutrition,
    mirrorClientForTrainer,
    recordTrainerEvent
  });

  const {
    loadClientTrainerTasks,
    updateClientTrainerTask,
    openClientTrainerTask,
    createAdminClientTask,
    updateAdminClientTask,
    deleteAdminClientTask
  } = createClientTrainerTaskHandlers({
    auth,
    db,
    setClientTrainerTasks,
    setProfileTrainerNotificationsOpen,
    setProfileProgressPhotoStatus,
    setProfileProgressPhotosModalOpen,
    setProfileMeasurementsModalOpen,
    setPage,
    openTrainingEntry,
    setProfileBodyMetricsOpen,
    setProfileSettingsModalSection,
    setProfileSettingsModalOpen,
    setProfileProgressModalOpen,
    showAppError,
    adminSelectedClient,
    adminNewTaskTitle,
    adminNewTaskDueDate,
    setAdminClientStatus,
    setAdminClientTasks,
    setAdminNewTaskTitle,
    setAdminNewTaskDueDate,
    recordTrainerEvent
  });

  const {
    saveAdminClientPayment,
    uploadAdminProgressPhotos
  } = createTrainerClientControlHandlers({
    auth,
    db,
    storage,
    adminSelectedClient,
    adminPaymentDraft,
    adminProgressPhotoFiles,
    adminProgressPhotoDate,
    adminProgressPhotoComment,
    setAdminClientPayment,
    setAdminClientProgressPhotos,
    setAdminPhotoCompareIds,
    setAdminProgressPhotoFiles,
    setAdminProgressPhotoComment,
    setAdminProgressPhotoUploading,
    setAdminClientStatus,
    recordTrainerEvent
  });

  const {
    loadAdminClientOverview: loadAdminClientOverviewFromLoader
  } = createTrainerClientOverviewLoader({
    db,
    auth,
    user,
    setSelectedUserId,
    setAdminSelectedClient,
    setAdminClientTab,
    setPage,
    setAdminClientPageOpen,
    setAdminUsersSelectedTab,
    setAdminClientLoading,
    setAdminClientStatus,
    setAdminClientTasks,
    setAdminClientProgressPhotos,
    setAdminClientEvents,
    setAdminClientPayment,
    setAdminPhotoCompareOpen,
    setAdminTaskComposerOpen,
    setAdminProgramControlOpen,
    setUsersList,
    setAdminAllUsersList,
    setAdminClientHistory,
    setAdminSelectedHistoryIds,
    setAdminClientNutrition,
    setAdminClientMeasurements,
    setAdminPaymentDraft,
    setAdminPhotoCompareIds,
    setAdminTrainerNote,
    setAdminCalendarDraft,
    mirrorClientForTrainer,
    loadAdminTrainingTemplates
  });
  loadAdminClientOverviewRef.current = loadAdminClientOverviewFromLoader;

  const {
    toggleAdminSelectedHistoryId,
    toggleAdminSelectAllHistory,
    deleteSelectedAdminClientHistory,
    deleteAdminClientWorkoutHistory
  } = createTrainerClientHistoryHandlers({
    db,
    adminSelectedClient,
    adminClientHistory,
    adminSelectedHistoryIds,
    selectedUserId,
    showAppConfirm,
    setAdminSelectedHistoryIds,
    setAdminClientStatus,
    setAdminDeletingWorkoutId,
    setAdminClientHistory,
    setHistory
  });

  const {
    toggleAdminCalendarDay,
    updateAdminCalendarDaySetting,
    saveAdminClientCalendar,
    sendAdminTestWorkoutReminder,
    saveTrainerClientWorkoutSchedule,
    saveTrainerClientNotificationSettings,
    openClientTelegramConnection
  } = createTrainerClientCalendarHandlers({
    db,
    auth,
    TELEGRAM_BOT_USERNAME,
    adminSelectedClient,
    usersList,
    selectedUserId,
    plan,
    adminCalendarDraft,
    setAdminCalendarDraft,
    setAdminCalendarSaving,
    setAdminCalendarTesting,
    setAdminClientStatus,
    setAdminSelectedClient,
    setUsersList,
    setPlan,
    recordTrainerEvent
  });

  const {
    generateAdminPassword,
    createUserFromAdminPanel
  } = createTrainerCreateClientHandlers({
    auth,
    db,
    user,
    currentUserRole,
    ADMIN_EMAIL,
    adminNewUserName,
    adminNewUserEmail,
    adminNewUserPassword,
    canUseTrainerFeatures,
    canUseAdminFeatures,
    setAdminNewUserName,
    setAdminNewUserEmail,
    setAdminNewUserPassword,
    setAdminCreateUserStatus,
    setAdminCreateUserLoading,
    setAdminCreatedCredentials,
    setUsersList,
    setAdminAllUsersList,
    setSelectedUserId,
    setAdminSelectedClient,
    loadUsers
  });

  const {
    centerExerciseDeck,
    goToPreviousExercise,
    goToNextExercise,
    handleExerciseTouchStart,
    handleExerciseTouchMove,
    handleExerciseTouchEnd
  } = createWorkoutRunNavigationHandlers({
    workout,
    workoutStarted,
    currentExerciseIndex,
    deckRef,
    touchStartY,
    exerciseValidationTimerRef,
    partialExerciseWarningKeysRef,
    setWeightInputRefs,
    setOpenVideoId,
    setInlinePlayingVideoId,
    setRestTimerRunning,
    setRestTimerSeconds,
    setIsWorkoutSaved,
    setShowWorkoutSavedCard,
    postWorkoutFeedback,
    setPostWorkoutFeedbackOpen,
    setSwipeDirection,
    setWorkoutStarted,
    setCurrentExerciseIndex,
    setExerciseValidationMessage,
    setSwipeOffset
  });

  const {
    applyBasicWorkoutPlan,
    openWorkout,
    handleWorkoutDraftChoice
  } = createWorkoutOpenHandlers({
    APP_PAGES,
    auth,
    user,
    plan,
    basicWorkoutQuiz,
    workoutDraftRestorePrompt,
    loadHistory,
    loadWorkoutsFromFirebase,
    setPlan,
    setSelectedWorkoutId,
    setPage,
    setOpenVideoId,
    setFullscreenVideo,
    setCurrentExerciseIndex,
    setWorkoutStarted,
    setWorkoutStartedAt,
    setWorkoutFinishedAt,
    setWorkoutReadiness,
    setWorkoutReadinessPending,
    setWarmupCompletedSteps,
    setWarmupTimerDuration,
    setWarmupTimerSeconds,
    setWarmupTimerRunning,
    setRestTimerDuration,
    setRestTimerSeconds,
    setRestTimerRunning,
    setExerciseHistoryOpenId,
    setWorkoutHistorySyncState,
    setWorkoutExitPromptOpen,
    setPostWorkoutFeedback,
    setPostWorkoutFeedbackOpen,
    setWorkoutReadinessOpen,
    setIsWorkoutSaved,
    setWorkoutClientComment,
    setShowWorkoutSavedCard,
    setWorkoutDraftRestorePrompt
  });

  const {
    applyWorkoutReadiness
  } = createWorkoutReadinessHandlers({
    selectedWorkoutId,
    history,
    timerTickRef,
    centerExerciseDeck,
    setWorkoutReadiness,
    setWorkoutReadinessPending,
    setWorkoutReadinessOpen,
    setPlan,
    setWorkoutStarted,
    setWorkoutStartedAt,
    setTimerTick,
    setWorkoutFinishedAt,
    setCurrentExerciseIndex,
    setSwipeDirection
  });

  const saveWorkoutToFirebase = (feedbackOverride = null, allowIncomplete = false) =>
    saveCompletedWorkoutToFirebase({
      db,
      auth,
      plan,
      workout,
      isSaving,
      isWorkoutSaved,
      workoutStartedAt,
      workoutReadiness,
      workoutClientComment,
      loadHistory,
      showAppError,
      setPendingWorkoutFeedback,
      setWorkoutIncompleteConfirmOpen,
      setWorkoutHistorySyncState,
      setWorkoutFinishedAt,
      setTimerTick,
      timerTickRef,
      setIsSaving,
      setIsWorkoutSaved,
      setShowWorkoutSavedCard,
      setHistory,
      setPlan,
      saveWorkoutsToFirebase,
      feedbackOverride,
      allowIncomplete
    });

  const {
    saveAiNutritionPlan,
    resetAiNutritionPlan
  } = createAiNutritionPlanHandlers({
    auth,
    db,
    user,
    nutrition,
    history,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    aiNutritionSavedPlan,
    defaultNutritionState,
    AI_NUTRITION_PROFILE_STORAGE_KEY,
    AI_NUTRITION_PLAN_STORAGE_KEY,
    FIRST_SETUP_DONE_USER_STORAGE_KEY,
    FIRST_SETUP_REQUIRED_VERSION,
    setAiNutritionProfile,
    setAiNutritionProfileDraft,
    setAiNutritionSavedPlan,
    setFirstSetupCompletedInCloud,
    setNutrition
  });

  const {
    handleTelegramLoginAuth,
    refreshTelegramAvatar,
    handleTelegramAvatarError,
    startTelegramBotLink,
    checkTelegramLoginResult,
    refreshTelegramConnection,
    saveTelegramConnection,
    disconnectTelegram
  } = createProfileTelegramHandlers({
    auth,
    db,
    TELEGRAM_BOT_USERNAME,
    TELEGRAM_PROFILE_STORAGE_KEY,
    telegramDraft,
    telegramAvatarRefreshRef,
    setTelegramProfile,
    setTelegramDraft,
    setTelegramStatus,
    setTelegramConnectOpen,
    setTelegramLinkCode,
    setTelegramLinking
  });

  useProfileTelegramEffects({
    APP_PAGES,
    TELEGRAM_BOT_USERNAME,
    telegramConnectOpen,
    telegramLoginContainerRef,
    handleTelegramLoginAuth,
    refreshTelegramConnection,
    setPage,
    setTelegramConnectOpen,
    setTelegramLoginWidgetReady,
    setTelegramStatus
  });

  const {
    saveAiBodyMetrics,
    saveProfileNutritionPlanAndClose
  } = createProfileNutritionHandlers(() => ({
    AI_NUTRITION_PLAN_STORAGE_KEY,
    AI_NUTRITION_PROFILE_STORAGE_KEY,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    auth,
    buildAiNutritionMonthlyPlan,
    defaultNutritionState,
    getAiNutritionDayMacros,
    history,
    nutrition,
    profileNutritionSaveStatus,
    saveAiNutritionPlan,
    setAiNutritionProfile,
    setAiNutritionProfileDraft,
    setAiNutritionSavedPlan,
    setNutrition,
    setProfileNutritionModalOpen,
    setProfileNutritionSaveStatus,
    showAppError
  }));

  const {
    firstSetupStillResolving,
    firstSetupRequiredNow
  } = getFirstSetupGateState({
    isLoggedIn,
    userId: user?.uid,
    firstSetupProfileHydrated,
    currentUserRole,
    firstSetupCompletedInSession,
    firstSetupCompletedInCloud,
    hasRequiredAiNutritionProfileFields: hasRequiredAiNutritionProfileFields(aiNutritionProfile),
    storageKey: FIRST_SETUP_DONE_USER_STORAGE_KEY,
    requiredVersion: FIRST_SETUP_REQUIRED_VERSION
  });

  const startupGate = renderAppStartupGate({
    appLoading,
    firstSetupStillResolving,
    showFirstSetupOnboarding,
    firstSetupRequiredNow,
    isLoggedIn,
    onboardingStep,
    aiNutritionProfileDraft,
    firstSetupSaveStatus,
    setOnboardingStep,
    setAiNutritionProfileDraft,
    handleFirstSetupSubmit,
    login,
    setLogin,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loginError,
    setLoginError,
    loginNotice,
    setLoginNotice,
    loginFieldErrors,
    setLoginFieldErrors,
    loginSubmitting,
    passwordResetSending,
    handleLogin,
    handleLoginPasswordReset,
    logout
  });

  if (startupGate) {
    return startupGate;
  }

  const routedPage = renderAppRoutePage({
    APP_VERSION,
    APP_PAGES,
    auth,
    page,
    renderClientMainBottomBar,
    workoutModeRemember,
    canUseAdminFeatures,
    canUseTrainerFeatures,
    renderNutritionPage,
    basicWorkoutQuiz,
    goBackToMain,
    openBasicWorkoutQuiz,
    openIndividualWorkouts,
    setWorkoutModeRemember,
    setPage,
    openTrainingEntry,
    applyBasicWorkoutPlan,
    setBasicWorkoutQuiz,
    openTrainerClientsList,
    openTrainerProgramsList,
    openTrainerCabinetFromBottomBar,
    openAdminProgramsOverview,
    history,
    historyLoading,
    openHistoryKey,
    historySwipeId,
    historyDeletingId,
    historyDeleteCandidate,
    loadHistory,
    handleHistoryTouchStart,
    handleHistoryTouchEnd,
    requestDeleteOwnHistoryWorkout,
    setOpenHistoryKey,
    closeHistoryDeleteConfirm,
    confirmDeleteOwnHistoryWorkout,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    profileMeasurements,
    profileMeasurementWizardStep,
    profileMeasurementDraft,
    profileMeasurementStatus,
    profileMeasurementSaving,
    setProfileMeasurementDraft,
    setProfileMeasurementStatus,
    setProfileMeasurementWizardStep,
    setProfileMeasurementOpen,
    setProfileActiveTab,
    profileMeasurementReturnTab,
    saveProfileMeasurement,
    selectedAiFeatureId,
    setSelectedAiFeatureId,
    aiNutritionSavedPlan,
    setAiNutritionProfileDraft,
    saveAiNutritionPlan,
    resetAiNutritionPlan,
    nutritionDateKey,
    aiNutritionAdaptedToday,
    setAiNutritionAdaptedToday,
    plan,
    nutrition,
    profileWorkoutCalendarData,
    user,
    getCompletedWorkoutSet,
    isWorkoutCompletedByHistory,
    workoutModePreference,
    individualWorkoutIndex,
    individualWorkoutIndexInitialized,
    setIndividualWorkoutIndex,
    setIndividualWorkoutIndexInitialized,
    workoutModeModalOpen,
    setWorkoutModeModalOpen,
    workoutHistoryModalOpen,
    setWorkoutHistoryModalOpen,
    workoutDraftRestorePrompt,
    workoutReadinessOpen,
    postWorkoutFeedbackOpen,
    fullscreenVideo,
    showFirstSetupOnboarding,
    openAdminClientsWithFilter,
    openWorkout,
    saveWorkoutModePreference,
    setSelectedWorkoutId,
    openCabinetWorkoutHistory,
    handleWorkoutDraftChoice
  });

  if (isAppRouterPage(page, { selectedWorkoutId })) {
    return routedPage;
  }

  function renderNutritionPage() {
    const nutritionRouteProps = {
      activeNutritionSearchResultLimit,
      addNutritionFoodFromPicker,
      addNutritionProductManuallyFromPhoto,
      addSelectedDishIngredientFromFood,
      aiNutritionProfile,
      aiNutritionProfileDraft,
      aiNutritionSavedPlan,
      barcodeScannerOpen,
      canDeleteSelectedNutritionFood,
      cancelNutritionEditPage,
      closeSelectedNutritionFood,
      confirmNutritionEditPage,
      confirmNutritionFoodFromPicker,
      createCustomNutritionDish,
      createCustomNutritionFood,
      deleteSelectedNutritionFood,
      deletingNutritionFoodId,
      dishIngredientExternalFoods,
      dishIngredientFallbackSuggestions,
      dishIngredientLoading,
      dishIngredientPickerOpen,
      dishIngredientSearch,
      editingNutritionItemId,
      expandedNutritionMeals,
      fatSecretError,
      fatSecretLoading,
      handleNutritionFoodSwipeCancel,
      handleNutritionFoodSwipeEnd,
      handleNutritionFoodSwipeMove,
      handleNutritionFoodSwipeStart,
      handleNutritionPhotoAiSearch,
      history,
      isAiNutritionPlanExpanded,
      isNutritionToday,
      nutrition,
      nutritionAmount,
      nutritionAmountError,
      nutritionAmountMode,
      nutritionCalendarDays,
      nutritionCalendarMonthLabel,
      nutritionCalendarOpen,
      nutritionCreateChoiceOpen,
      nutritionCurrentStreak,
      nutritionDateKey,
      nutritionDeleteConfirmOpen,
      nutritionEditNote,
      nutritionEditPageOpen,
      nutritionFallbackSuggestions,
      nutritionFoodSwipeMoved,
      nutritionFoodSwipeOffsets,
      nutritionMeal,
      nutritionMealMenuOpen,
      nutritionPhotoAiCandidates,
      nutritionPhotoAiConfidence,
      nutritionPhotoAiResult,
      nutritionPhotoAnalyzing,
      nutritionPhotoInputRef,
      nutritionPhotoNotFoundOpen,
      nutritionPhotoPreview,
      nutritionPickerOpen,
      nutritionProductErrors,
      nutritionProductUnitMenuOpen,
      nutritionSearch,
      nutritionSearchResultKey,
      nutritionSearchResults,
      nutritionSearchTab,
      nutritionToday,
      nutritionTotals,
      nutritionUndoDelete,
      nutritionWeekDates,
      nutritionZoukExpanded,
      openDishIngredientPicker,
      openNutritionCalendar,
      openNutritionEditPage,
      openNutritionFoodEditor,
      openNutritionPicker,
      pendingDishIngredient,
      pendingDishIngredientGrams,
      recentNutritionFoods,
      removeSelectedDishIngredient,
      renderTrainerMainBottomBar,
      resetNutritionPhotoAiSearch,
      resetNutritionPhotoAiState,
      restoreNutritionFood,
      retryNutritionPhotoFromNotFound,
      selectNutritionDate,
      selectNutritionPhotoAiCandidate,
      selectedNutritionFood,
      setBarcodeScannerOpen,
      setDishIngredientPickerOpen,
      setDishIngredientSearch,
      setEditingNutritionItemId,
      setExpandedNutritionMeals,
      setFatSecretError,
      setIsAiNutritionPlanExpanded,
      setNutritionAmount,
      setNutritionAmountError,
      setNutritionAmountMode,
      setNutritionCalendarOpen,
      setNutritionCreateChoiceOpen,
      setNutritionDeleteConfirmOpen,
      setNutritionEditDetailsOpen,
      setNutritionEditNote,
      setNutritionEditPageOpen,
      setNutritionFallbackSuggestions,
      setNutritionMeal,
      setNutritionMealMenuOpen,
      setNutritionPickerOpen,
      setNutritionProductUnitMenuOpen,
      setNutritionSearch,
      setNutritionSearchResultLimit,
      setNutritionSearchTab,
      setNutritionZoukExpanded,
      setPendingDishIngredient,
      setPendingDishIngredientGrams,
      setSelectedNutritionFood,
      setShowRecentNutritionFoods,
      shiftNutritionCalendarMonth,
      showRecentNutritionFoods,
      todayNutritionKey,
      updateSelectedDishTotalWeight,
      updateSelectedNutritionFoodField,
      updateSelectedNutritionPortionUnit,
      visibleNutritionSearchResults
    };

    return (
      <Suspense fallback={<RouteFallback />}>
        <NutritionRoute {...nutritionRouteProps} />
      </Suspense>
    );
  }
  return renderAppTerminalRoute({
    ADMIN_CALENDAR_DAYS,
    ADMIN_EMAIL,
    adminActiveDayId,
    adminActiveProgramId,
    adminAllUsersList,
    adminCalendarDraft,
    adminCalendarSaving,
    adminCalendarTesting,
    adminClientEvents,
    adminClientFilter,
    adminClientHistory,
    adminClientMeasurements,
    adminClientNutrition,
    adminClientPageOpen,
    adminClientPayment,
    adminClientProgressPhotos,
    adminClientStatus,
    adminClientTab,
    adminClientTasks,
    adminCopyTargetUserId,
    adminCreateClientModalOpen,
    adminCreatedCredentials,
    adminCreateUserLoading,
    adminCreateUserStatus,
    adminDeletingWorkoutId,
    adminExerciseEditSnapshotRef,
    adminExerciseLibrary,
    adminExerciseSearch,
    adminExerciseVideoUploadingId,
    adminNewTaskDueDate,
    adminNewTaskTitle,
    adminNewUserEmail,
    adminNewUserName,
    adminNewUserPassword,
    adminOpenProgramBlocks,
    adminOpenProgramWeeks,
    adminOpenWorkoutId,
    adminPaymentDraft,
    adminPhotoCompareIds,
    adminPhotoCompareOpen,
    adminProgramControlOpen,
    adminProgramCopyTarget,
    adminProgramCreateChoiceOpen,
    adminProgramGroups,
    adminProgramImportInputRef,
    adminProgramLibraryTab,
    adminProgramSwipeOpenKey,
    adminProgressPhotoComment,
    adminProgressPhotoDate,
    adminProgressPhotoFiles,
    adminProgressPhotoUploading,
    adminSelectedClient,
    adminSelectedExerciseId,
    adminSelectedHistoryIds,
    adminSelectedNutritionPreset,
    adminSelectedTemplateId,
    adminTaskComposerOpen,
    adminTelegramMessage,
    adminTelegramSending,
    adminTemplateName,
    adminTrainerNote,
    adminTrainingTemplates,
    adminTransferFromUid,
    adminTransferLoading,
    adminTransferStatus,
    adminTransferToUid,
    adminUsersSearch,
    adminUsersSelectedTab,
    AI_NUTRITION_WEEK_DAYS,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    aiNutritionSavedPlan,
    APP_PAGES,
    APP_THEMES,
    APP_VERSION,
    applyProfileAvatarCrop,
    applyWorkoutReadiness,
    appTheme,
    assignAdminTemplateToClient,
    assignSavedProgramToClient,
    auth,
    buildAdminNutritionMonthOverview,
    buildAiNutritionMonthlyPlan,
    buildClientNutritionPresetOptions,
    buildPlannedWorkoutSlots,
    buildProgressInsight,
    buildTrainerDashboardSummary,
    buildWorkoutScheduleCalendarEntries,
    buildWorkoutScheduleDraft,
    cabinetWorkoutHistoryItemRefs,
    canManageTrainingTemplate,
    canUseAdminFeatures,
    canUseTrainerFeatures,
    changeProfileAvatarCropZoom,
    checkTelegramLoginResult,
    clearClientProgram,
    clientProgressPhotos,
    clientTrainerTasks,
    closeHistoryDeleteConfirm,
    closeProfileAvatarCrop,
    closeWorkoutExerciseModal,
    confirmDeleteOwnHistoryWorkout,
    copyCurrentProgramToClient,
    createAdminClientTask,
    createAdminTemplateFromCurrentPlan,
    createUserFromAdminPanel,
    currentExerciseIndex,
    currentUserRole,
    db,
    deckRef,
    deleteAdminClientTask,
    deleteClientEverywhereFromAdminPanel,
    deleteSelectedAdminClientHistory,
    disconnectTelegram,
    doc,
    endPerformanceCheck,
    endProfileAvatarCropDrag,
    exerciseHistoryOpenId,
    exerciseNoteOpenId,
    exerciseTechniqueOpenId,
    exerciseValidationMessage,
    firstSetupSaveStatus,
    formatProfileMeasurementDate,
    formatProfileProgressPhotoDate,
    formatProfileWorkoutDate,
    formatProfileWorkoutDateKey,
    formatTrainerSummaryDate,
    fullscreenVideo,
    generateAdminPassword,
    getActiveTrainerTasksCount,
    getAdminAverageNutritionScore,
    getAdminCalendarDayIdFromDate,
    getAdminCalendarTrainingDaysLabel,
    getAdminClientChartScales,
    getAdminClientGoalLabel,
    getAdminClientInitials,
    getAdminClientProfile,
    getAdminClientTrainingDaysText,
    getAdminMeasurementPreviewFields,
    getAdminNutritionDayMetrics,
    getAdminNutritionDaysList,
    getAdminRecommendations,
    getAdminWeightPoints,
    getAdminWorkoutProgressList,
    getAiNutritionActivityLabel,
    getAiNutritionCurrentWeek,
    getAiNutritionDayMacros,
    getAiNutritionGoalLabel,
    getAiNutritionTrainingDays,
    getAiNutritionWeekForDate,
    getClientActivityStatus,
    getClientEffectiveNutritionGoals,
    getClientNutritionDisplayPlan,
    getClientPaymentAttention,
    getClientPlateauInfo,
    getClientTelegramProfile,
    getClientTrainerTaskDestination,
    getCurrentProgramOwner,
    getDoc,
    getFoodIcon,
    getLastExerciseText,
    getNutritionDayTotals,
    getProfileMeasurementDelta,
    getProfileMeasurementFields,
    getProfileMeasurementValue,
    getProfileMeasurementValueById,
    getProfileNextTrainingText,
    getProgramHistoryItems,
    getTimestampValue,
    getTrainerClientSummaryFromMap,
    getTrainerDayWord,
    getTrainerNextCreateClientState,
    getTrainerSummaryDaysSince,
    getTrainerSummaryDayStart,
    getTrainerSummaryTimestamp,
    getTrainerTaskStatus,
    goBackToMain,
    goToNextExercise,
    goToPreviousExercise,
    handleAdminProgramSwipeCancel,
    handleAdminProgramSwipeClick,
    handleAdminProgramSwipeEnd,
    handleAdminProgramSwipeStart,
    handleExerciseTouchEnd,
    handleExerciseTouchMove,
    handleExerciseTouchStart,
    handleFirstSetupSubmit,
    handleTelegramAvatarError,
    handleTrainerClientAction,
    hasAdminWorkoutOnDate,
    history,
    historyDeleteCandidate,
    historyDeletingId,
    historyLoading,
    inlinePlayingVideoId,
    inlineVideoControlsTimerRef,
    inlineVideoControlsVisible,
    isSaving,
    isTrainerNextWorkspace,
    isWorkoutSaved,
    lastExerciseResults,
    leaveWorkoutToPlan,
    loadAdminClientOverview,
    loadAdminTrainingTemplates,
    loadHistory,
    loadWorkoutsFromFirebase,
    logout,
    makeEmptyNutritionDay,
    moveProfileAvatarCrop,
    navigateTrainerNext,
    normalizeExercise,
    nutrition,
    nutritionCalendarDays,
    nutritionDateKey,
    nutritionKeyToDate,
    onboardingStep,
    openAdminClientsWithFilter,
    openAdminProgramsOverview,
    openCabinetWorkoutHistory,
    openClientTelegramConnection,
    openClientTrainerTask,
    openHistoryKey,
    openProfileAccount,
    openProfileAvatarCrop,
    openTelegramChat,
    openTrainerExerciseLibrary,
    openTrainerNextClient,
    openTrainerProgramManager,
    openVideoId,
    openWorkoutExerciseModal,
    page,
    pendingWorkoutFeedback,
    plan,
    postWorkoutFeedback,
    postWorkoutFeedbackOpen,
    profileAccount,
    profileAccountAvatarPreview,
    profileAccountDraft,
    profileAccountSaving,
    profileAccountStatus,
    profileActiveTab,
    profileAvatarCropImageRef,
    profileAvatarCropOffset,
    profileAvatarCropOpen,
    profileAvatarCropSize,
    profileAvatarCropSource,
    profileAvatarCropZoom,
    profileBodyMetricsOpen,
    profileMeasurementDraft,
    profileMeasurementOpen,
    profileMeasurementReturnTab,
    profileMeasurements,
    profileMeasurementSaving,
    profileMeasurementsModalOpen,
    profileMeasurementStatus,
    profileMeasurementWizardStep,
    profileNutritionModalOpen,
    profileNutritionSaveStatus,
    profileProgressAnalysisOpen,
    profileProgressModalOpen,
    profileProgressPhotoCompareIds,
    profileProgressPhotoCompareView,
    profileProgressPhotoFiles,
    profileProgressPhotoPreviews,
    profileProgressPhotosModalOpen,
    profileProgressPhotoStatus,
    profileProgressPhotoUploading,
    profileSettingsModalBodyRef,
    profileSettingsModalOpen,
    profileSettingsModalSection,
    profileTrainerNotificationsOpen,
    profileWorkoutCalendarData,
    profileWorkoutCalendarDate,
    profileWorkoutCalendarDraftDates,
    profileWorkoutCalendarEditing,
    profileWorkoutCalendarMonth,
    profileWorkoutCalendarSaving,
    profileWorkoutCalendarStatus,
    profileWorkoutHistoryModalOpen,
    profileWorkoutHistoryProgramScope,
    profileWorkoutScheduledDates,
    refreshPage,
    renderClientMainBottomBar,
    renderTrainerWorkspaceBottomBar,
    requestDeleteOwnHistoryWorkout,
    requestLeaveWorkout,
    restTimerDuration,
    restTimerSeconds,
    safeWriteUserJsonStorage,
    saveAdminClientCalendar,
    saveAdminClientPayment,
    saveAdminTrainerNote,
    saveAiBodyMetrics,
    saveClientProgressPhotos,
    saveProfileAccount,
    saveProfileMeasurement,
    saveProfileNutritionPlanAndClose,
    saveTrainerClientNotificationSettings,
    saveTrainerClientNutritionPlan,
    saveTrainerClientWorkoutSchedule,
    saveWorkoutsToFirebase,
    saveWorkoutToFirebase,
    selectClientProgressPhoto,
    selectedUserId,
    selectedWorkoutId,
    selectNutritionDate,
    sendAdminTelegramMessage,
    sendAdminTestWorkoutReminder,
    sendProfilePasswordReset,
    sendTrainerClientMessage,
    setAdminActiveDayId,
    setAdminActiveProgramId,
    setAdminCalendarDraft,
    setAdminClientFilter,
    setAdminClientPageOpen,
    setAdminClientStatus,
    setAdminClientTab,
    setAdminCopyTargetUserId,
    setAdminCreateClientModalOpen,
    setAdminExerciseSearch,
    setAdminExerciseVideoUploadingId,
    setAdminNewTaskDueDate,
    setAdminNewTaskTitle,
    setAdminNewUserEmail,
    setAdminNewUserName,
    setAdminNewUserPassword,
    setAdminOpenProgramBlocks,
    setAdminOpenProgramWeeks,
    setAdminOpenWorkoutId,
    setAdminPaymentDraft,
    setAdminPhotoCompareIds,
    setAdminPhotoCompareOpen,
    setAdminProgramControlOpen,
    setAdminProgramCopyTarget,
    setAdminProgramCreateChoiceOpen,
    setAdminProgramEditorMode,
    setAdminProgramGroups,
    setAdminProgramLibraryTab,
    setAdminProgramSwipeOpenKey,
    setAdminProgressPhotoComment,
    setAdminProgressPhotoDate,
    setAdminProgressPhotoFiles,
    setAdminSelectedClient,
    setAdminSelectedExerciseId,
    setAdminSelectedNutritionPreset,
    setAdminSelectedTemplateId,
    setAdminTaskComposerOpen,
    setAdminTelegramMessage,
    setAdminTemplateName,
    setAdminTrainerNote,
    setAdminTrainingTemplates,
    setAdminTransferFromUid,
    setAdminTransferToUid,
    setAdminUsersSearch,
    setAdminUsersSelectedTab,
    setAiNutritionProfileDraft,
    setCurrentExerciseIndex,
    setDoc,
    setExerciseHistoryOpenId,
    setExerciseNoteOpenId,
    setExerciseTechniqueOpenId,
    setFullscreenVideo,
    setInlinePlayingVideoId,
    setInlineVideoControlsVisible,
    setIsWorkoutSaved,
    setOnboardingStep,
    setOpenHistoryKey,
    setOpenVideoId,
    setPage,
    setPendingWorkoutFeedback,
    setPlan,
    setPostWorkoutFeedback,
    setPostWorkoutFeedbackOpen,
    setProfileAccountDraft,
    setProfileAccountStatus,
    setProfileActiveTab,
    setProfileAvatarCropSize,
    setProfileBodyMetricsOpen,
    setProfileMeasurementDraft,
    setProfileMeasurementOpen,
    setProfileMeasurementReturnTab,
    setProfileMeasurementsModalOpen,
    setProfileMeasurementStatus,
    setProfileMeasurementWizardStep,
    setProfileNutritionModalOpen,
    setProfileNutritionSaveStatus,
    setProfileProgressAnalysisOpen,
    setProfileProgressModalOpen,
    setProfileProgressPhotoCompareIds,
    setProfileProgressPhotoCompareView,
    setProfileProgressPhotosModalOpen,
    setProfileProgressPhotoStatus,
    setProfileSettingsModalOpen,
    setProfileSettingsModalSection,
    setProfileTrainerNotificationsOpen,
    setProfileWorkoutCalendarData,
    setProfileWorkoutCalendarDate,
    setProfileWorkoutCalendarDraftDates,
    setProfileWorkoutCalendarEditing,
    setProfileWorkoutCalendarMonth,
    setProfileWorkoutCalendarSaving,
    setProfileWorkoutCalendarStatus,
    setProfileWorkoutHistoryModalOpen,
    setProfileWorkoutScheduledDates,
    setRepsInputRefs,
    setRestTimerRunning,
    setRestTimerSeconds,
    setSelectedNutritionDateKey,
    setSelectedUserId,
    setSelectedWorkoutId,
    setShowWorkoutSavedCard,
    setTelegramConnectOpen,
    setTelegramProfile,
    setTelegramStatus,
    setTrainerNextSection,
    setTrainerProgramManagerOpen,
    setUsersList,
    setVideoLoadingId,
    setVideoRetryToken,
    setWarmupTimerPreset,
    setWarmupTimerRunning,
    setWarmupTimerSeconds,
    setWeightInputRefs,
    setWorkoutClientComment,
    setWorkoutExitPromptOpen,
    setWorkoutFinishedAt,
    setWorkoutIncompleteConfirmOpen,
    setWorkoutReadinessPending,
    setWorkoutStarted,
    setWorkoutStartedAt,
    shiftNutritionDateKey,
    shiftProfileWorkoutMonthKey,
    showAppConfirm,
    showAppError,
    showFirstSetupOnboarding,
    showInlineVideoControlsTemporarily,
    showWorkoutSavedCard,
    sortWorkoutDays,
    startPerformanceCheck,
    startProfileAvatarCropDrag,
    startRestTimer,
    storage,
    swipeDirection,
    swipeOffset,
    telegramConnectOpen,
    telegramLinking,
    telegramLoginContainerRef,
    telegramLoginWidgetReady,
    telegramProfile,
    telegramStatus,
    todayNutritionKey,
    toggleAdminCalendarDay,
    toggleAdminSelectAllHistory,
    toggleAdminSelectedHistoryId,
    toggleAppTheme,
    toggleCabinetWorkoutHistory,
    toggleClientTelegramNotifications,
    toggleWarmupStep,
    toggleWorkoutSetCompleted,
    trainerClientSummaries,
    trainerClientSummariesLoading,
    trainerExerciseLibraryItems,
    trainerNextSection,
    trainerNextWorkspaceHandlers,
    trainerProgramManagerOpen,
    trainerWorkoutTab,
    transferClientDataBetweenAccounts,
    updateAdminCalendarDaySetting,
    updateAdminClientTask,
    updateExerciseNote,
    updateSet,
    updateUserTrainerRole,
    uploadAdminProgressPhotos,
    user,
    usersList,
    videoLoadingId,
    videoRetryToken,
    warmupCompletedSteps,
    warmupTimerDuration,
    warmupTimerRunning,
    warmupTimerSeconds,
    workout,
    WORKOUT_CALENDAR_STORAGE_KEY,
    workoutClientComment,
    workoutDraftRestorePrompt,
    workoutDurationText,
    workoutExitPromptOpen,
    workoutFinishedAt,
    workoutHistorySyncState,
    workoutIncompleteConfirmOpen,
    workoutReadiness,
    workoutReadinessOpen,
    workoutReadinessPending,
    workoutStarted
  });
}





