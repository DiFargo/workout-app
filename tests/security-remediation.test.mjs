import assert from "node:assert/strict";
import crypto from "node:crypto";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

// Import the entire production module and its domain helpers. Only Firebase
// transport/trigger registration and Telegram network I/O are substituted.
// No extracted handler strings, source regex assertions or real accounts.
let fixture;
class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const firestore = Object.assign(() => fixture.db, { FieldValue: {
  serverTimestamp: () => "2026-10-08T10:00:00.000Z", delete: () => ({ deleteField: true })
} });
const admin = { initializeApp() {}, firestore, auth: () => fixture.auth,
  storage: () => ({ bucket: (name) => { fixture.bucketNames.push(name); return fixture.bucket; } }),
  app: () => ({ options: { projectId: "demo-security-remediation" } }) };
const token = `security-runtime-${crypto.randomUUID()}`;
globalThis[token] = { admin, HttpsError, secret: () => fixture.telegramToken };
const source = {
  "firebase-admin": `export default globalThis[${JSON.stringify(token)}].admin;`,
  "firebase-functions/v2/https": `export const HttpsError = globalThis[${JSON.stringify(token)}].HttpsError;
    export const onRequest = (_options, handler) => handler;
    export const onCall = (_options, handler) => handler;`,
  "firebase-functions/v2/scheduler": "export const onSchedule = (_options, handler) => handler;",
  "firebase-functions/v2/firestore": "export const onDocumentCreated = (_options, handler) => handler; export const onDocumentDeleted = onDocumentCreated;",
  "firebase-functions/v2/storage": "export const onObjectFinalized = (_options, handler) => handler;",
  "firebase-functions/params": `export const defineBoolean = (_name, options) => ({ value: () => options.default });
    export const storageBucket = { value: () => "demo-security-remediation.firebasestorage.app" };
    export const defineString = (name, options) => ({ value: () => name === "WORKOUT_WEB_API_KEY" ? "synthetic-web-api-key" : options.default });
    export const defineSecret = () => ({ value: globalThis[${JSON.stringify(token)}].secret });`
};
const hook = registerHooks({ resolve(specifier, context, next) {
  if (source[specifier]) return { url: `data:text/javascript,${encodeURIComponent(source[specifier])}`, shortCircuit: true };
  return next(specifier, context);
} });
const handlers = await import("../functions/index.js");
after(() => { hook.deregister(); delete globalThis[token]; });

