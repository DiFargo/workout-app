import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";
import admin from "firebase-admin";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { getDueProgressReminderTypes, getDueReminderOffsets, getMinskDateKey, getNextScheduledWorkout } from "./reminderSchedule.js";
import { buildSubscriptionReminderLine, getDueSubscriptionNotifications, resolveSubscriptionNotificationSettings } from "./subscriptionReminders.js";
import { extractVoiceMetricAmounts, resolveVoiceFoodMetricAmounts } from "./voiceFoodAmounts.js";
import { getUnsafeVoiceFoodStems, isUnsafeVoiceFoodQuery } from "./voiceFoodSafety.js";
import { getBasicWorkoutCompositionIssues, orderBasicWorkoutExercises } from "./basicWorkoutPlanOrder.js";
import {
  getBasicWorkoutAiCatalogueGuidance,
  getBasicWorkoutAiCatalogueIssues,
  resolveBasicWorkoutAiCatalogueExercise
} from "./basicWorkoutAiCatalogue.js";
import { buildBasicWorkoutFallbackDraft } from "./basicWorkoutFallbackPlan.js";
import {
  buildBasicWorkoutTodayFallbackDraft,
  getBasicWorkoutTodayCompositionIssues,
  getBasicWorkoutTodayExerciseTarget,
  getBasicWorkoutTodayPromptGuidance,
  getBasicWorkoutTodayTarget,
  getBasicWorkoutTodayTargets
} from "./basicWorkoutTodayPlan.js";

admin.initializeApp();



const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const ADMIN_BOOTSTRAP_SECRET = defineSecret("ADMIN_BOOTSTRAP_SECRET");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const PRODUCTION_PROJECT_ID = "tren-85720";
const FIREBASE_WEB_API_KEY = "AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg";
const WORKOUT_APP_URL = "https://tren-85720.web.app/";
const APP_CHECK_ENFORCED = defineBoolean("APP_CHECK_ENFORCED", {
  default: false,
  label: "Enforce Firebase App Check",
  description: "Reject custom HTTP and callable requests without a valid App Check token."
});
const WORKOUT_APP_URL_PARAM = defineString("WORKOUT_APP_URL", {
  default: "",
  label: "Public Workout app URL"
});
const WORKOUT_WEB_API_KEY_PARAM = defineString("WORKOUT_WEB_API_KEY", {
  default: "",
  label: "Firebase web API key"
});
const WORKOUT_STORAGE_BUCKET_PARAM = defineString("WORKOUT_STORAGE_BUCKET", {
  default: "",
  label: "Firebase Storage bucket"
});
const INVITE_LOGIN_EMAIL_DOMAIN_PARAM = defineString("INVITE_LOGIN_EMAIL_DOMAIN", {
  default: "",
  label: "Internal invitation email domain"
});
const TELEGRAM_WEBHOOK_URL_PARAM = defineString("TELEGRAM_WEBHOOK_URL", {
  default: "",
  label: "Telegram webhook URL"
});
const MAX_AI_IMAGE_DATA_LENGTH = 8 * 1024 * 1024;
const MAX_AI_PROGRAM_TEXT_LENGTH = 35000;
const MAX_AI_PROGRAM_FILE_DATA_LENGTH = 10 * 1024 * 1024;
const MAX_AI_VOICE_TRANSCRIPT_LENGTH = 700;
const MAX_AI_VOICE_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_AI_VOICE_AUDIO_BASE64_LENGTH = Math.ceil(MAX_AI_VOICE_AUDIO_BYTES / 3) * 4;
const MAX_AI_VOICE_ESTIMATE_CALORIES = 900;
const MAX_AI_VOICE_ESTIMATE_MACRO = 100;
const ADMIN_AUDIT_EVENTS_COLLECTION = "adminAuditEvents";
// A role downgrade can touch a user document plus two trainer mirrors for each
// assigned client. Keep the atomic transaction safely below Firestore's 500
// write limit and ask an administrator to split exceptional bulk migrations.
const MAX_ADMIN_ROLE_REASSIGNMENTS = 100;
const TRAINER_INVITE_TTL_MS = 60 * 60 * 1000;
const VOICE_EXPLICIT_METRIC_AMOUNT_PATTERN = /(?:^|[^\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:г|гр\.?|грамм(?:а|ов)?|мл|миллилитр(?:а|ов)?|л|литр(?:а|ов)?|g|gr\.?|ml|l)(?=$|[^\p{L}])/iu;
const VOICE_SPOKEN_METRIC_AMOUNT_PATTERN = /(?:ноль|один|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот|тысяча)(?:[\s-]+(?:один|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто))?\s*(?:г|гр\.?|грамм(?:а|ов)?|мл|миллилитр(?:а|ов)?)(?=$|[^\p{L}])/iu;
const VOICE_AUDIO_MIME_EXTENSIONS = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "audio/m4a": "m4a"
};

function json(res, status, payload) {
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(payload));
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getHttpErrorStatus(error, fallback = 500) {
  if (Number.isInteger(error?.status)) return error.status;
  if (String(error?.code || "").startsWith("auth/")) return 401;
  if (/Firebase ID token|auth\/argument-error|auth\/id-token|Missing Firebase ID token/i.test(error?.message || "")) {
    return 401;
  }
  return fallback;
}

function getFunctionProjectId() {
  return String(
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    admin.app().options.projectId ||
    ""
  ).trim();
}

function getFunctionParamValue(param) {
  try {
    return String(param.value() || "").trim();
  } catch {
    return "";
  }
}

function isProductionFunctionProject() {
  return getFunctionProjectId() === PRODUCTION_PROJECT_ID;
}

function rejectKnownProductionReference(value, parameterName) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue || isProductionFunctionProject()) return cleanValue;

  if (cleanValue.toLowerCase().includes(PRODUCTION_PROJECT_ID)) {
    throw createHttpError(500, `${parameterName} must not reference production outside production`);
  }

  return cleanValue;
}

function getWorkoutAppUrl() {
  const configuredUrl = rejectKnownProductionReference(
    getFunctionParamValue(WORKOUT_APP_URL_PARAM),
    "WORKOUT_APP_URL"
  );
  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      if (parsed.protocol !== "https:") throw new Error("HTTPS required");
      return parsed.toString().replace(/\/?$/, "/");
    } catch {
      throw createHttpError(500, "WORKOUT_APP_URL must be an HTTPS URL");
    }
  }

  const projectId = getFunctionProjectId();
  if (!projectId) throw createHttpError(500, "Firebase project ID is unavailable");
  return "https://" + projectId + ".web.app/";
}

function getFirebaseWebApiKey() {
  const configuredKey = getFunctionParamValue(WORKOUT_WEB_API_KEY_PARAM);
  if (configuredKey) {
    if (!isProductionFunctionProject() && configuredKey === FIREBASE_WEB_API_KEY) {
      throw createHttpError(500, "FIREBASE_WEB_API_KEY must not use the production key outside production");
    }
    return configuredKey;
  }
  if (isProductionFunctionProject()) return FIREBASE_WEB_API_KEY;
  throw createHttpError(500, "FIREBASE_WEB_API_KEY is required outside production");
}

function getStorageBucketName() {
  const configuredBucket = rejectKnownProductionReference(
    getFunctionParamValue(WORKOUT_STORAGE_BUCKET_PARAM),
    "WORKOUT_STORAGE_BUCKET"
  );
  if (configuredBucket) return configuredBucket;
  const projectId = getFunctionProjectId();
  if (!projectId) throw createHttpError(500, "Firebase project ID is unavailable");
  return projectId + ".firebasestorage.app";
}

function getInviteLoginEmailDomain() {
  const configuredDomain = rejectKnownProductionReference(
    getFunctionParamValue(INVITE_LOGIN_EMAIL_DOMAIN_PARAM),
    "INVITE_LOGIN_EMAIL_DOMAIN"
  );
  if (configuredDomain) return configuredDomain;
  const projectId = getFunctionProjectId();
  if (!projectId) throw createHttpError(500, "Firebase project ID is unavailable");
  return "invite." + projectId + ".app";
}

function getTelegramWebhookUrl() {
  const configuredUrl = rejectKnownProductionReference(
    getFunctionParamValue(TELEGRAM_WEBHOOK_URL_PARAM),
    "TELEGRAM_WEBHOOK_URL"
  );
  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        throw new Error("HTTPS without credentials required");
      }
      return parsed.toString();
    } catch {
      throw createHttpError(500, "TELEGRAM_WEBHOOK_URL must be an HTTPS URL without credentials");
    }
  }
  const projectId = getFunctionProjectId();
  if (!projectId) throw createHttpError(500, "Firebase project ID is unavailable");
  return "https://europe-west1-" + projectId + ".cloudfunctions.net/telegramWebhook";
}

function isAppCheckEnforced() {
  return APP_CHECK_ENFORCED.value() === true;
}

async function verifyAppCheckRequest(req) {
  const token = String(
    req.get?.("X-Firebase-AppCheck") ||
    req.headers?.["x-firebase-appcheck"] ||
    ""
  ).trim();

  if (!token) {
    if (isAppCheckEnforced()) {
      throw createHttpError(401, "Firebase App Check token is required");
    }
    return null;
  }

  try {
    return await admin.appCheck().verifyToken(token);
  } catch (error) {
    if (isAppCheckEnforced()) {
      throw createHttpError(401, "Invalid Firebase App Check token");
    }
    console.warn("Ignoring invalid App Check token while enforcement is disabled:", error?.code || "unknown");
    return null;
  }
}

function isAssignedTrainerData(data = {}, uid = "") {
  const assignedTrainerId = String(data.assignedTrainerId || "").trim();
  const trainerId = String(data.trainerId || "").trim();
  const coachId = String(data.coachId || "").trim();
  const createdByUid = String(data.createdByUid || "").trim();
  const assignmentState = String(data.trainerAssignmentState || "").trim().toLowerCase();
  const canonicalTrainerId = assignedTrainerId || trainerId || coachId;
  const legacyTrainerId = coachId || createdByUid;

  // New administrative assignments deliberately keep the historical creator
  // fields for auditability. The explicit state prevents those legacy fields
  // from keeping a previous trainer authorized after reassignment/unassignment.
  const resolvedTrainerId = ["assigned", "unassigned"].includes(assignmentState)
    ? (assignmentState === "assigned" ? canonicalTrainerId : "")
    : (assignedTrainerId || trainerId || legacyTrainerId);

  return Boolean(uid) && resolvedTrainerId === uid;
}

function normalizeAdminUserId(value, fieldName = "uid", { optional = false } = {}) {
  const uid = String(value || "").trim();
  if (!uid && optional) return "";
  if (!uid || uid.length > 128 || uid.includes("/")) {
    throw createHttpError(400, `Invalid ${fieldName}`);
  }
  return uid;
}

function getUserRole(userData = {}) {
  return String(userData.role || "client").trim().toLowerCase();
}

function getAssignedTrainerId(userData = {}) {
  const assignmentState = String(userData.trainerAssignmentState || "").trim().toLowerCase();
  const assignedTrainerId = String(userData.assignedTrainerId || "").trim();
  const trainerId = String(userData.trainerId || "").trim();
  const coachId = String(userData.coachId || "").trim();

  if (["assigned", "unassigned"].includes(assignmentState)) {
    return assignmentState === "assigned" ? (assignedTrainerId || trainerId || coachId) : "";
  }

  return assignedTrainerId || trainerId || coachId || String(userData.createdByUid || "").trim();
}

function isClientAssignedToTrainer(userData = {}, trainerId = "") {
  return getUserRole(userData) === "client" &&
    Boolean(trainerId) &&
    getAssignedTrainerId(userData) === trainerId;
}

function getTrainerAssignmentUpdate({ trainerId = "", trainerData = {}, actorUid = "", now }) {
  const cleanTrainerId = String(trainerId || "").trim();
  const trainerEmail = cleanTrainerId
    ? normalizeAccountEmail(trainerData.email || trainerData.accountProfile?.email)
    : "";

  return {
    trainerAssignmentState: cleanTrainerId ? "assigned" : "unassigned",
    assignedTrainerId: cleanTrainerId,
    trainerId: cleanTrainerId,
    coachId: cleanTrainerId,
    assignedTrainerEmail: trainerEmail,
    trainerEmail,
    coachEmail: trainerEmail,
    trainerAssignmentUpdatedAt: now,
    trainerAssignmentUpdatedByUid: String(actorUid || "").trim()
  };
}

function getTrainerClientMirrorPayload({ clientId, clientData = {}, trainerId, trainerData = {}, now }) {
  const trainerEmail = normalizeAccountEmail(trainerData.email || trainerData.accountProfile?.email);
  const email = normalizeAccountEmail(clientData.email || clientData.accountProfile?.email);
  const loginLower = normalizeLoginAlias(clientData.loginLower || clientData.accountProfile?.login);

  return {
    clientId,
    uid: clientId,
    email,
    name: String(clientData.name || clientData.displayName || loginLower || email || "Client").trim(),
    role: "client",
    loginLower,
    trainerId,
    trainerEmail,
    assignedTrainerId: trainerId,
    assignedTrainerEmail: trainerEmail,
    createdAt: clientData.createdAt || now,
    updatedAt: now
  };
}

function buildAdminAuditEvent(context, { action, targetUid, details = {}, now }) {
  return {
    action,
    actorUid: context.uid,
    actorEmail: normalizeAccountEmail(context.token?.email || context.userData?.email),
    targetUid: String(targetUid || "").trim(),
    details,
    createdAt: now
  };
}

function setAdminAuditEvent(writer, db, context, input) {
  const auditRef = db.collection(ADMIN_AUDIT_EVENTS_COLLECTION).doc();
  writer.set(auditRef, buildAdminAuditEvent(context, input));
  return auditRef.id;
}

function assertAssignableTrainer(trainerData = {}, { allowPendingInvite = true } = {}) {
  if (getUserRole(trainerData) !== "trainer") {
    throw createHttpError(409, "Target user is not a trainer");
  }
  if (!isActiveMemberData(trainerData)) {
    throw createHttpError(409, "Trainer account is not active");
  }
  const hasInviteLifecycle = Boolean(
    String(trainerData.accountStatus || "").trim() ||
    String(trainerData.trainerInviteStatus || "").trim()
  );
  if (!allowPendingInvite && hasInviteLifecycle && getTrainerInviteStatusFromUser(trainerData) !== "accepted") {
    throw createHttpError(409, "Trainer invitation has not been activated");
  }
}

const TRAINER_ASSIGNMENT_QUERY_FIELDS = [
  "assignedTrainerId",
  "trainerId",
  "coachId",
  "createdByUid"
];

async function getAssignedClientsForTrainer({ db, trainerId, transaction = null }) {
  const snapshots = await Promise.all(TRAINER_ASSIGNMENT_QUERY_FIELDS.map((field) => {
    const query = db.collection("users").where(field, "==", trainerId);
    return transaction ? transaction.get(query) : query.get();
  }));
  const clientsByPath = new Map();

  snapshots.forEach((snapshot) => snapshot.forEach((item) => {
    const data = item.data() || {};
    if (isClientAssignedToTrainer(data, trainerId)) {
      clientsByPath.set(item.ref.path, { id: item.id, ref: item.ref, data });
    }
  }));

  return [...clientsByPath.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function getAdminLifecycleUserPayload(uid, userData = {}) {
  return {
    id: uid,
    role: getUserRole(userData),
    active: userData.active !== false,
    accessDisabled: userData.accessDisabled === true,
    membershipStatus: String(userData.membershipStatus || "active"),
    accountStatus: String(userData.accountStatus || "active")
  };
}

function getTrainerInviteStatusFromUser(trainerData = {}) {
  const accountStatus = String(trainerData.accountStatus || "").trim().toLowerCase();
  const inviteStatus = String(trainerData.trainerInviteStatus || "").trim().toLowerCase();

  if (accountStatus === "revoked" || inviteStatus === "revoked") return "revoked";
  if (accountStatus === "suspended" || trainerData.accessDisabled === true || trainerData.active === false) {
    return "suspended";
  }
  if (accountStatus === "active" || inviteStatus === "accepted") return "accepted";
  return "pending";
}

function isActiveMemberData(userData = {}) {
  const role = String(userData.role || "").trim().toLowerCase();

  return ["client", "trainer", "admin"].includes(role) &&
    userData.active !== false &&
    userData.archived !== true &&
    userData.accessDisabled !== true &&
    userData.membershipStatus !== "revoked" &&
    userData.membershipStatus !== "suspended";
}

async function getAuthenticatedContext(req, { requireMembership = false } = {}) {
  const authorization = String(req.headers.authorization || "");
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!idToken) {
    throw createHttpError(401, "Missing Firebase ID token");
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  const userSnapshot = await admin.firestore().collection("users").doc(decodedToken.uid).get();
  const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};

  if (requireMembership && (!userSnapshot.exists || !isActiveMemberData(userData))) {
    throw createHttpError(403, "Active membership required");
  }

  return {
    uid: decodedToken.uid,
    token: decodedToken,
    userData,
    role: decodedToken.admin === true ? "admin" : String(userData.role || "client")
  };
}

async function requireActiveMember(req) {
  await verifyAppCheckRequest(req);
  return getAuthenticatedContext(req, { requireMembership: true });
}

async function requireAuthenticatedUser(req) {
  await verifyAppCheckRequest(req);
  return getAuthenticatedContext(req);
}

function assertAdminContext(context) {
  if (context?.token?.admin !== true) {
    throw createHttpError(403, "Admin access required");
  }
}

async function getManagedClient(context, clientId) {
  const cleanClientId = String(clientId || "").trim();
  if (!cleanClientId) throw createHttpError(400, "Missing clientId");

  const clientSnapshot = await admin.firestore().collection("users").doc(cleanClientId).get();
  if (!clientSnapshot.exists) throw createHttpError(404, "Client not found");

  const clientData = clientSnapshot.data() || {};
  const canManage = context?.token?.admin === true ||
    (context?.role === "trainer" && isAssignedTrainerData(clientData, context.uid));

  if (!canManage) throw createHttpError(403, "Client access denied");

  return {
    id: cleanClientId,
    data: clientData,
    ref: clientSnapshot.ref
  };
}

async function enforceRateLimit(uid, action, { limit, windowMs }) {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) throw createHttpError(401, "Authentication required");

  const key = crypto
    .createHash("sha256")
    .update(`${cleanUid}:${action}`)
    .digest("hex");
  const ref = admin.firestore().collection("securityRateLimits").doc(key);
  const now = Date.now();

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const windowStartedAt = Number(data.windowStartedAt || 0);
    const inCurrentWindow = windowStartedAt > 0 && now - windowStartedAt < windowMs;
    const count = inCurrentWindow ? Number(data.count || 0) : 0;

    if (count >= limit) {
      throw createHttpError(429, "Too many requests");
    }

    transaction.set(ref, {
      uid: cleanUid,
      action,
      count: count + 1,
      windowStartedAt: inCurrentWindow ? windowStartedAt : now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

function getPublicRequestIdentity(req) {
  const forwardedFor = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const address = forwardedFor || String(req.ip || req.socket?.remoteAddress || "unknown");
  return `public:${crypto.createHash("sha256").update(address).digest("hex")}`;
}

function normalizeTelegramTarget({ chatId, telegramUserId, username }) {
  const directChatId = String(chatId || "").trim();
  const userId = String(telegramUserId || "").trim();
  const cleanUsername = String(username || "").replace(/^@/, "").trim();

  return directChatId || userId || (cleanUsername ? `@${cleanUsername}` : "");
}

function normalizeAccountEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getInternalInviteEmail(login) {
  return normalizeLoginAlias(login) + "@" + getInviteLoginEmailDomain();
}

function getDefaultLoginAliasForEmail(email) {
  const cleanEmail = normalizeAccountEmail(email);
  const [localPart] = cleanEmail.split("@");
  return /^[a-z0-9._-]{3,32}$/.test(localPart || "") ? localPart : "";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[character]));
}

function renderInviteLinkNoticePageTemplate({ email, login, title, message, statusLabel }) {
  const accountEmail = escapeHtml(login ? `Логин: ${login}` : email);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workout - доступ к приложению</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f4ff;color:#181827;font:16px Arial,sans-serif;padding:20px}.card{width:min(100%,430px);background:#fff;border:1px solid #e4e1f4;border-radius:28px;padding:30px;box-shadow:0 20px 50px #33236b20}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:#eee9ff;color:#633cff;font-size:27px;font-weight:800}.eyebrow{margin:22px 0 8px;color:#6846ec;font-size:12px;font-weight:800;letter-spacing:.08em}h1{margin:0;font-size:29px;line-height:1.1}p{color:#777386;line-height:1.45}.email{font-weight:700;color:#28243a}.status{margin-top:22px;padding:12px;border-radius:12px;background:#f3f1ff;color:#5536c7;font-size:14px}.login-link{display:block;width:100%;border-radius:15px;margin-top:20px;padding:16px;background:#643cf2;color:#fff;font-size:17px;font-weight:800;text-align:center;text-decoration:none}</style></head><body><main class="card"><div class="mark">W</div><div class="eyebrow">ДОСТУП К ПРИЛОЖЕНИЮ</div><h1>${title}</h1><p>${message} <span class="email">${accountEmail}</span>.</p><div class="status">${statusLabel}</div><a class="login-link" href="${WORKOUT_APP_URL}">Перейти ко входу</a></main></body></html>`;
}

function renderInviteLinkNoticePage(input) {
  return renderInviteLinkNoticePageTemplate(input).replaceAll(WORKOUT_APP_URL, getWorkoutAppUrl());
}

async function isPasswordResetActionActive(actionCode) {
  const apiKey = getFirebaseWebApiKey();

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode: actionCode })
      }
    );
    if (response.ok) return true;

    const payload = await response.json().catch(() => ({}));
    const errorCode = String(payload?.error?.message || "").trim().toUpperCase();
    if (["INVALID_OOB_CODE", "EXPIRED_OOB_CODE"].includes(errorCode)) {
      return false;
    }

    console.error("Unable to verify invite action code:", response.status, errorCode || "unknown");
    return null;
  } catch (error) {
    console.warn("Unable to verify invite action code:", error);
    return null;
  }
}

