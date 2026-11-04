import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainerInviteMessage, buildTrainerTelegramChatUrl, normalizeTrainerTelegramUsername } from "../src/features/trainer/trainerInviteMessage.js";

test("trainer invite message gives the client the activation and first-login steps", () => {
  const message = buildTrainerInviteMessage({
    login: "ilya.fit",
    inviteUrl: "https://example.test/invite/one-time-token"
  });

  assert.match(message, /https:\/\/example\.test\/invite\/one-time-token/);
  assert.match(message, /Твой логин: ilya\.fit/);
  assert.match(message, /создай пароль/);
  assert.match(message, /После создания пароля выбери «Email или логин»/);
});

test("Telegram invite directs the client through bot Start and the signed Mini App acceptance", () => {
  const message = buildTrainerInviteMessage({
    login: "tg_ilya_123456",
    botStartUrl: "https://t.me/zmena_teleg_bot?start=invite_abc123",
    inviteUrl: "https://tren-85720.web.app/invite/fallback-token"
  });

  assert.match(message, /нажми Start в Telegram/);
  assert.match(message, /Принять приглашение/);
  assert.match(message, /выбери «Telegram» и нажми «Принять приглашение»/);
  assert.match(message, /Логин для входа по паролю: tg_ilya_123456/);
  assert.match(message, /сначала создай его по ссылке: https:\/\/tren-85720\.web\.app\/invite\/fallback-token/);
});

test("Telegram nickname chat links are normalized and invalid usernames are rejected", () => {
  assert.equal(normalizeTrainerTelegramUsername(" @Ilya_fit "), "ilya_fit");
  assert.equal(normalizeTrainerTelegramUsername("@"), null);
  assert.equal(normalizeTrainerTelegramUsername("not a username"), null);
  assert.equal(buildTrainerTelegramChatUrl("@Ilya_fit", "hello world"), "https://t.me/ilya_fit?text=hello%20world");
  assert.equal(buildTrainerTelegramChatUrl("bad username", "hello"), "");
});
