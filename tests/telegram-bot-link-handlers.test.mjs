import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let request;
let read;
let caches;
const cleanup = installRuntimeImports({
  "/apiClient.js": { fetchAuthorized: (...args) => request(...args), fetchAuthorizedWithTimeout: (...args) => request(...args) },
  "/userScopedStorage.js": { safeWriteUserJsonStorage: (...args) => caches.push(args) },
  "firebase/firestore": { doc: (_db, ...parts) => parts.join("/"), getDoc: (...args) => read(...args) }
});
after(cleanup);
const { createProfileTelegramHandlers } = await import("../src/features/client/profile/profileTelegramHandlers.js");
const code = "synthetic_link_code_123456";
const botStartUrl = `https://t.me/example_bot?start=${code}`;
const expiresAt = "2099-01-01T00:00:00.000Z";
const response = (extra = {}) => ({ ok: true, json: async () => ({ ok: true, code, botStartUrl, expiresAt, ...extra }) });
const snapshot = connected => ({ exists: () => true, data: () => connected ? { telegram: { connected: true, username: "synthetic", avatarUrl: "https://example.test/avatar" } } : {} });
function deferred() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

beforeEach(() => { caches = []; request = async () => response(); read = async () => snapshot(true); });

function fixture() {
  const auth = { currentUser: { uid: "A" } };
  advanceAuthSession(auth);
  const state = { code: "old-code", linking: false, status: "", profile: {}, draft: {}, open: true };
  const ref = { current: null };
  const setter = key => value => { state[key] = typeof value === "function" ? value(state[key]) : value; };
  const make = () => createProfileTelegramHandlers({ auth, db: {}, TELEGRAM_BOT_USERNAME: "example_bot", TELEGRAM_PROFILE_STORAGE_KEY: "telegram", telegramDraft: {},
    telegramAvatarRefreshRef: { current: null }, telegramBotLinkRequestRef: ref,
    setTelegramLinkCode: setter("code"), setTelegramLinking: setter("linking"), setTelegramStatus: setter("status"),
    setTelegramProfile: setter("profile"), setTelegramDraft: setter("draft"), setTelegramConnectOpen: setter("open") });
  return { auth, state, ref, make, handlers: make(), switchSession() {
    auth.currentUser = { uid: "B" }; advanceAuthSession(auth);
    Object.assign(state, { code: "B-code", linking: false, status: "B-status", profile: {}, draft: {}, open: true });
  } };
}

test("issuance clears the old code, uses the bounded endpoint once and returns data without opening a window", async () => {
  const pending = deferred(); const calls = [];
  request = (...args) => { calls.push(args); return pending.promise; };
  const f = fixture();
  const first = f.handlers.startTelegramBotLink();
  assert.equal(f.state.code, ""); assert.equal(f.state.linking, true);
  assert.equal(await f.handlers.startTelegramBotLink(), false);
  assert.equal(await f.make().startTelegramBotLink(), false, "a rerender uses the same in-flight ref");
  assert.equal(await f.handlers.checkTelegramLoginResult(), false);
  assert.equal(f.state.linking, true, "a busy check cannot clear an issuance operation");
  pending.resolve(response());
  assert.deepEqual(await first, { code, botStartUrl, expiresAt });
  assert.equal(calls.length, 1); assert.equal(calls[0][0], "/api/telegram/create-link-code");
  assert.equal(calls[0][1].method, "POST"); assert.deepEqual(JSON.parse(calls[0][1].body), {});
  assert.equal(calls[0][2], 16000); assert.equal(f.state.code, code); assert.equal(f.state.linking, false);
  assert.equal(f.state.status, "Ссылка готова. Открой бота и нажми Start.");
});

test("timeout clears busy state and permits an explicit retry without reviving the old code", async () => {
  let calls = 0;
  request = async () => { if (++calls === 1) throw Object.assign(new Error("Synthetic timeout"), { name: "AbortError" }); return response(); };
  const f = fixture();
  assert.equal(await f.handlers.startTelegramBotLink(), false);
  assert.equal(f.state.code, ""); assert.equal(f.state.linking, false); assert.equal(f.ref.current, null);
  assert.deepEqual(await f.handlers.startTelegramBotLink(), { code, botStartUrl, expiresAt });
  assert.equal(calls, 2);
});

test("a stalled response body cannot keep the link loader running beyond the deadline", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const body = deferred();
  request = async () => ({ ok: true, json: () => body.promise });
  const f = fixture();
  const pending = f.handlers.startTelegramBotLink();
  await Promise.resolve();
  t.mock.timers.tick(16000);
  assert.equal(await pending, false);
  assert.equal(f.state.linking, false); assert.equal(f.ref.current, null); assert.equal(f.state.code, "");
  body.resolve({ ok: true, code, botStartUrl, expiresAt });
  await Promise.resolve();
  assert.equal(f.state.code, "", "late body completion cannot resurrect the timed-out link");
});

for (const patch of [{ code: "short" }, { botStartUrl: "https://evil.example/" }, { botStartUrl: `https://t.me/another_bot?start=${code}` }, { botStartUrl: botStartUrl + "&redirect=evil" }, { expiresAt: "2020-01-01" }]) {
  test(`issuance rejects an invalid or untrusted result (${Object.keys(patch)[0]}:${Object.values(patch)[0]})`, async () => {
    request = async () => response(patch);
    const f = fixture();
    assert.equal(await f.handlers.startTelegramBotLink(), false);
    assert.equal(f.state.code, ""); assert.equal(f.state.linking, false);
  });
}

