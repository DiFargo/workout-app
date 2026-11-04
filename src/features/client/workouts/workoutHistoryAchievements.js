import {
  buildProfileAchievements,
  getConfirmedProfileAchievementItems,
  getProfileAchievementHistoryTimestamp
} from "../profile/profileAchievements.js";

function recordedDurationSeconds(entry) {
  const value = entry.durationSeconds;
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

// Read-only all-time facts. The caller owns history completeness and user scope;
// planned prescriptions, filled-but-uncompleted sets and pending saves are not
// evidence of an achievement. Unknown duration is never inferred from a plan.
export function buildWorkoutHistoryAchievements(history = [], { now = new Date() } = {}) {
  const achievements = buildProfileAchievements(history, { now });
  const confirmedItems = getConfirmedProfileAchievementItems(history)
    .map((item, index) => ({ item, index, time: getProfileAchievementHistoryTimestamp(item) }))
    .sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity) || a.index - b.index)
    .map(({ item }) => item);
  let durationSecondsKnown = 0;
  let durationRecordCount = 0;
  let totalSets = 0;
  for (const item of confirmedItems) {
    const seconds = recordedDurationSeconds(item);
    if (seconds !== null) {
      durationSecondsKnown += seconds;
      durationRecordCount++;
    }
    for (const exercise of Array.isArray(item.exercises) ? item.exercises : []) {
      for (const set of Array.isArray(exercise?.sets) ? exercise.sets : []) {
        if (set?.completed === true) totalSets++;
      }
    }
  }
  return { ...achievements, confirmedItems, durationMinutesKnown: durationSecondsKnown / 60, durationRecordCount, totalSets };
}
