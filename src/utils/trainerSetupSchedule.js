import { normalizeClientSubscription } from "./clientSubscription.js";
import { toWorkoutDateKey } from "./workoutSchedule.js";

export function getTrainerSetupScheduleDates(dates = []) {
  return [...new Set((Array.isArray(dates) ? dates : [])
    .map(toWorkoutDateKey)
    .filter(Boolean))].sort();
}

export function buildSubscriptionFromTrainerSetupSchedule(subscription = {}, dates = []) {
  const scheduledDates = getTrainerSetupScheduleDates(dates);
  if (!scheduledDates.length) return normalizeClientSubscription(subscription);

  const current = normalizeClientSubscription(subscription);
  const purchasedSessions = scheduledDates.length;

  return normalizeClientSubscription({
    ...current,
    cycleId: scheduledDates[0],
    startDate: scheduledDates[0],
    endDate: scheduledDates[scheduledDates.length - 1],
    purchasedSessions,
    usedSessions: Math.min(Math.max(0, Number(current.usedSessions) || 0), purchasedSessions)
  });
}
