import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Administrative config only: no users, IAM, API enablement or migration calls.
// --disable stops future cutover; it does NOT roll days back into legacy.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projects = new Set(["tren-85720", "tren-85720-staging"]);
const hash = value => createHash("sha256").update(value, "utf8").digest("hex");
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };

export function parseOptions(argv = []) {
  const options = { run: false, allowProduction: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    let arg = argv[index];
    if (arg === "--project") arg = `--project=${argv[++index] || ""}`;
    const key = arg.startsWith("--project=") ? "project" : arg;
    if (seen.has(key)) fail("duplicate-argument");
    seen.add(key);
    if (key === "project") options.project = arg.slice("--project=".length);
    else if (arg === "--enable") options.enable = true;
    else if (arg === "--disable") options.disable = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--allow-production") options.allowProduction = true;
    else fail("invalid-argument");
  }
  if (!projects.has(options.project)) fail("exact-project-required");
  if (Boolean(options.enable) === Boolean(options.disable)) fail("choose-enable-or-disable");
  if (options.run && options.project === "tren-85720" && !options.allowProduction) fail("production-confirmation-required");
  return options;
}

export function validateNutritionRulesFence(source) {
  if (typeof source !== "string") fail("rules-source-invalid");
  // This is an additional fail-closed marker check, not a substitute for the
  // emulator security suite. Exact deployed/local source equality is required.
  const compact = source.replace(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");
  const required = [
    /function nutritionSdkWriteAvailable\(uid, docId\)/,
    /docId != "manifest"/,
    /docId != "state"/,
    /get\(manifestPath\)\.data\.get\("sourceOfTruth", "legacy"\) == "legacy"/,
    /get\(manifestPath\)\.data\.get\("writerEpoch", 0\) == 0/,
    /allow create: if nutritionSdkWriteAvailable\(uid, docId\)/,
    /allow update: if nutritionSdkWriteAvailable\(uid, docId\)/,
    /allow delete: if nutritionSdkWriteAvailable\(uid, docId\)/,
    /match \/nutrition\/\{docId\}\/\{subPath=\*\*\}/,
    /allow write: if nutritionSdkWriteAvailable\(uid, docId\) && isOwnerOrAdmin\(uid\)/,
    /match \/\{collectionId\}\/\{subPath=\*\*\}/,
    /allow write: if !\(collectionId in \["history", "nutrition", "nutritionGenerations", "nutritionMutationReceipts"\]\) && isAdmin\(\)/
  ];
  if (required.some(pattern => !pattern.test(compact))) fail("nutrition-writer-fence-not-found");
  return { sha256: hash(source), markersVerified: true };
}

function configUrl(project) {
  return new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/serverConfig/nutritionDayStorage`);
}
function readConfigUrl(project) {
  const url = configUrl(project);
  for (const field of ["writerFenceVersion", "cutoverEnabled", "activatedAt"]) url.searchParams.append("mask.fieldPaths", field);
  return url;
}
function expectedFields(enable, at) {
  return { writerFenceVersion: { integerValue: "2" }, cutoverEnabled: { booleanValue: enable }, activatedAt: { timestampValue: at } };
}

export async function configureStorage({ options, localRules, request, now = () => new Date().toISOString() }) {
  // Validate again for programmatic callers, before constructing any endpoint.
  if (!projects.has(options.project) || !options.run || Boolean(options.enable) === Boolean(options.disable)
    || options.project === "tren-85720" && !options.allowProduction) fail("unsafe-run-options");
  const report = { project: options.project, enabled: options.enable === true, configPath: "serverConfig/nutritionDayStorage",
    rulesVerified: false, requests: 0, usersRead: 0, iamChanged: false, verified: false };
  const call = async (url, init = {}) => {
    report.requests++;
    const result = await request(url, init);
    if (!result || !Number.isInteger(result.status)) fail("invalid-response");
    return result;
  };
  if (options.enable) {
    const local = validateNutritionRulesFence(localRules);
    const release = await call(new URL(`https://firebaserules.googleapis.com/v1/projects/${options.project}/releases/cloud.firestore`));
    if (release.status !== 200) fail(`rules-release-http-${release.status}`);
    const rulesetName = release.data?.rulesetName;
    if (typeof rulesetName !== "string" || !new RegExp(`^projects/${options.project}/rulesets/[a-zA-Z0-9._-]+$`).test(rulesetName)) fail("invalid-ruleset-reference");
    const ruleset = await call(new URL(`https://firebaserules.googleapis.com/v1/${rulesetName}`));
    if (ruleset.status !== 200) fail(`rules-source-http-${ruleset.status}`);
    const files = ruleset.data?.source?.files;
    if (!Array.isArray(files) || files.length !== 1 || typeof files[0].content !== "string") fail("rules-source-file-count-invalid");
    const deployed = validateNutritionRulesFence(files[0].content);
    if (deployed.sha256 !== local.sha256) fail("deployed-rules-sha256-mismatch");
    report.rulesVerified = true;
    report.rulesSha256 = local.sha256;
  }
  const before = await call(readConfigUrl(options.project));
  if (![200, 404].includes(before.status)) fail(`config-read-http-${before.status}`);
  if (before.status === 200 && typeof before.data?.updateTime !== "string") fail("config-update-time-missing");
  const patchUrl = configUrl(options.project);
  for (const field of ["writerFenceVersion", "cutoverEnabled", "activatedAt"]) patchUrl.searchParams.append("updateMask.fieldPaths", field);
  patchUrl.searchParams.set(before.status === 404 ? "currentDocument.exists" : "currentDocument.updateTime",
    before.status === 404 ? "false" : before.data.updateTime);
  const at = now();
  if (!Number.isFinite(Date.parse(at))) fail("invalid-activation-time");
  const fields = expectedFields(report.enabled, at);
  const patch = await call(patchUrl, { method: "PATCH", body: { fields } });
  if (patch.status !== 200) fail(`config-write-http-${patch.status}`);
  const after = await call(readConfigUrl(options.project));
  if (after.status !== 200 || typeof after.data?.updateTime !== "string") fail("config-readback-failed");
  const observed = after.data.fields || {};
  if (observed.writerFenceVersion?.integerValue !== "2" || observed.cutoverEnabled?.booleanValue !== report.enabled
    || typeof observed.activatedAt?.timestampValue !== "string"
    || observed.activatedAt.timestampValue.replace(/\.000Z$/, "Z") !== at.replace(/\.000Z$/, "Z")) fail("config-readback-mismatch");
  return { ...report, verified: true, operation: report.enabled ? "enabled-after-rules-verification" : "future-cutover-disabled-no-rollback" };
}

