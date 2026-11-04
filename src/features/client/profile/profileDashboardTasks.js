import { isBodyMeasurementRecord } from "../../../utils/bodyMeasurementRecords.js";
import { getMeasurementTimestampValue } from "../../../utils/profileMeasurements.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const PROFILE_PROGRESS_PHOTO_INTERVAL_DAYS = 14;
export const PROFILE_BODY_MEASUREMENT_INTERVAL_DAYS = 14;

function toTimestamp(value) {
  const normalized = typeof value?.toDate === "function" ? value.toDate() : value;
  if (normalized instanceof Date) return Number.isFinite(normalized.getTime()) ? normalized.getTime() : 0;

  const rawValue = String(normalized || "").trim();
  if (!rawValue) return 0;

  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 12)
    : new Date(rawValue);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function getLocalDayNumber(timestamp) {
  const date = new Date(timestamp);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS);
}

export function getProfileProgressPhotoCheckInState(photos = [], {
  now = new Date(),
  intervalDays = PROFILE_PROGRESS_PHOTO_INTERVAL_DAYS
} = {}) {
  const safePhotos = Array.isArray(photos) ? photos : [];
  const safeIntervalDays = Math.max(1, Math.round(Number(intervalDays) || PROFILE_PROGRESS_PHOTO_INTERVAL_DAYS));
  const latest = safePhotos
    .map((photo) => ({ photo, timestamp: toTimestamp(photo?.date || photo?.createdAt) }))
    .filter((entry) => entry.timestamp > 0)
    .sort((left, right) => right.timestamp - left.timestamp)[0] || null;
  const todayTimestamp = toTimestamp(now);
  const daysSinceLastPhoto = latest && todayTimestamp
    ? Math.max(0, getLocalDayNumber(todayTimestamp) - getLocalDayNumber(latest.timestamp))
    : null;

  return {
    isDue: !latest || daysSinceLastPhoto >= safeIntervalDays,
    isFirst: safePhotos.length === 0,
    isOverdue: Boolean(latest && daysSinceLastPhoto > safeIntervalDays),
    intervalDays: safeIntervalDays,
    daysSinceLastPhoto,
    latestPhoto: latest?.photo || null,
    latestTimestamp: latest?.timestamp || 0
  };
}

export function getProfileBodyMeasurementCheckInState(measurements = [], {
  now = new Date(),
  intervalDays = PROFILE_BODY_MEASUREMENT_INTERVAL_DAYS
} = {}) {
  const safeIntervalDays = Math.max(1, Math.round(Number(intervalDays) || PROFILE_BODY_MEASUREMENT_INTERVAL_DAYS));
  const todayTimestamp = toTimestamp(now);
  const today = todayTimestamp ? getLocalDayNumber(todayTimestamp) : null;
  const latest = (Array.isArray(measurements) ? measurements : [])
    .filter(isBodyMeasurementRecord)
    .map(measurement => {
      const value = measurement.date || measurement.createdAt || measurement.savedAt;
      const timestamp = toTimestamp(value) || getMeasurementTimestampValue(measurement);
      const dateOnly = typeof value === "string" ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
      const date = new Date(timestamp);
      const validDate = !dateOnly || (date.getFullYear() === Number(dateOnly[1]) &&
        date.getMonth() + 1 === Number(dateOnly[2]) && date.getDate() === Number(dateOnly[3]));
      return { measurement, timestamp: validDate ? timestamp : 0 };
    })
    .filter(entry => entry.timestamp > 0 && today !== null && getLocalDayNumber(entry.timestamp) <= today)
    .sort((left, right) => right.timestamp - left.timestamp)[0] || null;
  const daysSinceLastMeasurement = latest ? today - getLocalDayNumber(latest.timestamp) : null;
  return {
    isDue: today !== null && (!latest || daysSinceLastMeasurement >= safeIntervalDays),
    isFirst: !latest,
    isOverdue: Boolean(latest && daysSinceLastMeasurement > safeIntervalDays),
    intervalDays: safeIntervalDays,
    daysSinceLastMeasurement,
    latestMeasurement: latest?.measurement || null,
    latestTimestamp: latest?.timestamp || 0
  };
}

