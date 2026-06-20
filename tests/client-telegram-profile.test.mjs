import test from "node:test";
import assert from "node:assert/strict";

import { getClientTelegramProfile } from "../src/utils/clientTelegramProfile.js";

test("client telegram profile reads nested telegram fields first", () => {
  assert.deepEqual(
    getClientTelegramProfile({
      telegramUsername: "root_user",
      telegramDisplayName: "Root Name",
      telegram: {
        connected: true,
        username: "nested_user",
        displayName: "Nested Name",
        notificationsEnabled: true,
        avatarUrl: "/avatar.png"
      }
    }),
    {
      connected: true,
      username: "nested_user",
      displayName: "Nested Name",
      notificationsEnabled: true,
      avatarUrl: "/avatar.png"
    }
  );
});

test("client telegram profile falls back to root fields", () => {
  assert.deepEqual(
    getClientTelegramProfile({
      telegramConnected: true,
      telegramUsername: "root_user",
      telegramDisplayName: "Root Name"
    }),
    {
      connected: true,
      username: "root_user",
      displayName: "Root Name",
      notificationsEnabled: true
    }
  );
});

test("client telegram notifications can be disabled from either source", () => {
  assert.equal(
    getClientTelegramProfile({
      telegram: { username: "client", notificationsEnabled: false }
    }).notificationsEnabled,
    false
  );
  assert.equal(
    getClientTelegramProfile({
      telegramUsername: "client",
      telegramNotificationsEnabled: false
    }).notificationsEnabled,
    false
  );
});
