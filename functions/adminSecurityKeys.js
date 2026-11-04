import { createHash, randomBytes } from "node:crypto";
import * as defaultWebAuthn from "@simplewebauthn/server";
import { ADMIN_SECURITY_KEY_SESSION_MS as PROOF_TTL_MS, hasAdminSecurityKeyProof } from "./adminSecurityKeyAccess.js";

const RP_ID = "tren-85720.web.app";
const ORIGIN = "https://tren-85720.web.app";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_KEYS = 5;
const MAX_BODY_BYTES = 64 * 1024;
const ALGORITHMS = [-7, -257];
const TRANSPORTS = new Set(["usb", "nfc", "ble", "smart-card"]);
const KNOWN_TRANSPORTS = new Set([...TRANSPORTS, "internal", "hybrid"]);
const ACTIONS = new Set(["status", "registration-options", "registration-verify", "authentication-options", "authentication-verify"]);

class SecurityKeyError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function fail(status, code, message) { throw new SecurityKeyError(status, code, message); }
function invalid() { fail(400, "security-key-request-invalid", "Некорректный запрос ключа безопасности."); }
function denied() { fail(403, "admin-access-required", "Администраторский доступ недоступен. Войдите заново."); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function digest(value) { return createHash("sha256").update(value).digest("hex"); }
function version(data) { return Object.hasOwn(data, "adminClaimVersion") ? data.adminClaimVersion : null; }

function assertAdmin(context, data) {
  const token = context?.token || {};
  if (!context?.uid || typeof context.uid !== "string" || context.uid.length > 128 || context.uid.includes("/") ||
      (token.uid && token.uid !== context.uid) || token.admin !== true || data?.role !== "admin" ||
      data.active === false || data.archived === true || data.accessDisabled === true ||
      data.accountAccessStatus === "awaiting_trainer" || ["revoked", "suspended"].includes(data.membershipStatus) ||
      (Object.hasOwn(data, "adminClaimVersion")
        ? typeof data.adminClaimVersion !== "string" || token.adminClaimVersion !== data.adminClaimVersion
        : Object.hasOwn(token, "adminClaimVersion"))) denied();
}

function assertPolicy(data) {
  if (Object.hasOwn(data, "adminSecurityKeyRequired") && typeof data.adminSecurityKeyRequired !== "boolean") denied();
  if ((data.adminSecurityKeyRequired === true || Object.hasOwn(data, "adminSecurityKeyVersion")) &&
      (typeof data.adminSecurityKeyVersion !== "string" || !data.adminSecurityKeyVersion || data.adminSecurityKeyVersion.length > 128)) denied();
}

function proofUntil(token, data, now) {
  return data.adminSecurityKeyRequired === true && hasAdminSecurityKeyProof(token, data, now)
    ? token.adminSecurityKeyUntil : null;
}

function assertRegistrationAllowed(context, data, now) {
  assertPolicy(data);
  if (data.adminSecurityKeyRequired === true) {
    if (!proofUntil(context.token, data, now)) {
      fail(403, "admin-security-key-required", "Сначала подтвердите вход зарегистрированным ключом.");
    }
  } else if (context.token.auth_time * 1000 < now - CHALLENGE_TTL_MS) {
    fail(401, "recent-authentication-required", "Для первого ключа войдите в аккаунт заново.");
  }
}

function base64url(value, max = 8192) {
  if (typeof value !== "string" || !value || value.length > max || !/^[A-Za-z0-9_-]+$/.test(value) ||
      Buffer.from(value, "base64url").toString("base64url") !== value) invalid();
  return value;
}

function validateResponse(response, purpose) {
  if (!isObject(response) || response.type !== "public-key" || !isObject(response.response)) invalid();
  if (response.authenticatorAttachment != null && !["cross-platform", "platform"].includes(response.authenticatorAttachment)) invalid();
  const transports = response.response.transports;
  if (transports !== undefined && (!Array.isArray(transports) || transports.length > 8 ||
      transports.some(value => typeof value !== "string" || !KNOWN_TRANSPORTS.has(value)))) invalid();
  base64url(response.id, 1366);
  if (response.rawId !== response.id) invalid();
  base64url(response.response.clientDataJSON, 12000);
  let client;
  try { client = JSON.parse(Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8")); }
  catch { invalid(); }
  // This endpoint never authorizes embedded/cross-origin WebAuthn ceremonies.
  if (!isObject(client) || client.crossOrigin === true || client.topOrigin !== undefined) invalid();
  if (purpose === "registration") base64url(response.response.attestationObject, 48000);
  else {
    base64url(response.response.authenticatorData, 8192);
    base64url(response.response.signature, 2048);
    if (response.response.userHandle != null) base64url(response.response.userHandle, 128);
  }
  return response;
}

function validateBody(req) {
  if (req.method !== "POST") fail(405, "method-not-allowed", "Используйте POST.");
  if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers?.["content-type"] || ""))) {
    fail(415, "json-required", "Ожидается JSON.");
  }
  const declared = Number(req.headers?.["content-length"] || 0);
  if (declared > MAX_BODY_BYTES || (req.rawBody?.length || 0) > MAX_BODY_BYTES) {
    fail(413, "request-too-large", "Запрос ключа слишком большой.");
  }
  let size;
  try { size = Buffer.byteLength(JSON.stringify(req.body) || ""); } catch { invalid(); }
  if (size > MAX_BODY_BYTES) {
    fail(413, "request-too-large", "Запрос ключа слишком большой.");
  }
  const body = req.body;
  if (!isObject(body) || !ACTIONS.has(body.action)) invalid();
  const allowed = body.action.endsWith("-verify")
    ? new Set(["action", "challengeId", "response", ...(body.action === "registration-verify" ? ["label"] : [])])
    : new Set(["action"]);
  if (Object.keys(body).some(key => !allowed.has(key))) invalid();
  if (body.action.endsWith("-verify")) {
    if (typeof body.challengeId !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.challengeId)) invalid();
    validateResponse(body.response, body.action.startsWith("registration") ? "registration" : "authentication");
  }
  if (body.label !== undefined && (typeof body.label !== "string" || !body.label.trim() ||
      body.label.trim().length > 80 || [...body.label].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) invalid();
  return body;
}

