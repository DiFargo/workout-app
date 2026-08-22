import { useEffect } from "react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileSettingsModal.module.css";

function useProfilePageScrollLock(locked) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") {
      return undefined;
    }

    // The cabinet page is its own scroll container, so locking body alone
    // still allowed it to move behind the profile sheet on mobile.
    const scrollHosts = Array.from(document.querySelectorAll(
      ".profileTabbedPage, .clientCorePageCabinet"
    ));
    const previousStyles = scrollHosts.map((host) => ({
      host,
      overflowY: host.style.overflowY,
      overscrollBehaviorY: host.style.overscrollBehaviorY,
      touchAction: host.style.touchAction
    }));

    scrollHosts.forEach((host) => {
      host.style.overflowY = "hidden";
      host.style.overscrollBehaviorY = "none";
      host.style.touchAction = "none";
    });

    return () => {
      previousStyles.forEach(({ host, overflowY, overscrollBehaviorY, touchAction }) => {
        host.style.overflowY = overflowY;
        host.style.overscrollBehaviorY = overscrollBehaviorY;
        host.style.touchAction = touchAction;
      });
    };
  }, [locked]);
}

function getProfileSettingsModalTitle(section) {
  if (section === "account") return "Профиль и настройки";
  if (section === "connections") return "Подключения";
  if (section === "profile") return "Анкета";
  if (section === "settings") return "Уведомления";
  return "Настройки";
}

function getProfileSettingsCloseLabel(section) {
  if (section === "account") return "аккаунт";
  if (section === "connections") return "подключения";
  if (section === "profile") return "профиль";
  if (section === "settings") return "уведомления";
  return "настройки";
}

export default function ProfileSettingsModal({
  open,
  section,
  onClose,
  children
}) {
  useProfilePageScrollLock(open);

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
        data-modal-surface="true"
        aria-labelledby="cabinetSettingsModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title={getProfileSettingsModalTitle(section)}
          titleId="cabinetSettingsModalTitle"
          eyebrow="Личный кабинет"
          actions={(
            <ProfileModalCloseButton
              testId="profile-settings-close"
              ariaLabel={`Закрыть раздел «${getProfileSettingsCloseLabel(section)}»`}
              onClick={onClose}
            />
          )}
          scope="profile-settings-header"
        />

        <div className={styles.body}>
          {children}
        </div>
      </section>
    </div>
  );
}
