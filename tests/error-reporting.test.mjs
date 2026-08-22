import assert from "node:assert/strict";
import test from "node:test";
import {
  createClientErrorReport,
  reportClientError
} from "../src/utils/errorReporting.js";

test("client error reports contain operational context and redact common sensitive values", () => {
  const report = createClientErrorReport(
    new Error("Request failed for client@example.com?token=secret-value"),
    {
      source: "test",
      feature: "workout",
      role: "client",
      route: "/workouts?token=secret-value"
    }
  );

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.source, "test");
  assert.equal(report.feature, "workout");
  assert.equal(report.role, "client");
  assert.equal(report.route, "/workouts");
  assert.match(report.error.message, /\[redacted-email\]/);
  assert.match(report.error.message, /token=\[redacted\]/);
  assert.equal("stack" in report.error, false);
});

test("client error reporting is a safe no-op without an endpoint", async () => {
  let calls = 0;
  const sent = await reportClientError(new Error("ignored"), {}, {
    fetchImpl: async () => {
      calls += 1;
    }
  });

  assert.equal(sent, false);
  assert.equal(calls, 0);
});

test("client error reporting posts a compact payload only to an explicit endpoint", async () => {
  const requests = [];
  const sent = await reportClientError(new Error("network failed"), { source: "test" }, {
    endpoint: "https://errors.example.test/ingest",
    fetchImpl: async (...args) => {
      requests.push(args);
      return { ok: true };
    }
  });

  assert.equal(sent, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "https://errors.example.test/ingest");
  assert.equal(requests[0][1].credentials, "omit");
  assert.equal(requests[0][1].keepalive, true);
});

test("client error reporting treats a rejected HTTP response as unsent", async () => {
  const sent = await reportClientError(new Error("collector rejected"), { source: "test" }, {
    endpoint: "https://errors.example.test/ingest",
    fetchImpl: async () => ({ ok: false })
  });

  assert.equal(sent, false);
});
