export function buildTrainerUsersPageModel({
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
}) {
  const credentialsText = null;
  const getClientCardSummary = (client = {}) =>
    getTrainerClientSummaryFromMap(client, trainerClientSummaries);

  const adminUsersFilteredClients = usersList.filter((client) => {
    const search = adminUsersSearch.trim().toLowerCase();
    const matchesSearch = !search ||
      String(client.name || "").toLowerCase().includes(search) ||
      String(client.email || "").toLowerCase().includes(search);

    if (!matchesSearch) return false;

    const clientHistory = adminSelectedClient?.id === client.id ? adminClientHistory : [];
    const lastWorkoutDate = clientHistory[0]?.date ? new Date(clientHistory[0].date) : null;
    const daysSinceWorkout = lastWorkoutDate
      ? Math.round((Date.now() - lastWorkoutDate.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const badCount = clientHistory.filter((item) => item.postWorkoutFeedback?.id === "bad").length;

    if (adminClientFilter === "active") return daysSinceWorkout === null || daysSinceWorkout <= 7;
    if (adminClientFilter === "attention") return badCount >= 2 || daysSinceWorkout >= 5;
    return true;
  });

  const selectedClient = adminSelectedClient ||
    usersList.find((client) => client.id === selectedUserId) ||
    adminUsersFilteredClients[0] ||
    null;
  const selectedProfile = getAdminClientProfile(selectedClient || {});
  const selectedLatestMeasurement = Array.isArray(adminClientMeasurements) && adminClientMeasurements.length
    ? adminClientMeasurements[0]
    : null;
  const selectedPreviousMeasurement = Array.isArray(adminClientMeasurements) && adminClientMeasurements.length > 1
    ? adminClientMeasurements[1]
    : null;
  const adminMeasurementFields = getProfileMeasurementFields(selectedProfile?.goal || "recomp");
  const adminMeasurementPreviewFields = getAdminMeasurementPreviewFields(adminMeasurementFields);
  const clientNutritionDays = getAdminNutritionDaysList(adminClientNutrition);
  const clientToday = clientNutritionDays[0] || {
    totals: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    foods: [],
    score: "—"
  };
  const workoutProgress = getAdminWorkoutProgressList(adminClientHistory);
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
  const lastWorkout = adminClientHistory[0];
  const nutritionMonthOverview = buildAdminNutritionMonthOverview(clientNutritionDays);
  const nutritionMonthDays = nutritionMonthOverview.days;
  const nutritionMonthLabel = nutritionMonthOverview.label;
  const nutritionMonthAverageCalories = nutritionMonthOverview.averageCalories;
  const nutritionMonthAverageProtein = nutritionMonthOverview.averageProtein;
  const dailyCalorieGoal = Number(selectedEffectiveNutritionGoals.calories) || 2400;
  const dailyProteinGoal = Number(selectedEffectiveNutritionGoals.protein) || 160;
  const dailyFatGoal = Number(selectedEffectiveNutritionGoals.fat) || 75;
  const dailyCarbsGoal = Number(selectedEffectiveNutritionGoals.carbs) || 260;
  const currentMonthTrainingDays = getAdminCalendarTrainingDaysLabel(adminCalendarDraft.trainingDays);
  const selectedPlateau = getClientPlateauInfo(adminClientMeasurements);
  const selectedPaymentAttention = getClientPaymentAttention(adminClientPayment);
  const selectedSummary = selectedClient ? trainerClientSummaries[selectedClient.id] || {} : {};
  const selectedPhotoCompare = adminPhotoCompareIds.map((photoId) => (
    adminClientProgressPhotos.find((photo) => photo.id === photoId) || null
  ));
  const trainerAiRecommendations = [
    selectedPlateau.isPlateau
      ? `Вес почти не меняется ${selectedPlateau.days} дней. Проверь калории, шаги и прогрессию нагрузки.`
      : "",
    selectedSummary.averageCalories7 && selectedSummary.averageCalories7 < dailyCalorieGoal * 0.85
      ? `Средняя калорийность ниже цели примерно на ${Math.round(dailyCalorieGoal - selectedSummary.averageCalories7)} ккал.`
      : "",
    selectedSummary.averageCalories7 && selectedSummary.averageCalories7 > dailyCalorieGoal * 1.15
      ? `Средняя калорийность выше цели примерно на ${Math.round(selectedSummary.averageCalories7 - dailyCalorieGoal)} ккал.`
      : "",
    !selectedClient?.assignedProgramId
      ? "У клиента нет назначенной программы тренировок."
      : "",
    adminClientHistory[0]?.clientComment
      ? `Комментарий после тренировки: ${adminClientHistory[0].clientComment}`
      : ""
  ].filter(Boolean);
  const selectedTelegramProfile = getClientTelegramProfile(selectedClient);
  const selectedWorkoutDays = getTrainerSummaryDaysSince(selectedSummary.lastWorkoutAt);
  const selectedNutritionDays = getTrainerSummaryDaysSince(selectedSummary.lastNutritionAt);
  const selectedMeasurementDays = selectedLatestMeasurement
    ? getTrainerSummaryDaysSince(selectedSummary.lastMeasurementAt)
    : null;
  const selectedNutritionTodayStart = getTrainerSummaryDayStart();
  const selectedNutritionWeek = clientNutritionDays.filter((day) => {
    const timestamp = getTrainerSummaryTimestamp(day.date);
    return timestamp &&
      timestamp >= selectedNutritionTodayStart - 7 * 24 * 60 * 60 * 1000 &&
      timestamp < selectedNutritionTodayStart;
  });
  const selectedNutritionTrackedDays = selectedNutritionWeek.filter((day) => (
    Number(day.totals?.calories) > 0 ||
    Number(day.totals?.protein) > 0 ||
    Number(day.totals?.fat) > 0 ||
    Number(day.totals?.carbs) > 0
  ));
  const selectedNutritionAverage = selectedNutritionTrackedDays.reduce((totals, day) => ({
    calories: totals.calories + (Number(day.totals?.calories) || 0),
    protein: totals.protein + (Number(day.totals?.protein) || 0),
    fat: totals.fat + (Number(day.totals?.fat) || 0),
    carbs: totals.carbs + (Number(day.totals?.carbs) || 0)
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
  const selectedNutritionDivisor = Math.max(1, selectedNutritionTrackedDays.length);
  Object.keys(selectedNutritionAverage).forEach((key) => {
    selectedNutritionAverage[key] = Math.round(selectedNutritionAverage[key] / selectedNutritionDivisor);
  });
  const selectedNutritionDays7Complete = selectedNutritionTrackedDays.length;
  const selectedNutritionCompliance = selectedNutritionAverage.calories
    ? Math.min(100, Math.round(selectedNutritionAverage.calories / dailyCalorieGoal * 100))
    : 0;
  const getSelectedMeasurementValue = (fieldId, source = selectedLatestMeasurement) => (
    getProfileMeasurementValueById(source, adminMeasurementFields, fieldId)
  );
  const selectedWeightValue = getSelectedMeasurementValue("weight") || selectedProfile?.weight || "";
  const selectedPreviousWeightValue = getSelectedMeasurementValue("weight", selectedPreviousMeasurement);
  const selectedWaistValue = getSelectedMeasurementValue("belly") || getSelectedMeasurementValue("waist") || "";
  const selectedPreviousWaistValue = getSelectedMeasurementValue("belly", selectedPreviousMeasurement) ||
    getSelectedMeasurementValue("waist", selectedPreviousMeasurement);
  const selectedWeightDelta = getProfileMeasurementDelta(selectedWeightValue, selectedPreviousWeightValue);
  const selectedWaistDelta = getProfileMeasurementDelta(selectedWaistValue, selectedPreviousWaistValue);
  const selectedProgramCompletion = Number.isFinite(selectedSummary.programCompletionPercent)
    ? selectedSummary.programCompletionPercent
    : null;
  const selectedCompletedWorkouts = Number(selectedSummary.completedWorkoutCount) || 0;
  const selectedAssignedWorkouts = Number(selectedSummary.assignedWorkoutCount || selectedClient?.assignedWorkoutCount) || 0;
  const selectedLatestPhoto = adminClientProgressPhotos[0] || null;
  const selectedTaskPreview = adminClientTasks.slice(0, 4);
  const selectedRecentActivity = [
    ...adminClientEvents,
    ...adminClientHistory.slice(0, 6).map((item) => ({
      id: `workout_${item.id}`,
      type: "workout",
      title: "Завершена тренировка",
      details: item.workoutName || item.name || item.workout || "Тренировка",
      date: item.date || item.completedAt || item.createdAt
    }))
  ]
    .sort((a, b) => getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt))
    .slice(0, 6);
  const selectedAttentionItems = [
    selectedPlateau.isPlateau
      ? {
          id: "danger",
          icon: "↓",
          title: `Вес стоит ${selectedPlateau.days} ${getTrainerDayWord(selectedPlateau.days)}`,
          text: "Проверь калории и нагрузку"
        }
      : selectedWorkoutDays !== null && selectedWorkoutDays >= 7
        ? {
            id: selectedWorkoutDays >= 14 ? "danger" : "warning",
            icon: "!",
            title: `Нет тренировок ${selectedWorkoutDays} ${getTrainerDayWord(selectedWorkoutDays)}`,
            text: "Стоит связаться с клиентом"
          }
        : {
            id: "success",
            icon: "✓",
            title: "Тренировки по плану",
            text: selectedSummary.workouts7 ? `${selectedSummary.workouts7} за последние 7 дней` : "Активность стабильна"
          },
    !selectedNutritionAverage.protein
      ? {
          id: "warning",
          icon: "!",
          title: "Нет данных по белку",
          text: "Проверь записи питания клиента"
        }
      : selectedNutritionAverage.protein < dailyProteinGoal * 0.9
        ? {
            id: "warning",
            icon: "▦",
            title: "Белок ниже цели",
            text: `Среднее: ${selectedNutritionAverage.protein} г / цель: ${dailyProteinGoal} г`
          }
        : {
            id: "success",
            icon: "✓",
            title: "Белок в норме",
            text: selectedNutritionAverage.protein ? `${selectedNutritionAverage.protein} г в среднем` : "Недостаточно данных"
          },
    selectedMeasurementDays === null || selectedMeasurementDays >= 30
      ? {
          id: "warning",
          icon: "◷",
          title: selectedMeasurementDays === null
            ? "Нет контрольного замера"
            : `Нет замеров ${selectedMeasurementDays} ${getTrainerDayWord(selectedMeasurementDays)}`,
          text: selectedLatestMeasurement ? `Последний: ${formatProfileMeasurementDate(selectedLatestMeasurement)}` : "Добавь задачу клиенту"
        }
      : {
          id: "success",
          icon: "✓",
          title: "Замеры актуальны",
          text: `Последний: ${formatProfileMeasurementDate(selectedLatestMeasurement)}`
        },
    selectedNutritionDays7Complete >= 5
      ? {
          id: "success",
          icon: "✓",
          title: `Питание ${selectedNutritionDays7Complete}/7 дней`,
          text: "Хорошая дисциплина"
        }
      : {
          id: selectedNutritionDays !== null && selectedNutritionDays >= 5 ? "danger" : "warning",
          icon: "!",
          title: `Питание ${selectedNutritionDays7Complete}/7 дней`,
          text: selectedNutritionDays === null
            ? "Нет записей"
            : `Последняя запись ${selectedNutritionDays} ${getTrainerDayWord(selectedNutritionDays)} назад`
        }
  ];
  const selectedTrainerRawName = selectedClient?.assignedTrainerName ||
    selectedClient?.trainerName ||
    telegramProfile.displayName ||
    auth.currentUser?.displayName ||
    auth.currentUser?.email?.split("@")?.[0] ||
    "Тренер";
  const selectedTrainerName = String(selectedTrainerRawName)
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

  return {
    adminMeasurementPreviewFields,
    adminUsersFilteredClients,
    aiPlan,
    aiWeek,
    clientNutritionDays,
    clientToday,
    currentMonthTrainingDays,
    dailyCalorieGoal,
    dailyCarbsGoal,
    dailyFatGoal,
    dailyProteinGoal,
    getClientCardSummary,
    lastWorkout,
    nutritionMonthAverageCalories,
    nutritionMonthAverageProtein,
    nutritionMonthDays,
    nutritionMonthLabel,
    recommendations,
    selectedAssignedWorkouts,
    selectedAttentionItems,
    selectedClient,
    selectedCompletedWorkouts,
    selectedEffectiveNutritionGoals,
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
    trainerAiRecommendations,
    trainerNutritionPlanOptions,
    workoutProgress
  };
}
