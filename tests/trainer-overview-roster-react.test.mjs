import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rolldown } from "rolldown";

const bundle = await rolldown({
  input: fileURLToPath(new URL("../src/components/trainer/TrainerDailyJournal.jsx", import.meta.url)),
  platform: "node",
  transform: { jsx: { runtime: "automatic" } },
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{
    name: "roster-css-stub",
    load: (id) => id.endsWith(".css")
      ? { code: "export default new Proxy({}, {get:(_,key)=>key});", moduleType: "js" }
      : null
  }]
});
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", "window", generated.output[0].code)(
  createRequire(import.meta.url), module, module.exports,
  { localStorage: { getItem: () => null } }
);
const TrainerDailyJournal = module.exports.default;
const textContent = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

test("ростер сохраняет приоритетных клиентов, исключает архив и тестовых и показывает четыре из пяти", () => {
  const activeClients = [
    { id: "new-client", name: "Новый клиент" },
    { id: "ilya", name: "Илья" },
    { id: "alexandra", name: "Александра Константинопольская" },
    { id: "client-4", name: "Клиент 4" }
  ];
  const archivedClient = { id: "archived", name: "Архивный клиент", archived: true };
  const testClient = { id: "test", name: "Тестовый клиент", isTest: true };
  const clients = [archivedClient, activeClients[0], testClient, ...activeClients.slice(1)];
  const fifthClient = { id: "client-5", name: "Клиент 5" };
  const actionCenter = {
    priorityItems: [{
      clientId: activeClients[0].id,
      client: activeClients[0],
      summary: { assignedProgramId: "" },
      status: { id: "noProgram" }
    }, {
      clientId: activeClients[1].id,
      client: activeClients[1],
      summary: { assignedProgramId: "program_1" },
      attention: { type: "workout", reason: "Пропуск" }
    }]
  };

  for (const [rosterClients, total] of [[clients, 4], [[...clients, fifthClient], 5]]) {
    const html = renderToStaticMarkup(React.createElement(TrainerDailyJournal, {
      clients: rosterClients,
      actionCenter,
      trainerUid: "trainer-roster-test",
      renderAvatar: (client) => React.createElement("span", { "data-roster-client-id": client.id }),
      onOpenClient() {},
      onOpenClients() {}
    }));
    const roster = html.match(/<section\b[^>]*aria-label="Мои клиенты"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(roster, "В обзоре должен быть отдельный раздел клиентов");
    const rows = [...roster.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)]
      .map((match) => match[1])
      .filter((row) => row.includes("data-roster-client-id="));
    const clientIds = rows.map((row) => row.match(/data-roster-client-id="([^"]+)"/)[1]);

    assert.deepEqual(clientIds, activeClients.map((client) => client.id),
      "Четыре активных клиента должны оставаться в ростере, даже если у них есть задачи");
    const heading = roster.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] || "";
    assert.equal(textContent(heading), `Мои клиенты ${total}`,
      "Счётчик отражает всех активных клиентов, а не только предпросмотр");
    assert.doesNotMatch(roster, /Архивный клиент|Тестовый клиент|Клиент 5|Шаблоны программ/);
    assert.match(textContent(rows[0]), /Новый клиент Нужна настройка/);
    assert.match(textContent(rows[1]), /Илья Пропущена тренировка/);
    assert.doesNotMatch(textContent(rows[1]), /Нужна настройка/,
      "Другой сигнал не должен превращаться в статус первичной настройки");
    assert.match(textContent(rows[2]), /План и результаты/);
    assert.match(textContent(rows[3]), /План и результаты/);
  }
});
