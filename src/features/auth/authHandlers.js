import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import {
  getDefaultLoginAlias,
  mapLoginAuthError,
  validateLoginFields
} from "../../utils/clientUx";
import { limitUserDisplayName } from "../../utils/userDisplayName.js";
import { fetchAuthorizedWithTimeout, fetchWithAppCheck } from "../../utils/apiClient";
import { authenticateWithLoginAlias, requestLoginAliasPasswordReset } from "./loginResolution";
import { beginAuthProfilePreparation } from "./authProfilePreparation.js";
import { captureAuthSession } from "../../utils/authSession.js";

const googleProvider = new GoogleAuthProvider();
const ACTIVE_INVITE_STATUSES = new Set(["active", "created"]);

function hasActiveMembership(profile = {}) {
  const role = String(profile.role || "").trim().toLowerCase();

  return ["client", "trainer", "admin"].includes(role) &&
    profile.active !== false &&
    profile.archived !== true &&
    profile.accessDisabled !== true &&
    profile.membershipStatus !== "revoked" &&
    profile.membershipStatus !== "suspended";
}

function makeAuthError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function ensureLoginAlias(db, user, preferredAlias = "") {
  const email = String(user?.email || "").trim().toLowerCase();
  const uid = user?.uid || "";
  const alias = String(preferredAlias || getDefaultLoginAlias(email)).trim().toLowerCase();

  if (!db || !email || !uid || !alias) return;

  const response = await fetchAuthorizedWithTimeout("/api/profile/update-login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: alias })
  }, 12000);
  if (!response.ok) throw new Error("Login alias sync failed");
}

function getInviteIdForEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function getActiveInviteForUser(db, user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (!db || !email) return null;

  const inviteRef = doc(db, "clientInvites", getInviteIdForEmail(email));
  let inviteSnapshot;
  try {
    inviteSnapshot = await getDoc(inviteRef);
  } catch (error) {
    // A missing invite document is not readable under the private invite rules.
    // For open registration treat that as "no invitation"; other Firebase
    // failures still stop the authentication flow.
    if (error?.code === "permission-denied") return null;
    throw error;
  }
  if (!inviteSnapshot.exists()) return null;

  const invite = inviteSnapshot.data() || {};
  const inviteEmail = String(invite.email || "").trim().toLowerCase();
  const inviteStatus = String(invite.status || "active").trim().toLowerCase();
  const inviteAuthUid = String(invite.authUid || "").trim();

  if (
    inviteEmail !== email ||
    !ACTIVE_INVITE_STATUSES.has(inviteStatus) ||
    (inviteAuthUid && inviteAuthUid !== user.uid)
  ) {
    return null;
  }

  return { ref: inviteRef, data: invite };
}

async function createInvitedUserProfile(db, user, invite) {
  if (!db || !user?.uid) return;

  const userRef = doc(db, "users", user.uid);
  const email = String(user.email || invite.email || "").trim().toLowerCase();
  const now = new Date().toISOString();

  const profile = {
    email,
    name: limitUserDisplayName(user.displayName || invite.name || email.split("@")[0]),
    role: "client",
    active: true,
    createdAt: now,
    updatedAt: now,
    authProvider: "invite",
    inviteActivatedAt: now,
    createdBy: invite.trainerEmail || invite.createdByEmail || "",
    createdByEmail: invite.trainerEmail || invite.createdByEmail || "",
    createdByUid: invite.trainerId || invite.createdByUid || "",
    trainerId: invite.trainerId || "",
    assignedTrainerId: invite.trainerId || "",
    coachId: invite.trainerId || "",
    trainerEmail: invite.trainerEmail || "",
    assignedTrainerEmail: invite.trainerEmail || "",
    coachEmail: invite.trainerEmail || ""
  };

  await setDoc(userRef, profile, { merge: true });
}

function isAwaitingTrainerProfile(profile = {}) {
  return String(profile.role || "").trim().toLowerCase() === "client" &&
    (profile.accountAccessStatus === "awaiting_trainer" || profile.trainerAssignmentState === "unassigned");
}