const valueAt = (data, key) => key.split(".").reduce((value, part) => value?.[part], data);
function createFixture(extraDocs = {}) {
  const docs = new Map(Object.entries({
    "users/adminA": { role: "admin" }, "users/adminB": { role: "admin" },
    "users/client": { role: "client", email: "client@example.test", loginLower: "clientlogin", trainerId: "trainer" },
    "users/trainer": { role: "trainer" }, ...extraDocs
  }).map(([path, data]) => [path, structuredClone(data)]));
  const calls = [], bucketNames = [], storageFiles = new Set(), createTimes = new Map();
  const authUsers = new Map([...docs].filter(([path]) => /^users\/[^/]+$/.test(path)).map(([path, data]) => {
    const uid = path.split("/")[1];
    return [uid, { uid, email: data.email, customClaims: { admin: data.role === "admin", keep: "preserved" }, tokensValidAfterTime: "1970-01-01T00:00:00Z" }];
  }));
  const tokens = new Map([...authUsers].map(([uid, user]) => [uid, { uid, admin: user.customClaims.admin, auth_time: 400 }]));
  const f = { docs, calls, authUsers, tokens, bucketNames, storageFiles, createTimes, telegramToken: "synthetic-bot-token",
    failStoragePrefix: "", failRecursiveDeleteAfterRemoval: false, failCompletedWrite: false, failRevoke: false };
  function write(path, patch, options = {}) {
    if (f.failCompletedWrite && path.startsWith("accountDeletions/") && patch.status === "completed") {
      f.failCompletedWrite = false; throw new Error("Synthetic completion write failure");
    }
    const data = options.merge || options.mergeFields ? structuredClone(docs.get(path) || {}) : {};
    const assign = (target, parts, value) => {
      const key = parts[0];
      if (parts.length > 1) {
        if (!target[key] || typeof target[key] !== "object") target[key] = {};
        assign(target[key], parts.slice(1), value);
      } else if (value?.deleteField) delete target[key];
      else target[key] = structuredClone(value);
    };
    const merge = (target, update) => {
      for (const [key, value] of Object.entries(update)) {
        if (value?.deleteField) delete target[key];
        else if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) {
          if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
          merge(target[key], value);
        } else target[key] = structuredClone(value);
      }
    };
    // Firestore merge:true writes nested leaves; mergeFields:["telegram"]
    // replaces that complete map. Shallow spread concealed unlink regressions.
    if (options.mergeFields) {
      for (const field of options.mergeFields) assign(data, field.split("."), valueAt(patch, field));
    } else if (options.merge) merge(data, patch);
    else merge(data, patch);
    docs.set(path, data); calls.push(["set", path, structuredClone(patch)]);
  }
  function snapshot(path) {
    const data = structuredClone(docs.get(path));
    return { id: path.split("/").at(-1), ref: doc(path), exists: docs.has(path),
      createTime: createTimes.get(path), data: () => structuredClone(data) };
  }
  function doc(path) {
    return { path, get: async () => snapshot(path), set: async (data, options) => write(path, data, options),
      delete: async () => { calls.push(["delete", path]); docs.delete(path); }, collection: (name) => collection(`${path}/${name}`) };
  }
  function collection(path, filters = [], max = Infinity) {
    return { doc: (id = `auto-${calls.length}`) => doc(`${path}/${id}`),
      where: (key, op, value) => { assert.equal(op, "=="); return collection(path, [...filters, [key, value]], max); },
      orderBy: () => collection(path, filters, max),
      limit: (limit) => collection(path, filters, limit),
      get: async () => {
        calls.push(["query", path, filters]);
        const entries = [...docs].filter(([key, data]) => key.startsWith(path + "/") && key.split("/").length === path.split("/").length + 1 && filters.every(([field, value]) => valueAt(data, field) === value)).slice(0, max);
        const found = entries.map(([key]) => snapshot(key));
        return { docs: found, size: found.length, empty: found.length === 0, forEach: (fn) => found.forEach(fn) };
      },
      add: async (data) => { const pathWithId = `${path}/message-${calls.length}`; write(pathWithId, data); return doc(pathWithId); } };
  }
  f.db = { collection, doc,
    batch: () => { const queued = []; return { set: (...args) => queued.push(args), commit: async () => { for (const [ref, data, options] of queued) write(ref.path, data, options); } }; },
    runTransaction: async (fn) => {
      const writes = [];
      const result = await fn({ get: (ref) => ref.get(),
        set: (ref, data, options) => writes.push(() => write(ref.path, data, options)),
        create: (ref, data) => writes.push(() => write(ref.path, data)),
        delete: (ref) => writes.push(() => { calls.push(["delete", ref.path]); docs.delete(ref.path); }) });
      writes.forEach(commit => commit());
      return result;
    },
    recursiveDelete: async (ref) => {
      calls.push(["recursiveDelete", ref.path]);
      for (const path of [...docs.keys()]) if (path === ref.path || path.startsWith(ref.path + "/")) docs.delete(path);
      if (f.failRecursiveDeleteAfterRemoval) { f.failRecursiveDeleteAfterRemoval = false; throw new Error("Synthetic recursive delete failure"); }
    } };
  f.auth = {
    verifyIdToken: async (idToken, checkRevoked) => {
      calls.push(["verifyIdToken", idToken, checkRevoked]);
      const decoded = tokens.get(idToken), user = decoded && authUsers.get(decoded.uid);
      if (!decoded || !user || (checkRevoked && (user.disabled || decoded.auth_time < Date.parse(user.tokensValidAfterTime) / 1000))) {
        throw Object.assign(new Error("Firebase ID token revoked or invalid"), { code: "auth/id-token-revoked" });
      }
      return structuredClone(decoded);
    },
    getUser: async (uid) => {
      calls.push(["getUser", uid]);
      if (!authUsers.has(uid)) throw Object.assign(new Error("Missing account"), { code: "auth/user-not-found" });
      return structuredClone(authUsers.get(uid));
    },
    updateUser: async (uid, patch) => Object.assign(authUsers.get(uid), patch),
    setCustomUserClaims: async (uid, claims) => { calls.push(["setCustomUserClaims", uid]); authUsers.get(uid).customClaims = claims; },
    revokeRefreshTokens: async (uid) => {
      calls.push(["revokeRefreshTokens", uid]); if (f.failRevoke) throw new Error("Synthetic Auth unavailable");
      authUsers.get(uid).tokensValidAfterTime = "1970-01-01T00:08:20Z";
    },
    deleteUser: async (uid) => { calls.push(["authDelete", uid]); authUsers.delete(uid); }
  };
  f.bucket = { deleteFiles: async (options) => {
    calls.push(["deleteFiles", options]);
    const targetUid = options.prefix.split("/")[1];
    assert.equal(docs.get(`users/${targetUid}`)?.accessDisabled ?? true, true, "uploads must be blocked before Storage cleanup");
    if (f.failStoragePrefix === options.prefix) { f.failStoragePrefix = ""; throw new Error("Synthetic Storage unavailable"); }
    for (const path of [...storageFiles]) if (path.startsWith(options.prefix)) storageFiles.delete(path);
  } };
  fixture = f;
  return f;
}
const callable = (uid, data, auth_time = 400) => ({ auth: { uid, token: { admin: true, auth_time } }, data });
function seedTelegramLinkCode(f, { uid = "client", code, ...options }) {
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  f.docs.set(`telegramLinkCodes/${hash}`, { uid, status: "active", createdByUid: uid,
    expiresAt: "2099-01-01T00:00:00Z", ...options });
  f.docs.set(`telegramLinkCodes/owner_${uid}`, { uid, activeCodeHash: hash });
}
async function http(name, body = {}, uid = "adminA", extra = {}) {
  const res = { status(code) { this.code = code; return this; }, set() { return this; }, send(payload) { this.payload = JSON.parse(payload); return this; } };
  await handlers[name]({ method: "POST", headers: { authorization: `Bearer ${uid}` }, body, ...extra }, res);
  return { status: res.code, data: res.payload };
}

