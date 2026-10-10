import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { getClientReminderSettings, mergeReminderCalendarPatch } from "../src/utils/clientReminderSettings.js";
import { buildClientReminderCalendarPatch } from "../functions/clientReminderSettings.js";
import { createClientReminderHandlers } from "../src/features/client/profile/profileNotificationHandlers.js";

const settings = { workoutEnabled: false, offsets: [1, 24], photoEnabled: true, measurementsEnabled: true,
  photoIntervalDays: 7, measurementsIntervalDays: 30, reminderTime: "18:35" };
const now = "2026-09-16T08:00:00.000Z";

test("reads defaults and legacy preferences without enabling photo/measurement reminders implicitly", () => {
  assert.deepEqual(getClientReminderSettings(), { workoutEnabled: true, offsets: [24], photoEnabled: false,
    measurementsEnabled: false, photoIntervalDays: 14, measurementsIntervalDays: 14, reminderTime: "10:00" });
  const legacy = getClientReminderSettings({ reminderOffsetsHours: ["3", "12", 999], progressPhotoReminderEnabled: true,
    progressReminderIntervalDays: 30, progressReminderTime: "19:20" });
  assert.deepEqual(legacy.offsets, [12, 3]);
  assert.equal(legacy.photoIntervalDays, 30);
  assert.equal(legacy.photoEnabled, true);
  assert.equal(legacy.reminderTime, "19:20");
  assert.deepEqual(getClientReminderSettings({ reminderOffsetsHours: "broken" }).offsets, [24]);
});

test("patch keeps calendar, per-day time, trainer metadata and reminder cycle intact", () => {
  const calendar = { scheduledDates: ["2026-09-18"], enabled: false, workoutTime: "17:30", daySettings: { fri: { workoutTime: "18:00" } },
    progressReminderSettings: { startedAt: "2026-08-01", custom: "keep" } };
  const patch = buildClientReminderCalendarPatch(settings, calendar, now);
  assert.ok(!("scheduledDates" in patch));
  assert.ok(!("enabled" in patch));
  assert.ok(!("workoutTime" in patch));
  const merged = mergeReminderCalendarPatch(calendar, patch);
  assert.deepEqual(merged.scheduledDates, calendar.scheduledDates);
  assert.deepEqual(merged.daySettings, calendar.daySettings);
  assert.equal(merged.progressReminderSettings.startedAt, "2026-08-01");
  assert.equal(merged.progressReminderSettings.custom, "keep");
  assert.equal(merged.progressReminderTime, "18:35");
  assert.equal(merged.progressPhotoReminderEnabled, true);
  assert.equal(merged.measurementsReminderEnabled, true);
  assert.deepEqual(getClientReminderSettings(merged), { ...settings, offsets: [24, 1] });
  assert.equal(buildClientReminderCalendarPatch(settings, { updatedAt: "2026-08-10" }, now).progressReminderSettings.startedAt, "2026-08-10");
});

test("server rejects malformed or privileged settings before any write", () => {
  for (const bad of [null, [], {}, { ...settings, offsets: [] }, { ...settings, offsets: [0] }, { ...settings, offsets: ["24"] },
    { ...settings, photoIntervalDays: 1 }, { ...settings, measurementsIntervalDays: 365 }, { ...settings, reminderTime: "24:00" },
    { ...settings, reminderTime: "12:60" }, { ...settings, photoEnabled: "false" }, { ...settings, scheduledDates: [] },
    { ...settings, role: "admin" }]) {
    assert.throws(() => buildClientReminderCalendarPatch(bad), error => error.status === 400);
  }
});

test("client handler sends own settings, updates state only after confirmed persistence, and test is explicit", async () => {
  const calls = [], saved = [];
  const handlers = createClientReminderHandlers({ auth: { currentUser: { uid: "client" } },
    request: async (url, options) => {
      calls.push([url, JSON.parse(options.body)]);
      return { ok: true, json: async () => ({ ok: true, workoutCalendar: buildClientReminderCalendarPatch(settings) }) };
    }, onCalendarSaved: (...args) => saved.push(args) });
  assert.equal(await handlers.saveReminderSettings(settings), true);
  assert.deepEqual(calls[0], ["/api/telegram/update-notifications", { reminderSettings: settings }]);
  assert.equal(saved[0][1], "client");
  assert.equal(calls.length, 1);
  assert.equal(await handlers.sendTestReminder(), true);
  assert.deepEqual(calls[1], ["/api/telegram/test-workout-reminder", {}]);
});

