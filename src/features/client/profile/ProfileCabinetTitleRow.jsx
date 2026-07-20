import { RefreshCw } from "lucide-react";
import styles from "./ProfileCabinetTitleRow.module.css";

export default function ProfileCabinetTitleRow({
  onRefresh
}) {
  return (
    <div
      className={styles.root}
      data-css-module-scope="profile-cabinet-title-row"
      data-testid="profile-cabinet-title-row"
    >
      <h1 className={styles.title} data-testid="profile-cabinet-title">Кабинет</h1>
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
    </div>
  );
}
