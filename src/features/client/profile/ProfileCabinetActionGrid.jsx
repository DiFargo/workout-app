function ProfileCabinetActionCard({ className, icon, eyebrow, title, note, onClick }) {
  return (
    <button type="button" className={`progressHubCard ${className}`} onClick={onClick}>
      <span className="progressHubCardIcon">{icon}</span>
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
  onOpenPhotos,
  onOpenMeasurements,
  onOpenNutrition,
  onOpenCalendar,
  onOpenHistory,
  onOpenAccount,
  onOpenQuestionnaire,
  onOpenSettings
}) {
  return (
    <div className={`progressHubOverview profileCabinetProgressOverview${showClientOnlyActions ? " hasProgressPhotos" : ""}`}>
      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          className="photos"
          icon="📷"
          eyebrow="КОНТРОЛЬ ТЕЛА"
          title="Фото прогресса"
          note={latestPhotoText}
          onClick={onOpenPhotos}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          className="measurements"
          icon="📏"
          eyebrow="КОНТРОЛЬ ТЕЛА"
          title="Замеры"
          note={latestMeasurementText}
          onClick={onOpenMeasurements}
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
          className="progress"
          icon="🗓️"
          eyebrow="ТРЕНИРОВКИ"
          title="Календарь"
          note={historyText}
          onClick={onOpenCalendar}
        />
      )}

      {showClientOnlyActions && (
        <ProfileCabinetActionCard
          className="history"
          icon="🕘"
          eyebrow="ТРЕНИРОВКИ"
          title="История"
          note={historyText}
          onClick={onOpenHistory}
        />
      )}

      <ProfileCabinetActionCard
        className="accountProfile"
        icon="👤"
        eyebrow="АККАУНТ"
        title="Профиль"
        note="Имя, почта, пароль и выход"
        onClick={onOpenAccount}
      />

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
        className="settings"
        icon="⚙️"
        eyebrow="ПАРАМЕТРЫ"
        title="Настройки"
        note="Оформление и Telegram"
        onClick={onOpenSettings}
      />
    </div>
  );
}
