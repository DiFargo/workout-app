import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  LogOut,
  MessageCircle,
  Ruler,
  Scale,
  UserRound,
  Utensils
} from "lucide-react";
import styles from "./ProfileCabinetActionGrid.module.css";

function ActionRow({ kind, icon: Icon, title, note, onClick, warm = false }) {
  return (
    <button
      type="button"
      className={styles.row}
      data-testid={`profile-cabinet-action-${kind}`}
      onClick={onClick}
    >
      <span className={`${styles.icon}${warm ? ` ${styles.warm}` : ""}`} data-testid={`profile-cabinet-action-${kind}-icon`}>
        <Icon aria-hidden="true" />
      </span>
      <span className={styles.text}>
        <strong data-testid={`profile-cabinet-action-${kind}-title`}>{title}</strong>
        <small>{note}</small>
      </span>
      <ChevronRight className={styles.chevron} aria-hidden="true" />
    </button>
  );
}

export default function ProfileCabinetActionGrid({
  showClientOnlyActions,
  latestPhotoText,
  latestMeasurementText,
  weightText,
  nutritionText,
  historyText,
  onOpenBodyControl,
  onOpenWeight = () => {},
  onOpenNutrition,
  onOpenCalendar,
  onOpenAccount,
  onOpenQuestionnaire,
  workoutModeLabel = "Индивидуальный план от тренера",
  onOpenWorkoutMode = () => {},
  onOpenNotifications,
  onOpenFeedback,
  onLogout
}) {
  const bodyControlNote = latestMeasurementText && latestMeasurementText !== "Замеров пока нет"
    ? `Последний замер ${latestMeasurementText}`
    : latestPhotoText;

  return (
    <div
      className={`${styles.root}${showClientOnlyActions ? "" : ` ${styles.trainer}`}`}
      data-css-module-scope="profile-cabinet-action-grid"
      data-testid="profile-cabinet-action-grid"
    >
      <section className={styles.profileSection} aria-label="Профиль">
        <h2>ПРОФИЛЬ</h2>
        <button type="button" className={styles.account} data-testid="profile-cabinet-action-account" onClick={onOpenAccount}>
          <span className={styles.profileIcon} data-testid="profile-cabinet-action-account-icon" aria-hidden="true">
            <UserRound />
          </span>
          <span className={styles.accountText}>
            <strong data-testid="profile-cabinet-action-account-title">Профиль и настройки</strong>
            <small>Логин и пароль</small>
          </span>
          <ChevronRight className={styles.chevron} aria-hidden="true" />
        </button>
      </section>

      {showClientOnlyActions && (
        <section className={styles.groupSection} aria-label="Здоровье и план">
          <h2>ЗДОРОВЬЕ И ПЛАН</h2>
          <div className={styles.group}>
            <ActionRow kind="weight" icon={Scale} title="Вес" note={weightText} onClick={onOpenWeight} />
            <ActionRow kind="body-control" icon={Ruler} title="Замеры тела и фото" note={bodyControlNote} onClick={onOpenBodyControl} />
            <ActionRow kind="nutrition" icon={Utensils} title="Цели питания" note={nutritionText} onClick={onOpenNutrition} />
            <ActionRow kind="workout-journal" icon={CalendarDays} title="Расписание и история" note={historyText} onClick={onOpenCalendar} />
            <ActionRow kind="questionnaire" icon={ClipboardList} title="Анкета" note="Цель, возраст и активность" onClick={onOpenQuestionnaire} />
            <ActionRow kind="workout-mode" icon={Dumbbell} title="Режим тренировок" note={workoutModeLabel} onClick={onOpenWorkoutMode} />
          </div>
        </section>
      )}

      <section className={styles.groupSection} aria-label="Приложение">
        <h2>ПРИЛОЖЕНИЕ</h2>
        <div className={styles.group}>
          {showClientOnlyActions && <ActionRow kind="notifications" icon={Bell} title="Уведомления" note="Тренировки и напоминания" onClick={onOpenNotifications} />}
          <ActionRow kind="feedback" icon={MessageCircle} title="Ошибка или идея" note="Отзыв и предложение" onClick={onOpenFeedback} warm />
        </div>
        {onLogout && (
          <button
            type="button"
            className={styles.logoutButton}
            data-testid="profile-cabinet-logout"
            onClick={onLogout}
          >
            <LogOut aria-hidden="true" />
            Выйти из аккаунта
          </button>
        )}
      </section>
    </div>
  );
}
