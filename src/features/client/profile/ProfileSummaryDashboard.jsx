import { ArrowRight, Bell, Dumbbell } from "lucide-react";
import RecoveryHeartIcon from "./RecoveryHeartIcon";
import styles from "./ProfileSummaryDashboard.module.css";

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

function getHeroCopy({
  workoutState,
  scheduleStatus,
  workoutTitle,
  workoutDate,
  workoutActionLabel
}) {
  if (workoutState === "complete") {
    return {
      status: "Выполнено",
      symbol: "heart",
      title: "Тренировка завершена",
      description: "План на сегодня выполнен — время восстановиться",
      planLabel: "Сегодня",
      planValue: "Тренировка выполнена",
      buttonLabel: workoutActionLabel || "Тренировки"
    };
  }

  if (workoutState !== "ready") {
    return {
      status: "Нужен план",
      symbol: "dumbbell",
      title: workoutTitle || "Следующая тренировка",
      description: workoutDate || "Откройте раздел тренировок, чтобы продолжить",
      planLabel: "Сегодня",
      planValue: "Выберите следующий шаг",
      buttonLabel: workoutActionLabel || "Тренировки"
    };
  }

  if (scheduleStatus === "today") {
    return {
      status: "Тренировка сегодня",
      symbol: "dumbbell",
      title: workoutTitle || "Тренировка по плану",
      description: "Тренировка по вашему плану",
      planLabel: "Сегодня",
      planValue: "Тренировка по плану",
      buttonLabel: "Открыть тренировку"
    };
  }

  if (scheduleStatus === "upcoming") {
    return {
      status: "День отдыха",
      symbol: "heart",
      title: "Отдых и восстановление",
      description: `Следующая: ${workoutTitle || "тренировка"} · ${workoutDate || "дата уточняется"}`,
      planLabel: "Сегодня",
      planValue: "Восстановление и лёгкая активность",
      buttonLabel: "Открыть план"
    };
  }

  if (scheduleStatus === "missed") {
    return {
      status: "Нужен перенос",
      symbol: "dumbbell",
      title: "Пропущенная тренировка",
      description: `${workoutTitle || "Тренировка"} была запланирована на ${workoutDate || "прошедшую дату"}`,
      planLabel: "Сегодня",
      planValue: "Перенесите тренировку",
      buttonLabel: workoutActionLabel || "Тренировки"
    };
  }

  return {
    status: "Свободный день",
    symbol: "heart",
    title: "Сегодня без тренировки",
    description: "Дата следующей тренировки пока не назначена",
    planLabel: "Сегодня",
    planValue: "Отдых без нагрузки",
    buttonLabel: "Открыть план"
  };
}

