import { useEffect, useMemo, useRef, useState } from "react";
import workspaceStyles from "./TrainerWorkspaceCalm.module.css";
import "./TrainerWorkspaceClientProfileSections.module.css";
import "./TrainerWorkspaceClientViews.module.css";
import "./TrainerWorkspaceNutritionAnalytics.module.css";
import "./TrainerWorkspaceClientWorkoutPlan.module.css";
import "./TrainerWorkspaceClientNutrition.module.css";
import "./TrainerWorkspaceCabinet.module.css";
import "./TrainerWorkspaceProgramEditor.module.css";
import "./TrainerWorkspaceExerciseProgress.module.css";
import "./TrainerWorkspaceNutritionDiary.module.css";
import "./TrainerWorkspaceDashboard.module.css";
import "./TrainerWorkspaceMobile.module.css";
import adaptiveStyles from "./TrainerWorkspaceAdaptive.module.css";
import trainerProgramConstructorStyles from "./TrainerProgramConstructor.module.css";
import TrainerClientUtilitySheet from "./TrainerClientUtilitySheet";
import TrainerWorkoutFeedbackReplyModal from "./TrainerWorkoutFeedbackReplyModal";
import trainerWorkoutFeedbackReplyStyles from "./TrainerWorkoutFeedbackReplyModal.module.css";
import TrainerClientContactModal from "./TrainerClientContactModal";
import TrainerClientTasks from "./TrainerClientTasks";
import TrainerExerciseLoadReviewModal from "./TrainerExerciseLoadReviewModal";
import trainerExerciseLoadReviewStyles from "./TrainerExerciseLoadReviewModal.module.css";
import TrainerWorkoutReviewDecisionModal from "./TrainerWorkoutReviewDecisionModal";
import TrainerClientProgressDashboard from "./TrainerClientProgressDashboard";
import trainerClientWorkoutPlanStyles from "./TrainerClientWorkoutPlan.module.css";
import trainerClientExercisesTabsStyles from "./TrainerClientExercisesTabs.module.css";
import trainerClientMessagesStyles from "./TrainerClientMessages.module.css";
import workspaceFeatureStyles from "./TrainerWorkspaceSubscriptionProgress.module.css";
import exerciseLibraryEditorStyles from "./TrainerExerciseLibraryEditor.module.css";
import { analyzeExerciseProgress } from "../../utils/exerciseProgress.js";
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
  getSubscriptionAttentionLabel,
  getSubscriptionStatus
} from "../../utils/clientSubscription.js";
import {
  buildPlannedWorkoutSlots,
  buildWorkoutScheduleCalendarEntries,
  toWorkoutDateKey
} from "../../utils/workoutSchedule.js";
import {
  getClientAttentionState,
  getTrainerAttentionDaysSince as getLocalDaysSince
} from "../../utils/trainerAttention.js";
import {
  buildTrainerClientListItems,
  buildTrainerWorkoutReview,
  getTrainerActionItemTargetTab
} from "../../utils/trainerActionCenter.js";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
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

const NAV_ITEMS = [
  { id: "dashboard", label: "Обзор", mobileLabel: "Дашборд", icon: Home },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "nutrition", label: "Питание", icon: Utensils },
  { id: "workouts", label: "Программы", icon: Dumbbell },
  { id: "more", label: "Кабинет", mobileLabel: "Кабинет", icon: User }
];

export function TrainerProgramConstructorStyleScope({ children }) {
  return <>{children(trainerProgramConstructorStyles)}</>;
}
const DESKTOP_NAV_ITEMS = [
  { id: "dashboard", label: "Обзор", icon: Home },
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
  { id: "overview", label: "Обзор" },
  { id: "exercises", label: "Тренировки", target: "workouts" },
  { id: "nutrition", label: "Питание" },
  { id: "bodyProgress", label: "Фото и замеры" },
  { id: "messages", label: "Сообщения" },
  { id: "notifications", label: "Уведомления" }
];

const CLIENT_TAB_ICONS = {
  overview: Home,
  exercises: Dumbbell,
  nutrition: Utensils,
  bodyProgress: Camera
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
    const workoutName = getTrainerWorkoutKey(item?.workoutName || item?.workout);
    if (workoutId) result.add(`id:${workoutId}`);
    if (workoutName) result.add(`name:${workoutName}`);
    return result;
  }, new Set());
}

