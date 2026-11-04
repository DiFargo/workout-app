import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let listener;
let dispose;
let currentFixture;
const oldWindow = globalThis.window;
const oldStorage = globalThis.localStorage;
const cleanup = installRuntimeImports({
  react: { useEffect: effect => { dispose = effect(); } },
  "/firebase.js": { auth: {}, db: {} },
  "/apiClient.js": {
    getAppCheckApiHeaders: async headers => headers,
    fetchAuthorizedWithTimeout: async () => ({ ok: true }),
    fetchWithAppCheck: async () => currentFixture.telegramResponse || ({ ok: true, json: async () => ({ ok: true, customToken: "token" }) })
  },
  "firebase/auth": {
    GoogleAuthProvider: class {}, getIdTokenResult: async () => ({ claims: {} }),
    onAuthStateChanged: (_auth, callback) => { listener = callback; return () => {}; },
    createUserWithEmailAndPassword: auth => signIn(auth),
    signInWithEmailAndPassword: auth => signIn(auth),
    signInWithPopup: auth => signIn(auth), signInWithCustomToken: auth => signIn(auth),
    signOut: async auth => { auth.currentUser = null; await listener(null); }, sendPasswordResetEmail: async () => {}
  },
  "firebase/firestore": {
    doc: (_, ...parts) => parts.join("/"),
    getDoc: async path => {
      currentFixture.reads.push(path);
      if (path === "users/new" && currentFixture.profileRead) {
        currentFixture.profileReadStarted.resolve();
        await currentFixture.profileRead.promise;
        if (currentFixture.profileReadError) throw new Error("Synthetic old-profile read failure");
      }
      if (path.startsWith("clientInvites/")) {
        currentFixture.inviteStarted.resolve();
        await currentFixture.inviteRead.promise;
      }
      const data = currentFixture.docs.get(path);
      return { exists: () => Boolean(data), data: () => data };
    },
    setDoc: async (path, data) => {
      if (currentFixture.failWrite) throw new Error("unavailable");
      currentFixture.docs.set(path, data);
    }
  }
});
after(() => {
  dispose?.();
  cleanup();
  if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage;
});
const { createAuthHandlers } = await import("../src/features/auth/authHandlers.js");
const { useAuthBootstrapEffect } = await import("../src/app/useAuthBootstrapEffect.js");
const { beginAuthProfilePreparation, waitForAuthProfilePreparation } = await import("../src/features/auth/authProfilePreparation.js");

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

async function signIn(auth) {
  auth.currentUser = currentFixture.user;
  // This is Firebase's actual ordering: observers run before the caller has
  // prepared the new Firestore profile. Do not await the observer here.
  currentFixture.bootstrap = listener(currentFixture.user);
  return { user: currentFixture.user };
}

beforeEach(() => {
  dispose?.();
  globalThis.window = { setTimeout: () => 1, clearTimeout() {}, location: { search: "" }, Telegram: { WebApp: { initData: "signed-data" } } };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const state = {};
  const noop = () => {};
  const auth = { currentUser: null };
  const options = {
    auth, db: {}, user: null, login: "new@example.invalid", password: "strong-password", loginSubmitting: false, passwordResetSending: false,
    APP_PAGES: { MAIN: "main", ADMIN: "trainer", ADMIN_PANEL: "admin" },
    defaultNutritionState: { goals: {}, days: {}, favorites: [] },
    createEmptyAiNutritionProfileDraft: () => ({}), createEmptyTelegramProfile: () => ({}),
    getDefaultWorkoutModePreference: () => ({ mode: "individual", remember: false }),
    hasRequiredAiNutritionProfileFields: () => false,
    safeReadUserJsonStorage: (_key, _uid, fallback) => fallback,
    safeWriteUserJsonStorage: () => true, loadRecentNutritionFoods: () => [],
    normalizeAppPage: value => value, normalizeClientPrimaryPage: value => value,
    setCurrentUserRole: value => { state.role = value; },
    setLoginError: value => { state.error = value; },
    setLoginNotice: value => { state.notice = value; },
    setLoginSubmitting: value => { state.loginSubmitting = value; },
    loadHistory: () => { state.memberLoads = (state.memberLoads || 0) + 1; },
    loadWorkoutsFromFirebase: async () => { state.memberLoads = (state.memberLoads || 0) + 1; }
  };
  const context = new Proxy(options, { get: (obj, key) => key in obj ? obj[key] : /^[A-Z_]+$/.test(String(key)) ? String(key) : noop });
  currentFixture = { auth, user: { uid: "new", email: "new@example.invalid" }, docs: new Map(), reads: [], state, context, inviteStarted: deferred(), inviteRead: deferred() };
  useAuthBootstrapEffect(() => context);
});

for (const method of ["handleEmailSignup", "handleGoogleAuth", "handleLogin"]) test(`${method} waits for profile creation before verifying the pending role`, async () => {
  const f = currentFixture;
  const handlers = createAuthHandlers(f.context);
  const signup = handlers[method]({ preventDefault() {} }, f.user.email, "strong-password");
  await f.inviteStarted.promise;
  assert.equal(f.state.role, "resolving");
  assert.equal(f.reads.filter(path => path === "users/new").length, 1, "only finishAuth has read the absent profile");
  assert.equal(f.state.memberLoads || 0, 0);
  f.inviteRead.resolve();
  await signup;
  await f.bootstrap;
  assert.equal(f.docs.get("users/new").accountAccessStatus, "awaiting_trainer");
  assert.equal(f.state.role, "pending-client");
  assert.equal(f.state.memberLoads || 0, 0);
  assert.equal(f.state.error, "");
});

