import assert from "node:assert/strict";
import test from "node:test";
import { getDueSubscriptionReminders, getSubscriptionStatus, normalizeClientSubscription, renewClientSubscription } from "../src/utils/clientSubscription.js";
import { buildSubscriptionFromTrainerSetupSchedule } from "../src/utils/trainerSetupSchedule.js";
import { getDueSubscriptionNotifications } from "../functions/subscriptionReminders.js";

const now = new Date("2026-10-17T10:00:00Z");
const subscription = {
  periodMode: "sessions", cycleId: "owned-cycle", startDate: "2026-01-01", endDate: "2026-01-31",
  purchasedSessions: 12, usedSessions: 4, remainingSessions: 0,
  history: [{ type: "renewal", previousEndDate: "2025-12-31" }]
};

test("sessions status ignores old period dates but preserves them and history", () => {
  const status = getSubscriptionStatus(subscription, now);
  assert.equal(status.id, "active");
  assert.equal(status.daysRemaining, null);
  assert.equal(status.remainingSessions, 8);
  assert.equal(status.endDate, subscription.endDate);
  assert.deepEqual(status.history, subscription.history);
  assert.deepEqual(getDueSubscriptionReminders(subscription, {}, now), []);
  assert.deepEqual(getDueSubscriptionNotifications(subscription, {}, now), []);
});

test("legacy status and date reminders remain date-based without an explicit mode", () => {
  const legacy = { ...subscription, periodMode: undefined, remainingSessions: 8 };
  assert.equal(getSubscriptionStatus(legacy, now).id, "expired");
  assert.equal(getDueSubscriptionNotifications(legacy, {}, now)[0].kind, "expired");
  assert.equal(normalizeClientSubscription(legacy).periodMode, undefined);
});

for (const usedSessions of [9, 11, 12]) {
  test(`sessions balance ${12 - usedSessions} gives matching frontend/backend reminders`, () => {
    const value = { ...subscription, usedSessions, remainingSessions: 999 };
    const expectedKind = usedSessions === 12 ? "expired" : "sessions";
    const expectedKey = usedSessions === 12 ? "owned-cycle_expired" : `owned-cycle_sessions_${12 - usedSessions}`;
    for (const getReminders of [getDueSubscriptionReminders, getDueSubscriptionNotifications]) {
      const due = getReminders(value, {}, now);
      assert.equal(due.length, 1);
      assert.equal(due[0].kind, expectedKind);
      assert.equal(due[0].key, expectedKey);
      assert.deepEqual(getReminders(value, { sessionsEnabled: false }, now), []);
    }
  });
}

test("sessions mode suppresses date reminders even at configured date thresholds", () => {
  const value = { ...subscription, endDate: "2026-10-20" };
  assert.deepEqual(getDueSubscriptionReminders(value, { dateEnabled: true }, now), []);
  assert.deepEqual(getDueSubscriptionNotifications(value, { dateEnabled: true }, now), []);
});

test("frozen sessions retain frozen behavior and do not emit balance reminders", () => {
  const value = { ...subscription, usedSessions: 12, frozen: true };
  assert.equal(getSubscriptionStatus(value, now).id, "frozen");
  assert.deepEqual(getDueSubscriptionReminders(value, {}, now), []);
  assert.deepEqual(getDueSubscriptionNotifications(value, {}, now), []);
});

test("saving or moving schedule dates preserves all subscription fields exactly", () => {
  for (const dates of [[], ["2026-11-01"], ["2026-12-01", "2026-12-31"]]) {
    const original = structuredClone(subscription);
    const saved = buildSubscriptionFromTrainerSetupSchedule(original, dates);
    assert.deepEqual(saved, subscription);
    assert.deepEqual(original, subscription);
    assert.notEqual(saved, original);
  }
  assert.deepEqual(buildSubscriptionFromTrainerSetupSchedule(undefined, ["2026-11-01"]), {});
});

test("renewal still creates a new cycle and preserves historical period information", () => {
  const renewed = renewClientSubscription(subscription, { periodMode: "sessions", purchasedSessions: 20 }, now);
  assert.notEqual(renewed.cycleId, subscription.cycleId);
  assert.equal(renewed.usedSessions, 0);
  assert.equal(renewed.remainingSessions, 20);
  assert.deepEqual(renewed.history.slice(0, -1), subscription.history);
  assert.equal(renewed.history.at(-1).previousEndDate, subscription.endDate);
  assert.equal(getSubscriptionStatus(renewed, now).daysRemaining, null);
});
