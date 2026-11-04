import assert from "node:assert/strict";
import test from "node:test";
import { protectPrivateProgressPhoto, PRIVATE_PROGRESS_PHOTO_CACHE, PRIVATE_PROGRESS_PHOTO_MAX_BYTES }
  from "../functions/privateProgressPhotoProtection.js";

const bucketName = "tren-85720.firebasestorage.app";
const objectName = "progress-photos/synthetic-uid/photo-123/front.webp";
function fixture() {
  const versions = new Map([
    ["100", { generation: "100", bucket: bucketName, name: objectName, size: "1024", contentType: "image/webp",
      cacheControl: "public,max-age=31536000", metadata: { firebaseStorageDownloadTokens: "synthetic-old-token", sentinel: "preserved" } }],
    ["200", { generation: "200", bucket: bucketName, name: objectName, size: "1024", contentType: "image/webp",
      metadata: { firebaseStorageDownloadTokens: "synthetic-new-token", sentinel: "new-version" } }]
  ]);
  const calls = [];
  const f = { versions, calls, readError: null, writeError: null, responseGeneration: null };
  const storage = { bucket(name) {
    calls.push(["bucket", name]);
    assert.equal(name, bucketName);
    return { file(path, options) {
      calls.push(["file", path, options]);
      assert.equal(path, objectName);
      assert.deepEqual(options, { generation: "100" });
      return {
        async getMetadata() {
          calls.push(["getMetadata"]);
          if (f.readError) throw f.readError;
          return [structuredClone(versions.get(f.responseGeneration || options.generation))];
        },
        async setMetadata(patch) {
          calls.push(["setMetadata", structuredClone(patch)]);
          if (f.writeError) throw f.writeError;
          const metadata = versions.get(options.generation);
          metadata.cacheControl = patch.cacheControl;
          for (const [key, value] of Object.entries(patch.metadata || {})) {
            if (value === null) delete metadata.metadata[key];
            else metadata.metadata[key] = value;
          }
        },
        getSignedUrl() { assert.fail("Private-photo finalize must not sign a URL"); },
        delete() { assert.fail("Private-photo finalize must not delete an object"); }
      };
    } };
  } };
  const event = { data: { bucket: bucketName, name: objectName, generation: "100", size: "1024", contentType: "image/webp" } };
  return Object.assign(f, { storage, event, run: () => protectPrivateProgressPhoto({ storage, event, bucketName }) });
}

test("private photo protection removes only the permanent token from the finalized generation", async () => {
  const f = fixture(), newer = structuredClone(f.versions.get("200"));
  assert.deepEqual(await f.run(), { protected: true, changed: true });
  assert.equal(f.versions.get("100").metadata.firebaseStorageDownloadTokens, undefined);
  assert.equal(f.versions.get("100").metadata.sentinel, "preserved");
  assert.equal(f.versions.get("100").cacheControl, PRIVATE_PROGRESS_PHOTO_CACHE);
  assert.deepEqual(f.versions.get("200"), newer, "a later overwrite is never addressed");
  assert.deepEqual(f.calls.find(([name]) => name === "setMetadata")[1], {
    cacheControl: PRIVATE_PROGRESS_PHOTO_CACHE, metadata: { firebaseStorageDownloadTokens: null }
  });
});

test("repeat delivery is idempotent and returns no permanent URL or metadata", async () => {
  const f = fixture();
  await f.run();
  assert.deepEqual(await f.run(), { protected: true, changed: false });
  assert.equal(f.calls.filter(([name]) => name === "setMetadata").length, 1);
  assert.equal(JSON.stringify(await f.run()).includes("token"), false);
});

test("missing token still sets private caching without replacing other metadata", async () => {
  const f = fixture();
  delete f.versions.get("100").metadata.firebaseStorageDownloadTokens;
  assert.deepEqual(await f.run(), { protected: true, changed: true });
  assert.deepEqual(f.calls.find(([name]) => name === "setMetadata")[1], { cacheControl: PRIVATE_PROGRESS_PHOTO_CACHE });
  assert.equal(f.versions.get("100").metadata.sentinel, "preserved");
});

test("foreign bucket, non-photo prefixes, path traversal and malformed generations cause no Storage operations", async () => {
  for (const patch of [
    { bucket: "another.firebasestorage.app" }, { name: "exercise-videos/user/photo/video.mp4" },
    { name: "progress-photos/user/../front.webp" }, { name: "progress-photos/user/./front.webp" },
    { name: "progress-photos/user/photo/nested/front.webp" }, { name: "progress-photos/user//front.webp" },
    { name: "progress-photos/user/photo/%2e%2e" }, { name: "progress-photos/user/photo/a\\b.webp" },
    { name: "progress-photos/user/photo/front\u0000.webp" }, { generation: "" }, { generation: "1/2" },
    { generation: "9007199254740993" }, { generation: 1.5 }, { generation: -1 }, { generation: 9007199254740992 }
  ]) {
    const f = fixture(); Object.assign(f.event.data, patch);
    assert.equal((await f.run()).skipped, true, JSON.stringify(patch));
    assert.deepEqual(f.calls, []);
  }
});

test("Storage numeric generation is normalized without losing its exact identity", async () => {
  const f = fixture(); f.event.data.generation = 100;
  assert.equal((await f.run()).protected, true);
  assert.deepEqual(f.calls.find(([name]) => name === "file")[2], { generation: "100" });
});

test("only bounded supported images are processed, including actual generation metadata", async () => {
  for (const patch of [{ contentType: "text/html" }, { contentType: "image/svg+xml" },
    { size: String(PRIVATE_PROGRESS_PHOTO_MAX_BYTES + 1) }, { size: "-1" }, { size: 0 }, { size: "NaN" }]) {
    const f = fixture(); Object.assign(f.event.data, patch);
    assert.deepEqual(await f.run(), { protected: false, skipped: true, reason: "unsupported-image" });
    assert.deepEqual(f.calls, []);
    const actual = fixture(); Object.assign(actual.versions.get("100"), patch);
    assert.equal((await actual.run()).reason, "unsupported-image");
    assert.equal(actual.calls.some(([name]) => name === "setMetadata"), false);
  }
  for (const contentType of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
    const f = fixture();
    f.event.data.contentType = contentType;
    f.versions.get("100").contentType = contentType;
    assert.equal((await f.run()).protected, true);
  }
});

test("generation mismatch cannot mutate the newest file and missing own generation is a terminal skip", async () => {
  const f = fixture(); f.responseGeneration = "200";
  assert.equal((await f.run()).reason, "generation-mismatch");
  assert.equal(f.calls.some(([name]) => name === "setMetadata"), false);
  for (const phase of ["readError", "writeError"]) {
    const missing = fixture(); missing[phase] = Object.assign(new Error("synthetic missing"), { code: 404 });
    assert.equal((await missing.run()).reason, "generation-not-found");
    assert.ok(missing.calls.filter(([name]) => name === "file").every(([, , options]) => options.generation === "100"));
  }
});

test("transient Storage failures remain retryable without exposing provider data", async () => {
  for (const phase of ["readError", "writeError"]) {
    const f = fixture(); f[phase] = Object.assign(new Error("synthetic-private-token/provider-details"), { code: 503 });
    await assert.rejects(f.run(), error => error.code === "private-photo-protection-unavailable" &&
      !error.message.includes("token") && !error.message.includes("provider-details"));
    f[phase] = null;
    assert.equal((await f.run()).protected, true);
  }
});
