import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import adaptiveStyles from "./TrainerWorkspaceAdaptive.module.css";
import trainerProgramConstructorStyles from "./TrainerProgramConstructor.module.css";
import TrainerClientUtilitySheet from "./TrainerClientUtilitySheet";
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
import exerciseLibraryEditorStyles from "./TrainerExerciseLibraryEditor.module.css";
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
import { getClientTelegramProfile } from "../../utils/clientTelegramProfile.js";
import {
  buildNextTrainerClientSetupChecklist,
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
  Archive,
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
  { id: "workouts", label: "Программы", icon: Dumbbell },
  { id: "more", label: "Кабинет", mobileLabel: "Кабинет", icon: User }
];

export function TrainerProgramConstructorStyleScope({ children }) {
  return <>{children(trainerProgramConstructorStyles)}</>;
}
const DESKTOP_NAV_ITEMS = [
  { id: "dashboard", label: "Главная", icon: Home },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "workouts", label: "Программы", icon: Dumbbell },
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

function formatWorkoutHistoryDuration(seconds) {
  const value = Number(seconds) || 0;
  if (value <= 0) return "без времени";
  const minutes = Math.max(1, Math.round(value / 60));
  return `${minutes} ${pluralize(minutes, "мин", "мин", "мин")}`;
}

function getWorkoutHistorySetSummary(item = {}) {
  const exercises = Array.isArray(item.exercises) ? item.exercises : [];
  const sets = exercises.reduce((sum, exercise) => sum + (Array.isArray(exercise.sets) ? exercise.sets.length : 0), 0);
  if (!exercises.length && !sets) return "подходы не указаны";
  return `${exercises.length} ${pluralize(exercises.length, "упражнение", "упражнения", "упражнений")} · ${sets} ${pluralize(sets, "подход", "подхода", "подходов")}`;
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
  const mobileItems = NAV_ITEMS.filter((item) => ["dashboard", "clients", "workouts", "more"].includes(item.id));

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
    <div className={`trainerNextRoot ${workspaceStyles.workspaceRoot} ${cabinetStyles.scope} ${adaptiveStyles.root} ${responsiveStyles.scope} ${modalSystemStyles.scope} ${clientProfileSectionStyles.scope} ${programEditorStyles.scope} ${nutritionDiaryStyles.scope} ${clientWorkoutPlanStyles.scope} ${clientViewsStyles.scope} ${nutritionAnalyticsStyles.scope} ${clientNutritionStyles.scope} ${exerciseProgressStyles.scope} ${dashboardStyles.scope}`}>
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
    <div className="trainerNextClientTable">
      <div className="trainerNextClientTableHead">
        <span>Клиент</span><span>Прогресс</span><span>Тренировки</span><span>Питание</span><span>Активность</span><span>Статус</span>
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
        const weeklyProgressScore = Number(summary.weeklyProgressScore);
        const hasWeeklyProgressScore = Number.isFinite(weeklyProgressScore);
        const progressScore = hasWeeklyProgressScore
          ? Math.max(0, Math.min(100, Math.round(weeklyProgressScore)))
          : null;
        return (
          <button type="button" key={client.id} onClick={() => onOpenClient(client, "overview")}>
            <span className="trainerNextClientIdentity">
              <TrainerAvatar client={client} size="small" />
              <span>
                <strong>{client.name || client.email || "Клиент"}</strong>
                <small>{clientDetail}</small>
              </span>
            </span>
            <span className="positive" aria-label={progressScore === null ? "Недостаточно данных для недельной оценки прогресса" : `Недельный прогресс: ${progressScore} /100`}>
              <b>{progressScore === null ? "—" : `${progressScore} /100`}</b>
              <small className="trainerNextClientMetricLabel">Прогресс</small>
            </span>
            <span className="trainerNextClientMetric"><b>{assignedWorkoutCount ? `${completedWorkoutCount} / ${assignedWorkoutCount}` : "—"}</b><small>тренировки</small></span>
            <span className="trainerNextClientMetric"><b>{summary.nutritionDays7 || 0} / 7</b><small>питание</small></span>
            <span className="trainerNextClientActivity"><b>{formatCompactDate(summary.lastWorkoutAt || summary.lastNutritionAt)}</b><small>последнее</small></span>
            <ClientStatus status={statusAction} />
          </button>
        );
      })}
      {!filteredClients.length ? <div className="trainerNextEmpty">Нет клиентов по выбранному фильтру.</div> : null}
    </div>
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