test("admin demotion denies old claims to actual HTTP/callable handlers and preserves other claims", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = createFixture();
  const result = await handlers.setAdminClaim(callable("adminA", { uid: "adminB", admin: false }));
  assert.equal(result.admin, false);
  assert.equal(f.docs.get("users/adminB").role, "client");
  assert.equal(f.authUsers.get("adminB").customClaims.admin, false);
  assert.equal(f.authUsers.get("adminB").customClaims.keep, "preserved");
  assert.equal(f.authUsers.get("adminB").customClaims.adminClaimVersion, f.docs.get("users/adminB").adminClaimVersion);
  assert.equal(typeof f.docs.get("users/adminB").adminClaimVersion, "string");
  assert.ok(f.calls.some(([name, uid]) => name === "revokeRefreshTokens" && uid === "adminB"));
  assert.equal((await http("deleteUser", { uid: "client" }, "adminB")).status, 401);
  assert.equal(f.calls.filter(([name]) => name === "verifyIdToken").at(-1)[2], true);
  await assert.rejects(handlers.setAdminClaim(callable("adminB", { uid: "client", admin: true })), { code: "unauthenticated" });
  assert.ok(f.docs.has("users/client"));
});

test("demotion stays denied through server role even if Auth revocation fails", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = createFixture(); f.failRevoke = true;
  await assert.rejects(handlers.setAdminClaim(callable("adminA", { uid: "adminB", admin: false })), /Auth unavailable/);
  assert.equal((await http("deleteUser", { uid: "client" }, "adminB")).status, 403);
  assert.equal((await http("trainerExerciseCards", { action: "list" }, "adminB")).status, 403, "imported downstream library helper cannot trust an old claim");
  await assert.rejects(handlers.setAdminClaim(callable("adminB", { uid: "client", admin: true })), { code: "permission-denied" });
  assert.ok(f.docs.has("users/client"));
});

