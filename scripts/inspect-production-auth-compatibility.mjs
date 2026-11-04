import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const cliRoot = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
const { getGlobalDefaultAccount } = require(resolve(cliRoot, "auth.js"));
const { requireAuth } = require(resolve(cliRoot, "requireAuth.js"));
const { Client } = require(resolve(cliRoot, "apiv2.js"));
const account = getGlobalDefaultAccount();
if (!account) throw new Error("Firebase CLI sign-in required.");
await requireAuth({ ...account, project: "tren-85720" }, true);
const firestore = new Client({ urlPrefix: "https://firestore.googleapis.com" });
async function list(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const response = await firestore.get(`/v1/projects/tren-85720/databases/(default)/documents/${collection}`, {
      queryParams: { pageSize: 1000, ...(pageToken ? { pageToken } : {}) }
    });
    documents.push(...(response.body.documents || []));
    pageToken = response.body.nextPageToken || "";
  } while (pageToken);
  return documents;
}
function decode(value) {
  if (!value) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  return null;
}
const [users, identities] = await Promise.all([list("users"), list("telegramIdentities")]);
const canonical = new Map(identities.map(document => [document.name.split("/").at(-1), decode(document.fields?.uid)]));
const counts = { clients: 0, telegramClients: 0, safeDeterministicTelegram: 0, canonicalTelegram: 0, legacyClientNeedsRelink: 0, legacyClientWithoutEmail: 0 };
for (const document of users) {
  const profile = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]));
  if (profile.role !== "client" || profile.active === false || profile.archived === true || profile.accessDisabled === true || ["suspended", "revoked"].includes(profile.membershipStatus)) continue;
  counts.clients += 1;
  const telegramId = String(profile.telegramUserId || profile.telegram?.telegramUserId || "");
  if (!telegramId) continue;
  counts.telegramClients += 1;
  const uid = document.name.split("/").at(-1);
  if (canonical.get(telegramId) === uid) counts.canonicalTelegram += 1;
  else if (uid.startsWith("telegram_")) counts.safeDeterministicTelegram += 1;
  else {
    counts.legacyClientNeedsRelink += 1;
    if (!profile.email || profile.emailIsInternal === true || /@(?:telegram|invite)\./i.test(profile.email)) counts.legacyClientWithoutEmail += 1;
  }
}
console.log(JSON.stringify({ productionAuthCompatibility: counts }));
const appcheck = new Client({ urlPrefix: "https://firebaseappcheck.googleapis.com" });
const config = await appcheck.get("/v1/projects/870948637708/apps/1:870948637708:web:2b99749866f761c394f229/recaptchaEnterpriseConfig", { resolveOnHTTPError: true });
console.log(JSON.stringify({ appCheckProviderConfigStatus: config.status, registered: Boolean(config.body?.siteKey) }));
const functions = new Client({ urlPrefix: "https://cloudfunctions.googleapis.com" });
console.log("Inspecting runtime signing configuration.");
const runtime = await functions.get("/v2/projects/tren-85720/locations/europe-west1/functions/trainerExerciseCards");
const signer = runtime.body.serviceConfig?.serviceAccountEmail;
const projects = new Client({ urlPrefix: "https://cloudresourcemanager.googleapis.com" });
console.log("Inspecting project signing permissions.");
const projectPolicy = await projects.post("/v1/projects/tren-85720:getIamPolicy", {});
const signerMember = `serviceAccount:${signer}`;
const tokenCreatorAtProject = projectPolicy.body.bindings?.some(binding => binding.role === "roles/iam.serviceAccountTokenCreator" && binding.members?.includes(signerMember));
const iam = new Client({ urlPrefix: "https://iam.googleapis.com" });
console.log("Inspecting signer-specific permissions.");
const signerPolicy = await iam.post(`/v1/projects/-/serviceAccounts/${encodeURIComponent(signer)}:getIamPolicy`, {});
const tokenCreatorOnSelf = signerPolicy.body.bindings?.some(binding => binding.role === "roles/iam.serviceAccountTokenCreator" && binding.members?.includes(signerMember));
const bucketPolicy = await new Client({ urlPrefix: "https://storage.googleapis.com" }).get("/storage/v1/b/tren-85720.firebasestorage.app/iam");
const bucketPublic = bucketPolicy.body.bindings?.some(binding => binding.members?.some(member => ["allUsers", "allAuthenticatedUsers"].includes(member)));
console.log(JSON.stringify({ protectedVideoPreflight: { runtimeSignerConfigured: Boolean(signer), signerHasTokenCreator: Boolean(tokenCreatorAtProject || tokenCreatorOnSelf), bucketPublic: Boolean(bucketPublic) } }));
const secrets = new Client({ urlPrefix: "https://secretmanager.googleapis.com" });
const secret = await secrets.get("/v1/projects/tren-85720/secrets/TELEGRAM_BOT_TOKEN/versions/latest:access", { skipLog: { resBody: true } });
const botToken = Buffer.from(secret.body.payload.data, "base64").toString("utf8").trim();
const telegramRead = async method => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Telegram read-only preflight failed.");
    return response.json();
  } catch { throw new Error("Telegram read-only preflight unavailable; no token was logged."); }
};
const [bot, webhook] = await Promise.all([telegramRead("getMe"), telegramRead("getWebhookInfo")]);
console.log(JSON.stringify({ telegramPreflight: { botMatches: bot.result?.username?.toLowerCase() === "zmena_teleg_bot", webhookConfigured: Boolean(webhook.result?.url), webhookMatches: webhook.result?.url === "https://europe-west1-tren-85720.cloudfunctions.net/telegramWebhook", pendingUpdates: webhook.result?.pending_update_count || 0, latestWebhookError: String(webhook.result?.last_error_message || "").slice(0, 180) } }));
