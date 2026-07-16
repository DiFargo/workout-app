import { useState } from "react";
import HistoryDeleteConfirmDialog from "../workouts/HistoryDeleteConfirmDialog";
import { buildProfileDashboardModel } from "./profileDashboardModel";
import ProfileAccountSettingsSection from "./ProfileAccountSettingsSection";
import ProfileAppSettingsSection from "./ProfileAppSettingsSection";
import ProfileAvatarCropModal from "./ProfileAvatarCropModal";
import ProfileBodyMetricsSettingsSection from "./ProfileBodyMetricsSettingsSection";
import ProfileCabinetActionGrid from "./ProfileCabinetActionGrid";
import ProfileEmailModal from "./ProfileEmailModal";
import ProfileFeedbackModal from "./ProfileFeedbackModal";
import ProfileCabinetTitleRow from "./ProfileCabinetTitleRow";
import ProfileHeroCard from "./ProfileHeroCard";
import ProfileMainMeasurementSnapshot from "./ProfileMainMeasurementSnapshot";
import ProfileMainRoleActions from "./ProfileMainRoleActions";
import ProfileMainSummaryCards from "./ProfileMainSummaryCards";
import ProfileMeasurementWizardPanel from "./ProfileMeasurementWizardPanel";
import ProfileMeasurementsModal from "./ProfileMeasurementsModal";
import ProfileNutritionModal from "./ProfileNutritionModal";
import ProfilePageChrome from "./ProfilePageChrome";
import {
  ProfileDashboardContent,
  ProfileDashboardShell,
  ProfileDashboardVersion,
  ProfileMainHeroStatsShell
} from "./ProfileDashboardShell";
import ProfilePasswordModal from "./ProfilePasswordModal";
import ProfileProgressInsightCard from "./ProfileProgressInsightCard";
import ProfileProgressPhotosModal from "./ProfileProgressPhotosModal";
import ProfileSettingsModal, { ProfileSettingsLogoutButton } from "./ProfileSettingsModal";
import ProfileSettingsTab from "./ProfileSettingsTab";
import ProfileTelegramModal from "./ProfileTelegramModal";
import ProfileTrainerNotificationsModal from "./ProfileTrainerNotificationsModal";
import ProfileWorkoutJournalModal from "./ProfileWorkoutJournalModal";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const MAX_FEEDBACK_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function getSafeFeedbackAttachmentName(file) {
  const rawName = file?.name || "attachment";
  const safeName = rawName
    .replace(/[^\w.\-а-яА-ЯёЁ]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);

  return safeName || "attachment";
}

