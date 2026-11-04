import assert from "node:assert/strict";
import test, { after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const downloadCalls = [];
const uploadCalls = [];
const cleanup = installRuntimeImports({
  "/src/firebase.js": { app: { options: { storageBucket: "app.firebasestorage.app" } }, auth: { currentUser: null } },
  "firebase/auth": { onAuthStateChanged: () => () => {} },
  "/src/utils/apiClient.js": { fetchAuthorizedWithTimeout: async () => { throw Error("Unexpected network"); } },
  "firebase/storage": {
    getStorage: () => ({}),
    ref: (_storage, path) => ({ fullPath: path, bucket: "app.firebasestorage.app" }),
    uploadBytes: async (...args) => { uploadCalls.push(args); },
    getDownloadURL: async (reference) => { downloadCalls.push(reference.fullPath); return `https://image.test/${reference.fullPath}`; }
  }
});
after(cleanup);
const { createProtectedExerciseVideoAccess, isAppOwnedExerciseVideo, VIDEO_ACCESS_REFRESH_MARGIN_MS } = await import("../src/utils/protectedExerciseVideo.js");
const { uploadStorageFile } = await import("../src/utils/firebaseStorage.js");

const bucket = "app.firebasestorage.app";
const origin = "https://app.test";
const source = `gs://${bucket}/exercise-videos/trainer/client/press.mp4`;

test("only app-owned cloud media and same-origin public video files require signing", () => {
  const options = { bucket, origin };
  for (const value of [source,
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/exercise-videos%2Fa.mp4?alt=media&token=permanent`,
    `https://storage.googleapis.com/${bucket}/exercise-videos/a.mp4`,
    `https://${bucket}.storage.googleapis.com/exercise-videos/a.mp4`, "/videos/press.mp4", `${origin}/videos/press.mp4`]) {
    assert.equal(isAppOwnedExerciseVideo(value, options), true, value);
  }
  for (const value of ["blob:https://app.test/uuid", "data:video/mp4;base64,AA", "https://provider.test/video.mp4",
    "https://external.test/videos/press.mp4", "gs://another-bucket/press.mp4", "gs://app.appspot.com/exercise-videos/a.mp4", "/images/a.webp", "/videos/nested/a.mp4",
    "https://firebasestorage.googleapis.com/v0/b/external-bucket/o/a.mp4"]) {
    assert.equal(isAppOwnedExerciseVideo(value, options), false, value);
  }
  assert.equal(isAppOwnedExerciseVideo("/videos/press.mp4", { ...options, development: true }), false);
  assert.equal(isAppOwnedExerciseVideo(source, { ...options, development: true }), true);
});

function fixture(dependencies = {}) {
  let user = { uid: "client" };
  let clock = Date.parse("2026-10-17T12:00:00Z");
  let authListener;
  let count = 0;
  let respond = async () => ({ ok: true, json: async () => ({ ok: true, url: `https://storage.googleapis.com/signed-${count}`, expiresAt: new Date(clock + 120000).toISOString() }) });
  const calls = [];
  const service = createProtectedExerciseVideoAccess({
    getUser: () => user, observeAuth: (listener) => { authListener = listener; return () => {}; }, bucket, origin,
    now: () => clock, request: async (...args) => { count += 1; calls.push(args); return respond(); }, ...dependencies
  });
  return { service, calls, getNow: () => clock, setUser(next) { user = next; authListener(next); }, advance(ms) { clock += ms; }, setResponse(next) { respond = next; } };
}

function posterFixture({ bytes = 128 } = {}) {
  const fetches = [];
  const revoked = [];
  const blobs = new Map();
  const timers = new Map();
  let timerId = 0;
  let blobId = 0;
  let f;
  let respond = async () => new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp" } });
  f = fixture({
    fetchPoster: async (...args) => { fetches.push(args); return respond(...args); },
    createObjectURL: (blob) => { const url = `blob:poster-${++blobId}`; blobs.set(url, blob); return url; },
    revokeObjectURL: (url) => { revoked.push(url); blobs.delete(url); },
    setTimer: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: f.getNow() + delay }); return id; },
    clearTimer: (id) => timers.delete(id)
  });
  f.setResponse(async () => ({ ok: true, json: async () => ({
    url: "https://storage.googleapis.com/video.mp4", posterUrl: "https://storage.googleapis.com/poster.webp?private=signature",
    expiresAt: new Date(f.getNow() + 120000).toISOString()
  }) }));
  const advance = f.advance;
  return { ...f, fetches, revoked, blobs, timers, setPosterResponse(next) { respond = next; }, advance(ms) {
    advance(ms);
    for (const [id, timer] of timers) if (timer.at <= f.getNow()) { timers.delete(id); timer.callback(); }
  } };
}

