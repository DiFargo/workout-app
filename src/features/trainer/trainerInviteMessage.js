export function normalizeTrainerTelegramUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const username = raw.replace(/^@/, "");
  if (!username) return null;
  return /^[A-Za-z0-9_]{5,32}$/.test(username) ? username.toLowerCase() : null;
}

export function buildTrainerTelegramChatUrl(username, message) {
  const normalized = normalizeTrainerTelegramUsername(username);
  if (!normalized) return "";
  return `https://t.me/${normalized}?text=${encodeURIComponent(String(message || ""))}`;
}

export function buildTrainerInviteMessage({ login = "", inviteUrl = "", botStartUrl = "" } = {}) {
  if (botStartUrl) {
    return [
      "Привет! Приглашаю тебя в приложение Zmena.",
      `1. Открой ссылку и нажми Start в Telegram: ${botStartUrl}`,
      "2. В ответном сообщении нажми «Принять приглашение».",
      "3. В открывшемся приложении выбери «Telegram» и нажми «Принять приглашение» — аккаунт подключится к тренеру.",
      login ? `Логин для входа по паролю: ${login}` : "",
      inviteUrl ? `Если понадобится вход по паролю, сначала создай его по ссылке: ${inviteUrl}` : ""
    ].filter(Boolean).join("\n");
  }

  const lines = [
    "Привет! Я приглашаю тебя в приложение Zmena.",
    inviteUrl ? `1. Открой ссылку и создай пароль: ${inviteUrl}` : "1. Открой ссылку активации от тренера и создай пароль.",
    login ? `2. Твой логин: ${login}` : "2. Для входа используй логин, который прислал тренер.",
    "После создания пароля выбери «Email или логин» и введи логин и пароль."
  ];

  return lines.join("\n");
}
