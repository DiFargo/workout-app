import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// Operator-only, read-only inventory. No write mode, billing reads, raw profile
// output, object names, token values, account identity, or provider error bodies.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ALLOWED_PROJECTS = Object.freeze(["tren-85720", "tren-85720-staging"]);
const LIMITS = Object.freeze({ profilePageSize: 300, objectPageSize: 1000, maximumPages: 100, requestTimeoutMs: 15000, totalBudgetMs: 180000, maximumResponseBytes: 4 * 1024 * 1024 });
const CONFIG_PATH = "serverConfig/subscriptionAccounting";
// Project the parent subscription map so unnamed/empty subscription records
// are counted too; child-only masks would hide their existence entirely.
const PROFILE_FIELDS = ["role", "subscription", "createdAt", "updatedAt", "trainerAssignmentState", "accountAccessStatus", "trainerId", "assignedTrainerId", "coachId", "trainerEmail", "assignedTrainerEmail", "coachEmail"];

export function parseArguments(args = []) {
  let project = "tren-85720";
  let selected = false;
  for (const argument of args) {
    const match = /^--project=(.+)$/.exec(argument);
    if (!match || selected || !ALLOWED_PROJECTS.includes(match[1])) throw new Error("invalid-arguments");
    project = match[1]; selected = true;
  }
  return { project };
}

export function decodeFirestoreValue(value = {}) {
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decodeFirestoreValue(child)]));
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  return null;
}

function instant(value) {
  if (value === undefined || value === null || value === "") return null;
  const millis = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(millis) && Math.abs(millis) <= 8640000000000000 ? millis : null;
}

export function timestampShape(value) {
  if (value === undefined || value === null || value === "") return "missing";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return "dateOnly";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && instant(value) !== null) return "exactTimestamp";
  if (typeof value === "number" && instant(value) !== null) return "numericTimestamp";
  return "invalidOrOther";
}

export function emptyProvenanceCounts() {
  return { inspectedMissingBoundaryProfiles: 0, dateDerivedCycleIds: 0, exactRenewedAtMatchingCycleIdentity: 0,
    renewalHistoryEntries: 0, renewalHistoryEntriesWithExactTimestamp: 0, renewalHistoryEntriesExplicitlyLinkedToCurrentCycle: 0,
    rootDocumentCreateTimeAvailable: 0, rootDocumentUpdateTimeAvailable: 0,
    timestampFields: Object.fromEntries(["cycleStartedAt", "lastRenewedAt", "createdAt", "updatedAt", "renewedAt", "startDate"].map(key => [key,
      { missing: 0, dateOnly: 0, exactTimestamp: 0, numericTimestamp: 0, invalidOrOther: 0 }])) };
}

export function addProvenanceCounts(counts, profile, document = {}) {
  const subscription = profile.subscription || {};
  counts.inspectedMissingBoundaryProfiles++;
  for (const field of Object.keys(counts.timestampFields)) counts.timestampFields[field][timestampShape(subscription[field])]++;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(subscription.cycleId)) && subscription.cycleId === subscription.startDate) counts.dateDerivedCycleIds++;
  if (timestampShape(subscription.renewedAt) === "exactTimestamp" && String(subscription.renewedAt).replace(/[^a-zA-Z0-9_-]/g, "_") === subscription.cycleId) counts.exactRenewedAtMatchingCycleIdentity++;
  const renewals = (Array.isArray(subscription.history) ? subscription.history : []).filter(entry => entry?.type === "renewal");
  counts.renewalHistoryEntries += renewals.length;
  for (const entry of renewals) {
    if (timestampShape(entry.date || entry.createdAt) === "exactTimestamp") counts.renewalHistoryEntriesWithExactTimestamp++;
    if (String(entry.cycleId || entry.subscriptionCycleId || "") === subscription.cycleId) counts.renewalHistoryEntriesExplicitlyLinkedToCurrentCycle++;
  }
  if (timestampShape(document.createTime) === "exactTimestamp") counts.rootDocumentCreateTimeAvailable++;
  if (timestampShape(document.updateTime) === "exactTimestamp") counts.rootDocumentUpdateTimeAvailable++;
  return counts;
}

export function subscriptionBoundary(subscription = {}) {
  const explicit = instant(subscription.cycleStartedAt) ?? instant(subscription.lastRenewedAt);
  if (explicit !== null) return explicit;
  const generated = /^cycle_(\d{10,})$/.exec(String(subscription.cycleId || ""));
  return generated ? instant(Number(generated[1])) : null;
}

