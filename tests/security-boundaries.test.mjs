import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const appCoreSource = await readFile(new URL("../src/AppCore.jsx", import.meta.url), "utf8");
const appBootstrapHelpersSource = await readFile(new URL("../src/app/appBootstrapHelpers.js", import.meta.url), "utf8");
const appNavigationSource = await readFile(new URL("../src/app/appNavigation.js", import.meta.url), "utf8");
const appRouterSource = await readFile(new URL("../src/app/AppRouter.jsx", import.meta.url), "utf8");
const appTerminalRouteSource = await readFile(new URL("../src/app/AppTerminalRoute.jsx", import.meta.url), "utf8");
const authBootstrapEffectSource = await readFile(new URL("../src/app/useAuthBootstrapEffect.js", import.meta.url), "utf8");
const appRuntimeEffectsSource = await readFile(new URL("../src/app/useAppRuntimeEffects.js", import.meta.url), "utf8");
const apiClientSource = await readFile(new URL("../src/utils/apiClient.js", import.meta.url), "utf8");
const appCheckSource = await readFile(new URL("../src/app/appCheck.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const rulesSource = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const storageRulesSource = await readFile(new URL("../storage.rules", import.meta.url), "utf8");
const firebaseConfig = JSON.parse(
  await readFile(new URL("../firebase.json", import.meta.url), "utf8")
);

function getExportBlock(name, nextName) {
  const start = functionsSource.indexOf(`export const ${name}`);
  const end = nextName
    ? functionsSource.indexOf(`export const ${nextName}`, start + 1)
    : functionsSource.length;

  assert.notEqual(start, -1, `${name} export must exist`);
  return functionsSource.slice(start, end === -1 ? functionsSource.length : end);
}

test("paid and privileged HTTP functions require an active member", () => {
  const protectedExports = [
    ["trainerCreateInvite", "openClientInvite"],
    ["adminCreateTrainerInvite", "openClientInvite"],
    ["telegramLoginVerify", "telegramRefreshAvatar"],
    ["telegramRefreshAvatar", "telegramCreateLinkCode"],
    ["telegramCreateLinkCode", "telegramUpdateNotifications"],
    ["telegramUpdateNotifications", "telegramDisconnect"],
    ["telegramDisconnect", "telegramSendMessage"],
    ["telegramSendMessage", "telegramTestWorkoutReminder"],
    ["telegramTestWorkoutReminder", "telegramDailyWorkoutReminders"],
    ["telegramSetWebhook", "telegramWebhook"],
    ["openFoodFactsSearch", "profileUpdateEmail"],
    ["profileUpdateEmail", "profileUpdateLogin"],
    ["profileUpdateLogin", "adminAssignClient"],
    ["adminAssignClient", "adminUpdateUserRole"],
    ["adminUpdateUserRole", "adminSetUserAccess"],
    ["adminSetUserAccess", "adminManageTrainerInvite"],
    ["adminManageTrainerInvite", "deleteUser"],
    ["deleteUser", "aiFoodVoice"],
    ["aiFoodVoice", "aiFoodPhoto"],
    ["aiFoodPhoto", null]
  ];

  protectedExports.forEach(([name, nextName]) => {
    assert.match(getExportBlock(name, nextName), /requireActiveMember\(req\)/);
  });
  assert.match(
    functionsSource,
    /async function nutritionSearchHandler[\s\S]*?requireActiveMember\(req\)/
  );
  assert.match(functionsSource, /function isActiveMemberData\(userData = \{\}\)/);
  assert.match(functionsSource, /async function requireActiveMember\(req\)/);
});

test("only a claim administrator can invite a trainer without creating client bindings", () => {
  const inviteBlock = getExportBlock("adminCreateTrainerInvite", "openClientInvite");

  assert.match(inviteBlock, /requireActiveMember\(req\)/);
  assert.match(inviteBlock, /assertAdminContext\(context\)/);
  assert.match(inviteBlock, /role: "trainer"/);
  assert.match(inviteBlock, /enforceRateLimit\(context\.uid, "admin-create-trainer-invite"/);
  assert.doesNotMatch(inviteBlock, /collection\("clientInvites"\)/);
  assert.doesNotMatch(inviteBlock, /collection\("trainerClients"\)/);
  assert.doesNotMatch(inviteBlock, /assignedTrainerId/);
});

test("admin lifecycle endpoints centralize role, assignment, access and invite changes", () => {
  const assignmentBlock = getExportBlock("adminAssignClient", "adminUpdateUserRole");
  const roleBlock = getExportBlock("adminUpdateUserRole", "adminSetUserAccess");
  const accessBlock = getExportBlock("adminSetUserAccess", "adminManageTrainerInvite");
  const inviteBlock = getExportBlock("adminManageTrainerInvite", "deleteUser");

  [assignmentBlock, roleBlock, accessBlock, inviteBlock].forEach((block) => {
    assert.match(block, /requireActiveMember\(req\)/);
    assert.match(block, /assertAdminContext\(context\)/);
    assert.match(block, /enforceRateLimit\(context\.uid/);
  });
  assert.match(assignmentBlock, /runTransaction/);
  assert.match(assignmentBlock, /getTrainerAssignmentUpdate/);
  assert.match(functionsSource, /trainerAssignmentState/);
  assert.match(assignmentBlock, /collection\("trainerClients"\)/);
  assert.match(roleBlock, /getAssignedClientsForTrainer/);
  assert.match(roleBlock, /MAX_ADMIN_ROLE_REASSIGNMENTS/);
  assert.match(roleBlock, /Reassign assigned clients before changing this trainer to a client/);
  assert.match(accessBlock, /Reassign all clients before suspending this trainer/);
  assert.match(accessBlock, /revokeRefreshTokens/);
  assert.match(inviteBlock, /action === "resend"/);
  assert.match(inviteBlock, /\["status", "resend", "revoke"\]/);
  assert.match(inviteBlock, /status: "superseded"/);
  assert.match(inviteBlock, /status: "revoked"/);
  assert.match(functionsSource, /ADMIN_AUDIT_EVENTS_COLLECTION = "adminAuditEvents"/);
});

test("voice food analysis is rate-limited and bounds AI fallback nutrition values", () => {
  const voiceBlock = getExportBlock("aiFoodVoice", "aiFoodPhoto");

  assert.match(voiceBlock, /requireActiveMember\(req\)/);
  assert.match(voiceBlock, /enforceRateLimit\(context\.uid, "ai-food-voice"/);
  assert.match(voiceBlock, /enforceRateLimit\(context\.uid, "ai-food-voice-daily"/);
  assert.match(voiceBlock, /source-backed catalog/);
  assert.match(voiceBlock, /clearly labelled AI estimate/);
  assert.match(voiceBlock, /estimatedNutritionPer100g/);
  assert.match(voiceBlock, /calories:\s*\{ type: "number" \}/);
  assert.match(voiceBlock, /protein:\s*\{ type: "number" \}/);
  assert.match(voiceBlock, /fat:\s*\{ type: "number" \}/);
  assert.match(voiceBlock, /carbs:\s*\{ type: "number" \}/);
  assert.match(functionsSource, /MAX_AI_VOICE_ESTIMATE_CALORIES = 900/);
  assert.match(functionsSource, /MAX_AI_VOICE_ESTIMATE_MACRO = 100/);
  assert.match(functionsSource, /normalizeVoiceEstimatedNutritionPer100g/);
});

test("client API calls send Firebase ID tokens", () => {
  assert.match(apiClientSource, /export async function fetchAuthorized\(/);
  assert.match(apiClientSource, /export async function fetchAuthorizedWithTimeout\(/);
  assert.match(apiClientSource, /"Authorization": `Bearer \$\{await currentUser\.getIdToken\(\)\}`/);
  assert.doesNotMatch(appSource, /fetch\("\/api\/telegram\/send-message"/);
  assert.doesNotMatch(appSource, /fetch\("\/api\/ai-food-photo"/);
  assert.doesNotMatch(appSource, /fetch\("\/api\/admin\/deleteUser"/);
});

test("App Check starts without blocking the application and protects API traffic when configured", () => {
  const appCheckInitialization = mainSource.indexOf("void initializeClientAppCheck()");
  const applicationImport = mainSource.indexOf("await import('./App.jsx')");

  assert.notEqual(appCheckInitialization, -1, "the client must initialize App Check");
  assert.notEqual(applicationImport, -1, "the application must be loaded dynamically");
  assert.ok(applicationImport < appCheckInitialization, "App Check must not delay the first application screen");
  assert.doesNotMatch(mainSource, /await initializeClientAppCheck\(\)/);
  assert.match(appCheckSource, /ReCaptchaEnterpriseProvider\(siteKey\)/);
  assert.match(appCheckSource, /isTokenAutoRefreshEnabled: true/);
  assert.match(
    appCheckSource,
    /export async function getClientAppCheckToken\(\) \{\s*try \{[\s\S]*?await initializeClientAppCheck\(\)[\s\S]*?\} catch \{\s*return "";/
  );
  assert.match(apiClientSource, /"X-Firebase-AppCheck": token/);
  assert.match(functionsSource, /async function verifyAppCheckRequest\(req\)/);
  assert.match(
    functionsSource,
    /async function requireActiveMember\(req\) \{\s*await verifyAppCheckRequest\(req\);/
  );
  assert.match(
    getExportBlock("resolveLoginAlias", "trainerCreateInvite"),
    /await verifyAppCheckRequest\(req\)/
  );
  assert.match(functionsSource, /enforceAppCheck: APP_CHECK_ENFORCED/);
});

test("invite validation fails safely on Identity Toolkit configuration or upstream errors", () => {
  const inviteBlock = getExportBlock("openClientInvite", "telegramLoginVerify");

  assert.match(functionsSource, /\["INVALID_OOB_CODE", "EXPIRED_OOB_CODE"\]\.includes\(errorCode\)/);
  assert.match(functionsSource, /function rejectKnownProductionReference\(value, parameterName\)/);
  assert.match(functionsSource, /FIREBASE_WEB_API_KEY must not use the production key outside production/);
  assert.match(functionsSource, /TELEGRAM_WEBHOOK_URL must be an HTTPS URL without credentials/);
  assert.match(inviteBlock, /if \(isActionActive === null\) \{\s*return res\.status\(503\)\.send\("Invitation temporarily unavailable"\);/);
  assert.ok(
    inviteBlock.indexOf("if (isActionActive === null)") < inviteBlock.indexOf("if (isActionActive === false)"),
    "an unknown validation result must not consume an invitation"
  );
});

test("profile owners cannot change role and trainer assignment fields", () => {
  assert.match(rulesSource, /function protectedUserFields\(\)/);
  assert.match(rulesSource, /function isSafeOwnerCreate\(uid\)/);
  assert.match(rulesSource, /function isSafeOwnerUpdate\(uid\)/);
  assert.match(rulesSource, /function isLegacyClientActivation\(uid\)/);
  assert.match(
    rulesSource,
    /allow update: if isAdmin\(\) \|\| isSafeOwnerUpdate\(uid\) \|\| isLegacyClientActivation\(uid\) \|\| isTrainerClientUpdate\(\)/
  );
  assert.match(
    rulesSource,
    /"assignedWorkoutCount",\s*"workoutCalendar"/
  );
  assert.match(rulesSource, /"subscription",\s*"telegram",\s*"telegramConnected"/);
  assert.match(rulesSource, /"trainerAssignmentState"/);
  assert.match(rulesSource, /function isActiveMember\(\)/);
  assert.match(rulesSource, /function isTrainerTelegramPreferenceUpdate\(\)/);
});

test("assigned trainer access requires the trainer role and guarded routes", () => {
  assert.match(
    rulesSource,
    /function isAssignedTrainerData\(data\) \{\s*return isTrainer\(\) && hasResolvedAssignedTrainer\(data\);/m
  );
  assert.match(appTerminalRouteSource, /const canUseTrainerFeatures = typeof ctx\.canUseTrainerFeatures === "function"/);
  assert.match(appTerminalRouteSource, /isTrainerPage && !canUseTrainerFeatures/);
  assert.match(
    appTerminalRouteSource,
    /canUseTrainerFeatures && \(page === APP_PAGES\.PROFILE \|\| page === APP_PAGES\.MAIN\)[\s\S]*?<TrainerDashboardRoute \{\.\.\.ctx\} page=\{APP_PAGES\.ADMIN\}/
  );
  assert.match(
    appBootstrapHelpersSource,
    /resolvedRole === "client"[\s\S]*?setPage\([\s\S]*?APP_PAGES\.MAIN[\s\S]*?\} else \{\s*setPage\(resolvedRole === "admin" \? APP_PAGES\.ADMIN_PANEL : APP_PAGES\.ADMIN\);/
  );
  assert.match(appNavigationSource, /function isTrainerForbiddenClientPage\(page\)[\s\S]*?CLIENT_CORE[\s\S]*?CLIENT_WORKFLOW[\s\S]*?APP_PAGES\.AI_COACH/);
  assert.match(appRuntimeEffectsSource, /isTrainerForbiddenClientPage\(page\)[\s\S]*?setPage\(APP_PAGES\.ADMIN\)/);
  assert.match(
    appCoreSource,
    /canUseTrainerFeatures\(\) && isTrainerForbiddenClientPage\(page\)[\s\S]*?const effectivePage = trainerForbiddenClientPage[\s\S]*?isClaimAdmin \? APP_PAGES\.ADMIN_PANEL : APP_PAGES\.ADMIN/
  );
  assert.match(
    authBootstrapEffectSource,
    /const resolvedRole = await loadRemoteUserBootstrapState[\s\S]*?if \(resolvedRole === "client"\) \{[\s\S]*?loadInitialSignedInUserData[\s\S]*?\} else \{[\s\S]*?setPlan\(\{ workouts: \[\] \}\)/
  );
  assert.match(appRouterSource, /page === APP_PAGES\.ADMIN_PANEL[\s\S]*?!canUseAdminFeatures\(\)/);
});

test("administrative reassignment cannot fall back to a historical trainer and audit records are server-only", () => {
  assert.match(rulesSource, /function hasExplicitTrainerAssignmentState\(data\)/);
  assert.match(rulesSource, /data\.trainerAssignmentState == "assigned"/);
  assert.match(rulesSource, /match \/adminAuditEvents\/\{eventId\}/);
  assert.match(rulesSource, /allow read: if isAdmin\(\);\s*allow write: if false;/);
});

test("explicit trainer lifecycle state also protects progress photos and pending invites", () => {
  assert.match(storageRulesSource, /function hasExplicitTrainerAssignmentState\(data\)/);
  assert.match(storageRulesSource, /data\.trainerAssignmentState in \["assigned", "unassigned", "revoked"\]/);
  assert.match(storageRulesSource, /data\.trainerAssignmentState == "assigned"/);
  assert.match(storageRulesSource, /function isAssignedTrainer\(uid\) \{\s*let client = userData\(uid\);\s*return isTrainer\(\) && hasResolvedAssignedTrainer\(client\);/m);
  assert.match(
    storageRulesSource,
    /match \/progress-photos\/\{uid\}\/\{photoId\}\/\{fileName\} \{\s*allow read: if isOwnerOrAdmin\(uid\) \|\| \(isTrainer\(\) && isAssignedTrainer\(uid\)\);\s*allow create, update: if \(isOwnerOrAdmin\(uid\) \|\| \(isTrainer\(\) && isAssignedTrainer\(uid\)\)\) &&[\s\S]*?allow delete: if isOwnerOrAdmin\(uid\) \|\| \(isTrainer\(\) && isAssignedTrainer\(uid\)\);/m
  );
  assert.match(rulesSource, /function isTrainerInviteOwnerUpdate\(\)/);
  assert.match(rulesSource, /resource\.data\.trainerId == request\.auth\.uid/);
  assert.match(rulesSource, /request\.resource\.data\.trainerId == resource\.data\.trainerId/);
  assert.match(rulesSource, /allow update: if isTrainerInviteOwnerUpdate\(\) \|\| isInviteAcceptance\(\);/);
});

test("assigned trainer nutrition writes are limited to plan fields", () => {
  assert.match(rulesSource, /function isTrainerNutritionPlanUpdate\(\)/);
  assert.match(rulesSource, /function trainerNutritionStateFields\(\)/);
  assert.match(rulesSource, /function isTrainerNutritionStatePlanCreate\(uid, docId\)/);
  assert.match(rulesSource, /function isTrainerNutritionStatePlanUpdate\(uid, docId\)/);
  assert.match(
    rulesSource,
    /function isTrainerClientUpdate\(\) \{[\s\S]*?isTrainerProgramAssignmentFields\(\)[\s\S]*?isTrainerNutritionPlanUpdateFields\(\)[\s\S]*?isTrainerClientScheduleUpdateFields\(\)[\s\S]*?isTrainerClientArchiveUpdateFields\(\)/
  );
  assert.match(rulesSource, /function isTrainerClientArchiveUpdate\(\)/);
  assert.match(
    rulesSource,
    /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(trainerNutritionStateFields\(\)\)/
  );
});

test("every configured API rewrite points to an exported function", () => {
  const rewrites = firebaseConfig.hosting?.rewrites || [];
  const functionIds = rewrites
    .map((rewrite) => rewrite.function?.functionId)
    .filter(Boolean);

  functionIds.forEach((functionId) => {
    assert.match(functionsSource, new RegExp(`export const ${functionId}\\b`));
  });
});

test("legacy profile recovery is restricted to authenticated historic accounts", () => {
  assert.match(functionsSource, /export const recoverLegacyClientProfile = onRequest/);
  assert.match(functionsSource, /const context = await requireAuthenticatedUser\(req\)/);
  assert.match(functionsSource, /collection\("loginAliases"\)\s*\.where\("uid", "==", context\.uid\)/);
  assert.match(functionsSource, /role: "client"/);
  assert.match(functionsSource, /Legacy account recovery is unavailable/);
  assert.ok(
    (firebaseConfig.hosting?.rewrites || []).some(
      (rewrite) => rewrite.source === "/api/profile/recover-legacy" &&
        rewrite.function?.functionId === "recoverLegacyClientProfile"
    )
  );
});

test("hosting shell files are not cached across deploys", () => {
  const headers = firebaseConfig.hosting?.headers || [];
  const headerBySource = new Map(headers.map((entry) => [entry.source, entry.headers || []]));

  for (const source of ["/", "/index.html", "/sw.js"]) {
    const cacheControl = headerBySource
      .get(source)
      ?.find((header) => header.key === "Cache-Control")
      ?.value || "";

    assert.match(cacheControl, /no-cache/);
    assert.match(cacheControl, /no-store/);
    assert.match(cacheControl, /must-revalidate/);
  }
});

test("hosting adds conservative browser security headers", () => {
  const headers = firebaseConfig.hosting?.headers || [];
  const globalHeaders = headers.find((entry) => entry.source === "**")?.headers || [];
  const byKey = new Map(globalHeaders.map((header) => [header.key, header.value]));

  assert.equal(byKey.get("X-Content-Type-Options"), "nosniff");
  assert.equal(byKey.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(byKey.get("Content-Security-Policy") || "", /frame-ancestors 'none'/);
});
