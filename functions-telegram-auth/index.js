import crypto from "node:crypto";
import admin from "firebase-admin";
import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { canBootstrapTelegramTestAccount, verifyTelegramMiniAppInitData } from "./telegramMiniAppAuth.js";
import { getTelegramInviteAcceptanceError } from "./telegramInviteAcceptance.js";
import { getPendingTelegramInviteToken } from "./telegramPendingInvite.js";

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

async function resolveTrustedTelegramAccount(telegramUser, linkedAccounts) {
  const db = admin.firestore();
  const id = String(telegramUser.id);
  const identityRef = db.collection("telegramIdentities").doc(id);
  const identity = await identityRef.get();
  const canonicalUid = String(identity.data()?.uid || "");
  if (canonicalUid) {
    const account = linkedAccounts.find(candidate => candidate.uid === canonicalUid);
    if (account) return account;
    const deletion = await db.collection("accountDeletions").doc(canonicalUid).get();
    if (deletion.data()?.status === "completed") return null;
    throw Object.assign(new Error("Telegram binding is unavailable"), { code: "telegram-link-conflict" });
  }
  if (!linkedAccounts.length) return null;
  if (linkedAccounts.length !== 1) {
    throw Object.assign(new Error("Ambiguous Telegram binding"), { code: "telegram-link-conflict" });
  }
  const account = linkedAccounts[0];
  const deterministicUid = `telegram_${crypto.createHash("sha256").update(id).digest("hex").slice(0, 24)}`;
  // A trainer could historically forge arbitrary client profile metadata, but
  // not staff roles or the server-created deterministic Auth UID. Other legacy
  // clients must prove the binding again through an authenticated link/invite.
  if (!["admin", "trainer"].includes(account.data.role) && account.uid !== deterministicUid) {
    throw Object.assign(new Error("Sign in with your existing credentials and reconnect Telegram"), { code: "auth/telegram-relink-required" });
  }
  if (!isActiveMemberData(account.data)) return account;
  await db.runTransaction(async transaction => {
    const userRef = db.collection("users").doc(account.uid);
    const [profile, currentIdentity, deletion] = await Promise.all([
      transaction.get(userRef), transaction.get(identityRef),
      transaction.get(db.collection("accountDeletions").doc(account.uid))
    ]);
    const current = profile.data() || {};
    if (!profile.exists || !isActiveMemberData(current) ||
      ["pending", "completed"].includes(deletion.data()?.status) ||
      ![current.telegramUserId, current.telegram?.telegramUserId].some(value => String(value || "") === id) ||
      (!["admin", "trainer"].includes(current.role) && account.uid !== deterministicUid) ||
      (currentIdentity.exists && String(currentIdentity.data()?.uid || "") !== account.uid)) {
      throw Object.assign(new Error("Telegram binding changed"), { code: "telegram-link-conflict" });
    }
    transaction.set(identityRef, { uid: account.uid, telegramUserId: id, updatedAt: new Date().toISOString() }, { merge: true });
  });
  return account;
}

