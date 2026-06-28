const CLIENT_WORKSPACE_TABS = [
  ["overview", "👤", "Обзор"],
  ["training", "📋", "Программа"],
  ["calendarNutrition", "🗓️", "Календарь"],
  ["telegram", "💬", "Telegram"]
];

function scrollAdminClientWorkspaceTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.querySelector(".adminUsersCrmMain")?.scrollTo?.({ top: 0, left: 0, behavior: "smooth" });
  });
}

export default function TrainerAdminClientWorkspaceHeader({
  ADMIN_EMAIL,
  adminUsersSelectedTab,
  canUseAdminFeatures,
  deleteClientEverywhereFromAdminPanel,
  formatTrainerSummaryDate,
  getAdminClientGoalLabel,
  getAdminClientInitials,
  selectedClient,
  selectedProfile,
  selectedSummary,
  selectedTelegramProfile,
  selectedTrainerName,
  selectedWorkoutDays,
  setAdminClientPageOpen,
  setAdminUsersSelectedTab,
  updateUserTrainerRole
}) {
  return (
    <>
      <div className="adminClientRenderTopbar">
        <button
          type="button"
          className="adminClientBackToList"
          onClick={() => setAdminClientPageOpen(false)}
        >
          ← К списку клиентов
        </button>
        <button
          type="button"
          className="adminClientDesktopDelete"
          onClick={() => deleteClientEverywhereFromAdminPanel(selectedClient)}
        >
          Удалить клиента
        </button>
      </div>

      <div className="adminClientWorkspaceHeader adminClientWorkspaceHeaderRender trainerClientHero">
        <div className="trainerClientHeroIdentity">
          <div className="adminClientInitialsRender trainerClientHeroAvatar">
            {selectedTelegramProfile.avatarUrl ? (
              <img src={selectedTelegramProfile.avatarUrl} alt="" />
            ) : (
              getAdminClientInitials(selectedClient)
            )}
          </div>

          <div className="trainerClientHeroCopy">
            <div className="trainerClientHeroNameRow">
              <h2>{selectedClient.name || selectedClient.email || "Клиент"}</h2>
              <span className="adminClientStatusRender"><i /> {selectedClient.role === "trainer" ? "Тренер" : "Активен"}</span>
            </div>
            <p>
              {[selectedProfile?.age ? `${selectedProfile.age} лет` : "", selectedProfile?.city || selectedClient?.city || ""].filter(Boolean).join(" · ") || selectedClient.email || selectedClient.id}
            </p>
            <strong>Цель: {getAdminClientGoalLabel(selectedProfile?.goal)}</strong>
            <small>{selectedClient.goalDescription || "Персональный план тренировок и питания"}</small>
          </div>
        </div>

        <div className="trainerClientHeroMeta">
          <div>
            <span>Последняя активность</span>
            <strong>{selectedWorkoutDays === 0 ? "Сегодня" : formatTrainerSummaryDate(selectedSummary.lastWorkoutAt)}</strong>
            <small>Тренировка</small>
          </div>
          <div>
            <span>Telegram</span>
            <strong>{selectedTelegramProfile.connected ? "Подключен" : "Не подключен"}</strong>
            <small>{selectedTelegramProfile.connected ? `@${selectedTelegramProfile.username || "telegram"}` : "Нет связи"}</small>
          </div>
          <div>
            <span>Тренер</span>
            <strong>{selectedTrainerName}</strong>
            <small>{selectedClient.assignedTrainerAt ? `С ${formatTrainerSummaryDate(selectedClient.assignedTrainerAt)}` : "Персональное ведение"}</small>
          </div>
        </div>

        {canUseAdminFeatures() && selectedClient.email !== ADMIN_EMAIL && (
          <button
            type="button"
            className={selectedClient.role === "trainer" ? "adminTrainerRoleButton active" : "adminTrainerRoleButton"}
            aria-pressed={selectedClient.role === "trainer"}
            onClick={() => updateUserTrainerRole(selectedClient, selectedClient.role !== "trainer")}
          >
            {selectedClient.role === "trainer" ? "Убрать тренера" : "Назначить тренером"}
          </button>
        )}
      </div>

      <div className="adminClientTabsCrm adminClientTabsFoodBar" role="tablist" aria-label="Меню клиента">
        {CLIENT_WORKSPACE_TABS.map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className={adminUsersSelectedTab === id ? "active" : ""}
            aria-pressed={adminUsersSelectedTab === id}
            onClick={() => {
              setAdminUsersSelectedTab(id);
              scrollAdminClientWorkspaceTop();
            }}
          >
            <span className="adminClientTabIcon">{icon}</span>
            <span className="adminClientTabLabel">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