function assertSingleDevice(info) {
  if (info?.userVerified !== true || info.credentialDeviceType !== "singleDevice" || info.credentialBackedUp !== false) {
    fail(400, "single-device-security-key-required", "Нужен отдельный ключ с PIN или биометрией, без облачной синхронизации.");
  }
}

function storedKey(doc) {
  const data = doc.data() || {};
  if (data.deviceType !== "singleDevice" || data.backedUp !== false ||
      typeof data.credentialId !== "string" || digest(data.credentialId) !== doc.id ||
      typeof data.publicKey !== "string" || !Number.isSafeInteger(data.counter) || data.counter < 0 ||
      !Number.isSafeInteger(data.revision) || data.revision < 0) {
    fail(409, "security-key-record-invalid", "Не удалось проверить сохранённый ключ.");
  }
  return data;
}

/** Server-only WebAuthn endpoint. Identity is verified separately from key proof. */
export function createAdminSecurityKeysHandler({ admin, getAdminIdentityContext, enforceRateLimit, verifyAppCheckRequest,
  webauthn = defaultWebAuthn, now = Date.now, testConfig } = {}) {
  if (!admin?.firestore || !admin?.auth || typeof getAdminIdentityContext !== "function" ||
      typeof enforceRateLimit !== "function" || typeof verifyAppCheckRequest !== "function") {
    throw new TypeError("Admin security key dependencies are required");
  }
  let rpID = RP_ID, origin = ORIGIN;
  if (testConfig !== undefined) {
    if (process.env.NODE_ENV !== "test" || testConfig.rpID !== "localhost" ||
        !/^http:\/\/localhost(?::\d{1,5})?$/.test(testConfig.origin)) {
      throw new TypeError("Only explicit localhost test configuration is supported");
    }
    rpID = testConfig.rpID; origin = testConfig.origin;
  }
  const db = admin.firestore();
  const auth = admin.auth();

  async function readCurrent(tx, context) {
    const ref = db.collection("users").doc(context.uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) denied();
    const data = snapshot.data() || {};
    assertAdmin(context, data); assertPolicy(data);
    return { ref, data };
  }

  async function readKeys(tx, uid) {
    const collection = db.collection("adminSecurityKeys").doc(uid).collection("credentials");
    const snapshot = await tx.get(collection.limit(MAX_KEYS + 1));
    if (snapshot.docs.length > MAX_KEYS) fail(409, "security-key-limit", "Достигнут лимит ключей безопасности.");
    return snapshot.docs.map(doc => ({ ref: doc.ref, hash: doc.id, data: storedKey(doc) }));
  }

  async function consumeChallenge(context, id, purpose) {
    const ref = db.collection("adminSecurityKeyChallenges").doc(id);
    return db.runTransaction(async tx => {
      const { data } = await readCurrent(tx, context);
      const snapshot = await tx.get(ref);
      const challenge = snapshot.exists ? snapshot.data() : null;
      const time = now();
      if (!challenge || challenge.usedAt != null || challenge.uid !== context.uid || challenge.purpose !== purpose ||
          challenge.authTime !== context.token.auth_time || challenge.adminClaimVersion !== version(data) ||
          challenge.required !== (data.adminSecurityKeyRequired === true) ||
          challenge.policyVersion !== (data.adminSecurityKeyVersion || null) ||
          !Number.isSafeInteger(challenge.expiresAt) || challenge.expiresAt <= time ||
          challenge.expiresAt > time + CHALLENGE_TTL_MS || typeof challenge.challenge !== "string") {
        fail(409, "security-key-challenge-invalid", "Подтверждение устарело или уже использовано. Повторите попытку.");
      }
      if (purpose === "registration") assertRegistrationAllowed(context, data, time);
      else if (data.adminSecurityKeyRequired !== true) denied();
      // Consume before expensive crypto. A failed ceremony needs a new challenge.
      tx.update(ref, { usedAt: time });
      return challenge;
    });
  }

  function assertChallengePolicy(challenge, data) {
    if (challenge.required !== (data.adminSecurityKeyRequired === true) ||
        challenge.policyVersion !== (data.adminSecurityKeyVersion || null) || challenge.expiresAt <= now()) {
      fail(409, "security-key-policy-changed", "Настройки ключей изменились. Повторите подтверждение.");
    }
  }

  async function assertCurrentAuthUser(context) {
    // Recheck Auth after crypto, before mutations, and again before minting.
    const user = await auth.getUser(context.uid);
    const claims = user.customClaims || {};
    const validAfter = user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : 0;
    if (user.disabled || !Number.isFinite(validAfter) || context.token.auth_time * 1000 < validAfter ||
        claims.admin !== true || version(claims) !== version(context.userData) ||
        Object.hasOwn(claims, "adminSecurityKeyVersion") || Object.hasOwn(claims, "adminSecurityKeyUntil") ||
        Object.hasOwn(claims, "adminSecurityKeyRoleVersion")) denied();
  }

  async function mintProof(context, policyVersion) {
    await assertCurrentAuthUser(context);
    await db.runTransaction(async tx => {
      const { data } = await readCurrent(tx, context);
      if (data.adminSecurityKeyRequired !== true || data.adminSecurityKeyVersion !== policyVersion) denied();
    });
    const verifiedUntil = now() + PROOF_TTL_MS;
    const customToken = await auth.createCustomToken(context.uid, {
      adminSecurityKeyVersion: policyVersion, adminSecurityKeyUntil: verifiedUntil,
      adminSecurityKeyRoleVersion: version(context.userData) ?? "legacy"
    });
    return { customToken, verifiedUntil };
  }

  async function getOptions(context, purpose) {
    const time = now();
    const state = await db.runTransaction(async tx => {
      const { data } = await readCurrent(tx, context);
      if (purpose === "registration") assertRegistrationAllowed(context, data, time);
      else if (data.adminSecurityKeyRequired !== true) denied();
      const keys = await readKeys(tx, context.uid);
      if (purpose === "registration" && keys.length >= MAX_KEYS) {
        fail(409, "security-key-limit", "Можно зарегистрировать не более пяти ключей.");
      }
      if (purpose === "authentication" && !keys.length) {
        fail(409, "security-key-unavailable", "Зарегистрированный ключ недоступен. Обратитесь к владельцу системы.");
      }
      return { data, keys };
    });
    const descriptors = state.keys.map(key => ({ id: key.data.credentialId, transports: key.data.transports }));
    const options = purpose === "registration"
      ? await webauthn.generateRegistrationOptions({
        rpName: "Zmena", rpID, userID: new Uint8Array(createHash("sha256").update(context.uid).digest()),
        userName: String(state.data.email || context.uid).slice(0, 128),
        userDisplayName: String(state.data.name || state.data.displayName || context.uid).slice(0, 80),
        timeout: CHALLENGE_TTL_MS, attestationType: "none", excludeCredentials: descriptors,
        supportedAlgorithmIDs: ALGORITHMS, preferredAuthenticatorType: "securityKey",
        authenticatorSelection: { authenticatorAttachment: "cross-platform", residentKey: "discouraged", userVerification: "required" }
      })
      : await webauthn.generateAuthenticationOptions({ rpID, allowCredentials: descriptors,
        timeout: CHALLENGE_TTL_MS, userVerification: "required" });
    if (purpose === "authentication") options.hints = ["security-key"];
    const challengeId = randomBytes(32).toString("base64url");
    await db.collection("adminSecurityKeyChallenges").doc(challengeId).create({
      uid: context.uid, authTime: context.token.auth_time, adminClaimVersion: version(state.data),
      purpose, challenge: options.challenge, createdAt: time, expiresAt: time + CHALLENGE_TTL_MS,
      required: state.data.adminSecurityKeyRequired === true, policyVersion: state.data.adminSecurityKeyVersion || null, usedAt: null
    });
    return { challengeId, options };
  }

  async function register(context, body) {
    const challenge = await consumeChallenge(context, body.challengeId, "registration");
    let result;
    try {
      result = await webauthn.verifyRegistrationResponse({ response: body.response, expectedChallenge: challenge.challenge,
        expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, requireUserPresence: true,
        supportedAlgorithmIDs: ALGORITHMS });
    } catch { fail(400, "security-key-verification-failed", "Не удалось проверить ключ. Начните подтверждение заново."); }
    if (result?.verified !== true || !result.registrationInfo) {
      fail(400, "security-key-verification-failed", "Не удалось проверить ключ. Начните подтверждение заново.");
    }
    const info = result.registrationInfo;
    assertSingleDevice(info);
    const credential = info.credential;
    if (credential?.id !== body.response.id || !(credential.publicKey instanceof Uint8Array) ||
        !credential.publicKey.length || !Number.isSafeInteger(credential.counter) || credential.counter < 0 ||
        (body.response.authenticatorAttachment && body.response.authenticatorAttachment !== "cross-platform")) invalid();
    await assertCurrentAuthUser(context);
    const hash = digest(credential.id);
    const ref = db.collection("adminSecurityKeys").doc(context.uid);
    const newVersion = randomBytes(32).toString("base64url");
    const policyVersion = await db.runTransaction(async tx => {
      const { ref: userRef, data } = await readCurrent(tx, context);
      assertChallengePolicy(challenge, data);
      assertRegistrationAllowed(context, data, now());
      const keySet = await tx.get(ref);
      const keys = await readKeys(tx, context.uid);
      if (keys.some(key => key.hash === hash)) fail(409, "security-key-already-enrolled", "Этот ключ уже зарегистрирован.");
      if (keys.length >= MAX_KEYS) fail(409, "security-key-limit", "Можно зарегистрировать не более пяти ключей.");
      const currentVersion = data.adminSecurityKeyRequired === true ? data.adminSecurityKeyVersion : newVersion;
      // The parent revision serializes parallel enrollments, including the five-key limit.
      tx.set(ref, { revision: (keySet.data()?.revision || 0) + 1, updatedAt: now() }, { merge: true });
      tx.create(ref.collection("credentials").doc(hash), {
        credentialId: credential.id, publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter, revision: 0, deviceType: info.credentialDeviceType, backedUp: false,
        transports: [...new Set((credential.transports || []).filter(value => TRANSPORTS.has(value)))],
        label: body.label?.trim() || "Ключ безопасности", createdAt: now(), lastUsedAt: null
      });
      if (data.adminSecurityKeyRequired !== true) {
        tx.update(userRef, { adminSecurityKeyRequired: true, adminSecurityKeyVersion: currentVersion });
      }
      return currentVersion;
    });
    return mintProof(context, policyVersion);
  }

  async function authenticate(context, body) {
    const challenge = await consumeChallenge(context, body.challengeId, "authentication");
    const ref = db.collection("adminSecurityKeys").doc(context.uid).collection("credentials").doc(digest(body.response.id));
    const snapshot = await ref.get();
    if (!snapshot.exists) fail(400, "security-key-not-enrolled", "Ключ не зарегистрирован для этого аккаунта.");
    const key = storedKey(snapshot);
    let result;
    try {
      result = await webauthn.verifyAuthenticationResponse({ response: body.response, expectedChallenge: challenge.challenge,
        expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: key.credentialId, publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
          counter: key.counter, transports: key.transports } });
    } catch { fail(400, "security-key-verification-failed", "Не удалось проверить ключ. Начните подтверждение заново."); }
    if (result?.verified !== true || !result.authenticationInfo) {
      fail(400, "security-key-verification-failed", "Не удалось проверить ключ. Начните подтверждение заново.");
    }
    const info = result.authenticationInfo;
    assertSingleDevice(info);
    if (info.credentialID !== key.credentialId || !Number.isSafeInteger(info.newCounter) || info.newCounter < 0 ||
        ((info.newCounter > 0 || key.counter > 0) && info.newCounter <= key.counter)) invalid();
    await assertCurrentAuthUser(context);
    const policyVersion = await db.runTransaction(async tx => {
      const { data } = await readCurrent(tx, context);
      assertChallengePolicy(challenge, data);
      const latestSnapshot = await tx.get(ref);
      if (!latestSnapshot.exists) denied();
      const latest = storedKey(latestSnapshot);
      if (latest.counter !== key.counter || latest.revision !== key.revision || latest.publicKey !== key.publicKey) {
        fail(409, "security-key-concurrent-use", "Ключ уже использован в другом подтверждении. Повторите попытку.");
      }
      tx.update(ref, { counter: info.newCounter, revision: key.revision + 1, lastUsedAt: now() });
      return data.adminSecurityKeyVersion;
    });
    return mintProof(context, policyVersion);
  }

  return async function adminSecurityKeysHandler(req, res) {
    res.set?.("Cache-Control", "no-store");
    res.set?.("X-Content-Type-Options", "nosniff");
    try {
      const body = validateBody(req);
      if (req.headers?.origin && req.headers.origin !== origin) fail(403, "origin-forbidden", "Этот адрес приложения недоступен.");
      await verifyAppCheckRequest(req);
      const context = await getAdminIdentityContext(req);
      assertAdmin(context, context?.userData);
      const time = now();
      if (!Number.isSafeInteger(context.token.auth_time) || context.token.auth_time <= 0 ||
          context.token.auth_time * 1000 > time + 60000) denied();
      const category = body.action === "status" ? "status" : body.action.endsWith("-options") ? "challenge" : "verify";
      await enforceRateLimit(context.uid, `admin-security-key-${category}`, {
        limit: category === "status" ? 60 : category === "challenge" ? 12 : 20, windowMs: 60000
      });
      let result;
      if (body.action === "status") {
        result = await db.runTransaction(async tx => {
          const { data } = await readCurrent(tx, context);
          const keys = await readKeys(tx, context.uid);
          return { required: data.adminSecurityKeyRequired === true,
            keys: keys.map(key => ({ id: key.hash, label: key.data.label, createdAt: key.data.createdAt })),
            verifiedUntil: proofUntil(context.token, data, now()) };
        });
      } else if (body.action.endsWith("-options")) result = await getOptions(context, body.action.startsWith("registration") ? "registration" : "authentication");
      else if (body.action === "registration-verify") result = await register(context, body);
      else result = await authenticate(context, body);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof SecurityKeyError) return res.status(error.status).json({ error: error.code, message: error.message });
      const status = Number(error?.status || error?.statusCode);
      if (status === 429 || error?.code === "resource-exhausted") {
        return res.status(429).json({ error: "security-key-rate-limited", message: "Слишком много попыток. Подождите минуту." });
      }
      if ([401, 403].includes(status) || ["auth/id-token-revoked", "auth/user-disabled", "unauthenticated", "permission-denied"].includes(error?.code)) {
        return res.status(status === 401 ? 401 : 403).json({ error: "admin-access-required", message: "Не удалось подтвердить доступ. Войдите заново." });
      }
      return res.status(500).json({ error: "security-key-unavailable", message: "Ключи безопасности временно недоступны. Повторите позже." });
    }
  };
}
