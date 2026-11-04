import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createFixture, http, seedTelegramLinkCode } from "./security-remediation.test.mjs";

// Both real production codebases; only the existing synthetic Firebase/network
// boundaries are substituted. No production identities or external requests.
const { telegramMiniAppLogin } = await import("../functions-telegram-auth/index.js");
const telegramId = "123456789";
const linkCode = "audit-secure-code_1234567890";
const deterministicUid = `telegram_${crypto.createHash("sha256").update(telegramId).digest("hex").slice(0, 24)}`;

function signedInitData(f) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: Number(telegramId), first_name: "Synthetic", username: "pending_user" }) };
  const check = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(f.telegramToken).digest();
  const hash = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams([...Object.entries(fields), ["hash", hash]]).toString();
}

async function login(f) {
  const res = { set() { return this; }, status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; } };
  f.auth.createCustomToken = async uid => { f.lastTokenUid = uid; return "synthetic-token"; };
  await telegramMiniAppLogin({ method: "POST", headers: {}, body: { initData: signedInitData(f) } }, res);
  return res;
}

async function bot(f, text = `/start ${linkCode}`) {
  const secret = crypto.createHash("sha256").update(f.telegramToken).digest("hex");
  return http("telegramWebhook", { message: {
    from: { id: Number(telegramId), username: "pending_user" },
    chat: { id: Number(telegramId), type: "private" }, text
  } }, "", { headers: { "x-telegram-bot-api-secret-token": secret } });
}

function noNetwork(t) {
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ ok: true, result: {} }) }));
}

test("real invite bot Start followed by the persistent Mini App button uses the invited account without creating a pending duplicate", async t => {
  noNetwork(t);
  const token = "started-invite-token_1234567890";
  const f = createFixture({
    "users/invited": { role: "client", active: true, trainerId: "trainer", assignedTrainerId: "trainer", accountAccessStatus: "active" },
    [`inviteLinks/${token}`]: { inviteKind: "client", role: "client", uid: "invited", trainerId: "trainer",
      inviteId: "invited@example.test", telegramUsername: "pending_user", status: "active", expiresAt: "2099-01-01T00:00:00Z" },
    "clientInvites/invited@example.test": { status: "active", authUid: "invited", trainerId: "trainer" }
  });
  assert.equal((await bot(f, `/start invite_${token}`)).status, 200);
  assert.equal(f.docs.get(`telegramPendingClientInvites/${telegramId}`).token, token);
  assert.equal(f.docs.get(`inviteLinks/${token}`).status, "started");
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, "invited");
  assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, "invited");
  assert.equal(f.docs.get(`inviteLinks/${token}`).status, "accepted");
  assert.equal(f.docs.has(`users/${deterministicUid}`), false);
  assert.equal(f.authUsers.has(deterministicUid), false);
  assert.equal(f.docs.has(`telegramPendingClientInvites/${telegramId}`), false);
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, "invited");
});

test("an existing open Telegram account accepts a newly created trainer invitation through real bot Start and tokenless login without changing UID", async t => {
  noNetwork(t);
  const f = createFixture();
  f.auth.createUser = async data => { f.authUsers.set(data.uid, { ...data, disabled: false }); return data; };
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, deterministicUid);
  const created = await http("trainerCreateInvite", { telegramUsername: "pending_user" }, "trainer");
  assert.equal(created.status, 200);
  assert.equal(created.data.existingAccount, true);
  const token = new URL(created.data.botStartUrl).searchParams.get("start").slice("invite_".length);
  assert.equal((await bot(f, `/start invite_${token}`)).status, 200);
  assert.equal(f.docs.get(`users/${deterministicUid}`).assignedTrainerId, "trainer");
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, deterministicUid);
  assert.equal(f.docs.get(`users/${deterministicUid}`).accountAccessStatus, "active");
  assert.equal(f.docs.has(`telegramPendingClientInvites/${telegramId}`), false);
});

test("unrelated trainer invitation returns no existing pending-client profile fields", async () => {
  const f = createFixture({ "users/pending": {
    role: "client", accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer",
    telegramUsername: "pending_user", telegramUserId: telegramId, email: "private@example.test",
    accountProfile: { login: "private-login" }, privateMarker: "private"
  } });
  const response = await http("trainerCreateInvite", { telegramUsername: "pending_user" }, "trainer");
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.client, { id: "pending", name: "pending_user", role: "client", accountAccessStatus: "awaiting_trainer" });
  assert.equal(response.data.login, "");
  assert.equal(f.docs.get("users/pending").trainerId, undefined);
});

