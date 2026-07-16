import AccessDeniedScreen from "../../components/common/AccessDeniedScreen";
import TrainerDashboardWorkspaceRoute from "./TrainerDashboardWorkspaceRoute";
import { buildTrainerDashboardPageModel } from "./trainerDashboardPageModel";

export default function TrainerDashboardRoute(ctx) {
  const {
    APP_PAGES,
    adminClientFilter,
    adminClientHistory,
    adminClientNutrition,
    adminClientTasks,
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
    adminClientTasks,
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

  return (
    <TrainerDashboardWorkspaceRoute
      {...ctx}
      {...model}
      trainerName={model.adminGreetingName}
    />
  );
}