async function provisionOpenTelegramAccount(telegramUser) {
  const telegramUserId = String(telegramUser?.id || "").trim();
  if (!/^\d{1,16}$/.test(telegramUserId)) throw Object.assign(new Error("invalid telegram id"), { code: "telegram-signature-invalid" });

  const db = admin.firestore();
  const uid = `telegram_${crypto.createHash("sha256").update(telegramUserId).digest("hex").slice(0, 24)}`;
  const userRef = db.collection("users").doc(uid);
  const identityRef = db.collection("telegramIdentities").doc(telegramUserId);
  const deletionRef = db.collection("accountDeletions").doc(uid);
  const displayName = [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ").trim() ||
    (telegramUser.username ? `@${telegramUser.username}` : "Telegram user");

  const existingIdentity = await identityRef.get();
  if (existingIdentity.exists && String(existingIdentity.get("uid") || "") !== uid) {
    const previousUid = String(existingIdentity.get("uid") || "");
    const previousDeletion = previousUid
      ? await db.collection("accountDeletions").doc(previousUid).get()
      : null;
    if (previousDeletion?.data()?.status !== "completed") {
      throw Object.assign(new Error("telegram identity already belongs to another account"), { code: "telegram-link-conflict" });
    }
  }

  let authUser;
  try {
    authUser = await admin.auth().getUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    try {
      authUser = await admin.auth().createUser({ uid, displayName: displayName.slice(0, 80) });
    } catch (createError) {
      if (createError?.code !== "auth/uid-already-exists") throw createError;
      authUser = await admin.auth().getUser(uid);
    }
  }
  if (authUser.disabled) throw Object.assign(new Error("telegram auth user disabled"), { code: "telegram-account-disabled" });

  const provisioned = await db.runTransaction(async (transaction) => {
    const [identitySnapshot, userSnapshot, deletionSnapshot] = await Promise.all([
      transaction.get(identityRef), transaction.get(userRef), transaction.get(deletionRef)
    ]);
    const identityUid = String(identitySnapshot.data()?.uid || "");
    if (identityUid && identityUid !== uid) {
      const previousDeletion = await transaction.get(db.collection("accountDeletions").doc(identityUid));
      if (previousDeletion.data()?.status !== "completed") {
        throw Object.assign(new Error("telegram identity already belongs to another account"), { code: "telegram-link-conflict" });
      }
    }
    if (deletionSnapshot.data()?.status === "pending") {
      throw Object.assign(new Error("telegram account deletion is still running"), { code: "telegram-account-disabled" });
    }

    const profile = userSnapshot.data() || {};
    const linkedIds = [profile.telegramUserId, profile.telegram?.telegramUserId]
      .map((value) => String(value || "").trim()).filter(Boolean);
    if (linkedIds.some((linkedId) => linkedId !== telegramUserId)) {
      throw Object.assign(new Error("telegram account profile conflict"), { code: "telegram-link-conflict" });
    }
    if (userSnapshot.exists && (
      profile.role !== "client" || profile.active === false || profile.archived === true ||
      profile.accessDisabled === true || ["revoked", "suspended"].includes(profile.membershipStatus)
    )) {
      throw Object.assign(new Error("telegram account disabled"), { code: "telegram-account-disabled" });
    }

    const now = new Date().toISOString();
    if (!userSnapshot.exists) {
      transaction.create(userRef, {
        name: displayName.slice(0, 80),
        role: "client",
        active: true,
        authProvider: "telegram",
        accountRegistrationType: "open",
        accountAccessStatus: "awaiting_trainer",
        trainerAssignmentState: "unassigned",
        telegram: {
          connected: true,
          telegramUserId,
          username: telegramUser.username || "",
          displayName,
          firstName: telegramUser.firstName || "",
          lastName: telegramUser.lastName || "",
          chatId: telegramUserId,
          notificationsEnabled: true,
          linkedAt: now,
          loginProvider: "telegram"
        },
        telegramUserId,
        telegramUsername: String(telegramUser.username || "").replace(/^@/, "").toLowerCase(),
        telegramDisplayName: displayName,
        telegramChatId: telegramUserId,
        telegramConnected: true,
        telegramNotificationsEnabled: true,
        telegramLinkedAt: now,
        createdAt: now,
        updatedAt: now
      });
      if (deletionSnapshot.data()?.status === "completed") {
        // UID reuse starts a new account lifecycle. Retain deletion evidence,
        // but do not let its completed marker exempt this live account forever.
        transaction.set(deletionRef, { status: "reopened", reopenedAt: now }, { merge: true });
      }
    } else {
      const patch = {
        telegramUserId,
        telegramUsername: String(telegramUser.username || "").replace(/^@/, "").toLowerCase(),
        telegramDisplayName: displayName,
        telegramChatId: telegramUserId,
        telegramConnected: true,
        updatedAt: now
      };
      if (profile.accountRegistrationType === "open" && profile.accountAccessStatus === "awaiting_trainer") {
        transaction.set(userRef, patch, { merge: true });
      } else if (!linkedIds.length) {
        throw Object.assign(new Error("telegram account profile conflict"), { code: "telegram-link-conflict" });
      }
    }
    transaction.set(identityRef, { uid, telegramUserId, updatedAt: now }, { merge: true });
    return { uid, data: userSnapshot.exists ? profile : { role: "client", active: true, accountRegistrationType: "open", accountAccessStatus: "awaiting_trainer" } };
  });

  return provisioned;
}

async function acceptTelegramClientInvite(telegramUser, inviteToken, pendingInvite = null) {
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(inviteToken)) return { error: "telegram-invite-invalid" };

  const db = admin.firestore();
  const inviteRef = db.collection("inviteLinks").doc(inviteToken);
  const initialSnapshot = await inviteRef.get();
  if (!initialSnapshot.exists) return pendingInvite ? { ignored: true } : { error: "telegram-invite-invalid" };
  const initialInvite = initialSnapshot.data() || {};
  if (pendingInvite && getPendingTelegramInviteToken(pendingInvite, telegramUser, { invite: initialInvite }) !== inviteToken) {
    return { ignored: true };
  }
  const uid = String(initialInvite.uid || "");
  const inviteId = String(initialInvite.inviteId || initialInvite.email || "").trim().toLowerCase();
  if (!uid || !inviteId) return { error: "telegram-invite-invalid" };

  const linkedAccounts = await findTelegramLinkedAccounts(telegramUser.id);
  if (linkedAccounts.length > 1 || linkedAccounts.some(account => account.uid !== uid)) {
    return { error: "telegram-invite-account-mismatch" };
  }

  let authUser;
  try {
    authUser = await admin.auth().getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return { error: "telegram-invite-account-unavailable" };
    throw error;
  }
  if (authUser.disabled) return { error: "telegram-invite-account-unavailable" };

  const userRef = db.collection("users").doc(uid);
  const identityRef = db.collection("telegramIdentities").doc(telegramUser.id);
  const clientInviteRef = db.collection("clientInvites").doc(inviteId);
  const pendingInviteRef = db.collection("telegramPendingClientInvites").doc(telegramUser.id);
  let transactionError = "";
  await db.runTransaction(async transaction => {
    transactionError = "";
    const [linkSnapshot, userSnapshot, identitySnapshot, clientInviteSnapshot, pendingInviteSnapshot] = await Promise.all([
      transaction.get(inviteRef), transaction.get(userRef), transaction.get(identityRef), transaction.get(clientInviteRef),
      transaction.get(pendingInviteRef)
    ]);
    const link = linkSnapshot.exists ? linkSnapshot.data() || {} : null;
    const profile = userSnapshot.exists ? userSnapshot.data() || {} : null;
    const identity = identitySnapshot.exists ? identitySnapshot.data() || {} : null;
    const clientInvite = clientInviteSnapshot.exists ? clientInviteSnapshot.data() || {} : null;
    const currentPendingInvite = pendingInviteSnapshot.exists ? pendingInviteSnapshot.data() || null : null;
    if (pendingInvite && (!link || !currentPendingInvite || currentPendingInvite.token !== inviteToken ||
        getPendingTelegramInviteToken(currentPendingInvite, telegramUser, { invite: link }) !== inviteToken ||
        getPendingTelegramInviteToken(pendingInvite, telegramUser, { invite: link }) !== inviteToken)) {
      transactionError = "telegram-invite-changed";
      return;
    }
    let identityForValidation = identity;
    if (identity?.uid && String(identity.uid) !== uid) {
      const previousDeletionSnapshot = await transaction.get(db.collection("accountDeletions").doc(String(identity.uid)));
      const previousDeletion = previousDeletionSnapshot.exists ? previousDeletionSnapshot.data() || {} : null;
      if (previousDeletion?.status !== "completed") {
        transactionError = "telegram-invite-account-mismatch";
        return;
      }
      // A completed account deletion leaves a server-only tombstone. It is safe
      // to let the authenticated Telegram owner claim the new invite and replace
      // a legacy identity marker that the older deletion flow left behind.
      identityForValidation = null;
    }
    transactionError = getTelegramInviteAcceptanceError({ link, invite: link, profile, identity: identityForValidation, clientInvite, telegramUser });
    if (transactionError) return;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const existingTelegram = profile.telegram && typeof profile.telegram === "object" ? profile.telegram : {};
    const displayName = [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ") || telegramUser.username;
    transaction.set(userRef, {
      telegram: {
        ...existingTelegram,
        connected: true,
        telegramUserId: telegramUser.id,
        username: telegramUser.username,
        displayName,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        chatId: String(link.telegramChatId || telegramUser.id),
        notificationsEnabled: existingTelegram.notificationsEnabled !== false,
        linkedAt: existingTelegram.linkedAt || now,
        loginProvider: existingTelegram.loginProvider || "telegram_client_invite"
      },
      telegramUserId: telegramUser.id,
      telegramUsername: telegramUser.username,
      telegramDisplayName: displayName,
      telegramChatId: String(link.telegramChatId || telegramUser.id),
      telegramConnected: true,
      telegramNotificationsEnabled: existingTelegram.notificationsEnabled !== false,
      telegramLinkedAt: profile.telegramLinkedAt || now,
      updatedAt: now
    }, { merge: true });
    transaction.set(identityRef, { uid, telegramUserId: telegramUser.id, updatedAt: now }, { merge: true });
    transaction.set(inviteRef, {
      status: "accepted",
      acceptedUid: uid,
      acceptedTelegramUserId: telegramUser.id,
      acceptedAt: now,
      updatedAt: now
    }, { merge: true });
    transaction.set(clientInviteRef, {
      status: "accepted",
      acceptedUid: uid,
      acceptedTelegramUserId: telegramUser.id,
      acceptedAt: now,
      updatedAt: now
    }, { merge: true });
    if (pendingInviteSnapshot.exists && pendingInviteSnapshot.data()?.token === inviteToken) {
      transaction.delete(pendingInviteRef);
    }
  });

  if (transactionError) return { error: transactionError };
  return { uid };
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
      transaction.set(db.collection("telegramIdentities").doc(telegramUser.id), {
        uid, telegramUserId: telegramUser.id, updatedAt: now
      }, { merge: true });
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

      let telegramInviteToken = String(req.body?.telegramInviteToken || "").trim();
      let pendingInvite = null;
      if (!telegramInviteToken) {
        failureStage = "lookup-pending-telegram-client-invite";
        const pendingSnapshot = await admin.firestore().collection("telegramPendingClientInvites").doc(telegramUser.id).get();
        pendingInvite = pendingSnapshot.exists ? pendingSnapshot.data() || null : null;
        telegramInviteToken = getPendingTelegramInviteToken(pendingInvite, telegramUser);
      }
      if (telegramInviteToken) {
        failureStage = "accept-telegram-client-invite";
        const inviteResult = await acceptTelegramClientInvite(telegramUser, telegramInviteToken, pendingInvite);
        if (inviteResult.error) {
          const status = inviteResult.error.includes("expired") ? 410
            : inviteResult.error.includes("mismatch") || inviteResult.error.includes("used") || inviteResult.error.includes("changed") ? 409
              : inviteResult.error.includes("not-started") ? 400
                : inviteResult.error.includes("unavailable") ? 403 : 404;
          return json(res, status, { ok: false, error: inviteResult.error });
        }
        if (!inviteResult.ignored) {
          failureStage = "create-telegram-invite-custom-token";
          const customToken = await admin.auth().createCustomToken(inviteResult.uid);
          return json(res, 200, { ok: true, customToken });
        }
      }

      failureStage = "lookup-telegram-account";
      const linkedAccounts = await findTelegramLinkedAccounts(telegramUser.id);
      let linkedAccount;
      try {
        linkedAccount = await resolveTrustedTelegramAccount(telegramUser, linkedAccounts);
      } catch (error) {
        if (["auth/telegram-relink-required", "telegram-link-conflict"].includes(error?.code)) {
          return json(res, error.code === "auth/telegram-relink-required" ? 403 : 409, { ok: false, error: error.code });
        }
        throw error;
      }
      if (!linkedAccount) {
        failureStage = "provision-staging-test-account";
        linkedAccount = await provisionStagingTestAccount(telegramUser);
      }
      if (!linkedAccount) {
        failureStage = "provision-open-telegram-account";
        try {
          linkedAccount = await provisionOpenTelegramAccount(telegramUser);
        } catch (error) {
          if (["telegram-link-conflict", "telegram-account-disabled"].includes(error?.code)) {
            const status = error.code === "telegram-link-conflict" ? 409 : 403;
            return json(res, status, { ok: false, error: error.code });
          }
          throw error;
        }
      }
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
