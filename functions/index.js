import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { getDueProgressReminderTypes, getDueReminderOffsets, getMinskDateKey, getNextScheduledWorkout } from "./reminderSchedule.js";

admin.initializeApp();



const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const ADMIN_BOOTSTRAP_SECRET = defineSecret("ADMIN_BOOTSTRAP_SECRET");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const TELEGRAM_WEBHOOK_URL = "https://europe-west1-tren-85720.cloudfunctions.net/telegramWebhook";
const FIREBASE_WEB_API_KEY = "AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg";
const WORKOUT_APP_URL = "https://tren-85720.web.app/";
const INVITE_LOGIN_EMAIL_DOMAIN = "invite.tren-85720.app";
const MAX_AI_IMAGE_DATA_LENGTH = 8 * 1024 * 1024;
const MAX_AI_PROGRAM_TEXT_LENGTH = 35000;
const MAX_AI_PROGRAM_FILE_DATA_LENGTH = 10 * 1024 * 1024;

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

function isAssignedTrainerData(data = {}, uid = "") {
  return Boolean(uid) && [
    data.trainerId,
    data.assignedTrainerId,
    data.coachId,
    data.createdByUid
  ].some((value) => String(value || "") === uid);
}

async function getAuthenticatedContext(req) {
  const authorization = String(req.headers.authorization || "");
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!idToken) {
    throw createHttpError(401, "Missing Firebase ID token");
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);
  const userSnapshot = await admin.firestore().collection("users").doc(decodedToken.uid).get();
  const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};

  return {
    uid: decodedToken.uid,
    token: decodedToken,
    userData,
    role: decodedToken.admin === true ? "admin" : String(userData.role || "client")
  };
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
  return `${normalizeLoginAlias(login)}@${INVITE_LOGIN_EMAIL_DOMAIN}`;
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

function renderInviteLinkNoticePage({ email, login, title, message, statusLabel }) {
  const accountEmail = escapeHtml(login ? `Логин: ${login}` : email);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workout - доступ к приложению</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f4ff;color:#181827;font:16px Arial,sans-serif;padding:20px}.card{width:min(100%,430px);background:#fff;border:1px solid #e4e1f4;border-radius:28px;padding:30px;box-shadow:0 20px 50px #33236b20}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:#eee9ff;color:#633cff;font-size:27px;font-weight:800}.eyebrow{margin:22px 0 8px;color:#6846ec;font-size:12px;font-weight:800;letter-spacing:.08em}h1{margin:0;font-size:29px;line-height:1.1}p{color:#777386;line-height:1.45}.email{font-weight:700;color:#28243a}.status{margin-top:22px;padding:12px;border-radius:12px;background:#f3f1ff;color:#5536c7;font-size:14px}.login-link{display:block;width:100%;border-radius:15px;margin-top:20px;padding:16px;background:#643cf2;color:#fff;font-size:17px;font-weight:800;text-align:center;text-decoration:none}</style></head><body><main class="card"><div class="mark">W</div><div class="eyebrow">ДОСТУП К ПРИЛОЖЕНИЮ</div><h1>${title}</h1><p>${message} <span class="email">${accountEmail}</span>.</p><div class="status">${statusLabel}</div><a class="login-link" href="${WORKOUT_APP_URL}">Перейти ко входу</a></main></body></html>`;
}

async function isPasswordResetActionActive(actionCode) {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode: actionCode })
      }
    );
    return response.ok;
  } catch (error) {
    console.warn("Unable to verify invite action code:", error);
    return null;
  }
}

