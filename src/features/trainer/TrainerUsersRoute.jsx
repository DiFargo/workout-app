import AccessDeniedScreen from "../../components/common/AccessDeniedScreen";
import AdminClientProfileRoute from "./AdminClientProfileRoute";
import AdminTrainerProfileRoute, { isAdminTrainerSelection } from "./AdminTrainerProfileRoute";
import AdminUsersWorkspaceRoute from "./AdminUsersWorkspaceRoute";
import TrainerClientsWorkspaceRoute from "./TrainerClientsWorkspaceRoute";
import TrainerUsersLegacyRoute from "./TrainerUsersLegacyRoute";
import { buildTrainerUsersPageModel } from "./trainerUsersPageModel";

export default function TrainerUsersRoute(ctx) {
  const {
    APP_PAGES,
    adminCalendarDraft,
    adminClientEvents,
    adminClientFilter,
    adminClientHistory,
    adminClientMeasurements,
    adminClientNutrition,
    adminClientPayment,
    adminClientProgressPhotos,
    adminClientTasks,
    adminCreatedCredentials,
    adminPhotoCompareIds,
    adminSelectedClient,
    adminUsersSearch,
    auth,
    buildAdminNutritionMonthOverview,
    buildClientNutritionPresetOptions,
    canUseTrainerFeatures,
    formatProfileMeasurementDate,
    getAdminCalendarTrainingDaysLabel,
    getAdminClientProfile,
    getAdminMeasurementPreviewFields,
    getAdminNutritionDaysList,
    getAdminRecommendations,
    getAdminWorkoutProgressList,
    getAiNutritionWeekForDate,
    getClientEffectiveNutritionGoals,
    getClientNutritionDisplayPlan,
    getClientPaymentAttention,
    getClientPlateauInfo,
    getClientTelegramProfile,
    getProfileMeasurementDelta,
    getProfileMeasurementFields,
    getProfileMeasurementValueById,
    getTrainerClientSummaryFromMap,
    getTrainerDayWord,
    getTrainerSummaryDayStart,
    getTrainerSummaryDaysSince,
    getTrainerSummaryTimestamp,
    isTrainerNextWorkspace,
    selectedUserId,
    setPage,
    telegramProfile,
    trainerClientSummaries,
    usersList
  } = ctx;

  if (!canUseTrainerFeatures()) {
    return (
      <AccessDeniedScreen
        message="Тренерская доступна админам и пользователям с ролью тренера."
        onBack={() => setPage(APP_PAGES.MAIN)}
      />
    );
  }

  const isAdminWorkspace = typeof ctx.canUseAdminFeatures === "function" && ctx.canUseAdminFeatures();
  const hasSelectedAdminAccount = Boolean(ctx.adminClientPageOpen && ctx.adminSelectedClient);

  // Administrators get their own directory while no account is selected. A
  // trainer opens a dedicated account profile; a regular client intentionally
  // falls through to the existing client-detail route below.
  if (isAdminWorkspace && !hasSelectedAdminAccount) {
    return <AdminUsersWorkspaceRoute {...ctx} />;
  }

  if (
    isAdminWorkspace
    && isAdminTrainerSelection({
      canUseAdminFeatures: ctx.canUseAdminFeatures,
      selectedClient: ctx.adminSelectedClient
    })
  ) {
    return (
      <AdminTrainerProfileRoute
        {...ctx}
        selectedClient={ctx.adminSelectedClient}
      />
    );
  }

  const credentialsText = adminCreatedCredentials
    ? [
        "Доступ по приглашению",
        `Логин: ${adminCreatedCredentials.login || adminCreatedCredentials.email}`,
        adminCreatedCredentials.shareUrl
          ? `Активировать и задать пароль: ${adminCreatedCredentials.shareUrl}`
          : adminCreatedCredentials.inviteUrl ? `Ссылка: ${adminCreatedCredentials.inviteUrl}` : ""
      ].filter(Boolean).join("\n")
    : "";

  const model = buildTrainerUsersPageModel({
    adminCalendarDraft,
    adminClientFilter,
    adminClientHistory,
    adminClientMeasurements,
    adminClientNutrition,
    adminClientPayment,
    adminClientProgressPhotos,
    adminClientEvents,
    adminClientTasks,
    adminPhotoCompareIds,
    adminSelectedClient,
    adminUsersSearch,
    auth,
    buildAdminNutritionMonthOverview,
    buildClientNutritionPresetOptions,
    formatProfileMeasurementDate,
    getAdminCalendarTrainingDaysLabel,
    getAdminClientProfile,
    getAdminMeasurementPreviewFields,
    getAdminNutritionDaysList,
    getAdminRecommendations,
    getAdminWorkoutProgressList,
    getAiNutritionWeekForDate,
    getClientEffectiveNutritionGoals,
    getClientNutritionDisplayPlan,
    getClientPaymentAttention,
    getClientPlateauInfo,
    getClientTelegramProfile,
    getProfileMeasurementDelta,
    getProfileMeasurementFields,
    getProfileMeasurementValueById,
    getTrainerClientSummaryFromMap,
    getTrainerDayWord,
    getTrainerSummaryDayStart,
    getTrainerSummaryDaysSince,
    getTrainerSummaryTimestamp,
    selectedUserId,
    telegramProfile,
    trainerClientSummaries,
    usersList
  });

  // An administrator viewing a regular client must stay in the administrative
  // shell. TrainerClientsWorkspaceRoute is intentionally retained below for
  // trainers, whose workspace and navigation are different.
  if (isAdminWorkspace && hasSelectedAdminAccount) {
    return (
      <AdminClientProfileRoute
        {...ctx}
        {...model}
        selectedClient={adminSelectedClient}
      />
    );
  }

  if (isTrainerNextWorkspace()) {
    const selectedClient = adminSelectedClient || model.selectedClient;

    if (isAdminTrainerSelection({
      canUseAdminFeatures: ctx.canUseAdminFeatures,
      selectedClient
    })) {
      return (
        <AdminTrainerProfileRoute
          {...ctx}
          selectedClient={selectedClient}
        />
      );
    }

    return (
      <TrainerClientsWorkspaceRoute
        {...ctx}
        {...model}
      />
    );
  }

  return (
    <TrainerUsersLegacyRoute
      {...ctx}
      {...model}
      credentialsText={credentialsText}
    />
  );
}