test("forged legacy client Telegram metadata cannot select an attacker-owned Auth identity", async () => {
  const f = createFixture({ "users/attacker-client": {
    role: "client", active: true, trainerId: "trainer", createdByUid: "trainer", telegramUserId: telegramId
  } });
  const response = await login(f);
  assert.equal(response.code, 403);
  assert.equal(response.data.error, "auth/telegram-relink-required");
  assert.equal(f.lastTokenUid, undefined);
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false);
});

test("canonical binding wins over forged legacy duplicate metadata", async () => {
  const f = createFixture({
    "users/attacker-client": { role: "client", trainerId: "trainer", telegramUserId: telegramId },
    "users/client": { role: "client", telegramUserId: telegramId },
    [`telegramIdentities/${telegramId}`]: { uid: "client", telegramUserId: telegramId }
  });
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, "client");
});

test("verified deterministic Telegram account safely establishes a missing canonical binding", async () => {
  const f = createFixture({ [`users/${deterministicUid}`]: { role: "client", telegramUserId: telegramId } });
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, deterministicUid);
  assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, deterministicUid);
});

test("authenticated bot re-link establishes the canonical registry and restores legacy client Mini App login", async t => {
  noNetwork(t);
  const f = createFixture({ "users/client": { role: "client", telegramLinkCode: linkCode, telegramLinkCodeExpiresAt: "2099-01-01T00:00:00Z" } });
  seedTelegramLinkCode(f, { code: linkCode });
  await bot(f);
  assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, "client");
  assert.equal(f.docs.get("users/client").telegramLinkCode, undefined);
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, "client");
  assert.equal((await http("telegramDisconnect", {}, "client")).status, 200);
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false);
  assert.equal(f.docs.get("users/client").telegramUserId, undefined);
});

test("code linking cannot duplicate an existing profile or claim another live canonical binding", async t => {
  noNetwork(t);
  for (const canonicalOnly of [false, true]) {
    const f = createFixture({
      "users/client": { role: "client", telegramLinkCode: linkCode, telegramLinkCodeExpiresAt: "2099-01-01T00:00:00Z" },
      ...(canonicalOnly ? { [`telegramIdentities/${telegramId}`]: { uid: "other", telegramUserId: telegramId } }
        : { "users/other": { role: "client", telegramUserId: telegramId } })
    });
    seedTelegramLinkCode(f, { code: linkCode });
    await bot(f);
    assert.equal(f.docs.get("users/client").telegramUserId, undefined);
    assert.equal(f.docs.get("users/client").telegramLinkCode, linkCode);
    if (canonicalOnly) assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, "other");
  }
});

test("plain bot start does not canonicalize untrusted legacy client metadata", async t => {
  noNetwork(t);
  const f = createFixture({ "users/client": { role: "client", telegramUserId: telegramId } });
  await bot(f, "/start");
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false);
  assert.equal(f.docs.get("users/client").telegramChatId, undefined);
});

for (const plainStart of [false, true]) {
  test(`stale ${plainStart ? "plain-start" : "code-link"} webhook cannot resurrect a completed deletion`, async t => {
    noNetwork(t);
    const f = createFixture({
      "users/client": { role: "client", telegramUserId: telegramId,
        telegram: { telegramUserId: telegramId }, telegramLinkCode: linkCode, telegramLinkCodeExpiresAt: "2099-01-01T00:00:00Z" },
      [`telegramIdentities/${telegramId}`]: { uid: "client", telegramUserId: telegramId }
    });
    seedTelegramLinkCode(f, { code: linkCode });
    const originalCollection = f.db.collection;
    let intercepted = false;
    f.db.collection = (...args) => {
      const collection = originalCollection(...args);
      if (args[0] !== "users") return collection;
      if (!plainStart) {
        const originalDoc = collection.doc;
        collection.doc = id => {
          const ref = originalDoc(id), originalGet = ref.get;
          ref.get = async () => {
            const snapshot = await originalGet();
            if (id === "client" && !intercepted) {
              intercepted = true;
              assert.equal((await http("deleteUser", { uid: "client" })).status, 200);
            }
            return snapshot;
          };
          return ref;
        };
        return collection;
      }
      const originalWhere = collection.where;
      collection.where = (...whereArgs) => {
        const query = originalWhere(...whereArgs);
        if (whereArgs[0] !== (plainStart ? "telegramUserId" : "telegramLinkCode")) return query;
        const originalLimit = query.limit;
        query.limit = limit => {
          const limited = originalLimit(limit), originalGet = limited.get;
          limited.get = async () => {
            const snapshot = await originalGet();
            if (!intercepted) { intercepted = true; assert.equal((await http("deleteUser", { uid: "client" })).status, 200); }
            return snapshot;
          };
          return limited;
        };
        return query;
      };
      return collection;
    };
    await bot(f, plainStart ? "/start" : `/start ${linkCode}`);
    assert.equal(f.docs.has("users/client"), false);
    assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false);
    assert.equal(f.docs.get("accountDeletions/client").status, "completed");
  });
}

