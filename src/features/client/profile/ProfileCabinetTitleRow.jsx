import { RefreshCw } from "lucide-react";

export default function ProfileCabinetTitleRow({
  onRefresh
}) {
  return (
    <div className="profileCabinetTitleRow">
      <h1 className="profileCabinetPageTitle clientCorePageTitle">Личный кабинет</h1>
      <button
        type="button"
        className="profileTrainerNotificationsButton"
        aria-label="Обновить страницу"
        title="Обновить страницу"
        onClick={onRefresh}
      >
        <RefreshCw aria-hidden="true" />
      </button>
    </div>
  );
}
