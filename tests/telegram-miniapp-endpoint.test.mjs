import assert from "node:assert/strict";
import crypto from "node:crypto";
import { registerHooks } from "node:module";
import { after, beforeEach, test } from "node:test";

// Execute the complete endpoint and real signature helper. Only Firebase
// transport, configured secret/parameter values and trigger registration
// are fixtures; no copied handler, production identity or network request.
let fixture;
const runtimeKey = `telegram-endpoint-${crypto.randomUUID()}`;
globalThis[runtimeKey] = {
  admin: {
    initializeApp() {},
    firestore: () => fixture.db,
    auth: () => fixture.auth,
    appCheck: () => fixture.appCheck
  },
  botToken: () => fixture.botToken,
  enforceAppCheck: () => fixture.enforceAppCheck,
  bootstrapEnabled: () => fixture.bootstrapEnabled,
  bootstrapEmail: () => fixture.bootstrapEmail,
  bootstrapTelegramId: () => fixture.bootstrapTelegramId
};
const imports = {
  "firebase-admin": `export default globalThis[${JSON.stringify(runtimeKey)}].admin;`,
  "firebase-functions/params": `
    export const defineSecret = () => ({ value: globalThis[${JSON.stringify(runtimeKey)}].botToken });
    export const defineBoolean = (name) => ({ value: name === "APP_CHECK_ENFORCED"
      ? globalThis[${JSON.stringify(runtimeKey)}].enforceAppCheck
      : globalThis[${JSON.stringify(runtimeKey)}].bootstrapEnabled });
    export const defineString = (name) => ({ value: name === "STAGING_TEST_ACCOUNT_EMAIL"
      ? globalThis[${JSON.stringify(runtimeKey)}].bootstrapEmail
      : globalThis[${JSON.stringify(runtimeKey)}].bootstrapTelegramId });`,
  "firebase-functions/v2/https": "export const onRequest = (_options, handler) => handler;"
};
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (imports[specifier]) return { url: `data:text/javascript,${encodeURIComponent(imports[specifier])}`, shortCircuit: true };
    return next(specifier, context);
  }
});
const { telegramMiniAppLogin } = await import("../functions-telegram-auth/index.js");
after(() => { hook.deregister(); delete globalThis[runtimeKey]; });

const telegramId = "123456789";
const valueAt = (data, field) => field.split(".").reduce((value, key) => value?.[key], data);

beforeEach(() => {
  const docs = new Map([["linked-client", { role: "client", telegramUserId: telegramId, telegram: { telegramUserId: telegramId } }]]);
  const authUsers = new Map([["linked-client", { uid: "linked-client", disabled: false, customClaims: { admin: false, keep: "existing" } }]]);
  const queries = [], tokenCalls = [], authReads = [], appCheckCalls = [];
  fixture = { docs, authUsers, queries, tokenCalls, authReads, appCheckCalls,
    records: { users: docs, telegramIdentities: new Map([[telegramId, { uid: "linked-client", telegramUserId: telegramId }]]), accountDeletions: new Map() },
    botToken: "synthetic-telegram-endpoint-token", enforceAppCheck: false,
    bootstrapEnabled: false, bootstrapEmail: "", bootstrapTelegramId: "" };
  fixture.db = {
    collection(name) {
      const records = fixture.records[name] ||= new Map();
      return {
        doc(id) {
          return {
            id,
            collection: name,
            async get() {
              const data = records.get(id);
              return { exists: Boolean(data), data: () => data ? structuredClone(data) : undefined,
                get: (field) => valueAt(data, field) };
            }
          };
        },
        where(field, comparison, value) {
          assert.equal(name, "users");
          assert.equal(comparison, "==");
          return { limit(max) {
            return { async get() {
              queries.push({ field, value });
              return { docs: [...docs].filter(([, data]) => valueAt(data, field) === value).slice(0, max)
                .map(([id, data]) => ({ id, data: () => structuredClone(data) })) };
            } };
          } };
        }
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async get(ref) {
          const data = fixture.records[ref.collection]?.get(ref.id);
          return { exists: Boolean(data), data: () => data ? structuredClone(data) : undefined,
            get: (field) => valueAt(data, field) };
        },
        create(ref, data) { writes.push({ type: "create", ref, data }); },
        set(ref, data, options) { writes.push({ type: "set", ref, data, options }); }
      };
      const result = await callback(transaction);
      for (const write of writes) {
        const records = fixture.records[write.ref.collection];
        const current = records.get(write.ref.id) || {};
        records.set(write.ref.id, write.type === "set" && write.options?.merge
          ? { ...current, ...structuredClone(write.data) }
          : structuredClone(write.data));
      }
      return result;
    }
  };
  fixture.auth = {
    async getUser(uid) {
      authReads.push(uid);
      if (!authUsers.has(uid)) throw Object.assign(new Error("Synthetic missing identity"), { code: "auth/user-not-found" });
      return structuredClone(authUsers.get(uid));
    },
    async createUser(data) {
      authUsers.set(data.uid, { ...structuredClone(data), disabled: false });
      return structuredClone(authUsers.get(data.uid));
    },
    async createCustomToken(...args) { tokenCalls.push(args); return "synthetic-custom-token"; }
  };
  fixture.appCheck = {
    async verifyToken(token) {
      appCheckCalls.push(token);
      if (token !== "synthetic-valid-app-check") throw Object.assign(new Error("Synthetic invalid App Check"), { code: "app-check/invalid-token" });
      return { appId: "synthetic-app" };
    }
  };
});