test("an old issuance response cannot publish into another session or clear its new operation", async () => {
  const old = deferred(); const fresh = deferred(); let calls = 0;
  request = () => ++calls === 1 ? old.promise : fresh.promise;
  const f = fixture();
  const first = f.handlers.startTelegramBotLink(); f.switchSession();
  const second = f.make().startTelegramBotLink(); const current = f.ref.current;
  old.resolve(response()); assert.equal(await first, false);
  assert.equal(f.ref.current, current); assert.equal(f.state.code, ""); assert.equal(f.state.linking, true);
  fresh.resolve(response()); assert.deepEqual(await second, { code, botStartUrl, expiresAt });
  assert.equal(f.state.linking, false); assert.deepEqual(caches, []);
});

test("check result returns connected/unconnected/read-error and always releases only its own busy state", async () => {
  const f = fixture();
  assert.equal(await f.handlers.checkTelegramLoginResult(), true);
  assert.equal(f.state.linking, false); assert.match(f.state.status, /подключён в профиле/);
  read = async () => snapshot(false);
  assert.equal(await f.handlers.checkTelegramLoginResult(), false);
  assert.equal(f.state.linking, false);
  read = async () => { throw new Error("Synthetic offline"); };
  assert.equal(await f.handlers.checkTelegramLoginResult(), false);
  assert.equal(f.state.linking, false); assert.equal(f.ref.current, null);
});

test("a stale check result returns false without altering the next session", async () => {
  const pending = deferred(); read = () => pending.promise;
  const f = fixture(); const checking = f.handlers.checkTelegramLoginResult();
  f.switchSession(); const expected = structuredClone(f.state);
  pending.resolve(snapshot(true)); assert.equal(await checking, false);
  assert.deepEqual(f.state, expected); assert.deepEqual(caches, []);
});

test("manual check timeout releases its lock for retry and a late read cannot publish profile or status", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const old = deferred(); let reads = 0;
  read = () => ++reads === 1 ? old.promise : Promise.resolve(snapshot(false));
  const f = fixture();
  const checking = f.handlers.checkTelegramLoginResult();
  assert.equal(f.state.linking, true);
  t.mock.timers.tick(16000);
  assert.equal(await checking, false);
  assert.equal(f.state.linking, false); assert.equal(f.ref.current, null);
  assert.match(f.state.status, /Не получилось проверить/);
  assert.equal(await f.handlers.checkTelegramLoginResult(), false);
  assert.equal(reads, 2); assert.equal(f.state.linking, false);
  const afterRetry = structuredClone(f.state);
  old.resolve(snapshot(true));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(f.state, afterRetry);
  assert.deepEqual(caches, []);
});

test("disconnect owns the shared busy lock across rerenders and cannot race issuance or manual checks", async () => {
  const pending = deferred(), calls = [];
  request = (...args) => { calls.push(args); return pending.promise; };
  const f = fixture();
  f.state.profile = { connected: true, username: "original" };
  const removal = f.handlers.disconnectTelegram();
  assert.equal(f.state.linking, true);
  assert.match(f.state.status, /Отключаю/);
  assert.equal(await f.handlers.disconnectTelegram(), false);
  assert.equal(await f.make().disconnectTelegram(), false);
  assert.equal(await f.make().startTelegramBotLink(), false);
  assert.equal(await f.make().checkTelegramLoginResult(), false);
  pending.resolve({ ok: true, json: async () => ({ ok: true, telegram: { connected: false, notificationsEnabled: false } }) });
  assert.equal(await removal, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/api/telegram/disconnect");
  assert.equal(calls[0][2], 16000);
  assert.deepEqual(JSON.parse(calls[0][1].body), {});
  assert.equal(f.state.profile.connected, false);
  assert.equal(f.state.code, "");
  assert.equal(f.state.linking, false);
  assert.equal(f.ref.current, null);
});

test("failed disconnect keeps the actual connected profile and permits a deliberate retry", async () => {
  const f = fixture();
  f.state.profile = { connected: true, username: "original" };
  request = async () => ({ ok: false, json: async () => ({ ok: false }) });
  assert.equal(await f.handlers.disconnectTelegram(), false);
  assert.deepEqual(f.state.profile, { connected: true, username: "original" });
  assert.deepEqual(caches, []);
  assert.equal(f.state.linking, false);
  assert.equal(f.ref.current, null);
  request = async () => ({ ok: true, json: async () => ({ ok: true, telegram: { connected: false } }) });
  assert.equal(await f.make().disconnectTelegram(), true);
});

test("disconnect deadline includes a stalled response body and late completion cannot change the profile", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const body = deferred(), f = fixture();
  f.state.profile = { connected: true, username: "original" };
  request = async () => ({ ok: true, json: () => body.promise });
  const pending = f.handlers.disconnectTelegram();
  await Promise.resolve();
  t.mock.timers.tick(16000);
  assert.equal(await pending, false);
  assert.equal(f.state.linking, false);
  assert.equal(f.ref.current, null);
  const expected = structuredClone(f.state);
  body.resolve({ ok: true, telegram: { connected: false } });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(f.state, expected);
  assert.deepEqual(caches, []);
});

test("old disconnect cannot overwrite or release a later session's operation", async () => {
  const old = deferred(), fresh = deferred(); let calls = 0;
  request = () => ++calls === 1 ? old.promise : fresh.promise;
  const f = fixture();
  const first = f.handlers.disconnectTelegram();
  f.switchSession();
  const second = f.make().startTelegramBotLink(), current = f.ref.current;
  old.resolve({ ok: true, json: async () => ({ ok: true, telegram: { connected: false } }) });
  assert.equal(await first, false);
  assert.equal(f.ref.current, current);
  assert.equal(f.state.linking, true);
  fresh.resolve(response());
  assert.deepEqual(await second, { code, botStartUrl, expiresAt });
  assert.deepEqual(caches, []);
});
