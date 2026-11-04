import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getLoginResolutionEndpoint,
  resolveEmailForLogin,
  authenticateWithLoginAlias,
  requestLoginAliasPasswordReset
} from "../src/features/auth/loginResolution.js";

test("email login does not call the alias endpoint", async () => {
  let requestCount = 0;
  const email = await resolveEmailForLogin({
    isEmail: true,
    email: "USER@Example.com",
    loginAlias: ""
  }, {
    fetchImpl: async () => {
      requestCount += 1;
      throw new Error("unexpected request");
    }
  });

  assert.equal(email, "user@example.com");
  assert.equal(requestCount, 0);
});

test("login alias exchanges credentials for only a custom token through the server endpoint", async () => {
  const requests = [];
  const token = await authenticateWithLoginAlias({
    isEmail: false,
    email: "",
    loginAlias: "alfa"
  }, "test-password", {
    hostname: "tren-85720.web.app",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, customToken: "custom-token" })
      };
    }
  });

  assert.equal(token, "custom-token");
  assert.equal(requests[0].url, "/api/auth/resolve-login");
  assert.deepEqual(JSON.parse(requests[0].options.body), { login: "alfa", password: "test-password" });
});

test("local preview uses the same-origin API path", () => {
  assert.equal(
    getLoginResolutionEndpoint("127.0.0.1"),
    "/api/auth/resolve-login"
  );
});

test("rate-limited alias lookup maps to an actionable auth error", async () => {
  await assert.rejects(
    authenticateWithLoginAlias({
      isEmail: false,
      email: "",
      loginAlias: "alfa"
    }, "test-password", {
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({ ok: false, error: "auth/too-many-requests" })
      })
    }),
    (error) => error?.code === "auth/too-many-requests"
  );
});

test("legacy email resolution cannot disclose an alias email and reset sends only an alias action", async () => {
  await assert.rejects(resolveEmailForLogin({ isEmail: false, loginAlias: "alfa" }), { code: "auth/invalid-credential" });
  const requests = [];
  await requestLoginAliasPasswordReset({ loginAlias: "alfa" }, { fetchImpl: async (url, options) => {
    requests.push(JSON.parse(options.body)); return { ok: true, status: 200, json: async () => ({ ok: true }) };
  } });
  assert.deepEqual(requests, [{ login: "alfa", action: "reset-password" }]);
  await assert.rejects(authenticateWithLoginAlias({ loginAlias: "alfa" }, "test-password", {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, email: "private@example.test" }) })
  }), { code: "auth/invalid-credential" });
});

test("auth client no longer reads loginAliases directly", () => {
  const source = readFileSync("src/features/auth/authHandlers.js", "utf8");
  const functions = readFileSync("functions/index.js", "utf8");
  const firebaseConfig = readFileSync("firebase.json", "utf8");

  assert.doesNotMatch(source, /getDoc\(doc\(db,\s*["']loginAliases["']/);
  assert.match(functions, /export const resolveLoginAlias = onRequest/);
  assert.match(functions, /enforceRateLimit\(getPublicRequestIdentity\(req\), "resolve-login-alias"/);
  assert.match(firebaseConfig, /"source": "\/api\/auth\/resolve-login"/);
});