function isTrainerWorkoutCompleted(workout = {}, completedKeys = new Set()) {
  const status = String(workout.status || "").trim().toLowerCase();
  if (status === "completed") return true;
  if (["not_completed", "missed"].includes(status)) return false;

  const workoutId = getTrainerWorkoutKey(workout.id);
  const workoutName = getTrainerWorkoutKey(workout.name);
  return (workoutId && completedKeys.has(`id:${workoutId}`)) ||
    (workoutName && completedKeys.has(`name:${workoutName}`));
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

function getInitials(client = {}) {
  return String(client.name || client.displayName || client.email || "К")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getAvatar(client = {}) {
  return client.avatarUrl || client.photoURL || client.telegramAvatarUrl || client.telegram?.avatarUrl || "";
}

function TrainerAvatar({ client, size = "medium" }) {
  const image = getAvatar(client);
  return (
    <span className={`trainerNextAvatar ${size}`}>
      {image ? <img src={image} alt="" /> : getInitials(client)}
    </span>
  );
}

function TrainerConfirmDialog({ title, text, confirmLabel = "Удалить", onConfirm, onCancel }) {
  return (
    <div className="trainerConfirmBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel?.();
    }}>
      <section className="trainerConfirmDialog" role="dialog" aria-modal="true" data-modal-surface="true" aria-label={title || "Подтверждение действия"}>
        <header>
          <span>ПОДТВЕРЖДЕНИЕ</span>
          <h2>{title}</h2>
          <p>{text}</p>
        </header>
        <footer>
          <button type="button" onClick={onCancel}>Отмена</button>
          <button className="danger" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}

function Sparkline({ tone = "green", values = [2, 3, 3, 5, 4, 7, 8] }) {
  const safeValues = values.length > 1 ? values : [0, 1];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const points = safeValues.map((value, index) => {
    const x = (index / (safeValues.length - 1)) * 92 + 4;
    const y = 30 - ((value - min) / Math.max(1, max - min)) * 24;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className={`trainerNextSparkline ${tone}`} viewBox="0 0 100 34" aria-hidden="true">
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
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
  const statusId = attention ? "attention" : (status.id || "active");
  const actionByType = {
    program: "Назначить программу",
    workout: "Проверить тренировку",
    feedback: "Открыть комментарий",
    programEnding: "Продлить программу",
    task: "Открыть задачу",
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
  const detail = isActive ? "" : (attention?.reason || getAttentionReason(client, summary));

  return {
    id: statusId,
    label: isActive
      ? "Всё в порядке"
      : (actionByType[attention?.type] || actionByStatus[statusId] || "Открыть клиента"),
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

function TrainerNavigation({ activeSection, onNavigate, trainerName, trainerAvatar, appVersion }) {
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
      <aside className="trainerNextSidebar">
        <div className="trainerNextBrand"><strong>T</strong><span>Tren</span></div>
        {appVersion ? <span className="trainerNextVersion">{appVersion}</span> : null}
        <nav>{desktopItems.map((item) => renderButton(item))}</nav>
        <button className="trainerNextTrainer" type="button" onClick={() => onNavigate("more")}>
          <TrainerAvatar client={{ name: trainerName, avatarUrl: trainerAvatar }} size="small" />
          <span><small>Тренер</small><strong>{trainerName || "Тренер"}</strong></span>
          <ChevronDown size={16} />
        </button>
      </aside>

      <nav className="trainerNextMobileNav" aria-label="Разделы тренера">
        {mobileItems.map((item) => renderButton(item, true))}
      </nav>
    </>
  );
}

export function TrainerShell({ activeSection, onNavigate, trainerName, trainerAvatar, appVersion, children }) {
  return (
    <div className={`trainerNextRoot ${workspaceStyles.workspaceRoot} ${adaptiveStyles.root}`}>
      <TrainerNavigation
        activeSection={activeSection}
        onNavigate={onNavigate}
        trainerName={trainerName}
        trainerAvatar={trainerAvatar}
        appVersion={appVersion}
      />
      <main className="trainerNextMain">{children}</main>
      <div className={workspaceStyles.mobileDockGuard} aria-hidden="true" />
    </div>
  );
}

function DashboardMetric({ label, value, detail, tone, icon: Icon, values, onClick }) {
  return (
    <button
      className="trainerNextMetric trainerNextMetricAction"
      type="button"
      onClick={onClick}
      aria-label={`Открыть: ${label}`}
    >
      <div className="trainerNextMetricHead">
        <span>{label}</span>
        {Icon ? <Icon size={17} strokeWidth={1.7} /> : null}
      </div>
      <strong>{value}</strong>
      <div className={`trainerNextMetricFoot ${tone || ""}`}>
        <small>{detail}</small>
        {values ? <Sparkline tone={tone} values={values} /> : null}
      </div>
    </button>
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
          <button type="button" key={client.id} onClick={() => onOpenClient(client, statusAction.targetTab)}>
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

const DASHBOARD_ACTION_GROUPS = [
  {
    id: "todayWorkouts",
    title: "\u0421\u0435\u0433\u043e\u0434\u043d\u044f",
    text: "\u041f\u043b\u0430\u043d\u043e\u0432\u044b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438",
    empty: "\u041d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0442 \u043f\u043b\u0430\u043d\u043e\u0432\u044b\u0445 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a."
  },
  {
    id: "missedWorkouts",
    title: "\u041f\u0440\u043e\u043f\u0443\u0441\u043a\u0438",
    text: "\u041d\u0443\u0436\u043d\u0430 \u0440\u0435\u0430\u043a\u0446\u0438\u044f",
    empty: "\u041f\u0440\u043e\u043f\u0443\u0441\u043a\u043e\u0432 \u043d\u0435\u0442."
  },
  {
    id: "feedbackItems",
    title: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438",
    text: "\u0411\u043e\u043b\u044c, \u0436\u0430\u043b\u043e\u0431\u044b \u0438\u043b\u0438 \u0437\u0430\u043c\u0435\u0442\u043a\u0438",
    empty: "\u041d\u043e\u0432\u044b\u0445 \u0441\u0438\u0433\u043d\u0430\u043b\u043e\u0432 \u043e\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043d\u0435\u0442."
  },
  {
    id: "programEndingItems",
    title: "\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b",
    text: "\u0417\u0430\u043a\u0430\u043d\u0447\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0438\u043b\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u044b",
    empty: "\u041d\u0435\u0442 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c \u043d\u0430 \u0444\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0439 \u0441\u0442\u0430\u0434\u0438\u0438."
  },
  {
    id: "taskItems",
    title: "\u0417\u0430\u0434\u0430\u0447\u0438",
    text: "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u043c",
    empty: "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447 \u043d\u0435\u0442."
  }
];

function DashboardActionCenter({ actionCenter, onOpenClient }) {
  const groups = DASHBOARD_ACTION_GROUPS.map((group) => ({
    ...group,
    items: Array.isArray(actionCenter?.[group.id]) ? actionCenter[group.id] : []
  }));
  const priorityItems = Array.isArray(actionCenter?.priorityItems)
    ? actionCenter.priorityItems
    : (actionCenter?.attentionItems || []);
  const totalCount = priorityItems.length;
  const [activeGroupId, setActiveGroupId] = useState("todayWorkouts");
  const activeGroup = groups.find((group) => group.id === activeGroupId) || null;
  const visibleItems = (activeGroup ? activeGroup.items : priorityItems).slice(0, 6);

  return (
    <section className="trainerActionCenterSection">
      <div className="trainerNextClientsTitle">
        <div>
          <h2>{"\u0427\u0442\u043e \u0441\u0434\u0435\u043b\u0430\u0442\u044c \u0441\u0435\u0433\u043e\u0434\u043d\u044f"}</h2>
          <p>{"\u041e\u0434\u0438\u043d \u043a\u043b\u0438\u0435\u043d\u0442 \u2014 \u043e\u0434\u043d\u0430 \u0441\u0442\u0440\u043e\u043a\u0430 \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438. \u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u0432\u044b\u0448\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u0443\u044e\u0442 \u0435\u0451 \u043f\u043e \u0442\u0438\u043f\u0443 \u0437\u0430\u0434\u0430\u0447\u0438."}</p>
        </div>
        <span className="trainerActionCenterCount">{totalCount}</span>
      </div>

      <div className="trainerActionCenterGrid">
        {groups.map((group) => (
          <button
            type="button"
            className={`trainerActionCenterCard ${activeGroup?.id === group.id ? "active" : ""}`}
            key={group.id}
            onClick={() => setActiveGroupId(group.id)}
            aria-pressed={activeGroup?.id === group.id}
          >
            <header>
              <span>{group.title}</span>
              <strong>{group.items.length}</strong>
            </header>
            <p>{group.text}</p>
          </button>
        ))}
      </div>

      <div className="trainerActionCenterList" aria-label={activeGroup?.title || "Приоритетная очередь"}>
        {visibleItems.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onOpenClient(item.client, getTrainerActionItemTargetTab(item, activeGroup?.id))}
          >
            <TrainerAvatar client={item.client} size="small" />
            <span>
              <strong>{item.clientName}</strong>
              <small>{item.reason || getAttentionReason(item.client, item.summary)}</small>
            </span>
            <ClientStatus status={item.status} />
          </button>
        ))}
        {!visibleItems.length ? (
          <div className="trainerNextEmpty">{activeGroup?.empty || "\u0421\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442 \u0441\u0440\u043e\u0447\u043d\u044b\u0445 \u0441\u0438\u0433\u043d\u0430\u043b\u043e\u0432."}</div>
        ) : null}
      </div>
    </section>
  );
}

function TrainerDashboard({
  clients,
  clientSummaries,
  actionCenter,
  onOpenClient,
  onOpenClients,
  onOpenPrograms,
  appVersion = "",
  loading = false
}) {
  const completed = clients.reduce((sum, client) => sum + (Number(clientSummaries[client.id]?.workouts7) || 0), 0);
  const progressValues = clients
    .map((client) => Number(clientSummaries[client.id]?.programCompletionPercent))
    .filter(Number.isFinite);
  const averageProgress = progressValues.length
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
    : 0;
  const clientCount = clients.length;
  const attentionCount = clients.filter((client) => {
    const summary = clientSummaries[client.id] || {};
    return Boolean(getClientAttentionState(client, summary));
  }).length;
  const activeCount = Math.max(0, clientCount - attentionCount);
  const activePercent = clientCount ? Math.round((activeCount / clientCount) * 100) : 0;
  const clientsWithRecentData = clients.filter((client) => {
    const summary = clientSummaries[client.id] || {};
    return summary.lastWorkoutAt || summary.lastNutritionAt || summary.lastMeasurementAt;
  }).length;
  const completedDetail = completed
    ? `за 7 дней · ${clientsWithRecentData || clientCount} кл.`
    : "нет за 7 дней";
  const progressValue = progressValues.length ? `${averageProgress > 0 ? "+" : ""}${averageProgress}%` : "—";
  const progressDetail = progressValues.length ? "по назначенным программам" : "нет данных по программам";

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

      <div className="trainerNextSectionTitle">
        <h2>Обзор</h2>
      </div>

      {loading ? (
        <div className="trainerDashboardSync" role="status">
          <RefreshCw size={16} />
          <span>Синхронизирую клиентов и последние события...</span>
        </div>
      ) : null}

      <DashboardActionCenter actionCenter={actionCenter} onOpenClient={onOpenClient} />

      <section className="trainerNextMetrics">
        <DashboardMetric label="Клиенты" value={clientCount} detail={clientCount ? `${activeCount} активных` : "клиенты не загружены"} icon={Users} onClick={onOpenClients} />
        <DashboardMetric label="Активные" value={activeCount} detail={`${activePercent}% базы`} tone="green" icon={Activity} values={[2, 3, 4, 5, 4, 4.5, 8]} onClick={onOpenClients} />
        <DashboardMetric label="Завершено" value={completed} detail={completedDetail} tone="purple" icon={Dumbbell} values={[1, 2, 2, 3, 2.5, 5, 4, 8]} onClick={onOpenPrograms} />
        <DashboardMetric label="Прогресс" value={progressValue} detail={progressDetail} tone="green" icon={TrendingUp} values={[2, 2, 3.5, 3, 5, 4.3, 7]} onClick={onOpenClients} />
      </section>

      {appVersion ? <div className="trainerNextDashboardVersion">{appVersion}</div> : null}
    </div>
  );
}

function ClientSubscriptionCard({ client, onSave }) {
  const subscription = client?.subscription || {};
  const status = getSubscriptionStatus(subscription, new Date());
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get("subscription") === "renew");
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
      if (saved !== false) setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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

      {open ? (
        <div className={`trainerNextModalBackdrop ${workspaceFeatureStyles.subscriptionModalBackdrop}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className={workspaceFeatureStyles.subscriptionModal} role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="trainer-subscription-modal-title">
            <button type="button" className={workspaceFeatureStyles.subscriptionModalClose} onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            <header><span>АБОНЕМЕНТ</span><h2 id="trainer-subscription-modal-title">Редактирование абонемента</h2><p>Срок действия и баланс тренировок клиента.</p></header>
            <div className={workspaceFeatureStyles.subscriptionModalGrid}>
              <label><small>Дата начала</small><input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
              <label><small>Дата окончания</small><input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
              <label><small>Куплено тренировок</small><input type="number" min="0" value={draft.purchasedSessions} onChange={(event) => setDraft((current) => ({ ...current, purchasedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
              <label><small>Использовано</small><input type="number" min="0" value={draft.usedSessions} onChange={(event) => setDraft((current) => ({ ...current, usedSessions: Math.max(0, Number(event.target.value) || 0) }))} /></label>
            </div>
            <div className={workspaceFeatureStyles.subscriptionModalSummary}>
              <strong>Осталось: {Math.max(0, draft.purchasedSessions - draft.usedSessions)} тренировок</strong>
              <label><input type="checkbox" checked={draft.frozen} onChange={(event) => setDraft((current) => ({ ...current, frozen: event.target.checked }))} /><span>Абонемент заморожен</span></label>
            </div>
            <footer>
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

function ClientOverview({ client, profile, summary, measurements, history, nutritionDays, nutritionGoals, photos, tasks, onSaveSubscription }) {
  const latest = measurements[0] || {};
  const currentWeight = Number(latest.weight || latest.values?.weight || profile?.weight || 0);
  const activity = [
    { icon: Dumbbell, label: "Тренировка", value: formatCompactDate(summary.lastWorkoutAt || history[0]?.date) },
    { icon: Utensils, label: "Питание", value: formatCompactDate(summary.lastNutritionAt || nutritionDays[0]?.date) },
    { icon: Ruler, label: "Замеры", value: formatCompactDate(summary.lastMeasurementAt || latest.date) },
    { icon: Camera, label: "Фото прогресса", value: formatCompactDate(photos[0]?.date || photos[0]?.createdAt) }
  ];

  return (
    <div className="trainerNextClientOverview">
      <ClientSubscriptionCard client={client} onSave={onSaveSubscription} />
      <TrainerClientProgressDashboard
        key={client?.id || "client-progress"}
        measurements={measurements}
        history={history}
        nutritionDays={nutritionDays}
        nutritionGoals={nutritionGoals}
      />
      <div className="trainerNextClientSide">
        <section className="trainerNextResultCard">
          <h3>Данные для анализа</h3>
          <div><span>Текущий вес</span><strong>{currentWeight ? `${currentWeight} кг` : "—"}</strong></div>
          <div><span>Замеры</span><strong>{measurements.length || "—"}</strong></div>
          <div><span>Тренировки</span><strong>{history.length || "—"}</strong></div>
          <div><span>Дни питания</span><strong>{nutritionDays.length || "—"}</strong></div>
        </section>
        <section className="trainerNextActivityCard">
          <h3>Последняя активность</h3>
          {activity.map(({ icon: Icon, label, value }) => <div key={label}><span><Icon size={16} />{label}</span><time>{value}</time></div>)}
        </section>
      </div>
      <TrainerClientTasks tasks={tasks} />
    </div>
  );
}

function ClientMeasurements({ measurements = [] }) {
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
    <section className="trainerNextSimplePanel">
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
  const sortedPhotos = photos.slice().sort((a, b) => {
    const dateA = getWorkspaceDate(a.date || a.createdAt)?.getTime() || 0;
    const dateB = getWorkspaceDate(b.date || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });
  const getPhotoUrl = (photo, targetView = view) => {
    const viewConfig = photoViews.find((item) => item.id === targetView) || photoViews[0];
    return photo?.[viewConfig.key] || photo?.url || photo?.photoUrl || "";
  };
  function getPhotoId(photo, index) {
    return String(photo.id || photo.createdAt || photo.date || `photo-${index}`);
  }
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
              {getPhotoUrl(photo) ? <img src={getPhotoUrl(photo)} alt={`Фото клиента ${formatCompactDate(photo.date || photo.createdAt)}`} /> : <Camera size={34} />}
              <figcaption>{formatCompactDate(photo.date || photo.createdAt)}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <div className="trainerNextPhotoGrid">
        {sortedPhotos.map((photo, index) => (
          <figure key={getPhotoId(photo, index)}>
            <button type="button" onClick={() => setOpenPhotoId(getPhotoId(photo, index))} aria-label="Открыть фото клиента">
              {getPhotoUrl(photo) ? <img src={getPhotoUrl(photo)} alt={`Фото клиента ${formatCompactDate(photo.date || photo.createdAt)}`} /> : <Camera size={30} />}
            </button>
            <figcaption>{formatCompactDate(photo.date || photo.createdAt)}</figcaption>
          </figure>
        ))}
        {!sortedPhotos.length ? <div className="trainerNextEmpty">Фото прогресса пока не добавлены.</div> : null}
      </div>

      {activePhoto ? (
        <div className="trainerClientModalBackdrop" role="dialog" aria-modal="true" aria-label="Просмотр фото клиента" onClick={() => setOpenPhotoId("")}>
          <section className="trainerPhotoPreviewModal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>ФОТО КЛИЕНТА</span><h2>{formatCompactDate(activePhoto.date || activePhoto.createdAt)}</h2></div>
              <button type="button" onClick={() => setOpenPhotoId("")} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <div className="trainerPhotoViewTabs">
              {photoViews.map((item) => <button type="button" className={view === item.id ? "active" : ""} aria-pressed={view === item.id} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
            </div>
            <div className="trainerPhotoPreviewImage">
              {getPhotoUrl(activePhoto) ? <img src={getPhotoUrl(activePhoto)} alt="Фото клиента крупно" /> : <Camera size={42} />}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ClientBodyProgress({ measurements, photos }) {
  return (
    <div className="trainerClientBodyProgress">
      <ClientMeasurements measurements={measurements} />
      <ClientPhotos photos={photos} />
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
          {filters.map((item) => (
            <button
              type="button"
              key={item.id}
              className={filter === item.id ? trainerClientMessagesStyles.active : ""}
              aria-pressed={filter === item.id}
              onClick={() => selectFilter(item.id)}
            >
              {item.label}<span>{item.count}</span>
            </button>
          ))}
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

function getWorkoutScheduleInitialDates(client = {}, workouts = []) {
  const calendar = client?.workoutCalendar || {};
  const plannedDates = Array.isArray(calendar.plannedWorkouts)
    ? calendar.plannedWorkouts.map((item) => item?.date)
    : [];
  const calendarDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(calendar.monthlyTrainingDates)
      ? calendar.monthlyTrainingDates
      : [];
  const workoutDates = (Array.isArray(workouts) ? workouts : [])
    .map((workout) => workout?.scheduledDate || workout?.plannedDate)
    .filter(Boolean);
  const source = plannedDates.length ? plannedDates : calendarDates.length ? calendarDates : workoutDates;

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
  planned: "в плане",
  completed: "выполнена в срок",
  completed_off_date: "выполнена в другой день",
  missed: "пропущена",
  shifted: "смещена дальше"
};

function getWorkoutScheduleCalendarStatus(entries = []) {
  const priority = ["missed", "completed_off_date", "completed", "shifted", "planned"];
  const status = priority.find((item) => entries.some((entry) => entry.status === item));
  if (status === "completed_off_date") return "completedOffDate";
  return status || "";
}

function getWorkoutScheduleCalendarTitle(dateKey, entries = []) {
  if (!entries.length) return dateKey;
  const details = entries
    .map((entry) => `â„–${entry.order} ${WORKOUT_SCHEDULE_DAY_STATUS_TEXT[entry.status] || ""}`.trim())
    .join(", ");
  return `${dateKey}: ${details}`;
}

function WorkoutSchedulePlanner({
  client,
  workouts = [],
  history = [],
  onSaveSchedule,
  status
}) {
  const requiredCount = workouts.length;
  const [selectedDates, setSelectedDates] = useState(() => getWorkoutScheduleInitialDates(client, workouts));
  const firstDate = selectedDates[0] || getLocalDateKey();
  const [monthKey, setMonthKey] = useState(firstDate.slice(0, 7));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const calendar = client?.workoutCalendar || {};
  const slots = buildPlannedWorkoutSlots({ workouts, calendar, history });
  const completedCount = slots.filter((slot) => slot.isCompleted).length;
  const missedCount = slots.filter((slot) => slot.isMissed).length;
  const selectedSet = new Set(selectedDates);
  const monthDays = getCalendarMonthDays(monthKey);
  const selectedOrder = Object.fromEntries(selectedDates.map((date, index) => [date, index + 1]));
  const datesComplete = requiredCount > 0 && selectedDates.length === requiredCount;
  const scheduleEntries = buildWorkoutScheduleCalendarEntries(slots);
  const savedEntriesByDate = scheduleEntries.reduce((result, entry) => {
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
        title: `Тренировка â„–${index + 1}`
      }];
    return result;
  }, {});
  const visibleEntriesByDate = editing ? draftEntriesByDate : savedEntriesByDate;

  function shiftMonth(delta) {
    const [year, month] = monthKey.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setMonthKey(getLocalDateKey(next).slice(0, 7));
  }

  function toggleDate(dateKey) {
    if (!editing) return;
    setSelectedDates((current) => {
      const exists = current.includes(dateKey);
      if (exists) return current.filter((date) => date !== dateKey);
      if (requiredCount && current.length >= requiredCount) return current;
      return [...current, dateKey].sort();
    });
  }

  async function saveSchedule() {
    if (!editing) {
      setEditing(true);
      return;
    }
    if (!datesComplete || saving) return;
    setSaving(true);
    try {
      const saved = await onSaveSchedule?.(selectedDates);
      if (saved !== false) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`trainerClientAnalyticsCard trainerWorkoutSchedulePlanner ${editing ? "editing" : ""}`}>
      <header>
        <div>
          <span>РАСПИСАНИЕ ПРОГРАММЫ</span>
          <h3>Даты тренировок клиента</h3>
          <p>Выберите ровно {requiredCount || 0} {pluralize(requiredCount, "дату", "даты", "дат")} под назначенную программу. Порядок дат становится порядком тренировок â„–1, â„–2 и дальше.</p>
        </div>
        <strong className={datesComplete ? "ready" : ""}>{selectedDates.length}/{requiredCount || 0}<small>выбрано</small></strong>
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
              const selected = selectedSet.has(day.key);
              const entries = visibleEntriesByDate[day.key] || [];
              const statusClass = getWorkoutScheduleCalendarStatus(entries);
              const entryLabel = entries.map((entry) => `â„–${entry.order}`).join(", ");
              return (
                <button
                  type="button"
                  className={[
                    day.currentMonth ? "" : "muted",
                    day.key === getLocalDateKey() ? "today" : "",
                    selected ? "selected" : "",
                    entries.length ? "hasWorkout" : "",
                    statusClass
                  ].filter(Boolean).join(" ")}
                  key={day.key}
                  onClick={() => toggleDate(day.key)}
                  disabled={!editing || (!selected && requiredCount > 0 && selectedDates.length >= requiredCount)}
                  title={getWorkoutScheduleCalendarTitle(day.key, entries)}
                >
                  <b>{day.label}</b>
                  {entries.length ? <i>{entryLabel}</i> : selected ? <i>â„–{selectedOrder[day.key]}</i> : null}
                </button>
              );
            })}
          </div>
          <div className="trainerWorkoutScheduleLegend" aria-label="Легенда статусов расписания">
            <span><i className="planned" />План</span>
            <span><i className="completed" />В срок</span>
            <span><i className="completedOffDate" />Другой день</span>
            <span><i className="missed" />Пропущена</span>
            <span><i className="shifted" />Смещена</span>
          </div>
        </div>

        {!slots.length ? <div className="trainerNextEmpty">Сначала назначьте клиенту программу тренировок.</div> : null}
      </div>

      <div className="trainerWorkoutScheduleFooter">
        <div>
          <span>Выполнено: <b>{completedCount}</b></span>
          <span>Пропущено: <b>{missedCount}</b></span>
          <span>Не в свой день: <b>{slots.filter((slot) => slot.isCompletedOffDate).length}</b></span>
        </div>
        <button type="button" className="trainerNextPrimary" disabled={(editing && !datesComplete) || saving || !requiredCount} onClick={saveSchedule}>
          {editing ? <Save size={16} /> : <CalendarDays size={16} />}
          {editing ? (saving ? "Сохранение..." : "Сохранить расписание") : "Изменить даты"}
        </button>
      </div>
      {editing && !datesComplete && requiredCount > 0 ? <p className="trainerWorkoutScheduleHint">Нужно выбрать {requiredCount} {pluralize(requiredCount, "дату", "даты", "дат")}, сейчас выбрано {selectedDates.length}.</p> : null}
      {!editing && requiredCount > 0 ? <p className="trainerWorkoutScheduleHint">Чтобы изменить дни тренировок, нажмите «Изменить даты».</p> : null}
      {status ? <p className="trainerNextProgramStatus">{status}</p> : null}
    </section>
  );
}

function ClientWorkoutHistoryBlock({ history = [] }) {
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const sortedHistory = [...history]
    .sort((a, b) => {
      const dateA = getWorkoutHistoryDate(a)?.getTime() || 0;
      const dateB = getWorkoutHistoryDate(b)?.getTime() || 0;
      return dateB - dateA;
    });
  const visibleHistory = sortedHistory.slice(0, 3);
  const olderHistory = sortedHistory.slice(3);

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
          <h3>Последние тренировки клиента</h3>
          <p>Короткая лента выполненных тренировок по этой программе и всем сохранённым записям клиента.</p>
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
        {olderHistory.length ? (
          <button className="trainerClientHistoryMoreButton" type="button" onClick={() => setHistoryModalOpen(true)}>
            Показать ещё {olderHistory.length} записей <ChevronRight size={14} aria-hidden="true" />
          </button>
        ) : null}
        </>
      ) : (
        <div className="trainerNextEmpty">История тренировок пока пустая. Когда клиент завершит тренировку, запись появится здесь.</div>
      )}
    </section>

    {historyModalOpen ? (
      <div className="trainerClientModalBackdrop trainerWorkoutHistoryModalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setHistoryModalOpen(false)}>
        <section className="trainerWorkoutHistoryModal" role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="trainer-workout-history-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div>
              <span>ИСТОРИЯ ТРЕНИРОВОК</span>
              <h2 id="trainer-workout-history-modal-title">Предыдущие тренировки</h2>
              <p>{olderHistory.length} записей до трёх последних тренировок клиента.</p>
            </div>
            <button type="button" onClick={() => setHistoryModalOpen(false)} aria-label="Закрыть историю тренировок"><X size={18} /></button>
          </header>
          <div className="trainerWorkoutHistoryModalBody">
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
  summary,
  history,
  workouts,
  programTemplates,
  selectedProgramId,
  onSelectProgram,
  onAssignProgram,
  onSaveWorkoutSchedule,
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

  useEffect(() => {
    if ((!editorOpen && !reviewDecisionOpen) || typeof document === "undefined") return undefined;

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
  }, [editorOpen, reviewDecisionOpen]);

  const recentStart = new Date();
  recentStart.setDate(recentStart.getDate() - 30);
  const workouts30 = history.filter((item) => {
    const date = getWorkoutHistoryDate(item);
    return date && date >= recentStart;
  }).length;
  const completedWorkoutKeys = getTrainerCompletedWorkoutKeys(history);
  const completedWorkoutCount = workouts.filter((workout) => isTrainerWorkoutCompleted(workout, completedWorkoutKeys)).length;
  const completion = workouts.length
    ? Math.round(completedWorkoutCount / workouts.length * 100)
    : 0;
  const assignedName = client?.assignedProgramName || (workouts.length ? "Индивидуальная программа" : "Программа не назначена");
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
    if (editorSaving) return;
    setEditorOpen(false);
    setPendingReviewAdjustment(null);
    setEditorStatus("");
  }

  function openProgramEditor() {
    setEditorWorkoutId(workouts[0]?.id || "");
    setPendingReviewAdjustment(null);
    setEditorStatus("");
    setEditorOpen(true);
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
      if (result === false) {
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

  return (
    <div className="trainerClientWorkoutPlan">
      <section className={trainerClientWorkoutPlanStyles.programCard}>
        <header className={trainerClientWorkoutPlanStyles.programHeader}>
          <span><ClipboardList size={19} /></span>
          <div>
            <h2>Программа тренировок клиента</h2>
            <p>Текущий план и назначение новой программы.</p>
          </div>
        </header>

        <div className={trainerClientWorkoutPlanStyles.programGrid}>
          <div className={trainerClientWorkoutPlanStyles.currentProgram}>
            <div className={trainerClientWorkoutPlanStyles.currentMain}>
              <span className={trainerClientWorkoutPlanStyles.programIcon}><Dumbbell size={21} /></span>
              <div className={trainerClientWorkoutPlanStyles.currentInfo}>
                <span>Назначенная программа</span>
                <h3>{assignedName}</h3>
                <p>{workouts.length} {pluralize(workouts.length, "тренировка", "тренировки", "тренировок")} · выполнено {completion}%</p>
              </div>
            </div>
            <div className={trainerClientWorkoutPlanStyles.stats}>
              <span><b>{summary.workouts7 || 0}</b><small>за 7 дней</small></span>
              <span><b>{workouts30}</b><small>за 30 дней</small></span>
              <span><b>{formatCompactDate(summary.lastWorkoutAt || history[0]?.date)}</b><small>последняя</small></span>
            </div>
          </div>

          <div className={trainerClientWorkoutPlanStyles.assignment}>
            <span>Назначить новую программу</span>
            <div className={trainerClientWorkoutPlanStyles.assignmentRow}>
              <div className={trainerClientWorkoutPlanStyles.selectField}>
                <select aria-label="Назначить программу клиенту" value={selectedProgramId || ""} onChange={(event) => onSelectProgram(event.target.value)}>
                  <option value="">Выберите программу</option>
                  {programTemplates.map((program) => <option value={program.id} key={program.id}>{program.name || "Без названия"}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              <button className={trainerClientWorkoutPlanStyles.assignButton} type="button" disabled={!selectedProgramId || !client} onClick={onAssignProgram}>
                <Check size={16} />Назначить
              </button>
              <button className={`${trainerClientWorkoutPlanStyles.editButton} trainerClientProgramEditButton`} type="button" onClick={openProgramEditor} disabled={!workouts.length}>
                Редактировать<ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
        {selectedTemplate && selectedProgramId !== client?.assignedProgramId
          ? <small className={trainerClientWorkoutPlanStyles.hint}>Будет назначена программа «{selectedTemplate.name || "Без названия"}».</small>
          : null}
        {programStatus ? <p className={trainerClientWorkoutPlanStyles.status}>{programStatus}</p> : null}
      </section>

      <WorkoutSchedulePlanner
        key={getWorkoutSchedulePlannerKey(client, workouts)}
        client={client}
        workouts={workouts}
        history={history}
        onSaveSchedule={onSaveWorkoutSchedule}
        status={programStatus}
      />

      <div className={`trainerClientWorkoutInsightsRow${visibleWorkoutReview ? "" : " single"}`}>
        <ClientWorkoutHistoryBlock history={history} />
        <ClientWorkoutReviewPanel
          review={visibleWorkoutReview}
          onAdjustNextWorkout={() => {
            setReviewStatus("");
            setReviewDecisionOpen(true);
          }}
        />
      </div>

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

      {editorOpen ? (
        <div className="trainerClientModalBackdrop trainerWorkoutEditorModalBackdrop" role="dialog" aria-modal="true" aria-label="Редактор программы клиента" onClick={closeEditor}>
          <section className={`trainerWorkoutEditorModal ${trainerClientWorkoutPlanStyles.editorModal}`} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>РЕДАКТОР ПРОГРАММЫ</span>
                <h2>{assignedName}</h2>
                <p>Изменения применяются к текущему плану клиента.</p>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Закрыть редактор" disabled={editorSaving}><X size={18} /></button>
            </header>
            <div className="trainerWorkoutEditorModalBody">
              <TrainerWorkoutEditor
                key={editorWorkoutId || "program-editor"}
                embedded
                showProgramControl={false}
                client={client}
                history={history}
                workouts={workouts}
                {...editorProps}
                initialWorkoutId={editorWorkoutId}
                onSave={saveEditorChanges}
              />
            </div>
            <footer className={trainerClientWorkoutPlanStyles.editorFooter}>
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
  const [expandedExercise, setExpandedExercise] = useState("");
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
    if (filter === "progress") return exerciseProgress.filter((item) => item.status === "progress").slice(0, 8);
    if (filter === "regression") return priorityProgress.slice(0, 8);
    if (filter === "all") return exerciseProgress.slice(0, 12);
    return priorityProgress.slice(0, 8);
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
                <div className={workspaceFeatureStyles.actions}>
                  <button type="button" onClick={() => setExpandedExercise((current) => current === item.name ? "" : item.name)}>
                    <History size={15} />{expandedExercise === item.name ? "Скрыть историю" : "Открыть историю"}
                  </button>
                  {!item.reviewed ? (
                    <button type="button" onClick={() => setDecisionItem(item)}><SlidersHorizontal size={15} />Скорректировать нагрузку</button>
                  ) : null}
                </div>
              </div>
              <small className={`trainerExerciseProgressCardNote ${item.tone}`}>{item.explanation}</small>
              {expandedExercise === item.name ? (
                <div className={workspaceFeatureStyles.history}>
                  <div className="trainerExerciseProgressContext">
                    <small>{item.current.weightConventionLabel}. {item.current.e1rmFormula}{item.current.e1rmLowConfidence ? ". При большом числе повторений оценка менее точна." : "."}</small>
                    {item.current.loadChangedByClient ? <small className="warning">⚠️ Клиент самостоятельно изменил рабочий вес.</small> : null}
                    {item.current.clientComment ? <small>Комментарий клиента: «{item.current.clientComment}»</small> : null}
                    {item.current.painReported ? <small className="negative">⚠️ В комментарии упоминается боль или травма — проверьте нагрузку.</small> : null}
                  </div>
                  {item.sessions.map((session) => (
                    <div key={`${item.name}_${session.date.toISOString()}`}>
                      <strong>{formatCompactDate(session.date)} — выполнено</strong>
                      {(session.actualSets || []).map((set, index) => (
                        <small key={`${session.date.toISOString()}_${index}`}>
                          {index + 1}. План: {session.plannedSets?.[index]?.weight || "—"} кг × {session.plannedSets?.[index]?.reps || "—"} · Факт: {set.weight || "—"} кг × {set.reps || "—"}
                          {set.rpe ? ` · RPE ${set.rpe}` : ""}{set.rir ? ` · RIR ${set.rir}` : ""} · объём {set.volume || 0} кг
                        </small>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
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
    </section>
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
  const chartDays = recentDays.slice(-14);
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
          <div className="trainerClientBarChart">
            {chartDays.map((day, index) => {
              const calories = Math.round(Number(day.totals?.calories) || 0);
              const date = day.parsedDate;
              return (
                <div key={day.date || index}>
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
              style={{ background: `conic-gradient(#34aa5f 0 ${proteinAngle}deg, #f2a329 ${proteinAngle}deg ${proteinAngle + fatAngle}deg, #6a43ef ${proteinAngle + fatAngle}deg 360deg)` }}
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
  const visibleDays = nutritionDays.slice(0, 30);
  const day = visibleDays[activeDay] || visibleDays[0] || { foods: [], totals: {} };
  const foods = day.foods || day.items || [];
  const totals = day.totals || {};

  return (
    <div className="trainerNutritionDiary">
      <aside>
        {visibleDays.map((item, index) => {
          const date = getWorkspaceDate(item.date);
          return (
            <button type="button" className={activeDay === index ? "active" : ""} aria-pressed={activeDay === index} key={item.date || index} onClick={() => setActiveDay(index)}>
              <strong>{date ? date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : `День ${index + 1}`}</strong>
              <small>{Math.round(Number(item.totals?.calories) || 0)} ккал</small>
            </button>
          );
        })}
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

function NutritionPlan({ client, goals, planOptions = [], onSavePlan, onGeneratePlan, status }) {
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
    const saved = await onSavePlan?.({ ...draft, presetId: draft.presetId || preset });
    setSaving(false);
    if (saved !== false) setEditing(false);
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
          {!editing ? <button type="button" onClick={() => setEditing(true)}>Изменить план</button> : null}
        </div>
      </section>

      {editing ? (
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
            <small className="trainerNutritionPresetPreview">
              {Number(draft.calories) || 0} ккал · Б {Number(draft.protein) || 0} · Ж {Number(draft.fat) || 0} · У {Number(draft.carbs) || 0}
            </small>
          </label>
          <label><span>Название плана</span><input value={draft.name} onChange={(event) => { setPreset("custom"); setDraft((current) => ({ ...current, name: event.target.value, presetId: "custom" })); }} /></label>
          <label><span>Цель клиента</span><input value={draft.goal} placeholder="Например, рекомпозиция" onChange={(event) => { setPreset("custom"); setDraft((current) => ({ ...current, goal: event.target.value, presetId: "custom" })); }} /></label>
        </div>
        <div className="trainerNutritionGoalInputs">
          {[
            ["calories", "Калории", "ккал"],
            ["protein", "Белки", "г"],
            ["fat", "Жиры", "г"],
            ["carbs", "Углеводы", "г"]
          ].map(([key, label, unit]) => (
            <label key={key}><span>{label}</span><div><input type="number" min="0" value={draft[key]} onChange={(event) => { setPreset("custom"); setDraft((current) => ({ ...current, [key]: event.target.value, presetId: "custom" })); }} /><small>{unit}</small></div></label>
          ))}
        </div>
        <div className="trainerNutritionValidity">
          <label><span>Действует с</span><input type="date" value={draft.validFrom} onChange={(event) => setDraft((current) => ({ ...current, validFrom: event.target.value }))} /></label>
          <label><span>Действует по</span><input type="date" min={draft.validFrom || undefined} value={draft.validTo} onChange={(event) => setDraft((current) => ({ ...current, validTo: event.target.value }))} /></label>
          <small>Период необязателен. Без дат план действует до следующего изменения.</small>
        </div>
        <div className="trainerNutritionPlanActions">
          <button className="trainerNextPrimary" type="button" disabled={saving} onClick={savePlan}><Save size={17} />{saving ? "Сохранение..." : "Сохранить"}</button>
          {currentPlan ? <button type="button" onClick={() => setEditing(false)}>Отмена</button> : null}
          <button type="button" onClick={onGeneratePlan}><Sparkles size={17} />Подготовить AI-план</button>
        </div>
        {status ? <p className="trainerNextProgramStatus">{status}</p> : null}
      </section>
      ) : null}
    </div>
  );
}

function NutritionView({ client, nutritionDays, goals = {}, planOptions = [], onGeneratePlan, onSavePlan, status }) {
  const [diaryOpen, setDiaryOpen] = useState(false);
  const target = {
    calories: Number(goals.calories) || 2000,
    protein: Number(goals.protein) || 150,
    fat: Number(goals.fat) || 50,
    carbs: Number(goals.carbs) || 200
  };
  const scrollToNutritionSection = (id) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="trainerNextNutrition trainerNextNutritionUnified">
      <nav className="trainerNutritionQuickNav" aria-label="Разделы питания клиента">
        <button type="button" onClick={() => scrollToNutritionSection("trainerNutritionAnalytics")}>Аналитика</button>
        <button type="button" onClick={() => scrollToNutritionSection("trainerNutritionDiary")}>Дневник</button>
        <button type="button" onClick={() => scrollToNutritionSection("trainerNutritionPlan")}>План питания</button>
      </nav>

      <section id="trainerNutritionAnalytics" className="trainerNutritionUnifiedSection">
        <div className="trainerClientBlockHeading">
          <span><BarChart3 size={19} /></span>
          <div><h2>Аналитика питания</h2><p>Средние значения считаются по завершённым дням без сегодняшнего дня.</p></div>
        </div>
        <NutritionAnalytics nutritionDays={nutritionDays} target={target} />
      </section>

      <section id="trainerNutritionDiary" className={`trainerNutritionUnifiedSection ${diaryOpen ? "" : "trainerNutritionUnifiedSectionCollapsed"}`}>
        <div className="trainerClientBlockHeading">
          <span><Eye size={19} /></span>
          <div><h2>Дневник питания</h2><p>Просмотр записей клиента без редактирования со стороны тренера.</p></div>
          <button
            className="trainerNutritionSectionToggle"
            type="button"
            aria-expanded={diaryOpen}
            onClick={() => setDiaryOpen((current) => !current)}
          >
            {diaryOpen ? "Свернуть" : "Показать дневник"}
            <ChevronDown size={16} />
          </button>
        </div>
        {diaryOpen ? (
          <NutritionDiary nutritionDays={nutritionDays} />
        ) : (
          <button className="trainerNutritionDiaryCollapsed" type="button" onClick={() => setDiaryOpen(true)}>
            <span>Дневник свернут</span>
            <strong>{nutritionDays.length ? `${nutritionDays.length} дней с записями` : "Нет записей"}</strong>
          </button>
        )}
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
          goals={goals}
          planOptions={planOptions}
          onSavePlan={onSavePlan}
          onGeneratePlan={onGeneratePlan}
          status={status}
        />
      </section>
    </div>
  );
}

function TrainerNutritionPage({ client, nutritionDays, goals, planOptions = [], onGeneratePlan, onSavePlan, status }) {
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
      <NutritionView client={client} nutritionDays={nutritionDays} goals={goals} planOptions={planOptions} onGeneratePlan={onGeneratePlan} onSavePlan={onSavePlan} status={status} />
    </div>
  );
}

function ClientNotifications({
  client,
  workouts,
  measurements = [],
  photos = [],
  status,
  onSave,
  onTest,
  onConnectTelegram
}) {
  const calendar = client?.workoutCalendar || {};
  const telegram = client?.telegram || {};
  const connected = Boolean(telegram.connected || client?.telegramConnected || telegram.telegramUserId || client?.telegramUserId);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const progressReminderSettings = calendar.progressReminderSettings || client?.progressReminderSettings || {};
  const initialScheduledDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(calendar.monthlyTrainingDates)
      ? calendar.monthlyTrainingDates
      : [];
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
  const [calendarMonth, setCalendarMonth] = useState((initialScheduledDates[0] || getLocalDateKey()).slice(0, 7));
  const scheduledDates = draft.scheduledDates || [];
  const trainingDays = calendar.trainingDays || client?.trainingDays || [];
  const scheduleText = scheduledDates.length
    ? `${scheduledDates.length} ${pluralize(scheduledDates.length, "дата", "даты", "дат")} в календаре`
    : trainingDays.length
      ? `${trainingDays.length} ${pluralize(trainingDays.length, "день", "дня", "дней")} в неделю`
      : "Расписание ещё не настроено";
  const progressReminderPeriodOptions = [7, 14, 30];
  const calendarDays = getCalendarMonthDays(calendarMonth);
  const calendarStartKey = calendarDays[0]?.key || getLocalDateKey();
  const calendarEndKey = calendarDays[calendarDays.length - 1]?.key || calendarStartKey;

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

  function toggleScheduledDate(dateKey) {
    setDraft((current) => {
      const currentDates = Array.isArray(current.scheduledDates) ? current.scheduledDates : [];
      const exists = currentDates.includes(dateKey);
      return {
        ...current,
        scheduledDates: exists
          ? currentDates.filter((date) => date !== dateKey)
          : [...currentDates, dateKey].sort()
      };
    });
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await onSave?.({
        enabled: draft.enabled,
        offsets: draft.offsets,
        scheduledDates: draft.scheduledDates,
        progressPhotoEnabled: draft.progressPhotoEnabled,
        measurementsEnabled: draft.measurementsEnabled,
        progressPhotoIntervalDays: draft.photoIntervalDays,
        measurementsIntervalDays: draft.measurementsIntervalDays
      });
    } finally {
      setSaving(false);
    }
  }

  async function testNotification() {
    setTesting(true);
    await onTest?.();
    setTesting(false);
  }

  return (
    <div className="trainerClientNotifications">
      <section className="trainerNotificationStatusCard">
        <div className={`trainerNotificationIcon ${connected ? "connected" : ""}`}><Bell size={22} /></div>
        <div>
          <span>TELEGRAM</span>
          <h2>{connected ? "Telegram подключён" : "Telegram не подключён"}</h2>
          <p>{connected ? `Напоминания будут отправляться ${telegram.username || client?.telegramUsername ? `пользователю @${telegram.username || client.telegramUsername}` : "в привязанный аккаунт"}.` : "Клиенту нужно открыть бота и привязать свой аккаунт."}</p>
        </div>
        <i className={connected ? "connected" : ""}>{connected ? "Подключён" : "Не подключён"}</i>
        {!connected ? <button type="button" onClick={onConnectTelegram}>Подключить Telegram</button> : null}
      </section>

      <section className={`trainerNotificationSettings ${workspaceFeatureStyles.notificationPanel}`}>
        <header>
          <div><span>УВЕДОМЛЕНИЯ</span><h2>Напоминания</h2><p>Настройте автоматические уведомления для клиента.</p></div>
          <label className="trainerNotificationSwitch compact" aria-label="Включить уведомления">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
            <i />
          </label>
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

        <div className={`trainerNotificationCalendar ${workspaceFeatureStyles.notificationCalendar}`}>
          <header>
            <div>
              <strong>Календарь напоминаний</strong>
              <p>Выберите конкретные дни, когда клиенту нужно напомнить о тренировке.</p>
            </div>
            <div>
              <button type="button" onClick={() => shiftCalendarMonth(-1)} aria-label="Предыдущий месяц"><ChevronUp size={15} /></button>
              <b>{new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</b>
              <button type="button" onClick={() => shiftCalendarMonth(1)} aria-label="Следующий месяц"><ChevronDown size={15} /></button>
            </div>
          </header>
          <div className="trainerNotificationSchedule">
            <span><CalendarDays size={18} /><b>Расписание</b><small>{scheduleText}</small></span>
            <span><Dumbbell size={18} /><b>Программа</b><small>{client?.assignedProgramName || (workouts.length ? "Индивидуальная программа" : "Не назначена")}</small></span>
          </div>
          <div className="trainerNotificationWeekdays">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="trainerNotificationCalendarGrid">
            {calendarDays.map((day) => {
              const active = scheduledDates.includes(day.key);
              const today = day.key === getLocalDateKey();
              const photoReminder = photoReminderDates.has(day.key);
              const measurementReminder = measurementReminderDates.has(day.key);
              const labels = [
                active ? "тренировка" : "",
                photoReminder ? "фото прогресса" : "",
                measurementReminder ? "замеры тела" : ""
              ].filter(Boolean);
              return (
                <button
                  type="button"
                  key={day.key}
                  className={[
                    active ? "active" : "",
                    day.currentMonth ? "" : "muted",
                    today ? "today" : "",
                    photoReminder ? "photoReminder" : "",
                    measurementReminder ? "measurementReminder" : ""
                  ].filter(Boolean).join(" ")}
                  aria-pressed={active}
                  onClick={() => toggleScheduledDate(day.key)}
                  title={labels.length ? `${day.key}: ${labels.join(", ")}` : day.key}
                >
                  <b>{day.label}</b>
                  {labels.length ? (
                    <span className="trainerNotificationDayBadges">
                      {active ? <i className="workout">Т</i> : null}
                      {photoReminder ? <i className="photo">Ф</i> : null}
                      {measurementReminder ? <i className="measurement">З</i> : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="trainerNotificationLegend" aria-label="Типы напоминаний">
            <span><i className="workout" />Тренировка</span>
            <span><i className="photo" />Фото</span>
            <span><i className="measurement" />Замеры</span>
          </div>
          <small>{scheduledDates.length ? `Выбрано дат: ${scheduledDates.length}` : "Даты не выбраны. Напоминания будут опираться на недельное расписание клиента."}</small>
        </div>

        <div className={`trainerNotificationActions ${workspaceFeatureStyles.notificationActions}`}>
          <button className="trainerNextPrimary" type="button" disabled={saving || !draft.offsets.length} onClick={saveSettings}><Save size={17} />{saving ? "Сохранение..." : "Сохранить настройки"}</button>
          <button type="button" disabled={!connected || testing} onClick={testNotification}><Mail size={17} />{testing ? "Отправка..." : "Отправить тестовое уведомление"}</button>
        </div>
        {!draft.offsets.length ? <p className="trainerNotificationHint">Выберите хотя бы один интервал напоминания.</p> : null}
        {status ? <p className="trainerNextProgramStatus">{status}</p> : null}
      </section>
    </div>
  );
}

function ClientWorkSummary({ snapshot, workoutReview }) {
  if (!snapshot && !workoutReview?.workoutId) return null;

  const completion = snapshot?.assignedWorkoutCount
    ? `${snapshot.completedWorkoutCount || 0} из ${snapshot.assignedWorkoutCount}`
    : "нет программы";
  const statusText = snapshot?.primaryAttention?.reason || snapshot?.status?.label || "Активен";
  const lastWorkout = snapshot?.lastWorkoutAt ? formatCompactDate(snapshot.lastWorkoutAt) : "нет данных";
  const lastMeasurement = snapshot?.lastMeasurementAt ? formatCompactDate(snapshot.lastMeasurementAt) : "нет данных";
  const reviewTitle = workoutReview?.workoutName || "Последняя тренировка";
  const reviewSets = workoutReview?.plannedSetsCount
    ? `${workoutReview.completedSetsCount || 0} из ${workoutReview.plannedSetsCount} подходов`
    : `${workoutReview?.completedSetsCount || 0} подходов`;

  return (
    <section className="trainerClientWorkSummary" aria-label="Короткая сводка по клиенту">
      <article>
        <span>СОСТОЯНИЕ</span>
        <strong>{statusText}</strong>
        <small>Программа: {completion}</small>
      </article>
      <article>
        <span>АКТИВНОСТЬ</span>
        <strong>{lastWorkout}</strong>
        <small>Замеры: {lastMeasurement}</small>
      </article>
      <article>
        <span>ЗАДАЧИ</span>
        <strong>{snapshot?.activeTasksCount || 0}</strong>
        <small>активных задач</small>
      </article>
      {workoutReview?.workoutId ? (
        <article className={workoutReview.needsTrainerReply ? "attention" : ""}>
          <span>ПОСЛЕДНЯЯ ТРЕНИРОВКА</span>
          <strong>{reviewTitle}</strong>
          <small>{workoutReview.completedExercisesCount || 0} упр. · {reviewSets} · {workoutReview.volumeKg || 0} кг</small>
          {workoutReview.clientComment ? <p>{workoutReview.clientComment}</p> : null}
        </article>
      ) : null}
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
  exerciseLibrary,
  programTemplates,
  selectedProgramId,
  onSelectProgram,
  onAssignProgram,
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
  const exercisesOpen = ["exercises", "workouts", "exerciseProgress", "training"].includes(activeTab);
  const exerciseSubview = activeTab === "exerciseProgress" ? "progress" : "plan";
  const messagesOpen = ["messages", "notes"].includes(activeTab);
  const clientTelegram = getClientTelegramProfile(client);
  const telegramAvailable = Boolean(clientTelegram.connected && clientTelegram.username && onOpenTelegramChat);
  const clientSubscriptionStatus = client.subscription ? getSubscriptionStatus(client.subscription) : null;
  const profileFacts = [
    profile?.age ? `${profile.age} лет` : "",
    profile?.height ? `${profile.height} см` : "",
    profile?.weight ? `${profile.weight} кг` : ""
  ].filter(Boolean);
  const profileMetaText = profileFacts.length ? profileFacts.join(" · ") : "Данные профиля не заполнены";
  const [messageOpen, setMessageOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("trainerClient") === client.id && params.get("compose") === "1";
  });
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageSourceNote, setMessageSourceNote] = useState(null);
  const [messageStatus, setMessageStatus] = useState("");
  const [messageAttemptId, setMessageAttemptId] = useState("");
  const [messageChannel, setMessageChannel] = useState("telegram");
  const [contactOpen, setContactOpen] = useState(false);
  const [utilitySheet, setUtilitySheet] = useState("");
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
  const clientActions = [
    client.archived
      ? { id: "restore", label: "Восстановить клиента", icon: "♻️" }
      : { id: "archive", label: "Архивировать клиента", icon: "📦" },
    { id: "duplicate", label: "Дублировать клиента", icon: "📋" },
    { id: "export_excel", label: "Экспорт Excel", icon: "📊" },
    { id: "export_pdf", label: "Экспорт PDF", icon: "📄" },
    { id: "disable_notifications", label: "Отключить уведомления", icon: "🔕" },
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
    setMessageChannel("telegram");
    setMessageText("");
    setMessageStatus("");
    setMessageAttemptId(`feedback_reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    setMessageOpen(true);
  }

  function openNewMessage(channel = "telegram") {
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
    setMessageChannel("telegram");
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
    await onClientAction?.(actionId, client);
  }

  const isClientTabActive = (tab) => (
    (tab.id === "exercises" && exercisesOpen)
    || (tab.id === "messages" && messagesOpen)
    || activeTab === tab.id
    || (tab.id === "bodyProgress" && ["measurements", "photos"].includes(activeTab))
  );

  return (
    <div className="trainerNextPage trainerNextClientPage">
      <div className="trainerNextClientBackRow">
        <button className="trainerNextClientBackButton" type="button" onClick={onBack} aria-label="Назад к списку клиентов">
          <ArrowLeft size={20} />
          <span className="trainerNextClientBackDesktop">Назад к списку</span>
          <span className="trainerNextClientBackMobile">Клиенты</span>
        </button>
        <div>
          <button className="trainerNextPrimary" type="button" onClick={() => setUtilitySheet("messages")}><MessageSquare size={16} />Сообщения</button>
          <button type="button" onClick={() => setUtilitySheet("notifications")}><Bell size={16} />Уведомления</button>
          <button className="trainerNextClientActionsButton" type="button" onClick={() => setActionsOpen(true)} aria-label="Действия">
            <EllipsisVertical size={18} />
            <span>Действия</span>
          </button>
        </div>
      </div>

      <header className="trainerNextClientHeader">
        <TrainerAvatar client={client} size="large" />
        <div>
          <div className="trainerNextClientName"><h1>{name}</h1><span>{clientSubscriptionStatus?.label || "Активен"}</span></div>
          <p>{profileMetaText}</p>
          <strong>Цель: {client.goalDescription || profile?.goalLabel || "Персональный результат"}</strong>
        </div>
        {onCreateTask ? (
          <button
            className="trainerNextClientTaskButton"
            type="button"
            onClick={onCreateTask}
          >
            <ClipboardList size={17} />
            <span>Назначить задачу</span>
          </button>
        ) : null}
      </header>

      <nav className="trainerNextClientTabs">
        {CLIENT_TABS.map((tab) => {
          const active = isClientTabActive(tab);
          return <button type="button" key={tab.id} className={active ? "active" : ""} aria-pressed={active} onClick={() => onTabChange(tab.target || tab.id)}>{tab.label}</button>;
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

      {activeTab === "overview" ? (
        <>
          <ClientWorkSummary snapshot={snapshot} workoutReview={visibleSummaryWorkoutReview} />
          <ClientOverview client={client} profile={profile} summary={summary} measurements={measurements} history={history} nutritionDays={nutritionDays} nutritionGoals={nutritionGoals} photos={photos} tasks={tasks} onSaveSubscription={onSaveNotifications} />
        </>
      ) : null}
      {exercisesOpen ? (
        <section className={trainerClientExercisesTabsStyles.section}>
          <nav className={trainerClientExercisesTabsStyles.switcher} aria-label="Разделы упражнений клиента">
            <button
              type="button"
              className={exerciseSubview === "plan" ? trainerClientExercisesTabsStyles.active : ""}
              aria-pressed={exerciseSubview === "plan"}
              onClick={() => onTabChange("workouts")}
            >
              План тренировок
            </button>
            <button
              type="button"
              className={exerciseSubview === "progress" ? trainerClientExercisesTabsStyles.active : ""}
              aria-pressed={exerciseSubview === "progress"}
              onClick={() => onTabChange("exerciseProgress")}
            >
              Прогресс упражнений
            </button>
          </nav>

          {exerciseSubview === "plan" ? (
            <ClientWorkoutPlan
              client={client}
              summary={summary}
              history={history}
              workouts={workouts}
              programTemplates={programTemplates}
              selectedProgramId={selectedProgramId}
              onSelectProgram={onSelectProgram}
              onAssignProgram={onAssignProgram}
              onSaveWorkoutSchedule={onSaveWorkoutSchedule}
              programStatus={programStatus}
              adjustmentRequest={adjustmentRequest}
              reviewEvents={exerciseProgressReviews}
              onResolveWorkoutReview={(payload) => onClientAction?.("resolve_workout_review", client, payload)}
              editorProps={{
                exerciseLibrary,
                programTemplates,
                selectedProgramId,
                onSelectProgram,
                onAssignProgram,
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
          ) : (
            <ClientExerciseProgress
              key={client?.id || "trainer-client-exercise-progress"}
              client={client}
              history={history}
              workouts={workouts}
              reviews={exerciseProgressReviews}
              onResolve={onResolveExerciseProgress}
              onSaveAdjustment={onSaveExerciseProgressAdjustment}
            />
          )}
        </section>
      ) : null}
      {activeTab === "nutrition" ? <NutritionView client={client} nutritionDays={nutritionDays} goals={nutritionGoals} planOptions={nutritionPlanOptions} onGeneratePlan={onGeneratePlan} onSavePlan={onSaveNutritionPlan} status={programStatus} /> : null}
      {["bodyProgress", "measurements", "photos"].includes(activeTab) ? <ClientBodyProgress measurements={measurements} photos={photos} /> : null}
      {activeTab === "notifications" ? <ClientNotifications key={client.id} client={client} workouts={workouts} measurements={measurements} photos={photos} status={programStatus} onSave={onSaveNotifications} onTest={onTestNotification} onConnectTelegram={onConnectTelegram} /> : null}
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
        <TrainerClientUtilitySheet title="Сообщения" eyebrow="Клиент" onRequestClose={() => setUtilitySheet("")}>
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
        <TrainerClientUtilitySheet title="Уведомления" eyebrow="Клиент" onRequestClose={() => setUtilitySheet("")}>
          <ClientNotifications
            key={`utility-notifications-${client.id}`}
            client={client}
            workouts={workouts}
            measurements={measurements}
            photos={photos}
            status={programStatus}
            onSave={onSaveNotifications}
            onTest={onTestNotification}
            onConnectTelegram={onConnectTelegram}
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
        <div className="trainerClientModalBackdrop" role="dialog" aria-modal="true" aria-label="Управление клиентом">
          <section className="trainerClientActionSheet">
            <header>
              <div><span>УПРАВЛЕНИЕ КЛИЕНТОМ</span><h2>{name}</h2></div>
              <button type="button" onClick={() => setActionsOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <div>
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
  return `${uniqueValues.length === 1 ? uniqueValues[0] : `${uniqueValues[0]}â€¦${uniqueValues.at(-1)}`}${suffix}`;
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
                                <input value={set.weight ?? ""} disabled={!requiresWeight} onChange={(event) => onUpdateExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, setIndex, { weight: event.target.value })} />
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
      {isDayEditorOpen ? <div className="trainerProgramDayEditorBackdrop" role="presentation" onMouseDown={() => setIsDayEditorOpen(false)} /> : null}
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

function TrainerWorkoutEditor({
  embedded = false,
  initialWorkoutId = "",
  showProgramControl = true,
  client,
  history = [],
  workouts = [],
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

  const validSelectedWorkoutId = workouts.some((item) => item.id === selectedWorkoutId)
    ? selectedWorkoutId
    : workouts[0]?.id || "";
  const scheduleSlots = useMemo(
    () => buildPlannedWorkoutSlots({
      workouts,
      calendar: client?.workoutCalendar || {},
      history
    }),
    [workouts, client?.workoutCalendar, history]
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
    const displayStatus = historyStatus && historyStatus !== "planned"
      ? historyStatus
      : workout.status || "planned";

    return {
      ...workout,
      displayStatus,
      displayCompletedDate: slot?.completedDate || "",
      displayPlannedDate: slot?.plannedDate || "",
      displayOffDate: Boolean(slot?.isCompletedOffDate)
    };
  }), [workouts, scheduleSlotByWorkoutId]);
  const selectedWorkout = displayWorkouts.find((item) => item.id === validSelectedWorkoutId) || displayWorkouts[0] || null;
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
      ? onAddExercise?.(selectedWorkout.id, { name: "Новое упражнение" })
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
    setLibraryEditorDraft((current) => {
      if (!current) return current;
      const sets = (current.sets?.length ? current.sets : [{ reps: "", weight: "" }]).map((set, index) => (
        index === setIndex ? { ...set, ...patch } : set
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
    if (!workout) return;
    setConfirmAction({
      title: "Удалить тренировку",
      text: `Тренировка «${getWorkoutTitle(workout, selectedWorkoutIndex)}» будет удалена из программы клиента.`,
      onConfirm: () => {
        onRemoveDay(workout.id);
        setExpandedExerciseId("");
        setConfirmAction(null);
      }
    });
  }

  function confirmRemoveExercise(exercise) {
    if (!selectedWorkout || !exercise) return;
    setConfirmAction({
      title: "Удалить упражнение",
      text: `Упражнение «${exercise.name || "Без названия"}» будет удалено из текущей тренировки.`,
      onConfirm: () => {
        onRemoveExercise(selectedWorkout.id, exercise.id);
        if (expandedExerciseId === exercise.id) setExpandedExerciseId("");
        setConfirmAction(null);
      }
    });
  }

  return (
    <div className={embedded ? "trainerNextEmbeddedPlan trainerNextWorkoutPage" : "trainerNextPage trainerNextWorkoutPage"}>
      {!embedded ? <div className="trainerNextDesktopPageHead">
        <div><h1>{tab === "library" ? "Библиотека упражнений" : "План тренировок"}</h1><p>{client ? `Клиент: ${client.name || client.email}` : "Выберите клиента"}</p></div>
        {tab === "plan" ? (
          <div className="trainerNextHeadActions">
            <button type="button" onClick={() => setPreviewOpen(true)}><Eye size={17} />Предпросмотр</button>
            <button className="trainerNextPrimary" type="button" onClick={onSave}><Save size={17} />Сохранить</button>
          </div>
        ) : null}
      </div> : null}
      {!embedded ? <header className="trainerNextMobileHeader">
        <div className="trainerNextMobileTitle">{tab === "library" ? "Библиотека" : "План тренировок"}</div>
        {tab === "plan" ? <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Предпросмотр"><Eye size={21} /></button> : <span />}
      </header> : null}
      {!embedded && tab !== "plan" ? <div className="trainerNextPageTabs">
        <button type="button" onClick={onOpenProgramManager}>Программы</button>
        <button type="button" className={tab === "library" ? "isActive" : ""} aria-current={tab === "library" ? "page" : undefined} aria-pressed={tab === "library"} onClick={() => onWorkoutTabChange("library")}>Библиотека упражнений</button>
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
              {(programTemplates || []).map((program) => (
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
                      <button type="button" onClick={() => onDuplicateDay(workout.id)} aria-label="Копировать тренировку" title="Копировать"><Copy size={13} /></button>
                      <button type="button" onClick={() => confirmRemoveWorkout(workout)} aria-label="Удалить тренировку" title="Удалить"><Trash2 size={13} /></button>
                    </div>
                  ) : null}
                </div>
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
                    <input type="date" value={selectedWorkout.movedToDate || ""} onChange={(event) => onUpdateWorkout(selectedWorkout.id, { movedToDate: event.target.value, status: "moved" })} />
                  </label>
                ) : null}
              </div>
              </>
            ) : <h2>Добавьте тренировочный день</h2>}
            <div className="trainerNextExerciseHead"><span>Упражнение</span><span>Подходы</span><span>Повторения</span><span>Вес</span><span>Отдых</span><span /></div>
            <div className="trainerNextExerciseList">
              {(selectedWorkout?.exercises || []).map((exercise, index) => {
                const sets = Array.isArray(exercise.sets) && exercise.sets.length
                  ? exercise.sets
                  : [{ reps: "", weight: "" }];
                const isExpanded = expandedExerciseId === exercise.id;
                const requiresWeight = exercise.requiresWeight ?? exercise.usesWeight ?? true;
                const video = getExerciseVideo(exercise);
                return (
                  <article className={isExpanded ? "expanded" : ""} key={exercise.id || index}>
                    <div className="trainerNextExerciseRow">
                      <span className="trainerNextExerciseMove">
                        <GripVertical size={15} />
                        <button type="button" disabled={index === 0} onClick={() => onMoveExercise(selectedWorkout.id, exercise.id, -1)} aria-label="Поднять упражнение"><ChevronUp size={13} /></button>
                        <button type="button" disabled={index === selectedWorkout.exercises.length - 1} onClick={() => onMoveExercise(selectedWorkout.id, exercise.id, 1)} aria-label="Опустить упражнение"><ChevronDown size={13} /></button>
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
                        <small>{video ? "Видео добавлено" : "Без видео"}</small>
                      </button>
                      <span className="trainerNextExerciseMetric"><strong>{sets.length}</strong><small>подх.</small></span>
                      <span className="trainerNextExerciseMetric"><strong>{getExerciseSetSummary(sets, "reps")}</strong><small>повт.</small></span>
                      <span className="trainerNextExerciseMetric"><strong>{requiresWeight ? getExerciseSetSummary(sets, "weight", " кг") : "—"}</strong><small>вес</small></span>
                      <span className="trainerNextExerciseMetric"><strong>{exercise.rest || "90 сек"}</strong><small>отдых</small></span>
                      <div className="trainerNextExerciseActions">
                        <button type="button" onClick={() => setExpandedExerciseId(isExpanded ? "" : exercise.id)} aria-label={isExpanded ? "Свернуть упражнение" : "Редактировать упражнение"}><EllipsisVertical size={17} /></button>
                        <button type="button" onClick={() => confirmRemoveExercise(exercise)} aria-label="Удалить упражнение"><Trash2 size={15} /></button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="trainerNextExerciseEditor">
                        <div className="trainerNextExerciseFields">
                          <label className="wide"><span>Название</span><input value={exercise.name || ""} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { name: event.target.value })} /></label>
                          <label><span>Отдых</span><input value={exercise.rest || ""} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { rest: event.target.value })} placeholder="90 сек" /></label>
                          <label className="trainerNextWeightToggle">
                            <span>Используется вес</span>
                            <input type="checkbox" checked={requiresWeight} onChange={(event) => onUpdateExercise(selectedWorkout.id, exercise.id, { requiresWeight: event.target.checked, usesWeight: event.target.checked })} />
                          </label>
                          <label className="trainerNextVideoUpload">
                            <Upload size={16} />
                            <span>{exerciseVideoUploadingId === exercise.id ? "Загрузка..." : video ? "Заменить видео" : "Загрузить видео"}</span>
                            <input type="file" accept="video/*" disabled={exerciseVideoUploadingId === exercise.id} onChange={(event) => onUploadExerciseVideo(selectedWorkout.id, exercise.id, event.target.files?.[0])} />
                          </label>
                        </div>

                        <div className="trainerNextSetEditor">
                          <div className="trainerNextSetEditorHead"><span>Подход</span><span>Повторы</span><span>Вес, кг</span><span /></div>
                          {sets.map((set, setIndex) => (
                            <div className="trainerNextSetRow" key={set.id || setIndex}>
                              <strong>{setIndex + 1}</strong>
                              <input aria-label={`Повторы, подход ${setIndex + 1}`} value={set.reps ?? ""} onChange={(event) => onUpdateExerciseSet(selectedWorkout.id, exercise.id, setIndex, { reps: event.target.value })} />
                              <input aria-label={`Вес, подход ${setIndex + 1}`} value={set.weight ?? ""} disabled={!requiresWeight} onChange={(event) => onUpdateExerciseSet(selectedWorkout.id, exercise.id, setIndex, { weight: event.target.value })} />
                              <button type="button" disabled={sets.length <= 1} onClick={() => onRemoveExerciseSet(selectedWorkout.id, exercise.id, setIndex)} aria-label={`Удалить подход ${setIndex + 1}`}><X size={14} /></button>
                            </div>
                          ))}
                          <button className="trainerNextAddSet" type="button" onClick={() => onAddExerciseSet(selectedWorkout.id, exercise.id)}><Plus size={15} />Добавить подход</button>
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
              disabled={!selectedWorkout}
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
        <section className="trainerNextLibrary">
          <div className="trainerNextPanelTitle">
            <div><h2>Библиотека упражнений</h2><p>Видео и параметры из сохранённых программ</p></div>
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
        <div className={`trainerNextModalBackdrop ${exerciseLibraryEditorStyles.backdrop}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeLibraryEditor()}>
          <section className={exerciseLibraryEditorStyles.modal} role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="trainer-library-editor-title">
            <button type="button" className={exerciseLibraryEditorStyles.close} onClick={closeLibraryEditor} disabled={libraryEditorSaving} aria-label="Закрыть редактор упражнения"><X size={18} /></button>
            <header className={exerciseLibraryEditorStyles.header}>
              <small>БИБЛИОТЕКА УПРАЖНЕНИЙ</small>
              <h2 id="trainer-library-editor-title">Редактирование упражнения</h2>
              <p>Изменения применятся после нажатия кнопки «Сохранить».</p>
            </header>
            <div className={exerciseLibraryEditorStyles.body}>
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
                    <input aria-label={`Вес, подход ${setIndex + 1}`} value={set.weight ?? ""} disabled={libraryEditorSaving || !(activeLibraryEditorExercise.requiresWeight ?? activeLibraryEditorExercise.usesWeight ?? true)} onChange={(event) => updateLibraryEditorSet(setIndex, { weight: event.target.value })} />
                    <button type="button" disabled={libraryEditorSaving || sets.length <= 1} onClick={() => removeLibraryEditorSet(setIndex)} aria-label={`Удалить подход ${setIndex + 1}`}><X size={14} /></button>
                  </div>
                ))}
                <button className={exerciseLibraryEditorStyles.addSet} type="button" disabled={libraryEditorSaving} onClick={addLibraryEditorSet}><Plus size={15} />Добавить подход</button>
              </div>
            </div>
            <footer className={exerciseLibraryEditorStyles.footer}>
              <button className={exerciseLibraryEditorStyles.deleteButton} type="button" disabled={libraryEditorSaving} onClick={confirmRemoveLibraryEditor}><Trash2 size={16} />Удалить</button>
              <button className={exerciseLibraryEditorStyles.saveButton} type="button" disabled={libraryEditorSaving} onClick={() => void saveLibraryEditor()}><Save size={16} />{libraryEditorSaving ? "Сохраняем..." : "Сохранить"}</button>
            </footer>
          </section>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="trainerNextModalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <section className="trainerNextWorkoutPreview" role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="trainer-workout-preview-title">
            <button type="button" className="trainerNextModalClose" onClick={() => setPreviewOpen(false)} aria-label="Закрыть предпросмотр"><X size={18} /></button>
            <small>ПРЕДПРОСМОТР ДЛЯ КЛИЕНТА</small>
            <h2 id="trainer-workout-preview-title">{client?.name || "План тренировок"}</h2>
            <div>
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
      {confirmAction ? (
        <TrainerConfirmDialog
          title={confirmAction.title}
          text={confirmAction.text}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      ) : null}
    </div>
  );
}

function CreateClientModal({ state }) {
  if (!state?.open) return null;
  return (
    <div className="trainerNextModalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && state.onClose()}>
      <section className="trainerNextModal trainerNextCreateClientModal" role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="trainer-create-client-title">
        <button className="trainerNextModalClose" type="button" onClick={state.onClose} aria-label="Закрыть">×</button>
        <div className="trainerNextModalIcon"><UserPlus size={24} /></div>
        <h2 id="trainer-create-client-title">Пригласить клиента</h2>
        <p>Клиент сам задаст пароль по ссылке активации и войдёт по выбранному логину.</p>
        <form className="trainerNextCreateClientForm" onSubmit={state.onSubmit}>
          <label><span>Имя</span><input value={state.name} onChange={(event) => state.onNameChange(event.target.value)} placeholder="Имя клиента" /></label>
          <label><span>Логин</span><input value={state.login} onChange={(event) => state.onLoginChange(event.target.value)} placeholder="например: ilya.fit" autoComplete="off" autoCapitalize="none" spellCheck="false" /></label>
          <small className="trainerNextModalHint">Латиница, цифры, точка, дефис или _; от 3 до 32 символов.</small>
          {state.status ? <p className="trainerNextModalStatus">{state.status}</p> : null}
          {state.credentials ? <div className="trainerNextCredentials"><strong>Ссылка активации</strong><small>Логин: {state.credentials.login}</small><div className="trainerNextCredentialLinkRow"><code>{state.credentials.shareUrl || state.credentials.inviteUrl}</code><button className="trainerNextCopyInviteLink" type="button" aria-label="Скопировать ссылку" title="Скопировать ссылку" onClick={() => navigator.clipboard?.writeText(state.credentials.shareUrl || state.credentials.activationUrl || state.credentials.inviteUrl)}><Copy size={19} strokeWidth={2.25} /></button></div></div> : null}
          <button className="trainerNextPrimary trainerNextModalSubmit" type="submit" disabled={state.loading}>{state.loading ? "Создаю..." : "Создать приглашение"}</button>
        </form>
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
  if (!section) return null;

  const isAnalytics = section === "analytics";
  const title = isAnalytics ? "Аналитика" : "Уведомления";
  const Icon = isAnalytics ? BarChart3 : Bell;

  return (
    <div
      className="trainerNextModalBackdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="trainerNextModal trainerCabinetUtilitySheet"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby={`trainer-cabinet-${section}-title`}
      >
        <header>
          <div className="trainerCabinetUtilitySheetTitle">
            <span><Icon size={19} /></span>
            <h2 id={`trainer-cabinet-${section}-title`}>{title}</h2>
          </div>
          <button className="trainerNextModalClose" type="button" onClick={onClose} aria-label={`Закрыть раздел «${title}»`}>
            <X size={20} />
          </button>
        </header>
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
        />
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
      <div className="trainerNextPage trainerNextCabinetPage">
        <header className="trainerNextMobileHeader">
          <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
          <div className="trainerNextMobileTitle">Кабинет</div>
          <div className="trainerNextMobileHeaderActions">
            <button type="button" onClick={onRefresh} aria-label="Обновить страницу"><RefreshCw size={20} /></button>
          </div>
        </header>

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
          <button type="button" onClick={() => setOpenSheet("analytics")}>
            <span><BarChart3 size={19} /></span>
            <div><strong>Аналитика</strong><small>Сводка по активности и рискам клиентов</small></div>
            <ChevronRight size={18} />
          </button>
          <button type="button" onClick={() => setOpenSheet("notifications")}>
            <span><Bell size={19} /></span>
            <div><strong>Уведомления</strong><small>События и настройки напоминаний</small></div>
            <ChevronRight size={18} />
          </button>
          <button type="button" onClick={onOpenTrainerConnections}>
            <span><Mail size={19} /></span>
            <div><strong>Подключения</strong><small>Почта и Telegram для доступа и связи</small></div>
            <ChevronRight size={18} />
          </button>
        </section>

        {onLogout ? <button className="trainerCabinetLogout" type="button" onClick={onLogout}><X size={20} />Выйти из аккаунта</button> : null}
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

function TrainerGlobalSubscriptionNotifications({ settings, onLoad, onSave }) {
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
      <footer className={workspaceFeatureStyles.globalSubscriptionActions}>
        <small>После сохранения новые пороги используются для каждого назначенного тренеру клиента.</small>
        {status ? <span className={status.startsWith("Не удалось") ? workspaceFeatureStyles.error : workspaceFeatureStyles.saved} role="status">{status}</span> : null}
        <button type="button" onClick={saveSettings} disabled={loading || saving}>{loading ? "Загрузка..." : saving ? "Сохраняю..." : "Сохранить"}</button>
      </footer>
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
  onSendMessage
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
                aria-labelledby="trainer-message-reply-title"
              >
                <header className="trainerMessageModalHead">
                  <div>
                    <span>ОТВЕТ КЛИЕНТУ</span>
                    <h3 id="trainer-message-reply-title">{selectedMessage.clientName}</h3>
                    <small>{selectedMessage.title}</small>
                  </div>
                  <button type="button" onClick={() => setMessageReplyOpen(false)} aria-label="Закрыть ответ">
                    <X size={18} />
                  </button>
                </header>
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

export default function TrainerWorkspace({
  appVersion = "",
  mode = "dashboard",
  activeSection = "dashboard",
  onNavigate,
  trainerName,
  trainerAvatar,
  clients = [],
  clientSummaries = {},
  actionCenter = null,
  summariesLoading = false,
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
  exerciseLibrary = [],
  programTemplates = [],
  selectedProgramId = "",
  onSelectProgram,
  onAssignProgram,
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
  onResolveExerciseProgress,
  onRefresh,
  onLogout
}) {
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
  const showSyncOverlay = summariesLoading;

  if (mode === "dashboard") {
    content = (
      <TrainerDashboard
        clients={clients}
        clientSummaries={clientSummaries}
        actionCenter={actionCenter}
        counts={counts}
        onOpenClient={onOpenClient}
        onOpenClients={() => onNavigate("clients")}
        onOpenPrograms={() => onNavigate("workouts")}
        onCreateClient={onCreateClient}
        appVersion={appVersion}
        loading={summariesLoading}
      />
    );
  } else if (mode === "clients") {
    content = <TrainerClientsPage clients={clients} clientSummaries={clientSummaries} onOpenClient={onOpenClient} onCreateClient={onCreateClient} />;
  } else if (mode === "client" && selectedClient) {
    content = (
      <TrainerClientDetail
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
        exerciseLibrary={exerciseLibrary}
        programTemplates={programTemplates}
        selectedProgramId={selectedProgramId}
        onSelectProgram={onSelectProgram}
        onAssignProgram={onAssignProgram}
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

  return (
    <TrainerShell activeSection={activeSection} onNavigate={onNavigate} trainerName={trainerName} trainerAvatar={trainerAvatar} appVersion={appVersion}>
      {content}
      <CreateClientModal state={createClientState} />
      {showSyncOverlay ? (
        <div className="trainerSyncOverlay" role="status" aria-live="polite" aria-label="Идет синхронизация данных">
          <div className="trainerSyncOverlayCard">
            <span className="trainerSyncSpinner" aria-hidden="true" />
            <strong>Идет синхронизация</strong>
            <p>Загружаем данные клиентов и обновляем аналитику.</p>
          </div>
        </div>
      ) : null}
    </TrainerShell>
  );
}
