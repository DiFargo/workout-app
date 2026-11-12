import assert from "node:assert/strict";
import test from "node:test";
import {
  createTrainerActionSmokePlan,
  isAllowedTrainerSmokeApi,
  isAllowedTrainerSmokePreparation,
  isAllowedTrainerSmokeFirestoreEndpoint,
  isAllowedTrainerSmokeDraftDiscardDialog,
  isOwnedTrainerActionSmokePath,
  isOwnedTrainerSmokeWrite,
  parseTrainerActionFirstSmokeArgs,
  runTrainerActionFirstSmoke,
  safeTrainerActionSmokeError,
  validateTrainerActionSmokeIntent
} from "../scripts/smoke-trainer-action-first-release.mjs";
import { getDefaultLoginAlias } from "../src/utils/clientUx.js";
import { getTrainerClientMirrorPayload } from "../src/utils/trainerClientMirror.js";

const version = "3.0.955";
const runId = "0123456789abcdef01234567";
const staging = "tren-85720-staging";
const production = "tren-85720";
const flags = (project = staging) => ["--run", `--project=${project}`, `--expected-version=${version}`,
  "--allow-admin-catalog-read", ...(project === production ? ["--allow-production"] : [])];
const cleanupPath = (project = staging, id = runId) => `artifacts/remediation-${version}/trainer-action-first-${project}-${id}.intent.jsonl`;

test("подтверждение smoke разрешает только точную отмену локального черновика, не произвольные browser dialogs", () => {
  assert.equal(isAllowedTrainerSmokeDraftDiscardDialog("confirm", "Закрыть без сохранения ответа?"), true);
  for (const type of ["alert", "prompt", "beforeunload", "", null]) {
    assert.equal(isAllowedTrainerSmokeDraftDiscardDialog(type, "Закрыть без сохранения ответа?"), false);
  }
  for (const message of ["Удалить клиента?", "Закрыть без сохранения ответа? ", "Закрыть без сохранения ответа", "", null]) {
    assert.equal(isAllowedTrainerSmokeDraftDiscardDialog("confirm", message), false);
  }
});

test("smoke требует явные проект, версию, запуск и отдельное согласие на чтение admin-каталога", () => {
  for (const project of [staging, production]) {
    const parsed = parseTrainerActionFirstSmokeArgs(flags(project), {});
    assert.equal(parsed.project, project);
    assert.equal(parsed["expected-version"], version);
    assert.equal(parsed.run, true);
    assert.equal(parsed.allowAdminCatalogRead, true);
    if (project === production) assert.equal(parsed.allowProduction, true);
  }
  for (const args of [[], ...flags().map((_flag, index, all) => all.filter((_value, position) => position !== index)),
    flags(production).filter(value => value !== "--allow-production"), [...flags(), "--allow-production"],
    flags().map(value => value.replace(staging, `${staging}.evil`)),
    flags().map(value => value.replace(version, "3.0.954"))]) {
    assert.throws(() => parseTrainerActionFirstSmokeArgs(args, {}), JSON.stringify(args));
  }
});

test("smoke запрещает повторы флагов, чужие URL/UID/credentials и любой output-dir override", () => {
  for (const extra of [...flags(), "--run=true", "--allow-admin-catalog-read=true", "--allow-production=true",
    "--project=other-project", "--expected-version=../../private", "--base=https://foreign.invalid", "--url=https://foreign.invalid",
    "--uid=real-user", "--email=real@example.invalid", "--password=not-a-secret", "--token=not-a-secret",
    "--output-dir=../outside", `--output-dir=artifacts/remediation-${version}`, "--cleanup-intent="]) {
    assert.throws(() => parseTrainerActionFirstSmokeArgs([...flags(), extra], {}), extra);
  }
});

test("smoke не принимает альтернативные credentials, emulator hosts или неявный cloud project", () => {
  for (const name of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT",
    "FIREBASE_APPCHECK_DEBUG_TOKEN", "VITE_APPCHECK_DEBUG_TOKEN"]) {
    assert.throws(() => parseTrainerActionFirstSmokeArgs(flags(), { [name]: "not-used" }), name);
  }
});

