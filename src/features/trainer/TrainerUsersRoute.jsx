import AccessDeniedScreen from "../../components/common/AccessDeniedScreen";
import TrainerClientsWorkspaceRoute from "./TrainerClientsWorkspaceRoute";
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

  return (
    <TrainerClientsWorkspaceRoute
      {...ctx}
      {...model}
    />
  );
}
