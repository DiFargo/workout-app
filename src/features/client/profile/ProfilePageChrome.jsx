import { Bell } from "lucide-react";
import styles from "./ProfilePageChrome.module.css";

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
          className={styles.notificationButton}
          data-css-module-scope="profile-page-chrome"
          data-testid="profile-main-notifications"
          onClick={onOpenTrainerNotifications}
          aria-label={`Уведомления тренера${trainerNotificationCount ? `: ${trainerNotificationCount}` : ""}`}
          title="Уведомления тренера"
        >
          <Bell aria-hidden="true" />
          {trainerNotificationCount > 0 && (
            <em className={styles.badge}>{Math.min(trainerNotificationCount, 99)}</em>
          )}
        </button>
      )}

      {!isMainDashboard && renderBottomBar("cabinet")}
      {isMainDashboard && renderBottomBar("main")}

      {isMainDashboard && (
        <h1
          className={styles.title}
          data-css-module-scope="profile-page-chrome"
          data-testid="profile-main-title"
        >
          Главная
        </h1>
      )}
    </>
  );
}
