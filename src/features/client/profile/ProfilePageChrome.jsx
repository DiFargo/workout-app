import { Bell } from "lucide-react";

export default function ProfilePageChrome({
  isMainDashboard,
  renderBottomBar,
  showTrainerNotifications,
  trainerNotificationCount,
  onOpenTrainerNotifications
}) {
  return (
    <>
      {isMainDashboard && showTrainerNotifications && (
        <button
          type="button"
          className="menuRefreshIconBtn"
          onClick={onOpenTrainerNotifications}
          aria-label={`Уведомления тренера${trainerNotificationCount ? `: ${trainerNotificationCount}` : ""}`}
          title="Уведомления тренера"
        >
          <Bell aria-hidden="true" />
          {trainerNotificationCount > 0 && (
            <em>{Math.min(trainerNotificationCount, 99)}</em>
          )}
        </button>
      )}

      {!isMainDashboard && renderBottomBar("cabinet")}
      {isMainDashboard && renderBottomBar("main")}

      {isMainDashboard && <h1 className="mainDashboardTitle clientCorePageTitle">Главное меню</h1>}
    </>
  );
}