function renderInviteActivationPageTemplate({ actionCode, email, login }) {
  const code = JSON.stringify(String(actionCode || ""));
  const accountEmail = JSON.stringify(login ? `Логин: ${login}` : String(email || ""));
  const appUrl = JSON.stringify(getWorkoutAppUrl());
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workout - создание пароля</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f4ff;color:#181827;font:16px Arial,sans-serif;padding:20px}.card{width:min(100%,430px);background:#fff;border:1px solid #e4e1f4;border-radius:28px;padding:30px;box-shadow:0 20px 50px #33236b20}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:#eee9ff;color:#633cff;font-size:27px;font-weight:800}.eyebrow{margin:22px 0 8px;color:#6846ec;font-size:12px;font-weight:800;letter-spacing:.08em}h1{margin:0;font-size:29px;line-height:1.1}p{color:#777386;line-height:1.45}.email{font-weight:700;color:#28243a}label{display:block;margin-top:24px;font-size:14px;font-weight:700}input{width:100%;margin-top:8px;padding:15px 16px;border:1px solid #dedbea;border-radius:14px;font:17px Arial;outline:none}input:focus{border-color:#6846ec;box-shadow:0 0 0 4px #6846ec17}button,.login-link{width:100%;border:0;border-radius:15px;margin-top:20px;padding:16px;background:#643cf2;color:#fff;font-size:17px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none}button:disabled{opacity:.6;cursor:wait}.login-link{display:none}.login-link.show{display:block}.hint{font-size:13px;margin-top:14px}.status{display:none;margin-top:16px;padding:12px;border-radius:12px;background:#f3f1ff;color:#5536c7;font-size:14px}.status.error{background:#fff0f0;color:#b13b46}.status.show{display:block}</style></head><body><main class="card"><div class="mark">W</div><div class="eyebrow">ДОСТУП К ПРИЛОЖЕНИЮ</div><h1>Создай пароль</h1><p>Пароль будет привязан к аккаунту <span class="email" id="email"></span>. После сохранения можно войти в Workout.</p><form id="form"><label>Новый пароль<input id="password" type="password" minlength="6" required autocomplete="new-password" placeholder="Минимум 6 символов"></label><label>Повтори пароль<input id="repeat" type="password" minlength="6" required autocomplete="new-password" placeholder="Повтори пароль"></label><button id="submit" type="submit">Сохранить пароль</button></form><div id="status" class="status"></div><a id="login-link" class="login-link" href=${appUrl}>Перейти ко входу</a><p class="hint">Ссылка действует ограниченное время и может быть использована один раз.</p></main><script>const code=${code},email=${accountEmail},apiKey="AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg";document.getElementById("email").textContent=email;const form=document.getElementById("form"),status=document.getElementById("status"),button=document.getElementById("submit"),loginLink=document.getElementById("login-link");function show(message,error=false){status.textContent=message;status.className="status show"+(error?" error":"")}form.addEventListener("submit",async e=>{e.preventDefault();const password=document.getElementById("password").value,repeat=document.getElementById("repeat").value;if(password!==repeat)return show("Пароли не совпадают.",true);button.disabled=true;button.textContent="Сохраняю...";try{const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key="+apiKey,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({oobCode:code,newPassword:password})});if(!r.ok)throw new Error();show("Пароль создан. Теперь можно войти в приложение.");form.hidden=true;loginLink.classList.add("show")}catch{show("Ссылка недействительна или срок её действия истёк. Попроси тренера создать новое приглашение.",true);button.disabled=false;button.textContent="Сохранить пароль"}});</script></body></html>`;
}

function renderInviteActivationPage(input) {
  return renderInviteActivationPageTemplate(input).replaceAll(FIREBASE_WEB_API_KEY, getFirebaseWebApiKey());
}

function normalizeLoginAlias(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidLoginAlias(value) {
  return /^[a-z0-9._-]{3,32}$/.test(String(value || ""));
}

function getInviteActionCode(inviteData = {}) {
  try {
    return new URL(String(inviteData.activationUrl || "")).searchParams.get("oobCode") || "";
  } catch {
    return "";
  }
}

function sortInviteLinksNewestFirst(invites = []) {
  return [...invites].sort((left, right) => {
    const leftTime = Date.parse(left.data?.createdAt || "") || 0;
    const rightTime = Date.parse(right.data?.createdAt || "") || 0;
    return rightTime - leftTime;
  });
}

async function getTrainerInviteLinks(db, trainerUid, trainerData = {}) {
  const email = normalizeAccountEmail(trainerData.email || trainerData.accountProfile?.email);
  const snapshots = await Promise.all([
    db.collection("inviteLinks").where("uid", "==", trainerUid).get(),
    ...(email ? [db.collection("inviteLinks").where("email", "==", email).get()] : [])
  ]);
  const byPath = new Map();

  snapshots.forEach((snapshot) => snapshot.forEach((item) => {
    const data = item.data() || {};
    if (data.inviteKind === "trainer" || data.role === "trainer") {
      byPath.set(item.ref.path, { ref: item.ref, data });
    }
  }));

  return sortInviteLinksNewestFirst([...byPath.values()]);
}

function getActiveTrainerInvite(invites = []) {
  const now = Date.now();
  return invites.find(({ data }) => {
    const status = String(data.status || "active").trim().toLowerCase();
    const expiresAt = Date.parse(data.expiresAt || "");
    return !["used", "revoked", "superseded"].includes(status) &&
      (!expiresAt || expiresAt >= now) &&
      Boolean(getInviteActionCode(data));
  }) || null;
}

async function refreshTrainerInviteStatus({ db, trainerRef, trainerUid, trainerData }) {
  const currentStatus = getTrainerInviteStatusFromUser(trainerData);
  const invites = await getTrainerInviteLinks(db, trainerUid, trainerData);
  const latestInvite = invites[0] || null;

  if (["accepted", "revoked", "suspended"].includes(currentStatus)) {
    return { status: currentStatus, latestInvite, activeInvite: null };
  }

  const activeInvite = getActiveTrainerInvite(invites);
  if (!activeInvite) {
    const status = latestInvite ? "expired" : "missing";
    if (trainerData.trainerInviteStatus !== status) {
      await trainerRef.set({ trainerInviteStatus: status, updatedAt: new Date().toISOString() }, { merge: true });
    }
    return { status, latestInvite, activeInvite: null };
  }

  const actionState = await isPasswordResetActionActive(getInviteActionCode(activeInvite.data));
  if (actionState === false) {
    const now = new Date().toISOString();
    const batch = db.batch();
    batch.set(activeInvite.ref, { status: "used", usedAt: now }, { merge: true });
    batch.set(trainerRef, {
      accountStatus: "active",
      trainerInviteStatus: "accepted",
      trainerInviteAcceptedAt: now,
      updatedAt: now
    }, { merge: true });
    await batch.commit();
    return { status: "accepted", latestInvite: activeInvite, activeInvite: null };
  }

  // An upstream validation error must not consume or invalidate a live invite.
  return { status: "pending", latestInvite, activeInvite };
}

function buildTrainerInviteApiPayload({ trainerUid, trainerData, state }) {
  const invite = state.activeInvite || (state.status === "accepted" ? state.latestInvite : null);
  const expiresAt = invite?.data?.expiresAt || "";
  const shareUrl = state.activeInvite
    ? `${getWorkoutAppUrl()}invite/${state.activeInvite.ref.id}`
    : "";

  return {
    uid: trainerUid,
    status: state.status,
    login: normalizeLoginAlias(trainerData.loginLower || trainerData.accountProfile?.login),
    expiresAt,
    shareUrl
  };
}

async function markTrainerInviteAcceptedForLink(linkSnapshot, linkData = {}) {
  if (linkData.inviteKind !== "trainer" && linkData.role !== "trainer") return;

  const db = admin.firestore();
  let trainerUid = normalizeAdminUserId(linkData.uid, "trainer uid", { optional: true });
  if (!trainerUid) {
    const login = normalizeLoginAlias(linkData.login);
    if (login) {
      const aliasSnapshot = await db.collection("loginAliases").doc(login).get();
      trainerUid = normalizeAdminUserId(aliasSnapshot.data()?.uid, "trainer uid", { optional: true });
    }
  }
  if (!trainerUid) return;

  const now = new Date().toISOString();
  const batch = db.batch();
  batch.set(linkSnapshot.ref, { status: "used", usedAt: now }, { merge: true });
  batch.set(db.collection("users").doc(trainerUid), {
    accountStatus: "active",
    trainerInviteStatus: "accepted",
    trainerInviteAcceptedAt: now,
    updatedAt: now
  }, { merge: true });
  await batch.commit();
}

async function sendTelegramMessage({ chatId, telegramUserId, username, text, token, replyMarkup = null }) {
  const targetChatId = normalizeTelegramTarget({ chatId, telegramUserId, username });

  if (!targetChatId) {
    throw new Error("Missing Telegram target");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      text,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    })
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || "Telegram API error");
  }

  return data;
}

async function assertActiveCallableMember(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const userSnapshot = await admin.firestore().collection("users").doc(request.auth.uid).get();
  if (!userSnapshot.exists || !isActiveMemberData(userSnapshot.data() || {})) {
    throw new HttpsError("permission-denied", "Active membership required.");
  }

  return userSnapshot.data() || {};
}

function hasMatchingSecret(candidate, expected) {
  const candidateBuffer = Buffer.from(String(candidate || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));

  return candidateBuffer.length > 0 &&
    candidateBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

async function saveTelegramAvatar(uid, userId, token) {
  if (!uid || !userId) return "";

  try {
    const photosResponse = await fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, limit: 1 })
    });

    const photosData = await photosResponse.json();

    if (!photosData.ok || !photosData.result?.photos?.length) return "";

    const bestPhoto = photosData.result.photos[0].at(-1);
    const fileId = bestPhoto?.file_id;

    if (!fileId) return "";

    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const fileData = await fileResponse.json();

    if (!fileData.ok || !fileData.result?.file_path) return "";

    const telegramFileResponse = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);

    if (!telegramFileResponse.ok) return "";

    const contentType = telegramFileResponse.headers.get("content-type") || "image/jpeg";
    const extension = String(fileData.result.file_path).split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
    const downloadToken = crypto.randomUUID();
    const storagePath = `telegram-avatars/${uid}/avatar.${extension}`;
    const bucket = admin.storage().bucket(getStorageBucketName());
    const avatarFile = bucket.file(storagePath);

    await avatarFile.save(Buffer.from(await telegramFileResponse.arrayBuffer()), {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "public,max-age=86400",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken
        }
      }
    });

    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
  } catch (error) {
    console.error("Telegram avatar fetch failed:", error);
    return "";
  }
}

function verifyTelegramLoginPayload(payload = {}, token) {
  const { hash, ...data } = payload;

  if (!hash) return false;

  const authDate = Number(data.auth_date || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!authDate || Math.abs(now - authDate) > 24 * 60 * 60) {
    return false;
  }

  const dataCheckString = Object.keys(data)
    .filter((key) => data[key] !== undefined && data[key] !== null && data[key] !== "")
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(token).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash));
  } catch {
    return false;
  }
}



async function assertAdmin(request) {
  if (!request.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Only admin can perform this action.");
  }

  await assertActiveCallableMember(request);
}

export const setAdminClaim = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: APP_CHECK_ENFORCED
  },
  async (request) => {
    await assertAdmin(request);

    const uid = String(request.data?.uid || "").trim();
    const adminClaim = Boolean(request.data?.admin);

    if (!uid) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }

    const targetUser = await admin.auth().getUser(uid);
    await admin.auth().setCustomUserClaims(uid, {
      ...(targetUser.customClaims || {}),
      admin: adminClaim
    });

    await admin.firestore().collection("users").doc(uid).set({
      role: adminClaim ? "admin" : "client",
      adminClaimUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
      ok: true,
      uid,
      admin: adminClaim
    };
  }
);

