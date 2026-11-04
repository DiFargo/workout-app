function timestampMillis(value) {
  if (typeof value === "string") return Date.parse(value);
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) &&
      value.nanoseconds >= 0 && value.nanoseconds < 1e9) {
    return value.seconds * 1000 + value.nanoseconds / 1e6;
  }
  return NaN;
}

function normalizedUsername(value) {
  if (typeof value !== "string") return "";
  const username = value.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{5,32}$/.test(username) ? username : "";
}

function isDocumentId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\s/]/.test(value);
}

// A server-only hint can recover the explicitly started invitation when the
// persistent Mini App button has no query token. It never selects by username.
export function getPendingTelegramInviteToken(pending, telegramUser, { invite = null, now = Date.now() } = {}) {
  if (!pending || typeof pending !== "object" || Array.isArray(pending) ||
      typeof pending.token !== "string" || !/^[A-Za-z0-9_-]{20,60}$/.test(pending.token) ||
      !isDocumentId(pending.uid) || !isDocumentId(pending.trainerId) ||
      !/^\d{1,16}$/.test(String(telegramUser?.id || ""))) return "";

  const username = normalizedUsername(telegramUser?.username);
  const expiresAt = timestampMillis(pending.expiresAt);
  const startedAt = timestampMillis(pending.startedAt);
  if (!username || normalizedUsername(pending.telegramUsername) !== username ||
      !Number.isFinite(expiresAt) || expiresAt <= now ||
      !Number.isFinite(startedAt) || startedAt <= 0 || startedAt > now + 30_000 || startedAt >= expiresAt) return "";

  if (invite && (invite.inviteKind !== "client" || invite.role !== "client" || invite.status !== "started" ||
      invite.uid !== pending.uid || invite.trainerId !== pending.trainerId ||
      String(invite.telegramUserId || "") !== String(telegramUser.id) ||
      normalizedUsername(invite.telegramUsername) !== username ||
      timestampMillis(invite.startedAt) !== startedAt || timestampMillis(invite.expiresAt) !== expiresAt)) return "";

  return pending.token;
}
