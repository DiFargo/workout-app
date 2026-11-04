export function normalizeTelegramUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const username = raw.replace(/^@/, "");
  if (!username) return null;
  return /^[A-Za-z0-9_]{5,32}$/.test(username) ? username.toLowerCase() : null;
}

export function getTelegramClientInviteStartError(link, {
  telegramUserId,
  telegramUsername,
  now = Date.now()
} = {}) {
  if (!link || link.inviteKind !== "client" || !link.uid || !link.trainerId) {
    return "telegram-invite-invalid";
  }

  const status = String(link.status || "").trim().toLowerCase();
  if (status === "accepted") return "telegram-invite-already-used";
  if (!["active", "started"].includes(status)) return "telegram-invite-invalid";

  const expiresAt = Date.parse(String(link.expiresAt || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return "telegram-invite-expired";

  const currentTelegramId = String(telegramUserId || "").trim();
  const claimedTelegramId = String(link.telegramUserId || "").trim();
  if (!/^\d{1,16}$/.test(currentTelegramId) || (claimedTelegramId && claimedTelegramId !== currentTelegramId)) {
    return "telegram-invite-already-claimed";
  }

  const targetUsername = normalizeTelegramUsername(link.telegramUsername || "");
  if (targetUsername === null) return "telegram-invite-invalid";
  if (targetUsername && normalizeTelegramUsername(telegramUsername || "") !== targetUsername) {
    return "telegram-invite-username-mismatch";
  }

  return "";
}

export function buildTelegramBotInviteStartUrl(botUsername, token) {
  const username = String(botUsername || "").trim().replace(/^@/, "");
  const inviteToken = String(token || "").trim();
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username) || !/^[A-Za-z0-9_-]{20,60}$/.test(inviteToken)) return "";
  return `https://t.me/${username}?start=invite_${encodeURIComponent(inviteToken)}`;
}

export function buildTelegramInviteAppUrl(appUrl, token) {
  const inviteToken = String(token || "").trim();
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(inviteToken)) return "";
  try {
    const parsed = new URL(String(appUrl || ""));
    if (parsed.protocol !== "https:") return "";
    parsed.searchParams.set("telegramInvite", inviteToken);
    return parsed.toString();
  } catch {
    return "";
  }
}