export const bootstrapFirstAdmin = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [ADMIN_BOOTSTRAP_SECRET],
    enforceAppCheck: APP_CHECK_ENFORCED
  },
  async (request) => {
    const email = String(request.data?.email || "").trim().toLowerCase();
    const bootstrapSecret = String(request.data?.bootstrapSecret || "");

    const expectedSecret = ADMIN_BOOTSTRAP_SECRET.value();

    if (!expectedSecret || !hasMatchingSecret(bootstrapSecret, expectedSecret)) {
      throw new HttpsError("permission-denied", "Invalid bootstrap secret.");
    }

    if (!email) {
      throw new HttpsError("invalid-argument", "email is required.");
    }

    const db = admin.firestore();
    const bootstrapRef = db.collection("admin").doc("bootstrap");
    const existingAdminSnapshot = await db.collection("users")
      .where("role", "==", "admin")
      .limit(1)
      .get();

    if (!existingAdminSnapshot.empty) {
      throw new HttpsError("failed-precondition", "Bootstrap is disabled because an admin already exists.");
    }

    await db.runTransaction(async (transaction) => {
      const bootstrapSnapshot = await transaction.get(bootstrapRef);
      if (bootstrapSnapshot.exists) {
        throw new HttpsError("failed-precondition", "Bootstrap has already been used or disabled.");
      }

      transaction.create(bootstrapRef, {
        state: "reserved",
        requestedEmail: email,
        reservedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, {
        ...(user.customClaims || {}),
        admin: true
      });

      await db.collection("users").doc(user.uid).set({
        role: "admin",
        active: true,
        adminClaimUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await bootstrapRef.set({
        state: "completed",
        uid: user.uid,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        ok: true,
        uid: user.uid,
        email,
        admin: true
      };
    } catch (error) {
      await bootstrapRef.set({
        state: "failed",
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      throw error;
    }
  }
);

export const resolveLoginAlias = onRequest(
  {
    cors: true,
    memory: "256MiB",
    region: "europe-west1",
    timeoutSeconds: 15
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }

    try {
      await verifyAppCheckRequest(req);
      await enforceRateLimit(getPublicRequestIdentity(req), "resolve-login-alias", {
        limit: 30,
        windowMs: 10 * 60 * 1000
      });

      const login = normalizeLoginAlias(req.body?.login);
      if (!isValidLoginAlias(login)) {
        return json(res, 404, { ok: false, error: "auth/login-not-found" });
      }

      const snapshot = await admin.firestore().collection("loginAliases").doc(login).get();
      const email = normalizeAccountEmail(snapshot.data()?.email);
      if (!snapshot.exists || !email) {
        return json(res, 404, { ok: false, error: "auth/login-not-found" });
      }

      return json(res, 200, { ok: true, email });
    } catch (error) {
      console.error("resolveLoginAlias error:", error);
      const status = getHttpErrorStatus(error);
      return json(res, status, {
        ok: false,
        error: status === 429 ? "auth/too-many-requests" : "auth/network-request-failed"
      });
    }
  }
);

export const trainerCreateInvite = onRequest(
  { region: "europe-west1", memory: "256MiB", timeoutSeconds: 30 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

      const context = await requireActiveMember(req);
      if (context.role !== "trainer" && context.token?.admin !== true) {
        return json(res, 403, { error: "Trainer access required" });
      }
      await enforceRateLimit(context.uid, "trainer-create-invite", {
        limit: 20,
        windowMs: 10 * 60 * 1000
      });

      const login = normalizeLoginAlias(req.body?.login);
      if (!isValidLoginAlias(login)) return json(res, 400, { error: "Invalid login" });

      const email = getInternalInviteEmail(login);
      const name = String(req.body?.name || "").trim() || login || "Клиент";
      const db = admin.firestore();
      const existingLogin = await db.collection("loginAliases").doc(login).get();
      if (existingLogin.exists) return json(res, 409, { error: "auth/login-already-in-use" });

      try {
        await admin.auth().getUserByEmail(email);
        return json(res, 409, { error: "auth/email-already-in-use" });
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }

      const appUrl = getWorkoutAppUrl();
      const generatedPassword = `${crypto.randomBytes(24).toString("base64url")}!`;
      const createdUser = await admin.auth().createUser({ email, password: generatedPassword, displayName: name });
      const now = new Date().toISOString();
      const trainerEmail = normalizeAccountEmail(context.token?.email || context.userData?.email);
      // Cloud Run receives an internal Host header through Hosting rewrites.
      // Firebase only accepts an authorized public continue URL for password actions.
      const inviteUrl = `${appUrl}?invite=${encodeURIComponent(email)}`;
      const activationUrl = await admin.auth().generatePasswordResetLink(email, { url: inviteUrl });
      const activationToken = crypto.randomBytes(18).toString("base64url");
      const shareUrl = `${appUrl}invite/${activationToken}`;
      const clientPayload = {
        email, emailIsInternal: true, loginLower: login, accountProfile: { login },
        name, role: "client", active: true, createdAt: now, updatedAt: now,
        createdByUid: context.uid, createdByEmail: trainerEmail,
        trainerId: context.uid, assignedTrainerId: context.uid, coachId: context.uid,
        trainerEmail, assignedTrainerEmail: trainerEmail, coachEmail: trainerEmail,
        assignedProgramId: "", assignedProgramName: ""
      };
      const batch = db.batch();
      const clientRef = db.collection("users").doc(createdUser.uid);
      batch.set(clientRef, clientPayload);
      batch.set(db.collection("users").doc(context.uid).collection("trainerClients").doc(createdUser.uid), {
        clientId: createdUser.uid, uid: createdUser.uid, email, name, role: "client",
        loginLower: login,
        trainerId: context.uid, trainerEmail, assignedTrainerId: context.uid,
        assignedTrainerEmail: trainerEmail, createdAt: now, updatedAt: now
      });
      batch.set(db.collection("clientInvites").doc(email), {
        email, emailIsInternal: true, login, name, status: "active", authUid: createdUser.uid, trainerId: context.uid,
        trainerEmail, createdByUid: context.uid, createdByEmail: trainerEmail,
        createdAt: now, updatedAt: now, inviteUrl, activationToken
      });
      batch.set(db.collection("inviteLinks").doc(activationToken), {
        activationUrl, email, login, inviteId: email, createdAt: now, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
      batch.set(db.collection("loginAliases").doc(login), { email, uid: createdUser.uid, createdAt: now, updatedAt: now });
      await batch.commit();
      return json(res, 200, { client: { id: createdUser.uid, ...clientPayload }, login, inviteUrl, activationUrl, shareUrl });
    } catch (error) {
      console.error("trainerCreateInvite error:", error);
      return json(res, getHttpErrorStatus(error), { error: error?.code || error?.message || "Unable to create invite" });
    }
  }
);

// This is intentionally separate from trainerCreateInvite. A trainer may only
// create clients; creating a staff account is an administrator-only operation
// and must never create client-to-trainer bindings as a side effect.
export const adminCreateTrainerInvite = onRequest(
  { region: "europe-west1", memory: "256MiB", timeoutSeconds: 30 },
  async (req, res) => {
    let createdAuthUid = "";

    try {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

      const context = await requireActiveMember(req);
      assertAdminContext(context);
      await enforceRateLimit(context.uid, "admin-create-trainer-invite", {
        limit: 10,
        windowMs: 10 * 60 * 1000
      });

      const login = normalizeLoginAlias(req.body?.login);
      if (!isValidLoginAlias(login)) return json(res, 400, { error: "Invalid login" });

      const email = getInternalInviteEmail(login);
      const name = String(req.body?.name || "").trim() || login || "\u0422\u0440\u0435\u043d\u0435\u0440";
      const db = admin.firestore();
      const existingLogin = await db.collection("loginAliases").doc(login).get();
      if (existingLogin.exists) return json(res, 409, { error: "auth/login-already-in-use" });

      try {
        await admin.auth().getUserByEmail(email);
        return json(res, 409, { error: "auth/email-already-in-use" });
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }

      const appUrl = getWorkoutAppUrl();
      const generatedPassword = `${crypto.randomBytes(24).toString("base64url")}!`;
      const createdUser = await admin.auth().createUser({
        email,
        password: generatedPassword,
        displayName: name
      });
      createdAuthUid = createdUser.uid;

      const now = new Date().toISOString();
      const adminEmail = normalizeAccountEmail(context.token?.email || context.userData?.email);
      const inviteUrl = `${appUrl}?invite=${encodeURIComponent(email)}`;
      const activationUrl = await admin.auth().generatePasswordResetLink(email, { url: inviteUrl });
      const activationToken = crypto.randomBytes(18).toString("base64url");
      const shareUrl = `${appUrl}invite/${activationToken}`;
      const trainerPayload = {
        email,
        emailIsInternal: true,
        loginLower: login,
        accountProfile: { login },
        name,
        role: "trainer",
        active: true,
        accountStatus: "invited",
        createdAt: now,
        updatedAt: now,
        createdByUid: context.uid,
        createdByEmail: adminEmail,
        trainerInviteStatus: "active"
      };

      const batch = db.batch();
      batch.set(db.collection("users").doc(createdUser.uid), trainerPayload);
      batch.set(db.collection("inviteLinks").doc(activationToken), {
        uid: createdUser.uid,
        activationUrl,
        email,
        login,
        inviteId: email,
        inviteKind: "trainer",
        role: "trainer",
        createdByUid: context.uid,
        createdByEmail: adminEmail,
        createdAt: now,
        expiresAt: new Date(Date.now() + TRAINER_INVITE_TTL_MS).toISOString(),
        status: "active"
      });
      batch.set(db.collection("loginAliases").doc(login), {
        email,
        uid: createdUser.uid,
        createdAt: now,
        updatedAt: now
      });
      await batch.commit();
      createdAuthUid = "";

      return json(res, 200, {
        trainer: { id: createdUser.uid, ...trainerPayload },
        login,
        inviteUrl,
        activationUrl,
        shareUrl
      });
    } catch (error) {
      if (createdAuthUid) {
        try {
          await admin.auth().deleteUser(createdAuthUid);
        } catch (cleanupError) {
          console.error("adminCreateTrainerInvite auth cleanup error:", cleanupError);
        }
      }

      console.error("adminCreateTrainerInvite error:", error);
      return json(res, getHttpErrorStatus(error), {
        error: error?.code || error?.message || "Unable to create trainer invite"
      });
    }
  }
);

export const openClientInvite = onRequest(
  { region: "europe-west1", memory: "256MiB", timeoutSeconds: 15 },
  async (req, res) => {
    const requestPath = String(req.originalUrl || req.url || req.path || "").split("?")[0];
    const token = requestPath.split("/").filter(Boolean).at(-1) || "";
    if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) return res.status(404).send("Invitation not found");

    try {
      const snapshot = await admin.firestore().collection("inviteLinks").doc(token).get();
      const link = snapshot.exists ? snapshot.data() || {} : null;
      if (!link?.activationUrl) {
        return res.status(410).send("Invitation expired");
      }
      if (["revoked", "superseded"].includes(String(link.status || "").trim().toLowerCase())) {
        return res.status(410).send("Invitation expired");
      }
      if (link.status === "used") {
        return res.status(200).type("html").send(renderInviteLinkNoticePage({
          email: link.email,
          login: link.login,
          title: "Пароль уже создан",
          message: "Эта ссылка уже была использована для аккаунта",
          statusLabel: "Войди в Workout по логину и паролю."
        }));
      }
      if (link.expiresAt && Date.parse(link.expiresAt) < Date.now()) {
        return res.status(410).type("html").send(renderInviteLinkNoticePage({
          email: link.email,
          login: link.login,
          title: "Срок ссылки истёк",
          message: "Для аккаунта",
          statusLabel: "Попроси тренера создать новое приглашение."
        }));
      }
      const actionCode = new URL(link.activationUrl).searchParams.get("oobCode");
      if (!actionCode) return res.status(410).send("Invitation expired");
      const isActionActive = await isPasswordResetActionActive(actionCode);
      if (isActionActive === null) {
        return res.status(503).send("Invitation temporarily unavailable");
      }
      if (isActionActive === false) {
        await markTrainerInviteAcceptedForLink(snapshot, link);
        if (link.inviteKind !== "trainer" && link.role !== "trainer") {
          await snapshot.ref.set({ status: "used", usedAt: new Date().toISOString() }, { merge: true });
        }
        return res.status(200).type("html").send(renderInviteLinkNoticePage({
          email: link.email,
          login: link.login,
          title: "Пароль уже создан",
          message: "Эта ссылка уже была использована для аккаунта",
          statusLabel: "Войди в Workout по логину и паролю."
        }));
      }
      return res.status(200).type("html").send(renderInviteActivationPage({ actionCode, email: link.email, login: link.login }));
    } catch (error) {
      console.error("openClientInvite error:", error);
      return res.status(500).send("Invitation temporarily unavailable");
    }
  }
);


export const telegramLoginVerify = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const { telegramUser } = req.body || {};
      const uid = (await requireActiveMember(req)).uid;
      if (!telegramUser) return json(res, 400, { ok: false, error: "Missing telegramUser" });

      const token = TELEGRAM_BOT_TOKEN.value();
      if (!verifyTelegramLoginPayload(telegramUser, token)) {
        return json(res, 401, { ok: false, error: "Invalid Telegram signature" });
      }

      const avatarUrl = await saveTelegramAvatar(uid, telegramUser.id, token);

      const telegramProfile = {
        connected: true,
        chatId: "",
        telegramUserId: String(telegramUser.id || ""),
        username: telegramUser.username || "",
        displayName: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || telegramUser.username || "",
        firstName: telegramUser.first_name || "",
        lastName: telegramUser.last_name || "",
        photoUrl: telegramUser.photo_url || "",
        avatarUrl: avatarUrl || telegramUser.photo_url || "",
        notificationsEnabled: true,
        loginAuthDate: telegramUser.auth_date || "",
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        loginProvider: "telegram_login_widget"
      };

      await admin.firestore().collection("users").doc(uid).set({
        telegram: telegramProfile,
        telegramConnected: true,
        telegramUsername: telegramProfile.username,
        telegramDisplayName: telegramProfile.displayName,
        telegramAvatarUrl: telegramProfile.avatarUrl,
        telegramUserId: telegramProfile.telegramUserId,
        telegramNotificationsEnabled: true,
        telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return json(res, 200, { ok: true, telegram: telegramProfile });
    } catch (error) {
      console.error("telegramLoginVerify error:", error);
      const status = getHttpErrorStatus(error);
      return json(res, status, { ok: false, error: error.message });
    }
  }
);

export const telegramRefreshAvatar = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const uid = (await requireActiveMember(req)).uid;
      const userRef = admin.firestore().collection("users").doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) return json(res, 404, { ok: false, error: "User not found" });

      const userData = userSnap.data() || {};
      const savedTelegram = userData.telegram || {};
      const telegramUserId = savedTelegram.telegramUserId || userData.telegramUserId || "";

      if (!telegramUserId) {
        return json(res, 400, { ok: false, error: "Telegram user is not connected" });
      }

      const avatarUrl = await saveTelegramAvatar(uid, telegramUserId, TELEGRAM_BOT_TOKEN.value());

      if (!avatarUrl) {
        return json(res, 404, { ok: false, error: "Telegram avatar is unavailable" });
      }

      const nextTelegram = {
        ...savedTelegram,
        connected: savedTelegram.connected !== false,
        avatarUrl,
        avatarUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await userRef.set({
        telegram: nextTelegram,
        telegramAvatarUrl: avatarUrl
      }, { merge: true });

      return json(res, 200, {
        ok: true,
        telegram: {
          ...nextTelegram,
          avatarUpdatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("telegramRefreshAvatar error:", error);
      const status = getHttpErrorStatus(error);
      return json(res, status, { ok: false, error: error.message });
    }
  }
);

function buildTelegramResponseProfile(telegram = {}) {
  return {
    connected: telegram.connected === true,
    chatId: String(telegram.chatId || ""),
    telegramUserId: String(telegram.telegramUserId || ""),
    username: String(telegram.username || ""),
    displayName: String(telegram.displayName || ""),
    firstName: String(telegram.firstName || ""),
    lastName: String(telegram.lastName || ""),
    avatarUrl: String(telegram.avatarUrl || ""),
    notificationsEnabled: telegram.notificationsEnabled !== false
  };
}

export const telegramCreateLinkCode = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      await enforceRateLimit(context.uid, "telegram-create-link-code", {
        limit: 5,
        windowMs: 10 * 60 * 1000
      });

      const code = crypto.randomBytes(18).toString("base64url");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await admin.firestore().collection("users").doc(context.uid).set({
        telegramLinkCode: code,
        telegramLinkCodeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        telegramLinkCodeExpiresAt: expiresAt
      }, { merge: true });

      return json(res, 200, { ok: true, code, expiresAt });
    } catch (error) {
      console.error("telegramCreateLinkCode error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const telegramUpdateNotifications = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      const enabled = req.body?.enabled;
      if (typeof enabled !== "boolean") {
        return json(res, 400, { ok: false, error: "enabled must be a boolean" });
      }

      const requestedClientId = String(req.body?.clientId || "").trim();
      const target = requestedClientId && requestedClientId !== context.uid
        ? await getManagedClient(context, requestedClientId)
        : {
            id: context.uid,
            data: context.userData,
            ref: admin.firestore().collection("users").doc(context.uid)
          };
      const currentTelegram = target.data.telegram && typeof target.data.telegram === "object"
        ? target.data.telegram
        : {};
      const nextTelegram = {
        ...currentTelegram,
        notificationsEnabled: enabled
      };

      await target.ref.set({
        telegram: nextTelegram,
        telegramNotificationsEnabled: enabled,
        telegramNotificationsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return json(res, 200, {
        ok: true,
        clientId: target.id,
        telegram: buildTelegramResponseProfile(nextTelegram)
      });
    } catch (error) {
      console.error("telegramUpdateNotifications error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const telegramDisconnect = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      const userRef = admin.firestore().collection("users").doc(context.uid);
      const disconnectedTelegram = {
        connected: false,
        notificationsEnabled: false,
        disconnectedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await userRef.update({
        telegram: disconnectedTelegram,
        telegramConnected: false,
        telegramUsername: "",
        telegramDisplayName: "",
        telegramAvatarUrl: "",
        telegramUserId: admin.firestore.FieldValue.delete(),
        telegramChatId: admin.firestore.FieldValue.delete(),
        telegramLinkedAt: admin.firestore.FieldValue.delete(),
        telegramLinkCode: admin.firestore.FieldValue.delete(),
        telegramLinkCodeCreatedAt: admin.firestore.FieldValue.delete(),
        telegramLinkCodeExpiresAt: admin.firestore.FieldValue.delete(),
        telegramNotificationsEnabled: false,
        telegramDisconnectedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return json(res, 200, {
        ok: true,
        telegram: {
          connected: false,
          notificationsEnabled: false
        }
      });
    } catch (error) {
      console.error("telegramDisconnect error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const telegramSendMessage = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      await enforceRateLimit(context.uid, "telegram-send-message", {
        limit: 20,
        windowMs: 60 * 1000
      });

      const { clientId } = req.body || {};
      const text = String(req.body?.text || "").trim();
      if (!text) return json(res, 400, { ok: false, error: "Message text is required" });
      if (text.length > 3500) return json(res, 400, { ok: false, error: "Message is too long" });

      const client = await getManagedClient(context, clientId);
      const telegram = client.data.telegram || {};
      const token = TELEGRAM_BOT_TOKEN.value();

      const result = await sendTelegramMessage({
        chatId: telegram.chatId || client.data.telegramChatId || "",
        telegramUserId: telegram.telegramUserId || client.data.telegramUserId || "",
        username: telegram.username || client.data.telegramUsername || "",
        text,
        token
      });

      await client.ref.collection("telegramMessages").add({
        type: "manual",
        direction: "out",
        text,
        sentByUid: context.uid,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "sent"
      });

      return json(res, 200, { ok: true, result });
    } catch (error) {
      console.error("telegramSendMessage error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

function getWorkoutOrderIndex(workout = {}, fallbackIndex = 0) {
  const nameMatch = String(workout.name || "").match(/день\s*(\d+)|day\s*(\d+)/i);
  if (nameMatch?.[1] || nameMatch?.[2]) {
    const value = Number(nameMatch?.[1] || nameMatch?.[2]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  if (Number.isFinite(Number(workout.order))) return Number(workout.order);
  if (Number.isFinite(Number(workout.sortOrder))) return Number(workout.sortOrder);

  const idMatch = String(workout.id || "").match(/day[_-]?(\d+)|w[_-]?(\d+)|(\d+)/i);
  const idValue = Number(idMatch?.[1] || idMatch?.[2] || idMatch?.[3]);

  return Number.isFinite(idValue) && idValue > 0 ? idValue : fallbackIndex + 1;
}

async function getNextWorkoutForUser(userId) {
  const workoutsSnapshot = await admin.firestore().collection("users").doc(userId).collection("workouts").get();

  const workouts = workoutsSnapshot.docs
    .map((workoutDoc, index) => ({ id: workoutDoc.id, ...workoutDoc.data(), fallbackIndex: index }))
    .sort((a, b) => getWorkoutOrderIndex(a, a.fallbackIndex) - getWorkoutOrderIndex(b, b.fallbackIndex));

  if (!workouts.length) return null;

  const historySnapshot = await admin.firestore()
    .collection("users")
    .doc(userId)
    .collection("history")
    .orderBy("date", "desc")
    .limit(1)
    .get()
    .catch(() => null);

  if (!historySnapshot || historySnapshot.empty) return workouts[0];

  const lastHistory = historySnapshot.docs[0].data();
  const lastWorkoutName = String(lastHistory.workout || lastHistory.name || "");
  const lastIndex = workouts.findIndex((workout) => String(workout.name || "").trim() === lastWorkoutName.trim());

  return lastIndex === -1 ? workouts[0] : workouts[(lastIndex + 1) % workouts.length];
}

function buildWorkoutReminderMessage({ workout, workoutTime, eventText, offsetHours = 24, test = false }) {
  const workoutName = workout?.name || "тренировка";
  const exerciseCount = Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
  const exercisesLine = exerciseCount ? `В плане: ${exerciseCount} упражнений.` : "План тренировки уже в приложении.";
  const timingLine = offsetHours === 24
    ? `Завтра (${eventText}) у тебя тренировка в ${workoutTime}.`
    : offsetHours === 1
      ? `Через час начинается тренировка «${workoutName}».`
      : `Через ${offsetHours} ${offsetHours === 3 ? "часа" : "часов"} начнётся тренировка «${workoutName}».`;

  return [
    test ? "🧪 Тестовое напоминание о тренировке" : "🏋️‍♂️ Напоминание о тренировке",
    "",
    timingLine,
    `Тренировка: ${workoutName}`,
    exercisesLine,
    "",
    "Подготовь форму, воду, сон и нормальный приём еды заранее 💪"
  ].join("\n");
}

function getResourceDateKey(value) {
  if (!value) return "";
  if (typeof value?.toDate === "function") return getMinskDateKey(value.toDate());
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? getMinskDateKey(new Date(timestamp)) : "";
}

function getProgressReminderMessage(reminder = {}) {
  const isPhoto = reminder.type === "photo";
  return [
    isPhoto ? "📸 Пора обновить фото прогресса" : "📏 Пора сделать замеры",
    "",
    "Прошло примерно две недели с прошлого контроля.",
    isPhoto
      ? "Сделай фото в тех же ракурсах и при похожем освещении."
      : "Обнови вес и основные замеры тела.",
    "",
    "Так тренер точнее увидит динамику и сможет скорректировать план."
  ].join("\n");
}

async function getLatestClientResourceDateKey(userRef, collectionName) {
  try {
    const snapshot = await userRef
      .collection(collectionName)
      .orderBy("date", "desc")
      .limit(1)
      .get();
    const resourceDoc = snapshot.docs[0];
    if (!resourceDoc) return "";
    const data = resourceDoc.data() || {};
    return getResourceDateKey(data.date || data.createdAt || data.savedAt);
  } catch (error) {
    console.warn(`Failed to read latest ${collectionName} date`, error);
    return "";
  }
}

async function sendProgressReminderForUser(userDoc, user, reminder) {
  const telegram = user.telegram || {};
  const chatId = telegram.chatId || user.telegramChatId || "";
  const telegramUserId = telegram.telegramUserId || user.telegramUserId || "";
  const username = telegram.username || user.telegramUsername || "";

  if (!normalizeTelegramTarget({ chatId, telegramUserId, username })) {
    throw new Error("Telegram is not connected");
  }

  const text = getProgressReminderMessage(reminder);
  const token = TELEGRAM_BOT_TOKEN.value();

  const result = await sendTelegramMessage({
    chatId,
    telegramUserId,
    username,
    text,
    token
  });

  await userDoc.ref.collection("telegramMessages").doc(`progress_${reminder.type}_reminder_${reminder.dueDateKey}`).set({
    type: reminder.type === "photo" ? "progress_photo_reminder" : "measurement_reminder",
    text,
    progressReminderType: reminder.type,
    reminderDateKey: reminder.dueDateKey,
    intervalDays: reminder.intervalDays,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "sent"
  }, { merge: true });

  return result;
}

async function sendWorkoutReminderForClient(clientId, { test = false, event = null, offsetHours = 24 } = {}) {
  const userRef = admin.firestore().collection("users").doc(clientId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) throw new Error("User not found");

  const user = userSnap.data() || {};
  const telegram = user.telegram || {};
  const calendar = user.workoutCalendar || {};
  const nextEvent = event || getNextScheduledWorkout(calendar) || {
    dayId: "",
    key: getMinskDateKey(),
    text: "ближайшая дата",
    workoutTime: calendar.workoutTime || user.workoutTime || "13:00"
  };

  const chatId = telegram.chatId || user.telegramChatId || "";
  const telegramUserId = telegram.telegramUserId || user.telegramUserId || "";
  const username = telegram.username || user.telegramUsername || "";

  if (!normalizeTelegramTarget({ chatId, telegramUserId, username })) {
    throw new Error("Telegram is not connected");
  }

  const workout = await getNextWorkoutForUser(clientId);
  const workoutTime = nextEvent.workoutTime || calendar.workoutTime || user.workoutTime || "13:00";

  const text = buildWorkoutReminderMessage({
    workout,
    workoutTime,
    eventText: nextEvent.text,
    offsetHours,
    test
  });

  const token = TELEGRAM_BOT_TOKEN.value();

  const result = await sendTelegramMessage({
    chatId,
    telegramUserId,
    username,
    text,
    token
  });

  const docId = test ? `test_reminder_${Date.now()}` : `workout_reminder_${nextEvent.key}_${offsetHours}h`;

  await userRef.collection("telegramMessages").doc(docId).set({
    type: test ? "test_reminder" : "workout_reminder",
    text,
    workoutId: workout?.id || "",
    workoutName: workout?.name || "",
    workoutTime,
    reminderOffsetHours: offsetHours,
    reminderDateKey: nextEvent.key,
    reminderDateText: nextEvent.text,
    scheduledForDay: nextEvent.dayId,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "sent"
  }, { merge: true });

  return result;
}

export const telegramTestWorkoutReminder = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      const { clientId } = req.body || {};
      await getManagedClient(context, clientId);
      await enforceRateLimit(context.uid, "telegram-test-reminder", {
        limit: 5,
        windowMs: 60 * 1000
      });

      const result = await sendWorkoutReminderForClient(clientId, { test: true });
      return json(res, 200, { ok: true, result });
    } catch (error) {
      console.error("telegramTestWorkoutReminder error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const telegramDailyWorkoutReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Europe/Minsk",
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const usersSnapshot = await admin.firestore().collection("users").where("telegramConnected", "==", true).get();

    const jobs = usersSnapshot.docs.map(async (userDoc) => {
      const user = userDoc.data();
      const calendar = user.workoutCalendar || {};
      const now = new Date();

      if (calendar.enabled === false || calendar.reminderEnabled === false) return;
      const event = getNextScheduledWorkout(calendar, now);
      const dueOffsets = getDueReminderOffsets(calendar, event, now);

      await Promise.all(dueOffsets.map(async (offsetHours) => {
        const reminderDocId = `workout_reminder_${event.key}_${offsetHours}h`;
        const reminderRef = userDoc.ref.collection("telegramMessages").doc(reminderDocId);
        const existingReminder = await reminderRef.get();
        if (existingReminder.exists) return;
        await sendWorkoutReminderForClient(userDoc.id, { event, offsetHours });
      }));

      const progressSettings = calendar.progressReminderSettings || {};
      const hasProgressReminders =
        progressSettings.photoEnabled === true ||
        progressSettings.measurementsEnabled === true ||
        calendar.progressPhotoReminderEnabled === true ||
        calendar.measurementsReminderEnabled === true;

      if (!hasProgressReminders) return;

      const [photoDateKey, measurementDateKey] = await Promise.all([
        getLatestClientResourceDateKey(userDoc.ref, "progressPhotos"),
        getLatestClientResourceDateKey(userDoc.ref, "measurements")
      ]);
      const dueProgressReminders = getDueProgressReminderTypes(calendar, {
        photoDateKey,
        measurementDateKey
      }, now);

      await Promise.all(dueProgressReminders.map(async (reminder) => {
        const reminderDocId = `progress_${reminder.type}_reminder_${reminder.dueDateKey}`;
        const reminderRef = userDoc.ref.collection("telegramMessages").doc(reminderDocId);
        const existingReminder = await reminderRef.get();
        if (existingReminder.exists) return;
        await sendProgressReminderForUser(userDoc, user, reminder);
      }));
    });

    await Promise.allSettled(jobs);
  }
);

function getTrainerLocalTime(now, timeZone = "Europe/Minsk") {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(now);
    return `${parts.find((part) => part.type === "hour")?.value || "00"}:${parts.find((part) => part.type === "minute")?.value || "00"}`;
  } catch {
    return "10:00";
  }
}

function isSubscriptionNotificationTime(settings = {}, trainer = {}, now = new Date()) {
  const target = String(settings.sendTime || "10:00");
  const [targetHour, targetMinute] = target.split(":").map(Number);
  const [hour, minute] = getTrainerLocalTime(now, settings.timeZone || trainer.timeZone || "Europe/Minsk").split(":").map(Number);
  return hour === targetHour && Math.floor(minute / 15) === Math.floor((targetMinute || 0) / 15);
}

function buildSubscriptionTelegramMessage(client, reminder) {
  const subscription = client.subscription || {};
  const title = reminder.kind === "expired" ? "⛔ Абонемент клиента закончился" : "⚠️ У клиента заканчивается абонемент";
  const lastWorkout = client.lastWorkoutAt || client.lastWorkoutDate || "не указана";
  return [
    title,
    "",
    `Клиент: ${client.name || client.displayName || client.email || "Клиент"}`,
    `Абонемент: ${subscription.purchasedSessions || subscription.totalSessions || 0} тренировок`,
    `Осталось: ${reminder.remainingSessions || 0} тренировок`,
    `Действует до: ${subscription.endDate || "не указано"}`,
    `Последняя тренировка: ${getResourceDateKey(lastWorkout) || "не указана"}`
  ].join("\n");
}

export const telegramDailySubscriptionReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Europe/Minsk",
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const now = new Date();
    const usersSnapshot = await admin.firestore().collection("users").get();
    const groupedByTrainer = new Map();

    usersSnapshot.docs.forEach((clientDoc) => {
      const client = { id: clientDoc.id, ...(clientDoc.data() || {}) };
      const trainerId = client.assignedTrainerId || client.trainerId || client.coachId || "";
      if (!trainerId || !client.subscription) return;
      const group = groupedByTrainer.get(trainerId) || [];
      group.push(client);
      groupedByTrainer.set(trainerId, group);
    });

    await Promise.allSettled([...groupedByTrainer.entries()].map(async ([trainerId, clients]) => {
      const trainerRef = admin.firestore().collection("users").doc(trainerId);
      const trainerSnap = await trainerRef.get();
      if (!trainerSnap.exists) return;
      const trainer = trainerSnap.data() || {};
      const telegram = trainer.telegram || {};
      const chatId = telegram.chatId || trainer.telegramChatId || "";
      const telegramUserId = telegram.telegramUserId || trainer.telegramUserId || "";
      const username = telegram.username || trainer.telegramUsername || "";
      if (!normalizeTelegramTarget({ chatId, telegramUserId, username })) return;

      const entries = clients.flatMap((client) => {
        const settings = resolveSubscriptionNotificationSettings(trainer, client);
        return getDueSubscriptionNotifications(client.subscription, settings, now)
          .map((reminder) => ({ client, reminder, settings }));
      });
      if (!entries.length) return;

      const dueEntries = [];
      for (const entry of entries) {
        if (!isSubscriptionNotificationTime(entry.settings, trainer, now)) continue;
        const logId = `${entry.client.id}_${entry.reminder.key}`;
        const logRef = trainerRef.collection("subscriptionReminderLog").doc(logId);
        if (!(await logRef.get()).exists) dueEntries.push({ ...entry, logId, logRef });
      }
      if (!dueEntries.length) return;

      const digestEntries = dueEntries.filter((entry) => entry.settings.digestMode !== "separate");
      const separateEntries = dueEntries.filter((entry) => entry.settings.digestMode === "separate");
      const token = TELEGRAM_BOT_TOKEN.value();

      if (digestEntries.length) {
        const digestByClient = new Map();
        const reminderPriority = { expired: 3, sessions: 2, date: 1 };
        digestEntries.forEach((entry) => {
          const current = digestByClient.get(entry.client.id);
          if (!current || reminderPriority[entry.reminder.kind] > reminderPriority[current.reminder.kind]) {
            digestByClient.set(entry.client.id, entry);
          }
        });
        const text = ["📋 Абонементы, требующие внимания", "", ...[...digestByClient.values()].map(({ client, reminder }) => buildSubscriptionReminderLine(client, reminder))].join("\n");
        await sendTelegramMessage({ chatId, telegramUserId, username, text, token });
        await Promise.all(digestEntries.map(({ logRef, client, reminder }) => logRef.set({
          clientId: client.id,
          subscriptionCycleId: client.subscription?.cycleId || "legacy",
          reminderKey: reminder.key,
          kind: reminder.kind,
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        })));
      }

      for (const { client, reminder, logRef } of separateEntries) {
        const clientUrl = getWorkoutAppUrl() + "?trainerClient=" + encodeURIComponent(client.id);
        await sendTelegramMessage({
          chatId,
          telegramUserId,
          username,
          text: buildSubscriptionTelegramMessage(client, reminder),
          token,
          replyMarkup: {
            inline_keyboard: [
              [{ text: "Открыть клиента", url: clientUrl }],
              [{ text: "Продлить абонемент", url: `${clientUrl}&subscription=renew` }],
              [{ text: "Написать клиенту", url: `${clientUrl}&compose=1` }]
            ]
          }
        });
        await logRef.set({
          clientId: client.id,
          subscriptionCycleId: client.subscription?.cycleId || "legacy",
          reminderKey: reminder.key,
          kind: reminder.kind,
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }));
  }
);

async function adjustSubscriptionUsageForHistoryEvent(event, delta) {
  const uid = event.params.uid;
  const historyRef = event.data?.ref;
  const history = event.data?.data() || {};
  const userRef = admin.firestore().collection("users").doc(uid);

  await admin.firestore().runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) return;
    const user = userSnap.data() || {};
    const subscription = user.subscription || null;
    if (!subscription) return;
    const cycleId = String(subscription.cycleId || subscription.lastRenewedAt || subscription.startDate || "legacy");

    if (delta > 0) {
      const workoutDate = getResourceDateKey(history.date || history.finishedAt || history.createdAt);
      const startDate = getResourceDateKey(subscription.startDate);
      if (startDate && workoutDate && workoutDate < startDate) return;
      if (history.subscriptionCycleId === cycleId) return;
    } else if (history.subscriptionCycleId !== cycleId) {
      return;
    }

    const purchasedSessions = Math.max(0, Number(subscription.purchasedSessions || subscription.totalSessions) || 0);
    const currentUsed = Math.max(0, Number(subscription.usedSessions) || 0);
    const usedSessions = Math.max(0, currentUsed + delta);
    transaction.set(userRef, {
      subscription: {
        ...subscription,
        cycleId,
        purchasedSessions,
        usedSessions,
        remainingSessions: Math.max(0, purchasedSessions - usedSessions),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
    if (delta > 0 && historyRef) {
      transaction.set(historyRef, { subscriptionCycleId: cycleId }, { merge: true });
    }
  });
}

export const subscriptionUsageOnWorkoutCreated = onDocumentCreated(
  { document: "users/{uid}/history/{historyId}", region: "europe-west1" },
  async (event) => adjustSubscriptionUsageForHistoryEvent(event, 1)
);

export const subscriptionUsageOnWorkoutDeleted = onDocumentDeleted(
  { document: "users/{uid}/history/{historyId}", region: "europe-west1" },
  async (event) => adjustSubscriptionUsageForHistoryEvent(event, -1)
);

export const telegramSetWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      assertAdminContext(context);
      await enforceRateLimit(context.uid, "telegram-set-webhook", {
        limit: 3,
        windowMs: 10 * 60 * 1000
      });
      const token = TELEGRAM_BOT_TOKEN.value();
      const webhookSecret = crypto.createHash("sha256").update(token).digest("hex");

      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: getTelegramWebhookUrl(),
          secret_token: webhookSecret
        })
      });

      const data = await response.json();
      return json(res, response.ok ? 200 : 500, data);
    } catch (error) {
      console.error("telegramSetWebhook error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const telegramWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    const token = TELEGRAM_BOT_TOKEN.value();
    const expectedSecret = crypto.createHash("sha256").update(token).digest("hex");
    const receivedSecret = String(req.headers["x-telegram-bot-api-secret-token"] || "");
    const validSecret = receivedSecret.length === expectedSecret.length &&
      crypto.timingSafeEqual(Buffer.from(receivedSecret), Buffer.from(expectedSecret));

    if (!validSecret) return json(res, 401, { ok: false, error: "Invalid webhook secret" });

    try {
      const message = req.body?.message;
      const fromId = String(message?.from?.id || "").trim();
      const text = String(message?.text || "").trim();
      const chatId = String(message?.chat?.id || "").trim();
      const startMatch = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,})$/i);

      if (fromId && chatId && startMatch && message?.chat?.type === "private" && chatId === fromId) {
        const code = startMatch[1];
        const pendingLinks = await admin.firestore()
          .collection("users")
          .where("telegramLinkCode", "==", code)
          .limit(2)
          .get();
        const linkedUser = pendingLinks.size === 1 ? pendingLinks.docs[0] : null;
        const linkedUserData = linkedUser?.data() || {};
        const expiresAt = Date.parse(String(linkedUserData.telegramLinkCodeExpiresAt || ""));

        if (
          linkedUser &&
          isActiveMemberData(linkedUserData) &&
          Number.isFinite(expiresAt) &&
          expiresAt > Date.now()
        ) {
          const previousTelegram = linkedUserData.telegram && typeof linkedUserData.telegram === "object"
            ? linkedUserData.telegram
            : {};
          const telegramProfile = {
            ...previousTelegram,
            connected: true,
            chatId,
            telegramUserId: fromId,
            username: String(message?.from?.username || ""),
            displayName: [message?.from?.first_name, message?.from?.last_name]
              .filter(Boolean)
              .join(" ") || String(message?.from?.username || ""),
            firstName: String(message?.from?.first_name || ""),
            lastName: String(message?.from?.last_name || ""),
            notificationsEnabled: previousTelegram.notificationsEnabled !== false,
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            loginProvider: "telegram_bot_link"
          };

          await linkedUser.ref.set({
            telegram: telegramProfile,
            telegramConnected: true,
            telegramChatId: chatId,
            telegramUserId: fromId,
            telegramUsername: telegramProfile.username,
            telegramDisplayName: telegramProfile.displayName,
            telegramNotificationsEnabled: telegramProfile.notificationsEnabled,
            telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
            telegramLinkCode: admin.firestore.FieldValue.delete(),
            telegramLinkCodeCreatedAt: admin.firestore.FieldValue.delete(),
            telegramLinkCodeExpiresAt: admin.firestore.FieldValue.delete()
          }, { merge: true });

          await sendTelegramMessage({
            chatId,
            text: "Telegram успешно привязан к вашему аккаунту Workout.",
            token
          }).catch((error) => console.warn("Telegram link confirmation failed:", error));
        }

        return json(res, 200, { ok: true });
      }

      if (startMatch) return json(res, 200, { ok: true });

      if (fromId && text) {
        const matches = await admin.firestore()
          .collection("users")
          .where("telegram.telegramUserId", "==", fromId)
          .limit(1)
          .get();

        if (!matches.empty && isActiveMemberData(matches.docs[0].data() || {})) {
          await matches.docs[0].ref.collection("telegramMessages").add({
            type: "incoming",
            direction: "in",
            text: text.slice(0, 3500),
            telegramMessageId: message.message_id || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "received"
          });
        }
      }
    } catch (error) {
      console.error("telegramWebhook processing error:", error);
    }

    return json(res, 200, { ok: true });
  }
);

function normalizeSearchString(value) {
  return String(value || "").trim();
}

function parseSearchNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function roundSearchMacro(value) {
  return Math.round(parseSearchNumber(value) * 10) / 10;
}

function extractJsonObject(text = "") {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function cleanProgramText(value = "", maxLength = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeAiWorkoutSet(set = {}) {
  const reps = Number.parseInt(String(set.reps ?? set.repetitions ?? 10).replace(",", "."), 10);
  const weightValue = set.weight ?? set.weightKg ?? set.load ?? "";
  const weight = String(weightValue ?? "").replace(",", ".").trim();

  return {
    reps: Number.isFinite(reps) && reps > 0 ? reps : 10,
    weight: weight && weight !== "0" ? weight : ""
  };
}

function normalizeAiTimedWorkoutSet(set = {}) {
  const sourceDuration = set.durationSeconds ?? set.seconds ?? set.reps ?? 30;
  const durationSeconds = Number.parseInt(String(sourceDuration).replace(",", "."), 10);

  return {
    reps: "",
    weight: "",
    durationSeconds: Math.min(180, Math.max(10, Number.isFinite(durationSeconds) ? durationSeconds : 30))
  };
}

function isTimedBasicExercise(name = "") {
  return String(name).trim().toLocaleLowerCase("ru").includes("планка");
}

function normalizeAiWorkoutExercise(exercise = {}, index = 0) {
  const sourceSets = Array.isArray(exercise.sets) && exercise.sets.length
    ? exercise.sets
    : Array.from({ length: Math.max(1, Number.parseInt(exercise.setsCount || exercise.approaches || 3, 10) || 3) }, () => ({
        reps: exercise.reps || exercise.repetitions || 10,
        weight: exercise.weight || exercise.weightKg || ""
      }));

  return {
    name: cleanProgramText(exercise.name || exercise.exercise || `Упражнение ${index + 1}`, 90) || `Упражнение ${index + 1}`,
    notes: cleanProgramText(exercise.notes || exercise.comment || "", 240),
    sets: sourceSets.slice(0, 8).map(normalizeAiWorkoutSet)
  };
}

function normalizeAiWorkout(workout = {}, index = 0) {
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];

  return {
    name: cleanProgramText(workout.name || workout.title || `Тренировка ${index + 1}`, 90) || `Тренировка ${index + 1}`,
    focus: cleanProgramText(workout.focus || workout.goal || "", 120),
    exercises: exercises.slice(0, 14).map(normalizeAiWorkoutExercise).filter((exercise) => exercise.name)
  };
}

function normalizeAiWorkoutImportProgram(rawProgram = {}) {
  const rawWeeks = Array.isArray(rawProgram.weeks) ? rawProgram.weeks : [];
  const fallbackWorkouts = Array.isArray(rawProgram.workouts) ? rawProgram.workouts : [];
  let weeks = rawWeeks.map((week, weekIndex) => ({
    name: cleanProgramText(week.name || `Неделя ${weekIndex + 1}`, 60),
    workouts: (Array.isArray(week.workouts) ? week.workouts : []).map(normalizeAiWorkout)
  }));

  if (!weeks.some((week) => week.workouts.length) && fallbackWorkouts.length) {
    const weekCount = Math.max(1, Math.ceil(fallbackWorkouts.length / 2));
    weeks = Array.from({ length: weekCount }, (_, weekIndex) => ({
      name: `Неделя ${weekIndex + 1}`,
      workouts: fallbackWorkouts
        .slice(weekIndex * 2, weekIndex * 2 + 2)
        .map((workout, workoutIndex) => normalizeAiWorkout(workout, weekIndex * 2 + workoutIndex))
    }));
  }

  weeks = weeks
    .map((week, weekIndex) => ({
      name: week.name || `Неделя ${weekIndex + 1}`,
      workouts: week.workouts.filter((workout) => workout.exercises.length)
    }))
    .filter((week) => week.workouts.length)
    .slice(0, 12);

  if (!weeks.length) {
    throw createHttpError(422, "AI did not find workouts and exercises");
  }

  const blocks = Array.from({ length: Math.ceil(weeks.length / 2) }, (_, blockIndex) => {
    const blockWeeks = weeks.slice(blockIndex * 2, blockIndex * 2 + 2);

    return {
      name: `Микроцикл ${blockIndex + 1}`,
      monthId: `month_${Math.floor(blockIndex / 2) + 1}`,
      weeks: blockWeeks.map((week, weekIndex) => ({
        name: week.name || `Неделя ${blockIndex * 2 + weekIndex + 1}`,
        workouts: week.workouts.map((workout, workoutIndex) => ({
          name: workout.name || `Тренировка ${workoutIndex + 1}`,
          focus: workout.focus || "",
          exercises: workout.exercises
        }))
      }))
    };
  });
  const monthIds = blocks
    .map((block) => block.monthId)
    .filter((monthId, index, list) => list.indexOf(monthId) === index);

  return {
    schema: "tren-monthly-program-v2",
    name: cleanProgramText(rawProgram.name || rawProgram.title || "Программа из ИИ", 80) || "Программа из ИИ",
    description: cleanProgramText(rawProgram.description || "Создано из материала тренера через ИИ", 240),
    months: monthIds.map((monthId, index) => ({
      id: monthId,
      name: `Месяц ${index + 1}`,
      microcycles: blocks.filter((block) => block.monthId === monthId)
    })),
    blocks
  };
}

export const aiWorkoutProgramImport = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 90,
    secrets: [OPENAI_API_KEY],
    cors: true
  },
  async (req, res) => {
    const apiVersion = "aiWorkoutProgramImport-v1";
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed", apiVersion });

    try {
      const context = await requireActiveMember(req);
      if (context.token?.admin !== true && context.role !== "trainer") {
        throw createHttpError(403, "Trainer access required");
      }
      await enforceRateLimit(context.uid, "ai-workout-program-import", {
        limit: 8,
        windowMs: 10 * 60 * 1000
      });
      await enforceRateLimit(context.uid, "ai-workout-program-import-daily", {
        limit: 40,
        windowMs: 24 * 60 * 60 * 1000
      });

      const {
        text = "",
        imageData = "",
        fileData = "",
        mimeType = "",
        fileName = "program"
      } = req.body || {};
      const cleanText = String(text || "").trim().slice(0, MAX_AI_PROGRAM_TEXT_LENGTH);
      const cleanImageData = String(imageData || "");
      const cleanFileData = String(fileData || "");

      if (!cleanText && !cleanImageData && !cleanFileData) {
        return json(res, 400, { ok: false, error: "Missing program material", apiVersion });
      }
      if (cleanImageData && cleanImageData.length > MAX_AI_IMAGE_DATA_LENGTH) {
        return json(res, 413, { ok: false, error: "Image payload is too large", apiVersion });
      }
      if (cleanFileData && cleanFileData.length > MAX_AI_PROGRAM_FILE_DATA_LENGTH) {
        return json(res, 413, { ok: false, error: "File payload is too large", apiVersion });
      }

      const apiKey = OPENAI_API_KEY.value();
      if (!apiKey) {
        return json(res, 500, { ok: false, error: "OPENAI_API_KEY is not configured", apiVersion });
      }

      const systemPrompt = [
        "You convert trainer-provided workout programs into structured JSON for a fitness coaching app.",
        "Read Russian or English program text, screenshots, tables, PDF or document-like files.",
        "Preserve workout order, exercise order, sets, reps, working weight if present, and short notes.",
        "Do not invent client results. If weight is absent, use an empty string.",
        "Return only realistic training structure. Ignore decorative text, prices, nutrition and unrelated content.",
        "Use Russian names for generated workout titles when source is Russian."
      ].join("\n");
      const userPrompt = [
        "Analyze the trainer material and create an editable workout program.",
        "Return 1-12 weeks. Put workouts into the correct week when possible.",
        "For each workout include exercises in source order.",
        "For sets, expand shorthand like 3x10 into three set objects.",
        "If one line says 4 sets of 8-10 reps, create 4 sets with reps \"8-10\" or 8 if a number is required.",
        "Required JSON shape:",
        '{"name":"program name","description":"short source summary","confidence":"high|medium|low","weeks":[{"name":"Неделя 1","workouts":[{"name":"День 1 — Спина","focus":"Спина","exercises":[{"name":"Тяга верхнего блока","notes":"","sets":[{"reps":10,"weight":"40"}]}]}]}]}',
        `File name: ${fileName}`,
        cleanText ? `Trainer text:\n${cleanText}` : "No pasted text."
      ].join("\n\n");
      const userContent = [{ type: "input_text", text: userPrompt }];
      const normalizedMimeType = String(mimeType || "").toLowerCase();

      if (cleanImageData) {
        const imageUrl = cleanImageData.startsWith("data:")
          ? cleanImageData
          : `data:${normalizedMimeType || "image/jpeg"};base64,${cleanImageData.includes(",") ? cleanImageData.split(",").pop() : cleanImageData}`;
        userContent.push({ type: "input_image", image_url: imageUrl });
      } else if (cleanFileData) {
        userContent.push({
          type: "input_file",
          filename: String(fileName || "program-file"),
          file_data: cleanFileData
        });
      }

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemPrompt }]
            },
            {
              role: "user",
              content: userContent
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "workout_program_import",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  confidence: { type: "string" },
                  weeks: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        workouts: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              name: { type: "string" },
                              focus: { type: "string" },
                              exercises: {
                                type: "array",
                                items: {
                                  type: "object",
                                  additionalProperties: false,
                                  properties: {
                                    name: { type: "string" },
                                    notes: { type: "string" },
                                    sets: {
                                      type: "array",
                                      items: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                          reps: { type: "number" },
                                          weight: { type: "string" }
                                        },
                                        required: ["reps", "weight"]
                                      }
                                    }
                                  },
                                  required: ["name", "notes", "sets"]
                                }
                              }
                            },
                            required: ["name", "focus", "exercises"]
                          }
                        }
                      },
                      required: ["name", "workouts"]
                    }
                  }
                },
                required: ["name", "description", "confidence", "weeks"]
              }
            }
          },
          max_output_tokens: 3500
        })
      });
      const raw = await openAiResponse.text();

      if (!openAiResponse.ok) {
        console.error("OpenAI aiWorkoutProgramImport error:", raw);
        return json(res, 500, { ok: false, error: "OpenAI request failed", message: "ИИ не смог обработать файл.", details: raw.slice(0, 800), apiVersion });
      }

      let parsed = null;
      try {
        const responseData = JSON.parse(raw);
        const outputText = responseData.output_text
          || responseData.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text
          || "";
        parsed = JSON.parse(outputText);
      } catch (error) {
        console.error("aiWorkoutProgramImport parse error:", error, raw);
        parsed = extractJsonObject(raw);
      }

      if (!parsed) {
        return json(res, 500, { ok: false, error: "AI response parse failed", message: "ИИ вернул ответ без структуры программы.", apiVersion });
      }

      const program = normalizeAiWorkoutImportProgram(parsed);

      return json(res, 200, {
        ok: true,
        apiVersion,
        confidence: parsed.confidence || "medium",
        program
      });
    } catch (error) {
      console.error("aiWorkoutProgramImport error:", error);
      return json(res, getHttpErrorStatus(error), {
        ok: false,
        error: "ai_workout_program_import_failed",
        message: error.message,
        apiVersion
      });
    }
  }
);

