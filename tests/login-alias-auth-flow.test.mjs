import assert from "node:assert/strict";
import { test, after } from "node:test";
import { authenticateLoginAlias } from "../functions/loginAliasAuth.js";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const user = { uid: "owner", email: "private@example.test" }, auth = { currentUser: user };
const sdk = { custom: [], email: [], reset: [] };
const apiResults = [], providerCalls = [];
let known = true, correct = true;
const serverDb = { collection: name => ({ doc: () => ({ get: async () => ({ exists: name === "loginAliases" ? known : true, data: () => name === "loginAliases" ? { uid: user.uid, email: user.email } : { active: true, role: "client", accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer" } }) }) }) };
const serverAuth = { getUser: async () => user, createCustomToken: async () => "verified-custom-token" };
const cleanup = installRuntimeImports({
  "firebase/auth": {
    GoogleAuthProvider: class {}, createUserWithEmailAndPassword: async () => ({ user }), signInWithPopup: async () => ({ user }), signOut: async () => {},
    signInWithCustomToken: async (_, token) => { sdk.custom.push(token); return { user }; },
    signInWithEmailAndPassword: async (_, email, password) => { sdk.email.push({ email, password }); return { user }; },
    sendPasswordResetEmail: async (_, email) => sdk.reset.push(email)
  },
  "firebase/firestore": {
    doc: (_, ...parts) => parts.join("/"), getDoc: async () => ({ exists: () => true, data: () => ({ active: true, role: "client", accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer" }) }), setDoc: async () => {}
  },
  "/apiClient.js": { getAppCheckApiHeaders: async headers => headers, fetchAuthorizedWithTimeout: async () => ({ ok: true }), fetchWithAppCheck: async () => ({ ok: true }) }
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(url, "/api/auth/resolve-login");
  const result = await authenticateLoginAlias({ body: JSON.parse(options.body), db: serverDb, auth: serverAuth, apiKey: "web-key", fetchImpl: async (provider, init) => {
    providerCalls.push({ provider, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(correct ? { localId: user.uid, idToken: "verified-provider-id-token", email: user.email, refreshToken: "private-refresh" } : { error: { message: "INVALID_LOGIN_CREDENTIALS" } }), { status: correct ? 200 : 400 });
  } });
  apiResults.push(result); return new Response(JSON.stringify(result.body), { status: result.status });
};
after(() => { cleanup(); globalThis.fetch = originalFetch; });
const { createAuthHandlers } = await import("../src/features/auth/authHandlers.js");
function handlers(login = "alias") {
  const errors = [], notices = [], pages = [];
  const instance = createAuthHandlers({ APP_PAGES: { MAIN: "main" }, auth, db: {}, login, password: "private-password", loginSubmitting: false, passwordResetSending: false,
    setLoginFieldErrors() {}, setLoginError: value => { if (value) errors.push(value); }, setLoginNotice: value => { if (value) notices.push(value); }, setLoginSubmitting() {}, setPasswordResetSending() {},
    setPage: page => pages.push(page), setSelectedUserId() {}, loadHistory: () => assert.fail("pending membership must not load member data"), loadWorkoutsFromFirebase: () => assert.fail("pending membership must not load member data")
  });
  return { ...instance, errors, notices, pages };
}

test("alias frontend authenticates via custom token only; wrong/unknown remain indistinguishable without email disclosure", async () => {
  known = correct = true; const good = handlers(); await good.handleLogin({ preventDefault() {} });
  assert.deepEqual(sdk.custom, ["verified-custom-token"]); assert.deepEqual(sdk.email, []); assert.deepEqual(good.pages, ["main"]);
  const knownWrong = handlers(); correct = false; await knownWrong.handleLogin({ preventDefault() {} });
  const unknown = handlers(); known = false; await unknown.handleLogin({ preventDefault() {} });
  assert.deepEqual(knownWrong.errors, unknown.errors); assert.equal(sdk.custom.length, 1); assert.equal(sdk.email.length, 0);
  for (const result of apiResults) {
    const text = JSON.stringify(result); assert.equal(text.includes(user.email), false); assert.equal(text.includes("refreshToken"), false); assert.equal(text.includes("private-password"), false);
  }
});

test("alias password reset stays neutral and never asks email SDK to send to a resolved private address", async () => {
  const knownFlow = handlers(); known = true; correct = true; await knownFlow.handleLoginPasswordReset();
  const unknownFlow = handlers(); known = false; await unknownFlow.handleLoginPasswordReset();
  assert.deepEqual(knownFlow.notices, unknownFlow.notices); assert.deepEqual(knownFlow.errors, []); assert.deepEqual(unknownFlow.errors, []);
  assert.deepEqual(sdk.reset, []);
  for (const call of providerCalls.slice(-2)) assert.equal(call.body.requestType, "PASSWORD_RESET");
});

test("ordinary email signin and reset preserve their direct Firebase SDK paths", async () => {
  const count = apiResults.length, emailFlow = handlers("PRIVATE@Example.test");
  await emailFlow.handleLogin({ preventDefault() {} }); await emailFlow.handleLoginPasswordReset();
  assert.equal(apiResults.length, count); assert.deepEqual(sdk.email.at(-1), { email: user.email, password: "private-password" });
  assert.equal(sdk.reset.at(-1), user.email);
});