test("cleanup-only принимает только точный journal своего проекта, релиза и runId", () => {
  for (const project of [staging, production]) {
    const path = cleanupPath(project);
    assert.equal(parseTrainerActionFirstSmokeArgs([...flags(project), `--cleanup-intent=${path}`], {})["cleanup-intent"], path);
  }
  for (const path of [cleanupPath(production), cleanupPath().replace(version, "3.0.954"), cleanupPath().replace(version, "3x0x955"), cleanupPath(staging, "invalid"),
    cleanupPath(staging, runId.toUpperCase()), cleanupPath().replace(".intent.jsonl", ".json"), `../${cleanupPath()}`,
    `C:/${cleanupPath()}`, cleanupPath().replaceAll("/", "\\"), cleanupPath().replace("remediation-", "../remediation-")]) {
    assert.throws(() => parseTrainerActionFirstSmokeArgs([...flags(), `--cleanup-intent=${path}`], {}), path);
  }
  assert.throws(() => parseTrainerActionFirstSmokeArgs([...flags(), `--cleanup-intent=${cleanupPath()}`, `--cleanup-intent=${cleanupPath()}`], {}));
});

test("план содержит ровно три уникальные synthetic identities и не содержит credentials", () => {
  const plan = createTrainerActionSmokePlan(runId);
  assert.equal(plan.marker, `action-first:${runId}`);
  assert.deepEqual(plan.identities, ["client", "trainer", "admin"].map(role => ({
    role, uid: `actionfirst_${runId}_${role}`, email: `action-first-${runId}-${role}@example.invalid`,
    displayName: `Synthetic action-first ${role} ${runId}`
  })));
  for (const field of ["uid", "email"]) assert.equal(new Set(plan.identities.map(identity => identity[field])).size, 3);
  assert.deepEqual(createTrainerActionSmokePlan(runId), plan);
  for (const identity of plan.identities) {
    assert.ok(identity.email.split("@")[0].length > 32);
    assert.equal(getDefaultLoginAlias(identity.email), "", "Вход не должен создавать глобальный loginAlias");
  }
  assert.doesNotMatch(JSON.stringify(plan), /password|idToken|refreshToken|accessToken|privateKey/);
  for (const id of ["", "bad", "0123456789abcdef0123456", `${runId}0`, runId.toUpperCase(), "../0123456789abcdef0123", null, 12]) {
    assert.throws(() => createTrainerActionSmokePlan(id));
  }
});

test("пути записи и очистки ограничены точным собственным users subtree", () => {
  const uid = `actionfirst_${runId}_client`;
  for (const path of [`users/${uid}`, `users/${uid}/workouts/smoke_day`, `users/${uid}/nutrition/state`]) {
    assert.equal(isOwnedTrainerActionSmokePath(uid, path), true, path);
  }
  for (const path of ["users", "users/real-user", `users/${uid}-other`, `users/${uid}/../real-user`,
    `users/${uid}/./state`, `users/${uid}//state`, `users/${uid}/%2e%2e/real-user`, `users/${uid}/..\\real-user`,
    `/users/${uid}`, `users/${uid}/`, `https://foreign.invalid/users/${uid}`, `trainingTemplates/${uid}`,
    `securityRateLimits/${uid}`, null, {}, 1]) {
    assert.equal(isOwnedTrainerActionSmokePath(uid, path), false, String(path));
  }
  for (const badUid of ["", "../own", "a/b", "a\\b", "x".repeat(129), null, 3]) {
    assert.equal(isOwnedTrainerActionSmokePath(badUid, `users/${badUid}`), false);
  }
});

