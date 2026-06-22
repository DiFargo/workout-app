import TrainerAdminCalendarTab from "./TrainerAdminCalendarTab";
import TrainerAdminDangerZone from "./TrainerAdminDangerZone";
import TrainerAdminHistoryTab from "./TrainerAdminHistoryTab";
import TrainerAdminNotesTab from "./TrainerAdminNotesTab";
import TrainerAdminNutritionTab from "./TrainerAdminNutritionTab";
import TrainerAdminOverviewTab from "./TrainerAdminOverviewTab";
import TrainerAdminProgramTab from "./TrainerAdminProgramTab";
import TrainerAdminTrainingTab from "./TrainerAdminTrainingTab";
import TrainerAdminTransferTab from "./TrainerAdminTransferTab";
import TrainerDashboardAttentionSections from "./TrainerDashboardAttentionSections";
import TrainerDashboardGrid from "./TrainerDashboardGrid";
import TrainerDashboardKpiFilters from "./TrainerDashboardKpiFilters";

export default function TrainerLegacyDashboardRoute({
  ADMIN_CALENDAR_DAYS,
  ADMIN_EMAIL,
  APP_PAGES,
  adminAllUsersList,
  adminCalendarDraft,
  adminCalendarSaving,
  adminCalendarTesting,
  adminClientFilter,
  adminClientHistory,
  adminClientStatus,
  adminClientTab,
  adminCopyTargetUserId,
  adminDashboardDate,
  adminDeletingWorkoutId,
  adminGreetingName,
  adminSelectedHistoryIds,
  adminSelectedTemplateId,
  adminTemplateName,
  adminTrainerNote,
  adminTrainingTemplates,
  adminTransferFromUid,
  adminTransferLoading,
  adminTransferStatus,
  adminTransferToUid,
  aiWeek,
  assignAdminTemplateToClient,
  attentionCount,
  averageAiScore,
  clearClientProgram,
  clientNutritionDays,
  copyCurrentProgramToClient,
  createAdminTemplateFromCurrentPlan,
  deleteClientEverywhereFromAdminPanel,
  deleteSelectedAdminClientHistory,
  filteredUsers,
  formatTrainerSummaryDate,
  getAdminClientGoalLabel,
  getAdminClientProfile,
  getAdminClientTrainingDaysText,
  getAiNutritionActivityLabel,
  getClientTelegramProfile,
  getFoodIcon,
  loadAdminClientOverview,
  loadHistory,
  loadWorkoutsFromFirebase,
  maxCalories,
  maxProtein,
  maxWeight,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  recommendations,
  refreshPage,
  renderTrainerWorkspaceBottomBar,
  saveAdminClientCalendar,
  saveAdminTrainerNote,
  selectedClient,
  selectedProfile,
  sendAdminTestWorkoutReminder,
  setAdminCalendarDraft,
  setAdminClientFilter,
  setAdminClientTab,
  setAdminCopyTargetUserId,
  setAdminSelectedTemplateId,
  setAdminTemplateName,
  setAdminTrainerNote,
  setAdminTransferFromUid,
  setAdminTransferToUid,
  setPage,
  setProfileActiveTab,
  setSelectedUserId,
  toggleAdminCalendarDay,
  toggleAdminSelectAllHistory,
  toggleAdminSelectedHistoryId,
  transferClientDataBetweenAccounts,
  trainerAiFocusItems,
  trainerClientSummariesLoading,
  trainerProblemClients,
  trainerRecentEvents,
  trainerStatusCounts,
  updateAdminCalendarDaySetting,
  usersList,
  weightPoints,
  workoutProgress
}) {
  return (
    <div className="adminV3Shell">
      <button
        type="button"
        className="menuRefreshIconBtn trainerRefreshIconBtn"
        onClick={refreshPage}
        aria-label="Обновить страницу"
        title="Обновить страницу"
      >
        🔄
      </button>
      <aside className="adminV3Sidebar">
        <div className="adminV3Brand">
          <span>⚙️</span>
          <strong>Trainer CRM</strong>
          <small>Admin Panel v3</small>
        </div>

        {renderTrainerWorkspaceBottomBar("main", {
          onGoMain: () => {
            setSelectedUserId(null);
            setPage(APP_PAGES.ADMIN);
          },
          onOpenTrainerClients: () => openAdminClientsWithFilter("all"),
          onOpenTrainerPrograms: openAdminProgramsOverview,
          onLoadTrainerCabinet: () => {
            loadHistory();
            setProfileActiveTab("cabinet");
            setPage(APP_PAGES.PROFILE);
          }
        })}
      </aside>

      <main className="adminV3Main">
        <header className="adminV3Header">
          <div>
            <div className="adminDesktopBrandRow">
              <div className="adminDesktopBrandMark">
                <span aria-hidden="true">✦</span>
                <strong>TRAINER CONTROL CENTER</strong>
              </div>
            </div>

            <div className="adminDesktopHeroCopy">
              <h1>Добро пожаловать, {adminGreetingName}! 👋</h1>
              <p>Управляйте клиентами, тренировками и питанием в одном месте с AI-поддержкой.</p>
            </div>

            <div className="adminDesktopDate" aria-label={`Сегодня ${adminDashboardDate}`}>
              <span aria-hidden="true">▣</span>
              <strong>{adminDashboardDate}</strong>
            </div>

            <TrainerDashboardAttentionSections
              formatTrainerSummaryDate={formatTrainerSummaryDate}
              loadAdminClientOverview={loadAdminClientOverview}
              trainerAiFocusItems={trainerAiFocusItems}
              trainerClientSummariesLoading={trainerClientSummariesLoading}
              trainerProblemClients={trainerProblemClients}
              trainerRecentEvents={trainerRecentEvents}
              trainerStatusCounts={trainerStatusCounts}
            />
          </div>
        </header>

        <TrainerDashboardKpiFilters
          adminClientFilter={adminClientFilter}
          attentionCount={attentionCount}
          averageAiScore={averageAiScore}
          filteredUsers={filteredUsers}
          openAdminClientsWithFilter={openAdminClientsWithFilter}
          setAdminClientFilter={setAdminClientFilter}
          usersList={usersList}
        />

        <TrainerDashboardGrid
          attentionCount={attentionCount}
          averageAiScore={averageAiScore}
          filteredUsers={filteredUsers}
          getAdminClientGoalLabel={getAdminClientGoalLabel}
          getAdminClientProfile={getAdminClientProfile}
          loadAdminClientOverview={loadAdminClientOverview}
          recommendations={recommendations}
          selectedClient={selectedClient}
          setPage={setPage}
        />

        {selectedClient && (
          <section className="adminV3Workspace">
            <div className="adminV3WorkspaceHead">
              <div>
                <span>CLIENT WORKSPACE</span>
                <h2>{selectedClient.name || selectedClient.email || "Клиент"}</h2>
                <p>{selectedClient.email || selectedClient.id}</p>
              </div>

              <div className="adminV3WorkspaceActions" />
            </div>

            <div className="adminV3Tabs">
              {[
                ["overview", "Overview"],
                ["nutrition", "Питание"],
                ["training", "Тренировки"],
                ["calendar", "Календарь"],
                ["program", "Программа"],
                ["notes", "Заметки"],
                ["transfer", "Transfer"]
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={adminClientTab === id ? "active" : ""}
                  onClick={() => setAdminClientTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {adminClientTab === "overview" && (
              <TrainerAdminOverviewTab
                aiWeek={aiWeek}
                getAdminClientGoalLabel={getAdminClientGoalLabel}
                getAdminClientTrainingDaysText={getAdminClientTrainingDaysText}
                getAiNutritionActivityLabel={getAiNutritionActivityLabel}
                maxWeight={maxWeight}
                recommendations={recommendations}
                selectedProfile={selectedProfile}
                weightPoints={weightPoints}
              />
            )}

            {adminClientTab === "nutrition" && (
              <TrainerAdminNutritionTab
                clientNutritionDays={clientNutritionDays}
                getFoodIcon={getFoodIcon}
                maxCalories={maxCalories}
                maxProtein={maxProtein}
              />
            )}

            {adminClientTab === "training" && (
              <TrainerAdminTrainingTab workoutProgress={workoutProgress} />
            )}

            {adminClientTab === "history" && (
              <TrainerAdminHistoryTab
                adminClientHistory={adminClientHistory}
                adminDeletingWorkoutId={adminDeletingWorkoutId}
                adminSelectedHistoryIds={adminSelectedHistoryIds}
                deleteSelectedAdminClientHistory={deleteSelectedAdminClientHistory}
                selectedClient={selectedClient}
                toggleAdminSelectedHistoryId={toggleAdminSelectedHistoryId}
                toggleAdminSelectAllHistory={toggleAdminSelectAllHistory}
              />
            )}

            {adminClientTab === "program" && (
              <TrainerAdminProgramTab
                adminCopyTargetUserId={adminCopyTargetUserId}
                adminSelectedTemplateId={adminSelectedTemplateId}
                adminTemplateName={adminTemplateName}
                adminTrainingTemplates={adminTrainingTemplates}
                assignAdminTemplateToClient={assignAdminTemplateToClient}
                clearClientProgram={clearClientProgram}
                copyCurrentProgramToClient={copyCurrentProgramToClient}
                createAdminTemplateFromCurrentPlan={createAdminTemplateFromCurrentPlan}
                onOpenDesktopEditor={() => {
                  setSelectedUserId(selectedClient.id);
                  loadWorkoutsFromFirebase(selectedClient.id);
                  setPage(APP_PAGES.ADMIN_WORKOUTS);
                }}
                selectedClient={selectedClient}
                setAdminCopyTargetUserId={setAdminCopyTargetUserId}
                setAdminSelectedTemplateId={setAdminSelectedTemplateId}
                setAdminTemplateName={setAdminTemplateName}
                usersList={usersList}
              />
            )}

            {adminClientTab === "calendar" && (
              <TrainerAdminCalendarTab
                adminCalendarDays={ADMIN_CALENDAR_DAYS}
                adminCalendarDraft={adminCalendarDraft}
                adminCalendarSaving={adminCalendarSaving}
                adminCalendarTesting={adminCalendarTesting}
                getClientTelegramProfile={getClientTelegramProfile}
                saveAdminClientCalendar={saveAdminClientCalendar}
                selectedClient={selectedClient}
                sendAdminTestWorkoutReminder={sendAdminTestWorkoutReminder}
                setAdminCalendarDraft={setAdminCalendarDraft}
                toggleAdminCalendarDay={toggleAdminCalendarDay}
                updateAdminCalendarDaySetting={updateAdminCalendarDaySetting}
              />
            )}

            {adminClientTab === "notes" && (
              <TrainerAdminNotesTab
                adminTrainerNote={adminTrainerNote}
                saveAdminTrainerNote={saveAdminTrainerNote}
                setAdminTrainerNote={setAdminTrainerNote}
              />
            )}

            {adminClientTab === "transfer" && (
              <TrainerAdminTransferTab
                ADMIN_EMAIL={ADMIN_EMAIL}
                adminAllUsersList={adminAllUsersList}
                adminTransferFromUid={adminTransferFromUid}
                adminTransferLoading={adminTransferLoading}
                adminTransferStatus={adminTransferStatus}
                adminTransferToUid={adminTransferToUid}
                setAdminTransferFromUid={setAdminTransferFromUid}
                setAdminTransferToUid={setAdminTransferToUid}
                transferClientDataBetweenAccounts={transferClientDataBetweenAccounts}
                usersList={usersList}
              />
            )}

            <TrainerAdminDangerZone
              onDeleteClient={deleteClientEverywhereFromAdminPanel}
              selectedClient={selectedClient}
            />

            {adminClientStatus && <p className="adminV3Status">{adminClientStatus}</p>}
          </section>
        )}
      </main>
    </div>
  );
}
