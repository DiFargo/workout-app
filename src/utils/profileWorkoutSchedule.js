const PROFILE_WORKOUT_DAYS = [
  { id: "sun", title: "Вс" },
  { id: "mon", title: "Пн" },
  { id: "tue", title: "Вт" },
  { id: "wed", title: "Ср" },
  { id: "thu", title: "Чт" },
  { id: "fri", title: "Пт" },
  { id: "sat", title: "Сб" }
];

export function formatProfileWorkoutDate(dateValue) {
  if (!dateValue) return "Нет данных";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Нет данных";

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long"
  });
}

export function getProfileNextTrainingText(profile = {}, userData = {}, scheduledDates = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextScheduledDate = (Array.isArray(scheduledDates) ? scheduledDates : [])
    .map((dateKey) => {
      const date = new Date(`${dateKey}T00:00:00`);
      return Number.isNaN(date.getTime()) ? null : { dateKey, date };
    })
    .filter((item) => item && item.date.getTime() >= today.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  if (nextScheduledDate) {
    const dayDifference = Math.round(
      (nextScheduledDate.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (dayDifference === 0) return "Сегодня";
    if (dayDifference === 1) return "Завтра";

    return nextScheduledDate.date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long"
    });
  }

  const sourceCalendar = userData?.workoutCalendar || userData?.calendar || {};
  const profileTrainingDays = Array.isArray(profile?.trainingDays) ? profile.trainingDays : [];
  const trainingDays = Array.isArray(sourceCalendar.trainingDays) && sourceCalendar.trainingDays.length
    ? sourceCalendar.trainingDays
    : profileTrainingDays;

  const workoutTime = sourceCalendar.workoutTime || userData?.workoutTime || profile?.workoutTime || "13:00";

  if (!trainingDays.length) return "Не выбрано";

  const dayOrder = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const todayIndex = new Date().getDay();

  let bestOffset = 8;
  let bestDayId = trainingDays[0];

  trainingDays.forEach((dayId) => {
    const targetIndex = dayOrder.indexOf(dayId);
    if (targetIndex === -1) return;

    let offset = targetIndex - todayIndex;
    if (offset <= 0) offset += 7;

    if (offset < bestOffset) {
      bestOffset = offset;
      bestDayId = dayId;
    }
  });

  const day = PROFILE_WORKOUT_DAYS.find((item) => item.id === bestDayId);
  return `${day?.title || bestDayId} · ${workoutTime}`;
}
