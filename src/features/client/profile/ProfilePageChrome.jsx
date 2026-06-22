export default function ProfilePageChrome({
  showVersion,
  appVersion,
  isMainDashboard,
  renderBottomBar,
  onRefresh
}) {
  return (
    <>
      {showVersion && (
        <div className="appVersionBadge clientPageVersionBadge">{appVersion}</div>
      )}

      {isMainDashboard && (
        <button
          type="button"
          className="menuRefreshIconBtn"
          onClick={onRefresh}
          aria-label="Обновить страницу"
          title="Обновить страницу"
        >
          🔄
        </button>
      )}

      {!isMainDashboard && renderBottomBar("cabinet")}
      {isMainDashboard && renderBottomBar("main")}

      {isMainDashboard && <h1 className="mainDashboardTitle clientCorePageTitle">Главное меню</h1>}
    </>
  );
}
