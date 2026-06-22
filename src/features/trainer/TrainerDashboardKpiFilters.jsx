export default function TrainerDashboardKpiFilters({
  adminClientFilter,
  attentionCount,
  averageAiScore,
  filteredUsers,
  openAdminClientsWithFilter,
  setAdminClientFilter,
  usersList
}) {
  return (
    <>
      <section className="adminV3KpiGrid">
        <button className="adminSummaryLink" type="button" onClick={() => openAdminClientsWithFilter("all")}><span>Клиенты</span><strong>{usersList.length}</strong><small>в базе</small></button>
        <button className="adminSummaryLink" type="button" onClick={() => openAdminClientsWithFilter("active")}><span>Активные</span><strong>{filteredUsers.length}</strong><small>по фильтру</small></button>
        <button className="adminSummaryLink" type="button" onClick={() => openAdminClientsWithFilter("attention")}><span>Требуют внимания</span><strong>{attentionCount}</strong><small>по выбранному</small></button>
        <div><span>Средний AI-score</span><strong>{averageAiScore}</strong><small>питание</small></div>
      </section>

      <section className="adminV3Filters">
        {[
          ["all", "Все"],
          ["active", "Активные"],
          ["attention", "Внимание"],
          ["inactive", "Давно не тренировались"],
          ["dry", "Сушка"],
          ["mass", "Набор"],
          ["cut", "Похудение"],
          ["maintain", "Поддержка"],
          ["recomp", "Рекомпозиция"]
        ].map(([id, label]) => (
          <button
            key={id}
            className={adminClientFilter === id ? "active" : ""}
            onClick={() => setAdminClientFilter(id)}
          >
            {label}
          </button>
        ))}
      </section>
    </>
  );
}
