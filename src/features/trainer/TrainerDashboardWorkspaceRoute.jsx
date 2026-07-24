import { useState } from "react";
import TrainerWorkspace from "../../components/trainer/TrainerWorkspace";
import TrainerClientOverviewModals from "./TrainerClientOverviewModals";
import ProfileAccountSettingsSection from "../client/profile/ProfileAccountSettingsSection";
import ProfileAppSettingsSection from "../client/profile/ProfileAppSettingsSection";
import ProfileAvatarCropModal from "../client/profile/ProfileAvatarCropModal";
import ProfileEmailModal from "../client/profile/ProfileEmailModal";
import ProfilePasswordModal from "../client/profile/ProfilePasswordModal";
import ProfileSettingsModal from "../client/profile/ProfileSettingsModal";
import ProfileTelegramModal from "../client/profile/ProfileTelegramModal";

function TrainerAccountSettingsModals({
  user,
  profileAccount,
  profileAccountAvatarPreview,
  profileAccountDraft,
  profileAccountSaving,
  profileAccountStatus,
  profileAvatarCropImageRef,
  profileAvatarCropOffset,
  profileAvatarCropOpen,
  profileAvatarCropSize,
  profileAvatarCropSource,
  profileAvatarCropZoom,
  profileEmailConnectOpen,
  profileSettingsModalOpen,
  profileSettingsModalSection,
  telegramConnectOpen,
  telegramLinking,
  telegramLoginContainerRef,
  telegramLoginWidgetReady,
  telegramProfile,
  telegramStatus,
  applyProfileAvatarCrop,
  changeProfileAvatarCropZoom,
  changeProfileLogin,
  changeProfilePassword,
  checkTelegramLoginResult,
  closeProfileAvatarCrop,
  disconnectTelegram,
  endProfileAvatarCropDrag,
  handleTelegramAvatarError,
  moveProfileAvatarCrop,
  openProfileAvatarCrop,
  requestProfileEmailChange,
  saveProfileAccount,
  sendProfilePasswordReset,
  setProfileAccountDraft,
  setProfileAccountStatus,
  setProfileAvatarCropSize,
  setProfileEmailConnectOpen,
  setProfileSettingsModalOpen,
  setTelegramConnectOpen,
  setTelegramProfile,
  setTelegramStatus,
  startProfileAvatarCropDrag
}) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const providerIds = new Set((user?.providerData || []).map((provider) => provider.providerId));

  return (
    <>
      <ProfileSettingsModal
        open={profileSettingsModalOpen && profileSettingsModalSection === "account"}
        section="account"
        onClose={() => setProfileSettingsModalOpen(false)}
      >
        <ProfileAccountSettingsSection
          avatarPreview={profileAccountAvatarPreview}
          avatarUrl={profileAccount?.avatarUrl || user?.photoURL || ""}
          draft={profileAccountDraft}
          status={profileAccountStatus}
          onAvatarFile={openProfileAvatarCrop}
          onDraftChange={(field, value) => {
            setProfileAccountDraft((current) => ({ ...current, [field]: value }));
            setProfileAccountStatus("");
          }}
          onChangeLogin={changeProfileLogin}
          onOpenPassword={() => {
            setProfileAccountStatus("");
            setPasswordOpen(true);
          }}
          onSave={saveProfileAccount}
        />
      </ProfileSettingsModal>

      <ProfileSettingsModal
        open={profileSettingsModalOpen && profileSettingsModalSection === "connections"}
        section="connections"
        onClose={() => setProfileSettingsModalOpen(false)}
      >
        <ProfileAppSettingsSection
          heading="Подключения"
          email={profileAccount?.email || user?.email || ""}
          telegramProfile={telegramProfile}
          onOpenEmail={() => {
            setProfileAccountStatus("");
            setProfileEmailConnectOpen(true);
          }}
          onOpenTelegram={() => {
            setTelegramStatus("");
            setTelegramConnectOpen(true);
          }}
          onTelegramAvatarError={handleTelegramAvatarError}
          showTheme={false}
          showNotifications={false}
        />
      </ProfileSettingsModal>

      <ProfileAvatarCropModal
        open={profileAvatarCropOpen}
        imageRef={profileAvatarCropImageRef}
        source={profileAvatarCropSource}
        size={profileAvatarCropSize}
        zoom={profileAvatarCropZoom}
        offset={profileAvatarCropOffset}
        onClose={closeProfileAvatarCrop}
        onImageLoad={(event) => {
          setProfileAvatarCropSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight
          });
        }}
        onPointerDown={startProfileAvatarCropDrag}
        onPointerMove={moveProfileAvatarCrop}
        onPointerUp={endProfileAvatarCropDrag}
        onPointerCancel={endProfileAvatarCropDrag}
        onZoomChange={changeProfileAvatarCropZoom}
        onApply={applyProfileAvatarCrop}
      />

      <ProfileTelegramModal
        open={telegramConnectOpen}
        telegramProfile={telegramProfile}
        loginContainerRef={telegramLoginContainerRef}
        loginWidgetReady={telegramLoginWidgetReady}
        linking={telegramLinking}
        status={telegramStatus}
        onAvatarError={handleTelegramAvatarError}
        onClose={() => setTelegramConnectOpen(false)}
        onCheckLogin={checkTelegramLoginResult}
        onChangeTelegram={() => {
          setTelegramProfile((current) => ({ ...current, connected: false }));
          setTelegramStatus("");
        }}
        onDisconnect={disconnectTelegram}
      />

      <ProfileEmailModal
        open={profileEmailConnectOpen}
        email={profileAccount?.email || user?.email || ""}
        saving={profileAccountSaving}
        status={profileAccountStatus}
        onClose={() => setProfileEmailConnectOpen(false)}
        onRequestEmailChange={requestProfileEmailChange}
      />

      <ProfilePasswordModal
        open={passwordOpen}
        hasPasswordProvider={providerIds.has("password")}
        hasGoogleProvider={providerIds.has("google.com")}
        saving={profileAccountSaving}
        status={profileAccountStatus}
        onClose={() => setPasswordOpen(false)}
        onChangePassword={changeProfilePassword}
        onSendPasswordReset={sendProfilePasswordReset}
      />
    </>
  );
}

