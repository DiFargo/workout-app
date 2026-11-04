import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let headersIo, fetchIo, credentialIo, popupIo, resetEmails;
const originalFetch = globalThis.fetch;
const cleanup = installRuntimeImports({
  "firebase/auth": {
    GoogleAuthProvider: class {},
    EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
    getIdTokenResult: user => user.tokenResult(),
    reauthenticateWithCredential: (...args) => credentialIo(...args),
    reauthenticateWithPopup: (...args) => popupIo(...args),
    sendPasswordResetEmail: async (_, email) => { resetEmails.push(email); },
    updatePassword: async () => {}, updateProfile: async () => {}
  },
  "firebase/firestore": { doc: () => "unused", setDoc: async () => {} },
  "/apiClient.js": {
    fetchAuthorizedWithTimeout: () => { throw new Error("Global-currentUser authorization must not be used for email change"); },
    getAppCheckApiHeaders: headers => headersIo(headers)
  },
  "/firebaseStorage.js": { uploadStorageFile: async () => ({ url: "unused" }) }
});
after(() => { cleanup(); globalThis.fetch = originalFetch; });
const { createProfileAccountHandlers } = await import("../src/features/client/profile/profileAccountHandlers.js");
const fresh = (provider = "custom") => ({ signInProvider: provider, claims: { sub: "A", auth_time: Math.floor(Date.now() / 1000) } });
const response = (data = { ok: true, email: "personal@example.test" }, ok = true) => ({ ok, status: ok ? 200 : 409, json: async () => data });
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => {
  headersIo = async headers => ({ ...headers, "X-Firebase-AppCheck": "synthetic-app-check" });
  fetchIo = async () => response();
  credentialIo = async user => ({ user }); popupIo = async user => ({ user }); resetEmails = [];
  globalThis.fetch = (...args) => fetchIo(...args);
});
function fixture({ provider = "custom", passwordProvider = false, deferState = false } = {}) {
  const user = { uid: "A", email: "technical@telegram.tren-85720.app", providerData: passwordProvider ? [{ providerId: "password" }] : [],
    tokenResult: async () => fresh(provider), getIdToken: async () => "token-A", reload: async () => {} };
  const auth = { currentUser: user }; advanceAuthSession(auth);
  const state = { account: { email: user.email }, draft: { email: user.email }, status: "", saving: false };
  const pending = [];
  const setter = key => value => { const apply = () => { state[key] = typeof value === "function" ? value(state[key]) : value; }; if (deferState) pending.push(apply); else apply(); };
  const handlers = createProfileAccountHandlers({ auth, db: {}, profileAccount: state.account, profileAccountDraft: state.draft, profileAccountSaving: false,
    setProfileAccount: setter("account"), setProfileAccountDraft: setter("draft"), setProfileAccountStatus: setter("status"), setProfileAccountSaving: setter("saving") });
  return { auth, user, state, handlers, flush: () => pending.splice(0).forEach(apply => apply()), switchUser() { auth.currentUser = { uid: "B" }; advanceAuthSession(auth); } };
}

for (const passwordProvider of [false, true]) test(`fresh custom session adds email without a known password (password provider=${passwordProvider})`, async () => {
  const f = fixture({ passwordProvider });
  credentialIo = popupIo = async () => { throw new Error("Must not reauthenticate a fresh custom login with password/Google"); };
  const requests = []; fetchIo = async (...args) => { requests.push(args); return response(); };
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].headers.Authorization, "Bearer token-A");
  assert.equal(requests[0][1].headers["X-Firebase-AppCheck"], "synthetic-app-check");
  assert.deepEqual(JSON.parse(requests[0][1].body), { email: "personal@example.test" });
  assert.equal(f.state.account.email, "personal@example.test");
  assert.equal(f.user.email, "technical@telegram.tren-85720.app");
  assert.match(f.state.status, /требуется повторный вход/);
  assert.doesNotMatch(f.state.status, /оста[её]тесь в аккаунте/);
  await f.handlers.sendProfilePasswordReset();
  assert.deepEqual(resetEmails, ["personal@example.test"]);
  assert.match(f.state.status, /Заверши действие по ссылке/);
});

test("committed email change stays successful when the old session token is now revoked", async () => {
  const f = fixture(); let committed = false, postWriteTokenCalls = 0;
  f.user.getIdToken = async () => {
    if (committed) { postWriteTokenCalls++; throw Object.assign(new Error("revoked"), { code: "auth/id-token-revoked" }); }
    return "token-A";
  };
  f.user.reload = async () => { throw new Error("Must not reload the revoked post-write session"); };
  fetchIo = async () => { committed = true; return response(); };
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), true);
  assert.equal(f.state.account.email, "personal@example.test");
  assert.equal(postWriteTokenCalls, 0); assert.match(f.state.status, /требуется повторный вход/);
});