test("access is authenticated, deduplicated in memory, and refreshed before ISO expiry", async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.service.resolve(source), f.service.resolve(source)]);
  assert.deepEqual(a, b);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(f.calls[0][1].body), { source });
  assert.equal(f.calls[0][0], "/api/exercise-video-access");
  await f.service.resolve(source);
  assert.equal(f.calls.length, 1);
  f.advance(120000 - VIDEO_ACCESS_REFRESH_MARGIN_MS);
  await f.service.resolve(source);
  assert.equal(f.calls.length, 2);
  f.setUser(null);
  await assert.rejects(f.service.resolve(source), { code: "video/auth-required" });
  f.setUser({ uid: "client" });
  await f.service.resolve(source);
  assert.equal(f.calls.length, 3, "same UID after logout must not reuse a signed link");
  f.service.dispose();
});

test("late results from an old session cannot populate a same-UID new session cache", async () => {
  const f = fixture();
  let release;
  f.setResponse(() => new Promise((resolve) => { release = resolve; }));
  const pending = f.service.resolve(source);
  f.setUser(null);
  f.setUser({ uid: "client" });
  release({ ok: true, json: async () => ({ url: "https://storage.googleapis.com/old", expiresAt: "2026-10-17T13:00:00Z" }) });
  await assert.rejects(pending, { code: "video/session-changed" });
  f.setResponse(async () => ({ ok: true, json: async () => ({ url: "https://storage.googleapis.com/new", expiresAt: "2026-10-17T13:00:00Z" }) }));
  assert.equal((await f.service.resolve(source)).url, "https://storage.googleapis.com/new");
  assert.equal(f.calls.length, 2);
  f.service.dispose();
});

test("external, blob and data URLs remain unchanged without an account or endpoint calls", async () => {
  const f = fixture();
  f.setUser(null);
  for (const url of ["https://external.test/clip.mp4", "blob:https://app.test/id", "data:video/mp4;base64,AA"]) {
    assert.deepEqual(await f.service.resolve(url), { url, expiresAt: null });
  }
  assert.equal(f.calls.length, 0);
  f.service.dispose();
});

test("same-origin absolute public video URLs are sent as backend-compatible relative paths", async () => {
  const f = fixture();
  await f.service.resolve(`${origin}/videos/press.mp4?legacy=1#preview`);
  assert.deepEqual(JSON.parse(f.calls[0][1].body), { source: "/videos/press.mp4" });
  await f.service.resolve("/videos/press.mp4");
  assert.equal(f.calls.length, 1);
  f.service.dispose();
});

test("poster signing deduplicates by source and normalized moment, never across moments or auth sessions", async () => {
  const f = fixture();
  const requests = [];
  f.setResponse(() => new Promise((resolve) => requests.push(resolve)));
  const first = f.service.resolve(source, { previewTime: 1.23451 });
  const same = f.service.resolve(source, { previewTime: 1.23452 });
  const zero = f.service.resolve(source, { previewTime: 0 });
  const plain = f.service.resolve(source);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.calls.map((call) => JSON.parse(call[1].body)), [
    { source, previewTime: 1.235 }, { source, previewTime: 0 }, { source }
  ]);
  requests.forEach((resolve, index) => resolve({ ok: true, json: async () => ({
    url: `https://storage.googleapis.com/signed-${index}`, expiresAt: "2026-10-17T13:00:00Z",
    posterUrl: `https://storage.googleapis.com/poster-${index}.webp?signature=private`
  }) }));
  const [a, b, c] = await Promise.all([first, same, zero, plain]);
  assert.equal(a, b);
  assert.notEqual(a.posterUrl, c.posterUrl);
  assert.equal((await f.service.resolve(source, { previewTime: 0 })).posterUrl, c.posterUrl);
  f.service.invalidate(source);
  f.setResponse(async () => ({ ok: true, json: async () => ({
    url: "https://storage.googleapis.com/new", expiresAt: "2026-10-17T13:00:00Z", posterUrl: "https://storage.googleapis.com/new.webp"
  }) }));
  await f.service.resolve(source, { previewTime: 0 });
  await f.service.resolve(source, { previewTime: 1.235 });
  assert.equal(f.calls.length, 5, "retry invalidates all poster variants of the source");
  f.setUser(null);
  await assert.rejects(f.service.resolve(source, { previewTime: 0 }), { code: "video/auth-required" });
  f.setUser({ uid: "client" });
  await f.service.resolve(source, { previewTime: 0 });
  assert.equal(f.calls.length, 6);
  f.service.dispose();
});

