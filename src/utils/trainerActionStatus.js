const ERROR_STATUS_BY_CODE = {
  "permission-denied": "Недостаточно прав для этого действия. Проверь доступ тренера к клиенту.",
  unauthenticated: "Сессия истекла. Войди в аккаунт заново и повтори действие.",
  unavailable: "Firebase временно недоступен. Изменения не сохранены, попробуй ещё раз.",
  "deadline-exceeded": "Firebase отвечает слишком долго. Проверь интернет и повтори действие.",
  "resource-exhausted": "Firebase временно ограничил запросы. Подожди немного и повтори действие.",
  "failed-precondition": "Действие нельзя выполнить в текущем состоянии данных.",
  "not-found": "Нужные данные не найдены. Обнови страницу и попробуй снова.",
  "already-exists": "Такая запись уже существует."
};

export function getTrainerActionErrorCode(error = {}) {
  const code = String(error?.code || "").trim();
  if (code) return code.replace(/^firestore\//, "");

  const message = String(error?.message || "").toLowerCase();
  if (message.includes("permission_denied") || message.includes("permission-denied")) return "permission-denied";
  if (message.includes("unauthenticated")) return "unauthenticated";
  if (message.includes("unavailable") || message.includes("network")) return "unavailable";
  if (message.includes("deadline")) return "deadline-exceeded";

  return "";
}

export function getTrainerActionErrorStatus(error, fallbackMessage) {
  const code = getTrainerActionErrorCode(error);
  return ERROR_STATUS_BY_CODE[code] || fallbackMessage;
}
