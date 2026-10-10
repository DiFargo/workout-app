import {
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
import { resolveEmailForLogin } from "./loginResolution";

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
  const inviteSnapshot = await getDoc(inviteRef);
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
  setSelectedUserId,
  loadHistory,
  loadWorkoutsFromFirebase
}) {
  async function finishAuth(user, preferredAlias = "") {
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      if (!hasActiveMembership(userSnapshot.data() || {})) {
        await signOut(auth).catch(() => {});
        throw makeAuthError("auth/user-disabled");
      }
      await updateExistingUserProfile(db, user, userSnapshot);
    } else {
      const invite = await getActiveInviteForUser(db, user);

      if (!invite) {
        await signOut(auth).catch(() => {});
        throw makeAuthError("auth/invite-required");
      }

      await createInvitedUserProfile(db, user, invite.data);
      await setDoc(invite.ref, {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        acceptedUid: user.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    await ensureLoginAlias(db, user, userSnapshot.data()?.loginLower || userSnapshot.data()?.accountProfile?.login || preferredAlias)
      .catch((error) => console.warn("Alias sync deferred:", error.message));

    setPage(APP_PAGES.MAIN);
    setLoginError("");
    setLoginNotice("");
    setLoginFieldErrors({});
    setSelectedUserId(null);

    loadHistory();
    loadWorkoutsFromFirebase(user.uid);
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
    try {
      const email = await resolveEmailForLogin(validation);
      const result = await signInWithEmailAndPassword(
        auth,
        email,
        validation.password
      );

      await finishAuth(result.user, validation.loginAlias);
    } catch (error) {
      setLoginError(mapLoginAuthError(error));
    } finally {
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
      const email = await resolveEmailForLogin(validation);
      await sendPasswordResetEmail(auth, email);
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

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await finishAuth(result.user);
    } catch (error) {
      setLoginError(mapLoginAuthError(error));
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleTelegramMiniAppAuth() {
    if (loginSubmitting || passwordResetSending) return;

    const initData = String(window.Telegram?.WebApp?.initData || "").trim();
    if (!initData) {
      setLoginError("Открой приложение из меню бота в Telegram, чтобы войти этим способом.");
      setLoginNotice("");
      return;
    }

    setLoginSubmitting(true);
    setLoginError("");
    setLoginNotice("");
    setLoginFieldErrors({});

    try {
      const response = await fetchWithAppCheck("/api/telegram/miniapp-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok || !data.customToken) {
        const error = new Error(data.error || "telegram-login-failed");
        error.code = data.error || "telegram-login-failed";
        throw error;
      }

      const credential = await signInWithCustomToken(auth, data.customToken);
      await finishAuth(credential.user);
    } catch (error) {
      console.error("Telegram Mini App sign-in failed:", error?.code || "unknown");
      const message = error?.code === "telegram-not-linked"
        ? "Этот Telegram ещё не привязан к аккаунту. Войди по логину и привяжи Telegram в профиле."
        : error?.code === "telegram-account-disabled"
          ? "Доступ к аккаунту отключён. Обратись к тренеру."
          : error?.code === "auth/invite-required"
            ? "Для этого аккаунта нужно приглашение тренера."
            : "Не удалось войти через Telegram. Попробуй ещё раз или выбери другой способ входа.";
      setLoginError(message);
    } finally {
      setLoginSubmitting(false);
    }
  }

  return {
    handleGoogleAuth,
    handleLogin,
    handleLoginPasswordReset,
    handleTelegramMiniAppAuth
  };
}
