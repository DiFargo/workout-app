import assert from "node:assert/strict";
import test from "node:test";
import { createFixture, deletionFixture, handlers, http } from "./security-remediation.test.mjs";

// Actual Functions handlers with synthetic Firebase transport. Any unexpected
// network call fails closed; no credentials, emulator, account or paid API.
function quiet(t) {
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected audit network call"); });
}
function linkedFixture() {
  return createFixture({
    "users/client": { role: "client", trainerId: "trainer", telegramLinkedAt: "original-link",
      telegramUserId: "123", telegramChatId: "123", unrelated: "retained",
      telegram: { connected: true, telegramUserId: "123", chatId: "123", notificationsEnabled: true } },
    "telegramIdentities/123": { uid: "client", telegramUserId: "123" }
  });
}
const plan = { profile: {
  mode: "plan", goal: "general_fitness", level: "beginner", location: "gym", days: "3", duration: "45",
  restrictions: "none", specialStatus: "none",
  registration: { sex: "female", age: 35, height: 168, weight: 70, activity: "medium" }
} };

test("Firestore fixture preserves nested leaves with merge and replaces explicit mergeFields maps", async () => {
  const f = linkedFixture(), ref = f.db.doc("users/client");
  await ref.set({ telegram: { notificationsEnabled: false } }, { merge: true });
  assert.equal(f.docs.get(ref.path).telegram.chatId, "123");
  await ref.set({ telegram: { connected: false } }, { mergeFields: ["telegram"] });
  assert.deepEqual(f.docs.get(ref.path).telegram, { connected: false });
  assert.equal(f.docs.get(ref.path).unrelated, "retained");
});

test("SEC01: basic AI rejects pending, missing and suspended profiles before paid provider work", async t => {
  quiet(t);
  for (const state of ["pending", "missing", "suspended"]) {
    const f = createFixture();
    if (state === "pending") Object.assign(f.docs.get("users/client"), {
      accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer"
    });
    if (state === "missing") f.docs.delete("users/client");
    if (state === "suspended") {
      f.auth.updateUser = async () => { throw new Error("Synthetic Auth unavailable"); };
      assert.equal((await http("adminSetUserAccess", { uid: "client", action: "suspend" })).data.authSynchronized, false);
    }
    let providerCalls = 0;
    t.mock.method(globalThis, "fetch", async () => { providerCalls++; throw new Error("Paid provider must not be reached"); });
    assert.equal((await http("aiBasicWorkoutPlan", plan, "client")).status, 403, state);
    assert.equal(providerCalls, 0, state);
  }
  createFixture({ "users/client": { role: "client", accountRegistrationType: "open",
    accountAccessStatus: "active", trainerId: "trainer", assignedTrainerId: "trainer" } });
  let allowedProviderCalls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    allowedProviderCalls++;
    return { ok: false, text: async () => "Synthetic provider unavailable" };
  });
  assert.equal((await http("aiBasicWorkoutPlan", plan, "client")).status, 200, "admitted client retains bounded fallback");
  assert.equal(allowedProviderCalls, 1);
});

test("SEC03: deletion proves invitation/alias UID ownership instead of trusting profile email", async t => {
  quiet(t);
  const email = "synthetic-victim@example.test";
  const f = createFixture({
    "users/rogue": { role: "client", email, loginLower: "victim-login", trainerId: "trainer" },
    "users/victim": { role: "client", email, trainerId: "other-trainer" },
    "loginAliases/victim-login": { uid: "victim", email },
    [`clientInvites/${email}`]: { authUid: "victim", email },
    "inviteLinks/foreign": { uid: "victim", email },
    "inviteLinks/own": { uid: "rogue", email: "old-owned@example.test" }
  });
  f.authUsers.delete("rogue");
  assert.equal((await http("deleteUser", { uid: "rogue" })).status, 200);
  for (const path of ["users/victim", "loginAliases/victim-login", `clientInvites/${email}`, "inviteLinks/foreign"])
    assert.equal(f.docs.has(path), true, path);
  assert.equal(f.authUsers.has("victim"), true);
  assert.equal(f.docs.has("inviteLinks/own"), false, "own UID invitation removed despite old email");
  assert.equal(f.docs.has("users/rogue"), false);
});

