function getProfileSettingsModalTitle(section) {
  if (section === "account") return "Профиль и настройки";
  if (section === "profile") return "Профиль";
  return "Настройки";
}

function getProfileSettingsCloseLabel(section) {
  if (section === "account") return "аккаунт";
  if (section === "profile") return "профиль";
  return "настройки";
}

export default function ProfileSettingsModal({
  open,
  section,
  onClose,
  children
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="cabinetUtilityModalOverlay" role="presentation" onClick={onClose}>
      <section
        className={`cabinetUtilityModal cabinetSettingsModal ${section === "settings" ? "compact" : ""} ${section === "account" ? "accountCompact" : ""} ${section === "profile" ? "profileCompact" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetSettingsModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cabinetUtilityModalHead">
          <div>
            <span>ЛИЧНЫЙ КАБИНЕТ</span>
            <h2 id="cabinetSettingsModalTitle">
              {getProfileSettingsModalTitle(section)}
            </h2>
          </div>
          <button
            type="button"
            aria-label={`Закрыть ${getProfileSettingsCloseLabel(section)}`}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="cabinetUtilityModalBody">
          {children}
        </div>
      </section>
    </div>
  );
}
