import {
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardList,
  MessageCircle,
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
  nutritionText,
  historyText,
  onOpenBodyControl,
  onOpenNutrition,
  onOpenCalendar,
  onOpenAccount,
  onOpenQuestionnaire,
  onOpenNotifications,
  onOpenFeedback,
  accountAvatarUrl,
  accountName = "Спортсмен",
  accountRole = "Участник"
}) {
  const fallbackLetter = String(accountName).trim().charAt(0).toUpperCase() || "А";
  const bodyControlNote = latestMeasurementText && latestMeasurementText !== "Замеров пока нет"
    ? `Последний замер ${latestMeasurementText}`
    : latestPhotoText;

  return (
    <div
      className={`${styles.root}${showClientOnlyActions ? "" : ` ${styles.trainer}`}`}
      data-css-module-scope="profile-cabinet-action-grid"
      data-testid="profile-cabinet-action-grid"
    >
      <button type="button" className={styles.account} data-testid="profile-cabinet-action-account" onClick={onOpenAccount}>
        <span className={styles.avatar} data-testid="profile-cabinet-action-account-icon">
          {accountAvatarUrl ? <img src={accountAvatarUrl} alt="" /> : fallbackLetter}
        </span>
        <span className={styles.accountText}>
          <strong data-testid="profile-cabinet-action-account-title">{accountName}</strong>
          <small>Профиль и настройки</small>
          <em>{accountRole}</em>
        </span>
        <ChevronRight className={styles.chevron} aria-hidden="true" />
      </button>

      {showClientOnlyActions && (
        <section className={styles.groupSection} aria-label="Здоровье и план">
          <h2>ЗДОРОВЬЕ И ПЛАН</h2>
          <div className={styles.group}>
            <ActionRow kind="body-control" icon={Camera} title="Фото и замеры" note={bodyControlNote} onClick={onOpenBodyControl} />
            <ActionRow kind="nutrition" icon={Utensils} title="КБЖУ" note={nutritionText} onClick={onOpenNutrition} />
            <ActionRow kind="workout-journal" icon={CalendarDays} title="Календарь и история" note={historyText} onClick={onOpenCalendar} />
          </div>
        </section>
      )}

      <section className={styles.groupSection} aria-label="Приложение">
        <h2>ПРИЛОЖЕНИЕ</h2>
        <div className={styles.group}>
          {showClientOnlyActions && <ActionRow kind="questionnaire" icon={ClipboardList} title="Анкета" note="Цель, возраст и активность" onClick={onOpenQuestionnaire} />}
          {showClientOnlyActions && <ActionRow kind="notifications" icon={Bell} title="Уведомления" note="Тренировки и напоминания" onClick={onOpenNotifications} />}
          <ActionRow kind="feedback" icon={MessageCircle} title="Ошибка или идея" note="Отзыв и предложение" onClick={onOpenFeedback} warm />
        </div>
      </section>
    </div>
  );
}
