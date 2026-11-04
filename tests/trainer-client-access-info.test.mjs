import test from "node:test";
import assert from "node:assert/strict";
import { getTrainerClientAccessInfo } from "../src/utils/trainerClientAccessInfo.js";

test("используются сохранённые логин и почта, а не имя или Telegram-ник", () => {
  assert.deepEqual(getTrainerClientAccessInfo({ loginLower: " Client_1 ", email: "client@example.com",
    accountProfile: { login: "old_login", email: "old@example.com" } }), {
    login: "client_1", email: "client@example.com", internalEmail: false, telegramUsername: "", telegramState: "unknown"
  });
  const legacy = getTrainerClientAccessInfo({ accountProfile: { login: "legacy", email: "legacy@example.com" } });
  assert.equal(legacy.login, "legacy"); assert.equal(legacy.email, "legacy@example.com");
  assert.equal(getTrainerClientAccessInfo({ name: "client", email: "client@example.com", telegramUsername: "client_name" }).login, "");
});

test("служебная почта скрыта, но старый emailIsInternal не скрывает личную почту", () => {
  for (const domain of ["invite.tren-85720.app", "invite.tren-85720-staging.app", "telegram.tren-85720.app", "telegram.tren-85720-staging.app", "invalid.invalid"]) {
    const info = getTrainerClientAccessInfo({ email: `private@${domain.toUpperCase()}` });
    assert.equal(info.email, ""); assert.equal(info.internalEmail, true);
  }
  assert.equal(getTrainerClientAccessInfo({ emailIsInternal: true, email: "real@example.com" }).email, "real@example.com");
  assert.equal(getTrainerClientAccessInfo({ email: "private@invite.tren-85720.app", accountProfile: { email: "unconfirmed@example.com" } }).email, "");
});

test("некорректные и отсутствующие поля не выдаются за данные для входа", () => {
  for (const value of [null, undefined, [], "invalid", {}]) {
    const info = getTrainerClientAccessInfo(value);
    assert.equal(info.login, ""); assert.equal(info.email, ""); assert.equal(info.telegramState, "unknown");
  }
  for (const loginLower of ["ab", "long".repeat(10), "not valid", "user@example.com", {}]) assert.equal(getTrainerClientAccessInfo({ loginLower }).login, "");
  for (const email of ["not-an-email", "test@ example.com", "x".repeat(250) + "@test.com", {}]) assert.equal(getTrainerClientAccessInfo({ email }).email, "");
});

test("подключение Telegram требует точного флага и согласованного числового ID", () => {
  assert.equal(getTrainerClientAccessInfo({ telegram: { connected: true, telegramUserId: "123", username: "client_name" } }).telegramState, "connected");
  assert.equal(getTrainerClientAccessInfo({ telegramConnected: true, telegramUserId: 123 }).telegramState, "connected");
  assert.equal(getTrainerClientAccessInfo({ telegram: { connected: true, telegramUserId: "123" }, telegramUserId: "456" }).telegramState, "unconfirmed");
  assert.equal(getTrainerClientAccessInfo({ telegram: { connected: true, telegramUserId: "123" }, telegramUserId: "invalid" }).telegramState, "unconfirmed");
  assert.equal(getTrainerClientAccessInfo({ telegram: { connected: true, telegramUserId: {} }, telegramUserId: "123" }).telegramState, "unconfirmed");
  for (const telegram of [{ username: "client_name" }, { connected: true }, { telegramUserId: "123" },
    { connected: "true", telegramUserId: "123" }, { connected: true, telegramUserId: "not-id" },
    { connected: true, telegramUserId: 12345678901234567 }]) assert.notEqual(getTrainerClientAccessInfo({ telegram }).telegramState, "connected");
});

test("отключение и старые username-only данные не становятся подтверждённой привязкой", () => {
  const legacy = getTrainerClientAccessInfo({ telegramUsername: "@Legacy_Name" });
  assert.equal(legacy.telegramUsername, "Legacy_Name"); assert.equal(legacy.telegramState, "unconfirmed");
  assert.equal(getTrainerClientAccessInfo({ telegram: { connected: false, username: "client_name" }, telegramConnected: true, telegramUserId: "123" }).telegramState, "disconnected");
  for (const username of ["bad-name", "<script>", "@@client", "tiny", "name".repeat(9)]) assert.equal(getTrainerClientAccessInfo({ telegramUsername: username }).telegramUsername, "");
});

test("модель читает только разрешённые поля и не изменяет профиль", () => {
  const sensitive = () => { throw new Error("credential must not be read"); };
  const client = { loginLower: "client", email: "client@example.com", telegram: { connected: true, telegramUserId: "123" },
    accountProfile: { login: "client", email: "client@example.com" } };
  for (const key of ["password", "passwordHash", "temporaryPassword", "activationUrl", "telegramLinkCode", "emailIsInternal", "pendingEmail"])
    Object.defineProperty(client, key, { get: sensitive });
  Object.defineProperty(client.accountProfile, "password", { get: sensitive });
  Object.defineProperty(client.telegram, "chatId", { get: sensitive });
  Object.freeze(client.telegram); Object.freeze(client.accountProfile); Object.freeze(client);
  const info = getTrainerClientAccessInfo(client);
  assert.deepEqual(Object.keys(info).sort(), ["email", "internalEmail", "login", "telegramState", "telegramUsername"]);
  assert.equal(info.login, "client"); assert.equal(info.telegramState, "connected");
});
