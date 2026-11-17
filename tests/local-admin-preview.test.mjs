import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";
import previewConfig from "../vite.admin-preview.config.js";
import { createPreviewStore, previewMiddleware } from "../dev/admin/store.mjs";

const programPath = "admin/basicProgramTemplates/items";
const read = (store, path) => store.request("/__preview/firestore/read", { path });
const write = (store, writes) => store.request("/__preview/firestore/write", { writes });
const users = store => store.request("/__preview/users").body.users;
const config = () => previewConfig({ command: "serve", mode: "development" });

test("local preview only accepts the catalog collections and their direct documents", () => {
  const store = createPreviewStore();
  for (const path of ["basicExerciseOverrides", programPath, `${programPath}/program-1/versions`]) {
    assert.deepEqual(read(store, path), { status: 200, body: { docs: [] } });
  }
  for (const path of ["users", "users/real-client/history", "admin", "admin/basicProgramTemplates", `${programPath}/program-1`, `${programPath}/program-1/other`, "basicExerciseOverrides/exercise-1", "basicExerciseOverrides/../users", `${programPath}/../versions`, `${programPath}/program-1/versions/version-1`, "/basicExerciseOverrides", "basicExerciseOverrides/"]) {
    assert.equal(read(store, path).status, 403, path);
  }
  for (const path of ["users/real-client", "basicExerciseOverrides", "basicExerciseOverrides/exercise-1/hidden/record", `${programPath}/program-1/versions`, `${programPath}/program-1/other/version-1`]) {
    assert.equal(write(store, [{ path, data: { title: "Недопустимая запись" } }]).status, 403, path);
  }
});

test("catalog writes replace or merge one document and keep versions out of the program list", () => {
  const store = createPreviewStore();
  const document = `${programPath}/program-1`;
  assert.equal(write(store, [{ path: document, data: { title: "База", status: "draft", version: 1 } }]).status, 200);
  assert.equal(write(store, [{ path: document, data: { title: "Новая база" }, merge: true }]).status, 200);
  assert.deepEqual(read(store, programPath).body.docs, [{ id: "program-1", data: { title: "Новая база", status: "draft", version: 1 } }]);
  assert.equal(write(store, [
    { path: document, data: { title: "Опубликовано", version: 2 } },
    { path: `${document}/versions/version-2`, data: { title: "Опубликовано", version: 2 } },
    { path: "basicExerciseOverrides/press", data: { name: "Жим гантелей" } }
  ]).status, 200);
  assert.deepEqual(read(store, programPath).body.docs, [{ id: "program-1", data: { title: "Опубликовано", version: 2 } }]);
  assert.deepEqual(read(store, `${document}/versions`).body.docs, [{ id: "version-2", data: { title: "Опубликовано", version: 2 } }]);
  assert.deepEqual(read(store, "basicExerciseOverrides").body.docs, [{ id: "press", data: { name: "Жим гантелей" } }]);
});

test("an invalid write rejects the complete batch without partially changing local records", () => {
  const store = createPreviewStore();
  const valid = { path: `${programPath}/program-1`, data: { title: "До записи" } };
  write(store, [valid]);
  for (const invalid of [
    { path: "users/client-1", data: { role: "admin" } },
    { path: `${programPath}/program-2`, data: [] },
    { path: `${programPath}/program-2`, data: null }
  ]) {
    const result = write(store, [{ ...valid, data: { title: "Не должно сохраниться" } }, invalid]);
    assert.equal(result.status, 403);
    assert.deepEqual(read(store, programPath).body.docs, [{ id: "program-1", data: valid.data }]);
  }
  assert.equal(write(store, []).status, 403);
  assert.equal(write(store, Array.from({ length: 51 }, (_, index) => ({ path: `${programPath}/large-${index}`, data: { index } }))).status, 403);
  assert.equal(read(store, programPath).body.docs.length, 1);
});

test("state persists in one server store, isolates returned data, and resets in a new store", () => {
  const store = createPreviewStore();
  const data = { title: "Локальная программа", workouts: [{ name: "День 1" }] };
  write(store, [{ path: `${programPath}/local-plan`, data }]);
  data.workouts[0].name = "Изменение входного объекта";
  const first = read(store, programPath);
  first.body.docs[0].data.workouts[0].name = "Изменение ответа";
  assert.equal(read(store, programPath).body.docs[0].data.workouts[0].name, "День 1");
  const list = users(store);
  list[0].role = "admin";
  assert.equal(users(store)[0].role, "client");
  assert.deepEqual(read(createPreviewStore(), programPath).body.docs, []);
  assert.equal(users(createPreviewStore())[0].role, "client");
});

test("assignment changes only the selected synthetic client and rejects external identities", () => {
  const store = createPreviewStore();
  const initial = users(store);
  const assigned = store.request("/api/admin/assign-client", { clientId: "local-client-2", trainerId: "local-trainer-1" });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.client.trainerId, "local-trainer-1");
  assert.equal(assigned.body.client.trainerEmail, "alex@example.test");
  assert.deepEqual(users(store).filter(item => item.id !== "local-client-2"), initial.filter(item => item.id !== "local-client-2"));
  for (const payload of [
    { clientId: "production-client", trainerId: "local-trainer-1" },
    { clientId: "local-client-2", trainerId: "production-trainer" },
    { clientId: "local-trainer-1", trainerId: "local-trainer-2" }
  ]) assert.equal(store.request("/api/admin/assign-client", payload).status, 404);
  assert.equal(users(store).find(item => item.id === "local-client-2").trainerId, "local-trainer-1");
  assert.equal(store.request("/api/admin/assign-client", { clientId: "local-client-2", trainerId: "" }).body.client.trainerId, "");
  assert.equal(users(createPreviewStore()).find(item => item.id === "local-client-2").trainerId, undefined);
});

