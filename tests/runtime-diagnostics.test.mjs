import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeDiagnostic, rememberRuntimeDiagnostic, runtimeDiagnosticMessage } from "../src/utils/runtimeDiagnostics.js";

test("диагностика сохраняет причину JS-сбоя и координаты сборки без личных данных", () => {
  const error = new TypeError("Cannot read properties of null (reading 'exerciseKey')");
  error.stack = `TypeError: diary confidential\n at f (https://tren-85720.web.app/assets/Workout-abc.js:2:123)\n at https://private.test/?token=secret`;
  const diagnostic = createRuntimeDiagnostic(error, { feature: "workouts", version: "3.0.929", id: "test-id" });
  assert.equal(diagnostic.feature, "workouts");
  assert.equal(diagnostic.error.message, error.message);
  assert.deepEqual(diagnostic.error.frames, ["Workout-abc.js:2:123"]);
  assert.doesNotMatch(JSON.stringify(diagnostic), /confidential|private|secret|https/);
  assert.ok(runtimeDiagnosticMessage(diagnostic).length <= 1200);
});

test("произвольный текст исключён из отчёта, раздел и версия ограничены", () => {
  const report = createRuntimeDiagnostic(new Error("password=secret user@example.com my private diary"), { feature:"private note",version:"token=secret" });
  assert.equal(report.feature,"unknown"); assert.equal(report.version,"unknown");
  assert.doesNotMatch(JSON.stringify(report), /password|secret|example|diary|private/);
});

test("отказ sessionStorage не мешает экрану ошибки", () => {
  globalThis.sessionStorage = {setItem(){throw new Error("denied");}};
  assert.equal(rememberRuntimeDiagnostic("test",createRuntimeDiagnostic(new Error())),false);
  delete globalThis.sessionStorage;
});
