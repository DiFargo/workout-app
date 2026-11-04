import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseProtectedVideoArgs, runProtectedVideoSmoke, safeProtectedVideoError, validateProtectedVideoUrl } from "../scripts/smoke-protected-video-release.mjs";

const version = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const project = "tren-85720-staging";
const args = ["--run", `--project=${project}`, `--expected-version=${version}`, `--output-dir=artifacts/remediation-${version}`];
const options = () => parseProtectedVideoArgs(args, {});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
function signedUrl() {
  const url = new URL(`https://storage.googleapis.com/${project}.firebasestorage.app/protected-workout-videos/public/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4`);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  for (const [key, value] of Object.entries({ "X-Goog-Algorithm": "GOOG4-RSA-SHA256", "X-Goog-Credential": "private-account/credential", "X-Goog-Date": stamp,
    "X-Goog-Expires": "900", "X-Goog-SignedHeaders": "host", "X-Goog-Signature": "a".repeat(512), "response-content-type": "video/mp4" })) url.searchParams.set(key, value);
  return url;
}

function harness(settings = {}) {
  let email, userExists = false, profile = null, rate = null, saved, active = false, child = null;
  const uid = "owned-synthetic-test", calls = [];
  const database = `projects/${project}/databases/(default)/documents/`;
  const document = (path, fields) => ({ name: database + path, fields, updateTime: "2026-10-18T00:00:00Z" });
  const token = `header.${Buffer.from(JSON.stringify({ aud: project, sub: uid, iss: `https://securetoken.google.com/${project}` })).toString("base64url")}.signature`;
  const providerError = () => {
    const response = json({ secret: "DO-NOT-PRINT-provider-body" }, 500);
    response.body.getReader = () => { throw Error("Provider error body must not be read"); };
    return response;
  };
  const deps = {
    operatorToken: async () => "DO-NOT-PRINT-operator-token",
    createArtifact: async () => ({ output: "artifacts/offline-only.json", save: async report => { saved = JSON.parse(JSON.stringify(report)); }, close: async () => {} }),
    fetchImpl: async (input, init) => {
      const url = new URL(input), body = init.body ? JSON.parse(init.body) : {};
      calls.push({ url, method: init.method || "GET", body });
      assert.equal(init.redirect, "error");
      assert.equal(init.cache, "no-store");
      if (url.pathname === "/__/firebase/init.json") return json({ projectId: project, storageBucket: `${project}.firebasestorage.app`, apiKey: "public-key-long-enough-for-test" });
      if (url.pathname === "/sw.js") return new Response(`const CACHE_NAME = "workout-app-v${version}";`);
      if (url.pathname.endsWith("accounts:lookup")) {
        if (settings.lookupFailure && userExists) return providerError();
        return json(userExists ? { users: [{ email, localId: uid }] } : {});
      }
      if (url.pathname.endsWith("accounts:signUp")) {
        email = body.email; userExists = true;
        assert.match(email, /^protected-video-[a-f0-9]{24}@example\.invalid$/);
        if (settings.ambiguousSignup) return providerError();
        return json({ localId: uid, idToken: token });
      }
      if (url.pathname.endsWith("accounts:delete")) {
        assert.equal(body.localId, uid);
        if (settings.authDeleteFailure) return providerError();
        userExists = false; return json({});
      }
      if (url.pathname === "/api/exercise-video-access") {
        if (!init.headers.Authorization) return json({ error: "unauthenticated" }, 401);
        if (!active) return json({ error: "pending" }, 403);
        rate = document("securityRateLimits/owned-hash", { uid: { stringValue: uid }, action: { stringValue: "exercise-video-access" } });
        if (body.source.startsWith("gs:")) return json({ error: "forbidden" }, 403);
        return json({ ok: true, url: signedUrl().href, expiresAt: new Date(Date.now() + 900000).toISOString() });
      }
      if (url.hostname === "storage.googleapis.com") {
        if (!url.search) return new Response(null, { status: settings.unsignedPublic ? 200 : 403 });
        assert.equal(init.headers.Range, "bytes=0-63");
        if (settings.rangeFailure) return providerError();
        return new Response(new Uint8Array(64), { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-63/12345" } });
      }
      if (url.pathname.startsWith("/videos/")) return new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } });
      if (url.pathname.endsWith(":listCollectionIds")) {
        return json(child && url.pathname.endsWith(`/users/${uid}:listCollectionIds`) ? { collectionIds: ["owned-child"] } : {});
      }
      if (url.hostname === "firestore.googleapis.com") {
        const path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
        if (path === `users/${uid}`) {
          if (init.method === "PATCH") {
            if (!profile) {
              assert.equal(url.searchParams.get("currentDocument.exists"), "false");
              profile = document(path, body.fields);
              if (settings.nestedTree) child = document(`${path}/owned-child/one`, { synthetic: { booleanValue: true } });
            } else { Object.assign(profile.fields, body.fields); active = true; }
            return json(profile);
          }
          if (init.method === "DELETE") { profile = null; return json({}); }
          if (settings.markerMismatch && profile && active) profile.fields.createdByUid.stringValue = "not-owned";
          return profile ? json(profile) : json({}, 404);
        }
        if (path === `users/${uid}/owned-child`) return json({ documents: child ? [child] : [] });
        if (path === `users/${uid}/owned-child/one`) {
          if (init.method === "DELETE") { child = null; return json({}); }
          return child ? json(child) : json({}, 404);
        }
        if (path.startsWith("securityRateLimits/")) {
          if (init.method === "DELETE") { rate = null; return json({}); }
          if (rate) {
            rate.name = database + path;
            if (settings.rateMismatch) rate.fields.uid.stringValue = "not-owned";
          }
          return rate ? json(rate) : json({}, 404);
        }
      }
      throw Error("Unexpected request; URL deliberately suppressed");
    }
  };
  return { deps, calls, saved: () => saved, state: () => ({ userExists, profile, rate }), child: () => child };
}

