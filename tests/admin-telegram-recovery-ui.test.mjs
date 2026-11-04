import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rolldown } from "rolldown";

const bundle = await rolldown({
  input: fileURLToPath(new URL("../src/components/admin/AdminWorkspace.jsx", import.meta.url)),
  platform: "node", transform: { jsx: { runtime: "automatic" } },
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{
    name: "test-admin-recovery-transport-boundaries",
    resolveId: id => /(?:\/firebase|\/apiClient)$/.test(id) ? `\0boundary:${id}` : null,
    load: id => id.endsWith(".css") ? { code: "export default {};", moduleType: "js" }
      : id.startsWith("\0boundary:") ? 'export const auth={currentUser:null}; export const fetchAuthorizedWithTimeout=()=>{throw new Error("Unexpected real I/O")};' : null
  }]
});
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
const { default: AdminWorkspace, requestAdminTelegramRecoveryLink, getAdminRecoveryAccountLabel } = module.exports;
const clients = [{ id: "client-original-uid", name: "Анна" }];

test("recovery labels distinguish same-name clients without displaying their complete email", () => {
  const first = getAdminRecoveryAccountLabel({ id: "original-user-11111111", name: "Анна", email: "anna@example.test" });
  const second = getAdminRecoveryAccountLabel({ id: "original-user-22222222", name: "Анна", email: "other@example.test" });
  assert.notEqual(first, second);
  assert.match(first, /Анна · an\*\*\*@example\.test · ID …11111111/);
  assert.doesNotMatch(first, /anna@example/);
  assert.match(getAdminRecoveryAccountLabel({ id: "uid", name: "Анна" }), /Email не указан · ID …uid/);
});

test("recovery action is visible only in an authorized users workspace with existing clients", () => {
  const render = props => renderToStaticMarkup(React.createElement(AdminWorkspace, { activeSection: "users", telegramRecoveryClients: clients, canRecoverTelegramAccess: true, ...props }));
  assert.match(render({}), /Восстановить вход через Telegram/);
  for (const props of [{ canRecoverTelegramAccess: false }, { activeSection: "overview" }, { telegramRecoveryClients: [] }]) {
    assert.doesNotMatch(render(props), /Восстановить вход через Telegram/);
  }
});

test("recovery requests bind the original UID and explicitly entered normalized username", async () => {
  const calls = [];
  const result = await requestAdminTelegramRecoveryLink("client-original-uid", " @Owner_Name ", async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ ok: true, code: "recovery-code", botStartUrl: "https://t.me/OwnsetBot?start=recovery-code", expiresAt: new Date(Date.now() + 600000).toISOString() }) };
  });
  assert.equal(result.expectedTelegramUsername, "owner_name");
  assert.equal(calls[0][0], "/api/telegram/create-link-code");
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][1].body), { targetUid: "client-original-uid", expectedTelegramUsername: "owner_name" });
});

test("missing UID and malformed usernames never dispatch a recovery request", async () => {
  let calls = 0;
  for (const [uid, name] of [["", "owner_name"], ["uid", ""], ["uid", "@abc"], ["uid", "@invalid space"], ["uid", "яusername"]]) {
    await assert.rejects(requestAdminTelegramRecoveryLink(uid, name, async () => { calls += 1; }));
  }
  assert.equal(calls, 0);
});

test("failed or unsafe/incomplete response cannot be displayed as a valid recovery link", async () => {
  const valid = { ok: true, code: "token", botStartUrl: "https://t.me/OwnsetBot?start=token", expiresAt: new Date(Date.now() + 600000).toISOString() };
  for (const override of [{ botStartUrl: "javascript:alert(1)" }, { botStartUrl: "https://evil.test/?start=token" }, { botStartUrl: "https://t.me/OwnsetBot?start=other" }, { expiresAt: "2000-01-01" }, { code: "" }]) {
    await assert.rejects(requestAdminTelegramRecoveryLink("uid", "owner_name", async () => ({ ok: true, json: async () => ({ ...valid, ...override }) })), /действующую ссылку/);
  }
  await assert.rejects(requestAdminTelegramRecoveryLink("uid", "owner_name", async () => ({ ok: false, status: 403, json: async () => ({ ok: false }) })), /права администратора/);
});