test("failed profile creation releases bootstrap and keeps role verification fail-closed", async () => {
  const f = currentFixture;
  f.failWrite = true;
  f.inviteRead.resolve();
  await createAuthHandlers(f.context).handleEmailSignup({ preventDefault() {} }, f.user.email, "strong-password");
  await f.bootstrap;
  await waitForAuthProfilePreparation(f.auth);
  assert.equal(f.docs.size, 0);
  assert.equal(f.state.role, "unresolved");
  assert.equal(f.state.memberLoads || 0, 0);
});

test("signout cancels a waiting preparation and invalidates the old bootstrap run", async () => {
  const f = currentFixture;
  beginAuthProfilePreparation(f.auth);
  f.auth.currentUser = f.user;
  const stale = listener(f.user);
  f.auth.currentUser = null;
  await listener(null);
  await stale;
  await waitForAuthProfilePreparation(f.auth);
  assert.equal(f.state.role, "client"); // signed-out role; no signed-in client data
  assert.deepEqual(f.reads, []);
});

test("canonical Telegram relink errors explain existing-account and bot recovery", async () => {
  const f = currentFixture;
  f.telegramResponse = { ok: false, json: async () => ({ ok: false, error: "auth/telegram-relink-required" }) };
  await createAuthHandlers(f.context).handleTelegramMiniAppAuth();
  await waitForAuthProfilePreparation(f.auth);
  assert.match(f.state.error, /Войди по логину или email и паролю/);
  assert.match(f.state.error, /Кабинет → Telegram/);
  assert.match(f.state.error, /заново через бота/);
  assert.equal(f.docs.size, 0);
});

test("an invalid Telegram signature offers a fresh launch without weakening identity checks", async () => {
  const f = currentFixture;
  f.telegramResponse = { ok: false, json: async () => ({ ok: false, error: "telegram-signature-invalid" }) };
  await createAuthHandlers(f.context).handleTelegramMiniAppAuth();
  assert.match(f.state.error, /Полностью закрой приложение/);
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.docs.size, 0);
});

test("a stalled Telegram response body releases login and cannot sign in later", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = currentFixture;
  const body = deferred();
  f.telegramResponse = { ok: true, json: () => body.promise };
  const login = createAuthHandlers(f.context).handleTelegramMiniAppAuth();
  await Promise.resolve();
  t.mock.timers.tick(16000);
  await login;
  await waitForAuthProfilePreparation(f.auth);
  assert.match(f.state.error, /не ответил вовремя/);
  assert.equal(f.state.loginSubmitting, false);
  body.resolve({ ok: true, customToken: "late-token" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.docs.size, 0);
});

for (const signedOutAgain of [false, true]) test(`a pending Telegram login cannot replace ${signedOutAgain ? "a newer signed-out session" : "another signed-in account"}`, async () => {
  const f = currentFixture;
  const body = deferred();
  f.telegramResponse = { ok: true, json: () => body.promise };
  const login = createAuthHandlers(f.context).handleTelegramMiniAppAuth();
  await Promise.resolve();
  const otherUser = { uid: "other", email: "other@example.invalid" };
  f.auth.currentUser = otherUser;
  advanceAuthSession(f.auth);
  if (signedOutAgain) {
    f.auth.currentUser = null;
    advanceAuthSession(f.auth);
  }
  f.state.error = "current-session-status";
  f.state.loginSubmitting = false;
  body.resolve({ ok: true, customToken: "stale-token" });
  await login;
  assert.equal(f.auth.currentUser, signedOutAgain ? null : otherUser);
  assert.equal(f.docs.size, 0);
  assert.equal(f.state.error, "current-session-status");
  assert.equal(f.state.loginSubmitting, false);
});

test("a current Telegram sign-in keeps its own session through bootstrap and profile preparation", async () => {
  const f = currentFixture;
  f.docs.set("users/new", { role: "client", active: true, accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer" });
  await createAuthHandlers(f.context).handleTelegramMiniAppAuth();
  await f.bootstrap;
  assert.equal(f.auth.currentUser, f.user);
  assert.equal(f.state.role, "pending-client");
  assert.equal(f.state.error, "");
  assert.equal(f.state.loginSubmitting, false);
  assert.match(f.state.notice, /приглашение пока не найдено/);
});

for (const [code, message] of [["telegram-invite-invalid", /уже удалено/], ["telegram-invite-changed", /ещё раз/]]) {
  test(`Telegram invitation ${code} gives a safe retry without changing the signed-in account`, async () => {
    const f = currentFixture;
    const pending = { uid: "existing-pending" };
    f.auth.currentUser = pending;
    f.telegramResponse = { ok: false, json: async () => ({ ok: false, error: code }) };
    await createAuthHandlers(f.context).handleTelegramMiniAppAuth();
    assert.equal(f.auth.currentUser, pending);
    assert.match(f.state.error, message);
    assert.equal(f.docs.size, 0);
  });
}

for (const readError of [false, true]) test(`an old post-sign-in profile ${readError ? "failure" : "disabled record"} cannot change the next account`, async () => {
  const f = currentFixture;
  f.docs.set("users/new", { role: "client", active: false });
  f.profileRead = deferred();
  f.profileReadStarted = deferred();
  f.profileReadError = readError;
  const login = createAuthHandlers(f.context).handleTelegramMiniAppAuth();
  await f.profileReadStarted.promise;
  const otherUser = { uid: "other", email: "other@example.invalid" };
  f.auth.currentUser = otherUser;
  advanceAuthSession(f.auth);
  f.state.error = "next-account-status";
  f.state.loginSubmitting = true;
  f.profileRead.resolve();
  await login;
  await f.bootstrap;
  assert.equal(f.auth.currentUser, otherUser);
  assert.equal(f.state.error, "next-account-status");
  assert.equal(f.state.loginSubmitting, true);
});
