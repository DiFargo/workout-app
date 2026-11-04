import { test } from "node:test";
import assert from "node:assert/strict";
import { project, parseArguments, assertStagingConfiguration, assertStagingSigner, makeIdentity, assertOwnedIdentity, mintOwnedCustomToken, assertOwnedCustomSession, authResponseDiagnostic } from "../scripts/smoke-staging-custom-email.mjs";

test("custom-email smoke requires explicit execution/version and forbids project, credential and emulator overrides", () => {
  const valid = ["--run", "--expected-version=3.0.840"];
  assert.equal(project, "tren-85720-staging");
  assert.equal(parseArguments(valid, {}).version, "3.0.840");
  for (const args of [[], ["--run"], [valid[1]], [...valid, "--project=tren-85720"], [...valid, "--run"], [...valid, "--unknown=x"]]) {
    assert.throws(() => parseArguments(args, {}));
  }
  for (const key of ["FIREBASE_TOKEN", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST"]) assert.throws(() => parseArguments(valid, { [key]: "forbidden" }));
  for (const output of ["../outside.json", "package.json", "artifacts/../package.json", "artifacts/evidence.txt"]) {
    assert.throws(() => parseArguments([...valid, `--output=${output}`], {}));
  }
});

test("staging preflight rejects production config and stale or missing release markers", () => {
  const worker = 'const CACHE_NAME = "workout-app-v3.0.840";';
  assertStagingConfiguration({ projectId: project, apiKey: "public-test-key" }, worker, "3.0.840");
  assert.throws(() => assertStagingConfiguration({ projectId: "tren-85720", apiKey: "public-test-key" }, worker, "3.0.840"));
  assert.throws(() => assertStagingConfiguration({ projectId: project }, worker, "3.0.840"));
  assert.throws(() => assertStagingConfiguration({ projectId: project, apiKey: "public-test-key" }, worker, "3.0.839"));
});

test("IAM custom-token mint accepts only the one owned synthetic UID and no custom claims", async () => {
  const identity = makeIdentity("a".repeat(24));
  const calls = [];
  const auth = { getUser: async () => ({ uid: identity.uid, email: identity.initialEmail }), createCustomToken: async (...args) => { calls.push(args); return "synthetic-token"; } };
  assert.equal(await mintOwnedCustomToken(auth, identity), "synthetic-token");
  assert.deepEqual(calls, [[identity.uid]]);
  assertOwnedIdentity(identity, { uid: identity.uid, email: identity.nextEmail });
  assertOwnedIdentity(identity, { uid: identity.uid, email: identity.uiEmail });
  await assert.rejects(mintOwnedCustomToken({ ...auth, getUser: async () => ({ uid: "real-user", email: identity.initialEmail }) }, identity));
  await assert.rejects(mintOwnedCustomToken({ ...auth, getUser: async () => ({ uid: identity.uid, email: "foreign@example.invalid" }) }, identity));
  assert.throws(() => makeIdentity("../real-user"));
  assert.throws(() => assertOwnedIdentity({ ...identity, uid: "real-user" }, { uid: "real-user", email: identity.initialEmail }));
  assert.equal(calls.length, 1);
});

test("IAM signer must match the staging project or its runtime project number", () => {
  assertStagingSigner(`${project}@appspot.gserviceaccount.com`);
  assertStagingSigner(`runtime@${project}.iam.gserviceaccount.com`);
  assertStagingSigner("123456-compute@developer.gserviceaccount.com", "123456");
  for (const signer of ["tren-85720@appspot.gserviceaccount.com", "prod@tren-85720.iam.gserviceaccount.com", "654321-compute@developer.gserviceaccount.com"]) {
    assert.throws(() => assertStagingSigner(signer, "123456"));
  }
});

test("custom REST exchange can omit localId, but signed identity, project, provider and freshness cannot be bypassed", async () => {
  const identity = makeIdentity("b".repeat(24));
  const now = Date.now();
  const claims = { uid: identity.uid, aud: project, firebase: { sign_in_provider: "custom" }, auth_time: Math.floor(now / 1000) };
  const calls = [];
  const auth = { verifyIdToken: async (...args) => { calls.push(args); return claims; } };
  await assertOwnedCustomSession(auth, { idToken: "synthetic-id-token" }, identity, now);
  assert.deepEqual(calls, [["synthetic-id-token", true]]);
  await assert.rejects(assertOwnedCustomSession(auth, { idToken: "synthetic-id-token", localId: "foreign" }, identity, now));
  for (const changed of [{ uid: "foreign" }, { aud: "tren-85720" }, { firebase: { sign_in_provider: "password" } }, { auth_time: now / 1000 - 61 }, { auth_time: now / 1000 + 31 }]) {
    await assert.rejects(assertOwnedCustomSession({ verifyIdToken: async () => ({ ...claims, ...changed }) }, { idToken: "synthetic-id-token" }, identity, now));
  }
  await assert.rejects(assertOwnedCustomSession({ verifyIdToken: async () => { throw new Error("revoked"); } }, { idToken: "synthetic-id-token" }, identity, now));
});

test("Auth diagnostics expose only fixed methods, status, allowed error enums and presence or match booleans", () => {
  const identity = makeIdentity("c".repeat(24));
  const diagnostic = authResponseDiagnostic("signInWithCustomToken", 400, { idToken: "DO_NOT_LOG_TOKEN", localId: identity.uid,
    email: "DO_NOT_LOG_EMAIL", error: { message: "INVALID_CUSTOM_TOKEN: DO_NOT_LOG_DETAIL" } }, identity);
  assert.equal(diagnostic.error, "INVALID_CUSTOM_TOKEN");
  assert.equal(diagnostic.hasIdToken, true);
  assert.equal(diagnostic.localIdMatches, true);
  assert.doesNotMatch(JSON.stringify(diagnostic), /DO_NOT_LOG|staging-custom-email-/);
  assert.equal(authResponseDiagnostic("untrusted method", 9999, { error: { message: "sensitive@example.invalid" } }, identity).error, "UNKNOWN");
});