export default function ProfileSummaryDashboard({
  isBasicPlan = false,
  greetingName,
  greeting,
  dateLabel,
  workoutTitle,
  workoutDate,
  workoutState = "ready",
  isWorkoutToday = false,
  workoutScheduleStatus,
  workoutActionLabel,
  exerciseCount,
  totalWorkouts,
  caloriesConsumed,
  calorieGoal,
  latestWeight,
  weightChange,
  trainerNotificationCount,
  trainerNotifications,
  onOpenWorkout,
  onOpenTrainer,
  onOpenNutrition,
  onOpenProgress
}) {
  const firstName = String(greetingName || "").trim().split(/\s+/)[0] || "спортсмен";
  const summaryGreeting = greeting || `Доброе утро, ${firstName}`;
  const summaryDateLabel = dateLabel || new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date()).replace(/^./, (letter) => letter.toLocaleUpperCase("ru-RU"));
  const workoutCount = Math.max(0, Number(exerciseCount) || 0);
  const loggedWorkoutCount = Math.max(0, Number(totalWorkouts) || 0);
  const consumedCalories = Math.max(0, Math.round(Number(caloriesConsumed) || 0));
  const targetCalories = Math.max(0, Math.round(Number(calorieGoal) || 0));
  const weight = Number(latestWeight);
  const delta = Number(weightChange);
  const activeTrainerNotifications = Array.isArray(trainerNotifications)
    ? trainerNotifications.filter((notification) => notification?.status !== "completed" && !notification?.completedAt)
    : [];
  const trainerMessageCount = activeTrainerNotifications.filter((notification) => notification?.notificationType === "message").length;
  const trainerTaskCount = activeTrainerNotifications.length - trainerMessageCount;
  const notificationCount = activeTrainerNotifications.length || Math.max(0, Number(trainerNotificationCount) || 0);
  const trainerNotificationLabel = getTrainerNotificationLabel(trainerMessageCount, trainerTaskCount, notificationCount, isBasicPlan);
  const scheduleStatus = workoutScheduleStatus || (isWorkoutToday ? "today" : "unscheduled");
  const heroCopy = getHeroCopy({
    workoutState,
    scheduleStatus,
    workoutTitle,
    workoutDate,
    workoutActionLabel
  });
  const latestMessage = activeTrainerNotifications.find((notification) => notification?.notificationType === "message");
  const messagePreview = String(latestMessage?.message || latestMessage?.text || latestMessage?.description || "").trim();
  const HeroDayIcon = heroCopy.symbol === "heart" ? RecoveryHeartIcon : Dumbbell;

  return (
    <div className={styles.root} data-testid="profile-summary-dashboard">
      <section className={styles.welcome} aria-label="Приветствие">
        <p>{summaryDateLabel}</p>
        <h2 data-testid="profile-summary-greeting">{summaryGreeting}</h2>
      </section>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <span><Dumbbell aria-hidden="true" />{scheduleStatus === "today" ? "Сегодня по плану" : heroCopy.status}</span>
          <span className={styles.heroStatus} data-testid="profile-summary-hero-status">{isBasicPlan ? "Базовый план" : "Ваш план"}</span>
          <span className={styles.heroDayArt} aria-hidden="true">
            <HeroDayIcon
              data-testid="profile-summary-day-illustration"
              data-day-symbol={heroCopy.symbol}
              aria-hidden="true"
              size={28}
              strokeWidth={1.5}
            />
          </span>
        </div>
        <h2 data-testid="profile-summary-hero-title">{heroCopy.title}</h2>
        <p>{heroCopy.description}</p>
        {workoutCount > 0 && scheduleStatus === "today" ? <div className={styles.heroMeta}><span><Dumbbell aria-hidden="true" />{formatRussianCount(workoutCount, ["упражнение", "упражнения", "упражнений"])}</span></div> : null}
        <div className={styles.heroBottom}><button type="button" data-testid="profile-summary-primary" onClick={onOpenWorkout}>{heroCopy.buttonLabel} <ArrowRight aria-hidden="true" /></button></div>
      </section>

      <div className={styles.sectionHead}><h3>Ваши показатели</h3></div>
      <div className={styles.metrics}>
        <button type="button" data-testid="profile-summary-workout-log" onClick={onOpenWorkout}><span>Тренировки</span><strong>{loggedWorkoutCount}</strong><small>завершено</small></button>
        <button type="button" data-testid="profile-summary-nutrition" onClick={onOpenNutrition}><span>Питание</span><strong>{consumedCalories.toLocaleString("ru-RU")}</strong><small>{targetCalories ? `из ${targetCalories.toLocaleString("ru-RU")} ккал` : "цель не задана"}</small></button>
        <button type="button" onClick={onOpenProgress}><span>Вес</span><strong>{Number.isFinite(weight) && weight > 0 ? weight.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : "—"}</strong><small>{Number.isFinite(delta) && delta !== 0 ? `${delta > 0 ? "+" : ""}${delta.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг` : "без изменений"}</small></button>
      </div>

      <div className={styles.sectionHead}><h3>{isBasicPlan ? "Сообщения и напоминания" : "Тренер рядом"}</h3></div>
      <button type="button" className={styles.coach} data-testid="profile-summary-notifications-button" onClick={onOpenTrainer}>
        <span className={styles.avatar} aria-hidden="true">{isBasicPlan ? <Bell size={24} /> : "ТР"}</span>
        <span className={styles.coachCopy}><strong>{isBasicPlan ? "Уведомления" : "Ваш тренер"}</strong><small data-testid="profile-summary-trainer-status">{trainerNotificationLabel || "Новых сообщений нет"}</small></span>
        {notificationCount > 0 && <span className={styles.notificationBadge} data-testid="profile-summary-trainer-badge" aria-label={`${notificationCount} новых уведомлений`} />}
        {messagePreview && <span className={styles.messagePreview}>{messagePreview}</span>}
      </button>
    </div>
  );
}