test("stale custom session asks for fresh Telegram login without POST", async () => {
  const f = fixture(); f.user.tokenResult = async () => ({ ...fresh(), claims: { sub: "A", auth_time: Math.floor(Date.now() / 1000) - 301 } });
  fetchIo = async () => { throw new Error("Must not POST stale session"); };
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), false);
  assert.match(f.state.status, /недавний вход через Telegram/);
});

test("forged profile Telegram hints and a technical address cannot replace actual SDK login provider", async () => {
  const f = fixture({ provider: "anonymous" }); f.state.account.telegramUserId = "forged"; f.state.account.emailIsInternal = true;
  let posts = 0; fetchIo = async () => { posts++; return response(); };
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), false);
  assert.equal(posts, 0); assert.match(f.state.status, /пока нельзя сменить почту/);
});

for (const provider of ["password", "google.com"]) test(`${provider} retains its existing credential confirmation`, async () => {
  const f = fixture({ provider, passwordProvider: provider === "password" });
  if (provider === "google.com") f.user.providerData = [{ providerId: provider }];
  let confirmations = 0; credentialIo = popupIo = async user => { confirmations++; return { user }; };
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test", { currentPassword: "known" }), true);
  assert.equal(confirmations, 1);
});

for (const stage of ["token-result", "id-token", "app-check", "response", "body", "password-reload"]) test(`account switch during ${stage} never authorizes B or publishes stale A state`, async () => {
  const f = fixture({ provider: stage === "password-reload" ? "password" : "custom", passwordProvider: stage === "password-reload" });
  const gate = deferred(); let entered; const ready = new Promise(resolve => { entered = resolve; });
  const wait = value => { entered(); return gate.promise.then(() => value); };
  let posts = 0;
  if (stage === "token-result") f.user.tokenResult = () => wait(fresh());
  if (stage === "id-token") f.user.getIdToken = () => wait("token-A");
  if (stage === "app-check") headersIo = headers => wait(headers);
  if (stage === "password-reload") f.user.reload = () => wait();
  fetchIo = async () => { posts++; if (stage === "response") return wait(response()); return stage === "body" ? { ok: true, json: () => wait({ ok: true, email: "personal@example.test" }) } : response(); };
  const saving = f.handlers.requestProfileEmailChange("personal@example.test", { currentPassword: "known" });
  await ready; f.switchUser(); f.state.status = "B status"; f.state.saving = "B saving"; gate.resolve();
  assert.equal(await saving, false);
  assert.equal(posts, ["response", "body"].includes(stage) ? 1 : 0);
  assert.equal(f.state.account.email, "technical@telegram.tren-85720.app");
  assert.equal(f.state.status, "B status"); assert.equal(f.state.saving, "B saving");
});

test("queued state updates also reject a later same-UID auth session", async () => {
  const f = fixture({ deferState: true });
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), true);
  advanceAuthSession(f.auth); f.flush();
  assert.equal(f.state.account.email, "technical@telegram.tren-85720.app");
});

for (const transition of ["another UID", "new session for the same UID"]) test(`old factory email/reset callbacks invoked after ${transition} do nothing`, async () => {
  const f = fixture();
  if (transition === "another UID") f.switchUser();
  else advanceAuthSession(f.auth);
  f.state.status = "Current session status"; f.state.saving = "Current session saving";
  let posts = 0; fetchIo = async () => { posts++; return response(); };
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), false);
  assert.equal(await f.handlers.sendProfilePasswordReset(), false);
  assert.equal(posts, 0); assert.deepEqual(resetEmails, []);
  assert.equal(f.state.status, "Current session status");
  assert.equal(f.state.saving, "Current session saving");
  assert.equal(f.state.account.email, "technical@telegram.tren-85720.app");
});

test("server email conflict preserves identity and returns useful feedback", async () => {
  const f = fixture(); fetchIo = async () => response({ ok: false, error: "email-already-in-use" }, false);
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), false);
  assert.equal(f.state.account.email, f.user.email); assert.match(f.state.status, /уже используется/);
});

test("server recent-auth rejection of a custom login also gives Telegram re-entry guidance", async () => {
  const f = fixture(); fetchIo = async () => response({ ok: false, error: "auth/requires-recent-login" }, false);
  assert.equal(await f.handlers.requestProfileEmailChange("personal@example.test"), false);
  assert.match(f.state.status, /недавний вход через Telegram/);
});

test("a stalled SDK token read has a bounded deadline and cannot submit after it expires", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(); const gate = deferred(); f.user.tokenResult = () => gate.promise;
  let posts = 0; fetchIo = async () => { posts++; return response(); };
  const saving = f.handlers.requestProfileEmailChange("personal@example.test");
  t.mock.timers.tick(16000);
  assert.equal(await saving, false); assert.equal(f.state.saving, false);
  gate.resolve(fresh()); await Promise.resolve(); await Promise.resolve();
  assert.equal(posts, 0);
});

test("reset never targets an internal technical mailbox", async () => {
  const f = fixture(); assert.equal(await f.handlers.sendProfilePasswordReset(), false); assert.deepEqual(resetEmails, []);
});