test("missing and unsafe poster URLs retain a valid video fallback without adding external requests", async () => {
  const f = fixture();
  for (const posterUrl of [undefined, "", "http://storage.googleapis.com/a.webp", "javascript:alert(1)", "data:image/webp;base64,AA"]) {
    f.setResponse(async () => ({ ok: true, json: async () => ({
      url: "https://storage.googleapis.com/video", expiresAt: "2026-10-17T13:00:00Z", posterUrl
    }) }));
    const result = await f.service.resolve(source, { previewTime: 0, force: true });
    assert.equal(result.url, "https://storage.googleapis.com/video");
    assert.equal(result.posterUrl, undefined);
  }
  f.service.dispose();
});

test("resolver rejects signing failures and invalid/expired responses; retry can recover", async () => {
  const f = fixture();
  f.setResponse(async () => ({ ok: false, json: async () => ({ error: "signing-unavailable", message: "Подпись временно недоступна" }) }));
  await assert.rejects(f.service.resolve(source), { code: "signing-unavailable" });
  for (const result of [
    { url: "javascript:alert(1)", expiresAt: "2026-10-17T13:00:00Z" },
    { url: "https://storage.googleapis.com/x", expiresAt: "invalid" },
    { url: "https://storage.googleapis.com/x", expiresAt: "2026-10-17T11:00:00Z" }
  ]) {
    f.setResponse(async () => ({ ok: true, json: async () => result }));
    await assert.rejects(f.service.resolve(source), /Ссылка на видео недоступна/);
  }
  f.setResponse(async () => ({ ok: true, json: async () => ({ url: "https://storage.googleapis.com/retry", expiresAt: "2026-10-17T13:00:00Z" }) }));
  assert.equal((await f.service.resolve(source)).url, "https://storage.googleapis.com/retry");
  f.service.dispose();
});

test("Blob-превью дедуплицируется по источнику и секунде, а resolve не ждёт загрузку WebP", async () => {
  const f = posterFixture();
  let release;
  f.setPosterResponse(() => new Promise((resolve) => { release = resolve; }));
  assert.equal(f.service.getCachedPoster(source, { previewTime: 1.23451 }), null);
  const first = f.service.prefetchPoster(source, { previewTime: 1.23451 });
  const same = f.service.prefetchPoster(source, { previewTime: 1.23452 });
  assert.equal(first, same);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.fetches.length, 1);
  assert.equal((await f.service.resolve(source, { previewTime: 1.235 })).url, "https://storage.googleapis.com/video.mp4");
  assert.equal(f.calls.length, 2, "posterOnly capability cannot authorize video playback");
  const [url, options] = f.fetches[0];
  assert.equal(url, "https://storage.googleapis.com/poster.webp?private=signature");
  assert.equal(options.mode, "cors");
  assert.equal(options.credentials, "omit");
  assert.equal(options.cache, "no-store");
  assert.equal(options.redirect, "error");
  release(new Response(new Uint8Array(128), { headers: { "Content-Type": "image/webp; charset=binary" } }));
  const result = await first;
  assert.equal(result.url, "blob:poster-1");
  assert.equal(result.expiresAt, f.getNow() + 120000 - VIDEO_ACCESS_REFRESH_MARGIN_MS);
  assert.equal(f.service.getCachedPoster(source, { previewTime: 1.235 }), result);
  assert.equal(await f.service.prefetchPoster(source, { previewTime: 1.235 }), result);
  assert.equal(f.fetches.length, 1, "готовое превью не загружается повторно");
  assert.equal(f.service.getCachedPoster(source, { previewTime: 0 }), null);
  f.service.dispose();
  assert.deepEqual(f.revoked, [result.url]);
});