test("re-promoting an admin cannot revive an older claim version; a freshly issued claim works", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = createFixture();
  await handlers.setAdminClaim(callable("adminA", { uid: "adminB", admin: false }));
  const revokedVersion = f.docs.get("users/adminB").adminClaimVersion;
  await handlers.setAdminClaim(callable("adminA", { uid: "adminB", admin: true }));
  assert.notEqual(f.docs.get("users/adminB").adminClaimVersion, revokedVersion);
  // Model a valid non-revoked session which still carries obsolete claims.
  f.tokens.get("adminB").auth_time = 600;
  assert.equal((await http("trainerExerciseCards", { action: "list" }, "adminB")).status, 403);
  await assert.rejects(handlers.setAdminClaim(callable("adminB", { uid: "client", admin: true }, 600)), { code: "permission-denied" });
  const newClaims = f.authUsers.get("adminB").customClaims;
  f.tokens.set("adminB", { uid: "adminB", auth_time: 600, ...newClaims });
  assert.equal((await http("trainerExerciseCards", { action: "list" }, "adminB")).status, 200);
  await handlers.setAdminClaim({ auth: { uid: "adminB", token: { auth_time: 600, ...newClaims } }, data: { uid: "client", admin: true } });
  assert.equal(f.docs.get("users/client").role, "admin");
});

test("fresh admin can grant claims; revoked/disabled callable admins and role-only clients cannot", async () => {
  const f = createFixture();
  await handlers.setAdminClaim(callable("adminA", { uid: "client", admin: true }));
  assert.equal(f.docs.get("users/client").role, "admin");
  assert.equal(f.authUsers.get("client").customClaims.admin, true);
  f.authUsers.get("adminA").tokensValidAfterTime = "1970-01-01T00:08:20Z";
  await assert.rejects(handlers.setAdminClaim(callable("adminA", { uid: "trainer", admin: true })), { code: "unauthenticated" });
  f.authUsers.get("adminA").disabled = true;
  await assert.rejects(handlers.setAdminClaim(callable("adminA", { uid: "trainer", admin: true }, 600)), { code: "unauthenticated" });
  await assert.rejects(handlers.setAdminClaim({ auth: { uid: "client", token: { auth_time: 600 } }, data: { uid: "trainer", admin: true } }), { code: "permission-denied" });
  assert.equal(f.docs.get("users/trainer").role, "trainer");
});

async function telegram(message, secret) {
  const expected = crypto.createHash("sha256").update(fixture.telegramToken).digest("hex");
  return http("telegramWebhook", { message }, "", { headers: { "x-telegram-bot-api-secret-token": secret ?? expected } });
}
const privateMessage = () => ({ from: { id: 123 }, chat: { id: 123, type: "private" }, message_id: 456, text: "Личное сообщение" });
test("private Telegram /start points to the persistent menu without a duplicate Mini App button", async (t) => {
  createFixture();
  let sentPayload = null;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    sentPayload = JSON.parse(init.body);
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 789 } }) };
  });

  const result = await telegram({
    ...privateMessage(),
    from: { id: 123, first_name: "Илья" },
    text: "/start"
  });

  assert.equal(result.status, 200);
  assert.match(sentPayload.text, /Привет, Илья!/);
  assert.match(sentPayload.text, /помощник по тренировкам и прогрессу/);
  assert.equal(sentPayload.parse_mode, "HTML");
  assert.match(sentPayload.text, /«Открыть приложение» слева от поля сообщения/);
  assert.equal(sentPayload.reply_markup, undefined);
});

