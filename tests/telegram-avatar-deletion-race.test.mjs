import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { deletionFixture, http } from "./security-remediation.test.mjs";

function avatarFixture(t, { delayed = false, failCleanup = false } = {}) {
  const f = deletionFixture();
  f.docs.get("users/client").telegram = { telegramUserId: "123", connected: true };
  f.docs.set("telegramIdentities/123", { uid: "client", telegramUserId: "123" });
  let release, signal;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { signal = resolve; });
  const generations = new Map();
  const deletedGenerations = [];
  const uploadedGenerations = [];
  let sequence = 0;
  f.bucket.file = (path, options = {}) => {
    const file = {
      metadata: null,
      save: async (_bytes, saveOptions) => {
        const generation = String(++sequence);
        file.metadata = { generation };
        generations.set(generation, { path, saveOptions });
        f.storageFiles.add(path);
        uploadedGenerations.push({ path, generation });
      },
      delete: async deleteOptions => {
        assert.equal(deleteOptions.ignoreNotFound, true);
        assert.ok(options.generation, "cleanup must be bound to the generation created by this request");
        if (failCleanup) { failCleanup = false; throw new Error("Synthetic late avatar deletion failure"); }
        deletedGenerations.push({ path, generation: options.generation });
        generations.delete(options.generation);
        if (![...generations.values()].some(item => item.path === path)) f.storageFiles.delete(path);
      }
    };
    return file;
  };
  t.mock.method(globalThis, "fetch", async url => {
    if (url.includes("getUserProfilePhotos")) return { ok: true, json: async () => ({ ok: true, result: { photos: [[{ file_id: "photo" }]] } }) };
    if (url.includes("getFile?")) return { ok: true, json: async () => ({ ok: true, result: { file_path: "avatar.jpg" } }) };
    return { ok: true, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => { signal(); if (delayed) await gate; return new Uint8Array([1]).buffer; } };
  });
  return { f, started, release, generations, uploadedGenerations, deletedGenerations };
}

test("an active avatar refresh publishes through a checked transaction and keeps its upload", async t => {
  const { f, uploadedGenerations, deletedGenerations } = avatarFixture(t);
  const response = await http("telegramRefreshAvatar", {}, "client");
  assert.equal(response.status, 200);
  assert.equal(f.docs.get("users/client").role, "client");
  assert.equal(f.docs.get("users/client").telegramAvatarUrl, response.data.telegram.avatarUrl);
  assert.match(response.data.telegram.avatarUrl, /telegram-avatars%2Fclient%2Favatar\.jpg/);
  assert.equal(uploadedGenerations.length, 1);
  assert.deepEqual(deletedGenerations, []);
  assert.equal(f.docs.has("accountDeletions/client"), false);
});

for (const pending of [false, true]) {
  test(`avatar downloaded after ${pending ? "pending" : "completed"} deletion cannot recreate the profile or leave its file`, async t => {
    t.mock.method(console, "error", () => {});
    const { f, started, release, uploadedGenerations, deletedGenerations } = avatarFixture(t, { delayed: true });
    if (pending) f.failStoragePrefix = "feedback/client/";
    const refreshing = http("telegramRefreshAvatar", {}, "client");
    await started;
    assert.equal((await http("deleteUser", { uid: "client" })).status, pending ? 500 : 200);
    const profileAfterDelete = structuredClone(f.docs.get("users/client"));
    release();
    assert.equal((await refreshing).status, 403);
    assert.deepEqual(f.docs.get("users/client"), profileAfterDelete);
    assert.equal(f.storageFiles.has("telegram-avatars/client/avatar.jpg"), false);
    assert.deepEqual(deletedGenerations, uploadedGenerations);
    assert.equal(f.docs.get("accountDeletions/client").status, pending ? "pending" : "completed");
    assert.equal((await http("deleteUser", { uid: "client" })).status, 200);
    assert.equal(f.docs.has("users/client"), false);
  });
}

test("a failed late-avatar cleanup reopens completed deletion for the admin retry", async t => {
  t.mock.method(console, "error", () => {});
  const { f, started, release } = avatarFixture(t, { delayed: true, failCleanup: true });
  const refreshing = http("telegramRefreshAvatar", {}, "client");
  await started;
  assert.equal((await http("deleteUser", { uid: "client" })).status, 200);
  release();
  assert.equal((await refreshing).status, 500);
  assert.equal(f.docs.has("users/client"), false);
  assert.equal(f.docs.get("accountDeletions/client").status, "pending");
  assert.match(f.docs.get("accountDeletions/client").lastError, /Late Telegram avatar cleanup/);
  assert.equal(f.storageFiles.has("telegram-avatars/client/avatar.jpg"), true);
  const retry = await http("deleteUser", { uid: "client" });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.alreadyDeleted, undefined);
  assert.equal(f.storageFiles.has("telegram-avatars/client/avatar.jpg"), false);
  assert.equal(f.docs.get("accountDeletions/client").status, "completed");
});

test("failed final profile publication cleans its upload without deleting a concurrent newer generation", async t => {
  t.mock.method(console, "error", () => {});
  const { f, generations, uploadedGenerations, deletedGenerations } = avatarFixture(t);
  const transaction = f.db.runTransaction;
  f.db.runTransaction = async callback => {
    // Publication is the first transaction used by this avatar request. The
    // upload's exact response generation is already captured at this point.
    const own = uploadedGenerations[0];
    generations.set("newer", { path: own.path });
    throw new Error("Synthetic publication unavailable");
  };
  assert.equal((await http("telegramRefreshAvatar", {}, "client")).status, 500);
  assert.deepEqual(deletedGenerations, uploadedGenerations);
  assert.ok(generations.has("newer"));
  assert.equal(f.storageFiles.has("telegram-avatars/client/avatar.jpg"), true);
  assert.equal(f.docs.get("users/client").telegramAvatarUrl, undefined);
  f.db.runTransaction = transaction;
});

function loginPayload(token) {
  const payload = { id: "123", first_name: "Client", photo_url: "https://example.invalid/avatar.jpg", auth_date: Math.floor(Date.now() / 1000) };
  const text = Object.keys(payload).sort().map(key => `${key}=${payload[key]}`).join("\n");
  payload.hash = crypto.createHmac("sha256", crypto.createHash("sha256").update(token).digest()).update(text).digest("hex");
  return payload;
}

test("Telegram login fallback remains available to an active account without a downloadable avatar", async t => {
  const f = deletionFixture();
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ ok: true, result: { photos: [] } }) }));
  const response = await http("telegramLoginVerify", { telegramUser: loginPayload(f.telegramToken) }, "client");
  assert.equal(response.status, 200);
  assert.equal(response.data.telegram.avatarUrl, "https://example.invalid/avatar.jpg");
  assert.equal(f.docs.get("users/client").role, "client");
});

test("Telegram login verification after deletion also cannot recreate a profile through its fallback", async t => {
  t.mock.method(console, "error", () => {});
  const f = deletionFixture();
  let release, signal;
  const waiting = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { signal = resolve; });
  t.mock.method(globalThis, "fetch", async () => { signal(); await waiting; return { ok: true, json: async () => ({ ok: true, result: { photos: [] } }) }; });
  const verifying = http("telegramLoginVerify", { telegramUser: loginPayload(f.telegramToken) }, "client");
  await started;
  assert.equal((await http("deleteUser", { uid: "client" })).status, 200);
  release();
  assert.equal((await verifying).status, 403);
  assert.equal(f.docs.has("users/client"), false);
  assert.equal(f.docs.get("accountDeletions/client").status, "completed");
});