test("браузерный API allowlist разрешает только нужные read-запросы для собственного клиента", () => {
  const uid = `actionfirst_${runId}_client`;
  const allowed = [
    ["/api/client-loading-snapshot", { kind: "workouts" }],
    ["/api/client-loading-snapshot", { kind: "measurements", clientId: uid }],
    ["/api/nutrition/storage", { action: "read" }],
    ["/api/nutrition/storage", { action: "read", uid, mode: "full" }],
    ["/api/nutrition/storage", { action: "read", uid, mode: "days", dayKeys: ["2026-11-12"] }],
    ["/api/nutrition/storage", { action: "read", uid, mode: "full", cursor: "2026-11-12" }],
    ["/api/client-exercise-media", { clientId: uid }],
    ["/api/trainer-exercise-cards", { action: "list" }],
    ["/api/admin/security-key", { action: "status" }]
  ];
  for (const [path, body] of allowed) assert.equal(isAllowedTrainerSmokeApi(path, body, uid), true, JSON.stringify([path, body]));
});

test("браузерный API allowlist блокирует чужие UID, мутации, лишние поля и подмену endpoint", () => {
  const uid = `actionfirst_${runId}_client`;
  const denied = [
    ["/api/client-loading-snapshot", { kind: "workouts", clientId: "real-user" }],
    ["/api/client-loading-snapshot", { kind: "history" }],
    ["/api/client-loading-snapshot", { kind: "workouts", uid }],
    ["/api/client-loading-snapshot", { kind: "workouts", action: "delete" }],
    ["/api/nutrition/storage", { action: "read", uid: "real-user" }],
    ["/api/nutrition/storage", { action: "commit", uid }],
    ["/api/nutrition/storage", { action: "clear", uid }],
    ["/api/nutrition/storage", { action: "prepare", uid }],
    ["/api/nutrition/storage", { action: "read", userPatch: {} }],
    ["/api/nutrition/storage", { action: "read", mode: "arbitrary" }],
    ["/api/nutrition/storage", { action: "read", dayKeys: "2026-11-12" }],
    ["/api/nutrition/storage", { action: "read", cursor: "foreign-cursor" }],
    ["/api/nutrition/storage", { action: "read", uid: null }],
    ["/api/nutrition/storage", { action: "read", mode: "" }],
    ["/api/nutrition/storage", { action: "read", dayKeys: null }],
    ["/api/client-loading-snapshot", { kind: "workouts", clientId: "" }],
    ["/api/client-exercise-media", { clientId: "real-user" }],
    ["/api/client-exercise-media", {}],
    ["/api/client-exercise-media", { clientId: uid, action: "save" }],
    ["/api/trainer-exercise-cards", { action: "save" }],
    ["/api/trainer-exercise-cards", { action: "list", ownerUid: "real-user" }],
    ["/api/admin/security-key", { action: "registration-options" }],
    ["/api/admin/security-key", { action: "authentication-verify" }],
    ["/api/admin/security-key", { action: "status", uid: "real-user" }],
    ["/api/telegram/create-link-code", { targetUid: uid }],
    ["/api/ai-basic-workout-plan", {}],
    ["/api/admin/users", { action: "list" }],
    ["https://foreign.invalid/api/admin/security-key", { action: "status" }],
    ["/api/admin/security-key?target=real-user", { action: "status" }],
    ["/api/admin/security-key/", { action: "status" }]
  ];
  for (const [path, body] of denied) assert.equal(isAllowedTrainerSmokeApi(path, body, uid), false, JSON.stringify([path, body]));
  for (const body of [undefined, null, "status", [], 1]) {
    assert.equal(isAllowedTrainerSmokeApi("/api/admin/security-key", body, uid), false, String(body));
  }
});

test("prepare разрешён отдельно только собственному клиенту и не становится общим write allowlist", () => {
  const [client, trainer, admin] = createTrainerActionSmokePlan(runId).identities;
  const path = "/api/nutrition/storage", body = { action: "prepare", uid: client.uid };
  assert.equal(isAllowedTrainerSmokePreparation(path, body, client), true);
  assert.equal(isAllowedTrainerSmokeApi(path, body, client.uid), false);
  for (const identity of [trainer, admin, null]) assert.equal(isAllowedTrainerSmokePreparation(path, body, identity), false);
  for (const patch of [{ uid: "real-user" }, { action: "commit" }, { action: "clear" }, { userPatch: {} }]) {
    assert.equal(isAllowedTrainerSmokePreparation(path, { ...body, ...patch }, client), false);
  }
  assert.equal(isAllowedTrainerSmokePreparation("/api/other", body, client), false);
});

