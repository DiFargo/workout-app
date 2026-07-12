import {
  buildTrainerActionCenter,
  buildTrainerClientSnapshot,
  buildTrainerWorkoutReview
} from "../../utils/trainerActionCenter.js";

export function buildTrainerDashboardPageModel({
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
}) {
  const getDashboardClientSummary = (client = {}) =>
    getTrainerClientSummaryFromMap(client, trainerClientSummaries);
  const trainerDashboardSummary = buildTrainerDashboardSummary(usersList, trainerClientSummaries);
  const trainerActionCenter = buildTrainerActionCenter(usersList, trainerClientSummaries);
  const trainerStatusCounts = trainerDashboardSummary.statusCounts;
  const trainerProblemClients = trainerDashboardSummary.problemClients;
  const trainerAiFocusItems = trainerDashboardSummary.focusItems;
  const trainerRecentEvents = trainerDashboardSummary.recentEvents;

  const filteredUsers = usersList.filter((client) => {
    const profile = getAdminClientProfile(client);
    const goal = String(profile?.goal || "").toLowerCase();
    const status = getClientActivityStatus(getDashboardClientSummary(client));

    if (adminClientFilter === "all") return true;
    if (adminClientFilter === "active") return status.id === "active";
    if (adminClientFilter === "attention") return ["attention", "noProgram"].includes(status.id);
    if (adminClientFilter === "inactive") return status.id === "lost";
    return goal === adminClientFilter;
  });

  const selectedClient = adminSelectedClient || usersList.find((client) => client.id === selectedUserId) || filteredUsers[0] || usersList[0] || null;
  const selectedProfile = getAdminClientProfile(selectedClient || {});
  const clientNutritionDays = getAdminNutritionDaysList(adminClientNutrition);
  const clientToday = clientNutritionDays[0] || { totals: { calories: 0, protein: 0, fat: 0, carbs: 0 }, foods: [], score: "—" };
  const workoutProgress = getAdminWorkoutProgressList(adminClientHistory);
  const weightPoints = getAdminWeightPoints(selectedClient || {});
  const recommendations = getAdminRecommendations(selectedClient || {}, adminClientHistory, adminClientNutrition);
  const selectedNutritionFallbackGoals = selectedClient?.nutritionGoals || adminClientNutrition?.goals || {};
  const selectedEffectiveNutritionGoals = getClientEffectiveNutritionGoals(
    selectedClient || {},
    adminClientNutrition,
    selectedNutritionFallbackGoals
  );
  const trainerNutritionPlanOptions = buildClientNutritionPresetOptions(
    selectedClient || {},
    adminClientNutrition,
    adminClientHistory
  );
  const aiPlan = getClientNutritionDisplayPlan(selectedClient || {}, adminClientNutrition, selectedNutritionFallbackGoals);
  const aiWeek = getAiNutritionWeekForDate(aiPlan) || aiPlan?.weeks?.[0] || null;
  const { maxCalories, maxProtein, maxWeight } = getAdminClientChartScales(clientNutritionDays, weightPoints);
  const averageAiScore = getAdminAverageNutritionScore(clientNutritionDays);
  const attentionCount = trainerStatusCounts.attention + trainerStatusCounts.lost + trainerStatusCounts.noProgram;
  const adminGreetingName = telegramProfile.displayName || auth.currentUser?.displayName || auth.currentUser?.email?.split("@")?.[0] || "тренер";
  const adminDashboardDate = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const trainerNextSummaries = Object.fromEntries(
    usersList.map((client) => {
      const summary = getDashboardClientSummary(client);
      return [client.id, {
        ...summary,
        status: getClientActivityStatus(summary)
      }];
    })
  );
  const trainerNextSelectedSummary = selectedClient
    ? getDashboardClientSummary(selectedClient)
    : {};
  const selectedClientSnapshot = selectedClient
    ? buildTrainerClientSnapshot(
      selectedClient,
      trainerNextSelectedSummary,
      adminClientTasks,
      adminClientHistory
    )
    : null;
  const selectedLastWorkoutReview = buildTrainerWorkoutReview(adminClientHistory?.[0] || {}, {});
  const trainerNextMode = trainerNextSection === "clients"
    ? "clients"
    : trainerNextSection === "client" && selectedClient
      ? "client"
      : trainerNextSection === "cabinet"
        ? "cabinet"
        : ["messages", "analytics", "notifications"].includes(trainerNextSection)
          ? trainerNextSection
          : "dashboard";
  const trainerNextActiveSection = trainerNextMode === "client" ? "clients" : trainerNextMode === "cabinet" ? "more" : trainerNextMode;

  return {
    adminDashboardDate,
    adminGreetingName,
    aiPlan,
    aiWeek,
    attentionCount,
    averageAiScore,
    clientNutritionDays,
    clientToday,
    filteredUsers,
    maxCalories,
    maxProtein,
    maxWeight,
    recommendations,
    selectedClient,
    selectedClientSnapshot,
    selectedEffectiveNutritionGoals,
    selectedLastWorkoutReview,
    selectedNutritionFallbackGoals,
    selectedProfile,
    trainerAiFocusItems,
    trainerActionCenter,
    trainerNextActiveSection,
    trainerNextMode,
    trainerNextSelectedSummary,
    trainerNextSummaries,
    trainerNutritionPlanOptions,
    trainerProblemClients,
    trainerRecentEvents,
    trainerStatusCounts,
    weightPoints,
    workoutProgress
  };
}
