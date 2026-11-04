import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let fetchIo;
let readIo;
let caches;
let opened;
const previousWindow = globalThis.window;
const cleanup = installRuntimeImports({
  "/apiClient.js": { fetchAuthorized: (...args) => fetchIo(...args), fetchAuthorizedWithTimeout: (...args) => fetchIo(...args) },
  "/userScopedStorage.js": { safeWriteUserJsonStorage: (...args) => caches.push(args) },
  "firebase/firestore": { doc: (_, ...parts) => parts.join("/"), getDoc: (...args) => readIo(...args) }
});
after(() => {
  cleanup();
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});
const { createProfileTelegramHandlers } = await import("../src/features/client/profile/profileTelegramHandlers.js");
const { createTelegramNotificationHandler, createClientReminderHandlers } = await import("../src/features/client/profile/profileNotificationHandlers.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const telegram = { connected: true, avatarUrl: "A-avatar", username: "private-A", chatId: "A-chat", telegramUserId: "A-telegram" };
const response = () => ({ ok: true, json: async () => ({ ok: true, telegram, code: "A-code" }) });
const snapshot = () => ({ exists: () => true, data: () => ({ telegram }) });

beforeEach(() => {
  caches = [];
  opened = [];
  fetchIo = async () => response();
  readIo = async () => snapshot();
  globalThis.window = { open: (...args) => opened.push(args) };
});

function fixture(deferUpdates = false) {
  const originalUser = { uid: "A" };
  const auth = { currentUser: originalUser };
  advanceAuthSession(auth);
  const state = { profile: {}, draft: {}, status: "", linking: false, code: "", open: true };
  const queued = [];
  const setter = key => value => {
    const apply = () => { state[key] = typeof value === "function" ? value(state[key]) : value; };
    if (deferUpdates) queued.push(apply);
    else apply();
  };
  const avatarRef = { current: false };
  const handlers = createProfileTelegramHandlers({
    auth, db: {}, TELEGRAM_BOT_USERNAME: "bot", TELEGRAM_PROFILE_STORAGE_KEY: "telegram", telegramDraft: {},
    telegramAvatarRefreshRef: avatarRef,
    setTelegramProfile: setter("profile"), setTelegramDraft: setter("draft"), setTelegramStatus: setter("status"),
    setTelegramLinking: setter("linking"), setTelegramLinkCode: setter("code"), setTelegramConnectOpen: setter("open")
  });
  function transition(sameUid = false) {
    auth.currentUser = null;
    advanceAuthSession(auth, null);
    auth.currentUser = sameUid ? originalUser : { uid: "B" };
    advanceAuthSession(auth);
    Object.assign(state, { profile: { username: "current" }, draft: { username: "current" }, status: "current", linking: false, code: "current", open: true });
  }
  return { auth, state, handlers, avatarRef, transition, flush: () => queued.splice(0).forEach(apply => apply()) };
}

for (const method of ["handleTelegramLoginAuth", "refreshTelegramAvatar", "startTelegramBotLink", "refreshTelegramConnection", "disconnectTelegram"]) {
  for (const sameUid of [false, true]) test(`${method} rejects a response after ${sameUid ? "same-account relogin" : "an account switch"}`, async () => {
    const io = deferred();
    fetchIo = () => io.promise;
    readIo = () => io.promise;
    const f = fixture();
    const pending = f.handlers[method]({ id: "A" });
    f.transition(sameUid);
    const expected = structuredClone(f.state);
    io.resolve(method === "refreshTelegramConnection" ? snapshot() : response());
    await pending;
    assert.deepEqual(f.state, expected);
    assert.deepEqual(caches, []);
    assert.deepEqual(opened, []);
  });
}

test("a deferred React avatar updater cannot cache or publish after a session expires", async () => {
  const f = fixture(true);
  await f.handlers.refreshTelegramAvatar();
  f.transition(true);
  const expected = structuredClone(f.state);
  f.flush();
  assert.deepEqual(f.state, expected);
  assert.deepEqual(caches, []);
});

test("an expired avatar request cannot clear a newer session's in-flight lock", async () => {
  const old = deferred();
  const fresh = deferred();
  let calls = 0;
  fetchIo = () => ++calls === 1 ? old.promise : fresh.promise;
  const f = fixture();
  const first = f.handlers.refreshTelegramAvatar();
  f.transition();
  const second = f.handlers.refreshTelegramAvatar();
  const newLock = f.avatarRef.current;
  old.resolve(response());
  await first;
  assert.equal(f.avatarRef.current, newLock);
  fresh.resolve(response());
  await second;
  assert.equal(f.avatarRef.current, false);
  assert.equal(caches.length, 1);
  assert.equal(caches[0][1], "B");
});

test("current-session Telegram responses preserve normal state and captured-UID cache updates", async () => {
  const f = fixture();
  await f.handlers.refreshTelegramAvatar();
  assert.equal(f.state.profile.username, "private-A");
  assert.equal(f.state.draft.avatarUrl, "A-avatar");
  assert.deepEqual(caches, [["telegram", "A", telegram]]);
});

test("late avatar failure cannot erase the next account's avatar", async () => {
  const io = deferred();
  fetchIo = () => io.promise;
  const f = fixture();
  const pending = f.handlers.refreshTelegramAvatar();
  f.transition();
  f.state.profile.avatarUrl = "B-avatar";
  io.reject(new Error("offline"));
  await pending;
  assert.equal(f.state.profile.avatarUrl, "B-avatar");
  assert.deepEqual(caches, []);
});

test("notification responses and deferred updaters reject the previous login of the same UID", async () => {
  const io = deferred();
  const auth = { currentUser: { uid: "A" } };
  advanceAuthSession(auth);
  let profile = { notificationsEnabled: true };
  let draft = { ...profile };
  const queued = [];
  const handler = createTelegramNotificationHandler({
    auth, telegramDraft: draft,
    setTelegramProfile: update => queued.push(() => { profile = typeof update === "function" ? update(profile) : update; }),
    setTelegramDraft: update => queued.push(() => { draft = typeof update === "function" ? update(draft) : update; }),
    setTelegramStatus: () => {}, request: () => io.promise,
    writeCache: (...args) => caches.push(args)
  });
  const pending = handler(false);
  advanceAuthSession(auth, null);
  advanceAuthSession(auth);
  queued.splice(0).forEach(apply => apply());
  io.resolve(response());
  assert.equal(await pending, false);
  assert.deepEqual(profile, { notificationsEnabled: true });
  assert.deepEqual(draft, profile);
  assert.deepEqual(caches, []);
});

test("reminder settings from a previous same-UID session cannot publish a calendar", async () => {
  const io = deferred();
  const auth = { currentUser: { uid: "A" } };
  advanceAuthSession(auth);
  const calendars = [];
  const handlers = createClientReminderHandlers({ auth, request: () => io.promise, onCalendarSaved: (...args) => calendars.push(args) });
  const pending = handlers.saveReminderSettings({ weightEnabled: true });
  advanceAuthSession(auth, null);
  advanceAuthSession(auth);
  io.resolve({ ok: true, json: async () => ({ ok: true, workoutCalendar: { reminderEnabled: true } }) });
  assert.equal(await pending, false);
  assert.deepEqual(calendars, []);
});
