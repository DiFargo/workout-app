import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import { Bell } from "lucide-react";
import styles from "./ProfilePageChrome.module.css";

export default function ProfilePageChrome({
  isMainDashboard,
  activeTab = "cabinet",
  renderBottomBar,
  mainTitle = "Сегодня",
  showTrainerNotifications,
  trainerNotificationCount = 0,
  onOpenTrainerNotifications
}) {
  return (
    <>
      {!isMainDashboard && renderBottomBar(activeTab)}
      {isMainDashboard && renderBottomBar("main")}

      {isMainDashboard && (
        <ClientPageHeader
          className={styles.header}
          title={mainTitle}
          titleAlign="start"
          primary
          titleTestId="profile-main-title"
          testId="profile-main-header"
          scope="profile-page-chrome"
          actions={showTrainerNotifications ? <button type="button" className={styles.notificationButton} data-testid="profile-main-notifications" aria-label={trainerNotificationCount > 0 ? `Уведомления: ${trainerNotificationCount} новых` : "Уведомления"} onClick={onOpenTrainerNotifications}><Bell aria-hidden="true" /></button> : null}
        />
      )}

      {!isMainDashboard && activeTab === "progress" && (
        <ClientPageHeader
          className={styles.header}
          title="Прогресс"
          titleAlign="start"
          primary
          titleTestId="profile-progress-title"
          testId="profile-progress-header"
          scope="profile-page-chrome"
        />
      )}
    </>
  );
}
