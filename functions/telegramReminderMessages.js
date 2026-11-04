export function escapeTelegramHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRussianCountLabel(count, one, few, many) {
  const value = Math.abs(Number(count) || 0);
  const lastTwoDigits = value % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return many;
  const lastDigit = value % 10;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
}

export function buildWorkoutReminderMessage({ workout, workoutTime, eventText, offsetHours = 24, test = false } = {}) {
  const workoutName = escapeTelegramHtml(workout?.name || "Тренировка");
  const exerciseCount = Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
  const timingLine = offsetHours === 24
    ? `Завтра, ${escapeTelegramHtml(eventText || "по расписанию")}, в ${escapeTelegramHtml(workoutTime || "13:00")}.`
    : offsetHours === 1
      ? `Начало через час — в ${escapeTelegramHtml(workoutTime || "13:00")}.`
      : `Начало через ${Number(offsetHours) || 0} ${Number(offsetHours) === 3 ? "часа" : "часов"} — в ${escapeTelegramHtml(workoutTime || "13:00")}.`;

  return [
    `<b>${test ? "Проверка напоминаний" : "Скоро тренировка"}</b>`,
    "",
    timingLine,
    `<b>${workoutName}</b>`,
    exerciseCount
      ? `В плане ${exerciseCount} ${getRussianCountLabel(exerciseCount, "упражнение", "упражнения", "упражнений")}.`
      : "План тренировки уже в приложении.",
    "",
    "Открой план, чтобы посмотреть упражнения, подходы и видео.",
    "Кнопка «Открыть приложение» — слева от поля сообщения."
  ].join("\n");
}

export function buildProgressReminderMessage(reminder = {}) {
  const type = reminder.type === "weight" ? "weight" : reminder.type === "measurements" ? "measurements" : "photo";
  const intervalDays = Math.max(1, Number(reminder.intervalDays) || (type === "weight" ? 7 : 14));
  const content = {
    photo: {
      title: "Пора сделать фото прогресса",
      instruction: "Сделай снимки в тех же ракурсах и при похожем освещении — так изменения будет проще сравнить."
    },
    weight: {
      title: "Пора взвеситься",
      instruction: "Запиши текущий вес, чтобы видеть динамику и делиться ею с тренером."
    },
    measurements: {
      title: "Пора обновить замеры тела",
      instruction: "Обнови основные замеры, чтобы отслеживать изменения и точнее корректировать план."
    }
  }[type];

  return [
    `<b>${content.title}</b>`,
    "",
    `Период напоминания — ${intervalDays} дней.`,
    content.instruction,
    "",
    "Нажми «Открыть приложение» слева от поля сообщения, чтобы добавить данные."
  ].join("\n");
}

export function buildTelegramWelcomeMessage(firstName = "") {
  const name = String(firstName || "").trim();
  return [
    `<b>${name ? `Привет, ${escapeTelegramHtml(name)}!` : "Привет!"}</b>`,
    "Я — ZMENA, помощник по тренировкам и прогрессу.",
    "",
    "Здесь будут напоминания о тренировках, фото прогресса, весе и замерах.",
    "",
    "Открой ZMENA кнопкой «Открыть приложение» слева от поля сообщения.",
    "Если Telegram ещё не подключён: Профиль → Telegram.",
    "Напиши «настройки», чтобы узнать, где управлять напоминаниями."
  ].join("\n");
}

export function buildTelegramHelpMessage() {
  return [
    "<b>Как начать</b>",
    "",
    "1. Нажми «Открыть приложение» слева от поля сообщения.",
    "2. Если нужно, подключи Telegram: Профиль → Telegram.",
    "3. Включи нужные напоминания в Профиль → Уведомления.",
    "",
    "Можно получать напоминания о тренировках, весе, замерах и фото прогресса."
  ].join("\n");
}

export function buildTelegramSettingsMessage() {
  return [
    "<b>Настройки напоминаний</b>",
    "",
    "Открой приложение → Профиль → Уведомления.",
    "Там можно включить нужные напоминания и настроить интервалы и время.",
    "",
    "Если Telegram не подключён: Профиль → Telegram."
  ].join("\n");
}