test("LRU-кэш ограничен шестью обложками и 3 МиБ и отзывает вытесненные Blob URL", async () => {
  const f = posterFixture({ bytes: 512 * 1024 });
  const entries = [];
  for (let previewTime = 0; previewTime < 6; previewTime++) entries.push(await f.service.prefetchPoster(source, { previewTime }));
  assert.equal(f.blobs.size, 6);
  f.service.getCachedPoster(source, { previewTime: 0 });
  entries.push(await f.service.prefetchPoster(source, { previewTime: 6 }));
  assert.equal(f.service.getCachedPoster(source, { previewTime: 1 }), null);
  assert.equal(f.service.getCachedPoster(source, { previewTime: 0 }), entries[0]);
  assert.deepEqual(f.revoked, [entries[1].url]);
  assert.equal(f.blobs.size, 6);
  assert.equal([...f.blobs.values()].reduce((sum, blob) => sum + blob.size, 0), 3 * 1024 * 1024);
  f.service.dispose();
  assert.equal(f.blobs.size, 0);
  assert.equal(f.timers.size, 0);
});

test("ошибки сети, тип не WebP, пустое тело и превышение 512 КиБ тихо оставляют signed-image fallback", async () => {
  const f = posterFixture();
  for (const response of [
    () => { throw new TypeError("CORS denied"); },
    () => new Response("denied", { status: 403, headers: { "Content-Type": "image/webp" } }),
    () => new Response("not webp", { headers: { "Content-Type": "text/html" } }),
    () => new Response(new Uint8Array(), { headers: { "Content-Type": "image/webp" } }),
    () => new Response(new Uint8Array(10), { headers: { "Content-Type": "image/webp", "Content-Length": String(512 * 1024 + 1) } }),
    () => new Response(new Uint8Array(512 * 1024 + 1), { headers: { "Content-Type": "image/webp" } })
  ]) {
    f.setPosterResponse(response);
    assert.equal(await f.service.prefetchPoster(source, { previewTime: 0 }), null);
    assert.equal(f.service.getCachedPoster(source, { previewTime: 0 }), null);
    assert.equal(f.blobs.size, 0);
    assert.equal((await f.service.resolve(source, { previewTime: 0 })).posterUrl, "https://storage.googleapis.com/poster.webp?private=signature");
  }
  f.service.dispose();
});

