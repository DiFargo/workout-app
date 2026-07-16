import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSubscriptionReminderLine,
  getDueSubscriptionNotifications,
  resolveSubscriptionNotificationSettings
} from "../functions/subscriptionReminders.js";

test("backend reminder keys are stable within a subscription cycle", () => {
  const due = getDueSubscriptionNotifications(
    { cycleId: "cycle-1", endDate: "2026-07-18", purchasedSessions: 10, usedSessions: 9 },
    {},
    new Date("2026-07-15T10:00:00Z")
  );
  assert.deepEqual(due.map((item) => item.key), ["cycle-1_date_3", "cycle-1_sessions_1"]);
});

test("backend omits frozen subscriptions", () => {
  assert.deepEqual(getDueSubscriptionNotifications({ frozen: true, endDate: "2026-07-15" }, {}, new Date("2026-07-15T10:00:00Z")), []);
});

test("disabled global channels suppress expired subscription notifications", () => {
  const settings = { dateEnabled: false, sessionsEnabled: false };
  const expired = { endDate: "2026-07-14", purchasedSessions: 10, usedSessions: 10 };
  assert.deepEqual(getDueSubscriptionNotifications(expired, settings, new Date("2026-07-15T10:00:00Z")), []);
});

test("an expired subscription follows the enabled expiration channel", () => {
  const now = new Date("2026-07-15T10:00:00Z");
  assert.equal(getDueSubscriptionNotifications(
    { endDate: "2026-07-14", purchasedSessions: 10, usedSessions: 5 },
    { dateEnabled: true, sessionsEnabled: false },
    now
  )[0]?.kind, "expired");
  assert.equal(getDueSubscriptionNotifications(
    { endDate: "2026-07-20", purchasedSessions: 10, usedSessions: 10 },
    { dateEnabled: false, sessionsEnabled: true },
    now
  )[0]?.kind, "expired");
});

test("digest line contains no sensitive client health data", () => {
  const line = buildSubscriptionReminderLine({ name: "Илья", injuryNote: "private" }, { kind: "sessions", remainingSessions: 2 });
  assert.equal(line, "Илья — осталось 2 трен.");
  assert.doesNotMatch(line, /private/);
});

test("trainer subscription settings override legacy client settings", () => {
  const trainer = {
    subscriptionNotificationSettings: {
      dateEnabled: true,
      sessionsEnabled: false,
      dayThresholds: [5],
      warningDays: 5,
      digestMode: "daily",
      sendTime: "10:00"
    }
  };
  const client = {
    subscriptionNotificationSettings: {
      dateEnabled: true,
      dayThresholds: [3],
      warningDays: 3,
      digestMode: "separate",
      sendTime: "09:00"
    }
  };
  const settings = resolveSubscriptionNotificationSettings(trainer, client);
  const due = getDueSubscriptionNotifications(
    { cycleId: "global", endDate: "2026-07-18" },
    settings,
    new Date("2026-07-15T10:00:00Z")
  );

  assert.equal(settings, trainer.subscriptionNotificationSettings);
  assert.deepEqual(due, []);
});

test("legacy client settings remain a fallback until global settings are saved", () => {
  const client = {
    subscriptionNotificationSettings: {
      dateEnabled: true,
      dayThresholds: [3],
      warningDays: 3
    }
  };
  const settings = resolveSubscriptionNotificationSettings({}, client);
  const due = getDueSubscriptionNotifications(
    { cycleId: "legacy", endDate: "2026-07-18" },
    settings,
    new Date("2026-07-15T10:00:00Z")
  );

  assert.equal(settings, client.subscriptionNotificationSettings);
  assert.deepEqual(due.map((item) => item.key), ["legacy_date_3"]);
});

test("one trainer settings object is reused for every assigned client", () => {
  const trainer = { subscriptionNotificationSettings: {} };
  assert.equal(resolveSubscriptionNotificationSettings(trainer, { subscriptionNotificationSettings: { warningDays: 2 } }), trainer.subscriptionNotificationSettings);
  assert.equal(resolveSubscriptionNotificationSettings(trainer, { subscriptionNotificationSettings: { warningDays: 9 } }), trainer.subscriptionNotificationSettings);
});