test("plain /start connects the private bot chat to one already-linked active account", async (t) => {
  const f = createFixture({
    "users/client": {
      role: "client",
      telegramConnected: true,
      telegramUserId: "123",
      telegram: { connected: true, telegramUserId: "123", notificationsEnabled: true }
    },
    "telegramIdentities/123": { uid: "client", telegramUserId: "123" }
  });
  let sentPayload = null;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    sentPayload = JSON.parse(init.body);
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 790 } }) };
  });

  const result = await telegram({ ...privateMessage(), text: "/start" });

  assert.equal(result.status, 200);
  assert.equal(f.docs.get("users/client").telegram.chatId, "123");
  assert.equal(f.docs.get("users/client").telegramChatId, "123");
  assert.match(sentPayload.text, /Telegram подключён/);
});

test("plain /start never auto-links a Telegram identity shared by multiple accounts", async (t) => {
  const f = createFixture({
    "users/client": { role: "client", telegramUserId: "123", telegram: { telegramUserId: "123" } },
    "users/another-client": { role: "client", telegramUserId: "123", telegram: { telegramUserId: "123" } }
  });
  let sentPayload = null;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    sentPayload = JSON.parse(init.body);
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 791 } }) };
  });

  await telegram({ ...privateMessage(), text: "/start" });

  assert.equal(f.docs.get("users/client").telegram.chatId, undefined);
  assert.equal(f.docs.get("users/another-client").telegram.chatId, undefined);
  assert.match(sentPayload.text, /Профиль → Telegram/);
});

test("Telegram help and settings commands reply privately with a clear app entry point", async (t) => {
  const f = createFixture({
    "users/client": {
      role: "client",
      telegram: { connected: true, chatId: "123", telegramUserId: "123" },
      telegramChatId: "123",
      telegramUserId: "123"
    }
  });
  const sentPayloads = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    sentPayloads.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ ok: true, result: { message_id: sentPayloads.length } }) };
  });

  for (const [text, heading] of [
    ["/help@zmena_teleg_bot", "Как начать"],
    ["настройки", "Настройки напоминаний"],
    ["/app", "Приложение ZMENA"]
  ]) {
    assert.equal((await telegram({ ...privateMessage(), text })).status, 200);
    assert.match(sentPayloads.at(-1).text, new RegExp(heading));
    assert.equal(sentPayloads.at(-1).parse_mode, "HTML");
    assert.equal(sentPayloads.at(-1).reply_markup, undefined);
  }

  assert.equal([...f.docs.keys()].filter((path) => path.includes("telegramMessages")).length, 0);
  assert.equal((await telegram({ ...privateMessage(), chat: { id: -12, type: "group" }, text: "/help" })).status, 200);
  assert.equal(sentPayloads.length, 3, "group commands must not receive a personal bot reply");
});

test("due progress reminders point to the existing menu without another Mini App button", async (t) => {
  const now = new Date();
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(now);
  const reminderTime = `${timeParts.find((part) => part.type === "hour")?.value}:${timeParts.find((part) => part.type === "minute")?.value}`;
  createFixture({
    "users/client": {
      role: "client",
      telegramConnected: true,
      telegram: { chatId: "123", telegramUserId: "123", notificationsEnabled: true },
      workoutCalendar: {
        progressReminderSettings: {
          photoEnabled: true,
          weightEnabled: true,
          measurementsEnabled: true,
          photoIntervalDays: 14,
          weightIntervalDays: 7,
          measurementsIntervalDays: 30,
          reminderTime,
          startedAt: "2026-09-01"
        }
      }
    }
  });
  const sentPayloads = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    sentPayloads.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ ok: true, result: { message_id: sentPayloads.length } }) };
  });

  await handlers.telegramDailyWorkoutReminders();

  assert.equal(sentPayloads.length, 3);
  assert.ok(sentPayloads.every((payload) => payload.parse_mode === "HTML"));
  assert.ok(sentPayloads.every((payload) => payload.reply_markup === undefined));
  assert.ok(sentPayloads.every((payload) => /«Открыть приложение» слева от поля сообщения/.test(payload.text)));
  assert.ok(sentPayloads.some((payload) => /фото прогресса/i.test(payload.text)));
  assert.ok(sentPayloads.some((payload) => /взвеситься/i.test(payload.text)));
  assert.ok(sentPayloads.some((payload) => /замеры тела/i.test(payload.text)));
});