async function cachedAccountToken(project) {
  if (process.env.FIREBASE_TOKEN) fail("environment-token-not-supported");
  const require = createRequire(import.meta.url);
  const cliRoot = resolve(root, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  require(resolve(cliRoot, "logger.js")).logger.silent = true;
  const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
  const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
  const { getAccessToken } = require(resolve(cliRoot, "apiv2.js"));
  const account = getGlobalDefaultAccount();
  if (!account) fail("cached-cli-account-unavailable");
  await requireAuth({ ...account, project }, true);
  const token = await getAccessToken();
  if (typeof token !== "string" || !token) fail("cached-cli-token-unavailable");
  return token;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const localRules = options.enable ? await readFile(resolve(root, "firestore.rules"), "utf8") : null;
  if (options.enable) validateNutritionRulesFence(localRules);
  if (!options.run) {
    console.log(JSON.stringify({ project: options.project, dryRun: true, networkRequests: 0, configWrites: 0,
      operation: options.enable ? "enable" : "disable", requiresExactDeployedRules: options.enable === true,
      requiresProductionConfirmation: options.project === "tren-85720", note: "Без --run облако не читается и не изменяется. --disable не откатывает дневные данные." }, null, 2));
    return;
  }
  let token;
  try { token = await cachedAccountToken(options.project); }
  catch { fail("cached-cli-authentication-unavailable"); }
  const deadline = Date.now() + 90000;
  try {
    const report = await configureStorage({ options, localRules, request: async (url, init) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) fail("operation-deadline-exceeded");
      const response = await fetch(url, { method: init.method || "GET", redirect: "error",
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}), signal: AbortSignal.timeout(Math.min(15000, remaining)) });
      if (!response.ok) { await response.body?.cancel(); return { status: response.status }; }
      return { status: response.status, data: await response.json() };
    } });
    console.log(JSON.stringify(report, null, 2));
  } finally { token = undefined; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(failure => {
    console.error(JSON.stringify({ ok: false, code: failure.safeCode || "transport-or-invalid-response", credentialsPrinted: false,
      note: "Операция не подтверждена. При неизвестном результате PATCH не повторяйте запись вслепую: сначала проверьте config." }));
    process.exitCode = 1;
  });
}
