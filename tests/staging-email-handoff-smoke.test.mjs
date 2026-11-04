import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArguments, makeIdentity, assertOwnedIdentity, artifactPath, safeErrorName, safeHttpDiagnostic } from "../scripts/smoke-staging-email-handoff.mjs";

test("handoff execution requires exact staging release flags and cached operator only", () => {
  const args = ["--run", "--expected-version=3.0.840"];
  assert.equal(parseArguments(args, {}).version, "3.0.840");
  for (const invalid of [[], ["--run"], [...args, "--project=tren-85720"], [...args, "--run"], ["--run", "--expected-version=3.0.839"]]) assert.throws(() => parseArguments(invalid, {}));
  for (const key of ["FIREBASE_TOKEN", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS"]) assert.throws(() => parseArguments(args, { [key]: "forbidden" }));
});

test("owned Auth checks reject foreign UID and unexpected email; output paths cannot be overridden", () => {
  const identity = makeIdentity("a".repeat(24));
  assertOwnedIdentity(identity, { uid: identity.uid, email: identity.initialEmail });
  assertOwnedIdentity(identity, { uid: identity.uid, email: identity.nextEmail });
  assert.throws(() => assertOwnedIdentity(identity, { uid: "foreign", email: identity.initialEmail }));
  assert.throws(() => assertOwnedIdentity(identity, { uid: identity.uid, email: "foreign@example.invalid" }));
  assert.throws(() => makeIdentity("../outside"));
  assert.match(artifactPath(identity.runId), /staging-email-handoff-[a-f0-9]{24}\.json$/);
  assert.throws(() => artifactPath("../outside"));
  assert.throws(() => artifactPath(identity.runId, "txt"));
});

test("handoff diagnostics persist only fixed names, HTTP statuses and presence booleans", () => {
  assert.equal(safeErrorName({ name: "TimeoutError", message: "SECRET" }), "TimeoutError");
  assert.equal(safeErrorName({ name: "sensitive@example.invalid" }), "UnknownError");
  const diagnostic = safeHttpDiagnostic(200, { ok: true, email: "SECRET_EMAIL", idToken: "SECRET_TOKEN", localId: "SECRET_UID" });
  assert.deepEqual(diagnostic, { status: 200, ok: true, hasEmail: true, error: null });
  assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET/);
  assert.equal(safeHttpDiagnostic(400, { error: "email-already-in-use" }).error, "email-already-in-use");
  assert.equal(safeHttpDiagnostic(9999, { error: "SECRET_BODY" }).error, "UNKNOWN");
});