test("strict run/project/production/output/env guards reject before any transport", async () => {
  for (const invalid of [[], args.filter(arg => arg !== "--run"), [...args, "--run"], [...args, "--other=x"],
    args.map(arg => arg.startsWith("--project=") ? "--project=foreign" : arg),
    args.map(arg => arg.startsWith("--project=") ? "--project=tren-85720" : arg),
    args.map(arg => arg.startsWith("--output-dir=") ? "--output-dir=../outside" : arg),
    [...args, "--confirm-prod=tren-85720"]]) assert.throws(() => parseProtectedVideoArgs(invalid, {}));
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "STORAGE_EMULATOR_HOST"])
    assert.throws(() => parseProtectedVideoArgs(args, { [key]: "set" }));
  assert.equal(parseProtectedVideoArgs([...args.map(arg => arg.startsWith("--project=") ? "--project=tren-85720" : arg), "--confirm-prod=tren-85720"], {}).project, "tren-85720");
  let touched = false;
  await assert.rejects(runProtectedVideoSmoke({ ...options(), run: false }, { operatorToken: () => { touched = true; } }));
  assert.equal(touched, false);
});

test("signed URL permits only exact protected object and bounded V4 expiry", () => {
  assert.ok(validateProtectedVideoUrl(signedUrl().href, project));
  for (const mutate of [url => { url.hostname = "attacker.invalid"; }, url => { url.pathname = url.pathname.replace("public/", "private/"); },
    url => url.searchParams.set("X-Goog-Expires", "901"), url => url.searchParams.set("token", "permanent-token"),
    url => url.searchParams.append("X-Goog-Expires", "10"), url => url.searchParams.set("X-Goog-Date", "20000101T000000Z")]) {
    const url = signedUrl(); mutate(url); assert.throws(() => validateProtectedVideoUrl(url.href, project));
  }
});