export function emptyProfileCounts() {
  return { profiles: 0, clients: 0, subscriptions: 0, namedCycles: 0, namedCyclesMissingReliableBoundary: 0,
    namedCyclesWithDateOnlyBoundary: 0, invalidCycleStartMaskingValidRenewal: 0,
    explicitUnassignedClients: 0, explicitUnassignedWithoutPendingStatus: 0,
    legacyUnassignedClients: 0, legacyUnassignedWithoutPendingStatus: 0, legacyMissingTrainerIdWithTrainerEmail: 0 };
}

export function addProfileCounts(counts, profile = {}) {
  counts.profiles++;
  const subscription = profile.subscription;
  if (subscription && typeof subscription === "object" && !Array.isArray(subscription)) {
    counts.subscriptions++;
    if (subscription.cycleId && String(subscription.cycleId) !== "legacy") {
      counts.namedCycles++;
      if (subscriptionBoundary(subscription) === null) counts.namedCyclesMissingReliableBoundary++;
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(subscription.cycleStartedAt || subscription.lastRenewedAt || ""))) counts.namedCyclesWithDateOnlyBoundary++;
      if (subscription.cycleStartedAt && instant(subscription.cycleStartedAt) === null && instant(subscription.lastRenewedAt) !== null) counts.invalidCycleStartMaskingValidRenewal++;
    }
  }
  if (String(profile.role || "").trim().toLowerCase() !== "client") return counts;
  counts.clients++;
  const state = String(profile.trainerAssignmentState || "").trim().toLowerCase();
  const pending = profile.accountAccessStatus === "awaiting_trainer";
  if (state === "unassigned") {
    counts.explicitUnassignedClients++;
    if (!pending) counts.explicitUnassignedWithoutPendingStatus++;
  } else if (!state) {
    const hasId = [profile.trainerId, profile.assignedTrainerId, profile.coachId].some(value => String(value || "").trim());
    const hasEmail = [profile.trainerEmail, profile.assignedTrainerEmail, profile.coachEmail].some(value => String(value || "").trim());
    if (!hasId && !hasEmail) {
      counts.legacyUnassignedClients++;
      if (!pending) counts.legacyUnassignedWithoutPendingStatus++;
    } else if (!hasId && hasEmail) counts.legacyMissingTrainerIdWithTrainerEmail++;
  }
  return counts;
}

export function summarizeAccounting(document, now = Date.now()) {
  if (!document) return { exists: false, paused: null, cutoverConfigured: false, cutoverValid: false, cutoverInPast: false };
  const fields = decodeFirestoreValue({ mapValue: { fields: document.fields || {} } });
  const cutover = instant(fields.cutoverTimestamp);
  return { exists: true, paused: typeof fields.paused === "boolean" ? fields.paused : null,
    cutoverConfigured: fields.cutoverTimestamp !== undefined && fields.cutoverTimestamp !== null && fields.cutoverTimestamp !== "",
    cutoverValid: cutover !== null, cutoverInPast: cutover !== null && cutover <= now };
}