test("Firestore transport guard запрещает REST-записи и подмену проекта или origin", () => {
  const database = `projects/${staging}/databases/(default)`;
  const channel = `https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=${encodeURIComponent(database)}`;
  for (const method of ["GET", "POST"]) {
    assert.equal(isAllowedTrainerSmokeFirestoreEndpoint(method, channel, staging), true);
    assert.equal(isAllowedTrainerSmokeFirestoreEndpoint(method, channel.replace("/Listen/", "/Write/"), staging), true);
  }
  for (const rpc of ["batchGet", "runQuery"]) {
    assert.equal(isAllowedTrainerSmokeFirestoreEndpoint("POST", `https://firestore.googleapis.com/v1/${database}/documents:${rpc}`, staging), true);
  }
  for (const [method, url] of [["PATCH", channel], ["DELETE", channel],
    ["POST", channel.replace("https:", "http:")], ["POST", channel.replace("firestore.googleapis.com", "foreign.invalid")],
    ["POST", channel.replace("https://", "https://user:password@")], ["POST", channel.replace(".com/", ".com:444/")],
    ["POST", channel.replace(encodeURIComponent(database), encodeURIComponent(`${database}/suffix`))],
    ["POST", `${channel}&database=${encodeURIComponent(database)}`],
    ["POST", channel.replace(staging, production)],
    ["POST", `https://firestore.googleapis.com/v1/${database}/documents:commit`],
    ["GET", `https://firestore.googleapis.com/v1/${database}/documents/users/real-user`],
    ["DELETE", `https://firestore.googleapis.com/v1/${database}/documents/users/real-user`]]) {
    assert.equal(isAllowedTrainerSmokeFirestoreEndpoint(method, url, staging), false, `${method} ${url}`);
  }
  assert.equal(isAllowedTrainerSmokeFirestoreEndpoint("GET", channel, "other-project"), false);
});

const wireFields = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === null ? { nullValue: null }
  : Array.isArray(item) ? { arrayValue: { values: [] } } : typeof item === "object" ? { mapValue: { fields: wireFields(item) } }
    : typeof item === "boolean" ? { booleanValue: item } : typeof item === "number" ? { integerValue: String(item) } : { stringValue: item }]));

test("write guard разрешает реальный helper mirror только своего synthetic клиента у своего тренера", () => {
  const { identities, marker } = createTrainerActionSmokePlan(runId), [client, trainer, admin] = identities;
  const payload = getTrainerClientMirrorPayload({ id: client.uid, name: client.displayName, email: client.email,
    trainerId: trainer.uid, assignedTrainerId: trainer.uid, createdByUid: marker });
  const mirror = { update: { name: `projects/${staging}/databases/(default)/documents/users/${trainer.uid}/trainerClients/${client.uid}`,
    fields: wireFields(payload) }, updateMask: { fieldPaths: Object.keys(payload) } };
  assert.equal(isOwnedTrainerSmokeWrite(mirror, trainer, client, staging), true);
  for (const identity of [client, admin]) assert.equal(isOwnedTrainerSmokeWrite(mirror, identity, client, staging), false);
  for (const mutate of [write => { write.update.name = write.update.name.replace(client.uid, "real-user"); },
    write => { write.update.fields.uid = { stringValue: "real-user" }; },
    write => { write.update.fields.createdByUid = { stringValue: "foreign-marker" }; },
    write => { write.updateMask.fieldPaths.push("adminSecurityKeyRequired"); },
    write => { write.update.fields.extra = { stringValue: "forbidden" }; }]) {
    const changed = structuredClone(mirror); mutate(changed);
    assert.equal(isOwnedTrainerSmokeWrite(changed, trainer, client, staging), false);
  }
  const rootWrite = { update: { name: `projects/${staging}/databases/(default)/documents/users/${client.uid}`,
    fields: { name: { stringValue: client.displayName }, updatedAt: { stringValue: "2026-11-12T00:00:00.000Z" } } },
  updateMask: { fieldPaths: ["name", "updatedAt"] } };
  assert.equal(isOwnedTrainerSmokeWrite(rootWrite, client, client, staging), true);
  rootWrite.updateMask.fieldPaths.push("role");
  assert.equal(isOwnedTrainerSmokeWrite(rootWrite, client, client, staging), false);
});