test("real orchestrator verifies all seven video cases and independent owned cleanup without leaking secrets", async () => {
  const h = harness(), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.failed, false); assert.equal(report.cases.length, 7); assert.equal(report.cleanupVerified, true);
  assert.deepEqual(h.state(), { userExists: false, profile: null, rate: null });
  const output = JSON.stringify(h.saved());
  for (const secret of ["DO-NOT-PRINT", "owned-synthetic-test", "@example.invalid", "X-Goog-", "storage.googleapis.com", "securetoken.google.com"])
    assert.equal(output.includes(secret), false, secret);
  assert.equal(h.calls.some(call => /telegram|nutrition|ai\//i.test(call.url.pathname)), false);
});

test("range failure reads no provider body and still removes Auth/profile/rate", async () => {
  const h = harness({ rangeFailure: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.failedStep, "signed-range-64-bytes"); assert.equal(report.cleanupVerified, true);
  assert.deepEqual(h.state(), { userExists: false, profile: null, rate: null });
  assert.equal(JSON.stringify(report).includes("DO-NOT-PRINT"), false);
});

test("Auth deletion failure does not skip profile or rate deletion; cleanup fails honestly", async () => {
  const h = harness({ authDeleteFailure: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.cleanup.authAbsent, false); assert.equal(report.cleanup.profileTreeAbsent, true); assert.equal(report.cleanup.ownedRateAbsent, true);
  assert.equal(report.failed, true); assert.equal(report.cleanupVerified, false);
});

test("profile marker mismatch prevents tree delete but not Auth/rate cleanup", async () => {
  const h = harness({ markerMismatch: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.cleanup.authAbsent, true); assert.equal(report.cleanup.profileTreeAbsent, false); assert.equal(report.cleanup.ownedRateAbsent, true);
  assert.equal(h.calls.some(call => call.method === "DELETE" && call.url.pathname.endsWith("/users/owned-synthetic-test")), false);
});

test("ambiguous signup is recovered only by exact pre-verified random email and cleaned", async () => {
  const h = harness({ ambiguousSignup: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.failedStep, "owned-account-creation"); assert.equal(report.cleanupVerified, true);
  assert.deepEqual(h.state(), { userExists: false, profile: null, rate: null });
});

test("unsigned public object fails the gate even if authenticated playback works", async () => {
  const h = harness({ unsignedPublic: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.failedStep, "unsigned-object-denied"); assert.equal(report.cleanupVerified, true);
});

test("owned nested profile tree is actually removed and collection absence verified", async () => {
  const h = harness({ nestedTree: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.cleanupVerified, true); assert.equal(h.child(), null);
  assert.ok(h.calls.some(call => call.method === "DELETE" && call.url.pathname.endsWith("/owned-child/one")));
});

test("rate ownership mismatch preserves the document and fails cleanup honestly", async () => {
  const h = harness({ rateMismatch: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.cleanup.authAbsent, true); assert.equal(report.cleanup.profileTreeAbsent, true); assert.equal(report.cleanup.ownedRateAbsent, false);
  assert.equal(h.calls.some(call => call.method === "DELETE" && call.url.pathname.includes("/securityRateLimits/")), false);
});

test("failed cleanup identity lookup with known UID still attempts profile and rate domains", async () => {
  const h = harness({ lookupFailure: true }), { report } = await runProtectedVideoSmoke(options(), h.deps);
  assert.equal(report.failedStep, "owned-account-creation");
  assert.equal(report.cleanup.authAbsent, false); assert.equal(report.cleanup.profileTreeAbsent, true); assert.equal(report.cleanup.ownedRateAbsent, true);
});

test("exclusive output initialization failure occurs before credentials or transport", async () => {
  let tokenCalled = false, fetchCalled = false;
  await assert.rejects(runProtectedVideoSmoke(options(), {
    createArtifact: async () => { throw Error("exclusive-output-refused"); },
    operatorToken: async () => { tokenCalled = true; }, fetchImpl: async () => { fetchCalled = true; }
  }));
  assert.equal(tokenCalled, false); assert.equal(fetchCalled, false);
});

test("raw provider messages and credentials are never returned as safe errors", () => {
  assert.deepEqual(safeProtectedVideoError(Error("Bearer secret https://private-signed-url")), { code: "operation-failed" });
  assert.deepEqual(safeProtectedVideoError({ smokeCode: "token=secret" }), { code: "operation-failed" });
});
