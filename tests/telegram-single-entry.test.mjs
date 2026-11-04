import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as messages from "../functions/telegramReminderMessages.js";
import { buildTelegramInviteAppUrl, normalizeTelegramUsername } from "../functions/telegramClientInvite.js";
import { buildTelegramMenuButton, ensureTelegramAppMenu } from "../functions/telegramAppEntry.js";

const backend = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const canonical = "https://example.test/";
const syntheticToken = "synthetic-bot-token";
const telegramId = "123456789";
const inviteToken = "synthetic_invite_1234567890";
const linkCode = "synthetic_link_123456789012";

function endpoint(name, nextMarker, context) {
  const start = backend.indexOf(`export const ${name} = onRequest(`);
  const end = backend.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, `real ${name} endpoint source is present`);
  return vm.runInNewContext(`${backend.slice(start, end).replace("export const", "const")}\n${name}`, {
    console: { error() {}, warn() {} }, crypto, Buffer,
    onRequest: (_options, handler) => handler,
    TELEGRAM_BOT_TOKEN: { value: () => syntheticToken },
    getWorkoutAppUrl: () => canonical,
    json: (res, status, data) => Object.assign(res, { status, data }),
    ...context
  });
}

function containsWebApp(value) {
  return Boolean(value && typeof value === "object" && (Object.hasOwn(value, "web_app") || Object.values(value).some(containsWebApp)));
}

function webhookFixture({ inviteError = "", link = "missing", linkedStart = false } = {}) {
  const sent = [];
  const menus = [];
  const published = [];
  const documents = new Map();
  const client = { role: "client", active: true, telegram: { chatId: telegramId, telegramUserId: telegramId } };
  if (link !== "missing") {
    documents.set(`telegramLinkCodes/${crypto.createHash("sha256").update(linkCode).digest("hex")}`, {
      uid: "synthetic-client", status: "active", expiresAt: "2099-01-01T00:00:00Z"
    });
    documents.set("users/synthetic-client", client);
  }
  if (linkedStart) documents.set(`telegramIdentities/${telegramId}`, { uid: "synthetic-client" });
  const firestore = () => ({ collection: name => ({ doc: id => ({
    get: async () => ({ id, exists: documents.has(`${name}/${id}`), data: () => documents.get(`${name}/${id}`) })
  }) }) });
  firestore.FieldValue = { serverTimestamp: () => "synthetic-timestamp", delete: () => "synthetic-delete" };
  const handler = endpoint("telegramWebhook", "function normalizeSearchString", {
    ...messages, buildTelegramInviteAppUrl,
    admin: { firestore },
    isActiveMemberData: data => data?.role === "client" && data.active !== false,
    findTelegramLinkedAccounts: async () => linkedStart ? [{ uid: "synthetic-client", data: client }] : [],
    publishTelegramProfile: async (...args) => {
      published.push(args);
      if (link === "rejected") throw new Error("Synthetic canonical binding rejection");
    },
    startTelegramClientInvite: async token => {
      assert.equal(token, inviteToken);
      return inviteError ? { error: inviteError, targetUsername: "synthetic_user" } : {};
    },
    sendTelegramMessage: async payload => { sent.push(payload); },
    ensureTelegramAppMenu: async options => { menus.push(options); return { ok: true, result: true }; }
  });
  return {
    sent, menus, published,
    async invoke(text) {
      const secret = crypto.createHash("sha256").update(syntheticToken).digest("hex");
      const response = {};
      await handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": secret }, body: { message: {
        from: { id: Number(telegramId), first_name: "Synthetic", username: "synthetic_user" },
        chat: { id: Number(telegramId), type: "private" }, text
      } } }, response);
      assert.equal(response.status, 200);
      assert.equal(sent.length, 1, "the real branch reached its reply, not a swallowed fixture exception");
      assert.ok(sent[0].text);
      return response;
    }
  };
}

test("menu builder returns the single HTTPS canonical app entry", () => {
  assert.deepEqual(buildTelegramMenuButton("https://EXAMPLE.test"), {
    type: "web_app", text: "Открыть приложение", web_app: { url: canonical }
  });
  for (const invalid of ["", "not a URL", "http://example.test/", "javascript:alert(1)", "https://user:password@example.test/"]) {
    assert.throws(() => buildTelegramMenuButton(invalid));
  }
});

