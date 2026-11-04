import assert from "node:assert/strict";
import test from "node:test";
import { getTelegramInviteAcceptanceError } from "../functions-telegram-auth/telegramInviteAcceptance.js";

const fixture = () => ({
  invite: {
    inviteKind: "client",
    role: "client",
    uid: "client-one",
    trainerId: "trainer-one",
    inviteId: "client@example.test",
    telegramUsername: "ilya_fit",
    telegramUserId: "1476236684",
    telegramChatId: "1476236684",
    status: "started",
    expiresAt: "2026-10-22T12:00:00.000Z"
  },
  profile: { role: "client", active: true, trainerId: "trainer-one" },
  clientInvite: { status: "active", authUid: "client-one", trainerId: "trainer-one" },
  identity: null,
  telegramUser: { id: "1476236684", username: "ilya_fit", firstName: "Ilya", lastName: "Fit" },
  now: Date.parse("2026-10-15T12:00:00.000Z")
});

test("acceptance requires a live started client invite bound to the exact Telegram identity and trainer", () => {
  assert.equal(getTelegramInviteAcceptanceError(fixture()), "");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), telegramUser: { ...fixture().telegramUser, username: "someone_else" } }), "telegram-invite-username-mismatch");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), telegramUser: { ...fixture().telegramUser, id: "987654321" } }), "telegram-invite-account-mismatch");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), invite: { ...fixture().invite, status: "active" } }), "telegram-invite-not-started");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), invite: { ...fixture().invite, expiresAt: "2026-10-14T12:00:00.000Z" } }), "telegram-invite-expired");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), identity: { uid: "another-client" } }), "telegram-invite-account-mismatch");
});

test("disabled profiles, altered trainer assignment and consumed invitations are rejected", () => {
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), profile: { ...fixture().profile, active: false } }), "telegram-invite-account-unavailable");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), profile: { ...fixture().profile, trainerId: "trainer-two" } }), "telegram-invite-account-unavailable");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), clientInvite: { ...fixture().clientInvite, authUid: "another-client" } }), "telegram-invite-invalid");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), invite: { ...fixture().invite, status: "accepted", acceptedTelegramUserId: "1476236684" }, clientInvite: { ...fixture().clientInvite, status: "accepted", acceptedUid: "client-one" } }), "");
  assert.equal(getTelegramInviteAcceptanceError({ ...fixture(), invite: { ...fixture().invite, status: "accepted", acceptedTelegramUserId: "someone-else" } }), "telegram-invite-already-used");
});