test("verified Telegram re-registration reopens its lifecycle and can be deleted again", async () => {
  const f = createFixture({ [`accountDeletions/${deterministicUid}`]: { status: "completed", completedAt: "prior-deletion" } });
  f.auth.createUser = async data => { f.authUsers.set(data.uid, { ...data, disabled: false }); return data; };
  assert.equal((await login(f)).code, 200);
  assert.equal(f.docs.get(`users/${deterministicUid}`).accountAccessStatus, "awaiting_trainer");
  assert.equal(f.docs.get(`accountDeletions/${deterministicUid}`).status, "reopened");
  assert.equal(f.docs.get(`accountDeletions/${deterministicUid}`).completedAt, "prior-deletion");
  assert.equal((await http("deleteUser", { uid: deterministicUid })).data.alreadyDeleted, undefined);
  assert.equal(f.docs.has(`users/${deterministicUid}`), false);
  assert.equal(f.authUsers.has(deterministicUid), false);
});

test("completed tombstone never exempts a live profile from cleanup", async () => {
  const f = createFixture({ "accountDeletions/client": { status: "completed" } });
  assert.equal((await http("deleteUser", { uid: "client" })).status, 200);
  assert.equal(f.docs.has("users/client"), false);
  assert.equal(f.authUsers.has("client"), false);
});

test("suspend retries preserve the original access state and restore remains usable", async () => {
  const f = createFixture();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal((await http("adminSetUserAccess", { uid: "client", action: "suspend" })).status, 200);
  }
  assert.equal(f.docs.get("users/client").accessBeforeSuspend.active, true);
  assert.equal((await http("adminSetUserAccess", { uid: "client", action: "restore" })).status, 200);
  assert.equal(f.docs.get("users/client").active, true);
  assert.equal(f.docs.get("users/client").accessDisabled, false);
  assert.equal(f.docs.get("users/client").membershipStatus, "active");
});

test("self link issuance stores only a private hash, invalidates prior codes and never exposes credentials through profile data", async t => {
  noNetwork(t);
  const f = createFixture();
  const first = await http("telegramCreateLinkCode", {}, "client");
  assert.equal(first.status, 200);
  assert.match(first.data.code, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(new URL(first.data.botStartUrl).searchParams.get("start"), first.data.code);
  assert.ok(Date.parse(first.data.expiresAt) > Date.now() + 9 * 60 * 1000);
  assert.ok(Date.parse(first.data.expiresAt) <= Date.now() + 10 * 60 * 1000);
  assert.equal(JSON.stringify([...f.docs]).includes(first.data.code), false);
  assert.equal(f.docs.get("users/client").telegramLinkCode, undefined);
  const second = await http("telegramCreateLinkCode", {}, "client");
  const firstHash = crypto.createHash("sha256").update(first.data.code).digest("hex");
  assert.equal(f.docs.get(`telegramLinkCodes/${firstHash}`).status, "revoked");
  await bot(f, `/start ${first.data.code}`);
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false);
  await bot(f, `/start ${second.data.code}`);
  assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, "client");
  const secondHash = crypto.createHash("sha256").update(second.data.code).digest("hex");
  assert.equal(f.docs.get(`telegramLinkCodes/${secondHash}`).status, "used");
  await http("telegramDisconnect", {}, "client");
  await bot(f, `/start ${second.data.code}`);
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false, "one-time code cannot reconnect after disconnect");
});

test("legacy profile-only link codes fail closed even when a trainer can read the profile", async t => {
  noNetwork(t);
  const f = createFixture({ "users/client": { role: "client", trainerId: "trainer",
    telegramLinkCode: linkCode, telegramLinkCodeExpiresAt: "2099-01-01T00:00:00Z" } });
  await bot(f);
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false);
  assert.equal(f.docs.get("users/client").telegramUserId, undefined);
});

test("admin recovery requires a current verified admin, explicit expected owner and active client target", async t => {
  noNetwork(t);
  const f = createFixture({ "users/suspended": { role: "client", active: false } });
  for (const actor of ["client", "trainer"]) {
    assert.equal((await http("telegramCreateLinkCode", { targetUid: "client", expectedTelegramUsername: "pending_user" }, actor)).status, 403);
  }
  f.tokens.get("trainer").admin = true;
  assert.equal((await http("telegramCreateLinkCode", { targetUid: "client", expectedTelegramUsername: "pending_user" }, "trainer")).status, 403, "claim without server admin role is not enough");
  assert.equal((await http("telegramCreateLinkCode", { targetUid: "client" })).status, 400);
  assert.equal((await http("telegramCreateLinkCode", { targetUid: "client", expectedTelegramUsername: "bad name" })).status, 400);
  assert.equal((await http("telegramCreateLinkCode", { targetUid: "trainer", expectedTelegramUsername: "pending_user" })).status, 403);
  assert.equal((await http("telegramCreateLinkCode", { targetUid: "suspended", expectedTelegramUsername: "pending_user" })).status, 403);
  assert.equal((await http("telegramCreateLinkCode", { targetUid: "missing", expectedTelegramUsername: "pending_user" })).status, 404);
  assert.equal([...f.docs].filter(([path]) => path.startsWith("telegramLinkCodes/")).length, 0);
});