test("workout reminder delivery formats the message and refers to the persistent menu", async (t) => {
  createFixture({
    "users/client": {
      role: "client",
      telegramConnected: true,
      telegramNotificationsEnabled: true,
      telegram: { chatId: "123", telegramUserId: "123", notificationsEnabled: true },
      workoutCalendar: {}
    },
    "users/client/workouts/day_1": { name: "Ноги <A&B>", exercises: [{}, {}] }
  });
  let sentPayload = null;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    sentPayload = JSON.parse(init.body);
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 321 } }) };
  });

  const result = await http("telegramTestWorkoutReminder", {}, "client");

  assert.equal(result.status, 200);
  assert.match(sentPayload.text, /Проверка напоминаний/);
  assert.match(sentPayload.text, /Ноги &lt;A&amp;B&gt;/);
  assert.match(sentPayload.text, /В плане 2 упражнения/);
  assert.equal(sentPayload.parse_mode, "HTML");
  assert.match(sentPayload.text, /«Открыть приложение» — слева от поля сообщения/);
  assert.equal(sentPayload.reply_markup, undefined);
});

test("Telegram accepts linked private text and excludes group/channel/foreign/unlinked/inactive sources", async () => {
  const f = createFixture({
    "users/client": { role: "client", telegram: { telegramUserId: "123", chatId: "123", connected: true } },
    "telegramIdentities/123": { uid: "client", telegramUserId: "123" }
  });
  assert.equal((await telegram(privateMessage())).status, 200);
  const messages = () => [...f.docs].filter(([path]) => path.startsWith("users/client/telegramMessages/"));
  assert.equal(messages().length, 1); assert.equal(messages()[0][1].text, "Личное сообщение");
  for (const chat of [{ id: -1, type: "group" }, { id: -2, type: "supergroup" }, { id: -3, type: "channel" }, { id: 999, type: "private" }]) {
    assert.equal((await telegram({ ...privateMessage(), chat })).status, 200);
  }
  f.docs.get("users/client").telegram.chatId = "999";
  await telegram(privateMessage());
  f.docs.get("users/client").telegram.chatId = "123";
  f.docs.get("users/client").accessDisabled = true;
  await telegram(privateMessage());
  assert.equal(messages().length, 1);
  assert.equal((await telegram(privateMessage(), "wrong")).status, 401);
});

test("Telegram private /start linking still works and consumes the code", async (t) => {
  const code = "123456789012345678901234";
  const f = createFixture({ "users/client": { role: "client", telegramLinkCode: code, telegramLinkCodeExpiresAt: "2099-01-01T00:00:00Z" } });
  seedTelegramLinkCode(f, { code });
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ ok: true, result: { photos: [] } }) }));
  await telegram({ ...privateMessage(), text: `/start ${code}` });
  const profile = f.docs.get("users/client");
  assert.equal(profile.telegram.chatId, "123"); assert.equal(profile.telegram.telegramUserId, "123");
  assert.equal(profile.telegramLinkCode, undefined);
  assert.equal((await telegram(privateMessage())).status, 200);
  assert.equal([...f.docs.keys()].filter((path) => path.includes("telegramMessages")).length, 1);
});

