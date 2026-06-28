import { APP_PAGES } from "../../app/appPages";

export default function TrainerDashboardGrid({
  attentionCount,
  averageAiScore,
  filteredUsers,
  getAdminClientGoalLabel,
  getAdminClientProfile,
  loadAdminClientOverview,
  recommendations,
  selectedClient,
  setPage
}) {
  return (
    <section className="adminV3DashboardGrid">
      <div className="adminV3Panel adminV3ClientsPanel">
        <div className="adminV3PanelHead">
          <div>
            <h2>Клиенты</h2>
            <p>Выбери клиента, чтобы открыть workspace.</p>
          </div>
          <button onClick={() => setPage(APP_PAGES.ADMIN_USERS)}>Создать</button>
        </div>

        <div className="adminV3ClientTable">
          <div className="adminV3ClientTableHead">
            <span>Клиент</span>
            <span>Твоя цель</span>
            <span>Анализ прогресса</span>
            <span>Статус</span>
          </div>

          {filteredUsers.map((client) => {
            const profile = getAdminClientProfile(client);
            const isActive = selectedClient?.id === client.id;

            return (
              <button
                key={client.id}
                type="button"
                className={isActive ? "active" : ""}
                aria-pressed={isActive}
                onClick={() => loadAdminClientOverview(client, true)}
              >
                <span>
                  <strong>{client.name || client.email || "Клиент"}</strong>
                  <small>{client.email || client.id}</small>
                </span>
                <em>{getAdminClientGoalLabel(profile.goal)}</em>
                <em>{isActive ? averageAiScore : "—"}</em>
                <i>{isActive && attentionCount > 0 ? "Внимание" : "OK"}</i>
              </button>
            );
          })}

          {!filteredUsers.length && <p className="adminV3Empty">Нет клиентов под этот фильтр.</p>}
        </div>
      </div>

      <div className="adminV3Panel adminV3AlertsPanel">
        <div className="adminV3PanelHead">
          <div>
            <h2>AI Alerts</h2>
            <p>Главные сигналы по выбранному клиенту.</p>
          </div>
        </div>

        <div className="adminV3Alerts">
          {recommendations.slice(0, 5).map((item) => (
            <div key={item}>
              <span>✨</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
