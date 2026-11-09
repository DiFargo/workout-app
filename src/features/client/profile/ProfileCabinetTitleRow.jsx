import { LogOut, RefreshCw } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./ProfileCabinetTitleRow.module.css";
import { useEffect, useRef, useState } from "react";
import { showAppConfirm } from "../../../utils/appFeedback.js";

export default function ProfileCabinetTitleRow({
  onRefresh,
  onLogout,
  clientAppearance = false
}) {
  const [logoutPending, setLogoutPending] = useState(false);
  const logoutButtonRef = useRef(null);
  useEffect(() => {
    if (logoutPending) return;
    const button = logoutButtonRef.current;
    logoutButtonRef.current = null;
    if (button?.isConnected) button.focus({ preventScroll: true });
  }, [logoutPending]);
  const handleLogout = async (event) => {
    logoutButtonRef.current = event.currentTarget;
    setLogoutPending(true);
    try {
      const confirmed = await showAppConfirm({
        title: "Выйти из аккаунта?",
        text: "Вы завершите текущий сеанс. Чтобы вернуться, войдите в аккаунт снова.",
        confirmText: "Выйти",
        cancelText: "Остаться"
      });
      if (confirmed) await onLogout?.();
    } finally {
      setLogoutPending(false);
    }
  };
  return (
    <ClientPageHeader
      title="Кабинет"
      titleAlign="start"
      primary
      titleTestId="profile-cabinet-title"
      className={styles.root}
      scope="profile-cabinet-title-row"
      barTestId="profile-cabinet-title-row"
      actions={(
        <button
          type="button"
          className={`${styles.refresh}${clientAppearance ? ` ${styles.logout}` : ""}`}
          data-testid={clientAppearance ? "profile-cabinet-logout" : "profile-cabinet-refresh"}
          aria-label={clientAppearance ? "Выйти из аккаунта" : "Обновить данные"}
          title={clientAppearance ? "Выйти из аккаунта" : "Обновить данные"}
          disabled={clientAppearance && logoutPending}
          aria-busy={clientAppearance && logoutPending ? true : undefined}
          onClick={clientAppearance ? handleLogout : onRefresh}
        >
          {clientAppearance ? <LogOut aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
        </button>
      )}
    />
  );
}
