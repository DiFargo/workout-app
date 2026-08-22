import assert from "node:assert/strict";
import test from "node:test";

import { resolveAppCheckConfiguration } from "../src/app/appCheck.js";
import { withAppCheckHeader } from "../src/utils/apiClient.js";

test("App Check stays opt-in until a site key is configured", () => {
  assert.deepEqual(
    resolveAppCheckConfiguration({ environment: "staging" }),
    { environment: "staging", siteKey: "", debugToken: "" }
  );
});

test("App Check accepts an Enterprise site key outside production", () => {
  assert.deepEqual(
    resolveAppCheckConfiguration({
      environment: "staging",
      siteKey: "enterprise-site-key",
      debugToken: "debug-token"
    }),
    {
      environment: "staging",
      siteKey: "enterprise-site-key",
      debugToken: "debug-token"
    }
  );
});

test("production App Check builds reject debug tokens", () => {
  assert.throws(
    () => resolveAppCheckConfiguration({
      environment: "production",
      siteKey: "enterprise-site-key",
      debugToken: "debug-token"
    }),
    /must never be included in a production build/
  );
});

test("API requests add an App Check header only when a token is available", () => {
  assert.deepEqual(
    withAppCheckHeader({ "Content-Type": "application/json" }, "app-check-token"),
    {
      "Content-Type": "application/json",
      "X-Firebase-AppCheck": "app-check-token"
    }
  );
  assert.deepEqual(withAppCheckHeader({ Accept: "application/json" }, ""), {
    Accept: "application/json"
  });
});
