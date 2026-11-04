const INTERNAL_EMAIL_DOMAINS = new Set([
  "invite.tren-85720.app", "invite.tren-85720-staging.app",
  "telegram.tren-85720.app", "telegram.tren-85720-staging.app"
]);
const text = value => typeof value === "string" ? value.trim() : "";
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const identity = value => typeof value === "number" && Number.isSafeInteger(value) && value > 0
  ? String(value) : text(value);
const TELEGRAM_ID = /^\d{1,16}$/;
const hasIdentity = value => value !== undefined && value !== null && value !== "";

// Read-only presentation of fields already available to the assigned trainer.
// Never infer an alias from a name/email, read credential fields, or treat a
// saved Telegram username as proof of a server-confirmed account binding.
export function getTrainerClientAccessInfo(value = {}) {
  const client = record(value);
  const account = record(client.accountProfile);
  const telegram = record(client.telegram);
  const loginCandidate = text(client.loginLower) || text(account.login);
  const login = /^[a-z0-9._-]{3,32}$/i.test(loginCandidate) ? loginCandidate.toLowerCase() : "";
  const emailCandidate = text(client.email) || text(account.email);
  const domain = emailCandidate.slice(emailCandidate.lastIndexOf("@") + 1).toLowerCase();
  const internalEmail = INTERNAL_EMAIL_DOMAINS.has(domain) || domain === "invalid" || domain.endsWith(".invalid");
  const email = !internalEmail && emailCandidate.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)
    ? emailCandidate : "";
  const usernameCandidate = (text(telegram.username) || text(client.telegramUsername)).replace(/^@/, "");
  const telegramUsername = /^[a-z0-9_]{5,32}$/i.test(usernameCandidate) ? usernameCandidate : "";
  const nestedIdentity = telegram.telegramUserId;
  const legacyIdentity = client.telegramUserId;
  const nestedId = identity(nestedIdentity);
  const legacyId = identity(legacyIdentity);
  const validId = TELEGRAM_ID.test(nestedId || legacyId) &&
    (!hasIdentity(nestedIdentity) || TELEGRAM_ID.test(nestedId)) &&
    (!hasIdentity(legacyIdentity) || TELEGRAM_ID.test(legacyId));
  const matchingIds = !(nestedId && legacyId && nestedId !== legacyId);
  const connectedFlag = typeof telegram.connected === "boolean" ? telegram.connected
    : typeof client.telegramConnected === "boolean" ? client.telegramConnected : null;
  const telegramState = connectedFlag === false ? "disconnected"
    : connectedFlag === true && validId && matchingIds ? "connected"
      : telegramUsername || nestedId || legacyId || connectedFlag === true ? "unconfirmed" : "unknown";
  return { login, email, internalEmail, telegramUsername, telegramState };
}
