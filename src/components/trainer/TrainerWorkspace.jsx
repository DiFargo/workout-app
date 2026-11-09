import { buildTrainerDashboardSummary } from "../../utils/trainerClientSummary.js";
import { readCabinetEvents, saveCabinetEvents, isCabinetEventEnabled, toggleTrainerScheduleDate, getTrainerHistoryCoverage, getTrainerUiStorage } from "../../utils/trainerWorkspaceUx.js";
import { buildTrainerInviteMessage } from "../../features/trainer/trainerInviteMessage.js";
import TrainerClientInviteReady, { TrainerClientInviteSendAction } from "../../features/trainer/TrainerClientInviteReady.jsx";
import { useTrainerInviteSubmission } from "../../features/trainer/useTrainerInviteSubmission.js";
import { mergeTrainerExerciseLibraryItems } from "../../utils/trainerExerciseLibrary.js";
import { getTrainerActionErrorStatus } from "../../utils/trainerActionStatus.js";
import { exerciseLibraryNameKey } from "../../../functions/exerciseLibraryIdentity.js";
import TrainerExerciseQuickFields from "./TrainerExerciseQuickFields";
import TrainerClientProgramExerciseCard from "./TrainerClientProgramExerciseCard.jsx";
import clientProgramEditorStyles from "./TrainerClientProgramEditor.module.css";
import TrainerExerciseLibraryPicker from "./TrainerExerciseLibraryPicker";
import TrainerExerciseLibrarySearch from "./TrainerExerciseLibrarySearch";
import { getTrainerExerciseSelectionPatch } from "../../features/trainer/trainerWorkoutEditHelpers";
import TrainerSummaryStatus from "./TrainerSummaryStatus";
import TrainerExerciseHistoryChart from "./TrainerExerciseHistoryChart.jsx";
import TrainerMeasurementsModal from "./TrainerMeasurementsModal.jsx";
import TrainerClientActionsSheet from "./TrainerClientActionsSheet.jsx";
import { useVisibleTrainerSummaries } from "./useVisibleTrainerSummaries.js";
import ProtectedExerciseVideo from "../media/ProtectedExerciseVideo.jsx";
import PrivateProgressPhoto from "../media/PrivateProgressPhoto.jsx";
import TrainerClientExerciseSheet from "./TrainerClientExerciseSheet";
import TrainerProgramUnsavedDialog from "./TrainerProgramUnsavedDialog";
import { useTrainerProgramDraft } from "../../features/trainer/useTrainerProgramDraft";
import { getTrainerWorkoutDayMoveTarget } from "../../utils/trainerWorkoutDayOrder.js";
import { resolveTrainerAssignmentWorkoutOrder } from "../../utils/trainerAssignmentWorkoutOrder.js";
import { getTrainerLibraryMuscle, TRAINER_LIBRARY_MUSCLES } from "../../utils/trainerLibraryMuscleGroups.js";
import { isBodyMeasurementRecord } from "../../utils/bodyMeasurementRecords.js";
import appleStyles from "./TrainerAppleClient.module.css";
import familiarStyles from "./TrainerClientFamiliar.module.css";
import { getLatestTrainerWeightMeasurement, getTrainerPhotoCompareSelection, getTrainerProgressPhotoId } from "../../utils/trainerClientCardPresentation.js";
import TrainerClientFamiliarNutritionAnalytics from "./TrainerClientFamiliarNutritionAnalytics.jsx";
import { AppleSchedule, AppleRecent, AppleGroup, AppleRow } from "./TrainerAppleClientParts";
import TrainerWorkoutList from "./TrainerWorkoutList";
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isTrainerV2Path } from "../../app/cssVariant";
import TrainerClientDisclosure, { TrainerClientColumn } from "./TrainerClientDisclosure";
import { useBodyScrollLock } from "../../shared/hooks/useBodyScrollLock";
import workspaceStyles from "./TrainerWorkspaceCalm.module.css";
import syncStyles from "./TrainerWorkspace.module.css";
import clientProfileSectionStyles from "./TrainerWorkspaceClientProfileSections.module.css";
import clientViewsStyles from "./TrainerWorkspaceClientViews.module.css";
import nutritionAnalyticsStyles from "./TrainerWorkspaceNutritionAnalytics.module.css";
import clientWorkoutPlanStyles from "./TrainerWorkspaceClientWorkoutPlan.module.css";
import clientNutritionStyles from "./TrainerWorkspaceClientNutrition.module.css";
import cabinetStyles from "./TrainerWorkspaceCabinet.module.css";
import programEditorStyles from "./TrainerWorkspaceProgramEditor.module.css";
import modalSystemStyles from "./TrainerWorkspaceModalSystem.module.css";
import exerciseProgressStyles from "./TrainerWorkspaceExerciseProgress.module.css";
import nutritionDiaryStyles from "./TrainerWorkspaceNutritionDiary.module.css";
import dashboardStyles from "./TrainerWorkspaceDashboard.module.css";
import primaryScreensStyles from "./TrainerPrimaryScreens.module.css";
import TrainerLibraryExercisePreview from "./TrainerLibraryExercisePreview.jsx";
import TrainerLibraryLoadNotice from "./TrainerLibraryLoadNotice.jsx";
import { getTrainerLibraryViewState } from "../../utils/trainerLibraryLoadState.js";
import { getTrainerListProgressScore, getTrainerListStatusLabel } from "../../utils/trainerPrimaryScreenPresentation.js";
import adaptiveStyles from "./TrainerWorkspaceAdaptive.module.css";
import trainerProgramConstructorStyles from "./TrainerProgramConstructor.module.css";
import TrainerClientUtilitySheet from "./TrainerClientUtilitySheet";
import TrainerClientAccessInfo from "./TrainerClientAccessInfo.jsx";
import TrainerProgramHistoryPanel from "./TrainerProgramHistoryPanel.jsx";
import TrainerWorkoutHistoryPanel from "./TrainerWorkoutHistoryPanel.jsx";
import TrainerScheduleAgenda from "./TrainerScheduleAgenda.jsx";
import TrainerWorkoutFeedbackReplyModal from "./TrainerWorkoutFeedbackReplyModal";
import trainerWorkoutFeedbackReplyStyles from "./TrainerWorkoutFeedbackReplyModal.module.css";
import TrainerClientContactModal from "./TrainerClientContactModal";
import TrainerClientTasks from "./TrainerClientTasks";
import TrainerClientSetupFlowModal from "./TrainerClientSetupFlowModal";
import TrainerExerciseLoadReviewModal from "./TrainerExerciseLoadReviewModal";
import trainerExerciseLoadReviewStyles from "./TrainerExerciseLoadReviewModal.module.css";
import TrainerProgramAssignmentAdjustmentModal from "./TrainerProgramAssignmentAdjustmentModal";
import TrainerWorkoutReviewDecisionModal from "./TrainerWorkoutReviewDecisionModal";
import TrainerClientProgressDashboard from "./TrainerClientProgressDashboard";
import clientOverviewStyles from "./TrainerClientOverviewCard.module.css";
import SaveSuccessNotice from "../../shared/ui/SaveSuccessNotice";
import trainerClientWorkoutPlanStyles from "./TrainerClientWorkoutPlan.module.css";
import trainerClientExercisesTabsStyles from "./TrainerClientExercisesTabs.module.css";
import trainerClientMessagesStyles from "./TrainerClientMessages.module.css";
import workspaceFeatureStyles from "./TrainerWorkspaceSubscriptionProgress.module.css";
import subscriptionCalendarStyles from "./TrainerSubscriptionCalendar.module.css";
import { getSubscriptionScheduleRange } from "../../utils/subscriptionScheduleRange.js";
import exerciseLibraryEditorStyles from "./TrainerExerciseLibraryEditor.module.css";
import ExerciseVideoCropEditor from "./ExerciseVideoCropEditor.jsx";
import { exerciseCardMetadata } from "../../../functions/exerciseCards.js";
import mobileStyles from "./TrainerWorkspaceMobile.module.css";
import responsiveStyles from "./TrainerWorkspaceResponsivePass.module.css";
import {
  analyzeExerciseProgress,
  getExerciseActualProgress
} from "../../utils/exerciseProgress.js";
import { buildClientWorkoutsFromTemplate } from "../../utils/workoutPlanNormalization.js";
import { sanitizeExerciseSetPatch, sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput.js";
import {
  findTrainerExerciseProgressTarget,
  getTrainerExerciseProgressReviewedKeys,
  getTrainerExerciseProgressReviewKey
} from "../../utils/trainerExerciseProgressReview.js";
import {
  findTrainerWorkoutReviewTarget,
  getTrainerWorkoutReviewReviewedKeys,
  getTrainerWorkoutReviewKey
} from "../../utils/trainerWorkoutReviewDecision.js";
import { normalizeTrainerSubscriptionNotificationSettings } from "../../utils/trainerSubscriptionNotificationSettings.js";
import { getTrainerClientMessageResolvedIds } from "../../utils/trainerClientMessageResolution.js";
import { getWorkoutNoteItems } from "../../utils/trainerClientMessages.js";
import { getClientTelegramProfile } from "../../utils/clientTelegramProfile.js";
import {
  getTrainerClientSetupChecklist,
  hasCompletedClientQuestionnaire
} from "../../utils/trainerClientSetupChecklist.js";
import {
  getSubscriptionAttentionLabel,
  getSubscriptionStatus
} from "../../utils/clientSubscription.js";
import {
  buildPlannedWorkoutSlots,
  buildWorkoutScheduleCalendarEntries,
  getWorkoutScheduleCalendarForWorkouts,
  toWorkoutDateKey
} from "../../utils/workoutSchedule.js";
import { buildTrainerAiNutritionPlanDraft } from "../../utils/trainerNutritionPlan.js";
import {
  buildTrainerClientProgramTimeline,
  isTrainerClientBasicWorkout
} from "../../utils/trainerClientProgramAssignments.js";
import {
  getTrainerProgramStatusMeta,
  canAssignTrainerProgram,
  TRAINER_PROGRAM_STATUSES
} from "../../utils/trainerProgramLifecycle.js";
import {
  getClientAttentionState,
  getTrainerAttentionDaysSince as getLocalDaysSince
} from "../../utils/trainerAttention.js";
import { buildTrainerClientProgressDashboard } from "../../utils/trainerClientProgressDashboard.js";
import {
  buildTrainerClientListItems,
  buildTrainerWorkoutReview,
  getTrainerActionItemTargetTab
} from "../../utils/trainerActionCenter.js";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  Check,
  CircleAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Copy,
  Database,
  Dumbbell,
  EllipsisVertical,
  Eye,
  GripVertical,
  Home,
  History,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  Ruler,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  Utensils,
  X
} from "lucide-react";

const TrainerDailyJournal = lazy(() => import("./TrainerDailyJournal"));

const NAV_ITEMS = [
  { id: "dashboard", label: "Главная", mobileLabel: "Главная", icon: Home },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "nutrition", label: "Питание", icon: Utensils },
  { id: "workouts", label: "Программы", icon: ClipboardList },
  { id: "library", label: "Упражнения", icon: Dumbbell },
  { id: "more", label: "Кабинет", mobileLabel: "Кабинет", icon: User }
];

export function TrainerProgramConstructorStyleScope({ children }) {
  return <>{children(trainerProgramConstructorStyles)}</>;
}
const DESKTOP_NAV_ITEMS = [
  { id: "dashboard", label: "Главная", icon: Home },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "workouts", label: "Программы", icon: ClipboardList },
  { id: "library", label: "Упражнения", icon: Dumbbell },
  { id: "more", label: "Кабинет", icon: User }
];

const CABINET_SECTION_IDS = new Set(["more", "analytics", "notifications"]);

const NUTRITION_PLAN_PRESETS = {
  maintain: {
    name: "Поддержка",
    goal: "Поддержание веса и формы",
    calories: 2400,
    protein: 160,
    fat: 75,
    carbs: 260
  },
  recomp: {
    name: "Рекомпозиция",
    goal: "Снижение жира и сохранение мышц",
    calories: 2300,
    protein: 180,
    fat: 70,
    carbs: 235
  },
  cut: {
    name: "Похудение",
    goal: "Плавное снижение веса",
    calories: 2100,
    protein: 170,
    fat: 65,
    carbs: 190
  },
  dry: {
    name: "Сушка",
    goal: "Снижение процента жира",
    calories: 1900,
    protein: 185,
    fat: 55,
    carbs: 160
  },
  mass: {
    name: "Набор",
    goal: "Набор мышечной массы",
    calories: 2850,
    protein: 180,
    fat: 85,
    carbs: 340
  }
};

function normalizeNutritionPresetId(value = "custom") {
  const id = String(value || "custom").trim();
  if (id === "maintenance") return "maintain";
  if (id === "recomposition") return "recomp";
  if (id === "fat_loss") return "cut";
  if (id === "cutting") return "dry";
  if (id === "mass_gain") return "mass";
  return id || "custom";
}

const CLIENT_TABS = [
  { id: "overview", label: "Сводка" },
  { id: "exercises", label: "Тренировки", target: "workouts" },
  { id: "nutrition", label: "Питание" },
  { id: "bodyProgress", label: "Фото и замеры" }
];

const CLIENT_TAB_ICONS = {
  overview: Home,
  exercises: Dumbbell,
  nutrition: Utensils,
  bodyProgress: Camera,
  messages: MessageSquare,
  notifications: Bell
};

const WORKOUT_STATUS_OPTIONS = [
  { id: "planned", label: "Запланирована", icon: "📅" },
  { id: "completed", label: "Выполнена", icon: "✅" },
  { id: "not_completed", label: "Не выполнена", icon: "❌" },
  { id: "missed", label: "Пропущена", icon: "⛔" },
  { id: "moved", label: "Перенесена", icon: "🔄" }
];

const MEASUREMENT_FIELDS = [
  { id: "weight", label: "Вес", unit: "кг", fields: ["weight", "values.weight"] },
  { id: "neck", label: "Шея", unit: "см", fields: ["neck", "values.neck"] },
  { id: "shoulders", label: "Плечи", unit: "см", fields: ["shoulders", "shoulderGirth", "values.shoulders", "values.shoulderGirth"] },
  { id: "chest", label: "Грудь", unit: "см", fields: ["chest", "values.chest"] },
  { id: "biceps", label: "Бицепс", unit: "см", fields: ["biceps", "values.biceps"] },
  { id: "forearm", label: "Предплечье", unit: "см", fields: ["forearm", "values.forearm"] },
  { id: "wrist", label: "Запястье", unit: "см", fields: ["wrist", "values.wrist"] },
  { id: "belly", label: "Талия", unit: "см", fields: ["belly", "waist", "values.belly", "values.waist"] },
  { id: "pelvis", label: "Таз", unit: "см", fields: ["pelvis", "hips", "values.pelvis", "values.hips"] },
  { id: "thigh", label: "Бедро", unit: "см", fields: ["thigh", "values.thigh"] },
  { id: "calf", label: "Икра", unit: "см", fields: ["calf", "values.calf"] },
  { id: "ankle", label: "Лодыжка", unit: "см", fields: ["ankle", "values.ankle"] }
];

function getWorkoutStatusMeta(status) {
  return WORKOUT_STATUS_OPTIONS.find((item) => item.id === status) || WORKOUT_STATUS_OPTIONS[0];
}

function getLocalDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarMonthDays(monthKey) {
  const [year, month] = String(monthKey || getLocalDateKey().slice(0, 7)).split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      key: getLocalDateKey(day),
      label: day.getDate(),
      currentMonth: day.getMonth() === month - 1
    };
  });
}

function formatCompactDate(value) {
  if (!value) return "Нет данных";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Нет данных";
  const today = new Date();
  const delta = Math.floor((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (delta === 0) return "Сегодня";
  if (delta === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatSubscriptionDate(value) {
  if (!value) return "Не выбрано";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Не выбрано";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function getWorkspaceDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMeasurementDate(item = {}) {
  if (!item || typeof item !== "object") return null;
  return getWorkspaceDate(item.date || item.createdAt || item.updatedAt || item.savedAt);
}

function getNumericField(item = {}, fields = []) {
  for (const field of fields) {
    const value = field.includes(".")
      ? field.split(".").reduce((result, key) => result?.[key], item)
      : item[field];
    const parsed = Number(String(value ?? "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function roundTrainerNumber(value, precision = 1) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function getMeasurementFieldValue(item = {}, field = {}) {
  return getNumericField(item, field.fields || [field.id, `values.${field.id}`]);
}

function formatMeasurementValue(value, unit = "") {
  if (value === null || value === undefined || value === "") return "—";
  return `${roundTrainerNumber(value)}${unit ? ` ${unit}` : ""}`;
}

function getMeasurementDelta(current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return roundTrainerNumber(current - previous);
}

function formatSignedDelta(value, unit = "") {
  if (value === null || value === undefined) return "нет сравнения";
  if (value === 0) return "без изменений";
  return `${value > 0 ? "+" : ""}${roundTrainerNumber(value)}${unit ? ` ${unit}` : ""}`;
}

function getDeltaTone(value, reversed = false) {
  if (value === null || value === undefined || value === 0) return "";
  const positive = reversed ? value < 0 : value > 0;
  return positive ? "positive" : "negative";
}

function formatPercentChange(value) {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "0%";
  return `${value > 0 ? "+" : ""}${roundTrainerNumber(value).toLocaleString("ru-RU")}%`;
}

function getExerciseProgressData(history = []) {
  const allExerciseProgress = analyzeExerciseProgress(history);
  const progressing = allExerciseProgress.filter((item) => item.status === "progress").length;
  const stableExercises = allExerciseProgress.filter((item) => item.status === "stable").length;
  const adapting = allExerciseProgress.filter((item) => item.status === "adaptation").length;
  const mixed = allExerciseProgress.filter((item) => item.status === "mixed").length;
  const regressing = allExerciseProgress.filter((item) => item.status === "regression").length;
  const latestExerciseProgressDate = allExerciseProgress
    .map((item) => item.current?.date)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const exerciseProgressInsight = (() => {
    if (!history.length) {
      return "Нет завершённых тренировок. После заполнения подходов появится анализ рабочих весов, повторений и объёма.";
    }
    if (!allExerciseProgress.length) {
      return "Нужны минимум две записи по одному упражнению. Пока можно оценивать только факт выполнения программы.";
    }
    if (regressing > 0) {
      return "Есть упражнения с возможным регрессом. Проверьте восстановление, технику и не менялась ли цель нагрузки.";
    }
    if (progressing > stableExercises + adapting) {
      return "Силовая динамика хорошая: по большинству сопоставимых упражнений растёт e1RM, объём или повторения.";
    }
    if (adapting > 0) {
      return "Часть упражнений попала в адаптацию программы. Их лучше сравнивать после ещё одной тренировки в похожем диапазоне повторений.";
    }
    return "Показатели в рабочем диапазоне. Следите за регулярностью тренировок и постепенно ищите точки для прогрессии.";
  })();

  return {
    allExerciseProgress,
    exerciseProgress: allExerciseProgress.slice(0, 6),
    progressing,
    stableExercises,
    adapting,
    mixed,
    regressing,
    latestExerciseProgressDate,
    exerciseProgressInsight
  };
}

function getWorkoutHistoryDate(item = {}) {
  return getWorkspaceDate(item.date || item.completedAt || item.finishedAt || item.createdAt);
}

function getWorkoutReviewKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getWorkoutHistoryIndex(item = {}) {
  const candidates = [
    item.workoutIndex,
    item.dayIndex,
    item.order,
    item.workoutNumber,
    item.dayNumber
  ];
  const numeric = candidates.map(Number).find((value) => Number.isFinite(value));
  if (!Number.isFinite(numeric)) return null;
  return numeric > 0 ? numeric - 1 : numeric;
}

function findPlannedWorkoutForHistory(historyItem = {}, workouts = []) {
  if (!historyItem || !Array.isArray(workouts) || !workouts.length) return {};
  const idCandidates = [
    historyItem.workoutId,
    historyItem.workoutDayId,
    historyItem.sourceWorkoutId,
    historyItem.templateWorkoutId,
    historyItem.id
  ].filter(Boolean).map(getWorkoutReviewKey);
  const nameCandidates = [
    historyItem.workoutName,
    historyItem.name,
    historyItem.workout,
    historyItem.title
  ].filter(Boolean).map(getWorkoutReviewKey);

  const byId = workouts.find((workout) => (
    idCandidates.includes(getWorkoutReviewKey(workout.id)) ||
    idCandidates.includes(getWorkoutReviewKey(workout.workoutId)) ||
    idCandidates.includes(getWorkoutReviewKey(workout.templateWorkoutId))
  ));
  if (byId) return byId;

  const historyIndex = getWorkoutHistoryIndex(historyItem);
  if (historyIndex !== null && workouts[historyIndex]) return workouts[historyIndex];

  return workouts.find((workout) => (
    nameCandidates.includes(getWorkoutReviewKey(workout.name)) ||
    nameCandidates.includes(getWorkoutReviewKey(workout.title)) ||
    nameCandidates.includes(getWorkoutReviewKey(workout.workout))
  )) || {};
}

function getTrainerWorkoutKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getTrainerCompletedWorkoutKeys(history = []) {
  return (Array.isArray(history) ? history : []).reduce((result, item) => {
    const workoutId = getTrainerWorkoutKey(item?.workoutId);
    if (workoutId) result.add(`id:${workoutId}`);
    return result;
  }, new Set());
}

function isTrainerWorkoutCompleted(workout = {}, completedKeys = new Set(), { includeManualStatus = true } = {}) {
  const status = String(workout.status || "").trim().toLowerCase();
  if (includeManualStatus && (status === "completed" || status === "completed_off_date" || workout.completed === true)) return true;
  if (["not_completed", "missed"].includes(status)) return false;

  const workoutId = getTrainerWorkoutKey(workout.id);
  // Program assignments are appended and often reuse names such as
  // "Тренировка 1".  Only an immutable workout id may make a future day
  // read-only; name matching would incorrectly lock a later assignment.
  return Boolean(workoutId && completedKeys.has(`id:${workoutId}`));
}

function getNutritionDayDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return getWorkspaceDate(value);
}

function toDateInputValue(value) {
  const date = getNutritionDayDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pluralize(number, one, few, many) {
  const value = Math.abs(Number(number) || 0);
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function getAvatar(client = {}) {
  return client.avatarUrl || client.photoURL || client.telegramAvatarUrl || client.telegram?.avatarUrl || "";
}

function TrainerAvatar({ client, size = "medium" }) {
  const image = getAvatar(client);
  return (
    <span className={`trainerNextAvatar ${size}`}>
      {image ? <img src={image} alt="" /> : <User className="trainerNextAvatarPlaceholder" aria-hidden="true" />}
    </span>
  );
}

function TrainerConfirmDialog({
  title,
  text,
  confirmLabel = "Удалить",
  status = "",
  isBusy = false,
  onConfirm,
  onCancel
}) {
  return (
    <div
      className="trainerConfirmBackdrop"
      data-trainer-modal-backdrop="true"
      onMouseDown={(event) => {
        if (!isBusy && event.target === event.currentTarget) onCancel?.();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <section className="trainerConfirmDialog" role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-label={title || "Подтверждение действия"}>
        <button
          className="trainerConfirmClose"
          type="button"
          onClick={onCancel}
          aria-label="Закрыть"
          disabled={isBusy}
        >
          <X size={20} />
        </button>
        <header data-trainer-modal-header="true">
          <span>ПОДТВЕРЖДЕНИЕ</span>
          <h2>{title}</h2>
          <p>{text}</p>
        </header>
        {status ? <p className="trainerConfirmStatus" role="alert">{status}</p> : null}
        <footer data-trainer-modal-footer="true">
          <button type="button" onClick={onCancel} disabled={isBusy}>Отмена</button>
          <button className="danger" type="button" onClick={onConfirm} disabled={isBusy}>
            {isBusy ? "Сохранение…" : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ClientStatus({ status = {} }) {
  const statusId = status.id || "active";
  const fallback = {
    active: "Отлично",
    attention: "Нужна мотивация",
    noProgram: "Без программы",
    lost: "Риск срыва"
  };
  return (
    <span
      className={`trainerNextStatus ${statusId}`}
      title={status.detail || undefined}
      aria-label={status.detail ? `${status.label}. ${status.detail}` : status.label}
    >
      {status.label || fallback[statusId] || "Активен"}
    </span>
  );
}

function getClientStatusAction(item = {}) {
  const { client = {}, summary = {}, status = {}, attention = null } = item;
  const hasClientTask = !attention && (Number(summary.activeTrainerTasksCount ?? client.activeTrainerTasksCount) || 0) > 0;
  const statusId = hasClientTask ? "taskAssigned" : (attention ? "attention" : (status.id || "active"));
  const actionByType = {
    program: "Назначить программу",
    workout: "Проверить тренировку",
    feedback: "Открыть комментарий",
    programEnding: "Продлить программу",
    task: "Посмотреть задачи клиента",
    nutrition: "Проверить питание",
    measure: "Проверить замеры",
    payment: "Проверить оплату",
    activity: "Связаться с клиентом"
  };
  const actionByStatus = {
    noProgram: "Назначить программу",
    lost: "Связаться с клиентом",
    attention: "Открыть причину"
  };
  const isActive = statusId === "active" && !attention;
  const detail = hasClientTask
    ? "Ожидает выполнения клиентом"
    : (isActive ? "" : (attention?.reason || getAttentionReason(client, summary)));

  return {
    id: statusId,
    label: hasClientTask
      ? "Задача у клиента"
      : (isActive
        ? "Всё в порядке"
        : (actionByType[attention?.type] || actionByStatus[statusId] || "Открыть клиента")),
    detail,
    targetTab: getTrainerActionItemTargetTab({
      client,
      summary,
      status,
      attention,
      type: attention?.type || statusId
    })
  };
}

function TrainerNavigation({ activeSection, onNavigate, appVersion }) {
  const desktopItems = DESKTOP_NAV_ITEMS;
  const mobileItems = NAV_ITEMS.filter((item) => ["dashboard", "clients", "workouts", "library", "more"].includes(item.id));

  const renderButton = (item, mobile = false) => {
    const Icon = item.icon;
    const active = activeSection === item.id || (item.id === "more" && CABINET_SECTION_IDS.has(activeSection));
    return (
      <button
        type="button"
        key={item.id}
        data-section={item.id}
        data-testid={mobile ? `trainer-nav-${item.id}` : `trainer-desktop-nav-${item.id}`}
        className={active ? "active" : ""}
        onClick={() => onNavigate(item.id)}
        aria-current={active ? "page" : undefined}
      >
        <span className="trainerNextNavIcon">
          <Icon size={mobile ? 21 : 18} strokeWidth={1.8} />
          {item.badge ? <i>{item.badge}</i> : null}
        </span>
        <span>{mobile ? item.mobileLabel || item.label : item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="trainerNextDesktopDock" aria-label="Основное меню тренера">
        {appVersion ? (
          <span
            className="trainerNextDesktopDockVersion"
            aria-label={`Версия приложения ${appVersion}`}
          >
            {appVersion}
          </span>
        ) : null}
        {desktopItems.map((item) => renderButton(item))}
      </nav>

      <nav className="trainerNextMobileNav" aria-label="Разделы тренера">
        {mobileItems.map((item) => renderButton(item, true))}
      </nav>
      {appVersion ? (
        <span
          className="trainerNextMobileVersion"
          aria-label={`Версия приложения ${appVersion}`}
        >
          {appVersion}
        </span>
      ) : null}
    </>
  );
}

function TrainerModalScrollLock() {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncModalState = () => {
      setModalOpen(Boolean(document.querySelector('[data-trainer-modal-backdrop="true"]')));
    };
    const observer = new MutationObserver(syncModalState);

    syncModalState();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useBodyScrollLock(modalOpen, { lockHtml: true });
  return null;
}

export function TrainerShell({ activeSection, onNavigate, trainerName, trainerAvatar, appVersion, children }) {
  return (
    <div className={`trainerNextRoot ${workspaceStyles.workspaceRoot} ${cabinetStyles.scope} ${adaptiveStyles.root} ${responsiveStyles.scope} ${modalSystemStyles.scope} ${clientProfileSectionStyles.scope} ${programEditorStyles.scope} ${nutritionDiaryStyles.scope} ${clientWorkoutPlanStyles.scope} ${clientViewsStyles.scope} ${nutritionAnalyticsStyles.scope} ${clientNutritionStyles.scope} ${exerciseProgressStyles.scope} ${dashboardStyles.scope} ${primaryScreensStyles.scope}`}>
      <TrainerModalScrollLock />
      <TrainerNavigation
        activeSection={activeSection}
        onNavigate={onNavigate}
        trainerName={trainerName}
        trainerAvatar={trainerAvatar}
        appVersion={appVersion}
      />
      <main className="trainerNextMain">{children}</main>
      <div
        className={mobileStyles.mobileDockGuard}
        aria-hidden="true"
      />
    </div>
  );
}

function DashboardClientList({ clients, summaries, filter, search, onOpenClient }) {
  const filteredClients = buildTrainerClientListItems(clients, summaries, { search, filter });

  return (
    <>
    <div className={primaryScreensStyles.listContext}>
      <span>Показано: {filteredClients.length}</span>
      <details className={primaryScreensStyles.metricHelp}>
        <summary>О показателях<ChevronDown size={15} aria-hidden="true" /></summary>
        <p>Оценка /100 объединяет доступные данные тренировок, питания, замеров и регулярности. Это не процент выполнения программы.</p>
        <p>По программе — выполненные тренировки из всех назначенных. Питание — дни с записями за 7 завершённых дней, без сегодняшнего.</p>
        <p>Прочерк означает, что данных пока недостаточно. Нажмите на клиента, чтобы открыть подробности.</p>
      </details>
    </div>
    <div className="trainerNextClientTable">
      <div className="trainerNextClientTableHead">
        <span>Клиент</span><span>Оценка /100</span><span>По программе</span><span>Питание · 7 дней</span><span>Последняя запись</span><span>Состояние</span>
      </div>
      {filteredClients.map((item) => {
        const { client, summary } = item;
        const statusAction = getClientStatusAction(item);
        const clientDetail = statusAction.detail
          || (client.subscription ? getSubscriptionAttentionLabel(client.subscription) : "")
          || client.goalDescription
          || client.goal
          || getAttentionReason(client, summary);
        const assignedWorkoutCount = Math.max(0, Number(summary.assignedWorkoutCount) || 0);
        const completedWorkoutCount = Math.min(
          assignedWorkoutCount,
          Math.max(0, Number(summary.completedWorkoutCount) || 0)
        );
        const progressScore = getTrainerListProgressScore(summary.weeklyProgressScore);
        return (
          <button type="button" key={client.id} data-trainer-summary-client={client.id} onClick={() => onOpenClient(client, "overview")}>
            <span className="trainerNextClientIdentity">
              <TrainerAvatar client={client} size="small" />
              <span>
                <strong>{client.name || client.email || "Клиент"}{client.isTest ? " · Тестовый" : ""}</strong>
                <small>{clientDetail}</small>
                <small className={primaryScreensStyles.mobileActivity}>{item.lastActivityTimestamp ? `Запись: ${formatCompactDate(item.lastActivityTimestamp)}` : "Записей пока нет"}</small>
              </span>
            </span>
            <span className="positive" aria-label={progressScore === null ? "Недостаточно данных для оценки прогресса" : `Оценка прогресса: ${progressScore} из 100`}>
              <b>{progressScore === null ? "—" : `${progressScore} /100`}</b>
              <small className="trainerNextClientMetricLabel">Оценка /100</small>
            </span>
            <span className="trainerNextClientMetric"><b>{assignedWorkoutCount && !(summary.sources && summary.completedWorkoutCount == null) ? `${completedWorkoutCount} / ${assignedWorkoutCount}` : "—"}</b><small>По программе</small></span>
            <span className="trainerNextClientMetric"><b>{summary.sources && summary.nutritionDays7 == null ? "—" : `${summary.nutritionDays7 || 0} / 7`}</b><small>Дней с записями</small></span>
            <span className="trainerNextClientActivity"><b>{formatCompactDate(item.lastActivityTimestamp)}</b><small>Последняя запись</small></span>
            <ClientStatus status={{ ...statusAction, label: getTrainerListStatusLabel(statusAction, Boolean(client.assignedProgramId || client.programId || summary.assignedProgramId)) }} />
          </button>
        );
      })}
      {!filteredClients.length ? <div className="trainerNextEmpty">Клиенты не найдены. Измените имя или выбранный фильтр.</div> : null}
    </div>
    </>
  );
}

function getAttentionReason(client = {}, summary = {}) {
  const attentionState = getClientAttentionState(client, summary);
  if (attentionState?.reason) return attentionState.reason;
  if (summary.status?.id && summary.status.id !== "active") return summary.status.label || "Требуется внимание";
  if (!summary.lastWorkoutAt && !summary.lastNutritionAt) return "Нет недавней активности";
  return "Проверьте план и регулярность";
}

function getTrainerMessageAction(client = {}, summary = {}, fallbackReason = "") {
  const clientName = client.name || client.displayName || "клиент";
  const attentionState = getClientAttentionState(client, summary);
  const reason = fallbackReason || attentionState?.reason || getAttentionReason(client, summary);

  if (!client.assignedProgramId && !client.programId) {
    return {
      source: "План",
      title: "Назначить программу тренировок",
      text: `${clientName}: программа тренировок не назначена. Клиент не понимает, что делать дальше.`,
      actionLabel: "Что сделать: назначить программу или написать, когда она будет готова.",
      replyHint: "Например: «Я подготовлю тебе программу и напишу, когда можно начинать»",
      suggestions: [
        "Я вижу, что программа ещё не назначена. Подготовлю план и напишу, когда можно начинать.",
        "Сейчас проверю твой план тренировок и обновлю его под текущую цель."
      ]
    };
  }

  if (attentionState?.type === "workout") {
    return {
      source: "Тренировки",
      title: "Проверить плановую тренировку",
      text: `${clientName}: ${reason}. Возможно, нужен перенос, упрощение плана или короткая поддержка.`,
      actionLabel: "Что сделать: уточнить причину пропуска и предложить ближайшую тренировку.",
      replyHint: "Например: «Вижу, плановая тренировка не закрыта. Переносим или оставляем как пропуск?»",
      suggestions: [
        "Вижу, плановая тренировка не закрыта. Что помешало: время, самочувствие или нагрузка?",
        "Давай выберем ближайший день для тренировки и спокойно вернёмся в ритм."
      ]
    };
  }

  if (attentionState?.type === "nutrition") {
    return {
      source: "Питание",
      title: "Проверить ведение питания",
      text: `${clientName}: ${reason}. Оценка рациона может быть неточной.`,
      actionLabel: "Что сделать: попросить 2–3 дня записей или уточнить, нужна ли помощь с дневником.",
      replyHint: "Например: «Заполни питание пару дней подряд, и я проверю баланс»",
      suggestions: [
        "Заполни питание хотя бы 2–3 дня подряд, и я посмотрю, где можно улучшить рацион.",
        "Если неудобно записывать питание, напиши, что именно мешает — подберём простой вариант."
      ]
    };
  }

  if (!summary.lastWorkoutAt && !summary.lastNutritionAt) {
    return {
      source: "Активность",
      title: "Нет свежей активности",
      text: `${clientName}: давно нет новых тренировок или записей питания.`,
      actionLabel: "Что сделать: проверить связь с клиентом и мягко вернуть его в процесс.",
      replyHint: "Например: «Как самочувствие? Нужна корректировка плана?»",
      suggestions: [
        "Как самочувствие? Вижу, давно не было активности. Нужна корректировка плана?",
        "Напиши, пожалуйста, как проходит неделя — оставляем план или немного упростим?"
      ]
    };
  }

  return {
    source: "Проверка",
    title: reason || "Проверить клиента",
    text: `${clientName}: есть сигнал, который стоит проверить тренеру.`,
    actionLabel: "Что сделать: открыть карточку клиента, проверить последние данные и ответить только если нужна поддержка.",
    replyHint: "Например: коротко уточнить самочувствие или следующий шаг",
    suggestions: [
      "Проверил твои последние данные. Напиши, как самочувствие и всё ли понятно по плану?",
      "Вижу сигнал для проверки. Сейчас посмотрю детали и при необходимости скорректирую план."
    ]
  };
}

function TrainerDashboard({ actionCenter, trainerName, trainerUid, onOpenClient }) {

  return (
    <div className="trainerNextPage trainerNextDashboard">
      <header className="trainerNextMobileHeader">
        <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
        <h1 className="trainerNextMobileTitle">Обзор</h1>
        <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
      </header>

      <div className="trainerNextDesktopPageHead">
        <div><h1>Обзор</h1><p>Задачи и последние события клиентов</p></div>
      </div>

      <Suspense fallback={<section className={primaryScreensStyles.journalLoading} role="status">Загружаем события клиентов…</section>}>
        <TrainerDailyJournal
          trainerUid={trainerUid}
          actionCenter={actionCenter}
          onOpenClient={onOpenClient}
          renderAvatar={(client, size) => <TrainerAvatar client={client} size={size} />}
          trainerName={trainerName}
        />
      </Suspense>

    </div>
  );
}

function getTrainerSyncProgress(clients = [], clientSummaries = {}) {
  const total = clients.filter((client) => !client.archived && !client.isTest).length;
  const completed = clients.reduce((count, client) => (
    (clientSummaries[client.id]?.trainerSummarySettled || clientSummaries[client.id]?.trainerSummaryReady) ? count + 1 : count
  ), 0);

  if (!total) {
    return {
      completed: 0,
      total: 0,
      percent: 28,
      stage: "Подготавливаем рабочее место"
    };
  }

  if (!completed) {
    return {
      completed,
      total,
      percent: 12,
      stage: "Загружаем данные клиентов"
    };
  }

  return {
    completed,
    total,
    percent: Math.min(96, Math.max(16, Math.round(12 + (completed / total) * 84))),
    stage: completed === total
      ? "Обновляем аналитику"
      : `Обработано клиентов: ${completed} из ${total}`
  };
}

function TrainerSyncStatusToggle(props) {
  const [minimized, setMinimized] = useState(true);
  return <TrainerSyncStatus {...props} minimized={minimized} onMinimize={() => setMinimized(true)} onExpand={() => setMinimized(false)} />;
}

function TrainerSyncStatus({ clients, clientSummaries, minimized, onMinimize, onExpand }) {
  const progress = getTrainerSyncProgress(clients, clientSummaries);
  const progressLabel = `${progress.percent}%`;

  if (minimized) {
    return createPortal(
      <aside className={syncStyles.toast} role="status" aria-live="polite" aria-label={`Синхронизация: ${progressLabel}`}>
        <div className={syncStyles.toastTop}>
          <div>
            <strong>Синхронизация данных</strong>
            <span>{progress.stage}</span>
          </div>
          <button type="button" onClick={onExpand} aria-label="Показать ход синхронизации">
            <span>{progressLabel}</span>
            <ChevronUp size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={syncStyles.progressTrack} aria-hidden="true">
          <i style={{ width: `${progress.percent}%` }} />
        </div>
      </aside>,
      document.body
    );
  }

  return createPortal(
    <div className={syncStyles.overlay} role="dialog" aria-modal="true" aria-labelledby="trainer-sync-title" aria-describedby="trainer-sync-description">
      <section className={syncStyles.overlayCard}>
        <button className={syncStyles.close} type="button" onClick={onMinimize} aria-label="Продолжить синхронизацию в фоне">
          <X size={19} aria-hidden="true" />
        </button>
        <span className={syncStyles.spinner} aria-hidden="true" />
        <span className={syncStyles.eyebrow}>СИНХРОНИЗАЦИЯ</span>
        <strong id="trainer-sync-title">Обновляем рабочее пространство</strong>
        <p id="trainer-sync-description">{progress.stage}</p>
        <div className={syncStyles.progressMeta}>
          <span>{progress.total ? `${progress.completed} из ${progress.total} клиентов` : "Подключаем данные"}</span>
          <b>{progressLabel}</b>
        </div>
        <div className={syncStyles.progressTrack} aria-hidden="true">
          <i style={{ width: `${progress.percent}%` }} />
        </div>
        <button className={syncStyles.backgroundButton} type="button" onClick={onMinimize}>
          Продолжить в фоне
        </button>
      </section>
    </div>,
    document.body
  );
}

function getSubscriptionSessionDraft(subscription = {}) {
  return {
    purchasedSessions: Math.max(0, Math.trunc(Number(subscription.purchasedSessions ?? subscription.totalSessions) || 0)),
    usedSessions: Math.max(0, Math.trunc(Number(subscription.usedSessions) || 0))
  };
}

function getSubscriptionRangeDayProps(date, index, range) {
  const inside = Boolean(range.startDate && range.endDate && date >= range.startDate && date <= range.endDate);
  if (!inside) return {};
  return {
    "data-subscription-range": "true",
    "data-range-start": date === range.startDate ? "true" : undefined,
    "data-range-end": date === range.endDate ? "true" : undefined,
    "data-range-row-start": index % 7 === 0 || date === range.startDate ? "true" : undefined,
    "data-range-row-end": index % 7 === 6 || date === range.endDate ? "true" : undefined
  };
}

function SubscriptionResumeChoice({ available, checked, onChange, disabled }) {
  if (!available) return null;
  return <label className={workspaceFeatureStyles.subscriptionResumeChoice}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span>Возобновить абонемент</span>
  </label>;
}

function useSubscriptionResumeChoice(clientId, editing) {
  const [choice, setChoice] = useState(() => ({ clientId, editing, enabled: false }));
  const matches = choice.clientId === clientId && choice.editing === editing;
  // Reset with the editor identity, before a different client/session can
  // render an old opt-in. This is derived state, not an effect synchronization.
  if (!matches) setChoice({ clientId, editing, enabled: false });
  return [matches && choice.enabled, enabled => setChoice({ clientId, editing, enabled })];
}

export function ClientSubscriptionCard({ client, onSave, onSaved, open: controlledOpen, onOpenChange, inline = false }) {
  const subscription = client?.subscription || {};
  const status = getSubscriptionStatus(subscription, new Date());
  const [localOpen, setLocalOpen] = useState(() => new URLSearchParams(window.location.search).get("subscription") === "renew");
  const open = typeof controlledOpen === "boolean" ? controlledOpen : localOpen;
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [draft, setDraft] = useState(() => getSubscriptionSessionDraft(subscription));
  const [resumeSubscription, setResumeSubscription] = useSubscriptionResumeChoice(client?.id, open);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") !== "renew") return;
    params.delete("subscription");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  function setOpen(nextOpen) {
    if (typeof controlledOpen !== "boolean") setLocalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function openEditor() {
    setDraft(getSubscriptionSessionDraft(subscription));
    setSaveStatus("");
    setOpen(true);
  }

  async function submit(renewSubscription = false) {
    setSaving(true);
    setSaveStatus("");
    try {
      const saved = await onSave?.({
        subscriptionOnly: true,
        renewSubscription,
        resumeSubscription: status.id === "frozen" && resumeSubscription,
        subscription: {
          ...subscription,
          periodMode: "sessions",
          purchasedSessions: draft.purchasedSessions,
          usedSessions: draft.usedSessions
        }
      });
      setSaveStatus(saved === false ? "error" : "saved");
      if (saved !== false) {
        setResumeSubscription(false);
        await onSaved?.();
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const inlineEditor = (
    <section className="trainerInlineSubscription" aria-label="Настройка абонемента клиента">
      <header>
        <div><span>АБОНЕМЕНТ</span><h2>Абонемент клиента</h2><p>Количество проданных и выполненных занятий.</p></div>
        <i className={status.tone}>{status.label}</i>
      </header>
      <div className="trainerInlineSubscriptionGrid">
        <label><small>Продано занятий</small><input type="number" min="0" step="1" inputMode="numeric" value={draft.purchasedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, purchasedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>
        <label><small>Выполнено занятий</small><input type="number" min="0" step="1" inputMode="numeric" value={draft.usedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, usedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>
      </div>
      <SubscriptionResumeChoice available={status.id === "frozen"} checked={resumeSubscription} onChange={setResumeSubscription} disabled={saving} />
      <div className="trainerInlineSubscriptionSummary">
        <strong>Осталось: {Math.max(0, draft.purchasedSessions - draft.usedSessions)} тренировок</strong>
      </div>
      <footer>
        {saveStatus === "error" ? <span className={workspaceFeatureStyles.error}>Не удалось сохранить</span> : null}
        <button type="button" className="trainerNextPrimary" disabled={saving} onClick={() => submit(false)}>{saving ? "Сохранение…" : "Сохранить абонемент"}</button>
      </footer>
    </section>
  );

  return (
    <>
      {inline ? inlineEditor : (
        <section className={workspaceFeatureStyles.overviewSubscription} aria-label="Абонемент клиента">
          <header>
            <div><span>АБОНЕМЕНТ</span><h3>Абонемент клиента</h3></div>
            <i className={status.tone}>{status.label}</i>
          </header>
          <div className={workspaceFeatureStyles.overviewSubscriptionMetrics}>
            <span><small>Осталось</small><strong>{status.remainingSessions || 0}</strong><em>тренировок</em></span>
            <span><small>Продано</small><strong>{status.purchasedSessions || 0}</strong></span>
            <span><small>Выполнено</small><strong>{status.usedSessions || 0}</strong></span>
          </div>
          <button type="button" onClick={openEditor}>Редактировать</button>
        </section>
      )}

      {open && !inline ? (
        <div className={`trainerNextModalBackdrop ${workspaceFeatureStyles.subscriptionModalBackdrop}`} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className={workspaceFeatureStyles.subscriptionModal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-subscription-modal-title">
            <button type="button" className={workspaceFeatureStyles.subscriptionModalClose} onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            <header data-trainer-modal-header="true"><span>АБОНЕМЕНТ</span><h2 id="trainer-subscription-modal-title">Редактирование абонемента</h2><p>Количество проданных и выполненных занятий.</p></header>
            <div data-trainer-modal-content="true">
            <div className={workspaceFeatureStyles.subscriptionModalGrid}>
              <label><small>Продано занятий</small><input type="number" min="0" step="1" inputMode="numeric" value={draft.purchasedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, purchasedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>
              <label><small>Выполнено занятий</small><input type="number" min="0" step="1" inputMode="numeric" value={draft.usedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, usedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>
            </div>
            <div className={workspaceFeatureStyles.subscriptionModalSummary}>
              <strong>Осталось: {Math.max(0, draft.purchasedSessions - draft.usedSessions)} тренировок</strong>
            </div>
            <SubscriptionResumeChoice available={status.id === "frozen"} checked={resumeSubscription} onChange={setResumeSubscription} disabled={saving} />
            </div>
            <footer data-trainer-modal-footer="true">
              {saveStatus === "error" ? <span className={workspaceFeatureStyles.error}>Не удалось сохранить</span> : null}
              <button type="button" disabled={saving} onClick={() => setOpen(false)}>Отмена</button>
              <button type="button" disabled={saving} onClick={() => submit(true)}>Продлить</button>
              <button type="button" className="trainerNextPrimary" disabled={saving} onClick={() => submit(false)}>{saving ? "Сохранение…" : "Сохранить"}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ClientCalendarSubscriptionFields({ client, draft, onChange, onSave, onSaved, editing, onEdit, onCancel, showEditAction = true, showStatus = true, showRemaining = true }) {
  const subscription = client?.subscription || {};
  const status = getSubscriptionStatus({ ...subscription, ...draft }, new Date());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [resumeSubscription, setResumeSubscription] = useSubscriptionResumeChoice(client?.id, editing);
  const remainingSessions = Math.max(0, Number(draft.purchasedSessions || 0) - Number(draft.usedSessions || 0));

  async function saveSubscription() {
    if (!onSave || saving) return;
    setSaving(true);
    setSaveStatus("");
    try {
      const saved = await onSave({
        subscriptionOnly: true,
        resumeSubscription: status.id === "frozen" && resumeSubscription,
        subscription: {
          ...subscription,
          periodMode: "sessions",
          ...getSubscriptionSessionDraft(draft)
        }
      });
      if (saved === false) {
        setSaveStatus("error");
        return;
      }
      setSaveStatus("saved");
      setResumeSubscription(false);
      await onSaved?.();
    } catch (error) {
      console.error("Unable to save subscription calendar settings:", error);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <section className="trainerCalendarSubscriptionFields trainerCalendarSubscriptionSummary" aria-label="Абонемент клиента">
        <div className="trainerCalendarSubscriptionRange" aria-live="polite">
          <span>Продано занятий: <b>{draft.purchasedSessions}</b></span>
          <span>Выполнено занятий: <b>{draft.usedSessions}</b></span>
          {showStatus ? <i className={status.tone}>{status.label}</i> : null}
        </div>
        {showRemaining || subscription.frozen || showEditAction ? <footer>
          {showRemaining ? <span>Осталось: <b>{remainingSessions}</b> тренировок</span> : null}
          {subscription.frozen ? <span>Заморожен</span> : null}
          {showEditAction ? <button type="button" className="trainerCalendarSubscriptionEdit" onClick={onEdit}>Изменить абонемент</button> : null}
        </footer> : null}
      </section>
    );
  }

  return (
    <section className="trainerCalendarSubscriptionFields" aria-label="Параметры абонемента">
      <div className="trainerCalendarSubscriptionInputs">
        <label><small>Продано занятий</small><input type="number" min="0" step="1" inputMode="numeric" value={draft.purchasedSessions} onFocus={(event) => event.target.select()} onChange={(event) => onChange((current) => ({ ...current, purchasedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>
        <label><small>Выполнено занятий</small><input type="number" min="0" step="1" inputMode="numeric" value={draft.usedSessions} onFocus={(event) => event.target.select()} onChange={(event) => onChange((current) => ({ ...current, usedSessions: Math.max(0, Math.trunc(Number(event.target.value) || 0)) }))} /></label>
      </div>
      <footer>
        <span>Осталось: <b>{remainingSessions}</b> тренировок</span>
        {saveStatus === "error" ? <strong className={workspaceFeatureStyles.error}>Не удалось сохранить</strong> : null}
        {onCancel ? <button type="button" className="trainerCalendarSubscriptionCancel" disabled={saving} onClick={onCancel}>Отмена</button> : null}
        <button type="button" className="trainerNextPrimary" disabled={!onSave || saving} onClick={saveSubscription}>{saving ? "Сохранение…" : "Сохранить"}</button>
      </footer>
      <SubscriptionResumeChoice available={status.id === "frozen"} checked={resumeSubscription} onChange={setResumeSubscription} disabled={saving} />
    </section>
  );
}

function ClientSectionLaunchButton({ icon: Icon, title, description, onClick }) {
  return (
    <button type="button" className={clientOverviewStyles.sectionLauncher} onClick={onClick}>
      <span className={clientOverviewStyles.sectionLauncherIcon}><Icon size={22} /></span>
      <span className={clientOverviewStyles.sectionLauncherCopy}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ChevronRight className={clientOverviewStyles.sectionLauncherArrow} size={20} />
    </button>
  );
}

function ClientOverview({
  client,
  onLoadMoreHistory,
  workouts = [],
  snapshot,
  workoutReview,
  measurements,
  history,
  nutritionDays,
  nutritionGoals,
  onTabChange,
  onOpenCalendar,
  onOpenTasks,
  onOpenFeedback,
  onOpenMessage,
  onOpenMessages,
  onOpenAccessInfo,
  onOpenWorkoutHistory,
  onOpenExerciseProgress
}) {
  const familiar = isTrainerV2Path(window.location.pathname);
  const latestBodyMeasurement = (Array.isArray(measurements) ? measurements : []).filter(isBodyMeasurementRecord)
    .sort((a, b) => (getMeasurementDate(b)?.getTime() || 0) - (getMeasurementDate(a)?.getTime() || 0))[0];
  const progress = <TrainerClientProgressDashboard
    key={client?.id || "client-progress"}
    historyCoverage={getTrainerHistoryCoverage(client)}
    onLoadMoreHistory={onLoadMoreHistory}
    nutritionLoadError={client?.trainerNutritionLoadError === true}
    measurements={measurements}
    history={history}
    nutritionDays={nutritionDays}
    nutritionGoals={nutritionGoals}
  />;
  const tools = <>
    <AppleRecent note={getWorkoutNoteItems(history)[0]} lastMeasurement={latestBodyMeasurement ? formatCompactDate(getMeasurementDate(latestBodyMeasurement)) : ""} onFeedback={onOpenFeedback} onMeasurements={() => onTabChange("bodyProgress")} onTraining={() => onTabChange("workouts")} onProgress={onOpenExerciseProgress} />
    <AppleGroup title="Работа с клиентом">
      <AppleRow icon={ClipboardList} title="Задания клиенту" description="Текущие задания и результаты" onClick={onOpenTasks} />
      <AppleRow icon={MessageSquare} title="Сообщения" description="Переписка с клиентом" onClick={onOpenMessages} />
      <AppleRow icon={User} title="Данные для входа и связи" description="Логин, почта и Telegram клиента" onClick={onOpenAccessInfo} />
    </AppleGroup>
  </>;
  return (
    <div className="trainerNextClientOverview trainerClientTabContent">
      <ClientOverviewAttention
        client={client}
        snapshot={snapshot}
        workoutReview={workoutReview}
        history={history}
        onTabChange={onTabChange}
        onOpenCalendar={onOpenCalendar}
        onOpenTasks={onOpenTasks}
        onOpenFeedback={onOpenFeedback}
        onOpenWorkoutHistory={onOpenWorkoutHistory}
        onOpenMessage={onOpenMessage}
      />
      <ClientWorkSummary
        client={client}
        workouts={workouts}
        history={history}
        snapshot={snapshot}
        workoutReview={workoutReview}
        measurements={measurements}
        nutritionDays={nutritionDays}
        nutritionGoals={nutritionGoals}
        onTabChange={onTabChange}
      />
      {familiar ? <div className={familiarStyles.overviewColumns}>{progress}<div className={familiarStyles.overviewAside}>{tools}</div></div> : progress}
      {!isTrainerV2Path(window.location.pathname) ? <ClientSectionLaunchButton
        icon={BarChart3}
        title="Открыть прогресс упражнений"
        description="Сравнения нагрузки, адаптация и решения по упражнениям"
        onClick={onOpenExerciseProgress}
      /> : null}
    </div>
  );
}

function ClientMeasurements({ measurements = [], separated = false, detailed = false }) {
  const [expanded, setExpanded] = useState(false);
  const [measurementView, setMeasurementView] = useState("");
  const safeMeasurements = (Array.isArray(measurements) ? measurements : []).filter(isBodyMeasurementRecord);
  const sortedMeasurements = safeMeasurements
    .slice()
    .sort((a, b) => (getMeasurementDate(b)?.getTime() || 0) - (getMeasurementDate(a)?.getTime() || 0));
  const latest = sortedMeasurements[0] || null;
  const previous = sortedMeasurements[1] || null;
  const weightField = MEASUREMENT_FIELDS.find((item) => item.id === "weight");
  const bellyField = MEASUREMENT_FIELDS.find((item) => item.id === "belly");
  const chestField = MEASUREMENT_FIELDS.find((item) => item.id === "chest");
  const latestDate = getMeasurementDate(latest);
  const daysSinceLatest = latestDate ? getLocalDaysSince(latestDate) : null;
  const latestWeight = latest ? getMeasurementFieldValue(latest, weightField) : null;
  const previousWeight = previous ? getMeasurementFieldValue(previous, weightField) : null;
  const latestBelly = latest ? getMeasurementFieldValue(latest, bellyField) : null;
  const previousBelly = previous ? getMeasurementFieldValue(previous, bellyField) : null;
  const latestChest = latest ? getMeasurementFieldValue(latest, chestField) : null;
  const previousChest = previous ? getMeasurementFieldValue(previous, chestField) : null;
  const weightDelta = getMeasurementDelta(latestWeight, previousWeight);
  const bellyDelta = getMeasurementDelta(latestBelly, previousBelly);
  const chestDelta = getMeasurementDelta(latestChest, previousChest);
  const chartData = sortedMeasurements
    .slice(0, 8)
    .reverse()
    .map((item, index) => ({
      index,
      date: getMeasurementDate(item),
      value: getMeasurementFieldValue(item, weightField)
    }))
    .filter((item) => item.value !== null);
  const chartValues = chartData.map((item) => item.value);
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length ? Math.max(...chartValues) : 0;
  const chartSpan = chartMax - chartMin || 1;
  const chartStep = chartData.length > 1 ? 268 / (chartData.length - 1) : 0;
  const chartPoints = chartData
    .map((item, index) => {
      const x = 22 + chartStep * index;
      const y = 88 - ((item.value - chartMin) / chartSpan) * 54;
      return `${roundTrainerNumber(x, 2)},${roundTrainerNumber(y, 2)}`;
    })
    .join(" ");
  const insight = (() => {
    if (!latest) {
      return {
        title: "Нет замеров",
        text: "Попросите клиента пройти замеры, чтобы видеть динамику веса и объёмов."
      };
    }
    if (daysSinceLatest !== null && daysSinceLatest > 14) {
      return {
        title: "Замеры пора обновить",
        text: `Последняя запись была ${formatCompactDate(latestDate)}. Для контроля прогресса лучше обновлять замеры раз в 2 недели.`
      };
    }
    if (bellyDelta !== null && bellyDelta < 0 && (weightDelta === null || weightDelta >= -1)) {
      return {
        title: "Хороший сигнал по форме",
        text: "Талия уменьшается без резкого падения веса. Это похоже на аккуратную рекомпозицию."
      };
    }
    if (weightDelta !== null && Math.abs(weightDelta) >= 2) {
      return {
        title: "Есть заметное изменение веса",
        text: "Проверьте, совпадает ли динамика веса с целью клиента и текущим планом питания."
      };
    }
    return {
      title: "Динамика спокойная",
      text: "Резких изменений нет. Следите за регулярностью замеров и сопоставляйте их с тренировками и питанием."
    };
  })();
  const measurementRows = MEASUREMENT_FIELDS.map((field) => {
    const current = latest ? getMeasurementFieldValue(latest, field) : null;
    const previousValue = previous ? getMeasurementFieldValue(previous, field) : null;
    const delta = getMeasurementDelta(current, previousValue);
    return { field, current, delta };
  });

  if (isTrainerV2Path(window.location.pathname) && !detailed) {
    return (
      <>
      <AppleGroup title="Замеры тела" className={appleStyles.measurements}>
        {latest ? <>
          <div className={appleStyles.measurementIntro}>
            <strong>Последний замер тела · {formatCompactDate(latestDate)}</strong>
            <span>{previous ? `Изменения с ${formatCompactDate(getMeasurementDate(previous))}` : "После следующего замера появится сравнение"}</span>
            <span>Даты замеров не связаны с выбранными фотографиями.</span>
          </div>
          <div className={appleStyles.measurementList}>
            {measurementRows.filter(({ current }) => current !== null).slice(0, 4).map(({ field, current, delta }) => (
              <div className={appleStyles.measurementItem} key={field.id}>
                <span>{field.label}</span>
                <strong>{current !== null ? formatMeasurementValue(current, field.unit) : "Не заполнено"}</strong>
                {delta !== null ? <small>{delta === 0 ? "Без изменений" : formatSignedDelta(delta, field.unit)}</small> : null}
              </div>
            ))}
          </div>
          {!measurementRows.some(({ current }) => current !== null) ? <p className={appleStyles.measurementIntro}>В этой записи показатели не заполнены.</p> : null}
          <button type="button" className={appleStyles.measurementToggle} aria-haspopup="dialog" onClick={() => setMeasurementView("fields")}>Все 12 показателей<ChevronRight size={16} aria-hidden="true" /></button>
          <div className={appleStyles.measurementDetails}>
            <AppleRow title="История замеров" description={`${sortedMeasurements.length} ${pluralize(sortedMeasurements.length, "запись", "записи", "записей")} · выбрать дату`} icon={History} onClick={() => setMeasurementView("history")} />
            <AppleRow title="Графики и анализ" description="Динамика веса и объёмов" icon={BarChart3} onClick={() => setMeasurementView("trend")} />
          </div>
        </> : <div className={appleStyles.measurementIntro}>Полных замеров пока нет. Отдельные записи веса доступны в сводке, в разделе «Динамика → Вес».</div>}
      </AppleGroup>
      {measurementView && latest ? <TrainerMeasurementsModal key={measurementView} initialView={measurementView} measurements={sortedMeasurements} fields={MEASUREMENT_FIELDS} getDate={getMeasurementDate} getValue={getMeasurementFieldValue} insight={insight} onClose={() => setMeasurementView("")} /> : null}
      </>
    );
  }

  return (
    <section className={`trainerNextSimplePanel${separated ? " trainerClientMeasurementsSection" : ""}`}>
      <div className="trainerNextPanelTitle trainerMeasurementPanelTitle">
        <div><h2>Замеры</h2><p>Последние изменения параметров тела</p></div>
        {latest ? (
          <button type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Свернуть" : "Развернуть"}
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        ) : null}
      </div>
      {!latest ? (
        <div className="trainerNextEmpty">Клиент еще не добавил замеры.</div>
      ) : !expanded ? (
        <div className="trainerMeasurementCollapsed">
          <div>
            <article>
              <span>Вес</span>
              <strong>{formatMeasurementValue(latestWeight, "кг")}</strong>
              <small className={getDeltaTone(weightDelta, false)}>{formatSignedDelta(weightDelta, "кг")}</small>
            </article>
            <article>
              <span>Талия</span>
              <strong>{formatMeasurementValue(latestBelly, "см")}</strong>
              <small className={getDeltaTone(bellyDelta, true)}>{formatSignedDelta(bellyDelta, "см")}</small>
            </article>
            <article>
              <span>Последний</span>
              <strong>{formatCompactDate(latestDate)}</strong>
              <small>{daysSinceLatest === 0 ? "сегодня" : `${daysSinceLatest ?? "—"} дн. назад`}</small>
            </article>
          </div>
          <p><b>{insight.title}</b>{insight.text}</p>
        </div>
      ) : (
        <div className="trainerMeasurementDashboard">
          <div className="trainerMeasurementSummaryGrid">
            <article>
              <span>Текущий вес</span>
              <strong>{formatMeasurementValue(latestWeight, "кг")}</strong>
              <small className={getDeltaTone(weightDelta, false)}>{formatSignedDelta(weightDelta, "кг")}</small>
            </article>
            <article>
              <span>Талия</span>
              <strong>{formatMeasurementValue(latestBelly, "см")}</strong>
              <small className={getDeltaTone(bellyDelta, true)}>{formatSignedDelta(bellyDelta, "см")}</small>
            </article>
            <article>
              <span>Грудь</span>
              <strong>{formatMeasurementValue(latestChest, "см")}</strong>
              <small className={getDeltaTone(chestDelta, false)}>{formatSignedDelta(chestDelta, "см")}</small>
            </article>
            <article>
              <span>Последний замер</span>
              <strong>{formatCompactDate(latestDate)}</strong>
              <small>{daysSinceLatest === 0 ? "сегодня" : `${daysSinceLatest ?? "—"} дн. назад`}</small>
            </article>
          </div>

          <div className="trainerMeasurementMainGrid">
            <article className="trainerMeasurementInsight">
              <span>ВЫВОД</span>
              <h3>{insight.title}</h3>
              <p>{insight.text}</p>
            </article>
            <article className="trainerMeasurementChart">
              <header><span>Вес по замерам</span><strong>{chartData.length} записей</strong></header>
              {chartData.length >= 2 ? (
                <>
                  <svg viewBox="0 0 312 112" role="img" aria-label="Динамика веса по замерам">
                    {[34, 61, 88].map((y) => <line key={y} x1="18" y1={y} x2="294" y2={y} />)}
                    <polyline points={chartPoints} />
                    {chartPoints.split(" ").map((point, index) => {
                      const [cx, cy] = point.split(",");
                      return <circle key={`${point}-${index}`} cx={cx} cy={cy} r="3" />;
                    })}
                  </svg>
                  <div>
                    <small>{formatCompactDate(chartData[0]?.date)}</small>
                    <small>{formatCompactDate(chartData.at(-1)?.date)}</small>
                  </div>
                </>
              ) : (
                <p>Добавьте ещё один замер, чтобы увидеть линию динамики.</p>
              )}
            </article>
          </div>

          <div className="trainerMeasurementFieldGrid">
            {measurementRows.map(({ field, current, delta }) => (
              <article key={field.id}>
                <span>{field.label}</span>
                <strong>{formatMeasurementValue(current, field.unit)}</strong>
                <small className={getDeltaTone(delta, field.id === "belly")}>{formatSignedDelta(delta, field.unit)}</small>
              </article>
            ))}
          </div>

          <div className="trainerMeasurementTimeline">
            <h3>История замеров</h3>
            {sortedMeasurements.slice(0, 8).map((item, index) => {
              const itemWeight = getMeasurementFieldValue(item, weightField);
              const itemBelly = getMeasurementFieldValue(item, bellyField);
              return (
                <article key={item.id || `${item.date || item.createdAt}-${index}`}>
                  <time>{formatCompactDate(getMeasurementDate(item))}</time>
                  <strong>{formatMeasurementValue(itemWeight, "кг")}</strong>
                  <span>Талия {formatMeasurementValue(itemBelly, "см")}</span>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function ClientPhotos({ photos }) {
  const isV2 = isTrainerV2Path(window.location.pathname);
  const photoViews = [
    { id: "front", label: "Спереди", key: "frontUrl" },
    { id: "side", label: "Сбоку", key: "sideUrl" },
    { id: "back", label: "Со спины", key: "backUrl" }
  ];
  const [view, setView] = useState("front");
  const [openPhotoId, setOpenPhotoId] = useState("");
  const [compareIds, setCompareIds] = useState(["", ""]);
  const sortedPhotos = photos.slice().sort((a, b) => {
    const dateA = getWorkspaceDate(a.date || a.createdAt)?.getTime() || 0;
    const dateB = getWorkspaceDate(b.date || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });
  const chronologicalSelection = isV2 ? getTrainerPhotoCompareSelection(sortedPhotos, compareIds) : null;
  const photoDateValue = photo => chronologicalSelection?.options.find(option => option.photo === photo)?.date || photo?.date || photo?.createdAt;
  const getPhotoUrl = (photo, targetView = view) => {
    const viewConfig = photoViews.find((item) => item.id === targetView) || photoViews[0];
    const viewUrl = photo?.[viewConfig.key];
    if (viewUrl) return viewUrl;
    // Older uploads occasionally have one generic image URL. Treat it as a
    // front view only: showing the same image for every angle is misleading.
    return targetView === "front" ? (photo?.url || photo?.photoUrl || "") : "";
  };
  function getPhotoId(photo, index) {
    return isV2 ? getTrainerProgressPhotoId(photo, index) : String(photo.id || photo.createdAt || photo.date || `photo-${index}`);
  }
  const getPhotoViewLabel = (targetView = view) => (
    (photoViews.find((item) => item.id === targetView) || photoViews[0]).label.toLowerCase()
  );
  const renderPhotoMedia = (photo, targetView = view, allowRetry = true) => {
    const photoUrl = getPhotoUrl(photo, targetView);
    const photoDate = formatCompactDate(photoDateValue(photo));
    const viewLabel = getPhotoViewLabel(targetView);

    if (!photoUrl) {
      return (
        <span className="trainerPhotoMediaPlaceholder" aria-label={`Нет фото ${viewLabel}`}>
          <Camera size={28} />
          <small>Нет фото {viewLabel}</small>
        </span>
      );
    }

    return (
      <PrivateProgressPhoto
        source={photoUrl}
        allowRetry={allowRetry}
        alt={`Фото клиента ${viewLabel}: ${photoDate}`}
      />
    );
  };
  if (isV2 && !sortedPhotos.length) {
    return <section className="trainerNextSimplePanel trainerClientEmptyPhotos">
      <Camera size={32} aria-hidden="true" />
      <h2>Фото пока нет</h2>
      <p>Когда клиент добавит фотографии, здесь можно будет сравнить две даты и выбрать ракурс.</p>
      <small>Замеры доступны в соседнем разделе.</small>
    </section>;
  }
  const activePhoto = sortedPhotos.find((photo, index) => getPhotoId(photo, index) === openPhotoId);
  const effectiveCompareIds = chronologicalSelection ? chronologicalSelection.ids : compareIds;
  const comparePhotos = chronologicalSelection ? chronologicalSelection.photos : effectiveCompareIds.map((id) => sortedPhotos.find((photo, index) => getPhotoId(photo, index) === id)).filter(Boolean);
  const photoOptions = chronologicalSelection?.options || [];
  const comparisonTimes = comparePhotos.map(photo => getWorkspaceDate(photoDateValue(photo))?.getTime());

  return (
    <section className="trainerNextSimplePanel">
      <div className="trainerNextPanelTitle">
        <div><h2>{isV2 ? "Сравнение фото" : "Фото прогресса"}</h2><p>Фотосессии клиента по датам</p></div>
        <div className="trainerPhotoViewTabs">
          {photoViews.map((item) => <button type="button" className={view === item.id ? "active" : ""} aria-pressed={view === item.id} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
        </div>
      </div>

      {(isV2 ? chronologicalSelection.hasChronologicalPair : sortedPhotos.length >= 2) ? (
        <div className="trainerPhotoComparePanel">
          <div>
            <strong>Сравнить фотосессии</strong>
            <p>Выберите две даты и ракурс для крупного сравнения.</p>
          </div>
          <label className="trainerPhotoDateLabel">{isV2 ? <span>До</span> : null}<select aria-label="Первая фотосессия для сравнения" value={effectiveCompareIds[0]} onChange={(event) => setCompareIds([event.target.value, effectiveCompareIds[1]])}>
            {!isV2 ? <option value="">Первая дата</option> : null}
            {isV2 ? photoOptions.map(option => <option value={option.id} key={`a-${option.id}`} disabled={option.date.getTime() >= comparisonTimes[1]}>{formatCompactDate(option.date)}</option>) : sortedPhotos.map((photo, index) => <option value={getPhotoId(photo, index)} key={`a-${getPhotoId(photo, index)}`}>{formatCompactDate(photo.date || photo.createdAt)}</option>)}
          </select></label>
          <label className="trainerPhotoDateLabel">{isV2 ? <span>После</span> : null}<select aria-label="Вторая фотосессия для сравнения" value={effectiveCompareIds[1]} onChange={(event) => setCompareIds([effectiveCompareIds[0], event.target.value])}>
            {!isV2 ? <option value="">Вторая дата</option> : null}
            {isV2 ? photoOptions.map(option => <option value={option.id} key={`b-${option.id}`} disabled={option.date.getTime() <= comparisonTimes[0]}>{formatCompactDate(option.date)}</option>) : sortedPhotos.map((photo, index) => <option value={getPhotoId(photo, index)} key={`b-${getPhotoId(photo, index)}`}>{formatCompactDate(photo.date || photo.createdAt)}</option>)}
          </select></label>
        </div>
      ) : null}

      {(comparePhotos.length === 2 || (isV2 && comparePhotos.length > 0)) ? (
        <div className="trainerPhotoCompareGrid">
          {comparePhotos.map((photo, index) => (
            <figure key={`compare-${index}-${getPhotoId(photo, sortedPhotos.indexOf(photo))}`}>
              {isV2 ? <button type="button" onClick={() => setOpenPhotoId(getPhotoId(photo, sortedPhotos.indexOf(photo)))} aria-label={`Открыть сравниваемое фото: ${formatCompactDate(photoDateValue(photo))}`}>
                {renderPhotoMedia(photo, view, false)}
              </button> : renderPhotoMedia(photo)}
              <figcaption>{isV2 && chronologicalSelection.hasChronologicalPair ? `${index === 0 ? "До" : "После"} · ` : ""}{formatCompactDate(photoDateValue(photo))}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {isV2 && !chronologicalSelection.hasChronologicalPair ? <p className={familiarStyles.photoHint}>Для сравнения нужны фотографии с двух разных дат. Доступные снимки можно открыть ниже.</p> : null}

      <TrainerClientDisclosure title={`Все фотосессии · ${sortedPhotos.length}`}>
      <div className="trainerNextPhotoGrid">
        {sortedPhotos.map((photo, index) => (
          <figure key={getPhotoId(photo, index)}>
            <button type="button" onClick={() => setOpenPhotoId(getPhotoId(photo, index))} aria-label="Открыть фото клиента">
              {renderPhotoMedia(photo, view, false)}
            </button>
            <figcaption>{formatCompactDate(photoDateValue(photo))}</figcaption>
          </figure>
        ))}
        {!sortedPhotos.length ? <div className="trainerNextEmpty">Фото прогресса пока не добавлены.</div> : null}
      </div>

      </TrainerClientDisclosure>

      {activePhoto ? (
        <div className="trainerClientModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onClick={() => setOpenPhotoId("")}>
          <section className="trainerPhotoPreviewModal" role="dialog" aria-modal="true" aria-label="Просмотр фото клиента" data-trainer-modal-surface="true" data-trainer-modal-frame="true" onClick={(event) => event.stopPropagation()}>
            <header data-trainer-modal-header="true">
              <div><span>ФОТО КЛИЕНТА</span><h2>{formatCompactDate(photoDateValue(activePhoto))}</h2></div>
              <button className="trainerNextModalClose" type="button" onClick={() => setOpenPhotoId("")} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <div className="trainerPhotoPreviewBody" data-trainer-modal-content="true">
              <div className="trainerPhotoViewTabs">
                {photoViews.map((item) => <button type="button" className={view === item.id ? "active" : ""} aria-pressed={view === item.id} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
              </div>
              <div className="trainerPhotoPreviewImage">
                {renderPhotoMedia(activePhoto, view, true)}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ClientBodyProgress({ measurements, photos }) {
  return (
    <div className="trainerClientBodyProgress trainerClientTabContent">
      <ClientPhotos photos={photos} />
      <ClientMeasurements measurements={measurements} separated />
    </div>
  );
}

function ClientMessages({
  history = [],
  historyCoverage = "complete",
  onLoadMoreHistory,
  onReplyToMessage,
  onMarkAllProcessed,
  processedMessageIds = new Set(),
  resolvingAll = false,
  resolutionStatus = "",
  embedded = false
}) {
  const messages = getWorkoutNoteItems(history);
  const [filter, setFilter] = useState("pending");
  const [expanded, setExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [confirmAll, setConfirmAll] = useState(null);
  const [actionPending, setActionPending] = useState("");
  const [actionError, setActionError] = useState("");
  const resolvePendingRef = useRef(false);
  const processedCount = messages.filter((message) => processedMessageIds.has(message.id)).length;
  const pendingCount = messages.length - processedCount;
  const pendingMessages = messages.filter((message) => !processedMessageIds.has(message.id));
  const filteredMessages = messages.filter((message) => {
    if (filter === "pending") return !processedMessageIds.has(message.id);
    if (filter === "processed") return processedMessageIds.has(message.id);
    return true;
  });
  const visibleMessages = expanded ? filteredMessages : filteredMessages.slice(0, 6);
  const hiddenCount = Math.max(0, filteredMessages.length - visibleMessages.length);
  const filters = [
    { id: "pending", label: "Требуют внимания", count: pendingCount },
    { id: "processed", label: "Обработанные", count: processedCount },
    { id: "all", label: "Все", count: messages.length }
  ];

  function selectFilter(nextFilter) {
    setFilter(nextFilter);
    setExpanded(false);
    setConfirmAll(null);
    setActionError("");
  }

  async function resolveNotes(items, key) {
    if (!onMarkAllProcessed || resolvingAll || resolvePendingRef.current) return;
    resolvePendingRef.current = true;
    setActionPending(key);
    setActionError("");
    try {
      const saved = await onMarkAllProcessed(items);
      if (saved === false) setActionError("Не удалось отметить сообщения. Попробуйте ещё раз.");
      else setConfirmAll(null);
    } catch {
      setActionError("Не удалось отметить сообщения. Попробуйте ещё раз.");
    } finally {
      resolvePendingRef.current = false;
      setActionPending("");
    }
  }

  return (
    <section className={`${trainerClientMessagesStyles.panel} ${embedded ? trainerClientMessagesStyles.embeddedPanel : ""}`} aria-labelledby="trainer-client-messages-title">
      <header className={`${trainerClientMessagesStyles.header} ${embedded ? trainerClientMessagesStyles.embeddedHeader : ""}`}>
        <div className={trainerClientMessagesStyles.heading}>
          {!embedded && (
            <span className={trainerClientMessagesStyles.chatAvatar} aria-hidden="true"><MessageSquare size={19} /></span>
          )}
          <div>
            <h2 id="trainer-client-messages-title">Комментарии клиента</h2>
            <p aria-live="polite">{pendingCount ? `К разбору: ${pendingCount}` : historyCoverage === "complete" ? "Все сообщения обработаны" : "В загруженных записях нет необработанных сообщений"}</p>
          </div>
        </div>
      </header>

      {actionError || resolutionStatus ? <p className={trainerClientMessagesStyles.resolutionStatus} role={actionError ? "alert" : "status"}>{actionError || resolutionStatus}</p> : null}
      {historyCoverage !== "complete" ? <div className={trainerClientMessagesStyles.resolutionStatus} role="status">
        <p>{historyCoverage === "error" ? "Не удалось загрузить историю. Обновите карточку клиента." : "Загружена часть истории. Более ранние комментарии можно подгрузить."}</p>
        {historyCoverage === "partial" && onLoadMoreHistory ? <button type="button" disabled={historyLoading} onClick={async () => {
          setHistoryLoading(true); setHistoryError("");
          try { if (!await onLoadMoreHistory()) setHistoryError("Не удалось загрузить историю. Повторите попытку."); }
          catch { setHistoryError("Не удалось загрузить историю. Повторите попытку."); }
          finally { setHistoryLoading(false); }
        }}>{historyLoading ? "Загрузка…" : "Загрузить более ранние комментарии"}</button> : null}
        {historyError ? <p role="alert">{historyError}</p> : null}
      </div> : null}

      <div className={trainerClientMessagesStyles.toolbar}>
        <nav className={trainerClientMessagesStyles.filters} aria-label="Фильтры сообщений клиента">
          {filters.map((item) => {
            const selected = filter === item.id;
            return <button
              type="button"
              key={item.id}
              className={selected ? trainerClientMessagesStyles.active : ""}
              aria-pressed={selected}
              data-selected={selected ? "true" : undefined}
              onClick={() => selectFilter(item.id)}
            >
              {selected ? <Check size={13} aria-hidden="true" /> : null}
              {item.label}<span>{item.count}</span>
            </button>;
          })}
        </nav>
        {pendingCount && onMarkAllProcessed ? (
          <button
            type="button"
            className={trainerClientMessagesStyles.resolveAllButton}
            disabled={resolvingAll || Boolean(actionPending)}
            onClick={() => setConfirmAll(pendingMessages)}
          >
            <Check size={14} /><span>{resolvingAll ? "Обрабатываем…" : "Обработать все"}</span>
          </button>
        ) : null}
      </div>

      {confirmAll ? <div className={trainerClientMessagesStyles.bulkConfirm} role="group" aria-label="Подтверждение обработки сообщений">
        <strong>Отметить обработанными: {confirmAll.length}?</strong>
        <p>Ответ клиенту не отправится. Записи останутся во вкладке «Обработанные».</p>
        <div className={trainerClientMessagesStyles.actions}>
          <button type="button" className={trainerClientMessagesStyles.resolveAllButton} disabled={resolvingAll || Boolean(actionPending)} onClick={() => setConfirmAll(null)}>Отмена</button>
          <button type="button" className={`${trainerClientMessagesStyles.reply} ${trainerClientMessagesStyles.replyPrimary}`} disabled={resolvingAll || Boolean(actionPending)} onClick={() => resolveNotes(confirmAll, "all")}>{actionPending === "all" ? "Сохраняем…" : "Отметить все обработанными"}</button>
        </div>
      </div> : null}

      <div className={trainerClientMessagesStyles.feed}>
        {visibleMessages.length ? (
          visibleMessages.map((item) => {
            const processed = processedMessageIds.has(item.id);
            return (
              <article className={`${trainerClientMessagesStyles.card} ${processed ? trainerClientMessagesStyles.cardProcessed : trainerClientMessagesStyles.cardPending}`} key={item.id} data-testid="trainer-client-message-item">
                <div className={trainerClientMessagesStyles.cardBody}>
                  <div className={trainerClientMessagesStyles.cardHeader}>
                    <div className={trainerClientMessagesStyles.messageTitle}>
                      <strong title={item.title}>{item.title}</strong>
                      <span>{item.exerciseId || item.source === "Упражнение" ? `Заметка к упражнению · ${item.workoutName}` : "Комментарий к тренировке"}</span>
                    </div>
                    <time>{formatCompactDate(item.date)}</time>
                  </div>
                  <div className={trainerClientMessagesStyles.bubble}>
                    {item.text.length > 280 ? <details className={trainerClientMessagesStyles.messageDetails}>
                      <summary><span className={trainerClientMessagesStyles.messagePreview}>{item.text}</span><span className={trainerClientMessagesStyles.expandLabel}>Читать полностью</span><span className={trainerClientMessagesStyles.collapseLabel}>Свернуть</span></summary>
                      <p className={trainerClientMessagesStyles.text}>{item.text}</p>
                    </details> : <p className={trainerClientMessagesStyles.text}>{item.text}</p>}
                  </div>
                  <div className={trainerClientMessagesStyles.messageFooter}>
                    <span className={processed ? trainerClientMessagesStyles.processedBadge : trainerClientMessagesStyles.pendingBadge}>
                      {processed ? <><Check size={11} aria-hidden="true" />Обработано</> : "Не обработано"}
                    </span>
                    {onReplyToMessage ? (
                      <div className={trainerClientMessagesStyles.actions}>
                      <button
                        type="button"
                        className={`${trainerClientMessagesStyles.reply} ${processed ? "" : trainerClientMessagesStyles.replyPrimary}`}
                        disabled={resolvingAll || Boolean(actionPending)}
                        onClick={() => onReplyToMessage(item)}
                      >
                        <Mail size={15} aria-hidden="true" />{processed ? "Ответить ещё раз" : "Ответить"}
                      </button>
                      </div>
                    ) : null}
                  </div>
                  {!processed && onMarkAllProcessed ? <button type="button" className={trainerClientMessagesStyles.markProcessed} disabled={resolvingAll || Boolean(actionPending)} onClick={() => resolveNotes([item], item.id)}>{actionPending === item.id ? "Сохраняем…" : "Отметить обработанным"}</button> : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className={trainerClientMessagesStyles.empty}>
            <MessageSquare size={22} />
            <strong>{messages.length ? "В этой группе сообщений нет" : "Сообщений пока нет"}</strong>
            <p>{messages.length ? "Выберите другой фильтр." : "Здесь будут только комментарии и заметки, которые клиент написал сам. Оценки самочувствия — в истории тренировок."}</p>
          </div>
        )}
      </div>

      {filteredMessages.length > 6 ? (
        <button type="button" className={trainerClientMessagesStyles.moreButton} onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Свернуть сообщения" : `Показать ещё ${hiddenCount}`}
          <ChevronDown size={15} className={expanded ? trainerClientMessagesStyles.rotated : ""} />
        </button>
      ) : null}

    </section>
  );
}

function getTrainerWorkoutScheduleCalendar(client = {}, workouts = []) {
  return getWorkoutScheduleCalendarForWorkouts(client?.workoutCalendar || {}, workouts);
}

function getWorkoutScheduleInitialDates(client = {}, workouts = []) {
  const calendar = getTrainerWorkoutScheduleCalendar(client, workouts);
  const plannedDates = Array.isArray(calendar.plannedWorkouts)
    ? calendar.plannedWorkouts.map((item) => item?.date)
    : [];
  const calendarDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(calendar.monthlyTrainingDates)
      ? calendar.monthlyTrainingDates
      : [];
  const source = plannedDates.length ? plannedDates : calendarDates;

  return [...new Set(source.map(toWorkoutDateKey).filter(Boolean))].sort();
}

function getWorkoutSchedulePlannerKey(client = {}, workouts = []) {
  return [
    client?.id || "client",
    client?.workoutCalendar?.updatedAt || "",
    client?.workoutCalendar?.assignedProgramUpdatedAt || "",
    getWorkoutScheduleInitialDates(client, workouts).join("|"),
    (Array.isArray(workouts) ? workouts : [])
      .map((workout) => `${workout?.id || ""}:${workout?.scheduledDate || workout?.plannedDate || ""}`)
      .join("|")
  ].join("::");
}

const WORKOUT_SCHEDULE_DAY_STATUS_TEXT = {
  planned: "запланирована",
  completed: "выполнена в срок",
  completed_off_date: "выполнена в другой день",
  missed: "пропущена",
  shifted: "смещена дальше",
  pastCompleted: "выполнена в прошлой программе"
};

function getWorkoutScheduleCalendarStatus(entries = []) {
  const priority = ["missed", "completed_off_date", "completed", "shifted", "planned", "pastCompleted"];
  const status = priority.find((item) => entries.some((entry) => entry.status === item));
  if (status === "completed_off_date") return "completedOffDate";
  return status || "";
}

function getWorkoutScheduleCalendarTitle(dateKey, entries = []) {
  if (!entries.length) return dateKey;
  const details = entries
    .map((entry) => `№${entry.order} ${WORKOUT_SCHEDULE_DAY_STATUS_TEXT[entry.status] || ""}`.trim())
    .join(", ");
  return `${dateKey}: ${details}`;
}

function buildArchivedWorkoutScheduleCalendarEntries(archivedWorkouts = [], history = []) {
  const completionDateByWorkoutId = new Map();
  (Array.isArray(history) ? history : []).forEach((entry) => {
    const workoutId = getTrainerWorkoutKey(entry?.workoutId);
    const completedDate = toWorkoutDateKey(getWorkoutHistoryDate(entry));
    if (workoutId && completedDate && !completionDateByWorkoutId.has(workoutId)) {
      completionDateByWorkoutId.set(workoutId, completedDate);
    }
  });

  return (Array.isArray(archivedWorkouts) ? archivedWorkouts : []).flatMap((workout, index) => {
    const workoutId = getTrainerWorkoutKey(workout?.id);
    const status = String(workout?.status || "").trim().toLowerCase();
    const date = completionDateByWorkoutId.get(workoutId) || (
      ["completed", "completed_off_date"].includes(status)
        ? toWorkoutDateKey(workout?.completedAt || workout?.statusUpdatedAt)
        : ""
    );
    if (!date) return [];

    return [{
      id: `archived-${workoutId || index}-${date}`,
      date,
      order: Number(workout?.order || workout?.sortOrder || index + 1),
      workoutId,
      status: "pastCompleted",
      pastCompleted: true,
      title: `${workout?.assignedProgramName || "Предыдущая программа"}: ${workout?.name || `Тренировка ${index + 1}`}`
    }];
  });
}

function WorkoutSchedulePlanner({
  client,
  workouts = [],
  archivedWorkouts = [],
  history = [],
  completedWorkoutIds = [],
  onSaveSchedule,
  onSaveSubscription,
  status,
  startEditing = false,
  onSaved
}) {
  const subscription = client?.subscription || {};
  const requiredCount = workouts.length;
  const clientScheduleRequiresReview = client?.workoutCalendar?.clientScheduleRequiresReview === true;
  const [selectedDates, setSelectedDates] = useState(() => getWorkoutScheduleInitialDates(client, workouts));
  const [monthKey, setMonthKey] = useState(() => getLocalDateKey().slice(0, 7));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(Boolean(startEditing));
  const [editingSubscription, setEditingSubscription] = useState(false);
  const [subscriptionDraft, setSubscriptionDraft] = useState(() => getSubscriptionSessionDraft(subscription));
  const calendar = getTrainerWorkoutScheduleCalendar(client, workouts);
  const completedWorkoutIdSet = new Set([
    ...(Array.isArray(history) ? history : []).map((entry) => String(entry?.workoutId || "").trim()),
    ...(Array.isArray(completedWorkoutIds) ? completedWorkoutIds : []).map((workoutId) => String(workoutId || "").trim())
  ].filter(Boolean));
  const slots = buildPlannedWorkoutSlots({
    workouts,
    calendar,
    history,
    completedWorkoutIds: [...completedWorkoutIdSet]
  });
  const completedCount = slots.filter((slot) => slot.isCompleted).length;
  const missedCount = slots.filter((slot) => slot.isMissed).length;
  const isProgramCompleted = requiredCount > 0 && completedCount >= requiredCount;
  const visibleSubscription = editingSubscription
    ? { ...subscription, ...subscriptionDraft }
    : subscription;
  const hasSubscriptionDetails = Boolean(
    visibleSubscription.startDate ||
    visibleSubscription.endDate ||
    visibleSubscription.purchasedSessions !== undefined ||
    visibleSubscription.totalSessions !== undefined ||
    visibleSubscription.usedSessions !== undefined
  );
  const subscriptionStatus = hasSubscriptionDetails
    ? getSubscriptionStatus(visibleSubscription, new Date())
    : null;
  const todayKey = getLocalDateKey();
  const selectedSet = new Set(selectedDates);
  const monthDays = getCalendarMonthDays(monthKey);
  const selectedOrder = Object.fromEntries(selectedDates.map((date, index) => [date, index + 1]));
  const datesComplete = requiredCount > 0 && selectedDates.length === requiredCount;
  const subscriptionRange = editing
    ? { startDate: selectedDates[0] || "", endDate: selectedDates.at(-1) || "" }
    : getSubscriptionScheduleRange({ workouts, calendar: client?.workoutCalendar || {} });
  const scheduleEntries = buildWorkoutScheduleCalendarEntries(slots)
    .filter((entry) => !isProgramCompleted || ["completed", "completed_off_date"].includes(entry.status));
  const savedEntriesByDate = scheduleEntries.reduce((result, entry) => {
    if (!result[entry.date]) result[entry.date] = [];
    result[entry.date].push(entry);
    return result;
  }, {});
  const archivedEntriesByDate = (isProgramCompleted ? [] : buildArchivedWorkoutScheduleCalendarEntries(archivedWorkouts, history))
    .reduce((result, entry) => {
      if (!result[entry.date]) result[entry.date] = [];
      result[entry.date].push(entry);
      return result;
    }, {});
  const draftEntriesByDate = selectedDates.reduce((result, date, index) => {
    result[date] = savedEntriesByDate[date]?.length
      ? savedEntriesByDate[date]
      : [{
        date,
        order: index + 1,
        status: "planned",
        title: `Тренировка №${index + 1}`
      }];
    return result;
  }, {});
  const currentEntriesByDate = editing && !isProgramCompleted ? draftEntriesByDate : savedEntriesByDate;
  const visibleEntriesByDate = { ...archivedEntriesByDate };
  Object.entries(currentEntriesByDate).forEach(([date, entries]) => {
    visibleEntriesByDate[date] = [...(visibleEntriesByDate[date] || []), ...entries];
  });

  function shiftMonth(delta) {
    const [year, month] = monthKey.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setMonthKey(getLocalDateKey(next).slice(0, 7));
  }

  function toggleDate(dateKey) {
    if (!editing || isProgramCompleted) return;
    setSelectedDates((current) => toggleTrainerScheduleDate(current, dateKey, todayKey, requiredCount));
  }

  function startSubscriptionEditing() {
    if (!onSaveSubscription || saving) return;
    setSubscriptionDraft(getSubscriptionSessionDraft(subscription));
    setSelectedDates(getWorkoutScheduleInitialDates(client, workouts));
    setEditing(false);
    setEditingSubscription(true);
  }

  function cancelSubscriptionEditing() {
    if (saving) return;
    setSubscriptionDraft(getSubscriptionSessionDraft(subscription));
    setEditingSubscription(false);
  }

  async function saveSchedule() {
    if (isProgramCompleted) return;
    if (!editing) {
      setEditingSubscription(false);
      setEditing(true);
      return;
    }
    if (!datesComplete || saving) return;
    setSaving(true);
    try {
      const saved = await onSaveSchedule?.(selectedDates, workouts);
      if (saved !== false) {
        setEditing(false);
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  }

  function cancelScheduleEditing() {
    if (saving) return;
    setSelectedDates(getWorkoutScheduleInitialDates(client, workouts));
    setEditing(false);
  }

  const remainingDatesToSelect = Math.max(requiredCount - selectedDates.length, 0);
  const scheduleActionLabel = !editing
    ? "Изменить расписание"
    : saving
      ? "Сохраняем даты..."
      : datesComplete
        ? "Сохранить даты"
        : `Выберите ещё ${remainingDatesToSelect} ${pluralize(remainingDatesToSelect, "дату", "даты", "дат")}`;
  const scheduleDescription = isProgramCompleted
    ? "Программа завершена. Показаны только фактические даты выполнения тренировок."
    : `Выберите ровно ${requiredCount || 0} ${pluralize(requiredCount, "дату", "даты", "дат")} под назначенную программу. Порядок дат становится порядком тренировок №1, №2 и дальше.`;

  if (isTrainerV2Path(window.location.pathname)) {
    return <TrainerScheduleAgenda
      client={client}
      workouts={workouts}
      slots={slots}
      archivedEntries={buildArchivedWorkoutScheduleCalendarEntries(archivedWorkouts, history)}
      range={getSubscriptionScheduleRange({ workouts, calendar: client?.workoutCalendar || {} })}
      onSaveSchedule={onSaveSchedule}
      onSaveSubscription={onSaveSubscription}
      status={status}
      startEditing={startEditing}
      onSaved={onSaved}
    />;
  }

  return (
    <section data-testid="trainer-subscription-calendar" className={`trainerClientAnalyticsCard trainerWorkoutSchedulePlanner ${subscriptionCalendarStyles.calendar} ${editing ? "editing" : ""} ${editingSubscription ? "subscriptionEditing" : ""} ${isProgramCompleted ? "completedProgram" : ""}`}>
      <header>
        <div>
          <span>РАСПИСАНИЕ ПРОГРАММЫ</span>
          <h3>Даты тренировок клиента</h3>
        </div>
      </header>

      {clientScheduleRequiresReview ? (
        <p className="trainerWorkoutScheduleClientNotice" role="status">
          Клиент обновил дни тренировок. Проверьте календарь и скорректируйте его при необходимости.
        </p>
      ) : null}

      <div className="trainerWorkoutScheduleBody">
        <div className="trainerWorkoutScheduleCalendar">
          <div className="trainerWorkoutScheduleMonth">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronUp size={15} /></button>
            <strong>{new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronDown size={15} /></button>
          </div>
          <div className="trainerWorkoutScheduleWeekdays" aria-hidden="true">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="trainerWorkoutScheduleGrid">
            {monthDays.map((day, dayIndex) => {
              const selected = !isProgramCompleted && selectedSet.has(day.key);
              const isPastDate = day.key < todayKey;
              const entries = visibleEntriesByDate[day.key] || [];
              const statusClass = getWorkoutScheduleCalendarStatus(entries);
              const entryLabel = entries.map((entry) => `№${entry.order}`).join(", ");
              const subscriptionStart = day.key === subscriptionRange.startDate;
              const subscriptionEnd = day.key === subscriptionRange.endDate;
              const canEditScheduleDay = !isPastDate && (selected || !requiredCount || selectedDates.length < requiredCount);
              return (
                <button
                  type="button"
                  className={[
                    day.currentMonth ? "" : "muted",
                    day.key === todayKey ? "today" : "",
                    isPastDate ? "pastDate" : "",
                    selected ? "selected" : "",
                    entries.length ? "hasWorkout" : "",
                    statusClass,
                    subscriptionStart || subscriptionEnd ? subscriptionCalendarStyles.boundary : ""
                  ].filter(Boolean).join(" ")}
                  key={day.key}
                  data-date={day.key}
                  {...getSubscriptionRangeDayProps(day.key, dayIndex, subscriptionRange)}
                  onClick={() => toggleDate(day.key)}
                  disabled={!editing || !canEditScheduleDay}
                  aria-label={[getWorkoutScheduleCalendarTitle(day.key, entries), subscriptionStart ? "начало периода абонемента" : "", subscriptionEnd ? "конец периода абонемента" : ""].filter(Boolean).join(", ")}
                  title={getWorkoutScheduleCalendarTitle(day.key, entries)}
                >
                  <b>{day.label}</b>
                  {entries.length ? (isTrainerV2Path(window.location.pathname) ? <span className="trainerScheduleDayBadges">{entries.map((entry, index) => <i key={entry.id || index} className={`status-${entry.status}`} title={WORKOUT_SCHEDULE_DAY_STATUS_TEXT[entry.status]}>{({ planned: "○", completed: "✓", completed_off_date: "↗", missed: "!", shifted: "↪", pastCompleted: "✓" })[entry.status] || "○"} №{entry.order}</i>)}</span> : <i>{entryLabel}</i>) : selected ? <i>№{selectedOrder[day.key]}</i> : null}
                </button>
              );
            })}
          </div>
          <p className={subscriptionCalendarStyles.period}>
            {subscriptionRange.startDate
              ? `Период по расписанию: ${formatSubscriptionDate(subscriptionRange.startDate)} — ${formatSubscriptionDate(subscriptionRange.endDate)}`
              : "Период появится автоматически после назначения дат тренировок."}
          </p>
          {isTrainerV2Path(window.location.pathname) ? <div className="trainerNotificationLegend" aria-label="Типы календарных отметок">
            <span><i aria-hidden="true" className="subscription">―</i>Период абонемента</span>
            <span><i aria-hidden="true" className="plannedWorkout">○</i>Плановая тренировка</span>
            <span><i aria-hidden="true" className="completed">✓</i>В срок</span>
            <span><i aria-hidden="true" className="completedOffDate">↗</i>Выполнено в другой день</span>
            <span><i aria-hidden="true" className="missed">!</i>Пропущена</span>
            <span><i aria-hidden="true" className="shifted">↪</i>Смещена</span>
            <span><i aria-hidden="true" className="pastWorkout">✓</i>Прошлая тренировка</span>
          </div> : (
          <div className="trainerWorkoutScheduleLegend trainerWorkoutScheduleStats trainerWorkoutScheduleCalendarStatusLegend" aria-label="Статусы тренировок">
            <span className="is-planned">Плановая дата</span>
            <span className="is-completed">В срок</span>
            <span className="is-completedOffDate" aria-label="Выполнено в другой день" title="Выполнено в другой день">В другой день</span>
            <span className="is-missed">Пропущена</span>
            <span className="is-shifted">Смещена</span>
            <span className="is-pastCompleted">Прошлая тренировка</span>
          </div>
          )}
        </div>

        {!slots.length ? <div className="trainerNextEmpty">Сначала назначьте клиенту программу тренировок.</div> : null}
      </div>

      <div className="trainerWorkoutScheduleFooter">
        <section className="trainerWorkoutScheduleSection">
          <div className="trainerWorkoutScheduleContent">
            <header>
              <h4>Расписание тренировок</h4>
              <p>{scheduleDescription}</p>
            </header>
            <div className="trainerWorkoutScheduleSummaryStats" aria-label="Сводка по расписанию">
              <span className="is-completed"><i />Выполнено: <b>{completedCount}</b></span>
              {!isProgramCompleted ? <span className="is-missed"><i />Пропущено: <b>{missedCount}</b></span> : null}
              <span className="is-off-date"><i />Не в свой день: <b>{slots.filter((slot) => slot.isCompletedOffDate).length}</b></span>
            </div>
          </div>
          <div className="trainerWorkoutScheduleControls">
            <strong className={datesComplete ? "ready" : ""}>{isProgramCompleted ? completedCount : selectedDates.length}/{requiredCount || 0}<small>{isProgramCompleted ? "выполнено" : "выбрано"}</small></strong>
            {!isProgramCompleted && !editingSubscription ? (
              <div className="trainerWorkoutScheduleActions trainerWorkoutScheduleScheduleActions">
                {editing ? (
                  <button
                    type="button"
                    className="trainerWorkoutScheduleCancel"
                    disabled={saving}
                    onClick={cancelScheduleEditing}
                  >
                    Отменить
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`trainerNextPrimary trainerWorkoutScheduleAction ${editing ? "is-editing" : "is-idle"} ${editing && datesComplete ? "is-ready" : ""}`}
                  disabled={(editing && !datesComplete) || saving || !requiredCount}
                  onClick={saveSchedule}
                >
                  {editing && datesComplete ? <Check size={16} /> : <CalendarDays size={16} />}
                  {scheduleActionLabel}
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className={`trainerWorkoutSubscriptionSection ${editingSubscription || !onSaveSubscription ? "is-editing" : ""}`}>
          <div className="trainerWorkoutSubscriptionContent">
            <header>
              <h4>Абонемент клиента</h4>
              <p>Баланс занятий задаётся отдельно. Период в календаре определяется расписанием.</p>
            </header>
            {onSaveSubscription ? (
              <ClientCalendarSubscriptionFields
                client={client}
                draft={subscriptionDraft}
                onChange={setSubscriptionDraft}
                onSave={onSaveSubscription}
                onSaved={async () => setEditingSubscription(false)}
                editing={editingSubscription}
                onEdit={startSubscriptionEditing}
                onCancel={cancelSubscriptionEditing}
                showEditAction={false}
                showStatus={false}
                showRemaining={false}
              />
            ) : null}
          </div>
          {!editingSubscription ? (
            <div className="trainerWorkoutSubscriptionSectionActions">
              <aside className={`trainerWorkoutScheduleSubscription is-${subscriptionStatus?.id || "unconfigured"}`} aria-label="Абонемент клиента">
                <span>АБОНЕМЕНТ</span>
                <b>{subscriptionStatus?.label || "Не настроен"}</b>
                <small>{hasSubscriptionDetails
                  ? `${subscriptionStatus.remainingSessions} ${pluralize(subscriptionStatus.remainingSessions, "занятие", "занятия", "занятий")} осталось`
                  : "не настроен"}</small>
              </aside>
              {onSaveSubscription ? (
                <button
                  type="button"
                  className="trainerWorkoutScheduleSubscriptionAction"
                  onClick={startSubscriptionEditing}
                >
                  <CalendarDays size={16} />Изменить абонемент
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      {editing && !datesComplete && requiredCount > 0 ? <p className="trainerWorkoutScheduleHint">Нужно выбрать {requiredCount} {pluralize(requiredCount, "дату", "даты", "дат")}, сейчас выбрано {selectedDates.length}.</p> : null}
      {status ? <p className="trainerNextProgramStatus">{status}</p> : null}
    </section>
  );
}

function ClientScheduleAgenda({ client, workouts = [], history = [], onSaveSchedule, onSaveSubscription, status }) {
  const timeline = buildTrainerClientProgramTimeline({
    workouts: workouts.filter(workout => !isTrainerClientBasicWorkout(workout)), history, clientProfile: client
  });
  const assignment = timeline.find(item => item.status === "current") || timeline.find(item => item.status === "future") || timeline.filter(item => item.status === "past").at(-1);
  const selectedWorkouts = resolveTrainerAssignmentWorkoutOrder(assignment?.workouts || [], client?.workoutCalendar || {});
  const archivedWorkouts = timeline.filter(item => item.key !== assignment?.key && ["past", "archived"].includes(item.status)).flatMap(item => item.workouts || []);
  return <WorkoutSchedulePlanner key={getWorkoutSchedulePlannerKey(client, selectedWorkouts)} client={client} workouts={selectedWorkouts} archivedWorkouts={archivedWorkouts} history={history} completedWorkoutIds={assignment?.completedWorkoutIds || []} onSaveSchedule={onSaveSchedule} onSaveSubscription={onSaveSubscription} status={status} />;
}

function TrainerProgramScheduleModal({
  client,
  assignment,
  archivedWorkouts = [],
  history = [],
  onSaveSchedule,
  onClose
}) {
  if (!assignment?.workouts?.length) return null;

  const programName = assignment.name || "Новая программа";
  const clientName = client?.name || client?.displayName || client?.email || "";
  const scheduleTitle = [programName, clientName].filter(Boolean).join(" — ");

  return (
    <div
      className="trainerClientModalBackdrop trainerWorkoutEditorModalBackdrop"
      data-trainer-modal-backdrop="true"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="trainerWorkoutEditorModal trainerClientScheduleModal"
        data-trainer-modal-surface="true"
        data-trainer-modal-frame="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trainer-program-schedule-title"
      >
        <header data-trainer-modal-header="true">
          <div>
            <span>РАСПИСАНИЕ ПРОГРАММЫ</span>
            <h2 id="trainer-program-schedule-title">{scheduleTitle}</h2>
          </div>
          <button className="trainerNextModalClose" type="button" onClick={onClose} aria-label="Закрыть расписание">
            <X size={18} />
          </button>
        </header>
        <div className="trainerWorkoutEditorModalBody" data-trainer-modal-content="true">
          <WorkoutSchedulePlanner
            key={getWorkoutSchedulePlannerKey(client, assignment.workouts)}
            client={client}
            workouts={assignment.workouts}
            archivedWorkouts={archivedWorkouts}
            history={history}
            completedWorkoutIds={assignment.completedWorkoutIds || []}
            onSaveSchedule={onSaveSchedule}
            startEditing
            onSaved={onClose}
          />
        </div>
      </section>
    </div>
  );
}

function ClientWorkoutPlan({
  historyOpen,
  onHistoryOpenChange,
  client,
  history,
  workouts,
  archivedWorkouts = [],
  programTemplates,
  selectedProgramId,
  onSelectProgram,
  onAssignProgram,
  onArchiveProgramAssignment,
  onRestoreProgramAssignment,
  onDeleteProgramAssignment,
  onSaveWorkoutSchedule,
  onSaveSubscription,
  programStatus,
  adjustmentRequest,
  reviewEvents = [],
  onResolveWorkoutReview,
  onLoadMoreHistory,
  editorProps
}) {
  const [editorOpen, setEditorOpen] = useState(Boolean(adjustmentRequest?.token));
  const [editorWorkoutId, setEditorWorkoutId] = useState(adjustmentRequest?.workoutId || "");
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorStatus, setEditorStatus] = useState("");
  const [historyPageLoading, setHistoryPageLoading] = useState(false);
  const [historyPageError, setHistoryPageError] = useState("");
  const [pendingReviewAdjustment, setPendingReviewAdjustment] = useState(null);
  const [reviewDecisionOpen, setReviewDecisionOpen] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [localReviewedKeys, setLocalReviewedKeys] = useState([]);
  const [assignmentReviewOpen, setAssignmentReviewOpen] = useState(false);
  const [programAssignmentConfirm, setProgramAssignmentConfirm] = useState(null);
  const [programAssignmentSaving, setProgramAssignmentSaving] = useState(false);
  const [programAssignmentStatus, setProgramAssignmentStatus] = useState("");
  const [programNameEditorOpen, setProgramNameEditorOpen] = useState(false);
  const [programNameDraft, setProgramNameDraft] = useState("");
  const programNameSaving = editorSaving;
  const [programNameStatus, setProgramNameStatus] = useState("");
  const [showBasicWorkoutHistory, setShowBasicWorkoutHistory] = useState(false);
  const [programHistoryOpen, setProgramHistoryOpen] = useState(false);
  const [scheduleAssignmentRequest, setScheduleAssignmentRequest] = useState(null);
  const [localWorkoutInsightsOpen, setLocalWorkoutInsightsOpen] = useState(false);
  const workoutInsightsOpen = historyOpen ?? localWorkoutInsightsOpen;
  const setWorkoutInsightsOpen = onHistoryOpenChange || setLocalWorkoutInsightsOpen;

  useBodyScrollLock(Boolean(editorOpen || reviewDecisionOpen || assignmentReviewOpen || programAssignmentConfirm || scheduleAssignmentRequest || workoutInsightsOpen || programHistoryOpen), { lockHtml: true });

  const trainerWorkouts = useMemo(
    () => (Array.isArray(workouts) ? workouts : []).filter((workout) => !isTrainerClientBasicWorkout(workout)),
    [workouts]
  );
  const trainerArchivedWorkouts = useMemo(
    () => (Array.isArray(archivedWorkouts) ? archivedWorkouts : []).filter((workout) => !isTrainerClientBasicWorkout(workout)),
    [archivedWorkouts]
  );
  const hasBasicProgramHistory = useMemo(
    () => [...(Array.isArray(workouts) ? workouts : []), ...(Array.isArray(archivedWorkouts) ? archivedWorkouts : [])]
      .some((workout) => isTrainerClientBasicWorkout(workout)),
    [archivedWorkouts, workouts]
  );
  const trainerProgramTimeline = useMemo(() => buildTrainerClientProgramTimeline({
    workouts: trainerWorkouts,
    archivedWorkouts: trainerArchivedWorkouts,
    history,
    clientProfile: client
  }), [
    client,
    history,
    trainerArchivedWorkouts,
    trainerWorkouts
  ]);
  const programTimeline = useMemo(() => buildTrainerClientProgramTimeline({
    workouts: showBasicWorkoutHistory ? workouts : trainerWorkouts,
    archivedWorkouts: showBasicWorkoutHistory ? archivedWorkouts : trainerArchivedWorkouts,
    history,
    clientProfile: client
  }), [
    archivedWorkouts,
    client,
    history,
    showBasicWorkoutHistory,
    trainerArchivedWorkouts,
    trainerWorkouts,
    workouts
  ]);
  const currentProgramAssignment = trainerProgramTimeline.find((assignment) => assignment.status === "current") || null;
  const nextProgramAssignment = trainerProgramTimeline.find((assignment) => assignment.status === "future") || null;
  const assignedProgramAssignment = currentProgramAssignment || nextProgramAssignment || null;
  const primaryProgramAssignment = currentProgramAssignment || nextProgramAssignment || null;
  const scheduleModalAssignment = useMemo(() => {
    if (!scheduleAssignmentRequest) return null;
    if (scheduleAssignmentRequest.assignmentKey) {
      return trainerProgramTimeline.find((assignment) => assignment.key === scheduleAssignmentRequest.assignmentKey) || null;
    }
    const knownAssignmentKeys = new Set(scheduleAssignmentRequest.knownAssignmentKeys || []);
    return trainerProgramTimeline
      .filter((assignment) => assignment.programId === scheduleAssignmentRequest.programId && !knownAssignmentKeys.has(assignment.key))
      .at(-1) || null;
  }, [scheduleAssignmentRequest, trainerProgramTimeline]);
  const scheduleWorkouts = useMemo(() => resolveTrainerAssignmentWorkoutOrder(
    primaryProgramAssignment?.workouts || [], client?.workoutCalendar || {}
  ), [primaryProgramAssignment, client?.workoutCalendar]);
  const scheduleHistory = primaryProgramAssignment?.history || [];
  const scheduleCompletedWorkoutIds = [...new Set([
    ...(primaryProgramAssignment?.completedWorkoutIds || []),
    ...scheduleWorkouts.filter((workout) => isTrainerWorkoutCompleted(workout, getTrainerCompletedWorkoutKeys(history), { includeManualStatus: false })).map((workout) => workout.id)
  ])];
  const [editorExitConfirm, setEditorExitConfirm] = useState(false);
  const [editorLibraryRequested, setEditorLibraryRequested] = useState(false);
  const programDraft = useTrainerProgramDraft({ open: editorOpen, client, workouts: scheduleWorkouts, completedWorkoutIds: scheduleCompletedWorkoutIds, exerciseLibrary: editorProps?.exerciseLibrary, onStatus: setEditorStatus });
  const visibleWorkoutSlots = useMemo(() => buildPlannedWorkoutSlots({ workouts: primaryProgramAssignment?.workouts || [], calendar: client?.workoutCalendar || {}, history: primaryProgramAssignment?.history || [], completedWorkoutIds: primaryProgramAssignment?.completedWorkoutIds || [] }), [primaryProgramAssignment, client?.workoutCalendar]);
  const scheduleArchivedWorkouts = useMemo(() => {
    const primaryKey = primaryProgramAssignment?.key || "";
    const seenWorkoutIds = new Set();

    return trainerProgramTimeline
      .filter((assignment) => assignment.key !== primaryKey && ["past", "archived"].includes(assignment.status))
      .flatMap((assignment) => assignment.workouts)
      .filter((workout) => {
        const workoutId = String(workout?.id || "").trim();
        if (!workoutId || seenWorkoutIds.has(workoutId)) return false;
        seenWorkoutIds.add(workoutId);
        return true;
      });
  }, [primaryProgramAssignment?.key, trainerProgramTimeline]);
  const assignedProgramWorkoutCount = assignedProgramAssignment?.workoutCount || 0;
  const assignedProgramCompletion = assignedProgramWorkoutCount
    ? Math.round((assignedProgramAssignment?.completedCount || 0) / assignedProgramWorkoutCount * 100)
    : 0;
  const assignedProgramName = assignedProgramAssignment?.name || client?.assignedProgramName || "Индивидуальная программа";
  const assignedName = primaryProgramAssignment?.name || client?.assignedProgramName || (workouts.length ? "Индивидуальная программа" : "Программа не назначена");
  const assignableTemplates = programTemplates.filter(canAssignTrainerProgram);
  const selectedTemplate = assignableTemplates.find((program) => program.id === selectedProgramId);
  const reviewHistory = isTrainerV2Path(window.location.pathname) ? scheduleHistory : history;
  const reviewWorkouts = isTrainerV2Path(window.location.pathname) ? scheduleWorkouts : workouts;
  const latestWorkoutHistory = [...reviewHistory]
    .sort((a, b) => {
      const dateA = getWorkoutHistoryDate(a)?.getTime() || 0;
      const dateB = getWorkoutHistoryDate(b)?.getTime() || 0;
      return dateB - dateA;
    })[0];
  const latestWorkoutReview = latestWorkoutHistory
    ? buildTrainerWorkoutReview(latestWorkoutHistory, findPlannedWorkoutForHistory(latestWorkoutHistory, reviewWorkouts))
    : null;
  const persistedReviewedKeys = useMemo(
    () => getTrainerWorkoutReviewReviewedKeys(reviewEvents),
    [reviewEvents]
  );
  const latestWorkoutReviewKey = latestWorkoutReview
    ? getTrainerWorkoutReviewKey(latestWorkoutReview)
    : "";
  const latestWorkoutReviewed = Boolean(latestWorkoutReviewKey) && (
    persistedReviewedKeys.has(latestWorkoutReviewKey) || localReviewedKeys.includes(latestWorkoutReviewKey)
  );
  const visibleWorkoutReview = latestWorkoutReview
    ? {
        ...latestWorkoutReview,
        reviewKey: latestWorkoutReviewKey,
        reviewed: latestWorkoutReviewed,
        needsTrainerReply: latestWorkoutReview.needsTrainerReply && !latestWorkoutReviewed
      }
    : null;
  const nextWorkoutTarget = useMemo(() => findTrainerWorkoutReviewTarget({
    workouts: reviewWorkouts,
    calendar: client?.workoutCalendar || {},
    history: reviewHistory
  }), [reviewWorkouts, client?.workoutCalendar, reviewHistory]);

  function closeEditor() {
    if (editorSaving || programNameSaving || programDraft.uploadingId) return;
    if (programDraft.dirty) { setEditorExitConfirm(true); return; }
    discardEditor();
  }

  function discardEditor() {
    setEditorExitConfirm(false);
    setEditorOpen(false);
    setPendingReviewAdjustment(null);
    setEditorStatus("");
    setEditorLibraryRequested(false);
    if (editorLibraryRequested) editorProps?.onOpenExerciseLibrary?.();
  }

  function openLibraryFromEditor() {
    if (editorSaving || programNameSaving || programDraft.uploadingId) return;
    if (programDraft.dirty) {
      setEditorLibraryRequested(true);
      setEditorExitConfirm(true);
      return;
    }
    setEditorOpen(false);
    editorProps?.onOpenExerciseLibrary?.();
  }

  function openProgramEditor() {
    const slots = buildPlannedWorkoutSlots({
      workouts: scheduleWorkouts,
      calendar: client?.workoutCalendar || {},
      history: scheduleHistory,
      completedWorkoutIds: scheduleCompletedWorkoutIds
    });
    const firstUpcomingWorkout = scheduleWorkouts.find((workout, index) => {
      const slot = slots.find((item) => item.workoutId === String(workout?.id || "")) || slots[index];
      return !slot?.isCompleted;
    });
    setEditorWorkoutId(firstUpcomingWorkout?.id || scheduleWorkouts[0]?.id || "");
    setPendingReviewAdjustment(null);
    setEditorStatus("");
    setProgramNameDraft(programDraft.draft?.plan.assignedProgramName || assignedName);
    setProgramNameStatus("");
    setProgramNameEditorOpen(false);
    setEditorOpen(true);
  }

  async function confirmProgramAssignment(assignmentOptions = {}) {
    const result = await onAssignProgram?.({
      ...(assignmentOptions && typeof assignmentOptions === "object" ? assignmentOptions : {
        loadAdjustments: assignmentOptions
      }),
      skipConfirmation: true,
      throwOnError: true
    });
    if (result === false) return false;

    setScheduleAssignmentRequest({
      assignmentKey: String(result?.assignmentKey || "").trim(),
      programId: selectedTemplate?.id || "",
      knownAssignmentKeys: trainerProgramTimeline.map((assignment) => assignment.key)
    });
    return true;
  }

  function saveClientProgramName(event) {
    event.preventDefault();
    const nextName = String(programNameDraft || "").trim();
    if (!nextName) { setProgramNameStatus("Введите название программы."); return; }
    programDraft.rename(nextName);
    setProgramNameEditorOpen(false);
  }

  async function resolveWorkoutReview(decision, targetWorkoutId = "") {
    if (!visibleWorkoutReview?.reviewKey || !visibleWorkoutReview?.workoutName) {
      setReviewStatus("Не удалось определить тренировку для решения.");
      return false;
    }

    setReviewSaving(true);
    setReviewStatus("");
    try {
      const result = await onResolveWorkoutReview?.({
        reviewKey: visibleWorkoutReview.reviewKey,
        decision,
        workoutName: visibleWorkoutReview.workoutName,
        workoutDate: visibleWorkoutReview.workoutDate || "",
        historyId: visibleWorkoutReview.historyId || "",
        sourceWorkoutId: visibleWorkoutReview.sourceWorkoutId || "",
        plannedWorkoutId: visibleWorkoutReview.plannedWorkoutId || "",
        targetWorkoutId
      });
      if (!result) {
        setReviewStatus("Не удалось сохранить решение. Попробуйте ещё раз.");
        return false;
      }
      setLocalReviewedKeys((current) => current.includes(visibleWorkoutReview.reviewKey)
        ? current
        : [...current, visibleWorkoutReview.reviewKey]);
      setReviewDecisionOpen(false);
      return true;
    } catch (error) {
      console.error("Workout review decision failed:", error);
      setReviewStatus("Не удалось сохранить решение. Попробуйте ещё раз.");
      return false;
    } finally {
      setReviewSaving(false);
    }
  }

  function openReviewEditor() {
    if (!nextWorkoutTarget?.id || !visibleWorkoutReview) return;
    setPendingReviewAdjustment({
      reviewKey: visibleWorkoutReview.reviewKey,
      targetWorkoutId: nextWorkoutTarget.id
    });
    setEditorWorkoutId(nextWorkoutTarget.id);
    setEditorStatus("");
    setReviewDecisionOpen(false);
    setEditorOpen(true);
  }

  async function saveEditorChanges() {
    if (editorSaving || programDraft.uploadingId || !programDraft.draft) return;
    if (!programDraft.dirty && !pendingReviewAdjustment) { discardEditor(); return; }
    setEditorSaving(true);
    setEditorStatus("");
    try {
      const result = programDraft.dirty ? await editorProps?.onSave?.(programDraft.draft.plan, { editorDraft: programDraft.draft, throwOnError: true, silent: true }) : true;
      if (!result) {
        setEditorStatus("Не удалось сохранить изменения.");
        return;
      }
      if (programDraft.dirty) { programDraft.markSaved(result); setPendingReviewAdjustment((current) => current ? { ...current, saved: true } : current); }
      if (pendingReviewAdjustment) {
        const resolved = await resolveWorkoutReview(programDraft.dirty || pendingReviewAdjustment.saved ? "adjusted" : "accepted", pendingReviewAdjustment.targetWorkoutId);
        if (!resolved) {
          setEditorStatus("Изменения сохранены, но не удалось закрыть сигнал.");
          return;
        }
      }
      discardEditor();
    } catch (error) {
      console.error("Trainer workout editor save failed:", error);
      setEditorStatus(error?.code === "program/conflict" ? error.message : "Не удалось сохранить изменения. Правки остаются в редакторе — попробуйте ещё раз.");
    } finally {
      setEditorSaving(false);
    }
  }

  function requestProgramAssignmentAction(assignment, action) {
    if (!assignment || programAssignmentSaving) return;
    setProgramAssignmentStatus("");
    setProgramAssignmentConfirm({ assignment, action });
  }

  async function confirmProgramAssignmentAction() {
    if (!programAssignmentConfirm || programAssignmentSaving) return;
    const { assignment, action } = programAssignmentConfirm;
    const handler = action === "archive"
      ? onArchiveProgramAssignment
      : action === "restore"
        ? onRestoreProgramAssignment
        : action === "delete"
          ? onDeleteProgramAssignment
          : null;
    if (typeof handler !== "function") {
      setProgramAssignmentStatus("Это действие сейчас недоступно.");
      return;
    }

    setProgramAssignmentSaving(true);
    setProgramAssignmentStatus("");
    try {
      const result = await handler(action === "delete" ? { ...assignment, deleteEmptyArchive: true } : assignment);
      if (result === false) {
        setProgramAssignmentStatus(
          action === "archive"
            ? "Не удалось архивировать программу. Проверьте доступ к клиенту и попробуйте ещё раз."
            : action === "delete"
              ? "Программа не удалена. Обновите историю и повторите проверку."
              : "Не удалось вернуть программу из архива. Проверьте доступ к клиенту и попробуйте ещё раз."
        );
        return;
      }
      setProgramAssignmentConfirm(null);
      setProgramAssignmentStatus(action === "delete" ? "Пустая программа удалена. Остальные программы и история сохранены."
        : action === "archive" ? "Программа убрана в архив. Результаты сохранены."
          : "Программа возвращена из архива. Отметки выполнения сохранены — проверьте даты занятий.");
    } catch (error) {
      console.error("Client program assignment action failed:", error);
      setProgramAssignmentStatus(error?.message || "Не удалось сохранить изменение. Попробуйте ещё раз.");
    } finally {
      setProgramAssignmentSaving(false);
    }
  }

  return (
    <div className="trainerClientWorkoutPlan">
      <TrainerClientColumn>
      <section className={trainerClientWorkoutPlanStyles.programCard}>
        <header className={trainerClientWorkoutPlanStyles.programHeader}>
          <span><ClipboardList size={19} /></span>
          <div className={trainerClientWorkoutPlanStyles.programHeaderCopy}>
            <h2>{isTrainerV2Path(window.location.pathname) ? "Текущая программа" : "Программа тренировок клиента"}</h2>
            <p>Текущий план, следующее назначение и история клиента.</p>
          </div>
          {!isTrainerV2Path(window.location.pathname) && (programTimeline.length || hasBasicProgramHistory) ? (
            <button
              className={trainerClientWorkoutPlanStyles.programHistoryButton}
              type="button"
              onClick={() => setProgramHistoryOpen(true)}
            >
              <ClipboardList size={16} />
              <span className={trainerClientWorkoutPlanStyles.programHistoryButtonFullLabel}>
                {programTimeline.length ? `История программ · ${programTimeline.length}` : "История программ"}
              </span>
              <span className={trainerClientWorkoutPlanStyles.programHistoryButtonShortLabel}>История</span>
              <ChevronRight className={trainerClientWorkoutPlanStyles.programHistoryButtonChevron} size={15} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <div className={trainerClientWorkoutPlanStyles.programGrid}>
          {assignedProgramAssignment ? (
            <div className={trainerClientWorkoutPlanStyles.currentProgram}>
              <div className={`${trainerClientWorkoutPlanStyles.currentProgramTop} trainerClientProgramTop`}>
                <div className={trainerClientWorkoutPlanStyles.currentMain}>
                  <span className={trainerClientWorkoutPlanStyles.programIcon}><Dumbbell size={21} /></span>
                  <div className={trainerClientWorkoutPlanStyles.currentInfo}>
                    <span>{isTrainerV2Path(window.location.pathname) ? "Персональный план клиента" : "Назначенная программа"}</span>
                    <h3>{assignedProgramName}</h3>
                    <p>{isTrainerV2Path(window.location.pathname) ? `Выполнено ${assignedProgramAssignment.completedCount || 0} из ${assignedProgramWorkoutCount} тренировок` : `${assignedProgramWorkoutCount} ${pluralize(assignedProgramWorkoutCount, "тренировка", "тренировки", "тренировок")} · выполнено ${assignedProgramCompletion}%`}</p>
                  </div>
                </div>
                <button className={`${trainerClientWorkoutPlanStyles.editButton} ${trainerClientWorkoutPlanStyles.currentProgramEditButton} trainerClientProgramEditButton trainerClientProgramCurrentEditButton`} type="button" onClick={openProgramEditor} disabled={!scheduleWorkouts.length}>
                  Редактировать<ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className={`${trainerClientWorkoutPlanStyles.currentProgram} ${trainerClientWorkoutPlanStyles.emptyProgram}`}>
              <span className={trainerClientWorkoutPlanStyles.programIcon}><Dumbbell size={21} /></span>
              <div className={trainerClientWorkoutPlanStyles.currentInfo}>
                <span>Назначенная программа</span>
                <h3>Нет активной программы</h3>
                <p>Назначьте программу, чтобы создать следующий план тренировок клиента.</p>
              </div>
            </div>
          )}

      {isTrainerV2Path(window.location.pathname) && scheduleWorkouts.length ? (
        <TrainerWorkoutList workouts={scheduleWorkouts} slots={visibleWorkoutSlots} history={scheduleHistory} completion={assignedProgramCompletion} reviewedKeys={persistedReviewedKeys} localReviewedKeys={localReviewedKeys} onOpen={(id) => { setEditorWorkoutId(id); setEditorStatus(""); setEditorOpen(true); }} />
      ) : null}
          <TrainerClientDisclosure title={assignedProgramAssignment ? "Назначить другую программу" : "Выбрать программу для клиента"} className="trainerClientAssignmentDisclosure">
          <div className={trainerClientWorkoutPlanStyles.assignment}>
              <span>Назначить программу</span>
            <div className={trainerClientWorkoutPlanStyles.assignmentRow}>
              <div className={trainerClientWorkoutPlanStyles.selectField}>
                <select aria-label="Назначить программу клиенту" value={selectedTemplate?.id || ""} onChange={(event) => onSelectProgram(event.target.value)}>
                  <option value="">Выберите программу</option>
                  {assignableTemplates
                    .map((program) => <option value={program.id} key={program.id}>{program.name || "Без названия"}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              <button className={trainerClientWorkoutPlanStyles.assignButton} type="button" disabled={!selectedTemplate || !client} onClick={() => setAssignmentReviewOpen(true)}>
                <Check size={16} />Назначить
              </button>
            </div>
            {!assignableTemplates.length ? <small className={trainerClientWorkoutPlanStyles.hint}>Нет готовых программ. Откройте раздел «Программы» и подготовьте программу к назначению.</small> : null}
            {selectedTemplate && selectedProgramId !== client?.assignedProgramId
              ? <small className={trainerClientWorkoutPlanStyles.hint}>Будет назначена программа «{selectedTemplate.name || "Без названия"}».</small>
              : null}
          </div>
          </TrainerClientDisclosure>
        </div>
        {programStatus ? <p className={trainerClientWorkoutPlanStyles.status}>{programStatus}</p> : null}
      </section>

      {programHistoryOpen ? (
        <TrainerClientUtilitySheet
          title="История программ"
          eyebrow="Программы клиента"
          variant="programHistory"
          onRequestClose={() => setProgramHistoryOpen(false)}
        >
          <TrainerProgramHistoryPanel
            assignments={programTimeline}
            currentAssignmentKey={client?.assignedProgramAddedAt || client?.assignedProgramAt || client?.assignedAt
              ? `time:${client.assignedProgramAddedAt || client.assignedProgramAt || client.assignedAt}`
              : primaryProgramAssignment?.key || ""}
            hasBasicHistory={hasBasicProgramHistory}
            showBasicHistory={showBasicWorkoutHistory}
            onShowBasicHistoryChange={setShowBasicWorkoutHistory}
            onAction={requestProgramAssignmentAction}
            saving={programAssignmentSaving}
            status={programAssignmentStatus}
          />
        </TrainerClientUtilitySheet>
      ) : null}

      {!isTrainerV2Path(window.location.pathname) ? (<ClientSectionLaunchButton
        icon={ClipboardList}
        title={isTrainerV2Path(window.location.pathname) ? "История тренировок" : "Открыть разбор и историю тренировок"}
        description={isTrainerV2Path(window.location.pathname) ? "Все завершённые тренировки клиента" : visibleWorkoutReview
          ? "Последняя тренировка, комментарий клиента и все сохранённые записи"
          : "Все сохранённые тренировки клиента в одном месте"}
        onClick={() => setWorkoutInsightsOpen(true)}
      />) : null}
      </TrainerClientColumn>
      {isTrainerV2Path(window.location.pathname) ? <AppleSchedule slots={visibleWorkoutSlots} onOpenProgramHistory={() => setProgramHistoryOpen(true)} onOpenHistory={() => setWorkoutInsightsOpen(true)}>
      <WorkoutSchedulePlanner
        key={getWorkoutSchedulePlannerKey(client, scheduleWorkouts)}
        client={client}
        workouts={scheduleWorkouts}
        archivedWorkouts={scheduleArchivedWorkouts}
        history={history}
        completedWorkoutIds={scheduleCompletedWorkoutIds}
        onSaveSchedule={onSaveWorkoutSchedule}
        onSaveSubscription={onSaveSubscription}
        status={programStatus}
      />
      </AppleSchedule> : (
      <TrainerClientDisclosure enabled={!scheduleWorkouts.length} title="Абонемент и календарь" className="trainerClientEmptyCalendar">
      <WorkoutSchedulePlanner
        key={getWorkoutSchedulePlannerKey(client, scheduleWorkouts)}
        client={client}
        workouts={scheduleWorkouts}
        archivedWorkouts={scheduleArchivedWorkouts}
        history={history}
        completedWorkoutIds={scheduleCompletedWorkoutIds}
        onSaveSchedule={onSaveWorkoutSchedule}
        onSaveSubscription={onSaveSubscription}
        status={programStatus}
      />

      </TrainerClientDisclosure>
      )}
      {scheduleAssignmentRequest && scheduleModalAssignment ? (
        <TrainerProgramScheduleModal
          client={client}
          assignment={scheduleModalAssignment}
          archivedWorkouts={scheduleArchivedWorkouts}
          history={history}
          onSaveSchedule={(dates, assignmentWorkouts) => onSaveWorkoutSchedule?.(dates, assignmentWorkouts)}
          onClose={() => setScheduleAssignmentRequest(null)}
        />
      ) : null}



      {workoutInsightsOpen ? (
        <TrainerClientUtilitySheet
          title={isTrainerV2Path(window.location.pathname) ? "История тренировок" : "Разбор и история тренировок"}
          eyebrow="Тренировки клиента"
          variant="workoutHistory"
          onRequestClose={() => setWorkoutInsightsOpen(false)}
        >
          <TrainerWorkoutHistoryPanel
            history={history}
            actionableReview={visibleWorkoutReview}
            onAdjustNextWorkout={() => {
              setReviewStatus("");
              setWorkoutInsightsOpen(false);
              setReviewDecisionOpen(true);
            }}
            hasMore={client.trainerHistoryHasMore}
            loading={historyPageLoading}
            error={historyPageError}
            onLoadMore={async () => {
                setHistoryPageLoading(true); setHistoryPageError("");
                try { if (!await onLoadMoreHistory?.()) setHistoryPageError("Не удалось загрузить записи. Попробуйте ещё раз."); }
                catch { setHistoryPageError("Не удалось загрузить записи. Попробуйте ещё раз."); }
                finally { setHistoryPageLoading(false); }
            }}
          />
        </TrainerClientUtilitySheet>
      ) : null}

      {reviewDecisionOpen ? (
        <TrainerWorkoutReviewDecisionModal
          review={visibleWorkoutReview}
          targetWorkout={nextWorkoutTarget}
          saving={reviewSaving}
          status={reviewStatus}
          onConfirm={() => resolveWorkoutReview("accepted")}
          onEdit={openReviewEditor}
          onClose={() => setReviewDecisionOpen(false)}
        />
      ) : null}

      {assignmentReviewOpen && selectedTemplate ? (
        <TrainerProgramAssignmentAdjustmentModal
          client={client}
          template={selectedTemplate}
          workouts={buildClientWorkoutsFromTemplate(selectedTemplate)}
          history={history}
          onClose={() => setAssignmentReviewOpen(false)}
          onConfirm={confirmProgramAssignment}
        />
      ) : null}

      {programAssignmentConfirm ? createPortal(
        <TrainerConfirmDialog
          title={programAssignmentConfirm.action === "archive"
            ? "Убрать программу в архив?"
            : programAssignmentConfirm.action === "restore"
              ? "Вернуть программу из архива?"
              : "Удалить пустую программу?"}
          text={programAssignmentConfirm.action === "archive"
            ? `«${programAssignmentConfirm.assignment.name}». Программа и её даты исчезнут из активного плана. Выполненные тренировки останутся в истории. ${programAssignmentConfirm.assignment.key === primaryProgramAssignment?.key
              ? trainerProgramTimeline.some((item) => item.key !== programAssignmentConfirm.assignment.key && ["current", "future"].includes(item.status))
                ? "Клиент продолжит следующую незавершённую программу из своего плана."
                : "Другой незавершённой программы нет — у клиента не останется текущей программы."
              : "Текущая программа не изменится."}`
            : programAssignmentConfirm.action === "delete"
              ? `«${programAssignmentConfirm.assignment.name}». Сервер проверит отсутствие сохранённых занятий, результатов и признаков начала тренировки. Если клиент занимался без интернета, сначала дождитесь синхронизации. Будет удалена только эта копия у клиента. Общий шаблон и другие программы не изменятся. Отменить удаление нельзя.`
              : `«${programAssignmentConfirm.assignment.name}». Вернётся та же программа с прежними отметками выполнения — это не новое прохождение. Её сохранённые даты тоже вернутся: проверьте расписание. ${primaryProgramAssignment && primaryProgramAssignment.key !== programAssignmentConfirm.assignment.key ? "Текущая программа клиента останется текущей." : "Завершённая программа останется в истории, незавершённую можно будет продолжить."}`}
          confirmLabel={programAssignmentSaving
            ? "Сохраняю…"
            : (programAssignmentConfirm.action === "archive"
              ? "Убрать в архив"
              : programAssignmentConfirm.action === "delete" ? "Удалить программу" : "Вернуть программу")}
          status={programAssignmentStatus}
          isBusy={programAssignmentSaving}
          onConfirm={confirmProgramAssignmentAction}
          onCancel={() => {
            if (!programAssignmentSaving) setProgramAssignmentConfirm(null);
          }}
        />,
        document.body
      ) : null}

      {editorOpen ? (
        <div className="trainerClientModalBackdrop trainerWorkoutEditorModalBackdrop" data-trainer-modal-backdrop="true" role="dialog" aria-modal="true" aria-label="Редактор программы клиента" onClick={closeEditor} onKeyDown={(event) => { if (event.key === "Escape" && !document.querySelector("dialog[open]")) { event.stopPropagation(); closeEditor(); } }}>
          <section className={`trainerWorkoutEditorModal trainerClientProgramEditorModal ${trainerClientWorkoutPlanStyles.editorModal} ${clientProgramEditorStyles.modal}`} data-client-program-layout={isTrainerV2Path(window.location.pathname) ? "cards" : undefined} data-trainer-modal-surface="true" data-trainer-modal-frame="true" onClick={(event) => event.stopPropagation()}>
            <header data-trainer-modal-header="true">
              <div className={trainerClientWorkoutPlanStyles.programEditorHeaderContent}>
                <span>ПЕРСОНАЛЬНАЯ ПРОГРАММА КЛИЕНТА</span>
                <div className={trainerClientWorkoutPlanStyles.programEditorTitleRow}>
                  <h2>{programDraft.draft?.plan.assignedProgramName || assignedName}</h2>
                  <button
                    className={trainerClientWorkoutPlanStyles.programRenameHeaderButton}
                    type="button"
                    onClick={() => {
                      setProgramNameDraft(programDraft.draft?.plan.assignedProgramName || assignedName);
                      setProgramNameStatus("");
                      setProgramNameEditorOpen(true);
                    }}
                    disabled={!editorProps.onSave || programNameSaving}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span>Переименовать</span>
                  </button>
                </div>
                <p>Настройте будущие тренировки. Выполненные занятия и история останутся без изменений.</p>
                {programNameEditorOpen ? (
                  <form className={trainerClientWorkoutPlanStyles.programRenameHeaderForm} onSubmit={saveClientProgramName}>
                    <label>
                      <span>Название программы клиента</span>
                      <input
                        value={programNameDraft}
                        onChange={(event) => {
                          setProgramNameDraft(event.target.value.slice(0, 80));
                          setProgramNameStatus("");
                        }}
                        maxLength={80}
                        autoFocus
                        disabled={programNameSaving}
                      />
                    </label>
                    <div>
                      <button type="button" onClick={() => setProgramNameEditorOpen(false)} disabled={programNameSaving}>Отмена</button>
                      <button type="submit" disabled={programNameSaving}>Готово</button>
                    </div>
                    {programNameStatus ? <p role="alert">{programNameStatus}</p> : null}
                  </form>
                ) : null}
              </div>
              <button className="trainerNextModalClose" type="button" onClick={closeEditor} aria-label="Закрыть редактор" disabled={editorSaving || programNameSaving}><X size={18} /></button>
            </header>
            <div className="trainerWorkoutEditorModalBody" data-trainer-modal-content="true">
              <TrainerWorkoutEditor
                key={editorWorkoutId || "program-editor"}
                embedded
                showProgramControl={false}
                client={client}
                history={scheduleHistory}
                progressHistory={history}
                workouts={programDraft.draft?.plan.workouts || scheduleWorkouts}
                archivedWorkouts={[]}
                completedWorkoutIds={scheduleCompletedWorkoutIds}
                {...editorProps}
                {...programDraft.handlers}
                onOpenExerciseLibrary={openLibraryFromEditor}
                onUpdateLibraryExercise={editorProps.onUpdateLibraryExercise}
                onRemoveLibraryExercise={editorProps.onRemoveLibraryExercise}
                onCreateLibraryExercise={editorProps.onCreateLibraryExercise}
                onUploadLibraryExerciseVideo={editorProps.onUploadLibraryExerciseVideo}
                exerciseVideoUploadingId={programDraft.uploadingId}
                initialWorkoutId={editorWorkoutId}
                onSave={saveEditorChanges}
              />
            </div>
            <footer className={trainerClientWorkoutPlanStyles.editorFooter} data-trainer-modal-footer="true">
              <span className={clientProgramEditorStyles.footerHint}>Изменения применятся после сохранения.</span>
              {editorStatus ? <p role="status">{editorStatus}</p> : null}
              <button type="button" onClick={closeEditor} disabled={editorSaving}>Отмена</button>
              <button type="button" onClick={saveEditorChanges} disabled={editorSaving || Boolean(programDraft.uploadingId)}>
                {editorSaving ? "Сохраняю…" : "Сохранить"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {editorExitConfirm ? <TrainerProgramUnsavedDialog onContinue={() => { setEditorExitConfirm(false); setEditorLibraryRequested(false); }} onDiscard={discardEditor} onSave={saveEditorChanges} saving={editorSaving} status={editorStatus} /> : null}
    </div>
  );
}

function ClientExerciseProgress({
  client,
  history = [],
  workouts = [],
  reviews = [],
  onLoadMoreHistory,
  onResolve,
  onSaveAdjustment
}) {
  const [filter, setFilter] = useState("priority");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchId = useId();
  const searchRef = useRef(null);
  const [earlierHistoryLoading, setEarlierHistoryLoading] = useState(false);
  const [earlierHistoryError, setEarlierHistoryError] = useState("");
  const earlierHistoryPending = useRef(false);
  const historyCoverage = getTrainerHistoryCoverage(client);
  const [historyItem, setHistoryItem] = useState(null);
  const [decisionItem, setDecisionItem] = useState(null);
  const [locallyReviewedKeys, setLocallyReviewedKeys] = useState(() => new Set());
  const { allExerciseProgress } = useMemo(() => getExerciseProgressData(history), [history]);
  const persistedReviewedKeys = useMemo(
    () => getTrainerExerciseProgressReviewedKeys(reviews),
    [reviews]
  );
  const reviewedKeys = useMemo(
    () => new Set([...persistedReviewedKeys, ...locallyReviewedKeys]),
    [locallyReviewedKeys, persistedReviewedKeys]
  );
  const exerciseProgress = useMemo(() => allExerciseProgress.map((item) => {
    const reviewKey = getTrainerExerciseProgressReviewKey(item);
    return { ...item, reviewKey, reviewed: reviewedKeys.has(reviewKey) };
  }), [allExerciseProgress, reviewedKeys]);
  const priorityProgress = exerciseProgress.filter((item) => (
    ["regression", "adaptation", "mixed"].includes(item.status) && !item.reviewed
  ));
  const progressing = exerciseProgress.filter((item) => item.status === "progress").length;
  const decisionTarget = useMemo(() => decisionItem
    ? findTrainerExerciseProgressTarget({
        item: decisionItem,
        workouts,
        history,
        workoutCalendar: client?.workoutCalendar || {}
      })
    : null, [client?.workoutCalendar, decisionItem, history, workouts]);
  const exerciseProgressFilters = [
    {
      id: "priority",
      label: "Важное",
      count: priorityProgress.length
    },
    { id: "progress", label: "Прогресс", count: progressing },
    { id: "regression", label: "Проверить", count: priorityProgress.length },
    { id: "all", label: "Все", count: exerciseProgress.length }
  ];
  const filteredExerciseProgress = (() => {
    if (filter === "progress") return exerciseProgress.filter((item) => item.status === "progress");
    if (filter === "regression") return priorityProgress;
    if (filter === "all") return exerciseProgress;
    return priorityProgress;
  })();
  const normalizeSearch = value => String(value || "").normalize("NFKC").toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const searchTerms = normalizeSearch(searchQuery).split(" ").filter(Boolean);
  const matchesSearch = item => {
    const name = normalizeSearch(item.name);
    return searchTerms.every(term => name.includes(term));
  };
  const displayedExerciseProgress = filteredExerciseProgress.filter(matchesSearch);
  const matchesInAllStatuses = searchTerms.length ? exerciseProgress.filter(matchesSearch).length : exerciseProgress.length;
  function updateSearch(value) {
    // Starting a search covers stable and reviewed exercises too. The trainer
    // can then deliberately narrow the results using the existing filters.
    if (!normalizeSearch(searchQuery) && normalizeSearch(value)) setFilter("all");
    setSearchQuery(value);
  }
  const focusText = (() => {
    if (!exerciseProgress.length) return "Появится после двух заполненных тренировок по одному упражнению.";
    if (filter === "progress") return "Здесь видны упражнения, где клиент реально прибавляет по силе, объёму или повторам.";
    if (filter === "regression") return "Это список для проверки: нагрузка могла просесть из-за восстановления, техники или смены условий.";
    if (filter === "all") return "Упражнения из загруженной истории с последним сравнением результатов.";
    return priorityProgress.length
      ? "Сначала показаны упражнения, где тренеру стоит принять решение: проверить регресс или дождаться адаптации."
      : "Все сигналы по нагрузке проверены тренером.";
  })();

  async function resolveDecision(payload) {
    const result = await onResolve?.(payload);
    if (result) {
      setLocallyReviewedKeys((current) => new Set([...current, payload.reviewKey]));
    }
    return result;
  }

  async function loadEarlierHistory() {
    if (!onLoadMoreHistory || earlierHistoryPending.current) return;
    earlierHistoryPending.current = true;
    setEarlierHistoryLoading(true);
    setEarlierHistoryError("");
    try {
      if (await onLoadMoreHistory() === false) setEarlierHistoryError("Не удалось загрузить более ранние тренировки. Попробуйте ещё раз.");
    } catch {
      setEarlierHistoryError("Не удалось загрузить более ранние тренировки. Попробуйте ещё раз.");
    } finally {
      earlierHistoryPending.current = false;
      setEarlierHistoryLoading(false);
    }
  }
  const historyNotice = historyCoverage !== "complete" ? <div className={exerciseProgressStyles.historyCoverage}>
    <p>{historyCoverage === "error" ? "История загружена не полностью из-за ошибки. Показываем доступные результаты; обновите карточку клиента для повторной проверки." : "Загружена часть истории. Для поиска и графика более ранних результатов можно подгрузить тренировки."}</p>
    {historyCoverage === "partial" && onLoadMoreHistory ? <button type="button" disabled={earlierHistoryLoading} onClick={loadEarlierHistory}>{earlierHistoryLoading ? "Загружаем…" : "Загрузить более ранние тренировки"}</button> : null}
    {earlierHistoryError ? <p role="alert">{earlierHistoryError}</p> : null}
  </div> : null;

  if (historyItem) return <ExerciseProgressHistoryModal item={exerciseProgress.find(item => item.name.trim().toLocaleLowerCase("ru-RU") === historyItem.name.trim().toLocaleLowerCase("ru-RU")) || historyItem} historyNotice={historyNotice} onClose={() => setHistoryItem(null)} />;

  return (
    <section className="trainerClientExerciseProgress">
      <header className="trainerExerciseProgressHeader">
        <div className="trainerExerciseProgressHeading">
          <span className="trainerExerciseProgressHeadingIcon"><BarChart3 size={22} /></span>
          <div>
            <h3>Анализ прогресса упражнений</h3>
            <p>{focusText}</p>
          </div>
        </div>
        <button className="trainerExerciseProgressFilterToggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>
          <SlidersHorizontal size={16} /> Фильтры <ChevronDown size={15} aria-hidden="true" />
        </button>
      </header>
      <div className={exerciseProgressStyles.searchBlock}>
        <label htmlFor={searchId}>Поиск упражнений</label>
        <div className={exerciseProgressStyles.searchField}>
          <Search size={18} aria-hidden="true" />
          <input id={searchId} ref={searchRef} type="search" value={searchQuery} maxLength={100} autoComplete="off" placeholder="Название или часть названия" onChange={event => updateSearch(event.target.value)} />
          {searchQuery ? <button type="button" aria-label="Очистить поиск упражнений" onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}><X size={18} aria-hidden="true" /></button> : null}
        </div>
        <p className={exerciseProgressStyles.searchResult} role="status" aria-live="polite" aria-atomic="true">
          <span>{searchTerms.length ? `Найдено: ${displayedExerciseProgress.length}` : `Показано: ${displayedExerciseProgress.length} из ${exerciseProgress.length}`}</span>
          <span>Фильтр: {exerciseProgressFilters.find(item => item.id === filter)?.label}</span>
        </p>
        <small className={exerciseProgressStyles.searchHint}>В анализе — упражнения минимум с двумя тренировками, где записаны рабочие подходы.</small>
      </div>
      {historyNotice}
      {filtersOpen ? (
      <div className="trainerExerciseProgressToolbar" aria-label="Фильтры прогресса упражнений">
        {exerciseProgressFilters.map((item) => (
          <button type="button" className={filter === item.id ? "active" : ""} aria-pressed={filter === item.id} key={item.id} onClick={() => setFilter(item.id)}>
            {item.label}<span>{item.count}</span>
          </button>
        ))}
      </div>
      ) : null}
      <div className="trainerExerciseProgressList">
        {displayedExerciseProgress.map((item) => (
          <article className={`trainerExerciseProgressRow ${item.status}`} key={item.reviewKey}>
            <div className="trainerExerciseProgressName">
              <span className="trainerExerciseProgressExerciseIcon"><Dumbbell size={24} /></span>
              {item.reviewed
                ? <b className={trainerExerciseLoadReviewStyles.reviewedBadge}><Check size={12} />Проверено тренером</b>
                : <b className={`trainerExerciseStatus ${item.tone}`}>{item.label}</b>}
              <strong>{item.name}</strong>
              <small>Сравнение тренировок: {formatCompactDate(item.previous.date)} → {formatCompactDate(item.current.date)}</small>
            </div>
            <div className="trainerExerciseProgressMetrics">
              <span>
                <small title={item.current.e1rmFormula}><TrendingUp size={13} />Оценочный 1ПМ</small>
                <b>{item.previous.e1rm || "—"} → {item.current.e1rm || "—"} кг</b>
                <em className={getDeltaTone(item.changes?.e1rmPct)}>{formatPercentChange(item.changes?.e1rmPct)}</em>
              </span>
              <span>
                <small><Database size={13} />Объём</small>
                <b>{item.previous.volume || "—"} → {item.current.volume || "—"} кг</b>
                <em className={getDeltaTone(item.changes?.volumePct)}>{formatPercentChange(item.changes?.volumePct)}</em>
              </span>
              <span>
                <small><Repeat2 size={13} />Повторы</small>
                <b>{item.previous.totalReps || "—"} → {item.current.totalReps || "—"}</b>
                <em className={getDeltaTone(item.changes?.reps)}>{formatSignedDelta(item.changes?.reps)}</em>
              </span>
            </div>
            <div className="trainerExerciseProgressResult">
              <div className="trainerExerciseProgressResultHead">
                <strong>
                  {item.previous.bestWeight || "—"} кг × {item.previous.averageReps} × {item.previous.sets}
                  {" → "}
                  {item.current.bestWeight || "—"} кг × {item.current.averageReps} × {item.current.sets}
                </strong>
                <div className={`${workspaceFeatureStyles.actions} trainerExerciseProgressActions`}>
                  <button type="button" onClick={() => setHistoryItem(item)}>
                    <History size={15} />Открыть историю
                  </button>
                  {!item.reviewed ? (
                    <button type="button" onClick={() => setDecisionItem(item)}><SlidersHorizontal size={15} />Скорректировать нагрузку</button>
                  ) : null}
                </div>
              </div>
              <small className={`trainerExerciseProgressCardNote ${item.tone}`}>{item.explanation}</small>
            </div>
          </article>
        ))}
        {!displayedExerciseProgress.length ? <div className={exerciseProgressStyles.searchEmpty}>
          <strong>{searchTerms.length ? "Упражнение не найдено" : "По выбранному фильтру пока нет упражнений"}</strong>
          <p>{!exerciseProgress.length ? "Для сравнения нужны минимум две тренировки с записанными рабочими подходами по одному упражнению. Упражнения с одной записью ещё не попадают в анализ." : searchTerms.length ? "Проверьте название или сократите запрос. Поиск идёт по упражнениям с двумя и более записями в загруженной истории." : "В этом статусе упражнений нет. Остальные результаты доступны в фильтре «Все»."}</p>
          {filter !== "all" && matchesInAllStatuses > 0 ? <button type="button" onClick={() => setFilter("all")}>Показать во всех статусах · {matchesInAllStatuses}</button> : null}
        </div> : null}
      </div>
      {decisionItem ? (
        <TrainerExerciseLoadReviewModal
          key={`${decisionItem.reviewKey}:${decisionTarget?.workoutId || "none"}:${decisionTarget?.exerciseId || "none"}`}
          item={decisionItem}
          target={decisionTarget}
          reviewKey={decisionItem.reviewKey}
          onClose={() => setDecisionItem(null)}
          onResolve={resolveDecision}
          onSaveAdjustment={onSaveAdjustment}
        />
      ) : null}
    </section>
  );
}

function ExerciseProgressHistoryModal({ item, historyNotice, onClose }) {
  return (
      <section className="trainerExerciseProgressHistoryModal trainerExerciseProgressHistoryInline" aria-labelledby="trainer-exercise-history-title">
        <button className="trainerExerciseProgressHistoryBack" type="button" onClick={onClose}><ChevronLeft size={18} />К прогрессу упражнений</button>
        <header>
          <div>
            <span>ИСТОРИЯ УПРАЖНЕНИЯ</span>
            <h2 id="trainer-exercise-history-title">{item?.name || "Упражнение"}</h2>
            <p>Сначала последние тренировки. На графике время идёт слева направо.</p>
          </div>
        </header>
        <div className="trainerExerciseProgressHistoryModalBody">
          {historyNotice}
          <TrainerExerciseHistoryChart sessions={item?.sessions || []} />
          <section className="trainerExerciseProgressHistorySummary">
            <span><small>Предыдущая тренировка</small><strong>{item?.previous?.bestWeight || "—"} кг × {item?.previous?.averageReps || "—"} × {item?.previous?.sets || "—"}</strong></span>
            <span><small>Последняя тренировка</small><strong>{item?.current?.bestWeight || "—"} кг × {item?.current?.averageReps || "—"} × {item?.current?.sets || "—"}</strong></span>
          </section>
          <section className="trainerExerciseProgressHistoryContext">
            <small>{item?.current?.weightConventionLabel}. {item?.current?.e1rmFormula}{item?.current?.e1rmLowConfidence ? ". При большом числе повторений оценка менее точна." : "."}</small>
            {item?.current?.loadChangedByClient ? <small className="warning">⚠️ Клиент самостоятельно изменил рабочий вес.</small> : null}
            {item?.current?.clientComment ? <small>Комментарий клиента: «{item.current.clientComment}»</small> : null}
            {item?.current?.painReported ? <small className="negative">⚠️ В комментарии упоминается боль или травма — проверьте нагрузку.</small> : null}
          </section>
          <section className="trainerExerciseProgressHistorySessions">
            {(item?.sessions || []).slice().reverse().map((session, sessionIndex) => (
              <article key={`${item.name}_${session.date?.toISOString?.() || "undated"}_${sessionIndex}`}>
                <strong>{formatCompactDate(session.date)} · выполнено</strong>
                {(session.actualSets || []).map((set, index) => (
                  <small key={`${sessionIndex}_${index}`}>
                    {index + 1}. План: {session.plannedSets?.[index]?.weight || "—"} кг × {session.plannedSets?.[index]?.reps || "—"} · Факт: {set.weight || "—"} кг × {set.reps || "—"}
                    {set.rpe ? ` · RPE ${set.rpe}` : ""}{set.rir ? ` · RIR ${set.rir}` : ""} · объём {set.volume || 0} кг
                  </small>
                ))}
              </article>
            ))}
            {!item?.sessions?.length ? <div className="trainerNextEmpty">История выполнения пока недоступна.</div> : null}
          </section>
        </div>
      </section>
  );
}

function NutritionAnalytics({ nutritionDays, target, onOpenDiary }) {
  return isTrainerV2Path(window.location.pathname)
    ? <TrainerClientFamiliarNutritionAnalytics nutritionDays={nutritionDays} target={target} onOpenDiary={onOpenDiary} />
    : <LegacyNutritionAnalytics nutritionDays={nutritionDays} target={target} />;
}

function LegacyNutritionAnalytics({ nutritionDays, target }) {
  const [period, setPeriod] = useState("7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedDays = nutritionDays
    .map((day) => ({ ...day, parsedDate: getNutritionDayDate(day.date) }))
    .filter((day) => day.parsedDate && day.parsedDate < today);
  const periodDays = completedDays.filter((day) => {
    if (period === "custom") {
      const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
      const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
      return (!start || day.parsedDate >= start) && (!end || day.parsedDate <= end);
    }
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - Number(period));
    return day.parsedDate >= cutoff;
  });
  const recentDays = [...periodDays].sort((a, b) => a.parsedDate - b.parsedDate);
  // Keep the selected period intact: the chart scales its columns instead of
  // dropping earlier days or creating a second row.
  const chartDays = recentDays;
  const chartDensity = chartDays.length > 21 ? "dense" : chartDays.length > 14 ? "compact" : "standard";
  const trackedDays = recentDays.filter((day) => Number(day.totals?.calories) > 0);
  const divisor = Math.max(1, trackedDays.length);
  const averages = trackedDays.reduce((sum, day) => ({
    calories: sum.calories + (Number(day.totals?.calories) || 0),
    protein: sum.protein + (Number(day.totals?.protein) || 0),
    fat: sum.fat + (Number(day.totals?.fat) || 0),
    carbs: sum.carbs + (Number(day.totals?.carbs) || 0)
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
  Object.keys(averages).forEach((key) => { averages[key] = Math.round(averages[key] / divisor); });
  const adherence = averages.calories
    ? Math.max(0, Math.round(100 - Math.abs(averages.calories - target.calories) / Math.max(1, target.calories) * 100))
    : 0;
  const maxCalories = Math.max(target.calories, ...chartDays.map((day) => Number(day.totals?.calories) || 0), 1);
  const macroCalories = {
    protein: averages.protein * 4,
    fat: averages.fat * 9,
    carbs: averages.carbs * 4
  };
  const macroTotal = Math.max(1, macroCalories.protein + macroCalories.fat + macroCalories.carbs);
  const proteinAngle = macroCalories.protein / macroTotal * 360;
  const fatAngle = macroCalories.fat / macroTotal * 360;

  return (
    <div className="trainerNutritionAnalytics">
      <section className="trainerNutritionPeriod">
        <div>
          <strong>Период аналитики</strong>
          <small>Сегодняшний день не участвует в средних значениях.</small>
        </div>
        <div className="trainerNutritionPeriodButtons">
          {["7", "14", "30"].map((value) => (
            <button
              type="button"
              className={period === value ? "active" : ""}
              aria-pressed={period === value}
              key={value}
              onClick={() => setPeriod(value)}
            >
              {value} дней
            </button>
          ))}
          <button
            type="button"
            className={period === "custom" ? "active" : ""}
            aria-pressed={period === "custom"}
            onClick={() => setPeriod("custom")}
          >
            Период
          </button>
        </div>
        {period === "custom" ? (
          <div className="trainerNutritionCustomPeriod">
            <label><span>С</span><input type="date" max={toDateInputValue(new Date(today.getTime() - 86400000))} value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
            <label><span>По</span><input type="date" max={toDateInputValue(new Date(today.getTime() - 86400000))} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
          </div>
        ) : null}
      </section>
      <section className="trainerNutritionMetricGrid">
        <article><span>Дней заполнено</span><strong>{trackedDays.length}/{period === "custom" ? recentDays.length || "—" : period}</strong><small>только завершённые дни</small></article>
        <article><span>Средние калории</span><strong>{averages.calories || "—"}</strong><small>цель {target.calories} ккал</small></article>
        <article><span>Средний белок</span><strong>{averages.protein || "—"} г</strong><small>цель {target.protein} г</small></article>
        {!isTrainerV2Path(window.location.pathname) ? <article><span>Соблюдение плана</span><strong>{adherence}%</strong><small>{adherence >= 85 ? "хороший результат" : "нужна корректировка"}</small></article> : null}
      </section>

      <div className="trainerNutritionAnalyticsMain">
        <section className="trainerClientAnalyticsCard trainerNutritionCaloriesChart">
          <header><div><span>КАЛОРИЙНОСТЬ</span><h3>{period === "custom" ? "Питание за выбранный период" : `Питание за ${period} дней`}</h3></div><strong>цель {target.calories}</strong></header>
          {isTrainerV2Path(window.location.pathname) && trackedDays.length > 0 ? <div className={appleStyles.calorieSummary}><strong>{trackedDays.length && target.calories ? Math.round(averages.calories / target.calories * 100) : "—"}%</strong><span>от цели {target.calories} ккал</span></div> : null}
          <div
            className="trainerClientBarChart"
            data-density={chartDensity}
            style={{ "--nutrition-chart-days": Math.max(1, chartDays.length) }}
          >
            {chartDays.map((day, index) => {
              const calories = Math.round(Number(day.totals?.calories) || 0);
              const date = day.parsedDate;
              const dateLabel = date
                ? date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                : `День ${index + 1}`;
              return (
                <div
                  aria-label={`${dateLabel}: ${calories || 0} ккал`}
                  key={day.date || index}
                  title={`${dateLabel}: ${calories || 0} ккал`}
                >
                  <span><i className={calories > target.calories * 1.15 ? "over" : ""} style={{ height: `${Math.max(6, calories / maxCalories * 100)}%` }} /></span>
                  <b>{calories || "—"}</b>
                  <small>{date ? date.toLocaleDateString("ru-RU", { weekday: "short" }) : `Д${index + 1}`}</small>
                </div>
              );
            })}
            {!chartDays.length ? <div className="trainerNextEmpty">В завершённых днях выбранного периода нет записей.</div> : null}
          </div>
        </section>

        <section className="trainerClientAnalyticsCard trainerNutritionBalance">
          <header><div><span>СРЕДНИЙ БАЛАНС</span><h3>{isTrainerV2Path(window.location.pathname) ? "Баланс за период" : "Распределение БЖУ"}</h3></div><Utensils size={20} /></header>
          {isTrainerV2Path(window.location.pathname) ? <div className={appleStyles.macros}>{[["protein", "Белки"], ["fat", "Жиры"], ["carbs", "Углеводы"]].map(([key, label]) => <div key={key}><span>{label}</span><strong>{trackedDays.length ? averages[key] : "—"} <small>г</small></strong><progress max={Math.max(target[key], averages[key], 1)} value={averages[key]} aria-label={`${label}: ${averages[key]} г, цель ${target[key]} г`} /><small>Цель {target[key]} г</small></div>)}</div> : (
          <div className="trainerNutritionDonutRow">
            <div
              className="trainerNutritionDonut"
              style={{ background: `conic-gradient(#e8f6ee 0 ${proteinAngle}deg, #fff4df ${proteinAngle}deg ${proteinAngle + fatAngle}deg, var(--trainer-v2-surface, #eee8fa) ${proteinAngle + fatAngle}deg 360deg)` }}
            >
              <span><strong>{averages.calories || "—"}</strong><small>ккал</small></span>
            </div>
            <div className="trainerNutritionLegend">
              <span className="protein"><b>Белки</b><strong>{averages.protein} г</strong></span>
              <span className="fat"><b>Жиры</b><strong>{averages.fat} г</strong></span>
              <span className="carbs"><b>Углеводы</b><strong>{averages.carbs} г</strong></span>
            </div>
          </div>          )}
          <p>{trackedDays.length < 4
            ? "Недостаточно данных для устойчивого вывода. Попросите клиента чаще заполнять дневник."
            : adherence >= 85
              ? "Рацион близок к назначенной цели. Контролируйте белок и регулярность записей."
              : "Средняя калорийность заметно отличается от плана. Обсудите причины с клиентом."}</p>
        </section>
      </div>
    </div>
  );
}

function NutritionDiary({ nutritionDays }) {
  const [activeDay, setActiveDay] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState("");
  const visibleDays = nutritionDays.slice(0, 30);
  const day = visibleDays[activeDay] || visibleDays[0] || { foods: [], totals: {} };
  const foods = day.foods || day.items || [];
  const totals = day.totals || {};
  const hasDiaryRecords = foods.length > 0 || Number(totals.calories) > 0;
  const calendarEntries = visibleDays.flatMap((item, index) => {
    const date = getWorkspaceDate(item.date);
    if (!date) return [];
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const dateKey = `${monthKey}-${String(date.getDate()).padStart(2, "0")}`;
    return [{
      item,
      index,
      date,
      monthKey,
      dateKey,
      calories: Math.round(Number(item.totals?.calories) || 0)
    }];
  });
  const entriesByDate = new Map(calendarEntries.map((entry) => [entry.dateKey, entry]));
  const availableMonths = [...new Set(calendarEntries.map((entry) => entry.monthKey))].sort((left, right) => right.localeCompare(left));
  const activeDate = getWorkspaceDate(day.date);
  const activeMonthKey = activeDate
    ? `${activeDate.getFullYear()}-${String(activeDate.getMonth() + 1).padStart(2, "0")}`
    : "";
  const displayedMonthKey = availableMonths.includes(calendarMonth)
    ? calendarMonth
    : activeMonthKey || availableMonths[0] || "";
  const displayedMonthIndex = availableMonths.indexOf(displayedMonthKey);
  const [displayedYear, displayedMonth] = displayedMonthKey.split("-").map(Number);
  const daysInDisplayedMonth = displayedMonthKey ? new Date(displayedYear, displayedMonth, 0).getDate() : 0;
  const firstWeekday = displayedMonthKey ? (new Date(displayedYear, displayedMonth - 1, 1).getDay() + 6) % 7 : 0;
  const trailingCells = displayedMonthKey ? (7 - (firstWeekday + daysInDisplayedMonth) % 7) % 7 : 0;
  const calendarCells = displayedMonthKey
    ? [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInDisplayedMonth }, (_, index) => {
        const dayNumber = index + 1;
        const dateKey = `${displayedMonthKey}-${String(dayNumber).padStart(2, "0")}`;
        return { dayNumber, dateKey, entry: entriesByDate.get(dateKey) || null };
      }),
      ...Array.from({ length: trailingCells }, () => null)
    ]
    : [];
  const calendarTitle = displayedMonthKey
    ? new Date(displayedYear, displayedMonth - 1, 1)
      .toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      .replace(/^./, (letter) => letter.toUpperCase())
    : "Нет записей";

  if (isTrainerV2Path(window.location.pathname) && !visibleDays.length) {
    return <section className="trainerNextSimplePanel" role="status">
      <h2>В дневнике пока нет записей</h2>
      <p>Это не означает, что клиент ничего не ел. Калории и БЖУ пока неизвестны.</p>
      <p className="trainerNutritionReadonly"><Eye size={15} aria-hidden="true" />Дневник доступен только для просмотра.</p>
    </section>;
  }

  return (
    <div className={`trainerNutritionDiary ${nutritionDiaryStyles.calendarDiary}`}>
      <aside aria-label="Календарь дневника питания">
        <div className="trainerNutritionDiaryCalendarHeader">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            disabled={displayedMonthIndex < 0 || displayedMonthIndex >= availableMonths.length - 1}
            onClick={() => setCalendarMonth(availableMonths[displayedMonthIndex + 1] || displayedMonthKey)}
          ><ChevronLeft size={18} /></button>
          <strong>{calendarTitle}</strong>
          <button
            type="button"
            aria-label="Следующий месяц"
            disabled={displayedMonthIndex <= 0}
            onClick={() => setCalendarMonth(availableMonths[displayedMonthIndex - 1] || displayedMonthKey)}
          ><ChevronRight size={18} /></button>
        </div>
        <div className="trainerNutritionDiaryWeekdays" aria-hidden="true">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="trainerNutritionDiaryCalendarGrid">
          {calendarCells.map((cell, index) => {
            if (!cell) return <span className="trainerNutritionDiaryCalendarEmpty" aria-hidden="true" key={`empty_${index}`} />;
            const { entry, dayNumber } = cell;
            const dateLabel = new Date(displayedYear, displayedMonth - 1, dayNumber).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
            const isActive = entry?.index === activeDay;
            return (
              <button
                type="button"
                className={`${isActive ? "active " : ""}${entry ? "has-entry" : "is-empty"}`}
                aria-label={entry ? `${dateLabel}: ${entry.calories} ккал` : `${dateLabel}: нет записи`}
                aria-pressed={isActive}
                disabled={!entry}
                key={cell.dateKey}
                onClick={() => {
                  if (!entry) return;
                  setActiveDay(entry.index);
                  setCalendarMonth(entry.monthKey);
                }}
                title={entry ? `${dateLabel}: ${entry.calories} ккал` : "Нет записи"}
              >
                <strong>{dayNumber}</strong>
                {entry ? <small>{entry.calories || "—"}</small> : null}
              </button>
            );
          })}
        </div>
        <p className="trainerNutritionDiaryCalendarHint">В ячейке указаны съеденные ккал. Нажмите на дату, чтобы открыть записи.</p>
      </aside>
      <section className="trainerNextMealPanel">
        <div className="trainerNutritionDiaryHead">
          <div><span>ДНЕВНИК КЛИЕНТА</span><h2>{day.date ? new Date(day.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "Нет записей"}</h2></div>
          <strong>{isTrainerV2Path(window.location.pathname) && !hasDiaryRecords ? "Нет данных" : `${Math.round(Number(totals.calories) || 0)} ккал`}</strong>
        </div>
        {(!isTrainerV2Path(window.location.pathname) || hasDiaryRecords) ? <div className="trainerNutritionDiaryTotals">
          <span>Б <b>{Math.round(Number(totals.protein) || 0)} г</b></span>
          <span>Ж <b>{Math.round(Number(totals.fat) || 0)} г</b></span>
          <span>У <b>{Math.round(Number(totals.carbs) || 0)} г</b></span>
        </div> : null}
        <div className="trainerNextMealList">
          {foods.map((food, index) => (
            <article key={food.id || `${food.name}_${index}`}>
              <span className="trainerNextFoodIcon">{food.icon || "🍽️"}</span>
              <div><small>{food.mealTitle || food.meal || "Прием пищи"}</small><strong>{food.name || "Продукт"}</strong><p>Б: {Math.round(Number(food.protein) || 0)} · Ж: {Math.round(Number(food.fat) || 0)} · У: {Math.round(Number(food.carbs) || 0)} · {Math.round(Number(food.calories) || 0)} ккал</p></div>
            </article>
          ))}
          {!foods.length ? <div className="trainerNextEmpty">В этот день клиент ничего не добавил.</div> : null}
        </div>
        <p className="trainerNutritionReadonly"><Eye size={15} />Дневник доступен только для просмотра.</p>
      </section>
    </div>
  );
}

function NutritionPlan({ client, profile = {}, history = [], nutritionDays = [], goals, planOptions = [], onSavePlan, onGeneratePlan, status }) {
  const currentPlan = client?.nutritionPlan || null;
  const presetOptions = Array.isArray(planOptions) && planOptions.length
    ? planOptions
    : Object.entries(NUTRITION_PLAN_PRESETS).map(([id, item]) => ({ id, ...item }));
  const presetMap = Object.fromEntries(presetOptions.map((item) => [normalizeNutritionPresetId(item.id), item]));
  const buildDraft = () => ({
    name: currentPlan?.name || "Индивидуальный план",
    goal: currentPlan?.goal || client?.goalDescription || client?.goal || "",
    calories: Number(currentPlan?.calories || goals.calories) || 2000,
    protein: Number(currentPlan?.protein || goals.protein) || 150,
    fat: Number(currentPlan?.fat || goals.fat) || 50,
    carbs: Number(currentPlan?.carbs || goals.carbs) || 200,
    validFrom: currentPlan?.validFrom || "",
    validTo: currentPlan?.validTo || "",
    presetId: normalizeNutritionPresetId(currentPlan?.presetId || currentPlan?.preset || "custom")
  });
  const initialDraft = buildDraft();
  const initialPreset = presetMap[initialDraft.presetId] ? initialDraft.presetId : "custom";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState(initialPreset);
  const [draft, setDraft] = useState(() => ({
    ...initialDraft,
    presetId: initialPreset
  }));
  const [preparedAiPlan, setPreparedAiPlan] = useState(null);
  const [aiStatus, setAiStatus] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isIndividualPreset = preset === "custom";
  useBodyScrollLock(editing, { lockHtml: true });
  const visiblePlan = editing ? draft : {
    name: currentPlan?.name || draft.name,
    goal: currentPlan?.goal || draft.goal,
    calories: Number(goals.calories) || draft.calories,
    protein: Number(goals.protein) || draft.protein,
    fat: Number(goals.fat) || draft.fat,
    carbs: Number(goals.carbs) || draft.carbs,
    validFrom: currentPlan?.validFrom || draft.validFrom,
    validTo: currentPlan?.validTo || draft.validTo
  };

  function selectPreset(value) {
    const normalizedValue = normalizeNutritionPresetId(value);
    setPreparedAiPlan(null);
    setAiStatus("");
    setPreset(normalizedValue);
    if (presetMap[normalizedValue]) {
      setDraft((current) => ({
        ...current,
        ...presetMap[normalizedValue],
        presetId: normalizedValue
      }));
      return;
    }
    setDraft((current) => ({ ...current, presetId: "custom" }));
  }

  async function savePlan() {
    setSaving(true);
    try {
      const saved = await onSavePlan?.({
        ...draft,
        presetId: draft.presetId || preset,
        ...(preparedAiPlan ? { aiNutritionPlan: preparedAiPlan } : {})
      });
      if (saved !== false) setSaveSuccess(true);
    } catch (error) {
      console.error("Trainer AI nutrition plan save error:", error);
      setAiStatus("Не удалось сохранить план. Проверьте соединение и повторите попытку.");
    } finally {
      setSaving(false);
    }
  }

  function prepareAiPlan() {
    const prepared = buildTrainerAiNutritionPlanDraft({
      client,
      profile,
      history,
      nutritionDays,
      nutritionGoals: goals
    });
    setAiStatus(prepared.message || "");
    onGeneratePlan?.(prepared);
    if (!prepared.ok) return;

    setPreset("custom");
    setDraft((current) => ({ ...current, ...prepared.planDraft }));
    setPreparedAiPlan(prepared.aiNutritionPlan);
  }

  function closePlanEditor() {
    if (saving || saveSuccess) return;
    const nextDraft = buildDraft();
    const nextPreset = presetMap[nextDraft.presetId] ? nextDraft.presetId : "custom";
    setPreset(nextPreset);
    setDraft({ ...nextDraft, presetId: nextPreset });
    setPreparedAiPlan(null);
    setAiStatus("");
    setEditing(false);
  }

  return (
    <div className="trainerNutritionPlan">
      {isTrainerV2Path(window.location.pathname) ? <h3 className={appleStyles.nutritionPlanHeading}>План питания</h3> : null}
      <section className="trainerNutritionCurrentPlan">
        <div className="trainerClientBlockHeading">
          <span><Utensils size={19} /></span>
          <div>
            <small>ПЛАН ПИТАНИЯ КЛИЕНТА</small>
            <h2>{currentPlan ? visiblePlan.name || "Индивидуальный план" : "План ещё не назначен"}</h2>
            <p>{currentPlan ? visiblePlan.goal || "Цель пока не указана" : "Дневник и аналитика доступны без назначенного плана."}</p>
          </div>
        </div>
        {currentPlan ? <div className="trainerNutritionCurrentGoals">
          <span><small>Калории</small><strong>{Number(visiblePlan.calories) || 0} ккал</strong></span>
          <span><small>Белки</small><strong>{Number(visiblePlan.protein) || 0} г</strong></span>
          <span><small>Жиры</small><strong>{Number(visiblePlan.fat) || 0} г</strong></span>
          <span><small>Углеводы</small><strong>{Number(visiblePlan.carbs) || 0} г</strong></span>
        </div> : null}
        <div className="trainerNutritionCurrentMeta">
          {currentPlan ? <>
            <span>Изменён: <b>{currentPlan.updatedAt ? new Date(currentPlan.updatedAt).toLocaleDateString("ru-RU") : "не сохранялся"}</b></span>
            <span>Период: <b>{visiblePlan.validFrom ? `${visiblePlan.validFrom}${visiblePlan.validTo ? ` — ${visiblePlan.validTo}` : ""}` : "без ограничения"}</b></span>
          </> : null}
          {!editing ? (
            <button
              type="button"
              className="trainerNutritionPlanEditButton"
              onClick={() => setEditing(true)}
            >
              {currentPlan ? "Изменить план питания" : "Создать план питания"}
            </button>
          ) : null}
        </div>
      </section>

      {editing ? (
      <div className="trainerNextModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && !saveSuccess && closePlanEditor()}>
      <section className="trainerNutritionPlanModal" role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-nutrition-plan-modal-title">
        <header data-trainer-modal-header="true">
          <div>
            <span>ПЛАН ПИТАНИЯ КЛИЕНТА</span>
            <h2 id="trainer-nutrition-plan-modal-title">Изменить план</h2>
            <p>Готовый вариант фиксирует название и КБЖУ. Для изменения выберите «Индивидуальные значения».</p>
          </div>
          <button className="trainerNextModalClose" type="button" onClick={closePlanEditor} disabled={saving || saveSuccess} aria-label="Закрыть редактор плана"><X size={20} /></button>
        </header>
        <div className="trainerNutritionPlanModalBody" data-trainer-modal-content="true">
        <section className="trainerClientAssignment">
        <div className="trainerClientBlockHeading">
          <span><Utensils size={19} /></span>
          <div><h2>Изменение плана питания</h2><p>Новые дневные цели применятся у клиента сразу после сохранения.</p></div>
        </div>
        <div className="trainerNutritionPlanFields">
          <label className="trainerNutritionPreset">
            <span>Готовый вариант</span>
            <select aria-label="Готовый вариант плана питания" value={preset} onChange={(event) => selectPreset(event.target.value)}>
              <option value="custom">Индивидуальные значения</option>
              {presetOptions.map((item) => (
                <option key={item.id} value={normalizeNutritionPresetId(item.id)}>{item.name} · {item.calories} ккал · Б {item.protein} · Ж {item.fat} · У {item.carbs}</option>
              ))}
            </select>
          </label>
          <label className={!isIndividualPreset ? "trainerNutritionLockedField" : ""}>
            <span>Название плана</span>
            <input
              value={draft.name}
              disabled={!isIndividualPreset}
              aria-describedby={!isIndividualPreset ? "trainer-nutrition-preset-mode" : undefined}
              onChange={(event) => { setPreparedAiPlan(null); setAiStatus(""); setDraft((current) => ({ ...current, name: event.target.value, presetId: "custom" })); }}
            />
          </label>
          <label><span>Цель клиента</span><input value={draft.goal} placeholder="Например, рекомпозиция" onChange={(event) => { setPreparedAiPlan(null); setAiStatus(""); setDraft((current) => ({ ...current, goal: event.target.value })); }} /></label>
        </div>
        <p id="trainer-nutrition-preset-mode" className={`trainerNutritionPresetMode${isIndividualPreset ? " isIndividual" : ""}`} role="status">
          {isIndividualPreset
            ? "Индивидуальный режим: можно изменить название и дневные цели."
            : "Готовый вариант: название и дневные цели берутся из шаблона и не редактируются."}
        </p>
        <div className="trainerNutritionGoalInputs">
          {[
            ["calories", "Калории", "ккал"],
            ["protein", "Белки", "г"],
            ["fat", "Жиры", "г"],
            ["carbs", "Углеводы", "г"]
          ].map(([key, label, unit]) => (
            <label key={key} className={!isIndividualPreset ? "trainerNutritionLockedField" : ""}>
              <span>{label}</span>
              <div>
                <input
                  type="number"
                  min="0"
                  value={draft[key]}
                  disabled={!isIndividualPreset}
                  aria-describedby={!isIndividualPreset ? "trainer-nutrition-preset-mode" : undefined}
                  onChange={(event) => { setPreparedAiPlan(null); setAiStatus(""); setDraft((current) => ({ ...current, [key]: event.target.value, presetId: "custom" })); }}
                />
                <small>{unit}</small>
              </div>
            </label>
          ))}
        </div>
        <div className="trainerNutritionValidity">
          <label><span>Действует с</span><input type="date" value={draft.validFrom} onChange={(event) => setDraft((current) => ({ ...current, validFrom: event.target.value }))} /></label>
          <label><span>Действует по</span><input type="date" min={draft.validFrom || undefined} value={draft.validTo} onChange={(event) => setDraft((current) => ({ ...current, validTo: event.target.value }))} /></label>
          <small>Период необязателен. Без дат план действует до следующего изменения.</small>
        </div>
        {aiStatus ? <p className="trainerNextProgramStatus" role="status">{aiStatus}</p> : null}
        {status && status !== aiStatus ? <p className="trainerNextProgramStatus">{status}</p> : null}
      </section>
      </div>
      <footer className="trainerNutritionPlanActions" data-trainer-modal-footer="true">
        <button className="trainerNextPrimary" type="button" disabled={saving || saveSuccess} onClick={savePlan}><Save size={17} />{saving ? "Сохранение..." : saveSuccess ? "План сохранён" : "Сохранить"}</button>
        <button type="button" onClick={closePlanEditor} disabled={saving || saveSuccess}>Отмена</button>
        <button type="button" onClick={prepareAiPlan} disabled={saving || saveSuccess}><Sparkles size={17} />Сформировать индивидуальный AI-план</button>
      </footer>
      </section>
      {saveSuccess ? (
        <SaveSuccessNotice
          title="План питания сохранён"
          description="Новые цели питания уже применены у клиента."
          onComplete={() => {
            setSaveSuccess(false);
            setEditing(false);
          }}
        />
      ) : null}
      </div>
      ) : null}
    </div>
  );
}

function NutritionView({ client, profile = {}, history = [], nutritionDays, goals = {}, planOptions = [], onGeneratePlan, onSavePlan, status, onOpenDiary, onRetryData }) {
  const familiar = isTrainerV2Path(window.location.pathname);
  const target = {
    calories: Number(goals.calories) || (familiar ? 0 : 2000),
    protein: Number(goals.protein) || (familiar ? 0 : 150),
    fat: Number(goals.fat) || (familiar ? 0 : 50),
    carbs: Number(goals.carbs) || (familiar ? 0 : 200)
  };
  return (
    <div className="trainerNextNutrition trainerNextNutritionUnified trainerClientTabContent">
      <section id="trainerNutritionAnalytics" className="trainerNutritionUnifiedSection">
        <div className="trainerClientBlockHeading">
          <span><BarChart3 size={19} /></span>
          <div><h2>Аналитика питания</h2><p>Средние значения считаются по завершённым дням без сегодняшнего дня.</p></div>
        </div>
        {isTrainerV2Path(window.location.pathname) && client?.trainerNutritionLoadError ? <section className="trainerNextSimplePanel" role="alert"><h3>Не удалось загрузить дневник</h3><p>Не делайте выводов об отсутствии записей. Обновите данные клиента.</p>{onRetryData ? <button type="button" className="trainerNextPrimary" onClick={onRetryData}>Повторить загрузку</button> : null}</section> : <NutritionAnalytics nutritionDays={nutritionDays} target={target} onOpenDiary={onOpenDiary} />}
      </section>

      <section id="trainerNutritionPlan" className="trainerNutritionUnifiedSection">
        <NutritionPlan
          key={[
            client?.id || "nutrition-plan",
            client?.nutritionPlan?.updatedAt || "",
            client?.nutritionPlan?.presetId || client?.nutritionPlan?.preset || "",
            client?.nutritionPlan?.calories || goals.calories || "",
            client?.nutritionPlan?.protein || goals.protein || "",
            client?.nutritionPlan?.fat || goals.fat || "",
            client?.nutritionPlan?.carbs || goals.carbs || ""
          ].join("::")}
          client={client}
          profile={profile}
          history={history}
          nutritionDays={nutritionDays}
          goals={goals}
          planOptions={planOptions}
          onSavePlan={onSavePlan}
          onGeneratePlan={onGeneratePlan}
          status={status}
        />
      </section>
      {!isTrainerV2Path(window.location.pathname) ? <ClientSectionLaunchButton
        icon={Eye}
        title="Открыть дневник питания"
        description="Все записи клиента по дням и приёмам пищи"
        onClick={onOpenDiary}
      /> : null}
    </div>
  );
}

function TrainerNutritionPage({ client, profile = {}, history = [], nutritionDays, goals, planOptions = [], onGeneratePlan, onSavePlan, status }) {
  return (
    <div className="trainerNextPage trainerNextNutritionPage">
      <div className="trainerNextDesktopPageHead">
        <div><h1>Питание клиента</h1><p>{client ? `Клиент: ${client.name || client.email}` : "Выберите клиента"}</p></div>
        <button className="trainerNextPrimary" type="button">Отправить план клиенту <ChevronDown size={16} /></button>
      </div>
      <header className="trainerNextMobileHeader">
        <div className="trainerNextMobileTitle">Питание и дневник</div>
        <button type="button" aria-label="Календарь"><CalendarDays size={21} /></button>
      </header>
      <NutritionView client={client} profile={profile} history={history} nutritionDays={nutritionDays} goals={goals} planOptions={planOptions} onGeneratePlan={onGeneratePlan} onSavePlan={onSavePlan} status={status} />
    </div>
  );
}

function ClientNotifications({
  client,
  workouts,
  history = [],
  measurements = [],
  photos = [],
  status,
  onSave,
  onTest,
  onConnectTelegram,
  onSaveSubscription,
  onSubscriptionSaved,
  startSubscriptionEditing = false,
  mode = "calendar"
}) {
  const showCalendar = true;
  const showNotificationSettings = mode === "notifications";
  const calendar = client?.workoutCalendar || {};
  const scheduleCalendar = useMemo(
    () => getTrainerWorkoutScheduleCalendar(client, workouts),
    [client, workouts]
  );
  const subscriptionRange = useMemo(
    () => {
      const timeline = buildTrainerClientProgramTimeline({
        workouts: (Array.isArray(workouts) ? workouts : []).filter((workout) => !isTrainerClientBasicWorkout(workout)),
        history,
        clientProfile: client
      });
      const assignment = timeline.find((item) => item.status === "current") ||
        timeline.find((item) => item.status === "future") ||
        timeline.filter((item) => item.status === "past").at(-1);
      return getSubscriptionScheduleRange({ workouts: assignment?.workouts || [], calendar: client?.workoutCalendar || {} });
    },
    [workouts, history, client]
  );
  const subscription = client?.subscription || {};
  const telegram = client?.telegram || {};
  const connected = Boolean(telegram.connected || client?.telegramConnected || telegram.telegramUserId || client?.telegramUserId);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState("idle");
  const section = showNotificationSettings ? "notifications" : "subscription";
  const [subscriptionDraft, setSubscriptionDraft] = useState(() => getSubscriptionSessionDraft(subscription));
  const [editingSubscription, setEditingSubscription] = useState(() => startSubscriptionEditing || (subscription.purchasedSessions === undefined && subscription.totalSessions === undefined));
  const subscriptionStatus = getSubscriptionStatus({ ...subscription, ...subscriptionDraft }, new Date());
  const saveQueueRef = useRef(Promise.resolve());
  const onSaveRef = useRef(onSave);
  const progressReminderSettings = calendar.progressReminderSettings || client?.progressReminderSettings || {};
  const initialScheduledDates = Array.isArray(scheduleCalendar.scheduledDates)
    ? scheduleCalendar.scheduledDates
    : Array.isArray(scheduleCalendar.monthlyTrainingDates)
      ? scheduleCalendar.monthlyTrainingDates
      : [];
  const historyWorkoutDates = useMemo(
    () => (Array.isArray(history) ? history : [])
      .map((item) => toWorkoutDateKey(item?.date || item?.completedAt || item?.finishedAt || item?.createdAt))
      .filter(Boolean),
    [history]
  );
  const scheduleSlots = useMemo(
    () => buildPlannedWorkoutSlots({
      workouts,
      calendar: scheduleCalendar,
      history
    }),
    [history, scheduleCalendar, workouts]
  );
  const todayKey = toWorkoutDateKey(new Date());
  const workoutProgramFinished = Boolean(
    workouts.length &&
    scheduleSlots.some((slot) => Boolean(slot.plannedDate)) &&
    !scheduleSlots.some((slot) => slot.status === "planned" && slot.plannedDate >= todayKey)
  );
  const plannedWorkoutDates = useMemo(
    () => new Set(scheduleSlots
      .filter((slot) => slot.status === "planned" && slot.plannedDate)
      .map((slot) => slot.plannedDate)),
    [scheduleSlots]
  );
  const completedWorkoutDates = useMemo(
    () => new Set(historyWorkoutDates),
    [historyWorkoutDates]
  );
  const completedWorkoutOrdersByDate = useMemo(() => {
    const result = new Map();
    buildWorkoutScheduleCalendarEntries(scheduleSlots)
      .filter((entry) => entry.status === "completed" || entry.status === "completed_off_date")
      .forEach((entry) => {
        if (!entry?.date) return;
        const current = result.get(entry.date) || [];
        result.set(entry.date, [...current, entry.order]);
      });
    return result;
  }, [scheduleSlots]);
  const subscriptionScheduleEntriesByDate = useMemo(() => {
    const entriesByDate = new Map();
    const currentAssignmentVersion = String(
      scheduleCalendar?.assignedProgramUpdatedAt ||
      scheduleSlots.find((slot) => slot?.assignedProgramUpdatedAt)?.assignedProgramUpdatedAt ||
      ""
    ).trim();
    const currentWorkoutIds = new Set(scheduleSlots
      .map((slot) => getTrainerWorkoutKey(slot?.workoutId))
      .filter(Boolean));
    const currentWorkoutNames = new Set(scheduleSlots
      .map((slot) => getTrainerWorkoutKey(slot?.workoutName))
      .filter(Boolean));
    const addEntry = (entry) => {
      if (!entry?.date) return;
      const entries = entriesByDate.get(entry.date) || [];
      entries.push(entry);
      entriesByDate.set(entry.date, entries);
    };

    // These entries carry the exact plan outcome: planned, on time, completed
    // on another date, missed, or shifted. The subscription calendar is
    // read-only, so it must display the saved schedule rather than recalculate
    // it from generic history dates.
    buildWorkoutScheduleCalendarEntries(scheduleSlots).forEach(addEntry);

    // Keep older-program sessions visible, but never let an old history row
    // obscure the state of a workout belonging to the current program.
    (Array.isArray(history) ? history : []).forEach((item, index) => {
      const date = toWorkoutDateKey(item?.date || item?.completedAt || item?.finishedAt || item?.createdAt);
      const workoutId = getTrainerWorkoutKey(item?.workoutId);
      const workoutName = getTrainerWorkoutKey(item?.workoutName || item?.workout || item?.name);
      const historyAssignmentVersion = String(item?.assignedProgramUpdatedAt || item?.assignmentVersion || "").trim();
      const belongsToOlderAssignment = Boolean(
        currentAssignmentVersion &&
        historyAssignmentVersion &&
        historyAssignmentVersion !== currentAssignmentVersion
      );
      const belongsToCurrentWorkout = currentWorkoutIds.has(workoutId) || currentWorkoutNames.has(workoutName);
      if (!date || (!belongsToOlderAssignment && belongsToCurrentWorkout)) return;

      addEntry({
        id: `past-${workoutId || workoutName || index}-${date}`,
        date,
        order: index + 1,
        workoutId,
        status: "pastCompleted",
        pastCompleted: true,
        title: item?.workoutName || item?.workout || item?.name || "Прошлая тренировка"
      });
    });

    return entriesByDate;
  }, [history, scheduleCalendar, scheduleSlots]);
  const [draft, setDraft] = useState({
    enabled: calendar.reminderEnabled !== false && client?.telegramNotificationsEnabled !== false,
    offsets: Array.isArray(calendar.reminderOffsetsHours) && calendar.reminderOffsetsHours.length
      ? calendar.reminderOffsetsHours.map(Number)
      : [24],
    scheduledDates: initialScheduledDates,
    progressPhotoEnabled: progressReminderSettings.photoEnabled === true || calendar.progressPhotoReminderEnabled === true,
    measurementsEnabled: progressReminderSettings.measurementsEnabled === true || calendar.measurementsReminderEnabled === true,
    photoIntervalDays: Number(
      progressReminderSettings.photoIntervalDays ||
      calendar.progressPhotoReminderIntervalDays ||
      progressReminderSettings.intervalDays ||
      calendar.progressReminderIntervalDays ||
      14
    ),
    measurementsIntervalDays: Number(
      progressReminderSettings.measurementsIntervalDays ||
      calendar.measurementsReminderIntervalDays ||
      progressReminderSettings.intervalDays ||
      calendar.progressReminderIntervalDays ||
      14
    )
  });
  const [calendarMonth, setCalendarMonth] = useState(() => getLocalDateKey().slice(0, 7));
  const notificationSettings = useMemo(() => ({
    enabled: draft.enabled,
    offsets: draft.offsets,
    scheduledDates: draft.scheduledDates,
    progressPhotoEnabled: draft.progressPhotoEnabled,
    measurementsEnabled: draft.measurementsEnabled,
    progressPhotoIntervalDays: draft.photoIntervalDays,
    measurementsIntervalDays: draft.measurementsIntervalDays
  }), [draft]);
  const notificationSettingsKey = useMemo(() => JSON.stringify(notificationSettings), [notificationSettings]);
  const initialNotificationSettingsKeyRef = useRef(notificationSettingsKey);
  const progressReminderPeriodOptions = [7, 14, 30];
  const calendarDays = getCalendarMonthDays(calendarMonth);
  const calendarStartKey = calendarDays[0]?.key || getLocalDateKey();
  const calendarEndKey = calendarDays[calendarDays.length - 1]?.key || calendarStartKey;

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  function queueSettingsSave(settings) {
    if (!settings.offsets.length) {
      setAutoSaveState("needs_offset");
      return Promise.resolve(false);
    }

    const queuedSave = saveQueueRef.current
      .catch(() => false)
      .then(async () => {
        setSaving(true);
        setAutoSaveState("saving");
        try {
          const saved = await onSaveRef.current?.(settings);
          setAutoSaveState(saved === false ? "error" : "saved");
          return saved !== false;
        } catch (error) {
          console.error("Unable to auto-save notification settings:", error);
          setAutoSaveState("error");
          return false;
        } finally {
          setSaving(false);
        }
      });

    saveQueueRef.current = queuedSave;
    return queuedSave;
  }

  useEffect(() => {
    if (notificationSettingsKey === initialNotificationSettingsKeyRef.current) return undefined;

    setAutoSaveState(notificationSettings.offsets.length ? "pending" : "needs_offset");
    const saveTimer = window.setTimeout(() => {
      initialNotificationSettingsKeyRef.current = notificationSettingsKey;
      void queueSettingsSave(notificationSettings);
    }, 450);

    return () => window.clearTimeout(saveTimer);
  }, [notificationSettings, notificationSettingsKey]);

  function toReminderDateKey(value) {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? getLocalDateKey(new Date(timestamp)) : "";
  }

  function addReminderDays(dateKey, days) {
    const [year, month, day] = String(dateKey).split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return "";
    const date = new Date(year, month - 1, day + days);
    return getLocalDateKey(date);
  }

  function getLatestReminderDateKey(items = [], fields = ["date", "createdAt"]) {
    return (Array.isArray(items) ? items : [])
      .map((item) => fields.map((field) => toReminderDateKey(item?.[field])).find(Boolean))
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  }

  function buildProgressReminderDates(enabled, lastDateKey, intervalDays) {
    if (!enabled) return new Set();
    const interval = [7, 14, 30].includes(Number(intervalDays)) ? Number(intervalDays) : 14;
    const todayKey = getLocalDateKey();
    const baseDateKey = lastDateKey ||
      toReminderDateKey(progressReminderSettings.updatedAt) ||
      toReminderDateKey(calendar.updatedAt) ||
      todayKey;
    let reminderDateKey = addReminderDays(baseDateKey, interval);
    const minDateKey = [todayKey, calendarStartKey].sort().at(-1);

    while (reminderDateKey && reminderDateKey < minDateKey) {
      reminderDateKey = addReminderDays(reminderDateKey, interval);
    }

    const dates = new Set();
    while (reminderDateKey && reminderDateKey <= calendarEndKey) {
      dates.add(reminderDateKey);
      reminderDateKey = addReminderDays(reminderDateKey, interval);
    }
    return dates;
  }

  const latestPhotoDateKey = getLatestReminderDateKey(photos, ["date", "createdAt"]);
  const latestMeasurementDateKey = getLatestReminderDateKey(measurements, ["date", "createdAt", "savedAt"]);
  const photoReminderDates = buildProgressReminderDates(draft.progressPhotoEnabled, latestPhotoDateKey, draft.photoIntervalDays);
  const measurementReminderDates = buildProgressReminderDates(draft.measurementsEnabled, latestMeasurementDateKey, draft.measurementsIntervalDays);
  const notificationEventCount = new Set([
    ...plannedWorkoutDates,
    ...completedWorkoutDates,
    ...photoReminderDates,
    ...measurementReminderDates
  ]).size;

  function toggleOffset(hours) {
    setDraft((current) => ({
      ...current,
      offsets: current.offsets.includes(hours)
        ? current.offsets.filter((value) => value !== hours)
        : [...current.offsets, hours].sort((a, b) => b - a)
    }));
  }

  function shiftCalendarMonth(delta) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setCalendarMonth(getLocalDateKey(next).slice(0, 7));
  }

  async function saveSettings() {
    initialNotificationSettingsKeyRef.current = notificationSettingsKey;
    await queueSettingsSave(notificationSettings);
  }

  async function testNotification() {
    setTesting(true);
    await onTest?.();
    setTesting(false);
  }

  function renderCalendarDays(className = "trainerNotificationCalendarGrid") {
    return (
      <div className={className}>
        {calendarDays.map((day, dayIndex) => {
          // The subscription calendar is also a read-only schedule: trainers
          // need to see both upcoming sessions and the completed history there.
          const plannedWorkout = plannedWorkoutDates.has(day.key);
          const completedWorkout = completedWorkoutDates.has(day.key);
          const subscriptionScheduleEntries = section === "subscription"
            ? subscriptionScheduleEntriesByDate.get(day.key) || []
            : [];
          const subscriptionWorkoutStatus = getWorkoutScheduleCalendarStatus(subscriptionScheduleEntries);
          const subscriptionWorkoutClass = subscriptionWorkoutStatus === "planned"
            ? "plannedWorkout"
            : subscriptionWorkoutStatus === "pastCompleted"
              ? "pastWorkout"
              : subscriptionWorkoutStatus;
          const hasSubscriptionWorkout = subscriptionScheduleEntries.length > 0;
          const today = day.key === getLocalDateKey();
          const photoReminder = section === "notifications" && photoReminderDates.has(day.key);
          const measurementReminder = section === "notifications" && measurementReminderDates.has(day.key);
          const subscriptionStart = section === "subscription" && day.key === subscriptionRange.startDate;
          const subscriptionEnd = section === "subscription" && day.key === subscriptionRange.endDate;
          const completedOrders = completedWorkoutOrdersByDate.get(day.key) || [];
          const labels = [
            ...(section === "subscription"
              ? subscriptionScheduleEntries.map((entry) => `тренировка №${entry.order}: ${WORKOUT_SCHEDULE_DAY_STATUS_TEXT[entry.status] || entry.title || ""}`)
              : [
                plannedWorkout ? "плановая тренировка" : "",
                completedWorkout ? "фактическое выполнение" : ""
              ]),
            subscriptionStart ? "начало абонемента" : "",
            subscriptionEnd ? "окончание абонемента" : "",
            photoReminder ? "фото прогресса" : "",
            measurementReminder ? "замеры тела" : ""
          ].filter(Boolean);
          return (
            <button
              type="button"
              key={day.key}
              className={[
                section === "subscription" ? subscriptionWorkoutClass : plannedWorkout ? "plannedWorkout" : "",
                section === "subscription" ? "" : completedWorkout ? "pastWorkout" : "",
                subscriptionStart || subscriptionEnd ? subscriptionCalendarStyles.boundary : "",
                day.currentMonth ? "" : "muted",
                today ? "today" : "",
                photoReminder ? "photoReminder" : "",
                measurementReminder ? "measurementReminder" : ""
              ].filter(Boolean).join(" ")}
              data-date={day.key}
              {...(section === "subscription" ? getSubscriptionRangeDayProps(day.key, dayIndex, subscriptionRange) : {})}
              disabled
              aria-label={labels.length ? `${day.key}: ${labels.join(", ")}` : day.key}
            >
              <b className="trainerSubscriptionCalendarDayLabel">
                {day.label}
              </b>
              {section === "subscription" && hasSubscriptionWorkout ? (
                <span className="trainerNotificationDayBadges">
                  {subscriptionScheduleEntries.slice(0, 3).map((entry) => {
                    const entryClass = entry.status === "completed_off_date"
                      ? "completedOffDate"
                      : entry.status === "pastCompleted"
                        ? "pastWorkout"
                        : entry.status;
                    return (
                      <i className={entryClass} key={entry.id} title={entry.title}>
                        {isTrainerV2Path(window.location.pathname) ? `${({ completed: "✓", completed_off_date: "↗", missed: "!", shifted: "↪", pastCompleted: "✓", planned: "○" })[entry.status] || "○"} №${entry.order}` : entry.status === "pastCompleted" ? "✓" : `№${entry.order}`}
                      </i>
                    );
                  })}
                </span>
              ) : labels.length ? (
                <span className="trainerNotificationDayBadges">
                  {plannedWorkout ? <i className="workout">Т</i> : null}
                  {completedWorkout ? <i className="pastWorkout">{completedOrders.length ? `№${completedOrders.join(", №")}` : "✓"}</i> : null}
                  {photoReminder ? <i className="photo">Ф</i> : null}
                  {measurementReminder ? <i className="measurement">З</i> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  const notificationCalendarLegend = (
    <div className="trainerNotificationLegend" aria-label="Типы напоминаний">
      <span><i aria-hidden="true" className="subscription">{isTrainerV2Path(window.location.pathname) ? "―" : ""}</i>Период абонемента</span>
      <span><i aria-hidden="true" className="plannedWorkout">{isTrainerV2Path(window.location.pathname) ? "○" : ""}</i>Плановая тренировка</span>
      <span><i aria-hidden="true" className="pastWorkout">{isTrainerV2Path(window.location.pathname) ? "✓" : ""}</i>Прошлая тренировка</span>
      <span><i aria-hidden="true" className="photo">{isTrainerV2Path(window.location.pathname) ? "Ф" : ""}</i>Фото</span>
      <span><i aria-hidden="true" className="measurement">{isTrainerV2Path(window.location.pathname) ? "З" : ""}</i>Замеры</span>
    </div>
  );

  const calendarEditor = (
    <section data-testid="trainer-subscription-calendar" className={`trainerNotificationCalendar trainerClientCalendarPanel ${workspaceFeatureStyles.notificationCalendar} ${subscriptionCalendarStyles.calendar} ${section === "subscription" ? "trainerCalendarModeSubscription trainerSubscriptionCalendarUnified trainerNotificationCalendarUnified" : "trainerCalendarModeNotifications"} ${showNotificationSettings || section === "subscription" ? "trainerWorkoutSchedulePlanner" : ""} ${editingSubscription ? "editing" : ""}`}>
      {showNotificationSettings ? (
        <>
          <header className={subscriptionCalendarStyles.header}>
            <div>
              <span>КАЛЕНДАРЬ УВЕДОМЛЕНИЙ</span>
              <h3>Даты тренировок и напоминаний</h3>
              <p>Плановые и выполненные тренировки, а также напоминания о фото и замерах.</p>
            </div>
                <strong className={notificationEventCount ? "ready" : ""}>
                  <b>{notificationEventCount}</b>
                  <small>событий</small>
                </strong>
          </header>
          <div className="trainerWorkoutScheduleBody">
            <div className="trainerWorkoutScheduleCalendar trainerNotificationCalendarSurface">
              <div className="trainerWorkoutScheduleMonth">
                <button type="button" onClick={() => shiftCalendarMonth(-1)} aria-label="Предыдущий месяц"><ChevronUp size={15} /></button>
                <strong>{new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
                <button type="button" onClick={() => shiftCalendarMonth(1)} aria-label="Следующий месяц"><ChevronDown size={15} /></button>
              </div>
              <div className="trainerNotificationWeekdays trainerWorkoutScheduleWeekdays">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}
              </div>
              {renderCalendarDays("trainerNotificationCalendarGrid trainerWorkoutScheduleGrid")}
              {notificationCalendarLegend}
            </div>
          </div>
        </>
      ) : (
        <>
          <header className={subscriptionCalendarStyles.header}>
            <div>
              <span>{workoutProgramFinished ? "ПЛАН ТРЕНИРОВОК" : "АБОНЕМЕНТ"}</span>
              <h3>{workoutProgramFinished ? "Программа тренировок завершена" : "Расписание клиента"}</h3>
              <p>{workoutProgramFinished ? "В текущем плане больше нет предстоящих тренировок. " : ""}Период абонемента выделен автоматически по расписанию. Баланс занятий задаётся отдельно.</p>
            </div>
            <strong className={workoutProgramFinished ? "warning" : subscriptionStatus.tone}>
              {workoutProgramFinished ? "План завершён" : subscriptionStatus.label}
              <small>{workoutProgramFinished ? `абонемент ${subscriptionStatus.label.toLowerCase()}` : "абонемент"}</small>
            </strong>
          </header>
          <div className="trainerWorkoutScheduleBody">
            <div className="trainerWorkoutScheduleCalendar trainerSubscriptionCalendarSurface">
              <div className="trainerWorkoutScheduleMonth">
                <button type="button" onClick={() => shiftCalendarMonth(-1)} aria-label="Предыдущий месяц"><ChevronUp size={15} /></button>
                <strong>{new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
                <button type="button" onClick={() => shiftCalendarMonth(1)} aria-label="Следующий месяц"><ChevronDown size={15} /></button>
              </div>
              <div className="trainerNotificationWeekdays trainerWorkoutScheduleWeekdays">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}
              </div>
              {renderCalendarDays("trainerNotificationCalendarGrid trainerWorkoutScheduleGrid")}
              <div className="trainerNotificationLegend" aria-label="Типы календарных отметок">
                <span><i aria-hidden="true" className="subscription">{isTrainerV2Path(window.location.pathname) ? "―" : ""}</i>Период абонемента</span>
                <span><i aria-hidden="true" className="plannedWorkout">{isTrainerV2Path(window.location.pathname) ? "○" : ""}</i>Плановая тренировка</span>
                <span><i aria-hidden="true" className="completed">{isTrainerV2Path(window.location.pathname) ? "✓" : ""}</i>В срок</span>
                <span><i aria-hidden="true" className="completedOffDate">{isTrainerV2Path(window.location.pathname) ? "↗" : ""}</i>Выполнено в другой день</span>
                <span><i aria-hidden="true" className="missed">{isTrainerV2Path(window.location.pathname) ? "!" : ""}</i>Пропущена</span>
                <span><i aria-hidden="true" className="shifted">{isTrainerV2Path(window.location.pathname) ? "↪" : ""}</i>Смещена</span>
                <span><i aria-hidden="true" className="pastWorkout">{isTrainerV2Path(window.location.pathname) ? "✓" : ""}</i>Прошлая тренировка</span>
              </div>
            </div>
          </div>
        </>
      )}
      <small className={subscriptionCalendarStyles.period}>{section === "subscription"
        ? subscriptionRange.startDate
          ? `Период по расписанию: ${formatSubscriptionDate(subscriptionRange.startDate)} — ${formatSubscriptionDate(subscriptionRange.endDate)}.`
          : "Период появится автоматически после назначения дат тренировок."
        : "В календаре отмечены тренировки и ближайшие напоминания клиента."}</small>
      {section === "subscription" ? (
        <ClientCalendarSubscriptionFields
          client={client}
          draft={subscriptionDraft}
          onChange={setSubscriptionDraft}
          onSave={onSaveSubscription}
          editing={editingSubscription}
          onEdit={() => setEditingSubscription(true)}
          onCancel={() => {
            setSubscriptionDraft(getSubscriptionSessionDraft(subscription));
            setEditingSubscription(false);
          }}
          onSaved={async () => {
            setEditingSubscription(false);
            await onSubscriptionSaved?.();
          }}
        />
      ) : null}
    </section>
  );

  return (
    <div className={`trainerClientNotifications ${mobileStyles.notificationRoot}`}>
      {showCalendar && !showNotificationSettings ? calendarEditor : null}

      {showNotificationSettings ? (
        <>
      <div className="trainerNotificationSaveStatus" data-testid="trainer-notification-save-status" data-save-state={autoSaveState}>
        <span role="status" aria-live="polite">{autoSaveState === "saving" ? "Сохраняем изменения…"
          : autoSaveState === "pending" ? "Изменения сохранятся автоматически…"
            : autoSaveState === "saved" ? "Все изменения сохранены"
              : autoSaveState === "error" ? "Не удалось сохранить изменения"
                : autoSaveState === "needs_offset" ? "Выберите хотя бы один интервал напоминания"
                  : "Изменения сохраняются автоматически"}</span>
        {autoSaveState === "error" ? <button type="button" onClick={saveSettings} disabled={saving}>Повторить</button> : null}
      </div>
      <section className="trainerNotificationStatusCard">
        <div className={`trainerNotificationIcon ${connected ? "connected" : ""}`}><Bell size={22} /></div>
        <div>
          <span>TELEGRAM</span>
          <h2>{connected ? "Telegram подключён" : "Telegram не подключён"}</h2>
          <p>{connected ? `Напоминания будут отправляться ${telegram.username || client?.telegramUsername ? `пользователю @${telegram.username || client.telegramUsername}` : "в привязанный аккаунт"}.` : "Клиенту нужно открыть бота и привязать свой аккаунт."}</p>
        </div>
        <i className={connected ? "connected" : ""}>{connected ? "Подключён" : "Не подключён"}</i>
                {!connected ? (
                  <button
                    type="button"
                    className="trainerNotificationTelegramConnect"
                    onClick={onConnectTelegram}
                  >
                    Подключить Telegram
                  </button>
                ) : null}
      </section>

      <section className={`trainerNotificationSettings ${workspaceFeatureStyles.notificationPanel}`}>
        <header>
          <div><span>УВЕДОМЛЕНИЯ</span><h2>Напоминания</h2><p>Настройте автоматические уведомления для клиента.</p></div>
        </header>

        <div className={`trainerReminderCard ${workspaceFeatureStyles.reminderCard}`}>
          <div className="trainerReminderCardHead">
            <span className="trainerReminderIcon"><Bell size={20} /></span>
            <div>
              <strong>Напоминания о тренировках</strong>
              <p>Отправлять клиенту напоминания о запланированных тренировках</p>
            </div>
            <label className="trainerNotificationSwitch compact">
              <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
              <i />
            </label>
          </div>

          <div className="trainerNotificationOffsets">
            <div>
              {[24, 12, 3, 1].map((hours) => (
                <label className={draft.offsets.includes(hours) ? "active" : ""} key={hours}>
                  <input type="checkbox" checked={draft.offsets.includes(hours)} onChange={() => toggleOffset(hours)} />
                  <span><Check size={15} /></span>
                  <b>За {hours} {hours === 1 ? "час" : [3, 24].includes(hours) ? "часа" : "часов"}</b>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={`trainerReminderCard ${workspaceFeatureStyles.reminderCard}`}>
          <div className="trainerReminderCardHead">
            <span className="trainerReminderIcon"><Camera size={20} /></span>
            <div>
              <strong>Напоминание о фото прогресса</strong>
              <p>Напоминать клиенту о фото прогресса с определенной периодичностью</p>
            </div>
            <label className="trainerNotificationSwitch compact">
              <input
                type="checkbox"
                checked={draft.progressPhotoEnabled}
                onChange={(event) => setDraft((current) => ({ ...current, progressPhotoEnabled: event.target.checked }))}
              />
              <i />
            </label>
          </div>
          <div className="trainerReminderPeriod">
            <div>
              {progressReminderPeriodOptions.map((days) => (
                <button
                  type="button"
                  className={draft.photoIntervalDays === days ? "active" : ""}
                  aria-pressed={draft.photoIntervalDays === days}
                  key={days}
                  onClick={() => setDraft((current) => ({ ...current, photoIntervalDays: days }))}
                >
                  Каждые {days} дней
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`trainerReminderCard ${workspaceFeatureStyles.reminderCard}`}>
          <div className="trainerReminderCardHead">
            <span className="trainerReminderIcon"><Ruler size={20} /></span>
            <div>
              <strong>Напоминание о замерах тела</strong>
              <p>Напоминать клиенту о замерах тела с определенной периодичностью</p>
            </div>
            <label className="trainerNotificationSwitch compact">
              <input
                type="checkbox"
                checked={draft.measurementsEnabled}
                onChange={(event) => setDraft((current) => ({ ...current, measurementsEnabled: event.target.checked }))}
              />
              <i />
            </label>
          </div>
          <div className="trainerReminderPeriod">
            <div>
              {progressReminderPeriodOptions.map((days) => (
                <button
                  type="button"
                  className={draft.measurementsIntervalDays === days ? "active" : ""}
                  aria-pressed={draft.measurementsIntervalDays === days}
                  key={days}
                  onClick={() => setDraft((current) => ({ ...current, measurementsIntervalDays: days }))}
                >
                  Каждые {days} дней
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`trainerNotificationActions ${workspaceFeatureStyles.notificationActions}`}>
          <button className="trainerNextPrimary" type="button" disabled={saving || !draft.offsets.length} onClick={saveSettings}>{autoSaveState === "saved" ? <Check size={17} /> : <Save size={17} />}{saving ? "Сохранение..." : autoSaveState === "saved" ? "Сохранено" : "Сохранить настройки"}</button>
          <button type="button" disabled={!connected || testing} onClick={testNotification}><Mail size={17} />{testing ? "Отправка..." : "Отправить тестовое уведомление"}</button>
        </div>
        {status ? <p className="trainerNextProgramStatus">{status}</p> : null}
      </section>
        </>
      ) : null}
      {showCalendar && showNotificationSettings ? calendarEditor : null}
    </div>
  );
}

function ClientWorkSummary({
  client,
  workouts = [],
  history = [],
  snapshot,
  workoutReview,
  measurements = [],
  nutritionDays = [],
  nutritionGoals = {},
  onTabChange
}) {
  const sortedMeasurements = (Array.isArray(measurements) ? measurements : [])
    .slice()
    .sort((first, second) => (getMeasurementDate(second)?.getTime() || 0) - (getMeasurementDate(first)?.getTime() || 0));
  const latestMeasurement = sortedMeasurements[0] || null;
  const latestMeasurementValues = latestMeasurement?.values && typeof latestMeasurement.values === "object"
    ? Object.values(latestMeasurement.values)
    : [];
  const updatedMeasurementCount = latestMeasurementValues.filter((value) => Number.isFinite(Number(value))).length;
  const nutrition = buildTrainerClientProgressDashboard({
    nutritionDays,
    nutritionGoals,
    days: 180
  }).nutrition;
  const workoutCompletion = (snapshot?.assignedWorkoutCount || workouts.length)
    ? `${snapshot?.completedWorkoutCount ?? buildPlannedWorkoutSlots({ workouts, history }).filter(slot => slot.isCompleted).length} из ${snapshot?.assignedWorkoutCount || workouts.length}`
    : "нет программы";
  const reviewSets = workoutReview?.plannedSetsCount
    ? `${workoutReview.completedSetsCount || 0} из ${workoutReview.plannedSetsCount} подходов`
    : `${workoutReview?.completedSetsCount || 0} подходов`;
  const cards = [
    {
      id: "workout",
      target: "workouts",
      icon: CalendarDays,
      label: "Последняя тренировка",
      value: snapshot?.lastWorkoutAt ? formatCompactDate(snapshot.lastWorkoutAt) : "Нет данных",
      detail: workoutReview?.workoutId
        ? `${workoutReview.completedExercisesCount || 0} упр. · ${reviewSets} · ${workoutReview.volumeKg || 0} кг`
        : `Программа: ${workoutCompletion}`
    },
    {
      id: "measurements",
      target: "bodyProgress",
      icon: Ruler,
      label: "Последние замеры",
      value: latestMeasurement ? formatCompactDate(getMeasurementDate(latestMeasurement)) : "Нет данных",
      detail: latestMeasurement
        ? updatedMeasurementCount
          ? `Обновлено показателей: ${updatedMeasurementCount}`
          : "Добавлена запись замеров"
        : "Клиент ещё не добавлял замеры"
    },
    {
      id: "nutrition",
      target: "nutrition",
      icon: Utensils,
      label: "Питание",
      value: Number.isFinite(nutrition.current) ? `${roundTrainerNumber(nutrition.current, 0)}%` : "—",
      detail: nutrition.trackedDays
        ? `${nutrition.trackedDays} из ${nutrition.periodDays} завершённых дней`
        : "Нет завершённых записей"
    }
  ];

  if (isTrainerV2Path(window.location.pathname)) {
    const timeline = buildTrainerClientProgramTimeline({ workouts: workouts.filter(workout => !isTrainerClientBasicWorkout(workout)), history, clientProfile: client });
    const assignment = timeline.find(item => item.status === "current") || timeline.find(item => item.status === "future");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 7);
    const trackedDays = nutritionDays.filter(day => { const date = getNutritionDayDate(day.date); return date && date >= cutoff && date < today && Number(day.totals?.calories) > 0; }).length;
    const latestWeightMeasurement = getLatestTrainerWeightMeasurement(measurements);
    const weight = latestWeightMeasurement ? getMeasurementFieldValue(latestWeightMeasurement, MEASUREMENT_FIELDS[0]) : null;
    cards.splice(0, cards.length,
      { id: "workout", target: "workouts", icon: CalendarDays, label: "Тренировки", value: assignment ? `${assignment.completedCount || 0} из ${assignment.workoutCount}` : "Нет программы", detail: snapshot?.lastWorkoutAt ? `Последняя — ${formatCompactDate(snapshot.lastWorkoutAt)}` : assignment?.completedCount ? "Тренировки выполнены · дата уточняется" : client?.trainerHistoryLoadError ? "Не удалось загрузить историю" : "Пока нет завершённых тренировок" },
      { id: "nutrition", target: "nutrition", icon: Utensils, label: "Дневник питания", value: client?.trainerNutritionLoadError ? "Не загружен" : `${trackedDays} из 7`, detail: client?.trainerNutritionLoadError ? "Не удалось прочитать записи" : trackedDays ? "дней с записями за неделю" : "дней с записями · нет данных" },
      { id: "measurements", target: "bodyProgress", icon: Ruler, label: "Последний вес", value: weight !== null && weight !== undefined ? `${weight} кг` : "Нет записи", detail: latestWeightMeasurement ? formatCompactDate(getMeasurementDate(latestWeightMeasurement)) : "Клиент ещё не добавлял вес" }
    );
  }

  return (
    <section className={`trainerClientWorkSummary ${clientOverviewStyles.keyMetrics}`} aria-label="Ключевые показатели клиента">
      {cards.map(({ id, target, icon: Icon, label, value, detail }) => (
        <article key={id} className={clientOverviewStyles.keyMetric}>
          <button
            type="button"
            className={clientOverviewStyles.keyMetricButton}
            onClick={() => onTabChange?.(target)}
            aria-label={`${label}: ${value}. Открыть раздел`}
          >
            <span className={clientOverviewStyles.keyMetricIcon}><Icon size={23} /></span>
            <span className={clientOverviewStyles.keyMetricCopy}>
              <small>{label}</small>
              <strong>{value}</strong>
              <span>{detail}</span>
            </span>
            <ChevronRight className={clientOverviewStyles.keyMetricArrow} size={19} aria-hidden="true" />
          </button>
        </article>
      ))}
    </section>
  );
}

function ClientOverviewAttention({
  client,
  snapshot,
  workoutReview,
  history = [],
  onTabChange,
  onOpenCalendar,
  onOpenFeedback,
  onOpenWorkoutHistory
}) {
  const items = Array.isArray(snapshot?.criticalAttentionItems)
    ? [...snapshot.criticalAttentionItems]
    : [];
  if (isTrainerV2Path(window.location.pathname) && client?.subscription
    && ["ending", "expired"].includes(getSubscriptionStatus(client.subscription).id)
    && !items.some(item => item.type === "subscription")) {
    items.push({ type: "subscription", reason: getSubscriptionAttentionLabel(client.subscription) });
  }
  if (!items.length) return null;

  const actionByType = {
    program: { target: "workouts", label: "Назначить программу", fallback: "Не назначена программа тренировок" },
    workout: { target: "workouts", label: "Открыть расписание", fallback: "Пропущены плановые тренировки" },
    feedback: { target: "feedback", label: "Посмотреть оценку", fallback: "Нужна проверка самочувствия" },
    subscription: { target: "calendar", label: "Открыть абонемент", fallback: "Нужно проверить абонемент" }
  };
  const workoutNotes = getWorkoutNoteItems(history);
  const feedbackNote = workoutReview?.historyId
    ? workoutNotes.find((note) => note.historyId === workoutReview.historyId) || null
    : null;

  function openAttention(action) {
    if (action.target === "calendar") {
      onOpenCalendar?.();
      return;
    }
    if (action.target === "feedback") {
      if (feedbackNote) {
        onOpenFeedback?.(feedbackNote);
        return;
      }
      if (onOpenWorkoutHistory) onOpenWorkoutHistory();
      else onTabChange?.("workouts");
      return;
    }
    onTabChange?.(action.target);
  }

  return (
    <section className={clientOverviewStyles.controlNotices} aria-label="Контроль клиента">
      {items.map((attention, index) => {
        const action = actionByType[attention?.type] || actionByType.program;
        const suppliedTitle = String(attention?.reason || "").trim();
        const title = /контрол.*просроч/i.test(suppliedTitle) ? action.fallback : suppliedTitle || action.fallback;
        return (
          <div className={clientOverviewStyles.controlNotice} key={`${attention?.type || "attention"}-${index}`}>
            <span className={clientOverviewStyles.controlNoticeIcon}><CircleAlert size={22} /></span>
            <strong>{title}</strong>
            <button type="button" onClick={() => openAttention(action)}>{action.target === "feedback" && feedbackNote ? "Открыть комментарий" : action.label}<ChevronRight size={16} /></button>
          </div>
        );
      })}
    </section>
  );
}

function TrainerClientDetail({
  client,
  profile,
  summary,
  snapshot,
  workoutReview,
  activeTab,
  onLoadProgramLibrary,
  onOpenExerciseLibrary,
  onTabChange,
  onBack,
  onRetryData,
  measurements,
  history,
  exerciseProgressReviews,
  nutritionDays,
  nutritionGoals,
  nutritionPlanOptions,
  photos,
  tasks,
  onGeneratePlan,
  onSaveNutritionPlan,
  workouts,
  archivedWorkouts = [],
  exerciseLibrary,
  programTemplates,
  selectedProgramId,
  onSelectProgram,
  onAssignProgram,
  onRenameProgramAssignment,
  onArchiveProgramAssignment,
  onRestoreProgramAssignment,
  onDeleteProgramAssignment,
  canAdminManageProgramAssignments = false,
  onSaveWorkoutSchedule,
  programStatus,
  onUpdateWorkout,
  onUpdateExercise,
  onSaveExerciseProgressAdjustment,
  onUpdateLibraryExercise,
  onRemoveLibraryExercise,
  onCreateLibraryExercise,
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onAddExercise,
  onRemoveExercise,
  onDuplicateExercise,
  onMoveExercise,
  onUploadExerciseVideo,
  onUploadLibraryExerciseVideo,
  exerciseVideoUploadingId,
  onAddDay,
  onDuplicateDay,
  onRemoveDay,
  onSaveWorkouts,
  onLoadMoreHistory,
  onSaveNotifications,
  onSaveClientSetupProgress,
  showSetupWizard = true,
  onTestNotification,
  onConnectTelegram,
  onOpenTelegramChat,
  onSendMessage,
  onCreateTask,
  messages = [],
  onClientAction,
  canDeleteClient = false,
  onResolveExerciseProgress
}) {
  const name = client.name || client.email || "Клиент";
  // A stale directory filter must never leave the client detail blank.
  const currentTab = [
    "overview", "exercises", "workouts", "exerciseProgress", "training",
    "nutrition", "bodyProgress", "measurements", "photos", "notifications",
    "messages", "notes"
  ].includes(activeTab) ? activeTab : "overview";
  const exercisesOpen = ["exercises", "workouts", "exerciseProgress", "training"].includes(currentTab);
  const messagesOpen = ["messages", "notes"].includes(currentTab);
  const clientTelegram = getClientTelegramProfile(client);
  const telegramAvailable = Boolean(clientTelegram.connected && clientTelegram.username && onOpenTelegramChat);
  const hasClientSubscription = Boolean(
    client.subscription && (
      client.subscription.startDate ||
      client.subscription.endDate ||
      client.subscription.purchasedSessions !== undefined ||
      client.subscription.totalSessions !== undefined ||
      client.subscription.usedSessions !== undefined
    )
  );
  const clientSubscriptionStatus = hasClientSubscription ? getSubscriptionStatus(client.subscription) : null;
  const [workoutHistoryOpen, setWorkoutHistoryOpen] = useState(false);
  const clientSubscriptionBadge = (() => {
    if (!clientSubscriptionStatus) return { id: "inactive", label: "Абонемент не активен" };
    if (clientSubscriptionStatus.id === "active") return { id: "active", label: "Абонемент активен" };
    if (clientSubscriptionStatus.id === "renewed") return { id: "renewed", label: "Абонемент продлён" };
    if (clientSubscriptionStatus.id === "ending") return { id: "ending", label: "Абонемент скоро закончится" };
    if (clientSubscriptionStatus.id === "frozen") return { id: "frozen", label: "Абонемент заморожен" };
    return { id: "inactive", label: "Абонемент не активен" };
  })();
  const profileFacts = [
    profile?.age ? `${profile.age} лет` : "",
    profile?.height ? `${profile.height} см` : "",
    !isTrainerV2Path(window.location.pathname) && profile?.weight ? `${profile.weight} кг` : ""
  ].filter(Boolean);
  const profileMetaText = profileFacts.length ? profileFacts.join(" · ") : "Данные профиля не заполнены";
  const clientQuestionnaireCompleted = hasCompletedClientQuestionnaire({
    ...client,
    profile: client?.profile || profile
  });
  const [messageOpen, setMessageOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("trainerClient") === client.id && params.get("compose") === "1";
  });
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageSourceNote, setMessageSourceNote] = useState(null);
  const [messageStatus, setMessageStatus] = useState("");
  const [messageAttemptId, setMessageAttemptId] = useState("");
  const [messageChannel, setMessageChannel] = useState("notification");
  const [contactOpen, setContactOpen] = useState(false);
  const requestedUtilitySheet = ["exerciseProgress", "calendar", "tasks"].includes(activeTab) ? activeTab : "";
  const [utilitySheet, setUtilitySheet] = useState(requestedUtilitySheet);
  const [lastUtilityTab, setLastUtilityTab] = useState(activeTab);
  if (lastUtilityTab !== activeTab) {
    setLastUtilityTab(activeTab);
    if (requestedUtilitySheet) setUtilitySheet(requestedUtilitySheet);
  }
  const [setupChecklist, setSetupChecklist] = useState(() => getTrainerClientSetupChecklist(client));
  const [setupProgressStatus, setSetupProgressStatus] = useState("");
  const [setupProgressSaving, setSetupProgressSaving] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(() => (
    showSetupWizard && hasCompletedClientQuestionnaire({ ...client, profile: client?.profile || profile }) &&
    getTrainerClientSetupChecklist(client).status !== "completed"
  ));
  useEffect(() => {
    if (setupWizardOpen) void Promise.resolve(onLoadProgramLibrary?.())
      .catch(error => console.warn("Setup program library load failed:", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupWizardOpen]);
  const [adjustmentRequest, setAdjustmentRequest] = useState(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [messageResolvingKey, setMessageResolvingKey] = useState("");
  const [messageResolutionStatus, setMessageResolutionStatus] = useState("");
  const [locallyResolvedMessages, setLocallyResolvedMessages] = useState({ clientId: client.id, ids: [] });
  const persistedProcessedNoteIds = useMemo(() => getTrainerClientMessageResolvedIds({
    telegramMessages: messages,
    trainerEvents: exerciseProgressReviews
  }), [exerciseProgressReviews, messages]);
  const processedNoteIds = useMemo(() => {
    const localIds = locallyResolvedMessages.clientId === client.id
      ? locallyResolvedMessages.ids
      : [];
    return new Set([...persistedProcessedNoteIds, ...localIds]);
  }, [client.id, locallyResolvedMessages, persistedProcessedNoteIds]);
  const reviewedWorkoutKeys = useMemo(
    () => getTrainerWorkoutReviewReviewedKeys(exerciseProgressReviews),
    [exerciseProgressReviews]
  );
  const summaryWorkoutReviewKey = workoutReview ? getTrainerWorkoutReviewKey(workoutReview) : "";
  const visibleSummaryWorkoutReview = workoutReview && reviewedWorkoutKeys.has(summaryWorkoutReviewKey)
    ? { ...workoutReview, needsTrainerReply: false, reviewed: true }
    : workoutReview;

  async function submitMessage() {
    const text = messageText.trim();
    if (text.length < 3 || messageSending) return;
    setMessageSending(true);
    setMessageStatus("sending");
    const replyContext = messageSourceNote ? {
      replyId: messageAttemptId,
      sourceCommentId: messageSourceNote.id,
      sourceType: messageSourceNote.source,
      sourceTitle: messageSourceNote.title || "",
      sourceText: messageSourceNote.text,
      sourceDate: messageSourceNote.date || "",
      historyId: messageSourceNote.historyId || "",
      workoutId: messageSourceNote.workoutId || "",
      workoutName: messageSourceNote.workoutName || messageSourceNote.title || "",
      exerciseId: messageSourceNote.exerciseId || "",
      exerciseName: messageSourceNote.exerciseName || ""
    } : null;

    try {
      const sent = await onSendMessage?.(text, client, replyContext, messageChannel);
      if (sent === false) {
        setMessageStatus("error");
        return;
      }
      setMessageText("");
      setMessageStatus("sent");
      if (!messageSourceNote) setMessageOpen(false);
    } catch (error) {
      console.error("Trainer reply failed:", error);
      setMessageStatus("error");
    } finally {
      setMessageSending(false);
    }
  }

  function openMessageFromNote(noteItem) {
    setMessageSourceNote(noteItem || null);
    setMessageChannel("notification");
    setMessageText("");
    setMessageStatus("");
    setMessageAttemptId(`feedback_reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    setMessageOpen(true);
  }

  function openNewMessage(channel = "notification") {
    setMessageSourceNote(null);
    setMessageChannel(channel);
    setMessageText("");
    setMessageStatus("");
    setMessageAttemptId("");
    setMessageOpen(true);
  }

  function requestCloseMessage() {
    if (messageSending || messageResolvingKey) return;
    if (messageText.trim() && !window.confirm("Закрыть без сохранения ответа?")) return;
    setMessageOpen(false);
    setMessageText("");
    setMessageStatus("");
    setMessageChannel("notification");
  }

  async function resolveMessagesWithoutReply(noteItems, { bulk = false, closeModal = false } = {}) {
    const sourceCommentIds = Array.from(new Set((Array.isArray(noteItems) ? noteItems : [noteItems])
      .map((item) => String(item?.id || item?.sourceCommentId || "").trim())
      .filter(Boolean)));
    if (!sourceCommentIds.length || messageResolvingKey) return false;

    const resolvingKey = bulk ? "all" : sourceCommentIds[0];
    setMessageResolvingKey(resolvingKey);
    setMessageResolutionStatus("");
    if (!bulk) setMessageStatus("resolving");

    try {
      const saved = await onClientAction?.("resolve_client_messages", client, { sourceCommentIds });
      if (!saved) throw new Error("Message resolution was not saved");

      setLocallyResolvedMessages((current) => ({
        clientId: client.id,
        ids: Array.from(new Set([
          ...(current.clientId === client.id ? current.ids : []),
          ...sourceCommentIds
        ]))
      }));

      if (bulk) {
        setMessageResolutionStatus(`Отмечено обработанными: ${sourceCommentIds.length}.`);
      } else {
        setMessageStatus("processed");
      }

      if (closeModal) {
        setMessageOpen(false);
        setMessageText("");
        setMessageStatus("");
      }
      return true;
    } catch (error) {
      console.error("Unable to mark client messages as processed:", error);
      if (bulk) setMessageResolutionStatus("Не удалось отметить сообщения. Попробуйте ещё раз.");
      else setMessageStatus("resolve_error");
      return false;
    } finally {
      setMessageResolvingKey("");
    }
  }

  function adjustWorkoutFromReply() {
    if (!messageSourceNote) return;
    setAdjustmentRequest({
      workoutId: messageSourceNote.workoutId || "",
      token: Date.now()
    });
    setMessageOpen(false);
    onTabChange("workouts");
  }

  async function runClientAction(actionId) {
    if (actionId === "open_calendar") {
      setActionsOpen(false);
      setUtilitySheet("calendar");
      return;
    }
    if (actionId === "open_notifications") {
      setActionsOpen(false);
      setUtilitySheet("notifications");
      return;
    }
    if (actionId === "open_access_info") {
      setActionsOpen(false);
      setUtilitySheet("accessInfo");
      return;
    }
    return onClientAction?.(actionId, client);
  }

  const isClientTabActive = (tab) => (
    (tab.id === "exercises" && exercisesOpen)
    || (tab.id === "messages" && messagesOpen)
    || currentTab === tab.id
    || (tab.id === "bodyProgress" && ["measurements", "photos"].includes(currentTab))
  );

  useEffect(() => {
    if (activeTab === "exerciseProgress") onTabChange("workouts");
    else if (["calendar", "tasks"].includes(activeTab)) onTabChange("overview");
  }, [activeTab, onTabChange]);

  async function completeSetupStep(step, { preserveSavedStep = false } = {}) {
    // Keep this form mounted until the separately persisted step is confirmed.
    setSetupProgressSaving(true);
    let nextChecklist;
    try {
      nextChecklist = await onSaveClientSetupProgress?.(
        step,
        client,
        setupChecklist
      );
    } catch {
      nextChecklist = false;
    } finally {
      setSetupProgressSaving(false);
    }
    if (!nextChecklist || nextChecklist === false) {
      const savedSetting = {
        schedule: "Расписание уже сохранено.",
        nutrition: "План питания уже сохранён.",
        notifications: "Настройки напоминаний уже сохранены."
      }[step] || "Настройки уже сохранены.";
      const message = preserveSavedStep
        ? "Программа уже назначена. Не удалось сохранить отметку настройки клиента. Сохраните отметку повторно — назначать программу заново не нужно."
        : `${savedSetting} Не удалось сохранить отметку завершения шага. Правки остались в форме — повторите попытку.`;
      if (preserveSavedStep) setSetupProgressStatus(message);
      if (preserveSavedStep && !setupWizardOpen) return false;
      throw Object.assign(new Error(message), { assignmentMessage: message });
    }
    setSetupProgressStatus("");
    setSetupChecklist(nextChecklist);
    setSetupWizardOpen(nextChecklist.status !== "completed");
    return nextChecklist;
  }

  async function saveSubscription(settings) {
    if (!onSaveNotifications) return false;
    return onSaveNotifications(settings, client);
  }

  async function assignProgram(options) {
    if (setupProgressStatus) {
      const checklist = await completeSetupStep("program", { preserveSavedStep: true });
      return { checklist, setupProgressSaved: checklist !== false };
    }
    if (!onAssignProgram) return false;
    const assignment = await onAssignProgram(options);
    if (assignment !== false) {
      const checklist = await completeSetupStep("program", { preserveSavedStep: true });
      return { ...assignment, assignment, checklist, setupProgressSaved: checklist !== false };
    }
    return assignment;
  }

  async function saveSetupWorkoutSchedule(dates, assignment, options) {
    if (!onSaveWorkoutSchedule) return false;
    const saved = await onSaveWorkoutSchedule(dates, assignment, options);
    if (saved !== false) {
      const checklist = await completeSetupStep("schedule");
      if (checklist === false) return false;
    }
    return saved;
  }

  async function saveNutritionPlan(payload) {
    if (!onSaveNutritionPlan) return false;
    const saved = await onSaveNutritionPlan(payload);
    if (saved !== false) {
      const checklist = await completeSetupStep("nutrition");
      if (checklist === false) return false;
    }
    return saved;
  }

  async function saveNotificationSettings(settings) {
    if (!onSaveNotifications) return false;
    const saved = await onSaveNotifications(settings, client);
    if (saved !== false && !settings?.subscriptionOnly) {
      const checklist = await completeSetupStep("notifications");
      if (checklist === false) return false;
    }
    return saved;
  }

  if (!clientQuestionnaireCompleted) {
    return (
      <div className={`trainerNextPage trainerNextClientPage ${mobileStyles.clientPageFix}`}>
        <div className={`trainerNextClientBackRow ${mobileStyles.clientToolbarFix}`}>
          <button className="trainerNextClientBackButton" type="button" onClick={onBack} aria-label="Назад к списку клиентов">
            <ArrowLeft size={20} />
            <span className="trainerNextClientBackDesktop">Назад к списку</span>
            <span className="trainerNextClientBackMobile">Клиенты</span>
          </button>
          {canDeleteClient ? (
            <button
              className="trainerNextPendingClientDelete"
              type="button"
              onClick={() => void runClientAction("delete")}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>Удалить клиента</span>
            </button>
          ) : null}
        </div>

        <header className="trainerNextClientHeader trainerNextClientHeaderLocked">
          <TrainerAvatar client={client} size="large" />
          <div>
            <div className="trainerNextClientName">
              <h1>{name}</h1>
              <span className="trainerNextClientQuestionnaireStatus">Анкета ожидается</span>
            </div>
            <p>Карточка откроется после заполнения анкеты.</p>
          </div>
        </header>

        <section className="trainerNextClientQuestionnaireGate" aria-live="polite">
          <div className="trainerNextClientQuestionnairePreview" aria-hidden="true">
            <div className="trainerNextClientQuestionnairePreviewTabs"><span /><span /><span /><span /></div>
            <div className="trainerNextClientQuestionnairePreviewCards"><span /><span /><span /></div>
            <div className="trainerNextClientQuestionnairePreviewWide" />
          </div>
          <div className="trainerNextClientQuestionnaireGateMessage">
            <span className="trainerNextClientQuestionnaireGateIcon"><ClipboardList size={24} /></span>
            <div>
              <strong>Пока нет данных</strong>
              <p>Клиент ещё не закончил стартовую анкету. После этого здесь появятся план, питание и прогресс.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div data-client-layout={isTrainerV2Path(window.location.pathname) ? "familiar" : undefined} className={`trainerNextPage trainerNextClientPage trainerNextClientVariantA ${mobileStyles.clientPageFix} ${isTrainerV2Path(window.location.pathname) ? `${appleStyles.page} ${familiarStyles.page}` : ""}`}>
      <div className={`trainerNextClientBackRow ${mobileStyles.clientToolbarFix}`}>
        <button className="trainerNextClientBackButton" type="button" onClick={onBack} aria-label="Назад к списку клиентов">
          <ArrowLeft size={20} />
          <span className="trainerNextClientBackDesktop">Назад к списку</span>
          <span className="trainerNextClientBackMobile">Клиенты</span>
        </button>
        {isTrainerV2Path(window.location.pathname) ? (<div className={`trainerNextClientHeaderActions${setupChecklist.status !== "completed" ? " trainerNextClientHeaderActionsWithSetup" : ""}`} aria-label="Действия с клиентом">
          {setupChecklist.status !== "completed" ? (
            <button
              className="trainerNextClientHeaderUtilityButton trainerNextClientSetupButton"
              type="button"
              onClick={() => setSetupWizardOpen(true)}
              aria-label="Завершить первичную настройку клиента"
            >
              <ClipboardList size={17} />
              <span>Завершить<br /> настройку</span>
            </button>
          ) : null}
          {onCreateTask && !isTrainerV2Path(window.location.pathname) ? (
            <button
              className="trainerNextClientTaskButton"
              type="button"
              onClick={() => setUtilitySheet("tasks")}
            >
              <ClipboardList size={17} />
              <span>Задания<br /> клиенту</span>
            </button>
          ) : null}
          {!isTrainerV2Path(window.location.pathname) ? <button
            className="trainerNextClientHeaderUtilityButton"
            type="button"
            onClick={() => setUtilitySheet("messages")}
            aria-label="Сообщения клиента"
          >
            <MessageSquare size={16} />
            <span>Сообщения</span>
          </button> : null}
          <button
            className="trainerNextClientHeaderUtilityButton trainerNextClientActionsButton"
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label="Действия с клиентом"
          >
            <EllipsisVertical size={18} />
            <span>Действия</span>
          </button>
        </div>) : null}
      </div>

      <header className="trainerNextClientHeader">
        <TrainerAvatar client={client} size="large" />
        <div>
          <div className="trainerNextClientName">
            <h1>{name}</h1>
            {!isTrainerV2Path(window.location.pathname) ? <div className="trainerNextClientStatusRow">
              <button
                className={`trainerNextClientSubscriptionStatus is-${clientSubscriptionBadge.id}`}
                type="button"
                onClick={() => setUtilitySheet("calendar")}
                aria-label="Открыть абонемент клиента"
              >
                {clientSubscriptionBadge.label}
              </button>
            </div> : null}
          </div>
          <p>{profileMetaText}</p>
          <strong>Цель: {client.goalDescription || profile?.goalLabel || "Персональный результат"}</strong>
        </div>
        {!isTrainerV2Path(window.location.pathname) ? (<div className={`trainerNextClientHeaderActions${setupChecklist.status !== "completed" ? " trainerNextClientHeaderActionsWithSetup" : ""}`} aria-label="Действия с клиентом">
          {setupChecklist.status !== "completed" ? (
            <button
              className="trainerNextClientHeaderUtilityButton trainerNextClientSetupButton"
              type="button"
              onClick={() => setSetupWizardOpen(true)}
              aria-label="Завершить первичную настройку клиента"
            >
              <ClipboardList size={17} />
              <span>Завершить<br /> настройку</span>
            </button>
          ) : null}
          {onCreateTask && !isTrainerV2Path(window.location.pathname) ? (
            <button
              className="trainerNextClientTaskButton"
              type="button"
              onClick={() => setUtilitySheet("tasks")}
            >
              <ClipboardList size={17} />
              <span>Задания<br /> клиенту</span>
            </button>
          ) : null}
          {!isTrainerV2Path(window.location.pathname) ? <button
            className="trainerNextClientHeaderUtilityButton"
            type="button"
            onClick={() => setUtilitySheet("messages")}
            aria-label="Сообщения клиента"
          >
            <MessageSquare size={16} />
            <span>Сообщения</span>
          </button> : null}
          <button
            className="trainerNextClientHeaderUtilityButton trainerNextClientActionsButton"
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label="Действия с клиентом"
          >
            <EllipsisVertical size={18} />
            <span>Действия</span>
          </button>
        </div>) : null}
      </header>

      <nav className="trainerNextClientTabs">
        {CLIENT_TABS.map((tab) => {
          const active = isClientTabActive(tab);
          const Icon = CLIENT_TAB_ICONS[tab.id];
          return (
            <button type="button" key={tab.id} className={active ? "active" : ""} aria-pressed={active} onClick={() => onTabChange(tab.target || tab.id)}>
              <Icon size={18} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <nav className="trainerNextClientMobileNav" aria-label="Разделы клиента">
        {CLIENT_TABS.slice(0, 4).map((tab) => {
          const Icon = CLIENT_TAB_ICONS[tab.id];
          const active = isClientTabActive(tab);
          return (
            <button
              type="button"
              key={tab.id}
              aria-current={active ? "page" : undefined}
              onClick={() => onTabChange(tab.target || tab.id)}
            >
              <Icon size={21} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {isTrainerV2Path(window.location.pathname) ? (
        <div className="trainerClientPageHeading">
          <div><h2>{exercisesOpen ? "Тренировки" : currentTab === "nutrition" ? "Питание" : ["bodyProgress", "measurements", "photos"].includes(currentTab) ? "Фото и замеры" : "Сводка"}</h2>
          <p>{exercisesOpen ? "Персональный план и результаты" : currentTab === "nutrition" ? "Записи и цели — отдельно" : ["bodyProgress", "measurements", "photos"].includes(currentTab) ? "Сравнение дат и изменение показателей" : "Состояние и последние изменения"}</p></div>
        </div>
      ) : null}
      {setupProgressStatus ? <section className={syncStyles.assignmentRecovery} role="status" aria-live="polite" aria-atomic="true">
        <p>{setupProgressStatus}</p>
        <button type="button" disabled={setupProgressSaving} onClick={() => completeSetupStep("program", { preserveSavedStep: true })}>
          {setupProgressSaving ? "Сохраняю отметку…" : "Сохранить отметку"}
        </button>
      </section> : null}
      {currentTab === "overview" ? (
        <ClientOverview
          onLoadMoreHistory={onLoadMoreHistory}
          workouts={workouts}
          client={client}
          snapshot={snapshot}
          workoutReview={visibleSummaryWorkoutReview}
          measurements={measurements}
          history={history}
          nutritionDays={nutritionDays}
          nutritionGoals={nutritionGoals}
          onTabChange={onTabChange}
          onOpenCalendar={() => setUtilitySheet("calendar")}
          onOpenTasks={() => setUtilitySheet("tasks")}
          onOpenMessages={() => setUtilitySheet("messages")}
          onOpenAccessInfo={() => setUtilitySheet("accessInfo")}
          onOpenWorkoutHistory={() => {
            onTabChange("workouts");
            setWorkoutHistoryOpen(true);
          }}
          onOpenFeedback={openMessageFromNote}
          onOpenMessage={() => openNewMessage("notification")}
          onOpenExerciseProgress={() => setUtilitySheet("exerciseProgress")}
        />
      ) : null}
      {exercisesOpen ? (
        <section className={`${trainerClientExercisesTabsStyles.section} trainerClientTabContent`}>
          <ClientWorkoutPlan
            historyOpen={workoutHistoryOpen}
            onHistoryOpenChange={setWorkoutHistoryOpen}
            client={client}
              summary={summary}
              history={history}
              workouts={workouts}
              archivedWorkouts={archivedWorkouts}
              programTemplates={programTemplates}
              selectedProgramId={selectedProgramId}
              onSelectProgram={onSelectProgram}
              onAssignProgram={assignProgram}
              onRenameProgramAssignment={onRenameProgramAssignment}
              onArchiveProgramAssignment={onArchiveProgramAssignment}
              onRestoreProgramAssignment={onRestoreProgramAssignment}
              onDeleteProgramAssignment={onDeleteProgramAssignment}
              canAdminManageProgramAssignments={canAdminManageProgramAssignments}
              onSaveWorkoutSchedule={onSaveWorkoutSchedule}
              onSaveSubscription={saveSubscription}
              programStatus={programStatus}
              adjustmentRequest={adjustmentRequest}
              reviewEvents={exerciseProgressReviews}
              onResolveWorkoutReview={(payload) => onClientAction?.("resolve_workout_review", client, payload)}
              onLoadMoreHistory={onLoadMoreHistory}
              editorProps={{
                exerciseLibrary,
                onOpenExerciseLibrary,
                programTemplates,
                selectedProgramId,
                onSelectProgram,
                onAssignProgram: assignProgram,
                activeWorkoutTab: "plan",
                programStatus,
                onUpdateWorkout,
                onUpdateExercise,
                onUpdateLibraryExercise,
                onRemoveLibraryExercise,
                onCreateLibraryExercise,
                onUpdateExerciseSet,
                onAddExerciseSet,
                onRemoveExerciseSet,
                onAddExercise,
                onRemoveExercise,
                onDuplicateExercise,
                onMoveExercise,
                onUploadExerciseVideo,
                onUploadLibraryExerciseVideo,
                exerciseVideoUploadingId,
                onAddDay,
                onDuplicateDay,
                onRemoveDay,
                initialWorkoutId: adjustmentRequest?.workoutId || "",
                onSave: onSaveWorkouts
              }}
          />
        </section>
      ) : null}
      {currentTab === "nutrition" ? <NutritionView client={client} profile={profile} history={history} nutritionDays={nutritionDays} goals={nutritionGoals} planOptions={nutritionPlanOptions} onGeneratePlan={onGeneratePlan} onSavePlan={saveNutritionPlan} status={programStatus} onOpenDiary={() => setUtilitySheet("nutritionDiary")} onRetryData={onRetryData} /> : null}
      {["bodyProgress", "measurements", "photos"].includes(currentTab) ? <ClientBodyProgress measurements={measurements} photos={photos} /> : null}
      {currentTab === "notifications" ? <ClientNotifications key={client.id} client={client} workouts={workouts} history={history} measurements={measurements} photos={photos} status={programStatus} onSave={saveNotificationSettings} onTest={onTestNotification} onConnectTelegram={onConnectTelegram} onSaveSubscription={saveSubscription} /> : null}
      {messagesOpen ? (
        <ClientMessages
          history={history}
          historyCoverage={getTrainerHistoryCoverage(client)}
          onLoadMoreHistory={onLoadMoreHistory}
          onReplyToMessage={openMessageFromNote}
          onMarkAllProcessed={(pendingMessages) => resolveMessagesWithoutReply(pendingMessages, { bulk: true })}
          processedMessageIds={processedNoteIds}
          resolvingAll={messageResolvingKey === "all"}
          resolutionStatus={messageResolutionStatus}
        />
      ) : null}

      {utilitySheet === "messages" ? (
        <TrainerClientUtilitySheet
          title="Сообщения"
          eyebrow={name}
          variant="messages"
          headerAction={(
            <button
              type="button"
              onClick={() => {
                setUtilitySheet("");
                openNewMessage();
              }}
            >
              <Mail size={16} />Написать клиенту
            </button>
          )}
          onRequestClose={() => setUtilitySheet("")}
        >
          <ClientMessages
            history={history}
            historyCoverage={getTrainerHistoryCoverage(client)}
            onLoadMoreHistory={onLoadMoreHistory}
            onReplyToMessage={(note) => {
              setUtilitySheet("");
              openMessageFromNote(note);
            }}
            onMarkAllProcessed={(pendingMessages) => resolveMessagesWithoutReply(pendingMessages, { bulk: true })}
            processedMessageIds={processedNoteIds}
            resolvingAll={messageResolvingKey === "all"}
            resolutionStatus={messageResolutionStatus}
            embedded
          />
        </TrainerClientUtilitySheet>
      ) : null}

      {utilitySheet === "accessInfo" ? (
        <TrainerClientUtilitySheet title="Данные для входа и связи" eyebrow={name} onRequestClose={() => setUtilitySheet("")}>
          <TrainerClientAccessInfo key={client.id} client={client} />
        </TrainerClientUtilitySheet>
      ) : null}

      {utilitySheet === "notifications" ? (
        <TrainerClientUtilitySheet title="Уведомления" eyebrow="Клиент" variant="wide" onRequestClose={() => setUtilitySheet("")}>
          <ClientNotifications
            key={`utility-notifications-${client.id}`}
            mode="notifications"
            client={client}
            workouts={workouts}
            history={history}
            measurements={measurements}
            photos={photos}
            status={programStatus}
            onSave={saveNotificationSettings}
            onTest={onTestNotification}
            onConnectTelegram={onConnectTelegram}
            onSaveSubscription={saveSubscription}
          />
        </TrainerClientUtilitySheet>
      ) : null}

      {utilitySheet === "calendar" ? (
        <TrainerClientUtilitySheet title="Календарь тренировок" eyebrow="Расписание и абонемент" variant="agenda" onRequestClose={() => setUtilitySheet("")}>
          <ClientScheduleAgenda
            key={`utility-calendar-${client.id}`}
            client={client}
            workouts={workouts}
            history={history}
            status={programStatus}
            onSaveSchedule={onSaveWorkoutSchedule}
            onSaveSubscription={saveSubscription}
          />
        </TrainerClientUtilitySheet>
      ) : null}

      {utilitySheet === "exerciseProgress" ? (
        <TrainerClientUtilitySheet title="Прогресс упражнений" eyebrow="Тренировки" variant="wide" onRequestClose={() => setUtilitySheet("")}>
          <ClientExerciseProgress
            key={client?.id || "trainer-client-exercise-progress"}
            client={client}
            history={history}
            workouts={workouts}
            reviews={exerciseProgressReviews}
            onLoadMoreHistory={onLoadMoreHistory}
            onResolve={onResolveExerciseProgress}
            onSaveAdjustment={onSaveExerciseProgressAdjustment}
          />
        </TrainerClientUtilitySheet>
      ) : null}

      {utilitySheet === "nutritionDiary" ? (
        <TrainerClientUtilitySheet title="Дневник питания" eyebrow="Питание" variant="wide" onRequestClose={() => setUtilitySheet("")}>
          <NutritionDiary nutritionDays={nutritionDays} />
        </TrainerClientUtilitySheet>
      ) : null}

      {utilitySheet === "tasks" ? (
        <TrainerClientUtilitySheet title="Задания клиенту" eyebrow="Назначения" onRequestClose={() => setUtilitySheet("")}>
          <TrainerClientTasks
            tasks={tasks}
            embedded
            onCreateTask={() => {
              setUtilitySheet("");
              onCreateTask?.();
            }}
          />
        </TrainerClientUtilitySheet>
      ) : null}

      {contactOpen ? (
        <TrainerClientContactModal
          clientName={name}
          telegramAvailable={telegramAvailable}
          onOpenTelegram={() => {
            onOpenTelegramChat?.(clientTelegram.username);
            setContactOpen(false);
          }}
          onOpenNotification={() => {
            setContactOpen(false);
            openNewMessage("notification");
          }}
          onRequestClose={() => setContactOpen(false)}
        />
      ) : null}

      {messageOpen ? (
        <TrainerWorkoutFeedbackReplyModal
          styles={trainerWorkoutFeedbackReplyStyles}
          clientName={name}
          sourceNote={messageSourceNote}
          value={messageText}
          sending={messageSending}
          resolving={Boolean(messageResolvingKey)}
          processed={messageSourceNote ? processedNoteIds.has(messageSourceNote.id) : false}
          status={messageStatus}
          messages={messages}
          deliveryChannel={messageChannel}
          onChange={(value) => {
            setMessageText(value);
            if (messageStatus === "error" || messageStatus === "sent") setMessageStatus("");
          }}
          onSubmit={submitMessage}
          onMarkProcessed={messageSourceNote
            ? () => resolveMessagesWithoutReply(messageSourceNote, { closeModal: true })
            : null}
          onRequestClose={requestCloseMessage}
          onAdjustWorkout={messageSourceNote ? adjustWorkoutFromReply : null}
        />
      ) : null}

      {actionsOpen ? (
        <TrainerClientActionsSheet clientName={name} archived={client.archived} isTest={client.isTest} canDeleteClient={canDeleteClient} basicWorkoutAccess={client.basicWorkoutAccess === true} showSchedule={isTrainerV2Path(window.location.pathname)} status={programStatus} onAction={runClientAction} onClose={() => setActionsOpen(false)} />
      ) : null}
      {setupWizardOpen ? (
        <TrainerClientSetupFlowModal
          client={client}
          clientName={name}
          checklist={setupChecklist}
          workouts={workouts}
          programTemplates={programTemplates}
          selectedProgramId={selectedProgramId}
          nutritionGoals={nutritionGoals}
          nutritionPlanOptions={nutritionPlanOptions}
          pendingProgramProgress={Boolean(setupProgressStatus)}
          onSelectProgram={onSelectProgram}
          onAssignProgram={assignProgram}
          onSaveWorkoutSchedule={saveSetupWorkoutSchedule}
          onSaveNutritionPlan={saveNutritionPlan}
          onSaveNotifications={saveNotificationSettings}
          onClose={() => setSetupWizardOpen(false)}
        />
      ) : null}
    </div>
  );
}

function TrainerClientsPage({ clients, clientSummaries, onOpenClient, onCreateClient, listState, onListStateChange, summariesLoading, onRetrySummary }) {
  const search = listState.search;
  const filter = listState.filter;
  const listRef = useRef(null);
  useVisibleTrainerSummaries(listRef, clientSummaries, summariesLoading, onRetrySummary, `${search}:${filter}`);
  const initialScrollTop = useRef(listState.scrollTop || 0);
  const setSearch = (value) => onListStateChange((state) => ({ ...state, search: value, scrollTop: 0 }));
  const setFilter = (value) => onListStateChange((state) => ({ ...state, filter: value, scrollTop: 0 }));
  function getListScroller() {
    let node = listRef.current?.parentElement;
    while (node && node !== document.body) {
      if (/(auto|scroll)/.test(window.getComputedStyle(node).overflowY)) return node;
      node = node.parentElement;
    }
    return document.scrollingElement;
  }
  useEffect(() => {
    const scroller = getListScroller();
    if (scroller) scroller.scrollTop = initialScrollTop.current;
  }, []);
  function openClient(client) {
    onListStateChange((state) => ({ ...state, scrollTop: getListScroller()?.scrollTop || 0 }));
    onOpenClient?.(client);
  }
  const summaries = clientSummaries;
  const filters = [
    ["all", "Все"],
    ["attention", "Внимание"],
    ["noProgram", "Без программы"],
    ["inactive", "Без тренировок 14+ дней"],
    ["archive", "Архив"],
    ["test", "Тестовые"]
  ];
  return (
    <div ref={listRef} className="trainerNextPage trainerNextClientsPage">
      <div className="trainerNextDesktopPageHead">
        <div><h1>Клиенты</h1><p>{clients.filter(client => !client.archived && !client.isTest).length} в работе</p></div>
        <button className="trainerNextPrimary" type="button" onClick={onCreateClient}><Plus size={18} />Добавить клиента</button>
      </div>
      <header className="trainerNextMobileHeader trainerNextClientsMobileHeader">
        <h1 className="trainerNextMobileTitle">Клиенты</h1>
      </header>
      <div className="trainerNextClientsStandalone">
        <div className="trainerNextClientSearchRow">
          <label className="trainerNextSearch open"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Поиск клиента" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя или email клиента" /></label>
          <button className="trainerNextClientSearchAdd" type="button" onClick={onCreateClient} aria-label="Добавить клиента">
            <Plus size={18} />
            <span>Добавить</span>
          </button>
        </div>
        <div className="trainerMessageFilters trainerClientFilters" role="group" aria-label="Фильтр клиентов">
          {filters.map(([id, label], index) => (
            <button
              type="button"
              key={id}
              className={`${filter === id ? "active" : ""}${index > 1 ? " trainerClientSecondaryFilter" : ""}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <details className="trainerClientFilterDisclosure" onKeyDown={(event) => {
            if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
          }}>
            <summary>Фильтры{!["all", "attention"].includes(filter) ? ` · ${filters.find(([id]) => id === filter)?.[1]}` : ""}<ChevronDown size={15} aria-hidden="true" /></summary>
            <div role="group" aria-label="Дополнительные фильтры клиентов">
              {filters.slice(2).map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? "active" : ""} onClick={(event) => {
                setFilter(id);
                event.currentTarget.closest("details").open = false;
              }}>{label}</button>)}
            </div>
          </details>
        </div>
        <DashboardClientList clients={clients} summaries={summaries} filter={filter} search={search} onOpenClient={openClient} />
      </div>
    </div>
  );
}

function getWorkoutTitle(workout, index) {
  return workout?.name || workout?.title || `День ${index + 1}`;
}

function getExerciseVideo(exercise = {}) {
  return exercise.video || exercise.videoUrl || exercise.videoURL || "";
}

function getExerciseSetSummary(sets = [], field, suffix = "") {
  const values = sets
    .map((set) => String(set?.[field] ?? "").trim())
    .filter(Boolean);
  if (!values.length) return "—";
  const uniqueValues = [...new Set(values)];
  return `${uniqueValues.length === 1 ? uniqueValues[0] : `${uniqueValues[0]}…${uniqueValues.at(-1)}`}${suffix}`;
}

function formatTrainerExerciseSession(session) {
  if (!session) return "";
  const reps = (session.actualSets || [])
    .map((set) => Number(set?.reps || 0))
    .filter((value) => value > 0);
  const uniqueReps = [...new Set(reps)];
  const repsLabel = !uniqueReps.length
    ? "—"
    : uniqueReps.length === 1
      ? uniqueReps[0]
      : uniqueReps.length <= 3
        ? uniqueReps.join("/")
        : `${Math.min(...uniqueReps)}–${Math.max(...uniqueReps)}`;
  const setsLabel = `${session.sets || reps.length || 0} × ${repsLabel}`;
  const weight = Number(session.bestWeight || 0);
  const weightLabel = weight > 0
    ? `${roundTrainerNumber(weight).toLocaleString("ru-RU")} кг`
    : "без дополнительного веса";
  return `${formatCompactDate(session.date)} · ${setsLabel} · ${weightLabel}`;
}

function formatTrainerEstimatedOneRepMax(session) {
  const oneRepMax = Number(session?.e1rm || 0);
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0) return "";
  return `1ПМ ≈ ${roundTrainerNumber(oneRepMax).toLocaleString("ru-RU")} кг`;
}

function formatTrainerExerciseComparison(progress) {
  if (!progress?.lastSession) return "Истории выполнения пока нет";
  if (Number(progress.sessionCount || 0) < 2) return "Сравнение появится после следующего выполнения";

  const comparison = progress.comparison || {};
  const weightDelta = comparison.weightDelta;
  if (typeof weightDelta === "number" && Number.isFinite(weightDelta) && weightDelta !== 0) {
    return `Вес ${weightDelta > 0 ? "+" : ""}${roundTrainerNumber(weightDelta).toLocaleString("ru-RU")} кг`;
  }

  const volumePercent = comparison.volumePercent;
  if (typeof volumePercent === "number" && Number.isFinite(volumePercent)) {
    return `Объём ${volumePercent > 0 ? "+" : ""}${roundTrainerNumber(volumePercent).toLocaleString("ru-RU")}%`;
  }

  const repsDelta = comparison.repsDelta;
  if (typeof repsDelta === "number" && Number.isFinite(repsDelta) && repsDelta !== 0) {
    return `Повторения ${repsDelta > 0 ? "+" : ""}${roundTrainerNumber(repsDelta).toLocaleString("ru-RU")}`;
  }

  const setsDelta = comparison.setsDelta;
  if (typeof setsDelta === "number" && Number.isFinite(setsDelta) && setsDelta !== 0) {
    return `Подходы ${setsDelta > 0 ? "+" : ""}${roundTrainerNumber(setsDelta).toLocaleString("ru-RU")}`;
  }

  return "Без изменений относительно прошлого выполнения";
}

export function TrainerProgramConstructor({
  program,
  months = [],
  exerciseLibrary = [],
  onOpenExerciseLibrary,
  activeWorkoutId,
  onSelectWorkout,
  onProgramNameChange,
  onSaveProgram,
  onDeleteProgram,
  onBack,
  onAddMonth,
  onUpdateMonth,
  onDeleteMonth,
  onAddCycle,
  onCopyCycle,
  onDeleteCycle,
  onAddWeek,
  onDeleteWeek,
  onAddWorkout,
  onUpdateWorkout,
  onDeleteWorkout,
  onDuplicateWorkout,
  onAddExercise,
  onUpdateExercise,
  onDeleteExercise,
  onMoveExercise,
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet
}) {
  const [openCycles, setOpenCycles] = useState({});
  const [openWeeks, setOpenWeeks] = useState({});
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [isDayEditorOpen, setIsDayEditorOpen] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const openLegacyExerciseLibrary = typeof onOpenExerciseLibrary === "function" ? (query) => {
    setLibraryPickerOpen(false);
    setExpandedExerciseId("");
    onOpenExerciseLibrary(query);
  } : undefined;

  const workoutContexts = months.flatMap((month, monthIndex) =>
    (month.microcycles || month.blocks || []).flatMap((cycle, cycleIndex) =>
      (cycle.weeks || []).flatMap((week, weekIndex) =>
        (week.workouts || []).map((workout, workoutIndex) => ({
          month,
          monthIndex,
          cycle,
          cycleIndex,
          week,
          weekIndex,
          workout,
          workoutIndex
        }))
      )
    )
  );
  const activeContext = workoutContexts.find(({ workout }) => workout.id === activeWorkoutId)
    || workoutContexts[0]
    || null;
  const activeMonth = activeContext?.month || months[0] || null;
  const activeCycle = activeContext?.cycle || activeMonth?.microcycles?.[0] || activeMonth?.blocks?.[0] || null;
  const activeWeek = activeContext?.week || activeCycle?.weeks?.[0] || null;
  const activeWorkout = activeContext?.workout || activeWeek?.workouts?.[0] || null;
  const exercises = activeWorkout?.exercises || [];

  function isCycleOpen(cycle, cycleIndex) {
    if (Object.prototype.hasOwnProperty.call(openCycles, cycle.id)) return openCycles[cycle.id];
    return cycle.id === activeCycle?.id || cycleIndex === 0;
  }

  function isWeekOpen(week, weekIndex, cycle) {
    if (Object.prototype.hasOwnProperty.call(openWeeks, week.id)) return openWeeks[week.id];
    return week.id === activeWeek?.id || (cycle.id === activeCycle?.id && weekIndex === 0);
  }

  function selectWorkout(context) {
    setExpandedExerciseId("");
    onSelectWorkout(context.workout.id);
    setIsDayEditorOpen(true);
  }

  function confirmDeleteExercise(exercise) {
    if (!activeContext) return;
    setConfirmAction({
      title: "Удалить упражнение?",
      text: `Упражнение «${exercise.name || "Без названия"}» будет удалено из этого дня программы.`,
      onConfirm: () => {
        onDeleteExercise(
          activeContext.cycle.id,
          activeContext.week.id,
          activeContext.workout.id,
          exercise.id
        );
        if (expandedExerciseId === exercise.id) setExpandedExerciseId("");
        setConfirmAction(null);
      }
    });
  }

  return (
    <section className="trainerProgramConstructor">
      <header className="trainerProgramSelectedBar">
        <CalendarDays size={27} strokeWidth={1.9} />
        <label>
          <span>Выбранная программа</span>
          <input
            value={program?.name || ""}
            onChange={(event) => onProgramNameChange(event.target.value)}
            aria-label="Название программы"
          />
        </label>
        <div>
          {onBack ? (
            <button type="button" onClick={onBack}>
              <ArrowLeft size={17} />Назад
            </button>
          ) : null}
          <button className="danger" type="button" onClick={onDeleteProgram}>
            <Trash2 size={17} />Удалить
          </button>
          <button className="primary" type="button" onClick={() => onSaveProgram()}>
            <Save size={17} />Сохранить
          </button>
        </div>
      </header>

      <div className={`trainerProgramConstructorGrid${isDayEditorOpen ? "" : " trainerProgramConstructorGridPicker"}`}>
        <aside className="trainerProgramTree" aria-label="Структура программы">
          {months.map((month, monthIndex) => {
            const cycles = month.microcycles || month.blocks || [];
            const weeksCount = cycles.reduce((sum, cycle) => sum + (cycle.weeks?.length || 0), 0);

            return (
              <section className={month.id === activeMonth?.id ? "active" : ""} key={month.id}>
                <div className="trainerProgramMonthRow">
                  <CalendarDays size={20} />
                  <label>
                    <input
                      value={month.name || `Месяц ${monthIndex + 1}`}
                      onChange={(event) => onUpdateMonth(month.id, { name: event.target.value })}
                      aria-label={`Название месяца ${monthIndex + 1}`}
                    />
                    <small>{weeksCount} {pluralize(weeksCount, "неделя", "недели", "недель")}</small>
                  </label>
                  {months.length > 1 ? (
                    <button type="button" onClick={() => onDeleteMonth(month.id)} aria-label="Удалить месяц" title="Удалить месяц">
                      <Trash2 size={15} />
                    </button>
                  ) : <ChevronDown size={17} />}
                </div>

                <div className="trainerProgramCycles">
                  {cycles.map((cycle, cycleIndex) => {
                    const cycleOpen = isCycleOpen(cycle, cycleIndex);
                    const cycleSelected = cycle.id === activeCycle?.id;

                    return (
                      <div className={`trainerProgramCycle${cycleSelected ? " selected" : ""}`} key={cycle.id}>
                        <div className="trainerProgramCycleRow">
                          <GripVertical size={18} />
                          <label>
                            <strong>{String(cycle.name || `Микроцикл ${cycleIndex + 1}`).replace(/^Микроцикл/i, "Цикл")}</strong>
                            <small>{cycle.weeks?.length || 0} {pluralize(cycle.weeks?.length || 0, "неделя", "недели", "недель")}</small>
                          </label>
                          <div>
                            <button type="button" onClick={() => onCopyCycle(cycle.id)} aria-label="Копировать цикл" title="Копировать цикл">
                              <Copy size={14} />
                            </button>
                            <button type="button" onClick={() => onDeleteCycle(cycle.id)} aria-label="Удалить цикл" title="Удалить цикл">
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setOpenCycles((current) => ({ ...current, [cycle.id]: !cycleOpen }))}
                              aria-label={cycleOpen ? "Свернуть цикл" : "Развернуть цикл"}
                            >
                              {cycleOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {cycleOpen ? (
                          <div className="trainerProgramWeeks">
                            {(cycle.weeks || []).map((week, weekIndex) => {
                              const weekOpen = isWeekOpen(week, weekIndex, cycle);
                              return (
                                <div className="trainerProgramWeek" key={week.id}>
                                  <div className="trainerProgramWeekRow">
                                    <button
                                      type="button"
                                      onClick={() => setOpenWeeks((current) => ({ ...current, [week.id]: !weekOpen }))}
                                      aria-label={weekOpen ? "Свернуть неделю" : "Развернуть неделю"}
                                    >
                                      {weekOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                    </button>
                                    <strong>{week.name || `Неделя ${weekIndex + 1}`}</strong>
                                    <small>{week.workouts?.length || 0} {pluralize(week.workouts?.length || 0, "тренировка", "тренировки", "тренировок")}</small>
                                    <button type="button" onClick={() => onDeleteWeek(cycle.id, week.id)} aria-label="Удалить неделю" title="Удалить неделю">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>

                                  {weekOpen ? (
                                    <div className="trainerProgramDays">
                                      {(week.workouts || []).map((workout, workoutIndex) => {
                                        const context = {
                                          month,
                                          monthIndex,
                                          cycle,
                                          cycleIndex,
                                          week,
                                          weekIndex,
                                          workout,
                                          workoutIndex
                                        };
                                        const selected = workout.id === activeWorkout?.id;
                                        const compactName = String(workout.name || "")
                                          .replace(/^Неделя\s*\d+\s*[-–—]\s*/i, "")
                                          .replace(/^Тренировка\s*\d+\s*[-–—:]?\s*/i, "")
                                          || `Тренировка ${workoutIndex + 1}`;

                                        return (
                                          <div className={`trainerProgramDay${selected ? " selected" : ""}`} key={workout.id}>
                                            <button type="button" onClick={() => selectWorkout(context)}>
                                              <strong>День {workoutIndex + 1}</strong>
                                              <small>{compactName}</small>
                                            </button>
                                            {selected ? (
                                              <button type="button" onClick={() => onDuplicateWorkout(cycle.id, week.id, workout.id)} aria-label="Копировать день">
                                                <Copy size={14} />
                                              </button>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                      <button className="trainerProgramTreeAdd" type="button" onClick={() => onAddWorkout(cycle.id, week.id)}>
                                        <Plus size={14} />Добавить день
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                            <button className="trainerProgramTreeAdd" type="button" onClick={() => onAddWeek(cycle.id)}>
                              <Plus size={14} />Добавить неделю
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <button className="trainerProgramAddCycle" type="button" onClick={() => onAddCycle(month.id)}>
                  <Plus size={18} />Добавить цикл
                </button>
              </section>
            );
          })}
          <button className="trainerProgramAddMonth" type="button" onClick={onAddMonth}>
            <Plus size={16} />Добавить месяц
          </button>
        </aside>

        <section
          className={`trainerProgramDayPanel${isDayEditorOpen ? " trainerProgramDayPanelModal" : ""}`}
          role={isDayEditorOpen ? "dialog" : undefined}
          aria-modal={isDayEditorOpen || undefined}
          data-trainer-modal-surface={isDayEditorOpen ? "true" : undefined}
          data-trainer-modal-floating={isDayEditorOpen ? "true" : undefined}
          aria-labelledby="trainer-program-day-editor-title"
        >
          {activeContext ? (
            <>
              <header className="trainerProgramDayModalHeader">
                <strong id="trainer-program-day-editor-title">Редактор дня</strong>
                <button type="button" onClick={() => setIsDayEditorOpen(false)} aria-label="Закрыть редактор дня" title="Закрыть редактор дня">
                  <X size={20} />
                </button>
              </header>
              <header className="trainerProgramBreadcrumb">
                <div>
                  <span>{activeContext.month.name}</span><ChevronRight size={15} />
                  <span>{String(activeContext.cycle.name).replace(/^Микроцикл/i, "Цикл")}</span><ChevronRight size={15} />
                  <span>{activeContext.week.name}</span><ChevronRight size={15} />
                  <strong>День {activeContext.workoutIndex + 1}</strong>
                </div>
                <aside>
                  <strong>{exercises.length} {pluralize(exercises.length, "упражнение", "упражнения", "упражнений")}</strong>
                  <button type="button" onClick={() => onDuplicateWorkout(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id)} aria-label="Копировать тренировку" title="Копировать тренировку">
                    <Copy size={18} />
                  </button>
                  <button type="button" onClick={() => onDeleteWorkout(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id)} aria-label="Удалить тренировку" title="Удалить тренировку">
                    <Trash2 size={18} />
                  </button>
                </aside>
              </header>

              <label className="trainerProgramWorkoutName">
                <span>Название тренировки</span>
                <input
                  value={activeContext.workout.name || ""}
                  onChange={(event) => onUpdateWorkout(
                    activeContext.cycle.id,
                    activeContext.week.id,
                    activeContext.workout.id,
                    { name: event.target.value }
                  )}
                />
              </label>

              <div className="trainerProgramExerciseHead">
                <span>Упражнение</span><span>Подходы</span><span>Повторения</span><span>Вес</span><span>Отдых</span><span />
              </div>

              <div className="trainerProgramExerciseList">
                {exercises.map((exercise, index) => {
                  const sets = Array.isArray(exercise.sets) && exercise.sets.length
                    ? exercise.sets
                    : [{ reps: "", weight: "" }];
                  const requiresWeight = exercise.requiresWeight ?? exercise.usesWeight ?? true;
                  const video = getExerciseVideo(exercise);
                  const expanded = expandedExerciseId === exercise.id;

                  return (
                    <article className={expanded ? "expanded" : ""} key={exercise.id || index}>
                      <div className="trainerProgramExerciseRow">
                        <span className="trainerNextExerciseMove">
                          <GripVertical size={15} />
                          <button type="button" disabled={index === 0} onClick={() => onMoveExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, -1)} aria-label="Поднять упражнение"><ChevronUp size={13} /></button>
                          <button type="button" disabled={index === exercises.length - 1} onClick={() => onMoveExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, 1)} aria-label="Опустить упражнение"><ChevronDown size={13} /></button>
                        </span>
                        <span className="trainerNextExerciseImage">
                          {exercise.image || exercise.thumbnail ? (
                            <img src={exercise.image || exercise.thumbnail} alt="" />
                          ) : video ? (
                            <ProtectedExerciseVideo src={video} previewTime={exercise.videoPosterTime} muted preload="metadata" aria-hidden="true" />
                          ) : (
                            <Dumbbell size={22} />
                          )}
                        </span>
                        <button className="trainerNextExerciseName" type="button" onClick={() => setExpandedExerciseId(expanded ? "" : exercise.id)}>
                          <strong>{exercise.name || "Упражнение"}</strong>
                          <small>{video ? "Видео добавлено" : "Без видео"}</small>
                        </button>
                        <span className="trainerNextExerciseMetric"><strong>{sets.length}</strong><small>подх.</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{getExerciseSetSummary(sets, "reps")}</strong><small>повт.</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{requiresWeight ? getExerciseSetSummary(sets, "weight", " кг") : "—"}</strong><small>вес</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{exercise.rest || "90 сек"}</strong><small>отдых</small></span>
                        <div className="trainerNextExerciseActions">
                          <button type="button" onClick={() => setExpandedExerciseId(expanded ? "" : exercise.id)} aria-label="Редактировать упражнение"><EllipsisVertical size={17} /></button>
                          <button type="button" onClick={() => confirmDeleteExercise(exercise)} aria-label="Удалить упражнение"><Trash2 size={15} /></button>
                        </div>
                      </div>

                      {expanded ? (
                        <div className="trainerNextExerciseEditor">
                          <div className="trainerNextExerciseFields">
                            <div className={`wide ${trainerClientWorkoutPlanStyles.libraryNameField}`}><TrainerExerciseLibrarySearch exercise={exercise} items={exerciseLibrary}
                              onSelect={(source) => onUpdateExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, getTrainerExerciseSelectionPatch(source, exercise))}
                              onOpenLibrary={openLegacyExerciseLibrary} /></div>
                            <label>
                              <span>Отдых</span>
                              <input value={exercise.rest || ""} onChange={(event) => onUpdateExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, { rest: event.target.value })} placeholder="90 сек" />
                            </label>
                            <label className="trainerNextWeightToggle">
                              <span>Используется вес</span>
                              <input type="checkbox" checked={requiresWeight} onChange={(event) => onUpdateExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, { requiresWeight: event.target.checked, usesWeight: event.target.checked })} />
                            </label>
                            <small>Видео изменяется только в разделе «Упражнения».</small>
                          </div>
                          <div className="trainerNextSetEditor">
                            <div className="trainerNextSetEditorHead"><span>Подход</span><span>Повторы</span><span>Вес, кг</span><span /></div>
                            {sets.map((set, setIndex) => (
                              <div className="trainerNextSetRow" key={set.id || setIndex}>
                                <strong>{setIndex + 1}</strong>
                                <input value={set.reps ?? ""} onChange={(event) => onUpdateExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, setIndex, { reps: event.target.value })} />
                                <input inputMode="decimal" value={sanitizeExerciseWeightInput(set.weight) ?? ""} disabled={!requiresWeight} onChange={(event) => onUpdateExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, setIndex, sanitizeExerciseSetPatch({ weight: event.target.value }))} />
                                <button type="button" disabled={sets.length <= 1} onClick={() => onRemoveExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, setIndex)} aria-label={`Удалить подход ${setIndex + 1}`}><X size={14} /></button>
                              </div>
                            ))}
                            <button className="trainerNextAddSet" type="button" onClick={() => onAddExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id)}><Plus size={15} />Добавить подход</button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {!exercises.length ? <div className="trainerNextEmpty">В этой тренировке пока нет упражнений.</div> : null}
              </div>

              <button className="trainerProgramAddExercise" type="button" onClick={() => setLibraryPickerOpen(true)}>
                <Plus size={19} />Добавить упражнение
              </button>
            </>
          ) : (
            <div className="trainerProgramEmptyDay">
              <Dumbbell size={30} />
              <strong>В программе пока нет тренировок</strong>
              <span>Добавьте неделю и тренировочный день в дереве слева.</span>
            </div>
          )}
        </section>
      </div>
      {isDayEditorOpen ? <div className="trainerProgramDayEditorBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={() => setIsDayEditorOpen(false)} /> : null}
      <TrainerExerciseLibraryPicker open={libraryPickerOpen} items={exerciseLibrary}
        onClose={() => setLibraryPickerOpen(false)}
        onOpenLibrary={openLegacyExerciseLibrary}
        onSelect={(source) => {
          if (!activeContext) return false;
          const added = onAddExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, source);
          if (added !== false) setLibraryPickerOpen(false);
          return added;
        }} />
      {confirmAction ? (
        <TrainerConfirmDialog
          title={confirmAction.title}
          text={confirmAction.text}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      ) : null}
    </section>
  );
}

function getTrainerArchivedProgramGroups(archivedWorkouts = []) {
  const groups = new Map();

  (Array.isArray(archivedWorkouts) ? archivedWorkouts : []).forEach((workout, index) => {
    const assignmentVersion = String(
      workout?.assignedProgramUpdatedAt || workout?.assignmentVersion || workout?.assignedAt || ""
    ).trim();
    const programId = String(workout?.assignedProgramId || "").trim();
    const key = assignmentVersion
      ? `version:${assignmentVersion}`
      : programId
        ? `program:${programId}`
        : "legacy";
    const group = groups.get(key) || {
      key,
      name: workout?.assignedProgramName || "Предыдущая программа",
      workouts: []
    };
    group.workouts.push({ workout, index });
    groups.set(key, group);
  });

  return [...groups.values()].map((group) => ({
    ...group,
    workouts: [...group.workouts].sort((left, right) => (
      Number(left.workout?.order || left.workout?.sortOrder || left.index + 1) -
      Number(right.workout?.order || right.workout?.sortOrder || right.index + 1)
    ))
  }));
}

function TrainerWorkoutEditor({
  embedded = false,
  initialWorkoutId = "",
  showProgramControl = true,
  client,
  history = [],
  progressHistory = history,
  workouts = [],
  archivedWorkouts = [],
  completedWorkoutIds = [],
  exerciseLibrary,
  trainerLibraryLoadState,
  onRetryLibrary,
  programTemplates,
  selectedProgramId,
  onSelectProgram,
  onAssignProgram,
  activeWorkoutTab,
  onWorkoutTabChange,
  onOpenExerciseLibrary,
  programStatus,
  onUpdateWorkout,
  onUpdateExercise,
  onUpdateLibraryExercise,
  onRemoveLibraryExercise,
  onCreateLibraryExercise,
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onAddExercise,
  onRemoveExercise,
  onMoveExercise,
  onUploadLibraryExerciseVideo,
  exerciseVideoUploadingId,
  onAddDay,
  onDuplicateDay,
  onRemoveDay,
  onMoveDay,
  onSave
}) {
  const tab = activeWorkoutTab || "plan";
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(initialWorkoutId || workouts[0]?.id || "");
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [expandedLoadExercise, setExpandedLoadExercise] = useState(null);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryMuscle, setLibraryMuscle] = useState("");
  const [libraryShowDeleted, setLibraryShowDeleted] = useState(false);
  const [libraryEditorError, setLibraryEditorError] = useState("");
  const [libraryEditorTarget, setLibraryEditorTarget] = useState(null);
  const [libraryEditorDraft, setLibraryEditorDraft] = useState(null);
  const libraryEditorNameRef = useRef(null);
  const [libraryEditorSaving, setLibraryEditorSaving] = useState(false);
  const [libraryEditorUploading, setLibraryEditorUploading] = useState(false);
  const appleClientEditor = embedded && isTrainerV2Path(window.location.pathname);
  const WorkoutSettingsContainer = appleClientEditor ? "details" : "div";
  const canReorderDays = embedded && typeof onMoveDay === "function";
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [dayMoveAnnouncement, setDayMoveAnnouncement] = useState("");
  const [expandedArchivedProgramKeys, setExpandedArchivedProgramKeys] = useState(() => new Set());
  const completedWorkoutIdSet = useMemo(() => {
    const ids = new Set((completedWorkoutIds || []).map((id) => String(id || "")).filter(Boolean));
    const completedHistoryKeys = getTrainerCompletedWorkoutKeys(history);
    workouts.forEach((workout) => {
      if (workout?.id && isTrainerWorkoutCompleted(workout, completedHistoryKeys, { includeManualStatus: false })) {
        ids.add(String(workout.id));
      }
    });
    return ids;
  }, [completedWorkoutIds, history, workouts]);

  const validSelectedWorkoutId = workouts.some((item) => item.id === selectedWorkoutId)
    ? selectedWorkoutId
    : workouts[0]?.id || "";
  const scheduleSlots = useMemo(
    () => buildPlannedWorkoutSlots({
      workouts,
      calendar: client?.workoutCalendar || {},
      history,
      // History records are immutable. Their exact workout IDs remain valid
      // even when a later assignment refresh changes its version marker.
      completedWorkoutIds: [...completedWorkoutIdSet]
    }),
    [workouts, client?.workoutCalendar, history, completedWorkoutIdSet]
  );
  const scheduleSlotByWorkoutId = useMemo(() => {
    const map = new Map();
    scheduleSlots.forEach((slot) => {
      if (slot.workoutId) map.set(slot.workoutId, slot);
      map.set(`order:${slot.order}`, slot);
    });
    return map;
  }, [scheduleSlots]);
  const displayWorkouts = useMemo(() => workouts.map((workout, index) => {
    const slot = scheduleSlotByWorkoutId.get(String(workout?.id || "")) ||
      scheduleSlotByWorkoutId.get(`order:${index + 1}`);
    const historyStatus = slot?.status === "completed_off_date" ? "completed" : slot?.status;
    const completedByWorkoutId = completedWorkoutIdSet.has(String(workout?.id || ""));
    // A completed session keeps its immutable workoutId even if the calendar
    // assignment version was subsequently updated. The editor must not show
    // that locked, completed day as merely planned.
    const displayStatus = completedByWorkoutId
      ? "completed"
      : historyStatus && historyStatus !== "planned"
        ? historyStatus
        : workout.status || "planned";

    return {
      ...workout,
      displayStatus,
      displayCompletedDate: slot?.completedDate || "",
      displayPlannedDate: slot?.plannedDate || "",
      displayOffDate: Boolean(slot?.isCompletedOffDate)
    };
  }), [workouts, scheduleSlotByWorkoutId, completedWorkoutIdSet]);
  const selectedWorkout = displayWorkouts.find((item) => item.id === validSelectedWorkoutId) || displayWorkouts[0] || null;
  const expandedLoadExerciseKey = expandedLoadExercise != null && selectedWorkout != null && expandedLoadExercise.workoutId === selectedWorkout.id
    ? expandedLoadExercise.exerciseKey
    : selectedWorkout?.exercises?.length ? String(selectedWorkout.exercises[0].id || 0) : "";
  const selectedWorkoutReadOnly = Boolean(selectedWorkout) && completedWorkoutIdSet.has(String(selectedWorkout.id || ""));
  const archivedProgramGroups = useMemo(
    () => getTrainerArchivedProgramGroups(archivedWorkouts),
    [archivedWorkouts]
  );
  const exerciseActualProgressByName = useMemo(() => {
    const exercises = new Map();
    workouts.forEach((workout) => {
      (workout?.exercises || []).forEach((exercise) => {
        const name = String(exercise?.name || exercise?.title || exercise?.exerciseName || "").trim();
        if (name) {
          const key = `${String(exercise?.id || "").trim()}::${name.toLocaleLowerCase("ru-RU")}`;
          exercises.set(key, exercise);
        }
      });
    });
    return new Map([...exercises.entries()].map(([key, exercise]) => [
      key,
      getExerciseActualProgress(progressHistory, exercise)
    ]));
  }, [progressHistory, workouts]);
  const libraryItems = useMemo(() => mergeTrainerExerciseLibraryItems(
    exerciseLibrary || [], { includeDeleted: true }
  ), [exerciseLibrary]);
  const library = libraryItems.filter((exercise) => Boolean(exercise.libraryDeletedAt) === libraryShowDeleted);
  const libraryView = getTrainerLibraryViewState(trainerLibraryLoadState, "exercises");
  const filteredLibrary = library.filter((exercise) =>
    (!libraryMuscle || getTrainerLibraryMuscle(exercise) === libraryMuscle) &&
    (!librarySearch || String(exercise.name || "").toLowerCase().includes(librarySearch.toLowerCase()) || exerciseLibraryNameKey(exercise.name).includes(exerciseLibraryNameKey(librarySearch)))
  );
  const selectedWorkoutIndex = selectedWorkout
    ? displayWorkouts.findIndex((item) => item.id === selectedWorkout.id)
    : -1;
  const selectedWorkoutStatus = getWorkoutStatusMeta(selectedWorkout?.displayStatus || selectedWorkout?.status);
  const libraryEditorWorkout = libraryEditorTarget
    ? workouts.find((workout) => workout.id === libraryEditorTarget.workoutId)
    : null;
  const libraryEditorExercise = libraryEditorWorkout?.exercises?.find((exercise) => exercise.id === libraryEditorTarget?.exerciseId)
    || libraryItems.find((exercise) => exercise.id === libraryEditorTarget?.exerciseId && exercise.librarySource?.templateId === libraryEditorTarget?.templateId && getExerciseVideo(exercise) === getExerciseVideo(libraryEditorTarget?.exercise))
    || libraryEditorTarget?.exercise
    || null;
  const libraryEditorSourceExercise = libraryEditorExercise && libraryEditorWorkout
    ? {
      ...libraryEditorExercise,
      librarySource: { type: "plan", workoutId: libraryEditorWorkout.id },
    }
    : libraryEditorExercise;
  const activeLibraryEditorExercise = libraryEditorDraft || libraryEditorExercise;
  const libraryEditorBusy = libraryEditorSaving || libraryEditorUploading;
  const libraryEditorReadOnly = libraryEditorBusy || Boolean(activeLibraryEditorExercise?.libraryDeletedAt);
  const openExerciseLibrary = () => {
    setExercisePickerOpen(false);
    setExpandedExerciseId("");
    if (onOpenExerciseLibrary) onOpenExerciseLibrary();
    else onWorkoutTabChange?.("library");
  };

  function createLibraryEditorDraft(exercise) {
    if (!exercise) return null;
    return { ...exercise, ...exerciseCardMetadata(exercise) };
  }

  function openLibraryEditor(exercise) {
    if (!exercise) return;
    setLibraryEditorError("");
    setLibraryEditorTarget({ workoutId: exercise.sourceWorkoutId || "", exerciseId: exercise.id, templateId: exercise.librarySource?.templateId || "", exercise });
    setLibraryEditorDraft(createLibraryEditorDraft(exercise));
  }

  async function createLibraryExercise() {
    const exercise = await onCreateLibraryExercise?.(selectedProgramId, { name: "Новое упражнение" });
    if (!exercise) return;
    openLibraryEditor(exercise);
  }

  function closeLibraryEditor() {
    if (libraryEditorBusy) return;
    setLibraryEditorTarget(null);
    setLibraryEditorDraft(null);
  }

  function updateLibraryEditorExercise(patch) {
    setLibraryEditorDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function saveLibraryEditor() {
    if (!libraryEditorExercise || !libraryEditorDraft || libraryEditorBusy) return;
    if (!libraryEditorDraft.name?.trim()) {
      setLibraryEditorError("Укажите название упражнения.");
      libraryEditorNameRef.current?.focus();
      return;
    }
    setLibraryEditorSaving(true);
    setLibraryEditorError("");
    const patch = exerciseCardMetadata(libraryEditorDraft);
    try {
      const saved = await onUpdateLibraryExercise?.(libraryEditorSourceExercise, patch);
      if (saved === true) {
        setLibraryEditorTarget(null);
        setLibraryEditorDraft(null);
      } else setLibraryEditorError("Не удалось сохранить упражнение. Попробуйте ещё раз.");
    } catch (error) {
      setLibraryEditorError(getTrainerActionErrorStatus(error,
        (!error?.code && error?.message) || "Не удалось сохранить упражнение. Проверьте соединение и попробуйте ещё раз."
      ));
    } finally {
      setLibraryEditorSaving(false);
    }
  }

  async function removeLibraryEditor(restore = false) {
    if (!libraryEditorExercise || libraryEditorBusy) return;
    setLibraryEditorSaving(true);
    setLibraryEditorError("");
    try {
      const removed = await onRemoveLibraryExercise?.(libraryEditorSourceExercise, { restore });
      if (removed === true) {
        setLibraryEditorTarget(null);
        setLibraryEditorDraft(null);
      } else setLibraryEditorError("Не удалось изменить упражнение. Попробуйте ещё раз.");
    } catch (error) {
      setLibraryEditorError(error?.code === "permission-denied"
        ? "Нет доступа. Тренер может удалять только свои упражнения."
        : "Не удалось изменить упражнение. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setLibraryEditorSaving(false);
    }
  }

  function confirmRemoveLibraryEditor() {
    if (!libraryEditorExercise) return;
    setConfirmAction({
      title: "Удалить упражнение",
      text: `Упражнение «${libraryEditorExercise.name || "Без названия"}» переместится в «Удалённые». Этот вариант видео можно восстановить. Упражнения в программах и истории клиентов сохранятся.`,
      onConfirm: () => {
        setConfirmAction(null);
        void removeLibraryEditor();
      }
    });
  }

  async function uploadLibraryEditorVideo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !libraryEditorExercise || libraryEditorBusy) return;
    setLibraryEditorUploading(true);
    setLibraryEditorError("");
    try {
      const url = await onUploadLibraryExerciseVideo?.(libraryEditorSourceExercise, file);
      if (typeof url === "string" && url) {
        updateLibraryEditorExercise({ video: url, videoAutoFilledFrom: "", videoCrop: null, videoPosterTime: null });
      } else {
        setLibraryEditorError("Не удалось загрузить видео. Проверьте соединение и попробуйте ещё раз.");
      }
    } catch {
      setLibraryEditorError("Не удалось загрузить видео. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setLibraryEditorUploading(false);
    }
  }

  function moveWorkoutDay(workoutId, direction) {
    const target = getTrainerWorkoutDayMoveTarget(displayWorkouts, workoutId, direction, completedWorkoutIdSet);
    if (target < 0 || onMoveDay?.(workoutId, direction) === false) return;
    setDayMoveAnnouncement(`День перемещён на позицию ${target + 1} из ${displayWorkouts.length}. Изменения применятся после сохранения программы.`);
  }

  function duplicateWorkoutDay(workoutId) {
    const copiedWorkoutId = onDuplicateDay(workoutId);
    if (typeof copiedWorkoutId === "string") {
      setSelectedWorkoutId(copiedWorkoutId);
      setExpandedExerciseId("");
      setDayMoveAnnouncement("Копия добавлена в конец программы как новая запланированная тренировка. Изменения применятся после сохранения программы.");
    }
  }

  function confirmRemoveWorkout(workout) {
    if (!workout || completedWorkoutIdSet.has(String(workout.id || ""))) return;
    setConfirmAction({
      title: "Удалить тренировку",
      text: `Тренировка «${getWorkoutTitle(workout, selectedWorkoutIndex)}» будет удалена из программы клиента.`,
      onConfirm: () => {
        const removed = onRemoveDay?.(workout.id);
        if (removed === false) return;
        setExpandedExerciseId("");
        setConfirmAction(null);
      }
    });
  }

  function confirmRemoveExercise(exercise, exerciseIndex) {
    if (!selectedWorkout || !exercise || selectedWorkoutReadOnly) return;
    setConfirmAction({
      title: "Удалить из тренировки?",
      text: `Упражнение «${exercise.name || "Без названия"}» будет удалено только из текущей тренировки. Библиотека и история выполненных тренировок не изменятся.`,
      confirmLabel: "Удалить из тренировки",
      onConfirm: () => {
        const removed = onRemoveExercise?.(selectedWorkout.id, exercise.id, exerciseIndex);
        if (removed === false) return;
        if (expandedExerciseId === exercise.id) setExpandedExerciseId("");
        setConfirmAction(null);
      }
    });
  }

  return (
    <div className={embedded ? `trainerNextEmbeddedPlan trainerNextWorkoutPage${appleClientEditor ? ` ${clientProgramEditorStyles.workspace}` : ""}` : `trainerNextPage trainerNextWorkoutPage${tab === "library" ? " trainerNextLibraryPage" : ""}`}>
      {!embedded ? <div className="trainerNextDesktopPageHead">
        <div><h1>{tab === "library" ? "Упражнения" : "План тренировок"}</h1><p>{tab === "library" ? "Единая библиотека для программ и планов клиентов" : client ? `Клиент: ${client.name || client.email}` : "Выберите клиента"}</p></div>
        {tab === "plan" ? (
          <div className="trainerNextHeadActions">
            <button type="button" onClick={() => setPreviewOpen(true)}><Eye size={17} />Предпросмотр</button>
            <button className="trainerNextPrimary" type="button" onClick={onSave}><Save size={17} />Сохранить</button>
          </div>
        ) : null}
      </div> : null}
      {!embedded ? <header className="trainerNextMobileHeader">
        <h1 className="trainerNextMobileTitle">{tab === "library" ? "Упражнения" : "План тренировок"}</h1>
        {tab === "plan" ? <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Предпросмотр"><Eye size={21} /></button> : <span />}
      </header> : null}

      {tab === "plan" ? (
        <>
        {showProgramControl ? <section className="trainerNextProgramControl">
          <div>
            <ClipboardList size={19} />
            <span>
              <small>Назначенная программа</small>
              <strong>{client?.assignedProgramName || "Индивидуальный план"}</strong>
            </span>
          </div>
          <label>
            <span>Загрузить программу клиенту</span>
            <select aria-label="Загрузить программу клиенту" value={selectedProgramId || ""} onChange={(event) => onSelectProgram(event.target.value)}>
              <option value="">Выберите из библиотеки</option>
              {(programTemplates || [])
                .filter((program) => getTrainerProgramStatusMeta(program).id !== TRAINER_PROGRAM_STATUSES.DRAFT)
                .map((program) => (
                <option value={program.id} key={program.id}>{program.name || "Без названия"}</option>
                ))}
            </select>
          </label>
          <button type="button" disabled={!selectedProgramId || !client} onClick={onAssignProgram}>
            <Check size={16} />Назначить
          </button>
        </section> : null}
        {showProgramControl && programStatus ? <p className="trainerNextProgramStatus">{programStatus}</p> : null}
        <p className={trainerClientWorkoutPlanStyles.dayReorderAnnouncement} role="status" aria-live="polite" aria-atomic="true">{dayMoveAnnouncement}</p>
        <div className="trainerNextWorkoutLayout">
          <aside className="trainerNextWorkoutDays">
            {appleClientEditor ? <h2 className="clientEditorDaysTitle">Дни программы <small>{displayWorkouts.length}</small></h2> : null}
            {displayWorkouts.map((workout, index) => {
              const isActive = selectedWorkout?.id === workout.id;
              const visualStatus = workout.displayStatus || workout.status || "planned";
              const statusMeta = getWorkoutStatusMeta(visualStatus);
              const statusClass = visualStatus;
              const isReadOnly = completedWorkoutIdSet.has(String(workout.id || ""));
              return (
                <div className={`trainerNextWorkoutDayItem ${statusClass}${isActive ? " active" : ""}${canReorderDays && isActive ? ` ${trainerClientWorkoutPlanStyles.dayReorderItem}` : ""}`} key={workout.id || index}>
                  <button type="button" className="trainerNextWorkoutDaySelect" aria-pressed={isActive} onClick={() => setSelectedWorkoutId(workout.id)}>
                    <strong>
                      {appleClientEditor ? getWorkoutTitle(workout, index) : `День ${index + 1}`}
                      {visualStatus === "completed" ? <span className="trainerWorkoutDayDoneMark" aria-label="Выполнена">✓</span> : null}
                      {visualStatus !== "completed" && index === 0 ? <CalendarDays size={14} /> : null}
                    </strong>
                    {appleClientEditor ? null : <small>{getWorkoutTitle(workout, index).replace(/^День\s*\d+\s*[-–—:]?\s*/i, "") || "Тренировка"}</small>}
                    <em>{workout.exercises?.length || 0} упр.</em>
                    <i>{isTrainerV2Path(window.location.pathname) ? null : statusMeta.icon} {statusMeta.label}</i>
                  </button>
                  {appleClientEditor && isActive ? <button className={clientProgramEditorStyles.dayCopyButton} type="button" onClick={() => duplicateWorkoutDay(workout.id)} aria-label="Копировать тренировку" title="Копировать как новую тренировку"><Copy size={17} aria-hidden="true" /></button> : null}
                  {isActive ? (
                    <div className={`trainerNextWorkoutDayActions${canReorderDays ? ` ${trainerClientWorkoutPlanStyles.dayReorderActions}` : ""}`}>
                      {canReorderDays ? <>
                        <button type="button" disabled={getTrainerWorkoutDayMoveTarget(displayWorkouts, workout.id, 1, completedWorkoutIdSet) < 0} onClick={() => moveWorkoutDay(workout.id, 1)} aria-label="Переместить день вниз" title="Переместить день вниз"><ChevronDown size={18} aria-hidden="true" /></button>
                        <button type="button" disabled={getTrainerWorkoutDayMoveTarget(displayWorkouts, workout.id, -1, completedWorkoutIdSet) < 0} onClick={() => moveWorkoutDay(workout.id, -1)} aria-label="Переместить день вверх" title="Переместить день вверх"><ChevronUp size={18} aria-hidden="true" /></button>
                      </> : null}
                      {!appleClientEditor ? <button type="button" onClick={() => duplicateWorkoutDay(workout.id)} aria-label="Копировать тренировку" title="Копировать как новую тренировку"><Copy size={13} aria-hidden="true" /></button> : null}
                      <button type="button" disabled={isReadOnly} onClick={() => confirmRemoveWorkout(workout)} aria-label="Удалить тренировку" title="Удалить"><Trash2 size={13} aria-hidden="true" /></button>
                    </div>
                  ) : null}
                </div>
                );
              })}
            {archivedProgramGroups.map((group) => {
              const expanded = expandedArchivedProgramKeys.has(group.key);
              return (
                <section className={`trainerNextArchivedProgram${expanded ? " expanded" : ""}`} key={group.key}>
                  <button
                    className="trainerNextArchivedProgramToggle"
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedArchivedProgramKeys((current) => {
                      const next = new Set(current);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    })}
                  >
                    <span>
                      <small>ПРЕДЫДУЩАЯ ПРОГРАММА</small>
                      <strong>{group.name}</strong>
                      <em>{group.workouts.length} {pluralize(group.workouts.length, "тренировка", "тренировки", "тренировок")} · только просмотр</em>
                    </span>
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <div className="trainerNextArchivedWorkoutList">
                      {group.workouts.map(({ workout }, index) => {
                        const status = getWorkoutStatusMeta(workout?.status || "planned");
                        return (
                          <div key={workout?.id || `${group.key}-${index}`}>
                            <strong>День {index + 1}</strong>
                            <span>{getWorkoutTitle(workout, index).replace(/^День\s*\d+\s*[-–—:]?\s*/i, "") || "Тренировка"}</span>
                            <small>{workout?.exercises?.length || 0} упр. · {status.label}</small>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
            <button className="add" type="button" onClick={onAddDay}><Plus size={17} />Добавить день</button>
          </aside>
          <section className="trainerNextExercisePanel">
            {appleClientEditor ? <label className={clientProgramEditorStyles.daySelectLabel} htmlFor="client-program-day">Тренировочный день</label> : null}
            {appleClientEditor ? <div className="clientEditorMobileDays"><select id="client-program-day" aria-label="День программы" value={selectedWorkout?.id || ""} onChange={(event) => { setSelectedWorkoutId(event.target.value); setExpandedExerciseId(""); }}>{displayWorkouts.map((workout, index) => <option key={workout.id} value={workout.id}>{getWorkoutTitle(workout, index)} · {getWorkoutStatusMeta(workout.displayStatus || workout.status || "planned").label}</option>)}</select><button type="button" onClick={onAddDay} aria-label="Добавить день"><Plus size={18} /></button></div> : null}
            {selectedWorkout ? (
              <>
              {appleClientEditor ? <div className={clientProgramEditorStyles.dayHeader}>
                <h3 className={clientProgramEditorStyles.dayHeading}>{getWorkoutTitle(selectedWorkout, selectedWorkoutIndex)}</h3>
                <p className={clientProgramEditorStyles.dayMeta}>
                  {selectedWorkout.exercises?.length || 0} {pluralize(selectedWorkout.exercises?.length || 0, "упражнение", "упражнения", "упражнений")} · {selectedWorkoutStatus.label}
                </p>
                <button className={clientProgramEditorStyles.mobileDayCopyButton} type="button" onClick={() => duplicateWorkoutDay(selectedWorkout.id)} aria-label="Копировать тренировку" title="Копировать как новую тренировку"><Copy size={18} aria-hidden="true" /></button>
              </div> : null}
              {appleClientEditor ? <div className={`clientEditorMobileActions${canReorderDays ? ` ${trainerClientWorkoutPlanStyles.dayReorderMobile}` : ""}`}>
                {canReorderDays ? <>
                  <button type="button" disabled={getTrainerWorkoutDayMoveTarget(displayWorkouts, selectedWorkout.id, 1, completedWorkoutIdSet) < 0} onClick={() => moveWorkoutDay(selectedWorkout.id, 1)} aria-label="Переместить день вниз"><ChevronDown size={16} aria-hidden="true" />Ниже</button>
                  <button type="button" disabled={getTrainerWorkoutDayMoveTarget(displayWorkouts, selectedWorkout.id, -1, completedWorkoutIdSet) < 0} onClick={() => moveWorkoutDay(selectedWorkout.id, -1)} aria-label="Переместить день вверх"><ChevronUp size={16} aria-hidden="true" />Выше</button>
                </> : null}
                <button type="button" disabled={selectedWorkoutReadOnly} onClick={() => confirmRemoveWorkout(selectedWorkout)} aria-label="Удалить тренировку" title="Удалить тренировку"><Trash2 size={16} aria-hidden="true" /></button>
              </div> : null}
              <WorkoutSettingsContainer key={selectedWorkout.id} className={appleClientEditor ? clientProgramEditorStyles.daySettings : undefined}>
              {appleClientEditor ? <summary className={clientProgramEditorStyles.daySettingsSummary}>Параметры дня <ChevronDown size={17} aria-hidden="true" /></summary> : null}
              <div className="trainerNextWorkoutName">
                <label>
                  <span>Название тренировки</span>
                  <input
                    value={getWorkoutTitle(selectedWorkout, selectedWorkoutIndex)}
                    disabled={selectedWorkoutReadOnly}
                    onChange={(event) => onUpdateWorkout(selectedWorkout.id, { name: event.target.value })}
                  />
                </label>
                <small>{selectedWorkout.exercises?.length || 0} упражнений</small>
              </div>
              <div className="trainerWorkoutStatusPanel">
                <label>
                  <span>Статус тренировки</span>
                  <select
                    aria-label="Статус тренировки"
                    value={selectedWorkout.displayStatus || selectedWorkout.status || "planned"}
                    disabled={selectedWorkoutReadOnly}
                    onChange={(event) => onUpdateWorkout(selectedWorkout.id, {
                      status: event.target.value,
                      statusUpdatedAt: new Date().toISOString(),
                      ...(event.target.value === "moved" ? {} : { movedToDate: "" })
                    })}
                  >
                    {WORKOUT_STATUS_OPTIONS.map((option) => (
                      <option value={option.id} key={option.id}>{isTrainerV2Path(window.location.pathname) ? null : option.icon} {option.label}</option>
                    ))}
                  </select>
                </label>
                <span>{selectedWorkoutStatus.icon} {selectedWorkoutStatus.label}</span>
                {(selectedWorkout.displayStatus || selectedWorkout.status) === "moved" ? (
                  <label>
                    <span>Новая дата</span>
                    <input type="date" value={selectedWorkout.movedToDate || ""} disabled={selectedWorkoutReadOnly} onChange={(event) => onUpdateWorkout(selectedWorkout.id, { movedToDate: event.target.value, status: "moved" })} />
                  </label>
                ) : null}
              </div>
              </WorkoutSettingsContainer>
              {selectedWorkoutReadOnly ? <p className="trainerNextWorkoutReadOnlyHint">Выполненная тренировка доступна только для просмотра. Её можно скопировать как новую тренировку.</p> : null}
              </>
            ) : <h2>Добавьте тренировочный день</h2>}
            <div className="trainerNextExerciseHead" aria-hidden="true">
              <span /><span /><span>Упражнение</span>
              <span className="trainerNextExerciseStatsHead"><span>Подходы</span><span>Повторения</span><span>Вес</span><span>Отдых</span></span>
              <span className="trainerNextExerciseProgressHead">Прогресс</span>
              <span />
            </div>
            <div className={`trainerNextExerciseList${appleClientEditor ? ` ${clientProgramEditorStyles.exerciseList}` : ""}`}>
              {(selectedWorkout?.exercises || []).map((exercise, index) => {
                const sets = Array.isArray(exercise.sets) && exercise.sets.length
                  ? exercise.sets
                  : [{ reps: "", weight: "" }];
                const isExpanded = expandedExerciseId === exercise.id;
                const requiresWeight = exercise.requiresWeight ?? exercise.usesWeight ?? true;
                const video = getExerciseVideo(exercise);
                const progress = exerciseActualProgressByName.get(
                  `${String(exercise?.id || "").trim()}::${String(exercise?.name || exercise?.title || exercise?.exerciseName || "").trim().toLocaleLowerCase("ru-RU")}`
                );
                const hasExerciseHistory = Boolean(progress?.lastSession);
                const hasComparison = Number(progress?.sessionCount || 0) >= 2;
                const progressTitle = hasExerciseHistory
                  ? `Последнее выполнение: ${formatTrainerExerciseSession(progress.lastSession)}`
                  : client?.trainerHistoryLoadError
                    ? "Не удалось загрузить историю выполнения"
                  : Number(progress?.matchedHistoryCount || 0) > 0
                    ? "Запись есть, но рабочие подходы не сохранены"
                    : "Истории выполнения пока нет";
                const progressComparison = `${formatTrainerExerciseComparison(progress)}${hasComparison && progress?.previousSession?.date ? ` · к ${formatCompactDate(progress.previousSession.date)}` : ""}`;
                const estimatedOneRepMax = formatTrainerEstimatedOneRepMax(progress?.lastSession);
                return (
                  <article className={`${isExpanded ? "expanded" : ""}${appleClientEditor ? ` ${clientProgramEditorStyles.exerciseArticle}` : ""}`} key={`${selectedWorkout?.id || ""}:${exercise.id || index}`}>
                    {appleClientEditor ? <TrainerClientProgramExerciseCard
                      exercise={exercise}
                      index={index}
                      expanded={expandedLoadExerciseKey === String(exercise.id || index)}
                      onToggle={() => setExpandedLoadExercise({
                        workoutId: selectedWorkout.id,
                        exerciseKey: expandedLoadExerciseKey === String(exercise.id || index) ? "" : String(exercise.id || index)
                      })}
                      readOnly={selectedWorkoutReadOnly}
                      video={video}
                      progressTitle={progressTitle}
                      progressDetails={hasExerciseHistory ? [estimatedOneRepMax, progressComparison].filter(Boolean).join(" · ") : ""}
                      hasHistory={hasExerciseHistory}
                      historyLoadError={Boolean(client?.trainerHistoryLoadError)}
                      onChange={(patch) => onUpdateExercise(selectedWorkout.id, exercise.id, patch)}
                      onDetails={() => {
                        setExpandedLoadExercise({ workoutId: selectedWorkout.id, exerciseKey: String(exercise.id || index) });
                        setExpandedExerciseId(exercise.id);
                      }}
                      onMoveUp={() => onMoveExercise(selectedWorkout.id, exercise.id, -1)}
                      onMoveDown={() => onMoveExercise(selectedWorkout.id, exercise.id, 1)}
                      canMoveUp={!selectedWorkoutReadOnly && index > 0}
                      canMoveDown={!selectedWorkoutReadOnly && index < selectedWorkout.exercises.length - 1}
                      onDelete={() => confirmRemoveExercise(exercise, index)}
                    /> : <div className="trainerNextExerciseRow">
                      <span className="trainerNextExerciseMove">
                        <GripVertical size={15} />
                        <button type="button" disabled={selectedWorkoutReadOnly || index === 0} onClick={() => onMoveExercise(selectedWorkout.id, exercise.id, -1)} aria-label="Поднять упражнение"><ChevronUp size={13} /></button>
                        <button type="button" disabled={selectedWorkoutReadOnly || index === selectedWorkout.exercises.length - 1} onClick={() => onMoveExercise(selectedWorkout.id, exercise.id, 1)} aria-label="Опустить упражнение"><ChevronDown size={13} /></button>
                      </span>
                      <span className="trainerNextExerciseImage">
                        {exercise.image || exercise.thumbnail ? (
                          <img src={exercise.image || exercise.thumbnail} alt="" />
                        ) : video ? (
                          <ProtectedExerciseVideo src={video} previewTime={exercise.videoPosterTime} muted preload="metadata" aria-hidden="true" />
                        ) : (
                          <Dumbbell size={22} />
                        )}
                      </span>
                      <button className="trainerNextExerciseName" type="button" onClick={() => setExpandedExerciseId(isExpanded ? "" : exercise.id)}>
                        <strong>{exercise.name || "Упражнение"}</strong>
                        <span className="trainerNextExerciseMeta">
                          <small>{video ? "Видео добавлено" : "Без видео"}</small>
                        </span>
                      </button>
                      <span className="trainerNextExerciseStats">
                        {appleClientEditor ? <TrainerExerciseQuickFields key={exercise.id} exercise={exercise} disabled={selectedWorkoutReadOnly} onChange={(patch) => onUpdateExercise(selectedWorkout.id, exercise.id, patch)} onDetails={() => setExpandedExerciseId(exercise.id)} /> : <>
                        <span className="trainerNextExerciseMetric"><strong>{sets.length}</strong><small>подх.</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{getExerciseSetSummary(sets, "reps")}</strong><small>повт.</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{requiresWeight ? getExerciseSetSummary(sets, "weight", " кг") : "—"}</strong><small>вес</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{exercise.rest || "90 сек"}</strong><small>отдых</small></span>
                        </>}
                      </span>
                      <span className={`trainerNextExerciseProgress${hasComparison ? " hasComparison" : " needsHistory"}`} title={hasComparison ? progressComparison : "Для сравнения нужны две выполненные тренировки с этим упражнением"}>
                        <strong>{progressTitle}</strong>
                        {hasExerciseHistory ? <small>{[estimatedOneRepMax, progressComparison].filter(Boolean).join(" · ")}</small> : null}
                      </span>
                      <div className="trainerNextExerciseActions">
                        <button type="button" onClick={() => setExpandedExerciseId(isExpanded ? "" : exercise.id)} title={isExpanded ? "Свернуть упражнение" : "Редактировать упражнение"} aria-label={isExpanded ? "Свернуть упражнение" : "Редактировать упражнение"}>{isExpanded ? <ChevronUp size={17} /> : <Pencil size={17} />}</button>
                        <button type="button" disabled={selectedWorkoutReadOnly} onClick={() => confirmRemoveExercise(exercise, index)} aria-label="Удалить из тренировки"><Trash2 size={15} /></button>
                      </div>
                    </div>}

                    {isExpanded ? (
                      <TrainerClientExerciseSheet enabled={appleClientEditor} onClose={() => setExpandedExerciseId("")}
                        exercise={exercise} video={video} libraryItems={libraryItems} readOnly={selectedWorkoutReadOnly}
                        onSelectExercise={source => onUpdateExercise(selectedWorkout.id, exercise.id, getTrainerExerciseSelectionPatch(source, exercise))}
                        onOpenLibrary={openExerciseLibrary}
                        onUpdate={patch => onUpdateExercise(selectedWorkout.id, exercise.id, patch)}
                        onUpdateSet={(setIndex, patch) => onUpdateExerciseSet(selectedWorkout.id, exercise.id, setIndex, patch)}
                        onAddSet={() => onAddExerciseSet(selectedWorkout.id, exercise.id)}
                        onRemoveSet={setIndex => onRemoveExerciseSet(selectedWorkout.id, exercise.id, setIndex)}
                        onDelete={() => { setExpandedExerciseId(""); confirmRemoveExercise(exercise, index); }}>
                      <div className="trainerNextExerciseEditor">
                        <div className="trainerNextExerciseFields">
                          <div className={`wide ${trainerClientWorkoutPlanStyles.libraryNameField}`}><TrainerExerciseLibrarySearch
                            key={`${exercise.id}:${exercise.name}`}
                            exercise={exercise}
                            items={libraryItems}
                            disabled={selectedWorkoutReadOnly}
                            onSelect={(source) => onUpdateExercise(selectedWorkout.id, exercise.id, getTrainerExerciseSelectionPatch(source, exercise))}
                            onOpenLibrary={openExerciseLibrary}
                          /></div>
                          <label><span>Отдых</span><input value={exercise.rest || ""} disabled={selectedWorkoutReadOnly} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { rest: event.target.value })} placeholder="90 сек" /></label>
                          <label className="trainerNextWeightToggle">
                            <span>Используется вес</span>
                            <input type="checkbox" checked={requiresWeight} disabled={selectedWorkoutReadOnly} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { requiresWeight: event.target.checked, usesWeight: event.target.checked })} />
                          </label>
                        </div>

                        {appleClientEditor ? <section className="clientEditorVideo" aria-label="Видео упражнения">{video ? <><span>Текущее видео</span><ProtectedExerciseVideo key={video} src={video} previewTime={exercise.videoPosterTime} poster={exercise.image || exercise.thumbnail || undefined} controls playsInline preload="metadata" aria-label={`Видео: ${exercise.name || "упражнение"}`} data-testid="trainer-program-exercise-video" /></> : null}<small>Видео можно изменить в библиотеке упражнений.</small></section> : null}
                        <div className="trainerNextSetEditor">
                          <div className="trainerNextSetEditorHead"><span>Подход</span><span>Повторы</span><span>Вес, кг</span><span /></div>
                          {sets.map((set, setIndex) => (
                            <div className="trainerNextSetRow" key={set.id || setIndex}>
                              <strong>{setIndex + 1}</strong>
                              <input aria-label={`Повторы, подход ${setIndex + 1}`} value={set.reps ?? ""} disabled={selectedWorkoutReadOnly} onChange={(event) => onUpdateExerciseSet(selectedWorkout.id, exercise.id, setIndex, { reps: event.target.value })} />
                              <input aria-label={`Вес, подход ${setIndex + 1}`} inputMode="decimal" value={sanitizeExerciseWeightInput(set.weight) ?? ""} disabled={selectedWorkoutReadOnly || !requiresWeight} onChange={(event) => onUpdateExerciseSet(selectedWorkout.id, exercise.id, setIndex, sanitizeExerciseSetPatch({ weight: event.target.value }))} />
                              <button type="button" disabled={selectedWorkoutReadOnly || sets.length <= 1} onClick={() => onRemoveExerciseSet(selectedWorkout.id, exercise.id, setIndex)} aria-label={`Удалить подход ${setIndex + 1}`}><X size={14} /></button>
                            </div>
                          ))}
                          <button className="trainerNextAddSet" type="button" disabled={selectedWorkoutReadOnly} onClick={() => onAddExerciseSet(selectedWorkout.id, exercise.id)}><Plus size={15} />Добавить подход</button>
                        </div>
                      </div>
                      {appleClientEditor ? <button className="clientSheetDelete" type="button" disabled={selectedWorkoutReadOnly} onClick={() => { setExpandedExerciseId(""); confirmRemoveExercise(exercise, index); }}><Trash2 size={16} />Удалить из тренировки</button> : null}
                      </TrainerClientExerciseSheet>
                    ) : null}
                  </article>
                );
              })}
              {!selectedWorkout?.exercises?.length ? <div className="trainerNextEmpty">В тренировке пока нет упражнений.</div> : null}
            </div>
            <button
              className="trainerNextOutlineAdd"
              type="button"
              disabled={!selectedWorkout || selectedWorkoutReadOnly}
              onClick={() => {
                if (!selectedWorkout) return;
                setExercisePickerOpen(true);
              }}
            >
              <Plus size={18} />Добавить упражнение
            </button>
          </section>
        </div>
        </>
      ) : (
        <section className={`trainerNextLibrary ${mobileStyles.libraryFix}`}>
          <div className="trainerNextPanelTitle">
            <div><h2>{libraryShowDeleted ? "Удалённые упражнения" : "Мои упражнения"} {libraryView.complete || library.length ? <span className={primaryScreensStyles.count}>{library.length}</span> : null}</h2><p>Видео и техника — здесь. Вес и подходы — в программе.</p></div>
            <div className="trainerNextLibraryActions">
              <label className="trainerNextSearch open"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Поиск упражнений" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Название упражнения" /></label>
              <button
                className="trainerNextLibraryAdd"
                type="button"
                disabled={typeof onCreateLibraryExercise !== "function" || (!libraryView.complete && !library.length)}
                onClick={createLibraryExercise}
                aria-label="Создать новое упражнение"
              >
                <Plus size={16} aria-hidden="true" />Создать
              </button>
            </div>
          </div>
          <div className={`${exerciseLibraryEditorStyles.libraryFilters} ${primaryScreensStyles.libraryFilterRow}`}>
          <label className={appleStyles.libraryMuscleFilter}>
            <span>Группа мышц</span>
            <select aria-label="Группа мышц" value={libraryMuscle} onChange={(event) => setLibraryMuscle(event.target.value)}>
              <option value="">Все группы{libraryView.complete ? ` · ${library.length}` : ""}</option>
              {TRAINER_LIBRARY_MUSCLES.map(([id, label]) => <option value={id} key={id}>{label}{libraryView.complete ? ` · ${library.filter((exercise) => getTrainerLibraryMuscle(exercise) === id).length}` : ""}</option>)}
            </select>
          </label>
          <button type="button" className={exerciseLibraryEditorStyles.deletedToggle} aria-pressed={libraryShowDeleted} onClick={() => { setLibraryShowDeleted((current) => !current); setLibraryMuscle(""); }}>
            {libraryShowDeleted ? "К библиотеке" : `Удалённые${libraryView.complete ? ` · ${libraryItems.filter((exercise) => exercise.libraryDeletedAt).length}` : ""}`}
          </button>
          </div>
          <TrainerLibraryLoadNotice state={trainerLibraryLoadState} kind="exercises" hasItems={libraryItems.length > 0} onRetry={onRetryLibrary} />
          {libraryView.complete || libraryItems.length ? <div className={primaryScreensStyles.libraryResultCount} role="status">Показано: {filteredLibrary.length}{libraryView.complete ? ` из ${library.length}` : ""}</div> : null}
          <div className={primaryScreensStyles.libraryResults} aria-busy={libraryView.loading}>
            {filteredLibrary.map((exercise, index) => {
              const video = getExerciseVideo(exercise);
              return (
                <article
                  className={primaryScreensStyles.libraryCard}
                  key={`${exercise.id || exercise.name}_${index}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Редактировать упражнение ${exercise.name || ""}`}
                  onClick={() => openLibraryEditor(exercise)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openLibraryEditor(exercise);
                  }}
                >
                  <TrainerLibraryExercisePreview video={video} previewTime={exercise.videoPosterTime} poster={exercise.image || exercise.thumbnail} />
                  <div><strong>{exercise.name}</strong><small>{TRAINER_LIBRARY_MUSCLES.find(([id]) => id === getTrainerLibraryMuscle(exercise))?.[1] || "Без группы"} · {video ? "С видео" : "Без видео"}{exercise.technique ? " · Техника" : ""}</small></div>
                  <ChevronRight size={17} aria-hidden="true" />
                </article>
              );
            })}
            {libraryView.complete && !filteredLibrary.length ? <div className="trainerNextEmpty">{librarySearch || libraryMuscle ? "Ничего не найдено. Измените название или группу мышц." : libraryShowDeleted ? "Удалённых упражнений пока нет." : "В библиотеке пока нет упражнений. Создайте первое кнопкой выше."}</div> : null}
          </div>
        </section>
      )}

      {exercisePickerOpen && selectedWorkout && !selectedWorkoutReadOnly ? <TrainerExerciseLibraryPicker
        open
        items={libraryItems}
        onClose={() => setExercisePickerOpen(false)}
        onOpenLibrary={openExerciseLibrary}
        onSelect={(source) => {
          const added = onAddExercise(selectedWorkout.id, source);
          if (added === false) return false;
          setExercisePickerOpen(false);
          return added;
        }}
      /> : null}

      {activeLibraryEditorExercise ? (
        <div className={`trainerNextModalBackdrop ${exerciseLibraryEditorStyles.backdrop}`} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeLibraryEditor()}>
          <section className={exerciseLibraryEditorStyles.modal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-library-editor-title">
            <button type="button" className={exerciseLibraryEditorStyles.close} onClick={closeLibraryEditor} disabled={libraryEditorBusy} aria-label="Закрыть редактор упражнения"><X size={18} /></button>
            <header className={exerciseLibraryEditorStyles.header} data-trainer-modal-header="true">
              <small>БИБЛИОТЕКА УПРАЖНЕНИЙ</small>
              <h2 id="trainer-library-editor-title">Редактирование упражнения</h2>
              <p>{activeLibraryEditorExercise.libraryDeletedAt ? "Удалено из библиотеки. Упражнение можно восстановить." : "Обновляется в связанных программах. Нагрузка и история не меняются."}</p>
            </header>
            <div className={exerciseLibraryEditorStyles.body} data-trainer-modal-content="true">
              <fieldset className={exerciseLibraryEditorStyles.group}>
                <legend>Основное</legend>
                <div className={exerciseLibraryEditorStyles.fields}>
                <label><span>Название</span><input ref={libraryEditorNameRef} maxLength={200} aria-describedby={libraryEditorError ? "trainer-library-editor-error" : undefined} aria-invalid={Boolean(libraryEditorError && !activeLibraryEditorExercise.name?.trim())} value={activeLibraryEditorExercise.name || ""} onChange={(event) => updateLibraryEditorExercise({ name: event.target.value })} disabled={libraryEditorReadOnly} /></label>
                <label>
                  <span>Группа мышц</span>
                  <select aria-label="Группа мышц" value={getTrainerLibraryMuscle(activeLibraryEditorExercise)} onChange={(event) => updateLibraryEditorExercise({ muscleGroup: event.target.value })} disabled={libraryEditorReadOnly}>
                    {TRAINER_LIBRARY_MUSCLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                </div>
              </fieldset>
              <section className={exerciseLibraryEditorStyles.mediaGroup} aria-labelledby="trainer-library-media-title">
                <div className={exerciseLibraryEditorStyles.sectionHeading}>
                  <h3 id="trainer-library-media-title">Видео и превью</h3>
                  <p>Кадрирование — область видео. Превью — обложка до нажатия Play.</p>
                </div>
                {getExerciseVideo(activeLibraryEditorExercise) ? (
                  <ExerciseVideoCropEditor key={getExerciseVideo(activeLibraryEditorExercise)} src={getExerciseVideo(activeLibraryEditorExercise)}
                    value={activeLibraryEditorExercise.videoCrop} disabled={libraryEditorReadOnly}
                    posterTime={activeLibraryEditorExercise.videoPosterTime}
                    onPosterChange={videoPosterTime => updateLibraryEditorExercise({ videoPosterTime })}
                    onChange={videoCrop => updateLibraryEditorExercise({ videoCrop })} />
                ) : (
                  <div className={exerciseLibraryEditorStyles.videoPreview} aria-label="Предпросмотр видео упражнения">
                    <div className={exerciseLibraryEditorStyles.videoPreviewEmpty}>
                      <Upload size={20} aria-hidden="true" />
                      <strong>Видео ещё не добавлено</strong>
                      <span>Добавьте видео с техникой выполнения.</span>
                    </div>
                  </div>
                )}
                <label className={exerciseLibraryEditorStyles.videoUpload}>
                  <Upload size={16} aria-hidden="true" />
                  <span>{libraryEditorUploading || exerciseVideoUploadingId === libraryEditorExercise.id ? "Загружаем видео…" : getExerciseVideo(activeLibraryEditorExercise) ? "Заменить видео" : "Загрузить видео"}</span>
                  <input type="file" accept="video/*" disabled={libraryEditorReadOnly || exerciseVideoUploadingId === libraryEditorExercise.id} onChange={uploadLibraryEditorVideo} />
                </label>
              </section>
              <div className={exerciseLibraryEditorStyles.techniqueGroup}>
                <label htmlFor="trainer-library-technique">Техника выполнения <span>Необязательно</span></label>
                <p id="trainer-library-technique-hint">Инструкция для клиента: положение тела, движение и важные детали.</p>
                <textarea id="trainer-library-technique" aria-label="Техника выполнения" aria-describedby="trainer-library-technique-hint" maxLength={12000} rows={3} value={activeLibraryEditorExercise.technique || ""} onChange={(event) => updateLibraryEditorExercise({ technique: event.target.value })} disabled={libraryEditorReadOnly} placeholder="Например: держите спину ровно, тяните рукоять к поясу…" />
              </div>
              {!activeLibraryEditorExercise.libraryDeletedAt ? <div className={exerciseLibraryEditorStyles.dangerZone}>
                <button className={exerciseLibraryEditorStyles.deleteButton} type="button" disabled={libraryEditorBusy} onClick={confirmRemoveLibraryEditor}><Trash2 size={16} aria-hidden="true" />Удалить из библиотеки</button>
                <p>Останется в программах и истории клиентов.</p>
              </div> : null}
            </div>
            <footer className={exerciseLibraryEditorStyles.footer} data-trainer-modal-footer="true">
              {libraryEditorError ? <p id="trainer-library-editor-error" className={exerciseLibraryEditorStyles.error} role="alert">{libraryEditorError}</p> : null}
              {activeLibraryEditorExercise.libraryDeletedAt ? <>
                <button className={exerciseLibraryEditorStyles.deletedToggle} type="button" disabled={libraryEditorBusy} onClick={closeLibraryEditor}>Закрыть</button>
                <button className={exerciseLibraryEditorStyles.saveButton} type="button" disabled={libraryEditorBusy} onClick={() => void removeLibraryEditor(true)}><RefreshCw size={16} />{libraryEditorSaving ? "Восстанавливаем…" : "Восстановить"}</button>
              </> : <>
                <button className={exerciseLibraryEditorStyles.cancelButton} type="button" disabled={libraryEditorBusy} onClick={closeLibraryEditor}>Отмена</button>
                <button className={exerciseLibraryEditorStyles.saveButton} type="button" disabled={libraryEditorBusy} onClick={() => void saveLibraryEditor()}>{libraryEditorUploading ? "Загружаем видео…" : libraryEditorSaving ? "Сохраняем…" : "Сохранить"}</button>
              </>}
            </footer>
          </section>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="trainerNextModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <section className="trainerNextWorkoutPreview" role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-workout-preview-title">
            <header data-trainer-modal-header="true">
              <small>ПРЕДПРОСМОТР ДЛЯ КЛИЕНТА</small>
              <h2 id="trainer-workout-preview-title">{client?.name || "План тренировок"}</h2>
              <button type="button" className="trainerNextModalClose" onClick={() => setPreviewOpen(false)} aria-label="Закрыть предпросмотр"><X size={18} /></button>
            </header>
            <div className="trainerNextWorkoutPreviewBody" data-trainer-modal-content="true">
              {workouts.map((workout, workoutIndex) => (
                <article key={workout.id || workoutIndex}>
                  <header><span>День {workoutIndex + 1}</span><strong>{getWorkoutTitle(workout, workoutIndex)}</strong></header>
                  {(workout.exercises || []).map((exercise, exerciseIndex) => (
                    <div key={exercise.id || exerciseIndex}>
                      <span>{exerciseIndex + 1}</span>
                      <strong>{exercise.name || "Упражнение"}</strong>
                      <small>{exercise.sets?.length || 0} подх. · {getExerciseSetSummary(exercise.sets || [], "reps")} повт.</small>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      {confirmAction ? createPortal(
        <TrainerConfirmDialog
          title={confirmAction.title}
          text={confirmAction.text}
          confirmLabel={confirmAction.confirmLabel}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />,
        document.body
      ) : null}
    </div>
  );
}

function CreateClientModal({ state }) {
  const [telegramUsername, setTelegramUsername] = useState("");
  const { submit, submitting, error } = useTrainerInviteSubmission({ credentials: state?.credentials, loading: state?.loading, onSubmit: state?.onSubmit });
  if (!state?.open) return null;
  const invitationMessage = state.credentials
    ? buildTrainerInviteMessage({
        login: state.credentials.existingAccount ? "" : state.credentials.login,
        inviteUrl: state.credentials.shareUrl || state.credentials.activationUrl || state.credentials.inviteUrl,
        botStartUrl: state.credentials.botStartUrl
      })
    : "";
  return (
    <div className="trainerNextModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => !submitting && event.target === event.currentTarget && state.onClose()}>
      <section className="trainerNextModal trainerNextCreateClientModal" role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-create-client-title">
        <button className="trainerNextModalClose" type="button" onClick={state.onClose} disabled={submitting} aria-label="Закрыть">×</button>
        <header data-trainer-modal-header="true">
        <div className="trainerNextModalIcon"><UserPlus size={24} /></div>
        <div className="trainerInviteHeaderCopy">
          <h2 id="trainer-create-client-title">{state.credentials ? "Отправить приглашение" : "Пригласить клиента"}</h2>
          <p>{state.credentials ? "Откроется готовое сообщение. Нажми «Отправить» в Telegram." : "Укажи Telegram-ник. После создания отправь клиенту готовое сообщение."}</p>
        </div>
        </header>
        {state.credentials ? <div className="trainerNextCreateClientForm" data-trainer-modal-content="true"><TrainerClientInviteReady credentials={state.credentials} message={invitationMessage} /></div> : (
        <form id="trainer-create-client-form" className="trainerNextCreateClientForm" data-trainer-modal-content="true" onSubmit={event => submit(event, telegramUsername)}>
          <label><span>Имя</span><input disabled={submitting} value={state.name} onChange={(event) => state.onNameChange(event.target.value)} placeholder="Имя клиента" /></label>
          <label><span>Ник в Telegram</span><input disabled={submitting} value={telegramUsername} onChange={(event) => setTelegramUsername(event.target.value)} placeholder="@username" autoComplete="off" autoCapitalize="none" spellCheck="false" /></label>
          <small className="trainerNextModalHint">Мы подготовим сообщение в Telegram. Тебе останется отправить его клиенту.</small>
          <label><span>Логин для запасного входа (необязательно)</span><input disabled={submitting} value={state.login} onChange={(event) => state.onLoginChange(event.target.value)} placeholder="Придумай логин или оставь пустым" autoComplete="off" autoCapitalize="none" spellCheck="false" /></label>
          <small className="trainerNextModalHint">Если оставить пустым, логин создастся автоматически.</small>
          {error || state.status ? <p className="trainerNextModalStatus" role="alert">{error || state.status}</p> : null}
        </form>)}
        <footer data-trainer-modal-footer="true">
          {state.credentials ? <TrainerClientInviteSendAction credentials={state.credentials} message={invitationMessage} /> : <button className="trainerNextPrimary trainerNextModalSubmit" form="trainer-create-client-form" type="submit" disabled={submitting}>{submitting ? "Создаём приглашение…" : "Создать приглашение"}</button>}
        </footer>
      </section>
    </div>
  );
}

function TrainerCabinetUtilitySheet({
  trainerUid,
  onOpenClient,
  section,
  clients,
  clientSummaries,
  trainerSubscriptionNotificationSettings,
  onLoadTrainerSubscriptionNotifications,
  onSaveTrainerSubscriptionNotifications,
  onNavigate,
  onRefresh,
  onSendMessage,
  onClose
}) {
  const [modalFooterTarget, setModalFooterTarget] = useState(null);
  if (!section) return null;

  const isAnalytics = section === "analytics";
  const title = isAnalytics ? "Аналитика" : "Уведомления";
  const Icon = isAnalytics ? BarChart3 : Bell;

  return (
    <div
      className="trainerNextModalBackdrop"
      data-trainer-modal-backdrop="true"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="trainerNextModal trainerCabinetUtilitySheet"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-trainer-modal-surface="true"
        data-trainer-modal-frame="true"
        aria-labelledby={`trainer-cabinet-${section}-title`}
      >
        <header data-trainer-modal-header="true">
          <div className="trainerCabinetUtilitySheetTitle">
            <span><Icon size={19} /></span>
            <h2 id={`trainer-cabinet-${section}-title`}>{title}</h2>
          </div>
          <button className="trainerNextModalClose" type="button" onClick={onClose} aria-label={`Закрыть раздел «${title}»`}>
            <X size={20} />
          </button>
        </header>
        <div data-trainer-modal-content="true">
        <TrainerUtilityPage
          key={trainerUid || "anonymous"}
          trainerUid={trainerUid}
          onOpenClient={onOpenClient}
          embedded
          section={section}
          clients={clients}
          clientSummaries={clientSummaries}
          trainerSubscriptionNotificationSettings={trainerSubscriptionNotificationSettings}
          onLoadTrainerSubscriptionNotifications={onLoadTrainerSubscriptionNotifications}
          onSaveTrainerSubscriptionNotifications={onSaveTrainerSubscriptionNotifications}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
          onSendMessage={onSendMessage}
          modalFooterTarget={section === "notifications" ? modalFooterTarget : null}
        />
        </div>
        {section === "notifications" ? <footer className="trainerCabinetUtilitySheetFooter" data-trainer-modal-footer="true" ref={setModalFooterTarget} /> : null}
      </section>
    </div>
  );
}

function TrainerCabinetPage({
  trainerUid,
  onOpenClient,
  trainerName,
  trainerAvatar,
  clients = [],
  clientSummaries = {},
  counts = {},
  trainerSubscriptionNotificationSettings,
  onLoadTrainerSubscriptionNotifications,
  onSaveTrainerSubscriptionNotifications,
  onNavigate,
  onRefresh,
  onSendMessage,
  onOpenTrainerProfile,
  onOpenTrainerConnections,
  onLogout
}) {
  const activeCount = counts.active ?? null;
  const attentionCount = counts.attention ?? null;
  const [openSheet, setOpenSheet] = useState("");

  function navigateFromSheet(nextSection) {
    setOpenSheet("");
    onNavigate?.(nextSection);
  }

  return (
    <>
      <div className={`trainerNextPage trainerNextCabinetPage ${mobileStyles.cabinetFix}`} role="region" aria-label="Кабинет тренера">
        <header className="trainerNextMobileHeader">
          <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
          <h1 className="trainerNextMobileTitle">Кабинет</h1>
          <div className="trainerNextMobileHeaderActions">
            <button type="button" onClick={onRefresh} aria-label="Обновить страницу"><RefreshCw size={20} /></button>
          </div>
        </header>

        <div className="trainerNextCabinetContent">
          <div className="trainerNextDesktopPageHead">
            <div>
              <h1>Кабинет</h1>
              <p>Профиль, уведомления и подключения</p>
            </div>
          </div>

          <button className="trainerCabinetHero trainerCabinetProfileButton" type="button" onClick={onOpenTrainerProfile}>
            <TrainerAvatar client={{ name: trainerName, avatarUrl: trainerAvatar }} size="large" />
            <div>
              <span>Тренер</span>
              <h2>{trainerName || "Тренер"}</h2>
              <p>Личные данные и настройки</p>
            </div>
            <ChevronRight className="trainerCabinetHeroChevron" size={21} aria-hidden="true" />
          </button>

          <section className="trainerCabinetStats" aria-label="Сводка тренера">
            <article><span>В работе</span><strong>{clients.filter((client) => !client.archived && !client.isTest).length}</strong></article>
            <article><span>Без сигналов</span><strong>{activeCount ?? "—"}</strong></article>
            <article><span>Нужна проверка</span><strong>{attentionCount ?? "—"}</strong></article>
          </section>
          <p className={primaryScreensStyles.cabinetHint}>«Без сигналов» — у клиента нет выявленных предупреждений по доступным данным.</p>

          <h2 className={primaryScreensStyles.sectionTitle}>Рабочие настройки</h2>
          <section className="trainerCabinetWorkspaceLinks" aria-label="Рабочие разделы кабинета">
            <button type="button" onClick={() => onNavigate?.("library")}>
              <span className="trainerCabinetWorkspaceIcon"><Dumbbell size={19} /></span>
              <div className="trainerCabinetWorkspaceCopy"><strong>Библиотека упражнений</strong><small>Карточки, видео и техника выполнения</small></div>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => setOpenSheet("analytics")}>
              <span className="trainerCabinetWorkspaceIcon"><BarChart3 size={19} /></span>
              <div className="trainerCabinetWorkspaceCopy"><strong>Аналитика</strong><small>Сводка по активности и рискам клиентов</small></div>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => setOpenSheet("notifications")}>
              <span className="trainerCabinetWorkspaceIcon"><Bell size={19} /></span>
              <div className="trainerCabinetWorkspaceCopy"><strong>Уведомления</strong><small>События и настройки напоминаний</small></div>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={onOpenTrainerConnections}>
              <span className="trainerCabinetWorkspaceIcon"><Mail size={19} /></span>
              <div className="trainerCabinetWorkspaceCopy"><strong>Подключения</strong><small>Почта и Telegram для доступа и связи</small></div>
              <ChevronRight size={18} />
            </button>
          </section>

          {onLogout ? <button className="trainerCabinetLogout" type="button" onClick={onLogout}><LogOut size={18} aria-hidden="true" />Выйти из аккаунта</button> : null}
        </div>
      </div>

      <TrainerCabinetUtilitySheet
        trainerUid={trainerUid}
        onOpenClient={(client, tab) => { setOpenSheet(""); onOpenClient?.(client, tab); }}
        section={openSheet}
        clients={clients}
        clientSummaries={clientSummaries}
        trainerSubscriptionNotificationSettings={trainerSubscriptionNotificationSettings}
        onLoadTrainerSubscriptionNotifications={onLoadTrainerSubscriptionNotifications}
        onSaveTrainerSubscriptionNotifications={onSaveTrainerSubscriptionNotifications}
        onNavigate={navigateFromSheet}
        onRefresh={onRefresh}
        onSendMessage={onSendMessage}
        onClose={() => setOpenSheet("")}
      />
    </>
  );
}

function TrainerGlobalSubscriptionNotifications({ settings, onLoad, onSave, footerTarget = null }) {
  const [draft, setDraft] = useState(() => normalizeTrainerSubscriptionNotificationSettings(settings));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const loadSettingsRef = useRef(onLoad);

  useEffect(() => {
    loadSettingsRef.current = onLoad;
  }, [onLoad]);

  useEffect(() => {
    let active = true;
    const loadSettings = loadSettingsRef.current;
    if (!loadSettings) return () => { active = false; };

    setLoading(true);
    Promise.resolve(loadSettings())
      .then((result) => {
        if (!active) return;
        if (result === false) {
          setStatus("Не удалось загрузить настройки.");
          return;
        }
        setDraft(normalizeTrainerSubscriptionNotificationSettings(result));
      })
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, []);

  async function saveSettings() {
    setSaving(true);
    setStatus("");
    try {
      const result = await onSave?.(draft);
      if (result === false) {
        setStatus("Не удалось сохранить настройки.");
        return;
      }
      setDraft(normalizeTrainerSubscriptionNotificationSettings(result || draft));
      setStatus("Настройки сохранены для всех клиентов.");
    } finally {
      setSaving(false);
    }
  }

  const actions = (
    <div className={workspaceFeatureStyles.globalSubscriptionActions}>
      <small>После сохранения новые пороги используются для каждого назначенного тренеру клиента.</small>
      {status ? <span className={status.startsWith("Не удалось") ? workspaceFeatureStyles.error : workspaceFeatureStyles.saved} role="status">{status}</span> : null}
      <button type="button" onClick={saveSettings} disabled={loading || saving}>{loading ? "Загрузка..." : saving ? "Сохраняю..." : "Сохранить"}</button>
    </div>
  );

  return (
    <section className={workspaceFeatureStyles.globalSubscriptionSettings} aria-labelledby="trainer-subscription-notifications-title">
      <header className={workspaceFeatureStyles.globalSubscriptionHeader}>
        <span><Bell size={18} /></span>
        <div>
          <h3 id="trainer-subscription-notifications-title">Окончание абонемента</h3>
          <p>Единые Telegram-уведомления тренеру по сроку и остатку занятий у всех клиентов.</p>
        </div>
      </header>
      <div className={workspaceFeatureStyles.subscriptionReminderBar}>
        <div><strong>Когда предупреждать</strong><small>Порог применяется ко всей клиентской базе</small></div>
        <label><input type="checkbox" checked={draft.dateEnabled} onChange={(event) => setDraft((current) => ({ ...current, dateEnabled: event.target.checked }))} /><span>По дате</span></label>
        <label><input type="checkbox" checked={draft.sessionsEnabled} onChange={(event) => setDraft((current) => ({ ...current, sessionsEnabled: event.target.checked }))} /><span>По занятиям</span></label>
        <label><small>За дней</small><input type="number" min="0" value={draft.warningDays} onChange={(event) => setDraft((current) => ({ ...current, warningDays: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label><small>За тренировок</small><input type="number" min="0" value={draft.warningSessions} onChange={(event) => setDraft((current) => ({ ...current, warningSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label><small>Формат</small><select value={draft.digestMode} onChange={(event) => setDraft((current) => ({ ...current, digestMode: event.target.value }))}><option value="daily">Сводка</option><option value="separate">Отдельно</option></select></label>
        <label><small>Время</small><input type="time" value={draft.sendTime} onChange={(event) => setDraft((current) => ({ ...current, sendTime: event.target.value }))} /></label>
      </div>
      {footerTarget ? null : actions}
      {footerTarget ? createPortal(actions, footerTarget) : null}
    </section>
  );
}

function TrainerUtilityPage({
  trainerUid,
  onOpenClient,
  section,
  embedded = false,
  clients = [],
  clientSummaries = {},
  trainerSubscriptionNotificationSettings,
  onLoadTrainerSubscriptionNotifications,
  onSaveTrainerSubscriptionNotifications,
  onNavigate,
  onRefresh,
  onSendMessage,
  modalFooterTarget = null
}) {
  const messageItems = useMemo(() => {
    const items = [];
    clients.filter((client) => !client.archived).forEach((client) => {
      const summary = clientSummaries[client.id] || {};
      const clientName = client.name || client.displayName || client.email || "Клиент";
      const attentionState = getClientAttentionState(client, summary);
      const addMessage = (source, title, text, date, tone = "neutral", important = false, meta = {}) => {
        items.push({
          id: `${client.id}-${source}-${date || items.length}`,
          client,
          clientName,
          source,
          title,
          text,
          date,
          tone,
          important,
          actionLabel: meta.actionLabel || "",
          replyHint: meta.replyHint || "",
          suggestions: meta.suggestions || []
        });
      };

      if (attentionState) {
        const action = getTrainerMessageAction(
          client,
          summary,
          attentionState.reason || getAttentionReason(client, summary)
        );
        addMessage(
          action.source,
          action.title,
          action.text,
          summary.lastWorkoutAt || summary.lastNutritionAt || summary.lastMeasurementAt || client.updatedAt,
          "warning",
          true,
          action
        );
      }
      if (summary.lastWorkoutAt) {
        addMessage(
          "Тренировка",
          "Обновлена тренировка",
          `Клиент ${clientName} завершил или обновил тренировку. Можно проверить нагрузку и самочувствие.`,
          summary.lastWorkoutAt,
          "workout",
          false,
          {
            actionLabel: "Что сделать: смотреть только если нужно проверить нагрузку или самочувствие.",
            replyHint: "Обычно отвечать не нужно, если тренировка прошла штатно.",
            suggestions: [
              "Тренировку увидел. Если самочувствие нормальное — продолжаем по плану.",
              "Хорошо, тренировку зафиксировал. Напиши, если где-то было тяжело или неудобно."
            ]
          }
        );
      }
      if (summary.lastMeasurementAt) {
        addMessage(
          "Замеры",
          "Добавлены замеры",
          `Клиент ${clientName} добавил новые замеры. Стоит посмотреть динамику.`,
          summary.lastMeasurementAt,
          "measure",
          false,
          {
            actionLabel: "Что сделать: проверить динамику веса и объёмов, отвечать только при заметном изменении.",
            replyHint: "Например: «Замеры увидел, динамика нормальная / нужно обсудить»",
            suggestions: [
              "Замеры увидел. Посмотрю динамику и напишу, если нужно что-то скорректировать.",
              "Спасибо за замеры. Продолжаем отслеживать динамику по плану."
            ]
          }
        );
      }
      if (summary.lastNutritionAt) {
        addMessage(
          "Питание",
          "Обновлен дневник питания",
          `Клиент ${clientName} внес данные по питанию. Можно быстро проверить дневник.`,
          summary.lastNutritionAt,
          "nutrition",
          false,
          {
            actionLabel: "Что сделать: проверять только при отклонениях или когда клиент просит обратную связь.",
            replyHint: "Обычно это фоновое событие, не требующее ответа.",
            suggestions: [
              "Дневник питания увидел. Если будут сильные отклонения — напишу, что поправить.",
              "Питание зафиксировано, спасибо. Продолжай заполнять в таком же режиме."
            ]
          }
        );
      }
    });

    return items
      .sort((a, b) => (getWorkspaceDate(b.date)?.getTime() || 0) - (getWorkspaceDate(a.date)?.getTime() || 0))
      .slice(0, 18);
  }, [clients, clientSummaries]);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [messageReplyOpen, setMessageReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [messageStatus, setMessageStatus] = useState("");
  const [messageFilter, setMessageFilter] = useState("important");
  const [sentReplies, setSentReplies] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState(() => readCabinetEvents(getTrainerUiStorage(), trainerUid));
  const [eventSettingsStatus, setEventSettingsStatus] = useState("");
  function toggleCabinetEvent(key) {
    const next = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(next);
    setEventSettingsStatus(saveCabinetEvents(getTrainerUiStorage(), trainerUid, next)
      ? "Сохранено на этом устройстве." : "Настройка действует до закрытия раздела: сохранить на устройстве не удалось.");
  }
  const messageFilters = [
    { id: "important", label: "Нужно ответить" },
    { id: "all", label: "Все" },
    { id: "routine", label: "Фоновые" },
    { id: "warning", label: "Проверить" },
    { id: "workout", label: "Тренировки" },
    { id: "nutrition", label: "Питание" },
    { id: "measure", label: "Замеры" }
  ];
  const isImportantMessage = (item) => item.important || item.tone === "warning";
  const filteredMessageItems = messageFilter === "all"
    ? messageItems
    : messageFilter === "important"
      ? messageItems.filter(isImportantMessage)
      : messageFilter === "routine"
        ? messageItems.filter((item) => !isImportantMessage(item))
        : messageItems.filter((item) => item.tone === messageFilter);
  const selectedMessage = filteredMessageItems.find((item) => item.id === selectedMessageId)
    || filteredMessageItems[0]
    || null;
  const importantMessageCount = messageItems.filter(isImportantMessage).length;
  const unreadMessages = importantMessageCount;

  async function sendUtilityReply() {
    const text = replyText.trim();
    if (!text || !selectedMessage) return;
    setMessageStatus("Отправляем сообщение...");
    const sent = await onSendMessage?.(text, selectedMessage.client);
    if (sent === false) {
      setMessageStatus("Не удалось отправить. Проверь подключение Telegram или попробуй позже.");
      return;
    }
    setReplyText("");
    setSentReplies((current) => [{
      id: `${selectedMessage.id}-${Date.now()}`,
      clientName: selectedMessage.clientName,
      text,
      date: new Date().toISOString()
    }, ...current].slice(0, 4));
    setMessageStatus("Ответ сохранен и отправлен клиенту.");
  }
  const visibleClients = clients.filter((client) => !client.archived && !client.isTest);
  const utilityMetrics = buildTrainerDashboardSummary(visibleClients, clientSummaries);
  const attentionItems = visibleClients
    .map((client) => {
      const summary = clientSummaries[client.id] || {};
      return { client, summary, attention: getClientAttentionState(client, summary) };
    })
    .filter((item) => Boolean(item.attention));
  const attentionClients = utilityMetrics.statusCounts.critical;
  const activeUtilityClients = utilityMetrics.statusCounts.active;
  const activePercent = visibleClients.length ? Math.round((activeUtilityClients / visibleClients.length) * 100) : 0;
  const noProgramCount = attentionItems.filter((item) => item.attention.type === "program").length;
  const workoutAttentionCount = attentionItems.filter((item) => item.attention.type === "workout").length;
  const nutritionAttentionCount = attentionItems.filter((item) => item.attention.type === "nutrition").length;
  const staleMeasurementCount = attentionItems.filter((item) => item.attention.type === "measure").length;
  const completedWeek = visibleClients.reduce((sum, client) => sum + (Number(clientSummaries[client.id]?.workouts7) || 0), 0);
  const nutritionTrackedWeek = visibleClients.reduce((sum, client) => sum + (Number(clientSummaries[client.id]?.nutritionDays7) || 0), 0);
  const riskClients = attentionItems
    .map((item) => ({
      ...item,
      reasons: [item.attention.reason]
    }))
    .slice(0, 6);
  const notificationEvents = attentionItems.filter(({ attention }) => isCabinetEventEnabled(attention.type, notificationSettings)).flatMap(({ client, attention }) => (
    [attention.reason].map((reason) => ({
      id: `${client.id}-${reason}`,
      clientName: client.name || client.displayName || client.email || "Клиент",
      reason
    }))
  )).slice(0, 8);
  const config = {
    messages: {
      title: "Сообщения",
      eyebrow: "КОММУНИКАЦИЯ",
      icon: MessageSquare,
      text: "Сначала показываются только сообщения, где нужна реакция тренера. Фоновые события можно включить фильтрами.",
      stat: String(unreadMessages),
      statLabel: "нужно ответить",
      body: (
        <div className="trainerMessageCenter">
          <section className="trainerMessageList">
            <div className="trainerMessageSectionHead">
              <h3>Входящие</h3>
              <small>{messageFilter === "important" ? "только то, где нужен ответ или проверка" : messageItems.length ? "события клиентов по выбранному фильтру" : "новых событий нет"}</small>
            </div>
            <div className="trainerMessageFilters" role="group" aria-label="Фильтр сообщений">
              {messageFilters.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={messageFilter === item.id ? "active" : ""}
                  aria-pressed={messageFilter === item.id}
                  onClick={() => {
                    setMessageFilter(item.id);
                    setSelectedMessageId("");
                    setMessageReplyOpen(false);
                    setReplyText("");
                    setMessageStatus("");
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {filteredMessageItems.length ? filteredMessageItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selectedMessage?.id === item.id ? "active" : ""}
                aria-pressed={selectedMessage?.id === item.id}
                onClick={() => {
                  setSelectedMessageId(item.id);
                  setMessageReplyOpen(true);
                  setReplyText("");
                  setMessageStatus("");
                }}
              >
                <span className={`trainerMessageSource ${item.tone}`}>{item.source}</span>
                <strong>{item.title}</strong>
                <small>{item.clientName} · {formatCompactDate(item.date)}</small>
                <p>{item.text}</p>
                {item.actionLabel ? <b className="trainerMessageActionHint">{item.actionLabel}</b> : null}
              </button>
            )) : (
              <div className="trainerMessageEmpty">
                <MessageSquare size={28} />
                <strong>{messageFilter === "important" ? "Сообщений для реакции сейчас нет" : "Пока нет сообщений от клиентов"}</strong>
                <p>{messageFilter === "important"
                  ? "Фоновые события скрыты. Включите фильтр «Фоновые» или «Все», чтобы посмотреть обычные обновления."
                  : "Здесь появятся события из тренировок, замеров и питания, когда клиенты начнут обновлять данные."}</p>
              </div>
            )}
          </section>

          {messageReplyOpen && selectedMessage ? (
            <div
              className="trainerMessageModalBackdrop"
              data-trainer-modal-backdrop="true"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setMessageReplyOpen(false);
                }
              }}
            >
              <section
                className="trainerMessageModal"
                role="dialog"
                aria-modal="true"
                data-modal-surface="true"
                data-trainer-modal-surface="true"
                data-trainer-modal-frame="true"
                aria-labelledby="trainer-message-reply-title"
              >
                <header className="trainerMessageModalHead" data-trainer-modal-header="true">
                  <div>
                    <span>ОТВЕТ КЛИЕНТУ</span>
                    <h3 id="trainer-message-reply-title">{selectedMessage.clientName}</h3>
                    <small>{selectedMessage.title}</small>
                  </div>
                  <button className="trainerNextModalClose" type="button" onClick={() => setMessageReplyOpen(false)} aria-label="Закрыть ответ">
                    <X size={18} />
                  </button>
                </header>
                <div className="trainerMessageModalBody" data-trainer-modal-content="true">
                <div className="trainerMessagePreview">
                  <span className={`trainerMessageSource ${selectedMessage.tone}`}>{selectedMessage.source}</span>
                  <strong>{selectedMessage.title}</strong>
                  <p>{selectedMessage.text}</p>
                  {selectedMessage.actionLabel ? <b className="trainerMessageActionHint">{selectedMessage.actionLabel}</b> : null}
                </div>
                {selectedMessage.replyHint || selectedMessage.suggestions?.length ? (
                  <div className="trainerMessageCoachHint">
                    {selectedMessage.replyHint ? <small>{selectedMessage.replyHint}</small> : null}
                    {selectedMessage.suggestions?.length ? (
                      <div>
                        {selectedMessage.suggestions.map((suggestion) => (
                          <button type="button" key={suggestion} onClick={() => setReplyText(suggestion)}>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Написать короткий ответ клиенту..."
                  rows={6}
                />
                <button className="trainerMessageModalSend" type="button" onClick={sendUtilityReply} disabled={!replyText.trim()}>
                  <Mail size={17} />
                  Отправить ответ
                </button>
                {messageStatus ? <p className="trainerMessageStatus">{messageStatus}</p> : null}
                {sentReplies.length ? (
                  <div className="trainerMessageHistory">
                    <strong>Последние ответы</strong>
                    {sentReplies.map((item) => (
                      <p key={item.id}><span>{item.clientName}</span>{item.text}</p>
                    ))}
                  </div>
                ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      )
    },
    analytics: {
      title: "Аналитика",
      eyebrow: "ОТЧЁТЫ",
      icon: BarChart3,
      text: "Сводная аналитика по активности, прогрессу, питанию и рискам клиентов.",
      stat: `${activePercent}%`,
      statLabel: "активность",
      body: (
        <div className="trainerAnalyticsStack">
          <div className="trainerAnalyticsGrid">
            <article><span>Активные клиенты</span><strong>{activeUtilityClients}</strong><small>из {visibleClients.length || 0}</small></article>
            <article><span>Требуют внимания</span><strong>{attentionClients}</strong><small>нужна проверка</small></article>
            <article><span>Тренировок за 7 дней</span><strong>{visibleClients.some((client) => clientSummaries[client.id]?.sources && clientSummaries[client.id]?.workouts7 == null) ? "—" : completedWeek}</strong><small>по всем клиентам</small></article>
            <article><span>Дней питания за 7 дней</span><strong>{visibleClients.some((client) => clientSummaries[client.id]?.sources && clientSummaries[client.id]?.nutritionDays7 == null) ? "—" : nutritionTrackedWeek}</strong><small>заполнено клиентами</small></article>
          </div>
          <section className="trainerAnalyticsPanel">
            <div>
              <h3>Зоны внимания</h3>
              <p>Реальные сигналы по текущей базе, без искусственных процентов.</p>
            </div>
            <div className="trainerAnalyticsSignals">
              <span><strong>{noProgramCount}</strong> без программы</span>
              <span><strong>{workoutAttentionCount}</strong> по тренировкам</span>
              <span><strong>{nutritionAttentionCount}</strong> по питанию</span>
              <span><strong>{staleMeasurementCount}</strong> без свежих замеров</span>
            </div>
            {riskClients.length ? (
              <div className="trainerAnalyticsRiskList">
                {riskClients.map(({ client, reasons }) => (
                  <button type="button" key={client.id} onClick={() => onOpenClient?.(client, "overview")}>
                    <span>{client.name || client.displayName || client.email || "Клиент"}</span>
                    <small>{reasons.join(" · ")}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="trainerMessageEmpty compact"><p>Критичных зон внимания сейчас нет.</p></div>
            )}
          </section>
        </div>
      )
    },
    notifications: {
      title: "Уведомления",
      eyebrow: "НАПОМИНАНИЯ",
      icon: Bell,
      text: "События клиентов в кабинете и отдельные настройки напоминаний об абонементах.",
      stat: String(notificationEvents.length),
      statLabel: "событий",
      body: (
        <div className={workspaceFeatureStyles.globalNotificationStack}>
          <TrainerGlobalSubscriptionNotifications
            settings={trainerSubscriptionNotificationSettings}
            onLoad={onLoadTrainerSubscriptionNotifications}
            onSave={onSaveTrainerSubscriptionNotifications}
            footerTarget={modalFooterTarget}
          />
          <div className="trainerNotificationsLayout">
            <section className="trainerNotificationFeed">
              <h3>События в кабинете</h3>
              {notificationEvents.length ? notificationEvents.map((item) => (
                <article key={item.id}>
                  <Bell size={16} />
                  <span>
                    <strong>{item.clientName}</strong>
                    <small>{item.reason}</small>
                  </span>
                </article>
              )) : (
                <div className="trainerMessageEmpty compact"><p>Сейчас нет событий, требующих отдельного уведомления.</p></div>
              )}
            </section>
            <section>
              <h3>Что показывать в кабинете</h3>
              <p>Фильтры этой ленты сохраняются на этом устройстве. Они не включают и не отключают доставку в Telegram.</p>
              {[
                ["missedWorkout", "Пропущенная тренировка", "Показывать, если клиент не выполнил запланированную тренировку."],
                ["noNutrition", "Нет дневника питания", "Напоминать, если клиент долго не заполняет питание."],
                ["staleMeasurements", "Нет свежих замеров", "Подсвечивать клиентов без актуальных замеров."]
              ].map(([key, title, text]) => (
                <label className="trainerUtilityToggle" key={key}>
                  <span><strong>{title}</strong><small>{text}</small></span>
                  <input type="checkbox" checked={notificationSettings[key]} onChange={() => toggleCabinetEvent(key)} />
                </label>
              ))}
              {eventSettingsStatus ? <p role="status">{eventSettingsStatus}</p> : null}
            </section>
          </div>
        </div>
      )
    }
  }[section] || {
    title: "Раздел",
    eyebrow: "ТРЕНЕР",
    icon: ClipboardList,
    text: "Рабочий раздел тренерской панели.",
    stat: "—",
    statLabel: "нет данных"
  };
  const Icon = config.icon;

  return (
    <div className="trainerNextPage trainerUtilityPage">
      {!embedded ? (
        <>
          <header className="trainerNextMobileHeader">
            <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
            <div className="trainerNextMobileTitle">{config.title}</div>
            <div className="trainerNextMobileHeaderActions">
              <button type="button" onClick={onRefresh} aria-label="Обновить страницу"><RefreshCw size={20} /></button>
              <button type="button" onClick={() => onNavigate("notifications")} aria-label="Уведомления"><Bell size={21} /></button>
            </div>
          </header>

          <div className="trainerNextDesktopPageHead">
            <div><h1>{config.title}</h1><p>{config.text}</p></div>
          </div>

          <section className="trainerUtilityCard">
            <div className="trainerUtilityIcon"><Icon size={30} /></div>
            <div>
              <span>{config.eyebrow}</span>
              <h2>{config.title}</h2>
              <p>{config.text}</p>
            </div>
            <strong>{config.stat}<small>{config.statLabel}</small></strong>
          </section>
        </>
      ) : null}

      {config.body ? <section className="trainerUtilityBody">{config.body}</section> : null}

    </div>
  );
}

function TrainerClientDetailLoading({ client, onBack }) {
  const name = client?.name || client?.email || "Клиент";

  return (
    <div className={`trainerNextPage trainerNextClientPage ${mobileStyles.clientPageFix}`} aria-busy="true">
      <div className={`trainerNextClientBackRow ${mobileStyles.clientToolbarFix}`}>
        <button className="trainerNextClientBackButton" type="button" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>К клиентам</span>
        </button>
      </div>
      <section className="trainerNextClientLoading" aria-live="polite">
        <div className="trainerNextClientLoadingHeader">
          <span className="trainerNextClientLoadingAvatar" aria-hidden="true" />
          <div>
            <strong>{name}</strong>
            <p>Загружаем данные клиента…</p>
          </div>
        </div>
        <div className="trainerNextClientLoadingTabs" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="trainerNextClientLoadingCards" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </div>
  );
}

export default function TrainerWorkspace({
  trainerUid = "",
  appVersion = "",
  embedded = false,
  mode = "dashboard",
  activeSection = "dashboard",
  onNavigate,
  trainerName,
  trainerAvatar,
  clients = [],
  clientSummaries = {},
  actionCenter = null,
  summariesLoading = false,
  clientLoading = false,
  counts = {},
  selectedClient,
  selectedProfile = {},
  selectedSummary = {},
  selectedClientSnapshot = null,
  selectedLastWorkoutReview = null,
  activeClientTab = "overview",
  onClientTabChange,
  onOpenClient,
  onCloseClient,
  onCreateClient,
  createClientState,
  measurements = [],
  history = [],
  exerciseProgressReviews = [],
  nutritionDays = [],
  nutritionGoals = {},
  nutritionPlanOptions = [],
  photos = [],
  tasks = [],
  workouts = [],
  archivedWorkouts = [],
  exerciseLibrary = [],
  trainerLibraryLoadState,
  onRetryLibrary,
  programTemplates = [],
  selectedProgramId = "",
  onSelectProgram,
  onAssignProgram,
  onRenameProgramAssignment,
  onSaveWorkoutSchedule,
  onOpenProgramManager,
  activeWorkoutTab = "plan",
  onWorkoutTabChange,
  programStatus = "",
  onUpdateWorkout,
  onUpdateExercise,
  onSaveExerciseProgressAdjustment,
  onUpdateLibraryExercise,
  onRemoveLibraryExercise,
  onCreateLibraryExercise,
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onAddExercise,
  onRemoveExercise,
  onDuplicateExercise,
  onMoveExercise,
  onUploadExerciseVideo,
  onUploadLibraryExerciseVideo,
  exerciseVideoUploadingId = "",
  onAddDay,
  onDuplicateDay,
  onRemoveDay,
  onSaveWorkouts,
  onLoadMoreHistory,
  onGenerateNutritionPlan,
  onSaveNutritionPlan,
  onSaveNotifications,
  onSaveClientSetupProgress,
  trainerSubscriptionNotificationSettings,
  onLoadTrainerSubscriptionNotifications,
  onSaveTrainerSubscriptionNotifications,
  onTestNotification,
  onConnectTelegram,
  onOpenTelegramChat,
  onSendMessage,
  telegramMessages = [],
  onOpenTrainerProfile,
  onOpenTrainerConnections,
  onCreateTask,
  onClientAction,
  canDeleteClients = false,
  onArchiveProgramAssignment,
  onRestoreProgramAssignment,
  onDeleteProgramAssignment,
  canAdminManageProgramAssignments = false,
  onResolveExerciseProgress,
  onRefresh,
  onRetryClientData,
  onRetrySummary,
  onLoadProgramLibrary,
  onLogout
}) {
  const [clientListState, setClientListState] = useState({ search: "", filter: "all", scrollTop: 0 });
  useEffect(() => {
    if (mode === "workouts" || (mode === "client" && activeClientTab === "workouts")) {
      void Promise.resolve(onLoadProgramLibrary?.()).catch(error => console.warn("Program library load failed:", error));
    }
    // Callback identity follows orchestration state; section/client are demand boundaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeClientTab, selectedClient?.id]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedClientId = params.get("trainerClient");
    if (!requestedClientId || !clients.length) return;
    const requestedClient = clients.find((client) => client.id === requestedClientId);
    if (!requestedClient) return;
    if (selectedClient?.id !== requestedClientId) onOpenClient?.(requestedClient);
    const requestedTab = params.get("tab");
    if (requestedTab === "notifications") onClientTabChange?.("notifications");
    if (["messages", "notes"].includes(requestedTab)) onClientTabChange?.("messages");
    if (params.get("subscription") === "renew") onClientTabChange?.("overview");
  }, [clients, onClientTabChange, onOpenClient, selectedClient?.id]);

  let content = null;
  const showSyncStatus = summariesLoading && mode === "dashboard";

  if (mode === "dashboard") {
    content = (
      <TrainerDashboard
        trainerUid={trainerUid}
        clients={clients}
        clientSummaries={clientSummaries}
        actionCenter={actionCenter}
        trainerName={trainerName}
        counts={counts}
        onOpenClient={onOpenClient}
        onOpenClients={() => onNavigate("clients")}
        onCreateClient={onCreateClient}
      />
    );
  } else if (mode === "clients") {
    content = <TrainerClientsPage listState={clientListState} onListStateChange={setClientListState} clients={clients} clientSummaries={clientSummaries} summariesLoading={summariesLoading} onRetrySummary={onRetrySummary} onOpenClient={onOpenClient} onCreateClient={onCreateClient} />;
  } else if (mode === "client" && selectedClient) {
    content = (
      clientLoading ? <TrainerClientDetailLoading
        client={selectedClient}
        onBack={onCloseClient}
      /> : <TrainerClientDetail
        key={selectedClient.id}
        client={selectedClient}
        profile={selectedProfile}
        summary={selectedSummary}
        snapshot={selectedClientSnapshot}
        workoutReview={selectedLastWorkoutReview}
        activeTab={activeClientTab}
        onLoadProgramLibrary={onLoadProgramLibrary}
        onOpenExerciseLibrary={() => onNavigate("library")}
        onTabChange={onClientTabChange}
        onBack={onCloseClient}
        onRetryData={onRetryClientData ? () => onRetryClientData(selectedClient) : onRefresh}
        measurements={measurements}
        history={history}
        exerciseProgressReviews={exerciseProgressReviews}
        nutritionDays={nutritionDays}
        nutritionGoals={nutritionGoals}
        nutritionPlanOptions={nutritionPlanOptions}
        photos={photos}
        tasks={tasks}
        onGeneratePlan={onGenerateNutritionPlan}
        onSaveNutritionPlan={onSaveNutritionPlan}
        workouts={workouts}
        archivedWorkouts={archivedWorkouts}
        exerciseLibrary={exerciseLibrary}
        programTemplates={programTemplates}
        selectedProgramId={selectedProgramId}
        onSelectProgram={onSelectProgram}
        onAssignProgram={onAssignProgram}
        onRenameProgramAssignment={onRenameProgramAssignment}
        onArchiveProgramAssignment={onArchiveProgramAssignment}
        onRestoreProgramAssignment={onRestoreProgramAssignment}
        onDeleteProgramAssignment={onDeleteProgramAssignment}
        canAdminManageProgramAssignments={canAdminManageProgramAssignments}
        onSaveWorkoutSchedule={onSaveWorkoutSchedule}
        programStatus={programStatus}
        onUpdateWorkout={onUpdateWorkout}
        onUpdateExercise={onUpdateExercise}
        onSaveExerciseProgressAdjustment={onSaveExerciseProgressAdjustment}
        onUpdateLibraryExercise={onUpdateLibraryExercise}
        onRemoveLibraryExercise={onRemoveLibraryExercise}
        onCreateLibraryExercise={onCreateLibraryExercise}
        onUpdateExerciseSet={onUpdateExerciseSet}
        onAddExerciseSet={onAddExerciseSet}
        onRemoveExerciseSet={onRemoveExerciseSet}
        onAddExercise={onAddExercise}
        onRemoveExercise={onRemoveExercise}
        onDuplicateExercise={onDuplicateExercise}
        onMoveExercise={onMoveExercise}
        onUploadExerciseVideo={onUploadExerciseVideo}
        onUploadLibraryExerciseVideo={onUploadLibraryExerciseVideo}
        exerciseVideoUploadingId={exerciseVideoUploadingId}
        onAddDay={onAddDay}
        onDuplicateDay={onDuplicateDay}
        onRemoveDay={onRemoveDay}
        onSaveNotifications={onSaveNotifications}
        onSaveClientSetupProgress={onSaveClientSetupProgress}
        showSetupWizard={!embedded}
        onTestNotification={onTestNotification}
        onConnectTelegram={onConnectTelegram}
        onOpenTelegramChat={onOpenTelegramChat}
        onSendMessage={onSendMessage}
        messages={telegramMessages}
        onCreateTask={onCreateTask}
        onClientAction={onClientAction}
        canDeleteClient={canDeleteClients && !["admin", "trainer"].includes(selectedClient.role || "client")}
        onResolveExerciseProgress={onResolveExerciseProgress}
        onSaveWorkouts={onSaveWorkouts}
        onLoadMoreHistory={onLoadMoreHistory}
      />
    );
  } else if (mode === "workouts") {
    content = (
      <TrainerWorkoutEditor
        client={selectedClient}
        history={history}
        workouts={workouts}
        archivedWorkouts={archivedWorkouts}
        exerciseLibrary={exerciseLibrary}
        trainerLibraryLoadState={trainerLibraryLoadState}
        onRetryLibrary={onRetryLibrary}
        programTemplates={programTemplates}
        selectedProgramId={selectedProgramId}
        onSelectProgram={onSelectProgram}
        onAssignProgram={onAssignProgram}
        onOpenProgramManager={onOpenProgramManager}
        activeWorkoutTab={activeWorkoutTab}
        onWorkoutTabChange={onWorkoutTabChange}
        programStatus={programStatus}
        onUpdateWorkout={onUpdateWorkout}
        onUpdateExercise={onUpdateExercise}
        onUpdateLibraryExercise={onUpdateLibraryExercise}
        onRemoveLibraryExercise={onRemoveLibraryExercise}
        onCreateLibraryExercise={onCreateLibraryExercise}
        onUpdateExerciseSet={onUpdateExerciseSet}
        onAddExerciseSet={onAddExerciseSet}
        onRemoveExerciseSet={onRemoveExerciseSet}
        onAddExercise={onAddExercise}
        onRemoveExercise={onRemoveExercise}
        onDuplicateExercise={onDuplicateExercise}
        onMoveExercise={onMoveExercise}
        onUploadExerciseVideo={onUploadExerciseVideo}
        onUploadLibraryExerciseVideo={onUploadLibraryExerciseVideo}
        exerciseVideoUploadingId={exerciseVideoUploadingId}
        onAddDay={onAddDay}
        onDuplicateDay={onDuplicateDay}
        onRemoveDay={onRemoveDay}
        onSave={onSaveWorkouts}
      />
    );
  } else if (mode === "nutrition") {
    content = (
      <TrainerNutritionPage
        client={selectedClient}
        profile={selectedProfile}
        history={history}
        nutritionDays={nutritionDays}
        goals={nutritionGoals}
        planOptions={nutritionPlanOptions}
        onGeneratePlan={onGenerateNutritionPlan}
        onSavePlan={onSaveNutritionPlan}
        status={programStatus}
      />
    );
  } else if (mode === "cabinet") {
    content = (
      <TrainerCabinetPage
        key={trainerUid || "anonymous"}
        trainerUid={trainerUid}
        onOpenClient={onOpenClient}
        trainerName={trainerName}
        trainerAvatar={trainerAvatar}
        clients={clients}
        clientSummaries={clientSummaries}
        counts={counts}
        trainerSubscriptionNotificationSettings={trainerSubscriptionNotificationSettings}
        onLoadTrainerSubscriptionNotifications={onLoadTrainerSubscriptionNotifications}
        onSaveTrainerSubscriptionNotifications={onSaveTrainerSubscriptionNotifications}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
        onSendMessage={onSendMessage}
        onOpenTrainerProfile={onOpenTrainerProfile}
        onOpenTrainerConnections={onOpenTrainerConnections}
        onLogout={onLogout}
      />
    );
  } else if (["messages", "analytics", "notifications"].includes(mode)) {
    content = (
      <TrainerUtilityPage
        key={trainerUid || "anonymous"}
        trainerUid={trainerUid}
        onOpenClient={onOpenClient}
        section={mode}
        clients={clients}
        clientSummaries={clientSummaries}
        trainerSubscriptionNotificationSettings={trainerSubscriptionNotificationSettings}
        onLoadTrainerSubscriptionNotifications={onLoadTrainerSubscriptionNotifications}
        onSaveTrainerSubscriptionNotifications={onSaveTrainerSubscriptionNotifications}
        counts={counts}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
        onSendMessage={onSendMessage}
      />
    );
  }

  const summaryStatus = <TrainerSummaryStatus clients={clients} summaries={clientSummaries} loading={summariesLoading} onRetry={onRetrySummary || onRefresh} />;
  const syncStatus = showSyncStatus ? (
    <TrainerSyncStatusToggle
      clients={clients}
      clientSummaries={clientSummaries}
    />
  ) : null;

  if (embedded) {
    return (
      <div className={`trainerNextRoot ${workspaceStyles.workspaceRoot} ${cabinetStyles.scope} ${adaptiveStyles.root} ${responsiveStyles.scope} ${modalSystemStyles.scope} ${clientProfileSectionStyles.scope} ${programEditorStyles.scope} ${nutritionDiaryStyles.scope} ${clientWorkoutPlanStyles.scope} ${clientViewsStyles.scope} ${nutritionAnalyticsStyles.scope} ${clientNutritionStyles.scope} ${exerciseProgressStyles.scope} ${dashboardStyles.scope}`}>
        <TrainerModalScrollLock />
        {summaryStatus}
        {content}
        {syncStatus}
      </div>
    );
  }

  return (
    <TrainerShell activeSection={activeSection} onNavigate={onNavigate} trainerName={trainerName} trainerAvatar={trainerAvatar} appVersion={appVersion}>
      {summaryStatus}
      {content}
      {createClientState?.open ? <CreateClientModal state={createClientState} /> : null}
      {syncStatus}
    </TrainerShell>
  );
}