function sanitizedFailure(status) {
  return status === 403 ? "unavailable_permission_scope_or_api_disabled" : status === 404 ? "not_found" : status === 429 ? "observer_query_rate_limited" : "query_failed";
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("invalid-response");
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > LIMITS.maximumResponseBytes) { await reader.cancel(); throw new Error("response-too-large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(total); let offset = 0;
  for (const value of chunks) { all.set(value, offset); offset += value.byteLength; }
  return JSON.parse(new TextDecoder().decode(all));
}

export async function runPreflight({ project, token, fetchImpl = globalThis.fetch, now = Date.now }) {
  if (!ALLOWED_PROJECTS.includes(project) || typeof token !== "string" || !token) throw new Error("invalid-context");
  const deadline = now() + LIMITS.totalBudgetMs;
  const get = async url => {
    const parsed = new URL(url);
    if (!["https://firestore.googleapis.com", "https://firebasestorage.googleapis.com", "https://storage.googleapis.com"].includes(parsed.origin)) throw new Error("invalid-origin");
    const remaining = deadline - now(); if (remaining <= 0) return { ok: false, status: "budget_exhausted" };
    try {
      const response = await fetchImpl(parsed.href, { method: "GET", redirect: "error", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(Math.min(LIMITS.requestTimeoutMs, remaining)) });
      if (!response.ok) { await response.body?.cancel(); return { ok: false, status: sanitizedFailure(response.status), httpStatus: response.status }; }
      return { ok: true, data: await boundedJson(response) };
    } catch { return { ok: false, status: "transport_timeout_or_invalid_response" }; }
  };
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`;
  const profiles = { status: "pending", complete: false, pages: 0, counts: emptyProfileCounts() };
  const subscriptionProvenance = { counts: emptyProvenanceCounts(), journals: { profilesInspected: 0, complete: true, documentsScanned: 0, subscriptionOrRenewalEvents: 0, currentCycleLinkedEventsWithExactTimestamp: 0 } };
  const provenanceTargets = [];
  const readProfiles = async () => {
    let pageToken = "";
    for (let page = 0; page < LIMITS.maximumPages; page++) {
      const url = new URL(`${base}/documents/users`); url.searchParams.set("pageSize", String(LIMITS.profilePageSize));
      PROFILE_FIELDS.forEach(field => url.searchParams.append("mask.fieldPaths", field));
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await get(url); profiles.pages++;
      if (!result.ok) { profiles.status = result.status; return; }
      for (const document of result.data.documents || []) {
        const profile = decodeFirestoreValue({ mapValue: { fields: document.fields || {} } });
        addProfileCounts(profiles.counts, profile);
        const subscription = profile.subscription;
        if (subscription?.cycleId && subscription.cycleId !== "legacy" && subscriptionBoundary(subscription) === null) {
          addProvenanceCounts(subscriptionProvenance.counts, profile, document);
          const expectedPrefix = `projects/${project}/databases/(default)/documents/users/`;
          if (typeof document.name === "string" && document.name.startsWith(expectedPrefix) && !document.name.slice(expectedPrefix.length).includes("/")) {
            provenanceTargets.push({ uid: document.name.slice(expectedPrefix.length), cycleId: subscription.cycleId });
          } else subscriptionProvenance.journals.complete = false;
        }
      }
      pageToken = result.data.nextPageToken || "";
      if (!pageToken) { profiles.complete = true; profiles.status = "observed"; return; }
    }
    profiles.status = "page_limit_reached";
  };
  const readAccounting = async () => {
    const url = new URL(`${base}/documents/${CONFIG_PATH}`);
    ["paused", "cutoverTimestamp"].forEach(field => url.searchParams.append("mask.fieldPaths", field));
    const result = await get(url);
    return result.ok ? { status: "observed", ...summarizeAccounting(result.data, now()) }
      : result.status === "not_found" ? { status: "not_found", ...summarizeAccounting(null, now()) } : { status: result.status };
  };
  const readStorage = async () => {
    // Same discovery endpoint as the installed Firebase CLI, without its
    // ensureApiEnabled helper (this script never enables or provisions APIs).
    const identity = await get(`https://firebasestorage.googleapis.com/v1alpha/projects/${project}/defaultBucket`);
    if (!identity.ok) return { status: identity.status, objects: { complete: false } };
    const bucket = typeof identity.data.bucket?.name === "string" ? identity.data.bucket.name.split("/").at(-1) : "";
    if (![`${project}.firebasestorage.app`, `${project}.appspot.com`].includes(bucket)) return { status: "default_bucket_unverified", objects: { complete: false } };
    const metadata = await get(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}?fields=location,cors,iamConfiguration(uniformBucketLevelAccess(enabled),publicAccessPrevention)`);
    const objects = { status: "pending", pages: 0, complete: false, scanned: 0, tokenBearing: 0 };
    let pageToken = "";
    for (let page = 0; page < LIMITS.maximumPages; page++) {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
      url.searchParams.set("prefix", "progress-photos/"); url.searchParams.set("maxResults", String(LIMITS.objectPageSize)); url.searchParams.set("fields", "items(metadata),nextPageToken");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await get(url); objects.pages++;
      if (!result.ok) { objects.status = result.status; break; }
      for (const item of result.data.items || []) {
        objects.scanned++; if (String(item.metadata?.firebaseStorageDownloadTokens || "").split(",").some(value => value.trim())) objects.tokenBearing++;
      }
      pageToken = result.data.nextPageToken || "";
      if (!pageToken) { objects.complete = true; objects.status = "observed"; break; }
      if (page === LIMITS.maximumPages - 1) objects.status = "page_limit_reached";
    }
    if (!metadata.ok) return { status: metadata.status, objects };
    const cors = Array.isArray(metadata.data.cors) ? metadata.data.cors : [];
    const getRules = cors.filter(rule => (rule.method || []).includes("GET"));
    const origins = new Set(cors.flatMap(rule => rule.origin || []));
    return { status: "observed", bucket, location: /^[A-Z0-9-]{1,40}$/.test(metadata.data.location || "") ? metadata.data.location : "unavailable",
      corsRuleCount: cors.length, corsGetRuleCount: getRules.length, corsWildcardOriginRuleCount: cors.filter(rule => (rule.origin || []).includes("*")).length,
      corsDistinctOriginCount: origins.size, firebaseHostingGetAllowed: getRules.some(rule => (rule.origin || []).some(origin => origin === "*" || origin === `https://${project}.web.app` || origin === `https://${project}.firebaseapp.com`)),
      uniformBucketLevelAccess: metadata.data.iamConfiguration?.uniformBucketLevelAccess?.enabled === true,
      publicAccessPreventionEnforced: metadata.data.iamConfiguration?.publicAccessPrevention === "enforced", objects };
  };
  const [, accounting, storage] = await Promise.all([readProfiles(), readAccounting(), readStorage()]);
  // Only the repository's known journal path is inspected, with PII-bearing
  // title/details/author fields excluded. Generic event/root timestamps are
  // never promoted to a subscription cycle-start boundary.
  for (const target of provenanceTargets.slice(0, 30)) {
    subscriptionProvenance.journals.profilesInspected++;
    let pageToken = "";
    for (let page = 0; page < 3; page++) {
      const url = new URL(`${base}/documents/users/${encodeURIComponent(target.uid)}/trainerEvents`);
      url.searchParams.set("pageSize", "300");
      ["type", "date", "createdAt", "cycleId", "subscriptionCycleId"].forEach(field => url.searchParams.append("mask.fieldPaths", field));
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await get(url);
      if (!result.ok) { subscriptionProvenance.journals.complete = false; break; }
      for (const document of result.data.documents || []) {
        subscriptionProvenance.journals.documentsScanned++;
        const entry = decodeFirestoreValue({ mapValue: { fields: document.fields || {} } });
        if (["subscription", "renewal"].includes(entry.type)) {
          subscriptionProvenance.journals.subscriptionOrRenewalEvents++;
          if (String(entry.cycleId || entry.subscriptionCycleId || "") === target.cycleId && timestampShape(entry.date || entry.createdAt) === "exactTimestamp") subscriptionProvenance.journals.currentCycleLinkedEventsWithExactTimestamp++;
        }
      }
      pageToken = result.data.nextPageToken || "";
      if (!pageToken) break;
      if (page === 2) subscriptionProvenance.journals.complete = false;
    }
  }
  if (provenanceTargets.length > 30) subscriptionProvenance.journals.complete = false;
  return { schemaVersion: 1, project, readOnly: true, profiles, accounting, storage, subscriptionProvenance,
    limitations: { boundedInventory: true, exactFirestoreWireSizeMeasured: false, tokenInventoryIncludesOnlyLiveProgressObjects: true,
      cycleBoundaryMatchesLedgerCompatibilityFallback: true, profilesWithOnlyTrainerEmailSeparatedFromUnassigned: true, noRawIdentitiesOrTokens: true,
      genericRootAndJournalTimestampsAreNotCycleBoundaries: true, standaloneRenewalCollectionNotEstablishedByRepository: true } };
}

async function cachedAccountToken(project) {
  if (process.env.FIREBASE_TOKEN) throw new Error("cached-auth-required");
  const require = createRequire(import.meta.url);
  const cliRoot = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cliRoot, "logger.js")).logger.silent = true;
  const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
  const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
  const { getAccessToken } = require(resolve(cliRoot, "apiv2.js"));
  const account = getGlobalDefaultAccount(); if (!account) throw new Error("cached-auth-unavailable");
  await requireAuth({ ...account, project }, true);
  const token = await getAccessToken(); if (typeof token !== "string" || !token) throw new Error("cached-auth-unavailable");
  return token;
}

async function main() {
  const { project } = parseArguments(process.argv.slice(2));
  let token = await cachedAccountToken(project);
  const report = await runPreflight({ project, token }); token = undefined;
  console.log(JSON.stringify(report, null, 2));
  if (!report.profiles.complete || !["observed", "not_found"].includes(report.accounting.status) || report.storage.status !== "observed" || !report.storage.objects.complete || !report.subscriptionProvenance.journals.complete) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error("Read-only preflight unavailable or arguments rejected; no identities, credentials, object names or provider responses were printed.");
  process.exitCode = 1;
});