function deletionFixture() {
  const f = createFixture({
    "users/client/history/one": { value: "private" }, "users/trainer/trainerClients/client": { name: "Client" },
    "loginAliases/clientlogin": { uid: "client" }, "clientInvites/client@example.test": { authUid: "client" },
    "inviteLinks/link": { email: "client@example.test", uid: "client" }
  });
  for (const path of ["users/client/profile/avatar.png", "progress-photos/client/session/front.webp", "feedback/client/one/file.pdf", "telegram-avatars/client/avatar.jpg", "progress-photos/client-other/session/front.webp", "users/trainer/profile/avatar.png", "exercise-videos/client/program/video.mp4", "template-exercise-videos/trainer/program/video.mp4"]) f.storageFiles.add(path);
  return f;
}
function assertDeleted(f) {
  assert.equal(f.docs.has("users/client"), false); assert.equal(f.authUsers.has("client"), false);
  assert.equal(f.docs.has("users/client/history/one"), false);
  for (const path of ["users/trainer/trainerClients/client", "loginAliases/clientlogin", "clientInvites/client@example.test", "inviteLinks/link"]) assert.equal(f.docs.has(path), false, path);
  assert.deepEqual([...f.storageFiles].sort(), ["exercise-videos/client/program/video.mp4", "progress-photos/client-other/session/front.webp", "template-exercise-videos/trainer/program/video.mp4", "users/trainer/profile/avatar.png"].sort());
  assert.equal(f.docs.get("accountDeletions/client").status, "completed");
  assert.equal(f.docs.get("accountDeletions/client").cleanupPaths, undefined);
}
test("admin deletion cleans all personal object versions and data while retaining neighbours and exercise assets", async () => {
  const f = deletionFixture();
  assert.equal((await http("deleteUser", { uid: "client" })).status, 200); assertDeleted(f);
  for (const [, options] of f.calls.filter(([name]) => name === "deleteFiles")) {
    assert.equal(options.force, true); assert.equal(options.ignoreNotFound, true); assert.equal(options.versions, true);
    assert.ok(options.prefix.endsWith("/"));
  }
  assert.deepEqual(f.bucketNames, ["demo-security-remediation.firebasestorage.app"]);
  const count = f.calls.filter(([name]) => name === "deleteFiles").length;
  assert.equal((await http("deleteUser", { uid: "client" })).data.alreadyDeleted, true);
  assert.equal(f.calls.filter(([name]) => name === "deleteFiles").length, count);
});

test("Storage and post-profile failures remain pending and complete on retry without Auth/profile", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const kind of ["storage", "recursive", "completion"]) {
    const f = deletionFixture();
    if (kind === "storage") f.failStoragePrefix = "feedback/client/";
    if (kind === "recursive") f.failRecursiveDeleteAfterRemoval = true;
    if (kind === "completion") f.failCompletedWrite = true;
    assert.equal((await http("deleteUser", { uid: "client" })).status, 500, kind);
    assert.equal(f.docs.get("accountDeletions/client").status, "pending");
    assert.equal(f.authUsers.has("client"), false);
    if (kind === "storage") assert.equal(f.docs.get("users/client").accessDisabled, true);
    else assert.equal(f.docs.has("users/client"), false);
    assert.equal((await http("deleteUser", { uid: "client" })).status, 200, kind); assertDeleted(f);
  }
});

test("client deletion rejects self, non-client, malformed UID and non-admin before Storage work", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = deletionFixture();
  for (const [uid, expected] of [["adminA", 400], ["trainer", 409], ["missing", 404], ["client/other", 400], ["", 400]]) {
    assert.equal((await http("deleteUser", { uid })).status, expected, uid);
  }
  assert.equal((await http("deleteUser", { uid: "client" }, "trainer")).status, 403);
  assert.equal(f.calls.some(([name]) => name === "deleteFiles" || name === "authDelete"), false);
  assert.ok(f.docs.has("users/client"));
});

// Share only synthetic I/O fixtures with the independently added avatar race
// regressions; both suites continue importing the actual production handlers.
export { handlers, createFixture, deletionFixture, http, seedTelegramLinkCode };