export default function ProfileDashboardRoute(ctx) {
  const [profilePasswordModalOpen, setProfilePasswordModalOpen] = useState(false);
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
    changeProfileLogin,
    changeProfilePassword,
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
    profileEmailConnectOpen,
    profileFeedbackModalOpen,
    profileMeasurements,
    profileMeasurementsModalOpen,
    profileNutritionModalOpen,
    profileNutritionSaveStatus,
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
    requestProfileEmailChange,
    safeWriteUserJsonStorage,
    saveAiBodyMetrics,
    saveClientProgressPhotos,
    saveProfileAccount,
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
    setProfileEmailConnectOpen,
    setProfileFeedbackModalOpen,
    setProfileMeasurementOpen,
    setProfileMeasurementReturnTab,
    setProfileMeasurementStatus,
    setProfileMeasurementWizardStep,
    setProfileMeasurementsModalOpen,
    setProfileNutritionModalOpen,
    setProfileNutritionSaveStatus,
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
    storage,
    telegramConnectOpen,
    telegramLoginWidgetReady,
    telegramLinking,
    telegramProfile,
    telegramStatus,
    todayNutritionKey,
    toggleAppTheme,
    toggleCabinetWorkoutHistory,
    updateClientTrainerTask,
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

  const authProviderIds = new Set((user?.providerData || []).map((provider) => provider.providerId));
  const hasPasswordProvider = authProviderIds.has("password");
  const hasGoogleProvider = authProviderIds.has("google.com");

  function openProfileWorkoutJournalCalendar() {
    setProfileSettingsModalOpen(false);
    setProfileWorkoutHistoryModalOpen(false);
    loadHistory();
    setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
    setProfileWorkoutCalendarEditing(false);
    setProfileWorkoutCalendarStatus("");
    setProfileProgressModalOpen(true);
  }

  function openProfileWorkoutJournalHistory(workoutId = "", programScope = null) {
    setProfileProgressModalOpen(false);
    openCabinetWorkoutHistory(workoutId, programScope);
  }

  function closeProfileWorkoutJournal() {
    setProfileProgressModalOpen(false);
    setProfileWorkoutHistoryModalOpen(false);
  }

  function switchProfileWorkoutJournalTab(tab) {
    if (tab === "history") {
      openProfileWorkoutJournalHistory();
      return;
    }

    openProfileWorkoutJournalCalendar();
  }

  function openProfileBodyControlPhotos() {
    setProfileMeasurementsModalOpen(false);
    setProfileProgressPhotoStatus("");
    setProfileProgressPhotoCompareIds([
      clientProgressPhotos[1]?.id || "",
      clientProgressPhotos[0]?.id || ""
    ]);
    setProfileProgressPhotoCompareView("front");
    setProfileProgressPhotosModalOpen(true);
  }

  function openProfileBodyControlMeasurements() {
    if (profileProgressPhotoUploading) return;
    setProfileProgressPhotosModalOpen(false);
    setProfileMeasurementsModalOpen(true);
  }

  async function submitProfileFeedback(feedbackDraft) {
    if (!user?.uid) {
      throw new Error("User is required to send feedback");
    }

    const feedbackId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const attachmentFile = feedbackDraft?.attachmentFile || null;
    const feedbackPayload = { ...feedbackDraft };
    delete feedbackPayload.attachmentFile;

    let attachment = null;

    if (attachmentFile) {
      if (!storage) {
        throw new Error("Storage is required to upload feedback attachment");
      }

      if (attachmentFile.size > MAX_FEEDBACK_ATTACHMENT_BYTES) {
        throw new Error("Feedback attachment is too large");
      }

      const safeName = getSafeFeedbackAttachmentName(attachmentFile);
      const attachmentRef = ref(storage, `feedback/${user.uid}/${feedbackId}/${Date.now()}-${safeName}`);
      await uploadBytes(attachmentRef, attachmentFile, {
        contentType: attachmentFile.type || "application/octet-stream",
        customMetadata: {
          feedbackId,
          source: "client-cabinet",
          userId: user.uid
        }
      });

      attachment = {
        name: attachmentFile.name,
        path: attachmentRef.fullPath,
        size: attachmentFile.size,
        type: attachmentFile.type || "",
        url: await getDownloadURL(attachmentRef)
      };
    }

    await setDoc(doc(db, "users", user.uid, "feedback", feedbackId), {
      ...feedbackPayload,
      attachment,
      appVersion: APP_VERSION || "",
      createdAt: new Date().toISOString(),
      displayName: profileAccount?.displayName || activeProfile?.name || user.displayName || "",
      email: profileAccount?.email || user.email || "",
      source: "client-cabinet",
      status: "new",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      userId: user.uid
    });
  }

  const profileShellMode = isMainDashboard ? "main" : visibleProfileTab;
  const useLegacyTrainerShell = currentUserRole === "trainer" && !canUseAdminFeatures();

  return (
    <ProfileDashboardShell
      legacyTrainer={useLegacyTrainerShell}
      mode={profileShellMode}
      testId="profile-dashboard-route"
    >
      <ProfilePageChrome
        isMainDashboard={isMainDashboard}
        renderBottomBar={renderClientMainBottomBar}
        showTrainerNotifications={!canUseTrainerFeatures()}
        trainerNotificationCount={trainerNotificationCount}
        onOpenTrainerNotifications={() => setProfileTrainerNotificationsOpen(true)}
      />

      {!isMainDashboard && visibleProfileTab === "cabinet" && (
        <ProfileCabinetTitleRow
          onRefresh={refreshPage}
        />
      )}

      <ProfileDashboardContent
        legacyTrainer={useLegacyTrainerShell}
        mode={profileShellMode}
      >
        {visibleProfileTab === "cabinet" && isMainDashboard && (
          <ProfileMainHeroStatsShell>
            <ProfileHeroCard
              telegramProfile={telegramProfile}
              avatarUrl={profileAvatarUrl}
              greetingName={greetingName}
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
          </ProfileMainHeroStatsShell>
        )}

        {!isMainDashboard && visibleProfileTab === "cabinet" && (
          <ProfileCabinetActionGrid
            showClientOnlyActions={!canUseTrainerFeatures()}
            accountAvatarUrl={profileAvatarUrl}
            latestPhotoText={latestClientProgressPhoto
              ? `Последние: ${new Date(`${latestClientProgressPhoto.date || latestClientProgressPhoto.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}`
              : "Добавь первые фото"}
            latestMeasurementText={latestProfileMeasurement ? formatProfileMeasurementDate(latestProfileMeasurement) : "Замеров пока нет"}
            nutritionText={`${Math.round(profileMacros.calories || nutrition.goals.calories)} ккал · ${activeGoalLabel}`}
            historyText={history.length ? `${history.length} тренировок сохранено` : "История пока пустая"}
            onOpenBodyControl={openProfileBodyControlPhotos}
            onOpenNutrition={() => {
              setProfileNutritionSaveStatus("");
              setSelectedNutritionDateKey(todayNutritionKey());
              setProfileNutritionModalOpen(true);
            }}
            onOpenCalendar={openProfileWorkoutJournalCalendar}
            onOpenAccount={openProfileAccount}
            onOpenQuestionnaire={() => {
              setProfileBodyMetricsOpen(true);
              setProfileSettingsModalSection("profile");
              setProfileSettingsModalOpen(true);
            }}
            onOpenFeedback={() => setProfileFeedbackModalOpen(true)}
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
            progressInsight={progressInsight}
            statuses={aiCoachStatuses}
          />
        )}

        {isMainDashboard && (
          <ProfileMainMeasurementSnapshot
            measurementSeries={mainMeasurementSeries}
            latestMeasurement={latestProfileMeasurement}
            latestWeight={mainLatestWeight}
            weightChange={mainWeightChange}
          />
        )}

        {isMainDashboard && APP_VERSION && (
          <ProfileDashboardVersion>{APP_VERSION}</ProfileDashboardVersion>
        )}

        <ProfileMeasurementWizardPanel
          visible={visibleProfileTab === "measurements"}
          latestMeasurement={latestProfileMeasurement}
          measurementFields={getProfileMeasurementFields(activeProfile?.goal || "recomp")}
          formatMeasurementDate={formatProfileMeasurementDate}
          getMeasurementValue={getProfileMeasurementValue}
          onStart={() => {
            setProfileMeasurementReturnTab("measurements");
            setProfileMeasurementOpen(false);
            setProfileMeasurementWizardStep(0);
            setProfileMeasurementStatus("");
            setPage(APP_PAGES.MEASUREMENT_WIZARD);
          }}
        />
      </ProfileDashboardContent>

      <ProfileMeasurementsModal
        open={profileMeasurementsModalOpen && !isMainDashboard && visibleProfileTab === "cabinet"}
        latestMeasurement={latestProfileMeasurement}
        measurementFields={getProfileMeasurementFields(activeProfile?.goal || "recomp")}
        formatMeasurementDate={formatProfileMeasurementDate}
        getMeasurementValue={getProfileMeasurementValue}
        onClose={() => setProfileMeasurementsModalOpen(false)}
        onOpenPhotos={openProfileBodyControlPhotos}
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
        onOpenMeasurements={openProfileBodyControlMeasurements}
        onSelectPhoto={selectClientProgressPhoto}
        onCompareIdsChange={(slot, value) => setProfileProgressPhotoCompareIds((current) => {
          const next = [...current];
          next[slot] = value;
          return next;
        })}
        onCompareViewChange={setProfileProgressPhotoCompareView}
        onSave={saveClientProgressPhotos}
      />

      <ProfileWorkoutJournalModal
        open={(profileProgressModalOpen || profileWorkoutHistoryModalOpen) && !isMainDashboard && visibleProfileTab === "cabinet"}
        activeTab={profileWorkoutHistoryModalOpen ? "history" : "calendar"}
        modalBodyRef={profileSettingsModalBodyRef}
        onClose={closeProfileWorkoutJournal}
        onTabChange={switchProfileWorkoutJournalTab}
        calendarProps={{
          monthDate: workoutCalendarMonthDate,
          monthKey: profileWorkoutCalendarMonth,
          calendarDays: workoutCalendarDays,
          selectedDate: profileWorkoutCalendarDate,
          selectedItems: selectedWorkoutCalendarItems,
          scheduledDates: profileWorkoutScheduledDates,
          draftDates: profileWorkoutCalendarDraftDates,
          editing: profileWorkoutCalendarEditing,
          saving: profileWorkoutCalendarSaving,
          status: profileWorkoutCalendarStatus,
          getTimestampValue,
          onShiftMonth: shiftProfileWorkoutCalendarMonth,
          onStartEdit: () => {
            setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
            setProfileWorkoutCalendarEditing(true);
            setProfileWorkoutCalendarStatus("");
          },
          onCancelEdit: () => {
            setProfileWorkoutCalendarDraftDates(profileWorkoutScheduledDates);
            setProfileWorkoutCalendarEditing(false);
            setProfileWorkoutCalendarStatus("");
          },
          onSave: saveProfileWorkoutCalendar,
          onDayClick: (day) => {
            setProfileWorkoutCalendarDate(day.key);
            if (profileWorkoutCalendarEditing && day.isCurrentMonth) {
              toggleProfileWorkoutScheduledDate(day.key);
            }
          },
          onOpenHistory: openProfileWorkoutJournalHistory
        }}
        historyProps={{
          programScope: profileWorkoutHistoryProgramScope,
          loading: historyLoading,
          items: profileWorkoutHistoryItems,
          openItemId: openHistoryKey,
          itemRefs: cabinetWorkoutHistoryItemRefs,
          deletingId: historyDeletingId,
          getTimestampValue,
          onToggleItem: toggleCabinetWorkoutHistory,
          onRequestDelete: requestDeleteOwnHistoryWorkout
        }}
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
          <>
            <ProfileAccountSettingsSection
              avatarPreview={profileAccountAvatarPreview}
              avatarUrl={profileAvatarUrl}
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
                setProfilePasswordModalOpen(true);
              }}
              onSave={saveProfileAccount}
            />
            <ProfileAppSettingsSection
              variant="account"
              isWarmLightTheme={appTheme === APP_THEMES.WARM_LIGHT}
              email={profileAccount?.email || user?.email || ""}
              telegramProfile={telegramProfile}
              onToggleTheme={toggleAppTheme}
              onOpenEmail={() => {
                setProfileAccountStatus("");
                setProfileEmailConnectOpen(true);
              }}
              onOpenTelegram={() => {
                setTelegramStatus("");
                setTelegramConnectOpen(true);
              }}
              onTelegramAvatarError={handleTelegramAvatarError}
            />
            <ProfileSettingsLogoutButton onClick={logout} />
          </>
        )}

        {profileSettingsModalSection === "profile" && (
          <ProfileBodyMetricsSettingsSection
            variant="modal"
            open={profileBodyMetricsOpen}
            draft={aiNutritionProfileDraft}
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
            variant="modal"
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
        open={profileTrainerNotificationsOpen && !canUseTrainerFeatures()}
        tasks={clientTrainerTasks}
        activeCount={trainerNotificationCount}
        getTaskDestination={getClientTrainerTaskDestination}
        onClose={() => setProfileTrainerNotificationsOpen(false)}
        onOpenTask={onOpenClientTrainerTask}
        onUpdateTask={updateClientTrainerTask}
      />

      {profileFeedbackModalOpen && !isMainDashboard && visibleProfileTab === "cabinet" ? (
        <ProfileFeedbackModal
          open
          defaultContact={profileAccount?.email || user?.email || telegramProfile?.username || ""}
          onClose={() => setProfileFeedbackModalOpen(false)}
          onSubmit={submitProfileFeedback}
        />
      ) : null}

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

      {profileEmailConnectOpen ? (
        <ProfileEmailModal
          open
          email={profileAccount?.email || user?.email || ""}
          saving={profileAccountSaving}
          status={profileAccountStatus}
          onClose={() => setProfileEmailConnectOpen(false)}
          onRequestEmailChange={requestProfileEmailChange}
        />
      ) : null}

      {profilePasswordModalOpen ? (
        <ProfilePasswordModal
          open
          hasPasswordProvider={hasPasswordProvider}
          hasGoogleProvider={hasGoogleProvider}
          saving={profileAccountSaving}
          status={profileAccountStatus}
          onClose={() => setProfilePasswordModalOpen(false)}
          onChangePassword={changeProfilePassword}
          onSendPasswordReset={sendProfilePasswordReset}
        />
      ) : null}

      <ProfileSettingsTab
        visible={visibleProfileTab === "settings"}
        bodyMetricsOpen={profileBodyMetricsOpen}
        draft={aiNutritionProfileDraft}
        isWarmLightTheme={appTheme === APP_THEMES.WARM_LIGHT}
        email={profileAccount?.email || user?.email || ""}
        telegramProfile={telegramProfile}
        onToggleBodyMetrics={() => setProfileBodyMetricsOpen((prev) => !prev)}
        onDraftChange={(field, value) => setAiNutritionProfileDraft((prev) => ({ ...prev, [field]: value }))}
        onSaveBodyMetrics={saveAiBodyMetrics}
        onToggleTheme={toggleAppTheme}
        onOpenEmail={() => {
          setProfileAccountStatus("");
          setProfileEmailConnectOpen(true);
        }}
        onOpenTelegram={() => {
          setTelegramStatus("");
          setTelegramConnectOpen(true);
        }}
        onTelegramAvatarError={handleTelegramAvatarError}
      />
    </ProfileDashboardShell>
  );
}
