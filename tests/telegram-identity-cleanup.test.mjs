import assert from "node:assert/strict";
import test from "node:test";

import { getTelegramIdentityIds, isTelegramIdentityOwnedBy } from "../functions/telegramIdentityCleanup.js";

test("account deletion finds each valid top-level and nested Telegram identity once", () => {
  assert.deepEqual(getTelegramIdentityIds({
    telegramUserId: "1476236684",
    telegram: { telegramUserId: "1476236684" }
  }), ["1476236684"]);
  assert.deepEqual(getTelegramIdentityIds({
    telegramUserId: "1476236684",
    telegram: { telegramUserId: "987654321" }
  }), ["1476236684", "987654321"]);
  assert.deepEqual(getTelegramIdentityIds({ telegramUserId: "bad-id", telegram: { telegramUserId: "" } }), []);
});

test("account deletion removes only an identity marker owned by that UID", () => {
  assert.equal(isTelegramIdentityOwnedBy({ uid: "deleted-client" }, "deleted-client"), true);
  assert.equal(isTelegramIdentityOwnedBy({ uid: "replacement-client" }, "deleted-client"), false);
  assert.equal(isTelegramIdentityOwnedBy({ uid: "deleted-client" }, ""), false);
});
