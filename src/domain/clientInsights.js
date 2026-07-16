export function createClientResourceId(prefix = "item") {
  const randomPart = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

export function getTrainerTaskStatus(task = {}) {
  if (task.status === "completed" || task.completedAt) {
    return { id: "completed", label: "Выполнено" };
  }

  const dueAt = task.dueDate ? new Date(`${task.dueDate}T23:59:59`).getTime() : 0;
  if (dueAt && dueAt < Date.now()) {
    return { id: "overdue", label: "Просрочено" };
  }

  return { id: "progress", label: "В процессе" };
}

export function getActiveTrainerTasksCount(tasks = []) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => getTrainerTaskStatus(task).id !== "completed")
    .length;
}

const TRAINER_TASK_DESTINATION_PATTERNS = [
  {
    destination: "progressPhotos",
    pattern: /фото|photo|progress\s*photo/i
  },
  {
    destination: "measurements",
    pattern: /замер|обмер|объ[её]м|вес|шея|плеч|талия|живот|бедр|таз|груд|бицепс|предплеч|запяст|голень|лодыж|взвес/i
  },
  {
    destination: "nutrition",
    pattern: /питан|кбжу|ккал|калор|белок|жир|углевод|при[её]м пищи|дневник|завтрак|обед|ужин|перекус|вода/i
  },
  {
    destination: "workouts",
    pattern: /трениров|упражнен|программ|подход|повтор|кардио|размин/i
  },
  {
    destination: "profile",
    pattern: /профил|параметр|рост|возраст|активност|анкета/i
  },
  {
    destination: "progress",
    pattern: /прогресс|результат|истори/i
  }
];

export function inferClientTrainerTaskDestination(content = "") {
  const text = String(content || "").toLowerCase();
  const match = TRAINER_TASK_DESTINATION_PATTERNS.find(({ pattern }) => pattern.test(text));
  return match?.destination || "";
}

export function getClientTrainerTaskDestination(task = {}) {
  if ([
    "progressPhotos",
    "measurements",
    "nutrition",
    "workouts",
    "profile",
    "progress"
  ].includes(task.target)) {
    return task.target;
  }

  const content = [
    task.target,
    task.section,
    task.type,
    task.title,
    task.description
  ].filter(Boolean).join(" ").toLowerCase();
  const inferredDestination = inferClientTrainerTaskDestination(content);

  if (inferredDestination) return inferredDestination;

  if (/фото|photo/.test(content)) return "progressPhotos";
  if (/замер|объ[её]м|талия|бедр|груд|бицепс|взвес|вес тела/.test(content)) return "measurements";
  if (/питан|кбжу|ккал|калори|белок|жир|углевод|при[её]м пищи|завтрак|обед|ужин|перекус|вода/.test(content)) return "nutrition";
  if (/трениров|упражнен|программ|подход|повтор|кардио|разминк/.test(content)) return "workouts";
  if (/профил|параметр|рост|возраст|активност/.test(content)) return "profile";
  if (/прогресс|результат|истори/.test(content)) return "progress";

  return "";
}

export function getMeasurementWeightValue(measurement = {}) {
  const value = Number(String(measurement?.weight || measurement?.values?.weight || "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getClientPlateauInfo(measurements = []) {
  const points = (Array.isArray(measurements) ? measurements : [])
    .map((measurement) => ({
      weight: getMeasurementWeightValue(measurement),
      timestamp: (() => {
        const rawDate = measurement?.date || measurement?.createdAt || measurement?.savedAt || "";
        const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
        return Number.isFinite(timestamp) ? timestamp : 0;
      })()
    }))
    .filter((point) => point.weight && point.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (points.length < 2) return { isPlateau: false, days: 0, delta: null };

  const latest = points[0];
  const comparison = points.find((point) => latest.timestamp - point.timestamp >= 14 * 24 * 60 * 60 * 1000);
  if (!comparison) return { isPlateau: false, days: 0, delta: null };

  const delta = Math.round((latest.weight - comparison.weight) * 10) / 10;
  const days = Math.max(14, Math.round((latest.timestamp - comparison.timestamp) / (24 * 60 * 60 * 1000)));
  return { isPlateau: Math.abs(delta) < 0.4, days, delta };
}

export function getClientPaymentAttention(payment = null) {
  if (!payment) return { id: "missing", label: "Период не указан", days: null };
  if (payment.status === "paused") {
    return { id: "overdue", label: "Программа приостановлена", days: null };
  }
  if (payment.status === "review") {
    return { id: "soon", label: "Требует проверки", days: null };
  }

  const targetValue = payment.controlUntil || payment.nextPaymentAt || payment.paidUntil || "";
  const targetTimestamp = targetValue ? new Date(`${targetValue}T12:00:00`).getTime() : 0;
  if (!targetTimestamp) return { id: "missing", label: "Период не указан", days: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((targetTimestamp - today.getTime()) / (24 * 60 * 60 * 1000));

  if (days < 0) return { id: "overdue", label: `Контроль просрочен на ${Math.abs(days)} дн.`, days };
  if (days <= 3) return { id: "soon", label: days === 0 ? "Контроль сегодня" : `Контроль через ${days} дн.`, days };
  return { id: "paid", label: `Активна до ${new Date(targetTimestamp).toLocaleDateString("ru-RU")}`, days };
}
