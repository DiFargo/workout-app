import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rolldown } from "rolldown";
import { getAdminAttentionFilter, matchesAdminAttentionFilter } from "../src/components/admin/adminAttentionQueue.js";

const source = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({ input: "admin-ux-remediation-entry", platform: "node",
  transform: { jsx: { runtime: "automatic" } }, external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{ name: "admin-ux-remediation", resolveId: id => id === "admin-ux-remediation-entry" ? id : null,
    load: id => id.endsWith(".css") ? { code: "export default {};", moduleType: "js" }
      : id === "admin-ux-remediation-entry" ? { moduleType: "js", code: `
        export {default as Users,getAdminUserRole,getAdminAccountStatus} from ${source("components/admin/AdminUsersWorkspace.jsx")};
        export {default as Telegram} from ${source("features/client/profile/ProfileTelegramModal.jsx")};
        export {AppStartupGate} from ${source("app/appStartupGate.jsx")};` } : null }]
});
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
const { Users, getAdminUserRole, getAdminAccountStatus, Telegram, AppStartupGate } = module.exports;
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const users = [
  { id: "pending-client", name: "Нужен тренер", role: "client", accountAccessStatus: "awaiting_trainer" },
  { id: "assigned-client", name: "Уже назначен", role: "client", assignedTrainerId: "active-trainer" },
  { id: "suspended-client", name: "Ограниченный клиент", role: "client", membershipStatus: "suspended" },
  { id: "pending-trainer", name: "Приглашённый тренер", role: "trainer", accountStatus: "pending" },
  { id: "suspended-trainer", name: "Приостановленный тренер", role: "trainer", membershipStatus: "suspended" },
  { id: "active-trainer", name: "Работающий тренер", role: "trainer" }
];

test("overview and actual directory use identical queue membership without broadening to another role", () => {
  for (const [filterId, expectedId, expectedName] of [
    ["unassigned-clients", "pending-client", "Нужен тренер"],
    ["pending-invites", "pending-trainer", "Приглашённый тренер"],
    ["suspended-trainers", "suspended-trainer", "Приостановленный тренер"]
  ]) {
    const filter = getAdminAttentionFilter(filterId);
    const matches = users.filter(user => matchesAdminAttentionFilter(user, filterId, getAdminUserRole(user), getAdminAccountStatus(user).id));
    assert.deepEqual(matches.map(user => user.id), [expectedId]);
    const markup = render(Users, { users, activeRole: filter.role, attentionFilter: filterId, onClearAttentionFilter() {} });
    assert.ok(markup.includes(expectedName));
    for (const user of users.filter(user => user.id !== expectedId)) assert.equal(markup.includes(user.name), false);
    assert.ok(markup.includes(filter.title));
    assert.ok(markup.includes("Снять фильтр очереди"));
  }
});

test("clearing a queue restores the normal directory; unsupported keys never create a hidden filter", () => {
  for (const key of ["", "all", "__proto__", "unknown"]) {
    assert.equal(getAdminAttentionFilter(key), null);
    assert.equal(matchesAdminAttentionFilter(users[0], key, "client", "pending"), true);
  }
  const markup = render(Users, { users });
  for (const user of users) assert.ok(markup.includes(user.name));
  assert.equal(markup.includes("Снять фильтр очереди"), false);
});

test("connected Telegram initial UI remains truthful and rendering never disconnects or issues a link", () => {
  let operations = 0;
  const markup = render(Telegram, { open: true, telegramProfile: { connected: true, username: "synthetic", telegramUserId: "111" },
    onDisconnect: () => operations++, onStartLink: () => operations++ });
  assert.ok(markup.includes("Telegram подключён"));
  assert.ok(markup.includes("Изменить Telegram"));
  assert.ok(markup.includes("Отключить"));
  assert.equal(markup.includes("Подтвердить отключение"), false);
  assert.equal(operations, 0);
});

test("waiting screen explains closed-pilot membership and supplies a usable own-account identifier without invented support", () => {
  const markup = render(AppStartupGate, { isLoggedIn: true, currentUserRole: "pending-client",
    user: { uid: "own-synthetic-uid" }, profileAccount: { login: "own_login" }, logout() {} });
  assert.ok(markup.includes("Вы уже вошли"));
  assert.ok(markup.includes("закрытое тестирование"));
  assert.ok(markup.includes("назначения тренера"));
  assert.ok(markup.includes("Нет тренера или приглашения?"));
  assert.ok(markup.includes("Повторная регистрация не откроет доступ"));
  assert.ok(markup.includes("own_login"));
  assert.equal(markup.includes("mailto:"), false);
  assert.equal(markup.includes("tel:"), false);
});
