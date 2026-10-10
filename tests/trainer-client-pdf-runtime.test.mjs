import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const cleanup = installRuntimeImports({ "firebase/firestore": { collection() {}, doc() {}, getDocs() {}, setDoc() {}, writeBatch() {} } });
after(cleanup);
const { downloadTrainerClientExportWithDeps, handleTrainerClientActionWithDeps } = await import("../src/features/trainer/trainerClientActionHandlers.js");
const { buildTrainerClientPrintDocument } = await import("../src/utils/trainerClientExport.js");
const originalTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;
after(() => { globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClearTimeout; URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl; });
let channels, blobs, opened, revoked, timeouts, statuses, events;
class TestChannel {
  constructor(name) { this.name = name; channels.push(this); }
  close() { this.closed = true; }
}
function fixture(overrides = {}) {
  return { client: { id: "client-a", name: "Иван <img src=x onerror=alert(1)> & \"А\"" },
    adminClientHistory: [{ workoutName: "Жим <script>steal()</script>", date: "2026-10-08", durationSeconds: 1200, readiness: { title: "Хорошо & уверенно" } }],
    adminClientMeasurements: [{ date: "2026-10-08", weight: 80.5 }], adminClientNutrition: {},
    getAdminNutritionDaysList: () => [{ date: "2026-10-07", totals: { calories: 1800, protein: 120, fat: 60, carbs: 200 }, score: 8 }],
    setAdminClientStatus: status => statuses.push(status), format: "pdf", ...overrides };
}
beforeEach(() => {
  channels = []; blobs = []; opened = []; revoked = []; timeouts = new Map(); statuses = []; events = [];
  let sequence = 0;
  globalThis.setTimeout = (callback, ms) => { const id = ++sequence; timeouts.set(id, { callback, ms }); return id; };
  globalThis.clearTimeout = id => timeouts.delete(id);
  URL.createObjectURL = blob => { blobs.push(blob); return `blob:test/${blobs.length}`; };
  URL.revokeObjectURL = url => revoked.push(url);
  globalThis.window = { BroadcastChannel: TestChannel,
    open: (...args) => { opened.push(args); queueMicrotask(() => channels[0].onmessage({ data: { type: "ready" } })); return null; } };
  globalThis.document = { createElement: () => ({ click() { opened.push({ href: this.href, download: this.download }); } }) };
});

test("PDF opens a complete escaped report with noopener even when open returns null", async () => {
  assert.equal(await downloadTrainerClientExportWithDeps(fixture()), true);
  assert.deepEqual(opened[0], ["blob:test/1", "_blank", "noopener,noreferrer"]);
  assert.equal(blobs[0].type, "text/html;charset=utf-8");
  const html = await blobs[0].text();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Иван &lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;А&quot; — отчёт<\/title>/);
  assert.match(html, /Жим &lt;script&gt;steal\(\)&lt;\/script&gt;/);
  assert.match(html, /weight 80\.5/);
  assert.match(html, /1800/);
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("<script>steal()"), false);
  assert.equal(statuses.at(-1), "PDF-отчёт открыт в новом окне для сохранения через печать.");
  assert.equal([...timeouts.values()].some(timer => timer.ms === 10000), false);
  assert.equal(revoked.length, 0);
  [...timeouts.values()].find(timer => timer.ms === 60000).callback();
  assert.deepEqual(revoked, ["blob:test/1"]);
  assert.equal(channels[0].closed, true);
});

test("blocked popup times out with failure and does not claim a successful PDF export", async () => {
  window.open = (...args) => { opened.push(args); return null; };
  const exporting = downloadTrainerClientExportWithDeps(fixture());
  assert.match(statuses.at(-1), /Подготавливаем/);
  [...timeouts.values()].find(timer => timer.ms === 10000).callback();
  assert.equal(await exporting, false);
  assert.match(statuses.at(-1), /Не удалось подтвердить открытие/);
  assert.equal(statuses.some(status => status === "PDF-отчёт открыт в новом окне для сохранения через печать."), false);
  assert.equal(channels[0].closed, true);
});

test("unsupported messaging and thrown popup errors report failure", async () => {
  window.BroadcastChannel = undefined;
  assert.equal(await downloadTrainerClientExportWithDeps(fixture()), false);
  assert.match(statuses.at(-1), /Доступен CSV/);
  assert.equal(blobs.length, 0);
  window.BroadcastChannel = TestChannel;
  window.open = () => { throw new Error("popup-denied"); };
  assert.equal(await downloadTrainerClientExportWithDeps(fixture()), false);
  assert.match(statuses.at(-1), /Не удалось подтвердить/);
});

test("PDF print failure keeps an accurate status after report load", async () => {
  await downloadTrainerClientExportWithDeps(fixture());
  channels[0].onmessage({ data: { type: "print-error" } });
  assert.match(statuses.at(-1), /Отчёт открыт, но печать не запустилась/);
});

test("print document actually invokes print on load and reports exceptions", () => {
  const html = buildTrainerClientPrintDocument("Клиент", [["<header&>"], ["<row&>"]], "internal-channel");
  assert.match(html, /<th>&lt;header&amp;&gt;<\/th>/);
  assert.match(html, /<td>&lt;row&amp;&gt;<\/td>/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let load;
  let prints = 0;
  const messages = [];
  let closed = false;
  vm.runInNewContext(script, { window: { addEventListener: (event, handler) => { assert.equal(event, "load"); load = handler; }, print: () => { prints++; throw new Error("print-unavailable"); } },
    BroadcastChannel: class { constructor(name) { assert.equal(name, "internal-channel"); } postMessage(message) { messages.push(message.type); } close() { closed = true; } } });
  load();
  assert.equal(prints, 1);
  assert.deepEqual(messages, ["ready", "print-error"]);
  assert.equal(closed, true);
});

test("failed PDF does not record a successful trainer export event", async () => {
  window.open = () => null;
  const running = handleTrainerClientActionWithDeps({ ...fixture(), action: "export_pdf", canUseTrainerFeatures: () => true, canUseAdminFeatures: () => true, canManageClientProgram: () => true,
    recordTrainerEvent: (...args) => events.push(args) });
  [...timeouts.values()].find(timer => timer.ms === 10000).callback();
  assert.equal(await running, false);
  assert.deepEqual(events, []);
});

test("confirmed PDF records exactly one event; CSV download and quoting remain available", async () => {
  const action = await handleTrainerClientActionWithDeps({ ...fixture(), action: "export_pdf", canUseTrainerFeatures: () => true, canUseAdminFeatures: () => true, canManageClientProgram: () => true,
    recordTrainerEvent: (...args) => events.push(args) });
  assert.equal(action, true);
  assert.deepEqual(events, [["client-a", "export", "Экспорт PDF"]]);
  assert.equal(await downloadTrainerClientExportWithDeps(fixture({ format: "excel" })), true);
  const csv = await blobs[1].text();
  assert.match(csv, /"workout","2026-10-08"/);
  assert.match(csv, /"measurement","2026-10-08"/);
  assert.match(opened[1].download, /-trainer-export\.csv$/);
  assert.equal(statuses.at(-1), "Excel-экспорт клиента подготовлен в CSV.");
});