test("local roles and invitations cannot grant administrator access or create production activation links", () => {
  const store = createPreviewStore();
  assert.equal(store.request("/api/admin/update-user-role", { uid: "local-client-2", role: "trainer" }).status, 200);
  assert.equal(users(store).find(item => item.id === "local-client-2").role, "trainer");
  for (const payload of [{ uid: "local-admin", role: "client" }, { uid: "local-client-1", role: "admin" }, { uid: "production-client", role: "trainer" }]) {
    assert.equal(store.request("/api/admin/update-user-role", payload).status, 404);
  }
  const result = store.request("/api/admin/create-trainer-invite", { name: "Тестовый тренер", login: "local.coach" });
  assert.equal(result.status, 200);
  assert.equal(result.body.trainer.role, "trainer");
  assert.equal(result.body.trainer.accountStatus, "pending");
  assert.equal(result.body.login, "local.coach");
  assert.equal(result.body.shareUrl, undefined);
  assert.equal(result.body.botStartUrl, undefined);
  assert.equal(store.request("/api/admin/create-trainer-invite", { name: "Другой тренер", login: "local.coach" }).status, 409);
});

test("unknown APIs, Telegram integration, and unknown preview operations fail closed", () => {
  const store = createPreviewStore();
  for (const path of ["/api/telegram/set-webhook", "/api/telegram/create-link-code", "/api/admin/delete-user", "/api/unknown", "/__preview/export", "/__preview/firestore/delete"]) {
    const result = store.request(path, { targetUid: "production-client" });
    assert.equal(result.status, 403, path);
    assert.equal(result.body.ok, false);
  }
  assert.deepEqual(store.request("/api/admin/feedback", { action: "list" }).body, { ok: true, items: [], nextCursor: "" });
  assert.equal(store.request("/api/admin/feedback", { action: "status" }).status, 403);
});

test("preview config only serves on loopback with isolated configuration and exact local transport aliases", () => {
  assert.throws(() => previewConfig({ command: "build", mode: "production" }), /cannot be built or deployed/);
  const value = config();
  assert.equal(value.envDir, false);
  assert.equal(value.envPrefix, "GYMDUCK_LOCAL_PREVIEW_");
  assert.equal(value.server.host, "127.0.0.1");
  assert.equal(value.server.strictPort, true);
  assert.equal(value.server.proxy, undefined);
  const transport = value.plugins.find(plugin => plugin.name === "local-admin-transport");
  for (const host of ["0.0.0.0", "192.168.1.10", true, undefined]) {
    assert.throws(() => transport.configureServer({ config: { server: { host } }, middlewares: { use() { assert.fail("Public host must not install middleware"); } } }), /loopback/);
  }
  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    let middleware;
    transport.configureServer({ config: { server: { host } }, middlewares: { use(value) { middleware = value; } } });
    assert.equal(typeof middleware, "function");
  }
  const aliasFor = id => {
    const alias = value.resolve.alias.find(item => typeof item.find === "string" ? item.find === id : item.find.test(id));
    return alias ? id.replace(alias.find, alias.replacement) : null;
  };
  for (const [id, file] of [
    ["../../firebase", "firebase.js"], ["../../../src/firebase.js", "firebase.js"], ["firebase/firestore", "firestore.js"],
    ["../../utils/apiClient", "apiClient.js"], ["../../../src/utils/apiClient.js", "apiClient.js"],
    ["../../utils/firebaseStorage.js", "storage.js"], ["../../utils/protectedExerciseVideo.js", "video.js"]
  ]) assert.equal(aliasFor(id), fileURLToPath(new URL(`../dev/admin/${file}`, import.meta.url)), id);
  for (const id of ["firebase/app", "firebase/auth", "firebase/firestore/lite", "../../firebaseExtra", "../../apiClientExtra.js", "../../protectedExerciseVideoClient.js"]) {
    assert.equal(aliasFor(id), null, id);
  }
});

test("HTTP preview middleware supports local writes and reads and rejects cross-origin or unsupported requests", async t => {
  const middleware = previewMiddleware(createPreviewStore());
  const server = createServer((req, res) => middleware(req, res, () => res.writeHead(404).end()));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, options = {}) => fetch(`${base}${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", Origin: base }, ...options });
  const saved = await request("/__preview/firestore/write", { writes: [{ path: `${programPath}/http-plan`, data: { title: "Программа HTTP" } }] });
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("Cache-Control"), "no-store");
  const loaded = await request("/__preview/firestore/read", { path: programPath });
  assert.deepEqual((await loaded.json()).docs, [{ id: "http-plan", data: { title: "Программа HTTP" } }]);
  assert.equal((await request("/__preview/users", {}, { headers: { Origin: "https://untrusted.example" } })).status, 403);
  assert.equal((await fetch(`${base}/__preview/users`)).status, 405);
  assert.equal((await request("/__preview/firestore/read", null, { body: "{" })).status, 400);
  assert.equal((await request("/api/telegram/set-webhook", {})).status, 403);
  assert.equal((await fetch(`${base}/unrelated`)).status, 404);
});
