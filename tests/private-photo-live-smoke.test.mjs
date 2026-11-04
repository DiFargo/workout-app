import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { parsePrivatePhotoSmokeArgs, runPrivatePhotoSmoke, ownedPhotoPrefix, assertOwnedPhotoObject,
  verifyPrivatePhotoRecord, makePrivatePhotoUploadFixture, recordPrivatePhotoDiagnostic } from "../scripts/smoke-private-photo-live.mjs";

test("browser diagnostic aggregation retains only known methods, statuses, flags and Storage codes", () => {
  const diagnostics = { storageResponses: {}, storageRequestFailures: {}, storageErrorCodes: {}, corsConsoleObserved: false };
  const sensitive = "https://example.invalid/owned-uid/photo?token=secret user@example.invalid";
  recordPrivatePhotoDiagnostic(diagnostics, { kind: "console", text: `${sensitive} blocked by CORS policy FirebaseError storage/unauthorized` });
  recordPrivatePhotoDiagnostic(diagnostics, { kind: "response", method: "POST", status: 403, corsHeaderAllowsOrigin: true, url: sensitive, body: sensitive });
  recordPrivatePhotoDiagnostic(diagnostics, { kind: "request-failed", method: "GET", error: sensitive });
  recordPrivatePhotoDiagnostic(diagnostics, { kind: "response", method: sensitive, status: 403 });
  assert.deepEqual(diagnostics, { storageResponses: { "POST:403": { count: 1, corsHeaderAllowsOrigin: true, corsWildcard: false } },
    storageRequestFailures: { GET: 1 }, storageErrorCodes: { "storage/unauthorized": 1 }, corsConsoleObserved: true });
  assert.equal(JSON.stringify(diagnostics).includes(sensitive), false);
});

test("private-photo smoke defaults to no network and requires exact opt-in production confirmation", async () => {
  assert.deepEqual(parsePrivatePhotoSmokeArgs([], {}), { project: "tren-85720-staging", run: false });
  assert.equal(parsePrivatePhotoSmokeArgs(["--run", "--project=tren-85720-staging"], {}).run, true);
  assert.equal(parsePrivatePhotoSmokeArgs(["--run", "--project=tren-85720", "--confirm-project=tren-85720"], {}).run, true);
  for (const args of [
    ["--run"], ["--run", "--project=tren-85720"], ["--project=other"],
    ["--run", "--project=tren-85720", "--confirm-project=tren-85720-staging"],
    ["--project=tren-85720", "--confirm-project=tren-85720"], ["--run", "--run"],
    ["--project=tren-85720", "--project=tren-85720-staging"], ["--base=https://evil.invalid"],
    ["--expected-version=latest"], ["--project=tren-85720.evil.invalid"]
  ]) assert.throws(() => parsePrivatePhotoSmokeArgs(args, {}));
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"])
    assert.throws(() => parsePrivatePhotoSmokeArgs([], { [key]: "set" }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Unexpected network request"); };
  try {
    assert.deepEqual(await runPrivatePhotoSmoke({ project: "tren-85720-staging", run: false }), {
      project: "tren-85720-staging", readOnly: true, status: "not-run", networkRequests: 0
    });
    await assert.rejects(runPrivatePhotoSmoke({ project: "tren-85720", run: true }));
    await assert.rejects(runPrivatePhotoSmoke({ project: "tren-85720-staging", run: "true" }));
  } finally { globalThis.fetch = originalFetch; }
});

test("cleanup object scope is exact owned UID prefix and requires generation preconditions", () => {
  assert.equal(ownedPhotoPrefix("owned-uid"), "progress-photos/owned-uid/");
  for (const uid of ["", "../other", "a/b", "a%2Fb", "a?query", null]) assert.throws(() => ownedPhotoPrefix(uid));
  const object = { name: "progress-photos/owned-uid/session/front.webp", generation: "123", metageneration: "2" };
  assert.doesNotThrow(() => assertOwnedPhotoObject(object, "owned-uid"));
  assert.doesNotThrow(() => assertOwnedPhotoObject({ ...object, generation: "456" }, "owned-uid"));
  for (const patch of [{ name: "progress-photos/owned-uid-other/session/front.webp" },
    { name: "progress-photos/other/session/front.webp" }, { name: "users/owned-uid/avatar.webp" },
    { name: "progress-photos/owned-uid/../other/front.webp" }, { generation: "" }, { generation: "0" }, { metageneration: "" }])
    assert.throws(() => assertOwnedPhotoObject({ ...object, ...patch }, "owned-uid"));
});

test("persisted photo proof rejects token HTTP URLs, foreign buckets/UIDs and mixed sessions", () => {
  const bucket = "tren-85720-staging.firebasestorage.app", uid = "owned-uid";
  const record = () => ({ fields: Object.fromEntries(["front", "side", "back"].map(view => [view + "Url", { stringValue: `gs://${bucket}/progress-photos/${uid}/session/${view}.webp` }])) });
  assert.equal(verifyPrivatePhotoRecord(record(), bucket, uid).length, 3);
  for (const value of ["https://firebasestorage.googleapis.com/v0/b/bucket/o/name?alt=media&token=secret",
    "blob:local-preview", `gs://other/progress-photos/${uid}/session/front.webp`,
    `gs://${bucket}/progress-photos/other/session/front.webp`, `gs://${bucket}/progress-photos/${uid}/other/front.webp`,
    `gs://${bucket}/progress-photos/${uid}/session/front.webp?token=secret`]) {
    const changed = record(); changed.fields.frontUrl.stringValue = value;
    assert.throws(() => verifyPrivatePhotoRecord(changed, bucket, uid));
  }
});

test("tiny upload fixture is decoded and canvas-compressible by the actual browser without network", async () => {
  const fixture = makePrivatePhotoUploadFixture();
  assert.equal(fixture.mimeType, "image/png"); assert.ok(fixture.buffer.length < 200);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async data => {
      const image = new Image(); image.src = data; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.8));
      return { width: image.naturalWidth, height: image.naturalHeight, type: blob.type, size: blob.size };
    }, `data:image/png;base64,${fixture.buffer.toString("base64")}`);
    assert.equal(result.width, 1); assert.equal(result.height, 1); assert.equal(result.type, "image/webp"); assert.ok(result.size > 0);
  } finally { await browser.close(); }
});