test("failed, unconfirmed or late saves never update another account or report success", async () => {
  for (const kind of ["network", "http", "payload", "old-server", "account-switch", "signed-out"]) {
    const auth = { currentUser: kind === "signed-out" ? null : { uid: "one" } };
    let writes = 0, requests = 0;
    const handler = createClientReminderHandlers({ auth, onCalendarSaved: () => writes++, request: async () => {
      requests++;
      if (kind === "network") throw new Error("offline");
      if (kind === "account-switch") auth.currentUser = { uid: "two" };
      return { ok: kind !== "http", json: async () => ({ ok: kind !== "payload", ...(kind === "old-server" ? {} : { workoutCalendar: {} }) }) };
    } });
    assert.equal(await handler.saveReminderSettings(settings), false, kind);
    assert.equal(writes, 0, kind);
    if (kind === "signed-out") assert.equal(requests, 0);
  }
});

const source = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
function endpoint(name, next, context, extra = {}) {
  const writes = [], sends = [];
  const ref = { set: async (...args) => writes.push(args) };
  const code = source.slice(source.indexOf(`export const ${name} =`), source.indexOf(`export const ${next} =`)).replace("export const", "const");
  const handler = runInNewContext(`${code}\n${name};`, {
    onRequest: (_options, fn) => fn, TELEGRAM_BOT_TOKEN: {}, console: { error() {} },
    requireActiveMember: async () => { if (!context) throw Object.assign(new Error("Unauthorized"), { status: 401 }); return context; },
    admin: { firestore: Object.assign(() => ({ collection: () => ({ doc: () => ref }) }), { FieldValue: { serverTimestamp: () => "server-time" } }) },
    getManagedClient: async (_context, id) => {
      if (context.role !== "trainer" || id !== "assigned-client") throw Object.assign(new Error("Denied"), { status: 403 });
      return { id, ref, data: {} };
    },
    buildClientReminderCalendarPatch, buildTelegramResponseProfile: value => value,
    json: (_res, status, data) => ({ status, data }), getHttpErrorStatus: error => error.status || 500,
    enforceRateLimit: async () => {}, sendWorkoutReminderForClient: async (...args) => sends.push(args), ...extra
  });
  return { call: (body, method = "POST") => handler({ method, body }, {}), writes, sends };
}

test("actual update endpoint accepts own preferences without touching Telegram identity or workout dates", async () => {
  const api = endpoint("telegramUpdateNotifications", "telegramDisconnect", { uid: "client", role: "client", userData: {
    telegram: { chatId: "secret", connected: true }, workoutCalendar: { scheduledDates: ["2026-09-18"] } } });
  const result = await api.call({ reminderSettings: settings });
  assert.equal(result.status, 200);
  assert.equal(api.writes.length, 1);
  assert.ok(!("telegram" in api.writes[0][0]));
  assert.ok(!("scheduledDates" in api.writes[0][0].workoutCalendar));
  assert.equal(api.writes[0][1].merge, true);
  assert.equal((await api.call({ enabled: false })).status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(api.writes[1][0].telegram)), { notificationsEnabled: false });
});

test("actual update endpoint validates payload, authentication and target access", async () => {
  for (const [body, status] of [[{ reminderSettings: { ...settings, role: "admin" } }, 400], [{}, 400], [{ enabled: "yes" }, 400],
    [{ clientId: "other", reminderSettings: settings }, 403]]) {
    const api = endpoint("telegramUpdateNotifications", "telegramDisconnect", { uid: "client", role: "client", userData: {} });
    assert.equal((await api.call(body)).status, status);
    assert.equal(api.writes.length, 0);
  }
  const signedOut = endpoint("telegramUpdateNotifications", "telegramDisconnect", null);
  assert.equal((await signedOut.call({ reminderSettings: settings })).status, 401);
  assert.equal(signedOut.writes.length, 0);
});

test("test endpoint permits self and assigned trainer only and enforces its rate limit", async () => {
  const api = endpoint("telegramTestWorkoutReminder", "telegramDailyWorkoutReminders", { uid: "client", role: "client", userData: {} });
  assert.equal((await api.call({})).status, 200);
  assert.equal(api.sends[0][0], "client");
  assert.equal((await api.call({ clientId: "other" })).status, 403);
  assert.equal(api.sends.length, 1);
  const trainer = endpoint("telegramTestWorkoutReminder", "telegramDailyWorkoutReminders", { uid: "coach", role: "trainer" });
  assert.equal((await trainer.call({ clientId: "assigned-client" })).status, 200);
  assert.equal((await trainer.call({ clientId: "unassigned" })).status, 403);
  const limited = endpoint("telegramTestWorkoutReminder", "telegramDailyWorkoutReminders", { uid: "client" }, {
    enforceRateLimit: async () => { throw Object.assign(new Error("Limited"), { status: 429 }); }
  });
  assert.equal((await limited.call({})).status, 429);
  assert.equal(limited.sends.length, 0);
});