test("explicit admin recovery consumes signed expected-owner proof without changing role, assignment or history", async t => {
  noNetwork(t);
  const f = createFixture({
    "users/client": { role: "client", trainerId: "trainer", name: "Legacy client", telegramUserId: telegramId },
    "users/client/history/keep": { sets: [1, 2, 3] }
  });
  assert.equal((await login(f)).data.error, "auth/telegram-relink-required");
  const issued = await http("telegramCreateLinkCode", { targetUid: "client", expectedTelegramUsername: "@Pending_User", expectedTelegramId: telegramId });
  assert.equal(issued.status, 200);
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false, "issuance alone grants no binding");
  await bot(f, `/start ${issued.data.code}`);
  assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, "client");
  assert.equal(f.docs.get("users/client").role, "client");
  assert.equal(f.docs.get("users/client").trainerId, "trainer");
  assert.deepEqual(f.docs.get("users/client/history/keep"), { sets: [1, 2, 3] });
  assert.equal((await login(f)).code, 200);
  assert.equal(f.lastTokenUid, "client");
  assert.ok([...f.docs].some(([path, event]) => path.startsWith("adminAuditEvents/") && event.action === "user.telegram.recovery-issued"));
});

test("recovery rejects wrong signed owner, expired code, revoked admin and conflicting canonical binding", async t => {
  noNetwork(t);
  for (const failure of ["username", "id", "expiry", "admin", "binding"]) {
    const f = createFixture();
    const issued = await http("telegramCreateLinkCode", { targetUid: "client",
      expectedTelegramUsername: failure === "username" ? "other_user" : "pending_user",
      ...(failure === "id" ? { expectedTelegramId: "999999" } : {}) });
    assert.equal(issued.status, 200, failure);
    const hash = crypto.createHash("sha256").update(issued.data.code).digest("hex");
    if (failure === "expiry") f.docs.get(`telegramLinkCodes/${hash}`).expiresAt = "2000-01-01T00:00:00Z";
    if (failure === "admin") f.docs.get("users/adminA").role = "client";
    if (failure === "binding") f.docs.set(`telegramIdentities/${telegramId}`, { uid: "other", telegramUserId: telegramId });
    await bot(f, `/start ${issued.data.code}`);
    assert.equal(f.docs.get("users/client").telegramUserId, undefined, failure);
    assert.equal(f.docs.get(`telegramLinkCodes/${hash}`).status, "active", failure);
    if (failure === "binding") assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, "other");
    else assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false, failure);
  }
});

test("deletion removes private recovery credentials and disables in-flight or replayed redemption", async t => {
  noNetwork(t);
  const f = createFixture();
  const issued = await http("telegramCreateLinkCode", { targetUid: "client", expectedTelegramUsername: "pending_user" });
  assert.equal(issued.status, 200);
  assert.equal((await http("deleteUser", { uid: "client" })).status, 200);
  assert.equal([...f.docs].some(([path, data]) => path.startsWith("telegramLinkCodes/") && data.uid === "client"), false);
  await bot(f, `/start ${issued.data.code}`);
  assert.equal(f.docs.has("users/client"), false);
  assert.equal(f.docs.has(`telegramIdentities/${telegramId}`), false);
});

test("recovery rechecks canonical ownership transactionally after an in-flight competing binding", async t => {
  noNetwork(t);
  const f = createFixture();
  const issued = await http("telegramCreateLinkCode", { targetUid: "client", expectedTelegramUsername: "pending_user" });
  const originalTransaction = f.db.runTransaction;
  let injected = false;
  f.db.runTransaction = async callback => {
    if (!injected) {
      injected = true;
      f.docs.set(`telegramIdentities/${telegramId}`, { uid: "competing-client", telegramUserId: telegramId });
    }
    return originalTransaction(callback);
  };
  await bot(f, `/start ${issued.data.code}`);
  assert.equal(f.docs.get("users/client").telegramUserId, undefined);
  assert.equal(f.docs.get(`telegramIdentities/${telegramId}`).uid, "competing-client");
  const hash = crypto.createHash("sha256").update(issued.data.code).digest("hex");
  assert.equal(f.docs.get(`telegramLinkCodes/${hash}`).status, "active");
});
