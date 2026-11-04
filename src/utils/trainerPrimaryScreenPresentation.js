// Presentation only: do not turn an unknown score into a failing grade.
export function getTrainerListProgressScore(value) {
  if (value == null || typeof value === "boolean" || String(value).trim() === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

export function getTrainerListStatusLabel(status = {}, hasProgram = true) {
  if (!hasProgram) return "Без программы";
  if (status.id === "taskAssigned") return "Задача у клиента";
  if (status.id === "noProgram") return "Без программы";
  if (status.id === "active") return "Без сигналов";
  return "Нужна проверка";
}
