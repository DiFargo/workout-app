import assert from "node:assert/strict";
import crypto from "node:crypto";
import { registerHooks } from "node:module";
import { after, beforeEach, test } from "node:test";

let fixture;
const runtimeKey = `telegram-invite-endpoint-${crypto.randomUUID()}`;
const firestore = Object.assign(() => fixture.db, {
  FieldValue: { serverTimestamp: () => "synthetic-server-time" }
});
globalThis[runtimeKey] = {
  admin: {
    initializeApp() {},
    firestore,
    auth: () => fixture.auth,
    appCheck: () => fixture.appCheck
  },
  botToken: () => fixture.botToken,
  enforceAppCheck: () => false,
  bootstrapEnabled: () => false,
  bootstrapEmail: () => "",
  bootstrapTelegramId: () => ""
};
const imports = {
  "firebase-admin": `export default globalThis[${JSON.stringify(runtimeKey)}].admin;`,
  "firebase-functions/params": `
    export const defineSecret = () => ({ value: globalThis[${JSON.stringify(runtimeKey)}].botToken });
    export const defineBoolean = () => ({ value: globalThis[${JSON.stringify(runtimeKey)}].enforceAppCheck });
    export const defineString = name => ({ value: name === "STAGING_TEST_ACCOUNT_EMAIL"
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

const botToken = "synthetic-telegram-invite-token";
const telegramUser = { id: 1476236684, first_name: "Ilya", last_name: "Fit", username: "ilya_fit" };
const inviteToken = "telegram-invite-token_1234567890";
const valueAt = (data, field) => field.split(".").reduce((value, key) => value?.[key], data);

function makeSignedInitData(user = telegramUser) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000) - 20),
    query_id: "synthetic-invite-query",
    user: JSON.stringify(user)
  };
  const checkString = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  return new URLSearchParams([...Object.entries(fields), ["hash", hash]]).toString();
}

function makeRef(name, id, buckets) {
  return {
    collectionName: name,
    id,
    async get() {
      const data = buckets[name].get(id);
      return { id, exists: buckets[name].has(id), data: () => data ? structuredClone(data) : undefined };
    }
  };
}

beforeEach(() => {
  const buckets = {
    users: new Map([[
      "invited-client",
      { role: "client", active: true, trainerId: "trainer-one", assignedTrainerId: "trainer-one" }
    ]]),
    inviteLinks: new Map([[inviteToken, {
      inviteKind: "client", role: "client", uid: "invited-client", trainerId: "trainer-one",
      inviteId: "client@example.test", email: "client@example.test", telegramUsername: "ilya_fit",
      telegramUserId: String(telegramUser.id), telegramChatId: String(telegramUser.id), status: "started",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }]]),
    clientInvites: new Map([["client@example.test", {
      status: "active", authUid: "invited-client", trainerId: "trainer-one"
    }]]),
    telegramIdentities: new Map(),
    telegramPendingClientInvites: new Map(),
    accountDeletions: new Map()
  };
  fixture = { buckets, botToken, createdAuthUids: [], authUsers: new Map([["invited-client", { uid: "invited-client", disabled: false }]]) };
  fixture.db = {
    collection(name) {
      const bucket = buckets[name];
      assert.ok(bucket, `Unexpected collection ${name}`);
      return {
        doc: id => makeRef(name, id, buckets),
        where(field, operation, value) {
          assert.equal(name, "users");
          assert.equal(operation, "==");
          return { limit(max) { return { async get() {
            const matches = [...bucket].filter(([, data]) => valueAt(data, field) === value).slice(0, max);
            return { docs: matches.map(([id, data]) => ({ id, data: () => structuredClone(data) })) };
          } }; } };
        }
      };
    },
    async runTransaction(callback) {
      fixture.beforeTransaction?.();
      const writes = [];
      const tx = {
        async get(ref) {
          const data = buckets[ref.collectionName].get(ref.id);
          return { id: ref.id, exists: buckets[ref.collectionName].has(ref.id), data: () => data ? structuredClone(data) : undefined };
        },
        set(ref, data, options = {}) { writes.push({ ref, data: structuredClone(data), merge: options.merge === true }); },
        delete(ref) { writes.push({ ref, remove: true }); }
      };
      const result = await callback(tx);
      for (const { ref, data, merge, remove } of writes) {
        const bucket = buckets[ref.collectionName];
        if (remove) { bucket.delete(ref.id); continue; }
        bucket.set(ref.id, merge ? { ...(bucket.get(ref.id) || {}), ...data } : data);
      }
      return result;
    }
  };
  fixture.auth = {
    async getUser(uid) {
      if (!fixture.authUsers.has(uid)) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
      return structuredClone(fixture.authUsers.get(uid));
    },
    async createUser(data) {
      fixture.createdAuthUids.push(data.uid);
      fixture.authUsers.set(data.uid, { ...structuredClone(data), disabled: false });
      return structuredClone(fixture.authUsers.get(data.uid));
    },
    async createCustomToken(uid) { fixture.customTokenUid = uid; return "synthetic-invite-custom-token"; }
  };
  fixture.appCheck = { async verifyToken() { return { appId: "synthetic" }; } };
});

async function request({ token = inviteToken, user = telegramUser } = {}) {
  const response = { statusCode: 0, data: null };
  const res = {
    set() { return this; },
    status(code) { response.statusCode = code; return this; },
    json(data) { response.data = data; return this; }
  };
  await telegramMiniAppLogin({
    method: "POST",
    body: { initData: makeSignedInitData(user), telegramInviteToken: token },
    headers: {}
  }, res);
  return response;
}

function seedPendingInvite(overrides = {}, id = String(telegramUser.id)) {
  const pending = {
    token: inviteToken, uid: "invited-client", trainerId: "trainer-one", telegramUsername: "ilya_fit",
    expiresAt: fixture.buckets.inviteLinks.get(inviteToken).expiresAt,
    startedAt: new Date(Date.now() - 1000).toISOString(),
    ...overrides
  };
  fixture.buckets.telegramPendingClientInvites.set(id, pending);
  const invite = fixture.buckets.inviteLinks.get(inviteToken);
  if (invite) invite.startedAt = structuredClone(pending.startedAt);
  return pending;
}

function seedExistingLinkedAccount() {
  const id = String(telegramUser.id);
  fixture.buckets.users.set("linked-client", { role: "client", active: true, telegramUserId: id });
  fixture.authUsers.set("linked-client", { uid: "linked-client", disabled: false });
  fixture.buckets.telegramIdentities.set(id, { uid: "linked-client", telegramUserId: id });
}

test("signed Mini App invite atomically binds Telegram identity to the trainer-created client and mints that UID", async () => {
  const response = await request();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.data, { ok: true, customToken: "synthetic-invite-custom-token" });
  assert.equal(fixture.customTokenUid, "invited-client");
  assert.equal(fixture.buckets.users.get("invited-client").telegramUserId, String(telegramUser.id));
  assert.equal(fixture.buckets.users.get("invited-client").telegramConnected, true);
  assert.equal(fixture.buckets.inviteLinks.get(inviteToken).status, "accepted");
  assert.equal(fixture.buckets.clientInvites.get("client@example.test").status, "accepted");
  assert.equal(fixture.buckets.telegramIdentities.get(String(telegramUser.id)).uid, "invited-client");
});

test("a mismatched Telegram username cannot consume an invite or receive a custom token", async () => {
  const response = await request({ user: { ...telegramUser, username: "different_user" } });

  assert.equal(response.statusCode, 409);
  assert.equal(response.data.error, "telegram-invite-username-mismatch");
  assert.equal(fixture.customTokenUid, undefined);
  assert.equal(fixture.buckets.inviteLinks.get(inviteToken).status, "started");
  assert.equal(fixture.buckets.telegramIdentities.size, 0);
});

test("a Telegram identity left by a completed client deletion can be claimed by the replacement invite", async () => {
  fixture.buckets.telegramIdentities.set(String(telegramUser.id), {
    uid: "deleted-client",
    telegramUserId: String(telegramUser.id)
  });
  fixture.buckets.accountDeletions.set("deleted-client", { status: "completed" });

  const response = await request();

  assert.equal(response.statusCode, 200);
  assert.equal(response.data.ok, true);
  assert.equal(fixture.customTokenUid, "invited-client");
  assert.equal(fixture.buckets.telegramIdentities.get(String(telegramUser.id)).uid, "invited-client");
});

test("an identity owned by an account whose deletion is not complete remains protected", async () => {
  fixture.buckets.telegramIdentities.set(String(telegramUser.id), {
    uid: "deleted-client",
    telegramUserId: String(telegramUser.id)
  });
  fixture.buckets.accountDeletions.set("deleted-client", { status: "pending" });

  const response = await request();

  assert.equal(response.statusCode, 409);
  assert.equal(response.data.error, "telegram-invite-account-mismatch");
  assert.equal(fixture.customTokenUid, undefined);
  assert.equal(fixture.buckets.telegramIdentities.get(String(telegramUser.id)).uid, "deleted-client");
});

test("the tokenless persistent button accepts the exact started invitation without provisioning an orphan pending UID", async () => {
  seedPendingInvite({ startedAt: { seconds: Math.floor(Date.now() / 1000) - 1, nanoseconds: 0 } });
  const response = await request({ token: "" });

  assert.equal(response.statusCode, 200);
  assert.equal(fixture.customTokenUid, "invited-client");
  assert.deepEqual(fixture.createdAuthUids, []);
  assert.equal(fixture.buckets.users.size, 1);
  assert.equal(fixture.buckets.inviteLinks.get(inviteToken).status, "accepted");
  assert.equal(fixture.buckets.telegramPendingClientInvites.has(String(telegramUser.id)), false);
});

test("explicit acceptance clears only its matching pending pointer", async () => {
  seedPendingInvite();
  assert.equal((await request()).statusCode, 200);
  assert.equal(fixture.buckets.telegramPendingClientInvites.has(String(telegramUser.id)), false);
});

test("explicit acceptance does not clear a pending pointer for another invitation", async () => {
  const pending = seedPendingInvite({ token: "another-pending-invite-token_12345" });
  assert.equal((await request()).statusCode, 200);
  assert.deepEqual(fixture.buckets.telegramPendingClientInvites.get(String(telegramUser.id)), pending);
});

test("a concurrent newer pending pointer prevents implicit acceptance of the old invite without provisioning another UID", async () => {
  seedPendingInvite();
  const replacement = { token: "newer-pending-invite-token_123456", uid: "another-client" };
  fixture.beforeTransaction = () => {
    fixture.buckets.telegramPendingClientInvites.set(String(telegramUser.id), replacement);
  };
  const response = await request({ token: "" });
  assert.equal(response.statusCode, 409);
  assert.equal(response.data.error, "telegram-invite-changed");
  assert.equal(fixture.customTokenUid, undefined);
  assert.deepEqual(fixture.createdAuthUids, []);
  assert.equal(fixture.buckets.inviteLinks.get(inviteToken).status, "started");
  assert.equal(fixture.buckets.users.get("invited-client").telegramUserId, undefined);
  assert.deepEqual(fixture.buckets.telegramPendingClientInvites.get(String(telegramUser.id)), replacement);
});

for (const [label, mutate] of Object.entries({
  "removed": () => fixture.buckets.telegramPendingClientInvites.delete(String(telegramUser.id)),
  "expired": () => { fixture.buckets.telegramPendingClientInvites.get(String(telegramUser.id)).expiresAt = "2000-01-01T00:00:00Z"; },
  "changed owner": () => { fixture.buckets.telegramPendingClientInvites.get(String(telegramUser.id)).uid = "another-client"; }
})) {
  test(`a pending pointer ${label} during acceptance returns a retryable conflict without Auth or profile writes`, async () => {
    seedPendingInvite();
    fixture.beforeTransaction = mutate;
    const response = await request({ token: "" });
    assert.equal(response.statusCode, 409);
    assert.equal(response.data.error, "telegram-invite-changed");
    assert.equal(fixture.customTokenUid, undefined);
    assert.deepEqual(fixture.createdAuthUids, []);
    assert.equal(fixture.buckets.users.get("invited-client").telegramUserId, undefined);
    assert.equal(fixture.buckets.inviteLinks.get(inviteToken).status, "started");
    assert.equal(fixture.buckets.telegramIdentities.size, 0);
  });
}

const invalidPendingCases = {
  "expired pointer": () => seedPendingInvite({ expiresAt: "2000-01-01T00:00:00Z" }),
  "missing start proof": () => seedPendingInvite({ startedAt: null }),
  "future start proof": () => seedPendingInvite({ startedAt: new Date(Date.now() + 60_000).toISOString() }),
  "malformed timestamp": () => seedPendingInvite({ startedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: -1 } }),
  "malformed token": () => seedPendingInvite({ token: "../another-invite" }),
  "another Telegram document": () => seedPendingInvite({}, "9999999"),
  "another Telegram owner on invite": () => {
    seedPendingInvite(); fixture.buckets.inviteLinks.get(inviteToken).telegramUserId = "9999999";
  },
  "another username": () => seedPendingInvite({ telegramUsername: "another_user" }),
  "mismatched target UID": () => seedPendingInvite({ uid: "another-client" }),
  "mismatched trainer": () => seedPendingInvite({ trainerId: "another-trainer" }),
  "mismatched expiry": () => seedPendingInvite({ expiresAt: new Date(Date.now() + 120_000).toISOString() }),
  "mismatched start proof": () => { seedPendingInvite(); fixture.buckets.inviteLinks.get(inviteToken).startedAt = "2000-01-01T00:00:00Z"; },
  "invite not started": () => { seedPendingInvite(); fixture.buckets.inviteLinks.get(inviteToken).status = "active"; },
  "missing invitation": () => { seedPendingInvite(); fixture.buckets.inviteLinks.delete(inviteToken); }
};
for (const [label, arrange] of Object.entries(invalidPendingCases)) {
  test(`tokenless login ignores ${label} without consuming an invite or changing the legitimate existing UID`, async () => {
    seedExistingLinkedAccount();
    arrange();
    const before = structuredClone([...fixture.buckets.telegramPendingClientInvites]);
    const response = await request({ token: "" });
    assert.equal(response.statusCode, 200);
    assert.equal(fixture.customTokenUid, "linked-client");
    assert.deepEqual(fixture.createdAuthUids, []);
    assert.notEqual(fixture.buckets.inviteLinks.get(inviteToken)?.status, "accepted");
    assert.deepEqual([...fixture.buckets.telegramPendingClientInvites], before);
  });
}

test("a valid pending invite cannot replace another live canonical account", async () => {
  seedPendingInvite();
  fixture.buckets.telegramIdentities.set(String(telegramUser.id), { uid: "another-live-client" });
  const response = await request({ token: "" });
  assert.equal(response.statusCode, 409);
  assert.equal(response.data.error, "telegram-invite-account-mismatch");
  assert.equal(fixture.customTokenUid, undefined);
  assert.deepEqual(fixture.createdAuthUids, []);
  assert.equal(fixture.buckets.telegramIdentities.get(String(telegramUser.id)).uid, "another-live-client");
  assert.equal(fixture.buckets.inviteLinks.get(inviteToken).status, "started");
  assert.equal(fixture.buckets.telegramPendingClientInvites.has(String(telegramUser.id)), true);
});

test("an invalid explicit token never falls back to a valid pending invite", async () => {
  seedPendingInvite();
  const response = await request({ token: "invalid-explicit-token" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.data.error, "telegram-invite-invalid");
  assert.equal(fixture.customTokenUid, undefined);
  assert.equal(fixture.buckets.inviteLinks.get(inviteToken).status, "started");
  assert.equal(fixture.buckets.telegramPendingClientInvites.has(String(telegramUser.id)), true);
});