function TrainerDashboard({ actionCenter, trainerName, onOpenClient }) {

  return (
    <div className="trainerNextPage trainerNextDashboard">
      <header className="trainerNextMobileHeader">
        <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
        <div className="trainerNextMobileTitle">Дашборд</div>
        <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
      </header>

      <div className="trainerNextDesktopPageHead">
        <div><h1>Обзор</h1><p>Общая картина по всем клиентам</p></div>
      </div>

      <Suspense fallback={null}>
        <TrainerDailyJournal
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
  const total = clients.length;
  const completed = clients.reduce((count, client) => (
    clientSummaries[client.id]?.trainerSummaryReady ? count + 1 : count
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

export function ClientSubscriptionCard({ client, onSave, onSaved, open: controlledOpen, onOpenChange, inline = false }) {
  const subscription = client?.subscription || {};
  const status = getSubscriptionStatus(subscription, new Date());
  const [localOpen, setLocalOpen] = useState(() => new URLSearchParams(window.location.search).get("subscription") === "renew");
  const open = typeof controlledOpen === "boolean" ? controlledOpen : localOpen;
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [draft, setDraft] = useState({
    startDate: subscription.startDate || "",
    endDate: subscription.endDate || "",
    purchasedSessions: Number(subscription.purchasedSessions || subscription.totalSessions || 0),
    usedSessions: Number(subscription.usedSessions || 0),
    frozen: subscription.frozen === true
  });

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
    setDraft({
      startDate: subscription.startDate || "",
      endDate: subscription.endDate || "",
      purchasedSessions: Number(subscription.purchasedSessions || subscription.totalSessions || 0),
      usedSessions: Number(subscription.usedSessions || 0),
      frozen: subscription.frozen === true
    });
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
        subscription: {
          ...subscription,
          startDate: draft.startDate,
          endDate: draft.endDate,
          purchasedSessions: draft.purchasedSessions,
          usedSessions: draft.usedSessions,
          frozen: draft.frozen
        }
      });
      setSaveStatus(saved === false ? "error" : "saved");
      if (saved !== false) {
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
        <div><span>АБОНЕМЕНТ</span><h2>Абонемент клиента</h2><p>Срок действия и баланс тренировок клиента.</p></div>
        <i className={status.tone}>{status.label}</i>
      </header>
      <div className="trainerInlineSubscriptionGrid">
        <label><small>Дата начала</small><input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
        <label><small>Дата окончания</small><input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
        <label><small>Куплено тренировок</small><input type="number" min="0" value={draft.purchasedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, purchasedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label><small>Использовано</small><input type="number" min="0" value={draft.usedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, usedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
      </div>
      <div className="trainerInlineSubscriptionSummary">
        <strong>Осталось: {Math.max(0, draft.purchasedSessions - draft.usedSessions)} тренировок</strong>
        <label><input type="checkbox" checked={draft.frozen} onChange={(event) => setDraft((current) => ({ ...current, frozen: event.target.checked }))} /><span>Абонемент заморожен</span></label>
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
            <span><small>Использовано</small><strong>{status.usedSessions || 0} из {status.purchasedSessions || 0}</strong></span>
            <span><small>Действует до</small><strong>{status.endDate ? formatCompactDate(status.endDate) : "Не указано"}</strong></span>
          </div>
          <button type="button" onClick={openEditor}>Редактировать</button>
        </section>
      )}

      {open && !inline ? (
        <div className={`trainerNextModalBackdrop ${workspaceFeatureStyles.subscriptionModalBackdrop}`} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className={workspaceFeatureStyles.subscriptionModal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-subscription-modal-title">
            <button type="button" className={workspaceFeatureStyles.subscriptionModalClose} onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            <header data-trainer-modal-header="true"><span>АБОНЕМЕНТ</span><h2 id="trainer-subscription-modal-title">Редактирование абонемента</h2><p>Срок действия и баланс тренировок клиента.</p></header>
            <div data-trainer-modal-content="true">
            <div className={workspaceFeatureStyles.subscriptionModalGrid}>
              <label><small>Дата начала</small><input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
              <label><small>Дата окончания</small><input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
              <label><small>Куплено тренировок</small><input type="number" min="0" value={draft.purchasedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, purchasedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
              <label><small>Использовано</small><input type="number" min="0" value={draft.usedSessions} onFocus={(event) => event.target.select()} onChange={(event) => setDraft((current) => ({ ...current, usedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
            </div>
            <div className={workspaceFeatureStyles.subscriptionModalSummary}>
              <strong>Осталось: {Math.max(0, draft.purchasedSessions - draft.usedSessions)} тренировок</strong>
              <label><input type="checkbox" checked={draft.frozen} onChange={(event) => setDraft((current) => ({ ...current, frozen: event.target.checked }))} /><span>Абонемент заморожен</span></label>
            </div>
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

function ClientCalendarSubscriptionFields({ client, draft, onChange, onSave, onSaved, editing, onEdit, onCancel, showEditAction = true, showStatus = true }) {
  const subscription = client?.subscription || {};
  const status = getSubscriptionStatus({ ...subscription, ...draft }, new Date());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const remainingSessions = Math.max(0, Number(draft.purchasedSessions || 0) - Number(draft.usedSessions || 0));

  async function saveSubscription() {
    if (!onSave || saving) return;
    setSaving(true);
    setSaveStatus("");
    try {
      const saved = await onSave({
        subscriptionOnly: true,
        subscription: {
          ...subscription,
          startDate: draft.startDate,
          endDate: draft.endDate,
          purchasedSessions: Math.max(0, Number(draft.purchasedSessions) || 0),
          usedSessions: Math.max(0, Number(draft.usedSessions) || 0),
          frozen: draft.frozen === true
        }
      });
      if (saved === false) {
        setSaveStatus("error");
        return;
      }
      setSaveStatus("saved");
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
          <span>Начало: <b>{formatSubscriptionDate(draft.startDate)}</b></span>
          <span>Окончание: <b>{formatSubscriptionDate(draft.endDate)}</b></span>
          {showStatus ? <i className={status.tone}>{status.label}</i> : null}
        </div>
        <footer>
          <span>Осталось: <b>{remainingSessions}</b> тренировок</span>
          {draft.frozen ? <span>Заморожен</span> : null}
          {showEditAction ? <button type="button" className="trainerCalendarSubscriptionEdit" onClick={onEdit}>Изменить абонемент</button> : null}
        </footer>
      </section>
    );
  }

  return (
    <section className="trainerCalendarSubscriptionFields" aria-label="Параметры абонемента">
      <div className="trainerCalendarSubscriptionRange" aria-live="polite">
        <span>Начало: <b>{draft.startDate ? formatSubscriptionDate(draft.startDate) : "выберите на календаре"}</b></span>
        <span>Окончание: <b>{draft.endDate ? formatSubscriptionDate(draft.endDate) : "выберите на календаре"}</b></span>
        {showStatus ? <i className={status.tone}>{status.label}</i> : null}
      </div>
      <div className="trainerCalendarSubscriptionInputs">
        <label><small>Куплено тренировок</small><input type="number" min="0" value={draft.purchasedSessions} onFocus={(event) => event.target.select()} onChange={(event) => onChange((current) => ({ ...current, purchasedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label><small>Использовано</small><input type="number" min="0" value={draft.usedSessions} onFocus={(event) => event.target.select()} onChange={(event) => onChange((current) => ({ ...current, usedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
      </div>
      <footer>
        <span>Осталось: <b>{remainingSessions}</b> тренировок</span>
        <label><input type="checkbox" checked={draft.frozen} onChange={(event) => onChange((current) => ({ ...current, frozen: event.target.checked }))} /><small>Заморожен</small></label>
        {saveStatus === "error" ? <strong className={workspaceFeatureStyles.error}>Не удалось сохранить</strong> : null}
        {onCancel ? <button type="button" className="trainerCalendarSubscriptionCancel" disabled={saving} onClick={onCancel}>Отмена</button> : null}
        <button type="button" className="trainerNextPrimary" disabled={!onSave || saving} onClick={saveSubscription}>{saving ? "Сохранение…" : "Сохранить"}</button>
      </footer>
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
  onOpenExerciseProgress
}) {
  return (
    <div className="trainerNextClientOverview trainerClientTabContent">
      <ClientOverviewAttention
        snapshot={snapshot}
        workoutReview={workoutReview}
        history={history}
        onTabChange={onTabChange}
        onOpenCalendar={onOpenCalendar}
        onOpenTasks={onOpenTasks}
        onOpenFeedback={onOpenFeedback}
        onOpenMessage={onOpenMessage}
      />
      <ClientWorkSummary
        snapshot={snapshot}
        workoutReview={workoutReview}
        measurements={measurements}
        nutritionDays={nutritionDays}
        nutritionGoals={nutritionGoals}
        onTabChange={onTabChange}
      />
      <TrainerClientProgressDashboard
        key={client?.id || "client-progress"}
        measurements={measurements}
        history={history}
        nutritionDays={nutritionDays}
        nutritionGoals={nutritionGoals}
      />
      <ClientSectionLaunchButton
        icon={BarChart3}
        title="Открыть прогресс упражнений"
        description="Сравнения нагрузки, адаптация и решения по упражнениям"
        onClick={onOpenExerciseProgress}
      />
    </div>
  );
}

function ClientMeasurements({ measurements = [], separated = false }) {
  const [expanded, setExpanded] = useState(false);
  const safeMeasurements = (Array.isArray(measurements) ? measurements : []).filter((item) => item && typeof item === "object");
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
  const photoViews = [
    { id: "front", label: "Спереди", key: "frontUrl" },
    { id: "side", label: "Сбоку", key: "sideUrl" },
    { id: "back", label: "Со спины", key: "backUrl" }
  ];
  const [view, setView] = useState("front");
  const [openPhotoId, setOpenPhotoId] = useState("");
  const [compareIds, setCompareIds] = useState(["", ""]);
  const [failedPhotoKeys, setFailedPhotoKeys] = useState({});
  const sortedPhotos = photos.slice().sort((a, b) => {
    const dateA = getWorkspaceDate(a.date || a.createdAt)?.getTime() || 0;
    const dateB = getWorkspaceDate(b.date || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });
  const getPhotoUrl = (photo, targetView = view) => {
    const viewConfig = photoViews.find((item) => item.id === targetView) || photoViews[0];
    const viewUrl = photo?.[viewConfig.key];
    if (viewUrl) return viewUrl;
    // Older uploads occasionally have one generic image URL. Treat it as a
    // front view only: showing the same image for every angle is misleading.
    return targetView === "front" ? (photo?.url || photo?.photoUrl || "") : "";
  };
  function getPhotoId(photo, index) {
    return String(photo.id || photo.createdAt || photo.date || `photo-${index}`);
  }
  const getPhotoStateKey = (photo, index, targetView = view) => `${getPhotoId(photo, index)}:${targetView}:${getPhotoUrl(photo, targetView)}`;
  const getPhotoViewLabel = (targetView = view) => (
    (photoViews.find((item) => item.id === targetView) || photoViews[0]).label.toLowerCase()
  );
  const renderPhotoMedia = (photo, index, targetView = view) => {
    const photoUrl = getPhotoUrl(photo, targetView);
    const stateKey = getPhotoStateKey(photo, index, targetView);
    const photoDate = formatCompactDate(photo.date || photo.createdAt);
    const viewLabel = getPhotoViewLabel(targetView);

    if (!photoUrl || failedPhotoKeys[stateKey]) {
      return (
        <span className="trainerPhotoMediaPlaceholder" aria-label={`Нет фото ${viewLabel}`}>
          <Camera size={28} />
          <small>Нет фото {viewLabel}</small>
        </span>
      );
    }

    return (
      <img
        src={photoUrl}
        alt={`Фото клиента ${viewLabel}: ${photoDate}`}
        onError={() => setFailedPhotoKeys((current) => ({ ...current, [stateKey]: true }))}
      />
    );
  };
  const activePhoto = sortedPhotos.find((photo, index) => getPhotoId(photo, index) === openPhotoId);
  const comparePhotos = compareIds.map((id) => sortedPhotos.find((photo, index) => getPhotoId(photo, index) === id)).filter(Boolean);

  return (
    <section className="trainerNextSimplePanel">
      <div className="trainerNextPanelTitle">
        <div><h2>Фото прогресса</h2><p>Фотосессии клиента по датам</p></div>
        <div className="trainerPhotoViewTabs">
          {photoViews.map((item) => <button type="button" className={view === item.id ? "active" : ""} aria-pressed={view === item.id} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
        </div>
      </div>

      {sortedPhotos.length >= 2 ? (
        <div className="trainerPhotoComparePanel">
          <div>
            <strong>Сравнить фотосессии</strong>
            <p>Выберите две даты и ракурс для крупного сравнения.</p>
          </div>
          <select aria-label="Первая фотосессия для сравнения" value={compareIds[0]} onChange={(event) => setCompareIds([event.target.value, compareIds[1]])}>
            <option value="">Первая дата</option>
            {sortedPhotos.map((photo, index) => <option value={getPhotoId(photo, index)} key={`a-${getPhotoId(photo, index)}`}>{formatCompactDate(photo.date || photo.createdAt)}</option>)}
          </select>
          <select aria-label="Вторая фотосессия для сравнения" value={compareIds[1]} onChange={(event) => setCompareIds([compareIds[0], event.target.value])}>
            <option value="">Вторая дата</option>
            {sortedPhotos.map((photo, index) => <option value={getPhotoId(photo, index)} key={`b-${getPhotoId(photo, index)}`}>{formatCompactDate(photo.date || photo.createdAt)}</option>)}
          </select>
        </div>
      ) : null}

      {comparePhotos.length === 2 ? (
        <div className="trainerPhotoCompareGrid">
          {comparePhotos.map((photo) => (
            <figure key={`compare-${photo.id || photo.createdAt}`}>
              {renderPhotoMedia(photo, sortedPhotos.indexOf(photo))}
              <figcaption>{formatCompactDate(photo.date || photo.createdAt)}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <div className="trainerNextPhotoGrid">
        {sortedPhotos.map((photo, index) => (
          <figure key={getPhotoId(photo, index)}>
            <button type="button" onClick={() => setOpenPhotoId(getPhotoId(photo, index))} aria-label="Открыть фото клиента">
              {renderPhotoMedia(photo, index)}
            </button>
            <figcaption>{formatCompactDate(photo.date || photo.createdAt)}</figcaption>
          </figure>
        ))}
        {!sortedPhotos.length ? <div className="trainerNextEmpty">Фото прогресса пока не добавлены.</div> : null}
      </div>

      {activePhoto ? (
        <div className="trainerClientModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onClick={() => setOpenPhotoId("")}>
          <section className="trainerPhotoPreviewModal" role="dialog" aria-modal="true" aria-label="Просмотр фото клиента" data-trainer-modal-surface="true" data-trainer-modal-frame="true" onClick={(event) => event.stopPropagation()}>
            <header data-trainer-modal-header="true">
              <div><span>ФОТО КЛИЕНТА</span><h2>{formatCompactDate(activePhoto.date || activePhoto.createdAt)}</h2></div>
              <button className="trainerNextModalClose" type="button" onClick={() => setOpenPhotoId("")} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <div className="trainerPhotoPreviewBody" data-trainer-modal-content="true">
              <div className="trainerPhotoViewTabs">
                {photoViews.map((item) => <button type="button" className={view === item.id ? "active" : ""} aria-pressed={view === item.id} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
              </div>
              <div className="trainerPhotoPreviewImage">
                {renderPhotoMedia(activePhoto, sortedPhotos.indexOf(activePhoto))}
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

function getWorkoutNoteItems(history = []) {
  return history
    .flatMap((item) => {
      const workoutTitle = item.workoutName || item.workout || "Тренировка";
      const date = item.finishedAt || item.date || item.createdAt;
      const notes = [];
      const clientComment = String(item.clientComment || "").trim();

      if (clientComment) {
        const sourceCommentId = `${item.id || item.clientSaveId || date}-comment`;
        notes.push({
          id: sourceCommentId,
          title: workoutTitle,
          source: "Комментарий",
          text: clientComment,
          date,
          workoutId: item.workoutId || item.id || "",
          workoutName: workoutTitle,
          historyId: item.id || item.clientSaveId || "",
          sourceCommentId
        });
      }

      if (item.postWorkoutFeedback?.title) {
        const sourceCommentId = `${item.id || item.clientSaveId || date}-feedback`;
        notes.push({
          id: sourceCommentId,
          title: `${workoutTitle}: ${item.postWorkoutFeedback.title}`,
          source: "Самочувствие",
          text: item.postWorkoutFeedback.advice || "Клиент отметил самочувствие после тренировки.",
          date,
          workoutId: item.workoutId || item.id || "",
          workoutName: workoutTitle,
          historyId: item.id || item.clientSaveId || "",
          sourceCommentId
        });
      }

      (item.exercises || []).forEach((exercise, exerciseIndex) => {
        const exerciseNote = String(exercise.clientNote || "").trim();
        if (!exerciseNote) return;

        const sourceCommentId = `${item.id || item.clientSaveId || date}-exercise-${exercise.id || exerciseIndex}`;
        notes.push({
          id: sourceCommentId,
          title: exercise.name || workoutTitle,
          source: "Упражнение",
          text: exerciseNote,
          date,
          workoutId: item.workoutId || item.id || "",
          workoutName: workoutTitle,
          historyId: item.id || item.clientSaveId || "",
          exerciseId: exercise.id || "",
          exerciseName: exercise.name || "",
          sourceCommentId
        });
      });

      return notes;
    })
    .sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime())
    .slice(0, 12);
}

function ClientMessages({
  history = [],
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
    { id: "all", label: "Все", count: messages.length },
    { id: "pending", label: "Ждут ответа", count: pendingCount },
    { id: "processed", label: "Обработаны", count: processedCount }
  ];

  function selectFilter(nextFilter) {
    setFilter(nextFilter);
    setExpanded(false);
  }

  return (
    <section className={`${trainerClientMessagesStyles.panel} ${embedded ? trainerClientMessagesStyles.embeddedPanel : ""}`} aria-labelledby="trainer-client-messages-title">
      <header className={`${trainerClientMessagesStyles.header} ${embedded ? trainerClientMessagesStyles.embeddedHeader : ""}`}>
        <div className={trainerClientMessagesStyles.heading}>
          {!embedded && (
            <span className={trainerClientMessagesStyles.chatAvatar} aria-hidden="true"><MessageSquare size={19} /></span>
          )}
          <div>
            <h2 id="trainer-client-messages-title">{embedded ? "Новые сообщения" : "Сообщения"}</h2>
            <p>{pendingCount ? `${pendingCount} ждут ответа` : "Все сообщения обработаны"}</p>
          </div>
        </div>
      </header>

      {resolutionStatus ? <p className={trainerClientMessagesStyles.resolutionStatus} role="status">{resolutionStatus}</p> : null}

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
            disabled={resolvingAll}
            onClick={() => onMarkAllProcessed(pendingMessages)}
          >
            <Check size={14} /><span>{resolvingAll ? "Обрабатываем…" : "Обработать все"}</span>
          </button>
        ) : null}
      </div>

      <div className={trainerClientMessagesStyles.feed}>
        {visibleMessages.length ? (
          visibleMessages.map((item) => {
            const processed = processedMessageIds.has(item.id);
            return (
              <article className={`${trainerClientMessagesStyles.card} ${processed ? trainerClientMessagesStyles.cardProcessed : trainerClientMessagesStyles.cardPending}`} key={item.id}>
                <div className={trainerClientMessagesStyles.cardBody}>
                  <div className={trainerClientMessagesStyles.cardHeader}>
                    <div className={trainerClientMessagesStyles.messageTitle}>
                      <strong title={item.title}>{item.title}</strong>
                      <span>{item.source}</span>
                    </div>
                    <time>{formatCompactDate(item.date)}</time>
                  </div>
                  <div className={trainerClientMessagesStyles.bubble}>
                    <p className={trainerClientMessagesStyles.text}>{item.text}</p>
                  </div>
                  <div className={trainerClientMessagesStyles.messageFooter}>
                    <span className={processed ? trainerClientMessagesStyles.processedBadge : trainerClientMessagesStyles.pendingBadge}>
                      {processed ? <><Check size={11} />Обработано</> : "Ждёт ответа"}
                    </span>
                    {onReplyToMessage ? (
                      <div className={trainerClientMessagesStyles.actions}>
                      <button
                        type="button"
                        className={`${trainerClientMessagesStyles.reply} ${processed ? "" : trainerClientMessagesStyles.replyPrimary}`}
                        onClick={() => onReplyToMessage(item)}
                      >
                        <Mail size={13} />{processed ? "Ответить ещё раз" : "Ответить"}
                      </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className={trainerClientMessagesStyles.empty}>
            <MessageSquare size={22} />
            <strong>{messages.length ? "В этой группе сообщений нет" : "Сообщений пока нет"}</strong>
            <p>{messages.length ? "Выберите другой фильтр." : "Комментарии появятся после завершения тренировок клиентом."}</p>
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
  const [selectedDates, setSelectedDates] = useState(() => getWorkoutScheduleInitialDates(client, workouts));
  const [monthKey, setMonthKey] = useState(() => getLocalDateKey().slice(0, 7));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(Boolean(startEditing));
  const [editingSubscription, setEditingSubscription] = useState(false);
  const [subscriptionDraft, setSubscriptionDraft] = useState(() => ({
    startDate: subscription.startDate || "",
    endDate: subscription.endDate || "",
    purchasedSessions: Math.max(0, Number(subscription.purchasedSessions ?? subscription.totalSessions) || 0),
    usedSessions: Math.max(0, Number(subscription.usedSessions) || 0),
    frozen: subscription.frozen === true
  }));
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
  const subscriptionRangeStart = subscriptionDraft.startDate || "";
  const subscriptionRangeEnd = subscriptionDraft.endDate || "";
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

  useEffect(() => {
    if (editingSubscription) return;
    setSubscriptionDraft({
      startDate: subscription.startDate || "",
      endDate: subscription.endDate || "",
      purchasedSessions: Math.max(0, Number(subscription.purchasedSessions ?? subscription.totalSessions) || 0),
      usedSessions: Math.max(0, Number(subscription.usedSessions) || 0),
      frozen: subscription.frozen === true
    });
  }, [
    editingSubscription,
    subscription.endDate,
    subscription.frozen,
    subscription.purchasedSessions,
    subscription.startDate,
    subscription.totalSessions,
    subscription.usedSessions
  ]);

  function shiftMonth(delta) {
    const [year, month] = monthKey.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setMonthKey(getLocalDateKey(next).slice(0, 7));
  }

  function toggleDate(dateKey) {
    if (!editing || isProgramCompleted) return;
    setSelectedDates((current) => {
      const exists = current.includes(dateKey);
      if (exists) return current.filter((date) => date !== dateKey);
      if (dateKey < todayKey) return current;
      if (requiredCount && current.length >= requiredCount) return current;
      return [...current, dateKey].sort();
    });
  }

  function selectSubscriptionDate(dateKey) {
    if (!editingSubscription || saving) return;
    setSubscriptionDraft((current) => {
      if (!current.startDate || current.endDate) {
        return { ...current, startDate: dateKey, endDate: "" };
      }
      if (dateKey < current.startDate) {
        return { ...current, startDate: dateKey, endDate: current.startDate };
      }
      return { ...current, endDate: dateKey };
    });
  }

  function startSubscriptionEditing() {
    if (!onSaveSubscription || saving) return;
    setSelectedDates(getWorkoutScheduleInitialDates(client, workouts));
    setEditing(false);
    setEditingSubscription(true);
  }

  function cancelSubscriptionEditing() {
    if (saving) return;
    setSubscriptionDraft({
      startDate: subscription.startDate || "",
      endDate: subscription.endDate || "",
      purchasedSessions: Math.max(0, Number(subscription.purchasedSessions ?? subscription.totalSessions) || 0),
      usedSessions: Math.max(0, Number(subscription.usedSessions) || 0),
      frozen: subscription.frozen === true
    });
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

  return (
    <section className={`trainerClientAnalyticsCard trainerWorkoutSchedulePlanner ${editing ? "editing" : ""} ${editingSubscription ? "subscriptionEditing" : ""} ${isProgramCompleted ? "completedProgram" : ""}`}>
      <header>
        <div>
          <span>РАСПИСАНИЕ ПРОГРАММЫ</span>
          <h3>Даты тренировок клиента</h3>
        </div>
      </header>

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
            {monthDays.map((day) => {
              const selected = !isProgramCompleted && selectedSet.has(day.key);
              const isPastDate = day.key < todayKey;
              const entries = visibleEntriesByDate[day.key] || [];
              const statusClass = getWorkoutScheduleCalendarStatus(entries);
              const entryLabel = entries.map((entry) => `№${entry.order}`).join(", ");
              const subscriptionRange = Boolean(subscriptionRangeStart) && day.key >= subscriptionRangeStart && (!subscriptionRangeEnd || day.key <= subscriptionRangeEnd);
              const subscriptionStart = Boolean(subscriptionRangeStart) && day.key === subscriptionRangeStart;
              const subscriptionEnd = Boolean(subscriptionRangeEnd) && day.key === subscriptionRangeEnd;
              const canEditScheduleDay = selected || (!isPastDate && (!requiredCount || selectedDates.length < requiredCount));
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
                    subscriptionRange ? "subscriptionRange" : "",
                    subscriptionStart ? "subscriptionStart" : "",
                    subscriptionEnd ? "subscriptionEnd" : ""
                  ].filter(Boolean).join(" ")}
                  key={day.key}
                  onClick={() => editingSubscription ? selectSubscriptionDate(day.key) : toggleDate(day.key)}
                  disabled={editingSubscription ? false : !editing || !canEditScheduleDay}
                  title={editingSubscription ? `Выбрать ${formatSubscriptionDate(day.key)} для абонемента` : getWorkoutScheduleCalendarTitle(day.key, entries)}
                >
                  <b>{day.label}</b>
                  {entries.length ? <i>{entryLabel}</i> : selected ? <i>№{selectedOrder[day.key]}</i> : null}
                </button>
              );
            })}
          </div>
          <div className="trainerWorkoutScheduleLegend trainerWorkoutScheduleStats trainerWorkoutScheduleCalendarStatusLegend" aria-label="Статусы тренировок">
            <span className="is-planned">Плановая дата</span>
            <span className="is-completed">В срок</span>
            <span className="is-completedOffDate" aria-label="Выполнено в другой день" title="Выполнено в другой день">В другой день</span>
            <span className="is-missed">Пропущена</span>
            <span className="is-shifted">Смещена</span>
            <span className="is-pastCompleted">Прошлая тренировка</span>
          </div>
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
              <p>Период и количество занятий связаны с календарём тренировок клиента.</p>
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

function ClientWorkoutHistoryBlock({ history = [], showAll = false }) {
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const sortedHistory = [...history]
    .sort((a, b) => {
      const dateA = getWorkoutHistoryDate(a)?.getTime() || 0;
      const dateB = getWorkoutHistoryDate(b)?.getTime() || 0;
      return dateB - dateA;
    });
  const visibleHistory = showAll ? sortedHistory : sortedHistory.slice(0, 3);
  const olderHistory = showAll ? [] : sortedHistory.slice(3);

  useEffect(() => {
    if (!historyModalOpen || typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setHistoryModalOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [historyModalOpen]);

  return (
    <>
    <section className="trainerClientAnalyticsCard trainerClientWorkoutHistoryBlock">
      <header>
        <div>
          <span>ИСТОРИЯ ТРЕНИРОВОК</span>
          <h3>{showAll ? "История тренировок клиента" : "Последние тренировки клиента"}</h3>
          <p>{showAll
            ? "Все сохранённые тренировки клиента — от новых к более ранним."
            : "Короткая лента выполненных тренировок по этой программе и всем сохранённым записям клиента."}</p>
        </div>
        <strong>{history.length}<small>записей</small></strong>
      </header>

      {visibleHistory.length ? (
        <>
        <div className="trainerClientWorkoutHistoryList">
          {visibleHistory.map((item, index) => {
            const feedback = item.postWorkoutFeedback || item.readiness || {};
            return (
              <article key={item.id || item.clientSaveId || `${item.workout || "workout"}-${index}`}>
                <span>{feedback.emoji || "🏋️"}</span>
                <div>
                  <strong>{item.workoutName || item.workout || "Тренировка"}</strong>
                  <small>{formatWorkoutHistoryDuration(item.durationSeconds)} · {getWorkoutHistorySetSummary(item)}</small>
                </div>
                <time>{formatCompactDate(getWorkoutHistoryDate(item))}</time>
                <p>{feedback.title || item.clientComment || "Нормально"}</p>
              </article>
            );
          })}
        </div>
        {!showAll && olderHistory.length ? (
          <button className="trainerClientHistoryMoreButton" type="button" onClick={() => setHistoryModalOpen(true)}>
            Показать ещё {olderHistory.length} записей <ChevronRight size={14} aria-hidden="true" />
          </button>
        ) : null}
        </>
      ) : (
        <div className="trainerNextEmpty">История тренировок пока пустая. Когда клиент завершит тренировку, запись появится здесь.</div>
      )}
    </section>

    {!showAll && historyModalOpen ? (
      <div className="trainerClientModalBackdrop trainerWorkoutHistoryModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setHistoryModalOpen(false)}>
        <section className="trainerWorkoutHistoryModal" role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-workout-history-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <header data-trainer-modal-header="true">
            <div>
              <span>ИСТОРИЯ ТРЕНИРОВОК</span>
              <h2 id="trainer-workout-history-modal-title">Предыдущие тренировки</h2>
              <p>{olderHistory.length} записей до трёх последних тренировок клиента.</p>
            </div>
            <button className="trainerNextModalClose" type="button" onClick={() => setHistoryModalOpen(false)} aria-label="Закрыть историю тренировок"><X size={18} /></button>
          </header>
          <div className="trainerWorkoutHistoryModalBody" data-trainer-modal-content="true">
            <div className="trainerClientWorkoutHistoryList trainerWorkoutHistoryModalList">
              {olderHistory.map((item, index) => {
                const feedback = item.postWorkoutFeedback || item.readiness || {};
                return (
                  <article key={item.id || item.clientSaveId || `${item.workout || "workout"}-${index + visibleHistory.length}`}>
                    <span>{feedback.emoji || "🏋️"}</span>
                    <div>
                      <strong>{item.workoutName || item.workout || "Тренировка"}</strong>
                      <small>{formatWorkoutHistoryDuration(item.durationSeconds)} · {getWorkoutHistorySetSummary(item)}</small>
                    </div>
                    <time>{formatCompactDate(getWorkoutHistoryDate(item))}</time>
                    <p>{feedback.title || item.clientComment || "Нормально"}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    ) : null}
    </>
  );
}

function ClientWorkoutReviewPanel({ review, onAdjustNextWorkout }) {
  if (!review?.workoutId && !review?.workoutName) return null;

  const statusText = review.reviewed
    ? "Проверено тренером"
    : review.needsTrainerReply
      ? "Нужна реакция тренера"
      : "Без срочных сигналов";
  const skippedText = review.skippedExercises?.length
    ? review.skippedExercises.slice(0, 3).join(", ")
    : "нет";

  return (
    <section className="trainerClientAnalyticsCard trainerClientWorkoutReviewPanel">
      <header>
        <div>
          <span>РАЗБОР ТРЕНИРОВКИ</span>
          <h3>{review.workoutName || "Последняя тренировка"}</h3>
          <p>Сравнение плановой тренировки с фактом клиента и сигналами после выполнения.</p>
        </div>
        <strong className={review.needsTrainerReply && !review.reviewed ? "warning" : "positive"}>
          {statusText}
        </strong>
      </header>

      <div className="trainerWorkoutReviewGrid">
        <article>
          <span>Упражнения</span>
          <strong>{review.completedExercisesCount || 0} / {review.plannedExercisesCount || 0}</strong>
          <small>выполнено из плана</small>
        </article>
        <article>
          <span>Подходы</span>
          <strong>{review.completedSetsCount || 0} / {review.plannedSetsCount || 0}</strong>
          <small>факт против плана</small>
        </article>
        <article>
          <span>Объём</span>
          <strong>{review.volumeKg || 0} кг</strong>
          <small>по заполненным подходам</small>
        </article>
        <article className={review.skippedExercises?.length ? "warning" : ""}>
          <span>Пропуски</span>
          <strong>{review.skippedExercises?.length || 0}</strong>
          <small>{skippedText}</small>
        </article>
      </div>

      {review.feedbackTitle || review.clientComment || review.hasPainComment ? (
        <div className="trainerWorkoutReviewFeedback">
          <span>{review.hasPainComment ? "⚠️" : "💬"}</span>
          <div>
            <strong>{review.feedbackTitle || (review.hasPainComment ? "Есть жалоба на боль" : "Комментарий клиента")}</strong>
            <p>{review.clientComment || "Клиент оставил оценку после тренировки. Проверьте, нужна ли корректировка нагрузки."}</p>
          </div>
        </div>
      ) : null}

      {review.needsTrainerReply && !review.reviewed && onAdjustNextWorkout ? (
        <button type="button" className="trainerWorkoutReviewAction" onClick={onAdjustNextWorkout}>
          Скорректировать следующую тренировку
        </button>
      ) : null}
    </section>
  );
}

function ClientWorkoutPlan({
  client,
  history,
  workouts,
  archivedWorkouts = [],
  programTemplates,
  selectedProgramId,
  onSelectProgram,
  onAssignProgram,
  onRenameProgramAssignment,
  onArchiveProgramAssignment,
  onRestoreProgramAssignment,
  onSaveWorkoutSchedule,
  onSaveSubscription,
  programStatus,
  adjustmentRequest,
  reviewEvents = [],
  onResolveWorkoutReview,
  editorProps
}) {
  const [editorOpen, setEditorOpen] = useState(Boolean(adjustmentRequest?.token));
  const [editorWorkoutId, setEditorWorkoutId] = useState(adjustmentRequest?.workoutId || "");
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorStatus, setEditorStatus] = useState("");
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
  const [programNameSaving, setProgramNameSaving] = useState(false);
  const [programNameStatus, setProgramNameStatus] = useState("");
  const [showBasicWorkoutHistory, setShowBasicWorkoutHistory] = useState(false);
  const [programHistoryOpen, setProgramHistoryOpen] = useState(false);
  const [scheduleAssignmentRequest, setScheduleAssignmentRequest] = useState(null);
  const [workoutInsightsOpen, setWorkoutInsightsOpen] = useState(false);

  useEffect(() => {
    if ((!editorOpen && !reviewDecisionOpen && !assignmentReviewOpen && !programAssignmentConfirm && !scheduleAssignmentRequest && !workoutInsightsOpen && !programHistoryOpen) || typeof document === "undefined") return undefined;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previousBodyStyle.overflow;
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.width = previousBodyStyle.width;
      window.scrollTo(0, scrollY);
    };
  }, [assignmentReviewOpen, editorOpen, programAssignmentConfirm, programHistoryOpen, reviewDecisionOpen, scheduleAssignmentRequest, workoutInsightsOpen]);

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
    client?.assignedProgramAddedAt,
    client?.assignedProgramAt,
    client?.assignedProgramId,
    client?.assignedProgramUpdatedAt,
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
    client?.assignedProgramAddedAt,
    client?.assignedProgramAt,
    client?.assignedProgramId,
    client?.assignedProgramUpdatedAt,
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
  const scheduleWorkouts = primaryProgramAssignment?.workouts || [];
  const scheduleHistory = primaryProgramAssignment?.history || [];
  const scheduleCompletedWorkoutIds = primaryProgramAssignment?.completedWorkoutIds || [];
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
  const selectedTemplate = programTemplates.find((program) => program.id === selectedProgramId);
  const latestWorkoutHistory = [...history]
    .sort((a, b) => {
      const dateA = getWorkoutHistoryDate(a)?.getTime() || 0;
      const dateB = getWorkoutHistoryDate(b)?.getTime() || 0;
      return dateB - dateA;
    })[0];
  const latestWorkoutReview = latestWorkoutHistory
    ? buildTrainerWorkoutReview(latestWorkoutHistory, findPlannedWorkoutForHistory(latestWorkoutHistory, workouts))
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
    workouts,
    calendar: client?.workoutCalendar || {},
    history
  }), [workouts, client?.workoutCalendar, history]);

  function closeEditor() {
    if (editorSaving || programNameSaving) return;
    setEditorOpen(false);
    setPendingReviewAdjustment(null);
    setEditorStatus("");
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
    setProgramNameDraft(assignedName);
    setProgramNameStatus("");
    setProgramNameEditorOpen(false);
    setEditorOpen(true);
  }

  async function confirmProgramAssignment(assignmentOptions = {}) {
    const result = await onAssignProgram?.({
      ...(assignmentOptions && typeof assignmentOptions === "object" ? assignmentOptions : {
        loadAdjustments: assignmentOptions
      }),
      skipConfirmation: true
    });
    if (result === false) return false;

    setScheduleAssignmentRequest({
      assignmentKey: String(result?.assignmentKey || "").trim(),
      programId: selectedTemplate?.id || "",
      knownAssignmentKeys: trainerProgramTimeline.map((assignment) => assignment.key)
    });
    return true;
  }

  async function saveClientProgramName(event) {
    event.preventDefault();
    const nextName = String(programNameDraft || "").trim();
    if (!nextName) {
      setProgramNameStatus("Введите название программы.");
      return;
    }
    if (!assignedProgramAssignment || programNameSaving) return;

    setProgramNameSaving(true);
    setProgramNameStatus("");
    try {
      const result = await onRenameProgramAssignment?.(assignedProgramAssignment, nextName);
      if (result === false) throw new Error("program-rename-failed");
      setProgramNameEditorOpen(false);
    } catch (error) {
      console.error("Client program rename failed:", error);
      setProgramNameStatus("Не удалось сохранить название. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setProgramNameSaving(false);
    }
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
    if (editorSaving) return;
    setEditorSaving(true);
    setEditorStatus("");
    try {
      const result = await editorProps?.onSave?.();
      if (result === false) {
        setEditorStatus("Не удалось сохранить изменения.");
        return;
      }
      if (pendingReviewAdjustment) {
        const resolved = await resolveWorkoutReview("adjusted", pendingReviewAdjustment.targetWorkoutId);
        if (!resolved) {
          setEditorStatus("Изменения сохранены, но не удалось закрыть сигнал.");
          return;
        }
      }
      setEditorOpen(false);
      setPendingReviewAdjustment(null);
    } catch (error) {
      console.error("Trainer workout editor save failed:", error);
      setEditorStatus("Не удалось сохранить изменения.");
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
        : null;
    if (typeof handler !== "function") {
      setProgramAssignmentStatus("Это действие сейчас недоступно.");
      return;
    }

    setProgramAssignmentSaving(true);
    setProgramAssignmentStatus("");
    try {
      const result = await handler(assignment);
      if (result === false) {
        setProgramAssignmentStatus(
          action === "archive"
            ? "Не удалось архивировать программу. Проверьте доступ к клиенту и попробуйте ещё раз."
            : "Не удалось вернуть программу из архива. Проверьте доступ к клиенту и попробуйте ещё раз."
        );
        return;
      }
      setProgramAssignmentConfirm(null);
    } catch (error) {
      console.error("Client program assignment action failed:", error);
      setProgramAssignmentStatus("Не удалось сохранить изменение. Попробуйте ещё раз.");
    } finally {
      setProgramAssignmentSaving(false);
    }
  }

  return (
    <div className="trainerClientWorkoutPlan">
      <section className={trainerClientWorkoutPlanStyles.programCard}>
        <header className={trainerClientWorkoutPlanStyles.programHeader}>
          <span><ClipboardList size={19} /></span>
          <div className={trainerClientWorkoutPlanStyles.programHeaderCopy}>
            <h2>Программа тренировок клиента</h2>
            <p>Текущий план, следующее назначение и история клиента.</p>
          </div>
          {programTimeline.length || hasBasicProgramHistory ? (
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
              <div className={trainerClientWorkoutPlanStyles.currentProgramTop}>
                <div className={trainerClientWorkoutPlanStyles.currentMain}>
                  <span className={trainerClientWorkoutPlanStyles.programIcon}><Dumbbell size={21} /></span>
                  <div className={trainerClientWorkoutPlanStyles.currentInfo}>
                    <span>Назначенная программа</span>
                    <h3>{assignedProgramName}</h3>
                    <p>{assignedProgramWorkoutCount} {pluralize(assignedProgramWorkoutCount, "тренировка", "тренировки", "тренировок")} · выполнено {assignedProgramCompletion}%</p>
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

          <div className={trainerClientWorkoutPlanStyles.assignment}>
              <span>Назначить программу</span>
            <div className={trainerClientWorkoutPlanStyles.assignmentRow}>
              <div className={trainerClientWorkoutPlanStyles.selectField}>
                <select aria-label="Назначить программу клиенту" value={selectedProgramId || ""} onChange={(event) => onSelectProgram(event.target.value)}>
                  <option value="">Выберите программу</option>
                  {programTemplates
                    .filter((program) => getTrainerProgramStatusMeta(program).id !== TRAINER_PROGRAM_STATUSES.DRAFT)
                    .map((program) => <option value={program.id} key={program.id}>{program.name || "Без названия"}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              <button className={trainerClientWorkoutPlanStyles.assignButton} type="button" disabled={!selectedProgramId || !client} onClick={() => setAssignmentReviewOpen(true)}>
                <Check size={16} />Назначить
              </button>
            </div>
          </div>
        </div>
        {selectedTemplate && selectedProgramId !== client?.assignedProgramId
          ? <small className={trainerClientWorkoutPlanStyles.hint}>Будет назначена программа «{selectedTemplate.name || "Без названия"}».</small>
          : null}
        {programStatus ? <p className={trainerClientWorkoutPlanStyles.status}>{programStatus}</p> : null}
      </section>

      {programHistoryOpen ? (
        <TrainerClientUtilitySheet
          title="История программ"
          eyebrow="Программы клиента"
          variant="wide"
          onRequestClose={() => setProgramHistoryOpen(false)}
        >
          <section className={trainerClientWorkoutPlanStyles.programHistoryModal} aria-label="История назначенных программ">
            <header className={trainerClientWorkoutPlanStyles.programHistoryModalHeader}>
              <div>
                <span>ИСТОРИЯ НАЗНАЧЕНИЙ</span>
                <h3>Прошлые и будущие программы</h3>
                <p>Назначения тренера и самостоятельные планы клиента.</p>
              </div>
              {hasBasicProgramHistory ? (
                <label className={trainerClientWorkoutPlanStyles.assignmentHistoryToggle}>
                  <input
                    type="checkbox"
                    checked={showBasicWorkoutHistory}
                    onChange={(event) => setShowBasicWorkoutHistory(event.target.checked)}
                    aria-label="Показать историю базовых тренировок"
                  />
                  <span aria-hidden="true" />
                  <b>Базовые тренировки</b>
                </label>
              ) : null}
            </header>
            <div className={trainerClientWorkoutPlanStyles.assignmentHistoryList}>
              {programTimeline.length ? programTimeline.map((assignment) => {
                const isFuture = assignment.status === "future";
                const isCurrent = assignment.status === "current";
                const statusLabel = assignment.status === "past"
                  ? (assignment.completion === 100 ? "Пройдена" : "Завершена")
                  : assignment.status === "archived"
                    ? "Архив"
                    : isCurrent
                      ? "Текущая"
                      : "Будущая";
                const isTrainerAssigned = !assignment.isBasic;
                const canArchive = (isCurrent || isFuture) && isTrainerAssigned;
                const showArchiveRestore = assignment.status === "archived" && isTrainerAssigned;

                return (
                  <article className={`${trainerClientWorkoutPlanStyles.assignmentHistoryItem} ${trainerClientWorkoutPlanStyles[`assignment${assignment.status[0].toUpperCase()}${assignment.status.slice(1)}`] || ""}`} key={assignment.key}>
                    <span className={trainerClientWorkoutPlanStyles.assignmentHistoryIcon}><Dumbbell size={17} /></span>
                    <div className={trainerClientWorkoutPlanStyles.assignmentHistoryInfo}>
                      <div>
                        <strong>{assignment.name}</strong>
                        <span className={trainerClientWorkoutPlanStyles.assignmentBadge}>{statusLabel}</span>
                        {assignment.isBasic ? <span className={trainerClientWorkoutPlanStyles.assignmentOriginBadge}>Самостоятельно</span> : null}
                      </div>
                      <p>
                        {assignment.isBasic ? "План создан клиентом, не назначен тренером · " : ""}
                        {assignment.workoutCount} {pluralize(assignment.workoutCount, "тренировка", "тренировки", "тренировок")}
                        {assignment.status !== "future" ? ` · выполнено ${assignment.completion}%` : " · ещё не начата"}
                        {assignment.assignedAt ? ` · назначена ${formatCompactDate(assignment.assignedAt)}` : ""}
                      </p>
                    </div>
                    <div className={trainerClientWorkoutPlanStyles.assignmentHistoryActions}>
                      {canArchive ? (
                        <button
                          type="button"
                          onClick={() => requestProgramAssignmentAction(assignment, "archive")}
                          disabled={programAssignmentSaving}
                        >
                          <Archive size={15} />Архивировать
                        </button>
                      ) : null}
                      {showArchiveRestore ? (
                        <button
                          type="button"
                          onClick={() => requestProgramAssignmentAction(assignment, "restore")}
                          disabled={programAssignmentSaving}
                        >
                          <Archive size={15} />Достать из архива
                        </button>
                      ) : null}
                      {!canArchive && !showArchiveRestore ? (
                        <small>{assignment.isBasic ? "Самостоятельный план клиента" : "Программа сохранена в истории клиента"}</small>
                      ) : null}
                    </div>
                  </article>
                );
              }) : (
                <p className={trainerClientWorkoutPlanStyles.assignmentHistoryEmpty}>Назначений тренера пока нет. Включите базовые тренировки, чтобы посмотреть самостоятельный план клиента.</p>
              )}
            </div>
            {programAssignmentStatus ? <p className={trainerClientWorkoutPlanStyles.assignmentActionStatus} role="status">{programAssignmentStatus}</p> : null}
          </section>
        </TrainerClientUtilitySheet>
      ) : null}

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

      <ClientSectionLaunchButton
        icon={ClipboardList}
        title="Открыть разбор и историю тренировок"
        description={visibleWorkoutReview
          ? "Последняя тренировка, комментарий клиента и все сохранённые записи"
          : "Все сохранённые тренировки клиента в одном месте"}
        onClick={() => setWorkoutInsightsOpen(true)}
      />

      {workoutInsightsOpen ? (
        <TrainerClientUtilitySheet
          title="Разбор и история тренировок"
          eyebrow="Тренировки клиента"
          variant="wide"
          onRequestClose={() => setWorkoutInsightsOpen(false)}
        >
          <div className="trainerClientWorkoutInsightsSheet">
            {visibleWorkoutReview ? (
              <ClientWorkoutReviewPanel
                review={visibleWorkoutReview}
                onAdjustNextWorkout={() => {
                  setReviewStatus("");
                  setWorkoutInsightsOpen(false);
                  setReviewDecisionOpen(true);
                }}
              />
            ) : (
              <div className="trainerNextEmpty">Разбор появится после первой завершённой тренировки клиента.</div>
            )}
            <ClientWorkoutHistoryBlock history={history} showAll />
          </div>
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
            ? "Архивировать программу?"
            : programAssignmentConfirm.action === "restore"
              ? "Достать программу из архива?"
              : "Действие с программой?"}
          text={programAssignmentConfirm.action === "archive"
            ? "Программа исчезнет из текущего плана клиента, а выполненные тренировки и история останутся сохранены."
            : "Программа снова появится в плане клиента. Выполненные тренировки и история останутся без изменений."}
          confirmLabel={programAssignmentSaving
            ? "Сохраняю…"
            : (programAssignmentConfirm.action === "archive"
              ? "Архивировать"
              : "Достать из архива")}
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
        <div className="trainerClientModalBackdrop trainerWorkoutEditorModalBackdrop" data-trainer-modal-backdrop="true" role="dialog" aria-modal="true" aria-label="Редактор программы клиента" onClick={closeEditor}>
          <section className={`trainerWorkoutEditorModal trainerClientProgramEditorModal ${trainerClientWorkoutPlanStyles.editorModal}`} data-trainer-modal-surface="true" data-trainer-modal-frame="true" onClick={(event) => event.stopPropagation()}>
            <header data-trainer-modal-header="true">
              <div className={trainerClientWorkoutPlanStyles.programEditorHeaderContent}>
                <span>РЕДАКТОР ПРОГРАММЫ</span>
                <div className={trainerClientWorkoutPlanStyles.programEditorTitleRow}>
                  <h2>{assignedName}</h2>
                  <button
                    className={trainerClientWorkoutPlanStyles.programRenameHeaderButton}
                    type="button"
                    onClick={() => {
                      setProgramNameDraft(assignedName);
                      setProgramNameStatus("");
                      setProgramNameEditorOpen(true);
                    }}
                    disabled={!onRenameProgramAssignment || programNameSaving}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span>Переименовать</span>
                  </button>
                </div>
                <p>Изменения применяются только к будущему плану клиента. Выполненные тренировки и история не меняются.</p>
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
                      <button type="submit" disabled={programNameSaving}>{programNameSaving ? "Сохраняю…" : "Сохранить"}</button>
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
                workouts={scheduleWorkouts}
                archivedWorkouts={[]}
                completedWorkoutIds={scheduleCompletedWorkoutIds}
                {...editorProps}
                initialWorkoutId={editorWorkoutId}
                onSave={saveEditorChanges}
              />
            </div>
            <footer className={trainerClientWorkoutPlanStyles.editorFooter} data-trainer-modal-footer="true">
              {editorStatus ? <p role="status">{editorStatus}</p> : null}
              <button type="button" onClick={closeEditor} disabled={editorSaving}>Отмена</button>
              <button type="button" onClick={saveEditorChanges} disabled={editorSaving}>
                {editorSaving ? "Сохраняю…" : "Сохранить"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ClientExerciseProgress({
  client,
  history = [],
  workouts = [],
  reviews = [],
  onResolve,
  onSaveAdjustment
}) {
  const [filter, setFilter] = useState("priority");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [decisionItem, setDecisionItem] = useState(null);
  const [locallyReviewedKeys, setLocallyReviewedKeys] = useState(() => new Set());
  const { allExerciseProgress } = getExerciseProgressData(history);
  const persistedReviewedKeys = useMemo(
    () => getTrainerExerciseProgressReviewedKeys(reviews),
    [reviews]
  );
  const reviewedKeys = useMemo(
    () => new Set([...persistedReviewedKeys, ...locallyReviewedKeys]),
    [locallyReviewedKeys, persistedReviewedKeys]
  );
  const exerciseProgress = allExerciseProgress.map((item) => {
    const reviewKey = getTrainerExerciseProgressReviewKey(item);
    return { ...item, reviewKey, reviewed: reviewedKeys.has(reviewKey) };
  });
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
  const displayedExerciseProgress = (() => {
    if (filter === "progress") return exerciseProgress.filter((item) => item.status === "progress");
    if (filter === "regression") return priorityProgress;
    if (filter === "all") return exerciseProgress;
    return priorityProgress;
  })();
  const focusText = (() => {
    if (!exerciseProgress.length) return "Появится после двух заполненных тренировок по одному упражнению.";
    if (filter === "progress") return "Здесь видны упражнения, где клиент реально прибавляет по силе, объёму или повторам.";
    if (filter === "regression") return "Это список для проверки: нагрузка могла просесть из-за восстановления, техники или смены условий.";
    if (filter === "all") return "Полный список анализируемых упражнений с последним сравнением.";
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
        {!displayedExerciseProgress.length ? <div className="trainerNextEmpty">По выбранному фильтру пока нет упражнений.</div> : null}
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
      {historyItem ? <ExerciseProgressHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} /> : null}
    </section>
  );
}

function ExerciseProgressHistoryModal({ item, onClose }) {
  useBodyScrollLock(true, { lockHtml: true });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="trainerExerciseProgressHistoryModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section className="trainerExerciseProgressHistoryModal" role="dialog" aria-modal="true" aria-labelledby="trainer-exercise-history-title">
        <header>
          <div>
            <span>ИСТОРИЯ УПРАЖНЕНИЯ</span>
            <h2 id="trainer-exercise-history-title">{item?.name || "Упражнение"}</h2>
            <p>Выполненные подходы и сравнение последних тренировок.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть историю"><X size={18} /></button>
        </header>
        <div className="trainerExerciseProgressHistoryModalBody">
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
            {item?.sessions?.map((session, sessionIndex) => (
              <article key={`${item.name}_${session.date?.toISOString?.() || sessionIndex}`}>
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
        <footer><button type="button" onClick={onClose}>Закрыть</button></footer>
      </section>
    </div>
  );
}

function NutritionAnalytics({ nutritionDays, target }) {
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
        <article><span>Соблюдение плана</span><strong>{adherence}%</strong><small>{adherence >= 85 ? "хороший результат" : "нужна корректировка"}</small></article>
      </section>

      <div className="trainerNutritionAnalyticsMain">
        <section className="trainerClientAnalyticsCard trainerNutritionCaloriesChart">
          <header><div><span>КАЛОРИЙНОСТЬ</span><h3>{period === "custom" ? "Питание за выбранный период" : `Питание за ${period} дней`}</h3></div><strong>цель {target.calories}</strong></header>
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
          <header><div><span>СРЕДНИЙ БАЛАНС</span><h3>Распределение БЖУ</h3></div><Utensils size={20} /></header>
          <div className="trainerNutritionDonutRow">
            <div
              className="trainerNutritionDonut"
              style={{ background: `conic-gradient(#e8f6ee 0 ${proteinAngle}deg, #fff4df ${proteinAngle}deg ${proteinAngle + fatAngle}deg, #eee8fa ${proteinAngle + fatAngle}deg 360deg)` }}
            >
              <span><strong>{averages.calories || "—"}</strong><small>ккал</small></span>
            </div>
            <div className="trainerNutritionLegend">
              <span className="protein"><b>Белки</b><strong>{averages.protein} г</strong></span>
              <span className="fat"><b>Жиры</b><strong>{averages.fat} г</strong></span>
              <span className="carbs"><b>Углеводы</b><strong>{averages.carbs} г</strong></span>
            </div>
          </div>
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

  return (
    <div className="trainerNutritionDiary">
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
          <strong>{Math.round(Number(totals.calories) || 0)} ккал</strong>
        </div>
        <div className="trainerNutritionDiaryTotals">
          <span>Б <b>{Math.round(Number(totals.protein) || 0)} г</b></span>
          <span>Ж <b>{Math.round(Number(totals.fat) || 0)} г</b></span>
          <span>У <b>{Math.round(Number(totals.carbs) || 0)} г</b></span>
        </div>
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
  const [editing, setEditing] = useState(!currentPlan);
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
      <section className="trainerNutritionCurrentPlan">
        <div className="trainerClientBlockHeading">
          <span><Utensils size={19} /></span>
          <div>
            <small>ПЛАН ПИТАНИЯ КЛИЕНТА</small>
            <h2>{visiblePlan.name || "Индивидуальный план"}</h2>
            <p>{visiblePlan.goal || "Цель пока не указана"}</p>
          </div>
        </div>
        <div className="trainerNutritionCurrentGoals">
          <span><small>Калории</small><strong>{Number(visiblePlan.calories) || 0} ккал</strong></span>
          <span><small>Белки</small><strong>{Number(visiblePlan.protein) || 0} г</strong></span>
          <span><small>Жиры</small><strong>{Number(visiblePlan.fat) || 0} г</strong></span>
          <span><small>Углеводы</small><strong>{Number(visiblePlan.carbs) || 0} г</strong></span>
        </div>
        <div className="trainerNutritionCurrentMeta">
          <span>Изменён: <b>{currentPlan?.updatedAt ? new Date(currentPlan.updatedAt).toLocaleDateString("ru-RU") : "не сохранялся"}</b></span>
          <span>Период: <b>{visiblePlan.validFrom ? `${visiblePlan.validFrom}${visiblePlan.validTo ? ` — ${visiblePlan.validTo}` : ""}` : "без ограничения"}</b></span>
          {!editing ? (
            <button
              type="button"
              className="trainerNutritionPlanEditButton"
              onClick={() => setEditing(true)}
            >
              Изменить план питания
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

function NutritionView({ client, profile = {}, history = [], nutritionDays, goals = {}, planOptions = [], onGeneratePlan, onSavePlan, status, onOpenDiary }) {
  const target = {
    calories: Number(goals.calories) || 2000,
    protein: Number(goals.protein) || 150,
    fat: Number(goals.fat) || 50,
    carbs: Number(goals.carbs) || 200
  };
  return (
    <div className="trainerNextNutrition trainerNextNutritionUnified trainerClientTabContent">
      <section id="trainerNutritionAnalytics" className="trainerNutritionUnifiedSection">
        <div className="trainerClientBlockHeading">
          <span><BarChart3 size={19} /></span>
          <div><h2>Аналитика питания</h2><p>Средние значения считаются по завершённым дням без сегодняшнего дня.</p></div>
        </div>
        <NutritionAnalytics nutritionDays={nutritionDays} target={target} />
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
      <ClientSectionLaunchButton
        icon={Eye}
        title="Открыть дневник питания"
        description="Все записи клиента по дням и приёмам пищи"
        onClick={onOpenDiary}
      />
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
  const subscription = client?.subscription || {};
  const telegram = client?.telegram || {};
  const connected = Boolean(telegram.connected || client?.telegramConnected || telegram.telegramUserId || client?.telegramUserId);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState("idle");
  const section = showNotificationSettings ? "notifications" : "subscription";
  const [subscriptionDraft, setSubscriptionDraft] = useState(() => ({
    startDate: subscription.startDate || "",
    endDate: subscription.endDate || "",
    purchasedSessions: Math.max(0, Number(subscription.purchasedSessions || subscription.totalSessions) || 0),
    usedSessions: Math.max(0, Number(subscription.usedSessions) || 0),
    frozen: subscription.frozen === true
  }));
  const [editingSubscription, setEditingSubscription] = useState(() => startSubscriptionEditing || !(subscription.startDate && subscription.endDate));
  const subscriptionStatus = getSubscriptionStatus({ ...subscription, ...subscriptionDraft }, new Date());
  const subscriptionStatusCopy = subscriptionStatus.id === "active"
    ? "Абонемент активен."
    : subscriptionStatus.id === "ending"
      ? "Абонемент скоро закончится."
      : subscriptionStatus.id === "frozen"
        ? "Абонемент заморожен."
        : subscriptionStatus.id === "expired"
          ? "Абонемент не активен."
          : "Абонемент продлён.";
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

  function selectSubscriptionDate(dateKey) {
    if (!editingSubscription) return;
    setSubscriptionDraft((current) => {
      if (!current.startDate || current.endDate) {
        return { ...current, startDate: dateKey, endDate: "" };
      }
      return dateKey < current.startDate
        ? { ...current, startDate: dateKey, endDate: current.startDate }
        : { ...current, endDate: dateKey };
    });
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
        {calendarDays.map((day) => {
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
          const subscriptionStart = day.key === subscriptionDraft.startDate;
          const subscriptionEnd = day.key === subscriptionDraft.endDate;
          const subscriptionBoundary = section === "subscription" && (subscriptionStart || subscriptionEnd);
          const editingSubscriptionStart = section === "subscription" && editingSubscription && subscriptionStart;
          const editingSubscriptionEnd = section === "subscription" && editingSubscription && subscriptionEnd;
          // The subscription remains visible as a calm range after saving.  The
          // start/end emphasis is deliberately kept for edit mode only, so a
          // trainer can read the active period without mistaking it for a
          // pending selection.
          const subscriptionRange = section === "subscription" && Boolean(subscriptionDraft.startDate) && day.key >= subscriptionDraft.startDate && (!subscriptionDraft.endDate || day.key <= subscriptionDraft.endDate);
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
                subscriptionRange ? "subscriptionRange" : "",
                subscriptionBoundary ? "subscriptionBoundary" : "",
                editingSubscriptionStart ? "subscriptionStart" : "",
                editingSubscriptionEnd ? "subscriptionEnd" : "",
                day.currentMonth ? "" : "muted",
                today ? "today" : "",
                photoReminder ? "photoReminder" : "",
                measurementReminder ? "measurementReminder" : ""
              ].filter(Boolean).join(" ")}
              aria-pressed={subscriptionRange || (section === "subscription" ? hasSubscriptionWorkout : plannedWorkout || completedWorkout)}
              disabled={section === "notifications" || (section === "subscription" && !editingSubscription)}
              onClick={() => {
                if (section === "subscription") selectSubscriptionDate(day.key);
              }}
                  aria-label={labels.length ? `${day.key}: ${labels.join(", ")}` : day.key}
            >
              <b className="trainerSubscriptionCalendarDayLabel">
                {day.label}
                {editingSubscriptionStart ? <span className="trainerSubscriptionCalendarRangeMark" aria-hidden="true">«</span> : null}
                {editingSubscriptionEnd && !editingSubscriptionStart ? <span className="trainerSubscriptionCalendarRangeMark" aria-hidden="true">»</span> : null}
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
                        {entry.status === "pastCompleted" ? "✓" : `№${entry.order}`}
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
      <span><i className="subscription" />Период абонемента</span>
      <span><i className="plannedWorkout" />Плановая тренировка</span>
      <span><i className="pastWorkout" />Прошлая тренировка</span>
      <span><i className="photo" />Фото</span>
      <span><i className="measurement" />Замеры</span>
    </div>
  );

  const calendarEditor = (
    <section className={`trainerNotificationCalendar trainerClientCalendarPanel ${workspaceFeatureStyles.notificationCalendar} ${section === "subscription" ? "trainerCalendarModeSubscription trainerSubscriptionCalendarUnified trainerNotificationCalendarUnified" : "trainerCalendarModeNotifications"} ${showNotificationSettings || section === "subscription" ? "trainerWorkoutSchedulePlanner" : ""} ${editingSubscription ? "editing" : ""}`}>
      {showNotificationSettings ? (
        <>
          <header>
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
          <header>
            <div>
              <span>АБОНЕМЕНТ</span>
              <h3>Расписание клиента</h3>
              <p>{editingSubscription
                ? "Выберите дату начала, затем дату окончания абонемента."
                : `${subscriptionStatusCopy} Действует: ${formatSubscriptionDate(subscriptionDraft.startDate)} — ${formatSubscriptionDate(subscriptionDraft.endDate)}. Показаны прошедшие и плановые тренировки.`}</p>
            </div>
            <strong className={subscriptionStatus.tone}>{subscriptionStatus.label}<small>абонемент</small></strong>
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
                <span><i className="subscription" />Период абонемента</span>
                <span><i className="plannedWorkout" />Плановая тренировка</span>
                <span><i className="completed" />В срок</span>
                <span><i className="completedOffDate" />Выполнено в другой день</span>
                <span><i className="missed" />Пропущена</span>
                <span><i className="shifted" />Смещена</span>
                <span><i className="pastWorkout" />Прошлая тренировка</span>
              </div>
            </div>
          </div>
        </>
      )}
      <small>{section === "subscription"
        ? editingSubscription
          ? subscriptionDraft.startDate
            ? subscriptionDraft.endDate
              ? `Период: ${formatSubscriptionDate(subscriptionDraft.startDate)} — ${formatSubscriptionDate(subscriptionDraft.endDate)}.`
              : "Теперь выберите дату окончания абонемента."
            : "Выберите дату начала абонемента."
          : subscriptionDraft.startDate && subscriptionDraft.endDate
            ? `Абонемент действует: ${formatSubscriptionDate(subscriptionDraft.startDate)} — ${formatSubscriptionDate(subscriptionDraft.endDate)}.`
            : "Абонемент не настроен."
        : "В календаре отмечены тренировки и ближайшие напоминания клиента."}</small>
      {section === "subscription" ? (
        <ClientCalendarSubscriptionFields
          client={client}
          draft={subscriptionDraft}
          onChange={setSubscriptionDraft}
          onSave={onSaveSubscription}
          editing={editingSubscription}
          onEdit={() => setEditingSubscription(true)}
          onCancel={subscription.startDate || subscription.endDate ? () => {
            setSubscriptionDraft({
              startDate: subscription.startDate || "",
              endDate: subscription.endDate || "",
              purchasedSessions: Math.max(0, Number(subscription.purchasedSessions || subscription.totalSessions) || 0),
              usedSessions: Math.max(0, Number(subscription.usedSessions) || 0),
              frozen: subscription.frozen === true
            });
            setEditingSubscription(false);
          } : undefined}
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
        <p className="trainerNotificationHint" role="status">
          {autoSaveState === "saving"
            ? "Сохраняем изменения…"
            : autoSaveState === "pending"
              ? "Изменения сохранятся автоматически…"
              : autoSaveState === "saved"
                ? "Все изменения сохранены автоматически."
                : autoSaveState === "error"
                  ? "Не удалось сохранить автоматически. Нажмите «Сохранить настройки», чтобы повторить попытку."
                  : autoSaveState === "needs_offset"
                    ? "Выберите хотя бы один интервал напоминания, чтобы сохранить настройки."
                    : "Все изменения на этой странице сохраняются автоматически."}
        </p>
        {status ? <p className="trainerNextProgramStatus">{status}</p> : null}
      </section>
        </>
      ) : null}
      {showCalendar && showNotificationSettings ? calendarEditor : null}
    </div>
  );
}

function ClientWorkSummary({
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
  const workoutCompletion = snapshot?.assignedWorkoutCount
    ? `${snapshot.completedWorkoutCount || 0} из ${snapshot.assignedWorkoutCount}`
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
  snapshot,
  workoutReview,
  history = [],
  onTabChange,
  onOpenCalendar,
  onOpenFeedback
}) {
  const items = Array.isArray(snapshot?.criticalAttentionItems)
    ? snapshot.criticalAttentionItems
    : [];
  if (!items.length) return null;

  const actionByType = {
    program: { target: "workouts", label: "Назначить программу", fallback: "Не назначена программа тренировок" },
    workout: { target: "workouts", label: "Открыть расписание", fallback: "Пропущены плановые тренировки" },
    feedback: { target: "feedback", label: "Открыть сообщение", fallback: "Нужна проверка самочувствия" },
    subscription: { target: "calendar", label: "Открыть абонемент", fallback: "Нужно проверить абонемент" }
  };
  const workoutNotes = getWorkoutNoteItems(history);
  const feedbackNote = workoutNotes.find((note) => (
    (workoutReview?.workoutId && note?.workoutId === workoutReview.workoutId)
    || (workoutReview?.historyId && note?.historyId === workoutReview.historyId)
  )) || workoutNotes[0] || null;

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
      onTabChange?.("messages");
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
            <button type="button" onClick={() => openAttention(action)}>{action.label}<ChevronRight size={16} /></button>
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
  onTabChange,
  onBack,
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
    profile?.weight ? `${profile.weight} кг` : ""
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
  const [utilitySheet, setUtilitySheet] = useState("");
  const [setupChecklist, setSetupChecklist] = useState(() => getTrainerClientSetupChecklist(client));
  const [setupWizardOpen, setSetupWizardOpen] = useState(() => (
    showSetupWizard && hasCompletedClientQuestionnaire({ ...client, profile: client?.profile || profile }) &&
    getTrainerClientSetupChecklist(client).status !== "completed"
  ));
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
  const clientNotificationsEnabled = client.telegramNotificationsEnabled !== false &&
    client.workoutCalendar?.reminderEnabled !== false;
  const clientActions = [
    client.archived
      ? { id: "restore", label: "Восстановить клиента", icon: "♻️" }
      : { id: "archive", label: "Архивировать клиента", icon: "📦" },
    { id: "open_notifications", label: "Настроить уведомления", icon: "🔔" },
    { id: "export_excel", label: "Скачать таблицу (CSV)", icon: "📊" },
    { id: "export_pdf", label: "Открыть отчёт для PDF", icon: "📄" },
    clientNotificationsEnabled
      ? { id: "disable_notifications", label: "Отключить напоминания", icon: "🔕" }
      : { id: "enable_notifications", label: "Включить напоминания", icon: "🔔" },
    canDeleteClient
      ? { id: "delete", label: "Удалить клиента", icon: "🗑️", danger: true }
      : null
  ].filter(Boolean);

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
    setActionsOpen(false);
    if (actionId === "open_notifications") {
      setUtilitySheet("notifications");
      return;
    }
    await onClientAction?.(actionId, client);
  }

  const isClientTabActive = (tab) => (
    (tab.id === "exercises" && exercisesOpen)
    || (tab.id === "messages" && messagesOpen)
    || currentTab === tab.id
    || (tab.id === "bodyProgress" && ["measurements", "photos"].includes(currentTab))
  );

  useEffect(() => {
    const nextChecklist = getTrainerClientSetupChecklist(client);
    setSetupChecklist(nextChecklist);
    setSetupWizardOpen(
      showSetupWizard &&
      hasCompletedClientQuestionnaire({ ...client, profile: client?.profile || profile }) &&
      nextChecklist.status !== "completed"
    );
  }, [client.id]);

  useEffect(() => {
    if (activeTab !== "exerciseProgress") return;
    setUtilitySheet("exerciseProgress");
    onTabChange("workouts");
  }, [activeTab, onTabChange]);

  useEffect(() => {
    if (activeTab !== "calendar") return;
    setUtilitySheet("calendar");
    onTabChange("overview");
  }, [activeTab, onTabChange]);

  useEffect(() => {
    if (activeTab !== "tasks") return;
    setUtilitySheet("tasks");
    onTabChange("overview");
  }, [activeTab, onTabChange]);

  async function completeSetupStep(step) {
    const previousChecklist = setupChecklist;
    const optimisticChecklist = buildNextTrainerClientSetupChecklist(
      setupChecklist,
      step
    );

    // Move the trainer to the following setup task immediately after the
    // actual setting is saved. The Firestore write follows in the background
    // and replaces this local state with its persisted counterpart.
    setSetupChecklist(optimisticChecklist);
    setSetupWizardOpen(optimisticChecklist.status !== "completed");

    if (!onSaveClientSetupProgress) return false;
    let nextChecklist;
    try {
      nextChecklist = await onSaveClientSetupProgress(
        step,
        client,
        setupChecklist
      );
    } catch {
      nextChecklist = false;
    }
    if (!nextChecklist || nextChecklist === false) {
      setSetupChecklist(previousChecklist);
      setSetupWizardOpen(previousChecklist.status !== "completed");
      return false;
    }
    setSetupChecklist(nextChecklist);
    setSetupWizardOpen(nextChecklist.status !== "completed");
    return nextChecklist;
  }

  async function saveSubscription(settings) {
    if (!onSaveNotifications) return false;
    return onSaveNotifications(settings, client);
  }

  async function assignProgram(options) {
    if (!onAssignProgram) return false;
    const assignment = await onAssignProgram(options);
    if (assignment !== false) {
      const checklist = await completeSetupStep("program");
      if (checklist === false) return false;
      return { assignment, checklist };
    }
    return assignment;
  }

  async function saveSetupWorkoutSchedule(dates, assignment) {
    if (!onSaveWorkoutSchedule) return false;
    const saved = await onSaveWorkoutSchedule(dates, assignment);
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
    <div className={`trainerNextPage trainerNextClientPage trainerNextClientVariantA ${mobileStyles.clientPageFix}`}>
      <div className={`trainerNextClientBackRow ${mobileStyles.clientToolbarFix}`}>
        <button className="trainerNextClientBackButton" type="button" onClick={onBack} aria-label="Назад к списку клиентов">
          <ArrowLeft size={20} />
          <span className="trainerNextClientBackDesktop">Назад к списку</span>
          <span className="trainerNextClientBackMobile">Клиенты</span>
        </button>
      </div>

      <header className="trainerNextClientHeader">
        <TrainerAvatar client={client} size="large" />
        <div>
          <div className="trainerNextClientName">
            <h1>{name}</h1>
            <div className="trainerNextClientStatusRow">
              <button
                className={`trainerNextClientSubscriptionStatus is-${clientSubscriptionBadge.id}`}
                type="button"
                onClick={() => setUtilitySheet("calendar")}
                aria-label="Открыть абонемент клиента"
              >
                {clientSubscriptionBadge.label}
              </button>
            </div>
          </div>
          <p>{profileMetaText}</p>
          <strong>Цель: {client.goalDescription || profile?.goalLabel || "Персональный результат"}</strong>
        </div>
        <div className={`trainerNextClientHeaderActions${setupChecklist.status !== "completed" ? " trainerNextClientHeaderActionsWithSetup" : ""}`} aria-label="Действия с клиентом">
          {setupChecklist.status !== "completed" ? (
            <button
              className="trainerNextClientHeaderUtilityButton trainerNextClientSetupButton"
              type="button"
              onClick={() => setSetupWizardOpen(true)}
              aria-label="Завершить первичную настройку клиента"
            >
              <ClipboardList size={17} />
              <span>Завершить<br />настройку</span>
            </button>
          ) : null}
          {onCreateTask ? (
            <button
              className="trainerNextClientTaskButton"
              type="button"
              onClick={() => setUtilitySheet("tasks")}
            >
              <ClipboardList size={17} />
              <span>Задания<br />клиенту</span>
            </button>
          ) : null}
          <button
            className="trainerNextClientHeaderUtilityButton"
            type="button"
            onClick={() => setUtilitySheet("messages")}
            aria-label="Сообщения клиента"
          >
            <MessageSquare size={16} />
            <span>Сообщения</span>
          </button>
          <button
            className="trainerNextClientHeaderUtilityButton trainerNextClientActionsButton"
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label="Действия с клиентом"
          >
            <EllipsisVertical size={18} />
            <span>Действия</span>
          </button>
        </div>
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

      {currentTab === "overview" ? (
        <ClientOverview
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
          onOpenFeedback={openMessageFromNote}
          onOpenMessage={() => openNewMessage("notification")}
          onOpenExerciseProgress={() => setUtilitySheet("exerciseProgress")}
        />
      ) : null}
      {exercisesOpen ? (
        <section className={`${trainerClientExercisesTabsStyles.section} trainerClientTabContent`}>
          <ClientWorkoutPlan
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
              editorProps={{
                exerciseLibrary,
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
      {currentTab === "nutrition" ? <NutritionView client={client} profile={profile} history={history} nutritionDays={nutritionDays} goals={nutritionGoals} planOptions={nutritionPlanOptions} onGeneratePlan={onGeneratePlan} onSavePlan={saveNutritionPlan} status={programStatus} onOpenDiary={() => setUtilitySheet("nutritionDiary")} /> : null}
      {["bodyProgress", "measurements", "photos"].includes(currentTab) ? <ClientBodyProgress measurements={measurements} photos={photos} /> : null}
      {currentTab === "notifications" ? <ClientNotifications key={client.id} client={client} workouts={workouts} history={history} measurements={measurements} photos={photos} status={programStatus} onSave={saveNotificationSettings} onTest={onTestNotification} onConnectTelegram={onConnectTelegram} onSaveSubscription={saveSubscription} /> : null}
      {messagesOpen ? (
        <ClientMessages
          history={history}
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
          eyebrow="Клиент"
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
        <TrainerClientUtilitySheet title="Календарь тренировок" eyebrow="Расписание и абонемент" variant="wide" onRequestClose={() => setUtilitySheet("")}>
          <ClientNotifications
            key={`utility-calendar-${client.id}`}
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
            startSubscriptionEditing={false}
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
        <div className="trainerClientModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActionsOpen(false)}>
          <section className="trainerClientActionSheet" role="dialog" aria-modal="true" aria-label="Управление клиентом" data-trainer-modal-surface="true" data-trainer-modal-frame="true">
            <header data-trainer-modal-header="true">
              <div><span>УПРАВЛЕНИЕ КЛИЕНТОМ</span><h2>{name}</h2></div>
              <button className="trainerNextModalClose" type="button" onClick={() => setActionsOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <div data-trainer-modal-content="true">
              {clientActions.map((action) => (
                <button className={action.danger ? "danger" : ""} type="button" key={action.id} onClick={() => runClientAction(action.id)}>
                  <span>{action.icon}</span>
                  <b>{action.label}</b>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      {setupWizardOpen ? (
        <TrainerClientSetupFlowModal
          client={client}
          clientName={name}
          checklist={setupChecklist}
          programTemplates={programTemplates}
          selectedProgramId={selectedProgramId}
          nutritionGoals={nutritionGoals}
          nutritionPlanOptions={nutritionPlanOptions}
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

function TrainerClientsPage({ clients, clientSummaries, onOpenClient, onCreateClient }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const summaries = clientSummaries;
  const filters = [
    ["all", "Все"],
    ["attention", "Внимание"],
    ["noProgram", "Без программы"],
    ["inactive", "Неактивные"]
  ];
  return (
    <div className="trainerNextPage trainerNextClientsPage">
      <div className="trainerNextDesktopPageHead">
        <div><h1>Клиенты</h1><p>{clients.length} {pluralize(clients.length, "клиент", "клиента", "клиентов")} в работе</p></div>
        <button className="trainerNextPrimary" type="button" onClick={onCreateClient}><Plus size={18} />Добавить клиента</button>
      </div>
      <header className="trainerNextMobileHeader trainerNextClientsMobileHeader">
        <div className="trainerNextMobileTitle">Клиенты</div>
      </header>
      <div className="trainerNextClientsStandalone">
        <div className="trainerNextClientSearchRow">
          <label className="trainerNextSearch open"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск клиента..." /></label>
          <button className="trainerNextClientSearchAdd" type="button" onClick={onCreateClient} aria-label="Добавить клиента">
            <Plus size={18} />
            <span>Добавить</span>
          </button>
        </div>
        <div className="trainerMessageFilters trainerClientFilters" role="group" aria-label="Фильтр клиентов">
          {filters.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={filter === id ? "active" : ""}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <DashboardClientList clients={clients} summaries={summaries} filter={filter} search={search} onOpenClient={onOpenClient} />
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
  if (!progress?.lastSession || Number(progress.sessionCount || 0) < 2) {
    return "Истории выполнения пока нет";
  }

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
  onUpdateExerciseName,
  onDeleteExercise,
  onMoveExercise,
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onUploadExerciseVideo,
  exerciseVideoUploadingId
}) {
  const [openCycles, setOpenCycles] = useState({});
  const [openWeeks, setOpenWeeks] = useState({});
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [isDayEditorOpen, setIsDayEditorOpen] = useState(false);

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
                            <video src={video} muted preload="metadata" aria-hidden="true" />
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
                            <label className="wide">
                              <span>Название</span>
                              <input value={exercise.name || ""} onChange={(event) => onUpdateExerciseName(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise, event.target.value)} />
                            </label>
                            <label>
                              <span>Отдых</span>
                              <input value={exercise.rest || ""} onChange={(event) => onUpdateExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, { rest: event.target.value })} placeholder="90 сек" />
                            </label>
                            <label className="trainerNextWeightToggle">
                              <span>Используется вес</span>
                              <input type="checkbox" checked={requiresWeight} onChange={(event) => onUpdateExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, { requiresWeight: event.target.checked, usesWeight: event.target.checked })} />
                            </label>
                            <label className="trainerNextVideoUpload">
                              <Upload size={16} />
                              <span>{exerciseVideoUploadingId === exercise.id ? "Загрузка..." : video ? "Заменить видео" : "Загрузить видео"}</span>
                              <input type="file" accept="video/*" disabled={exerciseVideoUploadingId === exercise.id} onChange={(event) => onUploadExerciseVideo(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, event.target.files?.[0])} />
                            </label>
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

              <button className="trainerProgramAddExercise" type="button" onClick={() => onAddExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id)}>
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
  programTemplates,
  selectedProgramId,
  onSelectProgram,
  onAssignProgram,
  onOpenProgramManager,
  activeWorkoutTab,
  onWorkoutTabChange,
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
  onUploadExerciseVideo,
  onUploadLibraryExerciseVideo,
  exerciseVideoUploadingId,
  onAddDay,
  onDuplicateDay,
  onRemoveDay,
  onSave
}) {
  const tab = activeWorkoutTab || "plan";
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(initialWorkoutId || workouts[0]?.id || "");
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryEditorTarget, setLibraryEditorTarget] = useState(null);
  const [libraryEditorDraft, setLibraryEditorDraft] = useState(null);
  const [libraryEditorSaving, setLibraryEditorSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
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
  const library = useMemo(() => {
    const map = new Map();
    const addExercise = (exercise, sourceWorkoutId = "") => {
      const key = String(exercise.name || "").trim().toLowerCase();
      if (!key) return;
      const current = map.get(key);
      const candidate = sourceWorkoutId ? { ...exercise, sourceWorkoutId } : exercise;
      if (!current || (!getExerciseVideo(current) && getExerciseVideo(exercise))) {
        map.set(key, candidate);
      } else if (sourceWorkoutId && !current.sourceWorkoutId) {
        map.set(key, { ...current, sourceWorkoutId, id: exercise.id || current.id });
      }
    };

    (exerciseLibrary || []).forEach((exercise) => addExercise(exercise));
    workouts.forEach((workout) => {
      (workout.exercises || []).forEach((exercise) => addExercise(exercise, workout.id));
    });
    return [...map.values()];
  }, [exerciseLibrary, workouts]);
  const filteredLibrary = library.filter((exercise) =>
    !librarySearch || String(exercise.name || "").toLowerCase().includes(librarySearch.toLowerCase())
  );
  const selectedWorkoutIndex = selectedWorkout
    ? displayWorkouts.findIndex((item) => item.id === selectedWorkout.id)
    : -1;
  const selectedWorkoutStatus = getWorkoutStatusMeta(selectedWorkout?.displayStatus || selectedWorkout?.status);
  const libraryEditorWorkout = libraryEditorTarget
    ? workouts.find((workout) => workout.id === libraryEditorTarget.workoutId)
    : null;
  const libraryEditorExercise = libraryEditorWorkout?.exercises?.find((exercise) => exercise.id === libraryEditorTarget?.exerciseId)
    || library.find((exercise) => exercise.id === libraryEditorTarget?.exerciseId && exercise.librarySource?.templateId === libraryEditorTarget?.templateId)
    || libraryEditorTarget?.exercise
    || null;
  const libraryEditorSourceExercise = libraryEditorExercise && libraryEditorWorkout
    ? {
      ...libraryEditorExercise,
      librarySource: { type: "plan", workoutId: libraryEditorWorkout.id },
    }
    : libraryEditorExercise;
  const activeLibraryEditorExercise = libraryEditorDraft || libraryEditorExercise;

  function createLibraryEditorDraft(exercise) {
    if (!exercise) return null;
    const usesWeight = exercise.requiresWeight ?? exercise.usesWeight ?? true;
    const sets = exercise.sets?.length ? exercise.sets : [{ reps: "", weight: "" }];
    return {
      ...exercise,
      requiresWeight: usesWeight,
      usesWeight,
      sets: sets.map((set) => ({ ...set }))
    };
  }

  function openLibraryEditor(exercise) {
    if (!exercise) return;
    setLibraryEditorTarget({ workoutId: exercise.sourceWorkoutId || "", exerciseId: exercise.id, templateId: exercise.librarySource?.templateId || "", exercise });
    setLibraryEditorDraft(createLibraryEditorDraft(exercise));
  }

  async function createLibraryExercise() {
    const exercise = selectedWorkout
      ? await onAddExercise?.(selectedWorkout.id, { name: "Новое упражнение" })
      : await onCreateLibraryExercise?.(selectedProgramId, { name: "Новое упражнение" });
    if (!exercise) return;

    openLibraryEditor({
      ...exercise,
      ...(selectedWorkout ? {
        sourceWorkoutId: selectedWorkout.id,
        librarySource: { type: "plan", workoutId: selectedWorkout.id }
      } : {})
    });
  }

  function closeLibraryEditor() {
    if (libraryEditorSaving) return;
    setLibraryEditorTarget(null);
    setLibraryEditorDraft(null);
  }

  function updateLibraryEditorExercise(patch) {
    setLibraryEditorDraft((current) => current ? { ...current, ...patch } : current);
  }

  function updateLibraryEditorSet(setIndex, patch) {
    const safePatch = sanitizeExerciseSetPatch(patch);
    setLibraryEditorDraft((current) => {
      if (!current) return current;
      const sets = (current.sets?.length ? current.sets : [{ reps: "", weight: "" }]).map((set, index) => (
        index === setIndex ? { ...set, ...safePatch } : set
      ));
      return { ...current, sets };
    });
  }

  function addLibraryEditorSet() {
    setLibraryEditorDraft((current) => {
      if (!current) return current;
      const sets = current.sets?.length ? current.sets : [{ reps: "", weight: "" }];
      const firstSet = sets[0] || { reps: "", weight: "" };
      return { ...current, sets: [...sets, { ...firstSet, id: undefined }] };
    });
  }

  function removeLibraryEditorSet(setIndex) {
    setLibraryEditorDraft((current) => {
      if (!current) return current;
      const sets = current.sets?.length ? current.sets : [{ reps: "", weight: "" }];
      if (sets.length <= 1) return current;
      return { ...current, sets: sets.filter((_, index) => index !== setIndex) };
    });
  }

  async function saveLibraryEditor() {
    if (!libraryEditorExercise || !libraryEditorDraft || libraryEditorSaving) return;
    setLibraryEditorSaving(true);
    const patch = { ...libraryEditorDraft };
    delete patch.librarySource;
    delete patch.sourceWorkoutId;
    try {
      const saved = await onUpdateLibraryExercise?.(libraryEditorSourceExercise, patch);
      if (saved !== false) {
        setLibraryEditorTarget(null);
        setLibraryEditorDraft(null);
      }
    } finally {
      setLibraryEditorSaving(false);
    }
  }

  async function removeLibraryEditor() {
    if (!libraryEditorExercise || libraryEditorSaving) return;
    setLibraryEditorSaving(true);
    try {
      const removed = await onRemoveLibraryExercise?.(libraryEditorSourceExercise);
      if (removed !== false) {
        setLibraryEditorTarget(null);
        setLibraryEditorDraft(null);
      }
    } finally {
      setLibraryEditorSaving(false);
    }
  }

  function confirmRemoveLibraryEditor() {
    if (!libraryEditorExercise) return;
    setConfirmAction({
      title: "Удалить упражнение",
      text: `Упражнение «${libraryEditorExercise.name || "Без названия"}» будет удалено из библиотеки и связанного плана.`,
      onConfirm: () => {
        setConfirmAction(null);
        void removeLibraryEditor();
      }
    });
  }

  async function uploadLibraryEditorVideo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !libraryEditorExercise || libraryEditorSaving) return;
    const url = await onUploadLibraryExerciseVideo?.(libraryEditorSourceExercise, file);
    if (typeof url === "string") {
      updateLibraryEditorExercise({ video: url, videoAutoFilledFrom: "" });
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
      title: "Удалить упражнение",
      text: `Упражнение «${exercise.name || "Без названия"}» будет удалено из текущей тренировки.`,
      onConfirm: () => {
        const removed = onRemoveExercise?.(selectedWorkout.id, exercise.id, exerciseIndex);
        if (removed === false) return;
        if (expandedExerciseId === exercise.id) setExpandedExerciseId("");
        setConfirmAction(null);
      }
    });
  }

  return (
    <div className={embedded ? "trainerNextEmbeddedPlan trainerNextWorkoutPage" : "trainerNextPage trainerNextWorkoutPage"}>
      {!embedded ? <div className="trainerNextDesktopPageHead">
        <div><h1>{tab === "library" ? "Моя библиотека упражнений" : "План тренировок"}</h1><p>{tab === "library" ? "Личные упражнения из ваших программ" : client ? `Клиент: ${client.name || client.email}` : "Выберите клиента"}</p></div>
        {tab === "plan" ? (
          <div className="trainerNextHeadActions">
            <button type="button" onClick={() => setPreviewOpen(true)}><Eye size={17} />Предпросмотр</button>
            <button className="trainerNextPrimary" type="button" onClick={onSave}><Save size={17} />Сохранить</button>
          </div>
        ) : null}
      </div> : null}
      {!embedded ? <header className="trainerNextMobileHeader">
        <div className="trainerNextMobileTitle">{tab === "library" ? "Моя библиотека" : "План тренировок"}</div>
        {tab === "plan" ? <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Предпросмотр"><Eye size={21} /></button> : <span />}
      </header> : null}
      {!embedded ? <div className="trainerNextPageTabs" aria-label="Разделы программ">
        <button type="button" onClick={onOpenProgramManager}>Программы</button>
        <button type="button" className={tab === "library" ? "isActive" : ""} aria-current={tab === "library" ? "page" : undefined} aria-pressed={tab === "library"} onClick={() => onWorkoutTabChange("library")}>Моя библиотека упражнений</button>
      </div> : null}

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
        <div className="trainerNextWorkoutLayout">
          <aside className="trainerNextWorkoutDays">
            {displayWorkouts.map((workout, index) => {
              const isActive = selectedWorkout?.id === workout.id;
              const visualStatus = workout.displayStatus || workout.status || "planned";
              const statusMeta = getWorkoutStatusMeta(visualStatus);
              const statusClass = visualStatus;
              const isReadOnly = completedWorkoutIdSet.has(String(workout.id || ""));
              return (
                <div className={`trainerNextWorkoutDayItem ${statusClass}${isActive ? " active" : ""}`} key={workout.id || index}>
                  <button type="button" className="trainerNextWorkoutDaySelect" aria-pressed={isActive} onClick={() => setSelectedWorkoutId(workout.id)}>
                    <strong>
                      День {index + 1}
                      {visualStatus === "completed" ? <span className="trainerWorkoutDayDoneMark" aria-label="Выполнена">✓</span> : null}
                      {visualStatus !== "completed" && index === 0 ? <CalendarDays size={14} /> : null}
                    </strong>
                    <small>{getWorkoutTitle(workout, index).replace(/^День\s*\d+\s*[-–—:]?\s*/i, "") || "Тренировка"}</small>
                    <em>{workout.exercises?.length || 0} упр.</em>
                    <i>{statusMeta.icon} {statusMeta.label}</i>
                  </button>
                  {isActive ? (
                    <div className="trainerNextWorkoutDayActions">
                      <button type="button" disabled={isReadOnly} onClick={() => onDuplicateDay(workout.id)} aria-label="Копировать тренировку" title="Копировать"><Copy size={13} /></button>
                      <button type="button" disabled={isReadOnly} onClick={() => confirmRemoveWorkout(workout)} aria-label="Удалить тренировку" title="Удалить"><Trash2 size={13} /></button>
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
            {selectedWorkout ? (
              <>
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
                      <option value={option.id} key={option.id}>{option.icon} {option.label}</option>
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
              {selectedWorkoutReadOnly ? <p className="trainerNextWorkoutReadOnlyHint">Выполненная тренировка доступна только для просмотра. Корректируйте следующие дни программы.</p> : null}
              </>
            ) : <h2>Добавьте тренировочный день</h2>}
            <div className="trainerNextExerciseHead" aria-hidden="true">
              <span /><span /><span>Упражнение</span>
              <span className="trainerNextExerciseStatsHead"><span>Подходы</span><span>Повторения</span><span>Вес</span><span>Отдых</span></span>
              <span className="trainerNextExerciseProgressHead">Прогресс</span>
              <span />
            </div>
            <div className="trainerNextExerciseList">
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
                  ? formatTrainerExerciseSession(progress.lastSession)
                  : client?.trainerHistoryLoadError
                    ? "Не удалось загрузить историю выполнения"
                  : Number(progress?.matchedHistoryCount || 0) > 0
                    ? "Запись есть, но рабочие подходы не сохранены"
                    : "Истории выполнения пока нет";
                const progressComparison = formatTrainerExerciseComparison(progress);
                const estimatedOneRepMax = formatTrainerEstimatedOneRepMax(progress?.lastSession);
                return (
                  <article className={isExpanded ? "expanded" : ""} key={exercise.id || index}>
                    <div className="trainerNextExerciseRow">
                      <span className="trainerNextExerciseMove">
                        <GripVertical size={15} />
                        <button type="button" disabled={selectedWorkoutReadOnly || index === 0} onClick={() => onMoveExercise(selectedWorkout.id, exercise.id, -1)} aria-label="Поднять упражнение"><ChevronUp size={13} /></button>
                        <button type="button" disabled={selectedWorkoutReadOnly || index === selectedWorkout.exercises.length - 1} onClick={() => onMoveExercise(selectedWorkout.id, exercise.id, 1)} aria-label="Опустить упражнение"><ChevronDown size={13} /></button>
                      </span>
                      <span className="trainerNextExerciseImage">
                        {exercise.image || exercise.thumbnail ? (
                          <img src={exercise.image || exercise.thumbnail} alt="" />
                        ) : video ? (
                          <video src={video} muted preload="metadata" aria-hidden="true" />
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
                        <span className="trainerNextExerciseMetric"><strong>{sets.length}</strong><small>подх.</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{getExerciseSetSummary(sets, "reps")}</strong><small>повт.</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{requiresWeight ? getExerciseSetSummary(sets, "weight", " кг") : "—"}</strong><small>вес</small></span>
                        <span className="trainerNextExerciseMetric"><strong>{exercise.rest || "90 сек"}</strong><small>отдых</small></span>
                      </span>
                      <span className={`trainerNextExerciseProgress${hasComparison ? " hasComparison" : " needsHistory"}`} title={hasComparison ? progressComparison : "Для сравнения нужны две выполненные тренировки с этим упражнением"}>
                        <strong>{progressTitle}</strong>
                        {hasExerciseHistory ? <small>{[estimatedOneRepMax, progressComparison].filter(Boolean).join(" · ")}</small> : null}
                      </span>
                      <div className="trainerNextExerciseActions">
                        <button type="button" onClick={() => setExpandedExerciseId(isExpanded ? "" : exercise.id)} aria-label={isExpanded ? "Свернуть упражнение" : "Редактировать упражнение"}><EllipsisVertical size={17} /></button>
                        <button type="button" disabled={selectedWorkoutReadOnly} onClick={() => confirmRemoveExercise(exercise, index)} aria-label="Удалить упражнение"><Trash2 size={15} /></button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="trainerNextExerciseEditor">
                        <div className="trainerNextExerciseFields">
                          <label className="wide"><span>Название</span><input value={exercise.name || ""} disabled={selectedWorkoutReadOnly} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { name: event.target.value })} /></label>
                          <label><span>Отдых</span><input value={exercise.rest || ""} disabled={selectedWorkoutReadOnly} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { rest: event.target.value })} placeholder="90 сек" /></label>
                          <label className="trainerNextWeightToggle">
                            <span>Используется вес</span>
                            <input type="checkbox" checked={requiresWeight} disabled={selectedWorkoutReadOnly} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { requiresWeight: event.target.checked, usesWeight: event.target.checked })} />
                          </label>
                          <label className="trainerNextVideoUpload">
                            <Upload size={16} />
                            <span>{exerciseVideoUploadingId === exercise.id ? "Загрузка..." : video ? "Заменить видео" : "Загрузить видео"}</span>
                            <input type="file" accept="video/*" disabled={selectedWorkoutReadOnly || exerciseVideoUploadingId === exercise.id} onChange={(event) => onUploadExerciseVideo(selectedWorkout.id, exercise.id, event.target.files?.[0])} />
                          </label>
                        </div>

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
                onAddExercise(selectedWorkout.id);
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
            <div><h2>Моя библиотека упражнений</h2><p>Личные упражнения, видео и параметры из ваших программ</p></div>
            <div className="trainerNextLibraryActions">
              <label className="trainerNextSearch open"><Search size={17} /><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Найти упражнение..." /></label>
              <button
                className="trainerNextLibraryAdd"
                type="button"
                disabled={!selectedWorkout && (!programTemplates?.length || typeof onCreateLibraryExercise !== "function")}
  onClick={createLibraryExercise}
                aria-label="Создать новое упражнение"
              >
                <Plus size={16} />Добавить
              </button>
            </div>
          </div>
          <div>
            {filteredLibrary.map((exercise, index) => {
              const video = getExerciseVideo(exercise);
              return (
                <article
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
                  <span className="trainerNextExerciseImage">
                    {video ? <video src={video} muted preload="metadata" aria-hidden="true" /> : <Dumbbell size={22} />}
                  </span>
                  <div><strong>{exercise.name}</strong><small>{exercise.sets?.length || 0} подх. · {video ? "с видео" : "без видео"}</small></div>
                </article>
              );
            })}
            {!filteredLibrary.length ? <div className="trainerNextEmpty">Упражнения не найдены.</div> : null}
          </div>
        </section>
      )}

      {activeLibraryEditorExercise ? (
        <div className={`trainerNextModalBackdrop ${exerciseLibraryEditorStyles.backdrop}`} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeLibraryEditor()}>
          <section className={exerciseLibraryEditorStyles.modal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-library-editor-title">
            <button type="button" className={exerciseLibraryEditorStyles.close} onClick={closeLibraryEditor} disabled={libraryEditorSaving} aria-label="Закрыть редактор упражнения"><X size={18} /></button>
            <header className={exerciseLibraryEditorStyles.header} data-trainer-modal-header="true">
              <small>БИБЛИОТЕКА УПРАЖНЕНИЙ</small>
              <h2 id="trainer-library-editor-title">Редактирование упражнения</h2>
              <p>Изменения применятся после нажатия кнопки «Сохранить».</p>
            </header>
            <div className={exerciseLibraryEditorStyles.body} data-trainer-modal-content="true">
              <div className={exerciseLibraryEditorStyles.fields}>
                <label className={exerciseLibraryEditorStyles.nameField}><span>Название</span><input value={activeLibraryEditorExercise.name || ""} onChange={(event) => updateLibraryEditorExercise({ name: event.target.value })} disabled={libraryEditorSaving} /></label>
                <label className={exerciseLibraryEditorStyles.restField}><span>Отдых</span><input value={activeLibraryEditorExercise.rest || ""} onChange={(event) => updateLibraryEditorExercise({ rest: event.target.value })} placeholder="90 сек" disabled={libraryEditorSaving} /></label>
                <label className={exerciseLibraryEditorStyles.weightToggle}>
                  <span>Используется вес</span>
                  <input type="checkbox" checked={activeLibraryEditorExercise.requiresWeight ?? activeLibraryEditorExercise.usesWeight ?? true} onChange={(event) => updateLibraryEditorExercise({ requiresWeight: event.target.checked, usesWeight: event.target.checked })} disabled={libraryEditorSaving} />
                </label>
                <label className={exerciseLibraryEditorStyles.videoUpload}>
                  <Upload size={16} />
                  <span>{exerciseVideoUploadingId === libraryEditorExercise.id ? "Загрузка..." : getExerciseVideo(activeLibraryEditorExercise) ? "Заменить видео" : "Загрузить видео"}</span>
                  <input type="file" accept="video/*" disabled={libraryEditorSaving || exerciseVideoUploadingId === libraryEditorExercise.id} onChange={uploadLibraryEditorVideo} />
                </label>
                <div className={exerciseLibraryEditorStyles.videoPreview} aria-label="Предпросмотр видео упражнения">
                  {getExerciseVideo(activeLibraryEditorExercise) ? (
                    <video src={getExerciseVideo(activeLibraryEditorExercise)} controls playsInline preload="metadata" />
                  ) : (
                    <div className={exerciseLibraryEditorStyles.videoPreviewEmpty}>
                      <Upload size={20} aria-hidden="true" />
                      <strong>Видео ещё не добавлено</strong>
                      <span>Загрузите ролик, чтобы проверить технику упражнения.</span>
                    </div>
                  )}
                </div>
              </div>
              <div className={exerciseLibraryEditorStyles.setEditor}>
                <div className={exerciseLibraryEditorStyles.setEditorHead}><span>Подход</span><span>Повторы</span><span>Вес, кг</span><span /></div>
                {(activeLibraryEditorExercise.sets?.length ? activeLibraryEditorExercise.sets : [{ reps: "", weight: "" }]).map((set, setIndex, sets) => (
                  <div className={exerciseLibraryEditorStyles.setRow} key={set.id || setIndex}>
                    <strong>{setIndex + 1}</strong>
                    <input aria-label={`Повторы, подход ${setIndex + 1}`} value={set.reps ?? ""} onChange={(event) => updateLibraryEditorSet(setIndex, { reps: event.target.value })} disabled={libraryEditorSaving} />
                    <input aria-label={`Вес, подход ${setIndex + 1}`} inputMode="decimal" value={sanitizeExerciseWeightInput(set.weight) ?? ""} disabled={libraryEditorSaving || !(activeLibraryEditorExercise.requiresWeight ?? activeLibraryEditorExercise.usesWeight ?? true)} onChange={(event) => updateLibraryEditorSet(setIndex, { weight: event.target.value })} />
                    <button type="button" disabled={libraryEditorSaving || sets.length <= 1} onClick={() => removeLibraryEditorSet(setIndex)} aria-label={`Удалить подход ${setIndex + 1}`}><X size={14} /></button>
                  </div>
                ))}
                <button className={exerciseLibraryEditorStyles.addSet} type="button" disabled={libraryEditorSaving} onClick={addLibraryEditorSet}><Plus size={15} />Добавить подход</button>
              </div>
            </div>
            <footer className={exerciseLibraryEditorStyles.footer} data-trainer-modal-footer="true">
              <button className={exerciseLibraryEditorStyles.deleteButton} type="button" disabled={libraryEditorSaving} onClick={confirmRemoveLibraryEditor}><Trash2 size={16} />Удалить</button>
              <button className={exerciseLibraryEditorStyles.saveButton} type="button" disabled={libraryEditorSaving} onClick={() => void saveLibraryEditor()}><Save size={16} />{libraryEditorSaving ? "Сохраняем..." : "Сохранить"}</button>
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
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />,
        document.body
      ) : null}
    </div>
  );
}

function CreateClientModal({ state }) {
  if (!state?.open) return null;
  return (
    <div className="trainerNextModalBackdrop" data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && state.onClose()}>
      <section className="trainerNextModal trainerNextCreateClientModal" role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-create-client-title">
        <button className="trainerNextModalClose" type="button" onClick={state.onClose} aria-label="Закрыть">×</button>
        <header data-trainer-modal-header="true">
        <div className="trainerNextModalIcon"><UserPlus size={24} /></div>
        <h2 id="trainer-create-client-title">Пригласить клиента</h2>
        <p>Клиент сам задаст пароль по ссылке активации и войдёт по выбранному логину.</p>
        </header>
        <form id="trainer-create-client-form" className="trainerNextCreateClientForm" data-trainer-modal-content="true" onSubmit={state.onSubmit}>
          <label><span>Имя</span><input value={state.name} onChange={(event) => state.onNameChange(event.target.value)} placeholder="Имя клиента" /></label>
          <label><span>Логин</span><input value={state.login} onChange={(event) => state.onLoginChange(event.target.value)} placeholder="например: ilya.fit" autoComplete="off" autoCapitalize="none" spellCheck="false" /></label>
          <small className="trainerNextModalHint">Латиница, цифры, точка, дефис или _; от 3 до 32 символов.</small>
          {state.status ? <p className="trainerNextModalStatus">{state.status}</p> : null}
          {state.credentials ? <div className="trainerNextCredentials"><strong>Ссылка активации</strong><small>Логин: {state.credentials.login}</small><div className="trainerNextCredentialLinkRow"><code>{state.credentials.shareUrl || state.credentials.inviteUrl}</code><button className="trainerNextCopyInviteLink" type="button" aria-label="Скопировать ссылку" title="Скопировать ссылку" onClick={() => navigator.clipboard?.writeText(state.credentials.shareUrl || state.credentials.activationUrl || state.credentials.inviteUrl)}><Copy size={19} strokeWidth={2.25} /></button></div></div> : null}
        </form>
        <footer data-trainer-modal-footer="true">
          <button className="trainerNextPrimary trainerNextModalSubmit" form="trainer-create-client-form" type="submit" disabled={state.loading}>{state.loading ? "Создаю..." : "Создать приглашение"}</button>
        </footer>
      </section>
    </div>
  );
}

function TrainerCabinetUtilitySheet({
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
  const activeCount = counts.active ?? clients.filter((client) => client.status !== "archived").length;
  const attentionCount = counts.attention ?? 0;
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
          <div className="trainerNextMobileTitle">Кабинет</div>
          <div className="trainerNextMobileHeaderActions">
            <button type="button" onClick={onRefresh} aria-label="Обновить страницу"><RefreshCw size={20} /></button>
          </div>
        </header>

        <div className="trainerNextCabinetContent">
          <div className="trainerNextDesktopPageHead">
            <div>
              <h1>Кабинет тренера</h1>
              <p>Профиль, быстрые действия и рабочие разделы в едином стиле тренерской панели.</p>
            </div>
          </div>

          <button className="trainerCabinetHero trainerCabinetProfileButton" type="button" onClick={onOpenTrainerProfile}>
            <TrainerAvatar client={{ name: trainerName, avatarUrl: trainerAvatar }} size="large" />
            <div>
              <span>Тренер</span>
              <h2>{trainerName || "Тренер"}</h2>
              <p>Профиль и настройки</p>
            </div>
            <ChevronRight className="trainerCabinetHeroChevron" size={21} aria-hidden="true" />
          </button>

          <section className="trainerCabinetStats" aria-label="Сводка тренера">
            <article><span>Всего клиентов</span><strong>{clients.length}</strong></article>
            <article><span>Активных</span><strong>{activeCount}</strong></article>
            <article><span>Требуют внимания</span><strong>{attentionCount}</strong></article>
          </section>

          <section className="trainerCabinetWorkspaceLinks" aria-label="Рабочие разделы кабинета">
            <button type="button" onClick={() => onNavigate?.("library")}>
              <span className="trainerCabinetWorkspaceIcon"><Dumbbell size={19} /></span>
              <div className="trainerCabinetWorkspaceCopy"><strong>Мои программы и упражнения</strong><small>Личная библиотека и шаблоны для клиентов</small></div>
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

          {onLogout ? <button className="trainerCabinetLogout" type="button" onClick={onLogout}><X size={20} />Выйти из аккаунта</button> : null}
        </div>
      </div>

      <TrainerCabinetUtilitySheet
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
  const [notificationSettings, setNotificationSettings] = useState({
    missedWorkout: true,
    noNutrition: true,
    staleMeasurements: true
  });
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
  const visibleClients = clients.filter((client) => !client.archived);
  const attentionItems = visibleClients
    .map((client) => {
      const summary = clientSummaries[client.id] || {};
      return { client, summary, attention: getClientAttentionState(client, summary) };
    })
    .filter((item) => Boolean(item.attention));
  const attentionClients = attentionItems.length;
  const activeUtilityClients = Math.max(0, visibleClients.length - attentionClients);
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
  const notificationEvents = riskClients.flatMap(({ client, reasons }) => (
    reasons.slice(0, 2).map((reason) => ({
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
            <article><span>Тренировок за 7 дней</span><strong>{completedWeek}</strong><small>по всем клиентам</small></article>
            <article><span>Дней питания за 7 дней</span><strong>{nutritionTrackedWeek}</strong><small>заполнено клиентами</small></article>
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
                  <button type="button" key={client.id} onClick={() => onNavigate?.("clients")}>
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
      text: "Настройки событий, которые тренер должен видеть по клиентам.",
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
              <h3>Лента уведомлений</h3>
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
              <h3>События для тренера</h3>
              {[
                ["missedWorkout", "Пропущенная тренировка", "Показывать, если клиент не выполнил запланированную тренировку."],
                ["noNutrition", "Нет дневника питания", "Напоминать, если клиент долго не заполняет питание."],
                ["staleMeasurements", "Нет свежих замеров", "Подсвечивать клиентов без актуальных замеров."]
              ].map(([key, title, text]) => (
                <label className="trainerUtilityToggle" key={key}>
                  <span><strong>{title}</strong><small>{text}</small></span>
                  <input type="checkbox" checked={notificationSettings[key]} onChange={() => setNotificationSettings((state) => ({ ...state, [key]: !state[key] }))} />
                </label>
              ))}
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
  onLogout
}) {
  const [syncMinimized, setSyncMinimized] = useState(false);

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

  useEffect(() => {
    if (summariesLoading && mode === "dashboard") {
      setSyncMinimized(false);
    }
  }, [mode, summariesLoading]);

  let content = null;
  const showSyncStatus = summariesLoading && mode === "dashboard";

  if (mode === "dashboard") {
    content = (
      <TrainerDashboard
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
    content = <TrainerClientsPage clients={clients} clientSummaries={clientSummaries} onOpenClient={onOpenClient} onCreateClient={onCreateClient} />;
  } else if (mode === "client" && selectedClient) {
    content = (
      clientLoading ? <TrainerClientDetailLoading
        client={selectedClient}
        onBack={onCloseClient}
      /> : <TrainerClientDetail
        client={selectedClient}
        profile={selectedProfile}
        summary={selectedSummary}
        snapshot={selectedClientSnapshot}
        workoutReview={selectedLastWorkoutReview}
        activeTab={activeClientTab}
        onTabChange={onClientTabChange}
        onBack={onCloseClient}
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

  const syncStatus = showSyncStatus ? (
    <TrainerSyncStatus
      clients={clients}
      clientSummaries={clientSummaries}
      minimized={syncMinimized}
      onMinimize={() => setSyncMinimized(true)}
      onExpand={() => setSyncMinimized(false)}
    />
  ) : null;

  if (embedded) {
    return (
      <div className={`trainerNextRoot ${workspaceStyles.workspaceRoot} ${cabinetStyles.scope} ${adaptiveStyles.root} ${responsiveStyles.scope} ${modalSystemStyles.scope} ${clientProfileSectionStyles.scope} ${programEditorStyles.scope} ${nutritionDiaryStyles.scope} ${clientWorkoutPlanStyles.scope} ${clientViewsStyles.scope} ${nutritionAnalyticsStyles.scope} ${clientNutritionStyles.scope} ${exerciseProgressStyles.scope} ${dashboardStyles.scope}`}>
        <TrainerModalScrollLock />
        {content}
        {syncStatus}
      </div>
    );
  }

  return (
    <TrainerShell activeSection={activeSection} onNavigate={onNavigate} trainerName={trainerName} trainerAvatar={trainerAvatar} appVersion={appVersion}>
      {content}
      <CreateClientModal state={createClientState} />
      {syncStatus}
    </TrainerShell>
  );
}