test("таймаут 6 секунд прерывает WebP и не позволяет позднему ответу создать Blob", async () => {
  const f = posterFixture();
  let release;
  f.setPosterResponse(() => new Promise((resolve) => { release = resolve; }));
  const operation = f.service.prefetchPoster(source, { previewTime: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  f.advance(6000);
  assert.equal(await operation, null);
  assert.equal(f.fetches[0][1].signal.aborted, true);
  release(new Response(new Uint8Array(128), { headers: { "Content-Type": "image/webp" } }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.blobs.size, 0);
  assert.equal(f.service.getCachedPoster(source, { previewTime: 0 }), null);
  f.service.dispose();
});

test("общий таймаут prefetch не отменяет независимый resolve подписанной ссылки", async () => {
  const f = posterFixture();
  let release;
  f.setResponse(() => new Promise((resolve) => { release = resolve; }));
  const prefetch = f.service.prefetchPoster(source, { previewTime: 0 });
  const signing = f.service.resolve(source, { previewTime: 0 });
  f.advance(6000);
  assert.equal(await prefetch, null);
  release({ ok: true, json: async () => ({ url: "https://storage.googleapis.com/video.mp4",
    posterUrl: "https://storage.googleapis.com/poster.webp", expiresAt: new Date(f.getNow() + 120000).toISOString() }) });
  assert.equal((await signing).url, "https://storage.googleapis.com/video.mp4");
  assert.equal(f.fetches.length, 0);
  f.service.dispose();
});

test("выход, новый auth-объект, invalidate и dispose отзывают URL и прерывают незавершённые WebP", async () => {
  for (const action of [
    (f) => f.setUser(null),
    (f) => f.setUser({ uid: "client" }),
    (f) => f.service.invalidate(source),
    (f) => f.service.dispose()
  ]) {
    const f = posterFixture();
    const cached = await f.service.prefetchPoster(source, { previewTime: 0 });
    let release;
    f.setPosterResponse(() => new Promise((resolve) => { release = resolve; }));
    const pending = f.service.prefetchPoster(source, { previewTime: 1 });
    await new Promise((resolve) => setImmediate(resolve));
    action(f);
    assert.equal(await pending, null);
    assert.equal(f.fetches[1][1].signal.aborted, true);
    assert.equal(f.service.getCachedPoster(source, { previewTime: 0 }), null);
    assert.deepEqual(f.revoked, [cached.url]);
    release(new Response(new Uint8Array(128), { headers: { "Content-Type": "image/webp" } }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.blobs.size, 0);
    f.service.dispose();
  }
});

test("TTL обложки заканчивается на 30 секунд раньше подписи; истечение отзывает кэш и прерывает загрузку", async () => {
  const f = posterFixture();
  const cached = await f.service.prefetchPoster(source, { previewTime: 0 });
  f.advance(89999);
  assert.equal(f.service.getCachedPoster(source, { previewTime: 0 }), cached);
  f.advance(1);
  assert.equal(f.service.getCachedPoster(source, { previewTime: 0 }), null);
  assert.deepEqual(f.revoked, [cached.url]);
  f.setResponse(async () => ({ ok: true, json: async () => ({ url: "https://storage.googleapis.com/video.mp4",
    posterUrl: "https://storage.googleapis.com/poster.webp", expiresAt: new Date(f.getNow() + 31000).toISOString() }) }));
  let release;
  f.setPosterResponse(() => new Promise((resolve) => { release = resolve; }));
  const pending = f.service.prefetchPoster(source, { previewTime: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  f.advance(1000);
  assert.equal(await pending, null);
  assert.equal(f.fetches[1][1].signal.aborted, true);
  release(new Response(new Uint8Array(128), { headers: { "Content-Type": "image/webp" } }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.blobs.size, 0);
  f.service.dispose();
});

test("больше шести параллельных prefetch отменяют самый старый; новый сеанс того же UID получает новый Blob", async () => {
  const f = posterFixture();
  const releases = [];
  f.setPosterResponse(() => new Promise((resolve) => releases.push(resolve)));
  const operations = [];
  for (let previewTime = 0; previewTime < 7; previewTime++) operations.push(f.service.prefetchPoster(source, { previewTime }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await operations[0], null);
  assert.equal(f.fetches.length, 6);
  assert.equal(f.fetches.filter((call) => !call[1].signal.aborted).length, 6);
  releases.forEach((release) => release(new Response(new Uint8Array(128), { headers: { "Content-Type": "image/webp" } })));
  const cached = await Promise.all(operations);
  const firstSessionUrl = cached[1].url;
  f.setUser(null);
  f.setUser({ uid: "client" });
  assert.equal(f.service.getCachedPoster(source, { previewTime: 1 }), null);
  assert.ok(f.revoked.includes(firstSessionUrl));
  f.setPosterResponse(async () => new Response(new Uint8Array(128), { headers: { "Content-Type": "image/webp" } }));
  const nextSession = await f.service.prefetchPoster(source, { previewTime: 1 });
  assert.notEqual(nextSession.url, firstSessionUrl);
  assert.equal(f.fetches.length, 7);
  f.service.dispose();
});

test("отсутствующая обложка, внешнее видео и анонимный сеанс не вызывают WebP GET", async () => {
  const f = posterFixture();
  f.setResponse(async () => ({ ok: true, json: async () => ({ url: "https://storage.googleapis.com/video.mp4",
    expiresAt: new Date(f.getNow() + 120000).toISOString() }) }));
  assert.equal(await f.service.prefetchPoster(source, { previewTime: 0 }), null);
  assert.equal(await f.service.prefetchPoster("https://external.test/video.mp4", { previewTime: 0 }), null);
  f.setUser(null);
  assert.equal(await f.service.prefetchPoster(source, { previewTime: 1 }), null);
  assert.equal(f.fetches.length, 0);
  f.service.dispose();
});

test("exercise videos and private progress photos return durable gs references; public images retain URLs", async () => {
  downloadCalls.length = 0;
  uploadCalls.length = 0;
  for (const path of ["exercise-videos/t/c/a.mp4", "template-exercise-videos/t/p/a.mp4", "basic-exercise-assets/squat/videos/a.mp4"]) {
    const result = await uploadStorageFile(path, { type: "video/mp4" });
    assert.deepEqual(result, { path, url: `gs://${bucket}/${path}` });
  }
  assert.equal(downloadCalls.length, 0);
  const photo = await uploadStorageFile("progress-photos/client/one/front.webp", { type: "image/webp" });
  assert.equal(photo.url, `gs://${bucket}/progress-photos/client/one/front.webp`);
  assert.equal(downloadCalls.length, 0, "private progress photos must not request bearer download URLs");
  const avatar = await uploadStorageFile("avatars/client/avatar.webp", { type: "image/webp" });
  assert.equal(avatar.url, "https://image.test/avatars/client/avatar.webp");
  assert.equal(downloadCalls.length, 1);
  assert.equal(uploadCalls.length, 5);
});