test("SEC03: retry revalidates old cleanup journals and preserves records now owned by another UID", async t => {
  quiet(t);
  const f = deletionFixture();
  Object.assign(f.docs.get("users/client"), { telegramUserId: "123" });
  f.docs.set("telegramIdentities/123", { uid: "client", telegramUserId: "123" });
  f.docs.set("telegramLinkCodes/owned-code", { uid: "client", status: "active" });
  f.docs.set("users/victim", { role: "client" });
  f.docs.set("users/victim/history/private", { private: "must survive stale journal" });
  f.failStoragePrefix = "feedback/client/";
  assert.equal((await http("deleteUser", { uid: "client" })).status, 500);
  assert.equal(f.docs.get("accountDeletions/client").status, "pending");
  const foreign = ["loginAliases/clientlogin", "clientInvites/client@example.test", "inviteLinks/link",
    "telegramLinkCodes/owned-code", "telegramIdentities/123"];
  const saved = new Map();
  for (const path of foreign) {
    assert.ok(f.docs.get("accountDeletions/client").cleanupPaths.includes(path), path);
    f.docs.set(path, { ...(path.startsWith("clientInvites/") ? { authUid: "victim" } : { uid: "victim" }), sentinel: "foreign" });
    saved.set(path, structuredClone(f.docs.get(path)));
  }
  f.docs.get("accountDeletions/client").cleanupPaths.push("users/victim/history/private");
  f.docs.set("inviteLinks/still-owned", { uid: "client" });
  assert.equal((await http("deleteUser", { uid: "client" })).status, 200);
  for (const [path, data] of saved) assert.deepEqual(f.docs.get(path), data, path);
  assert.equal(f.docs.has("users/victim/history/private"), true);
  assert.equal(f.docs.has("inviteLinks/still-owned"), false);
  assert.equal(f.docs.has("users/client"), false);
  assert.equal(f.authUsers.has("client"), false);
  assert.equal(f.docs.get("accountDeletions/client").status, "completed");
});

test("SEC02: real trigger wrapper requires fixed ready config and applies exact-initial-cycle ledger once", async t => {
  quiet(t);
  const f = createFixture({ "users/client": { role: "client", subscription: {
    periodMode: "sessions", cycleId: "initial-fixture", purchasedSessions: 12, usedSessions: 2, remainingSessions: 10
  } }, "users/client/history/one": { date: "2026-10-18", subscriptionCycleId: "forged-client-marker" } });
  const createTime = { seconds: Math.floor(Date.parse("2026-10-18T12:01:00.000Z") / 1000), nanoseconds: 123 };
  const ref = f.db.doc("users/client/history/one");
  f.createTimes.set(ref.path, createTime);
  const event = { id: "immutable-wrapper-create", time: "2026-10-18T12:01:00.000Z", params: { uid: "client", historyId: "one" },
    data: { id: "one", ref, createTime, data: () => ({ date: "2026-10-18", subscriptionCycleId: "forged-client-marker" }) } };
  await assert.rejects(handlers.subscriptionUsageOnWorkoutCreated(event), /baseline is not ready/);
  f.docs.set("serverConfig/subscriptionAccounting", { schemaVersion: 1, baselineReady: true, paused: true,
    cutoverTimestamp: "2026-10-18T12:00:00.000Z", baselineCycleIds: { client: "initial-fixture" } });
  await assert.rejects(handlers.subscriptionUsageOnWorkoutCreated(event), /baseline is not ready/);
  assert.equal(f.docs.get("users/client").subscription.usedSessions, 2);
  f.docs.get("serverConfig/subscriptionAccounting").paused = false;
  f.docs.get("serverConfig/subscriptionAccounting").baselineReady = false;
  await assert.rejects(handlers.subscriptionUsageOnWorkoutCreated(event), /baseline is not ready/);
  f.docs.get("serverConfig/subscriptionAccounting").baselineReady = true;
  await handlers.subscriptionUsageOnWorkoutCreated(event);
  await handlers.subscriptionUsageOnWorkoutCreated({ ...event, id: "retry-same-generation" });
  assert.equal(f.docs.get("users/client").subscription.usedSessions, 3);
  assert.equal(f.docs.get("users/client").subscription.cycleStartedAt, undefined);
  f.docs.delete(ref.path);
  const deleted = { ...event, id: "immutable-wrapper-delete", time: "2026-10-18T13:00:00.000Z" };
  await handlers.subscriptionUsageOnWorkoutDeleted(deleted);
  await handlers.subscriptionUsageOnWorkoutDeleted(deleted);
  assert.equal(f.docs.get("users/client").subscription.usedSessions, 2);
  assert.equal([...f.docs.keys()].filter(path => path.startsWith("subscriptionUsageLedger/")).length, 1);
});