function normalizeBasicWorkoutAiProfile(input = {}) {
  const allowed = {
    goal: ["general_fitness", "fat_loss", "muscle", "strength"],
    level: ["beginner", "returning", "experienced"],
    location: ["gym", "home"],
    days: ["2", "3", "4", "5"],
    duration: ["30", "45", "60", "90"],
    restrictions: ["none", "back", "knees", "shoulders", "other"],
    twoDayStructure: ["recovery_split", "balanced_full_body"],
    mode: ["plan", "today"],
    todayTarget: ["chest", "back", "shoulders", "legs", "glutes", "biceps", "triceps", "core", "full_body"],
    readiness: ["low", "normal", "high"]
  };

  const resolveValue = (key, fallback) => {
    const value = String(input[key] || "").trim();
    return allowed[key].includes(value) ? value : fallback;
  };
  const registration = input.registration && typeof input.registration === "object"
    ? input.registration
    : {};
  const rawTodayTargets = Array.isArray(input.todayTargets) && input.todayTargets.length
    ? input.todayTargets
    : [input.todayTarget];
  const todayTargets = [...new Set(rawTodayTargets.map((target) => {
    const value = String(target || "").trim();
    return value === "forearms" ? "biceps" : value;
  }).filter((target) => allowed.todayTarget.includes(target)))];
  const normalizedTodayTargets = todayTargets.includes("full_body")
    ? ["full_body"]
    : todayTargets.slice(0, 3);
  const numberInRange = (value, min, max) => {
    const numeric = Number(String(value || "").replace(",", "."));
    return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : null;
  };

  const days = resolveValue("days", "3");
  const twoDayStructure = days === "2"
    ? resolveValue("twoDayStructure", "recovery_split")
    : "recovery_split";

  return {
    mode: resolveValue("mode", "plan"),
    goal: resolveValue("goal", "general_fitness"),
    level: resolveValue("level", "beginner"),
    location: resolveValue("location", "gym"),
    days,
    duration: resolveValue("duration", "45"),
    restrictions: resolveValue("restrictions", "none"),
    restrictionDetails: cleanProgramText(input.restrictionDetails || "", 180),
    twoDayStructure,
    planPreferences: cleanProgramText(input.planPreferences || "", 280),
    todayTarget: normalizedTodayTargets[0] || resolveValue("todayTarget", "chest"),
    todayTargets: normalizedTodayTargets.length ? normalizedTodayTargets : [resolveValue("todayTarget", "chest")],
    readiness: resolveValue("readiness", "normal"),
    registration: {
      weight: numberInRange(registration.weight, 35, 300),
      height: numberInRange(registration.height, 120, 240),
      age: numberInRange(registration.age, 14, 100),
      sex: ["male", "female"].includes(String(registration.sex || ""))
        ? String(registration.sex)
        : "",
      activity: ["low", "medium", "high", "veryHigh"].includes(String(registration.activity || ""))
        ? String(registration.activity)
        : "",
      goal: ["cut", "mass", "recomp", "maintain"].includes(String(registration.goal || ""))
        ? String(registration.goal)
        : ""
    }
  };
}

function normalizeAiBasicWorkoutExercise(exercise = {}, index = 0, workoutId = "basic", targetSetCount = 3) {
  const catalogueExercise = resolveBasicWorkoutAiCatalogueExercise(exercise);
  if (!catalogueExercise) throw createHttpError(422, "AI selected an exercise outside the reviewed catalogue");

  const name = catalogueExercise.name;
  const isTimed = Number(catalogueExercise.durationSeconds) > 0 || isTimedBasicExercise(name);
  // A basic plan contains working sets only. Do not let an AI response create
  // an unexplained "15 / 15 / 8" sequence: warm-up work, when needed, belongs
  // outside the prescribed working sets and must be labelled explicitly.
  const prescribedReps = /Compound$/u.test(String(catalogueExercise.movementRole || "")) ? 8 : 10;
  const sourceSets = Array.isArray(exercise.sets) && exercise.sets.length
    ? exercise.sets
    : [isTimed ? { durationSeconds: catalogueExercise.durationSeconds || 30 } : { reps: 10, weight: "" }];
  const restSeconds = catalogueExercise.restSeconds;
  const normalizeSet = isTimed ? normalizeAiTimedWorkoutSet : normalizeAiWorkoutSet;
  const normalizedSets = sourceSets.slice(0, targetSetCount).map((set) => (
    isTimed
      ? normalizeSet(set)
      : { ...normalizeSet(set), reps: prescribedReps, weight: "", durationSeconds: 0 }
  ));
  const fallbackSet = normalizedSets[normalizedSets.length - 1] || normalizeSet(
    isTimed
      ? { durationSeconds: catalogueExercise.durationSeconds || 30 }
      : { reps: prescribedReps, weight: "", durationSeconds: 0 }
  );

  while (normalizedSets.length < targetSetCount) {
    normalizedSets.push({ ...fallbackSet, completed: false, enteredWeight: "", enteredReps: "" });
  }

  return {
    id: `${workoutId}_exercise_${index + 1}`,
    basicExerciseId: catalogueExercise.id,
    basicExerciseLibraryId: catalogueExercise.id,
    basicExerciseGroupId: catalogueExercise.groupId,
    basicMovementRole: catalogueExercise.movementRole,
    name,
    video: "",
    rest: `${restSeconds} сек`,
    equipment: catalogueExercise.equipment,
    requiresWeight: catalogueExercise.requiresWeight,
    usesWeight: catalogueExercise.requiresWeight,
    note: catalogueExercise.note,
    description: catalogueExercise.note,
    sets: normalizedSets
  };
}

function getBasicWorkoutExerciseRange(duration) {
  const ranges = {
    "30": { min: 3, max: 4 },
    "45": { min: 4, max: 5 },
    "60": { min: 5, max: 6 },
    "90": { min: 6, max: 8 }
  };

  return ranges[String(duration)] || ranges["45"];
}

function getBasicWorkoutExerciseTarget(duration) {
  const targets = {
    "30": 3,
    "45": 5,
    "60": 6,
    "90": 7
  };

  return targets[String(duration)] || targets["45"];
}

function getBasicWorkoutSetCount(duration, level) {
  if (String(duration) === "30") return 2;
  if (String(duration) === "45" && String(level) === "beginner") return 2;
  return 3;
}

