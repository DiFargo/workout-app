import { getCompletedWorkoutKey } from "./workoutCompletion.js";

export function formatHistoryCardDate(dateValue, withYear = false) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "без даты";

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {})
  }).replace(".", "");
}

export function formatHistoryTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getHistoryWorkoutParts(workoutName = "") {
  const parts = String(workoutName || "Тренировка").split("—").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      day: parts[0],
      title: parts.slice(1).join(" • ")
    };
  }

  return {
    day: "Тренировка",
    title: workoutName || "Без названия"
  };
}

export function getHistorySetCount(item = {}) {
  return (item.exercises || []).reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0);
}

export function getHistoryVolume(item = {}) {
  return (item.exercises || []).reduce((sum, exercise) => (
    sum + (exercise.sets || []).reduce((setSum, set) => {
      const reps = Number(set.reps) || 0;
      const weight = Number(String(set.weight || "").replace(",", ".")) || 0;
      return setSum + reps * weight;
    }, 0)
  ), 0);
}

export function getHistoryTopExercise(item = {}) {
  const exercises = item.exercises || [];
  const first = exercises.find((exercise) => exercise?.name);
  return first?.name || "Без упражнений";
}

export function getLastExerciseText(exerciseItem = {}, lastExerciseResults = {}) {
  const exerciseKey = exerciseItem?.id
    ? `id:${exerciseItem.id}`
    : exerciseItem?.name
      ? `name:${getCompletedWorkoutKey(exerciseItem.name)}`
      : "";
  const last = lastExerciseResults[exerciseKey];

  if (!last) {
    return "Прошлый раз: нет данных";
  }

  return `Прошлый раз: ${last}`;
}
