import { useEffect, useMemo, useState } from "react";
import { analyzeExerciseProgress } from "../../utils/exerciseProgress.js";
import {
  buildPlannedWorkoutSlots,
  buildWorkoutScheduleCalendarEntries,
  toWorkoutDateKey
} from "../../utils/workoutSchedule.js";
import {
  getClientAttentionState,
  getTrainerAttentionDaysSince as getLocalDaysSince
} from "../../utils/trainerAttention.js";
import "./trainer-workspace.css";
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
  Dumbbell,
  EllipsisVertical,
  Eye,
  GripVertical,
  Home,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Search,
  Sparkles,
  StickyNote,
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
  { id: "messages", label: "Сообщения", icon: MessageSquare },
  { id: "nutrition", label: "Питание", icon: Utensils },
  { id: "workouts", label: "Программы", icon: Dumbbell },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "more", label: "Ещё", mobileLabel: "Ещё", icon: MoreHorizontal }
];

const MOBILE_OVERFLOW_ITEMS = [
  { id: "workouts", label: "Программы", icon: Dumbbell },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "more", label: "Кабинет", icon: User }
];

const DESKTOP_NAV_ITEMS = [
  { id: "dashboard", label: "Обзор", icon: Home },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "messages", label: "Сообщения", icon: MessageSquare },
  { id: "workouts", label: "Программы", icon: Dumbbell },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "more", label: "Кабинет", icon: User }
];

const MOBILE_OVERFLOW_IDS = new Set(MOBILE_OVERFLOW_ITEMS.map((item) => item.id));

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
  { id: "workouts", label: "План тренировок" },
  { id: "nutrition", label: "Питание" },
  { id: "bodyProgress", label: "Фото и замеры" },
  { id: "exerciseProgress", label: "Прогресс упражнений" },
  { id: "notifications", label: "Уведомления" },
  { id: "notes", label: "Заметки" }
];

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

const TRAINING_DAY_BY_JS_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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
  return `${value > 0 ? "+" : ""}${roundTrainerNumber(value)}%`;
}

function getExerciseProgressData(history = []) {
  const allExerciseProgress = analyzeExerciseProgress(history);
  const progressing = allExerciseProgress.filter((item) => item.status === "progress").length;
  const stableExercises = allExerciseProgress.filter((item) => item.status === "stable").length;
  const adapting = allExerciseProgress.filter((item) => item.status === "adaptation").length;
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
    regressing,
    latestExerciseProgressDate,
    exerciseProgressInsight
  };
}

function getWorkoutHistoryDate(item = {}) {
  return getWorkspaceDate(item.date || item.completedAt || item.finishedAt || item.createdAt);
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
    <div className="trainerConfirmBackdrop" role="dialog" aria-modal="true" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel?.();
    }}>
      <section className="trainerConfirmDialog">
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
  return <span className={`trainerNextStatus ${statusId}`}>{status.label || fallback[statusId] || "Активен"}</span>;
}