test("потерянный ответ Auth create очищает аккаунт по заранее сохранённому intent без browser или облака", async () => {
  const snapshots = [], accounts = new Map();
  let latestIntent, creates = 0, deletes = 0, closed = false, createdPassword;
  const secret = "synthetic-private-provider-error";
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const { report } = await runTrainerActionFirstSmoke(parseTrainerActionFirstSmokeArgs(flags(), {}), {
    operatorToken: async () => "synthetic-operator-token",
    createArtifacts: async () => ({ output: "in-memory-only", save: async (state, intent) => {
      latestIntent = structuredClone(intent); snapshots.push(structuredClone({ state, intent }));
    }, close: async () => { closed = true; } }),
    fetchImpl: async (input, request = {}) => {
      const url = new URL(input), body = request.body ? JSON.parse(request.body) : {};
      if (url.hostname === `${staging}.web.app` && url.pathname === "/__/firebase/init.json") {
        return json({ projectId: staging, storageBucket: `${staging}.firebasestorage.app`, apiKey: "synthetic-public-api-key" });
      }
      if (url.hostname === `${staging}.web.app` && url.pathname === "/sw.js") return new Response(`const CACHE_NAME = "workout-app-v${version}";`);
      const authPath = `/v1/projects/${staging}/accounts`;
      if (url.hostname === "identitytoolkit.googleapis.com" && url.pathname === `${authPath}:lookup`) {
        assert.equal(request.method, "POST");
        return json({ users: [...accounts.values()].filter(account => body.email?.includes(account.email) || body.localId?.includes(account.localId)) });
      }
      if (url.hostname === "identitytoolkit.googleapis.com" && url.pathname === authPath) {
        assert.equal(request.method, "POST"); creates++;
        const recorded = latestIntent.identities.find(identity => identity.uid === body.localId);
        assert.equal(recorded.attempted, true); assert.equal(recorded.absenceVerified, true);
        assert.equal(recorded.email, body.email); assert.equal(recorded.displayName, body.displayName);
        createdPassword = body.password;
        accounts.set(body.localId, { localId: body.localId, email: body.email, displayName: body.displayName });
        throw new Error(secret);
      }
      if (url.hostname === "identitytoolkit.googleapis.com" && url.pathname === `${authPath}:delete`) {
        assert.equal(request.method, "POST"); assert.equal(accounts.delete(body.localId), true); deletes++;
        return json({});
      }
      if (url.hostname === "firestore.googleapis.com" && url.pathname.endsWith(":listCollectionIds")) return json({ collectionIds: [] });
      if (url.hostname === "firestore.googleapis.com" && (request.method || "GET") === "GET") return json({}, 404);
      assert.fail(`Неожиданный synthetic transport: ${request.method || "GET"} ${url.hostname}${url.pathname}`);
    },
    chromium: { launch: () => assert.fail("Browser не должен запускаться после потерянного create response") }
  });
  assert.equal(report.failed, true); assert.equal(report.failedStep, "create-owned-identities");
  assert.equal(report.cleanupVerified, true); assert.equal(creates, 1); assert.equal(deletes, 1);
  assert.equal(accounts.size, 0); assert.equal(closed, true);
  assert.equal(latestIntent.cleanupRequired, false);
  const serialized = JSON.stringify(snapshots);
  assert.equal(typeof createdPassword, "string"); assert.equal(serialized.includes(createdPassword), false);
  assert.doesNotMatch(serialized, /synthetic-private-provider-error|synthetic-operator-token|password|idToken/);
});

