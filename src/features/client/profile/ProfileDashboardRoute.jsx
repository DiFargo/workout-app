import HistoryDeleteConfirmDialog from "../workouts/HistoryDeleteConfirmDialog";
import { buildProfileDashboardModel } from "./profileDashboardModel";
import ProfileAccountSettingsSection from "./ProfileAccountSettingsSection";
import ProfileAppSettingsSection from "./ProfileAppSettingsSection";
import ProfileAvatarCropModal from "./ProfileAvatarCropModal";
import ProfileBodyMetricsSettingsSection from "./ProfileBodyMetricsSettingsSection";
import ProfileCabinetActionGrid from "./ProfileCabinetActionGrid";
import ProfileCabinetTitleRow from "./ProfileCabinetTitleRow";
import ProfileHeroCard from "./ProfileHeroCard";
import ProfileMainMeasurementSnapshot from "./ProfileMainMeasurementSnapshot";
import ProfileMainRoleActions from "./ProfileMainRoleActions";
import ProfileMainSummaryCards from "./ProfileMainSummaryCards";
import ProfileMeasurementWizardPanel from "./ProfileMeasurementWizardPanel";
import ProfileMeasurementsModal from "./ProfileMeasurementsModal";
import ProfileNutritionModal from "./ProfileNutritionModal";
import ProfilePageChrome from "./ProfilePageChrome";
import ProfileProgressInsightCard from "./ProfileProgressInsightCard";
import ProfileProgressPhotosModal from "./ProfileProgressPhotosModal";
import ProfileSettingsModal from "./ProfileSettingsModal";
import ProfileSettingsTab from "./ProfileSettingsTab";
import ProfileTelegramModal from "./ProfileTelegramModal";
import ProfileTrainerNotificationsModal from "./ProfileTrainerNotificationsModal";
import ProfileWorkoutCalendarModal from "./ProfileWorkoutCalendarModal";
import ProfileWorkoutHistoryModal from "./ProfileWorkoutHistoryModal";

