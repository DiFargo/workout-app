import styles from "./ProfileSettingsModal.module.css";

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

export function ProfileSettingsLogoutButton({ onClick }) {
  return (
    <button
      className={styles.logoutButton}
      data-testid="profile-settings-logout"
      type="button"
      onClick={onClick}
    >
      Выйти из аккаунта
    </button>
  );
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

  const sectionClass = section === "account"
    ? styles.accountCompact
    : section === "profile"
      ? styles.profileCompact
      : styles.compact;

  return (
    <div
      className={styles.overlay}
      data-testid="profile-settings-overlay"
      data-css-module-scope="profile-settings"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={`${styles.dialog} ${sectionClass}`}
        data-testid="profile-settings-dialog"
        data-profile-settings-section={section}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetSettingsModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ЛИЧНЫЙ КАБИНЕТ</span>
            <h2 className={styles.title} id="cabinetSettingsModalTitle">
              {getProfileSettingsModalTitle(section)}
            </h2>
          </div>
          <button
            className={styles.closeButton}
            data-testid="profile-settings-close"
            type="button"
            aria-label={`Закрыть ${getProfileSettingsCloseLabel(section)}`}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {children}
        </div>
      </section>
    </div>
  );
}
