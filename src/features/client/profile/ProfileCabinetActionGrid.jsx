function ProfileCabinetActionCard({ className, icon, avatarUrl, eyebrow, title, note, onClick }) {
  return (
    <button type="button" className={`progressHubCard ${className}`} onClick={onClick} aria-label={`${eyebrow}: ${title}`}>
      <span className="progressHubCardIcon">
        {avatarUrl ? <img className="progressHubCardAvatar" src={avatarUrl} alt="" /> : icon}
      </span>
      <span className="progressHubCardText">
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        <em>{note}</em>
      </span>
      <i>›</i>
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
    <div className={`progressHubOverview profileCabinetProgressOverview${showClientOnlyActions ? " hasProgressPhotos" : ""}`}>
      <ProfileCabinetActionCard
        className="accountProfile"
        icon="👤"
        avatarUrl={accountAvatarUrl}
        eyebrow="АККАУНТ"
        title="Профиль и настройки"
        note="Оформление, Telegram и выход"
        onClick={onOpenAccount}
      />

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          className="bodyControl"
          icon="📷"
          eyebrow="КОНТРОЛЬ ТЕЛА"
          title="Фото и замеры"
          note={bodyControlNote}
          onClick={onOpenBodyControl}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          className="nutrition"
          icon="🍽️"
          eyebrow="ПЛАН ПИТАНИЯ"
          title="КБЖУ"
          note={nutritionText}
          onClick={onOpenNutrition}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          className="progress cabinetWorkoutJournalButton"
          icon="🗓️"
          eyebrow="ТРЕНИРОВКИ"
          title="Календарь и история"
          note={historyText}
          onClick={onOpenCalendar}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          className="questionnaire"
          icon="📋"
          eyebrow="ПАРАМЕТРЫ"
          title="Анкета"
          note="Вес, рост, возраст, цель и активность"
          onClick={onOpenQuestionnaire}
        />
      )}

      <ProfileCabinetActionCard
        className="feedback"
        icon="💬"
        eyebrow="ОБРАТНАЯ СВЯЗЬ"
        title="Ошибка или идея"
        note="Отзыв, рекомендация или предложение"
        onClick={onOpenFeedback}
      />

    </div>
  );
}