for (const chatId of [undefined, 123456789]) {
  test(`menu setter sends one canonical menu payload (${chatId ? "private chat" : "default menu"})`, async () => {
    const requests = [];
    await ensureTelegramAppMenu({ token: syntheticToken, url: canonical, ...(chatId ? { chatId } : {}) }, async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ ok: true, result: true }) };
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `https://api.telegram.org/bot${syntheticToken}/setChatMenuButton`);
    assert.equal(requests[0].options.method, "POST");
    const payload = JSON.parse(requests[0].options.body);
    assert.deepEqual(payload.menu_button, buildTelegramMenuButton(canonical));
    if (chatId) assert.equal(String(payload.chat_id), String(chatId));
    else assert.equal(Object.hasOwn(payload, "chat_id"), false);
  });
}

for (const failure of ["http", "telegram", "transport"]) {
  test(`menu setter reports sanitized ${failure} errors rather than claiming success`, async () => {
    await assert.rejects(ensureTelegramAppMenu({ token: syntheticToken, url: canonical }, async () => {
      if (failure === "transport") throw new Error(`Network failure https://api.telegram.org/bot${syntheticToken}/setChatMenuButton`);
      return { ok: failure !== "http", json: async () => ({ ok: false, description: `Synthetic ${syntheticToken}` }) };
    }), error => {
      assert.doesNotMatch(String(error.message), /synthetic-bot-token|https:\/\/api\.telegram\.org/);
      return true;
    });
  });
}

for (const linkedStart of [false, true]) {
  test(`ordinary /start has no second inline app entry (${linkedStart ? "linked account" : "new visitor"})`, async () => {
    const f = webhookFixture({ linkedStart });
    await f.invoke("/start");
    assert.equal(containsWebApp(f.sent[0].replyMarkup), false);
    assert.equal(f.published.length, linkedStart ? 1 : 0);
  });
}

for (const command of ["/app", "/help", "/settings"]) {
  test(`quick reply ${command} has no second inline app entry`, async () => {
    const f = webhookFixture();
    await f.invoke(command);
    assert.equal(containsWebApp(f.sent[0].replyMarkup), false);
  });
}

test("successful client invitation keeps its explicit token-bearing acceptance action", async () => {
  const f = webhookFixture();
  await f.invoke(`/start invite_${inviteToken}`);
  const buttons = f.sent[0].replyMarkup.inline_keyboard.flat();
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].text, "Принять приглашение");
  const url = new URL(buttons[0].web_app.url);
  assert.equal(url.origin, new URL(canonical).origin);
  assert.equal(url.searchParams.get("telegramInvite"), inviteToken);
});

test("an invitation error has no generic inline app button", async () => {
  const f = webhookFixture({ inviteError: "telegram-invite-expired" });
  await f.invoke(`/start invite_${inviteToken}`);
  assert.equal(containsWebApp(f.sent[0].replyMarkup), false);
});

for (const link of ["active", "missing", "rejected"]) {
  test(`account-link ${link} reply has no generic inline app button`, async () => {
    const f = webhookFixture({ link });
    await f.invoke(`/start ${linkCode}`);
    assert.equal(containsWebApp(f.sent[0].replyMarkup), false);
    assert.equal(f.published.length, link === "missing" ? 0 : 1);
    assert.match(f.sent[0].text, link === "active" ? /Telegram подключён/ : /Не получилось подключить/);
  });
}

for (const [httpOk, webhookOk] of [[true, true], [false, false], [true, false]]) {
  test(`setWebhook HTTP=${httpOk}, Telegram=${webhookOk} ${webhookOk ? "installs" : "does not install"} the default canonical app menu`, async () => {
    const menus = [];
    const responseBody = { ok: webhookOk, result: webhookOk };
    const handler = endpoint("telegramSetWebhook", "export const telegramWebhook", {
      normalizeTelegramUsername,
      requireActiveMember: async () => ({ uid: "synthetic-admin", token: { admin: true } }),
      assertAdminContext() {}, enforceRateLimit: async () => {},
      getTelegramBotUsername: () => "synthetic_bot", getTelegramWebhookUrl: () => "https://functions.example.test/webhook",
      getHttpErrorStatus: () => 500,
      fetch: async url => {
        if (url.endsWith("/getMe")) return { ok: true, json: async () => ({ ok: true, result: { username: "synthetic_bot" } }) };
        assert.ok(url.endsWith("/setWebhook"));
        return { ok: httpOk, json: async () => responseBody };
      },
      ensureTelegramAppMenu: async options => { menus.push(options); return { ok: true, result: true }; }
    });
    const response = {};
    await handler({ method: "POST" }, response);
    assert.equal(response.status, httpOk ? 200 : 500);
    assert.equal(response.data, responseBody, "the existing webhook response contract is preserved");
    assert.equal(menus.length, webhookOk ? 1 : 0);
    if (webhookOk) {
      assert.equal(menus[0].url, canonical);
      assert.equal(menus[0].token, syntheticToken);
      assert.equal(Object.hasOwn(menus[0], "chatId"), false);
    }
  });
}
