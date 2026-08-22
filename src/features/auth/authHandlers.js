import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import {
  getDefaultLoginAlias,
  mapLoginAuthError,
  validateLoginFields
} from "../../utils/clientUx";
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

  const aliasRef = doc(db, "loginAliases", alias);
  const aliasSnapshot = await getDoc(aliasRef);
  const current = aliasSnapshot.exists() ? aliasSnapshot.data() : null;

  if (current?.email && current.email !== email) {
    return;
  }

  await setDoc(aliasRef, {
    email,
    uid,
    updatedAt: new Date().toISOString(),
    ...(aliasSnapshot.exists() ? {} : { createdAt: new Date().toISOString() })
  }, { merge: true });
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
  const loginLower = getDefaultLoginAlias(email);
  const now = new Date().toISOString();

  const profile = {
    email,
    loginLower,
    name: user.displayName || invite.name || email.split("@")[0],
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
  const email = String(user.email || userSnapshot.data()?.email || "").trim().toLowerCase();
  const currentLoginLower = String(userSnapshot.data()?.loginLower || "").trim().toLowerCase();
  await setDoc(userRef, {
    email,
    loginLower: currentLoginLower || getDefaultLoginAlias(email),
    updatedAt: new Date().toISOString(),
    ...(user.displayName ? { name: user.displayName } : {})
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

    await ensureLoginAlias(db, user, preferredAlias);

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

  return {
    handleGoogleAuth,
    handleLogin,
    handleLoginPasswordReset
  };
}
