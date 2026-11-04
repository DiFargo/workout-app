import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSecurityKeyClient, securityKeyErrorMessage } from "../src/utils/adminSecurityKeyClient.js";
import { advanceAuthSession } from "../src/utils/authSession.js";
import { hasAdminSecurityKeyProof, ADMIN_SECURITY_KEY_SESSION_MS } from "../functions/adminSecurityKeyAccess.js";

function fixture(overrides = {}) {
  const auth = { currentUser: { uid: "admin" } }, calls = [];
  const request = async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    return { ok: true, json: async () => body.action.endsWith("-options")
      ? { challengeId: "one-use", options: { challenge: "challenge" } }
      : { customToken: "local-fixture-token", verifiedUntil: 100 } };
  };
  const dependencies = { auth, request, startAuthentication: async () => ({ id: "key" }), startRegistration: async () => ({ id: "key" }),
    exchangeToken: async (_, token) => calls.push({ exchange: token }), ...overrides };
  return { auth, calls, client: createAdminSecurityKeyClient(dependencies) };
}
test("hardware confirmation verifies before exchanging a session-only Firebase token", async () => {
  const { calls, client } = fixture();
  await client.confirm();
  assert.deepEqual(calls.map(call => call.action || "exchange"), ["authentication-options", "authentication-verify", "exchange"]);
  assert.equal(calls[1].challengeId, "one-use");
});
test("registration label is optional and bounded; failed verify never exchanges", async () => {
  const { calls, client } = fixture();
  await client.confirm({ register: true, label: "  Резервный  " });
  assert.equal(calls[1].label, "Резервный");
  const blank = fixture();
  await blank.client.confirm({ register: true });
  assert.equal(Object.hasOwn(blank.calls[1], "label"), false);
  const failed = fixture({ request: async () => ({ ok: false, json: async () => ({ error: "recent-authentication-required", message: "Войдите заново" }) }) });
  await assert.rejects(failed.client.confirm(), { userMessage: "Войдите заново" });
  assert.equal(failed.calls.length, 0);
});
test("cancelling hardware prompt never marks access verified", async () => {
  const cancelled = fixture({ startAuthentication: async () => { throw Object.assign(new Error(), { name: "NotAllowedError" }); } });
  await assert.rejects(cancelled.client.confirm(), { name: "NotAllowedError" });
  assert.equal(cancelled.calls.length, 1);
  assert.match(securityKeyErrorMessage({ name: "NotAllowedError" }), /отменено/);
});
test("an incomplete successful status response cannot open administrative content", async () => {
  for (const data of [{}, { required: false, keys: [] }, { required: "false", keys: [], verifiedUntil: null }]) {
    const f = fixture({ request: async () => ({ ok: true, json: async () => data }) });
    await assert.rejects(f.client.status(), /Invalid key status/);
  }
});
test("changing account or same-UID auth session while touching key cannot exchange old proof", async () => {
  for (const sameUid of [false, true]) {
    const f = fixture({ startAuthentication: async () => {
      if (sameUid) advanceAuthSession(f.auth, f.auth.currentUser);
      else f.auth.currentUser = { uid: "other" };
      return { id: "key" };
    } });
    await assert.rejects(f.client.confirm(), /Session changed/);
    assert.equal(f.calls.length, 1);
  }
});
test("server proof rejects missing/stale/expired/future proof and binds the role grant", () => {
  const now = 100000, profile = { adminSecurityKeyRequired: true, adminSecurityKeyVersion: "policy", adminClaimVersion: "role" };
  const valid = { adminSecurityKeyVersion: "policy", adminSecurityKeyRoleVersion: "role", adminSecurityKeyUntil: now + 1000 };
  assert.equal(hasAdminSecurityKeyProof(valid, profile, now), true);
  for (const token of [{}, { ...valid, adminSecurityKeyRoleVersion: "old" }, { ...valid, adminSecurityKeyVersion: "old" },
    { ...valid, adminSecurityKeyUntil: now }, { ...valid, adminSecurityKeyUntil: now + ADMIN_SECURITY_KEY_SESSION_MS + 1 },
    { ...valid, adminSecurityKeyUntil: String(now + 1000) }]) assert.equal(hasAdminSecurityKeyProof(token, profile, now), false);
  assert.equal(hasAdminSecurityKeyProof(valid, { ...profile, adminSecurityKeyRequired: "false" }, now), false);
  assert.equal(hasAdminSecurityKeyProof({}, {}, now), true);
  assert.equal(hasAdminSecurityKeyProof({}, { adminSecurityKeyRequired: false }, now), true);
});
