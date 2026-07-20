import { ProfileWorkoutCalendarContent } from "./ProfileWorkoutCalendarModal";
import { ProfileWorkoutHistoryContent } from "./ProfileWorkoutHistoryModal";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./ProfileWorkoutJournalModal.module.css";

export default function ProfileWorkoutJournalModal({
  open,
  activeTab = "calendar",
  modalBodyRef,
  calendarProps,
  historyProps,
  onClose,
  onTabChange
}) {
  if (!open) {
    return null;
  }

  const isHistory = activeTab === "history";

  return (
    <div
      className={styles.overlay}
      data-testid="profile-workout-journal-overlay"
      data-css-module-scope="profile-workout-journal"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={styles.dialog}
        data-testid="profile-workout-journal-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="cabinetWorkoutJournalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          className={styles.header}
          title="Тренировки"
          titleId="cabinetWorkoutJournalTitle"
          eyebrow="Календарь и история"
          onBack={onClose}
          backTestId="profile-workout-journal-close"
          backAriaLabel="Вернуться в кабинет"
          scope="profile-workout-journal-header"
        />

        <div className={styles.tabs} role="tablist" aria-label="Раздел тренировок">
          <button
            type="button"
            role="tab"
            aria-selected={!isHistory}
            className={`${styles.tab} ${!isHistory ? styles.activeTab : ""}`}
            onClick={() => onTabChange("calendar")}
          >
            Календарь
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isHistory}
            className={`${styles.tab} ${isHistory ? styles.activeTab : ""}`}
            onClick={() => onTabChange("history")}
          >
            История
          </button>
        </div>

        <div className={styles.body} ref={modalBodyRef}>
          {!isHistory ? (
            <div className={styles.panel} role="tabpanel" aria-label="Календарь тренировок">
              <ProfileWorkoutCalendarContent {...calendarProps} />
            </div>
          ) : (
            <div className={`${styles.panel} ${styles.historyPanel}`} role="tabpanel" aria-label="История тренировок">
              <ProfileWorkoutHistoryContent embedded {...historyProps} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
