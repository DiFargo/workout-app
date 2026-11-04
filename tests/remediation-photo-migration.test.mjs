import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyProgressObject, parseMigrationArguments, planPrivatePhotoCors, planProgressObjectPatch, PRIVATE_CACHE, runPrivatePhotoMigration } from "../scripts/migrate-private-progress-photos.mjs";

const project = "tren-85720", name = "progress-photos/private-owner/private-session/front.webp";
const image = (overrides = {}) => ({ name, generation: "10", metageneration: "3", size: "1256", contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable", metadata: { firebaseStorageDownloadTokens: "PRIVATE-TOKEN", custom: "private@example.test" }, ...overrides });

function fixture(options = {}) {
  const calls = [];
  const bucket = { metageneration: "4", cors: options.cors || [{ origin: ["https://unrelated.example"], method: ["POST"], responseHeader: ["X-Custom"], maxAgeSeconds: 100 }] };
  const objects = (options.objects || [image(), image({ generation: "9", metageneration: "2" })]).map(value => structuredClone(value));
  const fetchImpl = async (value, init) => {
    const url = new URL(value); calls.push({ url, ...init, body: init.body ? JSON.parse(init.body) : undefined });
    assert.equal(init.redirect, "error"); assert.equal(url.searchParams.has("alt"), false, "never fetch object data or token media URLs");
    if (url.hostname === "firebasestorage.googleapis.com") return Response.json({ bucket: { name: `projects/${project}/buckets/${project}.firebasestorage.app` } });
    assert.equal(url.hostname, "storage.googleapis.com");
    if (url.pathname.endsWith("/o")) {
      assert.equal(init.method, "GET"); assert.equal(url.searchParams.get("prefix"), "progress-photos/"); assert.equal(url.searchParams.get("versions"), "true");
      if (objects.length <= 1) return Response.json({ items: objects });
      return Response.json(url.searchParams.has("pageToken") ? { items: objects.slice(1) } : { items: objects.slice(0, 1), nextPageToken: "private-page-token" });
    }
    if (url.pathname.includes("/o/")) {
      const objectName = decodeURIComponent(url.pathname.split("/o/")[1]);
      const item = objects.find(item => item.name === objectName && item.generation === url.searchParams.get("generation"));
      assert.ok(item);
      if (init.method === "PATCH") {
        assert.equal(url.searchParams.get("ifGenerationMatch"), item.generation); assert.equal(url.searchParams.get("ifMetagenerationMatch"), item.metageneration);
        if (options.conflict) return new Response("PRIVATE PROVIDER ERROR", { status: 412 });
        if (options.unknownWrite) throw new Error("PRIVATE PROVIDER TRANSPORT TOKEN");
        const patch = JSON.parse(init.body); assert.equal(patch.metadata.firebaseStorageDownloadTokens, null);
        assert.equal(patch.metadata.custom, item.metadata.custom);
        item.metadata = Object.fromEntries(Object.entries(patch.metadata).filter(([, value]) => value !== null));
        item.cacheControl = patch.cacheControl; item.metageneration = String(Number(item.metageneration) + 1);
        if (options.failVerification) item.metadata.firebaseStorageDownloadTokens = "STILL-PRIVATE";
      }
      return Response.json(item);
    }
    if (init.method === "PATCH") {
      assert.equal(url.searchParams.get("ifMetagenerationMatch"), bucket.metageneration);
      bucket.cors = JSON.parse(init.body).cors; bucket.metageneration = String(Number(bucket.metageneration) + 1);
    }
    return Response.json(bucket);
  };
  const args = { project, token: "OAUTH-PRIVATE", fetchImpl };
  return { calls, bucket, objects, args };
}

test("readonly is default; exact project confirmation is mandatory and unknown options are rejected", async () => {
  assert.deepEqual(parseMigrationArguments(), { project, apply: false, confirmProject: "", corsOnly: false });
  assert.equal(parseMigrationArguments(["--project=tren-85720-staging", "--apply", "--confirm-project=tren-85720-staging", "--cors-only"]).corsOnly, true);
  for (const args of [["--apply"], ["--project=other"], ["--apply", "--confirm-project=tren-85720-staging"], ["--confirm-project=tren-85720"], ["--delete"], ["--apply", "--apply"]]) assert.throws(() => parseMigrationArguments(args));
  await assert.rejects(runPrivatePhotoMigration({ project, apply: true, token: "private", fetchImpl: () => assert.fail("must not fetch") }));
});

test("CORS plan preserves unrelated rules, grants only exact hosting GET/HEAD, is idempotent and blocks wildcard rules", () => {
  const unrelated = [{ origin: ["https://unrelated.example"], method: ["POST"], responseHeader: ["X-Custom"] }];
  const plan = planPrivatePhotoCors(project, unrelated);
  assert.deepEqual(plan.next[0], unrelated[0]); assert.equal(plan.changeRequired, true);
  assert.deepEqual(plan.next[1].origin, [`https://${project}.web.app`, `https://${project}.firebaseapp.com`]);
  assert.deepEqual(plan.next[1].method, ["GET", "HEAD"]); assert.equal(JSON.stringify(plan.next).includes("*"), false);
  assert.equal(planPrivatePhotoCors(project, plan.next).changeRequired, false);
  const wildcard = [{ origin: ["*"], method: ["GET"] }];
  assert.equal(planPrivatePhotoCors(project, wildcard).wildcardRules, 1); assert.deepEqual(planPrivatePhotoCors(project, wildcard).next, wildcard);
});

test("scope allows only known photo views, supported MIME and <=10MiB with generation/metageneration locks", () => {
  assert.equal(classifyProgressObject(image()), "supported");
  for (const [override, expected] of [
    [{ name: "avatars/private/front.webp" }, "unsupportedPath"], [{ name: "progress-photos/private/../front.webp" }, "unsupportedPath"],
    [{ name: "progress-photos/private/session/front.svg" }, "unsupportedPath"], [{ contentType: "image/svg+xml" }, "unsupportedContentType"],
    [{ size: "10485761" }, "unsupportedSize"], [{ size: "0" }, "unsupportedSize"], [{ generation: undefined }, "missingPrecondition"]
  ]) assert.equal(classifyProgressObject(image(override)), expected);
  const original = image(), plan = planProgressObjectPatch(original);
  assert.equal(plan.body.metadata.firebaseStorageDownloadTokens, null); assert.equal(plan.body.metadata.custom, "private@example.test");
  assert.equal(plan.body.cacheControl, PRIVATE_CACHE); assert.equal(original.metadata.firebaseStorageDownloadTokens, "PRIVATE-TOKEN");
});

test("dry-run inventories every version with GET only, exposes counts but no names/tokens/identities", async () => {
  const h = fixture(); const report = await runPrivatePhotoMigration(h.args);
  assert.equal(report.status, "read_only_complete"); assert.equal(report.objects.inventoryComplete, true);
  assert.equal(report.objects.scanned, 2); assert.equal(report.objects.tokenKeysPresent, 2); assert.equal(report.objects.patchesRequired, 2);
  assert.ok(h.calls.every(call => call.method === "GET"));
  const output = JSON.stringify(report);
  for (const privateValue of [name, "PRIVATE-TOKEN", "OAUTH-PRIVATE", "private@example.test", "private-page-token"]) assert.equal(output.includes(privateValue), false);
});

test("apply uses bucket/object preconditions, preserves metadata and verifies each version; rerun is idempotent", async () => {
  const h = fixture(); const unrelated = structuredClone(h.bucket.cors[0]);
  const applyArgs = { ...h.args, apply: true, confirmProject: project };
  const report = await runPrivatePhotoMigration(applyArgs);
  assert.equal(report.status, "apply_complete"); assert.equal(report.cors.patched, 1); assert.equal(report.cors.verified, 1);
  assert.equal(report.objects.patched, 2); assert.equal(report.objects.verified, 2); assert.deepEqual(h.bucket.cors[0], unrelated);
  for (const object of h.objects) { assert.equal(Object.hasOwn(object.metadata, "firebaseStorageDownloadTokens"), false); assert.equal(object.cacheControl, PRIVATE_CACHE); assert.equal(object.metadata.custom, "private@example.test"); }
  const patchCount = h.calls.filter(call => call.method === "PATCH").length;
  const again = await runPrivatePhotoMigration(applyArgs); assert.equal(again.objects.patchesRequired, 0); assert.equal(again.cors.patchRequired, false);
  assert.equal(h.calls.filter(call => call.method === "PATCH").length, patchCount);
});

test("cors-only changes no object metadata and existing wildcard blocks every mutation", async () => {
  const h = fixture(); const result = await runPrivatePhotoMigration({ ...h.args, apply: true, confirmProject: project, corsOnly: true });
  assert.equal(result.status, "apply_complete"); assert.equal(result.objects.scanned, 0); assert.equal(h.calls.some(call => call.url.pathname.includes("/o")), false);
  assert.ok(h.objects.every(item => item.metadata.firebaseStorageDownloadTokens === "PRIVATE-TOKEN"));
  const blocked = fixture({ cors: [{ origin: ["*"], method: ["GET"] }] });
  const report = await runPrivatePhotoMigration({ ...blocked.args, apply: true, confirmProject: project });
  assert.equal(report.status, "blocked_existing_wildcard_cors"); assert.ok(blocked.calls.every(call => call.method === "GET"));
});

test("conflicts/unknown patch outcomes stop without retries; failed verification does not continue", async () => {
  for (const option of ["conflict", "unknownWrite", "failVerification"]) {
    const h = fixture({ [option]: true });
    const report = await runPrivatePhotoMigration({ ...h.args, apply: true, confirmProject: project });
    assert.ok(report.status.startsWith("stopped_"));
    assert.equal(h.calls.filter(call => call.method === "PATCH" && call.url.pathname.includes("/o/")).length, 1);
    if (option === "conflict") assert.equal(report.conflicts, 1);
    if (option === "unknownWrite") assert.equal(report.unknownWriteOutcomes, 1);
    if (option === "failVerification") assert.equal(report.verificationFailures, 1);
    assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
  }
});

test("unsupported token-bearing paths are counted and never patched", async () => {
  const h = fixture({ objects: [image({ name: "progress-photos/owner/session/other.bin" })] });
  const report = await runPrivatePhotoMigration({ ...h.args, apply: true, confirmProject: project });
  assert.equal(report.objects.unsupportedPath, 1); assert.equal(report.objects.skippedTokenKeysPresent, 1); assert.equal(report.objects.patched, 0);
});
