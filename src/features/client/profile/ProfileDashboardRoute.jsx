import { useEffect, useRef, useState } from "react";
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
import ProfileQuickWeightModal from "./ProfileQuickWeightModal";
import ProfileWeightCheckInReminder from "./ProfileWeightCheckInReminder";
import { ProfileNextWorkoutCard } from "./ProfileMainSummaryCards";
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
import ProfileSettingsModal from "./ProfileSettingsModal";
import ProfileSettingsTab from "./ProfileSettingsTab";
import ProfileTelegramModal from "./ProfileTelegramModal";
import ProfileTrainerNotificationsModal from "./ProfileTrainerNotificationsModal";
import ProfileWorkoutJournalModal from "./ProfileWorkoutJournalModal";
import { WorkoutModePickerDialog } from "../workouts/WorkoutListDialogs";
import { uploadStorageFile } from "../../../utils/firebaseStorage";

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
  const [quickWeightModalOpen, setQuickWeightModalOpen] = useState(false);
  const [workoutModePickerOpen, setWorkoutModePickerOpen] = useState(false);
  const dashboardWorkoutModeRefreshRef = useRef("");
  const {
    AI_NUTRITION_WEEK_DAYS,
    APP_PAGES,
    APP_VERSION,
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
    cabinetWorkoutHistoryItemRefs,
    canUseAdminFeatures,
    canUseTrainerFeatures,
    changeProfileLogin,
    changeProfilePassword,
    checkTelegramLoginResult,
    clientProgressPhotos,
    clientTrainerTasks,
    loadClientTrainerTasks,
    loadWorkoutsFromFirebase,
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
    openIndividualWorkouts,
    openSavedBasicWorkoutsOrQuiz,
    openTrainingEntry,
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
    profileMeasurementSaving,
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
    saveProfileMeasurement,
    saveProfileNutritionPlanAndClose,
    saveWorkoutModePreference,
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
    toggleTelegramNotifications,
    todayNutritionKey,
    toggleCabinetWorkoutHistory,
    updateClientTrainerTask,
    user,
    workoutModePreference,
    changeProfileAvatarCropZoom,
    applyProfileAvatarCrop,
    endProfileAvatarCropDrag
  } = ctx;

  const loadClientTrainerTasksRef = useRef(loadClientTrainerTasks);
  const hasTrainerFeatures = canUseTrainerFeatures();

  useEffect(() => {
    loadClientTrainerTasksRef.current = loadClientTrainerTasks;
  }, [loadClientTrainerTasks]);

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
    homeWorkoutAction,
    nextWorkoutDate,
    nextWorkoutTitle,
    nextWorkoutExerciseCount,
    activeGoalLabel,
    profileMacros,
    profileNutritionDraftMacros,
    trainerNotificationCount,
    workoutCalendarMonthDate,
    workoutCalendarDays,
    selectedWorkoutCalendarItems,
    profileCalendarScheduledDates,
    canEditProfileWorkoutSchedule,
    shiftProfileWorkoutCalendarMonth,
    toggleProfileWorkoutScheduledDate,
    saveProfileWorkoutCalendar,
    profileAiNutritionPlan,
    profileAiNutritionWeek,
    profileAiNutritionActiveProfile,
    profileNutritionWeekDays,
    profileNutritionWeekLabel,
    profileNutritionSelectedTotals,
    nextTrainingText,
    greetingName,
    profileAvatarUrl,
    mainMeasurementSeries,
    mainLatestWeight,
    mainWeightChange,
    mainWeightTrendPeriod,
    weightCheckIn,
    progressInsight
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
    user,
    workoutModePreference
  });

  const clientUid = auth.currentUser?.uid || user?.uid || "";
  const selectedWorkoutMode = workoutModePreference?.mode === "basic" ? "basic" : "individual";

  useEffect(() => {
    if (!isMainDashboard || hasTrainerFeatures || !clientUid) return;

    void loadClientTrainerTasksRef.current?.(clientUid);
  }, [clientUid, hasTrainerFeatures, isMainDashboard]);

  useEffect(() => {
    if (!isMainDashboard || hasTrainerFeatures || !clientUid) {
      dashboardWorkoutModeRefreshRef.current = "";
      return;
    }

    const refreshKey = `${clientUid}:${selectedWorkoutMode}`;
    if (dashboardWorkoutModeRefreshRef.current === refreshKey) return;
    dashboardWorkoutModeRefreshRef.current = refreshKey;

    void loadWorkoutsFromFirebase?.(clientUid, {
      mode: selectedWorkoutMode,
      preserveCurrentPlanOnError: true
    }).catch((error) => {
      console.warn("Dashboard workout mode refresh failed:", error);
    });
  }, [clientUid, hasTrainerFeatures, isMainDashboard, loadWorkoutsFromFirebase, selectedWorkoutMode]);

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

  function openWorkoutModeSettings() {
    setWorkoutModePickerOpen(true);
  }

  function openProfileNutritionGoals() {
    setProfileNutritionSaveStatus("");
    selectNutritionDate(todayNutritionKey());
    setProfileNutritionModalOpen(true);
  }

  function openQuickWeightModal() {
    setProfileMeasurementStatus("");
    setQuickWeightModalOpen(true);
  }

  async function saveQuickWeight(weight) {
    return saveProfileMeasurement({ weight }, { measurementType: "weight_checkin" });
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
      if (attachmentFile.size > MAX_FEEDBACK_ATTACHMENT_BYTES) {
        throw new Error("Feedback attachment is too large");
      }

      const safeName = getSafeFeedbackAttachmentName(attachmentFile);
      const uploadedAttachment = await uploadStorageFile(`feedback/${user.uid}/${feedbackId}/${Date.now()}-${safeName}`, attachmentFile, {
        contentType: attachmentFile.type || "application/octet-stream",
        customMetadata: {
          feedbackId,
          source: "client-cabinet",
          userId: user.uid
        }
      });

      attachment = {
        name: attachmentFile.name,
        path: uploadedAttachment.path,
        size: attachmentFile.size,
        type: attachmentFile.type || "",
        url: uploadedAttachment.url
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
        onOpenTrainerNotifications={() => {
          if (clientUid) void loadClientTrainerTasks?.(clientUid);
          setProfileTrainerNotificationsOpen(true);
        }}
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
              activeGoalLabel={activeGoalLabel}
              totalWorkouts={totalWorkouts}
              targetWeight={activeProfile?.targetWeight}
              currentWeight={activeProfile?.weight}
              goalId={activeProfile?.goal}
            />
          </ProfileMainHeroStatsShell>
        )}

        {!isMainDashboard && visibleProfileTab === "cabinet" && (
          <ProfileCabinetActionGrid
            showClientOnlyActions={!canUseTrainerFeatures()}
            latestPhotoText={latestClientProgressPhoto
              ? `Последние: ${new Date(`${latestClientProgressPhoto.date || latestClientProgressPhoto.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}`
              : "Добавь первые фото"}
            latestMeasurementText={latestProfileMeasurement ? formatProfileMeasurementDate(latestProfileMeasurement) : "Замеров пока нет"}
            weightText={weightCheckIn.cabinetText}
            nutritionText={`${Math.round(profileMacros.calories || nutrition.goals.calories)} ккал · ${activeGoalLabel}`}
            historyText={history.length ? `${history.length} тренировок сохранено` : "История пока пустая"}
            onOpenBodyControl={openProfileBodyControlPhotos}
            onOpenWeight={openQuickWeightModal}
            onOpenNutrition={openProfileNutritionGoals}
            onOpenCalendar={openProfileWorkoutJournalCalendar}
            onOpenAccount={openProfileAccount}
            onOpenQuestionnaire={() => {
              setProfileBodyMetricsOpen(true);
              setProfileSettingsModalSection("profile");
              setProfileSettingsModalOpen(true);
            }}
            workoutModeLabel={workoutModePreference?.mode === "basic"
              ? "Базовые тренировки"
              : "Индивидуальный план от тренера"}
            onOpenWorkoutMode={openWorkoutModeSettings}
            onOpenNotifications={() => {
              setProfileSettingsModalSection("settings");
              setProfileSettingsModalOpen(true);
            }}
            onOpenFeedback={() => setProfileFeedbackModalOpen(true)}
            onLogout={logout}
          />
        )}

        {isMainDashboard && (
          <ProfileNextWorkoutCard
            title={homeWorkoutAction.title || nextWorkoutTitle}
            dateText={homeWorkoutAction.dateText || nextWorkoutDate || nextTrainingText}
            exerciseCount={homeWorkoutAction.exerciseCount ?? nextWorkoutExerciseCount}
            eyebrow={homeWorkoutAction.eyebrow}
            actionLabel={homeWorkoutAction.actionLabel}
            state={homeWorkoutAction.state}
            onOpen={openTrainingEntry}
          />
        )}

        {isMainDashboard && (
          <ProfileProgressInsightCard
            progressInsight={progressInsight}
          />
        )}

        {isMainDashboard && weightCheckIn.isDue && (
          <ProfileWeightCheckInReminder
            checkIn={weightCheckIn}
            onOpen={openQuickWeightModal}
          />
        )}

        {isMainDashboard && (
          <ProfileMainMeasurementSnapshot
            measurementSeries={mainMeasurementSeries}
            latestWeight={mainLatestWeight}
            weightChange={mainWeightChange}
            weightTrendPeriod={mainWeightTrendPeriod}
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

      {quickWeightModalOpen && (
        <ProfileQuickWeightModal
          open
          initialWeight=""
          saving={profileMeasurementSaving}
          onClose={() => setQuickWeightModalOpen(false)}
          onSave={saveQuickWeight}
          onSuccessAcknowledged={() => {
            setQuickWeightModalOpen(false);
          }}
        />
      )}

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

      <WorkoutModePickerDialog
        open={workoutModePickerOpen}
        workoutModePreference={workoutModePreference || { mode: "individual", remember: false }}
        onClose={() => setWorkoutModePickerOpen(false)}
        onOpenBasic={() => {
          setWorkoutModePickerOpen(false);
          openSavedBasicWorkoutsOrQuiz();
        }}
        onOpenIndividual={() => {
          setWorkoutModePickerOpen(false);
          openIndividualWorkouts();
        }}
        onRememberChoiceChange={(remember) => {
          saveWorkoutModePreference(
            workoutModePreference?.mode === "basic" ? "basic" : "individual",
            remember
          );
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
        onSuccessAcknowledged={() => {
          setProfileProgressPhotosModalOpen(false);
          setProfileProgressPhotoStatus("");
        }}
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
          scheduledDates: profileCalendarScheduledDates,
          draftDates: profileWorkoutCalendarDraftDates,
          canEditSchedule: canEditProfileWorkoutSchedule,
          editing: profileWorkoutCalendarEditing,
          saving: profileWorkoutCalendarSaving,
          status: profileWorkoutCalendarStatus,
          getTimestampValue,
          onShiftMonth: shiftProfileWorkoutCalendarMonth,
          onStartEdit: () => {
            if (!canEditProfileWorkoutSchedule) return;
            setProfileWorkoutCalendarDraftDates(profileCalendarScheduledDates);
            setProfileWorkoutCalendarEditing(true);
            setProfileWorkoutCalendarStatus("");
          },
          onCancelEdit: () => {
            setProfileWorkoutCalendarDraftDates(profileCalendarScheduledDates);
            setProfileWorkoutCalendarEditing(false);
            setProfileWorkoutCalendarStatus("");
          },
          onSave: saveProfileWorkoutCalendar,
          onDayClick: (day) => {
            setProfileWorkoutCalendarDate(day.key);
            if (canEditProfileWorkoutSchedule && profileWorkoutCalendarEditing && day.isCurrentMonth) {
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
              showEmail={false}
              showTelegram={false}
            />
          </>
        )}

        {profileSettingsModalSection === "profile" && (
          <ProfileBodyMetricsSettingsSection
            variant="modal"
            open={profileBodyMetricsOpen}
            draft={aiNutritionProfileDraft}
            onToggle={() => setProfileBodyMetricsOpen((prev) => !prev)}
            onDraftChange={(field, value) => setAiNutritionProfileDraft((prev) => ({ ...prev, [field]: value }))}
            onSave={saveAiBodyMetrics}
            onSaved={() => setProfileSettingsModalOpen(false)}
          />
        )}

        {profileSettingsModalSection === "settings" && (
          <ProfileAppSettingsSection
            variant="modal"
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
            showNotifications
            notificationsEnabled={telegramProfile.notificationsEnabled !== false}
            onToggleNotifications={toggleTelegramNotifications}
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
        open={profileNutritionModalOpen && visibleProfileTab === "cabinet"}
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
        onSuccessAcknowledged={() => {
          setProfileNutritionModalOpen(false);
          setProfileNutritionSaveStatus("");
        }}
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
        email={profileAccount?.email || user?.email || ""}
        telegramProfile={telegramProfile}
        onToggleBodyMetrics={() => setProfileBodyMetricsOpen((prev) => !prev)}
        onDraftChange={(field, value) => setAiNutritionProfileDraft((prev) => ({ ...prev, [field]: value }))}
        onSaveBodyMetrics={saveAiBodyMetrics}
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
