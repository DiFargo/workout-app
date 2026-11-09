import { CheckCircle2, Scale } from "lucide-react";
import { ArrowRight, Bell, Camera, ChevronRight, Dumbbell, Ruler, MessageCircle } from "../../../shared/ui/ClientReferenceIcon.jsx";
import styles from "./ProfileSummaryDashboard.module.css";
import { buildProfileDashboardTasks } from "./profileDashboardTasks.js";
import { getDashboardWeightPresentation } from "./profileDashboardPresentation.js";

const DASHBOARD_TASK_ICONS = {
  workout: Dumbbell,
  weight: Scale,
  measurements: Ruler,
  photos: Camera
};

function formatRussianCount(count, forms) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} ${forms[2]}`;
  if (lastDigit === 1) return `${count} ${forms[0]}`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

function getTrainerNotificationLabel(messageCount, taskCount, fallbackCount, isBasicPlan) {
  if (isBasicPlan) {
    const parts = [];
    if (messageCount > 0) parts.push(formatRussianCount(messageCount, ["сообщение", "сообщения", "сообщений"]));
    if (taskCount > 0) parts.push(formatRussianCount(taskCount, ["напоминание", "напоминания", "напоминаний"]));
    return parts.join(" · ") || (fallbackCount > 0
      ? formatRussianCount(fallbackCount, ["уведомление", "уведомления", "уведомлений"])
      : "Новых уведомлений нет");
  }
  if (messageCount > 0 && taskCount > 0) {
    if (messageCount === 1 && taskCount === 1) return "Сообщение и задача от тренера";
    return `${formatRussianCount(messageCount, ["сообщение", "сообщения", "сообщений"])} · ${formatRussianCount(taskCount, ["задача", "задачи", "задач"])} от тренера`;
  }
  if (messageCount > 0) return `${formatRussianCount(messageCount, ["сообщение", "сообщения", "сообщений"])} от тренера`;
  if (taskCount > 0) return `${formatRussianCount(taskCount, ["задача", "задачи", "задач"])} от тренера`;
  return fallbackCount > 0
    ? `${formatRussianCount(fallbackCount, ["уведомление", "уведомления", "уведомлений"])} от тренера`
    : "";
}

export default function ProfileSummaryDashboard({
  isBasicPlan = false,
  greetingName,
  greeting,
  dateLabel,
  workoutTitle,
  workoutDate,
  workoutPosition,
  workoutState = "ready",
  workoutLoadState = "ready",
  onRetryWorkoutLoad,
  isWorkoutToday = false,
  workoutScheduleStatus,
  workoutActionLabel,
  exerciseCount,
  totalWorkouts,
  caloriesConsumed,
  calorieGoal,
  latestWeight,
  weightChange,
  weightComparisonAvailable = false,
  weightDateText = "",
  weightDataAvailable = true,
  nutritionReady = true,
  nutritionError = false,
  dataLoadState = {},
  onRetryDataLoad,
  weightCheckIn,
  measurementsCheckIn,
  progressPhotoCheckIn,
  showProgressPhotoTask = true,
  trainerNotificationCount,
  trainerNotifications,
  onOpenWorkout,
  onOpenTrainer,
  onOpenNutrition,
  onOpenProgress,
  onOpenWeight,
  onOpenMeasurements,
  onOpenProgressPhotos
}) {
  const firstName = String(greetingName || "").trim().split(/\s+/)[0] || "спортсмен";
  const summaryGreeting = greeting || `Доброе утро, ${firstName}`;
  const summaryDateLabel = dateLabel || new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date()).replace(/^./, (letter) => letter.toLocaleUpperCase("ru-RU"));
  const loggedWorkoutCount = Math.max(0, Number(totalWorkouts) || 0);
  const consumedCalories = Math.max(0, Math.round(Number(caloriesConsumed) || 0));
  const targetCalories = Math.max(0, Math.round(Number(calorieGoal) || 0));
  const workoutReady = workoutLoadState === "ready";
  const weightPresentation = getDashboardWeightPresentation({ weight: latestWeight, change: weightChange,
    comparisonAvailable: weightComparisonAvailable, dateText: weightDateText,
    loadState: dataLoadState.measurementOverview?.status || "ready", hasLoadedData: weightDataAvailable });
  const taskResources = ["measurementOverview", "photos", "tasks"];
  const taskDataUnknown = !workoutReady || taskResources.some(name => dataLoadState[name] &&
    dataLoadState[name].status !== "ready" && !dataLoadState[name].hasValue);
  const visibleResources = [...taskResources, "nutritionDay"];
  const dataLoadFailed = visibleResources.some(name => dataLoadState[name]?.status === "error") || nutritionError;
  const nutritionFailed = nutritionError || dataLoadState.nutritionDay?.status === "error";
  const dataLoading = visibleResources.some(name => dataLoadState[name]?.status === "loading");
  const trainerTasksReady = !dataLoadState.tasks || dataLoadState.tasks.status === "ready" || dataLoadState.tasks.hasValue;
  const activeTrainerNotifications = Array.isArray(trainerNotifications)
    ? trainerNotifications.filter((notification) => notification?.status !== "completed" && !notification?.completedAt)
    : [];
  const trainerMessageCount = activeTrainerNotifications.filter((notification) => notification?.notificationType === "message").length;
  const trainerTaskCount = activeTrainerNotifications.length - trainerMessageCount;
  const notificationCount = activeTrainerNotifications.length || Math.max(0, Number(trainerNotificationCount) || 0);
  const trainerNotificationLabel = getTrainerNotificationLabel(trainerMessageCount, trainerTaskCount, notificationCount, isBasicPlan);
  const scheduleStatus = workoutScheduleStatus || (isWorkoutToday ? "today" : "unscheduled");
  const dashboardTasks = buildProfileDashboardTasks({
    workoutState,
    workoutMode: isBasicPlan ? "basic" : "individual",
    workoutScheduleStatus: scheduleStatus,
    workoutTitle,
    workoutDate,
    workoutExerciseCount: exerciseCount,
    workoutActionLabel,
    weightCheckIn,
    measurementsCheckIn,
    progressPhotoCheckIn,
    includeProgressPhoto: showProgressPhotoTask && progressPhotoCheckIn?.enabled === true
  }).filter(task => workoutReady || task.kind !== "workout");
  const taskActions = {
    workout: onOpenWorkout,
    weight: onOpenWeight,
    measurements: onOpenMeasurements,
    photos: onOpenProgressPhotos
  };
  const latestMessage = activeTrainerNotifications.find((notification) => notification?.notificationType === "message");
  const messagePreview = String(latestMessage?.message || latestMessage?.text || latestMessage?.description || "").trim();
  const workoutTask = dashboardTasks.find(task => task.kind === "workout");
  const hasWorkoutHero = workoutReady && workoutTitle && Number(exerciseCount) > 0;
  const reminderTasks = hasWorkoutHero ? dashboardTasks.filter(task => task.kind !== "workout") : dashboardTasks;

  return (
    <div className={styles.root} data-testid="profile-summary-dashboard">
      <section className={styles.welcome} aria-label="Приветствие">
        <p>{summaryDateLabel}</p>
        <h2 data-testid="profile-summary-greeting">{summaryGreeting}</h2>
      </section>
      {hasWorkoutHero ? <section className={styles.workoutHero} aria-label="Тренировка по плану">
        <div className={styles.heroTop}><span><Dumbbell aria-hidden="true" />{isWorkoutToday ? "Сегодня по плану" : workoutState === "draft" ? "Тренировка начата" : "Твой план"}</span><small>{workoutPosition || workoutDate}</small></div>
        <h2>{workoutTitle}</h2>
        <p className={styles.workoutFocus}>{isBasicPlan ? "Базовая тренировка" : "Индивидуальная программа"}</p>
        <div className={styles.workoutMeta}><span><Dumbbell aria-hidden="true" />{formatRussianCount(Math.max(0, Number(exerciseCount) || 0), ["упражнение", "упражнения", "упражнений"])}</span></div>
        <button type="button" className={styles.workoutPrimary} data-testid="profile-summary-primary" data-task-id="workout" onClick={onOpenWorkout}>{workoutTask?.actionLabel || workoutActionLabel || "Открыть тренировку"}<ArrowRight aria-hidden="true" /></button>
      </section> : null}
      <section className={styles.reminders} data-testid="profile-summary-task-card" aria-labelledby="profileSummaryTaskHeading">
        <div className={styles.heroTop}>
          <span><Dumbbell aria-hidden="true" />План на сегодня</span>
          <span className={styles.taskCount} role="status" aria-live="polite" aria-atomic="true" data-testid="profile-summary-task-count">
            {taskDataUnknown && !dashboardTasks.length ? dataLoadFailed ? "Не все данные" : "Уточняем задачи" : formatRussianCount(dashboardTasks.length, ["задача", "задачи", "задач"])}
          </span>
        </div>
        <h2 id="profileSummaryTaskHeading" data-testid="profile-summary-task-title">Не забудь</h2>
        <p>{!workoutReady ? "Задачи по тренировкам появятся после загрузки плана." : dashboardTasks.length
          ? "Только то, что актуально для вашего плана и прогресса."
          : taskDataUnknown ? dataLoadFailed ? "Не удалось проверить все задачи. Повторите загрузку." : "Проверяем актуальные задачи. Это займёт немного времени."
            : "На сегодня нет актуальных задач."}</p>
        {!workoutReady && <div className={styles.workoutLoadState} role="status" data-testid="profile-summary-workout-loading"><strong>{workoutLoadState === "error" ? "Не удалось загрузить план" : "Загружаем план тренировок…"}</strong>{workoutLoadState === "error" && onRetryWorkoutLoad && <button type="button" onClick={onRetryWorkoutLoad}>Повторить загрузку</button>}</div>}
        {reminderTasks.length ? (
          <div className={styles.taskList}>
            {reminderTasks.map((task, index) => {
              const TaskIcon = DASHBOARD_TASK_ICONS[task.kind];
              const isPrimaryWorkout = task.kind === "workout" && index === 0;
              return (
                <button
                  key={task.id}
                  type="button"
                  className={`${styles.taskRow}${isPrimaryWorkout ? ` ${styles.primaryTask}` : ""}`}
                  data-testid={isPrimaryWorkout
                    ? "profile-summary-primary"
                    : task.id === "workout"
                      ? "profile-summary-task-workout"
                      : `profile-summary-task-${task.id}`}
                  data-task-id={task.id}
                  data-primary-action={isPrimaryWorkout ? "true" : undefined}
                  aria-label={`${task.title}. ${task.note} ${task.actionLabel}`}
                  onClick={taskActions[task.kind]}
                >
                  <span className={styles.taskIcon} aria-hidden="true"><TaskIcon size={18} strokeWidth={2} /></span>
                  <span className={styles.taskCopy}>
                    <strong>{task.title}</strong>
                    <small>{task.note}</small>
                  </span>
                  <span className={styles.taskArrow} aria-hidden="true">
                    {isPrimaryWorkout ? <ArrowRight size={17} strokeWidth={2.4} /> : <ChevronRight size={17} strokeWidth={2} />}
                  </span>
                </button>
              );
            })}
          </div>
        ) : workoutReady && !taskDataUnknown ? (
          <div className={styles.emptyTasks} data-testid="profile-summary-task-empty">
            <CheckCircle2 aria-hidden="true" size={20} />
            <span>Нет актуальных задач</span>
          </div>
        ) : null}
        {(dataLoadFailed || dataLoading) && <div className={styles.dataLoadNotice} role="status" data-testid="profile-summary-data-status">
          <span>{dataLoadFailed ? "Не все данные удалось обновить. Доступные записи сохранены." : "Обновляем данные…"}</span>
          {dataLoadFailed && onRetryDataLoad && <button type="button" onClick={() => onRetryDataLoad(visibleResources.filter(name => dataLoadState[name]?.status === "error"))}>Повторить загрузку</button>}
        </div>}
      </section>

      <div className={styles.sectionHead}><h3>Твой ритм</h3></div>
      <div className={styles.metrics}>
        <button type="button" data-testid="profile-summary-workout-log" disabled={!workoutReady} onClick={onOpenWorkout}><span>Тренировки</span><strong>{workoutReady ? loggedWorkoutCount : workoutLoadState === "error" ? "—" : "…"}</strong><small>{workoutReady ? "завершено" : workoutLoadState === "error" ? "план не загружен" : "план загружается"}</small></button>
        <button type="button" data-testid="profile-summary-nutrition" onClick={onOpenNutrition}><span>Питание</span><strong>{nutritionReady ? consumedCalories.toLocaleString("ru-RU") : nutritionFailed ? "—" : "…"}</strong><small>{!nutritionReady ? nutritionFailed ? "Не удалось загрузить" : "Загружаем дневник…" : targetCalories ? `из ${targetCalories.toLocaleString("ru-RU")} ккал` : "цель не задана"}</small></button>
        <button type="button" data-testid="profile-summary-weight" onClick={onOpenProgress}><span>Вес</span><strong>{weightPresentation.value}</strong><small>{weightPresentation.note}</small></button>
      </div>

      <div className={styles.sectionHead}><h3>{isBasicPlan ? "Сообщения и напоминания" : "На связи"}</h3></div>
      <button type="button" className={styles.coach} data-testid="profile-summary-notifications-button" onClick={onOpenTrainer}>
        <span className={styles.avatar} aria-hidden="true">{isBasicPlan ? <Bell size={20} /> : <MessageCircle size={20} />}</span>
        <span className={styles.coachCopy}><strong>{isBasicPlan ? "Уведомления" : "Твой тренер"}</strong><small data-testid="profile-summary-trainer-status">{trainerTasksReady ? trainerNotificationLabel || "Новых сообщений нет" : dataLoadState.tasks?.status === "error" ? "Не удалось загрузить сообщения" : "Загружаем сообщения…"}</small></span>
        <span className={styles.coachTrailing}>{trainerTasksReady && notificationCount > 0 && <span className={styles.notificationBadge} data-testid="profile-summary-trainer-badge" aria-label={`${notificationCount} новых уведомлений`} />}<ChevronRight size={16} /></span>
        {trainerTasksReady && messagePreview && <span className={styles.messagePreview}>{messagePreview}</span>}
      </button>
    </div>
  );
}