function formatRussianCount(count, forms) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} ${forms[2]}`;
  if (lastDigit === 1) return `${count} ${forms[0]}`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

export function buildProfileDashboardTasks({
  workoutState,
  workoutMode = "basic",
  workoutScheduleStatus,
  workoutTitle,
  workoutDate,
  workoutExerciseCount,
  workoutActionLabel,
  weightCheckIn,
  measurementsCheckIn,
  progressPhotoCheckIn,
  includeProgressPhoto = true
} = {}) {
  const tasks = [];
  const safeWorkoutTitle = String(workoutTitle || "Тренировка по плану").trim();
  const safeWorkoutDate = String(workoutDate || "").trim();
  const safeExerciseCount = Math.max(0, Number(workoutExerciseCount) || 0);
  const exerciseText = safeExerciseCount
    ? formatRussianCount(safeExerciseCount, ["упражнение", "упражнения", "упражнений"])
    : "По вашему плану";

  if (workoutState === "awaiting-trainer" || ((workoutState === "create" || workoutState === "empty") && workoutMode === "individual")) {
    tasks.push({ id: "workout", kind: "workout", title: "Ожидаем программу тренера",
      note: "Индивидуальная программа ещё не назначена. Уточните её у тренера.",
      actionLabel: workoutActionLabel || "Открыть тренировки" });
  } else if (workoutState === "create" || workoutState === "empty") {
    tasks.push({
      id: "workout",
      kind: "workout",
      title: "Подготовьте базовую тренировку",
      note: safeWorkoutDate || "Откройте базовые тренировки, чтобы настроить свой план.",
      actionLabel: workoutActionLabel || "Перейти к тренировке"
    });
  } else if (workoutState === "choose") {
    tasks.push({
      id: "workout",
      kind: "workout",
      title: "Выберите режим тренировок",
      note: safeWorkoutDate || "План уже есть — выберите, как его открыть.",
      actionLabel: workoutActionLabel || "Выбрать режим"
    });
  } else if (workoutState === "ready" && workoutScheduleStatus === "today") {
    tasks.push({
      id: "workout",
      kind: "workout",
      title: "Сегодня тренировка",
      note: `${safeWorkoutTitle} · ${exerciseText}`,
      actionLabel: workoutActionLabel || "Открыть тренировку"
    });
  } else if (workoutState === "ready" && workoutScheduleStatus === "missed") {
    tasks.push({
      id: "workout",
      kind: "workout",
      title: "Вернитесь к тренировке",
      note: `${safeWorkoutTitle} была запланирована на ${safeWorkoutDate || "прошедшую дату"}. Можно начать сейчас или перенести.`,
      actionLabel: workoutActionLabel || "Открыть тренировку"
    });
  } else if (workoutState === "ready" && workoutScheduleStatus === "unscheduled") {
    tasks.push({
      id: "workout",
      kind: "workout",
      title: "Продолжите тренировочный план",
      note: "Следующее занятие пока не запланировано.",
      actionLabel: workoutActionLabel || "Открыть тренировки"
    });
  }

  if (weightCheckIn?.enabled === true && weightCheckIn.ready !== false && weightCheckIn?.isDue) {
    const title = weightCheckIn.isFirst
      ? "Добавьте первый вес"
      : weightCheckIn.isOverdue
        ? "Пора обновить вес"
        : "Пора взвеситься";
    const note = weightCheckIn.isFirst
      ? "Начните отслеживать динамику веса."
      : weightCheckIn.isOverdue && weightCheckIn.latestDateText
        ? `Последнее взвешивание — ${weightCheckIn.latestDateText}.`
        : "Еженедельный контроль помогает видеть динамику.";
    tasks.push({
      id: "weight",
      kind: "weight",
      title,
      note,
      actionLabel: "Добавить вес"
    });
  }

  if (measurementsCheckIn?.enabled === true && measurementsCheckIn.ready !== false && measurementsCheckIn.isDue) {
    const days = measurementsCheckIn.daysSinceLastMeasurement;
    tasks.push({
      id: "measurements",
      kind: "measurements",
      title: measurementsCheckIn.isFirst ? "Добавьте первые замеры" : "Обновить замеры тела",
      note: measurementsCheckIn.isFirst
        ? "Запишите объёмы тела, чтобы видеть изменения."
        : Number.isFinite(days)
          ? `Последний замер — ${formatRussianCount(days, ["день", "дня", "дней"])} назад.`
          : "Пора обновить объёмы тела.",
      actionLabel: "Открыть замеры тела"
    });
  }

  if (includeProgressPhoto && progressPhotoCheckIn?.enabled === true && progressPhotoCheckIn.ready !== false && progressPhotoCheckIn?.isDue) {
    const daysSincePhoto = Number(progressPhotoCheckIn.daysSinceLastPhoto);
    const elapsedText = Number.isFinite(daysSincePhoto)
      ? formatRussianCount(daysSincePhoto, ["день", "дня", "дней"])
      : "давно";
    tasks.push({
      id: "photos",
      kind: "photos",
      title: progressPhotoCheckIn.isFirst
        ? "Добавьте первое фото"
        : "Обновить фото прогресса",
      note: progressPhotoCheckIn.isFirst
        ? "Фото помогут оценивать изменения формы."
        : `Последняя съёмка — ${elapsedText} назад.`,
      actionLabel: "Открыть фото прогресса"
    });
  }

  return tasks;
}