test("SEC02: production wrapper transaction rejects pause or baseline changes after its outer guard", async t => {
  quiet(t);
  for (const mutation of ["pause", "cutover", "initial-cycle"]) {
    const fixed = { schemaVersion: 1, baselineReady: true, paused: false,
      cutoverTimestamp: "2026-10-18T12:00:00.000Z", baselineCycleIds: { client: "initial-fixture" } };
    const f = createFixture({ "serverConfig/subscriptionAccounting": fixed,
      "users/client": { role: "client", subscription: { periodMode: "sessions", cycleId: "initial-fixture",
        purchasedSessions: 12, usedSessions: 2, remainingSessions: 10 } },
      "users/client/history/one": { date: "2026-10-18" } });
    const createTime = { seconds: Math.floor(Date.parse("2026-10-18T12:01:00Z") / 1000), nanoseconds: 123 };
    const ref = f.db.doc("users/client/history/one"); f.createTimes.set(ref.path, createTime);
    const event = { id: "immutable-paused-create", params: { uid: "client", historyId: "one" },
      data: { ref, createTime, data: () => ({ date: "2026-10-18" }) } };
    const collection = f.db.collection;
    let changed = false;
    f.db.collection = name => {
      const c = collection(name);
      if (name !== "serverConfig") return c;
      const doc = c.doc;
      c.doc = id => {
        const configRef = doc(id), get = configRef.get;
        configRef.get = async () => {
          const captured = await get();
          if (!changed) {
            changed = true;
            const config = f.docs.get("serverConfig/subscriptionAccounting");
            if (mutation === "pause") config.paused = true;
            if (mutation === "cutover") config.cutoverTimestamp = "2026-10-18T11:00:00.000Z";
            if (mutation === "initial-cycle") config.baselineCycleIds.client = "different-cycle";
          }
          return captured;
        };
        return configRef;
      };
      return c;
    };
    await assert.rejects(handlers.subscriptionUsageOnWorkoutCreated(event), /config changed or paused/, mutation);
    assert.equal(f.docs.get("users/client").subscription.usedSessions, 2);
    assert.equal([...f.docs.keys()].some(path => path.startsWith("subscriptionUsageLedger/")), false);
    assert.equal(f.calls.some(([name, path]) => name === "set" && path === "users/client"), false);
    f.docs.set("serverConfig/subscriptionAccounting", structuredClone(fixed));
    await handlers.subscriptionUsageOnWorkoutCreated(event);
    await handlers.subscriptionUsageOnWorkoutCreated(event);
    assert.equal(f.docs.get("users/client").subscription.usedSessions, 3);
  }
});

test("SEC04: disconnect deletes all nested destinations and blocks subsequent manual delivery", async t => {
  quiet(t);
  const f = linkedFixture();
  assert.equal((await http("telegramDisconnect", {}, "client")).status, 200);
  const profile = f.docs.get("users/client");
  assert.equal(profile.telegram.connected, false);
  for (const key of ["telegramUserId", "chatId", "username"]) assert.equal(profile.telegram[key], undefined, key);
  assert.equal(profile.telegramUserId, undefined);
  assert.equal(profile.telegramChatId, undefined);
  assert.equal(profile.unrelated, "retained");
  assert.equal(f.docs.has("telegramIdentities/123"), false);
  let sent = 0;
  t.mock.method(globalThis, "fetch", async () => { sent++; throw new Error("Disconnected destination"); });
  assert.equal((await http("telegramSendMessage", { clientId: "client", text: "Synthetic private reply" }, "trainer")).status, 409);
  assert.equal(sent, 0);
});

test("SEC04: manual sender accepts canonical numeric-only binding but rejects foreign/missing ownership", async t => {
  quiet(t);
  for (const owner of ["client", "other", null]) {
    const f = linkedFixture();
    if (owner) f.docs.get("telegramIdentities/123").uid = owner;
    else f.docs.delete("telegramIdentities/123");
    let sent = 0;
    t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.ok(String(url).endsWith("/sendMessage"));
      assert.equal(JSON.parse(options.body).chat_id, "123");
      sent++;
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
    });
    assert.equal((await http("telegramSendMessage", { clientId: "client", text: "Synthetic reply" }, "trainer")).status,
      owner === "client" ? 200 : 409);
    assert.equal(sent, owner === "client" ? 1 : 0);
  }
});

