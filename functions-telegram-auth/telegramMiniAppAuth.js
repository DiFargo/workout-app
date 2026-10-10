import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const DEFAULT_MAX_AGE_SECONDS = 10 * 60;
const MAX_FUTURE_SKEW_SECONDS = 30;
const MAX_INIT_DATA_LENGTH = 8192;

export function verifyTelegramMiniAppInitData(
  initData,
  botToken,
  { nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS } = {}
) {
  const raw = String(initData || "");
  const token = String(botToken || "");
  if (!raw || raw.length > MAX_INIT_DATA_LENGTH || !token) return null;

  const params = new URLSearchParams(raw);
  const fields = new Map();
  for (const [key, value] of params.entries()) {
    if (!key || fields.has(key)) return null;
    fields.set(key, value);
  }

  const receivedHash = fields.get("hash");
  const authDate = Number(fields.get("auth_date"));
  if (!/^[a-f0-9]{64}$/i.test(receivedHash || "") || !Number.isInteger(authDate)) return null;
  if (authDate > nowSeconds + MAX_FUTURE_SKEW_SECONDS || nowSeconds - authDate > maxAgeSeconds) return null;

  const dataCheckString = [...fields.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest();
  const suppliedHash = Buffer.from(receivedHash, "hex");
  if (suppliedHash.length !== calculatedHash.length || !crypto.timingSafeEqual(calculatedHash, suppliedHash)) {
    return null;
  }

  let user;
  try {
    user = JSON.parse(fields.get("user") || "null");
  } catch {
    return null;
  }

  const userId = String(user?.id ?? "");
  if (!/^\d{1,16}$/.test(userId)) return null;

  return {
    id: userId,
    username: String(user.username || ""),
    firstName: String(user.first_name || ""),
    lastName: String(user.last_name || "")
  };
}

export function canBootstrapTelegramTestAccount({
  enabled,
  configuredEmail,
  configuredTelegramId,
  telegramId,
  linkedAccountCount = 0
} = {}) {
  const expectedId = String(configuredTelegramId || "").trim();
  const actualId = String(telegramId || "").trim();
  const email = String(configuredEmail || "").trim().toLowerCase();
  return enabled === true &&
    /^\d{1,16}$/.test(expectedId) &&
    actualId === expectedId &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    linkedAccountCount === 0;
}
