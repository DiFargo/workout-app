import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseBasicAccessSmokeArgs, runBasicWorkoutAccessSmoke, recoverBasicWorkoutAccessCleanup, safeBasicAccessSmokeError, validateBasicSmokeMediaUrl } from "../scripts/smoke-basic-workout-access-release.mjs";
import { runAdminBasicAccessGrantRegression } from "../scripts/smoke-admin-basic-access-grant-release.mjs";

const project = "tren-85720", bucket = `${project}.firebasestorage.app`;
const version = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const args = ["--run", "--allow-production", `--project=${project}`, `--expected-version=${version}`, `--output-dir=artifacts/remediation-${version}`];
const options = () => parseBasicAccessSmokeArgs(args, {});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function signedUrl(kind) {
  const path = kind === "poster" ? "protected-exercise-previews/v1/b41b07b775a30700ae0ebef71c059b477471c5abc2e574c797a9ba6f4cddda04.webp"
    : "template-exercise-videos/M0HxiJPFrCObgjVC7ceXADoGOSX2/optimized-20260912/IMG_7786.mp4";
  const url = new URL(`https://storage.googleapis.com/${bucket}/${path}`);
  for (const [key, value] of Object.entries({ "X-Goog-Algorithm": "GOOG4-RSA-SHA256", "X-Goog-Credential": "DO-NOT-PRINT-credential",
    "X-Goog-Date": new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), "X-Goog-Expires": "900", "X-Goog-SignedHeaders": "host", "X-Goog-Signature": "a".repeat(512) })) url.searchParams.set(key, value);
  return url;
}
function fixture(settings = {}) {
  const accounts = new Map(), documents = new Map(), calls = [], tokens = new Map(); let report, intent, serial = 0, grantUsed = false;
  const prefix = `projects/${project}/databases/(default)/documents/`;
  const document = (path, fields) => ({ name: prefix + path, fields, updateTime: `2026-11-09T10:00:${String(++serial).padStart(2, "0")}Z` });
  const issue = account => { const claims = { aud: project, sub: account.localId, iss: `https://securetoken.google.com/${project}`, ...account.claims };
    const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.DO-NOT-PRINT-signature`; tokens.set(token, claims); return token; };
  const deny = () => json({ error: { message: "DO-NOT-PRINT-provider-error" } }, 403);
  const dependencies = {
    operatorToken: async () => "DO-NOT-PRINT-operator",
    createArtifacts: async () => ({ output: "artifacts/offline-only.json", save: async (value, plan) => { report = structuredClone(value); intent = structuredClone(plan); }, close: async () => {} }),
    fetchImpl: async (input, init) => {
      const url = new URL(input), body = init.body ? JSON.parse(init.body) : {}, method = init.method || "GET";
      const token = (init.headers.Authorization || "").replace("Bearer ", ""), operator = token === "DO-NOT-PRINT-operator", claims = tokens.get(token);
      calls.push({ url, method, body, operator }); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
      if (url.pathname === "/__/firebase/init.json") return json({ projectId: project, storageBucket: bucket, apiKey: "public-key-long-enough-for-tests" });
      if (url.pathname === "/sw.js") return new Response(`const CACHE_NAME = "workout-app-v${version}";`);
      if (url.pathname.endsWith("accounts:lookup")) { assert.equal(operator, true); return json({ users: [...accounts.values()].filter(account => body.email.includes(account.email)).map(({ email, localId }) => ({ email, localId })) }); }
      if (url.pathname.endsWith("accounts:signUp")) {
        assert.equal(operator, false); assert.match(body.email, /^basic-access-[a-f0-9]{24}-(client|admin)@example\.invalid$/);
        const role = body.email.includes("-client@") ? "client" : "admin", account = { email: body.email, localId: `owned_${role}`, claims: {}, password: body.password };
        accounts.set(account.localId, account);
        if (settings.ambiguousSignup && role === "client") return json({ secret: "DO-NOT-PRINT-signup" }, 500);
        return json({ localId: account.localId, idToken: issue(account) });
      }
      if (url.pathname.endsWith("accounts:update")) { assert.equal(operator, true); assert.equal(body.localId, "owned_admin");
        const account = accounts.get(body.localId); account.claims = JSON.parse(body.customAttributes); return json({ localId: account.localId }); }
      if (url.pathname.endsWith("accounts:signInWithPassword")) { assert.equal(operator, false); const account = [...accounts.values()].find(item => item.email === body.email);
        assert.equal(body.password, account.password); return json({ localId: account.localId, idToken: issue(account) }); }
      if (url.pathname.endsWith("accounts:delete")) { assert.equal(operator, true); assert.ok(accounts.has(body.localId));
        if (settings.authDeleteFailure && body.localId === "owned_client") return json({}, 500); accounts.delete(body.localId); return json({}); }
      if (url.pathname === "/api/ai-basic-workout-plan") {
        assert.equal(claims.sub, "owned_client"); assert.equal(grantUsed, false); return json({ ok: false, message: "Доступ к базовым тренировкам открывает администратор. Обратитесь к нему." }, 403);
      }
      if (url.pathname === "/api/client-loading-snapshot") return json({ uid: "owned_client", profile: { basicWorkoutAccess: true } });
      if (url.pathname === "/api/exercise-video-access") {
        assert.equal(body.previewTime, 2.1); assert.equal(claims.sub, "owned_client");
        const ratePath = "securityRateLimits/" + (await import("node:crypto")).createHash("sha256").update("owned_client:exercise-video-access").digest("hex");
        documents.set(ratePath, document(ratePath, { uid: { stringValue: settings.rateMismatch ? "foreign" : "owned_client" }, action: { stringValue: "exercise-video-access" } }));
        return json({ ok: true, posterUrl: signedUrl("poster").href, url: signedUrl("video").href, expiresAt: new Date(Date.now() + 900000).toISOString() });
      }
      if (url.hostname === "storage.googleapis.com") {
        assert.equal(init.headers.Range, "bytes=0-63"); assert.equal(operator, false); assert.equal(init.headers.Authorization, undefined);
        if (settings.rangeFailure) return json({ secret: "DO-NOT-PRINT-storage-body" }, 500);
        const poster = url.pathname.endsWith("webp"), buffer = Buffer.alloc(64); if (poster) { buffer.write("RIFF", 0); buffer.write("WEBP", 8); }
        return new Response(buffer, { status: 206, headers: { "Content-Type": poster ? "image/webp" : "video/mp4", "Content-Range": "bytes 0-63/48166" } });
      }
      if (url.hostname !== "firestore.googleapis.com") throw Error("Unexpected origin");
      let path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
      if (path.endsWith(":listCollectionIds")) {
        assert.equal(operator, true); path = path.slice(0, -18);
        const ids = new Set([...documents.keys()].filter(key => key.startsWith(`${path}/`)).map(key => key.slice(path.length + 1).split("/")[0])); return json({ collectionIds: [...ids] });
      }
      assert.match(path, /^(users\/owned_(client|admin)(\/|$)|securityRateLimits\/[a-f0-9]{64}$)/);
      if (method === "DELETE") { assert.equal(operator, true); documents.delete(path); return json({}); }
      if (method === "PATCH") {
        if (!operator) {
          if (claims?.sub === "owned_client" && path === "users/owned_client" && body.fields.basicWorkoutAccess) return deny();
          if (claims?.sub === "owned_admin" && !claims.adminSecurityKeyVersion) return deny();
          if (claims?.sub === "owned_client" && (path.includes("/workouts/") || body.fields.basicWorkoutPlan) && documents.get("users/owned_client").fields.basicWorkoutAccess?.booleanValue !== true) return deny();
        }
        const current = documents.get(path), exists = url.searchParams.get("currentDocument.exists");
        if (exists === "false") assert.equal(current, undefined); else assert.equal(url.searchParams.get("currentDocument.updateTime"), current.updateTime);
        const next = document(path, { ...(current?.fields || {}), ...body.fields }); documents.set(path, next);
        if (body.fields.basicWorkoutAccess?.booleanValue === true) grantUsed = true;
        return json(next);
      }
      if (path.split("/").length % 2 === 1) return json({ documents: [...documents.values()].filter(item => item.name.startsWith(prefix + path + "/") && item.name.slice((prefix + path + "/").length).indexOf("/") < 0) });
      const current = documents.get(path);
      if (settings.markerMismatch && path === "users/owned_client" && grantUsed && operator && current) current.fields.createdByUid.stringValue = "foreign";
      return current ? json(current) : json({}, 404);
    }
  };
  return { dependencies, calls, state: () => ({ accounts: accounts.size, documents: documents.size }), report: () => report, intent: () => intent };
}

test("live smoke requires exact explicit project/version/output and rejects all environment ambiguity", async () => {
  for (const invalid of [[], args.filter(arg => arg !== "--run"), args.filter(arg => arg !== "--allow-production"), [...args, "--run"], [...args, "--uid=real"],
    args.map(arg => arg.startsWith("--project=") ? "--project=another" : arg), args.map(arg => arg.startsWith("--output-dir=") ? "--output-dir=../outside" : arg)]) assert.throws(() => parseBasicAccessSmokeArgs(invalid, {}));
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT"]) assert.throws(() => parseBasicAccessSmokeArgs(args, { [key]: "set" }));
  let touched = false; await assert.rejects(runBasicWorkoutAccessSmoke({ ...options(), run: false }, { operatorToken: () => { touched = true; } })); assert.equal(touched, false);
});
test("media verifier rejects other objects, permanent tokens, unbounded expiry and duplicate signature fields", () => {
  assert.ok(validateBasicSmokeMediaUrl(signedUrl("poster"), "poster")); assert.ok(validateBasicSmokeMediaUrl(signedUrl("video"), "video"));
  for (const change of [url => { url.hostname = "foreign.invalid"; }, url => { url.pathname += "wrong"; }, url => url.searchParams.set("token", "permanent"),
    url => url.searchParams.set("X-Goog-Expires", "901"), url => url.searchParams.append("X-Goog-Date", "old"), url => url.searchParams.set("X-Goog-Date", "20000101T000000Z")]) {
    const url = signedUrl("poster"); change(url); assert.throws(() => validateBasicSmokeMediaUrl(url, "poster"));
  }
});
test("complete orchestrator validates rules, denied AI, exact media ranges and removes its two identities", async () => {
  const h = fixture(), { report } = await runBasicWorkoutAccessSmoke(options(), h.dependencies);
  assert.equal(report.failed, false); assert.equal(report.cleanupVerified, true); assert.equal(report.cases.length, 11);
  assert.deepEqual(h.state(), { accounts: 0, documents: 0 }); assert.equal(h.intent().cleanupRequired, false);
  assert.equal(h.calls.filter(call => call.url.pathname.endsWith("accounts:signUp")).length, 2);
  assert.equal(h.calls.filter(call => call.url.hostname === "storage.googleapis.com").length, 2);
  assert.equal(h.calls.filter(call => call.url.pathname === "/api/ai-basic-workout-plan").length, 1);
  assert.equal(h.calls.some(call => call.method !== "GET" && /\/history|subscription|telegram|iam/.test(call.url.pathname)), false);
  const rendered = JSON.stringify(h.report()); for (const secret of ["DO-NOT-PRINT", "owned_client", "owned_admin", "@example.invalid", "X-Goog-", "storage.googleapis.com"]) assert.equal(rendered.includes(secret), false, secret);
});

test("grant regression uses actual handler/helper only on its owned profile and cleans exactly two identities", async () => {
  const h = fixture(), { report } = await runAdminBasicAccessGrantRegression(options(), h.dependencies);
  assert.equal(report.failed, false); assert.equal(report.cleanupVerified, true); assert.equal(report.cases.length, 5);
  assert.deepEqual(h.state(), { accounts: 0, documents: 0 }); assert.equal(h.intent().cleanupRequired, false);
  assert.equal(h.calls.filter(call => call.url.pathname.endsWith("accounts:signUp")).length, 2);
  assert.equal(h.calls.some(call => /\/api\/|\/workouts|\/history/.test(call.url.pathname)), false);
  const writes = h.calls.filter(call => call.method === "PATCH" && !call.operator);
  assert.equal(writes.length, 3);
  for (const call of writes) {
    assert.deepEqual(Object.keys(call.body.fields), ["basicWorkoutAccess", "updatedAt"]);
    assert.ok(call.url.searchParams.get("currentDocument.updateTime"));
    assert.equal(call.url.pathname.endsWith("/users/owned_client"), true);
  }
  assert.equal(JSON.stringify(report).includes("DO-NOT-PRINT"), false);
});
test("bounded media failure still independently cleans Auth, own tree and rates", async () => {
  const h = fixture({ rangeFailure: true }), { report } = await runBasicWorkoutAccessSmoke(options(), h.dependencies);
  assert.equal(report.failedStep, "signed-preview-and-video"); assert.equal(report.cleanupVerified, true); assert.deepEqual(h.state(), { accounts: 0, documents: 0 });
  assert.equal(JSON.stringify(report).includes("DO-NOT-PRINT"), false);
});
test("ambiguous signup is resolved only by pre-verified random email and fully cleaned", async () => {
  const h = fixture({ ambiguousSignup: true }), { report } = await runBasicWorkoutAccessSmoke(options(), h.dependencies);
  assert.equal(report.failedStep, "create-owned-identities"); assert.equal(report.cleanupVerified, true); assert.deepEqual(h.state(), { accounts: 0, documents: 0 });
});
test("Auth deletion failure never skips own tree/rates and is reported honestly", async () => {
  const h = fixture({ authDeleteFailure: true }), { report } = await runBasicWorkoutAccessSmoke(options(), h.dependencies);
  assert.equal(report.cleanupVerified, false); assert.equal(report.cleanup[0].authAbsent, false); assert.equal(report.cleanup[0].profileTreeAbsent, true); assert.equal(report.cleanup[0].ratesAbsent, true);
  assert.equal(report.cleanup[1].cleaned, true); assert.equal(h.intent().cleanupRequired, true);
});
test("foreign rate markers are never deleted and prevent false cleanup success", async () => {
  const h = fixture({ rateMismatch: true }), { report } = await runBasicWorkoutAccessSmoke(options(), h.dependencies);
  assert.equal(report.cleanupVerified, false); assert.equal(report.cleanup[0].ratesAbsent, false);
  assert.equal(h.calls.some(call => call.method === "DELETE" && call.url.pathname.includes("/securityRateLimits/")), false);
});
test("exclusive artifact failure happens before credentials or transport; errors redact secrets", async () => {
  let touched = false; await assert.rejects(runBasicWorkoutAccessSmoke(options(), { createArtifacts: async () => { throw Error("refused"); }, operatorToken: async () => { touched = true; }, fetchImpl: async () => { touched = true; } }));
  assert.equal(touched, false); assert.deepEqual(safeBasicAccessSmokeError(Error("Bearer secret https://private")), { code: "operation-failed" });
});
test("cleanup recovery reuses only the recorded two identities and cannot create accounts or issue claims", async () => {
  const settings = { authDeleteFailure: true }, h = fixture(settings);
  const { report } = await runBasicWorkoutAccessSmoke(options(), h.dependencies);
  assert.equal(report.cleanupVerified, false); assert.equal(h.state().accounts, 1);
  settings.authDeleteFailure = false; const firstCall = h.calls.length; let saved;
  const recovered = await recoverBasicWorkoutAccessCleanup(options(), report.runId, { ...h.dependencies,
    readRecoveryArtifacts: async () => ({ report: structuredClone(h.report()), intent: structuredClone(h.intent()) }),
    saveRecoveryArtifacts: async (result, intent) => { saved = { result, intent }; } });
  assert.equal(recovered.verified, true); assert.deepEqual(h.state(), { accounts: 0, documents: 0 });
  assert.equal(saved.result.failed, false); assert.equal(saved.intent.cleanupRequired, false);
  assert.equal(saved.result.initialCleanup[0].authAbsent, false);
  assert.equal(h.calls.slice(firstCall).some(call => /accounts:(signUp|update|signInWithPassword)|\/api\//.test(call.url.pathname)), false);
});
test("cleanup recovery rejects a forged intent before credentials or any request", async () => {
  let touched = false;
  await assert.rejects(recoverBasicWorkoutAccessCleanup(options(), "a".repeat(24), {
    readRecoveryArtifacts: async () => ({ report: { project, version, runId: "a".repeat(24) }, intent: { project, version, runId: "a".repeat(24), marker: "foreign", identities: [] } }),
    operatorToken: async () => { touched = true; }, fetchImpl: async () => { touched = true; }
  }));
  assert.equal(touched, false);
});
