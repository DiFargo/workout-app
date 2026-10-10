import crypto from "node:crypto";
import admin from "firebase-admin";
import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { canBootstrapTelegramTestAccount, verifyTelegramMiniAppInitData } from "./telegramMiniAppAuth.js";

admin.initializeApp();

const TELEGRAM_MINI_APP_BOT_TOKEN = defineSecret("TELEGRAM_MINI_APP_BOT_TOKEN");
const APP_CHECK_ENFORCED = defineBoolean("APP_CHECK_ENFORCED", { default: false });
const ALLOW_STAGING_TEST_ACCOUNT_BOOTSTRAP = defineBoolean("ALLOW_STAGING_TEST_ACCOUNT_BOOTSTRAP", { default: false });
const STAGING_TEST_ACCOUNT_EMAIL = defineString("STAGING_TEST_ACCOUNT_EMAIL", { default: "" });
const STAGING_TEST_TELEGRAM_ID = defineString("STAGING_TEST_TELEGRAM_ID", { default: "" });

function json(res, status, body) {
  return res.status(status).json(body);
}

async function verifyAppCheckRequest(req) {
  const token = String(req.get?.("X-Firebase-AppCheck") || req.headers?.["x-firebase-appcheck"] || "").trim();
  if (!token) {
    if (APP_CHECK_ENFORCED.value()) {
      const error = new Error("Firebase App Check token is required");
      error.status = 401;
      throw error;
    }
    return null;
  }

  try {
    return await admin.appCheck().verifyToken(token);
  } catch (error) {
    if (APP_CHECK_ENFORCED.value()) {
      const invalidTokenError = new Error("Invalid Firebase App Check token");
      invalidTokenError.status = 401;
      throw invalidTokenError;
    }
    console.warn("Ignoring invalid App Check token while enforcement is disabled:", error?.code || "unknown");
    return null;
  }
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

async function findTelegramLinkedAccounts(telegramUserId) {
  const id = String(telegramUserId || "").trim();
  if (!/^\d{1,16}$/.test(id)) return [];

  const users = admin.firestore().collection("users");
  const [topLevel, nested] = await Promise.all([
    users.where("telegramUserId", "==", id).limit(3).get(),
    users.where("telegram.telegramUserId", "==", id).limit(3).get()
  ]);
  const matches = new Map();
  for (const snapshot of [topLevel, nested]) {
    for (const document of snapshot.docs) {
      matches.set(document.id, { uid: document.id, data: document.data() || {} });
    }
  }
  return [...matches.values()];
}

async function provisionStagingTestAccount(telegramUser) {
  const email = STAGING_TEST_ACCOUNT_EMAIL.value().trim().toLowerCase();
  if (!canBootstrapTelegramTestAccount({
    enabled: ALLOW_STAGING_TEST_ACCOUNT_BOOTSTRAP.value(),
    configuredEmail: email,
    configuredTelegramId: STAGING_TEST_TELEGRAM_ID.value(),
    telegramId: telegramUser.id,
    linkedAccountCount: 0
  })) {
    return null;
  }

  const uid = `telegram_test_${crypto
    .createHash("sha256")
    .update(telegramUser.id)
    .digest("hex")
    .slice(0, 24)}`;
  const db = admin.firestore();
  const markerRef = db.collection("system").doc("telegramMiniAppStagingTestAccount");
  const userRef = db.collection("users").doc(uid);
  let existingAuthUser;
  try {
    existingAuthUser = await admin.auth().getUser(uid);
    if (existingAuthUser.email?.toLowerCase() !== email) return null;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    try {
      const emailOwner = await admin.auth().getUserByEmail(email);
      if (emailOwner.uid !== uid) return null;
      existingAuthUser = emailOwner;
    } catch (emailError) {
      if (emailError?.code !== "auth/user-not-found") throw emailError;
    }
  }

  if (!existingAuthUser) {
    try {
      existingAuthUser = await admin.auth().createUser({
        uid,
        email,
        emailVerified: false,
        displayName: [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ") || "Telegram user",
        password: crypto.randomBytes(32).toString("base64url")
      });
    } catch (error) {
      if (error?.code === "auth/email-already-exists" || error?.code === "auth/uid-already-exists") return null;
      throw error;
    }
  }

  try {
    await db.runTransaction(async (transaction) => {
      const [marker, profile] = await Promise.all([
        transaction.get(markerRef),
        transaction.get(userRef)
      ]);
      const markerData = marker.data() || {};
      if (marker.exists && (
        markerData.uid !== uid ||
        markerData.email !== email ||
        markerData.telegramUserId !== telegramUser.id
      )) {
        throw Object.assign(new Error("staging test account already provisioned"), { code: "test-account-provisioned" });
      }
      if (profile.exists && (
        String(profile.get("email") || "").trim().toLowerCase() !== email ||
        String(profile.get("telegramUserId") || "") !== telegramUser.id
      )) {
        throw Object.assign(new Error("staging profile conflict"), { code: "test-account-profile-conflict" });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      if (!profile.exists) {
        transaction.create(userRef, {
          email,
          name: existingAuthUser.displayName || "Telegram user",
          role: "client",
          active: true,
          telegramUserId: telegramUser.id,
          telegramUsername: telegramUser.username || "",
          telegramDisplayName: [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" "),
          telegramConnected: true,
          telegramNotificationsEnabled: false,
          authProvider: "telegram_mini_app_staging_test",
          createdAt: now,
          updatedAt: now,
          telegramLinkedAt: now
        });
      }
      if (!marker.exists) {
        transaction.create(markerRef, {
          uid,
          email,
          telegramUserId: telegramUser.id,
          createdAt: now
        });
      }
    });
  } catch (error) {
    if (error?.code === "test-account-provisioned" || error?.code === "test-account-profile-conflict") return null;
    throw error;
  }

  return { uid, data: { role: "client", active: true, telegramUserId: telegramUser.id } };
}

export const telegramMiniAppLogin = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 15,
    maxInstances: 20,
    secrets: [TELEGRAM_MINI_APP_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });

    let failureStage = "app-check";
    try {
      await verifyAppCheckRequest(req);
      const initData = String(req.body?.initData || "");
      const telegramUser = verifyTelegramMiniAppInitData(initData, TELEGRAM_MINI_APP_BOT_TOKEN.value());
      if (!telegramUser) return json(res, 401, { ok: false, error: "telegram-signature-invalid" });

      failureStage = "lookup-telegram-account";
      const linkedAccounts = await findTelegramLinkedAccounts(telegramUser.id);
      if (linkedAccounts.length === 0) {
        failureStage = "provision-staging-test-account";
        const provisionedAccount = await provisionStagingTestAccount(telegramUser);
        if (provisionedAccount) linkedAccounts.push(provisionedAccount);
      }
      if (linkedAccounts.length === 0) {
        return json(res, 404, { ok: false, error: "telegram-not-linked" });
      }
      if (linkedAccounts.length !== 1) {
        return json(res, 409, { ok: false, error: "telegram-link-conflict" });
      }

      const linkedAccount = linkedAccounts[0];
      if (!isActiveMemberData(linkedAccount.data)) {
        return json(res, 403, { ok: false, error: "telegram-account-disabled" });
      }

      let authUser;
      try {
        failureStage = "read-firebase-auth-user";
        authUser = await admin.auth().getUser(linkedAccount.uid);
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          return json(res, 403, { ok: false, error: "telegram-account-disabled" });
        }
        throw error;
      }
      if (authUser.disabled) {
        return json(res, 403, { ok: false, error: "telegram-account-disabled" });
      }

      failureStage = "create-firebase-custom-token";
      const customToken = await admin.auth().createCustomToken(linkedAccount.uid);
      return json(res, 200, { ok: true, customToken });
    } catch (error) {
      console.error("telegramMiniAppLogin error:", JSON.stringify({
        stage: failureStage,
        code: error?.code || "unknown"
      }));
      const status = error?.status || 500;
      return json(res, status >= 400 && status < 600 ? status : 500, {
        ok: false,
        error: status === 401 ? "app-check-required" : "telegram-login-unavailable"
      });
    }
  }
);
