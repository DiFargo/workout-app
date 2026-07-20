import { Bell } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
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
      {!isMainDashboard && renderBottomBar("cabinet")}
      {isMainDashboard && renderBottomBar("main")}

      {isMainDashboard && (
        <ClientPageHeader
          className={styles.header}
          title="Главная"
          titleTestId="profile-main-title"
          testId="profile-main-header"
          scope="profile-page-chrome"
          actions={showTrainerNotifications ? (
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
          ) : null}
        />
      )}
    </>
  );
}
