import styles from "./ProfileCabinetActionGrid.module.css";

function ProfileCabinetActionCard({ kind, icon, avatarUrl, eyebrow, title, note, onClick }) {
  return (
    <button
      type="button"
      className={styles.card}
      data-testid={`profile-cabinet-action-${kind}`}
      onClick={onClick}
      aria-label={`${eyebrow}: ${title}`}
    >
      <span className={styles.icon} data-testid={`profile-cabinet-action-${kind}-icon`}>
        {avatarUrl ? <img className={styles.avatar} src={avatarUrl} alt="" /> : icon}
      </span>
      <span className={styles.text}>
        <small className={styles.eyebrow}>{eyebrow}</small>
        <strong className={styles.title} data-testid={`profile-cabinet-action-${kind}-title`}>{title}</strong>
        <em className={styles.note}>{note}</em>
      </span>
      <i className={styles.arrow} aria-hidden="true">›</i>
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
  onOpenFeedback,
  accountAvatarUrl
}) {
  const bodyControlNote = latestMeasurementText && latestMeasurementText !== "Замеров пока нет"
    ? `Замеры: ${latestMeasurementText}`
    : latestPhotoText;

  return (
    <div
      className={`${styles.root}${showClientOnlyActions ? "" : ` ${styles.trainer}`}`}
      data-css-module-scope="profile-cabinet-action-grid"
      data-testid="profile-cabinet-action-grid"
    >
      <ProfileCabinetActionCard
        kind="account"
        icon="👤"
        avatarUrl={accountAvatarUrl}
        eyebrow="АККАУНТ"
        title="Профиль и настройки"
        note="Оформление, Telegram и выход"
        onClick={onOpenAccount}
      />

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          kind="body-control"
          icon="📷"
          eyebrow="КОНТРОЛЬ ТЕЛА"
          title="Фото и замеры"
          note={bodyControlNote}
          onClick={onOpenBodyControl}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          kind="nutrition"
          icon="🍽️"
          eyebrow="ПЛАН ПИТАНИЯ"
          title="КБЖУ"
          note={nutritionText}
          onClick={onOpenNutrition}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          kind="workout-journal"
          icon="🗓️"
          eyebrow="ТРЕНИРОВКИ"
          title="Календарь и история"
          note={historyText}
          onClick={onOpenCalendar}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          kind="questionnaire"
          icon="📋"
          eyebrow="ПАРАМЕТРЫ"
          title="Анкета"
          note="Вес, рост, возраст, цель и активность"
          onClick={onOpenQuestionnaire}
        />
      )}

      <ProfileCabinetActionCard
        kind="feedback"
        icon="💬"
        eyebrow="ОБРАТНАЯ СВЯЗЬ"
        title="Ошибка или идея"
        note="Отзыв, рекомендация или предложение"
        onClick={onOpenFeedback}
      />

    </div>
  );
}
