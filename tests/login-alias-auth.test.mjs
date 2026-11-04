import assert from "node:assert/strict";
import { test } from "node:test";
import { authenticateLoginAlias } from "../functions/loginAliasAuth.js";

const secret = "sensitive-password-do-not-log", email = "private-user@example.test";
const invalid = { status: 401, body: { ok: false, error: "auth/invalid-credential" } };
function fixture({ known = true, profile = { accountAccessStatus: "awaiting_trainer", role: "client", active: true }, disabled = false, localId = "owner", providerOk = true } = {}) {
  const calls = [], issued = [];
  const db = { collection: collection => ({ doc: id => ({ get: async () => ({ exists: collection === "loginAliases" ? known : true, data: () => collection === "loginAliases" ? { uid: "owner", email } : profile }) }) }) };
  const auth = { getUser: async uid => ({ uid, email, disabled }), createCustomToken: async uid => { issued.push(uid); return "custom-only-token"; } };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(providerOk ? { localId, email, idToken: "DO-NOT-RETURN", refreshToken: "DO-NOT-RETURN" } : { error: { message: `PRIVATE ${email} ${secret}` } }), { status: providerOk ? 200 : 400 });
  };
  const args = { db, auth, fetchImpl, apiKey: "public-web-key", body: { login: "alias", password: secret } };
  return { calls, issued, args };
}

test("valid alias verifies password at fixed HTTPS provider and returns only custom token, including pending profile", async () => {
  const h = fixture(); const result = await authenticateLoginAlias(h.args);
  assert.deepEqual(result, { status: 200, body: { ok: true, customToken: "custom-only-token" } });
  assert.deepEqual(h.issued, ["owner"]);
  const url = new URL(h.calls[0].url);
  assert.equal(url.origin, "https://identitytoolkit.googleapis.com"); assert.equal(url.pathname, "/v1/accounts:signInWithPassword");
  assert.equal(url.searchParams.get("key"), "public-web-key"); assert.equal(h.calls[0].options.redirect, "error");
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { email, password: secret, returnSecureToken: true });
  assert.equal(JSON.stringify(result).includes(email), false); assert.equal(JSON.stringify(result).includes("refreshToken"), false);
});

test("missing password, unknown alias and wrong known password cannot disclose email or log credentials", async () => {
  const logs = [], oldError = console.error, oldWarn = console.warn, oldLog = console.log;
  console.error = console.warn = console.log = (...args) => logs.push(args);
  try {
    for (const options of [{ known: false }, { providerOk: false }]) {
      const h = fixture(options); assert.deepEqual(await authenticateLoginAlias(h.args), invalid); assert.deepEqual(h.issued, []);
    }
    const h = fixture(); delete h.args.body.password;
    assert.deepEqual(await authenticateLoginAlias(h.args), invalid); assert.equal(h.calls.length, 0);
    assert.deepEqual(logs, []);
  } finally { console.error = oldError; console.warn = oldWarn; console.log = oldLog; }
});

test("provider UID mismatch, disabled Auth/profile and stale alias email never mint a custom token", async () => {
  for (const options of [
    { localId: "other" }, { disabled: true }, { profile: { active: false } }, { profile: { accessDisabled: true } },
    { profile: { archived: true } }, { profile: { membershipStatus: "revoked" } }, { profile: { accountAccessStatus: "blocked" } }
  ]) {
    const h = fixture(options); assert.deepEqual(await authenticateLoginAlias(h.args), invalid); assert.deepEqual(h.issued, []);
  }
  const h = fixture(); h.args.auth.getUser = async () => ({ uid: "owner", email: "changed@example.test" });
  assert.deepEqual(await authenticateLoginAlias(h.args), invalid); assert.deepEqual(h.issued, []);
});

test("password-reset responses are identical for known, unknown and provider-failed aliases", async () => {
  for (const options of [{}, { known: false }, { providerOk: false }]) {
    const h = fixture(options); h.args.body = { login: "alias", action: "reset-password" };
    assert.deepEqual(await authenticateLoginAlias(h.args), { status: 200, body: { ok: true } });
    assert.equal(new URL(h.calls[0].url).pathname, "/v1/accounts:sendOobCode");
    const payload = JSON.parse(h.calls[0].options.body);
    assert.equal(payload.requestType, "PASSWORD_RESET"); assert.equal(payload.password, undefined);
    assert.equal(payload.email, options.known === false ? "unregistered-login@invalid.invalid" : email);
    assert.deepEqual(h.issued, []);
  }
});

test("partial/MFA-pending provider result cannot be exchanged for a custom token", async () => {
  for (const data of [{ localId: "owner" }, { localId: "owner", idToken: "partial", mfaPendingCredential: "mfa-required" }]) {
    const h = fixture(); h.args.fetchImpl = async () => new Response(JSON.stringify(data));
    assert.deepEqual(await authenticateLoginAlias(h.args), invalid); assert.deepEqual(h.issued, []);
  }
});

test("provider timeout, redirects, oversized responses and huge password fail uniformly", async () => {
  const huge = fixture(); huge.args.body.password = "x".repeat(4097);
  assert.deepEqual(await authenticateLoginAlias(huge.args), invalid); assert.equal(huge.calls.length, 0);
  const timed = fixture(); let signal;
  timed.args.timeoutMs = 5; timed.args.fetchImpl = async (_, options) => { signal = options.signal; return new Promise(() => {}); };
  assert.deepEqual(await authenticateLoginAlias(timed.args), invalid); assert.equal(signal.aborted, true);
  for (const response of [new Response("x".repeat(70000)), new Response("{}", { status: 302, headers: { location: "https://external.test" } })]) {
    const h = fixture(); h.args.fetchImpl = async () => response;
    assert.deepEqual(await authenticateLoginAlias(h.args), invalid); assert.deepEqual(h.issued, []);
  }
});
