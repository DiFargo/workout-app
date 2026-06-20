import { defaultNutritionState } from "../data/nutritionDefaults.js";

export function buildAdminClientNutritionStateFromRoot(clientData = {}, nutritionState = null) {
  const rootGoals = clientData?.nutritionGoals || clientData?.nutritionPlan || {};
  const aiPlan = clientData?.aiNutritionPlan || nutritionState?.aiNutritionPlan || null;
  const aiStart = aiPlan?.start || aiPlan?.trainingDay || aiPlan?.weeks?.[0] || {};
  const mirroredNutrition = clientData?.nutritionState || clientData?.adminClientNutrition || null;
  const nutritionDays = nutritionState?.days || mirroredNutrition?.days || clientData?.nutrition?.days || clientData?.nutritionDays || {};

  return {
    ...(mirroredNutrition || {}),
    ...(nutritionState || {}),
    goals: {
      ...defaultNutritionState.goals,
      ...(mirroredNutrition?.goals || {}),
      ...(nutritionState?.goals || {}),
      ...rootGoals,
      calories: Number(rootGoals.calories || nutritionState?.goals?.calories || mirroredNutrition?.goals?.calories || aiStart.calories || defaultNutritionState.goals.calories) || defaultNutritionState.goals.calories,
      protein: Number(rootGoals.protein || nutritionState?.goals?.protein || mirroredNutrition?.goals?.protein || aiStart.protein || defaultNutritionState.goals.protein) || defaultNutritionState.goals.protein,
      fat: Number(rootGoals.fat || nutritionState?.goals?.fat || mirroredNutrition?.goals?.fat || aiStart.fat || defaultNutritionState.goals.fat) || defaultNutritionState.goals.fat,
      carbs: Number(rootGoals.carbs || nutritionState?.goals?.carbs || mirroredNutrition?.goals?.carbs || aiStart.carbs || defaultNutritionState.goals.carbs) || defaultNutritionState.goals.carbs
    },
    days: nutritionDays,
    aiNutritionPlan: aiPlan || null,
    nutritionPlan: clientData?.nutritionPlan || nutritionState?.nutritionPlan || mirroredNutrition?.nutritionPlan || null
  };
}

export function getTrainerClientMirrorPayload(clientData = {}, nutritionState = null) {
  const clientId = clientData?.id || clientData?.uid || clientData?.clientId || "";
  const trainerId = clientData?.trainerId || clientData?.assignedTrainerId || clientData?.coachId || "";
  const trainerEmail = String(clientData?.trainerEmail || clientData?.assignedTrainerEmail || clientData?.coachEmail || "").toLowerCase();
  const mirroredNutrition = buildAdminClientNutritionStateFromRoot(clientData, nutritionState);

  return {
    clientId,
    uid: clientId,
    id: clientId,
    email: clientData?.email || "",
    name: clientData?.name || clientData?.email || "Клиент",
    role: "client",
    trainerId,
    assignedTrainerId: clientData?.assignedTrainerId || trainerId,
    coachId: clientData?.coachId || trainerId,
    trainerEmail,
    assignedTrainerEmail: String(clientData?.assignedTrainerEmail || trainerEmail || "").toLowerCase(),
    coachEmail: String(clientData?.coachEmail || trainerEmail || "").toLowerCase(),
    createdBy: clientData?.createdBy || clientData?.createdByEmail || "",
    createdByEmail: clientData?.createdByEmail || clientData?.createdBy || "",
    createdByUid: clientData?.createdByUid || "",
    profile: clientData?.profile || {},
    aiNutritionProfile: clientData?.aiNutritionProfile || clientData?.profile || {},
    aiNutritionPlan: clientData?.aiNutritionPlan || null,
    nutritionPlan: clientData?.nutritionPlan || null,
    nutritionGoals: clientData?.nutritionGoals || mirroredNutrition?.goals || null,
    nutritionState: mirroredNutrition,
    assignedProgramId: clientData?.assignedProgramId || "",
    assignedProgramName: clientData?.assignedProgramName || "",
    assignedProgramUpdatedAt: clientData?.assignedProgramUpdatedAt || clientData?.assignedProgramAt || "",
    assignedWorkoutCount: clientData?.assignedWorkoutCount || 0,
    workoutCalendar: clientData?.workoutCalendar || null,
    trainingDays: clientData?.trainingDays || clientData?.workoutCalendar?.trainingDays || [],
    workoutTime: clientData?.workoutTime || clientData?.workoutCalendar?.workoutTime || "",
    trainerNote: clientData?.trainerNote || "",
    telegram: clientData?.telegram || null,
    telegramConnected: clientData?.telegramConnected || false,
    telegramUsername: clientData?.telegramUsername || "",
    telegramDisplayName: clientData?.telegramDisplayName || "",
    telegramNotificationsEnabled: clientData?.telegramNotificationsEnabled || false,
    updatedAt: new Date().toISOString()
  };
}
