import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainerInviteMessage } from "../src/features/trainer/trainerInviteMessage.js";

test("trainer invite message gives the client the activation and first-login steps", () => {
  const message = buildTrainerInviteMessage({
    login: "ilya.fit",
    inviteUrl: "https://example.test/invite/one-time-token"
  });

  assert.match(message, /https:\/\/example\.test\/invite\/one-time-token/);
  assert.match(message, /Твой логин: ilya\.fit/);
  assert.match(message, /создай пароль/);
  assert.match(message, /Есть приглашение от тренера\? Войти/);
  assert.match(message, /созданный пароль/);
});