function renderInviteActivationPage({ actionCode, email, login }) {
  const code = JSON.stringify(String(actionCode || ""));
  const accountEmail = JSON.stringify(login ? `Логин: ${login}` : String(email || ""));
  const appUrl = JSON.stringify("https://tren-85720.web.app/");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workout - создание пароля</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f4ff;color:#181827;font:16px Arial,sans-serif;padding:20px}.card{width:min(100%,430px);background:#fff;border:1px solid #e4e1f4;border-radius:28px;padding:30px;box-shadow:0 20px 50px #33236b20}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:#eee9ff;color:#633cff;font-size:27px;font-weight:800}.eyebrow{margin:22px 0 8px;color:#6846ec;font-size:12px;font-weight:800;letter-spacing:.08em}h1{margin:0;font-size:29px;line-height:1.1}p{color:#777386;line-height:1.45}.email{font-weight:700;color:#28243a}label{display:block;margin-top:24px;font-size:14px;font-weight:700}input{width:100%;margin-top:8px;padding:15px 16px;border:1px solid #dedbea;border-radius:14px;font:17px Arial;outline:none}input:focus{border-color:#6846ec;box-shadow:0 0 0 4px #6846ec17}button,.login-link{width:100%;border:0;border-radius:15px;margin-top:20px;padding:16px;background:#643cf2;color:#fff;font-size:17px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none}button:disabled{opacity:.6;cursor:wait}.login-link{display:none}.login-link.show{display:block}.hint{font-size:13px;margin-top:14px}.status{display:none;margin-top:16px;padding:12px;border-radius:12px;background:#f3f1ff;color:#5536c7;font-size:14px}.status.error{background:#fff0f0;color:#b13b46}.status.show{display:block}</style></head><body><main class="card"><div class="mark">W</div><div class="eyebrow">ДОСТУП К ПРИЛОЖЕНИЮ</div><h1>Создай пароль</h1><p>Пароль будет привязан к аккаунту <span class="email" id="email"></span>. После сохранения можно войти в Workout.</p><form id="form"><label>Новый пароль<input id="password" type="password" minlength="6" required autocomplete="new-password" placeholder="Минимум 6 символов"></label><label>Повтори пароль<input id="repeat" type="password" minlength="6" required autocomplete="new-password" placeholder="Повтори пароль"></label><button id="submit" type="submit">Сохранить пароль</button></form><div id="status" class="status"></div><a id="login-link" class="login-link" href=${appUrl}>Перейти ко входу</a><p class="hint">Ссылка действует ограниченное время и может быть использована один раз.</p></main><script>const code=${code},email=${accountEmail},apiKey="AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg";document.getElementById("email").textContent=email;const form=document.getElementById("form"),status=document.getElementById("status"),button=document.getElementById("submit"),loginLink=document.getElementById("login-link");function show(message,error=false){status.textContent=message;status.className="status show"+(error?" error":"")}form.addEventListener("submit",async e=>{e.preventDefault();const password=document.getElementById("password").value,repeat=document.getElementById("repeat").value;if(password!==repeat)return show("Пароли не совпадают.",true);button.disabled=true;button.textContent="Сохраняю...";try{const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key="+apiKey,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({oobCode:code,newPassword:password})});if(!r.ok)throw new Error();show("Пароль создан. Теперь можно войти в приложение.");form.hidden=true;loginLink.classList.add("show")}catch{show("Ссылка недействительна или срок её действия истёк. Попроси тренера создать новое приглашение.",true);button.disabled=false;button.textContent="Сохранить пароль"}});</script></body></html>`;
}

function normalizeLoginAlias(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidLoginAlias(value) {
  return /^[a-z0-9._-]{3,32}$/.test(String(value || ""));
}

async function sendTelegramMessage({ chatId, telegramUserId, username, text, token }) {
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
      disable_web_page_preview: true
    })
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || "Telegram API error");
  }

  return data;
}

