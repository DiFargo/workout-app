import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createProtectedExerciseVideoAccess, resolveProtectedExerciseVideoSource,
  EXERCISE_VIDEO_PRIVATE_CACHE, EXERCISE_VIDEO_URL_TTL_MS } from "../functions/protectedExerciseVideo.js";
import { resolveExerciseVideoPreviewAssetPath, normalizeExerciseVideoPreviewTimeMs,
  EXERCISE_VIDEO_PREVIEW_MAX_BYTES } from "../functions/exerciseVideoPreviewAsset.js";

const bucket = "tren-85720.firebasestorage.app";
const objectPath = "protected-workout-videos/public/Жим.mp4";
const source = "/videos/Жим.mp4";
const context = { uid: "synthetic-member", userData: { role: "client" } };
const now = Date.parse("2026-10-25T10:00:00Z");
const videoUrl = "https://storage.googleapis.com/synthetic-video?X-Goog-Signature=test";
const posterUrl = "https://storage.googleapis.com/synthetic-poster?X-Goog-Signature=test";

function fixture({ poster = {}, posterError, posterSignError, videoError, videoType = "video/mp4" } = {}) {
  const calls = [];
  const storage = { bucket(name) {
    calls.push(["bucket", name]);
    return { file(path) {
      calls.push(["file", path]);
      const isPoster = path.startsWith("protected-exercise-previews/");
      return {
        async getMetadata() {
          calls.push(["metadata", path]);
          if (isPoster && posterError) throw posterError;
          if (!isPoster && videoError) throw videoError;
          return [isPoster ? { name: path, bucket: name, contentType: "image/webp", size: "24000",
            cacheControl: EXERCISE_VIDEO_PRIVATE_CACHE, metadata: {}, ...poster }
            : { name: path, bucket: name, contentType: videoType, cacheControl: EXERCISE_VIDEO_PRIVATE_CACHE, metadata: {} }];
        },
        async setMetadata() { throw new Error("Unexpected policy mutation"); },
        async getSignedUrl(options) {
          calls.push(["sign", path, options]);
          if (isPoster && posterSignError) throw posterSignError;
          return [isPoster ? posterUrl : videoUrl];
        }
      };
    } };
  } };
  return { storage, calls };
}