function signedInitData(overrides = {}, token = fixture.botToken) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000) - 20),
    query_id: "synthetic-query",
    user: JSON.stringify({ id: Number(telegramId), first_name: "Synthetic" }),
    ...overrides
  };
  const dataCheckString = Object.entries(fields).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams([...Object.entries(fields), ["hash", hash]]).toString();
}

async function request(body = { initData: signedInitData() }, { method = "POST", appCheck = "" } = {}) {
  const response = { statusCode: 0, data: null, headers: {} };
  const res = {
    set(name, value) { response.headers[name] = value; return this; },
    status(code) { response.statusCode = code; return this; },
    json(data) { response.data = data; return this; }
  };
  await telegramMiniAppLogin({ method, body, headers: { "x-firebase-appcheck": appCheck } }, res);
  return response;
}

test("a verified Telegram identity selects its linked UID and deduplicates legacy/nested links without elevated claims", async () => {
  const before = structuredClone(fixture.authUsers.get("linked-client"));
  const response = await request({ initData: signedInitData(), uid: "unrelated-admin", role: "admin", admin: true, customClaims: { admin: true } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.data, { ok: true, customToken: "synthetic-custom-token" });
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(fixture.queries, [
    { field: "telegramUserId", value: telegramId }, { field: "telegram.telegramUserId", value: telegramId }
  ]);
  assert.deepEqual(fixture.authReads, ["linked-client"]);
  assert.deepEqual(fixture.tokenCalls, [["linked-client"]]);
  assert.deepEqual(fixture.authUsers.get("linked-client"), before);
});

test("active trainer and administrator identities retain their server identity and existing claims", async () => {
  for (const role of ["trainer", "admin"]) {
    fixture.records.telegramIdentities.clear();
    fixture.docs.get("linked-client").role = role;
    fixture.authUsers.get("linked-client").customClaims = { admin: role === "admin", adminClaimVersion: "existing-version" };
    const before = structuredClone(fixture.authUsers.get("linked-client"));
    assert.equal((await request()).statusCode, 200);
    assert.deepEqual(fixture.tokenCalls.at(-1), ["linked-client"]);
    assert.deepEqual(fixture.authUsers.get("linked-client"), before);
    assert.equal(fixture.records.telegramIdentities.get(telegramId).uid, "linked-client");
  }
});

test("invalid, altered, expired and future-dated signatures fail before account lookup", async () => {
  for (const initData of [
    "not-init-data", signedInitData({}, "wrong-token"),
    `${signedInitData()}&query_id=forged`,
    signedInitData({ auth_date: String(Math.floor(Date.now() / 1000) - 601) }),
    signedInitData({ auth_date: String(Math.floor(Date.now() / 1000) + 60) })
  ]) {
    const response = await request({ initData });
    assert.equal(response.statusCode, 401);
    assert.equal(response.data.error, "telegram-signature-invalid");
  }
  assert.deepEqual(fixture.queries, []);
  assert.deepEqual(fixture.authReads, []);
  assert.deepEqual(fixture.tokenCalls, []);
  assert.equal(fixture.records.telegramPendingClientInvites, undefined, "unverified requests never read the server-only invite pointer");
});

test("client-supplied invite hints cannot redirect tokenless login to another UID", async () => {
  const response = await request({
    initData: signedInitData(),
    pendingInvite: { token: "forged-client-invite-token_123456", uid: "unrelated-client" },
    telegramPendingClientInvite: { uid: "unrelated-client", trainerId: "unrelated-trainer" }
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(fixture.tokenCalls, [["linked-client"]]);
  assert.equal(fixture.docs.has("unrelated-client"), false);
  assert.equal(fixture.records.telegramPendingClientInvites.size, 0);
});

test("an unknown Telegram account receives only a restricted pending profile and conflicting links get no token", async () => {
  fixture.docs.clear();
  fixture.records.telegramIdentities.clear();
  const pending = await request();
  const pendingUid = `telegram_${crypto.createHash("sha256").update(telegramId).digest("hex").slice(0, 24)}`;
  assert.equal(pending.statusCode, 200);
  assert.deepEqual(pending.data, { ok: true, customToken: "synthetic-custom-token" });
  assert.equal(fixture.docs.get(pendingUid)?.role, "client");
  assert.equal(fixture.docs.get(pendingUid)?.accountRegistrationType, "open");
  assert.equal(fixture.docs.get(pendingUid)?.accountAccessStatus, "awaiting_trainer");
  assert.equal(fixture.docs.get(pendingUid)?.trainerId, undefined);
  assert.deepEqual(fixture.tokenCalls, [[pendingUid]]);

  fixture.docs.clear();
  fixture.records.telegramIdentities.clear();
  fixture.authReads.length = 0;
  fixture.tokenCalls.length = 0;
  fixture.docs.set("one", { role: "client", telegramUserId: telegramId });
  fixture.docs.set("two", { role: "client", telegram: { telegramUserId: telegramId } });
  const conflict = await request();
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.data.error, "telegram-link-conflict");
  assert.deepEqual(fixture.authReads, []);
  assert.deepEqual(fixture.tokenCalls, []);
});

test("disabled, archived, revoked, suspended and non-member profiles are denied before Auth token creation", async () => {
  for (const patch of [
    { active: false }, { archived: true }, { accessDisabled: true },
    { membershipStatus: "revoked" }, { membershipStatus: "suspended" }, { role: "guest" }, { role: "" }
  ]) {
    fixture.docs.set("linked-client", { role: "client", telegramUserId: telegramId, ...patch });
    const response = await request();
    assert.equal(response.statusCode, 403, JSON.stringify(patch));
    assert.equal(response.data.error, "telegram-account-disabled");
  }
  assert.deepEqual(fixture.authReads, []);
  assert.deepEqual(fixture.tokenCalls, []);
});

test("missing and disabled Firebase Auth identities cannot obtain a token", async () => {
  fixture.authUsers.clear();
  assert.equal((await request()).statusCode, 403);
  fixture.authUsers.set("linked-client", { uid: "linked-client", disabled: true });
  assert.equal((await request()).statusCode, 403);
  assert.deepEqual(fixture.tokenCalls, []);
});

test("enforced App Check denies missing and invalid tokens before account lookup", async t => {
  t.mock.method(console, "error", () => {});
  fixture.enforceAppCheck = true;
  assert.equal((await request()).statusCode, 401);
  assert.equal((await request(undefined, { appCheck: "invalid" })).statusCode, 401);
  assert.deepEqual(fixture.queries, []);
  assert.deepEqual(fixture.tokenCalls, []);
  assert.equal((await request(undefined, { appCheck: "synthetic-valid-app-check" })).statusCode, 200);
  assert.deepEqual(fixture.tokenCalls, [["linked-client"]]);
});

test("non-POST requests and Auth failures do not issue tokens or reveal infrastructure details", async t => {
  t.mock.method(console, "error", () => {});
  assert.equal((await request(undefined, { method: "GET" })).statusCode, 405);
  assert.deepEqual(fixture.queries, []);
  fixture.auth.getUser = async () => { throw new Error("Synthetic private infrastructure detail"); };
  const response = await request();
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.data, { ok: false, error: "telegram-login-unavailable" });
  assert.deepEqual(fixture.tokenCalls, []);
});
