import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTelegramUsername,
  parseTelegramAuthResultFromHash
} from "../src/utils/telegramProfile.js";

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

test("telegram username normalization removes leading at signs", () => {
  assert.equal(normalizeTelegramUsername("  @@coach_name "), "coach_name");
});

test("telegram auth result is parsed from url hash", () => {
  const payload = { id: 123, username: "coach" };
  const parsed = parseTelegramAuthResultFromHash(`#tgAuthResult=${toBase64Url(payload)}`);

  assert.deepEqual(parsed, payload);
});
