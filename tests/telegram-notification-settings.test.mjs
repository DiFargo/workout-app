import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createTelegramNotificationHandler } from "../src/features/client/profile/profileNotificationHandlers.js";
import { isTelegramRemindersEnabled } from "../functions/telegramNotificationPreferences.js";

function saveFixture(request, options = {}) {
  let profile = { connected: true, username: "athlete", notificationsEnabled: true };
  let draft = { ...profile };
  let status = "";
  const cached = [];
  const auth = { currentUser: options.signedOut ? null : { uid: "client-1" } };
  const handler = createTelegramNotificationHandler({
    auth, telegramDraft: draft,
    setTelegramProfile: next => { profile = typeof next === "function" ? next(profile) : next; },
    setTelegramDraft: next => { draft = typeof next === "function" ? next(draft) : next; },
    setTelegramStatus: next => { status = next; },
    request,
    writeCache: (uid, next) => { cached.push({ uid, ...next }); if (options.storageError) throw new Error("Storage unavailable"); }
  });
  return { handler, auth, cached, state: () => ({ profile, draft, status }) };
}

test("notification save uses authenticated self endpoint and preserves connection data", async () => {
  const requests = [];
  const fixture = saveFixture(async (...args) => {
    requests.push(args);
    return { ok: true, json: async () => ({ ok: true, telegram: { username: "verified_user" } }) };
  });
  assert.equal(await fixture.handler(false), true);
  assert.equal(requests[0][0], "/api/telegram/update-notifications");
  assert.equal(requests[0][1].method, "POST");
  assert.deepEqual(JSON.parse(requests[0][1].body), { enabled: false });
  assert.deepEqual(fixture.state().profile, { connected: true, username: "verified_user", notificationsEnabled: false });
  assert.deepEqual(fixture.state().draft, fixture.state().profile);
  assert.deepEqual(fixture.cached.at(-1), { uid: "client-1", ...fixture.state().profile });
});

for (const failure of ["network", "http", "payload"]) {
  test(`notification save rolls back profile, draft and cache on ${failure} failure`, async () => {
    const fixture = saveFixture(async () => {
      if (failure === "network") throw new Error("Offline");
      return { ok: failure !== "http", json: async () => ({ ok: failure !== "payload" }) };
    });
    assert.equal(await fixture.handler(false), false);
    assert.equal(fixture.state().profile.notificationsEnabled, true);
    assert.equal(fixture.state().draft.notificationsEnabled, true);
    assert.equal(fixture.cached.at(-1).notificationsEnabled, true);
    assert.match(fixture.state().status, /Не получилось сохранить/);
  });
}

test("signed-out users cannot update preferences or see a false success", async () => {
  let called = false;
  const fixture = saveFixture(async () => { called = true; }, { signedOut: true });
  assert.equal(await fixture.handler(false), false);
  assert.equal(called, false);
  assert.equal(fixture.cached.length, 0);
  assert.equal(fixture.state().profile.notificationsEnabled, true);
});

test("blocked local storage does not prevent saving preferences to the server", async () => {
  const fixture = saveFixture(async () => ({ ok: true, json: async () => ({ ok: true }) }), { storageError: true });
  assert.equal(await fixture.handler(false), true);
  assert.equal(fixture.state().profile.notificationsEnabled, false);
});

test("late preference responses are not applied after an account switch", async () => {
  let finish;
  const fixture = saveFixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = fixture.handler(false);
  fixture.auth.currentUser = { uid: "client-2" };
  finish({ ok: true, json: async () => ({ ok: true, telegram: { username: "old_user" } }) });
  assert.equal(await pending, false);
  assert.equal(fixture.state().profile.username, "athlete");
  assert.ok(fixture.cached.every(entry => entry.uid === "client-1"));
});

// Execute the actual scheduled callback with local Firestore and delivery doubles.
// No Firebase initialization, production reads, or Telegram messages are performed.
const source = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const scheduledSource = source.slice(source.indexOf("export const telegramDailyWorkoutReminders ="), source.indexOf("function getTrainerLocalTime"))
  .replace("export const", "const");

async function scheduledDeliveries(preferences, calendarOverrides = {}, alreadySent = false) {
  const sent = [];
  const user = { ...preferences, workoutCalendar: { enabled: true, reminderEnabled: true, progressReminderSettings: { photoEnabled: true, measurementsEnabled: true }, ...calendarOverrides } };
  const userDoc = { id: "client-1", data: () => user, ref: { collection: () => ({ doc: () => ({ get: async () => ({ exists: alreadySent }) }) }) } };
  const callback = runInNewContext(`${scheduledSource}\ntelegramDailyWorkoutReminders;`, {
    onSchedule: (_options, handler) => handler,
    TELEGRAM_BOT_TOKEN: {},
    admin: { firestore: () => ({ collection: () => ({ where: () => ({ get: async () => ({ docs: [userDoc] }) }) }) }) },
    isTelegramRemindersEnabled,
    getNextScheduledWorkout: () => ({ key: "2026-09-08" }),
    getDueReminderOffsets: () => [24],
    getLatestClientResourceDateKey: async () => "2026-08-01",
    getDueProgressReminderTypes: () => [{ type: "photo", dueDateKey: "2026-09-07" }, { type: "measurements", dueDateKey: "2026-09-07" }],
    sendWorkoutReminderForClient: async () => sent.push("workout"),
    sendProgressReminderForUser: async (_doc, _user, reminder) => sent.push(reminder.type)
  });
  await callback();
  return sent;
}

test("scheduler suppresses all automatic workout and progress reminders after either opt-out", async () => {
  for (const preferences of [
    { telegram: { notificationsEnabled: false } },
    { telegramNotificationsEnabled: false },
    { telegram: { notificationsEnabled: true }, telegramNotificationsEnabled: false },
    { telegram: { notificationsEnabled: false }, telegramNotificationsEnabled: true }
  ]) assert.deepEqual(await scheduledDeliveries(preferences), []);
});

test("enabled and legacy connected users retain workout and progress reminders", async () => {
  for (const preferences of [{}, { telegram: { notificationsEnabled: true }, telegramNotificationsEnabled: true }]) {
    assert.deepEqual(await scheduledDeliveries(preferences), ["workout", "photo", "measurements"]);
  }
});

test("calendar opt-out and reminder deduplication remain effective", async () => {
  assert.deepEqual(await scheduledDeliveries({}, { enabled: false }), []);
  assert.deepEqual(await scheduledDeliveries({}, { reminderEnabled: false }), []);
  assert.deepEqual(await scheduledDeliveries({}, {}, true), []);
});