async function getAuthenticatedUid(req) {
  return (await getAuthenticatedContext(req)).uid;
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
    const bucket = admin.storage().bucket("tren-85720.firebasestorage.app");
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



function assertAdmin(request) {
  if (!request.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Only admin can perform this action.");
  }
}

export const setAdminClaim = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30
  },
  async (request) => {
    assertAdmin(request);

    const uid = String(request.data?.uid || "").trim();
    const adminClaim = Boolean(request.data?.admin);

    if (!uid) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }

    await admin.auth().setCustomUserClaims(uid, {
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
    secrets: [ADMIN_BOOTSTRAP_SECRET]
  },
  async (request) => {
    const email = String(request.data?.email || "").trim().toLowerCase();
    const bootstrapSecret = String(request.data?.bootstrapSecret || "");

    const expectedSecret = ADMIN_BOOTSTRAP_SECRET.value();

    if (!expectedSecret || bootstrapSecret !== expectedSecret) {
      throw new HttpsError("permission-denied", "Invalid bootstrap secret.");
    }

    if (!email) {
      throw new HttpsError("invalid-argument", "email is required.");
    }

    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true
    });

    await admin.firestore().collection("users").doc(user.uid).set({
      role: "admin",
      adminClaimUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
      ok: true,
      uid: user.uid,
      email,
      admin: true
    };
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

      const context = await getAuthenticatedContext(req);
      if (context.role !== "trainer" && context.token?.admin !== true) {
        return json(res, 403, { error: "Trainer access required" });
      }

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

      const generatedPassword = `${crypto.randomBytes(24).toString("base64url")}!`;
      const createdUser = await admin.auth().createUser({ email, password: generatedPassword, displayName: name });
      const now = new Date().toISOString();
      const trainerEmail = normalizeAccountEmail(context.token?.email || context.userData?.email);
      // Cloud Run receives an internal Host header through Hosting rewrites.
      // Firebase only accepts an authorized public continue URL for password actions.
      const appUrl = "https://tren-85720.web.app/";
      const inviteUrl = `${appUrl}?invite=${encodeURIComponent(email)}`;
      const activationUrl = await admin.auth().generatePasswordResetLink(email, { url: inviteUrl });
      const activationToken = crypto.randomBytes(18).toString("base64url");
      const shareUrl = `${appUrl}invite/${activationToken}`;
      const clientPayload = {
        email, emailIsInternal: true, loginLower: login, accountProfile: { login },
        name, role: "client", createdAt: now, updatedAt: now,
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
      if (isActionActive === false) {
        await snapshot.ref.set({ status: "used", usedAt: new Date().toISOString() }, { merge: true });
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
      const uid = await getAuthenticatedUid(req);
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
      const status = /Firebase ID token|auth\/argument-error|auth\/id-token/i.test(error.message) ? 401 : 500;
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
      const uid = await getAuthenticatedUid(req);
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
      const status = /Firebase ID token|auth\/argument-error|auth\/id-token/i.test(error.message) ? 401 : 500;
      return json(res, status, { ok: false, error: error.message });
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
      const context = await getAuthenticatedContext(req);
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
      const context = await getAuthenticatedContext(req);
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

export const telegramSetWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const context = await getAuthenticatedContext(req);
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
          url: TELEGRAM_WEBHOOK_URL,
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

      if (fromId && text) {
        const matches = await admin.firestore()
          .collection("users")
          .where("telegram.telegramUserId", "==", fromId)
          .limit(1)
          .get();

        if (!matches.empty) {
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
      const context = await getAuthenticatedContext(req);
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
    const context = await getAuthenticatedContext(req);
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
      const context = await getAuthenticatedContext(req);
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
      const context = await getAuthenticatedContext(req);
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
      const context = await getAuthenticatedContext(req);
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
      const context = await getAuthenticatedContext(req);
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


export const aiFoodPhoto = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: [OPENAI_API_KEY],
    cors: true
  },
  async (req, res) => {
    const apiVersion = "aiFoodPhoto-v4";
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed", apiVersion });

    try {
      const context = await getAuthenticatedContext(req);
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
        "You are a food photo nutrition estimation system for a fitness app.",
        "First decide whether the main visible object is edible food, a drink, a food package, or a nutrition label.",
        "Furniture, people, animals, household objects and other non-food objects must return isFood=false and ok=false.",
        "If a package or nutrition label is visible, extract exact label data. If plated food is visible, identify the most likely dish.",
        "Package text has priority over common products and local database matches.",
        "Return name in Russian unless it is a visible brand/package name.",
        "Keep name short, 2-4 words maximum.",
        "For packaged food preserve only the visible brand and short product name.",
        "For homemade or plated food use a short Russian dish name without a brand.",
        "Do not use filler words such as Homemade, Fresh, Traditional or long descriptions.",
        "Do not add a brand unless it is clearly visible in the photo.",
        "If the product is TEOS Greek yogurt with cereals and flax fiber, return that exact product meaning, not plain Greek yogurt.",
        "Nutrition values from the label are the highest priority.",
        "Always return calories/protein/fat/carbs per 100 grams.",
        "Never return 0 unless that nutrient is truly zero.",
        "For homemade or plated food estimate typical nutrition values.",
        "If food or a food package cannot be identified reliably, return ok=false, an empty name and zero nutrition values.",
        "Never invent a product when the image is unclear or does not contain food.",
        "Estimate the visible product weight in grams. For a package or label use its serving/net weight or 100 g basis; for plated food estimate the visible mass. If unsure return 100.",
        "If you can read text partially, preserve the exact visible words instead of simplifying.",
        "Return JSON only."
      ].join("\n");

      const userPrompt = [
        "Analyze this food package, nutrition label, or plated food photo.",
        "Return the best editable food draft for a nutrition diary.",
        "For labels: extract the visible brand, a short product name and KBJU.",
        "For plated food: identify the likely dish and estimate KBJU realistically.",
        'Examples: "Homemade Cottage Cheese Pancakes with Raisins" -> "Сырники с изюмом"; "Chicken with Rice and Vegetables" -> "Курица с рисом"; "Oatmeal with Banana" -> "Овсянка с бананом"; "Greek Yogurt with Cereal" -> "Греческий йогурт".',
        "Prefer OCR label values. Do not replace visible package data with a generic database item.",
        "Return this JSON shape:",
        "{",
        '  "ok": true if food is identified, otherwise false,',
        '  "isFood": true only for edible food, drink, food package or nutrition label,',
        '  "name": "short Russian product or dish name, 2-4 words",',
        '  "brand": "brand if visible",',
        '  "query": "search/exact product query",',
        '  "calories": number_per_100g,',
        '  "protein": number_per_100g,',
        '  "fat": number_per_100g,',
        '  "carbs": number_per_100g,',
        '  "estimatedGrams": estimated_visible_weight_in_grams_or_100,',
        '  "portion": "100 г",',
        '  "servingSize": "visible serving size if any",',
        '  "ingredients": ["visible important additives/flavor"],',
        '  "detectedIngredients": ["visible important additives/flavor"],',
        '  "confidence": "high|medium|low",',
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
          model: "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemPrompt }]
            },
            {
              role: "user",
              content: [
                { type: "input_text", text: `${userPrompt}\nFile name: ${fileName}` },
                { type: "input_image", image_url: imageUrl }
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
                required: ["ok", "isFood", "name", "brand", "query", "calories", "protein", "fat", "carbs", "estimatedGrams", "portion", "servingSize", "ingredients", "detectedIngredients", "confidence", "candidates"]
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

      const firstAiCandidate = Array.isArray(parsed.candidates) && parsed.candidates.length
        ? parsed.candidates[0] || {}
        : {};

      const normalizeText = (value = "") => String(value || "").trim();
      const getPositiveNumber = (primary, fallback, defaultValue = 0) => {
        const primaryNumber = Number(primary);
        if (Number.isFinite(primaryNumber) && primaryNumber > 0) return primaryNumber;
        const fallbackNumber = Number(fallback);
        if (Number.isFinite(fallbackNumber) && fallbackNumber > 0) return fallbackNumber;
        return defaultValue;
      };

      const name = normalizeText(parsed.name || parsed.query || firstAiCandidate.name || firstAiCandidate.query);
      const query = normalizeText(parsed.query || parsed.name || firstAiCandidate.query || firstAiCandidate.name || name);
      const brand = normalizeText(parsed.brand || firstAiCandidate.brand);
      const detectedIngredients = Array.isArray(parsed.detectedIngredients)
        ? parsed.detectedIngredients
        : Array.isArray(parsed.ingredients)
          ? parsed.ingredients
          : [];

      const exactName = [brand, name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const estimatedGrams = getPositiveNumber(parsed.estimatedGrams, firstAiCandidate.estimatedGrams, 100);
      const normalizedProductName = String(exactName || name || query || "").trim().toLowerCase();
      const rejectedNames = new Set([
        "продукт не найден",
        "не найдено",
        "неизвестный продукт",
        "продукт по фото",
        "food not found",
        "unknown product"
      ]);
      const recognizedFood = parsed.ok !== false
        && parsed.isFood === true
        && Boolean(normalizedProductName)
        && ![...rejectedNames].some((name) => normalizedProductName.includes(name))
        && String(parsed.confidence || "").toLowerCase() !== "low";
      let calories = getPositiveNumber(parsed.calories, firstAiCandidate.calories, 0);
      let protein = getPositiveNumber(parsed.protein, firstAiCandidate.protein, 0);
      let fat = getPositiveNumber(parsed.fat, firstAiCandidate.fat, 0);
      let carbs = getPositiveNumber(parsed.carbs, firstAiCandidate.carbs, 0);

      if (recognizedFood && (calories <= 0 || (protein <= 0 && fat <= 0 && carbs <= 0))) {
        calories = 200;
        protein = 8;
        fat = 8;
        carbs = 22;
      }

      if (!recognizedFood) {
        return json(res, 200, {
          ok: true,
          found: false,
          isFood: false,
          apiVersion,
          product: null,
          message: "Продукт на фото не найден."
        });
      }

      const productName = exactName || name || query || "Продукт по фото";
      const product = {
        name: productName,
        query: query || productName,
        brand,
        calories,
        protein,
        fat,
        carbs,
        estimatedGrams,
        portion: parsed.portion || firstAiCandidate.portion || "100 г",
        portionAmount: 100,
        source: recognizedFood ? "AI фото" : "AI фото · примерная оценка",
        confidence: parsed.confidence || firstAiCandidate.confidence || (recognizedFood ? "medium" : "low")
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
        calories: product.calories,
        protein: product.protein,
        fat: product.fat,
        carbs: product.carbs,
        estimatedGrams,
        portion: product.portion,
        servingSize: parsed.servingSize || "",
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