export default function TrainerDashboardWorkspaceRoute({
  APP_VERSION,
  applyProfileAvatarCrop,
  adminClientEvents,
  adminClientHistory,
  adminClientMeasurements,
  adminNewTaskDueDate,
  adminNewTaskTitle,
  adminClientProgressPhotos,
  adminClientStatus,
  adminClientTasks,
  adminClientTelegramMessages,
  adminTaskComposerOpen,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  adminTrainerNote,
  adminUsersSelectedTab,
  assignSavedProgramToClient,
  attentionCount,
  canUseAdminFeatures,
  changeProfileAvatarCropZoom,
  changeProfileLogin,
  changeProfilePassword,
  checkTelegramLoginResult,
  clientNutritionDays,
  closeProfileAvatarCrop,
  createAdminClientTask,
  disconnectTelegram,
  endProfileAvatarCropDrag,
  getAdminClientGoalLabel,
  getClientActivityStatus,
  getTrainerNextCreateClientState,
  handleTelegramAvatarError,
  handleTrainerClientAction,
  logout,
  navigateTrainerNext,
  openClientTelegramConnection,
  openProfileAccount,
  openProfileAvatarCrop,
  openTelegramChat,
  openTrainerNextClient,
  refreshPage,
  saveTrainerClientNutritionPlan,
  saveTrainerClientNotificationSettings,
  loadTrainerSubscriptionNotificationSettings,
  moveProfileAvatarCrop,
  saveTrainerSubscriptionNotificationSettings,
  saveTrainerClientWorkoutSchedule,
  saveProfileAccount,
  saveWorkoutsToFirebase,
  selectedClient,
  selectedEffectiveNutritionGoals,
  selectedProfile,
  sendAdminTestWorkoutReminder,
  sendProfilePasswordReset,
  sendTrainerClientMessage,
  setAdminClientPageOpen,
  setAdminClientStatus,
  setAdminNewTaskDueDate,
  setAdminNewTaskTitle,
  setAdminSelectedTemplateId,
  setAdminTaskComposerOpen,
  setAdminUsersSelectedTab,
  setProfileAccountDraft,
  setProfileAccountStatus,
  setProfileAvatarCropSize,
  setProfileEmailConnectOpen,
  setProfileSettingsModalOpen,
  setProfileSettingsModalSection,
  setTelegramConnectOpen,
  setTelegramProfile,
  setTelegramStatus,
  setTrainerNextSection,
  startProfileAvatarCropDrag,
  sortWorkoutDays,
  plan,
  profileAccount,
  profileAccountAvatarPreview,
  profileAccountDraft,
  profileAccountSaving,
  profileAccountStatus,
  profileAvatarCropImageRef,
  profileAvatarCropOffset,
  profileAvatarCropOpen,
  profileAvatarCropSize,
  profileAvatarCropSource,
  profileAvatarCropZoom,
  profileEmailConnectOpen,
  profileSettingsModalOpen,
  profileSettingsModalSection,
  requestProfileEmailChange,
  telegramProfile,
  telegramConnectOpen,
  telegramLinking,
  telegramLoginContainerRef,
  telegramLoginWidgetReady,
  telegramStatus,
  trainerActionCenter,
  trainerClientSummariesLoading,
  trainerSubscriptionNotificationSettings,
  trainerExerciseLibraryItems,
  trainerName,
  trainerNextActiveSection,
  trainerNextMode,
  trainerNextSelectedSummary,
  selectedClientSnapshot,
  selectedLastWorkoutReview,
  trainerNextSummaries,
  trainerNextWorkspaceHandlers,
  trainerNutritionPlanOptions,
  trainerStatusCounts,
  user,
  usersList,
  adminExerciseVideoUploadingId
}) {
  return (
    <>
      <TrainerWorkspace
      appVersion={APP_VERSION}
      mode={trainerNextMode}
      activeSection={trainerNextActiveSection}
      onNavigate={navigateTrainerNext}
      onRefresh={refreshPage}
      trainerName={trainerName}
      trainerAvatar={telegramProfile.avatarUrl}
      clients={usersList}
      clientSummaries={trainerNextSummaries}
      actionCenter={trainerActionCenter}
      summariesLoading={trainerClientSummariesLoading}
      counts={{
        active: trainerStatusCounts.active,
        attention: attentionCount
      }}
      selectedClient={selectedClient}
      selectedProfile={{
        ...selectedProfile,
        goalLabel: getAdminClientGoalLabel(selectedProfile?.goal)
      }}
      selectedSummary={{
        ...trainerNextSelectedSummary,
        status: getClientActivityStatus(trainerNextSelectedSummary)
      }}
      selectedClientSnapshot={selectedClientSnapshot}
      selectedLastWorkoutReview={selectedLastWorkoutReview}
      activeClientTab={adminUsersSelectedTab}
      onClientTabChange={(tab) => {
        setAdminUsersSelectedTab(tab);
        setTrainerNextSection("client");
      }}
      onOpenClient={openTrainerNextClient}
      onCloseClient={() => {
        setAdminClientPageOpen(false);
        setTrainerNextSection("clients");
      }}
      onCreateClient={getTrainerNextCreateClientState().onOpen}
      createClientState={getTrainerNextCreateClientState()}
      measurements={adminClientMeasurements}
      history={adminClientHistory}
      exerciseProgressReviews={adminClientEvents}
      nutritionDays={clientNutritionDays}
      nutritionGoals={selectedEffectiveNutritionGoals}
      nutritionPlanOptions={trainerNutritionPlanOptions}
      photos={adminClientProgressPhotos}
      tasks={adminClientTasks}
      trainerNote={adminTrainerNote}
      onGenerateNutritionPlan={() => setAdminClientStatus("Параметры AI-плана открыты в разделе питания.")}
      onSaveNutritionPlan={saveTrainerClientNutritionPlan}
      onSaveNotifications={saveTrainerClientNotificationSettings}
      trainerSubscriptionNotificationSettings={trainerSubscriptionNotificationSettings}
      onLoadTrainerSubscriptionNotifications={loadTrainerSubscriptionNotificationSettings}
      onSaveTrainerSubscriptionNotifications={saveTrainerSubscriptionNotificationSettings}
      onTestNotification={() => sendAdminTestWorkoutReminder(selectedClient)}
      onConnectTelegram={openClientTelegramConnection}
      onOpenTelegramChat={openTelegramChat}
      onSendMessage={sendTrainerClientMessage}
      onOpenTrainerProfile={() => {
        openProfileAccount();
        setProfileSettingsModalSection("account");
        setProfileSettingsModalOpen(true);
      }}
      onOpenTrainerConnections={() => {
        setProfileAccountStatus("");
        setProfileSettingsModalSection("connections");
        setProfileSettingsModalOpen(true);
      }}
      telegramMessages={adminClientTelegramMessages}
      onCreateTask={() => setAdminTaskComposerOpen(true)}
      onClientAction={handleTrainerClientAction}
      canDeleteClients={canUseAdminFeatures()}
      onResolveExerciseProgress={(payload) => handleTrainerClientAction("resolve_exercise_progress", selectedClient, payload)}
      workouts={sortWorkoutDays(plan.workouts || [])}
      exerciseLibrary={trainerExerciseLibraryItems}
      programTemplates={adminTrainingTemplates}
      selectedProgramId={adminSelectedTemplateId}
      onSelectProgram={setAdminSelectedTemplateId}
      onAssignProgram={() => assignSavedProgramToClient(selectedClient?.id, adminSelectedTemplateId)}
      onSaveWorkoutSchedule={(dates) => saveTrainerClientWorkoutSchedule(dates, selectedClient)}
      programStatus={adminClientStatus}
      onUpdateWorkout={trainerNextWorkspaceHandlers.onUpdateWorkout}
      onUpdateExercise={trainerNextWorkspaceHandlers.onUpdateExercise}
      onSaveExerciseProgressAdjustment={trainerNextWorkspaceHandlers.onSaveExerciseProgressAdjustment}
      onUpdateLibraryExercise={trainerNextWorkspaceHandlers.onUpdateLibraryExercise}
      onRemoveLibraryExercise={trainerNextWorkspaceHandlers.onRemoveLibraryExercise}
      onCreateLibraryExercise={trainerNextWorkspaceHandlers.onCreateLibraryExercise}
      onUpdateExerciseSet={trainerNextWorkspaceHandlers.onUpdateExerciseSet}
      onAddExerciseSet={trainerNextWorkspaceHandlers.onAddExerciseSet}
      onRemoveExerciseSet={trainerNextWorkspaceHandlers.onRemoveExerciseSet}
      onAddExercise={trainerNextWorkspaceHandlers.onAddExercise}
      onRemoveExercise={trainerNextWorkspaceHandlers.onRemoveExercise}
      onDuplicateExercise={trainerNextWorkspaceHandlers.onDuplicateExercise}
      onMoveExercise={trainerNextWorkspaceHandlers.onMoveExercise}
      onUploadExerciseVideo={trainerNextWorkspaceHandlers.onUploadExerciseVideo}
      onUploadLibraryExerciseVideo={trainerNextWorkspaceHandlers.onUploadLibraryExerciseVideo}
      exerciseVideoUploadingId={adminExerciseVideoUploadingId}
      onAddDay={trainerNextWorkspaceHandlers.onAddDay}
      onDuplicateDay={trainerNextWorkspaceHandlers.onDuplicateDay}
      onRemoveDay={trainerNextWorkspaceHandlers.onRemoveDay}
      onSaveWorkouts={saveWorkoutsToFirebase}
      onLogout={logout}
      />
      <TrainerClientOverviewModals
        adminClientProgressPhotos={adminClientProgressPhotos}
        adminNewTaskDueDate={adminNewTaskDueDate}
        adminNewTaskTitle={adminNewTaskTitle}
        adminTaskComposerOpen={adminTaskComposerOpen}
        createAdminClientTask={createAdminClientTask}
        selectedPhotoCompare={[]}
        setAdminNewTaskDueDate={setAdminNewTaskDueDate}
        setAdminNewTaskTitle={setAdminNewTaskTitle}
        setAdminTaskComposerOpen={setAdminTaskComposerOpen}
      />
      <TrainerAccountSettingsModals
        user={user}
        profileAccount={profileAccount}
        profileAccountAvatarPreview={profileAccountAvatarPreview}
        profileAccountDraft={profileAccountDraft}
        profileAccountSaving={profileAccountSaving}
        profileAccountStatus={profileAccountStatus}
        profileAvatarCropImageRef={profileAvatarCropImageRef}
        profileAvatarCropOffset={profileAvatarCropOffset}
        profileAvatarCropOpen={profileAvatarCropOpen}
        profileAvatarCropSize={profileAvatarCropSize}
        profileAvatarCropSource={profileAvatarCropSource}
        profileAvatarCropZoom={profileAvatarCropZoom}
        profileEmailConnectOpen={profileEmailConnectOpen}
        profileSettingsModalOpen={profileSettingsModalOpen}
        profileSettingsModalSection={profileSettingsModalSection}
        telegramConnectOpen={telegramConnectOpen}
        telegramLinking={telegramLinking}
        telegramLoginContainerRef={telegramLoginContainerRef}
        telegramLoginWidgetReady={telegramLoginWidgetReady}
        telegramProfile={telegramProfile}
        telegramStatus={telegramStatus}
        applyProfileAvatarCrop={applyProfileAvatarCrop}
        changeProfileAvatarCropZoom={changeProfileAvatarCropZoom}
        changeProfileLogin={changeProfileLogin}
        changeProfilePassword={changeProfilePassword}
        checkTelegramLoginResult={checkTelegramLoginResult}
        closeProfileAvatarCrop={closeProfileAvatarCrop}
        disconnectTelegram={disconnectTelegram}
        endProfileAvatarCropDrag={endProfileAvatarCropDrag}
        handleTelegramAvatarError={handleTelegramAvatarError}
        moveProfileAvatarCrop={moveProfileAvatarCrop}
        openProfileAvatarCrop={openProfileAvatarCrop}
        requestProfileEmailChange={requestProfileEmailChange}
        saveProfileAccount={saveProfileAccount}
        sendProfilePasswordReset={sendProfilePasswordReset}
        setProfileAccountDraft={setProfileAccountDraft}
        setProfileAccountStatus={setProfileAccountStatus}
        setProfileAvatarCropSize={setProfileAvatarCropSize}
        setProfileEmailConnectOpen={setProfileEmailConnectOpen}
        setProfileSettingsModalOpen={setProfileSettingsModalOpen}
        setTelegramConnectOpen={setTelegramConnectOpen}
        setTelegramProfile={setTelegramProfile}
        setTelegramStatus={setTelegramStatus}
        startProfileAvatarCropDrag={startProfileAvatarCropDrag}
      />
    </>
  );
}