export function buildTelegramAppMessage() {
  return [
    "<b>Приложение ZMENA</b>",
    "",
    "Чтобы открыть свой план и настройки, нажми «Открыть приложение» слева от поля сообщения."
  ].join("\n");
}

export function getTelegramQuickAction(text = "") {
  const value = String(text || "").trim();
  const command = value.match(/^\/([a-z0-9_]+)(?:@\w+)?(?:\s|$)/i)?.[1]?.toLowerCase();
  if (command) {
    if (command === "help") return "help";
    if (["settings", "notifications"].includes(command)) return "settings";
    if (["app", "open"].includes(command)) return "app";
    return "";
  }

  const phrase = value.toLocaleLowerCase("ru-RU").replace(/[.!?]+$/g, "").trim();
  if (["помощь", "как начать"].includes(phrase)) return "help";
  if (["настройки", "уведомления", "настройки уведомлений"].includes(phrase)) return "settings";
  if (["приложение", "открыть приложение"].includes(phrase)) return "app";
  return "";
}

export function buildTelegramLinkConfirmationMessage() {
  return [
    "<b>Telegram подключён</b>",
    "",
    "Теперь ZMENA сможет присылать сюда личные напоминания.",
    "Выбери, что и когда напоминать: приложение → Профиль → Уведомления."
  ].join("\n");
}

export function buildTelegramLinkErrorMessage() {
  return [
    "<b>Не получилось подключить Telegram</b>",
    "",
    "Ссылка могла устареть или уже быть использована.",
    "Создай новую: приложение → Профиль → Telegram, затем снова запусти бота."
  ].join("\n");
}

export function buildTelegramInviteAcceptanceMessage(firstName = "") {
  const name = String(firstName || "").trim();
  return [
    `<b>${name ? `Привет, ${escapeTelegramHtml(name)}! Тренер приглашает тебя в ZMENA.` : "Тренер приглашает тебя в ZMENA."}</b>`,
    "",
    "Нажми кнопку ниже, затем в приложении выбери «Продолжить через Telegram».",
    "Аккаунт автоматически подключится к пригласившему тебя тренеру."
  ].join("\n");
}

export function buildTelegramInviteErrorMessage(code, targetUsername = "") {
  const username = String(targetUsername || "").trim().replace(/^@/, "");
  const message = {
    "telegram-invite-expired": "Ссылка приглашения устарела. Попроси тренера отправить новую.",
    "telegram-invite-already-claimed": "Это приглашение уже открыто другим Telegram-аккаунтом. Попроси тренера создать новое.",
    "telegram-invite-username-mismatch": username
      ? `Это приглашение создано для @${escapeTelegramHtml(username)}. Открой его из нужного Telegram-аккаунта.`
      : "Этот Telegram-аккаунт не совпадает с приглашённым.",
    "telegram-invite-account-mismatch": "Этот Telegram уже связан с другим аккаунтом. Обратись к тренеру.",
    "telegram-invite-account-unavailable": "Аккаунт приглашения недоступен. Обратись к тренеру.",
    "telegram-invite-already-used": "Это приглашение уже использовано. Нажми «Открыть приложение» слева от поля сообщения или попроси новое приглашение.",
    "telegram-invite-not-started": "Сначала открой ссылку приглашения в Telegram и нажми Start."
  }[code] || "Не удалось проверить приглашение. Попроси тренера отправить новую ссылку.";

  return [`<b>Приглашение ZMENA</b>`, "", message].join("\n");
}

export function buildTelegramAppKeyboard(url, label = "Открыть приложение") {
  const appUrl = String(url || "").trim();
  if (!/^https:\/\//i.test(appUrl)) return null;
  return {
    inline_keyboard: [[{
      text: String(label || "Открыть приложение"),
      web_app: { url: appUrl }
    }]]
  };
}