test("диагностика не сериализует provider body, stack, credentials или небезопасный error code", () => {
  const secret = "synthetic-secret-do-not-log";
  const error = Object.assign(new Error(`Bearer ${secret}`), { token: secret, password: secret, stack: secret,
    response: { body: secret }, request: { headers: { Authorization: secret } } });
  assert.deepEqual(safeTrainerActionSmokeError(error), { code: "operation-failed" });
  assert.deepEqual(safeTrainerActionSmokeError({ smokeCode: "cleanup-incomplete", token: secret }), { code: "cleanup-incomplete" });
  for (const smokeCode of [`Bearer ${secret}`, `https://foreign.invalid/${secret}`, "x".repeat(101), "eyJSyntheticToken", null, 1]) {
    const result = safeTrainerActionSmokeError({ smokeCode, message: secret, token: secret });
    assert.deepEqual(result, { code: "operation-failed" });
    assert.doesNotMatch(JSON.stringify(result), /synthetic-secret|foreign|Bearer/);
  }
});

function makeIntent(project = staging) {
  const plan = createTrainerActionSmokePlan(runId);
  return { schemaVersion: 1, project, version, runId, marker: plan.marker, cleanupRequired: true,
    identities: plan.identities.map(identity => ({ ...identity, absenceVerified: false, attempted: false, ownershipVerified: false })) };
}

test("cleanup intent сохраняет точную synthetic ownership и разрешает повторную проверку уже очищенного run", () => {
  for (const project of [staging, production]) {
    const options = parseTrainerActionFirstSmokeArgs(flags(project), {});
    const intent = makeIntent(project);
    assert.equal(validateTrainerActionSmokeIntent(intent, options), intent);
    const cleaned = { ...intent, cleanupRequired: false };
    assert.equal(validateTrainerActionSmokeIntent(cleaned, options), cleaned);
    const cleanupOptions = parseTrainerActionFirstSmokeArgs([...flags(project), `--cleanup-intent=${cleanupPath(project)}`], {});
    assert.equal(validateTrainerActionSmokeIntent(intent, cleanupOptions), intent);
  }
});

test("cleanup intent отвергает чужой run, проект, релиз, marker и изменённые identities", () => {
  const options = parseTrainerActionFirstSmokeArgs(flags(), {});
  const mutations = [
    intent => { intent.schemaVersion = 2; },
    intent => { intent.project = production; },
    intent => { intent.version = "3.0.954"; },
    intent => { intent.runId = "bad"; },
    intent => { intent.marker = "action-first:foreign"; },
    intent => { delete intent.cleanupRequired; },
    intent => { intent.cleanupRequired = "true"; },
    intent => { intent.identities.pop(); },
    intent => { intent.identities.push({ ...intent.identities[0] }); },
    intent => { intent.identities.reverse(); },
    intent => { intent.identities[0].uid = "real-user"; },
    intent => { intent.identities[0].email = "real@example.invalid"; },
    intent => { intent.identities[0].displayName = "Real user"; },
    intent => { intent.identities[0].role = "admin"; },
    intent => { intent.identities[1] = { ...intent.identities[0] }; },
    intent => { intent.identities[0].absenceVerified = "true"; },
    intent => { intent.identities[0].attempted = "true"; },
    intent => { intent.identities[0].ownershipVerified = "true"; },
    intent => { intent.identities[0].attempted = true; intent.identities[0].absenceVerified = false; },
    intent => { intent.identities[0].password = "not-a-secret"; },
    intent => { intent.identities[0].idToken = "not-a-secret"; },
    intent => { intent.password = "not-a-secret"; },
    intent => { intent.arbitraryPath = "users/real-user"; }
  ];
  for (const mutate of mutations) {
    const intent = makeIntent(); mutate(intent);
    assert.throws(() => validateTrainerActionSmokeIntent(intent, options), mutate.toString());
  }
  for (const intent of [null, [], "intent", 1]) assert.throws(() => validateTrainerActionSmokeIntent(intent, options));
  const mismatchedPath = cleanupPath(staging, "abcdef0123456789abcdef01");
  const cleanupOptions = parseTrainerActionFirstSmokeArgs([...flags(), `--cleanup-intent=${mismatchedPath}`], {});
  assert.throws(() => validateTrainerActionSmokeIntent(makeIntent(), cleanupOptions));
});
