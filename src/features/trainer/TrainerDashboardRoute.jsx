import AccessDeniedScreen from "../../components/common/AccessDeniedScreen";
import TrainerDashboardWorkspaceRoute from "./TrainerDashboardWorkspaceRoute";
import TrainerLegacyDashboardRoute from "./TrainerLegacyDashboardRoute";
import { buildTrainerDashboardPageModel } from "./trainerDashboardPageModel";

export default function TrainerDashboardRoute(ctx) {
  const {
    APP_PAGES,
    adminClientFilter,
    adminClientHistory,
    adminClientNutrition,
    adminSelectedClient,
    auth,
    buildClientNutritionPresetOptions,
    buildTrainerDashboardSummary,
    canUseTrainerFeatures,
    getAdminAverageNutritionScore,
    getAdminClientChartScales,
    getAdminClientProfile,
    getAdminNutritionDaysList,
    getAdminRecommendations,
    getAdminWeightPoints,
    getAdminWorkoutProgressList,
    getAiNutritionWeekForDate,
    getClientActivityStatus,
    getClientEffectiveNutritionGoals,
    getClientNutritionDisplayPlan,
    getTrainerClientSummaryFromMap,
    isTrainerNextWorkspace,
    selectedUserId,
    setPage,
    telegramProfile,
    trainerClientSummaries,
    trainerNextSection,
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

  const model = buildTrainerDashboardPageModel({
    adminClientFilter,
    adminClientHistory,
    adminClientNutrition,
    adminSelectedClient,
    auth,
    buildClientNutritionPresetOptions,
    buildTrainerDashboardSummary,
    getAdminAverageNutritionScore,
    getAdminClientChartScales,
    getAdminClientProfile,
    getAdminNutritionDaysList,
    getAdminRecommendations,
    getAdminWeightPoints,
    getAdminWorkoutProgressList,
    getAiNutritionWeekForDate,
    getClientActivityStatus,
    getClientEffectiveNutritionGoals,
    getClientNutritionDisplayPlan,
    getTrainerClientSummaryFromMap,
    selectedUserId,
    telegramProfile,
    trainerClientSummaries,
    trainerNextSection,
    usersList
  });

  if (isTrainerNextWorkspace()) {
    return (
      <TrainerDashboardWorkspaceRoute
        {...ctx}
        {...model}
        trainerName={model.adminGreetingName}
      />
    );
  }

  return (
    <TrainerLegacyDashboardRoute
      {...ctx}
      {...model}
    />
  );
}
