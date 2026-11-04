import assert from "node:assert/strict";
import { test } from "node:test";
import { addProfileCounts, emptyProfileCounts, parseArguments, runPreflight, subscriptionBoundary, summarizeAccounting, timestampShape, emptyProvenanceCounts, addProvenanceCounts } from "../scripts/audit-remediation-preflight.mjs";

const typed = value => value === null ? { nullValue: null } : typeof value === "boolean" ? { booleanValue: value }
  : typeof value === "number" ? { integerValue: String(value) } : typeof value === "string" ? { stringValue: value }
    : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, typed(child)])) } };
const document = value => ({ name: "private/account/name/must-not-be-output", fields: typed(value).mapValue.fields });

test("preflight accepts only exact projects and has no mutation/other argument mode", () => {
  assert.deepEqual(parseArguments(), { project: "tren-85720" });
  assert.deepEqual(parseArguments(["--project=tren-85720-staging"]), { project: "tren-85720-staging" });
  for (const arguments_ of [["--project=other"], ["--write"], ["--mode=write"], ["--project=tren-85720", "--project=tren-85720"], ["--output=private.json"]]) assert.throws(() => parseArguments(arguments_));
});

test("subscription boundary inventory matches named-cycle guard, with ambiguity counts separated", () => {
  const counts = emptyProfileCounts();
  for (const subscription of [
    { cycleId: "named-no-boundary", startDate: "2026-10-01" },
    { cycleId: "cycle_1792324800000" },
    { cycleId: "named", cycleStartedAt: "2026-10-18T12:00:00Z" },
    { cycleId: "date-only", lastRenewedAt: "2026-10-01" },
    { cycleId: "masked-renewal", cycleStartedAt: "invalid", lastRenewedAt: "2026-10-18T12:00:00Z" },
    { cycleId: "legacy" }, {}
  ]) addProfileCounts(counts, { subscription });
  assert.equal(counts.subscriptions, 7); assert.equal(counts.namedCycles, 5); assert.equal(counts.namedCyclesMissingReliableBoundary, 1);
  assert.equal(counts.namedCyclesWithDateOnlyBoundary, 1); assert.equal(counts.invalidCycleStartMaskingValidRenewal, 1);
  assert.equal(subscriptionBoundary({ cycleId: "cycle_1792324800000" }), 1792324800000);
  assert.equal(subscriptionBoundary({ startDate: "2026-10-01" }), null);
  assert.equal(subscriptionBoundary({ cycleStartedAt: "invalid", lastRenewedAt: "2026-10-18T12:00:00Z" }), Date.parse("2026-10-18T12:00:00Z"), "a malformed preferred field cannot hide a valid renewal boundary");
});

test("assignment aggregate separates explicit/legacy unassigned and legacy email-only records", () => {
  const counts = emptyProfileCounts();
  for (const profile of [
    { role: "client", trainerAssignmentState: "unassigned", accountAccessStatus: "active" },
    { role: "client", trainerAssignmentState: "unassigned", accountAccessStatus: "awaiting_trainer" },
    { role: "client", accountAccessStatus: "active" }, { role: "client", accountAccessStatus: "awaiting_trainer" },
    { role: "client", trainerId: "private-id" }, { role: "client", trainerEmail: "private@example.test" },
    { role: "trainer" }
  ]) addProfileCounts(counts, profile);
  assert.equal(counts.clients, 6); assert.equal(counts.explicitUnassignedClients, 2); assert.equal(counts.explicitUnassignedWithoutPendingStatus, 1);
  assert.equal(counts.legacyUnassignedClients, 2); assert.equal(counts.legacyUnassignedWithoutPendingStatus, 1); assert.equal(counts.legacyMissingTrainerIdWithTrainerEmail, 1);
});

test("accounting output is flags only, including missing config and timestamp-typed cutover", () => {
  const result = summarizeAccounting({ fields: { paused: { booleanValue: true }, cutoverTimestamp: { timestampValue: "2026-10-18T12:00:00Z" }, operator: { stringValue: "private@example.test" } } }, Date.parse("2026-10-18T13:00:00Z"));
  assert.deepEqual(result, { exists: true, paused: true, cutoverConfigured: true, cutoverValid: true, cutoverInPast: true });
  assert.deepEqual(summarizeAccounting(null), { exists: false, paused: null, cutoverConfigured: false, cutoverValid: false, cutoverInPast: false });
});

