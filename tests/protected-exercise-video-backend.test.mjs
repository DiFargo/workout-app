import assert from "node:assert/strict";
import test from "node:test";
import { createProtectedExerciseVideoAccess, resolveProtectedExerciseVideoSource,
  EXERCISE_VIDEO_PRIVATE_CACHE, EXERCISE_VIDEO_URL_TTL_MS } from "../functions/protectedExerciseVideo.js";

const bucket = "tren-85720.firebasestorage.app";
const context = { uid: "client", userData: { role: "client" } };
const now = Date.parse("2026-10-17T10:00:00Z");

function storageFixture(metadata = {}) {
  const f = { metadata: { contentType: "video/mp4", cacheControl: "public, max-age=31536000",
    metadata: { firebaseStorageDownloadTokens: "old-permanent-token", retained: "keep" }, ...metadata }, calls: [] };
  const file = {
    async getMetadata() { f.calls.push(["getMetadata"]); if (f.getError) throw f.getError; return [structuredClone(f.metadata)]; },
    async setMetadata(patch) {
      f.calls.push(["setMetadata", patch]); if (f.setError) throw f.setError;
      f.metadata.cacheControl = patch.cacheControl;
      if (patch.metadata?.firebaseStorageDownloadTokens === null) delete f.metadata.metadata.firebaseStorageDownloadTokens;
    },
    async getSignedUrl(options) { f.calls.push(["getSignedUrl", options]); if (f.signError) throw f.signError; return ["https://storage.googleapis.com/synthetic?X-Goog-Signature=test"]; }
  };
  f.storage = { bucket(name) { f.calls.push(["bucket", name]); return { file(path) { f.calls.push(["file", path]); return file; } }; } };
  return f;
}

test("backend accepts only owned video paths and resolves encoded Cyrillic/source query parameters exactly", () => {
  const name = "Жим гантелей лёжа.mp4";
  assert.deepEqual(resolveProtectedExerciseVideoSource(`/videos/${encodeURIComponent(name)}?v=2#preview`), {
    bucket, objectPath: `protected-workout-videos/public/${name}`
  });
  for (const path of ["workout-videos/one.mp4", `exercise-videos/trainer/program/${name}`,
    "template-exercise-videos/trainer/program/one.webm", "basic-exercise-assets/press/videos/one.mov", "protected-workout-videos/public/one.mp4"]) {
    for (const source of [`gs://${bucket}/${path}`, `https://storage.googleapis.com/${bucket}/${path}?X-Goog-Signature=old`,
      `https://${bucket}.storage.googleapis.com/${path}`, `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=old&source=https://evil.invalid`]) {
      assert.deepEqual(resolveProtectedExerciseVideoSource(source), { bucket, objectPath: path });
    }
  }
});

test("backend rejects arbitrary hosts/buckets, private non-video areas, credentials, and raw/encoded traversal", () => {
  for (const source of ["https://evil.invalid/video.mp4", "gs://other-project.firebasestorage.app/exercise-videos/one.mp4",
    `http://storage.googleapis.com/${bucket}/exercise-videos/one.mp4`, `gs://${bucket}/users/client/private.mp4`,
    `gs://${bucket}/basic-exercise-assets/one/images/private.mp4`, "/videos/../private.mp4", "/videos/%2e%2e%2fprivate.mp4",
    "/videos/nested/one.mp4", `gs://${bucket}/exercise-videos/../workout-videos/one.mp4`,
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/exercise-videos%2F..%2Fworkout-videos%2Fone.mp4`,
    `https://storage.googleapis.com/${bucket}/workout-videos/%252e%252e/one.mp4`,
    `https://user:pass@storage.googleapis.com/${bucket}/workout-videos/one.mp4`, "/videos/%00one.mp4", "/videos/%ZZ.mp4", "", null]) {
    assert.throws(() => resolveProtectedExerciseVideoSource(source), error => [400, 403].includes(error.status), String(source));
  }
});

test("backend removes download tokens before a fifteen-minute inline V4 read and skips repeated policy writes", async () => {
  const f = storageFixture();
  const result = await createProtectedExerciseVideoAccess({ storage: f.storage, context, source: "/videos/one.mp4", now });
  assert.equal(result.ok, true);
  assert.equal(result.expiresAt, new Date(now + 15 * 60 * 1000).toISOString());
  assert.equal(EXERCISE_VIDEO_URL_TTL_MS, 15 * 60 * 1000);
  assert.equal(f.metadata.metadata.firebaseStorageDownloadTokens, undefined);
  assert.equal(f.metadata.metadata.retained, "keep");
  assert.equal(f.metadata.cacheControl, EXERCISE_VIDEO_PRIVATE_CACHE);
  assert.deepEqual(f.calls.find(([method]) => method === "getSignedUrl")[1], {
    version: "v4", action: "read", expires: now + 900000, responseDisposition: "inline", responseType: "video/mp4"
  });
  assert.ok(f.calls.findIndex(([method]) => method === "setMetadata") < f.calls.findIndex(([method]) => method === "getSignedUrl"));
  await createProtectedExerciseVideoAccess({ storage: f.storage, context, source: "/videos/one.mp4", now: now + 1000 });
  assert.equal(f.calls.filter(([method]) => method === "setMetadata").length, 1);
});

test("backend permits active roles only and rejects non-video content, missing objects and unsafe signing failures", async () => {
  for (const profile of [{ role: "client", active: false }, { role: "trainer", archived: true }, { role: "admin", accessDisabled: true },
    { role: "client", accountAccessStatus: "awaiting_trainer" }, { role: "client", membershipStatus: "suspended" }, { role: "client", membershipStatus: "revoked" }, { role: "outsider" }]) {
    const f = storageFixture();
    await assert.rejects(createProtectedExerciseVideoAccess({ storage: f.storage, context: { uid: "user", userData: profile }, source: "/videos/one.mp4", now }), { status: 403 });
    assert.deepEqual(f.calls, []);
  }
  const anonymous = storageFixture();
  await assert.rejects(createProtectedExerciseVideoAccess({ storage: anonymous.storage, source: "/videos/one.mp4", now }), { status: 401 });
  for (const role of ["client", "trainer", "admin"]) {
    const f = storageFixture({ cacheControl: EXERCISE_VIDEO_PRIVATE_CACHE, metadata: {} });
    assert.equal((await createProtectedExerciseVideoAccess({ storage: f.storage, context: { uid: "user", userData: { role } }, source: "/videos/one.mp4", now })).ok, true);
    assert.equal(f.calls.some(([method]) => method === "setMetadata"), false);
  }
  for (const [failure, status, code] of [["missing", 404, "video-not-found"], ["type", 403, "video-content-forbidden"],
    ["metadata", 503, "video-protection-unavailable"], ["signing", 503, "video-signing-unavailable"]]) {
    const f = storageFixture();
    if (failure === "missing") f.getError = { code: 404 };
    if (failure === "type") f.metadata.contentType = "text/html";
    if (failure === "metadata") f.setError = new Error("private-synthetic-detail");
    if (failure === "signing") f.signError = new Error("private-synthetic-detail");
    await assert.rejects(createProtectedExerciseVideoAccess({ storage: f.storage, context, source: "/videos/one.mp4", now }), error =>
      error.status === status && error.code === code && !error.message.includes("private-synthetic-detail"));
    if (failure === "metadata") assert.equal(f.calls.some(([method]) => method === "getSignedUrl"), false);
  }
});
