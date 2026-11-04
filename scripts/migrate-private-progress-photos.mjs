import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// Default is READ ONLY. --apply AND --confirm-project=<exact project> are both
// required for metadata PATCHes. No object download, upload or deletion exists.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECTS = Object.freeze(["tren-85720", "tren-85720-staging"]);
export const PRIVATE_CACHE = "private,no-store,max-age=0";
const TOKEN_KEY = "firebaseStorageDownloadTokens";
const MAX_IMAGE_BYTES = 10n * 1024n * 1024n;
const LIMITS = { pages: 100, pageSize: 1000, timeoutMs: 15000, totalMs: 240000, responseBytes: 4 * 1024 * 1024 };
const OBJECT_FIELDS = "name,generation,metageneration,size,contentType,metadata,cacheControl";
const RESPONSE_HEADERS = ["Content-Type", "Content-Length", "ETag", "Authorization"];

export function parseMigrationArguments(args = []) {
  const options = { project: "tren-85720", apply: false, confirmProject: "", corsOnly: false };
  const seen = new Set();
  for (const argument of args) {
    const match = /^--(project|confirm-project)=(.+)$/.exec(argument);
    const key = match ? match[1] : argument === "--apply" ? "apply" : argument === "--cors-only" ? "cors-only" : "";
    if (!key || seen.has(key)) throw new Error("invalid-arguments");
    seen.add(key);
    if (key === "project") options.project = match[2];
    else if (key === "confirm-project") options.confirmProject = match[2];
    else if (key === "apply") options.apply = true;
    else options.corsOnly = true;
  }
  if (!PROJECTS.includes(options.project) || (options.apply && options.confirmProject !== options.project)
    || (!options.apply && options.confirmProject)) throw new Error("invalid-confirmation");
  return options;
}

