// Review before any live execution. Only random, owned synthetic Auth/profile data.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = ["tren-85720-staging", "tren-85720"];
const SOURCE = "/videos/1ea4065d-8785-4c13-9fd5-a5bdf409b6b7.mp4";
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const check = (condition, code) => { if (!condition) fail(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const safeUid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const stringField = (doc, field) => doc?.fields?.[field]?.stringValue;

export function parseProtectedVideoArgs(args, env = process.env) {
  const result = {}, seen = new Set();
  for (const arg of args) {
    const match = /^--(project|confirm-prod|expected-version|output-dir)=(.+)$/.exec(arg);
    const key = match ? match[1] : arg;
    check(!seen.has(key), "duplicate-argument"); seen.add(key);
    if (match) result[key] = match[2];
    else if (arg === "--run") result.run = true;
    else fail("unknown-argument");
  }
  check(result.run === true && PROJECTS.includes(result.project), "explicit-run-and-project-required");
  check(result.project !== "tren-85720" || result["confirm-prod"] === "tren-85720", "production-confirmation-required");
  check(!result["confirm-prod"] || result["confirm-prod"] === result.project, "confirmation-project-mismatch");
  check(/^\d+\.\d+\.\d+$/.test(result["expected-version"] || ""), "expected-version-required");
  check(result["output-dir"] === `artifacts/remediation-${result["expected-version"]}`, "exact-output-directory-required");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])
    check(!env[key], "cached-operator-and-explicit-live-project-only");
  return result;
}