function TrainerNavigation({ activeSection, onNavigate, trainerName, trainerAvatar }) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const desktopItems = DESKTOP_NAV_ITEMS;
  const mobileItems = NAV_ITEMS.filter((item) => ["dashboard", "clients", "messages", "more"].includes(item.id));

  const renderButton = (item, mobile = false) => {
    const Icon = item.icon;
    const active = activeSection === item.id || (mobile && item.id === "more" && MOBILE_OVERFLOW_IDS.has(activeSection));
    return (
      <button
        type="button"
        key={item.id}
        className={active ? "active" : ""}
        onClick={() => {
          if (mobile && item.id === "more") {
            setOverflowOpen(true);
            return;
          }
          onNavigate(item.id);
        }}
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

      {overflowOpen ? (
        <div className="trainerNextMoreBackdrop" role="presentation" onClick={() => setOverflowOpen(false)}>
          <aside className="trainerNextMoreDrawer" role="dialog" aria-modal="true" aria-label="Дополнительные разделы" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>МЕНЮ</span>
                <h2>Ещё</h2>
              </div>
              <button type="button" onClick={() => setOverflowOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <nav>
              {MOBILE_OVERFLOW_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={activeSection === item.id ? "active" : ""}
                    onClick={() => {
                      setOverflowOpen(false);
                      onNavigate(item.id);
                    }}
                  >
                    <span><Icon size={20} />{item.badge ? <i>{item.badge}</i> : null}</span>
                    <strong>{item.label}</strong>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function TrainerShell({ activeSection, onNavigate, trainerName, trainerAvatar, appVersion, children }) {
  return (
    <div className="trainerNextRoot">
      {appVersion ? <div className="trainerNextVersionBadge">{appVersion}</div> : null}
      <TrainerNavigation
        activeSection={activeSection}
        onNavigate={onNavigate}
        trainerName={trainerName}
        trainerAvatar={trainerAvatar}
      />
      <main className="trainerNextMain">{children}</main>
    </div>
  );
}

function DashboardMetric({ label, value, detail, tone, icon: Icon, values }) {
  return (
    <article className="trainerNextMetric">
      <div className="trainerNextMetricHead">
        <span>{label}</span>
        {Icon ? <Icon size={17} strokeWidth={1.7} /> : null}
      </div>
      <strong>{value}</strong>
      <div className={`trainerNextMetricFoot ${tone || ""}`}>
        <small>{detail}</small>
        {values ? <Sparkline tone={tone} values={values} /> : null}
      </div>
    </article>
  );
}

function DashboardClientList({ clients, summaries, filter, search, onOpenClient }) {
  const filteredClients = clients.filter((client) => {
    const item = summaries[client.id] || {};
    const attentionState = getClientAttentionState(client, item);
    const matchesSearch = !search || String(client.name || client.email || "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "active") return !client.archived && !attentionState;
    if (filter === "attention") return !client.archived && Boolean(attentionState);
    return true;
  });

  return (
    <div className="trainerNextClientTable">
      <div className="trainerNextClientTableHead">
        <span>Клиент</span><span>Прогресс</span><span>Тренировки</span><span>Питание</span><span>Активность</span><span>Статус</span>
      </div>
      {filteredClients.map((client) => {
        const summary = summaries[client.id] || {};
        const progress = Number(summary.programCompletionPercent);
        const progressValue = Number.isFinite(progress) ? progress : 0;
        return (
          <button type="button" key={client.id} onClick={() => onOpenClient(client)}>
            <span className="trainerNextClientIdentity">
              <TrainerAvatar client={client} size="small" />
              <span>
                <strong>{client.name || client.email || "Клиент"}</strong>
                <small>{client.goalDescription || client.goal || getAttentionReason(client, summary)}</small>
              </span>
            </span>
            <span className={progressValue < 0 ? "negative" : "positive"}>
              {progressValue > 0 ? "+" : ""}{progressValue}%
              <Sparkline tone={progressValue < 0 ? "red" : "green"} values={[2, 3, 2.8, 4.2, 3.8, 5.4]} />
            </span>
            <span><b>{summary.workouts7 || 0} / 5</b><small>тренировки</small></span>
            <span><b>{summary.nutritionDays7 || 0} / 7</b><small>питание</small></span>
            <span className="trainerNextClientActivity"><b>{formatCompactDate(summary.lastWorkoutAt || summary.lastNutritionAt)}</b><small>последнее</small></span>
            <ClientStatus status={summary.status} />
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

function DashboardAttentionList({ clients, summaries, onOpenClient }) {
  const attentionClients = clients
    .filter((client) => !client.archived)
    .map((client) => {
      const summary = summaries[client.id] || {};
      return { client, summary, attention: getClientAttentionState(client, summary) };
    })
    .filter(({ attention }) => Boolean(attention))
    .slice(0, 5);

  return (
    <section className="trainerAttentionListSection">
      <div className="trainerNextClientsTitle">
        <div>
          <h2>Требуют внимания</h2>
          <p>Клиенты, где есть повод быстро проверить план, питание или активность.</p>
        </div>
      </div>
      <div className="trainerAttentionList">
        {attentionClients.map(({ client, summary, attention }) => (
          <button type="button" key={client.id} onClick={() => onOpenClient(client)}>
            <TrainerAvatar client={client} size="small" />
            <span>
              <strong>{client.name || client.email || "Клиент"}</strong>
              <small>{attention.reason || getAttentionReason(client, summary)}</small>
            </span>
            <ClientStatus status={summary.status} />
          </button>
        ))}
        {!attentionClients.length ? <div className="trainerNextEmpty">Сейчас нет клиентов, требующих внимания.</div> : null}
      </div>
    </section>
  );
}

function TrainerDashboard({
  clients,
  clientSummaries,
  counts,
  onOpenClient,
  onRefresh,
  onNotifications,
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
    ? `за 7 дней у ${clientsWithRecentData || clientCount} ${pluralize(clientsWithRecentData || clientCount, "клиента", "клиентов", "клиентов")}`
    : "нет завершённых за 7 дней";
  const progressValue = progressValues.length ? `${averageProgress > 0 ? "+" : ""}${averageProgress}%` : "—";
  const progressDetail = progressValues.length ? "по назначенным программам" : "нет данных по программам";

  return (
    <div className="trainerNextPage trainerNextDashboard">
      <header className="trainerNextMobileHeader">
        <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
        <h1>Дашборд</h1>
        <div className="trainerNextMobileHeaderActions">
          <button type="button" onClick={onRefresh} aria-label="Обновить страницу"><RefreshCw size={20} /></button>
          <button type="button" onClick={onNotifications} aria-label="Уведомления"><Bell size={22} />{attentionCount > 0 ? <i>{attentionCount}</i> : null}</button>
        </div>
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

      <section className="trainerNextMetrics">
        <DashboardMetric label="Всего клиентов" value={clientCount} detail={clientCount ? `${activeCount} активных` : "клиенты не загружены"} icon={Users} />
        <DashboardMetric label="Активных" value={activeCount} detail={`${activePercent}% от базы`} tone="green" icon={Activity} values={[2, 3, 4, 5, 4, 4.5, 8]} />
        <DashboardMetric label="Тренировок завершено" value={completed} detail={completedDetail} tone="purple" icon={Dumbbell} values={[1, 2, 2, 3, 2.5, 5, 4, 8]} />
        <DashboardMetric label="Средний прогресс" value={progressValue} detail={progressDetail} tone="green" icon={TrendingUp} values={[2, 2, 3.5, 3, 5, 4.3, 7]} />
      </section>

      <DashboardAttentionList clients={clients} summaries={clientSummaries} onOpenClient={onOpenClient} />
    </div>
  );
}

function ProgressChart({ measurements = [] }) {
  const [period, setPeriod] = useState("1w");
  const periods = [
    { id: "1w", label: "1 неделя", days: 7 },
    { id: "1m", label: "1 месяц", days: 30 },
    { id: "3m", label: "3 месяца", days: 90 },
    { id: "6m", label: "6 месяцев", days: 180 }
  ];
  const selectedPeriod = periods.find((item) => item.id === period) || periods[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - selectedPeriod.days);
  startDate.setHours(0, 0, 0, 0);

  const values = measurements
    .map((item) => ({
      item,
      date: getMeasurementDate(item),
      weight: getNumericField(item, ["weight", "values.weight"]),
      muscle: getNumericField(item, ["muscleMass", "muscle", "leanMass", "values.muscleMass", "values.muscle", "values.leanMass"]),
      fat: getNumericField(item, ["fatPercent", "bodyFat", "fat", "values.fatPercent", "values.bodyFat", "values.fat"])
    }))
    .filter((item) => item.date && item.date >= startDate)
    .sort((a, b) => a.date - b.date);

  const series = [
    { id: "weight", label: "Вес (кг)", values: values.map((item) => item.weight), className: "weight" },
    { id: "muscle", label: "Мышечная масса (кг)", values: values.map((item) => item.muscle), className: "muscle" },
    { id: "fat", label: "Жир (%)", values: values.map((item) => item.fat), className: "fat" }
  ].map((item) => ({
    ...item,
    points: item.values.map((value, index) => ({ value, index })).filter((point) => Number.isFinite(point.value))
  })).filter((item) => item.points.length >= 2);

  const getSeriesScale = (points) => {
    const allValues = points.map((point) => point.value);
    return { min: Math.min(...allValues), max: Math.max(...allValues) };
  };
  const getPointCoord = (point, scale) => {
      const x = 42 + point.index * (390 / Math.max(1, values.length - 1));
      const y = 126 - ((point.value - scale.min) / Math.max(1, scale.max - scale.min)) * 95;
      return `${x},${y}`;
  };
  const makePoints = (points) => {
    const scale = getSeriesScale(points);
    return points.map((point) => getPointCoord(point, scale)).join(" ");
  };
  const dateLabels = values.length
    ? [values[0], values[Math.floor(values.length / 2)], values[values.length - 1]]
        .filter(Boolean)
        .map((item) => item.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }))
    : [];

  return (
    <div className="trainerNextProgressChart">
      <div className="trainerNextChartHead">
        <strong>Динамика прогресса</strong>
        <div>{periods.map((item) => <button type="button" className={item.id === period ? "active" : ""} key={item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}</div>
      </div>
      {series.length ? (
        <>
          <svg viewBox="0 0 480 160" role="img" aria-label="Динамика веса, мышечной массы и процента жира">
            {[28, 60, 92, 124].map((y) => <line key={y} x1="40" y1={y} x2="444" y2={y} className="grid" />)}
            {series.map((item) => <polyline key={item.id} points={makePoints(item.points)} className={item.className} />)}
            {series.find((item) => item.id === "weight")?.points.map((point) => {
              const weightSeries = series.find((item) => item.id === "weight");
              const [cx, cy] = getPointCoord(point, getSeriesScale(weightSeries.points)).split(",");
              return <circle key={`w${point.index}`} cx={cx} cy={cy} r="2.5" className="weightDot" />;
            })}
          </svg>
          <div className="trainerNextChartDates">{dateLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
          <div className="trainerNextLegend">{series.map((item) => <span className={item.className} key={item.id}>{item.label}</span>)}</div>
        </>
      ) : (
        <div className="trainerNextChartEmpty">Недостаточно реальных замеров за выбранный период.</div>
      )}
    </div>
  );
}

function ClientOverview({ profile, summary, measurements, history, nutritionDays, photos }) {
  const latest = measurements[0] || {};
  const previous = measurements[1] || {};
  const currentWeight = Number(latest.weight || latest.values?.weight || profile?.weight || 0);
  const previousWeight = Number(previous.weight || previous.values?.weight || currentWeight);
  const weightDelta = currentWeight && previousWeight ? Math.round((currentWeight - previousWeight) * 10) / 10 : 0;
  const hasMeasurementPair = Boolean(measurements[0] && measurements[1] && currentWeight && previousWeight);
  const hasWorkoutData = Boolean(history.length || summary.completedWorkoutCount || summary.assignedWorkoutCount);
  const hasNutritionData = Boolean(nutritionDays.length || summary.nutritionDays7);
  const muscleDelta = Math.max(0, Math.round((summary.workouts30 || 0) * 0.2 * 10) / 10);
  const fatDelta = Math.max(0, Math.round((summary.nutritionDays7 || 0) * 0.2 * 10) / 10);
  const strengthDelta = Number(summary.programCompletionPercent);
  const activity = [
    { icon: Dumbbell, label: "Тренировка", value: formatCompactDate(summary.lastWorkoutAt || history[0]?.date) },
    { icon: Utensils, label: "Питание", value: formatCompactDate(summary.lastNutritionAt || nutritionDays[0]?.date) },
    { icon: Ruler, label: "Замеры", value: formatCompactDate(summary.lastMeasurementAt || latest.date) },
    { icon: Camera, label: "Фото прогресса", value: formatCompactDate(photos[0]?.date || photos[0]?.createdAt) }
  ];

  return (
    <div className="trainerNextClientOverview">
      <ProgressChart measurements={measurements} />
      <div className="trainerNextClientSide">
        <section className="trainerNextResultCard">
          <h3>Результаты за 3 месяца</h3>
          <div><span>Вес</span><strong>{hasMeasurementPair ? `${weightDelta > 0 ? "+" : ""}${weightDelta} кг` : "—"}</strong></div>
          <div><span>Мышечная масса</span><strong>{hasWorkoutData ? `+${muscleDelta} кг` : "—"}</strong></div>
          <div><span>Жир</span><strong className="positive">{hasNutritionData ? `-${fatDelta}%` : "—"}</strong></div>
          <div><span>Силовые показатели</span><strong className="positive">{hasWorkoutData && Number.isFinite(strengthDelta) ? `+${strengthDelta}%` : "—"}</strong></div>
        </section>
        <section className="trainerNextActivityCard">
          <h3>Последняя активность</h3>
          {activity.map(({ icon: Icon, label, value }) => <div key={label}><span><Icon size={16} />{label}</span><time>{value}</time></div>)}
        </section>
      </div>
      <section className="trainerNextRecommendation">
        <h3>Рекомендации</h3>
        <p>{summary.status?.id === "active" ? "Динамика стабильная. Продолжайте текущий план и контролируйте регулярность замеров." : "Проверьте регулярность тренировок и питания, затем скорректируйте нагрузку."}</p>
      </section>
    </div>
  );
}

function ClientMeasurements({ measurements = [] }) {
  const [expanded, setExpanded] = useState(false);
  const sortedMeasurements = (Array.isArray(measurements) ? measurements : [])
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
          {photoViews.map((item) => <button type="button" className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
        </div>
      </div>

      {sortedPhotos.length >= 2 ? (
        <div className="trainerPhotoComparePanel">
          <div>
            <strong>Сравнить фотосессии</strong>
            <p>Выберите две даты и ракурс для крупного сравнения.</p>
          </div>
          <select value={compareIds[0]} onChange={(event) => setCompareIds([event.target.value, compareIds[1]])}>
            <option value="">Первая дата</option>
            {sortedPhotos.map((photo, index) => <option value={getPhotoId(photo, index)} key={`a-${getPhotoId(photo, index)}`}>{formatCompactDate(photo.date || photo.createdAt)}</option>)}
          </select>
          <select value={compareIds[1]} onChange={(event) => setCompareIds([compareIds[0], event.target.value])}>
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
        <div className="trainerClientModalBackdrop" role="dialog" aria-modal="true" onClick={() => setOpenPhotoId("")}>
          <section className="trainerPhotoPreviewModal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>ФОТО КЛИЕНТА</span><h2>{formatCompactDate(activePhoto.date || activePhoto.createdAt)}</h2></div>
              <button type="button" onClick={() => setOpenPhotoId("")} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <div className="trainerPhotoViewTabs">
              {photoViews.map((item) => <button type="button" className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
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

function ClientNotes({ note, tasks }) {
  return (
    <section className="trainerNextSimplePanel">
      <div className="trainerNextPanelTitle"><div><h2>Заметки</h2><p>Рабочая информация тренера по клиенту</p></div></div>
      <div className="trainerNextNoteCard">
        <StickyNote size={21} />
        <p>{note || "Заметка тренера пока не добавлена."}</p>
      </div>
      <div className="trainerNextHistoryList">
        {tasks.map((task, index) => <article key={task.id || index}><span><ClipboardList size={18} /></span><div><strong>{task.title || task.text || "Задача"}</strong><small>{formatCompactDate(task.createdAt || task.date)}</small></div></article>)}
      </div>
    </section>
  );
}

function WorkoutActivityCalendar({ client, history = [], workouts = [] }) {
  const calendar = client?.workoutCalendar || {};
  const explicitDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(calendar.monthlyTrainingDates)
      ? calendar.monthlyTrainingDates
      : [];
  const firstUpcomingDate = explicitDates.find((date) => String(date) >= getLocalDateKey());
  const [monthKey, setMonthKey] = useState((firstUpcomingDate || getLocalDateKey()).slice(0, 7));
  const monthDays = getCalendarMonthDays(monthKey);
  const explicitScheduled = new Set(explicitDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date))));
  const trainingDays = Array.isArray(calendar.trainingDays) && calendar.trainingDays.length
    ? calendar.trainingDays
    : Array.isArray(client?.trainingDays)
      ? client.trainingDays
      : [];
  const trainingDaySet = new Set(trainingDays);
  const completedDates = new Set(
    history
      .map((item) => getWorkoutHistoryDate(item))
      .filter(Boolean)
      .map((date) => getLocalDateKey(date))
  );
  const missedDates = new Set();
  const workoutScheduledDates = new Set();

  workouts.forEach((workout) => {
    const status = workout.status || "planned";
    [workout.scheduledDate, workout.plannedDate, workout.date, workout.movedToDate].forEach((value) => {
      const date = getWorkspaceDate(value);
      if (!date) return;
      const key = getLocalDateKey(date);
      workoutScheduledDates.add(key);
      if (["missed", "not_completed"].includes(status)) missedDates.add(key);
      if (status === "completed") completedDates.add(key);
    });
  });

  function shiftMonth(delta) {
    const [year, month] = monthKey.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setMonthKey(getLocalDateKey(next).slice(0, 7));
  }

  function isScheduled(day) {
    if (explicitScheduled.has(day.key) || workoutScheduledDates.has(day.key)) return true;
    if (explicitScheduled.size || workoutScheduledDates.size || !trainingDaySet.size) return false;
    const date = getWorkspaceDate(day.key);
    return date ? trainingDaySet.has(TRAINING_DAY_BY_JS_DAY[date.getDay()]) : false;
  }

  const monthCompleted = monthDays.filter((day) => day.currentMonth && completedDates.has(day.key)).length;
  const monthScheduled = monthDays.filter((day) => day.currentMonth && isScheduled(day)).length;
  const todayKey = getLocalDateKey();

  return (
    <section className="trainerClientAnalyticsCard trainerClientWorkoutCalendar">
      <header>
        <div><span>АКТИВНОСТЬ</span><h3>Календарь тренировок</h3></div>
        <div className="trainerWorkoutMonthControls">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronUp size={15} /></button>
          <strong>{new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronDown size={15} /></button>
        </div>
      </header>
      <div className="trainerWorkoutMonthStats">
        <span><b>{monthScheduled}</b><small>в плане</small></span>
        <span><b>{monthCompleted}</b><small>выполнено</small></span>
        <span><b>{history.length}</b><small>всего</small></span>
      </div>
      <div className="trainerWorkoutMonthWeekdays" aria-hidden="true">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="trainerWorkoutMonthGrid" aria-label="Календарь активности тренировок за месяц">
        {monthDays.map((day) => {
          const scheduled = isScheduled(day);
          const completed = completedDates.has(day.key);
          const missed = missedDates.has(day.key);
          const className = [
            day.currentMonth ? "" : "muted",
            day.key === todayKey ? "today" : "",
            scheduled ? "scheduled" : "",
            completed ? "completed" : "",
            missed ? "missed" : ""
          ].filter(Boolean).join(" ");
          return (
            <span className={className} key={day.key} title={day.key}>
              <b>{day.label}</b>
              {(scheduled || completed || missed) ? <i /> : null}
            </span>
          );
        })}
      </div>
      <div className="trainerWorkoutMonthLegend">
        <span><i className="scheduled" />Запланировано</span>
        <span><i className="completed" />Выполнено</span>
        <span><i className="missed" />Пропущено</span>
      </div>
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
    .map((entry) => `№${entry.order} ${WORKOUT_SCHEDULE_DAY_STATUS_TEXT[entry.status] || ""}`.trim())
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
        title: `Тренировка №${index + 1}`
      }];
    return result;
  }, {});
  const visibleEntriesByDate = editing ? draftEntriesByDate : savedEntriesByDate;

  useEffect(() => {
    const nextDates = getWorkoutScheduleInitialDates(client, workouts);
    setSelectedDates(nextDates);
    setMonthKey((nextDates[0] || getLocalDateKey()).slice(0, 7));
    setEditing(false);
  }, [
    client?.id,
    client?.workoutCalendar?.updatedAt,
    client?.workoutCalendar?.assignedProgramUpdatedAt,
    workouts.length
  ]);

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
          <p>Выберите ровно {requiredCount || 0} {pluralize(requiredCount, "дату", "даты", "дат")} под назначенную программу. Порядок дат становится порядком тренировок №1, №2 и дальше.</p>
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
              const entryLabel = entries.map((entry) => `№${entry.order}`).join(", ");
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
                  {entries.length ? <i>{entryLabel}</i> : selected ? <i>№{selectedOrder[day.key]}</i> : null}
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

function ProgramWorkoutActivityCalendar({ client, history = [], workouts = [] }) {
  const calendar = client?.workoutCalendar || {};
  const slots = buildPlannedWorkoutSlots({ workouts, calendar, history });
  const entries = buildWorkoutScheduleCalendarEntries(slots);
  const firstUpcomingDate = entries.map((entry) => entry.date).filter((date) => date >= getLocalDateKey()).sort()[0];
  const [monthKey, setMonthKey] = useState((firstUpcomingDate || getLocalDateKey()).slice(0, 7));
  const monthDays = getCalendarMonthDays(monthKey);
  const entriesByDate = entries.reduce((result, entry) => {
    if (!result[entry.date]) result[entry.date] = [];
    result[entry.date].push(entry);
    return result;
  }, {});
  const todayKey = getLocalDateKey();

  useEffect(() => {
    if (firstUpcomingDate) setMonthKey(firstUpcomingDate.slice(0, 7));
  }, [client?.id, calendar?.updatedAt, firstUpcomingDate]);

  function shiftMonth(delta) {
    const [year, month] = monthKey.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setMonthKey(getLocalDateKey(next).slice(0, 7));
  }

  const monthEntries = monthDays.flatMap((day) => entriesByDate[day.key] || []).filter((entry) => {
    const date = getWorkspaceDate(entry.date);
    return date && date.getMonth() === Number(monthKey.slice(5, 7)) - 1;
  });
  const monthScheduled = monthEntries.filter((entry) => ["planned", "completed", "completed_off_date", "missed"].includes(entry.status)).length;
  const monthCompleted = monthEntries.filter((entry) => ["completed", "completed_off_date"].includes(entry.status)).length;
  const monthShifted = monthEntries.filter((entry) => entry.status === "shifted").length;

  return (
    <section className="trainerClientAnalyticsCard trainerClientWorkoutCalendar">
      <header>
        <div><span>АКТИВНОСТЬ</span><h3>Календарь тренировок</h3></div>
        <div className="trainerWorkoutMonthControls">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronUp size={15} /></button>
          <strong>{new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronDown size={15} /></button>
        </div>
      </header>
      <div className="trainerWorkoutMonthStats">
        <span><b>{monthScheduled}</b><small>в плане</small></span>
        <span><b>{monthCompleted}</b><small>выполнено</small></span>
        <span><b>{monthShifted}</b><small>смещено</small></span>
      </div>
      <div className="trainerWorkoutMonthWeekdays" aria-hidden="true">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="trainerWorkoutMonthGrid" aria-label="Календарь активности тренировок за месяц">
        {monthDays.map((day) => {
          const dayEntries = entriesByDate[day.key] || [];
          const hasCompleted = dayEntries.some((entry) => entry.status === "completed");
          const hasCompletedOffDate = dayEntries.some((entry) => entry.status === "completed_off_date");
          const hasMissed = dayEntries.some((entry) => entry.status === "missed");
          const hasShifted = dayEntries.some((entry) => entry.status === "shifted");
          const hasPlanned = dayEntries.some((entry) => entry.status === "planned");
          const className = [
            day.currentMonth ? "" : "muted",
            day.key === todayKey ? "today" : "",
            hasPlanned ? "scheduled" : "",
            hasCompleted ? "completed" : "",
            hasCompletedOffDate ? "completedOffDate" : "",
            hasMissed ? "missed" : "",
            hasShifted ? "shifted" : ""
          ].filter(Boolean).join(" ");
          return (
            <span className={className} key={day.key} title={dayEntries.map((entry) => entry.title).join(", ") || day.key}>
              <b>{day.label}</b>
              {dayEntries.length ? (
                <i>
                  {dayEntries.slice(0, 2).map((entry) => (
                    <em key={entry.id}>№{entry.order}{["completed", "completed_off_date"].includes(entry.status) ? " ✓" : ""}</em>
                  ))}
                </i>
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="trainerWorkoutMonthLegend">
        <span><i className="scheduled" />План</span>
        <span><i className="completed" />Выполнено в срок</span>
        <span><i className="completedOffDate" />В другой день</span>
        <span><i className="missed" />Пропущено</span>
        <span><i className="shifted" />Смещено дальше</span>
      </div>
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
  editorProps
}) {
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!editorOpen || typeof document === "undefined") return undefined;

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
  }, [editorOpen]);

  const recentStart = new Date();
  recentStart.setDate(recentStart.getDate() - 30);
  const workouts30 = history.filter((item) => {
    const date = getWorkoutHistoryDate(item);
    return date && date >= recentStart;
  }).length;
  const { progressing, adapting, regressing } = getExerciseProgressData(history);
  const feedback = history.reduce((result, item) => {
    const feedbackId = String(item.postWorkoutFeedback?.id || item.readiness?.id || "").toLowerCase();
    if (["bad", "hard", "low"].includes(feedbackId)) result.hard += 1;
    else if (feedbackId) result.good += 1;
    return result;
  }, { good: 0, hard: 0 });
  const completedWorkoutKeys = getTrainerCompletedWorkoutKeys(history);
  const workoutResults = workouts.map((workout) => {
    const completed = isTrainerWorkoutCompleted(workout, completedWorkoutKeys);
    const status = completed ? "completed" : (workout.status || "planned");
    return { workout, completed, status };
  });
  const completedWorkoutCount = workoutResults.filter((item) => item.completed).length;
  const completion = workouts.length
    ? Math.round(completedWorkoutCount / workouts.length * 100)
    : 0;
  const manualStatusCounts = workoutResults.reduce((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {});
  const skippedWorkouts = (manualStatusCounts.not_completed || 0) + (manualStatusCounts.missed || 0);
  const completionTone = skippedWorkouts > completedWorkoutCount && skippedWorkouts > 0
    ? "negative"
    : completion >= 80
      ? "positive"
      : completion > 0
        ? "warning"
        : "";
  const trainingQualityText = (() => {
    if (!workouts.length) {
      return "Программа ещё не назначена. Назначьте план, чтобы увидеть динамику выполнения.";
    }
    if (!history.length && !completedWorkoutCount && !skippedWorkouts) {
      return "Пока нет завершённых тренировок. После первых отметок появится оценка выполнения и прогресса.";
    }
    if (regressing > progressing) {
      return "Есть признаки возможного регресса: проверьте восстановление, технику и соответствие нагрузки текущей цели.";
    }
    if (skippedWorkouts > completedWorkoutCount && skippedWorkouts > 0) {
      return "Пропусков больше, чем выполненных тренировок. Стоит упростить расписание или скорректировать нагрузку.";
    }
    if (completion >= 80 && progressing > 0) {
      return "Программа выполняется хорошо, при этом силовые показатели растут. Можно продолжать текущую логику нагрузки.";
    }
    if (completion >= 50 && adapting > 0) {
      return "Тренировки идут, но часть показателей относится к адаптации программы. Сравнивайте их после ещё одной похожей тренировки.";
    }
    if (progressing > 0) {
      return "У клиента растёт расчётная сила или тренировочный объём. Изменения программы анализируются отдельно.";
    }
    if (feedback.hard > feedback.good) {
      return "Тренировки часто оцениваются как тяжёлые. Проверьте восстановление и при необходимости снизьте объём.";
    }
    if (completion > 0) {
      return "Тренировки выполняются, выраженной силовой динамики пока нет. Нужны ещё сопоставимые записи по упражнениям.";
    }
    return "Для уверенной оценки нужны минимум две заполненные тренировки по одному упражнению.";
  })();
  const assignedName = client?.assignedProgramName || (workouts.length ? "Индивидуальная программа" : "Программа не назначена");
  const selectedTemplate = programTemplates.find((program) => program.id === selectedProgramId);

  return (
    <div className="trainerClientWorkoutPlan">
      <section className="trainerClientAssignment trainerClientProgramSummary">
        <div className="trainerClientProgramSummaryTop">
          <div className="trainerClientBlockHeading">
            <span><ClipboardList size={19} /></span>
            <div>
              <h2>Программа тренировок клиента</h2>
              <p>Текущая назначенная программа, быстрые показатели и назначение новой программы в одном блоке.</p>
            </div>
          </div>
        </div>

        <div className="trainerClientProgramCurrent">
          <div className="trainerClientAssignedIcon"><Dumbbell size={25} /></div>
          <div className="trainerClientAssignedInfo">
            <span>НАЗНАЧЕННАЯ ПРОГРАММА</span>
            <h2>{assignedName}</h2>
            <p>{workouts.length} {pluralize(workouts.length, "тренировка", "тренировки", "тренировок")} · выполнено {completion}%</p>
          </div>
          <div className="trainerClientAssignedStats">
            <span><b>{summary.workouts7 || 0}</b><small>за 7 дней</small></span>
            <span><b>{workouts30}</b><small>за 30 дней</small></span>
            <span><b>{formatCompactDate(summary.lastWorkoutAt || history[0]?.date)}</b><small>последняя</small></span>
          </div>
        </div>

        <div className="trainerClientAssignmentControls">
          <label className="trainerClientProgramSelectLabel">
            <span>Назначить новую или отредактировать программу</span>
            <div className="trainerClientProgramSelectField">
              <select value={selectedProgramId || ""} onChange={(event) => onSelectProgram(event.target.value)}>
                <option value="">Выберите программу</option>
                {programTemplates.map((program) => <option value={program.id} key={program.id}>{program.name || "Без названия"}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </label>
          <div className="trainerClientProgramActionStack">
            <button type="button" disabled={!selectedProgramId || !client} onClick={onAssignProgram}>
              <Check size={17} />Назначить
            </button>
            <button className="trainerClientProgramEditButton" type="button" onClick={() => setEditorOpen(true)} disabled={!workouts.length}>
              Редактировать<ChevronRight size={17} />
            </button>
          </div>
        </div>
        {selectedTemplate ? <small className="trainerClientSelectionHint">Будет назначена программа «{selectedTemplate.name || "Без названия"}».</small> : null}
        {programStatus ? <p className="trainerNextProgramStatus">{programStatus}</p> : null}
      </section>

      <WorkoutSchedulePlanner
        client={client}
        workouts={workouts}
        history={history}
        onSaveSchedule={onSaveWorkoutSchedule}
        status={programStatus}
      />

      <div className="trainerClientWorkoutAnalytics trainerClientWorkoutAnalyticsSingle">
        <section className="trainerClientAnalyticsCard trainerClientTrainingQuality">
          <header><div><span>ДИНАМИКА</span><h3>Как проходят тренировки</h3></div><Activity size={20} /></header>
          <div className="trainerClientQualityMetrics">
            <article><strong className={completionTone}>{completion}%</strong><span>выполнено по программе</span></article>
            <article><strong className="positive">{progressing}</strong><span>упражнений с прогрессом</span></article>
            <article><strong className={adapting ? "warning" : ""}>{adapting}</strong><span>адаптаций программы</span></article>
            <article><strong className={regressing ? "negative" : ""}>{regressing}</strong><span>возможных регрессов</span></article>
          </div>
          <div className="trainerWorkoutStatusSummary">
            {WORKOUT_STATUS_OPTIONS.map((status) => (
              <span key={status.id}>{status.icon} {status.label}: <b>{manualStatusCounts[status.id] || 0}</b></span>
            ))}
          </div>
          <p>{trainingQualityText}</p>
        </section>
      </div>

      {editorOpen ? (
        <div className="trainerClientModalBackdrop trainerWorkoutEditorModalBackdrop" role="dialog" aria-modal="true" onClick={() => setEditorOpen(false)}>
          <section className="trainerWorkoutEditorModal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>РЕДАКТОР ПРОГРАММЫ</span>
                <h2>{assignedName}</h2>
                <p>Изменения применяются к текущему плану клиента.</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="Закрыть редактор"><X size={18} /></button>
            </header>
            <div className="trainerWorkoutEditorModalBody">
              <TrainerWorkoutEditor embedded showProgramControl={false} client={client} history={history} workouts={workouts} {...editorProps} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ClientExerciseProgress({ history = [] }) {
  const [filter, setFilter] = useState("priority");
  const {
    allExerciseProgress,
    progressing,
    stableExercises,
    adapting,
    regressing,
    latestExerciseProgressDate,
    exerciseProgressInsight
  } = getExerciseProgressData(history);
  const priorityProgress = allExerciseProgress.filter((item) => ["regression", "adaptation"].includes(item.status));
  const exerciseProgressFilters = [
    {
      id: "priority",
      label: "Важное",
      count: priorityProgress.length || allExerciseProgress.length
    },
    { id: "progress", label: "Прогресс", count: progressing },
    { id: "regression", label: "Проверить", count: regressing },
    { id: "all", label: "Все", count: allExerciseProgress.length }
  ];
  const displayedExerciseProgress = (() => {
    if (filter === "progress") return allExerciseProgress.filter((item) => item.status === "progress").slice(0, 8);
    if (filter === "regression") return allExerciseProgress.filter((item) => item.status === "regression").slice(0, 8);
    if (filter === "all") return allExerciseProgress.slice(0, 12);
    return (priorityProgress.length ? priorityProgress : allExerciseProgress).slice(0, 8);
  })();
  const focusText = (() => {
    if (!allExerciseProgress.length) return "Появится после двух заполненных тренировок по одному упражнению.";
    if (filter === "progress") return "Здесь видны упражнения, где клиент реально прибавляет по силе, объёму или повторам.";
    if (filter === "regression") return "Это список для проверки: нагрузка могла просесть из-за восстановления, техники или смены условий.";
    if (filter === "all") return "Полный список анализируемых упражнений с последним сравнением.";
    return priorityProgress.length
      ? "Сначала показаны упражнения, где тренеру стоит принять решение: проверить регресс или дождаться адаптации."
      : "Критичных мест нет, поэтому показаны самые свежие сопоставимые упражнения.";
  })();

  return (
    <section className="trainerNextSimplePanel trainerClientAnalyticsCard trainerClientExerciseProgress">
      <header><div><span>СИЛОВЫЕ ПОКАЗАТЕЛИ</span><h3>Прогресс по упражнениям</h3></div><TrendingUp size={20} /></header>
      <div className="trainerExerciseProgressSummary">
        <article>
          <span>Анализируется</span>
          <strong>{allExerciseProgress.length}</strong>
          <small>упражнений с 2+ записями</small>
        </article>
        <article>
          <span>Прогресс</span>
          <strong className="positive">{progressing}</strong>
          <small>растёт сила, объём или повторы</small>
        </article>
        <article>
          <span>Стабильно</span>
          <strong>{stableExercises}</strong>
          <small>без резких изменений</small>
        </article>
        <article>
          <span>Проверить</span>
          <strong className={regressing ? "negative" : ""}>{regressing}</strong>
          <small>возможный регресс</small>
        </article>
      </div>
      <p className="trainerExerciseProgressInsight">{exerciseProgressInsight}</p>
      <div className="trainerExerciseProgressToolbar" aria-label="Фильтры прогресса упражнений">
        {exerciseProgressFilters.map((item) => (
          <button type="button" className={filter === item.id ? "active" : ""} key={item.id} onClick={() => setFilter(item.id)}>
            {item.label}<span>{item.count}</span>
          </button>
        ))}
      </div>
      <p className="trainerExerciseProgressFocus">{focusText}</p>
      <div className="trainerExerciseProgressList">
        {displayedExerciseProgress.map((item) => (
          <article className={`trainerExerciseProgressRow ${item.status}`} key={item.name}>
            <div className="trainerExerciseProgressName">
              <b className={`trainerExerciseStatus ${item.tone}`}>{item.label}</b>
              <strong>{item.name}</strong>
              <small>{formatCompactDate(item.previous.date)} → {formatCompactDate(item.current.date)}</small>
            </div>
            <div className="trainerExerciseProgressMetrics">
              <span>
                <small>e1RM</small>
                <b>{item.current.e1rm || "—"} кг</b>
                <em className={getDeltaTone(item.changes?.e1rmPct)}>{formatPercentChange(item.changes?.e1rmPct)}</em>
              </span>
              <span>
                <small>Объём</small>
                <b>{item.current.volume || "—"} кг</b>
                <em className={getDeltaTone(item.changes?.volumePct)}>{formatPercentChange(item.changes?.volumePct)}</em>
              </span>
              <span>
                <small>Повторы</small>
                <b>{item.current.totalReps || "—"}</b>
                <em className={getDeltaTone(item.changes?.reps)}>{formatSignedDelta(item.changes?.reps)}</em>
              </span>
            </div>
            <div className="trainerExerciseProgressResult">
              <strong>
                {item.previous.bestWeight || "—"} кг × {item.previous.averageReps} × {item.previous.sets}
                {" → "}
                {item.current.bestWeight || "—"} кг × {item.current.averageReps} × {item.current.sets}
              </strong>
              <small>{item.explanation}</small>
            </div>
          </article>
        ))}
        {!displayedExerciseProgress.length ? <div className="trainerNextEmpty">По выбранному фильтру пока нет упражнений.</div> : null}
      </div>
      {latestExerciseProgressDate ? <small className="trainerExerciseProgressUpdated">Последнее обновление: {formatCompactDate(latestExerciseProgressDate)}</small> : null}
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
            <button type="button" className={period === value ? "active" : ""} key={value} onClick={() => setPeriod(value)}>
              {value} дней
            </button>
          ))}
          <button type="button" className={period === "custom" ? "active" : ""} onClick={() => setPeriod("custom")}>Период</button>
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
            <button type="button" className={activeDay === index ? "active" : ""} key={item.date || index} onClick={() => setActiveDay(index)}>
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
  const [editing, setEditing] = useState(!currentPlan);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState(buildDraft().presetId);
  const [draft, setDraft] = useState(buildDraft);
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

  useEffect(() => {
    const nextDraft = buildDraft();
    const nextPreset = presetMap[nextDraft.presetId] ? nextDraft.presetId : "custom";
    setDraft({
      ...nextDraft,
      presetId: nextPreset
    });
    setPreset(nextPreset);
    setEditing(!currentPlan);
  }, [
    client?.id,
    currentPlan?.updatedAt,
    currentPlan?.name,
    currentPlan?.goal,
    currentPlan?.calories,
    currentPlan?.protein,
    currentPlan?.fat,
    currentPlan?.carbs,
    currentPlan?.validFrom,
    currentPlan?.validTo,
    currentPlan?.presetId,
    currentPlan?.preset,
    goals.calories,
    goals.protein,
    goals.fat,
    goals.carbs
  ]);

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
            <select value={preset} onChange={(event) => selectPreset(event.target.value)}>
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
        <NutritionPlan key={client?.id || "nutrition-plan"} client={client} goals={goals} planOptions={planOptions} onSavePlan={onSavePlan} onGeneratePlan={onGeneratePlan} status={status} />
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
        <h1>Питание и дневник</h1>
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

      <section className="trainerNotificationSettings">
        <header>
          <div><span>УВЕДОМЛЕНИЯ</span><h2>Напоминания</h2><p>Настройте автоматические уведомления для клиента.</p></div>
          <label className="trainerNotificationSwitch compact" aria-label="Включить уведомления">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
            <i />
          </label>
        </header>

        <div className="trainerReminderCard">
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

        <div className="trainerReminderCard">
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
                  key={days}
                  onClick={() => setDraft((current) => ({ ...current, photoIntervalDays: days }))}
                >
                  Каждые {days} дней
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="trainerReminderCard">
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
                  key={days}
                  onClick={() => setDraft((current) => ({ ...current, measurementsIntervalDays: days }))}
                >
                  Каждые {days} дней
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="trainerNotificationCalendar">
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

        <div className="trainerNotificationActions">
          <button className="trainerNextPrimary" type="button" disabled={saving || !draft.offsets.length} onClick={saveSettings}><Save size={17} />{saving ? "Сохранение..." : "Сохранить настройки"}</button>
          <button type="button" disabled={!connected || testing} onClick={testNotification}><Mail size={17} />{testing ? "Отправка..." : "Отправить тестовое уведомление"}</button>
        </div>
        {!draft.offsets.length ? <p className="trainerNotificationHint">Выберите хотя бы один интервал напоминания.</p> : null}
        {status ? <p className="trainerNextProgramStatus">{status}</p> : null}
      </section>
    </div>
  );
}

function TrainerClientDetail({
  client,
  profile,
  summary,
  activeTab,
  onTabChange,
  onBack,
  measurements,
  history,
  nutritionDays,
  nutritionGoals,
  nutritionPlanOptions,
  photos,
  tasks,
  note,
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
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onAddExercise,
  onRemoveExercise,
  onDuplicateExercise,
  onMoveExercise,
  onUploadExerciseVideo,
  exerciseVideoUploadingId,
  onAddDay,
  onDuplicateDay,
  onRemoveDay,
  onSaveWorkouts,
  onSaveNotifications,
  onTestNotification,
  onConnectTelegram,
  onSendMessage,
  onClientAction
}) {
  const name = client.name || client.email || "Клиент";
  const profileFacts = [
    profile?.age ? `${profile.age} лет` : "",
    profile?.height ? `${profile.height} см` : "",
    profile?.weight ? `${profile.weight} кг` : ""
  ].filter(Boolean);
  const profileMetaText = profileFacts.length ? profileFacts.join(" · ") : "Данные профиля не заполнены";
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const clientActions = [
    client.archived
      ? { id: "restore", label: "Восстановить клиента", icon: "♻️" }
      : { id: "archive", label: "Архивировать клиента", icon: "📦" },
    { id: "duplicate", label: "Дублировать клиента", icon: "📋" },
    { id: "reset_progress", label: "Сбросить прогресс", icon: "🔄" },
    { id: "export_excel", label: "Экспорт Excel", icon: "📊" },
    { id: "export_pdf", label: "Экспорт PDF", icon: "📄" },
    { id: "disable_notifications", label: "Отключить уведомления", icon: "🔕" },
    { id: "delete", label: "Удалить клиента", icon: "🗑", danger: true }
  ];

  async function submitMessage() {
    const text = messageText.trim();
    if (!text) return;
    setMessageSending(true);
    const sent = await onSendMessage?.(text, client);
    setMessageSending(false);
    if (sent !== false) {
      setMessageText("");
      setMessageOpen(false);
    }
  }

  async function runClientAction(actionId) {
    setActionsOpen(false);
    await onClientAction?.(actionId, client);
  }
  return (
    <div className="trainerNextPage trainerNextClientPage">
      <div className="trainerNextClientBackRow">
        <button type="button" onClick={onBack}><ArrowLeft size={20} /><span>Назад к списку</span></button>
        <div>
          <button className="trainerNextPrimary" type="button" onClick={() => setMessageOpen(true)}><Mail size={16} />Написать</button>
          <button type="button" onClick={() => setActionsOpen(true)}>Действия <ChevronDown size={16} /></button>
        </div>
      </div>

      <header className="trainerNextClientHeader">
        <TrainerAvatar client={client} size="large" />
        <div>
          <div className="trainerNextClientName"><h1>{name}</h1><span>Активен</span></div>
          <p>{profileMetaText}</p>
          <strong>Цель: {client.goalDescription || profile?.goalLabel || "Персональный результат"}</strong>
        </div>
        <button className="trainerNextMobileMore" type="button" aria-label="Действия" onClick={() => setActionsOpen(true)}><MoreHorizontal size={22} /></button>
      </header>

      <nav className="trainerNextClientTabs">
        {CLIENT_TABS.map((tab) => {
          const active = activeTab === tab.id || (tab.id === "bodyProgress" && ["measurements", "photos"].includes(activeTab));
          return <button type="button" key={tab.id} className={active ? "active" : ""} onClick={() => onTabChange(tab.id)}>{tab.label}</button>;
        })}
      </nav>

      {activeTab === "overview" ? <ClientOverview client={client} profile={profile} summary={summary} measurements={measurements} history={history} nutritionDays={nutritionDays} photos={photos} /> : null}
      {activeTab === "workouts" ? (
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
            onUpdateExerciseSet,
            onAddExerciseSet,
            onRemoveExerciseSet,
            onAddExercise,
            onRemoveExercise,
            onDuplicateExercise,
            onMoveExercise,
            onUploadExerciseVideo,
            exerciseVideoUploadingId,
            onAddDay,
            onDuplicateDay,
            onRemoveDay,
            onSave: onSaveWorkouts
          }}
        />
      ) : null}
      {activeTab === "nutrition" ? <NutritionView client={client} nutritionDays={nutritionDays} goals={nutritionGoals} planOptions={nutritionPlanOptions} onGeneratePlan={onGeneratePlan} onSavePlan={onSaveNutritionPlan} status={programStatus} /> : null}
      {["bodyProgress", "measurements", "photos"].includes(activeTab) ? <ClientBodyProgress measurements={measurements} photos={photos} /> : null}
      {activeTab === "notifications" ? <ClientNotifications key={client.id} client={client} workouts={workouts} measurements={measurements} photos={photos} status={programStatus} onSave={onSaveNotifications} onTest={onTestNotification} onConnectTelegram={onConnectTelegram} /> : null}
      {activeTab === "exerciseProgress" ? <ClientExerciseProgress history={history} /> : null}
      {activeTab === "notes" ? <ClientNotes note={note} tasks={tasks} /> : null}

      {messageOpen ? (
        <div className="trainerClientModalBackdrop" role="dialog" aria-modal="true">
          <section className="trainerClientMessageModal">
            <header>
              <div><span>СООБЩЕНИЕ КЛИЕНТУ</span><h2>{name}</h2></div>
              <button type="button" onClick={() => setMessageOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Напишите сообщение клиенту..." />
            <footer>
              <button type="button" onClick={() => setMessageOpen(false)}>Отмена</button>
              <button className="trainerNextPrimary" type="button" disabled={messageSending || !messageText.trim()} onClick={submitMessage}>
                <Mail size={16} />{messageSending ? "Отправка..." : "Отправить"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {actionsOpen ? (
        <div className="trainerClientModalBackdrop" role="dialog" aria-modal="true">
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
  const summaries = clientSummaries;
  return (
    <div className="trainerNextPage trainerNextClientsPage">
      <div className="trainerNextDesktopPageHead">
        <div><h1>Клиенты</h1><p>{clients.length} {pluralize(clients.length, "клиент", "клиента", "клиентов")} в работе</p></div>
        <button className="trainerNextPrimary" type="button" onClick={onCreateClient}><Plus size={18} />Добавить клиента</button>
      </div>
      <header className="trainerNextMobileHeader"><span className="trainerNextMobileHeaderSpacer" aria-hidden="true" /><h1>Клиенты</h1><button type="button" onClick={onCreateClient}><Plus size={22} /></button></header>
      <div className="trainerNextClientsStandalone">
        <label className="trainerNextSearch open"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск клиента..." /></label>
        <DashboardClientList clients={clients} summaries={summaries} filter="all" search={search} onOpenClient={onOpenClient} />
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

export function TrainerProgramConstructor({
  program,
  months = [],
  activeWorkoutId,
  onSelectWorkout,
  onProgramNameChange,
  onSaveProgram,
  onDeleteProgram,
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
  onDuplicateExercise,
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
          <button className="danger" type="button" onClick={onDeleteProgram}>
            <Trash2 size={17} />Удалить
          </button>
          <button className="primary" type="button" onClick={() => onSaveProgram()}>
            <Save size={17} />Сохранить
          </button>
        </div>
      </header>

      <div className="trainerProgramConstructorGrid">
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

        <section className="trainerProgramDayPanel">
          {activeContext ? (
            <>
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
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onAddExercise,
  onRemoveExercise,
  onDuplicateExercise,
  onMoveExercise,
  onUploadExerciseVideo,
  exerciseVideoUploadingId,
  onAddDay,
  onDuplicateDay,
  onRemoveDay,
  onSave
}) {
  const tab = activeWorkoutTab || "plan";
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(workouts[0]?.id || "");
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
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
    [...(exerciseLibrary || []), ...workouts.flatMap((workout) => workout.exercises || [])].forEach((exercise) => {
      const key = String(exercise.name || "").trim().toLowerCase();
      if (!key) return;
      const current = map.get(key);
      if (!current || (!getExerciseVideo(current) && getExerciseVideo(exercise))) {
        map.set(key, exercise);
      }
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
        <h1>{tab === "library" ? "Библиотека" : "План тренировок"}</h1>
        {tab === "plan" ? <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Предпросмотр"><Eye size={21} /></button> : <span />}
      </header> : null}
      {!embedded ? <div className="trainerNextPageTabs">
        <button type="button" onClick={onOpenProgramManager}>Программы</button>
        <button type="button" className={tab === "library" ? "active" : ""} onClick={() => onWorkoutTabChange("library")}>Библиотека упражнений</button>
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
            <select value={selectedProgramId || ""} onChange={(event) => onSelectProgram(event.target.value)}>
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
                  <button type="button" className="trainerNextWorkoutDaySelect" onClick={() => setSelectedWorkoutId(workout.id)}>
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
            <label className="trainerNextSearch open"><Search size={17} /><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Найти упражнение..." /></label>
          </div>
          <div>
            {filteredLibrary.map((exercise, index) => {
              const video = getExerciseVideo(exercise);
              return (
                <article key={`${exercise.id || exercise.name}_${index}`}>
                  <span className="trainerNextExerciseImage">
                    {video ? <video src={video} muted preload="metadata" aria-hidden="true" /> : <Dumbbell size={22} />}
                  </span>
                  <div><strong>{exercise.name}</strong><small>{exercise.sets?.length || 0} подх. · {video ? "с видео" : "без видео"}</small></div>
                  <button type="button" disabled={!selectedWorkout} onClick={() => selectedWorkout && onAddExercise(selectedWorkout.id, exercise)}><Plus size={16} />Добавить</button>
                </article>
              );
            })}
            {!filteredLibrary.length ? <div className="trainerNextEmpty">Упражнения не найдены.</div> : null}
          </div>
        </section>
      )}

      {previewOpen ? (
        <div className="trainerNextModalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <section className="trainerNextWorkoutPreview" role="dialog" aria-modal="true" aria-labelledby="trainer-workout-preview-title">
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
      <section className="trainerNextModal" role="dialog" aria-modal="true" aria-labelledby="trainer-create-client-title">
        <button className="trainerNextModalClose" type="button" onClick={state.onClose} aria-label="Закрыть">×</button>
        <div className="trainerNextModalIcon"><UserPlus size={24} /></div>
        <h2 id="trainer-create-client-title">Добавить клиента</h2>
        <p>Создайте учетные данные для нового клиента.</p>
        <form onSubmit={state.onSubmit}>
          <label><span>Имя</span><input value={state.name} onChange={(event) => state.onNameChange(event.target.value)} placeholder="Имя клиента" /></label>
          <label><span>Email</span><input type="email" value={state.email} onChange={(event) => state.onEmailChange(event.target.value)} placeholder="client@email.com" /></label>
          <label><span>Пароль</span><div><input type="text" value={state.password} onChange={(event) => state.onPasswordChange(event.target.value)} placeholder="Минимум 6 символов" /><button type="button" onClick={state.onGeneratePassword}>Создать</button></div></label>
          {state.status ? <p className="trainerNextModalStatus">{state.status}</p> : null}
          {state.credentials ? <div className="trainerNextCredentials"><strong>Данные клиента</strong><code>{state.credentials.email}<br />{state.credentials.password}</code></div> : null}
          <button className="trainerNextPrimary trainerNextModalSubmit" type="submit" disabled={state.loading}>{state.loading ? "Создаю..." : "Добавить клиента"}</button>
        </form>
      </section>
    </div>
  );
}

function TrainerCabinetPage({ trainerName, trainerAvatar, clients = [], counts = {}, onNavigate, onRefresh, onLogout }) {
  const activeCount = counts.active ?? clients.filter((client) => client.status !== "archived").length;
  const attentionCount = counts.attention ?? 0;

  return (
    <div className="trainerNextPage trainerNextCabinetPage">
      <header className="trainerNextMobileHeader">
        <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
        <h1>Кабинет</h1>
        <div className="trainerNextMobileHeaderActions">
          <button type="button" onClick={onRefresh} aria-label="Обновить страницу"><RefreshCw size={20} /></button>
          <button type="button" onClick={() => onNavigate("notifications")} aria-label="Уведомления">
            <Bell size={21} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="trainerNextDesktopPageHead">
        <div>
          <h1>Кабинет тренера</h1>
          <p>Профиль, быстрые действия и рабочие разделы в едином стиле тренерской панели.</p>
        </div>
      </div>

      <section className="trainerCabinetHero">
        <TrainerAvatar client={{ name: trainerName, avatarUrl: trainerAvatar }} size="large" />
        <div>
          <span>Тренер</span>
          <h2>{trainerName || "Тренер"}</h2>
          <p>Рабочий профиль подключен к панели клиентов, программ и питания.</p>
        </div>
      </section>

      <section className="trainerCabinetStats" aria-label="Сводка тренера">
        <article><span>Всего клиентов</span><strong>{clients.length}</strong></article>
        <article><span>Активных</span><strong>{activeCount}</strong></article>
        <article><span>Требуют внимания</span><strong>{attentionCount}</strong></article>
      </section>

      {onLogout ? <button className="trainerCabinetLogout" type="button" onClick={onLogout}><X size={20} />Выйти из аккаунта</button> : null}
    </div>
  );
}

function TrainerUtilityPage({ section, clients = [], clientSummaries = {}, counts = {}, onNavigate, onRefresh, onSendMessage }) {
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
      <header className="trainerNextMobileHeader">
        <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
        <h1>{config.title}</h1>
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

      {config.body ? <section className="trainerUtilityBody">{config.body}</section> : null}

    </div>
  );
}

export default function TrainerWorkspace({
  mode = "dashboard",
  activeSection = "dashboard",
  onNavigate,
  trainerName,
  trainerAvatar,
  clients = [],
  clientSummaries = {},
  summariesLoading = false,
  counts = {},
  selectedClient,
  selectedProfile = {},
  selectedSummary = {},
  activeClientTab = "overview",
  onClientTabChange,
  onOpenClient,
  onCloseClient,
  onCreateClient,
  createClientState,
  measurements = [],
  history = [],
  nutritionDays = [],
  nutritionGoals = {},
  nutritionPlanOptions = [],
  photos = [],
  tasks = [],
  trainerNote = "",
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
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onAddExercise,
  onRemoveExercise,
  onDuplicateExercise,
  onMoveExercise,
  onUploadExerciseVideo,
  exerciseVideoUploadingId = "",
  onAddDay,
  onDuplicateDay,
  onRemoveDay,
  onSaveWorkouts,
  onGenerateNutritionPlan,
  onSaveNutritionPlan,
  onSaveNotifications,
  onTestNotification,
  onConnectTelegram,
  onSendMessage,
  onClientAction,
  onRefresh,
  onLogout,
  appVersion
}) {
  let content = null;
  const showSyncOverlay = summariesLoading;

  if (mode === "dashboard") {
    content = (
      <TrainerDashboard
        clients={clients}
        clientSummaries={clientSummaries}
        counts={counts}
        onOpenClient={onOpenClient}
        onOpenClients={() => onNavigate("clients")}
        onCreateClient={onCreateClient}
        onRefresh={onRefresh}
        onNotifications={() => onNavigate("notifications")}
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
        activeTab={activeClientTab}
        onTabChange={onClientTabChange}
        onBack={onCloseClient}
        measurements={measurements}
        history={history}
        nutritionDays={nutritionDays}
        nutritionGoals={nutritionGoals}
        nutritionPlanOptions={nutritionPlanOptions}
        photos={photos}
        tasks={tasks}
        note={trainerNote}
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
        onUpdateExerciseSet={onUpdateExerciseSet}
        onAddExerciseSet={onAddExerciseSet}
        onRemoveExerciseSet={onRemoveExerciseSet}
        onAddExercise={onAddExercise}
        onRemoveExercise={onRemoveExercise}
        onDuplicateExercise={onDuplicateExercise}
        onMoveExercise={onMoveExercise}
        onUploadExerciseVideo={onUploadExerciseVideo}
        exerciseVideoUploadingId={exerciseVideoUploadingId}
        onAddDay={onAddDay}
        onDuplicateDay={onDuplicateDay}
        onRemoveDay={onRemoveDay}
        onSaveNotifications={onSaveNotifications}
        onTestNotification={onTestNotification}
        onConnectTelegram={onConnectTelegram}
        onSendMessage={onSendMessage}
        onClientAction={onClientAction}
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
        onUpdateExerciseSet={onUpdateExerciseSet}
        onAddExerciseSet={onAddExerciseSet}
        onRemoveExerciseSet={onRemoveExerciseSet}
        onAddExercise={onAddExercise}
        onRemoveExercise={onRemoveExercise}
        onDuplicateExercise={onDuplicateExercise}
        onMoveExercise={onMoveExercise}
        onUploadExerciseVideo={onUploadExerciseVideo}
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
        counts={counts}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
        onLogout={onLogout}
      />
    );
  } else if (["messages", "analytics", "notifications"].includes(mode)) {
    content = (
      <TrainerUtilityPage
        section={mode}
        clients={clients}
        clientSummaries={clientSummaries}
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
