import { RefreshCw } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./ProfileCabinetTitleRow.module.css";

export default function ProfileCabinetTitleRow({
  onRefresh
}) {
  return (
    <ClientPageHeader
      title="Кабинет"
      titleTestId="profile-cabinet-title"
      className={styles.root}
      scope="profile-cabinet-title-row"
      barTestId="profile-cabinet-title-row"
      actions={(
        <button
          type="button"
          className={styles.refresh}
          data-testid="profile-cabinet-refresh"
          aria-label="Обновить страницу"
          title="Обновить страницу"
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" />
        </button>
      )}
    />
  );
}