test("provenance reports date-only starts and generic metadata without inventing an exact cycle boundary", () => {
  const counts = emptyProvenanceCounts();
  const subscription = { cycleId: "2026-10-01", startDate: "2026-10-01", createdAt: "2026-09-30T15:00:00Z", history: [{ type: "renewal", date: "2026-10-01T12:00:00Z" }] };
  addProvenanceCounts(counts, { subscription }, { createTime: "2026-09-01T12:00:00Z", updateTime: "2026-10-18T12:00:00Z" });
  assert.equal(subscriptionBoundary(subscription), null);
  assert.equal(counts.timestampFields.startDate.dateOnly, 1); assert.equal(counts.timestampFields.createdAt.exactTimestamp, 1);
  assert.equal(counts.dateDerivedCycleIds, 1); assert.equal(counts.renewalHistoryEntriesWithExactTimestamp, 1);
  assert.equal(counts.renewalHistoryEntriesExplicitlyLinkedToCurrentCycle, 0); assert.equal(counts.rootDocumentUpdateTimeAvailable, 1);
  assert.equal(timestampShape("not-a-date"), "invalidOrOther");
});

test("paginated GET-only preflight reports aggregates and strips identifiers/tokens/provider fields", async () => {
  const requests = [], project = "tren-85720";
  const report = await runPreflight({ project, token: "OAUTH-DO-NOT-PRINT", fetchImpl: async (value, options) => {
    const url = new URL(value); requests.push({ url, options }); assert.equal(options.method, "GET"); assert.equal(options.redirect, "error");
    if (url.hostname === "firebasestorage.googleapis.com") return Response.json({ bucket: { name: `projects/${project}/buckets/${project}.firebasestorage.app` }, private: "private@example.test" });
    if (url.pathname.endsWith("/serverConfig/subscriptionAccounting")) return Response.json(document({ paused: true, cutoverTimestamp: "2026-10-18T12:00:00Z" }));
    if (url.pathname.endsWith("/documents/users")) return Response.json(url.searchParams.has("pageToken")
      ? { documents: [document({ role: "client", subscription: { cycleId: "named" }, trainerAssignmentState: "unassigned" })] }
      : { documents: [document({ role: "trainer" })], nextPageToken: "private-profile-page" });
    if (url.pathname.endsWith("/o")) return Response.json(url.searchParams.has("pageToken") ? { items: [{}] }
      : { items: [{ metadata: { firebaseStorageDownloadTokens: "TOKEN-DO-NOT-PRINT", private: "private@example.test" } }], nextPageToken: "private-object-page" });
    return Response.json({ location: "EU", cors: [{ origin: ["*"], method: ["GET"] }], iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: "enforced" } });
  } });
  assert.equal(report.readOnly, true); assert.equal(report.profiles.pages, 2); assert.equal(report.profiles.complete, true);
  assert.equal(report.profiles.counts.namedCyclesMissingReliableBoundary, 1); assert.equal(report.accounting.paused, true);
  assert.equal(report.storage.location, "EU"); assert.equal(report.storage.corsWildcardOriginRuleCount, 1);
  assert.deepEqual(report.storage.objects, { status: "observed", pages: 2, complete: true, scanned: 2, tokenBearing: 1 });
  const text = JSON.stringify(report);
  for (const secret of ["private@example.test", "OAUTH-DO-NOT-PRINT", "TOKEN-DO-NOT-PRINT", "private-profile-page", "private-object-page", "private/account"]) assert.equal(text.includes(secret), false);
  assert.ok(requests.every(request => ["firestore.googleapis.com", "firebasestorage.googleapis.com", "storage.googleapis.com"].includes(request.url.hostname)));
});

test("permission/query errors are sanitized, incomplete inventory is never presented as zero/complete", async () => {
  const report = await runPreflight({ project: "tren-85720-staging", token: "token", fetchImpl: async () => new Response("PRIVATE PROVIDER BODY", { status: 403 }) });
  assert.equal(report.profiles.complete, false); assert.equal(report.profiles.status, "unavailable_permission_scope_or_api_disabled");
  assert.equal(report.storage.objects.complete, false); assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
  await assert.rejects(runPreflight({ project: "external", token: "token", fetchImpl: () => assert.fail("must not query") }));
});
