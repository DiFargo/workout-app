export const TRAINER_CLIENT_SETUP_STEPS = [
  "subscription",
  "program",
  "nutrition",
  "notifications"
];

function hasNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
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
  const completedSteps = Object.fromEntries(
    TRAINER_CLIENT_SETUP_STEPS.map((step) => [step, raw.completedSteps?.[step] === true])
  );
  const nextStep = TRAINER_CLIENT_SETUP_STEPS.find((step) => !completedSteps[step]) || null;

  return {
    version: 1,
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
    version: 1,
    status: nextStep ? "in_progress" : "completed",
    completedSteps,
    currentStep: nextStep,
    startedAt: normalized.startedAt || now,
    updatedAt: now,
    ...(nextStep ? {} : { completedAt: normalized.completedAt || now })
  };
}
