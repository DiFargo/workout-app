export const TRAINER_CLIENT_SETUP_STEPS = [
  "program",
  "schedule",
  "nutrition",
  "notifications"
];

function hasNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function hasLegacyProgramAndSchedule(client = {}) {
  const calendar = client?.workoutCalendar || {};
  const scheduledDates = [
    ...(Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar.monthlyTrainingDates) ? calendar.monthlyTrainingDates : []),
    ...(Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts.map((item) => item?.date) : [])
  ].filter(Boolean);
  const hasProgram = Boolean(
    client?.assignedProgramId ||
    client?.assignedProgram?.id ||
    client?.programId ||
    client?.programAssignmentId ||
    client?.workoutProgramId
  );
  const subscription = client?.subscription || {};
  const hasSubscription = Boolean(
    subscription.startDate ||
    subscription.endDate ||
    subscription.purchasedSessions !== undefined ||
    subscription.totalSessions !== undefined
  );

  return hasProgram && (scheduledDates.length > 0 || hasSubscription);
}

export function hasCompletedClientQuestionnaire(client = {}) {
  const profile = client.aiNutritionProfile || client.profile || {};
  return client?.role === "client" && Boolean(
    client.firstSetupCompleted ||
    client.firstSetupCompletedVersion ||
    (hasNumber(profile.weight) && hasNumber(profile.height) && hasNumber(profile.age) && profile.sex)
  );
}

export function getTrainerClientSetupChecklist(client = {}) {
  const raw = client.trainerSetupChecklist || {};
  // The setup wizard was introduced after programs and schedules already
  // existed in production. Do not reopen it for those established clients
  // merely because their older data has no new checklist record.
  const isLegacyChecklist = !raw.version || Number(raw.version) < 2;
  const isConfiguredLegacyClient = isLegacyChecklist && hasLegacyProgramAndSchedule(client);
  if (isConfiguredLegacyClient) {
    return {
      version: 2,
      status: "completed",
      completedSteps: Object.fromEntries(TRAINER_CLIENT_SETUP_STEPS.map((step) => [step, true])),
      currentStep: null,
      startedAt: raw.startedAt || "",
      updatedAt: raw.updatedAt || "",
      completedAt: raw.completedAt || ""
    };
  }
  const completedSteps = Object.fromEntries(
    TRAINER_CLIENT_SETUP_STEPS.map((step) => [step, raw.completedSteps?.[step] === true])
  );
  const nextStep = TRAINER_CLIENT_SETUP_STEPS.find((step) => !completedSteps[step]) || null;

  return {
    version: 2,
    status: nextStep ? "in_progress" : "completed",
    completedSteps,
    currentStep: nextStep,
    startedAt: raw.startedAt || "",
    updatedAt: raw.updatedAt || "",
    completedAt: raw.completedAt || ""
  };
}

export function buildNextTrainerClientSetupChecklist(current = {}, completedStep, now = new Date().toISOString()) {
  const normalized = getTrainerClientSetupChecklist({ trainerSetupChecklist: current });
  const completedSteps = {
    ...normalized.completedSteps,
    ...(TRAINER_CLIENT_SETUP_STEPS.includes(completedStep) ? { [completedStep]: true } : {})
  };
  const nextStep = TRAINER_CLIENT_SETUP_STEPS.find((step) => !completedSteps[step]) || null;

  return {
    version: 2,
    status: nextStep ? "in_progress" : "completed",
    completedSteps,
    currentStep: nextStep,
    startedAt: normalized.startedAt || now,
    updatedAt: now,
    ...(nextStep ? {} : { completedAt: normalized.completedAt || now })
  };
}