function getBasicWorkoutSplitGuidance(days, twoDayStructure = "recovery_split") {
  if (String(days) === "2" && twoDayStructure === "balanced_full_body") {
    return [
      "День A — всё тело с акцентом на грудь и квадрицепс: один базовый жим на грудь, одна умеренная тяга на спину и ровно одно упражнение на квадрицепс. Оставшиеся слоты заполняй только лёгкой работой на руки/плечи и кором. Не добавляй второе упражнение на ноги, второй тяжёлый жим или тягу.",
      "День B — всё тело с акцентом на спину и заднюю цепь: одна базовая тяга на спину, один умеренный жим на грудь и ровно одно упражнение на заднюю поверхность ног/ягодицы. Оставшиеся слоты заполняй только лёгкой работой на руки/плечи и кором. Не добавляй второе упражнение на ноги, второй тяжёлый жим или тягу."
    ].join("\n");
  }

  const splits = {
    "2": [
      "День A — жимовой: грудь, передняя/средняя дельта, трицепс, ровно одно упражнение на квадрицепс и при необходимости кор. Не добавляй второе упражнение на ноги, тяги для спины или бицепс.",
      "День B — тяговой: спина, задняя дельта, бицепс, ровно одно упражнение на заднюю поверхность ног/ягодицы и при необходимости кор. Не добавляй второе упражнение на ноги, жимы на грудь или трицепс."
    ],
    "3": [
      "День A — ноги и кор: квадрицепс, задняя поверхность ног, ягодицы, икры и кор. Не добавляй прямые жимы или тяги верха тела.",
      "День B — жимовой верх: грудь, плечи и трицепс, при необходимости кор. Не добавляй тяги для спины или бицепс.",
      "День C — тяговой верх: спина, задняя дельта и бицепс, при необходимости кор. Не добавляй жимы на грудь или трицепс."
    ],
    "4": [
      "День A — жимовой верх: грудь, плечи и трицепс, при необходимости кор.",
      "День B — ноги, передняя поверхность: квадрицепс, икры и кор.",
      "День C — тяговой верх: спина, задняя дельта и бицепс, при необходимости кор.",
      "День D — ноги, задняя поверхность: ягодицы, задняя поверхность ног и кор."
    ],
    "5": [
      "День A — жимовой верх: грудь, плечи и трицепс.",
      "День B — ноги, передняя поверхность: квадрицепс, икры и кор.",
      "День C — тяговой верх: спина, задняя дельта и бицепс.",
      "День D — ноги, задняя поверхность: ягодицы, задняя поверхность ног и кор.",
      "День E — лёгкий смешанный день: только отстающие группы, кор и спокойная техника; не дублируй тяжёлую нагрузку предыдущего дня."
    ]
  };

  return (splits[String(days)] || splits["3"]).join("\n");
}

function getBasicWorkoutPairingGuidance(days, twoDayStructure = "recovery_split") {
  if (String(days) === "2" && twoDayStructure === "balanced_full_body") {
    return "Because the selected two-day format is balanced full body, each session must contain exactly one chest press and exactly one back-pulling exercise, plus its stated lower-body focus. Keep them as normal separate exercises with standard rest, never a superset or circuit. Do not add a second heavy chest press or a second heavy back pull in the same session. Give the two sessions at least 48 hours between them where the schedule allows.";
  }

  return "Separate major muscle groups by training day. Do not combine chest pressing and back pulling in the same workout. Do not schedule the same primary muscle group in consecutive training days; give it at least 48 hours before another hard session where the schedule allows.";
}

function getBasicWorkoutExerciseOrderGuidance(days, twoDayStructure = "recovery_split") {
  if (String(days) === "2" && twoDayStructure === "balanced_full_body") {
    return "Use this fixed order for each balanced full-body day: after a warm-up, first the main compound lower-body movement; then the upper-body movement matching that day's accent; then the complementary chest press or back pull; then supporting and isolated movements; and core or abs strictly last. If no compound leg movement is prescribed, begin with the main upper-body compound movement.";
  }

  return "Use this order in every workout: after a warm-up, start with the highest-priority compound movement. When the day includes a compound leg movement such as a squat, leg press, lunge, hip hinge, or hip thrust, list it as the first work exercise; then place the main upper-body compound movement, then supporting and isolated movements, and core or abs strictly last. If the only leg exercise is an isolation such as leg extension, leg curl, or calves, do not put it before a more complex compound movement. Do not mix a pull exercise into a push day or a chest press into a pull day.";
}

function getBasicWorkoutCompositionGuidance(days, twoDayStructure = "recovery_split", exerciseCount = 5) {
  const commonRules = [
    "Every exercise slot must have a distinct purpose. Never duplicate a primary movement pattern just to fill the workout.",
    "Use at most one direct core or abs exercise in a workout, and place it last.",
    "Use at most one chest press, one knee-dominant compound leg movement, and one hip-hinge or glute compound movement in the same workout. A chest fly is an accessory and may follow one chest press; never use two chest presses.",
    "Do not repeat a vertical pull, horizontal pull, shoulder press, biceps isolation, or triceps isolation within one workout."
  ];

  if (String(days) === "2" && twoDayStructure === "recovery_split") {
    return [
      ...commonRules,
      `For the ${exerciseCount}-exercise recovery split, Day A uses these roles once each as space allows: knee-dominant compound, chest press, shoulder movement, chest fly, triceps isolation, shoulder accessory, and one final core exercise. Use exactly one lower-body exercise; do not add a quad, calf, or other leg accessory.`,
      `Day B uses these roles once each as space allows: hip-hinge or glute compound, vertical back pull, horizontal back pull, rear-delt or other shoulder accessory, biceps isolation, an optional second distinct shoulder accessory for a long session, and one final core exercise. Use exactly one lower-body exercise; do not add a posterior-leg, calf, or other leg accessory.`
    ].join("\n");
  }

  if (String(days) === "2" && twoDayStructure === "balanced_full_body") {
    return [
      ...commonRules,
      "For balanced full body, Day A starts with one knee-dominant compound, then one chest press and one back pull; Day B starts with one hip-hinge or glute compound, then one back pull and one chest press. Each workout must have exactly one lower-body exercise. Fill remaining slots only with distinct upper-body supporting roles, not leg accessories, duplicate presses, squats, hinges, or core exercises."
    ].join("\n");
  }

  return commonRules.join("\n");
}

function getAiBasicWorkoutPlanCompositionIssues(rawPlan = {}, profile = {}) {
  const weeks = Array.isArray(rawPlan?.weeks) ? rawPlan.weeks : [];
  const requiresOneLowerExercise = String(profile?.days || "") === "2";

  return weeks.flatMap((week, weekIndex) => (
    (Array.isArray(week?.workouts) ? week.workouts : []).flatMap((workout, workoutIndex) => {
      const exercises = (Array.isArray(workout?.exercises) ? workout.exercises : []).map((exercise) => {
        const catalogueExercise = resolveBasicWorkoutAiCatalogueExercise(exercise);
        return catalogueExercise
          ? { ...exercise, basicMovementRole: catalogueExercise.movementRole }
          : exercise;
      });
      const issues = getBasicWorkoutCompositionIssues(exercises);
      const lowerExerciseCount = exercises.filter((exercise) => (
        ["kneeDominantCompound", "hipDominantCompound", "lowerAccessory"].includes(exercise.basicMovementRole)
      )).length;
      if (requiresOneLowerExercise && lowerExerciseCount > 1) {
        issues.push("двух упражнений на ноги в двухдневном плане");
      }
      return issues.length ? [`Неделя ${weekIndex + 1}, день ${workoutIndex + 1}: ${issues.join(", ")}`] : [];
    })
  ));
}

function getBasicWorkoutFourWeekStructureGuidance(days) {
  const dayCount = Math.max(1, Number(days) || 3);
  const dayLetters = ["A", "B", "C", "D", "E"].slice(0, dayCount);
  const firstVariants = dayLetters.map((letter) => `${letter}1`).join(", ");
  const secondVariants = dayLetters.map((letter) => `${letter}2`).join(", ");

  return [
    `Week 1 establishes the first ${dayCount} training-day variants: ${firstVariants}.`,
    `Week 2 creates the second variants for the same days: ${secondVariants}. Keep the same muscle focus as the matching day in week 1. Use a different approved catalogue exercise for a slot when a safe alternative exists for that role; otherwise repeat the exact approved exercise. Never invent, rename, or fake an alternative.`,
    "Week 3 repeats week 1 day-for-day: keep each exercise name, order, rest, and set count the same; only apply a small conservative progression of repetitions or timed duration when technique allows.",
    "Week 4 repeats week 2 day-for-day under the same rule: keep each exercise name, order, rest, and set count the same; only apply a small conservative progression of repetitions or timed duration when technique allows.",
    "Keep all working weights empty. Do not add sets or invent a fixed weight; the app will calibrate weights from the user's completed sessions."
  ].join("\n");
}

function createProgressedAiBasicWorkout(workout = {}) {
  return {
    ...workout,
    exercises: (Array.isArray(workout.exercises) ? workout.exercises : []).map((exercise) => {
      const isTimed = isTimedBasicExercise(exercise?.name);

      return {
        ...exercise,
        sets: (Array.isArray(exercise?.sets) ? exercise.sets : []).map((set) => {
          if (isTimed) {
            const durationSeconds = Math.min(90, Math.max(20, Number(set?.durationSeconds) || 30) + 5);
            return { ...set, reps: 0, weight: "", durationSeconds };
          }

          const reps = Math.min(30, Math.max(1, Number(set?.reps) || 10) + 1);
          return { ...set, reps, weight: "", durationSeconds: 0 };
        })
      };
    })
  };
}

function getBasicWorkoutDayName(name = "", workoutIndex = 0) {
  const cleanName = cleanProgramText(name, 90)
    .replace(/^(?:неделя|week)\s*\d+\s*[·.\-—–:]\s*/iu, "")
    .replace(/^день\s*\d+\s*[·.\-—–:]?\s*/iu, "")
    .trim();

  return `День ${workoutIndex + 1}${cleanName ? ` · ${cleanName}` : ""}`;
}

function normalizeAiBasicWorkoutPlan(rawPlan = {}, profile = {}, uid = "") {
  const expectedWeeks = 4;
  const templateWeeks = 2;
  const expectedDays = Number(profile.days) || 3;
  const exerciseRange = getBasicWorkoutExerciseRange(profile.duration);
  const exerciseTarget = getBasicWorkoutExerciseTarget(profile.duration);
  const targetSetCount = getBasicWorkoutSetCount(profile.duration, profile.level);
  const sourceWeeks = Array.isArray(rawPlan.weeks) ? rawPlan.weeks.slice(0, templateWeeks) : [];
  const isCompleteWorkout = (workout = {}) => (
    Array.isArray(workout.exercises) && workout.exercises.length >= exerciseRange.min
  );
  const sourceWeekWorkouts = sourceWeeks.map((week) => (
    Array.isArray(week?.workouts) ? week.workouts.filter(isCompleteWorkout) : []
  ));

  if (
    sourceWeeks.length !== templateWeeks ||
    sourceWeekWorkouts.some((weekWorkouts) => weekWorkouts.length < expectedDays)
  ) {
    throw createHttpError(422, "AI did not create complete workouts");
  }

  const planId = `basic_ai_${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`;
  const workouts = Array.from({ length: expectedWeeks }, (_, weekIndex) => {
    const isProgressionWeek = weekIndex >= 2;
    const sourceWeekIndex = isProgressionWeek ? weekIndex - 2 : weekIndex;
    const weekWorkouts = sourceWeekWorkouts[sourceWeekIndex]
      .slice(0, expectedDays)
      .map((workout) => (isProgressionWeek ? createProgressedAiBasicWorkout(workout) : workout));

    return Array.from({ length: expectedDays }, (_, workoutIndex) => {
      const workout = weekWorkouts[workoutIndex];
      const order = weekIndex * expectedDays + workoutIndex + 1;
      const workoutId = `${planId}_w${weekIndex + 1}_d${workoutIndex + 1}`;
      const exercises = orderBasicWorkoutExercises(
        Array.isArray(workout?.exercises) ? workout.exercises.slice(0, exerciseTarget) : []
      );
      const microcycleNumber = Math.floor(weekIndex / 2) + 1;
      const microcycleStartWeek = microcycleNumber === 1 ? 1 : 3;
      const workoutName = getBasicWorkoutDayName(workout.name, workoutIndex);

      return {
        id: workoutId,
        name: workoutName,
        weekNumber: weekIndex + 1,
        weekLabel: `Неделя ${weekIndex + 1}`,
        dayNumber: workoutIndex + 1,
        dayLabel: `День ${workoutIndex + 1}`,
        microcycleNumber,
        microcycleLabel: `Микроцикл ${microcycleNumber} · Недели ${microcycleStartWeek}–${microcycleStartWeek + 1}`,
        order,
        sortOrder: order,
        focus: cleanProgramText(workout.focus || "", 100),
        exercises: exercises.map((exercise, exerciseIndex) => (
          normalizeAiBasicWorkoutExercise(exercise, exerciseIndex, workoutId, targetSetCount)
        ))
      };
    });
  }).flat();

  return {
    id: planId,
    name: cleanProgramText(rawPlan.name || "Основной план тренировок на 4 недели", 90) || "Основной план тренировок на 4 недели",
    description: cleanProgramText(rawPlan.description || "План на 4 недели: две разные вариации тренировочных дней, затем их повтор с безопасной прогрессией.", 260),
    safetyNote: cleanProgramText(rawPlan.safetyNote || "Останавливайте упражнение при боли и соблюдайте комфортную технику.", 280),
    progressionNote: cleanProgramText(rawPlan.progressionNote || "Недели 1–2 дают две разные вариации тренировок. На неделях 3–4 повторяйте их с небольшой прогрессией по повторениям или времени только при уверенной технике.", 280),
    durationWeeks: expectedWeeks,
    structure: "variants_then_progression",
    microcycles: [
      { number: 1, label: "Разные вариации · Недели 1–2", weeks: [1, 2] },
      { number: 2, label: "Повтор с прогрессией · Недели 3–4", weeks: [3, 4] }
    ],
    generatedAt: new Date().toISOString(),
    generatedBy: "ai",
    profile: {
      ...profile,
      requestedBy: String(uid || "")
    },
    workouts
  };
}

function normalizeAiBasicWorkoutTodayPlan(rawPlan = {}, profile = {}, uid = "") {
  const targets = getBasicWorkoutTodayTargets(profile.todayTargets?.length ? profile.todayTargets : [profile.todayTarget]);
  const target = targets[0] || getBasicWorkoutTodayTarget(profile.todayTarget);
  const targetLabel = targets.map((item) => item.label).join(" + ") || target.label;
  const targetFocus = targets.map((item) => item.focus).join(" · ") || target.focus;
  const expectedExerciseCount = getBasicWorkoutTodayExerciseTarget(profile);
  const targetSetCount = profile.readiness === "low"
    ? 2
    : getBasicWorkoutSetCount(profile.duration, profile.level);
  const workout = rawPlan?.workout && typeof rawPlan.workout === "object" ? rawPlan.workout : {};
  const sourceExercises = Array.isArray(workout.exercises) ? workout.exercises : [];

  if (sourceExercises.length !== expectedExerciseCount) {
    throw createHttpError(422, "AI did not create the requested number of today-workout exercises");
  }

  const planId = `basic_today_${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`;
  const workoutId = `${planId}_workout`;
  const todayKey = new Date().toISOString().slice(0, 10);
  const exercises = orderBasicWorkoutExercises(sourceExercises).map((exercise, index) => (
    normalizeAiBasicWorkoutExercise(exercise, index, workoutId, targetSetCount)
  ));

  return {
    id: planId,
    name: cleanProgramText(rawPlan.name || `Тренировка на сегодня · ${targetLabel}`, 90)
      || `Тренировка на сегодня · ${targetLabel}`,
    description: cleanProgramText(
      rawPlan.description || `Тренировка с акцентом на ${targetLabel.toLocaleLowerCase("ru")}.`,
      260
    ),
    safetyNote: cleanProgramText(
      rawPlan.safetyNote || "Останавливайте упражнение при боли и сохраняйте комфортную технику.",
      280
    ),
    durationWeeks: 1,
    structure: "on_demand",
    generatedAt: new Date().toISOString(),
    generatedBy: "ai",
    todayTarget: target.label,
    todayTargets: targets.map((item) => item.label),
    profile: { ...profile, days: "1", requestedBy: String(uid || "") },
    workouts: [{
      id: workoutId,
      name: cleanProgramText(workout.name || targetLabel, 90) || targetLabel,
      focus: cleanProgramText(workout.focus || targetFocus, 100),
      weekNumber: 1,
      weekLabel: "Сегодня",
      dayNumber: 1,
      dayLabel: "Сегодня",
      order: 1,
      sortOrder: 1,
      scheduledDate: todayKey,
      plannedDate: todayKey,
      exercises
    }]
  };
}

async function respondWithAiBasicWorkoutToday({ res, profile, context, apiVersion }) {
  const expectedExercises = getBasicWorkoutTodayExerciseTarget(profile);
  const expectedSets = profile.readiness === "low"
    ? 2
    : getBasicWorkoutSetCount(profile.duration, profile.level);
  const targets = getBasicWorkoutTodayTargets(profile.todayTargets?.length ? profile.todayTargets : [profile.todayTarget]);
  const target = targets[0] || getBasicWorkoutTodayTarget(profile.todayTarget);
  const targetLabel = targets.map((item) => item.label).join(" + ") || target.label;
  const respondWithSafeFallback = (reason) => {
    try {
      const fallbackDraft = buildBasicWorkoutTodayFallbackDraft(profile);
      const fallbackPlan = normalizeAiBasicWorkoutTodayPlan(fallbackDraft, profile, context.uid);
      console.warn("aiBasicWorkoutPlan today mode using deterministic fallback:", reason);
      json(res, 200, {
        ok: true,
        apiVersion,
        fallback: true,
        plan: {
          ...fallbackPlan,
          generatedBy: "safe_fallback",
          generationFallback: true,
          requiresReview: profile.restrictions !== "none"
        }
      });
      return true;
    } catch (fallbackError) {
      console.error("aiBasicWorkoutPlan today fallback error:", fallbackError);
      return false;
    }
  };

  if (profile.restrictions !== "none" && respondWithSafeFallback("restriction_aware_workout")) return;

  try {
    await enforceRateLimit(context.uid, "ai-basic-workout-today-v1", {
      limit: 8,
      windowMs: 10 * 60 * 1000
    });
    await enforceRateLimit(context.uid, "ai-basic-workout-today-daily-v1", {
      limit: 16,
      windowMs: 24 * 60 * 60 * 1000
    });
  } catch (rateLimitError) {
    if (respondWithSafeFallback("rate_limited")) return;
    throw rateLimitError;
  }

  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) {
    if (respondWithSafeFallback("api_key_missing")) return;
    return json(res, 500, { ok: false, error: "OPENAI_API_KEY is not configured", apiVersion });
  }

  const systemPrompt = [
    "You are a careful fitness-workout generator for a Russian-language workout app.",
    "Create one practical training session for today, not a weekly or multi-week program.",
    "Use only concise Russian text and the reviewed catalogue names exactly as supplied.",
    "Do not invent exercises, rename exercises, add supersets, circuits, maximal lifts, forced repetitions, or training through pain.",
    `Return exactly ${expectedExercises} exercises and exactly ${expectedSets} working sets for every exercise.`,
    "Use empty strings for working weights. The app calibrates a conservative starting weight separately.",
    "Every regular set must use the same repetition target. For a timed plank, set reps to 0 and durationSeconds from 20 to 90; other exercises have durationSeconds 0.",
    getBasicWorkoutTodayPromptGuidance(profile),
    "Do not diagnose, treat, or rehabilitate injuries. Return only JSON matching the schema."
  ].join("\n");
  const userPrompt = [
    "Create a single workout for today that will be saved directly to the app.",
    `Selected focus: ${targetLabel}.`,
    `Time available: ${profile.duration} minutes.`,
    `Experience: ${profile.level}. Readiness today: ${profile.readiness}.`,
    `Location: ${profile.location}. Limitation: ${profile.restrictions}.`,
    `Optional note: ${profile.planPreferences || "none"}.`,
    "Use only the approved catalogue below. For every exercise return the exact catalogueId and matching canonical Russian name:\n" + getBasicWorkoutAiCatalogueGuidance(profile.location),
    "Return the workout name by its focus only; the app adds the date context."
  ].join("\n");
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      safetyNote: { type: "string" },
      workout: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          focus: { type: "string" },
          exercises: {
            type: "array",
            minItems: expectedExercises,
            maxItems: expectedExercises,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                catalogueId: { type: "string" },
                name: { type: "string" },
                note: { type: "string" },
                restSeconds: { type: "number" },
                sets: {
                  type: "array",
                  minItems: expectedSets,
                  maxItems: expectedSets,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      reps: { type: "number" },
                      weight: { type: "string" },
                      durationSeconds: { type: "number" }
                    },
                    required: ["reps", "weight", "durationSeconds"]
                  }
                }
              },
              required: ["catalogueId", "name", "note", "restSeconds", "sets"]
            }
          }
        },
        required: ["name", "focus", "exercises"]
      }
    },
    required: ["name", "description", "safetyNote", "workout"]
  };

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] }
        ],
        text: { format: { type: "json_schema", name: "basic_workout_today", schema } },
        max_output_tokens: 2800
      })
    });
    const raw = await openAiResponse.text();

    if (!openAiResponse.ok) {
      console.error("OpenAI aiBasicWorkoutPlan today error:", raw);
      if (respondWithSafeFallback("initial_request_failed")) return;
      return json(res, 502, { ok: false, error: "OpenAI request failed", message: "ИИ сейчас не смог составить тренировку. Попробуйте ещё раз.", apiVersion });
    }

    let parsed = null;
    try {
      const responseData = JSON.parse(raw);
      const outputText = responseData.output_text
        || responseData.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text
        || "";
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      console.error("aiBasicWorkoutPlan today parse error:", parseError, raw);
      parsed = extractJsonObject(raw);
    }

    if (!parsed) {
      if (respondWithSafeFallback("parse_failed")) return;
      return json(res, 502, { ok: false, error: "AI response parse failed", message: "ИИ вернул ответ без тренировки. Попробуйте ещё раз.", apiVersion });
    }

    const workoutDraft = parsed.workout || {};
    const catalogueIssues = getBasicWorkoutAiCatalogueIssues({ weeks: [{ workouts: [workoutDraft] }] }, profile.location);
    const compositionIssues = getBasicWorkoutTodayCompositionIssues(workoutDraft, profile);
    const issues = [...new Set([...catalogueIssues, ...compositionIssues])];
    if (issues.length) {
      console.warn("aiBasicWorkoutPlan today validation failed:", issues);
      if (respondWithSafeFallback("catalogue_or_focus_validation_failed")) return;
      throw createHttpError(422, "AI did not create a valid today workout");
    }

    return json(res, 200, { ok: true, apiVersion, plan: normalizeAiBasicWorkoutTodayPlan(parsed, profile, context.uid) });
  } catch (error) {
    console.error("aiBasicWorkoutPlan today error:", error);
    if (respondWithSafeFallback("normalization_failed")) return;
    const status = getHttpErrorStatus(error, 502);
    return json(res, status, {
      ok: false,
      error: "ai_basic_workout_today_failed",
      message: status === 422 ? "ИИ не смог подобрать безопасную тренировку. Попробуйте ещё раз." : error.message || "Не удалось составить тренировку.",
      apiVersion
    });
  }
}