export function safeProtectedVideoError(error) {
  return { code: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" };
}

export function validateProtectedVideoUrl(value, project, now = Date.now()) {
  let url;
  try { url = new URL(value); } catch { fail("invalid-signed-url"); }
  const bucket = `${project}.firebasestorage.app`;
  const object = `protected-workout-videos/public/${SOURCE.slice("/videos/".length)}`;
  check(PROJECTS.includes(project) && url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash,
    "invalid-signed-url-origin");
  check((url.hostname === "storage.googleapis.com" && decodeURIComponent(url.pathname) === `/${bucket}/${object}`) ||
    (url.hostname === `${bucket}.storage.googleapis.com` && decodeURIComponent(url.pathname) === `/${object}`), "signed-url-object-mismatch");
  const allowed = new Set(["X-Goog-Algorithm", "X-Goog-Credential", "X-Goog-Date", "X-Goog-Expires", "X-Goog-SignedHeaders", "X-Goog-Signature", "response-content-disposition", "response-content-type"]);
  check([...url.searchParams.keys()].every(key => allowed.has(key) && url.searchParams.getAll(key).length === 1), "unexpected-signed-url-parameter");
  const expires = Number(url.searchParams.get("X-Goog-Expires"));
  check(url.searchParams.get("X-Goog-Algorithm") === "GOOG4-RSA-SHA256" && /^[a-f0-9]{128,1024}$/i.test(url.searchParams.get("X-Goog-Signature") || "") &&
    url.searchParams.get("X-Goog-SignedHeaders") === "host" && Boolean(url.searchParams.get("X-Goog-Credential")), "invalid-v4-signature");
  check(Number.isInteger(expires) && expires > 0 && expires <= 900, "invalid-signed-url-ttl");
  const date = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(url.searchParams.get("X-Goog-Date") || "");
  check(Boolean(date), "invalid-signature-date");
  const issued = Date.UTC(...date.slice(1).map((value, index) => Number(value) - (index === 1 ? 1 : 0)));
  check(Number.isFinite(issued) && issued <= now + 30000 && issued + expires * 1000 > now && issued + expires * 1000 <= now + 930000, "invalid-signature-window");
  return url;
}

async function cachedOperatorToken(project) {
  try {
    const require = createRequire(import.meta.url);
    const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
    check(Boolean(account), "cached-operator-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
    check(typeof token === "string" && Boolean(token), "cached-operator-unavailable");
    return token;
  } catch { fail("cached-operator-unavailable"); }
}

async function createArtifact(options, runId) {
  const root = await realpath(ROOT), artifacts = resolve(root, "artifacts");
  await mkdir(artifacts, { recursive: true });
  check(await realpath(artifacts) === artifacts, "symlink-output-directory-forbidden");
  const directory = resolve(root, options["output-dir"]);
  await mkdir(directory, { recursive: true });
  check(await realpath(directory) === directory, "symlink-output-directory-forbidden");
  const name = `protected-video-release-${options.project}-${runId}.json`;
  const file = await open(resolve(directory, name), "wx");
  return { output: `${options["output-dir"]}/${name}`, save: async report => {
    const text = JSON.stringify(report, null, 2) + "\n";
    await file.write(text, 0, "utf8"); await file.truncate(Buffer.byteLength(text));
  }, close: () => file.close() };
}

async function boundedBytes(response, limit) {
  const reader = response.body?.getReader();
  check(Boolean(reader), "missing-response-body");
  const chunks = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) { await reader.cancel(); fail("response-size-limit"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

// Dependencies are solely for offline tests; there are no CLI overrides for them.
export async function runProtectedVideoSmoke(options, dependencies = {}) {
  const args = Object.entries(options || {}).map(([key, value]) => key === "run" && value === true ? "--run" : `--${key}=${value}`);
  options = parseProtectedVideoArgs(args);
  const version = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  check(version === options["expected-version"], "local-version-mismatch");
  const runId = randomBytes(12).toString("hex"), project = options.project;
  const artifact = await (dependencies.createArtifact || createArtifact)(options, runId); // Exclusive output before credentials/network.
  const identity = { email: `protected-video-${runId}@example.invalid`, marker: `protected-video:${runId}`, absenceVerified: false, attempted: false };
  const base = `https://${project}.web.app`, database = `projects/${project}/databases/(default)`;
  const documents = `https://firestore.googleapis.com/v1/${database}/documents`;
  const authAdmin = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:`;
  const fetchImpl = dependencies.fetchImpl || fetch;
  const report = { schemaVersion: 1, project, version, runId, startedAt: new Date().toISOString(), cases: [],
    containsPII: false, limits: ["One random owned synthetic client only; no real accounts, UI, Telegram, AI, IAM or ACL operations.",
      "Existing protected video is requested; its endpoint may enforce its normal cache/token metadata policy.",
      "Only the specified video and hosting path are probed; not a whole-bucket exposure audit.",
      "Cleanup is verified at observation time; no guarantee against future delayed external events."], cleanup: {} };
  let operator, apiKey, cleanup = false, requests = 0, cleanupRequests = 0, cleanupDomainRequests = 0, cleanupDocs = 0, step = "initialize";
  const deadline = Date.now() + 180000;
  const request = async (url, { method = "GET", body, bearer, expected = 200, json = true, limit = 1024 * 1024, headers = {} } = {}) => {
    if (cleanup) { cleanupRequests++; check(++cleanupDomainRequests <= 120, "cleanup-request-limit"); }
    else check(++requests <= 35 && Date.now() <= deadline, "request-budget-exhausted");
    const response = await fetchImpl(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status !== expected || !json) {
      await response.body?.cancel();
      check(response.status === expected, "unexpected-http-status");
      return { status: response.status, headers: response.headers };
    }
    const bytes = await boundedBytes(response, limit);
    try { return { status: response.status, headers: response.headers, data: JSON.parse(bytes.toString("utf8")) }; }
    catch { fail("invalid-json-response"); }
  };
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = async path => (await request(docUrl(path), { bearer: operator })).data;
  // Optional reads have separate transport handling so no provider error body is parsed.
  const optionalDoc = async path => {
    const response = await rawFetch(docUrl(path), { bearer: operator });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (response.status !== 200) { await response.body?.cancel(); fail("document-read-failed"); }
    try { return JSON.parse((await boundedBytes(response, 1024 * 1024)).toString("utf8")); } catch { fail("document-response-invalid"); }
  };
  const rawFetch = async (url, { bearer, headers = {} } = {}) => {
    if (cleanup) { cleanupRequests++; check(++cleanupDomainRequests <= 120, "cleanup-request-limit"); }
    else check(++requests <= 35 && Date.now() <= deadline, "request-budget-exhausted");
    return fetchImpl(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { ...headers, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) } });
  };
  const lookup = async () => {
    const { data } = await request(`${authAdmin}lookup`, { method: "POST", bearer: operator, body: { email: [identity.email] } });
    const rows = data.users || []; check(Array.isArray(rows) && rows.length <= 1, "identity-lookup-ambiguous");
    if (!rows.length) return null;
    const user = rows[0];
    check(user.email === identity.email && safeUid(user.localId) && (!identity.uid || identity.uid === user.localId), "identity-ownership-mismatch");
    return user;
  };
  const encoded = value => Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    typeof entry === "boolean" ? { booleanValue: entry } : { stringValue: String(entry) }]));
  const deleteDocument = async (doc, expectedPath) => {
    check(doc?.name === `${database}/documents/${expectedPath}` && typeof doc.updateTime === "string", "unsafe-document-delete");
    await request(`https://firestore.googleapis.com/v1/${doc.name}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`,
      { method: "DELETE", bearer: operator, json: false });
  };
  const collectionIds = async path => {
    const { data } = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", bearer: operator, body: { pageSize: 100 } });
    check(!data.nextPageToken && Array.isArray(data.collectionIds || []), "cleanup-collection-limit");
    return data.collectionIds || [];
  };
  const removeTree = async (path, root, depth = 0) => {
    check((path === root || path.startsWith(`${root}/`)) && depth <= 8 && ++cleanupDocs <= 100, "unsafe-tree-cleanup");
    for (const collection of await collectionIds(path)) {
      check(typeof collection === "string" && /^[^/.][^/]*$/.test(collection) && collection !== "..", "unsafe-child-collection");
      let pageToken;
      do {
        const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true");
        url.searchParams.set("mask.fieldPaths", "_smokeProjectionOnly"); if (pageToken) url.searchParams.set("pageToken", pageToken);
        const { data } = await request(url, { bearer: operator });
        for (const child of data.documents || []) {
          check(child.name?.startsWith(`${database}/documents/${path}/${collection}/`) && child.name.slice(`${database}/documents/${path}/${collection}/`.length).indexOf("/") < 0, "unsafe-child-document");
          await removeTree(child.name.slice(`${database}/documents/`.length), root, depth + 1);
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
    }
    const doc = await optionalDoc(path); if (doc) await deleteDocument(doc, path);
  };
  const pass = label => report.cases.push(label);
  const access = (body, expected, authenticated = true) => request(`${base}/api/exercise-video-access`, {
    method: "POST", body, bearer: authenticated ? identity.idToken : undefined, expected, json: expected === 200 });
  try {
    await artifact.save(report);
    step = "cached-authentication"; operator = await (dependencies.operatorToken || cachedOperatorToken)(project);
    step = "exact-hosting-project";
    const { data: config } = await request(`${base}/__/firebase/init.json`);
    check(config.projectId === project && config.storageBucket === `${project}.firebasestorage.app` && typeof config.apiKey === "string" && config.apiKey.length > 20, "hosting-project-mismatch");
    apiKey = config.apiKey;
    const worker = await rawFetch(`${base}/sw.js?protected-video=${runId}`);
    if (worker.status !== 200) { await worker.body?.cancel(); fail("published-version-unavailable"); }
    check((await boundedBytes(worker, 512 * 1024)).toString("utf8").includes(`const CACHE_NAME = "workout-app-v${version}";`), "published-version-mismatch");
    step = "unauthenticated-denied"; await access({ source: SOURCE }, 401, false); pass(step);
    step = "owned-account-creation";
    check(await lookup() === null, "random-identity-already-exists"); identity.absenceVerified = true;
    identity.attempted = true;
    const { data: signup } = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST", body: { email: identity.email, password: randomBytes(30).toString("base64url"), returnSecureToken: true } });
    check(safeUid(signup.localId) && typeof signup.idToken === "string" && Boolean(signup.idToken), "signup-response-invalid");
    identity.uid = signup.localId; identity.idToken = signup.idToken;
    let claims;
    try { claims = JSON.parse(Buffer.from(identity.idToken.split(".")[1], "base64url").toString("utf8")); }
    catch { fail("signup-token-invalid"); }
    check(claims.aud === project && claims.sub === identity.uid && claims.iss === `https://securetoken.google.com/${project}`, "signup-token-project-mismatch");
    check(Boolean(await lookup()), "created-identity-not-found");
    const root = `users/${identity.uid}`;
    await request(`${docUrl(root)}?currentDocument.exists=false`, { method: "PATCH", bearer: operator, body: { fields: encoded({
      role: "client", active: true, name: "Synthetic protected video smoke", email: identity.email,
      accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer", trainerAssignmentState: "unassigned",
      createdByUid: identity.marker, createdAt: new Date().toISOString() }) } });
    step = "pending-member-denied"; await access({ source: SOURCE }, 403); pass(step);
    step = "activate-owned-profile";
    const profile = await getDoc(root);
    check(stringField(profile, "createdByUid") === identity.marker && stringField(profile, "email") === identity.email, "profile-ownership-mismatch");
    const activation = { accountAccessStatus: "active", trainerAssignmentState: "assigned", trainerId: `synthetic-${runId}` };
    const patchUrl = new URL(docUrl(root));
    for (const key of Object.keys(activation)) patchUrl.searchParams.append("updateMask.fieldPaths", key);
    patchUrl.searchParams.set("currentDocument.updateTime", profile.updateTime);
    await request(patchUrl, { method: "PATCH", bearer: operator, body: { fields: encoded(activation) } });
    step = "active-member-signed-video";
    const { data: signed } = await access({ source: SOURCE }, 200);
    check(signed.ok === true, "video-access-not-ok");
    const url = validateProtectedVideoUrl(signed.url, project);
    check(Number.isFinite(Date.parse(signed.expiresAt)) && Date.parse(signed.expiresAt) > Date.now() && Date.parse(signed.expiresAt) <= Date.now() + 930000, "invalid-response-expiry");
    pass(step);
    step = "signed-range-64-bytes";
    const range = await rawFetch(url, { headers: { Range: "bytes=0-63" } });
    if (range.status !== 206) { await range.body?.cancel(); fail("range-status-not-206"); }
    if (!/^video\//i.test(range.headers.get("content-type") || "") || !/^bytes 0-63\/\d+$/.test(range.headers.get("content-range") || "")) {
      await range.body?.cancel(); fail("invalid-video-range-headers");
    }
    check((await boundedBytes(range, 64)).length === 64, "range-not-64-bytes"); pass(step);
    step = "outside-video-source-denied";
    await access({ source: `gs://${project}.firebasestorage.app/users/${identity.uid}/profile/synthetic-avatar.webp` }, 403); pass(step);
    step = "legacy-hosting-not-video";
    const legacy = await rawFetch(`${base}${SOURCE}`);
    await legacy.body?.cancel();
    check([200, 404].includes(legacy.status) && !/^video\//i.test(legacy.headers.get("content-type") || ""), "legacy-hosting-exposes-video"); pass(step);
    step = "unsigned-object-denied";
    url.search = ""; await request(url, { method: "HEAD", expected: 403, json: false }); pass(step);
  } catch (error) { report.failed = true; report.failedStep = step; report.failure = safeProtectedVideoError(error); }
  finally {
    cleanup = true;
    const clean = async (key, operation) => {
      cleanupDomainRequests = 0; // A failed/bounded tree sweep cannot consume Auth/rate cleanup's allowance.
      try { report.cleanup[key] = await operation(); }
      catch (error) { report.cleanup[key] = false; (report.cleanup.failures ||= {})[key] = safeProtectedVideoError(error); }
    };
    if (identity.attempted && identity.absenceVerified) {
      // Ambiguous signup still resolves only the pre-verified, random owned email.
      await clean("identityResolved", async () => {
        const user = await lookup(); if (user) identity.uid ||= user.localId;
        return Boolean(identity.uid) || user === null;
      });
      if (identity.uid) {
        await clean("authAbsent", async () => {
          if (await lookup()) await request(`${authAdmin}delete`, { method: "POST", bearer: operator, body: { localId: identity.uid } });
          return await lookup() === null;
        });
        await clean("profileTreeAbsent", async () => {
          const root = `users/${identity.uid}`, profile = await optionalDoc(root);
          if (profile) check(stringField(profile, "createdByUid") === identity.marker && stringField(profile, "email") === identity.email, "cleanup-profile-ownership-mismatch");
          await removeTree(root, root);
          return await optionalDoc(root) === null && (await collectionIds(root)).length === 0;
        });
        await clean("ownedRateAbsent", async () => {
          const path = `securityRateLimits/${hash(`${identity.uid}:exercise-video-access`)}`;
          const rate = await optionalDoc(path);
          if (rate) {
            check(stringField(rate, "uid") === identity.uid && stringField(rate, "action") === "exercise-video-access", "cleanup-rate-ownership-mismatch");
            await deleteDocument(rate, path);
          }
          return await optionalDoc(path) === null;
        });
      } else {
        // Cannot guess paths if creation response and lookup both failed.
        report.cleanup.authAbsent = report.cleanup.identityResolved === true;
        report.cleanup.profileTreeAbsent = report.cleanup.identityResolved === true;
        report.cleanup.ownedRateAbsent = report.cleanup.identityResolved === true;
      }
    } else report.cleanup = { notCreated: true, authAbsent: true, profileTreeAbsent: true, ownedRateAbsent: true };
    report.cleanupVerified = ["authAbsent", "profileTreeAbsent", "ownedRateAbsent"].every(key => report.cleanup[key] === true);
    report.failed ||= !report.cleanupVerified;
    report.finishedAt = new Date().toISOString(); report.requestCount = requests; report.cleanupRequestCount = cleanupRequests;
    operator = undefined; apiKey = undefined; identity.idToken = undefined;
    try { await artifact.save(report); } finally { await artifact.close(); }
  }
  return { report, output: artifact.output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { report, output } = await runProtectedVideoSmoke(parseProtectedVideoArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ project: report.project, version: report.version, passedCases: report.cases.length,
      failed: report.failed === true, failedStep: report.failedStep || null, cleanupVerified: report.cleanupVerified, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ ok: false, ...safeProtectedVideoError(error) })); process.exitCode = 1; }
}
