export default function ProfileCabinetTitleRow({
  showTrainerNotifications,
  trainerNotificationCount,
  onOpenTrainerNotifications
}) {
  return (
    <div className="profileCabinetTitleRow">
      <h1 className="profileCabinetPageTitle clientCorePageTitle">Личный кабинет</h1>
      {showTrainerNotifications && (
        <button
          type="button"
          className="profileTrainerNotificationsButton"
          aria-label={`Уведомления тренера${trainerNotificationCount ? `: ${trainerNotificationCount}` : ""}`}
          title="Уведомления тренера"
          onClick={onOpenTrainerNotifications}
        >
          <span aria-hidden="true">🔔</span>
          {trainerNotificationCount > 0 && (
            <em>{Math.min(trainerNotificationCount, 99)}</em>
          )}
        </button>
      )}
    </div>
  );
}
