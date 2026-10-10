import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { canBootstrapTelegramTestAccount, verifyTelegramMiniAppInitData } from "../functions-telegram-auth/telegramMiniAppAuth.js";

const botToken = "test-bot-token";
const nowSeconds = 1_800_000_000;

function makeInitData(fields, token = botToken) {
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams([...Object.entries(fields), ["hash", hash]]).toString();
}

function validFields(overrides = {}) {
  return {
    auth_date: String(nowSeconds - 20),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify({ id: 123456789, first_name: "Ilya", username: "ilya" }),
    ...overrides
  };
}

test("valid Telegram Mini App initData returns a normalized Telegram identity", () => {
  const initData = makeInitData(validFields());

  assert.deepEqual(verifyTelegramMiniAppInitData(initData, botToken, { nowSeconds }), {
    id: "123456789",
    username: "ilya",
    firstName: "Ilya",
    lastName: ""
  });
});

test("rejects altered signatures and wrong bot tokens", () => {
  const initData = makeInitData(validFields());

  assert.equal(verifyTelegramMiniAppInitData(`${initData}&query_id=forged`, botToken, { nowSeconds }), null);
  assert.equal(verifyTelegramMiniAppInitData(initData, "another-bot-token", { nowSeconds }), null);
});

test("rejects expired, future-dated, malformed, and duplicated initData", () => {
  const expired = makeInitData(validFields({ auth_date: String(nowSeconds - 601) }));
  const future = makeInitData(validFields({ auth_date: String(nowSeconds + 31) }));
  const malformedUser = makeInitData(validFields({ user: "not-json" }));

  assert.equal(verifyTelegramMiniAppInitData(expired, botToken, { nowSeconds }), null);
  assert.equal(verifyTelegramMiniAppInitData(future, botToken, { nowSeconds }), null);
  assert.equal(verifyTelegramMiniAppInitData(malformedUser, botToken, { nowSeconds }), null);
  assert.equal(verifyTelegramMiniAppInitData(`${makeInitData(validFields())}&auth_date=${nowSeconds}`, botToken, { nowSeconds }), null);
});

test("staging bootstrap requires the exact allowlisted Telegram ID, email, and no existing link", () => {
  const config = {
    enabled: true,
    configuredEmail: "kriptonit27@gmail.com",
    configuredTelegramId: "1476236684",
    telegramId: "1476236684",
    linkedAccountCount: 0
  };

  assert.equal(canBootstrapTelegramTestAccount(config), true);
  assert.equal(canBootstrapTelegramTestAccount({ ...config, enabled: false }), false);
  assert.equal(canBootstrapTelegramTestAccount({ ...config, telegramId: "1476236685" }), false);
  assert.equal(canBootstrapTelegramTestAccount({ ...config, configuredEmail: "" }), false);
  assert.equal(canBootstrapTelegramTestAccount({ ...config, linkedAccountCount: 1 }), false);
});
