import { analyzeExerciseProgress } from "./exerciseProgress.js";

const BODY_PROGRESS_FIELDS = [
  { id: "shoulders", direction: 1, paths: ["shoulders", "shoulderGirth", "values.shoulders", "values.shoulderGirth"] },
  { id: "chest", direction: 1, paths: ["chest", "values.chest"] },
  { id: "biceps", direction: 1, paths: ["biceps", "values.biceps"] },
  { id: "forearm", direction: 1, paths: ["forearm", "values.forearm"] },
  { id: "thigh", direction: 1, paths: ["thigh", "values.thigh"] },
  { id: "calf", direction: 1, paths: ["calf", "values.calf"] },
  { id: "belly", direction: -1, paths: ["belly", "waist", "values.belly", "values.waist"] }
];

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getItemDate(item = {}) {
  return toDate(item.date || item.completedAt || item.finishedAt || item.createdAt || item.updatedAt || item.savedAt);
}

function readNumber(item = {}, paths = []) {
  for (const path of paths) {
    const value = path.split(".").reduce((result, key) => result?.[key], item);
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number.parseFloat(String(value).replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function round(value, precision = 1) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function toDateKey(value) {
  const date = toDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniquePoints(points = []) {
  const byDate = new Map();
  points.forEach((point) => {
    const key = toDateKey(point.date);
    if (key) byDate.set(key, point);
  });
  return [...byDate.values()].sort((a, b) => a.date - b.date);
}

function getPeriodRange(days, now) {
  const end = toDate(now) || new Date();
  end.setHours(23, 59, 59, 999);
  const totalDays = Math.max(1, Number(days) || 90);
  const start = new Date(end);
  start.setDate(start.getDate() - (totalDays - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end, totalDays };
}

function inRange(date, range) {
  return date && date >= range.start && date <= range.end;
}

function buildMeasurementRows(measurements, range) {
  const byDate = new Map();
  (Array.isArray(measurements) ? measurements : []).forEach((item) => {
    const date = getItemDate(item);
    if (!inRange(date, range)) return;
    const key = toDateKey(date);
    byDate.set(key, {
      date,
      weight: readNumber(item, ["weight", "values.weight"]),
      fields: Object.fromEntries(BODY_PROGRESS_FIELDS.map((field) => [field.id, readNumber(item, field.paths)]))
    });
  });
  return [...byDate.values()].sort((a, b) => a.date - b.date);
}

function buildBodyIndex(rows) {
  const baseline = rows.find((row) => BODY_PROGRESS_FIELDS.some((field) => Number(row.fields[field.id]) > 0));
  if (!baseline) return { points: [], contributorCount: 0 };

  const points = rows.map((row) => {
    const changes = BODY_PROGRESS_FIELDS.flatMap((field) => {
      const start = Number(baseline.fields[field.id]);
      const current = Number(row.fields[field.id]);
      if (!(start > 0) || !(current > 0)) return [];
      return [((current - start) / start) * 100 * field.direction];
    });
    if (!changes.length) return null;
    return {
      date: row.date,
      value: round(changes.reduce((sum, value) => sum + value, 0) / changes.length),
      contributorCount: changes.length
    };
  }).filter(Boolean);

  return {
    points,
    contributorCount: points.at(-1)?.contributorCount || 0
  };
}

function buildStrengthIndex(history, range) {
  const comparableExercises = analyzeExerciseProgress(Array.isArray(history) ? history : []);
  const exerciseSeries = comparableExercises.flatMap((exercise) => {
    const sessions = (exercise.sessions || [])
      .filter((session) => inRange(session.date, range) && Number(session.e1rm) > 0)
      .sort((a, b) => a.date - b.date);
    if (sessions.length < 2) return [];
    return [{ name: exercise.name, baseline: Number(sessions[0].e1rm), sessions }];
  });
  const timeline = [...new Map(exerciseSeries.flatMap((exercise) => (
    exercise.sessions.map((session) => [toDateKey(session.date), session.date])
  ))).values()].sort((a, b) => a - b);
  const points = timeline.map((date) => {
    const values = exerciseSeries.flatMap((exercise) => {
      const session = [...exercise.sessions].reverse().find((item) => item.date <= date);
      if (!session || !(exercise.baseline > 0)) return [];
      return [((Number(session.e1rm) - exercise.baseline) / exercise.baseline) * 100];
    });
    const value = median(values);
    return Number.isFinite(value) ? { date, value: round(value) } : null;
  }).filter(Boolean);

  return { points, exerciseCount: exerciseSeries.length };
}

function buildNutritionAdherence(nutritionDays, nutritionGoals, range) {
  const targetCalories = readNumber(nutritionGoals, ["calories"]);
  const targetProtein = readNumber(nutritionGoals, ["protein"]);
  if (!(targetCalories > 0)) return { points: [], average: null, trackedDays: 0, periodDays: range.totalDays };

  const points = uniquePoints((Array.isArray(nutritionDays) ? nutritionDays : []).flatMap((day) => {
    const date = getItemDate(day);
    const calories = readNumber(day, ["totals.calories", "calories"]);
    const protein = readNumber(day, ["totals.protein", "protein"]);
    if (!inRange(date, range) || !(calories > 0)) return [];
    const calorieScore = clamp(100 - (Math.abs(calories - targetCalories) / targetCalories) * 100, 0, 100);
    const proteinScore = targetProtein > 0 ? clamp(((protein || 0) / targetProtein) * 100, 0, 100) : null;
    const score = proteinScore === null ? calorieScore : calorieScore * 0.7 + proteinScore * 0.3;
    return [{ date, value: round(score) }];
  }));
  const average = points.length
    ? round(points.reduce((sum, point) => sum + point.value, 0) / points.length)
    : null;
  return { points, average, trackedDays: points.length, periodDays: range.totalDays };
}

function getSeriesSummary(points, allowSingle = false) {
  const enough = allowSingle ? points.length >= 1 : points.length >= 2;
  if (!enough) return { current: null, delta: null };
  const current = points.at(-1)?.value ?? null;
  const delta = points.length >= 2 ? round(current - points[0].value) : null;
  return { current, delta };
}

export function getTrainerClientAutoProgressPeriod({
  measurements = [],
  history = [],
  nutritionDays = [],
  now = new Date()
} = {}) {
  const end = toDate(now) || new Date();
  end.setHours(23, 59, 59, 999);
  const earliestAllowed = new Date(end);
  earliestAllowed.setDate(earliestAllowed.getDate() - 180);
  const dates = [
    ...(Array.isArray(measurements) ? measurements : []),
    ...(Array.isArray(history) ? history : []),
    ...(Array.isArray(nutritionDays) ? nutritionDays : [])
  ].map(getItemDate).filter((date) => date && date <= end && date >= earliestAllowed);
  if (dates.length < 2) return "1w";
  const first = Math.min(...dates.map((date) => date.getTime()));
  const firstDay = new Date(first);
  firstDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const ageDays = Math.floor((endDay.getTime() - firstDay.getTime()) / 86400000);
  if (ageDays <= 7) return "1w";
  if (ageDays <= 30) return "1m";
  if (ageDays <= 90) return "3m";
  return "6m";
}

export function buildTrainerClientProgressDashboard({
  measurements = [],
  history = [],
  nutritionDays = [],
  nutritionGoals = {},
  days = 90,
  now = new Date()
} = {}) {
  const range = getPeriodRange(days, now);
  const measurementRows = buildMeasurementRows(measurements, range);
  const weightPoints = uniquePoints(measurementRows.flatMap((row) => (
    Number(row.weight) > 0 ? [{ date: row.date, value: round(row.weight) }] : []
  )));
  const body = buildBodyIndex(measurementRows);
  const strength = buildStrengthIndex(history, range);
  const nutrition = buildNutritionAdherence(nutritionDays, nutritionGoals, range);

  return {
    range,
    weight: { points: weightPoints, ...getSeriesSummary(weightPoints, true) },
    body: { ...body, ...getSeriesSummary(body.points) },
    strength: { ...strength, ...getSeriesSummary(strength.points) },
    nutrition: {
      ...nutrition,
      current: nutrition.average,
      delta: nutrition.points.length >= 2
        ? round(nutrition.points.at(-1).value - nutrition.points[0].value)
        : null
    }
  };
}
