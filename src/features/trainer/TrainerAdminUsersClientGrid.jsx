export default function TrainerAdminUsersClientGrid({
  adminUsersFilteredClients,
  adminUsersSearch,
  formatTrainerSummaryDate,
  getAdminClientGoalLabel,
  getAdminClientProfile,
  getClientActivityStatus,
  getClientCardSummary,
  loadAdminClientOverview,
  selectedClient,
  setAdminCreateClientModalOpen,
  setAdminUsersSearch
}) {
  return (
    <section className="adminUsersCrmGrid adminUsersCrmGridCardsOnly">
      <div className="adminUsersClientsPanel adminUsersClientsPanelFull">
        <div className="adminUsersToolbar">
          <div>
            <h2>Карточки клиентов</h2>
            <p>{adminUsersFilteredClients.length} клиентов</p>
          </div>

          <div className="adminUsersToolbarActions">
            <input
              value={adminUsersSearch}
              onChange={(event) => setAdminUsersSearch(event.target.value)}
              placeholder="Поиск клиента..."
            />
          </div>
        </div>

        <div className="adminClientCardsGrid adminClientCardsGridFive">
          {adminUsersFilteredClients.map((client) => {
            const profile = getAdminClientProfile(client);
            const active = selectedClient?.id === client.id;
            const summary = getClientCardSummary(client);
            const status = getClientActivityStatus(summary);
            const completionText = summary.programCompletionPercent === null
              ? "Программа —"
              : `Программа ${summary.programCompletionPercent}%`;

            return (
              <button
                key={client.id}
                type="button"
                className={active ? "adminClientCard adminClientCardRect adminClientCardWide active" : "adminClientCard adminClientCardRect adminClientCardWide"}
                aria-pressed={active}
                onClick={() => loadAdminClientOverview(client, true)}
              >
                <span className="adminClientAvatar">👤</span>

                <div className="adminClientCardMain">
                  <span className="trainerClientNameRow">
                    <strong>{client.name || client.email || "Клиент"}</strong>
                    <span className={`trainerClientStatusBadge ${status.id}`}>{status.label}</span>
                  </span>
                  <small>{client.email || client.id}</small>
                </div>

                <em>{getAdminClientGoalLabel(profile.goal)}</em>

                <span className="trainerClientMiniStats adminClientSummaryStats">
                  <span>Тренировка {formatTrainerSummaryDate(summary.lastWorkoutAt)}</span>
                  <span>{completionText}</span>
                  <span>
                    Питание {summary.nutritionDays7}/7
                    {summary.averageCalories7 ? ` · ${summary.averageCalories7} ккал` : ""}
                  </span>
                  <span>Замер {formatTrainerSummaryDate(summary.lastMeasurementAt)}</span>
                </span>

                <div className="adminClientCardBottom">
                  <i>{active ? "Открыт" : "Открыть"}</i>
                  <b>{client.role === "trainer" ? "🟣 тренер" : active ? "🟢 активен" : "⚪ клиент"}</b>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            className="adminClientCard adminClientCardRect adminClientAddCard"
            onClick={() => setAdminCreateClientModalOpen(true)}
          >
            <span className="adminClientAddIcon">＋</span>
            <div>
              <strong>Добавить клиента</strong>
              <small>Создать логин и пароль</small>
            </div>
            <em>Новый клиент</em>
            <i>Создать</i>
          </button>

          {!adminUsersFilteredClients.length && <p className="adminV3Empty">Нет клиентов под этот фильтр.</p>}
        </div>
      </div>
    </section>
  );
}
