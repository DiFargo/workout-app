import { ProfileWorkoutCalendarContent } from "./ProfileWorkoutCalendarModal";
import { ProfileWorkoutHistoryContent } from "./ProfileWorkoutHistoryModal";

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
    <div className="cabinetUtilityModalOverlay" role="presentation" onClick={onClose}>
      <section
        className="cabinetUtilityModal cabinetWorkoutJournalModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetWorkoutJournalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cabinetUtilityModalHead cabinetWorkoutJournalHead">
          <div>
            <span>ТРЕНИРОВКИ</span>
            <h2 id="cabinetWorkoutJournalTitle">Календарь и история</h2>
          </div>
          <button type="button" aria-label="Закрыть календарь и историю тренировок" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="cabinetWorkoutJournalTabs" role="tablist" aria-label="Раздел тренировок">
          <button
            type="button"
            role="tab"
            aria-selected={!isHistory}
            className={!isHistory ? "active" : ""}
            onClick={() => onTabChange("calendar")}
          >
            Календарь
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isHistory}
            className={isHistory ? "active" : ""}
            onClick={() => onTabChange("history")}
          >
            История
          </button>
        </div>

        <div className="cabinetUtilityModalBody cabinetWorkoutJournalBody" ref={modalBodyRef}>
          {!isHistory ? (
            <div role="tabpanel" aria-label="Календарь тренировок">
              <ProfileWorkoutCalendarContent {...calendarProps} />
            </div>
          ) : (
            <div className="cabinetWorkoutJournalHistoryPanel" role="tabpanel" aria-label="История тренировок">
              <ProfileWorkoutHistoryContent {...historyProps} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