export const aiBasicWorkoutPlan = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 90,
    secrets: [OPENAI_API_KEY],
    cors: true
  },
  async (req, res) => {
    const apiVersion = "aiBasicWorkoutPlan-v18";
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed", apiVersion });

    try {
      // A basic plan is available to every signed-in client. Keep Firebase Auth,
      // App Check, and rate limiting here; a paid membership is not required.
      const context = await requireAuthenticatedUser(req);
      const profile = normalizeBasicWorkoutAiProfile(req.body?.profile || {});
      if (profile.mode === "today") {
        return respondWithAiBasicWorkoutToday({ res, profile, context, apiVersion });
      }
      const expectedWorkoutDays = Number(profile.days) || 3;
      const expectedExercisesPerWorkout = getBasicWorkoutExerciseTarget(profile.duration);
      const expectedSetsPerExercise = getBasicWorkoutSetCount(profile.duration, profile.level);
      const respondWithSafeFallback = (reason) => {
        try {
          const fallbackDraft = buildBasicWorkoutFallbackDraft(profile);
          const fallbackPlan = normalizeAiBasicWorkoutPlan(fallbackDraft, profile, context.uid);
          console.warn("aiBasicWorkoutPlan using deterministic fallback:", reason);
          json(res, 200, {
            ok: true,
            apiVersion,
            fallback: true,
            plan: {
              ...fallbackPlan,
              generatedBy: "safe_fallback",
              generationFallback: true,
              requiresReview: profile.restrictions !== "none"
            }
          });
          return true;
        } catch (fallbackError) {
          console.error("aiBasicWorkoutPlan fallback error:", fallbackError);
          return false;
        }
      };
      // Restrictions make a broad language-model answer less predictable. Use a
      // reviewed, conservative template immediately so the user never receives a
      // technical generation error while waiting for a trainer or clinician's advice.
      if (profile.restrictions !== "none" && respondWithSafeFallback("restriction_aware_plan")) return;
      // The limits apply to calls that actually invoke the external AI provider.
      // A deterministic restriction-aware fallback is local and does not spend a
      // user's AI generation attempts.
      try {
        await enforceRateLimit(context.uid, "ai-basic-workout-plan-v2", {
          limit: 8,
          windowMs: 10 * 60 * 1000
        });
        await enforceRateLimit(context.uid, "ai-basic-workout-plan-daily-v2", {
          limit: 16,
          windowMs: 24 * 60 * 60 * 1000
        });
      } catch (rateLimitError) {
        if (respondWithSafeFallback("rate_limited")) return;
        throw rateLimitError;
      }
      const apiKey = OPENAI_API_KEY.value();
      if (!apiKey) {
        if (respondWithSafeFallback("api_key_missing")) return;
        return json(res, 500, { ok: false, error: "OPENAI_API_KEY is not configured", apiVersion });
      }

      const systemPrompt = [
        "You are a careful fitness-program generator for a Russian-language workout app.",
        "Create a practical four-week beginner-friendly workout plan from the supplied profile.",
        "Use only Russian workout names and concise Russian instructions.",
        "Use a clear four-week structure: weeks 1-2 introduce two different variants of each training day; weeks 3-4 repeat those variants with only conservative progression.",
        "In week 2, keep every training day's muscle focus from week 1. Use a different approved catalogue exercise for a slot only when a safe alternative exists for that role; otherwise repeat the exact approved exercise. In week 3, repeat week 1's exercise names and order. In week 4, repeat week 2's exercise names and order.",
        "Use familiar, simple exercises only. Do not invent exercise names, obscure variations, supersets, circuits, or technical jargon.",
        "Use exactly the requested number of exercises and exactly the requested work sets in every workout. Return each set separately.",
        "Return only working sets. Every regular set of one exercise must have the same repetition target; do not encode warm-up sets among them. The app applies its own consistent repetition prescription and shows any future warm-up separately.",
        "Use empty strings for working weights because the app calculates a conservative first-session starting weight from the registration profile and then confirms it with the user. Never prescribe a fixed weight or add sets as progression.",
        "Every set must include reps, weight, and durationSeconds. For regular repetition-based exercises, set durationSeconds to 0. For a plank, prescribe a time instead of repetitions: use durationSeconds from 20 to 90 on every set and set reps to 0.",
        getBasicWorkoutPairingGuidance(profile.days, profile.twoDayStructure),
        "Make weeks 1-2 conservative. In weeks 3-4, increase only repetitions or timed duration by a small safe amount when appropriate. Include at least one recovery day between hard sessions where possible.",
        "Return exactly the two base weeks and the exact requested count of complete workouts in each. The app creates weeks 3-4 by repeating those same exercise lists with safe progression.",
        "Never diagnose, treat, or rehabilitate injuries. When an activity limitation is selected, choose lower-risk alternatives, avoid movements likely to aggravate the named area, and state that pain means to stop and seek professional advice.",
        "Treat an optional user wish as a preference only: follow it when it remains safe and consistent with the selected goal, location, duration, and limitations.",
        "Do not include dangerous challenges, maximal lifts, forced repetitions, or training through pain.",
        "Return only JSON that matches the requested schema."
      ].join("\n");
      const userPrompt = [
        "Create the two base weeks for a 4-week personal basic workout plan with exactly the requested number of workouts in each week.",
        "Use the exact four-week sequence below. Return only weeks 1 and 2; the app will create weeks 3 and 4 as the stated repeats with progression.",
        getBasicWorkoutFourWeekStructureGuidance(profile.days),
        "The plan will be saved directly into the workout app, so all exercises must have a name, short technique note, rest in seconds, and separate sets.",
        `Every workout must contain exactly ${expectedExercisesPerWorkout} simple exercises and exactly ${expectedSetsPerExercise} work sets per exercise for the selected duration.`,
        "Name every workout by its focus only, for example: 'Грудь, трицепс и квадрицепс'. The app adds 'День 1', 'День 2' and so on.",
        "Follow this required muscle-group split for every week:\n" + getBasicWorkoutSplitGuidance(profile.days, profile.twoDayStructure),
        getBasicWorkoutExerciseOrderGuidance(profile.days, profile.twoDayStructure),
        getBasicWorkoutCompositionGuidance(profile.days, profile.twoDayStructure, expectedExercisesPerWorkout),
        "Choose only from the reviewed catalogue below. Each heading is the exact server-validated movement role. A heading marked 'max 1 per workout' may appear only once in one workout; " + (profile.days === "2"
          ? "for this two-day plan, every workout must contain exactly one lower-body exercise and no lowerAccessory."
          : "use lowerAccessory rather than a second hipDominantCompound for extra leg work.") + " For every exercise, return its exact catalogueId and its matching canonical Russian name. Do not invent, rename, shorten, or add a variation. The catalogue is already filtered for the selected place:\n" + getBasicWorkoutAiCatalogueGuidance(profile.location),
        "Profile:",
        `- goal: ${profile.goal}`,
        `- experience: ${profile.level}`,
        `- location: ${profile.location}`,
        `- workouts per week: ${profile.days}`,
        `- selected two-day workload format: ${profile.twoDayStructure}`,
        `- time per workout: ${profile.duration} minutes`,
        `- limitation: ${profile.restrictions}`,
        `- user note about limitation: ${profile.restrictionDetails || "none"}`,
        `- optional user wish for the plan: ${profile.planPreferences || "none"}`,
        "Registration profile for exercise selection and conservative first-session load context:",
        `- body weight: ${profile.registration.weight ? `${profile.registration.weight} kg` : "not provided"}`,
        `- height: ${profile.registration.height ? `${profile.registration.height} cm` : "not provided"}`,
        `- age: ${profile.registration.age || "not provided"}`,
        `- sex: ${profile.registration.sex || "not provided"}`,
        `- daily activity: ${profile.registration.activity || "not provided"}`,
        `- registration goal: ${profile.registration.goal || "not provided"}`,
        "Use the registration profile only to choose suitable exercise variants and conservative volume. Do not infer a maximal lift and keep every set weight empty."
      ].join("\n");

      const parseBasicWorkoutPlanDraft = (responseRaw, attempt) => {
        try {
          const responseData = JSON.parse(responseRaw);
          const outputText = responseData.output_text
            || responseData.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text
            || "";
          return JSON.parse(outputText);
        } catch (error) {
          console.error(`aiBasicWorkoutPlan ${attempt} parse error:`, error, responseRaw);
          return extractJsonObject(responseRaw);
        }
      };

      const openAiRequestBody = {
          model: "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemPrompt }]
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userPrompt }]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "basic_workout_plan",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  safetyNote: { type: "string" },
                  progressionNote: { type: "string" },
                  weeks: {
                    type: "array",
                    minItems: 2,
                    maxItems: 2,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        workouts: {
                          type: "array",
                          minItems: expectedWorkoutDays,
                          maxItems: expectedWorkoutDays,
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              name: { type: "string" },
                              focus: { type: "string" },
                              exercises: {
                                type: "array",
                                minItems: expectedExercisesPerWorkout,
                                maxItems: expectedExercisesPerWorkout,
                                items: {
                                  type: "object",
                                  additionalProperties: false,
                                  properties: {
                                    catalogueId: { type: "string" },
                                    name: { type: "string" },
                                    note: { type: "string" },
                                    restSeconds: { type: "number" },
                                    sets: {
                                      type: "array",
                                      minItems: expectedSetsPerExercise,
                                      maxItems: expectedSetsPerExercise,
                                      items: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                          reps: { type: "number" },
                                          weight: { type: "string" },
                                          durationSeconds: { type: "number" }
                                        },
                                        required: ["reps", "weight", "durationSeconds"]
                                      }
                                    }
                                  },
                                  required: ["catalogueId", "name", "note", "restSeconds", "sets"]
                                }
                              }
                            },
                            required: ["name", "focus", "exercises"]
                          }
                        }
                      },
                      required: ["workouts"]
                    }
                  }
                },
                required: ["name", "description", "safetyNote", "progressionNote", "weeks"]
              }
            }
          },
          max_output_tokens: 7000
      };
      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(openAiRequestBody)
      });
      const raw = await openAiResponse.text();

      if (!openAiResponse.ok) {
        console.error("OpenAI aiBasicWorkoutPlan error:", raw);
        if (respondWithSafeFallback("initial_request_failed")) return;
        return json(res, 502, {
          ok: false,
          error: "OpenAI request failed",
          message: "ИИ сейчас не смог составить план. Попробуйте ещё раз.",
          apiVersion
        });
      }

      let parsed = parseBasicWorkoutPlanDraft(raw, "initial");

      if (!parsed) {
        if (respondWithSafeFallback("initial_parse_failed")) return;
        return json(res, 502, {
          ok: false,
          error: "AI response parse failed",
          message: "ИИ вернул ответ без готового плана. Попробуйте ещё раз.",
          apiVersion
        });
      }

      const compositionIssues = getAiBasicWorkoutPlanCompositionIssues(parsed, profile);
      const catalogueIssues = getBasicWorkoutAiCatalogueIssues(parsed, profile.location);
      const planIssues = [...new Set([...compositionIssues, ...catalogueIssues])];
      if (planIssues.length) {
        console.warn("aiBasicWorkoutPlan using deterministic fallback after validation:", planIssues);
        if (respondWithSafeFallback("catalogue_or_composition_validation_failed")) return;
        throw createHttpError(422, "AI did not create a varied workout composition");
      }

      try {
        return json(res, 200, {
          ok: true,
          apiVersion,
          plan: normalizeAiBasicWorkoutPlan(parsed, profile, context.uid)
        });
      } catch (normalizationError) {
        if (respondWithSafeFallback("normalization_failed")) return;
        throw normalizationError;
      }
    } catch (error) {
      console.error("aiBasicWorkoutPlan error:", error);
      const status = getHttpErrorStatus(error, 502);
      return json(res, status, {
        ok: false,
        error: "ai_basic_workout_plan_failed",
        message: status === 422
          ? "ИИ не смог подобрать достаточно разнообразную структуру плана. Попробуйте создать его ещё раз."
          : error.message || "Не удалось составить план.",
        apiVersion
      });
    }
  }
);

