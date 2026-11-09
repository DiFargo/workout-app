import { RefreshCw } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./ProfileCabinetTitleRow.module.css";
import { useState } from "react";
import { Settings2 } from "../../../shared/ui/ClientReferenceIcon.jsx";
import ClientAppearanceSheet from "../appearance/ClientAppearanceSheet.jsx";

export default function ProfileCabinetTitleRow({
  onRefresh,
  clientAppearance = false
}) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  return (
    <><ClientPageHeader
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
          className={styles.refresh}
          data-testid="profile-cabinet-refresh"
          aria-label={clientAppearance ? "Оформление приложения" : "Обновить данные"}
          title={clientAppearance ? "Оформление приложения" : "Обновить данные"}
          onClick={clientAppearance ? () => setAppearanceOpen(true) : onRefresh}
        >
          {clientAppearance ? <Settings2 /> : <RefreshCw aria-hidden="true" />}
        </button>
      )}
    />{appearanceOpen && <ClientAppearanceSheet onClose={() => setAppearanceOpen(false)} onRefresh={onRefresh} />}</>
  );
}
