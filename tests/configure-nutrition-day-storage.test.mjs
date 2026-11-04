import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { configureStorage, parseOptions, validateNutritionRulesFence } from "../scripts/configure-nutrition-day-storage.mjs";

const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const at = "2026-10-26T12:00:00.000Z";
const options = { project: "tren-85720-staging", enable: true, run: true };
function transport({ exists = true, deployed = rules, readbackEnabled = true, name } = {}) {
  const calls = [];
  const request = async (url, init = {}) => {
    calls.push({ url: new URL(url), ...init });
    if (url.hostname === "firebaserules.googleapis.com") return url.pathname.includes("/releases/")
      ? { status: 200, data: { rulesetName: name || "projects/tren-85720-staging/rulesets/safe-123" } }
      : { status: 200, data: { source: { files: [{ name: "firestore.rules", content: deployed }] } } };
    if (init.method === "PATCH") return { status: 200, data: {} };
    const after = calls.some(call => call.method === "PATCH");
    if (!after && !exists) return { status: 404 };
    return { status: 200, data: { updateTime: "2026-10-26T11:00:00Z", fields: after ? {
      writerFenceVersion: { integerValue: "2" }, cutoverEnabled: { booleanValue: readbackEnabled },
      activatedAt: { timestampValue: at.replace(".000Z", "Z") }
    } : { untouched: { stringValue: "preserved by mask" } } } };
  };
  return { calls, request };
}

test("Точные проекты, явное действие и Production-подтверждение обязательны", () => {
  assert.throws(() => parseOptions(["--project=other", "--enable"]), /exact-project/);
  assert.throws(() => parseOptions(["--project=tren-85720", "--enable", "--run"]), /production-confirmation/);
  assert.throws(() => parseOptions(["--project=tren-85720-staging", "--enable", "--disable"]), /choose-enable/);
  assert.equal(parseOptions(["--project", "tren-85720", "--disable", "--run", "--allow-production"]).disable, true);
});

test("Enable сверяет deployed Rules и меняет только три masked поля с updateTime", async () => {
  const mock = transport();
  const report = await configureStorage({ options, localRules: rules, request: mock.request, now: () => at });
  assert.equal(report.verified, true);
  assert.equal(report.rulesSha256, validateNutritionRulesFence(rules).sha256);
  assert.equal(report.requests, 5);
  const patch = mock.calls.find(call => call.method === "PATCH");
  assert.deepEqual(patch.url.searchParams.getAll("updateMask.fieldPaths"), ["writerFenceVersion", "cutoverEnabled", "activatedAt"]);
  assert.equal(patch.url.searchParams.get("currentDocument.updateTime"), "2026-10-26T11:00:00Z");
  assert.deepEqual(Object.keys(patch.body.fields), ["writerFenceVersion", "cutoverEnabled", "activatedAt"]);
  assert.ok(mock.calls.every(call => !call.url.pathname.includes("/users/") && !call.url.hostname.includes("iam")));
});

test("Новый config создаётся только с exists=false", async () => {
  const mock = transport({ exists: false });
  await configureStorage({ options, localRules: rules, request: mock.request, now: () => at });
  const patch = mock.calls.find(call => call.method === "PATCH");
  assert.equal(patch.url.searchParams.get("currentDocument.exists"), "false");
  assert.equal(patch.url.searchParams.has("currentDocument.updateTime"), false);
});

test("Несовпадение Rules, отсутствие fence и неверная ссылка блокируют запись", async () => {
  for (const config of [{ deployed: `${rules}\n` }, { deployed: rules.replaceAll("nutritionSdkWriteAvailable", "unfenced") },
    { name: "projects/tren-85720-staging/rulesets/a/extra" }]) {
    const mock = transport(config);
    await assert.rejects(configureStorage({ options, localRules: rules, request: mock.request }), /rules|fence/);
    assert.equal(mock.calls.some(call => call.method === "PATCH"), false);
  }
});

test("Disable не требует Rules и не означает rollback; readback обязателен", async () => {
  const mock = transport({ readbackEnabled: false });
  const report = await configureStorage({ options: { ...options, enable: false, disable: true }, request: mock.request, now: () => at });
  assert.equal(report.operation, "future-cutover-disabled-no-rollback");
  assert.equal(report.rulesVerified, false);
  assert.equal(mock.calls.length, 3);
  const mismatch = transport({ readbackEnabled: false });
  await assert.rejects(configureStorage({ options, localRules: rules, request: mismatch.request, now: () => at }), /readback-mismatch/);
});

test("Программный вызов не обходит подтверждения и конфликт optimistic concurrency", async () => {
  await assert.rejects(configureStorage({ options: { ...options, disable: true }, request: () => assert.fail("network") }), /unsafe-run/);
  const mock = transport();
  await assert.rejects(configureStorage({ options, localRules: rules, now: () => at, request: (url, init) =>
    init?.method === "PATCH" ? { status: 409 } : mock.request(url, init) }), /config-write-http-409/);
});
