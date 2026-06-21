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

export function getClientTrainerTaskDestination(task = {}) {
  const content = [
    task.target,
    task.section,
    task.type,
    task.title,
    task.description
  ].filter(Boolean).join(" ").toLowerCase();

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
