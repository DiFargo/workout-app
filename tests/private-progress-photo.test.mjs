import assert from "node:assert/strict";
import { test, after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

const auth = { currentUser: null }, app = { options: { storageBucket: "own-bucket.firebasestorage.app" } };
const listeners = new Set();
let sdkIo, sdkCalls = [];
const cleanup = installRuntimeImports({
  "/firebase.js": { app, auth },
  "firebase/auth": { onAuthStateChanged: (_, callback) => { listeners.add(callback); return () => listeners.delete(callback); } },
  "firebase/storage": {
    getStorage: () => ({}), ref: (_, path) => ({ fullPath: path }),
    getBlob: (ref, maximum) => { sdkCalls.push({ path: ref.fullPath, maximum }); return sdkIo(); }
  }
});
after(cleanup);
const { resolvePrivateProgressPhotoPath, startPrivateProgressPhotoLoad, normalizePrivateProgressPhotoBlob, PRIVATE_PROGRESS_PHOTO_MAX_BYTES } = await import("../src/utils/privateProgressPhoto.js");
const webp = (label = "photo", type = "image/webp") => new Blob(["RIFF", new Uint8Array([4, 0, 0, 0]), "WEBP", label], { type });
const bucket = app.options.storageBucket, path = "progress-photos/owner/session/front.webp";
const source = `gs://${bucket}/${path}`;
const oldToken = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=PRIVATE-OLD-TOKEN`;
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; return { promise: new Promise(yes => { resolve = yes; }), resolve: value => resolve(value) }; }
function login(user) { auth.currentUser = user; advanceAuthSession(auth); [...listeners].forEach(callback => callback(user)); }
function fixture() {
  login({ uid: "viewer" }); sdkCalls = [];
  const states = [], created = [], revoked = [];
  const urlApi = { createObjectURL: blob => { const url = `blob:private-${created.length}`; created.push({ url, blob }); return url; }, revokeObjectURL: url => revoked.push(url) };
  return { states, created, revoked, start: value => startPrivateProgressPhotoLoad({ source: value, onState: state => states.push(state), urlApi }) };
}

test("strict private resolver accepts only own-bucket progress object identities", () => {
  assert.equal(resolvePrivateProgressPhotoPath(source, bucket), path);
  assert.equal(resolvePrivateProgressPhotoPath(oldToken, bucket), path);
  assert.equal(resolvePrivateProgressPhotoPath(path, bucket), path);
  for (const invalid of [
    `gs://other-bucket/${path}`, `gs://${bucket}/exercise-videos/foo/bar.mp4`,
    "https://evil.test/private.webp", `https://firebasestorage.googleapis.com.evil.test/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
    `http://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
    `https://firebasestorage.googleapis.com/v0/b/other/o/${encodeURIComponent(path)}`,
    `gs://${bucket}/progress-photos/owner/../secret`, "data:image/png;base64,eA==", "blob:https://app.test/old",
    `gs://${bucket}/progress-photos/owner/session/a%2Fb`, `gs://${bucket}/progress-photos/owner/session/front.webp?token=x`
  ]) assert.equal(resolvePrivateProgressPhotoPath(invalid, bucket), "", invalid);
});

test("legacy token URL is read by guarded SDK path, with 10MiB cap and no token HTTP request", async () => {
  const h = fixture(); sdkIo = async () => webp();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail("must never request historical public URL");
  try {
    const request = h.start(oldToken); await request.completion;
    assert.deepEqual(sdkCalls, [{ path, maximum: 10 * 1024 * 1024 }]);
    assert.equal(h.states.at(-1).status, "ready"); assert.equal(h.created.length, 1);
    assert.equal(h.states.at(-1).url, "blob:private-0"); request.dispose();
    assert.deepEqual(h.revoked, ["blob:private-0"]); assert.equal(request.signal.aborted, true);
  } finally { globalThis.fetch = originalFetch; }
});

test("unmounted/out-of-order downloads settle cancelled and never create or publish old blobs", async () => {
  const h = fixture(), first = deferred(), second = deferred(); let index = 0;
  sdkIo = () => (++index === 1 ? first.promise : second.promise);
  const a = h.start(source); await flush(); a.dispose(); await a.completion;
  const b = h.start(`gs://${bucket}/progress-photos/owner/session/back.webp`); await flush();
  second.resolve(webp("B")); await b.completion;
  first.resolve(webp("A")); await flush();
  assert.equal(h.created.length, 1); assert.equal(await h.created[0].blob.text(), await webp("B").text());
  b.dispose(); assert.deepEqual(h.revoked, ["blob:private-0"]);
});