function sameCors(a, b) {
  const canonical = rules => rules.map(rule => ({ ...rule, origin: [...(rule.origin || [])].sort(), method: [...(rule.method || [])].sort(), responseHeader: [...(rule.responseHeader || [])].map(value => value.toLowerCase()).sort() }))
    .map(rule => JSON.stringify(Object.fromEntries(Object.entries(rule).sort(([a], [b]) => a.localeCompare(b))))).sort();
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function planPrivatePhotoCors(project, existing = []) {
  if (!PROJECTS.includes(project) || !Array.isArray(existing)) throw new Error("invalid-context");
  const origins = [`https://${project}.web.app`, `https://${project}.firebaseapp.com`];
  const wildcardRules = existing.filter(rule => [rule.origin, rule.method, rule.responseHeader].some(values => Array.isArray(values) && values.some(value => typeof value === "string" && value.includes("*")))).length;
  const covered = origins.every(origin => ["GET", "HEAD"].every(method => existing.some(rule =>
    (rule.origin || []).includes(origin) && (rule.method || []).includes(method)
    && RESPONSE_HEADERS.every(header => (rule.responseHeader || []).some(value => value.toLowerCase() === header.toLowerCase())))));
  const next = covered || wildcardRules ? existing : [...existing, { origin: origins, method: ["GET", "HEAD"], responseHeader: RESPONSE_HEADERS, maxAgeSeconds: 3600 }];
  return { wildcardRules, changeRequired: !sameCors(existing, next), next };
}

export function classifyProgressObject(item = {}) {
  const parts = typeof item.name === "string" ? item.name.split("/") : [];
  if (parts.length !== 4 || parts[0] !== "progress-photos"
    || !parts.slice(1, 3).every(part => /^[A-Za-z0-9_-]{1,160}$/.test(part))
    || !/^(?:front|side|back)\.(?:webp|jpe?g|png|gif|avif)$/i.test(parts[3])) return "unsupportedPath";
  if (!/^image\/(?:webp|jpeg|png|gif|avif)$/i.test(item.contentType || "")) return "unsupportedContentType";
  if (!/^\d+$/.test(String(item.size || "")) || BigInt(item.size) <= 0n || BigInt(item.size) > MAX_IMAGE_BYTES) return "unsupportedSize";
  if (![item.generation, item.metageneration].every(value => /^\d+$/.test(String(value || "")) && BigInt(value) > 0n)) return "missingPrecondition";
  if (item.metadata !== undefined && (item.metadata === null || typeof item.metadata !== "object" || Array.isArray(item.metadata))) return "unsupportedMetadata";
  return "supported";
}

export function planProgressObjectPatch(item) {
  const classification = classifyProgressObject(item);
  if (classification !== "supported") return { classification, changeRequired: false };
  const hasTokenKey = Object.hasOwn(item.metadata || {}, TOKEN_KEY);
  return { classification, changeRequired: hasTokenKey || item.cacheControl !== PRIVATE_CACHE, hasTokenKey,
    body: { metadata: { ...(item.metadata || {}), ...(hasTokenKey ? { [TOKEN_KEY]: null } : {}) }, cacheControl: PRIVATE_CACHE } };
}

function objectVerification(before, after) {
  const clean = metadata => Object.fromEntries(Object.entries(metadata || {}).filter(([key]) => key !== TOKEN_KEY).sort(([a], [b]) => a.localeCompare(b)));
  return after.generation === before.generation && !Object.hasOwn(after.metadata || {}, TOKEN_KEY)
    && after.cacheControl === PRIVATE_CACHE && JSON.stringify(clean(after.metadata)) === JSON.stringify(clean(before.metadata));
}

async function readJson(response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error("invalid-response");
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > LIMITS.responseBytes) { await reader.cancel(); throw new Error("response-too-large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function runPrivatePhotoMigration({ project, apply = false, confirmProject = "", corsOnly = false, token, fetchImpl = globalThis.fetch, now = Date.now }) {
  if (!PROJECTS.includes(project) || typeof apply !== "boolean" || typeof corsOnly !== "boolean" || !token || typeof token !== "string" || (apply && confirmProject !== project)
    || (!apply && confirmProject)) throw new Error("invalid-context");
  const report = { project, readOnly: !apply, corsOnly, status: "pending", bucketVerified: false,
    cors: { existingRuleCount: 0, existingWildcardRuleCount: 0, patchRequired: false, patched: 0, verified: 0 },
    objects: { allVersions: true, pages: 0, inventoryComplete: false, scanned: 0, supported: 0, tokenKeysPresent: 0, skippedTokenKeysPresent: 0, patchesRequired: 0, alreadyPrivate: 0,
      unsupportedPath: 0, unsupportedContentType: 0, unsupportedSize: 0, missingPrecondition: 0, unsupportedMetadata: 0, patched: 0, verified: 0 },
    conflicts: 0, verificationFailures: 0, unknownWriteOutcomes: 0, queryFailures: 0, budgetExhausted: 0 };
  const deadline = now() + LIMITS.totalMs;
  const request = async (value, { method = "GET", body } = {}) => {
    const url = new URL(value), remaining = deadline - now();
    if (!["https://storage.googleapis.com", "https://firebasestorage.googleapis.com"].includes(url.origin)
      || !["GET", "PATCH"].includes(method) || (method === "PATCH" && (!apply || confirmProject !== project))) throw new Error("request-not-authorized");
    if (remaining <= 0) { report.budgetExhausted++; return null; }
    try {
      const response = await fetchImpl(url.href, { method, redirect: "error", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(Math.min(remaining, LIMITS.timeoutMs)) });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 409 || response.status === 412) report.conflicts++;
        else if (method === "PATCH" && response.status >= 500) report.unknownWriteOutcomes++;
        else report.queryFailures++;
        return null;
      }
      return await readJson(response);
    } catch { if (method === "PATCH") report.unknownWriteOutcomes++; else report.queryFailures++; return null; }
  };
  const identity = await request(`https://firebasestorage.googleapis.com/v1alpha/projects/${project}/defaultBucket`);
  const bucket = typeof identity?.bucket?.name === "string" ? identity.bucket.name.split("/").at(-1) : "";
  if (![`${project}.firebasestorage.app`, `${project}.appspot.com`].includes(bucket)) { report.status = "default_bucket_unverified"; return report; }
  report.bucketVerified = true;
  const bucketUrl = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`);
  bucketUrl.searchParams.set("fields", "metageneration,cors");
  const metadata = await request(bucketUrl);
  if (!metadata || !/^\d+$/.test(String(metadata.metageneration || ""))) { report.status = "bucket_metadata_unavailable"; return report; }
  const cors = planPrivatePhotoCors(project, metadata.cors || []);
  report.cors.existingRuleCount = (metadata.cors || []).length; report.cors.existingWildcardRuleCount = cors.wildcardRules; report.cors.patchRequired = cors.changeRequired;
  if (cors.wildcardRules) { report.status = "blocked_existing_wildcard_cors"; return report; }

  const inventory = [];
  if (!corsOnly) {
    let pageToken = "";
    for (let page = 0; page < LIMITS.pages; page++) {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
      for (const [key, value] of Object.entries({ prefix: "progress-photos/", versions: "true", maxResults: String(LIMITS.pageSize), fields: `items(${OBJECT_FIELDS}),nextPageToken` })) url.searchParams.set(key, value);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await request(url); report.objects.pages++;
      if (!response) break;
      for (const item of response.items || []) {
        report.objects.scanned++;
        const plan = planProgressObjectPatch(item);
        if (plan.classification !== "supported") {
          report.objects[plan.classification]++;
          if (Object.hasOwn(item.metadata || {}, TOKEN_KEY)) report.objects.skippedTokenKeysPresent++;
          continue;
        }
        report.objects.supported++; if (plan.hasTokenKey) report.objects.tokenKeysPresent++;
        if (plan.changeRequired) { report.objects.patchesRequired++; inventory.push({ item, plan }); }
        else report.objects.alreadyPrivate++;
      }
      pageToken = response.nextPageToken || "";
      if (!pageToken) { report.objects.inventoryComplete = true; break; }
    }
    if (!report.objects.inventoryComplete) { report.status = "incomplete_inventory_no_changes"; return report; }
  }
  if (!apply) { report.status = "read_only_complete"; return report; }

  if (cors.changeRequired) {
    const patchUrl = new URL(bucketUrl); patchUrl.searchParams.set("ifMetagenerationMatch", metadata.metageneration);
    const patched = await request(patchUrl, { method: "PATCH", body: { cors: cors.next } });
    if (!patched) { report.status = "stopped_bucket_patch_failure"; return report; }
    report.cors.patched++;
    const verified = await request(bucketUrl);
    if (!verified || !sameCors(verified.cors || [], cors.next)) { report.verificationFailures++; report.status = "stopped_bucket_verification_failure"; return report; }
    report.cors.verified++;
  } else report.cors.verified++;

  for (const { item, plan } of inventory) {
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(item.name)}`);
    url.searchParams.set("generation", item.generation); url.searchParams.set("ifGenerationMatch", item.generation); url.searchParams.set("ifMetagenerationMatch", item.metageneration); url.searchParams.set("fields", OBJECT_FIELDS);
    const patched = await request(url, { method: "PATCH", body: plan.body });
    if (!patched) { report.status = "stopped_object_patch_failure"; return report; }
    report.objects.patched++;
    const verifyUrl = new URL(url); verifyUrl.searchParams.delete("ifGenerationMatch"); verifyUrl.searchParams.delete("ifMetagenerationMatch");
    const after = await request(verifyUrl);
    if (!after || !objectVerification(item, after)) { report.verificationFailures++; report.status = "stopped_object_verification_failure"; return report; }
    report.objects.verified++;
  }
  report.status = report.objects.supported < report.objects.scanned ? "apply_complete_with_skips" : "apply_complete";
  return report;
}

async function cachedAccountToken(project) {
  if (process.env.FIREBASE_TOKEN) throw new Error("cached-auth-required");
  const require = createRequire(import.meta.url), cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cli, "logger.js")).logger.silent = true;
  const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
  if (!account) throw new Error("cached-auth-unavailable");
  await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
  const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
  if (!token || typeof token !== "string") throw new Error("cached-auth-unavailable");
  return token;
}

async function main() {
  const options = parseMigrationArguments(process.argv.slice(2));
  let token = await cachedAccountToken(options.project);
  const report = await runPrivatePhotoMigration({ ...options, token }); token = undefined;
  console.log(JSON.stringify(report, null, 2));
  if (!["read_only_complete", "apply_complete"].includes(report.status)) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error("Private-photo migration rejected or unavailable; no credentials, identities, object names, tokens or provider responses were printed.");
  process.exitCode = 1;
});
