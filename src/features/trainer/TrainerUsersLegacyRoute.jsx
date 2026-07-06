import TrainerAdminClientWorkspaceHeader from "./TrainerAdminClientWorkspaceHeader";
import TrainerAdminCreateClientModal from "./TrainerAdminCreateClientModal";
import TrainerAdminUsersClientGrid from "./TrainerAdminUsersClientGrid";
import TrainerAdminUsersListHeader from "./TrainerAdminUsersListHeader";
import TrainerClientCalendarNutritionTab from "./TrainerClientCalendarNutritionTab";
import TrainerClientOverviewAdminTools from "./TrainerClientOverviewAdminTools";
import TrainerClientOverviewLegacyDetails from "./TrainerClientOverviewLegacyDetails";
import TrainerClientOverviewModals from "./TrainerClientOverviewModals";
import TrainerClientOverviewPhotosTasks from "./TrainerClientOverviewPhotosTasks";
import TrainerClientOverviewPlanNutrition from "./TrainerClientOverviewPlanNutrition";
import TrainerClientOverviewSummary from "./TrainerClientOverviewSummary";
import TrainerClientTelegramTab from "./TrainerClientTelegramTab";
import TrainerClientTrainingTab from "./TrainerClientTrainingTab";

export default function TrainerUsersLegacyRoute({
  ADMIN_CALENDAR_DAYS,
  ADMIN_EMAIL,
  APP_PAGES,
  adminAllUsersList,
  adminCalendarDraft,
  adminCalendarSaving,
  adminCalendarTesting,
  adminClientEvents,
  adminClientHistory,
  adminClientMeasurements,
  adminClientPageOpen,
  adminClientProgressPhotos,
  adminClientStatus,
  adminClientTasks,
  adminCreateClientModalOpen,
  adminCreateUserLoading,
  adminCreateUserStatus,
  adminCreatedCredentials,
  adminClientFilter,
  adminMeasurementPreviewFields,
  adminNewTaskDueDate,
  adminNewTaskTitle,
  adminNewUserEmail,
  adminNewUserName,
  adminNewUserPassword,
  adminPaymentDraft,
  adminPhotoCompareIds,
  adminPhotoCompareOpen,
  adminProgressPhotoComment,
  adminProgressPhotoDate,
  adminProgressPhotoFiles,
  adminProgressPhotoUploading,
  adminProgramControlOpen,
  adminSelectedNutritionPreset,
  adminSelectedTemplateId,
  adminTaskComposerOpen,
  adminTelegramMessage,
  adminTelegramSending,
  adminTrainerNote,
  adminTrainingTemplates,
  adminTransferFromUid,
  adminTransferLoading,
  adminTransferStatus,
  adminTransferToUid,
  adminUsersFilteredClients,
  adminUsersSearch,
  adminUsersSelectedTab,
  aiWeek,
  assignSavedProgramToClient,
  canUseAdminFeatures,
  clearClientProgram,
  clientNutritionDays,
  createAdminClientTask,
  createUserFromAdminPanel,
  credentialsText,
  currentMonthTrainingDays,
  dailyCalorieGoal,
  dailyCarbsGoal,
  dailyFatGoal,
  dailyProteinGoal,
  deleteAdminClientTask,
  deleteClientEverywhereFromAdminPanel,
  formatProfileMeasurementDate,
  formatTrainerSummaryDate,
  generateAdminPassword,
  getActiveTrainerTasksCount,
  getAdminCalendarDayIdFromDate,
  getAdminClientGoalLabel,
  getAdminClientInitials,
  getAdminClientProfile,
  getAdminClientTrainingDaysText,
  getAdminNutritionDayMetrics,
  getAiNutritionActivityLabel,
  getClientActivityStatus,
  getClientCardSummary,
  getClientTelegramProfile,
  getProfileMeasurementValue,
  getTrainerDayWord,
  getTrainerSummaryTimestamp,
  getTrainerTaskStatus,
  hasAdminWorkoutOnDate,
  lastWorkout,
  loadAdminClientOverview,
  loadHistory,
  loadWorkoutsFromFirebase,
  nutritionMonthAverageCalories,
  nutritionMonthAverageProtein,
  nutritionMonthDays,
  nutritionMonthLabel,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  openTelegramChat,
  recommendations,
  renderTrainerWorkspaceBottomBar,
  saveAdminClientCalendar,
  saveAdminClientPayment,
  saveAdminTrainerNote,
  saveTrainerClientNutritionPlan,
  selectedAssignedWorkouts,
  selectedAttentionItems,
  selectedClient,
  selectedCompletedWorkouts,
  selectedLatestMeasurement,
  selectedLatestPhoto,
  selectedMeasurementDays,
  selectedNutritionAverage,
  selectedNutritionCompliance,
  selectedNutritionDays7Complete,
  selectedPaymentAttention,
  selectedPhotoCompare,
  selectedPlateau,
  selectedPreviousMeasurement,
  selectedProfile,
  selectedProgramCompletion,
  selectedRecentActivity,
  selectedSummary,
  selectedTaskPreview,
  selectedTelegramProfile,
  selectedTrainerName,
  selectedWaistDelta,
  selectedWaistValue,
  selectedWeightDelta,
  selectedWeightValue,
  selectedWorkoutDays,
  sendAdminTestWorkoutReminder,
  sendAdminTelegramMessage,
  setAdminCalendarDraft,
  setAdminClientFilter,
  setAdminClientPageOpen,
  setAdminClientStatus,
  setAdminCreateClientModalOpen,
  setAdminNewTaskDueDate,
  setAdminNewTaskTitle,
  setAdminNewUserEmail,
  setAdminNewUserName,
  setAdminNewUserPassword,
  setAdminPaymentDraft,
  setAdminPhotoCompareIds,
  setAdminPhotoCompareOpen,
  setAdminProgressPhotoComment,
  setAdminProgressPhotoDate,
  setAdminProgressPhotoFiles,
  setAdminProgramControlOpen,
  setAdminSelectedClient,
  setAdminSelectedNutritionPreset,
  setAdminSelectedTemplateId,
  setAdminTaskComposerOpen,
  setAdminTelegramMessage,
  setAdminTrainerNote,
  setAdminTransferFromUid,
  setAdminTransferToUid,
  setAdminUsersSearch,
  setAdminUsersSelectedTab,
  setPage,
  setProfileActiveTab,
  setSelectedUserId,
  setUsersList,
  toggleAdminCalendarDay,
  toggleClientTelegramNotifications,
  trainerAiRecommendations,
  transferClientDataBetweenAccounts,
  updateAdminCalendarDaySetting,
  updateAdminClientTask,
  updateUserTrainerRole,
  uploadAdminProgressPhotos,
  usersList,
  workoutProgress
}) {
  return (
    <div className="adminUsersCrmPage">
      <main className={adminClientPageOpen ? "adminUsersCrmMain adminUsersCrmMainClientPage" : "adminUsersCrmMain"}>
        {!adminClientPageOpen && (
          <TrainerAdminUsersListHeader
            adminClientFilter={adminClientFilter}
            setAdminClientFilter={setAdminClientFilter}
          />
        )}

        {!adminClientPageOpen && (
          <TrainerAdminUsersClientGrid
            adminUsersFilteredClients={adminUsersFilteredClients}
            adminUsersSearch={adminUsersSearch}
            formatTrainerSummaryDate={formatTrainerSummaryDate}
            getAdminClientGoalLabel={getAdminClientGoalLabel}
            getAdminClientProfile={getAdminClientProfile}
            getClientActivityStatus={getClientActivityStatus}
            getClientCardSummary={getClientCardSummary}
            loadAdminClientOverview={loadAdminClientOverview}
            selectedClient={selectedClient}
            setAdminCreateClientModalOpen={setAdminCreateClientModalOpen}
            setAdminUsersSearch={setAdminUsersSearch}
          />
        )}

        {adminCreateClientModalOpen && (
          <TrainerAdminCreateClientModal
            adminCreateUserLoading={adminCreateUserLoading}
            adminCreateUserStatus={adminCreateUserStatus}
            adminCreatedCredentials={adminCreatedCredentials}
            adminNewUserEmail={adminNewUserEmail}
            adminNewUserName={adminNewUserName}
            adminNewUserPassword={adminNewUserPassword}
            createUserFromAdminPanel={createUserFromAdminPanel}
            credentialsText={credentialsText}
            generateAdminPassword={generateAdminPassword}
            setAdminCreateClientModalOpen={setAdminCreateClientModalOpen}
            setAdminNewUserEmail={setAdminNewUserEmail}
            setAdminNewUserName={setAdminNewUserName}
            setAdminNewUserPassword={setAdminNewUserPassword}
          />
        )}

        {adminClientPageOpen && selectedClient && (
          <section className="adminClientWorkspaceCrm adminClientWorkspaceCrmPage">
            <TrainerAdminClientWorkspaceHeader
              ADMIN_EMAIL={ADMIN_EMAIL}
              adminUsersSelectedTab={adminUsersSelectedTab}
              canUseAdminFeatures={canUseAdminFeatures}
              deleteClientEverywhereFromAdminPanel={deleteClientEverywhereFromAdminPanel}
              formatTrainerSummaryDate={formatTrainerSummaryDate}
              getAdminClientGoalLabel={getAdminClientGoalLabel}
              getAdminClientInitials={getAdminClientInitials}
              selectedClient={selectedClient}
              selectedProfile={selectedProfile}
              selectedSummary={selectedSummary}
              selectedTelegramProfile={selectedTelegramProfile}
              selectedTrainerName={selectedTrainerName}
              selectedWorkoutDays={selectedWorkoutDays}
              setAdminClientPageOpen={setAdminClientPageOpen}
              setAdminUsersSelectedTab={setAdminUsersSelectedTab}
              updateUserTrainerRole={updateUserTrainerRole}
            />

            {adminUsersSelectedTab === "overview" && (
              <div className="adminClientTabContent adminClientTabContentRender">
                <div className="trainerClientDashboardOverview">
                  <TrainerClientOverviewSummary
                    dailyCalorieGoal={dailyCalorieGoal}
                    formatProfileMeasurementDate={formatProfileMeasurementDate}
                    getTrainerDayWord={getTrainerDayWord}
                    selectedAttentionItems={selectedAttentionItems}
                    selectedLatestMeasurement={selectedLatestMeasurement}
                    selectedMeasurementDays={selectedMeasurementDays}
                    selectedNutritionAverage={selectedNutritionAverage}
                    selectedNutritionCompliance={selectedNutritionCompliance}
                    selectedSummary={selectedSummary}
                    selectedWaistDelta={selectedWaistDelta}
                    selectedWaistValue={selectedWaistValue}
                    selectedWeightDelta={selectedWeightDelta}
                    selectedWeightValue={selectedWeightValue}
                  />

                  <TrainerClientOverviewPhotosTasks
                    adminClientProgressPhotos={adminClientProgressPhotos}
                    adminClientTasks={adminClientTasks}
                    adminProgressPhotoComment={adminProgressPhotoComment}
                    adminProgressPhotoDate={adminProgressPhotoDate}
                    adminProgressPhotoFiles={adminProgressPhotoFiles}
                    adminProgressPhotoUploading={adminProgressPhotoUploading}
                    formatTrainerSummaryDate={formatTrainerSummaryDate}
                    selectedLatestPhoto={selectedLatestPhoto}
                    selectedTaskPreview={selectedTaskPreview}
                    setAdminPhotoCompareOpen={setAdminPhotoCompareOpen}
                    setAdminProgressPhotoComment={setAdminProgressPhotoComment}
                    setAdminProgressPhotoDate={setAdminProgressPhotoDate}
                    setAdminProgressPhotoFiles={setAdminProgressPhotoFiles}
                    setAdminTaskComposerOpen={setAdminTaskComposerOpen}
                    updateAdminClientTask={updateAdminClientTask}
                    uploadAdminProgressPhotos={uploadAdminProgressPhotos}
                  />

                  <TrainerClientOverviewPlanNutrition
                    adminPaymentDraft={adminPaymentDraft}
                    adminTrainerNote={adminTrainerNote}
                    dailyCalorieGoal={dailyCalorieGoal}
                    dailyCarbsGoal={dailyCarbsGoal}
                    dailyFatGoal={dailyFatGoal}
                    dailyProteinGoal={dailyProteinGoal}
                    formatTrainerSummaryDate={formatTrainerSummaryDate}
                    saveAdminTrainerNote={saveAdminTrainerNote}
                    selectedAssignedWorkouts={selectedAssignedWorkouts}
                    selectedClient={selectedClient}
                    selectedCompletedWorkouts={selectedCompletedWorkouts}
                    selectedNutritionAverage={selectedNutritionAverage}
                    selectedNutritionCompliance={selectedNutritionCompliance}
                    selectedNutritionDays7Complete={selectedNutritionDays7Complete}
                    selectedPaymentAttention={selectedPaymentAttention}
                    selectedProgramCompletion={selectedProgramCompletion}
                    selectedRecentActivity={selectedRecentActivity}
                    setAdminProgramControlOpen={setAdminProgramControlOpen}
                    setAdminTrainerNote={setAdminTrainerNote}
                    setAdminUsersSelectedTab={setAdminUsersSelectedTab}
                    trainerAiRecommendations={trainerAiRecommendations}
                  />

                  <TrainerClientOverviewModals
                    adminClientProgressPhotos={adminClientProgressPhotos}
                    adminNewTaskDueDate={adminNewTaskDueDate}
                    adminNewTaskTitle={adminNewTaskTitle}
                    adminPaymentDraft={adminPaymentDraft}
                    adminPhotoCompareIds={adminPhotoCompareIds}
                    adminPhotoCompareOpen={adminPhotoCompareOpen}
                    adminProgramControlOpen={adminProgramControlOpen}
                    adminTaskComposerOpen={adminTaskComposerOpen}
                    createAdminClientTask={createAdminClientTask}
                    formatTrainerSummaryDate={formatTrainerSummaryDate}
                    saveAdminClientPayment={saveAdminClientPayment}
                    selectedPhotoCompare={selectedPhotoCompare}
                    setAdminNewTaskDueDate={setAdminNewTaskDueDate}
                    setAdminNewTaskTitle={setAdminNewTaskTitle}
                    setAdminPaymentDraft={setAdminPaymentDraft}
                    setAdminPhotoCompareIds={setAdminPhotoCompareIds}
                    setAdminPhotoCompareOpen={setAdminPhotoCompareOpen}
                    setAdminProgramControlOpen={setAdminProgramControlOpen}
                    setAdminTaskComposerOpen={setAdminTaskComposerOpen}
                  />
                </div>

                <TrainerClientOverviewLegacyDetails
                  adminClientEvents={adminClientEvents}
                  adminClientHistory={adminClientHistory}
                  adminClientMeasurements={adminClientMeasurements}
                  adminClientProgressPhotos={adminClientProgressPhotos}
                  adminClientTasks={adminClientTasks}
                  adminMeasurementPreviewFields={adminMeasurementPreviewFields}
                  adminNewTaskDueDate={adminNewTaskDueDate}
                  adminNewTaskTitle={adminNewTaskTitle}
                  adminPaymentDraft={adminPaymentDraft}
                  adminPhotoCompareIds={adminPhotoCompareIds}
                  adminProgressPhotoComment={adminProgressPhotoComment}
                  adminProgressPhotoDate={adminProgressPhotoDate}
                  adminProgressPhotoFiles={adminProgressPhotoFiles}
                  adminProgressPhotoUploading={adminProgressPhotoUploading}
                  aiWeek={aiWeek}
                  clientNutritionDays={clientNutritionDays}
                  createAdminClientTask={createAdminClientTask}
                  currentMonthTrainingDays={currentMonthTrainingDays}
                  dailyCalorieGoal={dailyCalorieGoal}
                  dailyCarbsGoal={dailyCarbsGoal}
                  dailyFatGoal={dailyFatGoal}
                  dailyProteinGoal={dailyProteinGoal}
                  deleteAdminClientTask={deleteAdminClientTask}
                  formatProfileMeasurementDate={formatProfileMeasurementDate}
                  formatTrainerSummaryDate={formatTrainerSummaryDate}
                  getActiveTrainerTasksCount={getActiveTrainerTasksCount}
                  getAdminClientGoalLabel={getAdminClientGoalLabel}
                  getAdminClientTrainingDaysText={getAdminClientTrainingDaysText}
                  getAdminNutritionDayMetrics={getAdminNutritionDayMetrics}
                  getAiNutritionActivityLabel={getAiNutritionActivityLabel}
                  getClientTelegramProfile={getClientTelegramProfile}
                  getProfileMeasurementValue={getProfileMeasurementValue}
                  getTrainerSummaryTimestamp={getTrainerSummaryTimestamp}
                  getTrainerTaskStatus={getTrainerTaskStatus}
                  hasAdminWorkoutOnDate={hasAdminWorkoutOnDate}
                  lastWorkout={lastWorkout}
                  nutritionMonthAverageCalories={nutritionMonthAverageCalories}
                  nutritionMonthAverageProtein={nutritionMonthAverageProtein}
                  nutritionMonthDays={nutritionMonthDays}
                  nutritionMonthLabel={nutritionMonthLabel}
                  recommendations={recommendations}
                  saveAdminClientPayment={saveAdminClientPayment}
                  selectedClient={selectedClient}
                  selectedLatestMeasurement={selectedLatestMeasurement}
                  selectedPaymentAttention={selectedPaymentAttention}
                  selectedPhotoCompare={selectedPhotoCompare}
                  selectedPlateau={selectedPlateau}
                  selectedPreviousMeasurement={selectedPreviousMeasurement}
                  selectedProfile={selectedProfile}
                  setAdminNewTaskDueDate={setAdminNewTaskDueDate}
                  setAdminNewTaskTitle={setAdminNewTaskTitle}
                  setAdminPaymentDraft={setAdminPaymentDraft}
                  setAdminPhotoCompareIds={setAdminPhotoCompareIds}
                  setAdminProgressPhotoComment={setAdminProgressPhotoComment}
                  setAdminProgressPhotoDate={setAdminProgressPhotoDate}
                  setAdminProgressPhotoFiles={setAdminProgressPhotoFiles}
                  trainerAiRecommendations={trainerAiRecommendations}
                  updateAdminClientTask={updateAdminClientTask}
                  uploadAdminProgressPhotos={uploadAdminProgressPhotos}
                  workoutProgress={workoutProgress}
                />
              </div>
            )}

            {adminUsersSelectedTab === "training" && (
              <TrainerClientTrainingTab
                adminSelectedNutritionPreset={adminSelectedNutritionPreset}
                adminSelectedTemplateId={adminSelectedTemplateId}
                adminTrainingTemplates={adminTrainingTemplates}
                assignSavedProgramToClient={assignSavedProgramToClient}
                clearClientProgram={clearClientProgram}
                loadWorkoutsFromFirebase={loadWorkoutsFromFirebase}
                selectedClient={selectedClient}
                setAdminClientStatus={setAdminClientStatus}
                setAdminSelectedClient={setAdminSelectedClient}
                setAdminSelectedNutritionPreset={setAdminSelectedNutritionPreset}
                setAdminSelectedTemplateId={setAdminSelectedTemplateId}
                setPage={setPage}
                setSelectedUserId={setSelectedUserId}
                setUsersList={setUsersList}
                trainerWorkoutsPage={APP_PAGES.ADMIN_WORKOUTS}
                saveTrainerClientNutritionPlan={saveTrainerClientNutritionPlan}
              />
            )}

            {(adminUsersSelectedTab === "calendarNutrition" || adminUsersSelectedTab === "nutrition" || adminUsersSelectedTab === "calendar") && (
              <TrainerClientCalendarNutritionTab
                adminCalendarDays={ADMIN_CALENDAR_DAYS}
                adminCalendarDraft={adminCalendarDraft}
                adminCalendarSaving={adminCalendarSaving}
                adminCalendarTesting={adminCalendarTesting}
                currentMonthTrainingDays={currentMonthTrainingDays}
                getAdminCalendarDayIdFromDate={getAdminCalendarDayIdFromDate}
                getClientTelegramProfile={getClientTelegramProfile}
                nutritionMonthDays={nutritionMonthDays}
                nutritionMonthLabel={nutritionMonthLabel}
                saveAdminClientCalendar={saveAdminClientCalendar}
                selectedClient={selectedClient}
                sendAdminTestWorkoutReminder={sendAdminTestWorkoutReminder}
                setAdminCalendarDraft={setAdminCalendarDraft}
                toggleAdminCalendarDay={toggleAdminCalendarDay}
                updateAdminCalendarDaySetting={updateAdminCalendarDaySetting}
              />
            )}

            {adminUsersSelectedTab === "telegram" && (
              <TrainerClientTelegramTab
                adminTelegramMessage={adminTelegramMessage}
                adminTelegramSending={adminTelegramSending}
                getAdminClientInitials={getAdminClientInitials}
                getClientTelegramProfile={getClientTelegramProfile}
                openTelegramChat={openTelegramChat}
                selectedClient={selectedClient}
                sendAdminTelegramMessage={sendAdminTelegramMessage}
                setAdminTelegramMessage={setAdminTelegramMessage}
                setAdminUsersSelectedTab={setAdminUsersSelectedTab}
                toggleClientTelegramNotifications={toggleClientTelegramNotifications}
              />
            )}

            {adminUsersSelectedTab === "overview" && canUseAdminFeatures() && (
              <TrainerClientOverviewAdminTools
                ADMIN_EMAIL={ADMIN_EMAIL}
                adminAllUsersList={adminAllUsersList}
                adminTrainerNote={adminTrainerNote}
                adminTransferFromUid={adminTransferFromUid}
                adminTransferLoading={adminTransferLoading}
                adminTransferStatus={adminTransferStatus}
                adminTransferToUid={adminTransferToUid}
                deleteClientEverywhereFromAdminPanel={deleteClientEverywhereFromAdminPanel}
                saveAdminTrainerNote={saveAdminTrainerNote}
                selectedClient={selectedClient}
                setAdminTrainerNote={setAdminTrainerNote}
                setAdminTransferFromUid={setAdminTransferFromUid}
                setAdminTransferToUid={setAdminTransferToUid}
                transferClientDataBetweenAccounts={transferClientDataBetweenAccounts}
                usersList={usersList}
              />
            )}

            {adminClientStatus && <p className="adminV3Status">{adminClientStatus}</p>}
          </section>
        )}
      </main>

      {!adminClientPageOpen && renderTrainerWorkspaceBottomBar("clients", {
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
    </div>
  );
}
