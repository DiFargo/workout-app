const TELEGRAM_USER_ID_PATTERN = /^\d{1,16}$/;

export function getTelegramIdentityIds(userData = {}) {
  const telegram = userData.telegram && typeof userData.telegram === "object" ? userData.telegram : {};
  return [...new Set([userData.telegramUserId, telegram.telegramUserId]
    .map(value => String(value || "").trim())
    .filter(value => TELEGRAM_USER_ID_PATTERN.test(value)))];
}

export function isTelegramIdentityOwnedBy(identityData, uid) {
  const ownerUid = String(uid || "").trim();
  return Boolean(ownerUid && String(identityData?.uid || "").trim() === ownerUid);
}
