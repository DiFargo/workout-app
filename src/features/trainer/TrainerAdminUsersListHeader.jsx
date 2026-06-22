const CLIENT_FILTERS = [
  ["all", "Все"],
  ["active", "Активные"],
  ["attention", "Внимание"]
];

export default function TrainerAdminUsersListHeader({
  adminClientFilter,
  setAdminClientFilter
}) {
  return (
    <>
      <header className="adminUsersCrmHeader">
        <div>
          <span>CLIENT MANAGEMENT</span>
          <h1>Клиенты</h1>
          <p>Создание клиентов, карточки, программы, питание, история и заметки.</p>
        </div>

        <div className="adminUsersTopActions">
        </div>
      </header>

      <section className="adminUsersFilterPills" aria-label="Фильтр клиентов">
        {CLIENT_FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
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
