import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTelegramBotInviteStartUrl,
  buildTelegramInviteAppUrl,
  getTelegramClientInviteStartError,
  normalizeTelegramUsername
} from "../functions/telegramClientInvite.js";

const activeInvite = {
  inviteKind: "client",
  role: "client",
  uid: "client-one",
  trainerId: "trainer-one",
  telegramUsername: "ilya_fit",
  status: "active",
  expiresAt: "2026-10-22T12:00:00.000Z"
};

test("Telegram username normalization accepts @handle and rejects malformed input", () => {
  assert.equal(normalizeTelegramUsername(" @Ilya_Fit "), "ilya_fit");
  assert.equal(normalizeTelegramUsername(""), "");
  assert.equal(normalizeTelegramUsername("@"), null);
  assert.equal(normalizeTelegramUsername("bad username"), null);
  assert.equal(normalizeTelegramUsername("abc"), null);
});

test("client invite can be started only by the targeted Telegram account before expiry", () => {
  assert.equal(getTelegramClientInviteStartError(activeInvite, {
    telegramUserId: "1476236684", telegramUsername: "ILYA_fit", now: Date.parse("2026-10-15T12:00:00.000Z")
  }), "");
  assert.equal(getTelegramClientInviteStartError(activeInvite, {
    telegramUserId: "1476236684", telegramUsername: "other_name", now: Date.parse("2026-10-15T12:00:00.000Z")
  }), "telegram-invite-username-mismatch");
  assert.equal(getTelegramClientInviteStartError(activeInvite, {
    telegramUserId: "bad", telegramUsername: "ilya_fit", now: Date.parse("2026-10-15T12:00:00.000Z")
  }), "telegram-invite-already-claimed");
  assert.equal(getTelegramClientInviteStartError({ ...activeInvite, status: "accepted" }, {
    telegramUserId: "1476236684", telegramUsername: "ilya_fit", now: Date.parse("2026-10-15T12:00:00.000Z")
  }), "telegram-invite-already-used");
  assert.equal(getTelegramClientInviteStartError(activeInvite, {
    telegramUserId: "1476236684", telegramUsername: "ilya_fit", now: Date.parse("2026-10-23T12:00:00.000Z")
  }), "telegram-invite-expired");
});

test("bot and Mini App links are generated for the configured bot and HTTPS app only", () => {
  const token = "client-invite-token_1234567890";
  assert.equal(
    buildTelegramBotInviteStartUrl("@zmena_teleg_bot", token),
    `https://t.me/zmena_teleg_bot?start=invite_${token}`
  );
  assert.equal(buildTelegramBotInviteStartUrl("bad username", token), "");
  assert.equal(
    buildTelegramInviteAppUrl("https://tren-85720.web.app/", token),
    `https://tren-85720.web.app/?telegramInvite=${token}`
  );
  assert.equal(buildTelegramInviteAppUrl("http://example.test/", token), "");
});