async function fetchOpenAiNutritionFoods(query) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Подбери продукты для фитнес-приложения по поисковому запросу:",
                JSON.stringify(query),
                "Верни только JSON без markdown в формате",
                '{"foods":[{"name":"название","brand":"бренд или пустая строка","portion":"100 г","calories":0,"protein":0,"fat":0,"carbs":0,"confidence":"high|medium|low"}]}.',
                "Дай до 10 реалистичных вариантов. Все значения указывай на 100 г.",
                "Не придумывай штрихкоды и не возвращай продукты без пищевой ценности."
              ].join(" ")
            }
          ]
        }
      ],
      max_output_tokens: 900
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw createHttpError(502, `OpenAI nutrition search error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const outputText = data.output_text ||
    data.output?.flatMap((item) => item.content || [])
      ?.map((item) => item.text || "")
      ?.join("\n") || "";
  const parsed = extractJsonObject(outputText) || {};

  return (Array.isArray(parsed.foods) ? parsed.foods : [])
    .map((food, index) => {
      const name = normalizeSearchString(food.name || food.query);
      const brand = normalizeSearchString(food.brand);
      const calories = Math.round(parseSearchNumber(food.calories));
      const protein = roundSearchMacro(food.protein);
      const fat = roundSearchMacro(food.fat);
      const carbs = roundSearchMacro(food.carbs);

      if (!name || (!calories && !protein && !fat && !carbs)) return null;

      const id = crypto
        .createHash("sha256")
        .update(`${name}:${brand}:${index}`)
        .digest("hex")
        .slice(0, 18);

      return {
        id: `ai_search_${id}`,
        foodId: `ai_search_${id}`,
        name: brand ? `${name} — ${brand}` : name,
        brand,
        portion: normalizeSearchString(food.portion || "100 г"),
        calories,
        protein,
        fat,
        carbs,
        confidence: normalizeSearchString(food.confidence || "medium"),
        source: "OpenAI"
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

async function nutritionSearchHandler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const context = await requireActiveMember(req);
    await enforceRateLimit(context.uid, "nutrition-search", {
      limit: 40,
      windowMs: 60 * 1000
    });
    await enforceRateLimit(context.uid, "nutrition-search-daily", {
      limit: 300,
      windowMs: 24 * 60 * 60 * 1000
    });

    const query = normalizeSearchString(req.query.q).slice(0, 120);
    if (query.length < 2) return json(res, 200, { foods: [], sources: [] });

    const foods = await fetchOpenAiNutritionFoods(query);
    return json(res, 200, {
      foods,
      fallbackSuggestions: foods.length ? [] : [
        "Фото продукта",
        "Уточнить бренд и название",
        "Создать продукт"
      ],
      sources: foods.length ? ["OpenAI"] : [],
      mode: "openai"
    });
  } catch (error) {
    console.error("nutritionSearch error:", error);
    return json(res, getHttpErrorStatus(error), {
      ok: false,
      error: "nutrition_search_failed",
      message: error.message
    });
  }
}

export const nutritionSearch = onRequest(
  {
    cors: true,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
    region: "us-central1"
  },
  nutritionSearchHandler
);

export const fatsecretSearch = onRequest(
  {
    cors: true,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
    region: "us-central1"
  },
  nutritionSearchHandler
);

function normalizeOpenFoodFactsProduct(product = {}) {
  const nutriments = product.nutriments || {};
  const code = normalizeSearchString(product.code || product._id);
  const productName = normalizeSearchString(
    product.product_name_ru ||
    product.product_name ||
    product.product_name_en ||
    product.generic_name
  );
  const brand = normalizeSearchString(product.brands);
  if (!productName && !brand) return null;

  const calories = parseSearchNumber(
    nutriments["energy-kcal_100g"] ??
    nutriments["energy-kcal"] ??
    (nutriments.energy_100g ? parseSearchNumber(nutriments.energy_100g) / 4.184 : 0)
  );
  const protein = parseSearchNumber(nutriments.proteins_100g ?? nutriments.proteins);
  const fat = parseSearchNumber(nutriments.fat_100g ?? nutriments.fat);
  const carbs = parseSearchNumber(nutriments.carbohydrates_100g ?? nutriments.carbohydrates);
  if (!calories && !protein && !fat && !carbs) return null;

  const fallbackId = crypto
    .createHash("sha256")
    .update(`${productName}:${brand}`)
    .digest("hex")
    .slice(0, 18);
  const id = `off_${code || fallbackId}`;

  return {
    id,
    foodId: id,
    openFoodFactsId: code,
    barcode: code,
    name: brand ? `${productName || "Продукт"} — ${brand}` : productName,
    brand,
    portion: normalizeSearchString(product.serving_size || product.quantity || "100 г"),
    calories: Math.round(calories),
    protein: roundSearchMacro(protein),
    fat: roundSearchMacro(fat),
    carbs: roundSearchMacro(carbs),
    source: "Open Food Facts"
  };
}

export const openFoodFactsSearch = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: "512MiB",
    region: "us-central1"
  },
  async (req, res) => {
    if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      await enforceRateLimit(context.uid, "open-food-facts-search", {
        limit: 60,
        windowMs: 60 * 1000
      });
      await enforceRateLimit(context.uid, "open-food-facts-search-daily", {
        limit: 500,
        windowMs: 24 * 60 * 60 * 1000
      });

      const query = normalizeSearchString(req.query.q).slice(0, 120);
      if (query.length < 2) return json(res, 200, { foods: [], sources: [] });

      const fields = [
        "code",
        "product_name",
        "product_name_ru",
        "product_name_en",
        "generic_name",
        "brands",
        "quantity",
        "serving_size",
        "nutriments"
      ].join(",");
      const url = new URL("https://world.openfoodfacts.org/api/v2/search");
      url.searchParams.set("search_terms", query);
      url.searchParams.set("page_size", "20");
      url.searchParams.set("fields", fields);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "WorkoutApp/1.0 (nutrition search)"
        }
      });
      if (!response.ok) throw createHttpError(502, `Open Food Facts error ${response.status}`);

      const data = await response.json();
      const seen = new Set();
      const foods = (Array.isArray(data.products) ? data.products : [])
        .map(normalizeOpenFoodFactsProduct)
        .filter((food) => {
          if (!food) return false;
          const key = food.barcode || food.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 20);

      return json(res, 200, {
        foods,
        sources: foods.length ? ["Open Food Facts"] : []
      });
    } catch (error) {
      console.error("openFoodFactsSearch error:", error);
      return json(res, getHttpErrorStatus(error), {
        ok: false,
        error: "open_food_facts_search_failed",
        message: error.message
      });
    }
  }
);

export const profileUpdateEmail = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      await enforceRateLimit(context.uid, "profile-update-email", {
        limit: 8,
        windowMs: 10 * 60 * 1000
      });
      await enforceRateLimit(context.uid, "profile-update-email-daily", {
        limit: 20,
        windowMs: 24 * 60 * 60 * 1000
      });

      const nextEmail = normalizeAccountEmail(req.body?.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return json(res, 400, { ok: false, error: "invalid-email", message: "Invalid email" });
      }

      const authUser = await admin.auth().getUser(context.uid);
      const currentEmail = normalizeAccountEmail(authUser.email || context.userData.email);
      if (nextEmail === currentEmail) {
        return json(res, 200, { ok: true, email: nextEmail, unchanged: true });
      }

      const existingUser = await admin.auth().getUserByEmail(nextEmail).catch((error) => {
        if (error?.code === "auth/user-not-found") return null;
        throw error;
      });
      if (existingUser && existingUser.uid !== context.uid) {
        return json(res, 409, { ok: false, error: "email-already-in-use", message: "Email already in use" });
      }

      const updatedAt = new Date().toISOString();
      const accountProfile = context.userData.accountProfile || {};
      const displayName = accountProfile.displayName || context.userData.name || authUser.displayName || "";
      const avatarUrl = accountProfile.avatarUrl || context.userData.avatarUrl || authUser.photoURL || "";
      const previousDefaultLoginAlias = getDefaultLoginAliasForEmail(currentEmail);
      const nextDefaultLoginAlias = getDefaultLoginAliasForEmail(nextEmail);
      const currentLoginAlias = normalizeLoginAlias(context.userData.loginLower || accountProfile.login || previousDefaultLoginAlias);
      const nextLoginAlias = currentLoginAlias && currentLoginAlias !== previousDefaultLoginAlias
        ? currentLoginAlias
        : nextDefaultLoginAlias;
      const nextAccountProfile = {
        ...accountProfile,
        displayName,
        avatarUrl,
        email: nextEmail,
        login: nextLoginAlias,
        updatedAt
      };

      await admin.auth().updateUser(context.uid, {
        email: nextEmail,
        emailVerified: false
      });

      const db = admin.firestore();
      const batch = db.batch();
      batch.set(db.collection("users").doc(context.uid), {
        email: nextEmail,
        loginLower: nextLoginAlias,
        accountProfile: nextAccountProfile,
        pendingEmail: "",
        pendingEmailRequestedAt: "",
        updatedAt
      }, { merge: true });

      if (nextLoginAlias) {
        batch.set(db.collection("loginAliases").doc(nextLoginAlias), {
          email: nextEmail,
          uid: context.uid,
          updatedAt
        }, { merge: true });
      }
      if (previousDefaultLoginAlias && previousDefaultLoginAlias !== nextLoginAlias) {
        batch.delete(db.collection("loginAliases").doc(previousDefaultLoginAlias));
      }

      await batch.commit();

      return json(res, 200, {
        ok: true,
        email: nextEmail,
        loginAlias: nextLoginAlias,
        accountProfile: nextAccountProfile
      });
    } catch (error) {
      console.error("profileUpdateEmail error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

// Restores access only for accounts from the legacy login flow. New Firebase
// accounts still require a trainer invitation and cannot self-enrol here.
export const recoverLegacyClientProfile = onRequest(
  {
    cors: true,
    timeoutSeconds: 20,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireAuthenticatedUser(req);
      await enforceRateLimit(context.uid, "legacy-client-profile-recovery", {
        limit: 4,
        windowMs: 60 * 60 * 1000
      });

      const db = admin.firestore();
      const userRef = db.collection("users").doc(context.uid);
      const userSnapshot = await userRef.get();
      const currentProfile = userSnapshot.exists ? userSnapshot.data() || {} : {};
      const currentRole = String(currentProfile.role || "").trim().toLowerCase();

      if (userSnapshot.exists && ["client", "trainer", "admin"].includes(currentRole)) {
        if (!isActiveMemberData(currentProfile)) {
          throw createHttpError(403, "Account access is disabled");
        }
        return json(res, 200, { ok: true, recovered: false });
      }

      if (
        currentProfile.active === false ||
        currentProfile.archived === true ||
        currentProfile.accessDisabled === true ||
        ["revoked", "suspended"].includes(String(currentProfile.membershipStatus || "").trim().toLowerCase())
      ) {
        throw createHttpError(403, "Account access is disabled");
      }

      if (!userSnapshot.exists) {
        const authEmail = normalizeAccountEmail(context.token.email || "");
        const aliasesSnapshot = await db.collection("loginAliases")
          .where("uid", "==", context.uid)
          .limit(2)
          .get();
        const hasMatchingLegacyAlias = aliasesSnapshot.docs.some((alias) => (
          normalizeAccountEmail(alias.data()?.email || "") === authEmail
        ));

        if (!authEmail || !hasMatchingLegacyAlias) {
          throw createHttpError(403, "Legacy account recovery is unavailable");
        }
      }

      const updatedAt = new Date().toISOString();
      const authEmail = normalizeAccountEmail(context.token.email || "");
      await userRef.set({
        role: "client",
        ...(userSnapshot.exists ? {} : {
          email: authEmail,
          createdAt: updatedAt
        }),
        updatedAt
      }, { merge: true });

      return json(res, 200, { ok: true, recovered: true });
    } catch (error) {
      console.error("recoverLegacyClientProfile error:", error?.code || error?.message || error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const profileUpdateLogin = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      await enforceRateLimit(context.uid, "profile-update-login", {
        limit: 10,
        windowMs: 10 * 60 * 1000
      });

      const nextLoginAlias = normalizeLoginAlias(req.body?.login);
      if (!isValidLoginAlias(nextLoginAlias)) {
        return json(res, 400, {
          ok: false,
          error: "invalid-login",
          message: "Login must be 3-32 latin characters, numbers, dot, dash or underscore"
        });
      }

      const authUser = await admin.auth().getUser(context.uid);
      const email = normalizeAccountEmail(authUser.email || context.userData.email);
      if (!email) {
        return json(res, 400, { ok: false, error: "missing-email", message: "Account email is required" });
      }

      const accountProfile = context.userData.accountProfile || {};
      const currentLoginAlias = normalizeLoginAlias(context.userData.loginLower || accountProfile.login || getDefaultLoginAliasForEmail(email));
      if (nextLoginAlias === currentLoginAlias) {
        return json(res, 200, { ok: true, login: nextLoginAlias, unchanged: true });
      }

      const db = admin.firestore();
      const nextAliasRef = db.collection("loginAliases").doc(nextLoginAlias);
      const nextAliasSnapshot = await nextAliasRef.get();
      const nextAliasData = nextAliasSnapshot.exists ? nextAliasSnapshot.data() || {} : {};
      if (nextAliasData.uid && nextAliasData.uid !== context.uid) {
        return json(res, 409, { ok: false, error: "login-already-in-use", message: "Login already in use" });
      }

      const updatedAt = new Date().toISOString();
      const nextAccountProfile = {
        ...accountProfile,
        email,
        login: nextLoginAlias,
        updatedAt
      };

      const batch = db.batch();
      batch.set(db.collection("users").doc(context.uid), {
        loginLower: nextLoginAlias,
        accountProfile: nextAccountProfile,
        updatedAt
      }, { merge: true });
      batch.set(nextAliasRef, {
        email,
        uid: context.uid,
        updatedAt,
        ...(nextAliasSnapshot.exists ? {} : { createdAt: updatedAt })
      }, { merge: true });
      if (currentLoginAlias && currentLoginAlias !== nextLoginAlias) {
        batch.delete(db.collection("loginAliases").doc(currentLoginAlias));
      }

      await batch.commit();

      return json(res, 200, {
        ok: true,
        login: nextLoginAlias,
        accountProfile: nextAccountProfile
      });
    } catch (error) {
      console.error("profileUpdateLogin error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

// Administrative lifecycle operations deliberately run in Functions instead of
// direct browser writes. This keeps role changes, trainer-client mirrors and
// audit records in one atomic operation.
export const adminAssignClient = onRequest(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      assertAdminContext(context);
      await enforceRateLimit(context.uid, "admin-assign-client", {
        limit: 100,
        windowMs: 10 * 60 * 1000
      });

      const clientId = normalizeAdminUserId(req.body?.clientId, "clientId");
      const trainerId = normalizeAdminUserId(req.body?.trainerId, "trainerId", { optional: true });
      const db = admin.firestore();
      const now = new Date().toISOString();
      const result = await db.runTransaction(async (transaction) => {
        const clientRef = db.collection("users").doc(clientId);
        const clientSnapshot = await transaction.get(clientRef);
        if (!clientSnapshot.exists) throw createHttpError(404, "Client not found");

        const clientData = clientSnapshot.data() || {};
        if (getUserRole(clientData) !== "client") {
          throw createHttpError(409, "Only client accounts can be assigned");
        }

        let trainerData = {};
        if (trainerId) {
          if (trainerId === clientId) throw createHttpError(400, "Client cannot be assigned to self");
          const trainerSnapshot = await transaction.get(db.collection("users").doc(trainerId));
          if (!trainerSnapshot.exists) throw createHttpError(404, "Trainer not found");
          trainerData = trainerSnapshot.data() || {};
          assertAssignableTrainer(trainerData);
        }

        const previousTrainerId = getAssignedTrainerId(clientData);
        const assignmentUpdate = getTrainerAssignmentUpdate({
          trainerId,
          trainerData,
          actorUid: context.uid,
          now
        });
        transaction.set(clientRef, {
          ...assignmentUpdate,
          updatedAt: now
        }, { merge: true });

        if (previousTrainerId && previousTrainerId !== trainerId) {
          transaction.delete(
            db.collection("users").doc(previousTrainerId).collection("trainerClients").doc(clientId)
          );
        }
        if (trainerId) {
          transaction.set(
            db.collection("users").doc(trainerId).collection("trainerClients").doc(clientId),
            getTrainerClientMirrorPayload({ clientId, clientData, trainerId, trainerData, now }),
            { merge: true }
          );
        }

        const auditId = setAdminAuditEvent(transaction, db, context, {
          action: trainerId ? "client.assignment.changed" : "client.assignment.cleared",
          targetUid: clientId,
          details: { previousTrainerId, trainerId },
          now
        });

        return { previousTrainerId, auditId };
      });

      return json(res, 200, {
        ok: true,
        client: {
          id: clientId,
          trainerId,
          assignedTrainerId: trainerId,
          coachId: trainerId
        },
        previousTrainerId: result.previousTrainerId,
        auditId: result.auditId
      });
    } catch (error) {
      console.error("adminAssignClient error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const adminUpdateUserRole = onRequest(
  {
    cors: true,
    timeoutSeconds: 90,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      assertAdminContext(context);
      await enforceRateLimit(context.uid, "admin-update-user-role", {
        limit: 30,
        windowMs: 10 * 60 * 1000
      });

      const uid = normalizeAdminUserId(req.body?.uid, "uid");
      const nextRole = String(req.body?.role || "").trim().toLowerCase();
      const reassignClientsToUid = normalizeAdminUserId(
        req.body?.reassignClientsToUid,
        "reassignClientsToUid",
        { optional: true }
      );
      if (!["client", "trainer"].includes(nextRole)) {
        return json(res, 400, { ok: false, error: "Role must be client or trainer" });
      }
      if (uid === context.uid) {
        return json(res, 400, { ok: false, error: "Admin cannot change the active account role" });
      }

      const db = admin.firestore();
      const now = new Date().toISOString();
      const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(uid);
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw createHttpError(404, "User not found");
        const userData = userSnapshot.data() || {};
        const previousRole = getUserRole(userData);

        if (previousRole === "admin") {
          throw createHttpError(409, "Administrator roles cannot be changed here");
        }
        if (previousRole === nextRole) {
          return {
            unchanged: true,
            previousRole,
            reassignedClients: 0,
            auditId: "",
            user: getAdminLifecycleUserPayload(uid, userData)
          };
        }
        if (!((previousRole === "client" && nextRole === "trainer") ||
          (previousRole === "trainer" && nextRole === "client"))) {
          throw createHttpError(409, "Only client and trainer role transitions are supported");
        }

        if (nextRole === "trainer") {
          const previousTrainerId = getAssignedTrainerId(userData);
          transaction.set(userRef, {
            role: "trainer",
            trainerRoleUpdatedAt: now,
            ...getTrainerAssignmentUpdate({ actorUid: context.uid, now }),
            updatedAt: now
          }, { merge: true });
          if (previousTrainerId) {
            transaction.delete(
              db.collection("users").doc(previousTrainerId).collection("trainerClients").doc(uid)
            );
          }
          const auditId = setAdminAuditEvent(transaction, db, context, {
            action: "user.role.promoted-to-trainer",
            targetUid: uid,
            details: { previousRole, nextRole, previousTrainerId },
            now
          });
          return {
            previousRole,
            reassignedClients: 0,
            auditId,
            user: getAdminLifecycleUserPayload(uid, { ...userData, role: nextRole })
          };
        }

        const assignedClients = await getAssignedClientsForTrainer({
          db,
          trainerId: uid,
          transaction
        });
        if (assignedClients.length > MAX_ADMIN_ROLE_REASSIGNMENTS) {
          throw createHttpError(409, "Too many assigned clients for one atomic role change");
        }
        if (assignedClients.length && !reassignClientsToUid) {
          throw createHttpError(409, "Reassign assigned clients before changing this trainer to a client");
        }
        if (reassignClientsToUid === uid) {
          throw createHttpError(400, "Clients cannot be reassigned to the trainer being changed");
        }

        let destinationTrainerData = {};
        if (assignedClients.length) {
          const destinationSnapshot = await transaction.get(
            db.collection("users").doc(reassignClientsToUid)
          );
          if (!destinationSnapshot.exists) throw createHttpError(404, "Destination trainer not found");
          destinationTrainerData = destinationSnapshot.data() || {};
          // Both direct assignment and lifecycle reassignment require an
          // active trainer account. A pending invitation is allowed so a
          // client can be assigned before the trainer's first sign-in.
          assertAssignableTrainer(destinationTrainerData);
        }

        assignedClients.forEach(({ id: clientId, ref: clientRef, data: clientData }) => {
          transaction.set(clientRef, {
            ...getTrainerAssignmentUpdate({
              trainerId: reassignClientsToUid,
              trainerData: destinationTrainerData,
              actorUid: context.uid,
              now
            }),
            updatedAt: now
          }, { merge: true });
          transaction.delete(db.collection("users").doc(uid).collection("trainerClients").doc(clientId));
          transaction.set(
            db.collection("users").doc(reassignClientsToUid).collection("trainerClients").doc(clientId),
            getTrainerClientMirrorPayload({
              clientId,
              clientData,
              trainerId: reassignClientsToUid,
              trainerData: destinationTrainerData,
              now
            }),
            { merge: true }
          );
        });

        transaction.set(userRef, {
          role: "client",
          trainerRoleUpdatedAt: now,
          ...getTrainerAssignmentUpdate({ actorUid: context.uid, now }),
          updatedAt: now
        }, { merge: true });
        const auditId = setAdminAuditEvent(transaction, db, context, {
          action: "user.role.demoted-to-client",
          targetUid: uid,
          details: {
            previousRole,
            nextRole,
            reassignedClientCount: assignedClients.length,
            reassignClientsToUid: reassignClientsToUid || ""
          },
          now
        });
        return {
          previousRole,
          reassignedClients: assignedClients.length,
          auditId,
          user: getAdminLifecycleUserPayload(uid, { ...userData, role: nextRole })
        };
      });

      if (!result.unchanged) {
        try {
          await admin.auth().revokeRefreshTokens(uid);
        } catch (authError) {
          console.warn("adminUpdateUserRole could not revoke tokens:", authError?.code || authError?.message || authError);
        }
      }

      return json(res, 200, {
        ok: true,
        user: result.user,
        previousRole: result.previousRole,
        reassignedClients: result.reassignedClients,
        auditId: result.auditId,
        unchanged: result.unchanged === true
      });
    } catch (error) {
      console.error("adminUpdateUserRole error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const adminSetUserAccess = onRequest(
  {
    cors: true,
    timeoutSeconds: 90,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      assertAdminContext(context);
      await enforceRateLimit(context.uid, "admin-set-user-access", {
        limit: 30,
        windowMs: 10 * 60 * 1000
      });

      const uid = normalizeAdminUserId(req.body?.uid, "uid");
      const action = String(req.body?.action || "").trim().toLowerCase();
      if (!["suspend", "restore"].includes(action)) {
        return json(res, 400, { ok: false, error: "Action must be suspend or restore" });
      }
      if (uid === context.uid) {
        return json(res, 400, { ok: false, error: "Admin cannot change the active account access" });
      }

      const db = admin.firestore();
      if (action === "restore") {
        const beforeRestore = await db.collection("users").doc(uid).get();
        if (!beforeRestore.exists) return json(res, 404, { ok: false, error: "User not found" });
        const beforeRestoreData = beforeRestore.data() || {};
        if (getUserRole(beforeRestoreData) === "admin") {
          return json(res, 409, { ok: false, error: "Administrator access cannot be changed here" });
        }
        if (String(beforeRestoreData.membershipStatus || "").toLowerCase() === "revoked" ||
          String(beforeRestoreData.accountStatus || "").toLowerCase() === "revoked") {
          return json(res, 409, { ok: false, error: "Revoked accounts cannot be restored" });
        }
        // Enable the Auth account first. If the following Firestore transaction
        // fails, the membership document remains suspended and still blocks use.
        await admin.auth().updateUser(uid, { disabled: false });
      }

      const now = new Date().toISOString();
      const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(uid);
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw createHttpError(404, "User not found");
        const userData = userSnapshot.data() || {};
        const role = getUserRole(userData);
        if (role === "admin") throw createHttpError(409, "Administrator access cannot be changed here");

        if (action === "suspend" && role === "trainer") {
          const assignedClients = await getAssignedClientsForTrainer({ db, trainerId: uid, transaction });
          if (assignedClients.length) {
            throw createHttpError(409, "Reassign all clients before suspending this trainer");
          }
        }

        const beforeSuspend = userData.accessBeforeSuspend || {};
        const update = action === "suspend"
          ? {
              active: false,
              accessDisabled: true,
              membershipStatus: "suspended",
              accountStatus: "suspended",
              trainerInviteStatus: role === "trainer" ? "suspended" : userData.trainerInviteStatus || "",
              accessBeforeSuspend: {
                active: userData.active !== false,
                membershipStatus: String(userData.membershipStatus || "active"),
                accountStatus: String(userData.accountStatus || "active"),
                trainerInviteStatus: String(userData.trainerInviteStatus || "")
              },
              accessSuspendedAt: now,
              accessUpdatedAt: now,
              accessUpdatedByUid: context.uid,
              updatedAt: now
            }
          : {
              active: beforeSuspend.active !== false,
              accessDisabled: false,
              membershipStatus: ["revoked", "suspended"].includes(String(beforeSuspend.membershipStatus || "").toLowerCase())
                ? "active"
                : String(beforeSuspend.membershipStatus || "active"),
              accountStatus: String(beforeSuspend.accountStatus || "active") === "suspended"
                ? "active"
                : String(beforeSuspend.accountStatus || "active"),
              trainerInviteStatus: role === "trainer" && String(beforeSuspend.trainerInviteStatus || "")
                ? String(beforeSuspend.trainerInviteStatus)
                : userData.trainerInviteStatus || "",
              accessBeforeSuspend: admin.firestore.FieldValue.delete(),
              accessRestoredAt: now,
              accessUpdatedAt: now,
              accessUpdatedByUid: context.uid,
              updatedAt: now
            };

        transaction.set(userRef, update, { merge: true });
        const auditId = setAdminAuditEvent(transaction, db, context, {
          action: action === "suspend" ? "user.access.suspended" : "user.access.restored",
          targetUid: uid,
          details: { role },
          now
        });
        return {
          auditId,
          user: getAdminLifecycleUserPayload(uid, { ...userData, ...update })
        };
      });

      let authSynchronized = true;
      if (action === "suspend") {
        try {
          await admin.auth().updateUser(uid, { disabled: true });
          await admin.auth().revokeRefreshTokens(uid);
        } catch (authError) {
          authSynchronized = false;
          console.error("adminSetUserAccess auth suspension sync failed:", authError);
        }
      }

      return json(res, 200, {
        ok: true,
        user: result.user,
        auditId: result.auditId,
        authSynchronized
      });
    } catch (error) {
      console.error("adminSetUserAccess error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const adminManageTrainerInvite = onRequest(
  {
    cors: true,
    timeoutSeconds: 90,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      assertAdminContext(context);
      await enforceRateLimit(context.uid, "admin-manage-trainer-invite", {
        limit: 30,
        windowMs: 10 * 60 * 1000
      });

      const uid = normalizeAdminUserId(req.body?.uid, "uid");
      const action = String(req.body?.action || "").trim().toLowerCase();
      if (!["status", "resend", "revoke"].includes(action)) {
        return json(res, 400, { ok: false, error: "Action must be status, resend or revoke" });
      }

      const db = admin.firestore();
      const trainerRef = db.collection("users").doc(uid);
      const trainerSnapshot = await trainerRef.get();
      if (!trainerSnapshot.exists) return json(res, 404, { ok: false, error: "Trainer not found" });
      const trainerData = trainerSnapshot.data() || {};
      if (getUserRole(trainerData) !== "trainer") {
        return json(res, 409, { ok: false, error: "User is not a trainer" });
      }

      const state = await refreshTrainerInviteStatus({ db, trainerRef, trainerUid: uid, trainerData });
      if (action === "status") {
        return json(res, 200, {
          ok: true,
          invite: buildTrainerInviteApiPayload({ trainerUid: uid, trainerData, state })
        });
      }

      if (action === "resend") {
        if (state.status === "accepted") {
          return json(res, 409, { ok: false, error: "Trainer is already activated" });
        }
        if (["revoked", "suspended"].includes(state.status)) {
          return json(res, 409, { ok: false, error: "Trainer invitation is no longer active" });
        }

        const email = normalizeAccountEmail(trainerData.email || trainerData.accountProfile?.email);
        if (!email) return json(res, 409, { ok: false, error: "Trainer email is unavailable" });
        const appUrl = getWorkoutAppUrl();
        const inviteUrl = `${appUrl}?invite=${encodeURIComponent(email)}`;
        const activationUrl = await admin.auth().generatePasswordResetLink(email, { url: inviteUrl });
        const activationToken = crypto.randomBytes(18).toString("base64url");
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + TRAINER_INVITE_TTL_MS).toISOString();
        const invites = await getTrainerInviteLinks(db, uid, trainerData);
        const batch = db.batch();

        invites.forEach(({ ref, data }) => {
          const status = String(data.status || "active").trim().toLowerCase();
          if (!["used", "revoked", "superseded"].includes(status)) {
            batch.set(ref, {
              status: "superseded",
              supersededAt: now,
              supersededByUid: context.uid
            }, { merge: true });
          }
        });
        batch.set(db.collection("inviteLinks").doc(activationToken), {
          uid,
          activationUrl,
          email,
          login: normalizeLoginAlias(trainerData.loginLower || trainerData.accountProfile?.login),
          inviteId: email,
          inviteKind: "trainer",
          role: "trainer",
          createdByUid: context.uid,
          createdByEmail: normalizeAccountEmail(context.token?.email || context.userData?.email),
          createdAt: now,
          expiresAt,
          status: "active"
        });
        batch.set(trainerRef, {
          accountStatus: "invited",
          trainerInviteStatus: "active",
          trainerInviteLastSentAt: now,
          active: true,
          accessDisabled: false,
          membershipStatus: "active",
          updatedAt: now
        }, { merge: true });
        const auditId = setAdminAuditEvent(batch, db, context, {
          action: "trainer.invite.resent",
          targetUid: uid,
          details: { expiresAt },
          now
        });
        await batch.commit();

        return json(res, 200, {
          ok: true,
          invite: {
            uid,
            status: "pending",
            login: normalizeLoginAlias(trainerData.loginLower || trainerData.accountProfile?.login),
            expiresAt,
            shareUrl: `${appUrl}invite/${activationToken}`
          },
          auditId
        });
      }

      if (state.status === "accepted") {
        return json(res, 409, { ok: false, error: "Activated trainers must be suspended instead of revoked" });
      }
      const now = new Date().toISOString();
      const invites = await getTrainerInviteLinks(db, uid, trainerData);
      const revokeResult = await db.runTransaction(async (transaction) => {
        const currentTrainerSnapshot = await transaction.get(trainerRef);
        if (!currentTrainerSnapshot.exists) throw createHttpError(404, "Trainer not found");
        const currentTrainerData = currentTrainerSnapshot.data() || {};
        if (getUserRole(currentTrainerData) !== "trainer") throw createHttpError(409, "User is not a trainer");
        const assignedClients = await getAssignedClientsForTrainer({ db, trainerId: uid, transaction });
        if (assignedClients.length) {
          throw createHttpError(409, "Reassign all clients before revoking this trainer invitation");
        }

        invites.forEach(({ ref, data }) => {
          const status = String(data.status || "active").trim().toLowerCase();
          if (!["used", "revoked", "superseded"].includes(status)) {
            transaction.set(ref, { status: "revoked", revokedAt: now, revokedByUid: context.uid }, { merge: true });
          }
        });
        transaction.set(trainerRef, {
          active: false,
          accessDisabled: true,
          membershipStatus: "revoked",
          accountStatus: "revoked",
          trainerInviteStatus: "revoked",
          trainerInviteRevokedAt: now,
          updatedAt: now
        }, { merge: true });
        const auditId = setAdminAuditEvent(transaction, db, context, {
          action: "trainer.invite.revoked",
          targetUid: uid,
          details: {},
          now
        });
        return { auditId };
      });

      let authSynchronized = true;
      try {
        await admin.auth().updateUser(uid, { disabled: true });
        await admin.auth().revokeRefreshTokens(uid);
      } catch (authError) {
        authSynchronized = false;
        console.error("adminManageTrainerInvite auth revoke sync failed:", authError);
      }
      return json(res, 200, {
        ok: true,
        invite: { uid, status: "revoked", shareUrl: "", expiresAt: "" },
        auditId: revokeResult.auditId,
        authSynchronized
      });
    } catch (error) {
      console.error("adminManageTrainerInvite error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);

export const deleteUser = onRequest(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: "europe-west1"
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await requireActiveMember(req);
      assertAdminContext(context);
      await enforceRateLimit(context.uid, "admin-delete-user", {
        limit: 50,
        windowMs: 10 * 60 * 1000
      });

      const uid = String(req.body?.uid || "").trim();
      if (!uid) return json(res, 400, { ok: false, error: "uid is required" });
      if (uid === context.uid) return json(res, 400, { ok: false, error: "Admin cannot delete the active account" });

      const db = admin.firestore();
      const userRef = db.collection("users").doc(uid);
      const userSnapshot = await userRef.get();
      if (!userSnapshot.exists) return json(res, 404, { ok: false, error: "Client not found" });

      const userData = userSnapshot.data() || {};
      if (String(userData.role || "client") !== "client") {
        return json(res, 409, { ok: false, error: "Only client accounts can be deleted here" });
      }

      let authUser = null;
      try {
        authUser = await admin.auth().getUser(uid);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }

      const cleanupRefs = new Map();
      const addCleanupRef = (ref) => {
        if (ref?.path && ref.path !== userRef.path) cleanupRefs.set(ref.path, ref);
      };
      const emails = new Set([
        userData.email,
        authUser?.email
      ].map((value) => normalizeAccountEmail(value)).filter(Boolean));
      const logins = new Set([
        userData.loginLower,
        userData.accountProfile?.login
      ].map((value) => normalizeLoginAlias(value)).filter(Boolean));
      const trainerIds = new Set([
        userData.trainerId,
        userData.assignedTrainerId,
        userData.coachId,
        userData.createdByUid
      ].map((value) => String(value || "").trim()).filter(Boolean));

      const [loginAliasesSnapshot, clientInvitesSnapshot, ...inviteLinkSnapshots] = await Promise.all([
        db.collection("loginAliases").where("uid", "==", uid).get(),
        db.collection("clientInvites").where("authUid", "==", uid).get(),
        ...[...emails].map((email) => db.collection("inviteLinks").where("email", "==", email).get())
      ]);

      loginAliasesSnapshot.forEach((item) => addCleanupRef(item.ref));
      clientInvitesSnapshot.forEach((item) => addCleanupRef(item.ref));
      inviteLinkSnapshots.forEach((snapshot) => snapshot.forEach((item) => addCleanupRef(item.ref)));
      logins.forEach((login) => addCleanupRef(db.collection("loginAliases").doc(login)));
      emails.forEach((email) => addCleanupRef(db.collection("clientInvites").doc(email)));
      trainerIds.forEach((trainerId) => addCleanupRef(
        db.collection("users").doc(trainerId).collection("trainerClients").doc(uid)
      ));

      if (authUser) await admin.auth().deleteUser(uid);
      await db.recursiveDelete(userRef);
      await Promise.all([...cleanupRefs.values()].map((ref) => ref.delete()));

      return json(res, 200, { ok: true, uid, cleanupCount: cleanupRefs.size });
    } catch (error) {
      console.error("deleteUser error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message });
    }
  }
);
function normalizeVoiceFoodMealId(value) {
  const mealId = String(value || "").trim().toLowerCase();
  return ["breakfast", "lunch", "dinner", "snack", "auto"].includes(mealId) ? mealId : "auto";
}

function normalizeVoiceTranscript(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_AI_VOICE_TRANSCRIPT_LENGTH);
}

function hasVoiceExplicitMetricAmount(transcript) {
  const normalizedTranscript = normalizeVoiceTranscript(transcript).toLowerCase();
  return VOICE_EXPLICIT_METRIC_AMOUNT_PATTERN.test(normalizedTranscript) ||
    VOICE_SPOKEN_METRIC_AMOUNT_PATTERN.test(normalizedTranscript);
}

function normalizeVoiceAudioMimeType(value) {
  const mimeType = String(value || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return Object.hasOwn(VOICE_AUDIO_MIME_EXTENSIONS, mimeType) ? mimeType : "";
}

function decodeVoiceAudioBase64(value) {
  const base64 = String(value || "").trim();
  if (!base64) {
    throw createHttpError(400, "Missing voice audio");
  }
  if (base64.length > MAX_AI_VOICE_AUDIO_BASE64_LENGTH) {
    throw createHttpError(413, "Voice audio is too large");
  }
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) ||
    base64.length % 4 === 1 ||
    (base64.includes("=") && base64.length % 4 !== 0)
  ) {
    throw createHttpError(400, "Invalid voice audio encoding");
  }

  const paddingLength = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const expectedByteLength = Math.floor((base64.length * 3) / 4) - paddingLength;
  if (expectedByteLength <= 0) {
    throw createHttpError(400, "Invalid voice audio encoding");
  }
  if (expectedByteLength > MAX_AI_VOICE_AUDIO_BYTES) {
    throw createHttpError(413, "Voice audio is too large");
  }

  const audio = Buffer.from(base64, "base64");
  if (!audio.length || audio.length !== expectedByteLength || audio.length > MAX_AI_VOICE_AUDIO_BYTES) {
    throw createHttpError(400, "Invalid voice audio encoding");
  }
  return audio;
}

async function transcribeVoiceAudio({ audioBase64, audioMimeType, apiKey }) {
  const mimeType = normalizeVoiceAudioMimeType(audioMimeType);
  if (!mimeType) {
    throw createHttpError(415, "Unsupported voice audio type");
  }

  const audio = decodeVoiceAudioBase64(audioBase64);
  const formData = new FormData();
  formData.set("model", "gpt-4o-mini-transcribe");
  formData.set("language", "ru");
  formData.set(
    "file",
    new Blob([audio], { type: mimeType }),
    `voice-entry.${VOICE_AUDIO_MIME_EXTENSIONS[mimeType]}`
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    console.error("OpenAI aiFoodVoice transcription error:", response.status);
    throw createHttpError(502, "Voice transcription failed");
  }

  const data = await response.json().catch(() => null);
  const transcript = normalizeVoiceTranscript(data?.text);
  if (transcript.length < 2) {
    throw createHttpError(422, "Voice transcription is empty");
  }
  return transcript;
}

function normalizeVoiceEstimatedNutritionValue(value, max) {
  const numericValue = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > max) return null;
  return Math.round(numericValue * 10) / 10;
}

function normalizeVoiceEstimatedNutritionPer100g(value) {
  const calories = normalizeVoiceEstimatedNutritionValue(value?.calories, MAX_AI_VOICE_ESTIMATE_CALORIES);
  const protein = normalizeVoiceEstimatedNutritionValue(value?.protein, MAX_AI_VOICE_ESTIMATE_MACRO);
  const fat = normalizeVoiceEstimatedNutritionValue(value?.fat, MAX_AI_VOICE_ESTIMATE_MACRO);
  const carbs = normalizeVoiceEstimatedNutritionValue(value?.carbs, MAX_AI_VOICE_ESTIMATE_MACRO);

  if (calories === null || calories <= 0 || protein === null || fat === null || carbs === null) {
    return null;
  }

  return { calories, protein, fat, carbs };
}

function normalizeVoiceFoodItems(items, {
  metricAmounts = [],
  hasSpokenMetricAmount = false,
  transcript = ""
} = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const unsafeFoodStems = getUnsafeVoiceFoodStems(transcript);
  const resolvedAmounts = resolveVoiceFoodMetricAmounts(sourceItems, {
    metricAmounts,
    hasSpokenMetricAmount
  });

  return sourceItems
    .map((item, itemIndex) => {
      const query = String(item?.query || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      const resolvedAmount = resolvedAmounts[itemIndex] || { grams: 0, amountEstimated: true };

      return {
        query,
        grams: resolvedAmount.grams,
        mealId: normalizeVoiceFoodMealId(item?.mealId),
        amountEstimated: resolvedAmount.amountEstimated,
        estimatedNutritionPer100g: normalizeVoiceEstimatedNutritionPer100g(item?.estimatedNutritionPer100g)
      };
    })
    .filter((item) => item.query.length >= 2 && !isUnsafeVoiceFoodQuery(item.query, unsafeFoodStems))
    .slice(0, 6);
}

export const aiFoodVoice = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 90,
    secrets: [OPENAI_API_KEY],
    cors: true
  },
  async (req, res) => {
    const apiVersion = "aiFoodVoice-v6";
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed", apiVersion });

    try {
      const context = await requireActiveMember(req);
      await enforceRateLimit(context.uid, "ai-food-voice", {
        limit: 20,
        windowMs: 10 * 60 * 1000
      });
      await enforceRateLimit(context.uid, "ai-food-voice-daily", {
        limit: 100,
        windowMs: 24 * 60 * 60 * 1000
      });

      let transcript = normalizeVoiceTranscript(req.body?.transcript);
      const hasAudioFallback = transcript.length < 2;
      if (hasAudioFallback && !String(req.body?.audioBase64 || "").trim()) {
        return json(res, 400, { ok: false, error: "Missing transcript or voice audio", apiVersion });
      }

      const apiKey = OPENAI_API_KEY.value();
      if (!apiKey) {
        return json(res, 500, { ok: false, error: "OPENAI_API_KEY is not configured", apiVersion });
      }

      if (hasAudioFallback) {
        transcript = await transcribeVoiceAudio({
          audioBase64: req.body?.audioBase64,
          audioMimeType: req.body?.audioMimeType,
          apiKey
        });
      }

      const systemPrompt = [
        "You extract food-diary structure from a short spoken Russian food entry.",
        "Return only foods that the speaker clearly says they ate or drank.",
        "The client first resolves each query against an exact source-backed catalog product. When there is no exact catalog product, it uses estimatedNutritionPer100g only as a clearly labelled AI estimate.",
        "For every returned item, provide estimatedNutritionPer100g as a conservative per-100 g approximation of the closest ordinary food or dish. This is not a claim about a specific brand, recipe, barcode, or source.",
        "Each query must be a concise Russian food or exact brand/product phrase suitable for catalog search. Correct obvious speech-to-text spelling or word-boundary errors when the intended food is clear, and preserve a spoken brand when it is clear.",
        "Never turn an inedible, spoiled, impossible, or nonsensical phrase into an ordinary food by dropping its important word. For example, 'каменная курица' and 'гнилая курица' must produce no chicken item at all. Keep other clearly valid foods from the same phrase, if any.",
        "Canonicalize the common Russian variants 'флетуайт', 'флет уйт', and 'флетуйт' as 'флэт уайт'.",
        "Keep a composed dish, a food with a topping/filling/flavour, and a named coffee drink as one item. For example, 'сырники с клюквой' must be one query 'сырники с клюквой', never separate 'сырники' and 'клюква'. An ordinary dish and a separately drunk beverage are always separate items, even when Russian speech joins them with 'с': 'омлет с кофе' means exactly two items, 'омлет' and 'кофе'. Do not split a single beverage such as 'кофе с молоком'. Do not invent ingredients that were not said.",
        "Use mealId breakfast, lunch, dinner, or snack only when the speaker explicitly states the meal; otherwise use auto.",
        "Use grams exactly only when the speaker explicitly gives a numeric amount in grams or millilitres. Attach that amount to the same food only: 'флэт уайт 500 мл' is one item with grams=500 and amountEstimated=false. Never move an amount to another food or invent/default to 100 g. If the amount is absent or only a vague household measure, set grams=0 and amountEstimated=true; the client applies a product-specific average portion.",
        "Return no more than 6 items. If no food is clear, return an empty array.",
        "Return JSON only."
      ].join("\n");

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemPrompt }]
            },
            {
              role: "user",
              content: [{ type: "input_text", text: `Spoken entry: ${JSON.stringify(transcript)}` }]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "voice_food_entry",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        query: { type: "string" },
                        grams: { type: "number" },
                        mealId: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack", "auto"] },
                        amountEstimated: { type: "boolean" },
                        estimatedNutritionPer100g: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            calories: { type: "number" },
                            protein: { type: "number" },
                            fat: { type: "number" },
                            carbs: { type: "number" }
                          },
                          required: ["calories", "protein", "fat", "carbs"]
                        }
                      },
                      required: ["query", "grams", "mealId", "amountEstimated", "estimatedNutritionPer100g"]
                    }
                  }
                },
                required: ["items"]
              }
            }
          },
          max_output_tokens: 700
        })
      });

      const raw = await openAiResponse.text();
      if (!openAiResponse.ok) {
        console.error("OpenAI aiFoodVoice error:", openAiResponse.status);
        return json(res, 502, {
          ok: false,
          error: "openai_voice_analysis_failed",
          message: "ИИ сейчас не смог разобрать голосовую запись.",
          apiVersion
        });
      }

      let parsed = null;
      try {
        const responseData = JSON.parse(raw);
        const outputText = responseData.output_text
          || responseData.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text
          || "";
        parsed = JSON.parse(outputText);
      } catch (error) {
        console.error("aiFoodVoice parse error:", error);
        return json(res, 502, {
          ok: false,
          error: "ai_voice_response_parse_failed",
          message: "ИИ вернул неполный разбор записи. Попробуйте ещё раз.",
          apiVersion
        });
      }

      return json(res, 200, {
        ok: true,
        apiVersion,
        items: normalizeVoiceFoodItems(parsed?.items, {
          metricAmounts: extractVoiceMetricAmounts(transcript),
          hasSpokenMetricAmount: hasVoiceExplicitMetricAmount(transcript),
          transcript
        })
      });
    } catch (error) {
      console.error("aiFoodVoice fatal error:", error);
      const status = getHttpErrorStatus(error);
      return json(res, status, {
        ok: false,
        error: error.message || String(error),
        message: status === 422
          ? "Не удалось распознать речь. Удерживайте кнопку и говорите немного дольше."
          : "Не удалось обработать голосовую запись.",
        apiVersion
      });
    }
  }
);


export const aiFoodPhoto = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: [OPENAI_API_KEY],
    cors: true
  },
  async (req, res) => {
    const apiVersion = "aiFoodPhoto-v7";
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed", apiVersion });

    try {
      const context = await requireActiveMember(req);
      await enforceRateLimit(context.uid, "ai-food-photo", {
        limit: 10,
        windowMs: 10 * 60 * 1000
      });
      await enforceRateLimit(context.uid, "ai-food-photo-daily", {
        limit: 40,
        windowMs: 24 * 60 * 60 * 1000
      });

      const { imageData, mimeType = "image/jpeg", fileName = "food-photo" } = req.body || {};

      if (!imageData || typeof imageData !== "string") {
        return json(res, 400, { ok: false, error: "Missing imageData", apiVersion });
      }
      if (imageData.length > MAX_AI_IMAGE_DATA_LENGTH) {
        return json(res, 413, { ok: false, error: "Image payload is too large", apiVersion });
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(String(mimeType).toLowerCase())) {
        return json(res, 415, { ok: false, error: "Unsupported image type", apiVersion });
      }

      const cleanImageData = imageData.includes(",") ? imageData.split(",").pop() : imageData;
      const imageUrl = imageData.startsWith("data:")
        ? imageData
        : `data:${String(mimeType).toLowerCase()};base64,${cleanImageData}`;
      const apiKey = OPENAI_API_KEY.value();

      if (!apiKey) {
        return json(res, 500, { ok: false, error: "OPENAI_API_KEY is not configured", apiVersion });
      }

      const systemPrompt = [
        "You are a precise food-package, barcode, and nutrition-label recognition system for a fitness app.",
        "First decide whether a full barcode or a readable food-package label is visible. This endpoint verifies packaged products; it does not estimate meals from appearance.",
        "Furniture, people, animals, household objects, loose produce, plated meals and unclear packages must return isFood=false and ok=false unless a full barcode or readable label is visible.",
        "For a package, inspect evidence in this order: full barcode, visible brand, exact product name, flavour or variant, then the nutrition label.",
        "Return barcode only when every digit of an 8-14 digit code is clearly visible. Copy digits exactly; never invent, repair, or complete a barcode. Otherwise return an empty string.",
        "If readable package text is visible, preserve the exact distinguishing words. Never replace a visible product or flavour with a generic category such as yogurt, cheese, bar, or drink.",
        "If a readable package nutrition label is visible, extract its exact label data. Never estimate nutrition from a photo.",
        "Package text and the barcode have priority over common products and database-like guesses.",
        "Return the exact visible product name without translating, shortening, or completing it. Keep the brand in the separate brand field.",
        "Do not use filler words such as Homemade, Fresh, Traditional or long descriptions.",
        "Do not add a brand unless it is clearly visible in the photo.",
        "If the product is TEOS Greek yogurt with cereals and flax fiber, return that exact product meaning, not plain Greek yogurt.",
        "Nutrition values from the label are the highest priority. Only call a result label data when a readable nutrition label was actually visible.",
        "Always return calories/protein/fat/carbs per 100 grams only when they are legible on the nutrition label. Never estimate or calculate missing values.",
        "Never return 0 unless that nutrient is truly zero on the label.",
        "Use matchConfidence=exact only when the barcode is fully readable or the brand plus exact product and variant are readable. Use partial when only part of a package is readable, and uncertain when the product cannot be identified reliably.",
        "If a full barcode is readable but no nutrition label is readable, return its digits, use empty name/query and zero nutrition values. The app will search its verified catalog.",
        "If neither a full barcode nor a readable nutrition label with exact product text is present, return ok=false, an empty name and zero nutrition values.",
        "Never invent a product when the image is unclear or does not contain food.",
        "For a package or label use its visible serving/net weight or 100 g basis. If unsure return 100.",
        "If you can read text partially, preserve the exact visible words instead of simplifying.",
        "Return JSON only."
      ].join("\n");

      const userPrompt = [
        "Analyze a food package, barcode, or nutrition label photo.",
        "Return data only when it is directly readable from the photo; do not create an estimated food draft.",
        "For packages: read the barcode first if it is visible, then the exact brand, product and variant. A barcode with one unclear digit must be returned as an empty string.",
        "For labels: extract the visible brand, exact short product name and KBJU.",
        "For loose food or plated dishes without a readable label/barcode, return ok=false and no estimated values.",
        "Prefer OCR label values. Do not replace visible package data with a generic database item.",
        "Return this JSON shape:",
        "{",
        '  "ok": true if food is identified, otherwise false,',
        '  "isFood": true only for edible food, drink, food package or nutrition label,',
        '  "name": "exact short visible product name or empty string",',
        '  "brand": "brand if visible",',
        '  "query": "search/exact product query",',
        '  "barcode": "full visible 8-14 digit barcode or empty string",',
        '  "matchConfidence": "exact|partial|uncertain",',
        '  "calories": number_per_100g,',
        '  "protein": number_per_100g,',
        '  "fat": number_per_100g,',
        '  "carbs": number_per_100g,',
        '  "estimatedGrams": visible_serving_weight_in_grams_or_100,',
        '  "portion": "100 г",',
        '  "servingSize": "visible serving size if any",',
        '  "ingredients": ["visible important additives/flavor"],',
        '  "detectedIngredients": ["visible important additives/flavor"],',
        '  "confidence": "high|medium|low",',
        '  "evidenceType": "label" only for a readable nutrition label, otherwise "estimate",',
        '  "labelText": "short exact nutrition-label text or empty string",',
        '  "candidates": [',
        '    {"name":"same exact product", "brand":"brand if visible", "portion":"100 г", "source":"label"}',
        "  ]",
        "}"
      ].join("\n");

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemPrompt }]
            },
            {
              role: "user",
              content: [
                { type: "input_text", text: `${userPrompt}\nFile name: ${fileName}` },
                { type: "input_image", image_url: imageUrl, detail: "high" }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "food_label_ocr",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  ok: { type: "boolean" },
                  isFood: { type: "boolean" },
                  name: { type: "string" },
                  brand: { type: "string" },
                  query: { type: "string" },
                  barcode: { type: "string" },
                  matchConfidence: { type: "string", enum: ["exact", "partial", "uncertain"] },
                  calories: { type: "number" },
                  protein: { type: "number" },
                  fat: { type: "number" },
                  carbs: { type: "number" },
                  estimatedGrams: { type: "number" },
                  portion: { type: "string" },
                  servingSize: { type: "string" },
                  ingredients: { type: "array", items: { type: "string" } },
                  detectedIngredients: { type: "array", items: { type: "string" } },
                  confidence: { type: "string" },
                  evidenceType: { type: "string", enum: ["label", "estimate"] },
                  labelText: { type: "string" },
                  candidates: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        brand: { type: "string" },
                        calories: { type: "number" },
                        protein: { type: "number" },
                        fat: { type: "number" },
                        carbs: { type: "number" },
                        estimatedGrams: { type: "number" },
                        portion: { type: "string" },
                        source: { type: "string" }
                      },
                      required: ["name", "brand", "calories", "protein", "fat", "carbs", "estimatedGrams", "portion", "source"]
                    }
                  }
                },
                required: ["ok", "isFood", "name", "brand", "query", "barcode", "matchConfidence", "calories", "protein", "fat", "carbs", "estimatedGrams", "portion", "servingSize", "ingredients", "detectedIngredients", "confidence", "evidenceType", "labelText", "candidates"]
              }
            }
          },
          max_output_tokens: 1200
        })
      });

      const raw = await openAiResponse.text();

      if (!openAiResponse.ok) {
        console.error("OpenAI aiFoodPhoto error:", raw);
        return json(res, 500, { ok: false, error: "OpenAI request failed", details: raw.slice(0, 800), apiVersion });
      }

      let parsed = null;

      try {
        const responseData = JSON.parse(raw);
        const outputText = responseData.output_text
          || responseData.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text
          || "";
        parsed = JSON.parse(outputText);
      } catch (error) {
        console.error("aiFoodPhoto parse error:", error, raw);
        return json(res, 500, { ok: false, error: "AI response parse failed", apiVersion });
      }

      const normalizeText = (value = "") => String(value || "").trim();
      const getPositiveNumber = (primary, defaultValue = 0) => {
        const primaryNumber = Number(primary);
        if (Number.isFinite(primaryNumber) && primaryNumber > 0) return primaryNumber;
        return defaultValue;
      };

      const normalizeBarcode = (value = "") => {
        const barcode = String(value || "").replace(/\D/g, "");
        return /^\d{8,14}$/.test(barcode) && !/^(\d)\1+$/.test(barcode) ? barcode : "";
      };
      const name = normalizeText(parsed.name);
      const query = normalizeText(parsed.query || parsed.name);
      const brand = normalizeText(parsed.brand);
      const barcode = normalizeBarcode(parsed.barcode);
      const matchConfidence = ["exact", "partial", "uncertain"].includes(parsed.matchConfidence)
        ? parsed.matchConfidence
        : "uncertain";
      const detectedIngredients = Array.isArray(parsed.detectedIngredients)
        ? parsed.detectedIngredients
        : Array.isArray(parsed.ingredients)
          ? parsed.ingredients
          : [];

      const estimatedGrams = getPositiveNumber(parsed.estimatedGrams, 100);
      const normalizedProductName = String(name || query || "").trim().toLowerCase();
      const rejectedNames = new Set([
        "продукт не найден",
        "не найдено",
        "неизвестный продукт",
        "продукт по фото",
        "food not found",
        "unknown product"
      ]);
      const labelText = normalizeText(parsed.labelText);
      const labelEvidenceIsReadable = parsed.evidenceType === "label"
        && labelText.length >= 8
        && /\d/.test(labelText);
      const recognizedLabel = parsed.ok !== false
        && parsed.isFood === true
        && Boolean(normalizedProductName)
        && ![...rejectedNames].some((rejectedName) => normalizedProductName.includes(rejectedName))
        && parsed.matchConfidence === "exact"
        && String(parsed.confidence || "").toLowerCase() === "high"
        && labelEvidenceIsReadable;
      const recognizedFood = Boolean(barcode) || recognizedLabel;
      const calories = getPositiveNumber(parsed.calories, 0);
      const protein = getPositiveNumber(parsed.protein, 0);
      const fat = getPositiveNumber(parsed.fat, 0);
      const carbs = getPositiveNumber(parsed.carbs, 0);

      const hasNutrition = calories > 0 && (protein > 0 || fat > 0 || carbs > 0);
      const hasVerifiedLabel = recognizedLabel && hasNutrition;

      if (!recognizedFood || (!barcode && !hasVerifiedLabel)) {
        return json(res, 200, {
          ok: true,
          found: false,
          isFood: recognizedFood,
          apiVersion,
          product: null,
          message: recognizedFood
            ? "Не удалось надёжно определить КБЖУ по фото. Попробуйте сделать фото этикетки или добавьте продукт вручную."
            : "Продукт на фото не найден."
        });
      }

      const productName = hasVerifiedLabel ? (name || query) : "";
      const evidenceType = hasVerifiedLabel ? "label" : "barcode";
      const product = {
        name: productName,
        query: query || productName,
        brand,
        barcode,
        matchConfidence,
        calories: hasVerifiedLabel ? calories : 0,
        protein: hasVerifiedLabel ? protein : 0,
        fat: hasVerifiedLabel ? fat : 0,
        carbs: hasVerifiedLabel ? carbs : 0,
        estimatedGrams,
        portion: parsed.portion || "100 г",
        portionAmount: 100,
        source: evidenceType === "label" ? "Данные с этикетки" : "Штрихкод",
        sourceType: evidenceType === "label" ? "ai_photo_label" : "barcode",
        evidenceType,
        labelText: hasVerifiedLabel ? labelText : "",
        requiresReview: evidenceType === "label",
        confidence: hasVerifiedLabel ? "high" : "high"
      };

      return json(res, 200, {
        ok: true,
        found: true,
        isFood: true,
        apiVersion,
        product,
        name: product.name,
        query: product.query,
        brand,
        barcode,
        matchConfidence,
        calories: product.calories,
        protein: product.protein,
        fat: product.fat,
        carbs: product.carbs,
        estimatedGrams,
        portion: product.portion,
        servingSize: parsed.servingSize || "",
        labelText,
        evidenceType,
        ingredients: detectedIngredients,
        detectedIngredients,
        confidence: parsed.confidence || "medium",
        candidates: [product]
      });
    } catch (error) {
      console.error("aiFoodPhoto fatal error:", error);
      return json(res, getHttpErrorStatus(error), { ok: false, error: error.message || String(error), apiVersion });
    }
  }
);
