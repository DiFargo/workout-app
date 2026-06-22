function formatProgressPhotoDate(photo) {
  return new Date(`${photo.date || photo.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU");
}

export default function ProfileCabinetHub({
  showClientControls,
  latestClientProgressPhoto,
  latestMeasurement,
  historyCount,
  profileMacros,
  nutritionGoals,
  activeGoalLabel,
  formatMeasurementDate,
  onOpenProgressPhotos,
  onOpenMeasurements,
  onOpenNutrition,
  onOpenCalendar,
  onOpenHistory,
  onOpenAccount,
  onOpenQuestionnaire,
  onOpenSettings
}) {
  const calories = Math.round(profileMacros.calories || nutritionGoals.calories);
  const historyText = historyCount ? `${historyCount} тренировок сохранено` : "История пока пустая";

  return (
    <div className={`progressHubOverview profileCabinetProgressOverview${showClientControls ? " hasProgressPhotos" : ""}`}>
      {showClientControls && (
        <button
          type="button"
          className="progressHubCard photos"
          onClick={onOpenProgressPhotos}
        >
          <span className="progressHubCardIcon">📷</span>
          <span className="progressHubCardText">
            <small>КОНТРОЛЬ ТЕЛА</small>
            <strong>Фото прогресса</strong>
            <em>
              {latestClientProgressPhoto
                ? `Последние: ${formatProgressPhotoDate(latestClientProgressPhoto)}`
                : "Добавь первые фото"}
            </em>
          </span>
          <i>›</i>
        </button>
      )}

      {showClientControls && (
        <button
          type="button"
          className="progressHubCard measurements"
          onClick={onOpenMeasurements}
        >
          <span className="progressHubCardIcon">📏</span>
          <span className="progressHubCardText">
            <small>КОНТРОЛЬ ТЕЛА</small>
            <strong>Замеры</strong>
            <em>{latestMeasurement ? formatMeasurementDate(latestMeasurement) : "Замеров пока нет"}</em>
          </span>
          <i>›</i>
        </button>
      )}

      {showClientControls && (
        <button
          type="button"
          className="progressHubCard nutrition"
          onClick={onOpenNutrition}
        >
          <span className="progressHubCardIcon">🍽️</span>
          <span className="progressHubCardText">
            <small>ПЛАН ПИТАНИЯ</small>
            <strong>План КБЖУ</strong>
            <em>{calories} ккал · {activeGoalLabel}</em>
          </span>
          <i>›</i>
        </button>
      )}

      {showClientControls && (
        <button
          type="button"
          className="progressHubCard progress"
          onClick={onOpenCalendar}
        >
          <span className="progressHubCardIcon">🗓️</span>
          <span className="progressHubCardText">
            <small>ТРЕНИРОВКИ</small>
            <strong>Календарь</strong>
            <em>{historyText}</em>
          </span>
          <i>›</i>
        </button>
      )}

      {showClientControls && (
        <button
          type="button"
          className="progressHubCard history"
          onClick={onOpenHistory}
        >
          <span className="progressHubCardIcon">🕘</span>
          <span className="progressHubCardText">
            <small>ТРЕНИРОВКИ</small>
            <strong>История тренировок</strong>
            <em>{historyText}</em>
          </span>
          <i>›</i>
        </button>
      )}

      <button
        type="button"
        className="progressHubCard accountProfile"
        onClick={onOpenAccount}
      >
        <span className="progressHubCardIcon">👤</span>
        <span className="progressHubCardText">
          <small>АККАУНТ</small>
          <strong>Профиль</strong>
          <em>Имя, почта, пароль и выход</em>
        </span>
        <i>›</i>
      </button>

      {showClientControls && (
        <button
          type="button"
          className="progressHubCard questionnaire"
          onClick={onOpenQuestionnaire}
        >
          <span className="progressHubCardIcon">📋</span>
          <span className="progressHubCardText">
            <small>ПАРАМЕТРЫ</small>
            <strong>Анкета</strong>
            <em>Вес, рост, возраст, цель и активность</em>
          </span>
          <i>›</i>
        </button>
      )}

      <button
        type="button"
        className="progressHubCard settings"
        onClick={onOpenSettings}
      >
        <span className="progressHubCardIcon">⚙️</span>
        <span className="progressHubCardText">
          <small>ПАРАМЕТРЫ</small>
          <strong>Настройки</strong>
          <em>Оформление и Telegram</em>
        </span>
        <i>›</i>
      </button>
    </div>
  );
}