test("SEC05: delayed avatar cannot restore disconnect or overwrite a replacement link generation", async t => {
  quiet(t);
  for (const change of ["disconnect", "new-identity", "same-identity-new-link"]) {
    const f = linkedFixture();
    let release, signal;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { signal = resolve; });
    const removed = [];
    f.bucket.name = "demo-offline-bucket";
    f.bucket.file = (path, options = {}) => ({
      metadata: { generation: "owned-upload" }, save: async () => {},
      delete: async () => { assert.equal(options.generation, "owned-upload"); removed.push(path); }
    });
    t.mock.method(globalThis, "fetch", async url => String(url).includes("getUserProfilePhotos")
      ? { ok: true, json: async () => ({ ok: true, result: { photos: [[{ file_id: "synthetic" }]] } }) }
      : String(url).includes("getFile?")
        ? { ok: true, json: async () => ({ ok: true, result: { file_path: "avatar.jpg" } }) }
        : { ok: true, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => { signal(); await gate; return new Uint8Array([1]).buffer; } });
    const refreshing = http("telegramRefreshAvatar", {}, "client");
    await started;
    if (change === "disconnect") assert.equal((await http("telegramDisconnect", {}, "client")).status, 200);
    else {
      const id = change === "new-identity" ? "456" : "123";
      Object.assign(f.docs.get("users/client"), { telegramLinkedAt: "new-link", telegramUserId: id,
        telegram: { connected: true, telegramUserId: id, chatId: id, avatarUrl: "new-avatar" } });
      f.docs.delete("telegramIdentities/123");
      f.docs.set(`telegramIdentities/${id}`, { uid: "client", telegramUserId: id });
    }
    const expected = structuredClone(f.docs.get("users/client"));
    release();
    assert.equal((await refreshing).status, 403, change);
    assert.deepEqual(f.docs.get("users/client"), expected, change);
    assert.equal(removed.length, 1, "only the stale upload is cleaned");
  }
});

test("SEC07: notification transaction rechecks target assignment and actor activity", async t => {
  quiet(t);
  for (const change of ["assignment", "actor-disabled"]) {
    const f = linkedFixture(), collection = f.db.collection;
    let changed = false;
    f.db.collection = name => {
      const c = collection(name);
      if (name !== "users") return c;
      const doc = c.doc;
      c.doc = id => {
        const ref = doc(id), get = ref.get;
        if (id === "client") ref.get = async () => {
          const old = await get();
          if (!changed) {
            changed = true;
            if (change === "assignment") Object.assign(f.docs.get("users/client"), {
              trainerId: "other-trainer", assignedTrainerId: "other-trainer", trainerAssignmentState: "assigned"
            });
            else f.docs.get("users/trainer").accessDisabled = true;
          }
          return old;
        };
        return ref;
      };
      return c;
    };
    assert.equal((await http("telegramUpdateNotifications", { clientId: "client", enabled: false }, "trainer")).status, 403, change);
    assert.equal(f.docs.get("users/client").telegram.notificationsEnabled, true);
    assert.equal(f.docs.get("users/client").telegramNotificationsUpdatedAt, undefined);
  }
  const f = linkedFixture();
  assert.equal((await http("telegramUpdateNotifications", { clientId: "client", enabled: false }, "trainer")).status, 200);
  assert.equal(f.docs.get("users/client").telegram.notificationsEnabled, false);
  assert.equal(f.docs.get("users/client").telegram.telegramUserId, "123");
  assert.equal(f.docs.get("users/client").unrelated, "retained");
});

test("SEC09: public alias wrapper never discloses resolved email and ignores forged forwarded prefixes", async t => {
  quiet(t);
  const f = createFixture({ "loginAliases/synthetic-alias": { uid: "client", email: "synthetic-private@example.test" } });
  let providerCalls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(new URL(String(url)).hostname, "identitytoolkit.googleapis.com");
    providerCalls++;
    return new Response(JSON.stringify({ error: { message: "INVALID_PASSWORD" } }), { status: 400 });
  });
  for (const prefix of ["192.0.2.1", "192.0.2.2"]) {
    const result = await http("resolveLoginAlias", { login: "synthetic-alias", password: "synthetic-wrong-password" }, "", {
      ip: "198.51.100.1", socket: { remoteAddress: "198.51.100.1" }, headers: { "x-forwarded-for": `${prefix}, 198.51.100.1` }
    });
    assert.equal(result.status, 401);
    assert.deepEqual(result.data, { ok: false, error: "auth/invalid-credential" });
    assert.equal(JSON.stringify(result).includes("synthetic-private"), false);
  }
  assert.equal(providerCalls, 2);
  const buckets = [...f.docs].filter(([path]) => path.startsWith("securityRateLimits/"));
  assert.equal(buckets.length, 3, "same peer plus alias and global budgets, not a new bucket per forwarded prefix");
  assert.ok(buckets.every(([, data]) => data.count === 2));
});
