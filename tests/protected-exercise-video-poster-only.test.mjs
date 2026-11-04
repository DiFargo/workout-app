import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { createProtectedExerciseVideoAccess as createBackend, EXERCISE_VIDEO_PRIVATE_CACHE } from "../functions/protectedExerciseVideo.js";

const cleanup = installRuntimeImports({
  "/src/firebase.js": { app: { options: { storageBucket: "app.test" } }, auth: { currentUser: null } },
  "firebase/auth": { onAuthStateChanged: () => () => {} },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout: async () => assert.fail("Real network forbidden") }
});
const { createProtectedExerciseVideoAccess: createService } = await import("../src/utils/protectedExerciseVideo.js");
cleanup();
const bucket = "app.test", source = `gs://${bucket}/exercise-videos/one.mp4`;
const context = { uid: "synthetic", userData: { role: "client", active: true } };
function storageFixture({ missingPoster = false } = {}) {
  const calls = [];
  const storage = { bucket: () => ({ file: path => {
    const poster = path.endsWith(".webp");
    return {
      async getMetadata() { calls.push(["metadata", poster ? "poster" : "video"]);
        if (poster && missingPoster) throw Object.assign(new Error("missing"), { code: 404 });
        return [{ name: path, bucket, contentType: poster ? "image/webp" : "video/mp4", size: poster ? "128" : "1000", cacheControl: EXERCISE_VIDEO_PRIVATE_CACHE }]; },
      async getSignedUrl() { calls.push(["sign", poster ? "poster" : "video"]); return [`https://local-media.test/${poster ? "poster.webp" : "video.mp4"}`]; },
      async setMetadata() { assert.fail("Policy already current; no storage mutation expected"); }
    };
  } }) };
  return { storage, calls };
}

test("posterOnly validates the same source and membership but signs zero video URLs, including missing poster", async () => {
  for (const missingPoster of [false, true]) {
    const f = storageFixture({ missingPoster });
    const result = await createBackend({ storage: f.storage, bucketName: bucket, context, source, previewTime: 0, posterOnly: true, now: 1000 });
    assert.equal(result.posterOnly, true); assert.equal(result.url, undefined);
    assert.equal(result.expiresAt, new Date(901000).toISOString());
    assert.equal(Boolean(result.posterUrl), !missingPoster);
    assert.equal(f.calls.filter(([type, target]) => type === "sign" && target === "video").length, 0);
    await assert.rejects(createBackend({ storage: f.storage, bucketName: bucket, context: { ...context, userData: { role: "client", accessDisabled: true } }, source, posterOnly: true }), { status: 403 });
    await assert.rejects(createBackend({ storage: f.storage, bucketName: bucket, context, source: "gs://other.test/exercise-videos/one.mp4", posterOnly: true }), { status: 403 });
    await assert.rejects(createBackend({ storage: f.storage, bucketName: bucket, context: {}, source, posterOnly: true }), { status: 401 });
  }
});

test("actual service prefetch signs only poster; Play requires separate capability and same-UID relogin clears both", async () => {
  const f = storageFixture(), requests = [], revoked = [];
  let user = { uid: "synthetic" }, observer;
  const service = createService({ bucket, origin: "https://app.test", getUser: () => user,
    observeAuth: fn => { observer = fn; return () => {}; }, now: () => 1000,
    request: async (_url, options) => { const body = JSON.parse(options.body); requests.push(body);
      const result = await createBackend({ storage: f.storage, bucketName: bucket, context, ...body, now: 1000 });
      return { ok: true, json: async () => result }; },
    fetchPoster: async () => new Response(new Uint8Array(128), { headers: { "content-type": "image/webp" } }),
    createObjectURL: () => "blob:synthetic-poster", revokeObjectURL: url => revoked.push(url)
  });
  try {
    const [poster, signed] = await Promise.all([service.prefetchPoster(source, { previewTime: 0 }), service.resolve(source, { previewTime: 0, posterOnly: true })]);
    assert.equal(poster.url, "blob:synthetic-poster"); assert.equal(signed.url, undefined);
    assert.deepEqual(requests, [{ source, previewTime: 0, posterOnly: true }]);
    assert.deepEqual(f.calls.filter(([type]) => type === "sign"), [["sign", "poster"]]);
    const video = await service.resolve(source, { previewTime: 0 });
    assert.equal(video.url, "https://local-media.test/video.mp4");
    assert.equal(requests.length, 2); assert.equal(requests[1].posterOnly, undefined);
    await service.resolve(source, { previewTime: 0 }); assert.equal(requests.length, 2);
    user = null; observer(user); user = { uid: "synthetic" }; observer(user);
    assert.deepEqual(revoked, [poster.url]); assert.equal(service.getCachedPoster(source, { previewTime: 0 }), null);
    await service.resolve(source, { previewTime: 0, posterOnly: true }); assert.equal(requests.length, 3);
  } finally { service.dispose(); }
});

test("actual endpoint body retains active-member/AppCheck boundary, common rate limit, CORS and strict posterOnly flag", async () => {
  const sourceText = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
  const start = sourceText.indexOf("export const exerciseVideoAccess = onRequest(");
  const block = sourceText.slice(start, sourceText.indexOf("\nexport const ", start + 1));
  const calls = [], f = storageFixture();
  const handler = new Function("onRequest", "requireActiveMember", "enforceRateLimit", "createProtectedExerciseVideoAccess", "admin", "getStorageBucketName", "json", "getHttpErrorStatus",
    block.replace("export const exerciseVideoAccess =", "return"))(
    (options, fn) => { assert.equal(options.cors, true); return fn; },
    async req => { calls.push("active-member"); if (!req.authorized) throw Object.assign(new Error("Auth/AppCheck required"), { status: 401 }); return context; },
    async (uid, scope, limits) => { calls.push("limit"); assert.equal(uid, context.uid); assert.equal(scope, "exercise-video-access"); assert.deepEqual(limits, { limit: 120, windowMs: 60000 }); },
    createBackend, { storage: () => f.storage }, () => bucket,
    (res, status, body) => { res.status = status; res.body = body; return body; }, error => error.status || 500);
  const response = () => ({ set(name, value) { assert.equal(name, "Cache-Control"); assert.equal(value, "private, no-store"); } });
  const denied = response(); await handler({ method: "POST", body: { source, posterOnly: true } }, denied);
  assert.equal(denied.status, 401); assert.deepEqual(calls, ["active-member"]);
  const allowed = response(); await handler({ method: "POST", authorized: true, body: { source, previewTime: 0, posterOnly: true } }, allowed);
  assert.equal(allowed.status, 200); assert.equal(allowed.body.url, undefined); assert.equal(allowed.body.posterOnly, true);
  assert.deepEqual(calls, ["active-member", "active-member", "limit"]);
  const ordinary = response(); await handler({ method: "POST", authorized: true, body: { source, posterOnly: "true" } }, ordinary);
  assert.equal(ordinary.status, 200); assert.ok(ordinary.body.url);
});