export default function ProfileDashboardRoute(ctx) {
  const {
    AI_NUTRITION_WEEK_DAYS,
    APP_PAGES,
    APP_THEMES,
    APP_VERSION,
    WORKOUT_CALENDAR_STORAGE_KEY,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    aiNutritionSavedPlan,
    appTheme,
    auth,
    buildAiNutritionMonthlyPlan,
    buildPlannedWorkoutSlots,
    buildProgressInsight,
    buildWorkoutScheduleCalendarEntries,
    buildWorkoutScheduleDraft,
    cabinetWorkoutHistoryItemRefs,
    canUseAdminFeatures,
    canUseTrainerFeatures,
    checkTelegramLoginResult,
    clientProgressPhotos,
    clientTrainerTasks,
    closeHistoryDeleteConfirm,
    closeProfileAvatarCrop,
    confirmDeleteOwnHistoryWorkout,
    currentUserRole,
    db,
    disconnectTelegram,
    doc,
    formatProfileMeasurementDate,
    formatProfileProgressPhotoDate,
    formatProfileWorkoutDate,
    formatProfileWorkoutDateKey,
    getActiveTrainerTasksCount,
    getAiNutritionCurrentWeek,
    getAiNutritionDayMacros,
    getAiNutritionGoalLabel,
    getAiNutritionTrainingDays,
    getClientNutritionDisplayPlan,
    getClientTrainerTaskDestination,
    getDoc,
    getNutritionDayTotals,
    getProfileMeasurementFields,
    getProfileMeasurementValue,
    getProfileNextTrainingText,
    getProgramHistoryItems,
    getTimestampValue,
    handleTelegramAvatarError,
    history,
    historyDeleteCandidate,
    historyDeletingId,
    historyLoading,
    loadHistory,
    loginContainerRef,
    logout,
    makeEmptyNutritionDay,
    moveProfileAvatarCrop,
    nutrition,
    nutritionCalendarDays,
    nutritionDateKey,
    nutritionKeyToDate,
    onOpenClientTrainerTask,
    openAdminClientsWithFilter,
    openCabinetWorkoutHistory,
    openHistoryKey,
    openProfileAccount,
    openProfileAvatarCrop,
    page,
    plan,
    profileAccount,
    profileAccountAvatarPreview,
    profileAccountDraft,
    profileAccountSaving,
    profileAccountStatus,
    profileActiveTab,
    profileAvatarCropImageRef,
    profileAvatarCropOffset,
    profileAvatarCropOpen,
    profileAvatarCropSize,
    profileAvatarCropSource,
    profileAvatarCropZoom,
    profileBodyMetricsOpen,
    profileMeasurementDraft,
    profileMeasurementOpen,
    profileMeasurementReturnTab,
    profileMeasurementSaving,
    profileMeasurementStatus,
    profileMeasurementWizardStep,
    profileMeasurements,
    profileMeasurementsModalOpen,
    profileNutritionModalOpen,
    profileNutritionSaveStatus,
    profileProgressAnalysisOpen,
    profileProgressModalOpen,
    profileProgressPhotoCompareIds,
    profileProgressPhotoCompareView,
    profileProgressPhotoFiles,
    profileProgressPhotoPreviews,
    profileProgressPhotoStatus,
    profileProgressPhotoUploading,
    profileProgressPhotosModalOpen,
    profileSettingsModalOpen,
    profileSettingsModalSection,
    profileSettingsModalBodyRef,
    profileTrainerNotificationsOpen,
    profileWorkoutCalendarData,
    profileWorkoutCalendarDate,
    profileWorkoutCalendarDraftDates,
    profileWorkoutCalendarEditing,
    profileWorkoutCalendarMonth,
    profileWorkoutCalendarSaving,
    profileWorkoutCalendarStatus,
    profileWorkoutHistoryModalOpen,
    profileWorkoutHistoryProgramScope,
    profileWorkoutScheduledDates,
    refreshPage,
    renderClientMainBottomBar,
    requestDeleteOwnHistoryWorkout,
    safeWriteUserJsonStorage,
    saveAiBodyMetrics,
    saveClientProgressPhotos,
    saveProfileAccount,
    saveProfileMeasurement,
    saveProfileNutritionPlanAndClose,
    selectClientProgressPhoto,
    selectNutritionDate,
    sendProfilePasswordReset,
    setAiNutritionProfileDraft,
    setDoc,
    setPage,
    setProfileAccountDraft,
    setProfileAccountStatus,
    setProfileAvatarCropSize,
    setProfileBodyMetricsOpen,
    setProfileMeasurementDraft,
    setProfileMeasurementOpen,
    setProfileMeasurementReturnTab,
    setProfileMeasurementStatus,
    setProfileMeasurementWizardStep,
    setProfileMeasurementsModalOpen,
    setProfileNutritionModalOpen,
    setProfileNutritionSaveStatus,
    setProfileProgressAnalysisOpen,
    setProfileProgressModalOpen,
    setProfileProgressPhotoCompareIds,
    setProfileProgressPhotoCompareView,
    setProfileProgressPhotoStatus,
    setProfileProgressPhotosModalOpen,
    setProfileSettingsModalOpen,
    setProfileSettingsModalSection,
    setProfileTrainerNotificationsOpen,
    setProfileWorkoutCalendarData,
    setProfileWorkoutCalendarDate,
    setProfileWorkoutCalendarDraftDates,
    setProfileWorkoutCalendarEditing,
    setProfileWorkoutCalendarMonth,
    setProfileWorkoutCalendarSaving,
    setProfileWorkoutCalendarStatus,
    setProfileWorkoutHistoryModalOpen,
    setProfileWorkoutScheduledDates,
    setSelectedNutritionDateKey,
    setSelectedUserId,
    setTelegramConnectOpen,
    setTelegramProfile,
    setTelegramStatus,
    shiftNutritionDateKey,
    shiftProfileWorkoutMonthKey,
    sortWorkoutDays,
    startProfileAvatarCropDrag,
    telegramConnectOpen,
    telegramLoginWidgetReady,
    telegramLinking,
    telegramProfile,
    telegramStatus,
    todayNutritionKey,
    toggleAppTheme,
    toggleCabinetWorkoutHistory,
    user,
    changeProfileAvatarCropZoom,
    applyProfileAvatarCrop,
    endProfileAvatarCropDrag
  } = ctx;

  const {
    isMainDashboard,
    visibleProfileTab,
    totalWorkouts,
    activeProfile,
    latestProfileMeasurement,
    latestClientProgressPhoto,
    selectedClientProgressPhotoBefore,
    selectedClientProgressPhotoAfter,
    progressPhotoCompareViews,
    activeProgressPhotoCompareView,
    formatClientProgressPhotoDate,
    profileProgressPhotoSetComplete,
    profileWorkoutHistoryItems,
    activeGoalLabel,
    profileMacros,
    profileNutritionDraftMacros,
    trainerNotificationCount,
    workoutCalendarMonthDate,
    workoutCalendarDays,
    selectedWorkoutCalendarItems,
    shiftProfileWorkoutCalendarMonth,
    toggleProfileWorkoutScheduledDate,
    saveProfileWorkoutCalendar,
    profileAiNutritionPlan,
    profileAiNutritionWeek,
    profileAiNutritionActiveProfile,
    profileNutritionWeekDays,
    profileNutritionWeekLabel,
    profileNutritionSelectedTotals,
    lastWorkoutDate,
    nextTrainingText,
    currentGoalId,
    greetingName,
    profileAvatarUrl,
    mainMeasurementSeries,
    mainMeasurementPoints,
    mainLatestWeight,
    mainWeightChange,
    progressInsight,
    aiCoachStatuses
  } = buildProfileDashboardModel({
    AI_NUTRITION_WEEK_DAYS,
    APP_PAGES,
    WORKOUT_CALENDAR_STORAGE_KEY,
    aiNutritionProfile,
    aiNutritionProfileDraft,
    aiNutritionSavedPlan,
    auth,
    buildAiNutritionMonthlyPlan,
    buildPlannedWorkoutSlots,
    buildProgressInsight,
    buildWorkoutScheduleCalendarEntries,
    buildWorkoutScheduleDraft,
    clientProgressPhotos,
    clientTrainerTasks,
    db,
    doc,
    formatProfileMeasurementDate,
    formatProfileProgressPhotoDate,
    formatProfileWorkoutDate,
    formatProfileWorkoutDateKey,
    getActiveTrainerTasksCount,
    getAiNutritionCurrentWeek,
    getAiNutritionDayMacros,
    getAiNutritionGoalLabel,
    getAiNutritionTrainingDays,
    getClientNutritionDisplayPlan,
    getDoc,
    getNutritionDayTotals,
    getProfileNextTrainingText,
    getProgramHistoryItems,
    getTimestampValue,
    history,
    makeEmptyNutritionDay,
    nutrition,
    nutritionCalendarDays,
    nutritionDateKey,
    nutritionKeyToDate,
    page,
    plan,
    profileAccount,
    profileActiveTab,
    profileMeasurements,
    profileProgressPhotoCompareIds,
    profileProgressPhotoCompareView,
    profileProgressPhotoFiles,
    profileWorkoutCalendarData,
    profileWorkoutCalendarDate,
    profileWorkoutCalendarDraftDates,
    profileWorkoutCalendarEditing,
    profileWorkoutCalendarMonth,
    profileWorkoutCalendarSaving,
    profileWorkoutHistoryProgramScope,
    profileWorkoutScheduledDates,
    safeWriteUserJsonStorage,
    setDoc,
    setProfileWorkoutCalendarData,
    setProfileWorkoutCalendarDate,
    setProfileWorkoutCalendarDraftDates,
    setProfileWorkoutCalendarEditing,
    setProfileWorkoutCalendarMonth,
    setProfileWorkoutCalendarSaving,
    setProfileWorkoutCalendarStatus,
    setProfileWorkoutScheduledDates,
    shiftProfileWorkoutMonthKey,
    sortWorkoutDays,
    telegramProfile,
    user
  });

  return (
    <div
      className={`${isMainDashboard
        ? "profileDashboardPage profileTabbedPage mainDashboardPage"
        : "profileDashboardPage profileTabbedPage"}${
        isMainDashboard
          ? " clientCorePage clientCorePageMain"
          : visibleProfileTab === "cabinet"
            ? " clientCorePage clientCorePageCabinet"
            : ""
      }${currentUserRole === "trainer" && !canUseAdminFeatures() ? " trainerRolePage" : ""}`}
      data-profile-tab={visibleProfileTab}
    >
      <ProfilePageChrome
        showVersion={isMainDashboard || visibleProfileTab === "cabinet"}
        appVersion={APP_VERSION}
        isMainDashboard={isMainDashboard}
        renderBottomBar={renderClientMainBottomBar}
        onRefresh={refreshPage}
      />

      {!isMainDashboard && visibleProfileTab === "cabinet" && (
        <ProfileCabinetTitleRow
          showTrainerNotifications={!canUseTrainerFeatures()}
          trainerNotificationCount={trainerNotificationCount}
          onOpenTrainerNotifications={() => setProfileTrainerNotificationsOpen(true)}
        />
      )}

      <section className="profileUnifiedCard profileAiDashboardCard profileCabinetSection">
        {visibleProfileTab === "cabinet" && isMainDashboard && (
          <div className="profileMainHeroStatsCard">
            <ProfileHeroCard
              isMainDashboard={isMainDashboard}
              canOpenAccount={!canUseTrainerFeatures()}
              telegramProfile={telegramProfile}
              avatarUrl={profileAvatarUrl}
              progressScore={progressInsight.score}
              greetingName={greetingName}
              onOpenAccount={() => {
                setProfileProgressModalOpen(false);
                openProfileAccount();
              }}
            />
            <ProfileMainSummaryCards
              activeGoalLabel={activeGoalLabel}
              targetWeight={activeProfile?.targetWeight}
              weight={activeProfile?.weight}
              currentGoalId={currentGoalId}
              totalWorkouts={totalWorkouts}
              lastWorkoutDate={lastWorkoutDate}
              nextTrainingText={nextTrainingText}
              showSplitCards={false}
            />
          </div>
        )}

        {visibleProfileTab === "cabinet" && !isMainDashboard && (
          <ProfileHeroCard
            isMainDashboard={isMainDashboard}
            canOpenAccount={!canUseTrainerFeatures()}
            telegramProfile={telegramProfile}
            avatarUrl={profileAvatarUrl}
            progressScore={progressInsight.score}
            greetingName={greetingName}
            onOpenAccount={() => {
              setProfileProgressModalOpen(false);
              openProfileAccount();
            }}
          />
        )}

        {!isMainDashboard && visibleProfileTab === "cabinet" && (
          <ProfileCabinetActionGrid
            showClientOnlyActions={!canUseTrainerFeatures()}
            latestPhotoText={latestClientProgressPhoto
              ? `Последние: ${new Date(`${latestClientProgressPhoto.date || latestClientProgressPhoto.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}`
              : "Добавь первые фото"}
            latestMeasurementText={latestProfileMeasurement ? formatProfileMeasurementDate(latestProfileMeasurement) : "Замеров пока нет"}
            nutritionText={`${Math.round(profileMacros.calories || nutrition.goals.calories)} ккал · ${activeGoalLabel}`}
            historyText={history.length ? `${history.length} тренировок сохранено` : "История пока пустая"}
            onOpenPhotos={() => {
              setProfileProgressPhotoStatus("");
              setProfileProgressPhotoCompareIds([
                clientProgressPhotos[1]?.id || "",
                clientProgressPhotos[0]?.id || ""
              ]);
              setProfileProgressPhotoCompareView("front");
              setProfileProgressPhotosModalOpen(true);
            }}
            onOpenMeasurements={() => setProfileMeasurementsModalOpen(true)}
            onOpenNutrition={() => {
              setProfileNutritionSaveStatus("");
              setSelectedNutritionDateKey(todayNutritionKey());
              setProfileNutritionModalOpen(true);
            }}
            onOpenCalendar={() => {
              setProfileSettingsModalOpen(false);
              loadHistory();
              setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
              setProfileWorkoutCalendarEditing(false);
              setProfileWorkoutCalendarStatus("");
              setProfileProgressModalOpen(true);
            }}
            onOpenHistory={() => openCabinetWorkoutHistory()}
            onOpenAccount={openProfileAccount}
            onOpenQuestionnaire={() => {
              setProfileBodyMetricsOpen(true);
              setProfileSettingsModalSection("profile");
              setProfileSettingsModalOpen(true);
            }}
            onOpenSettings={() => {
              setProfileProgressModalOpen(false);
              setProfileSettingsModalSection("settings");
              setProfileSettingsModalOpen(true);
            }}
          />
        )}

        {isMainDashboard && (
          <ProfileMainSummaryCards
            activeGoalLabel={activeGoalLabel}
            targetWeight={activeProfile?.targetWeight}
            weight={activeProfile?.weight}
            currentGoalId={currentGoalId}
            totalWorkouts={totalWorkouts}
            lastWorkoutDate={lastWorkoutDate}
            nextTrainingText={nextTrainingText}
            showStats={false}
          />
        )}

        {isMainDashboard && (
          <ProfileProgressInsightCard
            isMainDashboard={isMainDashboard}
            progressInsight={progressInsight}
            expanded={profileProgressAnalysisOpen}
            statuses={aiCoachStatuses}
            currentGoalId={currentGoalId}
            totalWorkouts={totalWorkouts}
            onToggle={() => setProfileProgressAnalysisOpen((prev) => !prev)}
          />
        )}

        {isMainDashboard && (
          <ProfileMainMeasurementSnapshot
            measurementSeries={mainMeasurementSeries}
            measurementPoints={mainMeasurementPoints}
            latestMeasurement={latestProfileMeasurement}
            latestWeight={mainLatestWeight}
            weightChange={mainWeightChange}
            formatMeasurementDate={formatProfileMeasurementDate}
          />
        )}

        <ProfileMeasurementWizardPanel
          visible={visibleProfileTab === "measurements"}
          open={profileMeasurementOpen}
          latestMeasurement={latestProfileMeasurement}
          measurementFields={getProfileMeasurementFields(activeProfile?.goal || "recomp")}
          draft={profileMeasurementDraft}
          status={profileMeasurementStatus}
          saving={profileMeasurementSaving}
          step={profileMeasurementWizardStep}
          formatMeasurementDate={formatProfileMeasurementDate}
          getMeasurementValue={getProfileMeasurementValue}
          onToggle={() => {
            setProfileMeasurementOpen((prev) => !prev);
            setProfileMeasurementWizardStep(0);
          }}
          onStart={() => {
            setProfileMeasurementReturnTab("measurements");
            setProfileMeasurementOpen(false);
            setProfileMeasurementWizardStep(0);
            setProfileMeasurementStatus("");
            setPage(APP_PAGES.MEASUREMENT_WIZARD);
          }}
          onClose={() => {
            setProfileMeasurementOpen(false);
            setProfileMeasurementWizardStep(0);
          }}
          onDraftChange={(fieldId, value) => setProfileMeasurementDraft((prev) => ({ ...prev, [fieldId]: value }))}
          onPreviousStep={() => setProfileMeasurementWizardStep((step) => Math.max(0, step - 1))}
          onNextStep={(totalWizardScreens) => setProfileMeasurementWizardStep((step) => Math.min(totalWizardScreens - 1, step + 1))}
          onSave={saveProfileMeasurement}
        />
      </section>

      <ProfileMeasurementsModal
        open={profileMeasurementsModalOpen && !isMainDashboard && visibleProfileTab === "cabinet"}
        latestMeasurement={latestProfileMeasurement}
        measurementFields={getProfileMeasurementFields(activeProfile?.goal || "recomp")}
        formatMeasurementDate={formatProfileMeasurementDate}
        getMeasurementValue={getProfileMeasurementValue}
        onClose={() => setProfileMeasurementsModalOpen(false)}
        onStart={() => {
          setProfileMeasurementsModalOpen(false);
          setProfileMeasurementReturnTab("cabinet");
          setProfileMeasurementOpen(false);
          setProfileMeasurementWizardStep(0);
          setProfileMeasurementStatus("");
          setPage(APP_PAGES.MEASUREMENT_WIZARD);
        }}
      />
      <ProfileProgressPhotosModal
        open={profileProgressPhotosModalOpen && !isMainDashboard && visibleProfileTab === "cabinet" && !canUseTrainerFeatures()}
        uploading={profileProgressPhotoUploading}
        latestPhoto={latestClientProgressPhoto}
        photos={clientProgressPhotos}
        files={profileProgressPhotoFiles}
        previews={profileProgressPhotoPreviews}
        status={profileProgressPhotoStatus}
        compareIds={profileProgressPhotoCompareIds}
        compareViews={progressPhotoCompareViews}
        compareView={profileProgressPhotoCompareView}
        activeCompareView={activeProgressPhotoCompareView}
        selectedBefore={selectedClientProgressPhotoBefore}
        selectedAfter={selectedClientProgressPhotoAfter}
        canSave={profileProgressPhotoSetComplete}
        formatPhotoDate={formatClientProgressPhotoDate}
        onClose={() => setProfileProgressPhotosModalOpen(false)}
        onSelectPhoto={selectClientProgressPhoto}
        onCompareIdsChange={(slot, value) => setProfileProgressPhotoCompareIds((current) => {
          const next = [...current];
          next[slot] = value;
          return next;
        })}
        onCompareViewChange={setProfileProgressPhotoCompareView}
        onSave={saveClientProgressPhotos}
      />

      <ProfileWorkoutCalendarModal
        open={profileProgressModalOpen && !isMainDashboard && visibleProfileTab === "cabinet"}
        modalBodyRef={profileSettingsModalBodyRef}
        monthDate={workoutCalendarMonthDate}
        monthKey={profileWorkoutCalendarMonth}
        calendarDays={workoutCalendarDays}
        selectedDate={profileWorkoutCalendarDate}
        selectedItems={selectedWorkoutCalendarItems}
        scheduledDates={profileWorkoutScheduledDates}
        draftDates={profileWorkoutCalendarDraftDates}
        editing={profileWorkoutCalendarEditing}
        saving={profileWorkoutCalendarSaving}
        status={profileWorkoutCalendarStatus}
        getTimestampValue={getTimestampValue}
        onClose={() => setProfileProgressModalOpen(false)}
        onShiftMonth={shiftProfileWorkoutCalendarMonth}
        onStartEdit={() => {
          setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
          setProfileWorkoutCalendarEditing(true);
          setProfileWorkoutCalendarStatus("");
        }}
        onCancelEdit={() => {
          setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
          setProfileWorkoutCalendarEditing(false);
          setProfileWorkoutCalendarStatus("");
        }}
        onSave={saveProfileWorkoutCalendar}
        onDayClick={(day) => {
          setProfileWorkoutCalendarDate(day.key);
          if (profileWorkoutCalendarEditing && day.isCurrentMonth) {
            toggleProfileWorkoutScheduledDate(day.key);
          }
        }}
        onOpenHistory={openCabinetWorkoutHistory}
      />

      <ProfileWorkoutHistoryModal
        open={profileWorkoutHistoryModalOpen && !isMainDashboard && visibleProfileTab === "cabinet"}
        programScope={profileWorkoutHistoryProgramScope}
        loading={historyLoading}
        items={profileWorkoutHistoryItems}
        openItemId={openHistoryKey}
        itemRefs={cabinetWorkoutHistoryItemRefs}
        deletingId={historyDeletingId}
        getTimestampValue={getTimestampValue}
        onClose={() => setProfileWorkoutHistoryModalOpen(false)}
        onToggleItem={toggleCabinetWorkoutHistory}
        onRequestDelete={requestDeleteOwnHistoryWorkout}
      />

      <HistoryDeleteConfirmDialog
        candidate={historyDeleteCandidate}
        deletingId={historyDeletingId}
        onClose={closeHistoryDeleteConfirm}
        onConfirm={confirmDeleteOwnHistoryWorkout}
      />

      <ProfileSettingsModal
        open={profileSettingsModalOpen && !isMainDashboard && visibleProfileTab === "cabinet"}
        section={profileSettingsModalSection}
        onClose={() => setProfileSettingsModalOpen(false)}
      >
        {profileSettingsModalSection === "account" && (
          <ProfileAccountSettingsSection
            avatarPreview={profileAccountAvatarPreview}
            avatarUrl={profileAvatarUrl}
            draft={profileAccountDraft}
            saving={profileAccountSaving}
            status={profileAccountStatus}
            onAvatarFile={openProfileAvatarCrop}
            onDraftChange={(field, value) => {
              setProfileAccountDraft((current) => ({ ...current, [field]: value }));
              setProfileAccountStatus("");
            }}
            onSendPasswordReset={sendProfilePasswordReset}
            onSave={saveProfileAccount}
            onLogout={logout}
          />
        )}

        {profileSettingsModalSection === "profile" && (
          <ProfileBodyMetricsSettingsSection
            open={profileBodyMetricsOpen}
            draft={aiNutritionProfileDraft}
            activeGoalLabel={activeGoalLabel}
            onToggle={() => setProfileBodyMetricsOpen((prev) => !prev)}
            onDraftChange={(field, value) => setAiNutritionProfileDraft((prev) => ({ ...prev, [field]: value }))}
            onSave={() => {
              saveAiBodyMetrics();
              setProfileSettingsModalOpen(false);
            }}
          />
        )}

        {profileSettingsModalSection === "settings" && (
          <ProfileAppSettingsSection
            isWarmLightTheme={appTheme === APP_THEMES.WARM_LIGHT}
            telegramProfile={telegramProfile}
            onToggleTheme={toggleAppTheme}
            onOpenTelegram={() => {
              setTelegramStatus("");
              setTelegramConnectOpen(true);
            }}
            onTelegramAvatarError={handleTelegramAvatarError}
          />
        )}
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

      <ProfileMainRoleActions
        showTrainer={isMainDashboard && canUseTrainerFeatures()}
        showAdmin={isMainDashboard && canUseAdminFeatures()}
        onOpenTrainer={() => {
          setSelectedUserId(null);
          currentUserRole === "trainer" && !canUseAdminFeatures()
            ? openAdminClientsWithFilter("all")
            : setPage(APP_PAGES.ADMIN);
        }}
        onOpenAdmin={() => {
          setSelectedUserId(null);
          setPage(APP_PAGES.ADMIN_PANEL);
        }}
      />

      <ProfileTrainerNotificationsModal
        open={profileTrainerNotificationsOpen && !isMainDashboard && !canUseTrainerFeatures()}
        tasks={clientTrainerTasks}
        activeCount={trainerNotificationCount}
        getTaskDestination={getClientTrainerTaskDestination}
        onClose={() => setProfileTrainerNotificationsOpen(false)}
        onOpenTask={onOpenClientTrainerTask}
      />

      <ProfileNutritionModal
        open={profileNutritionModalOpen && !isMainDashboard}
        profileDraft={aiNutritionProfileDraft}
        activeProfile={activeProfile}
        draftMacros={profileNutritionDraftMacros}
        nutritionGoals={nutrition.goals}
        saveStatus={profileNutritionSaveStatus}
        weekLabel={profileNutritionWeekLabel}
        weekDays={profileNutritionWeekDays}
        aiPlan={profileAiNutritionPlan}
        aiWeek={profileAiNutritionWeek}
        aiActiveProfile={profileAiNutritionActiveProfile}
        selectedTotals={profileNutritionSelectedTotals}
        onClose={() => setProfileNutritionModalOpen(false)}
        onGoalChange={(goalId) => setAiNutritionProfileDraft((prev) => ({ ...prev, goal: goalId }))}
        onSave={saveProfileNutritionPlanAndClose}
        onShiftWeek={(direction) => selectNutritionDate(shiftNutritionDateKey(nutritionDateKey, direction * 7))}
      />

      <ProfileTelegramModal
        open={telegramConnectOpen}
        telegramProfile={telegramProfile}
        loginContainerRef={loginContainerRef}
        loginWidgetReady={telegramLoginWidgetReady}
        linking={telegramLinking}
        status={telegramStatus}
        onAvatarError={handleTelegramAvatarError}
        onClose={() => setTelegramConnectOpen(false)}
        onCheckLogin={checkTelegramLoginResult}
        onChangeTelegram={() => {
          setTelegramProfile((prev) => ({ ...prev, connected: false }));
          setTelegramStatus("");
        }}
        onDisconnect={disconnectTelegram}
      />

      <ProfileSettingsTab
        visible={visibleProfileTab === "settings"}
        bodyMetricsOpen={profileBodyMetricsOpen}
        draft={aiNutritionProfileDraft}
        activeGoalLabel={activeGoalLabel}
        isWarmLightTheme={appTheme === APP_THEMES.WARM_LIGHT}
        telegramProfile={telegramProfile}
        onToggleBodyMetrics={() => setProfileBodyMetricsOpen((prev) => !prev)}
        onDraftChange={(field, value) => setAiNutritionProfileDraft((prev) => ({ ...prev, [field]: value }))}
        onSaveBodyMetrics={saveAiBodyMetrics}
        onToggleTheme={toggleAppTheme}
        onOpenTelegram={() => {
          setTelegramStatus("");
          setTelegramConnectOpen(true);
        }}
        onTelegramAvatarError={handleTelegramAvatarError}
      />
    </div>
  );
}