for (const change of ["logout", "same-account re-login"]) test(`${change} clears/revokes a loaded image and suppresses pending private work`, async () => {
  const h = fixture(); sdkIo = async () => webp();
  const loaded = h.start(source); await loaded.completion;
  const pendingIo = deferred(); sdkIo = () => pendingIo.promise;
  const pending = h.start(source); await flush(); const user = auth.currentUser;
  login(null); if (change !== "logout") login(user);
  await pending.completion;
  assert.deepEqual(h.revoked, ["blob:private-0"]); assert.equal(h.states.at(-1).url, "");
  pendingIo.resolve(webp("old")); await flush();
  assert.equal(h.created.length, 1); loaded.dispose(); pending.dispose(); assert.equal(listeners.size, 0);
});

test("external/data sources and non-image/oversize SDK blobs fail closed without creating public media", async () => {
  const h = fixture(); sdkIo = async () => webp();
  for (const value of ["https://external.test/a.jpg", "data:image/png;base64,eA=="]) {
    const request = h.start(value); await request.completion; assert.equal(h.states.at(-1).status, "error"); request.dispose();
  }
  assert.equal(sdkCalls.length, 0);
  for (const blob of [new Blob(["<svg/>"], { type: "image/svg+xml" }), new Blob([new Uint8Array(PRIVATE_PROGRESS_PHOTO_MAX_BYTES + 1)], { type: "image/webp" })]) {
    sdkIo = async () => blob; const request = h.start(source); await request.completion;
    assert.equal(h.states.at(-1).status, "error"); request.dispose();
  }
  assert.equal(h.created.length, 0);
});

test("bounded image signatures restore empty SDK MIME only, and reject foreign or mismatched MIME", async () => {
  const signatures = [
    ["image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    ["image/jpeg", new Uint8Array([255, 216, 255, 224])],
    ["image/gif", "GIF87a"], ["image/gif", "GIF89a"],
    ["image/webp", new Uint8Array(await webp().arrayBuffer())],
    ["image/avif", new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 97, 118, 105, 102, 0, 0, 0, 0, 109, 105, 102, 49])],
    ["image/avif", new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 109, 105, 102, 49, 0, 0, 0, 0, 97, 118, 105, 115])]
  ];
  for (const [type, signature] of signatures) {
    const original = new Blob([signature]);
    const restored = await normalizePrivateProgressPhotoBlob(original);
    assert.equal(restored.type, type); assert.deepEqual(await restored.arrayBuffer(), await original.arrayBuffer());
    const typed = new Blob([signature], { type }); assert.equal(await normalizePrivateProgressPhotoBlob(typed), typed);
    await assert.rejects(normalizePrivateProgressPhotoBlob(new Blob([signature], { type: "text/html" })));
    await assert.rejects(normalizePrivateProgressPhotoBlob(new Blob([signature], { type: type === "image/png" ? "image/jpeg" : "image/png" })));
  }
  for (const blob of [new Blob([]), new Blob(["<html>photo</html>"], { type: "image/png" }),
    new Blob(["<svg/>"], { type: "image/svg+xml" }), new Blob(["RIFFxxxxWAVE"]),
    new Blob([new Uint8Array([137, 80, 78, 71])]), new Blob(["xxxxftypavif"]),
    new Blob([new Uint8Array(PRIVATE_PROGRESS_PHOTO_MAX_BYTES + 1)])]) await assert.rejects(normalizePrivateProgressPhotoBlob(blob));
});

for (const change of ["logout", "unmount", "same-account re-login"]) test(`${change} during async header validation cannot publish a typed blob`, async () => {
  const h = fixture(), header = deferred(); let reads = 0;
  class DelayedBlob extends Blob {
    slice(start, end) { assert.equal(start, 0); assert.equal(end, 32); reads++; return { arrayBuffer: () => header.promise }; }
  }
  sdkIo = async () => new DelayedBlob(["RIFFxxxxWEBP"]);
  const request = h.start(source); await flush(); assert.equal(reads, 1);
  const user = auth.currentUser;
  if (change === "unmount") request.dispose();
  else { login(null); if (change === "same-account re-login") login(user); }
  await request.completion;
  header.resolve(await webp().arrayBuffer()); await flush();
  assert.equal(h.created.length, 0); assert.equal(request.signal.aborted, true); request.dispose();
});