async function createOpenUserProfile(db, user, authProvider = "password") {
  if (!db || !user?.uid || !user?.email) throw makeAuthError("auth/profile-create-failed");

  const email = String(user.email).trim();
  const now = new Date().toISOString();
  await setDoc(doc(db, "users", user.uid), {
    email,
    name: limitUserDisplayName(user.displayName || email.split("@")[0]),
    role: "client",
    active: true,
    accountRegistrationType: "open",
    accountAccessStatus: "awaiting_trainer",
    authProvider,
    createdAt: now,
    updatedAt: now
  });
}

async function updateExistingUserProfile(db, user, userSnapshot) {
  if (!db || !user?.uid || !userSnapshot?.exists?.()) return;

  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, {
    updatedAt: new Date().toISOString(),
    ...(user.displayName ? { name: limitUserDisplayName(user.displayName) } : {})
  }, { merge: true });
}

export function createAuthHandlers({
  APP_PAGES,
  auth,
  db,
  login,
  password,
  loginSubmitting,
  passwordResetSending,
  setLoginFieldErrors,
  setLoginError,
  setLoginNotice,
  setLoginSubmitting,
  setPasswordResetSending,
  setPage,
  setSelectedUserId
}) {
  async function finishAuth(user, preferredAlias = "", { allowOpenRegistration = false, authProvider = "password", isCurrent = () => true } = {}) {
    const userRef = doc(db, "users", user.uid);
    let userSnapshot = await getDoc(userRef);
    if (!isCurrent()) return;

    if (userSnapshot.exists() && isAwaitingTrainerProfile(userSnapshot.data() || {})) {
      // Pending accounts can authenticate and view the access status, but must
      // not call member-only APIs or receive a login alias yet.
    } else if (userSnapshot.exists()) {
      if (!hasActiveMembership(userSnapshot.data() || {})) {
        await signOut(auth).catch(() => {});
        throw makeAuthError("auth/user-disabled");
      }
      await updateExistingUserProfile(db, user, userSnapshot);
    } else {
      const invite = await getActiveInviteForUser(db, user);
      if (!isCurrent()) return;

      if (!invite && allowOpenRegistration) {
        await createOpenUserProfile(db, user, authProvider);
        if (!isCurrent()) return;
        userSnapshot = await getDoc(userRef);
      } else if (!invite) {
        await signOut(auth).catch(() => {});
        throw makeAuthError("auth/invite-required");
      } else {
        await createInvitedUserProfile(db, user, invite.data);
        if (!isCurrent()) return;
        await setDoc(invite.ref, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          acceptedUid: user.uid,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
    if (!isCurrent()) return;

    const isAwaitingTrainer = isAwaitingTrainerProfile(userSnapshot.data() || {});
    if (!isAwaitingTrainer) {
      await ensureLoginAlias(db, user, userSnapshot.data()?.loginLower || userSnapshot.data()?.accountProfile?.login || preferredAlias)
        .catch((error) => console.warn("Alias sync deferred:", error.message));
    }
    if (!isCurrent()) return;

    setPage(APP_PAGES.MAIN);
    setLoginError("");
    setLoginNotice("");
    setLoginFieldErrors({});
    setSelectedUserId(null);

    // The verified auth bootstrap owns member data. Starting those reads here
    // races its role/session transition and duplicates the same plan/history.
    return { isAwaitingTrainer };
  }

  async function handleEmailSignup(event, emailValue, passwordValue) {
    event?.preventDefault?.();
    if (loginSubmitting || passwordResetSending) return;

    const email = String(emailValue || "").trim();
    const cleanPassword = String(passwordValue || "");
    setLoginError("");
    setLoginNotice("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError("Проверь формат email.");
      return;
    }
    if (cleanPassword.length < 6) {
      setLoginError("Пароль должен содержать минимум 6 символов.");
      return;
    }

    setLoginSubmitting(true);
    const completeProfilePreparation = beginAuthProfilePreparation(auth);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, cleanPassword);
      await finishAuth(credential.user, "", { allowOpenRegistration: true, authProvider: "password" });
      setLoginNotice("Аккаунт создан. Пока тренер не назначен, разделы приложения будут заблокированы.");
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") {
        setLoginError("Аккаунт с этой почтой уже есть. Войди или восстанови пароль.");
      } else if (error?.code === "auth/weak-password") {
        setLoginError("Пароль слишком простой. Используй не менее 6 символов.");
      } else {
        setLoginError(mapLoginAuthError(error));
      }
    } finally {
      completeProfilePreparation();
      setLoginSubmitting(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (loginSubmitting) return;

    const validation = validateLoginFields(login, password);
    setLoginFieldErrors(validation.errors);
    setLoginError("");
    setLoginNotice("");
    if (!validation.valid) return;

    setLoginSubmitting(true);
    const completeProfilePreparation = beginAuthProfilePreparation(auth);
    try {
      const result = validation.isEmail
        ? await signInWithEmailAndPassword(auth, validation.email.toLowerCase(), validation.password)
        : await signInWithCustomToken(auth, await authenticateWithLoginAlias(validation, validation.password));

      await finishAuth(result.user, validation.loginAlias, { allowOpenRegistration: true, authProvider: "password" });
    } catch (error) {
      setLoginError(mapLoginAuthError(error));
    } finally {
      completeProfilePreparation();
      setLoginSubmitting(false);
    }
  }

  async function handleLoginPasswordReset() {
    if (passwordResetSending) return;

    const validation = validateLoginFields(login, "", { passwordRequired: false });
    setLoginFieldErrors(validation.errors);
    setLoginError("");
    setLoginNotice("");
    if (!validation.valid) return;

    setPasswordResetSending(true);
    try {
      if (validation.isEmail) await sendPasswordResetEmail(auth, validation.email.toLowerCase());
      else await requestLoginAliasPasswordReset(validation);
      setLoginNotice("Если аккаунт существует, ссылка для смены пароля отправлена на почту.");
    } catch (error) {
      setLoginError(mapLoginAuthError(error));
    } finally {
      setPasswordResetSending(false);
    }
  }

  async function handleGoogleAuth() {
    if (loginSubmitting || passwordResetSending) return;

    setLoginSubmitting(true);
    setLoginError("");
    setLoginNotice("");
    setLoginFieldErrors({});

    const completeProfilePreparation = beginAuthProfilePreparation(auth);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await finishAuth(result.user, "", { allowOpenRegistration: true, authProvider: "google.com" });
    } catch (error) {
      setLoginError(mapLoginAuthError(error));
    } finally {
      completeProfilePreparation();
      setLoginSubmitting(false);
    }
  }

  async function handleTelegramMiniAppAuth() {
    if (loginSubmitting || passwordResetSending) return;

    const initData = String(window.Telegram?.WebApp?.initData || "").trim();
    const telegramInviteToken = new URLSearchParams(window.location.search).get("telegramInvite") || "";
    if (!initData) {
      setLoginError(telegramInviteToken
        ? "Открой приглашение в Telegram и нажми Start, затем кнопку «Принять приглашение»."
        : "Открой приложение из меню бота в Telegram, чтобы войти этим способом.");
      setLoginNotice("");
      return;
    }

    setLoginSubmitting(true);
    setLoginError("");
    setLoginNotice("");
    setLoginFieldErrors({});

    const completeProfilePreparation = beginAuthProfilePreparation(auth);
    const startingSession = captureAuthSession(auth);
    let completedSession;
    const ownsLoginState = () => startingSession.isUnchanged() || completedSession?.isCurrent();
    let telegramDeadline;
    const telegramRequest = new AbortController();
    try {
      const request = (async () => {
        const response = await fetchWithAppCheck("/api/telegram/miniapp-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData, ...(telegramInviteToken ? { telegramInviteToken } : {}) }),
          signal: telegramRequest.signal
        });
        return { response, data: await response.json().catch(() => ({})) };
      })();
      const { response, data } = await Promise.race([request, new Promise((_, reject) => {
        telegramDeadline = setTimeout(() => {
          const timeout = new DOMException("Telegram login timed out", "AbortError");
          telegramRequest.abort(timeout);
          reject(timeout);
        }, 16000);
      })]);
      clearTimeout(telegramDeadline);
      if (!startingSession.isUnchanged()) return;

      if (!response.ok || !data.ok || !data.customToken) {
        const error = new Error(data.error || "telegram-login-failed");
        error.code = data.error || "telegram-login-failed";
        throw error;
      }

      const credential = await signInWithCustomToken(auth, data.customToken);
      if (auth.currentUser !== credential.user) return;
      completedSession = captureAuthSession(auth);
      const profileState = await finishAuth(credential.user, "", { isCurrent: completedSession.isCurrent });
      if (!completedSession.isCurrent()) return;
      if (profileState?.isAwaitingTrainer) {
        setLoginNotice("Подтверждённое приглашение пока не найдено. Открой ссылку тренера в чате с ботом и нажми Start, затем проверь приглашение ещё раз.");
      }
      if (telegramInviteToken && !profileState?.isAwaitingTrainer) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("telegramInvite");
        window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      }
    } catch (error) {
      if (!ownsLoginState()) return;
      console.error("Telegram Mini App sign-in failed:", error?.code || "unknown");
      const message = error?.name === "AbortError"
        ? "Telegram не ответил вовремя. Проверь соединение и попробуй ещё раз."
        : error?.code === "telegram-signature-invalid"
          ? "Не удалось подтвердить данные Telegram. Полностью закрой приложение и заново открой его кнопкой в чате с ботом."
        : error?.code === "telegram-not-linked"
        ? "Не удалось создать аккаунт Telegram. Попробуй ещё раз или обратись к тренеру."
        : error?.code === "auth/telegram-relink-required"
          ? "Нужно подтвердить прежнюю привязку. Войди по логину или email и паролю, затем открой Кабинет → Telegram и подключи его заново через бота. Если данных для входа нет, обратись к тренеру."
        : error?.code === "telegram-link-conflict"
          ? "Этот Telegram уже используется в другом аккаунте. Обратись к администратору."
        : error?.code === "telegram-invite-changed"
          ? "Приглашение обновилось во время проверки. Нажми кнопку приглашения ещё раз."
        : error?.code === "telegram-invite-invalid"
          ? "Приглашение не найдено или уже удалено. Попроси тренера прислать новую ссылку."
        : error?.code === "telegram-invite-username-mismatch"
          ? "Приглашение предназначено для другого Telegram-ника. Открой его из нужного аккаунта."
          : error?.code === "telegram-invite-expired"
            ? "Срок действия приглашения истёк. Попроси тренера прислать новое."
            : error?.code === "telegram-invite-account-mismatch"
              ? "Этот Telegram уже связан с другим аккаунтом. Обратись к тренеру."
              : error?.code === "telegram-invite-already-used"
                ? "Это приглашение уже использовано. Открой приложение через Telegram или попроси новое приглашение."
                : error?.code === "telegram-invite-not-started"
                  ? "Сначала нажми Start в чате с ботом по ссылке приглашения."
                  : error?.code === "telegram-invite-account-unavailable"
                    ? "Аккаунт приглашения недоступен. Обратись к тренеру."
        : error?.code === "telegram-account-disabled"
          ? "Доступ к аккаунту отключён. Обратись к тренеру."
          : error?.code === "auth/invite-required"
            ? "Для этого аккаунта нужно приглашение тренера."
            : "Не удалось войти через Telegram. Попробуй ещё раз или выбери другой способ входа.";
      setLoginError(message);
    } finally {
      clearTimeout(telegramDeadline);
      completeProfilePreparation();
      if (ownsLoginState()) setLoginSubmitting(false);
    }
  }

  return {
    handleEmailSignup,
    handleGoogleAuth,
    handleLogin,
    handleLoginPasswordReset,
    handleTelegramMiniAppAuth
  };
}