test("preview path hashes canonical bucket/path and millisecond time, not source spelling or crop", () => {
  const expected = createHash("sha256").update(JSON.stringify(["v1", bucket, objectPath, 1235])).digest("hex");
  const path = resolveExerciseVideoPreviewAssetPath({ bucket, objectPath, previewTime: 1.2346 });
  assert.equal(path, `protected-exercise-previews/v1/${expected}.webp`);
  assert.equal(path, resolveExerciseVideoPreviewAssetPath({ bucket, objectPath, previewTime: 1.235, crop: { zoom: 2 } }));
  for (const spelling of [source, `gs://${bucket}/${objectPath}`,
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=synthetic`]) {
    assert.equal(resolveExerciseVideoPreviewAssetPath({ ...resolveProtectedExerciseVideoSource(spelling), previewTime: 1.235 }), path);
  }
  for (const changes of [{ bucket: "other" }, { objectPath: `${objectPath}2` }, { previewTime: 1.236 }]) {
    assert.notEqual(resolveExerciseVideoPreviewAssetPath({ bucket, objectPath, previewTime: 1.235, ...changes }), path);
  }
  assert.equal(normalizeExerciseVideoPreviewTimeMs(0), 0);
  assert.equal(normalizeExerciseVideoPreviewTimeMs(86400), 86400000);
});

test("omitted, null and invalid preview times preserve the exact legacy response without preview storage access", async () => {
  for (const previewTime of [undefined, null, -1, 86400.001, NaN, Infinity, "1.2", {}, [], true]) {
    const f = fixture();
    const result = await createProtectedExerciseVideoAccess({ storage: f.storage, context, source, previewTime, now });
    assert.deepEqual(result, { ok: true, url: videoUrl, expiresAt: new Date(now + EXERCISE_VIDEO_URL_TTL_MS).toISOString() });
    assert.equal(normalizeExerciseVideoPreviewTimeMs(previewTime), null);
    assert.equal(f.calls.filter(([kind]) => kind === "file").length, 1);
  }
});

test("valid private WebP is signed after source verification with the same fifteen-minute expiry", async () => {
  for (const role of ["client", "trainer", "admin"]) {
    const f = fixture();
    const result = await createProtectedExerciseVideoAccess({ storage: f.storage, context: { ...context, userData: { role } },
      source, previewTime: 0, now });
    assert.deepEqual(result, { ok: true, url: videoUrl, posterUrl, expiresAt: new Date(now + 900000).toISOString() });
    const imagePath = resolveExerciseVideoPreviewAssetPath({ bucket, objectPath, previewTime: 0 });
    assert.deepEqual(f.calls.find(([kind, path]) => kind === "sign" && path === imagePath),
      ["sign", imagePath, { version: "v4", action: "read", expires: now + 900000, responseDisposition: "inline", responseType: "image/webp" }]);
    assert.ok(f.calls.findIndex(([kind, path]) => kind === "metadata" && path === objectPath) <
      f.calls.findIndex(([kind, path]) => kind === "sign" && path === imagePath));
  }
});

test("missing, inaccessible and mismatched posters fall back to video without signing unsafe images", async () => {
  const cases = [{ posterError: { code: 404 } }, { posterError: { code: 403 } }, { posterError: new Error("synthetic-storage-failure") },
    { poster: { contentType: "video/mp4" } }, { poster: { contentType: "image/png" } },
    { poster: { cacheControl: "public, max-age=3600" } },
    { poster: { metadata: { firebaseStorageDownloadTokens: "synthetic-token" } } },
    { poster: { name: "protected-exercise-previews/v1/wrong.webp" } }, { poster: { bucket: "other-bucket" } },
    ...[0, -1, "not-a-size", undefined, EXERCISE_VIDEO_PREVIEW_MAX_BYTES + 1].map(size => ({ poster: { size } }))];
  for (const options of cases) {
    const f = fixture(options);
    const result = await createProtectedExerciseVideoAccess({ storage: f.storage, context, source, previewTime: 1.2, now });
    assert.equal(result.url, videoUrl);
    assert.equal(result.posterUrl, "");
    assert.equal(f.calls.filter(([kind]) => kind === "sign").length, 1);
  }
  const f = fixture({ posterSignError: new Error("synthetic-signing-failure") });
  const result = await createProtectedExerciseVideoAccess({ storage: f.storage, context, source, previewTime: 1.2, now });
  assert.equal(result.posterUrl, "");
  assert.equal(result.url, videoUrl);
});

test("optional preview starts after source validation without waiting for video signing", async () => {
  let releaseVideo;
  let posterStarted;
  const posterStartedPromise = new Promise(resolve => { posterStarted = resolve; });
  const calls = [];
  const storage = { bucket() { return { file(path) {
    const isPoster = path.startsWith("protected-exercise-previews/");
    return {
      async getMetadata() {
        calls.push(isPoster ? "poster-metadata" : "video-metadata");
        if (isPoster) posterStarted();
        return [{ contentType: isPoster ? "image/webp" : "video/mp4", size: "24000",
          cacheControl: EXERCISE_VIDEO_PRIVATE_CACHE, metadata: {} }];
      },
      async getSignedUrl() {
        calls.push(isPoster ? "poster-sign" : "video-sign");
        if (isPoster) return [posterUrl];
        return new Promise(resolve => { releaseVideo = resolve; });
      }
    };
  } }; } };
  const pending = createProtectedExerciseVideoAccess({ storage, context, source, previewTime: 1.2, now });
  await posterStartedPromise;
  assert.equal(calls[0], "video-metadata");
  assert.ok(calls.includes("video-sign"));
  assert.ok(calls.includes("poster-metadata"));
  releaseVideo([videoUrl]);
  assert.equal((await pending).posterUrl, posterUrl);
});

test("poster requests cannot bypass membership, source path or video metadata checks", async () => {
  for (const deniedContext of [undefined, { uid: "member", userData: { role: "outsider" } },
    { uid: "member", userData: { role: "client", active: false } },
    { uid: "member", userData: { role: "trainer", archived: true } },
    { uid: "member", userData: { role: "admin", accessDisabled: true } },
    { uid: "member", userData: { role: "client", accountAccessStatus: "awaiting_trainer" } },
    { uid: "member", userData: { role: "client", membershipStatus: "suspended" } },
    { uid: "member", userData: { role: "client", membershipStatus: "revoked" } }]) {
    const f = fixture();
    await assert.rejects(createProtectedExerciseVideoAccess({ storage: f.storage, context: deniedContext, source, previewTime: 1.2, now }),
      error => [401, 403].includes(error.status));
    assert.deepEqual(f.calls, []);
  }
  for (const deniedSource of [`gs://${bucket}/protected-exercise-previews/v1/arbitrary.webp`,
    `gs://${bucket}/users/private.mp4`, "https://evil.invalid/video.mp4", "/videos/%2e%2e%2fprivate.mp4"]) {
    const f = fixture();
    await assert.rejects(createProtectedExerciseVideoAccess({ storage: f.storage, context, source: deniedSource, previewTime: 1.2, now }),
      error => [400, 403].includes(error.status));
    assert.deepEqual(f.calls, []);
  }
  for (const options of [{ videoError: { code: 404 } }, { videoType: "image/webp" }]) {
    const f = fixture(options);
    await assert.rejects(createProtectedExerciseVideoAccess({ storage: f.storage, context, source, previewTime: 1.2, now }));
    assert.equal(f.calls.some(([kind, path]) => kind === "file" && path.startsWith("protected-exercise-previews/")), false);
    assert.equal(f.calls.some(([kind]) => kind === "sign"), false);
  }
});
